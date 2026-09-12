/**
 * acknowledgements.ts — auditný záznam „oboznámil som sa" (kolekcia `acknowledgements`, D24).
 *
 * Jadro Fázy 8. Tri veci, ktoré sa tu nesmú pokaziť:
 *
 * 1. **Záznam je nemenný.** Kolekcia je append-only: potvrdenie sa nikdy
 *    neprepisuje ani nemaže. Odvolanie či oprava je **nový** záznam, ktorý
 *    ukazuje na starý cez `supersedes`. Auditný záznam, ktorý sa dá upraviť,
 *    nie je auditný záznam.
 *
 * 2. **Nesie odtlačky, nie odkazy.** `email`, `fullName`, `documentTitle`,
 *    `versionLabel` sa ukladajú aj vtedy, keď sú inde v databáze. Záznam musí
 *    byť čitateľný o tri roky, keď sa človek volá inak, dokument sa premenoval
 *    a trasa už neexistuje. Záznam, ktorý na vysvetlenie potrebuje `$lookup`
 *    do štyroch kolekcií, ktoré sa medzitým zmenili, nie je dôkaz — je to
 *    hypotéza.
 *
 * 3. **Verziu určuje server.** Nikdy nie to, čo poslal prehliadač. Inak by sa
 *    dal poslať `versionId` starého znenia a potvrdiť niečo iné, než bolo na
 *    obrazovke.
 *
 * Znenie formulky je rozhodnutie D28 — oboznámenie a záväzok, nie súhlas.
 * Pri vnútornom predpise je súhlas právne zvláštny: smernica zaväzuje bez
 * ohľadu na to, či s ňou niekto súhlasí.
 *
 * **Jazyk.** Prostredie je viacjazyčné, obsah nie (`i18n.ts`). Znenie formulky
 * sa preto skladá v jazyku **človeka**, kým dokument si nesie svoj vlastný.
 * Záznam ukladá oboje — `language` (v čom potvrdzoval) aj `documentLanguage`
 * (v čom je smernica). Bez toho sa pri audite nedá odpovedať na otázku, či
 * český rozhodca potvrdzoval slovenský text; a to je otázka, ktorá príde.
 */

import { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"
import { loadDocumentFor, effectiveVersion } from "./documents"
import type { Version } from "./documents"
import { allDepartments, pathTo } from "./departments"
import { formatDate, dictionary, normalizeLanguage } from "./i18n"
import type { UiLanguage } from "./i18n"

export const ACKNOWLEDGEMENTS_COLLECTION = "acknowledgements"

/** Odvolanie a oprava sú nové záznamy, nie úprava starého. */
export type RecordType = "acknowledgement" | "revocation" | "correction"

export interface Acknowledgement {
  _id?: ObjectId
  type: RecordType
  companyCode: string

  // KTO — s odtlačkom údajov v čase potvrdenia
  personId: string
  email: string
  fullName: string

  // ČO — s odtlačkom údajov v čase potvrdenia
  documentId: string
  versionId: string
  documentTitle: string
  versionLabel: string
  effectiveFrom: Date
  /** Jazyk, v ktorom je napísaná samotná smernica. */
  documentLanguage: string | null

  // ČÍM — doslovné znenie, nie odkaz naň
  statementText: string
  statementHash: string
  /** Jazyk prostredia, v ktorom človek formulku videl a potvrdil. */
  language: UiLanguage

  // KEDY a ODKIAĽ
  acknowledgedAt: Date
  ip: string | null
  userAgent: string | null

  /**
   * Oddelenie v čase potvrdenia — odtlačok, rovnako ako meno a adresa (D50).
   *
   * Bez neho by výkaz „potvrdenia po oddelenieoch" za minulý rok po reorganizácii
   * povedal niečo iné než vtedy: počítal by sa podľa dnešnej štruktúry, a tá
   * už môže vyzerať úplne inak. Názvy, nie len identifikátory — oddelenie sa dá
   * premenovať aj zrušiť a záznam má byť čitateľný sám o sebe.
   */
  departmentId: string | null
  /** Názvy oddelení od koreňa po vlastný, v čase potvrdenia. */
  departmentNames: string[]

  // KONTEXT
  trackId: string | null
  /** `import` je pripravené pre prípadné historické záznamy z iného systému. */
  origin: "portal" | "import"
  supersedes: ObjectId | null

  /**
   * Poradie pokusu (D24). Prvé potvrdenie 1, po odvolaní 2. Je súčasťou
   * unikátneho indexu — bez neho by sa po odvolaní nedalo potvrdiť znova.
   * Odvolanie nesie číslo toho pokusu, ktorý ruší.
   */
  cycle: number

  /**
   * Dôvod — **povinný pri odvolaní**, rovnako ako pri zamietnutí znenia (D71).
   * Odvolanie mení stav povinnosti a o rok sa musí dať prečítať, prečo.
   */
  reason?: string

  /**
   * Kto úkon vykonal, keď to nie je sama osoba.
   *
   * Pri potvrdení je to vždy osoba, preto `null`. Pri odvolaní je to
   * personalista — a keby v zázname nebol, ostalo by „potvrdenie bolo
   * odvolané" bez toho, kto tak rozhodol. Meno sa **kopíruje**, nie odkazuje
   * (D24): záznam musí byť čitateľný aj o tri roky.
   */
  actedBy?: { personId: string; email: string; fullName: string } | null

  createdAt: Date
}

/* ─────────────────────────────────────────────────────────────────────────
 * Odvolanie potvrdenia (D24)
 *
 * Kolekcia je append-only: potvrdenie sa neprepisuje ani nemaže. Odvolanie je
 * **nový záznam** typu `revocation`, ktorý cez `supersedes` ukazuje na pôvodný.
 * Vďaka tomu z histórie nezmizne, že potvrdenie raz existovalo — a práve to je
 * na nej to cenné.
 *
 * Pravidlá sú tu **bez databázy**, rovnako ako v `approvals.ts`: čo sa smie, sa
 * musí dať otestovať bez Monga a bez toho, aby si to niekto domýšľal z dotazu.
 * ───────────────────────────────────────────────────────────────────────── */

export type RevokeProblem =
  | "revocation.notHr"
  | "revocation.nothingToRevoke"
  | "revocation.reasonRequired"

/**
 * Prečo sa toto potvrdenie nedá odvolať — alebo `null`, keď sa dá.
 *
 * **Odvoláva len personalista** (rozhodnuté 2026-09-12). Keby to vedela osoba
 * sama, potvrdenie by stratilo váhu: doklad, ktorý si podpísaný môže kedykoľvek
 * zobrať späť, nie je doklad. Osoba požiada, personalista odvolá — a v zázname
 * je vidieť, kto rozhodol.
 *
 * **Dôvod je povinný**, rovnako ako pri zamietnutí znenia (D71). Odvolanie mení
 * stav povinnosti a o rok sa musí dať prečítať, prečo.
 */
export function revokeProblem(input: {
  isHr: boolean
  /** Koľko platných potvrdení na dvojicu osoba × znenie zostáva. */
  valid: number
  reason?: string
}): RevokeProblem | null {
  // Rola sa pýta prvá: kto nesmie konať, nemá sa dozvedieť ani to, či je čo
  // odvolať. Poradie kontrol je tu súčasť pravidla, nie štýl.
  if (!input.isHr) return "revocation.notHr"
  if (input.valid <= 0) return "revocation.nothingToRevoke"
  if (!input.reason?.trim()) return "revocation.reasonRequired"
  return null
}

/**
 * Platí potvrdenie? Potvrdenia mínus odvolania.
 *
 * Toto pravidlo musí byť na **jednom mieste**: potvrdenia sa dnes čítajú zo
 * siedmich miest a každé z nich by inak muselo samo vedieť, že odvolanie
 * existuje. Stačí, aby na to jedno zabudlo, a výkaz personalistu povie niečo
 * iné než detail dokumentu.
 */
export function isAcknowledged(counts: { acknowledgements: number; revocations: number }): boolean {
  return counts.acknowledgements > counts.revocations
}

/**
 * Poradie pokusu pre nové potvrdenie.
 *
 * Prvé potvrdenie je 1, po odvolaní 2. Číslo je súčasťou unikátneho indexu,
 * takže dve súbežné kliknutia vypočítajú to isté číslo a druhé databáza
 * odmietne — ochrana proti dvojitému potvrdeniu (D24) tým zostáva.
 */
export function nextCycle(acknowledgements: number): number {
  return acknowledgements + 1
}

/**
 * Znenie potvrdzovacej formulky (D28) v jazyku prostredia.
 *
 * Ukladá sa doslovne, takže neskoršia úprava formulácie **nemení staré
 * záznamy** — a rovnako platí, že zmena jazyka rozhrania nemení, čo človek
 * kedysi potvrdil. Preto je text v zázname, nie odkaz naň.
 */
export function buildStatement(
  title: string,
  label: string,
  effectiveFrom: Date,
  language: UiLanguage = "sk"
): string {
  return dictionary(language).statement(title, label, formatDate(effectiveFrom, language))
}

/** SHA-256 znenia — na rýchle porovnanie, nie ako náhrada textu. */
export async function hashStatement(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("")
}

/** Kto potvrdzuje — údaje sa do záznamu skopírujú, nie prepoja. */
export interface Acknowledger {
  personId: string
  email: string
  fullName: string
  /** Rozhoduje aj o tom, na ktoré dokumenty osoba vidí (D32). */
  companyCode: string
  /** Jazyk prostredia z `persons.language`. Neznámy padá na slovenčinu. */
  language?: string
  /** Oddelenie v čase potvrdenia. Zapíše sa ako odtlačok (D50). */
  departmentId?: string | null
}

export type AcknowledgeResult =
  | { ok: true; id: string; statement: string; version: Version }
  | { ok: false; reason: "document-not-found" | "no-effective-version" | "already-acknowledged" | "write-failed"; detail?: string }

/**
 * Zapíše potvrdenie. **Verziu si server načíta sám** — z požiadavky sa berie
 * len to, ktorý dokument sa potvrdzuje.
 *
 * Poradie krokov je bezpečnostné, nie kozmetické:
 *   1. načítaj dokument a urči platnú verziu na serveri,
 *   2. zlož znenie z názvu, `label` a `effectiveFrom`,
 *   3. zapíš záznam,
 *   4. až potom povedz klientovi „hotovo".
 */
export async function acknowledge(
  actor: Acknowledger,
  documentId: string,
  context: { ip?: string | null; userAgent?: string | null; trackId?: string | null } = {}
): Promise<AcknowledgeResult> {
  // Načítanie **pre osobu**, nie len podľa identifikátora: bez toho by sa dal
  // potvrdiť dokument cudzej organizácie tým, že sa uhádne jeho `documentId`
  // (D32). Neviditeľný dokument sa tvári ako neexistujúci — rozlíšenie by
  // prezradilo, aké smernice iný tenant má.
  const doc = await loadDocumentFor(actor, documentId)
  if (!doc) return { ok: false, reason: "document-not-found" }

  const effective = effectiveVersion(doc)
  if (!effective.ok) return { ok: false, reason: "no-effective-version", detail: effective.reason }

  const v = effective.version
  const effectiveFrom = v.effectiveFrom as Date
  const language = normalizeLanguage(actor.language)
  const statement = buildStatement(doc.title, v.label, effectiveFrom, language)
  const now = new Date()

  // Názvy oddelení sa čítajú **teraz**, aby sa uložili tak, ako vtedy zneli.
  // Zlyhanie tohto čítania nesmie zhodiť potvrdenie: záznam bez oddelenia je
  // horší než záznam s ním, ale oveľa lepší než žiadny.
  let departmentNames: string[] = []
  try {
    if (actor.departmentId) {
      const tree = await allDepartments(actor.companyCode)
      departmentNames = pathTo(tree, actor.departmentId).map(o => o.name)
    }
  } catch (e) {
    console.error("[acknowledgements] oddelenie sa nepodarilo prečítať:", e)
  }

  /*
   * Poradie pokusu sa **číta pred zápisom**, nie odvodzuje z ničoho. Pri prvom
   * potvrdení vyjde 1. Dve súbežné kliknutia vypočítajú to isté číslo a druhé
   * odmietne unikátny index — presne tak, ako to bolo doteraz.
   */
  const col = await getCollection<Acknowledgement>(ACKNOWLEDGEMENTS_COLLECTION)
  const previous = await col.countDocuments({
    companyCode: actor.companyCode,
    personId: actor.personId,
    versionId: v.versionId,
    type: "acknowledgement",
  })

  const record: Acknowledgement = {
    type: "acknowledgement",
    cycle: nextCycle(previous),
    companyCode: actor.companyCode,
    personId: actor.personId,
    email: actor.email,
    fullName: actor.fullName,
    documentId: doc.documentId,
    versionId: v.versionId,
    documentTitle: doc.title,
    versionLabel: v.label,
    effectiveFrom: effectiveFrom,
    documentLanguage: doc.language ?? null,
    statementText: statement,
    statementHash: await hashStatement(statement),
    language: language,
    acknowledgedAt: now,
    ip: context.ip ?? null,
    userAgent: context.userAgent ?? null,
    departmentId: actor.departmentId ?? null,
    departmentNames,
    trackId: context.trackId ?? null,
    origin: "portal",
    supersedes: null,
    createdAt: now,
  }

  try {
    const r = await col.insertOne(record)
    return { ok: true, id: String(r.insertedId), statement, version: v }
  } catch (e) {
    // Unikátny index odmietne druhé potvrdenie tej istej verzie. Nie je to
    // chyba používateľa — už to má za sebou a treba mu to povedať, nie
    // zobraziť chybu servera.
    if ((e as { code?: number }).code === 11000) return { ok: false, reason: "already-acknowledged" }
    console.error("[acknowledgements] zápis zlyhal:", e)
    return { ok: false, reason: "write-failed", detail: String((e as Error).message ?? e) }
  }
}

/** Jedno platné potvrdenie: dvojica osoba × znenie, ktorá platí teraz. */
export interface ValidAcknowledgement {
  personId: string
  versionId: string
  /** Čas posledného platného potvrdenia. */
  acknowledgedAt: Date
  cycle: number
}

/**
 * Ktoré potvrdenia **platia** — potvrdenia mínus odvolania, jedným dotazom.
 *
 * Toto je jediné miesto, kde sa platnosť rozhoduje. Predtým sa potvrdenia
 * čítali zo siedmich miest a každé si filtrovalo `type: "acknowledgement"` samo;
 * po zavedení odvolania by každé z nich muselo vedieť, že odvolanie existuje, a
 * stačilo by, aby na to jedno zabudlo — výkaz personalistu by povedal niečo iné
 * než detail dokumentu. Preto sa počíta v databáze a na jednom mieste.
 *
 * Prázdne pole v `$in` sa nepýta vôbec: dotaz, o ktorom vopred vieme, že vráti
 * nič, je zbytočná cesta do Atlasu.
 */
export async function validAcknowledgements(filter: {
  companyCode?: string
  personId?: string | string[]
  versionId?: string | string[]
}): Promise<ValidAcknowledgement[]> {
  if (Array.isArray(filter.personId) && filter.personId.length === 0) return []
  if (Array.isArray(filter.versionId) && filter.versionId.length === 0) return []

  const where: Record<string, unknown> = { type: { $in: ["acknowledgement", "revocation"] } }
  if (filter.companyCode) where.companyCode = filter.companyCode
  if (filter.personId) {
    where.personId = Array.isArray(filter.personId) ? { $in: filter.personId } : filter.personId
  }
  if (filter.versionId) {
    where.versionId = Array.isArray(filter.versionId) ? { $in: filter.versionId } : filter.versionId
  }

  const col = await getCollection<Acknowledgement>(ACKNOWLEDGEMENTS_COLLECTION)
  const rows = await col
    .find(where, { projection: { personId: 1, versionId: 1, type: 1, cycle: 1, acknowledgedAt: 1 } })
    .toArray()

  /*
   * Sčítava sa **v pamäti, nie agregáciou v databáze** — zámerne. Pravidlo je
   * jedno (`isAcknowledged()`) a má byť napísané raz, v TypeScripte, kde sa dá
   * otestovať bez Monga; to isté vyjadrené ešte raz cez `$expr` by bolo druhé
   * miesto, kde sa dá pomýliť, a rozišlo by sa s tým prvým presne vtedy, keď na
   * tom záleží. Dotaz je zúžený na konkrétne osoby alebo znenia a vracia päť
   * polí — pri rozsahoch, aké má zväz, je rozdiel v cene nemerateľný.
   */
  const pairs = new Map<string, {
    personId: string
    versionId: string
    acknowledgements: number
    revocations: number
    acknowledgedAt: Date | null
    cycle: number
  }>()

  for (const r of rows) {
    const key = `${r.personId}\u0000${r.versionId}`
    const pair = pairs.get(key) ?? {
      personId: r.personId,
      versionId: r.versionId,
      acknowledgements: 0,
      revocations: 0,
      acknowledgedAt: null,
      cycle: 0,
    }

    if (r.type === "acknowledgement") {
      pair.acknowledgements += 1
      // Odvolanie do času ani do poradia nevstupuje — platí posledné potvrdenie.
      const when = r.acknowledgedAt ? new Date(r.acknowledgedAt) : null
      if (when && (!pair.acknowledgedAt || when > pair.acknowledgedAt)) pair.acknowledgedAt = when
      if ((r.cycle ?? 0) > pair.cycle) pair.cycle = r.cycle ?? 0
    } else if (r.type === "revocation") {
      pair.revocations += 1
    }

    pairs.set(key, pair)
  }

  return [...pairs.values()]
    .filter(isAcknowledged)
    .map(p => ({
      personId: p.personId,
      versionId: p.versionId,
      acknowledgedAt: p.acknowledgedAt as Date,
      cycle: p.cycle,
    }))
}

/** Má táto osoba **platne** potvrdenú túto verziu? */
export async function hasAcknowledged(personId: string, versionId: string): Promise<boolean> {
  return (await validAcknowledgements({ personId, versionId })).length > 0
}

/**
 * **Celá** história jednej osoby, najnovšie prvé — vrátane odvolaní.
 *
 * Zámerne nefiltruje: je to výpis pre človeka, ktorý má vidieť aj to, že mu
 * niekto potvrdenie odvolal. Kto potrebuje vedieť, čo **platí**, sa pýta
 * `validAcknowledgements()`.
 *
 * Potvrdenia jednej osoby, najnovšie prvé.
 *
 * Osoba musí vedieť zobraziť a stiahnuť, čo o nej systém eviduje, aj bez
 * žiadosti na HR (`docs/ONBOARDING_KONCEPCIA.md` kap. 6).
 */
export async function personAcknowledgements(personId: string): Promise<Acknowledgement[]> {
  const col = await getCollection<Acknowledgement>(ACKNOWLEDGEMENTS_COLLECTION)
  return col.find({ personId }).sort({ acknowledgedAt: -1 }).toArray()
}

/**
 * Ktoré z týchto verzií má osoba potvrdené?
 *
 * Jedným dotazom, nie po jednej — trasa má aj desať krokov a stav sa odvodzuje
 * pri každom otvorení zoznamu (D27: progres sa neukladá).
 */
export async function acknowledgedVersionIds(
  personId: string,
  versionIds: string[]
): Promise<Set<string>> {
  if (versionIds.length === 0) return new Set()
  const valid = await validAcknowledgements({ personId, versionId: versionIds })
  return new Set(valid.map(a => a.versionId))
}

/** Kto odvoláva — personalista, nie osoba sama. */
export interface Revoker {
  personId: string
  email: string
  fullName: string
  companyCode: string
}

export type RevokeResult =
  | { ok: true; id: string }
  | { ok: false; reason: RevokeProblem | "write-failed"; detail?: string }

/**
 * Odvolá potvrdenie: zapíše **nový záznam**, starý nechá na pokoji (D24).
 *
 * Povinnosť tým **ožije s pôvodným termínom** (rozhodnuté 2026-09-12) — nič sa
 * neprepisuje ani nepresúva, stačí, že potvrdenie prestane platiť: `assignments`
 * o potvrdeniach nič nedrží a stav sa odvodzuje pri každom čítaní (D27). Ak
 * termín medzitým prešiel, osoba je hneď po termíne. Je to pravda, nie chyba.
 *
 * Čas čítania a prvé otvorenie sa **nemenia**. Sú to merania, nie doklad
 * o splnení povinnosti — človek ten text naozaj otvoril a naozaj nad ním
 * strávil ten čas.
 */
export async function revoke(input: {
  by: Revoker
  isHr: boolean
  /** Čie potvrdenie sa odvoláva. */
  personId: string
  versionId: string
  reason: string
}): Promise<RevokeResult> {
  const col = await getCollection<Acknowledgement>(ACKNOWLEDGEMENTS_COLLECTION)
  const where = { companyCode: input.by.companyCode, personId: input.personId, versionId: input.versionId }

  const [acknowledgements, revocations] = await Promise.all([
    col.countDocuments({ ...where, type: "acknowledgement" }),
    col.countDocuments({ ...where, type: "revocation" }),
  ])

  const problem = revokeProblem({
    isHr: input.isHr,
    valid: isAcknowledged({ acknowledgements, revocations }) ? 1 : 0,
    reason: input.reason,
  })
  if (problem) return { ok: false, reason: problem }

  // Ruší sa **posledný** pokus. Staršie cykly už svoje odvolanie majú —
  // odvolávať ich druhýkrát by vyrobilo záznam, ktorý nič neruší.
  const [target] = await col
    .find({ ...where, type: "acknowledgement" })
    .sort({ cycle: -1 })
    .limit(1)
    .toArray()
  if (!target) return { ok: false, reason: "revocation.nothingToRevoke" }

  const now = new Date()
  const record: Acknowledgement = {
    // Odvolanie si nesie **to isté, čo rušené potvrdenie**: meno, dokument,
    // znenie aj doslovnú formulku. Záznam, ktorý na vysvetlenie potrebuje
    // dohľadať iný záznam, nie je dôkaz — je to hypotéza (D24).
    ...target,
    _id: undefined,
    type: "revocation",
    supersedes: target._id ?? null,
    reason: input.reason.trim(),
    actedBy: { personId: input.by.personId, email: input.by.email, fullName: input.by.fullName },
    // `acknowledgedAt` je pri odvolaní čas odvolania. Jeden tvar záznamu je
    // menšie zlo než druhá kolekcia s vlastnou časovou osou.
    acknowledgedAt: now,
    createdAt: now,
  }

  try {
    const r = await col.insertOne(record)
    return { ok: true, id: String(r.insertedId) }
  } catch (e) {
    console.error("[acknowledgements] odvolanie sa nezapísalo:", e)
    return { ok: false, reason: "write-failed", detail: String((e as Error).message ?? e) }
  }
}
