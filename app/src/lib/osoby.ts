/**
 * osoby.ts — kto do organizácie patrí (kolekcia `persons`, Fáza 8).
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
import { normalizujJazyk } from "./jazyky"
import type { JazykUI } from "./jazyky"

export const KOLEKCIA_OSOBY = "persons"

/**
 * Typ osoby. Pripravené pole, **nie filtrovacie kritérium pre prístup** —
 * prístup rieši `accessLevel` + `companyCode` ako všade inde. Druhá cesta
 * k obsahu by raz zaostala za tou prvou.
 */
export type TypOsoby = "employee" | "external" | "referee" | "official"

/** `invited` = pozvaná, ešte sa neprihlásila. `inactive` = už sem nepatrí. */
export type StavOsoby = "invited" | "active" | "inactive"

export interface Osoba {
  _id?: ObjectId

  /** UUID, zhodné s `auth_users.id`. Väzba na technickú vrstvu prihlásenia. */
  id: string

  companyCode: string
  /** Vždy malými písmenami — schránka nie je citlivá na veľkosť. */
  email: string
  fullName: string
  department?: string
  personType: TypOsoby
  startDate?: Date
  status: StavOsoby

  /**
   * Jazyk **prostredia** — v čom sa s človekom rozprávame (rozhranie, e-maily,
   * znenie formulky). Nemá nič spoločné s jazykom smerníc, ktoré číta:
   * český rozhodca môže v českom rozhraní potvrdzovať slovenský predpis
   * a záznam si to zapamätá (`jazyky.ts`).
   */
  language: JazykUI

  /** Kľúče trás onboardingu, ktoré sa tejto osoby týkajú. */
  tracks: string[]
  /** Prázdne u bežnej osoby. Zatiaľ len `"hr"`. */
  roles: string[]

  invitedAt?: Date
  firstLoginAt?: Date
  lastLoginAt?: Date

  /** Pripravené na Fázu 5 (Sportnet OAuth, Entra ID). Dnes prázdne. */
  externalRef?: {
    sportnetId?: string | null
    entraObjectId?: string | null
  }

  createdBy?: string
  createdAt: Date
}

/** Údaje pre založenie alebo aktualizáciu osoby — napr. z CSV importu. */
export interface NovaOsoba {
  email: string
  fullName: string
  companyCode: string
  department?: string
  personType?: TypOsoby
  startDate?: Date
  tracks?: string[]
  roles?: string[]
  /** Voliteľné v CSV; neznáme alebo chýbajúce padá na slovenčinu. */
  language?: string
}

/** Adresa v tvare, v ktorom sa porovnáva a ukladá. */
export function normalizujEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Nájde osobu podľa adresy. `null`, keď taká v organizácii nie je. */
export async function najdiOsobu(email: string): Promise<Osoba | null> {
  const adresa = normalizujEmail(email)
  if (!adresa.includes("@")) return null
  const col = await getCollection<Osoba>(KOLEKCIA_OSOBY)
  return col.findOne({ email: adresa })
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
export async function osobaSmiePrihlasenie(email: string): Promise<boolean> {
  const adresa = normalizujEmail(email)
  if (!adresa.includes("@")) return false
  try {
    // Hľadáme existenciu, nie konkrétny záznam: tá istá adresa môže patriť
    // do viacerých jednotiek (`person_memberships` je pole, D32) a na
    // prihlásenie stačí, aby ju aspoň jedna z nich nemala vyradenú.
    const col = await getCollection<Osoba>(KOLEKCIA_OSOBY)
    const pocet = await col.countDocuments(
      { email: adresa, status: { $ne: "inactive" } },
      { limit: 1 }
    )
    return pocet > 0
  } catch (e) {
    // Nahlas, nie ticho — inak by sa výpadok tváril ako „nemáš prístup"
    // a nikto by nehľadal príčinu.
    console.error("[osoby] persons sa nedá prečítať, platí len POVOLENE_EMAILY:", e)
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
export async function oznacPrihlasenie(email: string): Promise<void> {
  const adresa = normalizujEmail(email)
  const teraz = new Date()
  try {
    const col = await getCollection<Osoba>(KOLEKCIA_OSOBY)

    // Bez `upsert` — prihlásenie nesmie založiť osobu. Kto sa dostal dnu
    // núdzovou brzdou, do `persons` nepatrí, kým ho tam niekto nepozve.
    await col.updateOne({ email: adresa }, { $set: { lastLoginAt: teraz } })

    // Prvé prihlásenie sa zapíše len raz — podmienka je v dotaze, nie v kóde,
    // takže dva súbežné requesty nezapíšu dva rôzne časy.
    await col.updateOne(
      { email: adresa, firstLoginAt: { $exists: false } },
      { $set: { firstLoginAt: teraz } }
    )

    // `invited` → `active` len z pozvaného stavu. Vyradenú osobu (`inactive`)
    // by prihlásenie nesmelo oživiť ani vtedy, keby sa cez bránu dostala inak.
    await col.updateOne(
      { email: adresa, status: "invited" },
      { $set: { status: "active" as StavOsoby } }
    )
  } catch (e) {
    console.error("[osoby] zápis prihlásenia zlyhal:", e)
  }
}

// ── Import osôb ──────────────────────────────────────────────────────────────

/** Výsledok overenia jedného riadku importu. */
export type OverenyRiadok =
  | { ok: true; email: string; companyCode: string }
  | { ok: false; email: string; dovod: string }

/**
 * Overí jeden riadok importu **bez databázy**.
 *
 * Vyčlenené zámerne: sú to jediné pravidlá v celom module, ktoré sa dajú
 * pomýliť, a zároveň jediné, ktoré sa dajú otestovať bez clustera. Zvyšok
 * `zalozOsoby()` je už len zápis.
 */
export function overRiadok(r: NovaOsoba): OverenyRiadok {
  const email = normalizujEmail(r?.email ?? "")
  if (!email.includes("@")) return { ok: false, email: r?.email ?? "", dovod: "neplatná adresa" }
  if (!r.companyCode?.trim()) return { ok: false, email, dovod: "chýba companyCode" }
  if (!r.fullName?.trim()) return { ok: false, email, dovod: "chýba meno" }
  return { ok: true, email, companyCode: r.companyCode.trim() }
}

/** Výsledok importu — čo pribudlo, čo sa zmenilo, čo sa preskočilo. */
export interface VysledokImportu {
  nove: number
  aktualizovane: number
  bezZmeny: number
  chyby: { email: string; dovod: string }[]
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
export async function zalozOsoby(
  zoznam: NovaOsoba[],
  kto: string
): Promise<VysledokImportu> {
  const v: VysledokImportu = { nove: 0, aktualizovane: 0, bezZmeny: 0, chyby: [] }
  if (zoznam.length === 0) return v

  const col = await getCollection<Osoba>(KOLEKCIA_OSOBY)
  const teraz = new Date()

  for (const r of zoznam) {
    const overeny = overRiadok(r)
    if (!overeny.ok) { v.chyby.push({ email: overeny.email, dovod: overeny.dovod }); continue }
    const { email, companyCode } = overeny

    const kluc = { companyCode, email }
    const zmeny: Record<string, unknown> = {
      fullName: r.fullName.trim(),
      department: r.department?.trim() || undefined,
      personType: r.personType ?? "employee",
      startDate: r.startDate,
      tracks: r.tracks ?? [],
      roles: r.roles ?? [],
    }

    // Jazyk sa prepíše LEN keď v riadku naozaj je. Bez tejto podmienky by
    // opakovaný import bez stĺpca jazyka ticho prepol každého späť na
    // slovenčinu — rovnaká pasca ako pri `status`, len horšie viditeľná,
    // lebo sa prejaví až v e-maile, ktorý už niekomu odišiel.
    if (r.language !== undefined) zmeny.language = normalizujJazyk(r.language)

    try {
      const vysledok = await col.updateOne(kluc, {
        $set: zmeny,
        $setOnInsert: {
          ...kluc,
          id: crypto.randomUUID(),
          status: "invited" as StavOsoby,
          ...(r.language === undefined ? { language: normalizujJazyk(undefined) } : {}),
          invitedAt: teraz,
          externalRef: { sportnetId: null, entraObjectId: null },
          createdBy: kto,
          createdAt: teraz,
        },
      }, { upsert: true })

      if (vysledok.upsertedCount) v.nove++
      else if (vysledok.modifiedCount) v.aktualizovane++
      else v.bezZmeny++
    } catch (e) {
      v.chyby.push({ email, dovod: String((e as Error).message ?? e) })
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
export async function nahladImportu(zoznam: NovaOsoba[]): Promise<{
  nove: string[]
  existujuce: string[]
  chyby: { email: string; dovod: string }[]
}> {
  const nove: string[] = []
  const existujuce: string[] = []
  const chyby: { email: string; dovod: string }[] = []

  const col = await getCollection<Osoba>(KOLEKCIA_OSOBY)
  const videne = new Set<string>()

  for (const r of zoznam) {
    const overeny = overRiadok(r)
    if (!overeny.ok) { chyby.push({ email: overeny.email, dovod: overeny.dovod }); continue }
    const { email, companyCode } = overeny

    const kluc = `${companyCode}|${email}`
    if (videne.has(kluc)) { chyby.push({ email, dovod: "duplicita v samotnom súbore" }); continue }
    videne.add(kluc)

    const uz = await col.findOne({ companyCode, email })
    ;(uz ? existujuce : nove).push(email)
  }

  return { nove, existujuce, chyby }
}

/**
 * Jazyk prostredia pre danú adresu.
 *
 * Používa sa aj v ceste odosielania e-mailu, teda pred prihlásením — preto
 * nikdy nehádže výnimku. Keď osobu nepoznáme (napr. správca, ktorý prešiel
 * núdzovou brzdou) alebo je databáza nedostupná, platí slovenčina. Zlý jazyk
 * e-mailu je nepríjemnosť; neodoslaný e-mail je zavreté dvere.
 */
export async function jazykOsoby(email: string): Promise<JazykUI> {
  try {
    const osoba = await najdiOsobu(email)
    return normalizujJazyk(osoba?.language)
  } catch {
    return normalizujJazyk(undefined)
  }
}
