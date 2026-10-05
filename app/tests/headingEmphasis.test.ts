/**
 * headingEmphasis.test.ts — tučné nadpisy z prevodu Wordu (5. 10. 2026).
 *
 * Smernice SFZ prišli s nadpismi `# **Článok 1 – Predmet úpravy**` a chunker
 * ich nerozpoznal: 17 článkov v jednom úseku so 7 000 tokenmi. Testuje sa
 * oprava aj to, že sa nedotkla ničoho iného.
 */
import { describe, it, expect } from "vitest"
import { chunkText, stripHeadingEmphasis } from "../src/lib/chunker.mjs"
import { analyseChunking, structureSignals } from "../src/lib/chunkingAnalysis"

const SMERNICA = `# Smernica č. 1/2026
# Finančná smernica SFZ
| **Názov dokumentu** | Finančná smernica SFZ |
| --- | --- |
# Časť I – Základné ustanovenia
# **Článok 1 – Predmet úpravy**
(1) Smernica upravuje obeh účtovných dokladov v **Slovenskom futbalovom zväze**.
(2) Vzťahuje sa na všetkých zamestnancov.
# **Článok 2 – Vymedzenie pojmov**
(1) Účtovný doklad je **písomný** záznam.
# Časť II - Obeh dokladov
# **Článok 3 – Vnútorná kontrola**
(1) Kontrolu vykonáva vedúci úseku.
`

describe("tučné nadpisy", () => {
  it("odstráni ** a __ len v riadku nadpisu", () => {
    expect(stripHeadingEmphasis("# **Článok 1 – Predmet úpravy**")).toBe("# Článok 1 – Predmet úpravy")
    expect(stripHeadingEmphasis("## __Článok 2__ – Pojmy")).toBe("## Článok 2 – Pojmy")
    expect(stripHeadingEmphasis("(1) Text s **tučným** slovom")).toBe("(1) Text s **tučným** slovom")
    expect(stripHeadingEmphasis("**Článok 3**")).toBe("**Článok 3**")
    expect(stripHeadingEmphasis("## Článok 4 – Bez tučného")).toBe("## Článok 4 – Bez tučného")
  })

  it("chunker nájde články v tučných nadpisoch", () => {
    const { chunky } = chunkText(SMERNICA, { nazovDokumentu: "Finančná smernica SFZ" })
    const refs = chunky.map((c: { articleRef?: string | null }) => c.articleRef).filter(Boolean)
    expect(refs).toEqual(["čl. 1", "čl. 2", "čl. 3"])
    // Tučné písmo v texte článku ostáva — je to obsah.
    expect(chunky.find((c: { articleRef?: string | null }) => c.articleRef === "čl. 1")?.text).toContain("**Slovenskom futbalovom zväze**")
  })

  it("analyzátor číta tučné nadpisy rovnako ako chunker", () => {
    expect(structureSignals(SMERNICA).articleWord).toBe(3)
    const a = analyseChunking(SMERNICA)
    expect(a.confident).toBe(true)
    expect(a.suggestions[0].articleWord).toBe("Článok")
  })

  it("nadpis bez tučného dáva ten istý rez ako predtým", () => {
    const plain = SMERNICA.replace(/\*\*(Článok[^*]*)\*\*/g, "$1")
    const a = chunkText(plain, { nazovDokumentu: "Finančná smernica SFZ" }).chunky
    const b = chunkText(SMERNICA, { nazovDokumentu: "Finančná smernica SFZ" }).chunky
    expect(b.map((c: { heading: string }) => c.heading)).toEqual(a.map((c: { heading: string }) => c.heading))
  })
})
