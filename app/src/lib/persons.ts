/**
 * persons.ts — kto do organizácie patrí (kolekcia `persons`, Fáza 8).
 *
 * Doteraz rozhodovala o prístupe premenná `POVOLENE_EMAILY` a v `auth.ts` to
 * bolo aj zdôvodnené: pri piatich až desiatich hodnotiteľoch je zmena premennej
 * prehľadnejšia než admin rozhranie, ktoré by samo potrebovalo správu prístupov.
 *
 * Pri stovke ľudí to prestáva platiť z troch dôvodov naraz: zoznam sa nedá
 * udržiavať, každá zmena znamená nasadenie, a hlavne — k adrese treba priviazať
 * meno, útvar, typ osoby a trasu onboardingu. To do reťazca oddeleného čiarkami
 * nepatrí (rozhodnutie D26).
 *
 * Táto kolekcia je **doménová vrstva**: kto to je v organizácii. Technická
 * vrstva prihlásenia (`auth_users`, ktorú zakladá `authAdapter.ts`) zostáva
 * nedotknutá — sú to dve rôzne otázky a miešať ich by znamenalo, že sa nedá
 * pozvať človek, ktorý sa ešte nikdy neprihlásil.
 *
 * **Názvy polí sú anglické**, na rozdiel od `hodnotenia.ts`. Nie je to
 * nedôslednosť: `persons` je kolekcia Modelu B rovnako ako `documents`
 * a `document_chunks`, a schéma je takto zapísaná v `docs/ONBOARDING_KONCEPCIA.md`
 * kap. 3.3. Keby sa kód a dokument rozišli v názvoch polí, jeden z nich by
 * o pol roka klamal.
 */

import { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"
import { normalizeLanguage } from "./i18n"
import type { UiLanguage } from "./i18n"

export const PERSONS_COLLECTION = "persons"

/**
 * Typ osoby. Pripravené pole, **nie filtrovacie kritérium pre prístup** —
 * prístup rieši `accessLevel` + `companyCode` ako všade inde. Druhá cesta
 * k obsahu by raz zaostala za tou prvou.
 */
export type PersonType = "employee" | "external" | "referee" | "official"

/** `invited` = pozvaná, ešte sa neprihlásila. `inactive` = už sem nepatrí. */
export type PersonStatus = "invited" | "active" | "inactive"

export interface Person {
  _id?: ObjectId

  /** UUID, zhodné s `auth_users.id`. Väzba na technickú vrstvu prihlásenia. */
  id: string

  companyCode: string
  /** Vždy malými písmenami — schránka nie je citlivá na veľkosť. */
  email: string
  fullName: string
  department?: string
  personType: PersonType
  startDate?: Date
  status: PersonStatus

  /**
   * Jazyk **prostredia** — v čom sa s človekom rozprávame (rozhranie, e-maily,
   * znenie formulky). Nemá nič spoločné s jazykom smerníc, ktoré číta:
   * český rozhodca môže v českom rozhraní potvrdzovať slovenský predpis
   * a záznam si to zapamätá (`i18n.ts`).
   */
  language: UiLanguage

  /** Kľúče trás onboardingu, ktoré sa tejto osoby týkajú. */
  tracks: string[]

  /**
   * Skupiny na prideľovanie — **tretia dimenzia** vedľa trás a útvarov (D38).
   *
   * Trasa je obsah („čím mám prejsť"), útvar je štruktúra („kam patrím“),
   * skupina je adresát („komu sa to posiela"). Zlúčiť skupiny s trasami by
   * znamenalo, že jednorazovú úlohu nemožno prideliť bez toho, aby vznikla
   * umelá trasa; zlúčiť ich s útvarmi by znamenalo, že sa nedá osloviť
   * skupina naprieč útvarmi — a práve tá býva adresátom noriem
   * (rozhodcovia, delegáti, štatutári).
   *
   * Vždy malými písmenami — porovnáva sa s publikom pridelenia.
   */
  groups: string[]

  /** Prázdne u bežnej osoby. `"hr"` alebo `"platform-admin"`. */
  roles: string[]

  invitedAt?: Date
  firstLoginAt?: Date
  lastLoginAt?: Date

  /**
   * Predchádzajúce prihlásenie — voči nemu sa počíta príznak „nové" (D39).
   *
   * `lastLoginAt` na to nestačí: pri prihlásení sa prepíše na *teraz*, takže
   * by „nové" bolo len to, čo pribudlo počas už otvorenej relácie — teda
   * spravidla nič. Otázka pritom znie „čo pribudlo, odkedy som tu bol
   * naposledy", a na tú odpovedá až predošlá hodnota.
   */
  previousLoginAt?: Date

  /**
   * Identifikátory v cudzích systémoch, ktorými sa človek prihlasuje.
   *
   * Zapisujú sa **až po úspešnom prihlásení** (D45) a slúžia na jedinú vec:
   * rozpoznať, že je to to isté konto, aj keď sa zmení adresa. Adresa sa mení —
   * ľudia sa vydávajú, organizácie sa premenúvajú; `oid` a `sub` nie.
   *
   * Prístup **neudeľujú**. Ten je stále len v `persons` a v `status`.
   */
  externalRef?: {
    sportnetId?: string | null
    /** `oid` z Entra ID. */
    entraObjectId?: string | null
    /** `sub` z Google. */
    googleSub?: string | null
  }

  createdBy?: string
  createdAt: Date
}

/** Údaje pre založenie alebo aktualizáciu osoby — napr. z CSV importu. */
export interface NewPerson {
  email: string
  fullName: string
  companyCode: string
  department?: string
  personType?: PersonType
  startDate?: Date
  tracks?: string[]
  groups?: string[]
  roles?: string[]
  /** Voliteľné v CSV; neznáme alebo chýbajúce padá na slovenčinu. */
  language?: string
}

/** Adresa v tvare, v ktorom sa porovnáva a ukladá. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
/**
 * Kľúče (skupiny, trasy) v tvare, v ktorom sa porovnávajú aj ukladajú.
 *
 * Bez normalizácie by „Rozhodcovia" a „rozhodcovia" boli dve skupiny a jedna
 * z nich by nedostala nič — a nikto by nevedel prečo, lebo v zozname by
 * vyzerali rovnako.
 */
export function normalizeKeys(hodnoty: string[] | undefined): string[] {
  return [...new Set((hodnoty ?? []).map(h => h?.trim().toLowerCase()).filter(Boolean))]
}


/** Nájde osobu podľa adresy. `null`, keď taká v organizácii nie je. */
export async function findPerson(email: string): Promise<Person | null> {
  const address = normalizeEmail(email)
  if (!address.includes("@")) return null
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  return col.findOne({ email: address })
}

/**
 * Smie sa táto adresa prihlásiť **podľa kolekcie `persons`**?
 *
 * Zámerne nevie o núdzovej brzde `POVOLENE_EMAILY` — tú skladá `auth.ts`.
 * Keby si tento modul importoval `auth.ts` a `auth.ts` jeho, vznikol by
 * kruh; a hlavne: každý z tých dvoch zdrojov povolenia má odpovedať na inú
 * otázku. Tu je otázka „patrí do organizácie?", tam „je to správca?".
 *
 * **Chyba databázy neotvára prístup.** Keď sa `persons` nedá prečítať,
 * vraciame `false` — nie „prepustíme a overíme potom". Prihlásenie je jediné
 * miesto medzi internými smernicami a internetom; tichý fallback do otvorených
 * dverí je presne ten druh chyby, ktorý si nikto nevšimne, kým nebude neskoro.
 * Núdzová brzda v `auth.ts` zostáva funkčná aj pri výpadku, takže sa správca
 * dnu dostane vždy.
 */
export async function personMaySignIn(email: string): Promise<boolean> {
  const address = normalizeEmail(email)
  if (!address.includes("@")) return false
  try {
    // Hľadáme existenciu, nie konkrétny záznam: tá istá adresa môže patriť
    // do viacerých jednotiek (`person_memberships` je pole, D32) a na
    // prihlásenie stačí, aby ju aspoň jedna z nich nemala vyradenú.
    const col = await getCollection<Person>(PERSONS_COLLECTION)
    const count = await col.countDocuments(
      { email: address, status: { $ne: "inactive" } },
      { limit: 1 }
    )
    return count > 0
  } catch (e) {
    // Nahlas, nie ticho — inak by sa výpadok tváril ako „nemáš prístup"
    // a nikto by nehľadal príčinu.
    console.error("[persons] persons sa nedá prečítať, platí len POVOLENE_EMAILY:", e)
    return false
  }
}

/**
 * Zaznamená prihlásenie. `invited` → `active` pri prvom vstupe.
 *
 * Nevracia chybu, keď osoba v `persons` nie je — to je legitímny stav pre
 * správcu, ktorý prešiel núdzovou brzdou. Zlyhanie tu nesmie zhodiť
 * prihlásenie samotné: je to evidencia, nie brána.
 */
export async function recordSignIn(email: string): Promise<void> {
  const address = normalizeEmail(email)
  const now = new Date()
  try {
    const col = await getCollection<Person>(PERSONS_COLLECTION)

    // Bez `upsert` — prihlásenie nesmie založiť osobu. Kto sa dostal dnu
    // núdzovou brzdou, do `persons` nepatrí, kým ho tam niekto nepozve.
    //
    // Posun `lastLoginAt` → `previousLoginAt` a zápis nového času sú jedna
    // operácia (aktualizácia rúrou). Dva samostatné zápisy by pri súbežných
    // prihláseniach z dvoch zariadení skončili tak, že si oba prečítajú tú
    // istú starú hodnotu a jedno prihlásenie z histórie zmizne.
    await col.updateOne(
      { email: address },
      [{ $set: { previousLoginAt: "$lastLoginAt", lastLoginAt: now } }],
    )

    // Prvé prihlásenie sa zapíše len raz — podmienka je v dotaze, nie v kóde,
    // takže dva súbežné requesty nezapíšu dva rôzne časy.
    await col.updateOne(
      { email: address, firstLoginAt: { $exists: false } },
      { $set: { firstLoginAt: now } }
    )

    // `invited` → `active` len z pozvaného stavu. Vyradenú osobu (`inactive`)
    // by prihlásenie nesmelo oživiť ani vtedy, keby sa cez bránu dostala inak.
    await col.updateOne(
      { email: address, status: "invited" },
      { $set: { status: "active" as PersonStatus } }
    )
  } catch (e) {
    console.error("[persons] zápis prihlásenia zlyhal:", e)
  }
}

/**
 * Zapíše identifikátor konta, ktorým sa človek práve prihlásil.
 *
 * Bez `upsert` a bez zakladania osoby — prihlásenie nesmie nikoho pridať do
 * organizácie. Zlyhanie sa prehltne: je to evidencia, nie brána, a človek,
 * ktorý má na vstup nárok, nesmie zostať vonku kvôli nej.
 */
export async function recordExternalRef(
  email: string,
  provider: "microsoft" | "google",
  externalId: string,
): Promise<void> {
  const address = normalizeEmail(email)
  const pole = provider === "microsoft" ? "externalRef.entraObjectId" : "externalRef.googleSub"
  try {
    const col = await getCollection<Person>(PERSONS_COLLECTION)
    await col.updateOne({ email: address }, { $set: { [pole]: externalId } })
  } catch (e) {
    console.error("[persons] zápis identifikátora konta zlyhal:", e)
  }
}

// ── Import osôb ──────────────────────────────────────────────────────────────

/** Výsledok overenia jedného riadku importu. */
export type ValidatedRow =
  | { ok: true; email: string; companyCode: string }
  | { ok: false; email: string; reason: string }

/**
 * Overí jeden riadok importu **bez databázy**.
 *
 * Vyčlenené zámerne: sú to jediné pravidlá v celom module, ktoré sa dajú
 * pomýliť, a zároveň jediné, ktoré sa dajú otestovať bez clustera. Zvyšok
 * `upsertPersons()` je už len zápis.
 */
export function validateRow(r: NewPerson): ValidatedRow {
  const email = normalizeEmail(r?.email ?? "")
  if (!email.includes("@")) return { ok: false, email: r?.email ?? "", reason: "invalid-email" }
  if (!r.companyCode?.trim()) return { ok: false, email, reason: "missing-companyCode" }
  if (!r.fullName?.trim()) return { ok: false, email, reason: "missing-name" }
  return { ok: true, email, companyCode: r.companyCode.trim() }
}

/** Výsledok importu — čo pribudlo, čo sa zmenilo, čo sa preskočilo. */
export interface ImportResult {
  created: number
  updated: number
  unchanged: number
  errors: { email: string; reason: string }[]
}

/**
 * Založí alebo aktualizuje osoby. **Idempotentné**: opakovaný beh toho istého
 * zoznamu nezaloží duplikáty, len prepíše, čo sa zmenilo.
 *
 * Rozpoznávacím kľúčom je `companyCode` + `email` — nie samotná adresa.
 * Tá istá osoba môže vystupovať vo viacerých jednotkách a sú to z pohľadu
 * organizácie dva rôzne vzťahy (D32: hierarchia neudeľuje prístup).
 *
 * `status` sa pri aktualizácii **nemení** — kto sa už prihlásil, zostáva
 * `active`, aj keď v CSV je znova ako nový riadok. Prepísať by znamenalo
 * stratiť informáciu, že tam ten človek už bol.
 */
export async function upsertPersons(
  rows: NewPerson[],
  actor: string
): Promise<ImportResult> {
  const v: ImportResult = { created: 0, updated: 0, unchanged: 0, errors: [] }
  if (rows.length === 0) return v

  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const now = new Date()

  for (const r of rows) {
    const checked = validateRow(r)
    if (!checked.ok) { v.errors.push({ email: checked.email, reason: checked.reason }); continue }
    const { email, companyCode } = checked

    const key = { companyCode, email }
    const changes: Record<string, unknown> = {
      fullName: r.fullName.trim(),
      department: r.department?.trim() || undefined,
      personType: r.personType ?? "employee",
      startDate: r.startDate,
      tracks: r.tracks ?? [],
      groups: normalizeKeys(r.groups),
      roles: r.roles ?? [],
    }

    // Jazyk sa prepíše LEN keď v riadku naozaj je. Bez tejto podmienky by
    // opakovaný import bez stĺpca jazyka ticho prepol každého späť na
    // slovenčinu — rovnaká pasca ako pri `status`, len horšie viditeľná,
    // lebo sa prejaví až v e-maile, ktorý už niekomu odišiel.
    if (r.language !== undefined) changes.language = normalizeLanguage(r.language)

    try {
      const result = await col.updateOne(key, {
        $set: changes,
        $setOnInsert: {
          ...key,
          id: crypto.randomUUID(),
          status: "invited" as PersonStatus,
          ...(r.language === undefined ? { language: normalizeLanguage(undefined) } : {}),
          invitedAt: now,
          externalRef: { sportnetId: null, entraObjectId: null },
          createdBy: actor,
          createdAt: now,
        },
      }, { upsert: true })

      if (result.upsertedCount) v.created++
      else if (result.modifiedCount) v.updated++
      else v.unchanged++
    } catch (e) {
      v.errors.push({ email, reason: String((e as Error).message ?? e) })
    }
  }

  return v
}

/**
 * Náhľad pred zápisom — čo by import spravil, keby sa spustil.
 *
 * Nie je to voliteľná ozdoba. Nahratie stovky ľudí naslepo je presne tá
 * operácia, po ktorej sa hľadá, ako to vrátiť späť — a `persons` nemá
 * rollback. Preto import bez náhľadu neexistuje.
 */
export async function previewImport(rows: NewPerson[]): Promise<{
  created: string[]
  existing: string[]
  errors: { email: string; reason: string }[]
}> {
  const created: string[] = []
  const existing: string[] = []
  const errors: { email: string; reason: string }[] = []

  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const seen = new Set<string>()

  for (const r of rows) {
    const checked = validateRow(r)
    if (!checked.ok) { errors.push({ email: checked.email, reason: checked.reason }); continue }
    const { email, companyCode } = checked

    const key = `${companyCode}|${email}`
    if (seen.has(key)) { errors.push({ email, reason: "duplicate-in-file" }); continue }
    seen.add(key)

    const exists = await col.findOne({ companyCode, email })
    ;(exists ? existing : created).push(email)
  }

  return { created, existing, errors }
}

/**
 * Jazyk prostredia pre danú adresu.
 *
 * Používa sa aj v ceste odosielania e-mailu, teda pred prihlásením — preto
 * nikdy nehádže výnimku. Keď osobu nepoznáme (napr. správca, ktorý prešiel
 * núdzovou brzdou) alebo je databáza nedostupná, platí slovenčina. Zlý jazyk
 * e-mailu je nepríjemnosť; neodoslaný e-mail je zavreté dvere.
 */
export async function personLanguage(email: string): Promise<UiLanguage> {
  try {
    const person = await findPerson(email)
    return normalizeLanguage(person?.language)
  } catch {
    return normalizeLanguage(undefined)
  }
}
