import { describe, expect, it } from "vitest"
import { chunkStats, chunkWarnings, cutWith } from "@/lib/chunkingInspect"
import { freeProfileKey } from "@/lib/chunkingProfilesDb"

const profile = { minTokens: 300, maxTokens: 800 }
const c = (tokens: number, articleRef: string | null = "čl. 1", chunkType = "clanok", complete?: boolean) => ({ tokens, articleRef, chunkType, complete })

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

  it("úlomky rozdeleného článku pod polovicou minima — celý krátky článok nie je úlomok", () => {
    expect(chunkWarnings([c(400), c(120, "čl. 2", "clanok", false), c(500)], profile)).toEqual([{ code: "fragments", count: 1 }])
    // Čl. 15 Finančnej smernice: 129 tokenov, ale celý článok.
    expect(chunkWarnings([c(400), c(129, "čl. 15", "clanok", true), c(500)], profile)).toEqual([])
    // Uložené úseky bez údaja o úplnosti sa nepočítajú vôbec.
    expect(chunkWarnings([c(400), c(120), c(500)], profile)).toEqual([])
  })

  it("norma, ktorá sedí, nemá nálezy", () => {
    expect(chunkWarnings([c(400), c(700), c(350), c(200, null, "preambula")], profile)).toEqual([])
  })
})

describe("skúšobný rez a nový profil (krok B)", () => {
  it("rez inými hodnotami — slovo § namiesto Článok", () => {
    const text = "§ 1 – Predmet\n(1) Text prvý.\n§ 2 – Pojmy\n(1) Text druhý.\n§ 3 – Záver\n(1) Koniec."
    const clanok = cutWith(text, "Zákon", { articleWord: "Článok" }).chunks
    const paragraf = cutWith(text, "Zákon", { articleWord: "§" }).chunks
    expect(clanok.filter(x => x.articleRef).length).toBe(0)
    expect(paragraf.filter(x => x.articleRef).length).toBe(3)
    expect(paragraf.every(x => x.complete === true)).toBe(true)
  })

  it("kľúč nového profilu z názvu, bez kolízie", () => {
    expect(freeProfileKey("Zákon (§)", ["zakladny"])).toBe("zakon")
    expect(freeProfileKey("Zákon (§)", ["zakladny", "zakon"])).toBe("zakon_2")
    expect(freeProfileKey("§", [])).toBe("profil")
  })
})
