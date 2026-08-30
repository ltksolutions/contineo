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
import { urcTyp, preved, KonverziaError, NAZOV_TYPU } from "../src/lib/konverzia"

const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])
const pdf = Buffer.from("%PDF-1.7\n...")

describe("urcenie typu suboru", () => {
  it("PDF sa pozna podla obsahu, nie podla pripony", () => {
    // `content-type` posiela klient a pri docx byva podla systemu cokolvek.
    expect(urcTyp("nieco.txt", pdf)).toBe("pdf")
    expect(urcTyp("bez-pripony", pdf)).toBe("pdf")
  })

  it("docx a xlsx su oba ZIP, rozhodne pripona", () => {
    expect(urcTyp("norma.docx", zip)).toBe("docx")
    expect(urcTyp("sadzobnik.xlsx", zip)).toBe("xlsx")
  })

  it("ZIP s inou priponou sa odmietne s navodom", () => {
    expect(() => urcTyp("balik.zip", zip)).toThrow(KonverziaError)
    try { urcTyp("balik.zip", zip) } catch (e) {
      expect((e as Error).message).toMatch(/docx|xlsx/)
    }
  })

  it("stare .doc sa odmietne, nie tvari, ze rozumie", () => {
    expect(() => urcTyp("norma.doc", Buffer.from("\xd0\xcf\x11\xe0"))).toThrow(KonverziaError)
  })

  it("markdown a text prejdu bez prevodu", () => {
    expect(urcTyp("norma.md", Buffer.from("# Nadpis"))).toBe("markdown")
    expect(urcTyp("zoznam.csv", Buffer.from("a,b"))).toBe("text")
  })

  it("kazdy typ ma ludsky nazov do hlasky", () => {
    for (const t of ["markdown", "docx", "pdf", "xlsx", "text"] as const) {
      expect(NAZOV_TYPU[t]).toBeTruthy()
    }
  })
})

describe("prevod", () => {
  it("markdown sa nemeni", async () => {
    const r = await preved("norma.md", Buffer.from("# Článok 1\n\nText normy.\n"))
    expect(r.markdown).toBe("# Článok 1\n\nText normy.")
    expect(r.sposob).toBe("bez prevodu")
  })

  it("prazdny subor sa odmietne", async () => {
    await expect(preved("norma.md", Buffer.from("   \n\n  "))).rejects.toThrow(KonverziaError)
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

    const r = await preved("sadzobnik.xlsx", data)
    expect(r.typ).toBe("xlsx")
    expect(r.markdown).toContain("## Sadzobník")
    expect(r.markdown).toContain("| Kód | Názov |")
    expect(r.markdown).toContain("Prvý \\| s rúrou")
    // Upozornenie o hlavicke je sucast vysledku, nie ozdoba: prvy riadok
    // nemusi byt hlavicka a clovek to ma vidiet.
    expect(r.upozornenia.join(" ")).toMatch(/hlavičk/i)
  })
})
