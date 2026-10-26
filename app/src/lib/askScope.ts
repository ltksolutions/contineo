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

/** Najviac dokumentov v zúžení `?doc=` (D269) — aj pre MCP `documentIds`. */
export const MAX_SCOPE_DOCUMENTS = 10

/**
 * Zúženie knižnice na dokumenty z adresy `?doc=` (D269): `doc=a,b` so
 * skriptom, `doc=a&doc=b` z formulára bez skriptu. Vracia len id — či ich
 * osoba vidí, overí stránka (`loadDocumentFor`, D32) a neviditeľné zahodí.
 */
export function documentIdsFromQuery(doc: string | string[] | undefined): string[] {
  const all = Array.isArray(doc) ? doc : doc ? [doc] : []
  return [...new Set(all.flatMap(v => v.split(",")).map(x => x.trim()).filter(x => x !== ""))].slice(0, MAX_SCOPE_DOCUMENTS)
}

/**
 * V čom sa hľadalo — knižnica, názvy živých zdrojov a (D269) názvy
 * dokumentov, keď bola knižnica zúžená. Kópie názvov, nie id.
 */
export interface SearchedScope {
  library: boolean
  live: string[]
  /** Len pri zúžení knižnice na dokumenty; chýba = celá knižnica. */
  documents?: string[]
}

/**
 * „V čom sa hľadalo" z tela požiadavky `/api/rating` — uloží sa len tento
 * tvar (knižnica áno/nie, najviac 10 názvov po 120 znakov, názvy
 * dokumentov po 200). Bez poľa `undefined`: starý klient, záznam si zdroje
 * odvodí z obsahu.
 */
export function sanitizeSearchedScope(v: unknown): SearchedScope | undefined {
  if (!v || typeof v !== "object") return undefined
  const o = v as { library?: unknown; live?: unknown; documents?: unknown }
  const names = (x: unknown, max: number) => Array.isArray(x)
    ? x.filter((n): n is string => typeof n === "string" && n.trim() !== "").map(n => n.slice(0, max)).slice(0, MAX_SCOPE_DOCUMENTS)
    : []
  const documents = names(o.documents, 200)
  return { library: o.library === true, live: names(o.live, 120), ...(documents.length ? { documents } : {}) }
}

/** Dokument vo výbere rozsahu (`?doc=`, D269) — na `/ask` a v plachte otázky. */
export interface AskScopeDocument {
  id: string
  title: string
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
