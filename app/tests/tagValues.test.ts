/**
 * tagValues.test.ts — značka „len tu“ sa po napísaní zapíše do číselníka
 * (3. 11. 2026). Dovtedy ju server pokladal za existujúcu a len ju zaškrtol.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const { addCodelistItem, tagOptions } = vi.hoisted(() => ({ addCodelistItem: vi.fn(), tagOptions: vi.fn() }))
vi.mock("../src/lib/codelistsTenant", () => ({ addCodelistItem }))
vi.mock("../src/lib/libraryRead", () => ({ tagOptions }))
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))

import { tagsFromForm } from "../src/lib/tagValues"

const EXTRAS = { tags: [{ key: "issf", label: "ISSF" }] }

function form(tags: string[], fresh: string[]): FormData {
  const fd = new FormData()
  for (const t of tags) fd.append("tags", t)
  for (const f of fresh) fd.append("tagsNew", f)
  return fd
}

beforeEach(() => {
  addCodelistItem.mockReset()
  // „rozpis“ je na dokumentoch, v číselníku nie; „issf“ je v číselníku.
  tagOptions.mockResolvedValue([
    { value: "issf", label: "ISSF", count: 10 },
    { value: "rozpis", count: 1 },
  ])
})

describe("tagsFromForm", () => {
  it("napísaná značka „len tu“ sa zapíše do číselníka s názvom", async () => {
    const r = await tagsFromForm(form(["rozpis"], ["Rozpis"]), "SFZ", "a@b.sk", EXTRAS)
    expect(addCodelistItem).toHaveBeenCalledWith("SFZ", "tags", "rozpis", "Rozpis", "a@b.sk")
    expect(r.tags).toEqual(["rozpis"])
    expect(r.similar).toEqual([])
  })

  it("len zaškrtnutá značka „len tu“ sa do číselníka nezapisuje", async () => {
    const r = await tagsFromForm(form(["rozpis"], []), "SFZ", "a@b.sk", EXTRAS)
    expect(addCodelistItem).not.toHaveBeenCalled()
    expect(r.tags).toEqual(["rozpis"])
  })

  it("napísaná značka z číselníka je len zaškrtnutie", async () => {
    const r = await tagsFromForm(form([], ["ISSF"]), "SFZ", "a@b.sk", EXTRAS)
    expect(addCodelistItem).not.toHaveBeenCalled()
    expect(r.tags).toEqual(["issf"])
  })
})
