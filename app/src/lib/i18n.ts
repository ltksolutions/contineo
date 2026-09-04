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

import { AppError } from "./appError"

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
    metaTitle: string
    metaDescription: string
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
    noResults: string
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
  /** Výpis auditu — používa ho nastavenie organizácie aj `/admin`. */
  /** Správa tenantov — vidí ju len správca platformy (Fáza 5b). */
  /** Zlatá sada — overovanie kvality odpovedí (D9). */
  goldenSet: {
    heading: string
    intro: string
    reviewedLabel: string
    doneOf: (done: number, total: number) => string
    correct: string
    incorrect: string
    withHallucination: string
    excluded: string
    overlapCount: (done: number, total: number) => string
    overlapNote: string
    /** Oblasť otázky — kľúče sú hodnoty z `goldenSet.ts`. */
    areas: Record<string, string>
    badges: {
      trap: (type: string) => string
      edited: string
      reviewedByTwo: string
      waitingForSecond: string
      forTwo: string
      hallucination: string
      excluded: string
      correct: string
      incorrect: string
      disagreement: string
      waitingForYou: string
      reviewed: string
      notReviewed: string
    }
    detail: {
      back: string
      saving: string
      saved: string
      saveFailed: string
      twoReviewersHeading: string
      twoReviewersNote: string
      othersHeading: string
      verdict: Record<string, string>
      trapHeading: string
      trapBeforeBehaviour: string
      trapAfterBehaviour: string
      /** Druh pasce — kľúče sú hodnoty z databázy. */
      traps: Record<string, string>
      /** Očakávané správanie systému. */
      behaviours: Record<string, string>
      excludedHeading: string
      returnToSet: string
      editLabel: string
      saveText: string
      cancel: string
      restoreOriginal: string
      originally: (text: string) => string
      edit: string
      nextQuestion: string
      excludeQuestion: string
      excludePrompt: string
    }
    rating: {
      heading: string
      saving: string
      saved: string
      saveFailed: string
      correctQuestion: string
      yes: string
      no: string
      hallucinationQuestion: string
      yesInvented: string
      noGrounded: string
      showDetail: string
      hideDetail: string
      expectedAnswer: string
      sources: string
      note: string
    }
  }
  admin: {
    list: {
      heading: string
      intro: string
      newTenant: string
      disabled: string
      noDomain: string
      people: string
      peopleValue: (signedIn: number, total: number) => string
      tracks: string
      documents: string
      documentsValue: (valid: number, total: number) => string
      acknowledgements: string
      withoutVersion: string
      instructionsSent: (when: string, to: string) => string
      domainsNoteBefore: string
      domainsNoteAfter: string
    }
    create: {
      back: string
      heading: string
      /** Veta okolo `contineo.app` a `CNAME` — tie zostávajú v JSX. */
      introBefore: string
      introMiddle: string
      introAfter: string
      code: string
      codeNoteBefore: string
      codeNoteHighlight: string
      codeNoteAfter: string
      name: string
      nameNote: string
      supportEmail: string
      supportEmailNote: string
      domains: string
      domainsPlaceholder: string
      domainsNote: string
      submit: string
    }
    detail: {
      back: string
      disabled: string
      domainsHeading: string
      nothingNeeded: (host: string, reason: string) => string
      notInVercel: string
      waitingForCustomer: string
      conflicts: (list: string) => string
      configuredVia: (via: string) => string
      unverified: string
      sendTo: string
      sendHint: (n: number) => string
      send: string
      brandingHeading: string
      displayName: string
      shortName: string
      logo: string
      logoCurrent: string
      logoNote: string
      color: string
      colorNote: string
      supportEmail: string
      supportEmailNote: string
      languages: string
      defaultLanguage: string
      defaultLanguageNote: string
      domains: string
      domainsNote: string
      autoProvision: string
      autoProvisionBefore: string
      autoProvisionHighlight: string
      autoProvisionAfter: string
      save: string
      disableHeading: string
      enableHeading: string
      disableNote: string
      confirmLabel: (code: string) => string
      confirmHint: string
      disable: string
      enable: string
      auditHeading: string
      auditNote: string
    }
    signIn: {
      heading: (provider: string) => string
      state: Record<string, string>
      stateLong: Record<string, string>
      callback: string
      clientId: string
      clientSecret: string
      clientSecretHint: string
      tenantMode: string
      tenantModeHint: string
      allowedTenantIds: string
      allowedTenantIdsHint: string
      hostedDomain: string
      hostedDomainHint: string
      save: string
      deleteNote: string
      confirmLabel: (code: string) => string
      deleteSubmit: string
    }
    actions: {
      failed: string
      addedToVercel: (host: string) => string
      missingVercelToken: (host: string) => string
      saved: string
      confirmCodeToDisable: (code: string) => string
      enabled: string
      disabled: string
      created: string
      noContact: string
      nothingToSend: string
      instructionsSent: (hosts: string, to: string) => string
      signInSaved: (provider: string) => string
      confirmCodeToDelete: (code: string) => string
      signInRemoved: (provider: string) => string
    }
  }
  /**
   * Chybové hlášky podľa kódu z `AppError`.
   *
   * Kľúč je kód, hodnota veta. Miesta na dosadenie sú `{meno}` — skladá ich
   * `errorText()`, nie volajúci: poradie slov je v každom jazyku iné.
   */
  errors: Record<string, string>
  audit: {
    empty: string
    subjects: Record<string, string>
    actions: Record<string, string>
    fields: Record<string, string>
    none: string
  }
  /** Paleta doplnkovej farby. Kľúč je hodnota v hex. */
  colors: {
    palette: Record<string, string>
    showCustom: string
    hideCustom: string
  }
  org: {
    heading: string
    introBefore: string
    introAfter: string
    tabsLabel: string
    tabs: Record<string, string>
    branding: {
      name: string
      nameNote: string
      shortName: string
      shortNameNote: string
      logo: string
      logoCurrent: string
      logoNote: string
      color: string
      colorNote: string
      supportEmail: string
      supportEmailNote: string
      languages: string
      defaultLanguage: string
      defaultLanguageNote: string
      autoProvision: string
      autoProvisionBefore: string
      autoProvisionHighlight: string
      autoProvisionAfter: string
      save: string
    }
    departments: {
      heading: string
      introBefore: string
      introHighlight: string
      introMiddle: string
      groupsLink: string
      introAfter: string
      empty: string
      withDescendants: (n: number) => string
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
      newHeading: string
      name: string
      namePlaceholder: string
      parent: string
      maxDepth: (n: number) => string
      create: string
    }
    domains: {
      works: string
      remove: string
      waitingDns: string
      since: (date: string) => string
      dnsBefore: string
      dnsMiddle: string
      verify: string
      cancelRequest: string
      add: string
      hostPlaceholder: string
      addNote: string
      request: string
    }
    signIn: {
      heading: (provider: string) => string
      stateOn: string
      stateFromSupplier: string
      stateUnreadable: string
      stateOff: string
      introBefore: string
      introHighlight: (provider: string) => string
      introAfter: string
      callback: string
      clientId: string
      clientSecret: string
      clientSecretNote: string
      tenantMode: string
      tenantModeBefore: string
      tenantModeHighlight: string
      tenantModeAfter: string
      allowedTenantIds: string
      allowedTenantIdsNote: string
      hostedDomain: string
      save: string
      deleteNote: string
      confirmLabel: (code: string) => string
      deleteSubmit: string
    }
    codelists: {
      introBefore: string
      introHighlight: string
      introAfter: string
      labels: Record<string, { name: string; hint: string }>
      base: string
      used: (n: number) => string
      remove: string
      newItemPlaceholder: string
      newItemLabel: (codelist: string) => string
      key: string
      keyPlaceholder: string
      add: string
      keyNote: string
    }
    chunking: {
      heading: string
      introBefore: string
      introHighlight: string
      introAfter: string
      articleWord: string
      /** Veta okolo ukážok `Článok`, `§` a `Bod` — tie zostávajú v JSX. */
      articleNote1: string
      articleNote2: string
      articleNote3: string
      articleNote4: string
      articleNoteHighlight: string
      articleNote5: string
      annexWord: string
      annexWordNote: string
      headerRepeats: string
      headerRepeatsNote: string
      minTokens: string
      maxTokens: string
      tokensNoteBefore: string
      tokensNoteAfter: string
      saveNoteBefore: string
      saveNoteHighlight: string
      saveNoteMiddle: string
      saveNoteButton: string
      saveNoteAfter: string
      save: string
      reindexAllHeading: string
      allUpToDate: (total: number) => string
      outdatedOf: (total: number) => string
      outdatedHighlight: string
      outdatedAfter: string
      batchNote: string
      reindexAll: (n: number) => string
    }
    /** Hlásenia serverových akcií nastavenia organizácie. */
    actions: {
      saved: string
      failed: string
      confirmCode: (code: string) => string
      signInRemoved: string
      domainRequested: string
      domainNotFound: string
      domainWaiting: (host: string) => string
      domainOnNotInVercel: (host: string) => string
      domainOn: (host: string) => string
      domainRemoved: string
      codelistRemoved: string
      chunkingSaved: string
      reindexedCount: (n: number) => string
      reindexSkipped: (n: number) => string
      reindexRemaining: (n: number) => string
      reindexErrors: (list: string) => string
    }
    auditTab: {
      introBefore: string
      introHighlight: string
      introAfter: string
      search: string
      searchPlaceholder: string
      searchSubmit: string
      clearFilter: string
      capped: string
    }
  }
  people: {
    /** Typ osoby — kľúče sú hodnoty z databázy. */
    types: Record<string, string>
    /** Jazyk prostredia — kľúče sú kódy z `UI_LANGUAGES`. */
    languages: Record<string, string>
    /** Roly — kľúč je názov roly, hodnota celý riadok aj s vysvetlením. */
    roles: Record<string, string>
    list: {
      heading: string
      introBefore: string
      introHighlight: string
      introAfter: string
      invite: string
      importCsv: string
      searchPlaceholder: string
      nothingFound: string
      count: (n: number) => string
      matchesSearch: string
      capped: string
      status: Record<string, string>
      neverSignedIn: string
    }
    invite: {
      back: string
      heading: string
      introBefore: string
      introAfter: string
      email: string
      emailNote: string
      fullName: string
      department: string
      personType: string
      language: string
      languageNote: string
      submit: string
    }
    import: {
      back: string
      heading: string
      introBefore: string
      introHighlight: string
      introMiddle: string
      introAfter: string
      file: string
      /** Veta okolo zoznamu hlavičiek CSV — tie sa neprekladajú. */
      fileNoteBefore: string
      fileNoteAfter: string
      reading: string
      whatHappens: (name: string) => string
      rows: string
      willAdd: string
      willUpdate: string
      invalid: string
      added: string
      andMore: (n: number) => string
      skippedRows: string
      statusNoteBefore: string
      statusNoteHighlight: string
      statusNoteAfter: string
      write: string
      writing: string
      /** Dôvod, prečo sa riadok preskočí — kľúče sú kódy z `personsImport`. */
      reasons: Record<string, string>
    }
    detail: {
      back: string
      previously: (list: string) => string
      invitedNotSignedIn: string
      excludedNoSignIn: string
      lastSeen: (when: string) => string
      never: string
      signsInVia: (list: string) => string
      email: string
      emailNote: string
      fullName: string
      jobTitle: string
      jobTitleNote: string
      department: string
      departmentNone: string
      /** Veta s odkazom do nastavenia organizácie. */
      noDepartmentsBefore: string
      noDepartmentsLink: string
      noDepartmentsAfter: string
      departmentNote: string
      placement: (path: string) => string
      legacyDepartmentBefore: string
      legacyDepartmentAfter: string
      personType: string
      personTypeNote: string
      language: string
      languageNote: string
      groups: string
      newGroup: string
      groupsNote: string
      tracks: string
      newTrack: string
      roles: string
      rolesNote: string
      save: string
      returnHeading: string
      excludeHeading: string
      returnNoteBefore: string
      returnNoteHighlight: string
      returnNoteAfter: string
      returnSubmit: string
      excludeNote: string
      confirmLabel: string
      confirmNote: string
      excludeSubmit: string
    }
    actions: {
      saved: string
      invited: string
      excluded: string
      returned: string
      confirmAddress: (email: string) => string
      failed: string
      noRight: string
      fileEmpty: string
      noRows: string
      importResult: (created: number, updated: number, unchanged: number, invalid: number) => string
    }
  },
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
    detail: {
      back: string
      documentData: string
      title: string
      titleNote: string
      scope: string
      accessLevel: string
      documentLanguage: string
      category: string
      unset: string
      tags: string
      newTag: string
      /** Veta okolo kľúča dokumentu — `<code>` zostáva v JSX. */
      keyNoteBefore: string
      keyNoteAfter: string
      save: string
      folder: string
      folderUnfiled: string
      folderNote: string
      assign: string
      text: string
      openEditor: string
      originalFile: string
      uploadedBy: (who: string, when: string) => string
      conversionMethod: (method: string) => string
      noOriginal: string
      draftDiffers: string
      draftSame: string
      draftEmpty: string
      publishHeading: string
      nothingToPublish: string
      versionLabel: string
      versionLabelPlaceholder: string
      /** Veta okolo zvýrazneného „doslovne v každom zázname“. */
      labelNoteBefore: string
      labelNoteHighlight: string
      labelNoteAfter: string
      effectiveFrom: string
      effectiveFromNote: string
      effectiveFromSource: string
      effectiveFromSourcePlaceholder: string
      effectiveFromSourceNote: string
      changeNote: string
      changeNotePlaceholder: string
      publish: string
      reindexHeading: string
      reindexNoteBefore: string
      reindexNoteHighlight: string
      reindexNoteAfter: string
      reindex: string
      versionsHeading: (n: number) => string
      nothingPublished: string
      active: string
      archived: string
      effectiveFromOn: (date: string) => string
      noEffectiveDate: string
      effectiveTo: (date: string) => string
      dateSource: (source: string) => string
      fix: string
      fixLabel: string
      fixEffectiveFromNoteBefore: string
      fixEffectiveFromNoteHighlight: string
      fixEffectiveFromNoteAfter: string
      fixReason: string
      fixReasonPlaceholder: string
      fixReasonNote: string
      onDateChange: string
      onDateChangeAsk: string
      onDateChangeCorrection: string
      onDateChangeReacknowledge: string
      fixSubmit: string
    }
    editor: {
      back: string
      intro: string
      modelDraft: string
      modeRewriteScan: string
      modeClean: string
      draftMeta: (model: string, when: string, chars: number) => string
      draftNoteBefore: string
      draftNoteHighlight: string
      draftNoteAfter: string
      useAsDraft: string
      discard: string
      original: string
      pdfNotShown: string
      openInNewWindow: string
      fileNotShown: (name: string) => string
      download: string
      compareAfterDownload: string
      noOriginal: string
      text: string
      switchNoteBefore: string
      switchNoteModes: string
      switchNoteAfter: string
      saveText: string
      llmHeading: string
      llmNoteBefore: string
      llmNoteHighlight: string
      llmNoteAfter: string
      clean: string
      rewriteScan: string
      rewriteScanNote: string
    }
    /** Hlásenia serverových akcií — chodia späť cez `?msg=`. */
    actions: {
      converted: string
      convertedWithWarnings: (warnings: string) => string
      saved: string
      changesSaved: string
      alreadyPublished: string
      published: (chunks: number, archived: number) => string
      modelReturnedDraft: string
      draftAccepted: string
      draftDiscarded: string
      assigned: string
      reindexUpToDate: string
      reindexed: (chunks: number, archived: number) => string
      fixedNeedsReacknowledge: (people: number) => string
      fixed: string
      failed: string
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
    metaTitle: "Contineo — testovacie rozhranie",
    metaDescription: "Overovanie kvality odpovedí nad normami a smernicami.",
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
    noResults: "Nenašiel som relevantné informácie k vašej otázke v dostupných dokumentoch.",
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
  goldenSet: {
    heading: "Zlatá sada",
    intro: "Otázky sú návrhy. Ak niektorá nedáva zmysel alebo znie neprirodzene, upravte ju alebo vyraďte — to je rovnako cenná informácia ako posudok odpovede.",
    reviewedLabel: "Posúdených",
    doneOf: (done, total) => `${done} zo ${total}`,
    correct: "správnych",
    incorrect: "nesprávnych",
    withHallucination: "s halucináciou",
    excluded: "vyradených",
    overlapCount: (done, total) => `${done} z ${total}`,
    overlapNote: " otázok na precedenciu a pasce má posudok od dvoch ľudí. Pri nich sa cudzí posudok ukáže až potom, ako ich posúdite sami — inak by miera zhody merala len to, či ste prvému uverili.",
    areas: {
      pravo: "právo",
      prevadzka: "prevádzka",
      oboje: "ktokoľvek",
    },
    badges: {
      trap: (type) => `pasca · ${type}`,
      edited: "upravená",
      reviewedByTwo: "posúdili dvaja",
      waitingForSecond: "čaká na druhého",
      forTwo: "pre dvoch",
      hallucination: "halucinácia",
      excluded: "vyradená",
      correct: "správna",
      incorrect: "nesprávna",
      disagreement: "nezhoda",
      waitingForYou: "čaká na vás",
      reviewed: "posúdená",
      notReviewed: "neposúdená",
    },
    detail: {
      back: "← Späť na zoznam",
      saving: "ukladám…",
      saved: "uložené",
      saveFailed: "neuložilo sa",
      twoReviewersHeading: "Túto otázku posudzujú dvaja nezávisle.",
      twoReviewersNote: "Ak ju už niekto posúdil, jeho záver uvidíte až po tom, ako sa vyjadríte sami. Nejde o tajnostkárstvo — keby ste ho videli vopred, merali by sme, či ste mu uverili, nie či sa zhodnete.",
      othersHeading: "Ako to posúdili ostatní",
      verdict: {
        correct: "správna",
        incorrect: "nesprávna",
        none: "neposúdené",
      },
      trapHeading: "Toto je zámerná skúška.",
      trapBeforeBehaviour: " Systém tu ",
      trapAfterBehaviour: " — posudzujte, či sa zachoval takto, nie či odpovedal vyčerpávajúco.",
      traps: {
        out_of_domain: "Otázka je mimo nahraných dokumentov. Systém má odmietnuť, nie odpovedať.",
        ambiguous_conflict: "Predpisy si tu odporujú. Systém nemá rozhodnúť autoritatívne — má na rozpor upozorniť a ponúknuť eskaláciu, lebo výklad patrí človeku.",
        access_control: "Pýta sa verejný používateľ na interný obsah. Systém ho nesmie prezradiť.",
        historical_version: "Otázka mieri na staršie znenie. Systém má citovať verziu platnú v danom čase, nie dnešnú.",
      },
      behaviours: {
        answer: "má odpovedať vecne",
        refuse: "má odmietnuť",
        escalate: "má ponúknuť eskaláciu",
      },
      excludedHeading: "Otázka je vyradená.",
      returnToSet: "Vrátiť do sady",
      editLabel: "Znenie otázky — napíšte ju tak, ako by sa spýtal skutočný človek.",
      saveText: "Uložiť znenie",
      cancel: "Zrušiť",
      restoreOriginal: "Vrátiť pôvodné",
      originally: (text) => `pôvodne: „${text}“`,
      edit: "Upraviť",
      nextQuestion: "Ďalšia otázka →",
      excludeQuestion: "Vyradiť otázku",
      excludePrompt: "Prečo otázka nedáva zmysel?",
    },
    rating: {
      heading: "Ako hodnotíte túto odpoveď?",
      saving: "ukladám…",
      saved: "uložené",
      saveFailed: "neuložilo sa",
      correctQuestion: "Je odpoveď vecne správna?",
      yes: "Áno",
      no: "Nie",
      hallucinationQuestion: "Tvrdí niečo, čo v zdrojoch nie je?",
      yesInvented: "Áno, vymyslel si",
      noGrounded: "Nie, všetko má oporu",
      showDetail: "Doplniť správnu odpoveď a §",
      hideDetail: "Skryť doplnenie",
      expectedAnswer: "Ako mala odpoveď znieť?",
      sources: "Ktoré predpisy a § to upravujú? Napríklad „SP čl. 78, DP čl. 37“.",
      note: "Poznámka — čo bolo na odpovedi zavádzajúce alebo neúplné?",
    },
  },
  admin: {
    list: {
      heading: "Správa tenantov",
      intro: "Prehľad organizácií na platforme. Čísla sa počítajú pri zobrazení, nikde sa neukladajú. Obsah organizácií — dokumenty a potvrdenia — táto rola nesprístupňuje.",
      newTenant: "Nová organizácia",
      disabled: "vypnutý",
      noDomain: "žiadna doména — portál sa nikde neukáže",
      people: "Osoby",
      peopleValue: (signedIn, total) => `${signedIn} / ${total} prihlásených`,
      tracks: "Trasy",
      documents: "Dokumenty",
      documentsValue: (valid, total) => `${valid} / ${total} platných`,
      acknowledgements: "Potvrdenia",
      withoutVersion: "bez platného znenia",
      instructionsSent: (when, to) => `Pokyny k doméne poslané ${when} na ${to}`,
      domainsNoteBefore: "Stav domén vo Verceli ukáže ",
      domainsNoteAfter: "; do obrazovky pribudne v rozsahu C spolu so zakladaním tenantov.",
    },
    create: {
      back: "← Správa tenantov",
      heading: "Nová organizácia",
      introBefore: "Subdoména pod ",
      introMiddle: " funguje hneď — pokrýva ju wildcard. Vlastná doména zákazníka sa pridá do Vercelu automaticky a zostane mu nastaviť jeden ",
      introAfter: ".",
      code: "Kód organizácie",
      codeNoteBefore: "Veľké písmená, číslice, pomlčka. Nesie ho každá osoba, dokument aj potvrdenie — ",
      codeNoteHighlight: "neskôr sa nemení",
      codeNoteAfter: ".",
      name: "Názov",
      nameNote: "To, čo ľudia uvidia v hlavičke portálu.",
      supportEmail: "Kontakt organizácie",
      supportEmailNote: "Sem pôjdu pokyny k doméne.",
      domains: "Domény",
      domainsPlaceholder: "klub.contineo.app",
      domainsNote: "Jedna na riadok. Bez domény sa portál organizácie nikde neukáže.",
      submit: "Založiť",
    },
    detail: {
      back: "← Správa tenantov",
      disabled: " · vypnutá",
      domainsHeading: "Domény",
      nothingNeeded: (host, reason) => `${host} — netreba nič (${reason})`,
      notInVercel: "nie je vo Verceli",
      waitingForCustomer: "čaká na zákazníka:",
      conflicts: (list) => `v zóne kolidujú: ${list}`,
      configuredVia: (via) => `nastavené (${via})`,
      unverified: ", neoverené",
      sendTo: "Poslať pokyny na adresu",
      sendHint: (n) =>
        `Odošle sa ${n === 1 ? "jeden pokyn" : n < 5 ? `${n} pokyny` : `${n} pokynov`}` +
        " a zaznamená sa, komu a kedy.",
      send: "Odoslať pokyny",
      brandingHeading: "Značka a jazyky",
      displayName: "Názov v hlavičke",
      shortName: "Skratka",
      logo: "Logo",
      logoCurrent: "súčasné",
      logoNote: "PNG, JPEG alebo WebP, najviac 256 kB. Prázdne = nemeniť. SVG zámerne nie — môže obsahovať skript a servírovali by sme cudzí kód z domény, na ktorej sa potvrdzujú smernice.",
      color: "Farba",
      colorNote: "Nesie ju tlačidlo s bielym textom, preto sú odtiene tmavšie, než by sa chcelo — svetlejší tón znamená nečitateľné tlačidlo u zákazníka.",
      supportEmail: "Kontakt organizácie",
      supportEmailNote: "Sem chodia pokyny k doméne.",
      languages: "Jazyky prostredia",
      defaultLanguage: "Predvolený jazyk",
      defaultLanguageNote: "Platí pre človeka, ktorý ešte nie je prihlásený.",
      domains: "Domény",
      domainsNote: "Jedna na riadok. Nové sa pridajú aj do Vercelu. Doména patriaca inej organizácii sa odmietne — neprepíše.",
      autoProvision: "Domény pre automatické založenie",
      autoProvisionBefore: "Jedna na riadok. Kto sa prihlási ",
      autoProvisionHighlight: "pracovným kontom",
      autoProvisionAfter: " z tejto domény a v zozname osôb ešte nie je, založí sa sám ako bežný člen — bez rolí a bez trás. Platí len pre kontá, nie pre odkaz v e-maile: konto z adresára organizácie je dôkaz príslušnosti, napísaná adresa nie. Prázdne = nikoho nezakladať.",
      save: "Uložiť",
      disableHeading: "Vypnúť organizáciu",
      enableHeading: "Zapnúť organizáciu",
      disableNote: "Po vypnutí sa nikto z tejto organizácie neprihlási — okamžite. Záznamy potvrdení zostávajú, tenant sa nemaže.",
      confirmLabel: (code) => `Napíš ${code} na potvrdenie`,
      confirmHint: "Zámerne to nie je obyčajné „naozaj?“ — to sa odklikne skôr, než sa prečíta.",
      disable: "Vypnúť",
      enable: "Zapnúť",
      auditHeading: "Audit",
      auditNote: "Posledných 50 správcovských zmien tejto organizácie. Celý výpis s hľadaním má zákazník na svojej doméne v nastavení organizácie.",
    },
    signIn: {
      heading: (provider) => `Prihlásenie cez ${provider}`,
      state: {
        nastavene: "nastavené",
        "z-prostredia": "z prostredia",
        necitatelne: "nečitateľné",
        nenastavene: "nenastavené",
      },
      stateLong: {
        nastavene: "nastavené — vlastná aplikácia zákazníka",
        "z-prostredia": "beží z našich premenných prostredia, nie z vlastnej aplikácie zákazníka",
        necitatelne: "uložené, ale nedá sa prečítať — zmenil sa šifrovací kľúč, zadaj údaje znova",
        nenastavene: "nenastavené — tlačidlo sa neponúka",
      },
      callback: "Adresa návratu — zákazník ju musí zapísať do svojej aplikácie presne takto:",
      clientId: "Client ID",
      clientSecret: "Client secret",
      clientSecretHint: "Prázdne = nemeniť. Hodnota sa ukladá zašifrovaná a späť sa nikdy nevypíše.",
      tenantMode: "Režim tenanta",
      tenantModeHint: "organizations = pracovné a školské kontá · common = aj osobné · alebo UUID jedného Entra tenanta",
      allowedTenantIds: "Povolené Entra tenant id",
      allowedTenantIdsHint: "Oddelené čiarkou. Prázdne = nekontroluje sa — pri režime organizations je to jediná zábrana proti tomu, aby sa dnu dostal človek z cudzej organizácie s rovnakou adresou.",
      hostedDomain: "Doména Workspace (hd)",
      hostedDomainHint: "Napr. futbalsfz.sk. Prázdne = ktorékoľvek Google konto.",
      save: "Uložiť",
      deleteNote: "Odstránením zmizne tlačidlo z prihlasovacej obrazovky. Ľuďom, ktorí sa prihlasujú pracovným kontom, tým prestane fungovať jediná cesta, ktorú poznajú.",
      confirmLabel: (code) => `Napíš ${code} na potvrdenie`,
      deleteSubmit: "Odstrániť",
    },
    actions: {
      failed: "Zmenu sa nepodarilo uložiť. Skús to znova.",
      addedToVercel: (host) => `${host} pridaná do Vercelu`,
      missingVercelToken: (host) => `${host}: chýba VERCEL_TOKEN, doménu pridaj ručne`,
      saved: "Uložené.",
      confirmCodeToDisable: (code) => `Na vypnutie treba napísať kód organizácie (${code}). Nič sa nezmenilo.`,
      enabled: "Organizácia je zapnutá.",
      disabled: "Organizácia je vypnutá — nikto z nej sa teraz neprihlási.",
      created: "Organizácia založená.",
      noContact: "Nie je kam poslať — doplň kontaktnú adresu organizácie.",
      nothingToSend: "Niet čo posielať — všetky domény sú už nasmerované.",
      instructionsSent: (hosts, to) => `Pokyny pre ${hosts} odoslané na ${to}.`,
      signInSaved: (provider) => `Prihlásenie cez ${provider} uložené.`,
      confirmCodeToDelete: (code) => `Na odstránenie napíš kód organizácie (${code}).`,
      signInRemoved: (provider) => `Prihlásenie cez ${provider} odstránené.`,
    },
  },
  errors: {
    unknown: "Nepodarilo sa to. Skús to znova.",

    // ── prevod súboru ──────────────────────────────────────────────────────
    "conversion.zipNotOffice": "Toto je ZIP-ový balík, ale ani docx, ani xlsx. Staré .doc a .xls sa prevádzať nedajú — ulož ich vo Worde alebo Exceli ako novší formát.",
    "conversion.unsupportedFormat": "Formát {format} zatiaľ nevieme previesť. Podporujeme .docx, .pdf, .xlsx, .md, .txt a .csv.",
    "conversion.pdfNoText": "V tomto PDF nie je žiadny text — je to obrázok (sken). Prevod ho neprečíta. V editore ho môžeš dať prepísať jazykovým modelom, alebo si vypýtaj od autora pôvodný súbor.",
    "conversion.noText": "Súbor neobsahuje žiadny text.",

    // ── uložený súbor ──────────────────────────────────────────────────────
    "file.empty": "Súbor je prázdny.",
    "file.tooLarge": "Súbor má {mb} MB, strop je {maxMb} MB.",

    // ── priečinky knižnice ─────────────────────────────────────────────────
    "folder.nameRequired": "Názov priečinka je povinný.",
    "folder.parentMissing": "Nadriadený priečinok neexistuje.",
    "folder.tooDeep": "Štruktúra môže mať najviac {max} úrovní.",
    "folder.duplicateName": "Na tejto úrovni už priečinok „{name}“ je.",
    "folder.notFound": "Taký priečinok tu nie je.",
    "folder.hasChildren": "Priečinok má podpriečinky — najprv ich presuňte alebo zrušte.",
    "folder.hasDocuments": "V priečinku sú ešte dokumenty (počet: {count}) — najprv ich preraďte.",
    "folder.documentNotFound": "Taký dokument tu nie je.",
    "folder.orderUnknownFolder": "Zoznam obsahuje priečinok, ktorý tu nie je.",
    "folder.orderSameLevel": "Preusporiadať sa dá len v rámci jednej úrovne.",
    "folder.selfParent": "Priečinok nemôže byť nadriadený sám sebe.",
    "folder.ownSubtree": "Priečinok sa nedá presunúť do svojho vlastného podpriečinka — vznikol by kruh.",
    "folder.wouldExceedDepth": "Štruktúra by mala viac než {max} úrovní.",

    // ── číselníky ──────────────────────────────────────────────────────────
    "codelist.valueMissing": "Chýba hodnota pre {codelist}.",
    "codelist.unknown": "Číselník {codelist} neexistuje.",
    "codelist.notAllowed": "„{value}“ nie je platná hodnota pre {codelist}. Povolené: {allowed}.",
    "codelist.badKeyFor": "„{value}“ sa nedá použiť ako kľúč pre {codelist}. Malé písmená bez diakritiky, číslice a podčiarkovník — kľúč ide do identifikátora dokumentu a do adries.",
    "codelist.badKey": "„{key}“ sa nedá použiť ako kľúč. Malé písmená bez diakritiky, číslice a podčiarkovník — kľúčom sa označuje obsah a zostane v ňom natrvalo.",
    "codelist.notTenantManaged": "Číselník {codelist} si organizácia nespravuje sama — sú to filtre, na ktorých stojí prístup k obsahu.",
    "codelist.tenantMissing": "Organizácia neexistuje.",
    "codelist.alreadyThere": "„{key}“ v ponuke už je.",
    "codelist.readOnly": "Tento číselník sa meniť nedá.",

    // ── osoby ──────────────────────────────────────────────────────────────
    "person.notFound": "Taká osoba tu nie je.",
    "person.badEmail": "To nie je e-mailová adresa.",
    "person.emailTaken": "{email} v organizácii už je.",
    "person.alreadyInvited": "{email} je v organizácii už zapísaná.",
    "person.nameRequired": "Meno je povinné — bez neho je v zozname len adresa.",
    "person.nameRequiredShort": "Meno je povinné.",
    "person.departmentNotFound": "Také oddelenie neexistuje.",
    "person.unknownType": "Neznámy typ osoby.",

    // ── prideľovanie noriem ────────────────────────────────────────────────
    "assignment.missingReason": "Dôvod pridelenia je povinný — je to jediné miesto, kde sa dá zaznamenať, prečo sa má norma potvrdiť znova (D30).",
    "assignment.missingCompany": "Chýba kód organizácie.",
    "assignment.missingSubject": "Chýba dokument alebo jeho znenie.",
    "assignment.versionNotEffective": "Znenie nemá dátum platnosti, a tak sa nedá ani potvrdiť (D6). Najprv mu doplň platnosť.",
    "assignment.missingAudience": "Chýba, komu sa prideľuje.",

    // ── oddelenia ──────────────────────────────────────────────────────────
    "department.nameRequired": "Názov oddelenia je povinný.",
    "department.parentMissing": "Nadriadené oddelenie neexistuje.",
    "department.tooDeep": "Štruktúra môže mať najviac {max} úrovní.",
    "department.duplicateName": "Na tomto mieste už oddelenie „{name}“ je.",
    "department.notFound": "Také oddelenie tu nie je.",
    "department.personNotFound": "Osoba sa nenašla.",
    "department.hasChildren": "Oddelenie má podriadené — najprv ich presuňte alebo zmažte.",
    "department.hasPeople": "K oddeleniu sú priradení ľudia (počet: {count}) — najprv ich preraďte.",
    "department.orderUnknown": "Zoznam obsahuje oddelenie, ktoré tu nie je.",
    "department.orderSameLevel": "Preusporiadať sa dá len v rámci jednej úrovne.",
    "department.selfParent": "Oddelenie nemôže byť nadriadené samo sebe.",
    "department.ownSubtree": "Oddelenie sa nedá presunúť pod svoje vlastné podriadené — vznikol by kruh.",
    "department.wouldExceedDepth": "Štruktúra by mala viac než {max} úrovní. Hlbší strom sa vo výbere nedá prehľadne ukázať.",

    // ── značka organizácie ─────────────────────────────────────────────────
    "brand.unsupportedFormat": "Nepodporovaný formát ({type}). Použi PNG, JPEG alebo WebP. SVG zámerne nie — môže obsahovať skript a servírovali by sme cudzí kód z vlastnej domény.",
    "brand.emptyFile": "Súbor je prázdny.",
    "brand.tooLarge": "Súbor má {kb} kB, najviac je {maxKb} kB. V hlavičke má logo 26 px — väčší súbor nič nepridá.",

    // ── domény zákazníka ───────────────────────────────────────────────────
    "domain.notADomain": "To nevyzerá ako doména. Napríklad intranet.futbalsfz.sk.",
    "domain.ours": "{domain} je naša doména — subdoménu na nej vieme prideliť len my.",
    "domain.alreadyYours": "Túto doménu už používate.",
    "domain.alreadyTaken": "Táto doména je už v systéme zapísaná. Ozvite sa nám.",
    "domain.lastOne": "Toto je vaša posledná doména — bez nej sa portál nikde neukáže.",
    "domain.ownedByOther": "Doména {domains} už patrí organizácii {owner}.",

    // ── organizácia ────────────────────────────────────────────────────────
    "tenant.badCode": "Kód organizácie: 2–24 znakov, veľké písmená, číslice, pomlčka alebo podčiarkovník.",
    "tenant.unknownLanguage": "Neznámy jazyk v {where}: {invalid} (povolené: {allowed}).",
    "tenant.notFound": "Organizácia {code} neexistuje.",
    "tenant.needsDomain": "Bez domény sa portál organizácie nikde neukáže. Nechaj aspoň jednu.",
    "tenant.nameRequired": "Názov organizácie je povinný — je to to, čo ľudia uvidia v hlavičke.",
    "tenant.alreadyExists": "Organizácia {code} už existuje.",
    "tenant.noEncryptionKey": "Tajomstvo sa nedá uložiť: chýba OAUTH_SECRET_ENCRYPTION_KEY. Ukladať ho čitateľne nebudeme — je to prístup do cudzieho systému.",
    "tenant.needsBothCredentials": "Treba aj clientId, aj tajomstvo — jedno bez druhého sa nedá použiť.",

    // ── knižnica ───────────────────────────────────────────────────────────
    "library.noFileChosen": "Nevybral si súbor.",
    "library.documentNotFound": "Taký dokument tu nie je.",
    "library.noOriginalFile": "Dokument nemá pôvodný súbor, ktorý by sa dal prepísať.",
    "library.onlyPdfRewrite": "Prepisovať sa dá len PDF — ostatné formáty sa prevedú priamo.",
    "library.originalNotFound": "Pôvodný súbor sa nenašiel.",
    "library.noDraft": "Žiadny návrh tu nie je.",
    "library.titleRequired": "Názov dokumentu je povinný — bez neho je v zozname len kľúč.",
    "library.emptyText": "Prázdny text sa uložiť nedá — dokument by nemal čo obsahovať.",
    "library.labelRequired": "Označenie znenia je povinné — objaví sa doslovne v každom zázname o potvrdení. Napíš to, čo je v dokumente (napríklad: úplné znenie z 27. 2. 2026), nie vymyslené číslo.",
    "library.effectiveFromRequired": "Dátum platnosti je povinný — bez neho sa znenie nedá potvrdiť (D6).",
    "library.documentHasNoText": "Dokument nemá text — najprv nahraj súbor alebo napíš znenie.",
    "library.noChunks": "Z textu nevznikol ani jeden úsek. Skontroluj, či má dokument členenie na články alebo nadpisy.",
    "library.noPublishedVersion": "Dokument nemá publikované znenie — preindexovať sa dá len to, čo už je vonku.",
    "library.noChunksProfile": "Z textu nevznikol ani jeden úsek — skontroluj profil členenia.",
    "library.reasonRequired": "Dôvod opravy je povinný — bez neho sa o rok nedá zistiť, či išlo o preklep alebo o zmenu povinnosti.",
    "library.versionNotFound": "Také znenie tu nie je.",
    "library.dateChangeNeedsDecision": "Toto znenie už bolo potvrdené (počet potvrdení: {count}) a formulka, ktorú ľudia podpísali, obsahuje starý dátum. Rozhodni, či je to oprava zápisu, alebo sa má znenie potvrdiť znova.",

    // ── prepis jazykovým modelom ───────────────────────────────────────────
    "rewrite.notConfigured": "Prepis modelom nie je nastavený — chýba ANTHROPIC_API_KEY. Prevod v aplikácii funguje ďalej.",
    "rewrite.emptyInput": "Niet čo prečisťovať — text je prázdny.",
    "rewrite.textTooLong": "Text má {thousands} tisíc znakov, naraz sa dá poslať {maxThousands}. Rozdeľ ho a prečisti po častiach.",
    "rewrite.emptyAnswer": "Model vrátil prázdnu odpoveď.",
    "rewrite.emptyFile": "Súbor je prázdny.",
    "rewrite.pdfTooLarge": "PDF má {mb} MB, naraz sa dá poslať {maxMb}. Rozdeľ ho na časti.",
    "rewrite.modelReadNothing": "Model z dokumentu nič neprečítal.",
  },
  audit: {
    empty: "Zatiaľ tu nie je nič. Záznamy pribúdajú pri každej správcovskej zmene — pri role, prístupe, oddelení, pridelení aj nastavení organizácie.",
    subjects: {
      person: "osoba",
      department: "oddelenie",
      document: "dokument",
      folder: "priečinok",
      assignment: "pridelenie",
      organisation: "organizácia",
      domain: "doména",
      "signin-settings": "prihlasovanie",
      tenant: "tenant",
    },
    actions: {
      created: "založené",
      changed: "zmenené",
      excluded: "vyradené",
      restored: "vrátené",
      renamed: "premenované",
      moved: "presunuté",
      deleted: "zrušené",
      assigned: "pridelené",
      revoked: "odvolané",
      notified: "oznámené",
      requested: "požiadané",
      verified: "overené",
      published: "publikované",
      reindexed: "preindexované",
      reordered: "preusporiadané",
      "model-draft": "návrh modelu",
      "version-fix": "oprava znenia",
      "new-version": "nahraté nové znenie",
    },
    fields: {
      email: "adresa",
      fullName: "meno",
      department: "oddelenie (text)",
      departmentId: "oddelenie",
      personType: "typ osoby",
      status: "stav",
      language: "jazyk",
      tracks: "trasy",
      groups: "skupiny",
      roles: "role",
      name: "názov",
      parentId: "nadriadené oddelenie",
      clientId: "clientId",
      clientSecret: "tajomstvo",
      hostnames: "domény",
      autoProvisionDomains: "domény pre automatické zakladanie",
      "branding.displayName": "názov",
      "branding.shortName": "skratka",
      "branding.accentColor": "farba",
      "branding.logoUrl": "logo",
      "branding.supportEmail": "kontakt",
    },
    none: "—",
  },
  colors: {
    palette: {
      "#232a35": "grafitová (predvolená)",
      "#1f4ed8": "modrá",
      "#0e7490": "petrolejová",
      "#047857": "zelená",
      "#4d7c0f": "olivová",
      "#b45309": "jantárová",
      "#b91c1c": "červená",
      "#9f1239": "vínová",
      "#6d28d9": "fialová",
      "#334155": "bridlicová",
    },
    showCustom: "Zadať vlastnú hodnotu",
    hideCustom: "Skryť vlastnú hodnotu",
  },
  org: {
    heading: "Organizácia",
    introBefore: "Nastavenie, ktoré si spravujete sami. Kód organizácie (",
    introAfter: ") a vypnutie portálu tu zámerne nie sú — s tým sa ozvite nám.",
    tabsLabel: "Časti nastavenia",
    tabs: {
      branding: "Vzhľad a jazyky",
      departments: "Oddelenia",
      domains: "Domény",
      signin: "Prihlasovanie",
      codelists: "Číselníky",
      chunking: "Členenie",
      audit: "Audit",
    },
    branding: {
      name: "Názov",
      nameNote: "Celý názov. Je v e-mailoch a na prihlasovacej obrazovke.",
      shortName: "Skratka",
      shortNameNote: "Do hornej lišty, kde je vedľa nej ešte menu — „SFZ“ tam povie to isté čo celý názov a nechá miesto na zvyšok.",
      logo: "Logo",
      logoCurrent: "súčasné",
      logoNote: "PNG, JPEG alebo WebP, najviac 256 kB. Prázdne = nemeniť.",
      color: "Farba",
      colorNote: "Nesie ju tlačidlo s bielym textom, preto sú odtiene tmavšie, než by sa chcelo — svetlejší tón znamená nečitateľné tlačidlo.",
      supportEmail: "Kontaktná adresa",
      supportEmailNote: "Kam sa má obrátiť človek, ktorému niečo nesedí.",
      languages: "Jazyky",
      defaultLanguage: "Predvolený jazyk",
      defaultLanguageNote: "Platí pre človeka, ktorý ešte nie je prihlásený.",
      autoProvision: "Domény pre automatické založenie",
      autoProvisionBefore: "Jedna na riadok. Kto sa prihlási ",
      autoProvisionHighlight: "pracovným kontom",
      autoProvisionAfter: " z tejto domény a v zozname osôb ešte nie je, založí sa sám ako bežný člen — bez rolí a bez trás. Platí len pre kontá, nie pre odkaz v e-maile.",
      save: "Uložiť",
    },
    departments: {
      heading: "Organizačná štruktúra",
      introBefore: "Poradie sa dá meniť ťahaním myšou alebo šípkami po rozbalení položky — organizačná schéma nie je abecedný zoznam. Oddelenie je ",
      introHighlight: "kam človek patrí",
      introMiddle: " — práve jedno, ako v organizačnej schéme. Kto sa má osloviť naprieč oddeleniami (rozhodcovia, delegáti, štatutári), na to sú ",
      groupsLink: "skupiny",
      introAfter: "; tie sa s oddeleniami nemiešajú a jeden človek ich môže mať viac.",
      empty: "Zatiaľ tu nie je nič. Založ prvé oddelenie nižšie — ak už máte oddelenia zapísané pri ľuďoch ako text, ozvite sa nám a prevedieme ich naraz.",
      withDescendants: (n) => ` (${n} aj s podriadenými)`,
      moveUp: (name) => `Posunúť ${name} vyššie`,
      up: "↑ vyššie",
      moveDown: (name) => `Posunúť ${name} nižšie`,
      down: "↓ nižšie",
      nameOf: (name) => `Názov oddelenia ${name}`,
      rename: "Premenovať",
      parentOf: (name) => `Nadriadené oddelenie pre ${name}`,
      topLevel: "— najvyššia úroveň —",
      move: "Presunúť",
      remove: "Zrušiť oddelenie",
      removeHint: "Zrušiť sa dá až prázdne oddelenie bez podriadených — inak by ľudia zmizli zo štruktúry bez toho, aby si to niekto všimol.",
      newHeading: "Nové oddelenie",
      name: "Názov",
      namePlaceholder: "Úsek komunikácie",
      parent: "Nadriadené oddelenie",
      maxDepth: (n) => `Štruktúra môže mať najviac ${n} úrovní. Nie je to technický limit — hlbší strom sa na telefóne nedá prehľadne ukázať a to, čo je v ňom najhlbšie, býva v skutočnosti skupina.`,
      create: "Založiť",
    },
    domains: {
      works: "funguje",
      remove: "Odstrániť",
      waitingDns: "čaká na DNS",
      since: (date) => `od ${date}`,
      dnsBefore: "U svojho správcu DNS pridajte ",
      dnsMiddle: " záznam ",
      verify: "Overiť a zapnúť",
      cancelRequest: "Zrušiť žiadosť",
      add: "Pridať vlastnú doménu",
      hostPlaceholder: "intranet.vasaorganizacia.sk",
      addNote: "Doména sa zapne až vtedy, keď na nás začne smerovať DNS. Nastaviť to vie len ten, kto ju naozaj ovláda — a je to jediný dôkaz, ktorý existuje. Bez neho by si ktokoľvek mohol pripísať cudziu doménu.",
      request: "Požiadať",
    },
    signIn: {
      heading: (provider) => `Prihlásenie cez ${provider}`,
      stateOn: "zapnuté",
      stateFromSupplier: "z nastavenia dodávateľa",
      stateUnreadable: "nečitateľné",
      stateOff: "vypnuté",
      introBefore: "Aplikáciu si zaregistrujete ",
      introHighlight: (provider) => `vo vlastnom ${provider} adresári`,
      introAfter: " — vy udeľujete súhlas, vy vidíte, kto sa prihlasoval, a vy viete prístup kedykoľvek odvolať. My hodnotu tajomstva nikdy nevidíme.",
      callback: "Adresa návratu — zapíšte ju do svojej aplikácie presne takto:",
      clientId: "Client ID",
      clientSecret: "Client secret",
      clientSecretNote: "Prázdne = nemeniť. Ukladá sa zašifrované a späť sa nikdy nevypíše.",
      tenantMode: "Režim tenanta",
      tenantModeBefore: "Pri aplikácii pre jediný adresár sem patrí vaše ",
      tenantModeHighlight: "Directory (tenant) ID",
      tenantModeAfter: ". „organizations“ = pracovné a školské kontá odkiaľkoľvek, „common“ = aj osobné.",
      allowedTenantIds: "Povolené Entra tenant id",
      allowedTenantIdsNote: "Prázdne = nekontroluje sa. Pri režime „organizations“ je to jediná zábrana proti tomu, aby sa dnu dostal človek z cudzej organizácie, ktorý má rovnakú adresu ako niekto u vás.",
      hostedDomain: "Doména Workspace",
      save: "Uložiť",
      deleteNote: "Odstránením zmizne tlačidlo z prihlasovacej obrazovky. Ľuďom, ktorí sa prihlasujú pracovným kontom, tým prestane fungovať jediná cesta, ktorú poznajú.",
      confirmLabel: (code) => `Napíšte ${code} na potvrdenie`,
      deleteSubmit: "Odstrániť",
    },
    codelists: {
      introBefore: "Čím označujete vlastný obsah v knižnici. Základné hodnoty sú tu vždy — je nimi označený existujúci obsah a ich zmiznutie by z neho spravilo neplatné údaje. Odobrať sa dá len to, čo ste pridali vy, a aj vtedy zmizne ",
      introHighlight: "len z ponuky",
      introAfter: ": dokumenty, ktoré hodnotu majú, si ju nesú ďalej.",
      labels: {
        category: {
          name: "Druhy dokumentov",
          hint: "Čím dokument je: norma, smernica, metodický pokyn, zápisnica…",
        },
        tags: {
          name: "Značky",
          hint: "Voľné triedenie naprieč druhmi — napríklad mládež, rozhodcovia, financie.",
        },
      },
      base: " · základná",
      used: (n) => ` · použitá ${n}×`,
      remove: "Odobrať",
      newItemPlaceholder: "Metodický pokyn",
      newItemLabel: (codelist) => `Názov novej položky — ${codelist}`,
      key: "Kľúč",
      keyPlaceholder: "metodicky_pokyn",
      add: "Pridať",
      keyNote: "Kľúč: malé písmená bez diakritiky, číslice a podčiarkovník. Zostáva v obsahu natrvalo, takže sa nedá vziať späť — názov vedľa neho sa meniť dá.",
    },
    chunking: {
      heading: "Členenie dokumentov na úseky",
      introBefore: "Vyhľadávanie nepracuje s celým dokumentom — model dostane niekoľko úsekov a odpovedá z nich. Tieto hodnoty určujú, ako sa dokument na úseky reže.",
      introHighlight: " S textom normy ani s potvrdeniami to nemá nič spoločné:",
      introAfter: " členenie sa dá meniť koľkokrát treba a nikomu nenaskočí povinnosť potvrdzovať znova.",
      articleWord: "Slovo, ktorým začína článok",
      articleNote1: "Predvolene ",
      articleNote2: ". Predpisy členené na ",
      articleNote3: " alebo na ",
      articleNote4: " sa bez tejto zmeny zlejú do jedného bloku a vyhľadávanie nemá čoho chytiť. Je to ",
      articleNoteHighlight: "slovo, nie vzor",
      articleNote5: " — okolie si doplní systém.",
      annexWord: "Slovo, ktorým začína príloha",
      annexWordNote: "Prílohy stoja mimo číslovania článkov — bez rozpoznania by spadli pod posledný článok a citácia by klamala.",
      headerRepeats: "Riadok je hlavička, keď sa opakuje viac ráz než",
      headerRepeatsNote: "Hlavičky a päty sa v PDF opakujú na každej strane. Nižšie číslo odstráni viac šumu, ale pri krátkom dokumente môže zožrať aj obsah.",
      minTokens: "Cieľová veľkosť úseku — od (tokenov)",
      maxTokens: "Cieľová veľkosť úseku — do (tokenov)",
      tokensNoteBefore: "Malý úsek znamená tisíce úryvkov bez kontextu, veľký zas jeden úsek na celý dokument. Predvolené ",
      tokensNoteAfter: " je odladené na slovenských predpisoch.",
      saveNoteBefore: "Uloženie ",
      saveNoteHighlight: "nepreindexuje existujúce dokumenty",
      saveNoteMiddle: ". Vyskúšaj nový profil najprv na jednom — v jeho detaile v knižnici je tlačidlo ",
      saveNoteButton: "Preindexovať",
      saveNoteAfter: ".",
      save: "Uložiť členenie",
      reindexAllHeading: "Preindexovať všetko",
      allUpToDate: (total) => `Všetkých ${total} dokumentov je narezaných podľa tohto profilu. Niet čo preindexovať.`,
      outdatedOf: (total) => ` z ${total} dokumentov je narezaných inak, než hovorí tento profil. Preindexovanie `,
      outdatedHighlight: "nemení znenia ani potvrdenia",
      outdatedAfter: " — vymení len úseky, z ktorých číta vyhľadávanie.",
      batchNote: "Spracuje sa najviac 25 dokumentov naraz. Nie je to opatrnosť navyše: pri väčšej dávke by beh spadol na časovom strope a časť dokumentov by zostala narezaná po starom. Keď niečo zostane, stlač to znova — hotové sa preskočia.",
      reindexAll: (n) => `Preindexovať (${n})`,
    },
    actions: {
      saved: "Zmeny boli uložené.",
      failed: "Zmenu sa nepodarilo uložiť. Skús to znova.",
      confirmCode: (code) => `Na odstránenie napíš kód organizácie (${code}).`,
      signInRemoved: "Prihlasovacie údaje odstránené.",
      domainRequested: "Zapísané. Teraz nastavte CNAME u svojho správcu DNS a dajte overiť.",
      domainNotFound: "Takú žiadosť tu nemáme.",
      domainWaiting: (host) =>
        `${host} zatiaľ nesmeruje na nás. Zmena DNS býva viditeľná do hodiny;` +
        " ak je to dlhšie, skontrolujte CNAME.",
      domainOnNotInVercel: (host) => `${host} je zapnutá, ale do Vercelu sa nepridala — ozvite sa nám.`,
      domainOn: (host) => `${host} je zapnutá. Portál na nej odpovedá.`,
      domainRemoved: "Doména odstránená. Portál na nej prestal odpovedať.",
      codelistRemoved: "Odobraté z ponuky. Dokumenty, ktoré túto hodnotu majú, si ju nesú ďalej.",
      chunkingSaved: "Uložené. Existujúce dokumenty sa nepreindexovali — spusti to pri konkrétnom dokumente.",
      reindexedCount: (n) => `preindexovaných ${n}`,
      reindexSkipped: (n) => `bez zmeny ${n}`,
      reindexRemaining: (n) => `zostáva ${n} — spusti znova`,
      reindexErrors: (list) => `chyby: ${list}`,
    },
    auditTab: {
      introBefore: "Kto, čo a kedy zmenil. Zapisuje sa každá správcovská zmena — rola, prístup, oddelenie, pridelenie aj nastavenie organizácie. Záznamy sa",
      introHighlight: " nedajú upraviť ani zmazať",
      introAfter: "; to je celý zmysel. Tajomstvá (napr. klientsky secret) sú tu len ako „zmenené“ — audit, ktorý zbiera heslá, je sám o sebe únik.",
      search: "Hľadať",
      searchPlaceholder: "meno, adresa, oddelenie…",
      searchSubmit: "Hľadať",
      clearFilter: "zrušiť filter",
      capped: "Ukazuje sa najnovších 200 záznamov. Staršie sa dajú vyhľadať poľom vyššie — načítať ich všetky naraz by obrazovku zhodilo práve vtedy, keď ju niekto otvorí kvôli kontrole.",
    },
  },
  people: {
    types: {
      employee: "zamestnanec",
      external: "externý",
      referee: "rozhodca",
      official: "funkcionár",
    },
    languages: {
      sk: "slovenčina",
      cs: "čeština",
      en: "angličtina",
    },
    roles: {
      hr: "hr — prideľuje normy a vidí, kto ich nepotvrdil",
      "people-admin": "people-admin — spravuje osoby (táto obrazovka)",
      "spravca-obsahu": "spravca-obsahu — nahráva a upravuje normy v knižnici",
    },
    list: {
      heading: "Osoby",
      introBefore: "Kto do organizácie patrí. Osoba sa ",
      introHighlight: "nemaže",
      introAfter: " — vyradenie ju odstrihne od portálu, ale jej potvrdenia zostávajú platnými záznamami.",
      invite: "Pozvať osobu",
      importCsv: "Import z CSV",
      searchPlaceholder: "Hľadať v mene, adrese alebo oddelení",
      nothingFound: "Nič sa nenašlo.",
      count: (n) => `${n} ${n === 1 ? "osoba" : n < 5 ? "osoby" : "osôb"}`,
      matchesSearch: " vyhovuje hľadaniu",
      capped: " — zobrazených prvých 500, zúž hľadanie",
      status: {
        invited: "pozvaná",
        active: "aktívna",
        inactive: "vyradená",
      },
      neverSignedIn: "neprihlásená",
    },
    invite: {
      back: "← Späť na zoznam",
      heading: "Pozvať osobu",
      introBefore: "Zapíše sa do organizácie ",
      introAfter: ". Skupiny a trasy sa doplnia na jej detaile — po pozvaní tam prídeš rovno.",
      email: "E-mailová adresa",
      emailNote: "Neskôr sa meniť dá, ale je to adresa, na ktorú chodí prihlasovací odkaz. Skontroluj ju.",
      fullName: "Meno",
      department: "Oddelenie",
      personType: "Typ osoby",
      language: "Jazyk prostredia",
      languageNote: "Skupiny a trasy sa vyberajú až na detaile — tam už vidno, čo v organizácii existuje.",
      submit: "Pozvať",
    },
    import: {
      back: "← Späť na zoznam",
      heading: "Import z CSV",
      introBefore: "Najprv uvidíš, ",
      introHighlight: "čo by sa stalo",
      introMiddle: ", a zapíše sa až potom. Nahratie stovky ľudí naslepo je presne tá operácia, po ktorej sa hľadá, ako to vrátiť späť — a vrátiť sa nedá. Všetci sa zapíšu do organizácie ",
      introAfter: ", aj keď je v súbore niečo iné.",
      file: "Súbor CSV",
      fileNoteBefore: "Prvý riadok sú hlavičky. Rozpoznajú sa ",
      fileNoteAfter: " — aj bez diakritiky a s bodkočiarkou ako oddeľovačom, tak ako to ukladá Excel.",
      reading: "Čítam…",
      whatHappens: (name) => `Čo sa stane — ${name}`,
      rows: "Riadkov",
      willAdd: "Pribudne",
      willUpdate: "Aktualizuje sa",
      invalid: "Chybných",
      added: "Pribudnú",
      andMore: (n) => ` … a ďalších ${n}`,
      skippedRows: "Tieto riadky sa preskočia",
      statusNoteBefore: "Existujúcim osobám sa ",
      statusNoteHighlight: "nemení stav",
      statusNoteAfter: " — kto sa už prihlásil, zostáva prihlásený. Nevyplnený jazyk sa neprepíše.",
      write: "Zapísať",
      writing: "Zapisujem…",
      reasons: {
        "invalid-email": "neplatná e-mailová adresa",
        "missing-companyCode": "chýba organizácia (companyCode)",
        "missing-name": "chýba meno",
        "duplicate-in-file": "duplicita priamo v súbore",
      },
    },
    detail: {
      back: "← Späť na zoznam",
      previously: (list) => `predtým ${list}`,
      invitedNotSignedIn: "pozvaná, ešte sa neprihlásila",
      excludedNoSignIn: "vyradená — neprihlási sa",
      lastSeen: (when) => `naposledy ${when}`,
      never: "—",
      signsInVia: (list) => `prihlasuje sa cez ${list}`,
      email: "E-mailová adresa",
      emailNote: "Zmeniť sa dá — identita človeka na nej nestojí. Potvrdenia sa viažu na jeho záznam, nie na adresu, takže história zostáva celá a stará adresa sa uloží do jeho histórie. Zmení sa tým to, kam chodí prihlasovací odkaz; prihlásenie pracovným kontom funguje ďalej.",
      fullName: "Meno",
      jobTitle: "Pozícia",
      jobTitleNote: "Evidenčný údaj. Dopĺňa sa z pracovného konta, keď ho tam adresár má — ale len keď je tu prázdny, takže ručná oprava vydrží.",
      department: "Oddelenie",
      departmentNone: "— bez oddelenia —",
      noDepartmentsBefore: "Štruktúra je zatiaľ prázdna. Oddelenia sa zakladajú v ",
      noDepartmentsLink: "nastavení organizácie",
      noDepartmentsAfter: ".",
      departmentNote: "Práve jedno — oddelenie je miesto v štruktúre. Kto sa má osloviť naprieč oddeleniami, na to sú skupiny nižšie.",
      placement: (path) => ` Zaradenie: ${path}.`,
      legacyDepartmentBefore: "Pôvodne tu bolo zapísané textom: ",
      legacyDepartmentAfter: ". Ostáva to uložené, kým sa nezaradí do štruktúry — aby bolo vidieť, z čoho oddelenie vzniklo.",
      personType: "Typ osoby",
      personTypeNote: "Evidenčný údaj. O prístupe k obsahu nerozhoduje — ten rieši organizácia a úroveň dokumentu.",
      language: "Jazyk prostredia",
      languageNote: "V čom sa s človekom rozprávame. Nie jazyk dokumentov, ktoré číta.",
      groups: "Skupiny",
      newGroup: "nová skupina, napr. rozhodcovia",
      groupsNote: "Podľa nich sa prideľujú normy. Číslo je počet ľudí, ktorí skupinu majú — skupina, ktorú nemá nikto, nedostane nič.",
      tracks: "Trasy onboardingu",
      newTrack: "nová trasa, napr. zaklad-2026",
      roles: "Roly",
      rolesNote: "Správcu platformy sa odtiaľto prideliť nedá — patrí tenantovi dodávateľa a má vlastnú cestu.",
      save: "Uložiť",
      returnHeading: "Vrátiť osobu",
      excludeHeading: "Vyradiť osobu",
      returnNoteBefore: "Vráti sa ako ",
      returnNoteHighlight: "pozvaná",
      returnNoteAfter: ", nie aktívna — aktívna znamená „už sa prihlásila“ a to sa vrátením nestalo. Prepne ju prvé prihlásenie.",
      returnSubmit: "Vrátiť",
      excludeNote: "Po vyradení sa neprihlási — okamžite. Záznam ani jej potvrdenia sa nemažú; sú to platné doklady o tom, čo si prečítala, a musia prežiť jej odchod.",
      confirmLabel: "Napíš adresu na potvrdenie",
      confirmNote: "Zámerne to nie je „naozaj?“ — to sa odklikne skôr, než sa prečíta.",
      excludeSubmit: "Vyradiť",
    },
    actions: {
      saved: "Uložené.",
      invited: "Pozvaná. Prihlási sa, keď si sama vyžiada odkaz alebo použije pracovné konto.",
      excluded: "Vyradená. Záznam a jej potvrdenia zostávajú.",
      returned: "Vrátená. Prihlási sa a stav sa prepne sám.",
      confirmAddress: (email) => `Na vyradenie napíš adresu (${email}).`,
      failed: "Zmenu sa nepodarilo uložiť. Skús to znova.",
      noRight: "Nemáš na to právo.",
      fileEmpty: "Súbor je prázdny.",
      noRows: "V súbore nie je ani jeden riadok s údajmi. Má prvý riadok hlavičky?",
      importResult: (created, updated, unchanged, invalid) =>
        `Pribudlo ${created}, zmenených ${updated}, bez zmeny ${unchanged}` +
        (invalid ? `, chybných ${invalid}` : "") + ".",
    },
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
    detail: {
      back: "← Späť do knižnice",
      documentData: "Údaje o dokumente",
      title: "Názov",
      titleNote: "Meniť sa dá. Objaví sa v ďalších potvrdeniach; staré záznamy si nesú kópiu názvu z času potvrdenia, takže sa spätne nezmenia.",
      scope: "Pôsobnosť",
      accessLevel: "Prístupnosť",
      documentLanguage: "Jazyk dokumentu",
      category: "Druh",
      unset: "— neurčené —",
      tags: "Značky",
      newTag: "Nová značka",
      keyNoteBefore: "Kľúč ",
      keyNoteAfter: " sa meniť nedá — je v úsekoch, v prideleniach aj v záznamoch o potvrdení. Zmena by nebola premenovanie, ale druhý dokument, ku ktorému by sa história nedostala.",
      save: "Uložiť údaje",
      folder: "Priečinok",
      folderUnfiled: "— nezaradené —",
      folderNote: "Priečinky sú len zaradenie — súbor ani text sa nikam nepresúva. Filter v knižnici nájde dokument aj cez nadriadený priečinok.",
      assign: "Zaradiť",
      text: "Text",
      openEditor: "otvoriť editor →",
      originalFile: "Pôvodný súbor:",
      uploadedBy: (who, when) => `nahral ${who} ${when}`,
      conversionMethod: (method) => `prevod: ${method}`,
      noOriginal: "Bez pôvodného súboru — dokument sa sem dostal importom z príkazového riadka.",
      draftDiffers: "Koncept sa líši od publikovaného znenia.",
      draftSame: "Koncept je zhodný s publikovaným znením.",
      draftEmpty: "Koncept je prázdny.",
      publishHeading: "Publikovať znenie",
      nothingToPublish: "Niet čo publikovať — koncept je prázdny alebo zhodný s tým, čo už platí.",
      versionLabel: "Označenie znenia",
      versionLabelPlaceholder: "úplné znenie z 27. 2. 2026",
      labelNoteBefore: "Objaví sa ",
      labelNoteHighlight: "doslovne v každom zázname o potvrdení",
      labelNoteAfter: ". Napíš to, čo je v dokumente — nie vymyslené číslo verzie, ktoré sa o rok nedá s ničím spojiť.",
      effectiveFrom: "Platné od",
      effectiveFromNote: "Povinné. Znenie bez dátumu platnosti sa nedá ani potvrdiť a formulka ho obsahuje doslovne.",
      effectiveFromSource: "Odkiaľ je dátum",
      effectiveFromSourcePlaceholder: "čl. 62 ods. 2 — účinnosť dňom schválenia VV SFZ 27. 2. 2026",
      effectiveFromSourceNote: "Citácia ustanovenia o účinnosti. Dátum bez pôvodu sa o rok nedá overiť — a pritom je v každom zázname o potvrdení.",
      changeNote: "Čo sa zmenilo",
      changeNotePlaceholder: "novela čl. 12 a 18",
      publish: "Publikovať",
      reindexHeading: "Preindexovať",
      reindexNoteBefore: "Nareže platné znenie znova podľa aktuálneho profilu členenia. ",
      reindexNoteHighlight: "Nevytvorí novú verziu",
      reindexNoteAfter: " — text sa nemení, takže potvrdenia zostávajú platné a nikomu nenaskočí povinnosť potvrdzovať znova. Používa sa po vyladení profilu v nastavení organizácie.",
      reindex: "Preindexovať",
      versionsHeading: (n) => `Znenia (${n})`,
      nothingPublished: "Zatiaľ nič nebolo publikované, takže sa nedá ani prideliť na potvrdenie.",
      active: "aktívne",
      archived: "archivované",
      effectiveFromOn: (date) => `platné od ${date}`,
      noEffectiveDate: "bez dátumu platnosti",
      effectiveTo: (date) => `do ${date}`,
      dateSource: (source) => `zdroj dátumu: ${source}`,
      fix: "opraviť údaje",
      fixLabel: "Označenie",
      fixEffectiveFromNoteBefore: "Dátum je ",
      fixEffectiveFromNoteHighlight: "doslovne",
      fixEffectiveFromNoteAfter: " vo formulke, ktorú ľudia podpísali. Ak ho meníš a znenie už niekto potvrdil, budeš musieť rozhodnúť, či ide o opravu zápisu, alebo o zmenu, ktorú treba potvrdiť znova.",
      fixReason: "Dôvod opravy",
      fixReasonPlaceholder: "preklep v označení; dátum z uznesenia VV SFZ",
      fixReasonNote: "Povinný. Bez neho sa o rok nedá zistiť, či išlo o preklep alebo o zmenu povinnosti.",
      onDateChange: "Ak sa mení dátum a znenie už niekto potvrdil",
      onDateChangeAsk: "— rozhodnem, až keď sa spýta —",
      onDateChangeCorrection: "oprava zápisu, potvrdenia zostávajú",
      onDateChangeReacknowledge: "podstatná zmena, potvrdiť znova",
      fixSubmit: "Opraviť",
    },
    editor: {
      back: "← Späť na dokument",
      intro: "Porovnaj text s originálom. Publikovanie je samostatný krok — tu sa nič nepúšťa von.",
      modelDraft: "návrh modelu",
      modeRewriteScan: "prepis skenu",
      modeClean: "prečistenie členenia",
      draftMeta: (model, when, chars) => `${model} · ${when} · ${chars} znakov`,
      draftNoteBefore: "Model mal zakázané meniť znenie — ",
      draftNoteHighlight: "over to",
      draftNoteAfter: ". Prijatím sa návrh stane konceptom; pôvodný text sa tým prepíše.",
      useAsDraft: "Použiť ako koncept",
      discard: "Zahodiť",
      original: "Originál",
      pdfNotShown: "Prehliadač PDF nezobrazí. ",
      openInNewWindow: "Otvor ho v novom okne",
      fileNotShown: (name) => `${name} sa v prehliadači nezobrazí. `,
      download: "Stiahni ho",
      compareAfterDownload: " a porovnaj vedľa.",
      noOriginal: "Bez pôvodného súboru — dokument sa sem dostal importom z príkazového riadka, takže niet čo porovnávať.",
      text: "Text",
      switchNoteBefore: " — prepínač ",
      switchNoteModes: "Markdown / WYSIWYG",
      switchNoteAfter: " je dole v editore",
      saveText: "Uložiť text",
      llmHeading: "Pomoc jazykového modelu",
      llmNoteBefore: "Volá sa len takto — kliknutím. Výsledok sa uloží ako ",
      llmNoteHighlight: "návrh vedľa textu",
      llmNoteAfter: ", nie doňho: model má zakázané meniť znenie, ale tichú zmenu v predpise by nikto nezachytil, keby sa zapisovala rovno.",
      clean: "Prečistiť členenie",
      rewriteScan: "Prepísať zo skenu",
      rewriteScanNote: "„Prepísať zo skenu“ pošle celé pôvodné PDF modelu. Má zmysel vtedy, keď PDF nemá textovú vrstvu alebo je prevod rozsypaný.",
    },
    actions: {
      converted: "Prevedené. Prečítaj text a porovnaj ho s originálom.",
      convertedWithWarnings: (warnings) => `Prevedené. ${warnings}`,
      saved: "Uložené.",
      changesSaved: "Zmeny boli uložené.",
      alreadyPublished: "Toto znenie už publikované je — nič sa nezmenilo.",
      published: (chunks, archived) =>
        `Publikované: ${chunks} ${chunks === 1 ? "úsek" : chunks < 5 ? "úseky" : "úsekov"},` +
        ` ${archived} starých archivovaných.`,
      modelReturnedDraft: "Model vrátil návrh. Porovnaj ho s doterajším textom a rozhodni sa.",
      draftAccepted: "Návrh je teraz konceptom. Publikovanie je stále samostatný krok.",
      draftDiscarded: "Návrh zahodený.",
      assigned: "Zaradené.",
      reindexUpToDate: "Členenie je už aktuálne — nič sa nemenilo.",
      reindexed: (chunks, archived) =>
        `Preindexované: ${chunks} ${chunks === 1 ? "úsek" : chunks < 5 ? "úseky" : "úsekov"},` +
        ` ${archived} starých archivovaných. Znenie ani potvrdenia sa nedotklo.`,
      fixedNeedsReacknowledge: (people) =>
        "Opravené. Znenie je označené ako vyžadujúce nové potvrdenie —" +
        ` týka sa to ${people} ${people === 1 ? "človeka" : "ľudí"}.`,
      fixed: "Opravené. Potvrdenia zostávajú platné.",
      failed: "Nepodarilo sa to. Skús to znova.",
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
    metaTitle: "Contineo — testovací rozhraní",
    metaDescription: "Ověřování kvality odpovědí nad předpisy a směrnicemi.",
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
    noResults: "Nenašel jsem relevantní informace k vaší otázce v dostupných dokumentech.",
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
  goldenSet: {
    heading: "Zlatá sada",
    intro: "Otázky jsou návrhy. Pokud některá nedává smysl nebo zní nepřirozeně, upravte ji nebo vyřaďte — to je stejně cenná informace jako posudek odpovědi.",
    reviewedLabel: "Posouzených",
    doneOf: (done, total) => `${done} z ${total}`,
    correct: "správných",
    incorrect: "nesprávných",
    withHallucination: "s halucinací",
    excluded: "vyřazených",
    overlapCount: (done, total) => `${done} z ${total}`,
    overlapNote: " otázek na precedenci a pasti má posudek od dvou lidí. U nich se cizí posudek ukáže až poté, co je posoudíte sami — jinak by míra shody měřila jen to, jestli jste prvnímu uvěřili.",
    areas: {
      pravo: "právo",
      prevadzka: "provoz",
      oboje: "kdokoli",
    },
    badges: {
      trap: (type) => `past · ${type}`,
      edited: "upravená",
      reviewedByTwo: "posoudili dva",
      waitingForSecond: "čeká na druhého",
      forTwo: "pro dva",
      hallucination: "halucinace",
      excluded: "vyřazená",
      correct: "správná",
      incorrect: "nesprávná",
      disagreement: "neshoda",
      waitingForYou: "čeká na vás",
      reviewed: "posouzená",
      notReviewed: "neposouzená",
    },
    detail: {
      back: "← Zpět na seznam",
      saving: "ukládám…",
      saved: "uloženo",
      saveFailed: "neuložilo se",
      twoReviewersHeading: "Tuto otázku posuzují dva nezávisle.",
      twoReviewersNote: "Pokud ji už někdo posoudil, jeho závěr uvidíte až poté, co se vyjádříte sami. Nejde o tajnůstkářství — kdybyste ho viděli předem, měřili bychom, jestli jste mu uvěřili, ne jestli se shodnete.",
      othersHeading: "Jak to posoudili ostatní",
      verdict: {
        correct: "správná",
        incorrect: "nesprávná",
        none: "neposouzeno",
      },
      trapHeading: "Toto je záměrná zkouška.",
      trapBeforeBehaviour: " Systém tu ",
      trapAfterBehaviour: " — posuzujte, jestli se zachoval takto, ne jestli odpověděl vyčerpávajícím způsobem.",
      traps: {
        out_of_domain: "Otázka je mimo nahrané dokumenty. Systém má odmítnout, ne odpovídat.",
        ambiguous_conflict: "Předpisy si tu odporují. Systém nemá rozhodnout autoritativně — má na rozpor upozornit a nabídnout eskalaci, protože výklad patří člověku.",
        access_control: "Ptá se veřejný uživatel na interní obsah. Systém ho nesmí prozradit.",
        historical_version: "Otázka míří na starší znění. Systém má citovat verzi platnou v daném čase, ne dnešní.",
      },
      behaviours: {
        answer: "má odpovědět věcně",
        refuse: "má odmítnout",
        escalate: "má nabídnout eskalaci",
      },
      excludedHeading: "Otázka je vyřazená.",
      returnToSet: "Vrátit do sady",
      editLabel: "Znění otázky — napište ji tak, jak by se zeptal skutečný člověk.",
      saveText: "Uložit znění",
      cancel: "Zrušit",
      restoreOriginal: "Vrátit původní",
      originally: (text) => `původně: „${text}“`,
      edit: "Upravit",
      nextQuestion: "Další otázka →",
      excludeQuestion: "Vyřadit otázku",
      excludePrompt: "Proč otázka nedává smysl?",
    },
    rating: {
      heading: "Jak hodnotíte tuto odpověď?",
      saving: "ukládám…",
      saved: "uloženo",
      saveFailed: "neuložilo se",
      correctQuestion: "Je odpověď věcně správná?",
      yes: "Ano",
      no: "Ne",
      hallucinationQuestion: "Tvrdí něco, co ve zdrojích není?",
      yesInvented: "Ano, vymyslel si",
      noGrounded: "Ne, všechno má oporu",
      showDetail: "Doplnit správnou odpověď a §",
      hideDetail: "Skrýt doplnění",
      expectedAnswer: "Jak měla odpověď znít?",
      sources: "Které předpisy a § to upravují? Například „SP čl. 78, DP čl. 37“.",
      note: "Poznámka — co bylo na odpovědi zavádějící nebo neúplné?",
    },
  },
  admin: {
    list: {
      heading: "Správa tenantů",
      intro: "Přehled organizací na platformě. Čísla se počítají při zobrazení, nikde se neukládají. Obsah organizací — dokumenty a potvrzení — tato role nezpřístupňuje.",
      newTenant: "Nová organizace",
      disabled: "vypnutý",
      noDomain: "žádná doména — portál se nikde neukáže",
      people: "Osoby",
      peopleValue: (signedIn, total) => `${signedIn} / ${total} přihlášených`,
      tracks: "Trasy",
      documents: "Dokumenty",
      documentsValue: (valid, total) => `${valid} / ${total} platných`,
      acknowledgements: "Potvrzení",
      withoutVersion: "bez platného znění",
      instructionsSent: (when, to) => `Pokyny k doméně poslány ${when} na ${to}`,
      domainsNoteBefore: "Stav domén ve Vercelu ukáže ",
      domainsNoteAfter: "; do obrazovky přibude v rozsahu C spolu se zakládáním tenantů.",
    },
    create: {
      back: "← Správa tenantů",
      heading: "Nová organizace",
      introBefore: "Subdoména pod ",
      introMiddle: " funguje hned — pokrývá ji wildcard. Vlastní doména zákazníka se přidá do Vercelu automaticky a zbude mu nastavit jeden ",
      introAfter: ".",
      code: "Kód organizace",
      codeNoteBefore: "Velká písmena, číslice, pomlčka. Nese ho každá osoba, dokument i potvrzení — ",
      codeNoteHighlight: "později se nemění",
      codeNoteAfter: ".",
      name: "Název",
      nameNote: "To, co lidé uvidí v hlavičce portálu.",
      supportEmail: "Kontakt organizace",
      supportEmailNote: "Sem půjdou pokyny k doméně.",
      domains: "Domény",
      domainsPlaceholder: "klub.contineo.app",
      domainsNote: "Jedna na řádek. Bez domény se portál organizace nikde neukáže.",
      submit: "Založit",
    },
    detail: {
      back: "← Správa tenantů",
      disabled: " · vypnutá",
      domainsHeading: "Domény",
      nothingNeeded: (host, reason) => `${host} — netřeba nic (${reason})`,
      notInVercel: "není ve Vercelu",
      waitingForCustomer: "čeká na zákazníka:",
      conflicts: (list) => `v zóně kolidují: ${list}`,
      configuredVia: (via) => `nastaveno (${via})`,
      unverified: ", neověřeno",
      sendTo: "Poslat pokyny na adresu",
      sendHint: (n) =>
        `Odešle se ${n === 1 ? "jeden pokyn" : n < 5 ? `${n} pokyny` : `${n} pokynů`}` +
        " a zaznamená se, komu a kdy.",
      send: "Odeslat pokyny",
      brandingHeading: "Značka a jazyky",
      displayName: "Název v hlavičce",
      shortName: "Zkratka",
      logo: "Logo",
      logoCurrent: "současné",
      logoNote: "PNG, JPEG nebo WebP, nejvýše 256 kB. Prázdné = neměnit. SVG záměrně ne — může obsahovat skript a servírovali bychom cizí kód z domény, na které se potvrzují směrnice.",
      color: "Barva",
      colorNote: "Nese ji tlačítko s bílým textem, proto jsou odstíny tmavší, než by se chtělo — světlejší tón znamená nečitelné tlačítko u zákazníka.",
      supportEmail: "Kontakt organizace",
      supportEmailNote: "Sem chodí pokyny k doméně.",
      languages: "Jazyky prostředí",
      defaultLanguage: "Výchozí jazyk",
      defaultLanguageNote: "Platí pro člověka, který ještě není přihlášený.",
      domains: "Domény",
      domainsNote: "Jedna na řádek. Nové se přidají i do Vercelu. Doména patřící jiné organizaci se odmítne — nepřepíše.",
      autoProvision: "Domény pro automatické založení",
      autoProvisionBefore: "Jedna na řádek. Kdo se přihlásí ",
      autoProvisionHighlight: "pracovním účtem",
      autoProvisionAfter: " z této domény a v seznamu osob ještě není, založí se sám jako běžný člen — bez rolí a bez tras. Platí jen pro účty, ne pro odkaz v e-mailu: účet z adresáře organizace je důkaz příslušnosti, napsaná adresa ne. Prázdné = nikoho nezakládat.",
      save: "Uložit",
      disableHeading: "Vypnout organizaci",
      enableHeading: "Zapnout organizaci",
      disableNote: "Po vypnutí se nikdo z této organizace nepřihlásí — okamžitě. Záznamy potvrzení zůstávají, tenant se nemaže.",
      confirmLabel: (code) => `Napiš ${code} pro potvrzení`,
      confirmHint: "Záměrně to není obyčejné „opravdu?“ — to se odklikne dřív, než se přečte.",
      disable: "Vypnout",
      enable: "Zapnout",
      auditHeading: "Audit",
      auditNote: "Posledních 50 správcovských změn této organizace. Celý výpis s hledáním má zákazník na své doméně v nastavení organizace.",
    },
    signIn: {
      heading: (provider) => `Přihlášení přes ${provider}`,
      state: {
        nastavene: "nastaveno",
        "z-prostredia": "z prostředí",
        necitatelne: "nečitelné",
        nenastavene: "nenastaveno",
      },
      stateLong: {
        nastavene: "nastaveno — vlastní aplikace zákazníka",
        "z-prostredia": "běží z našich proměnných prostředí, ne z vlastní aplikace zákazníka",
        necitatelne: "uloženo, ale nelze přečíst — změnil se šifrovací klíč, zadej údaje znovu",
        nenastavene: "nenastaveno — tlačítko se nenabízí",
      },
      callback: "Adresa návratu — zákazník ji musí zapsat do své aplikace přesně takto:",
      clientId: "Client ID",
      clientSecret: "Client secret",
      clientSecretHint: "Prázdné = neměnit. Hodnota se ukládá zašifrovaná a zpět se nikdy nevypíše.",
      tenantMode: "Režim tenanta",
      tenantModeHint: "organizations = pracovní a školní účty · common = i osobní · nebo UUID jednoho Entra tenanta",
      allowedTenantIds: "Povolená Entra tenant id",
      allowedTenantIdsHint: "Oddělená čárkou. Prázdné = nekontroluje se — u režimu organizations je to jediná zábrana proti tomu, aby se dovnitř dostal člověk z cizí organizace se stejnou adresou.",
      hostedDomain: "Doména Workspace (hd)",
      hostedDomainHint: "Např. futbalsfz.sk. Prázdné = kterýkoli účet Google.",
      save: "Uložit",
      deleteNote: "Odstraněním zmizí tlačítko z přihlašovací obrazovky. Lidem, kteří se přihlašují pracovním účtem, tím přestane fungovat jediná cesta, kterou znají.",
      confirmLabel: (code) => `Napiš ${code} pro potvrzení`,
      deleteSubmit: "Odstranit",
    },
    actions: {
      failed: "Změnu se nepodařilo uložit. Zkus to znovu.",
      addedToVercel: (host) => `${host} přidána do Vercelu`,
      missingVercelToken: (host) => `${host}: chybí VERCEL_TOKEN, doménu přidej ručně`,
      saved: "Uloženo.",
      confirmCodeToDisable: (code) => `Pro vypnutí je třeba napsat kód organizace (${code}). Nic se nezměnilo.`,
      enabled: "Organizace je zapnutá.",
      disabled: "Organizace je vypnutá — nikdo z ní se teď nepřihlásí.",
      created: "Organizace založena.",
      noContact: "Není kam poslat — doplň kontaktní adresu organizace.",
      nothingToSend: "Není co posílat — všechny domény už jsou nasměrované.",
      instructionsSent: (hosts, to) => `Pokyny pro ${hosts} odeslány na ${to}.`,
      signInSaved: (provider) => `Přihlášení přes ${provider} uloženo.`,
      confirmCodeToDelete: (code) => `Pro odstranění napiš kód organizace (${code}).`,
      signInRemoved: (provider) => `Přihlášení přes ${provider} odstraněno.`,
    },
  },
  errors: {
    unknown: "Nepodařilo se to. Zkus to znovu.",

    // ── převod souboru ─────────────────────────────────────────────────────
    "conversion.zipNotOffice": "Toto je ZIP balík, ale ani docx, ani xlsx. Staré .doc a .xls převádět nelze — ulož je ve Wordu nebo Excelu jako novější formát.",
    "conversion.unsupportedFormat": "Formát {format} zatím neumíme převést. Podporujeme .docx, .pdf, .xlsx, .md, .txt a .csv.",
    "conversion.pdfNoText": "V tomto PDF není žádný text — je to obrázek (sken). Převod ho nepřečte. V editoru ho můžeš nechat přepsat jazykovým modelem, nebo si vyžádej od autora původní soubor.",
    "conversion.noText": "Soubor neobsahuje žádný text.",

    // ── uložený soubor ─────────────────────────────────────────────────────
    "file.empty": "Soubor je prázdný.",
    "file.tooLarge": "Soubor má {mb} MB, strop je {maxMb} MB.",

    // ── složky knihovny ────────────────────────────────────────────────────
    "folder.nameRequired": "Název složky je povinný.",
    "folder.parentMissing": "Nadřazená složka neexistuje.",
    "folder.tooDeep": "Struktura může mít nejvýše {max} úrovní.",
    "folder.duplicateName": "Na této úrovni už složka „{name}“ je.",
    "folder.notFound": "Taková složka tu není.",
    "folder.hasChildren": "Složka má podsložky — nejprve je přesuňte nebo zrušte.",
    "folder.hasDocuments": "Ve složce jsou ještě dokumenty (počet: {count}) — nejprve je přeřaďte.",
    "folder.documentNotFound": "Takový dokument tu není.",
    "folder.orderUnknownFolder": "Seznam obsahuje složku, která tu není.",
    "folder.orderSameLevel": "Přeuspořádat lze jen v rámci jedné úrovně.",
    "folder.selfParent": "Složka nemůže být nadřazená sama sobě.",
    "folder.ownSubtree": "Složku nelze přesunout do své vlastní podsložky — vznikl by kruh.",
    "folder.wouldExceedDepth": "Struktura by měla více než {max} úrovní.",

    // ── číselníky ──────────────────────────────────────────────────────────
    "codelist.valueMissing": "Chybí hodnota pro {codelist}.",
    "codelist.unknown": "Číselník {codelist} neexistuje.",
    "codelist.notAllowed": "„{value}“ není platná hodnota pro {codelist}. Povoleno: {allowed}.",
    "codelist.badKeyFor": "„{value}“ nelze použít jako klíč pro {codelist}. Malá písmena bez diakritiky, číslice a podtržítko — klíč jde do identifikátoru dokumentu a do adres.",
    "codelist.badKey": "„{key}“ nelze použít jako klíč. Malá písmena bez diakritiky, číslice a podtržítko — klíčem se označuje obsah a zůstane v něm natrvalo.",
    "codelist.notTenantManaged": "Číselník {codelist} si organizace nespravuje sama — jsou to filtry, na kterých stojí přístup k obsahu.",
    "codelist.tenantMissing": "Organizace neexistuje.",
    "codelist.alreadyThere": "„{key}“ v nabídce už je.",
    "codelist.readOnly": "Tento číselník měnit nelze.",

    // ── osoby ──────────────────────────────────────────────────────────────
    "person.notFound": "Taková osoba tu není.",
    "person.badEmail": "To není e-mailová adresa.",
    "person.emailTaken": "{email} v organizaci už je.",
    "person.alreadyInvited": "{email} je v organizaci už zapsaná.",
    "person.nameRequired": "Jméno je povinné — bez něj je v seznamu jen adresa.",
    "person.nameRequiredShort": "Jméno je povinné.",
    "person.departmentNotFound": "Takové oddělení neexistuje.",
    "person.unknownType": "Neznámý typ osoby.",

    // ── přidělování předpisů ───────────────────────────────────────────────
    "assignment.missingReason": "Důvod přidělení je povinný — je to jediné místo, kde lze zaznamenat, proč se má předpis potvrdit znovu (D30).",
    "assignment.missingCompany": "Chybí kód organizace.",
    "assignment.missingSubject": "Chybí dokument nebo jeho znění.",
    "assignment.versionNotEffective": "Znění nemá datum platnosti, a tak je nelze ani potvrdit (D6). Nejprve mu doplň platnost.",
    "assignment.missingAudience": "Chybí, komu se přiděluje.",

    // ── oddělení ───────────────────────────────────────────────────────────
    "department.nameRequired": "Název oddělení je povinný.",
    "department.parentMissing": "Nadřazené oddělení neexistuje.",
    "department.tooDeep": "Struktura může mít nejvýše {max} úrovní.",
    "department.duplicateName": "Na tomto místě už oddělení „{name}“ je.",
    "department.notFound": "Takové oddělení tu není.",
    "department.personNotFound": "Osoba se nenašla.",
    "department.hasChildren": "Oddělení má podřízená — nejprve je přesuňte nebo smažte.",
    "department.hasPeople": "K oddělení jsou přiřazeni lidé (počet: {count}) — nejprve je přeřaďte.",
    "department.orderUnknown": "Seznam obsahuje oddělení, které tu není.",
    "department.orderSameLevel": "Přeuspořádat lze jen v rámci jedné úrovně.",
    "department.selfParent": "Oddělení nemůže být nadřazené samo sobě.",
    "department.ownSubtree": "Oddělení nelze přesunout pod své vlastní podřízené — vznikl by kruh.",
    "department.wouldExceedDepth": "Struktura by měla více než {max} úrovní. Hlubší strom se ve výběru nedá přehledně ukázat.",

    // ── značka organizace ──────────────────────────────────────────────────
    "brand.unsupportedFormat": "Nepodporovaný formát ({type}). Použij PNG, JPEG nebo WebP. SVG záměrně ne — může obsahovat skript a servírovali bychom cizí kód z vlastní domény.",
    "brand.emptyFile": "Soubor je prázdný.",
    "brand.tooLarge": "Soubor má {kb} kB, nejvýše je {maxKb} kB. V hlavičce má logo 26 px — větší soubor nic nepřidá.",

    // ── domény zákazníka ───────────────────────────────────────────────────
    "domain.notADomain": "To nevypadá jako doména. Například intranet.futbalsfz.sk.",
    "domain.ours": "{domain} je naše doména — subdoménu na ní umíme přidělit jen my.",
    "domain.alreadyYours": "Tuto doménu už používáte.",
    "domain.alreadyTaken": "Tato doména je už v systému zapsaná. Ozvěte se nám.",
    "domain.lastOne": "Toto je vaše poslední doména — bez ní se portál nikde neukáže.",
    "domain.ownedByOther": "Doména {domains} už patří organizaci {owner}.",

    // ── organizace ─────────────────────────────────────────────────────────
    "tenant.badCode": "Kód organizace: 2–24 znaků, velká písmena, číslice, pomlčka nebo podtržítko.",
    "tenant.unknownLanguage": "Neznámý jazyk v {where}: {invalid} (povoleno: {allowed}).",
    "tenant.notFound": "Organizace {code} neexistuje.",
    "tenant.needsDomain": "Bez domény se portál organizace nikde neukáže. Nech aspoň jednu.",
    "tenant.nameRequired": "Název organizace je povinný — je to to, co lidé uvidí v hlavičce.",
    "tenant.alreadyExists": "Organizace {code} už existuje.",
    "tenant.noEncryptionKey": "Tajemství nelze uložit: chybí OAUTH_SECRET_ENCRYPTION_KEY. Ukládat ho čitelně nebudeme — je to přístup do cizího systému.",
    "tenant.needsBothCredentials": "Je potřeba clientId i tajemství — jedno bez druhého použít nelze.",

    // ── knihovna ───────────────────────────────────────────────────────────
    "library.noFileChosen": "Nevybral jsi soubor.",
    "library.documentNotFound": "Takový dokument tu není.",
    "library.noOriginalFile": "Dokument nemá původní soubor, který by šel přepsat.",
    "library.onlyPdfRewrite": "Přepisovat lze jen PDF — ostatní formáty se převedou přímo.",
    "library.originalNotFound": "Původní soubor se nenašel.",
    "library.noDraft": "Žádný návrh tu není.",
    "library.titleRequired": "Název dokumentu je povinný — bez něj je v seznamu jen klíč.",
    "library.emptyText": "Prázdný text uložit nelze — dokument by neměl co obsahovat.",
    "library.labelRequired": "Označení znění je povinné — objeví se doslovně v každém záznamu o potvrzení. Napiš to, co je v dokumentu (například: úplné znění z 27. 2. 2026), ne vymyšlené číslo.",
    "library.effectiveFromRequired": "Datum platnosti je povinné — bez něj znění nelze potvrdit (D6).",
    "library.documentHasNoText": "Dokument nemá text — nejprve nahraj soubor nebo napiš znění.",
    "library.noChunks": "Z textu nevznikl ani jeden úsek. Zkontroluj, jestli má dokument členění na články nebo nadpisy.",
    "library.noPublishedVersion": "Dokument nemá publikované znění — přeindexovat lze jen to, co už je venku.",
    "library.noChunksProfile": "Z textu nevznikl ani jeden úsek — zkontroluj profil členění.",
    "library.reasonRequired": "Důvod opravy je povinný — bez něj se za rok nedá zjistit, jestli šlo o překlep nebo o změnu povinnosti.",
    "library.versionNotFound": "Takové znění tu není.",
    "library.dateChangeNeedsDecision": "Toto znění už bylo potvrzeno (počet potvrzení: {count}) a formulka, kterou lidé podepsali, obsahuje staré datum. Rozhodni, jestli je to oprava zápisu, nebo se má znění potvrdit znovu.",

    // ── přepis jazykovým modelem ───────────────────────────────────────────
    "rewrite.notConfigured": "Přepis modelem není nastavený — chybí ANTHROPIC_API_KEY. Převod v aplikaci funguje dál.",
    "rewrite.emptyInput": "Není co pročišťovat — text je prázdný.",
    "rewrite.textTooLong": "Text má {thousands} tisíc znaků, najednou lze poslat {maxThousands}. Rozděl ho a pročisti po částech.",
    "rewrite.emptyAnswer": "Model vrátil prázdnou odpověď.",
    "rewrite.emptyFile": "Soubor je prázdný.",
    "rewrite.pdfTooLarge": "PDF má {mb} MB, najednou lze poslat {maxMb}. Rozděl ho na části.",
    "rewrite.modelReadNothing": "Model z dokumentu nic nepřečetl.",
  },
  audit: {
    empty: "Zatím tu nic není. Záznamy přibývají při každé správcovské změně — u role, přístupu, oddělení, přidělení i nastavení organizace.",
    subjects: {
      person: "osoba",
      department: "oddělení",
      document: "dokument",
      folder: "složka",
      assignment: "přidělení",
      organisation: "organizace",
      domain: "doména",
      "signin-settings": "přihlašování",
      tenant: "tenant",
    },
    actions: {
      created: "založeno",
      changed: "změněno",
      excluded: "vyřazeno",
      restored: "vráceno",
      renamed: "přejmenováno",
      moved: "přesunuto",
      deleted: "zrušeno",
      assigned: "přiděleno",
      revoked: "odvoláno",
      notified: "oznámeno",
      requested: "požádáno",
      verified: "ověřeno",
      published: "publikováno",
      reindexed: "přeindexováno",
      reordered: "přeuspořádáno",
      "model-draft": "návrh modelu",
      "version-fix": "oprava znění",
      "new-version": "nahráno nové znění",
    },
    fields: {
      email: "adresa",
      fullName: "jméno",
      department: "oddělení (text)",
      departmentId: "oddělení",
      personType: "typ osoby",
      status: "stav",
      language: "jazyk",
      tracks: "trasy",
      groups: "skupiny",
      roles: "role",
      name: "název",
      parentId: "nadřazené oddělení",
      clientId: "clientId",
      clientSecret: "tajemství",
      hostnames: "domény",
      autoProvisionDomains: "domény pro automatické zakládání",
      "branding.displayName": "název",
      "branding.shortName": "zkratka",
      "branding.accentColor": "barva",
      "branding.logoUrl": "logo",
      "branding.supportEmail": "kontakt",
    },
    none: "—",
  },
  colors: {
    palette: {
      "#232a35": "grafitová (výchozí)",
      "#1f4ed8": "modrá",
      "#0e7490": "petrolejová",
      "#047857": "zelená",
      "#4d7c0f": "olivová",
      "#b45309": "jantarová",
      "#b91c1c": "červená",
      "#9f1239": "vínová",
      "#6d28d9": "fialová",
      "#334155": "břidlicová",
    },
    showCustom: "Zadat vlastní hodnotu",
    hideCustom: "Skrýt vlastní hodnotu",
  },
  org: {
    heading: "Organizace",
    introBefore: "Nastavení, které si spravujete sami. Kód organizace (",
    introAfter: ") a vypnutí portálu tu záměrně nejsou — s tím se ozvěte nám.",
    tabsLabel: "Části nastavení",
    tabs: {
      branding: "Vzhled a jazyky",
      departments: "Oddělení",
      domains: "Domény",
      signin: "Přihlašování",
      codelists: "Číselníky",
      chunking: "Členění",
      audit: "Audit",
    },
    branding: {
      name: "Název",
      nameNote: "Celý název. Je v e-mailech a na přihlašovací obrazovce.",
      shortName: "Zkratka",
      shortNameNote: "Do horní lišty, kde je vedle ní ještě menu — „SFZ“ tam řekne totéž co celý název a nechá místo na zbytek.",
      logo: "Logo",
      logoCurrent: "současné",
      logoNote: "PNG, JPEG nebo WebP, nejvýše 256 kB. Prázdné = neměnit.",
      color: "Barva",
      colorNote: "Nese ji tlačítko s bílým textem, proto jsou odstíny tmavší, než by se chtělo — světlejší tón znamená nečitelné tlačítko.",
      supportEmail: "Kontaktní adresa",
      supportEmailNote: "Kam se má obrátit člověk, kterému něco nesedí.",
      languages: "Jazyky",
      defaultLanguage: "Výchozí jazyk",
      defaultLanguageNote: "Platí pro člověka, který ještě není přihlášený.",
      autoProvision: "Domény pro automatické založení",
      autoProvisionBefore: "Jedna na řádek. Kdo se přihlásí ",
      autoProvisionHighlight: "pracovním účtem",
      autoProvisionAfter: " z této domény a v seznamu osob ještě není, založí se sám jako běžný člen — bez rolí a bez tras. Platí jen pro účty, ne pro odkaz v e-mailu.",
      save: "Uložit",
    },
    departments: {
      heading: "Organizační struktura",
      introBefore: "Pořadí se dá měnit tažením myší nebo šipkami po rozbalení položky — organizační schéma není abecední seznam. Oddělení je ",
      introHighlight: "kam člověk patří",
      introMiddle: " — právě jedno, jako v organizačním schématu. Kdo se má oslovit napříč odděleními (rozhodčí, delegáti, statutáři), na to jsou ",
      groupsLink: "skupiny",
      introAfter: "; ty se s odděleními nemíchají a jeden člověk jich může mít víc.",
      empty: "Zatím tu nic není. Založ první oddělení níže — pokud už máte oddělení zapsaná u lidí jako text, ozvěte se nám a převedeme je najednou.",
      withDescendants: (n) => ` (${n} i s podřízenými)`,
      moveUp: (name) => `Posunout ${name} výš`,
      up: "↑ výš",
      moveDown: (name) => `Posunout ${name} níž`,
      down: "↓ níž",
      nameOf: (name) => `Název oddělení ${name}`,
      rename: "Přejmenovat",
      parentOf: (name) => `Nadřazené oddělení pro ${name}`,
      topLevel: "— nejvyšší úroveň —",
      move: "Přesunout",
      remove: "Zrušit oddělení",
      removeHint: "Zrušit se dá až prázdné oddělení bez podřízených — jinak by lidé zmizeli ze struktury, aniž by si toho někdo všiml.",
      newHeading: "Nové oddělení",
      name: "Název",
      namePlaceholder: "Úsek komunikace",
      parent: "Nadřazené oddělení",
      maxDepth: (n) => `Struktura může mít nejvýše ${n} úrovní. Není to technický limit — hlubší strom se na telefonu nedá přehledně ukázat a to, co je v něm nejhlouběji, bývá ve skutečnosti skupina.`,
      create: "Založit",
    },
    domains: {
      works: "funguje",
      remove: "Odstranit",
      waitingDns: "čeká na DNS",
      since: (date) => `od ${date}`,
      dnsBefore: "U svého správce DNS přidejte ",
      dnsMiddle: " záznam ",
      verify: "Ověřit a zapnout",
      cancelRequest: "Zrušit žádost",
      add: "Přidat vlastní doménu",
      hostPlaceholder: "intranet.vaseorganizace.cz",
      addNote: "Doména se zapne až tehdy, když na nás začne směrovat DNS. Nastavit to umí jen ten, kdo ji opravdu ovládá — a je to jediný důkaz, který existuje. Bez něj by si kdokoli mohl připsat cizí doménu.",
      request: "Požádat",
    },
    signIn: {
      heading: (provider) => `Přihlášení přes ${provider}`,
      stateOn: "zapnuto",
      stateFromSupplier: "z nastavení dodavatele",
      stateUnreadable: "nečitelné",
      stateOff: "vypnuto",
      introBefore: "Aplikaci si zaregistrujete ",
      introHighlight: (provider) => `ve vlastním ${provider} adresáři`,
      introAfter: " — vy udělujete souhlas, vy vidíte, kdo se přihlašoval, a vy můžete přístup kdykoli odvolat. My hodnotu tajemství nikdy nevidíme.",
      callback: "Adresa návratu — zapište ji do své aplikace přesně takto:",
      clientId: "Client ID",
      clientSecret: "Client secret",
      clientSecretNote: "Prázdné = neměnit. Ukládá se zašifrované a zpět se nikdy nevypíše.",
      tenantMode: "Režim tenanta",
      tenantModeBefore: "U aplikace pro jediný adresář sem patří vaše ",
      tenantModeHighlight: "Directory (tenant) ID",
      tenantModeAfter: ". „organizations“ = pracovní a školní účty odkudkoli, „common“ = i osobní.",
      allowedTenantIds: "Povolená Entra tenant id",
      allowedTenantIdsNote: "Prázdné = nekontroluje se. U režimu „organizations“ je to jediná zábrana proti tomu, aby se dovnitř dostal člověk z cizí organizace, který má stejnou adresu jako někdo u vás.",
      hostedDomain: "Doména Workspace",
      save: "Uložit",
      deleteNote: "Odstraněním zmizí tlačítko z přihlašovací obrazovky. Lidem, kteří se přihlašují pracovním účtem, tím přestane fungovat jediná cesta, kterou znají.",
      confirmLabel: (code) => `Napište ${code} pro potvrzení`,
      deleteSubmit: "Odstranit",
    },
    codelists: {
      introBefore: "Čím označujete vlastní obsah v knihovně. Základní hodnoty jsou tu vždy — je jimi označený existující obsah a jejich zmizení by z něj udělalo neplatné údaje. Odebrat se dá jen to, co jste přidali vy, a i tehdy zmizí ",
      introHighlight: "jen z nabídky",
      introAfter: ": dokumenty, které hodnotu mají, si ji nesou dál.",
      labels: {
        category: {
          name: "Druhy dokumentů",
          hint: "Čím dokument je: norma, směrnice, metodický pokyn, zápis…",
        },
        tags: {
          name: "Značky",
          hint: "Volné třídění napříč druhy — například mládež, rozhodčí, finance.",
        },
      },
      base: " · základní",
      used: (n) => ` · použita ${n}×`,
      remove: "Odebrat",
      newItemPlaceholder: "Metodický pokyn",
      newItemLabel: (codelist) => `Název nové položky — ${codelist}`,
      key: "Klíč",
      keyPlaceholder: "metodicky_pokyn",
      add: "Přidat",
      keyNote: "Klíč: malá písmena bez diakritiky, číslice a podtržítko. Zůstává v obsahu natrvalo, takže se nedá vzít zpět — název vedle něj se měnit dá.",
    },
    chunking: {
      heading: "Členění dokumentů na úseky",
      introBefore: "Vyhledávání nepracuje s celým dokumentem — model dostane několik úseků a odpovídá z nich. Tyto hodnoty určují, jak se dokument na úseky řeže.",
      introHighlight: " S textem normy ani s potvrzeními to nemá nic společného:",
      introAfter: " členění se dá měnit kolikrát je třeba a nikomu nenaskočí povinnost potvrzovat znovu.",
      articleWord: "Slovo, kterým začíná článek",
      articleNote1: "Výchozí je ",
      articleNote2: ". Předpisy členěné na ",
      articleNote3: " nebo na ",
      articleNote4: " se bez této změny slijí do jednoho bloku a vyhledávání nemá čeho se chytit. Je to ",
      articleNoteHighlight: "slovo, ne vzor",
      articleNote5: " — okolí si doplní systém.",
      annexWord: "Slovo, kterým začíná příloha",
      annexWordNote: "Přílohy stojí mimo číslování článků — bez rozpoznání by spadly pod poslední článek a citace by lhala.",
      headerRepeats: "Řádek je hlavička, když se opakuje víckrát než",
      headerRepeatsNote: "Hlavičky a patičky se v PDF opakují na každé straně. Nižší číslo odstraní víc šumu, ale u krátkého dokumentu může sežrat i obsah.",
      minTokens: "Cílová velikost úseku — od (tokenů)",
      maxTokens: "Cílová velikost úseku — do (tokenů)",
      tokensNoteBefore: "Malý úsek znamená tisíce úryvků bez kontextu, velký zase jeden úsek na celý dokument. Výchozí ",
      tokensNoteAfter: " je odladěné na slovenských předpisech.",
      saveNoteBefore: "Uložení ",
      saveNoteHighlight: "nepřeindexuje existující dokumenty",
      saveNoteMiddle: ". Vyzkoušej nový profil nejdřív na jednom — v jeho detailu v knihovně je tlačítko ",
      saveNoteButton: "Přeindexovat",
      saveNoteAfter: ".",
      save: "Uložit členění",
      reindexAllHeading: "Přeindexovat vše",
      allUpToDate: (total) => `Všech ${total} dokumentů je nařezaných podle tohoto profilu. Není co přeindexovat.`,
      outdatedOf: (total) => ` z ${total} dokumentů je nařezaných jinak, než říká tento profil. Přeindexování `,
      outdatedHighlight: "nemění znění ani potvrzení",
      outdatedAfter: " — vymění jen úseky, ze kterých čte vyhledávání.",
      batchNote: "Zpracuje se nejvýše 25 dokumentů najednou. Není to opatrnost navíc: u větší dávky by běh spadl na časovém stropu a část dokumentů by zůstala nařezaná po starém. Když něco zůstane, stiskni to znovu — hotové se přeskočí.",
      reindexAll: (n) => `Přeindexovat (${n})`,
    },
    actions: {
      saved: "Změny byly uloženy.",
      failed: "Změnu se nepodařilo uložit. Zkus to znovu.",
      confirmCode: (code) => `Pro odstranění napiš kód organizace (${code}).`,
      signInRemoved: "Přihlašovací údaje odstraněny.",
      domainRequested: "Zapsáno. Teď nastavte CNAME u svého správce DNS a dejte ověřit.",
      domainNotFound: "Takovou žádost tu nemáme.",
      domainWaiting: (host) =>
        `${host} zatím nesměruje na nás. Změna DNS bývá viditelná do hodiny;` +
        " pokud je to déle, zkontrolujte CNAME.",
      domainOnNotInVercel: (host) => `${host} je zapnutá, ale do Vercelu se nepřidala — ozvěte se nám.`,
      domainOn: (host) => `${host} je zapnutá. Portál na ní odpovídá.`,
      domainRemoved: "Doména odstraněna. Portál na ní přestal odpovídat.",
      codelistRemoved: "Odebráno z nabídky. Dokumenty, které tuto hodnotu mají, si ji nesou dál.",
      chunkingSaved: "Uloženo. Existující dokumenty se nepřeindexovaly — spusť to u konkrétního dokumentu.",
      reindexedCount: (n) => `přeindexováno ${n}`,
      reindexSkipped: (n) => `beze změny ${n}`,
      reindexRemaining: (n) => `zbývá ${n} — spusť znovu`,
      reindexErrors: (list) => `chyby: ${list}`,
    },
    auditTab: {
      introBefore: "Kdo, co a kdy změnil. Zapisuje se každá správcovská změna — role, přístup, oddělení, přidělení i nastavení organizace. Záznamy se",
      introHighlight: " nedají upravit ani smazat",
      introAfter: "; to je celý smysl. Tajemství (např. client secret) jsou tu jen jako „změněno“ — audit, který sbírá hesla, je sám o sobě únik.",
      search: "Hledat",
      searchPlaceholder: "jméno, adresa, oddělení…",
      searchSubmit: "Hledat",
      clearFilter: "zrušit filtr",
      capped: "Ukazuje se nejnovějších 200 záznamů. Starší se dají vyhledat polem výše — načíst je všechny najednou by obrazovku shodilo právě tehdy, když ji někdo otevře kvůli kontrole.",
    },
  },
  people: {
    types: {
      employee: "zaměstnanec",
      external: "externí",
      referee: "rozhodčí",
      official: "funkcionář",
    },
    languages: {
      sk: "slovenština",
      cs: "čeština",
      en: "angličtina",
    },
    roles: {
      hr: "hr — přiděluje normy a vidí, kdo je nepotvrdil",
      "people-admin": "people-admin — spravuje osoby (tato obrazovka)",
      "spravca-obsahu": "spravca-obsahu — nahrává a upravuje normy v knihovně",
    },
    list: {
      heading: "Osoby",
      introBefore: "Kdo do organizace patří. Osoba se ",
      introHighlight: "nemaže",
      introAfter: " — vyřazení ji odstřihne od portálu, ale její potvrzení zůstávají platnými záznamy.",
      invite: "Pozvat osobu",
      importCsv: "Import z CSV",
      searchPlaceholder: "Hledat ve jménu, adrese nebo oddělení",
      nothingFound: "Nic se nenašlo.",
      count: (n) => `${n} ${n === 1 ? "osoba" : n < 5 ? "osoby" : "osob"}`,
      matchesSearch: " vyhovuje hledání",
      capped: " — zobrazeno prvních 500, zužte hledání",
      status: {
        invited: "pozvaná",
        active: "aktivní",
        inactive: "vyřazená",
      },
      neverSignedIn: "nepřihlášená",
    },
    invite: {
      back: "← Zpět na seznam",
      heading: "Pozvat osobu",
      introBefore: "Zapíše se do organizace ",
      introAfter: ". Skupiny a trasy se doplní na jejím detailu — po pozvání tam přijdeš rovnou.",
      email: "E-mailová adresa",
      emailNote: "Později se měnit dá, ale je to adresa, na kterou chodí přihlašovací odkaz. Zkontroluj ji.",
      fullName: "Jméno",
      department: "Oddělení",
      personType: "Typ osoby",
      language: "Jazyk prostředí",
      languageNote: "Skupiny a trasy se vybírají až na detailu — tam už je vidět, co v organizaci existuje.",
      submit: "Pozvat",
    },
    import: {
      back: "← Zpět na seznam",
      heading: "Import z CSV",
      introBefore: "Nejdřív uvidíš, ",
      introHighlight: "co by se stalo",
      introMiddle: ", a zapíše se až potom. Nahrání stovky lidí naslepo je přesně ta operace, po které se hledá, jak to vrátit zpět — a vrátit se nedá. Všichni se zapíšou do organizace ",
      introAfter: ", i když je v souboru něco jiného.",
      file: "Soubor CSV",
      fileNoteBefore: "První řádek jsou hlavičky. Rozpoznají se ",
      fileNoteAfter: " — i bez diakritiky a se středníkem jako oddělovačem, tak jak to ukládá Excel.",
      reading: "Čtu…",
      whatHappens: (name) => `Co se stane — ${name}`,
      rows: "Řádků",
      willAdd: "Přibude",
      willUpdate: "Aktualizuje se",
      invalid: "Chybných",
      added: "Přibudou",
      andMore: (n) => ` … a dalších ${n}`,
      skippedRows: "Tyto řádky se přeskočí",
      statusNoteBefore: "Existujícím osobám se ",
      statusNoteHighlight: "nemění stav",
      statusNoteAfter: " — kdo se už přihlásil, zůstává přihlášený. Nevyplněný jazyk se nepřepíše.",
      write: "Zapsat",
      writing: "Zapisuji…",
      reasons: {
        "invalid-email": "neplatná e-mailová adresa",
        "missing-companyCode": "chybí organizace (companyCode)",
        "missing-name": "chybí jméno",
        "duplicate-in-file": "duplicita přímo v souboru",
      },
    },
    detail: {
      back: "← Zpět na seznam",
      previously: (list) => `dříve ${list}`,
      invitedNotSignedIn: "pozvaná, ještě se nepřihlásila",
      excludedNoSignIn: "vyřazená — nepřihlásí se",
      lastSeen: (when) => `naposledy ${when}`,
      never: "—",
      signsInVia: (list) => `přihlašuje se přes ${list}`,
      email: "E-mailová adresa",
      emailNote: "Změnit se dá — identita člověka na ní nestojí. Potvrzení se vážou na jeho záznam, ne na adresu, takže historie zůstává celá a stará adresa se uloží do jeho historie. Změní se tím to, kam chodí přihlašovací odkaz; přihlášení pracovním účtem funguje dál.",
      fullName: "Jméno",
      jobTitle: "Pozice",
      jobTitleNote: "Evidenční údaj. Doplňuje se z pracovního účtu, když ho tam adresář má — ale jen když je tu prázdný, takže ruční oprava vydrží.",
      department: "Oddělení",
      departmentNone: "— bez oddělení —",
      noDepartmentsBefore: "Struktura je zatím prázdná. Oddělení se zakládají v ",
      noDepartmentsLink: "nastavení organizace",
      noDepartmentsAfter: ".",
      departmentNote: "Právě jedno — oddělení je místo ve struktuře. Kdo se má oslovit napříč odděleními, na to jsou skupiny níže.",
      placement: (path) => ` Zařazení: ${path}.`,
      legacyDepartmentBefore: "Původně tu bylo zapsáno textem: ",
      legacyDepartmentAfter: ". Zůstává to uložené, dokud se nezařadí do struktury — aby bylo vidět, z čeho oddělení vzniklo.",
      personType: "Typ osoby",
      personTypeNote: "Evidenční údaj. O přístupu k obsahu nerozhoduje — ten řeší organizace a úroveň dokumentu.",
      language: "Jazyk prostředí",
      languageNote: "V čem se s člověkem bavíme. Ne jazyk dokumentů, které čte.",
      groups: "Skupiny",
      newGroup: "nová skupina, např. rozhodčí",
      groupsNote: "Podle nich se přidělují normy. Číslo je počet lidí, kteří skupinu mají — skupina, kterou nemá nikdo, nedostane nic.",
      tracks: "Trasy onboardingu",
      newTrack: "nová trasa, např. zaklad-2026",
      roles: "Role",
      rolesNote: "Správce platformy se odsud přidělit nedá — patří tenantovi dodavatele a má vlastní cestu.",
      save: "Uložit",
      returnHeading: "Vrátit osobu",
      excludeHeading: "Vyřadit osobu",
      returnNoteBefore: "Vrátí se jako ",
      returnNoteHighlight: "pozvaná",
      returnNoteAfter: ", ne aktivní — aktivní znamená „už se přihlásila“ a to se vrácením nestalo. Přepne ji první přihlášení.",
      returnSubmit: "Vrátit",
      excludeNote: "Po vyřazení se nepřihlásí — okamžitě. Záznam ani její potvrzení se nemažou; jsou to platné doklady o tom, co si přečetla, a musí přežít její odchod.",
      confirmLabel: "Napiš adresu pro potvrzení",
      confirmNote: "Záměrně to není „opravdu?“ — to se odklikne dřív, než se přečte.",
      excludeSubmit: "Vyřadit",
    },
    actions: {
      saved: "Uloženo.",
      invited: "Pozvaná. Přihlásí se, až si sama vyžádá odkaz nebo použije pracovní účet.",
      excluded: "Vyřazená. Záznam a její potvrzení zůstávají.",
      returned: "Vrácená. Přihlásí se a stav se přepne sám.",
      confirmAddress: (email) => `Pro vyřazení napiš adresu (${email}).`,
      failed: "Změnu se nepodařilo uložit. Zkus to znovu.",
      noRight: "Nemáš na to právo.",
      fileEmpty: "Soubor je prázdný.",
      noRows: "V souboru není ani jeden řádek s údaji. Má první řádek hlavičky?",
      importResult: (created, updated, unchanged, invalid) =>
        `Přibylo ${created}, změněných ${updated}, beze změny ${unchanged}` +
        (invalid ? `, chybných ${invalid}` : "") + ".",
    },
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
    detail: {
      back: "← Zpět do knihovny",
      documentData: "Údaje o dokumentu",
      title: "Název",
      titleNote: "Měnit se dá. Objeví se v dalších potvrzeních; staré záznamy si nesou kopii názvu z doby potvrzení, takže se zpětně nezmění.",
      scope: "Působnost",
      accessLevel: "Přístupnost",
      documentLanguage: "Jazyk dokumentu",
      category: "Druh",
      unset: "— neurčeno —",
      tags: "Značky",
      newTag: "Nová značka",
      keyNoteBefore: "Klíč ",
      keyNoteAfter: " se měnit nedá — je v úsecích, v přiděleních i v záznamech o potvrzení. Změna by nebyla přejmenování, ale druhý dokument, ke kterému by se historie nedostala.",
      save: "Uložit údaje",
      folder: "Složka",
      folderUnfiled: "— nezařazeno —",
      folderNote: "Složky jsou jen zařazení — soubor ani text se nikam nepřesouvá. Filtr v knihovně najde dokument i přes nadřazenou složku.",
      assign: "Zařadit",
      text: "Text",
      openEditor: "otevřít editor →",
      originalFile: "Původní soubor:",
      uploadedBy: (who, when) => `nahrál ${who} ${when}`,
      conversionMethod: (method) => `převod: ${method}`,
      noOriginal: "Bez původního souboru — dokument se sem dostal importem z příkazové řádky.",
      draftDiffers: "Koncept se liší od publikovaného znění.",
      draftSame: "Koncept je shodný s publikovaným zněním.",
      draftEmpty: "Koncept je prázdný.",
      publishHeading: "Publikovat znění",
      nothingToPublish: "Není co publikovat — koncept je prázdný nebo shodný s tím, co už platí.",
      versionLabel: "Označení znění",
      versionLabelPlaceholder: "úplné znění z 27. 2. 2026",
      labelNoteBefore: "Objeví se ",
      labelNoteHighlight: "doslovně v každém záznamu o potvrzení",
      labelNoteAfter: ". Napiš to, co je v dokumentu — ne vymyšlené číslo verze, které se za rok nedá s ničím spojit.",
      effectiveFrom: "Platné od",
      effectiveFromNote: "Povinné. Znění bez data platnosti se nedá ani potvrdit a formulka ho obsahuje doslovně.",
      effectiveFromSource: "Odkud je datum",
      effectiveFromSourcePlaceholder: "čl. 62 odst. 2 — účinnost dnem schválení VV SFZ 27. 2. 2026",
      effectiveFromSourceNote: "Citace ustanovení o účinnosti. Datum bez původu se za rok nedá ověřit — a přitom je v každém záznamu o potvrzení.",
      changeNote: "Co se změnilo",
      changeNotePlaceholder: "novela čl. 12 a 18",
      publish: "Publikovat",
      reindexHeading: "Přeindexovat",
      reindexNoteBefore: "Nařeže platné znění znovu podle aktuálního profilu členění. ",
      reindexNoteHighlight: "Nevytvoří novou verzi",
      reindexNoteAfter: " — text se nemění, takže potvrzení zůstávají platná a nikomu nenaskočí povinnost potvrzovat znovu. Používá se po vyladění profilu v nastavení organizace.",
      reindex: "Přeindexovat",
      versionsHeading: (n) => `Znění (${n})`,
      nothingPublished: "Zatím nic nebylo publikováno, takže se nedá ani přidělit k potvrzení.",
      active: "aktivní",
      archived: "archivováno",
      effectiveFromOn: (date) => `platné od ${date}`,
      noEffectiveDate: "bez data platnosti",
      effectiveTo: (date) => `do ${date}`,
      dateSource: (source) => `zdroj data: ${source}`,
      fix: "opravit údaje",
      fixLabel: "Označení",
      fixEffectiveFromNoteBefore: "Datum je ",
      fixEffectiveFromNoteHighlight: "doslovně",
      fixEffectiveFromNoteAfter: " ve formulce, kterou lidé podepsali. Pokud ho měníš a znění už někdo potvrdil, budeš muset rozhodnout, jestli jde o opravu zápisu, nebo o změnu, kterou je třeba potvrdit znovu.",
      fixReason: "Důvod opravy",
      fixReasonPlaceholder: "překlep v označení; datum z usnesení VV SFZ",
      fixReasonNote: "Povinný. Bez něj se za rok nedá zjistit, jestli šlo o překlep nebo o změnu povinnosti.",
      onDateChange: "Pokud se mění datum a znění už někdo potvrdil",
      onDateChangeAsk: "— rozhodnu, až když se zeptá —",
      onDateChangeCorrection: "oprava zápisu, potvrzení zůstávají",
      onDateChangeReacknowledge: "podstatná změna, potvrdit znovu",
      fixSubmit: "Opravit",
    },
    editor: {
      back: "← Zpět na dokument",
      intro: "Porovnej text s originálem. Publikování je samostatný krok — tady se nic nepouští ven.",
      modelDraft: "návrh modelu",
      modeRewriteScan: "přepis skenu",
      modeClean: "pročištění členění",
      draftMeta: (model, when, chars) => `${model} · ${when} · ${chars} znaků`,
      draftNoteBefore: "Model měl zakázáno měnit znění — ",
      draftNoteHighlight: "ověř to",
      draftNoteAfter: ". Přijetím se návrh stane konceptem; původní text se tím přepíše.",
      useAsDraft: "Použít jako koncept",
      discard: "Zahodit",
      original: "Originál",
      pdfNotShown: "Prohlížeč PDF nezobrazí. ",
      openInNewWindow: "Otevři ho v novém okně",
      fileNotShown: (name) => `${name} se v prohlížeči nezobrazí. `,
      download: "Stáhni ho",
      compareAfterDownload: " a porovnej vedle.",
      noOriginal: "Bez původního souboru — dokument se sem dostal importem z příkazové řádky, takže není co porovnávat.",
      text: "Text",
      switchNoteBefore: " — přepínač ",
      switchNoteModes: "Markdown / WYSIWYG",
      switchNoteAfter: " je dole v editoru",
      saveText: "Uložit text",
      llmHeading: "Pomoc jazykového modelu",
      llmNoteBefore: "Volá se jen takto — kliknutím. Výsledek se uloží jako ",
      llmNoteHighlight: "návrh vedle textu",
      llmNoteAfter: ", ne do něj: model má zakázáno měnit znění, ale tichou změnu v předpisu by nikdo nezachytil, kdyby se zapisovala rovnou.",
      clean: "Pročistit členění",
      rewriteScan: "Přepsat ze skenu",
      rewriteScanNote: "„Přepsat ze skenu“ pošle celé původní PDF modelu. Má smysl tehdy, když PDF nemá textovou vrstvu nebo je převod rozsypaný.",
    },
    actions: {
      converted: "Převedeno. Přečti text a porovnej ho s originálem.",
      convertedWithWarnings: (warnings) => `Převedeno. ${warnings}`,
      saved: "Uloženo.",
      changesSaved: "Změny byly uloženy.",
      alreadyPublished: "Toto znění už publikované je — nic se nezměnilo.",
      published: (chunks, archived) =>
        `Publikováno: ${chunks} ${chunks === 1 ? "úsek" : chunks < 5 ? "úseky" : "úseků"},` +
        ` ${archived} starých archivováno.`,
      modelReturnedDraft: "Model vrátil návrh. Porovnej ho s dosavadním textem a rozhodni se.",
      draftAccepted: "Návrh je teď konceptem. Publikování je stále samostatný krok.",
      draftDiscarded: "Návrh zahozen.",
      assigned: "Zařazeno.",
      reindexUpToDate: "Členění je už aktuální — nic se neměnilo.",
      reindexed: (chunks, archived) =>
        `Přeindexováno: ${chunks} ${chunks === 1 ? "úsek" : chunks < 5 ? "úseky" : "úseků"},` +
        ` ${archived} starých archivováno. Znění ani potvrzení se nedotklo.`,
      fixedNeedsReacknowledge: (people) =>
        "Opraveno. Znění je označeno jako vyžadující nové potvrzení —" +
        ` týká se to ${people} ${people === 1 ? "člověka" : "lidí"}.`,
      fixed: "Opraveno. Potvrzení zůstávají platná.",
      failed: "Nepodařilo se to. Zkus to znovu.",
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
    metaTitle: "Contineo — test interface",
    metaDescription: "Checking the quality of answers over regulations and directives.",
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
    noResults: "I found no information relevant to your question in the available documents.",
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
  goldenSet: {
    heading: "Golden set",
    intro: "The questions are proposals. If one makes no sense or sounds unnatural, edit it or drop it — that is just as valuable as a verdict on the answer.",
    reviewedLabel: "Reviewed",
    doneOf: (done, total) => `${done} of ${total}`,
    correct: "correct",
    incorrect: "incorrect",
    withHallucination: "with a hallucination",
    excluded: "excluded",
    overlapCount: (done, total) => `${done} of ${total}`,
    overlapNote: " precedence questions and traps have a verdict from two people. For those, the other verdict appears only after you have given yours — otherwise the agreement rate would measure whether you believed the first reviewer, nothing more.",
    areas: {
      pravo: "legal",
      prevadzka: "operations",
      oboje: "anyone",
    },
    badges: {
      trap: (type) => `trap · ${type}`,
      edited: "edited",
      reviewedByTwo: "reviewed by two",
      waitingForSecond: "waiting for the second",
      forTwo: "for two",
      hallucination: "hallucination",
      excluded: "excluded",
      correct: "correct",
      incorrect: "incorrect",
      disagreement: "disagreement",
      waitingForYou: "waiting for you",
      reviewed: "reviewed",
      notReviewed: "not reviewed",
    },
    detail: {
      back: "← Back to the list",
      saving: "saving…",
      saved: "saved",
      saveFailed: "not saved",
      twoReviewersHeading: "Two people review this question independently.",
      twoReviewersNote: "If someone has already reviewed it, you will see their verdict only after you have given yours. This is not secrecy — if you saw it beforehand, we would be measuring whether you believed them, not whether you agree.",
      othersHeading: "How the others judged it",
      verdict: {
        correct: "correct",
        incorrect: "incorrect",
        none: "not reviewed",
      },
      trapHeading: "This is a deliberate test.",
      trapBeforeBehaviour: " Here the system ",
      trapAfterBehaviour: " — judge whether it behaved that way, not whether it answered exhaustively.",
      traps: {
        out_of_domain: "The question is outside the uploaded documents. The system should refuse, not answer.",
        ambiguous_conflict: "The regulations contradict each other here. The system should not rule authoritatively — it should flag the conflict and offer escalation, because interpretation belongs to a person.",
        access_control: "A public user is asking about internal content. The system must not reveal it.",
        historical_version: "The question targets an older version. The system should cite the version effective at that time, not today's.",
      },
      behaviours: {
        answer: "should answer on the merits",
        refuse: "should refuse",
        escalate: "should offer escalation",
      },
      excludedHeading: "This question is excluded.",
      returnToSet: "Return it to the set",
      editLabel: "The wording of the question — write it the way a real person would ask.",
      saveText: "Save the wording",
      cancel: "Cancel",
      restoreOriginal: "Restore the original",
      originally: (text) => `originally: “${text}”`,
      edit: "Edit",
      nextQuestion: "Next question →",
      excludeQuestion: "Exclude the question",
      excludePrompt: "Why does the question make no sense?",
    },
    rating: {
      heading: "How do you rate this answer?",
      saving: "saving…",
      saved: "saved",
      saveFailed: "not saved",
      correctQuestion: "Is the answer factually correct?",
      yes: "Yes",
      no: "No",
      hallucinationQuestion: "Does it claim something the sources do not contain?",
      yesInvented: "Yes, it made something up",
      noGrounded: "No, everything is grounded",
      showDetail: "Add the correct answer and the provisions",
      hideDetail: "Hide the additions",
      expectedAnswer: "How should the answer have read?",
      sources: "Which regulations and provisions govern this? For example “SP Art. 78, DP Art. 37”.",
      note: "A note — what was misleading or incomplete about the answer?",
    },
  },
  admin: {
    list: {
      heading: "Tenant administration",
      intro: "An overview of the organisations on the platform. The numbers are computed when the page is opened and are stored nowhere. This role does not give access to the organisations' content — documents and acknowledgements.",
      newTenant: "New organisation",
      disabled: "disabled",
      noDomain: "no domain — the portal will not appear anywhere",
      people: "People",
      peopleValue: (signedIn, total) => `${signedIn} / ${total} signed in`,
      tracks: "Tracks",
      documents: "Documents",
      documentsValue: (valid, total) => `${valid} / ${total} effective`,
      acknowledgements: "Acknowledgements",
      withoutVersion: "no effective version",
      instructionsSent: (when, to) => `Domain instructions sent ${when} to ${to}`,
      domainsNoteBefore: "The state of the domains in Vercel is shown by ",
      domainsNoteAfter: "; it will appear on this screen in scope C, together with tenant creation.",
    },
    create: {
      back: "← Tenant administration",
      heading: "New organisation",
      introBefore: "A subdomain under ",
      introMiddle: " works straight away — a wildcard covers it. A customer's own domain is added to Vercel automatically and all that is left for them is to set one ",
      introAfter: ".",
      code: "Organisation code",
      codeNoteBefore: "Capital letters, digits, hyphen. Every person, document and acknowledgement carries it — ",
      codeNoteHighlight: "it never changes afterwards",
      codeNoteAfter: ".",
      name: "Name",
      nameNote: "What people will see in the portal header.",
      supportEmail: "Organisation contact",
      supportEmailNote: "The domain instructions go here.",
      domains: "Domains",
      domainsPlaceholder: "club.contineo.app",
      domainsNote: "One per line. Without a domain the organisation's portal will not appear anywhere.",
      submit: "Create",
    },
    detail: {
      back: "← Tenant administration",
      disabled: " · disabled",
      domainsHeading: "Domains",
      nothingNeeded: (host, reason) => `${host} — nothing needed (${reason})`,
      notInVercel: "not in Vercel",
      waitingForCustomer: "waiting for the customer:",
      conflicts: (list) => `conflicting records in the zone: ${list}`,
      configuredVia: (via) => `configured (${via})`,
      unverified: ", unverified",
      sendTo: "Send the instructions to",
      sendHint: (n) =>
        `${n === 1 ? "One instruction" : `${n} instructions`} will be sent,` +
        " and who received it and when is recorded.",
      send: "Send the instructions",
      brandingHeading: "Branding and languages",
      displayName: "Name in the header",
      shortName: "Short name",
      logo: "Logo",
      logoCurrent: "current",
      logoNote: "PNG, JPEG or WebP, at most 256 kB. Empty = leave unchanged. SVG deliberately not — it can carry a script, and we would be serving someone else's code from the domain where directives are acknowledged.",
      color: "Colour",
      colorNote: "Buttons carry it with white text on top, which is why the shades are darker than you might want — a lighter tone means an unreadable button at the customer's end.",
      supportEmail: "Organisation contact",
      supportEmailNote: "The domain instructions go here.",
      languages: "Interface languages",
      defaultLanguage: "Default language",
      defaultLanguageNote: "Applies to anyone who is not signed in yet.",
      domains: "Domains",
      domainsNote: "One per line. New ones are added to Vercel as well. A domain belonging to another organisation is refused, not overwritten.",
      autoProvision: "Auto-provisioning domains",
      autoProvisionBefore: "One per line. Anyone who signs in with a ",
      autoProvisionHighlight: "work account",
      autoProvisionAfter: " from this domain and is not yet in the list of people is created automatically as an ordinary member — no roles and no tracks. This applies to accounts only, not to the emailed link: an account from the organisation's directory proves membership, a typed address does not. Empty = create nobody.",
      save: "Save",
      disableHeading: "Disable the organisation",
      enableHeading: "Enable the organisation",
      disableNote: "Once disabled, nobody from this organisation can sign in — immediately. The acknowledgement records remain and the tenant is not deleted.",
      confirmLabel: (code) => `Type ${code} to confirm`,
      confirmHint: "Deliberately not a plain “are you sure?” — that gets clicked away before it is read.",
      disable: "Disable",
      enable: "Enable",
      auditHeading: "Audit",
      auditNote: "The 50 most recent administrative changes to this organisation. The customer has the full, searchable log on their own domain in the organisation settings.",
    },
    signIn: {
      heading: (provider) => `Sign in with ${provider}`,
      state: {
        nastavene: "configured",
        "z-prostredia": "from the environment",
        necitatelne: "unreadable",
        nenastavene: "not configured",
      },
      stateLong: {
        nastavene: "configured — the customer's own application",
        "z-prostredia": "running from our environment variables, not from the customer's own application",
        necitatelne: "stored but unreadable — the encryption key changed, enter the credentials again",
        nenastavene: "not configured — the button is not offered",
      },
      callback: "Redirect URI — the customer has to enter it in their application exactly like this:",
      clientId: "Client ID",
      clientSecret: "Client secret",
      clientSecretHint: "Empty = leave unchanged. The value is stored encrypted and is never printed back.",
      tenantMode: "Tenant mode",
      tenantModeHint: "organizations = work and school accounts · common = personal ones too · or the UUID of a single Entra tenant",
      allowedTenantIds: "Allowed Entra tenant ids",
      allowedTenantIdsHint: "Comma-separated. Empty = not checked — in organizations mode this is the only thing standing between you and someone from a different organisation with the same address.",
      hostedDomain: "Workspace domain (hd)",
      hostedDomainHint: "For example futbalsfz.sk. Empty = any Google account.",
      save: "Save",
      deleteNote: "Removing it makes the button disappear from the sign-in screen. For people who sign in with a work account, the only route they know stops working.",
      confirmLabel: (code) => `Type ${code} to confirm`,
      deleteSubmit: "Remove",
    },
    actions: {
      failed: "The change could not be saved. Try again.",
      addedToVercel: (host) => `${host} added to Vercel`,
      missingVercelToken: (host) => `${host}: VERCEL_TOKEN is missing, add the domain by hand`,
      saved: "Saved.",
      confirmCodeToDisable: (code) => `Disabling requires typing the organisation code (${code}). Nothing changed.`,
      enabled: "The organisation is enabled.",
      disabled: "The organisation is disabled — nobody from it can sign in now.",
      created: "Organisation created.",
      noContact: "Nowhere to send it — fill in the organisation's contact address.",
      nothingToSend: "Nothing to send — every domain already points at us.",
      instructionsSent: (hosts, to) => `Instructions for ${hosts} sent to ${to}.`,
      signInSaved: (provider) => `Sign-in with ${provider} saved.`,
      confirmCodeToDelete: (code) => `To remove it, type the organisation code (${code}).`,
      signInRemoved: (provider) => `Sign-in with ${provider} removed.`,
    },
  },
  errors: {
    unknown: "That did not work. Try again.",

    // ── file conversion ────────────────────────────────────────────────────
    "conversion.zipNotOffice": "This is a ZIP archive, but neither docx nor xlsx. Legacy .doc and .xls cannot be converted — save them from Word or Excel in a newer format.",
    "conversion.unsupportedFormat": "We cannot convert {format} yet. Supported: .docx, .pdf, .xlsx, .md, .txt and .csv.",
    "conversion.pdfNoText": "This PDF contains no text — it is an image (a scan). The conversion cannot read it. In the editor you can have the language model transcribe it, or ask the author for the original file.",
    "conversion.noText": "The file contains no text.",

    // ── stored file ────────────────────────────────────────────────────────
    "file.empty": "The file is empty.",
    "file.tooLarge": "The file is {mb} MB; the limit is {maxMb} MB.",

    // ── library folders ────────────────────────────────────────────────────
    "folder.nameRequired": "The folder name is required.",
    "folder.parentMissing": "The parent folder does not exist.",
    "folder.tooDeep": "The structure can be at most {max} levels deep.",
    "folder.duplicateName": "There is already a folder called “{name}” at this level.",
    "folder.notFound": "There is no such folder here.",
    "folder.hasChildren": "The folder has subfolders — move or delete them first.",
    "folder.hasDocuments": "The folder still holds documents ({count}) — refile them first.",
    "folder.documentNotFound": "There is no such document here.",
    "folder.orderUnknownFolder": "The list contains a folder that is not here.",
    "folder.orderSameLevel": "Reordering works within a single level only.",
    "folder.selfParent": "A folder cannot be its own parent.",
    "folder.ownSubtree": "A folder cannot be moved into its own subfolder — that would make a cycle.",
    "folder.wouldExceedDepth": "The structure would be more than {max} levels deep.",

    // ── číselníky ──────────────────────────────────────────────────────────
    "codelist.valueMissing": "A value for {codelist} is missing.",
    "codelist.unknown": "The code list {codelist} does not exist.",
    "codelist.notAllowed": "“{value}” is not a valid value for {codelist}. Allowed: {allowed}.",
    "codelist.badKeyFor": "“{value}” cannot be used as a key for {codelist}. Lowercase letters without diacritics, digits and underscores — the key goes into the document identifier and into URLs.",
    "codelist.badKey": "“{key}” cannot be used as a key. Lowercase letters without diacritics, digits and underscores — the key labels content and stays with it permanently.",
    "codelist.notTenantManaged": "The organisation does not manage the code list {codelist} itself — these are the filters that access to content rests on.",
    "codelist.tenantMissing": "The organisation does not exist.",
    "codelist.alreadyThere": "“{key}” is already in the menu.",
    "codelist.readOnly": "This code list cannot be changed.",

    // ── people ─────────────────────────────────────────────────────────────
    "person.notFound": "There is no such person here.",
    "person.badEmail": "That is not an email address.",
    "person.emailTaken": "{email} is already in the organisation.",
    "person.alreadyInvited": "{email} is already recorded in the organisation.",
    "person.nameRequired": "The name is required — without it the list shows only the address.",
    "person.nameRequiredShort": "The name is required.",
    "person.departmentNotFound": "There is no such department.",
    "person.unknownType": "Unknown person type.",

    // ── assigning documents ────────────────────────────────────────────────
    "assignment.missingReason": "The reason for the assignment is required — it is the only place to record why the document has to be acknowledged again (D30).",
    "assignment.missingCompany": "The organisation code is missing.",
    "assignment.missingSubject": "The document or its version is missing.",
    "assignment.versionNotEffective": "The version has no effective date, so it cannot be acknowledged either (D6). Give it an effective date first.",
    "assignment.missingAudience": "It is missing who this is assigned to.",

    // ── departments ────────────────────────────────────────────────────────
    "department.nameRequired": "The department name is required.",
    "department.parentMissing": "The parent department does not exist.",
    "department.tooDeep": "The structure can be at most {max} levels deep.",
    "department.duplicateName": "There is already a department called “{name}” in this place.",
    "department.notFound": "There is no such department here.",
    "department.personNotFound": "The person was not found.",
    "department.hasChildren": "The department has sub-departments — move or delete them first.",
    "department.hasPeople": "People are assigned to this department ({count}) — reassign them first.",
    "department.orderUnknown": "The list contains a department that is not here.",
    "department.orderSameLevel": "Reordering works within a single level only.",
    "department.selfParent": "A department cannot be its own parent.",
    "department.ownSubtree": "A department cannot be moved under its own sub-department — that would make a cycle.",
    "department.wouldExceedDepth": "The structure would be more than {max} levels deep. A deeper tree cannot be shown clearly in the picker.",

    // ── organisation branding ──────────────────────────────────────────────
    "brand.unsupportedFormat": "Unsupported format ({type}). Use PNG, JPEG or WebP. SVG deliberately not — it can carry a script, and we would be serving someone else's code from our own domain.",
    "brand.emptyFile": "The file is empty.",
    "brand.tooLarge": "The file is {kb} kB; the limit is {maxKb} kB. The logo is 26 px in the header — a larger file adds nothing.",

    // ── customer domains ───────────────────────────────────────────────────
    "domain.notADomain": "That does not look like a domain. For example intranet.futbalsfz.sk.",
    "domain.ours": "{domain} is our own domain — only we can assign a subdomain on it.",
    "domain.alreadyYours": "You already use this domain.",
    "domain.alreadyTaken": "This domain is already recorded in the system. Get in touch with us.",
    "domain.lastOne": "This is your last domain — without it the portal will not appear anywhere.",
    "domain.ownedByOther": "The domain {domains} already belongs to organisation {owner}.",

    // ── organisation ───────────────────────────────────────────────────────
    "tenant.badCode": "Organisation code: 2–24 characters, capital letters, digits, hyphen or underscore.",
    "tenant.unknownLanguage": "Unknown language in {where}: {invalid} (allowed: {allowed}).",
    "tenant.notFound": "Organisation {code} does not exist.",
    "tenant.needsDomain": "Without a domain the organisation's portal will not appear anywhere. Leave at least one.",
    "tenant.nameRequired": "The organisation name is required — it is what people see in the header.",
    "tenant.alreadyExists": "Organisation {code} already exists.",
    "tenant.noEncryptionKey": "The secret cannot be stored: OAUTH_SECRET_ENCRYPTION_KEY is missing. We will not store it readable — it is access to someone else's system.",
    "tenant.needsBothCredentials": "Both clientId and the secret are needed — one without the other cannot be used.",

    // ── library ────────────────────────────────────────────────────────────
    "library.noFileChosen": "You did not choose a file.",
    "library.documentNotFound": "There is no such document here.",
    "library.noOriginalFile": "The document has no original file that could be transcribed.",
    "library.onlyPdfRewrite": "Only PDFs can be transcribed — other formats are converted directly.",
    "library.originalNotFound": "The original file was not found.",
    "library.noDraft": "There is no draft here.",
    "library.titleRequired": "The document title is required — without it the list shows only the key.",
    "library.emptyText": "Empty text cannot be saved — the document would have no content.",
    "library.labelRequired": "The version label is required — it appears verbatim in every acknowledgement record. Write what the document says (for example: consolidated text of 27 February 2026), not an invented number.",
    "library.effectiveFromRequired": "The effective date is required — without it the version cannot be acknowledged (D6).",
    "library.documentHasNoText": "The document has no text — upload a file or write the wording first.",
    "library.noChunks": "The text produced no chunks at all. Check whether the document is organised into articles or headings.",
    "library.noPublishedVersion": "The document has no published version — only what is already out can be reindexed.",
    "library.noChunksProfile": "The text produced no chunks at all — check the chunking profile.",
    "library.reasonRequired": "The reason for the correction is required — without it, a year from now there is no way to tell whether it was a typo or a change of obligation.",
    "library.versionNotFound": "There is no such version here.",
    "library.dateChangeNeedsDecision": "This version has already been acknowledged ({count} times), and the statement those people signed contains the old date. Decide whether this is a correction of the record or whether the version has to be acknowledged again.",

    // ── language-model transcription ───────────────────────────────────────
    "rewrite.notConfigured": "Model transcription is not configured — ANTHROPIC_API_KEY is missing. Conversion in the application keeps working.",
    "rewrite.emptyInput": "Nothing to clean up — the text is empty.",
    "rewrite.textTooLong": "The text is {thousands} thousand characters; {maxThousands} can be sent at once. Split it and clean it up in parts.",
    "rewrite.emptyAnswer": "The model returned an empty answer.",
    "rewrite.emptyFile": "The file is empty.",
    "rewrite.pdfTooLarge": "The PDF is {mb} MB; {maxMb} can be sent at once. Split it into parts.",
    "rewrite.modelReadNothing": "The model read nothing from the document.",
  },
  audit: {
    empty: "Nothing here yet. Records appear with every administrative change — a role, an access level, a department, an assignment or an organisation setting.",
    subjects: {
      person: "person",
      department: "department",
      document: "document",
      folder: "folder",
      assignment: "assignment",
      organisation: "organisation",
      domain: "domain",
      "signin-settings": "sign-in",
      tenant: "tenant",
    },
    actions: {
      created: "created",
      changed: "changed",
      excluded: "excluded",
      restored: "restored",
      renamed: "renamed",
      moved: "moved",
      deleted: "deleted",
      assigned: "assigned",
      revoked: "revoked",
      notified: "notified",
      requested: "requested",
      verified: "verified",
      published: "published",
      reindexed: "reindexed",
      reordered: "reordered",
      "model-draft": "model draft",
      "version-fix": "version correction",
      "new-version": "new version uploaded",
    },
    fields: {
      email: "address",
      fullName: "name",
      department: "department (text)",
      departmentId: "department",
      personType: "person type",
      status: "status",
      language: "language",
      tracks: "tracks",
      groups: "groups",
      roles: "roles",
      name: "name",
      parentId: "parent department",
      clientId: "clientId",
      clientSecret: "secret",
      hostnames: "domains",
      autoProvisionDomains: "auto-provisioning domains",
      "branding.displayName": "name",
      "branding.shortName": "short name",
      "branding.accentColor": "colour",
      "branding.logoUrl": "logo",
      "branding.supportEmail": "contact",
    },
    none: "—",
  },
  colors: {
    palette: {
      "#232a35": "graphite (default)",
      "#1f4ed8": "blue",
      "#0e7490": "teal",
      "#047857": "green",
      "#4d7c0f": "olive",
      "#b45309": "amber",
      "#b91c1c": "red",
      "#9f1239": "wine",
      "#6d28d9": "violet",
      "#334155": "slate",
    },
    showCustom: "Enter a custom value",
    hideCustom: "Hide the custom value",
  },
  org: {
    heading: "Organisation",
    introBefore: "The settings you manage yourselves. The organisation code (",
    introAfter: ") and switching the portal off are deliberately not here — for those, get in touch with us.",
    tabsLabel: "Settings sections",
    tabs: {
      branding: "Appearance and languages",
      departments: "Departments",
      domains: "Domains",
      signin: "Sign-in",
      codelists: "Code lists",
      chunking: "Chunking",
      audit: "Audit",
    },
    branding: {
      name: "Name",
      nameNote: "The full name. It appears in emails and on the sign-in screen.",
      shortName: "Short name",
      shortNameNote: "For the top bar, where a menu sits next to it — “SFZ” says the same thing there as the full name and leaves room for the rest.",
      logo: "Logo",
      logoCurrent: "current",
      logoNote: "PNG, JPEG or WebP, at most 256 kB. Empty = leave unchanged.",
      color: "Colour",
      colorNote: "Buttons carry it with white text on top, which is why the shades are darker than you might want — a lighter tone means an unreadable button.",
      supportEmail: "Contact address",
      supportEmailNote: "Where someone should turn when something does not add up.",
      languages: "Languages",
      defaultLanguage: "Default language",
      defaultLanguageNote: "Applies to anyone who is not signed in yet.",
      autoProvision: "Auto-provisioning domains",
      autoProvisionBefore: "One per line. Anyone who signs in with a ",
      autoProvisionHighlight: "work account",
      autoProvisionAfter: " from this domain and is not yet in the list of people is created automatically as an ordinary member — no roles and no tracks. This applies to accounts only, not to the emailed link.",
      save: "Save",
    },
    departments: {
      heading: "Organisational structure",
      introBefore: "The order can be changed by dragging or with the arrows once an item is expanded — an org chart is not an alphabetical list. A department is ",
      introHighlight: "where a person belongs",
      introMiddle: " — exactly one, as in an org chart. For reaching people across departments (referees, delegates, officers) there are ",
      groupsLink: "groups",
      introAfter: "; those do not mix with departments and one person can have several.",
      empty: "Nothing here yet. Create the first department below — if you already have departments recorded on people as free text, get in touch and we will convert them in one go.",
      withDescendants: (n) => ` (${n} including sub-departments)`,
      moveUp: (name) => `Move ${name} up`,
      up: "↑ up",
      moveDown: (name) => `Move ${name} down`,
      down: "↓ down",
      nameOf: (name) => `Name of department ${name}`,
      rename: "Rename",
      parentOf: (name) => `Parent department for ${name}`,
      topLevel: "— top level —",
      move: "Move",
      remove: "Delete the department",
      removeHint: "Only an empty department with no sub-departments can be deleted — otherwise people would disappear from the structure without anyone noticing.",
      newHeading: "New department",
      name: "Name",
      namePlaceholder: "Communications division",
      parent: "Parent department",
      maxDepth: (n) => `The structure can be at most ${n} levels deep. This is not a technical limit — a deeper tree cannot be shown clearly on a phone, and whatever sits deepest in it is usually a group in disguise.`,
      create: "Create",
    },
    domains: {
      works: "working",
      remove: "Remove",
      waitingDns: "waiting for DNS",
      since: (date) => `since ${date}`,
      dnsBefore: "With your DNS administrator, add a ",
      dnsMiddle: " record ",
      verify: "Verify and enable",
      cancelRequest: "Cancel the request",
      add: "Add your own domain",
      hostPlaceholder: "intranet.yourorganisation.com",
      addNote: "The domain is enabled only once its DNS starts pointing at us. Only someone who actually controls it can set that up — and it is the only proof there is. Without it, anyone could claim someone else's domain.",
      request: "Request",
    },
    signIn: {
      heading: (provider) => `Sign in with ${provider}`,
      stateOn: "on",
      stateFromSupplier: "from the supplier's settings",
      stateUnreadable: "unreadable",
      stateOff: "off",
      introBefore: "You register the application ",
      introHighlight: (provider) => `in your own ${provider} directory`,
      introAfter: " — you grant the consent, you see who signed in, and you can revoke access at any time. We never see the secret's value.",
      callback: "Redirect URI — enter it in your application exactly like this:",
      clientId: "Client ID",
      clientSecret: "Client secret",
      clientSecretNote: "Empty = leave unchanged. It is stored encrypted and is never printed back.",
      tenantMode: "Tenant mode",
      tenantModeBefore: "For a single-directory application, your ",
      tenantModeHighlight: "Directory (tenant) ID",
      tenantModeAfter: " belongs here. “organizations” = work and school accounts from anywhere, “common” = personal ones too.",
      allowedTenantIds: "Allowed Entra tenant ids",
      allowedTenantIdsNote: "Empty = not checked. In “organizations” mode this is the only thing standing between you and someone from a different organisation who happens to have the same address as one of your people.",
      hostedDomain: "Workspace domain",
      save: "Save",
      deleteNote: "Removing it makes the button disappear from the sign-in screen. For people who sign in with a work account, the only route they know stops working.",
      confirmLabel: (code) => `Type ${code} to confirm`,
      deleteSubmit: "Remove",
    },
    codelists: {
      introBefore: "What you label your own library content with. The base values are always here — existing content is labelled with them, and their disappearance would turn it into invalid data. Only what you added can be removed, and even then it disappears ",
      introHighlight: "from the menu only",
      introAfter: ": documents that carry the value keep it.",
      labels: {
        category: {
          name: "Document types",
          hint: "What the document is: a regulation, a directive, a guideline, minutes…",
        },
        tags: {
          name: "Tags",
          hint: "Free classification across types — youth, referees, finance, for example.",
        },
      },
      base: " · base",
      used: (n) => ` · used ${n}×`,
      remove: "Remove",
      newItemPlaceholder: "Guideline",
      newItemLabel: (codelist) => `Name of the new item — ${codelist}`,
      key: "Key",
      keyPlaceholder: "guideline",
      add: "Add",
      keyNote: "Key: lowercase letters without diacritics, digits and underscores. It stays in the content permanently and cannot be taken back — the name beside it can be changed.",
    },
    chunking: {
      heading: "Splitting documents into chunks",
      introBefore: "Search does not work on the whole document — the model receives a few chunks and answers from them. These values decide how a document is cut into chunks.",
      introHighlight: " This has nothing to do with the text of the regulation or with acknowledgements:",
      introAfter: " the chunking can be changed as often as needed and nobody is asked to acknowledge again.",
      articleWord: "The word an article starts with",
      articleNote1: "The default is ",
      articleNote2: ". Regulations organised by ",
      articleNote3: " or by ",
      articleNote4: " merge into a single block without this change, and search has nothing to grab onto. It is ",
      articleNoteHighlight: "a word, not a pattern",
      articleNote5: " — the system fills in what surrounds it.",
      annexWord: "The word an annex starts with",
      annexWordNote: "Annexes sit outside the article numbering — unrecognised, they fall under the last article and the citation lies.",
      headerRepeats: "A line is a running head when it repeats more often than",
      headerRepeatsNote: "Headers and footers repeat on every page of a PDF. A lower number removes more noise, but on a short document it can eat the content too.",
      minTokens: "Target chunk size — from (tokens)",
      maxTokens: "Target chunk size — to (tokens)",
      tokensNoteBefore: "A small chunk means thousands of context-free snippets; a large one means a single chunk for the whole document. The default ",
      tokensNoteAfter: " is tuned on Slovak regulations.",
      saveNoteBefore: "Saving ",
      saveNoteHighlight: "does not reindex existing documents",
      saveNoteMiddle: ". Try a new profile on one document first — its library detail has a ",
      saveNoteButton: "Reindex",
      saveNoteAfter: " button.",
      save: "Save the chunking profile",
      reindexAllHeading: "Reindex everything",
      allUpToDate: (total) => `All ${total} documents are chunked according to this profile. There is nothing to reindex.`,
      outdatedOf: (total) => ` of ${total} documents are chunked differently from what this profile says. Reindexing `,
      outdatedHighlight: "changes neither the wording nor the acknowledgements",
      outdatedAfter: " — it only replaces the chunks that search reads from.",
      batchNote: "At most 25 documents are processed at a time. This is not extra caution: with a larger batch the run would hit the time limit and some documents would stay chunked the old way. If anything is left, press it again — what is done is skipped.",
      reindexAll: (n) => `Reindex (${n})`,
    },
    actions: {
      saved: "Changes saved.",
      failed: "The change could not be saved. Try again.",
      confirmCode: (code) => `To remove it, type the organisation code (${code}).`,
      signInRemoved: "Sign-in credentials removed.",
      domainRequested: "Recorded. Now set the CNAME with your DNS administrator and ask for verification.",
      domainNotFound: "We have no such request.",
      domainWaiting: (host) =>
        `${host} does not point at us yet. A DNS change is usually visible within the hour;` +
        " if it takes longer, check the CNAME.",
      domainOnNotInVercel: (host) => `${host} is on, but it was not added to Vercel — get in touch with us.`,
      domainOn: (host) => `${host} is on. The portal answers there.`,
      domainRemoved: "Domain removed. The portal stopped answering there.",
      codelistRemoved: "Removed from the menu. Documents that carry this value keep it.",
      chunkingSaved: "Saved. Existing documents were not reindexed — run that on a specific document.",
      reindexedCount: (n) => `${n} reindexed`,
      reindexSkipped: (n) => `${n} unchanged`,
      reindexRemaining: (n) => `${n} remaining — run it again`,
      reindexErrors: (list) => `errors: ${list}`,
    },
    auditTab: {
      introBefore: "Who changed what and when. Every administrative change is recorded — a role, an access level, a department, an assignment and organisation settings. Records",
      introHighlight: " cannot be edited or deleted",
      introAfter: "; that is the whole point. Secrets (a client secret, say) appear only as “changed” — an audit log that collects passwords is a leak in its own right.",
      search: "Search",
      searchPlaceholder: "name, address, department…",
      searchSubmit: "Search",
      clearFilter: "clear the filter",
      capped: "The 200 most recent records are shown. Older ones can be found with the field above — loading them all at once would bring the screen down exactly when someone opens it to check something.",
    },
  },
  people: {
    types: {
      employee: "employee",
      external: "external",
      referee: "referee",
      official: "official",
    },
    languages: {
      sk: "Slovak",
      cs: "Czech",
      en: "English",
    },
    roles: {
      hr: "hr — assigns documents and sees who has not acknowledged them",
      "people-admin": "people-admin — manages people (this screen)",
      "spravca-obsahu": "spravca-obsahu — uploads and edits documents in the library",
    },
    list: {
      heading: "People",
      introBefore: "Who belongs to the organisation. A person is ",
      introHighlight: "never deleted",
      introAfter: " — exclusion cuts them off from the portal, but their acknowledgements remain valid records.",
      invite: "Invite a person",
      importCsv: "Import from CSV",
      searchPlaceholder: "Search by name, address or department",
      nothingFound: "Nothing found.",
      count: (n) => `${n} ${n === 1 ? "person" : "people"}`,
      matchesSearch: " matching the search",
      capped: " — showing the first 500, narrow the search",
      status: {
        invited: "invited",
        active: "active",
        inactive: "excluded",
      },
      neverSignedIn: "never signed in",
    },
    invite: {
      back: "← Back to the list",
      heading: "Invite a person",
      introBefore: "They will be recorded in organisation ",
      introAfter: ". Groups and tracks are added on their detail page — the invitation takes you straight there.",
      email: "Email address",
      emailNote: "It can be changed later, but it is the address the sign-in link goes to. Check it.",
      fullName: "Name",
      department: "Department",
      personType: "Person type",
      language: "Interface language",
      languageNote: "Groups and tracks are chosen on the detail page — there you can see what already exists in the organisation.",
      submit: "Invite",
    },
    import: {
      back: "← Back to the list",
      heading: "Import from CSV",
      introBefore: "First you see ",
      introHighlight: "what would happen",
      introMiddle: ", and only then is anything written. Uploading a hundred people blind is exactly the operation after which people look for the undo button — and there is none. Everyone is recorded in organisation ",
      introAfter: ", even if the file says otherwise.",
      file: "CSV file",
      fileNoteBefore: "The first row is the header. These are recognised: ",
      fileNoteAfter: " — with or without diacritics, and with a semicolon as the separator, the way Excel saves it.",
      reading: "Reading…",
      whatHappens: (name) => `What will happen — ${name}`,
      rows: "Rows",
      willAdd: "Will be added",
      willUpdate: "Will be updated",
      invalid: "Invalid",
      added: "Will be added",
      andMore: (n) => ` … and ${n} more`,
      skippedRows: "These rows will be skipped",
      statusNoteBefore: "Existing people ",
      statusNoteHighlight: "keep their status",
      statusNoteAfter: " — whoever has signed in stays signed in. An empty language field does not overwrite anything.",
      write: "Write",
      writing: "Writing…",
      reasons: {
        "invalid-email": "invalid email address",
        "missing-companyCode": "organisation missing (companyCode)",
        "missing-name": "name missing",
        "duplicate-in-file": "duplicate within the file",
      },
    },
    detail: {
      back: "← Back to the list",
      previously: (list) => `previously ${list}`,
      invitedNotSignedIn: "invited, has not signed in yet",
      excludedNoSignIn: "excluded — cannot sign in",
      lastSeen: (when) => `last seen ${when}`,
      never: "—",
      signsInVia: (list) => `signs in via ${list}`,
      email: "Email address",
      emailNote: "It can be changed — a person's identity does not rest on it. Acknowledgements are tied to their record, not to the address, so the history stays whole and the old address is kept in their history. What changes is where the sign-in link goes; signing in with a work account keeps working.",
      fullName: "Name",
      jobTitle: "Job title",
      jobTitleNote: "A record-keeping field. It is filled in from the work account when the directory has it — but only while it is empty here, so a manual correction survives.",
      department: "Department",
      departmentNone: "— no department —",
      noDepartmentsBefore: "The structure is still empty. Departments are created in the ",
      noDepartmentsLink: "organisation settings",
      noDepartmentsAfter: ".",
      departmentNote: "Exactly one — a department is a place in the structure. For reaching people across departments there are groups below.",
      placement: (path) => ` Placement: ${path}.`,
      legacyDepartmentBefore: "Originally recorded here as text: ",
      legacyDepartmentAfter: ". It stays stored until the person is placed in the structure — so it is visible where the department came from.",
      personType: "Person type",
      personTypeNote: "A record-keeping field. It does not decide access to content — that is settled by the organisation and the document's access level.",
      language: "Interface language",
      languageNote: "The language we speak to this person in. Not the language of the documents they read.",
      groups: "Groups",
      newGroup: "new group, e.g. referees",
      groupsNote: "Documents are assigned by these. The number is how many people have the group — a group nobody has receives nothing.",
      tracks: "Onboarding tracks",
      newTrack: "new track, e.g. basics-2026",
      roles: "Roles",
      rolesNote: "The platform administrator cannot be assigned from here — that role belongs to the supplier's tenant and has its own path.",
      save: "Save",
      returnHeading: "Reinstate the person",
      excludeHeading: "Exclude the person",
      returnNoteBefore: "They come back as ",
      returnNoteHighlight: "invited",
      returnNoteAfter: ", not active — active means “has already signed in”, and reinstating did not make that happen. Their first sign-in switches it.",
      returnSubmit: "Reinstate",
      excludeNote: "After exclusion they cannot sign in — immediately. Neither the record nor their acknowledgements are deleted; they are valid evidence of what the person read, and they have to outlive their departure.",
      confirmLabel: "Type the address to confirm",
      confirmNote: "Deliberately not “are you sure?” — that gets clicked away before it is read.",
      excludeSubmit: "Exclude",
    },
    actions: {
      saved: "Saved.",
      invited: "Invited. They will sign in once they request a link themselves or use their work account.",
      excluded: "Excluded. The record and their acknowledgements remain.",
      returned: "Reinstated. They sign in and the status switches by itself.",
      confirmAddress: (email) => `To exclude, type the address (${email}).`,
      failed: "The change could not be saved. Try again.",
      noRight: "You do not have permission for that.",
      fileEmpty: "The file is empty.",
      noRows: "The file has no data rows. Does the first row contain headers?",
      importResult: (created, updated, unchanged, invalid) =>
        `Added ${created}, updated ${updated}, unchanged ${unchanged}` +
        (invalid ? `, invalid ${invalid}` : "") + ".",
    },
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
    detail: {
      back: "← Back to library",
      documentData: "Document details",
      title: "Title",
      titleNote: "Editable. It appears in future acknowledgements; existing records carry a copy of the title from the moment of acknowledgement, so they do not change retroactively.",
      scope: "Scope",
      accessLevel: "Access",
      documentLanguage: "Document language",
      category: "Type",
      unset: "— unset —",
      tags: "Tags",
      newTag: "New tag",
      keyNoteBefore: "The key ",
      keyNoteAfter: " cannot be changed — it is in the chunks, in the assignments and in the acknowledgement records. Changing it would not be a rename but a second document the history could never reach.",
      save: "Save details",
      folder: "Folder",
      folderUnfiled: "— unfiled —",
      folderNote: "Folders are filing only — neither the file nor the text moves anywhere. The library filter finds the document through a parent folder too.",
      assign: "File",
      text: "Text",
      openEditor: "open editor →",
      originalFile: "Original file:",
      uploadedBy: (who, when) => `uploaded by ${who} ${when}`,
      conversionMethod: (method) => `conversion: ${method}`,
      noOriginal: "No original file — this document arrived through a command-line import.",
      draftDiffers: "The draft differs from the published version.",
      draftSame: "The draft matches the published version.",
      draftEmpty: "The draft is empty.",
      publishHeading: "Publish a version",
      nothingToPublish: "Nothing to publish — the draft is empty or identical to what already applies.",
      versionLabel: "Version label",
      versionLabelPlaceholder: "consolidated text of 27 February 2026",
      labelNoteBefore: "It appears ",
      labelNoteHighlight: "verbatim in every acknowledgement record",
      labelNoteAfter: ". Write what the document itself says — not an invented version number that a year from now will connect to nothing.",
      effectiveFrom: "Effective from",
      effectiveFromNote: "Required. A version with no effective date cannot even be acknowledged, and the statement quotes it verbatim.",
      effectiveFromSource: "Where the date comes from",
      effectiveFromSourcePlaceholder: "Art. 62 (2) — effective on approval by the SFZ Executive Committee, 27 February 2026",
      effectiveFromSourceNote: "The citation of the effectiveness provision. A date without a source cannot be verified a year later — and it is in every acknowledgement record.",
      changeNote: "What changed",
      changeNotePlaceholder: "amendment to Art. 12 and 18",
      publish: "Publish",
      reindexHeading: "Reindex",
      reindexNoteBefore: "Re-chunks the effective version using the current chunking profile. ",
      reindexNoteHighlight: "It does not create a new version",
      reindexNoteAfter: " — the text does not change, so acknowledgements stay valid and nobody is asked to acknowledge again. Use it after tuning the profile in the organisation settings.",
      reindex: "Reindex",
      versionsHeading: (n) => `Versions (${n})`,
      nothingPublished: "Nothing has been published yet, so it cannot be assigned for acknowledgement either.",
      active: "active",
      archived: "archived",
      effectiveFromOn: (date) => `effective from ${date}`,
      noEffectiveDate: "no effective date",
      effectiveTo: (date) => `to ${date}`,
      dateSource: (source) => `date source: ${source}`,
      fix: "correct the details",
      fixLabel: "Label",
      fixEffectiveFromNoteBefore: "The date is in the statement people signed ",
      fixEffectiveFromNoteHighlight: "verbatim",
      fixEffectiveFromNoteAfter: ". If you change it and someone has already acknowledged the version, you will have to decide whether this is a correction of the record or a change that has to be acknowledged again.",
      fixReason: "Reason for the correction",
      fixReasonPlaceholder: "typo in the label; date from the SFZ Executive Committee resolution",
      fixReasonNote: "Required. Without it, a year from now there is no way to tell whether it was a typo or a change of obligation.",
      onDateChange: "If the date changes and someone has already acknowledged the version",
      onDateChangeAsk: "— I will decide when asked —",
      onDateChangeCorrection: "correction of the record, acknowledgements stand",
      onDateChangeReacknowledge: "substantive change, acknowledge again",
      fixSubmit: "Correct",
    },
    editor: {
      back: "← Back to the document",
      intro: "Compare the text with the original. Publishing is a separate step — nothing goes out from here.",
      modelDraft: "model draft",
      modeRewriteScan: "scan transcription",
      modeClean: "structure cleanup",
      draftMeta: (model, when, chars) => `${model} · ${when} · ${chars} characters`,
      draftNoteBefore: "The model was forbidden to change the wording — ",
      draftNoteHighlight: "verify that",
      draftNoteAfter: ". Accepting turns the draft into the working text; the previous text is overwritten.",
      useAsDraft: "Use as draft",
      discard: "Discard",
      original: "Original",
      pdfNotShown: "Your browser will not display the PDF. ",
      openInNewWindow: "Open it in a new window",
      fileNotShown: (name) => `${name} will not display in the browser. `,
      download: "Download it",
      compareAfterDownload: " and compare side by side.",
      noOriginal: "No original file — this document arrived through a command-line import, so there is nothing to compare.",
      text: "Text",
      switchNoteBefore: " — the ",
      switchNoteModes: "Markdown / WYSIWYG",
      switchNoteAfter: " switch is at the bottom of the editor",
      saveText: "Save text",
      llmHeading: "Language-model assistance",
      llmNoteBefore: "It runs only like this — on a click. The result is saved as a ",
      llmNoteHighlight: "draft beside the text",
      llmNoteAfter: ", not into it: the model is forbidden to change the wording, but a silent change in a regulation would go unnoticed if it were written straight in.",
      clean: "Clean up the structure",
      rewriteScan: "Transcribe from the scan",
      rewriteScanNote: "“Transcribe from the scan” sends the whole original PDF to the model. It makes sense when the PDF has no text layer or the conversion fell apart.",
    },
    actions: {
      converted: "Converted. Read the text and compare it with the original.",
      convertedWithWarnings: (warnings) => `Converted. ${warnings}`,
      saved: "Saved.",
      changesSaved: "Changes saved.",
      alreadyPublished: "This version is already published — nothing changed.",
      published: (chunks, archived) =>
        `Published: ${chunks} ${chunks === 1 ? "chunk" : "chunks"}, ${archived} older archived.`,
      modelReturnedDraft: "The model returned a draft. Compare it with the current text and decide.",
      draftAccepted: "The draft is now the working text. Publishing is still a separate step.",
      draftDiscarded: "Draft discarded.",
      assigned: "Filed.",
      reindexUpToDate: "The chunking is already up to date — nothing changed.",
      reindexed: (chunks, archived) =>
        `Reindexed: ${chunks} ${chunks === 1 ? "chunk" : "chunks"}, ${archived} older archived.` +
        " Neither the wording nor the acknowledgements were touched.",
      fixedNeedsReacknowledge: (people) =>
        "Corrected. The version is marked as requiring a new acknowledgement —" +
        ` this affects ${people} ${people === 1 ? "person" : "people"}.`,
      fixed: "Corrected. Acknowledgements stay valid.",
      failed: "That did not work. Try again.",
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

/**
 * Veta k chybe, v jazyku toho, kto sa pozerá.
 *
 * `AppError` nesie kód a hodnoty, nie hotový text — knižnica o jazyku
 * čitateľa nevie a vedieť nemá. Skladá sa to až tu, na okraji.
 *
 * **Nikdy nevráti prázdno.** Neznámy kód spadne na slovenskú vetu z výnimky
 * (tá je aj v logu) a čokoľvek iné než `AppError` na všeobecnú hlášku —
 * podrobnosti cudzej výnimky na obrazovku nepatria.
 */
export function errorText(error: unknown, language?: unknown): string {
  const t = dictionary(language).errors
  if (!(error instanceof AppError)) return t.unknown
  const template = t[error.code]
  if (!template) return error.message || t.unknown
  return template.replace(
    /\{(\w+)\}/g,
    (whole, key: string) => String(error.params[key] ?? whole),
  )
}
