/**
 * /learning/tests — testy a banka otázok (rám `docs/design/TESTS-testy-a-banka.md`).
 *
 * Záložky `?tab=tests | questions` pre rolu `learning-admin`. Výsledky
 * (`?tab=results`, len zodpovedná osoba testu, D121) pribudnú v ďalšom PR.
 *
 * - Testy: stav vrátane „Nedostatok otázok" (pripravený test, ktorému
 *   banka medzičasom nestačí), zodpovedné osoby, nový test.
 * - Banka: filter smart:tagov / typu / stavu v adrese, formulár otázky
 *   podľa typu (bez JS), import CSV v dvoch krokoch (TESTS Q1 ✅).
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { learningAdminContext } from "@/lib/learning"
import { listTests } from "@/lib/testsDb"
import { listQuestions, questionUsage } from "@/lib/questionsDb"
import { importQuestionsCsv, MAX_ANSWERS, QUESTION_TYPES, DIFFICULTIES, type Question, type QuestionType } from "@/lib/questions"
import { questionCount, type Test } from "@/lib/tests"
import { displayStatus } from "@/lib/testView"
import TestStatusTag from "@/components/TestStatusTag"
import Select from "@/components/Select"
import { filterFromQuery, matchesSmartFilter, tagId } from "@/lib/smartTags"
import { smartTagUsage } from "@/lib/smartTagsDb"
import { loadImport } from "@/lib/questionImports"
import { MAX_BYTES } from "@/lib/fileStore"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import TabLink from "@/components/TabLink"
import SubmitButton from "@/components/SubmitButton"
import KeyFromLabel from "@/components/KeyFromLabel"
import SmartTagInput from "@/components/SmartTagInput"
import CourseMediaUpload from "@/components/CourseMediaUpload"
import { normalizeLayout } from "@/lib/appNav"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { createTestAction, previewImportAction, questionStatusAction, runImportAction, saveQuestionAction } from "./actions"

export const dynamic = "force-dynamic"

type Q = {
  layout?: string; tab?: string; status?: string; new?: string; type?: string; q?: string; import?: string
  tag?: string | string[]; qtype?: string; qstatus?: string; msg?: string; error?: string
}
type Tt = ReturnType<typeof dictionary>["learning"]["tests"]

export default async function LearningTestsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const q = normalizeQuery<Q>(await searchParams)
  const ctx = await learningAdminContext()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()
  const language = ctx.person.language
  const tt = dictionary(language).learning.tests
  const tab = q.tab === "questions" ? "questions" : "tests"
  const [tests, bank] = await Promise.all([listTests(ctx.person.companyCode), listQuestions(ctx.person.companyCode)])
  const body = tab === "tests"
    ? <TestsTab tests={tests} bank={bank} q={q} tt={tt} />
    : await QuestionsTab({ companyCode: ctx.person.companyCode, actor: ctx.person.email, bank, q, tt, language })

  return (
    <AppShell layout={normalizeLayout(q.layout)} language={language}>
      <div className="mg" style={tenantStyle(brandingView(ctx.tenant))}>
        <div className="lp-head">
          <div className="grow"><h1 className="page-title">{dictionary(language).learning.testsHeading}</h1></div>
          {tab === "tests"
            ? <Link className="button" href="/learning/tests?tab=tests&new=1">{tt.newTest}</Link>
            : <span className="mg-actions"><Link className="button" href="/learning/tests?tab=questions&new=1">{tt.newQuestion}</Link><Link className="button button--quiet" href="/learning/tests?tab=questions&import=1">{tt.importCsv}</Link></span>}
        </div>
        <Notice message={q.msg} error={q.error === "1"} back={`/learning/tests?tab=${tab}`} />
        <nav className="tabs" aria-label={tt.tabsLabel}>
          <TabLink href="/learning/tests?tab=tests" active={tab === "tests"}>{tt.tabTests}</TabLink>
          <TabLink href="/learning/tests?tab=questions" active={tab === "questions"}>{tt.tabQuestions}</TabLink>
        </nav>
        <div className="mg-body">{body}</div>
      </div>
    </AppShell>
  )
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join("")
}

function TestsTab({ tests, bank, q, tt }: { tests: Test[]; bank: Question[]; q: Q; tt: Tt }) {
  const filters = ["all", "ready", "draft", "retired"] as const
  const status = (filters as readonly string[]).includes(q.status ?? "") ? q.status! : "all"
  const rows = tests.map(t => ({ t, s: displayStatus(t, bank) }))
  const inFilter = (s: string, f: string) => f === "all" || (f === "ready" ? s === "ready" || s === "short" : s === f)
  const shown = rows.filter(r => inFilter(r.s, status))
  const label = { all: tt.statusAll, ready: tt.statusReady, draft: tt.statusDraft, retired: tt.statusRetired }
  return (
    <>
      {q.new === "1" && (
        <section className="card mg-new">
          <h2>{tt.newTest}</h2>
          <form action={createTestAction} className="mg-form">
            <KeyFromLabel layout="fields" labelName="title" separator="-" usedKeys={tests.map(t => t.key)}
              labels={{ label: tt.testTitle, labelPlaceholder: "", key: tt.testKey, keyPlaceholder: "bezpecnost-vytah", taken: tt.keyTaken }} />
            <div className="mg-actions"><SubmitButton className="button">{tt.create}</SubmitButton><Link className="button button--quiet" href="/learning/tests">{tt.cancel}</Link></div>
          </form>
        </section>
      )}
      {tests.length === 0 ? (
        <div className="empty"><div className="empty-title">{tt.testsEmpty}</div><div className="empty-text">{tt.testsEmptyNote}</div></div>
      ) : (
        <>
          <div className="lpills">
            {filters.map(f => (
              <Link key={f} className={`pill${f === status ? " is-on" : ""}`} href={`/learning/tests?tab=tests${f === "all" ? "" : `&status=${f}`}`}>
                {label[f]} <span className="pill-count">{rows.filter(r => inFilter(r.s, f)).length}</span>
              </Link>
            ))}
          </div>
          <div className="doc-table-wrap mg-table">
            <table className="doc-table">
              <thead><tr><th>{tt.colTest}</th><th className="doc-col-right">{tt.colSections}</th><th className="doc-col-right">{tt.colQuestions}</th><th className="doc-col-right">{tt.colPassing}</th><th>{tt.colResponsible}</th><th>{tt.colStatus}</th><th /></tr></thead>
              <tbody>
                {shown.map(({ t, s }) => (
                  <tr key={t.key}>
                    <td><Link className="mg-title" href={`/learning/tests/${t.key}`}>{t.title}</Link><div className="mg-sub"><code>{t.key}</code></div></td>
                    <td className="doc-col-right">{t.sections.length}</td>
                    <td className="doc-col-right">{questionCount(t)}</td>
                    <td className="doc-col-right">{t.rules.passingPercent} %</td>
                    <td>{t.responsible.length ? <span className="av-row">{t.responsible.map(r => <span key={r.personId} className="av" title={r.fullName}>{initials(r.fullName)}</span>)}</span> : <span className="bad-fg">{tt.nobody}</span>}</td>
                    <td><TestStatusTag status={s} labels={tt} /></td>
                    <td><Link className="lc-link" href={`/learning/tests/${t.key}`}>{tt.edit}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mg-cards">
            {shown.map(({ t, s }) => (
              <Link key={t.key} className="card mg-card" href={`/learning/tests/${t.key}`}>
                <TestStatusTag status={s} labels={tt} />
                <span className="mg-title">{t.title}</span>
                <span className="mg-sub">{t.sections.length} · {questionCount(t)} · {t.rules.passingPercent} %</span>
                <span className="mg-sub">{t.responsible.map(r => r.fullName).join(", ") || tt.nobody}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function questionHref(q: Q, change: Record<string, string | null>): string {
  const p = new URLSearchParams({ tab: "questions" })
  const tags = Array.isArray(q.tag) ? q.tag : q.tag ? [q.tag] : []
  for (const x of tags) p.append("tag", x)
  if (q.qtype) p.set("qtype", q.qtype)
  if (q.qstatus) p.set("qstatus", q.qstatus)
  for (const [k, v] of Object.entries(change)) {
    if (k === "tag" && v) { if (p.getAll("tag").includes(v)) { const rest = p.getAll("tag").filter(x => x !== v); p.delete("tag"); rest.forEach(x => p.append("tag", x)) } else p.append("tag", v) }
    else if (v === null) p.delete(k)
    else p.set(k, v)
  }
  return `/learning/tests?${p.toString()}`
}

async function QuestionsTab({ companyCode, actor, bank, q, tt, language }: {
  companyCode: string; actor: string; bank: Question[]; q: Q; tt: Tt; language: UiLanguage
}) {
  if (q.import) return await ImportPanel({ companyCode, actor, bank, q, tt, language })
  const editing = q.q ? bank.find(x => x.key === q.q) ?? null : null
  if (q.new === "1" || editing) return await QuestionForm({ companyCode, question: editing, q, tt, language })

  const filter = filterFromQuery(q.tag)
  const shown = bank.filter(x =>
    matchesSmartFilter(x.smartTags, filter) &&
    (!q.qtype || x.type === q.qtype) &&
    (q.qstatus === "retired" ? x.status === "retired" : q.qstatus === "all" ? true : x.status === "active"))
  const keys = new Map<string, { label: string; values: Map<string, { label: string; count: number }> }>()
  for (const x of bank) for (const t of x.smartTags) {
    const k = keys.get(t.key) ?? { label: t.label.slice(0, t.label.indexOf(":")).trim(), values: new Map() }
    const v = k.values.get(t.value) ?? { label: t.label.slice(t.label.indexOf(":") + 1).trim(), count: 0 }
    v.count++
    k.values.set(t.value, v)
    keys.set(t.key, k)
  }
  const on = new Set(filter.map(tagId))

  if (bank.length === 0) {
    return <div className="empty"><div className="empty-title">{tt.bankEmpty}</div><div className="empty-text">{tt.bankEmptyNote}</div></div>
  }
  return (
    <div className="lp-cols">
      <aside className="lf" aria-label={tt.filterTags}>
        {[...keys.entries()].map(([k, g]) => (
          <div key={k}>
            <p className="lf-k">{g.label}</p>
            <div className="lf-group">
              {[...g.values.entries()].map(([v, x]) => (
                <Link key={v} className={`facet${on.has(`${k}:${v}`) ? " is-on" : ""}`} href={questionHref(q, { tag: `${k}:${v}` })}>
                  <span className="facet-box" aria-hidden="true">{on.has(`${k}:${v}`) ? "✓" : ""}</span><span className="facet-name">{x.label}</span><span className="facet-count">{x.count}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
        <div>
          <p className="lf-k">{tt.filterType}</p>
          <div className="lf-group">
            {QUESTION_TYPES.map(ty => <Link key={ty} className={`facet${q.qtype === ty ? " is-on" : ""}`} href={questionHref(q, { qtype: q.qtype === ty ? null : ty })}><span className="facet-name">{tt.types[ty]}</span></Link>)}
          </div>
        </div>
        <div>
          <p className="lf-k">{tt.filterStatus}</p>
          <div className="lf-group">
            <Link className={`facet${!q.qstatus ? " is-on" : ""}`} href={questionHref(q, { qstatus: null })}><span className="facet-name">{tt.statusActive}</span></Link>
            <Link className={`facet${q.qstatus === "retired" ? " is-on" : ""}`} href={questionHref(q, { qstatus: "retired" })}><span className="facet-name">{tt.statusRetiredQ}</span></Link>
          </div>
        </div>
      </aside>
      <div>
        <details className="lfd lf-mobile" open={filter.length > 0}>
          <summary>{tt.filterTags}</summary>
          <div className="lfd-body">
            {[...keys.entries()].map(([k, g]) => (
              <div key={k} className="lf-group"><p className="lf-k">{g.label}</p>
                {[...g.values.entries()].map(([v, x]) => <Link key={v} className={`stag${on.has(`${k}:${v}`) ? " is-on" : ""}`} href={questionHref(q, { tag: `${k}:${v}` })}>{x.label} <span className="pill-count">{x.count}</span></Link>)}
              </div>
            ))}
          </div>
        </details>
        {filter.length > 0 && (
          <div className="lchips">
            {filter.map(f => <Link key={tagId(f)} className="library-chip" href={questionHref(q, { tag: tagId(f) })}>{keys.get(f.key)?.values.get(f.value)?.label ?? tagId(f)} <span className="library-chip-x" aria-hidden="true">×</span></Link>)}
            <Link className="linkish" href="/learning/tests?tab=questions">{tt.clearFilters}</Link>
          </div>
        )}
        <div className="mg-actions" style={{ margin: "0 0 10px" }}><a className="button button--quiet" href="/api/learning/questions/export">{tt.exportCsv}</a></div>
        <section className="card mc-list">
          {shown.map(x => (
            <div key={x.key} className={`mc-row${x.status === "retired" ? " is-retired" : ""}`}>
              <span className="mc-row-main">
                <Link className="mg-title" href={`/learning/tests?tab=questions&q=${x.key}`}>{(x.text ?? "").slice(0, 140) || "—"}</Link>
                <span className="mc-row-meta">
                  {x.smartTags.map(t => <span key={tagId(t)} className="stag"><span className="stag-k">{t.label.slice(0, t.label.indexOf(":") + 1)}</span>{t.label.slice(t.label.indexOf(":") + 1).trim()}</span>)}
                </span>
              </span>
              <span className="quiet">{tt.types[x.type]} · {tt.weight} {x.weight}</span>
              {x.status === "retired" && <span className="tag tag--archived">{tt.statusRetiredQ}</span>}
              <Link className="lc-link" href={`/learning/tests?tab=questions&q=${x.key}`}>{tt.edit}</Link>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

async function QuestionForm({ companyCode, question, q, tt, language }: {
  companyCode: string; question: Question | null; q: Q; tt: Tt; language: UiLanguage
}) {
  const type: QuestionType = (QUESTION_TYPES as readonly string[]).includes(q.type ?? "") ? (q.type as QuestionType) : question?.type ?? "single"
  const usage = question ? await questionUsage(companyCode, question) : null
  const tagUsage = await smartTagUsage(companyCode)
  const tm = dictionary(language).learning.manage
  const ts = dictionary(language).learning.settings
  const base = question ? `/learning/tests?tab=questions&q=${question.key}` : "/learning/tests?tab=questions&new=1"
  const rows = type === "single" || type === "multiple" ? Math.max(type === "single" ? 4 : 5, (question?.type === type ? question.answers.length : 0) + 1) : 0
  const prevAnswers = question?.type === type ? question.answers : []
  return (
    <form action={saveQuestionAction} className="card mc-settings">
      {question && <input type="hidden" name="questionKey" value={question.key} />}
      <input type="hidden" name="type" value={type} />
      <nav className="lpills" aria-label={tt.filterType}>
        {QUESTION_TYPES.map(ty => <Link key={ty} className={`pill${ty === type ? " is-on" : ""}`} href={`${base}&type=${ty}`}>{tt.types[ty]}</Link>)}
      </nav>
      {usage && <p className="quiet mc-note">{tt.usage(usage.tests, usage.attempts)}</p>}
      <label className="field"><span className="field-label">{tt.questionText}</span><textarea className="field-input" name="text" rows={4} defaultValue={question?.text ?? ""} /></label>

      <fieldset className="mc-group">
        <legend className="field-label">{tt.media}</legend>
        {(question?.media ?? []).map((m, i) => (
          <label key={i} className="mc-check"><input type="checkbox" name="keepMedia" value={String(i)} defaultChecked /> {m.kind === "image" ? m.alt : dictionary(language).learning.edit.blockTypes.video}</label>
        ))}
        <CourseMediaUpload kind="gallery" accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm" maxBytes={MAX_BYTES}
          labels={{ title: tt.media, note: tt.mediaNote, progressTitle: dictionary(language).learning.edit.progressTitle, uploading: dictionary(language).learning.edit.uploading, failed: dictionary(language).learning.edit.uploadFailed, tooLarge: dictionary(language).learning.edit.tooLarge }} />
        <label className="field"><span className="field-label">{tt.mediaAlt}</span><input className="field-input" name="mediaAlt" /></label>
      </fieldset>

      <fieldset className="mc-group">
        <legend className="field-label">{tt.answers}</legend>
        {type === "multiple" && <p className="quiet mc-note">{tt.multipleNote}</p>}
        {(type === "single" || type === "multiple") && Array.from({ length: Math.min(rows, MAX_ANSWERS) }, (_, i) => {
          const a = prevAnswers[i]
          return (
            <div key={i} className="ansr">
              {a && <input type="hidden" name={`answer_${i}_id`} value={a.id} />}
              <input className="field-input" name={`answer_${i}`} defaultValue={a?.text ?? ""} aria-label={tt.answer(i + 1)} placeholder={tt.answer(i + 1)} />
              <label className="mc-check"><input type={type === "single" ? "radio" : "checkbox"} name="correct" value={String(i)} defaultChecked={a?.correct} /> {tt.correct}</label>
            </div>
          )
        })}
        {type === "true_false" && (
          <div className="tf">
            <label className="tf-opt"><input type="radio" name="correctTrue" value="true" defaultChecked={question?.correctTrue === true} /> {tt.trueLabel}</label>
            <label className="tf-opt"><input type="radio" name="correctTrue" value="false" defaultChecked={question?.correctTrue === false} /> {tt.falseLabel}</label>
          </div>
        )}
        {type === "short_text" && (
          <>
            <label className="field"><span className="field-label">{tt.expected}</span><input className="field-input" name="expected" defaultValue={question?.expected?.[0] ?? ""} /></label>
            <label className="field"><span className="field-label">{tt.alternatives}</span><textarea className="field-input" name="alternatives" rows={3} defaultValue={(question?.expected ?? []).slice(1).join("\n")} /></label>
            <p className="quiet mc-note">{tt.shortNote}</p>
          </>
        )}
        {type !== "short_text" && <p className="quiet mc-note">{tt.answerMediaLater}</p>}
      </fieldset>

      <label className="field"><span className="field-label">{tt.explanation}</span><textarea className="field-input" name="explanation" rows={3} defaultValue={question?.explanation ?? ""} /><span className="quiet field-hint">{tt.explanationNote}</span></label>
      <div className="mc-grid2">
        <label className="field"><span className="field-label">{tt.weight}</span><input className="field-input" type="number" min="1" name="weight" defaultValue={question?.weight ?? 1} /></label>
        <label className="field"><span className="field-label">{tt.difficulty}</span>
          <Select name="difficulty" initial={question?.difficulty ?? "medium"} options={DIFFICULTIES.map(d => ({ value: d, label: tt.difficulties[d] }))} fieldLabel={tt.difficulty} language={language} />
        </label>
      </div>
      <div className="field">
        <span className="field-label">{tt.tagsLabel}</span>
        <SmartTagInput name="smartTags" initial={(question?.smartTags ?? []).map(t => t.label)}
          suggestions={tagUsage.map(u => ({ key: u.key, value: u.value, label: u.label, usage: tm.usage(u.courses, u.questions, u.tests) }))}
          labels={{ placeholder: ts.tagPlaceholder, newKey: ts.tagNewKey, newValue: ts.tagNewValue, remove: ts.tagRemove, values: ts.tagValues, field: tt.tagsLabel, noScript: ts.tagNoScript }} />
        <span className="quiet field-hint">{tt.tagRequiredNote}</span>
      </div>
      <div className="mg-actions">
        <SubmitButton className="button">{tt.saveQuestion}</SubmitButton>
        <Link className="button button--quiet" href="/learning/tests?tab=questions">{tt.cancel}</Link>
      </div>
      {question && (
        <div className="mg-actions">
          <button type="submit" formAction={questionStatusAction} name="retire" value={question.status === "retired" ? "0" : "1"} className="button button--quiet">
            {question.status === "retired" ? tt.restoreQ : tt.retireQ}
          </button>
        </div>
      )}
    </form>
  )
}

async function ImportPanel({ companyCode, actor, bank, q, tt, language }: { companyCode: string; actor: string; bank: Question[]; q: Q; tt: Tt; language: UiLanguage }) {
  const stored = q.import && q.import !== "1" ? await loadImport(companyCode, actor, q.import) : null
  if (!stored) {
    return (
      <section className="card mg-new">
        <h2>{tt.importHeading}</h2>
        <p className="quiet mc-note">{tt.importNote} <a className="linkish" href="/api/learning/questions/export?template=1">{tt.templateLink}</a></p>
        <form action={previewImportAction} className="mg-form">
          <label className="field"><span className="field-label">{tt.importFile}</span><input className="field-input" type="file" name="csv" accept=".csv,text/csv" required /></label>
          <div className="mg-actions"><SubmitButton className="button">{tt.importUpload}</SubmitButton><Link className="button button--quiet" href="/learning/tests?tab=questions">{tt.cancel}</Link></div>
        </form>
      </section>
    )
  }
  const r = importQuestionsCsv(stored.csv)
  const known = new Set(bank.flatMap(x => x.smartTags.map(tagId)))
  const fresh = r.tags.filter(t => !known.has(tagId(t)))
  const existing = new Set(bank.map(x => x.key))
  const rowsTotal = r.errors.length ? new Set(r.errors.map(e => e.line)).size : r.questions.length
  const updated = r.questions.filter(x => x.id && existing.has(x.id)).length
  const errorsText = dictionary(language).errors
  return (
    <section className="card mg-new">
      <h2>{tt.importHeading} — {stored.name}</h2>
      <p className="mg-impact">{tt.importSummary(r.errors.length ? rowsTotal : r.questions.length, r.questions.length - updated, updated, r.errors.length)}</p>
      {fresh.length > 0 && <p className="mg-warn">{tt.newTags(fresh.map(t => t.label).join(", "))}</p>}
      <p className="quiet mc-note">{tt.mediaNoteImport}</p>
      {r.errors.length > 0 ? (
        <>
          <p className="mg-error">{tt.importErrorsNote}</p>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead><tr><th>{tt.colLine}</th><th>{tt.colColumn}</th><th>{tt.colProblem}</th></tr></thead>
              <tbody>{r.errors.map((e, i) => <tr key={i}><td>{e.line}</td><td><code>{e.column}</code></td><td>{errorsText[e.code] ?? e.code}{e.value ? ` („${e.value}“)` : ""}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mg-actions"><Link className="button" href="/learning/tests?tab=questions&import=1">{tt.importUpload}</Link></div>
        </>
      ) : (
        <form action={runImportAction} className="mg-actions">
          <input type="hidden" name="importId" value={q.import} />
          <SubmitButton className="button">{tt.importRun(r.questions.length)}</SubmitButton>
          <Link className="button button--quiet" href="/learning/tests?tab=questions">{tt.cancel}</Link>
        </form>
      )}
    </section>
  )
}
