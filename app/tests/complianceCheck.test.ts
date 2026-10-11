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

import { buildPacks, splitText, mergeSteps, referenceAllowed, parseDocReview, replaceQuote, packWarm, markWarm, WARM_MS, currentWording, suggestOnCurrent, quotesOverlap, runTitle } from "../src/lib/complianceCheck"

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
  it("navrhnuté znenie nálezu sa prevezme; prázdne je null", () => {
    const pack = buildPacks([big("rapp", "norma", 2)])[0]
    const r = parseDocReview({ findings: [
      { kind: "conflict", location: "6.4", quote: "0,50 € mesačne", citation: { doc: 1, ref: "príloha 2", quote: "1 EUR" }, recommendation: "Ročne 1 €.", proposed: "1 € ročne" },
      { kind: "missing", location: "1", quote: "a", citation: { doc: 1, ref: "", quote: "" }, recommendation: "", proposed: "  " },
    ], summary: "" }, pack, () => "f")
    expect(r.findings.map(f => f.proposed)).toEqual(["1 € ročne", null])
  })
})

describe("nahradenie úryvku v koncepte (Ján 11. 10. 2026)", () => {
  const text = "# Poplatky\n\nPoplatok za správu konta: **0,50 €** mesačne.\n\nĎalší odsek."
  it("doslovná zhoda sa nahradí", () => {
    expect(replaceQuote(text, "Poplatok za správu konta: **0,50 €** mesačne.", "Poplatok: 1 € ročne.")).toBe("# Poplatky\n\nPoplatok: 1 € ročne.\n\nĎalší odsek.")
  })
  it("zlúčené medzery a riadky sa tolerujú", () => {
    expect(replaceQuote("Hráč príde\nosobne na matriku.", "Hráč príde osobne  na matriku.", "X")).toBe("X")
  })
  it("nenájdený alebo viacnásobný úryvok sa nenahrádza", () => {
    expect(replaceQuote(text, "neexistuje", "X")).toBeNull()
    expect(replaceQuote("a. b. a.", "a.", "X")).toBeNull()
    expect(replaceQuote(text, "  ", "X")).toBeNull()
  })
  it("špeciálne znaky v úryvku nie sú regulárny výraz", () => {
    expect(replaceQuote("Cena (spolu) 1+1 €", "Cena  (spolu) 1+1 €", "Y")).toBe("Y")
  })
})

describe("teplý balík v cache (11. 10. 2026)", () => {
  it("balík je teplý do 55 minút od posledného použitia", () => {
    const t0 = new Date("2026-10-11T10:00:00Z")
    const warm = markWarm([], 1, t0)
    expect(packWarm(warm, 1, t0.getTime() + WARM_MS - 1)).toBe(true)
    expect(packWarm(warm, 1, t0.getTime() + WARM_MS)).toBe(false)
    expect(packWarm(warm, 0, t0.getTime())).toBe(false)
  })
  it("nové použitie posunie čas, nezdvojí záznam", () => {
    const w = markWarm(markWarm([], 2, new Date(0)), 2, new Date(1000))
    expect(w).toEqual([{ step: 2, at: new Date(1000) }])
  })
})

describe("prekrývajúce sa nálezy na jednom mieste (11. 10. 2026)", () => {
  const base = { kind: "missing" as const, location: "4", citation: { documentId: "x", title: "X", articleRef: null, quote: "" }, recommendation: "" }
  const q = "- Klub sa dostane do stavu **„Neplatič\"** po uplynutí splatnosti faktúry."
  const g = { ...base, id: "f003", quote: q, status: "accepted" as const, applied: "draft" as const, acceptedText: `${q} Pokuta má športovo-technické dôsledky.` }
  const f = { ...base, id: "f010", quote: q, status: null, proposed: `${q} Odpočítajú sa tri body.` }
  it("aktuálne znenie z iného prijatého nálezu, keď pôvodný úryvok už v texte nie je", () => {
    const draft = `# 4\n\n${g.acceptedText}\n\n- Ďalší bod.`
    const cur = currentWording(draft, f, [g, f])
    expect(cur?.via.id).toBe("f003")
    expect(suggestOnCurrent(f, cur!.text)).toBe(`${g.acceptedText} Odpočítajú sa tri body.`)
  })
  it("pôvodný úryvok v texte je → bez prekrytia; nahradenie mimo doplnenia ostáva na človeku", () => {
    expect(currentWording(`# 4\n\n${q}`, f, [g, f])).toBeNull()
    const rewrite = { ...f, proposed: "- Úplne iná veta." }
    expect(suggestOnCurrent(rewrite, "aktuálne")).toBe("aktuálne")
  })
  it("úryvky sa porovnávajú bez Markdownu a medzier", () => {
    expect(quotesOverlap("**Tajomník komisie** priebežne sleduje podania", "Tajomník komisie  priebežne sleduje podania")).toBe(true)
    expect(quotesOverlap("Úplne iný odsek o niečom inom", "Tajomník komisie priebežne sleduje")).toBe(false)
  })
})

describe("dve doplnenia jednej vety a zmena rozhodnutia", () => {
  const base = { kind: "missing" as const, location: "4", citation: { documentId: "x", title: "X", articleRef: null, quote: "" }, recommendation: "" }
  const q = "- Klub je neplatič po splatnosti faktúry."
  const f003 = { ...base, id: "f003", quote: q, status: "accepted" as const, applied: "draft" as const, acceptedText: `${q} A1.` }
  const f010 = { ...base, id: "f010", quote: q, status: "accepted" as const, applied: "draft" as const, acceptedText: `${q} A2.` }
  const draft = `# 4\n\n${q} A2. A1.\n- Ďalší bod.`
  it("celý riadok so zapísaným znením, aj keď ho tvoria dve doplnenia", () => {
    expect(currentWording(draft, f003, [f003, f010])?.text).toBe(`${q} A2. A1.`)
  })
  it("zmena vlastného rozhodnutia nahrádza celý riadok", () => {
    expect(currentWording(draft, f003, [f003, f010], true)?.text).toBe(`${q} A2. A1.`)
    const lone = { ...f003, acceptedText: `${q} A1.` }
    expect(currentWording(`${q} A1.`, lone, [lone])).toBeNull()
    expect(currentWording(`${q} A1.`, lone, [lone], true)?.text).toBe(`${q} A1.`)
  })
})

describe("názov kontroly", () => {
  it("jeden riadok, najviac 120 znakov, prázdny ostane prázdny", () => {
    expect(runTitle("  Kontrola manuálov\nISSF  ")).toBe("Kontrola manuálov ISSF")
    expect(runTitle("x".repeat(200))).toHaveLength(120)
    expect(runTitle("   ")).toBe("")
  })
})
