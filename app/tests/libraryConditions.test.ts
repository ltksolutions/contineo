/**
 * libraryConditions.test.ts — podmienky query buildera.
 *
 * Podmienky prichádzajú z adresy, teda od kohokoľvek, a idú priamo do dotazu
 * na databázu. Testuje sa preto hlavne to, čo sa **nesmie** dostať dnu, a to,
 * či sa zostavený dotaz dá poslať odkazom a prečítať späť rovnako.
 */

import { describe, it, expect } from "vitest"
import {
  decodeCondition, encodeCondition, readConditions, readMatch,
  conditionFields, conditionQuery, describeConditions, OPS_FOR_FIELD,
} from "../src/lib/libraryConditions"
import { buildQuery } from "../src/lib/libraryRead"

describe("čítanie z adresy", () => {
  it("kruh podmienka → adresa → podmienka drží", () => {
    const c = { field: "title", op: "contains", value: "prestup hráča" } as const
    expect(decodeCondition(encodeCondition(c))).toEqual(c)
  })

  it("hodnota s oddeľovačom sa nerozseká", () => {
    // Bez kódovania hodnoty by názov s vlnovkou vyrobil štvrtú časť
    // a podmienka by sa zahodila.
    const c = { field: "title", op: "contains", value: "a~b" } as const
    expect(decodeCondition(encodeCondition(c))?.value).toBe("a~b")
  })

  it("neznáme pole ani operátor sa nepoužijú", () => {
    // Inak by sa adresou dalo pýtať na čokoľvek v dokumente.
    expect(decodeCondition("versions~is~x")).toBeNull()
    expect(decodeCondition("title~drop~x")).toBeNull()
    expect(decodeCondition("title~is")).toBeNull()
  })

  it("nezmyselná dvojica poľa a operátora neprejde", () => {
    // „Zmenené obsahuje" nedáva zmysel a v ponuke na obrazovke ani nie je;
    // ručne upravená adresa ju nesmie prepašovať.
    expect(decodeCondition("updatedAt~contains~2026")).toBeNull()
    expect(decodeCondition("category~contains~norma")).toBeNull()
    expect(OPS_FOR_FIELD.updatedAt).toEqual(["before", "after"])
  })

  it("prázdna hodnota a pokazené kódovanie sa zahodia", () => {
    expect(decodeCondition("title~is~")).toBeNull()
    expect(decodeCondition("title~is~%E0%A4%A")).toBeNull()
  })

  it("opakovaný kľúč dá zoznam a nezmysly sa preskočia", () => {
    const conds = readConditions({ cond: ["title~contains~prestup", "zle", "category~is~norma"] })
    expect(conds).toHaveLength(2)
    expect(conds[1]).toEqual({ field: "category", op: "is", value: "norma" })
  })
})

describe("režim spájania", () => {
  it("predvolený je „všetky“ a do adresy sa nepíše", () => {
    expect(readMatch({})).toBe("all")
    expect(readMatch({ match: "nieco" })).toBe("all")
    const c = [{ field: "title", op: "contains", value: "a" }] as const
    expect(conditionFields([...c], "all")).toEqual([["cond", "title~contains~a"]])
  })

  it("„ktorákoľvek“ sa píše len pri viac než jednej podmienke", () => {
    // Pri jedinej podmienke nemá čo spájať a v adrese by len mátal.
    const one = [{ field: "title", op: "contains", value: "a" }] as const
    const two = [...one, { field: "category", op: "is", value: "norma" }] as const
    expect(conditionFields([...one], "any").some(([k]) => k === "match")).toBe(false)
    expect(conditionFields([...two], "any").some(([k]) => k === "match")).toBe(true)
  })
})

describe("dotaz z podmienok", () => {
  it("jedna podmienka nie je zabalená do $and", () => {
    expect(conditionQuery([{ field: "category", op: "is", value: "norma" }], "all"))
      .toEqual({ category: "norma" })
  })

  it("režim rozhoduje o spojke", () => {
    const conds = [
      { field: "category", op: "is", value: "norma" },
      { field: "status", op: "not", value: "published" },
    ] as const
    expect(conditionQuery([...conds], "all")).toEqual({
      $and: [{ category: "norma" }, { status: { $ne: "published" } }],
    })
    expect(conditionQuery([...conds], "any")).toEqual({
      $or: [{ category: "norma" }, { status: { $ne: "published" } }],
    })
  })

  it("prázdny zoznam nevyrobí prázdny $and", () => {
    // `{ $and: [] }` by dotaz zhodil.
    expect(conditionQuery([], "all")).toBeNull()
  })

  it("hľadaný text sa escapuje aj tu", () => {
    const q = conditionQuery([{ field: "title", op: "contains", value: "a(b).*" }], "all")
    expect(q).toEqual({ title: { $regex: "a\\(b\\)\\.\\*", $options: "i" } })
  })

  it("neplatný dátum sa zahodí, nie použije", () => {
    // `$lt: Invalid Date` nevráti nič a vyzeralo by to, že knižnica je prázdna.
    expect(conditionQuery([{ field: "updatedAt", op: "before", value: "včera" }], "all")).toBeNull()
    const q = conditionQuery([{ field: "updatedAt", op: "after", value: "2026-01-01" }], "all")
    expect((q?.updatedAt as { $gt: Date }).$gt).toBeInstanceOf(Date)
  })

  it("podmienky sa pridávajú k facetom, nie namiesto nich", () => {
    const q = buildQuery("sfz", {
      category: "norma",
      conditions: [{ field: "title", op: "contains", value: "prestup" }],
      match: "all",
    })
    expect(q.$and).toEqual([
      { category: "norma" },
      { title: { $regex: "prestup", $options: "i" } },
    ])
  })
})

describe("náhľad dotazu", () => {
  it("je to veta zo skutočných podmienok", () => {
    const text = describeConditions(
      [
        { field: "category", op: "is", value: "norma" },
        { field: "title", op: "contains", value: "prestup" },
      ],
      "any",
      f => ({ category: "Druh", title: "Názov" } as Record<string, string>)[f] ?? f,
      o => ({ is: "je", contains: "obsahuje" } as Record<string, string>)[o] ?? o,
      m => (m === "any" ? "alebo" : "a zároveň"),
    )
    expect(text).toBe('Druh je „norma" alebo Názov obsahuje „prestup"')
  })

  it("bez podmienok je prázdny", () => {
    expect(describeConditions([], "all", f => f, o => o, () => "a")).toBe("")
  })
})
