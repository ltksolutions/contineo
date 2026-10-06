/**
 * faq.test.ts — FAQ ako druh dokumentu (ADR-028, D164).
 *
 * Co sa tu drzi: zaznam = jeden usek `qa` **bez `versionId`** (inak by ho
 * vetva platnych zneni nasla aj po expiracii), pristup je najprisnejsi
 * z urovne FAQ a zdrojov, `derivedFrom` nesie zdroje a nie samotne FAQ,
 * a rovnake zaznamy daju rovnaky odtlacok (idempotentne zverejnenie).
 */

import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))

import {
  checkEntry, faqMarkdown, faqChunkText, faqChunks, entriesFingerprint, entryAccessLevel, isFaqCategory, type FaqEntry,
} from "../src/lib/faq"
import { chunkingStrategyFor } from "../src/lib/codelists"

const now = new Date("2026-10-06T10:00:00Z")
const entry = (over: Partial<FaqEntry> = {}): FaqEntry => ({
  id: "e1", question: "Ako sa registruje hráč?", variants: ["Registrácia hráča", "Kde zaregistrujem hráča"],
  answer: "Cez ISSF, záložka Registrácie.\n\nŽiadosť schvaľuje matrika.",
  sources: [{ documentId: "sfz:registracny_poriadok", articleRef: "čl. 12" }], audience: ["klubový manažér"],
  createdAt: now, createdBy: "a@b.sk", updatedAt: now, updatedBy: "a@b.sk", ...over,
})
const ctx = {
  companyCode: "SFZ", documentId: "sfz:faq_kluby", versionId: "v1", scope: "company", language: "sk", tags: [],
  documentAccessLevel: "public", sourceLevels: new Map([["sfz:registracny_poriadok", ["public", "public"]]]),
  effectiveFrom: now, now,
}

describe("druh FAQ v ciselniku", () => {
  it("faq sa cleni po zaznamoch, vsetko ostatne po clankoch", () => {
    expect(chunkingStrategyFor("faq")).toBe("entries")
    expect(isFaqCategory("faq")).toBe(true)
    expect(chunkingStrategyFor("norma")).toBe("articles")
    expect(chunkingStrategyFor(undefined)).toBe("articles")
    expect(chunkingStrategyFor("vlastny_druh")).toBe("articles")
  })
})

describe("checkEntry", () => {
  it("oreze, odstrani duplicity a variant zhodny s otazkou", () => {
    const e = checkEntry({
      question: "  Ako  sa registruje hráč? ", variants: "Ako sa registruje hráč?\nRegistrácia\n\nRegistrácia",
      answer: "Odpoveď.\r\n", sources: [{ documentId: " SFZ:RP ", articleRef: "" }, { documentId: "sfz:rp" }, { documentId: "" }],
      audience: "klubový manažér, , rozhodca",
    })
    expect(e.question).toBe("Ako sa registruje hráč?")
    expect(e.variants).toEqual(["Registrácia"])
    expect(e.answer).toBe("Odpoveď.")
    expect(e.sources).toEqual([{ documentId: "sfz:rp", articleRef: null }])
    expect(e.audience).toEqual(["klubový manažér", "rozhodca"])
  })
  it("otazka aj odpoved su povinne", () => {
    expect(() => checkEntry({ question: "", answer: "x" })).toThrow(/Otázka/)
    expect(() => checkEntry({ question: "x", answer: " " })).toThrow(/Odpoveď/)
  })
})

describe("faqChunks", () => {
  it("jeden zaznam = jeden usek qa s faqVersionId a bez versionId", () => {
    const [c] = faqChunks([entry()], ctx)
    expect(c.sourceType).toBe("qa")
    expect(c.chunkType).toBe("qa")
    expect(c.faqVersionId).toBe("v1")
    expect(c.faqEntryId).toBe("e1")
    expect("versionId" in c).toBe(false)
    expect(c.documentId).toBe("sfz:faq_kluby")
    expect(c.isActive).toBe(true)
    expect(c.heading).toBe("Ako sa registruje hráč?")
    expect(String(c.text)).toContain("Otázka: Ako sa registruje hráč?")
    expect(String(c.text)).toContain("Registrácia hráča | Kde zaregistrujem hráča")
    expect(String(c.text)).toContain("Odpoveď: Cez ISSF")
  })
  it("derivedFrom su zdroje, nie samotne FAQ", () => {
    const [c] = faqChunks([entry({ sources: [{ documentId: "sfz:faq_kluby", articleRef: null }, { documentId: "sfz:rp", articleRef: null }] })], ctx)
    expect(c.derivedFrom).toEqual(["sfz:rp"])
  })
  it("pristup je najprisnejsi z FAQ a zdrojov; zdroj bez usekov zatvara", () => {
    expect(entryAccessLevel(entry(), ctx)).toBe("public")
    expect(entryAccessLevel(entry(), { ...ctx, documentAccessLevel: "internal" })).toBe("internal")
    expect(entryAccessLevel(entry(), { ...ctx, sourceLevels: new Map([["sfz:registracny_poriadok", ["public", "internal"]]]) })).toBe("internal")
    expect(entryAccessLevel(entry({ sources: [{ documentId: "sfz:nezverejneny", articleRef: null }] }), ctx)).toBe("internal")
    // Bez zdroja rozhoduje uroven dokumentu — v tom sa FAQ lisi od paru.
    expect(entryAccessLevel(entry({ sources: [] }), ctx)).toBe("public")
    expect(entryAccessLevel(entry({ sources: [] }), { ...ctx, documentAccessLevel: "internal" })).toBe("internal")
  })
  it("rovnake zaznamy daju rovnaky odtlacok, zmena odpovede iny", () => {
    const a = entriesFingerprint([entry()])
    expect(entriesFingerprint([entry({ updatedAt: new Date(0) })])).toBe(a)
    expect(entriesFingerprint([entry({ answer: "Inak." })])).not.toBe(a)
    expect(faqChunks([entry()], ctx)[0].chunkingId).toBe(a)
  })
})

describe("faqMarkdown", () => {
  it("cisluje zaznamy, uvadza nazov zdroja z kopie a prazdne FAQ ma vetu", () => {
    const md = faqMarkdown("FAQ pre kluby", [entry()], "sk", new Map([["sfz:registracny_poriadok", "Registračný poriadok"]]))
    expect(md).toContain("# FAQ pre kluby")
    expect(md).toContain("## 1. Ako sa registruje hráč?")
    expect(md).toContain("Registračný poriadok (čl. 12)")
    expect(md).toContain("klubový manažér")
    expect(faqMarkdown("FAQ", [], "sk", new Map())).toContain("Zatiaľ bez záznamov.")
    expect(faqChunkText(entry(), "en")).toContain("Question:")
  })
})
