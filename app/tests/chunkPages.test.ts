import { describe, expect, it } from "vitest"
import { chunkPageRanges } from "@/lib/chunkPages"
import { chunkPages, citedPage, documentPageHref, pageFromHash, pdfHref, pdfPageHref } from "@/lib/pageLink"

const layer = [
  { lines: ["Pravidlo 1 Hracia plocha", "Hracia plocha musí byť úplne prírodná alebo úplne umelá podľa pravidiel súťaže."], images: 0 },
  { lines: ["Rozmery ihriska sú pre medzinárodné zápasy dlhé najmenej sto metrov a široké sedemdesiat."], images: 1 },
  { lines: ["Pravidlo 2 Lopta", "Lopta je guľatá z vhodného materiálu a jej obvod je medzi šesťdesiatosem a sedemdesiat centimetrov."], images: 0 },
]
const markdown = [
  "## Pravidlo 1 Hracia plocha",
  "Hracia plocha musí byť úplne prírodná alebo úplne umelá podľa pravidiel súťaže.",
  "Rozmery ihriska sú pre medzinárodné zápasy dlhé najmenej sto metrov a široké sedemdesiat.",
  "## Pravidlo 2 Lopta",
  "Lopta je guľatá z vhodného materiálu a jej obvod je medzi šesťdesiatosem a sedemdesiat centimetrov.",
].join("\n\n")

describe("chunkPageRanges", () => {
  it("úsek cez dve strany a úsek na jednej", () => {
    const chunks = [
      "Pravidlá futbalu › Pravidlo 1\n\nHracia plocha musí byť úplne prírodná alebo úplne umelá podľa pravidiel súťaže.\n\nRozmery ihriska sú pre medzinárodné zápasy dlhé najmenej sto metrov a široké sedemdesiat.",
      "Pravidlá futbalu › Pravidlo 2\n\nLopta je guľatá z vhodného materiálu a jej obvod je medzi šesťdesiatosem a sedemdesiat centimetrov.",
    ]
    expect(chunkPageRanges(layer, markdown, chunks, "Pravidlá futbalu")).toEqual([{ from: 1, to: 2 }, { from: 3, to: 3 }])
  })

  it("úsek s opisom schémy vedie na stranu s obrázkom", () => {
    const pages = [
      { lines: ["Pravidlo 1 Hracia plocha", "Rohová zástavka musí byť vysoká najmenej jeden a pol metra so zaobleným koncom."], images: 0 },
      { lines: ["Rohové územie má polomer jeden meter od rohovej zástavky na hracej ploche."], images: 1 },
    ]
    const md = [
      "## Pravidlo 1 Hracia plocha",
      "Rohová zástavka musí byť vysoká najmenej jeden a pol metra so zaobleným koncom.",
      "*Obrázok v origináli: Schéma rohového územia so zástavkou a štvrťkruhom.*",
      "Rohové územie má polomer jeden meter od rohovej zástavky na hracej ploche.",
    ].join("\n\n")
    const chunk = md.split("\n\n").slice(1).join("\n\n")
    expect(chunkPageRanges(pages, md, [chunk])).toEqual([{ from: 1, to: 2, figure: 2 }])
  })

  it("úsek, ktorý v texte nie je, nemá strany", () => {
    expect(chunkPageRanges(layer, markdown, ["Celkom iný text, ktorý v dokumente vôbec nie je napísaný."])).toEqual([null])
  })

  it("bez textovej vrstvy (sken) nič", () => {
    expect(chunkPageRanges([], markdown, ["Lopta je guľatá"])).toEqual([null])
  })
})

describe("pageLink", () => {
  it("odkaz do portálu a na PDF nesú znenie a stranu", () => {
    expect(documentPageHref("sfz:a b", 12, "v1")).toBe("/documents/sfz%3Aa%20b?version=v1#page-12")
    expect(pdfHref("d", "v1")).toBe("/api/documents/d/pdf?version=v1")
    expect(pdfPageHref("d", 3, "v1")).toBe("/api/documents/d/pdf?version=v1#page=3")
    expect(documentPageHref("d", 1)).toBe("/documents/d#page-1")
  })

  it("citácia vedie na schému, inak na začiatok úseku", () => {
    expect(chunkPages({ pageFrom: 11, pageTo: 12, pageFigure: 12 })).toEqual({ from: 11, to: 12, figure: 12 })
    expect(citedPage({ from: 11, to: 12, figure: 12 })).toBe(12)
    expect(citedPage({ from: 11, to: 12 })).toBe(11)
    expect(chunkPages({})).toBeNull()
  })

  it("strana z kotvy", () => {
    expect(pageFromHash("#page-12")).toBe(12)
    expect(pageFromHash("#page-0")).toBeNull()
    expect(pageFromHash("#citation-2")).toBeNull()
    expect(pageFromHash("")).toBeNull()
  })
})
