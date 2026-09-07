/**
 * legacyRoutes.test.ts — staré adresy musia fungovať natrvalo.
 *
 * Toto je jediná poistka, že sa záložka spred mesiaca alebo odkaz v e-maile
 * nepokazí. Chyba sa tu neprejaví ničím, čo by bolo vidieť pri vývoji —
 * všetky nové odkazy v aplikácii ukazujú na nové cesty.
 */
import { describe, it, expect } from "vitest"
import { legacyRoute } from "../src/lib/legacyRoutes"

describe("stare cesty", () => {
  it("prelozi korene", () => {
    expect(legacyRoute("/dokumenty")).toBe("/documents")
    expect(legacyRoute("/kniznica")).toBe("/library")
    expect(legacyRoute("/osoby")).toBe("/people")
    expect(legacyRoute("/organizacia")).toBe("/organisation")
    expect(legacyRoute("/prihlasenie")).toBe("/sign-in")
    expect(legacyRoute("/sada")).toBe("/golden-set")
  })

  it("dlhsia cesta vyhrava nad kratsou", () => {
    // Bez poradia by `/kniznica/trasy` spadlo pod `/kniznica` a skoncilo
    // ako `/library/trasy`.
    expect(legacyRoute("/kniznica/trasy")).toBe("/library/tracks")
    expect(legacyRoute("/kniznica/trasy/nastup")).toBe("/library/tracks/nastup")
    expect(legacyRoute("/kniznica/nova")).toBe("/library/new")
    expect(legacyRoute("/osoby/pozvat")).toBe("/people/invite")
    expect(legacyRoute("/osoby/nova")).toBe("/people/new")
  })

  it("nesie so sebou zvysok cesty", () => {
    expect(legacyRoute("/dokumenty/sfz:eticky_kodex")).toBe("/documents/sfz:eticky_kodex")
    expect(legacyRoute("/kniznica/abc/text")).toBe("/library/abc/text")
    expect(legacyRoute("/osoby/123")).toBe("/people/123")
    expect(legacyRoute("/sada/42")).toBe("/golden-set/42")
  })

  it("segment v strede — /hr/{id}/oznamit", () => {
    expect(legacyRoute("/hr/abc123/oznamit")).toBe("/hr/abc123/notify")
    // Iba presne ten tvar; inak by sa raz prepísal kus identifikátora.
    expect(legacyRoute("/hr/abc123/oznamit/nieco")).toBeNull()
  })

  it("prelozi aj API", () => {
    expect(legacyRoute("/api/kniznica/subor/x")).toBe("/api/library/file/x")
    expect(legacyRoute("/api/sada")).toBe("/api/golden-set")
    expect(legacyRoute("/api/znacka/sfz")).toBe("/api/brand/sfz")
    expect(legacyRoute("/api/fotka/1")).toBe("/api/photo/1")
    expect(legacyRoute("/api/hodnotenie")).toBe("/api/rating")
  })

  it("nove cesty necha na pokoji", () => {
    for (const path of [
      "/", "/documents", "/library", "/library/tracks", "/people", "/people/invite",
      "/organisation", "/sign-in", "/golden-set", "/hr", "/hr/overview", "/hr/reminders",
      "/hr/assign", "/api/auth/session", "/api/chat", "/api/reading", "/api/cron/overdue",
      "/admin", "/admin/tenants",
    ]) {
      expect(legacyRoute(path), path).toBeNull()
    }
  })

  it("nepodobne cesty nechytá", () => {
    // Predpona sa musí končiť lomkou, inak by `/osobyX` prešlo tiež.
    expect(legacyRoute("/osobyX")).toBeNull()
    expect(legacyRoute("/dokumentyabc")).toBeNull()
    expect(legacyRoute("/sadanieco")).toBeNull()
  })

  it("nezacyklí sa — vysledok uz nie je stara cesta", () => {
    // Keby prelozena cesta obsahovala inu staru predponu, middleware by
    // presmerovaval donekonecna.
    const olds = [
      "/dokumenty", "/kniznica", "/kniznica/trasy", "/kniznica/nova", "/osoby",
      "/osoby/pozvat", "/osoby/nova", "/organizacia", "/prihlasenie", "/sada",
      "/hr/pridelit", "/admin/tenanti", "/admin/novy", "/api/kniznica",
      "/api/sada", "/api/znacka", "/api/fotka", "/api/hodnotenie",
      "/hr/x/oznamit",
    ]
    for (const path of olds) {
      const next = legacyRoute(path)
      expect(next, path).not.toBeNull()
      expect(legacyRoute(next!), `${path} → ${next}`).toBeNull()
    }
  })
})
