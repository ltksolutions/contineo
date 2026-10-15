/**
 * richText.ts — prevod medzi ľahkým Markdownom správy a dokumentom editora
 * (KURIER-editor, 15. 10. 2026; ADR-033 D208).
 *
 * Správa sa **ukladá ďalej ako Markdown** a vykresľuje cez `formatText.ts` —
 * editor je len iný spôsob, ako ten istý text napísať. Preto sa načítanie
 * opiera o ten istý rozklad (`toBlocks`) a zápis vyrába len tvary, ktoré
 * `toBlocks` pozná: odsek, nadpis, odrážky, číslovanie, tučné a vnútorný
 * odkaz. Čo editor nepozná, sa do Markdownu nedostane.
 *
 * Čistý TypeScript bez závislosti na editore — dá sa testovať bez prehliadača.
 */

import { toBlocks, type Segment } from "./formatText"

/** Uzol dokumentu editora (tvar JSON z Tiptap / ProseMirror). */
export interface RichNode {
  type: string
  attrs?: Record<string, unknown>
  content?: RichNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

/**
 * Len vnútorná cesta — rovnaké pravidlo ako `LINK` vo `formatText.ts`
 * (`/` na začiatku, nie `//`, bez medzier a zátvoriek). Odkaz von by sa pri
 * zobrazení aj tak nevykreslil; editor ho preto ani nevytvorí.
 */
export function isInternalHref(href: unknown): href is string {
  return typeof href === "string" && /^\/(?!\/)[^\s()]*$/.test(href)
}

function inline(segments: Segment[]): RichNode[] {
  return segments
    .filter(s => s.text !== "")
    .map(s => s.druh === "tucne"
      ? { type: "text", text: s.text, marks: [{ type: "bold" }] }
      : s.druh === "odkaz"
        ? { type: "text", text: s.text, marks: [{ type: "link", attrs: { href: s.href } }] }
        : { type: "text", text: s.text })
}

const paragraph = (segments: Segment[]): RichNode => {
  const content = inline(segments)
  return content.length ? { type: "paragraph", content } : { type: "paragraph" }
}

/** Markdown správy → dokument editora. Prázdny text = jeden prázdny odsek. */
export function markdownToDoc(markdown: string): RichNode {
  const content: RichNode[] = toBlocks(markdown ?? "").map(b =>
    b.druh === "odsek" ? paragraph(b.segments)
    : b.druh === "nadpis" ? { type: "heading", attrs: { level: 2 }, content: inline(b.segments) }
    : {
        type: b.numbered ? "orderedList" : "bulletList",
        content: b.items.map(item => ({ type: "listItem", content: [paragraph(item)] })),
      })
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] }
}

function inlineMarkdown(nodes: RichNode[] | undefined): string {
  return (nodes ?? []).map(n => {
    if (n.type === "hardBreak") return "\n"
    if (n.type !== "text" || !n.text) return ""
    const link = n.marks?.find(m => m.type === "link")
    const href = link?.attrs?.href
    // Odkaz má prednosť pred tučným — `[**x**](/cesta)` rozklad nepozná.
    if (link && isInternalHref(href)) return `[${n.text.replace(/[[\]]/g, "")}](${href})`
    if (n.marks?.some(m => m.type === "bold")) {
      const inner = n.text.trim()
      if (!inner) return n.text
      // Medzery mimo hviezdičiek, inak by `** x**` nebol tučný text.
      const lead = n.text.slice(0, n.text.indexOf(inner))
      const tail = n.text.slice(n.text.indexOf(inner) + inner.length)
      return `${lead}**${inner}**${tail}`
    }
    return n.text
  }).join("")
}

/** Text položky zoznamu — viac odsekov v jednej položke sa spojí medzerou. */
const itemText = (item: RichNode) =>
  (item.content ?? []).map(c => inlineMarkdown(c.content).trim()).filter(Boolean).join(" ")

/** Dokument editora → Markdown správy. Bloky oddelí prázdny riadok. */
export function docToMarkdown(doc: RichNode): string {
  const blocks: string[] = []
  for (const node of doc.content ?? []) {
    if (node.type === "paragraph") {
      const text = inlineMarkdown(node.content).trim()
      if (text) blocks.push(text)
    } else if (node.type === "heading") {
      const text = inlineMarkdown(node.content).trim()
      if (text) blocks.push(`## ${text}`)
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      const items = (node.content ?? []).map(itemText).filter(Boolean)
      if (items.length) blocks.push(items.map((t, i) => node.type === "orderedList" ? `${i + 1}. ${t}` : `- ${t}`).join("\n"))
    }
  }
  return blocks.join("\n\n")
}
