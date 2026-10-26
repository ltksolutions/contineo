/**
 * lawCatalog.test.ts — katalóg legislatívy (ADR-039): čisté funkcie bez
 * databázy a siete, filter hľadania proti definícii indexu, rez ukážky
 * zákona na § s kotvou na portáli.
 */

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { anchorFor, citationUrl, versionKeyOf, effectiveVersions, versionToShow, lawAllowed, SLOV_LEX_SOURCE_ID, SUGGESTED_ACTS } from "../src/lib/lawCatalog"
import { lawChunkToResult, lawVectorFilter, lawSearchFilterClauses } from "../src/lib/lawSearch"
import { parseVersion, parseActRef } from "../src/lib/slovLex"
import { cutForIndex } from "../src/lib/chunkCut"
import { scopeFromQuery, defaultScope } from "../src/lib/askScope"
import { LAW_FILTER_PATHS, LAW_TEXT_DEFINITION, lawVectorDefinition } from "../scripts/lib/searchIndexes.mjs"

const ref = { year: 2015, number: 440 }

describe("kotva paragrafu a adresa citácie (D259)", () => {
  it("§ s číslom aj písmenom; článok, príloha a poznámky kotvu nemajú", () => {
    expect(anchorFor("§ 58")).toBe("paragraf-58")
    expect(anchorFor("§ 58a")).toBe("paragraf-58a")
    expect(anchorFor("§58")).toBe("paragraf-58")
    expect(anchorFor("Čl. II")).toBeNull()
    expect(anchorFor("Príloha č. 1")).toBeNull()
    expect(anchorFor(null)).toBeNull()
  })
  it("vedie na znenie na hlavnom portáli s kotvou", () => {
    expect(citationUrl(ref, "20260101", "§ 58")).toBe("https://www.slov-lex.sk/pravne-predpisy/SK/ZZ/2015/440/20260101#paragraf-58")
    expect(citationUrl(ref, "20260101", "Čl. II")).toBe("https://www.slov-lex.sk/pravne-predpisy/SK/ZZ/2015/440/20260101")
  })
  it("kľúč znenia", () => {
    expect(versionKeyOf("SK/ZZ/2015/440", "20260101")).toBe("SK/ZZ/2015/440@20260101")
  })
})

describe("znenie účinné v deň otázky (D258)", () => {
  const v = (actId: string, timepoint: string, from: string, to: string | null) =>
    ({ actId, timepoint, effectiveFrom: new Date(from), effectiveTo: to ? new Date(to) : null })
  const versions = [
    v("A", "20160101", "2016-01-01", "2019-12-31"),
    v("A", "20200101", "2020-01-01", null),
    v("A", "20270101", "2027-01-01", null),
    v("B", "20180501", "2018-05-01", null),
  ]
  it("jedno na predpis: posledné, ktorého účinnosť nastala a neskončila", () => {
    const got = effectiveVersions(versions, new Date("2026-10-25"))
    expect(got.map(x => x.timepoint).sort()).toEqual(["20180501", "20200101"])
  })
  it("otázka k minulosti dostane vtedajšie znenie; k budúcnosti to vyhlásené vopred", () => {
    expect(effectiveVersions(versions, new Date("2017-06-01")).find(x => x.actId === "A")?.timepoint).toBe("20160101")
    expect(effectiveVersions(versions, new Date("2027-03-01")).find(x => x.actId === "A")?.timepoint).toBe("20270101")
  })
  it("pred prvým znením nič", () => {
    expect(effectiveVersions(versions, new Date("2015-01-01"))).toEqual([])
  })
})

describe("rezidencia (D257)", () => {
  it("on-prem a air-gap katalóg nečítajú, ostatné áno", () => {
    expect(lawAllowed("on-prem")).toBe(false)
    expect(lawAllowed("air-gap")).toBe(false)
    expect(lawAllowed("eu-full")).toBe(true)
    expect(lawAllowed(undefined)).toBe(true)
  })
})

describe("filter hľadania sedí na definíciu indexu", () => {
  it("každé pole filtra je v oboch indexoch katalógu", () => {
    const keys = ["SK/ZZ/2015/440@20260101"]
    const vectorPaths = Object.keys(lawVectorFilter(keys))
    const searchPaths = lawSearchFilterClauses(keys).map(c => (c.equals?.path ?? c.in?.path) as string)
    const indexFilters = lawVectorDefinition("voyage-4", "text").fields.filter((f: { type: string }) => f.type === "filter").map((f: { path: string }) => f.path)
    for (const p of [...vectorPaths, ...searchPaths]) {
      expect(LAW_FILTER_PATHS, p).toContain(p)
      expect(indexFilters, p).toContain(p)
      expect((LAW_TEXT_DEFINITION.mappings.fields as Record<string, unknown>)[p], p).toBeDefined()
    }
  })
})

describe("ukážka zákona: § ako úsek s kotvou", () => {
  const html = readFileSync(new URL("./fixtures/slov-lex-440-2015-20260101.html", import.meta.url), "utf8")
  const page = parseVersion(html, ref, "20260101")
  const cut = cutForIndex(page.markdown, page.title)
  it("rez zo štruktúry, paragrafy majú označenie „§ n“", () => {
    expect(cut.method).toBe("headings")
    const refs = cut.chunks.map(c => c.articleRef)
    expect(refs).toContain("§ 1")
    expect(refs).toContain("§ 2")
  })
  it("úsek pre odpoveď: zákon, verejný, odkaz na paragraf, kópia znenia", () => {
    const ch = cut.chunks.find(c => c.articleRef === "§ 2")!
    const r = lawChunkToResult(
      {
        versionKey: "SK/ZZ/2015/440@20260101", actId: "SK/ZZ/2015/440", timepoint: "20260101", chunkIndex: ch.chunkIndex,
        text: ch.text, heading: ch.heading, articleRef: ch.articleRef, chunkType: "clanok", sourceType: "law", language: "sk", accessLevel: "public",
        embeddingModel: "voyage-4", embeddingDim: 1024, embeddingProvider: "atlas-auto", embeddedAt: new Date(), chunkerVersion: 2, createdAt: new Date(),
        score: 0.5,
      },
      { actId: "SK/ZZ/2015/440", timepoint: "20260101", versionKey: "SK/ZZ/2015/440@20260101", effectiveFrom: new Date("2026-01-01"), effectiveTo: null, amendment: "354/2025 Z. z.", title: page.title },
    )
    expect(r.sourceType).toBe("law")
    expect(r.accessLevel).toBe("public")
    expect(r.documentId).toBe("law:SK/ZZ/2015/440")
    expect(r.document?.sourceUrl).toBe("https://www.slov-lex.sk/pravne-predpisy/SK/ZZ/2015/440/20260101#paragraf-2")
    expect(r.law).toEqual({ actId: "SK/ZZ/2015/440", number: "440/2015 Z. z.", timepoint: "20260101", url: r.document?.sourceUrl })
    expect(r.version).toEqual({ label: "novela 354/2025 Z. z.", effectiveFrom: new Date("2026-01-01"), effectiveTo: null })
    expect(r.embeddingModel).toBe("voyage-4")
  })
})

describe("zdroj „Legislatíva“ vo výbere zdrojov", () => {
  it("id `law` prejde rozsahom z adresy ako každý živý zdroj a predvoľba ho berie podľa nastavenia", () => {
    expect(scopeFromQuery("library,slov-lex", [SLOV_LEX_SOURCE_ID])).toEqual(["library", "slov-lex"])
    // Starý `?src=law` (do 25. 10.) sa prekladá na zdroj Slov-Lex (ADR-040 Dodatok 1).
    expect(scopeFromQuery("library,law", [SLOV_LEX_SOURCE_ID])).toEqual(["library", "slov-lex"])
    expect(defaultScope([{ id: SLOV_LEX_SOURCE_ID, defaultOn: true }])).toEqual(["library", "slov-lex"])
    expect(defaultScope([{ id: SLOV_LEX_SOURCE_ID, defaultOn: false }])).toEqual(["library"])
  })
  it("ponuka pre športovú organizáciu sú platné čísla predpisov", () => {
    for (const s of SUGGESTED_ACTS) expect(parseActRef(s.address), s.address).not.toBeNull()
  })
})

describe("versionToShow — znenie pre detail predpisu", () => {
  const v = (timepoint: string, from: string, to: string | null) => ({ actId: "SK/ZZ/2015/440", timepoint, effectiveFrom: new Date(from), effectiveTo: to ? new Date(to) : null })
  const versions = [v("20250701", "2025-07-01", "2026-01-01"), v("20260101", "2026-01-01", null), v("20270101", "2027-01-01", null)]
  const now = new Date("2026-10-26")

  it("bez parametra ukáže znenie účinné dnes", () => {
    expect(versionToShow(versions, undefined, now)?.timepoint).toBe("20260101")
  })
  it("vyžiadané znenie z adresy má prednosť", () => {
    expect(versionToShow(versions, "20250701", now)?.timepoint).toBe("20250701")
  })
  it("neznáme znenie v adrese padá na predvolené, nie na 404", () => {
    expect(versionToShow(versions, "19990101", now)?.timepoint).toBe("20260101")
  })
  it("predpis so znením len na neskôr ukáže najnovšie", () => {
    expect(versionToShow([versions[2]], undefined, now)?.timepoint).toBe("20270101")
  })
  it("bez znení je null", () => {
    expect(versionToShow([], undefined, now)).toBeNull()
  })
})
