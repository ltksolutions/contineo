/**
 * widgetAppearance.ts — vzhľad a správanie widgetu ako nastavenie kanála
 * (ADR-042, Dodatok 1, D281–D283).
 *
 * Cudzí systém (ISSF) vloží skript raz a ďalej nič nemení (D281); poloha,
 * veľkosť panela, text tlačidla, privítanie a prah ponuky helpdesku sa
 * nastavujú v Contineu a skript ich dostane zo servera.
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

/** Tri predvoľby, nie voľné pixely (D283) — voľné rozmery by sa na niektorej šírke rozbili. */
export const WIDGET_SIZES = ["s", "m", "l"] as const
export type WidgetSize = (typeof WIDGET_SIZES)[number]
/** Šírka × výška panela od 640 px; pod 640 px je panel celá obrazovka. */
export const WIDGET_SIZE_PX: Record<WidgetSize, { width: number; height: number }> = {
  s: { width: 360, height: 520 },
  m: { width: 400, height: 600 },
  l: { width: 480, height: 720 },
}

export const ESCALATE_AFTER = [1, 2, 3] as const

/** Strop textov — tlačidlo je na jeden riadok, privítanie na pár viet. */
export const LAUNCHER_MAX = 40
export const GREETING_MAX = 500
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
}

/**
 * Predvolené hodnoty. Vpravo v strede (D282, Ján 27. 10. 2026): v ISSF
 * je hore menu, vľavo dole tlačidlá exportu zostáv a schvaľovania žiadostí
 * a vpravo dole tabuľky s akciami — stred strany nič nezakrýva. Prah 2 je D275.
 */
export const DEFAULT_WIDGET_APPEARANCE: WidgetAppearance = {
  position: "right-middle", size: "m", escalateAfter: 2, launcher: {}, greeting: {}, offerLink: true, phrases: {},
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

function phraseLists(raw: unknown): Partial<Record<UiLanguage, string[]>> {
  const out: Partial<Record<UiLanguage, string[]>> = {}
  if (!raw || typeof raw !== "object") return out
  for (const [lang, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isUiLanguage(lang) || !Array.isArray(v)) continue
    const list = [...new Set(v.filter((x): x is string => typeof x === "string").map(x => x.replace(/\s+/g, " ").trim().slice(0, PHRASE_MAX)).filter(Boolean))]
    if (list.length) out[lang] = list.slice(0, PHRASES_MAX)
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
    phrases: phraseLists(r.phrases),
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
}

export function appearanceForScript(a: WidgetAppearance, language: UiLanguage): WidgetAppearanceForScript {
  return {
    position: a.position, size: a.size, escalateAfter: a.escalateAfter,
    launcher: a.launcher[language] ?? "", greeting: a.greeting[language] ?? "",
    offerLink: a.offerLink,
    // Všetky jazyky naraz: človek s českým rozhraním môže napísať po slovensky.
    phrases: [...new Set(UI_LANGUAGES.flatMap(l => (a.phrases[l] ?? DEFAULT_PHRASES[l]).map(normalizePhrase)).filter(Boolean))],
  }
}
