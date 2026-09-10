/**
 * documentOpens.ts — kedy si osoba znenie **prvýkrát otvorila** (ADR-005, D64).
 *
 * **Je to fakt so serverovým časom, nie telemetria.** Rozdiel je vecný a stojí
 * na troch vlastnostiach:
 *
 * 1. **Zapisuje server, nie klient.** Beacon sa dá zablokovať a stratiť;
 *    server vie, že obsah odoslal. Nevie, že ho človek čítal — preto sa to
 *    volá „otvoril", nie „prečítal".
 * 2. **Zapíše sa raz a nikdy sa neprepíše** (`$setOnInsert`). Nie je to
 *    záznam o každom zobrazení, je to jeden riadok na dvojicu osoba × znenie
 *    za celý jej život.
 * 3. **Len tomu, kto má povinnosť.** Personalista, ktorý si znenie otvorí na
 *    kontrolu, sa nezapisuje. Je to minimalizácia údajov (O14) a zároveň
 *    presne to, čo reťaz potrebuje.
 *
 * Oddelené od `reading_times` zámerne: čas čítania je meranie na klientovi
 * s ročnou retenciou a **výslovne nie je dôkaz**. Postaviť reťaz nad ním by
 * znamenalo, že je úplná dvanásť mesiacov a potom jej ticho zmiznú riadky —
 * a diera v zázname vyzerá horšie než záznam, ktorý ju nikdy nemal.
 */

import { getCollection } from "./mongodb"

export const DOCUMENT_OPENS_COLLECTION = "document_opens"

export interface DocumentOpen {
  companyCode: string
  personId: string
  documentId: string
  /** Otvorenie sa viaže na **znenie**, nie na dokument (D28). */
  versionId: string
  firstOpenedAt: Date
}

/**
 * Zaznamená prvé otvorenie. Druhé a ďalšie otvorenie nezmení nič.
 *
 * **Nikdy nevyhadzuje.** Keď zápis zlyhá, stránka sa musí zobraziť aj tak:
 * meranie nesmie brániť plneniu povinnosti. Chýbajúci riadok je zlý stav,
 * nezobrazené znenie je horší.
 */
export async function recordOpen(input: {
  companyCode: string
  personId: string
  documentId: string
  versionId: string
}): Promise<void> {
  try {
    const col = await getCollection<DocumentOpen>(DOCUMENT_OPENS_COLLECTION)
    await col.updateOne(
      {
        companyCode: input.companyCode,
        personId: input.personId,
        versionId: input.versionId,
      },
      {
        // `$setOnInsert` na všetko: pri druhom otvorení sa nezmení ani čas,
        // ani nič iné. Keby sa čas prepisoval, „prvýkrát otvoril" by bolo
        // v skutočnosti „naposledy otvoril" a nikto by si to nevšimol.
        $setOnInsert: {
          companyCode: input.companyCode,
          personId: input.personId,
          documentId: input.documentId,
          versionId: input.versionId,
          firstOpenedAt: new Date(),
        },
      },
      { upsert: true },
    )
  } catch (e) {
    console.error("[otvorenia] zápis zlyhal, stránka sa zobrazí aj tak:", e)
  }
}

/** Otvorenia jednej osoby. Pre časovú os na karte osoby. */
export async function opensForPerson(
  companyCode: string,
  personId: string,
): Promise<DocumentOpen[]> {
  const col = await getCollection<DocumentOpen>(DOCUMENT_OPENS_COLLECTION)
  return col.find({ companyCode, personId }).sort({ firstOpenedAt: 1 }).toArray()
}

/** Otvorenia celej organizácie. Pre obrazovku `/hr/evidence`. */
export async function opensFor(companyCode: string): Promise<DocumentOpen[]> {
  const col = await getCollection<DocumentOpen>(DOCUMENT_OPENS_COLLECTION)
  return col.find({ companyCode }).sort({ firstOpenedAt: 1 }).toArray()
}
