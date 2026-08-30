/**
 * tajomstva.test.ts — šifrovanie prístupových údajov (D43).
 *
 * Testuje sa to, čo môže spôsobiť škodu: tichý priechod poškodeného zápisu,
 * čitateľné tajomstvo v návratovej hodnote určenej pre obrazovku, a zle
 * nastavený kľúč, ktorý by ticho vypol šifrovanie.
 */

import { describe, it, expect } from "vitest"
import {
  encrypt, decrypt, encryptionKey, secretStatus, SecretError,
} from "../src/lib/secrets"

const KLUC = Buffer.from("a".repeat(64), "hex")
const INY = Buffer.from("b".repeat(64), "hex")
const TAJOMSTVO = "Abc~8Q~velmiTajnyClientSecret.z-Entra"

describe("sifrovanie a rozsifrovanie", () => {
  it("čo sa zašifruje, sa dá rozšifrovať", () => {
    expect(decrypt(encrypt(TAJOMSTVO, KLUC), KLUC)).toBe(TAJOMSTVO)
  })

  it("dvakrát to isté dá dva rôzne zápisy", () => {
    // Rovnaký výstup by prezrádzal, že dvaja zákazníci majú rovnaké tajomstvo.
    expect(encrypt(TAJOMSTVO, KLUC)).not.toBe(encrypt(TAJOMSTVO, KLUC))
  })

  it("zašifrovaný zápis neobsahuje pôvodný text", () => {
    expect(encrypt(TAJOMSTVO, KLUC)).not.toContain("Entra")
  })

  it("iný kľúč neprejde", () => {
    expect(() => decrypt(encrypt(TAJOMSTVO, KLUC), INY)).toThrow(SecretError)
  })

  it("zmenený zápis spadne, nerozšifruje sa na nezmysel", () => {
    // Toto je celý dôvod, prečo GCM a nie CBC.
    const z = encrypt(TAJOMSTVO, KLUC)
    const casti = z.split(".")
    const sifra = Buffer.from(casti[3], "base64url")
    sifra[0] ^= 0xff
    casti[3] = sifra.toString("base64url")
    expect(() => decrypt(casti.join("."), KLUC)).toThrow(SecretError)
  })

  it("neznámy formát spadne, nevráti prázdno", () => {
    expect(() => decrypt("nieco-uplne-ine", KLUC)).toThrow(SecretError)
    expect(() => decrypt("v2.a.b.c", KLUC)).toThrow(SecretError)
    expect(() => decrypt("", KLUC)).toThrow(SecretError)
  })

  it("prázdne tajomstvo sa nešifruje", () => {
    expect(() => encrypt("", KLUC)).toThrow(SecretError)
  })
})

describe("kluc z prostredia", () => {
  it("chýbajúci kľúč znamená vypnuté, nie chybu", () => {
    // Zabudnutá voliteľná premenná nesmie zhodiť portál vrátane prihlásenia
    // e-mailom, ktoré s ňou nemá nič spoločné.
    expect(encryptionKey(undefined)).toBeNull()
    expect(encryptionKey("")).toBeNull()
    expect(encryptionKey("   ")).toBeNull()
  })

  it("zle dlhý kľúč je chyba, nie vypnuté", () => {
    // Znamená, že ho niekto nastaviť chcel a pomýlil sa. Ticho vypnúť
    // šifrovanie by v takom prípade bolo to najhoršie, čo sa dá spraviť.
    expect(() => encryptionKey("abc")).toThrow(SecretError)
    expect(() => encryptionKey("z".repeat(64))).toThrow(SecretError)
    expect(() => encryptionKey("a".repeat(63))).toThrow(SecretError)
  })

  it("chyba povie, ako si kľúč vyrobiť", () => {
    // Chybová hláška, ktorá nepovie, čo s ňou, je len iná podoba mlčania.
    expect(() => encryptionKey("abc")).toThrow(/openssl rand -hex 32/)
  })
})

describe("stav tajomstva pre obrazovku", () => {
  it("nikdy nevráti samotnú hodnotu", () => {
    const stav = secretStatus(encrypt(TAJOMSTVO, KLUC))
    expect(["nenastavene", "nastavene", "necitatelne"]).toContain(stav)
    expect(stav).not.toContain("Entra")
  })

  it("rozlíši nenastavené od nečitateľného", () => {
    // Sú to dve úplne rôzne situácie: prvá znamená „dokonči nastavenie",
    // druhá „niekto zmenil kľúč a treba údaje zadať znova".
    expect(secretStatus(undefined)).toBe("nenastavene")
    expect(secretStatus("")).toBe("nenastavene")
    expect(secretStatus("v1.zlé.údaje.tu")).toBe("necitatelne")
  })
})
