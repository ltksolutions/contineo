/**
 * complianceCheck.test.ts — kontrola navrhov FAQ proti dokumentom (ADR-032, faza 1).
 *
 * Ciste casti: balik dokumentov v poradi zavaznosti (norma pred manualom,
 * koncept oznaceny), prevod odpovede modelu na vysledok s citaciami.
 */

import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))

import { buildPack, parseReview, reviewPrompt, categoryRank } from "../src/lib/complianceCheck"

const manual = { documentId: "m1", title: "Konto a prihlásenie", category: "manual", draftMarkdown: "# Konto\nPrihlasovacie meno nie je e-mail.", versions: [] }
const rapp = { documentId: "r1", title: "Registračný a prestupový poriadok SFZ", category: "norma", draftMarkdown: "koncept", versions: [{ versionId: "v1", label: "2026", isActive: true, markdown: "Čl. 15 ods. 11 — dva roky." }] }

describe("buildPack", () => {
  it("norma pred manualom, platne znenie pred konceptom, koncept oznaceny", () => {
    const pack = buildPack([manual, rapp, { documentId: "x", title: "Prázdny", category: "norma", versions: [] }])
    expect(pack.documents.map(d => [d.documentId, d.state])).toEqual([["r1", "valid"], ["m1", "draft"]])
    expect(pack.text.indexOf("Dokument 1: Registračný")).toBeLessThan(pack.text.indexOf("Dokument 2: Konto"))
    expect(pack.text).toContain("platné znenie 2026")
    expect(pack.text).toContain("KONCEPT")
    expect(pack.text).not.toContain("koncept\n") // platné znenie má prednosť pred konceptom toho istého dokumentu
    expect(categoryRank("zakon")).toBeLessThan(categoryRank("manual"))
  })
})

describe("parseReview", () => {
  const pack = buildPack([manual, rapp])
  const items = [
    { id: "p1", question: "Kedy sa môže hráč znova registrovať?", variants: [], answer: "Po šiestich mesiacoch." },
    { id: "p2", question: "Aké je prihlasovacie meno?", variants: ["login"], answer: "Registračné číslo." },
  ]
  it("rozchadza sa: navrhnute znenie a zdroje z citacii; suhlasi: bez navrhu; neznamy dokument sa zahodi", () => {
    const r = parseReview({ results: [
      { item: 1, verdict: "differs", citations: [{ doc: 1, ref: "čl. 15 ods. 11", quote: "dva roky" }, { doc: 9, ref: "x", quote: "y" }], question: "", answer: "Po dvoch rokoch v inom klube.", note: "RaPP čl. 15 ods. 11." },
      { item: 2, verdict: "agree", citations: [{ doc: 2, ref: "časť 4", quote: "nie je e-mail" }], question: "", answer: "", note: "" },
      { item: 7, verdict: "agree", citations: [], question: "", answer: "", note: "" },
    ] }, items, pack)
    expect(r.get("p1")).toMatchObject({
      verdict: "differs",
      proposed: { question: "Kedy sa môže hráč znova registrovať?", answer: "Po dvoch rokoch v inom klube.", sources: [{ documentId: "r1", articleRef: "čl. 15 ods. 11" }] },
    })
    expect(r.get("p1")!.citations).toHaveLength(1)
    expect(r.get("p2")).toMatchObject({ verdict: "agree", proposed: null })
    expect(r.size).toBe(2)
    expect(parseReview({ results: [{ item: 1, verdict: "zle", citations: [], question: "", answer: "", note: "" }] }, items, pack).size).toBe(0)
  })
  it("prompt cisluje navrhy a nesie ine znenia", () => {
    expect(reviewPrompt(items)).toContain("### Návrh 2\nOtázka: Aké je prihlasovacie meno?\nIné znenia: login")
  })
})
