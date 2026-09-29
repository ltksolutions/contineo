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
import { isAutoVersionLabel } from "./versionLabel"

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
  // Automatické označenie („znenie účinné od …") dátum už nesie — neopakovať ho.
  if (isAutoVersionLabel(v.label, v.effectiveFrom)) return validity ? `znenie ${validity}` : undefined
  return [v.label ? `znenie ${v.label}` : "", validity].filter(Boolean).join(" · ") || undefined
}

/**
 * Pokyn do systémového promptu: ku ktorému dňu model odpovedá a čo robiť so
 * znením, ktoré má známy koniec účinnosti.
 */
export function asOfInstruction(asOf: Date, now: Date = new Date()): string {
  const d = formatDate(calendarDate(asOf), "sk")
  // Dnešok zvlášť: pri otázke do minulosti model písal o zmene, ktorá už
  // nastala, v budúcom čase („od 1. 7. 2026 bude platiť…", krok 8).
  const today = formatDate(calendarDate(now), "sk")
  return `Odpovedáš podľa znení predpisov platných ku dňu ${d}. Tento deň v odpovedi raz uveď (napríklad „Podľa znení platných k ${d} …").
Pri každom zdroji máš uvedené znenie a jeho účinnosť. Ak má zdroj uvedený koniec účinnosti („do …"), upozorni, že od toho dňa platí iné znenie. Dnes je ${today}: o dni pred dneškom hovor v minulom čase, o dnešku a neskoršom v prítomnom alebo budúcom. Inak účinnosť zdrojov nekomentuj a neodporúčaj overovať novšie znenie — zdroje sú znenia platné k tomuto dňu.`
}

/** Čo o porovnaní potrebuje pokyn modelu (krok 7). */
export interface ComparisonBrief {
  title: string
  from: ChunkVersion
  to: ChunkVersion
  changes: Array<{ ref: string; heading: string; kind: "changed" | "added" | "removed" }>
  /** Články, ktoré model dostal podrobne (staré aj nové znenie). */
  detailRefs: string[]
}

const KIND_WORD = { changed: "zmenený", added: "pridaný", removed: "zrušený" } as const

/**
 * Pokyn pri otázke „čo sa zmenilo". Prehľad všetkých zmien ide sem, nie ako
 * zdroj: je to súpis, nie text predpisu, a v zozname zdrojov by sa tváril
 * ako článok. Podrobne dostane model len vybrané články (najviac 8).
 */
export function compareInstruction(c: ComparisonBrief): string {
  const label = (v: ChunkVersion) => versionContext(v) ?? "znenie bez označenia"
  const detail = new Set(c.detailRefs)
  const list = c.changes
    .map(ch => `- ${ch.ref}${ch.heading ? ` (${ch.heading})` : ""}: ${KIND_WORD[ch.kind]}${detail.has(ch.ref) ? "" : " — len v prehľade"}`)
    .join("\n")
  return `Otázka sa pýta, čo sa zmenilo v dokumente „${c.title}". Porovnávaš dve znenia:
- staršie: ${label(c.from)}
- novšie: ${label(c.to)}
Pri každom zdroji je uvedené, ku ktorému zneniu patrí. Povedz, čo sa medzi nimi zmenilo, a pri každej zmene cituj staré aj nové znenie. Neuvádzaj zmeny, ktoré v zdrojoch nie sú. Články označené „len v prehľade" spomeň iba menovite — ich text nemáš.
Prehľad všetkých zmien (${c.changes.length}):
${list}`
}
