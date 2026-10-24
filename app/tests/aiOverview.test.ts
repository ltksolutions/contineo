import { describe, expect, it } from "vitest"
import { overviewAoa, overviewGroup, overviewMonths, shapeOverview, topWithRest, type OverviewBucket } from "@/lib/aiOverview"
import { BACKGROUND_PERSON, usageFilterFromQuery, usageFilterQuery, usageQuery } from "@/lib/aiUsage"

const NOW = new Date("2026-10-24T10:00:00Z")
const tok = (input: number) => ({ input, output: 1, cacheWrite: 0, cacheRead: 2 })
const b = (key: string, month: string, usd: number, extra: Partial<OverviewBucket> = {}): OverviewBucket =>
  ({ key, name: key, background: false, month, usd, calls: 1, tokens: tok(10), ...extra })

describe("aiOverview — Prehľad po mesiacoch (ORG-ai-prehlad)", () => {
  it("mesiace obdobia: orezané na Od–Do, budúce označené", () => {
    const f = usageFilterFromQuery({ from: "2026-01-15", to: "2026-12-31" }, NOW)
    const m = overviewMonths(f.from, f.to, NOW)
    expect(m).toHaveLength(12)
    expect(m[0]).toMatchObject({ key: "2026-01", fromText: "2026-01-15", toText: "2026-01-31", blank: false })
    expect(m[9]).toMatchObject({ key: "2026-10", blank: false })
    expect(m[10]).toMatchObject({ key: "2026-11", blank: true })
    expect(m[11].toText).toBe("2026-12-31")
  })

  it("mesiace pred prvým zapísaným volaním sú prázdne, nie nula", () => {
    const f = usageFilterFromQuery({ from: "2026-01-01", to: "2026-12-31" }, NOW)
    const m = overviewMonths(f.from, f.to, NOW, new Date("2026-10-05T08:00:00Z"))
    expect(m.filter(x => !x.blank).map(x => x.key)).toEqual(["2026-10"])
    const o = shapeOverview("people", m, [b("p1", "2026-10", 4)])
    expect(o.totals.byMonth[0]).toBeNull()
    expect(o.totals.byMonth[9]).toBe(4)
  })

  it("jeden mesiac a prechod cez rok", () => {
    const one = usageFilterFromQuery({}, NOW)
    expect(overviewMonths(one.from, one.to, NOW).map(m => m.key)).toEqual(["2026-10"])
    const across = usageFilterFromQuery({ from: "2025-11-01", to: "2026-02-28" }, NOW)
    expect(overviewMonths(across.from, across.to, NOW).map(m => m.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"])
  })

  it("matica: súčty, poradie podľa sumy, budúci mesiac prázdny, nie nula", () => {
    const f = usageFilterFromQuery({ from: "2026-09-01", to: "2026-11-30" }, NOW)
    const months = overviewMonths(f.from, f.to, NOW)
    const o = shapeOverview("people", months, [
      b("p1", "2026-09", 1), b("p1", "2026-10", 2), b("p2", "2026-10", 5),
      b(`${BACKGROUND_PERSON}Kontrola súladu (na pozadí)`, "2026-10", 0.5, { background: true }),
      b("p9", "2025-01", 99), // mimo obdobia sa ignoruje
    ])
    expect(o.items.map(i => i.key)).toEqual(["p2", "p1", "bg:Kontrola súladu (na pozadí)"])
    expect(o.items[1].byMonth).toEqual([1, 2, null])
    expect(o.items[0].byMonth).toEqual([0, 5, null])
    expect(o.items[2].background).toBe(true)
    expect(o.totals).toMatchObject({ usd: 8.5, calls: 4, byMonth: [1, 7.5, null] })
    expect(o.totals.tokens).toEqual({ input: 40, output: 4, cacheWrite: 0, cacheRead: 8 })
    expect(o.items[1].tokensByMonth[2]).toBeNull()
  })

  it("graf: päť najväčších a zvyšok", () => {
    const months = overviewMonths(new Date("2026-10-01T00:00:00Z"), new Date("2026-11-01T00:00:00Z"), NOW)
    const o = shapeOverview("purposes", months, ["a", "b", "c", "d", "e", "f", "g"].map((k, i) => b(k, "2026-10", 10 - i)))
    const { top, rest } = topWithRest(o.items)
    expect(top.map(i => i.key)).toEqual(["a", "b", "c", "d", "e"])
    expect(rest.map(i => i.key)).toEqual(["f", "g"])
  })

  it("pohľad z adresy: neznámy padá na Osoby", () => {
    expect(overviewGroup("models")).toBe("models")
    expect(overviewGroup("hack")).toBe("people")
    expect(overviewGroup(undefined)).toBe("people")
  })

  it("Excel: hlavička s mesiacmi, riadok Spolu, budúci mesiac prázdny", () => {
    const months = overviewMonths(new Date("2026-10-01T00:00:00Z"), new Date("2026-12-01T00:00:00Z"), NOW)
    const aoa = overviewAoa(shapeOverview("models", months, [b("claude-sonnet-5", "2026-10", 3)]), it => `M ${it.key}`)
    expect(aoa[0]).toEqual(["name", "key", "background", "2026-10", "2026-11", "usd", "calls", "inputTokens", "outputTokens", "cacheWriteTokens", "cacheReadTokens"])
    expect(aoa[1]).toEqual(["M claude-sonnet-5", "claude-sonnet-5", "", 3, "", 3, 1, 10, 1, 0, 2])
    expect(aoa[2].slice(0, 6)).toEqual(["total", "", "", 3, "", 3])
  })
})

describe("filter Spotreby z buniek Prehľadu", () => {
  it("práca bez osoby: `person=none` hľadá všetko bez personId", () => {
    const f = usageFilterFromQuery({ person: "none" }, NOW)
    expect(f).toMatchObject({ noPerson: true })
    expect(f.personId).toBeUndefined()
    expect(usageQuery("SFZ", f)).toMatchObject({ personId: null })
    expect(usageFilterQuery(f).get("person")).toBe("none")
  })

  it("práca na pozadí: osoba `bg:<meno>` hľadá bez personId podľa mena", () => {
    const f = usageFilterFromQuery({ person: "bg:Ťažba FAQ (cron)" }, NOW)
    expect(f.personId).toBeUndefined()
    expect(f.backgroundName).toBe("Ťažba FAQ (cron)")
    expect(usageQuery("SFZ", f)).toMatchObject({ companyCode: "SFZ", personId: null, personName: "Ťažba FAQ (cron)" })
  })

  it("model a mimo cenníka idú do dotazu aj späť do adresy", () => {
    const f = usageFilterFromQuery({ from: "2026-10-01", to: "2026-10-31", model: "claude-haiku-5", unpriced: "1" }, NOW)
    expect(usageQuery("SFZ", f)).toMatchObject({ model: "claude-haiku-5", unknownModel: true })
    const q = usageFilterQuery(f)
    expect(q.get("model")).toBe("claude-haiku-5")
    expect(q.get("unpriced")).toBe("1")
    expect(usageFilterQuery(usageFilterFromQuery({ person: "bg:X" }, NOW)).get("person")).toBe("bg:X")
  })
})
