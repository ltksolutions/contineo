/**
 * domenyZakaznika.test.ts — doména, o ktorú si zákazník požiada sám (D48).
 *
 * Toto je najcitlivejšia vec, akú si zákazník smie nastaviť: doména sa
 * zapisuje do **nášho** projektu vo Verceli a `*.contineo.app` už dnes smeruje
 * na naše nasadenie. Testuje sa preto presne to, čo by sa dalo zneužiť.
 */

import { describe, it, expect } from "vitest"
import { isOurDomain, domainInstruction, OUR_DOMAINS } from "../src/lib/customerDomains"

describe("nase domeny si zakaznik nepridelí", () => {
  it("subdoménu na contineo.app nie", () => {
    // Wildcard `*.contineo.app` už smeruje na naše nasadenie, takže zápisom
    // by sa doména okamžite rozsvietila pod našou značkou. Kontrola „nepatrí
    // inému tenantovi" na to nestačí — nepatrí zatiaľ nikomu.
    expect(isOurDomain("admin.contineo.app")).toBeTruthy()
    expect(isOurDomain("sfz.contineo.app")).toBeTruthy()
    expect(isOurDomain("contineo.app")).toBeTruthy()
  })

  it("ani vercel.app a localhost", () => {
    expect(isOurDomain("nieco.vercel.app")).toBeTruthy()
    expect(isOurDomain("localhost")).toBeTruthy()
    expect(isOurDomain("sfz.localhost")).toBeTruthy()
  })

  it("cudzia doména prejde", () => {
    expect(isOurDomain("intranet.futbalsfz.sk")).toBeNull()
    expect(isOurDomain("futbalsfz.sk")).toBeNull()
  })

  it("podobný názov nie je naša doména", () => {
    // `endsWith("contineo.app")` by odmietlo aj legitímne `mojecontineo.app`.
    expect(isOurDomain("mojecontineo.app")).toBeNull()
    expect(isOurDomain("contineo.app.utocnik.sk")).toBeNull()
  })

  it("dôvod nesie kód a doménu, nie hotovú vetu", () => {
    // Vetu skladá až obrazovka, v jazyku človeka — knižnica vracia kód
    // a hodnotu, ktorá sa doň dosadí.
    expect(isOurDomain("admin.contineo.app")).toEqual({
      code: "domain.ours",
      params: { domain: "contineo.app" },
    })
  })

  it("zoznam našich domén nie je prázdny", () => {
    // Prázdny zoznam by ticho povolil všetko vrátane našich vlastných.
    expect(OUR_DOMAINS.length).toBeGreaterThan(0)
  })
})

describe("pokyn pre DNS", () => {
  it("pri subdoméne pomenuje jej prvú časť", () => {
    const p = domainInstruction("intranet.futbalsfz.sk")
    expect(p).toMatchObject({ type: "CNAME", name: "intranet" })
    expect(p?.value).toContain("vercel-dns")
  })

  it("pri koreňovej doméne je to zavináč", () => {
    expect(domainInstruction("futbalsfz.sk")).toMatchObject({ name: "@" })
  })

  it("kde netreba nič, nevracia pokyn", () => {
    // Lokálne adresy a naše subdomény sa vo Verceli nenastavujú.
    expect(domainInstruction("sfz.localhost")).toBeNull()
    expect(domainInstruction("test.contineo.app")).toBeNull()
  })
})
