/**
 * markdownEmail.ts — odpoveď na ticket ako formátovaný HTML e-mail.
 *
 * Návrh asistenta aj text riešiteľa sú ľahký Markdown (nadpisy, tučné,
 * odrážky); ako čistý text odchádzali k človeku s hviezdičkami a mriežkami
 * (Ján 29. 10. 2026). Rozklad je ten istý ako na obrazovke ticketu
 * (`toBlocks()`), takže e-mail vyzerá ako náhľad odpovede.
 *
 * Každý text sa escapuje — do HTML nejde nič z modelu ani z poľa doslova.
 * Odkaz `[text](/cesta)` vedie do intranetu, kam príjemca nevidí; ostáva
 * z neho text. Štýly sú v riadku, lebo poštové programy `<style>` často
 * zahodia. Jednoduché zalomenia riadkov (pozdrav, podpis) ostávajú.
 */

import { toBlocks, type Segment } from "./formatText"

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function inline(segments: Segment[]): string {
  return segments.map(s => {
    const text = esc(s.text).replace(/\n/g, "<br>")
    return s.druh === "tucne" ? `<strong>${text}</strong>` : text
  }).join("")
}

export function markdownEmailHtml(text: string): string {
  const body = toBlocks(text, { lineBreaks: true }).map((b, i) => {
    if (b.druh === "nadpis") {
      const size = b.level <= 2 ? 17 : 15
      return `<p style="margin:${i === 0 ? 0 : 18}px 0 8px;font-size:${size}px;font-weight:700">${inline(b.segments)}</p>`
    }
    if (b.druh === "odsek") return `<p style="margin:0 0 12px">${inline(b.segments)}</p>`
    const tag = b.numbered ? "ol" : "ul"
    // `start` na zozname aj `value` na položke: prevod HTML na text v Outlooku
    // a Graphe `value` nečíta a zoznam „3. … 4." by poslal ako „1. … 1."
    // (Ján 29. 10. 2026).
    const start = b.numbered && b.values[0] != null && b.values[0] !== 1 ? ` start="${b.values[0]}"` : ""
    const items = b.items.map((p, j) => {
      const value = b.numbered && b.values[j] != null ? ` value="${b.values[j]}"` : ""
      return `<li${value} style="margin:0 0 4px">${inline(p)}</li>`
    }).join("")
    return `<${tag}${start} style="margin:0 0 12px;padding-left:22px">${items}</${tag}>`
  }).join("\n")
  return `<div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.55;color:#161b22">\n${body}\n</div>`
}
