/**
 * readingTime.ts — koľko času človek strávil nad znením (kolekcia `reading_times`).
 *
 * **Prečo samostatná kolekcia, a nie `acknowledgements.readingSeconds`.**
 * Pôvodný zápis v TODO počítal s poľom v zázname o potvrdení. Nejde to,
 * a to z dvoch nezávislých dôvodov:
 *
 *  1. **Retencia.** Čas čítania sa uchováva rok (rozhodnutie 2026-09-06),
 *     potvrdenie musí prežiť. TTL v Mongo maže **celé dokumenty**, nie polia
 *     — pole s vlastnou retenciou sa v zázname, ktorý má prežiť, nedá zariadiť.
 *  2. **Nie je to dôkaz.** Čokoľvek, čo je v `acknowledgements`, sa raz ocitne
 *     vo výkaze pre právnika. Čas meraný na klientovi tam nemá čo hľadať:
 *     kto nechá kartu otvorenú, „číta" hodinu.
 *
 * **Čo sa vlastne meria.** Viditeľný čas — klient nepočíta, kým je karta na
 * pozadí. Aj tak je to len orientácia: dokazuje sa ním nič, ukazuje sa ním
 * niečo. Pri spolutvorcovi dokumentu bude krátky oprávnene, pri novom človeku
 * je to signál (O14).
 *
 * **Človek o tom vie.** Na obrazovke dokumentu vidí svoje číslo aj vetu, že je
 * informatívne a nie je súčasťou potvrdenia. Meranie, o ktorom sa dozvie až zo
 * zásad ochrany údajov, je presne to, čo pri audite robí problém.
 */

import { getCollection } from "./mongodb"

export const READING_COLLECTION = "reading_times"

/** Rok. Ďalej už čas čítania nepovie nič, čo by niekto použil. */
export const RETENTION_DAYS = 365

/**
 * Strop jedného záznamu: štyri hodiny.
 *
 * Nie je to obrana proti podvodu — proti tomu obrana neexistuje a ani sa
 * nehľadá, lebo údaj nemá následok. Je to obrana proti **nezmyslu**: karta
 * otvorená cez víkend by inak do prehľadu priniesla „čítal 62 hodín" a jedno
 * také číslo pokazí priemer celej trasy.
 */
export const MAX_SECONDS = 4 * 60 * 60

export interface ReadingTime {
  companyCode: string
  personId: string
  documentId: string
  versionId: string
  /** Viditeľný čas v sekundách. Vždy najvyššia doteraz videná hodnota. */
  seconds: number
  firstSeenAt: Date
  updatedAt: Date
}

/**
 * Zapíše čas čítania. Ukladá sa **maximum**, nie posledná hodnota.
 *
 * Klient posiela súhrn od otvorenia, nie prírastok. Pri druhom otvorení
 * dokumentu začne od nuly, a keby sa ukladala posledná hodnota, prepísala by
 * poctivo odčítaných dvadsať minút piatimi sekundami z náhodného návratu.
 *
 * Zlyhanie zápisu sa **nevracia volajúcemu ako chyba**. Je to meranie bez
 * následku; keby kvôli nemu spadlo potvrdenie, vymenili by sme údaj, na
 * ktorom nezáleží, za ten, na ktorom záleží.
 */
export async function recordReading(input: {
  companyCode: string
  personId: string
  documentId: string
  versionId: string
  seconds: number
}): Promise<void> {
  // Kontrola ide **pred** orezaním, nie po ňom. Opačné poradie vyzerá rovnako,
  // ale `Infinity` cez `Math.min()` prejde ako presne štyri hodiny — nezmysel
  // by sa tak zmenil na hodnovernú hodnotu.
  const raw = input.seconds
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return
  const seconds = Math.min(MAX_SECONDS, Math.floor(raw))

  const now = new Date()
  try {
    const col = await getCollection<ReadingTime>(READING_COLLECTION)
    await col.updateOne(
      { personId: input.personId, versionId: input.versionId },
      {
        $max: { seconds },
        $set: { updatedAt: now },
        $setOnInsert: {
          companyCode: input.companyCode,
          documentId: input.documentId,
          firstSeenAt: now,
        },
      },
      { upsert: true },
    )
  } catch (e) {
    console.error("[reading] čas čítania sa nepodarilo uložiť:", e)
  }
}

/** Čas, ktorý má osoba nad daným znením. `null`, keď sa ešte nič nezaznamenalo. */
export async function readingFor(personId: string, versionId: string): Promise<number | null> {
  const col = await getCollection<ReadingTime>(READING_COLLECTION)
  const found = await col.findOne({ personId, versionId })
  return found?.seconds ?? null
}

/** Časy osoby nad viacerými zneniami naraz — pre zoznam, nie po jednom. */
export async function readingTimes(
  personId: string,
  versionIds: string[],
): Promise<Map<string, number>> {
  if (versionIds.length === 0) return new Map()
  const col = await getCollection<ReadingTime>(READING_COLLECTION)
  const rows = await col
    .find({ personId, versionId: { $in: versionIds } }, { projection: { versionId: 1, seconds: 1 } })
    .toArray()
  return new Map(rows.map(r => [r.versionId, r.seconds]))
}
