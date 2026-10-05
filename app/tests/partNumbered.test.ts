/**
 * partNumbered.test.ts — časť v zápise „Časť I – …" (5. 10. 2026).
 *
 * Predpisy z Wordu (Pracovný poriadok, smernice SFZ) píšu časť rímskym číslom.
 * Chunker poznal len „PRVÁ ČASŤ", cesta úseku bola bez časti a riadok
 * s časťou sa prilepil na koniec predošlého článku.
 */
import { describe, it, expect } from "vitest"
import { chunkText } from "../src/lib/chunker.mjs"

type C = { articleRef?: string | null; text: string }
const first = (c: C) => c.text.split("\n")[0]

const DOC = `# Časť I – Základné ustanovenia
## Článok 1 – Všeobecné ustanovenia
(1) Prvý text.
# ČASŤ II - Pracovný pomer
## Článok 2 – Vznik
(1) Druhý text.
Časť 2 tejto smernice upravuje niečo iné.
## Časť III
## Článok 3 – Bez názvu časti
(1) Tretí text.`

describe("časť s číslom", () => {
  const chunks = chunkText(DOC, { nazovDokumentu: "Poriadok" }).chunky as C[]

  it("ide do cesty úseku", () => {
    expect(chunks.filter(c => c.articleRef).map(first)).toEqual([
      "Poriadok › Časť I – Základné ustanovenia › Článok 1 - Všeobecné ustanovenia",
      "Poriadok › ČASŤ II - Pracovný pomer › Článok 2 - Vznik",
      "Poriadok › Časť III › Článok 3 - Bez názvu časti",
    ])
  })

  it("riadok časti sa neprilepí na koniec predošlého článku", () => {
    expect(chunks.find(c => c.articleRef === "čl. 1")?.text).not.toContain("Pracovný pomer")
  })

  it("veta, ktorá začína slovom Časť, ostáva textom článku", () => {
    expect(chunks.find(c => c.articleRef === "čl. 2")?.text).toContain("Časť 2 tejto smernice upravuje")
  })

  it("„PRVÁ ČASŤ“ funguje ako doteraz", () => {
    const c = chunkText("PRVÁ ČASŤ - Všeobecné\nČlánok 1 - Prvý\n(1) Text.", { nazovDokumentu: "N" }).chunky as C[]
    expect(first(c.find(x => x.articleRef)!)).toBe("N › PRVÁ ČASŤ - Všeobecné › Článok 1 - Prvý")
  })
})
