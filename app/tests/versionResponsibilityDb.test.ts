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
import { TENANTS_COLLECTION } from "../src/lib/tenants"

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

describe("právny základ z číselníka (D92)", () => {
  function tenantHas(t: Record<string, unknown> = {}) {
    collection(TENANTS_COLLECTION).findOne.mockResolvedValue({ companyCode: COMPANY, ...t })
  }

  it("zodpovedná osoba vyberie štandardnú položku a do znenia sa uloží kópia", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc({ responsiblePerson: GARANT }))
    personsAre([{ id: "p-garant", fullName: GARANT.fullName, email: GARANT.email, status: "active" }])
    tenantHas()

    await setVersionLegalBasis({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      legalBasisKey: "bozp",
      actor: { personId: "p-garant", email: GARANT.email }, isContentManager: false,
    })

    const { filter, update: u } = update()
    expect(filter).toMatchObject({ companyCode: COMPANY })
    expect(u.$set["versions.$[v].legalBasis"]).toBe("legal_obligation")
    expect(u.$set["versions.$[v].legalBasisKey"]).toBe("bozp")
    expect(u.$set["versions.$[v].legalBasisLabel"]).toBe("Bezpečnosť a ochrana zdravia pri práci")
    expect(String(u.$set["versions.$[v].legalBasisReference"])).toContain("124/2006")
    const entry = u.$push["versions.$[v].legalBasisChanges"] as Record<string, unknown>
    expect(Object.keys(entry).sort()).toEqual(
      ["at", "by", "from", "fromKey", "fromReference", "to", "toKey", "toLabel", "toReference"],
    )
    expect(entry).toMatchObject({ from: null, to: "legal_obligation", toKey: "bozp", by: GARANT.email })
    expect(audit.writeAudit).toHaveBeenCalledOnce()
  })

  it("voľný text ani neznámy kľúč neprejde", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc({ responsiblePerson: GARANT }))
    personsAre([{ id: "p-garant", fullName: GARANT.fullName, email: GARANT.email, status: "active" }])
    tenantHas()
    await expect(setVersionLegalBasis({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      legalBasisKey: "§ 7 zákona 124/2006",
      actor: { personId: "p-garant", email: GARANT.email }, isContentManager: false,
    })).rejects.toMatchObject({ code: "legalBasis.unknownKey" })
    expect(collection(DOCUMENTS_COLLECTION).updateOne).not.toHaveBeenCalled()
  })

  it("skrytú štandardnú položku organizácie vybrať nedá", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc({ responsiblePerson: GARANT }))
    personsAre([{ id: "p-garant", fullName: GARANT.fullName, email: GARANT.email, status: "active" }])
    tenantHas({ legalBasesHidden: ["bozp"] })
    await expect(setVersionLegalBasis({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      legalBasisKey: "bozp",
      actor: { personId: "p-garant", email: GARANT.email }, isContentManager: false,
    })).rejects.toMatchObject({ code: "legalBasis.unknownKey" })
  })

  it("vlastná položka organizácie sa dá vybrať, vyradená nie", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc({ responsiblePerson: GARANT }))
    personsAre([{ id: "p-garant", fullName: GARANT.fullName, email: GARANT.email, status: "active" }])
    const own = { key: "doping", label: "Dopingová kontrola", basis: "legitimate_interest", reference: null, createdAt: new Date(), createdBy: "x" }
    tenantHas({ legalBases: [own, { ...own, key: "stara", retiredAt: new Date() }] })

    await setVersionLegalBasis({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      legalBasisKey: "doping",
      actor: { personId: "p-garant", email: GARANT.email }, isContentManager: false,
    })
    const { update: u } = update()
    expect(u.$set["versions.$[v].legalBasisLabel"]).toBe("Dopingová kontrola")
    // Bez odkazu sa prípadný starý odkaz odstráni, nezostane visieť.
    expect(u.$unset).toEqual({ "versions.$[v].legalBasisReference": "" })

    collection(DOCUMENTS_COLLECTION).updateOne.mockClear()
    await expect(setVersionLegalBasis({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      legalBasisKey: "stara",
      actor: { personId: "p-garant", email: GARANT.email }, isContentManager: false,
    })).rejects.toMatchObject({ code: "legalBasis.unknownKey" })
  })

  it("správca obsahu pri aktívnej zodpovednej osobe neprejde — overuje sa na serveri", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc({ responsiblePerson: GARANT }))
    personsAre([{ id: "p-garant", fullName: GARANT.fullName, email: GARANT.email, status: "active" }])
    tenantHas()
    await expect(setVersionLegalBasis({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      legalBasisKey: "interna_smernica",
      actor: { personId: "p-spravca", email: "spravca@futbalsfz.sk" }, isContentManager: true,
    })).rejects.toMatchObject({ code: "legalBasis.notAllowed" })
    expect(collection(DOCUMENTS_COLLECTION).updateOne).not.toHaveBeenCalled()
  })

  it("správca obsahu smie, keď zodpovedná osoba odišla", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc({ responsiblePerson: GARANT }))
    personsAre([{ id: "p-garant", fullName: GARANT.fullName, email: GARANT.email, status: "inactive" }])
    tenantHas()
    await setVersionLegalBasis({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      legalBasisKey: "interna_smernica",
      actor: { personId: "p-spravca", email: "spravca@futbalsfz.sk" }, isContentManager: true,
    })
    expect(update().update.$set["versions.$[v].legalBasisKey"]).toBe("interna_smernica")
  })

  it("zmena bez dôvodu neprejde, rovnaká položka nie je zmena", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc({
      responsiblePerson: GARANT, legalBasis: "legitimate_interest", legalBasisKey: "interna_smernica",
    }))
    personsAre([{ id: "p-garant", fullName: GARANT.fullName, email: GARANT.email, status: "active" }])
    tenantHas()
    const base = {
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v1",
      actor: { personId: "p-garant", email: GARANT.email }, isContentManager: false,
    }
    const e = await setVersionLegalBasis({ ...base, legalBasisKey: "bozp" }).catch(x => x)
    expect(e).toBeInstanceOf(ResponsibilityError)
    expect(e.code).toBe("legalBasis.reasonRequired")
    await expect(setVersionLegalBasis({ ...base, legalBasisKey: "interna_smernica", reason: "x" }))
      .rejects.toMatchObject({ code: "legalBasis.noChange" })
  })

  it("neznáme znenie povie, že neexistuje", async () => {
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc())
    await expect(setVersionLegalBasis({
      companyCode: COMPANY, documentId: "sfz:sutazny_poriadok", versionId: "v-neexistuje",
      legalBasisKey: "bozp",
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
    // Koncept bez osoby určenej v príprave (ADR-014) a formulár bez voľby.
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue({ documentId: "sfz:sutazny_poriadok", draftMarkdown: "# Čl. 1\ntext" })
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

  it("bez voľby vo formulári vezme osobu určenú v príprave (ADR-014)", async () => {
    const { publish } = await import("../src/lib/libraryWrite")
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue({
      ...doc(), draftMarkdown: "# Článok 1\n\nText.",
      draftResponsible: { personId: "p-odisla", fullName: "Odídená", email: "o@futbalsfz.sk" },
    })
    personsAre([{ id: "p-odisla", fullName: "Odídená", email: "o@futbalsfz.sk", status: "inactive" }])
    // Osoba z prípravy medzitým odišla — zverejnenie ju overí rovnako ako voľbu z formulára.
    await expect(publish(COMPANY, "sfz:sutazny_poriadok", {
      label: "novela 2029",
      effectiveFrom: new Date("2029-07-01T00:00:00Z"),
      effectiveFromSource: "uznesenie VV SFZ č. 1/2029",
    }, "spravca@futbalsfz.sk")).rejects.toMatchObject({ code: "responsibility.unknownPerson" })
  })
})

describe("zodpovedná osoba v príprave (ADR-014, D109)", () => {
  it("uloží odtlačok osoby zo záznamu a zapíše audit", async () => {
    const { saveDraftResponsible } = await import("../src/lib/libraryWrite")
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue({ ...doc(), draftMarkdown: "# Čl. 1" })
    personsAre([{ id: "p-novy", fullName: "Nová Garantka", email: "nova@futbalsfz.sk", status: "active" }])
    expect(await saveDraftResponsible(COMPANY, "sfz:sutazny_poriadok", "p-novy", "spravca@futbalsfz.sk")).toBe(true)
    const u = collection(DOCUMENTS_COLLECTION).updateOne.mock.calls[0][1] as { $set: Record<string, unknown> }
    expect(u.$set.draftResponsible).toEqual({ personId: "p-novy", fullName: "Nová Garantka", email: "nova@futbalsfz.sk" })
  })

  it("tá istá osoba znova nič nezapíše", async () => {
    const { saveDraftResponsible } = await import("../src/lib/libraryWrite")
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue({
      ...doc(), draftMarkdown: "# Čl. 1",
      draftResponsible: { personId: "p-novy", fullName: "Nová Garantka", email: "nova@futbalsfz.sk" },
    })
    personsAre([{ id: "p-novy", fullName: "Nová Garantka", email: "nova@futbalsfz.sk", status: "active" }])
    expect(await saveDraftResponsible(COMPANY, "sfz:sutazny_poriadok", "p-novy", "s@futbalsfz.sk")).toBe(false)
    expect(collection(DOCUMENTS_COLLECTION).updateOne).not.toHaveBeenCalled()
  })

  it("bez konceptu ju neurčí", async () => {
    const { saveDraftResponsible } = await import("../src/lib/libraryWrite")
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(doc())
    await expect(saveDraftResponsible(COMPANY, "sfz:sutazny_poriadok", "p-novy", "s@futbalsfz.sk"))
      .rejects.toMatchObject({ code: "meta.noDraft" })
  })
})
