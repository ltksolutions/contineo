/**
 * peopleSearch.test.ts — hľadanie v zozname osôb (KOMPONENT-hladanie-osob).
 *
 * Zoznam schvaľovateľov a zodpovednej osoby je súčasť formulára, ktorý
 * spúšťa úkon s následkom („Predložiť na schválenie"). Preto sa tu overuje
 * hlavne to, čo filter **nesmie** zmeniť: čo sa odošle a kedy sa odošle.
 */
import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  SEARCH_FROM, canSearch, highlight, queryTerms, searchKeyAction, visibleIds,
  type PersonChoice,
} from "../src/lib/peopleSearch"
import PeopleSearch, { PeopleSearchView } from "../src/components/PeopleSearch"

const PEOPLE: PersonChoice[] = [
  ["agata", "Agáta Galková", "IT", "agata.galkova@futbalsfz.sk"],
  ["alzbeta", "Alžbeta Majláthová", "Legislatíva", "alzbeta.majlathova@futbalsfz.sk"],
  ["boris", "Boris Galík", "Súťaže", "boris.galik@futbalsfz.sk"],
  ["dana", "Dana Kováčová", "Ekonomika", "dana.kovacova@futbalsfz.sk"],
  ["erik", "Erik Švec", "Rozhodcovia", "erik.svec@futbalsfz.sk"],
  ["ivana", "Ivana Galbavá", "Personálne", "ivana.galbava@futbalsfz.sk"],
  ["marek", "Marek Horák", "Legislatíva", "marek.horak@futbalsfz.sk"],
  ["michal", "Michal Šimko", "IT", "michal.simko@futbalsfz.sk"],
  ["peter", "Peter Ondrejka", "", "peter.ondrejka@futbalsfz.sk"],
].map(([id, fullName, department, email]) => ({ id, fullName, email, department: department || undefined }))

/** Riadok zoznamu (`<label …><input …/>`) osoby s daným id. */
const row = (html: string, id: string) =>
  html.match(new RegExp(`<label class="approval-person"[^>]*><input [^>]*value="${id}"[^>]*/>`))?.[0] ?? ""

const view = (over: Partial<Parameters<typeof PeopleSearchView>[0]> = {}) =>
  renderToStaticMarkup(createElement(PeopleSearchView, {
    people: PEOPLE, name: "approver", language: "sk", multiple: true,
    listLabel: "Schvaľovatelia", missing: "approvers",
    interactive: true, query: "", selected: [],
    ...over,
  }))

describe("filter", () => {
  it("bez diakritiky a veľkých písmen", () => {
    expect(visibleIds(PEOPLE, "alz")).toEqual(["alzbeta"])
    expect(visibleIds(PEOPLE, "SIMKO")).toEqual(["michal"])
    expect(visibleIds(PEOPLE, "kováč")).toEqual(["dana"])
    expect(visibleIds(PEOPLE, "legislativa")).toEqual(["alzbeta", "marek"])
  })

  it("meno, e-mail aj oddelenie; viac slov musí sedieť všetko", () => {
    expect(visibleIds(PEOPLE, "gal")).toEqual(["agata", "boris", "ivana"])
    expect(visibleIds(PEOPLE, "it gal")).toEqual(["agata"])
    expect(visibleIds(PEOPLE, "  horak@  ")).toEqual(["marek"])
    expect(visibleIds(PEOPLE, "gal xyz")).toEqual([])
  })

  it("prázdny dotaz nechá všetkých v pôvodnom poradí", () => {
    expect(visibleIds(PEOPLE, "")).toEqual(PEOPLE.map(p => p.id))
    expect(queryTerms("   ")).toEqual([])
  })

  it("zvýraznenie sedí na pôvodné znaky aj s diakritikou", () => {
    expect(highlight("Michal Šimko", queryTerms("simko")))
      .toEqual([{ text: "Michal ", hit: false }, { text: "Šimko", hit: true }])
    expect(highlight("Agáta Galková", queryTerms("gal")))
      .toEqual([{ text: "Agáta ", hit: false }, { text: "Gal", hit: true }, { text: "ková", hit: false }])
    expect(highlight("Erik", [])).toEqual([{ text: "Erik", hit: false }])
  })
})

describe("kedy sa pole zobrazí", () => {
  it(`od ${SEARCH_FROM} osôb`, () => {
    expect(canSearch(7)).toBe(false)
    expect(canSearch(8)).toBe(true)
    expect(view({ people: PEOPLE.slice(0, 7) })).not.toContain('type="search"')
    expect(view({ people: PEOPLE.slice(0, 8) })).toContain('type="search"')
  })

  it("pod 8 osôb ani čipy — zoznam ako doteraz", () => {
    const html = view({ people: PEOPLE.slice(0, 5), selected: ["agata"] })
    expect(html).not.toContain("people-picked")
    expect(html).toContain('class="approval-people"')
  })

  it("bez JavaScriptu (pred hydratáciou) nič navyše", () => {
    const html = renderToStaticMarkup(createElement(PeopleSearch, {
      people: PEOPLE, name: "approver", language: "sk", multiple: true,
      defaultSelected: ["marek"], listLabel: "Schvaľovatelia", missing: "approvers",
    }))
    expect(html).not.toContain('type="search"')
    expect(html).not.toContain("people-picked")
    expect(html).not.toContain("hidden")
    // Predvyplnený schvaľovateľ je zaškrtnutý už v HTML zo servera.
    expect(row(html, "marek")).toContain('checked=""')
  })
})

describe("čo sa odošle", () => {
  it("skrytý zaškrtnutý riadok zostáva vo formulári", () => {
    const html = view({ query: "gal", selected: ["agata", "marek"] })
    // Marek dotazu nevyhovuje — riadok je len `hidden`, políčko s menom aj
    // hodnotou tam je a je zaškrtnuté. `hidden` (na rozdiel od `disabled`)
    // prvok z odosielaných údajov nevyraďuje.
    const marek = row(html, "marek")
    expect(marek).toContain('hidden=""')
    expect(marek).toContain('name="approver"')
    expect(marek).toContain('checked=""')
    expect(marek).not.toContain("disabled")
    // A je vidieť v čipe, hoci jeho riadok nie.
    expect(html).toContain('aria-label="Odobrať Marek Horák"')
    expect(html).toContain("3 z 9")
  })

  it("pole hľadania nemá meno — dotaz sa neodošle", () => {
    expect(view({ query: "gal" })).toMatch(/<input class="field-input" type="search"(?![^>]*name=)/)
  })

  it("nič nevyhovuje: riadky ostanú, dôvod a zrušenie hľadania", () => {
    const html = view({ query: "xyz", selected: ["agata"] })
    expect(html).toContain("Nikto nevyhovuje „xyz“.")
    expect(html).toContain("seba schváliť nemôžeš")
    expect(html).toContain("Zrušiť hľadanie")
    expect(html.match(/<input type="checkbox"/g)).toHaveLength(PEOPLE.length)
  })

  it("povinná zodpovedná osoba: jeden čip bez ×", () => {
    const radio = (required: boolean) => view({
      multiple: false, name: "responsiblePersonId", required, missing: "responsible", selected: ["erik"],
    })
    expect(radio(true)).toContain(">Vybraná<")
    expect(radio(true)).not.toContain("Odobrať Erik Švec")
    expect(radio(false)).toContain("Odobrať Erik Švec")
    const erik = row(radio(true), "erik")
    expect(erik).toContain('type="radio"')
    expect(erik).toContain('required=""')
    expect(erik).toContain('checked=""')
  })
})

describe("klávesnica v poli", () => {
  it("Enter nikdy neodošle formulár", () => {
    // `kind: "enter"` znamená preventDefault v komponente — aj keď nič nevyberie.
    expect(searchKeyAction("Enter", "gal", ["agata", "boris", "ivana"])).toEqual({ kind: "enter", pick: null })
    expect(searchKeyAction("Enter", "", PEOPLE.map(p => p.id))).toEqual({ kind: "enter", pick: null })
    expect(searchKeyAction("Enter", "xyz", [])).toEqual({ kind: "enter", pick: null })
  })

  it("Enter pri jednom výsledku ho vyberie", () => {
    expect(searchKeyAction("Enter", "simko", ["michal"])).toEqual({ kind: "enter", pick: "michal" })
  })

  it("Esc vyčistí, ↓ ide do zoznamu, ostatné klávesy nechá tak", () => {
    expect(searchKeyAction("Escape", "gal", [])).toEqual({ kind: "clear" })
    expect(searchKeyAction("Escape", "", [])).toEqual({ kind: "none" })
    expect(searchKeyAction("ArrowDown", "gal", ["agata"])).toEqual({ kind: "focusList" })
    expect(searchKeyAction("ArrowDown", "xyz", [])).toEqual({ kind: "none" })
    expect(searchKeyAction("a", "gal", ["agata"])).toEqual({ kind: "none" })
  })
})
