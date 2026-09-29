/**
 * Úvod testu (rám TEST-ATTEMPT, stav „úvod"): názov, inštrukcie, fakty,
 * pravidlá a „Spustiť test". Otvorený pokus rovno pokračuje (Q2 ✅);
 * pri pauze alebo vyčerpaných pokusoch vypnuté tlačidlo s vetou.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { loadTestContext } from "@/lib/testPage"
import { resumeIndex } from "@/lib/testAttempts"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import SubmitButton from "@/components/SubmitButton"
import FormattedText from "@/components/FormattedText"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"
import { getAttempt } from "@/lib/testAttemptsDb"
import { startAttemptAction } from "../../../../actions"

export const dynamic = "force-dynamic"

export default async function TestIntroPage({ params, searchParams }: {
  params: Promise<{ courseKey: string; partKey: string; testKey: string }>
  searchParams: Promise<RawQuery>
}) {
  const q = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const c = await loadTestContext(await params)
  if (c.state === "not-signed-in") redirect("/sign-in")
  if (c.state === "back") redirect(c.to)
  if (c.state !== "ready") notFound()
  const { row, base, partHref, language } = c
  const ta = dictionary(language).learning.attempt
  const av = row.availability
  if (av.open) {
    const open = await getAttempt(c.companyCode, av.open.id)
    redirect(`${base}/${av.open.id}?q=${open ? resumeIndex(open) + 1 : 1}`)
  }
  const rules = row.rules!
  const time = (d: Date) => d.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })
  const blocked = av.reason === "passed" ? ta.blockedPassed
    : av.reason === "pause" && av.nextAt ? ta.blockedPause(time(av.nextAt))
    : av.reason === "exhausted" ? ta.blockedExhausted(av.used, (row.test?.responsible ?? []).map(r => r.fullName).join(", "))
    : null

  return (
    <AppShell language={language} trail={c.trail}>
      <div className="at">
        <p className="detail-back"><Link className="quiet" href={partHref}>← {ta.backToPart}</Link></p>
        <Notice message={q.msg} error={q.error === "1"} back={base} />
        <section className="card at-intro">
          <h1 className="page-title">{row.test?.title ?? row.testKey}</h1>
          {row.test?.instructions && <div className="cp-desc"><FormattedText text={row.test.instructions} /></div>}
          <dl className="at-facts">
            <div><dt>{ta.factQuestions}</dt><dd>{row.questionCount}</dd></div>
            <div><dt>{ta.factToPass}</dt><dd>{rules.passingPercent} %</dd></div>
            <div><dt>{ta.factTime}</dt><dd>{rules.timeLimitMinutes ? ta.minutes(rules.timeLimitMinutes) : ta.noLimit}</dd></div>
            <div><dt>{ta.factAttempt}</dt><dd>{ta.attemptOf(av.used + 1, rules.maxAttempts)}</dd></div>
          </dl>
          <ul className="at-rules">
            <li>{ta.ruleDraw}</li>
            <li>{ta.ruleSave}</li>
            <li>{ta.ruleShow[rules.showAnswers]}</li>
          </ul>
          {row.last?.percent !== undefined && row.last.submittedAt && (
            <div className="lnote lnote--info"><span className="lnote-mark" aria-hidden="true">i</span><span className="lnote-text">{ta.previous(formatDate(row.last.submittedAt, language), row.last.percent, Boolean(row.last.passed))}</span></div>
          )}
          {blocked ? (
            <div className="at-act">
              <button type="button" className="button" disabled aria-disabled="true" aria-describedby="at-why">{ta.start}</button>
              <p id="at-why" className="quiet">{blocked}</p>
            </div>
          ) : (
            <form action={startAttemptAction} className="at-act">
              <input type="hidden" name="courseKey" value={c.courseKey} />
              <input type="hidden" name="partKey" value={c.partKey} />
              <input type="hidden" name="testKey" value={row.testKey} />
              {/* Jeden kľúč na zobrazenie — dvojklik vyrobí jeden pokus. */}
              <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
              <SubmitButton className="button">{ta.start}</SubmitButton>
            </form>
          )}
        </section>
      </div>
    </AppShell>
  )
}
