/**
 * autoProvision.test.ts — kto sa smie založiť sám (D47).
 *
 * Je to zmena brány: dovtedy platilo „kto nie je pozvaný, nevojde". Teraz
 * môže vojsť aj ten, koho nikto nepozval — ak je z domény, ktorú organizácia
 * povolila, a prišiel overeným kontom. Preto sa testuje presne to, čo môže
 * pustiť dnu niekoho cudzieho.
 */

import { describe, it, expect } from "vitest"
import { isDomainAllowed, addressDomain } from "../src/lib/persons"
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
  const POVOLENE = ["futbalsfz.sk", "sfzmarketing.sk"]

  it("adresa z povolenej domény prejde", () => {
    expect(isDomainAllowed("jan.letko@futbalsfz.sk", POVOLENE)).toBe(true)
    expect(isDomainAllowed("kto@sfzmarketing.sk", POVOLENE)).toBe(true)
  })

  it("veľkosť písmen nerozhoduje", () => {
    expect(isDomainAllowed("Jan.Letko@FutbalSFZ.sk", POVOLENE)).toBe(true)
  })

  it("podobná doména neprejde", () => {
    // Toto je celý dôvod, prečo sa porovnáva celá doména a nie koncovka.
    // `endsWith` by pustilo `zlyfutbalsfz.sk` aj `futbalsfz.sk.utocnik.com`.
    expect(isDomainAllowed("kto@zlyfutbalsfz.sk", POVOLENE)).toBe(false)
    expect(isDomainAllowed("kto@futbalsfz.sk.utocnik.com", POVOLENE)).toBe(false)
    expect(isDomainAllowed("kto@futbalsfz.sk.sk", POVOLENE)).toBe(false)
  })

  it("poddoména neprejde, kým ju niekto nevypíše", () => {
    expect(isDomainAllowed("kto@mail.futbalsfz.sk", POVOLENE)).toBe(false)
    expect(isDomainAllowed("kto@mail.futbalsfz.sk", ["mail.futbalsfz.sk"])).toBe(true)
  })

  it("prázdny zoznam nepustí nikoho", () => {
    // Najdôležitejší test v súbore: keby prázdny zoznam znamenal „hocikto",
    // stačilo by ho pri zakladaní organizácie nevyplniť.
    expect(isDomainAllowed("jan.letko@futbalsfz.sk", [])).toBe(false)
    expect(isDomainAllowed("jan.letko@futbalsfz.sk", undefined)).toBe(false)
  })

  it("čo nie je adresa, neprejde", () => {
    expect(isDomainAllowed("jan.letko", POVOLENE)).toBe(false)
    expect(isDomainAllowed("", POVOLENE)).toBe(false)
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
