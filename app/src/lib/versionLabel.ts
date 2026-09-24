/**
 * Označenie znenia sa neskladá ručne, ale z dátumu účinnosti (ADR-016, D113).
 *
 * Dovtedy ho písal človek pri zverejnení a v dátach tak vznikli „1.0" pri
 * deviatich normách alebo „Pracovný poriadok SFZ 20260907", ktoré opakovalo
 * názov. Označenie je doslova vo formulke potvrdenia (D28), takže má byť
 * zrozumiteľné a jednoznačné: „znenie účinné od 1. 1. 2027".
 *
 * Dve zverejnené znenia s tou istou účinnosťou (chybné nahradené opraveným
 * v ten istý deň) by mali rovnakú formulku — systém ich rozlíši
 * identifikátorom, človek nie. Preto druhé dostane „(2)", tretie „(3)".
 */

import { dictionary, formatDate, normalizeLanguage } from "./i18n"

export function autoVersionLabel(
  effectiveFrom: Date,
  /** Jazyk dokumentu — formulka je v jazyku predpisu, nie prostredia. */
  documentLanguage: string | null | undefined,
  /** Označenia, ktoré dokument už má. */
  existing: string[] = [],
): string {
  const language = normalizeLanguage(documentLanguage ?? undefined)
  const base = dictionary(language).library.flow.autoLabel(formatDate(effectiveFrom, language))
  const taken = new Set(existing.map(l => l.trim()))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} (${n})`)) n += 1
  return `${base} (${n})`
}
