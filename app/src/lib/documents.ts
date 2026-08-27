/**
 * documents.ts — verzie dokumentu a to, ktorá z nich platí (D25, D6).
 *
 * `documents` dnes verziu **prepisuje**: import nastaví `versionId` navrch
 * a predchádzajúce znenie sa z dokumentu stratí (chunky sa archivujú, dokument
 * nie). Kým išlo o vyhľadávanie, stačilo to — hľadá sa v platnom znení.
 *
 * Pri potvrdzovaní noriem to nestačí. Otázka pri audite neznie „potvrdil to?",
 * ale „potvrdil **to znenie**, ktoré platilo v čase, keď podľa neho mal
 * konať?". Bez histórie verzií je záznam o potvrdení právne bezcenný.
 *
 * Preto `versions[]` — v cieľovom tvare, aký potrebuje CMS
 * (`docs/CMS_KONCEPCIA.md` A.3), nie v zjednodušenom. Verzovanie pritom nie je
 * potreba onboardingu: je to povinnosť celého systému, lebo `documents` je
 * spoločné úložisko pre obsah zo všetkých vstupných kanálov (D25).
 */

import { getCollection } from "./mongodb"

export const DOCUMENTS_COLLECTION = "documents"

export interface Version {
  /** Nemenné. Zhodné s `document_chunks.versionId` — chunk patrí verzii. */
  versionId: string
  /** Ľudské označenie: „1.2", „novela 2026". */
  label: string

  /**
   * Právna platnosť (D6) — oddelená od „technicky najnovšia verzia".
   * `null` znamená **platnosť neurčená**, nie „platí odjakživa".
   */
  effectiveFrom: Date | null
  effectiveTo: Date | null

  isActive: boolean
  contentHash?: string
  changeNote?: string

  /**
   * Vypĺňa **človek**, nikdy sa neodvodzuje z diffu (D30). Oprava preklepu
   * a nová povinnosť vyzerajú v porovnaní podobne; systém to rozhodnúť nevie
   * a nemá.
   */
  requiresReacknowledgement?: boolean

  publishedAt?: Date
  publishedBy?: string
}

/** Len tá časť `documents`, ktorú potrebuje onboarding. */
export interface DocumentRecord {
  documentId: string
  title: string
  companyCode?: string
  accessLevel?: "public" | "internal"
  /**
   * Základný jazyk, v ktorom je dokument napísaný (číselník `language`).
   * **Nie je to jazyk prostredia** — nič neprekladáme; dokument v inom jazyku
   * je samostatný dokument, nie preklad. Viď `i18n.ts`.
   */
  language?: string
  versions?: Version[]
  /** Menovité zdieľanie mimo vlastnej vetvy (D32). */
  sharedWithCompanyCodes?: string[]
  /** Ponechané kvôli dokumentom naimportovaným pred zavedením `versions[]`. */
  versionId?: string
  effectiveFrom?: Date | null
  effectiveTo?: Date | null
}

/** Prečo dokument nemá platné znenie — aby sa dalo povedať niečo konkrétne. */
export type NoVersionReason =
  | "no-versions"
  | "validity-not-set"
  | "all-archived"
  | "not-yet-effective"
  | "no-longer-effective"

export type EffectiveVersionResult =
  | { ok: true; version: Version }
  | { ok: false; reason: NoVersionReason }

/**
 * Ktorá verzia platí k dátumu (predvolene dnes).
 *
 * Pravidlá sú z D6: `isActive` + `effectiveFrom/To`, pri viacerých vyhovujúcich
 * platí tá s najneskorším `effectiveFrom` (lex posterior, R3
 * v `docs/PRECEDENCIA_NORIEM.md`).
 *
 * **Verzia bez `effectiveFrom` neplatí.** Nie je to prísnosť pre prísnosť:
 * kurátor jej platnosť ešte neurčil (D25 — obsah z kanála prichádza
 * `isActive:false` a dátum mu dáva človek), a hlavne — znenie potvrdzovacej
 * formulky obsahuje „platná od {dátum}" (D28). Bez dátumu sa formulka nedá
 * ani zostaviť, takže potvrdiť takú verziu by znamenalo potvrdiť niečo,
 * čo sa nedá zapísať.
 *
 * Čistá funkcia bez databázy — je to jediné miesto s netriviálnymi pravidlami
 * a jediné, ktoré sa dá otestovať bez clustera.
 */
export function effectiveVersion(doc: DocumentRecord, asOf: Date = new Date()): EffectiveVersionResult {
  const versions = doc.versions ?? []
  if (versions.length === 0) return { ok: false, reason: "no-versions" }

  const active = versions.filter(v => v.isActive)
  if (active.length === 0) return { ok: false, reason: "all-archived" }

  const withValidity = active.filter(v => v.effectiveFrom instanceof Date)
  if (withValidity.length === 0) return { ok: false, reason: "validity-not-set" }

  const matching = withValidity.filter(v =>
    (v.effectiveFrom as Date).getTime() <= asOf.getTime() &&
    (v.effectiveTo == null || v.effectiveTo.getTime() > asOf.getTime())
  )

  if (matching.length === 0) {
    // Rozlíšenie „ešte" vs „už" je pre človeka na druhej strane podstatné:
    // prvé znamená počkaj, druhé znamená hľadaj novšie znenie.
    const earliest = Math.min(...withValidity.map(v => (v.effectiveFrom as Date).getTime()))
    return { ok: false, reason: earliest > asOf.getTime() ? "not-yet-effective" : "no-longer-effective" }
  }

  const latest = matching.reduce((a, b) =>
    (a.effectiveFrom as Date).getTime() >= (b.effectiveFrom as Date).getTime() ? a : b
  )
  return { ok: true, version: latest }
}

/** Načíta dokument. `null`, keď taký nie je. */
export async function loadDocument(documentId: string): Promise<DocumentRecord | null> {
  const col = await getCollection<DocumentRecord>(DOCUMENTS_COLLECTION)
  return col.findOne({ documentId })
}

/**
 * Pridá verziu do histórie. **Nikdy neprepisuje existujúcu** (D25).
 *
 * Idempotentné podľa `versionId`: opakovaný beh toho istého importu históriu
 * nezdvojí. Predchádzajúcej platnej verzii sa doplní `effectiveTo` len vtedy,
 * keď nová verzia platnosť má — inak by sa dokument ocitol bez platného
 * znenia kvôli niečomu, čo ešte nikto neschválil.
 */
export async function addVersion(documentId: string, v: Version): Promise<void> {
  const col = await getCollection<DocumentRecord>(DOCUMENTS_COLLECTION)

  const exists = await col.findOne({ documentId, "versions.versionId": v.versionId })
  if (exists) return

  if (v.effectiveFrom instanceof Date) {
    await col.updateOne(
      { documentId },
      { $set: { "versions.$[stara].effectiveTo": v.effectiveFrom } },
      {
        arrayFilters: [{
          "stara.effectiveTo": null,
          "stara.versionId": { $ne: v.versionId },
        }],
      }
    )
  }

  await col.updateOne({ documentId }, { $push: { versions: v } })
}

// ── Viditeľnosť (D32) ────────────────────────────────────────────────────────

/**
 * Smie táto osoba vidieť tento dokument?
 *
 * Viditeľnosť má **tri zdroje a žiadny ďalší** (D32):
 *
 *   1. `accessLevel: "public"` — zverejnené pre všetkých,
 *   2. zhoda `companyCode` — vlastný obsah tenanta,
 *   3. `sharedWithCompanyCodes[]` obsahuje kód osoby — niekto ho **menovite** zdieľal.
 *
 * **`companyCode.parent` neudeľuje nič.** Hierarchia je kontext pre relevanciu
 * a pre precedenciu noriem, nie kľúč k obsahu. Dcéra nevidí interný obsah
 * matky preto, že je dcéra.
 *
 * Čistá funkcia — pravidlo, ktoré rozhoduje o prístupe, sa musí dať otestovať
 * bez databázy a prečítať bez behu.
 */
export function canSeeDocument(
  person: { companyCode: string },
  doc: Pick<DocumentRecord, "accessLevel" | "companyCode" | "sharedWithCompanyCodes">
): boolean {
  if (doc.accessLevel === "public") return true
  if (!person?.companyCode) return false
  if (doc.companyCode === person.companyCode) return true
  return (doc.sharedWithCompanyCodes ?? []).includes(person.companyCode)
}

/**
 * Načíta dokument **pre konkrétnu osobu**. `null`, keď naň nevidí.
 *
 * Zámerne sa nerozlišuje „neexistuje" od „nesmieš" — inak by sa dalo
 * skúšaním identifikátorov zistiť, aké smernice iná organizácia má.
 */
export async function loadDocumentFor(
  person: { companyCode: string },
  documentId: string
): Promise<DocumentRecord | null> {
  const doc = await loadDocument(documentId)
  if (!doc) return null
  return canSeeDocument(person, doc) ? doc : null
}
