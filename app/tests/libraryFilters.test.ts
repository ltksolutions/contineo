/**
 * libraryFilters.test.ts — filtre knižnice v adrese a dotaz z nich.
 *
 * Adresa je zdroj pravdy: pohľad na knižnicu sa musí dať poslať odkazom,
 * otvoriť zo záložky a fungovať bez JavaScriptu. Preto sa tu testuje kruh
 * adresa → filtre → adresa a to, čo z filtrov vyjde ako dotaz do databázy.
 */

import { describe, it, expect } from "vitest"
import {
  readFilters, toggle, replace, setValue, clearFilters, isEmpty, toQuery, activeChips,
  sortBy, currentSort, pageOf, withPage, sortRows, pageRows, setView, currentView, normalizeView,
  togglePick, pickPage, clearPicked, pickedOutsideCount, carryFields,
} from "../src/lib/libraryFilters"
import { queryParts, buildQuery } from "../src/lib/libraryRead"

describe("čítanie z adresy", () => {
  it("opakovaný kľúč je zoznam, jedna hodnota tiež", () => {
    // Opakovaný kľúč je to, čo pošle prehliadač z formulára s viacerými
    // zaškrtnutými políčkami. Jedna hodnota musí prejsť kvôli starým odkazom.
    expect(readFilters({ category: ["norma", "smernica"] }).category).toEqual(["norma", "smernica"])
    expect(readFilters({ category: "norma" }).category).toEqual(["norma"])
    expect(readFilters({}).category).toEqual([])
  })

  it("duplicity a prázdne hodnoty sa zahodia", () => {
    expect(readFilters({ tag: ["poriadok", "poriadok", " ", ""] }).tag).toEqual(["poriadok"])
  })

  it("priečinok zostáva jedna hodnota", () => {
    expect(readFilters({ folder: ["a", "b"] }).folder).toBe("a")
  })
})

describe("prepínanie", () => {
  it("vybraná hodnota zmizne, nevybraná pribudne", () => {
    const f = readFilters({ category: "norma" })
    expect(toggle(f, "category", "smernica").category).toEqual(["norma", "smernica"])
    expect(toggle(f, "category", "norma").category).toEqual([])
  })

  it("celý zoznam sa dá nahradiť naraz", () => {
    const f = replace(readFilters({}), "tag", ["a", "b", "a", ""])
    expect(f.tag).toEqual(["a", "b"])
  })

  it("zrušenie filtrov nechá zobrazenie na pokoji", () => {
    // Variant navigácie a pohľad si človek nastavoval zvlášť a tlačidlom
    // „Zrušiť" ich zrušiť nechcel.
    const f = readFilters({ category: "norma", search: "prestup", layout: "sidebar", view: "cards" })
    const cleared = clearFilters(f)
    expect(isEmpty(cleared)).toBe(true)
    expect(cleared.layout).toBe("sidebar")
    expect(cleared.view).toBe("cards")
  })
})

describe("zápis do adresy", () => {
  it("kruh adresa → filtre → adresa drží", () => {
    const url = "/library?search=prestup&folder=normy&category=norma&category=smernica&tag=poriadok&layout=sidebar"
    const params = Object.fromEntries(new URLSearchParams(url.split("?")[1]))
    // `Object.fromEntries` zachová len prvú hodnotu opakovaného kľúča, tak
    // sa zoznam podá tak, ako ho podá Next.
    const filters = readFilters({ ...params, category: ["norma", "smernica"] })
    expect(toQuery(filters)).toBe(url)
  })

  it("bez filtrov je to čistá adresa, nie otáznik", () => {
    expect(toQuery(readFilters({}))).toBe("/library")
  })

  it("poradie kľúčov je pevné", () => {
    // Dva odkazy na ten istý pohľad musia vyzerať rovnako, inak nesadnú
    // na seba v histórii prehliadača.
    const a = toQuery(readFilters({ tag: "x", category: "y" }))
    const b = toQuery(readFilters({ category: "y", tag: "x" }))
    expect(a).toBe(b)
  })

  it("chips sú v poradí zápisu do adresy", () => {
    const f = readFilters({ tag: "poriadok", category: ["norma"] })
    expect(activeChips(f)).toEqual([
      { key: "category", value: "norma" },
      { key: "tag", value: "poriadok" },
    ])
  })

  it("fulltext sa dá nastaviť aj zmazať", () => {
    const f = setValue(readFilters({}), "search", "  prestup  ")
    expect(f.search).toBe("prestup")
    expect(setValue(f, "search", "   ").search).toBeUndefined()
  })
})

describe("dotaz z filtrov", () => {
  it("companyCode je vždy v podmienke", () => {
    // D32: identifikátory sa dajú uhádnuť, takže organizácia patrí do dotazu,
    // nie do kontroly nad ním.
    expect(buildQuery("sfz")).toEqual({ companyCode: "sfz" })
    expect(buildQuery("sfz", { category: "norma" }).companyCode).toBe("sfz")
  })

  it("viac hodnôt je $in, jedna je rovnosť", () => {
    expect(buildQuery("sfz", { category: "norma" })).toEqual({
      companyCode: "sfz", $and: [{ category: "norma" }],
    })
    expect(buildQuery("sfz", { category: ["norma", "smernica"] })).toEqual({
      companyCode: "sfz", $and: [{ category: { $in: ["norma", "smernica"] } }],
    })
  })

  it("štítok sa hľadá v poli", () => {
    expect(buildQuery("sfz", { tag: "poriadok" })).toEqual({
      companyCode: "sfz", $and: [{ tags: "poriadok" }],
    })
  })

  it("staré slovenské hodnoty stavu ďalej fungujú", () => {
    expect(buildQuery("sfz", { status: "publikovane" })).toEqual(buildQuery("sfz", { status: "published" }))
    expect(buildQuery("sfz", { status: "koncept" })).toEqual(buildQuery("sfz", { status: "draft" }))
  })

  it("oba stavy naraz nie sú filter", () => {
    // `$and` dvoch protikladov by nevrátil nič — pritom človek zaškrtol
    // „všetko".
    expect(buildQuery("sfz", { status: ["published", "draft"] })).toEqual({ companyCode: "sfz" })
  })

  it("na schválenie je iná os, nie tretia priehradka", () => {
    // Dokument môže byť publikovaný a zároveň mať bežiace kolo nad novým
    // znením, takže sa k rozdeleniu pridáva cez `$or`, nie doňho.
    const q = buildQuery("sfz", { status: ["published", "in-review"] }, undefined, ["sfz:a"])
    const and = q.$and as Record<string, unknown>[]
    expect(and).toHaveLength(1)
    expect(and[0]).toEqual({ $or: [{ status: "published" }, { documentId: { $in: ["sfz:a"] } }] })
  })

  it("samotné na schválenie filtruje podľa zoznamu kôl", () => {
    const q = buildQuery("sfz", { status: "in-review" }, undefined, ["sfz:a", "sfz:b"])
    expect(q.$and).toEqual([{ documentId: { $in: ["sfz:a", "sfz:b"] } }])
  })

  it("bez bežiaceho kola nenájde na schválenie nič", () => {
    // Prázdny zoznam a nie „všetko": keby sa podmienka vynechala, filter by
    // ukázal celú knižnicu a vyzeralo by to, že sa schvaľuje všetko.
    const q = buildQuery("sfz", { status: "in-review" }, undefined, [])
    expect(q.$and).toEqual([{ documentId: { $in: [] } }])
  })

  it("koncept aj publikované zostáva všetko aj s kolami", () => {
    // „Všetko" pokrýva aj kolá, takže sa podmienka na ne nepridáva.
    expect(buildQuery("sfz", { status: ["published", "draft", "in-review"] }, undefined, ["sfz:a"]))
      .toEqual({ companyCode: "sfz" })
  })

  it("fulltext a nezaradené sa nepobijú", () => {
    // Oboje používa `$or`; v jednom objekte by si ho prepísali a jeden
    // z filtrov by prestal platiť.
    const q = buildQuery("sfz", { search: "prestup", priecinok: "nezaradene" })
    const and = q.$and as Record<string, unknown>[]
    expect(and).toHaveLength(2)
    expect(and.filter(c => "$or" in c)).toHaveLength(2)
  })

  it("hľadaný text sa escapuje", () => {
    const q = buildQuery("sfz", { search: "a(b).*" })
    const or = (q.$and as Record<string, unknown>[])[0].$or as { title?: { $regex: string } }[]
    expect(or[0].title?.$regex).toBe("a\\(b\\)\\.\\*")
  })

  it("except vynechá práve jednu podmienku", () => {
    // Toto je celý trik za počtami pri facetoch: koľko by ich bolo, keby
    // som túto kategóriu nemal vybranú.
    const filter = { category: "norma", tag: "poriadok" }
    expect(queryParts(filter)).toHaveLength(2)
    const q = buildQuery("sfz", filter, "category")
    expect(q.$and).toEqual([{ tags: "poriadok" }])
  })
})

describe("triedenie", () => {
  it("neznáme triedenie z adresy sa zahodí", () => {
    // Hodnota ide z adresy, teda od kohokoľvek. Keby sa použila ako názov
    // poľa, dala by sa ňou vypýtať vec, ktorá do zoznamu nepatrí.
    expect(readFilters({ sort: "documents.drop" }).sort).toBeUndefined()
    expect(readFilters({ sort: "title" }).sort).toBe("title")
    expect(readFilters({ dir: "hore" }).dir).toBeUndefined()
  })

  it("ten istý stĺpec obráti smer, iný začne svojím predvoleným", () => {
    const base = readFilters({})
    const byTitle = sortBy(base, "title")
    expect(currentSort(byTitle)).toEqual({ key: "title", dir: "asc" })
    expect(currentSort(sortBy(byTitle, "title"))).toEqual({ key: "title", dir: "desc" })
    // Prvý klik na dátum má ukázať najnovšie, nie najstaršie.
    expect(currentSort(sortBy(byTitle, "updatedAt"))).toEqual({ key: "updatedAt", dir: "desc" })
  })

  it("predvolené triedenie sa do adresy nepíše", () => {
    // Inak by odkaz na nefiltrovaný zoznam vyzeral zakaždým inak podľa toho,
    // odkiaľ vznikol.
    expect(toQuery(readFilters({}))).toBe("/library")
    expect(toQuery(sortBy(readFilters({}), "title"))).toBe("/library?sort=title")
    // Klik na stĺpec, podľa ktorého sa už triedi, obráti smer — aj keď to
    // triedenie bolo predvolené. Ten obrátený smer už v adrese byť musí.
    const flipped = sortBy(readFilters({}), "updatedAt")
    expect(toQuery(flipped)).toBe("/library?dir=asc")
    // A druhý klik sa vráti k predvolenému, takže adresa je opäť čistá.
    expect(toQuery(sortBy(flipped, "updatedAt"))).toBe("/library")
  })

  it("texty sa triedia po slovensky", () => {
    // Binárne porovnanie hodí „Čas" až za „Zima".
    const rows = [
      { title: "Zimná príprava", status: "published" },
      { title: "Časový plán", status: "published" },
      { title: "Cestovné náhrady", status: "published" },
    ]
    expect(sortRows(rows, "title", "asc").map(r => r.title))
      .toEqual(["Cestovné náhrady", "Časový plán", "Zimná príprava"])
  })

  it("pri rovnosti rozhodne názov, nech je poradie stabilné", () => {
    const day = new Date("2026-09-01")
    const rows = [
      { title: "B", status: "published", updatedAt: day },
      { title: "A", status: "published", updatedAt: day },
    ]
    expect(sortRows(rows, "updatedAt", "desc").map(r => r.title)).toEqual(["A", "B"])
  })

  it("chýbajúci dátum zoznam nezhodí", () => {
    const rows = [
      { title: "Bez dátumu", status: "draft" },
      { title: "S dátumom", status: "published", updatedAt: new Date("2026-09-01") },
    ]
    expect(sortRows(rows, "updatedAt", "desc").map(r => r.title)).toEqual(["S dátumom", "Bez dátumu"])
  })
})

describe("stránkovanie", () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ n: i + 1 }))

  it("prvá strana je 1–25 a rozsah sa počíta od jednotky", () => {
    const p = pageRows(rows, 1)
    expect(p.rows).toHaveLength(25)
    expect([p.from, p.to, p.pages]).toEqual([1, 25, 3])
  })

  it("posledná strana je kratšia", () => {
    const p = pageRows(rows, 3)
    expect(p.rows).toHaveLength(10)
    expect([p.from, p.to]).toEqual([51, 60])
  })

  it("strana za koncom vráti poslednú, nie prázdno", () => {
    // Prázdna obrazovka po zmazaní dokumentu vyzerá ako porucha.
    expect(pageRows(rows, 99).page).toBe(3)
    expect(pageRows(rows, 0).page).toBe(1)
  })

  it("prázdny zoznam má jednu stranu a rozsah od nuly", () => {
    expect(pageRows([], 1)).toEqual({ rows: [], page: 1, pages: 1, from: 0, to: 0 })
  })

  it("zmena filtra vracia na prvú stranu, triedenie nie", () => {
    // Po zúžení filtra by človek skončil na piatej strane zoznamu, ktorý má
    // strany dve — teda na prázdnej obrazovke.
    const onPage5 = withPage(readFilters({ category: "norma" }), 5)
    expect(pageOf(toggle(onPage5, "status", "draft"))).toBe(1)
    expect(pageOf(setValue(onPage5, "search", "prestup"))).toBe(1)
    expect(pageOf(sortBy(onPage5, "title"))).toBe(1)
    // Variant navigácie filtrom nie je.
    expect(pageOf(setValue(onPage5, "layout", "sidebar"))).toBe(5)
  })
})

describe("pohľad", () => {
  it("predvolený je tabuľka a čokoľvek neznáme tiež", () => {
    expect(currentView(readFilters({}))).toBe("table")
    expect(normalizeView("mriezka")).toBe("table")
    expect(normalizeView("cards")).toBe("cards")
  })

  it("do adresy sa píšu len karty", () => {
    // Inak by každý odkaz niesol `view=table` a dva odkazy na ten istý
    // pohľad by vyzerali ako dva rôzne.
    const cards = setView(readFilters({}), "cards")
    expect(toQuery(cards)).toBe("/library?view=cards")
    expect(toQuery(setView(cards, "table"))).toBe("/library")
    expect(toQuery(readFilters({ view: "table" }))).toBe("/library")
  })

  it("prepnutie pohľadu nemení filtre, stranu ani triedenie", () => {
    // Je to tá istá množina dokumentov, len inak nakreslená.
    const f = withPage(sortBy(readFilters({ category: "norma" }), "title"), 3)
    const cards = setView(f, "cards")
    expect(cards.category).toEqual(["norma"])
    expect(pageOf(cards)).toBe(3)
    expect(currentSort(cards)).toEqual({ key: "title", dir: "asc" })
  })

  it("zrušenie filtrov pohľad nechá", () => {
    expect(currentView(clearFilters(setView(readFilters({ tag: "x" }), "cards")))).toBe("cards")
  })
})

describe("výber prežívajúci stránkovanie", () => {
  it("označené id sa čítajú z adresy — opakovaný kľúč aj čiarka", () => {
    expect(readFilters({ pick: ["a", "b"] }).picked).toEqual(["a", "b"])
    expect(readFilters({ pick: "a,b" }).picked).toEqual(["a", "b"])
    expect(readFilters({}).picked).toEqual([])
  })

  it("prepnutie pridá a odoberie, nič iné nemení", () => {
    const f = readFilters({ category: "norma" })
    const one = togglePick(f, "d1")
    expect(one.picked).toEqual(["d1"])
    expect(one.category).toEqual(["norma"])
    expect(togglePick(one, "d1").picked).toEqual([])
    // Prázdne id nie je výber.
    expect(togglePick(f, "  ").picked).toEqual([])
  })

  it("označenie riadka nevracia na prvú stranu", () => {
    // Zúženie filtra na prvú stranu vracia (strana 4 by mohla byť prázdna),
    // ale označenie riadka zoznam nezúži. Inak by sa na strane 3 nedalo
    // označiť nič — každý klik by človeka odhodil na začiatok.
    const onPage3 = withPage(readFilters({}), 3)
    expect(pageOf(togglePick(onPage3, "d1"))).toBe(3)
    expect(pageOf(pickPage(onPage3, ["d1", "d2"], true))).toBe(3)
  })

  it("výber sa nesie v každom odkaze, teda aj pri zmene strany a filtra", () => {
    // Toto je celý zmysel: bez `pick` v adrese by prechod na druhú stranu
    // výber zahodil, lebo formulár sa odošle až akciou.
    const f = togglePick(togglePick(readFilters({}), "d1"), "d2")
    expect(toQuery(withPage(f, 2))).toContain("pick=d1&pick=d2")
    expect(toQuery(toggle(f, "category", "norma"))).toContain("pick=d1&pick=d2")
    expect(carryFields(f).filter(([k]) => k === "pick")).toEqual([["pick", "d1"], ["pick", "d2"]])
  })

  it("označiť stranu pridá len chýbajúce, odznačiť vezme len tie z nej", () => {
    const f = togglePick(readFilters({}), "mimo")
    const on = pickPage(f, ["d1", "d2", "mimo"], true)
    expect(on.picked).toEqual(["mimo", "d1", "d2"])
    // Odznačenie strany nechá to, čo je označené inde — „označiť stranu" je
    // pomôcka na tejto strane, nie príkaz „chcem presne toto".
    expect(pickPage(on, ["d1", "d2"], false).picked).toEqual(["mimo"])
  })

  it("zrušenie filtrov výber nechá, zrušenie výberu filtre nechá", () => {
    const f = togglePick(readFilters({ category: "norma", tag: "x" }), "d1")
    expect(clearFilters(f).picked).toEqual(["d1"])
    const cleared = clearPicked(f)
    expect(cleared.picked).toEqual([])
    expect(cleared.category).toEqual(["norma"])
  })

  it("počíta, koľko z označených nie je vidieť", () => {
    // Cena za výber prežívajúci zmenu filtra: bez tohto čísla by človek
    // presunul dokumenty, o ktorých už nevie, že sú vybrané.
    expect(pickedOutsideCount(["d1", "d2", "d3"], ["d2"])).toBe(2)
    expect(pickedOutsideCount(["d1"], ["d1", "d2"])).toBe(0)
    expect(pickedOutsideCount([], ["d1"])).toBe(0)
  })
})
