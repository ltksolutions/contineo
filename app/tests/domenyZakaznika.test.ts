/**
 * domenyZakaznika.test.ts — doména, o ktorú si zákazník požiada sám (D48).
 *
 * Toto je najcitlivejšia vec, akú si zákazník smie nastaviť: doména sa
 * zapisuje do **nášho** projektu vo Verceli a `*.contineo.app` už dnes smeruje
 * na naše nasadenie. Testuje sa preto presne to, čo by sa dalo zneužiť.
 */

import { describe, it, expect } from "vitest"
import { nasaDomena, pokynPreDomenu, NASE_DOMENY } from "../src/lib/customerDomains"

describe("nase domeny si zakaznik nepridelí", () => {
  it("subdoménu na contineo.app nie", () => {
    // Wildcard `*.contineo.app` už smeruje na naše nasadenie, takže zápisom
    // by sa doména okamžite rozsvietila pod našou značkou. Kontrola „nepatrí
    // inému tenantovi" na to nestačí — nepatrí zatiaľ nikomu.
    expect(nasaDomena("admin.contineo.app")).toBeTruthy()
    expect(nasaDomena("sfz.contineo.app")).toBeTruthy()
    expect(nasaDomena("contineo.app")).toBeTruthy()
  })

  it("ani vercel.app a localhost", () => {
    expect(nasaDomena("nieco.vercel.app")).toBeTruthy()
    expect(nasaDomena("localhost")).toBeTruthy()
    expect(nasaDomena("sfz.localhost")).toBeTruthy()
  })

  it("cudzia doména prejde", () => {
    expect(nasaDomena("intranet.futbalsfz.sk")).toBeNull()
    expect(nasaDomena("futbalsfz.sk")).toBeNull()
  })

  it("podobný názov nie je naša doména", () => {
    // `endsWith("contineo.app")` by odmietlo aj legitímne `mojecontineo.app`.
    expect(nasaDomena("mojecontineo.app")).toBeNull()
    expect(nasaDomena("contineo.app.utocnik.sk")).toBeNull()
  })

  it("dôvod sa dá ukázať človeku, nie je to len `true`", () => {
    expect(nasaDomena("admin.contineo.app")).toMatch(/contineo\.app/)
  })

  it("zoznam našich domén nie je prázdny", () => {
    // Prázdny zoznam by ticho povolil všetko vrátane našich vlastných.
    expect(NASE_DOMENY.length).toBeGreaterThan(0)
  })
})

describe("pokyn pre DNS", () => {
  it("pri subdoméne pomenuje jej prvú časť", () => {
    const p = pokynPreDomenu("intranet.futbalsfz.sk")
    expect(p).toMatchObject({ typ: "CNAME", nazov: "intranet" })
    expect(p?.hodnota).toContain("vercel-dns")
  })

  it("pri koreňovej doméne je to zavináč", () => {
    expect(pokynPreDomenu("futbalsfz.sk")).toMatchObject({ nazov: "@" })
  })

  it("kde netreba nič, nevracia pokyn", () => {
    // Lokálne adresy a naše subdomény sa vo Verceli nenastavujú.
    expect(pokynPreDomenu("sfz.localhost")).toBeNull()
    expect(pokynPreDomenu("test.contineo.app")).toBeNull()
  })
})
