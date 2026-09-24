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
  /** Kľúč položky číselníka (D92). `null` pri zázname spred číselníka. */
  fromKey?: string | null
  to: LegalBasis
  toReference: string | null
  toKey?: string
  /** Kópia názvu položky v čase výberu. */
  toLabel?: string
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
  | "legalBasis.unknownKey"

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
 * Dá sa pri znení vybrať táto položka číselníka (D92)?
 *
 * Voľný text sa už nepripúšťa — zodpovedná osoba vyberá len z ponuky. Pri
 * **zmene** už určeného základu je dôvod povinný z rovnakého dôvodu ako
 * v `legalBasisProblem()`. Základ určený ešte ručne (bez kľúča) sa dá
 * nahradiť položkou z číselníka, ale zdôvodniť to treba.
 */
export function legalBasisChoiceProblem(input: {
  /** Nájdená položka z aktívnej ponuky; `null`, keď kľúč v ponuke nie je. */
  option: { key: string } | null
  currentKey?: string | null
  current?: LegalBasis | null
  reason?: string
}): ResponsibilityProblem | null {
  if (!input.option) return "legalBasis.unknownKey"
  if (input.current) {
    if (input.currentKey && input.currentKey === input.option.key) return "legalBasis.noChange"
    if (!input.reason?.trim()) return "legalBasis.reasonRequired"
  }
  return null
}

/**
 * Jeden právny základ znenia (ADR-017, D115). Znenie ich môže mať viac,
 * aj z oboch kategórií — napr. BOZP (zákonná povinnosť) a interná smernica
 * (oprávnený záujem).
 */
export interface LegalBasisEntry {
  basis: LegalBasis
  key?: string | null
  label?: string | null
  reference?: string | null
}

/**
 * Základy znenia ako zoznam. Znenia spred ADR-017 majú jeden základ v starých
 * poliach — tie sa čítajú ako zoznam s jednou položkou.
 */
export function basesOf(v: {
  legalBases?: LegalBasisEntry[] | null
  legalBasis?: LegalBasis | null
  legalBasisKey?: string | null
  legalBasisLabel?: string | null
  legalBasisReference?: string | null
}): LegalBasisEntry[] {
  if (Array.isArray(v.legalBases) && v.legalBases.length > 0) return v.legalBases
  if (!v.legalBasis) return []
  return [{ basis: v.legalBasis, key: v.legalBasisKey ?? null, label: v.legalBasisLabel ?? null, reference: v.legalBasisReference ?? null }]
}

/**
 * Rozhodujúci druh základu (ADR-017, D116): **zákonná povinnosť má prednosť.**
 * Kým ju má znenie aspoň raz, záznam o potvrdení je potrebný kvôli zákonu
 * a námietka (čl. 21 GDPR) ho nezmaže — oprávnený záujem vedľa nej nič
 * nemení. Tento druh sa ukladá do starého poľa `legalBasis`, takže námietky,
 * retencia a kontroly, ktoré ho čítajú, platia bez zmeny.
 */
export function dominantBasis(entries: LegalBasisEntry[]): LegalBasis | null {
  if (entries.some(e => e.basis === "legal_obligation")) return "legal_obligation"
  if (entries.some(e => e.basis === "legitimate_interest")) return "legitimate_interest"
  return null
}

/** Dá sa zvoliť tento výber základov (D115)? Poradie výberu nerozhoduje. */
export function legalBasesChoiceProblem(input: {
  /** Nájdené položky z aktívnej ponuky; `null` tam, kde kľúč v ponuke nie je. */
  options: ({ key: string } | null)[]
  currentKeys: string[]
  hasCurrent: boolean
  reason?: string
}): ResponsibilityProblem | null {
  if (input.options.length === 0) return "legalBasis.unknownKey"
  if (input.options.some(o => !o)) return "legalBasis.unknownKey"
  const next = [...new Set(input.options.map(o => o!.key))].sort().join(",")
  if (input.hasCurrent) {
    if (next === [...new Set(input.currentKeys)].sort().join(",")) return "legalBasis.noChange"
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
