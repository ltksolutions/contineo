/**
 * askScope.ts — rozsah hľadania z adresy `/ask` (ADR-029, ASK-zdroje-hladania).
 *
 * `?src=library,<id>` posiela odoslanie so skriptom, `?src=library&src=<id>`
 * formulár bez skriptu (checkboxy s rovnakým menom) — oba tvary platia.
 * Neznáme id sa zahodí (konektor mohol medzitým zmiznúť alebo nie je pre
 * túto úroveň prístupu). Prázdny výsledok = predvolený výber, ten určí
 * `Search` (knižnica a konektory s „používať predvolene").
 */
/**
 * Staré id zdrojov v adrese → dnešné. Historické hodnoty sa neprepisujú,
 * prekladajú (`CLAUDE.md`): `law` bol do 25. 10. id druhu, dnes je to zdroj
 * `slov-lex` (ADR-040 Dodatok 1, D268).
 */
const LEGACY_SOURCE_IDS: Record<string, string> = { law: "slov-lex" }

export function scopeFromQuery(src: string | string[] | undefined, liveIds: string[]): string[] {
  const all = Array.isArray(src) ? src : src ? [src] : []
  return [...new Set(all.flatMap(v => v.split(",")).map(x => x.trim()).map(x => LEGACY_SOURCE_IDS[x] ?? x))]
    .filter(x => x === "library" || liveIds.includes(x))
}

/**
 * „V čom sa hľadalo" z tela požiadavky `/api/rating` — uloží sa len tento
 * tvar (knižnica áno/nie, najviac 10 názvov po 120 znakov). Bez poľa
 * `undefined`: starý klient, záznam si zdroje odvodí z obsahu.
 */
export function sanitizeSearchedScope(v: unknown): { library: boolean; live: string[] } | undefined {
  if (!v || typeof v !== "object") return undefined
  const o = v as { library?: unknown; live?: unknown }
  const live = Array.isArray(o.live)
    ? o.live.filter((x): x is string => typeof x === "string" && x.trim() !== "").map(x => x.slice(0, 120)).slice(0, 10)
    : []
  return { library: o.library === true, live }
}

/** Živý zdroj pre výber na `/ask` a v plachte otázky (ASK-zdroje-v-plachte). */
export interface AskLiveSource {
  id: string
  name: string
  defaultOn: boolean
}

/** Predvolený výber: Knižnica a konektory s „používať predvolene" (Ján 8. 10. 2026). */
export function defaultScope(live: { id: string; defaultOn?: boolean }[]): string[] {
  return ["library", ...live.filter(l => l.defaultOn).map(l => l.id)]
}
