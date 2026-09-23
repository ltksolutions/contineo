/**
 * versionResponsibilityDb.test.ts — zápis zodpovednej osoby a právneho základu.
 *
 * Testuje sa **zloženie**: že oprávnenie sa overuje proti uloženému zneniu,
 * že meno sa berie zo záznamu osoby a nie z formulára, a že história sa
 * zapíše s kľúčmi, ktoré deklaruje typ `Version` (`$push` s `as never`
 * ich TypeScript nekontroluje — viď `fixVersion.test.ts`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const collections: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {}

function collection(title: string) {
  if (!collections[title]) {
    collections[title] = {
      findOne: vi.fn().mockResolvedValue(null),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
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

import {
  setVersionLegalBasis, setVersionResponsible, ResponsibilityError,
} from "../src/lib/versionResponsibilityDb"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents"
import { PERSONS_COLLECTION } from "../src/lib/persons"

const COMPANY = "SFZ"
const GARANT = { personId: "p-garant", fullName: "Garant Predpisu", email: "garant@futbalsfz.sk" }

function doc(version: Record<string, unknown> = {}) {
  return {
    companyCode: COMPANY,
    documentId: "sfz:sutazny_poriadok",
    title: "Súťažný poriadok",
    versions: [{ versionId: "v1", label: "2026", effectiveFrom: new Date(), isActive: true, ...version }],
  }
}

/** Osoby v organizácii — `findOne` vráti tú, ktorej `id` sa pýta, a vyradené nie. */
function personsAre(list: { id: string; fullName: string; email: string; status?: string }[]) {
  collection(PERSONS_COLLECTION).findOne.mockImplementation(async (q: Record<string, unknown>) => {
    const p = list.find(x => x.id === q.id)
    if (!p) return null
    if (q.status && p.status === "inactive") return null
    return p
  })
}

function update() {
  const call = collection(DOCUMENTS_COLLECTION).updateOne.mock.calls[0]
  return { filter: call[0], update: call[1] as Record<string, Record<string, unknown>> }
}

beforeEach(() => {
  for (const k of Object.keys(collections)) delete collections[k]
  vi.clearAllMocks()
})

describe("právny základ", () => {
  it("zodpovedná osoba ho určí a história má deklarované kľúče", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc({ responsiblePerson: GARANT }))
    personsAre([{ id: "p-garant", fullName: GARANT.fullName, email: GARANT.email, status: "active" }])

    await setVersionLegalBasis({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      basis: "legal_obligation", reference: "§ 7 zák. 124/2006 Z. z.",
      actor: { personId: "p-garant", email: GARANT.email }, isContentManager: false,
    })

    const { filter, update: u } = update()
    expect(filter).toMatchObject({ companyCode: COMPANY })
    expect(u.$set["versions.$[v].legalBasis"]).toBe("legal_obligation")
    expect(u.$set["versions.$[v].legalBasisReference"]).toBe("§ 7 zák. 124/2006 Z. z.")
    const entry = u.$push["versions.$[v].legalBasisChanges"] as Record<string, unknown>
    expect(Object.keys(entry).sort()).toEqual(["at", "by", "from", "fromReference", "to", "toReference"])
    expect(entry).toMatchObject({ from: null, to: "legal_obligation", by: GARANT.email })
    expect(audit.writeAudit).toHaveBeenCalledOnce()
  })

  it("správca obsahu pri aktívnej zodpovednej osobe neprejde — overuje sa na serveri", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc({ responsiblePerson: GARANT }))
    personsAre([{ id: "p-garant", fullName: GARANT.fullName, email: GARANT.email, status: "active" }])

    await expect(setVersionLegalBasis({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      basis: "legitimate_interest",
      actor: { personId: "p-spravca", email: "spravca@futbalsfz.sk" }, isContentManager: true,
    })).rejects.toMatchObject({ code: "legalBasis.notAllowed" })
    expect(collection(DOCUMENTS_COLLECTION).updateOne).not.toHaveBeenCalled()
  })

  it("správca obsahu smie, keď zodpovedná osoba odišla", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc({ responsiblePerson: GARANT }))
    personsAre([{ id: "p-garant", fullName: GARANT.fullName, email: GARANT.email, status: "inactive" }])

    await setVersionLegalBasis({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      basis: "legitimate_interest",
      actor: { personId: "p-spravca", email: "spravca@futbalsfz.sk" }, isContentManager: true,
    })
    const { update: u } = update()
    expect(u.$set["versions.$[v].legalBasis"]).toBe("legitimate_interest")
    // Bez odkazu sa starý odkaz odstráni, nezostane visieť.
    expect(u.$unset).toEqual({ "versions.$[v].legalBasisReference": "" })
  })

  it("zmena bez dôvodu neprejde", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc({
      responsiblePerson: GARANT, legalBasis: "legitimate_interest",
    }))
    personsAre([{ id: "p-garant", fullName: GARANT.fullName, email: GARANT.email, status: "active" }])

    const e = await setVersionLegalBasis({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      basis: "legal_obligation", reference: "§ 7",
      actor: { personId: "p-garant", email: GARANT.email }, isContentManager: false,
    }).catch(x => x)
    expect(e).toBeInstanceOf(ResponsibilityError)
    expect(e.code).toBe("legalBasis.reasonRequired")
  })

  it("neznáme znenie povie, že neexistuje", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc())
    await expect(setVersionLegalBasis({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v-neexistuje",
      basis: "legitimate_interest",
      actor: { personId: "p-spravca", email: "s@futbalsfz.sk" }, isContentManager: true,
    })).rejects.toMatchObject({ code: "library.versionNotFound" })
  })
})

describe("zodpovedná osoba", () => {
  it("meno a adresa sa berú zo záznamu osoby, nie z formulára", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc({ responsiblePerson: GARANT }))
    personsAre([{ id: "p-novy", fullName: "Nová Garantka", email: "nova@futbalsfz.sk", status: "active" }])

    const to = await setVersionResponsible({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      personId: "p-novy", reason: "pôvodná osoba odišla", actor: "spravca@futbalsfz.sk", canManageContent: true,
    })
    expect(to).toEqual({ personId: "p-novy", fullName: "Nová Garantka", email: "nova@futbalsfz.sk" })

    const { update: u } = update()
    expect(u.$set["versions.$[v].responsiblePerson"]).toEqual(to)
    const entry = u.$push["versions.$[v].responsibleChanges"] as Record<string, unknown>
    expect(Object.keys(entry).sort()).toEqual(["at", "by", "from", "reason", "to"])
    expect(entry.from).toEqual(GARANT)
  })

  it("vyradenú osobu neurčí", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc())
    personsAre([{ id: "p-odisla", fullName: "Odídená", email: "o@futbalsfz.sk", status: "inactive" }])

    await expect(setVersionResponsible({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      personId: "p-odisla", reason: "doplnenie", actor: "s@futbalsfz.sk", canManageContent: true,
    })).rejects.toMatchObject({ code: "responsibility.unknownPerson" })
  })

  it("bez roly správcu obsahu nič nezapíše", async () => {
    await expect(setVersionResponsible({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      personId: "p-novy", reason: "x", actor: "hocikto@futbalsfz.sk", canManageContent: false,
    })).rejects.toMatchObject({ code: "responsibility.notContentManager" })
    expect(collection(DOCUMENTS_COLLECTION).updateOne).not.toHaveBeenCalled()
  })
})

describe("zverejnenie nového znenia", () => {
  it("bez zodpovednej osoby neprejde — a nič nezapíše", async () => {
    const { publish } = await import("../src/lib/libraryWrite")
    await expect(publish(COMPANY, "sfz:sutazny_poriadok", {
      label: "novela 2029",
      effectiveFrom: new Date("2029-07-01T00:00:00Z"),
      effectiveFromSource: "uznesenie VV SFZ č. 1/2029",
      responsiblePersonId: "  ",
    }, "spravca@futbalsfz.sk")).rejects.toMatchObject({ code: "responsibility.personRequired" })
    expect(collection(DOCUMENTS_COLLECTION).updateOne).not.toHaveBeenCalled()
  })

  it("vyradenú zodpovednú osobu odmietne", async () => {
    const { publish } = await import("../src/lib/libraryWrite")
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue({ ...doc(), draftMarkdown: "# Článok 1\n\nText." })
    personsAre([{ id: "p-odisla", fullName: "Odídená", email: "o@futbalsfz.sk", status: "inactive" }])
    await expect(publish(COMPANY, "sfz:sutazny_poriadok", {
      label: "novela 2029",
      effectiveFrom: new Date("2029-07-01T00:00:00Z"),
      effectiveFromSource: "uznesenie VV SFZ č. 1/2029",
      responsiblePersonId: "p-odisla",
    }, "spravca@futbalsfz.sk")).rejects.toMatchObject({ code: "responsibility.unknownPerson" })
    expect(collection(DOCUMENTS_COLLECTION).updateOne).not.toHaveBeenCalled()
  })
})
