/**
 * categoryValue.test.ts — nový druh priamo pri nahrávaní dokumentu
 * (ZAKLAD-novy-druh-pri-nahravani, 2. 11. 2026).
 *
 * Overuje, že druh zakladá len správca číselníkov, že sa nezaloží druhý
 * takmer rovnaký a že `checkMetadata` dostane doplnky aj s novým druhom.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const { addCodelistItem } = vi.hoisted(() => ({ addCodelistItem: vi.fn() }))
vi.mock("../src/lib/codelistsTenant", () => ({ addCodelistItem }))
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))

import { categoryFromForm } from "../src/lib/categoryValue"

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

beforeEach(() => addCodelistItem.mockReset())

describe("categoryFromForm", () => {
  it("vybraný druh prejde bez zápisu do číselníka", async () => {
    const r = await categoryFromForm(form({ category: "smernica" }), "sfz", "a@b.sk", false)
    expect(r.category).toBe("smernica")
    expect(addCodelistItem).not.toHaveBeenCalled()
  })

  it("nový druh založí len správca číselníkov", async () => {
    await expect(categoryFromForm(form({ categoryNew: "Rozpis" }), "sfz", "a@b.sk", false))
      .rejects.toMatchObject({ code: "library.categoryNotAllowed" })
    expect(addCodelistItem).not.toHaveBeenCalled()
  })

  it("nový druh sa založí s úlohou a pribudne do doplnkov", async () => {
    const r = await categoryFromForm(form({ categoryNew: "Rozpis", categoryRole: "binding" }), "sfz", "a@b.sk", true)
    expect(addCodelistItem).toHaveBeenCalledWith("sfz", "category", "rozpis", "Rozpis", "a@b.sk", "binding")
    expect(r.category).toBe("rozpis")
    expect(r.created).toBe("Rozpis")
    expect(r.extras?.category?.some(i => i.key === "rozpis")).toBe(true)
  })

  it("existujúci názov sa nezakladá znova, len vyberie", async () => {
    const r = await categoryFromForm(form({ categoryNew: "smernica" }), "sfz", "a@b.sk", true)
    expect(r.category).toBe("smernica")
    expect(addCodelistItem).not.toHaveBeenCalled()
  })

  it("podobný názov dostane existujúci druh a hlásenie", async () => {
    const r = await categoryFromForm(form({ categoryNew: "Smernice" }), "sfz", "a@b.sk", true)
    expect(r.category).toBe("smernica")
    expect(r.similar?.value).toBe("Smernice")
    expect(addCodelistItem).not.toHaveBeenCalled()
  })
})
