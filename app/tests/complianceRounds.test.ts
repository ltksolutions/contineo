import { describe, it, expect } from "vitest"
import { roundState, needsAttention, roundDelta, roundTabs, filterFindings } from "../src/lib/complianceView"
import { MAX_FAILURES } from "../src/lib/complianceCheck"

const f = (id: string, o: Record<string, unknown> = {}) => ({ id, kind: "missing", location: id, quote: "q", citation: { documentId: "n", title: "N", articleRef: null, quote: "" }, status: null, ...o }) as never
const run = (o: Record<string, unknown> = {}) => ({ pending: [], failures: 0, stoppedAt: null, results: [], ...o }) as never

describe("stav kola (zoznam kontrol)", () => {
  it("beží, zlyhalo, zastavené, na rozhodnutie, uzavreté", () => {
    expect(roundState(run({ pending: ["a"] })).state).toBe("running")
    expect(roundState(run({ pending: ["a"], failures: MAX_FAILURES })).state).toBe("failed")
    expect(roundState(run({ stoppedAt: new Date() })).state).toBe("stopped")
    expect(roundState(run({ results: [{ findings: [f("1"), f("2", { status: "kept" })] }] }))).toEqual({ state: "open", open: 1, total: 2 })
    expect(roundState(run({ results: [{ findings: [f("1", { status: "accepted" })] }] })).state).toBe("done")
  })
  it("„Na rozhodnutie“ je všetko okrem uzavretého", () => {
    expect(["running", "stopped", "failed", "open"].every(s => needsAttention(s as never))).toBe(true)
    expect(needsAttention("done")).toBe(false)
  })
})

describe("zmena oproti predošlému kolu", () => {
  it("nové, prenesené ponechania, prijaté v predošlom", () => {
    const prev = run({ results: [{ findings: [f("a", { status: "accepted" }), f("b", { status: "kept" }), f("c")] }] })
    const cur = run({ results: [{ findings: [f("x", { status: "kept", carriedFrom: { runId: "r1", findingId: "b" } }), f("y"), f("z")] }] })
    expect(roundDelta(prev, cur)).toEqual({ fresh: 2, carried: 1, gone: 1 })
  })
  it("filter Nové skryje prenesené", () => {
    const list = [f("x", { carriedFrom: { runId: "r", findingId: "b" } }), f("y")] as { id: string }[]
    expect(filterFindings(list as never, "new").map(x => x.id)).toEqual(["y"])
  })
})

describe("prepínač kôl (Q1)", () => {
  it("do štyroch kôl všetky, najnovšie prvé", () => {
    expect(roundTabs([1, 2, 3], 3)).toEqual({ shown: [3, 2, 1], older: false })
    expect(roundTabs([1, 2, 3, 4], 2)).toEqual({ shown: [4, 3, 2, 1], older: false })
  })
  it("nad štyri: posledné tri a Staršie…; vybrané staršie sa pridá", () => {
    expect(roundTabs([1, 2, 3, 4, 5, 6], 6)).toEqual({ shown: [6, 5, 4], older: true })
    expect(roundTabs([1, 2, 3, 4, 5, 6], 2)).toEqual({ shown: [6, 5, 4, 2], older: true })
  })
})
