/**
 * appNav.test.ts — položky navigácie shellu a hranica shellu.
 *
 * Dve veci, ktoré sa pokazia ticho: odkaz na sekciu, do ktorej človek nesmie
 * (prezradí, čo v systéme je), a stránka, ktorá príde o menu v hlavičke skôr,
 * než ho dostane od shellu.
 */

import { describe, it, expect } from "vitest"
import { navItems, navGroups, normalizeNavState, isActive, tabbarItems, moreGroups, isTabActive } from "../src/lib/appNav"
import { sameOriginPath } from "../src/lib/shellBack"
import { isShellRoute, WITHOUT_SHELL } from "../src/lib/shellRoutes"

describe("položky navigácie", () => {
  it("bez rolí zostane to, čo vidí každý prihlásený", () => {
    // `/approvals` je tu z toho istého dôvodu ako `/documents`: schvaľovateľ
    // je menovaný človek (D69), nie držiteľ roly, takže sa to podľa roly
    // podmieniť nedá. `/directory` je zoznam kolegov, nie správa prístupov (D87).
    expect(navItems({}).map(o => o.href))
      .toEqual(["/", "/ask", "/documents", "/approvals", "/directory"])
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

describe("modul Vzdelávanie (ADR-018)", () => {
  it("vypnutý modul nepridá nič, ani lektorovi", () => {
    const hrefs = navItems({ isLearningAdmin: true }).map(o => o.href)
    expect(hrefs.some(h => h.startsWith("/learning"))).toBe(false)
  })

  it("lišta: bežná osoba má Vzdelávanie na 3. pozícii, správca obsahu pod Viac (LEARNING Q1)", () => {
    const plain = navItems({ learning: true })
    expect(tabbarItems(plain).map(o => o.key)).toEqual(["overview", "ask", "learning", "tasks", "more"])
    expect(moreGroups(plain).flatMap(g => g.items.map(o => o.key))).not.toContain("learning")
    const editor = navItems({ learning: true, isContentManager: true })
    expect(tabbarItems(editor).map(o => o.key)).toEqual(["overview", "ask", "library", "tasks", "more"])
    expect(moreGroups(editor).find(g => g.key === "organisation")!.items.map(o => o.key)).toContain("learning")
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
    // Inak by číslo prezradilo veľkosť knižnice tomu, kto ju nemá vidieť —
    // ten istý dôvod, pre ktorý sa neukazuje ani samotný odkaz.
    expect(navItems({}, { library: 148 }).some(o => o.key === "library")).toBe(false)
  })
})

describe("bočný panel (SHELL-bocny-panel)", () => {
  const ALL = {
    isHr: true, isPeopleAdmin: true, isContentManager: true, isEvaluator: true, isDpo: true,
    learning: true, isLearningAdmin: true,
  }

  it("stav z cookie: predvolený rozbalený, neznáma hodnota ho nezhodí (Q4)", () => {
    expect(normalizeNavState(undefined)).toBe("wide")
    expect(normalizeNavState("nezmysel")).toBe("wide")
    expect(normalizeNavState(["rail"])).toBe("wide")
    expect(normalizeNavState("rail")).toBe("rail")
  })

  it("skupiny: bez nadpisu · Moje úlohy · Organizácia · Správa (Q2)", () => {
    const groups = navGroups(navItems(ALL))
    expect(groups.map(g => g.key)).toEqual([null, "tasks", "organisation", "management"])
    expect(groups.map(g => g.items.map(o => o.key))).toEqual([
      ["overview", "ask"],
      ["toAcknowledge", "toApprove"],
      ["directory", "library", "learning"],
      ["assigned", "evidence", "people", "evaluation", "dpo", "learningManage", "learningTests"],
    ])
  })

  it("bežná osoba: prázdna Správa sa nevykreslí", () => {
    const groups = navGroups(navItems({ learning: true }))
    expect(groups.map(g => g.key)).toEqual([null, "tasks", "organisation"])
    expect(groups[2].items.map(o => o.key)).toEqual(["directory", "learning"])
  })

  it("každá položka je práve v jednej skupine; neznámy kľúč padne do Správy", () => {
    const items = navItems(ALL)
    expect(navGroups(items).flatMap(g => g.items.map(o => o.key)).sort()).toEqual(items.map(o => o.key).sort())
    const future = [...items, { href: "/nove", key: "nova" as never }]
    expect(navGroups(future).at(-1)!.items.map(o => o.href)).toContain("/nove")
  })

  it("návrat po prepnutí bez JS: len cesta na tom istom hostiteľovi", () => {
    expect(sameOriginPath("https://intranet.sfz.sk/hr?x=1", "intranet.sfz.sk")).toBe("/hr?x=1")
    expect(sameOriginPath("https://zly.sk/hr", "intranet.sfz.sk")).toBe("/")
    expect(sameOriginPath("nezmysel", "intranet.sfz.sk")).toBe("/")
    expect(sameOriginPath(null, "intranet.sfz.sk")).toBe("/")
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

describe("spodná lišta (NASADENIE, PR 2)", () => {
  const ALL = { isHr: true, isPeopleAdmin: true, isContentManager: true, isEvaluator: true }

  it("poradie z návrhu: Prehľad · Opýtať sa · Knižnica · Úlohy · Viac", () => {
    expect(tabbarItems(navItems(ALL)).map(o => o.key))
      .toEqual(["overview", "ask", "library", "tasks", "more"])
  })

  it("bez roly správy obsahu má lišta štyri položky, nie náhradnú piatu", () => {
    // Dopĺňať do počtu inou sekciou by znamenalo, že tá istá pozícia palca
    // vedie u dvoch ľudí inam.
    expect(tabbarItems(navItems({})).map(o => o.key))
      .toEqual(["overview", "ask", "tasks", "more"])
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

  it("Viac svieti na sekciách pod ním, na schvaľovaní nie", () => {
    const more = tabbarItems(navItems(ALL)).find(o => o.key === "more")
    expect(isTabActive("/more", more!)).toBe(true)
    expect(isTabActive("/hr/evidence", more!)).toBe(true)
    expect(isTabActive("/approvals", more!)).toBe(false)
  })
})

describe("zoznam na /more (NASADENIE, PR 2)", () => {
  const ALL = { isHr: true, isPeopleAdmin: true, isContentManager: true, isEvaluator: true }

  it("skupiny: Moje úlohy (schvaľovanie), Organizácia a Správa — ako v paneli (SHELL Q2)", () => {
    const groups = moreGroups(navItems(ALL))
    expect(groups.map(g => g.key)).toEqual(["tasks", "organisation", "management"])
    expect(groups[0].items.map(o => o.key)).toEqual(["toApprove"])
    expect(groups[1].items.map(o => o.key)).toEqual(["directory", "people"])
    expect(groups[2].items.map(o => o.key)).toEqual(["assigned", "evidence", "evaluation"])
  })

  it("prázdna skupina sa nevracia", () => {
    // Bez roly správy osôb je v Organizácii len adresár; bez oboch by
    // nadpis skupiny visel nad ničím.
    const groups = moreGroups(navItems({}))
    expect(groups.map(g => g.key)).toEqual(["tasks", "organisation"])
    expect(groups[1].items.map(o => o.key)).toEqual(["directory"])
  })

  it("lišta a /more spolu pokryjú každú položku navigácie", () => {
    // Stratený odkaz je výpadok sekcie: čo nie je v lište, musí byť na /more.
    const items = navItems(ALL)
    const bar = tabbarItems(items)
    const covered = new Set([
      ...bar.flatMap(o => o.activeFor),
      ...moreGroups(items).flatMap(g => g.items.map(o => o.href)),
    ])
    for (const o of items) expect(covered.has(o.href)).toBe(true)
  })

  it("vzdelávanie: kurzy v Organizácii, správa a testy v Správe (ADR-018)", () => {
    const groups = moreGroups(navItems({ ...ALL, learning: true, isLearningAdmin: true }))
    expect(groups[1].items.map(o => o.key)).toEqual(["directory", "learning", "people"])
    expect(groups[2].items.map(o => o.key)).toContain("learningManage")
    expect(groups[2].items.map(o => o.key)).toContain("learningTests")
  })

  it("knižnica je v lište, na /more sa neopakuje", () => {
    const hrefs = moreGroups(navItems(ALL)).flatMap(g => g.items.map(o => o.href))
    expect(hrefs).not.toContain("/library")
    expect(hrefs).not.toContain("/")
    expect(hrefs).not.toContain("/ask")
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
