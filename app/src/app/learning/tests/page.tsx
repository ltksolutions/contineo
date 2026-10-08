/**
 * /learning/tests — testy a banka otázok (rám `docs/design/TESTS-testy-a-banka.md`).
 *
 * Časti Testy | Banka otázok (`/learning/tests/questions`) pre rolu
 * `learning-admin`; Výsledky (`/learning/tests/results`) **len pre
 * zodpovednú osobu testu** a len jej testy — vlastné adresy od 7. 10. 2026
 * (R3, `lib/learningPaths.ts`; obsah ostáva tu, podstránky ho len zapnú) —
 * lektor ani HR ju samy osebe nemajú (D121). Kto nie je zodpovedný za
 * žiadny test, záložku nevidí (404).
 *
 * - Testy: stav vrátane „Nedostatok otázok" (pripravený test, ktorému
 *   banka medzičasom nestačí), zodpovedné osoby, nový test.
 * - Banka: filter smart:tagov / typu / stavu v adrese, formulár otázky
 *   podľa typu (bez JS), import CSV v dvoch krokoch (TESTS Q1 ✅).
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { learningAdminContext, learningContext } from "@/lib/learning"
import { listTests, testsResponsibleFor } from "@/lib/testsDb"
import { attemptsOfTest } from "@/lib/testAttemptsDb"
import type { TestAttempt } from "@/lib/testAttempts"
import type { Test } from "@/lib/tests"
import { listQuestions, questionUsage } from "@/lib/questionsDb"
import { importQuestionsCsv, MAX_ANSWERS, QUESTION_TYPES, DIFFICULTIES, type Question, type QuestionType } from "@/lib/questions"
import { questionCount } from "@/lib/tests"
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
import TabsBar from "@/components/TabsBar"
import SubmitButton from "@/components/SubmitButton"
import KeyFromLabel from "@/components/KeyFromLabel"
import SmartTagInput from "@/components/SmartTagInput"
import CourseMediaUpload from "@/components/CourseMediaUpload"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { importPath, NEW_QUESTION_PATH, questionPath, RESERVED_TEST_KEYS, TESTS_PATH, testsPath } from "@/lib/learningPaths"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import { createTestAction, previewImportAction, questionStatusAction, resetAttemptsAction, runImportAction, saveQuestionAction } from "./actions"

export const dynamic = "force-dynamic"

type Q = {
  tab?: string; status?: string; new?: string; type?: string; q?: string; import?: string
  tag?: string | string[]; qtype?: string; qstatus?: string; msg?: string; error?: string; test?: string; reset?: string
}
type Tt = ReturnType<typeof dictionary>["learning"]["tests"]

export default async function LearningTestsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const q = normalizeQuery<Q>(await searchParams)
  if (q.tab === "results") return ResultsPage(q)
  const ctx = await learningAdminContext()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()
  const language = ctx.person.language
  const tt = dictionary(language).learning.tests
  const tab = q.tab === "questions" ? "questions" : "tests"
  const [tests, bank, mine] = await Promise.all([listTests(ctx.person.companyCode), listQuestions(ctx.person.companyCode), testsResponsibleFor(ctx.person.companyCode, ctx.person.id)])
  // Otázka na vlastnej adrese (R3): neznámy kľúč je 404, nie zoznam banky.
  const editing = tab === "questions" && q.q ? bank.find(x => x.key === q.q) ?? null : null
  if (tab === "questions" && q.q && !editing) notFound()
  // Krok cesty pod sekciou Testy (R3): Banka otázok › otázka / nová / import.
  const questions = testsPath("questions")
  const title = tab !== "questions" ? undefined
    : q.import ? tt.importHeading
    : q.new === "1" ? tt.newQuestion
    : editing ? shortText(editing.text) || tt.tabQuestions
    : tt.tabQuestions
  const trail = tab === "questions" && title !== tt.tabQuestions ? { [questions]: tt.tabQuestions } : undefined
  const body = tab === "tests"
    ? <TestsTab tests={tests} bank={bank} q={q} tt={tt} filterLabel={dictionary(language).learning.statusFilter} />
    : await QuestionsTab({ companyCode: ctx.person.companyCode, actor: ctx.person.email, bank, q, tt, language })

  return (
    <AppShell language={language} title={title} trail={trail}>
      <div className="mg" style={tenantStyle(brandingView(ctx.tenant))}>
        {/* Hlavička s akciami vpravo (DESIGN_ODCHYLKY P1). Pri otvorenom
            formulári (nový test, otázka, import) sa akcie nekreslia — plné
            tlačidlo je vtedy vo formulári (P10). */}
        <div className="page-head">
          <h1 className="page-title">{dictionary(language).learning.testsHeading}</h1>
          <span className="page-head-spacer" aria-hidden="true" />
          {tab === "tests"
            ? q.new !== "1" && <Link className="button" href={`${TESTS_PATH}?new=1`}>{tt.newTest}</Link>
            : q.new !== "1" && !q.q && !q.import && <span className="mg-actions"><Link className="button" href={NEW_QUESTION_PATH}>{tt.newQuestion}</Link><Link className="button button--quiet" href={importPath()}>{tt.importCsv}</Link></span>}
        </div>
        <Notice language={language} message={q.msg} error={q.error === "1"} back={testsPath(tab)} />
        <nav className="tabs" aria-label={tt.tabsLabel}>
          <TabsBar>
            <TabLink href={TESTS_PATH} active={tab === "tests"}>{tt.tabTests}</TabLink>
            <TabLink href={testsPath("questions")} active={tab === "questions"}>{tt.tabQuestions}</TabLink>
            {mine.length > 0 && <TabLink href={testsPath("results")} active={false}>{tt.tabResults}</TabLink>}
          </TabsBar>
        </nav>
        <div className="mg-body">{body}</div>
      </div>
    </AppShell>
  )
}

/** Začiatok znenia otázky ako názov kroku v ceste. */
function shortText(text: string | undefined): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim()
  return t.length > 60 ? `${t.slice(0, 59)}…` : t
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join("")
}

function TestsTab({ tests, bank, q, tt, filterLabel }: { tests: Test[]; bank: Question[]; q: Q; tt: Tt; filterLabel: string }) {
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
            <KeyFromLabel layout="fields" labelName="title" separator="-" usedKeys={[...tests.map(t => t.key), ...RESERVED_TEST_KEYS]}
              labels={{ label: tt.testTitle, labelPlaceholder: "", key: tt.testKey, keyPlaceholder: "bezpecnost-vytah", taken: tt.keyTaken }} />
            <div className="mg-actions"><SubmitButton className="button">{tt.create}</SubmitButton><Link className="button button--quiet" href="/learning/tests">{tt.cancel}</Link></div>
          </form>
        </section>
      )}
      {tests.length === 0 ? (
        <div className="empty"><div className="empty-title">{tt.testsEmpty}</div><div className="empty-text">{tt.testsEmptyNote}</div></div>
      ) : (
        <>
          {/* Filter toho istého zoznamu = prepínač pohľadu, nie pilulky
              (Picker .segmented; DESIGN_ODCHYLKY P4, 6. 10. 2026). */}
          <nav className="view-switch view-switch--fit" aria-label={filterLabel}>
            {filters.map(f => (
              <Link key={f} className={`view-switch-item${f === status ? " is-on" : ""}`} aria-current={f === status ? "true" : undefined}
                    href={`${TESTS_PATH}${f === "all" ? "" : `?status=${f}`}`}>
                {label[f]} <span className="view-switch-count">{rows.filter(r => inFilter(r.s, f)).length}</span>
              </Link>
            ))}
          </nav>
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
  const p = new URLSearchParams()
  const tags = Array.isArray(q.tag) ? q.tag : q.tag ? [q.tag] : []
  for (const x of tags) p.append("tag", x)
  if (q.qtype) p.set("qtype", q.qtype)
  if (q.qstatus) p.set("qstatus", q.qstatus)
  for (const [k, v] of Object.entries(change)) {
    if (k === "tag" && v) { if (p.getAll("tag").includes(v)) { const rest = p.getAll("tag").filter(x => x !== v); p.delete("tag"); rest.forEach(x => p.append("tag", x)) } else p.append("tag", v) }
    else if (v === null) p.delete(k)
    else p.set(k, v)
  }
  const query = p.toString()
  return `${testsPath("questions")}${query ? `?${query}` : ""}`
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
            <Link className="linkish" href={testsPath("questions")}>{tt.clearFilters}</Link>
          </div>
        )}
        <div className="mg-actions" style={{ margin: "0 0 10px" }}><a className="button button--quiet" href="/api/learning/questions/export">{tt.exportCsv}</a></div>
        <section className="card mc-list">
          {shown.map(x => (
            <div key={x.key} className={`mc-row${x.status === "retired" ? " is-retired" : ""}`}>
              <span className="mc-row-main">
                <Link className="mg-title" href={questionPath(x.key)}>{(x.text ?? "").slice(0, 140) || "—"}</Link>
                <span className="mc-row-meta">
                  {x.smartTags.map(t => <span key={tagId(t)} className="stag"><span className="stag-k">{t.label.slice(0, t.label.indexOf(":") + 1)}</span>{t.label.slice(t.label.indexOf(":") + 1).trim()}</span>)}
                </span>
              </span>
              <span className="quiet">{tt.types[x.type]} · {tt.weight} {x.weight}</span>
              {x.status === "retired" && <span className="tag tag--archived">{tt.statusRetiredQ}</span>}
              <Link className="lc-link" href={questionPath(x.key)}>{tt.edit}</Link>
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
  const base = question ? questionPath(question.key) : NEW_QUESTION_PATH
  const rows = type === "single" || type === "multiple" ? Math.max(type === "single" ? 4 : 5, (question?.type === type ? question.answers.length : 0) + 1) : 0
  const prevAnswers = question?.type === type ? question.answers : []
  return (
    <form action={saveQuestionAction} className="card mc-settings">
      {question && <input type="hidden" name="questionKey" value={question.key} />}
      <input type="hidden" name="type" value={type} />
      {/* Typ otázky mení tvar formulára — prepínač ako pri filtri stavu,
          nie pilulky (DESIGN_ODCHYLKY, 8. 10. 2026). */}
      <nav className="view-switch view-switch--fit" aria-label={tt.filterType}>
        {QUESTION_TYPES.map(ty => (
          <Link key={ty} className={`view-switch-item${ty === type ? " is-on" : ""}`} aria-current={ty === type ? "true" : undefined}
                href={`${base}?type=${ty}`}>{tt.types[ty]}</Link>
        ))}
      </nav>
      {usage && <p className="quiet mc-note">{tt.usage(usage.tests, usage.attempts)}</p>}
      <label className="field"><span className="field-label">{tt.questionText}</span><textarea className="field-input" name="text" rows={4} defaultValue={question?.text ?? ""} /></label>

      {/* Nadpis nad kartou (HR-pridelit-nadpis-karty, 6. 10. 2026). */}
      <fieldset className="form-group">
        <legend className="form-group-head">{tt.media}</legend>
        <div className="card form-group-body form-group-body--rows">
        {(question?.media ?? []).length > 0 && (
          // Ponechať médiá — výber viacerých, kruh vľavo (ZAKLAD-vyber-a-prepinace).
          <div className="form-list">
            {(question?.media ?? []).map((m, i) => (
              <label key={i} className="form-row select-row"><input type="checkbox" name="keepMedia" value={String(i)} defaultChecked /><span className="form-row-main">{m.kind === "image" ? m.alt : dictionary(language).learning.edit.blockTypes.video}</span></label>
            ))}
          </div>
        )}
        <CourseMediaUpload kind="gallery" accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm" maxBytes={MAX_BYTES}
          labels={{ title: tt.media, note: tt.mediaNote, progressTitle: dictionary(language).learning.edit.progressTitle, uploading: dictionary(language).learning.edit.uploading, failed: dictionary(language).learning.edit.uploadFailed, tooLarge: dictionary(language).learning.edit.tooLarge }} />
        <label className="field"><span className="field-label">{tt.mediaAlt}</span><input className="field-input" name="mediaAlt" /></label>
        </div>
      </fieldset>

      <fieldset className="form-group">
        <legend className="form-group-head">{tt.answers}</legend>
        <div className="card form-group-body">
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
          // Jedna z dvoch: Picker(.inline), riadky s fajkou (ZAKLAD-vyber-a-prepinace).
          <div className="form-list tf-list">
            <label className="form-row choice-row"><input type="radio" name="correctTrue" value="true" defaultChecked={question?.correctTrue === true} />
              <span className="form-row-main">{tt.trueLabel}</span></label>
            <label className="form-row choice-row"><input type="radio" name="correctTrue" value="false" defaultChecked={question?.correctTrue === false} />
              <span className="form-row-main">{tt.falseLabel}</span></label>
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
        </div>
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
        <Link className="button button--quiet" href={testsPath("questions")}>{tt.cancel}</Link>
      </div>
      {question && (
        <div className="mg-actions">
          <SubmitButton formAction={questionStatusAction} name="retire" value={question.status === "retired" ? "0" : "1"} className="button button--quiet">
            {question.status === "retired" ? tt.restoreQ : tt.retireQ}
          </SubmitButton>
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
          <div className="mg-actions"><SubmitButton className="button">{tt.importUpload}</SubmitButton><Link className="button button--quiet" href={testsPath("questions")}>{tt.cancel}</Link></div>
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
          {/* Tabuľka od 1024 px, pod ňou karty — ako zoznamy správy (P5). */}
          <div className="doc-table-wrap mg-table">
            <table className="doc-table">
              <thead><tr><th>{tt.colLine}</th><th>{tt.colColumn}</th><th>{tt.colProblem}</th></tr></thead>
              <tbody>{r.errors.map((e, i) => <tr key={i}><td>{e.line}</td><td><code>{e.column}</code></td><td>{errorsText[e.code] ?? e.code}{e.value ? ` („${e.value}“)` : ""}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mg-cards">
            {r.errors.map((e, i) => (
              <div key={i} className="card mg-card">
                <span className="mg-sub">{tt.colLine} {e.line} · {tt.colColumn} <code>{e.column}</code></span>
                <span>{errorsText[e.code] ?? e.code}{e.value ? ` („${e.value}“)` : ""}</span>
              </div>
            ))}
          </div>
          <div className="mg-actions"><Link className="button" href={importPath()}>{tt.importUpload}</Link></div>
        </>
      ) : (
        <form action={runImportAction} className="mg-actions">
          <input type="hidden" name="importId" value={q.import} />
          <SubmitButton className="button">{tt.importRun(r.questions.length)}</SubmitButton>
          <Link className="button button--quiet" href={testsPath("questions")}>{tt.cancel}</Link>
        </form>
      )}
    </section>
  )
}

/**
 * Záložka Výsledky — vlastná brána: prihlásený v organizácii so zapnutým
 * modulom, ktorý zodpovedá aspoň za jeden test (D121).
 */
async function ResultsPage(q: Q) {
  const ctx = await learningContext()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()
  const companyCode = ctx.person.companyCode
  const mine = await testsResponsibleFor(companyCode, ctx.person.id)
  if (!mine.length) notFound()
  const language = ctx.person.language
  const d = dictionary(language).learning
  const tt = d.tests
  const tr = d.results
  const ta = d.attempt
  const test = mine.find(t => t.key === q.test) ?? mine[0]
  const attempts = await attemptsOfTest(companyCode, test.key)
  const others = test.responsible.filter(r => r.personId !== ctx.person.id).map(r => r.fullName).join(", ")
  const self = `${testsPath("results")}?test=${encodeURIComponent(test.key)}`
  const rows = resultRows(attempts, test)
  const resetting = q.reset ? rows.find(r => r.a.personId === q.reset) : null

  return (
    <AppShell language={language} title={tt.tabResults}>
      <div className="mg" style={tenantStyle(brandingView(ctx.tenant))}>
        <div className="page-head"><h1 className="page-title">{d.testsHeading}</h1></div>
        <Notice language={language} message={q.msg} error={q.error === "1"} back={self} />
        <nav className="tabs" aria-label={tt.tabsLabel}>
          <TabsBar>
            {ctx.isAdmin && <TabLink href={TESTS_PATH} active={false}>{tt.tabTests}</TabLink>}
            {ctx.isAdmin && <TabLink href={testsPath("questions")} active={false}>{tt.tabQuestions}</TabLink>}
            <TabLink href={testsPath("results")} active>{tt.tabResults}</TabLink>
          </TabsBar>
        </nav>
        <div className="mg-body">
          <div className="mc-people-head">
            <form method="get" action={testsPath("results")} className="mc-inline">
              <Select name="test" initial={test.key} searchable={mine.length >= 8} options={mine.map(t => ({ value: t.key, label: t.title }))} fieldLabel={tr.selectTest} language={language} />
              <button type="submit" className="button button--quiet">{tr.show}</button>
            </form>
            <a className="button button--quiet" href={`/api/learning/tests/${encodeURIComponent(test.key)}/results`}>{tr.exportCsv}</a>
          </div>
          {others && <p className="quiet mc-note">{tr.alsoResponsible(others)}</p>}

          {resetting && (
            <form action={resetAttemptsAction} className="card mg-new rs-reset">
              <input type="hidden" name="testKey" value={test.key} />
              <input type="hidden" name="personId" value={resetting.a.personId} />
              <h2>{tr.resetTitle(resetting.a.fullName)}</h2>
              <p className="quiet mc-note">{tr.resetText}</p>
              <label className="field"><span className="field-label">{tr.reason}</span><textarea className="field-input" name="reason" rows={2} required /></label>
              <div className="mg-actions"><SubmitButton className="button">{tr.resetButton}</SubmitButton><Link className="button button--quiet" href={self}>{tr.cancel}</Link></div>
            </form>
          )}

          {rows.length === 0 ? (
            <div className="empty"><div className="empty-text">{tr.empty}</div></div>
          ) : (
            <>
              <div className="doc-table-wrap mg-table">
                <table className="doc-table">
                  <thead><tr><th>{tr.colPerson}</th><th>{tr.colContext}</th><th>{tr.colDate}</th><th>{tr.colAttempt}</th><th className="doc-col-right">{tr.colScore}</th><th>{tr.colResult}</th><th /></tr></thead>
                  <tbody>
                    {rows.map(({ a, canReset }) => (
                      <tr key={a.id} className={a.resetAt ? "is-retired" : ""}>
                        <td><b>{a.fullName}</b><div className="mg-sub">{a.email}</div></td>
                        <td>{a.context.courseKey} · {a.context.partKey}</td>
                        <td>{formatDate(a.submittedAt ?? a.startedAt, language)}</td>
                        <td>{ta.attemptOf(a.attemptNumber, test.rules.maxAttempts)}</td>
                        <td className="doc-col-right">{a.submittedAt ? `${a.percent ?? 0} %` : "—"}</td>
                        <td><ResultTag a={a} tr={tr} ta={ta} /></td>
                        <td>{canReset && <Link className="lc-link" href={`${self}&reset=${encodeURIComponent(a.personId)}`}>{tr.reset}</Link>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mg-cards">
                {rows.map(({ a, canReset }) => (
                  <div key={a.id} className="card mg-card">
                    <span className="mg-title">{a.fullName}</span>
                    <span className="mg-sub">{formatDate(a.submittedAt ?? a.startedAt, language)} · {ta.attemptOf(a.attemptNumber, test.rules.maxAttempts)} · {a.submittedAt ? `${a.percent ?? 0} %` : "—"}</span>
                    <span><ResultTag a={a} tr={tr} ta={ta} /></span>
                    {canReset && <Link className="lc-link" href={`${self}&reset=${encodeURIComponent(a.personId)}`}>{tr.reset}</Link>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

/** Reset sa ponúkne pri poslednom pokuse osoby, keď má vyčerpané pokusy a neprešla. */
function resultRows(attempts: TestAttempt[], test: Test) {
  const byPerson = new Map<string, TestAttempt[]>()
  for (const a of attempts) byPerson.set(a.personId, [...(byPerson.get(a.personId) ?? []), a])
  return attempts.map(a => {
    const live = (byPerson.get(a.personId) ?? []).filter(x => !x.resetAt)
    const latest = live.sort((x, y) => y.startedAt.getTime() - x.startedAt.getTime())[0]
    const exhausted = Boolean(test.rules.maxAttempts) && live.length >= test.rules.maxAttempts! && !live.some(x => x.passed)
    return { a, canReset: exhausted && latest?.id === a.id }
  })
}

function ResultTag({ a, tr, ta }: { a: TestAttempt; tr: ReturnType<typeof dictionary>["learning"]["results"]; ta: ReturnType<typeof dictionary>["learning"]["attempt"] }) {
  if (a.resetAt) return <span className="tag tag--archived">{tr.resetState}</span>
  if (!a.submittedAt) return <span className="tag tag--draft">{tr.openState}</span>
  return a.passed ? <span className="tag tag--published">{ta.passedWord}</span> : <span className="tag tag--expired">{ta.failedWord}</span>
}
