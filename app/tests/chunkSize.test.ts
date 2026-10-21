/**
 * chunkSize.test.ts — Členenie meria úsek jedným metrom (21. 10. 2026).
 *
 * Kolo 3 nad zákonom o športe ukazovalo v pohľade Návrh „bez nálezov"
 * a po prijatí ten istý rez v pohľade Dnes „5 úsekov nesedí": Návrh
 * počítal holé bloky bez riadku kontextu a zlomky nehlásil. Testy strážia,
 * aby Návrh, Dnes a odmietnutie návrhu dali pri tom istom reze to isté.
 */
import { describe, it, expect } from "vitest"
import { measureCut, chunkFinding, CHUNK_LIMIT, FRAGMENT_MAX } from "../src/lib/chunkSize"
import { cutForIndex } from "../src/lib/chunkCut"
import { splitBlocks, groupTokens } from "../src/lib/chunkBlocks"
import { textFingerprint } from "../src/lib/chunkIdentity"
import { estimateTokens } from "../src/lib/chunker.mjs"

const words = (n: number) => "slovo ".repeat(n).trim()
const md = [
  "# Zákon o niečom",
  "## Čl. I",
  "### PRVÁ ČASŤ — VŠEOBECNÉ",
  "#### § 1 Predmet",
  words(200),
  "#### § 2 Pojmy",
  `(1) ${words(300)}`,
  `(2) ${words(60)}`,
].join("\n\n")
const title = "Zákon č. 1/2026 Z. z. o niečom"

describe("measureCut", () => {
  it("meria úsek s riadkom kontextu — viac než holé bloky", () => {
    const boundaries = [3, 5, 7]
    const measured = measureCut(md, boundaries, title)
    const bare = groupTokens(splitBlocks(md), boundaries)
    expect(measured).toHaveLength(bare.length)
    measured.forEach((m, i) => expect(m.tokens).toBeGreaterThan(bare[i]))
  })

  it("dáva to isté ako rez, z ktorého asistent odpovedá (pohľad Dnes)", () => {
    const boundaries = [3, 5, 7]
    const cut = cutForIndex(md, title, [{ textHash: textFingerprint(md), boundaries, round: 3, at: new Date(), by: "Ján" }])
    expect(cut.method).toBe("manual")
    expect(measureCut(md, boundaries, title)).toEqual(cut.chunks.map(c => ({ tokens: estimateTokens(c.text), complete: c.uplnaJednotka })))
  })

  it("pokračovanie rozdeleného paragrafu nie je celá jednotka", () => {
    const m = measureCut(md, [3, 5, 7], title)
    expect(m.map(x => x.complete)).toEqual([true, true, true, false])
  })
})

describe("chunkFinding", () => {
  it("veľký nad strop, zlomok len pri pokračovaní pod polovicou minima", () => {
    expect(chunkFinding({ tokens: CHUNK_LIMIT + 1, complete: true })).toBe("oversized")
    expect(chunkFinding({ tokens: CHUNK_LIMIT, complete: true })).toBeNull()
    expect(chunkFinding({ tokens: FRAGMENT_MAX - 1, complete: false })).toBe("fragment")
    expect(chunkFinding({ tokens: FRAGMENT_MAX - 1, complete: true })).toBeNull()
    expect(chunkFinding({ tokens: FRAGMENT_MAX - 1 })).toBeNull()
  })
})
