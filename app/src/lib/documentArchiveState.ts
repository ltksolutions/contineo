/**
 * Stav archivácie predpisu — čisté funkcie (ADR-025, D156).
 *
 * Oddelené od `documentArchive.ts`, aby ich mohol čítať zoznam knižnice
 * a karta bez toho, aby si ťahali zápis, pridelenia a databázu.
 */
import type { Version } from "./documents"

/** Záznam o archivácii znenia. Obnovenie ho uzavrie, nezmaže. */
export interface ArchiveEntry {
  at: Date
  by: string
  reason: string
  /** Deň, od ktorého znenie neplatí (exkluzívny koniec, ako pri novele). */
  effectiveTo: Date
  restoredAt?: Date | null
  restoredBy?: string | null
  /** Kedy sa odvolali pridelenia — raz, aby denný beh nerobil to isté znova. */
  settledAt?: Date | null
}

export type ArchivableVersion = Version & { archives?: ArchiveEntry[] }

/** Otvorený záznam o archivácii znenia, alebo `null`. */
export function openArchive(v: { archives?: ArchiveEntry[]; effectiveTo?: Date | null } | undefined): ArchiveEntry | null {
  const last = v?.archives?.at(-1)
  if (!last || last.restoredAt) return null
  // Záznam bez konca platnosti by bol rozpor (niekto ho medzitým zmazal) —
  // taký predpis archivovaný nie je.
  return v?.effectiveTo instanceof Date ? last : null
}

/**
 * Posledné zverejnené znenie (`isActive`) — to, ktoré archivácia ukončí
 * alebo obnovenie znova otvorí.
 */
export function latestPublished<V extends { isActive: boolean; effectiveFrom: Date | null }>(versions: V[] | undefined): V | undefined {
  return (versions ?? []).find(v => v.isActive && v.effectiveFrom instanceof Date)
}

/** Stav archivácie predpisu pre kartu a zoznam. */
export function archiveState(doc: { versions?: ArchivableVersion[] }, now: Date = new Date()):
  | { archived: false }
  | { archived: true; entry: ArchiveEntry; versionId: string; inEffect: boolean } {
  const v = latestPublished(doc.versions)
  const entry = openArchive(v)
  if (!v || !entry) return { archived: false }
  return { archived: true, entry, versionId: v.versionId, inEffect: entry.effectiveTo.getTime() <= now.getTime() }
}
