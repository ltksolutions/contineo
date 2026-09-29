/**
 * comparison.ts — porovnanie dvoch znení jedného dokumentu pre asistenta
 * (plán „znenia v indexe", krok 7). Pravidlá sú v `versionCompare.ts`;
 * tu je načítanie z databázy a úseky pre model.
 *
 * Obe znenia sa režú **nanovo** tým istým chunkerom a profilom dokumentu,
 * ako ich reže knižnica — uložené úseky staršieho znenia môžu mať staršie
 * členenie a párovali by sa zle.
 */

import { getCollection } from "./mongodb"
import { requireCompanyCode } from "./tenantScope"
import { DOCUMENTS_COLLECTION } from "./documents"
import type { DocumentRecord, Version } from "./documents"
import { TENANTS_COLLECTION } from "./tenants"
import { chunkText } from "./chunker.mjs"
import { chunkingFor, toChunkerProfile, type ChunkingProfile, type ChunkingProfileDef } from "./chunkingProfile"
import { compareArticles, comparePair, selectDetail, versionText } from "./versionCompare"
import type { ArticleChange } from "./versionCompare"
import type { ChunkResult, ChunkVersion } from "./mongoSearch"

/** Prečo sa porovnať nedalo — štítok nad odpoveďou to povie (i18n). */
export type ComparisonUnavailable = "single-version" | "missing-text" | "identical" | "no-document"

export interface ComparisonSide extends ChunkVersion {
  versionId: string
}

export type Comparison =
  | {
      ok: true
      documentId: string
      title: string
      from: ComparisonSide
      to: ComparisonSide
      direction: "since" | "upcoming" | "previous"
      /** Všetky zmenené, pridané a zrušené články — prehľad pre model. */
      changes: ArticleChange[]
      /** Úseky pre model: staré a nové znenie podrobne porovnaných článkov. */
      chunks: ChunkResult[]
    }
  | { ok: false; reason: ComparisonUnavailable }

/** Jedna strana článku dlhšia než toto sa skráti — model má dostať rozdiel, nie celý predpis. */
const SIDE_LIMIT = 8000

const side = (v: Version): ComparisonSide => ({
  versionId: v.versionId,
  label: v.label ?? "",
  effectiveFrom: v.effectiveFrom ?? null,
  effectiveTo: v.effectiveTo ?? null,
})

const cap = (t: string) => (t.length > SIDE_LIMIT ? `${t.slice(0, SIDE_LIMIT)}\n[…]` : t)

/**
 * Porovná znenia dokumentu. `companyCode` je v podmienke dotazu (D32) —
 * `documentId` prichádza z výsledkov hľadania, ale identifikátor sa dá
 * uhádnuť. `preferRefs` sú články, ktoré našlo hľadanie; idú podrobne prvé.
 */
export async function buildComparison(
  companyCode: string,
  documentId: string,
  now: Date,
  since: Date | undefined,
  preferRefs: string[],
): Promise<Comparison> {
  const code = requireCompanyCode(companyCode, "buildComparison")
  const docs = await getCollection<DocumentRecord>(DOCUMENTS_COLLECTION)
  const doc = await docs.findOne({ companyCode: code, documentId }) as DocumentRecord | null
  if (!doc) return { ok: false, reason: "no-document" }

  const pair = comparePair(doc, now, since)
  if (!pair.ok) return pair

  const before = versionText(doc, pair.from)
  const after = versionText(doc, pair.to)
  if (!before || !after) return { ok: false, reason: "missing-text" }

  const tenants = await getCollection(TENANTS_COLLECTION)
  const tenant = await tenants.findOne({ companyCode: code }) as unknown as
    { chunkingProfiles?: ChunkingProfileDef[]; chunking?: Partial<ChunkingProfile> } | null
  const profil = toChunkerProfile(chunkingFor(tenant, doc.chunkingProfile))
  const cut = (text: string) => chunkText(text, { nazovDokumentu: doc.title, profil }).chunky

  const changes = compareArticles(cut(before), cut(after))
  if (!changes.length) return { ok: false, reason: "identical" }

  const from = side(pair.from)
  const to = side(pair.to)
  const chunk = (c: ArticleChange, i: number, which: "from" | "to"): ChunkResult | null => {
    const text = which === "from" ? c.before : c.after
    if (!text) return null
    return {
      // Úsek nie je v databáze — id nie je ObjectId, kurácia ho odfiltruje.
      _id: `compare:${i}:${which}`,
      text: cap(text),
      documentId,
      articleRef: c.ref,
      heading: c.heading,
      companyCode: code,
      accessLevel: doc.accessLevel,
      language: doc.language,
      version: which === "from" ? from : to,
      document: { title: doc.title, slug: "", category: "" },
    }
  }
  const chunks = selectDetail(changes, preferRefs)
    .flatMap((c, i) => [chunk(c, i, "from"), chunk(c, i, "to")])
    .filter((c): c is ChunkResult => c !== null)

  return { ok: true, documentId, title: doc.title, from, to, direction: pair.direction, changes, chunks }
}
