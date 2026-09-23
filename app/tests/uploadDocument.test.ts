/**
 * uploadDocument.test.ts — nahratie znenia podľa ADR-011: povinné PDF,
 * odporúčaný upraviteľný zdroj, identita konceptu z PDF aj textu.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const docs = vi.hoisted(() => ({
  findOne: vi.fn(async () => null as unknown),
  updateOne: vi.fn(async () => ({ matchedCount: 1 })),
}))
vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async () => docs),
  getDb: vi.fn(),
  getClient: vi.fn(),
}))

const store = vi.hoisted(() => {
  let n = 0
  return {
    saveFile: vi.fn(async (_c: string, name: string, _t: string, data: Buffer) => ({
      id: `f${++n}`, name, contentType: "application/octet-stream", bajtov: data.byteLength,
      sha256: `sha-of-${name}`, uploadedAt: new Date(),
    })),
    deleteFile: vi.fn(async () => {}),
    fileInfo: vi.fn(async () => null as unknown),
    loadFile: vi.fn(async () => null as unknown),
    reset: () => { n = 0 },
  }
})
vi.mock("../src/lib/fileStore", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/fileStore")>()),
  saveFile: store.saveFile, deleteFile: store.deleteFile, fileInfo: store.fileInfo, loadFile: store.loadFile,
}))

const conv = vi.hoisted(() => ({ convert: vi.fn() }))
vi.mock("../src/lib/conversion", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/conversion")>()),
  convert: conv.convert,
}))

vi.mock("../src/lib/audit", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/audit")>()),
  writeAudit: vi.fn(async () => {}),
}))

import { uploadDocument, LibraryError } from "../src/lib/libraryWrite"
import { draftIdentity, textFingerprint } from "../src/lib/chunkIdentity"

const META = {
  title: "Pracovný poriadok SFZ", documentKey: "pracovny_poriadok", sectionKey: "",
  companyCode: "SFZ", scope: "company", accessLevel: "internal", language: "sk", tags: [],
}
const PDF = { name: "Pracovný poriadok.pdf", data: Buffer.from("%PDF-1.7 obsah") }
const DOCX = { name: "Pracovný poriadok.docx", data: Buffer.from("PK\u0003\u0004 obsah") }

function written(): Record<string, unknown> {
  const call = docs.updateOne.mock.calls[0] as unknown as [unknown, { $set: Record<string, unknown> }]
  return call[1].$set
}

beforeEach(() => {
  vi.clearAllMocks()
  store.reset()
  docs.findOne.mockResolvedValue(null)
  conv.convert.mockImplementation(async (name: string) => ({
    type: name.endsWith(".pdf") ? "pdf" : "docx", markdown: `# Text z ${name}`, method: "m", warnings: [],
  }))
})

describe("uploadDocument — PDF a zdroj (ADR-011)", () => {
  it("PDF + docx: text zo zdroja, oba súbory pri koncepte s odtlačkom", async () => {
    await uploadDocument(META, { pdf: PDF, source: DOCX }, "jan@sfz.sk", "new")

    expect(conv.convert).toHaveBeenCalledWith(DOCX.name, DOCX.data)
    const set = written()
    expect(set.draftMarkdown).toBe(`# Text z ${DOCX.name}`)
    expect(set.draftPdf).toMatchObject({ id: "f1", name: PDF.name, sha256: `sha-of-${PDF.name}`, type: "pdf" })
    expect(set.draftSource).toMatchObject({ id: "f2", name: DOCX.name, type: "docx" })
    // Editor ukazuje súbor, z ktorého vznikol text.
    expect(set.originalFile).toMatchObject({ id: "f2", name: DOCX.name })
  })

  it("len PDF: text z PDF, zdroj prázdny", async () => {
    await uploadDocument(META, { pdf: PDF }, "jan@sfz.sk", "new")
    expect(conv.convert).toHaveBeenCalledWith(PDF.name, PDF.data)
    expect(written().draftSource).toBeNull()
  })

  it("namiesto PDF prišiel docx — odmietne sa a nič v úložisku nezostane", async () => {
    await expect(uploadDocument(META, { pdf: DOCX }, "jan@sfz.sk", "new"))
      .rejects.toMatchObject({ code: "library.pdfRequired" })
    expect(store.deleteFile).toHaveBeenCalledWith("SFZ", "f1")
    expect(docs.updateOne).not.toHaveBeenCalled()
  })

  it("zdroj je druhé PDF — odmietne sa, oba súbory sa upracú", async () => {
    await expect(uploadDocument(META, { pdf: PDF, source: PDF }, "jan@sfz.sk", "new"))
      .rejects.toBeInstanceOf(LibraryError)
    expect(store.deleteFile.mock.calls.map(c => (c as unknown[])[1])).toEqual(["f1", "f2"])
  })

  it("zlyhaný prevod uprace všetky súbory tohto nahratia", async () => {
    conv.convert.mockRejectedValueOnce(new Error("prevod padol"))
    await expect(uploadDocument(META, { pdf: PDF, source: DOCX }, "jan@sfz.sk", "new")).rejects.toThrow("prevod padol")
    expect(store.deleteFile).toHaveBeenCalledTimes(2)
  })

  it("súbor nahratý po kúskoch cudzej organizácie sa nenájde", async () => {
    store.fileInfo.mockResolvedValue(null)
    await expect(uploadDocument(META, { pdf: { storedId: "cudzi" } }, "jan@sfz.sk", "new"))
      .rejects.toMatchObject({ code: "library.uploadedFileNotFound" })
    expect(store.fileInfo).toHaveBeenCalledWith("SFZ", "cudzi")
  })

  it("súbor nahratý po kúskoch sa použije bez druhého uloženia", async () => {
    store.fileInfo.mockResolvedValue({ id: "big", name: "velky.pdf", contentType: "x", bytes: 20_000_000, sha256: "abc" })
    store.loadFile.mockResolvedValue({ data: PDF.data, contentType: "x", name: "velky.pdf" })
    await uploadDocument(META, { pdf: { storedId: "big" } }, "jan@sfz.sk", "new")
    expect(store.saveFile).not.toHaveBeenCalled()
    expect(written().draftPdf).toMatchObject({ id: "big", sha256: "abc", bytes: 20_000_000 })
  })
})

describe("draftIdentity (D96)", () => {
  const text = "# Článok 1\n\nText."
  it("bez PDF je to odtlačok textu — staré znenia a kolá sa nemenia", () => {
    expect(draftIdentity(text)).toBe(textFingerprint(text))
    expect(draftIdentity(text, null)).toBe(textFingerprint(text))
  })
  it("iné PDF pri tom istom texte = iná identita (schválenie neplatí)", () => {
    expect(draftIdentity(text, "a")).not.toBe(draftIdentity(text, "b"))
  })
  it("iný text pri tom istom PDF = iná identita", () => {
    expect(draftIdentity(text, "a")).not.toBe(draftIdentity(text + " Doplnené.", "a"))
  })
  it("neviditeľné rozdiely v texte identitu nemenia (D57)", () => {
    expect(draftIdentity(text, "a")).toBe(draftIdentity(text.replace(/\n/g, "\r\n") + "  ", "a"))
  })
})
