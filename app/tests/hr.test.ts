/**
 * hr.test.ts — kto sa dostane k prehľadu organizácie (D33, D32).
 *
 * Táto obrazovka ukazuje **menovite**, kto si čo neprečítal. Je to
 * najcitlivejší výpis v systéme, a preto sa testuje brána, nie vzhľad:
 * rola aj príslušnosť k organizácii musia platiť naraz.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const { currentTenant, currentPerson } = vi.hoisted(() => ({
  currentTenant: vi.fn(),
  currentPerson: vi.fn(),
}))

vi.mock("../src/lib/session", () => ({ currentTenant, currentPerson }))
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))

import { hrContext, isHr, HR_ROLE } from "../src/lib/hr"
import { PLATFORM_ROLE } from "../src/lib/admin"
import type { Person } from "../src/lib/persons"
import type { Tenant } from "../src/lib/tenants"

function tenant(companyCode = "SFZ"): Tenant {
  return {
    companyCode,
    hostnames: ["intranet.futbalsfz.sk"],
    branding: { displayName: "SFZ" },
    defaultLanguage: "sk",
    languages: ["sk"],
    status: "active",
  }
}

function person(over: Partial<Person> = {}): Person {
  return {
    id: "p1",
    companyCode: "SFZ",
    email: "hr@futbalsfz.sk",
    fullName: "Personalista",
    personType: "employee",
    status: "active",
    language: "sk",
    tracks: [],
    roles: [HR_ROLE],
    ...over,
  } as Person
}

beforeEach(() => {
  currentTenant.mockReset()
  currentPerson.mockReset()
})

describe("brána HR obrazovky", () => {
  it("personalista svojej organizácie prejde", async () => {
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(person())

    expect((await hrContext()).state).toBe("ready")
  })

  it("bez roly neprejde ani vlastný človek", async () => {
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(person({ roles: [] }))

    expect((await hrContext()).state).toBe("forbidden")
  })

  it("rola v cudzej organizácii neplatí", async () => {
    // Rola sama nestačí. Inak by stačilo pridať ju človeku jednej organizácie
    // a videl by, kto v druhej nepotvrdil (D32).
    currentTenant.mockResolvedValue(tenant("SFZ"))
    currentPerson.mockResolvedValue(person({ companyCode: "LTK" }))

    expect((await hrContext()).state).toBe("forbidden")
  })

  it("správca platformy sem nepatrí", async () => {
    // D41 mu dáva prehľad počtov naprieč tenantmi — nie menovitý zoznam
    // ľudí, ktorí si niečo neprečítali. To je obsah, nie prehľad.
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(person({ roles: [PLATFORM_ROLE] }))

    expect((await hrContext()).state).toBe("forbidden")
  })

  it("neprihlásený dostane pokyn prihlásiť sa, nie zákaz", async () => {
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(null)

    expect((await hrContext()).state).toBe("not-signed-in")
  })

  it("neznámy hostiteľ neprejde, aj keby bol človek personalista", async () => {
    currentTenant.mockResolvedValue(null)
    currentPerson.mockResolvedValue(person())

    expect((await hrContext()).state).toBe("unknown-host")
  })

  it("výpadok databázy obrazovku neotvorí", async () => {
    // Chyba pri načítaní tenanta nesmie skončiť „nevieme, tak pustíme".
    currentTenant.mockRejectedValue(new Error("cluster nedostupný"))
    currentPerson.mockResolvedValue(person())

    expect((await hrContext()).state).toBe("unknown-host")
  })

  it("rolu má len ten, kto ju má vypísanú", () => {
    expect(isHr(person())).toBe(true)
    expect(isHr(person({ roles: [] }))).toBe(false)
    expect(isHr(null)).toBe(false)
  })
})
