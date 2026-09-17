/**
 * persons.ts — kto do organizácie patrí (kolekcia `persons`, Fáza 8).
 *
 * Doteraz rozhodovala o prístupe premenná `ALLOWED_EMAILS` a v `auth.ts` to
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
 * **Názvy polí sú anglické**, na rozdiel od `ratings.ts`. Nie je to
 * nedôslednosť: `persons` je kolekcia Modelu B rovnako ako `documents`
 * a `document_chunks`, a schéma je takto zapísaná v `docs/ONBOARDING_KONCEPCIA.md`
 * kap. 3.3. Keby sa kód a dokument rozišli v názvoch polí, jeden z nich by
 * o pol roka klamal.
 */

import { ObjectId } from "mongodb"
import { composeFullName, splitFullName } from "./personFields"
import { getCollection } from "./mongodb"
import { normalizeLanguage } from "./i18n"
import type { UiLanguage } from "./i18n"
import { requireCompanyCode } from "./tenantScope"

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
  emailHistory?: { email: string; until: Date; changedBy: string }[]
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
  departmentHistory?: { departmentId: string | null; departmentPath: string[]; from: Date; to?: Date }[]

  /**
   * Odkedy dokedy bola v ktorej skupine. Otvorený úsek (`do` chýba) trvá.
   *
   * Tá istá otázka ako pri oddelenieoch, len skupina ich má naraz viac, takže je
   * to zoznam úsekov, nie jeden reťazec. Dôvod je rovnaký a rovnako vážny:
   * skupina býva adresátom noriem (rozhodcovia, delegáti), takže kto z nej
   * vypadne pred potvrdením, by inak zo zoznamu nepotvrdených ticho zmizol.
   */
  groupHistory?: { group: string; from: Date; to?: Date }[]

  /**
   * Meno a priezvisko — **zadávané polia** (D83). `fullName` sa z nich skladá
   * (`composeFullName`), nie naopak.
   *
   * Prázdne zostávajú u osôb spred D83, ktorým sa `fullName` rozdeliť nedalo,
   * a u tých, ktoré sa založili samy z adresy (D47). Karta osoby to označí.
   */
  givenName?: string
  surname?: string

  /**
   * Tituly — **len na zobrazenie** (D84). V `fullName` zámerne nie sú.
   *
   * Titul počas života pribudne. Keby bol vo `fullName`, ten istý človek by
   * v starých potvrdeniach vystupoval pod iným menom než v nových — a rozdiel
   * by nebol zmenou osoby, ale zmenou kvalifikácie.
   */
  titleBefore?: string
  titleAfter?: string

  /** Pracovná pozícia z adresára. Evidenčný údaj, o prístupe nerozhoduje. */
  jobTitle?: string

  /**
   * Mobil v tvare E.164 — `+421905123456` (D86).
   *
   * Jeden tvar je podmienka toho, aby sa dve čísla dali porovnať a aby odkaz
   * `tel:` fungoval. Skladá ho `normalizePhone()` podľa predvoľby organizácie.
   */
  mobilePhone?: string

  /**
   * Pracovisko — **kľúč z číselníka** `workplace` organizácie (D85).
   *
   * Nie voľný text: „BA", „Bratislava" a „bratislava" by boli tri pracoviská
   * a filter by nesadol ani na jedno.
   */
  workplace?: string

  /**
   * Kedy sa naposledy podarilo doplniť údaje z adresára (D88).
   *
   * Známka musí byť samostatná. `missingFromDirectory()` sa pôvodne pýtala
   * „má prázdny `givenName`?" a fungovalo to len dovtedy, kým ho plnil výhradne
   * Graph. Od D83 ho vypĺňa aj personalista — a systém by potom usúdil, že
   * osoba je vybavená, a **nikdy by si nevypýtal pozíciu, mobil ani
   * pracovisko**.
   */
  directorySyncedAt?: Date
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
  /**
   * Celé meno. Pri importe sa **odvodzuje** z mena a priezviska (D83);
   * ostáva kvôli starým súborom, ktoré majú len stĺpec „Meno".
   */
  fullName: string
  givenName?: string
  surname?: string
  titleBefore?: string
  titleAfter?: string
  jobTitle?: string
  /** Už znormalizovaný do E.164, alebo prázdny, keď sa prečítať nedal. */
  mobilePhone?: string
  /** Už spárovaný kľúč z číselníka, alebo prázdny, keď sa spárovať nedal. */
  workplace?: string
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
export function normalizeKeys(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map(h => h?.trim().toLowerCase()).filter(Boolean))]
}


/**
 * Nájde osobu **v organizácii** podľa adresy. `null`, keď taká v nej nie je.
 *
 * Osoba je dvojica (organizácia, adresa) — tak je postavený aj unikátny index
 * `tenant_email_unique`. Do 2026-09-17 sa hľadala len podľa adresy: kto bol
 * v dvoch organizáciách s tou istou adresou, dostal náhodne jeden záznam
 * a na portáli druhej videl „nemáte prístup" (audit D90, B1).
 */
export async function findPerson(companyCode: string, email: string): Promise<Person | null> {
  const code = requireCompanyCode(companyCode, "findPerson")
  const address = normalizeEmail(email)
  if (!address.includes("@")) return null
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  return col.findOne({ companyCode: code, email: address })
}

/**
 * Smie sa táto adresa prihlásiť **podľa kolekcie `persons`**?
 *
 * Zámerne nevie o núdzovej brzde `ALLOWED_EMAILS` — tú skladá `auth.ts`.
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
export async function personMaySignIn(email: string, companyCode: string): Promise<boolean> {
  const address = normalizeEmail(email)
  if (!address.includes("@")) return false
  // Bez organizácie sa nerozhoduje — a nerozhodnuté znamená nepustiť.
  const code = typeof companyCode === "string" ? companyCode.trim() : ""
  if (!code) return false
  try {
    // **Organizácia domény, nie „ktorákoľvek"** (D90). Do 2026-09-17 stačilo,
    // aby adresa bola nevyradená v akejkoľvek organizácii — človek zo SFZ sa
    // tak prihlásil aj na portál LTK a až stránka mu povedala, že tam nepatrí.
    // Relácia platí pre doménu, takže o vstupe rozhoduje organizácia domény.
    const col = await getCollection<Person>(PERSONS_COLLECTION)
    const count = await col.countDocuments(
      { companyCode: code, email: address, status: { $ne: "inactive" } },
      { limit: 1 }
    )
    return count > 0
  } catch (e) {
    // Nahlas, nie ticho — inak by sa výpadok tváril ako „nemáš prístup"
    // a nikto by nehľadal príčinu.
    console.error("[persons] persons sa nedá prečítať, platí len ALLOWED_EMAILS:", e)
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
export async function recordSignIn(email: string, companyCode: string): Promise<void> {
  const address = normalizeEmail(email)
  const now = new Date()
  try {
    // Evidencia patrí osobe **v organizácii domény** (D90, B2). Len podľa
    // adresy by sa pri osobe v dvoch organizáciách zapísala do náhodnej.
    const code = requireCompanyCode(companyCode, "recordSignIn")
    const col = await getCollection<Person>(PERSONS_COLLECTION)

    // Bez `upsert` — prihlásenie nesmie založiť osobu. Kto sa dostal dnu
    // núdzovou brzdou, do `persons` nepatrí, kým ho tam niekto nepozve.
    //
    // Posun `lastLoginAt` → `previousLoginAt` a zápis nového času sú jedna
    // operácia (aktualizácia rúrou). Dva samostatné zápisy by pri súbežných
    // prihláseniach z dvoch zariadení skončili tak, že si oba prečítajú tú
    // istú starú hodnotu a jedno prihlásenie z histórie zmizne.
    await col.updateOne(
      { companyCode: code, email: address },
      [{ $set: { previousLoginAt: "$lastLoginAt", lastLoginAt: now } }],
    )

    // Prvé prihlásenie sa zapíše len raz — podmienka je v dotaze, nie v kóde,
    // takže dva súbežné requesty nezapíšu dva rôzne časy.
    await col.updateOne(
      { companyCode: code, email: address, firstLoginAt: { $exists: false } },
      { $set: { firstLoginAt: now } }
    )

    // `invited` → `active` len z pozvaného stavu. Vyradenú osobu (`inactive`)
    // by prihlásenie nesmelo oživiť ani vtedy, keby sa cez bránu dostala inak.
    await col.updateOne(
      { companyCode: code, email: address, status: "invited" },
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
  companyCode: string,
): Promise<void> {
  const address = normalizeEmail(email)
  const field = provider === "microsoft" ? "externalRef.entraObjectId" : "externalRef.googleSub"
  try {
    const code = requireCompanyCode(companyCode, "recordExternalRef")
    const col = await getCollection<Person>(PERSONS_COLLECTION)
    await col.updateOne({ companyCode: code, email: address }, { $set: { [field]: externalId } })
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
  groups: { value: string; count: number }[]
  tracks: { value: string; count: number }[]
}> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const people = await col
    .find({ companyCode, status: { $ne: "inactive" } }, { projection: { groups: 1, tracks: 1 } })
    .toArray()

  const countInto = (pick: (o: Person) => string[] | undefined) => {
    const counts = new Map<string, number>()
    for (const o of people) {
      for (const h of normalizeKeys(pick(o))) counts.set(h, (counts.get(h) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([value, peopleCount]) => ({ value, count: peopleCount }))
      .sort((a, b) => a.value.localeCompare(b.value, "sk"))
  }

  return { groups: countInto(o => o.groups), tracks: countInto(o => o.tracks) }
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
/**
 * Meno riadku importu — **jedno pravidlo pre obe podoby súboru** (D83).
 *
 * Nové súbory majú stĺpce Meno a Priezvisko a `fullName` sa z nich skladá.
 * Staré majú jeden stĺpec „Meno" a ten sa rozdelí. Keby si to každý volajúci
 * riešil sám, ten istý súbor by cez obrazovku a cez skript založil dve rôzne
 * mená — a nikto by nevedel, ktoré platí.
 */
export function resolveName(r: NewPerson): { fullName: string; givenName?: string; surname?: string } {
  const givenName = r.givenName?.trim()
  const surname = r.surname?.trim()
  if (givenName || surname) {
    return { fullName: composeFullName(givenName, surname), givenName, surname }
  }
  const fullName = r.fullName?.trim() ?? ""
  // Rozdelenie sa **nevynucuje**. Jednoslovné meno je platné meno; uhádnuté
  // priezvisko by sa od zadaného nedalo odlíšiť a to je horšie než prázdno.
  const split = splitFullName(fullName)
  return { fullName, givenName: split?.givenName, surname: split?.surname }
}

export function validateRow(r: NewPerson): ValidatedRow {
  const email = normalizeEmail(r?.email ?? "")
  if (!email.includes("@")) return { ok: false, email: r?.email ?? "", reason: "invalid-email" }
  if (!r.companyCode?.trim()) return { ok: false, email, reason: "missing-companyCode" }
  if (!resolveName(r).fullName) return { ok: false, email, reason: "missing-name" }
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
    const until = await col.findOne(key, { projection: { groupHistory: 1 } })
    const groups = normalizeKeys(r.groups)
    const name = resolveName(r)
    const changes: Record<string, unknown> = {
      fullName: name.fullName,
      department: r.department?.trim() || undefined,
      personType: r.personType ?? "employee",
      startDate: r.startDate,
      tracks: r.tracks ?? [],
      groups: groups,
      groupHistory: newGroupHistory(until?.groupHistory, groups, now),
      roles: r.roles ?? [],
    }

    // Jazyk sa prepíše LEN keď v riadku naozaj je. Bez tejto podmienky by
    // opakovaný import bez stĺpca jazyka ticho prepol každého späť na
    // slovenčinu — rovnaká pasca ako pri `status`, len horšie viditeľná,
    // lebo sa prejaví až v e-maile, ktorý už niekomu odišiel.
    if (r.language !== undefined) changes.language = normalizeLanguage(r.language)

    // Tá istá pasca pri každom novom poli (D83–D86): súbor spred tejto zmeny
    // stĺpce Priezvisko, Pozícia, Mobil ani Pracovisko nemá, a keby sa zapísali
    // vždy, opakovaný import by ich ticho vymazal celej organizácii. Zapisuje
    // sa preto **len to, čo v riadku naozaj je**.
    if (name.givenName) changes.givenName = name.givenName
    if (name.surname) changes.surname = name.surname
    if (r.titleBefore?.trim()) changes.titleBefore = r.titleBefore.trim()
    if (r.titleAfter?.trim()) changes.titleAfter = r.titleAfter.trim()
    if (r.jobTitle?.trim()) changes.jobTitle = r.jobTitle.trim()
    if (r.mobilePhone?.trim()) changes.mobilePhone = r.mobilePhone.trim()
    if (r.workplace?.trim()) changes.workplace = r.workplace.trim()

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
export async function personLanguage(email: string, companyCode: string | undefined): Promise<UiLanguage> {
  try {
    // Bez organizácie osobu nepoznáme — a neznámej osobe platí slovenčina.
    if (!companyCode) return normalizeLanguage(undefined)
    const person = await findPerson(companyCode, email)
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
  accountEmail: string,
  companyCode: string,
): Promise<Person | null> {
  const field = provider === "microsoft" ? "externalRef.entraObjectId" : "externalRef.googleSub"
  const next = normalizeEmail(accountEmail)

  try {
    const col = await getCollection<Person>(PERSONS_COLLECTION)
    const person = await col.findOne({ companyCode, [field]: externalId })
    if (!person) return null
    if (person.email === next) return person

    // Nová adresa už niekomu inému patrí — vtedy sa nič neprepisuje. Je to
    // stav, ktorý musí vidieť človek: buď je to omyl v adresári, alebo tu
    // máme dva záznamy pre jedného.
    if (await col.findOne({ companyCode, email: next })) {
      console.error(
        `[persons] ${person.email} má v adresári adresu ${next}, ktorú tu už má niekto iný — neprepisujem`
      )
      return person
    }

    await col.updateOne(
      { companyCode, id: person.id },
      {
        $set: { email: next },
        $push: {
          emailHistory: { email: person.email, doKedy: new Date(), zmenil: `auto:${provider}` },
        },
      } as never,
    )
    console.log(`[persons] ${person.email} → ${next} (podľa konta ${provider})`)
    return { ...person, email: next }
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
export function isDomainAllowed(email: string, domains: string[] | undefined): boolean {
  const d = addressDomain(email)
  if (!d) return false
  return (domains ?? []).some(x => x.trim().toLowerCase().replace(/^@/, "") === d)
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
  name: string | undefined,
  source: string,
): Promise<Person | null> {
  const address = normalizeEmail(email)
  const now = new Date()
  const person: Person = {
    id: crypto.randomUUID(),
    companyCode,
    email: address,
    // Meno z konta, keď ho poskytovateľ dal. Adresa je horšia než nič iné,
    // ale v zozname osôb je čitateľnejšia než prázdno.
    fullName: name?.trim() || address,
    personType: "employee",
    status: "active",
    language: normalizeLanguage(undefined),
    tracks: [],
    groups: [],
    roles: [],
    firstLoginAt: now,
    externalRef: { sportnetId: null, entraObjectId: null, googleSub: null },
    createdBy: source,
    createdAt: now,
  }

  try {
    const col = await getCollection<Person>(PERSONS_COLLECTION)
    // `$setOnInsert` s `upsert`, nie `insertOne`: dve karty otvorené naraz by
    // inak založili dve osoby a jedinečný index by druhú odmietol chybou,
    // ktorá by zhodila prihlásenie.
    const r = await col.updateOne(
      { companyCode, email: address },
      { $setOnInsert: person as never },
      { upsert: true },
    )
    if (!r.upsertedCount) return null
    console.log(`[persons] ${address} založený automaticky do ${companyCode} (${source})`)
    return person
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
export function inDepartmentSince(person: Pick<Person, "departmentHistory">): Date | null {
  const openRecord = (person.departmentHistory ?? []).filter(z => !z.to)
  if (openRecord.length === 0) return null
  // Pri poškodených dátach (viac otvorených) platí ten najnovší — je to
  // opatrnejšie než najstarší: úloha sa ukáže ako novšia, nie ako prepadnutá.
  return openRecord.reduce((a, b) => (a.from > b.from ? a : b)).from
}

/**
 * Nová história po presune do iného oddelenia.
 *
 * Čistá funkcia, aby sa dala otestovať: uzavrie otvorený záznam a otvorí
 * nový. **Presun do toho istého oddelenia nič nemení** — inak by opakované
 * uloženie formulára posúvalo dátum príchodu a s ním aj termíny.
 */
export function newDepartmentHistory(
  until: Person["departmentHistory"],
  newId: string | null,
  newPath: string[],
  when: Date,
): NonNullable<Person["departmentHistory"]> {
  const records = [...(until ?? [])]
  const openRecord = records.find(z => !z.to)
  if (openRecord && (openRecord.departmentId ?? null) === (newId ?? null)) {
    // To isté oddelenie, len sa mohla zmeniť cesta (presunuli vetvu vyššie).
    openRecord.departmentPath = newPath
    return records
  }
  if (openRecord) openRecord.to = when
  records.push({ departmentId: newId ?? null, departmentPath: newPath, from: when })
  return records
}


/**
 * Odkedy je osoba v danej skupine. `null`, keď v nej nie je alebo to nevieme.
 *
 * `null` znamená „odjakživa" rovnako ako pri oddelenieoch: ľuďom zapísaným pred
 * zavedením histórie by inak všetky staršie pridelenia zmizli.
 */
export function inGroupSince(
  person: Pick<Person, "groupHistory">,
  group: string,
): Date | null {
  const key = group.trim().toLowerCase()
  const openRecords = (person.groupHistory ?? []).filter(z => !z.to && z.group === key)
  if (openRecords.length === 0) return null
  return openRecords.reduce((a, b) => (a.from > b.from ? a : b)).from
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
  until: Person["groupHistory"],
  newGroups: string[],
  when: Date,
): NonNullable<Person["groupHistory"]> {
  const added = new Set(normalizeKeys(newGroups))
  const records = (until ?? []).map(z => ({ ...z }))

  for (const z of records) {
    if (!z.to && !added.has(z.group)) z.to = when
  }
  const openRecords = new Set(records.filter(z => !z.to).map(z => z.group))
  for (const g of added) {
    if (!openRecords.has(g)) records.push({ group: g, from: when })
  }
  return records
}


/**
 * Doplní údaje z adresára — **len tie, ktoré chýbajú** (D52).
 *
 * Adresár nie je nadriadený personalistovi. Keď niekto meno alebo oddelenie
 * v `/people` opraví, ďalšie prihlásenie mu opravu neprepíše — inak by sa ručná
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
  data: {
    fullName?: string
    givenName?: string
    surname?: string
    department?: string
    jobTitle?: string
    /** Už znormalizovaný do E.164 — adresár vracia čokoľvek. */
    mobilePhone?: string
    /** Už spárovaný kľúč z číselníka; nespárované sa nedopĺňa. */
    workplace?: string
    language?: string
    photoVersion?: string
  },
): Promise<string[]> {
  const address = normalizeEmail(email)
  try {
    const col = await getCollection<Person>(PERSONS_COLLECTION)
    const person = await col.findOne({ companyCode, email: address })
    if (!person) return []

    const set: Record<string, unknown> = {}
    const missing = (v: unknown) => v === undefined || v === null || String(v).trim() === ""

    if (data.fullName && (missing(person.fullName) || person.fullName.trim().toLowerCase() === address)) {
      set.fullName = data.fullName
    }
    if (data.givenName && missing(person.givenName)) set.givenName = data.givenName
    if (data.surname && missing(person.surname)) set.surname = data.surname
    if (data.department && missing(person.department)) set.department = data.department
    if (data.jobTitle && missing(person.jobTitle)) set.jobTitle = data.jobTitle
    if (data.mobilePhone && missing(person.mobilePhone)) set.mobilePhone = data.mobilePhone
    if (data.workplace && missing(person.workplace)) set.workplace = data.workplace
    // Jazyk má vždy hodnotu (predvolená slovenčina), takže „chýba" sa pri ňom
    // nedá zistiť. Prepíše sa len pri osobe založenej automaticky a len raz —
    // pri prvom prihlásení, keď ešte nemá fotku ani meno.
    if (data.language && missing(person.givenName) && missing(person.photoVersion)) {
      const language = normalizeLanguage(data.language.slice(0, 2))
      if (language !== person.language) set.language = language
    }
    if (data.photoVersion && missing(person.photoVersion)) set.photoVersion = data.photoVersion

    // Známka sa zapíše aj vtedy, keď adresár nič nového nepriniesol (D88).
    // Práve to je tá informácia, ktorú `missingFromDirectory()` potrebuje:
    // „už sme sa pýtali". Bez nej by sa pri osobe, ktorú adresár nepozná,
    // platili dve požiadavky do Graphu pri každom jednom prihlásení.
    const filled = Object.keys(set)
    set.directorySyncedAt = new Date()
    await col.updateOne({ companyCode, email: address }, { $set: set } as never)
    return filled
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
export function missingFromDirectory(person: Person | null): boolean {
  if (!person) return true
  const empty = (v: unknown) => v === undefined || v === null || String(v).trim() === ""
  // Rozhoduje **známka, že sme sa už pýtali** (D88), nie prázdny `givenName`.
  // Ten dnes vypĺňa aj personalista, takže ako otázka „bol tu už adresár?"
  // prestal platiť: prvá ručne doplnená osoba by sa z adresára nedozvedela
  // nič — ani pozíciu, ani mobil, ani pracovisko.
  if (empty(person.directorySyncedAt)) return true
  return (
    empty(person.fullName) ||
    person.fullName.trim().toLowerCase() === person.email
  )
}
