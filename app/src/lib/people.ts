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
import { PERSONS_COLLECTION, normalizeEmail, normalizeKeys } from "./persons"
import { normalizeLanguage } from "./i18n"
import { HR_ROLE } from "./hr"
import type { Person, PersonStatus, PersonType } from "./persons"
import type { Tenant } from "./tenants"

export const PEOPLE_ROLE = "people-admin"

/** Roly, ktoré sa dajú prideliť z tejto obrazovky. */
export const PRIDELITELNE_ROLE = [HR_ROLE, PEOPLE_ROLE] as const

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

export class PersonValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PersonValidationError"
  }
}

// ── čítanie ──────────────────────────────────────────────────────────────────

export interface PersonRow {
  id: string
  email: string
  fullName: string
  department?: string
  personType: PersonType
  status: PersonStatus
  language: string
  tracks: string[]
  groups: string[]
  roles: string[]
  lastLoginAt?: Date
  /** Akými kontami sa prihlasuje. Neudeľujú prístup, len ho uľahčujú (D45). */
  konta: ("microsoft" | "google")[]
}

function naRiadok(p: Person): PersonRow {
  return {
    id: p.id,
    email: p.email,
    fullName: p.fullName,
    department: p.department,
    personType: p.personType,
    status: p.status,
    language: p.language,
    tracks: p.tracks ?? [],
    groups: p.groups ?? [],
    roles: p.roles ?? [],
    lastLoginAt: p.lastLoginAt,
    konta: [
      ...(p.externalRef?.entraObjectId ? ["microsoft" as const] : []),
      ...(p.externalRef?.googleSub ? ["google" as const] : []),
    ],
  }
}

/**
 * Osoby organizácie, voliteľne prefiltrované.
 *
 * Hľadá sa **v mene, adrese a útvare naraz** — človek, ktorý niekoho hľadá,
 * nevie dopredu, či si pamätá meno alebo adresu, a nemá sa to učiť.
 * Vyradení sú v zozname tiež, len označení: skryť ich by znamenalo, že
 * personalista nevie, prečo sa mu nedá pozvať adresa, ktorú tam „nikto nemá".
 */
export async function listPeople(
  companyCode: string,
  hladanie?: string,
): Promise<PersonRow[]> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const filter: Record<string, unknown> = { companyCode }

  const q = hladanie?.trim()
  if (q) {
    // Escapovanie je nutné: `.` v adrese by inak bolo „ľubovoľný znak"
    // a hľadanie „a.b@x.sk" by našlo aj niečo úplne iné.
    const bezpecne = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    filter.$or = [
      { fullName: { $regex: bezpecne, $options: "i" } },
      { email: { $regex: bezpecne, $options: "i" } },
      { department: { $regex: bezpecne, $options: "i" } },
    ]
  }

  const osoby = await col.find(filter).sort({ fullName: 1 }).limit(500).toArray()
  return osoby.map(naRiadok)
}

/** Jedna osoba **z vlastnej organizácie**. `null`, keď taká nie je. */
export async function loadPersonById(companyCode: string, id: string): Promise<PersonRow | null> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  // `companyCode` je v podmienke, nie v kontrole nad ňou (D32).
  const p = await col.findOne({ companyCode, id })
  return p ? naRiadok(p) : null
}

// ── zápis ────────────────────────────────────────────────────────────────────

export interface PersonChange {
  fullName?: string
  department?: string
  personType?: PersonType
  language?: string
  tracks?: string[]
  groups?: string[]
  roles?: string[]
}

const TYPY: PersonType[] = ["employee", "external", "referee", "official"]

/**
 * Uloží zmeny osoby.
 *
 * **Adresa sa nemení a nedá sa meniť.** Je to kľúč, na ktorý sú naviazané
 * potvrdenia aj prihlasovacie kontá; prepísať ho pod existujúcimi záznamami
 * by znamenalo, že sa audit odkazuje na niekoho, kto tam už nie je. Preklep
 * sa rieši vyradením a pozvaním nanovo.
 *
 * Nevyplnené pole sa **nemení, nemaže** — inak by uloženie mena zmazalo útvar.
 */
export async function savePerson(
  companyCode: string,
  id: string,
  zmena: PersonChange,
  actor: string,
): Promise<void> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const existuje = await col.findOne({ companyCode, id })
  if (!existuje) throw new PersonValidationError("Taká osoba tu nie je.")

  const set: Record<string, unknown> = {}

  if (zmena.fullName !== undefined) {
    const meno = zmena.fullName.trim()
    if (!meno) throw new PersonValidationError("Meno je povinné — bez neho je v zozname len adresa.")
    set.fullName = meno
  }
  // Útvar sa **dá vyprázdniť** zámerne: je to údaj, ktorý sa mení, a človek
  // ho môže naozaj nemať. Na rozdiel od mena tu prázdno niečo znamená.
  if (zmena.department !== undefined) set.department = zmena.department.trim() || undefined
  if (zmena.personType !== undefined) {
    if (!TYPY.includes(zmena.personType)) throw new PersonValidationError("Neznámy typ osoby.")
    set.personType = zmena.personType
  }
  if (zmena.language !== undefined) set.language = normalizeLanguage(zmena.language)
  if (zmena.tracks !== undefined) set.tracks = normalizeKeys(zmena.tracks)
  if (zmena.groups !== undefined) set.groups = normalizeKeys(zmena.groups)
  if (zmena.roles !== undefined) {
    // Prideliť sa dajú len roly z tohto zoznamu. `platform-admin` medzi nimi
    // nie je a nikdy nebude: patrí tenantovi dodávateľa a má vlastnú cestu.
    const povolene = zmena.roles.filter(r => (PRIDELITELNE_ROLE as readonly string[]).includes(r))
    set.roles = [...new Set(povolene)]
  }

  if (Object.keys(set).length === 0) return
  set.updatedBy = actor
  set.updatedAt = new Date()
  await col.updateOne({ companyCode, id }, { $set: set } as never)
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
  vstup: { email: string; fullName: string; department?: string; personType?: PersonType; language?: string },
  actor: string,
): Promise<PersonRow> {
  const email = normalizeEmail(vstup.email ?? "")
  if (!email.includes("@")) throw new PersonValidationError("To nie je e-mailová adresa.")
  if (!vstup.fullName?.trim()) throw new PersonValidationError("Meno je povinné.")

  const col = await getCollection<Person>(PERSONS_COLLECTION)
  // Kľúč je organizácia + adresa. Tá istá adresa môže patriť do viacerých
  // jednotiek a sú to z pohľadu organizácie dva rôzne vzťahy (D32).
  if (await col.findOne({ companyCode, email })) {
    throw new PersonValidationError(`${email} je v organizácii už zapísaná.`)
  }

  const now = new Date()
  const osoba: Person = {
    id: crypto.randomUUID(),
    companyCode,
    email,
    fullName: vstup.fullName.trim(),
    department: vstup.department?.trim() || undefined,
    personType: (vstup.personType && TYPY.includes(vstup.personType)) ? vstup.personType : "employee",
    status: "invited",
    language: normalizeLanguage(vstup.language),
    tracks: [],
    groups: [],
    roles: [],
    invitedAt: now,
    externalRef: { sportnetId: null, entraObjectId: null, googleSub: null },
    createdBy: actor,
    createdAt: now,
  }
  await col.insertOne(osoba as never)
  return naRiadok(osoba)
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
  const r = await col.updateOne(
    { companyCode, id },
    { $set: { status, updatedBy: actor, updatedAt: new Date() } } as never,
  )
  if (r.matchedCount === 0) throw new PersonValidationError("Taká osoba tu nie je.")
}
