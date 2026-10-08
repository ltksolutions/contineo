/**
 * /channels/tickets/[id] — ticket (ADR-028 krok 4; pod Kanálmi od D170,
 * predtým `/helpdesk/[id]`). Len riešiteľ kanála ticketu — správca nie (D170).
 *
 * Vľavo vlákno správ, pod ním návrh odpovede a odoslanie; vpravo (od 1024 px)
 * kto rieši, zdroje návrhu a „Pridať do FAQ". Všetko sú formuláre — bez
 * JavaScriptu to funguje rovnako. Jediné plné tlačidlo na obrazovke je
 * **Odoslať odpoveď** (CLAUDE.md: najviac jedno plné).
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import Select from "@/components/Select"
import FormattedText from "@/components/FormattedText"
import SubmitButton from "@/components/SubmitButton"
import { helpdeskContext } from "@/lib/helpdeskAgents"
import { ticketById, faqPrefillFromTicket } from "@/lib/tickets"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { findPerson } from "@/lib/persons"
import { takeTicketAction, draftWithAiAction, saveDraftAction, sendAnswerAction, closeTicketAction, ticketToFaqAction, importThreadAction } from "../actions"

export const dynamic = "force-dynamic"

export default async function TicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<RawQuery> }) {
  const ctx = await helpdeskContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { id } = await params
  const { msg, error } = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const keys = ctx.channels.map(c => c.key)
  const ticket = await ticketById(ctx.tenant.companyCode, keys, id)
  if (!ticket) notFound()
  const channel = ctx.channels.find(c => c.key === ticket.channelKey)
  const language = ctx.person.language
  const t = dictionary(language).helpdesk
  const branding = brandingView(ctx.tenant)
  const base = `/channels/tickets/${encodeURIComponent(id)}`
  const assignee = ticket.assigneeId ? await findPerson(ctx.tenant.companyCode, ticket.assigneeId).catch(() => null) : null
  const faqDocs = (await (await getCollection(DOCUMENTS_COLLECTION))
    .find({ companyCode: ctx.tenant.companyCode, category: "faq" }, { projection: { documentId: 1, title: 1 } })
    .sort({ title: 1 }).toArray() as unknown as { documentId: string; title?: string }[])
    .map(x => ({ value: x.documentId, label: String(x.title ?? x.documentId) }))
  const prefill = faqPrefillFromTicket(ticket)
  const draftText = ticket.draft?.text ?? ""
  const who = (m: (typeof ticket.messages)[number]) =>
    m.direction === "out" ? t.fromHelpdesk : t.fromAsker(m.from?.name ?? m.from?.address ?? ticket.asker.name ?? "")
  // Začiatok celého textu, nie prvý riadok — ten býva len „Dobrý deň,".
  const preview = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 200)
  // Vlákno pod odpoveďou, najnovšia správa hore a rozbalená, staršie zbalené
  // (Ján 7. 10. 2026). Kópia poľa — `messages` ostáva od najstaršej.
  const newestFirst = [...ticket.messages].reverse()
  const isOpen = ticket.state !== "closed"
  const canSend = isOpen && Boolean(channel?.mailbox) && (ticket.asker.email || ticket.messages.some(m => m.direction === "in"))
  const sources = (ticket.draft?.sources ?? []) as { documentId?: string; title?: string; articleRef?: string | null; sourceType?: string; live?: { connectorName: string; group?: string } }[]

  return (
    <AppShell language={language} title={ticket.subject || t.heading} trail={{ "/channels/tickets": dictionary(language).channels.tabMyTickets }}>
    <div className="detail-page" style={{ maxWidth: 1100, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{ticket.subject || "—"}</h1>
        <span className="page-head-spacer" />
        <span className={`tag ${ticket.state === "sent" || ticket.state === "closed" ? "tag--published" : "tag--draft"}`}>{t.state[ticket.state]}</span>
      </div>
      <p className="quiet" style={{ margin: "0 0 12px" }}>
        {t.fromAsker(ticket.asker.name ?? "")}{ticket.asker.email ? ` · ${ticket.asker.email}` : ""}
        {ticket.asker.club ? ` · ${ticket.asker.club}` : ""}{ticket.asker.reference ? ` · ${ticket.asker.reference}` : ""}
        {ticket.asker.roles.length ? ` · ${ticket.asker.roles.join(", ")}` : ""}
        {" · "}{channel?.name ?? ticket.channelKey} · {t.source[ticket.source]}
        {" · "}{ticket.assigneeId ? t.assignedTo(assignee?.fullName ?? ticket.assigneeId) : t.unassigned}
      </p>
      <Notice message={msg} error={error === "1"} back={base} language={language} />

      <div className="detail-grid">
        <div className="detail-main">
          <section className="card detail-block" id="answer">
            <h2 className="detail-block-title">{t.draftHeading}</h2>
            <p className="detail-block-note" style={{ margin: 0 }}>{t.draftIntro}</p>
            {ticket.sentAnswer && (
              <p className="quiet" style={{ margin: 0 }}>
                {t.sent(ticket.sentAnswer.by, formatDate(ticket.sentAnswer.at, language))}
                {ticket.draft && <> · {ticket.draft.text === ticket.sentAnswer.text ? t.sentUnchanged : t.sentEdited}</>}
              </p>
            )}
            {isOpen && (
              <form action={draftWithAiAction} style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton className="button button--quiet">{t.draftFromAi}</SubmitButton>
                {ticket.draft ? <span className="quiet">{t.draftMeta(ticket.draft.model, formatDate(ticket.draft.at, language))}</span> : <span className="quiet">{t.noDraft}</span>}
              </form>
            )}
            {isOpen ? (
              <form id="answer-form" action={saveDraftAction} style={{ display: "grid", gap: 10 }}>
                <input type="hidden" name="id" value={id} />
                <label className="field">
                  <span className="field-label">{t.answer}</span>
                  <textarea className="field-input" name="text" rows={12} defaultValue={draftText} />
                  <span className="quiet field-hint">{t.answerHint}</span>
                </label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <SubmitButton className="button button--quiet">{t.saveDraft}</SubmitButton>
                  {canSend ? (
                    <button className="button" type="submit" formAction={sendAnswerAction}>{t.send}</button>
                  ) : (
                    <span className="quiet">{t.noMailbox}</span>
                  )}
                  <span className="quiet field-hint">{t.sendHint}</span>
                </div>
              </form>
            ) : (
              <article className="answer" style={{ lineHeight: 1.7 }}><FormattedText text={ticket.sentAnswer?.text ?? draftText} /></article>
            )}
          </section>

          <section className="card detail-block">
            <h2 className="detail-block-title">{t.thread}</h2>
            {newestFirst.length > 1 && (
              <p className="quiet thread-summary">{t.threadSummary(newestFirst.length, who(newestFirst[0]), formatDate(newestFirst[0].at, language))}</p>
            )}
            {newestFirst.map((m, i) => {
              const cls = `thread-msg${m.direction === "out" ? " thread-msg--out" : ""}`
              const meta = <><b>{who(m)}</b> · {formatDate(m.at, language)}{m.attachments.length > 0 && <> · {t.attachments(m.attachments.length)}</>}</>
              const body = (
                <>
                  <div className="thread-msg-body">{m.text}</div>
                  {m.quoted && (
                    <details className="thread-quoted">
                      <summary className="quiet">{t.quotedHistory}</summary>
                      <div className="quiet thread-quoted-body">{m.quoted}</div>
                    </details>
                  )}
                </>
              )
              if (i === 0) {
                return (
                  <article key={`${m.providerId}-${i}`} className={cls}>
                    <p className="quiet thread-msg-head">{meta}</p>
                    {body}
                  </article>
                )
              }
              return (
                <details key={`${m.providerId}-${i}`} className={cls}>
                  <summary className="quiet"><span className="thread-msg-meta">{meta}</span><span className="thread-msg-preview">· {preview(m.text)}</span></summary>
                  {body}
                </details>
              )
            })}
            {ticket.source === "email" && ticket.threadRef && (
              <form action={importThreadAction} style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton className="button button--quiet">{t.threadImport}</SubmitButton>
                <span className="quiet field-hint">{t.threadImportHint}</span>
              </form>
            )}
          </section>
        </div>

        <aside className="detail-side" style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <section className="card detail-block">
            <form action={takeTicketAction} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input type="hidden" name="id" value={id} />
              {ticket.assigneeId === ctx.person.id ? (
                <><input type="hidden" name="release" value="1" /><SubmitButton className="button button--quiet">{t.release}</SubmitButton></>
              ) : (
                <SubmitButton className="button button--quiet">{t.take}</SubmitButton>
              )}
            </form>
            <form action={closeTicketAction}>
              <input type="hidden" name="id" value={id} />
              {isOpen ? (
                <SubmitButton className="button button--quiet">{t.close}</SubmitButton>
              ) : (
                <><input type="hidden" name="reopen" value="1" /><SubmitButton className="button button--quiet">{t.reopen}</SubmitButton></>
              )}
            </form>
          </section>

          {sources.length > 0 && (
            <section className="card detail-block">
              <h2 className="detail-block-title">{t.draftSources}</h2>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {sources.map((s, i) => (
                  <li key={i}>
                    {/* Živý zdroj (ADR-029) nie je v knižnici — odkaz by viedol na 404. */}
                    {s.documentId && !s.live ? <Link href={`/documents/${encodeURIComponent(s.documentId)}`}>{s.title ?? s.documentId}</Link> : s.title}
                    {s.articleRef ? ` (${s.articleRef})` : ""}{s.sourceType === "qa" ? " · FAQ" : ""}
                    {s.live ? ` · ${s.live.connectorName}${s.live.group ? ` (${s.live.group})` : ""}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(ticket.sentAnswer || ticket.draft) && (
            <section className="card detail-block" id="faq">
              <h2 className="detail-block-title">{t.toFaq}</h2>
              <p className="detail-block-note" style={{ margin: 0 }}>{t.toFaqIntro}</p>
              {faqDocs.length === 0 ? (
                <p className="quiet" style={{ margin: 0 }}>{t.noFaqDocuments}</p>
              ) : (
                <form action={ticketToFaqAction} style={{ display: "grid", gap: 10 }}>
                  <input type="hidden" name="id" value={id} />
                  <div className="field">
                    <span className="field-label">{t.toFaqDocument}</span>
                    <Select language={language} name="documentId" fieldLabel={t.toFaqDocument} options={faqDocs} initial={faqDocs[0].value} />
                  </div>
                  <label className="field">
                    <span className="field-label">{dictionary(language).library.faq.question}</span>
                    <input className="field-input" name="question" required defaultValue={prefill.question} />
                  </label>
                  <label className="field">
                    <span className="field-label">{dictionary(language).library.faq.variants}</span>
                    <textarea className="field-input" name="variants" rows={2} />
                  </label>
                  <label className="field">
                    <span className="field-label">{dictionary(language).library.faq.answer}</span>
                    <textarea className="field-input" name="answer" rows={6} required defaultValue={prefill.answer} />
                  </label>
                  <label className="field">
                    <span className="field-label">{dictionary(language).library.faq.audience}</span>
                    <input className="field-input" name="audience" defaultValue={ticket.asker.roles.join(", ")} />
                  </label>
                  <div><SubmitButton className="button button--quiet">{t.toFaqSubmit}</SubmitButton></div>
                </form>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
    </AppShell>
  )
}
