/**
 * people.test.ts — správa osôb (D46).
 *
 * Dve veci, ktoré tu môžu spôsobiť škodu: pustiť k menám a adresám niekoho,
 * kto tam nemá byť, a udeliť rolu, ktorá sa z tejto obrazovky udeliť nesmie.
 * Testuje sa preto brána a to, čo sa dá zapísať.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const { currentTenant, currentPerson, getCollection } = vi.hoisted(() => ({
  currentTenant: vi.fn(),
  currentPerson: vi.fn(),
  getCollection: vi.fn(),
}))

vi.mock("../src/lib/session", () => ({ currentTenant, currentPerson }))
vi.mock("../src/lib/mongodb", () => ({ getCollection }))

import { peopleContext, isPeopleAdmin, savePerson, PEOPLE_ROLE, ASSIGNABLE_ROLES } from "../src/lib/people"
import { HR_ROLE } from "../src/lib/hr"
import { PLATFORM_ROLE } from "../src/lib/admin"
import { CONTENT_ROLE } from "../src/lib/library"
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
    email: "spravca@futbalsfz.sk",
    fullName: "Správca osôb",
    personType: "employee",
    status: "active",
    language: "sk",
    tracks: [],
    groups: [],
    roles: [PEOPLE_ROLE],
    ...over,
  } as Person
}

beforeEach(() => {
  currentTenant.mockReset()
  currentPerson.mockReset()
  getCollection.mockReset()
})

describe("brana spravy osob", () => {
  it("správca osôb vlastnej organizácie prejde", async () => {
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(person())
    expect((await peopleContext()).state).toBe("ready")
  })

  it("rola `hr` sem nestačí", async () => {
    // Sú to dve rôzne oprávnenia: `hr` je o obsahu, `people-admin` o prístupe.
    // V mnohých organizáciách to robia dvaja rôzni ľudia.
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(person({ roles: [HR_ROLE] }))
    expect((await peopleContext()).state).toBe("forbidden")
  })

  it("správca platformy sem nepatrí", async () => {
    // D41 mu dáva počty naprieč tenantmi, nie mená a adresy ľudí zákazníka.
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(person({ roles: [PLATFORM_ROLE] }))
    expect((await peopleContext()).state).toBe("forbidden")
  })

  it("rola v cudzej organizácii neplatí", async () => {
    currentTenant.mockResolvedValue(tenant("SFZ"))
    currentPerson.mockResolvedValue(person({ companyCode: "LTK" }))
    expect((await peopleContext()).state).toBe("forbidden")
  })

  it("neprihlásený dostane pokyn prihlásiť sa, nie zákaz", async () => {
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(null)
    expect((await peopleContext()).state).toBe("not-signed-in")
  })

  it("výpadok databázy obrazovku neotvorí", async () => {
    currentTenant.mockRejectedValue(new Error("cluster nedostupný"))
    currentPerson.mockResolvedValue(person())
    expect((await peopleContext()).state).toBe("unknown-host")
  })

  it("rolu má len ten, kto ju má vypísanú", () => {
    expect(isPeopleAdmin(person())).toBe(true)
    expect(isPeopleAdmin(person({ roles: [] }))).toBe(false)
    expect(isPeopleAdmin(null)).toBe(false)
  })
})

describe("co sa da priradit", () => {
  it("správcu platformy z tejto obrazovky prideliť nemožno", () => {
    // Patrí tenantovi dodávateľa a má vlastnú cestu (`npm run admin`).
    expect(ASSIGNABLE_ROLES as readonly string[]).not.toContain(PLATFORM_ROLE)
    expect(ASSIGNABLE_ROLES as readonly string[]).toEqual([HR_ROLE, PEOPLE_ROLE, CONTENT_ROLE])
  })
})

describe("ulozenie osoby", () => {
  function kolekcia(najdena: Partial<Person> | null) {
    const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
    getCollection.mockResolvedValue({
      findOne: vi.fn().mockResolvedValue(najdena),
      updateOne,
    })
    return updateOne
  }

  it("neznáma rola sa zahodí, neuloží sa", async () => {
    const updateOne = kolekcia(person())
    await savePerson("SFZ", "p1", { roles: [HR_ROLE, PLATFORM_ROLE, "vymyslena"] }, "ja@sfz.sk")
    expect(updateOne.mock.calls[0][1].$set.roles).toEqual([HR_ROLE])
  })

  it("prázdne meno sa odmietne", async () => {
    kolekcia(person())
    await expect(savePerson("SFZ", "p1", { fullName: "  " }, "ja@sfz.sk")).rejects.toThrow()
  })

  it("útvar sa dá vyprázdniť, meno nie", async () => {
    // Útvar človek naozaj mať nemusí — tam prázdno niečo znamená.
    const updateOne = kolekcia(person())
    await savePerson("SFZ", "p1", { department: "" }, "ja@sfz.sk")
    expect(updateOne.mock.calls[0][1].$set.department).toBeUndefined()
  })

  it("skupiny sa zjednotia na malé písmená a bez duplicít", async () => {
    const updateOne = kolekcia(person())
    await savePerson("SFZ", "p1", { groups: [" Rozhodcovia ", "rozhodcovia", ""] }, "ja@sfz.sk")
    expect(updateOne.mock.calls[0][1].$set.groups).toEqual(["rozhodcovia"])
  })

  it("neexistujúca osoba sa odmietne", async () => {
    kolekcia(null)
    await expect(savePerson("SFZ", "p1", { fullName: "X" }, "ja@sfz.sk")).rejects.toThrow()
  })

  it("prázdna zmena nezapíše nič", async () => {
    const updateOne = kolekcia(person())
    await savePerson("SFZ", "p1", {}, "ja@sfz.sk")
    expect(updateOne).not.toHaveBeenCalled()
  })

  it("neznámy typ osoby sa odmietne", async () => {
    kolekcia(person())
    await expect(
      savePerson("SFZ", "p1", { personType: "kapitan" as never }, "ja@sfz.sk"),
    ).rejects.toThrow()
  })
})
