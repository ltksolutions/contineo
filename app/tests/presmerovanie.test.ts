/**
 * presmerovanie.test.ts — `redirect()` nie je chyba zápisu.
 *
 * Test existuje kvôli skutočnej chybe: zakladanie oddelenia zapísalo záznam,
 * zapísalo audit — a človeku ukázalo „Zmenu sa nepodarilo uložiť", lebo
 * výnimku z `redirect()` na ceste úspechu zachytil vlastný `catch`.
 * Hlásiť neúspech tam, kde bol úspech, je najhorší druh chyby: akcia sa
 * zopakuje a vzniknú duplicity.
 */

import { describe, it, expect } from "vitest"
import { jePresmerovanie } from "../src/lib/redirects"

/** Tvar, aký má výnimka z `redirect()` v Nexte. */
function vynimkaRedirect(): Error & { digest: string } {
  return Object.assign(new Error("NEXT_REDIRECT"), {
    digest: "NEXT_REDIRECT;replace;/organizacia?zalozka=utvary;307;",
  })
}

describe("rozoznanie presmerovania", () => {
  it("vynimka z redirect() sa pozna", () => {
    expect(jePresmerovanie(vynimkaRedirect())).toBe(true)
  })

  it("bezna chyba nie je presmerovanie", () => {
    expect(jePresmerovanie(new Error("spojenie zlyhalo"))).toBe(false)
    expect(jePresmerovanie({ message: "nieco" })).toBe(false)
  })

  it("notFound() sa za presmerovanie nepovazuje", () => {
    // Nesie `digest` tiez. Volna kontrola `"digest" in e` by ho prepustila
    // a stranka by namiesto "nenajdene" ukazala chybu zapisu.
    const notFound = Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK"), {
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    })
    expect(jePresmerovanie(notFound)).toBe(false)
  })

  it("nic a primitivne hodnoty neprejdu", () => {
    for (const x of [null, undefined, "NEXT_REDIRECT", 0, false]) {
      expect(jePresmerovanie(x)).toBe(false)
    }
  })

  it("digest, ktory nie je retazec, neprejde", () => {
    expect(jePresmerovanie({ digest: 123 })).toBe(false)
  })
})
