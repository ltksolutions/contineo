/**
 * tidyStructure.test.ts — prečistenie členenia bez modelu.
 *
 * Vzorka v `fixtures/norma-ukazka.txt` je **doslovný začiatok skutočného
 * Disciplinárneho poriadku SFZ** prevedeného z PDF, nie vymyslený text.
 * Vymyslená vzorka by potvrdila pravidlá, ktoré som do nej sám vložil.
 *
 * Najdôležitejší test je ten posledný: **postupnosť slov sa nesmie zmeniť.**
 * Bez neho je veta „nemení sa ani jedno slovo normy" sľub, nie tvrdenie —
 * a je to veta, na ktorej stojí rozhodnutie nepoužiť na to jazykový model.
 */

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { tidyStructure, textFingerprint } from "../src/lib/tidyStructure"

const sample = readFileSync(join(import.meta.dirname, "fixtures", "norma-ukazka.txt"), "utf8")

describe("prečistenie členenia", () => {
  const r = tidyStructure(sample)
  const lines = r.markdown.split("\n")

  it("časť sa stane nadpisom prvej úrovne aj s názvom", () => {
    expect(lines).toContain("# PRVÁ ČASŤ — Všeobecná časť (článok 1 - 43)")
  })

  it("hlava druhej úrovne", () => {
    expect(lines).toContain("## Prvá hlava — Úvodné ustanovenia (článok 1 - 5)")
  })

  it("článok tretej úrovne aj s názvom", () => {
    expect(lines).toContain("### Článok 1 — Základné ustanovenia")
    expect(lines).toContain("### Článok 2 — Predmet disciplinárneho poriadku")
  })

  it("pätička strany je preč", () => {
    expect(r.markdown).not.toMatch(/Strana \d+ z \d+/)
    expect(r.removedFurniture).toBeGreaterThan(0)
  })

  it("rozbitá značka poznámky je späť na jednom riadku", () => {
    // V PDF stojí `1` a `) a disciplinárnych…` na dvoch riadkoch.
    expect(lines.some(l => /^\d+\) a disciplinárnych orgánov/.test(l.trim()))).toBe(true)
    expect(lines.some(l => l.trim() === "1")).toBe(false)
    expect(r.footnotes).toBeGreaterThan(0)
  })

  it("odseky (1), (2) zostávajú, ako boli", () => {
    expect(lines.some(l => l.startsWith("(1) Slovenský futbalový zväz"))).toBe(true)
    expect(lines.some(l => l.startsWith("(2) Orgány SFZ"))).toBe(true)
  })

  it("NEMENÍ SA ANI JEDNO SLOVO — okrem odstránenej pätičky", () => {
    // Zo vstupu sa odstránia tie isté riadky, ktoré odstránil aj prečistenie,
    // a porovná sa postupnosť slov. Iný rozdiel než pätička neprejde.
    const furniture = [
      "Disciplinárny poriadok futbalu SFZ",
      "schválený na zasadnutí výkonného výboru SFZ dňa 8. júna 2021 v Bratislave " +
      "v znení neskorších zmien a doplnení",
    ]
    const before = sample.split("\n")
      .filter(l => !/^Strana \d+ z \d+$/.test(l.trim()) && !furniture.includes(l.trim()))
      .join("\n")

    const a = textFingerprint(before)
    const b = textFingerprint(r.markdown)

    // Pri nezhode je holé porovnanie dvoch stotisícových reťazcov nečitateľné.
    // Preto sa ukáže prvé miesto, kde sa rozišli, aj s okolím.
    if (a !== b) {
      let i = 0
      while (i < a.length && i < b.length && a[i] === b[i]) i++
      expect({
        prvyRozdielNaZnaku: i,
        pred: a.slice(Math.max(0, i - 40), i + 40),
        po: b.slice(Math.max(0, i - 40), i + 40),
      }).toEqual({ prvyRozdielNaZnaku: -1, pred: "", po: "" })
    }
    expect(b).toBe(a)
  })
})

describe("prečistenie nič nepokazí, keď niet čo prečistiť", () => {
  it("obyčajný text prejde nezmenený", () => {
    const text = "Toto je obyčajná veta.\nA ešte jedna."
    const r = tidyStructure(text)
    expect(r.markdown).toBe(text)
    expect(r.headings).toBe(0)
  })

  it("dokument bez čísel strán nepríde o žiadny riadok", () => {
    const text = "Článok 1\nNázov\nNejaký text."
    const r = tidyStructure(text)
    expect(r.removedFurniture).toBe(0)
    expect(r.warnings.some(w => w.includes("čísla strán"))).toBe(true)
  })

  it("článok bez názvu nedostane vymyslený", () => {
    // Za `Článok 5` ide rovno odsek — názov článok nemá a vyrobiť mu ho
    // nie je naša vec.
    const r = tidyStructure("Článok 5\n(1) Text odseku.")
    expect(r.markdown.split("\n")[0]).toBe("### Článok 5")
    expect(r.markdown).toContain("(1) Text odseku.")
  })

  it("prázdny vstup nespadne", () => {
    expect(tidyStructure("").markdown).toBe("")
  })

  it("konce riadkov CRLF fungujú rovnako", () => {
    const r = tidyStructure("Článok 1\r\nNázov\r\n(1) Text.")
    expect(r.markdown).toContain("### Článok 1 — Názov")
    expect(r.markdown).not.toContain("\r")
  })
})
