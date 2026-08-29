/**
 * assignments.ts — pridelenie ako záznam, nie ako výpočet (D37).
 *
 * Doteraz bolo rozposlanie úlohy **tiché**. Keď pribudla nová verzia normy,
 * `trackProgress()` ju začal rátať ako nepotvrdenú každému, koho sa trasa
 * týkala — bez toho, aby to niekto rozhodol, a bez stopy, kedy sa to stalo.
 * Po roku sa tak nedalo povedať ani to, či človek úlohu vôbec dostal.
 *
 * Model má preto **dve pravdy s rôznym pôvodom**:
 *
 *   - *čo mám urobiť* sa naďalej odvodzuje (trasa × platná verzia − potvrdenia).
 *     Druhá kópia stavu by sa rozišla práve pri novej verzii, teda vtedy, keď
 *     na správnosti najviac záleží (D27);
 *   - *že sa to má urobiť* je **záznam tu**. Je to ľudské rozhodnutie: systém
 *     nevie odlíšiť opravu preklepu od novej povinnosti a ani sa o to nemá
 *     pokúšať (D30). Preto je `reason` povinný — „podstatná zmena" prestáva
 *     byť definíciou a stáva sa dôvodom, ktorý napíše človek.
 *
 * Rovnaký vzor ako `acknowledgements`: záznam sa **nemení a nemaže**.
 * Odvolanie je `revokedAt`, nie `deleteOne` — inak by z histórie zmizlo, že
 * niekto niekomu niečo uložil.
 */

import { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"
import { PERSONS_COLLECTION, normalizeKeys } from "./persons"
import { ACKNOWLEDGEMENTS_COLLECTION } from "./acknowledgements"
import type { Person } from "./persons"

export const ASSIGNMENTS_COLLECTION = "assignments"

/**
 * Komu sa prideľuje.
 *
 * `group` je tretia dimenzia vedľa trás a útvarov (D38): trasa je obsah,
 * útvar je štruktúra, skupina je adresát. Keby sa skupiny zlúčili s trasami,
 * jednorazová úloha by sa nedala prideliť bez toho, aby vznikla umelá trasa.
 */
export type AudienceKind = "all" | "group" | "track" | "person"

export interface Audience {
  kind: AudienceKind
  /** Pri `all` sa nevypĺňa. Pri `person` je to adresa, malými písmenami. */
  value?: string
}

/**
 * Čo sa prideľuje — **konkrétne znenie**, nie dokument.
 *
 * Názvy sú kópie, nie odkazy, z toho istého dôvodu ako v `acknowledgements`:
 * o rok sa musí dať prečítať, čo bolo pridelené, aj keď sa dokument medzitým
 * premenoval alebo zmizol.
 */
export interface AssignmentSubject {
  documentId: string
  versionId: string
  documentTitle: string
  versionLabel: string
  effectiveFrom: Date | null
}

export interface Assignment {
  _id?: ObjectId
  companyCode: string
  subject: AssignmentSubject
  audience: Audience
  /** Povinný. Toto je to, čím sa uzatvára D30. */
  reason: string
  assignedBy: string
  assignedAt: Date
  /** `null`, kým platí. Odvolané pridelenie zostáva v histórii. */
  revokedAt: Date | null
  revokedBy?: string | null
}

export class AssignmentValidationError extends Error {
  reason: string
  constructor(reason: string, message: string) {
    super(message)
    this.name = "AssignmentValidationError"
    this.reason = reason
  }
}

// ── pravidlo príslušnosti ────────────────────────────────────────────────────

/**
 * Týka sa toto pridelenie tejto osoby?
 *
 * Čistá funkcia bez databázy — je to **jediné** miesto, kde toto pravidlo
 * existuje. Aj počítanie „koľkých ľudí sa pridelenie týka" ide cez ňu
 * (`audienceMembers`), hoci by sa dalo napísať ako dotaz. Dotaz by bol druhá
 * kópia pravidla a rozišiel by sa s prvou práve pri tom druhu pridelenia,
 * ktorý sa používa najmenej často, teda najneskôr by sa to zistilo.
 *
 * Neznámy druh publika vracia `false`. Nový druh, ktorý sa zabudne doplniť,
 * má radšej neprideliť nikomu než všetkým.
 */
export function matchesAudience(
  person: { email?: string; groups?: string[]; tracks?: string[] },
  audience: Audience,
): boolean {
  const hodnota = audience?.value?.trim().toLowerCase()
  const je = (zoznam: string[] | undefined) =>
    Boolean(hodnota) && (zoznam ?? []).some(x => x?.trim().toLowerCase() === hodnota)

  switch (audience?.kind) {
    case "all": return true
    case "group": return je(person.groups)
    case "track": return je(person.tracks)
    case "person": return Boolean(hodnota) && (person.email ?? "").trim().toLowerCase() === hodnota
    default: return false
  }
}


/** Ľudské pomenovanie publika pre obrazovku aj pre e-mail. */
export function audienceLabel(a: Audience): string {
  switch (a?.kind) {
    case "all": return "všetci v organizácii"
    case "group": return `skupina „${a.value}"`
    case "track": return `trasa „${a.value}"`
    case "person": return a.value ?? "(osoba nezadaná)"
    default: return "(neznáme publikum)"
  }
}

// ── zápis ────────────────────────────────────────────────────────────────────

export interface NewAssignment {
  companyCode: string
  subject: AssignmentSubject
  audience: Audience
  reason: string
  assignedBy: string
}

export type AssignResult =
  | { stav: "pridelene"; id: string }
  /** To isté znenie je tomu istému publiku pridelené a neodvolané. */
  | { stav: "uz-je"; id: string }

/**
 * Zapíše pridelenie.
 *
 * **Verziu bez `effectiveFrom` prideliť nemožno.** Nie je to prísnosť navyše:
 * potvrdzovacia formulka obsahuje „platná od {dátum}" (D28), takže by človek
 * dostal úlohu, ktorá sa nedá splniť — a zoznam by mu ju ukazoval dovtedy,
 * kým si niekto nevšimne prečo (D6).
 *
 * Idempotentné podľa trojice organizácia + znenie + publikum. Dvakrát
 * odoslaný formulár nemá vytvoriť dve pridelenia; odvolané pridelenie tomu
 * istému publiku ale zopakovať treba vedieť, preto do kľúča patrí aj
 * `revokedAt: null`.
 */
export async function assign(input: NewAssignment): Promise<AssignResult> {
  const reason = input.reason?.trim() ?? ""
  if (!reason) {
    throw new AssignmentValidationError("missing-reason",
      "Dôvod pridelenia je povinný — je to jediné miesto, kde sa dá zaznamenať, prečo sa má norma potvrdiť znova (D30).")
  }
  if (!input.companyCode?.trim()) {
    throw new AssignmentValidationError("missing-company", "Chýba kód organizácie.")
  }
  if (!input.subject?.versionId || !input.subject?.documentId) {
    throw new AssignmentValidationError("missing-subject", "Chýba dokument alebo jeho znenie.")
  }
  if (!(input.subject.effectiveFrom instanceof Date)) {
    throw new AssignmentValidationError("version-not-effective",
      "Znenie nemá dátum platnosti, a tak sa nedá ani potvrdiť (D6). Najprv mu doplň platnosť.")
  }
  if (input.audience?.kind !== "all" && !input.audience?.value?.trim()) {
    throw new AssignmentValidationError("missing-audience", "Chýba, komu sa prideľuje.")
  }

  const audience: Audience = input.audience.kind === "all"
    ? { kind: "all" }
    : { kind: input.audience.kind, value: input.audience.value!.trim().toLowerCase() }

  const col = await getCollection<Assignment>(ASSIGNMENTS_COLLECTION)
  const kluc = {
    companyCode: input.companyCode.trim(),
    "subject.versionId": input.subject.versionId,
    "audience.kind": audience.kind,
    "audience.value": audience.value ?? { $exists: false },
    revokedAt: null,
  }

  const uz = await col.findOne(kluc as never)
  if (uz) return { stav: "uz-je", id: String(uz._id) }

  const zaznam: Assignment = {
    companyCode: input.companyCode.trim(),
    subject: input.subject,
    audience,
    reason,
    assignedBy: input.assignedBy,
    assignedAt: new Date(),
    revokedAt: null,
  }
  const r = await col.insertOne(zaznam as never)
  return { stav: "pridelene", id: String(r.insertedId) }
}

/**
 * Odvolá pridelenie. Záznam zostáva, len prestane platiť.
 *
 * Odvolanie **nemaže potvrdenia**, ktoré medzitým vznikli — človek ten
 * dokument naozaj prečítal a záznam o tom je jeho, nie náš.
 */
export async function revoke(companyCode: string, id: string, actor: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  const col = await getCollection<Assignment>(ASSIGNMENTS_COLLECTION)
  // `companyCode` je v podmienke, nie v kontrole nad ňou: identifikátor sa dá
  // uhádnuť a personalista jednej organizácie nesmie zasiahnuť do druhej (D32).
  const r = await col.updateOne(
    { _id: new ObjectId(id), companyCode, revokedAt: null } as never,
    { $set: { revokedAt: new Date(), revokedBy: actor } },
  )
  return r.modifiedCount > 0
}

// ── čítanie ──────────────────────────────────────────────────────────────────

/**
 * Platné pridelenia, ktoré sa týkajú tejto osoby.
 *
 * Dotaz zúži kandidátov na tenanta a na publikum, ktoré vôbec môže sedieť;
 * o príslušnosti potom rozhodne `matchesAudience`, aby pravidlo zostalo jedno.
 */
export async function assignmentsForPerson(person: {
  companyCode: string
  email: string
  groups?: string[]
  tracks?: string[]
}): Promise<Assignment[]> {
  const col = await getCollection<Assignment>(ASSIGNMENTS_COLLECTION)
  const kandidati = await col.find({
    companyCode: person.companyCode,
    revokedAt: null,
    $or: [
      { "audience.kind": "all" },
      { "audience.kind": "group", "audience.value": { $in: normalizeKeys(person.groups) } },
      { "audience.kind": "track", "audience.value": { $in: normalizeKeys(person.tracks) } },
      { "audience.kind": "person", "audience.value": person.email.toLowerCase() },
    ],
  } as never).toArray()

  return kandidati.filter(a => matchesAudience(person, a.audience))
}

/**
 * Kedy bolo dané znenie tejto osobe pridelené — **najskôr**.
 *
 * Keď tú istú normu dostane cez skupinu aj cez trasu, platí skorší z dvoch
 * dátumov: úloha jej naozaj visí odvtedy, nie od druhého pridelenia.
 */
export async function assignedAtByVersion(person: {
  companyCode: string
  email: string
  groups?: string[]
  tracks?: string[]
}): Promise<Map<string, Date>> {
  const out = new Map<string, Date>()
  for (const a of await assignmentsForPerson(person)) {
    const doteraz = out.get(a.subject.versionId)
    if (!doteraz || a.assignedAt < doteraz) out.set(a.subject.versionId, a.assignedAt)
  }
  return out
}

// ── prehľad pre HR (D33) ─────────────────────────────────────────────────────

export interface AssignmentOverview {
  id: string
  subject: AssignmentSubject
  audience: Audience
  reason: string
  assignedAt: Date
  assignedBy: string
  /** Koľkých ľudí sa pridelenie týka **dnes**. Počíta sa, neukladá (D27). */
  osob: number
  potvrdili: number
}

/**
 * Ľudia, ktorých sa publikum týka.
 *
 * Načíta osoby tenanta a prefiltruje ich `matchesAudience`. Áno, dalo by sa
 * to spýtať databázy jedným dotazom — a bola by to druhá definícia toho, kto
 * do publika patrí. Pri veľkosti organizácie, pre ktorú je systém stavaný
 * (stovky ľudí), je jedno pravidlo cennejšie než ušetrený dotaz. Keby ich raz
 * boli desaťtisíce, nahradí to agregácia — ale potom sa `matchesAudience`
 * musí stať jej vstupom, nie jej dvojníkom.
 */
export async function audienceMembers(
  companyCode: string,
  audience: Audience,
): Promise<Pick<Person, "id" | "email" | "fullName">[]> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const osoby = await col
    .find(
      { companyCode, status: { $ne: "inactive" } },
      { projection: { id: 1, email: 1, fullName: 1, groups: 1, tracks: 1 } },
    )
    .toArray()
  return osoby.filter(o => matchesAudience(o, audience))
}

/** Prehľad pridelení organizácie, najnovšie hore. */
export async function assignmentOverviews(companyCode: string): Promise<AssignmentOverview[]> {
  const col = await getCollection<Assignment>(ASSIGNMENTS_COLLECTION)
  const zaznamy = await col
    .find({ companyCode, revokedAt: null } as never)
    .sort({ assignedAt: -1 })
    .toArray()

  const ackCol = await getCollection(ACKNOWLEDGEMENTS_COLLECTION)
  const out: AssignmentOverview[] = []

  for (const a of zaznamy) {
    const clenovia = await audienceMembers(companyCode, a.audience)
    const ids = clenovia.map(c => c.id)
    const potvrdili = ids.length === 0 ? 0 : await ackCol.countDocuments({
      type: "acknowledgement",
      versionId: a.subject.versionId,
      personId: { $in: ids },
    })

    out.push({
      id: String(a._id),
      subject: a.subject,
      audience: a.audience,
      reason: a.reason,
      assignedAt: a.assignedAt,
      assignedBy: a.assignedBy,
      osob: clenovia.length,
      potvrdili,
    })
  }
  return out
}

/** Kto z publika ešte nepotvrdil. Menovite — s tým sa dá niečo spraviť. */
export async function nepotvrdili(
  companyCode: string,
  assignmentId: string,
): Promise<Pick<Person, "id" | "email" | "fullName">[]> {
  if (!ObjectId.isValid(assignmentId)) return []
  const col = await getCollection<Assignment>(ASSIGNMENTS_COLLECTION)
  const a = await col.findOne({ _id: new ObjectId(assignmentId), companyCode } as never)
  if (!a) return []

  const clenovia = await audienceMembers(companyCode, a.audience)
  const ackCol = await getCollection(ACKNOWLEDGEMENTS_COLLECTION)
  const potvrdene = await ackCol
    .find({
      type: "acknowledgement",
      versionId: a.subject.versionId,
      personId: { $in: clenovia.map(c => c.id) },
    })
    .project({ personId: 1 })
    .toArray()

  const hotovi = new Set(potvrdene.map(p => (p as { personId: string }).personId))
  return clenovia.filter(c => !hotovi.has(c.id))
}
