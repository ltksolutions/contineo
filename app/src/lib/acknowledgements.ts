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
import { loadDocument, effectiveVersion } from "./documents"
import type { Version } from "./documents"
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
  companyCode: string
  /** Jazyk prostredia z `persons.language`. Neznámy padá na slovenčinu. */
  language?: string
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
  const doc = await loadDocument(documentId)
  if (!doc) return { ok: false, reason: "document-not-found" }

  const effective = effectiveVersion(doc)
  if (!effective.ok) return { ok: false, reason: "no-effective-version", detail: effective.reason }

  const v = effective.version
  const effectiveFrom = v.effectiveFrom as Date
  const language = normalizeLanguage(actor.language)
  const statement = buildStatement(doc.title, v.label, effectiveFrom, language)
  const now = new Date()

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
