/**
 * autoProvision.test.ts — kto sa smie založiť sám (D47).
 *
 * Je to zmena brány: dovtedy platilo „kto nie je pozvaný, nevojde". Teraz
 * môže vojsť aj ten, koho nikto nepozval — ak je z domény, ktorú organizácia
 * povolila, a prišiel overeným kontom. Preto sa testuje presne to, čo môže
 * pustiť dnu niekoho cudzieho.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const updates: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean }[] = []
let upserted = 0
vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async () => ({
    updateOne: async (filter: Record<string, unknown>, update: Record<string, unknown>, opts?: { upsert?: boolean }) => {
      updates.push({ filter, update, upsert: Boolean(opts?.upsert) })
      return opts?.upsert ? { upsertedCount: upserted } : { modifiedCount: 1 }
    },
  })),
}))

import { isDomainAllowed, addressDomain, createFromDomain } from "../src/lib/persons"
import { normalizeDomains } from "../src/lib/tenantAdmin"

describe("domena adresy", () => {
  it("vyberie časť za posledným zavináčom", () => {
    expect(addressDomain("jan.letko@futbalsfz.sk")).toBe("futbalsfz.sk")
    expect(addressDomain("a@b@futbalsfz.sk")).toBe("futbalsfz.sk")
  })

  it("čo nie je adresa, nemá doménu", () => {
    expect(addressDomain("jan.letko")).toBe("")
    expect(addressDomain("")).toBe("")
  })
})

describe("povolene domeny", () => {
  const ALLOWED = ["futbalsfz.sk", "sfzmarketing.sk"]

  it("adresa z povolenej domény prejde", () => {
    expect(isDomainAllowed("jan.letko@futbalsfz.sk", ALLOWED)).toBe(true)
    expect(isDomainAllowed("kto@sfzmarketing.sk", ALLOWED)).toBe(true)
  })

  it("veľkosť písmen nerozhoduje", () => {
    expect(isDomainAllowed("Jan.Letko@FutbalSFZ.sk", ALLOWED)).toBe(true)
  })

  it("podobná doména neprejde", () => {
    // Toto je celý dôvod, prečo sa porovnáva celá doména a nie koncovka.
    // `endsWith` by pustilo `zlyfutbalsfz.sk` aj `futbalsfz.sk.utocnik.com`.
    expect(isDomainAllowed("kto@zlyfutbalsfz.sk", ALLOWED)).toBe(false)
    expect(isDomainAllowed("kto@futbalsfz.sk.utocnik.com", ALLOWED)).toBe(false)
    expect(isDomainAllowed("kto@futbalsfz.sk.sk", ALLOWED)).toBe(false)
  })

  it("poddoména neprejde, kým ju niekto nevypíše", () => {
    expect(isDomainAllowed("kto@mail.futbalsfz.sk", ALLOWED)).toBe(false)
    expect(isDomainAllowed("kto@mail.futbalsfz.sk", ["mail.futbalsfz.sk"])).toBe(true)
  })

  it("prázdny zoznam nepustí nikoho", () => {
    // Najdôležitejší test v súbore: keby prázdny zoznam znamenal „hocikto",
    // stačilo by ho pri zakladaní organizácie nevyplniť.
    expect(isDomainAllowed("jan.letko@futbalsfz.sk", [])).toBe(false)
    expect(isDomainAllowed("jan.letko@futbalsfz.sk", undefined)).toBe(false)
  })

  it("čo nie je adresa, neprejde", () => {
    expect(isDomainAllowed("jan.letko", ALLOWED)).toBe(false)
    expect(isDomainAllowed("", ALLOWED)).toBe(false)
  })
})

describe("normalizacia domen z formulara", () => {
  it("zahodí zavináč, medzery a veľké písmená", () => {
    expect(normalizeDomains("@FutbalSFZ.sk\n  sfzmarketing.sk  ")).toEqual([
      "futbalsfz.sk", "sfzmarketing.sk",
    ])
  })

  it("zahodí protokol, ak ho tam niekto prilepí", () => {
    expect(normalizeDomains("https://futbalsfz.sk")).toEqual(["futbalsfz.sk"])
  })

  it("nezdvojí to isté", () => {
    expect(normalizeDomains("futbalsfz.sk, FUTBALSFZ.SK")).toEqual(["futbalsfz.sk"])
  })

  it("zahodí, čo nie je doména", () => {
    // Vrátane holej koncovky — `.sk` v zozname by bola diera cez pol internetu.
    expect(normalizeDomains("futbalsfz.sk, nezmysel, .sk, a b c")).toEqual(["futbalsfz.sk"])
  })

  it("prázdny vstup dá prázdny zoznam", () => {
    expect(normalizeDomains("")).toEqual([])
    expect(normalizeDomains([])).toEqual([])
  })
})

describe("createFromDomain — externá osoba z widgetu (30. 10. 2026)", () => {
  beforeEach(() => { updates.length = 0 })

  it("nová adresa sa založí a nič sa nepovyšuje", async () => {
    upserted = 1
    expect(await createFromDomain("SFZ", "Nova.Kolegyna@futbalsfz.sk", "Nová Kolegyňa", "auto:entra")).not.toBeNull()
    expect(updates).toHaveLength(1)
  })

  it("existujúca externá osoba sa povýši na zamestnanca, vyradená nie", async () => {
    upserted = 0
    expect(await createFromDomain("SFZ", "kolega@futbalsfz.sk", "Kolega", "auto:entra")).toBeNull()
    expect(updates[1]).toMatchObject({
      filter: { companyCode: "SFZ", email: "kolega@futbalsfz.sk", personType: "external", status: { $ne: "inactive" } },
      update: { $set: { personType: "employee", promotedBy: "auto:entra" } },
      upsert: false,
    })
  })
})
