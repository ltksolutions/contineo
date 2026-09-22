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

  /**
   * Známy rozdiel, ktorý tento test našiel pri prvom behu (2026-09-22).
   *
   * `tech.identity.providers` má v slovenčine **štyri** položky, v češtine
   * a angličtine **päť**. Slovenčine chýba „vlastná databáza" a štvrtá
   * položka je formŭlovaná inak („— pripravujeme"). Je to **obsahová diera
   * na živom webe**, nie chyba testu: hlavný jazyk ukazuje menšiu ponuku
   * než cudzie mutácie.
   *
   * Text sem nedopíšem z hlavy — je to tvrdenie o produkte. Čaká na znenie
   * od Jána; keď príde, tieto dva riadky zmiznú a test bude opäť prísny.
   */
  const ZNAME_ROZDIELY = [
    "tech.identity.providers[4].name",
    "tech.identity.providers[4].role",
  ]

  for (const jazyk of ["cs", "en"]) {
    it(`\`${jazyk}\` má presne tie isté kľúče ako \`sk\``, () => {
      const iny = cesty(dictionaries[jazyk]).sort()

      // Vypísať rozdiel menovite, nie len „nezhoda" — pri 2300 riadkoch je
      // hláška „chýba hero.badge" rozdiel medzi minútou a hodinou.
      const chyba = zakladne.filter(k => !iny.includes(k))
      const navyse = iny
        .filter(k => !zakladne.includes(k))
        .filter(k => !ZNAME_ROZDIELY.includes(k))
      expect({ chyba, navyse }).toEqual({ chyba: [], navyse: [] })
    })
  }

  it("známe rozdiely stále existujú — inak treba zmazať výnimku", () => {
    // Bez tohto by výnimka prežila aj po oprave a ticho by kryla niečo ďalšie.
    const cs = cesty(dictionaries.cs)
    for (const k of ZNAME_ROZDIELY) expect(cs).toContain(k)
  })

  it("nemá prázdne texty", () => {
    const prazdne = []
    for (const jazyk of locales) {
      const d = dictionaries[jazyk]
      for (const cesta of cesty(d)) {
        const hodnota = cesta
          .replace(/\[(\d+)\]/g, ".$1")
          .split(".")
          .reduce((o, k) => (o == null ? o : o[k]), d)
        if (typeof hodnota === "string" && hodnota.trim() === "") {
          prazdne.push(`${jazyk}: ${cesta}`)
        }
      }
    }
    expect(prazdne).toEqual([])
  })
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
