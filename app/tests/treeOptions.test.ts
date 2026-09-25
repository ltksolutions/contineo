/** treeOptions.test.ts — cesta v strome namiesto odsadenia (KOMPONENT-vyber-oddelenia). */
import { describe, it, expect } from "vitest"
import { treeOptions } from "../src/lib/treeOptions"

describe("treeOptions", () => {
  it("skladá cestu z predkov podľa úrovne", () => {
    const o = treeOptions([
      { id: "a", name: "Konferencia", level: 1 },
      { id: "b", name: "Prezident", level: 2 },
      { id: "c", name: "Oddelenie IT", level: 3 },
      { id: "d", name: "Sekretariát", level: 2 },
      { id: "e", name: "Revízna komisia", level: 1 },
    ])
    expect(o.map(x => x.path ?? "")).toEqual(["", "Konferencia", "Konferencia › Prezident", "Konferencia", ""])
    expect(o[2]).toMatchObject({ value: "c", label: "Oddelenie IT", level: 3 })
  })
})

describe("slugifyTrackKey", () => {
  it("kľúč trasy z názvu s pomlčkou (TRACK_KEY)", async () => {
    const { slugifyTrackKey } = await import("../src/lib/slug")
    expect(slugifyTrackKey("Nový zamestnanec — kancelária")).toBe("novy-zamestnanec-kancelaria")
  })
})
