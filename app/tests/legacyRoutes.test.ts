/**
 * legacyRoutes.test.ts — staré adresy musia fungovať natrvalo.
 *
 * Toto je jediná poistka, že sa záložka spred mesiaca alebo odkaz v e-maile
 * nepokazí. Chyba sa tu neprejaví ničím, čo by bolo vidieť pri vývoji —
 * všetky nové odkazy v aplikácii ukazujú na nové cesty.
 */
import { describe, it, expect } from "vitest"
import { legacyRoute, legacyQueryRoute } from "../src/lib/legacyRoutes"
import { legacyOrgSection } from "../src/lib/orgSections"

describe("stare cesty", () => {
  it("prelozi korene", () => {
    expect(legacyRoute("/dokumenty")).toBe("/documents")
    expect(legacyRoute("/kniznica")).toBe("/library")
    expect(legacyRoute("/osoby")).toBe("/people")
    expect(legacyRoute("/organizacia")).toBe("/organisation")
    // „Vzhľad a jazyky" → „Všeobecné" (3. 10. 2026)
    expect(legacyRoute("/organisation/branding")).toBe("/organisation/general")
    // Členenie sa od D160 v organizácii nenastavuje — rozcestník.
    expect(legacyRoute("/organisation/chunking")).toBe("/organisation")
    expect(legacyRoute("/prihlasenie")).toBe("/sign-in")
  })

  it("dlhsia cesta vyhrava nad kratsou", () => {
    // Bez poradia by `/kniznica/trasy` spadlo pod `/kniznica` a skoncilo
    // ako `/library/trasy`.
    expect(legacyRoute("/kniznica/trasy")).toBe("/hr/tracks")
    expect(legacyRoute("/kniznica/trasy/nastup")).toBe("/hr/tracks/nastup")
    // Trasy prešli z knižnice do Pridelených dokumentov (2. 10. 2026).
    expect(legacyRoute("/library/tracks")).toBe("/hr/tracks")
    expect(legacyRoute("/library/tracks/nastup")).toBe("/hr/tracks/nastup")
    expect(legacyRoute("/kniznica/nova")).toBe("/library/new")
    expect(legacyRoute("/osoby/pozvat")).toBe("/people/invite")
    expect(legacyRoute("/osoby/nova")).toBe("/people/new")
  })

  it("nesie so sebou zvysok cesty", () => {
    expect(legacyRoute("/dokumenty/sfz:eticky_kodex")).toBe("/documents/sfz:eticky_kodex")
    expect(legacyRoute("/kniznica/abc/text")).toBe("/library/abc/text")
    expect(legacyRoute("/osoby/123")).toBe("/people/123")
  })

  it("segment v strede — /hr/{id}/oznamit", () => {
    expect(legacyRoute("/hr/abc123/oznamit")).toBe("/hr/abc123/notify")
    // Iba presne ten tvar; inak by sa raz prepísal kus identifikátora.
    expect(legacyRoute("/hr/abc123/oznamit/nieco")).toBeNull()
  })

  it("prelozi aj API", () => {
    expect(legacyRoute("/api/kniznica/subor/x")).toBe("/api/library/file/x")
    expect(legacyRoute("/api/znacka/sfz")).toBe("/api/brand/sfz")
    expect(legacyRoute("/api/fotka/1")).toBe("/api/photo/1")
    expect(legacyRoute("/api/hodnotenie")).toBe("/api/rating")
  })

  it("nove cesty necha na pokoji", () => {
    for (const path of [
      "/", "/documents", "/library", "/hr/tracks", "/people", "/people/invite",
      "/organisation", "/sign-in", "/hr", "/hr/overview", "/hr/reminders",
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
      "/osoby/pozvat", "/osoby/nova", "/organizacia", "/prihlasenie",
      "/hr/pridelit", "/admin/tenanti", "/admin/novy", "/api/kniznica",
      "/api/znacka", "/api/fotka", "/api/hodnotenie",
      "/hr/x/oznamit",
    ]
    for (const path of olds) {
      const next = legacyRoute(path)
      expect(next, path).not.toBeNull()
      expect(legacyRoute(next!), `${path} → ${next}`).toBeNull()
    }
  })
})

describe("časť nastavenia organizácie z ?tab= na cestu (2. 10. 2026)", () => {
  const go = (path: string, q: string) => legacyOrgSection(path, new URLSearchParams(q))
  it("?tab= aj starý kľúč a stará hodnota", () => {
    expect(go("/organisation", "tab=signin")).toBe("/organisation/signin")
    expect(go("/organisation", "zalozka=prihlasenie")).toBe("/organisation/signin")
    expect(go("/organisation", "tab=utvary")).toBe("/organisation/departments")
  })
  it("ostatné parametre ostanú, neznáma časť vedie na rozcestník", () => {
    expect(go("/organisation", "tab=audit&search=jan&msg=ok")).toBe("/organisation/audit?search=jan&msg=ok")
    expect(go("/organisation", "tab=nieco&msg=x")).toBe("/organisation?msg=x")
  })
  it("bez ?tab a na inej ceste nič", () => {
    expect(go("/organisation", "msg=x")).toBeNull()
    expect(go("/organisation/signin", "tab=audit")).toBeNull()
    expect(go("/learning/manage", "tab=tags")).toBeNull()
  })
})

describe("časť obrazovky z parametra na vlastnú cestu (R4, 6. 10. 2026)", () => {
  const go = (path: string, query: string) => legacyQueryRoute(path, new URLSearchParams(query))
  it("úprava dokumentu: ?edit=document → /edit, ostatné parametre ostanú", () => {
    expect(go("/library/sfz%3Astanovy", "edit=document")).toBe("/library/sfz%3Astanovy/edit")
    expect(go("/library/abc", "edit=document&msg=x")).toBe("/library/abc/edit?msg=x")
  })
  it("iné adresy a parametre nechá tak", () => {
    expect(go("/library/abc", "open=history")).toBeNull()
    expect(go("/library/abc/version", "edit=document")).toBeNull()
    expect(go("/library/new", "edit=document")).toBeNull()
  })
  it("spotreba AI: ?view=usage → /organisation/ai/usage, filter ostane (R5)", () => {
    expect(go("/organisation/ai", "view=usage")).toBe("/organisation/ai/usage")
    expect(go("/organisation/ai", "view=usage&from=2026-10-01")).toBe("/organisation/ai/usage?from=2026-10-01")
    expect(go("/organisation/ai", "msg=x")).toBeNull()
  })
})
