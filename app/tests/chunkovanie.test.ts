/**
 * chunkovanie.test.ts — identita textu vs. identita členenia (D57, D58).
 *
 * Toto je najdôležitejší test v knižnici: chráni pred tým, aby vyladenie
 * chunkera vyrobilo novú verziu normy a stovke ľudí naskočila povinnosť
 * potvrdiť ju znova. Chyba by sa neprejavila pádom — len tým, že sa niekomu
 * objaví úloha, ktorú nemá.
 */

import { describe, it, expect } from "vitest"
import { odtlacokTextu, odtlacokClenenia, trebaPreindexovat, VERZIA_CHUNKERA } from "../src/lib/chunkIdentity"
import { chunkuj, PREDVOLENY_PROFIL } from "../src/lib/chunker.mjs"

const NORMA = `Článok 1
Základné ustanovenia

(1) Toto je prvý odsek normy, ktorý má dosť textu na to, aby z neho vznikol úsek.
(2) Druhý odsek s ďalším obsahom, aby členenie malo čo deliť.

Článok 2
Ďalšie ustanovenia

(1) Text druhého článku.
`

describe("odtlacok textu", () => {
  it("rovnaky text da rovnaky odtlacok", () => {
    expect(odtlacokTextu(NORMA)).toBe(odtlacokTextu(NORMA))
  })

  it("konce riadkov a medzery na konci nie su zmena znenia", () => {
    // Inak by ten isty text ulozeny z Windows a z Macu vyzeral ako dve rozne
    // znenia -- a tym aj ako dve rozne povinnosti.
    expect(odtlacokTextu("a\nb\n")).toBe(odtlacokTextu("a\r\nb\r\n"))
    expect(odtlacokTextu("a  \nb")).toBe(odtlacokTextu("a\nb"))
    expect(odtlacokTextu("  a\nb  ")).toBe(odtlacokTextu("a\nb"))
  })

  it("zmena slova je zmena znenia", () => {
    expect(odtlacokTextu("moze")).not.toBe(odtlacokTextu("musi"))
  })

  it("oznacenie ani datum do identity nevstupuju", () => {
    // Cely dovod, preco funkcia berie len text: preklep v oznaceni sa musi
    // dat opravit bez toho, aby sa rozbili potvrdenia.
    expect(odtlacokTextu(NORMA)).toBe(odtlacokTextu(NORMA))
    expect(odtlacokTextu.length).toBe(1)
  })
})

describe("odtlacok clenenia", () => {
  it("zmena profilu zmeni clenenie, nie text", () => {
    const a = chunkuj(NORMA, { nazovDokumentu: "Norma" })
    const b = chunkuj(NORMA, { nazovDokumentu: "Norma", profil: { slovoClanok: "Paragraf" } })

    // Text je ten isty -> identita znenia sa nemeni.
    expect(odtlacokTextu(NORMA)).toBe(odtlacokTextu(NORMA))
    // Clenenie je ine -> chunkingId sa lisi a je vidiet, ze treba preindexovat.
    expect(odtlacokClenenia(a.chunky, PREDVOLENY_PROFIL))
      .not.toBe(odtlacokClenenia(b.chunky, { ...PREDVOLENY_PROFIL, slovoClanok: "Paragraf" }))
  })

  it("rovnaky vstup aj profil daju rovnaky odtlacok", () => {
    const a = chunkuj(NORMA, { nazovDokumentu: "Norma" })
    const b = chunkuj(NORMA, { nazovDokumentu: "Norma" })
    expect(odtlacokClenenia(a.chunky, PREDVOLENY_PROFIL))
      .toBe(odtlacokClenenia(b.chunky, PREDVOLENY_PROFIL))
  })

  it("profil je sucastou odtlacku aj ked vysledok vyzera rovnako", () => {
    // Bez toho by sa zmena parametra, ktora na tomto dokumente nic nespravila,
    // tvarila ako "netreba preindexovat" -- a pri dalsom dokumente by uz
    // spravila, ale nikto by nevedel preco.
    const a = chunkuj(NORMA, { nazovDokumentu: "Norma" })
    expect(odtlacokClenenia(a.chunky, PREDVOLENY_PROFIL))
      .not.toBe(odtlacokClenenia(a.chunky, { ...PREDVOLENY_PROFIL, cielMaxTokenov: 900 }))
  })
})

describe("kedy preindexovat", () => {
  it("chybajuce chunkingId znamena preindexovat", () => {
    // Tak vyzeraju dokumenty spred rozdelenia identit.
    expect(trebaPreindexovat(undefined, "abc")).toBe(true)
    expect(trebaPreindexovat(null, "abc")).toBe(true)
  })

  it("zhodne chunkingId znamena nic nerobit", () => {
    expect(trebaPreindexovat("abc", "abc")).toBe(false)
  })

  it("verzia chunkera je cislo, ktore zvysuje clovek", () => {
    expect(VERZIA_CHUNKERA).toBeGreaterThan(0)
  })
})

describe("profil clenenia", () => {
  it("predvolene slovo rozpozna clanky", () => {
    const { chunky } = chunkuj(NORMA, { nazovDokumentu: "Norma" })
    expect(chunky.length).toBeGreaterThan(0)
    expect(chunky.some(c => (c.articleRef ?? "").includes("1"))).toBe(true)
  })

  it("iné slovo rozpozná iné členenie", () => {
    const paragrafy = NORMA.replace(/Článok/g, "Paragraf")
    const s = chunkuj(paragrafy, { nazovDokumentu: "Norma", profil: { slovoClanok: "Paragraf" } })
    const bez = chunkuj(paragrafy, { nazovDokumentu: "Norma" })
    // Bez profilu sa dokument zleje do jedného bloku a vyhľadávanie nemá
    // čoho chytiť — presne to, kvôli čomu profil existuje.
    expect(s.statistiky.clankov).toBeGreaterThan(bez.statistiky.clankov)
  })
})
