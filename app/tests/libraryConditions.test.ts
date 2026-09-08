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
  normalizeGroups, groupsOf, splitAt, mergeUp, startsGroup,
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

describe("režim spájania — už len na čítanie starých odkazov", () => {
  it("predvolený je „všetky“ a neznáma hodnota naň padá", () => {
    expect(readMatch({})).toBe("all")
    expect(readMatch({ match: "nieco" })).toBe("all")
  })

  it("do adresy sa `match` nezapisuje, skupina áno", () => {
    // Skupinu nesie samotná podmienka. Keby sa `match` zapisoval popri nej,
    // vznikli by dva zdroje tej istej pravdy a raz by si odporovali.
    const c = [{ field: "title", op: "contains", value: "a" }] as const
    expect(conditionFields([...c], "all")).toEqual([["cond", "g0~title~contains~a"]])
    expect(conditionFields([...c], "any").some(([k]) => k === "match")).toBe(false)
  })

  it("starý odkaz s `match=any` znamená každú podmienku vo vlastnej skupine", () => {
    // Adresa spred zavedenia skupín musí vrátiť to isté, čo vracala predtým.
    const two = [
      { field: "title", op: "contains", value: "a" },
      { field: "category", op: "is", value: "norma" },
    ] as const
    expect(conditionFields([...two], "any").map(([, v]) => v.slice(0, 3)))
      .toEqual(["g0~", "g1~"])
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

describe("skupiny podmienok — zátvorky bez znakov", () => {
  const c = (value: string, group?: number) =>
    ({ field: "title", op: "contains", value, ...(group === undefined ? {} : { group }) }) as const

  it("stará adresa bez skupín sa vyloží podľa match", () => {
    // `all` = jedna skupina so všetkým, `any` = každá podmienka sama. Sú to
    // presne tie dva krajné prípady, ktoré builder mal predtým, takže odkaz
    // spred zmeny musí vrátiť to isté.
    expect(normalizeGroups([c("a"), c("b")], "all").map(x => x.group)).toEqual([0, 0])
    expect(normalizeGroups([c("a"), c("b")], "any").map(x => x.group)).toEqual([0, 1])
  })

  it("skupina prežije kruh podmienka → adresa → podmienka", () => {
    const one = { field: "title", op: "contains", value: "prestup", group: 2 } as const
    expect(decodeCondition(encodeCondition(one))).toEqual(one)
  })

  it("hodnota s vlnovkou sa skupinou nepokazí", () => {
    // Vlnovka je oddeľovač aj bezpečný znak v `encodeURIComponent`. Skupina
    // je preto predpona, nie štvrtá časť — inak by sa hodnota nedala odlíšiť.
    const one = { field: "title", op: "contains", value: "a~b~c", group: 1 } as const
    expect(decodeCondition(encodeCondition(one))).toEqual(one)
  })

  it("dotaz je ALEBO medzi skupinami a A vnútri nich", () => {
    const q = conditionQuery([c("a", 0), c("b", 0), c("c", 1)])
    expect(q).toEqual({
      $or: [
        { $and: [
          { title: { $regex: "a", $options: "i" } },
          { title: { $regex: "b", $options: "i" } },
        ] },
        { title: { $regex: "c", $options: "i" } },
      ],
    })
  })

  it("jediná skupina nezabalí dotaz do $or", () => {
    // Zbytočný `$or` s jedným prvkom by dotaz nepokazil, ale sťažil čítanie
    // profilu dotazu v Atlase — a to je jediné miesto, kde sa hľadá, prečo
    // je dotaz pomalý.
    expect(conditionQuery([c("a", 0), c("b", 0)])).toEqual({
      $and: [
        { title: { $regex: "a", $options: "i" } },
        { title: { $regex: "b", $options: "i" } },
      ],
    })
  })

  it("skupina, z ktorej všetko vypadlo, sa zahodí celá", () => {
    // Neplatný dátum sa nepreloží. Prázdny `$and` by dotaz zhodil a prázdny
    // `$or` by nevrátil nič — teda by knižnica vyzerala prázdna.
    const q = conditionQuery([
      { field: "updatedAt", op: "after", value: "nezmysel", group: 0 },
      c("b", 1),
    ])
    expect(q).toEqual({ title: { $regex: "b", $options: "i" } })
  })

  it("„alebo odtiaľto“ posunie aj riadky za sebou", () => {
    // Keby zostali v starej skupine, jedno kliknutie by zmenilo logiku na
    // dvoch miestach, nie na tom, na ktoré človek klikol.
    const rows = [c("a", 0), c("b", 0), c("c", 0)]
    expect(splitAt(rows, 1).map(x => x.group)).toEqual([0, 1, 1])
  })

  it("„a namiesto alebo“ presunie len ten riadok", () => {
    const rows = [c("a", 0), c("b", 1), c("c", 1)]
    expect(mergeUp(rows, 1).map(x => x.group)).toEqual([0, 0, 1])
  })

  it("skupiny sa po odobraní prečíslujú bez dier", () => {
    // Diera v číslovaní by z čísla skupiny prestala robiť jej poradie a
    // odkazy „alebo odtiaľto“ by presúvali riadok inam, než na čo sa klikne.
    expect(normalizeGroups([c("a", 0), c("b", 5), c("c", 9)]).map(x => x.group)).toEqual([0, 1, 2])
  })

  it("prvý riadok skupiny je poznať", () => {
    const rows = [c("a", 0), c("b", 0), c("c", 1)]
    expect(startsGroup(rows, 0)).toBe(true)
    expect(startsGroup(rows, 1)).toBe(false)
    expect(startsGroup(rows, 2)).toBe(true)
  })

  it("groupsOf nevracia prázdne skupiny", () => {
    expect(groupsOf([c("a", 0), c("b", 2)]).map(g => g.length)).toEqual([1, 1])
  })

  it("adresa nesie skupinu vždy a match už nie", () => {
    // `match` zostáva len na čítanie starých odkazov. Keby sa zapisoval,
    // vznikli by dva zdroje tej istej pravdy.
    const fields = conditionFields([c("a", 0), c("b", 1)])
    expect(fields.every(([k]) => k === "cond")).toBe(true)
    expect(fields.map(([, v]) => v.startsWith("g"))).toEqual([true, true])
  })

  it("náhľad píše zátvorky len pri dvoch a viac skupinách", () => {
    const label = (f: string) => f
    const op = (o: string) => o
    const join = (m: string) => (m === "any" ? "alebo" : "a")

    const single = describeConditions([c("a", 0), c("b", 0)], "all", label, op, join)
    expect(single).not.toContain("(")

    const two = describeConditions([c("a", 0), c("b", 0), c("c", 1)], "all", label, op, join)
    expect(two).toContain("(")
    expect(two).toContain("alebo")
  })
})
