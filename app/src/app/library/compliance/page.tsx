/**
 * /library/compliance — kontroly súladu dokumentov proti normám (ADR-032, D196).
 * Rola `compliance` (`complianceContext`); behy sú spoločné pre všetkých
 * s rolou (Ján 11. 10. 2026). Nálezy a rozhodnutia sú na detaile behu
 * (`/library/compliance/[runId]`) — časť, ktorú má cesta pomenovať, má
 * vlastnú adresu.
 *
 * Ján 10. 10. 2026: „spravme kontrolu manuálov voči platným dokumentom… nech
 * vieme, že návody sú OK voči nadradeným normám".
 */

import { listChannels } from "@/lib/channels"
import { PROPOSALS_COLLECTION } from "@/lib/faqProposals"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import MultiSelect from "@/components/MultiSelect"
import SubmitButton from "@/components/SubmitButton"
import { complianceContext } from "@/lib/complianceAccess"
import { documentRuns, reviewRunFor, proposalsScopeKey, MAX_FAILURES } from "@/lib/complianceCheck"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { PERSONS_COLLECTION, type Person } from "@/lib/persons"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { startDocumentReviewAction, dismissRequestAction, removeLinkAction } from "../complianceActions"
import { openRequests, listLinks } from "@/lib/complianceRequests"
import { categoryRank, documentRole } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"

export const dynamic = "force-dynamic"

export default async function ComplianceRunsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await complianceContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const q = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const language: UiLanguage = ctx.person.language
  const t = dictionary(language).library.compliance
  const branding = brandingView(ctx.tenant)
  const [runs, docs] = await Promise.all([
    documentRuns(ctx.tenant.companyCode),
    (await getCollection(DOCUMENTS_COLLECTION))
      .find({ companyCode: ctx.tenant.companyCode, category: { $ne: "faq" } }, { projection: { documentId: 1, title: 1, category: 1, accessLevel: 1 } })
      .sort({ title: 1 }).toArray() as unknown as Promise<{ documentId: string; title?: string; category?: string; accessLevel?: string }[]>,
  ])
  const [requests, links] = await Promise.all([openRequests(ctx.tenant.companyCode), listLinks(ctx.tenant.companyCode)])
  const option = (d: (typeof docs)[number]) => ({ value: d.documentId, label: `${String(d.title ?? d.documentId)}${d.accessLevel === "internal" ? " · interný" : ""}` })
  // Úloha dokumentu (ADR-034, D218): kontroluje sa výkladový aj záväzný
  // (poriadok proti Stanovám), záznam nie; meradlom je len záväzný, od
  // najvyššieho (zákon, stanovy, poriadky…).
  const extras = tenantExtras(ctx.tenant)
  const subjectOptions = docs.filter(d => documentRole(d.category, extras) !== "record").map(option)
  const referenceOptions = docs.filter(d => documentRole(d.category, extras) === "binding")
    .sort((a, b) => categoryRank(a.category, extras) - categoryRank(b.category, extras) || String(a.title ?? "").localeCompare(String(b.title ?? ""), "sk"))
    .map(option)
  // Kontrola návrhov FAQ sa spúšťa vo fronte návrhov kanála, nie tu — odkaz tam, kde návrhy sú.
  const proposalChannels = new Set(await (await getCollection(PROPOSALS_COLLECTION)).distinct("channelKey", { companyCode: ctx.tenant.companyCode }) as string[])
  const faqQueues = await Promise.all((await listChannels(ctx.tenant.companyCode)).filter(ch => proposalChannels.has(ch.key)).map(async ch => {
    const proposalsCol = await getCollection(PROPOSALS_COLLECTION)
    const [open, reviewed, run] = await Promise.all([
      proposalsCol.countDocuments({ companyCode: ctx.tenant.companyCode, channelKey: ch.key, status: "open" }),
      proposalsCol.countDocuments({ companyCode: ctx.tenant.companyCode, channelKey: ch.key, status: "open", review: { $exists: true } }),
      reviewRunFor(ctx.tenant.companyCode, proposalsScopeKey(ch.key)),
    ])
    return { key: ch.key, name: ch.name, open, reviewed, run }
  }))
  /*
   * Kto kontrolu spustil — menom, nie adresou (Ján 13. 10. 2026: v zozname
   * nebolo vidieť dátum ani kto). Jeden dotaz na všetky behy naraz.
   */
  const starters = [...new Set([...runs.map(r => r.startedBy), ...faqQueues.map(f => f.run?.startedBy)].filter((e): e is string => Boolean(e)))]
  const nameByEmail = new Map((await (await getCollection<Person>(PERSONS_COLLECTION))
    .find({ companyCode: ctx.tenant.companyCode, email: { $in: starters } }, { projection: { _id: 0, email: 1, fullName: 1 } }).toArray())
    .map(p => [p.email, p.fullName?.trim() || p.email]))
  const who = (email: string) => nameByEmail.get(email) ?? email

  return (
    <AppShell language={language} title={t.heading} trail={{ "/library": dictionary(language).library.list.heading }}>
    <div className="detail-page" style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{t.heading}</h1>
      </div>
      <p className="quiet page-lead" style={{ margin: "0 0 16px" }}>{t.intro}</p>
      <Notice message={q.msg} error={q.error === "1"} back="/library/compliance" language={language} />

      {/* Požiadavky na kontrolu pri novom znení dokumentu v pevnej väzbe (ADR-032, D200). */}
      {requests.length > 0 && (
        <div id="requests" style={{ display: "grid", gap: 12, marginBottom: 16 }}>
          <h2 className="detail-block-title" style={{ margin: "0 0 2px" }}>{t.requestsHeading}</h2>
          {requests.map(r => (
            <section key={r.id} className="card detail-block" style={{ display: "grid", gap: 8 }}>
              <p style={{ margin: 0 }}><span className="tag tag--warn">{t.requestTag}</span> <b>{t.requestTitle(r.documentTitle, r.versionLabel)}</b></p>
              <p className="quiet" style={{ margin: 0 }}>{t.requestWhen(formatDate(r.publishedAt, language), r.publishedBy)}</p>
              {r.subjectIds.length > 0 && <p style={{ margin: 0 }}><b>{t.subjects}:</b> {r.subjectTitles.join(", ")}</p>}
              {r.referenceIds.length > 0 && <p style={{ margin: 0 }}><b>{t.references}:</b> {r.referenceTitles.join(", ")}</p>}
              {r.faq.map(f => <p key={f.channelKey} style={{ margin: 0 }}><Link href={`/channels/${encodeURIComponent(f.channelKey)}/proposals#review`}>{t.requestFaq(f.proposals)}</Link></p>)}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                {r.subjectIds.length > 0 && (
                  <form action={startDocumentReviewAction}>
                    <input type="hidden" name="requestId" value={r.id} />
                    <input type="hidden" name="name" value={t.requestRunName(r.documentTitle, r.versionLabel)} />
                    {r.subjectIds.map(id => <input key={id} type="hidden" name="subjectIds" value={id} />)}
                    {r.referenceIds.map(id => <input key={id} type="hidden" name="documentIds" value={id} />)}
                    <SubmitButton className="button button--quiet">{t.requestStart}</SubmitButton>
                  </form>
                )}
                <details className="cf-rename">
                  <summary>{t.requestDismiss}</summary>
                  <form action={dismissRequestAction} className="cf-rename-form">
                    <input type="hidden" name="requestId" value={r.id} />
                    <label className="field" style={{ margin: 0 }}>
                      <span className="field-label">{t.reason}</span>
                      <textarea className="field-input" name="reason" rows={2} required maxLength={1000} placeholder={t.requestDismissPlaceholder} />
                    </label>
                    <div><SubmitButton className="button button--quiet">{t.requestDismissSave}</SubmitButton></div>
                  </form>
                </details>
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="card detail-block" style={{ marginBottom: 16 }}>
        <form action={startDocumentReviewAction} style={{ display: "grid", gap: 12 }}>
          {/* Názov kontroly (KNIZ-kontrola-suladu-detail, Q4): nadpis detailu. */}
          <label className="field" style={{ margin: 0 }}>
            <span className="field-label">{t.nameLabel}</span>
            <input className="field-input" name="name" maxLength={120} />
            <span className="quiet field-hint">{t.nameHint}</span>
          </label>
          <div className="field" style={{ margin: 0 }}>
            <span className="field-label">{t.subjects}</span>
            {/* Prázdny výber (Ján 11. 10. 2026: „mám prednastavené posledné dokumenty, to nie je ok") —
                zopakovanie kontroly je „Spustiť znova" na jej detaile. */}
            <MultiSelect name="subjectIds" options={subjectOptions} selected={[]} emit="repeat" caseSensitive noscript="checkboxes" language={language} />
            <span className="quiet field-hint">{t.subjectsHint}</span>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <span className="field-label">{t.references}</span>
            <MultiSelect name="documentIds" options={referenceOptions} selected={[]} emit="repeat" caseSensitive noscript="checkboxes" language={language} />
            <span className="quiet field-hint">{t.referencesHint}</span>
          </div>
          <div><SubmitButton className="button">{t.start}</SubmitButton></div>
        </form>
      </section>

      <h2 className="detail-block-title" style={{ margin: "8px 0 10px" }}>{t.runsHeading}</h2>
      {/* Kontrola návrhov FAQ ako karta v zozname kontrol (Ján 11. 10. 2026: riadok pod
          úvodom bol „úplne prehliadnuteľný"). Spúšťa sa vo fronte návrhov kanála. */}
      {faqQueues.length > 0 && (
        <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
          {faqQueues.map(q => (
            <section key={q.key} className="card detail-block compliance-run">
              <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <p style={{ margin: 0 }}><b>{t.faqCardTitle(q.name)}</b>{" · "}{t.faqCardCounts(q.open, q.reviewed)}</p>
                <p className="quiet" style={{ margin: 0 }}>
                  {q.run && q.run.pending.length > 0
                    ? (q.run.failures >= MAX_FAILURES ? <span className="bad-fg">{t.stopped}</span> : t.faqCardRunning(q.run.total - q.run.pending.length, q.run.total))
                    : q.run ? t.faqCardLast(formatDate(q.run.finishedAt ?? q.run.updatedAt, language), who(q.run.startedBy)) : t.faqCardNever}
                </p>
              </div>
              <Link className="button button--quiet" href={`/channels/${encodeURIComponent(q.key)}/proposals#review`}>{t.faqCardOpen}</Link>
            </section>
          ))}
        </div>
      )}
      {runs.length === 0 && <p className="quiet">{t.none}</p>}
      <div style={{ display: "grid", gap: 12 }}>
        {runs.map(run => {
          const findings = (run.results ?? []).flatMap(r => r.findings)
          const open = findings.filter(f => !f.status).length
          return (
            <section key={run.runId} className="card detail-block compliance-run">
              <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <p style={{ margin: 0 }}>
                  <b>{run.name || t.runMeta(formatDate(run.startedAt, language), who(run.startedBy))}</b>{" · "}
                  {run.pending.length === 0 ? t.findingsCount(findings.length, open)
                    : run.failures >= MAX_FAILURES ? <span className="bad-fg">{t.stopped}</span>
                    : t.progress(run.total - run.pending.length, run.total)}
                </p>
                {/* Pomenovaná kontrola má dátum a autora v riadku pod názvom; nepomenovaná ich má v názve. */}
                {run.name && <p className="quiet" style={{ margin: 0 }}>{t.runMeta(formatDate(run.startedAt, language), who(run.startedBy))}</p>}
                <p className="quiet" style={{ margin: 0 }}>
                  {run.scope.kind === "documents" ? run.scope.subjectIds.length : run.total} → {t.against(run.documents.map(d => d.title).join(", "))}
                </p>
              </div>
              <Link className="button button--quiet" href={`/library/compliance/${encodeURIComponent(run.runId)}`}>{t.openRun}</Link>
            </section>
          )
        })}
      </div>

      {/* Pevné väzby (D197) — pri novom znení normy vznikne požiadavka na kontrolu. */}
      <h2 id="links" className="detail-block-title" style={{ margin: "20px 0 4px" }}>{t.linksHeading}</h2>
      <p className="quiet" style={{ margin: "0 0 10px" }}>{t.linksIntro}</p>
      {links.length === 0 && <p className="quiet">{t.linksNone}</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {links.map(l => (
          <section key={l.subjectId} className="card detail-block compliance-run">
            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <p style={{ margin: 0 }}><b>{l.subjectTitle}</b></p>
              <p className="quiet" style={{ margin: 0 }}>{t.against(l.referenceTitles.join(", "))}</p>
            </div>
            <form action={removeLinkAction}>
              <input type="hidden" name="subjectId" value={l.subjectId} />
              <SubmitButton className="button button--quiet">{t.linkRemove}</SubmitButton>
            </form>
          </section>
        ))}
      </div>
    </div>
    </AppShell>
  )
}
