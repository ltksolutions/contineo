/**
 * oauthProfil.test.ts — čo konto dokazuje a čo nie (D45).
 *
 * Toto je popri `auth.test.ts` druhé miesto, ktoré stojí medzi internými
 * smernicami zväzu a internetom. Otázka nie je „prihlásil sa" — tá je ľahká.
 * Otázka je: **dokázal, že tá adresa je jeho, a je z tej organizácie, ktorej
 * má byť?** Preto sú tu aj testy, ktoré na prvý pohľad testujú to isté.
 */

import { describe, it, expect } from "vitest"
import { overOAuthProfil } from "../src/lib/auth"

const TID_SFZ = "11111111-2222-3333-4444-555555555555"
const TID_CUDZI = "99999999-8888-7777-6666-555555555555"

function ms(over: Record<string, unknown> = {}) {
  return {
    tid: TID_SFZ,
    oid: "abc-oid",
    sub: "abc-sub",
    email: "jan.letko@futbalsfz.sk",
    ...over,
  }
}

function google(over: Record<string, unknown> = {}) {
  return {
    sub: "google-sub",
    email: "jan.letko@futbalsfz.sk",
    email_verified: true,
    hd: "futbalsfz.sk",
    ...over,
  }
}

describe("Microsoft (Entra ID)", () => {
  it("konto z povoleného tenanta prejde", () => {
    const r = overOAuthProfil("microsoft", ms(), { allowedTenantIds: [TID_SFZ] })
    expect(r).toEqual({ ok: true, email: "jan.letko@futbalsfz.sk", externalId: "abc-oid" })
  })

  it("konto z cudzieho Entra tenanta neprejde, ani keď adresa sedí", () => {
    // Toto je celý dôvod, prečo sa `tid` kontroluje. Pri režime
    // „organizations" by inak stačilo mať v cudzom Entre používateľa
    // s adresou, ktorá je v `persons`.
    const r = overOAuthProfil("microsoft", ms({ tid: TID_CUDZI }), { allowedTenantIds: [TID_SFZ] })
    expect(r).toEqual({ ok: false, dovod: "cudzi-tenant" })
  })

  it("profil bez `tid` neprejde nikdy", () => {
    // V tokene od Entry je `tid` vždy. Jeho neprítomnosť znamená, že to nie
    // je to, za čo sa to vydáva.
    expect(overOAuthProfil("microsoft", ms({ tid: undefined }), {}))
      .toEqual({ ok: false, dovod: "cudzi-tenant" })
    expect(overOAuthProfil("microsoft", ms({ tid: "" }), { allowedTenantIds: [] }))
      .toEqual({ ok: false, dovod: "cudzi-tenant" })
  })

  it("prázdny zoznam povolených tenantov znamená bez obmedzenia", () => {
    // Je to vedomé rozhodnutie správcu a je o ňom napísané na obrazovke,
    // kde sa zadáva — nie tichý predvolený stav.
    const r = overOAuthProfil("microsoft", ms({ tid: TID_CUDZI }), { allowedTenantIds: [] })
    expect(r.ok).toBe(true)
  })

  it("veľkosť písmen v `tid` nerozhoduje", () => {
    const r = overOAuthProfil("microsoft", ms({ tid: TID_SFZ.toUpperCase() }), {
      allowedTenantIds: [TID_SFZ],
    })
    expect(r.ok).toBe(true)
  })

  it("adresa sa vezme z `preferred_username`, keď `email` chýba", () => {
    // Microsoft ju vracia raz tak, raz onak — podľa toho, ako má zákazník
    // nastavené kontá.
    const r = overOAuthProfil("microsoft", ms({ email: undefined, preferred_username: "Jan.Letko@futbalsfz.sk" }), {})
    expect(r).toMatchObject({ ok: true, email: "jan.letko@futbalsfz.sk" })
  })

  it("adresa sa vezme z `upn`, keď chýbajú obe", () => {
    const r = overOAuthProfil("microsoft", ms({ email: undefined, preferred_username: undefined, upn: "a@b.sk" }), {})
    expect(r).toMatchObject({ ok: true, email: "a@b.sk" })
  })

  it("profil bez adresy neprejde", () => {
    const r = overOAuthProfil("microsoft", ms({ email: undefined }), {})
    expect(r).toEqual({ ok: false, dovod: "ziadna-adresa" })
  })

  it("hodnota bez zavináča nie je adresa", () => {
    // `preferred_username` býva niekedy len meno používateľa.
    const r = overOAuthProfil("microsoft", ms({ email: undefined, preferred_username: "jletko" }), {})
    expect(r).toEqual({ ok: false, dovod: "ziadna-adresa" })
  })

  it("prednosť má `oid` pred `sub` — je nemenné v rámci tenanta", () => {
    expect(overOAuthProfil("microsoft", ms(), {})).toMatchObject({ externalId: "abc-oid" })
    expect(overOAuthProfil("microsoft", ms({ oid: undefined }), {})).toMatchObject({ externalId: "abc-sub" })
  })
})

describe("Google", () => {
  it("overené konto z povolenej domény prejde", () => {
    const r = overOAuthProfil("google", google(), { hostedDomain: "futbalsfz.sk" })
    expect(r).toEqual({ ok: true, email: "jan.letko@futbalsfz.sk", externalId: "google-sub" })
  })

  it("neoverená adresa neprejde", () => {
    // Bez `email_verified` je adresa len to, čo si niekto napísal do profilu —
    // a spájanie kont podľa adresy by tým bolo dierou.
    expect(overOAuthProfil("google", google({ email_verified: false }), {}))
      .toEqual({ ok: false, dovod: "neovereny-email" })
    expect(overOAuthProfil("google", google({ email_verified: undefined }), {}))
      .toEqual({ ok: false, dovod: "neovereny-email" })
    expect(overOAuthProfil("google", google({ email_verified: "true" }), {}))
      .toEqual({ ok: false, dovod: "neovereny-email" })
  })

  it("konto z cudzej domény neprejde", () => {
    // `hd` v požiadavke je pre Google len nápoveda; vynucuje sa až tu.
    const r = overOAuthProfil("google", google({ hd: "inyzvaz.sk" }), { hostedDomain: "futbalsfz.sk" })
    expect(r).toEqual({ ok: false, dovod: "cudzia-domena" })
  })

  it("osobné konto (bez `hd`) neprejde, keď je doména vyžadovaná", () => {
    const r = overOAuthProfil("google", google({ hd: undefined }), { hostedDomain: "futbalsfz.sk" })
    expect(r).toEqual({ ok: false, dovod: "cudzia-domena" })
  })

  it("bez vyžadovanej domény prejde aj osobné konto", () => {
    const r = overOAuthProfil("google", google({ hd: undefined }), {})
    expect(r.ok).toBe(true)
  })
})

describe("co konto nedokazuje", () => {
  it("overenie nehovorí nič o tom, či človek patrí do organizácie", () => {
    // Kľúčové rozlíšenie celého D45: táto funkcia vracia `ok` aj pre adresu,
    // ktorá v `persons` nie je. Vstup povoľuje `persons`, nie konto.
    const r = overOAuthProfil("microsoft", ms({ email: "ktokolvek@cudzia.sk" }), {})
    expect(r).toMatchObject({ ok: true, email: "ktokolvek@cudzia.sk" })
  })
})
