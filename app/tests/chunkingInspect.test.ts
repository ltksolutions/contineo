import { describe, expect, it } from "vitest"
import { chunkStats, chunkWarnings } from "@/lib/chunkingInspect"

const profile = { minTokens: 300, maxTokens: 800 }
const c = (tokens: number, articleRef: string | null = "čl. 1", chunkType = "clanok") => ({ tokens, articleRef, chunkType })

describe("chunkingInspect — súhrn a upozornenia rezu (ADR-027, krok A)", () => {
  it("súhrn: počet, podiel s článkom, veľkosti", () => {
    expect(chunkStats([c(100), c(500), c(300, null)])).toEqual({
      count: 3, withArticle: 2, withArticlePercent: 67, tokensMin: 100, tokensMax: 500, tokensAvg: 300,
    })
    expect(chunkStats([])).toMatchObject({ count: 0, withArticlePercent: 0, tokensAvg: 0 })
  })

  it("celý text v jednom bloku bez článku (manuál, Finančná smernica)", () => {
    const w = chunkWarnings([c(7187, null, "preambula")], profile)
    expect(w).toEqual([{ code: "oneBlock" }, { code: "oversized", count: 1, limit: 1200 }])
  })

  it("málo článkov — pod 20 %", () => {
    const chunks = [c(400), ...Array.from({ length: 9 }, () => c(400, null))]
    expect(chunkWarnings(chunks, profile)).toEqual([{ code: "fewArticles", percent: 10 }])
  })

  it("úlomky rozdeleného článku pod polovicou minima", () => {
    expect(chunkWarnings([c(400), c(120), c(500)], profile)).toEqual([{ code: "fragments", count: 1 }])
  })

  it("norma, ktorá sedí, nemá nálezy", () => {
    expect(chunkWarnings([c(400), c(700), c(350), c(200, null, "preambula")], profile)).toEqual([])
  })
})
