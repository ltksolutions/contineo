/**
 * phoneCountries.ts — telefón ako krajina + číslo (D86, rozhodnutie Jána 4. 10. 2026).
 *
 * Voľné pole na predvoľbu zvádzalo zapísať do neho celé číslo a voľné pole na
 * telefón osoby nevedelo povedať, či `0905 123 456` je slovenské alebo české.
 * Krajina sa preto vyberá zo zoznamu a číslo sa overí podľa jej pravidiel.
 *
 * Zoznam krajín, predvoľby a dĺžky čísel sú z `libphonenumber-js` (metadáta
 * Googlu), nie z vlastného číselníka: predvoľby sa nemenia a číselník by
 * nikto neudržiaval. Názvy krajín dá `Intl.DisplayNames` v jazyku prostredia,
 * takže netreba prekladať 240 názvov.
 *
 * V databáze ostáva E.164 (`+421905123456`) a pri organizácii predvoľba
 * (`+421`) — tvar uložených dát sa nemení, nie je to migrácia.
 */

import {
  getCountries,
  getCountryCallingCode,
  Metadata,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js"
import { DEFAULT_PHONE_PREFIX, type PhoneResult } from "./personFields"

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2, napr. `SK`. */
  code: string
  /** Predvoľba s `+`, napr. `+421`. */
  dial: string
  /** „Slovensko (+421)" v jazyku prostredia. */
  label: string
}

/** Krajiny navrchu zoznamu — za krajinou organizácie (SFZ je slovenský, susedia českí). */
const PINNED = ["SK", "CZ"]

/*
 * `getCountryCodesForCallingCode()` v knižnici je, len chýba v jej typoch.
 * Vracia krajiny s danou predvoľbou, hlavnú prvú.
 */
const metadata = new Metadata() as unknown as {
  getCountryCodesForCallingCode(code: string): string[] | undefined
}

export function isPhoneCountry(code: string | undefined): code is CountryCode {
  return !!code && (getCountries() as string[]).includes(code)
}

/**
 * Predvoľba → krajina. Viac krajín zdieľa tú istú predvoľbu (`+1` USA aj
 * Kanada, `+44` Británia aj Jersey); vráti sa **hlavná** — tú metadáta
 * uvádzajú prvú. Neznáma alebo prázdna predvoľba padá na Slovensko, tak ako
 * `normalizePhone()` padá na `+421`.
 */
export function countryForPrefix(prefix: string | undefined): CountryCode {
  const digits = ((prefix ?? "").trim() || DEFAULT_PHONE_PREFIX).replace(/^\+/, "")
  const main = metadata.getCountryCodesForCallingCode(digits)?.[0]
  return isPhoneCountry(main) ? main : "SK"
}

/**
 * Krajina → predvoľba s `+`. Neznámy kód vráti `undefined` = pole nemeniť
 * (formulár bez zoznamu, napríklad starší v otvorenej karte).
 */
export function prefixForCountry(code: string | undefined): string | undefined {
  return isPhoneCountry(code) ? `+${getCountryCallingCode(code)}` : undefined
}

/**
 * Všetky krajiny na výber: krajina organizácie, potom Slovensko a Česko,
 * potom ostatné podľa abecedy jazyka prostredia.
 */
export function phoneCountries(language: string, first?: string): PhoneCountry[] {
  let names: Intl.DisplayNames | null = null
  try {
    names = new Intl.DisplayNames([language, "sk"], { type: "region" })
  } catch {
    names = null
  }
  const all = getCountries().map(code => {
    const dial = `+${getCountryCallingCode(code)}`
    const name = names?.of(code) ?? code
    return { code: code as string, dial, label: `${name} (${dial})`, name }
  })
  const pinned = [first, ...PINNED].filter((c, i, a): c is string => !!c && a.indexOf(c) === i)
  const top = pinned.map(c => all.find(x => x.code === c)).filter(x => !!x)
  const rest = all
    .filter(x => !pinned.includes(x.code))
    .sort((a, b) => a.name.localeCompare(b.name, language))
  return [...top, ...rest].map(({ code, dial, label }) => ({ code, dial, label }))
}

/**
 * Uložené číslo → krajina a číslo v domácom tvare, na predvyplnenie formulára.
 *
 * Prázdne číslo dostane krajinu organizácie. Číslo, ktoré sa prečítať nedá
 * (staršie dáta), sa vráti celé — človek ho vidí a môže ho opraviť.
 */
export function splitPhone(
  stored: string | undefined,
  fallback: CountryCode,
): { country: CountryCode; national: string } {
  const text = (stored ?? "").trim()
  if (!text) return { country: fallback, national: "" }
  const parsed = parsePhoneNumberFromString(text)
  if (!parsed?.country) return { country: fallback, national: text }
  return { country: parsed.country, national: parsed.formatNational() }
}

/**
 * Číslo zadané pri zvolenej krajine → E.164.
 *
 * Domáci tvar s nulou aj bez nej (`0905 123 456`, `905 123 456`) sa doplní
 * predvoľbou krajiny. Číslo napísané s `+` alebo `00` je medzinárodné a
 * krajina sa vtedy berie z neho — kto vloží celé číslo, nemusí meniť zoznam.
 *
 * `phone.invalid` znamená, že číslo pre tú krajinu nemá platný tvar (dĺžka,
 * začiatok). Prázdne je platné a znamená vyprázdniť pole.
 */
export function normalizeCountryPhone(raw: string | undefined, country: CountryCode): PhoneResult {
  const text = (raw ?? "").trim()
  if (!text) return { ok: true, value: "" }
  const compact = text.replace(/[\s.\-/()]/g, "")
  const international = compact.startsWith("+") || compact.startsWith("00")
  const parsed = international
    ? parsePhoneNumberFromString(compact.startsWith("00") ? `+${compact.slice(2)}` : compact)
    : parsePhoneNumberFromString(compact, country)
  if (!parsed || !parsed.isValid()) return { ok: false, reason: "phone.invalid" }
  return { ok: true, value: parsed.number }
}
