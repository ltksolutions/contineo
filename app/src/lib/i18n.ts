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
    /**
     * „Čaká od …". Ukáže sa **len** pri úlohe, ktorá má pridelenie (D37) —
     * inak by dátum znamenal niečo iné, než čo je pri ňom napísané.
     */
    waitingSince: (date: string) => string
    /** Pribudlo od predchádzajúceho prihlásenia (D39). */
    isNew: string
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

  /**
   * E-mail „bolo vám pridelené…".
   *
   * Nesie **dôvod, ktorý napísal človek** (D30/D37). Bez neho by to bola
   * ďalšia automatická správa, ktorú si ľudia odfiltrujú; s ním je to veta,
   * z ktorej sa dá pochopiť, prečo to niekto poslal.
   */
  assignmentEmail: {
    subject: (organisation: string) => string
    subtitle: string
    intro: string
    /** Nadpis nad dôvodom. */
    reasonLabel: string
    versionLine: (label: string, effectiveFrom: string) => string
    button: string
    /** Čo sa stane, keď to človek nechá tak. Bez toho e-mail nič nežiada. */
    note: string
  }

  /** Hlavička: navigácia, téma, účet. */
  nav: {
    ask: string
    goldenSet: string
    toAcknowledge: string
    assigned: string
    people: string
    library: string
    organisation: string
    tenants: string
    openMenu: string
    closeMenu: string
    account: (email: string) => string
    signOut: string
    themeLabel: string
    theme: Record<"system" | "light" | "dark", string>
    /** Popis pre čítačku obrazovky — hovorí aj to, čo sa stane po kliknutí. */
    themeToggle: (now: string, next: string) => string
    themeState: (now: string) => string
  }

  footer: {
    runsOn: string
    sourceCode: string
  }

  notFound: {
    heading: string
    intro: string
    home: string
  }

  home: {
    heading: string
    intro: string
  }

  /** Prihlasovacia obrazovka. Jazyk určuje organizácia — človek ešte nie je známy. */
  signIn: {
    heading: string
    intro: string
    submit: string
    sending: string
    checkEmail: string
    sent: string
    otherAddress: string
    withProvider: (provider: string) => string
    /** Kľúče sú chybové kódy next-auth, nie naše — prichádzajú v adrese. */
    error: Record<string, string>
    genericError: string
  }

  documents: {
    notInOrganisation: (email: string, organisation: string) => string
  }

  /** Voľné otázky — vyhľadávanie aj odpoveď. */
  ask: {
    placeholder: string
    submit: string
    stop: string
    searching: string
    askAgain: string
    askThis: string
    examplesLabel: string
    examples: string[]
    unknownError: string
  }

  answer: {
    failed: string
    incompleteHeading: string
    incompleteNote: string
    citations: (shown: number) => string
    citationsNote: string
    sourceMissing: string
    sources: (n: number) => string
    internal: string
    adapter: string
    firstToken: string
    costNote: (pricelistVersion: string) => string
    pricelistStale: string
    citationsVerified: string
    citationsUnverified: string
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
      waitingSince: d => `čaká od ${d}`,
      isNew: "nové",
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
    assignmentEmail: {
      subject: org => `Nový dokument na potvrdenie — ${org}`,
      subtitle: "Na potvrdenie",
      intro: "Do vášho zoznamu pribudol dokument, s ktorým sa máte oboznámiť:",
      reasonLabel: "Dôvod",
      versionLine: (label, effectiveFrom) => `verzia ${label}, platná od ${effectiveFrom}`,
      button: "Otvoriť a potvrdiť",
      note: "Dokument nájdete aj po prihlásení v zozname na úvodnej strane. Kým ho nepotvrdíte, zostane vám tam.",
    },
  nav: {
    ask: "Voľné otázky",
    goldenSet: "Zlatá sada",
    toAcknowledge: "Na potvrdenie",
    assigned: "Pridelené normy",
    people: "Osoby",
    library: "Knižnica",
    organisation: "Nastavenie organizácie",
    tenants: "Správa tenantov",
    openMenu: "Otvoriť menu",
    closeMenu: "Zavrieť menu",
    account: (email) => `Účet ${email}`,
    signOut: "Odhlásiť",
    themeLabel: "Téma:",
    theme: { system: "podľa systému", light: "svetlá", dark: "tmavá" },
    themeToggle: (now, next) => `Téma ${now}. Prepnúť na: ${next}`,
    themeState: (now) => `Téma ${now}`,
  },

  footer: {
    runsOn: "Systém beží na aplikácii",
    sourceCode: "Zdrojový kód",
  },

  notFound: {
    heading: "Stránka sa nenašla",
    intro: "Adresa neexistuje alebo už neplatí.",
    home: "Na úvodnú stranu",
  },

  home: {
    heading: "Vyskúšajte, ako systém odpovedá",
    intro: "Odpoveď sa skladá výlučne z nahraných dokumentov. Ak informácia v nich nie je, systém to má povedať — a to je rovnako dôležité ako správna odpoveď.",
  },

  signIn: {
    heading: "Prihlásenie",
    intro: "Zadajte e-mail, na ktorý ste dostali pozvánku. Pošleme vám odkaz — heslo si pamätať nemusíte.",
    submit: "Poslať prihlasovací odkaz",
    sending: "Odosielam…",
    checkEmail: "Pozrite si e-mail",
    sent: "Ak je adresa medzi pozvanými, práve na ňu odišiel prihlasovací odkaz. Platí 24 hodín a dá sa použiť raz.",
    otherAddress: "Zadať inú adresu",
    withProvider: (provider) => `Prihlásiť sa cez ${provider}`,
    error: {
      AccessDenied: "Táto adresa nie je medzi pozvanými. Ak si myslíte, že tam patrí, ozvite sa správcovi.",
      Verification: "Odkaz už neplatí — buď vypršal, alebo bol použitý. Vyžiadajte si nový.",
      EmailSignin: "E-mail sa nepodarilo odoslať. Skúste to o chvíľu znova.",
      OAuthSignin: "Prihlásenie kontom sa nepodarilo začať. Skúste to znova.",
      OAuthCallback: "Prihlásenie kontom sa nepodarilo dokončiť. Skúste to znova.",
      OAuthAccountNotLinked: "Toto konto sa nedá spojiť s vašou adresou. Prihláste sa odkazom v e-maile.",
    },
    genericError: "Prihlásenie sa nepodarilo. Skúste to znova.",
  },

  documents: {
    notInOrganisation: (email, organisation) =>
      `Ste prihlásený ako ${email}, ale nie ste vedený medzi osobami organizácie ${organisation} — takže vám systém nemá čo priradiť. Ak tu máte niečo potvrdzovať, požiadajte HR o zaradenie.`,
  },

  ask: {
    placeholder: "Opýtajte sa na čokoľvek z noriem…",
    submit: "Opýtať sa",
    stop: "Zastaviť",
    searching: "Hľadám…",
    askAgain: "Spýtať sa znova",
    askThis: "Položiť túto otázku",
    examplesLabel: "Alebo skúste:",
    examples: [
      "Aká je lehota na podanie námietky?",
      "Za akých podmienok môže prestúpiť maloletý hráč?",
      "Kedy sa platí odstupné za hráča?",
      "Koľko žltých kariet znamená zastavenie činnosti?",
    ],
    unknownError: "Neznáma chyba",
  },

  answer: {
    failed: "Odpoveď sa nepodarilo získať.",
    incompleteHeading: "Odpoveď je neúplná.",
    incompleteNote: "Model dosiahol limit dĺžky a zastavil sa uprostred — chýba jej záver. Skúste sa opýtať na užšiu časť problému.",
    citations: (shown) => `Doslovné citácie (${shown})`,
    citationsNote: "uvedených, zhodné zlúčené",
    sourceMissing: "zdroj neuvedený",
    sources: (n) => `Prehľadané zdroje (${n})`,
    internal: "interné",
    adapter: "adaptér",
    firstToken: "prvý token",
    costNote: (pricelistVersion) => `Orientačne. Nezahŕňa pomocný model ani vyhľadávanie. Cenník ${pricelistVersion}.`,
    pricelistStale: "cenník je zastaraný",
    citationsVerified: "citácie overené modelom",
    citationsUnverified: "citácie neoverené",
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
      waitingSince: d => `čeká od ${d}`,
      isNew: "nové",
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
    assignmentEmail: {
      subject: org => `Nový dokument k potvrzení — ${org}`,
      subtitle: "K potvrzení",
      intro: "Do vašeho seznamu přibyl dokument, se kterým se máte seznámit:",
      reasonLabel: "Důvod",
      versionLine: (label, effectiveFrom) => `verze ${label}, platná od ${effectiveFrom}`,
      button: "Otevřít a potvrdit",
      note: "Dokument najdete i po přihlášení v seznamu na úvodní straně. Dokud jej nepotvrdíte, zůstane vám tam.",
    },
  nav: {
    ask: "Volné otázky",
    goldenSet: "Zlatá sada",
    toAcknowledge: "K potvrzení",
    assigned: "Přidělené předpisy",
    people: "Osoby",
    library: "Knihovna",
    organisation: "Nastavení organizace",
    tenants: "Správa tenantů",
    openMenu: "Otevřít menu",
    closeMenu: "Zavřít menu",
    account: (email) => `Účet ${email}`,
    signOut: "Odhlásit",
    themeLabel: "Motiv:",
    theme: { system: "podle systému", light: "světlý", dark: "tmavý" },
    themeToggle: (now, next) => `Motiv ${now}. Přepnout na: ${next}`,
    themeState: (now) => `Motiv ${now}`,
  },

  footer: {
    runsOn: "Systém běží na aplikaci",
    sourceCode: "Zdrojový kód",
  },

  notFound: {
    heading: "Stránka nebyla nalezena",
    intro: "Adresa neexistuje nebo už neplatí.",
    home: "Na úvodní stranu",
  },

  home: {
    heading: "Vyzkoušejte, jak systém odpovídá",
    intro: "Odpověď se skládá výhradně z nahraných dokumentů. Pokud v nich informace není, systém to má říct — a to je stejně důležité jako správná odpověď.",
  },

  signIn: {
    heading: "Přihlášení",
    intro: "Zadejte e-mail, na který jste dostali pozvánku. Pošleme vám odkaz — heslo si pamatovat nemusíte.",
    submit: "Poslat přihlašovací odkaz",
    sending: "Odesílám…",
    checkEmail: "Podívejte se do e-mailu",
    sent: "Pokud je adresa mezi pozvanými, právě na ni odešel přihlašovací odkaz. Platí 24 hodin a lze jej použít jednou.",
    otherAddress: "Zadat jinou adresu",
    withProvider: (provider) => `Přihlásit se přes ${provider}`,
    error: {
      AccessDenied: "Tato adresa není mezi pozvanými. Pokud si myslíte, že tam patří, ozvěte se správci.",
      Verification: "Odkaz už neplatí — buď vypršel, nebo byl použit. Vyžádejte si nový.",
      EmailSignin: "E-mail se nepodařilo odeslat. Zkuste to za chvíli znovu.",
      OAuthSignin: "Přihlášení účtem se nepodařilo zahájit. Zkuste to znovu.",
      OAuthCallback: "Přihlášení účtem se nepodařilo dokončit. Zkuste to znovu.",
      OAuthAccountNotLinked: "Tento účet nelze spojit s vaší adresou. Přihlaste se odkazem v e-mailu.",
    },
    genericError: "Přihlášení se nepodařilo. Zkuste to znovu.",
  },

  documents: {
    notInOrganisation: (email, organisation) =>
      `Jste přihlášeni jako ${email}, ale nejste vedeni mezi osobami organizace ${organisation} — takže vám systém nemá co přiřadit. Pokud tu máte něco potvrzovat, požádejte HR o zařazení.`,
  },

  ask: {
    placeholder: "Zeptejte se na cokoli z předpisů…",
    submit: "Zeptat se",
    stop: "Zastavit",
    searching: "Hledám…",
    askAgain: "Zeptat se znovu",
    askThis: "Položit tuto otázku",
    examplesLabel: "Nebo zkuste:",
    examples: [
      "Jaká je lhůta pro podání námitky?",
      "Za jakých podmínek může přestoupit nezletilý hráč?",
      "Kdy se platí odstupné za hráče?",
      "Kolik žlutých karet znamená zastavení činnosti?",
    ],
    unknownError: "Neznámá chyba",
  },

  answer: {
    failed: "Odpověď se nepodařilo získat.",
    incompleteHeading: "Odpověď je neúplná.",
    incompleteNote: "Model dosáhl limitu délky a zastavil se uprostřed — chybí jí závěr. Zkuste se zeptat na užší část problému.",
    citations: (shown) => `Doslovné citace (${shown})`,
    citationsNote: "uvedených, shodné sloučené",
    sourceMissing: "zdroj neuveden",
    sources: (n) => `Prohledané zdroje (${n})`,
    internal: "interní",
    adapter: "adaptér",
    firstToken: "první token",
    costNote: (pricelistVersion) => `Orientačně. Nezahrnuje pomocný model ani vyhledávání. Ceník ${pricelistVersion}.`,
    pricelistStale: "ceník je zastaralý",
    citationsVerified: "citace ověřené modelem",
    citationsUnverified: "citace neověřené",
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
      waitingSince: d => `waiting since ${d}`,
      isNew: "new",
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
    assignmentEmail: {
      subject: org => `New document to acknowledge — ${org}`,
      subtitle: "To acknowledge",
      intro: "A document has been added to your list:",
      reasonLabel: "Reason",
      versionLine: (label, effectiveFrom) => `version ${label}, effective from ${effectiveFrom}`,
      button: "Open and acknowledge",
      note: "You will also find the document in the list on the home page after signing in. It stays there until you acknowledge it.",
    },
  nav: {
    ask: "Ask a question",
    goldenSet: "Golden set",
    toAcknowledge: "To acknowledge",
    assigned: "Assigned documents",
    people: "People",
    library: "Library",
    organisation: "Organisation settings",
    tenants: "Tenant administration",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    account: (email) => `Account ${email}`,
    signOut: "Sign out",
    themeLabel: "Theme:",
    theme: { system: "system", light: "light", dark: "dark" },
    themeToggle: (now, next) => `Theme ${now}. Switch to: ${next}`,
    themeState: (now) => `Theme ${now}`,
  },

  footer: {
    runsOn: "Running on",
    sourceCode: "Source code",
  },

  notFound: {
    heading: "Page not found",
    intro: "This address does not exist or is no longer valid.",
    home: "Go to the home page",
  },

  home: {
    heading: "See how the system answers",
    intro: "Every answer is built solely from the uploaded documents. If the information is not in them, the system should say so — that matters just as much as a correct answer.",
  },

  signIn: {
    heading: "Sign in",
    intro: "Enter the e-mail address your invitation was sent to. We will send you a link — no password to remember.",
    submit: "Send sign-in link",
    sending: "Sending…",
    checkEmail: "Check your e-mail",
    sent: "If the address is on the invited list, a sign-in link has just been sent to it. It is valid for 24 hours and can be used once.",
    otherAddress: "Use a different address",
    withProvider: (provider) => `Sign in with ${provider}`,
    error: {
      AccessDenied: "This address is not on the invited list. If you believe it should be, contact your administrator.",
      Verification: "The link is no longer valid — it has expired or has already been used. Request a new one.",
      EmailSignin: "The e-mail could not be sent. Please try again in a moment.",
      OAuthSignin: "Signing in with that account could not be started. Please try again.",
      OAuthCallback: "Signing in with that account could not be completed. Please try again.",
      OAuthAccountNotLinked: "This account cannot be linked to your address. Sign in with the link in your e-mail.",
    },
    genericError: "Sign-in failed. Please try again.",
  },

  documents: {
    notInOrganisation: (email, organisation) =>
      `You are signed in as ${email}, but you are not listed among the people of ${organisation} — so there is nothing the system can assign to you. If you are supposed to acknowledge something here, ask HR to add you.`,
  },

  ask: {
    placeholder: "Ask anything about the documents…",
    submit: "Ask",
    stop: "Stop",
    searching: "Searching…",
    askAgain: "Ask again",
    askThis: "Ask this question",
    examplesLabel: "Or try:",
    examples: [
      "What is the deadline for filing an objection?",
      "Under what conditions may a minor player transfer?",
      "When is a transfer fee payable for a player?",
      "How many yellow cards lead to a suspension?",
    ],
    unknownError: "Unknown error",
  },

  answer: {
    failed: "The answer could not be retrieved.",
    incompleteHeading: "The answer is incomplete.",
    incompleteNote: "The model hit its length limit and stopped mid-sentence — the conclusion is missing. Try asking about a narrower part of the problem.",
    citations: (shown) => `Verbatim citations (${shown})`,
    citationsNote: "given, identical ones merged",
    sourceMissing: "source not given",
    sources: (n) => `Sources searched (${n})`,
    internal: "internal",
    adapter: "adapter",
    firstToken: "first token",
    costNote: (pricelistVersion) => `Approximate. Excludes the helper model and retrieval. Price list ${pricelistVersion}.`,
    pricelistStale: "the price list is out of date",
    citationsVerified: "citations verified by the model",
    citationsUnverified: "citations not verified",
  },
  },
}

/** Slovník pre daný jazyk; pri neznámom padá na predvolený, nikdy nespadne. */
export function dictionary(language: unknown): Dictionary {
  return DICTIONARY[normalizeLanguage(language)]
}
