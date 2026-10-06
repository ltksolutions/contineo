/**
 * /learning/tests/[testKey] — editor testu (rám TESTS, „Editor testu").
 *
 * Jeden formulár: základ, zodpovedné osoby (1..n, D121), sekcie (filter
 * smart:tagov + počet, s počtom vyhovujúcich otázok v banke), pravidlá,
 * smart:tagy testu. Sekcie sa pridávajú, posúvajú a odstraňujú tlačidlami
 * `op` toho istého formulára — bez JavaScriptu a bez straty zmien.
 * Stav `ready` sa počíta pri uložení (D120), bočná karta hovorí, čo chýba.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { learningAdminContext } from "@/lib/learning"
import { getTest } from "@/lib/testsDb"
import { listQuestions } from "@/lib/questionsDb"
import { listCourses } from "@/lib/coursesDb"
import { listPeople } from "@/lib/people"
import { sectionAvailability } from "@/lib/testAttempts"
import { rulesValid, SHOW_ANSWERS } from "@/lib/tests"
import { displayStatus } from "@/lib/testView"
import { smartTagUsage } from "@/lib/smartTagsDb"
import { tagId } from "@/lib/smartTags"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import SubmitButton from "@/components/SubmitButton"
import SmartTagInput from "@/components/SmartTagInput"
import ResponsiblePicker from "@/components/ResponsiblePicker"
import Select from "@/components/Select"
import TestStatusTag from "@/components/TestStatusTag"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary } from "@/lib/i18n"
import { retireTestAction, saveTestAction } from "../actions"

export const dynamic = "force-dynamic"

export default async function TestEditorPage({ params, searchParams }: { params: Promise<{ testKey: string }>; searchParams: Promise<RawQuery> }) {
  const q = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const ctx = await learningAdminContext()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()
  const key = decodeURIComponent((await params).testKey)
  const companyCode = ctx.person.companyCode
  const test = await getTest(companyCode, key)
  if (!test) notFound()

  const language = ctx.person.language
  const d = dictionary(language)
  const tt = d.learning.tests
  const ts = d.learning.settings
  const tm = d.learning.manage
  const [bank, courses, people, usage] = await Promise.all([
    listQuestions(companyCode), listCourses(companyCode), listPeople(companyCode), smartTagUsage(companyCode),
  ])
  const avail = sectionAvailability(test, bank)
  const status = displayStatus(test, bank)
  const suggestions = usage.map(u => ({ key: u.key, value: u.value, label: u.label, usage: tm.usage(u.courses, u.questions, u.tests) }))
  const tagLabels = { placeholder: ts.tagPlaceholder, newKey: ts.tagNewKey, newValue: ts.tagNewValue, remove: ts.tagRemove, values: ts.tagValues, field: tt.sectionFilter, noScript: ts.tagNoScript }
  const sectionsOk = test.sections.length > 0 && test.sections.every(s => s.filter.length > 0 && (avail.get(s.key) ?? 0) >= s.count)
  const usedIn = courses.flatMap(c => {
    const v = [...c.versions].sort((a, b) => b.version - a.version)[0]
    return (v?.parts ?? []).flatMap(p => p.tests.filter(x => x.testKey === key).map(x => ({ course: c.title, courseKey: c.key, part: p.title, required: x.required, version: x.testVersion })))
  })
  const bankHref = (filter: { key: string; value: string }[]) => `/learning/tests?tab=questions${filter.map(f => `&tag=${encodeURIComponent(tagId(f))}`).join("")}`
  const showLabel = { never: tt.showNever, after_submit: tt.showAfterSubmit, after_pass: tt.showAfterPass, after_last_attempt: tt.showAfterLast }

  return (
    <AppShell language={language} title={test.title}>
      <div className="mc" style={tenantStyle(brandingView(ctx.tenant))}>
        <Notice message={q.msg} error={q.error === "1"} back={`/learning/tests/${key}`} />
        <header className="ch">
          <h1 className="page-title">{test.title}</h1>
          <div className="ch-facts"><code>{test.key}</code><span>{tt.version(test.version)}</span><TestStatusTag status={status} labels={tt} /></div>
        </header>

        <div className="te-grid">
          <form action={saveTestAction} className="card mc-settings te-form">
            <input type="hidden" name="testKey" value={test.key} />
            <input type="hidden" name="sections" value={String(test.sections.length)} />
            {/* Enter v poli odošle prvé tlačidlo formulára — nech je to „Uložiť", nie „↑". */}
            <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
            <fieldset className="mc-group">
              <legend className="field-label">{tt.groupBase}</legend>
              <label className="field"><span className="field-label">{tt.testTitle}</span><input className="field-input" name="title" defaultValue={test.title} required /></label>
              <label className="field"><span className="field-label">{tt.instructions}</span><textarea className="field-input" name="instructions" rows={3} defaultValue={test.instructions ?? ""} /></label>
              {people.length
                ? <ResponsiblePicker multiple legend={tt.responsibleLegend} note={tt.responsibleNote} initialMany={test.responsible.map(r => r.personId)}
                    people={people.filter(p => p.status !== "inactive").map(p => ({ id: p.id, fullName: p.fullName, email: p.email, department: p.department }))} language={language} />
                : <p className="quiet">{tt.noResponsiblePeople}</p>}
              {test.responsible.length === 0 && <p className="mg-error">{tt.noResponsible}</p>}
            </fieldset>

            <fieldset className="mc-group" id="sections">
              <legend className="field-label">{tt.groupSections}</legend>
              <p className="quiet mc-note">{tt.sectionsNote}</p>
              {test.sections.map((s, i) => {
                const have = avail.get(s.key) ?? 0
                const short = have < s.count || s.filter.length === 0
                return (
                  <div key={s.key} className={`sec2${short ? " is-short" : ""}`}>
                    <input type="hidden" name={`section_${i}_key`} value={s.key} />
                    <div className="sec2-head"><b>{tt.sectionTitle(i + 1)}</b>
                      <span className="mc-arrows">
                        <SubmitButton name="op" value={`up:${i}`} className="button button--quiet mc-arrow" ariaLabel={tt.up} disabled={i === 0}>↑</SubmitButton>
                        <SubmitButton name="op" value={`down:${i}`} className="button button--quiet mc-arrow" ariaLabel={tt.down} disabled={i === test.sections.length - 1}>↓</SubmitButton>
                        <SubmitButton name="op" value={`remove:${i}`} className="button button--quiet">{tt.removeSection}</SubmitButton>
                      </span>
                    </div>
                    <div className="field"><span className="field-label">{tt.sectionFilter}</span>
                      <SmartTagInput name={`section_${i}_tags`} initial={s.filter.map(f => f.label)} suggestions={suggestions} labels={tagLabels} />
                    </div>
                    <label className="field mc-minutes"><span className="field-label">{tt.sectionCount}</span><input className="field-input" type="number" min="1" name={`section_${i}_count`} defaultValue={s.count} /></label>
                    <p className={short ? "mg-error" : "ok-fg sec2-avail"}>
                      {short ? tt.short(have, Math.max(0, s.count - have)) : tt.enough(have)}{" "}
                      <Link className="lc-link" href={bankHref(s.filter)}>{short ? tt.addQuestions : tt.showInBank}</Link>
                    </p>
                  </div>
                )
              })}
              <div><SubmitButton name="op" value="add" className="button button--quiet">{tt.addSection}</SubmitButton></div>
            </fieldset>

            <fieldset className="mc-group">
              <legend className="field-label">{tt.groupRules}</legend>
              <div className="mc-grid2">
                <label className="field"><span className="field-label">{tt.passing}</span><input className="field-input" type="number" min="0" max="100" name="passingPercent" defaultValue={test.rules.passingPercent} /></label>
                <label className="field"><span className="field-label">{tt.timeLimit}</span><input className="field-input" type="number" min="1" name="timeLimitMinutes" defaultValue={test.rules.timeLimitMinutes ?? ""} /></label>
                <label className="field"><span className="field-label">{tt.maxAttempts}</span><input className="field-input" type="number" min="1" name="maxAttempts" defaultValue={test.rules.maxAttempts ?? ""} /></label>
                <label className="field"><span className="field-label">{tt.pause}</span><input className="field-input" type="number" min="0" name="pauseMinutes" defaultValue={test.rules.pauseMinutes ?? ""} /></label>
              </div>
              <p className="quiet mc-note">{tt.emptyMeansNone}</p>
              <label className="field"><span className="field-label">{tt.showAnswers}</span>
                <Select name="showAnswers" initial={test.rules.showAnswers} options={SHOW_ANSWERS.map(x => ({ value: x, label: showLabel[x] }))} fieldLabel={tt.showAnswers} language={language} />
              </label>
            </fieldset>

            <div className="field"><span className="field-label">{tt.testTags}</span>
              <SmartTagInput name="smartTags" initial={test.smartTags.map(t => t.label)} suggestions={suggestions} labels={{ ...tagLabels, field: tt.testTags }} />
            </div>
            <div className="mg-actions"><SubmitButton className="button">{tt.save}</SubmitButton></div>
          </form>

          <aside className="te-side">
            <section className="card flow">
              <div className="flow-head"><h2>{tt.statusCard}</h2><TestStatusTag status={status} labels={tt} /></div>
              <div className="flow-body">
                <div className="flow-check">
                  {([[tt.checkResponsible, test.responsible.length > 0, test.responsible.map(r => r.fullName).join(", ")], [tt.checkSections, sectionsOk, ""], [tt.checkRules, rulesValid(test.rules), ""]] as [string, boolean, string][]).map(([label, ok, note]) => (
                    <div key={label} className="flow-check-row">
                      <span className={`flow-check-ico ${ok ? "is-ok" : "is-todo"}`} aria-hidden="true">{ok ? "✓" : "!"}</span>
                      <div className="flow-check-main">{label}{note && <div className="flow-check-note">{note}</div>}</div>
                    </div>
                  ))}
                </div>
                <p className="quiet mc-note">{tt.statusNote}</p>
              </div>
            </section>
            <section className="card mc-list">
              <div className="parts-head"><h2>{tt.usedIn}</h2></div>
              {usedIn.length === 0 ? <p className="quiet mc-row">{tt.usedNone}</p> : usedIn.map((u, i) => (
                <div key={i} className="mc-row"><Link className="lc-link" href={`/learning/manage/${u.courseKey}`}>{tt.usedRow(u.course, u.part, u.required, u.version)}</Link></div>
              ))}
            </section>
            <form action={retireTestAction}>
              <input type="hidden" name="testKey" value={test.key} />
              <input type="hidden" name="retire" value={test.status === "retired" ? "0" : "1"} />
              <SubmitButton className="button button--quiet">{test.status === "retired" ? tt.restore : tt.retire}</SubmitButton>
            </form>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
