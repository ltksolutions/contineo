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

  createdAt: Date
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
      const strom = await allDepartments(actor.companyCode)
      departmentNames = pathTo(strom, actor.departmentId).map(o => o.nazov)
    }
  } catch (e) {
    console.error("[acknowledgements] oddelenie sa nepodarilo prečítať:", e)
  }

  const record: Acknowledgement = {
    type: "acknowledgement",
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
    const col = await getCollection<Acknowledgement>(ACKNOWLEDGEMENTS_COLLECTION)
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

/** Má táto osoba potvrdenú túto verziu? */
export async function hasAcknowledged(personId: string, versionId: string): Promise<boolean> {
  const col = await getCollection<Acknowledgement>(ACKNOWLEDGEMENTS_COLLECTION)
  const count = await col.countDocuments(
    { personId, versionId, type: "acknowledgement" },
    { limit: 1 }
  )
  return count > 0
}

/**
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
  const col = await getCollection<Acknowledgement>(ACKNOWLEDGEMENTS_COLLECTION)
  const found = await col
    .find(
      { personId, type: "acknowledgement", versionId: { $in: versionIds } },
      { projection: { versionId: 1 } }
    )
    .toArray()
  return new Set(found.map(a => a.versionId))
}
