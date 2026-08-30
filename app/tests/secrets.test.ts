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

const KEY = Buffer.from("a".repeat(64), "hex")
const OTHER = Buffer.from("b".repeat(64), "hex")
const SECRET = "Abc~8Q~velmiTajnyClientSecret.z-Entra"

describe("sifrovanie a rozsifrovanie", () => {
  it("čo sa zašifruje, sa dá rozšifrovať", () => {
    expect(decrypt(encrypt(SECRET, KEY), KEY)).toBe(SECRET)
  })

  it("dvakrát to isté dá dva rôzne zápisy", () => {
    // Rovnaký výstup by prezrádzal, že dvaja zákazníci majú rovnaké tajomstvo.
    expect(encrypt(SECRET, KEY)).not.toBe(encrypt(SECRET, KEY))
  })

  it("zašifrovaný zápis neobsahuje pôvodný text", () => {
    expect(encrypt(SECRET, KEY)).not.toContain("Entra")
  })

  it("iný kľúč neprejde", () => {
    expect(() => decrypt(encrypt(SECRET, KEY), OTHER)).toThrow(SecretError)
  })

  it("zmenený zápis spadne, nerozšifruje sa na nezmysel", () => {
    // Toto je celý dôvod, prečo GCM a nie CBC.
    const z = encrypt(SECRET, KEY)
    const parts = z.split(".")
    const cipher = Buffer.from(parts[3], "base64url")
    cipher[0] ^= 0xff
    parts[3] = cipher.toString("base64url")
    expect(() => decrypt(parts.join("."), KEY)).toThrow(SecretError)
  })

  it("neznámy formát spadne, nevráti prázdno", () => {
    expect(() => decrypt("nieco-uplne-ine", KEY)).toThrow(SecretError)
    expect(() => decrypt("v2.a.b.c", KEY)).toThrow(SecretError)
    expect(() => decrypt("", KEY)).toThrow(SecretError)
  })

  it("prázdne tajomstvo sa nešifruje", () => {
    expect(() => encrypt("", KEY)).toThrow(SecretError)
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
    const status = secretStatus(encrypt(SECRET, KEY))
    expect(["nenastavene", "nastavene", "necitatelne"]).toContain(status)
    expect(status).not.toContain("Entra")
  })

  it("rozlíši nenastavené od nečitateľného", () => {
    // Sú to dve úplne rôzne situácie: prvá znamená „dokonči nastavenie",
    // druhá „niekto zmenil kľúč a treba údaje zadať znova".
    expect(secretStatus(undefined)).toBe("nenastavene")
    expect(secretStatus("")).toBe("nenastavene")
    expect(secretStatus("v1.zlé.údaje.tu")).toBe("necitatelne")
  })
})
