/**
 * Zhoda kľúčov medzi jazykmi.
 *
 * Slovníky majú vyše 2300 riadkov a tri mutácie. Bežné zlyhanie nie je
 * preklep, ale **pridaný kľúč v `sk`, na ktorý sa v `cs` a `en` zabudlo** —
 * a to sa neprejaví chybou, ale prázdnym miestom na stránke, spravidla až
 * keď si toho niekto všimne v cudzom jazyku.
 *
 * Test preto neporovnáva texty (tie sa líšiť majú), ale **tvar**: rovnaké
 * cesty ku kľúčom a rovnaké typy hodnôt.
 */
import { describe, it, expect } from "vitest"
import { dictionaries, locales, getDictionary } from "../lib/dictionaries.js"

/** Ploché cesty ku všetkým listom stromu: `nav.features`, `hero.title`… */
function cesty(uzol, predpona = "") {
  if (uzol === null || typeof uzol !== "object") return [predpona]
  if (Array.isArray(uzol)) {
    return uzol.flatMap((x, i) => cesty(x, `${predpona}[${i}]`))
  }
  return Object.entries(uzol).flatMap(([k, v]) =>
    cesty(v, predpona ? `${predpona}.${k}` : k),
  )
}

describe("slovníky", () => {
  it("majú všetky tri jazyky zo zoznamu `locales`", () => {
    expect(Object.keys(dictionaries).sort()).toEqual([...locales].sort())
  })

  const zakladne = cesty(dictionaries.sk).sort()

  for (const jazyk of ["cs", "en"]) {
    it(`\`${jazyk}\` má presne tie isté kľúče ako \`sk\``, () => {
      const iny = cesty(dictionaries[jazyk]).sort()

      // Vypísať rozdiel menovite, nie len „nezhoda" — pri 2300 riadkoch je
      // hláška „chýba hero.badge" rozdiel medzi minútou a hodinou.
      const chyba = zakladne.filter(k => !iny.includes(k))
      const navyse = iny.filter(k => !zakladne.includes(k))
      expect({ chyba, navyse }).toEqual({ chyba: [], navyse: [] })
    })
  }
})

describe("getDictionary()", () => {
  it("vráti slovník pre známy jazyk", () => {
    expect(getDictionary("en").locale).toBe("en")
  })

  it("padá na slovenčinu, nie na `undefined`", () => {
    // Prázdne miesto alebo `cannot read property` na obrazovke je horšie
    // než nepreložená veta — to isté pravidlo ako v intranete (`i18n.ts`).
    expect(getDictionary("de").locale).toBe("sk")
    expect(getDictionary(undefined).locale).toBe("sk")
  })
})
