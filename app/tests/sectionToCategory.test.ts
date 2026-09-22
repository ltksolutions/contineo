/**
 * sectionToCategory.test.ts — zlúčenie Zaradenia do Druhu (O21 krok 2).
 *
 * Mapovanie používa migračný skript aj aplikácia; keby sa líšili, dokumenty
 * by po migrácii mali iný druh, než aký by im dal zápis. Test stráži, že
 * pravidlo je jedno — a že neznáme zaradenie sa **nevymýšľa**.
 */

import { describe, it, expect } from "vitest"
import { categoryFromSection, SECTION_TO_CATEGORY } from "../src/lib/sectionToCategory"
import categories from "../src/codelists/category.json"

describe("zaradenie na druh", () => {
  it("poriadok je norma — lisia sa predmetom, nie druhom", () => {
    expect(categoryFromSection("sutazny_poriadok")).toBe("norma")
    expect(categoryFromSection("disciplinarny_poriadok")).toBe("norma")
    expect(categoryFromSection("stanovy")).toBe("norma")
  })

  it("zakon, smernica a manual maju vlastny druh", () => {
    expect(categoryFromSection("zakony")).toBe("zakon")
    expect(categoryFromSection("smernice")).toBe("smernica")
    expect(categoryFromSection("rozpisy_manualy")).toBe("manual")
  })

  it("zapisnica, zmluva a tlacivo normy nie su — druh pre ne pribudol", () => {
    expect(categoryFromSection("zapisnice")).toBe("zapisnica")
    expect(categoryFromSection("zmluvy")).toBe("zmluva")
    expect(categoryFromSection("tlaciva_formulare")).toBe("tlacivo")
  })

  it("nezname zaradenie sa nevymysla — druh mu da clovek", () => {
    expect(categoryFromSection("nieco_ine")).toBeUndefined()
    expect(categoryFromSection("")).toBeUndefined()
    expect(categoryFromSection(undefined)).toBeUndefined()
    expect(categoryFromSection(null)).toBeUndefined()
  })

  it("velke pismena a medzery neprekazaju — hodnoty chodia zo starych dat", () => {
    expect(categoryFromSection("  SMERNICE ")).toBe("smernica")
  })

  it("kazdy cielovy druh je v ciselniku — inak by migracia zapisala neplatnu hodnotu", () => {
    const known = new Set((categories.items as { key: string }[]).map(i => i.key))
    for (const target of new Set(Object.values(SECTION_TO_CATEGORY))) {
      expect(known.has(target), `druh "${target}" chýba v category.json`).toBe(true)
    }
  })
})
