/**
 * fixVersion.test.ts — história opráv znenia (`versions[].fixes[]`).
 *
 * **Prečo tento test existuje.** Zápis ide cez `$push` s cestou v reťazci
 * a `as never`, takže názvy polí TypeScript nekontroluje. Práve tento tvar
 * — „čítanie sa premenovalo, zápis nie" — nás v tomto projekte doteraz
 * zradil trikrát (`tenants.chunkovanie`, `tenants.ciselniky`, projekcia
 * `llmNavrh`). Test je jediné miesto, kde sa to dá zachytiť.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const collections: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {}

function collection(title: string) {
  if (!collections[title]) {
    collections[title] = {
      findOne: vi.fn().mockResolvedValue(null),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
      countDocuments: vi.fn().mockResolvedValue(0),
      find: vi.fn().mockReturnValue({ toArray: async () => [] }),
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

import { fixVersion, LibraryError } from "../src/lib/libraryWrite"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents"

const COMPANY = "sfz"
const OLD_DATE = new Date("2026-01-01T00:00:00Z")

function documentWithVersion() {
  return {
    companyCode: COMPANY,
    documentId: "sfz:eticky_kodex",
    title: "Etický kódex",
    versions: [{ versionId: "v1", label: "1.0", effectiveFrom: OLD_DATE, isActive: true }],
  }
}

/** Položka, ktorá sa naozaj pushla do `versions.$[v].fixes`. */
function pushedFix() {
  const call = collection(DOCUMENTS_COLLECTION).updateOne.mock.calls[0]
  return (call[1] as Record<string, Record<string, unknown>>).$push["versions.$[v].fixes"]
}

beforeEach(() => {
  for (const k of Object.keys(collections)) delete collections[k]
  vi.clearAllMocks()
})

describe("historia opravy sa zapisuje s anglickymi klucmi", () => {
  beforeEach(() => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(documentWithVersion())
  })

  it("zapise presne tie kluce, ktore typ Version deklaruje", async () => {
    await fixVersion(COMPANY, "sfz:eticky_kodex", "v1", { reason: "preklep v názve" }, "kurator@futbalsfz.sk")

    const fix = pushedFix() as Record<string, unknown>
    expect(Object.keys(fix).sort()).toEqual(
      ["at", "by", "fromEffectiveFrom", "fromLabel", "reason", "requiresReacknowledgement"],
    )
    // Poistka proti návratu starého tvaru — `as never` v `$push` ho prepustí.
    for (const old of ["kedy", "kto", "dovod", "znovaPotvrdit", "zLabel", "zEffectiveFrom"]) {
      expect(old in fix, old).toBe(false)
    }
  })

  it("nesie stav PRED opravou, nie po nej", async () => {
    // Bez toho by sa z histórie dalo prečítať, že sa niečo zmenilo,
    // ale nie na čo.
    await fixVersion(
      COMPANY, "sfz:eticky_kodex", "v1",
      { label: "1.1", reason: "novela" },
      "kurator@futbalsfz.sk",
    )
    const fix = pushedFix() as Record<string, unknown>
    expect(fix.fromLabel).toBe("1.0")
    expect(fix.fromEffectiveFrom).toEqual(OLD_DATE)
    expect(fix.reason).toBe("novela")
    expect(fix.by).toBe("kurator@futbalsfz.sk")
  })

  it("pole ide do versions.$[v].fixes, nie inam", async () => {
    await fixVersion(COMPANY, "sfz:eticky_kodex", "v1", { reason: "x" }, "a@b.sk")
    const push = (collection(DOCUMENTS_COLLECTION).updateOne.mock.calls[0][1] as Record<string, object>).$push
    expect(Object.keys(push)).toEqual(["versions.$[v].fixes"])
  })

  it("bez dovodu sa nezapise nic", async () => {
    // Dôvod je jediné miesto, kde sa dá zaznamenať, či išlo o preklep
    // alebo o zmenu povinnosti.
    await expect(
      fixVersion(COMPANY, "sfz:eticky_kodex", "v1", { reason: "   " }, "a@b.sk"),
    ).rejects.toThrow(LibraryError)
    expect(collection(DOCUMENTS_COLLECTION).updateOne).not.toHaveBeenCalled()
  })
})
