/**
 * approvals.ts — schvaľovanie znenia pred jeho zverejnením (ADR-006).
 *
 * **Schvaľuje sa znenie, nie dokument** (D68). Schvaľuje sa text, ktorý bude
 * ľuďom predložený na potvrdenie a ktorý sa doslova ocitne v potvrdzovacej
 * formulke (D28); dokument je len identita naprieč zneniami.
 *
 * Tento súbor je zámerne **bez databázy**: berie kolá schvaľovania a vracia
 * stav. Rovnaké delenie ako `due.ts` — pravidlo, na ktorom stojí brána pri
 * prideľovaní, sa musí dať otestovať bez Monga a bez toho, aby si ho niekto
 * musel domýšľať z dotazu.
 */

export const APPROVALS_COLLECTION = "approval_rounds"

/** Rozhodnutie jedného schvaľovateľa. `null` znamená „ešte nerozhodol". */
export interface ApproverDecision {
  email: string
  /**
   * Odtlačok mena, nie odkaz na osobu (D24). Kto schválil, musí byť čitateľné
   * o tri roky — aj keď sa človek medzitým volá inak alebo v systéme nie je.
   */
  fullName: string
  decidedAt: Date | null
  decision: "approved" | "rejected" | null
  /** Povinný pri zamietnutí (D71). Bez neho predkladateľ nevie, čo opraviť. */
  reason?: string
}

/**
 * Jedno kolo schvaľovania. Append-only, ako `acknowledgements`: kolo sa
 * nemení a nemaže, druhé kolo po zamietnutí je **nové kolo**, nie prepísané
 * staré. Inak by z histórie zmizlo, že prvý pokus neprešiel.
 */
export interface ApprovalRound {
  companyCode: string
  documentId: string
  versionId: string
  /** Poradie kola, od 1. */
  round: number
  submittedBy: string
  submittedAt: Date
  /** Čo sa v znení mení — pre schvaľovateľa, nie pre archív. */
  note?: string
  approvers: ApproverDecision[]
  closedAt: Date | null
  outcome: "approved" | "rejected" | null
}

/**
 * Stav znenia. **Odvodený, nie uložený** (D27) — uložený stav sa raz rozíde
 * s kolami, z ktorých vznikol.
 *
 * `published-before` je **dočasné lešenie** (D74): znenia zverejnené pred
 * zavedením schvaľovania. Zmizne spolu so skúšobným korpusom (D75) a nemá sa
 * z neho stať trvalý pojem „schválené kedysi predtým".
 */
export type VersionState = "draft" | "in-review" | "approved" | "published-before"

/**
 * Stav z kôl daného znenia.
 *
 * Rozhoduje **posledné kolo**, nie súčet: kto po zamietnutí predloží znovu,
 * má stav podľa nového kola. Staré kolá zostávajú v histórii a v časovej osi
 * (ADR-005), ale na aktuálny stav nemajú vplyv.
 */
export function versionState(
  rounds: ApprovalRound[],
  opts: { publishedBefore?: boolean } = {},
): VersionState {
  if (rounds.length === 0) return opts.publishedBefore ? "published-before" : "draft"

  const last = [...rounds].sort((a, b) => b.round - a.round)[0]
  if (last.outcome === "approved") return "approved"
  // Zamietnuté aj zrušené kolo vracia znenie do konceptu — predkladateľ s ním
  // musí niečo urobiť, a to je presne to, čo „koncept" znamená.
  if (last.outcome === "rejected") return "draft"
  return "in-review"
}

/**
 * Výsledok kola z rozhodnutí, alebo `null`, kým kolo beží.
 *
 * **Jedno zamietnutie zastaví celé kolo** (D71) — aj keď ostatní schválili
 * a aj keď ešte nerozhodli všetci. Pri záväznom predpise nie je dôvod
 * prehlasovať toho, kto namieta, a nechať kolo bežať ďalej by znamenalo, že
 * sa čaká na hlasy, ktoré už nič nezmenia.
 */
export function roundOutcome(approvers: ApproverDecision[]): "approved" | "rejected" | null {
  if (approvers.length === 0) return null
  if (approvers.some(a => a.decision === "rejected")) return "rejected"
  return approvers.every(a => a.decision === "approved") ? "approved" : null
}

/** Kto ešte nerozhodol. Pre obrazovku aj pre upozornenia. */
export function pendingApprovers(round: ApprovalRound): ApproverDecision[] {
  return round.approvers.filter(a => a.decision === null)
}

export type SubmitProblem =
  | "approval.noApprovers"
  | "approval.selfApproval"
  | "approval.alreadyRunning"
  | "approval.alreadyApproved"
  | "approval.publishedBefore"

/**
 * Prečo sa znenie nedá predložiť na schválenie — alebo `null`, keď sa dá.
 *
 * Vracia **kód, nie výnimku**: volajúci ho musí vedieť ukázať pri formulári
 * spolu s tým, čo už človek vyplnil. Rovnako ako pri termíne v `due.ts`.
 */
export function submitProblem(input: {
  rounds: ApprovalRound[]
  approvers: string[]
  submittedBy: string
  publishedBefore?: boolean
}): SubmitProblem | null {
  const state = versionState(input.rounds, { publishedBefore: input.publishedBefore })
  // Znenia spred zavedenia schvaľovania sa **spätne neschvaľujú** (D74).
  // Nie je to technická prekážka, je to to isté rozhodnutie: dopísať im
  // súhlas by znamenalo vyrobiť ho. A keby sa predložiť dali, znenie by
  // počas kola stratilo príznak, prepadlo by do „v schvaľovaní" a brána pri
  // prideľovaní by ho zastavila — norma, ktorá sa dnes prideľuje, by sa
  // prideľovať prestala. Nahrádzajú sa oficiálnymi zneniami (D75).
  if (state === "published-before") return "approval.publishedBefore"
  if (state === "in-review") return "approval.alreadyRunning"
  if (state === "approved") return "approval.alreadyApproved"

  const emails = input.approvers.map(e => e.trim().toLowerCase()).filter(Boolean)
  if (emails.length === 0) return "approval.noApprovers"
  // Kto text nahral, ho neschvaľuje (D69) — inak je schválenie podpis pod
  // vlastnú prácu a záznam o ňom nehovorí nič.
  if (emails.includes(input.submittedBy.trim().toLowerCase())) return "approval.selfApproval"
  return null
}

/**
 * Dá sa toto znenie prideliť? (D73)
 *
 * Dve nezávislé podmienky a **žiadna nenahrádza druhú**: schválené znamená
 * „ľudia sa zhodli, že text je správny", účinné znamená „odkedy zaväzuje"
 * (D6). Znenie sa dá schváliť v septembri s účinnosťou od januára.
 *
 * Vracia dôvod, nie `false`: personalista musí vedieť, **ktorá** z dvoch
 * podmienok mu chýba, inak hľadá naslepo.
 */
export type AssignBlock = "assignment.notApproved" | "assignment.versionNotEffective"

export function assignBlock(input: {
  state: VersionState
  effectiveFrom: Date | null
}): AssignBlock | null {
  // `published-before` prechádza zámerne: sú to znenia, ktoré v knižnici už
  // sú a prideľovali sa (D74). Keby ich brána zastavila, personalista by zo
  // dňa na deň nemohol prideliť nič.
  if (input.state !== "approved" && input.state !== "published-before") {
    return "assignment.notApproved"
  }
  if (!(input.effectiveFrom instanceof Date)) return "assignment.versionNotEffective"
  return null
}

export type DecideProblem =
  | "approval.notApprover"
  | "approval.roundClosed"
  | "approval.alreadyDecided"
  | "approval.reasonRequired"

/**
 * Prečo tento človek nemôže o tomto kole rozhodnúť — alebo `null`, keď môže.
 *
 * **Rozhodnutie je nemenné** (rovnaká úvaha ako pri potvrdení, D24). Kto raz
 * schválil, nemôže to prepísať na zamietnutie: záznam, ktorý sa dá zmeniť,
 * nie je dôkaz o tom, čo si človek vtedy myslel. Ak si to rozmyslí,
 * predkladateľ kolo zruší a otvorí nové — a v histórii je vidieť oboje.
 */
export function decideProblem(input: {
  round: ApprovalRound
  by: string
  decision: "approved" | "rejected"
  reason?: string
}): DecideProblem | null {
  if (input.round.outcome !== null) return "approval.roundClosed"

  const me = input.by.trim().toLowerCase()
  const mine = input.round.approvers.find(a => a.email.trim().toLowerCase() === me)
  // Nie je medzi menovanými (D69). Nie je to len technická kontrola: kolo je
  // zoznam konkrétnych ľudí a ktokoľvek iný doň nemá čo zapisovať, aj keby
  // mal v systéme akúkoľvek rolu.
  if (!mine) return "approval.notApprover"
  if (mine.decision !== null) return "approval.alreadyDecided"

  // Dôvod je povinný **len pri zamietnutí** (D71). Pri schválení by bol
  // obradom navyše: kto súhlasí, nemá čo vysvetľovať.
  if (input.decision === "rejected" && !input.reason?.trim()) return "approval.reasonRequired"
  return null
}
