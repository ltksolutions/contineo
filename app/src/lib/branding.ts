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

export const BRANDING_COLLECTION = "tenant_assets"

/** Väčšie logo nemá dôvod existovať — v hlavičke má 26 px. */
export const MAX_BYTES = 256 * 1024

/**
 * Povolené typy. SVG **zámerne nie je**: je to spustiteľný dokument, môže
 * obsahovať skript, a servírovať ho z našej domény by znamenalo pustiť cudzí
 * kód na doménu, na ktorej sa potvrdzujú smernice. Kto má logo v SVG, nech
 * ho vyexportuje do PNG — stratí sa ostrosť pri zväčšení, nie bezpečnosť.
 */
export const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const

export interface Brand {
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

export class BrandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ZnackaError"
  }
}

/** Skontroluje, čo prišlo z formulára. Vracia dôvod, nie `false`. */
export function checkFile(typ: string, bajtov: number): void {
  if (!(ALLOWED_TYPES as readonly string[]).includes(typ)) {
    throw new BrandError(
      `Nepodporovaný formát (${typ || "neznámy"}). Použi PNG, JPEG alebo WebP. ` +
      "SVG zámerne nie — môže obsahovať skript a servírovali by sme cudzí kód z vlastnej domény."
    )
  }
  if (bajtov <= 0) throw new BrandError("Súbor je prázdny.")
  if (bajtov > MAX_BYTES) {
    throw new BrandError(
      `Súbor má ${Math.round(bajtov / 1024)} kB, najviac je ${MAX_BYTES / 1024} kB. ` +
      "V hlavičke má logo 26 px — väčší súbor nič nepridá."
    )
  }
}

/** Uloží logo a vráti cestu, ktorou sa servíruje. */
export async function saveBrand(
  companyCode: string,
  typ: string,
  data: Buffer,
  actor: string,
): Promise<string> {
  checkFile(typ, data.byteLength)

  const verzia = Date.now().toString(36)
  const col = await getCollection<Brand>(BRANDING_COLLECTION)
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
  return brandPath(companyCode, verzia)
}

/**
 * Adresa, ktorou sa logo servíruje.
 *
 * Verzia je v adrese, nie v hlavičkách: pamäť sa tým dá nastaviť na rok
 * a nové logo sa aj tak ukáže okamžite, lebo má inú adresu. Opačne (krátka
 * pamäť, rovnaká adresa) by sa obrázok sťahoval znova a znova pre nič.
 */
export function brandPath(companyCode: string, verzia: string): string {
  return `/api/znacka/${encodeURIComponent(companyCode.toLowerCase())}?v=${verzia}`
}

export async function loadBrand(companyCode: string): Promise<Brand | null> {
  const col = await getCollection<Brand>(BRANDING_COLLECTION)
  return col.findOne({ companyCode: companyCode.toUpperCase() })
}

export async function deleteBrand(companyCode: string): Promise<void> {
  const col = await getCollection<Brand>(BRANDING_COLLECTION)
  await col.deleteOne({ companyCode })
}
