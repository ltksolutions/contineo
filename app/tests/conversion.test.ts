/**
 * konverzia.test.ts — prevod nahratého súboru na Markdown (D53).
 *
 * Testuje sa `urcTyp()` a prevod xlsx: prvé rozhoduje o tom, čo sa vôbec
 * pustí dnu, druhé je jediný prevod, ktorého vstup vieme v teste vyrobiť bez
 * cudzieho súboru. Prevod PDF a docx sa overuje na skutočných dokumentoch —
 * test s napodobeninou by overil napodobeninu.
 */

import { describe, it, expect } from "vitest"
import * as XLSX from "xlsx"
import JSZip from "jszip"
import { detectFileType, convert, ConversionError, FILE_TYPE_LABEL, stripInlineImages } from "../src/lib/conversion"

const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])
const pdf = Buffer.from("%PDF-1.7\n...")

describe("urcenie typu suboru", () => {
  it("PDF sa pozna podla obsahu, nie podla pripony", () => {
    // `content-type` posiela klient a pri docx byva podla systemu cokolvek.
    expect(detectFileType("nieco.txt", pdf)).toBe("pdf")
    expect(detectFileType("bez-pripony", pdf)).toBe("pdf")
  })

  it("docx a xlsx su oba ZIP, rozhodne pripona", () => {
    expect(detectFileType("norma.docx", zip)).toBe("docx")
    expect(detectFileType("sadzobnik.xlsx", zip)).toBe("xlsx")
  })

  it("ZIP s inou priponou sa odmietne s navodom", () => {
    expect(() => detectFileType("balik.zip", zip)).toThrow(ConversionError)
    try { detectFileType("balik.zip", zip) } catch (e) {
      expect((e as Error).message).toMatch(/docx|xlsx/)
    }
  })

  it("stare .doc sa odmietne, nie tvari, ze rozumie", () => {
    expect(() => detectFileType("norma.doc", Buffer.from("\xd0\xcf\x11\xe0"))).toThrow(ConversionError)
  })

  it("markdown a text prejdu bez prevodu", () => {
    expect(detectFileType("norma.md", Buffer.from("# Nadpis"))).toBe("markdown")
    expect(detectFileType("zoznam.csv", Buffer.from("a,b"))).toBe("text")
  })

  it("kazdy typ ma ludsky nazov do hlasky", () => {
    for (const t of ["markdown", "docx", "pdf", "xlsx", "text"] as const) {
      expect(FILE_TYPE_LABEL[t]).toBeTruthy()
    }
  })
})

describe("prevod", () => {
  it("markdown sa nemeni", async () => {
    const r = await convert("norma.md", Buffer.from("# Článok 1\n\nText normy.\n"))
    expect(r.markdown).toBe("# Článok 1\n\nText normy.")
    expect(r.method).toBe("bez prevodu")
  })

  it("prazdny subor sa odmietne", async () => {
    await expect(convert("norma.md", Buffer.from("   \n\n  "))).rejects.toThrow(ConversionError)
  })

  it("xlsx sa prepise na tabulku a rura sa zaescapuje", async () => {
    // Neescapovana rura by rozbila tabulku a stlpce by sa posunuli.
    const ws = XLSX.utils.aoa_to_sheet([
      ["Kód", "Názov"],
      ["A1", "Prvý | s rúrou"],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Sadzobník")
    const data = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer

    const r = await convert("sadzobnik.xlsx", data)
    expect(r.type).toBe("xlsx")
    expect(r.markdown).toContain("## Sadzobník")
    expect(r.markdown).toContain("| Kód | Názov |")
    expect(r.markdown).toContain("Prvý \\| s rúrou")
    // Upozornenie o hlavicke je sucast vysledku, nie ozdoba: prvy riadok
    // nemusi byt hlavicka a clovek to ma vidiet.
    expect(r.warnings.join(" ")).toMatch(/hlavičk/i)
  })
})

/**
 * Najmenší .docx s jedným odstavcom a jedným obrázkom.
 *
 * `jszip` nie je naša priama závislosť — prináša ho `mammoth`, ktorý ním
 * .docx rozbaľuje. Keby ho raz prestal používať, spadne tento import
 * menovite, nie potichu.
 */
async function docxWithImage(image: Buffer): Promise<Buffer> {
  const zip = new JSZip()
  zip.file("[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file("_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file("word/_rels/document.xml.rels",
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>')
  zip.file("word/media/image1.png", image)
  zip.file("word/document.xml",
    '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>' +
    '<w:p><w:r><w:t>Článok 1 — text normy.</w:t></w:r></w:p>' +
    '<w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="Logo" descr="Logo zväzu"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic><pic:blipFill><a:blip r:embed="rImg"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>' +
    '</w:body></w:document>')
  return zip.generateAsync({ type: "nodebuffer" })
}

describe("obrázky sa do textu nevkladajú", () => {
  it("docx s obrázkom: text zostane, obrázok nie — ani ako base64", async () => {
    // 200 kB „obrázka" — dosť na to, aby bolo vidieť, keby sa vložil celý.
    const image = Buffer.alloc(200 * 1024, 7)
    const r = await convert("norma.docx", await docxWithImage(image))

    expect(r.markdown).toContain("Článok 1 — text normy.")
    expect(r.markdown).not.toContain("data:")
    expect(r.markdown.length).toBeLessThan(1000)
    expect(r.warnings.join(" ")).toMatch(/obrázky/)
  })

  it("stripInlineImages odstráni Markdown aj HTML obrázok s data: adresou", () => {
    const md = "Pred ![logo](data:image/png;base64,AAAA) po.\n<img alt=\"x\" src=\"data:image/emf;base64,BBBB\">koniec"
    const r = stripInlineImages(md)
    expect(r.removed).toBe(2)
    expect(r.markdown).toBe("Pred  po.\nkoniec")
  })

  it("obrázok s obyčajnou adresou nechá tak — to nie je náklad, ale odkaz", () => {
    const md = "![schéma](https://example.org/schema.png)"
    expect(stripInlineImages(md)).toEqual({ markdown: md, removed: 0 })
  })
})
