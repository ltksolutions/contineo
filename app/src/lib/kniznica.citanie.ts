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
import { vsetkyPriecinky, cesta } from "./priecinky"
import { DOCUMENTS_COLLECTION, effectiveVersion } from "./documents"
import type { Version } from "./documents"
import type { PovodnySubor, StavSpracovania } from "./kniznica.zapis"

export interface RiadokKniznice {
  documentId: string
  title: string
  sectionKey: string
  category?: string
  language?: string
  accessLevel?: string
  tags: string[]
  stavSpracovania: StavSpracovania
  /** `draft` = ešte nepublikované, `published` = má aspoň jedno vydané znenie. */
  stav: string
  folderId?: string | null
  /** Názvy priečinkov od koreňa — do zoznamu, aby bolo vidieť, kde dokument je. */
  cestaPriecinkov?: string[]
  verzii: number
  /** Označenie platného znenia, alebo dôvod, prečo žiadne neplatí. */
  platneZnenie: string
  maKoncept: boolean
  povodnySubor?: { nazov: string; typ: string; bajtov: number }
  updatedAt?: Date
  updatedBy?: string
}

export interface DetailKniznice extends RiadokKniznice {
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
  textNaUpravu: string
  versions: Version[]
  originalFile?: PovodnySubor
  konverzia?: { sposob: string; upozornenia: string[]; kedy: Date }
  processingError?: string | null
  scope?: string
  companyCode: string
}

const DOVOD: Record<string, string> = {
  "no-versions": "zatiaľ nepublikované",
  "validity-not-set": "bez dátumu platnosti — nedá sa potvrdiť",
  "all-archived": "všetky znenia archivované",
  "not-yet-effective": "platnosť ešte nezačala",
  "no-longer-effective": "platnosť už skončila",
}

function popisPlatnosti(doc: { versions?: Version[] }): string {
  const v = effectiveVersion(doc as never)
  return v.ok ? v.version.label : (DOVOD[v.reason] ?? v.reason)
}

type Surovy = Record<string, unknown> & { versions?: Version[] }

function naRiadok(d: Surovy): RiadokKniznice {
  const povodny = d.originalFile as PovodnySubor | undefined
  return {
    documentId: String(d.documentId),
    title: String(d.title ?? d.documentId),
    sectionKey: String(d.sectionKey ?? ""),
    category: d.category ? String(d.category) : undefined,
    language: d.language ? String(d.language) : undefined,
    accessLevel: d.accessLevel ? String(d.accessLevel) : undefined,
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    // Dokumenty naimportované skriptom majú `processingStatus: "indexed"`
    // v anglickom tvare. Prekladá sa tu, nie migráciou — prepisovať existujúce
    // záznamy kvôli pomenovaniu by bola zmena dát bez dôvodu.
    stavSpracovania: (d.processingStatus === "indexed" ? "zaindexovane"
      : (d.processingStatus as StavSpracovania | undefined) ?? "nahrate"),
    stav: String(d.status ?? "draft"),
    folderId: (d.folderId as string | null | undefined) ?? null,
    verzii: (d.versions ?? []).length,
    platneZnenie: popisPlatnosti(d),
    maKoncept: Boolean(String(d.draftMarkdown ?? "").trim()),
    povodnySubor: povodny
      ? { nazov: povodny.nazov, typ: povodny.typ, bajtov: povodny.bajtov }
      : undefined,
    updatedAt: d.updatedAt as Date | undefined,
    updatedBy: d.updatedBy ? String(d.updatedBy) : undefined,
  }
}

export interface FilterKniznice {
  hladat?: string
  stav?: string
  /** Priečinok **vrátane podpriečinkov** — hľadá sa v materializovanej ceste. */
  priecinok?: string
  /** `nezaradene` = dokumenty, ktoré v žiadnom priečinku nie sú. */
  category?: string
  language?: string
  accessLevel?: string
  tag?: string
}

export async function zoznamKniznice(
  companyCode: string,
  filter: FilterKniznice = {},
): Promise<RiadokKniznice[]> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const q: Record<string, unknown> = { companyCode }

  if (filter.stav === "koncept") q.status = { $ne: "published" }
  if (filter.stav === "publikovane") q.status = "published"

  // Priečinok sa filtruje cez cestu, takže „úsek komunikácie" nájde aj to,
  // čo je v jeho podpriečinkoch. Jeden dotaz namiesto rekurzie pri každom
  // zobrazení — to je celý dôvod, prečo sa cesta ukladá.
  if (filter.priecinok === "nezaradene") {
    q.$and = [
      { $or: [{ folderId: null }, { folderId: { $exists: false } }] },
    ]
  } else if (filter.priecinok) {
    q.folderPath = filter.priecinok
  }

  if (filter.category) q.category = filter.category
  if (filter.language) q.language = filter.language
  if (filter.accessLevel) q.accessLevel = filter.accessLevel
  if (filter.tag) q.tags = filter.tag

  if (filter.hladat?.trim()) {
    // Vstup od človeka ide do regulárneho výrazu — bez escapovania by `(`
    // zhodilo dotaz a `.*` prehľadalo všetko.
    const bezpecne = filter.hladat.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    q.$or = [
      { title: { $regex: bezpecne, $options: "i" } },
      { documentId: { $regex: bezpecne, $options: "i" } },
      { sectionKey: { $regex: bezpecne, $options: "i" } },
    ]
  }

  const zaznamy = await col
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

  const priecinky = await vsetkyPriecinky(companyCode)
  return zaznamy.map(z => {
    const r = naRiadok(z as Surovy)
    return { ...r, cestaPriecinkov: cesta(priecinky, r.folderId).map(p => p.nazov) }
  })
}

export async function detailKniznice(
  companyCode: string,
  documentId: string,
): Promise<DetailKniznice | null> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const d = (await col.findOne({ companyCode, documentId })) as Surovy | null
  if (!d) return null

  const versions = (d.versions ?? []).slice()
  const platna = effectiveVersion(d as never)
  const najnovsia = versions
    .slice()
    .sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      return tb - ta
    })[0]

  const textNaUpravu =
    String(d.draftMarkdown ?? "").trim() ||
    String(d.markdown ?? "").trim() ||
    (platna.ok ? String(platna.version.markdown ?? "") : "") ||
    String(najnovsia?.markdown ?? "")

  const priecinky = await vsetkyPriecinky(companyCode)

  return {
    ...naRiadok(d),
    cestaPriecinkov: cesta(priecinky, (d.folderId as string | null | undefined) ?? null).map(p => p.nazov),
    textNaUpravu,
    companyCode,
    scope: d.scope ? String(d.scope) : undefined,
    draftMarkdown: d.draftMarkdown ? String(d.draftMarkdown) : undefined,
    markdown: d.markdown ? String(d.markdown) : undefined,
    versions: (d.versions ?? []).slice().sort((a, b) => {
      const ta = a.effectiveFrom ? new Date(a.effectiveFrom).getTime() : 0
      const tb = b.effectiveFrom ? new Date(b.effectiveFrom).getTime() : 0
      return tb - ta
    }),
    originalFile: d.originalFile as PovodnySubor | undefined,
    konverzia: d.konverzia as DetailKniznice["konverzia"],
    processingError: (d.processingError as string | null) ?? null,
  }
}
