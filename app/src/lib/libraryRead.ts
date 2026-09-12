/**
 * kniznica.citanie.ts — pohľad na knižnicu pre správcu obsahu (D53).
 *
 * Oddelené od zápisu zámerne: čítanie je bez vedľajších účinkov a volá sa
 * z každého vykreslenia, zápis je vzácny a má audit. Zmiešané by to znamenalo,
 * že sa pri jednom dotaze ťahá aj kód, ktorý zapisuje.
 *
 * **Vidno len vlastnú organizáciu.** `companyCode` je v každom dotaze ako
 * podmienka, nie ako kontrola nad ním (D32).
 */

import { getCollection } from "./mongodb"
import { allFolders, pathTo } from "./folders"
import { DOCUMENTS_COLLECTION, effectiveVersion } from "./documents"
import type { Version } from "./documents"
import type { OriginalFile, ProcessingState } from "./libraryWrite"
import { conditionQuery, type Condition, type MatchMode } from "./libraryConditions"
import { openRounds } from "./approvalsDb"

export interface LibraryRow {
  documentId: string
  title: string
  sectionKey: string
  category?: string
  language?: string
  accessLevel?: string
  tags: string[]
  processingState: ProcessingState
  /** `draft` = ešte nepublikované, `published` = má aspoň jedno vydané znenie. */
  status: string
  folderId?: string | null
  /** Názvy priečinkov od koreňa — do zoznamu, aby bolo vidieť, kde dokument je. */
  folderTrail?: string[]
  versionCount: number
  /** Označenie platného znenia, alebo dôvod, prečo žiadne neplatí. */
  effectiveLabel: string
  /**
   * Odkedy platí znenie z `effectiveLabel`. `null` znamená **neplatí žiadne**,
   * nie „nevie sa" — dokument bez platného znenia je legitímny stav (koncept,
   * znenie s budúcou účinnosťou) a v zozname sa má dať odlíšiť od dátumu.
   */
  effectiveFrom: Date | null
  hasDraft: boolean
  originalFile?: { name: string; type: string; bytes: number }
  updatedAt?: Date
  updatedBy?: string
}

export interface LibraryDetail extends LibraryRow {
  draftMarkdown?: string
  markdown?: string
  /**
   * Text, ktorý sa má otvoriť v editore.
   *
   * Nie je to `draftMarkdown ?? markdown`: dokumenty naimportované skriptom
   * nemajú **ani jedno** — text si nesie len položka vo `versions[]`. Editor
   * sa im preto otváral prázdny, čo vyzeralo, akoby sa norma stratila.
   * Poradie je zámerné: rozpracovaný koncept, potom platné znenie, až potom
   * najnovšie zapísané.
   */
  editableText: string
  versions: Version[]
  originalFile?: OriginalFile
  conversion?: { method: string; warnings: string[]; at: Date }
  processingError?: string | null
  scope?: string
  companyCode: string
}

const REASON: Record<string, string> = {
  "no-versions": "zatiaľ nepublikované",
  "validity-not-set": "bez dátumu platnosti — nedá sa potvrdiť",
  "all-archived": "všetky znenia archivované",
  "not-yet-effective": "platnosť ešte nezačala",
  "no-longer-effective": "platnosť už skončila",
}

function validityLabel(doc: { versions?: Version[] }): string {
  const v = effectiveVersion(doc as never)
  return v.ok ? v.version.label : (REASON[v.reason] ?? v.reason)
}

/**
 * Odkedy platí znenie, ktoré platí teraz. `null` = neplatí žiadne.
 *
 * Samostatne vedľa `validityLabel()` zámerne: obe sa pýtajú tej istej
 * `effectiveVersion()`, ale jedna vracia **text pre človeka** a druhá
 * **dátum pre stroj**. Keby to bola jedna hodnota, do exportu by sa dostal
 * dátum už naformátovaný podľa jazyka prehliadača — a taký sa nedá zoradiť.
 */
function validityFrom(doc: { versions?: Version[] }): Date | null {
  const v = effectiveVersion(doc as never)
  return v.ok && v.version.effectiveFrom ? new Date(v.version.effectiveFrom) : null
}

type RawRow = Record<string, unknown> & { versions?: Version[] }

function toRow(d: RawRow): LibraryRow {
  const original = d.originalFile as OriginalFile | undefined
  return {
    documentId: String(d.documentId),
    title: String(d.title ?? d.documentId),
    sectionKey: String(d.sectionKey ?? ""),
    category: d.category ? String(d.category) : undefined,
    language: d.language ? String(d.language) : undefined,
    accessLevel: d.accessLevel ? String(d.accessLevel) : undefined,
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    processingState: (d.processingStatus as ProcessingState | undefined) ?? "uploaded",
    status: String(d.status ?? "draft"),
    folderId: (d.folderId as string | null | undefined) ?? null,
    versionCount: (d.versions ?? []).length,
    effectiveLabel: validityLabel(d),
    effectiveFrom: validityFrom(d),
    hasDraft: Boolean(String(d.draftMarkdown ?? "").trim()),
    originalFile: original
      ? { name: original.name, type: original.type, bytes: original.bytes }
      : undefined,
    updatedAt: d.updatedAt as Date | undefined,
    updatedBy: d.updatedBy ? String(d.updatedBy) : undefined,
  }
}

/**
 * Filtre knižnice. Facety sú **viachodnotové** — „norma alebo smernica" je
 * bežná otázka a jednohodnotový filter na ňu odpovedať nevie. Jedna hodnota
 * sa prijíma ďalej: staré odkazy s `?category=norma` musia chodiť.
 */
export interface LibraryFilter {
  search?: string
  status?: string | string[]
  /**
   * Priečinok **vrátane podpriečinkov** — hľadá sa v materializovanej ceste.
   * `nezaradene` = dokumenty, ktoré v žiadnom priečinku nie sú.
   *
   * Jednohodnotový zámerne: je to miesto v strome, v ktorom sa človek
   * nachádza, nie vlastnosť dokumentu.
   */
  priecinok?: string
  category?: string | string[]
  language?: string | string[]
  accessLevel?: string | string[]
  tag?: string | string[]
  /** Podmienky z query buildera. Sú nad facetmi, nie namiesto nich. */
  conditions?: Condition[]
  match?: MatchMode
}

/** Filter, ktorý podmienku vyrobil. Podľa neho sa dá jedna vynechať. */
export type FilterKey =
  | "status" | "folder" | "category" | "language" | "accessLevel" | "tag" | "search" | "conditions"

function listOf(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value : value === undefined ? [] : [value]
  return [...new Set(raw.map(v => v.trim()).filter(Boolean))]
}

/**
 * Podmienky dotazu rozložené podľa filtra, ktorý ich vyrobil.
 *
 * Rozdelené preto, že **počty pri facetoch sa počítajú bez vlastného filtra**.
 * Keby sa počítali s ním, po kliknutí na „Norma" by ostatné kategórie mali
 * nulu a človek by prišel o informáciu, ktorá ho zaujíma najviac: čo by
 * dostal, keby prepol.
 *
 * Podmienky sa skladajú do `$and`, nie do jedného objektu: fulltext aj
 * „nezaradené" používajú `$or` a v jednom objekte by si ho navzájom prepísali.
 */
export function queryParts(
  filter: LibraryFilter,
  /**
   * Dokumenty s bežiacim kolom schvaľovania (ADR-006).
   *
   * Chodia sem **zvonku, ako zoznam identifikátorov**, nie ako `$lookup`.
   * Stav znenia je odvodený z inej kolekcie (D27) a spojiť ich v jednom dotaze
   * by znamenalo agregáciu naprieč kolekciami pri každom otvorení knižnice.
   * Kolá sú jednotky až desiatky, takže dva dotazy sú lacnejšie a hlavne sa
   * dajú prečítať.
   */
  inReviewIds: string[] = [],
): { key: FilterKey; cond: Record<string, unknown> }[] {
  const parts: { key: FilterKey; cond: Record<string, unknown> }[] = []

  // Staré slovenské hodnoty z odkazov spred premenovania sa prekladajú,
  // nie zahadzujú — inak by záložka v prehliadači potichu ukázala všetko.
  const statuses = listOf(filter.status).map(v =>
    v === "koncept" ? "draft" : v === "publikovane" ? "published" : v,
  )

  /*
   * Tri hodnoty, ale **nie tri priehradky**. Koncept a publikované sú
   * rozdelenie knižnice: buď — alebo. „Na schválenie" je iná os — dokument
   * môže byť publikovaný a zároveň mať bežiace kolo nad novým znením, takže
   * sa k tomu rozdeleniu pridáva cez `$or`, nie doňho.
   *
   * Zaškrtnúť koncept aj publikované je „všetko" a filter vtedy nevzniká —
   * `$and` dvoch protikladov by nevrátil nič, hoci človek zaškrtol opak.
   * A keďže „všetko" pokrýva aj kolá, nepridáva sa v tom prípade ani
   * podmienka na kolá.
   */
  const wantsPublished = statuses.includes("published")
  const wantsDraft = statuses.includes("draft")
  const wantsInReview = statuses.includes("in-review")

  if (!(wantsPublished && wantsDraft)) {
    const conds: Record<string, unknown>[] = []
    if (wantsPublished) conds.push({ status: "published" })
    if (wantsDraft) conds.push({ status: { $ne: "published" } })
    if (wantsInReview) conds.push({ documentId: { $in: inReviewIds } })
    if (conds.length > 0) {
      parts.push({ key: "status", cond: conds.length === 1 ? conds[0] : { $or: conds } })
    }
  }

  // Priečinok sa filtruje cez cestu, takže „oddelenie komunikácie" nájde aj
  // to, čo je v jeho podpriečinkoch. Jeden dotaz namiesto rekurzie pri každom
  // zobrazení — to je celý dôvod, prečo sa cesta ukladá.
  if (filter.priecinok === "nezaradene") {
    parts.push({ key: "folder", cond: { $or: [{ folderId: null }, { folderId: { $exists: false } }] } })
  } else if (filter.priecinok) {
    parts.push({ key: "folder", cond: { folderPath: filter.priecinok } })
  }

  const fields: [Exclude<FilterKey, "status" | "folder" | "search" | "conditions">, string][] = [
    ["category", "category"],
    ["language", "language"],
    ["accessLevel", "accessLevel"],
    // Štítky sú na dokumente pole; rovnosť aj `$in` na ňom fungujú ako
    // „obsahuje", takže netreba `$elemMatch`.
    ["tag", "tags"],
  ]
  for (const [key, field] of fields) {
    const values = listOf(filter[key])
    if (values.length === 1) parts.push({ key, cond: { [field]: values[0] } })
    else if (values.length > 1) parts.push({ key, cond: { [field]: { $in: values } } })
  }

  const conds = conditionQuery(filter.conditions ?? [], filter.match ?? "all")
  if (conds) parts.push({ key: "conditions", cond: conds })

  if (filter.search?.trim()) {
    // Vstup od človeka ide do regulárneho výrazu — bez escapovania by `(`
    // zhodilo dotaz a `.*` prehľadalo všetko.
    const safe = filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    parts.push({
      key: "search",
      cond: {
        $or: [
          { title: { $regex: safe, $options: "i" } },
          { documentId: { $regex: safe, $options: "i" } },
          { sectionKey: { $regex: safe, $options: "i" } },
        ],
      },
    })
  }

  return parts
}

/**
 * Dotaz na dokumenty. `except` vynechá jednu podmienku — to je celý trik za
 * počtami pri facetoch.
 *
 * **`companyCode` je v podmienke, nie v kontrole nad ňou** (D32).
 */
export function buildQuery(
  companyCode: string,
  filter: LibraryFilter = {},
  except?: FilterKey,
  inReviewIds: string[] = [],
): Record<string, unknown> {
  const conds = queryParts(filter, inReviewIds)
    .filter(p => p.key !== except)
    .map(p => p.cond)
  return conds.length ? { companyCode, $and: conds } : { companyCode }
}

export interface FacetCount {
  value: string
  count: number
}

/**
 * Počty pri facetoch. Kľúče sú tie isté ako vo filtri.
 *
 * `total` je počet dokumentov, ktoré vyhovujú **celému** filtru — to je číslo
 * do hlavičky („N z M"). Počty v jednotlivých facetoch sú naopak bez vlastnej
 * podmienky, aby človek videl, čo by dostal, keby prepol.
 */
export interface LibraryFacets {
  total: number
  all: number
  category: FacetCount[]
  status: FacetCount[]
  tag: FacetCount[]
  accessLevel: FacetCount[]
  language: FacetCount[]
}

/** Zoradenie počtov: najprv najčetnejšie, pri rovnosti podľa hodnoty. */
function sortCounts(rows: { _id: unknown; n: number }[]): FacetCount[] {
  return rows
    .filter(r => typeof r._id === "string" && r._id !== "")
    .map(r => ({ value: String(r._id), count: r.n }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "sk"))
}

/**
 * Jedna agregácia namiesto šiestich dotazov.
 *
 * `$facet` pustí každú vetvu nad tým istým vstupom, takže sa kolekcia
 * prechádza raz. Vstup je zúžený len na organizáciu — každá vetva si potom
 * priloží svoj vlastný `$match` bez toho filtra, ktorý počíta.
 */
export async function libraryFacets(
  companyCode: string,
  filter: LibraryFilter = {},
): Promise<LibraryFacets> {
  const col = await getCollection(DOCUMENTS_COLLECTION)

  /*
   * Dokumenty s bežiacim kolom. Jeden malý dotaz do `approval_rounds` —
   * kolá sú jednotky, takže je lacnejší než agregácia naprieč kolekciami
   * pri každom otvorení knižnice.
   */
  const inReviewIds = [...new Set((await openRounds(companyCode)).map(r => r.documentId))]

  const without = (except?: FilterKey) => {
    const conds = queryParts(filter, inReviewIds).filter(p => p.key !== except).map(p => p.cond)
    return conds.length ? { $and: conds } : {}
  }

  const [out] = await col
    .aggregate([
      { $match: { companyCode } },
      {
        $facet: {
          total: [{ $match: without() }, { $count: "n" }],
          all: [{ $count: "n" }],
          category: [{ $match: without("category") }, { $group: { _id: "$category", n: { $sum: 1 } } }],
          // Stav nie je pole s hodnotami, ale rozdelenie na dve skupiny —
          // rovnaké, aké robí filter: publikované verzus všetko ostatné.
          status: [
            { $match: without("status") },
            {
              $group: {
                _id: { $cond: [{ $eq: ["$status", "published"] }, "published", "draft"] },
                n: { $sum: 1 },
              },
            },
          ],
          /*
             Počet pre „na schválenie" sa nedá získať zoskupením nad
             dokumentom — stav je v inej kolekcii. Preto vlastná vetva
             s tým istým filtrom bez `status`, ako majú ostatné počty:
             číslo má hovoriť, čo by človek dostal, keby prepol.
          */
          statusInReview: [
            { $match: { $and: [without("status"), { documentId: { $in: inReviewIds } }] } },
            { $count: "n" },
          ],
          tag: [
            { $match: without("tag") },
            { $unwind: "$tags" },
            { $group: { _id: "$tags", n: { $sum: 1 } } },
          ],
          accessLevel: [{ $match: without("accessLevel") }, { $group: { _id: "$accessLevel", n: { $sum: 1 } } }],
          language: [{ $match: without("language") }, { $group: { _id: "$language", n: { $sum: 1 } } }],
        },
      },
    ])
    .toArray() as unknown as [Record<string, { _id: unknown; n: number }[]>]

  const count = (rows: { n: number }[] | undefined) => rows?.[0]?.n ?? 0

  return {
    total: count(out?.total as { n: number }[] | undefined),
    all: count(out?.all as { n: number }[] | undefined),
    category: sortCounts(out?.category ?? []),
    status: [
      ...sortCounts(out?.status ?? []),
      // Až na koniec, nie podľa počtu: „na schválenie" je iná os než koncept
      // verzus publikované a medzi ne nepatrí. Nula sa neukazuje — prázdny
      // riadok filtra len zaberá miesto.
      ...(count(out?.statusInReview as { n: number }[] | undefined) > 0
        ? [{ value: "in-review", count: count(out?.statusInReview as { n: number }[] | undefined) }]
        : []),
    ],
    tag: sortCounts(out?.tag ?? []),
    accessLevel: sortCounts(out?.accessLevel ?? []),
    language: sortCounts(out?.language ?? []),
  }
}

export async function libraryList(
  companyCode: string,
  filter: LibraryFilter = {},
): Promise<LibraryRow[]> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  /*
   * Zoznam dokumentov s bežiacim kolom sa načíta len vtedy, keď sa naň
   * filtruje. Bez tejto podmienky by každé otvorenie knižnice platilo dotaz
   * navyše za filter, ktorý nikto nezapol.
   */
  const wantsInReview = listOf(filter.status).includes("in-review")
  const inReviewIds = wantsInReview
    ? [...new Set((await openRounds(companyCode)).map(r => r.documentId))]
    : []
  const q = buildQuery(companyCode, filter, undefined, inReviewIds)

  const records = await col
    .find(q as never, {
      projection: {
        documentId: 1, title: 1, sectionKey: 1, category: 1, language: 1, accessLevel: 1,
        tags: 1, status: 1, processingStatus: 1, draftMarkdown: 1, originalFile: 1,
        folderId: 1, folderPath: 1, updatedAt: 1, updatedBy: 1,
        // Z verzií len to, čo treba na „ktoré znenie platí" — samotné texty
        // znení sú veľké a v zozname by sa ťahali zbytočne.
        "versions.versionId": 1, "versions.label": 1, "versions.isActive": 1,
        "versions.effectiveFrom": 1, "versions.effectiveTo": 1,
      },
    })
    .sort({ updatedAt: -1, title: 1 })
    .toArray()

  const folders = await allFolders(companyCode)
  return records.map(z => {
    const r = toRow(z as RawRow)
    return { ...r, folderTrail: pathTo(folders, r.folderId).map(p => p.name) }
  })
}

export async function libraryDetail(
  companyCode: string,
  documentId: string,
): Promise<LibraryDetail | null> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const d = (await col.findOne({ companyCode, documentId })) as RawRow | null
  if (!d) return null

  const versions = (d.versions ?? []).slice()
  const effective = effectiveVersion(d as never)
  const newest = versions
    .slice()
    .sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      return tb - ta
    })[0]

  const editableText =
    String(d.draftMarkdown ?? "").trim() ||
    String(d.markdown ?? "").trim() ||
    (effective.ok ? String(effective.version.markdown ?? "") : "") ||
    String(newest?.markdown ?? "")

  const folders = await allFolders(companyCode)

  return {
    ...toRow(d),
    folderTrail: pathTo(folders, (d.folderId as string | null | undefined) ?? null).map(p => p.name),
    editableText: editableText,
    companyCode,
    scope: d.scope ? String(d.scope) : undefined,
    draftMarkdown: d.draftMarkdown ? String(d.draftMarkdown) : undefined,
    markdown: d.markdown ? String(d.markdown) : undefined,
    versions: (d.versions ?? []).slice().sort((a, b) => {
      const ta = a.effectiveFrom ? new Date(a.effectiveFrom).getTime() : 0
      const tb = b.effectiveFrom ? new Date(b.effectiveFrom).getTime() : 0
      return tb - ta
    }),
    originalFile: d.originalFile as OriginalFile | undefined,
    conversion: d.konverzia as LibraryDetail["conversion"],
    processingError: (d.processingError as string | null) ?? null,
  }
}
