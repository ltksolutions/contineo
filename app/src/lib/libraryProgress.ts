/**
 * libraryProgress.ts — koľko ľudí platné znenie potvrdilo.
 *
 * Číslo do detailu dokumentu. Skladá sa z troch vecí, ktoré samé o sebe
 * existujú, ale nikto ich zatiaľ nespájal: **komu** je znenie pridelené
 * (`assignments`), **kto to sú** (`audienceMembers`) a **kto potvrdil**
 * (`acknowledgements`).
 *
 * ## Menovateľ sú pridelené osoby, nie celá organizácia
 *
 * Norma pridelená rozhodcom sa netýka zamestnancov ekonomiky, a keby boli
 * v menovateli, percento by nikdy nedosiahlo sto — takže by nič nehovorilo.
 * „68 % z pridelených" je veta, po ktorej sa dá niečo spraviť: dohnať tých
 * 32 %.
 *
 * ## Prečo len platné znenie
 *
 * Potvrdenie sa viaže na konkrétne znenie (D28) — pri novej verzii sa žiada
 * znova. Počítať potvrdenia cez všetky verzie by sčítalo ľudí, ktorí
 * potvrdili niečo, čo dnes už neplatí.
 *
 * Toto je **jeden dokument, nie riadok v zozname** — jeden dotaz navyše na
 * stránku. To isté číslo v stĺpci zoznamu je samostatná úloha (`docs/TODO.md`),
 * lebo tam by to bol dotaz na každý riadok.
 */

import { getCollection } from "./mongodb"
import { validAcknowledgements } from "./acknowledgements"
import {
  ASSIGNMENTS_COLLECTION, audienceMembers, matchesAudience, type Assignment,
} from "./assignments"
import { PERSONS_COLLECTION, type Person } from "./persons"

export interface DocumentProgress {
  /** Koľko osôb má znenie pridelené. `0` = nikomu, nie „nikto nepotvrdil". */
  assigned: number
  acknowledged: number
  /** Zaokrúhlené percento, alebo `null`, keď nie je z čoho počítať. */
  percent: number | null
  /** Koľko pridelení sa na znenie viaže — do vety „pridelené 3 publikám". */
  assignments: number
}

export const EMPTY_PROGRESS: DocumentProgress = {
  assigned: 0, acknowledged: 0, percent: null, assignments: 0,
}

/**
 * Percento bez delenia nulou.
 *
 * Zaokrúhľuje sa dole (`floor`): „100 %" má znamenať, že potvrdili **všetci**,
 * nie 199 z 200. Rozdiel jedného človeka je pri dôkaznom zázname dôvod, prečo
 * niekoho ešte treba osloviť.
 */
export function percentOf(acknowledged: number, assigned: number): number | null {
  if (assigned <= 0) return null
  return Math.floor((Math.min(acknowledged, assigned) / assigned) * 100)
}

export async function documentProgress(
  companyCode: string,
  versionId: string | undefined,
): Promise<DocumentProgress> {
  if (!versionId) return EMPTY_PROGRESS

  const col = await getCollection<Assignment>(ASSIGNMENTS_COLLECTION)
  const active = await col
    .find({ companyCode, "subject.versionId": versionId, revokedAt: null } as never)
    .toArray()
  if (active.length === 0) return EMPTY_PROGRESS

  /*
   * Publiká sa prekrývajú — ten istý človek môže byť v oddelení aj v skupine,
   * ktorým je znenie pridelené. Bez zjednotenia podľa `id` by sa v menovateli
   * počítal dvakrát a percento by bolo nižšie, než je pravda.
   */
  const ids = new Set<string>()
  for (const a of active) {
    for (const member of await audienceMembers(companyCode, a.audience)) ids.add(member.id)
  }
  const assigned = ids.size
  if (assigned === 0) {
    return { assigned: 0, acknowledged: 0, percent: null, assignments: active.length }
  }

  // Percento počíta len **platné** potvrdenia — odvolané už nesplnili nič.
  const acknowledged = (await validAcknowledgements({ versionId, personId: [...ids] })).length

  return { assigned, acknowledged, percent: percentOf(acknowledged, assigned), assignments: active.length }
}


/**
 * To isté číslo, ale pre **celú stranu zoznamu naraz**.
 *
 * `documentProgress()` vyššie je jeden dokument a pýta sa na publikum zvlášť;
 * v stĺpci zoznamu by to bol dotaz na každý riadok — presne to, kvôli čomu
 * tento stĺpec dovtedy neexistoval. Táto funkcia má preto **pevný počet
 * dotazov, nech je riadkov koľkokoľvek**:
 *
 *   1. platné pridelenia na dané znenia,
 *   2. osoby organizácie — **raz**, nie raz na každé publikum,
 *   3. potvrdenia k tým zneniam.
 *
 * Príslušnosť k publiku sa rozhoduje v pamäti `matchesAudience()`. Je to
 * čistá funkcia a je to **to isté pravidlo**, aké používa `audienceMembers()`;
 * druhá kópia pravidla tu by sa s ňou raz rozišla, a rozišla by sa vtedy, keď
 * sa mení pridelenie — teda keď na správnosti záleží.
 *
 * Znenia, ktoré nikomu pridelené nie sú, v mape **nie sú vôbec**. Je to
 * rozdiel oproti nule: „nikomu nepridelené" a „nikto nepotvrdil" sú dve
 * rôzne veci a zoznam ich nesmie nakresliť rovnako.
 */
export async function documentsProgress(
  companyCode: string,
  versionIds: string[],
): Promise<Map<string, DocumentProgress>> {
  const out = new Map<string, DocumentProgress>()
  const ids = [...new Set(versionIds.filter(Boolean))]
  if (ids.length === 0) return out

  const assignmentCol = await getCollection<Assignment>(ASSIGNMENTS_COLLECTION)
  const active = await assignmentCol
    .find({ companyCode, "subject.versionId": { $in: ids }, revokedAt: null } as never)
    .toArray()
  if (active.length === 0) return out

  const personCol = await getCollection<Person>(PERSONS_COLLECTION)
  const people = await personCol
    .find(
      { companyCode, status: { $ne: "inactive" } },
      { projection: { id: 1, email: 1, groups: 1, tracks: 1, departmentPath: 1 } },
    )
    .toArray()

  /*
   * Publiká sa prekrývajú — ten istý človek môže byť v oddelení aj v skupine,
   * ktorým je znenie pridelené. Preto množina, nie súčet: inak by sa
   * v menovateli počítal dvakrát a percento by bolo nižšie, než je pravda.
   */
  const assignedBy = new Map<string, Set<string>>()
  const assignmentCount = new Map<string, number>()
  for (const a of active) {
    const versionId = a.subject.versionId
    assignmentCount.set(versionId, (assignmentCount.get(versionId) ?? 0) + 1)
    const set = assignedBy.get(versionId) ?? new Set<string>()
    for (const person of people) if (matchesAudience(person, a.audience)) set.add(person.id)
    assignedBy.set(versionId, set)
  }

  // Len **platné** potvrdenia — odvolané už nesplnili nič (D24).
  const acknowledgedBy = new Map<string, Set<string>>()
  for (const record of await validAcknowledgements({ companyCode, versionId: ids })) {
    const set = acknowledgedBy.get(record.versionId) ?? new Set<string>()
    set.add(record.personId)
    acknowledgedBy.set(record.versionId, set)
  }

  for (const [versionId, assignedIds] of assignedBy) {
    const assigned = assignedIds.size
    /*
     * Potvrdenia sa prienikujú s pridelenými. Kto znenie potvrdil a medzitým
     * z publika vypadol, sa do čitateľa nepočíta — inak by percento mohlo
     * presiahnuť sto a stĺpec by prestal dávať zmysel.
     */
    const acknowledged = [...(acknowledgedBy.get(versionId) ?? [])]
      .filter(personId => assignedIds.has(personId)).length
    out.set(versionId, {
      assigned,
      acknowledged,
      percent: percentOf(acknowledged, assigned),
      assignments: assignmentCount.get(versionId) ?? 0,
    })
  }
  return out
}
