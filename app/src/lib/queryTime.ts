/**
 * queryTime.ts — ku ktorému dňu sa otázka pýta (plán „znenia v indexe",
 * krok 6; `docs/TODO.md`).
 *
 * Tri druhy otázky:
 *   - `today`   — bez časového údaja; odpovedá sa podľa dnes platných znení,
 *   - `asOf`    — „k 1. 1. 2020", „v roku 2019", „vlani": podľa znení
 *                 platných v ten deň (aj budúci — novela zverejnená vopred),
 *   - `compare` — „čo sa zmenilo": porovnanie znení (krok 7); dovtedy dnešok.
 *
 * **Pravidlá bežia pri každej otázke.** Prepis otázky modelom
 * (`preprocessQuery`) sa pri krátkych a fulltextových otázkach nespúšťa,
 * takže „Trest za 3 ŽK k 1. 1. 2020?" by bez pravidiel dátum nikdy nevidel.
 * Model je záloha pre formulácie, ktoré pravidlá nepokryjú; keď pravidlá
 * našli dátum, majú prednosť — sú deterministické.
 */

import { calendarDate } from "./versionContext"

export type QueryTimeKind = "today" | "asOf" | "compare"

export interface QueryTime {
  kind: QueryTimeKind
  /** Deň odpovede `YYYY-MM-DD` (pri `today` a `compare` dnešok v Bratislave). */
  asOf: string
  /** Kto deň určil — pre ladenie a hodnotenia. */
  source: "rules" | "model" | "default"
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Dnešok ako výsledok — predvolený, keď otázka čas nemá. */
export function todayTime(now: Date = new Date()): QueryTime {
  return { kind: "today", asOf: iso(calendarDate(now)), source: "default" }
}

/** Bez diakritiky a malými — „Júla" aj „jula" je ten istý mesiac. */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/**
 * Mesiace v sk, cs a en — **celé tvary**, nie začiatky slov: „majú" nie je
 * máj a „junior" nie je jún. Bez diakritiky (`fold`).
 */
const MONTH_WORDS: Record<string, number> = Object.fromEntries(([
  [1, "januar januara leden ledna january jan"],
  [2, "februar februara unor unora february feb"],
  [3, "marec marca brezen brezna march mar"],
  [4, "april aprila duben dubna apr"],
  [5, "maj maja kveten kvetna may"],
  [6, "jun juna cerven cervna june"],
  [7, "jul jula cervenec cervence july"],
  [8, "august augusta srpen srpna aug"],
  [9, "september septembra zari sep sept"],
  [10, "oktober oktobra rijen rijna october oct"],
  [11, "november novembra listopad listopadu nov"],
  [12, "december decembra prosinec prosince dec"],
] as Array<[number, string]>).flatMap(([n, words]) => words.split(" ").map(w => [w, n])))

const monthOf = (word: string): number | null => MONTH_WORDS[fold(word).replace(/\.$/, "")] ?? null

function validDate(y: number, m: number, d: number): Date | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const x = new Date(Date.UTC(y, m - 1, d))
  return x.getUTCMonth() === m - 1 && x.getUTCDate() === d ? x : null
}

/** Presný dátum v otázke: „1. 1. 2020", „1.7.2026", „2026-07-01", „1. júla 2026", „July 1, 2026". */
function explicitDate(q: string): Date | null {
  let m = q.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (m) return validDate(+m[1], +m[2], +m[3])
  m = q.match(/(?<![\d§])(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\b/)
  if (m) return validDate(+m[3], +m[2], +m[1])
  m = q.match(/(?<![\d§])(\d{1,2})\.?\s+([\p{L}]{3,})\s+(\d{4})\b/u)
  if (m) {
    const month = monthOf(m[2])
    if (month) return validDate(+m[3], month, +m[1])
  }
  m = q.match(/\b([\p{L}]{3,})\s+(\d{1,2}),?\s+(\d{4})\b/u)
  if (m) {
    const month = monthOf(m[1])
    if (month) return validDate(+m[3], month, +m[2])
  }
  return null
}

/**
 * Rok s predložkou: „v roku 2019", „v r. 2019", „v roce 2019", „in 2019".
 * Holý letopočet dátumom nie je — „Smernica 2026" je názov, nie otázka na rok.
 * Deň je **31. 12.** (rozhodol Ján): stav na konci roka; štítok nad
 * odpoveďou ukáže presný deň, takže je vidno, čo sa zvolilo.
 */
function yearReference(folded: string): number | null {
  const m = folded.match(/\b(?:v\s+roku|vo\s+roku|v\s+r\.|v\s+roce|roku|in(?:\s+the\s+year)?|during)\s+((?:19|20)\d{2})\b/)
  return m ? +m[1] : null
}

const COMPARE = [
  /\bco\s+sa\s+(?:zmenilo|zmeni|menilo)\b/, /\bco\s+se\s+(?:zmenilo|zmeni|menilo)\b/,
  /\bwhat\s+(?:has\s+|will\s+|is\s+going\s+to\s+)?chang/, /\bwhat'?s\s+changed\b/,
  /\brozdiel\s+medzi\b/, /\brozdil\s+mezi\b/, /\bdifference\s+between\b/,
  /\bporovna(?:j|t|nie)\b/, /\bporovne(?:j|jte)?\b/, /\bporovnat\b/, /\bcompare\b/,
  /\boproti\s+(?:predchadzajuc|predoslem|staremu|povodnem|predchoz|puvodnim)/,
]

/**
 * Čas otázky podľa pravidiel. Vráti `today`, keď nič nenašli — rozhodnutie,
 * či to doplní model, je na `resolveQueryTime()`.
 */
export function detectQueryTime(query: string, now: Date = new Date()): QueryTime {
  const today = calendarDate(now)
  const folded = fold(query)

  if (COMPARE.some(re => re.test(folded))) return { kind: "compare", asOf: iso(today), source: "rules" }

  const exact = explicitDate(query)
  if (exact) return asOfOrToday(exact, today, "rules")

  const year = yearReference(folded)
  if (year) return asOfOrToday(new Date(Date.UTC(year, 11, 31)), today, "rules")

  if (/\b(?:vlani|loni|minuly\s+rok|minuleho\s+roka|minulom\s+roku|last\s+year)\b/.test(folded)) {
    return asOfOrToday(new Date(Date.UTC(today.getUTCFullYear() - 1, 11, 31)), today, "rules")
  }
  if (/\b(?:pred\s+rokom|pred\s+rokem|a\s+year\s+ago)\b/.test(folded)) {
    return asOfOrToday(new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate())), today, "rules")
  }

  return todayTime(now)
}

function asOfOrToday(d: Date, today: Date, source: QueryTime["source"]): QueryTime {
  return { kind: d.getTime() === today.getTime() ? "today" : "asOf", asOf: iso(d), source }
}

/**
 * Otázka bez časového údaja — pre klasifikáciu a hľadanie. Dátum nie je
 * obsah: klasifikátor by rok „2020" vzal za kód normy a poslal otázku do
 * fulltextu (overené smoke: „Kto zvolával konferenciu k 1. 1. 2020?" potom
 * nenašiel čl. 9 Rokovacieho poriadku), a v texte by rušil aj vektor.
 * Porovnávacie výrazy sa nechávajú — hovoria, o čom otázka je.
 */
export function withoutTimePhrase(query: string): string {
  const lead = String.raw`(?:(?:k|ku|ke|ku\s+dnu|ku\s+dňu|ke\s+dni|k\s+dátumu|k\s+datu|ku\s+dátumu|as\s+of|on|at|platn[éáýi]\s+)\s*)?`
  const month = String.raw`[\p{L}]{3,}\.?`
  // [vzor, či obsahuje slovo na mieste mesiaca, ktoré treba overiť]
  const patterns: Array<[RegExp, boolean]> = [
    [new RegExp(String.raw`${lead}\b\d{4}-\d{2}-\d{2}\b`, "giu"), false],
    [new RegExp(String.raw`${lead}(?<![\d§])\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\b`, "giu"), false],
    [new RegExp(String.raw`${lead}(?<![\d§])\d{1,2}\.?\s+(${month})\s+\d{4}\b`, "giu"), true],
    [new RegExp(String.raw`${lead}\b(${month})\s+\d{1,2},?\s+\d{4}\b`, "giu"), true],
    [/\b(?:v\s+roku|vo\s+roku|v\s+r\.|v\s+roce|roku|in(?:\s+the\s+year)?|during)\s+(?:19|20)\d{2}\b/giu, false],
    [/\b(?:vlani|loni|minul[ýy]\s+rok|minul[ée]ho\s+roka|minulom\s+roku|last\s+year|pred\s+rokom|před\s+rokem|a\s+year\s+ago)\b/giu, false],
  ]
  let out = query
  for (const [re, monthSlot] of patterns) {
    // Mesiac musí byť naozaj mesiac — „čl. 12 odseku 2020" sa nevyhadzuje.
    out = out.replace(re, (m: string, word?: string) => (monthSlot && (!word || monthOf(word) === null) ? m : " "))
  }
  const cleaned = out.replace(/\s+([?.!,])/g, "$1").replace(/\s{2,}/g, " ").trim()
  // Keby z otázky nezostalo nič rozumné, hľadá sa pôvodná.
  return cleaned.split(/\s+/).length >= 2 ? cleaned : query
}

/**
 * Čas z prepisu modelom (`preprocessQuery`). Neplatný alebo nezmyselný údaj
 * sa zahodí — radšej dnešok než vymyslený dátum.
 */
export function parseModelTime(raw: unknown, now: Date = new Date()): QueryTime | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as { kind?: unknown; date?: unknown }
  const today = calendarDate(now)
  if (r.kind === "compare") return { kind: "compare", asOf: iso(today), source: "model" }
  if (r.kind !== "asOf" || typeof r.date !== "string") return null
  const m = r.date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const d = m ? validDate(+m[1], +m[2], +m[3]) : null
  return d ? asOfOrToday(d, today, "model") : null
}

/**
 * `time` z tela požiadavky na uloženie hodnotenia — prehliadač ho len
 * vracia, ale telo požiadavky je cudzí vstup. Uloží sa len platný tvar.
 */
export function sanitizeQueryTime(raw: unknown): QueryTime | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const r = raw as Record<string, unknown>
  const kinds: QueryTimeKind[] = ["today", "asOf", "compare"]
  const sources: QueryTime["source"][] = ["rules", "model", "default"]
  if (!kinds.includes(r.kind as QueryTimeKind) || !sources.includes(r.source as QueryTime["source"])) return undefined
  if (typeof r.asOf !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.asOf)) return undefined
  return { kind: r.kind as QueryTimeKind, asOf: r.asOf, source: r.source as QueryTime["source"] }
}

/** Pravidlá majú prednosť; model len doplní, čo pravidlá nenašli. */
export function resolveQueryTime(rules: QueryTime, model: QueryTime | null | undefined, now: Date = new Date()): QueryTime {
  if (rules.kind !== "today" || rules.source === "rules") return rules
  return model ?? todayTime(now)
}

/**
 * Okamih, ku ktorému sa hľadajú znenia. Pri dnešku skutočné „teraz"; pri
 * inom dni poludnie UTC toho dňa — znenie účinné od toho dňa už platí
 * a znenie, ktorému v ten deň končí účinnosť, už nie.
 */
export function searchInstant(time: QueryTime, now: Date = new Date()): Date {
  return time.kind === "asOf" ? new Date(`${time.asOf}T12:00:00Z`) : now
}
