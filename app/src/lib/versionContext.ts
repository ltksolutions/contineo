/**
 * versionContext.ts — ako sa znenie úseku a deň odpovede povedia modelu
 * (plán „znenia v indexe", krok 5).
 *
 * Text je pre model, nie pre človeka — preto je po slovensky ako celý
 * systémový prompt a nejde cez i18n. Človek vidí znenie v zozname zdrojov
 * v jazyku svojho prostredia (`answer.sourceVersion`).
 */

import { formatDate } from "./i18n"
import type { ChunkVersion } from "./mongoSearch"

/**
 * Časové pásmo, v ktorom sa určuje „deň otázky". Všetci tenanti sú dnes
 * v SR a ČR; keď pribudne iný, patrí to do profilu tenanta.
 */
export const SEARCH_TIME_ZONE = "Europe/Bratislava"

/**
 * Kalendárny deň okamihu v pásme, ako polnoc UTC — v tvare, v akom sú
 * uložené dátumy účinnosti a s akým počíta `formatDate()`. Bez toho by
 * otázka o 0:30 v Bratislave dostala v prompte včerajší deň.
 */
export function calendarDate(d: Date, timeZone = SEARCH_TIME_ZONE): Date {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
  return new Date(`${key}T00:00:00Z`)
}

const date = (d: Date | string | null | undefined): string | null => {
  if (!d) return null
  const x = d instanceof Date ? d : new Date(d)
  return Number.isNaN(x.getTime()) ? null : formatDate(x, "sk")
}

/**
 * „znenie 1.0 · účinné od 4. 6. 2016 do 1. 12. 2026". Koniec sa uvádza, len
 * keď je známy — typicky novela zverejnená vopred, od ktorej platí iný text.
 */
export function versionContext(v: ChunkVersion | undefined): string | undefined {
  if (!v) return undefined
  const from = date(v.effectiveFrom)
  const to = date(v.effectiveTo)
  const validity = from ? `účinné od ${from}${to ? ` do ${to}` : ""}` : to ? `účinné do ${to}` : ""
  return [v.label ? `znenie ${v.label}` : "", validity].filter(Boolean).join(" · ") || undefined
}

/**
 * Pokyn do systémového promptu: ku ktorému dňu model odpovedá a čo robiť so
 * znením, ktoré má známy koniec účinnosti.
 */
export function asOfInstruction(asOf: Date): string {
  const d = formatDate(calendarDate(asOf), "sk")
  return `Odpovedáš podľa znení predpisov platných ku dňu ${d}. Tento deň v odpovedi raz uveď (napríklad „Podľa znení platných k ${d} …").
Pri každom zdroji máš uvedené znenie a jeho účinnosť. Ak má zdroj uvedený koniec účinnosti („do …"), upozorni, že od toho dňa platí iné znenie. Inak účinnosť zdrojov nekomentuj a neodporúčaj overovať novšie znenie — zdroje sú znenia platné k tomuto dňu.`
}
