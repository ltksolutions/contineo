/**
 * askScope.ts — rozsah hľadania z adresy `/ask` (ADR-029, ASK-zdroje-hladania).
 *
 * `?src=library,<id>` posiela odoslanie so skriptom, `?src=library&src=<id>`
 * formulár bez skriptu (checkboxy s rovnakým menom) — oba tvary platia.
 * Neznáme id sa zahodí (konektor mohol medzitým zmiznúť alebo nie je pre
 * túto úroveň prístupu). Prázdny výsledok = predvolený výber, ten určí
 * `Search` (knižnica a konektory s „používať predvolene").
 */
export function scopeFromQuery(src: string | string[] | undefined, liveIds: string[]): string[] {
  const all = Array.isArray(src) ? src : src ? [src] : []
  return [...new Set(all.flatMap(v => v.split(",")).map(x => x.trim()))]
    .filter(x => x === "library" || liveIds.includes(x))
}
