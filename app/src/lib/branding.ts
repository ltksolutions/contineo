/**
 * znacka.ts — logo organizácie ako nahratý súbor, nie odkaz.
 *
 * Dovtedy sa zadávala cesta k súboru v aplikácii (`/tenants/sfz.svg`). To
 * znamenalo, že logo nového zákazníka musel nahrať vývojár do repozitára
 * a nasadiť — teda že si organizácia nevie zmeniť vlastné logo bez nás.
 *
 * **Kde je uložené:** v databáze, vo vlastnej kolekcii, nie v zázname tenanta.
 * Záznam tenanta sa číta pri **každej požiadavke** (`resolveTenant`) a nosiť
 * v ňom desiatky kilobajtov obrázka by znamenalo platiť ich pri každom
 * načítaní stránky. Servíruje sa vlastnou cestou s dlhou pamäťou, takže
 * prehliadač si ho vypýta raz.
 *
 * **Prečo nie data URI priamo v HTML:** to isté, len horšie — obrázok by bol
 * v každej stránke znova a nedal by sa uložiť do pamäte prehliadača.
 *
 * **Prečo nie externé úložisko:** ďalšia služba, ďalší token, ďalšia vec,
 * ktorá môže vypadnúť. Logá sú malé a je ich toľko, koľko zákazníkov.
 */

import { getCollection } from "./mongodb"

export const ZNACKY_COLLECTION = "tenant_assets"

/** Väčšie logo nemá dôvod existovať — v hlavičke má 26 px. */
export const MAX_BAJTOV = 256 * 1024

/**
 * Povolené typy. SVG **zámerne nie je**: je to spustiteľný dokument, môže
 * obsahovať skript, a servírovať ho z našej domény by znamenalo pustiť cudzí
 * kód na doménu, na ktorej sa potvrdzujú smernice. Kto má logo v SVG, nech
 * ho vyexportuje do PNG — stratí sa ostrosť pri zväčšení, nie bezpečnosť.
 */
export const POVOLENE_TYPY = ["image/png", "image/jpeg", "image/webp"] as const

export interface Znacka {
  companyCode: string
  contentType: string
  /** Samotný obrázok. Malý a čítaný zriedka, takže priamo v zázname. */
  data: Buffer
  bajtov: number
  /** Mení sa pri každom nahratí — je súčasťou adresy, takže vynúti obnovu. */
  verzia: string
  updatedAt: Date
  updatedBy: string
}

export class ZnackaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ZnackaError"
  }
}

/** Skontroluje, čo prišlo z formulára. Vracia dôvod, nie `false`. */
export function skontrolujSubor(typ: string, bajtov: number): void {
  if (!(POVOLENE_TYPY as readonly string[]).includes(typ)) {
    throw new ZnackaError(
      `Nepodporovaný formát (${typ || "neznámy"}). Použi PNG, JPEG alebo WebP. ` +
      "SVG zámerne nie — môže obsahovať skript a servírovali by sme cudzí kód z vlastnej domény."
    )
  }
  if (bajtov <= 0) throw new ZnackaError("Súbor je prázdny.")
  if (bajtov > MAX_BAJTOV) {
    throw new ZnackaError(
      `Súbor má ${Math.round(bajtov / 1024)} kB, najviac je ${MAX_BAJTOV / 1024} kB. ` +
      "V hlavičke má logo 26 px — väčší súbor nič nepridá."
    )
  }
}

/** Uloží logo a vráti cestu, ktorou sa servíruje. */
export async function ulozZnacku(
  companyCode: string,
  typ: string,
  data: Buffer,
  actor: string,
): Promise<string> {
  skontrolujSubor(typ, data.byteLength)

  const verzia = Date.now().toString(36)
  const col = await getCollection<Znacka>(ZNACKY_COLLECTION)
  await col.updateOne(
    { companyCode },
    {
      $set: {
        companyCode,
        contentType: typ,
        data,
        bajtov: data.byteLength,
        verzia,
        updatedAt: new Date(),
        updatedBy: actor,
      },
    },
    { upsert: true },
  )
  return cestaZnacky(companyCode, verzia)
}

/**
 * Adresa, ktorou sa logo servíruje.
 *
 * Verzia je v adrese, nie v hlavičkách: pamäť sa tým dá nastaviť na rok
 * a nové logo sa aj tak ukáže okamžite, lebo má inú adresu. Opačne (krátka
 * pamäť, rovnaká adresa) by sa obrázok sťahoval znova a znova pre nič.
 */
export function cestaZnacky(companyCode: string, verzia: string): string {
  return `/api/znacka/${encodeURIComponent(companyCode.toLowerCase())}?v=${verzia}`
}

export async function nacitajZnacku(companyCode: string): Promise<Znacka | null> {
  const col = await getCollection<Znacka>(ZNACKY_COLLECTION)
  return col.findOne({ companyCode: companyCode.toUpperCase() })
}

export async function zmazZnacku(companyCode: string): Promise<void> {
  const col = await getCollection<Znacka>(ZNACKY_COLLECTION)
  await col.deleteOne({ companyCode })
}
