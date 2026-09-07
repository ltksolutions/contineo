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
