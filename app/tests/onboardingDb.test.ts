/**
 * onboardingDb.test.ts — zloženie funkcií, ktoré siahajú do databázy.
 *
 * **Toto je dôvod, prečo sme prešli na Vitest.** Tri funkcie Fázy 8 sa
 * predtým nedali otestovať vôbec, lebo volajú `getCollection()` — a sú medzi
 * nimi práve tie, kde je chyba drahá: brána prihlásenia a zápis právneho
 * záznamu. Čisté funkcie (`validateRow`, `effectiveVersion`, `buildStatement`)
 * majú testy inde; tu ide o to, čo z nich vzniká dokopy.
 *
 * Nové testy sú písané idiomaticky (`expect(skutocne).toBe(ocakavane)`), aby
 * pri zlyhaní bolo vidieť rozdiel hodnôt, nie len „nebola pravda".
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ── falošná databáza ─────────────────────────────────────────────────────────

interface FakeCollection {
  findOne: ReturnType<typeof vi.fn>
  countDocuments: ReturnType<typeof vi.fn>
  insertOne: ReturnType<typeof vi.fn>
  updateOne: ReturnType<typeof vi.fn>
  find: ReturnType<typeof vi.fn>
}

const collections: Record<string, FakeCollection> = {}

function collection(title: string): FakeCollection {
  if (!collections[title]) {
    collections[title] = {
      findOne: vi.fn().mockResolvedValue(null),
      countDocuments: vi.fn().mockResolvedValue(0),
      insertOne: vi.fn().mockResolvedValue({ insertedId: "id-1" }),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1, upsertedCount: 0 }),
      find: vi.fn().mockReturnValue({ sort: () => ({ toArray: async () => [] }) }),
    }
  }
  return collections[title]
}

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async (title: string) => collection(title)),
  getDb: vi.fn(),
  getClient: vi.fn(),
}))

import { personMaySignIn, personLanguage } from "../src/lib/persons"
import { acknowledge } from "../src/lib/acknowledgements"

beforeEach(() => {
  for (const k of Object.keys(collections)) delete collections[k]
  vi.clearAllMocks()
})

// ── brána prihlásenia ────────────────────────────────────────────────────────

describe("osobaSmiePrihlasenie — jediné miesto medzi smernicami a internetom", () => {
  it("pustí osobu, ktorá v persons je a nie je vyradená", async () => {
    collection("persons").countDocuments.mockResolvedValue(1)
    await expect(personMaySignIn("novak@futbalsfz.sk")).resolves.toBe(true)
  })

  it("nepustí adresu, ktorá v persons nie je", async () => {
    collection("persons").countDocuments.mockResolvedValue(0)
    await expect(personMaySignIn("cudzi@inde.sk")).resolves.toBe(false)
  })

  it("vyradenú osobu odfiltruje už v dotaze, nie až v kóde", async () => {
    const col = collection("persons")
    col.countDocuments.mockResolvedValue(0)
    await personMaySignIn("novak@futbalsfz.sk")
    expect(col.countDocuments.mock.calls[0][0]).toEqual({
      email: "novak@futbalsfz.sk",
      status: { $ne: "inactive" },
    })
  })

  // Toto je to najdôležitejšie tvrdenie v celom súbore.
  it("PRI CHYBE DATABÁZY NEOTVORÍ PRÍSTUP", async () => {
    collection("persons").countDocuments.mockRejectedValue(new Error("cluster nedostupný"))
    await expect(personMaySignIn("novak@futbalsfz.sk")).resolves.toBe(false)
  })

  it("adresu bez zavináča nerieši ani dotazom", async () => {
    const col = collection("persons")
    await expect(personMaySignIn("nezmysel")).resolves.toBe(false)
    expect(col.countDocuments).not.toHaveBeenCalled()
  })

  it("porovnáva bez ohľadu na veľkosť písmen", async () => {
    const col = collection("persons")
    col.countDocuments.mockResolvedValue(1)
    await personMaySignIn("  Novak@FutbalSFZ.sk ")
    expect(col.countDocuments.mock.calls[0][0].email).toBe("novak@futbalsfz.sk")
  })
})

describe("jazykOsoby — beží pred prihlásením, nesmie nikdy hodiť", () => {
  it("vráti jazyk z profilu", async () => {
    collection("persons").findOne.mockResolvedValue({ language: "cs" })
    await expect(personLanguage("a@b.sk")).resolves.toBe("cs")
  })

  it("neznámu osobu vybaví slovenčinou", async () => {
    collection("persons").findOne.mockResolvedValue(null)
    await expect(personLanguage("a@b.sk")).resolves.toBe("sk")
  })

  it("pri chybe databázy padne na slovenčinu, nie na výnimku", async () => {
    collection("persons").findOne.mockRejectedValue(new Error("nedostupné"))
    await expect(personLanguage("a@b.sk")).resolves.toBe("sk")
  })
})

// ── zápis potvrdenia ─────────────────────────────────────────────────────────

const ACTOR = {
  personId: "p-1", email: "novak@futbalsfz.sk",
  fullName: "Ján Novák", companyCode: "SFZ", language: "cs",
}

const DOCUMENT = {
  documentId: "smernica-gdpr",
  title: "Smernica o ochrane osobných údajov",
  language: "sk",
  companyCode: "SFZ",
  accessLevel: "internal" as const,
  versions: [
    { versionId: "v1", label: "1.0", effectiveFrom: new Date(Date.UTC(2020, 0, 1)),
      effectiveTo: new Date(Date.UTC(2026, 0, 1)), isActive: true },
    { versionId: "v2", label: "2.0", effectiveFrom: new Date(Date.UTC(2026, 0, 1)),
      effectiveTo: null, isActive: true },
  ],
}

describe("potvrd — zápis právneho záznamu", () => {
  it("verziu si určí server, nie požiadavka klienta", async () => {
    collection("documents").findOne.mockResolvedValue(DOCUMENT)
    const v = await acknowledge(ACTOR, "smernica-gdpr")

    expect(v.ok).toBe(true)
    const write = collection("acknowledgements").insertOne.mock.calls[0][0]
    // Platná je v2; keby sa verzia brala z požiadavky, dala by sa podvrhnúť v1.
    expect(write.versionId).toBe("v2")
    expect(write.versionLabel).toBe("2.0")
  })

  it("záznam si pamätá jazyk človeka aj jazyk dokumentu zvlášť", async () => {
    collection("documents").findOne.mockResolvedValue(DOCUMENT)
    await acknowledge(ACTOR, "smernica-gdpr")

    const z = collection("acknowledgements").insertOne.mock.calls[0][0]
    // Nekontrolujeme, ako znie český preklad — to je samostatná vec.
    // Kontrolujeme, že sa obe hodnoty zapísali a nezliali do jednej.
    expect(z.language).toBe("cs")
    expect(z.documentLanguage).toBe("sk")
    expect(z.statementText.length).toBeGreaterThan(0)
  })

  it("záznam nesie odtlačky, aby bol čitateľný bez cudzích kolekcií", async () => {
    collection("documents").findOne.mockResolvedValue(DOCUMENT)
    await acknowledge(ACTOR, "smernica-gdpr", { ip: "195.28.1.1", userAgent: "Firefox" })

    const z = collection("acknowledgements").insertOne.mock.calls[0][0]
    expect(z).toMatchObject({
      type: "acknowledgement",
      personId: "p-1",
      email: "novak@futbalsfz.sk",
      fullName: "Ján Novák",
      documentTitle: "Smernica o ochrane osobných údajov",
      ip: "195.28.1.1",
      userAgent: "Firefox",
      origin: "portal",
      supersedes: null,
    })
    expect(z.statementHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("dokument cudzej organizácie sa nedá potvrdiť uhádnutím identifikátora", async () => {
    // Dokument existuje, ale patrí inému tenantovi a nie je zdieľaný (D32).
    // Musí sa tváriť ako neexistujúci — rozlíšenie by prezradilo, aké
    // smernice iná organizácia má.
    collection("documents").findOne.mockResolvedValue({
      ...DOCUMENT, companyCode: "ZsFZ", accessLevel: "internal",
    })
    const v = await acknowledge(ACTOR, "smernica-gdpr")

    expect(v).toEqual({ ok: false, reason: "document-not-found" })
    expect(collection("acknowledgements").insertOne).not.toHaveBeenCalled()
  })

  it("neexistujúci dokument nezapíše nič", async () => {
    collection("documents").findOne.mockResolvedValue(null)
    const v = await acknowledge(ACTOR, "nieco")

    expect(v).toEqual({ ok: false, reason: "document-not-found" })
    expect(collection("acknowledgements").insertOne).not.toHaveBeenCalled()
  })

  it("dokument bez určenej platnosti sa nedá potvrdiť a povie prečo", async () => {
    collection("documents").findOne.mockResolvedValue({
      ...DOCUMENT,
      versions: [{ versionId: "v1", label: "1.0", effectiveFrom: null, effectiveTo: null, isActive: true }],
    })
    const v = await acknowledge(ACTOR, "smernica-gdpr")

    expect(v).toEqual({ ok: false, reason: "no-effective-version", detail: "validity-not-set" })
    expect(collection("acknowledgements").insertOne).not.toHaveBeenCalled()
  })

  it("druhé potvrdenie tej istej verzie je 'uz-potvrdene', nie chyba servera", async () => {
    collection("documents").findOne.mockResolvedValue(DOCUMENT)
    const duplicate = Object.assign(new Error("E11000 duplicate key"), { code: 11000 })
    collection("acknowledgements").insertOne.mockRejectedValue(duplicate)

    const v = await acknowledge(ACTOR, "smernica-gdpr")
    expect(v).toEqual({ ok: false, reason: "already-acknowledged" })
  })

  it("iná chyba zápisu sa nezamaskuje za 'už potvrdené'", async () => {
    collection("documents").findOne.mockResolvedValue(DOCUMENT)
    collection("acknowledgements").insertOne.mockRejectedValue(new Error("disk plný"))
    // Kód tú chybu zámerne kričí do konzoly; v teste ju stlmíme, nech vo výpise
    // nezostáva hluk. Výpis, ktorý sa naučíme prehliadať, prestane byť užitočný.
    vi.spyOn(console, "error").mockImplementation(() => {})

    const v = await acknowledge(ACTOR, "smernica-gdpr")
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toBe("write-failed")
  })

  it("neznámy jazyk človeka nezhodí zápis, spadne na predvolený", async () => {
    collection("documents").findOne.mockResolvedValue(DOCUMENT)
    await acknowledge({ ...ACTOR, language: "de" }, "smernica-gdpr")

    expect(collection("acknowledgements").insertOne.mock.calls[0][0].language).toBe("sk")
  })
})
