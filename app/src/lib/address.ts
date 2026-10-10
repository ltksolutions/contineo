/**
 * address.ts — sídlo organizácie po častiach (ulica, číslo, PSČ, mesto).
 *
 * Do 10. 10. 2026 bolo sídlo jedno pole (`controller.address`, „Tomášikova
 * 30C, 821 01 Bratislava"). Teraz sa ukladajú časti a riadok sa **skladá**
 * (D27 — stav sa odvodzuje, neukladá): dve pravdy o tej istej adrese by sa
 * raz rozišli. Faktúry za služby budú potrebovať časti zvlášť (ADR-031).
 *
 * Starý riadok ostáva len ako záloha pre organizáciu, ktorú ešte nezasiahla
 * migrácia (`scripts/migrate_controller_address.mjs`); prvé uloženie
 * nastavení ho nahradí časťami.
 *
 * Tvar SK aj CZ je rovnaký: „Ulica číslo, PSČ Mesto".
 */

export interface AddressParts {
  street?: string
  streetNumber?: string
  postalCode?: string
  city?: string
}

/** Časti adresy z prevádzkovateľa; prázdne časti sú `undefined`. */
export function addressParts(c: AddressParts & { address?: string } | null | undefined): AddressParts {
  if (!c) return {}
  const own = { street: c.street, streetNumber: c.streetNumber, postalCode: c.postalCode, city: c.city }
  if (Object.values(own).some(v => v && v.trim())) return own
  // Záloha: organizácia pred migráciou má len riadok.
  return c.address ? parseAddress(c.address) : {}
}

/**
 * Sídlo v jednom riadku — do päty PDF, na `/privacy`, na certifikát.
 * Chýbajúce časti sa vynechajú i s oddeľovačom.
 */
export function formatAddress(c: AddressParts & { address?: string } | null | undefined): string {
  if (!c) return ""
  const p = addressParts(c)
  const hasParts = [p.street, p.streetNumber, p.postalCode, p.city].some(v => v && v.trim())
  if (!hasParts) return (c.address ?? "").trim()
  const first = [p.street, p.streetNumber].filter(v => v && v.trim()).join(" ")
  const second = [p.postalCode, p.city].filter(v => v && v.trim()).join(" ")
  return [first, second].filter(Boolean).join(", ")
}

/**
 * PSČ v tvare „821 01". Prijme „82101" aj „821 01"; čokoľvek iné vráti
 * `null` (overenie hlási volajúci).
 */
export function normalizePostalCode(raw: string): string | null {
  const digits = raw.replace(/\s+/g, "")
  if (!/^\d{5}$/.test(digits)) return null
  return `${digits.slice(0, 3)} ${digits.slice(3)}`
}

/**
 * Rozloží jednoriadkovú adresu „Ulica číslo, PSČ Mesto" na časti — pre
 * migráciu a predvyplnenie formulára. Čo sa nedá rozpoznať, ostane celé
 * v `street`, aby sa nič nestratilo; človek to opraví vo formulári.
 */
export function parseAddress(line: string): AddressParts {
  const s = line.trim().replace(/\s+/g, " ")
  if (!s) return {}
  const m = s.match(/^(.+?)\s+(\d[\w/-]*)\s*,\s*(\d{3}\s?\d{2})\s+(.+)$/)
  if (m) {
    return { street: m[1], streetNumber: m[2], postalCode: normalizePostalCode(m[3]) ?? m[3], city: m[4] }
  }
  return { street: s }
}
