/**
 * smart:tag — „Kľúč: Hodnota" na kurzoch, otázkach a testoch (ADR-018, D117).
 *
 * `key` a `value` sú **normalizované na porovnávanie** (bez diakritiky, malé
 * písmená, ako kľúč dokumentu), `label` je **kópia toho, čo človek napísal**.
 * Porovnáva sa vždy normalizovaný tvar — „Bezpečnosť: Výťah" a
 * „bezpecnost: vytah" sú ten istý tag, len inak napísaný.
 *
 * Čisté funkcie bez databázy: volá ich server aj vstup v prehliadači a obe
 * strany musia dôjsť k tomu istému tagu (ten istý dôvod ako `slug.ts`).
 *
 * Premenovanie tagu (MANAGE Q1) tu zámerne nie je — čaká na Jána.
 */

import { slugifyKey } from "./slug"

export interface SmartTag {
  /** Normalizovaný kľúč: „Bezpečnosť" → `bezpecnost`. */
  key: string
  /** Normalizovaná hodnota: „Výťah" → `vytah`. */
  value: string
  /** Ako to človek napísal: „Bezpečnosť: Výťah". */
  label: string
}

/** Najdlhší label — tag je pilulka, nie veta. */
export const MAX_TAG_LABEL = 80

/**
 * „Kľúč: Hodnota" → tag. Delí **prvá** dvojbodka, takže hodnota ju smie
 * obsahovať („Čas: 10:30"). Bez dvojbodky, s prázdnou stranou alebo
 * s kľúčom, ktorý po normalizácii nič neobsahuje, vráti `null`.
 */
export function parseSmartTag(raw: string): SmartTag | null {
  const text = raw.normalize("NFC").replace(/\s+/g, " ").trim()
  const at = text.indexOf(":")
  if (at < 0) return null
  const keyText = text.slice(0, at).trim()
  const valueText = text.slice(at + 1).trim()
  const key = slugifyKey(keyText)
  const value = slugifyKey(valueText)
  if (!key || !value) return null
  const label = `${keyText}: ${valueText}`
  if (label.length > MAX_TAG_LABEL) return null
  return { key, value, label }
}

/** Identita tagu na porovnávanie a v adrese (`?tag=`): `bezpecnost:vytah`. */
export function tagId(tag: Pick<SmartTag, "key" | "value">): string {
  return `${tag.key}:${tag.value}`
}

/** Text z formulára (riadok alebo čiarka = jeden tag) → tagy bez duplicít. */
export function parseSmartTags(raw: string | string[]): { tags: SmartTag[]; invalid: string[] } {
  const parts = (Array.isArray(raw) ? raw : [raw])
    .flatMap(s => s.split(/[\n,;]/))
    .map(s => s.trim())
    .filter(Boolean)
  return normalizeSmartTags(parts)
}

/**
 * Pole textov → tagy. Prvý výskyt vyhráva aj s labelom, ďalšie rovnaké
 * (po normalizácii) sa zahodia; čo sa nedá prečítať, ide do `invalid`,
 * aby to formulár vedel menovať.
 */
export function normalizeSmartTags(raw: string[]): { tags: SmartTag[]; invalid: string[] } {
  const tags: SmartTag[] = []
  const invalid: string[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    const t = parseSmartTag(r)
    if (!t) { invalid.push(r); continue }
    if (seen.has(tagId(t))) continue
    seen.add(tagId(t))
    tags.push(t)
  }
  return { tags, invalid }
}

/** `?tag=Bezpečnosť:Výťah` alebo `bezpecnost:vytah` → identita pre filter. */
export function filterFromQuery(values: string[] | string | undefined): SmartTag[] {
  const list = values === undefined ? [] : Array.isArray(values) ? values : [values]
  return normalizeSmartTags(list).tags
}

/**
 * Filter (D117): **rôzne kľúče = AND, rovnaký kľúč = OR.** Prázdny filter
 * vyhovuje všetkému. Tag „Úroveň: 1" alebo „Úroveň: 2" a zároveň
 * „Bezpečnosť: Výťah" → entita musí mať bezpečnosť-výťah a jednu z úrovní.
 */
export function matchesSmartFilter(tags: Pick<SmartTag, "key" | "value">[], filter: Pick<SmartTag, "key" | "value">[]): boolean {
  if (filter.length === 0) return true
  const byKey = new Map<string, Set<string>>()
  for (const f of filter) {
    if (!byKey.has(f.key)) byKey.set(f.key, new Set())
    byKey.get(f.key)!.add(f.value)
  }
  for (const [key, values] of byKey) {
    if (!tags.some(t => t.key === key && values.has(t.value))) return false
  }
  return true
}

export interface SmartTagUsage {
  key: string
  value: string
  /** Najčastejší label — ten sa ukáže v prehľade. */
  label: string
  courses: number
  questions: number
  tests: number
}

/**
 * Prehľad použitých tagov (MANAGE `?tab=tags`) — **odvodený** agregáciou
 * (D27), nie udržiavaný číselník. Zoradené podľa kľúča, potom hodnoty.
 */
export function aggregateSmartTags(sources: {
  courses?: { smartTags?: SmartTag[] }[]
  questions?: { smartTags?: SmartTag[] }[]
  tests?: { smartTags?: SmartTag[] }[]
}): SmartTagUsage[] {
  const rows = new Map<string, SmartTagUsage & { labels: Map<string, number> }>()
  const add = (tags: SmartTag[] | undefined, field: "courses" | "questions" | "tests") => {
    // Entita s dvakrát tým istým tagom sa ráta raz — prvý výskyt vyhráva.
    const once = new Set<string>()
    for (const t of tags ?? []) {
      if (once.has(tagId(t))) continue
      once.add(tagId(t))
      const id = tagId(t)
      let row = rows.get(id)
      if (!row) {
        row = { key: t.key, value: t.value, label: t.label, courses: 0, questions: 0, tests: 0, labels: new Map() }
        rows.set(id, row)
      }
      row[field]++
      row.labels.set(t.label, (row.labels.get(t.label) ?? 0) + 1)
    }
  }
  for (const c of sources.courses ?? []) add(c.smartTags, "courses")
  for (const q of sources.questions ?? []) add(q.smartTags, "questions")
  for (const x of sources.tests ?? []) add(x.smartTags, "tests")

  return [...rows.values()]
    .map(({ labels, ...row }) => ({
      ...row,
      label: [...labels.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "sk"))[0][0],
    }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.value.localeCompare(b.value))
}
