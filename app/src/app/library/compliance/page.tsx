/**
 * /library/compliance — kontroly súladu (ADR-032, D196; ADR-036 D234–D239;
 * návrh KNIZ-kontroly-a-kola, 20. 10. 2026). Rola `compliance`; kontroly sú
 * spoločné pre všetkých s rolou (Ján 11. 10. 2026).
 *
 * Jedna karta na **kontrolu** (zadanie), nie na beh — 20. 10. boli v zozname
 * štyri karty „Návrhy z helpdesku do manuálov — ISSF Helpdesk" a nebolo jasné,
 * ktorá platí. Poradie: požiadavky na kontrolu, „Na rozhodnutie" (posledné
 * kolo má nerozhodnuté nálezy, beží, je zastavené alebo zlyhalo), „Uzavreté".
 * Pevné väzby tu boli do 20. 10. 2026 — požiadavky sú len z hierarchie
 * (D241). Jediné plné tlačidlo je „Nová kontrola" v hlavičke.
 *
 * Ján 10. 10. 2026: „spravme kontrolu manuálov voči platným dokumentom… nech
 * vieme, že návody sú OK voči nadradeným normám".
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import SubmitButton from "@/components/SubmitButton"
import { complianceContext } from "@/lib/complianceAccess"
import { documentRuns, type ComplianceRun } from "@/lib/complianceCheck"
import { listChecks, latestRounds, checkForSubjects, roundsOf, type ComplianceCheck } from "@/lib/complianceChecks"
import { roundState, needsAttention, type RoundState } from "@/lib/complianceView"
import { getCollection } from "@/lib/mongodb"
import { PERSONS_COLLECTION, type Person } from "@/lib/persons"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dismissRequestAction } from "../complianceActions"
import { openRequests } from "@/lib/complianceRequests"

export const dynamic = "force-dynamic"

type T = ReturnType<typeof dictionary>["library"]["compliance"]

/** Ikona stavu — nesie ho aj tvar a slovo, nie len farba (návrh, tabuľka stavov). */
const ICON: Record<RoundState, { cls: string; mark: string }> = {
  open: { cls: "open", mark: "!" }, stopped: { cls: "open", mark: "!" }, running: { cls: "run", mark: "…" },
  failed: { cls: "bad", mark: "✕" }, done: { cls: "done", mark: "✓" },
}

function stateLine(t: T, run: ComplianceRun) {
  const s = roundState(run)
  const round = run.round ?? 1
  if (s.state === "running") return <>{t.ck.roundRunning(round, run.total - run.pending.length, run.total)}</>
  if (s.state === "failed") return <span className="bad-fg">{t.ck.roundFailed(round)}</span>
  if (s.state === "stopped") return <>{s.open > 0 && <><b>{t.ck.openCount(s.open)}</b> · </>}{t.ck.roundStopped(round)}</>
  if (s.state === "open") return <><b>{t.ck.openCount(s.open)}</b> {t.ck.ofFindings(s.total, round)}</>
  return <>{t.ck.allDecided(s.total)} · {t.ck.roundN(round)}</>
}

export default async function ComplianceChecksPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await complianceContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const q = normalizeQuery<{ msg?: string; error?: string; dismiss?: string }>(await searchParams)
  const language: UiLanguage = ctx.person.language
  const dict = dictionary(language)
  const t = dict.library.compliance
  const code = ctx.tenant.companyCode
  const branding = brandingView(ctx.tenant)
  const [checks, requests, legacy] = await Promise.all([
    listChecks(code), openRequests(code),
    // Behy spred D239 bez kontroly — od 20. 10. 2026 zrušené; nezrušený by sa inak stratil.
    documentRuns(code).then(rs => rs.filter(r => !r.checkId)),
  ])
  const latest = await latestRounds(code, checks.map(c => c.checkId))
  const people = [...new Set([...latest.values()].map(x => x.latest.startedBy))]
  const nameByEmail = new Map((await (await getCollection<Person>(PERSONS_COLLECTION))
    .find({ companyCode: code, email: { $in: people } }, { projection: { _id: 0, email: 1, fullName: 1 } }).toArray())
    .map(p => [p.email, p.fullName?.trim() || p.email]))
  const who = (email: string) => nameByEmail.get(email) ?? email
  const checkName = (c: ComplianceCheck) => c.name || t.runDefaultName(formatDate(c.createdAt, language))

  // Požiadavka spustí ďalšie kolo kontroly s tými istými dokumentmi (Q2); bez nej novú kontrolu.
  const requestRows = await Promise.all(requests.map(async r => {
    const check = await checkForSubjects(code, r.subjectIds)
    const rounds = check ? (await roundsOf(code, check.checkId)).length : 0
    return { r, check, rounds }
  }))
  const rows = checks.map(c => ({ c, info: latest.get(c.checkId) ?? null }))
  const attention = rows.filter(x => !x.info || needsAttention(roundState(x.info.latest).state))
  const done = rows.filter(x => x.info && !needsAttention(roundState(x.info.latest).state))
  const sortByLast = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    (b.info?.latest.startedAt.getTime() ?? 0) - (a.info?.latest.startedAt.getTime() ?? 0)

  const card = ({ c, info }: (typeof rows)[number]) => {
    const run = info?.latest ?? null
    const s = run ? roundState(run).state : "open"
    const icon = ICON[s]
    const helpdeskQuestions = run?.scope.kind === "documents" ? run.scope.helpdesk?.items.length ?? 0 : 0
    const subjects = run?.scope.kind === "documents" ? run.scope.subjectIds.length : c.subjectIds.length
    const scope = c.kind === "helpdesk"
      ? t.ck.scopeHelpdesk(helpdeskQuestions, c.channelName ?? "", subjects)
      : t.ck.scopeDocs(subjects, run?.documentIds.length ?? c.referenceIds.length)
    return (
      <Link key={c.checkId} className={`ck${needsAttention(s) ? " is-open" : " is-done"}`} href={`/library/compliance/${encodeURIComponent(c.checkId)}`}>
        <span className={`ck-ico ${icon.cls}`} aria-hidden="true">{icon.mark}</span>
        <span className="ck-t"><b>{checkName(c)}</b><span className="tag">{c.kind === "helpdesk" ? t.ck.kindHelpdesk : t.ck.kindDocuments}</span></span>
        <span className="ck-s">
          <span className="st">{run ? stateLine(t, run) : t.ck.notStarted}</span>
          <span>{[scope, info ? t.ck.rounds(info.count) : "", run ? t.ck.lastRound(formatDate(run.startedAt, language), who(run.startedBy)) : ""].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="ck-r" aria-hidden="true"><span className="ck-chev">›</span></span>
      </Link>
    )
  }

  const group = (title: string, note: string, list: typeof rows) => list.length > 0 && (
    <section className="grp">
      <div className="grp-h"><h2 className="detail-block-title">{title} <span className="quiet">{list.length}</span></h2>{note && <p>{note}</p>}</div>
      <div className="card ck-list">{[...list].sort(sortByLast).map(card)}</div>
    </section>
  )

  return (
    <AppShell language={language} title={t.heading}>
    <div className="detail-page ck-page" style={{ maxWidth: 1040, ...tenantStyle(branding) }}>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">{t.heading}</h1>
          <p className="quiet page-lead">{t.ck.introChecks}</p>
        </div>
        <div className="page-tools">
          <Link className="button" href="/library/compliance/new">{t.ck.newCheck}</Link>
        </div>
      </div>
      <Notice message={q.msg} error={q.error === "1"} back="/library/compliance" language={language} />

      {/* Požiadavky na kontrolu pri novom znení dokumentu v pevnej väzbe (D200). */}
      {requestRows.length > 0 && (
        <section className="grp" id="requests">
          <div className="grp-h"><h2 className="detail-block-title">{t.requestsHeading} <span className="quiet">{requestRows.length}</span></h2></div>
          {requestRows.map(({ r, check, rounds }) => (
            <div key={r.id} className="card task-card ck-req">
              <p style={{ margin: 0 }}><span className="tag tag--warn">{t.requestTag}</span> <b>{t.requestTitle(r.documentTitle, r.versionLabel)}</b></p>
              <p className="quiet" style={{ margin: 0 }}>
                {t.requestWhen(formatDate(r.publishedAt, language), r.publishedBy)}
                {check && <> · {t.ck.requestFor(checkName(check))}</>}
              </p>
              {r.subjectIds.length > 0 && <p style={{ margin: 0 }}><b>{t.subjects}:</b> {r.subjectTitles.join(", ")}</p>}
              <div className="task-acts">
                {r.subjectIds.length > 0 && (
                  <Link className="button button--quiet" href={check
                    ? `/library/compliance/confirm?check=${encodeURIComponent(check.checkId)}&requestId=${encodeURIComponent(r.id)}`
                    : `/library/compliance/confirm?${new URLSearchParams([["kind", "documents"], ["requestId", r.id], ["name", t.requestRunName(r.documentTitle, r.versionLabel)],
                        ...r.subjectIds.map(id => ["subjectIds", id]), ...r.referenceIds.map(id => ["documentIds", id])]).toString()}`}>
                    {check ? t.ck.requestStartRound(rounds + 1) : t.ck.requestStartNew}
                  </Link>
                )}
                {q.dismiss !== r.id && <Link href={`/library/compliance?dismiss=${encodeURIComponent(r.id)}#requests`}>{t.ck.requestDismissShort}</Link>}
              </div>
              {q.dismiss === r.id && (
                <form action={dismissRequestAction} className="ck-dismiss">
                  <input type="hidden" name="requestId" value={r.id} />
                  <label className="field" style={{ margin: 0 }}>
                    <span className="field-label">{t.reason}</span>
                    <textarea className="field-input" name="reason" rows={2} required maxLength={1000} placeholder={t.requestDismissPlaceholder} />
                  </label>
                  <div className="task-acts">
                    <SubmitButton className="button button--quiet">{t.requestDismissSave}</SubmitButton>
                    <Link href="/library/compliance#requests">{t.ck.cancel}</Link>
                  </div>
                </form>
              )}
            </div>
          ))}
        </section>
      )}

      {checks.length === 0 && requestRows.length === 0 && (
        <div className="card empty">
          <div className="empty-title">{t.ck.noneTitle}</div>
          <div className="empty-text">{t.ck.noneText}</div>
        </div>
      )}
      {group(t.ck.groupAttention, "", attention)}
      {group(t.ck.groupDone, "", done)}

      {legacy.length > 0 && (
        <section className="grp">
          <div className="grp-h"><h2 className="detail-block-title">{t.ck.groupLegacy}</h2><p>{t.ck.legacyNote}</p></div>
          <div className="card ck-list">
            {legacy.map(r => (
              <Link key={r.runId} className="ck is-done" href={`/library/compliance/${encodeURIComponent(r.runId)}`}>
                <span className="ck-ico done" aria-hidden="true">·</span>
                <span className="ck-t"><b>{r.name || t.runDefaultName(formatDate(r.startedAt, language))}</b></span>
                <span className="ck-s"><span>{formatDate(r.startedAt, language)}</span></span>
                <span className="ck-r" aria-hidden="true"><span className="ck-chev">›</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
    </AppShell>
  )
}
