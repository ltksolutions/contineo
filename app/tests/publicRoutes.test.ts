/**
 * publicRoutes.test.ts — čo smie prejsť bránou prihlásenia.
 *
 * Tento test vznikol z chyby, ktorá bola v systéme od zavedenia crona:
 * `/api/cron/` v zozname chýbala, middleware naplánovaný beh odmietol skôr,
 * než sa route spustila, a **cron sa nikdy nevykonal**. Vercel neúspešný beh
 * ticho zahodí, takže to nebolo vidieť nikde.
 *
 * Testuje sa preto oboje: že prejde, čo prejsť musí, a hlavne že **neprejde
 * nič ďalšie** — zoznam sa dá rozšíriť omylom rovnako ľahko, ako sa dá
 * zabudnúť doplniť.
 */

import { describe, it, expect } from "vitest"
import { isPublicPath, PUBLIC_PATHS } from "../src/lib/publicRoutes"

describe("brána prihlásenia", () => {
  it("naplánovaný beh prejde", () => {
    // Vercel volá cron bez sedenia; autorizáciu robí route cez CRON_SECRET.
    expect(isPublicPath("/api/cron/overdue")).toBe(true)
  })

  it("prihlasovanie a značka prejdú", () => {
    expect(isPublicPath("/sign-in")).toBe(true)
    expect(isPublicPath("/api/auth/session")).toBe(true)
    expect(isPublicPath("/tenants/sfz/logo.svg")).toBe(true)
    expect(isPublicPath("/api/brand/sfz")).toBe(true)
  })

  it("obsah noriem neprejde", () => {
    // Toto je ten dôvod, pre ktorý brána existuje: bez nej by ktokoľvek na
    // internete dostal odpovede nad korpusom.
    expect(isPublicPath("/api/chat")).toBe(false)
    expect(isPublicPath("/library")).toBe(false)
    expect(isPublicPath("/documents/sfz:stanovy")).toBe(false)
    expect(isPublicPath("/hr")).toBe(false)
    expect(isPublicPath("/people")).toBe(false)
    expect(isPublicPath("/approvals")).toBe(false)
    expect(isPublicPath("/")).toBe(false)
  })

  it("cesty s lomkou sa nezamenia za podobné", () => {
    // Preto majú `/api/cron/`, `/api/brand/` a `/tenants/` v zozname lomku:
    // bez nej by `startsWith` prepustilo aj `/api/cronjobs-admin`.
    expect(isPublicPath("/api/cronjobs-admin")).toBe(false)
    expect(isPublicPath("/api/brandbook")).toBe(false)
  })

  it("známa vlastnosť: `/sign-in` a `/api/auth` sú prefixy bez lomky", () => {
    // Je to zapísané, nie prehliadnuté. Obe cesty majú podstromy
    // (`/sign-in?callbackUrl=…`, `/api/auth/callback/…`) a route s takým
    // začiatkom dnes žiadna iná neexistuje. Keby raz pribudla, prepustí ju —
    // preto to tu stojí ako pripomienka, nie ako tvrdenie, že je to v poriadku.
    expect(isPublicPath("/sign-in-nieco-ine")).toBe(true)
  })

  it("zoznam zostáva krátky", () => {
    // Nie je to štýlová poznámka: každá položka je cesta, ktorú nechráni
    // prihlásenie, a musí mať v súbore napísaný dôvod. Keď ich pribúda,
    // treba sa pýtať prečo.
    expect(PUBLIC_PATHS.length).toBeLessThanOrEqual(6)
  })
})
