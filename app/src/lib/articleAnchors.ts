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

const HEADING_LINE = /^#{1,6}\s+(.+?)\s*#*$/

/**
 * Text citovaného článku (alebo prílohy) z Markdownu normy — na náhľad pri
 * náleze kontroly súladu (Ján 11. 10. 2026, voľba 1). Od nadpisu článku po
 * nadpis iného článku, prílohy alebo časti; rozdelený článok (`čl. 18 ods.
 * 1–7`, `čl. 18 ods. 8–19`) sa vráti celý. `null` = citácia nemá článok
 * alebo sa v texte nenašiel. Strop dĺžky chráni stránku pred celým poriadkom
 * pri neštandardnom texte.
 */
export function articleSection(markdown: string, ref: string | null | undefined, maxChars = 20_000): { text: string; hash: string } | null {
  const hash = articleHash(ref)
  if (!hash) return null
  const want = hash.slice(1).replace(/-ods-.*$/, "")
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  const keyOf = (line: string): string | null | undefined => {
    const h = HEADING_LINE.exec(line)
    if (!h) return undefined
    const art = ARTICLE.exec(h[1].trim())
    if (art) return `cl-${art[1].toLowerCase()}`
    const annex = ANNEX.exec(h[1].trim())
    return annex ? `priloha-${annex[1]}` : null
  }
  const start = lines.findIndex(l => keyOf(l) === want)
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const k = keyOf(lines[i])
    if (k !== undefined && k !== want) { end = i; break }
  }
  const text = lines.slice(start, end).join("\n").trim()
  return { text: text.length > maxChars ? `${text.slice(0, maxChars)}…` : text, hash }
}

/** Krátky názov citovaného miesta pre tlačidlo náhľadu: „čl. 18", „príloha č. 2". */
export function articleLabel(ref: string | null | undefined): string {
  const h = articleHash(ref)
  const art = /^#cl-([^-]+)/.exec(h)
  if (art) return `čl. ${art[1]}`
  const annex = /^#priloha-(\d+)/.exec(h)
  return annex ? `príloha č. ${annex[1]}` : ""
}

/**
 * Všetky citované odseky prvého článku citácie — na zvýraznenie v náhľade
 * (Ján 11. 10. 2026: „odsek 8 je zvýraznený a odsek 19 nie"). Tvary
 * z nálezov: „ods. 8 a ods. 19", „ods. 2 a 3", „ods. 14–19", „ods. 8, 14 až
 * 17, 20", „ods. 1 a 2, čl. 12 ods. 9" (druhý článok sa nečíta — náhľad
 * ukazuje prvý). Písmená („písm. c)") sa preskočia, iné slovo čítanie ukončí.
 */
export function citedParagraphs(ref: string | null | undefined): string[] {
  const r = (ref ?? "").trim()
  const art = /čl(?:ánok|\.)?\s*(\d+[a-z]?)/i.exec(r)
  if (!art) return []
  const id = art[1].toLowerCase()
  const after = r.slice(art.index + art[0].length)
  const stop = after.search(/čl(?:ánok|\.)|;|príloh/i)
  const seg = stop < 0 ? after : after.slice(0, stop)
  const ods = /ods\.\s*/i.exec(seg)
  if (!ods) return []
  const tokens = seg.slice(ods.index).match(/\d+[a-z]?|až|[–-]|,|[^\s,–-]+/gi) ?? []
  const out: string[] = []
  let prev: number | null = null
  let range = false
  for (const tok of tokens) {
    const low = tok.toLowerCase()
    if (/^\d+[a-z]?$/.test(low)) {
      const n = parseInt(low, 10)
      if (range && prev !== null && /^\d+$/.test(low) && n > prev && n - prev <= 50) {
        for (let k = prev + 1; k <= n; k++) out.push(String(k))
      } else out.push(low)
      prev = /^\d+$/.test(low) ? n : null
      range = false
    } else if (low === "až" || low === "–" || low === "-") range = true
    else if (low === "," || low === "a" || low === "ods.") continue
    else if (low === "písm." || /^[a-z]{1,2}\)$/.test(low)) continue
    else break
  }
  return [...new Set(out)].map(n => `cl-${id}-ods-${n}`)
}
