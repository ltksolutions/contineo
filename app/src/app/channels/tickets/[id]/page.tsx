/**
 * /channels/tickets/[id] — ticket (ADR-028 krok 4; pod Kanálmi od D170,
 * predtým `/helpdesk/[id]`). Len riešiteľ kanála ticketu — správca nie (D170).
 *
 * Vľavo posledná prijatá správa, pod ňou odpoveď a pod tou história vlákna
 * od najstaršej správy (Ján 29. 10. 2026); vpravo (od 1024 px)
 * kto rieši, zdroje návrhu a „Pridať do FAQ". Všetko sú formuláre — bez
 * JavaScriptu to funguje rovnako. Jediné plné tlačidlo na obrazovke je
 * **Odoslať odpoveď** (CLAUDE.md: najviac jedno plné).
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import FormattedText from "@/components/FormattedText"
import SubmitButton from "@/components/SubmitButton"
import { helpdeskContext } from "@/lib/helpdeskAgents"
import { ticketById, OPEN_STATES } from "@/lib/tickets"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate } from "@/lib/i18n"
import { calendarDate, SEARCH_TIME_ZONE } from "@/lib/versionContext"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { loadPersonById } from "@/lib/people"
import { takeTicketAction, draftWithAiAction, saveDraftAction, sendAnswerAction, closeTicketAction, importThreadAction } from "../actions"

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
  const assignee = ticket.assigneeId ? await loadPersonById(ctx.tenant.companyCode, ticket.assigneeId).catch(() => null) : null
  const draftText = ticket.draft?.text ?? ""
  type Message = (typeof ticket.messages)[number]
  // Dátum aj čas v pásme organizácie (Ján 29. 10. 2026) — pri správe
  // a odpovedi v ten istý deň rozhoduje čas, ktorá bola skôr a ako dlho
  // pýtajúci čakal. `formatDate` počíta deň v UTC, preto `calendarDate`.
  const when = (at: Date) => {
    const d = new Date(at)
    const time = d.toLocaleTimeString(language === "en" ? "en-GB" : language, { timeZone: SEARCH_TIME_ZONE, hour: "2-digit", minute: "2-digit" })
    return `${formatDate(calendarDate(d), language)} ${time}`
  }
  const who = (m: Message) =>
    m.direction === "out" ? t.fromHelpdesk : t.fromAsker(m.from?.name ?? m.from?.address ?? ticket.asker.name ?? "")
  // Začiatok celého textu, nie prvý riadok — ten býva len „Dobrý deň,".
  const preview = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 200)
  // Správa, na ktorú sa odpovedá, je nad odpoveďou; história pod ňou ide od
  // najstaršej, aby sa čítala ako rozhovor otázka → odpoveď (Ján 29. 10. 2026,
  // predtým od najnovšej podľa 7. 10.). `messages` je uložené od najstaršej.
  const messages = ticket.messages
  const lastIn = [...messages].reverse().find(m => m.direction === "in") ?? null
  const showHistory = messages.length > 1 || (messages.length === 1 && !lastIn) || (ticket.source === "email" && Boolean(ticket.threadRef))
  const meta = (m: Message) => (
    <>
      {m.direction === "out" ? <b>{t.msgOut}</b> : <><b>{who(m)}</b> · {t.msgIn}</>}
      {" · "}{when(m.at)}{m.attachments.length > 0 && <> · {t.attachments(m.attachments.length)}</>}
    </>
  )
  const body = (m: Message) => (
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
  const cls = (m: Message) => `thread-msg${m.direction === "out" ? " thread-msg--out" : ""}`
  // Formulár odpovede len kým ticket čaká na helpdesk (Ján 29. 10. 2026):
  // po odoslaní ostáva odoslaný text, nie ďalšie „Odoslať odpoveď". Nová
  // správa pýtajúceho alebo „Znovu otvoriť" formulár vráti.
  const isOpen = OPEN_STATES.includes(ticket.state)
  const canSend = isOpen && Boolean(channel?.mailbox) && (ticket.asker.email || ticket.messages.some(m => m.direction === "in"))
  // Údaje z vydávajúceho systému (ADR-042, D276, D280): účet a kam ide
  // odpoveď zvlášť — píše často rodič alebo manažér za hráča.
  const a = ticket.asker
  const issuerHost = a.issuer ? (() => { try { return new URL(a.issuer).hostname } catch { return a.issuer } })() : null
  const issuerRows: [string, React.ReactNode][] = ticket.source === "chat" ? [
    [t.issuerAccount, [a.name, a.reference ? `(${a.reference})` : ""].filter(Boolean).join(" ")],
    [t.issuerReplyTo, a.email ?? ""],
    [t.issuerPhone, a.phone ?? ""],
    [t.issuerRoles, a.roles.join(", ")],
    [t.issuerClub, a.club ?? ""],
    ...(a.context ?? []).map(c => [c.label, c.value] as [string, string]),
    [t.issuerPage, a.page ? <a href={a.page} target="_blank" rel="noopener noreferrer">{a.page}</a> : ""],
  ].filter(([, v]) => Boolean(v)) as [string, React.ReactNode][] : []
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
        {ticket.forwardedBy ? ` · ${t.forwardedBy(ticket.forwardedBy.name ?? ticket.forwardedBy.address)}` : ""}
        {" · "}{channel?.name ?? ticket.channelKey} · {t.source[ticket.source]}
        {" · "}{ticket.assigneeId ? t.assignedTo(assignee?.fullName ?? ticket.assigneeId) : t.unassigned}
      </p>
      <Notice message={msg} error={error === "1"} back={base} language={language} />

      <div className="detail-grid">
        <div className="detail-main">
          {lastIn && (
            <section className="card detail-block" id="last-message">
              <h2 className="detail-block-title">{t.lastIncoming}</h2>
              <article className={cls(lastIn)}>
                <p className="quiet thread-msg-head">{meta(lastIn)}</p>
                {body(lastIn)}
              </article>
            </section>
          )}

          <section className="card detail-block" id="answer">
            <h2 className="detail-block-title">{t.draftHeading}</h2>
            <p className="detail-block-note" style={{ margin: 0 }}>{t.draftIntro}</p>
            {ticket.sentAnswer && (
              <p className="quiet" style={{ margin: 0 }}>
                {t.sent(ticket.sentAnswer.by, when(ticket.sentAnswer.at))}
                {ticket.draft && <> · {ticket.draft.text === ticket.sentAnswer.text ? t.sentUnchanged : t.sentEdited}</>}
              </p>
            )}
            {isOpen && (
              <form action={draftWithAiAction} style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton className="button button--quiet">{t.draftFromAi}</SubmitButton>
                {ticket.draft ? <span className="quiet">{t.draftMeta(ticket.draft.model, when(ticket.draft.at))}</span> : <span className="quiet">{t.noDraft}</span>}
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

          {showHistory && (
            <section className="card detail-block" id="history">
              <h2 className="detail-block-title">{t.thread}</h2>
              {messages.length > 1 && (
                <p className="quiet thread-summary">{t.threadSummary(messages.length, who(messages[messages.length - 1]), when(messages[messages.length - 1].at))}</p>
              )}
              {messages.map((m, i) => m === lastIn ? (
                // Je celá nad odpoveďou — tu len riadok, aby história ostala úplná.
                <details key={`${m.providerId}-${i}`} className={cls(m)}>
                  <summary className="quiet"><span className="thread-msg-meta">{meta(m)}</span><span className="thread-msg-preview">· {preview(m.text)}</span></summary>
                  {body(m)}
                </details>
              ) : (
                <article key={`${m.providerId}-${i}`} className={cls(m)}>
                  <p className="quiet thread-msg-head">{meta(m)}</p>
                  {body(m)}
                </article>
              ))}
              {ticket.source === "email" && ticket.threadRef && (
                <form action={importThreadAction} style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <input type="hidden" name="id" value={id} />
                  <SubmitButton className="button button--quiet">{t.threadImport}</SubmitButton>
                  <span className="quiet field-hint">{t.threadImportHint}</span>
                </form>
              )}
            </section>
          )}
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
            {ticket.state !== "closed" && (
              <form action={closeTicketAction}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton className="button button--quiet">{t.close}</SubmitButton>
              </form>
            )}
            {/* Odpovedaný aj zavretý sa dá otvoriť znova — napríklad na doplnenie odpovede. */}
            {!isOpen && (
              <form action={closeTicketAction}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="reopen" value="1" />
                <SubmitButton className="button button--quiet">{t.reopen}</SubmitButton>
              </form>
            )}
          </section>

          {issuerRows.length > 0 && (
            <section className="card detail-block">
              <h2 className="detail-block-title">{issuerHost ? t.issuerHeading(issuerHost) : channel?.name ?? ticket.channelKey}</h2>
              <dl className="facts">
                {issuerRows.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </section>
          )}

          {sources.length > 0 && (
            <section className="card detail-block">
              <h2 className="detail-block-title">{t.draftSources}</h2>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {sources.map((s, i) => (
                  <li key={i}>
                    {/* Živý zdroj (ADR-029) nie je v knižnici — odkaz by viedol na 404. */}
                    {s.documentId && !s.live ? <Link href={`/documents/${encodeURIComponent(s.documentId)}`}>{s.title ?? s.documentId}</Link> : s.title}
                    {s.articleRef ? ` (${s.articleRef})` : ""}
                    {s.live ? ` · ${s.live.connectorName}${s.live.group ? ` (${s.live.group})` : ""}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

        </aside>
      </div>
    </div>
    </AppShell>
  )
}
