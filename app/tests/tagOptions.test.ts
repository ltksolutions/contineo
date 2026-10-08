/**
 * tagOptions.test.ts — ponuka značiek obsahuje aj značky, ktoré dokumenty
 * organizácie už majú (24. 9. 2026: „smernica" sa uložila, ale v ponuke nebola),
 * s názvom z číselníka a počtom dokumentov (ZAKLAD-vyber-skupin-a-znaciek).
 */
import { describe, it, expect, vi } from "vitest"

const aggregate = vi.hoisted(() => vi.fn<(...a: unknown[]) => { toArray: () => Promise<{ _id: string; n: number }[]> }>(() => ({
  toArray: async () => [
    { _id: "smernica", n: 3 }, { _id: "poriadok", n: 12 }, { _id: "", n: 1 }, { _id: "test", n: 1 }, { _id: "mladez", n: 2 },
  ],
})))
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async () => ({ aggregate })) }))

import { tagOptions } from "../src/lib/libraryRead"

describe("tagOptions", () => {
  it("číselník s názvom a počtom, potom použité značky navyše — bez duplicít a prázdnych", async () => {
    const options = await tagOptions("SFZ", { tags: [{ key: "test", label: "Test" }] } as never)
    const values = options.map(o => o.value)
    expect(values).toContain("smernica")
    expect(values).toContain("mladez")
    expect(values.filter(v => v === "poriadok")).toHaveLength(1)
    expect(values.filter(v => v === "test")).toHaveLength(1)
    expect(values).not.toContain("")
    // Číselník ostáva vpredu, použité navyše idú za ním — bez názvu.
    expect(values.indexOf("mladez")).toBeGreaterThan(values.indexOf("test"))
    expect(options.find(o => o.value === "test")).toMatchObject({ label: "Test", count: 1 })
    expect(options.find(o => o.value === "mladez")).toEqual({ value: "mladez", count: 2 })
  })

  it("dotaz je len v organizácii (D32)", async () => {
    await tagOptions("SFZ")
    const pipeline = aggregate.mock.calls.at(-1)![0] as { $match?: unknown }[]
    expect(pipeline[0]).toEqual({ $match: { companyCode: "SFZ" } })
  })
})
