/**
 * trackNames.ts — trasa podľa názvu (2. 10. 2026).
 *
 * Kľúč trasy nikto nevidí ani nezadáva (nové trasy majú UUID). Človek trasu
 * určuje **názvom** — pri osobe, v importe — a názov je preto v organizácii
 * jedinečný (`checkTitleFree()` v `tracks.ts`). Čisté funkcie bez databázy,
 * aby ich mohol použiť import aj server.
 */

/** Porovnanie názvov — bez ohľadu na veľkosť písmen a medzery navyše. */
export function sameTrackTitle(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("sk")
  return norm(a) === norm(b)
}

/**
 * Kľúč trasy pre to, čo napísal človek: **názov**, alebo kľúč staršej trasy
 * (importy spred 2. 10. 2026 písali kľúče ako `novy-zamestnanec`). `null`,
 * keď taká trasa nie je — volajúci to nahlási, nevymyslí novú.
 */
export function trackKeyFor(value: string, tracks: { key: string; title: string }[]): string | null {
  const v = value.trim()
  if (!v) return null
  const byTitle = tracks.find(t => sameTrackTitle(t.title, v))
  if (byTitle) return byTitle.key
  const byKey = tracks.find(t => t.key === v.toLowerCase())
  return byKey ? byKey.key : null
}
