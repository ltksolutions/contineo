/**
 * chunkOrphans.ts — ktoré úseky sú osirelé (krok pred „znenia v indexe").
 *
 * Osirelý úsek je **neaktívny úsek normy, ktorého znenie už v organizácii
 * neexistuje** — zvyšok staršieho indexovania alebo zmazaného dokumentu.
 * Do hľadania nevstupuje (je neaktívny), ale automatický embedding ho
 * vektorizuje a pri zmene indexu by sa prepočítal zbytočne. Mazanie schválil
 * Ján 2026-09-28; skript je `scripts/delete_orphan_chunks.mjs`.
 *
 * Čistá funkcia bez databázy, aby sa pravidlo dalo otestovať — mazanie
 * dát je presne to miesto, kde sa omyl v podmienke nesmie prejaviť až naostro.
 *
 * **Čo sa nikdy nepovažuje za osirelé:**
 * - aktívny úsek — ten je v hľadaní, a keby mu chýbalo znenie, je to chyba
 *   na preskúmanie, nie smeti;
 * - overená odpoveď (`sourceType: "qa"`) — má vlastný životný cyklus
 *   (`curation.ts`) a znenie nenesie;
 * - úsek bez `versionId` — nevieme, kam patrí, tak ho nemažeme;
 * - úsek, ktorého `versionId` má **ktorékoľvek** znenie organizácie, aj pod
 *   iným `documentId` (dokument mohol dostať nový identifikátor, D80).
 */

export interface ChunkRef {
  documentId?: string | null
  versionId?: string | null
  isActive?: boolean
  sourceType?: string | null
}

export type OrphanReason = "document-missing" | "version-missing"

export interface OrphanVerdict {
  orphan: boolean
  reason?: OrphanReason
}

/**
 * Je úsek osirelý?
 *
 * @param versionsByDocument znenia organizácie: `documentId` → `versionId`-y
 */
export function orphanVerdict(
  chunk: ChunkRef,
  versionsByDocument: Map<string, Set<string>>,
  allVersionIds: Set<string>,
): OrphanVerdict {
  if (chunk.isActive !== false) return { orphan: false }
  if (chunk.sourceType === "qa") return { orphan: false }
  const versionId = typeof chunk.versionId === "string" ? chunk.versionId.trim() : ""
  if (!versionId) return { orphan: false }
  if (allVersionIds.has(versionId)) return { orphan: false }
  const documentId = String(chunk.documentId ?? "")
  return { orphan: true, reason: versionsByDocument.has(documentId) ? "version-missing" : "document-missing" }
}

/** Mapa znení organizácie z dokumentov (projekcia `documentId`, `versions.versionId`). */
export function versionIndex(docs: { documentId: string; versions?: { versionId?: string | null }[] | null }[]): {
  versionsByDocument: Map<string, Set<string>>
  allVersionIds: Set<string>
} {
  const versionsByDocument = new Map<string, Set<string>>()
  const allVersionIds = new Set<string>()
  for (const d of docs) {
    const ids = new Set((d.versions ?? []).map(v => String(v?.versionId ?? "").trim()).filter(Boolean))
    versionsByDocument.set(d.documentId, ids)
    for (const id of ids) allVersionIds.add(id)
  }
  return { versionsByDocument, allVersionIds }
}
