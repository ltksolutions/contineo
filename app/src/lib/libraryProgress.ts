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
import { ACKNOWLEDGEMENTS_COLLECTION } from "./acknowledgements"
import { ASSIGNMENTS_COLLECTION, audienceMembers, type Assignment } from "./assignments"

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

  const ackCol = await getCollection(ACKNOWLEDGEMENTS_COLLECTION)
  const acknowledged = await ackCol.countDocuments({
    type: "acknowledgement",
    versionId,
    personId: { $in: [...ids] },
  })

  return { assigned, acknowledged, percent: percentOf(acknowledged, assigned), assignments: active.length }
}
