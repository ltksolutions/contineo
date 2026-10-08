/**
 * /learning/manage — správa kurzov (rám `docs/design/MANAGE-sprava-kurzov.md`).
 *
 * Časti Kurzy | Témy | Tagy majú vlastné adresy (`/learning/manage/topics`,
 * `/tags` — R3, `lib/learningPaths.ts`), ako v `/organisation`. Len rola
 * `learning-admin`; pri vypnutom module stránka neexistuje (D123).
 *
 * - Kurzy: stav verzie (dve pilulky, keď zverejnený má rozpracovaný
 *   koncept), zapísaní a dokončili — počty, nie skóre (D121).
 * - Témy: číselník s vyradením, nie zmazaním (kurzy ich citujú).
 * - smart:tagy: prehľad použitia, premenovanie a zlúčenie **všade**
 *   (MANAGE Q1 ✅). Premenovanie na existujúci tag je zlúčenie.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { learningAdminContext } from "@/lib/learning"
import { listCourses } from "@/lib/coursesDb"
import { courseStats } from "@/lib/learningStats"
import { draftVersion, isArchived, publishedVersion, type Course } from "@/lib/courses"
import { topicOptions } from "@/lib/learningTopics"
import { smartTagImpact, smartTagUsage } from "@/lib/smartTagsDb"
import { parseSmartTag, tagId, type SmartTagUsage } from "@/lib/smartTags"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import TabLink from "@/components/TabLink"
import TabsBar from "@/components/TabsBar"
import SubmitButton from "@/components/SubmitButton"
import FormPendingSignal from "@/components/FormPendingSignal"
import KeyFromLabel from "@/components/KeyFromLabel"
import Select from "@/components/Select"
import MergeSelectionBar from "@/components/MergeSelectionBar"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { MANAGE_PATH, managePath, RESERVED_COURSE_KEYS } from "@/lib/learningPaths"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import {
  addTopicAction, createCourseAction, mergeTagsAction, renameKeyAction, renameTagAction,
  renameTopicAction, restoreTopicAction, retireTopicAction,
} from "./actions"

export const dynamic = "force-dynamic"

const TABS = ["courses", "topics", "tags"] as const
type Tab = (typeof TABS)[number]
const STATUSES = ["all", "draft", "published", "archived"] as const
type Status = (typeof STATUSES)[number]

type Q = {
  tab?: string; status?: string; new?: string; title?: string; key?: string
  renameTopic?: string; rename?: string; to?: string; exists?: string; renameKey?: string
  sel?: string | string[]; merge?: string; msg?: string; error?: string
}

export default async function LearningManagePage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const q = normalizeQuery<Q>(await searchParams)
  const ctx = await learningAdminContext()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()

  const language = ctx.person.language
  const t = dictionary(language).learning
  const tm = t.manage
  const tab: Tab = (TABS as readonly string[]).includes(q.tab ?? "") ? (q.tab as Tab) : "courses"
  const back = managePath(tab)
  // Záložky sa načítajú tu, nie ako asynchrónne komponenty — nech sa
  // stránka dá vykresliť aj v teste (`renderToStaticMarkup`).
  const body = tab === "courses" ? await CoursesTab({ ctx, q, language })
    : tab === "topics" ? await TopicsTab({ ctx, q, language })
    : await TagsTab({ companyCode: ctx.person.companyCode, q, language })

  return (
    <AppShell language={language}>
      <div className="mg" style={tenantStyle(brandingView(ctx.tenant))}>
        {/* Hlavička s jedinou akciou vpravo (DESIGN_ODCHYLKY P1). Pri otvorenom
            formulári sa „Nový kurz" nekreslí — plné je vtedy „Vytvoriť" (P10). */}
        <div className="page-head">
          <h1 className="page-title">{t.manageHeading}</h1>
          <span className="page-head-spacer" aria-hidden="true" />
          {tab === "courses" && q.new !== "1" && <Link className="button" href={`${MANAGE_PATH}?new=1`}>{tm.newCourse}</Link>}
        </div>
        <Notice language={language} message={q.msg} error={q.error === "1"} back={back} />
        <nav className="tabs" aria-label={tm.tabsLabel}>
          <TabsBar>
            {TABS.map(k => (
              <TabLink key={k} href={managePath(k)} active={k === tab}>
                {{ courses: tm.tabCourses, topics: tm.tabTopics, tags: tm.tabTags }[k]}
              </TabLink>
            ))}
          </TabsBar>
        </nav>
        <div className="mg-body">
          {body}
        </div>
      </div>
    </AppShell>
  )
}

type Ctx = Extract<Awaited<ReturnType<typeof learningAdminContext>>, { state: "ready" }>

function statusOf(c: Course): Status[] {
  const out: Status[] = []
  if (publishedVersion(c)) out.push("published")
  if (draftVersion(c)) out.push("draft")
  if (isArchived(c) && !draftVersion(c)) out.push("archived")
  return out
}

function StatusPills({ c, language }: { c: Course; language: UiLanguage }) {
  const tm = dictionary(language).learning.manage
  const pub = publishedVersion(c), draft = draftVersion(c)
  const last = [...c.versions].sort((a, b) => b.version - a.version)[0]
  return (
    <span className="mg-pills">
      {pub && <span className="tag tag--published">{tm.statusPublished} · v{pub.version}</span>}
      {draft && <span className="tag tag--draft">{tm.statusDraft} · v{draft.version}</span>}
      {!pub && !draft && last && <span className="tag tag--archived">{tm.statusArchived} · v{last.version}</span>}
    </span>
  )
}

async function CoursesTab({ ctx, q, language }: { ctx: Ctx; q: Q; language: UiLanguage }) {
  const t = dictionary(language).learning
  const tm = t.manage
  const companyCode = ctx.person.companyCode
  const courses = await listCourses(companyCode)
  const stats = await courseStats(companyCode, courses)
  const status: Status = (STATUSES as readonly string[]).includes(q.status ?? "") ? (q.status as Status) : "all"
  const count = (s: Status) => (s === "all" ? courses.length : courses.filter(c => statusOf(c).includes(s)).length)
  const shown = status === "all" ? courses : courses.filter(c => statusOf(c).includes(status))
  const topics = topicOptions(ctx.tenant)
  const labelOf = { all: tm.statusAll, draft: tm.statusDraft, published: tm.statusPublished, archived: tm.statusArchived }

  return (
    <>
      {q.new === "1" && (
        <section className="card mg-new">
          <h2>{tm.newCourse}</h2>
          {topics.length === 0 ? (
            <p className="quiet" style={{ margin: 0 }}>{tm.topicNone} <Link className="linkish" href={managePath("topics")}>{tm.tabTopics}</Link></p>
          ) : (
            <form action={createCourseAction} className="mg-form">
              <KeyFromLabel
                layout="fields" labelName="title" separator="-"
                initialLabel={q.title ?? ""} initialKey={q.key ?? ""}
                usedKeys={[...courses.map(c => c.key), ...RESERVED_COURSE_KEYS]} hint={tm.keyHint}
                labels={{ label: tm.courseTitle, labelPlaceholder: "", key: tm.courseKey, keyPlaceholder: "bezpecnost-v-sidle", taken: tm.keyTaken }}
              />
              <label className="field">
                <span className="field-label">{tm.topic}</span>
                <Select name="topicKey" required options={topics.map(x => ({ value: x.key, label: x.label }))} fieldLabel={tm.topic} language={language} />
              </label>
              <div className="mg-actions">
                <SubmitButton className="button">{tm.create}</SubmitButton>
                <Link className="button button--quiet" href={MANAGE_PATH}>{tm.cancel}</Link>
              </div>
            </form>
          )}
        </section>
      )}

      {courses.length === 0 ? (
        <div className="empty">
          <div className="empty-title">{t.manageEmpty}</div>
          <div className="empty-text">{tm.emptyText}</div>
          {/* Plné „Nový kurz" je v hlavičke; tu tiché (DESIGN_ODCHYLKY P10). */}
          {q.new !== "1" && <div className="empty-action"><Link className="button button--quiet" href={`${MANAGE_PATH}?new=1`}>{tm.newCourse}</Link></div>}
        </div>
      ) : (
        <>
          {/* Filter toho istého zoznamu = prepínač pohľadu, nie pilulky
              (Picker .segmented; DESIGN_ODCHYLKY P4, 6. 10. 2026). */}
          <nav className="view-switch view-switch--fit" aria-label={t.statusFilter}>
            {STATUSES.map(s => (
              <Link key={s} className={`view-switch-item${s === status ? " is-on" : ""}`} aria-current={s === status ? "true" : undefined}
                    href={`${MANAGE_PATH}${s === "all" ? "" : `?status=${s}`}`}>
                {labelOf[s]} <span className="view-switch-count">{count(s)}</span>
              </Link>
            ))}
          </nav>
          <div className="doc-table-wrap mg-table">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>{tm.colCourse}</th><th>{tm.colTopic}</th><th>{tm.colStatus}</th>
                  <th className="doc-col-right">{tm.colEnrolled}</th><th className="doc-col-right">{tm.colCompleted}</th>
                  <th>{tm.colUpdated}</th><th><span className="sr-only">{tm.edit}</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(c => (
                  <tr key={c.key}>
                    <td>
                      <Link className="mg-title" href={`/learning/manage/${c.key}`}>{c.title}</Link>
                      <div className="mg-sub"><code>{c.key}</code>{c.openEnrollment && <> · {tm.openEnrollment}</>}</div>
                    </td>
                    <td>{c.topicLabel}</td>
                    <td><StatusPills c={c} language={language} /></td>
                    <td className="doc-col-right">{stats.get(c.key)?.enrolled ?? 0}</td>
                    <td className="doc-col-right">{stats.get(c.key)?.completed ?? 0}</td>
                    <td>{formatDate(c.updatedAt ?? c.createdAt, language)}</td>
                    <td><Link className="lc-link" href={`/learning/manage/${c.key}`}>{tm.edit}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mg-cards">
            {shown.map(c => (
              <Link key={c.key} className="card mg-card" href={`/learning/manage/${c.key}`}>
                <StatusPills c={c} language={language} />
                <span className="mg-title">{c.title}</span>
                <span className="mg-sub">{c.topicLabel}</span>
                <span className="mg-sub">{tm.enrolledCompleted(stats.get(c.key)?.enrolled ?? 0, stats.get(c.key)?.completed ?? 0)}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}

async function TopicsTab({ ctx, q, language }: { ctx: Ctx; q: Q; language: UiLanguage }) {
  const tm = dictionary(language).learning.manage
  const courses = await listCourses(ctx.person.companyCode)
  const topics = [...(ctx.tenant.learningTopics ?? [])].sort((a, b) => a.label.localeCompare(b.label, "sk"))
  return (
    <>
      <section className="card mg-list">
        <div className="parts-head"><h2>{tm.topicsHeading}</h2></div>
        {topics.length === 0 && <p className="quiet mg-row">{tm.topicsEmpty}</p>}
        {topics.map(x => (
          <div key={x.key} className={`mg-row${x.retiredAt ? " is-retired" : ""}`}>
            {q.renameTopic === x.key ? (
              <form action={renameTopicAction} className="mg-inline">
                <input type="hidden" name="key" value={x.key} />
                <input className="field-input" name="label" defaultValue={x.label} aria-label={tm.topicName} required />
                <SubmitButton className="button">{tm.save}</SubmitButton>
                <Link className="button button--quiet" href={managePath("topics")}>{tm.cancel}</Link>
              </form>
            ) : (
              <>
                <span className="mg-row-main">
                  <b>{x.label}</b> <code className="quiet">{x.key}</code>
                  {x.retiredAt && <span className="tag tag--archived">{tm.retired}</span>}
                </span>
                <span className="quiet">{tm.topicCourses(courses.filter(c => c.topicKey === x.key).length)}</span>
                <Link className="lc-link" href={`${managePath("topics")}?renameTopic=${encodeURIComponent(x.key)}`}>{tm.rename}</Link>
                <form action={x.retiredAt ? restoreTopicAction : retireTopicAction}>
                  <input type="hidden" name="key" value={x.key} />
                  <SubmitButton className="button button--quiet">{x.retiredAt ? tm.restore : tm.retire}</SubmitButton>
                </form>
              </>
            )}
          </div>
        ))}
      </section>
      <section className="card mg-new">
        <h2>{tm.newTopic}</h2>
        <form action={addTopicAction} className="mg-form">
          <KeyFromLabel
            layout="fields" labelName="label" separator="_" usedKeys={topics.map(x => x.key)}
            labels={{ label: tm.topicName, labelPlaceholder: "", key: tm.topicKey, keyPlaceholder: "bezpecnost", taken: tm.keyTaken }}
          />
          <div className="mg-actions"><SubmitButton className="button button--quiet">{tm.addTopic}</SubmitButton></div>
        </form>
      </section>
    </>
  )
}

async function TagsTab({ companyCode, q, language }: { companyCode: string; q: Q; language: UiLanguage }) {
  const tm = dictionary(language).learning.manage
  const usage = await smartTagUsage(companyCode)
  const byKey = new Map<string, SmartTagUsage[]>()
  for (const u of usage) byKey.set(u.key, [...(byKey.get(u.key) ?? []), u])
  const selected = (Array.isArray(q.sel) ? q.sel : q.sel ? [q.sel] : q.merge ? q.merge.split(",") : [])
    .filter(id => usage.some(u => tagId(u) === id))
  const merging = selected.length >= 2
  const mergeTags = usage.filter(u => selected.includes(tagId(u)))
  const mergeImpact = merging ? await smartTagImpact(companyCode, mergeTags) : null
  const renaming = q.rename ? usage.find(u => tagId(u) === q.rename) ?? null : null
  const renameTo = q.to ? parseSmartTag(q.to) : null
  const renameImpact = renaming
    ? await smartTagImpact(companyCode, [renaming, ...(renameTo && q.exists === "1" ? [renameTo] : [])])
    : null
  const keyLabel = (k: string) => { const l = byKey.get(k)?.[0]?.label ?? k; return l.slice(0, l.indexOf(":")).trim() }
  const most = [...mergeTags].sort((a, b) => (b.courses + b.questions + b.tests) - (a.courses + a.questions + a.tests))[0]

  if (usage.length === 0) {
    return <div className="empty"><div className="empty-text">{tm.tagsEmpty}</div></div>
  }

  return (
    <>
      <p className="quiet mg-intro">{tm.tagsIntro}</p>
      {selected.length === 1 && <p className="mg-error">{dictionary(language).errors["learning.mergeNeedsTwo"]}</p>}

      {merging && mergeImpact && (
        <section className="card mg-new">
          <h2>{tm.mergeTitle(mergeTags.length)}</h2>
          <form action={mergeTagsAction} className="mg-form">
            {mergeTags.map(u => <input key={tagId(u)} type="hidden" name="tag" value={tagId(u)} />)}
            {/* Čo ostane: Picker(.inline) — riadky s fajkou, pole nového
                názvu pod zvoleným riadkom (ZAKLAD-vyber-a-prepinace;
                DESIGN_ODCHYLKY, 8. 10. 2026). */}
            <fieldset className="form-group mg-merge">
              <legend className="form-group-head">{tm.whatStays}</legend>
              <div className="form-list">
                {mergeTags.map(u => (
                  <label key={tagId(u)} className="form-row choice-row">
                    <input type="radio" name="target" value={tagId(u)} defaultChecked={u === most} />
                    <span className="form-row-main"><Stag label={u.label} /> <span className="quiet">{tm.usage(u.courses, u.questions, u.tests)}</span></span>
                  </label>
                ))}
                <label className="form-row choice-row">
                  <input type="radio" name="target" value="__new" />
                  <span className="form-row-main">{tm.newEntry}</span>
                </label>
                <div className="choice-field choice-field--block">
                  <input className="field-input" name="newLabel" placeholder={tm.tagPlaceholder} aria-label={tm.newEntry} />
                </div>
              </div>
            </fieldset>
            <p className="mg-impact">{tm.impact(mergeImpact.courses, mergeImpact.questions, mergeImpact.tests)} {most && tm.mergeResult(most.label)}</p>
            <div className="mg-actions">
              <SubmitButton className="button">{tm.mergeButton}</SubmitButton>
              <Link className="button button--quiet" href={managePath("tags")}>{tm.cancel}</Link>
            </div>
          </form>
        </section>
      )}

      <form id="tag-select" method="get" action={managePath("tags")} className="mg-tags">
        {/*
          Kľúč ako `.form-group` (nadpis nad kartou), hodnota ako riadok
          `.select-row` s kruhom vľavo; „Premenovať" mimo `<label>`, aby
          klik naň riadok nezaškrtol. Vybraný riadok len plným kruhom
          (ZAKLAD-zvysne-odchylky, 8. 10. 2026).
        */}
        {[...byKey.entries()].map(([key, values]) => (
          <fieldset key={key} className="form-group tag-group">
            <legend className="form-group-head">
              <span>{keyLabel(key)}</span>
              <span className="quiet tag-group-usage">{tm.usage(values.reduce((n, v) => n + v.courses, 0), values.reduce((n, v) => n + v.questions, 0), values.reduce((n, v) => n + v.tests, 0))}</span>
              <Link className="tag-group-link" href={`${managePath("tags")}?renameKey=${encodeURIComponent(key)}`}>{tm.renameKey}</Link>
            </legend>
            {q.renameKey === key && (
              <div className="tag-rename">
                <input className="field-input" name="to" form="rename-key" defaultValue={keyLabel(key)} aria-label={tm.keyLabel} required />
                <SubmitButton form="rename-key" className="button button--quiet button--sm">{tm.rename}</SubmitButton>
                <Link className="button button--quiet button--sm" href={managePath("tags")}>{tm.cancel}</Link>
              </div>
            )}
            <div className="card form-group-body form-group-body--rows">
              <div className="form-list">
                {values.map(v => {
                  const id = tagId(v)
                  const on = selected.includes(id)
                  if (renaming && tagId(renaming) === id && renameImpact) {
                    return (
                      <div key={id} className="tag-row tag-row--edit">
                        <div className="tag-rename">
                          <input className="field-input" name="to" form="rename-tag" defaultValue={q.to ?? v.label} aria-label={tm.newValue} required />
                          <SubmitButton form="rename-tag" className="button button--quiet button--sm">{q.exists === "1" ? tm.mergeButton : tm.rename}</SubmitButton>
                          <Link className="button button--quiet button--sm" href={managePath("tags")}>{tm.cancel}</Link>
                        </div>
                        <p className={q.exists === "1" ? "mg-warn" : "mg-impact"}>
                          {q.exists === "1" && renameTo ? `${tm.exists(renameTo.label)} ` : ""}
                          {tm.impact(renameImpact.courses, renameImpact.questions, renameImpact.tests)}
                        </p>
                      </div>
                    )
                  }
                  return (
                    <div key={id} className="tag-row">
                      <label className="form-row select-row">
                        <input type="checkbox" name="sel" value={id} defaultChecked={on} aria-label={`${tm.selectTag}: ${v.label}`} />
                        <span className="form-row-main">
                          <Stag label={v.label} />
                          <span className="form-row-sub">{tm.usage(v.courses, v.questions, v.tests)}</span>
                        </span>
                      </label>
                      <Link className="tag-row-link" href={`${managePath("tags")}?rename=${encodeURIComponent(id)}`}>{tm.rename}</Link>
                    </div>
                  )
                })}
              </div>
            </div>
          </fieldset>
        ))}
        <MergeSelectionBar formId="tag-select" labels={{ selected: tm.selected(999).replace("999", "{n}"), mergeInto: tm.mergeInto, clear: tm.clearSelection, mergeSelected: tm.mergeSelected }} />
      </form>

      {/* Premenovanie je vlastný formulár (nie vnorený) — polia ho odkazujú cez `form=`. */}
      {renaming && (
        <form id="rename-tag" action={renameTagAction}>
          <FormPendingSignal form="rename-tag" />
          <input type="hidden" name="from" value={tagId(renaming)} />
          {q.exists === "1" && <input type="hidden" name="confirm" value="1" />}
        </form>
      )}
      {q.renameKey && <form id="rename-key" action={renameKeyAction}><FormPendingSignal form="rename-key" /><input type="hidden" name="from" value={q.renameKey} /></form>}
    </>
  )
}

function Stag({ label }: { label: string }) {
  const at = label.indexOf(":")
  return <span className="stag"><span className="stag-k">{label.slice(0, at + 1)}</span>{label.slice(at + 1).trim()}</span>
}
