import { describe, expect, it } from "vitest"
import {
  countryForPrefix, prefixForCountry, phoneCountries, splitPhone, normalizeCountryPhone,
} from "@/lib/phoneCountries"

describe("phoneCountries — krajina + číslo (D86)", () => {
  it("predvoľba organizácie vedie na hlavnú krajinu, prázdna na Slovensko", () => {
    expect(countryForPrefix("+421")).toBe("SK")
    expect(countryForPrefix("+420")).toBe("CZ")
    expect(countryForPrefix("+1")).toBe("US")
    expect(countryForPrefix("")).toBe("SK")
    expect(countryForPrefix(undefined)).toBe("SK")
    expect(countryForPrefix("+999")).toBe("SK")
  })

  it("krajina na predvoľbu; neznámy kód = nemeniť", () => {
    expect(prefixForCountry("SK")).toBe("+421")
    expect(prefixForCountry("CZ")).toBe("+420")
    expect(prefixForCountry("XX")).toBeUndefined()
    expect(prefixForCountry("")).toBeUndefined()
  })

  it("zoznam má navrchu krajinu organizácie, potom SK a CZ", () => {
    const list = phoneCountries("sk", "AT")
    expect(list.slice(0, 3).map(c => c.code)).toEqual(["AT", "SK", "CZ"])
    expect(list.find(c => c.code === "SK")?.label).toBe("Slovensko (+421)")
    expect(new Set(list.map(c => c.code)).size).toBe(list.length)
  })

  it("domáci tvar s nulou aj bez nej sa doplní predvoľbou krajiny", () => {
    expect(normalizeCountryPhone("0905 123 456", "SK")).toEqual({ ok: true, value: "+421905123456" })
    expect(normalizeCountryPhone("905123456", "SK")).toEqual({ ok: true, value: "+421905123456" })
    expect(normalizeCountryPhone("777 123 456", "CZ")).toEqual({ ok: true, value: "+420777123456" })
  })

  it("medzinárodné číslo berie krajinu z čísla, nie zo zoznamu", () => {
    expect(normalizeCountryPhone("+420 777 123 456", "SK")).toEqual({ ok: true, value: "+420777123456" })
    expect(normalizeCountryPhone("00420777123456", "SK")).toEqual({ ok: true, value: "+420777123456" })
  })

  it("číslo, ktoré pre krajinu nemá platný tvar, sa odmietne", () => {
    expect(normalizeCountryPhone("0905 123", "SK")).toEqual({ ok: false, reason: "phone.invalid" })
    expect(normalizeCountryPhone("0905123456789", "SK")).toEqual({ ok: false, reason: "phone.invalid" })
    expect(normalizeCountryPhone("kdesi", "SK")).toEqual({ ok: false, reason: "phone.invalid" })
  })

  it("prázdne je platné a znamená vyprázdniť", () => {
    expect(normalizeCountryPhone("", "SK")).toEqual({ ok: true, value: "" })
    expect(normalizeCountryPhone(undefined, "SK")).toEqual({ ok: true, value: "" })
  })

  it("uložené číslo sa rozdelí na krajinu a domáci tvar", () => {
    expect(splitPhone("+421905123456", "SK")).toEqual({ country: "SK", national: "0905 123 456" })
    expect(splitPhone("+420777123456", "SK")).toEqual({ country: "CZ", national: "777 123 456" })
    expect(splitPhone("", "CZ")).toEqual({ country: "CZ", national: "" })
    expect(splitPhone("nečitateľné", "SK")).toEqual({ country: "SK", national: "nečitateľné" })
  })
})
