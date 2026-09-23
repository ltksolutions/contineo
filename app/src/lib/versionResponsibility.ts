/**
 * versionResponsibility.ts — zodpovedná osoba a právny základ pri znení (D91).
 *
 * ## Prečo pri znení, nie pri predpise
 *
 * Novela súťažného poriadku príde o tri roky. Pôvodná zodpovedná osoba medzitým
 * zo zväzu odišla a o novom znení rozhoduje niekto iný — možno z iného oddelenia.
 * Keby osoba visela na predpise, nové znenie by ju **zdedilo potichu** a na
 * obrazovke potvrdenia by ľudia videli kontakt na človeka, ktorý tam už nie je.
 * Preto sa pri každom novom znení zadáva znova a nič sa neprenáša.
 *
 * Právny základ z rovnakého dôvodu: novela môže získať oporu v zákone (alebo ju
 * stratiť) a potvrdenie má niesť základ, ktorý platil pre **to** znenie (O15).
 *
 * ## Čo tu je
 *
 * Len pravidlá, bez databázy — rovnaké delenie ako `approvals.ts` a `due.ts`.
 * Pravidlo „kto smie meniť právny základ" sa musí dať otestovať bez Monga
 * a bez toho, aby si ho niekto domýšľal z dotazu. Zápis je
 * v `versionResponsibilityDb.ts`.
 */

/**
 * Právny základ spracúvania záznamu o oboznámení (O15, odpoveď DPO 2026-09).
 *
 * - `legal_obligation` — plnenie zákonnej povinnosti (napríklad oboznámenie
 *   s predpismi BOZP). Vyžaduje odkaz na konkrétny predpis, inak je kategória
 *   len tvrdenie bez opory.
 * - `legitimate_interest` — oprávnený záujem prevádzkovateľa; interné smernice
 *   bez výslovnej zákonnej opory. Opiera sa o balančný test (O15/A3).
 *
 * **Uzavretý zoznam v kóde, nie číselník tenanta.** Je to právna kategória,
 * od ktorej sa odvíja, čo systém urobí pri žiadosti o výmaz — organizácia si
 * do nej nemá čo pridávať. Súhlas (čl. 6 ods. 1 písm. a) tu zámerne nie je:
 * odvolateľný súhlas a nezvratný doklad o oboznámení sú protirečenie.
 */
export const LEGAL_BASES = ["legal_obligation", "legitimate_interest"] as const
export type LegalBasis = (typeof LEGAL_BASES)[number]

export function isLegalBasis(x: unknown): x is LegalBasis {
  return typeof x === "string" && (LEGAL_BASES as readonly string[]).includes(x)
}

/** Strop pre odkaz na predpis — citácia, nie odsek textu. */
export const MAX_LEGAL_REFERENCE = 200

/**
 * Zodpovedná osoba — **identita aj odtlačok**. `personId` slúži na oprávnenie
 * a na odkaz do adresára; meno a adresa sú kópia v čase určenia, aby história
 * zostala čitateľná aj po odchode človeka (D24).
 */
export interface ResponsiblePerson {
  personId: string
  fullName: string
  email: string
}

/** Zmena zodpovednej osoby — kto, kedy, prečo, z koho na koho. */
export interface ResponsibleChange {
  at: Date
  by: string
  reason: string
  /** `null` pri znení spred D91, ktoré osobu nemalo. */
  from: ResponsiblePerson | null
  to: ResponsiblePerson
}

/** Určenie alebo zmena právneho základu. */
export interface LegalBasisChange {
  at: Date
  /** E-mail toho, kto rozhodol — rovnako ako `fixes[].by`. */
  by: string
  /** Povinný pri **zmene**; pri prvom určení nie je čo zdôvodňovať. */
  reason?: string
  from: LegalBasis | null
  fromReference: string | null
  to: LegalBasis
  toReference: string | null
}

export type ResponsibilityProblem =
  | "responsibility.personRequired"
  | "responsibility.samePerson"
  | "responsibility.reasonRequired"
  | "legalBasis.invalid"
  | "legalBasis.referenceRequired"
  | "legalBasis.referenceTooLong"
  | "legalBasis.noChange"
  | "legalBasis.reasonRequired"

/** Odkaz na predpis bez bielych miest navyše; prázdny znamená žiadny. */
export function tidyReference(reference: string | null | undefined): string | null {
  const r = (reference ?? "").replace(/\s+/g, " ").trim()
  return r ? r : null
}

/**
 * Dá sa takto určiť právny základ?
 *
 * Pri **zmene** už určeného základu je dôvod povinný: potvrdenia, ktoré medzitým
 * vznikli, si nesú starý základ ako odtlačok, a o rok treba vedieť, prečo sa
 * pre to isté znenie zmenil.
 */
export function legalBasisProblem(input: {
  basis: unknown
  reference?: string | null
  current?: LegalBasis | null
  currentReference?: string | null
  reason?: string
}): ResponsibilityProblem | null {
  if (!isLegalBasis(input.basis)) return "legalBasis.invalid"
  const reference = tidyReference(input.reference)
  if (input.basis === "legal_obligation" && !reference) return "legalBasis.referenceRequired"
  if (reference && reference.length > MAX_LEGAL_REFERENCE) return "legalBasis.referenceTooLong"
  if (input.current) {
    if (input.current === input.basis && tidyReference(input.currentReference) === reference) {
      return "legalBasis.noChange"
    }
    if (!input.reason?.trim()) return "legalBasis.reasonRequired"
  }
  return null
}

/**
 * Smie tento človek určiť právny základ znenia?
 *
 * Rozhoduje **zodpovedná osoba toho znenia** — ona predpis pozná a zodpovedá
 * zaň. Správca obsahu je len náhradník: smie, keď znenie zodpovednú osobu
 * nemá (znenie spred D91) alebo keď už nie je aktívna. Inak by rola správcu
 * obsahu potichu prebíjala rozhodnutie človeka, ktorý je za predpis
 * zodpovedný.
 *
 * Oprávnenie sa **odvodzuje, neukladá** (D27): žiadna rola „právnik" navyše,
 * ktorú by bolo treba udržiavať súbežne so zoznamom zodpovedných osôb.
 */
export function canSetLegalBasis(input: {
  actorPersonId: string
  isContentManager: boolean
  responsible: ResponsiblePerson | null | undefined
  /** Je zodpovedná osoba v systéme a nie je vyradená? */
  responsibleActive: boolean
}): boolean {
  if (input.responsible && input.responsibleActive) {
    return input.actorPersonId === input.responsible.personId
  }
  return input.isContentManager
}

/**
 * Dá sa zodpovedná osoba takto zmeniť?
 *
 * Dôvod je povinný vždy — aj pri doplnení osoby k zneniu spred D91. Zmena
 * nemení text, takže netreba nové schválenie ani potvrdenie; o to viac musí
 * byť o rok čitateľné, prečo sa kontakt zmenil.
 */
export function responsibleChangeProblem(input: {
  personId: string | null | undefined
  current: ResponsiblePerson | null | undefined
  reason?: string
}): ResponsibilityProblem | null {
  if (!input.personId?.trim()) return "responsibility.personRequired"
  if (input.current?.personId === input.personId.trim()) return "responsibility.samePerson"
  if (!input.reason?.trim()) return "responsibility.reasonRequired"
  return null
}
