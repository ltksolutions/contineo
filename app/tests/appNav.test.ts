/**
 * appNav.test.ts — položky navigácie shellu a hranica shellu.
 *
 * Dve veci, ktoré sa pokazia ticho: odkaz na sekciu, do ktorej človek nesmie
 * (prezradí, čo v systéme je), a stránka, ktorá príde o menu v hlavičke skôr,
 * než ho dostane od shellu.
 */

import { describe, it, expect } from "vitest"
import { navItems, sectionGroups, breadcrumbs, isActive, tabbarItems, moreGroups, menuGroups, menuColumns, isTabActive } from "../src/lib/appNav"
import type { CrumbNames, NavKey } from "../src/lib/appNav"
import { isShellRoute, WITHOUT_SHELL } from "../src/lib/shellRoutes"

describe("položky navigácie", () => {
  it("bez rolí zostane to, čo vidí každý prihlásený", () => {
    // `/approvals` je tu z toho istého dôvodu ako `/documents`: schvaľovateľ
    // je menovaný človek (D69), nie držiteľ roly, takže sa to podľa roly
    // podmieniť nedá. `/directory` je zoznam kolegov, nie správa prístupov (D87).
    // Knižnica a Vzdelávanie sú od 30. 9. 2026 u každého (SHELL-menu-
    // v-hlavicke, Q5) — Knižnica s platnými dokumentmi organizácie (D90),
    // Vzdelávanie pri vypnutom module s vysvetlením, nie 404.
    expect(navItems({}).map(o => o.href))
      .toEqual(["/", "/ask", "/documents", "/approvals", "/directory", "/library", "/learning"])
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
    expect(hrefs).not.toContain("/evaluation")
  })

  it("správcovské odkazy tu nie sú — zostávajú pod avatarom", () => {
    const hrefs = navItems({ isHr: true, isPeopleAdmin: true, isContentManager: true }).map(o => o.href)
    expect(hrefs).not.toContain("/organisation")
    expect(hrefs).not.toContain("/admin")
  })
})

describe("modul Vzdelávanie (ADR-018)", () => {
  it("vypnutý modul: len Vzdelávanie (s vysvetlením), správa ani testy nie, ani lektorovi", () => {
    const hrefs = navItems({ isLearningAdmin: true }).map(o => o.href)
    expect(hrefs.filter(h => h.startsWith("/learning"))).toEqual(["/learning"])
  })

  it("lišta je u každého rovnaká — mení LEARNING Q1 z 27. 9. (SHELL-menu-v-hlavicke, Q5)", () => {
    for (const flags of [{}, { learning: true }, { learning: true, isContentManager: true }]) {
      expect(tabbarItems(navItems(flags)).map(o => o.key)).toEqual(["overview", "library", "learning", "tasks", "menu"])
    }
  })

  it("zodpovedná osoba testu bez roly vidí Testy — rovno na výsledky (D121)", () => {
    const items = navItems({ learning: true, isTestResponsible: true })
    expect(items.find(o => o.key === "learningTests")?.href).toBe("/learning/tests?tab=results")
    expect(items.some(o => o.key === "learningManage")).toBe(false)
  })

  it("zapnutý modul: kurzy pre každého, správa a testy len pre lektora", () => {
    expect(navItems({ learning: true }).map(o => o.href).filter(h => h.startsWith("/learning")))
      .toEqual(["/learning"])
    expect(navItems({ learning: true, isLearningAdmin: true }).map(o => o.href).filter(h => h.startsWith("/learning")))
      .toEqual(["/learning", "/learning/manage", "/learning/tests"])
  })
})

describe("počty pri položkách", () => {
  it("bez počtov nemá položka číslo", () => {
    expect(navItems({}).every(o => o.count === undefined)).toBe(true)
  })

  it("počet sadne na svoju položku a nikam inam", () => {
    const items = navItems({}, { toAcknowledge: 3 })
    expect(items.find(o => o.key === "toAcknowledge")?.count).toBe(3)
    expect(items.find(o => o.key === "toApprove")?.count).toBe(undefined)
  })

  it("nula je nula, nie nepočítalo sa", () => {
    // Rozdiel je vecný: `0` hovorí nič nečaká, `undefined` hovorí nevie sa.
    // Kresliť sa nekreslí ani jedno, ale keby sa zliali, už by sa to nedalo
    // rozlíšiť — a práve to je rozdiel medzi prázdnym a pokazeným.
    expect(navItems({}, { toAcknowledge: 0 }).find(o => o.key === "toAcknowledge")?.count).toBe(0)
  })

  it("počet pre sekciu, do ktorej človek nesmie, sa nikde neobjaví", () => {
    // Inak by číslo prezradilo veľkosť fronty tomu, kto ju nemá vidieť —
    // ten istý dôvod, pre ktorý sa neukazuje ani samotný odkaz.
    expect(navItems({}, { evaluation: 12 }).some(o => o.key === "evaluation")).toBe(false)
  })
})

describe("dlaždice sekcií (SHELL-rozcestnik)", () => {
  const ALL = {
    isHr: true, isPeopleAdmin: true, isContentManager: true, isEvaluator: true, isDpo: true,
    learning: true, isLearningAdmin: true,
  }

  it("skupiny Organizácia a Správa; hlavné položky nie sú dlaždice", () => {
    const groups = sectionGroups(navItems(ALL))
    expect(groups.map(g => g.key)).toEqual(["organisation", "management"])
    expect(groups.map(g => g.items.map(o => o.key))).toEqual([
      ["directory", "library", "learning"],
      ["assigned", "evidence", "people", "evaluation", "dpo", "learningManage", "learningTests"],
    ])
  })

  it("bežná osoba: prázdna Správa sa nevykreslí", () => {
    const groups = sectionGroups(navItems({ learning: true }))
    expect(groups.map(g => g.key)).toEqual(["organisation"])
    expect(groups[0].items.map(o => o.key)).toEqual(["directory", "library", "learning"])
  })

  it("každá sekcia je práve v jednej skupine; neznámy kľúč padne do Správy", () => {
    const items = navItems(ALL)
    const main: NavKey[] = ["overview", "ask", "toAcknowledge", "toApprove"]
    expect(sectionGroups(items).flatMap(g => g.items.map(o => o.key)).sort())
      .toEqual(items.map(o => o.key).filter(k => !main.includes(k)).sort())
    const future = [...items, { href: "/nove", key: "nova" as never }]
    expect(sectionGroups(future).at(-1)!.items.map(o => o.href)).toContain("/nove")
  })

  it("počty idú s dlaždicou", () => {
    const groups = sectionGroups(navItems(ALL, { evaluation: 2 }))
    expect(groups[1].items.find(o => o.key === "evaluation")?.count).toBe(2)
  })
})

describe("cesta pod hlavičkou (SHELL-rozcestnik, bod 4)", () => {
  const names = (pages: Record<string, string> = {}): CrumbNames => ({
    overview: "Prehľad",
    groups: { organisation: "Organizácia", management: "Správa" },
    sections: new Proxy({} as Record<NavKey, string>, { get: (_, k) => `[${String(k)}]` }),
    pages,
  })

  it("na Prehľade nie je", () => {
    expect(breadcrumbs("/", names())).toEqual([])
  })

  it("koreň sekcie: Prehľad › Skupina › Sekcia (aktuálna, nie odkaz)", () => {
    expect(breadcrumbs("/hr", names())).toEqual([
      { label: "Prehľad", href: "/" },
      { label: "Správa", href: "/#management" },
      { label: "[assigned]", href: null },
    ])
  })

  it("hlbšia stránka: sekcia je odkaz, posledný krok aktuálny", () => {
    expect(breadcrumbs("/hr/assign", names({ "/hr/assign": "Prideliť normu" }))).toEqual([
      { label: "Prehľad", href: "/" },
      { label: "Správa", href: "/#management" },
      { label: "[assigned]", href: "/hr" },
      { label: "Prideliť normu", href: null },
    ])
  })

  it("najdlhšia sekcia vyhráva — Reťaz dôkazov nie je pod Pridelenými normami", () => {
    expect(breadcrumbs("/hr/evidence", names()).map(c => c.label))
      .toEqual(["Prehľad", "Správa", "[evidence]"])
    expect(breadcrumbs("/learning/tests/t1", names({ "/learning/tests/t1": "Test" })).map(c => c.label))
      .toEqual(["Prehľad", "Správa", "[learningTests]", "Test"])
    expect(breadcrumbs("/learning/kurz", names({ "/learning/kurz": "Kurz" })).map(c => c.label))
      .toEqual(["Prehľad", "Organizácia", "[learning]", "Kurz"])
  })

  it("detail nesie názov zo stránky, úsek bez stránky sa vynechá", () => {
    const crumbs = breadcrumbs("/learning/k/p/test/t", names({
      "/learning/k": "Kurz BOZP",
      "/learning/k/p": "Časť 1",
      "/learning/k/p/test/t": "Záverečný test",
    }))
    expect(crumbs).toEqual([
      { label: "Prehľad", href: "/" },
      { label: "Organizácia", href: "/#organisation" },
      { label: "[learning]", href: "/learning" },
      { label: "Kurz BOZP", href: "/learning/k" },
      { label: "Časť 1", href: "/learning/k/p" },
      { label: "Záverečný test", href: null },
    ])
  })

  it("hlavná položka nemá skupinu", () => {
    expect(breadcrumbs("/documents/sfz:stanovy", names({ "/documents/sfz:stanovy": "Stanovy" }))).toEqual([
      { label: "Prehľad", href: "/" },
      { label: "[toAcknowledge]", href: "/documents" },
      { label: "Stanovy", href: null },
    ])
  })

  it("neznáma cesta: Prehľad › aktuálna", () => {
    expect(breadcrumbs("/notifications", names({ "/notifications": "Upozornenia" }))).toEqual([
      { label: "Prehľad", href: "/" },
      { label: "Upozornenia", href: null },
    ])
  })

  it("bez názvu aktuálnej stránky netvrdí o rodičovi, že je aktuálny", () => {
    const crumbs = breadcrumbs("/hr/nieco", names())
    expect(crumbs.every(c => c.href !== null)).toBe(true)
    expect(crumbs.at(-1)).toEqual({ label: "[assigned]", href: "/hr" })
  })

  it("názov nájde aj pri kódovanej adrese", () => {
    expect(breadcrumbs("/documents/sfz%3Astanovy", names({ "/documents/sfz:stanovy": "Stanovy" })).at(-1))
      .toEqual({ label: "Stanovy", href: null })
  })

  it("koncová lomka nemení cestu", () => {
    expect(breadcrumbs("/hr/", names())).toEqual(breadcrumbs("/hr", names()))
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

describe("spodná lišta (SHELL-menu-v-hlavicke)", () => {
  const ALL = { isHr: true, isPeopleAdmin: true, isContentManager: true, isEvaluator: true, isDpo: true }

  it("Prehľad · Knižnica · Vzdelávanie · Úlohy · Menu — bez „Opýtať sa\"", () => {
    expect(tabbarItems(navItems(ALL)).map(o => o.key))
      .toEqual(["overview", "library", "learning", "tasks", "menu"])
  })

  it("Úlohy zlučujú počty a svietia na oboch cestách", () => {
    const tasks = tabbarItems(navItems({}, { toAcknowledge: 2, toApprove: 1 })).find(o => o.key === "tasks")
    expect(tasks?.count).toBe(3)
    expect(tasks?.activeFor).toEqual(["/documents", "/approvals"])
    expect(isTabActive("/approvals", tasks!)).toBe(true)
    expect(isTabActive("/documents/sfz:stanovy", tasks!)).toBe(true)
  })

  it("nepočítané zostáva nepočítané, nie nula", () => {
    // Súčet dvoch `undefined` nesmie byť `0`: nula tvrdí „nič nečaká",
    // a to sa nezisťovalo.
    expect(tabbarItems(navItems({})).find(o => o.key === "tasks")?.count).toBe(undefined)
    expect(tabbarItems(navItems({}, { toApprove: 0 })).find(o => o.key === "tasks")?.count).toBe(0)
  })

  it("odznak na Menu = súčet počtov sekcií mimo lišty", () => {
    const menu = tabbarItems(navItems(ALL, { toAcknowledge: 3, evaluation: 2, dpo: 1 })).find(o => o.key === "menu")
    expect(menu?.count).toBe(3)
    expect(tabbarItems(navItems(ALL)).find(o => o.key === "menu")?.count).toBe(undefined)
  })

  it("Menu svieti na sekciách v menu, na schvaľovaní ani na Knižnici nie", () => {
    const menu = tabbarItems(navItems(ALL)).find(o => o.key === "menu")
    expect(isTabActive("/more", menu!)).toBe(true)
    expect(isTabActive("/hr/evidence", menu!)).toBe(true)
    expect(isTabActive("/ask", menu!)).toBe(true)
    expect(isTabActive("/approvals", menu!)).toBe(false)
    expect(isTabActive("/library", menu!)).toBe(false)
  })
})

describe("celé menu — plachta aj /more (SHELL-menu-v-hlavicke, Q4)", () => {
  const ALL = { isHr: true, isPeopleAdmin: true, isContentManager: true, isEvaluator: true }

  it("Hlavné, Organizácia, Správa", () => {
    const groups = menuGroups(navItems(ALL))
    expect(groups.map(g => g.key)).toEqual(["main", "organisation", "management"])
    expect(groups[0].items.map(o => o.key)).toEqual(["overview", "ask", "toAcknowledge", "toApprove"])
  })

  it("bez rolí: Hlavné a Organizácia, Správa nie", () => {
    expect(menuGroups(navItems({})).map(g => g.key)).toEqual(["main", "organisation"])
  })

  it("menu pokryje každú položku navigácie práve raz", () => {
    const items = navItems({ ...ALL, isDpo: true, learning: true, isLearningAdmin: true })
    const keys = menuGroups(items).flatMap(g => g.items.map(o => o.key))
    expect(keys.sort()).toEqual(items.map(o => o.key).sort())
  })

  it("/more je to isté ako menu", () => {
    expect(moreGroups).toBe(menuGroups)
  })

  it("stĺpce nesú texty a popis počtu pre čítačku", () => {
    const t = new Proxy({ groupMain: "Hlavné", groupOrganisation: "Organizácia", groupManagement: "Správa", waiting: (n: number) => `čaká ${n}` } as Record<string, unknown>,
      { get: (o, k) => (k in o ? o[k as string] : `[${String(k)}]`) }) as unknown as Parameters<typeof menuColumns>[1]
    const cols = menuColumns(navItems({}, { toAcknowledge: 2 }), t)
    expect(cols[0]).toMatchObject({ key: "main", title: "Hlavné" })
    expect(cols[0].items.find(i => i.key === "toAcknowledge")).toMatchObject({ label: "[toAcknowledge]", count: 2, countLabel: "čaká 2" })
  })
})

describe("activeHref", () => {
  it("svieti len najdlhšia zhodná položka (HR-pravny-zaklad, bod 8)", async () => {
    const { activeHref } = await import("../src/lib/appNav")
    expect(activeHref("/hr/evidence", ["/", "/hr", "/hr/evidence"])).toBe("/hr/evidence")
    expect(activeHref("/hr/assign", ["/", "/hr", "/hr/evidence"])).toBe("/hr")
    expect(activeHref("/library/x", ["/", "/hr"])).toBeNull()
  })
})
