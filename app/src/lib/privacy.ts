/**
 * Informovanie dotknutých osôb (čl. 13 GDPR) — C1, ADR-012.
 *
 * Text je v `dictionary().privacy`; tu je len to, čo sa doň dopĺňa z dát.
 * Kontakt na DPO sa **nepíše natvrdo**: berie sa z osôb s rolou `dpo`, takže
 * pri zmene DPO sa text opraví sám (`docs/C1_informovanie_dotknutych_osob.md`).
 */

import { getCollection } from "./mongodb"
import { PERSONS_COLLECTION, type Person } from "./persons"
import { DPO_ROLE } from "./dpo"

/**
 * Dátum verzie textu. **Pri každej zmene textu v `i18n.ts` sa posunie** —
 * je to dôkaz, ktorá verzia informovania bola zverejnená kedy.
 */
export const PRIVACY_NOTICE_VERSION = new Date("2026-09-24T00:00:00Z")

/** Kontakt na DPO organizácie — meno a adresa, nič viac. */
export async function dpoContacts(companyCode: string): Promise<{ fullName: string; email: string }[]> {
  const rows = await (await getCollection<Person>(PERSONS_COLLECTION))
    .find(
      { companyCode, roles: DPO_ROLE, status: { $ne: "inactive" } },
      { projection: { fullName: 1, email: 1 } },
    )
    .toArray()
  return rows.map(p => ({ fullName: p.fullName, email: p.email }))
}
