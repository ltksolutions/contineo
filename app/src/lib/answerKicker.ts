/**
 * answerKicker.ts — hlavička karty odpovede podľa zdrojov (Ján 8. 10. 2026).
 *
 * Hlavička hovorí, odkiaľ odpoveď je. Keď je okrem knižnice zapnutý aj živý
 * zdroj (ADR-029) alebo len on, „Odpoveď z dokumentov SFZ" by klamala.
 *
 * Na `/ask` rozhodujú zapnuté pilulky. Uložená odpoveď výber nepozná — tam
 * sa zdroje odvodia z toho, čo v nej naozaj je (D27): živé podľa
 * `source.live`, knižnica, keď je aspoň jeden zdroj z nej alebo žiadny živý.
 */

import { dictionary, type UiLanguage } from "./i18n"
import type { AnswerSource } from "./sseClient"

export interface KickerScope {
  /** Hľadalo sa v knižnici organizácie. */
  library: boolean
  /** Názvy živých zdrojov, v ktorých sa hľadalo. */
  live: string[]
}

/** Zdroje z obsahu odpovede — pre uloženú odpoveď bez výberu piluliek. */
export function scopeFromSources(sources: AnswerSource[]): KickerScope {
  const live = [...new Set(sources.map(s => s.live?.connectorName).filter((n): n is string => Boolean(n)))]
  return { library: live.length === 0 || sources.some(s => !s.live), live }
}

/**
 * „A, B a C" — vlastné spájanie, nie `Intl.ListFormat`: ten vkladá
 * nedeliteľné medzery podľa verzie ICU a server s prehliadačom by mohli
 * vykresliť iný text (nesúlad pri hydratácii).
 */
function joinNames(names: string[], language: UiLanguage): string {
  if (names.length < 2) return names.join("")
  const and = language === "en" ? " and " : " a "
  return `${names.slice(0, -1).join(", ")}${and}${names[names.length - 1]}`
}

export function answerKicker(scope: KickerScope, organisation: string | undefined, language: UiLanguage | undefined): string {
  const lang: UiLanguage = language ?? "sk"
  const tAsk = dictionary(lang).ask
  const tAnswer = dictionary(lang).answer
  const live = scope.live.filter(Boolean)
  if (live.length === 0) return organisation ? tAsk.answerKicker(organisation) : tAnswer.fromDocuments
  const names = joinNames(live, lang)
  if (!scope.library) return tAsk.answerKickerLive(names, live.length)
  return tAsk.answerKickerBoth(organisation ?? "", names, live.length)
}
