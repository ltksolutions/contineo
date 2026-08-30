/**
 * persons.ts — kto do organizácie patrí (kolekcia `persons`, Fáza 8).
 *
 * Doteraz rozhodovala o prístupe premenná `POVOLENE_EMAILY` a v `auth.ts` to
 * bolo aj zdôvodnené: pri piatich až desiatich hodnotiteľoch je zmena premennej
 * prehľadnejšia než admin rozhranie, ktoré by samo potrebovalo správu prístupov.
 *
 * Pri stovke ľudí to prestáva platiť z troch dôvodov naraz: zoznam sa nedá
 * udržiavať, každá zmena znamená nasadenie, a hlavne — k adrese treba priviazať
 * meno, oddelenie, typ osoby a trasu onboardingu. To do reťazca oddeleného čiarkami
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
  /**
   * Adresa. Vždy malými písmenami — schránka nie je citlivá na veľkosť.
   *
   * **Nie je to identita.** Tou je `id` vyššie. Adresa je prihlasovací údaj
   * a kontakt: ľudia sa vydávajú, organizácie menia domény, a človek, ktorý
   * si zmenil adresu, je stále ten istý človek s tou istou históriou
   * potvrdení. Meniť sa preto smie (`savePerson`).
   */
  email: string

  /** Predchádzajúce adresy — aby sa staré potvrdenie dalo spojiť s človekom. */
  emailHistory?: { email: string; doKedy: Date; zmenil: string }[]
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
   * Skupiny na prideľovanie — **tretia dimenzia** vedľa trás a oddelení (D38).
   *
   * Trasa je obsah („čím mám prejsť"), oddelenie je štruktúra („kam patrím“),
   * skupina je adresát („komu sa to posiela"). Zlúčiť skupiny s trasami by
   * znamenalo, že jednorazovú úlohu nemožno prideliť bez toho, aby vznikla
   * umelá trasa; zlúčiť ich s oddeleniami by znamenalo, že sa nedá osloviť
   * skupina naprieč oddeleniami — a práve tá býva adresátom noriem
   * (rozhodcovia, delegáti, štatutári).
   *
   * Vždy malými písmenami — porovnáva sa s publikom pridelenia.
   */
  groups: string[]

  /**
   * Oddelenie — **práve jeden** (D49). `null`/chýba = nezaradená osoba.
   *
   * Vedľa toho zostáva textové pole `department` vyššie: je to pôvodný zápis
   * z importu, ktorý sa nemaže, aby sa dalo spätne overiť, z čoho oddelenie vznikol.
   */
  departmentId?: string | null

  /**
   * Identifikátory oddelení od koreňa po vlastný, vrátane.
   *
   * Zámerná duplicita voči kolekcii `departments`: bez nej by
   * `matchesAudience()` musela dostať celý strom a prestala by byť čistou
   * funkciou nad jednou osobou — a práve tá čistota je dôvod, prečo sa
   * pravidlo publika dá otestovať a existuje len na jednom mieste.
   * Prepočítava sa v `prepocitajCesty()` po každej zmene štruktúry.
   */
  departmentPath?: string[]

  /**
   * Kedy do ktorého oddelenia patrila. Otvorený záznam (`do` chýba) je ten dnešný.
   *
   * Dve veci by sa bez tohto nedali povedať a obe sú pri reorganizácii bežné:
   * odkedy sa nového človeka týkajú normy jeho oddelenia (aby mu prvý deň
   * nevisela úloha spred roka ako po termíne), a či ten, kto odišiel bez
   * potvrdenia, tam vôbec kedy patril. Odvodiť sa to nedá — je to práve tá
   * informácia, ktorú presun prepíše.
   */
  departmentHistory?: { departmentId: string | null; departmentPath: string[]; od: Date; do?: Date }[]

  /**
   * Odkedy dokedy bola v ktorej skupine. Otvorený úsek (`do` chýba) trvá.
   *
   * Tá istá otázka ako pri oddelenieoch, len skupina ich má naraz viac, takže je
   * to zoznam úsekov, nie jeden reťazec. Dôvod je rovnaký a rovnako vážny:
   * skupina býva adresátom noriem (rozhodcovia, delegáti), takže kto z nej
   * vypadne pred potvrdením, by inak zo zoznamu nepotvrdených ticho zmizol.
   */
  groupHistory?: { group: string; od: Date; do?: Date }[]

  /** Meno a priezvisko zvlášť, keď ich adresár vie (D52). Zobrazuje sa `fullName`. */
  givenName?: string
  surname?: string
  /** Pracovná pozícia z adresára. Evidenčný údaj, o prístupe nerozhoduje. */
  jobTitle?: string
  /** Verzia uloženej fotky (`person_photos`). Chýba = nemá fotku. */
  photoVersion?: string

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

/**
 * Skupiny a trasy, ktoré v organizácii naozaj existujú.
 *
 * Zoznam sa **odvodzuje z ľudí**, nikde sa neudržiava. Číselník skupín by bol
 * druhá pravda: buď by v ňom chýbala skupina, ktorú niekto zapísal importom,
 * alebo by v ňom zostávali skupiny, ktoré už nikto nemá — a prideliť niečo
 * prázdnej skupine je tichý spôsob, ako neprideliť nikomu (D38).
 *
 * Volá to prideľovanie noriem aj správa osôb. Keby to mal každý svoje, dve
 * obrazovky by ponúkali dva rôzne zoznamy tých istých skupín.
 */
export async function audiencesInOrg(companyCode: string): Promise<{
  skupiny: { hodnota: string; osob: number }[]
  trasy: { hodnota: string; osob: number }[]
}> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const osoby = await col
    .find({ companyCode, status: { $ne: "inactive" } }, { projection: { groups: 1, tracks: 1 } })
    .toArray()

  const spocitaj = (vyber: (o: Person) => string[] | undefined) => {
    const pocty = new Map<string, number>()
    for (const o of osoby) {
      for (const h of normalizeKeys(vyber(o))) pocty.set(h, (pocty.get(h) ?? 0) + 1)
    }
    return [...pocty.entries()]
      .map(([hodnota, osob]) => ({ hodnota, osob }))
      .sort((a, b) => a.hodnota.localeCompare(b.hodnota, "sk"))
  }

  return { skupiny: spocitaj(o => o.groups), trasy: spocitaj(o => o.tracks) }
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
    // História členstva sa musí zapísať aj tadeto: import je najčastejší
    // spôsob, ako sa skupiny menia hromadne, a práve pri hromadnej zmene
    // je otázka „kto v skupine bol vtedy" najťažšia (D50).
    const doteraz = await col.findOne(key, { projection: { groupHistory: 1 } })
    const skupiny = normalizeKeys(r.groups)
    const changes: Record<string, unknown> = {
      fullName: r.fullName.trim(),
      department: r.department?.trim() || undefined,
      personType: r.personType ?? "employee",
      startDate: r.startDate,
      tracks: r.tracks ?? [],
      groups: skupiny,
      groupHistory: newGroupHistory(doteraz?.groupHistory, skupiny, now),
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

// ── prihlásenie kontom: rozpoznanie a založenie (D45, D47) ───────────────────

/**
 * Nájde osobu podľa **konta**, nie podľa adresy — a keď sa adresa medzitým
 * zmenila, zosúladí ju.
 *
 * Toto je celý zmysel `externalRef`: `oid` z Entra je nemenné, adresa nie.
 * Keď si niekto zmení priezvisko alebo organizácia prejde na novú doménu,
 * prihlási sa tým istým kontom a je to stále ten istý človek s tou istou
 * históriou potvrdení. Bez tohto by vznikla druhá osoba a história by sa
 * rozpadla na dve polovice, z ktorých ani jedna nie je celá.
 *
 * Prepis adresy je bezpečný, lebo sa deje **až po overení konta** (`tid`
 * z povoleného adresára, D45): to, že adresa patrí tomu človeku, potvrdil
 * adresár zákazníka, nie on sám.
 */
export async function syncFromAccount(
  provider: "microsoft" | "google",
  externalId: string,
  emailZKonta: string,
  companyCode: string,
): Promise<Person | null> {
  const pole = provider === "microsoft" ? "externalRef.entraObjectId" : "externalRef.googleSub"
  const novy = normalizeEmail(emailZKonta)

  try {
    const col = await getCollection<Person>(PERSONS_COLLECTION)
    const osoba = await col.findOne({ companyCode, [pole]: externalId })
    if (!osoba) return null
    if (osoba.email === novy) return osoba

    // Nová adresa už niekomu inému patrí — vtedy sa nič neprepisuje. Je to
    // stav, ktorý musí vidieť človek: buď je to omyl v adresári, alebo tu
    // máme dva záznamy pre jedného.
    if (await col.findOne({ companyCode, email: novy })) {
      console.error(
        `[persons] ${osoba.email} má v adresári adresu ${novy}, ktorú tu už má niekto iný — neprepisujem`
      )
      return osoba
    }

    await col.updateOne(
      { companyCode, id: osoba.id },
      {
        $set: { email: novy },
        $push: {
          emailHistory: { email: osoba.email, doKedy: new Date(), zmenil: `auto:${provider}` },
        },
      } as never,
    )
    console.log(`[persons] ${osoba.email} → ${novy} (podľa konta ${provider})`)
    return { ...osoba, email: novy }
  } catch (e) {
    console.error("[persons] zosúladenie podľa konta zlyhalo:", e)
    return null
  }
}

/** Doména adresy, malými písmenami. Prázdne, keď to nie je adresa. */
export function addressDomain(email: string): string {
  const i = email.lastIndexOf("@")
  return i === -1 ? "" : email.slice(i + 1).trim().toLowerCase()
}

/**
 * Patrí adresa medzi domény, z ktorých sa človek smie založiť sám? (D47)
 *
 * Porovnáva sa **celá doména**, nie koncovka: `futbalsfz.sk` nesmie pustiť
 * `zlyfutbalsfz.sk`. Poddomény sa nepovoľujú — kto ich chce, vypíše ich.
 */
export function isDomainAllowed(email: string, domeny: string[] | undefined): boolean {
  const d = addressDomain(email)
  if (!d) return false
  return (domeny ?? []).some(x => x.trim().toLowerCase().replace(/^@/, "") === d)
}

/**
 * Založí osobu, ktorá sa prihlásila overeným kontom z povolenej domény (D47).
 *
 * Zakladá sa **rovno ako aktívna** — práve sa prihlásila, takže „pozvaná,
 * ešte neprihlásená" by bola nepravda hneď v prvej sekunde. Bez rolí, bez
 * trás, bez skupín: to, že do organizácie patrí, hovorí adresár; čo má robiť,
 * rozhoduje človek.
 *
 * Vracia `null`, keď sa nič nezaložilo — vrátane prípadu, keď medzitým
 * záznam vznikol súbežnou požiadavkou (dve karty naraz).
 */
export async function createFromDomain(
  companyCode: string,
  email: string,
  meno: string | undefined,
  zdroj: string,
): Promise<Person | null> {
  const address = normalizeEmail(email)
  const now = new Date()
  const osoba: Person = {
    id: crypto.randomUUID(),
    companyCode,
    email: address,
    // Meno z konta, keď ho poskytovateľ dal. Adresa je horšia než nič iné,
    // ale v zozname osôb je čitateľnejšia než prázdno.
    fullName: meno?.trim() || address,
    personType: "employee",
    status: "active",
    language: normalizeLanguage(undefined),
    tracks: [],
    groups: [],
    roles: [],
    firstLoginAt: now,
    externalRef: { sportnetId: null, entraObjectId: null, googleSub: null },
    createdBy: zdroj,
    createdAt: now,
  }

  try {
    const col = await getCollection<Person>(PERSONS_COLLECTION)
    // `$setOnInsert` s `upsert`, nie `insertOne`: dve karty otvorené naraz by
    // inak založili dve osoby a jedinečný index by druhú odmietol chybou,
    // ktorá by zhodila prihlásenie.
    const r = await col.updateOne(
      { companyCode, email: address },
      { $setOnInsert: osoba as never },
      { upsert: true },
    )
    if (!r.upsertedCount) return null
    console.log(`[persons] ${address} založený automaticky do ${companyCode} (${zdroj})`)
    return osoba
  } catch (e) {
    console.error("[persons] automatické založenie zlyhalo:", e)
    return null
  }
}


/**
 * Odkedy je osoba vo svojom dnešnom oddelení. `null`, keď to nevieme.
 *
 * `null` znamená „odjakživa", nie „nikdy": pri ľuďoch zapísaných pred
 * zavedením štruktúry história neexistuje a pridelenie im má platiť odo dňa,
 * keď vzniklo. Opačná predvoľba by im všetky staré normy schovala.
 */
export function inDepartmentSince(osoba: Pick<Person, "departmentHistory">): Date | null {
  const otvoreny = (osoba.departmentHistory ?? []).filter(z => !z.do)
  if (otvoreny.length === 0) return null
  // Pri poškodených dátach (viac otvorených) platí ten najnovší — je to
  // opatrnejšie než najstarší: úloha sa ukáže ako novšia, nie ako prepadnutá.
  return otvoreny.reduce((a, b) => (a.od > b.od ? a : b)).od
}

/**
 * Nová história po presune do iného oddelenia.
 *
 * Čistá funkcia, aby sa dala otestovať: uzavrie otvorený záznam a otvorí
 * nový. **Presun do toho istého oddelenia nič nemení** — inak by opakované
 * uloženie formulára posúvalo dátum príchodu a s ním aj termíny.
 */
export function newDepartmentHistory(
  doteraz: Person["departmentHistory"],
  novyId: string | null,
  novaCesta: string[],
  kedy: Date,
): NonNullable<Person["departmentHistory"]> {
  const zaznamy = [...(doteraz ?? [])]
  const otvoreny = zaznamy.find(z => !z.do)
  if (otvoreny && (otvoreny.departmentId ?? null) === (novyId ?? null)) {
    // To isté oddelenie, len sa mohla zmeniť cesta (presunuli vetvu vyššie).
    otvoreny.departmentPath = novaCesta
    return zaznamy
  }
  if (otvoreny) otvoreny.do = kedy
  zaznamy.push({ departmentId: novyId ?? null, departmentPath: novaCesta, od: kedy })
  return zaznamy
}


/**
 * Odkedy je osoba v danej skupine. `null`, keď v nej nie je alebo to nevieme.
 *
 * `null` znamená „odjakživa" rovnako ako pri oddelenieoch: ľuďom zapísaným pred
 * zavedením histórie by inak všetky staršie pridelenia zmizli.
 */
export function inGroupSince(
  osoba: Pick<Person, "groupHistory">,
  skupina: string,
): Date | null {
  const kluc = skupina.trim().toLowerCase()
  const otvorene = (osoba.groupHistory ?? []).filter(z => !z.do && z.group === kluc)
  if (otvorene.length === 0) return null
  return otvorene.reduce((a, b) => (a.od > b.od ? a : b)).od
}

/**
 * Nová história skupín po zmene členstva.
 *
 * Čistá funkcia. Uzavrie úseky skupín, ktoré v novom zozname nie sú, a otvorí
 * úseky pre tie, ktoré pribudli. **Nezmenené členstvo sa nedotýka** — inak by
 * uloženie formulára bez zmeny posunulo dátum vstupu a s ním aj termíny.
 *
 * Návrat do skupiny je nový úsek, nie oživenie starého: „bol, odišiel,
 * vrátil sa" je iná informácia než „bol celý čas", a pri otázke, kto mal
 * v danom období povinnosť, sa tie dve odpovede líšia.
 */
export function newGroupHistory(
  doteraz: Person["groupHistory"],
  noveSkupiny: string[],
  kedy: Date,
): NonNullable<Person["groupHistory"]> {
  const nove = new Set(normalizeKeys(noveSkupiny))
  const zaznamy = (doteraz ?? []).map(z => ({ ...z }))

  for (const z of zaznamy) {
    if (!z.do && !nove.has(z.group)) z.do = kedy
  }
  const otvorene = new Set(zaznamy.filter(z => !z.do).map(z => z.group))
  for (const g of nove) {
    if (!otvorene.has(g)) zaznamy.push({ group: g, od: kedy })
  }
  return zaznamy
}


/**
 * Doplní údaje z adresára — **len tie, ktoré chýbajú** (D52).
 *
 * Adresár nie je nadriadený personalistovi. Keď niekto meno alebo oddelenie
 * v `/osoby` opraví, ďalšie prihlásenie mu opravu neprepíše — inak by sa ručná
 * oprava dala prežiť len dovtedy, kým sa ten človek znova neprihlási, a nikto
 * by nepochopil, prečo sa mu zmena „nepodarilo uložiť".
 *
 * Preto sa aj **`fullName` rovné adrese považuje za chýbajúce**: tak vyzerá
 * osoba založená automaticky, keď meno ešte nebolo odkiaľ vziať (D47).
 *
 * Vracia zoznam doplnených polí — volajúci ho dá do logu, aby bolo pri
 * podpore vidieť, čo sa vlastne stalo.
 */
export async function fillMissing(
  companyCode: string,
  email: string,
  udaje: {
    fullName?: string
    givenName?: string
    surname?: string
    department?: string
    jobTitle?: string
    language?: string
    photoVersion?: string
  },
): Promise<string[]> {
  const address = normalizeEmail(email)
  try {
    const col = await getCollection<Person>(PERSONS_COLLECTION)
    const osoba = await col.findOne({ companyCode, email: address })
    if (!osoba) return []

    const set: Record<string, unknown> = {}
    const chyba = (v: unknown) => v === undefined || v === null || String(v).trim() === ""

    if (udaje.fullName && (chyba(osoba.fullName) || osoba.fullName.trim().toLowerCase() === address)) {
      set.fullName = udaje.fullName
    }
    if (udaje.givenName && chyba(osoba.givenName)) set.givenName = udaje.givenName
    if (udaje.surname && chyba(osoba.surname)) set.surname = udaje.surname
    if (udaje.department && chyba(osoba.department)) set.department = udaje.department
    if (udaje.jobTitle && chyba(osoba.jobTitle)) set.jobTitle = udaje.jobTitle
    // Jazyk má vždy hodnotu (predvolená slovenčina), takže „chýba" sa pri ňom
    // nedá zistiť. Prepíše sa len pri osobe založenej automaticky a len raz —
    // pri prvom prihlásení, keď ešte nemá fotku ani meno.
    if (udaje.language && chyba(osoba.givenName) && chyba(osoba.photoVersion)) {
      const jazyk = normalizeLanguage(udaje.language.slice(0, 2))
      if (jazyk !== osoba.language) set.language = jazyk
    }
    if (udaje.photoVersion && chyba(osoba.photoVersion)) set.photoVersion = udaje.photoVersion

    if (Object.keys(set).length === 0) return []
    await col.updateOne({ companyCode, email: address }, { $set: set } as never)
    return Object.keys(set)
  } catch (e) {
    console.error("[persons] doplnenie údajov z adresára zlyhalo:", e)
    return []
  }
}

/**
 * Chýba osobe niečo, čo vie adresár doplniť?
 *
 * Bez tejto otázky by každé prihlásenie platilo dve požiadavky do Graphu za
 * nič. Väčšina prihlásení je opakovaná a vtedy je už všetko na mieste.
 */
export function missingFromDirectory(osoba: Person | null): boolean {
  if (!osoba) return true
  const prazdne = (v: unknown) => v === undefined || v === null || String(v).trim() === ""
  return (
    prazdne(osoba.givenName) ||
    prazdne(osoba.department) ||
    prazdne(osoba.photoVersion) ||
    prazdne(osoba.fullName) ||
    osoba.fullName.trim().toLowerCase() === osoba.email
  )
}
