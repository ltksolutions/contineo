/**
 * admin.test.ts — kto sa dostane k správe tenantov (D41, D42).
 *
 * Toto je druhé miesto v projekte, kde chyba znamená, že niekto uvidí to, čo
 * nemá — po `auth.test.ts`. Testuje sa preto brána, nie vzhľad: obe podmienky
 * musia platiť naraz a ani jedna z nich sama nestačí.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const { currentTenant, currentPerson } = vi.hoisted(() => ({
  currentTenant: vi.fn(),
  currentPerson: vi.fn(),
}))

vi.mock("../src/lib/session", () => ({ currentTenant, currentPerson }))
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))

import { platformContext, isPlatformAdmin, PLATFORM_ROLE } from "../src/lib/admin"
import type { Person } from "../src/lib/persons"
import type { Tenant } from "../src/lib/tenants"

function tenant(companyCode = "LTK"): Tenant {
  return {
    companyCode,
    hostnames: ["app.contineo.app"],
    branding: { displayName: "Contineo" },
    defaultLanguage: "sk",
    languages: ["sk"],
    status: "active",
  }
}

function person(check: Partial<Person> = {}): Person {
  return {
    id: "p1",
    companyCode: "LTK",
    email: "office@ltk.solutions",
    fullName: "Ján Letko",
    personType: "employee",
    status: "active",
    language: "sk",
    tracks: [],
    roles: [PLATFORM_ROLE],
    ...check,
  } as Person
}

beforeEach(() => {
  currentTenant.mockReset()
  currentPerson.mockReset()
})

describe("brána správy tenantov", () => {
  it("správca dodávateľa na jeho doméne prejde", async () => {
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(person())

    expect((await platformContext()).state).toBe("ready")
  })

  it("na doméne zákazníka neprejde ani správca", async () => {
    // Prvá z dvoch podmienok (D42). Rola sama nestačí — inak by jediná chyba
    // v jej kontrole otvorila obrazovku na doméne zväzu.
    currentTenant.mockResolvedValue(tenant("SFZ"))
    currentPerson.mockResolvedValue(person())

    expect((await platformContext()).state).toBe("wrong-host")
  })

  it("na správnej doméne neprejde človek bez roly", async () => {
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(person({ roles: [] }))

    expect((await platformContext()).state).toBe("forbidden")
  })

  it("rola pridelená omylom človeku zákazníka neplatí", async () => {
    // Rola musí sedieť s tenantom dodávateľa. Bez tejto kontroly by stačilo
    // pridať `platform-admin` osobe zo zväzu a videla by prehľad ostatných.
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(person({ companyCode: "SFZ" }))

    expect((await platformContext()).state).toBe("forbidden")
  })

  it("neprihlásený dostane vlastný stav, nie zákaz", async () => {
    // Rozlíšenie je potrebné: neprihláseného treba poslať na prihlásenie,
    // nie mu tvrdiť, že stránka neexistuje.
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(null)

    expect((await platformContext()).state).toBe("not-signed-in")
  })

  it("neznámy hostiteľ neprejde", async () => {
    currentTenant.mockResolvedValue(null)
    currentPerson.mockResolvedValue(person())

    expect((await platformContext()).state).toBe("wrong-host")
  })

  it("výpadok databázy obrazovku neotvorí", async () => {
    // Keby sa výnimka prehltla a pokračovalo sa, nedostupný Atlas by bol
    // cestou dnu. Radšej zavreté.
    currentTenant.mockRejectedValue(new Error("Atlas nedostupný"))
    currentPerson.mockResolvedValue(person())
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})

    expect((await platformContext()).state).toBe("wrong-host")

    errors.mockRestore()
  })
})

describe("isPlatformAdmin", () => {
  it("pozná rolu", () => {
    expect(isPlatformAdmin(person())).toBe(true)
  })

  it("bez roly nie", () => {
    expect(isPlatformAdmin(person({ roles: ["hr"] }))).toBe(false)
  })

  it("null nie je správca", () => {
    expect(isPlatformAdmin(null)).toBe(false)
  })
})
