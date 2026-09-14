/**
 * directory.ts — interný adresár organizácie (D87).
 *
 * **Kto ho vidí:** každý prihlásený človek **vo vlastnej organizácii**. Nie je
 * to obrazovka personalistu: je to zoznam kolegov s pozíciou, pracoviskom
 * a kontaktom, a odopierať ho tomu, kto v tej organizácii pracuje, by znamenalo
 * mať adresár, do ktorého sa nedá pozrieť.
 *
 * **Čo v ňom nie je a prečo:**
 *
 * - **Vyradené osoby** (`status: "inactive"`). Sú v `persons` kvôli
 *   potvrdeniam, ktoré musia prežiť odchod človeka (O16), ale ako kontakt už
 *   neplatia — zavolať im by znamenalo volať niekomu, kto tam nepracuje.
 * - **Roly, trasy, skupiny, história prihlásení.** To je správa prístupu
 *   a patrí do `/people`. Adresár odpovedá na otázku „kto to je a ako sa mu
 *   ozvem", nie „čo smie".
 * - **Osoby inej organizácie.** `companyCode` je **v podmienke dotazu**, nie
 *   v kontrole nad ním (D32). Kontrola nad dotazom sa dá obísť zabudnutím;
 *   podmienka v dotaze nie.
 *
 * Mobilný telefón je tu nová kategória osobného údaja sprístupnená celej
 * organizácii — patrí do záznamu o spracovateľských činnostiach
 * (`docs/GDPR_DATA_PROTECTION.md`). Je nepovinný: kto ho nevyplní, v adresári
 * ho jednoducho nemá.
 */

import { getCollection } from "./mongodb"
import { PERSONS_COLLECTION } from "./persons"
import type { Person } from "./persons"

export interface DirectoryEntry {
  id: string
  fullName: string
  titleBefore?: string
  titleAfter?: string
  jobTitle?: string
  department?: string
  workplace?: string
  email: string
  mobilePhone?: string
  photoVersion?: string
}

function toEntry(p: Person): DirectoryEntry {
  return {
    id: p.id,
    fullName: p.fullName,
    titleBefore: p.titleBefore,
    titleAfter: p.titleAfter,
    jobTitle: p.jobTitle,
    department: p.department,
    workplace: p.workplace,
    email: p.email,
    mobilePhone: p.mobilePhone,
    photoVersion: p.photoVersion,
  }
}

/**
 * Ľudia organizácie ako adresár, voliteľne prefiltrovaní.
 *
 * Hľadá sa v mene, pozícii, oddelení, pracovisku aj adrese naraz — človek,
 * ktorý hľadá kolegu, nevie dopredu, či si pamätá meno alebo to, že „robí
 * niečo okolo ihrísk v Senci", a nemá sa to učiť.
 */
export async function listDirectory(
  companyCode: string,
  search?: string,
): Promise<DirectoryEntry[]> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const filter: Record<string, unknown> = { companyCode, status: { $ne: "inactive" } }

  const q = search?.trim()
  if (q) {
    // Escapovanie je nutné: `.` v adrese by inak bolo „ľubovoľný znak".
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const like = { $regex: safe, $options: "i" }
    filter.$or = [
      { fullName: like },
      { jobTitle: like },
      { department: like },
      { workplace: like },
      { email: like },
    ]
  }

  const people = await col.find(filter).sort({ surname: 1, fullName: 1 }).limit(1000).toArray()
  return people.map(toEntry)
}
