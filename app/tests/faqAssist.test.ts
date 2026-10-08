import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/faq", () => ({ MAX_ANSWER: 6000, MAX_SOURCES: 5 }))

import { parseAssist, applyAssist, parseConnectorSource, connectorSource, excerptOf, LIBRARY_SOURCE, INSERT_MAX } from "../src/lib/faqAssist"

describe("pomocník pri zázname FAQ (faqAssist)", () => {
  it("prvé otvorenie: predvolene len knižnica, prázdny záznam", () => {
    const s = parseAssist({})
    expect(s.sources).toEqual([LIBRARY_SOURCE])
    expect(s.query).toBe("")
    expect(s.draft).toEqual({ question: "", variants: "", answer: "", audience: "", sources: [] })
  })

  it("po hľadaní platí presne to, čo bolo zaškrtnuté — aj nič", () => {
    expect(parseAssist({ q: "transfer", src: ["c:abc:issf"] }).sources).toEqual(["c:abc:issf"])
    expect(parseAssist({ q: "transfer" }).sources).toEqual([])
  })

  it("rozpísaný záznam prejde adresou aj so zdrojmi; prázdne riadky zdrojov sa vynechajú", () => {
    const s = parseAssist({
      q: "x", question: "Otázka?", answer: "Odpoveď", audience: "rozhodca",
      sourceDocument: ["sfz:rapp", "", "sfz:stanovy"], sourceArticle: ["12", "", ""],
    })
    expect(s.draft.question).toBe("Otázka?")
    expect(s.draft.sources).toEqual([{ documentId: "sfz:rapp", articleRef: "12" }, { documentId: "sfz:stanovy", articleRef: "" }])
  })

  it("Použiť ako zdroj pridá dokument a článok raz", () => {
    const s = parseAssist({ q: "x", use: "sfz:rapp|12", sourceDocument: "sfz:rapp", sourceArticle: "12" })
    expect(s.draft.sources).toEqual([{ documentId: "sfz:rapp", articleRef: "12" }])
    const t = parseAssist({ q: "x", use: "sfz:rapp|14", sourceDocument: "sfz:rapp", sourceArticle: "12" })
    expect(t.draft.sources).toHaveLength(2)
  })

  it("najviac päť zdrojov", () => {
    const docs = ["a", "b", "c", "d", "e"]
    const s = parseAssist({ q: "x", use: "f|", sourceDocument: docs, sourceArticle: docs.map(() => "") })
    expect(s.draft.sources.map(x => x.documentId)).toEqual(docs)
  })

  it("Vložiť do odpovede pripojí text za rozpísanú odpoveď a oreže ho", () => {
    expect(parseAssist({ q: "x", insert: "Nový text" }).draft.answer).toBe("Nový text")
    expect(parseAssist({ q: "x", answer: "Prvá veta.", insert: "Druhá." }).draft.answer).toBe("Prvá veta.\n\nDruhá.")
    expect(parseAssist({ q: "x", insert: "a".repeat(5000) }).draft.answer).toHaveLength(INSERT_MAX)
  })

  it("applyAssist bez akcie nič nemení", () => {
    const s = parseAssist({ q: "x", answer: "A" })
    expect(applyAssist(s, {})).toEqual(s)
  })

  it("hodnota prepínača konektora tam aj späť", () => {
    expect(parseConnectorSource(connectorSource("f3b2", "issf"))).toEqual({ connectorId: "f3b2", scopeKey: "issf" })
    expect(parseConnectorSource(LIBRARY_SOURCE)).toBeNull()
  })

  it("úryvok bez opakovaných medzier a s výpustkou", () => {
    expect(excerptOf("a  b\n\n\n\nc")).toBe("a b\n\nc")
    expect(excerptOf("x".repeat(20), 10)).toBe(`${"x".repeat(10)} …`)
  })
})

import { filterEntries, foldText } from "../src/lib/faqAssist"

describe("hľadanie v záznamoch FAQ (filterEntries)", () => {
  const e = (question: string, answer = "", variants: string[] = [], audience: string[] = []) => ({ question, answer, variants, audience })
  const list = [
    e("Dá sa v jednom registračnom období schváliť viac transferov?", "Iba jeden transfér…", ["Dva transfery"]),
    e("Ako obnoviť heslo k ISSF kontu?", "Zabudli ste heslo?", [], ["rozhodca"]),
    e("Kam poslať registračný formulár?", "Trnavská cesta 100"),
  ]
  it("bez textu všetky v pôvodnom poradí", () => {
    expect(filterEntries(list, "  ").map(x => x.index)).toEqual([0, 1, 2])
  })
  it("bez diakritiky a veľkých písmen, každé slovo musí sedieť, číslo záznamu ostane", () => {
    expect(filterEntries(list, "REGISTRACN").map(x => x.index)).toEqual([0, 2])
    expect(filterEntries(list, "registračný formulár").map(x => x.index)).toEqual([2])
    expect(filterEntries(list, "rozhodca").map(x => x.index)).toEqual([1])
    expect(filterEntries(list, "dva transfery").map(x => x.index)).toEqual([0])
    expect(filterEntries(list, "nič také")).toEqual([])
  })
  it("foldText", () => { expect(foldText("Žiadosť ÚČET")).toBe("ziadost ucet") })
})
