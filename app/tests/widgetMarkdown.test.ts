import { describe, it, expect } from "vitest"
import { WIDGET_MARKDOWN_JS, type WidgetBlock } from "../src/lib/widgetMarkdown"
import { toBlocks, type Block, type Segment } from "../src/lib/formatText"
import { widgetScript } from "../src/lib/widgetScript"

/** Spustí text z WIDGET_MARKDOWN_JS tak, ako ho spustí prehliadač v skripte widgetu (strict). */
const widgetMarkdown = new Function(`"use strict";return (${WIDGET_MARKDOWN_JS})`)() as (text: string) => WidgetBlock[]

/** Tvar `toBlocks()` prevedený na tvar widgetu — odkaz je vo widgete len text. */
function fromIntranet(blocks: Block[]): WidgetBlock[] {
  const segs = (s: Segment[]) => s.map(x => ({ bold: x.druh === "tucne", text: x.text }))
  return blocks.map(b => b.druh === "odsek" ? { kind: "p", segments: segs(b.segments) }
    : b.druh === "nadpis" ? { kind: "h", level: b.level, segments: segs(b.segments) }
    : { kind: "list", numbered: b.numbered, items: b.items.map(segs), values: b.values })
}

const ANSWER = [
  "Podľa znení platných k 29. 10. 2026 postup je nasledovný:",
  "",
  "## Ako podať žiadosť",
  "",
  "Máte dve možnosti:",
  "",
  "1. **Cez klub** – žiadosť podáva klub,",
  "   v ktorom je hráč registrovaný.",
  "2. **Sám za seba** – cez podateľňu.",
  "",
  "**Povinná príloha:**",
  "- aspoň 600 × 800 pixelov",
  "- orezaná tak, aby bolo vidieť hlavu",
  "(1) Prvý odsek normy.",
  "(2) Druhý odsek, viď [Smernica](/library/abc).",
  "#### Hráči ####",
  "nepárna ** hviezdička",
].join("\n")

describe("widgetMarkdown — Markdown odpovede vo widgete", () => {
  it("rozloží odpoveď rovnako ako toBlocks() v intranete", () => {
    expect(widgetMarkdown(ANSWER)).toEqual(fromIntranet(toBlocks(ANSWER)))
    for (const t of ["", "jeden riadok", "a\r\nb\r\n\r\n- x\r\n- y", "3. tretí\n5. piaty", "****"]) {
      expect(widgetMarkdown(t)).toEqual(fromIntranet(toBlocks(t)))
    }
  })

  it("nadpis, tučné a číslovanie s číslom z textu", () => {
    const b = widgetMarkdown(ANSWER)
    expect(b[1]).toEqual({ kind: "h", level: 2, segments: [{ bold: false, text: "Ako podať žiadosť" }] })
    expect(b[3]).toMatchObject({ kind: "list", numbered: true, values: [1, 2] })
    expect((b[3] as { items: unknown[][] }).items[0][0]).toEqual({ bold: true, text: "Cez klub" })
    expect(b[4]).toEqual({ kind: "h", level: 3, segments: [{ bold: false, text: "Povinná príloha" }] })
  })

  it("odkaz do intranetu ostane len textom", () => {
    const p = widgetMarkdown("viď [Smernica](/library/abc) a [x](https://zle.sk)")
    expect(p).toEqual([{ kind: "p", segments: [{ bold: false, text: "viď " }, { bold: false, text: "Smernica" }, { bold: false, text: " a [x](https://zle.sk)" }] }])
  })

  it("skript widgetu nesie rozklad doslova a bez HTML", () => {
    const src = widgetScript({ channel: "k", api: "https://x", language: "sk", texts: {} } as never)
    expect(src).toContain(`var mdBlocks=${WIDGET_MARKDOWN_JS};`)
    expect(src).not.toMatch(/innerHTML=text|innerHTML=b\./)
  })
})
