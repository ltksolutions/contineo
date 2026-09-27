/**
 * smartTags.test.ts — „Kľúč: Hodnota" (ADR-018, D117): normalizácia,
 * filter AND/OR a odvodený prehľad použitia.
 */
import { describe, it, expect } from "vitest"
import { parseSmartTag, parseSmartTags, matchesSmartFilter, aggregateSmartTags, tagId, filterFromQuery, renameTagIn, renameKeyIn, mergeTagsIn } from "../src/lib/smartTags"

const T = (s: string) => parseSmartTag(s)!

describe("parseSmartTag", () => {
  it("normalizuje kľúč aj hodnotu, label je kópia", () => {
    expect(parseSmartTag("Bezpečnosť: Výťah")).toEqual({ key: "bezpecnost", value: "vytah", label: "Bezpečnosť: Výťah" })
    expect(tagId(T("  bezpečnosť :   VÝŤAH "))).toBe("bezpecnost:vytah")
  })
  it("delí prvá dvojbodka", () => {
    expect(parseSmartTag("Čas: 10:30")?.label).toBe("Čas: 10:30")
    expect(parseSmartTag("Čas: 10:30")?.value).toBe("10_30")
  })
  it("nečitateľné vráti null", () => {
    expect(parseSmartTag("bez dvojbodky")).toBeNull()
    expect(parseSmartTag(": hodnota")).toBeNull()
    expect(parseSmartTag("Kľúč:")).toBeNull()
    expect(parseSmartTag(`K: ${"x".repeat(100)}`)).toBeNull()
  })
  it("zoznam bez duplicít, zlé menuje", () => {
    const r = parseSmartTags("Úroveň: 1, úroveň: 1\nTréner: Euro B licencia; zlé")
    expect(r.tags.map(tagId)).toEqual(["uroven:1", "trener:euro_b_licencia"])
    expect(r.invalid).toEqual(["zlé"])
  })
})

describe("matchesSmartFilter", () => {
  const tags = [T("Bezpečnosť: Výťah"), T("Úroveň: 2")]
  it("prázdny filter vyhovuje", () => expect(matchesSmartFilter(tags, [])).toBe(true))
  it("rôzne kľúče = AND", () => {
    expect(matchesSmartFilter(tags, [T("Bezpečnosť: Výťah"), T("Úroveň: 2")])).toBe(true)
    expect(matchesSmartFilter(tags, [T("Bezpečnosť: Výťah"), T("Úroveň: 3")])).toBe(false)
  })
  it("rovnaký kľúč = OR", () => {
    expect(matchesSmartFilter(tags, [T("Úroveň: 1"), T("Úroveň: 2")])).toBe(true)
  })
  it("filter z adresy prijme label aj identitu", () => {
    expect(filterFromQuery(["Bezpečnosť:Výťah", "uroven:2"]).map(tagId)).toEqual(["bezpecnost:vytah", "uroven:2"])
  })
})

describe("aggregateSmartTags", () => {
  it("počty podľa zdroja a najčastejší label", () => {
    const rows = aggregateSmartTags({
      courses: [{ smartTags: [T("Úroveň: 1"), T("úroveň: 1")] }, { smartTags: [T("Úroveň: 1")] }],
      questions: [{ smartTags: [T("uroven: 1"), T("Bezpečnosť: Výťah")] }],
    })
    expect(rows.map(r => [tagId(r), r.courses, r.questions, r.tests])).toEqual([
      ["bezpecnost:vytah", 0, 1, 0],
      ["uroven:1", 2, 1, 0],
    ])
    expect(rows[1].label).toBe("Úroveň: 1")
  })
})

describe("premenovanie (MANAGE Q1 — všade)", () => {
  it("tag sa premenuje, na existujúci sa zlúči, poradie ostáva", () => {
    const tags = [T("Úroveň: 1"), T("Bezpečnosť: Vytah"), T("Bezpečnosť: Výťah budovy")]
    expect(renameTagIn(tags, T("Bezpečnosť: Vytah"), T("Bezpečnosť: Výťah")).map(t => t.label))
      .toEqual(["Úroveň: 1", "Bezpečnosť: Výťah", "Bezpečnosť: Výťah budovy"])
    expect(renameTagIn(tags, T("Bezpečnosť: Vytah"), T("Úroveň: 1")).map(t => t.label))
      .toEqual(["Úroveň: 1", "Bezpečnosť: Výťah budovy"])
  })
  it("bez tagu vráti to isté pole", () => {
    const tags = [T("Úroveň: 1")]
    expect(renameTagIn(tags, T("X: y"), T("Z: w"))).toBe(tags)
  })
  it("kľúč sa premenuje na všetkých hodnotách a zápis hodnoty ostane", () => {
    const tags = [T("Bezpecnost: Výťah"), T("Bezpecnost: Požiar"), T("Úroveň: 1")]
    expect(renameKeyIn(tags, "bezpecnost", "Bezpečnosť").map(t => t.label))
      .toEqual(["Bezpečnosť: Výťah", "Bezpečnosť: Požiar", "Úroveň: 1"])
    expect(renameKeyIn(tags, "bezpecnost", "Oblasť").map(tagId)).toEqual(["oblast:vytah", "oblast:poziar", "uroven:1"])
  })
})

describe("zlúčenie", () => {
  it("viac tagov do jedného, entita s viacerými dostane cieľ raz", () => {
    const tags = [T("Bezpečnosť: Vytah"), T("Úroveň: 1"), T("Bezpečnosť: Lift")]
    expect(mergeTagsIn(tags, [T("Bezpečnosť: Vytah"), T("Bezpečnosť: Lift")], T("Bezpečnosť: Výťah")).map(t => t.label))
      .toEqual(["Bezpečnosť: Výťah", "Úroveň: 1"])
  })
  it("cieľ môže byť jeden zo zdrojov", () => {
    const tags = [T("Bezpečnosť: Lift"), T("Bezpečnosť: Výťah")]
    expect(mergeTagsIn(tags, [T("Bezpečnosť: Lift")], T("Bezpečnosť: Výťah")).map(t => t.label)).toEqual(["Bezpečnosť: Výťah"])
  })
})
