/**
 * appNav.test.ts — položky navigácie shellu a hranica shellu.
 *
 * Dve veci, ktoré sa pokazia ticho: odkaz na sekciu, do ktorej človek nesmie
 * (prezradí, čo v systéme je), a stránka, ktorá príde o menu v hlavičke skôr,
 * než ho dostane od shellu.
 */

import { describe, it, expect } from "vitest"
import { navItems, normalizeLayout, isActive } from "../src/lib/appNav"
import { isShellRoute, SHELL_ROUTES } from "../src/lib/shellRoutes"

describe("položky navigácie", () => {
  it("bez rolí zostane to, čo vidí každý prihlásený", () => {
    expect(navItems({}).map(o => o.href)).toEqual(["/", "/documents", "/golden-set"])
  })

  it("rola pridá práve svoju sekciu", () => {
    expect(navItems({ isContentManager: true }).map(o => o.href)).toContain("/library")
    expect(navItems({ isHr: true }).map(o => o.href)).toContain("/hr")
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

  it("domov svieti len na domove", () => {
    // Inak by `/` bolo aktívne na každej stránke.
    expect(isActive("/library", "/")).toBe(false)
    expect(isActive("/", "/")).toBe(true)
  })

  it("podobný začiatok cesty nestačí", () => {
    expect(isActive("/librarian", "/library")).toBe(false)
  })
})

describe("hranica shellu", () => {
  it("zhoda je presná, nie na prefix", () => {
    // `/library/new` v shelli zatiaľ nie je. Keby ho `Header` považoval za
    // shell route, skryl by mu menu a nedal by mu namiesto neho nič.
    expect(isShellRoute("/library")).toBe(true)
    expect(isShellRoute("/library/new")).toBe(false)
    expect(isShellRoute("/")).toBe(false)
  })

  it("každá cesta v zozname je absolútna", () => {
    for (const route of SHELL_ROUTES) expect(route.startsWith("/")).toBe(true)
  })
})
