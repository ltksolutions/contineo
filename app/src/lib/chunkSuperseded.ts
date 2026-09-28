/**
 * chunkSuperseded.ts — ktoré členenie znenia je nahradené (plán „znenia
 * v indexe", krok 2; `docs/TODO.md`).
 *
 * ## Dva rôzne dôvody, prečo úsek nie je aktívny
 *
 * `isActive: false` dnes znamená dve odlišné veci a hľadanie ich nevie
 * rozlíšiť:
 *
 * - **znenie bolo nahradené novším** (`publish()`) — úseky sú stále jediné
 *   narezanie **toho** znenia; otázka „čo platilo vlani" ich potrebuje;
 * - **členenie bolo nahradené** preindexovaním toho istého znenia
 *   (`reindex()`) — text je ten istý, len inak narezaný; v hľadaní by sa
 *   objavil dvakrát.
 *
 * Príznak `superseded` na úseku odlišuje druhý prípad: `true` = nahradené
 * členenie, `false` = platné členenie svojho znenia (aj keď znenie samo už
 * neplatí). `isActive` sa nemení a dnešné hľadanie funguje ako doteraz —
 * nový filter zavedie až krok 4.
 *
 * **Prečo uložený stav, nie odvodený (D27).** Filter vektorového hľadania
 * (`$vectorSearch`) vie filtrovať len podľa polí úseku uvedených v indexe;
 * „toto je najnovšie narezanie svojho znenia" sa v ňom vypočítať nedá.
 * Rovnaký dôvod už má `isActive`.
 *
 * Čistá funkcia pre migráciu existujúcich úsekov
 * (`scripts/migrate_chunk_superseded.mjs`); nové úseky dostávajú príznak
 * pri zápise v `publish()` a `reindex()`.
 */

export interface ChunkForSuperseded {
  _id: unknown
  versionId?: string | null
  chunkingId?: string | null
  isActive?: boolean
  sourceType?: string | null
  createdAt?: Date | string | null
  embeddedAt?: Date | string | null
}

const time = (c: ChunkForSuperseded): number => {
  const t = c.createdAt ?? c.embeddedAt
  const n = t ? new Date(t).getTime() : NaN
  return Number.isNaN(n) ? 0 : n
}

/**
 * Rozdelí úseky normy na platné členenie a nahradené, **v rámci každého
 * znenia zvlášť**.
 *
 * - Platné je členenie, ktoré má aktívne úseky. Keď znenie aktívne úseky
 *   nemá (bolo nahradené novším), platné je jeho **najnovšie** členenie.
 * - Overené odpovede (`sourceType: "qa"`) a úseky bez `versionId` sa
 *   nezaraďujú nikam — nemajú znenie, ku ktorému by patrili.
 */
export function classifyChunkings(chunks: ChunkForSuperseded[]): { current: unknown[]; superseded: unknown[] } {
  const byVersion = new Map<string, ChunkForSuperseded[]>()
  for (const c of chunks) {
    if (c.sourceType === "qa") continue
    const v = typeof c.versionId === "string" ? c.versionId.trim() : ""
    if (!v) continue
    byVersion.set(v, [...(byVersion.get(v) ?? []), c])
  }

  const current: unknown[] = []
  const superseded: unknown[] = []
  for (const list of byVersion.values()) {
    const groups = new Map<string, ChunkForSuperseded[]>()
    for (const c of list) {
      const k = String(c.chunkingId ?? "(bez chunkingId)")
      groups.set(k, [...(groups.get(k) ?? []), c])
    }
    const active = [...groups.entries()].filter(([, g]) => g.some(c => c.isActive === true)).map(([k]) => k)
    const keep = new Set(active.length
      ? active
      : [[...groups.entries()].reduce((a, b) => (Math.max(...b[1].map(time)) > Math.max(...a[1].map(time)) ? b : a))[0]])
    for (const [k, g] of groups) {
      for (const c of g) (keep.has(k) ? current : superseded).push(c._id)
    }
  }
  return { current, superseded }
}
