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

import { buildPacks, splitText, mergeSteps, referenceAllowed, parseDocReview } from "../src/lib/complianceCheck"

describe("viac krokov a dokument proti dokumentom", () => {
  const big = (id: string, cat: string, n: number) => ({ documentId: id, title: id, category: cat, versions: [{ versionId: "v", isActive: true, markdown: Array.from({ length: n }, (_, i) => `Odsek ${i} ${"x".repeat(90)}`).join("\n\n") }] })
  it("vyber nad strop sa rozdeli na balicky, velky dokument na casti, norma pred manualom", () => {
    const packs = buildPacks([big("manual", "manual", 5), big("rapp", "norma", 60), big("sp", "norma", 5)], 3000)
    expect(packs.length).toBeGreaterThan(1)
    expect(packs.every(p => p.text.length <= 3000)).toBe(true)
    expect(packs[0].text).toContain("rapp (časť 1 z")
    expect(packs[packs.length - 1].documents.map(d => d.documentId)).toContain("manual")
    expect(splitText("a\n\nb", 100)).toEqual(["a\n\nb"])
  })
  it("zlucenie krokov: zmena prebije suhlas, nepokryva len ked nepokryva ziadny krok, navrh z posledneho meniaceho", () => {
    const c = (q: string) => ({ documentId: "r", title: "RaPP", articleRef: "čl. 15", quote: q })
    const m = mergeSteps([
      { verdict: "differs", citations: [c("dva roky")], proposed: { question: "Q", answer: "A1", sources: [] }, note: "krok 1" },
      { verdict: "agree", citations: [], proposed: null, note: "" },
      { verdict: "not_covered", citations: [], proposed: null, note: "" },
    ])!
    expect(m).toMatchObject({ verdict: "differs", proposed: { answer: "A1" }, note: "krok 1" })
    expect(mergeSteps([{ verdict: "not_covered", citations: [], proposed: null, note: "" }, { verdict: "agree", citations: [], proposed: null, note: "" }])!.verdict).toBe("agree")
  })
  it("pristup: verejny obsah len verejnymi, interny akymikolvek", () => {
    expect(referenceAllowed("public", "public")).toBe(true)
    expect(referenceAllowed("public", "internal")).toBe(false)
    expect(referenceAllowed("internal", "public")).toBe(true)
    expect(referenceAllowed("internal", "internal")).toBe(true)
  })
  it("nalezy dokumentu s citaciou z balika; bez platnej citacie sa zahodia", () => {
    const pack = buildPacks([big("rapp", "norma", 2)])[0]
    let n = 0
    const r = parseDocReview({ findings: [
      { kind: "conflict", location: "časť 5", quote: "web: 7 dní", citation: { doc: 1, ref: "čl. 18 ods. 8", quote: "do troch dní" }, recommendation: "Opraviť na 3 dni." },
      { kind: "missing", location: "x", quote: "", citation: { doc: 5, ref: "?", quote: "" }, recommendation: "" },
      { kind: "zle", location: "x", quote: "", citation: { doc: 1, ref: "", quote: "" }, recommendation: "" },
    ], summary: "Jeden rozpor." }, pack, () => `f${++n}`)
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0]).toMatchObject({ id: "f1", kind: "conflict", status: null, citation: { documentId: "rapp", articleRef: "čl. 18 ods. 8" } })
    expect(r.summary).toBe("Jeden rozpor.")
  })
})
