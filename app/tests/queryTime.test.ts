/**
 * queryTime.test.ts — ku ktorému dňu sa otázka pýta (plán „znenia v indexe",
 * krok 6). Pravidlá bežia pri každej otázke, aj pri krátkej a fulltextovej,
 * kde sa prepis modelom nespúšťa.
 */
import { describe, it, expect } from "vitest"
import { detectQueryTime, parseModelTime, resolveQueryTime, sanitizeQueryTime, searchInstant, todayTime, withoutTimePhrase } from "../src/lib/queryTime"
import { parsePreprocessed } from "../src/lib/queryPreprocessor"

const NOW = new Date("2026-09-29T10:00:00Z")
const at = (q: string) => detectQueryTime(q, NOW)

describe("detectQueryTime — k dátumu", () => {
  it.each([
    ["Aký bol trest za tri žlté karty k 1. 1. 2020?", "2020-01-01"],
    ["Aký bol trest za tri žlté karty k 1.1.2020?", "2020-01-01"],
    ["Čo platilo ku dňu 2020-03-15 o prestupoch?", "2020-03-15"],
    ["Ako sa volil prezident 15. marca 2018?", "2018-03-15"],
    ["Kto zvolával konferenciu 1. júla 2016?", "2016-07-01"],
    ["Jaký byl trest 1. července 2019?", "2019-07-01"],
    ["Jaký byl trest 1. června 2019?", "2019-06-01"],
    ["What was the penalty on July 1, 2019?", "2019-07-01"],
    ["What was the penalty on 1 July 2019?", "2019-07-01"],
    ["Ako sa volil prezident v roku 2019?", "2019-12-31"],
    ["Ako to bolo v r. 2017 s odstupným?", "2017-12-31"],
    ["Jak to bylo v roce 2018?", "2018-12-31"],
    ["How were transfers handled in 2019?", "2019-12-31"],
    ["Aké bolo odstupné vlani?", "2025-12-31"],
    ["Jaké bylo odstupné loni?", "2025-12-31"],
    ["Aké pravidlá platili pred rokom?", "2025-09-29"],
  ])("%s → %s", (q, date) => {
    expect(at(q)).toEqual({ kind: "asOf", asOf: date, source: "rules" })
  })

  it("budúci dátum je tiež asOf — novela zverejnená vopred", () => {
    expect(at("Čo bude platiť k 1. 1. 2027?")).toEqual({ kind: "asOf", asOf: "2027-01-01", source: "rules" })
  })

  it("dnešný dátum výslovne je dnešok", () => {
    expect(at("Čo platí k 29. 9. 2026?")).toEqual({ kind: "today", asOf: "2026-09-29", source: "rules" })
  })
})

describe("detectQueryTime — porovnanie", () => {
  it.each([
    "Čo sa zmenilo v disciplinárnom poriadku?",
    "Co se změnilo ve stanovách?",
    "What changed in the statutes?",
    "Aký je rozdiel medzi starým a novým znením?",
    "Porovnaj staré a nové stanovy",
    "Čo je nové oproti predchádzajúcemu zneniu?",
  ])("%s", q => {
    expect(at(q).kind).toBe("compare")
  })
})

describe("detectQueryTime — nie je to čas", () => {
  it.each([
    "Kto zvoláva konferenciu SFZ?",
    "Čo hovorí Smernica 2026 o cestovných náhradách?",
    "Aký je trest podľa § 2019?",
    "Koľko je odstupné za hráča od 20 rokov z 3. ligy?",
    "Čo hovorí čl. 12 ods. 3?",
    "Ako prebieha zmena klubu hráča?",
    "Kedy majú kluby 5 dní na odvolanie?",
    "Súťaž U19 junior 2020 – kto rozhoduje?",
  ])("%s", q => {
    expect(at(q)).toEqual(todayTime(NOW))
  })
})

describe("model ako záloha", () => {
  it("platný dátum od modelu", () => {
    expect(parseModelTime({ kind: "asOf", date: "2021-05-01" }, NOW)).toEqual({ kind: "asOf", asOf: "2021-05-01", source: "model" })
  })
  it.each([
    [{ kind: "asOf", date: "2021-02-30" }],
    [{ kind: "asOf", date: "neviem" }],
    [{ kind: "asOf" }],
    [{ kind: "today" }],
    [null],
    ["2021-05-01"],
  ])("nezmysel sa zahodí: %j", raw => {
    expect(parseModelTime(raw, NOW)).toBeNull()
  })

  it("pravidlá majú prednosť pred modelom", () => {
    const rules = at("Trest k 1. 1. 2020?")
    expect(resolveQueryTime(rules, { kind: "asOf", asOf: "2019-01-01", source: "model" }, NOW)).toBe(rules)
  })
  it("model doplní, čo pravidlá nenašli", () => {
    const model = { kind: "asOf" as const, asOf: "2021-05-01", source: "model" as const }
    expect(resolveQueryTime(at("Ako to bolo pred poslednou novelou stanov?"), model, NOW)).toBe(model)
  })
  it("bez oboch je to dnešok", () => {
    expect(resolveQueryTime(at("Kto zvoláva konferenciu?"), null, NOW)).toEqual(todayTime(NOW))
  })
})

describe("searchInstant", () => {
  it("pri inom dni poludnie UTC toho dňa, pri dnešku teraz", () => {
    expect(searchInstant({ kind: "asOf", asOf: "2020-01-01", source: "rules" }, NOW).toISOString()).toBe("2020-01-01T12:00:00.000Z")
    expect(searchInstant(todayTime(NOW), NOW)).toBe(NOW)
    expect(searchInstant({ kind: "compare", asOf: "2026-09-29", source: "rules" }, NOW)).toBe(NOW)
  })
})

describe("prepis modelom nesie čas", () => {
  it("platný dátum sa prevezme, nezmysel nie", () => {
    const ok = parsePreprocessed('{"rewritten":"x","subQueries":[],"keywords":[],"time":{"kind":"asOf","date":"2021-05-01"}}', "x", NOW)
    expect(ok.time).toEqual({ kind: "asOf", asOf: "2021-05-01", source: "model" })
    const bad = parsePreprocessed('{"rewritten":"x","time":{"kind":"asOf","date":"včera"}}', "x", NOW)
    expect(bad.time).toBeNull()
    const none = parsePreprocessed('{"rewritten":"x"}', "x", NOW)
    expect(none.time).toBeNull()
  })
})

describe("sanitizeQueryTime — telo požiadavky na hodnotenie", () => {
  it("platný tvar prejde, cudzí nie", () => {
    expect(sanitizeQueryTime({ kind: "asOf", asOf: "2020-01-01", source: "rules" })).toEqual({ kind: "asOf", asOf: "2020-01-01", source: "rules" })
    expect(sanitizeQueryTime({ kind: "asOf", asOf: "2020-01-01", source: "rules", $where: "x" })).toEqual({ kind: "asOf", asOf: "2020-01-01", source: "rules" })
    expect(sanitizeQueryTime({ kind: "hack", asOf: "2020-01-01", source: "rules" })).toBeUndefined()
    expect(sanitizeQueryTime({ kind: "asOf", asOf: { $gt: "" }, source: "rules" })).toBeUndefined()
    expect(sanitizeQueryTime("2020-01-01")).toBeUndefined()
  })
})

describe("withoutTimePhrase — dátum nie je obsah otázky", () => {
  it.each([
    ["Kto zvolával konferenciu SFZ k 1. 1. 2020?", "Kto zvolával konferenciu SFZ?"],
    ["Kto zvolával konferenciu 1. júla 2016?", "Kto zvolával konferenciu?"],
    ["Ako sa volil prezident v roku 2019?", "Ako sa volil prezident?"],
    ["What was the penalty on July 1, 2019?", "What was the penalty?"],
    ["Aké bolo odstupné vlani?", "Aké bolo odstupné?"],
    ["Trest ku dňu 2020-03-15 za žlté karty", "Trest za žlté karty"],
  ])("%s → %s", (q, expected) => {
    expect(withoutTimePhrase(q)).toBe(expected)
  })

  it.each([
    "Čo hovorí čl. 12 odseku 2020?",
    "Čo hovorí Smernica 2026?",
    "Kto zvoláva konferenciu SFZ?",
  ])("bez časového údaja sa nemení: %s", q => {
    expect(withoutTimePhrase(q)).toBe(q)
  })

  it("klasifikátor potom nepošle otázku s dátumom do fulltextu", async () => {
    const { classifyByHeuristic } = await import("../src/lib/queryClassifier")
    expect(classifyByHeuristic("Kto zvolával konferenciu SFZ k 1. 1. 2020?")).toBe("fulltext")
    expect(classifyByHeuristic(withoutTimePhrase("Kto zvolával konferenciu SFZ k 1. 1. 2020?"))).not.toBe("fulltext")
  })
})

describe("porovnanie s dátumom (krok 7)", () => {
  it.each([
    ["Čo sa zmenilo od roku 2020 v stanovách?", "2020-01-01"],
    ["Čo sa zmenilo v stanovách od 1. 7. 2024?", "2024-07-01"],
  ])("%s → since %s", (q, since) => {
    expect(at(q)).toEqual({ kind: "compare", asOf: "2026-09-29", source: "rules", since })
  })
  it("bez dátumu since nie je", () => {
    expect(at("Čo sa zmenilo v stanovách?")).not.toHaveProperty("since")
  })
})
