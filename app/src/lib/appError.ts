/**
 * appError.ts — chyby, ktoré uvidí človek.
 *
 * **Prečo kód a nie hotová veta.** Výnimka vzniká hlboko v `src/lib`, kde
 * o jazyku toho, kto sa pozerá, nikto nevie — a vedieť ani nemá: knižnica
 * neplní obrazovku, plní pravidlo. Nesie preto **kód**, ktorý je stabilný,
 * a veta sa skladá až na obrazovke, v jazyku prihláseného človeka.
 *
 * **Slovenská veta zostáva** v `message`. Dva dôvody: ide do logu, kde je
 * čitateľnejšia než kód, a je zálohou — keby kód v slovníku chýbal,
 * obrazovka ukáže vetu, nie prázdno ani `library.titleRequired`.
 *
 * Dosadzované hodnoty idú v `params`, nie v texte: veta „Súbor má 12 MB“ sa
 * v angličtine skladá inak než v slovenčine a vopred zložená sa už preložiť
 * nedá.
 */

/** Hodnoty, ktoré sa dosadia do textu na obrazovke. */
export type ErrorParams = Record<string, string | number>

export class AppError extends Error {
  /** Kľúč do `errors` v slovníku. Stabilný — na rozdiel od vety. */
  readonly code: string
  readonly params: ErrorParams

  constructor(code: string, message: string, params: ErrorParams = {}) {
    super(message)
    this.name = new.target.name
    this.code = code
    this.params = params
  }
}

/** Dôvod, prečo sa presun nedá spraviť — kód a hodnoty, nie veta. */
export interface Reason {
  code: string
  params?: ErrorParams
}
