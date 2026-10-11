/**
 * articleAnchors.ts — kotvy na články a odseky normy (Ján 11. 10. 2026).
 *
 * Odkaz na normu z kontroly súladu („Registračný a prestupový poriadok SFZ,
 * čl. 18 ods. 8 a ods. 19") má otvoriť čitateľský pohľad rovno na citovanom
 * mieste, nie na začiatku 250-stranového poriadku. Normy v knižnici majú
 * jednotný tvar z prevodu: nadpis `## čl. 18 — Názov` (dlhý článok rozdelený
 * na `## čl. 18 ods. 1–7 — …` a `## čl. 18 ods. 8–19 — …`) a odseky `(8) …`
 * na začiatku riadku. Kotva článku je `cl-18`, odseku `cl-18-ods-8`,
 * prílohy `priloha-2`.
 *
 * Identifikátor sa odvodzuje z textu, neukladá sa (D27): rovnaký text dá
 * rovnaké kotvy, a odkaz z nálezu spred roka trafí, kým sa číslovanie
 * článku nezmení.
 */

import type { Block, Segment } from "./formatText"

const ARTICLE = /^čl(?:ánok)?\.?\s*(\d+[a-z]?)\b/i
const ANNEX = /^príloh[ay]\s*(?:č\.\s*)?(\d+)/i
const PARAGRAPH = /^\((\d+[a-z]?)\)\s/

function plain(segments: Segment[]): string {
  return segments.map(s => s.text).join("").trim()
}

/** Kotvy k blokom textu (rovnaké poradie); `null` = blok bez kotvy. Každá kotva najviac raz. */
export function blockAnchors(blocks: Block[]): (string | null)[] {
  const used = new Set<string>()
  let article: string | null = null
  const take = (id: string) => (used.has(id) ? null : (used.add(id), id))
  return blocks.map(b => {
    if (b.druh === "nadpis") {
      const text = plain(b.segments)
      const art = ARTICLE.exec(text)
      if (art) { article = art[1].toLowerCase(); return take(`cl-${article}`) }
      const annex = ANNEX.exec(text)
      if (annex) { article = null; return take(`priloha-${annex[1]}`) }
      return null
    }
    if (b.druh === "odsek" && article) {
      const p = PARAGRAPH.exec(plain(b.segments))
      return p ? take(`cl-${article}-ods-${p[1].toLowerCase()}`) : null
    }
    return null
  })
}

/**
 * Kotva k citácii článku: „čl. 18 ods. 8 a ods. 19" → `#cl-18-ods-8`,
 * „čl. 7 ods. 9" → `#cl-7-ods-9`, „čl. 25 ods. 11 v spojení s čl. 27" →
 * prvé miesto, „Príloha č. 2 – Sadzobník" → `#priloha-2`. Bez rozpoznaného
 * miesta prázdny reťazec — odkaz potom vedie na začiatok dokumentu.
 */
export function articleHash(ref: string | null | undefined): string {
  const r = (ref ?? "").trim()
  const art = /čl(?:ánok|\.)?\s*(\d+[a-z]?)(?:\s*ods\.\s*(\d+[a-z]?))?/i.exec(r)
  if (art) return `#cl-${art[1].toLowerCase()}${art[2] ? `-ods-${art[2].toLowerCase()}` : ""}`
  const annex = /príloh[ay]\s*(?:č\.\s*)?(\d+)/i.exec(r)
  return annex ? `#priloha-${annex[1]}` : ""
}
