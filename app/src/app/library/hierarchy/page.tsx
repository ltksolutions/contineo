/**
 * /library/hierarchy — čo je čomu nadradený dokument (ADR-034, D219).
 *
 * Prehľad celej siete: koreň (zákon, stanovy) a pod ním podradené. Dokument
 * s viacerými nadradenými sa ukáže pod každým z nich s poznámkou, pod čím
 * ešte stojí. Nadradené sa nastavujú v úprave dokumentu — tam, kde sa
 * dokument spravuje; ťahanie myšou ako pri oddeleniach by pri viacerých
 * nadradených nebolo jednoznačné (presunúť, alebo pridať?).
 */
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { libraryContext } from "@/lib/library"
import { hierarchyDocuments } from "@/lib/libraryRead"
import { hierarchyRows, parentsMapOf } from "@/lib/documentHierarchy"
import { codelistFor } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import AppShell from "@/components/AppShell"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function HierarchyPage() {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const language = ctx.person.language
  const t = dictionary(language).library.hierarchy
  const branding = brandingView(ctx.tenant)
  const docs = (await hierarchyDocuments(ctx.tenant.companyCode)).filter(d => d.category !== "faq")
  const map = parentsMapOf(docs)
  const title = new Map(docs.map(d => [d.documentId, d.title]))
  const kinds = new Map(codelistFor("category", tenantExtras(ctx.tenant)).items.map(i => [i.key, i.label ?? i.key]))
  const related = new Set(docs.flatMap(d => d.parentIds.filter(p => title.has(p)).length ? [d.documentId, ...d.parentIds] : []))
  const rows = hierarchyRows(docs.filter(d => related.has(d.documentId)).map(d => d.documentId), map)
  const unplaced = docs.filter(d => !related.has(d.documentId))
  const kindOf = (id: string) => kinds.get(docs.find(d => d.documentId === id)?.category ?? "") ?? ""

  return (
    <AppShell language={language} title={t.title}>
      <div style={{ maxWidth: 820, ...tenantStyle(branding) }}>
        <div className="page-head">
          <h1 className="page-title">{t.title}</h1>
        </div>
        <p className="quiet" style={{ marginTop: 0 }}>{t.intro}</p>

        {rows.length === 0 ? (
          <div className="empty">
            <div className="empty-title">{t.emptyTitle}</div>
            <div className="empty-text">{t.emptyText}</div>
          </div>
        ) : (
          <ul className="card hier-list">
            {rows.map((r, i) => (
              <li key={`${r.documentId}-${i}`} className="hier-row" style={{ ["--level" as string]: r.level }}>
                <Link href={`/library/${encodeURIComponent(r.documentId)}`}>{title.get(r.documentId)}</Link>
                <span className="quiet"> · {kindOf(r.documentId)}</span>
                {r.otherParents.length > 0 && <span className="quiet hier-also">{t.alsoUnder(r.otherParents.map(p => title.get(p) ?? p).join(", "))}</span>}
              </li>
            ))}
          </ul>
        )}

        {unplaced.length > 0 && (
          <>
            <h2 className="detail-block-title" style={{ margin: "20px 0 8px" }}>{t.unplacedHeading(unplaced.length)}</h2>
            <p className="quiet" style={{ marginTop: 0 }}>{t.unplacedNote}</p>
            <ul className="card hier-list">
              {unplaced.map(d => (
                <li key={d.documentId} className="hier-row">
                  <Link href={`/library/${encodeURIComponent(d.documentId)}/edit`}>{d.title}</Link>
                  <span className="quiet"> · {kindOf(d.documentId)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </AppShell>
  )
}
