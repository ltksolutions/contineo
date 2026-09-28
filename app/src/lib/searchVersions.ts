/**
 * searchVersions.ts — v ktorých zneniach asistent hľadá (plán „znenia
 * v indexe", krok 4; `docs/TODO.md`).
 *
 * Hľadanie do kroku 4 filtrovalo úseky podľa `isActive`. To je stav
 * **úseku**, nie platnosť **znenia**: novela zverejnená vopred má aktívne
 * úseky, hoci ešte neplatí, a nahradené znenie platí do účinnosti nového
 * (D143), hoci jeho úseky aktívne nie sú. Asistent tak citoval text, ktorý
 * ešte neplatí.
 *
 * Preto sa platné znenia počítajú z `documents` tým istým pravidlom, podľa
 * ktorého sa potvrdzuje a prideľuje — `effectiveVersion()`. Dátumy na úsekoch
 * sa nepoužívajú: sú nekonzistentné (krok 0) a boli by druhým zdrojom pravdy.
 */

import { getCollection } from "./mongodb"
import { requireCompanyCode } from "./tenantScope"
import { DOCUMENTS_COLLECTION, effectiveVersion } from "./documents"
import type { DocumentRecord } from "./documents"

/**
 * Časové pásmo, v ktorom sa rozhoduje, či je otázka „na dnešok". Všetci
 * tenanti sú dnes v SR a ČR; keď pribudne iný, patrí to do profilu tenanta.
 */
export const SEARCH_TIME_ZONE = "Europe/Bratislava"

/** Rozsah hľadania: znenia a či patria do výsledkov aj overené odpovede. */
export interface SearchScope {
  /** Deň, ku ktorému sa odpovedá. */
  asOf: Date
  /** Znenia platné k `asOf` — najviac jedno na dokument. */
  versionIds: string[]
  /**
   * Overené odpovede (D11) vznikli nad dnešným znením a nesú len `isActive`,
   * nie znenie. Pri otázke k inému dňu by mohli tvrdiť niečo, čo vtedy
   * neplatilo — preto len pri otázke na dnešok.
   */
  verifiedAnswers: boolean
}

/**
 * Len to, čo potrebuje `effectiveVersion()`. Bez projekcie sa ťahá aj text
 * dokumentov — pri 13 dokumentoch 1,2 MB a 150–270 ms oproti 2 kB a 30 ms,
 * a to pred každou otázkou.
 */
export const VERSION_PROJECTION = {
  _id: 0, documentId: 1,
  "versions.versionId": 1, "versions.isActive": 1, "versions.effectiveFrom": 1, "versions.effectiveTo": 1,
} as const

const dayKey = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d)

/** Či sú dva okamihy v ten istý kalendárny deň v danom pásme. */
export function isSameDay(a: Date, b: Date, timeZone = SEARCH_TIME_ZONE): boolean {
  return dayKey(a, timeZone) === dayKey(b, timeZone)
}

/**
 * Znenia platné k dátumu. Čistá funkcia — dokument bez platného znenia
 * (koncept, budúca účinnosť, zrušený) do hľadania neprispeje ničím.
 */
export function effectiveVersionIdsOf(docs: DocumentRecord[], asOf: Date): string[] {
  const ids: string[] = []
  for (const doc of docs) {
    const r = effectiveVersion(doc, asOf)
    if (r.ok && r.version.versionId) ids.push(r.version.versionId)
  }
  return ids
}

/**
 * Rozsah hľadania organizácie k dátumu (predvolene dnes). `companyCode` je
 * v podmienke dotazu (D32) — znenia inej organizácie sa do zoznamu nedostanú
 * ani omylom.
 */
export async function searchScope(companyCode: string, asOf: Date = new Date(), now: Date = new Date()): Promise<SearchScope> {
  const code = requireCompanyCode(companyCode, "searchScope")
  const col = await getCollection<DocumentRecord>(DOCUMENTS_COLLECTION)
  const docs = await col
    .find(
      { companyCode: code },
      { projection: VERSION_PROJECTION },
    )
    .toArray()
  return {
    asOf,
    versionIds: effectiveVersionIdsOf(docs as DocumentRecord[], asOf),
    verifiedAnswers: isSameDay(asOf, now),
  }
}
