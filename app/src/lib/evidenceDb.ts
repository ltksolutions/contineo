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

export interface EvidenceRow {
  duty: Duty
  firstOpenedAt: Date | null
  state: EvidenceState
  timeline: EvidenceEvent[]
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
  const rows = await duties(companyCode)

  // Otvorenie už nesie `Duty` (jeden join v `duties()`, kľúč osoba × znenie,
  // D28) — tu sa neskladá druhýkrát.
  return rows.map(duty => {
    const firstOpenedAt = duty.firstOpenedAt
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
    }
  })
}

/** Reťaz jednej osoby. Tá istá funkcia, len užší výber — nie druhý výpočet. */
export async function evidenceForPerson(
  companyCode: string,
  personId: string,
): Promise<EvidenceRow[]> {
  return (await evidenceRows(companyCode)).filter(r => r.duty.personId === personId)
}
