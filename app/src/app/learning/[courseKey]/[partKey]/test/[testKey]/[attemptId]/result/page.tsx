/**
 * Výsledok pokusu (rám RESULT): skóre, prešiel/neprešiel, hranica, fakty,
 * akcie podľa dostupnosti ďalšieho pokusu (vypnuté tlačidlo má vždy vetu)
 * a prehľad otázok — len ak to `showAnswers` v tomto stave dovolí.
 * Obsah zo snímky pokusu (D120). Skóre vidí človek a zodpovedné osoby
 * testu, nie HR (D121).
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { loadTestContext } from "@/lib/testPage"
import { getAttempt } from "@/lib/testAttemptsDb"
import { progressFacts } from "@/lib/learningProgressDb"
import { evaluatePart } from "@/lib/learningProgress"
import { answersVisible, isCorrect, type AnswerValue, type QuestionSnapshot } from "@/lib/testAttempts"
import AppShell from "@/components/AppShell"
import FormattedText from "@/components/FormattedText"
import { normalizeLayout } from "@/lib/appNav"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"

export const dynamic = "force-dynamic"

type Ta = ReturnType<typeof dictionary>["learning"]["attempt"]

export default async function ResultPage({ params, searchParams }: {
  params: Promise<{ courseKey: string; partKey: string; testKey: string; attemptId: string }>
  searchParams: Promise<RawQuery>
}) {
  const q = normalizeQuery<{ layout?: string; only?: string }>(await searchParams)
  const p = await params
  const c = await loadTestContext(p)
  if (c.state === "not-signed-in") redirect("/sign-in")
  if (c.state === "back") redirect(c.to)
  if (c.state !== "ready") notFound()
  const a = await getAttempt(c.companyCode, decodeURIComponent(p.attemptId))
  if (!a || a.personId !== c.personId || a.testKey !== c.row.testKey || a.context.enrollmentId !== c.enrollment.id) notFound()
  if (!a.submittedAt) redirect(`${c.base}/${a.id}`)

  const language = c.language
  const ta = dictionary(language).learning.attempt
  const av = c.row.availability
  const rules = c.row.rules!
  const passed = Boolean(a.passed)
  const exhausted = av.reason === "exhausted"
  const visible = answersVisible(a.showAnswers, passed, exhausted)
  const percent = a.percent ?? 0
  const time = (d: Date) => d.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })
  const partDone = passed && evaluatePart(c.part, await progressFacts(c.companyCode, c.enrollment.id)).done
  const names = (c.row.test?.responsible ?? []).map(r => r.fullName).join(", ")
  const results = a.questions.map(x => isCorrect(x, a.answers[x.questionKey]))
  const wrong = results.filter(r => !r).length
  const durationSec = Math.max(0, Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 1000))
  const why = passed ? null
    : av.canStart ? ta.retryNote
    : av.reason === "pause" && av.nextAt ? ta.blockedPause(time(av.nextAt))
    : exhausted ? ta.blockedExhausted(av.used, names) : null
  const shown = a.questions.map((x, i) => ({ x, i, ok: results[i] })).filter(r => q.only !== "wrong" || !r.ok)

  return (
    <AppShell layout={normalizeLayout(q.layout)} language={language}>
      <div className="at rs">
        <p className="detail-back"><Link className="quiet" href={c.partHref}>← {ta.backToPart}</Link></p>
        <div className="rs-cols">
          <div className="rs-main">
            <section className="card rs-card">
              <p className="quiet rs-kicker">{ta.kicker(c.row.test?.title ?? a.testKey, a.attemptNumber, rules.maxAttempts, `${formatDate(a.submittedAt, language)} ${time(a.submittedAt)}`)}</p>
              {passed
                ? <div className="lnote"><span className="lnote-mark" aria-hidden="true">✓</span><span className="lnote-text">{ta.passedNotice}{partDone && <> {ta.partDoneNotice(c.part.title)}</>}</span></div>
                : <div className="lnote lnote--bad"><span className="lnote-mark" aria-hidden="true">!</span><span className="lnote-text">{ta.failedNotice(Math.max(0, a.passingPercent - percent), a.passingPercent)}</span></div>}
              <div className="rs-score">
                <b className={passed ? "ok-fg" : "rs-bad"}>{percent} %</b>
                <span>{ta.points(a.points ?? 0, a.maxPoints ?? 0)} · {passed ? ta.passedWord : ta.failedWord}</span>
              </div>
              <div className="rs-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} className={passed ? "is-ok" : "is-bad"} /><i style={{ left: `${a.passingPercent}%` }} /></div>
              <p className="quiet mc-note">{ta.passMark(a.passingPercent)}</p>
              <dl className="at-facts">
                <div><dt>{ta.factPassing}</dt><dd>{a.passingPercent} %</dd></div>
                <div><dt>{ta.factDuration}</dt><dd>{ta.duration(durationSec)}</dd></div>
                <div><dt>{ta.factRemaining}</dt><dd>{av.remaining ?? ta.unlimited}</dd></div>
                <div><dt>{ta.factNext}</dt><dd>{passed ? "—" : av.canStart ? ta.now : av.nextAt ? time(av.nextAt) : "—"}</dd></div>
              </dl>
              <div className="rs-act">
                {passed ? (
                  <>
                    <Link className="button" href={c.partHref}>{ta.backToPart}</Link>
                    <Link className="button button--quiet" href={`/learning/${c.courseKey}`}>{ta.toCourse}</Link>
                  </>
                ) : (
                  <>
                    {av.canStart
                      ? <Link className="button" href={c.base}>{ta.retry}</Link>
                      : <button type="button" className="button" disabled aria-disabled="true" aria-describedby="rs-why">{ta.retry}</button>}
                    <Link className="button button--quiet" href={c.partHref}>{ta.backToPart}</Link>
                  </>
                )}
              </div>
              {why && <p id="rs-why" className="quiet">{why}</p>}
            </section>

            {a.detailsPurgedAt ? (
              // ADR-021, D131: podrobnosti po roku preč, výsledok hore zostáva.
              <section className="card rs-hidden">
                <h2 className="mc-h2">{ta.reviewTitle}</h2>
                <p className="quiet">{ta.detailsPurged}</p>
              </section>
            ) : visible ? (
              <section className="card mc-list">
                <div className="parts-head"><h2>{ta.reviewTitle}</h2>
                  <span className="lpills" style={{ margin: 0 }}>
                    <Link className={`pill${q.only !== "wrong" ? " is-on" : ""}`} href="?">{ta.filterAll}</Link>
                    <Link className={`pill${q.only === "wrong" ? " is-on" : ""}`} href="?only=wrong">{ta.filterWrong} <span className="pill-count">{wrong}</span></Link>
                  </span>
                </div>
                {shown.map(({ x, i, ok }) => <ReviewRow key={x.questionKey} q={x} n={i + 1} total={a.questions.length} ok={ok} answer={a.answers[x.questionKey]} ta={ta} />)}
              </section>
            ) : (
              <section className="card rs-hidden">
                <h2 className="mc-h2">{ta.hidden}</h2>
                <p className="quiet">{ta.hiddenReason[a.showAnswers]} {ta.wrongCount(wrong)}</p>
              </section>
            )}
          </div>
          <aside className="rs-side">
            <section className="card mc-list">
              <div className="parts-head"><h2>{ta.attemptsSide}</h2></div>
              {c.row.attempts.filter(x => x.submittedAt).map(x => (
                <div key={x.id} className="mc-row"><span className="mc-row-main">{formatDate(x.submittedAt!, language)} · {x.percent ?? 0} %</span>
                  <span className={x.passed ? "tag tag--published" : "tag"}>{x.passed ? ta.passedWord : ta.failedWord}</span></div>
              ))}
            </section>
            <section className="card rs-who"><h2 className="mc-h2">{ta.whoSees}</h2><p className="quiet">{ta.whoSeesText(names)}</p></section>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}

function answerText(q: QuestionSnapshot, v: AnswerValue | undefined, ta: Ta): string {
  if (!v) return ta.noAnswer
  if (v.kind === "choice") return q.answers.filter(x => v.ids.includes(x.id)).map(x => x.text ?? (x.media?.kind === "image" ? x.media.alt : "")).join(", ") || ta.noAnswer
  if (v.kind === "bool") return v.value ? ta.trueLabel : ta.falseLabel
  return v.value || ta.noAnswer
}

function correctText(q: QuestionSnapshot, ta: Ta): string {
  if (q.type === "true_false") return q.correctTrue ? ta.trueLabel : ta.falseLabel
  if (q.type === "short_text") return (q.expected ?? []).join(" / ")
  return q.answers.filter(x => x.correct).map(x => x.text ?? (x.media?.kind === "image" ? x.media.alt : "")).join(", ")
}

function ReviewRow({ q, n, total, ok, answer, ta }: { q: QuestionSnapshot; n: number; total: number; ok: boolean; answer: AnswerValue | undefined; ta: Ta }) {
  const none = !answer || (answer.kind === "choice" && answer.ids.length === 0) || (answer.kind === "text" && !answer.value.trim())
  return (
    <div className="ri">
      <span className={`ri-mark ${none ? "is-warn" : ok ? "is-ok" : "is-bad"}`} aria-hidden="true">{none ? "!" : ok ? "✓" : "✕"}</span>
      <div className="ri-main">
        <p className="quiet ri-head">{ta.questionHead(n, total, q.weight)}{q.type === "multiple" ? ` · ${ta.multipleShort}` : ""}</p>
        {q.text && <div className="ri-text"><FormattedText text={q.text} /></div>}
        <p className="ri-line"><span className="quiet">{ta.yourAnswer}:</span> <span className={ok || none ? "" : "ri-wrong"}>{answerText(q, answer, ta)}</span></p>
        {!ok && <p className="ri-line"><span className="quiet">{ta.correctAnswer}:</span> <span className="ok-fg">{correctText(q, ta)}</span></p>}
        {q.explanation && <div className="ri-expl"><FormattedText text={q.explanation} /></div>}
      </div>
    </div>
  )
}
