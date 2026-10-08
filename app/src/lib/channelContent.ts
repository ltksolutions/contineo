/**
 * channelContent.ts — čo asistent kanála vidí (náhľad v nastavení kanála,
 * Ján 8. 10. 2026).
 *
 * Tá istá podmienka ako hľadanie kanála (`searchScope()` + filter úrovne
 * v `mongoSearch`): dokumenty vo vybraných priečinkoch (bez výberu celá
 * knižnica), ktoré majú dnes platné znenie a ktorých úroveň kanál pripúšťa.
 * Čo v priečinkoch je, ale do odpovedí nepadne, sa vypíše s dôvodom —
 * presne to sa inak dá len hádať, keď asistent na niečo neodpovedá.
 *
 * Úroveň je vlastnosť typu kanála (`channelAccessLevel()`): widget je
 * verejný vždy, portál podľa nastavenia, predvolene verejný.
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION, effectiveVersion, type DocumentRecord } from "./documents"
import { VERIFIED_ANSWER_SOURCE } from "./mongoSearch"
import { requireCompanyCode } from "./tenantScope"
import { channelAccessLevel, type HelpdeskChannel } from "./channels"

/** Najviac riadkov v jednom zozname — náhľad, nie knižnica. */
export const PREVIEW_LIMIT = 300

export type ExcludedReason = "draft" | "notEffective" | "internal"

export interface PreviewRow {
  documentId: string
  title: string
  category: string | null
  accessLevel: "public" | "internal"
  /** Označenie platného znenia (len pri zahrnutých). */
  versionLabel: string | null
  reason?: ExcludedReason
}

export interface ChannelContentPreview {
  accessLevel: "public" | "internal"
  included: PreviewRow[]
  excluded: PreviewRow[]
  includedTotal: number
  excludedTotal: number
  /** Overené odpovede (D11) — nie sú v priečinkoch, idú do každého kanála s danou úrovňou. */
  verifiedAnswers: number
}

type Raw = DocumentRecord & { title?: string; category?: string; status?: string }

/** Prečo dokument do kanála nepadne; `null` = padne. Čistá funkcia kvôli testom. */
export function excludedReason(doc: Raw, level: "public" | "internal", asOf: Date): ExcludedReason | null {
  const eff = effectiveVersion(doc, asOf)
  if (!eff.ok) return eff.reason === "no-versions" ? "draft" : "notEffective"
  if (level === "public" && doc.accessLevel !== "public") return "internal"
  return null
}

export async function channelContentPreview(companyCode: string, channel: HelpdeskChannel, asOf: Date = new Date()): Promise<ChannelContentPreview> {
  const code = requireCompanyCode(companyCode, "channelContentPreview")
  const level = channelAccessLevel(channel)
  const folderIds = (channel.folderIds ?? []).filter(Boolean)
  const docs = await (await getCollection<Raw>(DOCUMENTS_COLLECTION))
    .find(
      folderIds.length ? { companyCode: code, folderPath: { $in: folderIds } } : { companyCode: code },
      { projection: { _id: 0, documentId: 1, title: 1, category: 1, accessLevel: 1, status: 1, versions: 1 } },
    )
    .sort({ title: 1 })
    .toArray()

  const included: PreviewRow[] = []
  const excluded: PreviewRow[] = []
  for (const d of docs) {
    const reason = excludedReason(d, level, asOf)
    const eff = effectiveVersion(d, asOf)
    const row: PreviewRow = {
      documentId: d.documentId,
      title: String(d.title ?? d.documentId),
      category: d.category ?? null,
      accessLevel: d.accessLevel === "public" ? "public" : "internal",
      versionLabel: eff.ok ? (eff.version.label || null) : null,
    }
    if (reason) excluded.push({ ...row, reason })
    else included.push(row)
  }

  const verifiedAnswers = await (await getCollection("document_chunks")).countDocuments({
    companyCode: code, sourceType: VERIFIED_ANSWER_SOURCE, isActive: true,
    ...(level === "public" ? { accessLevel: "public" } : {}),
  })

  return {
    accessLevel: level,
    included: included.slice(0, PREVIEW_LIMIT),
    excluded: excluded.slice(0, PREVIEW_LIMIT),
    includedTotal: included.length,
    excludedTotal: excluded.length,
    verifiedAnswers,
  }
}
