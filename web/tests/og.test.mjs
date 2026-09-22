/**
 * Texty pre obrázok, ktorý ide na sociálne siete.
 *
 * `skrat()` má v `lib/ogTexty.js` zapísanú minulú chybu: prvá verzia rezala na
 * presnom počte znakov a v češtine z toho vyšlo „kdo by změny sle…". Toto
 * je miesto, kde tá lekcia má bývať — komentár ju pripomína, test ju drží.
 */
import { describe, it, expect } from "vitest"
import { skrat, textyStranky } from "../lib/ogTexty.js"
import { getDictionary } from "../lib/dictionaries.js"

describe("skrat()", () => {
  it("kratší text nechá tak", () => {
    expect(skrat("Opýtajte sa.", 40)).toBe("Opýtajte sa.")
  })

  it("prázdny vstup nespadne", () => {
    expect(skrat("", 10)).toBe("")
    expect(skrat(undefined, 10)).toBe("")
  })

  it("reže na hranici slova, nie uprostred", () => {
    const vysledok = skrat("kdo by změny sledoval", 16)
    expect(vysledok).toBe("kdo by změny…")
    expect(vysledok).not.toContain("sle…")
  })

  it("nenechá za sebou čiarku ani pomlčku", () => {
    expect(skrat("prvé slovo, druhé slovo", 12)).toBe("prvé slovo…")
    expect(skrat("prvé slovo — druhé", 13)).toBe("prvé slovo…")
  })

  it("keď je jedno slovo dlhšie než strop, reže ho", () => {
    // Inak by sa vrátil text dlhší než plátno. Hranica 0,6 × max je v kóde
    // práve preto, aby sa nevrátil takmer prázdny výsledok.
    expect(skrat("Nezamestnanostennychzrazovkoordinator", 12)).toBe("Nezamestnano…")
  })
})

describe("textyStranky()", () => {
  const dict = getDictionary("sk")

  it("dá každej známej stránke jej vlastný nadpis", () => {
    const stranky = ["pre-koho", "bezpecnost", "prevadzka", "technologia"]
    const nadpisy = stranky.map(s => textyStranky(dict, s).title)

    expect(new Set(nadpisy).size).toBe(stranky.length)
    for (const t of nadpisy) expect(t).toBeTruthy()
  })

  it("neznáma stránka padá na úvod, nie na prázdno", () => {
    const uvod = textyStranky(dict, "domov")
    expect(textyStranky(dict, "neexistuje")).toEqual(uvod)
    expect(uvod.title).toBeTruthy()
  })

  it("funguje pre všetky tri jazyky", () => {
    for (const jazyk of ["sk", "cs", "en"]) {
      const t = textyStranky(getDictionary(jazyk), "technologia")
      expect(t.eyebrow).toBeTruthy()
      expect(t.title).toBeTruthy()
      expect(t.sub).toBeTruthy()
    }
  })
})
