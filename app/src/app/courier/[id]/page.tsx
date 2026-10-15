/**
 * Vlákno Kuriéra (ADR-033) — správy najstaršie hore, odpoveď dole.
 *
 * Otvorenie vlákna je zároveň **prečítanie**: zapíše sa `lastReadAt` a vlákno
 * vypadne z neprečítaných. Je to jediný zápis, ktorý robí `GET` — a je to
 * to, čo človek od otvorenia správy čaká; „označiť ako prečítané" tlačidlom
 * by bola práca navyše pri každej správe.
 *
 * Text správy ide cez `FormattedText` (D208): ľahký Markdown, len vnútorné
 * odkazy, nikdy HTML. „Prečítané" pri 1:1 je z `lastReadAt` druhej strany
 * (D206) — pri ozname ostáva len počet, ten je na zozname.
 */

import RichTextField from "@/components/RichTextField"
import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import FormattedText from "@/components/FormattedText"
import SubmitButton from "@/components/SubmitButton"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import Link from "next/link"
import { loadThread, threadMessages, markThreadRead, participantsOf, readStats, TEXT_MAX } from "@/lib/courier"
import { dictionary } from "@/lib/i18n"
import { replyAction } from "../actions"
import CourierLive, { TypingSignal } from "@/components/CourierLive"
import { messageTime } from "../time"

export const dynamic = "force-dynamic"

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<RawQuery>
}) {
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()

  const { id } = await params
  const q = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const language = ctx.person.language
  const d = dictionary(language)
  const t = d.courier
  const branding = brandingView(ctx.tenant)
  const me = ctx.person.id

  // Cudzie vlákno je „nie je" (D209) — ani správca nedostane iný výsledok.
  const thread = await loadThread(ctx.person.companyCode, id, me)
  if (!thread) notFound()
  const messages = await threadMessages(ctx.person.companyCode, id)
  await markThreadRead(ctx.person.companyCode, id, me)

  const others = participantsOf(thread).filter(p => p.personId !== me)
  const other = thread.kind === "direct" ? others[0] : null
  const isAuthor = thread.createdBy.personId === me
  // Oznam (D205): príjemca odpovedá súkromne autorovi, autor dopĺňa všetkým.
  const announcement = thread.kind === "announcement"
  const stats = announcement && isAuthor ? readStats(thread) : null
  const lastMine = [...messages].reverse().find(m => m.author.personId === me)
  const readByOther = other && lastMine && other.lastReadAt && other.lastReadAt.getTime() >= lastMine.at.getTime()
    ? other.lastReadAt
    : null

  return (
    <AppShell language={language} title={thread.subject} trail={{ "/courier": t.title }}>
      <div style={{ maxWidth: 820, ...tenantStyle(branding) }}>
        <Notice language={language} message={q.msg} error={q.error === "1"} back={`/courier/${encodeURIComponent(id)}`} />

        <div className="page-head">
          <h1 className="page-title">{thread.subject}</h1>
          {announcement && <span className="tag tag--new">{t.announcement}</span>}
          {stats && <span className="tag tag--review">{t.readStats(stats.read, stats.total)}</span>}
        </div>
        <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "0 0 18px" }}>
          {thread.kind === "direct"
            ? other?.name
            : `${thread.createdBy.name} · ${t.recipients(thread.recipients)}`}
          {thread.parentThreadId && (
            <> · <Link href={`/courier/${encodeURIComponent(thread.parentThreadId)}`}>{t.inReplyTo}</Link></>
          )}
        </p>

        <section className="card" style={{ padding: "18px 20px", display: "grid", gap: 18 }}>
          {messages.map((m, i) => {
            const mine = m.author.personId === me
            return (
              <article key={String(m._id ?? i)} className={`thread-msg${mine ? " thread-msg--out" : ""}`}>
                <p className="quiet thread-msg-head">
                  <b>{mine ? t.you : m.author.name}</b> · {messageTime(m.at, language)}
                </p>
                <div style={{ lineHeight: 1.6, overflowWrap: "anywhere" }}>
                  <FormattedText text={m.text} />
                </div>
              </article>
            )
          })}
          {/* Živá vrstva (D210): nové správy, „píše…" a „prečítané" bez
              obnovenia. Bez JS ostáva riadok nižšie zo servera. */}
          <CourierLive
            threadId={id}
            me={me}
            since={messages.at(-1)?.at.toISOString() ?? thread.createdAt.toISOString()}
            language={language}
            direct={Boolean(other && lastMine)}
            initialReadAt={readByOther ? readByOther.toISOString() : null}
          />
          {other && lastMine && (
            <noscript>
              <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-small)", textAlign: "right" }}>
                {readByOther ? t.readAt(messageTime(readByOther, language)) : t.notReadYet}
              </p>
            </noscript>
          )}
        </section>

        {/* Odoslanie je plné tlačidlo na konci stránky — stlačí sa po
            prečítaní vlákna, nie v `.page-head` (R2). */}
        <form action={replyAction} className="card" style={{ marginTop: 16, padding: "18px 20px", display: "grid", gap: 12 }}>
          <input type="hidden" name="id" value={id} />
          {/* Editor „čo vidíš, to dostaneš" (KURIER-editor, 15. 10. 2026); do poľa
              `text` píše ten istý Markdown ako doteraz. `<div>`, nie `<label>` —
              klik do editora by inak presúval fokus na skryté pole. */}
          <div className="field field--required">
            <label className="field-label" id="courier-reply-label" htmlFor="courier-reply">
              {announcement ? (isAuthor ? t.followUp : t.replyPrivately(thread.createdBy.name)) : t.reply}
            </label>
            <RichTextField id="courier-reply" name="text" required rows={5} maxLength={TEXT_MAX} placeholder={t.replyPlaceholder} labels={t.editor} />
            {thread.kind === "direct" && <TypingSignal threadId={id} fieldId="courier-reply" />}
            <span className="quiet field-hint">
              {announcement && !isAuthor ? t.replyGoesTo(thread.createdBy.name) : t.textHint}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <SubmitButton className="button" pendingLabel={d.common.pending.sending}>{t.send}</SubmitButton>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
