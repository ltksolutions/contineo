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
import { zapisAudit, rozdiel } from "./audit"
import { PERSONS_COLLECTION, normalizeEmail, normalizeKeys, novaHistoriaUtvarov, novaHistoriaSkupin } from "./persons"
import { normalizeLanguage } from "./i18n"
import { HR_ROLE } from "./hr"
import type { Person, PersonStatus, PersonType } from "./persons"
import type { Tenant } from "./tenants"
import { vsetkyOddelenia, cestaIds, cesta } from "./oddelenia"

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
  /** Pôvodný textový zápis útvaru. Ostáva ako stopa, z čoho útvar vznikol. */
  department?: string
  /** Zaradenie v štruktúre (D49). `undefined`/`null` = nezaradená. */
  departmentId?: string | null
  personType: PersonType
  status: PersonStatus
  language: string
  tracks: string[]
  groups: string[]
  roles: string[]
  lastLoginAt?: Date
  /** Akými kontami sa prihlasuje. Neudeľujú prístup, len ho uľahčujú (D45). */
  konta: ("microsoft" | "google")[]
  /** Predchádzajúce adresy — aby sa staré potvrdenie dalo spojiť s človekom. */
  emailHistory: { email: string; doKedy: Date }[]
  /** Kto ju zapísal. `auto:microsoft` znamená, že sa založila sama (D47). */
  createdBy?: string
}

function naRiadok(p: Person): PersonRow {
  return {
    id: p.id,
    email: p.email,
    fullName: p.fullName,
    department: p.department,
    departmentId: p.departmentId ?? null,
    personType: p.personType,
    status: p.status,
    language: p.language,
    tracks: p.tracks ?? [],
    groups: p.groups ?? [],
    roles: p.roles ?? [],
    lastLoginAt: p.lastLoginAt,
    emailHistory: (p.emailHistory ?? []).map(h => ({ email: h.email, doKedy: h.doKedy })),
    createdBy: p.createdBy,
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
  /** Nová adresa. Mení sa vedome — nie je to identita, ale je to prihlásenie. */
  email?: string
  fullName?: string
  department?: string
  /** `null` = vyradiť zo štruktúry. `undefined` = nemeniť. */
  departmentId?: string | null
  personType?: PersonType
  language?: string
  tracks?: string[]
  groups?: string[]
  roles?: string[]
}

const TYPY: PersonType[] = ["employee", "external", "referee", "official"]

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

  if (zmena.email !== undefined) {
    const nova = normalizeEmail(zmena.email)
    if (!nova.includes("@")) throw new PersonValidationError("To nie je e-mailová adresa.")
    if (nova !== existuje.email) {
      // Adresa musí byť v organizácii jedinečná — inak by prihlásenie
      // odkazom nevedelo, koho prihlasuje.
      const col2 = await getCollection<Person>(PERSONS_COLLECTION)
      if (await col2.findOne({ companyCode, email: nova })) {
        throw new PersonValidationError(`${nova} v organizácii už je.`)
      }
      set.email = nova
      // História zmien adresy. Bez nej by sa po roku nedalo spojiť staré
      // potvrdenie (nesie starú adresu) s dnešným človekom inak než cez `id`,
      // a človek, ktorý ten audit číta, `id` v ruke nemá.
      set.emailHistory = [
        ...(existuje.emailHistory ?? []),
        { email: existuje.email, doKedy: new Date(), zmenil: actor },
      ]
    }
  }

  if (zmena.fullName !== undefined) {
    const meno = zmena.fullName.trim()
    if (!meno) throw new PersonValidationError("Meno je povinné — bez neho je v zozname len adresa.")
    set.fullName = meno
  }
  // Útvar sa **dá vyprázdniť** zámerne: je to údaj, ktorý sa mení, a človek
  // ho môže naozaj nemať. Na rozdiel od mena tu prázdno niečo znamená.
  if (zmena.department !== undefined) set.department = zmena.department.trim() || undefined

  // Zaradenie a cesta sa zapisujú **spolu**. Keby sa cesta nechala na neskorší
  // prepočet, existoval by okamih, v ktorom človek do útvaru patrí, ale
  // pridelenie „útvaru a jeho podriadeným" sa ho netýka — a nikto by neuhádol,
  // prečo práve jemu úloha nepribudla (`matchesAudience`).
  if (zmena.departmentId !== undefined) {
    const cielId = zmena.departmentId || null
    const strom = await vsetkyOddelenia(companyCode)
    if (cielId && !strom.some(o => o.id === cielId)) {
      throw new PersonValidationError("Taký útvar neexistuje.")
    }
    const novaCesta = cestaIds(strom, cielId)
    set.departmentId = cielId
    set.departmentPath = novaCesta
    set.departmentHistory = novaHistoriaUtvarov(
      existuje.departmentHistory, cielId, novaCesta, new Date(),
    )
  }
  if (zmena.personType !== undefined) {
    if (!TYPY.includes(zmena.personType)) throw new PersonValidationError("Neznámy typ osoby.")
    set.personType = zmena.personType
  }
  if (zmena.language !== undefined) set.language = normalizeLanguage(zmena.language)
  if (zmena.tracks !== undefined) set.tracks = normalizeKeys(zmena.tracks)
  // Skupiny a ich história sa zapisujú **spolu**, rovnako ako útvar a cesta.
  // Rozdelené na dva zápisy by chvíľu platilo, že človek v skupine je, ale
  // pridelenie tej skupiny sa ho ešte netýka (D50).
  if (zmena.groups !== undefined) {
    const skupiny = normalizeKeys(zmena.groups)
    set.groups = skupiny
    set.groupHistory = novaHistoriaSkupin(existuje.groupHistory, skupiny, new Date())
  }
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

  // Audit až po úspešnom zápise (D51). Opačné poradie by zapisovalo zmeny,
  // ktoré sa nestali. `departmentPath` a obe histórie sa do rozdielu neberú:
  // sú to odvodené polia a v zázname by prehlušili to, čo človek naozaj menil.
  const { departmentPath: _dp, departmentHistory: _dh, groupHistory: _gh,
          updatedBy: _ub, updatedAt: _ua, ...zaujimave } = set
  const pred: Record<string, unknown> = {}
  for (const k of Object.keys(zaujimave)) pred[k] = (existuje as Record<string, unknown>)[k]

  await zapisAudit({
    companyCode, predmet: "osoba", akcia: "zmenene", aktor: actor,
    cielId: id, cielPopis: existuje.fullName,
    zmeny: rozdiel(pred, zaujimave),
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
    groupHistory: [],
    roles: [],
    invitedAt: now,
    externalRef: { sportnetId: null, entraObjectId: null, googleSub: null },
    createdBy: actor,
    createdAt: now,
  }
  await col.insertOne(osoba as never)
  await zapisAudit({
    companyCode, predmet: "osoba", akcia: "zalozene", aktor: actor,
    cielId: osoba.id, cielPopis: osoba.fullName,
    zmeny: { email: { na: osoba.email } },
  })
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
  const existuje = await col.findOne({ companyCode, id })
  if (!existuje) throw new PersonValidationError("Taká osoba tu nie je.")

  await col.updateOne(
    { companyCode, id },
    { $set: { status, updatedBy: actor, updatedAt: new Date() } } as never,
  )
  await zapisAudit({
    companyCode, predmet: "osoba",
    akcia: status === "inactive" ? "vyradene" : "vratene",
    aktor: actor, cielId: id, cielPopis: existuje.fullName,
    zmeny: { status: { z: existuje.status, na: status } },
  })
}
