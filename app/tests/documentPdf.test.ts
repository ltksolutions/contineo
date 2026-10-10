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
    address: "Trnavská cesta 100, 821 01 Bratislava",
    registrationNumber: "00687308",
    taxId: "2020898913",
    vatId: "SK2020898913",
  },
  contact: { web: "www.futbalsfz.sk", email: "helpdesk@futbalsfz.sk", phone: "+421 2 4820 6000" },
} as Pick<Tenant, "companyCode" | "branding" | "controller" | "contact">

describe("päta z profilu organizácie", () => {
  it("tri riadky: kto, čísla, ako sa ozvať", () => {
    expect(footerLines(SFZ, "sk")).toEqual([
      "Slovenský futbalový zväz · Trnavská cesta 100, 821 01 Bratislava",
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
