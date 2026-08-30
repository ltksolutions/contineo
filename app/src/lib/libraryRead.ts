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
    hasDraft: Boolean(String(d.draftMarkdown ?? "").trim()),
    originalFile: original
      ? { name: original.name, type: original.type, bytes: original.bytes }
      : undefined,
    updatedAt: d.updatedAt as Date | undefined,
    updatedBy: d.updatedBy ? String(d.updatedBy) : undefined,
  }
}

export interface LibraryFilter {
  search?: string
  status?: string
  /** Priečinok **vrátane podpriečinkov** — hľadá sa v materializovanej ceste. */
  priecinok?: string
  /** `nezaradene` = dokumenty, ktoré v žiadnom priečinku nie sú. */
  category?: string
  language?: string
  accessLevel?: string
  tag?: string
}

export async function libraryList(
  companyCode: string,
  filter: LibraryFilter = {},
): Promise<LibraryRow[]> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const q: Record<string, unknown> = { companyCode }

  // Staré slovenské hodnoty z odkazov spred premenovania sa prekladajú,
  // nie zahadzujú — inak by záložka v prehliadači potichu ukázala všetko.
  const status = filter.status === "koncept" ? "draft"
    : filter.status === "publikovane" ? "published"
    : filter.status
  if (status === "draft") q.status = { $ne: "published" }
  if (status === "published") q.status = "published"

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

  if (filter.search?.trim()) {
    // Vstup od človeka ide do regulárneho výrazu — bez escapovania by `(`
    // zhodilo dotaz a `.*` prehľadalo všetko.
    const safe = filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    q.$or = [
      { title: { $regex: safe, $options: "i" } },
      { documentId: { $regex: safe, $options: "i" } },
      { sectionKey: { $regex: safe, $options: "i" } },
    ]
  }

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
