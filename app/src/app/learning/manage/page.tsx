/**
 * /learning/manage — správa kurzov (rám `docs/design/MANAGE-sprava-kurzov.md`).
 *
 * Záložky `?tab=courses | topics | tags` ako v `/organisation`. Len rola
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
import SubmitButton from "@/components/SubmitButton"
import KeyFromLabel from "@/components/KeyFromLabel"
import Select from "@/components/Select"
import MergeSelectionBar from "@/components/MergeSelectionBar"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
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
  const back = `/learning/manage?tab=${tab}`
  // Záložky sa načítajú tu, nie ako asynchrónne komponenty — nech sa
  // stránka dá vykresliť aj v teste (`renderToStaticMarkup`).
  const body = tab === "courses" ? await CoursesTab({ ctx, q, language })
    : tab === "topics" ? await TopicsTab({ ctx, q, language })
    : await TagsTab({ companyCode: ctx.person.companyCode, q, language })

  return (
    <AppShell language={language}>
      <div className="mg" style={tenantStyle(brandingView(ctx.tenant))}>
        <div className="lp-head">
          <div className="grow"><h1 className="page-title">{t.manageHeading}</h1></div>
          {tab === "courses" && <Link className="button" href="/learning/manage?tab=courses&new=1">{tm.newCourse}</Link>}
        </div>
        <Notice message={q.msg} error={q.error === "1"} back={back} />
        <nav className="tabs" aria-label={tm.tabsLabel}>
          {TABS.map(k => (
            <TabLink key={k} href={`/learning/manage?tab=${k}`} active={k === tab}>
              {{ courses: tm.tabCourses, topics: tm.tabTopics, tags: tm.tabTags }[k]}
            </TabLink>
          ))}
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
            <p className="quiet" style={{ margin: 0 }}>{tm.topicNone} <Link className="linkish" href="/learning/manage?tab=topics">{tm.tabTopics}</Link></p>
          ) : (
            <form action={createCourseAction} className="mg-form">
              <KeyFromLabel
                layout="fields" labelName="title" separator="-"
                initialLabel={q.title ?? ""} initialKey={q.key ?? ""}
                usedKeys={courses.map(c => c.key)} hint={tm.keyHint}
                labels={{ label: tm.courseTitle, labelPlaceholder: "", key: tm.courseKey, keyPlaceholder: "bezpecnost-v-sidle", taken: tm.keyTaken }}
              />
              <label className="field">
                <span className="field-label">{tm.topic}</span>
                <Select name="topicKey" required options={topics.map(x => ({ value: x.key, label: x.label }))} fieldLabel={tm.topic} language={language} />
              </label>
              <div className="mg-actions">
                <SubmitButton className="button">{tm.create}</SubmitButton>
                <Link className="button button--quiet" href="/learning/manage?tab=courses">{tm.cancel}</Link>
              </div>
            </form>
          )}
        </section>
      )}

      {courses.length === 0 ? (
        <div className="empty">
          <div className="empty-title">{t.manageEmpty}</div>
          <div className="empty-text">{tm.emptyText}</div>
          {q.new !== "1" && <p style={{ margin: "12px 0 0" }}><Link className="button" href="/learning/manage?tab=courses&new=1">{tm.newCourse}</Link></p>}
        </div>
      ) : (
        <>
          <div className="lpills">
            {STATUSES.map(s => (
              <Link key={s} className={`pill${s === status ? " is-on" : ""}`} href={`/learning/manage?tab=courses${s === "all" ? "" : `&status=${s}`}`}>
                {labelOf[s]} <span className="pill-count">{count(s)}</span>
              </Link>
            ))}
          </div>
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
                <Link className="button button--quiet" href="/learning/manage?tab=topics">{tm.cancel}</Link>
              </form>
            ) : (
              <>
                <span className="mg-row-main">
                  <b>{x.label}</b> <code className="quiet">{x.key}</code>
                  {x.retiredAt && <span className="tag tag--archived">{tm.retired}</span>}
                </span>
                <span className="quiet">{tm.topicCourses(courses.filter(c => c.topicKey === x.key).length)}</span>
                <Link className="lc-link" href={`/learning/manage?tab=topics&renameTopic=${encodeURIComponent(x.key)}`}>{tm.rename}</Link>
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
            <fieldset className="mg-choices">
              <legend className="field-label">{tm.whatStays}</legend>
              {mergeTags.map(u => (
                <label key={tagId(u)} className="mg-choice">
                  <input type="radio" name="target" value={tagId(u)} defaultChecked={u === most} />
                  <Stag label={u.label} /> <span className="quiet">{tm.usage(u.courses, u.questions, u.tests)}</span>
                </label>
              ))}
              <label className="mg-choice">
                <input type="radio" name="target" value="__new" />
                <span>{tm.newEntry}</span>
                <input className="field-input" name="newLabel" placeholder={tm.tagPlaceholder} aria-label={tm.newEntry} />
              </label>
            </fieldset>
            <p className="mg-impact">{tm.impact(mergeImpact.courses, mergeImpact.questions, mergeImpact.tests)} {most && tm.mergeResult(most.label)}</p>
            <div className="mg-actions">
              <SubmitButton className="button">{tm.mergeButton}</SubmitButton>
              <Link className="button button--quiet" href="/learning/manage?tab=tags">{tm.cancel}</Link>
            </div>
          </form>
        </section>
      )}

      <form id="tag-select" method="get" action="/learning/manage" className="mg-tags">
        <input type="hidden" name="tab" value="tags" />
        {[...byKey.entries()].map(([key, values]) => (
          <section key={key} className="card tgk">
            <div className="tgk-head">
              <b>{keyLabel(key)}</b>
              <span className="quiet">{tm.usage(values.reduce((n, v) => n + v.courses, 0), values.reduce((n, v) => n + v.questions, 0), values.reduce((n, v) => n + v.tests, 0))}</span>
              <Link className="lc-link" href={`/learning/manage?tab=tags&renameKey=${encodeURIComponent(key)}`}>{tm.renameKey}</Link>
            </div>
            {q.renameKey === key && (
              <div className="tgv-form">
                <input className="field-input" name="to" form="rename-key" defaultValue={keyLabel(key)} aria-label={tm.keyLabel} required />
                <button type="submit" form="rename-key" className="button">{tm.rename}</button>
                <Link className="button button--quiet" href="/learning/manage?tab=tags">{tm.cancel}</Link>
              </div>
            )}
            {values.map(v => {
              const id = tagId(v)
              const on = selected.includes(id)
              return (
                <div key={id} className={`tgv${on ? " is-on" : ""}`}>
                  <label className="tgv-main">
                    <input type="checkbox" name="sel" value={id} defaultChecked={on} aria-label={`${tm.selectTag}: ${v.label}`} />
                    <Stag label={v.label} />
                  </label>
                  <span className="quiet tgv-usage">{tm.usage(v.courses, v.questions, v.tests)}</span>
                  <Link className="lc-link" href={`/learning/manage?tab=tags&rename=${encodeURIComponent(id)}`}>{tm.rename}</Link>
                  {renaming && tagId(renaming) === id && renameImpact && (
                    <div className="tgv-form">
                      <input className="field-input" name="to" form="rename-tag" defaultValue={q.to ?? v.label} aria-label={tm.newValue} required />
                      <p className={q.exists === "1" ? "mg-warn" : "mg-impact"}>
                        {q.exists === "1" && renameTo ? `${tm.exists(renameTo.label)} ` : ""}
                        {tm.impact(renameImpact.courses, renameImpact.questions, renameImpact.tests)}
                      </p>
                      <button type="submit" form="rename-tag" className="button">{q.exists === "1" ? tm.mergeButton : tm.rename}</button>
                      <Link className="button button--quiet" href="/learning/manage?tab=tags">{tm.cancel}</Link>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        ))}
        <MergeSelectionBar formId="tag-select" labels={{ selected: tm.selected(999).replace("999", "{n}"), mergeInto: tm.mergeInto, clear: tm.clearSelection, mergeSelected: tm.mergeSelected }} />
      </form>

      {/* Premenovanie je vlastný formulár (nie vnorený) — polia ho odkazujú cez `form=`. */}
      {renaming && (
        <form id="rename-tag" action={renameTagAction}>
          <input type="hidden" name="from" value={tagId(renaming)} />
          {q.exists === "1" && <input type="hidden" name="confirm" value="1" />}
        </form>
      )}
      {q.renameKey && <form id="rename-key" action={renameKeyAction}><input type="hidden" name="from" value={q.renameKey} /></form>}
    </>
  )
}

function Stag({ label }: { label: string }) {
  const at = label.indexOf(":")
  return <span className="stag"><span className="stag-k">{label.slice(0, at + 1)}</span>{label.slice(at + 1).trim()}</span>
}
