/**
 * draftPreparing.test.ts — koncept po „Opraviť text" nie je príprava nového
 * znenia (ISSF-00 a ISSF-05, 24. 10. 2026).
 */
import { describe, it, expect, vi } from "vitest"
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))
import { isPreparingDraft } from "../src/lib/libraryRead"
import { textFingerprint } from "../src/lib/chunkIdentity"

const text = "# Manuál\nOpravený text."
const version = { versionId: "v-old-identity", isActive: true, pdf: { id: "pdf-v" }, contentHash: textFingerprint(text) }

describe("isPreparingDraft", () => {
  it("koncept s textom opraveného znenia a bez vlastného PDF nie je príprava", () => {
    expect(isPreparingDraft({ documentId: "d", draftMarkdown: text, versions: [version] }, "iná-identita")).toBe(false)
  })
  it("iný text je príprava nového znenia", () => {
    expect(isPreparingDraft({ documentId: "d", draftMarkdown: "# Manuál\nNovela.", versions: [version] }, "x")).toBe(true)
  })
  it("ten istý text s vlastným novým PDF je nové znenie (ADR-011)", () => {
    expect(isPreparingDraft({ documentId: "d", draftMarkdown: text, draftPdf: { id: "pdf-nove" }, versions: [version] }, "x")).toBe(true)
  })
  it("koncept so zmeneným názvom je príprava (ADR-015)", () => {
    expect(isPreparingDraft({ documentId: "d", draftMarkdown: text, draftTitle: "Nový názov", versions: [version] }, "x")).toBe(true)
  })
  it("identita znenia aj samotné PDF znenia ostávajú ako doteraz", () => {
    expect(isPreparingDraft({ documentId: "d", draftMarkdown: "x", versions: [version] }, "v-old-identity")).toBe(false)
    expect(isPreparingDraft({ documentId: "d", draftPdf: { id: "pdf-v" }, versions: [version] }, "y")).toBe(false)
  })
  it("PDF vyrobené z textu opraveného znenia nové znenie nerobí", () => {
    expect(isPreparingDraft({ documentId: "d", draftMarkdown: text, draftPdf: { id: "pdf-z-textu", generatedFromMarkdown: true }, versions: [version] }, "x")).toBe(false)
  })
})
