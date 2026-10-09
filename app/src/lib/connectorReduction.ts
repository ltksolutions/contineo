/**
 * connectorReduction.ts — hotové vzory redukcie a návrhy z Vyskúšať
 * hľadanie (ADR-029, D176; návrh ORG-konektory, 9. 10. 2026).
 *
 * Redukcia je zúženie pre interných, nie brána pre verejnosť (D176). Server
 * ju neopíše — je to naše pravidlo nad vráteným textom. Preto sa správcovi
 * ponúka z toho, čo server naozaj vrátil: nadpisy, ktoré sa opakujú,
 * spoločné časti ciest a hodnoty skupín. Všetko čisté, bez volania servera.
 */

import type { LiveArticle } from "./mcp/profiles/types"

export const SCRUB_PRESETS = ["email", "phone", "iban", "birthNumber"] as const
export type ScrubPreset = (typeof SCRUB_PRESETS)[number]

export function isScrubPreset(x: unknown): x is ScrubPreset {
  return typeof x === "string" && (SCRUB_PRESETS as readonly string[]).includes(x)
}

/** Regulárne výrazy hotových vzorov. Radšej vymažú o niečo viac než menej. */
export const PRESET_PATTERNS: Record<ScrubPreset, string> = {
  email: String.raw`[\w.+-]+@[\w-]+(?:\.[\w-]+)+`,
  // Medzinárodný alebo slovenský tvar s medzerami; aspoň 9 číslic, aby to nebol dátum ani rok.
  phone: String.raw`(?<![\w+])(?:\+|00)?\d{3}[ /-]?\d{3}[ /-]?\d{3}(?:[ /-]?\d{3})?(?!\d)`,
  iban: String.raw`\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b`,
  // Rodné číslo: RRMMDD/XXXX alebo RRMMDD/XXX (aj bez lomky pri 10 číslach).
  birthNumber: String.raw`\b\d{2}[0156]\d[0-3]\d(?:/\d{3,4}|\d{4})\b`,
}

/** Vzory, ktoré sa naozaj použijú: hotové (zapnuté) a vlastné. */
export function scrubRegexes(presets: readonly string[] | undefined, own: readonly string[]): string[] {
  return [...(presets ?? []).filter(isScrubPreset).map(p => PRESET_PATTERNS[p]), ...own]
}

export interface ReductionSuggestions {
  /** Nadpisy `##`/`###` s počtom výskytov, od 2, bez už zahadzovaných. */
  headings: { text: string; count: number }[]
  /** Spoločné úseky ciest (`/internal/`, `-rules-`), ak ich má viac než jeden výsledok. */
  paths: { part: string; count: number }[]
  /** Hodnoty skupín z výsledkov — kandidáti na rozsah. */
  groups: { value: string; count: number; existingScope?: string }[]
}

const SUGGEST_MAX = 8

function bump(m: Map<string, number>, k: string) { m.set(k, (m.get(k) ?? 0) + 1) }

function top(m: Map<string, number>, min: number): [string, number][] {
  return [...m.entries()].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, SUGGEST_MAX)
}

/** Úseky cesty: priečinky (`/x/`) a slová v názve súboru (`-x-`), každý raz za článok. */
export function pathParts(externalId: string): string[] {
  const parts = new Set<string>()
  const segs = externalId.split("/")
  for (const s of segs.slice(0, -1)) if (s && !/^[a-z][\w+.-]*:$/i.test(s)) parts.add(`/${s}/`)
  const file = (segs.at(-1) ?? "").replace(/\.[a-z0-9]+$/i, "")
  const words = file.split("-")
  for (const w of words.slice(1, -1)) if (w.length >= 3 && !/^\d+$/.test(w)) parts.add(`-${w}-`)
  return [...parts]
}

/**
 * Návrhy z výsledku hľadania. `articles` sú **pred** redukciou — inak by
 * zahodené nadpisy nebolo vidieť a návrh by nemal z čoho vzniknúť.
 */
export function suggestReductions(
  articles: LiveArticle[],
  policy: { dropSections: string[]; skipPaths: string[] },
  scopes: { key: string; filter: Record<string, string> }[],
): ReductionSuggestions {
  const dropped = new Set(policy.dropSections.map(s => s.trim().toLowerCase()))
  const headings = new Map<string, number>()
  const paths = new Map<string, number>()
  const groups = new Map<string, number>()
  for (const a of articles) {
    for (const m of a.text.matchAll(/^#{2,3}\s+(.+?)\s*#*\s*$/gm)) {
      const h = m[1].trim()
      if (!h || dropped.has(h.toLowerCase())) continue
      // Početnosť vo všetkých článkoch, nie počet článkov: „Key files · 12×".
      bump(headings, h)
    }
    for (const p of pathParts(a.externalId)) {
      if (policy.skipPaths.some(sp => sp === p || sp === p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) continue
      bump(paths, p)
    }
    if (a.group) bump(groups, a.group)
  }
  const scopeFor = (value: string) => scopes.find(s => Object.values(s.filter).some(v => v.split(",").map(x => x.trim()).includes(value)))?.key
  return {
    headings: top(headings, 2).map(([text, count]) => ({ text, count })),
    // Úsek, ktorý majú všetky výsledky, nič nevynechá zmysluplne — len ak výsledkov je viac než jeden.
    paths: articles.length > 1 ? top(paths, 2).filter(([, n]) => n < articles.length || articles.length > 2).map(([part, count]) => ({ part, count })) : [],
    groups: top(groups, 1).map(([value, count]) => ({ value, count, existingScope: scopeFor(value) })),
  }
}

/** Úsek cesty → regulárny výraz pre „Vynechať cesty" (bodky a iné znaky doslovne). */
export function pathPattern(part: string): string {
  return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
