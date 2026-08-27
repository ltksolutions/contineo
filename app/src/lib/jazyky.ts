/**
 * jazyky.ts — jazyk **prostredia** (SK · CS · EN).
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
 * obsah otagovaný; `JAZYKY_UI` hovorí, v čom vieme viesť rozhovor. Že sa dnes
 * prekrývajú, je zhoda okolností — Čech môže čítať slovenskú smernicu
 * v českom rozhraní a záznam o potvrdení to musí uniesť.
 */

export const JAZYKY_UI = ["sk", "cs", "en"] as const
export type JazykUI = (typeof JAZYKY_UI)[number]

/** Keď jazyk nepoznáme, ideme do slovenčiny — nie do angličtiny. */
export const PREDVOLENY_JAZYK: JazykUI = "sk"

export function jeJazykUI(x: unknown): x is JazykUI {
  return typeof x === "string" && (JAZYKY_UI as readonly string[]).includes(x)
}

/**
 * Prevedie čokoľvek na podporovaný jazyk. Zvláda aj tvary typu `sk-SK`
 * alebo `cs_CZ`, ktoré chodia z prehliadača a z importovaných tabuliek.
 */
export function normalizujJazyk(x: unknown): JazykUI {
  if (typeof x !== "string") return PREDVOLENY_JAZYK
  const zaklad = x.trim().toLowerCase().split(/[-_]/)[0]
  return jeJazykUI(zaklad) ? zaklad : PREDVOLENY_JAZYK
}

const MESIACE_EN = [
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
export function datum(d: Date, jazyk: JazykUI = PREDVOLENY_JAZYK): string {
  const den = d.getUTCDate(), mesiac = d.getUTCMonth(), rok = d.getUTCFullYear()
  if (jazyk === "en") return `${den} ${MESIACE_EN[mesiac]} ${rok}`
  return `${den}. ${mesiac + 1}. ${rok}`
}

// ── Slovník prostredia ───────────────────────────────────────────────────────

interface Slovnik {
  /**
   * Znenie potvrdzovacej formulky (D28) — **oboznámenie a záväzok, nie súhlas**.
   * Pri vnútornom predpise je súhlas právne zvláštny: smernica zaväzuje bez
   * ohľadu na to, či s ňou niekto súhlasí.
   *
   * Musí obsahovať názov, verziu **aj** dátum platnosti — bez nich sa o rok
   * nedá povedať, čo presne bolo potvrdené.
   */
  potvrdenie(nazov: string, verzia: string, platnaOd: string): string

  email: {
    predmet: string
    nadpis: string
    uvod: string
    tlacidlo: string
    platnost: string
    nefunguje: string
    podtitul: string
  }
}

export const SLOVNIK: Record<JazykUI, Slovnik> = {
  sk: {
    potvrdenie: (nazov, verzia, platnaOd) =>
      `Potvrdzujem, že som sa oboznámil s dokumentom „${nazov}", verzia ${verzia}, ` +
      `platná od ${platnaOd}, porozumel som jeho obsahu a zaväzujem sa ho dodržiavať.`,
    email: {
      predmet: "Prihlásenie do Contineo",
      nadpis: "Prihlásenie do Contineo",
      uvod: "Kliknutím sa prihlásite.",
      tlacidlo: "Prihlásiť sa",
      platnost: "Odkaz platí 24 hodín a dá sa použiť raz. Ak ste o prihlásenie nežiadali, tento e-mail ignorujte — bez kliknutia sa nič nestane.",
      nefunguje: "Ak odkaz nefunguje, skopírujte do prehliadača:",
      podtitul: "Interný portál",
    },
  },

  cs: {
    potvrdenie: (nazov, verzia, platnaOd) =>
      `Potvrzuji, že jsem se seznámil s dokumentem „${nazov}", verze ${verzia}, ` +
      `platná od ${platnaOd}, porozuměl jsem jeho obsahu a zavazuji se jej dodržovat.`,
    email: {
      predmet: "Přihlášení do Contineo",
      nadpis: "Přihlášení do Contineo",
      uvod: "Kliknutím se přihlásíte.",
      tlacidlo: "Přihlásit se",
      platnost: "Odkaz platí 24 hodin a lze jej použít jednou. Pokud jste o přihlášení nežádali, tento e-mail ignorujte — bez kliknutí se nic nestane.",
      nefunguje: "Pokud odkaz nefunguje, zkopírujte jej do prohlížeče:",
      podtitul: "Interní portál",
    },
  },

  en: {
    potvrdenie: (nazov, verzia, platnaOd) =>
      `I confirm that I have read the document "${nazov}", version ${verzia}, ` +
      `effective from ${platnaOd}, that I understand its contents ` +
      `and undertake to comply with it.`,
    email: {
      predmet: "Sign in to Contineo",
      nadpis: "Sign in to Contineo",
      uvod: "Click to sign in.",
      tlacidlo: "Sign in",
      platnost: "The link is valid for 24 hours and can be used once. If you did not request it, ignore this e-mail — nothing happens without clicking.",
      nefunguje: "If the link does not work, copy it into your browser:",
      podtitul: "Internal portal",
    },
  },
}

/** Slovník pre daný jazyk; pri neznámom padá na predvolený, nikdy nespadne. */
export function slovnik(jazyk: unknown): Slovnik {
  return SLOVNIK[normalizujJazyk(jazyk)]
}
