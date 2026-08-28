/**
 * tenants.test.ts — rozlíšenie tenanta podľa hostiteľa (D29).
 *
 * Testuje sa to, čo rozhoduje o prístupe: normalizácia hostiteľa (aby sa
 * `APP.Contineo.App:443` a `app.contineo.app` nesprávali rozdielne),
 * odmietnutie neznámej domény a to, že hierarchia ani prihlásenie samo osebe
 * nestačia. Vzhľad sa netestuje reťazec po reťazci — je to text, nie funkcia.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const findOne = vi.fn()
vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async () => ({ findOne })),
}))

import {
  normalizeHostname,
  normalizeTenant,
  resolveTenant,
  requireTenant,
  invalidateTenants,
  personBelongsToTenant,
  UnknownHostError,
  TENANTS_COLLECTION,
} from "../src/lib/tenants"
import type { Tenant } from "../src/lib/tenants"
import type { Person } from "../src/lib/persons"

function tenant(over: Partial<Tenant> = {}): Tenant {
  return {
    companyCode: "SFZ",
    hostnames: ["intranet.futbalsfz.sk"],
    branding: { displayName: "Slovenský futbalový zväz" },
    defaultLanguage: "sk",
    languages: ["sk", "cs", "en"],
    status: "active",
    ...over,
  }
}

function person(over: Partial<Person> = {}): Person {
  return {
    id: "p1",
    companyCode: "SFZ",
    email: "a@b.sk",
    fullName: "A B",
    personType: "employee",
    status: "active",
    language: "sk",
    tracks: [],
    roles: [],
    ...over,
  } as Person
}

beforeEach(() => {
  findOne.mockReset()
  invalidateTenants()
})

describe("normalizeHostname", () => {
  it("veľkosť písmen nerozhoduje", () => {
    expect(normalizeHostname("APP.Contineo.App")).toBe("app.contineo.app")
  })

  it("port sa odreže", () => {
    expect(normalizeHostname("localhost:3000")).toBe("localhost")
  })

  it("koncová bodka sa odreže — absolútny tvar mena je to isté meno", () => {
    expect(normalizeHostname("intranet.futbalsfz.sk.")).toBe("intranet.futbalsfz.sk")
  })

  it("z reťaze proxy platí prvá hodnota", () => {
    expect(normalizeHostname("app.contineo.app, proxy.internal")).toBe("app.contineo.app")
  })

  it("IPv6 v zátvorkách stratí zátvorky aj port", () => {
    expect(normalizeHostname("[2001:db8::1]:8080")).toBe("2001:db8::1")
  })

  it("IPv6 bez zátvoriek sa nezamení za port", () => {
    expect(normalizeHostname("2001:db8::1")).toBe("2001:db8::1")
  })

  it("www sa NEodstraňuje — je to iné meno", () => {
    expect(normalizeHostname("www.contineo.app")).toBe("www.contineo.app")
  })

  it("prázdny vstup dá prázdny reťazec, nie výnimku", () => {
    expect(normalizeHostname(null)).toBe("")
    expect(normalizeHostname(undefined)).toBe("")
    expect(normalizeHostname("   ")).toBe("")
  })
})

describe("resolveTenant", () => {
  it("nájde tenanta podľa hostiteľa a hľadá len aktívnych", async () => {
    findOne.mockResolvedValue(tenant())
    const t = await resolveTenant("intranet.futbalsfz.sk")
    expect(t?.companyCode).toBe("SFZ")
    expect(findOne).toHaveBeenCalledWith({
      hostnames: "intranet.futbalsfz.sk",
      status: "active",
    })
  })

  it("hostiteľ sa pred hľadaním normalizuje", async () => {
    findOne.mockResolvedValue(tenant())
    await resolveTenant("Intranet.FutbalSFZ.sk:443")
    expect(findOne).toHaveBeenCalledWith({
      hostnames: "intranet.futbalsfz.sk",
      status: "active",
    })
  })

  it("neznámy hostiteľ je null, nie predvolený tenant", async () => {
    findOne.mockResolvedValue(null)
    expect(await resolveTenant("nieco.ine.sk")).toBeNull()
  })

  it("prázdny hostiteľ sa do databázy ani nedostane", async () => {
    expect(await resolveTenant("")).toBeNull()
    expect(findOne).not.toHaveBeenCalled()
  })

  it("výsledok sa drží v cache — druhé volanie nejde do databázy", async () => {
    findOne.mockResolvedValue(tenant())
    await resolveTenant("intranet.futbalsfz.sk")
    await resolveTenant("intranet.futbalsfz.sk")
    expect(findOne).toHaveBeenCalledTimes(1)
  })

  it("cachuje sa aj neúspech — inak by vymyslené mená chodili do databázy", async () => {
    findOne.mockResolvedValue(null)
    await resolveTenant("a.b.c")
    await resolveTenant("a.b.c")
    expect(findOne).toHaveBeenCalledTimes(1)
  })

  it("invalidateTenants zahodí cache", async () => {
    findOne.mockResolvedValue(tenant())
    await resolveTenant("intranet.futbalsfz.sk")
    invalidateTenants("intranet.futbalsfz.sk")
    await resolveTenant("intranet.futbalsfz.sk")
    expect(findOne).toHaveBeenCalledTimes(2)
  })

  it("výpadok databázy neotvára prístup — chyba sa vyhodí", async () => {
    findOne.mockRejectedValue(new Error("spojenie"))
    await expect(resolveTenant("intranet.futbalsfz.sk")).rejects.toThrow("spojenie")
  })
})

describe("requireTenant", () => {
  it("neznámy hostiteľ je chyba s uvedeným menom", async () => {
    findOne.mockResolvedValue(null)
    await expect(requireTenant("cudzia.sk")).rejects.toBeInstanceOf(UnknownHostError)
  })

  it("známy hostiteľ vráti tenanta", async () => {
    findOne.mockResolvedValue(tenant())
    expect((await requireTenant("intranet.futbalsfz.sk")).companyCode).toBe("SFZ")
  })
})

describe("normalizeTenant", () => {
  it("neznámy jazyk v zozname sa zahodí", () => {
    const t = normalizeTenant(tenant({ languages: ["sk", "de" as never, "en"] }))
    expect(t.languages).toEqual(["sk", "en"])
  })

  it("prázdny zoznam jazykov spadne na predvolený", () => {
    const t = normalizeTenant(tenant({ languages: [], defaultLanguage: "cs" }))
    expect(t.languages).toEqual(["cs"])
  })

  it("chýbajúci názov nahradí companyCode — stránka sa musí dať vykresliť", () => {
    const t = normalizeTenant(tenant({ branding: { displayName: "  " } }))
    expect(t.branding.displayName).toBe("SFZ")
  })
})

describe("personBelongsToTenant", () => {
  it("zhodný companyCode patrí", () => {
    expect(personBelongsToTenant(person(), tenant())).toBe(true)
  })

  it("iný companyCode nepatrí, aj keď je človek prihlásený", () => {
    expect(personBelongsToTenant(person({ companyCode: "BFZ" }), tenant())).toBe(false)
  })

  it("hierarchia nedáva prístup — dcéra nie je matka (D32)", () => {
    const child = person({ companyCode: "BFZ" })
    const parent = tenant({ companyCode: "SFZ" })
    expect(personBelongsToTenant(child, parent)).toBe(false)
  })
})

describe("konštanty", () => {
  it("kolekcia sa volá tenants", () => {
    expect(TENANTS_COLLECTION).toBe("tenants")
  })
})
