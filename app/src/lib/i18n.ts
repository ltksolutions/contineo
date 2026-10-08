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
/**
 * „N neprečítaných" v slovenčine a češtine — **tri tvary, nie jeden**.
 *
 * `1 neprečítaných` je chyba, ktorú vidno na prvý pohľad a ktorú test na
 * paritu kľúčov nechytí: kľúč existuje, hodnota nie je prázdna, veta je zlá.
 * Preto jedna funkcia vedľa slovníka a nie tri kópie tej istej podmienky
 * v ňom.
 */
function unreadWord(n: number, language: "sk" | "cs"): string {
  const word = language === "cs"
    ? (n === 1 ? "nepřečtené" : n < 5 ? "nepřečtené" : "nepřečtených")
    : (n === 1 ? "neprečítané" : n < 5 ? "neprečítané" : "neprečítaných")
  return `${n} ${word}`
}

export function formatDate(d: Date, language: UiLanguage = DEFAULT_LANGUAGE): string {
  const day = d.getUTCDate(), month = d.getUTCMonth(), year = d.getUTCFullYear()
  if (language === "en") return `${day} ${MONTHS_EN[month]} ${year}`
  return `${day}. ${month + 1}. ${year}`
}

/** Číslo s oddeľovačom tisícov podľa jazyka prostredia (12 345 / 12,345). */
export function formatNumber(n: number, language: UiLanguage = DEFAULT_LANGUAGE): string {
  return n.toLocaleString(language === "en" ? "en-GB" : language === "cs" ? "cs-CZ" : "sk-SK")
}

// ── Slovník prostredia ───────────────────────────────────────────────────────

interface Dictionary {
  /**
   * Znenie potvrdzovacej formulky (D28) — **oboznámenie a záväzok, nie súhlas**.
   * Pri vnútornom predpise je súhlas právne zvláštny: smernica zaväzuje bez
   * ohľadu na to, či s ňou niekto súhlasí.
   *
   * Musí obsahovať názov **aj** dátum účinnosti — bez nich sa o rok nedá
   * povedať, čo presne bolo potvrdené. Označenie znenia v nej od ADR-016 nie je.
   */
  /**
   * Formulka potvrdenia — znenie určuje dátum účinnosti, nie označenie (ADR-016).
   * Rod podľa `persons.gender` (D152): „oboznámil / oboznámila", nevyplnené
   * „oboznámil(a)" — rovnaké pravidlo ako „absolvoval(a)" na certifikáte.
   */
  statement(title: string, effectiveFrom: string, gender?: string): string

  /** Spoločné texty prierezových komponentov (ZAKLAD). */
  common: {
    saveBarNote: string
    moreActions: string
    /** Príklad zoznamu domén (jedna na riadok) — neutrálny. */
    domainsPlaceholder: string
    /** Potvrdenie oznamu (Notice). */
    noticeConfirm: string
    /** Prázdny stav zoznamu (`.empty`) — dve rôzne vety podľa filtra. */
    empty: {
      /** Filter je nasadený a nič mu nevyhovuje. */
      filtered: string
      /** Zoznam je prázdny sám od seba; obrazovky text spresnia vlastným. */
      none: string
      /** Akcia pri nasadenom filtri. */
      clearFilters: string
    }
    /**
     * PDF znenia vykreslené po stranách (`PdfView`, ADR-011). `page` je vzor
     * so `{page}` a `{pages}`, nie funkcia — ide zo serverovej stránky do
     * klientskeho komponentu a funkcia sa cez túto hranicu poslať nedá.
     */
    pdf: {
      loading: string
      failed: string
      page: string
    }
    /**
     * Text tlačidla, kým beží dlhšia akcia (`SubmitButton.pendingLabel`).
     * Rozposlanie e-mailov trvá pri väčšom oddelení desiatky sekúnd.
     */
    pending: {
      adding: string
      sending: string
    }
  }

  /** Texty potvrdzovacích obrazoviek. */
  onboarding: {
    /** ADR-011: PDF znenia. */
    openPdf: string
    listHeading: string
    listIntro: string
    /** Prázdny stav (`.empty`, DOCUMENTS úloha 4) — bez akcie: človek tu nemá čo urobiť. */
    emptyTitle: string
    emptyText: string
    /** Nadpis sekcie pre dokumenty pridelené mimo trasy. */
    assignedHeading: string
    progress: (done: number, total: number) => string
    /**
     * Kroky sa zobrazujú po trasách, nie ako jedna kopa. Trasa je poradie
     * — sploštený zoznam zahodí aj poradie, aj to, kde človek skončil.
     */
    step: (order: number, total: number) => string
    /** Prvý nedokončený krok trasy. Bez neho je zoznam len zoznam. */
    continueHere: string
    trackComplete: string
    open: string
    done: string
    todo: string
    blocked: string
    blockedReason: Record<string, string>
    version: (label: string, from: string) => string
    /**
     * Čas čítania (O14). Je **informatívny** a človek to musí vidieť —
     * meranie, o ktorom sa dozvie až zo zásad ochrany údajov, je presne to,
     * čo pri audite robí problém.
     */
    readingElapsed: (formatted: string) => string
    readingNote: string
    readingSeconds: (n: number) => string
    readingMinutes: (n: number) => string
    confirmHeading: string
    confirmButton: string
    confirmPending: string
    confirmed: string
    confirmedAt: (when: string) => string
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
     * v úzkom stĺpci by riadok zalomil a `/documents` ho aj tak ukazuje.
     */
    version: (label: string) => string
    /**
     * „Čaká od …". Ukáže sa **len** pri úlohe, ktorá má pridelenie (D37) —
     * inak by dátum znamenal niečo iné, než čo je pri ňom napísané.
     */
    waitingSince: (date: string) => string
    /** Termínový chip (D63). Tvary čísloviek patria sem, nie do komponentu. */
    dueBy: (date: string) => string
    dueToday: string
    dueOver: (days: number) => string
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
  /** Pripomienka meškajúcemu potvrdeniu. Jedna správa na človeka, nie na dokument. */
  reminderEmail: {
    subject: (organisation: string) => string
    subtitle: string
    intro: (count: number) => string
    /** Druhý riadok položky — „znenie účinné od …" alebo označenie (bez dátumu). */
    itemLine: (version: string, days: number) => string
    /** „znenie účinné od {dátum}" (2. 10. 2026). */
    effectiveLine: (date: string) => string
    button: string
    note: string
    /**
     * Prvé oznámenie, nie pripomienka. Dni sa v ňom neuvádzajú: dokument,
     * ktorý pribudol dnes, „nečaká nula dní" — a veta o čakaní by z prvého
     * oslovenia spravila výčitku.
     */
    noticeSubject: (organisation: string) => string
    noticeSubtitle: string
    noticeIntro: (count: number) => string
    noticeItemLine: (versionLabel: string) => string
  }

  /** Hromadná pozvánka. Bez tokenu — človek si odkaz vyžiada sám. */
  inviteEmail: {
    subject: (organisation: string) => string
    subtitle: string
    /** Kto pozýva (právny názov) a kam (názov portálu). */
    intro: (legalName: string, portalName: string) => string
    how: string
    button: string
    note: string
    /** Informovanie o spracúvaní (C1) — veta pred odkazom na `/privacy`. */
    privacy: string
    privacyLink: string
  }

  /**
   * Pripomienka termínu (ADR-004). Dva tóny jednej šablóny — text hovorí
   * stav, nie len fakt.
   */
  dueReminderEmail: {
    subjectSoon: (organisation: string) => string
    subjectOver: (organisation: string) => string
    subtitleSoon: string
    subtitleOver: string
    introSoon: string
    introOver: string
    soonLine: (due: string, daysLeft: number) => string
    overLine: (due: string, daysOver: number) => string
    button: string
    note: string
  }

  /** Prosba o schválenie znenia (ADR-006). Menovitá správa, nie hromadná pošta. */
  privacy: {
    /** Rám PRIVACY-citatelnost (24. 9. 2026): obsah stránky a nadpis rámčeka námietky. */
    tocHeading: string
    objectionHeading: string
    title: string
    lead: string
    controllerHeading: string
    controller: (organisation: string) => string
    /** Sídlo a IČO pod názvom prevádzkovateľa. */
    controllerDetails: (address: string, registrationNumber: string) => string
    dpoHeading: string
    dpoMissing: string
    purposeHeading: string
    purpose: string
    dataHeading: string
    dataColumns: [string, string]
    data: [string, string][]
    hrNote: string
    responsibleNote: string
    basisHeading: string
    basisIntro: string
    basisObligation: string
    basisInterest: string
    basisDirectory: string
    retentionHeading: string
    retentionColumns: [string, string]
    /** `{evidence}`, `{cap}`, `{months}`, `{answers}` doplní stránka z lehôt organizácie (ADR-022, D136). */
    retention: [string, string][]
    years: (n: number) => string
    months: (n: number) => string
    retentionDelete: string
    recipientsHeading: string
    recipients: string
    processorsColumns: [string, string, string]
    /**
     * Sprostredkovatelia po kľúčoch — zoznam sa skladá z profilu organizácie
     * (`privacyProcessors`), nie natvrdo. `{region}` doplní kód (Bedrock).
     */
    processors: Record<"atlas" | "vercel" | "anthropic" | "bedrock" | "voyage" | "ecomail", [string, string, string]>
    noSale: string
    /** Bez modulu Vzdelávanie: nič sa nerozhoduje automatizovane. */
    automated: string
    /**
     * Časti o Vzdelávaní (ADR-018, ADR-021) — len keď má organizácia modul
     * zapnutý; inak by text sľuboval spracúvanie, ktoré sa nedeje.
     */
    learning: {
      purpose: string
      data: [string, string][]
      basis: (archiveLaw: string) => string
      retention: [string, string][]
      retentionNote: string
      recipients: string
      automated: string
      rights: string
    }
    rightsHeading: string
    rights: string
    objection: string
    /** Kam poslať námietku e-mailom (D153) — pred odkazom na adresu kontaktu GDPR. */
    objectionEmail: string
    /** Námietka po prihlásení (D153). */
    objectionFormLabel: string
    objectionFormHint: string
    objectionSubmit: string
    objectionSent: string
    objectionPending: (date: string) => string
    objectionSignIn: string
    objectionSignInLink: string
    /** Dozorný úrad podľa krajiny prevádzkovateľa (`controller.country`), nie podľa jazyka. */
    complaint: Record<"SK" | "CZ", string>
    /** Zákon o archívoch podľa krajiny prevádzkovateľa (certifikát, ADR-021 D132). */
    archiveLaw: Record<"SK" | "CZ", string>
    requests: string
    version: (date: string) => string
    /** Odkaz pri potvrdení a v pozvánke. */
    linkBefore: string
    link: string
    /** Doplnok DPO organizácie (ADR-022, D137). */
    extraHeading: string
  }

  versionMeta: {
    heading: string
    intro: string
    author: string
    authorHint: string
    approvedBy: string
    approvedByHint: string
    approvedOn: string
    effectiveFrom: string
    effectiveFromHint: string
    save: string
    locked: string
    voidsApproval: string
    suggested: string
    missing: string
    uploadHeading: string
    uploadNote: string
    fromMeta: (date: string) => string
  }

  /** E-maily k námietke podanej v aplikácii (D153). */
  objectionEmail: {
    noticeSubject: (organisation: string) => string
    noticeSubtitle: string
    noticeIntro: (person: string, date: string) => string
    noticeButton: string
    noticeNote: string
    receiptSubject: (organisation: string) => string
    receiptSubtitle: string
    receiptIntro: (date: string) => string
    receiptNote: string
    receiptContact: (email: string) => string
  }

  dpoEmail: {
    subject: (organisation: string, quarter: string) => string
    subtitle: string
    intro: (quarter: string) => string
    total: (n: number) => string
    legalObligation: (n: number) => string
    legitimateInterest: (n: number) => string
    withProblems: (n: number) => string
    button: string
    note: string
  }

  dpo: {
    heading: string
    /** Odkaz na záložku GDPR v nastaveniach (D154). */
    settingsMoved: string
    settingsLink: string
    intro: string
    reportHeading: string
    csv: string
    empty: string
    summary: (total: number, problems: number) => string
    basis: string
    reference: string
    responsible: string
    version: string
    none: string
    ok: string
    problems: Record<"noBasis" | "outsideCodelist" | "noReference" | "noResponsible" | "inactiveResponsible", string>
    objectionsHeading: string
    objectionsIntro: string
    recordHeading: string
    personEmail: string
    personEmailNote: string
    receivedAt: string
    channel: string
    channels: Record<"email" | "letter" | "in-person" | "other" | "app", string>
    objectionText: string
    objectionTextNote: string
    recordSubmit: string
    noObjections: string
    status: Record<"pending" | "upheld" | "rejected", string>
    receivedLine: (date: string, channel: string) => string
    recordedLine: (who: string, date: string) => string
    decideHeading: string
    upheld: string
    rejected: string
    decisionNote: string
    upheldWarning: string
    decideSubmit: string
    decidedLine: (who: string, date: string) => string
    deletedLine: (acknowledgements: number, unknownBasis: number) => string
    objectionRecorded: string
    objectionUpheld: string
    objectionRejected: string
    /** Výkaz s hľadaním a filtrami (DPO-vykaz-hladanie, 1. 10. 2026). */
    searchPlaceholder: string
    searchSubmit: string
    filterState: string
    filterBasis: string
    filterPerson: string
    filterAll: string
    stateProblems: string
    stateOk: string
    basisObligation: string
    basisInterest: string
    basisNone: string
    chipSearch: string
    removeFilter: (label: string) => string
    shownOf: (shown: number, total: number) => string
    groupBy: string
    groupState: string
    groupPerson: string
    noPerson: string
    writeEmail: (n: number) => string
    mailSubject: string
    mailBody: (list: string) => string
    mailBodyLink: (n: number, url: string) => string
    groupPersonMeta: (total: number, bad: number) => string
    pendingBanner: (n: number) => string
    pendingBannerMeta: (name: string, date: string) => string
    pendingDecide: string
    noMatch: string
    noMatchText: string
    noMatchLibrary: string
    clearSearch: string
    clearAll: string
    decidedToggle: (n: number) => string
    groupProblems: (n: number) => string
    groupOk: (n: number) => string
    colDocument: string
    colStatus: string
    pendingCount: (n: number) => string
    recordOpen: string
    /** Lehoty uchovávania organizácie (ADR-022, D136). */
    retention: {
      heading: string
      intro: string
      evidenceYears: string
      evidenceYearsNote: string
      capYears: string
      capYearsNote: string
      learningDetailMonths: string
      learningDetailMonthsNote: string
      answersMonths: string
      answersMonthsNote: string
      fixed: string
      warning: string
      save: string
      saved: string
    }
    /** Doplnkový text na stránku Ochrana osobných údajov (ADR-022, D137). */
    extra: {
      heading: string
      intro: string
      label: (language: string) => string
      save: string
      saved: string
    }
  }

  approvalEmail: {
    subject: (organisation: string) => string
    subtitle: string
    intro: (submittedBy: string) => string
    noteLabel: string
    versionLine: (label: string, effectiveFrom: string) => string
    button: string
    note: string
  }

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

  /** Moje potvrdenia — čo o mne systém eviduje (právo na prístup). */
  myAcknowledgements: {
    heading: string
    intro: string
    nothing: string
    download: string
    count: (n: number) => string
    acknowledged: string
    revoked: string
    versionLine: (label: string, effectiveFrom: string) => string
    whenLine: (when: string) => string
    /** Ten istý riadok pri odvolaní — „potvrdené" by tam klamalo. */
    revokedWhenLine: (when: string) => string
    /** Nadpis nad znením pri odvolanom zázname. */
    revokedStatement: string
    viaTrack: (track: string) => string
    reason: (text: string) => string
    footnoteBefore: string
    footnoteGuide: string
    footnoteAfter: string
    /** Hlavičky stĺpcov v stiahnutom súbore. */
    csv: {
      type: string
      document: string
      version: string
      effectiveFrom: string
      acknowledgedAt: string
      track: string
      statement: string
      reason: string
      ip: string
      browser: string
    }
  }

  /**
   * Návod. Obal obrazovky — samotný text je v `content/guide.ts`, aby sa
   * súvislý text na dve obrazovky nemiešal so zoznamom krátkych reťazcov.
   */
  guide: {
    heading: string
    intro: string
    /**
     * Poznámka, že text Návodu je zatiaľ len po slovensky.
     *
     * Preložená je vo všetkých troch jazykoch, ale ukáže sa len na
     * neslovenskej obrazovke — na slovenskej by hovorila, že text je
     * v jazyku, v ktorom ho čitateľ práve číta. Prázdny reťazec tu byť
     * nesmie: `tests/i18n.test.ts` ho odmieta, a právom — prázdna hodnota
     * v slovníku vyzerá rovnako ako nedokončený preklad.
     */
    onlySlovak: string
  }

  /** Hlavička: navigácia, téma, účet. */
  directory: {
    heading: string
    intro: string
    searchPlaceholder: string
    nothingFound: string
    /** Tvar čísla je v každom jazyku iný, preto sa skladá tu. */
    count: (n: number) => string
  }
  nav: {
    ask: string
    dpo: string
    /** Kanály (ADR-028, D169, D170) — správca organizácie a riešitelia kanálov. */
    channels: string
    /** Modul Vzdelávanie (ADR-018) — len pri zapnutom module. */
    learning: string
    learningManage: string
    learningTests: string
    toApprove: string
    evidence: string
    overview: string
    /** Popis navigačnej oblasti shellu pre čítačky obrazovky. */
    /** Kostra na čas čakania — jediné, čo o nej čítačka obrazovky povie. */
    loading: string
    sections: string
    /** Spodná lišta na telefóne — zlúčené „Na potvrdenie" + „Na schválenie". */
    tasks: string
    /** Piata položka lišty aj prepad pásu „Viac N" — vedie na `/more`. */
    more: string
    /** Skupiny dlaždíc na Prehľade, na `/more` a stĺpce plachty (SHELL-rozcestnik). */
    groupOrganisation: string
    groupManagement: string
    /** Prvý stĺpec plachty: Prehľad, Opýtať sa, Na potvrdenie, Na schválenie. */
    groupMain: string
    /** `aria-label` pásu cesty pod hlavičkou. */
    breadcrumb: string
    /** Posledná položka lišty a tlačidlo plachty menu (SHELL-menu-v-hlavicke). */
    menu: string
    /** Prvý fokusovateľný prvok stránky — odkaz na obsah. */
    skipToContent: string
    /** Tlačidlo 9 bodiek a nadpis plachty. */
    allSections: string
    /** Pätička plachty — Esc a odkaz na Prehľad s popismi. */
    escCloses: string
    sheetHint: string
    /** Jedna veta pod názvom dlaždice — čo v sekcii je. */
    desc: Record<"toAcknowledge" | "toApprove" | "directory" | "library" | "learning" | "assigned" | "evidence" | "people" | "evaluation" | "dpo" | "channels" | "learningManage" | "learningTests", string>
    /** Čo znamená štítok s počtom — čítačka nesmie prečítať holé číslo. */
    waiting: (n: number) => string
    toAcknowledge: string
    assigned: string
    /** Fronta hodnotiteľa — odpovede, pri ktorých niekto povedal, že nesedia. */
    evaluation: string
    people: string
    directory: string
    library: string
    organisation: string
    tenants: string
    openMenu: string
    closeMenu: string
    /** Globálne pole v hlavičke — otázka, nie filter zoznamu. */
    searchPlaceholder: string
    searchLabel: string
    searchSubmit: string
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

  /** Otvorená karta beží na staršej verzii, než je nasadená (`VersionNotice`). */
  versionNotice: {
    text: string
    reload: string
  }

  notFound: {
    heading: string
    intro: string
    home: string
  }

  home: {
    /**
     * Názov záložky, keď nie je známa ani stránka, ani organizácia. Inak
     * „{stránka} · {organizácia}" (ASK-otazka-z-hlavicky, Q4).
     */
    metaTitle: string
    metaDescription: string
  }

  /** Prihlasovacia obrazovka. Jazyk určuje organizácia — človek ešte nie je známy. */
  signIn: {
    /** Príklad adresy — neutrálny, nie doména konkrétnej organizácie. */
    emailPlaceholder: string
    /** Oddeľovač medzi prihlásením kontom a e-mailom. */
    or: string
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
    /** Prihlásenie bez JavaScriptu nefunguje — treba to aspoň povedať. */
    noScript: string
  }

  documents: {
    notInOrganisation: (email: string, organisation: string) => string
  }

  /** Voľné otázky — vyhľadávanie aj odpoveď. */
  ask: {
    submit: string
    /**
     * Čo sa práve deje, kým odpoveď ešte nezačala.
     *
     * Fázy chodia zo servera udalosťou `phase`, takže to nie je animovaný
     * odhad — každá sa ozýva práve vtedy, keď tá práca začína. `ranking`
     * sa v cloude neozýva vôbec: rerank tam robí agregačná pipeline.
     */
    phases: Record<"reading" | "searching" | "ranking" | "writing", string>
    examplesLabel: string
    examples: string[]
    unknownError: string
    /** Pilulky rozsahu hľadania — len keď je okrem knižnice aj živý zdroj (ADR-029). */
    scopeLabel: string
    scopeLibrary: string
    /** Bez JavaScriptu odpovedanie nefunguje — SSE sa formulárom nenahradí. */
    noScript: string
    noScriptLink: string
    /**
     * Plachta otázky z poľa v hlavičke a na `/ask` bez otázky
     * (ASK-otazka-z-hlavicky). Prvá veta vysvetlenia je tučná, preto dve časti.
     */
    sheet: {
      infoLead: (organisation: string) => string
      infoRest: string
      hint: string
      /** Vložená plachta na `/ask` sa nezatvára — bez „Esc zavrie". */
      hintInline: string
      /** Pri zozname vlastných otázok — so šípkami. */
      hintHistory: string
      insert: string
      close: string
    }
    /** História otázok (ASK-historia-otazok) — plachta, `/ask/history`. */
    history: {
      recent: string
      matching: string
      all: string
      title: string
      lead: string
      filter: string
      filterSubmit: string
      remove: string
      removed: string
      removedAll: string
      undo: string
      clearAll: string
      clearConfirm: string
      clearCancel: string
      retention: (months: number) => string
      loadOlder: string
      empty: string
      /** Druhá veta prázdneho stavu (ZAKLAD-prazdny-stav-citatelnost). */
      emptyText: string
      emptyFilter: string
      emptyFilterText: string
      status: { citations: (n: number) => string; none: string; fits: string; doesNotFit: string }
      today: string
      yesterday: string
    }
    /** Uložená odpoveď `/ask/a/{id}`. */
    saved: {
      banner: (date: string) => string
      newVersion: (document: string, label: string, date: string) => string
      askAgain: string
    }
    /** `/ask` bez otázky. */
    heading: string
    emptyLead: string
    /** `/ask` s otázkou: pod nadpisom (otázkou). */
    edit: string
    askedAt: (time: string) => string
    /** Hlavička karty odpovede so skratkou organizácie. */
    answerKicker: (organisation: string) => string
    /** Tretí stav obrazovky (ASK, úloha 1): na otázku sa z dokumentov nedá odpovedať. */
    none: {
      kicker: string; text: string; link: string
      /** K dňu otázky nemá organizácia žiadne platné znenie (krok 6). */
      noVersion: (date: string) => string
    }
    /** Chyba nad hero kartou (ASK, úloha 2) — vždy s cestou von. */
    error: { unavailable: string; link: string }
  }

  answer: {
    cacheTo: string
    cacheFrom: string
    techTokens: string
    techTotal: string
    /** Technické údaje pod odpoveďou (len hodnotitelia). */
    techModel: string
    /** Hlavička karty odpovede — hovorí, odkiaľ odpoveď je. */
    fromDocuments: string
    failed: string
    incompleteHeading: string
    incompleteNote: string
    citations: (shown: number) => string
    /** Za počtom zlúčených citácií: z koľkých odkazov vznikli. */
    citationsFrom: (total: number) => string
    /** Pravý stĺpec počas behu (ASK-odpoved-dva-stlpce). */
    citationsPending: string
    /** Zbalené technické údaje — len rolám s hodnotením (Q2). */
    technical: string
    openInLibrary: string
    /** Spodná plachta citácie na telefóne. */
    citationOf: (n: number, total: number) => string
    prev: string
    next: string
    close: string
    sourceMissing: string
    sources: (n: number) => string
    internal: string
    /** Štítok pri zdroji, ktorý je overenou odpoveďou, nie článkom normy (D11). */
    verified: string
    verifiedNote: string
    /** Zdroj z MCP konektora (ADR-029, D174): obišiel kurátora, čitateľ to má vedieť. */
    live: string
    liveNote: (connector: string, group: string | null) => string
    /** Pod odpoveďou: konektor nestihol alebo zlyhal — odpoveď je bez neho. */
    liveFailed: (names: string) => string
    /**
     * Znenie zdroja pod odpoveďou (plán „znenia v indexe", krok 5). Dátumy
     * prichádzajú už naformátované; koniec účinnosti len keď je známy.
     */
    sourceVersion: (label: string, from: string | null, to: string | null) => string
    /**
     * Štítok nad odpoveďou — ku ktorému dňu sa odpovedá (krok 6). Iný deň
     * než dnešok je výrazný, aby si čitateľ nepomýlil minulé právo s dnešným.
     */
    timeToday: (date: string) => string
    timeAsOf: (date: string) => string
    /** Porovnanie znení (krok 7): „1.1 (od 8. 9. 2026) → 1.2 (od 10. 9. 2026)". */
    timeCompare: (from: string, to: string) => string
    compareSide: (label: string, date: string | null) => string
    /** Porovnať sa nedalo — prečo, a že odpoveď je podľa dneška. */
    timeCompareUnavailable: Record<"single-version" | "missing-text" | "identical" | "no-document", (date: string) => string>
    /** Zhoda zdroja v troch stupňoch — relatívne v rámci jednej odpovede. */
    match: Record<"high" | "medium" | "low", string>
    adapter: string
    firstToken: string
    costNote: (pricelistVersion: string) => string
    pricelistStale: string
    citationsVerified: string
    citationsUnverified: string
  }
  /** Prideľovanie noriem (HR). */
  hr: {
    /**
     * Jedna škála stavov povinnosti pre celú rolu (HR.md, úloha 1) — kľúč
     * dáva `dutyState()` v `lib/due.ts`, popisok tento slovník. Obrazovky
     * ho zdieľajú, aby ten istý stav nevyzeral na každej inak.
     */
    dutyState: Record<"acknowledged" | "opened" | "not-opened" | "overdue" | "revoked", string>
    /** Podmenu sekcie (ZAKLAD-podmenu-a-akcie, 2. 10. 2026). */
    tabs: Record<"assignments" | "report" | "reminders" | "tracks" | "evidence", string>
    tabsLabel: string
    /**
     * Výkaz „ako je na tom organizácia" (D33). Iný pohľad než `overview`:
     * ten je o prideleniach, teda o tom, čo kurátor poslal. Tento je o tom,
     * čo z toho vyšlo — po dokumentoch, ľuďoch a trasách.
     */
    report: {
      heading: string
      intro: string
      views: Record<"document" | "person" | "track", string>
      /** Krátke popisy pre prepínač cez celú šírku na telefóne. */
      viewsShort: Record<"document" | "person" | "track", string>
      viewsLabel: string
      /** Prázdny stav cez `.empty` (HR.md, úloha 6). */
      emptyTitle: string
      emptyText: string
      done: (done: number, total: number) => string
      missing: (n: number) => string
      complete: string
      medianReading: string
      noReading: string
      readingNote: string
      export: string
      open: string
      /** Riadky detailu jednej položky. */
      acknowledgedAt: string
      readingTime: string
      /** Odvolanie potvrdenia (D24) — vidí to a robí len personalista. */
      revoke: string
      revokeReason: string
      revokeHint: string
      revokeButton: string
      revokeDone: string
      revokeFailed: string
      source: Record<"assignment" | "track" | "both", string>
    }
    overview: {
      assignedBy: (who: string) => string
      versionTag: (label: string) => string
      /** Posledné slovo úvodu (zvýraznené). */
      today: string
      heading: string
      intro: string
      assign: string
      /** Tlačidlo na trasy (`/hr/tracks`). Od 2. 10. 2026 sa všade volajú len „Trasy“. */
      tracks: string
      /** Karty trás v zozname (2. 10. 2026). */
      tracksNote: string
      trackLine: (people: number, documents: number) => string
      openTrack: string
      emptyTitle: string
      emptyText: string
      acknowledged: string
      notified: string
      no: string
      nobody: string
      missing: string
      notifyByEmail: string
      revoke: string
    }
    detail: {
      version: string
      assignedBy: string
      notAcknowledged: (missing: number, total: number) => string
      effectiveFrom: (date: string) => string
      notifyLink: string
      /** Prázdny zoznam je dobrá správa, nie chyba — nadpis to má povedať. */
      allTitle: string
      allText: string
      noLongerInDepartment: string
      note: string
    }
    /** Potvrdenie odvolania pridelenia (`/hr/[id]/revoke`). */
    revokeAssignment: {
      heading: string
      lead: string
      whatHappensHeading: string
      /** Ľudia, ktorým úloha zmizne. */
      tasksDisappear: (n: number) => string
      nobodyLoses: string
      /** Pridelené znenie už neplatí — úlohu nikto nevidí, vo výkaze visí nesplniteľná. */
      versionSuperseded: (assigned: string, current: string, n: number) => string
      acknowledgementsStay: (n: number) => string
      recordStays: string
      reassign: string
      reasonLabel: string
      reasonHint: string
      confirm: string
      cancel: string
      alreadyRevoked: string
    }
    notify: {
      /** Publikum trasy vo vete „Potvrdili už všetci, ktorých sa … týka". */
      trackAudience: (title: string) => string
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
      /** Počet v hlavičke skupiny „Ktoré normy" (rám HR-pravny-zaklad, bod 5). */
      documentsCount: (n: number) => string
      heading: string
      introBefore: string
      introHighlight: string
      introAfter: string
      emptyTitle: string
      emptyText: string
      whichDocuments: string
      versionLine: (label: string, date: string) => string
      to: string
      departments: string
      groups: string
      tracks: string
      /** Jednotlivé osoby zo zoznamu (KOMPONENT-hladanie-osob, Q3). */
      people: string
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
      /** Termín potvrdenia (D61). Nepovinný — bez neho sa nepripomína. */
      due: string
      dueNone: string
      dueDate: string
      dueDays: string
      dueDaysUnit: string
      dueNote: string
      submit: string
      /** Krok pred pridelením (HR.md, úloha 3): tlačidlo a súhrn dopadu. */
      checkImpact: string
      impactPeople: (n: number) => string
      impactNote: string
      /** Hľadanie v normách (HR-pridelit-normy-hladanie, bod 2). */
      docSearch: string
      docNone: (query: string) => string
      /** Filter „len bez právneho základu" (Q2) a návrat späť. */
      onlyMissingBasis: (n: number) => string
      showAll: string
      picked: (n: number) => string
      /**
       * Súhrn výberu nad tlačidlami (bod 7) — **nie je to dopad**, len počet
       * vybraných položiek. Funkcie vracajú slovo v správnom tvare, číslo
       * pripíše komponent.
       */
      summary: {
        documents: (n: number) => string
        departments: (n: number) => string
        groups: (n: number) => string
        tracks: (n: number) => string
        people: (n: number) => string
        everyone: string
        everyoneRest: string
        noAudience: string
      }
      /** Zastaraný dopad (bod 8, Q3): výber sa po kontrole zmenil. */
      impactStale: string
      impactStaleNote: (n: number) => string
      submitN: (n: number) => string
    }
    actions: {
      noAudience: string
      noDocument: string
      saveFailed: string
      /** „Pridelené: 4 (2 normy × 2 adresáti)." Tvary čísloviek patria sem. */
      /** Jedno pridelenie — povie čo a komu, nie počty. */
      assignedOne: (what: string) => string
      assigned: (count: number, documents: number, audiences: number) => string
      assignedWithExisting: (count: number, documents: number, audiences: number, already: number) => string
      /** Čo presne sa odvolalo — norma a publikum. */
      revoked: (what: string) => string
      alreadyRevoked: string
      nobodyToNotify: string
      tooManyRecipients: (recipients: number, max: number) => string
      sent: (n: number) => string
      sentWithFailures: (n: number, failed: string) => string
    }

    /** Hromadné pripomienky meškajúcim (rozsah C). */
    reminders: {
      heading: string
      intro: (days: number) => string
      open: string
      /** Prázdny stav; text sa líši podľa režimu (meškajúci / všetci nepotvrdení). */
      emptyTitle: string
      none: (days: number) => string
      person: (documents: number, days: number) => string
      send: (people: number) => string
      /** Súhrn pred odoslaním (HR.md, úloha 4): koľko e-mailov odíde a komu nič nepríde. */
      impactEmails: (n: number) => string
      impactNote: string
      sent: (n: number) => string
      nobody: string
      /**
       * Prah 0 = „všetkým, ktorí nepotvrdili", vrátane povinností, ktoré
       * vznikli dnes. Vtedy to nie je pripomienka, ale prvé oznámenie —
       * a nesmie tak ani vyzerať, inak sa človeku vyčíta meškanie, ktoré
       * nemal ako spôsobiť.
       */
      modeLabel: string
      modeNotice: string
      modeOverdue: (days: number) => string
      noticeHeading: string
      noticeIntro: string
      noticeNone: string
      noticePerson: (documents: number) => string
      noticeSend: (people: number) => string
      noticeSent: (n: number) => string
      noticeNobody: string
      /** Odkiaľ povinnosť plynie — pri trase nie je čo „prideliť". */
      fromTrack: (title: string) => string
    }
  }

  /** Strom s poradím — oddelenia aj priečinky knižnice. */
  tree: {
    saveOrder: string
    cancel: string
    hint: string
  }

  /** Výber skupín a značiek (`ValueSelect`, ZAKLAD-vyber-skupin-a-znaciek). */
  valueSelect: {
    onlyHere: string
    notInCodelist: string
    searchOf: (shown: number, total: number) => string
    groups: { count: (n: number) => string; newPlaceholder: string; foot: string; emptyFoot: string; search: string }
    tags: { count: (n: number) => string; newPlaceholder: string; foot: string; emptyFoot: string; search: string }
    /** Varovanie pri podobnom názve (Q3). */
    similar: (value: string, like: string) => string
    similarGroupNote: string
    similarTagNote: string
    pickLike: (like: string) => string
    createAnyway: (value: string) => string
    /** Nový dokument: podobná značka sa nepridala. */
    similarSkipped: (value: string, like: string) => string
  }

  /**
   * Viacnásobný výber s hľadaním (`components/MultiSelect.tsx`).
   *
   * `nothingFound` a `nothingFoundNew` sú dve vety, nie jedna s podmienkou:
   * keď sa nová hodnota pridať nedá, ponuka „stlačte Enter" je klamstvo.
   */
  multiSelect: {
    searchHint: string
    nothingFound: string
    nothingFoundNew: string
    empty: string
    clearAll: string
    done: string
    remove: (value: string) => string
    chosenOf: (chosen: number, total: number) => string
  }
  /** Prehľad (`docs/design/README.md`, časť 2). */
  overview: {
    hello: (name: string) => string
    tiles: Record<string, string>
    soonNote: (n: number) => string
    mine: string
    newNote: (days: number) => string
    expiringNote: (days: number) => string
    attention: string
    news: string
    /** Prázdny panel — dva riadky: čo tu nie je a čo z toho vyplýva (PREHLAD, úloha 1). */
    empty: {
      attentionTitle: string
      attentionText: string
      newsTitle: (days: number) => string
      newsText: string
    }
    /** Pätička panela — cesta k celému zoznamu (SHELL-rozcestnik, 4a). */
    showAll: (n: number) => string
    allTasks: string
    wholeLibrary: string
    /** Nadpis nad panelmi, pod dlaždicami sekcií. */
    forYou: string
    by: (date: string) => string
    until: (date: string) => string
    expiringChip: string
    open: string
    decide: string
    submittedBy: (who: string) => string
  }

  /** Reťaz dôkazov o potvrdení (ADR-005). Os je pohľad, nie záznam. */
  evidence: {
    /** Hlavička riadkov reťaze od 640 px (rám HR-pravny-zaklad, bod 6). */
    colPerson: string
    colDocument: string
    colState: string
    colDate: string
    heading: string
    intro: string
    /** Dva prázdne stavy: nič nevyhovuje filtru vs. žiadne záznamy vôbec. */
    emptyTitle: string
    emptyText: string
    emptyFilterTitle: string
    emptyFilterText: string
    kind: Record<string, string>
    gap: Record<string, string>
    informative: string
    seconds: (n: number) => string
    times: (n: number) => string
    states: Record<string, string>
    /** Riadky rozbaleného dôkazu (HR.md, úloha 5) — dvojice kľúč/hodnota. */
    rows: {
      ip: string
      department: string
      statement: string
      reading: string
      opened: string
      revokedBy: string
      revokeReason: string
    }
    /** Hodnota, ktorá sa nezaznamenala — pomlčka, nie prázdno. */
    none: string
    filterPerson: string
    filterState: string
    filterAll: string
    apply: string
    exportCsv: string
    shown: (n: number, all: number) => string
    notifiedMissing: string
    allPeople: string
  }

  approvals: {
    /** ADR-011: PDF konceptu a text na vyhľadávanie pod ním. */
    openPdf: string
    searchText: string
    heading: string
    intro: string
    /** Prázdny stav (`.empty`, APPROVALS úloha 3) — bez akcie: schvaľovateľ si prácu nevie nájsť sám. */
    emptyTitle: string
    emptyText: string
    versionLine: (label: string, round: string) => string
    roundLine: (round: number) => string
    submittedBy: (who: string, when: string) => string
    effectiveFrom: (date: string) => string
    noEffectiveFrom: string
    alsoDeciding: (names: string) => string
    /** Rám APPROVALS-pdf-konceptu (24. 9. 2026). */
    newVersionFrom: (date: string) => string
    firstVersionFrom: (date: string) => string
    draftVersion: string
    kicker: (round: number, who: string, when: string) => string
    whatYouApprove: string
    whatYouApproveNote: string
    searchTextNote: string
    metaHeading: string
    metaNote: string
    noteFrom: string
    alsoDecidingHeading: string
    readAndDecide: string
    readText: string
    noText: string
    /** Koncept sa po predložení zmenil — kolo sa týka inej podoby textu. */
    draftChanged: string
    reason: string
    reasonPlaceholder: string
    reasonHint: string
    approve: string
    reject: string
    doneApproved: string
    doneApprovedClosed: string
    doneRejected: string
  }
  /**
   * Kurácia — z potvrdeného posudku sa stáva overená odpoveď v znalostiach.
   * Dve obrazovky, dvaja ľudia: hodnotiteľ pripraví, správca obsahu zverejní.
   */
  curation: {
    prepareHeading: string
    prepareIntro: string
    prepareEmpty: string
    questionLabel: string
    questionHint: string
    answerLabel: string
    sourcesLabel: string
    sourcesHint: string
    noSources: string
    save: string
    draftBadge: string
    publishHeading: string
    publishIntro: string
    publishEmpty: string
    publishEmptyNote: string
    preparedBy: string
    /** Keď osoba, ktorá pár pripravila, už v `persons` nie je (O17). */
    preparedByUnknown: string
    access: string
    accessPublic: string
    accessInternal: string
    accessNote: string
    publish: string
    open: string
    waiting: (n: number) => string
  }
  /**
   * Fronta hodnotiteľa. Vlastná skupina, nie súčasť `rating`: `rating` je
   * panel pod odpoveďou, toto je obrazovka s cudzími odpoveďami.
   */
  evaluation: {
    heading: string
    intro: string
    empty: string
    emptyNote: string
    /** Čo povedal čitateľ — odznak nad kartou. */
    saidDoesNotFit: string
    reported: string
    reader: string
    answerLabel: string
    showAnswer: string
    hideAnswer: string
    sources: (n: number) => string
    askedAt: string
    waiting: (n: number) => string
  }
  rating: {
    /**
     * Dva režimy toho istého panela (2026-09-15). Bežný človek povie „sedí /
     * nesedí" a prípadne čo je zle; celé štyri polia vidí len hodnotiteľ.
     */
    readerQuestion: string
    fits: string
    doesNotFit: string
    readerThanks: string
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
  /** Správa tenantov — vidí ju len správca platformy (Fáza 5b). */
  admin: {
    list: {
      heading: string
      intro: string
      newTenant: string
      disabled: string
      /** Bez domény sa do organizácie nedá prihlásiť (ADMIN, úloha 1.5). */
      noDomainWarning: string
      /** Prázdny stav (ADMIN, úloha 1.3). */
      emptyTitle: string
      emptyText: string
      people: string
      peopleValue: (signedIn: number, total: number) => string
      /** Počet znení — ADMIN.md úloha 1.2 (rozhodnutie Jána 2026-09-22). */
      versions: string
      documents: string
      documentsValue: (valid: number, total: number) => string
      acknowledgements: string
      withoutVersion: string
      instructionsSent: (when: string, to: string) => string
      domainsNoteBefore: string
      domainsNoteAfter: string
    }
    create: {
      heading: string
      /** Veta okolo `contineo.app` a `CNAME` — tie zostávajú v JSX. */
      introBefore: string
      introMiddle: string
      introAfter: string
      code: string
      codeNoteBefore: string
      codeNoteHighlight: string
      codeNoteAfter: string
      /** Kolízia návrhu kódu (ADR-010, ADMIN.md úloha 1.4). */
      /** Šablóna s `{code}`, nie funkcia — dôvod pri `keyTaken`. */
      codeTaken: string
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
      disabled: string
      /** Blok čísel organizácie — trasy sú tu, v prehľade nie. */
      numbersHeading: string
      tracks: string
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
      /** Rozlíšenie od webových adries portálu (záložka Domény). */
      autoProvisionNotHosts: string
      save: string
      disableHeading: string
      enableHeading: string
      disableNote: string
      confirmLabel: (code: string) => string
      confirmHint: string
      domainsSection: string
      sendTitle: string
      disableOpen: string
      enableNote: string
      cancel: string
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
      removeOwnTitle: (provider: string) => string
      removeOwnNote: string
      removeOpen: string
      cancel: string
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
  /** Výpis auditu — používa ho nastavenie organizácie aj `/admin`. */
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
    /** Ukážka farby na troch prvkoch, na ktorých farba naozaj je. */
    previewLabel: string
    previewButton: string
    previewChipKey: string
    previewChip: string
    previewLink: string
  }
  org: {
    heading: string
    introBefore: string
    introAfter: string
    tabsLabel: string
    tabs: Record<string, string>
    /** Skupiny častí v zozname (ZAKLAD-zalozky, Q1). */
    groups: Record<"org" | "access" | "documents" | "oversight", string>
    /** Záložka GDPR (D154) — upravuje len DPO. */
    gdpr: { readOnly: string; saveContact: string; contactSaved: string; saved: string }
    /** MCP konektory organizácie (ADR-029). */
    connectors: {
      intro: string
      none: string
      add: string
      edit: string
      name: string
      endpoint: string
      endpointHint: string
      profile: string
      status: Record<"new" | "connected" | "disconnected" | "error", string>
      connectedBy: (by: string, date: string) => string
      connect: string
      reconnect: string
      disconnect: string
      remove: string
      removeConfirm: string
      secRetrieval: string
      secRetrievalNote: string
      retrievalOn: string
      defaultOn: string
      defaultOnNote: string
      ingestOn: string
      ingestNote: string
      accessLevel: string
      accessInternal: string
      accessPublic: string
      accessHint: string
      secScopes: string
      secScopesNote: string
      scopesField: string
      scopesHint: (fields: string) => string
      secReduction: string
      secReductionNote: string
      dropSections: string
      dropSectionsHint: string
      scrubPatterns: string
      scrubPatternsHint: string
      skipPaths: string
      skipPathsHint: string
      tools: string
      toolsNone: string
      save: string
      saved: string
      created: string
      removed: string
      connected: string
      disconnected: string
      lastError: string
      personalAccountNote: string
    }
    ai: {
      intro: string
      secProvider: string
      provider: string
      providerNote: string
      secKey: string
      secKeyNote: string
      keyLabel: string
      keyHint: string
      keyOwn: (hint: string, date: string, by: string) => string
      keyOperator: string
      keyNone: string
      deleteKey: string
      deleteKeyNote: string
      secModels: string
      secModelsNote: string
      answer: string
      answerNote: string
      utility: string
      utilityNote: string
      rewrite: string
      rewriteNote: string
      price: (input: string, output: string) => string
      save: string
      saved: string
      keyDeleted: string
    }
    aiUsage: {
      tabSettings: string
      tabUsage: string
      from: string
      to: string
      person: string
      purpose: string
      all: string
      apply: string
      exportCsv: string
      exportXlsx: string
      calls: string
      tokensIn: string
      tokensOut: string
      tokensCache: string
      total: string
      colWhen: string
      colPerson: string
      colWhat: string
      colModel: string
      colTokens: string
      colSum: string
      keyTenant: string
      keyOperator: string
      failed: string
      empty: string
      emptyText: string
      capped: (shown: number, all: number) => string
      note: string
      purposes: Record<"answer" | "query-rewrite" | "query-classify" | "pdf-rewrite" | "markdown-clean" | "chunking-analysis" | "faq-mining", { label: string; why: string }>
    }
    branding: {
      name: string
      nameNote: string
      shortName: string
      shortNameNote: string
      logo: string
      logoCurrent: string
      logoEmpty: string
      logoNote: string
      logoRemove: string
      logoRemoveNote: string
      color: string
      colorNote: string
      supportEmail: string
      supportEmailNote: string
      phonePrefix: string
      phonePrefixNote: string
      controller: string
      controllerNote: string
      controllerLegalName: string
      controllerAddress: string
      controllerRegistrationNumber: string
      controllerCountry: string
      countries: Record<"SK" | "CZ", string>
      /** Sekcie formulára (rám ADMIN-prevadzkovatel-a-ciselniky, 24. 9. 2026). */
      secIdentity: string
      secIdentityNote: string
      secContact: string
      /** Kontakt pre ochranu osobných údajov (D153). */
      secGdpr: string
      secGdprNote: string
      gdprName: string
      gdprEmail: string
      gdprEmailNote: string
      secAutoProvision: string
      saveBarNote: string
      controllerPreview: string
      invitePreview: string
      languages: string
      defaultLanguage: string
      defaultLanguageNote: string
      autoProvision: string
      autoProvisionBefore: string
      autoProvisionHighlight: string
      autoProvisionAfter: string
      /** Rozlíšenie od webových adries portálu (záložka Domény). */
      autoProvisionNotHosts: string
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
      requestOpen: string
      cancel: string
      pendingHeading: (n: number) => string
      pendingNote: string
      removeOpen: string
      removeConfirm: (host: string) => string
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
      removeOwnTitle: (provider: string) => string
      removeOwnNote: string
      removeOpen: string
      cancel: string
    }
    codelists: {
      /** Tlačidlo výberu bez JavaScriptu. */
      show: string
      /** Výber číselníka (R6, 6. 10. 2026) — popis poľa. */
      pick: string
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
      /** Pri obsadenom kľúči pod poľom. */
      keyTakenHint: string
      add: string
      keyNote: string
      /** Príklad do prázdneho poľa, pre každý číselník iný (rám ADMIN, bod 7). */
      examples: Record<string, { label: string; key: string }>
      moreBase: (n: number) => string
      colName: string
      colKey: string
      colUse: string
      baseBadge: string
    }
    /** Časť Potvrdzovanie (3. 10. 2026) — prah meškania organizácie. */
    acknowledgements: {
      heading: string
      intro: string
      overdueDays: string
      overdueDaysNote: string
      save: string
    }
    /** Hlásenia serverových akcií nastavenia organizácie. */
    actions: {
      saved: string
      failed: string
      confirmCode: (code: string) => string
      signInRemoved: string
      logoRemoved: string
      domainRequested: string
      domainNotFound: string
      domainWaiting: (host: string) => string
      domainOnNotInVercel: (host: string) => string
      domainOn: (host: string) => string
      domainRemoved: string
      codelistRemoved: string
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
    /** Pohlavie — kľúče `male`, `female` a `none` (nevyplnené). */
    genders: Record<string, string>
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
      /** Prázdne stavy (OSOBY.md, úloha 4): bez filtra vs. s filtrom. */
      emptyTitle: string
      emptyText: string
      emptyFilterTitle: string
      emptyFilterText: string
      clearFilter: string
      count: (n: number) => string
      matchesSearch: string
      capped: string
      status: Record<string, string>
      neverSignedIn: string
    }
    /** Hromadné pozvánky ľuďom, ktorí ešte nikdy neboli dnu. */
    inviteAll: {
      heading: string
      intro: string
      emptyTitle: string
      none: string
      preview: string
      send: (people: number) => string
      sent: (n: number) => string
      nobody: string
      open: string
    }
    invite: {
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
      gender: string
      genderNote: string
      submit: string
    }
    import: {
      heading: string
      introBefore: string
      introHighlight: string
      introMiddle: string
      introAfter: string
      /** Čo sa stane s riadkom, ktorý už v systéme je (OSOBY.md, úloha 5; ADR-019). */
      existingTitle: string
      existingNote: string
      /** Prepínač „Aktualizovať existujúcich“ a vysvetlenie, čo zapne. */
      overwriteLabel: string
      overwriteNote: string
      file: string
      /** Veta okolo zoznamu hlavičiek CSV — tie sa neprekladajú. */
      fileNoteBefore: string
      fileNoteAfter: string
      reading: string
      whatHappens: (name: string) => string
      rows: string
      willAdd: string
      willUpdate: (overwrite: boolean) => string
      invalid: string
      unchanged: string
      /** Tabuľka náhľadu (ADR-019): štítky stavov, názvy polí, hlavičky. */
      statuses: Record<"new" | "fill" | "overwrite" | "unchanged" | "error", string>
      fields: Record<string, string>
      colStatus: string
      colPerson: string
      colChanges: string
      filterAll: string
      noRowsForFilter: string
      searchPlaceholder: string
      nothingToWrite: string
      emptyValue: string
      unknownWorkplaces: string
      /** Stĺpec `trasy` nesie názvy (2. 10. 2026). */
      unknownTracks: string
      badPhones: string
      statusNoteBefore: string
      statusNoteHighlight: string
      statusNoteAfter: string
      write: string
      writing: string
      /** Dôvod, prečo sa riadok preskočí — kľúče sú kódy z `personsImport`. */
      reasons: Record<string, string>
    }
    detail: {
      previously: (list: string) => string
      invitedNotSignedIn: string
      newNotInvited: string
      inviteNoteSent: (date: string) => string
      excludedNoSignIn: string
      lastSeen: (when: string) => string
      never: string
      signsInVia: (list: string) => string
      email: string
      emailNote: string
      fullName: string
      givenName: string
      surname: string
      nameNote: string
      nameMissing: string
      titleBefore: string
      titleAfter: string
      titlesNote: string
      jobTitle: string
      jobTitleNote: string
      mobilePhone: string
      mobilePhoneCountry: string
      mobilePhoneNote: string
      workplace: string
      workplaceNone: string
      workplaceNote: string
      noWorkplacesBefore: string
      noWorkplacesLink: string
      noWorkplacesAfter: string
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
      gender: string
      genderNote: string
      groups: string
      newGroup: string
      groupsNote: string
      tracks: string
      /** Trasy pri osobe sa vyberajú podľa názvu (2. 10. 2026). */
      noTracks: string
      trackInactive: string
      trackUnknown: string
      roles: string
      rolesNote: string
      save: string
      /** Súhrn `<details>` „Prístup a členstvo" (OSOBY.md, úloha 3). */
      accessSummary: string
      /** Prázdne dôkazy na karte osoby (OSOBY.md, úloha 4). */
      evidenceEmptyTitle: string
      evidenceEmptyText: string
      returnHeading: string
      excludeHeading: string
      /** Karta „Pozvánka" na detaile — len kým sa osoba ani raz neprihlásila. */
      inviteHeading: string
      inviteNote: string
      inviteNoteSince: (date: string) => string
      inviteSubmit: string
      /** Prvá pozvánka — osoba ešte žiadnu nedostala („Nová"). */
      inviteSubmitFirst: string
      returnNoteBefore: string
      returnNoteHighlight: string
      returnNoteAfter: string
      returnSubmit: string
      excludeNote: string
      confirmLabel: string
      confirmNote: string
      excludeSubmit: string
      endedAtLabel: string
      endedAtNote: string
      endedAtHeading: string
      deactivatedOn: (date: string) => string
      endedAtCurrent: (date: string) => string
      endedAtMissing: string
      endedAtSubmit: string
      /** Rám OSOBY-skoncenie-vztahu (24. 9. 2026): časová os a fakty vyradenej osoby. */
      tlDeactivate: string
      tlDeactivateSub: string
      tlEnded: string
      tlEndedSub: string
      tlRetention: (years: number) => string
      tlRetentionSub: string
      factDeactivated: string
      factEnded: string
      factDeleteFrom: string
    }
    actions: {
      saved: string
      invited: string
      /** Osoba je zapísaná, ale e-mail neodišiel — pozvánku treba poslať znovu. */
      invitedNoEmail: string
      /** Pozvánka odoslaná znovu, z detailu osoby. */
      inviteResent: (email: string) => string
      inviteFailed: string
      /** Pozvánku si vypýtal niekto pre osobu, ktorá už bola dnu. */
      inviteNotNeeded: string
      excluded: string
      returned: string
      endedAtSaved: string
      confirmAddress: (email: string) => string
      failed: string
      noRight: string
      fileEmpty: string
      noRows: string
      importResult: (created: number, updated: number, unchanged: number, invalid: number, overwrite: boolean) => string
    }
    /**
     * Hľadanie v zozname osôb (KOMPONENT-hladanie-osob) — schvaľovatelia
     * a zodpovedná osoba. Nad rámikom s políčkami, nie namiesto neho.
     */
    search: {
      placeholder: string
      /** Názov poľa pre čítačku — ktorý zoznam sa prehľadáva. */
      label: (list: string) => string
      count: (shown: number, total: number) => string
      picked: (n: number) => string
      pickedOne: string
      none: (query: string) => string
      noneApprovers: string
      noneResponsible: string
      clear: string
      clearInput: string
      remove: (name: string) => string
      keysDown: string
      keysEnter: string
      keysEnterOne: (name: string) => string
      keysEsc: string
    }
  },
  /**
   * Zvonček: udalosti, ktoré sa stali, keď sa človek nepozeral.
   *
   * Vety sa skladajú **pri čítaní** z druhu a parametrov, nie sa ukladajú —
   * viď `notifications.ts`. Vďaka tomu sa starý oznam po prepnutí jazyka
   * prečíta v novom jazyku.
   */
  /**
   * „Nahlásiť nepresnosť" pod odpoveďou (O6/12).
   *
   * Vlastná skupina, nie súčasť `answer`: je to jediná časť tej obrazovky,
   * ktorá **zapisuje**, a texty majú byť pohromade s tým rozhodnutím.
   */
  report: {
    open: string
    whatIsWrong: string
    placeholder: string
    note: string
    submit: string
    sending: string
    thanks: string
    failed: string
  }
  notifications: {
    title: string
    /** Popisok zvončeka pre čítačku obrazovky; nesie aj počet. */
    bellLabel: (unread: number) => string
    unread: (n: number) => string
    emptyTitle: string
    emptyText: string
    markAllRead: string
    allRead: (n: number) => string
    retentionNote: (days: number) => string
    kinds: {
      reindexed: (title: string, chunks: number) => string
      rewritten: (title: string) => string
      remindersSent: (count: number) => string
      versionPublished: (title: string, label: string) => string
      responsibleAssigned: (title: string, label: string) => string
      /** Osoba určená za zodpovednú už v príprave (ADR-023) — má určiť základ pred zverejnením. */
      draftResponsibleAssigned: (title: string) => string
      /** Prihlásená osoba podala námietku (D153) — ide všetkým s rolou DPO. */
      objectionSubmitted: () => string
    }
  }
  /** Knižnica dokumentov (D53). */
  /** Zodpovedná osoba a právny základ pri znení (D91, O15). */
  responsibility: {
    responsiblePerson: string
    responsibleNote: string
    choosePerson: string
    noResponsible: string
    inactiveResponsible: string
    setResponsible: string
    changeResponsible: string
    changeReason: string
    changeReasonPlaceholder: string
    saveResponsible: string
    responsibleHistory: (n: number) => string
    responsibleChangeLine: (by: string, date: string, from: string, to: string) => string
    responsibleSaved: string
    legalBasis: string
    basisLabel: Record<string, string>
    basisHint: Record<string, string>
    basisUnset: string
    basisMissing: string
    reference: string
    referencePlaceholder: string
    referenceNote: string
    basisReason: string
    basisReasonNote: string
    saveBasis: string
    basisWho: string
    basisHistory: (n: number) => string
    basisChangeLine: (by: string, date: string, from: string, to: string) => string
    /** Základ určený ešte v príprave (ADR-023) — dopĺňa riadok histórie. */
    basisInPreparation: string
    basisSaved: string
    contactHeading: string
    contactProfile: string
    contactGone: string
    yourTaskHeading: string
    yourTaskNote: string
    /** Pripravované znenie (ADR-023, D139). */
    draftTaskHeading: string
    draftTaskNote: string
    draftBasisSummary: string
    draftEffective: (date: string) => string
    draftNewTitle: (title: string) => string
    draftText: string
    draftOpenPdf: string
    draftBasisSaved: string
    /** Zverejnené znenie, ktoré ešte nie je účinné (ADR-023). */
    pendingTaskHeading: (date: string) => string
    pendingTaskNote: string
    pendingBasisSummary: (date: string) => string
    /** Karta dokumentu v správe pre zodpovednú osobu bez roly správcu obsahu. */
    basisPageLead: string
    basisPageRead: string
    missingBasisTag: string
    missingBasisNote: string
    missingOptionNote: string
    /** Viac základov naraz (ADR-017, D115). */
    multipleNote: string
    outsideCodelist: string
    orgHeading: string
    orgHint: string
    standardTag: string
    customTag: string
    hiddenTag: string
    retiredTag: string
    hide: string
    unhide: string
    retire: string
    usedIn: (n: number) => string
    addHeading: string
    labelField: string
    labelPlaceholder: string
    keyField: string
    keyPlaceholder: string
    categoryField: string
    referenceField: string
    addButton: string
  }
  /** Obrazovka riešiteľa — tickety pod Kanálmi `/channels/tickets` (ADR-028 krok 4, D170). */
  helpdesk: {
    heading: string
    intro: string
    noChannels: string
    viewOpen: string
    viewSent: string
    viewClosed: string
    viewAll: string
    empty: string
    colSubject: string
    colAsker: string
    colChannel: string
    colState: string
    colUpdated: string
    colMessages: string
    state: Record<"new" | "drafted" | "sent" | "closed" | "reopened", string>
    source: Record<"chat" | "email", string>
    mine: string
    unassigned: string
    assignedTo: (name: string) => string
    take: string
    release: string
    thread: string
    quotedHistory: string
    threadSummary: (n: number, lastFrom: string, lastAt: string) => string
    threadImport: string
    threadImportHint: string
    msgThreadImported: (n: number) => string
    fromHelpdesk: string
    fromAsker: (name: string) => string
    attachments: (n: number) => string
    draftHeading: string
    draftIntro: string
    draftFromAi: string
    draftMeta: (model: string, when: string) => string
    noDraft: string
    draftSources: string
    answer: string
    answerHint: string
    saveDraft: string
    send: string
    sendHint: string
    sent: (by: string, when: string) => string
    sentUnchanged: string
    sentEdited: string
    close: string
    reopen: string
    toFaq: string
    toFaqIntro: string
    toFaqDocument: string
    toFaqSubmit: string
    toFaqDone: string
    noFaqDocuments: string
    noMailbox: string
    msgDrafted: string
    msgDraftSaved: string
    msgSent: string
    msgTaken: string
    msgReleased: string
    msgClosed: string
    msgReopened: string
    aiFailed: string
  }
  /** Widget pre cudzí systém (ADR-028, D166) — texty idú do skriptu widgetu podľa jazyka z tokenu. */
  widget: {
    open: string
    title: string
    placeholder: string
    send: string
    thinking: string
    sources: string
    helpful: string
    notHelpful: string
    thanks: string
    tryAgain: string
    noAnswer: string
    escalateIntro: string
    escalateMessage: string
    escalateSubmit: string
    escalated: string
    error: string
    expired: string
    poweredBy: string
  }
  /** Kanály (ADR-028, D161, D169): widget a portál — obsah, schránka, riešitelia, ťažba FAQ. */
  channels: {
    kinds: Record<"widget" | "portal", string>
    kindHints: Record<"widget" | "portal", string>
    kind: string
    ticketsOn: string
    ticketsHint: string
    portalNote: string
    builtIn: string
    builtInAssistant: string
    builtInPortal: string
    tabsLabel: string
    tabList: string
    tabMyTickets: string
    tabTickets: string
    tabSettings: string
    agentsNote: string
    back: string

    heading: string
    intro: string
    list: string
    empty: string
    newChannel: string
    edit: string
    keyHint: string
    name: string
    audience: string
    audienceHint: string
    folders: string
    foldersHint: string
    /** Rozsahy MCP konektorov pre kanál (ADR-029, D175). */
    connectorScopes: string
    connectorScopesHint: string
    connectorScopesNone: string
    assignees: string
    assigneesHint: string
    languages: string
    mailbox: string
    mailboxIntro: string
    mailboxNone: string
    mailboxKind: string
    kindGraph: string
    kindImap: string
    address: string
    addressHint: string
    tenantId: string
    clientId: string
    clientSecret: string
    clientSecretHint: string
    secretSet: (hint: string, when: string, by: string) => string
    secretNone: string
    sync: string
    syncNow: string
    syncNever: string
    syncLast: (when: string) => string
    syncError: (code: string) => string
    syncCounts: (created: number, appended: number, skipped: number) => string
    syncSinceHint: string
    syncInterval: string
    syncIntervalHint: string
    syncIntervalOption: (minutes: number) => string
    syncDone: (created: number, appended: number, beforeStart: number) => string
    verify: string
    verified: (address: string, name: string) => string
    widget: string
    widgetIntro: string
    widgetOrigins: string
    widgetOriginsHint: string
    rateLimit: string
    rateLimitHint: string
    widgetSecret: string
    widgetSecretRotate: string
    widgetSecretShown: string
    widgetSecretNone: string
    widgetSecretSet: (hint: string, when: string) => string
    mining: string
    miningIntro: string
    miningDocument: string
    miningLimit: string
    miningRun: string
    miningDone: (threads: number, proposed: number, saved: number, duplicates: number) => string
    noFaqDocuments: string
    tickets: (open: number, total: number) => string
    save: string
    saved: string
    created: string
    remove: string
    removed: string
    deployNote: string
  }
  library: {
    /** Knižnica pre osobu bez roly správy obsahu — platné dokumenty (SHELL-menu-v-hlavicke). */
    emptyForYou: string
    reader: {
      lead: string
      search: string
      searchSubmit: string
      emptyFilter: string
      validFrom: (date: string) => string
    }
    /**
     * Postup znenia v štyroch krokoch (rám KNIZNICA-postup-znenia, ADR-014).
     * Karta na detaile, ktorá nahradila „Čo treba teraz" a zbalené nástroje.
     */
    flow: {
      heading: (date: string) => string
      headingUndated: string
      firstVersion: string
      publishedHeading: (date: string) => string
      steps: [string, string, string, string]
      stepOf: (n: number) => string
      subPrepare: string
      subPrepareDone: string
      subWaitSubmit: string
      subInReview: (done: number, total: number) => string
      subApproved: string
      subRejected: (round: number) => string
      subCancelled: (round: number) => string
      subWaitApproval: string
      subPublished: string
      subAssign: string
      statusPreparing: string
      statusInReview: (by: string, date: string) => string
      statusApproved: string
      statusRejected: (date: string) => string
      statusPublished: (date: string) => string
      lead1: string
      lead1Rejected: string
      rejectedBy: (who: string, date: string, round: number) => string
      cancelled: (date: string, round: number) => string
      checkPdf: string
      checkPdfMissing: string
      checkSource: string
      checkSourceNote: string
      checkSourceMissing: string
      replace: string
      showText: string
      metaHeading: string
      metaNote: string
      approvers: string
      approversPrefilled: string
      responsible: string
      responsibleNote: string
      responsibleChosen: (name: string) => string
      /** Právny základ v príprave (ADR-023, D139). */
      basisChosen: (label: string) => string
      basisWaiting: (name: string) => string
      basisNoResponsible: string
      basisResponsibleGone: string
      basisSetHere: string
      basisChangeHere: string
      responsibleChange: string
      note: string
      submitAndSave: string
      resubmit: (round: number) => string
      saveOnly: string
      lead2: (done: number, total: number) => string
      approvalsWhere: string
      whatIsApproved: string
      locked: string
      searchText: string
      searchTextNote: string
      open: string
      show: string
      next: string
      next3: string
      next4: string
      next4None: string
      withdraw: string
      withdrawNote: string
      lead3: string
      labelSuggestion: (date: string) => string
      labelSuggested: string
      effectiveFromSourceSuggested: string
      carryOver: (n: number) => string
      carryOverNote: string
      publishFrom: (date: string) => string
      publishAndAssign: string
      lead4: string
      assignElsewhere: string
      assignChosen: string
      newVersion: string
      newVersionBusy: string
      newVersionFirst: string
      downloadPdf: string
      downloadSource: string
      editDocument: string
      currentHeading: string
      /** Zverejnená novela, ktorá ešte neplatí (ADR-023 D143) — karta vedľa platného znenia. */
      upcomingHeading: string
      upcomingNote: (date: string) => string
      fromDate: (date: string) => string
      changeResponsible: string
      changeBasis: string
      fixData: string
      history: string
      olderHeading: string
      olderNone: string
      /**
       * Staršie znenia ako zoznam (DETAIL-starsie-znenia). Pilulky sú krátke
       * tvary tých istých stavov ako v karte platného znenia — v riadku nie je
       * miesto na vetu.
       */
      older: {
        count: (n: number) => string
        note: string
        range: (from: string, to: string) => string
        published: (date: string) => string
        acks: string
        noAcks: string
        ackCount: (n: number) => string
        more: string
        showAll: (n: number) => string
        close: string
        responsibleMissing: string
        responsibleInactive: string
        basisMissing: string
      }
      manage: string
      /** Archivácia predpisu (ADR-025, D156). */
      archive: {
        heading: string
        intro: string
        until: string
        untilHint: string
        reason: string
        reasonHint: string
        submit: string
        blocked: string
        done: (date: string, revoked: number) => string
        scheduled: (date: string) => string
        bannerInEffect: (date: string) => string
        bannerScheduled: (date: string) => string
        bannerMeta: (who: string, at: string) => string
        restore: string
        restoreHint: string
        restored: string
      }
      uploadNext: string
      approvalHistory: string
      versionPageTitle: string
      versionPageBack: string
      /** Názov v príprave nového znenia (ADR-015, D112). */
      /** Označenie znenia z dátumu účinnosti (ADR-016, D113). */
      autoLabel: (date: string) => string
      autoLabelNote: string
      titleNote: string
      newTitle: (title: string) => string
      /** Pohľad „Upraviť dokument" (rám KNIZNICA-uprava-dokumentu). */
      secBasic: string
      secPlacement: string
      optional: string
      editSaveNote: string
      cancel: string
      titleLockedBefore: string
      titleLockedLink: string
      titleLockedAfter: string
      elsewhereHeading: string
      elsewhereVersion: string
      elsewhereMeta: string
      elsewhereResponsible: string
      elsewhereText: string
    }
    /**
     * Zopakovanie pridelenia na nové znenie.
     *
     * Vlastná skupina, nie súčasť `detail`: je to jediná karta na tej
     * obrazovke, ktorá **zapisuje mimo knižnice** — vytvára pridelenia, teda
     * povinnosti ľuďom. Oddelené texty sú pripomienka, že to nie je úprava
     * metadát.
     */
    carryOver: {
      heading: string
      intro: (label: string) => string
      audiences: string
      previously: (label: string, reason: string) => string
      reason: string
      reasonNote: string
      due: string
      dueNone: string
      dueDate: string
      dueDays: string
      dueDaysUnit: string
      dueNote: string
      submit: string
      noEmailNote: string
    }
    /**
     * Popisky polí, ktoré sú na dvoch obrazovkách naraz — pri nahratí
     * dokumentu aj pri úprave jeho údajov. Zdvojiť ich v `upload` aj
     * v `detail` by znamenalo, že sa raz rozídu a to isté pole sa bude
     * na dvoch miestach volať inak.
     */
    fields: {
      ownerDepartment: string
      /** Krátky tvar do panela filtrov a do hlavičky stĺpca. */
      ownerDepartmentShort: string
      ownerDepartmentNote: string
      ownerDepartmentNone: string
      ownerDepartmentEmpty: string
      internalNumber: string
      internalNumberNote: string
      internalNumberPlaceholder: string
    }
    list: {
      /**
       * Nadpis na obrazovke je **krátky** (`KNIZNICA.html`, rámy 1–8):
       * stojí pod navigáciou, kde je „Knižnica" hneď vedľa, a dlhší tvar
       * tlačil akcie v hlavičke na tablete do druhého riadka.
       */
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
      /** Nadpis facetu jazyka. Dovtedy sa tam omylom používal `status`. */
      language: string
      all: string
      /** Panel filtrov: nadpis, prístup, potvrdenie výberu, počet nájdených. */
      filtersTitle: string
      accessLevel: string
      apply: string
      tagSearch: string
      shown: (found: number, all: number) => string
      removeFilter: (value: string) => string
      /** Tabuľka: hlavičky stĺpcov, triedenie a stránkovanie. */
      colDocument: string
      colVersion: string
      /** Odkedy platí znenie, ktoré platí teraz. */
      colEffectiveFrom: string
      /**
       * Dokedy platí. Vlastný stĺpec, **nie štvrtá hodnota facetu Stav** (O6/10):
       * stav hovorí, kde je dokument v procese, platnosť je iná os.
       */
      colEffectiveTo: string
      /**
       * Koľko pridelených ľudí platné znenie potvrdilo. Percento sa nikdy
       * nepíše samo — menovateľ je pri ňom (O6/7).
       */
      colAcknowledged: string
      acknowledgedOf: (acknowledged: number, assigned: number) => string
      colChanged: string
      exportCsv: string
      sortBy: (column: string) => string
      pageRange: (from: number, to: number, total: number) => string
      pageOf: (page: number, pages: number) => string
      prevPage: string
      nextPage: string
      /** Prepínač pohľadu: tabuľka verzus karty. */
      viewSwitch: string
      /** Tlačidlo, ktoré pod 1024 px otvorí zásuvku filtrov. */
      filters: string
      /** Hlavné tlačidlo zásuvky filtrov — zavrie ju návratom k výsledkom. */
      showResults: (n: number) => string
      /** Popis ponuky „⋯" so zvyšnými akciami hlavičky. */
      moreActions: string

      /** „Čaká na schválenie“ nad knižnicou (ADR-006, krok 6). */
      waiting: {
        heading: string
        count: (n: number) => string
        since: (date: string) => string
        waitingFor: (names: string) => string
        nobodyPending: string
      }
      viewTable: string
      viewCards: string
      /** Hromadné akcie nad označenými dokumentmi. */
      bulk: {
        heading: string
        pickColumn: string
        pick: (title: string) => string
        /** Koľko je označených, koľko z toho nie je vidieť, a ako to zrušiť. */
        picked: (count: number) => string
        pickedOutside: (count: number) => string
        /** Dosiahnutý strop výberu — povie to nahlas, nech nemizne ticho. */
        pickedMax: (max: number) => string
        clearPicked: string
        moveTo: string
        move: string
        /** Potvrdenie presunu v zásuvke na telefóne — nesie počet, lebo pás
            pod 640 px ukazuje už len číslo. */
        moveConfirm: (count: number) => string
        assign: string
      }
      /** Query builder: podmienky, ktoré si človek zostaví sám. */
      builder: {
        heading: string
        hint: string
        field: string
        op: string
        value: string
        /** Ponuka pri dátumovom poli — napísané slovo sa uloží ako token. */
        today: string
        /**
         * Veta pri výbere poľa. „Platné do po X" sa pýta na koniec platnosti,
         * takže dokument bez neho nevyhovie — bez upozornenia to vyzerá ako
         * chyba v zozname.
         */
        fieldNote: string
        add: string
        remove: (description: string) => string
        matchAll: string
        matchAny: string
        /** Zmena spojky pred riadkom — A namiesto ALEBO a naopak. */
        makeAnd: string
        makeOr: string
        /** Pridanie podmienky do poslednej skupiny alebo ako novej. */
        addAnd: string
        addOr: string
        joinAll: string
        joinAny: string
        /** Spojka pred prvou podmienkou. Krátka, nech riadky sedia pod sebou. */
        joinFirst: string
        preview: string
        fields: Record<string, string>
        ops: Record<string, string>
      }
      /**
       * Názov stavu, v jednotnom čísle a s veľkým začiatočným písmenom
       * (`MASTER.md`, stavový model; `KNIZNICA.html`, rám 1).
       *
       * **Jeden slovník pre pilulku aj facet.** Do 23. 9. 2026 boli dva —
       * facet mal vlastné reťazce v množnom čísle („publikované",
       * „koncepty") — a na tej istej obrazovke vedľa seba hovoril riadok
       * „Platný" a panel „publikované".
       */
      statusLabel: {
        published: string
        draft: string
        review: string
        expired: string
        /** Archivovaný predpis (ADR-025). */
        archived: string
      }
      /** Tretia hodnota facetu Stav (ADR-006) — dokument s bežiacim kolom. */
      /** Štvrtá hodnota filtra stavu — odvodená z platnosti znenia (D27). */
      filter: string
      clearFilters: string
      /** Stav spracovania súboru — kľúče sú hodnoty z databázy. */
      processing: Record<string, string>
      draft: string
      effectiveVersion: string
      versions: (n: number) => string
      nothingFound: string
      /**
       * Prázdny zoznam má **dve podoby** (`KNIZNICA.html`): knižnica je
       * naozaj prázdna, alebo filtru nič nevyhovuje. Jedna veta pre oboje
       * klamala — „Začni nahratím prvého dokumentu" pri 148 dokumentoch
       * a zapnutom filtri posiela človeka robiť niečo, čo nepotrebuje.
       */
      empty: string
      emptyText: string
      emptyFilteredTitle: string
      /** „Máte nasadené dva filtre:" — počet je v texte, preto funkcia. */
      emptyFilteredBefore: (count: number) => string
      emptyFilteredAfter: string
      /** Spojka pred posledným filtrom vo výpočte. */
      and: string
    }
    /**
     * Skladanie trás onboardingu (rozsah C).
     *
     * Trasa je poradie krokov. Kým vznikala seedovacím skriptom, obrazovku
     * nepotrebovala; odkedy ju skladá kurátor, potrebuje aj slová.
     */
    tracks: {
      heading: string
      intro: string
      newHeading: string
      key: string
      keyHint: string
      /** Pri obsadenom kľúči pod poľom. */
      keyTaken: string
      title: string
      description: string
      create: string
      /** Prázdny zoznam trás (SPRAVA, úloha 1.1). */
      emptyTitle: string
      emptyText: string
      active: string
      inactive: string
      enable: string
      disable: string
      stepCount: (n: number) => string
      detailHeading: (title: string) => string
      /** Rozbalí názov a popis na úpravu — hore pri názve trasy (2. 10. 2026). */
      edit: string
      rename: string
      steps: string
      noSteps: string
      addStep: string
      chooseDocument: string
      requiresAck: string
      requiresAckHint: string
      ackYes: string
      ackNo: string
      remove: string
      moveUp: string
      moveDown: string
      created: string
      renamed: string
      stepsSaved: string
      /** Termín potvrdenia trasy — dni od pridania na ňu (3. 10. 2026). */
      dueHeading: string
      dueNone: string
      dueDays: string
      dueDaysUnit: string
      dueNote: string
      dueSave: string
      settingsHeading: string
      saveSettings: string
      addHeading: string
      cancel: string
      deactivateTitle: string
      deactivateNote: string
      activateTitle: string
      activateNote: string
      dueSaved: string
      settingsSaved: string
      dueCurrent: (days: number | null) => string
      /** Ľudia na trase (2. 10. 2026). */
      members: (n: number) => string
      noMembers: string
      membersInactive: string
      removeMember: string
      addMembers: string
      addMembersNote: string
      departments: string
      people: string
      addSubmit: string
      /** Zaškrtávatko „poslať e-mail pridaným" (3. 10. 2026). */
      notifyAdded: string
      notifyAddedHint: string
      membersAdded: (added: number, already: number) => string
      memberRemoved: string
      enabled: string
      disabled: string
    }

    folders: {
      heading: string
      /** Odkaz z panela a nadpis stránky správy priečinkov (`/library/folders`). */
      manage: string
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
      /** Prečo sa nedá zrušiť — s číslami, ktoré už na obrazovke sú (PRIECINKY, úloha 2). */
      removeBlocked: (documents: number, subfolders: number) => string
      /** Prázdny strom (PRIECINKY, úloha 1). */
      emptyTitle: string
      emptyText: string
      newFolder: string
      newFolderName: string
      parentFolder: string
      create: string
    }
    detail: {
      documentData: string
      /** Pravý panel detailu: potvrdenia, prehľad metadát, odkazy. */
      side: {
        progressHeading: string
        progressOf: (acknowledged: number, assigned: number) => string
        progressNobody: string
        progressWho: string
        /** Odkaz na Prideliť dokument s týmto dokumentom (3. 10. 2026). */
        progressAssign: string
        metaHeading: string
        folder: string
        unfiled: string
        identifier: string
        none: string
      }
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
      /** ADR-011: PDF a upraviteľný zdroj konceptu a znení. */
      draftPdf: string
      draftSource: string
      versionPdf: string
      versionSource: string
      noPdf: string
      noDraftPdf: string
      draftDiffers: string
      draftSame: string
      draftEmpty: string
      publishHeading: string
      /** Karta „čo treba teraz" (DETAIL, úloha 1): nové znenie s údajom, ktoré platí; bežiace kolo. */
      nowPublishNew: (current: string) => string
      nowInReview: string
      /** Súhrnný nadpis rozbaľovacej skupiny s ostatnými akciami. */
      toolsSummary: string
      /** Označenie konceptu v schvaľovacom paneli aj v e-maile schvaľovateľovi. */
      approvalDraftLabel: string
      draftApprovalHeading: string
      publishNeedsApproval: string
      publishWaitsForApproval: string
      publishApprovedNote: string
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
      /** Preindexovanie jedného znenia z ponuky ⋯ (fáza 2). */
      reindexVersionHeading: string
      reindexVersionNote: string
      reindexVersion: string
      newVersionHeading: string
      newVersionNote: string
      newVersionFile: string
      newVersionSubmit: string
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
      /**
       * História opráv znenia. Zapisuje sa od začiatku (`fixes[]`), ukazuje
       * sa až odteraz — spätne sa nedopíše, preto zápis predbehol obrazovku.
       */
      fixHistory: (n: number) => string
      fixLine: (who: string, when: string) => string
      fixWas: (label: string, effectiveFrom: string) => string
      fixReacknowledged: string
      fixNoDate: string
      versionLockedBefore: string
      versionLockedHighlight: (people: number) => string
      versionLockedAfter: string
      revokeVersionHeading: string
      revokeVersionNote: (people: number) => string
      revokeVersionReason: string
      revokeVersionReasonPlaceholder: string
      revokeVersionSubmit: string
      fixSubmit: string

      /**
       * Oprava **textu** znenia bez novej verzie. Iná vec než `fix*` vyššie: tie
       * opravujú údaje *o* znení, toto samotný text.
       */
      textFixHeading: string
      /** Ktoré znenie sa opravuje (fáza 3) a odkaz na porovnanie s druhým opraviteľným. */
      textFixTarget: (label: string) => string
      textFixOther: (label: string) => string
      /** Panel „Opraviť text" pri znení. */
      textFixPanel: string
      textFixPanelNote: string
      textFixLoad: string
      textFixIntro: string
      textFixDiffHeading: string
      textFixDiffStat: (added: number, removed: number) => string
      textFixGap: (n: number) => string
      textFixCoarse: string
      textFixApprovalNote: string
      textFixReason: string
      textFixReasonPlaceholder: string
      textFixReasonNote: string
      textFixSubmit: string
      textFixHistory: (n: number) => string
      textFixLine: (who: string, when: string) => string

      /**
       * Schvaľovanie znenia (ADR-006). Stav je odvodený z kôl, nie uložený —
       * preto sú to štyri hodnoty a nie pole v databáze.
       */
      approvalHeading: string
      stateDraft: string
      stateInReview: string
      stateApproved: string
      statePublishedBefore: string
      statePublishedBeforeNote: string
      approvalSubmit: string
      approvalApprovers: string
      approvalApproversHint: string
      approvalNoPeople: string
      approvalNote: string
      approvalNotePlaceholder: string
      approvalNoteHint: string
      approvalSubmitButton: string
      approvalWaiting: string
      approvalNotDecided: string
      approvalApproved: (when: string) => string
      approvalRejected: (when: string) => string
      approvalRoundHeading: (round: number) => string
      approvalSubmittedBy: (who: string, when: string) => string
      approvalHistory: (n: number) => string
      approvalCancel: string
      approvalCancelReason: string
      approvalCancelHint: string
      approvalCancelButton: string
    }
    chunks: {
      heading: string
      intro: string
      openLink: string
      profile: string
      version: string
      noVersion: string
      upToDate: string
      outdated: (stored: number, today: number) => string
      reindexHint: string
      statsCount: string
      statsArticles: string
      statsTokens: string
      tokensRange: (min: number, avg: number, max: number) => string
      target: (min: number, max: number) => string
      warningsHeading: string
      warnings: {
        oneBlock: string
        fewArticles: (percent: number) => string
        oversized: (count: number, limit: number) => string
        fragments: (count: number) => string
      }
      noWarnings: string
      analysisHeading: string
      analysisFound: (lines: number, articles: number, paragraphs: number, points: number, headings: number) => string
      analysisFits: (word: string) => string
      analysisOther: (word: string) => string
      analysisPlain: string
      listHeading: string
      noArticle: string
      tokens: (n: number) => string
      oversizedTag: string
      trialHeading: string
      trialIntro: string
      fieldArticleWord: string
      fieldArticleWordHint: string
      fieldAnnexWord: string
      fieldMinTokens: string
      fieldMaxTokens: string
      trialShow: string
      trialReset: string
      compareHeading: string
      compareNow: string
      compareTrial: string
      compareMax: string
      trialMatches: (label: string) => string
      trialSameAsCurrent: string
      trialListHeading: string
      saveHeading: string
      saveIntro: string
      useProfile: string
      useProfileButton: string
      currentProfile: string
      newProfile: string
      newProfileLabel: string
      newProfileHint: string
      newProfileButton: string
      adviceHeading: string
      adviceIntro: string
      adviceButton: string
      adviceAgain: string
      adviceMeta: (date: string, model: string, by: string) => string
      adviceStrategyArticles: (word: string, min: number, max: number) => string
      adviceStrategyHeadings: string
      adviceConfidence: Record<"low" | "medium" | "high", string>
      adviceIssues: string
      adviceTry: string
    }
    editor: {
      intro: string
      modelDraft: string
      /** Ten istý štítok, keď návrh nevyrobil model, ale pravidlá. */
      ruleDraft: string
      modeRewriteScan: string
      modeClean: string
      draftMeta: (model: string, when: string, chars: number) => string
      draftNoteBefore: string
      /** Ten istý riadok pre návrh z pravidiel — o modeli sa tam nehovorí. */
      ruleNoteBefore: string
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
      /** Že prečistenie beží na pravidlách, nie na modeli. */
      cleanNote: string
      rewriteScan: string
      rewriteScanNote: string
    }
    /** Hlásenia serverových akcií — chodia späť cez `?msg=`. */
    actions: {
      converted: string
      metaSaved: string
      convertedWithWarnings: (warnings: string) => string
      versionSameAsPublished: string
      versionDiffers: (added: number, removed: number) => string
      saved: string
      changesSaved: string
      alreadyPublished: string
      published: (chunks: number, archived: number) => string
      modelReturnedDraft: string
      rulesReturnedDraft: string
      draftAccepted: string
      draftDiscarded: string
      assigned: string
      /** Hromadné akcie: prázdny výber a výsledok dávky. */
      bulkNothingSelected: string
      bulkMoved: (moved: number, total: number) => string
      bulkMovedPartly: (moved: number, total: number, failed: string) => string
      reindexUpToDate: string
      chunkingProfileSet: (label: string) => string
      chunkingProfileCreated: (label: string) => string
      chunkingAdviceReady: string
      reindexed: (chunks: number, archived: number) => string
      /** Súhrn „Preindexovať všetky znenia": koľko sa preindexovalo a koľko bolo bez zmeny. */
      reindexAllResult: (done: number, unchanged: number) => string
      fixed: string
      versionRevoked: (people: number) => string
      /** Koľko publík sa prenieslo a koľko ich znenie už malo. */
      carriedOver: (created: number, already: number) => string
      textFixed: (added: number, removed: number, chunks: number) => string
      submittedForApproval: (n: number) => string
      approvalNotAllNotified: (n: number) => string
      approvalCancelled: string
      /** Krok 1 uložený bez predloženia (ADR-014). */
      draftPrepared: string
      /** Znenie sa zverejnilo, prenos pridelení nie. Za vetou nasleduje dôvod. */
      carryOverFailed: string
      failed: string
    }
    /** FAQ ako druh dokumentu (ADR-028, D164): založenie, editor záznamov, texty znenia a indexu. */
    /** Import článkov z MCP konektora (ADR-029, použitie B). */
    connectorImport: {
      heading: string
      intro: string
      /** Odkaz z nahrávania. */
      newLink: string
      noConnector: string
      noConnectorLink: string
      connector: string
      scope: string
      query: string
      queryPlaceholder: string
      queryHint: string
      search: string
      nothingFound: string
      errorBefore: string
      pick: (n: number) => string
      alreadySame: string
      alreadyChanged: string
      open: string
      metaNote: string
      folder: string
      folderNone: string
      accessHint: string
      import: string
      afterNote: string
      done: (created: number, versions: number, unchanged: number, failed: number) => string
      /** Riadok pod názvom v PDF: odkiaľ článok je. */
      pdfOrigin: (connector: string, path: string) => string
      /** Detail dokumentu: blok „Zdroj". */
      sourceHeading: string
      sourceLine: (connector: string, group: string | null, date: string) => string
      sourcePath: string
      resync: string
      resyncHint: string
      resyncUnchanged: string
      resyncVersion: string
    }
    faq: {
      newHeading: string
      newIntro: string
      /** Odkaz z nahrávania: FAQ sa nenahráva ako súbor. */
      newLink: string
      create: string
      created: string
      heading: string
      intro: string
      empty: string
      addHeading: string
      editHeading: (n: number) => string
      question: string
      questionHint: string
      variants: string
      variantsHint: string
      answer: string
      answerHint: string
      sources: string
      sourcesHint: string
      sourceDocument: string
      sourceNone: string
      sourceArticle: string
      sourceArticlePlaceholder: string
      audience: string
      audienceHint: string
      save: string
      add: string
      remove: string
      saved: string
      removed: string
      stateNew: string
      stateChanged: string
      statePublished: string
      stateSourceChanged: string
      access: (level: string) => string
      count: (n: number) => string
      /** Hlavné tlačidlo na detaile FAQ namiesto „Nové znenie". */
      editEntries: string
      openEntries: string
      pdfNote: string
      publishNote: string
      /** Texty v jazyku dokumentu — Markdown, PDF a úsek v indexe. */
      mdIntro: string
      mdQuestion: string
      mdVariants: string
      mdAnswer: string
      mdSources: string
      mdAudience: string
      mdEmpty: string
      pdfPage: (n: number, total: number) => string
    }
    upload: {
      /** Číslované sekcie formulára — nie kroky sprievodcu, viď komentár v `new/page.tsx`. */
      sectionFile: string
      sectionMeta: string
      dropHint: string
      pick: string
      heading: string
      intro: string
      file: string
      /** Chyba pri nahrávaní (NAHRAVANIE, úloha 1): čo opraviť a že súbor treba vybrať znova. */
      errorBefore: string
      errorFileAgain: string
      /** Limit veľkosti pri zóne na súbor — číslo z `fileStore.MAX_BYTES`. */
      maxSize: (mb: number) => string
      /** Veta okolo `.doc` a `.xls` — značky zostávajú v JSX. */
      oldFormatsBefore: string
      oldFormatsMiddle: string
      oldFormatsAfter: string
      title: string
      titlePlaceholder: string
      titleNote: string
      key: string
      /** Náhľad identifikátora a ručný kľúč (NAHRAVANIE, úloha 4 / ADR-010). */
      keyPreview: string
      keyManualSummary: string
      keyManualNote: string
      /**
       * **Šablóna, nie funkcia.** Klientsky komponent `KeyPreview` dosadí
       * `{id}` sám. Funkcia by sa sem vrátiť nesmela: `/library/new` je
       * serverový komponent a funkcia cez hranicu do klienta neprejde —
       * React ju odmietne a stránka spadne celá, nie len tá hláška.
       */
      keyTaken: string
      keysTaken: string
      /** Nápoveda pri Druhu — hodnoty z `CODELISTS.category` (úloha 5). */
      categoryNote: string
      /** Nadpis rozbaľovacej skupiny nepovinných polí (úloha 6). */
      moreFields: string
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
      /** Text tlačidla počas odosielania. */
      submitPending: string
      /** Veta pod pruhom — čo sa deje a že to trvá. */
      submitPendingNote: string
      /** „Zmeniť" pri vybranom súbore (NAHRAVANIE-pdf-a-udaje-o-zneni). */
      change: string
      optional: string
      pickPdfFirst: string
      /** Variant poznámky o predvyplnení, keď je zdroj dokument Word. */
      prefillFromWord: string
      /** Dve polia na súbor (ADR-011): PDF povinné, zdroj odporúčaný. */
      pdfTitle: string
      pdfNote: string
      sourceTitle: string
      sourceNote: string
      noScriptLimit: (mb: number) => string
      /** Šablóna — `{name}`, `{percent}`. Ide do klientskeho komponentu, funkcia by tam neprešla. */
      uploadingFile: string
      uploadFailed: string
      /** Šablóna — `{name}`, `{mb}`, `{maxMb}`. */
      fileTooLarge: string
    }
  }
  /** Modul Vzdelávanie (ADR-018). L0: len nadpisy a prázdne stavy. */
  learning: {
    /** Popis prepínača stavu nad zoznamom (čítačka). */
    statusFilter: string
    /** Modul organizácia nemá zapnutý (SHELL-menu-v-hlavicke, Q5) — nie 404. */
    off: {
      title: string
      lead: string
      admin: (contact: string) => string
      tasks: string
      back: string
    }
    heading: string
    intro: string
    empty: string
    emptyNote: string
    manageHeading: string
    manageIntro: string
    manageEmpty: string
    manageEmptyNote: string
    testsHeading: string
    testsIntro: string
    testsEmpty: string
    testsEmptyNote: string
    groupInProgress: string
    groupToEnroll: string
    groupDone: string
    statusInProgress: string
    statusAssigned: string
    statusOpen: string
    statusDone: string
    continue: string
    start: string
    enrol: string
    certificate: string
    openCourse: string
    next: (n: number, title: string) => string
    assignedOn: (date: string, who: string) => string
    assignedOnNoWho: (date: string) => string
    openNote: string
    noCertificate: string
    doneOn: (date: string) => string
    archivedNote: string
    minutes: (n: number) => string
    parts: (n: number, required: number) => string
    issuesCertificate: string
    progress: (done: number, total: number) => string
    nothingWaiting: string
    nothingWaitingNote: string
    filterNone: (names: string) => string
    clearFilters: string
    topic: string
    allTopics: string
    smartTags: string
    selected: (n: number) => string
    filterNote: string
    enrolled: (title: string) => string
    removeFilter: (name: string) => string
    /** Prehľad kurzu (rám COURSE). */
    course: {
      yourProgress: string
      countOf: (done: number, total: number) => string
      requiredParts: string
      startCourse: string
      continueHere: string
      kvVersion: string
      kvEnrolled: string
      enrolledVia: { assignment: string; self: string }
      kvLanguage: string
      kvEstimate: string
      kvCertificate: string
      kvOrder: string
      yes: string
      no: string
      orderSequential: string
      orderAny: string
      aboutCourse: string
      partsHeading: string
      partsNoteSequential: string
      partsNoteAny: string
      partRequired: string
      partOptional: string
      blocks: (n: number) => string
      blockTypes: { image: string; gallery: string; document: string; video: string; videoExternal: string }
      mustWatchVideo: (minutes: number) => string
      partDoneOn: (date: string) => string
      partAvailable: string
      partLockedAfter: (n: number) => string
      partInProgress: string
      partInProgressVideo: (percent: number) => string
      testLabel: string
      testRequired: string
      testOptional: string
      testNotStarted: string
      testPassed: string
      noticeDone: (date: string) => string
      noticeNewVersion: (version: number, date: string, mine: number) => string
      noticeArchived: string
      versionN: (n: number) => string
      enrolledSince: (date: string) => string
      notEnrolledNote: string
      previewNotice: (v: number) => string
      previewEdit: string
      previewSide: string
    }
    /** Časť kurzu (rám PART). */
    part: {
      nextPart: string
      docKicker: string
      openPdf: string
      docDetail: string
      docMissing: string
      externalChip: string
      externalBad: string
      play: string
      pause: string
      mute: string
      unmute: string
      fullscreen: string
      progress: string
      mustWatchChip: string
      mustWatchNote: string
      watchedChip: string
      noScriptNote: string
      testsHeading: string
      testStart: string
      markDone: string
      markReady: string
      nextPartLink: string
      previewDock: string
      optionalTestNote: string
      testsJump: string
      marked: string
      partOf: (n: number, total: number) => string
      docNewer: (label: string) => string
      markDisabledVideo: (percent: number) => string
      markedWaitingTest: (date: string) => string
      partDone: (date: string) => string
      requiredTestSummary: (state: string) => string
    }
    /** Správa kurzov (rám MANAGE). */
    manage: {
      tabsLabel: string
      tabCourses: string
      tabTopics: string
      tabTags: string
      newCourse: string
      statusAll: string
      statusDraft: string
      statusPublished: string
      statusArchived: string
      colCourse: string
      colTopic: string
      colStatus: string
      colEnrolled: string
      colCompleted: string
      colUpdated: string
      edit: string
      openEnrollment: string
      courseTitle: string
      courseKey: string
      keyHint: string
      keyTaken: string
      topic: string
      topicNone: string
      create: string
      cancel: string
      emptyText: string
      topicsHeading: string
      rename: string
      retire: string
      restore: string
      retired: string
      newTopic: string
      topicName: string
      topicKey: string
      addTopic: string
      topicsEmpty: string
      topicAdded: string
      topicRenamed: string
      topicRetired: string
      topicRestored: string
      save: string
      tagsIntro: string
      tagsEmpty: string
      renameKey: string
      newValue: string
      mergeButton: string
      mergeInto: string
      clearSelection: string
      mergeSelected: string
      whatStays: string
      newEntry: string
      keyLabel: string
      selectTag: string
      tagPlaceholder: string
      topicCourses: (n: number) => string
      enrolledCompleted: (enrolled: number, completed: number) => string
      usage: (courses: number, questions: number, tests: number) => string
      impact: (courses: number, questions: number, tests: number) => string
      exists: (label: string) => string
      renamed: (label: string) => string
      selected: (n: number) => string
      mergeTitle: (n: number) => string
      mergeResult: (target: string) => string
      merged: (n: number, target: string) => string
    }
    /** Úprava kurzu (rám MANAGE-COURSE). */
    edit: {
      settingsSaved: string
      stepsLabel: string
      missingHeading: string
      readyHeading: string
      checkParts: string
      checkLegal: string
      checkTopic: string
      publishDisabledNote: string
      publishedLead: string
      newVersion: string
      archive: string
      restore: string
      cannotPublish: string
      archived: string
      tabParts: string
      tabSettings: string
      tabPeople: string
      partsHeading: string
      up: string
      down: string
      editPart: string
      view: string
      newPart: string
      partTitle: string
      required: string
      addPart: string
      noParts: string
      allParts: string
      removePart: string
      save: string
      minutes: string
      summary: string
      blocksHeading: string
      noBlocks: string
      addBlock: string
      blockType: string
      markdown: string
      alt: string
      altGallery: string
      caption: string
      document: string
      videoSource: string
      sourceUpload: string
      sourceExternal: string
      url: string
      mustWatch: string
      mustWatchNote: string
      externalWarn: string
      removeBlock: string
      add: string
      mediaImage: string
      mediaVideo: string
      mediaNote: string
      progressTitle: string
      uploading: string
      uploadFailed: string
      tooLarge: string
      testsHeading: string
      testsLater: string
      mustWatchShort: string
      cancel: string
      editBlock: string
      noDocuments: string
      optional: string
      steps: string[]
      stepSub: { draft: (n: number) => string; published: (n: number) => string; archived: (n: number) => string }
      blockTypes: { text: string; image: string; gallery: string; document: string; video: string; videoExternal: string }
      problem: (code: string, part: string) => string
      publishButton: (n: number) => string
      keepPublished: (prev: number, next: number) => string
      archivedLead: (n: number) => string
      published: (n: number) => string
      newVersionStarted: (n: number) => string
      blocksTests: (blocks: number, tests: number) => string
      readOnly: (n: number) => string
      savedAt: (date: string) => string
      statusDraftReady: (v: number) => string
      statusDraftMissing: (v: number, n: number) => string
      statusPublished: (v: number) => string
      statusArchived: string
      statusLabel: string
      previewAsStudent: string
      archiveOpen: string
      archiveTitle: (title: string) => string
      archiveNoNew: string
      archiveInProgress: (n: number, v: number) => string
      archiveKeeps: string
      archiveRestoreNote: string
      archiveButton: string
      removePartOpen: string
      removePartTitle: (title: string, blocks: number, tests: number) => string
      removePartNote: (v: number) => string
      removePartButton: string
      blockMenuNote: { document: string; video: string }
      newBlockHeading: (type: string) => string
      blockHeading: (n: number, type: string) => string
      saveBlock: string
      removeBlockButton: string
      removeBlockNote: (draft: number, published: number | null) => string
      noEditBlock: string
      sourceExternalSub: string
      partGroup: string
      savePart: string
      saveTests: string
      testsSaved: string
      partSaved: string
    }
    /** Nastavenia kurzu (rám MANAGE-COURSE, ?tab=settings). */
    settings: {
      title: string
      keyNote: string
      subtitle: string
      description: string
      topic: string
      language: string
      languageNote: string
      estimate: string
      smartTags: string
      groupFlow: string
      sequential: string
      sequentialNote: string
      openEnrollment: string
      openEnrollmentNote: string
      issuesCertificate: string
      signerName: string
      signerRole: string
      groupLegal: string
      legalNote: string
      legalNone: string
      save: string
      tagPlaceholder: string
      tagNewKey: string
      tagNewValue: string
      tagRemove: string
      tagValues: string
      tagField: string
      tagNoScript: string
      none: string
      readOnly: (n: number) => string
    }
    /** Zapísaní a prideľovanie (rám MANAGE-COURSE, ?tab=people). */
    people: {
      filterAll: string
      notStarted: string
      inProgress: string
      done: string
      assign: string
      exportCsv: string
      colName: string
      colEmail: string
      colDepartment: string
      colEnrollment: string
      colState: string
      colActivity: string
      stateNotStarted: string
      empty: string
      assignHeading: string
      everyone: string
      everyoneNote: string
      departments: string
      groups: string
      tracks: string
      tracksNote: string
      check: string
      notPublished: string
      nobody: string
      cancel: string
      stateProgress: (done: number, total: number) => string
      stateDone: (date: string) => string
      summary: (people: number, version: number, already: number) => string
      assignButton: (n: number) => string
      assigned: (created: number, existing: number) => string
    }
    /** Testy a banka otázok (rám TESTS). */
    tests: {
      tabsLabel: string
      tabTests: string
      tabQuestions: string
      tabResults: string
      newTest: string
      testTitle: string
      testKey: string
      create: string
      cancel: string
      statusAll: string
      statusReady: string
      statusDraft: string
      statusRetired: string
      tagReady: string
      tagDraft: string
      tagShort: string
      tagRetired: string
      colTest: string
      colSections: string
      colQuestions: string
      colPassing: string
      colResponsible: string
      colStatus: string
      edit: string
      nobody: string
      testsEmpty: string
      testsEmptyNote: string
      groupBase: string
      instructions: string
      responsibleLegend: string
      responsibleNote: string
      noResponsible: string
      groupSections: string
      sectionFilter: string
      sectionCount: string
      showInBank: string
      addQuestions: string
      addSection: string
      removeSection: string
      sectionsNote: string
      groupRules: string
      passing: string
      timeLimit: string
      maxAttempts: string
      pause: string
      showAnswers: string
      showNever: string
      showAfterSubmit: string
      showAfterPass: string
      showAfterLast: string
      emptyMeansNone: string
      testTags: string
      save: string
      statusCard: string
      checkResponsible: string
      checkSections: string
      checkRules: string
      statusNote: string
      usedIn: string
      usedNone: string
      retire: string
      restore: string
      savedReady: string
      savedDraft: string
      newQuestion: string
      importCsv: string
      exportCsv: string
      bankEmpty: string
      bankEmptyNote: string
      filterType: string
      filterStatus: string
      filterTags: string
      statusActive: string
      statusRetiredQ: string
      clearFilters: string
      colQuestion: string
      colType: string
      colWeight: string
      questionText: string
      media: string
      mediaNote: string
      removeMedia: string
      mediaAlt: string
      answers: string
      correct: string
      multipleNote: string
      trueLabel: string
      falseLabel: string
      expected: string
      alternatives: string
      shortNote: string
      explanation: string
      explanationNote: string
      weight: string
      difficulty: string
      tagsLabel: string
      tagRequiredNote: string
      saveQuestion: string
      retireQ: string
      restoreQ: string
      questionSaved: string
      answerMediaLater: string
      importHeading: string
      importNote: string
      importFile: string
      importUpload: string
      importErrorsNote: string
      colLine: string
      colColumn: string
      colProblem: string
      mediaNoteImport: string
      importExpired: string
      templateLink: string
      noResponsiblePeople: string
      keyTaken: string
      up: string
      down: string
      required: string
      optional: string
      types: { single: string; multiple: string; true_false: string; short_text: string }
      difficulties: { easy: string; medium: string; hard: string }
      sectionTitle: (n: number) => string
      enough: (n: number) => string
      short: (n: number, missing: number) => string
      usedRow: (course: string, part: string, required: boolean, version?: number) => string
      version: (n: number) => string
      answer: (n: number) => string
      usage: (tests: number, attempts: number) => string
      importSummary: (total: number, created: number, updated: number, errors: number) => string
      newTags: (list: string) => string
      importRun: (n: number) => string
      imported: (created: number, updated: number) => string
    }
    /** Pokus a výsledok testu (rámy TEST-ATTEMPT, RESULT). */
    attempt: {
      factQuestions: string
      factToPass: string
      factTime: string
      factAttempt: string
      noLimit: string
      ruleDraw: string
      ruleSave: string
      start: string
      blockedPassed: string
      backToPart: string
      saving: string
      saveFailed: string
      multipleNote: string
      shortNote: string
      videoNote: string
      trueLabel: string
      falseLabel: string
      prev: string
      next: string
      review: string
      reviewHeading: string
      unanswered: string
      answered: string
      submit: string
      confirmTitle: string
      confirmAll: string
      cancelReview: string
      timeUp: string
      submitted: string
      showResult: string
      passedNotice: string
      passedWord: string
      failedWord: string
      factPassing: string
      factRemaining: string
      factNext: string
      unlimited: string
      now: string
      retry: string
      retryNote: string
      toCourse: string
      reviewTitle: string
      detailsPurged: string
      filterAll: string
      filterWrong: string
      yourAnswer: string
      correctAnswer: string
      noAnswer: string
      hidden: string
      attemptsSide: string
      whoSees: string
      continueTest: string
      result: string
      tryAgain: string
      assignTest: string
      testRequired: string
      removeTest: string
      noReadyTests: string
      intro: string
      answerLabel: string
      multipleShort: string
      factDuration: string
      minutes: (n: number) => string
      attemptOf: (n: number, max?: number) => string
      ruleShow: { never: string; after_submit: string; after_pass: string; after_last_attempt: string }
      previous: (date: string, percent: number, passed: boolean) => string
      blockedPause: (time: string) => string
      blockedExhausted: (n: number, names: string) => string
      questionOf: (n: number, total: number) => string
      remaining: (time: string) => string
      saved: (time: string) => string
      questionHead: (n: number, total: number, weight: number) => string
      reviewUnanswered: (n: number) => string
      confirmText: (n: number, list: string) => string
      noscriptDeadline: (start: string, end: string) => string
      kicker: (title: string, n: number, max: number | undefined, date: string) => string
      partDoneNotice: (title: string) => string
      failedNotice: (missing: number, pass: number) => string
      points: (points: number, max: number) => string
      passMark: (p: number) => string
      hiddenReason: { never: string; after_submit: string; after_pass: string; after_last_attempt: string }
      wrongCount: (n: number) => string
      whoSeesText: (names: string) => string
      duration: (seconds: number) => string
      testOpen: (time: string | null, q: number, total: number) => string
      testPassedPct: (p: number) => string
      testFailedPct: (p: number) => string
      nextAttemptAt: (time: string) => string
      attemptsLeft: (remaining: number, max: number) => string
      testMeta: (questions: number, pass: number, attempts: number | undefined, names: string) => string
    }
    /** Výsledky testov (rám TESTS, ?tab=results; D121). */
    results: {
      selectTest: string
      exportCsv: string
      colPerson: string
      colContext: string
      colDate: string
      colAttempt: string
      colScore: string
      colResult: string
      openState: string
      resetState: string
      reset: string
      resetText: string
      reason: string
      resetButton: string
      empty: string
      cancel: string
      noTests: string
      show: string
      alsoResponsible: (names: string) => string
      resetTitle: (name: string) => string
      resetDone: (n: number) => string
    }
    /** Certifikát a verejné overenie (rám CERTIFICATE). */
    cert: {
      backToCertificate: string
      /** Identifikátor vydavateľa v riadku pod certifikátom. */
      registrationNumber: (n: string) => string
      kicker: string
      valid: string
      revoked: string
      number: string
      completed: string
      issuer: string
      print: string
      downloadPdf: string
      backToCourse: string
      verifyHeading: string
      verifyNote: string
      copy: string
      revokedPdf: string
      sideVerify: string
      sideVerifyText: string
      sideKeep: string
      sideKeepText: string
      notYet: string
      noCertificate: string
      show: string
      vTitle: string
      vCourse: string
      vIssuer: string
      vNameNote: string
      vNotFound: string
      vNotFoundText: string
      vSecurity: string
      vFooter: string
      pdfTitle: string
      pdfSub: string
      pdfVerify: string
      signature: string
      colCertificate: string
      revoke: string
      revokeText: string
      revokeReason: string
      revokeButton: string
      revokedMsg: string
      cancel: string
      printNote: string
      completedCourse: (title: string, version: number, gender?: string) => string
      revokedNotice: (date: string, reason: string) => string
      vValid: (issuer: string) => string
      vRevoked: (date: string) => string
      pdfConfirms: (org: string) => string
      pdfCompleted: (title: string, gender?: string) => string
      pdfMeta: (version: number, parts: number, tests: number, date: string) => string
      issuedOn: (date: string) => string
      revokeTitle: (name: string) => string
    }
  }
}

/**
 * Dni s číslovkou.
 *
 * Slovenčina aj čeština majú tri tvary (1 / 2–4 / 5+). Bez toho vznikne
 * „nepotvrdené dlhšie než 1 dní" — chyba, ktorú v kóde nikto nevidí a ktorú
 * si na obrazovke všimne každý. `Intl.PluralRules` by tvar vybralo, ale text
 * by aj tak musel byť napísaný trikrát; pribudla by závislosť bez úspory.
 */
/**
 * „absolvoval" / „absolvovala" podľa pohlavia osoby (`persons.gender`);
 * nevyplnené = „absolvoval(a)" (Ján 27. 9. 2026). V slovenčine aj češtine
 * je tvar rovnaký.
 */
const completedVerb = (s?: string) => (s === "male" ? "absolvoval" : s === "female" ? "absolvovala" : "absolvoval(a)")

/**
 * Minulý čas slovesa v prvej osobe podľa rodu (D152): „oboznámil" /
 * „oboznámila", nevyplnené „oboznámil(a)". Pre formulku potvrdenia; slovenčina
 * aj čeština tvoria ženský tvar pridaním „-a".
 */
const byGender = (verb: string, g?: string) => (g === "male" ? verb : g === "female" ? `${verb}a` : `${verb}(a)`)

const daysSk = (n: number) => (n === 1 ? "1 deň" : n >= 2 && n <= 4 ? `${n} dni` : `${n} dní`)
const daysCs = (n: number) => (n === 1 ? "1 den" : n >= 2 && n <= 4 ? `${n} dny` : `${n} dní`)
const daysEn = (n: number) => (n === 1 ? "1 day" : `${n} days`)

export const DICTIONARY: Record<UiLanguage, Dictionary> = {
  sk: {
  common: {
    saveBarNote: "Uloží všetky sekcie na tejto stránke.",
    moreActions: "Ďalšie akcie",
    domainsPlaceholder: "organizacia.sk\nmarketing.organizacia.sk",
    noticeConfirm: "Rozumiem",
    empty: {
      filtered: "Filtru nič nevyhovuje",
      none: "Zatiaľ tu nič nie je",
      clearFilters: "Zrušiť filtre",
    },
    pdf: {
      loading: "Načítavam PDF…",
      failed: "PDF sa nepodarilo zobraziť priamo na stránke. Otvor ho odkazom vyššie.",
      page: "Strana {page} z {pages}",
    },
    pending: {
      adding: "Pridávam…",
      sending: "Posielam e-maily…",
    },
  },
  onboarding: {
    openPdf: "Otvoriť PDF",
    listHeading: "Dokumenty na potvrdenie",
    listIntro: "Prečítajte si každý dokument a potvrďte, že ste sa s ním oboznámili. Potvrdenie sa viaže na konkrétne znenie — pri novej verzii vás systém požiada znova.",
    emptyTitle: "Nemáte nič na potvrdenie",
    emptyText: "Keď vám niekto pridelí normu alebo vás zaradí do trasy, objaví sa tu aj s termínom. Nič od vás teraz nikto nečaká.",
    assignedHeading: "Pridelené dokumenty",
    progress: (done, total) => `Hotové ${done} z ${total}`,
    step: (order, total) => `Krok ${order} z ${total}`,
    continueHere: "pokračujte tu",
    trackComplete: "trasa je hotová",
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
    version: (_label, from) => `znenie účinné od ${from}`,
    readingElapsed: t => `Čas čítania: ${t}`,
    readingNote: "Zaznamenáva sa, je informatívny a nie je súčasťou potvrdenia.",
    readingSeconds: n => `${n} s`,
    readingMinutes: n => (n === 1 ? "1 minúta" : n >= 2 && n <= 4 ? `${n} minúty` : `${n} minút`),
    confirmHeading: "Potvrdenie oboznámenia",
    confirmButton: "Potvrdzujem",
    confirmPending: "Ukladá sa…",
    confirmed: "Potvrdené. Ďakujeme.",
    confirmedAt: (when) => `Potvrdili ste ${when}.`,
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
      version: label => `${label}`,
      waitingSince: d => `čaká od ${d}`,
      dueBy: d => `do ${d}`,
      dueToday: "termín dnes",
      dueOver: n => `po termíne ${n === 1 ? "o deň" : n < 5 ? `o ${n} dni` : `o ${n} dní`}`,
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
    statement: (title, effectiveFrom, gender) =>
      `Potvrdzujem, že som sa ${byGender("oboznámil", gender)} s dokumentom „${title}" v znení účinnom od ${effectiveFrom}, ` +
      `${byGender("porozumel", gender)} som jeho obsahu a zaväzujem sa ho dodržiavať.`,
    email: {
      subject: org => `Prihlásenie — ${org}`,
      heading: org => `Prihlásenie — ${org}`,
      intro: "Kliknutím sa prihlásite.",
      button: "Prihlásiť sa",
      validity: "Odkaz platí 24 hodín a dá sa použiť raz. Ak ste o prihlásenie nežiadali, tento e-mail ignorujte — bez kliknutia sa nič nestane.",
      fallbackNote: "Ak odkaz nefunguje, skopírujte do prehliadača:",
      subtitle: "Interný portál",
    },
    reminderEmail: {
      subject: organisation => `Pripomienka: nepotvrdené dokumenty — ${organisation}`,
      subtitle: "Pripomienka",
      intro: count => count === 1
        ? "Jeden dokument stále čaká na vaše potvrdenie."
        : count >= 2 && count <= 4
          ? `${count} dokumenty stále čakajú na vaše potvrdenie.`
          : `${count} dokumentov stále čaká na vaše potvrdenie.`,
      itemLine: (label, days) => `${label}, čaká ${daysSk(days)}`,
      effectiveLine: date => `znenie účinné od ${date}`,
      button: "Otvoriť zoznam",
      note: "Potvrdenie sa viaže na konkrétne znenie a zaberie pár minút. Ak si myslíte, že sa vás dokument netýka, ozvite sa personálnemu oddeleniu.",
      noticeSubject: organisation => `Na potvrdenie: dokumenty — ${organisation}`,
      noticeSubtitle: "Na potvrdenie",
      noticeIntro: count => count === 1
        ? "Jeden dokument čaká na vaše potvrdenie."
        : count >= 2 && count <= 4
          ? `${count} dokumenty čakajú na vaše potvrdenie.`
          : `${count} dokumentov čaká na vaše potvrdenie.`,
      noticeItemLine: label => `${label}`,
    },

    inviteEmail: {
      subject: organisation => `Pozvánka — ${organisation}`,
      subtitle: "Pozvánka",
      intro: (legal, portal) => `${legal === portal ? `${legal} vás pozýva do svojho interného portálu.` : `${legal} vás pozýva do ${portal}.`} Nájdete v ňom dokumenty a úlohy, ktoré sa vás týkajú.`,
      how: "Prihlasujete sa pracovnou e-mailovou adresou, na ktorú prišla táto pozvánka. Po otvorení portálu sa prihlásite pracovným kontom alebo si necháte poslať prihlasovací odkaz.",
      button: "Otvoriť portál",
      note: "Ak sa prihlásiť nedá, ozvite sa personálnemu oddeleniu.",
      privacy: "Ako sa v portáli spracúvajú vaše osobné údaje, prečo, ako dlho a aké máte práva:",
      privacyLink: "Ochrana osobných údajov",
    },

    dueReminderEmail: {
      subjectSoon: org => `Blíži sa termín potvrdenia \u2014 ${org}`,
      subjectOver: org => `Ste po termíne potvrdenia \u2014 ${org}`,
      subtitleSoon: "Blíži sa termín",
      subtitleOver: "Po termíne",
      introSoon: "Toto vás čaká a termín sa blíži:",
      introOver: "Toto vás čaká a termín už uplynul:",
      soonLine: (due, daysLeft) =>
        daysLeft === 0 ? `termín je dnes, ${due}`
        : `termín je ${due}, ${daysLeft === 1 ? "zostáva deň" : daysLeft <= 4 ? `zostávajú ${daysLeft} dni` : `zostáva ${daysLeft} dní`}`,
      overLine: (due, daysOver) =>
        `termín bol ${due}, ${daysOver === 1 ? "ste po ňom deň" : daysOver <= 4 ? `ste po ňom ${daysOver} dni` : `ste po ňom ${daysOver} dní`}`,
      button: "Otvoriť a potvrdiť",
      note: "Potvrdenie je krátke \u2014 dokument si prečítate a kliknete. Keď ste to už spravili, tento e-mail nabudúce nepríde.",
    },
    privacy: {
      tocHeading: "Obsah",
      objectionHeading: "Právo namietať",
      title: "Ochrana osobných údajov",
      lead: "Čo sa o vás v tomto systéme ukladá, prečo a ako dlho.",
      controllerHeading: "Kto je prevádzkovateľ",
      controller: org => `Vaše osobné údaje spracúva ${org}. Systém Contineo pre neho prevádzkuje dodávateľ ako sprostredkovateľ na základe zmluvy o spracúvaní osobných údajov.`,
      controllerDetails: (address, reg) => [address, reg && `IČO ${reg}`].filter(Boolean).join(" · "),
      dpoHeading: "Zodpovedná osoba (DPO)",
      dpoMissing: "Kontakt na zodpovednú osobu vám poskytne personálne oddelenie.",
      purposeHeading: "Na čo systém slúži",
      purpose: "Organizácia v ňom zverejňuje záväzné predpisy a interné smernice a eviduje, kto sa s nimi oboznámil. Systém odpovedá aj na otázky k obsahu predpisov.",
      dataHeading: "Aké údaje a prečo",
      dataColumns: ["Údaj", "Prečo"],
      data: [
        ["meno, e-mail, pracovná pozícia, oddelenie, typ vzťahu", "aby vám mohli byť pridelené predpisy, ktoré sa vás týkajú, a aby ste sa mohli prihlásiť"],
        ["pridelenie predpisu: kto, prečo a dokedy", "doklad o tom, že ste mali povinnosť sa s predpisom oboznámiť"],
        ["prvé otvorenie znenia predpisu", "doklad, že vám bolo znenie sprístupnené; ukladá sa jeden záznam na znenie, nie každé zobrazenie"],
        ["potvrdenie: čas, znenie predpisu, doslovný text potvrdenia, IP adresa, údaj o prehliadači", "doklad o oboznámení s predpisom"],
        ["čas strávený nad znením", "informatívny údaj pre personalistu, nie doklad; nič sa podľa neho nevyhodnocuje"],
        ["pripomienky: komu a kedy sa odoslali", "aby vám rovnaká pripomienka neprišla dvakrát"],
        ["otázky, ktoré systému položíte, a jeho odpovede", "aby sa dala preveriť správnosť odpovedí a aby ste v histórii našli svoje staršie otázky"],
        ["mobilný telefón, pracovisko a fotografia, ak ich vyplníte", "interný adresár; vyplniť ich nemusíte"],
        ["pohlavie, ak ho vyplní personalista", "štatistika zloženia organizácie (napríklad podiel žien a mužov) a správny tvar textov o vás, napríklad „absolvoval / absolvovala“; z mena sa neodvodzuje a vyplniť ho nemusíte"],
        ["použitie umelej inteligencie: kto, kedy, na čo, model, počet tokenov a odhad ceny — bez znenia otázky", "prehľad nákladov na umelú inteligenciu pre správcu organizácie"],
      ],
      hrNote: "Personalista vidí pri každom človeku, či predpis otvoril, či ho potvrdil a koľko času nad ním strávil. Stav „otvoril a nepotvrdil“ je sledovaný stav; personalista vás podľa neho môže upozorniť, že potvrdenie chýba.",
      responsibleNote: "Pri každom predpise je uvedená zodpovedná osoba (meno a e-mail), na ktorú sa môžete obrátiť s otázkou k predpisu.",
      basisHeading: "Právny základ",
      basisIntro: "Určuje sa pri každom predpise zvlášť a vidíte ho pri ňom:",
      basisObligation: "plnenie zákonnej povinnosti (čl. 6 ods. 1 písm. c) GDPR) pri predpisoch, ktorých oboznámenie vyžaduje zákon, napríklad bezpečnosť a ochrana zdravia pri práci; pri predpise je uvedený konkrétny zákon;",
      basisInterest: "oprávnený záujem (čl. 6 ods. 1 písm. f) GDPR) pri interných smerniciach — záujmom je preukázať, že s pravidlami boli oboznámení tí, ktorých sa týkajú.",
      basisDirectory: "Údaje v adresári (mobil, pracovisko, fotografia) sa spracúvajú na základe oprávneného záujmu na vnútornej komunikácii. Pohlavie sa spracúva na základe oprávneného záujmu na štatistike zloženia organizácie a na správnych textoch; nie je povinné. Záznam o použití umelej inteligencie sa spracúva na základe oprávneného záujmu na kontrole nákladov.",
      retentionHeading: "Ako dlho",
      retentionColumns: ["Údaj", "Lehota"],
      retention: [
        ["potvrdenie, pridelenie, otvorenie znenia", "{evidence} od skončenia pracovného pomeru alebo vzťahu s organizáciou; ak dátum skončenia nie je známy, od vyradenia zo systému; najdlhšie {cap} od poslednej udalosti, ak nie je známy ani jeden dátum"],
        ["schválenie predpisu a zodpovedná osoba", "kým existuje aspoň jeden doklad o oboznámení s daným znením"],
        ["čas strávený nad znením", "12 mesiacov"],
        ["otázky, ktoré systému položíte, a jeho odpovede", "{answers}; odstránenie z histórie ich skryje len vo vašom zozname"],
        ["pripomienky", "90 dní"],
        ["záznam o prístupoch a zmenách (audit)", "24 mesiacov"],
        ["pohlavie", "spolu s ostatnými údajmi vo vašom zázname v zozname osôb"],
        ["záznam o použití umelej inteligencie", "25 mesiacov"],
      ],
      years: n => (n === 1 ? "1 rok" : n >= 2 && n <= 4 ? `${n} roky` : `${n} rokov`),
      months: n => (n === 1 ? "1 mesiac" : n >= 2 && n <= 4 ? `${n} mesiace` : `${n} mesiacov`),
      retentionDelete: "Po uplynutí lehoty sa záznam zmaže celý, neanonymizuje sa.",
      recipientsHeading: "Komu sa údaje dostanú",
      recipients: "Personalistom a správcom obsahu organizácie v rozsahu ich úlohy, kolegom len údaje z adresára. Mimo organizácie sprostredkovateľom, ktorí zabezpečujú prevádzku:",
      processorsColumns: ["Kto", "Na čo", "Kde"],
      processors: {
        atlas: ["MongoDB Atlas", "databáza a vyhľadávanie", "EÚ (Frankfurt)"],
        vercel: ["Vercel", "beh aplikácie", "EÚ"],
        anthropic: ["Anthropic", "tvorba odpovedí na otázky; bez uchovávania a bez trénovania na dátach", "podľa zmluvy so sprostredkovateľom"],
        bedrock: ["Amazon Web Services (Bedrock)", "tvorba odpovedí na otázky; bez uchovávania a bez trénovania na dátach", "región {region}"],
        voyage: ["Voyage AI (cez MongoDB)", "vyhľadávanie v texte predpisov", "podľa zmluvy so sprostredkovateľom"],
        ecomail: ["Ecomail", "odosielanie e-mailov", "EÚ"],
      },
      noSale: "Údaje sa nepredávajú a nepoužívajú sa na reklamu ani na trénovanie modelov umelej inteligencie.",
      automated: "O nikom sa nerozhoduje automatizovane.",
      learning: {
        purpose: "Organizácia v ňom vedie aj kurzy a testy a vydáva certifikáty o ich absolvovaní.",
        data: [
          ["zápis do kurzu: kedy a kto vás zapísal", "aby ste mali prístup ku kurzu, ktorý sa vás týka"],
          ["dokončenie častí kurzu a to, ktoré úseky videa ste pozreli", "doklad, že ste kurz prešli; pri povinnom videu aj to, že ste ho dopozerali"],
          ["pokusy v teste: otázky, vaše odpovede, body, výsledok a čas", "vyhodnotenie testu"],
          ["certifikát: meno, pohlavie (kvôli tvaru textu), kurz, číslo, dátumy, vydavateľ, podpisujúci", "doklad o absolvovaní kurzu, ktorý si môžete stiahnuť a ktorý sa dá overiť"],
        ],
        basis: archiveLaw => `Pri kurzoch platí to isté ako pri predpisoch: zákonná povinnosť pri školeniach, ktoré vyžaduje zákon (napríklad bezpečnosť a ochrana zdravia pri práci), inak oprávnený záujem preukázať, že ľudia boli vyškolení. Certifikát sa uchováva aj na účely archivácie podľa ${archiveLaw}.`,
        retention: [
          ["zápis do kurzu, dokončenie častí, sledovanie videa, pokusy v teste", "rovnako ako potvrdenie predpisu (prvý riadok tabuľky)"],
          ["vaše odpovede v teste a pozreté úseky videa", "{months} po dokončení kurzu; výsledok testu a dokončenie zostávajú"],
          ["certifikát", "nemaže sa — vydaný certifikát platí a uchováva sa podľa registratúrneho plánu organizácie; môže byť len odvolaný"],
        ],
        retentionNote: "Výnimkou je certifikát — ten sa nemaže.",
        recipients: "Výsledky testov vidí len zodpovedná osoba za test, nie personalista. Certifikát overí ktokoľvek, komu dáte jeho odkaz alebo QR kód; overenie ukáže číslo, kurz, dátum a vydavateľa, nie vaše meno.",
        automated: "Test vyhodnocuje systém automaticky podľa vopred určených správnych odpovedí. Ak s výsledkom nesúhlasíte, obráťte sa na zodpovednú osobu za test — výsledok preverí a pokus môže zrušiť, aby ste ho mohli zopakovať. O nič iné sa automatizovane nerozhoduje.",
        rights: "Výmaz vydaného certifikátu nie je možný — uchováva sa na účely archivácie a ako doklad, ktorý môžete potrebovať aj vy.",
      },
      rightsHeading: "Vaše práva",
      rights: "Máte právo na prístup k svojim údajom, ich opravu, obmedzenie spracúvania a prenosnosť.",
      objection: "Pri predpisoch s oprávneným záujmom máte právo namietať. Námietku posúdi zodpovedná osoba jednotlivo a doklad sa do jej rozhodnutia nemaže. Výmaz dokladu o oboznámení pred uplynutím lehoty nie je možný, kým je potrebný na preukázanie, uplatnenie alebo obhajobu právnych nárokov.",
      objectionEmail: "Námietku pošlite e-mailom na",
      objectionFormLabel: "Vaša námietka",
      objectionFormHint: "Napíšte, proti čomu namietate a prečo. Námietku posúdi zodpovedná osoba; potvrdenie vám príde e-mailom.",
      objectionSubmit: "Podať námietku",
      objectionSent: "Námietka je podaná. Potvrdenie sme vám poslali e-mailom.",
      objectionPending: date => `Vašu námietku z ${date} zodpovedná osoba posudzuje. Ďalšiu môžete podať, keď o nej rozhodne.`,
      objectionSignIn: "Po prihlásení ju môžete podať aj priamo tu.",
      objectionSignInLink: "Prihlásiť sa",
      complaint: {
        SK: "Máte právo podať sťažnosť Úradu na ochranu osobných údajov SR (dataprotection.gov.sk).",
        CZ: "Máte právo podať sťažnosť Úradu pre ochranu osobných údajov ČR (uoou.gov.cz).",
      },
      archiveLaw: {
        SK: "zákona č. 395/2002 Z. z. o archívoch a registratúrach",
        CZ: "zákona č. 499/2004 Sb. o archívnictve a spisovej službe",
      },
      requests: "Žiadosti posielajte zodpovednej osobe (DPO).",
      version: date => `Verzia textu: ${date}`,
      linkBefore: "Čo sa pri potvrdení ukladá a ako dlho: ",
      link: "Ochrana osobných údajov",
      extraHeading: "Doplnenie prevádzkovateľa",
    },
    versionMeta: {
      heading: "Údaje o znení",
      intro: "Autor, kto znenie schválil a dátumy. Sú súčasťou schválenia — schvaľovateľ ich vidí pri PDF a po predložení sa už meniť nedajú.",
      author: "Autor",
      authorHint: "Osoba, oddelenie alebo komisia, ktorá dokument pripravila.",
      approvedBy: "Schválil",
      approvedByHint: "Osoba alebo orgán, napríklad Výkonný výbor SFZ.",
      approvedOn: "Dátum schválenia",
      effectiveFrom: "Dátum účinnosti",
      effectiveFromHint: "Povinný pred predložením na schválenie. Je aj v potvrdzovacej formulke; pri zverejnení sa už nezadáva.",
      save: "Uložiť údaje",
      locked: "Koncept je na schválení alebo schválený — údaje sa už meniť nedajú. Zmena je možná len novým znením.",
      voidsApproval: "Koncept bol schválený ešte bez údajov o znení. Ich uložením schválenie prestane platiť a koncept treba predložiť znova — schvaľovatelia tak schvália aj tieto údaje.",
      suggested: "Predvyplnené z prvej strany dokumentu — skontroluj a ulož. Kým ich neuložíš, nie sú súčasťou znenia.",
      missing: "Údaje o znení zatiaľ nie sú uložené. Bez dátumu účinnosti sa koncept nedá predložiť na schválenie.",
      uploadHeading: "Údaje o znení",
      uploadNote: "Nepovinné už tu — ak ich nevyplníš, predvyplnia sa z prvej strany dokumentu a potvrdíš ich na detaile.",
      fromMeta: date => `Dátum účinnosti ${date} — zo schválených údajov o znení.`,
    },
    objectionEmail: {
      noticeSubject: org => `Nová námietka \u2014 ${org}`,
      noticeSubtitle: "Námietka (čl. 21 GDPR)",
      noticeIntro: (person, date) => `${person} podal(a) ${date} v aplikácii námietku proti spracúvaniu osobných údajov.`,
      noticeButton: "Otvoriť námietky",
      noticeNote: "Znenie námietky je po prihlásení na stránke DPO, v e-maile nie je. Do rozhodnutia sa nič nemaže.",
      receiptSubject: org => `Potvrdenie námietky \u2014 ${org}`,
      receiptSubtitle: "Potvrdenie",
      receiptIntro: date => `Vašu námietku proti spracúvaniu osobných údajov sme prijali ${date}. Takto znie:`,
      receiptNote: "Námietku posúdi zodpovedná osoba (DPO). Do jej rozhodnutia sa vaše doklady nemažú.",
      receiptContact: email => `Námietku posúdi zodpovedná osoba (DPO). Do jej rozhodnutia sa vaše doklady nemažú. Otázky posielajte na ${email}.`,
    },
    dpoEmail: {
      subject: (org, quarter) => `Výkaz právnych základov ${quarter} \u2014 ${org}`,
      subtitle: "Štvrťročná kontrola",
      intro: quarter => `Štvrťročný prehľad právnych základov platných predpisov (${quarter}):`,
      total: n => `platných predpisov: ${n}`,
      legalObligation: n => `zákonná povinnosť: ${n}`,
      legitimateInterest: n => `oprávnený záujem: ${n}`,
      withProblems: n => `s nedostatkom: ${n}`,
      button: "Otvoriť výkaz",
      note: "Právny základ určuje zodpovedná osoba za predpis; vy ho kontrolujete (O15/A10). Zoznam predpisov je vo výkaze po prihlásení, v e-maile sú len počty.",
    },
    approvalEmail: {
      subject: org => `Znenie na schválenie \u2014 ${org}`,
      subtitle: "Na schválenie",
      intro: who => `${who} predložil znenie a čaká na vaše rozhodnutie:`,
      noteLabel: "Čo sa v znení mení",
      versionLine: (_label, effectiveFrom) => `znenie účinné od ${effectiveFrom}`,
      button: "Prečítať a rozhodnúť",
      note: "Rozhodujete sami za seba \u2014 ostatní schvaľovatelia rozhodujú nezávisle. Pri zamietnutí je dôvod povinný, aby predkladateľ vedel, čo opraviť.",
    },
    assignmentEmail: {
      subject: org => `Nový dokument na potvrdenie — ${org}`,
      subtitle: "Na potvrdenie",
      intro: "Do vášho zoznamu pribudol dokument, s ktorým sa máte oboznámiť:",
      reasonLabel: "Dôvod",
      versionLine: (_label, effectiveFrom) => `znenie účinné od ${effectiveFrom}`,
      button: "Otvoriť a potvrdiť",
      note: "Dokument nájdete aj po prihlásení v zozname na úvodnej strane. Kým ho nepotvrdíte, zostane vám tam.",
    },
  myAcknowledgements: {
    heading: "Moje potvrdenia",
    intro: "Čo o vás systém eviduje: ktoré znenia ste potvrdili, kedy a pod akým textom. Vidíte len seba a môžete si to stiahnuť.",
    nothing: "Zatiaľ nemáte žiadne potvrdenie.",
    download: "Stiahnuť ako CSV",
    count: n => (n === 1 ? "1 záznam" : n <= 4 ? `${n} záznamy` : `${n} záznamov`),
    acknowledged: "potvrdené",
    revoked: "odvolané",
    versionLine: (_label, effectiveFrom) => `znenie účinné od ${effectiveFrom}`,
    whenLine: when => `potvrdené ${when}`,
    revokedWhenLine: when => `odvolané ${when}`,
    revokedStatement: "Znenie, pod ktorým bolo potvrdenie pôvodne dané:",
    viaTrack: track => `z trasy ${track}`,
    reason: text => `Dôvod: ${text}`,
    footnoteBefore: "Ako celý postup funguje, je v ",
    footnoteGuide: "Návode",
    footnoteAfter: ". Ak vám tu niečo nesedí, ozvite sa personalistovi — záznam sa neupravuje, odvoláva sa a potvrdzuje nanovo.",
    csv: {
      type: "Typ", document: "Dokument", version: "Verzia", effectiveFrom: "Platná od",
      acknowledgedAt: "Potvrdené", track: "Trasa", statement: "Znenie formulky",
      reason: "Dôvod", ip: "IP adresa", browser: "Prehliadač",
    },
  },
  guide: {
    heading: "Návod",
    intro: "Ako sa dokument dostane do systému a čo sa s ním po ceste stane — od nahratia po inteligentné vyhľadávanie.",
    onlySlovak: "Text návodu je zatiaľ len po slovensky.",
  },
  directory: {
    heading: "Adresár",
    intro: "Kolegovia vo vašej organizácii — pozícia, pracovisko a kontakt. Vyradení ľudia tu nie sú.",
    searchPlaceholder: "Meno, pozícia, oddelenie alebo pracovisko…",
    nothingFound: "Nikto nezodpovedá hľadaniu.",
    count: n => (n === 1 ? "1 osoba" : n <= 4 ? `${n} osoby` : `${n} osôb`),
  },
  dpo: {
    heading: "Ochrana údajov",
    intro: "Právne základy platných predpisov. Určuje ich zodpovedná osoba za predpis, vy ich kontrolujete — raz za štvrťrok vám príde prehľad e-mailom.",
    reportHeading: "Právne základy platných predpisov",
    csv: "Stiahnuť CSV",
    empty: "Organizácia zatiaľ nemá platný predpis.",
    summary: (total, problems) => `${total} platných predpisov, z toho ${problems} s nedostatkom.`,
    basis: "Právny základ",
    reference: "Predpis",
    responsible: "Zodpovedná osoba",
    version: "Znenie",
    none: "—",
    ok: "v poriadku",
    problems: {
      noBasis: "chýba právny základ",
      outsideCodelist: "základ mimo číselníka",
      noReference: "zákonná povinnosť bez odkazu na zákon",
      noResponsible: "chýba zodpovedná osoba",
      inactiveResponsible: "zodpovedná osoba je vyradená",
    },
    objectionsHeading: "Námietky (čl. 21)",
    objectionsIntro: "Pri predpisoch s oprávneným záujmom môže človek namietať. Námietku zaevidujete tu a rozhodnete o nej; do rozhodnutia sa nič nemaže. Pri vyhovení sa zmažú jeho doklady pri zneniach s oprávneným záujmom — pri zákonnej povinnosti zostanú.",
    recordHeading: "Zaevidovať námietku",
    personEmail: "E-mail osoby",
    personEmailNote: "Aj predošlá adresa — námietka často príde z adresy, ktorú človek používal vo zväze.",
    receivedAt: "Doručená",
    channel: "Ako prišla",
    channels: { email: "e-mailom", letter: "listom", "in-person": "osobne", other: "inak", app: "v aplikácii" },
    objectionText: "Znenie námietky",
    objectionTextNote: "Ako prišla — bez vlastného výkladu.",
    recordSubmit: "Zaevidovať",
    noObjections: "Zatiaľ žiadna námietka.",
    retention: {
      heading: "Lehoty uchovávania",
      intro: "Tieto lehoty používa denná mazacia dávka a presne tieto čísla sú aj na stránke Ochrana osobných údajov.",
      evidenceYears: "Roky od skončenia vzťahu",
      evidenceYearsNote: "Potvrdenia, pridelenia, otvorenia znenia a záznamy vzdelávania. Keď dátum skončenia nie je známy, plynú od vyradenia.",
      capYears: "Strop v rokoch od poslednej udalosti",
      capYearsNote: "Pre vyradenú osobu, pri ktorej nie je známy ani jeden dátum. Nesmie byť kratší než lehota vyššie.",
      learningDetailMonths: "Mesiace po dokončení kurzu",
      learningDetailMonthsNote: "Potom sa z testov zmažú odpovede a zo sledovania videa pozreté úseky. Výsledok a dokončenie zostávajú.",
      answersMonths: "Mesiace pre otázky a odpovede",
      answersMonthsNote: "Potom sa otázky, odpovede a ich hodnotenie zmažú. Záznamy, z ktorých vznikla overená odpoveď, ostanú bez mena toho, kto sa pýtal.",
      fixed: "Pevné pre celú platformu (riadi ich databáza): čas strávený nad znením 12 mesiacov, pripomienky 90 dní, audit 24 mesiacov, spotreba umelej inteligencie 25 mesiacov. Certifikáty sa nemažú.",
      warning: "Skrátenie lehoty môže pri zapnutom ostrom mazaní zmazať záznamy hneď v najbližšej nočnej dávke.",
      save: "Uložiť lehoty",
      saved: "Lehoty uložené.",
    },
    extra: {
      heading: "Doplnenie na stránku Ochrana osobných údajov",
      intro: "Vlastný odsek, ktorý sa zobrazí pod spoločným textom — napríklad ďalší účel alebo kontakt. Základný text sa tým nemení. Prázdne pole = nič sa nezobrazí.",
      label: language => `Text — ${language}`,
      save: "Uložiť doplnenie",
      saved: "Doplnenie uložené.",
    },
    status: { pending: "čaká na rozhodnutie", upheld: "vyhovené", rejected: "zamietnuté" },
    receivedLine: (date, channel) => `doručená ${date} · ${channel}`,
    recordedLine: (who, date) => `zaevidoval(a) ${who}, ${date}`,
    decideHeading: "Rozhodnutie",
    upheld: "Vyhovieť — zmazať doklady pri oprávnenom záujme",
    rejected: "Zamietnuť — prevažujú závažné oprávnené dôvody alebo právne nároky",
    decisionNote: "Odôvodnenie",
    upheldWarning: "Vyhovenie zmaže doklady natrvalo, hneď po odoslaní.",
    decideSubmit: "Rozhodnúť",
    decidedLine: (who, date) => `rozhodol(a) ${who}, ${date}`,
    deletedLine: (acks, unknown) => `zmazaných potvrdení: ${acks}` + (unknown ? ` · ${unknown} potvrdení bez zapísaného právneho základu zostalo — posúďte ich ručne` : ""),
    objectionRecorded: "Námietka zaevidovaná.",
    settingsMoved: "Lehoty uchovávania, doplnok na stránku Ochrana osobných údajov a kontakt GDPR sú v nastaveniach organizácie.",
    settingsLink: "Otvoriť záložku GDPR",
    objectionUpheld: "Námietke vyhovené, doklady pri oprávnenom záujme sú zmazané.",
    objectionRejected: "Námietka zamietnutá.",
    searchPlaceholder: "Hľadať predpis — názov, základ, zákon, osoba",
    searchSubmit: "Hľadať",
    filterState: "Stav",
    filterBasis: "Právny základ",
    filterPerson: "Zodpovedná osoba",
    filterAll: "Všetky",
    stateProblems: "S nedostatkom",
    stateOk: "V poriadku",
    basisObligation: "Zákonná povinnosť",
    basisInterest: "Oprávnený záujem",
    basisNone: "Bez základu",
    chipSearch: "hľadanie",
    removeFilter: label => `Zrušiť filter ${label}`,
    shownOf: (shown, total) => `${shown} z ${total} predpisov`,
    groupBy: "Zoskupiť",
    groupState: "Podľa stavu",
    groupPerson: "Podľa osoby",
    noPerson: "Bez zodpovednej osoby",
    writeEmail: n => `Napísať e-mail · ${n}`,
    mailSubject: "Právny základ predpisov — chýbajúce údaje",
    mailBody: list => `Dobrý deň,\n\npri týchto predpisoch, za ktoré zodpovedáte, chýba alebo nesedí právny základ:\n\n${list}\n\nDoplňte ho, prosím, na karte dokumentu v správe knižnice.\n\nĎakujem`,
    mailBodyLink: (n, url) => `Dobrý deň,\n\npri ${n} predpisoch, za ktoré zodpovedáte, chýba alebo nesedí právny základ. Zoznam: ${url}\n\nDoplňte ho, prosím, na karte dokumentu v správe knižnice.\n\nĎakujem`,
    groupPersonMeta: (total, bad) => `${total} ${total === 1 ? "predpis" : total >= 2 && total <= 4 ? "predpisy" : "predpisov"}, ${bad} s nedostatkom`,
    pendingBanner: n => n === 1 ? "1 námietka čaká na rozhodnutie" : n <= 4 ? `${n} námietky čakajú na rozhodnutie` : `${n} námietok čaká na rozhodnutie`,
    pendingBannerMeta: (name, date) => `${name} · doručená ${date} · do rozhodnutia sa nič nemaže`,
    pendingDecide: "Rozhodnúť",
    noMatch: "Hľadaniu nič nevyhovuje",
    noMatchText: "Výkaz obsahuje len platné znenia. Archívne a pripravované nájdete v",
    noMatchLibrary: "knižnici",
    clearSearch: "Zrušiť hľadanie",
    clearAll: "Zrušiť všetko",
    decidedToggle: n => `Rozhodnuté námietky (${n}) · zobraziť`,
    groupProblems: n => `S nedostatkom · ${n}`,
    groupOk: n => `V poriadku · ${n}`,
    colDocument: "Predpis",
    colStatus: "Stav",
    pendingCount: n => `${n} čaká na rozhodnutie`,
    recordOpen: "+ Zaevidovať námietku",
  },
  nav: {
    ask: "Voľné otázky",
    toApprove: "Na schválenie",
    evidence: "Reťaz dôkazov",
    overview: "Prehľad",
    loading: "Načítava sa…",
    sections: "Sekcie",
    tasks: "Úlohy",
    more: "Viac",
    groupOrganisation: "Organizácia",
    groupManagement: "Správa",
    groupMain: "Hlavné",
    breadcrumb: "Cesta",
    menu: "Menu",
    skipToContent: "Preskočiť na obsah",
    allSections: "Všetky sekcie",
    escCloses: "zavrie",
    sheetHint: "Všetky sekcie s popisom sú na Prehľade",
    desc: {
      toAcknowledge: "Normy, ktoré máte prečítať a potvrdiť",
      toApprove: "Znenia, o ktorých máte rozhodnúť",
      directory: "Kontakty, oddelenia a kto za čo zodpovedá",
      library: "Platné normy a ich znenia",
      learning: "Moje kurzy, testy a certifikáty",
      assigned: "Kto čo potvrdil, pridelenie normy",
      evidence: "Záznamy o potvrdeniach pre audit",
      people: "Zamestnanci, pracovné vzťahy, roly",
      evaluation: "Odpovede, pri ktorých niekto povedal, že nesedia",
      dpo: "Právne základy predpisov a námietky",
      channels: "Widget a portál; tickety kanálov, ktorých si riešiteľom",
      learningManage: "Kurzy, časti a pridelenie",
      learningTests: "Banka otázok a výsledky pokusov",
    },
    waiting: n => (n === 1 ? "čaká 1" : n <= 4 ? `čakajú ${n}` : `čaká ${n}`),
    toAcknowledge: "Na potvrdenie",
    assigned: "Pridelené dokumenty",
    evaluation: "Na posúdenie",
    dpo: "Ochrana údajov",
    channels: "Kanály",
    learning: "Vzdelávanie",
    learningManage: "Správa kurzov",
    learningTests: "Testy",
    people: "Osoby",
    directory: "Adresár",
    library: "Knižnica",
    organisation: "Nastavenie organizácie",
    tenants: "Správa tenantov",
    openMenu: "Otvoriť menu",
    closeMenu: "Zavrieť menu",
    searchPlaceholder: "Opýtajte sa svojich dokumentov…",
    searchLabel: "Opýtať sa svojich dokumentov",
    searchSubmit: "Opýtať sa",
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

  versionNotice: {
    text: "Je dostupná nová verzia portálu. Obnovením stránky prejdete na ňu.",
    reload: "Obnoviť",
  },

  notFound: {
    heading: "Stránka sa nenašla",
    intro: "Adresa neexistuje alebo už neplatí.",
    home: "Na úvodnú stranu",
  },

  home: {
    metaTitle: "Contineo",
    metaDescription: "Overovanie kvality odpovedí nad normami a smernicami.",
  },

  signIn: {
    emailPlaceholder: "meno@organizacia.sk",
    or: "alebo",
    heading: "Prihlásenie",
    intro: "Zadajte e-mail, na ktorý ste dostali pozvánku. Pošleme vám odkaz — heslo si pamätať nemusíte.",
    noScript: "Prihlásenie potrebuje JavaScript — bez neho sa nedá odoslať ani odkaz na e-mail, ani prihlásenie firemným kontom. Zapnite ho, prosím, a stránku načítajte znova.",
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
    submit: "Opýtať sa",
    phases: {
      reading: "Čítam otázku…",
      searching: "Hľadám v predpisoch…",
      ranking: "Zoraďujem nájdené…",
      writing: "Skladám odpoveď…",
    },
    examplesLabel: "Napríklad",
    examples: [
      "Aká je lehota na podanie námietky?",
      "Za akých podmienok môže prestúpiť maloletý hráč?",
      "Kedy sa platí odstupné za hráča?",
      "Koľko žltých kariet znamená zastavenie činnosti?",
    ],
    unknownError: "Neznáma chyba",
    scopeLabel: "Hľadať v",
    scopeLibrary: "Knižnica",
    noScript: "Odpovedanie potrebuje JavaScript — odpoveď prichádza po častiach, ako ju model píše. Dokumenty sa dajú čítať a potvrdzovať aj bez neho:",
    noScriptLink: "prejsť na dokumenty",
    history: {
      recent: "Nedávne otázky",
      matching: "Z vašich otázok",
      all: "Celá história",
      title: "Moje otázky",
      lead: "Otázky, ktoré ste položili, s odpoveďami tak, ako vtedy prišli.",
      filter: "Hľadať v mojich otázkach",
      filterSubmit: "Hľadať",
      remove: "Odstrániť z histórie",
      removed: "Otázka odstránená z histórie",
      removedAll: "História vymazaná",
      undo: "Vrátiť",
      clearAll: "Vymazať celú históriu",
      clearConfirm: "Vymazať celú históriu otázok? Otázky zmiznú z vášho zoznamu.",
      clearCancel: "Nechať",
      retention: months => `Otázky a odpovede sa uchovávajú ${months} mesiacov a potom sa zmažú. Odstránenie z histórie ich skryje len vo vašom zozname — na kontrolu kvality odpovedí ostávajú do konca lehoty.`,
      loadOlder: "Načítať staršie",
      empty: "Zatiaľ ste sa nič nepýtali.",
      emptyText: "Otázku položte v poli hore. Vaše otázky a odpovede sa potom ukážu tu.",
      emptyFilter: "Žiadna vaša otázka tomu nezodpovedá.",
      emptyFilterText: "Skúste iné slovo alebo hľadanie zrušte.",
      status: {
        citations: n => (n === 1 ? "1 citácia" : n <= 4 ? `${n} citácie` : `${n} citácií`),
        none: "nič sa nenašlo",
        fits: "sedí",
        doesNotFit: "nesedí",
      },
      today: "Dnes",
      yesterday: "Včera",
    },
    saved: {
      banner: date => `Odpoveď z ${date}. Predpisy sa odvtedy mohli zmeniť.`,
      newVersion: (document, label, date) => `${document} má odvtedy nové znenie (${label}, účinné od ${date}).`,
      askAgain: "Opýtať sa znova",
    },
    sheet: {
      infoLead: org => `Odpoveď sa skladá len z dokumentov organizácie ${org}.`,
      infoRest: "Pri každom tvrdení je odkaz na zdroj. Ak to v dokumentoch nie je, systém to povie a nič si nevymyslí.",
      hint: "Enter odošle · Shift+Enter nový riadok · Esc zavrie",
      hintInline: "Enter odošle · Shift+Enter nový riadok",
      hintHistory: "↑↓ vybrať · Enter otvorí · Esc zavrie",
      insert: "vložiť",
      close: "Zavrieť",
    },
    heading: "Opýtať sa",
    emptyLead: "Napíšte otázku vlastnými slovami, tak ako by ste sa pýtali kolegu.",
    edit: "Upraviť otázku",
    askedAt: time => `Opýtali ste sa o ${time}`,
    answerKicker: org => `Odpoveď z dokumentov ${org}`,
    none: {
      kicker: "V dokumentoch organizácie sa k tomu nič nenašlo",
      text: "Skúste otázku inak, alebo hľadajte v knižnici — nie všetko je v predpisoch.",
      link: "Hľadať v knižnici →",
      noVersion: (d) => `K ${d} nemá organizácia žiadne platné znenie predpisu — skúste iný dátum alebo otázku bez dátumu.`,
    },
    error: {
      unavailable: "Odpoveď sa teraz nedá zložiť. Skúste to o chvíľu — vyhľadávanie v knižnici funguje.",
      link: "Otvoriť knižnicu →",
    },
  },

  answer: {
    cacheTo: "do cache",
    cacheFrom: "z cache",
    techTokens: "tokeny",
    techTotal: "celkom",
    techModel: "model",
    fromDocuments: "Odpoveď z vašich dokumentov",
    failed: "Odpoveď sa nepodarilo získať.",
    incompleteHeading: "Odpoveď je neúplná.",
    incompleteNote: "Model dosiahol limit dĺžky a zastavil sa uprostred — chýba jej záver. Skúste sa opýtať na užšiu časť problému.",
    citations: (shown) => `Doslovné citácie (${shown})`,
    citationsFrom: total => `z ${total} odkazov`,
    citationsPending: "Citácie pribudnú počas písania",
    technical: "Technické údaje",
    openInLibrary: "Otvoriť v knižnici",
    citationOf: (n, total) => `Citácia ${n} z ${total}`,
    prev: "Predošlá",
    next: "Ďalšia",
    close: "Zavrieť",
    sourceMissing: "zdroj neuvedený",
    sources: (n) => `Prehľadané zdroje (${n})`,
    internal: "interné",
    verified: "overená odpoveď",
    verifiedNote: "znenie, ktoré niekto overil nad predpisom — nie samotné znenie predpisu",
    live: "Živý zdroj",
    liveNote: (connector, group) => `priamo zo zdroja ${connector}${group ? ` (${group})` : ""} — neoverené kurátorom`,
    liveFailed: names => `Živý zdroj neodpovedal (${names}) — odpoveď je bez neho.`,
    sourceVersion: (label, from, to) =>
      [label && `znenie ${label}`, from && `účinné od ${from}${to ? ` do ${to}` : ""}`].filter(Boolean).join(" · "),
    timeToday: (d) => `podľa znení platných dnes, ${d}`,
    timeAsOf: (d) => `podľa znení platných k ${d}`,
    timeCompare: (from, to) => `porovnanie znení: ${from} → ${to}`,
    compareSide: (label, date) => (label ? (date ? `${label} (od ${date})` : label) : date ? `od ${date}` : ""),
    timeCompareUnavailable: {
      "single-version": (d) => `dokument má jediné znenie, nie je s čím porovnať — odpoveď podľa znení platných dnes, ${d}`,
      "missing-text": (d) => `text staršieho znenia chýba — odpoveď podľa znení platných dnes, ${d}`,
      identical: (d) => `znenia sa v texte nelíšia — odpoveď podľa znení platných dnes, ${d}`,
      "no-document": (d) => `porovnanie sa nepodarilo — odpoveď podľa znení platných dnes, ${d}`,
    },
    match: { high: "vysoká zhoda", medium: "stredná zhoda", low: "slabá zhoda" },
    adapter: "adaptér",
    firstToken: "prvý token",
    costNote: (pricelistVersion) => `Orientačne. Nezahŕňa pomocný model ani vyhľadávanie. Cenník ${pricelistVersion}.`,
    pricelistStale: "cenník je zastaraný",
    citationsVerified: "citácie overené modelom",
    citationsUnverified: "citácie neoverené",
  },
  hr: {
    tabs: { assignments: "Pridelenia", report: "Výkaz potvrdení", reminders: "Pripomienky", tracks: "Trasy", evidence: "Reťaz dôkazov" },
    tabsLabel: "Časti sekcie",
    dutyState: {
      acknowledged: "potvrdené",
      opened: "otvorené, nepotvrdené",
      "not-opened": "neotvorené",
      overdue: "po termíne",
      revoked: "odvolané",
    },
    report: {
      heading: "Výkaz potvrdení",
      intro: "Kto čo má potvrdiť a kto to už potvrdil. Do menovateľa vstupuje ten, komu bol dokument pridelený alebo ho má ako krok v zapnutej trase — nie všetci v organizácii.",
      views: { document: "Podľa dokumentu", person: "Podľa osoby", track: "Podľa trasy" },
      viewsShort: { document: "Dokument", person: "Osoba", track: "Trasa" },
      viewsLabel: "Pohľad",
      emptyTitle: "Zatiaľ niet čo zhrnúť",
      emptyText: "Súhrn sa zjaví, keď bude prvé pridelenie.",
      done: (done, total) => `${done} z ${total}`,
      missing: n => (n === 1 ? "chýba 1" : n >= 2 && n <= 4 ? `chýbajú ${n}` : `chýba ${n}`),
      complete: "hotové",
      medianReading: "medián čítania",
      noReading: "nemerané",
      readingNote: "Čas čítania je informatívny. Meria sa na klientovi, takže sa ním nič nedokazuje — kto nechá kartu otvorenú, „číta“ hodinu.",
      export: "Stiahnuť ako CSV",
      open: "Rozpísať",
      acknowledgedAt: "potvrdené",
      revoke: "Odvolať potvrdenie",
      revokeReason: "Dôvod odvolania",
      revokeHint: "Povinnosť ožije s pôvodným termínom. Ak termín už prešiel, osoba bude hneď po termíne.",
      revokeButton: "Odvolať",
      revokeDone: "Potvrdenie je odvolané. Povinnosť ožila.",
      revokeFailed: "Potvrdenie sa nepodarilo odvolať.",
      readingTime: "čítal",
      source: { assignment: "pridelenie", track: "trasa", both: "pridelenie aj trasa" },
    },
    overview: {
      assignedBy: (who: string) => `pridelil ${who}`,
      versionTag: (label: string) => `verzia ${label}`,
      today: "dnes",
      heading: "Pridelené dokumenty",
      intro: "Čo bolo komu uložené a kto to už potvrdil. Počty sa počítajú pri zobrazení — a týkajú sa ľudí, ktorí do skupiny patria",
      assign: "Prideliť dokument",
      tracks: "Trasy",
      tracksNote: "Ľudia na trase potvrdzujú jej kroky — povinnosť vzniká z trasy, nie z pridelenia.",
      trackLine: (people, documents) =>
        `${people === 1 ? "1 osoba" : people <= 4 ? `${people} osoby` : `${people} osôb`} · ` +
        `${documents === 1 ? "1 dokument" : documents <= 4 ? `${documents} dokumenty` : `${documents} dokumentov`}`,
      openTrack: "Otvoriť trasu",
      emptyTitle: "Žiadne pridelenia",
      emptyText: "Keď normu niekomu pridelíte, objaví sa tu aj s tým, koľkí ju už potvrdili.",
      acknowledged: "Potvrdili",
      notified: "Dali sme vedieť",
      no: "nie",
      nobody: "nikto",
      missing: "Chýba",
      notifyByEmail: "Dať vedieť e-mailom",
      revoke: "Odvolať pridelenie",
    },
    detail: {
      version: "verzia",
      assignedBy: "pridelil",
      notAcknowledged: (missing, total) => `Nepotvrdili (${missing} z ${total})`,
      effectiveFrom: (date) => `, platná od ${date}`,
      notifyLink: "dať im vedieť e-mailom →",
      allTitle: "Všetci potvrdili",
      allText: "Toto pridelenie je vybavené — nikto nechýba.",
      noLongerInDepartment: "už nie je v oddelení",
      note: "Zoznam sa počíta pri zobrazení. Kto z oddelenia odišiel bez potvrdenia, zostáva tu označený — inak by ticho zmizol a nikto by sa nedozvedel, že sa to nedoriešilo; e-mail sa mu ale neposiela. Kto odišiel z celej organizácie, tu nie je — jeho potvrdenie (alebo jeho chýbanie) však zostáva v záznamoch.",
    },
    revokeAssignment: {
      heading: "Odvolať pridelenie",
      lead: "Skontrolujte, ktoré pridelenie odvolávate. Odvolá sa až tlačidlom dole.",
      whatHappensHeading: "Čo sa stane po odvolaní",
      tasksDisappear: (n) => n === 1 ? "1 človeku, ktorý ešte nepotvrdil, zmizne úloha z „Na potvrdenie“ a nepríde mu pripomienka." : `${n} ľuďom, ktorí ešte nepotvrdili, zmizne úloha z „Na potvrdenie“ a nepríde im pripomienka.`,
      nobodyLoses: "Úlohu z tohto pridelenia už nikto nemá — všetci potvrdili.",
      versionSuperseded: (assigned, current, n) =>
        `Pridelené znenie ${assigned} už neplatí — nahradilo ho ${current}. Potvrdiť sa nedá, preto ho nikto nemá v „Na potvrdenie“; ` +
        (n > 0 ? `vo výkaze HR však ${n === 1 ? "1 človek visí ako nepotvrdený" : `${n} ľudia visia ako nepotvrdení`}. Odvolanie túto nesplniteľnú povinnosť odstráni.` : "nikto ho nemá ani vo výkaze HR."),
      acknowledgementsStay: (n) => `Potvrdenia, ktoré už vznikli (${n}), zostávajú platné. Odvolanie ich nemaže.`,
      recordStays: "Záznam o pridelení sa nemaže: v audite zostane pridelenie aj jeho odvolanie. Odvolanie sa nedá vrátiť späť.",
      reassign: "Ak ho budete chcieť znova, pridelíte dokument nanovo — vznikne nové pridelenie s dnešným dátumom.",
      reasonLabel: "Dôvod odvolania",
      reasonHint: "Nepovinný. Zapíše sa do auditu, aby bolo o rok jasné, prečo sa pridelenie zrušilo.",
      confirm: "Odvolať pridelenie",
      cancel: "Späť bez odvolania",
      alreadyRevoked: "Toto pridelenie už neplatí.",
    },
    notify: {
      trackAudience: (title: string) => `trasa „${title}"`,
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
      documentsCount: n => `${n} platných`,
      heading: "Prideliť dokumenty",
      introBefore: "Prideľuje sa ",
      introHighlight: "konkrétne znenie",
      introAfter: ", nie dokument. Keď pribudne novšie, staré pridelenie zaň neplatí — to je zámer.",
      emptyTitle: "Niet čo prideliť",
      emptyText: "Prideliť sa dá len publikované znenie. V knižnici zatiaľ žiadne nie je.",
      whichDocuments: "Ktoré normy",
      versionLine: (_label, date) => `znenie účinné od ${date}`,
      to: "Komu",
      departments: "Oddelenia",
      groups: "Skupiny",
      tracks: "Trasy",
      people: "Osoby",
      everyone: "Všetkým v organizácii",
      everyoneNote: "prebije výber nižšie — inak by to isté znenie viselo v prehľade niekoľkokrát a nikto by nevedel, ktorý riadok niečo znamená",
      departmentNoteBefore: "Pridelenie oddelenia platí ",
      departmentNoteHighlight: "aj pre všetky podriadené",
      departmentNoteAfter: ". Číslo je počet ľudí vrátane nich — to je to, koho sa to naozaj týka.",
      noGroupsOrTracks: "V organizácii zatiaľ nie sú skupiny ani trasy. Skupiny sa zadávajú pri importe osôb (stĺpec „skupiny“) alebo príkazom",
      addresses: "Jednotlivé adresy",
      addressesNote: "Nepovinné. Oddeľ čiarkou alebo novým riadkom.",
      reason: "Dôvod",
      due: "Termín potvrdenia",
      dueNone: "bez termínu",
      dueDate: "do dátumu",
      dueDays: "do počtu dní od vzniku povinnosti",
      dueDaysUnit: "dní",
      dueNote: "Nepovinný. Dátum platí pre všetkých rovnako; počet dní beží každému odo dňa, keď mu povinnosť vznikla — to je rozdiel pre toho, kto do oddelenia príde neskôr. Bez termínu sa pripomienky neposielajú automaticky.",
      reasonPlaceholder: "napr. novela čl. 12 — mení sa lehota na podanie odvolania",
      reasonNote: "Povinný a spoločný pre celý výber. Je to jediné miesto, kde bude o rok napísané, prečo sa normy potvrdzovali znova — a príde aj v e-maile ľuďom.",
      submit: "Prideliť",
      checkImpact: "Skontrolovať dopad",
      impactPeople: (n) =>
        n === 0 ? "Povinnosť nevznikne nikomu"
        : n === 1 ? "Povinnosť vznikne 1 človeku"
        : `Povinnosť vznikne ${n} ľuďom`,
      impactNote: "Kto do oddelenia pribudne neskôr, dostane ju odo dňa príchodu (D50).",
      docSearch: "Hľadať normu",
      docNone: q => `Nič nevyhovuje „${q}“. Prideliť sa dá len platné znenie.`,
      onlyMissingBasis: n => `len bez právneho základu (${n})`,
      showAll: "zobraziť všetky",
      picked: n => `Vybrané (${n})`,
      summary: {
        documents: n => (n === 1 ? "norma" : n >= 2 && n <= 4 ? "normy" : "noriem"),
        departments: n => (n === 1 ? "oddelenie" : n >= 2 && n <= 4 ? "oddelenia" : "oddelení"),
        groups: n => (n === 1 ? "skupina" : n >= 2 && n <= 4 ? "skupiny" : "skupín"),
        tracks: n => (n === 1 ? "trasa" : n >= 2 && n <= 4 ? "trasy" : "trás"),
        people: n => (n === 1 ? "osoba" : n >= 2 && n <= 4 ? "osoby" : "osôb"),
        everyone: "všetkým",
        everyoneRest: "v organizácii",
        noAudience: "adresát zatiaľ nevybraný",
      },
      impactStale: "Výber sa zmenil — skontroluj dopad znova",
      impactStaleNote: n => (n === 1
        ? "Pre predošlý výber by povinnosť vznikla 1 človeku."
        : `Pre predošlý výber by povinnosť vznikla ${n} ľuďom.`),
      submitN: n => (n === 1 ? "Prideliť 1 človeku" : `Prideliť ${n} ľuďom`),
    },
    actions: {
      noAudience: "Nevybral si, komu sa prideľuje.",
      noDocument: "Nevybral si žiadny dokument s platným znením.",
      saveFailed: "Pridelenie sa nepodarilo uložiť. Skús to znova.",
      assignedOne: (what) => `Pridelené: ${what}.`,
      assigned: (count, documents, audiences) =>
        `Pridelené: ${count} (${documents} ${documents === 1 ? "norma" : documents < 5 ? "normy" : "noriem"}` +
        ` × ${audiences} ${audiences === 1 ? "adresát" : audiences < 5 ? "adresáti" : "adresátov"}).`,
      assignedWithExisting: (count, documents, audiences, already) =>
        `Pridelené: ${count} (${documents} ${documents === 1 ? "norma" : documents < 5 ? "normy" : "noriem"}` +
        ` × ${audiences} ${audiences === 1 ? "adresát" : audiences < 5 ? "adresáti" : "adresátov"}).` +
        ` ${already} už ${already === 1 ? "pridelené bolo" : already < 5 ? "pridelené boli" : "pridelených bolo"}` +
        " — nič sa nezdvojilo.",
      revoked: (what) => `Odvolané: ${what}. Záznam o pridelení zostáva.`,
      alreadyRevoked: "Toto pridelenie už neplatí.",
      nobodyToNotify: "Nie je komu poslať — potvrdili už všetci, kto v oddelení zostal.",
      tooManyRecipients: (recipients, max) =>
        `Príjemcov je ${recipients}, naraz sa dá poslať najviac ${max}. Rozdeľ pridelenie na menšie skupiny adresátov.`,
      sent: (n) => `Odoslané ${n} ľuďom, ktorí ešte nepotvrdili.`,
      sentWithFailures: (n, failed) => `Odoslané ${n}. Nedoručiteľné: ${failed}`,
    },

    reminders: {
      heading: "Pripomienky",
      intro: days => `Ľudia, ktorí majú niečo nepotvrdené dlhšie než ${daysSk(days)}. Jeden e-mail na človeka — kto mešká so štyrmi smernicami, dostane jednu správu so štyrmi riadkami.`,
      open: "Pripomenúť",
      emptyTitle: "Niet komu pripomínať",
      none: days => `Všetci, ktorým beží termín, už potvrdili — nikto nemešká viac než ${daysSk(days)}.`,
      person: (documents, days) => `${documents === 1 ? "1 dokument" : documents >= 2 && documents <= 4 ? `${documents} dokumenty` : `${documents} dokumentov`} · najdlhšie ${daysSk(days)}`,
      send: people => people === 1 ? "Odoslať 1 pripomienku" : people >= 2 && people <= 4 ? `Odoslať ${people} pripomienky` : `Odoslať ${people} pripomienok`,
      impactEmails: n => n === 1 ? "Odíde 1 e-mail" : n >= 2 && n <= 4 ? `Odídu ${n} e-maily` : `Odíde ${n} e-mailov`,
      impactNote: "Ľudia, ktorí už potvrdili, nedostanú nič (D61). Odoslaný e-mail sa odvolať nedá.",
      sent: n => `Odoslané: ${n}.`,
      nobody: "Nie je komu pripomínať.",
      modeLabel: "Komu poslať",
      modeNotice: "Všetkým nepotvrdeným",
      modeOverdue: days => `Len meškajúcim (${daysSk(days)}+)`,
      noticeHeading: "Dať vedieť e-mailom",
      noticeIntro: "Každý, kto má niečo nepotvrdené — aj to, čo pribudlo dnes. Sem patria aj povinnosti z trás, ku ktorým pridelenie neexistuje, a tie inak nemajú ako dať o sebe vedieť. Jeden e-mail na človeka.",
      noticeNone: "Nikto nemá nič nepotvrdené.",
      noticePerson: documents => documents === 1 ? "1 dokument" : documents >= 2 && documents <= 4 ? `${documents} dokumenty` : `${documents} dokumentov`,
      noticeSend: people => people === 1 ? "Odoslať 1 e-mail" : people >= 2 && people <= 4 ? `Odoslať ${people} e-maily` : `Odoslať ${people} e-mailov`,
      noticeSent: n => `Odoslané: ${n}.`,
      noticeNobody: "Nie je komu posielať.",
      fromTrack: title => `z trasy „${title}“`,
    },
  },

  tree: {
    saveOrder: "Uložiť poradie",
    cancel: "Zrušiť zmeny",
    hint: "Poradie sa zapíše až tlačidlom.",
  },

  valueSelect: {
    onlyHere: "len tu",
    notInCodelist: "nie je v číselníku",
    searchOf: (shown, total) => `${shown} z ${total}`,
    groups: {
      count: n => n === 1 ? "1 človek" : n >= 2 && n <= 4 ? `${n} ľudia` : `${n} ľudí`,
      newPlaceholder: "Nová skupina",
      foot: "Nová skupina vznikne uložením osoby. Viac skupín oddeľte čiarkou.",
      emptyFoot: "Zatiaľ žiadna skupina — vznikne prvou, ktorú napíšete.",
      search: "Hľadať skupinu",
    },
    tags: {
      count: n => n === 1 ? "1 dokument" : n >= 2 && n <= 4 ? `${n} dokumenty` : `${n} dokumentov`,
      newPlaceholder: "Nová značka",
      foot: "Nová značka vznikne uložením dokumentu a pribudne do číselníka organizácie. Viac značiek oddeľte čiarkou.",
      emptyFoot: "Zatiaľ žiadna značka — vznikne prvou, ktorú napíšete.",
      search: "Hľadať značku",
    },
    similar: (v, like) => `„${v}“ sme neuložili: podobá sa na existujúcu „${like}“.`,
    similarGroupNote: "Ostatné údaje osoby sú uložené. Vyberte, čo platí, a uložte znova.",
    similarTagNote: "Ostatné údaje dokumentu sú uložené. Vyberte, čo platí, a uložte znova.",
    pickLike: like => `Použiť „${like}“`,
    createAnyway: v => `Založiť „${v}“`,
    similarSkipped: (v, like) => `Značku „${v}“ sme nepridali — podobá sa na „${like}“. Pridajte ju v úprave dokumentu.`,
  },
  multiSelect: {
    searchHint: "hľadať…",
    nothingFound: "Nič sa nenašlo.",
    nothingFoundNew: "Nič sa nenašlo — píšte inak, alebo pridajte novú hodnotu klávesom Enter.",
    empty: "Zatiaľ tu žiadne hodnoty nie sú.",
    clearAll: "Zrušiť výber",
    done: "Hotovo",
    remove: (value) => `Odobrať ${value}`,
    chosenOf: (chosen, total) => `Vybrané ${chosen} z ${total}`,
  },
  overview: {
    hello: name => `Dobrý deň, ${name}`,
    tiles: {
      toAcknowledge: "Na potvrdenie",
      toApprove: "Čaká na schválenie",
      new: "Nové",
      expiring: "Expiruje",
    },
    soonNote: n => (n === 1 ? "1 súrne" : n <= 4 ? `${n} súrne` : `${n} súrnych`),
    mine: "na mňa",
    newNote: days => `dokumentov za ${days} dní`,
    expiringNote: days => `predpisov do ${days} dní`,
    attention: "Vyžaduje vašu pozornosť",
    news: "Novinky v knižnici",
    empty: {
      attentionTitle: "Nič od vás nikto nečaká",
      attentionText: "Keď vám niekto pridelí normu alebo vás určí schvaľovateľom, objaví sa to tu aj s termínom.",
      newsTitle: days => `Za posledných ${days} dní nič nové`,
      newsText: "Nové znenia a tie, ktorým sa blíži koniec platnosti, sa ukážu tu.",
    },
    showAll: n => `Zobraziť všetkých ${n} →`,
    wholeLibrary: "Celá knižnica →",
    allTasks: "Všetky úlohy →",
    forYou: "Pre vás",
    by: date => `do ${date}`,
    until: date => `platí do ${date}`,
    expiringChip: "expiruje",
    open: "Otvoriť",
    decide: "Rozhodnúť",
    submittedBy: who => `predložil ${who}`,
  },
  evidence: {
    colPerson: "Osoba",
    colDocument: "Predpis · znenie",
    colState: "Stav",
    colDate: "Dátum",
    heading: "Reťaz dôkazov",
    intro: "Čo sa dialo s každou uloženou povinnosťou \u2014 od pridelenia po potvrdenie. Skladá sa pri zobrazení; neukladá sa nič.",
    emptyTitle: "Žiadne záznamy",
    emptyText: "Záznam vznikne, keď niekto dostane pridelenú normu alebo krok trasy.",
    emptyFilterTitle: "Filtru nič nevyhovuje",
    emptyFilterText: "Skúste iné meno alebo iný stav.",
    kind: {
      assigned: "Pridelené",
      notified: "Ozvalo sa jej",
      opened: "Prvýkrát otvorené",
      read: "Čas nad znením",
      acknowledged: "Potvrdené",
    },
    gap: {
      "before-recording": "vtedy sa to ešte nezaznamenávalo",
      expired: "meranie sa po roku zmazalo",
      "not-yet": "zatiaľ nie",
    },
    informative: "informatívne",
    rows: {
      ip: "IP adresa",
      department: "Oddelenie v čase potvrdenia",
      statement: "Znenie formulky",
      reading: "Čas čítania",
      opened: "Prvýkrát otvoril",
      revokedBy: "Odvolal",
      revokeReason: "Dôvod odvolania",
    },
    none: "—",
    seconds: n => (n < 60 ? `${n} s` : `${Math.round(n / 60)} min`),
    times: n => (n === 1 ? "raz" : n >= 2 && n <= 4 ? `${n} razy` : `${n} ráz`),
    states: {
      acknowledged: "potvrdené",
      "opened-not-acknowledged": "otvorené a nepotvrdené",
      "not-opened": "ani neotvorené",
    },
    filterPerson: "Osoba",
    filterState: "Stav",
    filterAll: "všetky",
    apply: "Použiť",
    exportCsv: "Export CSV",
    shown: (n, all) => `${n} z ${all} povinností`,
    allPeople: "všetci ľudia →",
    notifiedMissing: "Riadok o upozorneniach os zatiaľ nemá: log pripomienok je prevádzkový a po 90 dňoch sa maže, a zápis na pridelení hovorí „ozvalo sa N ľuďom\u201c, nie ktorým.",
  },
  approvals: {
    openPdf: "Otvoriť PDF",
    searchText: "Text na vyhľadávanie a odpovede — schvaľuje sa spolu s PDF",
    heading: "Na schválenie",
    intro: "Znenia, ktoré niekto predložil a čaká na tvoje rozhodnutie. Rozhoduješ sám za seba \u2014 ostatní schvaľovatelia rozhodujú nezávisle.",
    emptyTitle: "Nič nečaká na vaše rozhodnutie",
    emptyText: "Keď vás niekto určí schvaľovateľom znenia, objaví sa tu celý text aj s tým, kto ho predložil.",
    versionLine: (label, round) => `${label} \u00b7 ${round}`,
    roundLine: round => `${round}. kolo`,
    submittedBy: (who, when) => `predložil ${who} \u00b7 ${when}`,
    effectiveFrom: date => `účinnosť od ${date}`,
    noEffectiveFrom: "dátum účinnosti zatiaľ nie je \u2014 prideliť sa to bude dať až s ním",
    newVersionFrom: d => `Nové znenie od ${d}`,
    firstVersionFrom: d => `Prvé znenie od ${d}`,
    draftVersion: "Nové znenie",
    kicker: (round, who, when) => `${round}. kolo · predložil ${who} · ${when}`,
    whatYouApprove: "Čo schvaľuješ",
    whatYouApproveNote: "PDF, text a údaje o znení — jedným rozhodnutím",
    searchTextNote: "Text na vyhľadávanie a odpovede — schvaľuje sa spolu s PDF",
    metaHeading: "Údaje o znení",
    metaNote: "súčasť schválenia · po predložení sa nedajú meniť",
    noteFrom: "Poznámka od predkladateľa",
    alsoDecidingHeading: "Rozhodujú aj",
    readAndDecide: "Prečítať a rozhodnúť",
    alsoDeciding: names => `Rozhodujú aj: ${names}`,
    readText: "prečítať znenie",
    noText: "Znenie nemá text.",
    draftChanged: "Text sa po predložení na schválenie zmenil. Toto kolo sa týka pôvodnej podoby, ktorá už neexistuje — správca obsahu ho musí predložiť znova.",
    reason: "Dôvod",
    reasonPlaceholder: "Napríklad: článok 4 odporuje stanovám.",
    reasonHint: "Pri zamietnutí je dôvod povinný. Pri schválení nepovinný \u2014 ale ostane v zázname.",
    approve: "Schváliť",
    reject: "Zamietnuť",
    doneApproved: "Schválené. Čaká sa na ostatných schvaľovateľov.",
    doneApprovedClosed: "Schválené. Znenie je schválené celé.",
    doneRejected: "Zamietnuté. Znenie sa vrátilo do konceptu a dôvod zostáva v histórii.",
  },
  curation: {
    prepareHeading: "Pripraviť ako overenú odpoveď",
    prepareIntro: "Posúdené odpovede, pri ktorých ste napísali, ako mala odpoveď znieť. Pripravený pár zverejní správca obsahu — do znalostí sa zatiaľ nedostane.",
    prepareEmpty: "Zatiaľ nie je z čoho pripraviť pár. Vzniká z posudku, pri ktorom je vyplnené „Ako mala odpoveď znieť“.",
    questionLabel: "Otázka",
    questionHint: "Znenie môžete upraviť — pôvodná otázka je voľný text a môže obsahovať aj to, čo do znalostí nepatrí.",
    answerLabel: "Overená odpoveď",
    sourcesLabel: "Z ktorých úsekov predpisu odpoveď vznikla",
    sourcesHint: "Podľa nich sa určí, kto smie pár vidieť, a podľa nich sa archivuje, keď sa norma zmení. Stačí jeden interný úsek a pár je interný.",
    noSources: "Táto odpoveď nemá pri zdrojoch identifikátory úsekov, takže sa z nej pár pripraviť nedá. Týka sa to odpovedí spred 15. 9. 2026.",
    save: "Pripraviť pár",
    draftBadge: "pripravené",
    publishHeading: "Overené odpovede na zverejnenie",
    publishIntro: "Páry pripravené hodnotiteľom. Zverejnením sa dostanú do znalostí ako overená odpoveď — žiadny predpis sa tým nemení ani neprepisuje.",
    publishEmpty: "Nič nečaká na zverejnenie",
    publishEmptyNote: "Keď hodnotiteľ označí odpoveď ako overenú, objaví sa tu aj so zdrojmi, z ktorých vychádza.",
    preparedBy: "pripravil",
    preparedByUnknown: "osoba už nie je v adresári",
    access: "Prístup",
    accessPublic: "verejný",
    accessInternal: "interný",
    accessNote: "Úroveň sa odvodzuje zo zdrojov, nezadáva sa. Pri zverejnení sa počíta znova.",
    publish: "Zverejniť do znalostí",
    open: "Overené odpovede",
    waiting: n => (n === 1 ? "1 na zverejnenie" : `${n} na zverejnenie`),
  },
  evaluation: {
    heading: "Na posúdenie",
    intro: "Odpovede, pri ktorých niekto povedal, že nesedia. Potvrďte alebo opravte jeho posudok a doplňte, ako mala odpoveď znieť — z toho sa neskôr robí kurácia.",
    empty: "Momentálne nie je čo posudzovať.",
    emptyNote: "Sem sa dostane odpoveď až vtedy, keď na ňu niekto klikne „Nesedí“ alebo napíše, čo je na nej zle. Správne odpovede vás nezdržujú.",
    saidDoesNotFit: "nesedí",
    reported: "nahlásené",
    reader: "od čitateľa",
    answerLabel: "Odpoveď systému",
    showAnswer: "Zobraziť odpoveď",
    hideAnswer: "Skryť odpoveď",
    sources: n => (n === 1 ? "1 zdroj" : n <= 4 ? `${n} zdroje` : `${n} zdrojov`),
    askedAt: "opýtané",
    waiting: n => (n === 1 ? "1 na posúdenie" : n <= 4 ? `${n} na posúdenie` : `${n} na posúdenie`),
  },
  rating: {
    readerQuestion: "Sedí táto odpoveď?",
    fits: "Sedí",
    doesNotFit: "Nesedí",
    readerThanks: "Ďakujeme. Odpoveď si pozrie hodnotiteľ.",
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
  admin: {
    list: {
      heading: "Správa tenantov",
      intro: "Prehľad organizácií na platforme. Čísla sa počítajú pri zobrazení, nikde sa neukladajú. Obsah organizácií — dokumenty a potvrdenia — táto rola nesprístupňuje.",
      newTenant: "Nová organizácia",
      disabled: "vypnutý",
      noDomainWarning: "Do organizácie sa nedá prihlásiť — prihlásenie je viazané na domény. Doplňte aspoň jednu.",
      emptyTitle: "Žiadne organizácie",
      emptyText: "Prvú pridáte tlačidlom vyššie.",
      people: "Osoby",
      peopleValue: (signedIn, total) => `${signedIn} / ${total} prihlásených`,
      versions: "Znenia",
      documents: "Dokumenty",
      documentsValue: (valid, total) => `${valid} / ${total} platných`,
      acknowledgements: "Potvrdenia",
      withoutVersion: "bez platného znenia",
      instructionsSent: (when, to) => `Pokyny k doméne poslané ${when} na ${to}`,
      domainsNoteBefore: "Stav domén vo Verceli ukáže ",
      domainsNoteAfter: "; do obrazovky pribudne v rozsahu C spolu so zakladaním tenantov.",
    },
    create: {
      heading: "Nová organizácia",
      introBefore: "Subdoména pod ",
      introMiddle: " funguje hneď — pokrýva ju wildcard. Vlastná doména zákazníka sa pridá do Vercelu automaticky a zostane mu nastaviť jeden ",
      introAfter: ".",
      code: "Kód organizácie",
      codeNoteBefore: "Veľké písmená, číslice, pomlčka. Nesie ho každá osoba, dokument aj potvrdenie — ",
      codeNoteHighlight: "neskôr sa nemení",
      codeNoteAfter: " — je súčasťou identifikátora každého dokumentu.",
      codeTaken: "Kód {code} je už obsadený. Zvoľte iný.",
      name: "Názov",
      nameNote: "To, čo ľudia uvidia v hlavičke portálu. Z názvu sa navrhne kód organizácie — skratku, ktorú organizácia používa, pokojne prepíšte.",
      supportEmail: "Kontakt organizácie",
      supportEmailNote: "Sem pôjdu pokyny k doméne.",
      domains: "Domény",
      domainsPlaceholder: "klub.contineo.app",
      domainsNote: "Jedna na riadok. Bez domény sa portál organizácie nikde neukáže.",
      submit: "Založiť",
    },
    detail: {
      disabled: " · vypnutá",
      numbersHeading: "Čísla organizácie",
      tracks: "Trasy",
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
      autoProvisionNotHosts: "Sú to e-mailové domény pracovných kont (meno@futbalsfz.sk), nie webové adresy portálu — tie sú v záložke Domény.",
      save: "Uložiť",
      disableHeading: "Vypnúť organizáciu",
      enableHeading: "Zapnúť organizáciu",
      disableNote: "Po vypnutí sa nikto z tejto organizácie neprihlási — okamžite. Záznamy potvrdení zostávajú, tenant sa nemaže.",
      confirmLabel: (code) => `Napíš ${code} na potvrdenie`,
      confirmHint: "Zámerne to nie je obyčajné „naozaj?“ — to sa odklikne skôr, než sa prečíta.",
      domainsSection: "Domény a zakladanie",
      sendTitle: "Poslať pokyny k doméne",
      disableOpen: "Vypnúť…",
      enableNote: "Ľudia z organizácie sa budú môcť znova prihlásiť.",
      cancel: "Zrušiť",
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
      removeOwnTitle: p => `Odstrániť vlastné prihlásenie cez ${p}`,
      removeOwnNote: "Prihlásenie sa vráti na nastavenie od dodávateľa, ak ho má; inak tlačidlo z prihlasovacej obrazovky zmizne.",
      removeOpen: "Odstrániť…",
      cancel: "Zrušiť",
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
    "certificate.notFound": "Certifikát neexistuje.",
    "csv.expectedRequired": "krátky text potrebuje očakávanú odpoveď v answer_1",
    "csv.trueFalse": "pri pravde/nepravde je correct true alebo false",
    "csv.correctOutOfRange": "číslo v correct nie je medzi vyplnenými odpoveďami",
    "csv.multipleTwo": "viac správnych potrebuje 3–8 odpovedí a aspoň dve čísla v correct",
    "csv.singleOne": "jedna správna potrebuje 2–8 odpovedí a práve jedno číslo v correct",
    "csv.difficulty": "obtiažnosť je easy, medium alebo hard",
    "csv.weight": "váha musí byť celé číslo aspoň 1",
    "csv.tagShape": "smart:tag nie je v tvare Kľúč: Hodnota",
    "csv.tagsRequired": "chýba smart:tag",
    "csv.textRequired": "chýba znenie otázky",
    "csv.duplicateId": "id je v súbore dvakrát",
    "csv.type": "neznámy typ otázky",
    "attempt.closed": "Pokus je už uzavretý.",
    "attempt.notFound": "Pokus sa nenašiel.",
    "attempt.notEnoughQuestions": "V banke nie je dosť otázok na tento test.",
    "attempt.passed": "Test už máte prejdený.",
    "attempt.exhausted": "Všetky pokusy sú vyčerpané.",
    "attempt.pause": "Ďalší pokus zatiaľ nie je možný — test má pauzu medzi pokusmi.",
    "attempt.testNotFound": "Taký test nie je.",
    "test.notFound": "Taký test nie je.",
    "test.noTitle": "Názov testu je povinný.",
    "test.keyTaken": "Test „{key}“ už existuje.",
    "test.keyShape": "Kľúč testu „{key}“ nemá správny tvar.",
    "test.keyReserved": "Kľúč testu „{key}“ je vyhradený pre časť sekcie Testy — zvoľte iný.",
    "question.notFound": "Taká otázka v banke nie je.",
    "question.trueFalseMissing": "Vyberte, či je správna pravda alebo nepravda.",
    "question.weight": "Váha musí byť celé číslo aspoň 1.",
    "question.tagRequired": "Otázka potrebuje aspoň jeden smart:tag — bez neho ju žiadny test nevylosuje.",
    "question.expectedRequired": "Chýba očakávaná odpoveď.",
    "question.altRequired": "Chýba popis obrázka.",
    "question.answerEmpty": "Niektorá odpoveď je prázdna.",
    "question.multipleTwoCorrect": "Pri viacerých správnych musia byť správne aspoň dve.",
    "question.singleOneCorrect": "Pri jednej správnej odpovedi musí byť správna práve jedna.",
    "question.tooManyAnswers": "Odpovedí môže byť najviac 8.",
    "question.tooFewAnswers": "Otázka má málo odpovedí — jedna správna aspoň 2, viac správnych aspoň 3.",
    "question.contentRequired": "Otázka potrebuje text alebo aspoň jeden obrázok či video.",
    "learning.audienceRequired": "Vyberte adresátov.",
    "learning.urlInvalid": "Adresa videa nie je platná — podporované sú YouTube, Vimeo a odkazy https.",
    "learning.fileRequired": "Najprv nahrajte súbor.",
    "learning.documentRequired": "Vyberte dokument z knižnice.",
    "learning.textRequired": "Text bloku je prázdny.",
    "learning.altRequired": "Chýba popis obrázka.",
    "learning.partTitleRequired": "Názov časti je povinný.",
    "learning.mediaType": "Súbor {name} nie je obrázok ani video MP4 či WebM.",
    "learning.topicRequired": "Vyberte tému kurzu.",
    "learning.mergeNeedsTwo": "Na zlúčenie treba aspoň dva smart:tagy.",
    "learning.tagShape": "„{value}“ nie je smart:tag v tvare „Kľúč: Hodnota“.",
    "learning.courseKeyShape": "Kľúč kurzu „{key}“ nemá správny tvar — malé písmená bez diakritiky, číslice a pomlčka.",
    "learning.courseKeyReserved": "Kľúč kurzu „{key}“ je vyhradený pre časť správy kurzov — zvoľte iný.",
    "learning.titleRequired": "Názov kurzu je povinný.",
    "learning.courseKeyTaken": "Kurz s kľúčom „{key}“ už existuje.",
    "learning.courseNotFound": "Taký kurz neexistuje.",
    "learning.noDraft": "Kurz nemá koncept — zverejnená verzia sa nemení. Začnite novú verziu.",
    "learning.draftExists": "Kurz už má rozpracovaný koncept.",
    "learning.notPublished": "Kurz nie je zverejnený.",
    "learning.notOpen": "Do tohto kurzu sa nedá zapísať — nie je otvorený.",
    "learning.reasonRequired": "Dôvod je povinný.",
    "learning.enrollmentCancelled": "Zápis do kurzu je zrušený.",
    "learning.blockNotFound": "Taký blok v kurze nie je.",
    "learning.partNotFound": "Taká časť v kurze nie je.",
    "learning.locked": "Časť je zamknutá — najprv dokončite predošlé povinné časti.",
    "learning.videoNotWatched": "Najprv dopozerajte povinné video.",
    "learning.testNotPassed": "Najprv prejdite povinný test.",
    "learning.topicLabelRequired": "Názov témy je povinný.",
    "learning.topicKeyShape": "Kľúč témy môže obsahovať len malé písmená bez diakritiky, číslice a podčiarkovník.",
    "learning.topicKeyTaken": "Téma s takým kľúčom už existuje (aj medzi vyradenými).",
    "legalBasis.unknownKey": "Taká položka v číselníku právnych základov nie je, alebo je skrytá či vyradená.",
    "legalBasis.badKey": "Kľúč môže obsahovať len malé písmená bez diakritiky, číslice a podčiarkovník.",
    "legalBasis.labelRequired": "Názov právneho základu je povinný.",
    "legalBasis.keyTaken": "Taký kľúč už v číselníku je (aj medzi skrytými a vyradenými položkami).",
    "legalBasis.notCustom": "Takú vlastnú položku organizácia nemá.",
    "legalBasis.notStandard": "Taká štandardná položka neexistuje.",
    "responsibility.personRequired": "Zodpovedná osoba je povinná — na ňu sa budú obracať ľudia, ktorí znenie potvrdzujú.",
    "responsibility.unknownPerson": "Vybraná zodpovedná osoba tu nie je alebo je vyradená.",
    "responsibility.samePerson": "Toto je už zodpovedná osoba tohto znenia.",
    "responsibility.reasonRequired": "Dôvod zmeny zodpovednej osoby je povinný — o rok sa musí dať zistiť, prečo sa kontakt zmenil.",
    "responsibility.notContentManager": "Zodpovednú osobu určuje správca obsahu.",
    "legalBasis.invalid": "Taký právny základ systém nepozná.",
    "legalBasis.referenceRequired": "Pri zákonnej povinnosti je odkaz na predpis povinný (napríklad § 7 zákona č. 124/2006 Z. z.).",
    "legalBasis.referenceTooLong": "Odkaz na predpis je pridlhý — stačí citácia, nie text ustanovenia.",
    "legalBasis.noChange": "Právny základ je už takto určený.",
    "legalBasis.reasonRequired": "Dôvod zmeny právneho základu je povinný — potvrdenia, ktoré medzitým vznikli, si nesú pôvodný.",
    "legalBasis.notAllowed": "Právny základ určuje zodpovedná osoba tohto znenia. Správca obsahu ho smie určiť len vtedy, keď znenie zodpovednú osobu nemá alebo už nie je aktívna.",
    "legalBasis.noDraft": "Dokument nemá pripravované znenie — právny základ sa určuje pri zverejnenom znení.",
    "legalBasis.draftNotAllowed": "Právny základ pripravovaného znenia určuje jeho zodpovedná osoba. Správca obsahu ho smie určiť len vtedy, keď ju príprava nemá alebo už nie je aktívna.",
    unknown: "Nepodarilo sa to. Skús to znova.",

    // schvalovanie znenia (ADR-006)
    "approval.noApprovers": "Vyber aspoň jedného schvaľovateľa. Kolo bez nich by sa nedalo uzavrieť.",
    "approval.selfApproval": "Seba vybrať nemôžeš. Kto text nahral, ho neschvaľuje \u2014 inak je schválenie podpis pod vlastnú prácu.",
    "approval.alreadyRunning": "Pre toto znenie už kolo beží. Počkaj, kým sa uzavrie, alebo ho zruš.",
    "approval.alreadyApproved": "Toto znenie je schválené. Iný text znamená nové znenie, nie nové kolo.",
    "approval.publishedBefore": "Toto znenie bolo zverejnené pred zavedením schvaľovania a spätne sa neschvaľuje. Nahradí ho oficiálne znenie.",
    "approval.unknownApprover": "Niektorý z vybraných schvaľovateľov tu nie je alebo je vyradený.",
    "approval.documentNotFound": "Taký dokument tu nie je.",
    "approval.pdfRequired": "Koncept nemá PDF — nahraj znenie znova aj s PDF. Schvaľuje sa PDF spolu s textom.",
    "approval.draftChanged": "Koncept sa medzitým zmenil — obnov stránku a predlož ho znova.",
    "approval.reasonRequired": "Bez dôvodu sa kolo zrušiť nedá. O rok nikto nezistí, prečo skončilo.",
    "approval.nothingRunning": "Pre toto znenie nebeží žiadne kolo.",
    "assignment.notApproved": "Znenie nie je schválené. Prideliť sa dá až text, na ktorom sa niekto zhodol \u2014 predlož ho na schválenie v detaile dokumentu.",
    "approval.notApprover": "Toto kolo na teba nečaká \u2014 nie si medzi menovanými schvaľovateľmi.",
    "approval.roundClosed": "Kolo je uzavreté. Rozhodnutie doň už pribudnúť nemôže.",
    "approval.alreadyDecided": "Rozhodnutie je zapísané a nemení sa. Ak si to rozmyslíš, predkladateľ kolo zruší a otvorí nové \u2014 v histórii bude vidieť oboje.",

    // ── prevod súboru ──────────────────────────────────────────────────────
    "conversion.zipNotOffice": "Toto je ZIP-ový balík, ale ani docx, ani xlsx. Staré .doc a .xls sa prevádzať nedajú — ulož ich vo Worde alebo Exceli ako novší formát.",
    "conversion.unsupportedFormat": "Formát {format} zatiaľ nevieme previesť. Podporujeme .docx, .pdf, .xlsx, .md, .txt a .csv.",
    "rewrite.answerTruncated": "Model nestihol dopísať celý dokument — odpoveď je useknutá. Polovica predpisu sa použiť nedá; rozdeľ dokument a prepíš ho po častiach.",
    "library.noStructureFound": "V texte sa nenašla ani jedna úroveň členenia (ČASŤ, hlava, Článok, príloha). Buď je text členený inak, alebo ide o sken a treba ho prepísať jazykovým modelom.",
    "conversion.pdfEngineFailed": "Toto PDF sa nepodarilo otvoriť. Buď je poškodené alebo zaheslované, alebo je chyba na našej strane — skúsenie znova nepomôže. Ozvi sa správcovi systému, podrobnosti sú v zázname.",
    "conversion.pdfNoText": "V tomto PDF nie je žiadny text — je to obrázok (sken). Prevod ho neprečíta. V editore ho môžeš dať prepísať jazykovým modelom, alebo si vypýtaj od autora pôvodný súbor.",
    "conversion.noText": "Súbor neobsahuje žiadny text.",

    // ── uložený súbor ──────────────────────────────────────────────────────
    "file.empty": "Súbor je prázdny.",
    "file.tooLarge": "Súbor má {mb} MB, strop je {maxMb} MB.",
    "file.nameRequired": "Súbor nemá názov.",
    "file.uploadNotFound": "Nahrávanie sa nenašlo alebo vypršalo. Začni znova.",
    "file.chunkInvalid": "Časť súboru neprišla celá. Skús nahrať znova.",
    "file.uploadIncomplete": "Súbor neprišiel celý. Skús nahrať znova.",

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
    "objection.emptyText": "Chýba znenie námietky.",
    "objection.alreadyPending": "Vaša predošlá námietka sa ešte posudzuje.",
    "archive.no-current": "Predpis nemá platné znenie, ktoré by sa dalo archivovať.",
    "archive.already-archived": "Predpis je už archivovaný.",
    "archive.upcoming": "Predpis má zverejnenú novelu, ktorá ešte neplatí. Archivovať sa dá, až keď začne platiť.",
    "archive.draft": "Pripravuje sa nové znenie. Najprv ho dokonči alebo zahoď.",
    "archive.round-open": "Beží kolo schvaľovania. Najprv ho ukonči.",
    "archive.date-before-start": "Dátum musí byť neskôr než začiatok platnosti znenia.",
    "archive.no-reason": "Chýba dôvod archivácie.",
    "archive.not-archived": "Predpis nie je archivovaný.",
    "archive.bad-date": "Dátum nie je platný.",
    "objection.badDate": "Dátum doručenia nie je platný dátum.",
    "objection.futureDate": "Dátum doručenia nemôže byť v budúcnosti.",
    "objection.badDecision": "Vyber, či námietke vyhovieť alebo ju zamietnuť.",
    "objection.noteRequired": "Rozhodnutie potrebuje odôvodnenie.",
    "objection.personNotFound": "Osoba s adresou {email} v organizácii nie je.",
    "objection.notFound": "Taká námietka tu nie je.",
    "objection.notPending": "O námietke už bolo rozhodnuté.",
    "person.badEndedAt": "Dátum skončenia nie je platný dátum.",
    "person.endedInFuture": "Dátum skončenia nemôže byť v budúcnosti.",
    "person.endedNotInactive": "Skončenie vzťahu sa zadáva až pri vyradenej osobe.",
    "person.badEmail": "To nie je e-mailová adresa.",
    "person.emailTaken": "{email} v organizácii už je.",
    "person.alreadyInvited": "{email} je v organizácii už zapísaná.",
    "person.nameRequired": "Meno je povinné — bez neho je v zozname len adresa.",
    "person.nameRequiredShort": "Meno je povinné.",
    "tenant.overdueDaysRange": "Počet dní musí byť od 1 do 365.",
    "tenant.phonePrefixShape": "Predvoľba „{value}“ nemá správny tvar — očakáva sa napríklad +421.",
    "tenant.registrationNumberShape": "IČO „{value}“ nemá správny tvar — očakáva sa 6 až 12 číslic.",
    "tenant.privacyContactEmailShape": "Adresa „{value}“ nemá tvar e-mailovej adresy.",
    "person.givenNameRequired": "Meno je povinné.",
    "person.surnameRequired": "Priezvisko je povinné.",
    "person.unknownWorkplace": "Pracovisko „{value}“ v číselníku organizácie nie je. Doplňte ho v Organizácia → Číselníky.",
    "phone.noPrefix": "Číslu „{value}“ chýba predvoľba — napíšte ho s nulou (0905…) alebo medzinárodne (+421…).",
    "phone.shape": "„{value}“ nevyzerá ako telefónne číslo.",
    "phone.invalid": "„{value}“ nie je platné telefónne číslo pre zvolenú krajinu — skontrolujte krajinu a počet číslic.",
    "person.departmentNotFound": "Také oddelenie neexistuje.",
    "person.unknownType": "Neznámy typ osoby.",
    "person.unknownGender": "Neznáme pohlavie.",

    // ── prideľovanie noriem ────────────────────────────────────────────────
    "assignment.missingReason": "Dôvod pridelenia je povinný — je to jediné miesto, kde sa dá zaznamenať, prečo sa má norma potvrdiť znova (D30).",
    "assignment.missingCompany": "Chýba kód organizácie.",
    "assignment.missingSubject": "Chýba dokument alebo jeho znenie.",
    "assignment.versionNotEffective": "Znenie nemá dátum platnosti, a tak sa nedá ani potvrdiť (D6). Najprv mu doplň platnosť.",
    "assignment.missingAudience": "Chýba, komu sa prideľuje.",
    "assignment.badDue": "Termín nie je platný dátum.",
    "assignment.badDueDays": "Termín v dňoch musí byť aspoň jeden deň.",
    "assignment.dueBeforeEffective": "Termín je skôr, než znenie začne platiť — takú povinnosť by nikto nesplnil (D6).",

    // ── trasy ──────────────────────────────────────────────────────────────
    "track.titleRequired": "Názov trasy je povinný.",
    "track.notFound": "Taká trasa tu nie je.",
    "track.titleTaken": "Trasa s názvom „{title}“ už existuje — názov musí byť jedinečný, podľa neho sa trasa vyberá aj importuje.",
    "track.badDueDays": "Počet dní musí byť od 1 do 365.",
    "track.noMembersChosen": "Vyberte osoby alebo oddelenie.",
    "track.documentNotFound": "Dokument „{documentId}“ v tejto organizácii nie je.",
    "track.noSteps": "Prázdnu trasu zapnúť nejde — najprv jej pridaj kroky.",

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
    "tenant.alreadyExists": "Organizácia {code} už existuje. Voľný je {free} — použite ten, alebo zvoľte vlastnú skratku.",
    "ai.keyRejected": "Anthropic kľúč odmietol — skontrolujte, či je celý a platný.",
    "ai.keyUnverified": "Kľúč sa nepodarilo overiť — Anthropic neodpovedá. Skúste to o chvíľu.",
    "ai.unknownModel": "Model „{value}“ nie je v ponuke.",
    "helpdesk.nameRequired": "Názov kanála je povinný.",
    "helpdesk.notFound": "Taký kanál tu nie je.",
    "helpdesk.mailboxKind": "Neznámy druh schránky.",
    "helpdesk.mailboxAddress": "Adresa schránky nie je e-mailová adresa.",
    "helpdesk.graphIds": "Pri Microsoft 365 je povinný tenant a client id aplikácie.",
    "helpdesk.noMailbox": "Kanál nemá schránku.",
    "helpdesk.noSecret": "Schránka nemá uložené tajomstvo aplikácie.",
    "helpdesk.secretUnreadable": "Tajomstvo schránky sa nedá rozšifrovať — zadaj ho znova.",
    "helpdesk.imapNotYet": "IMAP schránka ešte nie je k dispozícii — zatiaľ len Microsoft 365.",
    "connector.nameRequired": "Názov konektora je povinný.",
    "connector.endpoint": "Adresa servera musí byť úplná a začínať https://.",
    "connector.profile": "Neznámy profil servera.",
    "connector.badPattern": "Vzor „{pattern}“ sa nedá použiť ako regulárny výraz.",
    "connector.scopeDuplicate": "Dva rozsahy majú rovnaký kľúč.",
    "connector.notFound": "Taký konektor tu nie je.",
    "connector.noPending": "Prihlásenie nebolo začaté alebo už vypršalo — skúste znova.",
    "connector.authStart": "Server nedovolil začať prihlásenie ({detail}).",
    "connector.alreadyConnected": "Konektor je už pripojený.",
    "connector.authFinish": "Výmena kódu za token zlyhala ({detail}).",
    "connector.notConnected": "Konektor nie je pripojený.",
    "connector.timeout": "Server neodpovedal včas.",
    "connector.unauthorized": "Prihlásenie ku konektoru vypršalo — pripojte ho znova.",
    "connector.ingestOff": "Konektor nemá zapnutý import do knižnice.",
    "connector.noImportProfile": "Profil tohto servera import nepodporuje.",
    "connector.nothingSelected": "Nie je vybraný žiadny článok.",
    "library.notFromConnector": "Tento dokument nevznikol z konektora.",
    "helpdesk.hasTickets": "Kanál má tickety — odstrániť sa nedá, len prestať používať.",
    "helpdesk.kind": "Neznámy typ kanála.",
    "helpdesk.syncInterval": "Neznámy interval synchronizácie.",
    "helpdesk.noTickets": "Kanál nemá zapnuté tickety.",
    "helpdesk.miningFailed": "Ťažba FAQ sa nepodarila (dávka {batch}) — skúste to o chvíľu.",
    "ticket.notFound": "Taký ticket tu nie je.",
    "ticket.notEmail": "Ticket nevznikol z e-mailu — nemá vlákno v schránke.",
    "ticket.emptyDraft": "Prázdny návrh sa uložiť nedá.",
    "ticket.emptyAnswer": "Prázdna odpoveď sa odoslať nedá.",
    "ticket.noRecipient": "Ticket nemá komu odpovedať — chýba adresa.",
    "ticket.aiFailed": "Asistent návrh nepripravil — skúste to o chvíľu.",
    "ticket.emptyQuestion": "Ticket nemá text otázky.",
    "widget.tokenShape": "Token nemá tvar JWT.",
    "widget.tokenSignature": "Podpis tokenu nesedí.",
    "widget.tokenExpired": "Token vypršal.",
    "widget.tokenAudience": "Token patrí inému kanálu.",
    "widget.tokenIssuer": "Vydavateľ tokenu nie je medzi povolenými pôvodmi kanála.",
    "widget.tokenClaims": "Token nemá potrebné údaje o osobe.",
    "widget.noSecret": "Kanál nemá tajný kľúč.",
    "widget.rateLimited": "Príliš veľa otázok — skús to neskôr.",
    "mailbox.auth": "Prihlásenie aplikácie do Microsoft 365 zlyhalo — skontroluj tenant, client id a tajomstvo.",
    "mailbox.forbidden": "Schránka odmietla prístup — skontroluj oprávnenia aplikácie a zúženie na schránku.",
    "mailbox.notFound": "Schránka s touto adresou v organizácii nie je.",
    "mailbox.cursorExpired": "Značka synchronizácie vypršala — ďalšie spustenie začne odznova.",
    "mailbox.failed": "Schránka neodpovedala správne.",
    "tenant.noEncryptionKey": "Tajomstvo sa nedá uložiť: chýba OAUTH_SECRET_ENCRYPTION_KEY. Ukladať ho čitateľne nebudeme — je to prístup do cudzieho systému.",
    "tenant.needsBothCredentials": "Treba aj clientId, aj tajomstvo — jedno bez druhého sa nedá použiť.",

    // ── knižnica ───────────────────────────────────────────────────────────
    "library.noFileChosen": "Nevybral si súbor.",
    "library.pdfRequired": "Schvaľovaná podoba musí byť PDF — ulož dokument vo Worde ako PDF.",
    "library.sourceNotPdf": "Zdrojový súbor má byť upraviteľný (.docx, .xlsx, .md…), nie druhé PDF.",
    "library.uploadedFileNotFound": "Nahratý súbor sa nenašiel. Skús ho nahrať znova.",
    "library.documentNotFound": "Taký dokument tu nie je.",
    "chunking.unknownProfile": "Profil členenia „{value}“ neexistuje.",
    "chunking.labelRequired": "Profil potrebuje názov.",
    "chunking.aiNoText": "Dokument nemá text, nie je čo analyzovať.",
    "chunking.aiNoKey": "Umelá inteligencia nemá nastavený kľúč — nastavte ho v Organizácia → Umelá inteligencia.",
    "chunking.aiFailed": "Analýza sa nepodarila — skúste to o chvíľu.",
    "chunking.labelTaken": "Profil s názvom „{value}“ už existuje — použite ho, alebo zvoľte iný názov.",
    "library.titleLocked": "Názov dokumentu so zverejneným znením sa mení len novým znením — zmeň ho v príprave nového znenia, schváli sa s ním.",
    "library.documentExists": "Dokument „{title}“ ({documentId}) už existuje. Nové znenie sa nahráva na jeho detaile, nie ako nový dokument — táto obrazovka zakladá nový dokument.",
    "library.documentKeyShape": "Kľúč dokumentu „{key}“ nemá správny tvar — smie mať len malé písmená bez diakritiky, číslice a podčiarkovníky.",
    "library.noOriginalFile": "Dokument nemá pôvodný súbor, ktorý by sa dal prepísať.",
    "library.onlyPdfRewrite": "Prepisovať sa dá len PDF — ostatné formáty sa prevedú priamo.",
    "library.originalNotFound": "Pôvodný súbor sa nenašiel.",
    "library.noDraft": "Žiadny návrh tu nie je.",
    "library.titleRequired": "Názov dokumentu je povinný — bez neho je v zozname len kľúč.",
    "library.emptyText": "Prázdny text sa uložiť nedá — dokument by nemal čo obsahovať.",
    "library.labelRequired": "Označenie znenia je povinné — objaví sa doslovne v každom zázname o potvrdení. Napíš to, čo je v dokumente (napríklad: úplné znenie z 27. 2. 2026), nie vymyslené číslo.",
    "library.effectiveFromRequired": "Dátum platnosti je povinný — bez neho sa znenie nedá potvrdiť (D6).",
    "meta.badDate": "Dátum v údajoch o znení nie je platný dátum.",
    "meta.approvedOnInFuture": "Dátum schválenia nemôže byť v budúcnosti.",
    "meta.noDraft": "Dokument nemá koncept — údaje o znení sa zadávajú pri novom znení.",
    "meta.locked": "Údaje o znení sa už meniť nedajú — koncept je na schválení alebo schválený. Zmena by zrušila schválenie; nahraj nové znenie.",
    "meta.effectiveFromApproved": "Dátum účinnosti bol schválený spolu so znením — zmeniť ho možno len novým znením a novým schválením.",
    "meta.effectiveFromRequired": "Pred predložením doplň v údajoch o znení dátum účinnosti.",
    "library.effectiveFromSourceRequired": "Zdroj dátumu platnosti je povinný — napíš, odkiaľ dátum je (napríklad uznesenie VV SFZ č. … z …). Po prvom potvrdení sa dátum už meniť nedá.",
    "library.documentHasNoText": "Dokument nemá text — najprv nahraj súbor alebo napíš znenie.",
    "library.noChunks": "Z textu nevznikol ani jeden úsek. Skontroluj, či má dokument členenie na články alebo nadpisy.",
    "library.faqNoEntries": "FAQ nemá ani jeden záznam — pridaj aspoň jednu otázku s odpoveďou.",
    "library.faqQuestionRequired": "Otázka je povinná — bez nej záznam nemá čo zodpovedať.",
    "library.faqAnswerRequired": "Odpoveď je povinná — otázka bez odpovede do FAQ nepatrí.",
    "library.faqTooLong": "Záznam je príliš dlhý — otázka do {question} a odpoveď do {answer} znakov.",
    "library.faqEntryNotFound": "Taký záznam v tomto FAQ nie je.",
    "library.faqSourceUnknown": "Zdrojový dokument {documentId} tu nie je.",
    "library.notFaq": "Tento dokument nie je FAQ.",
    "library.noPublishedVersion": "Dokument nemá publikované znenie — preindexovať sa dá len to, čo už je vonku.",
    "library.versionHasNoText": "Toto znenie nemá uložený text — nie je čo narezať.",
    "library.noChunksProfile": "Z textu nevznikol ani jeden úsek — skontroluj profil členenia.",
    "library.reindexWouldLoseArticles": "Preindexovanie by tento dokument pokazilo: dnes má {before} z {beforeTotal} úsekov s rozpoznaným článkom, po narezaní by ich malo {after} z {afterTotal}. Text v databáze má hlavičky v inom tvare, než aký chunker pozná — kým sa to neopraví, staré členenie je lepšie než nové.",
    "library.reasonRequired": "Dôvod opravy je povinný — bez neho sa o rok nedá zistiť, či išlo o preklep alebo o zmenu povinnosti.",
    "textFix.notContentManager": "Text znenia opravuje správca obsahu.",
    "textFix.noEffectiveVersion": "Dokument nemá platné znenie. Opraviť sa dá len to, čo je vonku — archivované znenie je doklad o tom, čo platilo vtedy.",
    "textFix.pastVersion": "Staršie znenie sa neopravuje — je to doklad o tom, čo vtedy platilo. Opraviť sa dá platné znenie a zverejnená novela, ktorá ešte neplatí.",
    "textFix.draftBusy": "Pripravuje sa nové znenie — oprava textu by prepísala rozpracovaný koncept. Najprv ho dokonči alebo zahoď.",
    "textFix.emptyText": "Koncept nemá text. Oprava, po ktorej nezostane nič, nie je oprava.",
    "textFix.draftChanged": "Koncept sa medzitým zmenil. Pozri si rozdiel znova — uložiť sa má to, čo si videl.",
    "textFix.noChange": "Text sa od platného znenia nelíši. Nie je čo opravovať.",
    "textFix.reasonRequired": "Dôvod opravy je povinný — bez neho sa o rok nedá zistiť, čo sa v znení zmenilo a prečo pri tom potvrdenia zostali platné.",
    "library.versionNotFound": "Také znenie tu nie je.",
    "versionFix.locked": "Označenie a dátum platnosti sa už meniť nedajú — toto znenie potvrdilo {count} ľudí a oba údaje sú v podpísanej formulke. Najprv treba odvolať potvrdenia tohto znenia, potom údaj opraviť a nechať ho potvrdiť znova.",
    "versionFix.reasonRequired": "Dôvod opravy je povinný.",
    "revocation.notHr": "Odvolať potvrdenie smie len personalista.",
    "revocation.nothingToRevoke": "Nie je čo odvolávať — toto znenie nemá platné potvrdenia.",
    "revocation.reasonRequired": "Dôvod odvolania je povinný — bez neho sa o rok nedá zistiť, prečo povinnosť ožila.",
    "write-failed": "Zápis zlyhal. Skús to znova; čo sa už zapísalo, zostáva platné.",

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
      "ai-settings": "umelá inteligencia",
      ticket: "ticket helpdesku",
      "helpdesk-channel": "kanál helpdesku",
      tenant: "tenant",
      track: "trasa",
      course: "kurz",
      enrollment: "zápis do kurzu",
      "smart-tag": "smart:tag",
      question: "otázka",
      test: "test",
      "test-attempt": "pokus o test",
      certificate: "certifikát",
    },
    actions: {
      created: "založené",
      membersAdded: "pridaní na trasu",
      memberRemoved: "odobratý z trasy",
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
      "chunking-profile": "profil členenia",
      "version-fix": "oprava znenia",
      "text-fix": "oprava textu znenia",
      "new-version": "nahraté nové znenie",
      "responsible-changed": "zmena zodpovednej osoby",
      "legal-basis": "právny základ",
      merged: "zlúčené",
      "imported": "importované",
      "reset": "resetované",
      "archived": "archivované",
      "validity-restored": "obnovená platnosť",
      "retired": "vyradené z ponuky",
      "course-version": "nová verzia kurzu",
    },
    fields: {
      folder: "priečinok",
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
    previewLabel: "Takto to bude vyzerať",
    previewButton: "Potvrdiť",
    previewChipKey: "Druh:",
    previewChip: "Norma",
    previewLink: "odkaz v texte",
    showCustom: "Zadať vlastnú hodnotu",
    hideCustom: "Skryť vlastnú hodnotu",
  },
  org: {
    heading: "Organizácia",
    introBefore: "Nastavenie, ktoré si spravujete sami. Kód organizácie (",
    introAfter: ") a vypnutie portálu tu zámerne nie sú — s tým sa ozvite nám.",
    tabsLabel: "Časti nastavenia",
    groups: { org: "Organizácia", access: "Prístup", documents: "Dokumenty", oversight: "Dohľad" },
    tabs: {
      general: "Všeobecné",
      departments: "Oddelenia",
      domains: "Domény",
      signin: "Prihlasovanie",
      codelists: "Číselníky",
      ai: "Umelá inteligencia",
      connectors: "Konektory",
      acknowledgements: "Potvrdzovanie",
      audit: "Audit",
      gdpr: "GDPR",
    },
    gdpr: {
      readOnly: "Tieto nastavenia upravuje zodpovedná osoba (DPO). Vidíte ich len na čítanie.",
      saveContact: "Uložiť kontakt",
      contactSaved: "Kontakt GDPR je uložený.",
      saved: "Nastavenia GDPR sú uložené.",
    },
    connectors: {
      intro: "Pripojenie k cudziemu MCP serveru s viacerými použitiami. Živý zdroj: asistent pri otázke hľadá aj na serveri a výsledok cituje ako neoverený. Import do knižnice a nástroje asistenta pribudnú.",
      none: "Zatiaľ žiadny konektor.",
      add: "Pridať konektor",
      edit: "Upraviť",
      name: "Názov",
      endpoint: "Adresa servera",
      endpointHint: "Úplná adresa MCP servera, napr. https://mcp.sportnet.online/mcp.",
      profile: "Profil servera",
      status: { new: "Nepripojený", connected: "Pripojený", disconnected: "Odpojený", error: "Chyba" },
      connectedBy: (by, date) => `Pripojil ${by} (${date}).`,
      connect: "Pripojiť",
      reconnect: "Pripojiť znova",
      disconnect: "Odpojiť",
      remove: "Odstrániť",
      removeConfirm: "Odstrániť konektor? Kanály, ktoré sa naň odkazujú, prídu o jeho rozsahy.",
      secRetrieval: "Živý zdroj",
      secRetrievalNote: "Pri otázke sa popri knižnici zavolá aj server. Výsledok obišiel kurátora, preto je v citácii označený ako neoverený.",
      retrievalOn: "Používať ako živý zdroj",
      defaultOn: "Používať predvolene pri otázke",
      defaultOnNote: "Vypnuté: na portáli sa predvolene hľadá len v knižnici a tento zdroj si človek zapne pilulkou pod otázkou. Kanálov sa to netýka — tam rozsah vyberá správca kanála.",
      ingestOn: "Povoliť import do knižnice",
      ingestNote: "Kurátor môže články zo servera uložiť ako koncepty dokumentov (Knižnica → Nahrať → Import zo servera).",
      accessLevel: "Prístupová úroveň",
      accessInternal: "Interná — len prihlásení na portáli",
      accessPublic: "Verejná — aj widget a návrhy odpovedí na tickety",
      accessHint: "Server dáva účtu všetko a verejné od interného nerozlíši — úroveň je vlastnosť konektora. Interný konektor sa do e-mailov nedostane.",
      secScopes: "Rozsahy",
      secScopesNote: "Pomenované výseky servera, ktoré si vyberajú kanály. Filter posiela server pred hľadaním.",
      scopesField: "Rozsahy",
      scopesHint: fields => `Jeden rozsah na riadok: kľúč | názov | ${fields}. Napríklad: issf | ISSF | project=issf`,
      secReduction: "Redukcia",
      secReductionNote: "Zúženie pre interných čitateľov, nie brána pre verejnosť. Všetko deterministické; prázdne polia nič nerežú.",
      dropSections: "Zahodiť sekcie",
      dropSectionsHint: "Nadpisy sekcií, jeden na riadok (napr. Key files, Data).",
      scrubPatterns: "Vzory v texte",
      scrubPatternsHint: "Regulárne výrazy, jeden na riadok; zhody sa nahradia […] (napr. T_[A-Z_]+).",
      skipPaths: "Vynechať cesty",
      skipPathsHint: "Regulárne výrazy nad cestou článku na serveri, jeden na riadok (napr. -rules-).",
      tools: "Nástroje servera",
      toolsNone: "Zoznam nástrojov sa načíta pri pripojení.",
      save: "Uložiť",
      saved: "Konektor je uložený.",
      created: "Konektor je založený — teraz ho pripojte.",
      removed: "Konektor je odstránený.",
      connected: "Konektor je pripojený.",
      disconnected: "Konektor je odpojený.",
      lastError: "Posledná chyba",
      personalAccountNote: "Pripojenie beží pod účtom toho, kto ho pripojil — server vidí to, čo ten účet. Keď server ponúkne servisný prístup, pripojí sa ním (ADR-029).",
    },
    ai: {
      intro: "Asistent, úprava otázok a prepis skenov používajú model Claude od spoločnosti Anthropic. Tu nastavíte, cez aký kľúč sa platí a ktoré modely sa použijú.",
      secProvider: "Poskytovateľ",
      provider: "Anthropic (Claude)",
      providerNote: "Zatiaľ jediný podporovaný poskytovateľ.",
      secKey: "API kľúč",
      secKeyNote: "S vlastným kľúčom platí volania organizácia priamo spoločnosti Anthropic. Bez neho sa použije kľúč prevádzkovateľa portálu.",
      keyLabel: "Nový kľúč",
      keyHint: "Pri uložení sa overí. Uložený kľúč sa už nikdy neukáže, len jeho koncovka. Prázdne pole kľúč nemení.",
      keyOwn: (hint, date, by) => `Nastavený je kľúč organizácie …${hint} (${date}, ${by}).`,
      keyOperator: "Organizácia nemá vlastný kľúč — používa sa kľúč prevádzkovateľa portálu.",
      keyNone: "Nie je nastavený žiadny kľúč — asistent ani prepis skenov nefungujú.",
      deleteKey: "Odstrániť kľúč",
      deleteKeyNote: "Volania potom pôjdu cez kľúč prevádzkovateľa portálu.",
      secModels: "Modely",
      secModelsNote: "Ktorý model sa použije na ktorú úlohu. Cena je za milión tokenov podľa cenníka Anthropic. Zmena platí od ďalšieho volania.",
      answer: "Odpovede asistenta",
      answerNote: "Silnejší model odpovedá presnejšie, ale pomalšie a drahšie. Sonnet 5.5 a Opus 5.5 pred odpoveďou premýšľajú — prvé slovo príde neskôr.",
      utility: "Úprava otázky",
      utilityNote: "Beží pred vyhľadávaním a čaká sa naň, preto len najrýchlejší model.",
      rewrite: "Prepis skenov PDF",
      rewriteNote: "Prepisuje skenované predpisy v knižnici do textu.",
      price: (input, output) => `vstup ${input} $ · výstup ${output} $`,
      save: "Uložiť",
      saved: "Nastavenie AI je uložené.",
      keyDeleted: "Kľúč organizácie je odstránený.",
    },
    aiUsage: {
      tabSettings: "Nastavenie",
      tabUsage: "Spotreba",
      from: "Od",
      to: "Do",
      person: "Osoba",
      purpose: "Účel",
      all: "všetky",
      apply: "Použiť",
      exportCsv: "Export CSV",
      exportXlsx: "Export Excel",
      calls: "Volaní",
      tokensIn: "Vstup",
      tokensOut: "Výstup",
      tokensCache: "Cache",
      total: "Suma",
      colWhen: "Dátum",
      colPerson: "Osoba",
      colWhat: "Na čo a prečo",
      colModel: "Model",
      colTokens: "Tokeny",
      colSum: "Suma",
      keyTenant: "kľúč organizácie",
      keyOperator: "kľúč prevádzkovateľa",
      failed: "zlyhalo",
      empty: "V tomto období sa AI nevolala",
      emptyText: "Skúste iné obdobie. Volania sa zapisujú od 5. 10. 2026.",
      capped: (shown, all) => `Zobrazených je ${shown} najnovších z ${all}. Celé obdobie je v exporte.`,
      note: "Suma je odhad podľa cenníka Anthropic v deň volania, v dolároch; presnú sumu povie faktúra. Znenie otázok sa neukladá. Záznamy sa držia 25 mesiacov.",
      purposes: {
        "answer": { label: "Odpoveď asistenta", why: "odpoveď na otázku s citáciami z predpisov" },
        "query-rewrite": { label: "Úprava otázky", why: "preformulovanie pred vyhľadávaním, aby sa našli správne články" },
        "query-classify": { label: "Výber spôsobu hľadania", why: "rozhodnutie medzi hľadaním podľa slov a podľa významu" },
        "pdf-rewrite": { label: "Prepis skenu PDF", why: "sken bez textovej vrstvy sa prepisuje do textu predpisu" },
        "markdown-clean": { label: "Úprava členenia textu", why: "obnovenie nadpisov a článkov v prevedenom texte" },
        "chunking-analysis": { label: "Analýza členenia", why: "návrh, ako dokument narezať na úseky pre vyhľadávanie" },
        "faq-mining": { label: "Ťažba FAQ", why: "návrhy záznamov FAQ z histórie schránky helpdesku (ADR-028)" },
      },
    },
    branding: {
      name: "Názov portálu",
      nameNote: "Ako sa portál volá — je v hlavičke, v e-mailoch a na prihlasovacej obrazovke (napríklad „Intranet SFZ“).",
      shortName: "Skratka",
      shortNameNote: "Do hornej lišty, kde je vedľa nej ešte menu — „SFZ“ tam povie to isté čo celý názov a nechá miesto na zvyšok.",
      logo: "Logo",
      logoCurrent: "súčasné logo",
      logoEmpty: "logo 512×512",
      logoNote: "PNG, JPEG alebo WebP, najviac 256 kB. Prázdne = nemeniť. V hlavičke má logo 26 px — väčší súbor nič nepridá.",
      logoRemove: "Odstrániť logo",
      logoRemoveNote: "Zmaže obrázok aj odkaz naň. V hlavičke zostane samotný názov organizácie. Dá sa vrátiť nahratím nového loga.",
      color: "Farba",
      colorNote: "Nesie ju tlačidlo s bielym textom, preto sú odtiene tmavšie, než by sa chcelo — svetlejší tón znamená nečitateľné tlačidlo.",
      supportEmail: "Kontaktná adresa",
      supportEmailNote: "Kam sa má obrátiť človek, ktorému niečo nesedí.",
      phonePrefix: "Predvolená krajina telefónu",
      phonePrefixNote: "Ponúkne sa pri telefóne osoby a jej predvoľba sa doplní k číslam z importu zadaným s nulou (0905 123 456). Nie je to telefón organizácie.",
      controller: "Prevádzkovateľ osobných údajov",
      controllerNote: "Ukazuje sa v informovaní o ochrane osobných údajov (stránka Ochrana osobných údajov). Prázdny právny názov = použije sa názov portálu.",
      controllerLegalName: "Právny názov",
      controllerAddress: "Sídlo",
      controllerRegistrationNumber: "IČO",
      controllerCountry: "Krajina sídla",
      countries: { SK: "Slovensko", CZ: "Česko" },
      secIdentity: "Názov portálu",
      secIdentityNote: "Názov a logo v hlavičke, v e-mailoch a na prihlasovacej obrazovke. Pod nimi organizácia, ktorá portál prevádzkuje a spracúva osobné údaje.",
      secContact: "Kontakt",
      secGdpr: "GDPR",
      secGdprNote: "Kontakt pre ochranu osobných údajov na stránke Ochrana osobných údajov. Sem ľudia pošlú námietku alebo žiadosť e-mailom. Prázdne = ukážu sa osoby s rolou DPO.",
      gdprName: "Meno a priezvisko",
      gdprEmail: "E-mailová adresa",
      gdprEmailNote: "Spoločná schránka (napr. gdpr@…), nie osobná adresa — zostane, aj keď sa DPO zmení.",
      secAutoProvision: "Automatické založenie",
      saveBarNote: "Jedno uloženie pre celú stránku.",
      controllerPreview: "Na stránke Ochrana osobných údajov:",
      invitePreview: "V pozvánke:",
      languages: "Jazyky",
      defaultLanguage: "Predvolený jazyk",
      defaultLanguageNote: "Platí pre človeka, ktorý ešte nie je prihlásený.",
      autoProvision: "Domény pre automatické založenie",
      autoProvisionBefore: "Jedna na riadok. Kto sa prihlási ",
      autoProvisionHighlight: "pracovným kontom",
      autoProvisionAfter: " z tejto domény a v zozname osôb ešte nie je, založí sa sám ako bežný člen — bez rolí a bez trás. Platí len pre kontá, nie pre odkaz v e-maile.",
      autoProvisionNotHosts: "Sú to e-mailové domény pracovných kont (meno@futbalsfz.sk), nie webové adresy portálu — tie sú v záložke Domény.",
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
      requestOpen: "Požiadať o doménu",
      cancel: "Zrušiť",
      pendingHeading: n => `Čakajú na overenie · ${n}`,
      pendingNote: "Overenie sa dá spustiť, keď je záznam DNS nastavený. Zmena DNS sa môže prejaviť až po niekoľkých hodinách.",
      removeOpen: "Odstrániť…",
      removeConfirm: h => `Odstrániť doménu ${h}? Ľudia, ktorí na portál chodia cez túto adresu, sa naň nedostanú.`,
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
      removeOwnTitle: p => `Odstrániť vlastné prihlásenie cez ${p}`,
      removeOwnNote: "Prihlásenie sa vráti na nastavenie od dodávateľa, ak ho má; inak tlačidlo z prihlasovacej obrazovky zmizne.",
      removeOpen: "Odstrániť…",
      cancel: "Zrušiť",
    },
    codelists: {
      show: "Zobraziť",
      pick: "Číselník",
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
        workplace: {
          name: "Pracoviská",
          hint: "Mestá a obce, kde ľudia štandardne vykonávajú prácu — vyberá sa z nich na karte osoby.",
        },
      },
      base: " · základná",
      used: (n) => ` · použitá ${n}×`,
      remove: "Odobrať",
      newItemPlaceholder: "Metodický pokyn",
      newItemLabel: (codelist) => `Názov novej položky — ${codelist}`,
      key: "Kľúč",
      keyPlaceholder: "metodicky_pokyn",
      keyTakenHint: "Taký kľúč už v číselníku je — zmeň názov alebo kľúč.",
      add: "Pridať",
      keyNote: "Kľúč: malé písmená bez diakritiky, číslice a podčiarkovník. Zostáva v obsahu natrvalo, takže sa nedá vziať späť — názov vedľa neho sa meniť dá.",
      examples: {
        category: { label: "napr. Rozhodnutie", key: "rozhodnutie" },
        tags: { label: "napr. mládež", key: "mladez" },
        workplace: { label: "napr. Senec", key: "senec" },
      },
      moreBase: n => `+ ďalších ${n} základných`,
      colName: "Názov",
      colKey: "Kľúč",
      colUse: "Použitie",
      baseBadge: "základná",
    },
    acknowledgements: {
      heading: "Potvrdzovanie",
      intro: "Termín potvrdenia sa nastavuje pri každom pridelení a na každej trase. Tu je len prah pre personalistu: po koľkých dňoch bez potvrdenia je človek v Pripomienkach a v týždennom súhrne medzi meškajúcimi.",
      overdueDays: "Meškajúci po (dňoch)",
      overdueDaysNote: "Počíta sa od vzniku povinnosti — pridelenia, príchodu do oddelenia alebo pridania na trasu. Ľuďom samotným sa podľa toho nič neposiela. Predvolené je 14.",
      save: "Uložiť",
    },
    actions: {
      saved: "Zmeny boli uložené.",
      failed: "Zmenu sa nepodarilo uložiť. Skús to znova.",
      confirmCode: (code) => `Na odstránenie napíš kód organizácie (${code}).`,
      signInRemoved: "Prihlasovacie údaje odstránené.",
      logoRemoved: "Logo odstránené.",
      domainRequested: "Zapísané. Teraz nastavte CNAME u svojho správcu DNS a dajte overiť.",
      domainNotFound: "Takú žiadosť tu nemáme.",
      domainWaiting: (host) =>
        `${host} zatiaľ nesmeruje na nás. Zmena DNS býva viditeľná do hodiny;` +
        " ak je to dlhšie, skontrolujte CNAME.",
      domainOnNotInVercel: (host) => `${host} je zapnutá, ale do Vercelu sa nepridala — ozvite sa nám.`,
      domainOn: (host) => `${host} je zapnutá. Portál na nej odpovedá.`,
      domainRemoved: "Doména odstránená. Portál na nej prestal odpovedať.",
      codelistRemoved: "Odobraté z ponuky. Dokumenty, ktoré túto hodnotu majú, si ju nesú ďalej.",
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
      internal: "interný (funkcionár, komisia…)",
      employee: "zamestnanec",
      external: "externý — len cez cudzí systém, bez prístupu do intranetu",
    },
    genders: { male: "muž", female: "žena", none: "nevyplnené" },
    languages: {
      sk: "slovenčina",
      cs: "čeština",
      en: "angličtina",
    },
    roles: {
      hr: "hr — prideľuje normy a vidí, kto ich nepotvrdil",
      "people-admin": "people-admin — spravuje osoby (táto obrazovka)",
      "content-admin": "content-admin — nahráva a upravuje normy v knižnici",
      evaluator: "evaluator — posudzuje odpovede systému, keď niekto povie, že nesedia",
      dpo: "dpo — zodpovedná osoba: kontroluje právne základy, rozhoduje o námietkach",
      "learning-admin": "learning-admin — lektor: spravuje kurzy, banku otázok a testy",
      helpdesk: "helpdesk — riešiteľ: odpovedá na tickety svojich kanálov a navrhuje záznamy do FAQ",
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
      emptyTitle: "Zatiaľ žiadne osoby",
      emptyText: "Prvú pridáte tlačidlom vyššie, alebo naraz importom z CSV.",
      emptyFilterTitle: "Filtru nič nevyhovuje",
      emptyFilterText: "Skúste časť mena alebo e-mailu.",
      clearFilter: "Zrušiť filter",
      count: (n) => `${n} ${n === 1 ? "osoba" : n < 5 ? "osoby" : "osôb"}`,
      matchesSearch: " vyhovuje hľadaniu",
      capped: " — zobrazených prvých 500, zúž hľadanie",
      status: {
        new: "nová",
        invited: "pozvaná",
        active: "aktívna",
        inactive: "vyradená",
      },
      neverSignedIn: "neprihlásená",
    },
    inviteAll: {
      heading: "Hromadné pozvánky",
      intro: "Ľudia, ktorí sa ešte ani raz neprihlásili. E-mail nesie odkaz na portál, nie prihlasovací odkaz — ten platí len krátko a poštové brány ho spotrebujú skôr, než sa k nemu človek dostane.",
      emptyTitle: "Všetci sú pozvaní",
      none: "Nikto nečaká na pozvánku — všetci sa už aspoň raz prihlásili.",
      preview: "Toto pôjde na uvedené adresy. Odoslaný e-mail sa odvolať nedá.",
      send: people => people === 1 ? "Odoslať 1 pozvánku" : people >= 2 && people <= 4 ? `Odoslať ${people} pozvánky` : `Odoslať ${people} pozvánok`,
      sent: n => `Odoslané: ${n}.`,
      nobody: "Nie je koho pozývať.",
      open: "Hromadné pozvánky",
    },
    invite: {
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
      gender: "Pohlavie",
      genderNote: "Na štatistiky zloženia a na gramatiku textov (napr. „absolvoval / absolvovala“ na certifikáte). Z mena sa nehádá.",
      submit: "Pozvať",
    },
    import: {
      heading: "Import z CSV",
      introBefore: "Najprv uvidíš, ",
      introHighlight: "čo by sa stalo",
      introMiddle: ", a zapíše sa až potom. Nahratie stovky ľudí naslepo je presne tá operácia, po ktorej sa hľadá, ako to vrátiť späť — a vrátiť sa nedá. Všetci sa zapíšu do organizácie ",
      introAfter: ", aj keď je v súbore niečo iné.",
      existingTitle: "Kto už v systéme je, sa nezaloží znova",
      existingNote: "Spáruje sa podľa e-mailu a doplnia sa mu len prázdne polia. Čo už má, ostáva — aj keď súbor nesie inú hodnotu. Stav, jazyk, roly ani skupiny sa nemenia. Import nikoho nevyradí.",
      overwriteLabel: "Aktualizovať existujúcich hodnotami zo súboru",
      overwriteNote: "Stĺpec, ktorý súbor má, prepíše hodnotu existujúcej osobe — a prázdna bunka ju vymaže: prázdne „skupiny“ znamenajú, že ten človek do žiadnej nepatrí. Čo v súbore nie je, zostáva nedotknuté.",
      file: "Súbor CSV",
      fileNoteBefore: "Prvý riadok sú hlavičky. Rozpoznajú sa ",
      fileNoteAfter: " — aj bez diakritiky a s bodkočiarkou ako oddeľovačom, tak ako to ukladá Excel.",
      reading: "Čítam…",
      whatHappens: (name) => `Čo sa stane — ${name}`,
      rows: "Riadkov",
      willAdd: "Pribudne",
      willUpdate: (overwrite) => overwrite ? "Existuje — aktualizuje sa" : "Existuje — doplní sa",
      invalid: "Chybných",
      unchanged: "Bez zmeny",
      statuses: { new: "Nová", fill: "Doplní sa", overwrite: "Zmení sa", unchanged: "Bez zmeny", error: "Chyba" },
      fields: {
        fullName: "meno a priezvisko", givenName: "meno", surname: "priezvisko", titleBefore: "titul pred menom", titleAfter: "titul za menom",
        jobTitle: "pozícia", mobilePhone: "mobil", workplace: "pracovisko", department: "oddelenie", personType: "typ osoby",
        startDate: "nástup", tracks: "trasy", groups: "skupiny", roles: "roly", language: "jazyk", gender: "pohlavie",
      },
      colStatus: "Stav",
      colPerson: "Osoba",
      colChanges: "Čo sa zapíše",
      filterAll: "Všetko",
      noRowsForFilter: "Tomuto filtru nevyhovuje žiadny riadok.",
      searchPlaceholder: "Hľadať v mene alebo adrese",
      nothingToWrite: "nič — všetko už má",
      emptyValue: "—",
      unknownWorkplaces: "Pracoviská, ktoré v číselníku nie sú — tieto riadky prejdú, len bez pracoviska:",
      unknownTracks: "Trasy, ktoré v organizácii nie sú (stĺpec trasy čaká názov trasy) — tieto riadky prejdú, len bez nich:",
      badPhones: "Čísla, ktoré sa nedali prečítať — tieto riadky prejdú, len bez telefónu:",
      statusNoteBefore: "Existujúcim osobám sa ",
      statusNoteHighlight: "nemení stav",
      statusNoteAfter: " — kto sa už prihlásil, zostáva prihlásený. Stĺpec, ktorý v súbore nie je, sa neprepíše: jazyk, skupiny, trasy ani roly sa nestratia.",
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
      previously: (list) => `predtým ${list}`,
      invitedNotSignedIn: "pozvaná, ešte sa neprihlásila",
      newNotInvited: "nová — pozvánka jej ešte neodišla",
      inviteNoteSent: (date) => `Pozvánka odišla ${date}.`,
      excludedNoSignIn: "vyradená — neprihlási sa",
      lastSeen: (when) => `naposledy ${when}`,
      never: "—",
      signsInVia: (list) => `prihlasuje sa cez ${list}`,
      email: "E-mailová adresa",
      emailNote: "Zmeniť sa dá — identita človeka na nej nestojí. Potvrdenia sa viažu na jeho záznam, nie na adresu, takže história zostáva celá a stará adresa sa uloží do jeho histórie. Zmení sa tým to, kam chodí prihlasovací odkaz; prihlásenie pracovným kontom funguje ďalej.",
      fullName: "Meno",
      givenName: "Meno",
      surname: "Priezvisko",
      nameNote: "Z mena a priezviska sa skladá celé meno. Práve to sa zapíše do potvrdenia, ktoré človek podpíše — preto tituly do neho nevstupujú.",
      nameMissing: "Meno a priezvisko tu ešte nie sú rozdelené. Doplňte ich — celé meno sa potom poskladá z nich.",
      titleBefore: "Titul pred menom",
      titleAfter: "Titul za menom",
      titlesNote: "Evidenčné údaje. V potvrdeniach a v audite nie sú zámerne: titul pribudne počas života a ten istý človek by potom v starých záznamoch vystupoval pod iným menom.",
      jobTitle: "Pozícia",
      jobTitleNote: "Evidenčný údaj. Dopĺňa sa z pracovného konta, keď ho tam adresár má — ale len keď je tu prázdny, takže ručná oprava vydrží.",
      mobilePhone: "Mobilný telefón",
      mobilePhoneCountry: "Krajina telefónu",
      mobilePhoneNote: "Vidí ho každý prihlásený v organizácii. Vyberte krajinu a číslo napíšte tak, ako sa v nej píše (0905 123 456); uloží sa medzinárodne.",
      workplace: "Pracovisko",
      workplaceNone: "— bez pracoviska —",
      workplaceNote: "Mesto alebo obec, kde človek štandardne vykonáva prácu. Vyberá sa zo zoznamu, aby sa podľa neho dalo filtrovať.",
      noWorkplacesBefore: "Zoznam pracovísk je zatiaľ prázdny — ",
      noWorkplacesLink: "doplňte ich v číselníkoch",
      noWorkplacesAfter: ".",
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
      personTypeNote: "Kto človek je voči organizácii. Druh „externý“ sa do intranetu neprihlási (ADR-028); o prístupe k obsahu rozhoduje organizácia a úroveň dokumentu. Rozhodcovia a funkcionári sú skupiny, nie druh.",
      language: "Jazyk prostredia",
      languageNote: "V čom sa s človekom rozprávame. Nie jazyk dokumentov, ktoré číta.",
      gender: "Pohlavie",
      genderNote: "Na štatistiky zloženia a na gramatiku textov (napr. „absolvoval / absolvovala“ na certifikáte). Z mena sa nehádá.",
      groups: "Skupiny",
      newGroup: "nová skupina, napr. rozhodcovia",
      groupsNote: "Podľa nich sa prideľujú normy. Číslo je počet ľudí, ktorí skupinu majú — skupina, ktorú nemá nikto, nedostane nič.",
      tracks: "Trasy",
      noTracks: "Zatiaľ nie je žiadna trasa. Zakladajú sa v Pridelené dokumenty → Trasy.",
      trackInactive: "vypnutá",
      trackUnknown: "neznáma trasa (zrušte zaškrtnutie, ak ju osoba nemá mať)",
      roles: "Roly",
      rolesNote: "Správcu platformy sa odtiaľto prideliť nedá — patrí tenantovi dodávateľa a má vlastnú cestu.",
      save: "Uložiť",
      evidenceEmptyTitle: "Žiadne pridelené dokumenty",
      evidenceEmptyText: "Tejto osobe zatiaľ nikto nepridelil normu na potvrdenie.",
      accessSummary: "Prístup a členstvo",
      returnHeading: "Vrátiť osobu",
      excludeHeading: "Vyradiť osobu",
      inviteHeading: "Pozvánka",
      inviteNote: "Táto osoba sa ešte ani raz neprihlásila. Pozvánka nesie odkaz na portál — prihlási sa ním cez pracovné konto alebo si vyžiada odkaz na e-mail.",
      inviteNoteSince: (date) => `Zapísaná ${date}.`,
      inviteSubmit: "Poslať pozvánku znovu",
      inviteSubmitFirst: "Poslať pozvánku",
      returnNoteBefore: "Vráti sa ako ",
      returnNoteHighlight: "pozvaná",
      returnNoteAfter: ", nie aktívna — aktívna znamená „už sa prihlásila“ a to sa vrátením nestalo. Prepne ju prvé prihlásenie.",
      returnSubmit: "Vrátiť",
      excludeNote: "Po vyradení sa neprihlási — okamžite. Záznam a jej potvrdenia zostávajú ako doklad o tom, čo si prečítala; zmažú sa 3 roky po skončení vzťahu so zväzom (ADR-012).",
      confirmLabel: "Napíš adresu na potvrdenie",
      confirmNote: "Zámerne to nie je „naozaj?“ — to sa odklikne skôr, než sa prečíta.",
      excludeSubmit: "Vyradiť",
      endedAtLabel: "Vzťah so zväzom skončil (nepovinné)",
      endedAtNote: "Koniec pracovného pomeru, licencie, funkcie alebo spolupráce. Od tohto dátumu plynie 3-ročná lehota uchovania potvrdení; keď ho nevyplníš, plynie odo dňa vyradenia.",
      endedAtHeading: "Skončenie vzťahu",
      deactivatedOn: (date) => `Vyradená ${date}.`,
      endedAtCurrent: (date) => `Vzťah skončil ${date}.`,
      endedAtMissing: "Dátum skončenia nie je vyplnený — lehota plynie odo dňa vyradenia.",
      endedAtSubmit: "Uložiť dátum",
      tlDeactivate: "Vyradenie",
      tlDeactivateSub: "dnes · neprihlási sa",
      tlEnded: "Vzťah skončil",
      tlEndedSub: "dátum nižšie · nevyplnený → od vyradenia",
      tlRetention: n => `+ ${n} roky`,
      tlRetentionSub: "potvrdenia sa zmažú",
      factDeactivated: "Vyradená",
      factEnded: "Vzťah skončil",
      factDeleteFrom: "Potvrdenia sa zmažú od",
    },
    actions: {
      saved: "Uložené.",
      invited: "Pozvaná — pozvánka jej odišla na e-mail.",
      invitedNoEmail: "Osoba je zapísaná, ale pozvánka jej neodišla. Skús ju poslať znovu z jej karty.",
      inviteResent: (email) => `Pozvánka odoslaná na ${email}.`,
      inviteFailed: "Pozvánku sa nepodarilo odoslať. Skús to o chvíľu znova.",
      inviteNotNeeded: "Táto osoba už bola prihlásená — pozvánku nepotrebuje.",
      excluded: "Vyradená. Záznam a jej potvrdenia zostávajú.",
      returned: "Vrátená. Prihlási sa a stav sa prepne sám.",
      endedAtSaved: "Dátum skončenia uložený.",
      confirmAddress: (email) => `Na vyradenie napíš adresu (${email}).`,
      failed: "Zmenu sa nepodarilo uložiť. Skús to znova.",
      noRight: "Nemáš na to právo.",
      fileEmpty: "Súbor je prázdny.",
      noRows: "V súbore nie je ani jeden riadok s údajmi. Má prvý riadok hlavičky?",
      importResult: (created, updated, unchanged, invalid, overwrite) =>
        `Pribudlo ${created}, ${overwrite ? "zmenených" : "doplnených"} ${updated}, bez zmeny ${unchanged}` +
        (invalid ? `, chybných ${invalid}` : "") + ".",
    },
    search: {
      placeholder: "Hľadať meno, e-mail alebo oddelenie",
      label: list => `Hľadať v zozname: ${list}`,
      count: (shown, total) => `${shown} z ${total}`,
      picked: n => `Vybraní (${n})`,
      pickedOne: "Vybraná",
      none: query => `Nikto nevyhovuje „${query}“.`,
      noneApprovers: "Vyradení sa neponúkajú a seba schváliť nemôžeš.",
      noneResponsible: "Vyradení sa neponúkajú.",
      clear: "Zrušiť hľadanie",
      clearInput: "Vyčistiť",
      remove: name => `Odobrať ${name}`,
      keysDown: "do zoznamu",
      keysEnter: "vyberie jediný výsledok",
      keysEnterOne: name => `vyberie ${name}`,
      keysEsc: "vyčistí",
    },
  },
  report: {
    open: "Nahlásiť nepresnosť",
    whatIsWrong: "Čo je na odpovedi zle?",
    placeholder: "Napríklad: odvoláva sa na zrušený článok; vynechala výnimku v ods. 3; našla iný predpis.",
    note: "Uloží sa aj tvoja otázka, odpoveď a zdroje, ktoré systém použil — bez nich sa nedá rozlíšiť, či našiel zlý predpis, alebo správny a zle ho prečítal.",
    submit: "Odoslať hlásenie",
    sending: "Odosielam…",
    thanks: "Ďakujeme. Hlásenie sme zapísali aj s otázkou a zdrojmi.",
    failed: "Hlásenie sa nepodarilo odoslať. Skús to prosím znova.",
  },
  notifications: {
    title: "Upozornenia",
    // Tri tvary, nie jeden: „1 neprečítaných" je chyba, ktorú vidno na prvý
    // pohľad a ktorú test na paritu kľúčov nechytí.
    bellLabel: (unread) => unread > 0 ? `Upozornenia — ${unreadWord(unread, "sk")}` : "Upozornenia",
    unread: (n) => unreadWord(n, "sk"),
    emptyTitle: "Žiadne upozornenia",
    emptyText: "Objaví sa tu, keď sa zverejní znenie, rozpošlú pripomienky alebo dobehne preindexovanie.",
    markAllRead: "Označiť všetko ako prečítané",
    allRead: (n) => `Označené ako prečítané: ${n}.`,
    retentionNote: (days) => `Upozornenia sa po ${days} dňoch mažú.`,
    kinds: {
      reindexed: (title, chunks) =>
        `Dokument „${title}" je preindexovaný — ${chunks} ${chunks === 1 ? "úsek" : chunks < 5 ? "úseky" : "úsekov"}.`,
      rewritten: (title) => `Prepis dokumentu „${title}" modelom dobehol. Text si prečítaj, než ho prijmeš.`,
      remindersSent: (count) =>
        `Rozposlané pripomienky: ${count} ${count === 1 ? "správa" : count < 5 ? "správy" : "správ"}.`,
      versionPublished: (title, label) => `Zverejnené znenie „${label}" dokumentu „${title}".`,
      responsibleAssigned: (title, label) => `Ste zodpovedná osoba za znenie „${label}" dokumentu „${title}". Určte právny základ.`,
      draftResponsibleAssigned: (title) => `Ste zodpovedná osoba za pripravované znenie dokumentu „${title}". Právny základ môžete určiť ešte pred zverejnením.`,
      objectionSubmitted: () => "Nová námietka (čl. 21) čaká na vaše rozhodnutie.",
    },
  },
  responsibility: {
    responsiblePerson: "Zodpovedná osoba",
    responsibleNote: "Na ňu sa budú obracať ľudia, ktorí znenie potvrdzujú, a ona určí právny základ. Pri každom novom znení sa určuje znova — z predošlého sa nepreberá.",
    choosePerson: "— vyber osobu —",
    noResponsible: "Znenie nemá určenú zodpovednú osobu.",
    inactiveResponsible: "Zodpovedná osoba už nie je aktívna — treba určiť novú.",
    setResponsible: "Určiť zodpovednú osobu",
    changeResponsible: "Zmeniť zodpovednú osobu",
    changeReason: "Dôvod zmeny",
    changeReasonPlaceholder: "Napríklad: pôvodná zodpovedná osoba odišla zo zväzu",
    saveResponsible: "Uložiť zodpovednú osobu",
    responsibleHistory: n => (n === 1 ? "1 zmena zodpovednej osoby" : n >= 2 && n <= 4 ? `${n} zmeny zodpovednej osoby` : `${n} zmien zodpovednej osoby`),
    responsibleChangeLine: (by, date, from, to) => `${by} · ${date} · ${from} → ${to}`,
    responsibleSaved: "Zodpovedná osoba bola uložená.",
    legalBasis: "Právny základ",
    basisLabel: {
      legal_obligation: "Plnenie zákonnej povinnosti",
      legitimate_interest: "Oprávnený záujem",
    },
    basisHint: {
      legal_obligation: "Povinnosť oboznámiť sa vyplýva zo zákona — napríklad predpisy BOZP.",
      legitimate_interest: "Interná smernica bez výslovnej zákonnej opory.",
    },
    basisUnset: "neurčený",
    basisMissing: "Právny základ zatiaľ nie je určený.",
    reference: "Odkaz na predpis",
    referencePlaceholder: "Napríklad § 7 ods. 3 zákona č. 124/2006 Z. z.",
    referenceNote: "Pri zákonnej povinnosti povinný.",
    basisReason: "Dôvod zmeny",
    basisReasonNote: "Povinný pri zmene už určeného základu — potvrdenia, ktoré medzitým vznikli, si nesú pôvodný.",
    saveBasis: "Uložiť právny základ",
    basisWho: "Právny základ určuje zodpovedná osoba znenia alebo správca obsahu.",
    basisHistory: n => (n === 1 ? "1 zmena právneho základu" : n >= 2 && n <= 4 ? `${n} zmeny právneho základu` : `${n} zmien právneho základu`),
    basisChangeLine: (by, date, from, to) => `${by} · ${date} · ${from} → ${to}`,
    basisInPreparation: "určené v príprave",
    basisSaved: "Právny základ bol uložený.",
    contactHeading: "S otázkami k predpisu sa obráťte na",
    contactProfile: "profil v adresári",
    contactGone: "Zodpovedná osoba už nie je aktívna. S otázkami sa zatiaľ obráťte na personálne oddelenie.",
    yourTaskHeading: "Ste zodpovedná osoba za toto znenie",
    yourTaskNote: "Určte, na akom právnom základe sa spracúvajú záznamy o oboznámení s týmto znením.",
    draftTaskHeading: "Pripravované znenie — ste zodpovedná osoba",
    draftTaskNote: "Znenie ešte nie je zverejnené. Právny základ môžete určiť už teraz a pri zverejnení sa prenesie do znenia. Kým sa nezverejní, dá sa zmeniť bez udania dôvodu.",
    draftBasisSummary: "Právny základ pripravovaného znenia",
    draftEffective: (date) => `Účinnosť od ${date}`,
    draftNewTitle: (title) => `Nový názov: „${title}"`,
    draftText: "Text pripravovaného znenia",
    draftOpenPdf: "PDF nového znenia",
    draftBasisSaved: "Právny základ pripravovaného znenia bol uložený. Pri zverejnení sa prenesie do znenia.",
    pendingTaskHeading: (date) => `Znenie účinné od ${date} — ste zodpovedná osoba`,
    pendingTaskNote: "Znenie je zverejnené, ale ešte nie je účinné. Určte právny základ, nech ho znenie má od prvého dňa účinnosti.",
    pendingBasisSummary: (date) => `Právny základ znenia účinného od ${date}`,
    basisPageLead: "Ste zodpovedná osoba za znenie tohto predpisu. Tu určíte právny základ, na ktorom sa spracúvajú záznamy o oboznámení.",
    basisPageRead: "Otvoriť predpis na čítanie",
    missingBasisTag: "bez právneho základu",
    missingBasisNote: "Predpis bez právneho základu sa prideliť dá. Zodpovedná osoba by ho však mala určiť ešte pred ostrou prevádzkou.",
    missingOptionNote: "Chýba vhodná položka? Požiadajte správcu organizácie, aby ju doplnil do číselníka právnych základov.",
    multipleNote: "Vyberte jeden alebo viac — aj z oboch skupín. Keď je medzi nimi zákonná povinnosť, záznam o potvrdení sa na námietku nemaže.",
    outsideCodelist: "mimo číselníka",
    orgHeading: "Právne základy",
    orgHint: "Z tohto zoznamu vyberá zodpovedná osoba právny základ pri každom znení predpisu. Štandardné položky sa dajú skryť, vlastné vyradiť — nič sa nemaže, znenia si nesú kópiu.",
    standardTag: "štandardná",
    customTag: "vlastná",
    hiddenTag: "skrytá",
    retiredTag: "vyradená",
    hide: "Skryť",
    unhide: "Vrátiť",
    retire: "Vyradiť",
    addHeading: "Pridať právny základ",
    labelField: "Názov",
    labelPlaceholder: "Napríklad: Dopingová kontrola",
    keyField: "Kľúč",
    keyPlaceholder: "napr. doping",
    categoryField: "Kategória",
    referenceField: "Odkaz na predpis",
    addButton: "Pridať",
    usedIn: n => (n === 1 ? "1 znenie" : n >= 2 && n <= 4 ? `${n} znenia` : `${n} znení`),
  },
  helpdesk: {
    heading: "Helpdesk",
    intro: "Tickety kanálov, ktorých si riešiteľom. Návrh odpovede pripraví asistent z noriem a FAQ kanála; odošleš ho ty, nikdy nie systém sám.",
    noChannels: "Nie si riešiteľom žiadneho kanála. Správca organizácie ťa pridá medzi riešiteľov v Kanáloch.",
    viewOpen: "Otvorené",
    viewSent: "Odpovedané",
    viewClosed: "Zavreté",
    viewAll: "Všetky",
    empty: "Žiadne tickety.",
    colSubject: "Predmet",
    colAsker: "Pýta sa",
    colChannel: "Kanál",
    colState: "Stav",
    colUpdated: "Zmenené",
    colMessages: "Správ",
    state: { new: "nový", drafted: "s návrhom", sent: "odpovedaný", closed: "zavretý", reopened: "znovu otvorený" },
    source: { chat: "chat", email: "e-mail" },
    mine: "moje",
    unassigned: "nikto",
    assignedTo: (name: string) => `rieši ${name}`,
    take: "Prevziať",
    release: "Uvoľniť",
    thread: "Vlákno",
    quotedHistory: "Predchádzajúca korešpondencia v e-maile",
    threadSummary: (n: number, lastFrom: string, lastAt: string) => `${n} ${n < 5 ? "správy" : "správ"} · posledná: ${lastFrom}, ${lastAt}`,
    threadImport: "Dotiahnuť históriu vlákna",
    threadImportHint: "Načíta zo schránky skoršie správy tohto vlákna — prijaté aj odoslané, aj spred spustenia synchronizácie.",
    msgThreadImported: (n: number) => n ? `Doplnené správy z vlákna: ${n}.` : "Vlákno je úplné — v schránke nie sú ďalšie správy.",
    fromHelpdesk: "Helpdesk",
    fromAsker: (name: string) => name || "Pýtajúci sa",
    attachments: (n: number) => (n === 1 ? "1 príloha (v schránke)" : `${n} príloh (v schránke)`),
    draftHeading: "Odpoveď",
    draftIntro: "Asistent navrhne odpoveď z noriem a FAQ kanála. Uprav ju a odošli — rozdiel medzi návrhom a odoslaným textom je to, z čoho sa systém učí.",
    draftFromAi: "Navrhnúť odpoveď asistentom",
    draftMeta: (model: string, when: string) => `návrh ${model}, ${when}`,
    noDraft: "Zatiaľ bez návrhu.",
    draftSources: "Zdroje návrhu",
    answer: "Text odpovede",
    answerHint: "Odíde ako čistý text z adresy schránky kanála. Bez pozdravu a podpisu, ak ich nechceš — pridáva sa nič.",
    saveDraft: "Uložiť návrh",
    send: "Odoslať odpoveď",
    sendHint: "Odošle e-mail pýtajúcemu sa a ticket označí ako odpovedaný.",
    sent: (by: string, when: string) => `odoslané ${when} (${by})`,
    sentUnchanged: "návrh odišiel bez zmeny",
    sentEdited: "návrh bol pred odoslaním upravený",
    close: "Zavrieť ticket",
    reopen: "Znovu otvoriť",
    toFaq: "Pridať do FAQ",
    toFaqIntro: "Z odoslanej odpovede vznikne záznam v koncepte FAQ dokumentu. Pred uložením odstráň mená a údaje konkrétnej osoby; schváli to správca obsahu.",
    toFaqDocument: "FAQ dokument",
    toFaqSubmit: "Uložiť do konceptu FAQ",
    toFaqDone: "Záznam je v koncepte FAQ.",
    noFaqDocuments: "V knižnici ešte nie je FAQ dokument.",
    noMailbox: "Kanál nemá schránku — odpoveď sa nedá odoslať e-mailom.",
    msgDrafted: "Návrh je pripravený. Skontroluj ho pred odoslaním.",
    msgDraftSaved: "Návrh je uložený.",
    msgSent: "Odpoveď je odoslaná.",
    msgTaken: "Ticket je tvoj.",
    msgReleased: "Ticket je uvoľnený.",
    msgClosed: "Ticket je zavretý.",
    msgReopened: "Ticket je znovu otvorený.",
    aiFailed: "Asistent návrh nepripravil — skús to o chvíľu alebo napíš odpoveď sám.",
  },
  widget: {
    open: "Opýtať sa",
    title: "Pomocník",
    placeholder: "Napíš otázku…",
    send: "Odoslať",
    thinking: "Hľadám v predpisoch…",
    sources: "Zdroje",
    helpful: "Pomohlo",
    notHelpful: "Nepomohlo",
    thanks: "Ďakujeme.",
    tryAgain: "Skús otázku položiť inak, alebo napíš helpdesku.",
    noAnswer: "V predpisoch a častých otázkach som na to nenašiel odpoveď.",
    escalateIntro: "Asistent ti nepomohol. Napíš helpdesku — odpovie človek e-mailom na tvoju adresu.",
    escalateMessage: "Čo potrebuješ vyriešiť",
    escalateSubmit: "Odoslať helpdesku",
    escalated: "Správa je odoslaná. Helpdesk odpovie e-mailom.",
    error: "Niečo sa pokazilo. Skús to o chvíľu.",
    expired: "Prihlásenie vypršalo — obnov stránku.",
    poweredBy: "Contineo",
  },
  channels: {
    heading: "Kanály",
    kinds: { widget: "Widget", portal: "Portál" },
    kindHints: { widget: "Vložiteľný do cudzej stránky namiesto vyhľadávania: asistent (otázka a odpoveď), voliteľne tickety a schránka helpdesku.", portal: "Články, knižnica a formuláre. Dnes existuje knižnica; články a formuláre pripravujeme." },
    kind: "Typ kanála",
    ticketsOn: "Tickety",
    ticketsHint: "Po dvoch negatívnych hodnoteniach môže človek napísať helpdesku; e-maily zo schránky sa stávajú ticketmi. Bez ticketov je kanál len asistent.",
    portalNote: "Portál zatiaľ nesie len rozsah obsahu a jazyky — knižnica ich použije pri verejnom čítaní, články a formuláre pripravujeme.",
    builtIn: "Vstavané",
    builtInAssistant: "Asistent v intranete — otázka a odpoveď nad celou knižnicou pre prihlásených; nenastavuje sa.",
    builtInPortal: "Knižnica v intranete — platné dokumenty pre prihlásených; nenastavuje sa.",
    tabsLabel: "Časti kanálov",
    tabList: "Kanály",
    tabMyTickets: "Moje tickety",
    tabTickets: "Tickety",
    tabSettings: "Nastavenie",
    agentsNote: "Riešitelia majú zmysel, keď sú zapnuté tickety.",
    back: "Kanály",
    intro: "Kanál je jedno miesto, kde sa ľudia pýtajú: má vlastný obsah (priečinky knižnice), schránku, riešiteľov a widget. Kanálov môže byť viac — každý pre iný projekt a publikum.",
    list: "Kanály",
    empty: "Zatiaľ žiadny kanál.",
    newChannel: "Nový kanál",
    edit: "upraviť",
    keyHint: "Kľúč kanála, pridelený pri založení. Je v adrese skriptu widgetu a v claime aud tokenu; nemení sa.",
    name: "Názov",
    audience: "Publikum",
    audienceHint: "Komu kanál slúži — klubové manažérky, rozhodcovia, rodičia…",
    folders: "Obsah kanála",
    foldersHint: "Priečinky knižnice, z ktorých asistent odpovedá. Bez výberu vidí celú knižnicu organizácie.",
    connectorScopes: "Živé zdroje",
    connectorScopesHint: "Rozsahy pripojených konektorov, v ktorých asistent hľadá popri knižnici. Bez výberu sa živé zdroje v tomto kanáli nepoužijú.",
    connectorScopesNone: "Organizácia nemá pripojený žiadny konektor so živým zdrojom.",
    assignees: "Riešitelia",
    assigneesHint: "Osoby s rolou helpdesk, ktoré vidia tickety tohto kanála.",
    languages: "Jazyky kanála",
    mailbox: "Schránka",
    mailboxIntro: "E-maily do schránky sa stávajú ticketmi a odpovede odchádzajú z nej. Microsoft 365 cez Microsoft Graph; IMAP pre bežné služby príde s prvým zákazníkom, ktorý ho má.",
    mailboxNone: "Kanál bez schránky — len chat a tickety z neho.",
    mailboxKind: "Druh schránky",
    kindGraph: "Microsoft 365 (Graph)",
    kindImap: "IMAP (zatiaľ nedostupné)",
    address: "Adresa schránky",
    addressHint: "napr. helpdesk@futbalsfz.sk — číta sa z nej aj odpovedá",
    tenantId: "Tenant (Directory ID)",
    clientId: "Client ID aplikácie",
    clientSecret: "Tajomstvo aplikácie (client secret)",
    clientSecretHint: "Uloží sa zašifrované; prázdne pole ho nemení. Postup registrácie v Entra je v docs/NASADENIE_app.md.",
    secretSet: (hint: string, when: string, by: string) => `tajomstvo …${hint} zadané ${when} (${by})`,
    secretNone: "tajomstvo zatiaľ nie je zadané",
    sync: "Synchronizácia",
    syncNow: "Synchronizovať teraz",
    syncNever: "ešte nebežala",
    syncLast: (when: string) => `naposledy ${when}`,
    syncError: (code: string) => `posledná chyba: ${code}`,
    syncCounts: (created: number, appended: number, skipped: number) => `nové tickety ${created} · doplnené ${appended} · preskočené ${skipped}`,
    syncSinceHint: "Prvé spustenie len označí začiatok: staršie správy sa ticketmi nestanú, história ide do ťažby FAQ.",
    syncInterval: "Interval synchronizácie",
    syncIntervalHint: "Ako často sa schránka kontroluje automaticky. Synchronizovať teraz funguje kedykoľvek.",
    syncIntervalOption: (m: number) => (m >= 1440 ? "raz denne" : m >= 60 ? "každú hodinu" : `každých ${m} minút`),
    syncDone: (created: number, appended: number, beforeStart: number) => `Synchronizácia prebehla: nové tickety ${created}, doplnené ${appended}, správ z histórie preskočených ${beforeStart}.`,
    verify: "Overiť spojenie",
    verified: (address: string, name: string) => `Spojenie funguje: ${address}${name ? ` (${name})` : ""}.`,
    widget: "Widget pre cudzí systém",
    widgetIntro: "Cudzí systém (ISSF) vydá po prihlásení podpísaný token s identitou osoby; widget ho pošle s otázkou. Tajný kľúč sa ukáže len raz, hneď po vytvorení.",
    widgetOrigins: "Povolené pôvody",
    widgetOriginsHint: "Adresy, z ktorých smie widget volať, každá na nový riadok: https://issf.futbalsfz.sk",
    rateLimit: "Strop požiadaviek na osobu a hodinu",
    rateLimitHint: "Ochrana pred zneužitím (D14).",
    widgetSecret: "Tajný kľúč",
    widgetSecretRotate: "Vytvoriť nový tajný kľúč",
    widgetSecretShown: "Nový tajný kľúč — skopíruj ho teraz, znova sa neukáže:",
    widgetSecretNone: "zatiaľ nevytvorený",
    widgetSecretSet: (hint: string, when: string) => `…${hint}, vytvorený ${when}`,
    mining: "Ťažba FAQ z histórie",
    miningIntro: "Model prečíta posledné vlákna schránky, očistí ich od osobných údajov a navrhne záznamy FAQ do konceptu vybraného FAQ dokumentu. Telá správ sa neukladajú; návrhy schvaľuje správca obsahu postupom znenia.",
    miningDocument: "FAQ dokument",
    miningLimit: "Koľko posledných správ prečítať",
    miningRun: "Navrhnúť záznamy FAQ",
    miningDone: (threads: number, proposed: number, saved: number, duplicates: number) => `Ťažba prebehla: vlákien ${threads}, návrhov ${proposed}, uložených do konceptu ${saved}, duplicitných ${duplicates}.`,
    noFaqDocuments: "V knižnici ešte nie je FAQ dokument — založ ho v Knižnici → Nový dokument → FAQ.",
    tickets: (open: number, total: number) => `tickety: ${open} otvorených z ${total}`,
    save: "Uložiť kanál",
    saved: "Kanál je uložený.",
    created: "Kanál je založený.",
    remove: "Odstrániť kanál",
    removed: "Kanál je odstránený.",
    deployNote: "Aplikácia v Entra potrebuje oprávnenia Mail.Read a Mail.Send zúžené na schránku kanála (RBAC for Applications). Postup: docs/NASADENIE_app.md § 5.",
  },
  library: {
    emptyForYou: "Zatiaľ tu pre vás nie sú žiadne dokumenty.",
    reader: {
      lead: "Platné predpisy a smernice vašej organizácie.",
      search: "Hľadať v názve dokumentu",
      searchSubmit: "Hľadať",
      emptyFilter: "Žiadny dokument tomu nezodpovedá.",
      validFrom: date => `platí od ${date}`,
    },
    flow: {
      heading: d => `Nové znenie od ${d}`,
      headingUndated: "Nové znenie",
      firstVersion: "Prvé znenie",
      publishedHeading: d => `Znenie od ${d}`,
      steps: ["Príprava", "Schválenie", "Zverejnenie", "Pridelenie"],
      stepOf: n => `Krok ${n} z 4`,
      subPrepare: "PDF, Word, údaje o znení",
      subPrepareDone: "hotová",
      subWaitSubmit: "čaká na predloženie",
      subInReview: (done, total) => `${done} z ${total} schválilo`,
      subApproved: "schválené",
      subRejected: n => `kolo ${n} zamietnuté`,
      subCancelled: n => `kolo ${n} stiahnuté`,
      subWaitApproval: "čaká na schválenie",
      subPublished: "zverejnené",
      subAssign: "prenos pridelení",
      statusPreparing: "príprava",
      statusInReview: (by, date) => `na schválení · predložil ${by} ${date}`,
      statusApproved: "schválené, čaká na zverejnenie",
      statusRejected: date => `príprava · vrátené zo schválenia ${date}`,
      statusPublished: date => `zverejnené ${date} · zatiaľ nikomu nepridelené`,
      lead1: "Skontroluj, čo sa bude schvaľovať. Po predložení sa nič z toho nedá zmeniť.",
      lead1Rejected: "Oprav, čo schvaľovateľ vytkol, skontroluj údaje a predlož nové kolo. Zamietnutie zostáva v histórii.",
      rejectedBy: (who, date, n) => `${who} zamietol ${date} · kolo ${n} sa tým zastavilo`,
      cancelled: (date, n) => `Kolo ${n} stiahnuté ${date}`,
      checkPdf: "PDF",
      checkPdfMissing: "Chýba PDF — bez neho sa znenie nedá predložiť. Nahraj ho cez „Vymeniť“.",
      checkSource: "Upraviteľný zdroj",
      checkSourceNote: "text na vyhľadávanie vznikol z neho",
      checkSourceMissing: "bez zdroja — text na vyhľadávanie vznikol z PDF",
      replace: "Vymeniť",
      showText: "Zobraziť text",
      metaHeading: "Údaje o znení",
      metaNote: "Dátum účinnosti je povinný pred predložením na schválenie.",
      approvers: "Schvaľovatelia",
      approversPrefilled: "Predvyplnené z posledného kola, dá sa zmeniť. Seba schváliť nemôžeš.",
      responsible: "Zodpovedná osoba nového znenia",
      responsibleNote: "Ak ju určíš už teraz, pri zverejnení sa len potvrdí a hneď po zverejnení jej príde upozornenie, aby určila právny základ.",
      responsibleChosen: name => `Zodpovedná osoba: ${name}. Určená v príprave.`,
      basisChosen: label => `Právny základ: ${label}. Určený v príprave, pri zverejnení sa prenesie do znenia.`,
      basisWaiting: name => `Právny základ zatiaľ nie je určený. ${name} ho môže určiť ešte pred zverejnením na stránke dokumentu — upozornenie má vo zvončeku.`,
      basisNoResponsible: "Právny základ zatiaľ nie je určený. Kým príprava nemá zodpovednú osobu, môže ho určiť správca obsahu.",
      basisResponsibleGone: "Právny základ zatiaľ nie je určený a zodpovedná osoba z prípravy už nie je aktívna — môže ho určiť správca obsahu.",
      basisSetHere: "Určiť právny základ",
      basisChangeHere: "Zmeniť právny základ",
      responsibleChange: "Zmeniť zodpovednú osobu",
      note: "Poznámka pre schvaľovateľov",
      submitAndSave: "Uložiť a predložiť na schválenie",
      resubmit: n => `Uložiť a predložiť kolo ${n}`,
      saveOnly: "Len uložiť",
      lead2: (done, total) => `Čaká na schválenie — ${done} z ${total}. Keď schvália všetci, znenie sa dá zverejniť. Jedno zamietnutie vráti znenie do prípravy.`,
      approvalsWhere: "Schvaľovatelia rozhodujú v „Na schválenie“; e-mail im odišiel pri predložení.",
      whatIsApproved: "Čo sa schvaľuje",
      locked: "zamknuté počas kola",
      searchText: "Text na vyhľadávanie",
      searchTextNote: "z neho odpovedá vyhľadávanie",
      open: "Otvoriť",
      show: "Zobraziť",
      next: "Potom",
      next3: "označenie znenia a zodpovedná osoba",
      next4: "ponúkne sa prenos pridelení z predošlého znenia",
      next4None: "prideľovanie v Pridelených dokumentoch",
      withdraw: "Stiahnuť kolo",
      withdrawNote: "Stiahnutím sa znenie vráti do prípravy a dá sa upraviť. Kolo zostane v histórii.",
      lead3: "Znenie je schválené. Doplň označenie a zverejni ho.",
      labelSuggestion: d => `úplné znenie od ${d}`,
      labelSuggested: "Návrh z dátumu účinnosti. Označenie je doslova vo formulke potvrdenia.",
      effectiveFromSourceSuggested: "Predvyplnené zo schválených údajov o znení.",
      carryOver: n => `Prideliť nové znenie tým istým adresátom (${n})`,
      carryOverNote: "Odškrtni, ak chceš prideliť inak — potom to urobíš v kroku 4 alebo v Pridelených dokumentoch.",
      publishFrom: d => `Zverejniť od ${d}`,
      publishAndAssign: "Zverejniť a prideliť",
      lead4: "Potvrdenie sa viaže na znenie, takže nové znenie treba prideliť znova.",
      assignElsewhere: "Prideliť iným ľuďom →",
      assignChosen: "Prideliť vybraným",
      newVersion: "Nové znenie",
      newVersionBusy: "Nové znenie sa už pripravuje. Súbory vymeníš v príprave.",
      newVersionFirst: "Dokument ešte nemá platné znenie — najprv dokonči prvé.",
      downloadPdf: "Stiahnuť PDF",
      downloadSource: "Stiahnuť zdrojový súbor",
      editDocument: "Upraviť dokument",
      currentHeading: "Platné znenie",
      upcomingHeading: "Pripravované znenie",
      upcomingNote: d => `Zverejnené, platiť začne ${d}. Dovtedy ľudia čítajú a potvrdzujú platné znenie vyššie.`,
      fromDate: d => `od ${d}`,
      changeResponsible: "Zmeniť zodpovednú osobu",
      changeBasis: "Zmeniť právny základ",
      fixData: "Opraviť údaje",
      history: "História",
      olderHeading: "Staršie znenia",
      olderNone: "Žiadne. Po zverejnení nového znenia sa sem presunie platné.",
      older: {
        count: n => String(n),
        note: "Ľudia ich už nevidia; potvrdenia ostávajú ako doklad.",
        range: (from, to) => `${from} – ${to}`,
        published: date => `zverejnené ${date}`,
        acks: "potvrdili",
        noAcks: "bez potvrdení",
        ackCount: n => `${n} ${n === 1 ? "potvrdenie" : n >= 2 && n <= 4 ? "potvrdenia" : "potvrdení"}`,
        more: "Ďalšie úkony",
        showAll: n => `Zobraziť všetky (${n})`,
        close: "Zavrieť",
        responsibleMissing: "chýba",
        responsibleInactive: "vyradená",
        basisMissing: "základ neurčený",
      },
      manage: "Správa",
      archive: {
        heading: "Archivovať predpis",
        intro: "Predpis prestane platiť dňom, ktorý zvolíte. Asistent z neho prestane odpovedať, nedá sa prideliť a nepotvrdené pridelenia sa odvolajú. Text, PDF a potvrdenia ostanú.",
        until: "Neplatí od",
        untilHint: "Môže byť aj v budúcnosti — dovtedy predpis platí normálne.",
        reason: "Dôvod",
        reasonHint: "Napríklad: zrušený uznesením VV SFZ č. … zo dňa …",
        submit: "Archivovať",
        blocked: "Archivovať sa teraz nedá:",
        done: (date, revoked) => `Predpis je archivovaný od ${date}.${revoked ? ` Odvolané pridelenia: ${revoked}.` : ""}`,
        scheduled: date => `Predpis sa archivuje ${date}. Dovtedy platí.`,
        bannerInEffect: date => `Archivovaný — neplatí od ${date}`,
        bannerScheduled: date => `Archivuje sa — platí ešte do ${date}`,
        bannerMeta: (who, at) => `Archivoval(a) ${who}, ${at}`,
        restore: "Obnoviť platnosť",
        restoreHint: "Pri omyle. Odvolané pridelenia sa neobnovia — prideliť sa dá znova.",
        restored: "Platnosť predpisu je obnovená.",
      },
      uploadNext: "Potom na detaile skontroluješ text, vyberieš schvaľovateľov a zodpovednú osobu a predložíš.",
      approvalHistory: "História schvaľovania",
      versionPageTitle: "Nové znenie",
      versionPageBack: "← Späť na dokument",
      autoLabel: d => `znenie účinné od ${d}`,
      autoLabelNote: "Označenie sa skladá z dátumu účinnosti a je doslova vo formulke potvrdenia.",
      titleNote: "Pri platnom znení sa názov mení len novým znením — schváli sa spolu s ním a zverejnením sa zmení v knižnici aj vo formulke potvrdenia.",
      newTitle: t => `Nový názov dokumentu: „${t}“`,
      secBasic: "Základné údaje",
      secPlacement: "Zaradenie",
      optional: "nepovinné",
      editSaveNote: "Mení údaje o dokumente, nie znenie. Schválenie ani potvrdenia sa tým nerušia.",
      cancel: "Zrušiť",
      titleLockedBefore: "🔒 Dokument má zverejnené znenie — názov sa mení len ",
      titleLockedLink: "novým znením",
      titleLockedAfter: ". Schváli sa spolu s ním.",
      elsewhereHeading: "Upravuje sa inde",
      elsewhereVersion: "Nové znenie",
      elsewhereMeta: "Údaje o znení",
      elsewhereResponsible: "Zodpovedná osoba a právny základ",
      elsewhereText: "Text na vyhľadávanie",
    },
    carryOver: {
      heading: "Prideliť aj nové znenie",
      intro: (label) => `Znenie „${label}" nemá zatiaľ pridelené nikoho. Predošlé znenia pridelené boli — potvrdenie sa viaže na konkrétne znenie, takže novelu treba prideliť znova.`,
      audiences: "Adresáti z predošlých znení",
      previously: (label, reason) => `${label} · pôvodný dôvod: ${reason}`,
      reason: "Dôvod pridelenia",
      reasonNote: "Povinný. Napíš, prečo sa má norma potvrdiť znova — pôvodný dôvod pri každom adresátovi je len nápoveda a pri novele spravidla neplatí.",
      due: "Termín potvrdenia",
      dueNone: "bez termínu",
      dueDate: "do dátumu",
      dueDays: "do počtu dní",
      dueDaysUnit: "dní od pridelenia",
      dueNote: "Bez termínu sa pripomienky neposielajú samy. Pôvodný termín sa neprenáša — býva v minulosti a hneď by vyrobil omeškanie.",
      submit: "Prideliť vybraným",
      noEmailNote: "E-maily sa tým neposielajú. Rozposlanie je samostatný krok v Pridelených dokumentoch.",
    },
    fields: {
      ownerDepartment: "Oddelenie, ktoré dokument spravuje",
      ownerDepartmentShort: "Oddelenie",
      ownerDepartmentNote: "Nepovinné. Kto predpis udržiava — nie komu sa prideľuje na potvrdenie.",
      ownerDepartmentNone: "Neurčené",
      ownerDepartmentEmpty: "Organizačná štruktúra je zatiaľ prázdna. Oddelenia sa zakladajú v Nastavení organizácie.",
      internalNumber: "Interné číslo",
      internalNumberNote: "Nepovinné. Nie každý predpis ho má a do formulky potvrdenia nevstupuje.",
      internalNumberPlaceholder: "12/2024",
    },
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
      language: "Jazyk",
      all: "— všetky —",
      filtersTitle: "Filtre",
      accessLevel: "Prístup",
      apply: "Použiť",
      tagSearch: "hľadať značku…",
      shown: (found, all) => `${found} z ${all}`,
      removeFilter: (value) => `Odobrať filter ${value}`,
      colDocument: "Dokument",
      colVersion: "Verzia",
      colEffectiveFrom: "Platné od",
      colEffectiveTo: "Platné do",
      colAcknowledged: "Potvrdenia",
      acknowledgedOf: (acknowledged, assigned) => `${acknowledged} z ${assigned} pridelených`,
      colChanged: "Zmenené",
      exportCsv: "Export CSV",
      sortBy: (column) => `Zoradiť podľa ${column}`,
      pageRange: (from, to, total) => `Zobrazené ${from}–${to} z ${total}`,
      pageOf: (page, pages) => `Strana ${page} z ${pages}`,
      prevPage: "Predchádzajúca",
      nextPage: "Ďalšia",
      viewSwitch: "Pohľad",
      filters: "Filtre",
      showResults: n => (n === 1 ? "Zobraziť 1 dokument" : n >= 2 && n <= 4 ? `Zobraziť ${n} dokumenty` : `Zobraziť ${n} dokumentov`),
      moreActions: "Ďalšie akcie",
      waiting: {
        heading: "Čaká na schválenie",
        count: n => (n === 1 ? "1 znenie" : n >= 2 && n <= 4 ? `${n} znenia` : `${n} znení`),
        since: date => `predložené ${date}`,
        waitingFor: names => `čaká sa na: ${names}`,
        nobodyPending: "všetci rozhodli",
      },
      viewTable: "Tabuľka",
      viewCards: "Karty",
      bulk: {
        heading: "S označenými",
        pickColumn: "Výber",
        pick: (title) => `Označiť ${title}`,
        picked: (count) => `Označené: ${count}`,
        pickedOutside: (count) => `z toho ${count} mimo tohto zoznamu`,
        pickedMax: (max) => `Viac než ${max} naraz označiť nejde — výber sa nesie v adrese. Spracujte túto dávku a označte ďalšiu.`,
        clearPicked: "zrušiť výber",
        moveConfirm: count =>
          `Presunúť ${count} ${count === 1 ? "dokument" : count < 5 ? "dokumenty" : "dokumentov"} do …`,
        moveTo: "Presunúť do",
        move: "Presunúť",
        assign: "Vyžiadať potvrdenie",
      },
      builder: {
        heading: "+ Podmienka",
        hint: "Vnútri skupiny platí „a“, medzi skupinami „alebo“ — teda (A a B) alebo (C a D). Spojku pred riadkom zmeníte odkazom vedľa neho.",
        field: "Pole",
        op: "Operátor",
        value: "Hodnota",
        /** Ponuka pri dátumovom poli — napísané slovo sa uloží ako token. */
        today: "dnes",
        fieldNote: "Pri „Platné do po“ sa dokumenty s neobmedzenou platnosťou nezobrazia — nemajú koniec platnosti, na ktorý sa pýtate.",
        add: "Pridať podmienku",
        remove: (description) => `Odobrať podmienku ${description}`,
        matchAll: "spĺňa všetky",
        matchAny: "spĺňa ktorúkoľvek",
        makeAnd: "zmeniť na „a“",
        makeOr: "zmeniť na „alebo“",
        addAnd: "Pridať s „a“",
        addOr: "Pridať s „alebo“",
        joinAll: "a zároveň",
        joinAny: "alebo",
        joinFirst: "kde",
        preview: "Dokumenty, kde",
        fields: {
          title: "Názov",
          category: "Druh",
          status: "Stav",
          tag: "Značka",
          accessLevel: "Prístup",
          updatedAt: "Zmenené",
          effectiveTo: "Platné do",
        },
        ops: {
          is: "je",
          not: "nie je",
          contains: "obsahuje",
          before: "pred",
          after: "po",
        },
      },
      statusLabel: {
        published: "Platný",
        draft: "Návrh",
        review: "Na schválenie",
        expired: "Expirovaný",
        archived: "Archivovaný",
      },
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
      empty: "V knižnici zatiaľ nič nie je",
      emptyText: "Keď nahráte prvý dokument, objaví sa tu aj s tým, kto ho má potvrdiť.",
      emptyFilteredTitle: "Filtru nič nevyhovuje",
      emptyFilteredBefore: count =>
        count === 1
          ? "Máte nasadený 1 filter:"
          : count < 5
            ? `Máte nasadené ${count} filtre:`
            : `Máte nasadených ${count} filtrov:`,
      emptyFilteredAfter: "Skúste niektorý zrušiť.",
      and: "a",
    },
    tracks: {
      heading: "Trasy",
      intro: "Trasa je poradie krokov — „prejdi tieto dokumenty v tomto poradí“. Človek na nej vidí, kde skončil.",
      newHeading: "Nová trasa",
      key: "Kľúč",
      keyHint: "Malé písmená bez diakritiky, číslice a pomlčka. Ide do adries a zostáva.",
      keyTaken: "Taká trasa už existuje — zmeň kľúč.",
      title: "Názov",
      description: "Popis (nepovinný)",
      create: "Založiť trasu",
      emptyTitle: "Žiadne trasy",
      emptyText: "Trasa je poradie noriem, ktoré má človek prečítať — napríklad pri vstupe do organizácie. Prvú založíte formulárom nižšie.",
      active: "zapnutá",
      inactive: "vypnutá",
      enable: "Zapnúť",
      disable: "Vypnúť",
      stepCount: n => (n === 1 ? "1 krok" : n >= 2 && n <= 4 ? `${n} kroky` : `${n} krokov`),
      detailHeading: title => `Trasa ${title}`,
      edit: "Upraviť názov",
      rename: "Uložiť názov",
      steps: "Kroky",
      noSteps: "Trasa zatiaľ nemá kroky. Prázdnu trasu zapnúť nejde — ľuďom by tvrdila „hotovo“.",
      addStep: "Pridať krok",
      chooseDocument: "— vyberte dokument —",
      requiresAck: "Vyžaduje potvrdenie",
      requiresAckHint: "Bez potvrdenia je krok len na prečítanie a do dôkazov sa nezapíše.",
      ackYes: "s potvrdením",
      ackNo: "bez potvrdenia",
      remove: "Odobrať",
      moveUp: "Vyššie",
      moveDown: "Nižšie",
      created: "Trasa je založená. Zapnúť ju pôjde, až keď bude mať kroky.",
      renamed: "Názov je uložený.",
      stepsSaved: "Kroky sú uložené.",
      dueHeading: "Termín potvrdenia",
      dueNone: "bez termínu",
      dueDays: "do počtu dní od pridania na trasu",
      dueDaysUnit: "dní od pridania",
      dueNote: "Každému beží od dňa, keď ho na trasu pridali, takže kto príde neskôr, má rovnakú lehotu. S termínom ľuďom chodia pripomienky, keď sa blíži aj keď je po ňom. Platí aj pre tých, ktorí už na trase sú — kto je na nej dlhšie, môže byť hneď po termíne.",
      dueSave: "Uložiť termín",
      settingsHeading: "Nastavenia trasy",
      saveSettings: "Uložiť nastavenia",
      addHeading: "Pridať osoby na trasu",
      cancel: "Zrušiť",
      deactivateTitle: "Deaktivovať trasu",
      deactivateNote: "Nikto nový nepribudne a pripomienky sa zastavia. Potvrdenia ostávajú.",
      activateTitle: "Aktivovať trasu",
      activateNote: "Trasa sa znova ponúkne pri pridávaní ľudí a pripomienky sa obnovia.",
      dueSaved: "Termín trasy je uložený.",
      settingsSaved: "Nastavenia trasy sú uložené.",
      dueCurrent: days => (days === null ? "Bez termínu" : days === 1 ? "Do 1 dňa od pridania na trasu" : `Do ${days} dní od pridania na trasu`),
      members: n => `Osoby na trase (${n})`,
      noMembers: "Na trase zatiaľ nie je nikto.",
      membersInactive: "vyradená",
      removeMember: "Odobrať",
      addMembers: "Pridať osoby",
      addMembersNote: "Z oddelenia sa pridajú jeho dnešní členovia vrátane podriadených. Kto príde do oddelenia neskôr, trasu nedostane sám — na to je pridelenie oddeleniu.",
      departments: "Oddelenia",
      people: "Osoby",
      addSubmit: "Pridať na trasu",
      notifyAdded: "Poslať pridaným e-mail s dokumentmi na potvrdenie",
      notifyAddedHint: "Dostanú ho len tí, ktorým z trasy niečo chýba, a len o tom, čo im chýba. Bez zaškrtnutia sa im ozve až pripomienka pred termínom trasy.",
      membersAdded: (added, already) => `Pridané na trasu: ${added}.` + (already > 0 ? ` ${already} už na nej ${already === 1 ? "bol" : "boli"}.` : ""),
      memberRemoved: "Osoba je z trasy odobratá. Jej potvrdenia ostávajú.",
      enabled: "Trasa je zapnutá.",
      disabled: "Trasa je vypnutá. Zostáva zapísaná na ľuďoch, ktorí ju už majú.",
    },

    folders: {
      heading: "Priečinky",
      manage: "Správa priečinkov",
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
      removeBlocked: (documents, subfolders) => {
        const d = documents === 1 ? "1 dokument" : documents >= 2 && documents <= 4 ? `${documents} dokumenty` : `${documents} dokumentov`
        const f = subfolders === 1 ? "1 podpriečinok" : subfolders >= 2 && subfolders <= 4 ? `${subfolders} podpriečinky` : `${subfolders} podpriečinkov`
        const what = subfolders > 0 && documents > 0 ? `${d} a ${f}` : subfolders > 0 ? f : d
        return `Zrušiť sa dá len prázdny priečinok. V tomto je ${what} — najprv ich presuňte.`
      },
      emptyTitle: "Knižnica nemá priečinky",
      emptyText: "Dokumenty sú zatiaľ nezaradené. Priečinok založíte formulárom nižšie — a potom ich doň presuniete hromadne z knižnice.",
      newFolder: "Nový priečinok",
      newFolderName: "Názov nového priečinka",
      parentFolder: "Nadriadený priečinok",
      create: "Založiť",
    },
    detail: {
      documentData: "Údaje o dokumente",
      side: {
        progressHeading: "Potvrdenia",
        progressOf: (acknowledged, assigned) => `${acknowledged} / ${assigned} osôb`,
        progressNobody: "Toto znenie zatiaľ nie je nikomu pridelené.",
        progressWho: "Kto nepotvrdil →",
        progressAssign: "Prideliť na potvrdenie →",
        metaHeading: "Metadáta",
        folder: "Priečinok",
        unfiled: "Nezaradené",
        identifier: "Identifikátor",
        none: "—",
      },
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
      draftPdf: "PDF konceptu:",
      draftSource: "Upraviteľný zdroj:",
      versionPdf: "PDF znenia:",
      versionSource: "Upraviteľný zdroj (predloha pre ďalšie znenie):",
      noPdf: "Znenie spred ADR-011 — PDF k nemu nie je, schvaľoval a potvrdzoval sa text.",
      noDraftPdf: "Koncept nemá PDF. Pred predložením na schválenie nahraj znenie znova aj s PDF.",
      draftDiffers: "Koncept sa líši od publikovaného znenia.",
      draftSame: "Koncept je zhodný s publikovaným znením.",
      draftEmpty: "Koncept je prázdny.",
      publishHeading: "Publikovať znenie",
      nowPublishNew: current => `Publikovať nové znenie — teraz platí ${current}`,
      nowInReview: "Znenie je v schvaľovaní",
      toolsSummary: "Úpravy a správa dokumentu",
      approvalDraftLabel: "koncept",
      draftApprovalHeading: "Schválenie konceptu",
      publishNeedsApproval: "Koncept ešte nie je schválený. Predlož ho na schválenie vyššie — publikovať sa dá až schválené znenie.",
      publishWaitsForApproval: "Schvaľovanie beží. Publikovať sa dá, keď schvaľovatelia rozhodnú.",
      publishApprovedNote: "Koncept je schválený. Text už nemeň — každá úprava zmení odtlačok a schválenie tým prestane platiť.",
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
      reindexHeading: "Preindexovať všetky znenia",
      reindexNoteBefore: "Nareže všetky znenia — platné, pripravované aj staršie — znova podľa aktuálneho profilu členenia. ",
      reindexNoteHighlight: "Nevytvorí novú verziu",
      reindexNoteAfter: " — text sa nemení, takže potvrdenia zostávajú platné a nikomu nenaskočí povinnosť potvrdzovať znova. Používa sa po vyladení profilu v nastavení organizácie.",
      reindex: "Preindexovať všetky znenia",
      reindexVersionHeading: "Preindexovať",
      reindexVersionNote: "Nareže toto znenie znova podľa aktuálneho profilu členenia. Text sa nemení, potvrdenia zostávajú platné a asistent potom hľadá v novom členení.",
      reindexVersion: "Preindexovať toto znenie",
      newVersionHeading: "Nové znenie zo súboru",
      newVersionNote: "Nahrá nový súbor ako koncept tohto dokumentu. Publikované znenie sa tým nemení — text si najprv prečítaš a znenie publikuješ až potom. Metadáta zostávajú, mení sa len text a pôvodný súbor.",
      newVersionFile: "Súbor s novým znením",
      newVersionSubmit: "Nahrať nové znenie",
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
      fixHistory: n => (n === 1 ? "1 oprava" : n >= 2 && n <= 4 ? `${n} opravy` : `${n} opráv`),
      fixLine: (who, when) => `${who} · ${when}`,
      fixWas: (label, effectiveFrom) => `pôvodne ${label}, ${effectiveFrom}`,
      fixReacknowledged: "vyžiadalo opätovné potvrdenie",
      fixNoDate: "bez dátumu platnosti",
      versionLockedBefore: "Označenie a dátum platnosti sa už meniť nedajú — znenie potvrdilo ",
      versionLockedHighlight: (people) => `${people} ľudí`,
      versionLockedAfter: " a oba údaje sú v podpísanej formulke. Opraviť sa dajú až po odvolaní potvrdení; to robí personalista.",
      revokeVersionHeading: "Odvolať potvrdenia tohto znenia",
      revokeVersionNote: (people) => `Odvolá ${people} platných potvrdení naraz. Povinnosť ožije s pôvodným termínom — kto ho má za sebou, bude hneď po termíne. Staré potvrdenia z evidencie nezmiznú, zostanú ako odvolané aj s dôvodom.`,
      revokeVersionReason: "Dôvod odvolania",
      revokeVersionReasonPlaceholder: "Zlý dátum platnosti — uznesenie VV SFZ určilo 1. 4. 2026",
      revokeVersionSubmit: "Odvolať potvrdenia",
      fixSubmit: "Opraviť",

      textFixHeading: "Alebo: oprava textu bez novej verzie",
      textFixTarget: label => `Opravuje sa: ${label}`,
      textFixOther: label => `Porovnať so: ${label}`,
      textFixPanel: "Opraviť text",
      textFixPanelNote: "Nahrá text tohto znenia do editora. Oprava je bez novej verzie — len preklep, čiarka či diakritika; potvrdenia zostávajú platné. Keď sa mení význam, treba nové znenie. Uložíš ju potom v Správe, s rozdielom a dôvodom.",
      textFixLoad: "Načítať text do editora",
      textFixIntro:
        "Preklep, čiarka, diakritika — niečo, čo nemení význam. Znenie zostane to isté, potvrdenia zostanú platné " +
        "a do vyhľadávania sa pošle opravený text pri tom istom znení. Ak sa mení význam, toto nie je tá cesta: publikuj nové znenie.",
      textFixDiffHeading: "Čo sa zmení",
      textFixDiffStat: (added, removed) => `+${added} / −${removed} riadkov`,
      textFixGap: n => `… ${n} nezmenených riadkov …`,
      textFixCoarse:
        "Zmena je priveľká na porovnanie po riadkoch. Toto už pravdepodobne nie je oprava preklepu — zváž nové znenie.",
      textFixApprovalNote:
        "Schválenie zostane pri pôvodnom texte — po oprave sa už nezhoduje so znením, ktoré je vonku. Práve preto sa takto opravuje len to, čo nemení význam.",
      textFixReason: "Dôvod opravy",
      textFixReasonPlaceholder: "chýbajúca čiarka v čl. 4 ods. 2",
      textFixReasonNote: "Povinný. Zapíše sa k zneniu spolu s celým predchádzajúcim textom.",
      textFixSubmit: "Opraviť text bez novej verzie",
      textFixHistory: n => (n === 1 ? "1 oprava textu" : n >= 2 && n <= 4 ? `${n} opravy textu` : `${n} opráv textu`),
      textFixLine: (who, when) => `${who} · ${when}`,

      approvalHeading: "Schválenie",
      stateDraft: "Koncept",
      stateInReview: "V schvaľovaní",
      stateApproved: "Schválené",
      statePublishedBefore: "Zverejnené pred zavedením schvaľovania",
      statePublishedBeforeNote:
        "Toto znenie bolo v knižnici skôr, než sa začalo schvaľovať. Spätne sa neschvaľuje \u2014 nahradí ho oficiálne znenie, ktoré schvaľovaním prejde.",
      approvalSubmit: "predložiť na schválenie",
      approvalApprovers: "Schvaľovatelia",
      approvalApproversHint:
        "Vyber menovite ľudí, nie oddelenie. \u201ESchválil niekto z oddelenia Právne\u201C sa o rok nedá overiť. Seba vybrať nemôžeš \u2014 kto text nahral, ho neschvaľuje.",
      approvalNoPeople: "V organizácii nie je koho vybrať.",
      approvalNote: "Čo sa v znení mení",
      approvalNotePlaceholder: "Napríklad: upravený článok 4, zosúladenie s novelou zákona.",
      approvalNoteHint: "Nepovinné. Číta to schvaľovateľ, nie archív.",
      approvalSubmitButton: "Predložiť na schválenie",
      approvalWaiting: "čaká",
      approvalNotDecided: "nerozhodol",
      approvalApproved: when => `schválil ${when}`,
      approvalRejected: when => `zamietol ${when}`,
      approvalRoundHeading: round => `${round}. kolo`,
      approvalSubmittedBy: (who, when) => `predložil ${who} · ${when}`,
      approvalHistory: n => (n === 1 ? "1 kolo" : n >= 2 && n <= 4 ? `${n} kolá` : `${n} kôl`),
      approvalCancel: "zrušiť kolo",
      approvalCancelReason: "Dôvod zrušenia",
      approvalCancelHint:
        "Kolo sa nezmaže \u2014 dostane dôvod a zostane v histórii. Je to jediná cesta, ako zo zoznamu odstrániť schvaľovateľa, ktorý tam byť nemá.",
      approvalCancelButton: "Zrušiť kolo",
    },
    chunks: {
      heading: "Členenie na úseky",
      intro: "Asistent nečíta celý dokument naraz — dostane niekoľko úsekov a odpovedá z nich. Tu vidíte, ako je platné znenie narezané a či to sedí.",
      openLink: "členenie na úseky →",
      profile: "Profil členenia",
      version: "Znenie",
      noVersion: "Dokument zatiaľ nemá platné znenie, preto nemá úseky. Nižšie je len rozbor konceptu.",
      upToDate: "Úseky zodpovedajú dnešnému členeniu.",
      outdated: (stored, today) => `Úseky sú narezané starším spôsobom (${stored} ${stored === 1 ? "úsek" : stored >= 2 && stored <= 4 ? "úseky" : "úsekov"}); dnes by ich vzniklo ${today}.`,
      reindexHint: "Preindexovať sa dá v detaile dokumentu (Správa → Preindexovať). Znenie ani potvrdenia sa nemenia.",
      statsCount: "Úsekov",
      statsArticles: "S článkom",
      statsTokens: "Veľkosť (tokeny)",
      tokensRange: (min, avg, max) => `${min} – ${avg} – ${max}`,
      target: (min, max) => `cieľ ${min}–${max}`,
      warningsHeading: "Čo nesedí",
      warnings: {
        oneBlock: "Celý text je v jednom úseku — nenašiel sa ani jeden článok. Asistent z neho nevie citovať konkrétne miesto. Typické pre manuál alebo zmluvu; pomôže členenie podľa nadpisov.",
        fewArticles: percent => `Článok má len ${percent} % úsekov — členenie dokumentu profil takmer nerozpoznal.`,
        oversized: (count, limit) => `${count} ${count === 1 ? "úsek je väčší" : count <= 4 ? "úseky sú väčšie" : "úsekov je väčších"} než ${limit} tokenov — asistent z ${count === 1 ? "neho" : "nich"} dostane priveľa naraz.`,
        fragments: count => count === 1 ? "1 krátky úlomok rozdeleného článku — má málo kontextu." : `${count} ${count <= 4 ? "krátke úlomky" : "krátkych úlomkov"} rozdelených článkov — majú málo kontextu.`,
      },
      noWarnings: "Bez nálezov.",
      analysisHeading: "Rozbor textu",
      analysisFound: (lines, articles, paragraphs, points, headings) =>
        `${lines} riadkov · „Článok“ ${articles}× · „§“ ${paragraphs}× · „Bod“ ${points}× · nadpisov ${headings}`,
      analysisFits: word => `Text je členený na „${word}“ — profil sedí.`,
      analysisOther: word => `Text je členený skôr na „${word}“ než podľa profilu — zvážte iný profil.`,
      analysisPlain: "Text nemá články ani paragrafy. Potrebuje členenie podľa nadpisov.",
      listHeading: "Úseky",
      noArticle: "bez článku",
      tokens: n => `${n} ${n === 1 ? "token" : n >= 2 && n <= 4 ? "tokeny" : "tokenov"}`,
      oversizedTag: "veľký",
      trialHeading: "Skúsiť iný rez",
      trialIntro: "Zmeňte hodnoty a pozrite sa, ako by sa text narezal. Nič sa neuloží, kým nižšie nezvolíte profil.",
      fieldArticleWord: "Slovo článku",
      fieldArticleWordHint: "Slovo, ktorým začína nadpis článku: Článok, § alebo Bod.",
      fieldAnnexWord: "Slovo prílohy",
      fieldMinTokens: "Úsek od (tokenov)",
      fieldMaxTokens: "Úsek do (tokenov)",
      trialShow: "Ukázať rez",
      trialReset: "Zrušiť skúšku",
      compareHeading: "Porovnanie",
      compareNow: "teraz",
      compareTrial: "skúška",
      compareMax: "Najväčší úsek",
      trialMatches: label => `Tieto hodnoty má profil „${label}“.`,
      trialSameAsCurrent: "Skúšobný rez je rovnaký ako súčasný — netreba nič meniť.",
      trialListHeading: "Úseky po skúšobnom reze",
      saveHeading: "Profil pre tento dokument",
      saveIntro: "Dokument nesie len pomenovaný profil — ten sa dá použiť aj pri ďalších dokumentoch. Po zmene profilu treba dokument preindexovať; dovtedy asistent odpovedá zo starých úsekov.",
      useProfile: "Použiť existujúci profil",
      useProfileButton: "Použiť",
      currentProfile: "súčasný",
      newProfile: "Uložiť hodnoty skúšky ako nový profil",
      newProfileLabel: "Názov profilu",
      newProfileHint: "Napríklad „Zákon (§)“. Existujúce profily sa tu nemenia — zmena by ticho prerezala všetky dokumenty, ktoré ich používajú.",
      newProfileButton: "Uložiť profil",
      adviceHeading: "Návrh AI",
      adviceIntro: "Model dostane štruktúru dokumentu — nadpisy, články a začiatky odsekov, nie celý text — a navrhne, ako ho narezať. Nič sa nezmení; návrh si môžete skúsiť a uložiť ako profil. Volanie sa zapíše do spotreby AI.",
      adviceButton: "Analyzovať pomocou AI",
      adviceAgain: "Analyzovať znova",
      adviceMeta: (date, model, by) => `${date} · ${model} · ${by}`,
      adviceStrategyArticles: (word, min, max) => `Po článkoch — slovo „${word}“, úsek ${min}–${max} tokenov.`,
      adviceStrategyHeadings: "Podľa nadpisov — dokument nemá články. Tento spôsob členenia zatiaľ nie je k dispozícii (ADR-027, krok 2).",
      adviceConfidence: { low: "istota nízka", medium: "istota stredná", high: "istota vysoká" },
      adviceIssues: "Čo nesedí",
      adviceTry: "Skúsiť tento rez",
    },
    editor: {
      intro: "Porovnaj text s originálom. Publikovanie je samostatný krok — tu sa nič nepúšťa von.",
      modelDraft: "návrh modelu",
      ruleDraft: "návrh podľa pravidiel",
      modeRewriteScan: "prepis skenu",
      modeClean: "prečistenie členenia",
      draftMeta: (model, when, chars) => `${model} · ${when} · ${chars} znakov`,
      draftNoteBefore: "Model mal zakázané meniť znenie — ",
      ruleNoteBefore: "Pravidlá menia len značky členenia a odstraňujú pätičku strany, nie slová — ",
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
      llmHeading: "Pomoc pri texte",
      llmNoteBefore: "Volá sa len takto — kliknutím. Výsledok sa uloží ako ",
      llmNoteHighlight: "návrh vedľa textu",
      llmNoteAfter: ", nie doňho: model má zakázané meniť znenie, ale tichú zmenu v predpise by nikto nezachytil, keby sa zapisovala rovno.",
      clean: "Prečistiť členenie",
      cleanNote: "„Prečistiť členenie“ jazykový model nepoužíva. Text sa označkuje podľa pravidiel — ČASŤ, hlava, diel, Článok, príloha — a odstráni sa opakovaná pätička strany. Nemá to limit na dĺžku a nemení sa ani jedno slovo normy.",
      rewriteScan: "Prepísať zo skenu",
      rewriteScanNote: "„Prepísať zo skenu“ pošle celé pôvodné PDF modelu. Má zmysel vtedy, keď PDF nemá textovú vrstvu alebo je prevod rozsypaný.",
    },
    actions: {
      converted: "Prevedené. Prečítaj text a porovnaj ho s originálom.",
      metaSaved: "Údaje o znení uložené.",
      convertedWithWarnings: (warnings) => `Prevedené. ${warnings}`,
      versionSameAsPublished: "Pozor: prevedený text je zhodný s platným znením — nahratý súbor neprináša žiadnu zmenu.",
      versionDiffers: (added, removed) => `Oproti platnému zneniu: ${added} pridaných, ${removed} odobraných riadkov.`,
      saved: "Uložené.",
      changesSaved: "Zmeny boli uložené.",
      alreadyPublished: "Toto znenie už publikované je — nič sa nezmenilo.",
      published: (chunks, archived) =>
        `Publikované: ${chunks} ${chunks === 1 ? "úsek" : chunks < 5 ? "úseky" : "úsekov"},` +
        ` ${archived} starých archivovaných.`,
      modelReturnedDraft: "Model vrátil návrh. Porovnaj ho s doterajším textom a rozhodni sa.",
      rulesReturnedDraft: "Členenie je prečistené. Porovnaj návrh s doterajším textom a rozhodni sa.",
      draftAccepted: "Návrh je teraz konceptom. Publikovanie je stále samostatný krok.",
      draftDiscarded: "Návrh zahodený.",
      assigned: "Zaradené.",
      bulkNothingSelected: "Neoznačili ste žiadny dokument.",
      bulkMoved: (moved) => `Presunuté: ${moved}.`,
      bulkMovedPartly: (moved, total, failed) =>
        `Presunuté ${moved} z ${total}. Neprešli: ${failed}`,
      reindexUpToDate: "Členenie je už aktuálne — nič sa nemenilo.",
      chunkingProfileSet: label => `Dokument má profil „${label}“. Ešte ho preindexujte — dovtedy asistent odpovedá zo starých úsekov.`,
      chunkingProfileCreated: label => `Profil „${label}“ je uložený a priradený dokumentu. Ešte dokument preindexujte.`,
      chunkingAdviceReady: "Návrh AI je hotový — nižšie. Nič sa nezmenilo.",
      reindexAllResult: (done, unchanged) => `Preindexované znenia: ${done}, bez zmeny: ${unchanged}. Znenia ani potvrdenia sa nedotklo.`,
      reindexed: (chunks, archived) =>
        `Preindexované: ${chunks} ${chunks === 1 ? "úsek" : chunks < 5 ? "úseky" : "úsekov"},` +
        ` ${archived} starých archivovaných. Znenie ani potvrdenia sa nedotklo.`,
      fixed: "Opravené. Potvrdenia zostávajú platné.",
      versionRevoked: (people) => `Odvolaných potvrdení: ${people}. Povinnosť ožila s pôvodným termínom — teraz oprav údaj a nechaj znenie potvrdiť znova.`,
      carriedOver: (created, already) =>
        `Pridelené: ${created}${already > 0 ? `, už bolo pridelených: ${already}` : ""}.` +
        " E-maily sa neposlali — rozposlanie je samostatný krok.",
      textFixed: (added, removed, chunks) =>
        `Text opravený: +${added} / −${removed} riadkov. Znenie ani potvrdenia sa nemenia;` +
        ` do vyhľadávania išlo ${chunks} ${chunks === 1 ? "úsek" : chunks < 5 ? "úseky" : "úsekov"}.`,
      submittedForApproval: n =>
        `Predložené na schválenie ${n === 1 ? "jednému človeku" : `${n} ľuďom`}.`,
      approvalNotAllNotified: n => `Ale ${n === 1 ? "jednému človeku" : `${n} ľuďom`} sa e-mail odoslať nepodarilo \u2014 kolo beží, len o ňom nevedia.`,
      approvalCancelled: "Kolo zrušené. Zostáva v histórii aj s dôvodom.",
      draftPrepared: "Príprava je uložená.",
      carryOverFailed: "Znenie je zverejnené, prenos pridelení sa ale nepodaril:",
      failed: "Nepodarilo sa to. Skús to znova.",
    },
    connectorImport: {
      heading: "Import zo servera",
      intro: "Vyhľadaj články na pripojenom MCP serveri a vybrané ulož ako koncepty dokumentov. Ďalej idú bežnou cestou: metadáta, schválenie, zverejnenie. Server nemá zoznam súborov — vyberá sa z výsledkov hľadania.",
      newLink: "Články z pripojeného servera (napr. Sportnet) sa importujú tu →",
      noConnector: "Žiadny pripojený konektor nemá zapnutý import do knižnice.",
      noConnectorLink: "Konektory organizácie",
      connector: "Konektor",
      scope: "Rozsah",
      query: "Čo hľadať",
      queryPlaceholder: "zmena hesla, registrácia hráča…",
      queryHint: "Jedna otázka alebo téma; server vráti najviac 10 článkov.",
      search: "Hľadať",
      nothingFound: "Server nič nenašiel.",
      errorBefore: "Hľadanie zlyhalo: ",
      pick: n => `Vybrať články (${n})`,
      alreadySame: "V knižnici už je, bez zmeny na serveri.",
      alreadyChanged: "V knižnici už je — na serveri sa odvtedy zmenil; import založí koncept nového znenia.",
      open: "Otvoriť",
      metaNote: "Platí pre všetky nové dokumenty z tohto výberu; pri existujúcich sa metadáta nemenia.",
      folder: "Priečinok",
      folderNone: "Bez priečinka",
      accessHint: "Článok z vývojárskej dokumentácie je interný, kým ho kurátor neprepíše pre verejnosť.",
      import: "Importovať vybrané",
      afterNote: "Z každého článku vznikne koncept s PDF a textom; otvor ho, uprav a pošli na schválenie.",
      done: (created, versions, unchanged, failed) => `Import hotový: ${created} nových, ${versions} nových znení, ${unchanged} bez zmeny, ${failed} zlyhalo.`,
      pdfOrigin: (connector, path) => `Zdroj: ${connector} · ${path}`,
      sourceHeading: "Zdroj",
      sourceLine: (connector, group, date) => `Z konektora ${connector}${group ? ` (${group})` : ""}, stiahnuté ${date}.`,
      sourcePath: "Cesta na serveri",
      resync: "Skontrolovať zmeny na serveri",
      resyncHint: "Článok sa stiahne znova; keď sa zmenil, vznikne koncept nového znenia. Zverejnené sa nemení.",
      resyncUnchanged: "Na serveri sa nič nezmenilo.",
      resyncVersion: "Článok sa zmenil — koncept nového znenia je pripravený.",
    },
    faq: {
      newHeading: "Nové FAQ – časté otázky",
      newIntro: "FAQ sa nenahráva ako súbor. Založ ho tu, potom pridávaj záznamy: otázku, odpoveď a predpis, z ktorého odpoveď vychádza. Zverejnenie prejde schválením ako každé iné znenie.",
      newLink: "Časté otázky (FAQ) sa nenahrávajú ako súbor — založ ich tu →",
      create: "Založiť FAQ",
      created: "FAQ je založené. Pridaj prvý záznam.",
      heading: "Záznamy FAQ",
      intro: "Jeden záznam je jedna otázka a odpoveď. Asistent z každého záznamu urobí jeden úsek; prístup k záznamu je najprísnejší z prístupu tohto FAQ a jeho zdrojov.",
      empty: "Zatiaľ žiadny záznam.",
      addHeading: "Nový záznam",
      editHeading: (n: number) => `Záznam ${n}`,
      question: "Otázka",
      questionHint: "Tak, ako ju ľudia kladú — jedna veta.",
      variants: "Ďalšie znenia otázky",
      variantsHint: "Každé na nový riadok. Pomáhajú nájsť odpoveď aj na inak položenú otázku.",
      answer: "Odpoveď",
      answerHint: "Úplná odpoveď, ktorú by helpdesk poslal e-mailom. Bez osobných údajov.",
      sources: "Zdroje",
      sourcesHint: "Predpisy, z ktorých odpoveď vychádza. Keď niektorý dostane nové znenie, záznam sa označí na kontrolu.",
      sourceDocument: "Dokument",
      sourceNone: "— bez zdroja —",
      sourceArticle: "Článok",
      sourceArticlePlaceholder: "napr. čl. 12 ods. 3",
      audience: "Pre koho",
      audienceHint: "Roly, ktorým je odpoveď určená, oddelené čiarkou: klubový manažér, rozhodca, tréner…",
      save: "Uložiť záznam",
      add: "Pridať záznam",
      remove: "Odstrániť",
      saved: "Záznam je uložený. Zverejní sa so znením po schválení.",
      removed: "Záznam je odstránený z konceptu.",
      stateNew: "nový, nezverejnený",
      stateChanged: "zmenený oproti zverejnenému",
      statePublished: "zverejnený",
      stateSourceChanged: "zdroj dostal nové znenie — skontroluj odpoveď",
      access: (level: string) => `prístup: ${level}`,
      count: (n: number) => (n === 1 ? "1 záznam" : n >= 2 && n <= 4 ? `${n} záznamy` : `${n} záznamov`),
      editEntries: "Upraviť záznamy",
      openEntries: "záznamy FAQ →",
      pdfNote: "PDF a text znenia sa skladajú zo záznamov pri každom uložení (ADR-011); nič sa nenahráva.",
      publishNote: "Zmeny záznamov sú koncept. Zverejnia sa postupom znenia na detaile dokumentu: údaje o znení, schválenie, zverejnenie.",
      mdIntro: "Časté otázky a odpovede. Odpoveď vychádza z uvedených predpisov v znení platnom ku dňu zverejnenia.",
      mdQuestion: "Otázka",
      mdVariants: "Ďalšie znenia otázky",
      mdAnswer: "Odpoveď",
      mdSources: "Zdroje",
      mdAudience: "Pre koho",
      mdEmpty: "Zatiaľ bez záznamov.",
      pdfPage: (n: number, total: number) => `strana ${n} z ${total}`,
    },
    upload: {
      sectionFile: "Súbor",
      sectionMeta: "Metadáta",
      dropHint: "Presuňte súbor sem, alebo ho vyberte.",
      pick: "Vybrať súbor",
      heading: "Nahrať dokument",
      intro: "Schvaľuje a potvrdzuje sa PDF — tak, ako ho ľudia uvidia, aj s prílohami. K nemu pridaj upraviteľný zdroj (Word, Excel…): z neho vznikne text na vyhľadávanie a pri ďalšom znení z neho budeš vychádzať. Oba súbory sa uložia tak, ako prišli.",
      file: "Súbor",
      errorBefore: "Dokument sa nenahral: ",
      errorFileAgain: "Vyberte súbor znova — prehliadač ho z bezpečnostných dôvodov neuchová.",
      maxSize: mb => `najviac ${mb} MB`,
      oldFormatsBefore: "Staré ",
      oldFormatsMiddle: " a ",
      oldFormatsAfter: " sa previesť nedajú — ulož ich vo Worde alebo Exceli ako novší formát. Skenované PDF bez textu sa dá dať prepísať jazykovým modelom až v editore.",
      title: "Názov",
      titlePlaceholder: "Súťažný poriadok futbalu SFZ",
      titleNote: "Objaví sa doslovne v potvrdzovacej formulke, takže nech je to celý úradný názov.",
      key: "Kľúč dokumentu",
      keyPreview: "Identifikátor:",
      keyManualSummary: "Zadať kľúč ručne",
      keyManualNote: "Kľúč vzniká raz a nikdy sa nemení — žije v potvrdeniach, audite a exportoch. Premenovanie dokumentu ho nemení.",
      keyTaken: "Identifikátor {id} je obsadený. Upravte názov, alebo zadajte kľúč ručne.",
      keysTaken: "Obsadené kľúče v tejto organizácii: ",
      categoryNote: "Zoskupuje dokumenty v knižnici a vo filtroch. Existujúce: ",
      moreFields: "Ďalšie údaje",
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
      submitPending: "Nahrávam a prevádzam…",
      submitPendingNote: "Súbor sa prevádza na text. Pri väčšom dokumente to môže trvať aj minútu — stránku nezatváraj.",
      change: "Zmeniť",
      optional: "nepovinné",
      pickPdfFirst: "Najprv vyber PDF.",
      prefillFromWord: "Zdroj je dokument Word — prázdne polia sa predvyplnia z tabuľky na jeho prvej strane (Schválil, Dátum schválenia, Dátum účinnosti). Potvrdíš ich na detaile.",
      pdfTitle: "PDF — schvaľovaná podoba (povinné)",
      pdfNote: "Takto dokument uvidia schvaľovatelia aj zamestnanci — vrátane príloh, formulárov a obrázkov. Vo Worde: Súbor → Uložiť ako → PDF.",
      sourceTitle: "Upraviteľný zdroj (odporúčané)",
      sourceNote: "Word, Excel, Markdown alebo text. Z neho vznikne čistejší text na vyhľadávanie a je to predloha, z ktorej sa pripraví ďalšie znenie.",
      noScriptLimit: mb => `bez JavaScriptu najviac ${mb} MB`,
      uploadingFile: "Nahrávam {name} — {percent} %",
      uploadFailed: "Nahratie zlyhalo:",
      fileTooLarge: "{name} má {mb} MB, strop je {maxMb} MB.",
    },
  },

  learning: {
    statusFilter: "Filter podľa stavu",
    off: {
      title: "Vzdelávanie nie je pre vašu organizáciu zapnuté",
      lead: "Kurzy, testy a certifikáty tu uvidíte, keď ho organizácia zapne. Povinné normy na potvrdenie nájdete v Úlohách.",
      admin: contact => `Modul zapína prevádzkovateľ Contineo. Napíšte na ${contact}.`,
      tasks: "Otvoriť úlohy",
      back: "Späť na Prehľad",
    },
    heading: "Vzdelávanie",
    intro: "Kurzy, ktoré máš pridelené, a otvorené kurzy, na ktoré sa môžeš zapísať.",
    empty: "Zatiaľ tu nemáte žiadny kurz",
    emptyNote: "Keď vám organizácia pridelí kurz alebo otvorí kurz na zápis, uvidíte ho tu. Nič netreba robiť.",
    manageHeading: "Správa kurzov",
    manageIntro: "Kurzy, témy a smart:tagy organizácie.",
    manageEmpty: "Zatiaľ tu nie je žiadny kurz.",
    manageEmptyNote: "Zakladanie kurzov pribudne v ďalšej časti modulu.",
    testsHeading: "Testy",
    testsIntro: "Banka otázok, testy a výsledky testov, za ktoré zodpovedáš.",
    testsEmpty: "Zatiaľ tu nie je žiadny test.",
    testsEmptyNote: "Banka otázok a testy pribudnú v ďalšej časti modulu.",
    groupInProgress: "Rozpracované",
    groupToEnroll: "Na zápis",
    groupDone: "Dokončené",
    statusInProgress: "Rozpracovaný",
    statusAssigned: "Pridelený",
    statusOpen: "Otvorený na zápis",
    statusDone: "Dokončený",
    continue: "Pokračovať",
    start: "Začať",
    enrol: "Zapísať sa",
    certificate: "Certifikát",
    openCourse: "Otvoriť kurz",
    next: (n, title) => `Ďalej: Časť ${n} · ${title}`,
    assignedOn: (date, who) => `Pridelené ${date} · ${who}`,
    assignedOnNoWho: date => `Pridelené ${date}`,
    openNote: "Kurz je otvorený — zapísať sa môže ktokoľvek v organizácii.",
    noCertificate: "Kurz nevydáva certifikát.",
    doneOn: date => `Dokončené ${date}`,
    archivedNote: "Kurz bol archivovaný — dokončiť ho môžete.",
    minutes: n => {
      const m = (k: number) => `${k} ${k === 1 ? "minúta" : k <= 4 ? "minúty" : "minút"}`
      const h = Math.floor(n / 60)
      if (!h) return `približne ${m(n)}`
      return `približne ${h} ${h === 1 ? "hodina" : h <= 4 ? "hodiny" : "hodín"}${n % 60 ? ` ${m(n % 60)}` : ""}`
    },
    parts: (n, required) => `${n} ${n === 1 ? "časť" : n <= 4 ? "časti" : "častí"}` +
      (required === n ? "" : `, z toho ${required} ${required === 1 ? "povinná" : required <= 4 ? "povinné" : "povinných"}`),
    issuesCertificate: "certifikát",
    progress: (done, total) => `${done} z ${total} povinných častí`,
    nothingWaiting: "Nič nečaká",
    nothingWaitingNote: "Všetky kurzy máte dokončené. Keď pribudne nový, uvidíte ho tu.",
    filterNone: names => `Filtru ${names} nevyhovuje žiadny kurz.`,
    clearFilters: "Zrušiť filtre",
    topic: "Téma",
    allTopics: "Všetky",
    smartTags: "smart:tagy",
    selected: n => `vybraté ${n}`,
    filterNote: "Rôzne kľúče musia platiť všetky, z hodnôt jedného kľúča stačí jedna.",
    enrolled: title => `Ste zapísaný do kurzu „${title}“.`,
    removeFilter: name => `Zrušiť filter ${name}`,
    course: {
      yourProgress: "Váš postup",
      countOf: (d, n) => `${d} z ${n}`,
      requiredParts: "povinných častí",
      startCourse: "Začať",
      continueHere: "Pokračovať tu",
      kvVersion: "Verzia",
      kvEnrolled: "Zapísaný od",
      enrolledVia: { assignment: "pridelením", self: "samozápisom" },
      kvLanguage: "Jazyk obsahu",
      kvEstimate: "Odhad času",
      kvCertificate: "Certifikát",
      kvOrder: "Poradie častí",
      yes: "áno",
      no: "nie",
      orderSequential: "postupne",
      orderAny: "ľubovoľne",
      aboutCourse: "O kurze",
      partsHeading: "Časti kurzu",
      partsNoteSequential: "Časti sa otvárajú postupne.",
      partsNoteAny: "Časti môžete prechádzať v ľubovoľnom poradí.",
      partRequired: "Povinná",
      partOptional: "Nepovinná",
      blocks: n => `${n} ${n === 1 ? "blok" : n <= 4 ? "bloky" : "blokov"}`,
      blockTypes: { image: "obrázok", gallery: "galéria", document: "dokument", video: "video", videoExternal: "video externé" },
      mustWatchVideo: m => `povinné video ${m} ${m === 1 ? "minúta" : m <= 4 ? "minúty" : "minút"}`,
      partDoneOn: date => `Hotová ${date}`,
      partAvailable: "Dostupná",
      partLockedAfter: n => `Sprístupní sa po časti ${n}`,
      partInProgress: "rozpracovaná",
      partInProgressVideo: p => `rozpracovaná — video pozreté ${p} %`,
      testLabel: "Test",
      testRequired: "povinný",
      testOptional: "nepovinný",
      testNotStarted: "nespustený",
      testPassed: "prešiel",
      noticeDone: date => `Kurz ste dokončili ${date}.`,
      noticeNewVersion: (v, date, mine) => `Kurz má novú verziu ${v} (zverejnená ${date}). Dokončujete verziu ${mine}, do ktorej ste sa zapísali — nič netreba robiť.`,
      noticeArchived: "Kurz bol archivovaný — dokončiť ho môžete. Nikto nový sa doň už nezapíše.",
      versionN: n => `verzia ${n}`,
      enrolledSince: date => `zapísaný od ${date}`,
      notEnrolledNote: "Kurz je otvorený — zapísať sa môže ktokoľvek v organizácii. Časti sa sprístupnia po zapísaní.",
      previewNotice: v => `Náhľad verzie ${v} tak, ako ju uvidí študent. Nič sa nezapisuje a test sa nedá spustiť.`,
      previewEdit: "Upraviť kurz",
      previewSide: "Náhľad — zápis a postup sa v ňom nevedú.",
    },
    part: {
      nextPart: "Ďalšia",
      docKicker: "Dokument z knižnice",
      openPdf: "Otvoriť PDF",
      docDetail: "Detail v knižnici",
      docMissing: "Toto znenie v knižnici už nie je.",
      externalChip: "Externé video · dopozeranie sa neoveruje",
      externalBad: "Video sa nedá vložiť — adresa nie je podporovaná.",
      play: "Prehrať",
      pause: "Pozastaviť",
      mute: "Stlmiť",
      unmute: "Zapnúť zvuk",
      fullscreen: "Celá obrazovka",
      progress: "Priebeh videa",
      mustWatchChip: "Povinné dopozeranie · pozreté {p} %",
      mustWatchNote: "Dopredu sa dá pretáčať len po miesto, ktoré ste už videli. Treba aspoň 90 %.",
      watchedChip: "Dopozerané",
      noScriptNote: "Bez JavaScriptu sa dopozeranie nezaznamená.",
      testsHeading: "Testy tejto časti",
      testStart: "Spustiť",
      markDone: "Označiť ako prejdené",
      markReady: "Po označení je časť hotová.",
      nextPartLink: "Ďalšia časť →",
      previewDock: "Náhľad — časť sa nedá označiť ako prejdená a test sa nespúšťa.",
      optionalTestNote: "Nepovinný test môžete spraviť kedykoľvek.",
      testsJump: "Testy ↓",
      marked: "Časť je označená ako prejdená.",
      partOf: (n, total) => `Časť ${n} z ${total}`,
      docNewer: label => `Platné je už ${label}.`,
      markDisabledVideo: p => `Najprv dopozerajte povinné video — pozreté ${p} %, treba aspoň 90 %.`,
      markedWaitingTest: date => `Označené ${date} · časť bude hotová po prejdení povinného testu.`,
      partDone: date => `Časť je hotová · ${date}`,
      requiredTestSummary: state => `Povinný test: ${state}`,
    },
    manage: {
      tabsLabel: "Správa kurzov",
      tabCourses: "Kurzy",
      tabTopics: "Témy",
      tabTags: "smart:tagy",
      newCourse: "Nový kurz",
      statusAll: "Všetky",
      statusDraft: "Koncept",
      statusPublished: "Zverejnený",
      statusArchived: "Archív",
      colCourse: "Kurz",
      colTopic: "Téma",
      colStatus: "Stav",
      colEnrolled: "Zapísaní",
      colCompleted: "Dokončili",
      colUpdated: "Upravené",
      edit: "Upraviť",
      openEnrollment: "otvorený na zápis",
      courseTitle: "Názov kurzu",
      courseKey: "Kľúč v adrese",
      keyHint: "Kľúč je v adrese kurzu (/learning/…) a nemení sa ani so zmenou názvu.",
      keyTaken: "Kurz s takým kľúčom už existuje.",
      topic: "Téma",
      topicNone: "Najprv pridajte tému v záložke Témy.",
      create: "Vytvoriť koncept",
      cancel: "Zrušiť",
      emptyText: "Kurz vznikne ako koncept — časti, bloky a nastavenia doplníte pred zverejnením. Téma musí existovať v záložke Témy.",
      topicsHeading: "Témy kurzov",
      rename: "Premenovať",
      retire: "Vyradiť",
      restore: "Vrátiť",
      retired: "vyradená",
      newTopic: "Nová téma",
      topicName: "Názov témy",
      topicKey: "Kľúč",
      addTopic: "Pridať tému",
      topicsEmpty: "Zatiaľ tu nie je žiadna téma. Kurz potrebuje práve jednu.",
      topicAdded: "Téma je pridaná.",
      topicRenamed: "Téma je premenovaná.",
      topicRetired: "Téma je vyradená z ponuky. Kurzy si ju nechajú.",
      topicRestored: "Téma je späť v ponuke.",
      save: "Uložiť",
      tagsIntro: "smart:tag sa tu nevytvára — vzniká tam, kde sa prvýkrát napíše: pri kurze, otázke alebo teste.",
      tagsEmpty: "Zatiaľ sa nepoužíva žiadny smart:tag.",
      renameKey: "Premenovať kľúč",
      newValue: "Nový zápis",
      mergeButton: "Zlúčiť",
      mergeInto: "Zlúčiť do…",
      clearSelection: "Zrušiť výber",
      mergeSelected: "Zlúčiť vybraté",
      whatStays: "Čo zostane",
      newEntry: "Nový zápis",
      keyLabel: "Nový názov kľúča",
      selectTag: "Vybrať na zlúčenie",
      tagPlaceholder: "Kľúč: Hodnota",
      topicCourses: n => `${n} ${n === 1 ? "kurz" : n >= 2 && n <= 4 ? "kurzy" : "kurzov"}`,
      enrolledCompleted: (e, c) => `${e} ${e === 1 ? "zapísaný" : e >= 2 && e <= 4 ? "zapísaní" : "zapísaných"} · ${c} ${c === 1 ? "dokončil" : c >= 2 && c <= 4 ? "dokončili" : "dokončilo"}`,
      usage: (c, q, t) => `kurzy ${c} · otázky ${q} · testy ${t}`,
      impact: (c, q, t) => {
        const n = c + q + t
        const k = (x: number, one: string, few: string, many: string) => `${x} ${x === 1 ? one : x >= 2 && x <= 4 ? few : many}`
        return `Zmení sa všade — na ${n} ${n === 1 ? "mieste" : "miestach"} (${k(c, "kurz", "kurzy", "kurzov")}, ${k(q, "otázka", "otázky", "otázok")}, ${k(t, "test", "testy", "testov")}), vrátane filtrov sekcií testov.`
      },
      exists: label => `„${label}“ už existuje — zlúčia sa do jedného tagu.`,
      renamed: label => `Premenované na „${label}“.`,
      selected: n => `Vybraté ${n}`,
      mergeTitle: n => `Zlúčiť ${n} ${n <= 4 ? "smart:tagy" : "smart:tagov"} do jedného`,
      mergeResult: target => `Vybrané tagy zmiznú, zostane „${target}“. Kurz, otázka či test, ktorý ich mal viac, dostane „${target}“ raz.`,
      merged: (n, target) => `Zlúčené: ${n} ${n <= 4 ? "tagy" : "tagov"} → ${target}.`,
    },
    edit: {
      settingsSaved: "Nastavenia sú uložené.",
      stepsLabel: "Stav verzie kurzu",
      missingHeading: "Na zverejnenie chýba",
      readyHeading: "Pripravené na zverejnenie",
      checkParts: "Časti a bloky",
      checkLegal: "Právny základ (Nastavenia)",
      checkTopic: "Téma",
      publishDisabledNote: "Najprv doplňte, čo chýba.",
      publishedLead: "Zverejnená verzia sa nemení. Zmena = nová verzia (kópia).",
      newVersion: "Nová verzia",
      archive: "Archivovať",
      restore: "Obnoviť ako novú verziu",
      cannotPublish: "Kurz sa zatiaľ nedá zverejniť — pozrite, čo chýba.",
      archived: "Kurz je archivovaný. Rozpracovaní ho dokončia.",
      tabParts: "Časti",
      tabSettings: "Nastavenia",
      tabPeople: "Zapísaní",
      partsHeading: "Časti kurzu",
      up: "Posunúť vyššie",
      down: "Posunúť nižšie",
      editPart: "Upraviť",
      view: "Zobraziť",
      newPart: "Nová časť",
      partTitle: "Názov časti",
      required: "Povinná",
      addPart: "Pridať časť",
      noParts: "Kurz zatiaľ nemá žiadnu časť",
      allParts: "← Všetky časti",
      removePart: "Odobrať časť",
      save: "Uložiť",
      minutes: "Odhad času (minúty)",
      summary: "Krátky popis",
      blocksHeading: "Bloky",
      noBlocks: "Časť zatiaľ nemá žiadny blok.",
      addBlock: "Pridať blok",
      blockType: "Typ bloku",
      markdown: "Text",
      alt: "Popis obrázka",
      altGallery: "Popis obrázkov",
      caption: "Popisok pod obrázkom",
      document: "Dokument z knižnice",
      videoSource: "Zdroj videa",
      sourceUpload: "Nahrať MP4 alebo WebM (do 25 MB)",
      sourceExternal: "Externý odkaz",
      url: "Adresa videa (YouTube, Vimeo, https)",
      mustWatch: "Povinné dopozeranie",
      mustWatchNote: "Pretáčanie dopredu sa vypne; časť sa dá označiť až po pozretí 90 %.",
      externalWarn: "Pri externom videu sa dopozeranie neoverí. Ak ho potrebujete, nahrajte MP4.",
      removeBlock: "Odobrať",
      add: "Pridať",
      mediaImage: "Obrázok (JPG, PNG, WebP, GIF)",
      mediaVideo: "Video MP4 alebo WebM (do 25 MB)",
      mediaNote: "Súbor sa nahrá pri pridaní bloku.",
      progressTitle: "Nahrávam súbor",
      uploading: "Nahrávam {name} — {percent} %",
      uploadFailed: "Nahratie zlyhalo:",
      tooLarge: "{name} má {mb} MB, strop je {maxMb} MB.",
      testsHeading: "Testy časti",
      testsLater: "Testy sa budú dať priradiť, keď pribudne banka otázok a testov.",
      mustWatchShort: "povinné dopozeranie",
      cancel: "Zrušiť",
      editBlock: "Upraviť",
      noDocuments: "V knižnici zatiaľ nie je dokument s platným znením.",
      optional: "Nepovinná",
      steps: ["Koncept", "Zverejnené", "Archív"],
      stepSub: { draft: n => `verzia ${n}`, published: n => `verzia ${n}`, archived: n => `verzia ${n}` },
      blockTypes: { text: "Text", image: "Obrázok", gallery: "Galéria", document: "Dokument z knižnice", video: "Video", videoExternal: "Video externé" },
      problem: (code, part) => ({
        noTitle: "Kurz nemá názov.",
        noParts: "Kurz nemá žiadnu časť.",
        noRequiredPart: "Aspoň jedna časť musí byť povinná.",
        emptyPart: `Časť „${part}“ nemá žiadny blok.`,
        badPartKey: `Časť „${part}“ má neplatný kľúč.`,
        duplicatePartKey: `Časť „${part}“ je v kurze dvakrát.`,
        videoWithoutDuration: `Povinné video v časti „${part}“ nemá dĺžku — nahrajte ho znova.`,
        mustWatchExternal: `Externé video v časti „${part}“ nemôže mať povinné dopozeranie.`,
        testNotReady: `Test v časti „${part}“ nie je pripravený.`,
        noIssuer: "Chýba vydavateľ certifikátu.",
        noLegalBasis: "Chýba právny základ — doplňte ho v Nastaveniach.",
      } as Record<string, string>)[code] ?? code,
      publishButton: n => `Zverejniť verziu ${n}`,
      keepPublished: (prev, next) => `Verzia ${prev} zostáva zverejnená, kým nezverejníte túto. Zapísaní vo v${prev} ju dokončia; noví sa zapíšu do v${next}.`,
      archivedLead: n => `Nikto nový sa nezapíše. Rozpracovaní dokončia svoju verziu (${n}).`,
      published: n => `Verzia ${n} je zverejnená.`,
      newVersionStarted: n => `Vznikol koncept verzie ${n} — kópia poslednej verzie.`,
      blocksTests: (b, t) => `${b} ${b === 1 ? "blok" : b >= 2 && b <= 4 ? "bloky" : "blokov"}${t ? ` · ${t} ${t === 1 ? "test" : t <= 4 ? "testy" : "testov"}` : ""}`,
      readOnly: n => `Verzia ${n} je zverejnená — časti a bloky sú len na čítanie. Zmeny: Nová verzia.`,
      savedAt: date => `Uložené ${date}`,
      statusDraftReady: v => `Koncept v${v} · pripravený na zverejnenie`,
      statusDraftMissing: (v, n) => `Koncept v${v} · ${n === 1 ? "1 vec chýba" : n <= 4 ? `${n} veci chýbajú` : `${n} vecí chýba`}`,
      statusPublished: v => `Zverejnené v${v}`,
      statusArchived: "Archív",
      statusLabel: "Stav verzie — prehľad kurzu",
      previewAsStudent: "Náhľad ako študent",
      archiveOpen: "Archivovať…",
      archiveTitle: t => `Archivovať kurz ${t}?`,
      archiveNoNew: "Nikto nový sa nezapíše, kurz zmizne z ponuky.",
      archiveInProgress: (n, v) => `${n} ${n === 1 ? "rozpracovaný ho dokončí" : "rozpracovaní ho dokončia"} vo verzii ${v}.`,
      archiveKeeps: "Certifikáty a výsledky ostávajú.",
      archiveRestoreNote: "Kurz sa dá neskôr obnoviť ako nová verzia.",
      archiveButton: "Archivovať kurz",
      removePartOpen: "Odstrániť časť…",
      removePartTitle: (t, b, n) => `Odstrániť časť „${t}“${b || n ? ` s ${[b ? `${b} ${b === 1 ? "blokom" : "blokmi"}` : "", n ? `${n} ${n === 1 ? "testom" : "testami"}` : ""].filter(Boolean).join(" a ")}` : ""}?`,
      removePartNote: v => `Časť zmizne z konceptu v${v}. Zverejnené verzie sa nemenia.`,
      removePartButton: "Odstrániť časť",
      blockMenuNote: { document: "znenie", video: "MP4 / odkaz" },
      newBlockHeading: t => `Nový blok · ${t}`,
      blockHeading: (n, t) => `Blok ${n} · ${t}`,
      saveBlock: "Uložiť blok",
      removeBlockButton: "Odstrániť blok",
      removeBlockNote: (d, p) => `Blok zmizne z konceptu v${d}.${p ? ` Verzia ${p} sa nemení.` : ""}`,
      noEditBlock: "Tento typ bloku sa nedá upraviť — odstráňte ho a pridajte nový.",
      sourceExternalSub: "YouTube, Vimeo, stream",
      partGroup: "Časť",
      savePart: "Uložiť časť",
      saveTests: "Uložiť testy",
      testsSaved: "Testy časti sú uložené.",
      partSaved: "Časť je uložená.",
    },
    settings: {
      title: "Názov kurzu",
      keyNote: "Kľúč v adrese sa po vytvorení nemení.",
      subtitle: "Podnázov",
      description: "Popis",
      topic: "Téma",
      language: "Jazyk obsahu",
      languageNote: "Kurz v inom jazyku je iný kurz.",
      estimate: "Odhad času (minúty)",
      smartTags: "smart:tagy",
      groupFlow: "Priebeh",
      sequential: "Časti idú postupne",
      sequentialNote: "Ďalšia časť sa otvorí až po hotovej predošlej povinnej.",
      openEnrollment: "Otvorený na zápis",
      openEnrollmentNote: "Kurz sa ponúkne každému v organizácii v „Na zápis“.",
      issuesCertificate: "Vydáva certifikát",
      signerName: "Podpisuje za vydavateľa — meno",
      signerRole: "Funkcia",
      groupLegal: "Právny základ",
      legalNote: "Postup, pokusy a výsledky kurzu sú osobné údaje — bez právneho základu sa kurz nezverejní.",
      legalNone: "— vyberte —",
      save: "Uložiť nastavenia",
      tagPlaceholder: "Kľúč: Hodnota",
      tagNewKey: "Nový kľúč „{k}“",
      tagNewValue: "Nová hodnota „{v}“",
      tagRemove: "Odobrať {t}",
      tagValues: "hodnoty: {n}",
      tagField: "smart:tagy kurzu",
      tagNoScript: "Jeden smart:tag na riadok v tvare Kľúč: Hodnota.",
      none: "—",
      readOnly: n => `Verzia ${n} je zverejnená — nastavenia sú len na čítanie. Zmeny: Nová verzia.`,
    },
    people: {
      filterAll: "Všetci",
      notStarted: "Nezačali",
      inProgress: "Rozpracovaní",
      done: "Dokončili",
      assign: "Prideliť kurz",
      exportCsv: "Export CSV",
      colName: "Meno",
      colEmail: "E-mail",
      colDepartment: "Oddelenie",
      colEnrollment: "Zápis",
      colState: "Stav",
      colActivity: "Posledná aktivita",
      stateNotStarted: "nezačal",
      empty: "Do kurzu zatiaľ nie je nikto zapísaný.",
      assignHeading: "Prideliť kurz",
      everyone: "Všetkým v organizácii",
      everyoneNote: "aj tým, ktorí pribudnú, keď sa pridelí znova",
      departments: "Oddeleniam",
      groups: "Skupinám",
      tracks: "Trase",
      tracksNote: "Zapíšu sa ľudia, ktorí trasu majú — ako pri norme.",
      check: "Skontrolovať dopad",
      notPublished: "Prideliť sa dá len zverejnený kurz.",
      nobody: "Výberu nezodpovedá nikto.",
      cancel: "Zrušiť",
      stateProgress: (d, t) => `${d} z ${t} častí`,
      stateDone: date => `dokončil ${date}`,
      summary: (n, v, m) => `Zapíše sa ${n} ${n === 1 ? "človek" : n >= 2 && n <= 4 ? "ľudia" : "ľudí"} do verzie ${v}${m ? ` · ${m} ${m === 1 ? "je" : "sú"} už ${m === 1 ? "zapísaný" : "zapísaní"} a nič sa ${m === 1 ? "mu" : "im"} nezmení` : ""}.`,
      assignButton: n => `Prideliť ${n} ${n === 1 ? "človeku" : "ľuďom"}`,
      assigned: (n, m) => `Zapísaní noví: ${n}, už zapísaní: ${m}.`,
    },
    tests: {
      tabsLabel: "Testy",
      tabTests: "Testy",
      tabQuestions: "Banka otázok",
      tabResults: "Výsledky",
      newTest: "Nový test",
      testTitle: "Názov testu",
      testKey: "Kľúč testu",
      create: "Vytvoriť test",
      cancel: "Zrušiť",
      statusAll: "Všetky",
      statusReady: "Pripravené",
      statusDraft: "Koncepty",
      statusRetired: "Vyradené",
      tagReady: "Pripravený",
      tagDraft: "Koncept",
      tagShort: "Nedostatok otázok",
      tagRetired: "Vyradený",
      colTest: "Test",
      colSections: "Sekcie",
      colQuestions: "Otázok",
      colPassing: "Hranica",
      colResponsible: "Zodpovedné osoby",
      colStatus: "Stav",
      edit: "Upraviť",
      nobody: "nikto — nedá sa pripraviť",
      testsEmpty: "Zatiaľ tu nie je žiadny test.",
      testsEmptyNote: "Test je recept: sekcie vyberajú otázky z banky podľa smart:tagov.",
      groupBase: "Základ",
      instructions: "Inštrukcie",
      responsibleLegend: "Zodpovedné osoby",
      responsibleNote: "Vidia výsledky svojho testu a smú resetovať pokusy. Personálne oddelenie výsledky nevidí.",
      noResponsible: "Bez zodpovednej osoby sa test nedá pripraviť.",
      groupSections: "Sekcie",
      sectionFilter: "smart:tagy sekcie",
      sectionCount: "Počet otázok",
      showInBank: "Zobraziť v banke",
      addQuestions: "Pridať otázky →",
      addSection: "Pridať sekciu",
      removeSection: "Odstrániť",
      sectionsNote: "Otázky sa losujú pri každom pokuse, odpovede sa miešajú. Rôzne kľúče musia platiť všetky, z hodnôt jedného kľúča stačí jedna.",
      groupRules: "Pravidlá",
      passing: "Hranica úspešnosti (%)",
      timeLimit: "Limit času (minúty)",
      maxAttempts: "Najviac pokusov",
      pause: "Pauza medzi pokusmi (minúty)",
      showAnswers: "Kedy ukázať správne odpovede",
      showNever: "Nikdy",
      showAfterSubmit: "Po odovzdaní",
      showAfterPass: "Po prejdení",
      showAfterLast: "Po vyčerpaní pokusov",
      emptyMeansNone: "Prázdne = bez obmedzenia.",
      testTags: "smart:tagy testu (na hľadanie, losovanie nemenia)",
      save: "Uložiť",
      statusCard: "Stav testu",
      checkResponsible: "Zodpovedné osoby",
      checkSections: "Každá sekcia má dosť otázok",
      checkRules: "Pravidlá vyplnené",
      statusNote: "Hovorí sa to pri uložení, nie pri pokuse.",
      usedIn: "Použité v",
      usedNone: "Test zatiaľ nie je v žiadnom kurze.",
      retire: "Vyradiť test",
      restore: "Vrátiť test",
      savedReady: "Test je uložený a pripravený.",
      savedDraft: "Test je uložený ako koncept — pozrite, čo chýba.",
      newQuestion: "Nová otázka",
      importCsv: "Import CSV",
      exportCsv: "Export CSV",
      bankEmpty: "Banka otázok je prázdna",
      bankEmptyNote: "Pridajte otázku alebo nahrajte CSV.",
      filterType: "Typ",
      filterStatus: "Stav",
      filterTags: "smart:tagy",
      statusActive: "Aktívne",
      statusRetiredQ: "Vyradené",
      clearFilters: "Zrušiť filtre",
      colQuestion: "Otázka",
      colType: "Typ",
      colWeight: "Váha",
      questionText: "Znenie",
      media: "Obrázky a videá v otázke",
      mediaNote: "Obrázky a videá sa nahrajú pri uložení otázky.",
      removeMedia: "Odobrať",
      mediaAlt: "Popis obrázka (pre nové obrázky)",
      answers: "Odpovede",
      correct: "správna",
      multipleNote: "Študent uvidí vetu „Táto otázka má viac správnych odpovedí“.",
      trueLabel: "Pravda",
      falseLabel: "Nepravda",
      expected: "Očakávaná odpoveď",
      alternatives: "Aj takto je správne",
      shortNote: "Porovnáva sa bez diakritiky a veľkosti písmen.",
      explanation: "Vysvetlenie",
      explanationNote: "Ukáže sa po odovzdaní, ak to test povoľuje.",
      weight: "Váha",
      difficulty: "Obtiažnosť",
      tagsLabel: "smart:tagy (aspoň jeden)",
      tagRequiredNote: "Bez smart:tagu otázku žiadny test nevylosuje.",
      saveQuestion: "Uložiť otázku",
      retireQ: "Vyradiť",
      restoreQ: "Vrátiť",
      questionSaved: "Otázka je uložená.",
      answerMediaLater: "Obrázky a videá v odpovediach pribudnú v ďalšej úprave.",
      importHeading: "Import otázok z CSV",
      importNote: "UTF-8, oddeľovač bodkočiarka, prvý riadok hlavička — stĺpce id, type, text, answer_1 … answer_8, correct, explanation, weight, difficulty, tags.",
      importFile: "Súbor CSV",
      importUpload: "Nahrať a skontrolovať",
      importErrorsNote: "Pri chybe sa neimportuje nič — opravte súbor a nahrajte ho znova.",
      colLine: "Riadok",
      colColumn: "Stĺpec",
      colProblem: "Chyba",
      mediaNoteImport: "Obrázky a videá sa pridajú pri otázke po importe.",
      importExpired: "Nahratý súbor už nie je k dispozícii — nahrajte ho znova.",
      templateLink: "Stiahnuť vzor CSV",
      noResponsiblePeople: "V organizácii nie je nikto, koho by sa dalo určiť.",
      keyTaken: "Test s takým kľúčom už existuje.",
      up: "Posunúť vyššie",
      down: "Posunúť nižšie",
      required: "povinný",
      optional: "nepovinný",
      types: { single: "Jedna správna", multiple: "Viac správnych", true_false: "Pravda / nepravda", short_text: "Krátky text" },
      difficulties: { easy: "Ľahká", medium: "Stredná", hard: "Ťažká" },
      sectionTitle: n => `Sekcia ${n}`,
      enough: n => `V banke vyhovuje ${n} ${n === 1 ? "otázka" : n >= 2 && n <= 4 ? "otázky" : "otázok"}`,
      short: (n, missing) => `V banke vyhovuje len ${n} ${n === 1 ? "otázka" : n >= 2 && n <= 4 ? "otázky" : "otázok"} — chýba ${missing}`,
      usedRow: (course, part, required, v) => `${course} · ${part} · ${required ? "povinný" : "nepovinný"} · verzia testu ${v ?? "—"}`,
      version: n => `verzia ${n}`,
      answer: n => `Odpoveď ${n}`,
      usage: (t, a) => `Použitá v ${t} ${t === 1 ? "teste" : "testoch"} · ${a} ${a === 1 ? "pokus ju cituje" : a >= 2 && a <= 4 ? "pokusy ju citujú" : "pokusov ju cituje"} snímkou`,
      importSummary: (total, created, updated, errors) => `${total} otázok · ${created} nových · ${updated} úprav · ${errors} ${errors === 1 ? "chyba" : errors >= 2 && errors <= 4 ? "chyby" : "chýb"}`,
      newTags: list => `Nové smart:tagy: ${list}`,
      importRun: n => `Importovať ${n} ${n === 1 ? "otázku" : n >= 2 && n <= 4 ? "otázky" : "otázok"}`,
      imported: (c, u) => `Importované: nových ${c}, upravených ${u}.`,
    },
    attempt: {
      factQuestions: "Otázok",
      factToPass: "Na prejdenie",
      factTime: "Limit času",
      factAttempt: "Pokus",
      noLimit: "bez limitu",
      ruleDraw: "Otázky sa pri každom pokuse vylosujú a odpovede zamiešajú.",
      ruleSave: "Odpovede sa priebežne ukladajú; čas beží ďalej aj pri výpadku.",
      start: "Spustiť test",
      blockedPassed: "Test máte prejdený.",
      backToPart: "Späť na časť",
      saving: "ukladá sa…",
      saveFailed: "neuložené — skúšame znova",
      multipleNote: "Táto otázka má viac správnych odpovedí — označte všetky.",
      shortNote: "Na diakritike a veľkých písmenách nezáleží.",
      videoNote: "Video nemusíte dopozerať — pretáčať môžete voľne, čas testu beží ďalej.",
      trueLabel: "Pravda",
      falseLabel: "Nepravda",
      prev: "← Späť",
      next: "Ďalej →",
      review: "Prehľad odpovedí",
      reviewHeading: "Prehľad odpovedí",
      unanswered: "nezodpovedaná",
      answered: "zodpovedaná",
      submit: "Odovzdať test",
      confirmTitle: "Odovzdať test?",
      confirmAll: "Všetky otázky sú zodpovedané. Po odovzdaní sa odpovede nedajú zmeniť.",
      cancelReview: "Späť k otázkam",
      timeUp: "Čas vypršal — test sa uzavrel s odpoveďami, ktoré ste stihli uložiť.",
      submitted: "Test je odovzdaný.",
      showResult: "Zobraziť výsledok",
      passedNotice: "Test ste prešli.",
      passedWord: "Prešiel",
      failedWord: "Neprešiel",
      factPassing: "Hranica",
      factRemaining: "Zostáva pokusov",
      factNext: "Ďalší pokus",
      unlimited: "bez obmedzenia",
      now: "hneď",
      retry: "Skúsiť znova",
      retryNote: "Otázky sa vylosujú znova.",
      toCourse: "Prehľad kurzu",
      reviewTitle: "Prehľad otázok",
      detailsPurged: "Otázky a odpovede tohto pokusu boli rok po dokončení kurzu odstránené. Výsledok zostáva.",
      filterAll: "Všetky",
      filterWrong: "Nesprávne",
      yourAnswer: "Vaša odpoveď",
      correctAnswer: "Správna odpoveď",
      noAnswer: "bez odpovede",
      hidden: "Správne odpovede sa nezobrazujú",
      attemptsSide: "Vaše pokusy",
      whoSees: "Kto vidí výsledok",
      continueTest: "Pokračovať",
      result: "Výsledok",
      tryAgain: "Skúsiť znova",
      assignTest: "Priradiť test",
      testRequired: "Povinný",
      removeTest: "Odobrať",
      noReadyTests: "Zatiaľ nie je žiadny pripravený test.",
      intro: "Úvod",
      answerLabel: "Odpoveď",
      multipleShort: "viac správnych",
      factDuration: "Čas",
      minutes: n => `${n} min`,
      attemptOf: (n, m) => (m ? `${n} z ${m}` : `${n}`),
      ruleShow: { never: "Správne odpovede sa nezobrazujú.", after_submit: "Správne odpovede uvidíte po odovzdaní.", after_pass: "Správne odpovede uvidíte po prejdení testu.", after_last_attempt: "Správne odpovede uvidíte po poslednom pokuse." },
      previous: (date, pct, passed) => `Predchádzajúci pokus ${date}: ${pct} % — ${passed ? "prešiel" : "neprešiel"}.`,
      blockedPause: time => `Ďalší pokus je možný o ${time} — test má pauzu medzi pokusmi.`,
      blockedExhausted: (n, names) => `Využili ste ${n} z ${n} pokusov. Ďalší pokus môže povoliť zodpovedná osoba testu${names ? ` — ${names}` : ""}.`,
      questionOf: (n, m) => `Otázka ${n} / ${m}`,
      remaining: t => `zostáva ${t}`,
      saved: t => `✓ uložené ${t}`,
      questionHead: (n, m, w) => `Otázka ${n} z ${m}${w > 1 ? ` · váha ${w}` : ""}`,
      reviewUnanswered: n => `Prehľad odpovedí · ${n} ${n === 1 ? "nezodpovedaná" : n >= 2 && n <= 4 ? "nezodpovedané" : "nezodpovedaných"}`,
      confirmText: (n, list) => `Nezodpovedané otázky: ${n} (${list}). Po odovzdaní sa odpovede nedajú zmeniť.`,
      noscriptDeadline: (start, end) => `Test ste spustili o ${start} — odovzdajte ho do ${end}. Po tomto čase server prijme len to, čo už bolo odoslané.`,
      kicker: (title, n, m, date) => `Test: ${title} · pokus ${n}${m ? ` z ${m}` : ""} · ${date}`,
      partDoneNotice: title => `Časť „${title}“ je hotová.`,
      failedNotice: (missing, pass) => `Neprešli ste — ${missing === 1 ? "chýba 1 percentuálny bod" : missing >= 2 && missing <= 4 ? `chýbajú ${missing} percentuálne body` : `chýba ${missing} percentuálnych bodov`} do hranice ${pass} %.`,
      points: (p, max) => `${p} z ${max} ${max === 1 ? "bodu" : "bodov"}`,
      passMark: p => `hranica ${p} %`,
      hiddenReason: { never: "Test správne odpovede neukazuje.", after_submit: "Ukážu sa po odovzdaní.", after_pass: "Ukážu sa po prejdení testu.", after_last_attempt: "Ukážu sa po poslednom pokuse." },
      wrongCount: n => `Nesprávne odpovede: ${n}.`,
      whoSeesText: names => `Vy a zodpovedné osoby testu${names ? ` (${names})` : ""}. Personálne oddelenie skóre nevidí.`,
      duration: s => `${Math.floor(s / 60)} min ${s % 60} s`,
      testOpen: (time, q, total) => `rozpracovaný · ${time ? `zostáva ${time}` : "bez limitu času"} · otázka ${q} z ${total}`,
      testPassedPct: p => `prešiel ${p} %`,
      testFailedPct: p => `neprešiel ${p} %`,
      nextAttemptAt: t => `ďalší pokus o ${t}`,
      attemptsLeft: (r, m) => `zostávajú ${r} z ${m}`,
      testMeta: (q, pass, att, names) => `${q} otázok · hranica ${pass} %${att ? ` · ${att} pokusy` : ""}${names ? ` · zodpovedá ${names}` : ""}`,
    },
    results: {
      selectTest: "Test",
      exportCsv: "Export CSV",
      colPerson: "Osoba",
      colContext: "Kurz / časť",
      colDate: "Dátum",
      colAttempt: "Pokus",
      colScore: "Skóre",
      colResult: "Výsledok",
      openState: "rozpracovaný",
      resetState: "resetovaný",
      reset: "Resetovať",
      resetText: "Pokusy sa nezmažú — označia sa ako resetované a človek môže test skúsiť znova. Zapíše sa do auditu.",
      reason: "Dôvod (povinný)",
      resetButton: "Resetovať pokusy",
      empty: "Test zatiaľ nikto neskúšal.",
      cancel: "Zrušiť",
      noTests: "Nezodpovedáte za žiadny test.",
      show: "Zobraziť",
      alsoResponsible: names => `Zodpovedajú aj: ${names}`,
      resetTitle: name => `Resetovať pokusy — ${name}`,
      resetDone: n => `Resetované pokusy: ${n}.`,
    },
    cert: {
      backToCertificate: "Späť na certifikát",
      registrationNumber: (n: string) => `IČO ${n}`,
      kicker: "Certifikát o absolvovaní kurzu",
      valid: "Platný",
      revoked: "Odvolaný",
      number: "Číslo",
      completed: "Dátum dokončenia",
      issuer: "Vydal",
      print: "Tlačiť",
      downloadPdf: "Stiahnuť PDF",
      backToCourse: "Späť na kurz",
      verifyHeading: "Overenie",
      verifyNote: "Kto má odkaz, uvidí číslo, kurz, dátum a vydavateľa — bez vášho mena.",
      copy: "Kopírovať odkaz",
      revokedPdf: "Pri odvolanom certifikáte sa PDF ani tlač neponúka.",
      sideVerify: "Čo overenie ukáže",
      sideVerifyText: "Číslo, kurz, dátum dokončenia a vydavateľa. Meno nie.",
      sideKeep: "Uchovanie",
      sideKeepText: "Vydaný certifikát sa nemaže a platí aj po skončení vzťahu so zväzom. Číslo ostane overiteľné.",
      notYet: "Certifikát sa vydá po dokončení kurzu.",
      noCertificate: "Kurz nevydáva certifikát.",
      show: "Zobraziť certifikát",
      vTitle: "Overenie certifikátu",
      vCourse: "Kurz",
      vIssuer: "Vydavateľ",
      vNameNote: "Meno držiteľa sa pri overení nezobrazuje. Porovnajte ho s menom na certifikáte, ktorý vám bol predložený.",
      vNotFound: "Certifikát sa nenašiel",
      vNotFoundText: "Skontrolujte odkaz alebo ho otvorte znova z certifikátu.",
      vSecurity: "Z bezpečnostných dôvodov neprezradíme, či certifikát s týmto číslom existuje.",
      vFooter: "Overenie cez Contineo",
      pdfTitle: "CERTIFIKÁT",
      pdfSub: "o absolvovaní kurzu",
      pdfVerify: "Overenie",
      signature: "podpis",
      colCertificate: "Certifikát",
      revoke: "Odvolať",
      revokeText: "Odvolanie sa nedá vrátiť. Verejné overenie ukáže „odvolaný“ bez dôvodu; držiteľ dôvod uvidí.",
      revokeReason: "Dôvod (povinný)",
      revokeButton: "Odvolať certifikát",
      revokedMsg: "Certifikát je odvolaný.",
      cancel: "Zrušiť",
      printNote: "Tlač nastavte na A4 na šírku. PDF s QR kódom si stiahnete na stránke certifikátu.",
      completedCourse: (title, v, s) => `${completedVerb(s)} kurz ${title} (verzia ${v})`,
      revokedNotice: (date, reason) => `Certifikát bol odvolaný ${date}. Dôvod: ${reason}`,
      vValid: issuer => `Certifikát je platný — vydal ho ${issuer} a nebol odvolaný.`,
      vRevoked: date => `Certifikát bol odvolaný — ${date}.`,
      pdfConfirms: org => `${org} potvrdzuje, že`,
      pdfCompleted: (title, s) => `úspešne ${completedVerb(s)} kurz ${title}`,
      pdfMeta: (v, parts, tests, date) => `verzia ${v} · ${parts} ${parts === 1 ? "časť" : parts <= 4 ? "časti" : "častí"}${tests ? ` · ${tests} ${tests === 1 ? "test prejdený" : tests <= 4 ? "testy prejdené" : "testov prejdených"}` : ""} · dokončené ${date}`,
      issuedOn: date => `Vydané ${date}`,
      revokeTitle: name => `Odvolať certifikát — ${name}`,
    },
  },
  },

  cs: {
  common: {
    saveBarNote: "Uloží všechny sekce na této stránce.",
    moreActions: "Další akce",
    domainsPlaceholder: "organizace.cz\nmarketing.organizace.cz",
    noticeConfirm: "Rozumím",
    empty: {
      filtered: "Filtru nic nevyhovuje",
      none: "Zatím tu nic není",
      clearFilters: "Zrušit filtry",
    },
    pdf: {
      loading: "Načítám PDF…",
      failed: "PDF se nepodařilo zobrazit přímo na stránce. Otevři ho odkazem výše.",
      page: "Strana {page} z {pages}",
    },
    pending: {
      adding: "Přidávám…",
      sending: "Posílám e-maily…",
    },
  },
  onboarding: {
    openPdf: "Otevřít PDF",
    listHeading: "Dokumenty k potvrzení",
    listIntro: "Přečtěte si každý dokument a potvrďte, že jste se s ním seznámili. Potvrzení se váže na konkrétní znění — u nové verze vás systém požádá znovu.",
    emptyTitle: "Nemáte nic k potvrzení",
    emptyText: "Když vám někdo přidělí normu nebo vás zařadí do trasy, objeví se tady i s termínem. Nikdo od vás teď nic nečeká.",
    assignedHeading: "Přidělené dokumenty",
    progress: (done, total) => `Hotovo ${done} z ${total}`,
    step: (order, total) => `Krok ${order} z ${total}`,
    continueHere: "pokračujte tu",
    trackComplete: "trasa je hotová",
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
    version: (_label, from) => `znění účinné od ${from}`,
    readingElapsed: t => `Čas čtení: ${t}`,
    readingNote: "Zaznamenává se, je informativní a není součástí potvrzení.",
    readingSeconds: n => `${n} s`,
    readingMinutes: n => (n === 1 ? "1 minuta" : n >= 2 && n <= 4 ? `${n} minuty` : `${n} minut`),
    confirmHeading: "Potvrzení seznámení",
    confirmButton: "Potvrzuji",
    confirmPending: "Ukládá se…",
    confirmed: "Potvrzeno. Děkujeme.",
    confirmedAt: (when) => `Potvrdili jste ${when}.`,
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
      version: label => `${label}`,
      waitingSince: d => `čeká od ${d}`,
      dueBy: d => `do ${d}`,
      dueToday: "termín dnes",
      dueOver: n => `po termínu ${n === 1 ? "o den" : n < 5 ? `o ${n} dny` : `o ${n} dnů`}`,
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
    statement: (title, effectiveFrom, gender) =>
      `Potvrzuji, že jsem se ${byGender("seznámil", gender)} s dokumentem „${title}" ve znění účinném od ${effectiveFrom}, ` +
      `${byGender("porozuměl", gender)} jsem jeho obsahu a zavazuji se jej dodržovat.`,
    email: {
      subject: org => `Přihlášení — ${org}`,
      heading: org => `Přihlášení — ${org}`,
      intro: "Kliknutím se přihlásíte.",
      button: "Přihlásit se",
      validity: "Odkaz platí 24 hodin a lze jej použít jednou. Pokud jste o přihlášení nežádali, tento e-mail ignorujte — bez kliknutí se nic nestane.",
      fallbackNote: "Pokud odkaz nefunguje, zkopírujte jej do prohlížeče:",
      subtitle: "Interní portál",
    },
    reminderEmail: {
      subject: organisation => `Připomínka: nepotvrzené dokumenty — ${organisation}`,
      subtitle: "Připomínka",
      intro: count => count === 1
        ? "Jeden dokument stále čeká na vaše potvrzení."
        : count >= 2 && count <= 4
          ? `${count} dokumenty stále čekají na vaše potvrzení.`
          : `${count} dokumentů stále čeká na vaše potvrzení.`,
      itemLine: (label, days) => `${label}, čeká ${daysCs(days)}`,
      effectiveLine: date => `znění účinné od ${date}`,
      noticeSubject: organisation => `K potvrzení: dokumenty — ${organisation}`,
      noticeSubtitle: "K potvrzení",
      noticeIntro: count => count === 1
        ? "Jeden dokument čeká na vaše potvrzení."
        : count >= 2 && count <= 4
          ? `${count} dokumenty čekají na vaše potvrzení.`
          : `${count} dokumentů čeká na vaše potvrzení.`,
      noticeItemLine: label => `${label}`,
      button: "Otevřít seznam",
      note: "Potvrzení se váže na konkrétní znění a zabere pár minut. Pokud si myslíte, že se vás dokument netýká, ozvěte se personálnímu oddělení.",
    },

    inviteEmail: {
      subject: organisation => `Pozvánka — ${organisation}`,
      subtitle: "Pozvánka",
      intro: (legal, portal) => `${legal === portal ? `${legal} vás zve do svého interního portálu.` : `${legal} vás zve do ${portal}.`} Najdete v něm dokumenty a úkoly, které se vás týkají.`,
      how: "Přihlašujete se pracovní e-mailovou adresou, na kterou přišla tato pozvánka. Po otevření portálu se přihlásíte pracovním účtem nebo si necháte poslat přihlašovací odkaz.",
      button: "Otevřít portál",
      note: "Pokud se přihlásit nedá, ozvěte se personálnímu oddělení.",
      privacy: "Jak se v portálu zpracovávají vaše osobní údaje, proč, jak dlouho a jaká máte práva:",
      privacyLink: "Ochrana osobních údajů",
    },

    dueReminderEmail: {
      subjectSoon: org => `Blíží se termín potvrzení \u2014 ${org}`,
      subjectOver: org => `Jste po termínu potvrzení \u2014 ${org}`,
      subtitleSoon: "Blíží se termín",
      subtitleOver: "Po termínu",
      introSoon: "Toto vás čeká a termín se blíží:",
      introOver: "Toto vás čeká a termín už uplynul:",
      soonLine: (due, daysLeft) =>
        daysLeft === 0 ? `termín je dnes, ${due}`
        : `termín je ${due}, ${daysLeft === 1 ? "zbývá den" : daysLeft <= 4 ? `zbývají ${daysLeft} dny` : `zbývá ${daysLeft} dní`}`,
      overLine: (due, daysOver) =>
        `termín byl ${due}, ${daysOver === 1 ? "jste po něm den" : daysOver <= 4 ? `jste po něm ${daysOver} dny` : `jste po něm ${daysOver} dní`}`,
      button: "Otevřít a potvrdit",
      note: "Potvrzení je krátké \u2014 dokument si přečtete a kliknete. Když jste to už udělali, tento e-mail příště nepřijde.",
    },
    privacy: {
      tocHeading: "Obsah",
      objectionHeading: "Právo vznést námitku",
      title: "Ochrana osobních údajů",
      lead: "Co se o vás v tomto systému ukládá, proč a jak dlouho.",
      controllerHeading: "Kdo je správce",
      controller: org => `Vaše osobní údaje zpracovává ${org}. Systém Contineo pro něj provozuje dodavatel jako zpracovatel na základě smlouvy o zpracování osobních údajů.`,
      controllerDetails: (address, reg) => [address, reg && `IČO ${reg}`].filter(Boolean).join(" · "),
      dpoHeading: "Pověřenec pro ochranu osobních údajů (DPO)",
      dpoMissing: "Kontakt na pověřence vám poskytne personální oddělení.",
      purposeHeading: "K čemu systém slouží",
      purpose: "Organizace v něm zveřejňuje závazné předpisy a interní směrnice a eviduje, kdo se s nimi seznámil. Systém odpovídá i na otázky k obsahu předpisů.",
      dataHeading: "Jaké údaje a proč",
      dataColumns: ["Údaj", "Proč"],
      data: [
        ["jméno, e-mail, pracovní pozice, oddělení, typ vztahu", "aby vám mohly být přiděleny předpisy, které se vás týkají, a abyste se mohli přihlásit"],
        ["přidělení předpisu: kdo, proč a dokdy", "doklad o tom, že jste měli povinnost se s předpisem seznámit"],
        ["první otevření znění předpisu", "doklad, že vám bylo znění zpřístupněno; ukládá se jeden záznam na znění, ne každé zobrazení"],
        ["potvrzení: čas, znění předpisu, doslovný text potvrzení, IP adresa, údaj o prohlížeči", "doklad o seznámení s předpisem"],
        ["čas strávený nad zněním", "informativní údaj pro personalistu, ne doklad; nic se podle něj nevyhodnocuje"],
        ["připomínky: komu a kdy byly odeslány", "aby vám stejná připomínka nepřišla dvakrát"],
        ["otázky, které systému položíte, a jeho odpovědi", "aby se dala prověřit správnost odpovědí a abyste v historii našli své starší otázky"],
        ["mobilní telefon, pracoviště a fotografie, pokud je vyplníte", "interní adresář; vyplnit je nemusíte"],
        ["pohlaví, pokud ho vyplní personalista", "statistika složení organizace (například podíl žen a mužů) a správný tvar textů o vás, například „absolvoval / absolvovala“; ze jména se neodvozuje a vyplnit ho nemusíte"],
        ["použití umělé inteligence: kdo, kdy, k čemu, model, počet tokenů a odhad ceny — bez znění dotazu", "přehled nákladů na umělou inteligenci pro správce organizace"],
      ],
      hrNote: "Personalista vidí u každého člověka, zda předpis otevřel, zda ho potvrdil a kolik času nad ním strávil. Stav „otevřel a nepotvrdil“ je sledovaný stav; personalista vás podle něj může upozornit, že potvrzení chybí.",
      responsibleNote: "U každého předpisu je uvedena odpovědná osoba (jméno a e-mail), na kterou se můžete obrátit s dotazem k předpisu.",
      basisHeading: "Právní základ",
      basisIntro: "Určuje se u každého předpisu zvlášť a vidíte ho u něj:",
      basisObligation: "plnění právní povinnosti (čl. 6 odst. 1 písm. c) GDPR) u předpisů, jejichž seznámení vyžaduje zákon, například bezpečnost a ochrana zdraví při práci; u předpisu je uveden konkrétní zákon;",
      basisInterest: "oprávněný zájem (čl. 6 odst. 1 písm. f) GDPR) u interních směrnic — zájmem je prokázat, že s pravidly byli seznámeni ti, kterých se týkají.",
      basisDirectory: "Údaje v adresáři (mobil, pracoviště, fotografie) se zpracovávají na základě oprávněného zájmu na vnitřní komunikaci. Pohlaví se zpracovává na základě oprávněného zájmu na statistice složení organizace a na správných textech; není povinné. Záznam o použití umělé inteligence se zpracovává na základě oprávněného zájmu na kontrole nákladů.",
      retentionHeading: "Jak dlouho",
      retentionColumns: ["Údaj", "Lhůta"],
      retention: [
        ["potvrzení, přidělení, otevření znění", "{evidence} od skončení pracovního poměru nebo vztahu s organizací; pokud datum skončení není známé, od vyřazení ze systému; nejdéle {cap} od poslední události, pokud není známé ani jedno datum"],
        ["schválení předpisu a odpovědná osoba", "dokud existuje alespoň jeden doklad o seznámení s daným zněním"],
        ["čas strávený nad zněním", "12 měsíců"],
        ["otázky, které systému položíte, a jeho odpovědi", "{answers}; odstranění z historie je skryje jen ve vašem seznamu"],
        ["připomínky", "90 dní"],
        ["záznam o přístupech a změnách (audit)", "24 měsíců"],
        ["pohlaví", "spolu s ostatními údaji ve vašem záznamu v seznamu osob"],
        ["záznam o použití umělé inteligence", "25 měsíců"],
      ],
      years: n => (n === 1 ? "1 rok" : n >= 2 && n <= 4 ? `${n} roky` : `${n} let`),
      months: n => (n === 1 ? "1 měsíc" : n >= 2 && n <= 4 ? `${n} měsíce` : `${n} měsíců`),
      retentionDelete: "Po uplynutí lhůty se záznam smaže celý, neanonymizuje se.",
      recipientsHeading: "Komu se údaje dostanou",
      recipients: "Personalistům a správcům obsahu organizace v rozsahu jejich úlohy, kolegům jen údaje z adresáře. Mimo organizaci zpracovatelům, kteří zajišťují provoz:",
      processorsColumns: ["Kdo", "K čemu", "Kde"],
      processors: {
        atlas: ["MongoDB Atlas", "databáze a vyhledávání", "EU (Frankfurt)"],
        vercel: ["Vercel", "běh aplikace", "EU"],
        anthropic: ["Anthropic", "tvorba odpovědí na otázky; bez uchovávání a bez trénování na datech", "podle smlouvy se zpracovatelem"],
        bedrock: ["Amazon Web Services (Bedrock)", "tvorba odpovědí na otázky; bez uchovávání a bez trénování na datech", "region {region}"],
        voyage: ["Voyage AI (přes MongoDB)", "vyhledávání v textu předpisů", "podle smlouvy se zpracovatelem"],
        ecomail: ["Ecomail", "odesílání e-mailů", "EU"],
      },
      noSale: "Údaje se neprodávají a nepoužívají se k reklamě ani k trénování modelů umělé inteligence.",
      automated: "O nikom se nerozhoduje automatizovaně.",
      learning: {
        purpose: "Organizace v něm vede také kurzy a testy a vydává certifikáty o jejich absolvování.",
        data: [
          ["zápis do kurzu: kdy a kdo vás zapsal", "abyste měli přístup ke kurzu, který se vás týká"],
          ["dokončení částí kurzu a to, které úseky videa jste zhlédli", "doklad, že jste kurz prošli; u povinného videa i to, že jste ho dokoukali"],
          ["pokusy v testu: otázky, vaše odpovědi, body, výsledek a čas", "vyhodnocení testu"],
          ["certifikát: jméno, pohlaví (kvůli tvaru textu), kurz, číslo, data, vydavatel, podepisující", "doklad o absolvování kurzu, který si můžete stáhnout a který lze ověřit"],
        ],
        basis: archiveLaw => `U kurzů platí totéž co u předpisů: zákonná povinnost u školení, která vyžaduje zákon (například bezpečnost a ochrana zdraví při práci), jinak oprávněný zájem prokázat, že lidé byli proškoleni. Certifikát se uchovává i pro účely archivace podle ${archiveLaw}.`,
        retention: [
          ["zápis do kurzu, dokončení částí, sledování videa, pokusy v testu", "stejně jako potvrzení předpisu (první řádek tabulky)"],
          ["vaše odpovědi v testu a zhlédnuté úseky videa", "{months} po dokončení kurzu; výsledek testu a dokončení zůstávají"],
          ["certifikát", "nemaže se — vydaný certifikát platí a uchovává se podle registraturního plánu organizace; může být pouze odvolán"],
        ],
        retentionNote: "Výjimkou je certifikát — ten se nemaže.",
        recipients: "Výsledky testů vidí jen odpovědná osoba za test, ne personalista. Certifikát ověří kdokoli, komu dáte jeho odkaz nebo QR kód; ověření ukáže číslo, kurz, datum a vydavatele, ne vaše jméno.",
        automated: "Test vyhodnocuje systém automaticky podle předem určených správných odpovědí. Pokud s výsledkem nesouhlasíte, obraťte se na odpovědnou osobu za test — výsledek prověří a pokus může zrušit, abyste ho mohli zopakovat. O ničem jiném se automatizovaně nerozhoduje.",
        rights: "Výmaz vydaného certifikátu není možný — uchovává se pro účely archivace a jako doklad, který můžete potřebovat i vy.",
      },
      rightsHeading: "Vaše práva",
      rights: "Máte právo na přístup ke svým údajům, jejich opravu, omezení zpracování a přenositelnost.",
      objection: "U předpisů s oprávněným zájmem máte právo vznést námitku. Námitku posoudí pověřenec jednotlivě a doklad se do jeho rozhodnutí nemaže. Výmaz dokladu o seznámení před uplynutím lhůty není možný, dokud je potřebný k prokázání, uplatnění nebo obhajobě právních nároků.",
      objectionEmail: "Námitku pošlete e-mailem na",
      objectionFormLabel: "Vaše námitka",
      objectionFormHint: "Napište, proti čemu namítáte a proč. Námitku posoudí pověřenec; potvrzení vám přijde e-mailem.",
      objectionSubmit: "Podat námitku",
      objectionSent: "Námitka je podána. Potvrzení jsme vám poslali e-mailem.",
      objectionPending: date => `Vaši námitku z ${date} pověřenec posuzuje. Další můžete podat, až o ní rozhodne.`,
      objectionSignIn: "Po přihlášení ji můžete podat i přímo zde.",
      objectionSignInLink: "Přihlásit se",
      complaint: {
        SK: "Máte právo podat stížnost dozorovému úřadu — Úradu na ochranu osobných údajov SR (dataprotection.gov.sk).",
        CZ: "Máte právo podat stížnost Úřadu pro ochranu osobních údajů (uoou.gov.cz).",
      },
      archiveLaw: {
        SK: "slovenského zákona č. 395/2002 Z. z. o archivech a registraturách",
        CZ: "zákona č. 499/2004 Sb., o archivnictví a spisové službě",
      },
      requests: "Žádosti posílejte pověřenci (DPO).",
      version: date => `Verze textu: ${date}`,
      linkBefore: "Co se při potvrzení ukládá a jak dlouho: ",
      link: "Ochrana osobních údajů",
      extraHeading: "Doplnění správce",
    },
    versionMeta: {
      heading: "Údaje o znění",
      intro: "Autor, kdo znění schválil, a data. Jsou součástí schválení — schvalovatel je vidí u PDF a po předložení se už měnit nedají.",
      author: "Autor",
      authorHint: "Osoba, oddělení nebo komise, která dokument připravila.",
      approvedBy: "Schválil",
      approvedByHint: "Osoba nebo orgán, například Výkonný výbor.",
      approvedOn: "Datum schválení",
      effectiveFrom: "Datum účinnosti",
      effectiveFromHint: "Povinné před předložením ke schválení. Je i v potvrzovací formulce; při zveřejnění se už nezadává.",
      save: "Uložit údaje",
      locked: "Koncept je ve schvalování nebo schválený — údaje se už měnit nedají. Změna je možná jen novým zněním.",
      voidsApproval: "Koncept byl schválen ještě bez údajů o znění. Jejich uložením schválení přestane platit a koncept je třeba předložit znovu — schvalovatelé tak schválí i tyto údaje.",
      suggested: "Předvyplněno z první strany dokumentu — zkontroluj a ulož. Dokud je neuložíš, nejsou součástí znění.",
      missing: "Údaje o znění zatím nejsou uložené. Bez data účinnosti nelze koncept předložit ke schválení.",
      uploadHeading: "Údaje o znění",
      uploadNote: "Nepovinné už zde — pokud je nevyplníš, předvyplní se z první strany dokumentu a potvrdíš je na detailu.",
      fromMeta: date => `Datum účinnosti ${date} — ze schválených údajů o znění.`,
    },
    objectionEmail: {
      noticeSubject: org => `Nová námitka \u2014 ${org}`,
      noticeSubtitle: "Námitka (čl. 21 GDPR)",
      noticeIntro: (person, date) => `${person} podal(a) ${date} v aplikaci námitku proti zpracování osobních údajů.`,
      noticeButton: "Otevřít námitky",
      noticeNote: "Znění námitky je po přihlášení na stránce DPO, v e-mailu není. Do rozhodnutí se nic nemaže.",
      receiptSubject: org => `Potvrzení námitky \u2014 ${org}`,
      receiptSubtitle: "Potvrzení",
      receiptIntro: date => `Vaši námitku proti zpracování osobních údajů jsme přijali ${date}. Zní takto:`,
      receiptNote: "Námitku posoudí pověřenec (DPO). Do jeho rozhodnutí se vaše doklady nemažou.",
      receiptContact: email => `Námitku posoudí pověřenec (DPO). Do jeho rozhodnutí se vaše doklady nemažou. Dotazy posílejte na ${email}.`,
    },
    dpoEmail: {
      subject: (org, quarter) => `Výkaz právních základů ${quarter} \u2014 ${org}`,
      subtitle: "Čtvrtletní kontrola",
      intro: quarter => `Čtvrtletní přehled právních základů platných předpisů (${quarter}):`,
      total: n => `platných předpisů: ${n}`,
      legalObligation: n => `zákonná povinnost: ${n}`,
      legitimateInterest: n => `oprávněný zájem: ${n}`,
      withProblems: n => `s nedostatkem: ${n}`,
      button: "Otevřít výkaz",
      note: "Právní základ určuje odpovědná osoba za předpis; vy ho kontrolujete (O15/A10). Seznam předpisů je ve výkazu po přihlášení, v e-mailu jsou jen počty.",
    },
    approvalEmail: {
      subject: org => `Znění ke schválení \u2014 ${org}`,
      subtitle: "Ke schválení",
      intro: who => `${who} předložil znění a čeká na vaše rozhodnutí:`,
      noteLabel: "Co se ve znění mění",
      versionLine: (_label, effectiveFrom) => `znění účinné od ${effectiveFrom}`,
      button: "Přečíst a rozhodnout",
      note: "Rozhodujete sami za sebe \u2014 ostatní schvalovatelé rozhodují nezávisle. Při zamítnutí je důvod povinný, aby předkladatel věděl, co opravit.",
    },
    assignmentEmail: {
      subject: org => `Nový dokument k potvrzení — ${org}`,
      subtitle: "K potvrzení",
      intro: "Do vašeho seznamu přibyl dokument, se kterým se máte seznámit:",
      reasonLabel: "Důvod",
      versionLine: (_label, effectiveFrom) => `znění účinné od ${effectiveFrom}`,
      button: "Otevřít a potvrdit",
      note: "Dokument najdete i po přihlášení v seznamu na úvodní straně. Dokud jej nepotvrdíte, zůstane vám tam.",
    },
  myAcknowledgements: {
    heading: "Moje potvrzení",
    intro: "Co o vás systém eviduje: která znění jste potvrdili, kdy a pod jakým textem. Vidíte jen sebe a můžete si to stáhnout.",
    nothing: "Zatím nemáte žádné potvrzení.",
    download: "Stáhnout jako CSV",
    count: n => (n === 1 ? "1 záznam" : n <= 4 ? `${n} záznamy` : `${n} záznamů`),
    acknowledged: "potvrzeno",
    revoked: "odvoláno",
    versionLine: (_label, effectiveFrom) => `znění účinné od ${effectiveFrom}`,
    whenLine: when => `potvrzeno ${when}`,
    revokedWhenLine: when => `odvoláno ${when}`,
    revokedStatement: "Znění, pod kterým bylo potvrzení původně dáno:",
    viaTrack: track => `z trasy ${track}`,
    reason: text => `Důvod: ${text}`,
    footnoteBefore: "Jak celý postup funguje, je v ",
    footnoteGuide: "Návodu",
    footnoteAfter: ". Pokud vám tu něco nesedí, ozvěte se personalistovi — záznam se neupravuje, odvolává se a potvrzuje znovu.",
    csv: {
      type: "Typ", document: "Dokument", version: "Verze", effectiveFrom: "Platná od",
      acknowledgedAt: "Potvrzeno", track: "Trasa", statement: "Znění formulky",
      reason: "Důvod", ip: "IP adresa", browser: "Prohlížeč",
    },
  },
  guide: {
    heading: "Návod",
    intro: "Jak se dokument dostane do systému a co se s ním cestou stane — od nahrání po inteligentní vyhledávání.",
    onlySlovak: "Text návodu je zatím pouze ve slovenštině. Přeloží se celý najednou, až se rozhraní začne v češtině opravdu používat.",
  },
  directory: {
    heading: "Adresář",
    intro: "Kolegové ve vaší organizaci — pozice, pracoviště a kontakt. Vyřazení lidé zde nejsou.",
    searchPlaceholder: "Jméno, pozice, oddělení nebo pracoviště…",
    nothingFound: "Nikdo neodpovídá hledání.",
    count: n => (n === 1 ? "1 osoba" : n <= 4 ? `${n} osoby` : `${n} osob`),
  },
  dpo: {
    heading: "Ochrana údajů",
    intro: "Právní základy platných předpisů. Určuje je odpovědná osoba za předpis, vy je kontrolujete — jednou za čtvrtletí vám přijde přehled e-mailem.",
    reportHeading: "Právní základy platných předpisů",
    csv: "Stáhnout CSV",
    empty: "Organizace zatím nemá platný předpis.",
    summary: (total, problems) => `${total} platných předpisů, z toho ${problems} s nedostatkem.`,
    basis: "Právní základ",
    reference: "Předpis",
    responsible: "Odpovědná osoba",
    version: "Znění",
    none: "—",
    ok: "v pořádku",
    problems: {
      noBasis: "chybí právní základ",
      outsideCodelist: "základ mimo číselník",
      noReference: "zákonná povinnost bez odkazu na zákon",
      noResponsible: "chybí odpovědná osoba",
      inactiveResponsible: "odpovědná osoba je vyřazená",
    },
    objectionsHeading: "Námitky (čl. 21)",
    objectionsIntro: "U předpisů s oprávněným zájmem může člověk vznést námitku. Námitku zde zaevidujete a rozhodnete o ní; do rozhodnutí se nic nemaže. Při vyhovění se smažou jeho doklady u znění s oprávněným zájmem — u zákonné povinnosti zůstanou.",
    recordHeading: "Zaevidovat námitku",
    personEmail: "E-mail osoby",
    personEmailNote: "I předchozí adresa — námitka často přijde z adresy, kterou člověk používal ve svazu.",
    receivedAt: "Doručena",
    channel: "Jak přišla",
    channels: { email: "e-mailem", letter: "dopisem", "in-person": "osobně", other: "jinak", app: "v aplikaci" },
    objectionText: "Znění námitky",
    objectionTextNote: "Jak přišla — bez vlastního výkladu.",
    recordSubmit: "Zaevidovat",
    noObjections: "Zatím žádná námitka.",
    retention: {
      heading: "Lhůty uchovávání",
      intro: "Tyto lhůty používá denní mazací dávka a přesně tato čísla jsou i na stránce Ochrana osobních údajů.",
      evidenceYears: "Roky od skončení vztahu",
      evidenceYearsNote: "Potvrzení, přidělení, otevření znění a záznamy vzdělávání. Když datum skončení není známé, běží od vyřazení.",
      capYears: "Strop v letech od poslední události",
      capYearsNote: "Pro vyřazenou osobu, u které není známé ani jedno datum. Nesmí být kratší než lhůta výše.",
      learningDetailMonths: "Měsíce po dokončení kurzu",
      learningDetailMonthsNote: "Potom se z testů smažou odpovědi a ze sledování videa zhlédnuté úseky. Výsledek a dokončení zůstávají.",
      answersMonths: "Měsíce pro otázky a odpovědi",
      answersMonthsNote: "Potom se otázky, odpovědi a jejich hodnocení smažou. Záznamy, ze kterých vznikla ověřená odpověď, zůstanou bez jména toho, kdo se ptal.",
      fixed: "Pevné pro celou platformu (řídí je databáze): čas strávený nad zněním 12 měsíců, připomínky 90 dní, audit 24 měsíců, spotřeba umělé inteligence 25 měsíců. Certifikáty se nemažou.",
      warning: "Zkrácení lhůty může při zapnutém ostrém mazání smazat záznamy hned v nejbližší noční dávce.",
      save: "Uložit lhůty",
      saved: "Lhůty uloženy.",
    },
    extra: {
      heading: "Doplnění na stránku Ochrana osobních údajů",
      intro: "Vlastní odstavec, který se zobrazí pod společným textem — například další účel nebo kontakt. Základní text se tím nemění. Prázdné pole = nic se nezobrazí.",
      label: language => `Text — ${language}`,
      save: "Uložit doplnění",
      saved: "Doplnění uloženo.",
    },
    status: { pending: "čeká na rozhodnutí", upheld: "vyhověno", rejected: "zamítnuto" },
    receivedLine: (date, channel) => `doručena ${date} · ${channel}`,
    recordedLine: (who, date) => `zaevidoval(a) ${who}, ${date}`,
    decideHeading: "Rozhodnutí",
    upheld: "Vyhovět — smazat doklady u oprávněného zájmu",
    rejected: "Zamítnout — převažují závažné oprávněné důvody nebo právní nároky",
    decisionNote: "Odůvodnění",
    upheldWarning: "Vyhovění smaže doklady natrvalo, hned po odeslání.",
    decideSubmit: "Rozhodnout",
    decidedLine: (who, date) => `rozhodl(a) ${who}, ${date}`,
    deletedLine: (acks, unknown) => `smazaných potvrzení: ${acks}` + (unknown ? ` · ${unknown} potvrzení bez zapsaného právního základu zůstalo — posuďte je ručně` : ""),
    objectionRecorded: "Námitka zaevidována.",
    settingsMoved: "Lhůty uchovávání, doplněk na stránku Ochrana osobních údajů a kontakt GDPR jsou v nastavení organizace.",
    settingsLink: "Otevřít záložku GDPR",
    objectionUpheld: "Námitce vyhověno, doklady u oprávněného zájmu jsou smazány.",
    objectionRejected: "Námitka zamítnuta.",
    searchPlaceholder: "Hledat předpis — název, základ, zákon, osoba",
    searchSubmit: "Hledat",
    filterState: "Stav",
    filterBasis: "Právní základ",
    filterPerson: "Odpovědná osoba",
    filterAll: "Všechny",
    stateProblems: "S nedostatkem",
    stateOk: "V pořádku",
    basisObligation: "Zákonná povinnost",
    basisInterest: "Oprávněný zájem",
    basisNone: "Bez základu",
    chipSearch: "hledání",
    removeFilter: label => `Zrušit filtr ${label}`,
    shownOf: (shown, total) => `${shown} z ${total} předpisů`,
    groupBy: "Seskupit",
    groupState: "Podle stavu",
    groupPerson: "Podle osoby",
    noPerson: "Bez odpovědné osoby",
    writeEmail: n => `Napsat e-mail · ${n}`,
    mailSubject: "Právní základ předpisů — chybějící údaje",
    mailBody: list => `Dobrý den,\n\nu těchto předpisů, za které odpovídáte, chybí nebo nesedí právní základ:\n\n${list}\n\nDoplňte ho, prosím, na kartě dokumentu ve správě knihovny.\n\nDěkuji`,
    mailBodyLink: (n, url) => `Dobrý den,\n\nu ${n} předpisů, za které odpovídáte, chybí nebo nesedí právní základ. Seznam: ${url}\n\nDoplňte ho, prosím, na kartě dokumentu ve správě knihovny.\n\nDěkuji`,
    groupPersonMeta: (total, bad) => `${total} ${total === 1 ? "předpis" : total >= 2 && total <= 4 ? "předpisy" : "předpisů"}, ${bad} s nedostatkem`,
    pendingBanner: n => n === 1 ? "1 námitka čeká na rozhodnutí" : n <= 4 ? `${n} námitky čekají na rozhodnutí` : `${n} námitek čeká na rozhodnutí`,
    pendingBannerMeta: (name, date) => `${name} · doručena ${date} · do rozhodnutí se nic nemaže`,
    pendingDecide: "Rozhodnout",
    noMatch: "Hledání nic neodpovídá",
    noMatchText: "Výkaz obsahuje jen platná znění. Archivní a připravovaná najdete v",
    noMatchLibrary: "knihovně",
    clearSearch: "Zrušit hledání",
    clearAll: "Zrušit vše",
    decidedToggle: n => `Rozhodnuté námitky (${n}) · zobrazit`,
    groupProblems: n => `S nedostatkem · ${n}`,
    groupOk: n => `V pořádku · ${n}`,
    colDocument: "Předpis",
    colStatus: "Stav",
    pendingCount: n => `${n} čeká na rozhodnutí`,
    recordOpen: "+ Zaevidovat námitku",
  },
  nav: {
    ask: "Volné otázky",
    toApprove: "Ke schválení",
    evidence: "Řetěz důkazů",
    overview: "Přehled",
    loading: "Načítá se…",
    sections: "Sekce",
    tasks: "Úkoly",
    more: "Více",
    groupOrganisation: "Organizace",
    groupManagement: "Správa",
    groupMain: "Hlavní",
    breadcrumb: "Cesta",
    menu: "Menu",
    skipToContent: "Přeskočit na obsah",
    allSections: "Všechny sekce",
    escCloses: "zavře",
    sheetHint: "Všechny sekce s popisem jsou na Přehledu",
    desc: {
      toAcknowledge: "Normy, které máte přečíst a potvrdit",
      toApprove: "Znění, o kterých máte rozhodnout",
      directory: "Kontakty, oddělení a kdo za co odpovídá",
      library: "Platné normy a jejich znění",
      learning: "Moje kurzy, testy a certifikáty",
      assigned: "Kdo co potvrdil, přidělení normy",
      evidence: "Záznamy o potvrzeních pro audit",
      people: "Zaměstnanci, pracovní vztahy, role",
      evaluation: "Odpovědi, u kterých někdo řekl, že nesedí",
      dpo: "Právní základy předpisů a námitky",
      channels: "Widget a portál; tickety kanálů, kterých jsi řešitelem",
      learningManage: "Kurzy, části a přidělení",
      learningTests: "Banka otázek a výsledky pokusů",
    },
    waiting: n => (n === 1 ? "čeká 1" : n <= 4 ? `čekají ${n}` : `čeká ${n}`),
    toAcknowledge: "K potvrzení",
    assigned: "Přidělené dokumenty",
    evaluation: "K posouzení",
    dpo: "Ochrana údajů",
    channels: "Kanály",
    learning: "Vzdělávání",
    learningManage: "Správa kurzů",
    learningTests: "Testy",
    people: "Osoby",
    directory: "Adresář",
    library: "Knihovna",
    organisation: "Nastavení organizace",
    tenants: "Správa tenantů",
    openMenu: "Otevřít menu",
    closeMenu: "Zavřít menu",
    searchPlaceholder: "Zeptejte se svých dokumentů…",
    searchLabel: "Zeptat se svých dokumentů",
    searchSubmit: "Zeptat se",
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

  versionNotice: {
    text: "Je dostupná nová verze portálu. Obnovením stránky na ni přejdete.",
    reload: "Obnovit",
  },

  notFound: {
    heading: "Stránka nebyla nalezena",
    intro: "Adresa neexistuje nebo už neplatí.",
    home: "Na úvodní stranu",
  },

  home: {
    metaTitle: "Contineo",
    metaDescription: "Ověřování kvality odpovědí nad předpisy a směrnicemi.",
  },

  signIn: {
    emailPlaceholder: "jmeno@organizace.cz",
    or: "nebo",
    heading: "Přihlášení",
    intro: "Zadejte e-mail, na který jste dostali pozvánku. Pošleme vám odkaz — heslo si pamatovat nemusíte.",
    noScript: "Přihlášení potřebuje JavaScript — bez něj se nedá odeslat ani odkaz na e-mail, ani přihlášení firemním kontem. Zapněte ho, prosím, a stránku načtěte znovu.",
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
    submit: "Zeptat se",
    phases: {
      reading: "Čtu otázku…",
      searching: "Hledám v předpisech…",
      ranking: "Řadím nalezené…",
      writing: "Skládám odpověď…",
    },
    examplesLabel: "Například",
    examples: [
      "Jaká je lhůta pro podání námitky?",
      "Za jakých podmínek může přestoupit nezletilý hráč?",
      "Kdy se platí odstupné za hráče?",
      "Kolik žlutých karet znamená zastavení činnosti?",
    ],
    unknownError: "Neznámá chyba",
    scopeLabel: "Hledat v",
    scopeLibrary: "Knihovna",
    noScript: "Odpovídání potřebuje JavaScript — odpověď přichází po částech, jak ji model píše. Dokumenty se dají číst a potvrzovat i bez něj:",
    noScriptLink: "přejít na dokumenty",
    history: {
      recent: "Nedávné otázky",
      matching: "Z vašich otázek",
      all: "Celá historie",
      title: "Moje otázky",
      lead: "Otázky, které jste položili, s odpověďmi tak, jak tehdy přišly.",
      filter: "Hledat v mých otázkách",
      filterSubmit: "Hledat",
      remove: "Odstranit z historie",
      removed: "Otázka odstraněna z historie",
      removedAll: "Historie vymazána",
      undo: "Vrátit",
      clearAll: "Vymazat celou historii",
      clearConfirm: "Vymazat celou historii otázek? Otázky zmizí z vašeho seznamu.",
      clearCancel: "Nechat",
      retention: months => `Otázky a odpovědi se uchovávají ${months} měsíců a pak se smažou. Odstranění z historie je skryje jen ve vašem seznamu — pro kontrolu kvality odpovědí zůstávají do konce lhůty.`,
      loadOlder: "Načíst starší",
      empty: "Zatím jste se na nic neptali.",
      emptyText: "Otázku položte v poli nahoře. Vaše otázky a odpovědi se pak ukážou tady.",
      emptyFilter: "Žádná vaše otázka tomu neodpovídá.",
      emptyFilterText: "Zkuste jiné slovo nebo hledání zrušte.",
      status: {
        citations: n => (n === 1 ? "1 citace" : n <= 4 ? `${n} citace` : `${n} citací`),
        none: "nic se nenašlo",
        fits: "sedí",
        doesNotFit: "nesedí",
      },
      today: "Dnes",
      yesterday: "Včera",
    },
    saved: {
      banner: date => `Odpověď z ${date}. Předpisy se od té doby mohly změnit.`,
      newVersion: (document, label, date) => `${document} má od té doby nové znění (${label}, účinné od ${date}).`,
      askAgain: "Zeptat se znovu",
    },
    sheet: {
      infoLead: org => `Odpověď se skládá jen z dokumentů organizace ${org}.`,
      infoRest: "U každého tvrzení je odkaz na zdroj. Pokud to v dokumentech není, systém to řekne a nic si nevymyslí.",
      hint: "Enter odešle · Shift+Enter nový řádek · Esc zavře",
      hintInline: "Enter odešle · Shift+Enter nový řádek",
      hintHistory: "↑↓ vybrat · Enter otevře · Esc zavře",
      insert: "vložit",
      close: "Zavřít",
    },
    heading: "Zeptat se",
    emptyLead: "Napište otázku vlastními slovy, tak jak byste se ptali kolegy.",
    edit: "Upravit otázku",
    askedAt: time => `Zeptali jste se v ${time}`,
    answerKicker: org => `Odpověď z dokumentů ${org}`,
    none: {
      kicker: "V dokumentech organizace se k tomu nic nenašlo",
      text: "Zkuste otázku jinak, nebo hledejte v knihovně — ne všechno je v předpisech.",
      link: "Hledat v knihovně →",
      noVersion: (d) => `K ${d} nemá organizace žádné platné znění předpisu — zkuste jiné datum nebo otázku bez data.`,
    },
    error: {
      unavailable: "Odpověď se teď nedá sestavit. Zkuste to za chvíli — vyhledávání v knihovně funguje.",
      link: "Otevřít knihovnu →",
    },
  },

  answer: {
    cacheTo: "do cache",
    cacheFrom: "z cache",
    techTokens: "tokeny",
    techTotal: "celkem",
    techModel: "model",
    fromDocuments: "Odpověď z vašich dokumentů",
    failed: "Odpověď se nepodařilo získat.",
    incompleteHeading: "Odpověď je neúplná.",
    incompleteNote: "Model dosáhl limitu délky a zastavil se uprostřed — chybí jí závěr. Zkuste se zeptat na užší část problému.",
    citations: (shown) => `Doslovné citace (${shown})`,
    citationsFrom: total => `z ${total} odkazů`,
    citationsPending: "Citace přibudou během psaní",
    technical: "Technické údaje",
    openInLibrary: "Otevřít v knihovně",
    citationOf: (n, total) => `Citace ${n} z ${total}`,
    prev: "Předchozí",
    next: "Další",
    close: "Zavřít",
    sourceMissing: "zdroj neuveden",
    sources: (n) => `Prohledané zdroje (${n})`,
    internal: "interní",
    verified: "ověřená odpověď",
    verifiedNote: "znění, které někdo ověřil nad předpisem — nikoli samotné znění předpisu",
    live: "Živý zdroj",
    liveNote: (connector, group) => `přímo ze zdroje ${connector}${group ? ` (${group})` : ""} — neověřeno kurátorem`,
    liveFailed: names => `Živý zdroj neodpověděl (${names}) — odpověď je bez něj.`,
    sourceVersion: (label, from, to) =>
      [label && `znění ${label}`, from && `účinné od ${from}${to ? ` do ${to}` : ""}`].filter(Boolean).join(" · "),
    timeToday: (d) => `podle znění platných dnes, ${d}`,
    timeAsOf: (d) => `podle znění platných k ${d}`,
    timeCompare: (from, to) => `porovnání znění: ${from} → ${to}`,
    compareSide: (label, date) => (label ? (date ? `${label} (od ${date})` : label) : date ? `od ${date}` : ""),
    timeCompareUnavailable: {
      "single-version": (d) => `dokument má jediné znění, není s čím porovnat — odpověď podle znění platných dnes, ${d}`,
      "missing-text": (d) => `text staršího znění chybí — odpověď podle znění platných dnes, ${d}`,
      identical: (d) => `znění se v textu neliší — odpověď podle znění platných dnes, ${d}`,
      "no-document": (d) => `porovnání se nepodařilo — odpověď podle znění platných dnes, ${d}`,
    },
    match: { high: "vysoká shoda", medium: "střední shoda", low: "slabá shoda" },
    adapter: "adaptér",
    firstToken: "první token",
    costNote: (pricelistVersion) => `Orientačně. Nezahrnuje pomocný model ani vyhledávání. Ceník ${pricelistVersion}.`,
    pricelistStale: "ceník je zastaralý",
    citationsVerified: "citace ověřené modelem",
    citationsUnverified: "citace neověřené",
  },
  hr: {
    tabs: { assignments: "Přidělení", report: "Výkaz potvrzení", reminders: "Připomínky", tracks: "Trasy", evidence: "Řetěz důkazů" },
    tabsLabel: "Části sekce",
    dutyState: {
      acknowledged: "potvrzeno",
      opened: "otevřeno, nepotvrzeno",
      "not-opened": "neotevřeno",
      overdue: "po termínu",
      revoked: "odvoláno",
    },
    report: {
      heading: "Výkaz potvrzení",
      intro: "Kdo co má potvrdit a kdo to už potvrdil. Do jmenovatele vstupuje ten, komu byl dokument přidělen nebo ho má jako krok v zapnuté trase — ne všichni v organizaci.",
      views: { document: "Podle dokumentu", person: "Podle osoby", track: "Podle trasy" },
      viewsShort: { document: "Dokument", person: "Osoba", track: "Trasa" },
      viewsLabel: "Pohled",
      emptyTitle: "Zatím není co shrnout",
      emptyText: "Souhrn se objeví, až bude první přidělení.",
      done: (done, total) => `${done} z ${total}`,
      missing: n => (n === 1 ? "chybí 1" : `chybí ${n}`),
      complete: "hotovo",
      medianReading: "medián čtení",
      noReading: "neměřeno",
      readingNote: "Čas čtení je informativní. Měří se na klientovi, takže se jím nic nedokazuje — kdo nechá kartu otevřenou, „čte“ hodinu.",
      export: "Stáhnout jako CSV",
      open: "Rozepsat",
      acknowledgedAt: "potvrzeno",
      revoke: "Odvolat potvrzení",
      revokeReason: "Důvod odvolání",
      revokeHint: "Povinnost ožije s původním termínem. Pokud termín už uplynul, osoba bude hned po termínu.",
      revokeButton: "Odvolat",
      revokeDone: "Potvrzení je odvoláno. Povinnost ožila.",
      revokeFailed: "Potvrzení se nepodařilo odvolat.",
      readingTime: "četl",
      source: { assignment: "přidělení", track: "trasa", both: "přidělení i trasa" },
    },
    overview: {
      assignedBy: (who: string) => `přidělil ${who}`,
      versionTag: (label: string) => `verze ${label}`,
      today: "dnes",
      heading: "Přidělené dokumenty",
      intro: "Co bylo komu uloženo a kdo to už potvrdil. Počty se počítají při zobrazení — a týkají se lidí, kteří do skupiny patří",
      assign: "Přidělit dokument",
      tracks: "Trasy",
      tracksNote: "Lidé na trase potvrzují její kroky — povinnost vzniká z trasy, ne z přidělení.",
      trackLine: (people, documents) =>
        `${people === 1 ? "1 osoba" : people <= 4 ? `${people} osoby` : `${people} osob`} · ` +
        `${documents === 1 ? "1 dokument" : documents <= 4 ? `${documents} dokumenty` : `${documents} dokumentů`}`,
      openTrack: "Otevřít trasu",
      emptyTitle: "Žádná přidělení",
      emptyText: "Když předpis někomu přidělíte, objeví se tu i s tím, kolik lidí ho už potvrdilo.",
      acknowledged: "Potvrdili",
      notified: "Dali jsme vědět",
      no: "ne",
      nobody: "nikdo",
      missing: "Chybí",
      notifyByEmail: "Dát vědět e-mailem",
      revoke: "Odvolat přidělení",
    },
    detail: {
      version: "verze",
      assignedBy: "přidělil",
      notAcknowledged: (missing, total) => `Nepotvrdili (${missing} z ${total})`,
      effectiveFrom: (date) => `, platná od ${date}`,
      notifyLink: "dát jim vědět e-mailem →",
      allTitle: "Všichni potvrdili",
      allText: "Toto přidělení je vyřízené — nikdo nechybí.",
      noLongerInDepartment: "už není v oddělení",
      note: "Seznam se počítá při zobrazení. Kdo z oddělení odešel bez potvrzení, zůstává tu označený — jinak by tiše zmizel a nikdo by se nedozvěděl, že se to nedořešilo; e-mail se mu ale neposílá. Kdo odešel z celé organizace, tu není — jeho potvrzení (nebo jeho chybění) však zůstává v záznamech.",
    },
    revokeAssignment: {
      heading: "Odvolat přidělení",
      lead: "Zkontrolujte, které přidělení odvoláváte. Odvolá se až tlačítkem dole.",
      whatHappensHeading: "Co se stane po odvolání",
      tasksDisappear: (n) => n === 1 ? "1 člověku, který ještě nepotvrdil, zmizí úkol z „K potvrzení“ a nepřijde mu připomínka." : `${n} lidem, kteří ještě nepotvrdili, zmizí úkol z „K potvrzení“ a nepřijde jim připomínka.`,
      nobodyLoses: "Úkol z tohoto přidělení už nikdo nemá — všichni potvrdili.",
      versionSuperseded: (assigned, current, n) =>
        `Přidělené znění ${assigned} už neplatí — nahradilo ho ${current}. Potvrdit nelze, proto ho nikdo nemá v „K potvrzení“; ` +
        (n > 0 ? `ve výkazu HR však ${n === 1 ? "1 člověk visí jako nepotvrzený" : `${n} lidé visí jako nepotvrzení`}. Odvolání tuto nesplnitelnou povinnost odstraní.` : "nikdo ho nemá ani ve výkazu HR."),
      acknowledgementsStay: (n) => `Potvrzení, která už vznikla (${n}), zůstávají platná. Odvolání je nemaže.`,
      recordStays: "Záznam o přidělení se nemaže: v auditu zůstane přidělení i jeho odvolání. Odvolání nelze vrátit zpět.",
      reassign: "Pokud ho budete chtít znovu, přidělíte dokument nově — vznikne nové přidělení s dnešním datem.",
      reasonLabel: "Důvod odvolání",
      reasonHint: "Nepovinný. Zapíše se do auditu, aby bylo za rok jasné, proč se přidělení zrušilo.",
      confirm: "Odvolat přidělení",
      cancel: "Zpět bez odvolání",
      alreadyRevoked: "Toto přidělení už neplatí.",
    },
    notify: {
      trackAudience: (title: string) => `trasa „${title}"`,
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
      documentsCount: n => `${n} platných`,
      heading: "Přidělit dokumenty",
      introBefore: "Přiděluje se ",
      introHighlight: "konkrétní znění",
      introAfter: ", ne dokument. Když přibude novější, staré přidělení pro ně neplatí — to je záměr.",
      emptyTitle: "Není co přidělit",
      emptyText: "Přidělit lze jen publikované znění. V knihovně zatím žádné není.",
      whichDocuments: "Které předpisy",
      versionLine: (_label, date) => `znění účinné od ${date}`,
      to: "Komu",
      departments: "Oddělení",
      groups: "Skupiny",
      tracks: "Trasy",
      people: "Osoby",
      everyone: "Všem v organizaci",
      everyoneNote: "přebije výběr níže — jinak by totéž znění viselo v přehledu několikrát a nikdo by nevěděl, který řádek něco znamená",
      departmentNoteBefore: "Přidělení oddělení platí ",
      departmentNoteHighlight: "i pro všechna podřízená",
      departmentNoteAfter: ". Číslo je počet lidí včetně nich — to je to, koho se to opravdu týká.",
      noGroupsOrTracks: "V organizaci zatím nejsou skupiny ani trasy. Skupiny se zadávají při importu osob (sloupec „skupiny“) nebo příkazem",
      addresses: "Jednotlivé adresy",
      addressesNote: "Nepovinné. Odděl čárkou nebo novým řádkem.",
      reason: "Důvod",
      due: "Termín potvrzení",
      dueNone: "bez termínu",
      dueDate: "do data",
      dueDays: "do počtu dnů od vzniku povinnosti",
      dueDaysUnit: "dnů",
      dueNote: "Nepovinný. Datum platí pro všechny stejně; počet dnů běží každému ode dne, kdy mu povinnost vznikla — to je rozdíl pro toho, kdo do oddělení přijde později. Bez termínu se připomínky neposílají automaticky.",
      reasonPlaceholder: "např. novela čl. 12 — mění se lhůta pro podání odvolání",
      reasonNote: "Povinný a společný pro celý výběr. Je to jediné místo, kde bude za rok napsáno, proč se předpisy potvrzovaly znovu — a přijde i v e-mailu lidem.",
      submit: "Přidělit",
      checkImpact: "Zkontrolovat dopad",
      impactPeople: (n) =>
        n === 0 ? "Povinnost nevznikne nikomu"
        : n === 1 ? "Povinnost vznikne 1 člověku"
        : `Povinnost vznikne ${n} lidem`,
      impactNote: "Kdo do oddělení přibude později, dostane ji ode dne příchodu (D50).",
      docSearch: "Hledat předpis",
      docNone: q => `Nic neodpovídá „${q}“. Přidělit lze jen platné znění.`,
      onlyMissingBasis: n => `jen bez právního základu (${n})`,
      showAll: "zobrazit všechny",
      picked: n => `Vybrané (${n})`,
      summary: {
        documents: n => (n === 1 ? "předpis" : n >= 2 && n <= 4 ? "předpisy" : "předpisů"),
        departments: () => "oddělení",
        groups: n => (n === 1 ? "skupina" : n >= 2 && n <= 4 ? "skupiny" : "skupin"),
        tracks: n => (n === 1 ? "trasa" : n >= 2 && n <= 4 ? "trasy" : "tras"),
        people: n => (n === 1 ? "osoba" : n >= 2 && n <= 4 ? "osoby" : "osob"),
        everyone: "všem",
        everyoneRest: "v organizaci",
        noAudience: "adresát zatím nevybrán",
      },
      impactStale: "Výběr se změnil — zkontroluj dopad znovu",
      impactStaleNote: n => (n === 1
        ? "Pro předchozí výběr by povinnost vznikla 1 člověku."
        : `Pro předchozí výběr by povinnost vznikla ${n} lidem.`),
      submitN: n => (n === 1 ? "Přidělit 1 člověku" : `Přidělit ${n} lidem`),
    },
    actions: {
      noAudience: "Nevybral jsi, komu se přiděluje.",
      noDocument: "Nevybral jsi žádný dokument s platným zněním.",
      saveFailed: "Přidělení se nepodařilo uložit. Zkus to znovu.",
      assignedOne: (what) => `Přiděleno: ${what}.`,
      assigned: (count, documents, audiences) =>
        `Přiděleno: ${count} (${documents} ${documents === 1 ? "předpis" : documents < 5 ? "předpisy" : "předpisů"}` +
        ` × ${audiences} ${audiences === 1 ? "adresát" : audiences < 5 ? "adresáti" : "adresátů"}).`,
      assignedWithExisting: (count, documents, audiences, already) =>
        `Přiděleno: ${count} (${documents} ${documents === 1 ? "předpis" : documents < 5 ? "předpisy" : "předpisů"}` +
        ` × ${audiences} ${audiences === 1 ? "adresát" : audiences < 5 ? "adresáti" : "adresátů"}).` +
        ` ${already} už ${already === 1 ? "přidělené bylo" : already < 5 ? "přidělená byla" : "přidělených bylo"}` +
        " — nic se nezdvojilo.",
      revoked: (what) => `Odvoláno: ${what}. Záznam o přidělení zůstává.`,
      alreadyRevoked: "Toto přidělení už neplatí.",
      nobodyToNotify: "Není komu poslat — potvrdili už všichni, kdo v oddělení zůstal.",
      tooManyRecipients: (recipients, max) =>
        `Příjemců je ${recipients}, najednou lze poslat nejvýše ${max}. Rozděl přidělení na menší skupiny adresátů.`,
      sent: (n) => `Odesláno ${n} lidem, kteří ještě nepotvrdili.`,
      sentWithFailures: (n, failed) => `Odesláno ${n}. Nedoručitelné: ${failed}`,
    },

    reminders: {
      heading: "Připomínky",
      intro: days => `Lidé, kteří mají něco nepotvrzené déle než ${daysCs(days)}. Jeden e-mail na člověka — kdo mešká se čtyřmi předpisy, dostane jednu zprávu se čtyřmi řádky.`,
      open: "Připomenout",
      emptyTitle: "Není komu připomínat",
      none: days => `Všichni, kterým běží termín, už potvrdili — nikdo nemešká více než ${daysCs(days)}.`,
      person: (documents, days) => `${documents === 1 ? "1 dokument" : documents >= 2 && documents <= 4 ? `${documents} dokumenty` : `${documents} dokumentů`} · nejdéle ${daysCs(days)}`,
      send: people => people === 1 ? "Odeslat 1 připomínku" : people >= 2 && people <= 4 ? `Odeslat ${people} připomínky` : `Odeslat ${people} připomínek`,
      impactEmails: n => n === 1 ? "Odejde 1 e-mail" : n >= 2 && n <= 4 ? `Odejdou ${n} e-maily` : `Odejde ${n} e-mailů`,
      impactNote: "Lidé, kteří už potvrdili, nedostanou nic (D61). Odeslaný e-mail se odvolat nedá.",
      sent: n => `Odesláno: ${n}.`,
      nobody: "Není komu připomínat.",
      modeLabel: "Komu poslat",
      modeNotice: "Všem nepotvrzeným",
      modeOverdue: days => `Jen meškajícím (${daysCs(days)}+)`,
      noticeHeading: "Dát vědět e-mailem",
      noticeIntro: "Každý, kdo má něco nepotvrzené — i to, co přibylo dnes. Patří sem i povinnosti z tras, ke kterým přidělení neexistuje, a ty jinak nemají jak dát o sobě vědět. Jeden e-mail na člověka.",
      noticeNone: "Nikdo nemá nic nepotvrzené.",
      noticePerson: documents => documents === 1 ? "1 dokument" : documents >= 2 && documents <= 4 ? `${documents} dokumenty` : `${documents} dokumentů`,
      noticeSend: people => people === 1 ? "Odeslat 1 e-mail" : people >= 2 && people <= 4 ? `Odeslat ${people} e-maily` : `Odeslat ${people} e-mailů`,
      noticeSent: n => `Odesláno: ${n}.`,
      noticeNobody: "Není komu posílat.",
      fromTrack: title => `z trasy „${title}“`,
    },
  },

  tree: {
    saveOrder: "Uložit pořadí",
    cancel: "Zrušit změny",
    hint: "Pořadí se zapíše až tlačítkem.",
  },

  valueSelect: {
    onlyHere: "jen zde",
    notInCodelist: "není v číselníku",
    searchOf: (shown, total) => `${shown} z ${total}`,
    groups: {
      count: n => n === 1 ? "1 člověk" : n >= 2 && n <= 4 ? `${n} lidé` : `${n} lidí`,
      newPlaceholder: "Nová skupina",
      foot: "Nová skupina vznikne uložením osoby. Více skupin oddělte čárkou.",
      emptyFoot: "Zatím žádná skupina — vznikne první, kterou napíšete.",
      search: "Hledat skupinu",
    },
    tags: {
      count: n => n === 1 ? "1 dokument" : n >= 2 && n <= 4 ? `${n} dokumenty` : `${n} dokumentů`,
      newPlaceholder: "Nová značka",
      foot: "Nová značka vznikne uložením dokumentu a přibude do číselníku organizace. Více značek oddělte čárkou.",
      emptyFoot: "Zatím žádná značka — vznikne první, kterou napíšete.",
      search: "Hledat značku",
    },
    similar: (v, like) => `„${v}“ jsme neuložili: podobá se existující „${like}“.`,
    similarGroupNote: "Ostatní údaje osoby jsou uložené. Vyberte, co platí, a uložte znovu.",
    similarTagNote: "Ostatní údaje dokumentu jsou uložené. Vyberte, co platí, a uložte znovu.",
    pickLike: like => `Použít „${like}“`,
    createAnyway: v => `Založit „${v}“`,
    similarSkipped: (v, like) => `Značku „${v}“ jsme nepřidali — podobá se „${like}“. Přidejte ji v úpravě dokumentu.`,
  },
  multiSelect: {
    searchHint: "hledat…",
    nothingFound: "Nic se nenašlo.",
    nothingFoundNew: "Nic se nenašlo — pište jinak, nebo přidejte novou hodnotu klávesou Enter.",
    empty: "Zatím tu žádné hodnoty nejsou.",
    clearAll: "Zrušit výběr",
    done: "Hotovo",
    remove: (value) => `Odebrat ${value}`,
    chosenOf: (chosen, total) => `Vybráno ${chosen} z ${total}`,
  },
  overview: {
    hello: name => `Dobrý den, ${name}`,
    tiles: {
      toAcknowledge: "K potvrzení",
      toApprove: "Čeká na schválení",
      new: "Nové",
      expiring: "Expiruje",
    },
    soonNote: n => (n === 1 ? "1 spěchá" : `${n} spěchá`),
    mine: "na mě",
    newNote: days => `dokumentů za ${days} dní`,
    expiringNote: days => `předpisů do ${days} dní`,
    attention: "Vyžaduje vaši pozornost",
    news: "Novinky v knihovně",
    empty: {
      attentionTitle: "Nikdo od vás nic nečeká",
      attentionText: "Když vám někdo přidělí normu nebo vás určí schvalovatelem, objeví se to tady i s termínem.",
      newsTitle: days => `Za posledních ${days} dní nic nového`,
      newsText: "Nová znění a ta, kterým se blíží konec platnosti, se ukážou tady.",
    },
    showAll: n => `Zobrazit všech ${n} →`,
    wholeLibrary: "Celá knihovna →",
    allTasks: "Všechny úkoly →",
    forYou: "Pro vás",
    by: date => `do ${date}`,
    until: date => `platí do ${date}`,
    expiringChip: "expiruje",
    open: "Otevřít",
    decide: "Rozhodnout",
    submittedBy: who => `předložil ${who}`,
  },
  evidence: {
    colPerson: "Osoba",
    colDocument: "Předpis · znění",
    colState: "Stav",
    colDate: "Datum",
    heading: "Řetěz důkazů",
    intro: "Co se dělo s každou uloženou povinností \u2014 od přidělení po potvrzení. Skládá se při zobrazení; neukládá se nic.",
    emptyTitle: "Žádné záznamy",
    emptyText: "Záznam vznikne, když někdo dostane přidělený předpis nebo krok trasy.",
    emptyFilterTitle: "Filtru nic nevyhovuje",
    emptyFilterText: "Zkuste jiné jméno nebo jiný stav.",
    kind: {
      assigned: "Přiděleno",
      notified: "Ozvalo se jí",
      opened: "Poprvé otevřeno",
      read: "Čas nad zněním",
      acknowledged: "Potvrzeno",
    },
    gap: {
      "before-recording": "tehdy se to ještě nezaznamenávalo",
      expired: "měření se po roce smazalo",
      "not-yet": "zatím ne",
    },
    informative: "informativní",
    rows: {
      ip: "IP adresa",
      department: "Oddělení v době potvrzení",
      statement: "Znění formulky",
      reading: "Čas čtení",
      opened: "Poprvé otevřel",
      revokedBy: "Odvolal",
      revokeReason: "Důvod odvolání",
    },
    none: "—",
    seconds: n => (n < 60 ? `${n} s` : `${Math.round(n / 60)} min`),
    times: n => (n === 1 ? "jednou" : n >= 2 && n <= 4 ? `${n}krát` : `${n}krát`),
    states: {
      acknowledged: "potvrzeno",
      "opened-not-acknowledged": "otevřeno a nepotvrzeno",
      "not-opened": "ani neotevřeno",
    },
    filterPerson: "Osoba",
    filterState: "Stav",
    filterAll: "všechny",
    apply: "Použít",
    exportCsv: "Export CSV",
    shown: (n, all) => `${n} z ${all} povinností`,
    allPeople: "všichni lidé →",
    notifiedMissing: "Řádek o upozorněních osa zatím nemá: log připomínek je provozní a po 90 dnech se maže, a zápis na přidělení říká „ozvalo se N lidem\u201c, ne kterým.",
  },
  approvals: {
    openPdf: "Otevřít PDF",
    searchText: "Text pro vyhledávání a odpovědi — schvaluje se spolu s PDF",
    heading: "Ke schválení",
    intro: "Znění, která někdo předložil a čekají na tvé rozhodnutí. Rozhoduješ sám za sebe \u2014 ostatní schvalovatelé rozhodují nezávisle.",
    emptyTitle: "Nic nečeká na vaše rozhodnutí",
    emptyText: "Když vás někdo určí schvalovatelem znění, objeví se tady celý text i s tím, kdo ho předložil.",
    versionLine: (label, round) => `${label} \u00b7 ${round}`,
    roundLine: round => `${round}. kolo`,
    submittedBy: (who, when) => `předložil ${who} \u00b7 ${when}`,
    effectiveFrom: date => `účinnost od ${date}`,
    noEffectiveFrom: "datum účinnosti zatím není \u2014 přidělit to půjde až s ním",
    newVersionFrom: d => `Nové znění od ${d}`,
    firstVersionFrom: d => `První znění od ${d}`,
    draftVersion: "Nové znění",
    kicker: (round, who, when) => `${round}. kolo · předložil ${who} · ${when}`,
    whatYouApprove: "Co schvaluješ",
    whatYouApproveNote: "PDF, text a údaje o znění — jedním rozhodnutím",
    searchTextNote: "Text pro vyhledávání a odpovědi — schvaluje se spolu s PDF",
    metaHeading: "Údaje o znění",
    metaNote: "součást schválení · po předložení je nelze měnit",
    noteFrom: "Poznámka od předkladatele",
    alsoDecidingHeading: "Rozhodují také",
    readAndDecide: "Přečíst a rozhodnout",
    alsoDeciding: names => `Rozhodují také: ${names}`,
    readText: "přečíst znění",
    noText: "Znění nemá text.",
    draftChanged: "Text se po předložení ke schválení změnil. Toto kolo se týká původní podoby, která už neexistuje — správce obsahu ho musí předložit znovu.",
    reason: "Důvod",
    reasonPlaceholder: "Například: článek 4 odporuje stanovám.",
    reasonHint: "Při zamítnutí je důvod povinný. Při schválení nepovinný \u2014 ale zůstane v záznamu.",
    approve: "Schválit",
    reject: "Zamítnout",
    doneApproved: "Schváleno. Čeká se na ostatní schvalovatele.",
    doneApprovedClosed: "Schváleno. Znění je schválené celé.",
    doneRejected: "Zamítnuto. Znění se vrátilo do konceptu a důvod zůstává v historii.",
  },
  curation: {
    prepareHeading: "Připravit jako ověřenou odpověď",
    prepareIntro: "Posouzené odpovědi, u kterých jste napsali, jak měla odpověď znít. Připravený pár zveřejní správce obsahu — do znalostí se zatím nedostane.",
    prepareEmpty: "Zatím není z čeho připravit pár. Vzniká z posudku, kde je vyplněno „Jak měla odpověď znít“.",
    questionLabel: "Otázka",
    questionHint: "Znění můžete upravit — původní otázka je volný text a může obsahovat i to, co do znalostí nepatří.",
    answerLabel: "Ověřená odpověď",
    sourcesLabel: "Ze kterých úseků předpisu odpověď vznikla",
    sourcesHint: "Podle nich se určí, kdo smí pár vidět, a podle nich se archivuje, když se norma změní. Stačí jeden interní úsek a pár je interní.",
    noSources: "Tato odpověď nemá u zdrojů identifikátory úseků, takže z ní pár připravit nelze. Týká se to odpovědí před 15. 9. 2026.",
    save: "Připravit pár",
    draftBadge: "připraveno",
    publishHeading: "Ověřené odpovědi ke zveřejnění",
    publishIntro: "Páry připravené hodnotitelem. Zveřejněním se dostanou do znalostí jako ověřená odpověď — žádný předpis se tím nemění ani nepřepisuje.",
    publishEmpty: "Nic nečeká na zveřejnění",
    publishEmptyNote: "Když hodnotitel označí odpověď jako ověřenou, objeví se tady i se zdroji, ze kterých vychází.",
    preparedBy: "připravil",
    preparedByUnknown: "osoba už není v adresáři",
    access: "Přístup",
    accessPublic: "veřejný",
    accessInternal: "interní",
    accessNote: "Úroveň se odvozuje ze zdrojů, nezadává se. Při zveřejnění se počítá znovu.",
    publish: "Zveřejnit do znalostí",
    open: "Ověřené odpovědi",
    waiting: n => `${n} ke zveřejnění`,
  },
  evaluation: {
    heading: "K posouzení",
    intro: "Odpovědi, u kterých někdo řekl, že nesedí. Potvrďte nebo opravte jeho posudek a doplňte, jak měla odpověď znít — z toho se později dělá kurace.",
    empty: "Momentálně není co posuzovat.",
    emptyNote: "Sem se odpověď dostane až tehdy, když na ni někdo klikne „Nesedí“ nebo napíše, co je na ní špatně. Správné odpovědi vás nezdržují.",
    saidDoesNotFit: "nesedí",
    reported: "nahlášeno",
    reader: "od čtenáře",
    answerLabel: "Odpověď systému",
    showAnswer: "Zobrazit odpověď",
    hideAnswer: "Skrýt odpověď",
    sources: n => (n === 1 ? "1 zdroj" : n <= 4 ? `${n} zdroje` : `${n} zdrojů`),
    askedAt: "dotázáno",
    waiting: n => `${n} k posouzení`,
  },
  rating: {
    readerQuestion: "Sedí tato odpověď?",
    fits: "Sedí",
    doesNotFit: "Nesedí",
    readerThanks: "Děkujeme. Odpověď si prohlédne hodnotitel.",
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
  admin: {
    list: {
      heading: "Správa tenantů",
      intro: "Přehled organizací na platformě. Čísla se počítají při zobrazení, nikde se neukládají. Obsah organizací — dokumenty a potvrzení — tato role nezpřístupňuje.",
      newTenant: "Nová organizace",
      disabled: "vypnutý",
      noDomainWarning: "Do organizace se nedá přihlásit — přihlášení je vázané na domény. Doplňte aspoň jednu.",
      emptyTitle: "Žádné organizace",
      emptyText: "První přidáte tlačítkem výše.",
      people: "Osoby",
      peopleValue: (signedIn, total) => `${signedIn} / ${total} přihlášených`,
      versions: "Znění",
      documents: "Dokumenty",
      documentsValue: (valid, total) => `${valid} / ${total} platných`,
      acknowledgements: "Potvrzení",
      withoutVersion: "bez platného znění",
      instructionsSent: (when, to) => `Pokyny k doméně poslány ${when} na ${to}`,
      domainsNoteBefore: "Stav domén ve Vercelu ukáže ",
      domainsNoteAfter: "; do obrazovky přibude v rozsahu C spolu se zakládáním tenantů.",
    },
    create: {
      heading: "Nová organizace",
      introBefore: "Subdoména pod ",
      introMiddle: " funguje hned — pokrývá ji wildcard. Vlastní doména zákazníka se přidá do Vercelu automaticky a zbude mu nastavit jeden ",
      introAfter: ".",
      code: "Kód organizace",
      codeNoteBefore: "Velká písmena, číslice, pomlčka. Nese ho každá osoba, dokument i potvrzení — ",
      codeNoteHighlight: "později se nemění",
      codeNoteAfter: " — je součástí identifikátoru každého dokumentu.",
      codeTaken: "Kód {code} je už obsazený. Zvolte jiný.",
      name: "Název",
      nameNote: "To, co lidé uvidí v hlavičce portálu. Z názvu se navrhne kód organizace — zkratku, kterou organizace používá, klidně přepište.",
      supportEmail: "Kontakt organizace",
      supportEmailNote: "Sem půjdou pokyny k doméně.",
      domains: "Domény",
      domainsPlaceholder: "klub.contineo.app",
      domainsNote: "Jedna na řádek. Bez domény se portál organizace nikde neukáže.",
      submit: "Založit",
    },
    detail: {
      disabled: " · vypnutá",
      numbersHeading: "Čísla organizace",
      tracks: "Trasy",
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
      autoProvisionNotHosts: "Jsou to e-mailové domény pracovních účtů (jmeno@futbalsfz.sk), ne webové adresy portálu — ty jsou v záložce Domény.",
      save: "Uložit",
      disableHeading: "Vypnout organizaci",
      enableHeading: "Zapnout organizaci",
      disableNote: "Po vypnutí se nikdo z této organizace nepřihlásí — okamžitě. Záznamy potvrzení zůstávají, tenant se nemaže.",
      confirmLabel: (code) => `Napiš ${code} pro potvrzení`,
      confirmHint: "Záměrně to není obyčejné „opravdu?“ — to se odklikne dřív, než se přečte.",
      domainsSection: "Domény a zakládání",
      sendTitle: "Poslat pokyny k doméně",
      disableOpen: "Vypnout…",
      enableNote: "Lidé z organizace se budou moci znovu přihlásit.",
      cancel: "Zrušit",
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
      removeOwnTitle: p => `Odstranit vlastní přihlášení přes ${p}`,
      removeOwnNote: "Přihlášení se vrátí na nastavení od dodavatele, pokud ho má; jinak tlačítko z přihlašovací obrazovky zmizí.",
      removeOpen: "Odstranit…",
      cancel: "Zrušit",
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
    "certificate.notFound": "Certifikát neexistuje.",
    "csv.expectedRequired": "krátký text potřebuje očekávanou odpověď v answer_1",
    "csv.trueFalse": "u pravdy/nepravdy je correct true nebo false",
    "csv.correctOutOfRange": "číslo v correct není mezi vyplněnými odpověďmi",
    "csv.multipleTwo": "více správných potřebuje 3–8 odpovědí a alespoň dvě čísla v correct",
    "csv.singleOne": "jedna správná potřebuje 2–8 odpovědí a právě jedno číslo v correct",
    "csv.difficulty": "obtížnost je easy, medium nebo hard",
    "csv.weight": "váha musí být celé číslo alespoň 1",
    "csv.tagShape": "smart:tag není ve tvaru Klíč: Hodnota",
    "csv.tagsRequired": "chybí smart:tag",
    "csv.textRequired": "chybí znění otázky",
    "csv.duplicateId": "id je v souboru dvakrát",
    "csv.type": "neznámý typ otázky",
    "attempt.closed": "Pokus je už uzavřený.",
    "attempt.notFound": "Pokus se nenašel.",
    "attempt.notEnoughQuestions": "V bance není dost otázek na tento test.",
    "attempt.passed": "Test už máte složený.",
    "attempt.exhausted": "Všechny pokusy jsou vyčerpané.",
    "attempt.pause": "Další pokus zatím není možný — test má pauzu mezi pokusy.",
    "attempt.testNotFound": "Takový test není.",
    "test.notFound": "Takový test není.",
    "test.noTitle": "Název testu je povinný.",
    "test.keyTaken": "Test „{key}“ už existuje.",
    "test.keyShape": "Klíč testu „{key}“ nemá správný tvar.",
    "test.keyReserved": "Klíč testu „{key}“ je vyhrazený pro část sekce Testy — zvolte jiný.",
    "question.notFound": "Taková otázka v bance není.",
    "question.trueFalseMissing": "Vyberte, zda je správná pravda nebo nepravda.",
    "question.weight": "Váha musí být celé číslo alespoň 1.",
    "question.tagRequired": "Otázka potřebuje alespoň jeden smart:tag — bez něj ji žádný test nevylosuje.",
    "question.expectedRequired": "Chybí očekávaná odpověď.",
    "question.altRequired": "Chybí popis obrázku.",
    "question.answerEmpty": "Některá odpověď je prázdná.",
    "question.multipleTwoCorrect": "U více správných musí být správné alespoň dvě.",
    "question.singleOneCorrect": "U jedné správné odpovědi musí být správná právě jedna.",
    "question.tooManyAnswers": "Odpovědí může být nejvýše 8.",
    "question.tooFewAnswers": "Otázka má málo odpovědí — jedna správná alespoň 2, více správných alespoň 3.",
    "question.contentRequired": "Otázka potřebuje text nebo alespoň jeden obrázek či video.",
    "learning.audienceRequired": "Vyberte adresáty.",
    "learning.urlInvalid": "Adresa videa není platná — podporovány jsou YouTube, Vimeo a odkazy https.",
    "learning.fileRequired": "Nejprve nahrajte soubor.",
    "learning.documentRequired": "Vyberte dokument z knihovny.",
    "learning.textRequired": "Text bloku je prázdný.",
    "learning.altRequired": "Chybí popis obrázku.",
    "learning.partTitleRequired": "Název části je povinný.",
    "learning.mediaType": "Soubor {name} není obrázek ani video MP4 či WebM.",
    "learning.topicRequired": "Vyberte téma kurzu.",
    "learning.mergeNeedsTwo": "Ke sloučení jsou potřeba alespoň dva smart:tagy.",
    "learning.tagShape": "„{value}“ není smart:tag ve tvaru „Klíč: Hodnota“.",
    "learning.courseKeyShape": "Klíč kurzu „{key}“ nemá správný tvar — malá písmena bez diakritiky, číslice a pomlčka.",
    "learning.courseKeyReserved": "Klíč kurzu „{key}“ je vyhrazený pro část správy kurzů — zvolte jiný.",
    "learning.titleRequired": "Název kurzu je povinný.",
    "learning.courseKeyTaken": "Kurz s klíčem „{key}“ už existuje.",
    "learning.courseNotFound": "Takový kurz neexistuje.",
    "learning.noDraft": "Kurz nemá koncept — zveřejněná verze se nemění. Začněte novou verzi.",
    "learning.draftExists": "Kurz už má rozpracovaný koncept.",
    "learning.notPublished": "Kurz není zveřejněný.",
    "learning.notOpen": "Do tohoto kurzu se zapsat nelze — není otevřený.",
    "learning.reasonRequired": "Důvod je povinný.",
    "learning.enrollmentCancelled": "Zápis do kurzu je zrušený.",
    "learning.blockNotFound": "Takový blok v kurzu není.",
    "learning.partNotFound": "Taková část v kurzu není.",
    "learning.locked": "Část je zamčená — nejprve dokončete předchozí povinné části.",
    "learning.videoNotWatched": "Nejprve dokoukejte povinné video.",
    "learning.testNotPassed": "Nejprve složte povinný test.",
    "learning.topicLabelRequired": "Název tématu je povinný.",
    "learning.topicKeyShape": "Klíč tématu může obsahovat jen malá písmena bez diakritiky, číslice a podtržítko.",
    "learning.topicKeyTaken": "Téma s takovým klíčem už existuje (i mezi vyřazenými).",
    "legalBasis.unknownKey": "Taková položka v číselníku právních základů není, nebo je skrytá či vyřazená.",
    "legalBasis.badKey": "Klíč může obsahovat jen malá písmena bez diakritiky, číslice a podtržítko.",
    "legalBasis.labelRequired": "Název právního základu je povinný.",
    "legalBasis.keyTaken": "Takový klíč už v číselníku je (i mezi skrytými a vyřazenými položkami).",
    "legalBasis.notCustom": "Takovou vlastní položku organizace nemá.",
    "legalBasis.notStandard": "Taková standardní položka neexistuje.",
    "responsibility.personRequired": "Odpovědná osoba je povinná — na ni se budou obracet lidé, kteří znění potvrzují.",
    "responsibility.unknownPerson": "Vybraná odpovědná osoba zde není nebo je vyřazená.",
    "responsibility.samePerson": "Toto už je odpovědná osoba tohoto znění.",
    "responsibility.reasonRequired": "Důvod změny odpovědné osoby je povinný — za rok se musí dát zjistit, proč se kontakt změnil.",
    "responsibility.notContentManager": "Odpovědnou osobu určuje správce obsahu.",
    "legalBasis.invalid": "Takový právní základ systém nezná.",
    "legalBasis.referenceRequired": "U zákonné povinnosti je odkaz na předpis povinný (například § 7 zákona č. 124/2006 Z. z.).",
    "legalBasis.referenceTooLong": "Odkaz na předpis je příliš dlouhý — stačí citace, ne text ustanovení.",
    "legalBasis.noChange": "Právní základ je už takto určen.",
    "legalBasis.reasonRequired": "Důvod změny právního základu je povinný — potvrzení, která mezitím vznikla, si nesou původní.",
    "legalBasis.notAllowed": "Právní základ určuje odpovědná osoba tohoto znění. Správce obsahu jej smí určit jen tehdy, když znění odpovědnou osobu nemá nebo už není aktivní.",
    "legalBasis.noDraft": "Dokument nemá připravované znění — právní základ se určuje u zveřejněného znění.",
    "legalBasis.draftNotAllowed": "Právní základ připravovaného znění určuje jeho odpovědná osoba. Správce obsahu jej smí určit jen tehdy, když ji příprava nemá nebo už není aktivní.",
    unknown: "Nepodařilo se to. Zkus to znovu.",

    // schvalovani zneni (ADR-006)
    "approval.noApprovers": "Vyber alespoň jednoho schvalovatele. Kolo bez nich by nešlo uzavřít.",
    "approval.selfApproval": "Sebe vybrat nemůžeš. Kdo text nahrál, ten ho neschvaluje \u2014 jinak je schválení podpis pod vlastní prací.",
    "approval.alreadyRunning": "Pro toto znění už kolo běží. Počkej, až se uzavře, nebo ho zruš.",
    "approval.alreadyApproved": "Toto znění je schválené. Jiný text znamená nové znění, ne nové kolo.",
    "approval.publishedBefore": "Toto znění bylo zveřejněno před zavedením schvalování a zpětně se neschvaluje. Nahradí ho oficiální znění.",
    "approval.unknownApprover": "Někdo z vybraných schvalovatelů tu není nebo je vyřazený.",
    "approval.documentNotFound": "Takový dokument tu není.",
    "approval.pdfRequired": "Koncept nemá PDF — nahraj znění znovu i s PDF. Schvaluje se PDF spolu s textem.",
    "approval.draftChanged": "Koncept se mezitím změnil — obnov stránku a předlož ho znovu.",
    "approval.reasonRequired": "Bez důvodu kolo zrušit nelze. Za rok nikdo nezjistí, proč skončilo.",
    "approval.nothingRunning": "Pro toto znění neběží žádné kolo.",
    "assignment.notApproved": "Znění není schválené. Přidělit lze až text, na kterém se někdo shodl \u2014 předlož ho ke schválení v detailu dokumentu.",
    "approval.notApprover": "Toto kolo na tebe nečeká \u2014 nejsi mezi jmenovanými schvalovateli.",
    "approval.roundClosed": "Kolo je uzavřené. Rozhodnutí do něj už přibýt nemůže.",
    "approval.alreadyDecided": "Rozhodnutí je zapsané a nemění se. Když si to rozmyslíš, předkladatel kolo zruší a otevře nové \u2014 v historii bude vidět obojí.",

    // ── převod souboru ─────────────────────────────────────────────────────
    "conversion.zipNotOffice": "Toto je ZIP balík, ale ani docx, ani xlsx. Staré .doc a .xls převádět nelze — ulož je ve Wordu nebo Excelu jako novější formát.",
    "conversion.unsupportedFormat": "Formát {format} zatím neumíme převést. Podporujeme .docx, .pdf, .xlsx, .md, .txt a .csv.",
    "rewrite.answerTruncated": "Model nestihl dopsat celý dokument — odpověď je useknutá. Polovina předpisu se použít nedá; rozděl dokument a přepiš ho po částech.",
    "library.noStructureFound": "V textu se nenašla ani jedna úroveň členění (ČÁST, hlava, Článek, příloha). Buď je text členěn jinak, nebo jde o sken a je třeba ho přepsat jazykovým modelem.",
    "conversion.pdfEngineFailed": "Toto PDF se nepodařilo otevřít. Buď je poškozené nebo zaheslované, nebo je chyba na naší straně — zkoušet znovu nepomůže. Ozvi se správci systému, podrobnosti jsou v záznamu.",
    "conversion.pdfNoText": "V tomto PDF není žádný text — je to obrázek (sken). Převod ho nepřečte. V editoru ho můžeš nechat přepsat jazykovým modelem, nebo si vyžádej od autora původní soubor.",
    "conversion.noText": "Soubor neobsahuje žádný text.",

    // ── uložený soubor ─────────────────────────────────────────────────────
    "file.empty": "Soubor je prázdný.",
    "file.tooLarge": "Soubor má {mb} MB, strop je {maxMb} MB.",
    "file.nameRequired": "Soubor nemá název.",
    "file.uploadNotFound": "Nahrávání se nenašlo nebo vypršelo. Začni znovu.",
    "file.chunkInvalid": "Část souboru nepřišla celá. Zkus nahrát znovu.",
    "file.uploadIncomplete": "Soubor nepřišel celý. Zkus nahrát znovu.",

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
    "objection.emptyText": "Chybí znění námitky.",
    "objection.alreadyPending": "Vaše předchozí námitka se ještě posuzuje.",
    "archive.no-current": "Předpis nemá platné znění, které by šlo archivovat.",
    "archive.already-archived": "Předpis je už archivován.",
    "archive.upcoming": "Předpis má zveřejněnou novelu, která ještě neplatí. Archivovat jde, až začne platit.",
    "archive.draft": "Připravuje se nové znění. Nejprve ho dokonči nebo zahoď.",
    "archive.round-open": "Běží kolo schvalování. Nejprve ho ukonči.",
    "archive.date-before-start": "Datum musí být později než začátek platnosti znění.",
    "archive.no-reason": "Chybí důvod archivace.",
    "archive.not-archived": "Předpis není archivován.",
    "archive.bad-date": "Datum není platné.",
    "objection.badDate": "Datum doručení není platné datum.",
    "objection.futureDate": "Datum doručení nemůže být v budoucnosti.",
    "objection.badDecision": "Vyber, zda námitce vyhovět, nebo ji zamítnout.",
    "objection.noteRequired": "Rozhodnutí potřebuje odůvodnění.",
    "objection.personNotFound": "Osoba s adresou {email} v organizaci není.",
    "objection.notFound": "Taková námitka tu není.",
    "objection.notPending": "O námitce už bylo rozhodnuto.",
    "person.badEndedAt": "Datum skončení není platné datum.",
    "person.endedInFuture": "Datum skončení nemůže být v budoucnosti.",
    "person.endedNotInactive": "Skončení vztahu se zadává až u vyřazené osoby.",
    "person.badEmail": "To není e-mailová adresa.",
    "person.emailTaken": "{email} v organizaci už je.",
    "person.alreadyInvited": "{email} je v organizaci už zapsaná.",
    "person.nameRequired": "Jméno je povinné — bez něj je v seznamu jen adresa.",
    "person.nameRequiredShort": "Jméno je povinné.",
    "tenant.overdueDaysRange": "Počet dnů musí být od 1 do 365.",
    "tenant.phonePrefixShape": "Předvolba „{value}“ nemá správný tvar — očekává se například +420.",
    "tenant.registrationNumberShape": "IČO „{value}“ nemá správný tvar — očekává se 6 až 12 číslic.",
    "tenant.privacyContactEmailShape": "Adresa „{value}“ nemá tvar e-mailové adresy.",
    "person.givenNameRequired": "Jméno je povinné.",
    "person.surnameRequired": "Příjmení je povinné.",
    "person.unknownWorkplace": "Pracoviště „{value}“ v číselníku organizace není. Doplňte ho v Organizace → Číselníky.",
    "phone.noPrefix": "Číslu „{value}“ chybí předvolba — napište ho s nulou (0905…) nebo mezinárodně (+420…).",
    "phone.shape": "„{value}“ nevypadá jako telefonní číslo.",
    "phone.invalid": "„{value}“ není platné telefonní číslo pro zvolenou zemi — zkontrolujte zemi a počet číslic.",
    "person.departmentNotFound": "Takové oddělení neexistuje.",
    "person.unknownType": "Neznámý typ osoby.",
    "person.unknownGender": "Neznámé pohlaví.",

    // ── přidělování předpisů ───────────────────────────────────────────────
    "assignment.missingReason": "Důvod přidělení je povinný — je to jediné místo, kde lze zaznamenat, proč se má předpis potvrdit znovu (D30).",
    "assignment.missingCompany": "Chybí kód organizace.",
    "assignment.missingSubject": "Chybí dokument nebo jeho znění.",
    "assignment.versionNotEffective": "Znění nemá datum platnosti, a tak je nelze ani potvrdit (D6). Nejprve mu doplň platnost.",
    "assignment.missingAudience": "Chybí, komu se přiděluje.",
    "assignment.badDue": "Termín není platné datum.",
    "assignment.badDueDays": "Termín ve dnech musí být aspoň jeden den.",
    "assignment.dueBeforeEffective": "Termín je dřív, než znění začne platit — takovou povinnost by nikdo nesplnil (D6).",

    // ── trasy ──────────────────────────────────────────────────────────────
    "track.titleRequired": "Název trasy je povinný.",
    "track.notFound": "Taková trasa tu není.",
    "track.titleTaken": "Trasa s názvem „{title}“ už existuje — název musí být jedinečný, podle něj se trasa vybírá i importuje.",
    "track.badDueDays": "Počet dnů musí být od 1 do 365.",
    "track.noMembersChosen": "Vyberte osoby nebo oddělení.",
    "track.documentNotFound": "Dokument „{documentId}“ v této organizaci není.",
    "track.noSteps": "Prázdnou trasu zapnout nelze — nejdřív jí přidej kroky.",

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
    "tenant.alreadyExists": "Organizace {code} už existuje. Volný je {free} — použijte ten, nebo zvolte vlastní zkratku.",
    "ai.keyRejected": "Anthropic klíč odmítl — zkontrolujte, zda je celý a platný.",
    "ai.keyUnverified": "Klíč se nepodařilo ověřit — Anthropic neodpovídá. Zkuste to za chvíli.",
    "ai.unknownModel": "Model „{value}“ není v nabídce.",
    "helpdesk.nameRequired": "Název kanálu je povinný.",
    "helpdesk.notFound": "Takový kanál tady není.",
    "helpdesk.mailboxKind": "Neznámý druh schránky.",
    "helpdesk.mailboxAddress": "Adresa schránky není e-mailová adresa.",
    "helpdesk.graphIds": "U Microsoft 365 je povinný tenant a client id aplikace.",
    "helpdesk.noMailbox": "Kanál nemá schránku.",
    "helpdesk.noSecret": "Schránka nemá uložené tajemství aplikace.",
    "helpdesk.secretUnreadable": "Tajemství schránky se nedá rozšifrovat — zadej ho znovu.",
    "helpdesk.imapNotYet": "IMAP schránka ještě není k dispozici — zatím jen Microsoft 365.",
    "connector.nameRequired": "Název konektoru je povinný.",
    "connector.endpoint": "Adresa serveru musí být úplná a začínat https://.",
    "connector.profile": "Neznámý profil serveru.",
    "connector.badPattern": "Vzor „{pattern}“ nelze použít jako regulární výraz.",
    "connector.scopeDuplicate": "Dva rozsahy mají stejný klíč.",
    "connector.notFound": "Takový konektor tu není.",
    "connector.noPending": "Přihlášení nebylo zahájeno nebo už vypršelo — zkuste znovu.",
    "connector.authStart": "Server nedovolil zahájit přihlášení ({detail}).",
    "connector.alreadyConnected": "Konektor je už připojen.",
    "connector.authFinish": "Výměna kódu za token selhala ({detail}).",
    "connector.notConnected": "Konektor není připojen.",
    "connector.timeout": "Server neodpověděl včas.",
    "connector.unauthorized": "Přihlášení ke konektoru vypršelo — připojte ho znovu.",
    "connector.ingestOff": "Konektor nemá zapnutý import do knihovny.",
    "connector.noImportProfile": "Profil tohoto serveru import nepodporuje.",
    "connector.nothingSelected": "Není vybrán žádný článek.",
    "library.notFromConnector": "Tento dokument nevznikl z konektoru.",
    "helpdesk.hasTickets": "Kanál má tickety — odstranit se nedá, jen přestat používat.",
    "helpdesk.kind": "Neznámý typ kanálu.",
    "helpdesk.syncInterval": "Neznámý interval synchronizace.",
    "helpdesk.noTickets": "Kanál nemá zapnuté tickety.",
    "helpdesk.miningFailed": "Těžba FAQ se nepodařila (dávka {batch}) — zkuste to za chvíli.",
    "ticket.notFound": "Takový ticket tady není.",
    "ticket.notEmail": "Ticket nevznikl z e-mailu — nemá vlákno ve schránce.",
    "ticket.emptyDraft": "Prázdný návrh se uložit nedá.",
    "ticket.emptyAnswer": "Prázdná odpověď se odeslat nedá.",
    "ticket.noRecipient": "Ticket nemá komu odpovědět — chybí adresa.",
    "ticket.aiFailed": "Asistent návrh nepřipravil — zkuste to za chvíli.",
    "ticket.emptyQuestion": "Ticket nemá text otázky.",
    "widget.tokenShape": "Token nemá tvar JWT.",
    "widget.tokenSignature": "Podpis tokenu nesedí.",
    "widget.tokenExpired": "Token vypršel.",
    "widget.tokenAudience": "Token patří jinému kanálu.",
    "widget.tokenIssuer": "Vydavatel tokenu není mezi povolenými původy kanálu.",
    "widget.tokenClaims": "Token nemá potřebné údaje o osobě.",
    "widget.noSecret": "Kanál nemá tajný klíč.",
    "widget.rateLimited": "Příliš mnoho otázek — zkus to později.",
    "mailbox.auth": "Přihlášení aplikace do Microsoft 365 selhalo — zkontroluj tenant, client id a tajemství.",
    "mailbox.forbidden": "Schránka odmítla přístup — zkontroluj oprávnění aplikace a zúžení na schránku.",
    "mailbox.notFound": "Schránka s touto adresou v organizaci není.",
    "mailbox.cursorExpired": "Značka synchronizace vypršela — další spuštění začne znovu.",
    "mailbox.failed": "Schránka neodpověděla správně.",
    "tenant.noEncryptionKey": "Tajemství nelze uložit: chybí OAUTH_SECRET_ENCRYPTION_KEY. Ukládat ho čitelně nebudeme — je to přístup do cizího systému.",
    "tenant.needsBothCredentials": "Je potřeba clientId i tajemství — jedno bez druhého použít nelze.",

    // ── knihovna ───────────────────────────────────────────────────────────
    "library.noFileChosen": "Nevybral jsi soubor.",
    "library.pdfRequired": "Schvalovaná podoba musí být PDF — ulož dokument ve Wordu jako PDF.",
    "library.sourceNotPdf": "Zdrojový soubor má být upravitelný (.docx, .xlsx, .md…), ne druhé PDF.",
    "library.uploadedFileNotFound": "Nahraný soubor se nenašel. Zkus ho nahrát znovu.",
    "library.documentNotFound": "Takový dokument tu není.",
    "chunking.unknownProfile": "Profil členění „{value}“ neexistuje.",
    "chunking.labelRequired": "Profil potřebuje název.",
    "chunking.aiNoText": "Dokument nemá text, není co analyzovat.",
    "chunking.aiNoKey": "Umělá inteligence nemá nastavený klíč — nastavte ho v Organizace → Umělá inteligence.",
    "chunking.aiFailed": "Analýza se nepodařila — zkuste to za chvíli.",
    "chunking.labelTaken": "Profil s názvem „{value}“ už existuje — použijte ho, nebo zvolte jiný název.",
    "library.titleLocked": "Název dokumentu se zveřejněným zněním se mění jen novým zněním — změň ho v přípravě nového znění, schválí se s ním.",
    "library.documentExists": "Dokument „{title}“ ({documentId}) už existuje. Nové znění se nahrává na jeho detailu, ne jako nový dokument — tato obrazovka zakládá nový dokument.",
    "library.documentKeyShape": "Klíč dokumentu „{key}“ nemá správný tvar — smí mít jen malá písmena bez diakritiky, číslice a podtržítka.",
    "library.noOriginalFile": "Dokument nemá původní soubor, který by šel přepsat.",
    "library.onlyPdfRewrite": "Přepisovat lze jen PDF — ostatní formáty se převedou přímo.",
    "library.originalNotFound": "Původní soubor se nenašel.",
    "library.noDraft": "Žádný návrh tu není.",
    "library.titleRequired": "Název dokumentu je povinný — bez něj je v seznamu jen klíč.",
    "library.emptyText": "Prázdný text uložit nelze — dokument by neměl co obsahovat.",
    "library.labelRequired": "Označení znění je povinné — objeví se doslovně v každém záznamu o potvrzení. Napiš to, co je v dokumentu (například: úplné znění z 27. 2. 2026), ne vymyšlené číslo.",
    "library.effectiveFromRequired": "Datum platnosti je povinné — bez něj znění nelze potvrdit (D6).",
    "meta.badDate": "Datum v údajích o znění není platné datum.",
    "meta.approvedOnInFuture": "Datum schválení nemůže být v budoucnosti.",
    "meta.noDraft": "Dokument nemá koncept — údaje o znění se zadávají u nového znění.",
    "meta.locked": "Údaje o znění se už měnit nedají — koncept je ve schvalování nebo schválený. Změna by zrušila schválení; nahraj nové znění.",
    "meta.effectiveFromApproved": "Datum účinnosti bylo schváleno spolu se zněním — změnit ho lze jen novým zněním a novým schválením.",
    "meta.effectiveFromRequired": "Před předložením doplň v údajích o znění datum účinnosti.",
    "library.effectiveFromSourceRequired": "Zdroj data platnosti je povinný — napiš, odkud datum je (například usnesení VV SFZ č. … z …). Po prvním potvrzení se datum už měnit nedá.",
    "library.documentHasNoText": "Dokument nemá text — nejprve nahraj soubor nebo napiš znění.",
    "library.noChunks": "Z textu nevznikl ani jeden úsek. Zkontroluj, jestli má dokument členění na články nebo nadpisy.",
    "library.faqNoEntries": "FAQ nemá ani jeden záznam — přidej aspoň jednu otázku s odpovědí.",
    "library.faqQuestionRequired": "Otázka je povinná — bez ní záznam nemá co zodpovědět.",
    "library.faqAnswerRequired": "Odpověď je povinná — otázka bez odpovědi do FAQ nepatří.",
    "library.faqTooLong": "Záznam je příliš dlouhý — otázka do {question} a odpověď do {answer} znaků.",
    "library.faqEntryNotFound": "Takový záznam v tomto FAQ není.",
    "library.faqSourceUnknown": "Zdrojový dokument {documentId} tady není.",
    "library.notFaq": "Tento dokument není FAQ.",
    "library.noPublishedVersion": "Dokument nemá publikované znění — přeindexovat lze jen to, co už je venku.",
    "library.versionHasNoText": "Toto znění nemá uložený text — není co rozdělit.",
    "library.noChunksProfile": "Z textu nevznikl ani jeden úsek — zkontroluj profil členění.",
    "library.reindexWouldLoseArticles": "Přeindexování by tento dokument pokazilo: dnes má {before} z {beforeTotal} úseků s rozpoznaným článkem, po nařezání by jich mělo {after} z {afterTotal}. Text v databázi má hlavičky v jiném tvaru, než jaký chunker zná — dokud se to neopraví, staré členění je lepší než nové.",
    "library.reasonRequired": "Důvod opravy je povinný — bez něj se za rok nedá zjistit, jestli šlo o překlep nebo o změnu povinnosti.",
    "textFix.notContentManager": "Text znění opravuje správce obsahu.",
    "textFix.noEffectiveVersion": "Dokument nemá platné znění. Opravit se dá jen to, co je venku — archivované znění je doklad o tom, co platilo tehdy.",
    "textFix.pastVersion": "Starší znění se neopravuje — je to doklad o tom, co tehdy platilo. Opravit lze platné znění a zveřejněnou novelu, která ještě neplatí.",
    "textFix.draftBusy": "Připravuje se nové znění — oprava textu by přepsala rozpracovaný koncept. Nejprve ho dokonči nebo zahoď.",
    "textFix.emptyText": "Koncept nemá text. Oprava, po které nezůstane nic, není oprava.",
    "textFix.draftChanged": "Koncept se mezitím změnil. Podívej se na rozdíl znovu — uložit se má to, co jsi viděl.",
    "textFix.noChange": "Text se od platného znění neliší. Není co opravovat.",
    "textFix.reasonRequired": "Důvod opravy je povinný — bez něj se za rok nedá zjistit, co se ve znění změnilo a proč přitom potvrzení zůstala platná.",
    "library.versionNotFound": "Takové znění tu není.",
    "versionFix.locked": "Označení a datum platnosti se už měnit nedají — toto znění potvrdilo {count} lidí a oba údaje jsou v podepsané formulce. Nejprve je třeba odvolat potvrzení tohoto znění, pak údaj opravit a nechat jej potvrdit znovu.",
    "versionFix.reasonRequired": "Důvod opravy je povinný.",
    "revocation.notHr": "Odvolat potvrzení smí jen personalista.",
    "revocation.nothingToRevoke": "Není co odvolávat — toto znění nemá platná potvrzení.",
    "revocation.reasonRequired": "Důvod odvolání je povinný — bez něj se za rok nedá zjistit, proč povinnost ožila.",
    "write-failed": "Zápis selhal. Zkus to znovu; co se už zapsalo, zůstává platné.",

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
      "ai-settings": "umělá inteligence",
      ticket: "ticket helpdesku",
      "helpdesk-channel": "kanál helpdesku",
      tenant: "tenant",
      track: "trasa",
      course: "kurz",
      enrollment: "zápis do kurzu",
      "smart-tag": "smart:tag",
      question: "otázka",
      test: "test",
      "test-attempt": "pokus o test",
      certificate: "certifikát",
    },
    actions: {
      created: "založeno",
      membersAdded: "přidáni na trasu",
      memberRemoved: "odebrán z trasy",
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
      "chunking-profile": "profil členění",
      "version-fix": "oprava znění",
      "text-fix": "oprava textu znění",
      "new-version": "nahráno nové znění",
      "responsible-changed": "změna odpovědné osoby",
      "legal-basis": "právní základ",
      merged: "sloučeno",
      "imported": "importováno",
      "reset": "resetováno",
      "archived": "archivováno",
      "validity-restored": "obnovena platnost",
      "retired": "vyřazeno z nabídky",
      "course-version": "nová verze kurzu",
    },
    fields: {
      folder: "složka",
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
    previewLabel: "Takhle to bude vypadat",
    previewButton: "Potvrdit",
    previewChipKey: "Druh:",
    previewChip: "Norma",
    previewLink: "odkaz v textu",
    showCustom: "Zadat vlastní hodnotu",
    hideCustom: "Skrýt vlastní hodnotu",
  },
  org: {
    heading: "Organizace",
    introBefore: "Nastavení, které si spravujete sami. Kód organizace (",
    introAfter: ") a vypnutí portálu tu záměrně nejsou — s tím se ozvěte nám.",
    tabsLabel: "Části nastavení",
    groups: { org: "Organizace", access: "Přístup", documents: "Dokumenty", oversight: "Dohled" },
    tabs: {
      general: "Obecné",
      departments: "Oddělení",
      domains: "Domény",
      signin: "Přihlašování",
      codelists: "Číselníky",
      ai: "Umělá inteligence",
      connectors: "Konektory",
      acknowledgements: "Potvrzování",
      audit: "Audit",
      gdpr: "GDPR",
    },
    gdpr: {
      readOnly: "Tato nastavení upravuje pověřenec (DPO). Vidíte je jen pro čtení.",
      saveContact: "Uložit kontakt",
      contactSaved: "Kontakt GDPR je uložen.",
      saved: "Nastavení GDPR jsou uložena.",
    },
    connectors: {
      intro: "Připojení k cizímu MCP serveru s více použitími. Živý zdroj: asistent při dotazu hledá i na serveru a výsledek cituje jako neověřený. Import do knihovny a nástroje asistenta přibudou.",
      none: "Zatím žádný konektor.",
      add: "Přidat konektor",
      edit: "Upravit",
      name: "Název",
      endpoint: "Adresa serveru",
      endpointHint: "Úplná adresa MCP serveru, např. https://mcp.sportnet.online/mcp.",
      profile: "Profil serveru",
      status: { new: "Nepřipojený", connected: "Připojený", disconnected: "Odpojený", error: "Chyba" },
      connectedBy: (by, date) => `Připojil ${by} (${date}).`,
      connect: "Připojit",
      reconnect: "Připojit znovu",
      disconnect: "Odpojit",
      remove: "Odstranit",
      removeConfirm: "Odstranit konektor? Kanály, které se na něj odkazují, přijdou o jeho rozsahy.",
      secRetrieval: "Živý zdroj",
      secRetrievalNote: "Při dotazu se vedle knihovny zavolá i server. Výsledek obešel kurátora, proto je v citaci označen jako neověřený.",
      retrievalOn: "Používat jako živý zdroj",
      defaultOn: "Používat výchozím způsobem při dotazu",
      defaultOnNote: "Vypnuto: na portálu se výchozím způsobem hledá jen v knihovně a tento zdroj si člověk zapne pilulkou pod dotazem. Kanálů se to netýká — tam rozsah vybírá správce kanálu.",
      ingestOn: "Povolit import do knihovny",
      ingestNote: "Kurátor může články ze serveru uložit jako koncepty dokumentů (Knihovna → Nahrát → Import ze serveru).",
      accessLevel: "Přístupová úroveň",
      accessInternal: "Interní — jen přihlášení na portálu",
      accessPublic: "Veřejná — i widget a návrhy odpovědí na tickety",
      accessHint: "Server dává účtu vše a veřejné od interního nerozliší — úroveň je vlastnost konektoru. Interní konektor se do e-mailů nedostane.",
      secScopes: "Rozsahy",
      secScopesNote: "Pojmenované výseky serveru, které si vybírají kanály. Filtr posílá server před hledáním.",
      scopesField: "Rozsahy",
      scopesHint: fields => `Jeden rozsah na řádek: klíč | název | ${fields}. Například: issf | ISSF | project=issf`,
      secReduction: "Redukce",
      secReductionNote: "Zúžení pro interní čtenáře, ne brána pro veřejnost. Vše deterministické; prázdná pole nic neřežou.",
      dropSections: "Zahodit sekce",
      dropSectionsHint: "Nadpisy sekcí, jeden na řádek (např. Key files, Data).",
      scrubPatterns: "Vzory v textu",
      scrubPatternsHint: "Regulární výrazy, jeden na řádek; shody se nahradí […] (např. T_[A-Z_]+).",
      skipPaths: "Vynechat cesty",
      skipPathsHint: "Regulární výrazy nad cestou článku na serveru, jeden na řádek (např. -rules-).",
      tools: "Nástroje serveru",
      toolsNone: "Seznam nástrojů se načte při připojení.",
      save: "Uložit",
      saved: "Konektor je uložen.",
      created: "Konektor je založen — nyní ho připojte.",
      removed: "Konektor je odstraněn.",
      connected: "Konektor je připojen.",
      disconnected: "Konektor je odpojen.",
      lastError: "Poslední chyba",
      personalAccountNote: "Připojení běží pod účtem toho, kdo ho připojil — server vidí to, co ten účet. Až server nabídne servisní přístup, připojí se jím (ADR-029).",
    },
    ai: {
      intro: "Asistent, úprava dotazů a přepis skenů používají model Claude od společnosti Anthropic. Zde nastavíte, přes jaký klíč se platí a které modely se použijí.",
      secProvider: "Poskytovatel",
      provider: "Anthropic (Claude)",
      providerNote: "Zatím jediný podporovaný poskytovatel.",
      secKey: "API klíč",
      secKeyNote: "S vlastním klíčem platí volání organizace přímo společnosti Anthropic. Bez něj se použije klíč provozovatele portálu.",
      keyLabel: "Nový klíč",
      keyHint: "Při uložení se ověří. Uložený klíč se už nikdy neukáže, jen jeho koncovka. Prázdné pole klíč nemění.",
      keyOwn: (hint, date, by) => `Nastaven je klíč organizace …${hint} (${date}, ${by}).`,
      keyOperator: "Organizace nemá vlastní klíč — používá se klíč provozovatele portálu.",
      keyNone: "Není nastaven žádný klíč — asistent ani přepis skenů nefungují.",
      deleteKey: "Odstranit klíč",
      deleteKeyNote: "Volání pak půjdou přes klíč provozovatele portálu.",
      secModels: "Modely",
      secModelsNote: "Který model se použije na kterou úlohu. Cena je za milion tokenů podle ceníku Anthropic. Změna platí od dalšího volání.",
      answer: "Odpovědi asistenta",
      answerNote: "Silnější model odpovídá přesněji, ale pomaleji a dráž. Sonnet 5.5 a Opus 5.5 před odpovědí přemýšlejí — první slovo přijde později.",
      utility: "Úprava dotazu",
      utilityNote: "Běží před vyhledáváním a čeká se na ni, proto jen nejrychlejší model.",
      rewrite: "Přepis skenů PDF",
      rewriteNote: "Přepisuje skenované předpisy v knihovně do textu.",
      price: (input, output) => `vstup ${input} $ · výstup ${output} $`,
      save: "Uložit",
      saved: "Nastavení AI je uloženo.",
      keyDeleted: "Klíč organizace je odstraněn.",
    },
    aiUsage: {
      tabSettings: "Nastavení",
      tabUsage: "Spotřeba",
      from: "Od",
      to: "Do",
      person: "Osoba",
      purpose: "Účel",
      all: "všechny",
      apply: "Použít",
      exportCsv: "Export CSV",
      exportXlsx: "Export Excel",
      calls: "Volání",
      tokensIn: "Vstup",
      tokensOut: "Výstup",
      tokensCache: "Cache",
      total: "Částka",
      colWhen: "Datum",
      colPerson: "Osoba",
      colWhat: "Na co a proč",
      colModel: "Model",
      colTokens: "Tokeny",
      colSum: "Částka",
      keyTenant: "klíč organizace",
      keyOperator: "klíč provozovatele",
      failed: "selhalo",
      empty: "V tomto období se AI nevolala",
      emptyText: "Zkuste jiné období. Volání se zapisují od 5. 10. 2026.",
      capped: (shown, all) => `Zobrazeno je ${shown} nejnovějších z ${all}. Celé období je v exportu.`,
      note: "Částka je odhad podle ceníku Anthropic v den volání, v dolarech; přesnou částku řekne faktura. Znění dotazů se neukládá. Záznamy se drží 25 měsíců.",
      purposes: {
        "answer": { label: "Odpověď asistenta", why: "odpověď na dotaz s citacemi z předpisů" },
        "query-rewrite": { label: "Úprava dotazu", why: "přeformulování před vyhledáváním, aby se našly správné články" },
        "query-classify": { label: "Výběr způsobu hledání", why: "rozhodnutí mezi hledáním podle slov a podle významu" },
        "pdf-rewrite": { label: "Přepis skenu PDF", why: "sken bez textové vrstvy se přepisuje do textu předpisu" },
        "markdown-clean": { label: "Úprava členění textu", why: "obnovení nadpisů a článků v převedeném textu" },
        "chunking-analysis": { label: "Analýza členění", why: "návrh, jak dokument rozřezat na úseky pro vyhledávání" },
        "faq-mining": { label: "Těžba FAQ", why: "návrhy záznamů FAQ z historie schránky helpdesku (ADR-028)" },
      },
    },
    branding: {
      name: "Název portálu",
      nameNote: "Jak se portál jmenuje — je v hlavičce, v e-mailech a na přihlašovací obrazovce (například „Intranet SFZ“).",
      shortName: "Zkratka",
      shortNameNote: "Do horní lišty, kde je vedle ní ještě menu — „SFZ“ tam řekne totéž co celý název a nechá místo na zbytek.",
      logo: "Logo",
      logoCurrent: "současné logo",
      logoEmpty: "logo 512×512",
      logoNote: "PNG, JPEG nebo WebP, nejvýše 256 kB. Prázdné = neměnit. V hlavičce má logo 26 px — větší soubor nic nepřidá.",
      logoRemove: "Odstranit logo",
      logoRemoveNote: "Smaže obrázek i odkaz na něj. V hlavičce zůstane samotný název organizace. Dá se vrátit nahráním nového loga.",
      color: "Barva",
      colorNote: "Nese ji tlačítko s bílým textem, proto jsou odstíny tmavší, než by se chtělo — světlejší tón znamená nečitelné tlačítko.",
      supportEmail: "Kontaktní adresa",
      supportEmailNote: "Kam se má obrátit člověk, kterému něco nesedí.",
      phonePrefix: "Výchozí země telefonu",
      phonePrefixNote: "Nabídne se u telefonu osoby a její předvolba se doplní k číslům z importu zadaným s nulou (0905 123 456). Není to telefon organizace.",
      controller: "Správce osobních údajů",
      controllerNote: "Zobrazuje se v informacích o ochraně osobních údajů (stránka Ochrana osobních údajů). Prázdný právní název = použije se název portálu.",
      controllerLegalName: "Právní název",
      controllerAddress: "Sídlo",
      controllerRegistrationNumber: "IČO",
      controllerCountry: "Země sídla",
      countries: { SK: "Slovensko", CZ: "Česko" },
      secIdentity: "Název portálu",
      secIdentityNote: "Název a logo v hlavičce, v e-mailech a na přihlašovací obrazovce. Pod nimi organizace, která portál provozuje a zpracovává osobní údaje.",
      secContact: "Kontakt",
      secGdpr: "GDPR",
      secGdprNote: "Kontakt pro ochranu osobních údajů na stránce Ochrana osobních údajů. Sem lidé pošlou námitku nebo žádost e-mailem. Prázdné = zobrazí se osoby s rolí DPO.",
      gdprName: "Jméno a příjmení",
      gdprEmail: "E-mailová adresa",
      gdprEmailNote: "Společná schránka (např. gdpr@…), ne osobní adresa — zůstane, i když se DPO změní.",
      secAutoProvision: "Automatické založení",
      saveBarNote: "Jedno uložení pro celou stránku.",
      controllerPreview: "Na stránce Ochrana osobních údajů:",
      invitePreview: "V pozvánce:",
      languages: "Jazyky",
      defaultLanguage: "Výchozí jazyk",
      defaultLanguageNote: "Platí pro člověka, který ještě není přihlášený.",
      autoProvision: "Domény pro automatické založení",
      autoProvisionBefore: "Jedna na řádek. Kdo se přihlásí ",
      autoProvisionHighlight: "pracovním účtem",
      autoProvisionAfter: " z této domény a v seznamu osob ještě není, založí se sám jako běžný člen — bez rolí a bez tras. Platí jen pro účty, ne pro odkaz v e-mailu.",
      autoProvisionNotHosts: "Jsou to e-mailové domény pracovních účtů (jmeno@futbalsfz.sk), ne webové adresy portálu — ty jsou v záložce Domény.",
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
      requestOpen: "Požádat o doménu",
      cancel: "Zrušit",
      pendingHeading: n => `Čekají na ověření · ${n}`,
      pendingNote: "Ověření lze spustit, když je záznam DNS nastavený. Změna DNS se může projevit až po několika hodinách.",
      removeOpen: "Odstranit…",
      removeConfirm: h => `Odstranit doménu ${h}? Lidé, kteří na portál chodí přes tuto adresu, se na něj nedostanou.`,
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
      removeOwnTitle: p => `Odstranit vlastní přihlášení přes ${p}`,
      removeOwnNote: "Přihlášení se vrátí na nastavení od dodavatele, pokud ho má; jinak tlačítko z přihlašovací obrazovky zmizí.",
      removeOpen: "Odstranit…",
      cancel: "Zrušit",
    },
    codelists: {
      show: "Zobrazit",
      pick: "Číselník",
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
        workplace: {
          name: "Pracoviště",
          hint: "Města a obce, kde lidé standardně vykonávají práci — vybírá se z nich na kartě osoby.",
        },
      },
      base: " · základní",
      used: (n) => ` · použita ${n}×`,
      remove: "Odebrat",
      newItemPlaceholder: "Metodický pokyn",
      newItemLabel: (codelist) => `Název nové položky — ${codelist}`,
      key: "Klíč",
      keyPlaceholder: "metodicky_pokyn",
      keyTakenHint: "Takový klíč už v číselníku je — změň název nebo klíč.",
      add: "Přidat",
      keyNote: "Klíč: malá písmena bez diakritiky, číslice a podtržítko. Zůstává v obsahu natrvalo, takže se nedá vzít zpět — název vedle něj se měnit dá.",
      examples: {
        category: { label: "např. Rozhodnutí", key: "rozhodnuti" },
        tags: { label: "např. mládež", key: "mladez" },
        workplace: { label: "např. Brno", key: "brno" },
      },
      moreBase: n => `+ dalších ${n} základních`,
      colName: "Název",
      colKey: "Klíč",
      colUse: "Použití",
      baseBadge: "základní",
    },
    acknowledgements: {
      heading: "Potvrzování",
      intro: "Termín potvrzení se nastavuje u každého přidělení a na každé trase. Tady je jen práh pro personalistu: po kolika dnech bez potvrzení je člověk v Připomínkách a v týdenním souhrnu mezi opožděnými.",
      overdueDays: "Opožděný po (dnech)",
      overdueDaysNote: "Počítá se od vzniku povinnosti — přidělení, příchodu do oddělení nebo přidání na trasu. Lidem samotným se podle toho nic neposílá. Výchozí je 14.",
      save: "Uložit",
    },
    actions: {
      saved: "Změny byly uloženy.",
      failed: "Změnu se nepodařilo uložit. Zkus to znovu.",
      confirmCode: (code) => `Pro odstranění napiš kód organizace (${code}).`,
      signInRemoved: "Přihlašovací údaje odstraněny.",
      logoRemoved: "Logo odstraněno.",
      domainRequested: "Zapsáno. Teď nastavte CNAME u svého správce DNS a dejte ověřit.",
      domainNotFound: "Takovou žádost tu nemáme.",
      domainWaiting: (host) =>
        `${host} zatím nesměruje na nás. Změna DNS bývá viditelná do hodiny;` +
        " pokud je to déle, zkontrolujte CNAME.",
      domainOnNotInVercel: (host) => `${host} je zapnutá, ale do Vercelu se nepřidala — ozvěte se nám.`,
      domainOn: (host) => `${host} je zapnutá. Portál na ní odpovídá.`,
      domainRemoved: "Doména odstraněna. Portál na ní přestal odpovídat.",
      codelistRemoved: "Odebráno z nabídky. Dokumenty, které tuto hodnotu mají, si ji nesou dál.",
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
      internal: "interní (funkcionář, komise…)",
      employee: "zaměstnanec",
      external: "externí — jen přes cizí systém, bez přístupu do intranetu",
    },
    genders: { male: "muž", female: "žena", none: "nevyplněno" },
    languages: {
      sk: "slovenština",
      cs: "čeština",
      en: "angličtina",
    },
    roles: {
      hr: "hr — přiděluje normy a vidí, kdo je nepotvrdil",
      "people-admin": "people-admin — spravuje osoby (tato obrazovka)",
      "content-admin": "content-admin — nahrává a upravuje normy v knihovně",
      evaluator: "evaluator — posuzuje odpovědi systému, když někdo řekne, že nesedí",
      dpo: "dpo — pověřenec: kontroluje právní základy, rozhoduje o námitkách",
      "learning-admin": "learning-admin — lektor: spravuje kurzy, banku otázek a testy",
      helpdesk: "helpdesk — řešitel: odpovídá na tickety svých kanálů a navrhuje záznamy do FAQ",
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
      emptyTitle: "Zatím žádné osoby",
      emptyText: "První přidáte tlačítkem výše, nebo naráz importem z CSV.",
      emptyFilterTitle: "Filtru nic nevyhovuje",
      emptyFilterText: "Zkuste část jména nebo e-mailu.",
      clearFilter: "Zrušit filtr",
      count: (n) => `${n} ${n === 1 ? "osoba" : n < 5 ? "osoby" : "osob"}`,
      matchesSearch: " vyhovuje hledání",
      capped: " — zobrazeno prvních 500, zužte hledání",
      status: {
        new: "nová",
        invited: "pozvaná",
        active: "aktivní",
        inactive: "vyřazená",
      },
      neverSignedIn: "nepřihlášená",
    },
    inviteAll: {
      heading: "Hromadné pozvánky",
      intro: "Lidé, kteří se ještě ani jednou nepřihlásili. E-mail nese odkaz na portál, ne přihlašovací odkaz — ten platí jen krátce a poštovní brány ho spotřebují dřív, než se k němu člověk dostane.",
      emptyTitle: "Všichni jsou pozvaní",
      none: "Nikdo nečeká na pozvánku — všichni se už aspoň jednou přihlásili.",
      preview: "Toto půjde na uvedené adresy. Odeslaný e-mail se odvolat nedá.",
      send: people => people === 1 ? "Odeslat 1 pozvánku" : people >= 2 && people <= 4 ? `Odeslat ${people} pozvánky` : `Odeslat ${people} pozvánek`,
      sent: n => `Odesláno: ${n}.`,
      nobody: "Není koho zvát.",
      open: "Hromadné pozvánky",
    },
    invite: {
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
      gender: "Pohlaví",
      genderNote: "Pro statistiky složení a pro gramatiku textů (např. „absolvoval / absolvovala“ na certifikátu). Ze jména se nehádá.",
      submit: "Pozvat",
    },
    import: {
      heading: "Import z CSV",
      introBefore: "Nejdřív uvidíš, ",
      introHighlight: "co by se stalo",
      introMiddle: ", a zapíše se až potom. Nahrání stovky lidí naslepo je přesně ta operace, po které se hledá, jak to vrátit zpět — a vrátit se nedá. Všichni se zapíšou do organizace ",
      introAfter: ", i když je v souboru něco jiného.",
      existingTitle: "Kdo už v systému je, se nezaloží znovu",
      existingNote: "Spáruje se podle e-mailu a doplní se mu jen prázdná pole. Co už má, zůstává — i když soubor nese jinou hodnotu. Stav, jazyk, role ani skupiny se nemění. Import nikoho nevyřadí.",
      overwriteLabel: "Aktualizovat existující hodnotami ze souboru",
      overwriteNote: "Sloupec, který soubor má, přepíše hodnotu existující osobě — a prázdná buňka ji vymaže: prázdné „skupiny“ znamenají, že ten člověk do žádné nepatří. Co v souboru není, zůstává nedotčené.",
      file: "Soubor CSV",
      fileNoteBefore: "První řádek jsou hlavičky. Rozpoznají se ",
      fileNoteAfter: " — i bez diakritiky a se středníkem jako oddělovačem, tak jak to ukládá Excel.",
      reading: "Čtu…",
      whatHappens: (name) => `Co se stane — ${name}`,
      rows: "Řádků",
      willAdd: "Přibude",
      willUpdate: (overwrite) => overwrite ? "Existuje — aktualizuje se" : "Existuje — doplní se",
      invalid: "Chybných",
      unchanged: "Beze změny",
      statuses: { new: "Nová", fill: "Doplní se", overwrite: "Změní se", unchanged: "Beze změny", error: "Chyba" },
      fields: {
        fullName: "jméno a příjmení", givenName: "jméno", surname: "příjmení", titleBefore: "titul před jménem", titleAfter: "titul za jménem",
        jobTitle: "pozice", mobilePhone: "mobil", workplace: "pracoviště", department: "oddělení", personType: "typ osoby",
        startDate: "nástup", tracks: "trasy", groups: "skupiny", roles: "role", language: "jazyk", gender: "pohlaví",
      },
      colStatus: "Stav",
      colPerson: "Osoba",
      colChanges: "Co se zapíše",
      filterAll: "Vše",
      noRowsForFilter: "Tomuto filtru nevyhovuje žádný řádek.",
      searchPlaceholder: "Hledat ve jménu nebo adrese",
      nothingToWrite: "nic — vše už má",
      emptyValue: "—",
      unknownWorkplaces: "Pracoviště, která v číselníku nejsou — tyto řádky projdou, jen bez pracoviště:",
      unknownTracks: "Trasy, které v organizaci nejsou (sloupec trasy čeká název trasy) — tyto řádky projdou, jen bez nich:",
      badPhones: "Čísla, která se nedala přečíst — tyto řádky projdou, jen bez telefonu:",
      statusNoteBefore: "Existujícím osobám se ",
      statusNoteHighlight: "nemění stav",
      statusNoteAfter: " — kdo se už přihlásil, zůstává přihlášený. Sloupec, který v souboru není, se nepřepíše: jazyk, skupiny, trasy ani role se neztratí.",
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
      previously: (list) => `dříve ${list}`,
      invitedNotSignedIn: "pozvaná, ještě se nepřihlásila",
      newNotInvited: "nová — pozvánka jí ještě neodešla",
      inviteNoteSent: (date) => `Pozvánka odešla ${date}.`,
      excludedNoSignIn: "vyřazená — nepřihlásí se",
      lastSeen: (when) => `naposledy ${when}`,
      never: "—",
      signsInVia: (list) => `přihlašuje se přes ${list}`,
      email: "E-mailová adresa",
      emailNote: "Změnit se dá — identita člověka na ní nestojí. Potvrzení se vážou na jeho záznam, ne na adresu, takže historie zůstává celá a stará adresa se uloží do jeho historie. Změní se tím to, kam chodí přihlašovací odkaz; přihlášení pracovním účtem funguje dál.",
      fullName: "Jméno",
      givenName: "Jméno",
      surname: "Příjmení",
      nameNote: "Ze jména a příjmení se skládá celé jméno. Právě to se zapíše do potvrzení, které člověk podepíše — proto do něj tituly nevstupují.",
      nameMissing: "Jméno a příjmení tu ještě nejsou rozdělené. Doplňte je — celé jméno se pak poskládá z nich.",
      titleBefore: "Titul před jménem",
      titleAfter: "Titul za jménem",
      titlesNote: "Evidenční údaje. V potvrzeních a v auditu záměrně nejsou: titul přibude během života a tentýž člověk by pak ve starých záznamech vystupoval pod jiným jménem.",
      jobTitle: "Pozice",
      jobTitleNote: "Evidenční údaj. Doplňuje se z pracovního účtu, když ho tam adresář má — ale jen když je tu prázdný, takže ruční oprava vydrží.",
      mobilePhone: "Mobilní telefon",
      mobilePhoneCountry: "Země telefonu",
      mobilePhoneNote: "Vidí ho každý přihlášený v organizaci. Vyberte zemi a číslo napište tak, jak se v ní píše (777 123 456); uloží se mezinárodně.",
      workplace: "Pracoviště",
      workplaceNone: "— bez pracoviště —",
      workplaceNote: "Město nebo obec, kde člověk standardně vykonává práci. Vybírá se ze seznamu, aby se podle něj dalo filtrovat.",
      noWorkplacesBefore: "Seznam pracovišť je zatím prázdný — ",
      noWorkplacesLink: "doplňte je v číselnících",
      noWorkplacesAfter: ".",
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
      personTypeNote: "Kdo člověk je vůči organizaci. Druh „externí“ se do intranetu nepřihlásí (ADR-028); o přístupu k obsahu rozhoduje organizace a úroveň dokumentu. Rozhodčí a funkcionáři jsou skupiny, ne druh.",
      language: "Jazyk prostředí",
      languageNote: "V čem se s člověkem bavíme. Ne jazyk dokumentů, které čte.",
      gender: "Pohlaví",
      genderNote: "Pro statistiky složení a pro gramatiku textů (např. „absolvoval / absolvovala“ na certifikátu). Ze jména se nehádá.",
      groups: "Skupiny",
      newGroup: "nová skupina, např. rozhodčí",
      groupsNote: "Podle nich se přidělují normy. Číslo je počet lidí, kteří skupinu mají — skupina, kterou nemá nikdo, nedostane nic.",
      tracks: "Trasy",
      noTracks: "Zatím není žádná trasa. Zakládají se v Přidělené dokumenty → Trasy.",
      trackInactive: "vypnutá",
      trackUnknown: "neznámá trasa (zrušte zaškrtnutí, pokud ji osoba nemá mít)",
      roles: "Role",
      rolesNote: "Správce platformy se odsud přidělit nedá — patří tenantovi dodavatele a má vlastní cestu.",
      save: "Uložit",
      evidenceEmptyTitle: "Žádné přidělené dokumenty",
      evidenceEmptyText: "Této osobě zatím nikdo nepřidělil předpis k potvrzení.",
      accessSummary: "Přístup a členství",
      returnHeading: "Vrátit osobu",
      excludeHeading: "Vyřadit osobu",
      inviteHeading: "Pozvánka",
      inviteNote: "Tato osoba se ještě ani jednou nepřihlásila. Pozvánka nese odkaz na portál — přihlásí se jím přes pracovní účet nebo si vyžádá odkaz na e-mail.",
      inviteNoteSince: (date) => `Zapsaná ${date}.`,
      inviteSubmit: "Poslat pozvánku znovu",
      inviteSubmitFirst: "Poslat pozvánku",
      returnNoteBefore: "Vrátí se jako ",
      returnNoteHighlight: "pozvaná",
      returnNoteAfter: ", ne aktivní — aktivní znamená „už se přihlásila“ a to se vrácením nestalo. Přepne ji první přihlášení.",
      returnSubmit: "Vrátit",
      excludeNote: "Po vyřazení se nepřihlásí — okamžitě. Záznam a její potvrzení zůstávají jako doklad o tom, co si přečetla; smažou se 3 roky po skončení vztahu se svazem (ADR-012).",
      confirmLabel: "Napiš adresu pro potvrzení",
      confirmNote: "Záměrně to není „opravdu?“ — to se odklikne dřív, než se přečte.",
      excludeSubmit: "Vyřadit",
      endedAtLabel: "Vztah se svazem skončil (nepovinné)",
      endedAtNote: "Konec pracovního poměru, licence, funkce nebo spolupráce. Od tohoto data běží 3letá lhůta uchování potvrzení; když ho nevyplníš, běží ode dne vyřazení.",
      endedAtHeading: "Skončení vztahu",
      deactivatedOn: (date) => `Vyřazená ${date}.`,
      endedAtCurrent: (date) => `Vztah skončil ${date}.`,
      endedAtMissing: "Datum skončení není vyplněné — lhůta běží ode dne vyřazení.",
      endedAtSubmit: "Uložit datum",
      tlDeactivate: "Vyřazení",
      tlDeactivateSub: "dnes · nepřihlásí se",
      tlEnded: "Vztah skončil",
      tlEndedSub: "datum níže · nevyplněné → od vyřazení",
      tlRetention: n => `+ ${n} roky`,
      tlRetentionSub: "potvrzení se smažou",
      factDeactivated: "Vyřazena",
      factEnded: "Vztah skončil",
      factDeleteFrom: "Potvrzení se smažou od",
    },
    actions: {
      saved: "Uloženo.",
      invited: "Pozvaná — pozvánka jí odešla na e-mail.",
      invitedNoEmail: "Osoba je zapsaná, ale pozvánka jí neodešla. Zkus ji poslat znovu z její karty.",
      inviteResent: (email) => `Pozvánka odeslána na ${email}.`,
      inviteFailed: "Pozvánku se nepodařilo odeslat. Zkus to za chvíli znovu.",
      inviteNotNeeded: "Tato osoba už byla přihlášená — pozvánku nepotřebuje.",
      excluded: "Vyřazená. Záznam a její potvrzení zůstávají.",
      returned: "Vrácená. Přihlásí se a stav se přepne sám.",
      endedAtSaved: "Datum skončení uloženo.",
      confirmAddress: (email) => `Pro vyřazení napiš adresu (${email}).`,
      failed: "Změnu se nepodařilo uložit. Zkus to znovu.",
      noRight: "Nemáš na to právo.",
      fileEmpty: "Soubor je prázdný.",
      noRows: "V souboru není ani jeden řádek s údaji. Má první řádek hlavičky?",
      importResult: (created, updated, unchanged, invalid, overwrite) =>
        `Přibylo ${created}, ${overwrite ? "změněných" : "doplněných"} ${updated}, beze změny ${unchanged}` +
        (invalid ? `, chybných ${invalid}` : "") + ".",
    },
    search: {
      placeholder: "Hledat jméno, e-mail nebo oddělení",
      label: list => `Hledat v seznamu: ${list}`,
      count: (shown, total) => `${shown} z ${total}`,
      picked: n => `Vybraní (${n})`,
      pickedOne: "Vybraná",
      none: query => `Nikdo neodpovídá „${query}“.`,
      noneApprovers: "Vyřazení se nenabízejí a sám sebe schválit nemůžeš.",
      noneResponsible: "Vyřazení se nenabízejí.",
      clear: "Zrušit hledání",
      clearInput: "Vymazat",
      remove: name => `Odebrat ${name}`,
      keysDown: "do seznamu",
      keysEnter: "vybere jediný výsledek",
      keysEnterOne: name => `vybere ${name}`,
      keysEsc: "vymaže",
    },
  },
  report: {
    open: "Nahlásit nepřesnost",
    whatIsWrong: "Co je na odpovědi špatně?",
    placeholder: "Například: odvolává se na zrušený článek; vynechala výjimku v odst. 3; našla jiný předpis.",
    note: "Uloží se i tvoje otázka, odpověď a zdroje, které systém použil — bez nich nelze rozlišit, jestli našel špatný předpis, nebo správný a špatně ho přečetl.",
    submit: "Odeslat hlášení",
    sending: "Odesílám…",
    thanks: "Děkujeme. Hlášení jsme zapsali i s otázkou a zdroji.",
    failed: "Hlášení se nepodařilo odeslat. Zkus to prosím znovu.",
  },
  notifications: {
    title: "Upozornění",
    bellLabel: (unread) => unread > 0 ? `Upozornění — ${unreadWord(unread, "cs")}` : "Upozornění",
    unread: (n) => unreadWord(n, "cs"),
    emptyTitle: "Žádná upozornění",
    emptyText: "Objeví se tu, když se zveřejní znění, rozešlou připomínky nebo doběhne přeindexování.",
    markAllRead: "Označit vše jako přečtené",
    allRead: (n) => `Označeno jako přečtené: ${n}.`,
    retentionNote: (days) => `Upozornění se po ${days} dnech mažou.`,
    kinds: {
      reindexed: (title, chunks) =>
        `Dokument „${title}" je přeindexovaný — ${chunks} ${chunks === 1 ? "úsek" : chunks < 5 ? "úseky" : "úseků"}.`,
      rewritten: (title) => `Přepis dokumentu „${title}" modelem doběhl. Text si přečti, než ho přijmeš.`,
      remindersSent: (count) =>
        `Rozeslané připomínky: ${count} ${count === 1 ? "zpráva" : count < 5 ? "zprávy" : "zpráv"}.`,
      versionPublished: (title, label) => `Zveřejněné znění „${label}" dokumentu „${title}".`,
      responsibleAssigned: (title, label) => `Jste odpovědná osoba za znění „${label}" dokumentu „${title}". Určete právní základ.`,
      draftResponsibleAssigned: (title) => `Jste odpovědná osoba za připravované znění dokumentu „${title}". Právní základ můžete určit ještě před zveřejněním.`,
      objectionSubmitted: () => "Nová námitka (čl. 21) čeká na vaše rozhodnutí.",
    },
  },
  responsibility: {
    responsiblePerson: "Odpovědná osoba",
    responsibleNote: "Na ni se budou obracet lidé, kteří znění potvrzují, a ona určí právní základ. U každého nového znění se určuje znovu — z předchozího se nepřebírá.",
    choosePerson: "— vyber osobu —",
    noResponsible: "Znění nemá určenou odpovědnou osobu.",
    inactiveResponsible: "Odpovědná osoba už není aktivní — je třeba určit novou.",
    setResponsible: "Určit odpovědnou osobu",
    changeResponsible: "Změnit odpovědnou osobu",
    changeReason: "Důvod změny",
    changeReasonPlaceholder: "Například: původní odpovědná osoba odešla ze svazu",
    saveResponsible: "Uložit odpovědnou osobu",
    responsibleHistory: n => (n === 1 ? "1 změna odpovědné osoby" : n >= 2 && n <= 4 ? `${n} změny odpovědné osoby` : `${n} změn odpovědné osoby`),
    responsibleChangeLine: (by, date, from, to) => `${by} · ${date} · ${from} → ${to}`,
    responsibleSaved: "Odpovědná osoba byla uložena.",
    legalBasis: "Právní základ",
    basisLabel: {
      legal_obligation: "Plnění zákonné povinnosti",
      legitimate_interest: "Oprávněný zájem",
    },
    basisHint: {
      legal_obligation: "Povinnost seznámit se vyplývá ze zákona — například předpisy BOZP.",
      legitimate_interest: "Interní směrnice bez výslovné zákonné opory.",
    },
    basisUnset: "neurčený",
    basisMissing: "Právní základ zatím není určen.",
    reference: "Odkaz na předpis",
    referencePlaceholder: "Například § 7 odst. 3 zákona č. 124/2006 Z. z.",
    referenceNote: "U zákonné povinnosti povinný.",
    basisReason: "Důvod změny",
    basisReasonNote: "Povinný při změně již určeného základu — potvrzení, která mezitím vznikla, si nesou původní.",
    saveBasis: "Uložit právní základ",
    basisWho: "Právní základ určuje odpovědná osoba znění nebo správce obsahu.",
    basisHistory: n => (n === 1 ? "1 změna právního základu" : n >= 2 && n <= 4 ? `${n} změny právního základu` : `${n} změn právního základu`),
    basisChangeLine: (by, date, from, to) => `${by} · ${date} · ${from} → ${to}`,
    basisInPreparation: "určeno v přípravě",
    basisSaved: "Právní základ byl uložen.",
    contactHeading: "S dotazy k předpisu se obraťte na",
    contactProfile: "profil v adresáři",
    contactGone: "Odpovědná osoba už není aktivní. S dotazy se zatím obraťte na personální oddělení.",
    yourTaskHeading: "Jste odpovědná osoba za toto znění",
    yourTaskNote: "Určete, na jakém právním základě se zpracovávají záznamy o seznámení s tímto zněním.",
    draftTaskHeading: "Připravované znění — jste odpovědná osoba",
    draftTaskNote: "Znění ještě není zveřejněno. Právní základ můžete určit už teď a při zveřejnění se přenese do znění. Dokud se nezveřejní, lze jej změnit bez udání důvodu.",
    draftBasisSummary: "Právní základ připravovaného znění",
    draftEffective: (date) => `Účinnost od ${date}`,
    draftNewTitle: (title) => `Nový název: „${title}"`,
    draftText: "Text připravovaného znění",
    draftOpenPdf: "PDF nového znění",
    draftBasisSaved: "Právní základ připravovaného znění byl uložen. Při zveřejnění se přenese do znění.",
    pendingTaskHeading: (date) => `Znění účinné od ${date} — jste odpovědná osoba`,
    pendingTaskNote: "Znění je zveřejněno, ale ještě není účinné. Určete právní základ, ať jej znění má od prvního dne účinnosti.",
    pendingBasisSummary: (date) => `Právní základ znění účinného od ${date}`,
    basisPageLead: "Jste odpovědná osoba za znění tohoto předpisu. Zde určíte právní základ, na kterém se zpracovávají záznamy o seznámení.",
    basisPageRead: "Otevřít předpis ke čtení",
    missingBasisTag: "bez právního základu",
    missingBasisNote: "Předpis bez právního základu se přidělit dá. Odpovědná osoba by jej však měla určit ještě před ostrým provozem.",
    missingOptionNote: "Chybí vhodná položka? Požádejte správce organizace, aby ji doplnil do číselníku právních základů.",
    multipleNote: "Vyberte jeden nebo více — i z obou skupin. Když je mezi nimi zákonná povinnost, záznam o potvrzení se na námitku nemaže.",
    outsideCodelist: "mimo číselník",
    orgHeading: "Právní základy",
    orgHint: "Z tohoto seznamu vybírá odpovědná osoba právní základ u každého znění předpisu. Standardní položky lze skrýt, vlastní vyřadit — nic se nemaže, znění si nesou kopii.",
    standardTag: "standardní",
    customTag: "vlastní",
    hiddenTag: "skrytá",
    retiredTag: "vyřazená",
    hide: "Skrýt",
    unhide: "Vrátit",
    retire: "Vyřadit",
    addHeading: "Přidat právní základ",
    labelField: "Název",
    labelPlaceholder: "Například: Dopingová kontrola",
    keyField: "Klíč",
    keyPlaceholder: "např. doping",
    categoryField: "Kategorie",
    referenceField: "Odkaz na předpis",
    addButton: "Přidat",
    usedIn: n => (n === 1 ? "1 znění" : `${n} znění`),
  },
  helpdesk: {
    heading: "Helpdesk",
    intro: "Tickety kanálů, kterých jsi řešitelem. Návrh odpovědi připraví asistent z norem a FAQ kanálu; odešleš ho ty, nikdy ne systém sám.",
    noChannels: "Nejsi řešitelem žádného kanálu. Správce organizace tě přidá mezi řešitele v Kanálech.",
    viewOpen: "Otevřené",
    viewSent: "Zodpovězené",
    viewClosed: "Zavřené",
    viewAll: "Všechny",
    empty: "Žádné tickety.",
    colSubject: "Předmět",
    colAsker: "Ptá se",
    colChannel: "Kanál",
    colState: "Stav",
    colUpdated: "Změněno",
    colMessages: "Zpráv",
    state: { new: "nový", drafted: "s návrhem", sent: "zodpovězený", closed: "zavřený", reopened: "znovu otevřený" },
    source: { chat: "chat", email: "e-mail" },
    mine: "moje",
    unassigned: "nikdo",
    assignedTo: (name: string) => `řeší ${name}`,
    take: "Převzít",
    release: "Uvolnit",
    thread: "Vlákno",
    quotedHistory: "Předchozí korespondence v e-mailu",
    threadSummary: (n: number, lastFrom: string, lastAt: string) => `${n} ${n < 5 ? "zprávy" : "zpráv"} · poslední: ${lastFrom}, ${lastAt}`,
    threadImport: "Dotáhnout historii vlákna",
    threadImportHint: "Načte ze schránky dřívější zprávy tohoto vlákna — přijaté i odeslané, i z doby před spuštěním synchronizace.",
    msgThreadImported: (n: number) => n ? `Doplněné zprávy z vlákna: ${n}.` : "Vlákno je úplné — ve schránce nejsou další zprávy.",
    fromHelpdesk: "Helpdesk",
    fromAsker: (name: string) => name || "Tazatel",
    attachments: (n: number) => (n === 1 ? "1 příloha (ve schránce)" : `${n} příloh (ve schránce)`),
    draftHeading: "Odpověď",
    draftIntro: "Asistent navrhne odpověď z norem a FAQ kanálu. Uprav ji a odešli — rozdíl mezi návrhem a odeslaným textem je to, z čeho se systém učí.",
    draftFromAi: "Navrhnout odpověď asistentem",
    draftMeta: (model: string, when: string) => `návrh ${model}, ${when}`,
    noDraft: "Zatím bez návrhu.",
    draftSources: "Zdroje návrhu",
    answer: "Text odpovědi",
    answerHint: "Odejde jako čistý text z adresy schránky kanálu. Nic se nepřidává.",
    saveDraft: "Uložit návrh",
    send: "Odeslat odpověď",
    sendHint: "Odešle e-mail tazateli a ticket označí jako zodpovězený.",
    sent: (by: string, when: string) => `odesláno ${when} (${by})`,
    sentUnchanged: "návrh odešel beze změny",
    sentEdited: "návrh byl před odesláním upraven",
    close: "Zavřít ticket",
    reopen: "Znovu otevřít",
    toFaq: "Přidat do FAQ",
    toFaqIntro: "Z odeslané odpovědi vznikne záznam v konceptu FAQ dokumentu. Před uložením odstraň jména a údaje konkrétní osoby; schválí to správce obsahu.",
    toFaqDocument: "FAQ dokument",
    toFaqSubmit: "Uložit do konceptu FAQ",
    toFaqDone: "Záznam je v konceptu FAQ.",
    noFaqDocuments: "V knihovně ještě není FAQ dokument.",
    noMailbox: "Kanál nemá schránku — odpověď se nedá odeslat e-mailem.",
    msgDrafted: "Návrh je připraven. Zkontroluj ho před odesláním.",
    msgDraftSaved: "Návrh je uložen.",
    msgSent: "Odpověď je odeslána.",
    msgTaken: "Ticket je tvůj.",
    msgReleased: "Ticket je uvolněn.",
    msgClosed: "Ticket je zavřen.",
    msgReopened: "Ticket je znovu otevřen.",
    aiFailed: "Asistent návrh nepřipravil — zkus to za chvíli nebo napiš odpověď sám.",
  },
  widget: {
    open: "Zeptat se",
    title: "Pomocník",
    placeholder: "Napiš otázku…",
    send: "Odeslat",
    thinking: "Hledám v předpisech…",
    sources: "Zdroje",
    helpful: "Pomohlo",
    notHelpful: "Nepomohlo",
    thanks: "Děkujeme.",
    tryAgain: "Zkus otázku položit jinak, nebo napiš helpdesku.",
    noAnswer: "V předpisech a častých otázkách jsem na to nenašel odpověď.",
    escalateIntro: "Asistent ti nepomohl. Napiš helpdesku — odpoví člověk e-mailem na tvou adresu.",
    escalateMessage: "Co potřebuješ vyřešit",
    escalateSubmit: "Odeslat helpdesku",
    escalated: "Zpráva je odeslána. Helpdesk odpoví e-mailem.",
    error: "Něco se pokazilo. Zkus to za chvíli.",
    expired: "Přihlášení vypršelo — obnov stránku.",
    poweredBy: "Contineo",
  },
  channels: {
    heading: "Kanály",
    kinds: { widget: "Widget", portal: "Portál" },
    kindHints: { widget: "Vložitelný do cizí stránky místo vyhledávání: asistent (otázka a odpověď), volitelně tickety a schránka helpdesku.", portal: "Články, knihovna a formuláře. Dnes existuje knihovna; články a formuláře připravujeme." },
    kind: "Typ kanálu",
    ticketsOn: "Tickety",
    ticketsHint: "Po dvou negativních hodnoceních může člověk napsat helpdesku; e-maily ze schránky se stávají tickety. Bez ticketů je kanál jen asistent.",
    portalNote: "Portál zatím nese jen rozsah obsahu a jazyky — knihovna je použije při veřejném čtení, články a formuláře připravujeme.",
    builtIn: "Vestavěné",
    builtInAssistant: "Asistent v intranetu — otázka a odpověď nad celou knihovnou pro přihlášené; nenastavuje se.",
    builtInPortal: "Knihovna v intranetu — platné dokumenty pro přihlášené; nenastavuje se.",
    tabsLabel: "Části kanálů",
    tabList: "Kanály",
    tabMyTickets: "Moje tickety",
    tabTickets: "Tickety",
    tabSettings: "Nastavení",
    agentsNote: "Řešitelé mají smysl, když jsou zapnuté tickety.",
    back: "Kanály",
    intro: "Kanál je jedno místo, kde se lidé ptají: má vlastní obsah (složky knihovny), schránku, řešitele a widget. Kanálů může být víc — každý pro jiný projekt a publikum.",
    list: "Kanály",
    empty: "Zatím žádný kanál.",
    newChannel: "Nový kanál",
    edit: "upravit",
    keyHint: "Klíč kanálu, přidělený při založení. Je v adrese skriptu widgetu a v claimu aud tokenu; nemění se.",
    name: "Název",
    audience: "Publikum",
    audienceHint: "Komu kanál slouží — klubové manažerky, rozhodčí, rodiče…",
    folders: "Obsah kanálu",
    foldersHint: "Složky knihovny, ze kterých asistent odpovídá. Bez výběru vidí celou knihovnu organizace.",
    connectorScopes: "Živé zdroje",
    connectorScopesHint: "Rozsahy připojených konektorů, ve kterých asistent hledá vedle knihovny. Bez výběru se živé zdroje v tomto kanálu nepoužijí.",
    connectorScopesNone: "Organizace nemá připojený žádný konektor se živým zdrojem.",
    assignees: "Řešitelé",
    assigneesHint: "Osoby s rolí helpdesk, které vidí tickety tohoto kanálu.",
    languages: "Jazyky kanálu",
    mailbox: "Schránka",
    mailboxIntro: "E-maily do schránky se stávají tickety a odpovědi odcházejí z ní. Microsoft 365 přes Microsoft Graph; IMAP pro běžné služby přijde s prvním zákazníkem, který ho má.",
    mailboxNone: "Kanál bez schránky — jen chat a tickety z něj.",
    mailboxKind: "Druh schránky",
    kindGraph: "Microsoft 365 (Graph)",
    kindImap: "IMAP (zatím nedostupné)",
    address: "Adresa schránky",
    addressHint: "např. helpdesk@futbalsfz.sk — čte se z ní i odpovídá",
    tenantId: "Tenant (Directory ID)",
    clientId: "Client ID aplikace",
    clientSecret: "Tajemství aplikace (client secret)",
    clientSecretHint: "Uloží se zašifrované; prázdné pole ho nemění. Postup registrace v Entra je v docs/NASADENIE_app.md.",
    secretSet: (hint: string, when: string, by: string) => `tajemství …${hint} zadané ${when} (${by})`,
    secretNone: "tajemství zatím není zadané",
    sync: "Synchronizace",
    syncNow: "Synchronizovat teď",
    syncNever: "ještě neběžela",
    syncLast: (when: string) => `naposledy ${when}`,
    syncError: (code: string) => `poslední chyba: ${code}`,
    syncCounts: (created: number, appended: number, skipped: number) => `nové tickety ${created} · doplněné ${appended} · přeskočené ${skipped}`,
    syncSinceHint: "První spuštění jen označí začátek: starší zprávy se tickety nestanou, historie jde do těžby FAQ.",
    syncInterval: "Interval synchronizace",
    syncIntervalHint: "Jak často se schránka kontroluje automaticky. Synchronizovat teď funguje kdykoli.",
    syncIntervalOption: (m: number) => (m >= 1440 ? "jednou denně" : m >= 60 ? "každou hodinu" : `každých ${m} minut`),
    syncDone: (created: number, appended: number, beforeStart: number) => `Synchronizace proběhla: nové tickety ${created}, doplněné ${appended}, zpráv z historie přeskočeno ${beforeStart}.`,
    verify: "Ověřit spojení",
    verified: (address: string, name: string) => `Spojení funguje: ${address}${name ? ` (${name})` : ""}.`,
    widget: "Widget pro cizí systém",
    widgetIntro: "Cizí systém (ISSF) vydá po přihlášení podepsaný token s identitou osoby; widget ho pošle s otázkou. Tajný klíč se ukáže jen jednou, hned po vytvoření.",
    widgetOrigins: "Povolené původy",
    widgetOriginsHint: "Adresy, ze kterých smí widget volat, každá na nový řádek: https://issf.futbalsfz.sk",
    rateLimit: "Strop požadavků na osobu a hodinu",
    rateLimitHint: "Ochrana před zneužitím (D14).",
    widgetSecret: "Tajný klíč",
    widgetSecretRotate: "Vytvořit nový tajný klíč",
    widgetSecretShown: "Nový tajný klíč — zkopíruj ho teď, znovu se neukáže:",
    widgetSecretNone: "zatím nevytvořený",
    widgetSecretSet: (hint: string, when: string) => `…${hint}, vytvořený ${when}`,
    mining: "Těžba FAQ z historie",
    miningIntro: "Model přečte poslední vlákna schránky, očistí je od osobních údajů a navrhne záznamy FAQ do konceptu vybraného FAQ dokumentu. Těla zpráv se neukládají; návrhy schvaluje správce obsahu postupem znění.",
    miningDocument: "FAQ dokument",
    miningLimit: "Kolik posledních zpráv přečíst",
    miningRun: "Navrhnout záznamy FAQ",
    miningDone: (threads: number, proposed: number, saved: number, duplicates: number) => `Těžba proběhla: vláken ${threads}, návrhů ${proposed}, uložených do konceptu ${saved}, duplicitních ${duplicates}.`,
    noFaqDocuments: "V knihovně ještě není FAQ dokument — založ ho v Knihovně → Nový dokument → FAQ.",
    tickets: (open: number, total: number) => `tickety: ${open} otevřených z ${total}`,
    save: "Uložit kanál",
    saved: "Kanál je uložen.",
    created: "Kanál je založen.",
    remove: "Odstranit kanál",
    removed: "Kanál je odstraněn.",
    deployNote: "Aplikace v Entra potřebuje oprávnění Mail.Read a Mail.Send zúžená na schránku kanálu (RBAC for Applications). Postup: docs/NASADENIE_app.md § 5.",
  },
  library: {
    emptyForYou: "Zatím tu pro vás nejsou žádné dokumenty.",
    reader: {
      lead: "Platné předpisy a směrnice vaší organizace.",
      search: "Hledat v názvu dokumentu",
      searchSubmit: "Hledat",
      emptyFilter: "Žádný dokument tomu neodpovídá.",
      validFrom: date => `platí od ${date}`,
    },
    flow: {
      heading: d => `Nové znění od ${d}`,
      headingUndated: "Nové znění",
      firstVersion: "První znění",
      publishedHeading: d => `Znění od ${d}`,
      steps: ["Příprava", "Schválení", "Zveřejnění", "Přidělení"],
      stepOf: n => `Krok ${n} ze 4`,
      subPrepare: "PDF, Word, údaje o znění",
      subPrepareDone: "hotová",
      subWaitSubmit: "čeká na předložení",
      subInReview: (done, total) => `${done} z ${total} schválilo`,
      subApproved: "schváleno",
      subRejected: n => `kolo ${n} zamítnuto`,
      subCancelled: n => `kolo ${n} staženo`,
      subWaitApproval: "čeká na schválení",
      subPublished: "zveřejněno",
      subAssign: "přenos přidělení",
      statusPreparing: "příprava",
      statusInReview: (by, date) => `ke schválení · předložil ${by} ${date}`,
      statusApproved: "schváleno, čeká na zveřejnění",
      statusRejected: date => `příprava · vráceno ze schválení ${date}`,
      statusPublished: date => `zveřejněno ${date} · zatím nikomu nepřiděleno`,
      lead1: "Zkontroluj, co se bude schvalovat. Po předložení nic z toho nelze změnit.",
      lead1Rejected: "Oprav, co schvalovatel vytkl, zkontroluj údaje a předlož nové kolo. Zamítnutí zůstává v historii.",
      rejectedBy: (who, date, n) => `${who} zamítl ${date} · kolo ${n} se tím zastavilo`,
      cancelled: (date, n) => `Kolo ${n} staženo ${date}`,
      checkPdf: "PDF",
      checkPdfMissing: "Chybí PDF — bez něj nelze znění předložit. Nahraj ho přes „Vyměnit“.",
      checkSource: "Upravitelný zdroj",
      checkSourceNote: "text pro vyhledávání vznikl z něj",
      checkSourceMissing: "bez zdroje — text pro vyhledávání vznikl z PDF",
      replace: "Vyměnit",
      showText: "Zobrazit text",
      metaHeading: "Údaje o znění",
      metaNote: "Datum účinnosti je povinné před předložením ke schválení.",
      approvers: "Schvalovatelé",
      approversPrefilled: "Předvyplněno z posledního kola, lze změnit. Sám sebe schválit nemůžeš.",
      responsible: "Odpovědná osoba nového znění",
      responsibleNote: "Když ji určíš už teď, při zveřejnění se jen potvrdí a hned po zveřejnění jí přijde upozornění, aby určila právní základ.",
      responsibleChosen: name => `Odpovědná osoba: ${name}. Určena v přípravě.`,
      basisChosen: label => `Právní základ: ${label}. Určen v přípravě, při zveřejnění se přenese do znění.`,
      basisWaiting: name => `Právní základ zatím není určen. ${name} jej může určit ještě před zveřejněním na stránce dokumentu — upozornění má ve zvonečku.`,
      basisNoResponsible: "Právní základ zatím není určen. Dokud příprava nemá odpovědnou osobu, může jej určit správce obsahu.",
      basisResponsibleGone: "Právní základ zatím není určen a odpovědná osoba z přípravy už není aktivní — může jej určit správce obsahu.",
      basisSetHere: "Určit právní základ",
      basisChangeHere: "Změnit právní základ",
      responsibleChange: "Změnit odpovědnou osobu",
      note: "Poznámka pro schvalovatele",
      submitAndSave: "Uložit a předložit ke schválení",
      resubmit: n => `Uložit a předložit kolo ${n}`,
      saveOnly: "Jen uložit",
      lead2: (done, total) => `Čeká na schválení — ${done} z ${total}. Až schválí všichni, znění lze zveřejnit. Jedno zamítnutí vrátí znění do přípravy.`,
      approvalsWhere: "Schvalovatelé rozhodují v „Ke schválení“; e-mail jim odešel při předložení.",
      whatIsApproved: "Co se schvaluje",
      locked: "zamčeno během kola",
      searchText: "Text pro vyhledávání",
      searchTextNote: "z něj odpovídá vyhledávání",
      open: "Otevřít",
      show: "Zobrazit",
      next: "Potom",
      next3: "označení znění a odpovědná osoba",
      next4: "nabídne se přenos přidělení z předchozího znění",
      next4None: "přidělování v Přidělených dokumentech",
      withdraw: "Stáhnout kolo",
      withdrawNote: "Stažením se znění vrátí do přípravy a lze ho upravit. Kolo zůstane v historii.",
      lead3: "Znění je schválené. Doplň označení a zveřejni ho.",
      labelSuggestion: d => `úplné znění od ${d}`,
      labelSuggested: "Návrh z data účinnosti. Označení je doslova ve formulce potvrzení.",
      effectiveFromSourceSuggested: "Předvyplněno ze schválených údajů o znění.",
      carryOver: n => `Přidělit nové znění stejným adresátům (${n})`,
      carryOverNote: "Odškrtni, pokud chceš přidělit jinak — pak to uděláš v kroku 4 nebo v Přidělených dokumentech.",
      publishFrom: d => `Zveřejnit od ${d}`,
      publishAndAssign: "Zveřejnit a přidělit",
      lead4: "Potvrzení se váže na znění, takže nové znění je třeba přidělit znovu.",
      assignElsewhere: "Přidělit jiným lidem →",
      assignChosen: "Přidělit vybraným",
      newVersion: "Nové znění",
      newVersionBusy: "Nové znění se už připravuje. Soubory vyměníš v přípravě.",
      newVersionFirst: "Dokument zatím nemá platné znění — nejdřív dokonči první.",
      downloadPdf: "Stáhnout PDF",
      downloadSource: "Stáhnout zdrojový soubor",
      editDocument: "Upravit dokument",
      currentHeading: "Platné znění",
      upcomingHeading: "Připravované znění",
      upcomingNote: d => `Zveřejněné, platit začne ${d}. Do té doby lidé čtou a potvrzují platné znění výše.`,
      fromDate: d => `od ${d}`,
      changeResponsible: "Změnit odpovědnou osobu",
      changeBasis: "Změnit právní základ",
      fixData: "Opravit údaje",
      history: "Historie",
      olderHeading: "Starší znění",
      olderNone: "Žádná. Po zveřejnění nového znění se sem přesune platné.",
      older: {
        count: n => String(n),
        note: "Lidé je už nevidí; potvrzení zůstávají jako doklad.",
        range: (from, to) => `${from} – ${to}`,
        published: date => `zveřejněno ${date}`,
        acks: "potvrdili",
        noAcks: "bez potvrzení",
        ackCount: n => `${n} potvrzení`,
        more: "Další úkony",
        showAll: n => `Zobrazit všechna (${n})`,
        close: "Zavřít",
        responsibleMissing: "chybí",
        responsibleInactive: "vyřazená",
        basisMissing: "základ neurčen",
      },
      manage: "Správa",
      archive: {
        heading: "Archivovat předpis",
        intro: "Předpis přestane platit dnem, který zvolíte. Asistent z něj přestane odpovídat, nepůjde přidělit a nepotvrzená přidělení se odvolají. Text, PDF a potvrzení zůstanou.",
        until: "Neplatí od",
        untilHint: "Může být i v budoucnosti — do té doby předpis platí normálně.",
        reason: "Důvod",
        reasonHint: "Například: zrušen usnesením VV č. … ze dne …",
        submit: "Archivovat",
        blocked: "Archivovat teď nejde:",
        done: (date, revoked) => `Předpis je archivován od ${date}.${revoked ? ` Odvolaná přidělení: ${revoked}.` : ""}`,
        scheduled: date => `Předpis se archivuje ${date}. Do té doby platí.`,
        bannerInEffect: date => `Archivován — neplatí od ${date}`,
        bannerScheduled: date => `Archivuje se — platí ještě do ${date}`,
        bannerMeta: (who, at) => `Archivoval(a) ${who}, ${at}`,
        restore: "Obnovit platnost",
        restoreHint: "Při omylu. Odvolaná přidělení se neobnoví — přidělit jde znovu.",
        restored: "Platnost předpisu je obnovena.",
      },
      uploadNext: "Potom na detailu zkontroluješ text, vybereš schvalovatele a odpovědnou osobu a předložíš.",
      approvalHistory: "Historie schvalování",
      versionPageTitle: "Nové znění",
      versionPageBack: "← Zpět na dokument",
      autoLabel: d => `znění účinné od ${d}`,
      autoLabelNote: "Označení se skládá z data účinnosti a je doslova ve formulce potvrzení.",
      titleNote: "U platného znění se název mění jen novým zněním — schválí se spolu s ním a zveřejněním se změní v knihovně i ve formulce potvrzení.",
      newTitle: t => `Nový název dokumentu: „${t}“`,
      secBasic: "Základní údaje",
      secPlacement: "Zařazení",
      optional: "nepovinné",
      editSaveNote: "Mění údaje o dokumentu, ne znění. Schválení ani potvrzení se tím neruší.",
      cancel: "Zrušit",
      titleLockedBefore: "🔒 Dokument má zveřejněné znění — název se mění jen ",
      titleLockedLink: "novým zněním",
      titleLockedAfter: ". Schválí se spolu s ním.",
      elsewhereHeading: "Upravuje se jinde",
      elsewhereVersion: "Nové znění",
      elsewhereMeta: "Údaje o znění",
      elsewhereResponsible: "Odpovědná osoba a právní základ",
      elsewhereText: "Text pro vyhledávání",
    },
    carryOver: {
      heading: "Přidělit i nové znění",
      intro: (label) => `Znění „${label}" zatím nemá přiděleného nikoho. Předchozí znění přidělená byla — potvrzení se váže na konkrétní znění, takže novelu je třeba přidělit znovu.`,
      audiences: "Adresáti z předchozích znění",
      previously: (label, reason) => `${label} · původní důvod: ${reason}`,
      reason: "Důvod přidělení",
      reasonNote: "Povinný. Napiš, proč se má norma potvrdit znovu — původní důvod u každého adresáta je jen nápověda a u novely zpravidla neplatí.",
      due: "Termín potvrzení",
      dueNone: "bez termínu",
      dueDate: "do data",
      dueDays: "do počtu dnů",
      dueDaysUnit: "dnů od přidělení",
      dueNote: "Bez termínu se připomínky neposílají samy. Původní termín se nepřenáší — bývá v minulosti a hned by vyrobil zpoždění.",
      submit: "Přidělit vybraným",
      noEmailNote: "E-maily se tím neposílají. Rozeslání je samostatný krok v Přidělených dokumentech.",
    },
    fields: {
      ownerDepartment: "Oddělení, které dokument spravuje",
      ownerDepartmentShort: "Oddělení",
      ownerDepartmentNote: "Nepovinné. Kdo předpis udržuje — ne komu se přiděluje k potvrzení.",
      ownerDepartmentNone: "Neurčeno",
      ownerDepartmentEmpty: "Organizační struktura je zatím prázdná. Oddělení se zakládají v Nastavení organizace.",
      internalNumber: "Interní číslo",
      internalNumberNote: "Nepovinné. Ne každý předpis ho má a do formulky potvrzení nevstupuje.",
      internalNumberPlaceholder: "12/2024",
    },
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
      language: "Jazyk",
      all: "— všechny —",
      filtersTitle: "Filtry",
      accessLevel: "Přístup",
      apply: "Použít",
      tagSearch: "hledat značku…",
      shown: (found, all) => `${found} z ${all}`,
      removeFilter: (value) => `Odebrat filtr ${value}`,
      colDocument: "Dokument",
      colVersion: "Verze",
      colEffectiveFrom: "Platné od",
      colEffectiveTo: "Platné do",
      colAcknowledged: "Potvrzení",
      acknowledgedOf: (acknowledged, assigned) => `${acknowledged} z ${assigned} přidělených`,
      colChanged: "Změněno",
      exportCsv: "Export CSV",
      sortBy: (column) => `Seřadit podle ${column}`,
      pageRange: (from, to, total) => `Zobrazeno ${from}–${to} z ${total}`,
      pageOf: (page, pages) => `Strana ${page} z ${pages}`,
      prevPage: "Předchozí",
      nextPage: "Další",
      viewSwitch: "Pohled",
      filters: "Filtry",
      showResults: n => (n === 1 ? "Zobrazit 1 dokument" : n >= 2 && n <= 4 ? `Zobrazit ${n} dokumenty` : `Zobrazit ${n} dokumentů`),
      moreActions: "Další akce",
      waiting: {
        heading: "Čeká na schválení",
        count: n => (n === 1 ? "1 znění" : n >= 2 && n <= 4 ? `${n} znění` : `${n} znění`),
        since: date => `předloženo ${date}`,
        waitingFor: names => `čeká se na: ${names}`,
        nobodyPending: "všichni rozhodli",
      },
      viewTable: "Tabulka",
      viewCards: "Karty",
      bulk: {
        heading: "S označenými",
        pickColumn: "Výběr",
        pick: (title) => `Označit ${title}`,
        picked: (count) => `Označeno: ${count}`,
        pickedOutside: (count) => `z toho ${count} mimo tento seznam`,
        pickedMax: (max) => `Více než ${max} naráz označit nelze — výběr se nese v adrese. Zpracujte tuto dávku a označte další.`,
        clearPicked: "zrušit výběr",
        moveConfirm: count =>
          `Přesunout ${count} ${count === 1 ? "dokument" : count < 5 ? "dokumenty" : "dokumentů"} do …`,
        moveTo: "Přesunout do",
        move: "Přesunout",
        assign: "Vyžádat potvrzení",
      },
      builder: {
        heading: "+ Podmínka",
        hint: "Uvnitř skupiny platí „a“, mezi skupinami „nebo“ — tedy (A a B) nebo (C a D). Spojku před řádkem změníte odkazem vedle něj.",
        field: "Pole",
        op: "Operátor",
        value: "Hodnota",
        today: "dnes",
        fieldNote: "U „Platné do po“ se dokumenty s neomezenou platností nezobrazí — nemají konec platnosti, na který se ptáte.",
        add: "Přidat podmínku",
        remove: (description) => `Odebrat podmínku ${description}`,
        matchAll: "splňuje všechny",
        matchAny: "splňuje kteroukoli",
        makeAnd: "změnit na „a“",
        makeOr: "změnit na „nebo“",
        addAnd: "Přidat s „a“",
        addOr: "Přidat s „nebo“",
        joinAll: "a zároveň",
        joinAny: "nebo",
        joinFirst: "kde",
        preview: "Dokumenty, kde",
        fields: {
          title: "Název",
          category: "Druh",
          status: "Stav",
          tag: "Značka",
          accessLevel: "Přístup",
          updatedAt: "Změněno",
          effectiveTo: "Platné do",
        },
        ops: {
          is: "je",
          not: "není",
          contains: "obsahuje",
          before: "před",
          after: "po",
        },
      },
      statusLabel: {
        published: "Platný",
        draft: "Návrh",
        review: "Ke schválení",
        expired: "Expirovaný",
        archived: "Archivován",
      },
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
      empty: "V knihovně zatím nic není",
      emptyText: "Až nahrajete první dokument, objeví se tu i s tím, kdo ho má potvrdit.",
      emptyFilteredTitle: "Filtru nic nevyhovuje",
      emptyFilteredBefore: count =>
        count === 1
          ? "Máte nasazený 1 filtr:"
          : count < 5
            ? `Máte nasazené ${count} filtry:`
            : `Máte nasazených ${count} filtrů:`,
      emptyFilteredAfter: "Zkuste některý zrušit.",
      and: "a",
    },
    tracks: {
      heading: "Trasy",
      intro: "Trasa je pořadí kroků — „projdi tyto dokumenty v tomto pořadí“. Člověk na ní vidí, kde skončil.",
      newHeading: "Nová trasa",
      key: "Klíč",
      keyHint: "Malá písmena bez diakritiky, číslice a pomlčka. Jde do adres a zůstává.",
      keyTaken: "Taková trasa už existuje — změň klíč.",
      title: "Název",
      description: "Popis (nepovinný)",
      create: "Založit trasu",
      emptyTitle: "Žádné trasy",
      emptyText: "Trasa je pořadí norem, které má člověk přečíst — například při vstupu do organizace. První založíte formulářem níže.",
      active: "zapnutá",
      inactive: "vypnutá",
      enable: "Zapnout",
      disable: "Vypnout",
      stepCount: n => (n === 1 ? "1 krok" : n >= 2 && n <= 4 ? `${n} kroky` : `${n} kroků`),
      detailHeading: title => `Trasa ${title}`,
      edit: "Upravit název",
      rename: "Uložit název",
      steps: "Kroky",
      noSteps: "Trasa zatím nemá kroky. Prázdnou trasu zapnout nelze — lidem by tvrdila „hotovo“.",
      addStep: "Přidat krok",
      chooseDocument: "— vyberte dokument —",
      requiresAck: "Vyžaduje potvrzení",
      requiresAckHint: "Bez potvrzení je krok jen ke čtení a do důkazů se nezapíše.",
      ackYes: "s potvrzením",
      ackNo: "bez potvrzení",
      remove: "Odebrat",
      moveUp: "Výše",
      moveDown: "Níže",
      created: "Trasa je založena. Zapnout ji půjde, až bude mít kroky.",
      renamed: "Název je uložen.",
      stepsSaved: "Kroky jsou uloženy.",
      dueHeading: "Termín potvrzení",
      dueNone: "bez termínu",
      dueDays: "do počtu dnů od přidání na trasu",
      dueDaysUnit: "dnů od přidání",
      dueNote: "Každému běží ode dne, kdy ho na trasu přidali, takže kdo přijde později, má stejnou lhůtu. S termínem lidem chodí připomínky, když se blíží i když je po něm. Platí i pro ty, kdo už na trase jsou — kdo je na ní déle, může být hned po termínu.",
      dueSave: "Uložit termín",
      settingsHeading: "Nastavení trasy",
      saveSettings: "Uložit nastavení",
      addHeading: "Přidat osoby na trasu",
      cancel: "Zrušit",
      deactivateTitle: "Deaktivovat trasu",
      deactivateNote: "Nikdo nový nepřibude a připomínky se zastaví. Potvrzení zůstávají.",
      activateTitle: "Aktivovat trasu",
      activateNote: "Trasa se znovu nabídne při přidávání lidí a připomínky se obnoví.",
      dueSaved: "Termín trasy je uložen.",
      settingsSaved: "Nastavení trasy jsou uložena.",
      dueCurrent: days => (days === null ? "Bez termínu" : days === 1 ? "Do 1 dne od přidání na trasu" : `Do ${days} dnů od přidání na trasu`),
      members: n => `Osoby na trase (${n})`,
      noMembers: "Na trase zatím nikdo není.",
      membersInactive: "vyřazená",
      removeMember: "Odebrat",
      addMembers: "Přidat osoby",
      addMembersNote: "Z oddělení se přidají jeho dnešní členové včetně podřízených. Kdo do oddělení přijde později, trasu nedostane sám — k tomu slouží přidělení oddělení.",
      departments: "Oddělení",
      people: "Osoby",
      addSubmit: "Přidat na trasu",
      notifyAdded: "Poslat přidaným e-mail s dokumenty k potvrzení",
      notifyAddedHint: "Dostanou ho jen ti, kterým z trasy něco chybí, a jen o tom, co jim chybí. Bez zaškrtnutí se jim ozve až připomínka před termínem trasy.",
      membersAdded: (added, already) => `Přidáno na trasu: ${added}.` + (already > 0 ? ` ${already} už na ní ${already === 1 ? "byl" : "byli"}.` : ""),
      memberRemoved: "Osoba je z trasy odebrána. Její potvrzení zůstávají.",
      enabled: "Trasa je zapnutá.",
      disabled: "Trasa je vypnutá. Zůstává zapsaná u lidí, kteří ji už mají.",
    },

    folders: {
      heading: "Složky",
      manage: "Správa složek",
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
      removeBlocked: (documents, subfolders) => {
        const d = documents === 1 ? "1 dokument" : documents >= 2 && documents <= 4 ? `${documents} dokumenty` : `${documents} dokumentů`
        const f = subfolders === 1 ? "1 podsložka" : subfolders >= 2 && subfolders <= 4 ? `${subfolders} podsložky` : `${subfolders} podsložek`
        const what = subfolders > 0 && documents > 0 ? `${d} a ${f}` : subfolders > 0 ? f : d
        return `Zrušit lze jen prázdnou složku. V této je ${what} — nejprve je přesuňte.`
      },
      emptyTitle: "Knihovna nemá složky",
      emptyText: "Dokumenty jsou zatím nezařazené. Složku založíte formulářem níže — a pak je do ní přesunete hromadně z knihovny.",
      newFolder: "Nová složka",
      newFolderName: "Název nové složky",
      parentFolder: "Nadřazená složka",
      create: "Založit",
    },
    detail: {
      documentData: "Údaje o dokumentu",
      side: {
        progressHeading: "Potvrzení",
        progressOf: (acknowledged, assigned) => `${acknowledged} / ${assigned} osob`,
        progressNobody: "Toto znění zatím není nikomu přiděleno.",
        progressWho: "Kdo nepotvrdil →",
        progressAssign: "Přidělit k potvrzení →",
        metaHeading: "Metadata",
        folder: "Složka",
        unfiled: "Nezařazené",
        identifier: "Identifikátor",
        none: "—",
      },
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
      draftPdf: "PDF konceptu:",
      draftSource: "Upravitelný zdroj:",
      versionPdf: "PDF znění:",
      versionSource: "Upravitelný zdroj (předloha pro další znění):",
      noPdf: "Znění z doby před ADR-011 — PDF k němu není, schvaloval a potvrzoval se text.",
      noDraftPdf: "Koncept nemá PDF. Před předložením ke schválení nahraj znění znovu i s PDF.",
      draftDiffers: "Koncept se liší od publikovaného znění.",
      draftSame: "Koncept je shodný s publikovaným zněním.",
      draftEmpty: "Koncept je prázdný.",
      publishHeading: "Publikovat znění",
      nowPublishNew: current => `Publikovat nové znění — nyní platí ${current}`,
      nowInReview: "Znění je ve schvalování",
      toolsSummary: "Úpravy a správa dokumentu",
      approvalDraftLabel: "koncept",
      draftApprovalHeading: "Schválení konceptu",
      publishNeedsApproval: "Koncept ještě není schválený. Předlož ho ke schválení výše — publikovat lze až schválené znění.",
      publishWaitsForApproval: "Schvalování běží. Publikovat lze, až schvalovatelé rozhodnou.",
      publishApprovedNote: "Koncept je schválený. Text už neměň — každá úprava změní otisk a schválení tím přestane platit.",
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
      reindexHeading: "Přeindexovat všechna znění",
      reindexNoteBefore: "Nařeže všechna znění — platné, připravované i starší — znovu podle aktuálního profilu členění. ",
      reindexNoteHighlight: "Nevytvoří novou verzi",
      reindexNoteAfter: " — text se nemění, takže potvrzení zůstávají platná a nikomu nenaskočí povinnost potvrzovat znovu. Používá se po vyladění profilu v nastavení organizace.",
      reindex: "Přeindexovat všechna znění",
      reindexVersionHeading: "Přeindexovat",
      reindexVersionNote: "Nařeže toto znění znovu podle aktuálního profilu členění. Text se nemění, potvrzení zůstávají platná a asistent pak hledá v novém členění.",
      reindexVersion: "Přeindexovat toto znění",
      newVersionHeading: "Nové znění ze souboru",
      newVersionNote: "Nahraje nový soubor jako koncept tohoto dokumentu. Publikované znění se tím nemění — text si nejprve přečteš a znění publikuješ až potom. Metadata zůstávají, mění se jen text a původní soubor.",
      newVersionFile: "Soubor s novým zněním",
      newVersionSubmit: "Nahrát nové znění",
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
      fixHistory: n => (n === 1 ? "1 oprava" : n >= 2 && n <= 4 ? `${n} opravy` : `${n} oprav`),
      fixLine: (who, when) => `${who} · ${when}`,
      fixWas: (label, effectiveFrom) => `původně ${label}, ${effectiveFrom}`,
      fixReacknowledged: "vyžádalo opětovné potvrzení",
      fixNoDate: "bez data platnosti",
      versionLockedBefore: "Označení a datum platnosti se už měnit nedají — znění potvrdilo ",
      versionLockedHighlight: (people) => `${people} lidí`,
      versionLockedAfter: " a oba údaje jsou v podepsané formulce. Opravit se dají až po odvolání potvrzení; to dělá personalista.",
      revokeVersionHeading: "Odvolat potvrzení tohoto znění",
      revokeVersionNote: (people) => `Odvolá ${people} platných potvrzení najednou. Povinnost ožije s původním termínem — kdo jej má za sebou, bude hned po termínu. Stará potvrzení z evidence nezmizí, zůstanou jako odvolaná i s důvodem.`,
      revokeVersionReason: "Důvod odvolání",
      revokeVersionReasonPlaceholder: "Špatné datum platnosti — usnesení VV SFZ určilo 1. 4. 2026",
      revokeVersionSubmit: "Odvolat potvrzení",
      fixSubmit: "Opravit",

      textFixHeading: "Nebo: oprava textu bez nové verze",
      textFixTarget: label => `Opravuje se: ${label}`,
      textFixOther: label => `Porovnat se: ${label}`,
      textFixPanel: "Opravit text",
      textFixPanelNote: "Nahraje text tohoto znění do editoru. Oprava je bez nové verze — jen překlep, čárka či diakritika; potvrzení zůstávají platná. Když se mění význam, je třeba nové znění. Uložíš ji pak ve Správě, s rozdílem a důvodem.",
      textFixLoad: "Načíst text do editoru",
      textFixIntro:
        "Překlep, čárka, diakritika — něco, co nemění význam. Znění zůstane stejné, potvrzení zůstanou platná " +
        "a do vyhledávání se pošle opravený text u téhož znění. Pokud se mění význam, tohle není ta cesta: publikuj nové znění.",
      textFixDiffHeading: "Co se změní",
      textFixDiffStat: (added, removed) => `+${added} / −${removed} řádků`,
      textFixGap: n => `… ${n} nezměněných řádků …`,
      textFixCoarse:
        "Změna je příliš velká na porovnání po řádcích. Tohle už pravděpodobně není oprava překlepu — zvaž nové znění.",
      textFixApprovalNote:
        "Schválení zůstane u původního textu — po opravě se už neshoduje se zněním, které je venku. Právě proto se takto opravuje jen to, co nemění význam.",
      textFixReason: "Důvod opravy",
      textFixReasonPlaceholder: "chybějící čárka v čl. 4 odst. 2",
      textFixReasonNote: "Povinný. Zapíše se ke znění spolu s celým předchozím textem.",
      textFixSubmit: "Opravit text bez nové verze",
      textFixHistory: n => (n === 1 ? "1 oprava textu" : n >= 2 && n <= 4 ? `${n} opravy textu` : `${n} oprav textu`),
      textFixLine: (who, when) => `${who} · ${when}`,

      approvalHeading: "Schválení",
      stateDraft: "Koncept",
      stateInReview: "Ve schvalování",
      stateApproved: "Schváleno",
      statePublishedBefore: "Zveřejněno před zavedením schvalování",
      statePublishedBeforeNote:
        "Toto znění bylo v knihovně dřív, než se začalo schvalovat. Zpětně se neschvaluje \u2014 nahradí ho oficiální znění, které schvalováním projde.",
      approvalSubmit: "předložit ke schválení",
      approvalApprovers: "Schvalovatelé",
      approvalApproversHint:
        "Vyber jmenovitě lidi, ne oddělení. \u201ESchválil někdo z oddělení Právní\u201C se za rok nedá ověřit. Sebe vybrat nemůžeš \u2014 kdo text nahrál, ten ho neschvaluje.",
      approvalNoPeople: "V organizaci není koho vybrat.",
      approvalNote: "Co se ve znění mění",
      approvalNotePlaceholder: "Například: upravený článek 4, sladění s novelou zákona.",
      approvalNoteHint: "Nepovinné. Čte to schvalovatel, ne archiv.",
      approvalSubmitButton: "Předložit ke schválení",
      approvalWaiting: "čeká",
      approvalNotDecided: "nerozhodl",
      approvalApproved: when => `schválil ${when}`,
      approvalRejected: when => `zamítl ${when}`,
      approvalRoundHeading: round => `${round}. kolo`,
      approvalSubmittedBy: (who, when) => `předložil ${who} · ${when}`,
      approvalHistory: n => (n === 1 ? "1 kolo" : n >= 2 && n <= 4 ? `${n} kola` : `${n} kol`),
      approvalCancel: "zrušit kolo",
      approvalCancelReason: "Důvod zrušení",
      approvalCancelHint:
        "Kolo se nesmaže \u2014 dostane důvod a zůstane v historii. Je to jediná cesta, jak ze seznamu odstranit schvalovatele, který tam být nemá.",
      approvalCancelButton: "Zrušit kolo",
    },
    chunks: {
      heading: "Členění na úseky",
      intro: "Asistent nečte celý dokument najednou — dostane několik úseků a odpovídá z nich. Zde vidíte, jak je platné znění rozřezané a zda to sedí.",
      openLink: "členění na úseky →",
      profile: "Profil členění",
      version: "Znění",
      noVersion: "Dokument zatím nemá platné znění, proto nemá úseky. Níže je jen rozbor konceptu.",
      upToDate: "Úseky odpovídají dnešnímu členění.",
      outdated: (stored, today) => `Úseky jsou rozřezané starším způsobem (${stored} ${stored === 1 ? "úsek" : stored >= 2 && stored <= 4 ? "úseky" : "úseků"}); dnes by jich vzniklo ${today}.`,
      reindexHint: "Přeindexovat lze v detailu dokumentu (Správa → Přeindexovat). Znění ani potvrzení se nemění.",
      statsCount: "Úseků",
      statsArticles: "S článkem",
      statsTokens: "Velikost (tokeny)",
      tokensRange: (min, avg, max) => `${min} – ${avg} – ${max}`,
      target: (min, max) => `cíl ${min}–${max}`,
      warningsHeading: "Co nesedí",
      warnings: {
        oneBlock: "Celý text je v jednom úseku — nenašel se ani jeden článek. Asistent z něj neumí citovat konkrétní místo. Typické pro manuál nebo smlouvu; pomůže členění podle nadpisů.",
        fewArticles: percent => `Článek má jen ${percent} % úseků — členění dokumentu profil téměř nerozpoznal.`,
        oversized: (count, limit) => `${count} ${count === 1 ? "úsek je větší" : count <= 4 ? "úseky jsou větší" : "úseků je větších"} než ${limit} tokenů — asistent z ${count === 1 ? "něj" : "nich"} dostane příliš mnoho najednou.`,
        fragments: count => count === 1 ? "1 krátký úlomek rozděleného článku — má málo kontextu." : `${count} ${count <= 4 ? "krátké úlomky" : "krátkých úlomků"} rozdělených článků — mají málo kontextu.`,
      },
      noWarnings: "Bez nálezů.",
      analysisHeading: "Rozbor textu",
      analysisFound: (lines, articles, paragraphs, points, headings) =>
        `${lines} řádků · „Článok“ ${articles}× · „§“ ${paragraphs}× · „Bod“ ${points}× · nadpisů ${headings}`,
      analysisFits: word => `Text je členěný na „${word}“ — profil sedí.`,
      analysisOther: word => `Text je členěný spíše na „${word}“ než podle profilu — zvažte jiný profil.`,
      analysisPlain: "Text nemá články ani paragrafy. Potřebuje členění podle nadpisů.",
      listHeading: "Úseky",
      noArticle: "bez článku",
      tokens: n => `${n} ${n === 1 ? "token" : n >= 2 && n <= 4 ? "tokeny" : "tokenů"}`,
      oversizedTag: "velký",
      trialHeading: "Zkusit jiný řez",
      trialIntro: "Změňte hodnoty a podívejte se, jak by se text rozřezal. Nic se neuloží, dokud níže nezvolíte profil.",
      fieldArticleWord: "Slovo článku",
      fieldArticleWordHint: "Slovo, kterým začíná nadpis článku: Článek, § nebo Bod.",
      fieldAnnexWord: "Slovo přílohy",
      fieldMinTokens: "Úsek od (tokenů)",
      fieldMaxTokens: "Úsek do (tokenů)",
      trialShow: "Ukázat řez",
      trialReset: "Zrušit zkoušku",
      compareHeading: "Porovnání",
      compareNow: "teď",
      compareTrial: "zkouška",
      compareMax: "Největší úsek",
      trialMatches: label => `Tyto hodnoty má profil „${label}“.`,
      trialSameAsCurrent: "Zkušební řez je stejný jako současný — není třeba nic měnit.",
      trialListHeading: "Úseky po zkušebním řezu",
      saveHeading: "Profil pro tento dokument",
      saveIntro: "Dokument nese jen pojmenovaný profil — ten lze použít i u dalších dokumentů. Po změně profilu je třeba dokument přeindexovat; do té doby asistent odpovídá ze starých úseků.",
      useProfile: "Použít existující profil",
      useProfileButton: "Použít",
      currentProfile: "současný",
      newProfile: "Uložit hodnoty zkoušky jako nový profil",
      newProfileLabel: "Název profilu",
      newProfileHint: "Například „Zákon (§)“. Existující profily se zde nemění — změna by potichu přeřezala všechny dokumenty, které je používají.",
      newProfileButton: "Uložit profil",
      adviceHeading: "Návrh AI",
      adviceIntro: "Model dostane strukturu dokumentu — nadpisy, články a začátky odstavců, ne celý text — a navrhne, jak ho rozřezat. Nic se nezmění; návrh si můžete vyzkoušet a uložit jako profil. Volání se zapíše do spotřeby AI.",
      adviceButton: "Analyzovat pomocí AI",
      adviceAgain: "Analyzovat znovu",
      adviceMeta: (date, model, by) => `${date} · ${model} · ${by}`,
      adviceStrategyArticles: (word, min, max) => `Po článcích — slovo „${word}“, úsek ${min}–${max} tokenů.`,
      adviceStrategyHeadings: "Podle nadpisů — dokument nemá články. Tento způsob členění zatím není k dispozici (ADR-027, krok 2).",
      adviceConfidence: { low: "jistota nízká", medium: "jistota střední", high: "jistota vysoká" },
      adviceIssues: "Co nesedí",
      adviceTry: "Zkusit tento řez",
    },
    editor: {
      intro: "Porovnej text s originálem. Publikování je samostatný krok — tady se nic nepouští ven.",
      modelDraft: "návrh modelu",
      ruleDraft: "návrh podle pravidel",
      modeRewriteScan: "přepis skenu",
      modeClean: "pročištění členění",
      draftMeta: (model, when, chars) => `${model} · ${when} · ${chars} znaků`,
      draftNoteBefore: "Model měl zakázáno měnit znění — ",
      ruleNoteBefore: "Pravidla mění jen značky členění a odstraňují patičku stránky, ne slova — ",
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
      llmHeading: "Pomoc při textu",
      llmNoteBefore: "Volá se jen takto — kliknutím. Výsledek se uloží jako ",
      llmNoteHighlight: "návrh vedle textu",
      llmNoteAfter: ", ne do něj: model má zakázáno měnit znění, ale tichou změnu v předpisu by nikdo nezachytil, kdyby se zapisovala rovnou.",
      clean: "Pročistit členění",
      cleanNote: "„Pročistit členění“ jazykový model nepoužívá. Text se označkuje podle pravidel — ČÁST, hlava, díl, Článek, příloha — a odstraní se opakovaná patička stránky. Nemá to limit na délku a nemění se ani jedno slovo předpisu.",
      rewriteScan: "Přepsat ze skenu",
      rewriteScanNote: "„Přepsat ze skenu“ pošle celé původní PDF modelu. Má smysl tehdy, když PDF nemá textovou vrstvu nebo je převod rozsypaný.",
    },
    actions: {
      converted: "Převedeno. Přečti text a porovnej ho s originálem.",
      metaSaved: "Údaje o znění uloženy.",
      convertedWithWarnings: (warnings) => `Převedeno. ${warnings}`,
      versionSameAsPublished: "Pozor: převedený text je shodný s platným zněním — nahraný soubor nepřináší žádnou změnu.",
      versionDiffers: (added, removed) => `Oproti platnému znění: ${added} přidaných, ${removed} odebraných řádků.`,
      saved: "Uloženo.",
      changesSaved: "Změny byly uloženy.",
      alreadyPublished: "Toto znění už publikované je — nic se nezměnilo.",
      published: (chunks, archived) =>
        `Publikováno: ${chunks} ${chunks === 1 ? "úsek" : chunks < 5 ? "úseky" : "úseků"},` +
        ` ${archived} starých archivováno.`,
      modelReturnedDraft: "Model vrátil návrh. Porovnej ho s dosavadním textem a rozhodni se.",
      rulesReturnedDraft: "Členění je pročištěné. Porovnej návrh s dosavadním textem a rozhodni se.",
      draftAccepted: "Návrh je teď konceptem. Publikování je stále samostatný krok.",
      draftDiscarded: "Návrh zahozen.",
      assigned: "Zařazeno.",
      bulkNothingSelected: "Neoznačili jste žádný dokument.",
      bulkMoved: (moved) => `Přesunuto: ${moved}.`,
      bulkMovedPartly: (moved, total, failed) =>
        `Přesunuto ${moved} z ${total}. Neprošly: ${failed}`,
      reindexUpToDate: "Členění je už aktuální — nic se neměnilo.",
      chunkingProfileSet: label => `Dokument má profil „${label}“. Ještě ho přeindexujte — do té doby asistent odpovídá ze starých úseků.`,
      chunkingProfileCreated: label => `Profil „${label}“ je uložen a přiřazen dokumentu. Ještě dokument přeindexujte.`,
      chunkingAdviceReady: "Návrh AI je hotový — níže. Nic se nezměnilo.",
      reindexAllResult: (done, unchanged) => `Přeindexovaná znění: ${done}, beze změny: ${unchanged}. Znění ani potvrzení se to nedotklo.`,
      reindexed: (chunks, archived) =>
        `Přeindexováno: ${chunks} ${chunks === 1 ? "úsek" : chunks < 5 ? "úseky" : "úseků"},` +
        ` ${archived} starých archivováno. Znění ani potvrzení se nedotklo.`,
      fixed: "Opraveno. Potvrzení zůstávají platná.",
      versionRevoked: (people) => `Odvolaných potvrzení: ${people}. Povinnost ožila s původním termínem — teď oprav údaj a nech znění potvrdit znovu.`,
      carriedOver: (created, already) =>
        `Přiděleno: ${created}${already > 0 ? `, už bylo přiděleno: ${already}` : ""}.` +
        " E-maily se neposlaly — rozeslání je samostatný krok.",
      textFixed: (added, removed, chunks) =>
        `Text opraven: +${added} / −${removed} řádků. Znění ani potvrzení se nemění;` +
        ` do vyhledávání šlo ${chunks} ${chunks === 1 ? "úsek" : chunks < 5 ? "úseky" : "úseků"}.`,
      submittedForApproval: n =>
        `Předloženo ke schválení ${n === 1 ? "jednomu člověku" : `${n} lidem`}.`,
      approvalNotAllNotified: n => `Ale ${n === 1 ? "jednomu člověku" : `${n} lidem`} se e-mail odeslat nepodařilo \u2014 kolo běží, jen o něm nevědí.`,
      approvalCancelled: "Kolo zrušeno. Zůstává v historii i s důvodem.",
      draftPrepared: "Příprava je uložena.",
      carryOverFailed: "Znění je zveřejněno, přenos přidělení se ale nepodařil:",
      failed: "Nepodařilo se to. Zkus to znovu.",
    },
    connectorImport: {
      heading: "Import ze serveru",
      intro: "Vyhledej články na připojeném MCP serveru a vybrané ulož jako koncepty dokumentů. Dál jdou běžnou cestou: metadata, schválení, zveřejnění. Server nemá seznam souborů — vybírá se z výsledků hledání.",
      newLink: "Články z připojeného serveru (např. Sportnet) se importují zde →",
      noConnector: "Žádný připojený konektor nemá zapnutý import do knihovny.",
      noConnectorLink: "Konektory organizace",
      connector: "Konektor",
      scope: "Rozsah",
      query: "Co hledat",
      queryPlaceholder: "změna hesla, registrace hráče…",
      queryHint: "Jedna otázka nebo téma; server vrátí nejvýše 10 článků.",
      search: "Hledat",
      nothingFound: "Server nic nenašel.",
      errorBefore: "Hledání selhalo: ",
      pick: n => `Vybrat články (${n})`,
      alreadySame: "V knihovně už je, beze změny na serveru.",
      alreadyChanged: "V knihovně už je — na serveru se od té doby změnil; import založí koncept nového znění.",
      open: "Otevřít",
      metaNote: "Platí pro všechny nové dokumenty z tohoto výběru; u existujících se metadata nemění.",
      folder: "Složka",
      folderNone: "Bez složky",
      accessHint: "Článek z vývojářské dokumentace je interní, dokud ho kurátor nepřepíše pro veřejnost.",
      import: "Importovat vybrané",
      afterNote: "Z každého článku vznikne koncept s PDF a textem; otevři ho, uprav a pošli ke schválení.",
      done: (created, versions, unchanged, failed) => `Import hotov: ${created} nových, ${versions} nových znění, ${unchanged} beze změny, ${failed} selhalo.`,
      pdfOrigin: (connector, path) => `Zdroj: ${connector} · ${path}`,
      sourceHeading: "Zdroj",
      sourceLine: (connector, group, date) => `Z konektoru ${connector}${group ? ` (${group})` : ""}, staženo ${date}.`,
      sourcePath: "Cesta na serveru",
      resync: "Zkontrolovat změny na serveru",
      resyncHint: "Článek se stáhne znovu; když se změnil, vznikne koncept nového znění. Zveřejněné se nemění.",
      resyncUnchanged: "Na serveru se nic nezměnilo.",
      resyncVersion: "Článek se změnil — koncept nového znění je připraven.",
    },
    faq: {
      newHeading: "Nové FAQ – časté otázky",
      newIntro: "FAQ se nenahrává jako soubor. Založ ho tady, potom přidávej záznamy: otázku, odpověď a předpis, ze kterého odpověď vychází. Zveřejnění projde schválením jako každé jiné znění.",
      newLink: "Časté otázky (FAQ) se nenahrávají jako soubor — založ je tady →",
      create: "Založit FAQ",
      created: "FAQ je založeno. Přidej první záznam.",
      heading: "Záznamy FAQ",
      intro: "Jeden záznam je jedna otázka a odpověď. Asistent z každého záznamu udělá jeden úsek; přístup k záznamu je nejpřísnější z přístupu tohoto FAQ a jeho zdrojů.",
      empty: "Zatím žádný záznam.",
      addHeading: "Nový záznam",
      editHeading: (n: number) => `Záznam ${n}`,
      question: "Otázka",
      questionHint: "Tak, jak ji lidé kladou — jedna věta.",
      variants: "Další znění otázky",
      variantsHint: "Každé na nový řádek. Pomáhají najít odpověď i na jinak položenou otázku.",
      answer: "Odpověď",
      answerHint: "Úplná odpověď, kterou by helpdesk poslal e-mailem. Bez osobních údajů.",
      sources: "Zdroje",
      sourcesHint: "Předpisy, ze kterých odpověď vychází. Když některý dostane nové znění, záznam se označí ke kontrole.",
      sourceDocument: "Dokument",
      sourceNone: "— bez zdroje —",
      sourceArticle: "Článek",
      sourceArticlePlaceholder: "např. čl. 12 odst. 3",
      audience: "Pro koho",
      audienceHint: "Role, kterým je odpověď určena, oddělené čárkou: klubový manažer, rozhodčí, trenér…",
      save: "Uložit záznam",
      add: "Přidat záznam",
      remove: "Odstranit",
      saved: "Záznam je uložen. Zveřejní se se zněním po schválení.",
      removed: "Záznam je odstraněn z konceptu.",
      stateNew: "nový, nezveřejněný",
      stateChanged: "změněný oproti zveřejněnému",
      statePublished: "zveřejněný",
      stateSourceChanged: "zdroj dostal nové znění — zkontroluj odpověď",
      access: (level: string) => `přístup: ${level}`,
      count: (n: number) => (n === 1 ? "1 záznam" : n >= 2 && n <= 4 ? `${n} záznamy` : `${n} záznamů`),
      editEntries: "Upravit záznamy",
      openEntries: "záznamy FAQ →",
      pdfNote: "PDF a text znění se skládají ze záznamů při každém uložení (ADR-011); nic se nenahrává.",
      publishNote: "Změny záznamů jsou koncept. Zveřejní se postupem znění na detailu dokumentu: údaje o znění, schválení, zveřejnění.",
      mdIntro: "Časté otázky a odpovědi. Odpověď vychází z uvedených předpisů ve znění platném ke dni zveřejnění.",
      mdQuestion: "Otázka",
      mdVariants: "Další znění otázky",
      mdAnswer: "Odpověď",
      mdSources: "Zdroje",
      mdAudience: "Pro koho",
      mdEmpty: "Zatím bez záznamů.",
      pdfPage: (n: number, total: number) => `strana ${n} z ${total}`,
    },
    upload: {
      sectionFile: "Soubor",
      sectionMeta: "Metadata",
      dropHint: "Přesuňte soubor sem, nebo ho vyberte.",
      pick: "Vybrat soubor",
      heading: "Nahrát dokument",
      intro: "Schvaluje a potvrzuje se PDF — tak, jak ho lidé uvidí, i s přílohami. K němu přidej upravitelný zdroj (Word, Excel…): z něj vznikne text pro vyhledávání a při dalším znění z něj budeš vycházet. Oba soubory se uloží tak, jak přišly.",
      file: "Soubor",
      errorBefore: "Dokument se nenahrál: ",
      errorFileAgain: "Vyberte soubor znovu — prohlížeč ho z bezpečnostních důvodů neuchová.",
      maxSize: mb => `nejvýše ${mb} MB`,
      oldFormatsBefore: "Staré ",
      oldFormatsMiddle: " a ",
      oldFormatsAfter: " převést nelze — ulož je ve Wordu nebo Excelu jako novější formát. Skenované PDF bez textu lze nechat přepsat jazykovým modelem až v editoru.",
      title: "Název",
      titlePlaceholder: "Súťažný poriadok futbalu SFZ",
      titleNote: "Objeví se doslovně v potvrzovací formulaci, ať je to tedy celý úřední název.",
      key: "Klíč dokumentu",
      keyPreview: "Identifikátor:",
      keyManualSummary: "Zadat klíč ručně",
      keyManualNote: "Klíč vzniká jednou a nikdy se nemění — žije v potvrzeních, auditu a exportech. Přejmenování dokumentu ho nemění.",
      keyTaken: "Identifikátor {id} je obsazený. Upravte název, nebo zadejte klíč ručně.",
      keysTaken: "Obsazené klíče v této organizaci: ",
      categoryNote: "Seskupuje dokumenty v knihovně a ve filtrech. Existující: ",
      moreFields: "Další údaje",
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
      submitPending: "Nahrávám a převádím…",
      submitPendingNote: "Soubor se převádí na text. U většího dokumentu to může trvat i minutu — stránku nezavírej.",
      change: "Změnit",
      optional: "nepovinné",
      pickPdfFirst: "Nejprve vyber PDF.",
      prefillFromWord: "Zdroj je dokument Word — prázdná pole se předvyplní z tabulky na jeho první straně (Schválil, Datum schválení, Datum účinnosti). Potvrdíš je na detailu.",
      pdfTitle: "PDF — schvalovaná podoba (povinné)",
      pdfNote: "Takto dokument uvidí schvalovatelé i zaměstnanci — včetně příloh, formulářů a obrázků. Ve Wordu: Soubor → Uložit jako → PDF.",
      sourceTitle: "Upravitelný zdroj (doporučeno)",
      sourceNote: "Word, Excel, Markdown nebo text. Z něj vznikne čistší text pro vyhledávání a je to předloha, ze které se připraví další znění.",
      noScriptLimit: mb => `bez JavaScriptu nejvýše ${mb} MB`,
      uploadingFile: "Nahrávám {name} — {percent} %",
      uploadFailed: "Nahrání selhalo:",
      fileTooLarge: "{name} má {mb} MB, strop je {maxMb} MB.",
    },
  },

  learning: {
    statusFilter: "Filtr podle stavu",
    off: {
      title: "Vzdělávání není pro vaši organizaci zapnuté",
      lead: "Kurzy, testy a certifikáty tu uvidíte, až ho organizace zapne. Povinné normy k potvrzení najdete v Úkolech.",
      admin: contact => `Modul zapíná provozovatel Contineo. Napište na ${contact}.`,
      tasks: "Otevřít úkoly",
      back: "Zpět na Přehled",
    },
    heading: "Vzdělávání",
    intro: "Kurzy, které máš přidělené, a otevřené kurzy, do kterých se můžeš zapsat.",
    empty: "Zatím tu nemáte žádný kurz",
    emptyNote: "Až vám organizace přidělí kurz nebo otevře kurz k zápisu, uvidíte ho tady. Nic není třeba dělat.",
    manageHeading: "Správa kurzů",
    manageIntro: "Kurzy, témata a smart:tagy organizace.",
    manageEmpty: "Zatím tu není žádný kurz.",
    manageEmptyNote: "Zakládání kurzů přibude v další části modulu.",
    testsHeading: "Testy",
    testsIntro: "Banka otázek, testy a výsledky testů, za které odpovídáš.",
    testsEmpty: "Zatím tu není žádný test.",
    testsEmptyNote: "Banka otázek a testy přibudou v další části modulu.",
    groupInProgress: "Rozpracované",
    groupToEnroll: "K zápisu",
    groupDone: "Dokončené",
    statusInProgress: "Rozpracovaný",
    statusAssigned: "Přidělený",
    statusOpen: "Otevřený k zápisu",
    statusDone: "Dokončený",
    continue: "Pokračovat",
    start: "Začít",
    enrol: "Zapsat se",
    certificate: "Certifikát",
    openCourse: "Otevřít kurz",
    next: (n, title) => `Dále: Část ${n} · ${title}`,
    assignedOn: (date, who) => `Přiděleno ${date} · ${who}`,
    assignedOnNoWho: date => `Přiděleno ${date}`,
    openNote: "Kurz je otevřený — zapsat se může kdokoli v organizaci.",
    noCertificate: "Kurz nevydává certifikát.",
    doneOn: date => `Dokončeno ${date}`,
    archivedNote: "Kurz byl archivován — dokončit ho můžete.",
    minutes: n => {
      const m = (k: number) => `${k} ${k === 1 ? "minuta" : k <= 4 ? "minuty" : "minut"}`
      const h = Math.floor(n / 60)
      if (!h) return `přibližně ${m(n)}`
      return `přibližně ${h} ${h === 1 ? "hodina" : h <= 4 ? "hodiny" : "hodin"}${n % 60 ? ` ${m(n % 60)}` : ""}`
    },
    parts: (n, required) => `${n} ${n === 1 ? "část" : n <= 4 ? "části" : "částí"}` +
      (required === n ? "" : `, z toho ${required} ${required === 1 ? "povinná" : required <= 4 ? "povinné" : "povinných"}`),
    issuesCertificate: "certifikát",
    progress: (done, total) => `${done} z ${total} povinných částí`,
    nothingWaiting: "Nic nečeká",
    nothingWaitingNote: "Všechny kurzy máte dokončené. Až přibude nový, uvidíte ho tady.",
    filterNone: names => `Filtru ${names} nevyhovuje žádný kurz.`,
    clearFilters: "Zrušit filtry",
    topic: "Téma",
    allTopics: "Všechna",
    smartTags: "smart:tagy",
    selected: n => `vybráno ${n}`,
    filterNote: "Různé klíče musí platit všechny, z hodnot jednoho klíče stačí jedna.",
    enrolled: title => `Jste zapsán do kurzu „${title}“.`,
    removeFilter: name => `Zrušit filtr ${name}`,
    course: {
      yourProgress: "Váš postup",
      countOf: (d, n) => `${d} z ${n}`,
      requiredParts: "povinných částí",
      startCourse: "Začít",
      continueHere: "Pokračovat zde",
      kvVersion: "Verze",
      kvEnrolled: "Zapsán od",
      enrolledVia: { assignment: "přidělením", self: "samozápisem" },
      kvLanguage: "Jazyk obsahu",
      kvEstimate: "Odhad času",
      kvCertificate: "Certifikát",
      kvOrder: "Pořadí částí",
      yes: "ano",
      no: "ne",
      orderSequential: "postupně",
      orderAny: "libovolně",
      aboutCourse: "O kurzu",
      partsHeading: "Části kurzu",
      partsNoteSequential: "Části se otevírají postupně.",
      partsNoteAny: "Části můžete procházet v libovolném pořadí.",
      partRequired: "Povinná",
      partOptional: "Nepovinná",
      blocks: n => `${n} ${n === 1 ? "blok" : n <= 4 ? "bloky" : "bloků"}`,
      blockTypes: { image: "obrázek", gallery: "galerie", document: "dokument", video: "video", videoExternal: "video externí" },
      mustWatchVideo: m => `povinné video ${m} ${m === 1 ? "minuta" : m <= 4 ? "minuty" : "minut"}`,
      partDoneOn: date => `Hotová ${date}`,
      partAvailable: "Dostupná",
      partLockedAfter: n => `Zpřístupní se po části ${n}`,
      partInProgress: "rozpracovaná",
      partInProgressVideo: p => `rozpracovaná — video zhlédnuto ${p} %`,
      testLabel: "Test",
      testRequired: "povinný",
      testOptional: "nepovinný",
      testNotStarted: "nespuštěný",
      testPassed: "prošel",
      noticeDone: date => `Kurz jste dokončili ${date}.`,
      noticeNewVersion: (v, date, mine) => `Kurz má novou verzi ${v} (zveřejněna ${date}). Dokončujete verzi ${mine}, do které jste se zapsali — nic není třeba dělat.`,
      noticeArchived: "Kurz byl archivován — dokončit ho můžete. Nikdo nový se do něj už nezapíše.",
      versionN: n => `verze ${n}`,
      enrolledSince: date => `zapsán od ${date}`,
      notEnrolledNote: "Kurz je otevřený — zapsat se může kdokoli v organizaci. Části se zpřístupní po zapsání.",
      previewNotice: v => `Náhled verze ${v} tak, jak ji uvidí student. Nic se nezapisuje a test nelze spustit.`,
      previewEdit: "Upravit kurz",
      previewSide: "Náhled — zápis a postup se v něm nevedou.",
    },
    part: {
      nextPart: "Další",
      docKicker: "Dokument z knihovny",
      openPdf: "Otevřít PDF",
      docDetail: "Detail v knihovně",
      docMissing: "Toto znění v knihovně už není.",
      externalChip: "Externí video · dokoukání se neověřuje",
      externalBad: "Video nelze vložit — adresa není podporovaná.",
      play: "Přehrát",
      pause: "Pozastavit",
      mute: "Ztlumit",
      unmute: "Zapnout zvuk",
      fullscreen: "Celá obrazovka",
      progress: "Průběh videa",
      mustWatchChip: "Povinné dokoukání · zhlédnuto {p} %",
      mustWatchNote: "Dopředu lze přetáčet jen po místo, které jste už viděli. Je třeba alespoň 90 %.",
      watchedChip: "Dokoukáno",
      noScriptNote: "Bez JavaScriptu se dokoukání nezaznamená.",
      testsHeading: "Testy této části",
      testStart: "Spustit",
      markDone: "Označit jako prošlé",
      markReady: "Po označení je část hotová.",
      nextPartLink: "Další část →",
      previewDock: "Náhled — část nelze označit jako prošlou a test se nespouští.",
      optionalTestNote: "Nepovinný test můžete udělat kdykoli.",
      testsJump: "Testy ↓",
      marked: "Část je označená jako prošlá.",
      partOf: (n, total) => `Část ${n} z ${total}`,
      docNewer: label => `Platné je už ${label}.`,
      markDisabledVideo: p => `Nejprve dokoukejte povinné video — zhlédnuto ${p} %, je třeba alespoň 90 %.`,
      markedWaitingTest: date => `Označeno ${date} · část bude hotová po složení povinného testu.`,
      partDone: date => `Část je hotová · ${date}`,
      requiredTestSummary: state => `Povinný test: ${state}`,
    },
    manage: {
      tabsLabel: "Správa kurzů",
      tabCourses: "Kurzy",
      tabTopics: "Témata",
      tabTags: "smart:tagy",
      newCourse: "Nový kurz",
      statusAll: "Všechny",
      statusDraft: "Koncept",
      statusPublished: "Zveřejněný",
      statusArchived: "Archiv",
      colCourse: "Kurz",
      colTopic: "Téma",
      colStatus: "Stav",
      colEnrolled: "Zapsaní",
      colCompleted: "Dokončili",
      colUpdated: "Upraveno",
      edit: "Upravit",
      openEnrollment: "otevřený k zápisu",
      courseTitle: "Název kurzu",
      courseKey: "Klíč v adrese",
      keyHint: "Klíč je v adrese kurzu (/learning/…) a nemění se ani se změnou názvu.",
      keyTaken: "Kurz s takovým klíčem už existuje.",
      topic: "Téma",
      topicNone: "Nejprve přidejte téma v záložce Témata.",
      create: "Vytvořit koncept",
      cancel: "Zrušit",
      emptyText: "Kurz vznikne jako koncept — části, bloky a nastavení doplníte před zveřejněním. Téma musí existovat v záložce Témata.",
      topicsHeading: "Témata kurzů",
      rename: "Přejmenovat",
      retire: "Vyřadit",
      restore: "Vrátit",
      retired: "vyřazené",
      newTopic: "Nové téma",
      topicName: "Název tématu",
      topicKey: "Klíč",
      addTopic: "Přidat téma",
      topicsEmpty: "Zatím tu není žádné téma. Kurz potřebuje právě jedno.",
      topicAdded: "Téma je přidané.",
      topicRenamed: "Téma je přejmenované.",
      topicRetired: "Téma je vyřazené z nabídky. Kurzy si ho ponechají.",
      topicRestored: "Téma je zpět v nabídce.",
      save: "Uložit",
      tagsIntro: "smart:tag se tu nevytváří — vzniká tam, kde se poprvé napíše: u kurzu, otázky nebo testu.",
      tagsEmpty: "Zatím se nepoužívá žádný smart:tag.",
      renameKey: "Přejmenovat klíč",
      newValue: "Nový zápis",
      mergeButton: "Sloučit",
      mergeInto: "Sloučit do…",
      clearSelection: "Zrušit výběr",
      mergeSelected: "Sloučit vybrané",
      whatStays: "Co zůstane",
      newEntry: "Nový zápis",
      keyLabel: "Nový název klíče",
      selectTag: "Vybrat ke sloučení",
      tagPlaceholder: "Klíč: Hodnota",
      topicCourses: n => `${n} ${n === 1 ? "kurz" : n >= 2 && n <= 4 ? "kurzy" : "kurzů"}`,
      enrolledCompleted: (e, c) => `${e} ${e === 1 ? "zapsaný" : e >= 2 && e <= 4 ? "zapsaní" : "zapsaných"} · ${c} ${c === 1 ? "dokončil" : c >= 2 && c <= 4 ? "dokončili" : "dokončilo"}`,
      usage: (c, q, t) => `kurzy ${c} · otázky ${q} · testy ${t}`,
      impact: (c, q, t) => {
        const n = c + q + t
        const k = (x: number, one: string, few: string, many: string) => `${x} ${x === 1 ? one : x >= 2 && x <= 4 ? few : many}`
        return `Změní se všude — na ${n} ${n === 1 ? "místě" : "místech"} (${k(c, "kurz", "kurzy", "kurzů")}, ${k(q, "otázka", "otázky", "otázek")}, ${k(t, "test", "testy", "testů")}), včetně filtrů sekcí testů.`
      },
      exists: label => `„${label}“ už existuje — sloučí se do jednoho tagu.`,
      renamed: label => `Přejmenováno na „${label}“.`,
      selected: n => `Vybráno ${n}`,
      mergeTitle: n => `Sloučit ${n} ${n <= 4 ? "smart:tagy" : "smart:tagů"} do jednoho`,
      mergeResult: target => `Vybrané tagy zmizí, zůstane „${target}“. Kurz, otázka či test, který jich měl víc, dostane „${target}“ jednou.`,
      merged: (n, target) => `Sloučeno: ${n} ${n <= 4 ? "tagy" : "tagů"} → ${target}.`,
    },
    edit: {
      settingsSaved: "Nastavení jsou uložená.",
      stepsLabel: "Stav verze kurzu",
      missingHeading: "Ke zveřejnění chybí",
      readyHeading: "Připraveno ke zveřejnění",
      checkParts: "Části a bloky",
      checkLegal: "Právní základ (Nastavení)",
      checkTopic: "Téma",
      publishDisabledNote: "Nejprve doplňte, co chybí.",
      publishedLead: "Zveřejněná verze se nemění. Změna = nová verze (kopie).",
      newVersion: "Nová verze",
      archive: "Archivovat",
      restore: "Obnovit jako novou verzi",
      cannotPublish: "Kurz zatím nelze zveřejnit — podívejte se, co chybí.",
      archived: "Kurz je archivovaný. Rozpracovaní ho dokončí.",
      tabParts: "Části",
      tabSettings: "Nastavení",
      tabPeople: "Zapsaní",
      partsHeading: "Části kurzu",
      up: "Posunout výš",
      down: "Posunout níž",
      editPart: "Upravit",
      view: "Zobrazit",
      newPart: "Nová část",
      partTitle: "Název části",
      required: "Povinná",
      addPart: "Přidat část",
      noParts: "Kurz zatím nemá žádnou část",
      allParts: "← Všechny části",
      removePart: "Odebrat část",
      save: "Uložit",
      minutes: "Odhad času (minuty)",
      summary: "Krátký popis",
      blocksHeading: "Bloky",
      noBlocks: "Část zatím nemá žádný blok.",
      addBlock: "Přidat blok",
      blockType: "Typ bloku",
      markdown: "Text",
      alt: "Popis obrázku",
      altGallery: "Popis obrázků",
      caption: "Popisek pod obrázkem",
      document: "Dokument z knihovny",
      videoSource: "Zdroj videa",
      sourceUpload: "Nahrát MP4 nebo WebM (do 25 MB)",
      sourceExternal: "Externí odkaz",
      url: "Adresa videa (YouTube, Vimeo, https)",
      mustWatch: "Povinné dokoukání",
      mustWatchNote: "Přetáčení dopředu se vypne; část lze označit až po zhlédnutí 90 %.",
      externalWarn: "U externího videa se dokoukání neověří. Pokud ho potřebujete, nahrajte MP4.",
      removeBlock: "Odebrat",
      add: "Přidat",
      mediaImage: "Obrázek (JPG, PNG, WebP, GIF)",
      mediaVideo: "Video MP4 nebo WebM (do 25 MB)",
      mediaNote: "Soubor se nahraje při přidání bloku.",
      progressTitle: "Nahrávám soubor",
      uploading: "Nahrávám {name} — {percent} %",
      uploadFailed: "Nahrání selhalo:",
      tooLarge: "{name} má {mb} MB, strop je {maxMb} MB.",
      testsHeading: "Testy části",
      testsLater: "Testy půjde přiřadit, až přibude banka otázek a testů.",
      mustWatchShort: "povinné dokoukání",
      cancel: "Zrušit",
      editBlock: "Upravit",
      noDocuments: "V knihovně zatím není dokument s platným zněním.",
      optional: "Nepovinná",
      steps: ["Koncept", "Zveřejněno", "Archiv"],
      stepSub: { draft: n => `verze ${n}`, published: n => `verze ${n}`, archived: n => `verze ${n}` },
      blockTypes: { text: "Text", image: "Obrázek", gallery: "Galerie", document: "Dokument z knihovny", video: "Video", videoExternal: "Video externí" },
      problem: (code, part) => ({
        noTitle: "Kurz nemá název.",
        noParts: "Kurz nemá žádnou část.",
        noRequiredPart: "Alespoň jedna část musí být povinná.",
        emptyPart: `Část „${part}“ nemá žádný blok.`,
        badPartKey: `Část „${part}“ má neplatný klíč.`,
        duplicatePartKey: `Část „${part}“ je v kurzu dvakrát.`,
        videoWithoutDuration: `Povinné video v části „${part}“ nemá délku — nahrajte ho znovu.`,
        mustWatchExternal: `Externí video v části „${part}“ nemůže mít povinné dokoukání.`,
        testNotReady: `Test v části „${part}“ není připravený.`,
        noIssuer: "Chybí vydavatel certifikátu.",
        noLegalBasis: "Chybí právní základ — doplňte ho v Nastavení.",
      } as Record<string, string>)[code] ?? code,
      publishButton: n => `Zveřejnit verzi ${n}`,
      keepPublished: (prev, next) => `Verze ${prev} zůstává zveřejněná, dokud nezveřejníte tuto. Zapsaní ve v${prev} ji dokončí; noví se zapíšou do v${next}.`,
      archivedLead: n => `Nikdo nový se nezapíše. Rozpracovaní dokončí svou verzi (${n}).`,
      published: n => `Verze ${n} je zveřejněná.`,
      newVersionStarted: n => `Vznikl koncept verze ${n} — kopie poslední verze.`,
      blocksTests: (b, t) => `${b} ${b === 1 ? "blok" : b >= 2 && b <= 4 ? "bloky" : "bloků"}${t ? ` · ${t} ${t === 1 ? "test" : t <= 4 ? "testy" : "testů"}` : ""}`,
      readOnly: n => `Verze ${n} je zveřejněná — části a bloky jsou jen ke čtení. Změny: Nová verze.`,
      savedAt: date => `Uloženo ${date}`,
      statusDraftReady: v => `Koncept v${v} · připravený ke zveřejnění`,
      statusDraftMissing: (v, n) => `Koncept v${v} · ${n === 1 ? "chybí 1 věc" : n <= 4 ? `chybí ${n} věci` : `chybí ${n} věcí`}`,
      statusPublished: v => `Zveřejněno v${v}`,
      statusArchived: "Archiv",
      statusLabel: "Stav verze — přehled kurzu",
      previewAsStudent: "Náhled jako student",
      archiveOpen: "Archivovat…",
      archiveTitle: t => `Archivovat kurz ${t}?`,
      archiveNoNew: "Nikdo nový se nezapíše, kurz zmizí z nabídky.",
      archiveInProgress: (n, v) => `${n} ${n === 1 ? "rozpracovaný ho dokončí" : "rozpracovaní ho dokončí"} ve verzi ${v}.`,
      archiveKeeps: "Certifikáty a výsledky zůstávají.",
      archiveRestoreNote: "Kurz lze později obnovit jako novou verzi.",
      archiveButton: "Archivovat kurz",
      removePartOpen: "Odstranit část…",
      removePartTitle: (t, b, n) => `Odstranit část „${t}“${b || n ? ` s ${[b ? `${b} ${b === 1 ? "blokem" : "bloky"}` : "", n ? `${n} ${n === 1 ? "testem" : "testy"}` : ""].filter(Boolean).join(" a ")}` : ""}?`,
      removePartNote: v => `Část zmizí z konceptu v${v}. Zveřejněné verze se nemění.`,
      removePartButton: "Odstranit část",
      blockMenuNote: { document: "znění", video: "MP4 / odkaz" },
      newBlockHeading: t => `Nový blok · ${t}`,
      blockHeading: (n, t) => `Blok ${n} · ${t}`,
      saveBlock: "Uložit blok",
      removeBlockButton: "Odstranit blok",
      removeBlockNote: (d, p) => `Blok zmizí z konceptu v${d}.${p ? ` Verze ${p} se nemění.` : ""}`,
      noEditBlock: "Tento typ bloku nelze upravit — odstraňte ho a přidejte nový.",
      sourceExternalSub: "YouTube, Vimeo, stream",
      partGroup: "Část",
      savePart: "Uložit část",
      saveTests: "Uložit testy",
      testsSaved: "Testy části jsou uloženy.",
      partSaved: "Část je uložena.",
    },
    settings: {
      title: "Název kurzu",
      keyNote: "Klíč v adrese se po vytvoření nemění.",
      subtitle: "Podtitul",
      description: "Popis",
      topic: "Téma",
      language: "Jazyk obsahu",
      languageNote: "Kurz v jiném jazyce je jiný kurz.",
      estimate: "Odhad času (minuty)",
      smartTags: "smart:tagy",
      groupFlow: "Průběh",
      sequential: "Části jdou postupně",
      sequentialNote: "Další část se otevře až po hotové předchozí povinné.",
      openEnrollment: "Otevřený k zápisu",
      openEnrollmentNote: "Kurz se nabídne každému v organizaci v „K zápisu“.",
      issuesCertificate: "Vydává certifikát",
      signerName: "Podepisuje za vydavatele — jméno",
      signerRole: "Funkce",
      groupLegal: "Právní základ",
      legalNote: "Postup, pokusy a výsledky kurzu jsou osobní údaje — bez právního základu se kurz nezveřejní.",
      legalNone: "— vyberte —",
      save: "Uložit nastavení",
      tagPlaceholder: "Klíč: Hodnota",
      tagNewKey: "Nový klíč „{k}“",
      tagNewValue: "Nová hodnota „{v}“",
      tagRemove: "Odebrat {t}",
      tagValues: "hodnoty: {n}",
      tagField: "smart:tagy kurzu",
      tagNoScript: "Jeden smart:tag na řádek ve tvaru Klíč: Hodnota.",
      none: "—",
      readOnly: n => `Verze ${n} je zveřejněná — nastavení jsou jen ke čtení. Změny: Nová verze.`,
    },
    people: {
      filterAll: "Všichni",
      notStarted: "Nezačali",
      inProgress: "Rozpracovaní",
      done: "Dokončili",
      assign: "Přidělit kurz",
      exportCsv: "Export CSV",
      colName: "Jméno",
      colEmail: "E-mail",
      colDepartment: "Oddělení",
      colEnrollment: "Zápis",
      colState: "Stav",
      colActivity: "Poslední aktivita",
      stateNotStarted: "nezačal",
      empty: "Do kurzu zatím není nikdo zapsaný.",
      assignHeading: "Přidělit kurz",
      everyone: "Všem v organizaci",
      everyoneNote: "i těm, kteří přibudou, když se přidělí znovu",
      departments: "Oddělením",
      groups: "Skupinám",
      tracks: "Trase",
      tracksNote: "Zapíšou se lidé, kteří trasu mají — jako u normy.",
      check: "Zkontrolovat dopad",
      notPublished: "Přidělit lze jen zveřejněný kurz.",
      nobody: "Výběru neodpovídá nikdo.",
      cancel: "Zrušit",
      stateProgress: (d, t) => `${d} z ${t} částí`,
      stateDone: date => `dokončil ${date}`,
      summary: (n, v, m) => `Zapíše se ${n} ${n === 1 ? "člověk" : n >= 2 && n <= 4 ? "lidé" : "lidí"} do verze ${v}${m ? ` · ${m} ${m === 1 ? "je" : "jsou"} už ${m === 1 ? "zapsaný" : "zapsaní"} a nic se ${m === 1 ? "mu" : "jim"} nezmění` : ""}.`,
      assignButton: n => `Přidělit ${n} ${n === 1 ? "člověku" : "lidem"}`,
      assigned: (n, m) => `Zapsaní noví: ${n}, už zapsaní: ${m}.`,
    },
    tests: {
      tabsLabel: "Testy",
      tabTests: "Testy",
      tabQuestions: "Banka otázek",
      tabResults: "Výsledky",
      newTest: "Nový test",
      testTitle: "Název testu",
      testKey: "Klíč testu",
      create: "Vytvořit test",
      cancel: "Zrušit",
      statusAll: "Všechny",
      statusReady: "Připravené",
      statusDraft: "Koncepty",
      statusRetired: "Vyřazené",
      tagReady: "Připravený",
      tagDraft: "Koncept",
      tagShort: "Nedostatek otázek",
      tagRetired: "Vyřazený",
      colTest: "Test",
      colSections: "Sekce",
      colQuestions: "Otázek",
      colPassing: "Hranice",
      colResponsible: "Odpovědné osoby",
      colStatus: "Stav",
      edit: "Upravit",
      nobody: "nikdo — nelze připravit",
      testsEmpty: "Zatím tu není žádný test.",
      testsEmptyNote: "Test je recept: sekce vybírají otázky z banky podle smart:tagů.",
      groupBase: "Základ",
      instructions: "Instrukce",
      responsibleLegend: "Odpovědné osoby",
      responsibleNote: "Vidí výsledky svého testu a smějí resetovat pokusy. Personální oddělení výsledky nevidí.",
      noResponsible: "Bez odpovědné osoby test nelze připravit.",
      groupSections: "Sekce",
      sectionFilter: "smart:tagy sekce",
      sectionCount: "Počet otázek",
      showInBank: "Zobrazit v bance",
      addQuestions: "Přidat otázky →",
      addSection: "Přidat sekci",
      removeSection: "Odstranit",
      sectionsNote: "Otázky se losují při každém pokusu, odpovědi se míchají. Různé klíče musí platit všechny, z hodnot jednoho klíče stačí jedna.",
      groupRules: "Pravidla",
      passing: "Hranice úspěšnosti (%)",
      timeLimit: "Časový limit (minuty)",
      maxAttempts: "Nejvýše pokusů",
      pause: "Pauza mezi pokusy (minuty)",
      showAnswers: "Kdy ukázat správné odpovědi",
      showNever: "Nikdy",
      showAfterSubmit: "Po odevzdání",
      showAfterPass: "Po složení",
      showAfterLast: "Po vyčerpání pokusů",
      emptyMeansNone: "Prázdné = bez omezení.",
      testTags: "smart:tagy testu (pro hledání, losování nemění)",
      save: "Uložit",
      statusCard: "Stav testu",
      checkResponsible: "Odpovědné osoby",
      checkSections: "Každá sekce má dost otázek",
      checkRules: "Pravidla vyplněna",
      statusNote: "Říká se to při uložení, ne při pokusu.",
      usedIn: "Použito v",
      usedNone: "Test zatím není v žádném kurzu.",
      retire: "Vyřadit test",
      restore: "Vrátit test",
      savedReady: "Test je uložený a připravený.",
      savedDraft: "Test je uložený jako koncept — podívejte se, co chybí.",
      newQuestion: "Nová otázka",
      importCsv: "Import CSV",
      exportCsv: "Export CSV",
      bankEmpty: "Banka otázek je prázdná",
      bankEmptyNote: "Přidejte otázku nebo nahrajte CSV.",
      filterType: "Typ",
      filterStatus: "Stav",
      filterTags: "smart:tagy",
      statusActive: "Aktivní",
      statusRetiredQ: "Vyřazené",
      clearFilters: "Zrušit filtry",
      colQuestion: "Otázka",
      colType: "Typ",
      colWeight: "Váha",
      questionText: "Znění",
      media: "Obrázky a videa v otázce",
      mediaNote: "Obrázky a videa se nahrají při uložení otázky.",
      removeMedia: "Odebrat",
      mediaAlt: "Popis obrázku (pro nové obrázky)",
      answers: "Odpovědi",
      correct: "správná",
      multipleNote: "Student uvidí větu „Tato otázka má více správných odpovědí“.",
      trueLabel: "Pravda",
      falseLabel: "Nepravda",
      expected: "Očekávaná odpověď",
      alternatives: "I takto je správně",
      shortNote: "Porovnává se bez diakritiky a velikosti písmen.",
      explanation: "Vysvětlení",
      explanationNote: "Ukáže se po odevzdání, pokud to test dovoluje.",
      weight: "Váha",
      difficulty: "Obtížnost",
      tagsLabel: "smart:tagy (alespoň jeden)",
      tagRequiredNote: "Bez smart:tagu otázku žádný test nevylosuje.",
      saveQuestion: "Uložit otázku",
      retireQ: "Vyřadit",
      restoreQ: "Vrátit",
      questionSaved: "Otázka je uložená.",
      answerMediaLater: "Obrázky a videa v odpovědích přibudou v další úpravě.",
      importHeading: "Import otázek z CSV",
      importNote: "UTF-8, oddělovač středník, první řádek hlavička — sloupce id, type, text, answer_1 … answer_8, correct, explanation, weight, difficulty, tags.",
      importFile: "Soubor CSV",
      importUpload: "Nahrát a zkontrolovat",
      importErrorsNote: "Při chybě se neimportuje nic — opravte soubor a nahrajte ho znovu.",
      colLine: "Řádek",
      colColumn: "Sloupec",
      colProblem: "Chyba",
      mediaNoteImport: "Obrázky a videa se přidají u otázky po importu.",
      importExpired: "Nahraný soubor už není k dispozici — nahrajte ho znovu.",
      templateLink: "Stáhnout vzor CSV",
      noResponsiblePeople: "V organizaci není nikdo, koho by šlo určit.",
      keyTaken: "Test s takovým klíčem už existuje.",
      up: "Posunout výš",
      down: "Posunout níž",
      required: "povinný",
      optional: "nepovinný",
      types: { single: "Jedna správná", multiple: "Více správných", true_false: "Pravda / nepravda", short_text: "Krátký text" },
      difficulties: { easy: "Lehká", medium: "Střední", hard: "Těžká" },
      sectionTitle: n => `Sekce ${n}`,
      enough: n => `V bance vyhovuje ${n} ${n === 1 ? "otázka" : n >= 2 && n <= 4 ? "otázky" : "otázek"}`,
      short: (n, missing) => `V bance vyhovuje jen ${n} ${n === 1 ? "otázka" : n >= 2 && n <= 4 ? "otázky" : "otázek"} — chybí ${missing}`,
      usedRow: (course, part, required, v) => `${course} · ${part} · ${required ? "povinný" : "nepovinný"} · verze testu ${v ?? "—"}`,
      version: n => `verze ${n}`,
      answer: n => `Odpověď ${n}`,
      usage: (t, a) => `Použita v ${t} ${t === 1 ? "testu" : "testech"} · ${a} ${a === 1 ? "pokus ji cituje" : a >= 2 && a <= 4 ? "pokusy ji citují" : "pokusů ji cituje"} snímkem`,
      importSummary: (total, created, updated, errors) => `${total} otázek · ${created} nových · ${updated} úprav · ${errors} ${errors === 1 ? "chyba" : errors >= 2 && errors <= 4 ? "chyby" : "chyb"}`,
      newTags: list => `Nové smart:tagy: ${list}`,
      importRun: n => `Importovat ${n} ${n === 1 ? "otázku" : n >= 2 && n <= 4 ? "otázky" : "otázek"}`,
      imported: (c, u) => `Importováno: nových ${c}, upravených ${u}.`,
    },
    attempt: {
      factQuestions: "Otázek",
      factToPass: "Ke složení",
      factTime: "Časový limit",
      factAttempt: "Pokus",
      noLimit: "bez limitu",
      ruleDraw: "Otázky se při každém pokusu vylosují a odpovědi zamíchají.",
      ruleSave: "Odpovědi se průběžně ukládají; čas běží dál i při výpadku.",
      start: "Spustit test",
      blockedPassed: "Test máte složený.",
      backToPart: "Zpět na část",
      saving: "ukládá se…",
      saveFailed: "neuloženo — zkoušíme znovu",
      multipleNote: "Tato otázka má více správných odpovědí — označte všechny.",
      shortNote: "Na diakritice a velkých písmenech nezáleží.",
      videoNote: "Video nemusíte dokoukat — přetáčet můžete volně, čas testu běží dál.",
      trueLabel: "Pravda",
      falseLabel: "Nepravda",
      prev: "← Zpět",
      next: "Dále →",
      review: "Přehled odpovědí",
      reviewHeading: "Přehled odpovědí",
      unanswered: "nezodpovězená",
      answered: "zodpovězená",
      submit: "Odevzdat test",
      confirmTitle: "Odevzdat test?",
      confirmAll: "Všechny otázky jsou zodpovězené. Po odevzdání se odpovědi nedají změnit.",
      cancelReview: "Zpět k otázkám",
      timeUp: "Čas vypršel — test se uzavřel s odpověďmi, které jste stihli uložit.",
      submitted: "Test je odevzdaný.",
      showResult: "Zobrazit výsledek",
      passedNotice: "Test jste složili.",
      passedWord: "Prošel",
      failedWord: "Neprošel",
      factPassing: "Hranice",
      factRemaining: "Zbývá pokusů",
      factNext: "Další pokus",
      unlimited: "bez omezení",
      now: "hned",
      retry: "Zkusit znovu",
      retryNote: "Otázky se vylosují znovu.",
      toCourse: "Přehled kurzu",
      reviewTitle: "Přehled otázek",
      detailsPurged: "Otázky a odpovědi tohoto pokusu byly rok po dokončení kurzu odstraněny. Výsledek zůstává.",
      filterAll: "Všechny",
      filterWrong: "Nesprávné",
      yourAnswer: "Vaše odpověď",
      correctAnswer: "Správná odpověď",
      noAnswer: "bez odpovědi",
      hidden: "Správné odpovědi se nezobrazují",
      attemptsSide: "Vaše pokusy",
      whoSees: "Kdo vidí výsledek",
      continueTest: "Pokračovat",
      result: "Výsledek",
      tryAgain: "Zkusit znovu",
      assignTest: "Přiřadit test",
      testRequired: "Povinný",
      removeTest: "Odebrat",
      noReadyTests: "Zatím není žádný připravený test.",
      intro: "Úvod",
      answerLabel: "Odpověď",
      multipleShort: "více správných",
      factDuration: "Čas",
      minutes: n => `${n} min`,
      attemptOf: (n, m) => (m ? `${n} z ${m}` : `${n}`),
      ruleShow: { never: "Správné odpovědi se nezobrazují.", after_submit: "Správné odpovědi uvidíte po odevzdání.", after_pass: "Správné odpovědi uvidíte po složení testu.", after_last_attempt: "Správné odpovědi uvidíte po posledním pokusu." },
      previous: (date, pct, passed) => `Předchozí pokus ${date}: ${pct} % — ${passed ? "prošel" : "neprošel"}.`,
      blockedPause: time => `Další pokus je možný v ${time} — test má pauzu mezi pokusy.`,
      blockedExhausted: (n, names) => `Využili jste ${n} z ${n} pokusů. Další pokus může povolit odpovědná osoba testu${names ? ` — ${names}` : ""}.`,
      questionOf: (n, m) => `Otázka ${n} / ${m}`,
      remaining: t => `zbývá ${t}`,
      saved: t => `✓ uloženo ${t}`,
      questionHead: (n, m, w) => `Otázka ${n} z ${m}${w > 1 ? ` · váha ${w}` : ""}`,
      reviewUnanswered: n => `Přehled odpovědí · ${n} ${n === 1 ? "nezodpovězená" : n >= 2 && n <= 4 ? "nezodpovězené" : "nezodpovězených"}`,
      confirmText: (n, list) => `Nezodpovězené otázky: ${n} (${list}). Po odevzdání se odpovědi nedají změnit.`,
      noscriptDeadline: (start, end) => `Test jste spustili v ${start} — odevzdejte ho do ${end}. Po tomto čase server přijme jen to, co už bylo odesláno.`,
      kicker: (title, n, m, date) => `Test: ${title} · pokus ${n}${m ? ` z ${m}` : ""} · ${date}`,
      partDoneNotice: title => `Část „${title}“ je hotová.`,
      failedNotice: (missing, pass) => `Neprošli jste — ${missing === 1 ? "chybí 1 procentní bod" : missing >= 2 && missing <= 4 ? `chybí ${missing} procentní body` : `chybí ${missing} procentních bodů`} do hranice ${pass} %.`,
      points: (p, max) => `${p} z ${max} bodů`,
      passMark: p => `hranice ${p} %`,
      hiddenReason: { never: "Test správné odpovědi neukazuje.", after_submit: "Ukážou se po odevzdání.", after_pass: "Ukážou se po složení testu.", after_last_attempt: "Ukážou se po posledním pokusu." },
      wrongCount: n => `Nesprávné odpovědi: ${n}.`,
      whoSeesText: names => `Vy a odpovědné osoby testu${names ? ` (${names})` : ""}. Personální oddělení skóre nevidí.`,
      duration: s => `${Math.floor(s / 60)} min ${s % 60} s`,
      testOpen: (time, q, total) => `rozpracovaný · ${time ? `zbývá ${time}` : "bez časového limitu"} · otázka ${q} z ${total}`,
      testPassedPct: p => `prošel ${p} %`,
      testFailedPct: p => `neprošel ${p} %`,
      nextAttemptAt: t => `další pokus v ${t}`,
      attemptsLeft: (r, m) => `zbývají ${r} z ${m}`,
      testMeta: (q, pass, att, names) => `${q} otázek · hranice ${pass} %${att ? ` · ${att} pokusy` : ""}${names ? ` · odpovídá ${names}` : ""}`,
    },
    results: {
      selectTest: "Test",
      exportCsv: "Export CSV",
      colPerson: "Osoba",
      colContext: "Kurz / část",
      colDate: "Datum",
      colAttempt: "Pokus",
      colScore: "Skóre",
      colResult: "Výsledek",
      openState: "rozpracovaný",
      resetState: "resetovaný",
      reset: "Resetovat",
      resetText: "Pokusy se nesmažou — označí se jako resetované a člověk může test zkusit znovu. Zapíše se do auditu.",
      reason: "Důvod (povinný)",
      resetButton: "Resetovat pokusy",
      empty: "Test zatím nikdo nezkoušel.",
      cancel: "Zrušit",
      noTests: "Neodpovídáte za žádný test.",
      show: "Zobrazit",
      alsoResponsible: names => `Odpovídají také: ${names}`,
      resetTitle: name => `Resetovat pokusy — ${name}`,
      resetDone: n => `Resetované pokusy: ${n}.`,
    },
    cert: {
      backToCertificate: "Zpět na certifikát",
      registrationNumber: (n: string) => `IČO ${n}`,
      kicker: "Certifikát o absolvování kurzu",
      valid: "Platný",
      revoked: "Odvolaný",
      number: "Číslo",
      completed: "Datum dokončení",
      issuer: "Vydal",
      print: "Tisknout",
      downloadPdf: "Stáhnout PDF",
      backToCourse: "Zpět na kurz",
      verifyHeading: "Ověření",
      verifyNote: "Kdo má odkaz, uvidí číslo, kurz, datum a vydavatele — bez vašeho jména.",
      copy: "Kopírovat odkaz",
      revokedPdf: "U odvolaného certifikátu se PDF ani tisk nenabízí.",
      sideVerify: "Co ověření ukáže",
      sideVerifyText: "Číslo, kurz, datum dokončení a vydavatele. Jméno ne.",
      sideKeep: "Uchování",
      sideKeepText: "Vydaný certifikát se nemaže a platí i po skončení vztahu se svazem. Číslo zůstane ověřitelné.",
      notYet: "Certifikát se vydá po dokončení kurzu.",
      noCertificate: "Kurz nevydává certifikát.",
      show: "Zobrazit certifikát",
      vTitle: "Ověření certifikátu",
      vCourse: "Kurz",
      vIssuer: "Vydavatel",
      vNameNote: "Jméno držitele se při ověření nezobrazuje. Porovnejte ho se jménem na certifikátu, který vám byl předložen.",
      vNotFound: "Certifikát se nenašel",
      vNotFoundText: "Zkontrolujte odkaz nebo ho otevřete znovu z certifikátu.",
      vSecurity: "Z bezpečnostních důvodů neprozradíme, zda certifikát s tímto číslem existuje.",
      vFooter: "Ověření přes Contineo",
      pdfTitle: "CERTIFIKÁT",
      pdfSub: "o absolvování kurzu",
      pdfVerify: "Ověření",
      signature: "podpis",
      colCertificate: "Certifikát",
      revoke: "Odvolat",
      revokeText: "Odvolání nelze vrátit. Veřejné ověření ukáže „odvolaný“ bez důvodu; držitel důvod uvidí.",
      revokeReason: "Důvod (povinný)",
      revokeButton: "Odvolat certifikát",
      revokedMsg: "Certifikát je odvolaný.",
      cancel: "Zrušit",
      printNote: "Tisk nastavte na A4 na šířku. PDF s QR kódem si stáhnete na stránce certifikátu.",
      completedCourse: (title, v, s) => `${completedVerb(s)} kurz ${title} (verze ${v})`,
      revokedNotice: (date, reason) => `Certifikát byl odvolán ${date}. Důvod: ${reason}`,
      vValid: issuer => `Certifikát je platný — vydal ho ${issuer} a nebyl odvolán.`,
      vRevoked: date => `Certifikát byl odvolán — ${date}.`,
      pdfConfirms: org => `${org} potvrzuje, že`,
      pdfCompleted: (title, s) => `úspěšně ${completedVerb(s)} kurz ${title}`,
      pdfMeta: (v, parts, tests, date) => `verze ${v} · ${parts} ${parts === 1 ? "část" : parts <= 4 ? "části" : "částí"}${tests ? ` · ${tests} ${tests === 1 ? "test složen" : tests <= 4 ? "testy složeny" : "testů složeno"}` : ""} · dokončeno ${date}`,
      issuedOn: date => `Vydáno ${date}`,
      revokeTitle: name => `Odvolat certifikát — ${name}`,
    },
  },
  },

  en: {
  common: {
    saveBarNote: "Saves every section on this page.",
    moreActions: "More actions",
    domainsPlaceholder: "example.com\nmarketing.example.com",
    noticeConfirm: "OK",
    empty: {
      filtered: "Nothing matches the filter",
      none: "Nothing here yet",
      clearFilters: "Clear filters",
    },
    pdf: {
      loading: "Loading PDF…",
      failed: "The PDF could not be shown on the page. Open it with the link above.",
      page: "Page {page} of {pages}",
    },
    pending: {
      adding: "Adding…",
      sending: "Sending e-mails…",
    },
  },
  onboarding: {
    openPdf: "Open PDF",
    listHeading: "Documents to acknowledge",
    listIntro: "Read each document and confirm that you have familiarised yourself with it. An acknowledgement is tied to a specific version — when a new one is issued, you will be asked again.",
    emptyTitle: "Nothing to acknowledge",
    emptyText: "When someone assigns you a document or adds you to a track, it will appear here with its deadline. Nobody is waiting on you right now.",
    assignedHeading: "Assigned documents",
    progress: (done, total) => `${done} of ${total} done`,
    step: (order, total) => `Step ${order} of ${total}`,
    continueHere: "continue here",
    trackComplete: "track complete",
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
    version: (_label, from) => `version effective from ${from}`,
    readingElapsed: t => `Reading time: ${t}`,
    readingNote: "It is recorded, informative, and not part of the acknowledgement.",
    readingSeconds: n => `${n} s`,
    readingMinutes: n => (n === 1 ? "1 minute" : `${n} minutes`),
    confirmHeading: "Acknowledgement",
    confirmButton: "I confirm",
    confirmPending: "Saving…",
    confirmed: "Acknowledged. Thank you.",
    confirmedAt: (when) => `You acknowledged this on ${when}.`,
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
      version: label => `${label}`,
      waitingSince: d => `waiting since ${d}`,
      dueBy: d => `by ${d}`,
      dueToday: "due today",
      dueOver: n => `${n} ${n === 1 ? "day" : "days"} overdue`,
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
    statement: (title, effectiveFrom) =>
      `I confirm that I have read the document "${title}" in the version effective from ${effectiveFrom}, ` +
      `that I understand its contents and undertake to comply with it.`,
    email: {
      subject: org => `Sign in — ${org}`,
      heading: org => `Sign in — ${org}`,
      intro: "Click to sign in.",
      button: "Sign in",
      validity: "The link is valid for 24 hours and can be used once. If you did not request it, ignore this e-mail — nothing happens without clicking.",
      fallbackNote: "If the link does not work, copy it into your browser:",
      subtitle: "Internal portal",
    },
    reminderEmail: {
      subject: organisation => `Reminder: documents not acknowledged — ${organisation}`,
      subtitle: "Reminder",
      intro: count => count === 1
        ? "One document is still waiting for your acknowledgement."
        : `${count} documents are still waiting for your acknowledgement.`,
      itemLine: (label, days) => `${label}, waiting ${daysEn(days)}`,
      effectiveLine: date => `version effective from ${date}`,
      noticeSubject: organisation => `To acknowledge: documents — ${organisation}`,
      noticeSubtitle: "To acknowledge",
      noticeIntro: count => count === 1
        ? "One document is waiting for your acknowledgement."
        : `${count} documents are waiting for your acknowledgement.`,
      noticeItemLine: label => `${label}`,
      button: "Open the list",
      note: "An acknowledgement is tied to one specific version and takes a couple of minutes. If you believe a document does not apply to you, contact HR.",
    },

    inviteEmail: {
      subject: organisation => `Invitation — ${organisation}`,
      subtitle: "Invitation",
      intro: (legal, portal) => `${legal === portal ? `${legal} invites you to its internal portal.` : `${legal} invites you to ${portal}.`} It holds the documents and tasks that apply to you.`,
      how: "You sign in with the work email address this invitation was sent to. After opening the portal, sign in with your work account or have a sign-in link sent to you.",
      button: "Open the portal",
      note: "If you cannot sign in, contact HR.",
      privacy: "How the portal processes your personal data, why, for how long and what your rights are:",
      privacyLink: "Privacy notice",
    },

    dueReminderEmail: {
      subjectSoon: org => `A deadline is approaching \u2014 ${org}`,
      subjectOver: org => `You are past a deadline \u2014 ${org}`,
      subtitleSoon: "Deadline approaching",
      subtitleOver: "Past the deadline",
      introSoon: "This is waiting for you and the deadline is close:",
      introOver: "This is waiting for you and the deadline has passed:",
      soonLine: (due, daysLeft) =>
        daysLeft === 0 ? `the deadline is today, ${due}`
        : `the deadline is ${due}, ${daysLeft === 1 ? "one day left" : `${daysLeft} days left`}`,
      overLine: (due, daysOver) =>
        `the deadline was ${due}, ${daysOver === 1 ? "one day ago" : `${daysOver} days ago`}`,
      button: "Open it and acknowledge",
      note: "Acknowledging is quick \u2014 read the document and click. If you have already done it, this email will not come again.",
    },
    privacy: {
      tocHeading: "Contents",
      objectionHeading: "Right to object",
      title: "Data protection",
      lead: "What this system stores about you, why, and for how long.",
      controllerHeading: "Who the controller is",
      controller: org => `Your personal data is processed by ${org}. The Contineo system is operated for it by a supplier acting as a processor under a data processing agreement.`,
      controllerDetails: (address, reg) => [address, reg && `Company ID ${reg}`].filter(Boolean).join(" · "),
      dpoHeading: "Data protection officer (DPO)",
      dpoMissing: "The HR department will give you the contact of the data protection officer.",
      purposeHeading: "What the system is for",
      purpose: "The organisation publishes binding rules and internal policies in it and records who has read them. The system also answers questions about the content of the rules.",
      dataHeading: "What data and why",
      dataColumns: ["Data", "Why"],
      data: [
        ["name, e-mail, job title, department, type of relationship", "so that the rules that concern you can be assigned to you and you can sign in"],
        ["assignment of a document: who, why and by when", "evidence that you were required to read the document"],
        ["first opening of a version", "evidence that the version was made available to you; one record per version, not every view"],
        ["acknowledgement: time, version, the exact wording of the statement, IP address, browser information", "evidence that you read the document"],
        ["time spent on a version", "informative only, not evidence; nothing is assessed on its basis"],
        ["reminders: to whom and when they were sent", "so that you do not get the same reminder twice"],
        ["questions you ask the system and its answers", "so that the accuracy of the answers can be checked and so that you can find your earlier questions in your history"],
        ["mobile phone, workplace and photo, if you fill them in", "internal directory; filling them in is optional"],
        ["gender, if HR fills it in", "statistics on the make-up of the organisation (for example the share of women and men) and correct wording of texts about you in Slovak and Czech; it is not derived from your name and you do not have to provide it"],
        ["use of artificial intelligence: who, when, what for, model, number of tokens and estimated cost — without the text of the question", "an overview of artificial intelligence costs for the organisation's administrator"],
      ],
      hrNote: "HR sees for each person whether they opened a document, whether they acknowledged it and how long they spent on it. “Opened but not acknowledged” is a tracked state; HR may remind you that the acknowledgement is missing.",
      responsibleNote: "Each document names a responsible person (name and e-mail) you can contact with questions about it.",
      basisHeading: "Legal basis",
      basisIntro: "It is set for each document separately and shown with it:",
      basisObligation: "compliance with a legal obligation (Art. 6(1)(c) GDPR) for documents the law requires people to read, such as health and safety at work; the specific law is named with the document;",
      basisInterest: "legitimate interest (Art. 6(1)(f) GDPR) for internal policies — the interest is to show that the people concerned were made aware of the rules.",
      basisDirectory: "Directory data (mobile, workplace, photo) is processed on the basis of the legitimate interest in internal communication. Gender is processed on the basis of legitimate interest in statistics on the make-up of the organisation and in correct wording; it is optional. The record of artificial intelligence use is processed on the basis of the legitimate interest in cost control.",
      retentionHeading: "How long",
      retentionColumns: ["Data", "Period"],
      retention: [
        ["acknowledgement, assignment, opening of a version", "{evidence} from the end of employment or of the relationship with the organisation; if the end date is not known, from removal from the system; at most {cap} from the last event if neither date is known"],
        ["approval of a document and the responsible person", "as long as at least one acknowledgement of that version exists"],
        ["time spent on a version", "12 months"],
        ["questions you ask the system and its answers", "{answers}; removing them from your history only hides them in your list"],
        ["reminders", "90 days"],
        ["access and change log (audit)", "24 months"],
        ["gender", "together with the other data in your record in the list of people"],
        ["record of artificial intelligence use", "25 months"],
      ],
      years: n => (n === 1 ? "1 year" : `${n} years`),
      months: n => (n === 1 ? "1 month" : `${n} months`),
      retentionDelete: "After the period the record is deleted entirely, not anonymised.",
      recipientsHeading: "Who receives the data",
      recipients: "HR and content managers of the organisation to the extent of their role; colleagues only see directory data. Outside the organisation, the processors that run the service:",
      processorsColumns: ["Who", "What for", "Where"],
      processors: {
        atlas: ["MongoDB Atlas", "database and search", "EU (Frankfurt)"],
        vercel: ["Vercel", "running the application", "EU"],
        anthropic: ["Anthropic", "writing answers to questions; no retention and no training on the data", "under the processor agreement"],
        bedrock: ["Amazon Web Services (Bedrock)", "writing answers to questions; no retention and no training on the data", "region {region}"],
        voyage: ["Voyage AI (via MongoDB)", "searching the text of documents", "under the processor agreement"],
        ecomail: ["Ecomail", "sending e-mails", "EU"],
      },
      noSale: "The data is not sold and is not used for advertising or for training artificial intelligence models.",
      automated: "No decisions about anyone are made by automated means.",
      learning: {
        purpose: "The organisation also runs courses and tests in it and issues certificates of completion.",
        data: [
          ["course enrolment: when and who enrolled you", "so that you have access to the course that applies to you"],
          ["completed parts of the course and which parts of a video you watched", "proof that you completed the course; for a required video also that you watched it to the end"],
          ["test attempts: questions, your answers, points, result and time", "evaluating the test"],
          ["certificate: name, gender (for the wording), course, number, dates, issuer, signatory", "proof of completing the course that you can download and that can be verified"],
        ],
        basis: archiveLaw => `Courses follow the same rules as documents: a legal obligation for training required by law (for example health and safety at work), otherwise a legitimate interest in showing that people were trained. The certificate is also kept for archiving under ${archiveLaw}.`,
        retention: [
          ["course enrolment, completed parts, video watching, test attempts", "same as a document acknowledgement (first row of the table)"],
          ["your answers in a test and the parts of a video you watched", "{months} after completing the course; the test result and completion remain"],
          ["certificate", "not deleted — an issued certificate stays valid and is kept according to the organisation's filing plan; it can only be revoked"],
        ],
        retentionNote: "The exception is the certificate — it is not deleted.",
        recipients: "Test results are seen only by the person responsible for the test, not by HR. Anyone you give the certificate link or QR code to can verify it; verification shows the number, course, date and issuer, not your name.",
        automated: "Tests are scored automatically against answers set in advance. If you disagree with a result, contact the person responsible for the test — they will review it and can cancel the attempt so that you can take it again. No other decisions are made by automated means.",
        rights: "An issued certificate cannot be erased — it is kept for archiving and as proof you may need yourself.",
      },
      rightsHeading: "Your rights",
      rights: "You have the right of access to your data, to rectification, to restriction of processing and to data portability.",
      objection: "For documents based on legitimate interest you have the right to object. The data protection officer assesses each objection individually and the evidence is not deleted before the decision. Evidence of having read a document cannot be deleted before the end of the period while it is needed to establish, exercise or defend legal claims.",
      objectionEmail: "Send your objection by e-mail to",
      objectionFormLabel: "Your objection",
      objectionFormHint: "Write what you object to and why. The data protection officer will assess it; you will get a confirmation by e-mail.",
      objectionSubmit: "Submit objection",
      objectionSent: "Your objection has been submitted. We have sent you a confirmation by e-mail.",
      objectionPending: date => `Your objection of ${date} is being assessed by the data protection officer. You can submit another once it is decided.`,
      objectionSignIn: "After signing in you can also submit it right here.",
      objectionSignInLink: "Sign in",
      complaint: {
        SK: "You have the right to lodge a complaint with the supervisory authority — the Office for Personal Data Protection of the Slovak Republic (dataprotection.gov.sk).",
        CZ: "You have the right to lodge a complaint with the supervisory authority — the Office for Personal Data Protection of the Czech Republic (uoou.gov.cz).",
      },
      archiveLaw: {
        SK: "Slovak Act No. 395/2002 on archives and registries",
        CZ: "Czech Act No. 499/2004 on archiving and records management",
      },
      requests: "Send requests to the data protection officer (DPO).",
      version: date => `Text version: ${date}`,
      linkBefore: "What is stored when you acknowledge, and for how long: ",
      link: "Data protection",
      extraHeading: "Additional information from the controller",
    },
    versionMeta: {
      heading: "Version details",
      intro: "Author, who approved the version, and the dates. They are part of the approval — approvers see them with the PDF, and they cannot be changed once submitted.",
      author: "Author",
      authorHint: "Person, department or committee that prepared the document.",
      approvedBy: "Approved by",
      approvedByHint: "A person or a body, for example the Executive Committee.",
      approvedOn: "Approval date",
      effectiveFrom: "Effective date",
      effectiveFromHint: "Required before submitting for approval. It is also in the acknowledgement statement; it is not entered again at publishing.",
      save: "Save details",
      locked: "The draft is under review or approved — the details can no longer change. Only a new version can change them.",
      voidsApproval: "The draft was approved before version details existed. Saving them voids the approval and the draft must be submitted again — so approvers also approve these details.",
      suggested: "Prefilled from the first page of the document — check and save. Until you save them, they are not part of the version.",
      missing: "Version details are not saved yet. Without the effective date the draft cannot be submitted for approval.",
      uploadHeading: "Version details",
      uploadNote: "Optional here — if left empty, they are prefilled from the first page of the document and you confirm them on the detail page.",
      fromMeta: date => `Effective date ${date} — from the approved version details.`,
    },
    objectionEmail: {
      noticeSubject: org => `New objection \u2014 ${org}`,
      noticeSubtitle: "Objection (Art. 21 GDPR)",
      noticeIntro: (person, date) => `${person} submitted an objection to the processing of personal data in the app on ${date}.`,
      noticeButton: "Open objections",
      noticeNote: "The wording of the objection is on the DPO page after signing in, not in this e-mail. Nothing is deleted until a decision is made.",
      receiptSubject: org => `Objection received \u2014 ${org}`,
      receiptSubtitle: "Confirmation",
      receiptIntro: date => `We received your objection to the processing of personal data on ${date}. It reads:`,
      receiptNote: "The data protection officer (DPO) will assess it. Your records are not deleted until a decision is made.",
      receiptContact: email => `The data protection officer (DPO) will assess it. Your records are not deleted until a decision is made. Send questions to ${email}.`,
    },
    dpoEmail: {
      subject: (org, quarter) => `Legal basis report ${quarter} \u2014 ${org}`,
      subtitle: "Quarterly review",
      intro: quarter => `Quarterly overview of the legal bases of documents in force (${quarter}):`,
      total: n => `documents in force: ${n}`,
      legalObligation: n => `legal obligation: ${n}`,
      legitimateInterest: n => `legitimate interest: ${n}`,
      withProblems: n => `with a gap: ${n}`,
      button: "Open the report",
      note: "The legal basis is set by the person responsible for the document; you review it (O15/A10). The list of documents is in the report after signing in; the e-mail only carries counts.",
    },
    approvalEmail: {
      subject: org => `A version to approve \u2014 ${org}`,
      subtitle: "To approve",
      intro: who => `${who} submitted a version and is waiting for your decision:`,
      noteLabel: "What changes in this version",
      versionLine: (_label, effectiveFrom) => `version effective from ${effectiveFrom}`,
      button: "Read it and decide",
      note: "You decide for yourself \u2014 the other approvers decide independently. A reason is required when rejecting, so the submitter knows what to fix.",
    },
    assignmentEmail: {
      subject: org => `New document to acknowledge — ${org}`,
      subtitle: "To acknowledge",
      intro: "A document has been added to your list:",
      reasonLabel: "Reason",
      versionLine: (_label, effectiveFrom) => `version effective from ${effectiveFrom}`,
      button: "Open and acknowledge",
      note: "You will also find the document in the list on the home page after signing in. It stays there until you acknowledge it.",
    },
  myAcknowledgements: {
    heading: "My acknowledgements",
    intro: "What the system records about you: which versions you acknowledged, when, and under what wording. You see only your own records and can download them.",
    nothing: "You have no acknowledgements yet.",
    download: "Download as CSV",
    count: n => (n === 1 ? "1 record" : `${n} records`),
    acknowledged: "acknowledged",
    revoked: "revoked",
    versionLine: (_label, effectiveFrom) => `version effective from ${effectiveFrom}`,
    whenLine: when => `acknowledged ${when}`,
    revokedWhenLine: when => `revoked ${when}`,
    revokedStatement: "The statement under which it was originally acknowledged:",
    viaTrack: track => `from track ${track}`,
    reason: text => `Reason: ${text}`,
    footnoteBefore: "How the whole process works is in the ",
    footnoteGuide: "Guide",
    footnoteAfter: ". If something here looks wrong, contact HR — a record is never edited; it is revoked and acknowledged again.",
    csv: {
      type: "Type", document: "Document", version: "Version", effectiveFrom: "Effective from",
      acknowledgedAt: "Acknowledged", track: "Track", statement: "Statement",
      reason: "Reason", ip: "IP address", browser: "Browser",
    },
  },
  guide: {
    heading: "Guide",
    intro: "How a document gets into the system and what happens to it along the way — from upload to smart search.",
    onlySlovak: "The guide is currently available in Slovak only. It will be translated as a whole once the interface is actually used in English.",
  },
  directory: {
    heading: "Directory",
    intro: "Colleagues in your organisation — job title, workplace and contact details. People who have left are not listed.",
    searchPlaceholder: "Name, job title, department or workplace…",
    nothingFound: "Nobody matches that search.",
    count: n => (n === 1 ? "1 person" : `${n} people`),
  },
  dpo: {
    heading: "Data protection",
    intro: "Legal bases of documents in force. The person responsible for each document sets them, you review them — once a quarter you get an overview by e-mail.",
    reportHeading: "Legal bases of documents in force",
    csv: "Download CSV",
    empty: "The organisation has no document in force yet.",
    summary: (total, problems) => `${total} documents in force, ${problems} of them with a gap.`,
    basis: "Legal basis",
    reference: "Law",
    responsible: "Responsible person",
    version: "Version",
    none: "—",
    ok: "fine",
    problems: {
      noBasis: "legal basis missing",
      outsideCodelist: "basis outside the code list",
      noReference: "legal obligation without a reference to the law",
      noResponsible: "responsible person missing",
      inactiveResponsible: "responsible person is excluded",
    },
    objectionsHeading: "Objections (Art. 21)",
    objectionsIntro: "For documents based on legitimate interest a person may object. Record the objection here and decide on it; nothing is deleted before the decision. If upheld, their evidence for versions based on legitimate interest is deleted — evidence under a legal obligation stays.",
    recordHeading: "Record an objection",
    personEmail: "Person's e-mail",
    personEmailNote: "A previous address works too — objections often come from the address the person used while in the association.",
    receivedAt: "Received",
    channel: "Received by",
    channels: { email: "e-mail", letter: "letter", "in-person": "in person", other: "other", app: "in the app" },
    objectionText: "Wording of the objection",
    objectionTextNote: "As received — without your own interpretation.",
    recordSubmit: "Record",
    noObjections: "No objections yet.",
    retention: {
      heading: "Retention periods",
      intro: "The nightly deletion job uses these periods, and exactly these numbers appear on the Data protection page.",
      evidenceYears: "Years after the relationship ends",
      evidenceYearsNote: "Acknowledgements, assignments, version openings and learning records. If the end date is unknown, the period runs from removal.",
      capYears: "Cap in years from the last event",
      capYearsNote: "For a removed person with neither date known. It cannot be shorter than the period above.",
      learningDetailMonths: "Months after completing a course",
      learningDetailMonthsNote: "After that, answers are removed from tests and watched segments from video tracking. The result and completion remain.",
      answersMonths: "Months for questions and answers",
      answersMonthsNote: "Then questions, answers and their ratings are deleted. Records that became a verified answer stay, without the name of the person who asked.",
      fixed: "Fixed for the whole platform (enforced by the database): time spent on a version 12 months, reminders 90 days, audit 24 months, artificial intelligence usage 25 months. Certificates are never deleted.",
      warning: "Shortening a period may delete records in the very next nightly run when real deletion is switched on.",
      save: "Save periods",
      saved: "Periods saved.",
    },
    extra: {
      heading: "Additional text for the Data protection page",
      intro: "Your own paragraph shown below the common text — for example another purpose or contact. The common text does not change. An empty field shows nothing.",
      label: language => `Text — ${language}`,
      save: "Save additional text",
      saved: "Additional text saved.",
    },
    status: { pending: "awaiting decision", upheld: "upheld", rejected: "rejected" },
    receivedLine: (date, channel) => `received ${date} · ${channel}`,
    recordedLine: (who, date) => `recorded by ${who}, ${date}`,
    decideHeading: "Decision",
    upheld: "Uphold — delete evidence based on legitimate interest",
    rejected: "Reject — compelling legitimate grounds or legal claims prevail",
    decisionNote: "Reasoning",
    upheldWarning: "Upholding deletes the evidence permanently, right after sending.",
    decideSubmit: "Decide",
    decidedLine: (who, date) => `decided by ${who}, ${date}`,
    deletedLine: (acks, unknown) => `acknowledgements deleted: ${acks}` + (unknown ? ` · ${unknown} acknowledgements without a recorded legal basis remain — review them manually` : ""),
    objectionRecorded: "Objection recorded.",
    settingsMoved: "Retention periods, the Privacy page addition and the GDPR contact are in the organisation settings.",
    settingsLink: "Open the GDPR tab",
    objectionUpheld: "Objection upheld; evidence based on legitimate interest has been deleted.",
    objectionRejected: "Objection rejected.",
    searchPlaceholder: "Search documents — title, basis, law, person",
    searchSubmit: "Search",
    filterState: "Status",
    filterBasis: "Legal basis",
    filterPerson: "Responsible person",
    filterAll: "All",
    stateProblems: "With issues",
    stateOk: "In order",
    basisObligation: "Legal obligation",
    basisInterest: "Legitimate interest",
    basisNone: "No basis",
    chipSearch: "search",
    removeFilter: label => `Remove filter ${label}`,
    shownOf: (shown, total) => `${shown} of ${total} documents`,
    groupBy: "Group",
    groupState: "By status",
    groupPerson: "By person",
    noPerson: "No responsible person",
    writeEmail: n => `Write an email · ${n}`,
    mailSubject: "Legal basis of documents — missing details",
    mailBody: list => `Hello,\n\nthe legal basis is missing or incorrect for these documents you are responsible for:\n\n${list}\n\nPlease complete it on the document card in library management.\n\nThank you`,
    mailBodyLink: (n, url) => `Hello,\n\nthe legal basis is missing or incorrect for ${n} documents you are responsible for. List: ${url}\n\nPlease complete it on the document card in library management.\n\nThank you`,
    groupPersonMeta: (total, bad) => `${total} ${total === 1 ? "document" : "documents"}, ${bad} with issues`,
    pendingBanner: n => n === 1 ? "1 objection awaits a decision" : `${n} objections await a decision`,
    pendingBannerMeta: (name, date) => `${name} · received ${date} · nothing is deleted until decided`,
    pendingDecide: "Decide",
    noMatch: "Nothing matches your search",
    noMatchText: "The report only contains current versions. Archived and upcoming ones are in the",
    noMatchLibrary: "library",
    clearSearch: "Clear search",
    clearAll: "Clear all",
    decidedToggle: n => `Decided objections (${n}) · show`,
    groupProblems: n => `With issues · ${n}`,
    groupOk: n => `In order · ${n}`,
    colDocument: "Document",
    colStatus: "Status",
    pendingCount: n => `${n} awaiting decision`,
    recordOpen: "+ Record an objection",
  },
  nav: {
    ask: "Ask a question",
    toApprove: "To approve",
    evidence: "Evidence",
    overview: "Overview",
    loading: "Loading…",
    sections: "Sections",
    tasks: "Tasks",
    more: "More",
    groupOrganisation: "Organisation",
    groupManagement: "Management",
    groupMain: "Main",
    breadcrumb: "Breadcrumb",
    menu: "Menu",
    skipToContent: "Skip to content",
    allSections: "All sections",
    escCloses: "closes",
    sheetHint: "All sections with descriptions are on the Overview",
    desc: {
      toAcknowledge: "Regulations you are to read and acknowledge",
      toApprove: "Versions you are to decide on",
      directory: "Contacts, departments and who is responsible for what",
      library: "Regulations in force and their versions",
      learning: "My courses, tests and certificates",
      assigned: "Who acknowledged what, assigning regulations",
      evidence: "Acknowledgement records for audit",
      people: "Employees, employment relationships, roles",
      evaluation: "Answers someone said were wrong",
      dpo: "Legal bases of regulations and objections",
      channels: "Widget and portal; tickets of the channels you are an agent of",
      learningManage: "Courses, parts and assignment",
      learningTests: "Question bank and attempt results",
    },
    waiting: n => `${n} waiting`,
    toAcknowledge: "To acknowledge",
    assigned: "Assigned documents",
    evaluation: "To evaluate",
    dpo: "Data protection",
    channels: "Channels",
    learning: "Learning",
    learningManage: "Course management",
    learningTests: "Tests",
    people: "People",
    directory: "Directory",
    library: "Library",
    organisation: "Organisation settings",
    tenants: "Tenant administration",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    searchPlaceholder: "Ask your documents…",
    searchLabel: "Ask your documents",
    searchSubmit: "Ask",
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

  versionNotice: {
    text: "A new version of the portal is available. Reload the page to switch to it.",
    reload: "Reload",
  },

  notFound: {
    heading: "Page not found",
    intro: "This address does not exist or is no longer valid.",
    home: "Go to the home page",
  },

  home: {
    metaTitle: "Contineo",
    metaDescription: "Checking the quality of answers over regulations and directives.",
  },

  signIn: {
    emailPlaceholder: "name@organisation.com",
    or: "or",
    heading: "Sign in",
    intro: "Enter the e-mail address your invitation was sent to. We will send you a link — no password to remember.",
    noScript: "Signing in needs JavaScript — without it neither the e-mail link nor the work-account sign-in can be sent. Please turn it on and reload the page.",
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
    submit: "Ask",
    phases: {
      reading: "Reading the question…",
      searching: "Searching the rules…",
      ranking: "Ranking what was found…",
      writing: "Composing the answer…",
    },
    examplesLabel: "For example",
    examples: [
      "What is the deadline for filing an objection?",
      "Under what conditions may a minor player transfer?",
      "When is a transfer fee payable for a player?",
      "How many yellow cards lead to a suspension?",
    ],
    unknownError: "Unknown error",
    scopeLabel: "Search in",
    scopeLibrary: "Library",
    noScript: "Answering needs JavaScript — the answer arrives in pieces, as the model writes it. Documents can be read and acknowledged without it:",
    noScriptLink: "go to documents",
    history: {
      recent: "Recent questions",
      matching: "From your questions",
      all: "Full history",
      title: "My questions",
      lead: "Questions you asked, with the answers as they came at the time.",
      filter: "Search my questions",
      filterSubmit: "Search",
      remove: "Remove from history",
      removed: "Question removed from history",
      removedAll: "History cleared",
      undo: "Undo",
      clearAll: "Clear the whole history",
      clearConfirm: "Clear your whole question history? The questions disappear from your list.",
      clearCancel: "Keep",
      retention: months => `Questions and answers are kept for ${months} months and then deleted. Removing them from your history only hides them in your list — they stay for checking answer quality until the period ends.`,
      loadOlder: "Load older",
      empty: "You have not asked anything yet.",
      emptyText: "Ask a question in the field at the top. Your questions and answers will then show up here.",
      emptyFilter: "None of your questions matches.",
      emptyFilterText: "Try another word or clear the search.",
      status: {
        citations: n => (n === 1 ? "1 citation" : `${n} citations`),
        none: "nothing found",
        fits: "correct",
        doesNotFit: "not correct",
      },
      today: "Today",
      yesterday: "Yesterday",
    },
    saved: {
      banner: date => `Answer from ${date}. The rules may have changed since then.`,
      newVersion: (document, label, date) => `${document} has a new version since then (${label}, in force from ${date}).`,
      askAgain: "Ask again",
    },
    sheet: {
      infoLead: org => `The answer is built only from ${org} documents.`,
      infoRest: "Every statement links to its source. If it is not in the documents, the system says so and makes nothing up.",
      hint: "Enter sends · Shift+Enter new line · Esc closes",
      hintInline: "Enter sends · Shift+Enter new line",
      hintHistory: "↑↓ select · Enter opens · Esc closes",
      insert: "insert",
      close: "Close",
    },
    heading: "Ask",
    emptyLead: "Write your question in your own words, the way you would ask a colleague.",
    edit: "Edit question",
    askedAt: time => `Asked at ${time}`,
    answerKicker: org => `Answer from ${org} documents`,
    none: {
      kicker: "Nothing on this was found in the organisation's documents",
      text: "Try rephrasing the question, or search the library — not everything is in the regulations.",
      link: "Search the library →",
      noVersion: (d) => `The organisation has no document version in force on ${d} — try another date or ask without a date.`,
    },
    error: {
      unavailable: "The answer cannot be composed right now. Try again in a moment — the library search works.",
      link: "Open the library →",
    },
  },

  answer: {
    cacheTo: "to cache",
    cacheFrom: "from cache",
    techTokens: "tokens",
    techTotal: "total",
    techModel: "model",
    fromDocuments: "Answer from your documents",
    failed: "The answer could not be retrieved.",
    incompleteHeading: "The answer is incomplete.",
    incompleteNote: "The model hit its length limit and stopped mid-sentence — the conclusion is missing. Try asking about a narrower part of the problem.",
    citations: (shown) => `Verbatim citations (${shown})`,
    citationsFrom: total => `from ${total} references`,
    citationsPending: "Citations appear while the answer is written",
    technical: "Technical details",
    openInLibrary: "Open in library",
    citationOf: (n, total) => `Citation ${n} of ${total}`,
    prev: "Previous",
    next: "Next",
    close: "Close",
    sourceMissing: "source not given",
    sources: (n) => `Sources searched (${n})`,
    internal: "internal",
    verified: "verified answer",
    verifiedNote: "wording someone verified against the document — not the document itself",
    live: "Live source",
    liveNote: (connector, group) => `straight from ${connector}${group ? ` (${group})` : ""} — not reviewed by a curator`,
    liveFailed: names => `A live source did not answer (${names}) — the answer is without it.`,
    sourceVersion: (label, from, to) =>
      [label && `version ${label}`, from && `in force from ${from}${to ? ` until ${to}` : ""}`].filter(Boolean).join(" · "),
    timeToday: (d) => `per versions in force today, ${d}`,
    timeAsOf: (d) => `per versions in force on ${d}`,
    timeCompare: (from, to) => `comparing versions: ${from} → ${to}`,
    compareSide: (label, date) => (label ? (date ? `${label} (from ${date})` : label) : date ? `from ${date}` : ""),
    timeCompareUnavailable: {
      "single-version": (d) => `the document has a single version, nothing to compare — the answer uses versions in force today, ${d}`,
      "missing-text": (d) => `the text of the older version is missing — the answer uses versions in force today, ${d}`,
      identical: (d) => `the versions do not differ in text — the answer uses versions in force today, ${d}`,
      "no-document": (d) => `the comparison could not be made — the answer uses versions in force today, ${d}`,
    },
    match: { high: "strong match", medium: "moderate match", low: "weak match" },
    adapter: "adapter",
    firstToken: "first token",
    costNote: (pricelistVersion) => `Approximate. Excludes the helper model and retrieval. Price list ${pricelistVersion}.`,
    pricelistStale: "the price list is out of date",
    citationsVerified: "citations verified by the model",
    citationsUnverified: "citations not verified",
  },
  hr: {
    tabs: { assignments: "Assignments", report: "Acknowledgement report", reminders: "Reminders", tracks: "Tracks", evidence: "Evidence chain" },
    tabsLabel: "Section parts",
    dutyState: {
      acknowledged: "acknowledged",
      opened: "opened, not acknowledged",
      "not-opened": "not opened",
      overdue: "overdue",
      revoked: "revoked",
    },
    report: {
      heading: "Acknowledgement report",
      intro: "Who has to acknowledge what, and who already did. The denominator counts a person when the document was assigned to them or is a step in a track they are on — not everyone in the organisation.",
      views: { document: "By document", person: "By person", track: "By track" },
      viewsShort: { document: "Document", person: "Person", track: "Track" },
      viewsLabel: "View",
      emptyTitle: "Nothing to summarise yet",
      emptyText: "The summary appears once there is a first assignment.",
      done: (done, total) => `${done} of ${total}`,
      missing: n => `${n} missing`,
      complete: "complete",
      medianReading: "median reading",
      noReading: "not measured",
      readingNote: "Reading time is informative. It is measured in the browser, so it proves nothing — leave the tab open and you “read” for an hour.",
      export: "Download as CSV",
      open: "Break down",
      acknowledgedAt: "acknowledged",
      revoke: "Revoke acknowledgement",
      revokeReason: "Reason for revoking",
      revokeHint: "The duty comes back with its original deadline. If that deadline has passed, the person is overdue immediately.",
      revokeButton: "Revoke",
      revokeDone: "The acknowledgement is revoked. The duty is back.",
      revokeFailed: "The acknowledgement could not be revoked.",
      readingTime: "read for",
      source: { assignment: "assignment", track: "track", both: "assignment and track" },
    },
    overview: {
      assignedBy: (who: string) => `assigned by ${who}`,
      versionTag: (label: string) => `version ${label}`,
      today: "today",
      heading: "Assigned documents",
      intro: "What has been assigned to whom and who has already acknowledged it. The counts are computed when the page is opened — and cover the people who belong to the group",
      assign: "Assign a document",
      tracks: "Tracks",
      tracksNote: "People on a track acknowledge its steps — the duty comes from the track, not from an assignment.",
      trackLine: (people, documents) =>
        `${people === 1 ? "1 person" : `${people} people`} · ${documents === 1 ? "1 document" : `${documents} documents`}`,
      openTrack: "Open track",
      emptyTitle: "No assignments",
      emptyText: "Once you assign a document to someone, it shows up here along with how many have acknowledged it.",
      acknowledged: "Acknowledged",
      notified: "Notified",
      no: "no",
      nobody: "nobody",
      missing: "Missing",
      notifyByEmail: "Notify by e-mail",
      revoke: "Revoke assignment",
    },
    detail: {
      version: "version",
      assignedBy: "assigned by",
      notAcknowledged: (missing, total) => `Not acknowledged (${missing} of ${total})`,
      effectiveFrom: (date) => `, effective from ${date}`,
      notifyLink: "notify them by e-mail →",
      allTitle: "Everyone has acknowledged",
      allText: "This assignment is settled — nobody is missing.",
      noLongerInDepartment: "no longer in the department",
      note: "The list is computed when the page is opened. Anyone who left the department without acknowledging stays here, marked — otherwise they would quietly disappear and nobody would learn it was left unresolved; they are not e-mailed, though. Anyone who left the organisation altogether is not here — but their acknowledgement (or the lack of it) stays in the records.",
    },
    revokeAssignment: {
      heading: "Revoke assignment",
      lead: "Check which assignment you are revoking. Nothing happens until you press the button below.",
      whatHappensHeading: "What happens when you revoke it",
      tasksDisappear: (n) => n === 1 ? "1 person who has not acknowledged yet will no longer see the task under “To acknowledge” and will get no reminder." : `${n} people who have not acknowledged yet will no longer see the task under “To acknowledge” and will get no reminder.`,
      nobodyLoses: "Nobody has a task from this assignment any more — everyone has acknowledged.",
      versionSuperseded: (assigned, current, n) =>
        `The assigned version ${assigned} is no longer in force — ${current} replaced it. It cannot be acknowledged, so nobody sees it under “To acknowledge”; ` +
        (n > 0 ? `the HR report still shows ${n === 1 ? "1 person" : `${n} people`} as not acknowledged. Revoking removes this duty that cannot be met.` : "nobody has it in the HR report either."),
      acknowledgementsStay: (n) => `Acknowledgements already given (${n}) stay valid. Revoking does not delete them.`,
      recordStays: "The record is not deleted: the audit keeps both the assignment and its revocation. Revoking cannot be undone.",
      reassign: "If you need it again, assign the document anew — a new assignment with today's date is created.",
      reasonLabel: "Reason for revoking",
      reasonHint: "Optional. It goes into the audit so that a year from now it is clear why the assignment was cancelled.",
      confirm: "Revoke assignment",
      cancel: "Back without revoking",
      alreadyRevoked: "This assignment is no longer in force.",
    },
    notify: {
      trackAudience: (title: string) => `track "${title}"`,
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
      documentsCount: n => `${n} current`,
      heading: "Assign documents",
      introBefore: "What is assigned is ",
      introHighlight: "a specific version",
      introAfter: ", not a document. When a newer one is issued, the old assignment does not carry over to it — that is deliberate.",
      emptyTitle: "Nothing to assign",
      emptyText: "Only a published version can be assigned. The library has none yet.",
      whichDocuments: "Which documents",
      versionLine: (_label, date) => `version effective from ${date}`,
      to: "Recipients",
      departments: "Departments",
      groups: "Groups",
      tracks: "Tracks",
      people: "People",
      everyone: "Everyone in the organisation",
      everyoneNote: "overrides the selection below — otherwise the same version would appear in the overview several times and nobody would know which row meant anything",
      departmentNoteBefore: "Assigning to a department also applies ",
      departmentNoteHighlight: "to every department below it",
      departmentNoteAfter: ". The number counts those people too — that is who it actually reaches.",
      noGroupsOrTracks: "The organisation has no groups or tracks yet. Groups are set when importing people (the “groups” column) or with the command",
      addresses: "Individual addresses",
      addressesNote: "Optional. Separate with a comma or a new line.",
      reason: "Reason",
      due: "Acknowledgement deadline",
      dueNone: "no deadline",
      dueDate: "by a date",
      dueDays: "within N days of the duty arising",
      dueDaysUnit: "days",
      dueNote: "Optional. A date applies to everyone alike; a number of days runs for each person from the day their duty arose — which matters for someone who joins the department later. Without a deadline, reminders are not sent automatically.",
      reasonPlaceholder: "e.g. amendment to Article 12 — the deadline for an appeal changes",
      reasonNote: "Required, and shared by the whole selection. It is the only place where, a year from now, it will say why these documents had to be acknowledged again — and it goes out in the e-mail as well.",
      submit: "Assign",
      checkImpact: "Check the impact",
      impactPeople: (n) =>
        n === 0 ? "Nobody will get the obligation"
        : n === 1 ? "1 person will get the obligation"
        : `${n} people will get the obligation`,
      impactNote: "Whoever joins the department later gets it from the day they arrive (D50).",
      docSearch: "Search documents",
      docNone: q => `Nothing matches “${q}”. Only a current version can be assigned.`,
      onlyMissingBasis: n => `only without legal basis (${n})`,
      showAll: "show all",
      picked: n => `Selected (${n})`,
      summary: {
        documents: n => (n === 1 ? "document" : "documents"),
        departments: n => (n === 1 ? "department" : "departments"),
        groups: n => (n === 1 ? "group" : "groups"),
        tracks: n => (n === 1 ? "track" : "tracks"),
        people: n => (n === 1 ? "person" : "people"),
        everyone: "everyone",
        everyoneRest: "in the organisation",
        noAudience: "no recipients selected yet",
      },
      impactStale: "The selection changed — check the impact again",
      impactStaleNote: n => (n === 1
        ? "For the previous selection, 1 person would have got the obligation."
        : `For the previous selection, ${n} people would have got the obligation.`),
      submitN: n => (n === 1 ? "Assign to 1 person" : `Assign to ${n} people`),
    },
    actions: {
      noAudience: "You did not choose who to assign to.",
      noDocument: "You did not choose any document with an effective version.",
      saveFailed: "The assignment could not be saved. Please try again.",
      assignedOne: (what) => `Assigned: ${what}.`,
      assigned: (count, documents, audiences) =>
        `Assigned: ${count} (${documents} ${documents === 1 ? "document" : "documents"}` +
        ` × ${audiences} ${audiences === 1 ? "recipient" : "recipients"}).`,
      assignedWithExisting: (count, documents, audiences, already) =>
        `Assigned: ${count} (${documents} ${documents === 1 ? "document" : "documents"}` +
        ` × ${audiences} ${audiences === 1 ? "recipient" : "recipients"}).` +
        ` ${already} had already been assigned — nothing was duplicated.`,
      revoked: (what) => `Revoked: ${what}. The record of the assignment stays.`,
      alreadyRevoked: "This assignment is no longer in force.",
      nobodyToNotify: "There is nobody to send to — everyone still in the department has acknowledged.",
      tooManyRecipients: (recipients, max) =>
        `There are ${recipients} recipients; at most ${max} can be sent at once. Split the assignment into smaller groups of recipients.`,
      sent: (n) => `Sent to ${n} people who have not acknowledged yet.`,
      sentWithFailures: (n, failed) => `Sent ${n}. Undeliverable: ${failed}`,
    },

    reminders: {
      heading: "Reminders",
      intro: days => `People with something unacknowledged for more than ${daysEn(days)}. One email per person — someone behind on four documents gets one message with four lines.`,
      open: "Remind",
      emptyTitle: "Nobody to remind",
      none: days => `Everyone with a running deadline has acknowledged — nobody is more than ${daysEn(days)} behind.`,
      person: (documents, days) => `${documents === 1 ? "1 document" : `${documents} documents`} · longest ${daysEn(days)}`,
      send: people => people === 1 ? "Send 1 reminder" : `Send ${people} reminders`,
      impactEmails: n => n === 1 ? "1 e-mail will go out" : `${n} e-mails will go out`,
      impactNote: "People who have already acknowledged get nothing (D61). A sent e-mail cannot be recalled.",
      sent: n => `Sent: ${n}.`,
      nobody: "There is nobody to remind.",
      modeLabel: "Who to send to",
      modeNotice: "Everyone with something unacknowledged",
      modeOverdue: days => `Only those behind (${daysEn(days)}+)`,
      noticeHeading: "Notify by e-mail",
      noticeIntro: "Everyone with something unacknowledged — including what arrived today. This covers duties from tracks, which have no assignment behind them and otherwise no way to announce themselves. One e-mail per person.",
      noticeNone: "Nobody has anything unacknowledged.",
      noticePerson: documents => documents === 1 ? "1 document" : `${documents} documents`,
      noticeSend: people => people === 1 ? "Send 1 e-mail" : `Send ${people} e-mails`,
      noticeSent: n => `Sent: ${n}.`,
      noticeNobody: "There is nobody to send to.",
      fromTrack: title => `from the “${title}” track`,
    },
  },

  tree: {
    saveOrder: "Save order",
    cancel: "Discard changes",
    hint: "The order is written only when you press the button.",
  },

  valueSelect: {
    onlyHere: "only here",
    notInCodelist: "not in the code list",
    searchOf: (shown, total) => `${shown} of ${total}`,
    groups: {
      count: n => n === 1 ? "1 person" : `${n} people`,
      newPlaceholder: "New group",
      foot: "A new group is created when the person is saved. Separate several groups with commas.",
      emptyFoot: "No group yet — the first one you type creates it.",
      search: "Search groups",
    },
    tags: {
      count: n => n === 1 ? "1 document" : `${n} documents`,
      newPlaceholder: "New tag",
      foot: "A new tag is created when the document is saved and joins the organisation's code list. Separate several tags with commas.",
      emptyFoot: "No tag yet — the first one you type creates it.",
      search: "Search tags",
    },
    similar: (v, like) => `We did not save “${v}”: it looks like the existing “${like}”.`,
    similarGroupNote: "The rest of the person is saved. Choose which applies and save again.",
    similarTagNote: "The rest of the document is saved. Choose which applies and save again.",
    pickLike: like => `Use “${like}”`,
    createAnyway: v => `Create “${v}”`,
    similarSkipped: (v, like) => `We did not add the tag “${v}” — it looks like “${like}”. Add it when editing the document.`,
  },
  multiSelect: {
    searchHint: "search…",
    nothingFound: "Nothing found.",
    nothingFoundNew: "Nothing found — try different wording, or press Enter to add a new value.",
    empty: "There are no values here yet.",
    clearAll: "Clear selection",
    done: "Done",
    remove: (value) => `Remove ${value}`,
    chosenOf: (chosen, total) => `${chosen} of ${total} selected`,
  },
  overview: {
    hello: name => `Hello, ${name}`,
    tiles: {
      toAcknowledge: "To acknowledge",
      toApprove: "Waiting for approval",
      new: "New",
      expiring: "Expiring",
    },
    soonNote: n => (n === 1 ? "1 urgent" : `${n} urgent`),
    mine: "for you",
    newNote: days => `documents in ${days} days`,
    expiringNote: days => `rules within ${days} days`,
    attention: "Needs your attention",
    news: "New in the library",
    empty: {
      attentionTitle: "Nobody is waiting on you",
      attentionText: "When someone assigns you a document or names you an approver, it will appear here with its deadline.",
      newsTitle: days => `Nothing new in the last ${days} days`,
      newsText: "New versions and those approaching the end of their validity will show up here.",
    },
    showAll: n => `Show all ${n} →`,
    wholeLibrary: "Whole library →",
    allTasks: "All tasks →",
    forYou: "For you",
    by: date => `by ${date}`,
    until: date => `valid until ${date}`,
    expiringChip: "expiring",
    open: "Open",
    decide: "Decide",
    submittedBy: who => `submitted by ${who}`,
  },
  evidence: {
    colPerson: "Person",
    colDocument: "Document · version",
    colState: "Status",
    colDate: "Date",
    heading: "Chain of evidence",
    intro: "What happened with each obligation \u2014 from assignment to acknowledgement. Composed on display; nothing is stored.",
    emptyTitle: "No records",
    emptyText: "A record appears once someone is assigned a document or a track step.",
    emptyFilterTitle: "Nothing matches the filter",
    emptyFilterText: "Try a different name or state.",
    kind: {
      assigned: "Assigned",
      notified: "Contacted",
      opened: "First opened",
      read: "Time on the text",
      acknowledged: "Acknowledged",
    },
    gap: {
      "before-recording": "this was not recorded back then",
      expired: "the measurement was deleted after a year",
      "not-yet": "not yet",
    },
    informative: "informative",
    rows: {
      ip: "IP address",
      department: "Department at the time",
      statement: "Statement wording",
      reading: "Reading time",
      opened: "First opened",
      revokedBy: "Revoked by",
      revokeReason: "Revocation reason",
    },
    none: "—",
    seconds: n => (n < 60 ? `${n} s` : `${Math.round(n / 60)} min`),
    times: n => (n === 1 ? "once" : `${n} times`),
    states: {
      acknowledged: "acknowledged",
      "opened-not-acknowledged": "opened, not acknowledged",
      "not-opened": "not even opened",
    },
    filterPerson: "Person",
    filterState: "State",
    filterAll: "all",
    apply: "Apply",
    exportCsv: "Export CSV",
    shown: (n, all) => `${n} of ${all} obligations`,
    allPeople: "everyone →",
    notifiedMissing: "The timeline has no notification row yet: the reminder log is operational and is deleted after 90 days, and the record on the assignment says how many people were contacted, not which ones.",
  },
  approvals: {
    openPdf: "Open PDF",
    searchText: "Text for search and answers — approved together with the PDF",
    heading: "To approve",
    intro: "Versions somebody submitted that are waiting for your decision. You decide for yourself \u2014 the other approvers decide independently.",
    emptyTitle: "Nothing awaits your decision",
    emptyText: "When someone names you an approver of a version, the full text will appear here along with who submitted it.",
    versionLine: (label, round) => `${label} \u00b7 ${round}`,
    roundLine: round => `round ${round}`,
    submittedBy: (who, when) => `submitted by ${who} \u00b7 ${when}`,
    effectiveFrom: date => `effective from ${date}`,
    noEffectiveFrom: "no effective date yet \u2014 it cannot be assigned until it has one",
    newVersionFrom: d => `New version from ${d}`,
    firstVersionFrom: d => `First version from ${d}`,
    draftVersion: "New version",
    kicker: (round, who, when) => `Round ${round} · submitted by ${who} · ${when}`,
    whatYouApprove: "What you are approving",
    whatYouApproveNote: "PDF, text and version details — one decision",
    searchTextNote: "Search and answer text — approved together with the PDF",
    metaHeading: "Version details",
    metaNote: "part of the approval · cannot be changed after submission",
    noteFrom: "Note from the submitter",
    alsoDecidingHeading: "Also deciding",
    readAndDecide: "Read and decide",
    alsoDeciding: names => `Also deciding: ${names}`,
    readText: "read the text",
    noText: "This version has no text.",
    draftChanged: "The text changed after it was submitted for approval. This round refers to the earlier wording, which no longer exists — the content manager must submit it again.",
    reason: "Reason",
    reasonPlaceholder: "For example: article 4 conflicts with the statutes.",
    reasonHint: "Required when rejecting. Optional when approving \u2014 but it stays in the record.",
    approve: "Approve",
    reject: "Reject",
    doneApproved: "Approved. Waiting for the other approvers.",
    doneApprovedClosed: "Approved. The version is now fully approved.",
    doneRejected: "Rejected. The version went back to draft and the reason stays in the history.",
  },
  curation: {
    prepareHeading: "Prepare as a verified answer",
    prepareIntro: "Evaluated answers where you wrote how the answer should have read. A prepared pair is published by the content manager — it does not reach the knowledge base yet.",
    prepareEmpty: "Nothing to prepare yet. A pair comes from a verdict that has „How should the answer have read“ filled in.",
    questionLabel: "Question",
    questionHint: "You may edit the wording — the original question is free text and may contain things that do not belong in the knowledge base.",
    answerLabel: "Verified answer",
    sourcesLabel: "Which passages the answer came from",
    sourcesHint: "They decide who may see the pair, and they decide when it is archived as the document changes. One internal passage makes the whole pair internal.",
    noSources: "This answer has no passage identifiers on its sources, so no pair can be prepared from it. This applies to answers from before 15 September 2026.",
    save: "Prepare the pair",
    draftBadge: "prepared",
    publishHeading: "Verified answers to publish",
    publishIntro: "Pairs prepared by an evaluator. Publishing puts them into the knowledge base as a verified answer — no document is changed or overwritten.",
    publishEmpty: "Nothing awaits publication",
    publishEmptyNote: "When an evaluator marks an answer as verified, it appears here together with the sources it draws on.",
    preparedBy: "prepared by",
    preparedByUnknown: "person no longer in the directory",
    access: "Access",
    accessPublic: "public",
    accessInternal: "internal",
    accessNote: "The level is derived from the sources, never entered. It is computed again at publish time.",
    publish: "Publish to the knowledge base",
    open: "Verified answers",
    waiting: n => `${n} to publish`,
  },
  evaluation: {
    heading: "To evaluate",
    intro: "Answers someone said were wrong. Confirm or correct their verdict and add how the answer should have read — curation builds on that later.",
    empty: "Nothing to evaluate right now.",
    emptyNote: "An answer lands here only when somebody clicks „It is not“ or writes what was wrong with it. Correct answers do not take your time.",
    saidDoesNotFit: "wrong",
    reported: "reported",
    reader: "from the reader",
    answerLabel: "The system's answer",
    showAnswer: "Show the answer",
    hideAnswer: "Hide the answer",
    sources: n => (n === 1 ? "1 source" : `${n} sources`),
    askedAt: "asked",
    waiting: n => `${n} to evaluate`,
  },
  rating: {
    readerQuestion: "Is this answer right?",
    fits: "It is",
    doesNotFit: "It is not",
    readerThanks: "Thank you. An evaluator will look at it.",
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
  admin: {
    list: {
      heading: "Tenant administration",
      intro: "An overview of the organisations on the platform. The numbers are computed when the page is opened and are stored nowhere. This role does not give access to the organisations' content — documents and acknowledgements.",
      newTenant: "New organisation",
      disabled: "disabled",
      noDomainWarning: "Nobody can sign in to this organisation — signing in is tied to domains. Add at least one.",
      emptyTitle: "No organisations",
      emptyText: "Add the first one with the button above.",
      people: "People",
      peopleValue: (signedIn, total) => `${signedIn} / ${total} signed in`,
      versions: "Versions",
      documents: "Documents",
      documentsValue: (valid, total) => `${valid} / ${total} effective`,
      acknowledgements: "Acknowledgements",
      withoutVersion: "no effective version",
      instructionsSent: (when, to) => `Domain instructions sent ${when} to ${to}`,
      domainsNoteBefore: "The state of the domains in Vercel is shown by ",
      domainsNoteAfter: "; it will appear on this screen in scope C, together with tenant creation.",
    },
    create: {
      heading: "New organisation",
      introBefore: "A subdomain under ",
      introMiddle: " works straight away — a wildcard covers it. A customer's own domain is added to Vercel automatically and all that is left for them is to set one ",
      introAfter: ".",
      code: "Organisation code",
      codeNoteBefore: "Capital letters, digits, hyphen. Every person, document and acknowledgement carries it — ",
      codeNoteHighlight: "it never changes afterwards",
      codeNoteAfter: " — it is part of every document's identifier.",
      codeTaken: "The code {code} is already taken. Pick another one.",
      name: "Name",
      nameNote: "What people will see in the portal header. The organisation code is suggested from it — feel free to replace it with the abbreviation the organisation uses.",
      supportEmail: "Organisation contact",
      supportEmailNote: "The domain instructions go here.",
      domains: "Domains",
      domainsPlaceholder: "club.contineo.app",
      domainsNote: "One per line. Without a domain the organisation's portal will not appear anywhere.",
      submit: "Create",
    },
    detail: {
      disabled: " · disabled",
      numbersHeading: "Organisation numbers",
      tracks: "Tracks",
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
      autoProvisionNotHosts: "These are email domains of work accounts (name@futbalsfz.sk), not the portal web addresses — those are on the Domains tab.",
      save: "Save",
      disableHeading: "Disable the organisation",
      enableHeading: "Enable the organisation",
      disableNote: "Once disabled, nobody from this organisation can sign in — immediately. The acknowledgement records remain and the tenant is not deleted.",
      confirmLabel: (code) => `Type ${code} to confirm`,
      confirmHint: "Deliberately not a plain “are you sure?” — that gets clicked away before it is read.",
      domainsSection: "Domains and provisioning",
      sendTitle: "Send domain instructions",
      disableOpen: "Disable…",
      enableNote: "People from the organisation can sign in again.",
      cancel: "Cancel",
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
      removeOwnTitle: p => `Remove your own ${p} sign-in`,
      removeOwnNote: "Sign-in falls back to the supplier's setup if there is one; otherwise the button disappears from the sign-in screen.",
      removeOpen: "Remove…",
      cancel: "Cancel",
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
    "certificate.notFound": "The certificate does not exist.",
    "csv.expectedRequired": "short text needs the expected answer in answer_1",
    "csv.trueFalse": "for true/false, correct is true or false",
    "csv.correctOutOfRange": "a number in correct is not among the filled answers",
    "csv.multipleTwo": "multiple choice needs 3–8 answers and at least two numbers in correct",
    "csv.singleOne": "single choice needs 2–8 answers and exactly one number in correct",
    "csv.difficulty": "difficulty is easy, medium or hard",
    "csv.weight": "the weight must be a whole number of at least 1",
    "csv.tagShape": "the smart:tag is not in the form Key: Value",
    "csv.tagsRequired": "a smart:tag is missing",
    "csv.textRequired": "the question text is missing",
    "csv.duplicateId": "the id appears twice in the file",
    "csv.type": "unknown question type",
    "attempt.closed": "The attempt is already closed.",
    "attempt.notFound": "The attempt was not found.",
    "attempt.notEnoughQuestions": "The bank does not have enough questions for this test.",
    "attempt.passed": "You have already passed the test.",
    "attempt.exhausted": "All attempts have been used.",
    "attempt.pause": "Another attempt is not possible yet — the test has a pause between attempts.",
    "attempt.testNotFound": "There is no such test.",
    "test.notFound": "There is no such test.",
    "test.noTitle": "The test title is required.",
    "test.keyTaken": "The test “{key}” already exists.",
    "test.keyShape": "The test key “{key}” has the wrong shape.",
    "test.keyReserved": "The test key “{key}” is reserved for a part of the Tests section — choose another.",
    "question.notFound": "There is no such question in the bank.",
    "question.trueFalseMissing": "Choose whether true or false is correct.",
    "question.weight": "The weight must be a whole number of at least 1.",
    "question.tagRequired": "The question needs at least one smart:tag — without it no test will draw it.",
    "question.expectedRequired": "The expected answer is missing.",
    "question.altRequired": "The image description is missing.",
    "question.answerEmpty": "An answer is empty.",
    "question.multipleTwoCorrect": "Multiple choice must have at least two correct answers.",
    "question.singleOneCorrect": "Single choice must have exactly one correct answer.",
    "question.tooManyAnswers": "There can be at most 8 answers.",
    "question.tooFewAnswers": "Too few answers — single choice needs at least 2, multiple choice at least 3.",
    "question.contentRequired": "The question needs text or at least one image or video.",
    "learning.audienceRequired": "Choose the recipients.",
    "learning.urlInvalid": "The video address is not valid — YouTube, Vimeo and https links are supported.",
    "learning.fileRequired": "Upload a file first.",
    "learning.documentRequired": "Choose a document from the library.",
    "learning.textRequired": "The block text is empty.",
    "learning.altRequired": "The image description is missing.",
    "learning.partTitleRequired": "The part title is required.",
    "learning.mediaType": "The file {name} is not an image or an MP4/WebM video.",
    "learning.topicRequired": "Choose the course topic.",
    "learning.mergeNeedsTwo": "Merging needs at least two smart:tags.",
    "learning.tagShape": "“{value}” is not a smart:tag in the form “Key: Value”.",
    "learning.courseKeyShape": "The course key “{key}” has the wrong shape — lowercase letters without diacritics, digits and hyphens.",
    "learning.courseKeyReserved": "The course key “{key}” is reserved for a part of course management — choose another.",
    "learning.titleRequired": "The course title is required.",
    "learning.courseKeyTaken": "A course with the key “{key}” already exists.",
    "learning.courseNotFound": "There is no such course.",
    "learning.noDraft": "The course has no draft — a published version does not change. Start a new version.",
    "learning.draftExists": "The course already has a draft in progress.",
    "learning.notPublished": "The course is not published.",
    "learning.notOpen": "You cannot enrol in this course — it is not open.",
    "learning.reasonRequired": "A reason is required.",
    "learning.enrollmentCancelled": "The course enrolment has been cancelled.",
    "learning.blockNotFound": "There is no such block in the course.",
    "learning.partNotFound": "There is no such part in the course.",
    "learning.locked": "This part is locked — finish the previous required parts first.",
    "learning.videoNotWatched": "Watch the required video first.",
    "learning.testNotPassed": "Pass the required test first.",
    "learning.topicLabelRequired": "The topic name is required.",
    "learning.topicKeyShape": "The topic key may contain only lowercase letters without diacritics, digits and underscores.",
    "learning.topicKeyTaken": "A topic with this key already exists (including retired ones).",
    "legalBasis.unknownKey": "There is no such item in the legal bases list, or it is hidden or retired.",
    "legalBasis.badKey": "The key may contain only lowercase letters without diacritics, digits and underscores.",
    "legalBasis.labelRequired": "The name of the legal basis is required.",
    "legalBasis.keyTaken": "This key is already in the list (including hidden and retired items).",
    "legalBasis.notCustom": "The organisation has no such custom item.",
    "legalBasis.notStandard": "No such standard item exists.",
    "responsibility.personRequired": "A responsible person is required — people acknowledging the version will turn to them.",
    "responsibility.unknownPerson": "The selected responsible person is not here or has been deactivated.",
    "responsibility.samePerson": "This is already the responsible person for this version.",
    "responsibility.reasonRequired": "A reason for changing the responsible person is required — a year from now it must be clear why the contact changed.",
    "responsibility.notContentManager": "The responsible person is set by the content manager.",
    "legalBasis.invalid": "The system does not know this legal basis.",
    "legalBasis.referenceRequired": "A legal reference is required for a legal obligation (for example Section 7 of Act No. 124/2006 Coll.).",
    "legalBasis.referenceTooLong": "The legal reference is too long — a citation is enough, not the text of the provision.",
    "legalBasis.noChange": "The legal basis is already set this way.",
    "legalBasis.reasonRequired": "A reason for changing the legal basis is required — acknowledgements made in the meantime keep the original one.",
    "legalBasis.notAllowed": "The legal basis is set by the responsible person for this version. The content manager may set it only when the version has no responsible person or they are no longer active.",
    "legalBasis.noDraft": "The document has no version in preparation — the legal basis is set on a published version.",
    "legalBasis.draftNotAllowed": "The legal basis of a version in preparation is set by its responsible person. The content manager may set it only when the preparation has none or they are no longer active.",
    unknown: "That did not work. Try again.",

    // version approval (ADR-006)
    "approval.noApprovers": "Pick at least one approver. A round without them could never be closed.",
    "approval.selfApproval": "You cannot pick yourself. Whoever uploaded the text does not approve it \u2014 otherwise approval is a signature under your own work.",
    "approval.alreadyRunning": "A round is already running for this version. Wait for it to close, or cancel it.",
    "approval.alreadyApproved": "This version is approved. Different text means a new version, not a new round.",
    "approval.publishedBefore": "This version was published before approvals existed and is not approved retroactively. An official version will replace it.",
    "approval.unknownApprover": "One of the chosen approvers is not here or has been deactivated.",
    "approval.documentNotFound": "No such document here.",
    "approval.pdfRequired": "The draft has no PDF — upload the version again with a PDF. The PDF is approved together with the text.",
    "approval.draftChanged": "The draft has changed in the meantime — reload the page and submit it again.",
    "approval.reasonRequired": "A round cannot be cancelled without a reason. A year from now nobody would know why it ended.",
    "approval.nothingRunning": "No round is running for this version.",
    "assignment.notApproved": "This version is not approved. Only text somebody has agreed on can be assigned \u2014 submit it for approval on the document page.",
    "approval.notApprover": "This round is not waiting for you \u2014 you are not one of its named approvers.",
    "approval.roundClosed": "The round is closed. No decision can be added to it now.",
    "approval.alreadyDecided": "Your decision is recorded and does not change. If you change your mind, the submitter cancels the round and opens a new one \u2014 the history shows both.",

    // ── file conversion ────────────────────────────────────────────────────
    "conversion.zipNotOffice": "This is a ZIP archive, but neither docx nor xlsx. Legacy .doc and .xls cannot be converted — save them from Word or Excel in a newer format.",
    "conversion.unsupportedFormat": "We cannot convert {format} yet. Supported: .docx, .pdf, .xlsx, .md, .txt and .csv.",
    "rewrite.answerTruncated": "The model did not finish the document — the answer is truncated. Half a regulation is unusable; split the document and rewrite it in parts.",
    "library.noStructureFound": "No structural level was found in the text (PART, chapter, Article, annex). Either the text is structured differently, or it is a scan and needs the language model to transcribe it.",
    "conversion.pdfEngineFailed": "This PDF could not be opened. It is either damaged or password-protected, or the fault is on our side — retrying will not help. Contact the system administrator; details are in the log.",
    "conversion.pdfNoText": "This PDF contains no text — it is an image (a scan). The conversion cannot read it. In the editor you can have the language model transcribe it, or ask the author for the original file.",
    "conversion.noText": "The file contains no text.",

    // ── stored file ────────────────────────────────────────────────────────
    "file.empty": "The file is empty.",
    "file.tooLarge": "The file is {mb} MB; the limit is {maxMb} MB.",
    "file.nameRequired": "The file has no name.",
    "file.uploadNotFound": "The upload was not found or has expired. Start again.",
    "file.chunkInvalid": "Part of the file did not arrive complete. Try uploading again.",
    "file.uploadIncomplete": "The file did not arrive complete. Try uploading again.",

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
    "objection.emptyText": "The wording of the objection is missing.",
    "objection.alreadyPending": "Your previous objection is still being assessed.",
    "archive.no-current": "The document has no valid version that could be archived.",
    "archive.already-archived": "The document is already archived.",
    "archive.upcoming": "The document has a published amendment that is not yet in force. It can be archived once it applies.",
    "archive.draft": "A new version is being prepared. Finish or discard it first.",
    "archive.round-open": "An approval round is in progress. Finish it first.",
    "archive.date-before-start": "The date must be later than the start of the version's validity.",
    "archive.no-reason": "The reason for archiving is missing.",
    "archive.not-archived": "The document is not archived.",
    "archive.bad-date": "The date is not valid.",
    "objection.badDate": "The date received is not a valid date.",
    "objection.futureDate": "The date received cannot be in the future.",
    "objection.badDecision": "Choose whether to uphold or reject the objection.",
    "objection.noteRequired": "The decision needs a reasoning.",
    "objection.personNotFound": "There is no person with the address {email} in the organisation.",
    "objection.notFound": "There is no such objection here.",
    "objection.notPending": "The objection has already been decided.",
    "person.badEndedAt": "The end date is not a valid date.",
    "person.endedInFuture": "The end date cannot be in the future.",
    "person.endedNotInactive": "The end of the relationship is entered only for an excluded person.",
    "person.badEmail": "That is not an email address.",
    "person.emailTaken": "{email} is already in the organisation.",
    "person.alreadyInvited": "{email} is already recorded in the organisation.",
    "person.nameRequired": "The name is required — without it the list shows only the address.",
    "person.nameRequiredShort": "The name is required.",
    "tenant.overdueDaysRange": "The number of days must be between 1 and 365.",
    "tenant.phonePrefixShape": "The dialling code “{value}” has the wrong shape — something like +421 is expected.",
    "tenant.registrationNumberShape": "The company ID “{value}” has the wrong shape — 6 to 12 digits are expected.",
    "tenant.privacyContactEmailShape": "“{value}” is not an e-mail address.",
    "person.givenNameRequired": "The first name is required.",
    "person.surnameRequired": "The surname is required.",
    "person.unknownWorkplace": "The workplace “{value}” is not in the organisation's code list. Add it under Organisation → Code lists.",
    "phone.noPrefix": "“{value}” has no dialling code — write it with a leading zero (0905…) or internationally (+421…).",
    "phone.shape": "“{value}” does not look like a phone number.",
    "phone.invalid": "“{value}” is not a valid phone number for the selected country — check the country and the number of digits.",
    "person.departmentNotFound": "There is no such department.",
    "person.unknownType": "Unknown person type.",
    "person.unknownGender": "Unknown gender.",

    // ── assigning documents ────────────────────────────────────────────────
    "assignment.missingReason": "The reason for the assignment is required — it is the only place to record why the document has to be acknowledged again (D30).",
    "assignment.missingCompany": "The organisation code is missing.",
    "assignment.missingSubject": "The document or its version is missing.",
    "assignment.versionNotEffective": "The version has no effective date, so it cannot be acknowledged either (D6). Give it an effective date first.",
    "assignment.missingAudience": "It is missing who this is assigned to.",
    "assignment.badDue": "The deadline is not a valid date.",
    "assignment.badDueDays": "A deadline in days must be at least one day.",
    "assignment.dueBeforeEffective": "The deadline falls before the version takes effect — nobody could meet such a duty (D6).",

    // ── tracks ─────────────────────────────────────────────────────────────
    "track.titleRequired": "The track title is required.",
    "track.notFound": "There is no such track here.",
    "track.titleTaken": "A track named “{title}” already exists — the name must be unique; tracks are chosen and imported by it.",
    "track.badDueDays": "The number of days must be between 1 and 365.",
    "track.noMembersChosen": "Choose people or a department.",
    "track.documentNotFound": "Document “{documentId}” is not in this organisation.",
    "track.noSteps": "An empty track cannot be switched on — add steps to it first.",

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
    "tenant.alreadyExists": "Organisation {code} already exists. {free} is free — use that, or pick your own abbreviation.",
    "ai.keyRejected": "Anthropic rejected the key — check that it is complete and valid.",
    "ai.keyUnverified": "The key could not be verified — Anthropic is not responding. Try again in a moment.",
    "ai.unknownModel": "The model “{value}” is not on offer.",
    "helpdesk.nameRequired": "The channel name is required.",
    "helpdesk.notFound": "There is no such channel here.",
    "helpdesk.mailboxKind": "Unknown mailbox type.",
    "helpdesk.mailboxAddress": "The mailbox address is not an e-mail address.",
    "helpdesk.graphIds": "For Microsoft 365 the tenant and the application client id are required.",
    "helpdesk.noMailbox": "The channel has no mailbox.",
    "helpdesk.noSecret": "The mailbox has no stored application secret.",
    "helpdesk.secretUnreadable": "The mailbox secret cannot be decrypted — enter it again.",
    "helpdesk.imapNotYet": "IMAP mailboxes are not available yet — Microsoft 365 only for now.",
    "connector.nameRequired": "The connector name is required.",
    "connector.endpoint": "The server address must be complete and start with https://.",
    "connector.profile": "Unknown server profile.",
    "connector.badPattern": "The pattern “{pattern}” is not a valid regular expression.",
    "connector.scopeDuplicate": "Two scopes share the same key.",
    "connector.notFound": "No such connector here.",
    "connector.noPending": "Sign-in was not started or has expired — try again.",
    "connector.authStart": "The server did not allow sign-in to start ({detail}).",
    "connector.alreadyConnected": "The connector is already connected.",
    "connector.authFinish": "Exchanging the code for a token failed ({detail}).",
    "connector.notConnected": "The connector is not connected.",
    "connector.timeout": "The server did not answer in time.",
    "connector.unauthorized": "The connector sign-in has expired — connect it again.",
    "connector.ingestOff": "The connector has library import switched off.",
    "connector.noImportProfile": "This server profile does not support import.",
    "connector.nothingSelected": "No article is selected.",
    "library.notFromConnector": "This document did not come from a connector.",
    "helpdesk.hasTickets": "The channel has tickets — it cannot be removed, only left unused.",
    "helpdesk.kind": "Unknown channel type.",
    "helpdesk.syncInterval": "Unknown sync interval.",
    "helpdesk.noTickets": "The channel has tickets switched off.",
    "helpdesk.miningFailed": "FAQ mining failed (batch {batch}) — try again in a moment.",
    "ticket.notFound": "There is no such ticket here.",
    "ticket.notEmail": "The ticket did not come from an e-mail — it has no thread in the mailbox.",
    "ticket.emptyDraft": "An empty draft cannot be saved.",
    "ticket.emptyAnswer": "An empty answer cannot be sent.",
    "ticket.noRecipient": "The ticket has nobody to answer — the address is missing.",
    "ticket.aiFailed": "The assistant did not produce a draft — try again in a moment.",
    "ticket.emptyQuestion": "The ticket has no question text.",
    "widget.tokenShape": "The token is not a JWT.",
    "widget.tokenSignature": "The token signature does not match.",
    "widget.tokenExpired": "The token has expired.",
    "widget.tokenAudience": "The token belongs to another channel.",
    "widget.tokenIssuer": "The token issuer is not among the channel's allowed origins.",
    "widget.tokenClaims": "The token lacks the required person data.",
    "widget.noSecret": "The channel has no secret key.",
    "widget.rateLimited": "Too many questions — try again later.",
    "mailbox.auth": "The application could not sign in to Microsoft 365 — check the tenant, client id and secret.",
    "mailbox.forbidden": "The mailbox refused access — check the application permissions and the mailbox scoping.",
    "mailbox.notFound": "There is no mailbox with this address in the organisation.",
    "mailbox.cursorExpired": "The synchronisation cursor expired — the next run starts over.",
    "mailbox.failed": "The mailbox did not respond correctly.",
    "tenant.noEncryptionKey": "The secret cannot be stored: OAUTH_SECRET_ENCRYPTION_KEY is missing. We will not store it readable — it is access to someone else's system.",
    "tenant.needsBothCredentials": "Both clientId and the secret are needed — one without the other cannot be used.",

    // ── library ────────────────────────────────────────────────────────────
    "library.noFileChosen": "You did not choose a file.",
    "library.pdfRequired": "The version for approval must be a PDF — save the document from Word as PDF.",
    "library.sourceNotPdf": "The source file must be editable (.docx, .xlsx, .md…), not a second PDF.",
    "library.uploadedFileNotFound": "The uploaded file was not found. Try uploading it again.",
    "library.documentNotFound": "There is no such document here.",
    "chunking.unknownProfile": "The chunking profile “{value}” does not exist.",
    "chunking.labelRequired": "The profile needs a name.",
    "chunking.aiNoText": "The document has no text, there is nothing to analyse.",
    "chunking.aiNoKey": "Artificial intelligence has no key set — set it in Organisation → Artificial intelligence.",
    "chunking.aiFailed": "The analysis failed — try again in a moment.",
    "chunking.labelTaken": "A profile named “{value}” already exists — use it or choose another name.",
    "library.titleLocked": "The title of a document with a published version changes only with a new version — change it when preparing the new version; it is approved with it.",
    "library.documentExists": "The document \u201C{title}\u201D ({documentId}) already exists. A new version is uploaded on its detail page, not as a new document — this screen creates a new document.",
    "library.documentKeyShape": "The document key \u201C{key}\u201D has the wrong shape — only lowercase letters without diacritics, digits and underscores are allowed.",
    "library.noOriginalFile": "The document has no original file that could be transcribed.",
    "library.onlyPdfRewrite": "Only PDFs can be transcribed — other formats are converted directly.",
    "library.originalNotFound": "The original file was not found.",
    "library.noDraft": "There is no draft here.",
    "library.titleRequired": "The document title is required — without it the list shows only the key.",
    "library.emptyText": "Empty text cannot be saved — the document would have no content.",
    "library.labelRequired": "The version label is required — it appears verbatim in every acknowledgement record. Write what the document says (for example: consolidated text of 27 February 2026), not an invented number.",
    "library.effectiveFromRequired": "The effective date is required — without it the version cannot be acknowledged (D6).",
    "meta.badDate": "A date in the version details is not a valid date.",
    "meta.approvedOnInFuture": "The approval date cannot be in the future.",
    "meta.noDraft": "The document has no draft — version details are entered with a new version.",
    "meta.locked": "The version details can no longer change — the draft is under review or approved. A change would void the approval; upload a new version.",
    "meta.effectiveFromApproved": "The effective date was approved together with the version — it can only change with a new version and a new approval.",
    "meta.effectiveFromRequired": "Before submitting, fill in the effective date in the version details.",
    "library.effectiveFromSourceRequired": "The source of the effective date is required — write down where the date comes from (for example board resolution no. … of …). After the first acknowledgement the date can no longer be changed.",
    "library.documentHasNoText": "The document has no text — upload a file or write the wording first.",
    "library.noChunks": "The text produced no chunks at all. Check whether the document is organised into articles or headings.",
    "library.faqNoEntries": "The FAQ has no entries — add at least one question with an answer.",
    "library.faqQuestionRequired": "The question is required — without it the entry has nothing to answer.",
    "library.faqAnswerRequired": "The answer is required — a question without an answer does not belong in an FAQ.",
    "library.faqTooLong": "The entry is too long — the question up to {question} and the answer up to {answer} characters.",
    "library.faqEntryNotFound": "There is no such entry in this FAQ.",
    "library.faqSourceUnknown": "The source document {documentId} is not here.",
    "library.notFaq": "This document is not an FAQ.",
    "library.noPublishedVersion": "The document has no published version — only what is already out can be reindexed.",
    "library.versionHasNoText": "This version has no stored text — there is nothing to split.",
    "library.noChunksProfile": "The text produced no chunks at all — check the chunking profile.",
    "library.reindexWouldLoseArticles": "Reindexing would damage this document: it currently has {before} of {beforeTotal} chunks with a recognised article, and re-chunking would leave {after} of {afterTotal}. The text in the database uses a heading form the chunker does not know — until that is fixed, the existing chunking is better than the new one.",
    "library.reasonRequired": "The reason for the correction is required — without it, a year from now there is no way to tell whether it was a typo or a change of obligation.",
    "textFix.notContentManager": "Correcting the text of a version is the content manager's job.",
    "textFix.noEffectiveVersion": "The document has no effective version. Only what is out there can be corrected — an archived version is the record of what applied at the time.",
    "textFix.pastVersion": "An older version is not corrected — it is the record of what applied at the time. The current version and a published amendment not yet in force can be corrected.",
    "textFix.draftBusy": "A new version is being prepared — correcting the text would overwrite the draft in progress. Finish or discard it first.",
    "textFix.emptyText": "The draft has no text. A correction that leaves nothing behind is not a correction.",
    "textFix.draftChanged": "The draft changed in the meantime. Look at the difference again — what you saw is what should be saved.",
    "textFix.noChange": "The text does not differ from the effective version. There is nothing to correct.",
    "textFix.reasonRequired": "The reason for the correction is required — without it, a year from now there is no way to tell what changed in the version and why the acknowledgements stayed valid.",
    "library.versionNotFound": "There is no such version here.",
    "versionFix.locked": "The label and effective date can no longer be changed — {count} people have acknowledged this version and both values are part of the signed statement. First revoke the acknowledgements of this version, then correct the value and have it acknowledged again.",
    "versionFix.reasonRequired": "A reason for the correction is required.",
    "revocation.notHr": "Only HR may revoke an acknowledgement.",
    "revocation.nothingToRevoke": "There is nothing to revoke — this version has no valid acknowledgements.",
    "revocation.reasonRequired": "A reason for the revocation is required — without it nobody can tell a year later why the duty came back.",
    "write-failed": "The write failed. Try again; whatever was already written stays valid.",

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
      "ai-settings": "artificial intelligence",
      ticket: "helpdesk ticket",
      "helpdesk-channel": "helpdesk channel",
      tenant: "tenant",
      track: "track",
      course: "course",
      enrollment: "course enrolment",
      "smart-tag": "smart:tag",
      question: "question",
      test: "test",
      "test-attempt": "test attempt",
      certificate: "certificate",
    },
    actions: {
      created: "created",
      membersAdded: "added to track",
      memberRemoved: "removed from track",
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
      "chunking-profile": "chunking profile",
      "version-fix": "version correction",
      "text-fix": "text correction",
      "new-version": "new version uploaded",
      "responsible-changed": "responsible person changed",
      "legal-basis": "legal basis",
      merged: "merged",
      "imported": "imported",
      "reset": "reset",
      "archived": "archived",
      "validity-restored": "validity restored",
      "retired": "retired",
      "course-version": "new course version",
    },
    fields: {
      folder: "folder",
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
    previewLabel: "This is how it will look",
    previewButton: "Acknowledge",
    previewChipKey: "Kind:",
    previewChip: "Norm",
    previewLink: "a link in text",
    showCustom: "Enter a custom value",
    hideCustom: "Hide the custom value",
  },
  org: {
    heading: "Organisation",
    introBefore: "The settings you manage yourselves. The organisation code (",
    introAfter: ") and switching the portal off are deliberately not here — for those, get in touch with us.",
    tabsLabel: "Settings sections",
    groups: { org: "Organisation", access: "Access", documents: "Documents", oversight: "Oversight" },
    tabs: {
      general: "General",
      departments: "Departments",
      domains: "Domains",
      signin: "Sign-in",
      codelists: "Code lists",
      ai: "Artificial intelligence",
      connectors: "Connectors",
      acknowledgements: "Acknowledgement",
      audit: "Audit",
      gdpr: "GDPR",
    },
    gdpr: {
      readOnly: "These settings are managed by the data protection officer (DPO). You can only view them.",
      saveContact: "Save contact",
      contactSaved: "The GDPR contact has been saved.",
      saved: "GDPR settings saved.",
    },
    connectors: {
      intro: "A connection to an external MCP server with several uses. Live source: the assistant also searches the server when asked and cites the result as unreviewed. Import into the library and assistant tools come later.",
      none: "No connector yet.",
      add: "Add connector",
      edit: "Edit",
      name: "Name",
      endpoint: "Server address",
      endpointHint: "Full address of the MCP server, e.g. https://mcp.sportnet.online/mcp.",
      profile: "Server profile",
      status: { new: "Not connected", connected: "Connected", disconnected: "Disconnected", error: "Error" },
      connectedBy: (by, date) => `Connected by ${by} (${date}).`,
      connect: "Connect",
      reconnect: "Connect again",
      disconnect: "Disconnect",
      remove: "Remove",
      removeConfirm: "Remove the connector? Channels referring to it lose its scopes.",
      secRetrieval: "Live source",
      secRetrievalNote: "When asked, the server is called alongside the library. The result bypassed the curator, so the citation marks it as unreviewed.",
      retrievalOn: "Use as a live source",
      defaultOn: "Use by default when asking",
      defaultOnNote: "Off: on the portal the library is searched by default and a person switches this source on with the pill under the question. Channels are unaffected — their scope is chosen by the channel admin.",
      ingestOn: "Allow import into the library",
      ingestNote: "A curator can save articles from the server as document drafts (Library → Upload → Import from a server).",
      accessLevel: "Access level",
      accessInternal: "Internal — signed-in portal users only",
      accessPublic: "Public — also the widget and ticket draft answers",
      accessHint: "The server gives the account everything and cannot tell public from internal — the level belongs to the connector. An internal connector never reaches e-mails.",
      secScopes: "Scopes",
      secScopesNote: "Named slices of the server that channels pick from. The server applies the filter before searching.",
      scopesField: "Scopes",
      scopesHint: fields => `One scope per line: key | label | ${fields}. For example: issf | ISSF | project=issf`,
      secReduction: "Reduction",
      secReductionNote: "A narrowing for internal readers, not a gate for the public. All deterministic; empty fields cut nothing.",
      dropSections: "Drop sections",
      dropSectionsHint: "Section headings, one per line (e.g. Key files, Data).",
      scrubPatterns: "Patterns in text",
      scrubPatternsHint: "Regular expressions, one per line; matches become […] (e.g. T_[A-Z_]+).",
      skipPaths: "Skip paths",
      skipPathsHint: "Regular expressions over the article path on the server, one per line (e.g. -rules-).",
      tools: "Server tools",
      toolsNone: "The tool list loads on connect.",
      save: "Save",
      saved: "Connector saved.",
      created: "Connector created — now connect it.",
      removed: "Connector removed.",
      connected: "Connector connected.",
      disconnected: "Connector disconnected.",
      lastError: "Last error",
      personalAccountNote: "The connection runs under the account of whoever connected it — the server shows what that account sees. Once the server offers service access, it will connect with that (ADR-029).",
    },
    ai: {
      intro: "The assistant, question rewriting and scan transcription use Anthropic's Claude model. Here you set which key pays for it and which models are used.",
      secProvider: "Provider",
      provider: "Anthropic (Claude)",
      providerNote: "The only supported provider for now.",
      secKey: "API key",
      secKeyNote: "With its own key the organisation pays Anthropic directly for its calls. Without one, the portal operator's key is used.",
      keyLabel: "New key",
      keyHint: "It is verified on save. A stored key is never shown again, only its last characters. An empty field leaves the key unchanged.",
      keyOwn: (hint, date, by) => `The organisation's key …${hint} is set (${date}, ${by}).`,
      keyOperator: "The organisation has no key of its own — the portal operator's key is used.",
      keyNone: "No key is set — the assistant and scan transcription do not work.",
      deleteKey: "Remove key",
      deleteKeyNote: "Calls will then go through the portal operator's key.",
      secModels: "Models",
      secModelsNote: "Which model is used for which task. Prices are per million tokens according to Anthropic's price list. A change applies from the next call.",
      answer: "Assistant answers",
      answerNote: "A stronger model answers more precisely, but slower and at a higher cost. Sonnet 5.5 and Opus 5.5 think before answering — the first word comes later.",
      utility: "Question rewriting",
      utilityNote: "Runs before the search and is waited for, so only the fastest model.",
      rewrite: "PDF scan transcription",
      rewriteNote: "Transcribes scanned regulations in the library into text.",
      price: (input, output) => `input $${input} · output $${output}`,
      save: "Save",
      saved: "The AI settings have been saved.",
      keyDeleted: "The organisation's key has been removed.",
    },
    aiUsage: {
      tabSettings: "Settings",
      tabUsage: "Usage",
      from: "From",
      to: "To",
      person: "Person",
      purpose: "Purpose",
      all: "all",
      apply: "Apply",
      exportCsv: "Export CSV",
      exportXlsx: "Export Excel",
      calls: "Calls",
      tokensIn: "Input",
      tokensOut: "Output",
      tokensCache: "Cache",
      total: "Amount",
      colWhen: "Date",
      colPerson: "Person",
      colWhat: "What for and why",
      colModel: "Model",
      colTokens: "Tokens",
      colSum: "Amount",
      keyTenant: "organisation's key",
      keyOperator: "operator's key",
      failed: "failed",
      empty: "AI was not used in this period",
      emptyText: "Try another period. Calls are recorded from 5 October 2026.",
      capped: (shown, all) => `Showing the ${shown} most recent of ${all}. The whole period is in the export.`,
      note: "The amount is an estimate in US dollars from Anthropic's price list on the day of the call; the invoice gives the exact figure. Question texts are not stored. Records are kept for 25 months.",
      purposes: {
        "answer": { label: "Assistant answer", why: "answering a question with citations from regulations" },
        "query-rewrite": { label: "Question rewriting", why: "rephrasing before the search so the right articles are found" },
        "query-classify": { label: "Search mode choice", why: "deciding between word search and meaning search" },
        "pdf-rewrite": { label: "PDF scan transcription", why: "a scan without a text layer is transcribed into the regulation text" },
        "markdown-clean": { label: "Text structure cleanup", why: "restoring headings and articles in converted text" },
        "chunking-analysis": { label: "Chunking analysis", why: "a proposal for splitting the document into chunks for search" },
        "faq-mining": { label: "FAQ mining", why: "FAQ entry proposals from the helpdesk mailbox history (ADR-028)" },
      },
    },
    branding: {
      name: "Portal name",
      nameNote: "What the portal is called — in the header, in emails and on the sign-in screen (for example “SFZ Intranet”).",
      shortName: "Short name",
      shortNameNote: "For the top bar, where a menu sits next to it — “SFZ” says the same thing there as the full name and leaves room for the rest.",
      logo: "Logo",
      logoCurrent: "current logo",
      logoEmpty: "logo 512×512",
      logoNote: "PNG, JPEG or WebP, at most 256 kB. Empty = leave unchanged. In the header the logo is 26 px — a bigger file adds nothing.",
      logoRemove: "Remove logo",
      logoRemoveNote: "Deletes the image and the reference to it. The header keeps the organisation name alone. Reversible by uploading a new logo.",
      color: "Colour",
      colorNote: "Buttons carry it with white text on top, which is why the shades are darker than you might want — a lighter tone means an unreadable button.",
      supportEmail: "Contact address",
      supportEmailNote: "Where someone should turn when something does not add up.",
      phonePrefix: "Default phone country",
      phonePrefixNote: "Offered for a person's phone; its dialling code is added to imported numbers entered with a leading zero (0905 123 456). This is not the organisation's phone number.",
      controller: "Data controller",
      controllerNote: "Shown in the data protection notice (Data protection page). An empty legal name means the portal name is used.",
      controllerLegalName: "Legal name",
      controllerAddress: "Registered address",
      controllerRegistrationNumber: "Company ID",
      controllerCountry: "Country of registered office",
      countries: { SK: "Slovakia", CZ: "Czechia" },
      secIdentity: "Portal name",
      secIdentityNote: "Name and logo in the header, in emails and on the sign-in screen. Below them, the organisation that runs the portal and processes personal data.",
      secContact: "Contact",
      secGdpr: "GDPR",
      secGdprNote: "Data protection contact shown on the Privacy page. People send objections and requests here by e-mail. Empty = people with the DPO role are shown.",
      gdprName: "Full name",
      gdprEmail: "E-mail address",
      gdprEmailNote: "A shared mailbox (e.g. gdpr@…), not a personal address — it stays when the DPO changes.",
      secAutoProvision: "Automatic sign-up",
      saveBarNote: "One save for the whole page.",
      controllerPreview: "On the Privacy page:",
      invitePreview: "In the invitation:",
      languages: "Languages",
      defaultLanguage: "Default language",
      defaultLanguageNote: "Applies to anyone who is not signed in yet.",
      autoProvision: "Auto-provisioning domains",
      autoProvisionBefore: "One per line. Anyone who signs in with a ",
      autoProvisionHighlight: "work account",
      autoProvisionAfter: " from this domain and is not yet in the list of people is created automatically as an ordinary member — no roles and no tracks. This applies to accounts only, not to the emailed link.",
      autoProvisionNotHosts: "These are email domains of work accounts (name@futbalsfz.sk), not the portal web addresses — those are on the Domains tab.",
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
      requestOpen: "Request a domain",
      cancel: "Cancel",
      pendingHeading: n => `Waiting for verification · ${n}`,
      pendingNote: "Verification works once the DNS record is set. A DNS change can take a few hours to show.",
      removeOpen: "Remove…",
      removeConfirm: h => `Remove the domain ${h}? People who reach the portal through this address will no longer get in.`,
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
      removeOwnTitle: p => `Remove your own ${p} sign-in`,
      removeOwnNote: "Sign-in falls back to the supplier's setup if there is one; otherwise the button disappears from the sign-in screen.",
      removeOpen: "Remove…",
      cancel: "Cancel",
    },
    codelists: {
      show: "Show",
      pick: "Code list",
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
        workplace: {
          name: "Workplaces",
          hint: "Towns and municipalities where people usually work — picked from on the person's card.",
        },
      },
      base: " · base",
      used: (n) => ` · used ${n}×`,
      remove: "Remove",
      newItemPlaceholder: "Guideline",
      newItemLabel: (codelist) => `Name of the new item — ${codelist}`,
      key: "Key",
      keyPlaceholder: "guideline",
      keyTakenHint: "This key is already in the code list — change the name or the key.",
      add: "Add",
      keyNote: "Key: lowercase letters without diacritics, digits and underscores. It stays in the content permanently and cannot be taken back — the name beside it can be changed.",
      examples: {
        category: { label: "e.g. Decision", key: "decision" },
        tags: { label: "e.g. youth", key: "youth" },
        workplace: { label: "e.g. Senec", key: "senec" },
      },
      moreBase: n => `+ ${n} more built-in`,
      colName: "Name",
      colKey: "Key",
      colUse: "Usage",
      baseBadge: "built-in",
    },
    acknowledgements: {
      heading: "Acknowledgement",
      intro: "The acknowledgement deadline is set on each assignment and each track. This is only the threshold for HR: after how many days without acknowledgement a person counts as overdue in Reminders and in the weekly summary.",
      overdueDays: "Overdue after (days)",
      overdueDaysNote: "Counted from when the duty arose — the assignment, joining the department or being added to the track. Nothing is sent to the people themselves because of it. The default is 14.",
      save: "Save",
    },
    actions: {
      saved: "Changes saved.",
      failed: "The change could not be saved. Try again.",
      confirmCode: (code) => `To remove it, type the organisation code (${code}).`,
      signInRemoved: "Sign-in credentials removed.",
      logoRemoved: "Logo removed.",
      domainRequested: "Recorded. Now set the CNAME with your DNS administrator and ask for verification.",
      domainNotFound: "We have no such request.",
      domainWaiting: (host) =>
        `${host} does not point at us yet. A DNS change is usually visible within the hour;` +
        " if it takes longer, check the CNAME.",
      domainOnNotInVercel: (host) => `${host} is on, but it was not added to Vercel — get in touch with us.`,
      domainOn: (host) => `${host} is on. The portal answers there.`,
      domainRemoved: "Domain removed. The portal stopped answering there.",
      codelistRemoved: "Removed from the menu. Documents that carry this value keep it.",
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
      internal: "internal (official, committee…)",
      employee: "employee",
      external: "external — only via a foreign system, no intranet access",
    },
    genders: { male: "male", female: "female", none: "not set" },
    languages: {
      sk: "Slovak",
      cs: "Czech",
      en: "English",
    },
    roles: {
      hr: "hr — assigns documents and sees who has not acknowledged them",
      "people-admin": "people-admin — manages people (this screen)",
      "content-admin": "content-admin — uploads and edits documents in the library",
      evaluator: "evaluator — reviews the system's answers when someone says they are wrong",
      dpo: "dpo — data protection officer: reviews legal bases, decides on objections",
      "learning-admin": "learning-admin — instructor: manages courses, the question bank and tests",
      helpdesk: "helpdesk — agent: answers tickets of their channels and proposes FAQ entries",
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
      emptyTitle: "No people yet",
      emptyText: "Add the first one with the button above, or import a CSV to add many at once.",
      emptyFilterTitle: "Nothing matches the filter",
      emptyFilterText: "Try part of a name or an e-mail.",
      clearFilter: "Clear the filter",
      count: (n) => `${n} ${n === 1 ? "person" : "people"}`,
      matchesSearch: " matching the search",
      capped: " — showing the first 500, narrow the search",
      status: {
        new: "new",
        invited: "invited",
        active: "active",
        inactive: "excluded",
      },
      neverSignedIn: "never signed in",
    },
    inviteAll: {
      heading: "Bulk invitations",
      intro: "People who have never signed in. The email carries a link to the portal, not a sign-in link — those are short-lived and mail gateways consume them before the person gets there.",
      emptyTitle: "Everyone is invited",
      none: "Nobody is waiting for an invitation — everyone has signed in at least once.",
      preview: "This goes to the addresses listed. A sent email cannot be taken back.",
      send: people => people === 1 ? "Send 1 invitation" : `Send ${people} invitations`,
      sent: n => `Sent: ${n}.`,
      nobody: "There is nobody to invite.",
      open: "Bulk invitations",
    },
    invite: {
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
      gender: "Gender",
      genderNote: "For composition statistics and for grammar in Slovak and Czech texts (e.g. on a certificate). Not guessed from the name.",
      submit: "Invite",
    },
    import: {
      heading: "Import from CSV",
      introBefore: "First you see ",
      introHighlight: "what would happen",
      introMiddle: ", and only then is anything written. Uploading a hundred people blind is exactly the operation after which people look for the undo button — and there is none. Everyone is recorded in organisation ",
      introAfter: ", even if the file says otherwise.",
      existingTitle: "Anyone already in the system is not created again",
      existingNote: "They are matched by e-mail and only their empty fields are filled in. Whatever they already have stays — even when the file carries a different value. Status, language, roles and groups are not touched. The import excludes nobody.",
      overwriteLabel: "Update existing people with the values from the file",
      overwriteNote: "A column the file has overwrites the existing person\u2019s value — and an empty cell clears it: empty \u201cgroups\u201d means that person belongs to none. Whatever is not in the file stays untouched.",
      file: "CSV file",
      fileNoteBefore: "The first row is the header. These are recognised: ",
      fileNoteAfter: " — with or without diacritics, and with a semicolon as the separator, the way Excel saves it.",
      reading: "Reading…",
      whatHappens: (name) => `What will happen — ${name}`,
      rows: "Rows",
      willAdd: "Will be added",
      willUpdate: (overwrite) => overwrite ? "Exists — will be updated" : "Exists — will be topped up",
      invalid: "Invalid",
      unchanged: "Unchanged",
      statuses: { new: "New", fill: "Will be topped up", overwrite: "Will be updated", unchanged: "Unchanged", error: "Error" },
      fields: {
        fullName: "full name", givenName: "given name", surname: "surname", titleBefore: "title before name", titleAfter: "title after name",
        jobTitle: "job title", mobilePhone: "mobile", workplace: "workplace", department: "department", personType: "person type",
        startDate: "start date", tracks: "tracks", groups: "groups", roles: "roles", language: "language", gender: "gender",
      },
      colStatus: "Status",
      colPerson: "Person",
      colChanges: "What gets written",
      filterAll: "All",
      noRowsForFilter: "No row matches this filter.",
      searchPlaceholder: "Search by name or e-mail",
      nothingToWrite: "nothing — already has it all",
      emptyValue: "—",
      unknownWorkplaces: "Workplaces not in the code list — these rows go through, just without a workplace:",
      unknownTracks: "Tracks that do not exist in the organisation (the tracks column expects a track name) — these rows go through, just without them:",
      badPhones: "Numbers that could not be read — these rows go through, just without a phone:",
      statusNoteBefore: "Existing people ",
      statusNoteHighlight: "keep their status",
      statusNoteAfter: " — whoever has signed in stays signed in. A column the file does not have is never overwritten: language, groups, tracks and roles survive.",
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
      previously: (list) => `previously ${list}`,
      invitedNotSignedIn: "invited, has not signed in yet",
      newNotInvited: "new — no invitation has been sent yet",
      inviteNoteSent: (date) => `Invitation sent ${date}.`,
      excludedNoSignIn: "excluded — cannot sign in",
      lastSeen: (when) => `last seen ${when}`,
      never: "—",
      signsInVia: (list) => `signs in via ${list}`,
      email: "Email address",
      emailNote: "It can be changed — a person's identity does not rest on it. Acknowledgements are tied to their record, not to the address, so the history stays whole and the old address is kept in their history. What changes is where the sign-in link goes; signing in with a work account keeps working.",
      fullName: "Name",
      givenName: "First name",
      surname: "Surname",
      nameNote: "The full name is composed from the first name and the surname. That is what goes into the acknowledgement a person signs — which is why titles stay out of it.",
      nameMissing: "The first name and surname have not been separated yet. Fill them in — the full name is then composed from them.",
      titleBefore: "Title before the name",
      titleAfter: "Title after the name",
      titlesNote: "Record-keeping fields. They are deliberately absent from acknowledgements and the audit trail: a title is gained during a career, and the same person would then appear under a different name in older records.",
      jobTitle: "Job title",
      jobTitleNote: "A record-keeping field. It is filled in from the work account when the directory has it — but only while it is empty here, so a manual correction survives.",
      mobilePhone: "Mobile phone",
      mobilePhoneCountry: "Phone country",
      mobilePhoneNote: "Visible to everyone signed in to the organisation. Choose the country and write the number as it is written there (0905 123 456); it is stored internationally.",
      workplace: "Workplace",
      workplaceNone: "— no workplace —",
      workplaceNote: "The town or city where the person normally works. Picked from a list so it can be filtered on.",
      noWorkplacesBefore: "The list of workplaces is still empty — ",
      noWorkplacesLink: "add them under code lists",
      noWorkplacesAfter: ".",
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
      personTypeNote: "Who the person is to the organisation. The “external” type cannot sign in to the intranet (ADR-028); access to content is settled by the organisation and the document's access level. Referees and officials are groups, not a type.",
      language: "Interface language",
      languageNote: "The language we speak to this person in. Not the language of the documents they read.",
      gender: "Gender",
      genderNote: "For composition statistics and for grammar in Slovak and Czech texts (e.g. on a certificate). Not guessed from the name.",
      groups: "Groups",
      newGroup: "new group, e.g. referees",
      groupsNote: "Documents are assigned by these. The number is how many people have the group — a group nobody has receives nothing.",
      tracks: "Tracks",
      noTracks: "There are no tracks yet. They are created in Assigned documents → Tracks.",
      trackInactive: "off",
      trackUnknown: "unknown track (untick it if the person should not have it)",
      roles: "Roles",
      rolesNote: "The platform administrator cannot be assigned from here — that role belongs to the supplier's tenant and has its own path.",
      save: "Save",
      evidenceEmptyTitle: "No documents assigned",
      evidenceEmptyText: "Nobody has assigned this person a document to acknowledge yet.",
      accessSummary: "Access and membership",
      returnHeading: "Reinstate the person",
      excludeHeading: "Exclude the person",
      inviteHeading: "Invitation",
      inviteNote: "This person has never signed in. The invitation carries a link to the portal — they sign in with their work account or request a link by email.",
      inviteNoteSince: (date) => `On record since ${date}.`,
      inviteSubmit: "Send the invitation again",
      inviteSubmitFirst: "Send the invitation",
      returnNoteBefore: "They come back as ",
      returnNoteHighlight: "invited",
      returnNoteAfter: ", not active — active means “has already signed in”, and reinstating did not make that happen. Their first sign-in switches it.",
      returnSubmit: "Reinstate",
      excludeNote: "After exclusion they cannot sign in — immediately. The record and their acknowledgements stay as evidence of what the person read; they are deleted 3 years after the relationship with the association ends (ADR-012).",
      confirmLabel: "Type the address to confirm",
      confirmNote: "Deliberately not “are you sure?” — that gets clicked away before it is read.",
      excludeSubmit: "Exclude",
      endedAtLabel: "Relationship ended on (optional)",
      endedAtNote: "End of employment, licence, office or cooperation. The 3-year retention of acknowledgements runs from this date; if left empty, it runs from the day of exclusion.",
      endedAtHeading: "End of relationship",
      deactivatedOn: (date) => `Excluded on ${date}.`,
      endedAtCurrent: (date) => `Relationship ended on ${date}.`,
      endedAtMissing: "The end date is not filled in — retention runs from the day of exclusion.",
      endedAtSubmit: "Save date",
      tlDeactivate: "Deactivation",
      tlDeactivateSub: "today · can no longer sign in",
      tlEnded: "Relationship ended",
      tlEndedSub: "date below · if empty → from deactivation",
      tlRetention: n => `+ ${n} years`,
      tlRetentionSub: "acknowledgements are deleted",
      factDeactivated: "Deactivated",
      factEnded: "Relationship ended",
      factDeleteFrom: "Acknowledgements deleted from",
    },
    actions: {
      saved: "Saved.",
      invited: "Invited — the invitation has been emailed to them.",
      invitedNoEmail: "The person is on record, but the invitation did not go out. Try sending it again from their card.",
      inviteResent: (email) => `Invitation sent to ${email}.`,
      inviteFailed: "The invitation could not be sent. Try again in a moment.",
      inviteNotNeeded: "This person has already signed in — they do not need an invitation.",
      excluded: "Excluded. The record and their acknowledgements remain.",
      returned: "Reinstated. They sign in and the status switches by itself.",
      endedAtSaved: "End date saved.",
      confirmAddress: (email) => `To exclude, type the address (${email}).`,
      failed: "The change could not be saved. Try again.",
      noRight: "You do not have permission for that.",
      fileEmpty: "The file is empty.",
      noRows: "The file has no data rows. Does the first row contain headers?",
      importResult: (created, updated, unchanged, invalid, overwrite) =>
        `Added ${created}, ${overwrite ? "updated" : "topped up"} ${updated}, unchanged ${unchanged}` +
        (invalid ? `, invalid ${invalid}` : "") + ".",
    },
    search: {
      placeholder: "Search name, email or department",
      label: list => `Search the list: ${list}`,
      count: (shown, total) => `${shown} of ${total}`,
      picked: n => `Selected (${n})`,
      pickedOne: "Selected",
      none: query => `Nobody matches “${query}”.`,
      noneApprovers: "Deactivated people are not offered and you cannot approve your own draft.",
      noneResponsible: "Deactivated people are not offered.",
      clear: "Clear search",
      clearInput: "Clear",
      remove: name => `Remove ${name}`,
      keysDown: "to the list",
      keysEnter: "picks the only result",
      keysEnterOne: name => `picks ${name}`,
      keysEsc: "clears",
    },
  },
  report: {
    open: "Report an inaccuracy",
    whatIsWrong: "What is wrong with the answer?",
    placeholder: "For example: it cites a repealed article; it missed the exception in paragraph 3; it found a different document.",
    note: "Your question, the answer and the sources the system used are stored as well — without them there is no way to tell whether it found the wrong document or read the right one badly.",
    submit: "Send the report",
    sending: "Sending…",
    thanks: "Thank you. The report was saved together with the question and the sources.",
    failed: "The report could not be sent. Please try again.",
  },
  notifications: {
    title: "Notifications",
    bellLabel: (unread) => unread > 0 ? `Notifications — ${unread} unread` : "Notifications",
    unread: (n) => `${n} unread`,
    emptyTitle: "No notifications",
    emptyText: "They show up here when a version is published, reminders go out or reindexing finishes.",
    markAllRead: "Mark everything as read",
    allRead: (n) => `Marked as read: ${n}.`,
    retentionNote: (days) => `Notifications are deleted after ${days} days.`,
    kinds: {
      reindexed: (title, chunks) =>
        `“${title}” has been reindexed — ${chunks} ${chunks === 1 ? "chunk" : "chunks"}.`,
      rewritten: (title) => `The model finished rewriting “${title}”. Read the text before you accept it.`,
      remindersSent: (count) =>
        `Reminders sent: ${count} ${count === 1 ? "message" : "messages"}.`,
      versionPublished: (title, label) => `Published version “${label}” of “${title}”.`,
      responsibleAssigned: (title, label) => `You are the responsible person for version “${label}” of “${title}”. Please set the legal basis.`,
      draftResponsibleAssigned: (title) => `You are the responsible person for the version of “${title}” in preparation. You can set the legal basis before it is published.`,
      objectionSubmitted: () => "A new objection (Art. 21) is waiting for your decision.",
    },
  },
  responsibility: {
    responsiblePerson: "Responsible person",
    responsibleNote: "People acknowledging this version will turn to this person, who also decides the legal basis. It is set again for every new version — never carried over from the previous one.",
    choosePerson: "— choose a person —",
    noResponsible: "This version has no responsible person.",
    inactiveResponsible: "The responsible person is no longer active — a new one needs to be set.",
    setResponsible: "Set responsible person",
    changeResponsible: "Change responsible person",
    changeReason: "Reason for the change",
    changeReasonPlaceholder: "For example: the original responsible person has left the association",
    saveResponsible: "Save responsible person",
    responsibleHistory: n => (n === 1 ? "1 change of responsible person" : `${n} changes of responsible person`),
    responsibleChangeLine: (by, date, from, to) => `${by} · ${date} · ${from} → ${to}`,
    responsibleSaved: "The responsible person has been saved.",
    legalBasis: "Legal basis",
    basisLabel: {
      legal_obligation: "Compliance with a legal obligation",
      legitimate_interest: "Legitimate interest",
    },
    basisHint: {
      legal_obligation: "The duty to be familiar with it follows from law — for example health and safety rules.",
      legitimate_interest: "An internal directive without an explicit statutory basis.",
    },
    basisUnset: "not set",
    basisMissing: "The legal basis has not been set yet.",
    reference: "Legal reference",
    referencePlaceholder: "For example Section 7(3) of Act No. 124/2006 Coll.",
    referenceNote: "Required for a legal obligation.",
    basisReason: "Reason for the change",
    basisReasonNote: "Required when changing a basis that is already set — acknowledgements made in the meantime keep the original one.",
    saveBasis: "Save legal basis",
    basisWho: "The legal basis is set by the version's responsible person or the content manager.",
    basisHistory: n => (n === 1 ? "1 change of legal basis" : `${n} changes of legal basis`),
    basisChangeLine: (by, date, from, to) => `${by} · ${date} · ${from} → ${to}`,
    basisInPreparation: "set in preparation",
    basisSaved: "The legal basis has been saved.",
    contactHeading: "For questions about this regulation, contact",
    contactProfile: "directory profile",
    contactGone: "The responsible person is no longer active. For now, please contact the HR department with questions.",
    yourTaskHeading: "You are the responsible person for this version",
    yourTaskNote: "Set the legal basis on which records of acknowledgement of this version are processed.",
    draftTaskHeading: "Version in preparation — you are the responsible person",
    draftTaskNote: "This version is not published yet. You can set the legal basis now and it will carry over when the version is published. Until then it can be changed without giving a reason.",
    draftBasisSummary: "Legal basis of the version in preparation",
    draftEffective: (date) => `Effective from ${date}`,
    draftNewTitle: (title) => `New title: “${title}”`,
    draftText: "Text of the version in preparation",
    draftOpenPdf: "PDF of the new version",
    draftBasisSaved: "The legal basis of the version in preparation has been saved. It will carry over when the version is published.",
    pendingTaskHeading: (date) => `Version effective from ${date} — you are the responsible person`,
    pendingTaskNote: "This version is published but not yet in effect. Set the legal basis so the version has it from its first day in effect.",
    pendingBasisSummary: (date) => `Legal basis of the version effective from ${date}`,
    basisPageLead: "You are the responsible person for this regulation. Set here the legal basis on which records of acknowledgement are processed.",
    basisPageRead: "Open the regulation for reading",
    missingBasisTag: "no legal basis",
    missingBasisNote: "A regulation without a legal basis can still be assigned. The responsible person should, however, set it before going live.",
    missingOptionNote: "Missing a suitable option? Ask the organisation administrator to add it to the legal bases list.",
    multipleNote: "Choose one or more — from both groups if needed. If a legal obligation is among them, the acknowledgement record is not deleted on objection.",
    outsideCodelist: "outside the list",
    orgHeading: "Legal bases",
    orgHint: "The responsible person picks the legal basis for every version of a regulation from this list. Standard items can be hidden, custom ones retired — nothing is deleted, versions keep a copy.",
    standardTag: "standard",
    customTag: "custom",
    hiddenTag: "hidden",
    retiredTag: "retired",
    hide: "Hide",
    unhide: "Restore",
    retire: "Retire",
    addHeading: "Add legal basis",
    labelField: "Name",
    labelPlaceholder: "For example: Doping control",
    keyField: "Key",
    keyPlaceholder: "e.g. doping",
    categoryField: "Category",
    referenceField: "Legal reference",
    addButton: "Add",
    usedIn: n => (n === 1 ? "1 version" : `${n} versions`),
  },
  helpdesk: {
    heading: "Helpdesk",
    intro: "Tickets of the channels you are an agent of. The assistant drafts an answer from the channel's regulations and FAQ; you send it, never the system on its own.",
    noChannels: "You are not an agent of any channel. The organisation administrator adds you as an agent in Channels.",
    viewOpen: "Open",
    viewSent: "Answered",
    viewClosed: "Closed",
    viewAll: "All",
    empty: "No tickets.",
    colSubject: "Subject",
    colAsker: "Asked by",
    colChannel: "Channel",
    colState: "State",
    colUpdated: "Updated",
    colMessages: "Messages",
    state: { new: "new", drafted: "drafted", sent: "answered", closed: "closed", reopened: "reopened" },
    source: { chat: "chat", email: "e-mail" },
    mine: "mine",
    unassigned: "nobody",
    assignedTo: (name: string) => `handled by ${name}`,
    take: "Take",
    release: "Release",
    thread: "Thread",
    quotedHistory: "Earlier correspondence quoted in the e-mail",
    threadSummary: (n: number, lastFrom: string, lastAt: string) => `${n} messages · latest: ${lastFrom}, ${lastAt}`,
    threadImport: "Load thread history",
    threadImportHint: "Loads earlier messages of this thread from the mailbox — received and sent, including those from before synchronisation started.",
    msgThreadImported: (n: number) => n ? `Messages added from the thread: ${n}.` : "The thread is complete — there are no more messages in the mailbox.",
    fromHelpdesk: "Helpdesk",
    fromAsker: (name: string) => name || "Asker",
    attachments: (n: number) => (n === 1 ? "1 attachment (in the mailbox)" : `${n} attachments (in the mailbox)`),
    draftHeading: "Answer",
    draftIntro: "The assistant drafts an answer from the channel's regulations and FAQ. Edit it and send — the difference between the draft and the sent text is what the system learns from.",
    draftFromAi: "Draft an answer with the assistant",
    draftMeta: (model: string, when: string) => `draft by ${model}, ${when}`,
    noDraft: "No draft yet.",
    draftSources: "Draft sources",
    answer: "Answer text",
    answerHint: "Goes out as plain text from the channel mailbox address. Nothing is added.",
    saveDraft: "Save draft",
    send: "Send answer",
    sendHint: "Sends an e-mail to the asker and marks the ticket as answered.",
    sent: (by: string, when: string) => `sent ${when} (${by})`,
    sentUnchanged: "the draft was sent unchanged",
    sentEdited: "the draft was edited before sending",
    close: "Close ticket",
    reopen: "Reopen",
    toFaq: "Add to FAQ",
    toFaqIntro: "The sent answer becomes an entry in the draft of an FAQ document. Remove names and personal details before saving; the content manager approves it.",
    toFaqDocument: "FAQ document",
    toFaqSubmit: "Save to FAQ draft",
    toFaqDone: "The entry is in the FAQ draft.",
    noFaqDocuments: "There is no FAQ document in the library yet.",
    noMailbox: "The channel has no mailbox — the answer cannot be sent by e-mail.",
    msgDrafted: "The draft is ready. Review it before sending.",
    msgDraftSaved: "The draft is saved.",
    msgSent: "The answer has been sent.",
    msgTaken: "The ticket is yours.",
    msgReleased: "The ticket is released.",
    msgClosed: "The ticket is closed.",
    msgReopened: "The ticket is reopened.",
    aiFailed: "The assistant did not produce a draft — try again in a moment or write the answer yourself.",
  },
  widget: {
    open: "Ask",
    title: "Assistant",
    placeholder: "Type your question…",
    send: "Send",
    thinking: "Searching the regulations…",
    sources: "Sources",
    helpful: "Helpful",
    notHelpful: "Not helpful",
    thanks: "Thank you.",
    tryAgain: "Try asking differently, or write to the helpdesk.",
    noAnswer: "I could not find an answer in the regulations and FAQ.",
    escalateIntro: "The assistant did not help. Write to the helpdesk — a person will reply by e-mail to your address.",
    escalateMessage: "What do you need to resolve",
    escalateSubmit: "Send to the helpdesk",
    escalated: "Your message has been sent. The helpdesk will reply by e-mail.",
    error: "Something went wrong. Try again in a moment.",
    expired: "Your session expired — reload the page.",
    poweredBy: "Contineo",
  },
  channels: {
    heading: "Channels",
    kinds: { widget: "Widget", portal: "Portal" },
    kindHints: { widget: "Embeddable into an external page instead of search: the assistant (question and answer), optionally tickets and a helpdesk mailbox.", portal: "Articles, library and forms. The library exists today; articles and forms are in preparation." },
    kind: "Channel type",
    ticketsOn: "Tickets",
    ticketsHint: "After two negative ratings a person can write to the helpdesk; e-mails from the mailbox become tickets. Without tickets the channel is just the assistant.",
    portalNote: "A portal carries only the content scope and languages for now — the library will use them for public reading; articles and forms are in preparation.",
    builtIn: "Built in",
    builtInAssistant: "The assistant in the intranet — question and answer over the whole library for signed-in people; not configurable.",
    builtInPortal: "The library in the intranet — documents in force for signed-in people; not configurable.",
    tabsLabel: "Channel sections",
    tabList: "Channels",
    tabMyTickets: "My tickets",
    tabTickets: "Tickets",
    tabSettings: "Settings",
    agentsNote: "Agents matter when tickets are on.",
    back: "Channels",
    intro: "A channel is one place where people ask: it has its own content (library folders), mailbox, agents and widget. There can be several channels — one per project and audience.",
    list: "Channels",
    empty: "No channels yet.",
    newChannel: "New channel",
    edit: "edit",
    keyHint: "The channel key, assigned at creation. It is in the widget script address and in the token's aud claim; it never changes.",
    name: "Name",
    audience: "Audience",
    audienceHint: "Who the channel serves — club managers, referees, parents…",
    folders: "Channel content",
    foldersHint: "Library folders the assistant answers from. With none selected it sees the whole library of the organisation.",
    connectorScopes: "Live sources",
    connectorScopesHint: "Scopes of connected connectors the assistant searches alongside the library. With none selected, live sources are not used in this channel.",
    connectorScopesNone: "The organisation has no connected connector with a live source.",
    assignees: "Agents",
    assigneesHint: "People with the helpdesk role who see this channel's tickets.",
    languages: "Channel languages",
    mailbox: "Mailbox",
    mailboxIntro: "E-mails to the mailbox become tickets and replies go out from it. Microsoft 365 via Microsoft Graph; IMAP for ordinary services arrives with the first customer who has one.",
    mailboxNone: "Channel without a mailbox — chat and its tickets only.",
    mailboxKind: "Mailbox type",
    kindGraph: "Microsoft 365 (Graph)",
    kindImap: "IMAP (not available yet)",
    address: "Mailbox address",
    addressHint: "e.g. helpdesk@futbalsfz.sk — read from and replied from",
    tenantId: "Tenant (Directory ID)",
    clientId: "Application client ID",
    clientSecret: "Application secret (client secret)",
    clientSecretHint: "Stored encrypted; an empty field leaves it unchanged. The Entra registration procedure is in docs/NASADENIE_app.md.",
    secretSet: (hint: string, when: string, by: string) => `secret …${hint} set ${when} (${by})`,
    secretNone: "no secret set yet",
    sync: "Synchronisation",
    syncNow: "Synchronise now",
    syncNever: "has not run yet",
    syncLast: (when: string) => `last ${when}`,
    syncError: (code: string) => `last error: ${code}`,
    syncCounts: (created: number, appended: number, skipped: number) => `new tickets ${created} · appended ${appended} · skipped ${skipped}`,
    syncSinceHint: "The first run only marks the start: older messages do not become tickets, history goes to FAQ mining.",
    syncInterval: "Sync interval",
    syncIntervalHint: "How often the mailbox is checked automatically. Sync now works at any time.",
    syncIntervalOption: (m: number) => (m >= 1440 ? "once a day" : m >= 60 ? "every hour" : `every ${m} minutes`),
    syncDone: (created: number, appended: number, beforeStart: number) => `Synchronisation finished: new tickets ${created}, appended ${appended}, history messages skipped ${beforeStart}.`,
    verify: "Verify connection",
    verified: (address: string, name: string) => `The connection works: ${address}${name ? ` (${name})` : ""}.`,
    widget: "Widget for an external system",
    widgetIntro: "The external system (ISSF) issues a signed token with the person's identity after sign-in; the widget sends it with the question. The secret key is shown only once, right after creation.",
    widgetOrigins: "Allowed origins",
    widgetOriginsHint: "Addresses the widget may call from, one per line: https://issf.futbalsfz.sk",
    rateLimit: "Request limit per person and hour",
    rateLimitHint: "Protection against abuse (D14).",
    widgetSecret: "Secret key",
    widgetSecretRotate: "Create a new secret key",
    widgetSecretShown: "New secret key — copy it now, it will not be shown again:",
    widgetSecretNone: "not created yet",
    widgetSecretSet: (hint: string, when: string) => `…${hint}, created ${when}`,
    mining: "FAQ mining from history",
    miningIntro: "The model reads the latest mailbox threads, strips personal data and proposes FAQ entries into the draft of the selected FAQ document. Message bodies are not stored; the content manager approves the proposals through the version flow.",
    miningDocument: "FAQ document",
    miningLimit: "How many recent messages to read",
    miningRun: "Propose FAQ entries",
    miningDone: (threads: number, proposed: number, saved: number, duplicates: number) => `Mining finished: threads ${threads}, proposals ${proposed}, saved to the draft ${saved}, duplicates ${duplicates}.`,
    noFaqDocuments: "There is no FAQ document in the library yet — create one in Library → New document → FAQ.",
    tickets: (open: number, total: number) => `tickets: ${open} open of ${total}`,
    save: "Save channel",
    saved: "The channel is saved.",
    created: "The channel is created.",
    remove: "Remove channel",
    removed: "The channel is removed.",
    deployNote: "The Entra application needs Mail.Read and Mail.Send scoped to the channel mailbox (RBAC for Applications). Procedure: docs/NASADENIE_app.md § 5.",
  },
  library: {
    emptyForYou: "There are no documents for you here yet.",
    reader: {
      lead: "Rules and policies of your organisation that are in force.",
      search: "Search document titles",
      searchSubmit: "Search",
      emptyFilter: "No document matches.",
      validFrom: date => `in force from ${date}`,
    },
    flow: {
      heading: d => `New version from ${d}`,
      headingUndated: "New version",
      firstVersion: "First version",
      publishedHeading: d => `Version from ${d}`,
      steps: ["Preparation", "Approval", "Publication", "Assignment"],
      stepOf: n => `Step ${n} of 4`,
      subPrepare: "PDF, Word, version details",
      subPrepareDone: "done",
      subWaitSubmit: "waiting to be submitted",
      subInReview: (done, total) => `${done} of ${total} approved`,
      subApproved: "approved",
      subRejected: n => `round ${n} rejected`,
      subCancelled: n => `round ${n} withdrawn`,
      subWaitApproval: "waiting for approval",
      subPublished: "published",
      subAssign: "carry over assignments",
      statusPreparing: "preparation",
      statusInReview: (by, date) => `in approval · submitted by ${by} ${date}`,
      statusApproved: "approved, waiting to be published",
      statusRejected: date => `preparation · returned from approval ${date}`,
      statusPublished: date => `published ${date} · not assigned to anyone yet`,
      lead1: "Check what will be approved. After submitting, none of it can be changed.",
      lead1Rejected: "Fix what the approver pointed out, check the details and submit a new round. The rejection stays in the history.",
      rejectedBy: (who, date, n) => `${who} rejected ${date} · this stopped round ${n}`,
      cancelled: (date, n) => `Round ${n} withdrawn ${date}`,
      checkPdf: "PDF",
      checkPdfMissing: "The PDF is missing — the version cannot be submitted without it. Upload it via “Replace”.",
      checkSource: "Editable source",
      checkSourceNote: "the search text was made from it",
      checkSourceMissing: "no source — the search text was made from the PDF",
      replace: "Replace",
      showText: "Show text",
      metaHeading: "Version details",
      metaNote: "The effective date is required before submitting for approval.",
      approvers: "Approvers",
      approversPrefilled: "Prefilled from the last round, can be changed. You cannot approve yourself.",
      responsible: "Responsible person for the new version",
      responsibleNote: "If you choose them now, publication only confirms it, and right after publication they are asked to set the legal basis.",
      responsibleChosen: name => `Responsible person: ${name}. Chosen in preparation.`,
      basisChosen: label => `Legal basis: ${label}. Set in preparation; it will carry over when the version is published.`,
      basisWaiting: name => `The legal basis is not set yet. ${name} can set it before publication on the document page — there is a notification waiting.`,
      basisNoResponsible: "The legal basis is not set yet. While the preparation has no responsible person, the content manager can set it.",
      basisResponsibleGone: "The legal basis is not set yet and the responsible person from the preparation is no longer active — the content manager can set it.",
      basisSetHere: "Set the legal basis",
      basisChangeHere: "Change the legal basis",
      responsibleChange: "Change responsible person",
      note: "Note for approvers",
      submitAndSave: "Save and submit for approval",
      resubmit: n => `Save and submit round ${n}`,
      saveOnly: "Save only",
      lead2: (done, total) => `Waiting for approval — ${done} of ${total}. Once everyone approves, the version can be published. One rejection returns it to preparation.`,
      approvalsWhere: "Approvers decide in “To approve”; they were emailed on submission.",
      whatIsApproved: "What is being approved",
      locked: "locked during the round",
      searchText: "Search text",
      searchTextNote: "search answers from it",
      open: "Open",
      show: "Show",
      next: "Next",
      next3: "version label and responsible person",
      next4: "carrying over assignments from the previous version will be offered",
      next4None: "assigning in Assigned documents",
      withdraw: "Withdraw round",
      withdrawNote: "Withdrawing returns the version to preparation so it can be edited. The round stays in the history.",
      lead3: "The version is approved. Add a label and publish it.",
      labelSuggestion: d => `consolidated version from ${d}`,
      labelSuggested: "Suggested from the effective date. The label appears verbatim in the acknowledgement statement.",
      effectiveFromSourceSuggested: "Prefilled from the approved version details.",
      carryOver: n => `Assign the new version to the same recipients (${n})`,
      carryOverNote: "Untick to assign differently — you can then do it in step 4 or in Assigned documents.",
      publishFrom: d => `Publish from ${d}`,
      publishAndAssign: "Publish and assign",
      lead4: "Acknowledgement is tied to a version, so the new version has to be assigned again.",
      assignElsewhere: "Assign to other people →",
      assignChosen: "Assign to selected",
      newVersion: "New version",
      newVersionBusy: "A new version is already being prepared. Replace its files in preparation.",
      newVersionFirst: "The document has no current version yet — finish the first one.",
      downloadPdf: "Download PDF",
      downloadSource: "Download source file",
      editDocument: "Edit document",
      currentHeading: "Current version",
      upcomingHeading: "Upcoming version",
      upcomingNote: d => `Published; it comes into force on ${d}. Until then people read and confirm the current version above.`,
      fromDate: d => `from ${d}`,
      changeResponsible: "Change responsible person",
      changeBasis: "Change legal basis",
      fixData: "Correct details",
      history: "History",
      olderHeading: "Older versions",
      olderNone: "None. When a new version is published, the current one moves here.",
      older: {
        count: n => String(n),
        note: "People no longer see them; acknowledgements remain as evidence.",
        range: (from, to) => `${from} – ${to}`,
        published: date => `published ${date}`,
        acks: "acknowledged",
        noAcks: "no acknowledgements",
        ackCount: n => `${n} ${n === 1 ? "acknowledgement" : "acknowledgements"}`,
        more: "More actions",
        showAll: n => `Show all (${n})`,
        close: "Close",
        responsibleMissing: "missing",
        responsibleInactive: "deactivated",
        basisMissing: "basis not set",
      },
      manage: "Administration",
      archive: {
        heading: "Archive document",
        intro: "The document stops applying on the date you choose. The assistant stops answering from it, it cannot be assigned and unconfirmed assignments are revoked. The text, PDF and confirmations remain.",
        until: "Not valid from",
        untilHint: "It can be in the future — until then the document applies as usual.",
        reason: "Reason",
        reasonHint: "For example: repealed by Executive Committee resolution no. … of …",
        submit: "Archive",
        blocked: "It cannot be archived now:",
        done: (date, revoked) => `The document is archived from ${date}.${revoked ? ` Revoked assignments: ${revoked}.` : ""}`,
        scheduled: date => `The document will be archived on ${date}. It applies until then.`,
        bannerInEffect: date => `Archived — not valid from ${date}`,
        bannerScheduled: date => `Being archived — valid until ${date}`,
        bannerMeta: (who, at) => `Archived by ${who}, ${at}`,
        restore: "Restore validity",
        restoreHint: "If it was a mistake. Revoked assignments are not restored — you can assign it again.",
        restored: "The document's validity has been restored.",
      },
      uploadNext: "Then, on the detail page, you check the text, choose approvers and the responsible person, and submit.",
      approvalHistory: "Approval history",
      versionPageTitle: "New version",
      versionPageBack: "← Back to the document",
      autoLabel: d => `version effective from ${d}`,
      autoLabelNote: "The label is made from the effective date and appears verbatim in the acknowledgement statement.",
      titleNote: "With a current version, the title changes only with a new version — it is approved with it and publishing changes it in the library and in the acknowledgement statement.",
      newTitle: t => `New document title: “${t}”`,
      secBasic: "Basic details",
      secPlacement: "Placement",
      optional: "optional",
      editSaveNote: "Changes the document details, not the version. Approval and acknowledgements stay valid.",
      cancel: "Cancel",
      titleLockedBefore: "🔒 The document has a published version — the title changes only with a ",
      titleLockedLink: "new version",
      titleLockedAfter: ". It is approved with it.",
      elsewhereHeading: "Edited elsewhere",
      elsewhereVersion: "New version",
      elsewhereMeta: "Version details",
      elsewhereResponsible: "Responsible person and legal basis",
      elsewhereText: "Search text",
    },
    carryOver: {
      heading: "Assign the new version too",
      intro: (label) => `Version “${label}” has nobody assigned yet. Earlier versions did — an acknowledgement is tied to one specific version, so an amendment has to be assigned again.`,
      audiences: "Recipients from earlier versions",
      previously: (label, reason) => `${label} · original reason: ${reason}`,
      reason: "Reason for assigning",
      reasonNote: "Required. Say why the document has to be acknowledged again — the original reason shown by each recipient is only a hint and rarely holds for an amendment.",
      due: "Acknowledgement deadline",
      dueNone: "no deadline",
      dueDate: "by date",
      dueDays: "within days",
      dueDaysUnit: "days from assignment",
      dueNote: "Without a deadline no reminders are sent automatically. The original deadline is not carried over — it is usually in the past and would create an overdue duty at once.",
      submit: "Assign to the selected",
      noEmailNote: "This sends no e-mails. Notifying people is a separate step under assigned documents.",
    },
    fields: {
      ownerDepartment: "Department that maintains the document",
      ownerDepartmentShort: "Department",
      ownerDepartmentNote: "Optional. Who keeps the document current — not who is asked to acknowledge it.",
      ownerDepartmentNone: "Not set",
      ownerDepartmentEmpty: "The organisation chart is still empty. Departments are created in Organisation settings.",
      internalNumber: "Internal number",
      internalNumberNote: "Optional. Not every document has one, and it never appears in the acknowledgement statement.",
      internalNumberPlaceholder: "12/2024",
    },
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
      language: "Language",
      all: "— all —",
      filtersTitle: "Filters",
      accessLevel: "Access",
      apply: "Apply",
      tagSearch: "search tags…",
      shown: (found, all) => `${found} of ${all}`,
      removeFilter: (value) => `Remove filter ${value}`,
      colDocument: "Document",
      colVersion: "Version",
      colEffectiveFrom: "Effective from",
      colEffectiveTo: "Effective to",
      colAcknowledged: "Acknowledged",
      acknowledgedOf: (acknowledged, assigned) => `${acknowledged} of ${assigned} assigned`,
      colChanged: "Changed",
      exportCsv: "Export CSV",
      sortBy: (column) => `Sort by ${column}`,
      pageRange: (from, to, total) => `Showing ${from}–${to} of ${total}`,
      pageOf: (page, pages) => `Page ${page} of ${pages}`,
      prevPage: "Previous",
      nextPage: "Next",
      viewSwitch: "View",
      filters: "Filters",
      showResults: n => (n === 1 ? "Show 1 document" : `Show ${n} documents`),
      moreActions: "More actions",
      waiting: {
        heading: "Waiting for approval",
        count: n => (n === 1 ? "1 version" : `${n} versions`),
        since: date => `submitted ${date}`,
        waitingFor: names => `waiting for: ${names}`,
        nobodyPending: "everyone has decided",
      },
      viewTable: "Table",
      viewCards: "Cards",
      bulk: {
        heading: "With selected",
        pickColumn: "Select",
        pick: (title) => `Select ${title}`,
        picked: (count) => `Selected: ${count}`,
        pickedOutside: (count) => `${count} outside this list`,
        pickedMax: (max) => `You cannot select more than ${max} at once — the selection travels in the address. Handle this batch, then pick the next.`,
        clearPicked: "clear selection",
        moveConfirm: count => `Move ${count} ${count === 1 ? "document" : "documents"} to …`,
        moveTo: "Move to",
        move: "Move",
        assign: "Request acknowledgement",
      },
      builder: {
        heading: "+ Condition",
        hint: "Within a group “and” applies, between groups “or” — that is (A and B) or (C and D). Change the connector before a row with the link next to it.",
        field: "Field",
        op: "Operator",
        value: "Value",
        today: "today",
        fieldNote: "With “Valid to after”, documents with unlimited validity are not shown — they have no end date to ask about.",
        add: "Add condition",
        remove: (description) => `Remove condition ${description}`,
        matchAll: "match all",
        makeAnd: "change to “and”",
        makeOr: "change to “or”",
        addAnd: "Add with “and”",
        addOr: "Add with “or”",
        matchAny: "match any",
        joinAll: "and",
        joinAny: "or",
        joinFirst: "where",
        preview: "Documents where",
        fields: {
          title: "Title",
          category: "Category",
          status: "Status",
          tag: "Tag",
          accessLevel: "Access",
          updatedAt: "Changed",
          effectiveTo: "Valid to",
        },
        ops: {
          is: "is",
          not: "is not",
          contains: "contains",
          before: "before",
          after: "after",
        },
      },
      statusLabel: {
        published: "Valid",
        draft: "Draft",
        review: "In review",
        expired: "Expired",
        archived: "Archived",
      },
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
      empty: "Nothing in the library yet",
      emptyText: "Once you upload the first document, it will appear here along with who needs to acknowledge it.",
      emptyFilteredTitle: "No documents match the filter",
      emptyFilteredBefore: count => `You have ${count} ${count === 1 ? "filter" : "filters"} on:`,
      emptyFilteredAfter: "Try removing one.",
      and: "and",
    },
    tracks: {
      heading: "Tracks",
      intro: "A track is an order of steps — “go through these documents in this order”. It is what shows a person where they stopped.",
      newHeading: "New track",
      key: "Key",
      keyHint: "Lower-case letters without diacritics, digits and a hyphen. It goes into addresses and stays there.",
      keyTaken: "A track with this key already exists — change the key.",
      title: "Title",
      description: "Description (optional)",
      create: "Create track",
      emptyTitle: "No tracks",
      emptyText: "A track is the order in which a person reads the documents — for example when joining the organisation. Create the first one with the form below.",
      active: "on",
      inactive: "off",
      enable: "Switch on",
      disable: "Switch off",
      stepCount: n => (n === 1 ? "1 step" : `${n} steps`),
      detailHeading: title => `Track ${title}`,
      edit: "Edit title",
      rename: "Save title",
      steps: "Steps",
      noSteps: "The track has no steps yet. An empty track cannot be switched on — it would tell people they are done.",
      addStep: "Add a step",
      chooseDocument: "— choose a document —",
      requiresAck: "Requires an acknowledgement",
      requiresAckHint: "Without it the step is reading only and nothing is written to the evidence.",
      ackYes: "with an acknowledgement",
      ackNo: "reading only",
      remove: "Remove",
      moveUp: "Up",
      moveDown: "Down",
      created: "The track is created. You can switch it on once it has steps.",
      renamed: "The title is saved.",
      stepsSaved: "The steps are saved.",
      dueHeading: "Acknowledgement deadline",
      dueNone: "no deadline",
      dueDays: "within N days of being added to the track",
      dueDaysUnit: "days after being added",
      dueNote: "It runs for each person from the day they were added to the track, so whoever joins later gets the same time. With a deadline, people get reminders as it approaches and after it passes. It also applies to people already on the track — anyone who has been on it longer may be past the deadline straight away.",
      dueSave: "Save deadline",
      settingsHeading: "Track settings",
      saveSettings: "Save settings",
      addHeading: "Add people to the track",
      cancel: "Cancel",
      deactivateTitle: "Deactivate the track",
      deactivateNote: "Nobody new is added and reminders stop. Acknowledgements stay.",
      activateTitle: "Activate the track",
      activateNote: "The track is offered again when adding people and reminders resume.",
      dueSaved: "The track deadline is saved.",
      settingsSaved: "Track settings saved.",
      dueCurrent: days => (days === null ? "No deadline" : days === 1 ? "Within 1 day of being added to the track" : `Within ${days} days of being added to the track`),
      members: n => `People on the track (${n})`,
      noMembers: "Nobody is on the track yet.",
      membersInactive: "deactivated",
      removeMember: "Remove",
      addMembers: "Add people",
      addMembersNote: "A department adds its current members, including sub-departments. Whoever joins the department later does not get the track automatically — that is what assigning to a department is for.",
      departments: "Departments",
      people: "People",
      addSubmit: "Add to track",
      notifyAdded: "Email the added people the documents to acknowledge",
      notifyAddedHint: "Only those missing something from the track get it, and only about what they are missing. Without it they hear only from the reminder before the track deadline.",
      membersAdded: (added, already) => `Added to the track: ${added}.` + (already > 0 ? ` ${already} already on it.` : ""),
      memberRemoved: "The person was removed from the track. Their acknowledgements remain.",
      enabled: "The track is on.",
      disabled: "The track is off. It stays recorded for the people who already have it.",
    },

    folders: {
      heading: "Folders",
      manage: "Manage folders",
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
      removeBlocked: (documents, subfolders) => {
        const d = documents === 1 ? "1 document" : `${documents} documents`
        const f = subfolders === 1 ? "1 subfolder" : `${subfolders} subfolders`
        const what = subfolders > 0 && documents > 0 ? `${d} and ${f}` : subfolders > 0 ? f : d
        return `Only an empty folder can be deleted. This one holds ${what} — move them first.`
      },
      emptyTitle: "The library has no folders",
      emptyText: "Documents are not filed yet. Create a folder with the form below — then move them into it in bulk from the library.",
      newFolder: "New folder",
      newFolderName: "Name of the new folder",
      parentFolder: "Parent folder",
      create: "Create",
    },
    detail: {
      documentData: "Document details",
      side: {
        progressHeading: "Acknowledgements",
        progressOf: (acknowledged, assigned) => `${acknowledged} / ${assigned} people`,
        progressNobody: "This version has not been assigned to anyone yet.",
        progressWho: "Who has not acknowledged →",
        progressAssign: "Assign for acknowledgement →",
        metaHeading: "Metadata",
        folder: "Folder",
        unfiled: "Unfiled",
        identifier: "Identifier",
        none: "—",
      },
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
      draftPdf: "Draft PDF:",
      draftSource: "Editable source:",
      versionPdf: "Version PDF:",
      versionSource: "Editable source (template for the next version):",
      noPdf: "Version from before ADR-011 — it has no PDF; the text was approved and acknowledged.",
      noDraftPdf: "The draft has no PDF. Upload the version again with a PDF before submitting it for approval.",
      draftDiffers: "The draft differs from the published version.",
      draftSame: "The draft matches the published version.",
      draftEmpty: "The draft is empty.",
      publishHeading: "Publish a version",
      nowPublishNew: current => `Publish a new version — ${current} is currently in force`,
      nowInReview: "The version is under review",
      toolsSummary: "Edits and document management",
      approvalDraftLabel: "draft",
      draftApprovalHeading: "Draft approval",
      publishNeedsApproval: "The draft is not approved yet. Submit it for approval above — only an approved version can be published.",
      publishWaitsForApproval: "Approval is in progress. You can publish once the approvers decide.",
      publishApprovedNote: "The draft is approved. Leave the text as it is — any edit changes the fingerprint and the approval stops being valid.",
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
      reindexHeading: "Reindex all versions",
      reindexNoteBefore: "Re-chunks every version — current, upcoming and older — using the current chunking profile. ",
      reindexNoteHighlight: "It does not create a new version",
      reindexNoteAfter: " — the text does not change, so acknowledgements stay valid and nobody is asked to acknowledge again. Use it after tuning the profile in the organisation settings.",
      reindex: "Reindex all versions",
      reindexVersionHeading: "Reindex",
      reindexVersionNote: "Re-chunks this version using the current chunking profile. The text does not change, acknowledgements stay valid and the assistant then searches the new chunks.",
      reindexVersion: "Reindex this version",
      newVersionHeading: "New version from a file",
      newVersionNote: "Uploads a new file as this document's draft. The published version is not affected — you read the text first and publish it afterwards. Metadata stays; only the text and the original file change.",
      newVersionFile: "File with the new version",
      newVersionSubmit: "Upload new version",
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
      fixHistory: n => (n === 1 ? "1 correction" : `${n} corrections`),
      fixLine: (who, when) => `${who} · ${when}`,
      fixWas: (label, effectiveFrom) => `was ${label}, ${effectiveFrom}`,
      fixReacknowledged: "required a fresh acknowledgement",
      fixNoDate: "no effective date",
      versionLockedBefore: "The label and effective date can no longer be changed — the version has been acknowledged by ",
      versionLockedHighlight: (people) => `${people} people`,
      versionLockedAfter: " and both values are part of the signed statement. They can only be corrected after the acknowledgements are revoked, which is done by HR.",
      revokeVersionHeading: "Revoke the acknowledgements of this version",
      revokeVersionNote: (people) => `Revokes ${people} valid acknowledgements at once. The duty comes back with its original deadline — anyone past it will be overdue immediately. The old acknowledgements stay on record as revoked, with the reason.`,
      revokeVersionReason: "Reason for revoking",
      revokeVersionReasonPlaceholder: "Wrong effective date — the board resolution set 1 April 2026",
      revokeVersionSubmit: "Revoke acknowledgements",
      fixSubmit: "Correct",

      textFixHeading: "Or: correct the text without a new version",
      textFixTarget: label => `Correcting: ${label}`,
      textFixOther: label => `Compare with: ${label}`,
      textFixPanel: "Correct the text",
      textFixPanelNote: "Loads this version's text into the editor. A correction creates no new version — only a typo, comma or diacritics; acknowledgements stay valid. If the meaning changes, a new version is needed. You then save it under Management, with the diff and a reason.",
      textFixLoad: "Load the text into the editor",
      textFixIntro:
        "A typo, a comma, an accent — something that does not change the meaning. The version stays the same, " +
        "acknowledgements stay valid, and the corrected text goes into search under that same version. " +
        "If the meaning changes, this is not the way: publish a new version.",
      textFixDiffHeading: "What changes",
      textFixDiffStat: (added, removed) => `+${added} / −${removed} lines`,
      textFixGap: n => `… ${n} unchanged lines …`,
      textFixCoarse:
        "The change is too large to compare line by line. This is probably no longer a typo fix — consider a new version.",
      textFixApprovalNote:
        "The approval stays with the original text — after the correction it no longer matches the version that is out there. That is exactly why only meaning-preserving corrections go this way.",
      textFixReason: "Reason for the correction",
      textFixReasonPlaceholder: "missing comma in Art. 4(2)",
      textFixReasonNote: "Required. It is stored with the version together with the entire previous text.",
      textFixSubmit: "Correct the text without a new version",
      textFixHistory: n => (n === 1 ? "1 text correction" : `${n} text corrections`),
      textFixLine: (who, when) => `${who} · ${when}`,

      approvalHeading: "Approval",
      stateDraft: "Draft",
      stateInReview: "In review",
      stateApproved: "Approved",
      statePublishedBefore: "Published before approvals existed",
      statePublishedBeforeNote:
        "This version was in the library before approvals were introduced. It is not approved retroactively \u2014 an official version that goes through approval will replace it.",
      approvalSubmit: "submit for approval",
      approvalApprovers: "Approvers",
      approvalApproversHint:
        "Name people, not a department. \u201CSomeone in Legal approved it\u201D cannot be verified a year later. You cannot pick yourself \u2014 whoever uploaded the text does not approve it.",
      approvalNoPeople: "There is nobody to pick in this organisation.",
      approvalNote: "What changes in this version",
      approvalNotePlaceholder: "For example: article 4 reworded to match the amended act.",
      approvalNoteHint: "Optional. The approver reads it, not the archive.",
      approvalSubmitButton: "Submit for approval",
      approvalWaiting: "waiting",
      approvalNotDecided: "did not decide",
      approvalApproved: when => `approved ${when}`,
      approvalRejected: when => `rejected ${when}`,
      approvalRoundHeading: round => `Round ${round}`,
      approvalSubmittedBy: (who, when) => `submitted by ${who} · ${when}`,
      approvalHistory: n => (n === 1 ? "1 round" : `${n} rounds`),
      approvalCancel: "cancel this round",
      approvalCancelReason: "Reason for cancelling",
      approvalCancelHint:
        "The round is not deleted \u2014 it keeps the reason and stays in the history. It is the only way to remove an approver who should not be on the list.",
      approvalCancelButton: "Cancel the round",
    },
    chunks: {
      heading: "Splitting into chunks",
      intro: "The assistant does not read the whole document at once — it gets a few chunks and answers from them. Here you can see how the current version is split and whether it fits.",
      openLink: "splitting into chunks →",
      profile: "Splitting profile",
      version: "Version",
      noVersion: "The document has no effective version yet, so it has no chunks. Below is only an analysis of the draft.",
      upToDate: "The chunks match today's splitting.",
      outdated: (stored, today) => `The chunks were split the older way (${stored} chunks); today ${today} would be created.`,
      reindexHint: "Reindex in the document detail (Manage → Reindex). Neither the text nor acknowledgements change.",
      statsCount: "Chunks",
      statsArticles: "With an article",
      statsTokens: "Size (tokens)",
      tokensRange: (min, avg, max) => `${min} – ${avg} – ${max}`,
      target: (min, max) => `target ${min}–${max}`,
      warningsHeading: "What does not fit",
      warnings: {
        oneBlock: "The whole text is in one chunk — not a single article was found. The assistant cannot cite a specific place from it. Typical for a manual or a contract; splitting by headings will help.",
        fewArticles: percent => `Only ${percent} % of chunks have an article — the profile barely recognised the document's structure.`,
        oversized: (count, limit) => `${count} ${count === 1 ? "chunk is" : "chunks are"} larger than ${limit} tokens — the assistant gets too much at once.`,
        fragments: count => `${count} short ${count === 1 ? "fragment of a split article" : "fragments of split articles"} — little context.`,
      },
      noWarnings: "No findings.",
      analysisHeading: "Text analysis",
      analysisFound: (lines, articles, paragraphs, points, headings) =>
        `${lines} lines · “Článok” ${articles}× · “§” ${paragraphs}× · “Bod” ${points}× · ${headings} headings`,
      analysisFits: word => `The text is structured by “${word}” — the profile fits.`,
      analysisOther: word => `The text is structured by “${word}” rather than by the profile — consider another profile.`,
      analysisPlain: "The text has no articles or paragraphs. It needs splitting by headings.",
      listHeading: "Chunks",
      noArticle: "no article",
      tokens: n => `${n} ${n === 1 ? "token" : "tokens"}`,
      oversizedTag: "large",
      trialHeading: "Try a different split",
      trialIntro: "Change the values and see how the text would be split. Nothing is saved until you choose a profile below.",
      fieldArticleWord: "Article word",
      fieldArticleWordHint: "The word an article heading starts with: Článok, § or Bod.",
      fieldAnnexWord: "Annex word",
      fieldMinTokens: "Chunk from (tokens)",
      fieldMaxTokens: "Chunk to (tokens)",
      trialShow: "Show split",
      trialReset: "Cancel trial",
      compareHeading: "Comparison",
      compareNow: "now",
      compareTrial: "trial",
      compareMax: "Largest chunk",
      trialMatches: label => `These values belong to the profile “${label}”.`,
      trialSameAsCurrent: "The trial split is the same as the current one — nothing needs to change.",
      trialListHeading: "Chunks after the trial split",
      saveHeading: "Profile for this document",
      saveIntro: "A document carries only a named profile — it can be used for other documents too. After changing the profile the document must be reindexed; until then the assistant answers from the old chunks.",
      useProfile: "Use an existing profile",
      useProfileButton: "Use",
      currentProfile: "current",
      newProfile: "Save the trial values as a new profile",
      newProfileLabel: "Profile name",
      newProfileHint: "For example “Act (§)”. Existing profiles are not changed here — a change would silently re-split every document that uses them.",
      newProfileButton: "Save profile",
      adviceHeading: "AI proposal",
      adviceIntro: "The model receives the document structure — headings, articles and paragraph openings, not the full text — and proposes how to split it. Nothing changes; you can try the proposal and save it as a profile. The call is recorded in AI usage.",
      adviceButton: "Analyse with AI",
      adviceAgain: "Analyse again",
      adviceMeta: (date, model, by) => `${date} · ${model} · ${by}`,
      adviceStrategyArticles: (word, min, max) => `By articles — word “${word}”, chunk ${min}–${max} tokens.`,
      adviceStrategyHeadings: "By headings — the document has no articles. This splitting method is not available yet (ADR-027, step 2).",
      adviceConfidence: { low: "low confidence", medium: "medium confidence", high: "high confidence" },
      adviceIssues: "What does not fit",
      adviceTry: "Try this split",
    },
    editor: {
      intro: "Compare the text with the original. Publishing is a separate step — nothing goes out from here.",
      modelDraft: "model draft",
      ruleDraft: "rule-based draft",
      modeRewriteScan: "scan transcription",
      modeClean: "structure cleanup",
      draftMeta: (model, when, chars) => `${model} · ${when} · ${chars} characters`,
      draftNoteBefore: "The model was forbidden to change the wording — ",
      ruleNoteBefore: "The rules change only structure markers and remove the page footer, not words — ",
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
      llmHeading: "Text helpers",
      llmNoteBefore: "It runs only like this — on a click. The result is saved as a ",
      llmNoteHighlight: "draft beside the text",
      llmNoteAfter: ", not into it: the model is forbidden to change the wording, but a silent change in a regulation would go unnoticed if it were written straight in.",
      clean: "Clean up the structure",
      cleanNote: "“Clean up the structure” does not use the language model. The text is marked up by rules — PART, chapter, section, Article, annex — and the repeated page footer is removed. There is no length limit and not a single word of the regulation changes.",
      rewriteScan: "Transcribe from the scan",
      rewriteScanNote: "“Transcribe from the scan” sends the whole original PDF to the model. It makes sense when the PDF has no text layer or the conversion fell apart.",
    },
    actions: {
      converted: "Converted. Read the text and compare it with the original.",
      metaSaved: "Version details saved.",
      convertedWithWarnings: (warnings) => `Converted. ${warnings}`,
      versionSameAsPublished: "Note: the converted text is identical to the published version — the uploaded file brings no change.",
      versionDiffers: (added, removed) => `Against the published version: ${added} lines added, ${removed} removed.`,
      saved: "Saved.",
      changesSaved: "Changes saved.",
      alreadyPublished: "This version is already published — nothing changed.",
      published: (chunks, archived) =>
        `Published: ${chunks} ${chunks === 1 ? "chunk" : "chunks"}, ${archived} older archived.`,
      modelReturnedDraft: "The model returned a draft. Compare it with the current text and decide.",
      rulesReturnedDraft: "The structure has been cleaned up. Compare the draft with the current text and decide.",
      draftAccepted: "The draft is now the working text. Publishing is still a separate step.",
      draftDiscarded: "Draft discarded.",
      assigned: "Filed.",
      bulkNothingSelected: "You have not selected any document.",
      bulkMoved: (moved) => `Moved: ${moved}.`,
      bulkMovedPartly: (moved, total, failed) =>
        `Moved ${moved} of ${total}. Failed: ${failed}`,
      reindexUpToDate: "The chunking is already up to date — nothing changed.",
      chunkingProfileSet: label => `The document now has the profile “${label}”. Reindex it — until then the assistant answers from the old chunks.`,
      chunkingProfileCreated: label => `The profile “${label}” was saved and assigned to the document. Reindex the document next.`,
      chunkingAdviceReady: "The AI proposal is ready — see below. Nothing has changed.",
      reindexAllResult: (done, unchanged) => `Versions reindexed: ${done}, unchanged: ${unchanged}. No version or acknowledgement was touched.`,
      reindexed: (chunks, archived) =>
        `Reindexed: ${chunks} ${chunks === 1 ? "chunk" : "chunks"}, ${archived} older archived.` +
        " Neither the wording nor the acknowledgements were touched.",
      fixed: "Corrected. Acknowledgements stay valid.",
      versionRevoked: (people) => `Acknowledgements revoked: ${people}. The duty is back with its original deadline — now correct the value and have the version acknowledged again.`,
      carriedOver: (created, already) =>
        `Assigned: ${created}${already > 0 ? `, already assigned: ${already}` : ""}.` +
        " No e-mails were sent — notifying people is a separate step.",
      textFixed: (added, removed, chunks) =>
        `Text corrected: +${added} / −${removed} lines. The version and the acknowledgements are unchanged;` +
        ` ${chunks} ${chunks === 1 ? "chunk" : "chunks"} went into search.`,
      submittedForApproval: n =>
        `Submitted for approval to ${n === 1 ? "one person" : `${n} people`}.`,
      approvalNotAllNotified: n => `But the email could not be sent to ${n === 1 ? "one person" : `${n} people`} \u2014 the round is running, they just do not know about it.`,
      approvalCancelled: "Round cancelled. It stays in the history with its reason.",
      draftPrepared: "Preparation saved.",
      carryOverFailed: "The version is published, but carrying over assignments failed:",
      failed: "That did not work. Try again.",
    },
    connectorImport: {
      heading: "Import from a server",
      intro: "Search articles on a connected MCP server and save the selected ones as document drafts. From there they take the usual path: metadata, approval, publication. The server has no file list — you pick from search results.",
      newLink: "Articles from a connected server (e.g. Sportnet) are imported here →",
      noConnector: "No connected connector has library import enabled.",
      noConnectorLink: "Organisation connectors",
      connector: "Connector",
      scope: "Scope",
      query: "What to search for",
      queryPlaceholder: "password change, player registration…",
      queryHint: "One question or topic; the server returns at most 10 articles.",
      search: "Search",
      nothingFound: "The server found nothing.",
      errorBefore: "Search failed: ",
      pick: n => `Select articles (${n})`,
      alreadySame: "Already in the library, unchanged on the server.",
      alreadyChanged: "Already in the library — changed on the server since; import creates a draft of a new version.",
      open: "Open",
      metaNote: "Applies to all new documents from this selection; existing ones keep their metadata.",
      folder: "Folder",
      folderNone: "No folder",
      accessHint: "An article from developer documentation is internal until a curator rewrites it for the public.",
      import: "Import selected",
      afterNote: "Each article becomes a draft with a PDF and text; open it, edit and send for approval.",
      done: (created, versions, unchanged, failed) => `Import finished: ${created} new, ${versions} new versions, ${unchanged} unchanged, ${failed} failed.`,
      pdfOrigin: (connector, path) => `Source: ${connector} · ${path}`,
      sourceHeading: "Source",
      sourceLine: (connector, group, date) => `From connector ${connector}${group ? ` (${group})` : ""}, fetched ${date}.`,
      sourcePath: "Path on the server",
      resync: "Check for changes on the server",
      resyncHint: "The article is fetched again; if it changed, a draft of a new version is created. Published versions stay as they are.",
      resyncUnchanged: "Nothing changed on the server.",
      resyncVersion: "The article changed — a draft of a new version is ready.",
    },
    faq: {
      newHeading: "New FAQ",
      newIntro: "An FAQ is not uploaded as a file. Create it here, then add entries: a question, the answer and the regulation it is based on. Publishing goes through approval like any other version.",
      newLink: "Frequently asked questions (FAQ) are not uploaded as a file — create them here →",
      create: "Create FAQ",
      created: "The FAQ has been created. Add the first entry.",
      heading: "FAQ entries",
      intro: "One entry is one question and answer. The assistant turns each entry into one chunk; access to an entry is the strictest of this FAQ's access and its sources.",
      empty: "No entries yet.",
      addHeading: "New entry",
      editHeading: (n: number) => `Entry ${n}`,
      question: "Question",
      questionHint: "The way people actually ask it — one sentence.",
      variants: "Other wordings of the question",
      variantsHint: "One per line. They help find the answer to a differently phrased question.",
      answer: "Answer",
      answerHint: "The full answer the helpdesk would send by e-mail. No personal data.",
      sources: "Sources",
      sourcesHint: "Regulations the answer is based on. When one of them gets a new version, the entry is flagged for review.",
      sourceDocument: "Document",
      sourceNone: "— no source —",
      sourceArticle: "Article",
      sourceArticlePlaceholder: "e.g. Art. 12(3)",
      audience: "Audience",
      audienceHint: "Roles the answer is meant for, comma-separated: club manager, referee, coach…",
      save: "Save entry",
      add: "Add entry",
      remove: "Remove",
      saved: "The entry is saved. It is published with the version after approval.",
      removed: "The entry has been removed from the draft.",
      stateNew: "new, unpublished",
      stateChanged: "changed since publication",
      statePublished: "published",
      stateSourceChanged: "a source has a new version — review the answer",
      access: (level: string) => `access: ${level}`,
      count: (n: number) => (n === 1 ? "1 entry" : `${n} entries`),
      editEntries: "Edit entries",
      openEntries: "FAQ entries →",
      pdfNote: "The PDF and the text of the version are built from the entries on every save (ADR-011); nothing is uploaded.",
      publishNote: "Changes to entries are a draft. They are published through the version flow on the document page: version details, approval, publication.",
      mdIntro: "Frequently asked questions and answers. Each answer is based on the regulations listed, as in force on the day of publication.",
      mdQuestion: "Question",
      mdVariants: "Other wordings",
      mdAnswer: "Answer",
      mdSources: "Sources",
      mdAudience: "Audience",
      mdEmpty: "No entries yet.",
      pdfPage: (n: number, total: number) => `page ${n} of ${total}`,
    },
    upload: {
      sectionFile: "File",
      sectionMeta: "Metadata",
      dropHint: "Drop a file here, or choose one.",
      pick: "Choose a file",
      heading: "Upload a document",
      intro: "The PDF is what gets approved and acknowledged — exactly as people will see it, annexes included. Add an editable source (Word, Excel…): it gives the text for search and is what you start from for the next version. Both files are stored exactly as they arrived.",
      file: "File",
      errorBefore: "The document was not uploaded: ",
      errorFileAgain: "Choose the file again — the browser does not keep it for security reasons.",
      maxSize: mb => `up to ${mb} MB`,
      oldFormatsBefore: "Legacy ",
      oldFormatsMiddle: " and ",
      oldFormatsAfter: " cannot be converted — save them from Word or Excel in a newer format. A scanned PDF with no text layer can be transcribed by the language model later, in the editor.",
      title: "Title",
      titlePlaceholder: "Súťažný poriadok futbalu SFZ",
      titleNote: "It appears verbatim in the acknowledgement statement, so use the full official title.",
      key: "Document key",
      keyPreview: "Identifier:",
      keyManualSummary: "Enter the key manually",
      keyManualNote: "The key is created once and never changes — it lives in acknowledgements, the audit trail and exports. Renaming the document does not change it.",
      keyTaken: "The identifier {id} is already taken. Change the title, or enter the key manually.",
      keysTaken: "Keys already taken in this organisation: ",
      categoryNote: "Groups documents in the library and in filters. Existing: ",
      moreFields: "More details",
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
      submitPending: "Uploading and converting…",
      submitPendingNote: "The file is being converted to text. A larger document can take up to a minute — keep this page open.",
      change: "Change",
      optional: "optional",
      pickPdfFirst: "Choose the PDF first.",
      prefillFromWord: "The source is a Word document — empty fields are prefilled from the table on its first page (Approved by, Approval date, Effective date). You confirm them on the detail page.",
      pdfTitle: "PDF — the version for approval (required)",
      pdfNote: "This is what approvers and employees will see — including annexes, forms and images. In Word: File → Save As → PDF.",
      sourceTitle: "Editable source (recommended)",
      sourceNote: "Word, Excel, Markdown or text. It gives cleaner text for search and is the template for preparing the next version.",
      noScriptLimit: mb => `without JavaScript up to ${mb} MB`,
      uploadingFile: "Uploading {name} — {percent} %",
      uploadFailed: "Upload failed:",
      fileTooLarge: "{name} is {mb} MB; the limit is {maxMb} MB.",
    },
  },

  learning: {
    statusFilter: "Filter by status",
    off: {
      title: "Learning is not enabled for your organisation",
      lead: "You will see courses, tests and certificates here once your organisation enables it. Mandatory rules to acknowledge are in Tasks.",
      admin: contact => `The module is enabled by the Contineo operator. Write to ${contact}.`,
      tasks: "Open tasks",
      back: "Back to Overview",
    },
    heading: "Learning",
    intro: "Courses assigned to you and open courses you can enrol in.",
    empty: "You have no courses yet",
    emptyNote: "When your organisation assigns you a course or opens one for enrolment, it will appear here. Nothing to do.",
    manageHeading: "Course management",
    manageIntro: "Your organisation's courses, topics and smart:tags.",
    manageEmpty: "There are no courses yet.",
    manageEmptyNote: "Creating courses arrives in the next part of the module.",
    testsHeading: "Tests",
    testsIntro: "The question bank, tests and results of the tests you are responsible for.",
    testsEmpty: "There are no tests yet.",
    testsEmptyNote: "The question bank and tests arrive in the next part of the module.",
    groupInProgress: "In progress",
    groupToEnroll: "To start",
    groupDone: "Completed",
    statusInProgress: "In progress",
    statusAssigned: "Assigned",
    statusOpen: "Open for enrolment",
    statusDone: "Completed",
    continue: "Continue",
    start: "Start",
    enrol: "Enrol",
    certificate: "Certificate",
    openCourse: "Open course",
    next: (n, title) => `Next: Part ${n} · ${title}`,
    assignedOn: (date, who) => `Assigned ${date} · ${who}`,
    assignedOnNoWho: date => `Assigned ${date}`,
    openNote: "The course is open — anyone in the organisation can enrol.",
    noCertificate: "The course does not issue a certificate.",
    doneOn: date => `Completed ${date}`,
    archivedNote: "The course has been archived — you can still finish it.",
    minutes: n => {
      const m = (k: number) => `${k} minute${k === 1 ? "" : "s"}`
      const h = Math.floor(n / 60)
      if (!h) return `about ${m(n)}`
      return `about ${h} hour${h === 1 ? "" : "s"}${n % 60 ? ` ${m(n % 60)}` : ""}`
    },
    parts: (n, required) => `${n} part${n === 1 ? "" : "s"}${required === n ? "" : `, ${required} required`}`,
    issuesCertificate: "certificate",
    progress: (done, total) => `${done} of ${total} required parts`,
    nothingWaiting: "Nothing waiting",
    nothingWaitingNote: "You have completed all your courses. New ones will appear here.",
    filterNone: names => `No course matches ${names}.`,
    clearFilters: "Clear filters",
    topic: "Topic",
    allTopics: "All",
    smartTags: "smart:tags",
    selected: n => `${n} selected`,
    filterNote: "Different keys must all match; within one key, any value is enough.",
    enrolled: title => `You are enrolled in “${title}”.`,
    removeFilter: name => `Remove filter ${name}`,
    course: {
      yourProgress: "Your progress",
      countOf: (d, n) => `${d} of ${n}`,
      requiredParts: "required parts",
      startCourse: "Start",
      continueHere: "Continue here",
      kvVersion: "Version",
      kvEnrolled: "Enrolled",
      enrolledVia: { assignment: "by assignment", self: "self-enrolled" },
      kvLanguage: "Content language",
      kvEstimate: "Estimated time",
      kvCertificate: "Certificate",
      kvOrder: "Part order",
      yes: "yes",
      no: "no",
      orderSequential: "in sequence",
      orderAny: "any order",
      aboutCourse: "About the course",
      partsHeading: "Course parts",
      partsNoteSequential: "Parts open one after another.",
      partsNoteAny: "You can go through the parts in any order.",
      partRequired: "Required",
      partOptional: "Optional",
      blocks: n => `${n} block${n === 1 ? "" : "s"}`,
      blockTypes: { image: "image", gallery: "gallery", document: "document", video: "video", videoExternal: "external video" },
      mustWatchVideo: m => `required video ${m} minute${m === 1 ? "" : "s"}`,
      partDoneOn: date => `Done ${date}`,
      partAvailable: "Available",
      partLockedAfter: n => `Opens after part ${n}`,
      partInProgress: "in progress",
      partInProgressVideo: p => `in progress — ${p} % of the video watched`,
      testLabel: "Test",
      testRequired: "required",
      testOptional: "optional",
      testNotStarted: "not started",
      testPassed: "passed",
      noticeDone: date => `You completed the course on ${date}.`,
      noticeNewVersion: (v, date, mine) => `The course has a new version ${v} (published ${date}). You are finishing version ${mine}, which you enrolled in — nothing to do.`,
      noticeArchived: "The course has been archived — you can still finish it. No one new can enrol.",
      versionN: n => `version ${n}`,
      enrolledSince: date => `enrolled ${date}`,
      notEnrolledNote: "The course is open — anyone in the organisation can enrol. The parts open after you enrol.",
      previewNotice: v => `Preview of version ${v} as a learner sees it. Nothing is recorded and tests cannot be started.`,
      previewEdit: "Edit course",
      previewSide: "Preview — no enrolment or progress is kept.",
    },
    part: {
      nextPart: "Next",
      docKicker: "Document from the library",
      openPdf: "Open PDF",
      docDetail: "Detail in the library",
      docMissing: "This version is no longer in the library.",
      externalChip: "External video · watching is not verified",
      externalBad: "The video cannot be embedded — the address is not supported.",
      play: "Play",
      pause: "Pause",
      mute: "Mute",
      unmute: "Unmute",
      fullscreen: "Full screen",
      progress: "Video progress",
      mustWatchChip: "Required viewing · {p} % watched",
      mustWatchNote: "You can only skip ahead to the point you have already seen. At least 90 % is required.",
      watchedChip: "Watched",
      noScriptNote: "Without JavaScript, viewing is not recorded.",
      testsHeading: "Tests in this part",
      testStart: "Start",
      markDone: "Mark as done",
      markReady: "Once marked, the part is done.",
      nextPartLink: "Next part →",
      previewDock: "Preview — the part cannot be marked done and tests do not start.",
      optionalTestNote: "You can take the optional test any time.",
      testsJump: "Tests ↓",
      marked: "The part is marked as done.",
      partOf: (n, total) => `Part ${n} of ${total}`,
      docNewer: label => `The current version is now ${label}.`,
      markDisabledVideo: p => `Watch the required video first — ${p} % watched, at least 90 % required.`,
      markedWaitingTest: date => `Marked ${date} · the part will be done once you pass the required test.`,
      partDone: date => `The part is done · ${date}`,
      requiredTestSummary: state => `Required test: ${state}`,
    },
    manage: {
      tabsLabel: "Course management",
      tabCourses: "Courses",
      tabTopics: "Topics",
      tabTags: "smart:tags",
      newCourse: "New course",
      statusAll: "All",
      statusDraft: "Draft",
      statusPublished: "Published",
      statusArchived: "Archived",
      colCourse: "Course",
      colTopic: "Topic",
      colStatus: "Status",
      colEnrolled: "Enrolled",
      colCompleted: "Completed",
      colUpdated: "Updated",
      edit: "Edit",
      openEnrollment: "open for enrolment",
      courseTitle: "Course title",
      courseKey: "Key in the address",
      keyHint: "The key is in the course address (/learning/…) and does not change with the title.",
      keyTaken: "A course with this key already exists.",
      topic: "Topic",
      topicNone: "Add a topic in the Topics tab first.",
      create: "Create draft",
      cancel: "Cancel",
      emptyText: "A course starts as a draft — you add parts, blocks and settings before publishing. The topic must exist in the Topics tab.",
      topicsHeading: "Course topics",
      rename: "Rename",
      retire: "Retire",
      restore: "Restore",
      retired: "retired",
      newTopic: "New topic",
      topicName: "Topic name",
      topicKey: "Key",
      addTopic: "Add topic",
      topicsEmpty: "There are no topics yet. A course needs exactly one.",
      topicAdded: "The topic has been added.",
      topicRenamed: "The topic has been renamed.",
      topicRetired: "The topic has been retired. Courses keep it.",
      topicRestored: "The topic is back on offer.",
      save: "Save",
      tagsIntro: "smart:tags are not created here — they appear where they are first written: on a course, question or test.",
      tagsEmpty: "No smart:tags are in use yet.",
      renameKey: "Rename key",
      newValue: "New value",
      mergeButton: "Merge",
      mergeInto: "Merge into…",
      clearSelection: "Clear selection",
      mergeSelected: "Merge selected",
      whatStays: "What remains",
      newEntry: "New value",
      keyLabel: "New key name",
      selectTag: "Select for merging",
      tagPlaceholder: "Key: Value",
      topicCourses: n => `${n} course${n === 1 ? "" : "s"}`,
      enrolledCompleted: (e, c) => `${e} enrolled · ${c} completed`,
      usage: (c, q, t) => `courses ${c} · questions ${q} · tests ${t}`,
      impact: (c, q, t) => {
        const n = c + q + t
        const k = (x: number, w: string) => `${x} ${w}${x === 1 ? "" : "s"}`
        return `Changes everywhere — in ${n} place${n === 1 ? "" : "s"} (${k(c, "course")}, ${k(q, "question")}, ${k(t, "test")}), including test section filters.`
      },
      exists: label => `“${label}” already exists — they will be merged into one tag.`,
      renamed: label => `Renamed to “${label}”.`,
      selected: n => `${n} selected`,
      mergeTitle: n => `Merge ${n} smart:tags into one`,
      mergeResult: target => `The selected tags disappear and “${target}” remains. A course, question or test that had several gets “${target}” once.`,
      merged: (n, target) => `Merged: ${n} tags → ${target}.`,
    },
    edit: {
      settingsSaved: "The settings have been saved.",
      stepsLabel: "Course version status",
      missingHeading: "Missing before publishing",
      readyHeading: "Ready to publish",
      checkParts: "Parts and blocks",
      checkLegal: "Legal basis (Settings)",
      checkTopic: "Topic",
      publishDisabledNote: "Fill in what is missing first.",
      publishedLead: "A published version does not change. A change = a new version (copy).",
      newVersion: "New version",
      archive: "Archive",
      restore: "Restore as a new version",
      cannotPublish: "The course cannot be published yet — see what is missing.",
      archived: "The course is archived. Those in progress can finish it.",
      tabParts: "Parts",
      tabSettings: "Settings",
      tabPeople: "Enrolled",
      partsHeading: "Course parts",
      up: "Move up",
      down: "Move down",
      editPart: "Edit",
      view: "View",
      newPart: "New part",
      partTitle: "Part title",
      required: "Required",
      addPart: "Add part",
      noParts: "The course has no parts yet",
      allParts: "← All parts",
      removePart: "Remove part",
      save: "Save",
      minutes: "Estimated time (minutes)",
      summary: "Short description",
      blocksHeading: "Blocks",
      noBlocks: "The part has no blocks yet.",
      addBlock: "Add block",
      blockType: "Block type",
      markdown: "Text",
      alt: "Image description",
      altGallery: "Image descriptions",
      caption: "Caption below the image",
      document: "Document from the library",
      videoSource: "Video source",
      sourceUpload: "Upload MP4 or WebM (up to 25 MB)",
      sourceExternal: "External link",
      url: "Video address (YouTube, Vimeo, https)",
      mustWatch: "Required viewing",
      mustWatchNote: "Skipping ahead is disabled; the part can be marked only after 90 % has been watched.",
      externalWarn: "Viewing of an external video is not verified. If you need it, upload an MP4.",
      removeBlock: "Remove",
      add: "Add",
      mediaImage: "Image (JPG, PNG, WebP, GIF)",
      mediaVideo: "MP4 or WebM video (up to 25 MB)",
      mediaNote: "The file is uploaded when you add the block.",
      progressTitle: "Uploading file",
      uploading: "Uploading {name} — {percent} %",
      uploadFailed: "Upload failed:",
      tooLarge: "{name} is {mb} MB; the limit is {maxMb} MB.",
      testsHeading: "Tests in this part",
      testsLater: "Tests can be assigned once the question and test bank arrives.",
      mustWatchShort: "required viewing",
      cancel: "Cancel",
      editBlock: "Edit",
      noDocuments: "There is no document with an effective version in the library yet.",
      optional: "Optional",
      steps: ["Draft", "Published", "Archived"],
      stepSub: { draft: n => `version ${n}`, published: n => `version ${n}`, archived: n => `version ${n}` },
      blockTypes: { text: "Text", image: "Image", gallery: "Gallery", document: "Library document", video: "Video", videoExternal: "External video" },
      problem: (code, part) => ({
        noTitle: "The course has no title.",
        noParts: "The course has no parts.",
        noRequiredPart: "At least one part must be required.",
        emptyPart: `Part “${part}” has no blocks.`,
        badPartKey: `Part “${part}” has an invalid key.`,
        duplicatePartKey: `Part “${part}” appears twice in the course.`,
        videoWithoutDuration: `The required video in part “${part}” has no duration — upload it again.`,
        mustWatchExternal: `The external video in part “${part}” cannot require full viewing.`,
        testNotReady: `A test in part “${part}” is not ready.`,
        noIssuer: "The certificate issuer is missing.",
        noLegalBasis: "The legal basis is missing — add it in Settings.",
      } as Record<string, string>)[code] ?? code,
      publishButton: n => `Publish version ${n}`,
      keepPublished: (prev, next) => `Version ${prev} stays published until you publish this one. Those enrolled in v${prev} finish it; new people enrol in v${next}.`,
      archivedLead: n => `No one new can enrol. Those in progress finish their version (${n}).`,
      published: n => `Version ${n} is published.`,
      newVersionStarted: n => `A draft of version ${n} has been created — a copy of the latest version.`,
      blocksTests: (b, t) => `${b} block${b === 1 ? "" : "s"}${t ? ` · ${t} test${t === 1 ? "" : "s"}` : ""}`,
      readOnly: n => `Version ${n} is published — parts and blocks are read-only. To change them: New version.`,
      savedAt: date => `Saved ${date}`,
      statusDraftReady: v => `Draft v${v} · ready to publish`,
      statusDraftMissing: (v, n) => `Draft v${v} · ${n === 1 ? "1 thing missing" : `${n} things missing`}`,
      statusPublished: v => `Published v${v}`,
      statusArchived: "Archive",
      statusLabel: "Version status — course overview",
      previewAsStudent: "Preview as learner",
      archiveOpen: "Archive…",
      archiveTitle: t => `Archive the course ${t}?`,
      archiveNoNew: "Nobody new can enrol; the course leaves the catalogue.",
      archiveInProgress: (n, v) => `${n} ${n === 1 ? "learner in progress finishes" : "learners in progress finish"} it in version ${v}.`,
      archiveKeeps: "Certificates and results stay.",
      archiveRestoreNote: "The course can later be restored as a new version.",
      archiveButton: "Archive course",
      removePartOpen: "Delete part…",
      removePartTitle: (t, b, n) => `Delete the part “${t}”${b || n ? ` with ${[b ? `${b} ${b === 1 ? "block" : "blocks"}` : "", n ? `${n} ${n === 1 ? "test" : "tests"}` : ""].filter(Boolean).join(" and ")}` : ""}?`,
      removePartNote: v => `The part disappears from draft v${v}. Published versions do not change.`,
      removePartButton: "Delete part",
      blockMenuNote: { document: "version", video: "MP4 / link" },
      newBlockHeading: t => `New block · ${t}`,
      blockHeading: (n, t) => `Block ${n} · ${t}`,
      saveBlock: "Save block",
      removeBlockButton: "Delete block",
      removeBlockNote: (d, p) => `The block disappears from draft v${d}.${p ? ` Version ${p} does not change.` : ""}`,
      noEditBlock: "This block type cannot be edited — delete it and add a new one.",
      sourceExternalSub: "YouTube, Vimeo, stream",
      partGroup: "Part",
      savePart: "Save part",
      saveTests: "Save tests",
      testsSaved: "Part tests saved.",
      partSaved: "Part saved.",
    },
    settings: {
      title: "Course title",
      keyNote: "The key in the address does not change after creation.",
      subtitle: "Subtitle",
      description: "Description",
      topic: "Topic",
      language: "Content language",
      languageNote: "A course in another language is a different course.",
      estimate: "Estimated time (minutes)",
      smartTags: "smart:tags",
      groupFlow: "Flow",
      sequential: "Parts go in sequence",
      sequentialNote: "The next part opens only after the previous required one is done.",
      openEnrollment: "Open for enrolment",
      openEnrollmentNote: "The course is offered to everyone in the organisation under “To start”.",
      issuesCertificate: "Issues a certificate",
      signerName: "Signs for the issuer — name",
      signerRole: "Position",
      groupLegal: "Legal basis",
      legalNote: "Course progress, attempts and results are personal data — without a legal basis the course cannot be published.",
      legalNone: "— choose —",
      save: "Save settings",
      tagPlaceholder: "Key: Value",
      tagNewKey: "New key “{k}”",
      tagNewValue: "New value “{v}”",
      tagRemove: "Remove {t}",
      tagValues: "values: {n}",
      tagField: "Course smart:tags",
      tagNoScript: "One smart:tag per line as Key: Value.",
      none: "—",
      readOnly: n => `Version ${n} is published — settings are read-only. To change them: New version.`,
    },
    people: {
      filterAll: "All",
      notStarted: "Not started",
      inProgress: "In progress",
      done: "Completed",
      assign: "Assign course",
      exportCsv: "Export CSV",
      colName: "Name",
      colEmail: "Email",
      colDepartment: "Department",
      colEnrollment: "Enrolment",
      colState: "Status",
      colActivity: "Last activity",
      stateNotStarted: "not started",
      empty: "No one is enrolled in the course yet.",
      assignHeading: "Assign course",
      everyone: "Everyone in the organisation",
      everyoneNote: "including newcomers if assigned again",
      departments: "Departments",
      groups: "Groups",
      tracks: "Track",
      tracksNote: "People who have the track are enrolled — as with a policy.",
      check: "Check impact",
      notPublished: "Only a published course can be assigned.",
      nobody: "No one matches the selection.",
      cancel: "Cancel",
      stateProgress: (d, t) => `${d} of ${t} parts`,
      stateDone: date => `completed ${date}`,
      summary: (n, v, m) => `${n} ${n === 1 ? "person" : "people"} will be enrolled in version ${v}${m ? ` · ${m} already enrolled, nothing changes for them` : ""}.`,
      assignButton: n => `Assign to ${n} ${n === 1 ? "person" : "people"}`,
      assigned: (n, m) => `Newly enrolled: ${n}, already enrolled: ${m}.`,
    },
    tests: {
      tabsLabel: "Tests",
      tabTests: "Tests",
      tabQuestions: "Question bank",
      tabResults: "Results",
      newTest: "New test",
      testTitle: "Test title",
      testKey: "Test key",
      create: "Create test",
      cancel: "Cancel",
      statusAll: "All",
      statusReady: "Ready",
      statusDraft: "Drafts",
      statusRetired: "Retired",
      tagReady: "Ready",
      tagDraft: "Draft",
      tagShort: "Not enough questions",
      tagRetired: "Retired",
      colTest: "Test",
      colSections: "Sections",
      colQuestions: "Questions",
      colPassing: "Pass mark",
      colResponsible: "Responsible people",
      colStatus: "Status",
      edit: "Edit",
      nobody: "nobody — cannot be made ready",
      testsEmpty: "There are no tests yet.",
      testsEmptyNote: "A test is a recipe: sections draw questions from the bank by smart:tags.",
      groupBase: "Basics",
      instructions: "Instructions",
      responsibleLegend: "Responsible people",
      responsibleNote: "They see the results of their test and may reset attempts. HR does not see results.",
      noResponsible: "Without a responsible person the test cannot be made ready.",
      groupSections: "Sections",
      sectionFilter: "Section smart:tags",
      sectionCount: "Number of questions",
      showInBank: "Show in bank",
      addQuestions: "Add questions →",
      addSection: "Add section",
      removeSection: "Remove",
      sectionsNote: "Questions are drawn for every attempt and answers are shuffled. Different keys must all match; within one key, any value is enough.",
      groupRules: "Rules",
      passing: "Pass mark (%)",
      timeLimit: "Time limit (minutes)",
      maxAttempts: "Maximum attempts",
      pause: "Pause between attempts (minutes)",
      showAnswers: "When to show correct answers",
      showNever: "Never",
      showAfterSubmit: "After submitting",
      showAfterPass: "After passing",
      showAfterLast: "After the last attempt",
      emptyMeansNone: "Empty = no limit.",
      testTags: "Test smart:tags (for search, they do not affect drawing)",
      save: "Save",
      statusCard: "Test status",
      checkResponsible: "Responsible people",
      checkSections: "Every section has enough questions",
      checkRules: "Rules filled in",
      statusNote: "This is checked on save, not during an attempt.",
      usedIn: "Used in",
      usedNone: "The test is not used in any course yet.",
      retire: "Retire test",
      restore: "Restore test",
      savedReady: "The test is saved and ready.",
      savedDraft: "The test is saved as a draft — see what is missing.",
      newQuestion: "New question",
      importCsv: "Import CSV",
      exportCsv: "Export CSV",
      bankEmpty: "The question bank is empty",
      bankEmptyNote: "Add a question or upload a CSV.",
      filterType: "Type",
      filterStatus: "Status",
      filterTags: "smart:tags",
      statusActive: "Active",
      statusRetiredQ: "Retired",
      clearFilters: "Clear filters",
      colQuestion: "Question",
      colType: "Type",
      colWeight: "Weight",
      questionText: "Text",
      media: "Images and videos in the question",
      mediaNote: "Images and videos are uploaded when the question is saved.",
      removeMedia: "Remove",
      mediaAlt: "Image description (for new images)",
      answers: "Answers",
      correct: "correct",
      multipleNote: "The student will see “This question has more than one correct answer”.",
      trueLabel: "True",
      falseLabel: "False",
      expected: "Expected answer",
      alternatives: "Also correct",
      shortNote: "Compared without diacritics and case.",
      explanation: "Explanation",
      explanationNote: "Shown after submitting, if the test allows it.",
      weight: "Weight",
      difficulty: "Difficulty",
      tagsLabel: "smart:tags (at least one)",
      tagRequiredNote: "Without a smart:tag no test will draw the question.",
      saveQuestion: "Save question",
      retireQ: "Retire",
      restoreQ: "Restore",
      questionSaved: "The question has been saved.",
      answerMediaLater: "Images and videos in answers arrive in a later update.",
      importHeading: "Import questions from CSV",
      importNote: "UTF-8, semicolon separator, header in the first row — columns id, type, text, answer_1 … answer_8, correct, explanation, weight, difficulty, tags.",
      importFile: "CSV file",
      importUpload: "Upload and check",
      importErrorsNote: "If there is any error nothing is imported — fix the file and upload it again.",
      colLine: "Row",
      colColumn: "Column",
      colProblem: "Error",
      mediaNoteImport: "Images and videos are added to the question after import.",
      importExpired: "The uploaded file is no longer available — upload it again.",
      templateLink: "Download CSV template",
      noResponsiblePeople: "There is no one in the organisation who could be assigned.",
      keyTaken: "A test with this key already exists.",
      up: "Move up",
      down: "Move down",
      required: "required",
      optional: "optional",
      types: { single: "Single choice", multiple: "Multiple choice", true_false: "True / false", short_text: "Short text" },
      difficulties: { easy: "Easy", medium: "Medium", hard: "Hard" },
      sectionTitle: n => `Section ${n}`,
      enough: n => `${n} question${n === 1 ? "" : "s"} in the bank match`,
      short: (n, missing) => `Only ${n} question${n === 1 ? "" : "s"} in the bank match — ${missing} missing`,
      usedRow: (course, part, required, v) => `${course} · ${part} · ${required ? "required" : "optional"} · test version ${v ?? "—"}`,
      version: n => `version ${n}`,
      answer: n => `Answer ${n}`,
      usage: (t, a) => `Used in ${t} test${t === 1 ? "" : "s"} · ${a} attempt${a === 1 ? " cites" : "s cite"} it as a snapshot`,
      importSummary: (total, created, updated, errors) => `${total} questions · ${created} new · ${updated} updates · ${errors} error${errors === 1 ? "" : "s"}`,
      newTags: list => `New smart:tags: ${list}`,
      importRun: n => `Import ${n} question${n === 1 ? "" : "s"}`,
      imported: (c, u) => `Imported: ${c} new, ${u} updated.`,
    },
    attempt: {
      factQuestions: "Questions",
      factToPass: "To pass",
      factTime: "Time limit",
      factAttempt: "Attempt",
      noLimit: "no limit",
      ruleDraw: "Questions are drawn for every attempt and answers are shuffled.",
      ruleSave: "Answers are saved continuously; time keeps running even if you get disconnected.",
      start: "Start test",
      blockedPassed: "You have passed the test.",
      backToPart: "Back to the part",
      saving: "saving…",
      saveFailed: "not saved — retrying",
      multipleNote: "This question has more than one correct answer — select all of them.",
      shortNote: "Diacritics and capital letters do not matter.",
      videoNote: "You do not have to watch the whole video — you can skip freely; the test time keeps running.",
      trueLabel: "True",
      falseLabel: "False",
      prev: "← Back",
      next: "Next →",
      review: "Review answers",
      reviewHeading: "Review answers",
      unanswered: "unanswered",
      answered: "answered",
      submit: "Submit test",
      confirmTitle: "Submit the test?",
      confirmAll: "All questions are answered. After submitting, answers cannot be changed.",
      cancelReview: "Back to the questions",
      timeUp: "Time is up — the test was closed with the answers you managed to save.",
      submitted: "The test has been submitted.",
      showResult: "Show result",
      passedNotice: "You passed the test.",
      passedWord: "Passed",
      failedWord: "Not passed",
      factPassing: "Pass mark",
      factRemaining: "Attempts left",
      factNext: "Next attempt",
      unlimited: "no limit",
      now: "now",
      retry: "Try again",
      retryNote: "Questions will be drawn again.",
      toCourse: "Course overview",
      reviewTitle: "Question review",
      detailsPurged: "The questions and answers of this attempt were removed a year after the course was completed. The result remains.",
      filterAll: "All",
      filterWrong: "Incorrect",
      yourAnswer: "Your answer",
      correctAnswer: "Correct answer",
      noAnswer: "no answer",
      hidden: "Correct answers are not shown",
      attemptsSide: "Your attempts",
      whoSees: "Who sees the result",
      continueTest: "Continue",
      result: "Result",
      tryAgain: "Try again",
      assignTest: "Assign test",
      testRequired: "Required",
      removeTest: "Remove",
      noReadyTests: "There is no ready test yet.",
      intro: "Introduction",
      answerLabel: "Answer",
      multipleShort: "multiple correct",
      factDuration: "Time",
      minutes: n => `${n} min`,
      attemptOf: (n, m) => (m ? `${n} of ${m}` : `${n}`),
      ruleShow: { never: "Correct answers are not shown.", after_submit: "You will see the correct answers after submitting.", after_pass: "You will see the correct answers after passing the test.", after_last_attempt: "You will see the correct answers after the last attempt." },
      previous: (date, pct, passed) => `Previous attempt ${date}: ${pct} % — ${passed ? "passed" : "not passed"}.`,
      blockedPause: time => `The next attempt is possible at ${time} — the test has a pause between attempts.`,
      blockedExhausted: (n, names) => `You have used ${n} of ${n} attempts. Another attempt can be allowed by the person responsible for the test${names ? ` — ${names}` : ""}.`,
      questionOf: (n, m) => `Question ${n} / ${m}`,
      remaining: t => `${t} left`,
      saved: t => `✓ saved ${t}`,
      questionHead: (n, m, w) => `Question ${n} of ${m}${w > 1 ? ` · weight ${w}` : ""}`,
      reviewUnanswered: n => `Review answers · ${n} unanswered`,
      confirmText: (n, list) => `Unanswered questions: ${n} (${list}). After submitting, answers cannot be changed.`,
      noscriptDeadline: (start, end) => `You started the test at ${start} — submit it by ${end}. After that the server accepts only what has already been sent.`,
      kicker: (title, n, m, date) => `Test: ${title} · attempt ${n}${m ? ` of ${m}` : ""} · ${date}`,
      partDoneNotice: title => `Part “${title}” is done.`,
      failedNotice: (missing, pass) => `Not passed — ${missing} percentage points short of the ${pass} % pass mark.`,
      points: (p, max) => `${p} of ${max} points`,
      passMark: p => `pass mark ${p} %`,
      hiddenReason: { never: "This test does not show correct answers.", after_submit: "They are shown after submitting.", after_pass: "They will be shown after passing the test.", after_last_attempt: "They will be shown after the last attempt." },
      wrongCount: n => `Incorrect answers: ${n}.`,
      whoSeesText: names => `You and the people responsible for the test${names ? ` (${names})` : ""}. HR does not see the score.`,
      duration: s => `${Math.floor(s / 60)} min ${s % 60} s`,
      testOpen: (time, q, total) => `in progress · ${time ? `${time} left` : "no time limit"} · question ${q} of ${total}`,
      testPassedPct: p => `passed ${p} %`,
      testFailedPct: p => `not passed ${p} %`,
      nextAttemptAt: t => `next attempt at ${t}`,
      attemptsLeft: (r, m) => `${r} of ${m} left`,
      testMeta: (q, pass, att, names) => `${q} questions · pass mark ${pass} %${att ? ` · ${att} attempts` : ""}${names ? ` · responsible: ${names}` : ""}`,
    },
    results: {
      selectTest: "Test",
      exportCsv: "Export CSV",
      colPerson: "Person",
      colContext: "Course / part",
      colDate: "Date",
      colAttempt: "Attempt",
      colScore: "Score",
      colResult: "Result",
      openState: "in progress",
      resetState: "reset",
      reset: "Reset",
      resetText: "Attempts are not deleted — they are marked as reset and the person can try the test again. This is recorded in the audit log.",
      reason: "Reason (required)",
      resetButton: "Reset attempts",
      empty: "No one has taken the test yet.",
      cancel: "Cancel",
      noTests: "You are not responsible for any test.",
      show: "Show",
      alsoResponsible: names => `Also responsible: ${names}`,
      resetTitle: name => `Reset attempts — ${name}`,
      resetDone: n => `Attempts reset: ${n}.`,
    },
    cert: {
      backToCertificate: "Back to certificate",
      registrationNumber: (n: string) => `Reg. No. ${n}`,
      kicker: "Certificate of course completion",
      valid: "Valid",
      revoked: "Revoked",
      number: "Number",
      completed: "Completion date",
      issuer: "Issued by",
      print: "Print",
      downloadPdf: "Download PDF",
      backToCourse: "Back to the course",
      verifyHeading: "Verification",
      verifyNote: "Anyone with the link sees the number, course, date and issuer — not your name.",
      copy: "Copy link",
      revokedPdf: "Neither the PDF nor printing is offered for a revoked certificate.",
      sideVerify: "What verification shows",
      sideVerifyText: "The number, course, completion date and issuer. Not the name.",
      sideKeep: "Retention",
      sideKeepText: "An issued certificate is never deleted and stays valid after the relationship ends. The number stays verifiable.",
      notYet: "The certificate is issued once the course is completed.",
      noCertificate: "The course does not issue a certificate.",
      show: "Show certificate",
      vTitle: "Certificate verification",
      vCourse: "Course",
      vIssuer: "Issuer",
      vNameNote: "The holder's name is not shown during verification. Compare it with the name on the certificate you were given.",
      vNotFound: "Certificate not found",
      vNotFoundText: "Check the link or open it again from the certificate.",
      vSecurity: "For security reasons we do not reveal whether a certificate with this number exists.",
      vFooter: "Verified by Contineo",
      pdfTitle: "CERTIFICATE",
      pdfSub: "of course completion",
      pdfVerify: "Verification",
      signature: "signature",
      colCertificate: "Certificate",
      revoke: "Revoke",
      revokeText: "Revocation cannot be undone. Public verification shows “revoked” without the reason; the holder sees the reason.",
      revokeReason: "Reason (required)",
      revokeButton: "Revoke certificate",
      revokedMsg: "The certificate has been revoked.",
      cancel: "Cancel",
      printNote: "Set printing to A4 landscape. The PDF with a QR code is on the certificate page.",
      completedCourse: (title, v) => `completed the course ${title} (version ${v})`,
      revokedNotice: (date, reason) => `The certificate was revoked on ${date}. Reason: ${reason}`,
      vValid: issuer => `The certificate is valid — issued by ${issuer} and not revoked.`,
      vRevoked: date => `The certificate was revoked — ${date}.`,
      pdfConfirms: org => `${org} confirms that`,
      pdfCompleted: title => `has successfully completed the course ${title}`,
      pdfMeta: (v, parts, tests, date) => `version ${v} · ${parts} part${parts === 1 ? "" : "s"}${tests ? ` · ${tests} test${tests === 1 ? "" : "s"} passed` : ""} · completed ${date}`,
      issuedOn: date => `Issued ${date}`,
      revokeTitle: name => `Revoke certificate — ${name}`,
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
