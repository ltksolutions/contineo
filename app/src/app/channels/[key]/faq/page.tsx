/**
 * /channels/[key]/faq — FAQ kanála (ADR-028, D201, Ján 11. 10. 2026).
 *
 * FAQ patrí ku kanálu: vzniká s ním, záznamy doň idú z fronty návrhov.
 * Úložisko ostáva dokument v knižnici — verzie, schvaľovanie, vyhľadávanie
 * a expirácia pri novom znení zdroja fungujú bez zmeny. Táto obrazovka je
 * prehľad a vstup: úprava záznamov a zverejnenie idú cestou knižnice.
 * Len správca obsahu (`libraryContext`), rovnako ako fronta návrhov.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import { ChannelPartTabs, channelHref } from "@/components/ChannelTabs"
import { libraryContext } from "@/lib/library"
import { channelByKey } from "@/lib/channels"
import { isPeopleAdmin } from "@/lib/people"
import { isHelpdeskAgent } from "@/lib/helpdeskAgents"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION, effectiveVersion, type DocumentRecord } from "@/lib/documents"
import { PROPOSALS_COLLECTION } from "@/lib/faqProposals"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function ChannelFaqPage({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { key } = await params
  const c = await channelByKey(ctx.tenant.companyCode, decodeURIComponent(key))
  if (!c || !c.faqDocumentId) notFound()
  const language = ctx.person.language
  const t = dictionary(language).channels
  const branding = brandingView(ctx.tenant)
  const [doc, openProposals] = await Promise.all([
    (await getCollection(DOCUMENTS_COLLECTION)).findOne({ companyCode: ctx.tenant.companyCode, documentId: c.faqDocumentId }) as unknown as Promise<(DocumentRecord & { title?: string; draftFaq?: unknown[] }) | null>,
    (await getCollection(PROPOSALS_COLLECTION)).countDocuments({ companyCode: ctx.tenant.companyCode, channelKey: c.key, status: "open" }),
  ])
  if (!doc) notFound()
  const v = effectiveVersion(doc)
  const published = v.ok ? ((v.version as { faq?: unknown[] }).faq ?? []).length : 0
  const draft = (doc.draftFaq ?? []).length
  const canTickets = c.kind === "widget" && c.tickets && isHelpdeskAgent(ctx.person) && c.assigneeIds.includes(ctx.person.id)
  const id = encodeURIComponent(c.faqDocumentId)

  return (
    <AppShell language={language} title={`${t.faqHeading} — ${c.name}`} trail={{ "/channels": t.heading, [channelHref(c.key)]: c.name }}>
    <div className="detail-page" style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{t.faqHeading}</h1>
      </div>
      <ChannelPartTabs channelKey={c.key} current={channelHref(c.key, "faq")} canTickets={canTickets} canSettings={isPeopleAdmin(ctx.person)} canContent hasFaq language={language} />
      <p className="quiet page-lead" style={{ margin: "0 0 16px" }}>{t.faqIntro}</p>
      <section className="card detail-block compliance-run">
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <p style={{ margin: 0 }}><b>{String(doc.title ?? c.faqDocumentId)}</b></p>
          <p style={{ margin: 0 }}>{v.ok ? t.faqPublished(v.version.label, published) : t.faqNotPublished}</p>
          <p className="quiet" style={{ margin: 0 }}>{t.faqDraft(draft)}</p>
          <p className="quiet" style={{ margin: 0 }}><Link href={channelHref(c.key, "proposals")}>{t.faqProposalsOpen(openProposals)}</Link></p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="button button--quiet" href={`/library/${id}/faq`}>{t.faqEdit}</Link>
          <Link className="button button--quiet" href={`/library/${id}`}>{t.faqOpenDocument}</Link>
        </div>
      </section>
    </div>
    </AppShell>
  )
}
