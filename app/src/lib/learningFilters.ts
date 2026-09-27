/**
 * Filter obrazovky `/learning` (rám LEARNING) — téma a smart:tagy v adrese.
 *
 * `?topic=` je jedna hodnota, `?tag=kluc:hodnota` sa smie opakovať.
 * V adrese je identita tagu (normalizovaná), nie zápis — odkaz tak
 * prežije aj premenovanie labelu. Čisté funkcie, bez databázy.
 */

import type { Course } from "./courses"
import { filterFromQuery, matchesSmartFilter, tagId, type SmartTag } from "./smartTags"

export interface LearningFilter {
  topicKey?: string
  tags: Pick<SmartTag, "key" | "value">[]
}

export function learningFilterFromQuery(q: { topic?: string | string[]; tag?: string | string[] }): LearningFilter {
  const topic = Array.isArray(q.topic) ? q.topic[0] : q.topic
  return { topicKey: topic?.trim() || undefined, tags: filterFromQuery(q.tag) }
}

export function isFiltered(f: LearningFilter): boolean {
  return Boolean(f.topicKey) || f.tags.length > 0
}

/** Adresa so zmeneným filtrom. `toggleTag` pridá alebo odoberie tag. */
export function learningHref(
  f: LearningFilter,
  change: { topicKey?: string | null; toggleTag?: Pick<SmartTag, "key" | "value">; clear?: boolean } = {},
  base = "/learning",
): string {
  if (change.clear) return base
  const topic = change.topicKey === null ? undefined : change.topicKey ?? f.topicKey
  let tags = f.tags
  if (change.toggleTag) {
    const id = tagId(change.toggleTag)
    tags = tags.some(t => tagId(t) === id) ? tags.filter(t => tagId(t) !== id) : [...tags, change.toggleTag]
  }
  const p = new URLSearchParams()
  if (topic) p.set("topic", topic)
  for (const t of tags) p.append("tag", tagId(t))
  const s = p.toString()
  return s ? `${base}?${s}` : base
}

export interface TopicFacet { key: string; label: string; count: number }
export interface TagFacetValue { key: string; value: string; label: string; valueLabel: string; count: number }
export interface TagFacetGroup { key: string; keyLabel: string; values: TagFacetValue[] }

/**
 * Počty pre filter — **kurzy viditeľné tejto osobe** (rám: „Počty = kurzy
 * viditeľné tejto osobe"). Počet pri tagu rešpektuje zvolenú tému
 * a tagy iných kľúčov, nie tagy toho istého kľúča (tam je OR).
 */
export function learningFacets(courses: Course[], f: LearningFilter): { topics: TopicFacet[]; tagGroups: TagFacetGroup[] } {
  const topics = new Map<string, TopicFacet>()
  for (const c of courses) {
    if (!matchesSmartFilter(c.smartTags, f.tags)) continue
    const t = topics.get(c.topicKey) ?? { key: c.topicKey, label: c.topicLabel, count: 0 }
    t.count++
    topics.set(c.topicKey, t)
  }
  const groups = new Map<string, TagFacetGroup>()
  for (const c of courses) {
    if (f.topicKey && c.topicKey !== f.topicKey) continue
    for (const tag of c.smartTags) {
      const others = f.tags.filter(x => x.key !== tag.key)
      if (!matchesSmartFilter(c.smartTags, others)) continue
      const colon = tag.label.indexOf(":")
      const g = groups.get(tag.key) ?? { key: tag.key, keyLabel: tag.label.slice(0, colon).trim(), values: [] }
      let v = g.values.find(x => x.value === tag.value)
      if (!v) {
        v = { key: tag.key, value: tag.value, label: tag.label, valueLabel: tag.label.slice(colon + 1).trim(), count: 0 }
        g.values.push(v)
      }
      v.count++
      groups.set(tag.key, g)
    }
  }
  return {
    topics: [...topics.values()].sort((a, b) => a.label.localeCompare(b.label, "sk")),
    tagGroups: [...groups.values()]
      .map(g => ({ ...g, values: g.values.sort((a, b) => a.valueLabel.localeCompare(b.valueLabel, "sk", { numeric: true })) }))
      .sort((a, b) => a.keyLabel.localeCompare(b.keyLabel, "sk")),
  }
}
