/**
 * widgetAppearance.ts — vzhľad a správanie widgetu ako nastavenie kanála
 * (ADR-042, Dodatok 1, D281–D283).
 *
 * Cudzí systém (ISSF) vloží skript raz a ďalej nič nemení (D281); poloha,
 * veľkosť panela, text tlačidla, privítanie a prah ponuky helpdesku sa
 * nastavujú v Contineu a skript ich dostane zo servera.
 *
 * **Tvar** (Dodatok 2, D286): hore v strede a dole v strede je zatvorený
 * widget **riadok otázky**, na ostatných šiestich miestach tlačidlo.
 *
 * Bez závislostí na databáze — číta ho aj skript widgetu a testy.
 */

import { isUiLanguage, UI_LANGUAGES, type UiLanguage } from "./i18n"

/**
 * Osem miest okolo obrazovky, v smere hodinových ručičiek od ľavého
 * horného rohu (D282). Kľúče sú dáta v `channels.widget.appearance`.
 */
export const WIDGET_POSITIONS = [
  "left-top", "top", "right-top", "right-middle", "right-bottom", "bottom", "left-bottom", "left-middle",
] as const
export type WidgetPosition = (typeof WIDGET_POSITIONS)[number]

/**
 * Predvoľby, nie voľné pixely (D283) — voľné rozmery by sa na niektorej
 * šírke rozbili. `xl` je 80 % × 80 % obrazovky v strede so závojom (D287).
 */
export const WIDGET_SIZES = ["s", "m", "l", "xl"] as const
export type WidgetSize = (typeof WIDGET_SIZES)[number]
/** Šírka × výška panela od 640 px; pod 640 px je panel celá obrazovka. `xl` je v percentách. */
export const WIDGET_SIZE_PX: Record<Exclude<WidgetSize, "xl">, { width: number; height: number }> = {
  s: { width: 360, height: 520 },
  m: { width: 400, height: 600 },
  l: { width: 480, height: 720 },
}

/** Riadok otázky namiesto tlačidla — len hore a dole v strede (D286): riadok potrebuje šírku. */
export function isRowPosition(position: WidgetPosition): boolean {
  return position === "top" || position === "bottom"
}

export const ESCALATE_AFTER = [1, 2, 3] as const

/** Strop textov — tlačidlo je na jeden riadok, privítanie na pár viet. */
export const LAUNCHER_MAX = 40
export const GREETING_MAX = 500
/** Nápoveda v riadku otázky — viac než text tlačidla, stále jeden riadok. */
export const PLACEHOLDER_MAX = 120
/** Vzory otázok v prázdnej plachte (D288). */
export const EXAMPLES_MAX = 6
export const EXAMPLE_MAX = 140
/** Frázy: najviac 20 na jazyk, každá na pár slov. */
export const PHRASES_MAX = 20
export const PHRASE_MAX = 80

/**
 * Predvolené frázy, pri ktorých widget hneď ponúkne správu helpdesku
 * (D275) — zoznam, nie rozpoznávanie zámeru modelom. Porovnáva sa časť
 * vety bez diakritiky a veľkých písmen (`normalizePhrase`), preto stačí
 * jeden tvar bez ohľadu na to, či človek píše s mäkčeňmi. Frázy sú
 * krátke jadrá („s človekom“, nie „spojiť sa s človekom“) — slovenčina
 * má voľný slovosled a ohýba („chcem sa s človekom spojiť“, „helpdesku“).
 */
export const DEFAULT_PHRASES: Record<UiLanguage, string[]> = {
  sk: ["helpdesk", "s človekom", "s operátorom", "kontaktovať podporu", "napísať podpore"],
  cs: ["helpdesk", "s člověkem", "s operátorem", "kontaktovat podporu", "napsat podpoře"],
  en: ["helpdesk", "help desk", "a human", "real person", "an operator", "contact support"],
}

/**
 * Tvar, v ktorom sa frázy porovnávajú: malé písmená, bez diakritiky,
 * jedna medzera. Skript widgetu robí s otázkou to isté (`norm` v
 * `widgetScript.ts`) — menia sa spolu.
 */
export function normalizePhrase(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim()
}

export interface WidgetAppearance {
  position: WidgetPosition
  size: WidgetSize
  /** Po koľkých neúspechoch (palec dole, bez odpovede) widget ponúkne helpdesk (D275, D283). */
  escalateAfter: 1 | 2 | 3
  /** Text tlačidla podľa jazyka; chýbajúci = predvolený text („Opýtať sa"). */
  launcher: Partial<Record<UiLanguage, string>>
  /** Privítanie v prázdnom paneli podľa jazyka; chýbajúce = bez privítania. */
  greeting: Partial<Record<UiLanguage, string>>
  /** Stále viditeľný odkaz „Napísať helpdesku" po prvej odpovedi (D275, D283). */
  offerLink: boolean
  /** Frázy podľa jazyka, pri ktorých sa správa ponúkne hneď; chýbajúci jazyk = `DEFAULT_PHRASES`. */
  phrases: Partial<Record<UiLanguage, string[]>>
  /** Nápoveda v riadku otázky podľa jazyka; chýbajúca = predvolená (`widget.rowPlaceholder`). */
  placeholder: Partial<Record<UiLanguage, string>>
  /** Vzory otázok v prázdnej plachte podľa jazyka; chýbajúce = časť sa nekreslí (D288). */
  examples: Partial<Record<UiLanguage, string[]>>
}

/**
 * Predvolené hodnoty: riadok otázky hore v strede, plachta 80 % × 80 %
 * (Dodatok 2, D286, D287 — Ján 27. 10. 2026, po vpravo v strede z D282).
 * Prah 2 je D275.
 */
export const DEFAULT_WIDGET_APPEARANCE: WidgetAppearance = {
  position: "top", size: "xl", escalateAfter: 2, launcher: {}, greeting: {}, offerLink: true, phrases: {}, placeholder: {}, examples: {},
}

function texts(raw: unknown, max: number): Partial<Record<UiLanguage, string>> {
  const out: Partial<Record<UiLanguage, string>> = {}
  if (!raw || typeof raw !== "object") return out
  for (const [lang, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isUiLanguage(lang) || typeof v !== "string") continue
    const text = v.replace(/\r\n?/g, "\n").trim().slice(0, max)
    if (text) out[lang] = text
  }
  return out
}

function lists(raw: unknown, maxItems: number, maxLength: number): Partial<Record<UiLanguage, string[]>> {
  const out: Partial<Record<UiLanguage, string[]>> = {}
  if (!raw || typeof raw !== "object") return out
  for (const [lang, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isUiLanguage(lang) || !Array.isArray(v)) continue
    const list = [...new Set(v.filter((x): x is string => typeof x === "string").map(x => x.replace(/\s+/g, " ").trim().slice(0, maxLength)).filter(Boolean))]
    if (list.length) out[lang] = list.slice(0, maxItems)
  }
  return out
}

/**
 * Nastavenie z formulára alebo z databázy → úplné a platné. Neznáma
 * hodnota padá na predvolenú, nie na chybu — staršie kanály nastavenie
 * nemajú a skript musí vždy vedieť, kde tlačidlo nakresliť.
 */
export function widgetAppearance(raw: unknown): WidgetAppearance {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_WIDGET_APPEARANCE
  const n = Number(r.escalateAfter)
  return {
    position: (WIDGET_POSITIONS as readonly string[]).includes(String(r.position)) ? r.position as WidgetPosition : d.position,
    size: (WIDGET_SIZES as readonly string[]).includes(String(r.size)) ? r.size as WidgetSize : d.size,
    escalateAfter: n === 1 || n === 2 || n === 3 ? n : d.escalateAfter,
    launcher: texts(r.launcher, LAUNCHER_MAX),
    greeting: texts(r.greeting, GREETING_MAX),
    // Chýbajúce pole (staršie kanály) = zapnuté, ako D275.
    offerLink: r.offerLink !== false,
    phrases: lists(r.phrases, PHRASES_MAX, PHRASE_MAX),
    placeholder: texts(r.placeholder, PLACEHOLDER_MAX),
    examples: lists(r.examples, EXAMPLES_MAX, EXAMPLE_MAX),
  }
}

/** Čo dostane skript: texty už pre jeden jazyk, prázdne = predvolené. */
export interface WidgetAppearanceForScript {
  position: WidgetPosition
  size: WidgetSize
  escalateAfter: number
  launcher: string
  greeting: string
  offerLink: boolean
  /** Frázy všetkých jazykov rozhrania, už v tvare `normalizePhrase`. */
  phrases: string[]
  placeholder: string
  examples: string[]
}

export function appearanceForScript(a: WidgetAppearance, language: UiLanguage): WidgetAppearanceForScript {
  return {
    position: a.position, size: a.size, escalateAfter: a.escalateAfter,
    launcher: a.launcher[language] ?? "", greeting: a.greeting[language] ?? "",
    offerLink: a.offerLink,
    // Všetky jazyky naraz: človek s českým rozhraním môže napísať po slovensky.
    phrases: [...new Set(UI_LANGUAGES.flatMap(l => (a.phrases[l] ?? DEFAULT_PHRASES[l]).map(normalizePhrase)).filter(Boolean))],
    placeholder: a.placeholder[language] ?? "",
    examples: a.examples[language] ?? [],
  }
}
