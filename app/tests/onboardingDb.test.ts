/**
 * onboardingDb.test.ts — zloženie funkcií, ktoré siahajú do databázy.
 *
 * **Toto je dôvod, prečo sme prešli na Vitest.** Tri funkcie Fázy 8 sa
 * predtým nedali otestovať vôbec, lebo volajú `getCollection()` — a sú medzi
 * nimi práve tie, kde je chyba drahá: brána prihlásenia a zápis právneho
 * záznamu. Čisté funkcie (`overRiadok`, `platnaVerzia`, `zneniePotvrdenia`)
 * majú testy inde; tu ide o to, čo z nich vzniká dokopy.
 *
 * Nové testy sú písané idiomaticky (`expect(skutocne).toBe(ocakavane)`), aby
 * pri zlyhaní bolo vidieť rozdiel hodnôt, nie len „nebola pravda".
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ── falošná databáza ─────────────────────────────────────────────────────────

interface FalosnaKolekcia {
  findOne: ReturnType<typeof vi.fn>
  countDocuments: ReturnType<typeof vi.fn>
  insertOne: ReturnType<typeof vi.fn>
  updateOne: ReturnType<typeof vi.fn>
  find: ReturnType<typeof vi.fn>
}

const kolekcie: Record<string, FalosnaKolekcia> = {}

function kolekcia(nazov: string): FalosnaKolekcia {
  if (!kolekcie[nazov]) {
    kolekcie[nazov] = {
      findOne: vi.fn().mockResolvedValue(null),
      countDocuments: vi.fn().mockResolvedValue(0),
      insertOne: vi.fn().mockResolvedValue({ insertedId: "id-1" }),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1, upsertedCount: 0 }),
      find: vi.fn().mockReturnValue({ sort: () => ({ toArray: async () => [] }) }),
    }
  }
  return kolekcie[nazov]
}

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async (nazov: string) => kolekcia(nazov)),
  getDb: vi.fn(),
  getClient: vi.fn(),
}))

import { osobaSmiePrihlasenie, jazykOsoby } from "../src/lib/osoby"
import { potvrd } from "../src/lib/potvrdenia"

beforeEach(() => {
  for (const k of Object.keys(kolekcie)) delete kolekcie[k]
  vi.clearAllMocks()
})

// ── brána prihlásenia ────────────────────────────────────────────────────────

describe("osobaSmiePrihlasenie — jediné miesto medzi smernicami a internetom", () => {
  it("pustí osobu, ktorá v persons je a nie je vyradená", async () => {
    kolekcia("persons").countDocuments.mockResolvedValue(1)
    await expect(osobaSmiePrihlasenie("novak@futbalsfz.sk")).resolves.toBe(true)
  })

  it("nepustí adresu, ktorá v persons nie je", async () => {
    kolekcia("persons").countDocuments.mockResolvedValue(0)
    await expect(osobaSmiePrihlasenie("cudzi@inde.sk")).resolves.toBe(false)
  })

  it("vyradenú osobu odfiltruje už v dotaze, nie až v kóde", async () => {
    const col = kolekcia("persons")
    col.countDocuments.mockResolvedValue(0)
    await osobaSmiePrihlasenie("novak@futbalsfz.sk")
    expect(col.countDocuments.mock.calls[0][0]).toEqual({
      email: "novak@futbalsfz.sk",
      status: { $ne: "inactive" },
    })
  })

  // Toto je to najdôležitejšie tvrdenie v celom súbore.
  it("PRI CHYBE DATABÁZY NEOTVORÍ PRÍSTUP", async () => {
    kolekcia("persons").countDocuments.mockRejectedValue(new Error("cluster nedostupný"))
    await expect(osobaSmiePrihlasenie("novak@futbalsfz.sk")).resolves.toBe(false)
  })

  it("adresu bez zavináča nerieši ani dotazom", async () => {
    const col = kolekcia("persons")
    await expect(osobaSmiePrihlasenie("nezmysel")).resolves.toBe(false)
    expect(col.countDocuments).not.toHaveBeenCalled()
  })

  it("porovnáva bez ohľadu na veľkosť písmen", async () => {
    const col = kolekcia("persons")
    col.countDocuments.mockResolvedValue(1)
    await osobaSmiePrihlasenie("  Novak@FutbalSFZ.sk ")
    expect(col.countDocuments.mock.calls[0][0].email).toBe("novak@futbalsfz.sk")
  })
})

describe("jazykOsoby — beží pred prihlásením, nesmie nikdy hodiť", () => {
  it("vráti jazyk z profilu", async () => {
    kolekcia("persons").findOne.mockResolvedValue({ language: "cs" })
    await expect(jazykOsoby("a@b.sk")).resolves.toBe("cs")
  })

  it("neznámu osobu vybaví slovenčinou", async () => {
    kolekcia("persons").findOne.mockResolvedValue(null)
    await expect(jazykOsoby("a@b.sk")).resolves.toBe("sk")
  })

  it("pri chybe databázy padne na slovenčinu, nie na výnimku", async () => {
    kolekcia("persons").findOne.mockRejectedValue(new Error("nedostupné"))
    await expect(jazykOsoby("a@b.sk")).resolves.toBe("sk")
  })
})

// ── zápis potvrdenia ─────────────────────────────────────────────────────────

const KTO = {
  personId: "p-1", email: "novak@futbalsfz.sk",
  fullName: "Ján Novák", companyCode: "SFZ", language: "cs",
}

const DOKUMENT = {
  documentId: "smernica-gdpr",
  title: "Smernica o ochrane osobných údajov",
  language: "sk",
  versions: [
    { versionId: "v1", label: "1.0", effectiveFrom: new Date(Date.UTC(2020, 0, 1)),
      effectiveTo: new Date(Date.UTC(2026, 0, 1)), isActive: true },
    { versionId: "v2", label: "2.0", effectiveFrom: new Date(Date.UTC(2026, 0, 1)),
      effectiveTo: null, isActive: true },
  ],
}

describe("potvrd — zápis právneho záznamu", () => {
  it("verziu si určí server, nie požiadavka klienta", async () => {
    kolekcia("documents").findOne.mockResolvedValue(DOKUMENT)
    const v = await potvrd(KTO, "smernica-gdpr")

    expect(v.ok).toBe(true)
    const zapis = kolekcia("acknowledgements").insertOne.mock.calls[0][0]
    // Platná je v2; keby sa verzia brala z požiadavky, dala by sa podvrhnúť v1.
    expect(zapis.versionId).toBe("v2")
    expect(zapis.versionLabel).toBe("2.0")
  })

  it("znenie je v jazyku človeka, dokument si nesie svoj vlastný", async () => {
    kolekcia("documents").findOne.mockResolvedValue(DOKUMENT)
    await potvrd(KTO, "smernica-gdpr")

    const z = kolekcia("acknowledgements").insertOne.mock.calls[0][0]
    expect(z.language).toBe("cs")
    expect(z.documentLanguage).toBe("sk")
    expect(z.statementText).toContain("Potvrzuji")
  })

  it("záznam nesie odtlačky, aby bol čitateľný bez cudzích kolekcií", async () => {
    kolekcia("documents").findOne.mockResolvedValue(DOKUMENT)
    await potvrd(KTO, "smernica-gdpr", { ip: "195.28.1.1", userAgent: "Firefox" })

    const z = kolekcia("acknowledgements").insertOne.mock.calls[0][0]
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

  it("neexistujúci dokument nezapíše nič", async () => {
    kolekcia("documents").findOne.mockResolvedValue(null)
    const v = await potvrd(KTO, "nieco")

    expect(v).toEqual({ ok: false, dovod: "dokument-neexistuje" })
    expect(kolekcia("acknowledgements").insertOne).not.toHaveBeenCalled()
  })

  it("dokument bez určenej platnosti sa nedá potvrdiť a povie prečo", async () => {
    kolekcia("documents").findOne.mockResolvedValue({
      ...DOKUMENT,
      versions: [{ versionId: "v1", label: "1.0", effectiveFrom: null, effectiveTo: null, isActive: true }],
    })
    const v = await potvrd(KTO, "smernica-gdpr")

    expect(v).toEqual({ ok: false, dovod: "bez-platnej-verzie", detail: "platnost-neurcena" })
    expect(kolekcia("acknowledgements").insertOne).not.toHaveBeenCalled()
  })

  it("druhé potvrdenie tej istej verzie je 'uz-potvrdene', nie chyba servera", async () => {
    kolekcia("documents").findOne.mockResolvedValue(DOKUMENT)
    const duplicita = Object.assign(new Error("E11000 duplicate key"), { code: 11000 })
    kolekcia("acknowledgements").insertOne.mockRejectedValue(duplicita)

    const v = await potvrd(KTO, "smernica-gdpr")
    expect(v).toEqual({ ok: false, dovod: "uz-potvrdene" })
  })

  it("iná chyba zápisu sa nezamaskuje za 'už potvrdené'", async () => {
    kolekcia("documents").findOne.mockResolvedValue(DOKUMENT)
    kolekcia("acknowledgements").insertOne.mockRejectedValue(new Error("disk plný"))
    // Kód tú chybu zámerne kričí do konzoly; v teste ju stlmíme, nech vo výpise
    // nezostáva hluk. Výpis, ktorý sa naučíme prehliadať, prestane byť užitočný.
    vi.spyOn(console, "error").mockImplementation(() => {})

    const v = await potvrd(KTO, "smernica-gdpr")
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.dovod).toBe("zapis-zlyhal")
  })

  it("neznámy jazyk človeka nezhodí zápis, formulka bude slovenská", async () => {
    kolekcia("documents").findOne.mockResolvedValue(DOKUMENT)
    await potvrd({ ...KTO, language: "de" }, "smernica-gdpr")

    const z = kolekcia("acknowledgements").insertOne.mock.calls[0][0]
    expect(z.language).toBe("sk")
    expect(z.statementText).toContain("Potvrdzujem")
  })
})
