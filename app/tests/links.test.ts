/**
 * links.test.ts — prihlasovací odkaz vedie tam, odkiaľ človek prišiel.
 *
 * `NEXTAUTH_URL` je jedna hodnota na celé nasadenie, domén máme viac (D29).
 * Bez prepisu by človek z `intranet.futbalsfz.sk` dostal odkaz na
 * `app.contineo.app`, prihlásil sa tam a sušienka by mu ostala na doméne,
 * na ktorú sa už nevráti. Testuje sa aj to, čo sa prepísať **nesmie**.
 */

import { describe, it, expect } from "vitest"
import { rewriteLinkHost } from "../src/lib/auth"
import { signInEmail } from "../src/lib/ecomail"

const BASE = "https://app.contineo.app/api/auth/callback/email?token=abc&email=x%40y.sk"

describe("rewriteLinkHost", () => {
  it("prepíše hostiteľa v odkaze", () => {
    const out = rewriteLinkHost(BASE, "intranet.futbalsfz.sk")
    expect(new URL(out).host).toBe("intranet.futbalsfz.sk")
  })

  it("token a e-mail zostávajú nedotknuté", () => {
    const out = new URL(rewriteLinkHost(BASE, "intranet.futbalsfz.sk"))
    expect(out.searchParams.get("token")).toBe("abc")
    expect(out.searchParams.get("email")).toBe("x@y.sk")
    expect(out.pathname).toBe("/api/auth/callback/email")
  })

  it("prepíše aj callbackUrl, keď ukazoval na pôvodnú doménu", () => {
    const url = `${BASE}&callbackUrl=${encodeURIComponent("https://app.contineo.app/dokumenty")}`
    const out = new URL(rewriteLinkHost(url, "intranet.futbalsfz.sk"))
    expect(out.searchParams.get("callbackUrl")).toBe("https://intranet.futbalsfz.sk/dokumenty")
  })

  it("cudziu adresu v callbackUrl NEPREPÍŠE — prepis by ju zamaskoval", () => {
    const foreign = "https://utocnik.example/zle"
    const url = `${BASE}&callbackUrl=${encodeURIComponent(foreign)}`
    const out = new URL(rewriteLinkHost(url, "intranet.futbalsfz.sk"))
    expect(out.searchParams.get("callbackUrl")).toBe(foreign)
  })

  it("port sa zachová — lokálny vývoj beží na localhost:3000", () => {
    const out = rewriteLinkHost("http://localhost:3000/api/auth/callback/email?token=a", "localhost:3001")
    expect(new URL(out).host).toBe("localhost:3001")
  })

  it("rovnaký hostiteľ nič nemení", () => {
    expect(rewriteLinkHost(BASE, "app.contineo.app")).toBe(BASE)
  })

  it("prázdny hostiteľ nič nemení", () => {
    expect(rewriteLinkHost(BASE, "")).toBe(BASE)
  })

  it("nepoužiteľná adresa sa vráti taká, aká prišla", () => {
    expect(rewriteLinkHost("toto nie je adresa", "intranet.futbalsfz.sk")).toBe("toto nie je adresa")
  })
})

describe("signInEmail so vzhľadom organizácie", () => {
  const BRANDING = {
    displayName: "Slovenský futbalový zväz",
    logoUrl: "https://intranet.futbalsfz.sk/tenants/sfz.svg",
    accentColor: "#1450DF",
  }

  it("predmet nesie názov organizácie, nie názov softvéru", () => {
    const e = signInEmail(BASE, "intranet.futbalsfz.sk", "sk", BRANDING)
    expect(e.subject).toContain("Slovenský futbalový zväz")
    expect(e.subject).not.toContain("Contineo")
  })

  it("v HTML je logo aj názov", () => {
    const e = signInEmail(BASE, "intranet.futbalsfz.sk", "sk", BRANDING)
    expect(e.html).toContain(BRANDING.logoUrl)
    expect(e.html).toContain("Slovenský futbalový zväz")
  })

  it("tlačidlo má farbu organizácie", () => {
    const e = signInEmail(BASE, "intranet.futbalsfz.sk", "sk", BRANDING)
    expect(e.html).toContain("background:#1450DF")
  })

  it("logo má prázdny alt — názov je vedľa neho ako text", () => {
    const e = signInEmail(BASE, "intranet.futbalsfz.sk", "sk", BRANDING)
    expect(e.html).toContain('alt=""')
  })

  it("bez vzhľadu zostáva značka dodávateľa a e-mail sa dá odoslať", () => {
    const e = signInEmail(BASE, "app.contineo.app", "sk")
    expect(e.subject).toContain("Contineo")
    expect(e.html).toContain("Contineo")
    expect(e.text).toContain(BASE)
  })

  it("odkaz je v HTML aj v textovej verzii", () => {
    const e = signInEmail(BASE, "intranet.futbalsfz.sk", "sk", BRANDING)
    expect(e.text).toContain(BASE)
    expect(e.html).toContain(BASE)
  })
})
