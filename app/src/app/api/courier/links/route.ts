/**
 * Hľadanie obsahu na vloženie odkazu do správy Kuriéra (KURIER-editor,
 * 15. 10. 2026; ADR-033 D208 — prílohy nahrádza odkaz na obsah v Contineo).
 *
 * Len dokumenty tej istej organizácie (`companyCode` v dotaze, D32) so
 * zverejneným znením — na tie vedie čitateľský detail `/documents/<id>`.
 * Prístup sa pri čítaní správy overuje znova; toto je len ponuka.
 */

import type { NextRequest } from "next/server"
import { onboardingContext } from "@/lib/session"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"

export const dynamic = "force-dynamic"

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export async function GET(req: NextRequest) {
  const ctx = await onboardingContext()
  if (ctx.state !== "ready") return new Response(null, { status: 401 })
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80)
  if (q.length < 2) return Response.json({ items: [] })
  const rows = await (await getCollection(DOCUMENTS_COLLECTION))
    .find(
      { companyCode: ctx.person.companyCode, title: { $regex: escape(q), $options: "i" }, "versions.0": { $exists: true } },
      { projection: { _id: 0, documentId: 1, title: 1 } },
    )
    .sort({ title: 1 }).limit(8).toArray() as unknown as { documentId: string; title?: string }[]
  return Response.json({
    items: rows.map(r => ({ title: String(r.title ?? r.documentId), href: `/documents/${encodeURIComponent(r.documentId)}` })),
  })
}
