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
import { PERSONS_COLLECTION, normalizeKeys, inDepartmentSince, inGroupSince } from "./persons"
import { ACKNOWLEDGEMENTS_COLLECTION } from "./acknowledgements"
import { writeAudit } from "./audit"
import type { Person } from "./persons"
import { AppError } from "./appError"

export const ASSIGNMENTS_COLLECTION = "assignments"

/**
 * Komu sa prideľuje.
 *
 * `group` je tretia dimenzia vedľa trás a oddelení (D38): trasa je obsah,
 * oddelenie je štruktúra, skupina je adresát. Keby sa skupiny zlúčili s trasami,
 * jednorazová úloha by sa nedala prideliť bez toho, aby vznikla umelá trasa.
 */
export type AudienceKind = "all" | "group" | "track" | "person" | "department"

export interface Audience {
  kind: AudienceKind
  /**
   * Pri `all` sa nevypĺňa. Pri `person` je to adresa, malými písmenami.
   * Pri `department` je to identifikátor oddelenia (UUID), **nie jeho názov** —
   * oddelenia sa premenúvajú a pridelenie sa premenovaním nemá rozpadnúť.
   */
  value?: string

  /**
   * Názov v čase pridelenia — **kópia, nie odkaz**, z rovnakého dôvodu ako
   * `documentTitle` nižšie. Oddelenie sa môže premenovať alebo zrušiť a o rok
   * musí byť čitateľné, komu sa vtedy prideľovalo. Na príslušnosť nemá vplyv.
   */
  label?: string
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

  /**
   * Kedy, komu a koľkým sme o pridelení dali vedieť.
   *
   * **Pole, nie jedna hodnota** — pripomenúť sa dá viackrát a je rozdiel medzi
   * „poslali sme raz pred pol rokom" a „posielame štvrtý týždeň po sebe".
   * Odvodiť sa to nedá: e-mail buď odišiel, alebo neodišiel, a to vie len
   * ten, kto ho poslal. Rovnaké rozlíšenie ako medzi úlohou a jej pridelením.
   */
  notified?: { at: Date; by: string; count: number }[]
}

export class AssignmentValidationError extends AppError {
  /** Starší názov pre `code`. Zostáva, aby sa nemusel meniť volajúci kód. */
  get reason(): string {
    return this.code
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
  person: { email?: string; groups?: string[]; tracks?: string[]; departmentPath?: string[] },
  audience: Audience,
): boolean {
  const value = audience?.value?.trim().toLowerCase()
  const matches = (list: string[] | undefined) =>
    Boolean(value) && (list ?? []).some(x => x?.trim().toLowerCase() === value)

  switch (audience?.kind) {
    case "all": return true
    case "group": return matches(person.groups)
    case "track": return matches(person.tracks)
    // Cesta obsahuje aj vlastné oddelenie, aj všetkých nadriadených — porovnanie
    // s ňou preto pokrýva oddelenie **aj celý jeho podstrom**, presne raz a bez
    // druhého pravidla. To je jediný dôvod, prečo je cesta zapísaná na osobe.
    case "department": return matches(person.departmentPath)
    case "person": return Boolean(value) && (person.email ?? "").trim().toLowerCase() === value
    default: return false
  }
}


/**
 * Publiká z výberu na obrazovke.
 *
 * **„Všetci v organizácii" prebije všetko ostatné.** Keby sa výber skladal
 * dokopy, vzniklo by pridelenie pre všetkých a k nemu ešte pridelenia pre
 * skupiny, ktoré sú jeho podmnožinou — v prehľade by to isté znenie viselo
 * štyrikrát a nikto by nevedel, ktorý z tých riadkov niečo znamená.
 *
 * Duplicity sa zahadzujú, neplatné položky sa ticho preskočia. Je to výber
 * z ponuky, nie vstup od cudzieho: nezmysel v ňom znamená chybu v našom
 * formulári, nie niečo, s čím má človek niečo robiť.
 */
export function audienceFromSelection(selection: {
  all?: boolean
  /** Hodnoty zaškrtávacích políčok v tvare `group:rozhodcovia`, `track:zaklad`. */
  selected?: string[]
  /** Ručne napísané adresy, oddelené čiarkou, bodkočiarkou alebo riadkom. */
  addresses?: string
  /** `id` → názov oddelenia. Len na zapísanie čitateľnej kópie do `label`. */
  departmentNames?: Record<string, string>
}): Audience[] {
  if (selection.all) return [{ kind: "all" }]

  const out: Audience[] = []
  const seen = new Set<string>()
  const push = (kind: AudienceKind, value: string) => {
    const key = `${kind}:${value}`
    if (seen.has(key)) return
    seen.add(key)
    const label = kind === "department" ? selection.departmentNames?.[value] : undefined
    out.push(label ? { kind, value, label } : { kind, value })
  }

  for (const raw of selection.selected ?? []) {
    const separator = raw.indexOf(":")
    if (separator === -1) continue
    const kind = raw.slice(0, separator)
    const value = raw.slice(separator + 1).trim().toLowerCase()
    if ((kind !== "group" && kind !== "track" && kind !== "department") || !value) continue
    push(kind, value)
  }

  // Adresy sa píšu ručne, tak sa oddeľujú aj novým riadkom, aj čiarkou —
  // človek prilepí zoznam z tabuľky a nemá premýšľať nad tvarom.
  for (const a of (selection.addresses ?? "").split(/[\n,;]+/)) {
    const email = a.trim().toLowerCase()
    // Bez zavináča to nie je adresa. Prideliť „niečomu, čo vyzeralo ako
    // adresa" znamená neprideliť nikomu a tváriť sa, že je hotovo.
    if (!email.includes("@")) continue
    push("person", email)
  }

  return out
}

/** Ľudské pomenovanie publika pre obrazovku aj pre e-mail. */
export function audienceLabel(a: Audience): string {
  switch (a?.kind) {
    case "all": return "všetci v organizácii"
    case "group": return `skupina „${a.value}"`
    case "track": return `trasa „${a.value}"`
    // Bez názvu by v prehľade svietilo UUID. Ak kópia chýba (staršie záznamy),
    // radšej priznať, že názov nepoznáme, než ukázať identifikátor ako názov.
    case "department": return `oddelenie „${a.label ?? "(neznámy)"}" a jeho podriadené`
    case "person": return a.value ?? "(osoba nezadaná)"
    default: return "(neznáme publikum)"
  }
}

/**
 * Odkedy táto úloha visí **tejto osobe** (D50).
 *
 * Pri pridelení oddelenia to nie je dátum pridelenia: kto do oddelenia pribudol
 * neskôr, dostal úlohu vtedy, keď prišiel. Keby platil pôvodný dátum, nováčik
 * by mal prvý deň v práci úlohu spred roka — teda hneď po termíne, a bez
 * príznaku „nové", lebo pridelenie je staršie než jeho predošlé prihlásenie
 * (D39). To je presne ten stav, ktorý nikto nevie vysvetliť.
 *
 * U ostatných druhov publika sa nič nemení: skupina ani trasa históriu nemajú
 * a predstierať ju by znamenalo tvrdiť niečo, čo nevieme.
 */
export function dateForPerson(
  a: Pick<Assignment, "audience" | "assignedAt">,
  person: Pick<Person, "departmentHistory" | "groupHistory">,
): Date {
  const value = a.audience?.value?.trim().toLowerCase()
  const since =
    a.audience?.kind === "department" ? inDepartmentSince(person)
    : a.audience?.kind === "group" && value ? inGroupSince(person, value)
    : null
  return since && since > a.assignedAt ? since : a.assignedAt
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
  | { status: "pridelene"; id: string }
  /** To isté znenie je tomu istému publiku pridelené a neodvolané. */
  | { status: "uz-je"; id: string }

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
    throw new AssignmentValidationError("assignment.missingReason",
      "Dôvod pridelenia je povinný — je to jediné miesto, kde sa dá zaznamenať, prečo sa má norma potvrdiť znova (D30).")
  }
  if (!input.companyCode?.trim()) {
    throw new AssignmentValidationError("assignment.missingCompany", "Chýba kód organizácie.")
  }
  if (!input.subject?.versionId || !input.subject?.documentId) {
    throw new AssignmentValidationError("assignment.missingSubject", "Chýba dokument alebo jeho znenie.")
  }
  if (!(input.subject.effectiveFrom instanceof Date)) {
    throw new AssignmentValidationError("assignment.versionNotEffective",
      "Znenie nemá dátum platnosti, a tak sa nedá ani potvrdiť (D6). Najprv mu doplň platnosť.")
  }
  if (input.audience?.kind !== "all" && !input.audience?.value?.trim()) {
    throw new AssignmentValidationError("assignment.missingAudience", "Chýba, komu sa prideľuje.")
  }

  const audience: Audience = input.audience.kind === "all"
    ? { kind: "all" }
    : {
        kind: input.audience.kind,
        value: input.audience.value!.trim().toLowerCase(),
        ...(input.audience.label?.trim() ? { label: input.audience.label.trim() } : {}),
      }

  const col = await getCollection<Assignment>(ASSIGNMENTS_COLLECTION)
  const key = {
    companyCode: input.companyCode.trim(),
    "subject.versionId": input.subject.versionId,
    "audience.kind": audience.kind,
    "audience.value": audience.value ?? { $exists: false },
    revokedAt: null,
  }

  const existing = await col.findOne(key as never)
  if (existing) return { status: "uz-je", id: String(existing._id) }

  const record: Assignment = {
    companyCode: input.companyCode.trim(),
    subject: input.subject,
    audience,
    reason,
    assignedBy: input.assignedBy,
    assignedAt: new Date(),
    revokedAt: null,
  }
  const r = await col.insertOne(record as never)
  await writeAudit({
    companyCode: record.companyCode, subject: "assignment", action: "assigned",
    actor: input.assignedBy, targetId: String(r.insertedId),
    targetLabel: `${input.subject.documentTitle} (${input.subject.versionLabel}) — ${audienceLabel(audience)}`,
    note: reason,
  })
  return { status: "pridelene", id: String(r.insertedId) }
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
  const previous = await col.findOne({ _id: new ObjectId(id), companyCode } as never)
  const r = await col.updateOne(
    { _id: new ObjectId(id), companyCode, revokedAt: null } as never,
    { $set: { revokedAt: new Date(), revokedBy: actor } },
  )
  if (r.modifiedCount > 0 && previous) {
    await writeAudit({
      companyCode, subject: "assignment", action: "revoked", actor: actor, targetId: id,
      targetLabel: `${previous.subject.documentTitle} (${previous.subject.versionLabel}) — ${audienceLabel(previous.audience)}`,
    })
  }
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
  departmentPath?: string[]
  /** Nepoužívajú sa tu, ale volajúci ich posiela ďalej do `datumPreOsobu`. */
  departmentHistory?: Person["departmentHistory"]
  groupHistory?: Person["groupHistory"]
}): Promise<Assignment[]> {
  const col = await getCollection<Assignment>(ASSIGNMENTS_COLLECTION)
  const candidates = await col.find({
    companyCode: person.companyCode,
    revokedAt: null,
    $or: [
      { "audience.kind": "all" },
      { "audience.kind": "group", "audience.value": { $in: normalizeKeys(person.groups) } },
      { "audience.kind": "track", "audience.value": { $in: normalizeKeys(person.tracks) } },
      { "audience.kind": "person", "audience.value": person.email.toLowerCase() },
      { "audience.kind": "department", "audience.value": { $in: person.departmentPath ?? [] } },
    ],
  } as never).toArray()

  return candidates.filter(a => matchesAudience(person, a.audience))
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
  departmentPath?: string[]
  departmentHistory?: Person["departmentHistory"]
  groupHistory?: Person["groupHistory"]
}): Promise<Map<string, Date>> {
  const out = new Map<string, Date>()
  for (const a of await assignmentsForPerson(person)) {
    const when = dateForPerson(a, person)
    const until = out.get(a.subject.versionId)
    if (!until || when < until) out.set(a.subject.versionId, when)
  }
  return out
}

/** Jedno pridelenie vlastnej organizácie. `null`, keď také nie je. */
export async function loadAssignment(companyCode: string, id: string): Promise<Assignment | null> {
  if (!ObjectId.isValid(id)) return null
  const col = await getCollection<Assignment>(ASSIGNMENTS_COLLECTION)
  // `companyCode` je v podmienke, nie v kontrole nad ňou: identifikátor sa dá
  // uhádnuť a skúšaním by sa dalo zistiť, čo prideľujú iné organizácie (D32).
  return col.findOne({ _id: new ObjectId(id), companyCode } as never)
}

/**
 * Zaznamená, že sme o pridelení dali vedieť.
 *
 * Volá sa **po** odoslaní, nie pred ním. Zápis pred odoslaním by pri výpadku
 * pošty tvrdil, že ľudia vedia, hoci nedostali nič — a to je horší stav než
 * neodoslaný e-mail, lebo sa nikto nepozrie, prečo nikto nepotvrdzuje.
 */
export async function recordNotification(
  companyCode: string,
  id: string,
  by: string,
  count: number,
): Promise<void> {
  if (!ObjectId.isValid(id)) return
  const col = await getCollection<Assignment>(ASSIGNMENTS_COLLECTION)
  await col.updateOne(
    { _id: new ObjectId(id), companyCode } as never,
    { $push: { notified: { at: new Date(), by, count } } } as never,
  )
  await writeAudit({
    companyCode, subject: "assignment", action: "notified", actor: by, targetId: id,
    note: `odoslané ${count} ľuďom`,
  })
}

// ── prehľad pre HR (D33) ─────────────────────────────────────────────────────

/** Osoba v publiku. `language` je tu preto, že sa jej píše e-mail. */
export type AudienceMember = Pick<Person, "id" | "email" | "fullName" | "language"> & {
  /**
   * Bola v oddelení v čase pridelenia, dnes už nie je (D50).
   *
   * V zozname nepotvrdených zostáva, lebo inak by ticho zmizla a nikto by
   * sa nedozvedel, že sa to nedoriešilo. **E-mail sa jej ale neposiela** —
   * pripomínať normu oddelenia, v ktorom už človek nie je, je nezmysel; čo
   * s tým, rozhodne personalista.
   */
  former?: boolean
}

export interface AssignmentOverview {
  id: string
  subject: AssignmentSubject
  audience: Audience
  reason: string
  assignedAt: Date
  assignedBy: string
  /** Koľkých ľudí sa pridelenie týka **dnes**. Počíta sa, neukladá (D27). */
  count: number
  acknowledged: number
  /** Posledné odoslané oznámenie. `null`, keď sme ešte nedali vedieť. */
  lastNotified: { at: Date; by: string; count: number } | null
  /** Koľkokrát sme už dali vedieť — štvrtá pripomienka je iná informácia. */
  notifiedTotal: number
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
): Promise<AudienceMember[]> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const people = await col
    .find(
      { companyCode, status: { $ne: "inactive" } },
      { projection: { id: 1, email: 1, fullName: 1, language: 1, groups: 1, tracks: 1, departmentPath: 1 } },
    )
    .toArray()
  return people.filter(o => matchesAudience(o, audience))
}

/** Prehľad pridelení organizácie, najnovšie hore. */
export async function assignmentOverviews(companyCode: string): Promise<AssignmentOverview[]> {
  const col = await getCollection<Assignment>(ASSIGNMENTS_COLLECTION)
  const records = await col
    .find({ companyCode, revokedAt: null } as never)
    .sort({ assignedAt: -1 })
    .toArray()

  const ackCol = await getCollection(ACKNOWLEDGEMENTS_COLLECTION)
  const out: AssignmentOverview[] = []

  for (const a of records) {
    const members = await audienceMembers(companyCode, a.audience)
    const ids = members.map(c => c.id)
    const acknowledgedBy = ids.length === 0 ? 0 : await ackCol.countDocuments({
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
      count: members.length,
      acknowledged: acknowledgedBy,
      lastNotified: a.notified?.length ? a.notified[a.notified.length - 1] : null,
      notifiedTotal: a.notified?.length ?? 0,
    })
  }
  return out
}

/** Kto z publika ešte nepotvrdil. Menovite — s tým sa dá niečo spraviť. */
export async function notAcknowledged(
  companyCode: string,
  assignmentId: string,
): Promise<AudienceMember[]> {
  if (!ObjectId.isValid(assignmentId)) return []
  const col = await getCollection<Assignment>(ASSIGNMENTS_COLLECTION)
  const a = await col.findOne({ _id: new ObjectId(assignmentId), companyCode } as never)
  if (!a) return []

  const members = [
    ...await audienceMembers(companyCode, a.audience),
    ...await formerMembers(companyCode, a),
  ]
  const ackCol = await getCollection(ACKNOWLEDGEMENTS_COLLECTION)
  const acknowledgedIds = await ackCol
    .find({
      type: "acknowledgement",
      versionId: a.subject.versionId,
      personId: { $in: members.map(c => c.id) },
    })
    .project({ personId: 1 })
    .toArray()

  const done = new Set(acknowledgedIds.map(p => (p as { personId: string }).personId))
  return members.filter(c => !done.has(c.id))
}

/**
 * Kto v oddelení bol v čase, keď pridelenie platilo, a dnes tam už nie je (D50).
 *
 * Odvodiť sa to nedá — presun je práve tá udalosť, ktorá starý stav prepíše.
 * Preto sa číta `departmentHistory`: hľadá sa uzavretý úsek, ktorý sa
 * **prekrýva** s obdobím platnosti pridelenia. Prekryv, nie „bol tam v deň
 * pridelenia": kto prišiel týždeň po pridelení a o mesiac odišiel, mal
 * povinnosť tiež.
 *
 * Platí len pre publikum druhu oddelenie. Skupiny a trasy históriu nemajú a
 * vymyslieť si ju by znamenalo tvrdiť niečo, čo nevieme.
 */
async function formerMembers(
  companyCode: string,
  a: Pick<Assignment, "audience" | "assignedAt" | "revokedAt">,
): Promise<AudienceMember[]> {
  const kind = a.audience?.kind
  const value = a.audience?.value?.trim().toLowerCase()
  if ((kind !== "department" && kind !== "group") || !value) return []
  const endOfRange = a.revokedAt ?? new Date()

  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const filter = kind === "department"
    ? { companyCode, "departmentHistory.departmentPath": value }
    : { companyCode, "groupHistory.group": value }

  const people = await col
    .find(
      filter as never,
      {
        projection: {
          id: 1, email: 1, fullName: 1, language: 1,
          departmentPath: 1, departmentHistory: 1, groups: 1, groupHistory: 1,
        },
      },
    )
    .toArray()

  // Prekryv úseku s obdobím platnosti pridelenia, nie „bol tam v deň
  // pridelenia": kto prišiel týždeň po pridelení a o mesiac odišiel, mal
  // povinnosť tiež.
  const ranges = (o: Person): { from: Date; to?: Date }[] =>
    kind === "department"
      ? (o.departmentHistory ?? []).filter(z => z.departmentPath.includes(value))
      : (o.groupHistory ?? []).filter(z => z.group === value)

  const isMemberToday = (o: Person): boolean =>
    kind === "department"
      ? (o.departmentPath ?? []).includes(value)
      : normalizeKeys(o.groups).includes(value)

  const out: AudienceMember[] = []
  for (const o of people) {
    // Kto je členom aj dnes, patrí medzi bežných členov — nie sem.
    if (isMemberToday(o)) continue
    const overlaps = ranges(o).some(z => z.from <= endOfRange && (!z.to || z.to >= a.assignedAt))
    if (!overlaps) continue
    out.push({
      id: o.id, email: o.email, fullName: o.fullName, language: o.language, former: true,
    })
  }
  return out
}
