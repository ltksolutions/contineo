/**
 * tenantAdmin.test.ts — zápisová strana tenantov (Fáza 5b, rozsahy B a C).
 *
 * Testuje sa to, čo môže spôsobiť škodu: prevzatie cudzej domény, organizácia
 * bez domény (portál by sa nikde neukázal) a to, že sa nevyplnené pole
 * nezmaže. Vzhľad ani texty nie.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const { findOne, updateOne, insertOne, invalidateTenants, codes } = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
  insertOne: vi.fn(),
  invalidateTenants: vi.fn(),
  /** Obsadené kódy — potrebuje ich návrh voľného variantu pri kolízii. */
  codes: vi.fn(() => [] as { companyCode: string }[]),
}))

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async () => ({
    findOne,
    updateOne,
    insertOne,
    find: () => ({ sort: () => ({ toArray: async () => codes() }), toArray: async () => codes() }),
  })),
}))

vi.mock("../src/lib/tenants", async () => {
  const real = await vi.importActual<typeof import("../src/lib/tenants")>("../src/lib/tenants")
  return { ...real, invalidateTenants }
})

import {
  assertHostnamesFree,
  saveTenant,
  createTenant,
  normalizeCompanyCode,
  normalizeHostnames,
  DomainOwnedError,
  TenantValidationError,
} from "../src/lib/tenantAdmin"

const SFZ = {
  companyCode: "SFZ",
  hostnames: ["intranet.futbalsfz.sk"],
  branding: { displayName: "Slovenský futbalový zväz" },
  defaultLanguage: "sk",
  languages: ["sk"],
  status: "active",
}

beforeEach(() => {
  findOne.mockReset()
  updateOne.mockReset()
  insertOne.mockReset()
  invalidateTenants.mockReset()
})

describe("vlastníctvo domén", () => {
  it("cudziu doménu odmietne, neprepíše", async () => {
    findOne.mockResolvedValue(SFZ)

    await expect(assertHostnamesFree("KLUB", ["intranet.futbalsfz.sk"]))
      .rejects.toBeInstanceOf(DomainOwnedError)
  })

  it("chyba povie, komu doména patrí", async () => {
    findOne.mockResolvedValue(SFZ)

    await expect(assertHostnamesFree("KLUB", ["intranet.futbalsfz.sk"]))
      .rejects.toThrow(/SFZ/)
  })

  it("voľná doména prejde", async () => {
    findOne.mockResolvedValue(null)

    await expect(assertHostnamesFree("KLUB", ["klub.contineo.app"])).resolves.toBeUndefined()
  })

  it("prázdny zoznam sa do databázy ani nepýta", async () => {
    await assertHostnamesFree("KLUB", [])

    expect(findOne).not.toHaveBeenCalled()
  })
})

describe("normalizácia", () => {
  it("kód sa prevedie na veľké písmená", () => {
    expect(normalizeCompanyCode(" klub ")).toBe("KLUB")
  })

  it("nezmyselný kód neprejde", () => {
    expect(() => normalizeCompanyCode("a")).toThrow(TenantValidationError)
    expect(() => normalizeCompanyCode("má medzeru")).toThrow(TenantValidationError)
  })

  it("domény z textu rozdelí a zbaví duplicít", () => {
    expect(normalizeHostnames("A.sk\nb.sk, a.sk")).toEqual(["a.sk", "b.sk"])
  })
})

describe("uloženie zmeny", () => {
  it("nevyplnené pole sa nemení, nemaže", async () => {
    // Formulár posiela len to, čo v ňom je. Keby sa `undefined` zapisovalo,
    // uloženie názvu by zmazalo logo.
    findOne.mockResolvedValue(SFZ)

    await saveTenant("SFZ", { displayName: "Nový názov" }, "kto@ltk.solutions")

    const set = updateOne.mock.calls[0][1].$set
    expect(set["branding.displayName"]).toBe("Nový názov")
    expect(set).not.toHaveProperty("branding.logoUrl")
  })

  it("zapíše, kto zmenu spravil", async () => {
    findOne.mockResolvedValue(SFZ)

    await saveTenant("SFZ", { displayName: "X" }, "kto@ltk.solutions")

    expect(updateOne.mock.calls[0][1].$set.updatedBy).toBe("kto@ltk.solutions")
  })

  it("zruší pamäť tenantov, inak by sa zmena prejavila až o 5 minút", async () => {
    findOne.mockResolvedValue(SFZ)

    await saveTenant("SFZ", { displayName: "X" }, "kto@ltk.solutions")

    expect(invalidateTenants).toHaveBeenCalled()
  })

  it("odobratie poslednej domény neprejde", async () => {
    // Organizácia bez domény existuje, ale jej portál sa nikde neukáže —
    // a nikto by nevedel prečo.
    findOne.mockResolvedValue(SFZ)

    await expect(saveTenant("SFZ", { hostnames: [] }, "kto@ltk.solutions"))
      .rejects.toThrow(TenantValidationError)
    expect(updateOne).not.toHaveBeenCalled()
  })

  it("neexistujúcu organizáciu nezaloží potichu", async () => {
    findOne.mockResolvedValue(null)

    await expect(saveTenant("NIKDO", { displayName: "X" }, "kto@ltk.solutions"))
      .rejects.toThrow(TenantValidationError)
    expect(updateOne).not.toHaveBeenCalled()
  })
})

describe("založenie", () => {
  it("existujúci kód neprepíše", async () => {
    findOne.mockResolvedValue(SFZ)

    await expect(createTenant("SFZ", { displayName: "Iný" }, "kto@ltk.solutions"))
      .rejects.toThrow(/už existuje/)
    expect(insertOne).not.toHaveBeenCalled()
  })

  it("pri kolízii povie, ktorý kód je voľný — bez skriptu inak admin háda", async () => {
    findOne.mockResolvedValue(SFZ)
    codes.mockReturnValue([{ companyCode: "SFZ" }, { companyCode: "SFZ2" }])

    const error = await createTenant("SFZ", { displayName: "Iný" }, "kto@ltk.solutions")
      .catch((e: unknown) => e as TenantValidationError)

    expect(error).toBeInstanceOf(TenantValidationError)
    // Návrh počíta tá istá funkcia ako formulár, takže obe strany dôjdu k tomu istému.
    expect((error as TenantValidationError).params).toMatchObject({ code: "SFZ", free: "SFZ3" })
    codes.mockReturnValue([])
  })

  it("bez názvu neprejde", async () => {
    findOne.mockResolvedValue(null)

    await expect(createTenant("KLUB", { displayName: "  " }, "kto@ltk.solutions"))
      .rejects.toThrow(TenantValidationError)
  })

  it("cudziu doménu odmietne ešte pred zápisom", async () => {
    findOne
      .mockResolvedValueOnce(null)   // kód je voľný
      .mockResolvedValueOnce(SFZ)    // doména nie je

    await expect(
      createTenant("KLUB", { displayName: "Klub", hostnames: ["intranet.futbalsfz.sk"] }, "kto@ltk.solutions"),
    ).rejects.toBeInstanceOf(DomainOwnedError)
    expect(insertOne).not.toHaveBeenCalled()
  })
})

describe("predvoľba telefónu (D86)", () => {
  it("uloží sa aj bez medzier a oddeľovačov", async () => {
    findOne.mockResolvedValue(SFZ)
    await saveTenant("SFZ", { phonePrefix: " +4 21 " }, "kto@ltk.solutions")
    expect(updateOne.mock.calls[0][1].$set.phonePrefix).toBe("+421")
  })

  it("prázdna hodnota sa zapíše prázdna — je to zrušenie, nie „nemeniť“", async () => {
    // Bez toho by sa raz nastavená predvoľba nedala odstrániť.
    findOne.mockResolvedValue(SFZ)
    await saveTenant("SFZ", { phonePrefix: "" }, "kto@ltk.solutions")
    expect(updateOne.mock.calls[0][1].$set.phonePrefix).toBe("")
  })

  it("čo nie je predvoľba, sa neuloží", async () => {
    // Hodnota sa lepí pred zvyšok čísla — písmeno v nej by vyrobilo neplatné
    // číslo pri každej osobe a prejavilo by sa to až pri volaní.
    findOne.mockResolvedValue(SFZ)
    await expect(saveTenant("SFZ", { phonePrefix: "421" }, "kto@ltk.solutions")).rejects.toThrow()
    await expect(saveTenant("SFZ", { phonePrefix: "+4x1" }, "kto@ltk.solutions")).rejects.toThrow()
    await expect(saveTenant("SFZ", { phonePrefix: "+0421" }, "kto@ltk.solutions")).rejects.toThrow()
  })

  it("nevyplnené pole sa nedotkne uloženej predvoľby", async () => {
    findOne.mockResolvedValue(SFZ)
    await saveTenant("SFZ", { displayName: "X" }, "kto@ltk.solutions")
    expect(updateOne.mock.calls[0][1].$set).not.toHaveProperty("phonePrefix")
  })
})
