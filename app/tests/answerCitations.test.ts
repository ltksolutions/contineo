/**
 * answerCitations.test.ts — značky `[n]` v texte odpovede
 * (ASK-odpoved-dva-stlpce, Q1): poloha `at` zo streamu, koniec vety,
 * zlúčené citácie so spoločným číslom.
 */

import { describe, it, expect, vi, afterEach } from "vitest"
import {
  citationEnd, sentenceStart, markCitations, groupCitations, toBlocks,
  CITE_MARK, CITE_START, CITE_CLOSE,
} from "../src/lib/formatText"
import { askQuestion } from "../src/lib/sseClient"

const T = "Hráč môže prestúpiť podľa čl. 18 ods. 2 poriadku. Žiadosť sa podáva cez ISSF. Klub má nárok na odstupné."

describe("koniec vety", () => {
  it("citácia pred vetou patrí na jej koniec", () => {
    expect(T.slice(0, citationEnd(T, 0))).toBe("Hráč môže prestúpiť podľa čl. 18 ods. 2 poriadku.")
  })

  it("skratky čl. 18 a ods. 2 koniec vety nie sú", () => {
    expect(citationEnd(T, 10)).toBe(T.indexOf("poriadku.") + "poriadku.".length)
  })

  it("citácia hneď za vetou patrí k nej, nie k ďalšej", () => {
    const at = T.indexOf(" Žiadosť")
    expect(citationEnd(T, at)).toBe(at)
    // Aj za medzerou po bodke — text ďalšej vety ešte nezačal.
    expect(citationEnd(T, at + 1)).toBe(at)
    expect(citationEnd(T, at + 3)).toBe(T.indexOf("ISSF.") + "ISSF.".length)
  })

  it("nedopísaná veta: značka na konci textu", () => {
    const partial = "Žiadosť sa podáva cez"
    expect(citationEnd(partial, 5)).toBe(partial.length)
  })

  it("začiatok vety preskočí odrážku a tučné písmo", () => {
    const list = "Úvod.\n- **Doklad** o pobyte zástupcov."
    const end = list.length
    expect(list.slice(sentenceStart(list, end), end)).toBe("Doklad** o pobyte zástupcov.")
  })
})

describe("zlúčené citácie", () => {
  it("rovnaký úryvok dostane to isté číslo", () => {
    const { unique, numberOf } = groupCitations([
      { citedText: "Hráč mladší ako 18 rokov" },
      { citedText: "Iný text" },
      { citedText: "Hráč mladší ako 18 rokov môže prestúpiť" },
    ])
    expect(unique).toHaveLength(2)
    expect(numberOf).toEqual([1, 2, 1])
  })
})

describe("zarážky v texte", () => {
  const c = (citedText: string, at?: number) => ({ citedText, at })

  it("značka na konci vety, začiatok vety pred ňou", () => {
    const out = markCitations(T, [c("a", 0), c("b", T.indexOf(" Klub"))])
    expect(out).toContain(`poriadku.${CITE_MARK}1${CITE_CLOSE}`)
    expect(out.startsWith(`${CITE_START}1${CITE_CLOSE}Hráč`)).toBe(true)
    expect(out).toContain(`ISSF.${CITE_MARK}2${CITE_CLOSE}`)
  })

  it("dve citácie pri jednej vete — jedna skupina", () => {
    const out = markCitations(T, [c("a", 0), c("b", 3)])
    expect(out).toContain(`poriadku.${CITE_MARK}1,2${CITE_CLOSE}`)
  })

  it("uložená odpoveď bez `at` značky nemá", () => {
    expect(markCitations(T, [c("a"), c("b")])).toBe(T)
  })

  it("zoznam sa po vložení zarážok stále rozloží ako zoznam", () => {
    const text = "Treba priložiť:\n- potvrdenie o pobyte.\n- súhlas zástupcu."
    const blocks = toBlocks(markCitations(text, [c("a", text.indexOf("- potvrdenie"))]))
    expect(blocks.map(b => b.druh)).toEqual(["odsek", "zoznam"])
  })
})

describe("sseClient zapíše polohu citácie", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("`at` = dĺžka textu v okamihu udalosti, zachová sa aj po `done`", async () => {
    const frame = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`
    const body = [
      frame({ type: "token", token: "Prvá veta. " }),
      frame({ type: "citation", citation: { chunkIndex: 0, citedText: "x" } }),
      frame({ type: "token", token: "Druhá veta." }),
      frame({ type: "done", sources: [], citations: [{ chunkIndex: 0, citedText: "x" }] }),
    ].join("")
    vi.stubGlobal("fetch", async () => new Response(body, { status: 200 }))
    const seen: number[] = []
    const result = await askQuestion("q", p => { if (p.citations[0]?.at !== undefined) seen.push(p.citations[0].at) })
    expect(seen[0]).toBe("Prvá veta. ".length)
    expect(result.citations[0].at).toBe("Prvá veta. ".length)
  })
})
