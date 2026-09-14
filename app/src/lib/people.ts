/**
 * people.ts — správa osôb v organizácii (D46).
 *
 * **Vlastná rola `people-admin`, nie `hr`.** Sú to dve rôzne oprávnenia:
 * `hr` prideľuje normy a vidí, kto ich nepotvrdil — to je o obsahu.
 * `people-admin` zakladá a vyraďuje ľudí — to je o prístupe. V mnohých
 * organizáciách to robia dvaja rôzni ľudia (personalista a IT), a spojiť ich
 * do jednej roly znamená, že IT správca zároveň uvidí, kto si neprečítal
 * disciplinárny poriadok.
 *
 * Rola platí **vo vlastnej organizácii** (D32), rovnako ako `hr`. Správca
 * platformy sem prístup nemá: D41 mu dáva počty naprieč tenantmi, nie mená
 * a adresy ľudí zákazníka.
 *
 * **Osoba sa nikdy nemaže.** Vyradenie je `status: "inactive"` — potvrdenia
 * sú záznamy a musia prežiť odchod človeka (O16). Právo na výmaz podľa GDPR
 * sa rieši osobitným postupom so záznamom, nie tlačidlom v zozname.
 */

import { getCollection } from "./mongodb"
import { currentTenant, currentPerson } from "./session"
import { writeAudit, diff } from "./audit"
import { CONTENT_ROLE } from "./library"
import { PERSONS_COLLECTION, normalizeEmail, normalizeKeys, newDepartmentHistory, newGroupHistory } from "./persons"
import { normalizeLanguage } from "./i18n"
import { HR_ROLE } from "./hr"
import type { Person, PersonStatus, PersonType } from "./persons"
import { tenantByCompanyCode } from "./tenants"
import type { Tenant } from "./tenants"
import { composeFullName, splitFullName, normalizePhone, matchWorkplace } from "./personFields"
import { availableOptions } from "./codelistsTenant"
import { allDepartments, pathIdsTo, pathTo } from "./departments"
import { AppError } from "./appError"

export const PEOPLE_ROLE = "people-admin"

/** Roly, ktoré sa dajú prideliť z tejto obrazovky. */
export const ASSIGNABLE_ROLES = [HR_ROLE, PEOPLE_ROLE, CONTENT_ROLE] as const

export function isPeopleAdmin(person: Person | null): boolean {
  return Boolean(person?.roles?.includes(PEOPLE_ROLE))
}

export type PeopleContext =
  | { state: "unknown-host" }
  | { state: "not-signed-in" }
  | { state: "forbidden" }
  | { state: "ready"; person: Person; tenant: Tenant }

export async function peopleContext(): Promise<PeopleContext> {
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    // Výpadok databázy nesmie obrazovku otvoriť. Bez tenanta sa nepokračuje.
    console.error("[people] tenanta sa nepodarilo načítať:", e)
    return { state: "unknown-host" }
  }
  if (!tenant) return { state: "unknown-host" }

  const person = await currentPerson()
  if (!person) return { state: "not-signed-in" }
  if (person.companyCode !== tenant.companyCode || !isPeopleAdmin(person)) {
    return { state: "forbidden" }
  }
  return { state: "ready", person, tenant }
}

export class PersonValidationError extends AppError {}

// ── čítanie ──────────────────────────────────────────────────────────────────

export interface PersonRow {
  id: string
  email: string
  /** Zložené z mena a priezviska (D83). Bez titulov — tie sú zvlášť (D84). */
  fullName: string
  givenName?: string
  surname?: string
  titleBefore?: string
  titleAfter?: string
  /** E.164, napr. `+421905123456` (D86). */
  mobilePhone?: string
  /** Kľúč z číselníka `workplace` organizácie (D85). */
  workplace?: string
  /** Pôvodný textový zápis oddelenia. Ostáva ako stopa, z čoho oddelenie vznikol. */
  department?: string
  /** Zaradenie v štruktúre (D49). `undefined`/`null` = nezaradená. */
  departmentId?: string | null
  /** Pracovná pozícia z adresára (D52). */
  jobTitle?: string
  /** Verzia fotky; chýba = nemá fotku a ukážu sa iniciály. */
  photoVersion?: string
  personType: PersonType
  status: PersonStatus
  language: string
  tracks: string[]
  groups: string[]
  roles: string[]
  lastLoginAt?: Date
  /** Akými kontami sa prihlasuje. Neudeľujú prístup, len ho uľahčujú (D45). */
  accounts: ("microsoft" | "google")[]
  /** Predchádzajúce adresy — aby sa staré potvrdenie dalo spojiť s človekom. */
  emailHistory: { email: string; until: Date }[]
  /** Kto ju zapísal. `auto:microsoft` znamená, že sa založila sama (D47). */
  createdBy?: string
}

function toRow(p: Person): PersonRow {
  return {
    id: p.id,
    email: p.email,
    fullName: p.fullName,
    givenName: p.givenName,
    surname: p.surname,
    titleBefore: p.titleBefore,
    titleAfter: p.titleAfter,
    mobilePhone: p.mobilePhone,
    workplace: p.workplace,
    department: p.department,
    departmentId: p.departmentId ?? null,
    jobTitle: p.jobTitle,
    photoVersion: p.photoVersion,
    personType: p.personType,
    status: p.status,
    language: p.language,
    tracks: p.tracks ?? [],
    groups: p.groups ?? [],
    roles: p.roles ?? [],
    lastLoginAt: p.lastLoginAt,
    emailHistory: (p.emailHistory ?? []).map(h => ({ email: h.email, until: h.until })),
    createdBy: p.createdBy,
    accounts: [
      ...(p.externalRef?.entraObjectId ? ["microsoft" as const] : []),
      ...(p.externalRef?.googleSub ? ["google" as const] : []),
    ],
  }
}

/**
 * Osoby organizácie, voliteľne prefiltrované.
 *
 * Hľadá sa **v mene, adrese a oddelení naraz** — človek, ktorý niekoho hľadá,
 * nevie dopredu, či si pamätá meno alebo adresu, a nemá sa to učiť.
 * Vyradení sú v zozname tiež, len označení: skryť ich by znamenalo, že
 * personalista nevie, prečo sa mu nedá pozvať adresa, ktorú tam „nikto nemá".
 */
export async function listPeople(
  companyCode: string,
  search?: string,
): Promise<PersonRow[]> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const filter: Record<string, unknown> = { companyCode }

  const q = search?.trim()
  if (q) {
    // Escapovanie je nutné: `.` v adrese by inak bolo „ľubovoľný znak"
    // a hľadanie „a.b@x.sk" by našlo aj niečo úplne iné.
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    filter.$or = [
      { fullName: { $regex: safe, $options: "i" } },
      { email: { $regex: safe, $options: "i" } },
      { department: { $regex: safe, $options: "i" } },
      // Pozícia a pracovisko sú rovnako platné vodidlá ako meno: personalista
      // často hľadá „kto je u nás v Senci" alebo „kto robí správcu ihriska".
      { jobTitle: { $regex: safe, $options: "i" } },
      { workplace: { $regex: safe, $options: "i" } },
    ]
  }

  const people = await col.find(filter).sort({ fullName: 1 }).limit(500).toArray()
  return people.map(toRow)
}

/** Jedna osoba **z vlastnej organizácie**. `null`, keď taká nie je. */
export async function loadPersonById(companyCode: string, id: string): Promise<PersonRow | null> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  // `companyCode` je v podmienke, nie v kontrole nad ňou (D32).
  const p = await col.findOne({ companyCode, id })
  return p ? toRow(p) : null
}

// ── zápis ────────────────────────────────────────────────────────────────────

export interface PersonChange {
  /** Nová adresa. Mení sa vedome — nie je to identita, ale je to prihlásenie. */
  email?: string
  /**
   * Meno a priezvisko. Keď príde čo i len jedno z nich, `fullName` sa **skladá
   * z nich** (D83) a prípadné `fullName` nižšie sa ignoruje.
   */
  givenName?: string
  surname?: string
  /**
   * Celé meno priamo — len pre volajúcich spred D83 (napr. import starého
   * súboru s jediným stĺpcom „Meno"). Rozdelí sa a uloží aj po častiach.
   */
  fullName?: string
  titleBefore?: string
  titleAfter?: string
  /** Surový zápis; do E.164 ho prevedie `normalizePhone()` podľa organizácie. */
  mobilePhone?: string
  /** Kľúč z číselníka. Prázdny reťazec = vyprázdniť pole. */
  workplace?: string
  department?: string
  /** `null` = vyradiť zo štruktúry. `undefined` = nemeniť. */
  departmentId?: string | null
  jobTitle?: string
  personType?: PersonType
  language?: string
  tracks?: string[]
  groups?: string[]
  roles?: string[]
}

/**
 * Telefón a pracovisko — polia, ktoré sa nedajú overiť bez organizácie (D85, D86).
 *
 * Predvoľba aj zoznam pracovísk sú vlastnosťou tenanta, takže pravidlo musí
 * vedieť, o ktorú organizáciu ide. Je to jedno miesto pre kartu osoby aj pre
 * pozvanie — dve kópie by znamenali, že to, čo prejde jedným formulárom,
 * druhý odmietne.
 *
 * Vracia **len polia, ktoré prišli**. Prázdny reťazec znamená vyprázdniť;
 * na rozdiel od mena tu prázdno niečo znamená.
 */
async function tenantFields(
  companyCode: string,
  input: { mobilePhone?: string; workplace?: string },
): Promise<{ mobilePhone?: string; workplace?: string }> {
  const out: { mobilePhone?: string; workplace?: string } = {}
  if (input.mobilePhone === undefined && input.workplace === undefined) return out

  const tenant = await tenantByCompanyCode(companyCode)

  if (input.mobilePhone !== undefined) {
    const phone = normalizePhone(input.mobilePhone, tenant?.phonePrefix)
    if (!phone.ok) {
      throw new PersonValidationError(
        phone.reason,
        phone.reason === "phone.noPrefix"
          ? "Číslu chýba predvoľba — napíšte ho s nulou (0905…) alebo medzinárodne (+421…)."
          : "To nevyzerá ako telefónne číslo.",
        { value: input.mobilePhone },
      )
    }
    out.mobilePhone = phone.value
  }

  if (input.workplace !== undefined) {
    const wanted = input.workplace.trim()
    if (!wanted) {
      out.workplace = ""
    } else {
      // Páruje sa aj na popisku, nielen na kľúč — do formulára môže prísť
      // „Banská Bystrica" z importu rovnako ako `banska_bystrica` z ponuky.
      const key = matchWorkplace(wanted, availableOptions(tenant ?? { codelists: {} }, "workplace"))
      if (!key) {
        throw new PersonValidationError(
          "person.unknownWorkplace",
          `Pracovisko „${wanted}" v číselníku organizácie nie je. Doplňte ho v Organizácia → Číselníky.`,
          { value: wanted },
        )
      }
      out.workplace = key
    }
  }
  return out
}

const TYPES: PersonType[] = ["employee", "external", "referee", "official"]

/**
 * Uloží zmeny osoby vrátane adresy.
 *
 * **Adresa nie je identita — tou je `persons.id`** (nemenné UUID). Potvrdenia
 * sa viažu naň (`acknowledgements.personId`) a adresu si nesú len ako **kópiu
 * v čase potvrdenia**, presne ako meno. Zmena adresy preto auditný záznam
 * nerozbije: záznam ďalej ukazuje na tú istú osobu a zároveň si pamätá, ako
 * sa vtedy volala a akú mala adresu.
 *
 * *(Pôvodne tu adresu meniť nešlo a odôvodňovalo sa to práve auditom. Bola to
 * zbytočná prísnosť z môjho nedorozumenia — audit na adrese nikdy nestál.
 * Ľudia sa vydávajú a organizácie menia domény; nútiť ich kvôli tomu vyradiť
 * a pozvať nanovo by znamenalo, že sa história rozpadne na dve osoby, čo je
 * presne to, čomu sa malo predísť.)*
 *
 * Čo zmena adresy **naozaj** ovplyvní: prihlásenie odkazom v e-maile chodí
 * odvtedy na novú adresu. Prihlásenie kontom funguje ďalej, lebo sa rozpozná
 * podľa `externalRef` (`oid`), nie podľa adresy.
 *
 * Nevyplnené pole sa **nemení, nemaže** — inak by uloženie mena zmazalo oddelenie.
 */
export async function savePerson(
  companyCode: string,
  id: string,
  change: PersonChange,
  actor: string,
): Promise<void> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const existing = await col.findOne({ companyCode, id })
  if (!existing) throw new PersonValidationError("person.notFound", "Taká osoba tu nie je.")

  const set: Record<string, unknown> = {}

  if (change.email !== undefined) {
    const next = normalizeEmail(change.email)
    if (!next.includes("@")) throw new PersonValidationError("person.badEmail", "To nie je e-mailová adresa.")
    if (next !== existing.email) {
      // Adresa musí byť v organizácii jedinečná — inak by prihlásenie
      // odkazom nevedelo, koho prihlasuje.
      const col2 = await getCollection<Person>(PERSONS_COLLECTION)
      if (await col2.findOne({ companyCode, email: next })) {
        throw new PersonValidationError("person.emailTaken", `${next} v organizácii už je.`, { email: next })
      }
      set.email = next
      // História zmien adresy. Bez nej by sa po roku nedalo spojiť staré
      // potvrdenie (nesie starú adresu) s dnešným človekom inak než cez `id`,
      // a človek, ktorý ten audit číta, `id` v ruke nemá.
      set.emailHistory = [
        ...(existing.emailHistory ?? []),
        { email: existing.email, until: new Date(), changedBy: actor },
      ]
    }
  }

  // Meno sa **skladá**, nezadáva sa celé (D83). Keď príde čo i len jedna z častí,
  // druhá sa doplní z uloženej hodnoty — inak by uloženie opravy priezviska
  // vymazalo meno.
  if (change.givenName !== undefined || change.surname !== undefined) {
    const givenName = (change.givenName ?? existing.givenName ?? "").trim()
    const surname = (change.surname ?? existing.surname ?? "").trim()
    if (!givenName) throw new PersonValidationError("person.givenNameRequired", "Meno je povinné.")
    if (!surname) throw new PersonValidationError("person.surnameRequired", "Priezvisko je povinné.")
    set.givenName = givenName
    set.surname = surname
    set.fullName = composeFullName(givenName, surname)
  } else if (change.fullName !== undefined) {
    // Cesta pre volajúcich spred D83. Meno sa uloží aj po častiach, aby sa
    // osoba nedostala do stavu, v ktorom má celé meno, ale karta ho nevie
    // ukázať v poliach.
    const whole = change.fullName.trim()
    if (!whole) throw new PersonValidationError("person.nameRequired", "Meno je povinné — bez neho je v zozname len adresa.")
    set.fullName = whole
    const split = splitFullName(whole)
    if (split) { set.givenName = split.givenName; set.surname = split.surname }
  }

  // Tituly sú evidenčné a **do `fullName` nevstupujú** (D84).
  if (change.titleBefore !== undefined) set.titleBefore = change.titleBefore.trim() || undefined
  if (change.titleAfter !== undefined) set.titleAfter = change.titleAfter.trim() || undefined

  const fromTenant = await tenantFields(companyCode, change)
  if (fromTenant.mobilePhone !== undefined) set.mobilePhone = fromTenant.mobilePhone || undefined
  if (fromTenant.workplace !== undefined) set.workplace = fromTenant.workplace || undefined
  // Oddelenie sa **dá vyprázdniť** zámerne: je to údaj, ktorý sa mení, a človek
  // ho môže naozaj nemať. Na rozdiel od mena tu prázdno niečo znamená.
  if (change.department !== undefined) set.department = change.department.trim() || undefined
  if (change.jobTitle !== undefined) set.jobTitle = change.jobTitle.trim() || undefined

  // Zaradenie a cesta sa zapisujú **spolu**. Keby sa cesta nechala na neskorší
  // prepočet, existoval by okamih, v ktorom človek do oddelenia patrí, ale
  // pridelenie „oddelenia a jeho podriadeným" sa ho netýka — a nikto by neuhádol,
  // prečo práve jemu úloha nepribudla (`matchesAudience`).
  if (change.departmentId !== undefined) {
    const targetId = change.departmentId || null
    const tree = await allDepartments(companyCode)
    if (targetId && !tree.some(o => o.id === targetId)) {
      throw new PersonValidationError("person.departmentNotFound", "Také oddelenie neexistuje.")
    }
    const newPath = pathIdsTo(tree, targetId)
    set.departmentId = targetId
    set.departmentPath = newPath
    set.departmentHistory = newDepartmentHistory(
      existing.departmentHistory, targetId, newPath, new Date(),
    )
  }
  if (change.personType !== undefined) {
    if (!TYPES.includes(change.personType)) throw new PersonValidationError("person.unknownType", "Neznámy typ osoby.")
    set.personType = change.personType
  }
  if (change.language !== undefined) set.language = normalizeLanguage(change.language)
  if (change.tracks !== undefined) set.tracks = normalizeKeys(change.tracks)
  // Skupiny a ich história sa zapisujú **spolu**, rovnako ako oddelenie a cesta.
  // Rozdelené na dva zápisy by chvíľu platilo, že človek v skupine je, ale
  // pridelenie tej skupiny sa ho ešte netýka (D50).
  if (change.groups !== undefined) {
    const groups = normalizeKeys(change.groups)
    set.groups = groups
    set.groupHistory = newGroupHistory(existing.groupHistory, groups, new Date())
  }
  if (change.roles !== undefined) {
    // Prideliť sa dajú len roly z tohto zoznamu. `platform-admin` medzi nimi
    // nie je a nikdy nebude: patrí tenantovi dodávateľa a má vlastnú cestu.
    const allowed = change.roles.filter(r => (ASSIGNABLE_ROLES as readonly string[]).includes(r))
    set.roles = [...new Set(allowed)]
  }

  if (Object.keys(set).length === 0) return
  set.updatedBy = actor
  set.updatedAt = new Date()
  await col.updateOne({ companyCode, id }, { $set: set } as never)

  // Audit až po úspešnom zápise (D51). Opačné poradie by zapisovalo zmeny,
  // ktoré sa nestali. `departmentPath` a obe histórie sa do rozdielu neberú:
  // sú to odvodené polia a v zázname by prehlušili to, čo človek naozaj menil.
  const { departmentPath: _dp, departmentHistory: _dh, groupHistory: _gh,
          updatedBy: _ub, updatedAt: _ua, ...interesting } = set
  const before: Record<string, unknown> = {}
  for (const k of Object.keys(interesting)) before[k] = (existing as Record<string, unknown>)[k]

  await writeAudit({
    companyCode, subject: "person", action: "changed", actor: actor,
    targetId: id, targetLabel: existing.fullName,
    changes: diff(before, interesting),
  })
}

/**
 * Pozve jednu osobu.
 *
 * Nič neodosiela — pozvanie je zápis do `persons`, nie e-mail. Človek sa
 * prihlási vtedy, keď si sám vyžiada odkaz alebo klikne na konto; posielať
 * pozvánku dopredu by znamenalo, že mu odkaz vyprší skôr, než ho otvorí.
 */
export async function invitePerson(
  companyCode: string,
  input: {
    email: string
    givenName?: string
    surname?: string
    /** Len pre volajúcich spred D83; keď sú meno a priezvisko, ignoruje sa. */
    fullName?: string
    titleBefore?: string
    titleAfter?: string
    jobTitle?: string
    mobilePhone?: string
    workplace?: string
    department?: string
    personType?: PersonType
    language?: string
  },
  actor: string,
): Promise<PersonRow> {
  const email = normalizeEmail(input.email ?? "")
  if (!email.includes("@")) throw new PersonValidationError("person.badEmail", "To nie je e-mailová adresa.")

  const givenName = input.givenName?.trim()
  const surname = input.surname?.trim()
  // Tá istá deliaca čiara ako v `savePerson`: keď prídu časti, meno sa skladá
  // z nich; celé meno je cesta pre starý import.
  const fullName = (givenName || surname)
    ? composeFullName(givenName, surname)
    : (input.fullName?.trim() ?? "")
  if (!fullName) throw new PersonValidationError("person.nameRequiredShort", "Meno je povinné.")
  const split = (givenName || surname) ? null : splitFullName(fullName)

  const fromTenant = await tenantFields(companyCode, input)

  const col = await getCollection<Person>(PERSONS_COLLECTION)
  // Kľúč je organizácia + adresa. Tá istá adresa môže patriť do viacerých
  // jednotiek a sú to z pohľadu organizácie dva rôzne vzťahy (D32).
  if (await col.findOne({ companyCode, email })) {
    throw new PersonValidationError("person.alreadyInvited", `${email} je v organizácii už zapísaná.`, { email })
  }

  const now = new Date()
  const person: Person = {
    id: crypto.randomUUID(),
    companyCode,
    email,
    fullName,
    givenName: givenName || split?.givenName,
    surname: surname || split?.surname,
    titleBefore: input.titleBefore?.trim() || undefined,
    titleAfter: input.titleAfter?.trim() || undefined,
    jobTitle: input.jobTitle?.trim() || undefined,
    mobilePhone: fromTenant.mobilePhone || undefined,
    workplace: fromTenant.workplace || undefined,
    department: input.department?.trim() || undefined,
    personType: (input.personType && TYPES.includes(input.personType)) ? input.personType : "employee",
    status: "invited",
    language: normalizeLanguage(input.language),
    tracks: [],
    groups: [],
    groupHistory: [],
    roles: [],
    invitedAt: now,
    externalRef: { sportnetId: null, entraObjectId: null, googleSub: null },
    createdBy: actor,
    createdAt: now,
  }
  await col.insertOne(person as never)
  await writeAudit({
    companyCode, subject: "person", action: "created", actor: actor,
    targetId: person.id, targetLabel: person.fullName,
    changes: { email: { to: person.email } },
  })
  return toRow(person)
}

/**
 * Vyradí alebo vráti osobu.
 *
 * `inactive` odstrihne od portálu okamžite (`personMaySignIn`). Záznam
 * zostáva — potvrdenia sa naň odkazujú a musia prežiť odchod človeka.
 *
 * Vrátenie dáva `invited`, nie `active`: `active` znamená „už sa prihlásil"
 * a to sa vrátením nestalo. Prvé prihlásenie ho prepne samo.
 */
export async function setPersonStatus(
  companyCode: string,
  id: string,
  status: "inactive" | "invited",
  actor: string,
): Promise<void> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const existing = await col.findOne({ companyCode, id })
  if (!existing) throw new PersonValidationError("person.notFound", "Taká osoba tu nie je.")

  await col.updateOne(
    { companyCode, id },
    { $set: { status, updatedBy: actor, updatedAt: new Date() } } as never,
  )
  await writeAudit({
    companyCode, subject: "person",
    action: status === "inactive" ? "vyradene" : "vratene",
    actor: actor, targetId: id, targetLabel: existing.fullName,
    changes: { status: { from: existing.status, to: status } },
  })
}

/**
 * Kto ešte nikdy nebol dnu.
 *
 * Kritérium je **`firstLoginAt`, nie `status`**. Stav `invited` sa pri prvom
 * prihlásení prepíše na `active`, takže by stačil — až na osoby, ktoré
 * vznikli inak než pozvaním (import, samozaloženie cez pracovné konto, D47).
 * Tie majú stav rovno `active` a pozvánku nikdy nedostali, hoci sú presne tí,
 * ktorých treba osloviť.
 *
 * Vyradené osoby sa neoslovujú: pozvánka niekomu, kto v organizácii už nie je,
 * je horšia než žiadna.
 */
export async function neverSignedIn(companyCode: string): Promise<PersonRow[]> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const people = await col
    .find({ companyCode, status: { $ne: "inactive" }, firstLoginAt: { $exists: false } } as never)
    .sort({ fullName: 1 })
    .toArray()
  return people.map(toRow)
}
