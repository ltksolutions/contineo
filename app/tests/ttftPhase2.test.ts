/**
 * ttftPhase2.test.ts — čas po prvý token, fáza 2.
 *
 * Podotázky bežia súbežne s hlavným hľadaním a výsledok zlúčenia je rovnaký
 * ako predtým; prepis otázky má strop a po ňom sa ide s pôvodnou otázkou.
 */
import { describe, it, expect } from "vitest"
import { searchWithSubQueries, MAX_MERGED } from "../src/lib/subQuerySearch"
import { preprocessQuery, PREPROCESS_TIMEOUT_MS } from "../src/lib/queryPreprocessor"
import type { ChunkResult } from "../src/lib/mongoSearch"
import type { GenerationProvider } from "../src/lib/providers/types"

const chunk = (id: string) => ({ _id: id }) as unknown as ChunkResult
const ids = (cs: ChunkResult[]) => cs.map(c => String(c._id))
const later = <T>(ms: number, value: T) => new Promise<T>(r => setTimeout(() => r(value), ms))

describe("searchWithSubQueries", () => {
  it("podotázky štartujú skôr, než dobehne hlavné hľadanie", async () => {
    const started: string[] = []
    let mainDone = false
    await searchWithSubQueries(
      async () => { started.push("main"); await later(30, null); mainDone = true; return [chunk("a")] },
      ["p1", "p2"],
      async q => { started.push(q); expect(mainDone).toBe(false); return [] },
    )
    expect(started).toEqual(["main", "p1", "p2"])
  })

  it("trvá ako najpomalšie hľadanie, nie ako ich súčet", async () => {
    const t0 = Date.now()
    await searchWithSubQueries(() => later(100, [chunk("a")]), ["p1", "p2", "p3"], () => later(100, [chunk("b")]))
    expect(Date.now() - t0).toBeLessThan(250)
  })

  it("zlúčenie: hlavné výsledky prvé, bez duplikátov, najviac MAX_MERGED", async () => {
    const out = await searchWithSubQueries(
      async () => ["a", "b", "c", "d", "e"].map(chunk),
      ["p1", "p2"],
      async q => (q === "p1" ? ["b", "f", "g"] : ["g", "h", "i", "j"]).map(chunk),
    )
    expect(ids(out)).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"])
    expect(out).toHaveLength(MAX_MERGED)
  })

  it("najviac tri podotázky", async () => {
    const asked: string[] = []
    await searchWithSubQueries(async () => [], ["1", "2", "3", "4"], async q => { asked.push(q); return [] })
    expect(asked).toEqual(["1", "2", "3"])
  })

  it("bez podotázok sa hlavný výsledok neorezáva", async () => {
    const all = Array.from({ length: 12 }, (_, i) => chunk(String(i)))
    const out = await searchWithSubQueries(async () => all, [], async () => [])
    expect(out).toHaveLength(12)
  })
})

describe("preprocessQuery — strop", () => {
  const question = "Za akých podmienok môže prestúpiť maloletý hráč do iného klubu?"

  it("posiela adaptéru strop PREPROCESS_TIMEOUT_MS", async () => {
    let timeoutMs: number | undefined
    const provider = {
      async complete(_p: string, opts: { timeoutMs?: number }) {
        timeoutMs = opts.timeoutMs
        return JSON.stringify({ rewritten: "prestup maloletého hráča", subQueries: [], keywords: [] })
      },
    } as unknown as GenerationProvider
    await preprocessQuery(question, provider)
    expect(timeoutMs).toBe(PREPROCESS_TIMEOUT_MS)
    expect(PREPROCESS_TIMEOUT_MS).toBeLessThan(5000)
  })

  it("po vypršaní stropu ide pôvodná otázka bez podotázok", async () => {
    const provider = {
      async complete() { throw new DOMException("The operation was aborted due to timeout", "TimeoutError") },
    } as unknown as GenerationProvider
    const out = await preprocessQuery(question, provider)
    expect(out).toEqual({ rewritten: question, subQueries: [], keywords: [], time: null })
  })
})
