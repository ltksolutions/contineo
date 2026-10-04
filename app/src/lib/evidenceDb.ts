/**
 * evidenceDb.ts — načítanie reťaze dôkazov (ADR-005).
 *
 * Pravidlá sú vedľa v `evidence.ts` a sú bez databázy. Tento súbor len
 * pozbiera, čo je kde, a poskladá vstup — rovnaké delenie ako `due.ts`
 * verzus `assignments.ts`.
 *
 * **Nič nového neukladá.** Os je pohľad (D65): berie povinnosti z toho istého
 * zdroja ako HR výkaz (`duties()`), otvorenia z `document_opens` a čas čítania,
 * ktorý už `duties()` prikladá. Druhý výpočet toho istého by sa raz rozišiel
 * s prvým — a pri dôkaze je to horšie než nemať druhý pohľad vôbec.
 */

import { duties, type Duty } from "./hrReport"
import { evidenceTimeline, evidenceState, type EvidenceEvent, type EvidenceState } from "./evidence"
import {
  evidenceRecords, type EvidenceAcknowledgement, type EvidenceRevocation,
} from "./acknowledgements"

export interface EvidenceRow {
  duty: Duty
  firstOpenedAt: Date | null
  state: EvidenceState
  timeline: EvidenceEvent[]
  /**
   * Odtlačok posledného potvrdenia (IP, oddelenie, formulka) a platné
   * odvolanie — to, čo kontrolór číta po rozbalení (HR.md, úloha 5).
   * `revocation` nie je `null` práve vtedy, keď je povinnosť odvolaná:
   * výkaz ju vtedy vidí ako nepotvrdenú, pilulka má povedať „odvolané".
   */
  acknowledgement: EvidenceAcknowledgement | null
  revocation: EvidenceRevocation | null
}

/**
 * Reťaz pre celú organizáciu (D32 — nikdy naprieč tenantmi).
 *
 * Upozornenia sa do osi **zatiaľ nedávajú** a je to vedomé. `reminder_log` je
 * prevádzkový záznam s deväťdesiatdňovou retenciou a `assignments.notified[]`
 * hovorí „ozvalo sa N ľuďom", nie ktorým — ani jedno neunesie vetu „ozvalo sa
 * **jej**". Vymyslieť ju z toho, čo máme, by bolo presne to, čomu sa celé
 * ADR-005 vyhýba.
 */
export async function evidenceRows(companyCode: string): Promise<EvidenceRow[]> {
  const [rows, records] = await Promise.all([duties(companyCode), evidenceRecords(companyCode)])

  // Otvorenie už nesie `Duty` (jeden join v `duties()`, kľúč osoba × znenie,
  // D28) — tu sa neskladá druhýkrát.
  const out = rows.map(duty => {
    const firstOpenedAt = duty.firstOpenedAt
    const rec = records.get(`${duty.personId}|${duty.versionId}`)
    const input = {
      assignedAt: duty.since,
      firstOpenedAt,
      readingSeconds: duty.readingSeconds,
      acknowledgedAt: duty.acknowledgedAt,
    }
    return {
      duty,
      firstOpenedAt,
      state: evidenceState(input),
      timeline: evidenceTimeline(input),
      acknowledgement: rec?.acknowledgement ?? null,
      revocation: rec?.revocation ?? null,
    }
  })
  return out.sort(byNewest)
}

/**
 * Dátum v stĺpci „Dátum": kedy odvolané, inak kedy potvrdil, inak kedy
 * otvoril. `null` = ešte sa nič nestalo (neotvorené).
 */
export function evidenceDate(r: Pick<EvidenceRow, "duty" | "firstOpenedAt" | "revocation">): Date | null {
  return r.revocation?.revokedAt ?? r.duty.acknowledgedAt ?? r.firstOpenedAt ?? null
}

/**
 * Najnovšie navrchu (rozhodnutie Jána 4. 10. 2026) — podľa dátumu, ktorý
 * riadok ukazuje. Riadky bez dátumu (neotvorené) idú za ne, medzi sebou
 * podľa pridelenia, tiež najnovšie navrchu.
 */
export function byNewest(
  a: Pick<EvidenceRow, "duty" | "firstOpenedAt" | "revocation">,
  b: Pick<EvidenceRow, "duty" | "firstOpenedAt" | "revocation">,
): number {
  const da = evidenceDate(a)
  const db = evidenceDate(b)
  if (da && db) return db.getTime() - da.getTime()
  if (da) return -1
  if (db) return 1
  return (b.duty.since?.getTime() ?? 0) - (a.duty.since?.getTime() ?? 0)
}

/** Reťaz jednej osoby. Tá istá funkcia, len užší výber — nie druhý výpočet. */
export async function evidenceForPerson(
  companyCode: string,
  personId: string,
): Promise<EvidenceRow[]> {
  return (await evidenceRows(companyCode)).filter(r => r.duty.personId === personId)
}
