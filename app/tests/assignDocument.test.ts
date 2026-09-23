/**
 * assignDocument.test.ts — presun dokumentu do priečinka zapisuje audit (D93, N1).
 *
 * **Prečo tento test existuje.** Presun po jednom aj hromadný bežal bez stopy
 * v audite, hoci všetky ostatné operácie s priečinkami ju nechávali — a zápis
 * v TODO tvrdil opak. Kým sa to netestuje, tá istá diera sa vráti pri prvom
 * refaktore bez toho, aby si ju ktokoľvek všimol.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const COMPANY = "sfz"
const FOLDERS = [
  { companyCode: COMPANY, id: "normy", name: "Normy", parentId: null },
  { companyCode: COMPANY, id: "gdpr", name: "GDPR", parentId: "normy" },
  { companyCode: COMPANY, id: "smernice", name: "Smernice", parentId: null },
]

const collections: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {}

function collection(title: string) {
  if (!collections[title]) {
    collections[title] = {
      find: vi.fn().mockReturnValue({ toArray: async () => FOLDERS }),
      findOneAndUpdate: vi.fn().mockResolvedValue(null),
    }
  }
  return collections[title]
}

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async (title: string) => collection(title)),
  getDb: vi.fn(),
  getClient: vi.fn(),
}))

const audit = vi.hoisted(() => ({ writeAudit: vi.fn(async () => {}) }))
vi.mock("../src/lib/audit", async importOriginal => {
  const original = await importOriginal<typeof import("../src/lib/audit")>()
  return { ...original, writeAudit: audit.writeAudit }
})

import { assignDocument, FolderError } from "../src/lib/folders"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents"

function documentsCol() {
  return collection(DOCUMENTS_COLLECTION)
}

beforeEach(() => {
  for (const k of Object.keys(collections)) delete collections[k]
  audit.writeAudit.mockClear()
})

describe("assignDocument — audit presunu", () => {
  it("úspešný presun zapíše audit s cestou názvov, nie s identifikátormi", async () => {
    documentsCol().findOneAndUpdate.mockResolvedValue({ title: "Smernica o GDPR", folderId: "smernice" })

    await assignDocument(COMPANY, "sfz:gdpr", "gdpr", "jan@sfz.sk")

    expect(audit.writeAudit).toHaveBeenCalledTimes(1)
    expect(audit.writeAudit).toHaveBeenCalledWith({
      companyCode: COMPANY, subject: "document", action: "moved", actor: "jan@sfz.sk",
      targetId: "sfz:gdpr", targetLabel: "Smernica o GDPR",
      changes: { folder: { from: "Smernice", to: "Normy / GDPR" } },
    })
  })

  it("companyCode je v podmienke zápisu (D32) a zapisuje sa aj cesta", async () => {
    documentsCol().findOneAndUpdate.mockResolvedValue({ title: "X", folderId: null })

    await assignDocument(COMPANY, "sfz:x", "gdpr", "jan@sfz.sk")

    const [filter, update, options] = documentsCol().findOneAndUpdate.mock.calls[0]
    expect(filter).toEqual({ companyCode: COMPANY, documentId: "sfz:x" })
    expect(update.$set.folderPath).toEqual(["normy", "gdpr"])
    expect(options.returnDocument).toBe("before")
  })

  it("vyradenie z priečinka sa zapíše ako presun do „žiadneho\"", async () => {
    documentsCol().findOneAndUpdate.mockResolvedValue({ title: "X", folderId: "normy" })

    await assignDocument(COMPANY, "sfz:x", null, "jan@sfz.sk")

    expect(audit.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ changes: { folder: { from: "Normy", to: null } } }),
    )
  })

  it("neexistujúci dokument audit nezapíše a vyhodí chybu", async () => {
    documentsCol().findOneAndUpdate.mockResolvedValue(null)

    await expect(assignDocument(COMPANY, "sfz:nie", "gdpr", "jan@sfz.sk")).rejects.toBeInstanceOf(FolderError)
    expect(audit.writeAudit).not.toHaveBeenCalled()
  })

  it("neexistujúci priečinok nezapíše nič", async () => {
    await expect(assignDocument(COMPANY, "sfz:x", "nie-je", "jan@sfz.sk")).rejects.toBeInstanceOf(FolderError)
    expect(documentsCol().findOneAndUpdate).not.toHaveBeenCalled()
    expect(audit.writeAudit).not.toHaveBeenCalled()
  })

  it("presun do toho istého priečinka sa do auditu nepíše", async () => {
    documentsCol().findOneAndUpdate.mockResolvedValue({ title: "X", folderId: "gdpr" })

    await assignDocument(COMPANY, "sfz:x", "gdpr", "jan@sfz.sk")

    expect(audit.writeAudit).not.toHaveBeenCalled()
  })
})
