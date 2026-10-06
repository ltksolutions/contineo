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
import type { ChunkResult, ChunkVersion } from "./mongoSearch"
import { calendarDate, SEARCH_TIME_ZONE } from "./versionContext"

// Pásmo „dňa otázky" je v čistom module — používa ho aj prompt modelu.
export { SEARCH_TIME_ZONE }

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
  /**
   * Označenie a účinnosť platných znení podľa `versionId` — pre kontext
   * modelu a zoznam zdrojov (krok 5). Kópia z `documents`, načítaná tým
   * istým dotazom, žiadny ďalší sa nerobí.
   */
  versions: Record<string, ChunkVersion>
}

/**
 * Len to, čo potrebuje `effectiveVersion()`. Bez projekcie sa ťahá aj text
 * dokumentov — pri 13 dokumentoch 1,2 MB a 150–270 ms oproti 2 kB a 30 ms,
 * a to pred každou otázkou.
 */
export const VERSION_PROJECTION = {
  _id: 0, documentId: 1,
  "versions.versionId": 1, "versions.label": 1, "versions.isActive": 1,
  "versions.effectiveFrom": 1, "versions.effectiveTo": 1,
} as const

/** Či sú dva okamihy v ten istý kalendárny deň v danom pásme. */
export function isSameDay(a: Date, b: Date, timeZone = SEARCH_TIME_ZONE): boolean {
  return calendarDate(a, timeZone).getTime() === calendarDate(b, timeZone).getTime()
}

/**
 * Znenia platné k dátumu. Čistá funkcia — dokument bez platného znenia
 * (koncept, budúca účinnosť, zrušený) do hľadania neprispeje ničím.
 */
export function effectiveVersionsOf(docs: DocumentRecord[], asOf: Date): Record<string, ChunkVersion> {
  const versions: Record<string, ChunkVersion> = {}
  for (const doc of docs) {
    const r = effectiveVersion(doc, asOf)
    if (!r.ok || !r.version.versionId) continue
    versions[r.version.versionId] = {
      label: r.version.label ?? "",
      effectiveFrom: r.version.effectiveFrom ?? null,
      effectiveTo: r.version.effectiveTo ?? null,
    }
  }
  return versions
}

/** Len identifikátory platných znení — pre filter hľadania. */
export function effectiveVersionIdsOf(docs: DocumentRecord[], asOf: Date): string[] {
  return Object.keys(effectiveVersionsOf(docs, asOf))
}

/**
 * Pripojí k úsekom znenie, ku ktorému patria. Úsek bez znenia v mape
 * (overená odpoveď) zostane bez neho — radšej nič než odhad.
 */
export function attachVersions(chunks: ChunkResult[], versions: Record<string, ChunkVersion>): ChunkResult[] {
  return chunks.map(c => {
    const v = c.versionId ? versions[c.versionId] : undefined
    return v ? { ...c, version: v } : c
  })
}

/**
 * Rozsah hľadania organizácie k dátumu (predvolene dnes). `companyCode` je
 * v podmienke dotazu (D32) — znenia inej organizácie sa do zoznamu nedostanú
 * ani omylom.
 */
export async function searchScope(
  companyCode: string,
  asOf: Date = new Date(),
  now: Date = new Date(),
  /**
   * Zúženie na priečinky knižnice — rozsah kanála helpdesku (ADR-028, D161).
   * Prázdny zoznam znamená celú knižnicu, nie nič: kanál bez priečinkov
   * vidí všetko organizácie.
   */
  narrow?: { folderIds?: string[] },
): Promise<SearchScope> {
  const code = requireCompanyCode(companyCode, "searchScope")
  const col = await getCollection<DocumentRecord>(DOCUMENTS_COLLECTION)
  const folderIds = (narrow?.folderIds ?? []).filter(Boolean)
  const docs = await col
    .find(
      // `folderPath` nesie aj predkov (D56), takže jeden `$in` pokryje podstrom.
      folderIds.length ? { companyCode: code, folderPath: { $in: folderIds } } : { companyCode: code },
      { projection: VERSION_PROJECTION },
    )
    .toArray()
  const versions = effectiveVersionsOf(docs as DocumentRecord[], asOf)
  return {
    asOf,
    versionIds: Object.keys(versions),
    verifiedAnswers: isSameDay(asOf, now),
    versions,
  }
}
