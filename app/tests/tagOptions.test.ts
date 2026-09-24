/**
 * tagOptions.test.ts — ponuka značiek obsahuje aj značky, ktoré dokumenty
 * organizácie už majú (24. 9. 2026: „smernica" sa uložila, ale v ponuke nebola).
 */
import { describe, it, expect, vi } from "vitest"

const distinct = vi.hoisted(() => vi.fn(async () => ["smernica", "Poriadok", " ", "test", "mladez"]))
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async () => ({ distinct })) }))

import { tagOptions } from "../src/lib/libraryRead"

describe("tagOptions", () => {
  it("číselník, potom použité značky navyše — bez duplicít a prázdnych", async () => {
    const values = (await tagOptions("SFZ", { tags: [{ key: "test", label: "Test" }] } as never)).map(o => o.value)
    expect(values).toContain("smernica")
    expect(values).toContain("mladez")
    expect(values.filter(v => v === "poriadok")).toHaveLength(1)
    expect(values.filter(v => v === "test")).toHaveLength(1)
    expect(values).not.toContain("")
    // Číselník ostáva vpredu, použité navyše idú za ním.
    expect(values.indexOf("mladez")).toBeGreaterThan(values.indexOf("test"))
  })

  it("dotaz je len v organizácii (D32)", async () => {
    await tagOptions("SFZ")
    expect(distinct).toHaveBeenCalledWith("tags", { companyCode: "SFZ" })
  })
})
