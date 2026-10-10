/**
 * documentPdf.test.ts — PDF z Markdownu so šablónou organizácie (ADR-031).
 *
 * Bez databázy: päta z profilu organizácie (vynechanie prázdnych údajov),
 * nadpis z `# …`, deň namiesto okamihu a to, že ten istý text v ten istý
 * deň dá ten istý súbor — odtlačok znenia musí sedieť.
 */

import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/branding", () => ({ loadBrand: vi.fn(async () => null) }))

import { footerLines, markdownTitle, dayOf, renderDocumentPdf } from "../src/lib/documentPdf"
import type { Tenant } from "../src/lib/tenants"

const SFZ = {
  companyCode: "SFZ",
  branding: { displayName: "Slovenský futbalový zväz" },
  controller: {
    legalName: "Slovenský futbalový zväz",
    address: "Tomášikova 30C, 821 01 Bratislava",
    registrationNumber: "00687308",
    taxId: "2020898913",
    vatId: "SK2020898913",
  },
  contact: { web: "www.futbalsfz.sk", email: "helpdesk@futbalsfz.sk", phone: "+421 2 4820 6000" },
} as Pick<Tenant, "companyCode" | "branding" | "controller" | "contact">

describe("päta z profilu organizácie", () => {
  it("tri riadky: kto, čísla, ako sa ozvať", () => {
    expect(footerLines(SFZ, "sk")).toEqual([
      "Slovenský futbalový zväz · Tomášikova 30C, 821 01 Bratislava",
      "IČO 00687308 · DIČ 2020898913 · IČ DPH SK2020898913",
      "www.futbalsfz.sk · helpdesk@futbalsfz.sk · tel. +421 2 4820 6000",
    ])
  })

  it("prázdne údaje sa vynechajú; bez kontaktov ostane jeden riadok, bez právneho názvu názov portálu", () => {
    const bare = { branding: { displayName: "LTK" }, controller: { address: "Hlavná 1" } } as Pick<Tenant, "branding" | "controller" | "contact">
    expect(footerLines(bare, "sk")).toEqual(["LTK · Hlavná 1"])
  })

  it("texty päty sú v jazyku dokumentu", () => {
    expect(footerLines(SFZ, "en")[1]).toContain("Company ID 00687308")
  })
})

describe("nadpis a deň", () => {
  it("nadpis je prvé # v texte, inak náhradný", () => {
    expect(markdownTitle("úvod\n\n# ISSF-01 Konto\n\n## A", "x")).toBe("ISSF-01 Konto")
    expect(markdownTitle("bez nadpisu", "Náhradný")).toBe("Náhradný")
  })

  it("deň bez času", () => {
    expect(dayOf(new Date(2026, 9, 10, 17, 45)).toISOString()).toBe("2026-10-10T00:00:00.000Z")
  })
})

describe("PDF so šablónou", () => {
  const input = {
    tenant: SFZ, language: "sk" as const, title: "Náhradný",
    markdown: "# Manuál\n\n## Časť\n\nText odseku.\n\n- bod\n",
    createdOn: new Date(2026, 9, 10, 9),
  }

  it("ten istý text v ten istý deň dá ten istý súbor", async () => {
    const a = await renderDocumentPdf(input)
    const b = await renderDocumentPdf({ ...input, createdOn: new Date(2026, 9, 10, 18) })
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
    expect(Buffer.from(a).subarray(0, 5).toString()).toBe("%PDF-")
  })

  it("iný deň dá iný súbor — dátum vytvorenia je v päte", async () => {
    const a = await renderDocumentPdf(input)
    const b = await renderDocumentPdf({ ...input, createdOn: new Date(2026, 9, 11, 9) })
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
  })
})

describe("sadzba písma (ADR-031)", () => {
  it("„fi“ ostane dvoma glyfmi — bez ligatúry, ktorá v slove nechávala medzeru", async () => {
    const { PDFDocument } = await import("pdf-lib")
    const fontkit = (await import("@pdf-lib/fontkit")).default
    const { readFile } = await import("node:fs/promises")
    const path = await import("node:path")
    const { FONT_DIR, PDF_FONT_OPTIONS } = await import("../src/lib/certificatePdf")
    const doc = await PDFDocument.create()
    doc.registerFontkit(fontkit)
    const font = await doc.embedFont(await readFile(path.join(FONT_DIR, "NotoSans-Regular.ttf")), PDF_FONT_OPTIONS)
    // Jeden glyf = štyri hexadecimálne znaky.
    expect(font.encodeText("fi").asString().length).toBe(8)
    expect(font.encodeText("notifikácie").asString().length).toBe(4 * "notifikácie".length)
  })

  it("šípka, ktorú písmo nemá, sa nahradí „›“", async () => {
    const { printable, plainInline } = await import("../src/lib/markdownPdf")
    expect(printable("Faktúry → Položky")).toBe("Faktúry › Položky")
    expect(plainInline("**Menu** → Dokumenty")).toBe("Menu › Dokumenty")
  })
})

describe("názov dokumentu v hlavičke", () => {
  it("krátky v jednom riadku, dlhý na dva, čo sa nezmestí, skončí „…“", async () => {
    const { PDFDocument } = await import("pdf-lib")
    const fontkit = (await import("@pdf-lib/fontkit")).default
    const { readFile } = await import("node:fs/promises")
    const path = await import("node:path")
    const { FONT_DIR, PDF_FONT_OPTIONS } = await import("../src/lib/certificatePdf")
    const { headerTitleLines } = await import("../src/lib/markdownPdf")
    const doc = await PDFDocument.create()
    doc.registerFontkit(fontkit)
    const bold = await doc.embedFont(await readFile(path.join(FONT_DIR, "NotoSans-SemiBold.ttf")), PDF_FONT_OPTIONS)
    expect(headerTitleLines("ISSF-07 Faktúry", bold, 10.5, 250)).toEqual(["ISSF-07 Faktúry"])
    const two = headerTitleLines("ISSF-09 Kredity z prerozdelenia príspevkov a futbalnet.shop", bold, 10.5, 250)
    expect(two).toHaveLength(2)
    const long = headerTitleLines("Veľmi dlhý názov dokumentu, ktorý sa nezmestí ani do dvoch riadkov hlavičky, lebo má priveľa slov a ešte niečo navyše", bold, 10.5, 200)
    expect(long).toHaveLength(2)
    expect(long[1].endsWith("…")).toBe(true)
    for (const l of long) expect(bold.widthOfTextAtSize(l, 10.5)).toBeLessThanOrEqual(200)
  })
})
