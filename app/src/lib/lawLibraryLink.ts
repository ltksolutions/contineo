/**
 * lawLibraryLink.ts — ktoré predpisy z katalógu má organizácia ako dokument
 * knižnice (ADR-039 fáza 2, D260).
 *
 * Napojenie je **odvodené, nie uložené** (D27): dokument knižnice s pôvodom
 * `web` / adaptér `slov-lex` a identifikátorom predpisu je ten istý predpis
 * ako záznam katalógu. Nič sa nemigruje — zákon o športe importovaný podľa
 * ADR-037 je napojený od prvého behu fázy 2.
 *
 * Používa to hľadanie (zverejnený dokument knižnice má pri odpovedi prednosť
 * pred úsekmi katalógu — zákon neprichádza dvakrát), nastavenie Legislatívy
 * (odkaz „v knižnici") a import (čo už v knižnici je). `companyCode` je
 * v podmienke každého dotazu (D90).
 */

import { getCollection } from "./mongodb"
import { requireCompanyCode } from "./tenantScope"
import { DOCUMENTS_COLLECTION, effectiveVersion, type DocumentRecord } from "./documents"
import { SLOV_LEX_ADAPTER } from "./slovLex"

export interface LawLibraryDocument {
  actId: string
  documentId: string
  title: string
  /** Časová verzia znenia, ktoré je v knižnici naposledy stiahnuté (ADR-037 D243). */
  timepoint: string
  /** Má zverejnené znenie platné k danému dňu — vtedy odpovedá knižnica, nie katalóg. */
  published: boolean
}

/** Dokumenty knižnice pre dané predpisy; chýbajúci predpis v mape nie je. */
export async function lawDocumentsFor(companyCode: string, actIds: string[], now: Date = new Date()): Promise<Map<string, LawLibraryDocument>> {
  const code = requireCompanyCode(companyCode, "lawLibraryLink.lawDocumentsFor")
  const out = new Map<string, LawLibraryDocument>()
  if (!actIds.length) return out
  const docs = await (await getCollection<DocumentRecord>(DOCUMENTS_COLLECTION))
    .find(
      { companyCode: code, "source.type": "web", "source.adapter": SLOV_LEX_ADAPTER, "source.externalId": { $in: actIds } },
      { projection: { documentId: 1, title: 1, source: 1, versions: 1 } },
    ).toArray()
  for (const d of docs) {
    const src = d.source
    if (!src || src.type !== "web") continue
    out.set(src.externalId, {
      actId: src.externalId, documentId: d.documentId, title: String(d.title ?? d.documentId),
      timepoint: src.timepoint, published: effectiveVersion(d, now).ok,
    })
  }
  return out
}
