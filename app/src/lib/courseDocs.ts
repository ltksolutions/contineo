/**
 * Blok „dokument z knižnice" v kurze (rám PART, PART Q2 ✅) — údaje
 * o **konkrétnom znení**, na ktoré blok odkazuje, a o tom, či v knižnici
 * medzitým neplatí novšie.
 *
 * Blok nesie `documentId` + `versionId` zmrazené pri zverejnení kurzu;
 * odkaz ostáva na toto znenie aj vtedy, keď platí novšie (D118). Obsah sa
 * nekopíruje — kurz odkazuje na schválené znenie v knižnici.
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION, effectiveVersion, type DocumentRecord } from "./documents"
import type { Part } from "./courses"

export interface CourseDocInfo {
  /** Označenie znenia z bloku (napr. „úplné znenie od 7. 9. 2026"). `null`, keď znenie zmizlo. */
  label: string | null
  effectiveFrom: Date | null
  /** Platné znenie v knižnici, keď je iné než to z kurzu. */
  newer: { label: string; effectiveFrom: Date | null } | null
}

/** Pre všetky bloky „dokument" v časti — jedným dotazom. */
export async function courseDocInfo(companyCode: string, part: Part): Promise<Map<string, CourseDocInfo>> {
  const blocks = part.blocks.filter((b): b is Extract<Part["blocks"][number], { type: "document" }> => b.type === "document")
  const out = new Map<string, CourseDocInfo>()
  if (!blocks.length) return out
  const docs = await (await getCollection<DocumentRecord & { companyCode: string }>(DOCUMENTS_COLLECTION))
    .find({ companyCode, documentId: { $in: blocks.map(b => b.documentId) } }, { projection: { _id: 0, documentId: 1, versions: 1 } })
    .toArray()
  for (const b of blocks) {
    const doc = docs.find(d => d.documentId === b.documentId)
    const v = doc?.versions?.find(x => x.versionId === b.versionId) ?? null
    const eff = doc ? effectiveVersion(doc) : null
    const current = eff?.ok ? eff.version : null
    out.set(b.id, {
      label: v?.label ?? null,
      effectiveFrom: v?.effectiveFrom ?? null,
      newer: current && current.versionId !== b.versionId ? { label: current.label, effectiveFrom: current.effectiveFrom ?? null } : null,
    })
  }
  return out
}

export interface DocumentChoice {
  documentId: string
  versionId: string
  title: string
  label: string
}

/**
 * Ponuka pre blok „dokument z knižnice" (rám MANAGE-COURSE): dokumenty
 * organizácie s **platným znením** k dnešku. Blok si uloží práve toto
 * znenie (`versionId`) — odkaz na konkrétne znenie, nie kópiu obsahu.
 */
export async function documentChoices(companyCode: string): Promise<DocumentChoice[]> {
  const docs = await (await getCollection<DocumentRecord & { companyCode: string }>(DOCUMENTS_COLLECTION))
    .find({ companyCode }, { projection: { _id: 0, documentId: 1, title: 1, versions: 1 } })
    .toArray()
  const out: DocumentChoice[] = []
  for (const d of docs) {
    const eff = effectiveVersion(d)
    if (eff.ok) out.push({ documentId: d.documentId, versionId: eff.version.versionId, title: d.title, label: eff.version.label })
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, "sk"))
}
