/**
 * chunkingAnalysis.test.ts — analyzátor členenia (D79, etapa 2).
 *
 * Analyzátor navrhuje, človek rozhoduje. Testuje sa preto to, čo môže návrh
 * pokaziť: že sa nájde vzor, ktorý tam nie je, alebo že sa nenájde ten, ktorý
 * tam je — a hlavne, že dokument bez členenia sa **prizná**, nie že sa mu
 * pridelí najlepší zo zlých.
 */

import { describe, it, expect } from "vitest"
import {
  analyseChunking, structureSignals, analysisReason,
  PLAIN_PROFILE_KEY, STRUCTURE_THRESHOLD,
} from "../src/lib/chunkingAnalysis"

const PREDPIS = `PRVÁ ČASŤ - Všeobecné ustanovenia

Článok 1
Základné ustanovenia

(1) Toto je prvý odsek normy, ktorý má dosť textu na to, aby z neho vznikol úsek.
(2) Druhý odsek s ďalším obsahom.

Článok 2
Ďalšie ustanovenia

(1) Text druhého článku.
(2) A ešte jeden odsek.

Článok 3 - Záverečné ustanovenia

(1) Posledný odsek.
`

const ZAKON = `§ 1
Predmet úpravy

(1) Tento zákon upravuje podmienky.
(2) Ďalší odsek zákona.

§ 2
Vymedzenie pojmov

(1) Na účely tohto zákona sa rozumie.

§ 3
Účinnosť
`

const MANUAL = `Manuál pre rozhodcov

Pred zápasom si rozhodca overí stav hracej plochy a vybavenie.
Skontroluje siete, značenie a bezpečnosť priestoru pre divákov.

Počas zápasu vedie zápis o striedaniach a napomenutiach.
Po zápase odovzdá zápis do informačného systému do 24 hodín.
`

describe("signaly v texte", () => {
  it("spocita hlavicky clankov a odseky", () => {
    const s = structureSignals(PREDPIS)
    expect(s.articleWord).toBe(3)
    expect(s.numberedParagraphs).toBe(5)
    expect(s.paragraphSign).toBe(0)
  })

  it("prazdne riadky sa nepocitaju", () => {
    // Pri PDF byva polovica suboru prazdna a podiel by to zriedilo na nezmysel.
    expect(structureSignals("a\n\n\n\nb").lines).toBe(2)
  })

  it("opakovane riadky su hlavicky a paty, nie obsah", () => {
    const s = structureSignals("Strana 1\nText\nStrana 1\nText 2\nStrana 1")
    expect(s.repeatedLines).toBe(3)
  })

  it("prazdny text nespadne", () => {
    expect(structureSignals("").lines).toBe(0)
    expect(analyseChunking("").confident).toBe(false)
  })
})

describe("navrh profilu", () => {
  it("predpis SFZ navrhne clankovy profil", () => {
    const a = analyseChunking(PREDPIS)
    expect(a.confident).toBe(true)
    expect(a.suggestions[0].key).toBe("sfz_predpis")
    expect(a.suggestions[0].articleWord).toBe("Článok")
  })

  it("zakon navrhne paragrafovy profil", () => {
    const a = analyseChunking(ZAKON)
    expect(a.confident).toBe(true)
    expect(a.suggestions[0].key).toBe("zakon")
    expect(a.suggestions[0].articleWord).toBe("§")
  })

  it("manual sa PRIZNA, nedostane najlepsi zo zlych", () => {
    // Toto je najpodstatnejsi test suboru: dokument bez clenenia nesmie
    // dostat profil so skore 0,3 % len preto, ze je to najvyssie cislo.
    const a = analyseChunking(MANUAL)
    expect(a.confident).toBe(false)
    expect(a.suggestions[a.suggestions.length - 1].key).toBe(PLAIN_PROFILE_KEY)
  })

  it("volny text je vzdy posledna moznost, aj pri rozpoznanom dokumente", () => {
    // Keby chybal, obrazovka by pri manualy nemala co ponuknut.
    const a = analyseChunking(PREDPIS)
    expect(a.suggestions.map(s => s.key)).toContain(PLAIN_PROFILE_KEY)
  })

  it("tri hlavicky su minimum — jedna zmienka nie je clenenie", () => {
    const a = analyseChunking("Článok 1\nNejaky text\nDalsi text\nA este dalsi")
    expect(a.confident).toBe(false)
  })

  it("slovo v texte nie je hlavicka", () => {
    // "podla Clanku 5" vo vete sa nesmie ratat -- vzor je kotveny na zaciatok.
    const a = analyseChunking("Podľa Článok 5 sa postupuje takto.\nĎalší riadok.")
    expect(a.signals.articleWord).toBe(0)
  })

  it("prah je podiel, nie pocet", () => {
    // Tri clanky v kratkom predpise su clenenie...
    expect(analyseChunking(PREDPIS).confident).toBe(true)
    // ...tri clanky v dlhom texte uz nie.
    const dlhy = "Článok 1\nČlánok 2\nČlánok 3\n" + Array(2000).fill("Bežný riadok textu.").join("\n")
    expect(analyseChunking(dlhy).confident).toBe(false)
    expect(analyseChunking(dlhy).suggestions[0].score).toBeLessThan(STRUCTURE_THRESHOLD)
  })
})

describe("veta pre cloveka", () => {
  it("pri rozpoznanom dokumente povie, coho a kolko", () => {
    const text = analysisReason(analyseChunking(PREDPIS))
    expect(text).toContain("Článok")
    expect(text).toContain("odsekov")
  })

  it("pri nerozpoznanom povie, ze chunker nema coho chytit", () => {
    expect(analysisReason(analyseChunking(MANUAL))).toContain("nemá čoho chytiť")
  })
})
