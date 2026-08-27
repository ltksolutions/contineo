/**
 * i18n.ts — jazyk **prostredia** (SK · CS · EN).
 *
 * Rozhodnutie znie: *„Multijazyčné je len prostredie. Nie obsah. Ale obsah má
 * mať určený základný jazyk, v ktorom je napísaný."* (2026-08-27). To sú dve
 * rôzne veci a miešať ich by bola chyba:
 *
 *   • **Jazyk prostredia** — v akej reči sa s človekom rozprávame: rozhranie,
 *     e-maily, znenie potvrdzovacej formulky. Riadi sa `persons.language`.
 *     Zoznam je tu, v kóde.
 *
 *   • **Jazyk obsahu** — v akej reči je napísaná samotná smernica. Je to
 *     vlastnosť dokumentu (`documents.language`) z číselníka `language`
 *     v `codelists/`. Nič neprekladáme; dokument v češtine je samostatný
 *     dokument, nie preklad slovenského.
 *
 * Preto sú to dva nezávislé zoznamy. Číselník `language` hovorí, čím môže byť
 * obsah otagovaný; `UI_LANGUAGES` hovorí, v čom vieme viesť rozhovor. Že sa dnes
 * prekrývajú, je zhoda okolností — Čech môže čítať slovenskú smernicu
 * v českom rozhraní a záznam o potvrdení to musí uniesť.
 */

export const UI_LANGUAGES = ["sk", "cs", "en"] as const
export type UiLanguage = (typeof UI_LANGUAGES)[number]

/** Keď jazyk nepoznáme, ideme do slovenčiny — nie do angličtiny. */
export const DEFAULT_LANGUAGE: UiLanguage = "sk"

export function isUiLanguage(x: unknown): x is UiLanguage {
  return typeof x === "string" && (UI_LANGUAGES as readonly string[]).includes(x)
}

/**
 * Prevedie čokoľvek na podporovaný jazyk. Zvláda aj tvary typu `sk-SK`
 * alebo `cs_CZ`, ktoré chodia z prehliadača a z importovaných tabuliek.
 */
export function normalizeLanguage(x: unknown): UiLanguage {
  if (typeof x !== "string") return DEFAULT_LANGUAGE
  const base = x.trim().toLowerCase().split(/[-_]/)[0]
  return isUiLanguage(base) ? base : DEFAULT_LANGUAGE
}

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/**
 * Dátum do textu, ktorý sa ukladá ako dôkaz.
 *
 * Zámerne bez `toLocaleDateString`: to závisí od locale **servera**, takže
 * to isté potvrdenie by v inom prostredí vyzeralo inak. Uložené znenie musí
 * byť deterministické — inak sa o rok nedá povedať, čo človek videl.
 *
 * Slovenčina a čeština majú rovnaký tvar (`1. 9. 2026`). Angličtina používa
 * slovný mesiac (`1 September 2026`), aby nevznikla nejednoznačnosť medzi
 * britským a americkým poradím čísel — v právnom texte je to podstatné.
 */
export function formatDate(d: Date, language: UiLanguage = DEFAULT_LANGUAGE): string {
  const day = d.getUTCDate(), month = d.getUTCMonth(), year = d.getUTCFullYear()
  if (language === "en") return `${day} ${MONTHS_EN[month]} ${year}`
  return `${day}. ${month + 1}. ${year}`
}

// ── Slovník prostredia ───────────────────────────────────────────────────────

interface Dictionary {
  /**
   * Znenie potvrdzovacej formulky (D28) — **oboznámenie a záväzok, nie súhlas**.
   * Pri vnútornom predpise je súhlas právne zvláštny: smernica zaväzuje bez
   * ohľadu na to, či s ňou niekto súhlasí.
   *
   * Musí obsahovať názov, verziu **aj** dátum platnosti — bez nich sa o rok
   * nedá povedať, čo presne bolo potvrdené.
   */
  statement(title: string, version: string, effectiveFrom: string): string

  email: {
    subject: string
    heading: string
    intro: string
    button: string
    validity: string
    fallbackNote: string
    subtitle: string
  }
}

export const DICTIONARY: Record<UiLanguage, Dictionary> = {
  sk: {
    statement: (title, version, effectiveFrom) =>
      `Potvrdzujem, že som sa oboznámil s dokumentom „${title}", verzia ${version}, ` +
      `platná od ${effectiveFrom}, porozumel som jeho obsahu a zaväzujem sa ho dodržiavať.`,
    email: {
      subject: "Prihlásenie do Contineo",
      heading: "Prihlásenie do Contineo",
      intro: "Kliknutím sa prihlásite.",
      button: "Prihlásiť sa",
      validity: "Odkaz platí 24 hodín a dá sa použiť raz. Ak ste o prihlásenie nežiadali, tento e-mail ignorujte — bez kliknutia sa nič nestane.",
      fallbackNote: "Ak odkaz nefunguje, skopírujte do prehliadača:",
      subtitle: "Interný portál",
    },
  },

  cs: {
    statement: (title, version, effectiveFrom) =>
      `Potvrzuji, že jsem se seznámil s dokumentem „${title}", verze ${version}, ` +
      `platná od ${effectiveFrom}, porozuměl jsem jeho obsahu a zavazuji se jej dodržovat.`,
    email: {
      subject: "Přihlášení do Contineo",
      heading: "Přihlášení do Contineo",
      intro: "Kliknutím se přihlásíte.",
      button: "Přihlásit se",
      validity: "Odkaz platí 24 hodin a lze jej použít jednou. Pokud jste o přihlášení nežádali, tento e-mail ignorujte — bez kliknutí se nic nestane.",
      fallbackNote: "Pokud odkaz nefunguje, zkopírujte jej do prohlížeče:",
      subtitle: "Interní portál",
    },
  },

  en: {
    statement: (title, version, effectiveFrom) =>
      `I confirm that I have read the document "${title}", version ${version}, ` +
      `effective from ${effectiveFrom}, that I understand its contents ` +
      `and undertake to comply with it.`,
    email: {
      subject: "Sign in to Contineo",
      heading: "Sign in to Contineo",
      intro: "Click to sign in.",
      button: "Sign in",
      validity: "The link is valid for 24 hours and can be used once. If you did not request it, ignore this e-mail — nothing happens without clicking.",
      fallbackNote: "If the link does not work, copy it into your browser:",
      subtitle: "Internal portal",
    },
  },
}

/** Slovník pre daný jazyk; pri neznámom padá na predvolený, nikdy nespadne. */
export function dictionary(language: unknown): Dictionary {
  return DICTIONARY[normalizeLanguage(language)]
}
