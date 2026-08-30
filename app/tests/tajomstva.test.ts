/**
 * tajomstva.test.ts — šifrovanie prístupových údajov (D43).
 *
 * Testuje sa to, čo môže spôsobiť škodu: tichý priechod poškodeného zápisu,
 * čitateľné tajomstvo v návratovej hodnote určenej pre obrazovku, a zle
 * nastavený kľúč, ktorý by ticho vypol šifrovanie.
 */

import { describe, it, expect } from "vitest"
import {
  zasifruj, rozsifruj, sifrovaciKluc, stavTajomstva, TajomstvoError,
} from "../src/lib/secrets"

const KLUC = Buffer.from("a".repeat(64), "hex")
const INY = Buffer.from("b".repeat(64), "hex")
const TAJOMSTVO = "Abc~8Q~velmiTajnyClientSecret.z-Entra"

describe("sifrovanie a rozsifrovanie", () => {
  it("čo sa zašifruje, sa dá rozšifrovať", () => {
    expect(rozsifruj(zasifruj(TAJOMSTVO, KLUC), KLUC)).toBe(TAJOMSTVO)
  })

  it("dvakrát to isté dá dva rôzne zápisy", () => {
    // Rovnaký výstup by prezrádzal, že dvaja zákazníci majú rovnaké tajomstvo.
    expect(zasifruj(TAJOMSTVO, KLUC)).not.toBe(zasifruj(TAJOMSTVO, KLUC))
  })

  it("zašifrovaný zápis neobsahuje pôvodný text", () => {
    expect(zasifruj(TAJOMSTVO, KLUC)).not.toContain("Entra")
  })

  it("iný kľúč neprejde", () => {
    expect(() => rozsifruj(zasifruj(TAJOMSTVO, KLUC), INY)).toThrow(TajomstvoError)
  })

  it("zmenený zápis spadne, nerozšifruje sa na nezmysel", () => {
    // Toto je celý dôvod, prečo GCM a nie CBC.
    const z = zasifruj(TAJOMSTVO, KLUC)
    const casti = z.split(".")
    const sifra = Buffer.from(casti[3], "base64url")
    sifra[0] ^= 0xff
    casti[3] = sifra.toString("base64url")
    expect(() => rozsifruj(casti.join("."), KLUC)).toThrow(TajomstvoError)
  })

  it("neznámy formát spadne, nevráti prázdno", () => {
    expect(() => rozsifruj("nieco-uplne-ine", KLUC)).toThrow(TajomstvoError)
    expect(() => rozsifruj("v2.a.b.c", KLUC)).toThrow(TajomstvoError)
    expect(() => rozsifruj("", KLUC)).toThrow(TajomstvoError)
  })

  it("prázdne tajomstvo sa nešifruje", () => {
    expect(() => zasifruj("", KLUC)).toThrow(TajomstvoError)
  })
})

describe("kluc z prostredia", () => {
  it("chýbajúci kľúč znamená vypnuté, nie chybu", () => {
    // Zabudnutá voliteľná premenná nesmie zhodiť portál vrátane prihlásenia
    // e-mailom, ktoré s ňou nemá nič spoločné.
    expect(sifrovaciKluc(undefined)).toBeNull()
    expect(sifrovaciKluc("")).toBeNull()
    expect(sifrovaciKluc("   ")).toBeNull()
  })

  it("zle dlhý kľúč je chyba, nie vypnuté", () => {
    // Znamená, že ho niekto nastaviť chcel a pomýlil sa. Ticho vypnúť
    // šifrovanie by v takom prípade bolo to najhoršie, čo sa dá spraviť.
    expect(() => sifrovaciKluc("abc")).toThrow(TajomstvoError)
    expect(() => sifrovaciKluc("z".repeat(64))).toThrow(TajomstvoError)
    expect(() => sifrovaciKluc("a".repeat(63))).toThrow(TajomstvoError)
  })

  it("chyba povie, ako si kľúč vyrobiť", () => {
    // Chybová hláška, ktorá nepovie, čo s ňou, je len iná podoba mlčania.
    expect(() => sifrovaciKluc("abc")).toThrow(/openssl rand -hex 32/)
  })
})

describe("stav tajomstva pre obrazovku", () => {
  it("nikdy nevráti samotnú hodnotu", () => {
    const stav = stavTajomstva(zasifruj(TAJOMSTVO, KLUC))
    expect(["nenastavene", "nastavene", "necitatelne"]).toContain(stav)
    expect(stav).not.toContain("Entra")
  })

  it("rozlíši nenastavené od nečitateľného", () => {
    // Sú to dve úplne rôzne situácie: prvá znamená „dokonči nastavenie",
    // druhá „niekto zmenil kľúč a treba údaje zadať znova".
    expect(stavTajomstva(undefined)).toBe("nenastavene")
    expect(stavTajomstva("")).toBe("nenastavene")
    expect(stavTajomstva("v1.zlé.údaje.tu")).toBe("necitatelne")
  })
})
