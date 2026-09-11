/**
 * appNav.test.ts — položky navigácie shellu a hranica shellu.
 *
 * Dve veci, ktoré sa pokazia ticho: odkaz na sekciu, do ktorej človek nesmie
 * (prezradí, čo v systéme je), a stránka, ktorá príde o menu v hlavičke skôr,
 * než ho dostane od shellu.
 */

import { describe, it, expect } from "vitest"
import { navItems, normalizeLayout, isActive } from "../src/lib/appNav"
import { isShellRoute, WITHOUT_SHELL } from "../src/lib/shellRoutes"

describe("položky navigácie", () => {
  it("bez rolí zostane to, čo vidí každý prihlásený", () => {
    // `/approvals` je tu z toho istého dôvodu ako `/documents`: schvaľovateľ
    // je menovaný človek (D69), nie držiteľ roly, takže sa to podľa roly
    // podmieniť nedá.
    expect(navItems({}).map(o => o.href)).toEqual(["/", "/ask", "/documents", "/approvals", "/golden-set"])
  })

  it("rola pridá práve svoju sekciu", () => {
    expect(navItems({ isContentManager: true }).map(o => o.href)).toContain("/library")
    expect(navItems({ isHr: true }).map(o => o.href)).toContain("/hr")
    expect(navItems({ isHr: true }).map(o => o.href)).toContain("/hr/evidence")
    expect(navItems({ isPeopleAdmin: true }).map(o => o.href)).toContain("/people")
  })

  it("cudzia sekcia sa neukáže", () => {
    // Odkaz do sekcie, do ktorej stránka nepustí, hovorí o vnútri systému
    // viac, než ten človek potrebuje vedieť.
    const hrefs = navItems({ isHr: true }).map(o => o.href)
    expect(hrefs).not.toContain("/people")
    expect(hrefs).not.toContain("/library")
  })

  it("správcovské odkazy tu nie sú — zostávajú pod avatarom", () => {
    const hrefs = navItems({ isHr: true, isPeopleAdmin: true, isContentManager: true }).map(o => o.href)
    expect(hrefs).not.toContain("/organisation")
    expect(hrefs).not.toContain("/admin")
  })
})

describe("variant navigácie", () => {
  it("predvolený je topbar a neznáma hodnota ho nezhodí", () => {
    expect(normalizeLayout(undefined)).toBe("topbar")
    expect(normalizeLayout("nezmysel")).toBe("topbar")
    expect(normalizeLayout(["sidebar"])).toBe("topbar")
    expect(normalizeLayout("sidebar")).toBe("sidebar")
  })
})

describe("aktívna položka", () => {
  it("podstránka nechá sekciu svietiť", () => {
    expect(isActive("/library/new", "/library")).toBe(true)
    expect(isActive("/library", "/library")).toBe(true)
  })

  it("domov je Prehľad a svieti len na domove", () => {
    // Inak by `/` bolo aktívne na každej stránke.
    expect(isActive("/library", "/")).toBe(false)
    expect(isActive("/", "/")).toBe(true)
  })

  it("podobný začiatok cesty nestačí", () => {
    expect(isActive("/librarian", "/library")).toBe(false)
  })
})

describe("hranica shellu", () => {
  it("prihlásené obrazovky sú v shelli všetky", () => {
    // Zoznam sa otočil: shell je pravidlo a vymenúvajú sa výnimky. Kým bol
    // opt-in, mala polovica systému navigáciu v hlavičke a polovica pod ňou
    // — s iným poradím položiek aj iným zarovnaním obsahu.
    expect(isShellRoute("/")).toBe(true)
    expect(isShellRoute("/library")).toBe(true)
    expect(isShellRoute("/library/new")).toBe(true)
    expect(isShellRoute("/documents/sfz:stanovy")).toBe(true)
    expect(isShellRoute("/organisation")).toBe(true)
  })

  it("prihlasovacia obrazovka shell nemá", () => {
    // Navigácia obsahu by na nej viedla na miesta, kam sa neprihlásený
    // človek nedostane.
    expect(isShellRoute("/sign-in")).toBe(false)
  })

  it("hranicou výnimky je lomka, nie začiatok reťazca", () => {
    // Inak by `/sign-inx` prepadlo medzi výnimky.
    expect(isShellRoute("/sign-inx")).toBe(true)
    expect(isShellRoute("/sign-in/callback")).toBe(false)
  })

  it("každá výnimka je absolútna a bez koncovej lomky", () => {
    for (const route of WITHOUT_SHELL) {
      expect(route.startsWith("/")).toBe(true)
      expect(route.endsWith("/")).toBe(false)
    }
  })
})
