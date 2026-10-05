import { describe, expect, it } from "vitest"
import { usagePeriod, usageRecord, usageFilterFromQuery, AI_USAGE_RETENTION_DAYS } from "@/lib/aiUsage"
import { usageAoa } from "@/lib/aiUsageExport"

const actor = { companyCode: "SFZ", personId: "p1", personName: "Ján Letko", email: "jan@sfz.sk" }
const NOW = new Date("2026-10-05T10:00:00Z")

describe("aiUsage — spotreba AI (D158, D159)", () => {
  it("predvolené obdobie je aktuálny mesiac, `to` je deň za posledným", () => {
    const p = usagePeriod(undefined, undefined, NOW)
    expect(p.fromText).toBe("2026-10-01")
    expect(p.toText).toBe("2026-10-31")
    expect(p.to.toISOString()).toBe("2026-11-01T00:00:00.000Z")
  })

  it("prehodené dátumy sa vymenia, nečitateľné padnú na mesiac", () => {
    expect(usagePeriod("2026-09-30", "2026-09-01", NOW)).toMatchObject({ fromText: "2026-09-01", toText: "2026-09-30" })
    expect(usagePeriod("kedysi", "2026-13-45", NOW).fromText).toBe("2026-10-01")
  })

  it("filter z adresy: neznámy účel sa ignoruje, osoba ostáva", () => {
    const f = usageFilterFromQuery({ from: "2026-10-01", to: "2026-10-05", person: "p1", purpose: "hack" }, NOW)
    expect(f.personId).toBe("p1")
    expect(f.purpose).toBeUndefined()
    expect(usageFilterFromQuery({ purpose: "answer" }, NOW).purpose).toBe("answer")
  })

  it("riadok nesie sumu podľa cenníka v deň volania a neznámy model priznáva", () => {
    const r = usageRecord({
      actor, purpose: "answer", provider: "anthropic", model: "claude-sonnet-5", keySource: "operator",
      tokens: { input: 1_000_000, output: 100_000 }, at: NOW,
    })
    expect(r.usd).toBeCloseTo(3, 9)
    expect(r.tokens).toEqual({ input: 1_000_000, output: 100_000, cacheWrite: 0, cacheRead: 0 })
    expect(r.unknownModel).toBeUndefined()
    const u = usageRecord({ actor, purpose: "answer", provider: "openai", model: "lokalny", keySource: null, at: NOW })
    expect(u).toMatchObject({ usd: 0, unknownModel: true })
  })

  it("zlyhané volanie sa zapíše s príznakom; znenie otázky v riadku nie je", () => {
    const r = usageRecord({ actor, purpose: "query-rewrite", provider: "anthropic", model: "claude-haiku-4-5-20251001", keySource: "tenant", failed: true, at: NOW })
    expect(r.failed).toBe(true)
    expect(Object.keys(r)).not.toContain("question")
    expect(Object.keys(r)).not.toContain("query")
  })

  it("retencia 25 mesiacov", () => {
    expect(AI_USAGE_RETENTION_DAYS).toBeGreaterThanOrEqual(760)
    expect(AI_USAGE_RETENTION_DAYS).toBeLessThanOrEqual(762)
  })

  it("export: stabilné anglické stĺpce, čas ako dátum, popis s predmetom", () => {
    const r = usageRecord({
      actor, purpose: "pdf-rewrite", subject: "Volebný poriadok SFZ", provider: "anthropic",
      model: "claude-sonnet-4-5", keySource: "tenant", tokens: { input: 10, output: 5 }, at: NOW,
    })
    const [head, row] = usageAoa([r], "sk")
    expect(head.slice(0, 5)).toEqual(["at", "personName", "email", "purpose", "description"])
    expect(row[0]).toBeInstanceOf(Date)
    expect(String(row[4])).toContain("Prepis skenu PDF — Volebný poriadok SFZ")
    expect(row[head.indexOf("usd")]).toBeTypeOf("number")
  })
})
