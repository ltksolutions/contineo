/**
 * conversationContext.test.ts — predchádzajúce kolá rozhovoru vo widgete.
 * Fiktívne údaje.
 */

import { describe, it, expect } from "vitest"
import { parseHistory, contextualQuery, questionText, MAX_PRIOR_TURNS } from "../src/lib/conversationContext"
import { preprocessQuery } from "../src/lib/queryPreprocessor"
import type { GenerationProvider } from "../src/lib/providers/types"

describe("parseHistory", () => {
  it("zahodí, čo nie je otázka v texte, a oreže dĺžky", () => {
    const turns = parseHistory([
      null, "text", { question: "" }, { question: 42 },
      { question: "  Kedy je uzávierka prestupov?  ", answer: 7 },
      { question: "x".repeat(1500), answer: "y".repeat(3000) },
    ])
    expect(turns).toHaveLength(2)
    expect(turns[0]).toEqual({ question: "Kedy je uzávierka prestupov?", answer: "" })
    expect(turns[1].question).toHaveLength(1000)
    expect(turns[1].answer).toHaveLength(2000)
  })

  it("nechá len posledné kolá a nepole je prázdny rozhovor", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ question: `otázka ${i}`, answer: `odpoveď ${i}` }))
    const turns = parseHistory(many)
    expect(turns).toHaveLength(MAX_PRIOR_TURNS)
    expect(turns[0].question).toBe("otázka 3")
    expect(parseHistory({ question: "a" })).toEqual([])
    expect(parseHistory(undefined)).toEqual([])
  })
})

describe("contextualQuery a questionText", () => {
  const history = [{ question: "Aký je poplatok za prestup amatéra?", answer: "Poplatok je 10 €." }]

  it("záloha za prepis pridá poslednú otázku", () => {
    expect(contextualQuery("a pre mládež?", history)).toBe("Aký je poplatok za prestup amatéra? a pre mládež?")
    expect(contextualQuery("a pre mládež?", [])).toBe("a pre mládež?")
  })

  it("bez histórie je text otázky ako doteraz, s ňou nesie kolá aj pokyn, že nie sú zdrojom", () => {
    expect(questionText("Kedy?")).toBe("Otázka: Kedy?")
    const text = questionText("To nie je správne.", history)
    expect(text).toContain("Otázka: Aký je poplatok za prestup amatéra?\nOdpoveď: Poplatok je 10 €.")
    expect(text).toContain("Nie sú zdrojom")
    expect(text.endsWith("Otázka: To nie je správne.")).toBe(true)
  })
})

describe("preprocessQuery s rozhovorom", () => {
  const history = [{ question: "Ako sa nastavuje poplatok za registráciu?", answer: "" }]
  const prompts: string[] = []
  const fake = (answer: string | Error): GenerationProvider => ({
    kind: "anthropic", model: "fake", supportsCitations: false,
    async *stream() {},
    async complete(prompt: string) { prompts.push(prompt); if (answer instanceof Error) throw answer; return answer },
  })

  it("krátku nadväzujúcu otázku prepisuje a do promptu dá predchádzajúce otázky", async () => {
    prompts.length = 0
    const p = await preprocessQuery("a pre mládež?", fake('{"rewritten":"poplatok za registráciu mládeže"}'), new Date(), undefined, history)
    expect(p.rewritten).toBe("poplatok za registráciu mládeže")
    expect(prompts[0]).toContain("- Ako sa nastavuje poplatok za registráciu?")
  })

  it("pri výpadku modelu hľadá podľa poslednej otázky spolu s novou", async () => {
    const p = await preprocessQuery("a pre mládež?", fake(new Error("timeout")), new Date(), undefined, history)
    expect(p.rewritten).toBe("Ako sa nastavuje poplatok za registráciu? a pre mládež?")
  })
})
