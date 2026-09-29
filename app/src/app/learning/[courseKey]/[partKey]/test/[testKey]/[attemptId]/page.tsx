/**
 * Priebeh pokusu (rám TEST-ATTEMPT): jedna otázka na obrazovku, lišta
 * s odpočtom a ukladaním, Späť / Ďalej / Prehľad, prehľad odpovedí
 * a potvrdenie odovzdania. Obsah **len zo snímky pokusu** (D120).
 *
 * Bez JavaScriptu: každý posun je odoslanie formulára (uloží odpoveď);
 * namiesto odpočtu veta s časom, do kedy odovzdať.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { loadTestContext } from "@/lib/testPage"
import { getAttempt } from "@/lib/testAttemptsDb"
import { isAnswered, resumeIndex, type QuestionSnapshot, type TestAttempt } from "@/lib/testAttempts"
import AppShell from "@/components/AppShell"
import AttemptBar from "@/components/AttemptBar"
import FormattedText from "@/components/FormattedText"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary } from "@/lib/i18n"
import { answerAction } from "../../../../../actions"

export const dynamic = "force-dynamic"

type Ta = ReturnType<typeof dictionary>["learning"]["attempt"]
const media = (id: string) => `/api/learning/media/${encodeURIComponent(id)}`

export default async function AttemptPage({ params, searchParams }: {
  params: Promise<{ courseKey: string; partKey: string; testKey: string; attemptId: string }>
  searchParams: Promise<RawQuery>
}) {
  const q = normalizeQuery<{ q?: string; review?: string; confirm?: string }>(await searchParams)
  const p = await params
  const c = await loadTestContext(p)
  if (c.state === "not-signed-in") redirect("/sign-in")
  if (c.state === "back") redirect(c.to)
  if (c.state !== "ready") notFound()
  const attempt = await getAttempt(c.companyCode, decodeURIComponent(p.attemptId))
  if (!attempt || attempt.personId !== c.personId || attempt.testKey !== c.row.testKey || attempt.context.enrollmentId !== c.enrollment.id) notFound()
  const self = `${c.base}/${attempt.id}`
  const language = c.language
  const ta = dictionary(language).learning.attempt

  if (attempt.submittedAt) {
    if (attempt.closedBy !== "timeout") redirect(`${self}/result`)
    return (
      <AppShell language={language}>
        <div className="at">
          <section className="card at-closed is-warn">
            <span className="at-closed-ico" aria-hidden="true">!</span>
            <p>{ta.timeUp}</p>
            <Link className="button" href={`${self}/result`}>{ta.showResult}</Link>
          </section>
        </div>
      </AppShell>
    )
  }

  const total = attempt.questions.length
  const answered = attempt.questions.filter(x => isAnswered(attempt.answers[x.questionKey])).length
  const index = Math.min(total - 1, Math.max(0, (Number(q.q) || resumeIndex(attempt) + 1) - 1))
  const hidden = { courseKey: c.courseKey, partKey: c.partKey, testKey: c.row.testKey, attemptId: attempt.id }
  const time = (d: Date) => d.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })
  const unanswered = attempt.questions.map((x, i) => (isAnswered(attempt.answers[x.questionKey]) ? 0 : i + 1)).filter(Boolean)

  return (
    <AppShell language={language}>
      <div className="at">
        <AttemptBar deadlineAt={attempt.deadlineAt ? attempt.deadlineAt.toISOString() : null} formId="attempt-form" saveUrl={`/api/learning/attempts/${attempt.id}`}
          progress={total ? answered / total : 0}
          labels={{ position: q.review ? ta.reviewHeading : ta.questionOf(index + 1, total), remaining: ta.remaining("{t}"), saving: ta.saving, saved: ta.saved("{t}"), failed: ta.saveFailed }} />
        {attempt.deadlineAt && <noscript><p className="lnote lnote--info"><span className="lnote-text">{ta.noscriptDeadline(time(attempt.startedAt), time(attempt.deadlineAt))}</span></p></noscript>}

        {q.review ? (
          <section className="card at-review">
            <h1 className="mc-h2">{ta.reviewHeading}</h1>
            <ol className="at-review-list">
              {attempt.questions.map((x, i) => {
                const done = isAnswered(attempt.answers[x.questionKey])
                return (
                  <li key={x.questionKey} className={done ? "" : "is-open"}>
                    <Link href={`${self}?q=${i + 1}`}>{i + 1}. {(x.text ?? "").slice(0, 90) || "—"}</Link>
                    <span className="quiet">{done ? ta.answered : ta.unanswered}</span>
                  </li>
                )
              })}
            </ol>
            {q.confirm ? (
              <form action={answerAction} className="at-confirm">
                <Hidden values={{ ...hidden, index: "0", go: "submit" }} />
                <h2>{ta.confirmTitle}</h2>
                <p>{unanswered.length ? ta.confirmText(unanswered.length, unanswered.join(", ")) : ta.confirmAll}</p>
                <div className="mg-actions"><button type="submit" className="button">{ta.submit}</button><Link className="button button--quiet" href={`${self}?q=1`}>{ta.cancelReview}</Link></div>
              </form>
            ) : (
              <form action={answerAction} className="mg-actions">
                <Hidden values={{ ...hidden, index: "0", go: "confirm" }} />
                <button type="submit" className="button">{ta.submit}</button>
              </form>
            )}
          </section>
        ) : (
          <div className="at-cols">
            <form id="attempt-form" action={answerAction} className="card at-q">
              <Hidden values={{ ...hidden, index: String(index), hasAnswer: "1" }} />
              {/* Enter v krátkom texte = „Ďalej". */}
              <button type="submit" name="go" value="next" hidden tabIndex={-1} aria-hidden="true" />
              <QuestionView q={attempt.questions[index]} n={index + 1} total={total} attempt={attempt} ta={ta} />
              <div className="at-nav">
                <button type="submit" name="go" value="prev" className="button button--quiet" disabled={index === 0}>{ta.prev}</button>
                <button type="submit" name="go" value="review" className="button button--quiet">{unanswered.length ? ta.reviewUnanswered(unanswered.length) : ta.review}</button>
                <button type="submit" name="go" value="next" className="button">{ta.next}</button>
              </div>
              <nav className="at-grid" aria-label={ta.review}>
                {attempt.questions.map((x, i) => (
                  <button key={x.questionKey} type="submit" name="go" value={`q:${i}`}
                    className={`at-cell${i === index ? " is-current" : ""}${isAnswered(attempt.answers[x.questionKey]) ? " is-done" : ""}`}>{i + 1}</button>
                ))}
              </nav>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function Hidden({ values }: { values: Record<string, string> }) {
  return <>{Object.entries(values).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}</>
}

function QuestionView({ q, n, total, attempt, ta }: { q: QuestionSnapshot; n: number; total: number; attempt: TestAttempt; ta: Ta }) {
  const saved = attempt.answers[q.questionKey]
  const chosen = new Set(saved?.kind === "choice" ? saved.ids : [])
  const withMedia = q.answers.some(a => a.media)
  return (
    <>
      <p className="at-qhead quiet">{ta.questionHead(n, total, q.weight)}</p>
      {q.type === "multiple" && <p className="at-multi"><span aria-hidden="true">☑</span> {ta.multipleNote}</p>}
      {q.media.map((m, i) => m.kind === "image"
        // eslint-disable-next-line @next/next/no-img-element -- súbor zo snímky za prístupovou kontrolou
        ? <img key={i} className="at-media" src={media(m.fileId)} alt={m.alt} />
        : m.source.kind === "internal"
          ? <div key={i} className="at-video"><video src={media(m.source.assetId)} controls preload="metadata" /><p className="quiet mc-note">{ta.videoNote}</p></div>
          : null)}
      {q.text && <div className="at-text"><FormattedText text={q.text} /></div>}
      {(q.type === "single" || q.type === "multiple") && (
        <div className={`at-opts${withMedia ? " at-opts--tiles" : ""}`}>
          {q.answers.map(a => (
            <label key={a.id} className="opt">
              <input type={q.type === "single" ? "radio" : "checkbox"} name="a" value={a.id} defaultChecked={chosen.has(a.id)} />
              {a.media?.kind === "image" && (
                // eslint-disable-next-line @next/next/no-img-element -- ako vyššie
                <img src={media(a.media.fileId)} alt={a.media.alt} />
              )}
              <span>{a.text}</span>
            </label>
          ))}
        </div>
      )}
      {q.type === "true_false" && (
        <div className="tf2">
          <label className="opt"><input type="radio" name="a" value="true" defaultChecked={saved?.kind === "bool" && saved.value} /> {ta.trueLabel}</label>
          <label className="opt"><input type="radio" name="a" value="false" defaultChecked={saved?.kind === "bool" && !saved.value} /> {ta.falseLabel}</label>
        </div>
      )}
      {q.type === "short_text" && (
        <label className="field">
          <span className="field-label">{ta.answerLabel}</span>
          <input className="field-input at-short" name="a" defaultValue={saved?.kind === "text" ? saved.value : ""} autoComplete="off" />
          <span className="quiet field-hint">{ta.shortNote}</span>
        </label>
      )}
    </>
  )
}
