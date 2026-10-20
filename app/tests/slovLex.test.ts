/**
 * slovLex.test.ts — čítanie Slov-Lexu (ADR-037): identita predpisu
 * z adresy, história znení a prevod HTML znenia na Markdown.
 *
 * Ukážka `fixtures/slov-lex-440-2015-20260101.html` je skrátená stránka
 * statického portálu so skutočným značkovaním (20. 10. 2026). Keď portál
 * značkovanie zmení, tieto testy to nepovedia — povie to prevod v prevádzke,
 * ktorý pri chýbajúcom koreni zlyhá nahlas.
 */
import { readFileSync } from "node:fs"
import { describe, it, expect } from "vitest"
import {
  parseActRef, actId, historyUrl, versionUrl, pdfUrl, parseHistory, effectiveRow, newerRows, parseVersion, timepointDate, decodeEntities,
} from "../src/lib/slovLex"
import { splitBlocks, isUnitHeading } from "../src/lib/chunkBlocks"
import { headingBoundaries } from "../src/lib/chunkHeadings"

const html = readFileSync(new URL("./fixtures/slov-lex-440-2015-20260101.html", import.meta.url), "utf8")
const ref = { year: 2015, number: 440 }

describe("parseActRef", () => {
  it("adresa hlavného portálu, aj s časovou verziou", () => {
    expect(parseActRef("https://www.slov-lex.sk/pravne-predpisy/SK/ZZ/2015/440/")).toEqual(ref)
    expect(parseActRef("https://www.slov-lex.sk/ezbierky/pravne-predpisy/SK/ZZ/2015/440/20260101")).toEqual(ref)
  })
  it("statický portál, ELI, identifikátor z pôvodu a holé číslo", () => {
    expect(parseActRef("https://static.slov-lex.sk/static/SK/ZZ/2015/440/20260101.html")).toEqual(ref)
    expect(parseActRef("https://www.slov-lex.sk/eli/zz/2015/440")).toEqual(ref)
    expect(parseActRef("SK/ZZ/2015/440")).toEqual(ref)
    expect(parseActRef("440/2015 Z. z.")).toEqual(ref)
    expect(parseActRef(" 440/2015 ")).toEqual(ref)
  })
  it("čo nie je predpis, je null", () => {
    expect(parseActRef("https://www.slov-lex.sk/")).toBeNull()
    expect(parseActRef("zákon o športe")).toBeNull()
    expect(parseActRef("")).toBeNull()
  })
  it("adresy sa skladajú zo statického portálu; PDF bez predpony /static", () => {
    expect(actId(ref)).toBe("SK/ZZ/2015/440")
    expect(historyUrl(ref)).toBe("https://static.slov-lex.sk/static/SK/ZZ/2015/440/")
    expect(versionUrl(ref, "20260101")).toBe("https://static.slov-lex.sk/static/SK/ZZ/2015/440/20260101.html")
    expect(pdfUrl(ref, "20260101")).toBe("https://static.slov-lex.sk/pdf/SK/ZZ/2015/440/ZZ_2015_440_20260101.pdf")
    expect(timepointDate("20260101").toISOString()).toBe("2026-01-01T00:00:00.000Z")
  })
})

describe("parseHistory", () => {
  const rows = parseHistory(html)

  it("každé znenie s účinnosťou; vyhlásené znenie bez účinnosti sa vynechá", () => {
    expect(rows).toHaveLength(19)
    expect(rows[0]).toEqual({ timepoint: "20160101", effectiveFrom: "2016-01-01", effectiveTo: "2016-12-31", amendment: null })
    expect(rows[1]).toEqual({ timepoint: "20170101", effectiveFrom: "2017-01-01", effectiveTo: "2017-12-29", amendment: "354/2016 Z. z." })
    expect(rows[rows.length - 1]).toEqual({ timepoint: "20260101", effectiveFrom: "2026-01-01", effectiveTo: null, amendment: "104/2025 Z. z." })
  })

  it("znenie účinné v deň a znenia po časovej verzii — aj tie v budúcnosti", () => {
    expect(effectiveRow(rows, new Date("2025-10-20"))?.timepoint).toBe("20250701")
    expect(effectiveRow(rows, new Date("2026-10-20"))?.timepoint).toBe("20260101")
    expect(effectiveRow(rows, new Date("2015-12-31"))).toBeNull()
    expect(newerRows(rows, "20250701").map(r => r.timepoint)).toEqual(["20260101"])
    expect(newerRows(rows, "20260101")).toEqual([])
  })
})

describe("parseVersion", () => {
  const v = parseVersion(html, ref, "20260101")

  it("názov, účinnosť a záväzné PDF z hlavičky znenia", () => {
    expect(v.title).toBe("Zákon č. 440/2015 Z. z. o športe a o zmene a doplnení niektorých zákonov")
    expect(v.kind).toBe("Zákon")
    expect(v.effectiveFrom).toBe("2026-01-01")
    expect(v.pdfUrl).toBe("https://static.slov-lex.sk/pdf/SK/ZZ/2015/440/ZZ_2015_440_20260101.pdf")
  })

  it("štruktúra sú nadpisy podľa hĺbky, § je jednotka rezu", () => {
    const md = v.markdown
    expect(md.startsWith("# Zákon č. 440/2015 Z. z. o športe")).toBe(true)
    expect(md).toContain("\n## Čl. I\n")
    expect(md).toContain("\n### PRVÁ ČASŤ — VŠEOBECNÉ USTANOVENIA\n")
    expect(md).toContain("\n#### § 1 Predmet zákona\n")
    expect(md).toContain("\n#### § 2 Verejný záujem v športe\n")
    expect(md).toContain("\n## Čl. II\n")
    const blocks = splitBlocks(md)
    expect(blocks.filter(isUnitHeading).map(b => b.text)).toEqual(
      expect.arrayContaining(["#### § 1 Predmet zákona", "#### § 2 Verejný záujem v športe", "#### § 3 Vymedzenie pojmov"]),
    )
    expect(headingBoundaries(md)).not.toBeNull()
  })

  it("odsek, písmeno a bod sú odseky s označením; odkaz na poznámku ostáva v texte", () => {
    const md = v.markdown
    expect(md).toContain("\n(1) Verejným záujmom v športe je podpora a rozvoj športu mládeže")
    expect(md).toContain("\n(2) Plnenie úloh verejného záujmu v športe")
    expect(md).toContain("\nNa účely tohto zákona sa rozumie\n")
    expect(md).toContain("\na) športovou činnosťou vykonávanie, organizovanie")
    expect(md).toContain("organizácia,1) ktorá")
  })

  it("prílohy a poznámky pod čiarou sú vlastné časti; tabuľka je tabuľka", () => {
    const md = v.markdown
    expect(md).toContain("\n## Príloha č. 1 k zákonu č. 440/2015 Z. z.\n")
    expect(md).toContain("OLYMPIJSKÁ SYMBOLIKA SLOVENSKÉHO OLYMPIJSKÉHO A ŠPORTOVÉHO VÝBORU")
    expect(md).toContain("\n## Poznámky pod čiarou\n")
    expect(md).toContain("\n1) § 21 zákona č. 523/2004 Z. z. o rozpočtových pravidlách")
    expect(md).toMatch(/\n\| Ú \| K ?VVD\/ ?K ?VVM \|/)
  })

  it("v Markdowne nezostali značky, obal stránky ani história", () => {
    const md = v.markdown
    expect(md).not.toMatch(/<[a-z]+[\s>]/i)
    expect(md).not.toContain("Skupina")
    expect(md).not.toContain("História")
    expect(md).not.toContain("informatívny charakter")
    expect(md).not.toContain("&nbsp;")
  })

  it("bez koreňa predpisu zlyhá nahlas", () => {
    expect(() => parseVersion("<html><body><div id=\"content\">nič</div></body></html>", ref, "20260101")).toThrow(/predpisu/)
  })
})

describe("decodeEntities", () => {
  it("pomenované aj číselné entity", () => {
    expect(decodeEntities("354/2016&nbsp;Z.&nbsp;z. &amp; &#167; &#x41;")).toBe("354/2016\u00a0Z.\u00a0z. & § A")
    expect(decodeEntities("bez entít")).toBe("bez entít")
  })
})
