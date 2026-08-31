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
  /** Prideľovanie noriem (HR). */
  hr: {
    overview: {
      heading: string
      intro: string
      assign: string
      empty: string
      acknowledged: string
      notified: string
      no: string
      nobody: string
      missing: string
      notifyByEmail: string
      revoke: string
    }
    detail: {
      back: string
      version: string
      assignedBy: string
      notAcknowledged: (missing: number, total: number) => string
      effectiveFrom: (date: string) => string
      notifyLink: string
      allAcknowledged: string
      noLongerInDepartment: string
      note: string
    }
    notify: {
      back: string
      heading: string
      introBefore: string
      introHighlight: string
      introAfter: string
      lastSent: (date: string, count: number) => string
      lastSentTotal: (times: number) => string
      to: (n: number) => string
      allAcknowledged: (audience: string) => string
      formerMembers: (n: number) => string
      formerMembersLink: string
      preview: string
      previewSubject: (subject: string) => string
      /** Tvar čísla je v každom jazyku iný, preto sa skladá tu. */
      send: (n: number) => string
    }
    assign: {
      back: string
      heading: string
      introBefore: string
      introHighlight: string
      introAfter: string
      noEffectiveVersion: string
      whichDocuments: string
      versionLine: (label: string, date: string) => string
      to: string
      departments: string
      groups: string
      tracks: string
      everyone: string
      everyoneNote: string
      departmentNoteBefore: string
      departmentNoteHighlight: string
      departmentNoteAfter: string
      noGroupsOrTracks: string
      addresses: string
      addressesNote: string
      reason: string
      reasonPlaceholder: string
      reasonNote: string
      submit: string
    }
    actions: {
      noAudience: string
      noDocument: string
      saveFailed: string
      /** „Pridelené: 3 (2 normy × 2 publiká)." Tvary čísloviek patria sem. */
      assigned: (count: number, documents: number, audiences: number) => string
      assignedWithExisting: (count: number, documents: number, audiences: number, already: number) => string
      revoked: string
      alreadyRevoked: string
      nobodyToNotify: string
      tooManyRecipients: (recipients: number, max: number) => string
      sent: (n: number) => string
      sentWithFailures: (n: number, failed: string) => string
    }
  }

  /** Strom s poradím — oddelenia aj priečinky knižnice. */
  tree: {
    saveOrder: string
    cancel: string
    hint: string
  }

  tags: {
    empty: string
    add: string
  }
  /** Knižnica dokumentov (D53). */
  library: {
    list: {
      heading: string
      upload: string
      introBefore: string
      introHighlight: string
      introAfter: string
      search: string
      searchPlaceholder: string
      category: string
      categoryField: string
      tag: string
      status: string
      all: string
      statusPublished: string
      statusDrafts: string
      filter: string
      clearFilters: string
      /** Stav spracovania súboru — kľúče sú hodnoty z databázy. */
      processing: Record<string, string>
      draft: string
      effectiveVersion: string
      versions: (n: number) => string
      nothingFound: string
      empty: string
    }
    folders: {
      heading: string
      allDocuments: string
      unfiled: string
      edit: string
      moveUp: (name: string) => string
      up: string
      moveDown: (name: string) => string
      down: string
      nameOf: (name: string) => string
      rename: string
      parentOf: (name: string) => string
      topLevel: string
      move: string
      remove: string
      removeHint: string
      newFolder: string
      newFolderName: string
      parentFolder: string
      create: string
    }
    upload: {
      back: string
      heading: string
      intro: string
      file: string
      /** Veta okolo `.doc` a `.xls` — značky zostávajú v JSX. */
      oldFormatsBefore: string
      oldFormatsMiddle: string
      oldFormatsAfter: string
      title: string
      titlePlaceholder: string
      titleNote: string
      key: string
      keyNoteBefore: string
      keyNoteAfterCode: string
      keyNoteHighlight: string
      keyNoteAfter: string
      scope: string
      accessLevel: string
      accessInternalNote: string
      accessPublicNote: string
      documentLanguage: string
      documentLanguageNote: string
      unset: string
      tags: string
      newTag: string
      submit: string
    }
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
  hr: {
    overview: {
      heading: "Pridelené normy",
      intro: "Čo bolo komu uložené a kto to už potvrdil. Počty sa počítajú pri zobrazení — a týkajú sa ľudí, ktorí do skupiny patria",
      assign: "Prideliť normu",
      empty: "Zatiaľ nie je pridelené nič. Kým sa norma nepridelí, ľuďom sa objaví len vtedy, keď je krokom ich trasy — a nikde nezostane stopa, kedy sa to stalo a prečo.",
      acknowledged: "Potvrdili",
      notified: "Dali sme vedieť",
      no: "nie",
      nobody: "nikto",
      missing: "Chýba",
      notifyByEmail: "Dať vedieť e-mailom",
      revoke: "Odvolať pridelenie",
    },
    detail: {
      back: "← Späť na prehľad",
      version: "verzia",
      assignedBy: "pridelil",
      notAcknowledged: (missing, total) => `Nepotvrdili (${missing} z ${total})`,
      effectiveFrom: (date) => `, platná od ${date}`,
      notifyLink: "dať im vedieť e-mailom →",
      allAcknowledged: "Potvrdili všetci, ktorých sa pridelenie dnes týka.",
      noLongerInDepartment: "už nie je v oddelení",
      note: "Zoznam sa počíta pri zobrazení. Kto z oddelenia odišiel bez potvrdenia, zostáva tu označený — inak by ticho zmizol a nikto by sa nedozvedel, že sa to nedoriešilo; e-mail sa mu ale neposiela. Kto odišiel z celej organizácie, tu nie je — jeho potvrdenie (alebo jeho chýbanie) však zostáva v záznamoch.",
    },
    notify: {
      back: "← Späť na detail",
      heading: "Dať vedieť e-mailom",
      introBefore: "Pošle sa ",
      introHighlight: "len tým, ktorí ešte nepotvrdili",
      introAfter: ". Kto to už má za sebou, by dostal pripomienku niečoho, čo spravil — a to je presne ten druh pošty, po ktorom si ľudia zapnú filter.",
      lastSent: (date, count) => `Naposledy odoslané ${date} (${count} ${count === 1 ? "človeku" : "ľuďom"})`,
      lastSentTotal: (times) => ` · celkovo ${times}×`,
      to: (n) => `Komu (${n})`,
      allAcknowledged: (audience) => `Potvrdili už všetci, ktorých sa ${audience} týka. Nie je komu poslať.`,
      formerMembers: (n) => `Ďalší ${n} nepotvrdili, ale z oddelenia už odišli — tým sa nepíše. Vidno ich na`,
      formerMembersLink: "detaile pridelenia",
      preview: "Čo im príde",
      previewSubject: (subject) => `Predmet: ${subject} · Každý ho dostane vo svojom jazyku.`,
      send: (n) => `Odoslať ${n} ${n === 1 ? "e-mail" : n < 5 ? "e-maily" : "e-mailov"}`,
    },
    assign: {
      back: "← Späť na prehľad",
      heading: "Prideliť normy",
      introBefore: "Prideľuje sa ",
      introHighlight: "konkrétne znenie",
      introAfter: ", nie dokument. Keď pribudne novšie, staré pridelenie zaň neplatí — to je zámer.",
      noEffectiveVersion: "Žiadny dokument nemá platné znenie, takže prideliť sa nedá nič. Znenie bez dátumu platnosti sa nedá ani potvrdiť (D6).",
      whichDocuments: "Ktoré normy",
      versionLine: (label, date) => `verzia ${label}, platná od ${date}`,
      to: "Komu",
      departments: "Oddelenia",
      groups: "Skupiny",
      tracks: "Trasy",
      everyone: "Všetkým v organizácii",
      everyoneNote: "prebije výber nižšie — inak by to isté znenie viselo v prehľade niekoľkokrát a nikto by nevedel, ktorý riadok niečo znamená",
      departmentNoteBefore: "Pridelenie oddelenia platí ",
      departmentNoteHighlight: "aj pre všetky podriadené",
      departmentNoteAfter: ". Číslo je počet ľudí vrátane nich — to je to, koho sa to naozaj týka.",
      noGroupsOrTracks: "V organizácii zatiaľ nie sú skupiny ani trasy. Skupiny sa zadávajú pri importe osôb (stĺpec „skupiny“) alebo príkazom",
      addresses: "Jednotlivé adresy",
      addressesNote: "Nepovinné. Oddeľ čiarkou alebo novým riadkom.",
      reason: "Dôvod",
      reasonPlaceholder: "napr. novela čl. 12 — mení sa lehota na podanie odvolania",
      reasonNote: "Povinný a spoločný pre celý výber. Je to jediné miesto, kde bude o rok napísané, prečo sa normy potvrdzovali znova — a príde aj v e-maile ľuďom.",
      submit: "Prideliť",
    },
    actions: {
      noAudience: "Nevybral si, komu sa prideľuje.",
      noDocument: "Nevybral si žiadny dokument s platným znením.",
      saveFailed: "Pridelenie sa nepodarilo uložiť. Skús to znova.",
      assigned: (count, documents, audiences) =>
        `Pridelené: ${count} (${documents} ${documents === 1 ? "norma" : documents < 5 ? "normy" : "noriem"}` +
        ` × ${audiences} ${audiences === 1 ? "publikum" : audiences < 5 ? "publiká" : "publík"}).`,
      assignedWithExisting: (count, documents, audiences, already) =>
        `Pridelené: ${count} (${documents} ${documents === 1 ? "norma" : documents < 5 ? "normy" : "noriem"}` +
        ` × ${audiences} ${audiences === 1 ? "publikum" : audiences < 5 ? "publiká" : "publík"}).` +
        ` ${already} už ${already === 1 ? "pridelené bolo" : already < 5 ? "pridelené boli" : "pridelených bolo"}` +
        " — nič sa nezdvojilo.",
      revoked: "Pridelenie odvolané. Záznam o ňom zostáva.",
      alreadyRevoked: "Toto pridelenie už neplatí.",
      nobodyToNotify: "Nie je komu poslať — potvrdili už všetci, kto v oddelení zostal.",
      tooManyRecipients: (recipients, max) =>
        `Príjemcov je ${recipients}, naraz sa dá poslať najviac ${max}. Rozdeľ pridelenie na menšie publiká.`,
      sent: (n) => `Odoslané ${n} ľuďom, ktorí ešte nepotvrdili.`,
      sentWithFailures: (n, failed) => `Odoslané ${n}. Nedoručiteľné: ${failed}`,
    },
  },

  tree: {
    saveOrder: "Uložiť poradie",
    cancel: "Zrušiť zmeny",
    hint: "Poradie sa zapíše až tlačidlom.",
  },

  tags: {
    empty: "Zatiaľ tu žiadne nie sú. Prvú vytvoríš dole.",
    add: "Pridať",
  },
  library: {
    list: {
      heading: "Knižnica",
      upload: "Nahrať dokument",
      introBefore: "Nahratý súbor sa prevedie na text, ktorý si ",
      introHighlight: "prečítaš a opravíš",
      introAfter: " — až potom sa publikuje. Prevod z PDF nikdy nie je dokonalý a je to znenie, ktoré budú ľudia potvrdzovať.",
      search: "Hľadať",
      searchPlaceholder: "názov alebo kľúč",
      category: "Druh",
      categoryField: "Druh dokumentu",
      tag: "Značka",
      status: "Stav",
      all: "— všetky —",
      statusPublished: "publikované",
      statusDrafts: "koncepty",
      filter: "Filtrovať",
      clearFilters: "zrušiť filtre",
      processing: {
        uploaded: "nahraté",
        converted: "prevedené, nepublikované",
        indexed: "vo vyhľadávaní",
        failed: "prevod zlyhal",
      },
      draft: "koncept",
      effectiveVersion: "platné znenie",
      versions: (n) => `${n} ${n === 1 ? "znenie" : n < 5 ? "znenia" : "znení"}`,
      nothingFound: "Nič sa nenašlo.",
      empty: "Zatiaľ tu nie je nič. Začni nahratím prvého dokumentu.",
    },
    folders: {
      heading: "Priečinky",
      allDocuments: "Všetky dokumenty",
      unfiled: "Nezaradené",
      edit: "upraviť",
      moveUp: (name) => `Posunúť ${name} vyššie`,
      up: "↑ vyššie",
      moveDown: (name) => `Posunúť ${name} nižšie`,
      down: "↓ nižšie",
      nameOf: (name) => `Názov priečinka ${name}`,
      rename: "Premenovať",
      parentOf: (name) => `Nadriadený priečinok pre ${name}`,
      topLevel: "— najvyššia úroveň —",
      move: "Presunúť",
      remove: "Zrušiť priečinok",
      removeHint: "Zrušiť sa dá až prázdny priečinok bez podpriečinkov.",
      newFolder: "Nový priečinok",
      newFolderName: "Názov nového priečinka",
      parentFolder: "Nadriadený priečinok",
      create: "Založiť",
    },
    upload: {
      back: "← Späť do knižnice",
      heading: "Nahrať dokument",
      intro: "Word, PDF, Excel, Markdown alebo text. Súbor sa uloží tak, ako prišiel — prevod je odvodenina a originál musí zostať, aby sa dalo overiť, z čoho text vznikol.",
      file: "Súbor",
      oldFormatsBefore: "Staré ",
      oldFormatsMiddle: " a ",
      oldFormatsAfter: " sa previesť nedajú — ulož ich vo Worde alebo Exceli ako novší formát. Skenované PDF bez textu sa dá dať prepísať jazykovým modelom až v editore.",
      title: "Názov",
      titlePlaceholder: "Súťažný poriadok futbalu SFZ",
      titleNote: "Objaví sa doslovne v potvrdzovacej formulke, takže nech je to celý úradný názov.",
      key: "Kľúč dokumentu",
      keyNoteBefore: "Malé písmená bez diakritiky a podčiarkovníky. Spolu s kódom organizácie tvorí identifikátor (",
      keyNoteAfterCode: ").",
      keyNoteHighlight: " Ten istý kľúč znamená ten istý dokument",
      keyNoteAfter: " — nahratie naň založí nové znenie, nie druhý dokument. Existujúce: ",
      scope: "Pôsobnosť",
      accessLevel: "Prístupnosť",
      accessInternalNote: " vidia len ľudia organizácie, ",
      accessPublicNote: " ktokoľvek prihlásený.",
      documentLanguage: "Jazyk dokumentu",
      documentLanguageNote: "Jazyk, v ktorom je norma napísaná. Nič neprekladáme — dokument v inom jazyku je samostatný dokument.",
      unset: "— neurčené —",
      tags: "Značky",
      newTag: "Nová značka",
      submit: "Nahrať a previesť",
    },
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
  hr: {
    overview: {
      heading: "Přidělené předpisy",
      intro: "Co bylo komu uloženo a kdo to už potvrdil. Počty se počítají při zobrazení — a týkají se lidí, kteří do skupiny patří",
      assign: "Přidělit předpis",
      empty: "Zatím není přiděleno nic. Dokud se předpis nepřidělí, lidem se objeví jen tehdy, když je krokem jejich trasy — a nikde nezůstane stopa, kdy se to stalo a proč.",
      acknowledged: "Potvrdili",
      notified: "Dali jsme vědět",
      no: "ne",
      nobody: "nikdo",
      missing: "Chybí",
      notifyByEmail: "Dát vědět e-mailem",
      revoke: "Odvolat přidělení",
    },
    detail: {
      back: "← Zpět na přehled",
      version: "verze",
      assignedBy: "přidělil",
      notAcknowledged: (missing, total) => `Nepotvrdili (${missing} z ${total})`,
      effectiveFrom: (date) => `, platná od ${date}`,
      notifyLink: "dát jim vědět e-mailem →",
      allAcknowledged: "Potvrdili všichni, kterých se přidělení dnes týká.",
      noLongerInDepartment: "už není v oddělení",
      note: "Seznam se počítá při zobrazení. Kdo z oddělení odešel bez potvrzení, zůstává tu označený — jinak by tiše zmizel a nikdo by se nedozvěděl, že se to nedořešilo; e-mail se mu ale neposílá. Kdo odešel z celé organizace, tu není — jeho potvrzení (nebo jeho chybění) však zůstává v záznamech.",
    },
    notify: {
      back: "← Zpět na detail",
      heading: "Dát vědět e-mailem",
      introBefore: "Pošle se ",
      introHighlight: "jen těm, kteří ještě nepotvrdili",
      introAfter: ". Kdo to už má za sebou, by dostal připomínku něčeho, co udělal — a to je přesně ten druh pošty, po kterém si lidé zapnou filtr.",
      lastSent: (date, count) => `Naposledy odesláno ${date} (${count} ${count === 1 ? "člověku" : "lidem"})`,
      lastSentTotal: (times) => ` · celkem ${times}×`,
      to: (n) => `Komu (${n})`,
      allAcknowledged: (audience) => `Potvrdili už všichni, kterých se ${audience} týká. Není komu poslat.`,
      formerMembers: (n) => `Další ${n} nepotvrdili, ale z oddělení už odešli — těm se nepíše. Vidět je lze na`,
      formerMembersLink: "detailu přidělení",
      preview: "Co jim přijde",
      previewSubject: (subject) => `Předmět: ${subject} · Každý ho dostane ve svém jazyce.`,
      send: (n) => `Odeslat ${n} ${n === 1 ? "e-mail" : n < 5 ? "e-maily" : "e-mailů"}`,
    },
    assign: {
      back: "← Zpět na přehled",
      heading: "Přidělit předpisy",
      introBefore: "Přiděluje se ",
      introHighlight: "konkrétní znění",
      introAfter: ", ne dokument. Když přibude novější, staré přidělení pro ně neplatí — to je záměr.",
      noEffectiveVersion: "Žádný dokument nemá platné znění, takže přidělit nelze nic. Znění bez data platnosti nelze ani potvrdit (D6).",
      whichDocuments: "Které předpisy",
      versionLine: (label, date) => `verze ${label}, platná od ${date}`,
      to: "Komu",
      departments: "Oddělení",
      groups: "Skupiny",
      tracks: "Trasy",
      everyone: "Všem v organizaci",
      everyoneNote: "přebije výběr níže — jinak by totéž znění viselo v přehledu několikrát a nikdo by nevěděl, který řádek něco znamená",
      departmentNoteBefore: "Přidělení oddělení platí ",
      departmentNoteHighlight: "i pro všechna podřízená",
      departmentNoteAfter: ". Číslo je počet lidí včetně nich — to je to, koho se to opravdu týká.",
      noGroupsOrTracks: "V organizaci zatím nejsou skupiny ani trasy. Skupiny se zadávají při importu osob (sloupec „skupiny“) nebo příkazem",
      addresses: "Jednotlivé adresy",
      addressesNote: "Nepovinné. Odděl čárkou nebo novým řádkem.",
      reason: "Důvod",
      reasonPlaceholder: "např. novela čl. 12 — mění se lhůta pro podání odvolání",
      reasonNote: "Povinný a společný pro celý výběr. Je to jediné místo, kde bude za rok napsáno, proč se předpisy potvrzovaly znovu — a přijde i v e-mailu lidem.",
      submit: "Přidělit",
    },
    actions: {
      noAudience: "Nevybral jsi, komu se přiděluje.",
      noDocument: "Nevybral jsi žádný dokument s platným zněním.",
      saveFailed: "Přidělení se nepodařilo uložit. Zkus to znovu.",
      assigned: (count, documents, audiences) =>
        `Přiděleno: ${count} (${documents} ${documents === 1 ? "předpis" : documents < 5 ? "předpisy" : "předpisů"}` +
        ` × ${audiences} ${audiences === 1 ? "publikum" : audiences < 5 ? "publika" : "publik"}).`,
      assignedWithExisting: (count, documents, audiences, already) =>
        `Přiděleno: ${count} (${documents} ${documents === 1 ? "předpis" : documents < 5 ? "předpisy" : "předpisů"}` +
        ` × ${audiences} ${audiences === 1 ? "publikum" : audiences < 5 ? "publika" : "publik"}).` +
        ` ${already} už ${already === 1 ? "přidělené bylo" : already < 5 ? "přidělená byla" : "přidělených bylo"}` +
        " — nic se nezdvojilo.",
      revoked: "Přidělení odvoláno. Záznam o něm zůstává.",
      alreadyRevoked: "Toto přidělení už neplatí.",
      nobodyToNotify: "Není komu poslat — potvrdili už všichni, kdo v oddělení zůstal.",
      tooManyRecipients: (recipients, max) =>
        `Příjemců je ${recipients}, najednou lze poslat nejvýše ${max}. Rozděl přidělení na menší publika.`,
      sent: (n) => `Odesláno ${n} lidem, kteří ještě nepotvrdili.`,
      sentWithFailures: (n, failed) => `Odesláno ${n}. Nedoručitelné: ${failed}`,
    },
  },

  tree: {
    saveOrder: "Uložit pořadí",
    cancel: "Zrušit změny",
    hint: "Pořadí se zapíše až tlačítkem.",
  },

  tags: {
    empty: "Zatím tu žádné nejsou. První vytvoříš dole.",
    add: "Přidat",
  },
  library: {
    list: {
      heading: "Knihovna",
      upload: "Nahrát dokument",
      introBefore: "Nahraný soubor se převede na text, který si ",
      introHighlight: "přečteš a opravíš",
      introAfter: " — teprve pak se publikuje. Převod z PDF nikdy není dokonalý a je to znění, které budou lidé potvrzovat.",
      search: "Hledat",
      searchPlaceholder: "název nebo klíč",
      category: "Druh",
      categoryField: "Druh dokumentu",
      tag: "Značka",
      status: "Stav",
      all: "— všechny —",
      statusPublished: "publikované",
      statusDrafts: "koncepty",
      filter: "Filtrovat",
      clearFilters: "zrušit filtry",
      processing: {
        uploaded: "nahráno",
        converted: "převedeno, nepublikováno",
        indexed: "ve vyhledávání",
        failed: "převod selhal",
      },
      draft: "koncept",
      effectiveVersion: "platné znění",
      versions: (n) => `${n} ${n === 1 ? "znění" : n < 5 ? "znění" : "znění"}`,
      nothingFound: "Nic se nenašlo.",
      empty: "Zatím tu nic není. Začni nahráním prvního dokumentu.",
    },
    folders: {
      heading: "Složky",
      allDocuments: "Všechny dokumenty",
      unfiled: "Nezařazené",
      edit: "upravit",
      moveUp: (name) => `Posunout ${name} výš`,
      up: "↑ výš",
      moveDown: (name) => `Posunout ${name} níž`,
      down: "↓ níž",
      nameOf: (name) => `Název složky ${name}`,
      rename: "Přejmenovat",
      parentOf: (name) => `Nadřazená složka pro ${name}`,
      topLevel: "— nejvyšší úroveň —",
      move: "Přesunout",
      remove: "Zrušit složku",
      removeHint: "Zrušit lze jen prázdnou složku bez podsložek.",
      newFolder: "Nová složka",
      newFolderName: "Název nové složky",
      parentFolder: "Nadřazená složka",
      create: "Založit",
    },
    upload: {
      back: "← Zpět do knihovny",
      heading: "Nahrát dokument",
      intro: "Word, PDF, Excel, Markdown nebo text. Soubor se uloží tak, jak přišel — převod je odvozenina a originál musí zůstat, aby šlo ověřit, z čeho text vznikl.",
      file: "Soubor",
      oldFormatsBefore: "Staré ",
      oldFormatsMiddle: " a ",
      oldFormatsAfter: " převést nelze — ulož je ve Wordu nebo Excelu jako novější formát. Skenované PDF bez textu lze nechat přepsat jazykovým modelem až v editoru.",
      title: "Název",
      titlePlaceholder: "Súťažný poriadok futbalu SFZ",
      titleNote: "Objeví se doslovně v potvrzovací formulaci, ať je to tedy celý úřední název.",
      key: "Klíč dokumentu",
      keyNoteBefore: "Malá písmena bez diakritiky a podtržítka. Spolu s kódem organizace tvoří identifikátor (",
      keyNoteAfterCode: ").",
      keyNoteHighlight: " Týž klíč znamená týž dokument",
      keyNoteAfter: " — nahrání na něj založí nové znění, ne druhý dokument. Existující: ",
      scope: "Působnost",
      accessLevel: "Přístupnost",
      accessInternalNote: " vidí jen lidé organizace, ",
      accessPublicNote: " kdokoli přihlášený.",
      documentLanguage: "Jazyk dokumentu",
      documentLanguageNote: "Jazyk, ve kterém je předpis napsán. Nic nepřekládáme — dokument v jiném jazyce je samostatný dokument.",
      unset: "— neurčeno —",
      tags: "Značky",
      newTag: "Nová značka",
      submit: "Nahrát a převést",
    },
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
  hr: {
    overview: {
      heading: "Assigned documents",
      intro: "What has been assigned to whom and who has already acknowledged it. The counts are computed when the page is opened — and cover the people who belong to the group",
      assign: "Assign a document",
      empty: "Nothing has been assigned yet. Until a document is assigned, people only see it when it is a step on their track — and nothing records when that happened or why.",
      acknowledged: "Acknowledged",
      notified: "Notified",
      no: "no",
      nobody: "nobody",
      missing: "Missing",
      notifyByEmail: "Notify by e-mail",
      revoke: "Revoke assignment",
    },
    detail: {
      back: "← Back to the overview",
      version: "version",
      assignedBy: "assigned by",
      notAcknowledged: (missing, total) => `Not acknowledged (${missing} of ${total})`,
      effectiveFrom: (date) => `, effective from ${date}`,
      notifyLink: "notify them by e-mail →",
      allAcknowledged: "Everyone the assignment applies to today has acknowledged it.",
      noLongerInDepartment: "no longer in the department",
      note: "The list is computed when the page is opened. Anyone who left the department without acknowledging stays here, marked — otherwise they would quietly disappear and nobody would learn it was left unresolved; they are not e-mailed, though. Anyone who left the organisation altogether is not here — but their acknowledgement (or the lack of it) stays in the records.",
    },
    notify: {
      back: "← Back to the detail",
      heading: "Notify by e-mail",
      introBefore: "It goes ",
      introHighlight: "only to those who have not acknowledged yet",
      introAfter: ". Anyone who is done would get a reminder about something they already did — and that is exactly the kind of mail people set up filters for.",
      lastSent: (date, count) => `Last sent ${date} (to ${count} ${count === 1 ? "person" : "people"})`,
      lastSentTotal: (times) => ` · ${times} times in total`,
      to: (n) => `Recipients (${n})`,
      allAcknowledged: (audience) => `Everyone the ${audience} covers has already acknowledged. There is nobody to send to.`,
      formerMembers: (n) => `Another ${n} have not acknowledged but have already left the department — they are not written to. You can see them on the`,
      formerMembersLink: "assignment detail",
      preview: "What they will receive",
      previewSubject: (subject) => `Subject: ${subject} · Each person gets it in their own language.`,
      send: (n) => `Send ${n} ${n === 1 ? "e-mail" : "e-mails"}`,
    },
    assign: {
      back: "← Back to the overview",
      heading: "Assign documents",
      introBefore: "What is assigned is ",
      introHighlight: "a specific version",
      introAfter: ", not a document. When a newer one is issued, the old assignment does not carry over to it — that is deliberate.",
      noEffectiveVersion: "No document has an effective version, so there is nothing to assign. A version without an effective date cannot be acknowledged either (D6).",
      whichDocuments: "Which documents",
      versionLine: (label, date) => `version ${label}, effective from ${date}`,
      to: "Recipients",
      departments: "Departments",
      groups: "Groups",
      tracks: "Tracks",
      everyone: "Everyone in the organisation",
      everyoneNote: "overrides the selection below — otherwise the same version would appear in the overview several times and nobody would know which row meant anything",
      departmentNoteBefore: "Assigning to a department also applies ",
      departmentNoteHighlight: "to every department below it",
      departmentNoteAfter: ". The number counts those people too — that is who it actually reaches.",
      noGroupsOrTracks: "The organisation has no groups or tracks yet. Groups are set when importing people (the “groups” column) or with the command",
      addresses: "Individual addresses",
      addressesNote: "Optional. Separate with a comma or a new line.",
      reason: "Reason",
      reasonPlaceholder: "e.g. amendment to Article 12 — the deadline for an appeal changes",
      reasonNote: "Required, and shared by the whole selection. It is the only place where, a year from now, it will say why these documents had to be acknowledged again — and it goes out in the e-mail as well.",
      submit: "Assign",
    },
    actions: {
      noAudience: "You did not choose who to assign to.",
      noDocument: "You did not choose any document with an effective version.",
      saveFailed: "The assignment could not be saved. Please try again.",
      assigned: (count, documents, audiences) =>
        `Assigned: ${count} (${documents} ${documents === 1 ? "document" : "documents"}` +
        ` × ${audiences} ${audiences === 1 ? "audience" : "audiences"}).`,
      assignedWithExisting: (count, documents, audiences, already) =>
        `Assigned: ${count} (${documents} ${documents === 1 ? "document" : "documents"}` +
        ` × ${audiences} ${audiences === 1 ? "audience" : "audiences"}).` +
        ` ${already} had already been assigned — nothing was duplicated.`,
      revoked: "Assignment revoked. The record of it stays.",
      alreadyRevoked: "This assignment is no longer in force.",
      nobodyToNotify: "There is nobody to send to — everyone still in the department has acknowledged.",
      tooManyRecipients: (recipients, max) =>
        `There are ${recipients} recipients; at most ${max} can be sent at once. Split the assignment into smaller audiences.`,
      sent: (n) => `Sent to ${n} people who have not acknowledged yet.`,
      sentWithFailures: (n, failed) => `Sent ${n}. Undeliverable: ${failed}`,
    },
  },

  tree: {
    saveOrder: "Save order",
    cancel: "Discard changes",
    hint: "The order is written only when you press the button.",
  },

  tags: {
    empty: "There are none yet. Create the first one below.",
    add: "Add",
  },
  library: {
    list: {
      heading: "Library",
      upload: "Upload a document",
      introBefore: "An uploaded file is converted into text that you ",
      introHighlight: "read and correct",
      introAfter: " — only then is it published. Conversion from PDF is never perfect, and this is the wording people will be acknowledging.",
      search: "Search",
      searchPlaceholder: "title or key",
      category: "Category",
      categoryField: "Document category",
      tag: "Tag",
      status: "Status",
      all: "— all —",
      statusPublished: "published",
      statusDrafts: "drafts",
      filter: "Filter",
      clearFilters: "clear filters",
      processing: {
        uploaded: "uploaded",
        converted: "converted, not published",
        indexed: "in search",
        failed: "conversion failed",
      },
      draft: "draft",
      effectiveVersion: "effective version",
      versions: (n) => `${n} ${n === 1 ? "version" : "versions"}`,
      nothingFound: "Nothing found.",
      empty: "There is nothing here yet. Start by uploading the first document.",
    },
    folders: {
      heading: "Folders",
      allDocuments: "All documents",
      unfiled: "Unfiled",
      edit: "edit",
      moveUp: (name) => `Move ${name} up`,
      up: "↑ up",
      moveDown: (name) => `Move ${name} down`,
      down: "↓ down",
      nameOf: (name) => `Name of folder ${name}`,
      rename: "Rename",
      parentOf: (name) => `Parent folder for ${name}`,
      topLevel: "— top level —",
      move: "Move",
      remove: "Delete folder",
      removeHint: "Only an empty folder with no subfolders can be deleted.",
      newFolder: "New folder",
      newFolderName: "Name of the new folder",
      parentFolder: "Parent folder",
      create: "Create",
    },
    upload: {
      back: "← Back to the library",
      heading: "Upload a document",
      intro: "Word, PDF, Excel, Markdown or plain text. The file is stored exactly as it arrived — the conversion is derived from it, and the original has to stay so it can be checked what the text came from.",
      file: "File",
      oldFormatsBefore: "Legacy ",
      oldFormatsMiddle: " and ",
      oldFormatsAfter: " cannot be converted — save them from Word or Excel in a newer format. A scanned PDF with no text layer can be transcribed by the language model later, in the editor.",
      title: "Title",
      titlePlaceholder: "Súťažný poriadok futbalu SFZ",
      titleNote: "It appears verbatim in the acknowledgement statement, so use the full official title.",
      key: "Document key",
      keyNoteBefore: "Lower-case letters without diacritics, and underscores. Together with the organisation code it forms the identifier (",
      keyNoteAfterCode: ").",
      keyNoteHighlight: " The same key means the same document",
      keyNoteAfter: " — uploading to it creates a new version, not a second document. Existing: ",
      scope: "Scope",
      accessLevel: "Access level",
      accessInternalNote: " is visible only to people of the organisation, ",
      accessPublicNote: " to anyone signed in.",
      documentLanguage: "Document language",
      documentLanguageNote: "The language the document is written in. We translate nothing — a document in another language is a separate document.",
      unset: "— unset —",
      tags: "Tags",
      newTag: "New tag",
      submit: "Upload and convert",
    },
  },
  },
}

/** Slovník pre daný jazyk; pri neznámom padá na predvolený, nikdy nespadne. */
export function dictionary(language: unknown): Dictionary {
  return DICTIONARY[normalizeLanguage(language)]
}
