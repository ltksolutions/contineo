/**
 * dpoCsv.test.ts — CSV výkazu právnych základov ukazuje všetky druhy
 * základu, nie len hlavný (ADR-017, D105).
 */
import { describe, it, expect, vi } from "vitest"

// `dpo.ts` načíta reláciu (Reactova `cache`), ktorá mimo servera nie je.
vi.mock("../src/lib/session", () => ({ currentTenant: vi.fn(), currentPerson: vi.fn() }))
import { legalBasisCsv } from "../src/lib/dpoCsv"
import { summarize, type LegalBasisRow } from "../src/lib/dpo"

const row = (title: string, legalBasis: LegalBasisRow["legalBasis"], categories: LegalBasisRow["categories"]): LegalBasisRow => ({
  documentId: title, title, versionId: "v1", versionLabel: "1.0", effectiveFrom: new Date("2026-09-01T00:00:00Z"),
  legalBasis, categories, basisLabel: null, reference: null, responsible: null, problems: legalBasis ? [] : ["noBasis"],
})

describe("legalBasisCsv", () => {
  const rows = [
    row("Kombinácia", "legal_obligation", ["legal_obligation", "legitimate_interest"]),
    row("Smernica", "legitimate_interest", ["legitimate_interest"]),
    row("Bez základu", null, []),
  ]
  const lines = legalBasisCsv(rows, "sk").trim().split(/\r?\n/)
  const col = (line: string, name: string) => line.split(";")[lines[0].split(";").indexOf(name)]

  it("stĺpec categories hneď za legalBasis", () => {
    const head = lines[0].split(";")
    expect(head.indexOf("categories")).toBe(head.indexOf("legalBasis") + 1)
  })
  it("kombinácia má oba druhy, hoci hlavný je zákonná povinnosť", () => {
    expect(col(lines[1], "legalBasis")).toBe("legal_obligation")
    expect(col(lines[1], "categories")).toBe("legal_obligation + legitimate_interest")
    expect(col(lines[3], "categories")).toBe("")
  })
  it("počet riadkov s oprávneným záujmom v CSV sedí s dlaždicou", () => {
    const inCsv = lines.slice(1).filter(l => col(l, "categories").includes("legitimate_interest")).length
    expect(inCsv).toBe(summarize(rows).legitimateInterest)
  })
})
