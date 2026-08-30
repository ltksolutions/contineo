/**
 * fotka.ts — fotografia osoby ako uložený súbor, nie odkaz.
 *
 * Rovnaký vzor a rovnaké dôvody ako `znacka.ts`: vo **vlastnej kolekcii**, nie
 * v zázname osoby. Záznam osoby sa číta pri každej požiadavke
 * (`currentPerson()`) a nosiť v ňom desiatky kilobajtov obrázka by znamenalo
 * platiť ich pri každom načítaní stránky.
 *
 * **Na rozdiel od loga je fotka neverejná.** Logo visí na prihlasovacej
 * stránke a prezradí len to, že organizácia tu má portál. Fotka je osobný
 * údaj zamestnanca; jej cesta preto vyžaduje prihlásenie a zhodu organizácie.
 */

import { getCollection } from "./mongodb"

export const PHOTOS_COLLECTION = "person_photos"

/** Fotka z Graphu má 96 px. Väčšia sem nemá ako prísť. */
export const MAX_BYTES = 512 * 1024

export interface Photo {
  companyCode: string
  /** `persons.id`, nie adresa — adresa sa mení, identita nie (D45). */
  personId: string
  contentType: string
  data: Buffer
  bajtov: number
  /** Súčasť adresy, takže nová fotka sa ukáže okamžite napriek dlhej pamäti. */
  verzia: string
  updatedAt: Date
  zdroj: string
}

/** Uloží fotku. Vracia verziu do `persons.photoVersion`. */
export async function savePhoto(
  companyCode: string,
  personId: string,
  contentType: string,
  data: Buffer,
  source: string,
): Promise<string | null> {
  if (!data?.byteLength || data.byteLength > MAX_BYTES) return null
  const version = Date.now().toString(36)
  try {
    const col = await getCollection<Photo>(PHOTOS_COLLECTION)
    await col.updateOne(
      { companyCode, personId },
      {
        $set: {
          companyCode, personId, contentType, data,
          bajtov: data.byteLength, verzia: version, updatedAt: new Date(), zdroj: source,
        },
      },
      { upsert: true },
    )
    return version
  } catch (e) {
    // Fotka je bonus. Jej zlyhanie nesmie zhodiť to, čo ju vyvolalo.
    console.error("[fotka] uloženie zlyhalo:", e)
    return null
  }
}

export async function loadPhoto(companyCode: string, personId: string): Promise<Photo | null> {
  const col = await getCollection<Photo>(PHOTOS_COLLECTION)
  return col.findOne({ companyCode, personId })
}
