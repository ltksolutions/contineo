/**
 * dueText.ts — text termínového chipu (D63) na jednom mieste.
 *
 * Chip po termíne hovorí **„po termíne o N dní"**, nie „do 11. 10. 2026":
 * červené „do …" s dátumom v minulosti sa čítalo ako termín, ktorý ešte len
 * príde (Ján 26. 10. 2026). Farbu dáva `dueState()`, slová táto funkcia —
 * Prehľad, zoznam na potvrdenie aj detail dokumentu tak nemôžu hovoriť inak.
 */

import { daysLeft, dueState } from "./due"
import { dictionary, formatDate, type UiLanguage } from "./i18n"

export function dueText(due: Date, now: Date, language?: UiLanguage): string {
  const d = dictionary(language)
  if (dueState(due, now) === "over") return d.pending.dueOver(-daysLeft(due, now))
  return d.overview.by(formatDate(due, language))
}
