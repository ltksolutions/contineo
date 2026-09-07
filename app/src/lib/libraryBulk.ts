/**
 * libraryBulk.ts — hromadné akcie nad označenými dokumentmi.
 *
 * Čisté funkcie okolo dvoch vecí, ktoré sa dajú pokaziť ticho: kam sa odovzdá
 * výber a čo sa napíše, keď časť dávky neprejde.
 *
 * **Prideľovanie sa tu nerobí.** Obrazovka `/hr/assign` prideľuje N noriem
 * × M publík s jedným spoločným dôvodom, odmieta znenie bez platnosti (D6)
 * a dôvod má povinný (D30). Druhá kópia tých pravidiel v knižnici by sa raz
 * rozišla s prvou — pri tom druhu pridelenia, ktorý sa používa najmenej,
 * teda by sa to zistilo najneskôr. Knižnica preto výber len **odovzdá**.
 */

/** Odkaz na prideľovanie s predvybranými dokumentmi. */
export function assignHref(documentIds: string[], base = "/hr/assign"): string {
  const ids = [...new Set(documentIds.map(id => id.trim()).filter(Boolean))]
  if (ids.length === 0) return base
  const p = new URLSearchParams()
  // Opakovaný kľúč `document` — presne to, čo tá obrazovka už dnes číta
  // a zaškrtne.
  for (const id of ids) p.append("document", id)
  return `${base}?${p.toString()}`
}

export interface BulkOutcome {
  moved: string[]
  /** Dokumenty, ktoré neprešli, aj s dôvodom — bez neho sa nedá nič opraviť. */
  failed: { documentId: string; reason: string }[]
}

/**
 * Dávka sa spracúva **po dokumentoch**, nie ako celok.
 *
 * Zvyšok projektu mení kolekcie po zázname a transakcia naprieč dokumentmi by
 * sem zaviedla nástroj, ktorý sa nikde inde nepoužíva. Cena je, že dávka môže
 * skončiť čiastočne — a práve preto musí byť na konci vidieť, čo neprešlo
 * a prečo. Ticho presunúť 23 z 25 je horšie než nepresunúť nič.
 */
export function summarize(
  outcome: BulkOutcome,
  ok: (moved: number, total: number) => string,
  withFailures: (moved: number, total: number, failed: string) => string,
): string {
  const total = outcome.moved.length + outcome.failed.length
  if (outcome.failed.length === 0) return ok(outcome.moved.length, total)
  const list = outcome.failed.map(f => `${f.documentId} (${f.reason})`).join(", ")
  return withFailures(outcome.moved.length, total, list)
}
