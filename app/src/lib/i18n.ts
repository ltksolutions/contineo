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

  /** Texty potvrdzovacích obrazoviek. */
  onboarding: {
    listHeading: string
    listIntro: string
    nothingToDo: string
    progress: (done: number, total: number) => string
    open: string
    done: string
    todo: string
    blocked: string
    blockedReason: Record<string, string>
    version: (label: string, from: string) => string
    confirmHeading: string
    confirmButton: string
    confirmPending: string
    confirmed: string
    confirmedAt: (when: string) => string
    back: string
    error: Record<string, string>
  }

  /**
   * Widget „Nevybavené žiadosti" na úvodnej strane (D36).
   *
   * Množné čísla sú napísané rukou pre každý jazyk zvlášť. Slovenčina
   * a čeština majú tri tvary (1 / 2–4 / 5+); `Intl.PluralRules` by tvar
   * vybralo, ale text by aj tak musel byť napísaný trikrát — pribudla by
   * závislosť bez úspory.
   */
  pending: {
    heading: string
    empty: string
    open: string
    count: (n: number) => string
    showAll: (n: number) => string
    blockedNote: (n: number) => string
    /**
     * Druhý riadok položky. Samotné „1.0" pod názvom normy nepovie nič —
     * vyzerá to ako číslo bez významu. Dátum platnosti sa sem nedáva:
     * v úzkom stĺpci by riadok zalomil a `/dokumenty` ho aj tak ukazuje.
     */
    version: (label: string) => string
  }

  email: {
    /**
     * Predmet a nadpis nesú **názov organizácie**, nie názov softvéru.
     * Človek zo zväzu dostane do schránky správu od zväzu; „Prihlásenie do
     * Contineo" mu nepovie nič a vyzerá to ako reklama od cudzieho dodávateľa.
     */
    subject: (organisation: string) => string
    heading: (organisation: string) => string
    intro: string
    button: string
    validity: string
    fallbackNote: string
    subtitle: string
  }
}

export const DICTIONARY: Record<UiLanguage, Dictionary> = {
  sk: {
  onboarding: {
    listHeading: "Dokumenty na potvrdenie",
    listIntro: "Prečítajte si každý dokument a potvrďte, že ste sa s ním oboznámili. Potvrdenie sa viaže na konkrétne znenie — pri novej verzii vás systém požiada znova.",
    nothingToDo: "Momentálne nemáte nič na potvrdenie.",
    progress: (done, total) => `Hotové ${done} z ${total}`,
    open: "Otvoriť",
    done: "potvrdené",
    todo: "čaká na vás",
    blocked: "zatiaľ nedostupné",
    blockedReason: {
      "no-versions": "dokument zatiaľ nemá znenie",
      "validity-not-set": "znenie ešte nemá určenú platnosť",
      "all-archived": "všetky znenia sú archivované",
      "not-yet-effective": "platnosť sa ešte nezačala",
      "no-longer-effective": "platnosť už skončila",
      "document-unavailable": "dokument nie je dostupný",
    },
    version: (label, from) => `verzia ${label}, platná od ${from}`,
    confirmHeading: "Potvrdenie oboznámenia",
    confirmButton: "Potvrdzujem",
    confirmPending: "Ukladá sa…",
    confirmed: "Potvrdené. Ďakujeme.",
    confirmedAt: (when) => `Potvrdili ste ${when}.`,
    back: "Späť na zoznam",
    error: {
      "document-not-found": "Dokument sa nenašiel.",
      "no-effective-version": "Dokument nemá platné znenie, preto sa nedá potvrdiť.",
      "already-acknowledged": "Toto znenie už máte potvrdené.",
      "write-failed": "Potvrdenie sa nepodarilo uložiť. Skúste to prosím znova.",
      "not-signed-in": "Vaše prihlásenie vypršalo. Prihláste sa znova.",
    },
  },
    pending: {
      heading: "Nevybavené žiadosti",
      version: label => `verzia ${label}`,
      empty: "Nič na vás nečaká.",
      open: "Otvoriť",
      count: n => (n === 1 ? "1 položka" : n >= 2 && n <= 4 ? `${n} položky` : `${n} položiek`),
      showAll: n => `Zobraziť všetky (${n})`,
      blockedNote: n =>
        n === 1
          ? "Jeden dokument zatiaľ nie je dostupný."
          : n >= 2 && n <= 4
            ? `${n} dokumenty zatiaľ nie sú dostupné.`
            : `${n} dokumentov zatiaľ nie je dostupných.`,
    },
    statement: (title, version, effectiveFrom) =>
      `Potvrdzujem, že som sa oboznámil s dokumentom „${title}", verzia ${version}, ` +
      `platná od ${effectiveFrom}, porozumel som jeho obsahu a zaväzujem sa ho dodržiavať.`,
    email: {
      subject: org => `Prihlásenie — ${org}`,
      heading: org => `Prihlásenie — ${org}`,
      intro: "Kliknutím sa prihlásite.",
      button: "Prihlásiť sa",
      validity: "Odkaz platí 24 hodín a dá sa použiť raz. Ak ste o prihlásenie nežiadali, tento e-mail ignorujte — bez kliknutia sa nič nestane.",
      fallbackNote: "Ak odkaz nefunguje, skopírujte do prehliadača:",
      subtitle: "Interný portál",
    },
  },

  cs: {
  onboarding: {
    listHeading: "Dokumenty k potvrzení",
    listIntro: "Přečtěte si každý dokument a potvrďte, že jste se s ním seznámili. Potvrzení se váže na konkrétní znění — u nové verze vás systém požádá znovu.",
    nothingToDo: "Momentálně nemáte nic k potvrzení.",
    progress: (done, total) => `Hotovo ${done} z ${total}`,
    open: "Otevřít",
    done: "potvrzeno",
    todo: "čeká na vás",
    blocked: "zatím nedostupné",
    blockedReason: {
      "no-versions": "dokument zatím nemá znění",
      "validity-not-set": "znění ještě nemá určenou platnost",
      "all-archived": "všechna znění jsou archivována",
      "not-yet-effective": "platnost ještě nezačala",
      "no-longer-effective": "platnost už skončila",
      "document-unavailable": "dokument není dostupný",
    },
    version: (label, from) => `verze ${label}, platná od ${from}`,
    confirmHeading: "Potvrzení seznámení",
    confirmButton: "Potvrzuji",
    confirmPending: "Ukládá se…",
    confirmed: "Potvrzeno. Děkujeme.",
    confirmedAt: (when) => `Potvrdili jste ${when}.`,
    back: "Zpět na seznam",
    error: {
      "document-not-found": "Dokument se nenašel.",
      "no-effective-version": "Dokument nemá platné znění, proto jej nelze potvrdit.",
      "already-acknowledged": "Toto znění už máte potvrzené.",
      "write-failed": "Potvrzení se nepodařilo uložit. Zkuste to prosím znovu.",
      "not-signed-in": "Vaše přihlášení vypršelo. Přihlaste se znovu.",
    },
  },
    pending: {
      heading: "Nevyřízené žádosti",
      version: label => `verze ${label}`,
      empty: "Nic na vás nečeká.",
      open: "Otevřít",
      count: n => (n === 1 ? "1 položka" : n >= 2 && n <= 4 ? `${n} položky` : `${n} položek`),
      showAll: n => `Zobrazit všechny (${n})`,
      blockedNote: n =>
        n === 1
          ? "Jeden dokument zatím není dostupný."
          : n >= 2 && n <= 4
            ? `${n} dokumenty zatím nejsou dostupné.`
            : `${n} dokumentů zatím není dostupných.`,
    },
    statement: (title, version, effectiveFrom) =>
      `Potvrzuji, že jsem se seznámil s dokumentem „${title}", verze ${version}, ` +
      `platná od ${effectiveFrom}, porozuměl jsem jeho obsahu a zavazuji se jej dodržovat.`,
    email: {
      subject: org => `Přihlášení — ${org}`,
      heading: org => `Přihlášení — ${org}`,
      intro: "Kliknutím se přihlásíte.",
      button: "Přihlásit se",
      validity: "Odkaz platí 24 hodin a lze jej použít jednou. Pokud jste o přihlášení nežádali, tento e-mail ignorujte — bez kliknutí se nic nestane.",
      fallbackNote: "Pokud odkaz nefunguje, zkopírujte jej do prohlížeče:",
      subtitle: "Interní portál",
    },
  },

  en: {
  onboarding: {
    listHeading: "Documents to acknowledge",
    listIntro: "Read each document and confirm that you have familiarised yourself with it. An acknowledgement is tied to a specific version — when a new one is issued, you will be asked again.",
    nothingToDo: "You have nothing to acknowledge at the moment.",
    progress: (done, total) => `${done} of ${total} done`,
    open: "Open",
    done: "acknowledged",
    todo: "waiting for you",
    blocked: "not available yet",
    blockedReason: {
      "no-versions": "the document has no version yet",
      "validity-not-set": "the version has no effective date yet",
      "all-archived": "all versions are archived",
      "not-yet-effective": "it is not effective yet",
      "no-longer-effective": "it is no longer effective",
      "document-unavailable": "the document is not available",
    },
    version: (label, from) => `version ${label}, effective from ${from}`,
    confirmHeading: "Acknowledgement",
    confirmButton: "I confirm",
    confirmPending: "Saving…",
    confirmed: "Acknowledged. Thank you.",
    confirmedAt: (when) => `You acknowledged this on ${when}.`,
    back: "Back to the list",
    error: {
      "document-not-found": "The document was not found.",
      "no-effective-version": "The document has no effective version, so it cannot be acknowledged.",
      "already-acknowledged": "You have already acknowledged this version.",
      "write-failed": "The acknowledgement could not be saved. Please try again.",
      "not-signed-in": "Your session has expired. Please sign in again.",
    },
  },
    pending: {
      heading: "Pending items",
      version: label => `version ${label}`,
      empty: "Nothing is waiting for you.",
      open: "Open",
      count: n => (n === 1 ? "1 item" : `${n} items`),
      showAll: n => `Show all (${n})`,
      blockedNote: n =>
        n === 1
          ? "One document is not available yet."
          : `${n} documents are not available yet.`,
    },
    statement: (title, version, effectiveFrom) =>
      `I confirm that I have read the document "${title}", version ${version}, ` +
      `effective from ${effectiveFrom}, that I understand its contents ` +
      `and undertake to comply with it.`,
    email: {
      subject: org => `Sign in — ${org}`,
      heading: org => `Sign in — ${org}`,
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
