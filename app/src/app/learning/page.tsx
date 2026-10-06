/**
 * /learning — Vzdelávanie: moje kurzy (rám `docs/design/LEARNING-moje-kurzy.md`).
 *
 * Tri skupiny — Rozpracované → Na zápis → Dokončené — všetko odvodené
 * z udalostí (D119): `groupMyCourses()` rozdelí, `CourseCard` ukáže.
 * Filter (téma + smart:tagy) je v adrese, bez JavaScriptu; na desktope
 * stĺpec vľavo, pod 1024 px pilulky tém a `<details>` so smart:tagmi.
 * Pri vypnutom module stránka neexistuje (D123).
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { learningContext, OPERATOR_CONTACT } from "@/lib/learning"
import { onboardingContext } from "@/lib/session"
import { peopleContext } from "@/lib/people"
import { listCourses } from "@/lib/coursesDb"
import { enrollmentsForPerson } from "@/lib/enrollmentsDb"
import { progressFactsMany } from "@/lib/learningProgressDb"
import { certificatesForPerson } from "@/lib/certificatesDb"
import { groupMyCourses, type MyCourse } from "@/lib/enrollments"
import { publishedVersion } from "@/lib/courses"
import { isFiltered, learningFacets, learningFilterFromQuery, learningHref, type LearningFilter } from "@/lib/learningFilters"
import { tagId } from "@/lib/smartTags"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import CourseCard, { type CourseCardKind } from "@/components/CourseCard"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { enrolAction } from "./actions"

export const dynamic = "force-dynamic"

/** Nad toľko dokončenými kartami sa stránkuje (rám: „Nad 6 kartami .pager"). */
const DONE_PAGE = 6

export default async function LearningPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const q = normalizeQuery<{ topic?: string; tag?: string | string[]; page?: string; msg?: string; error?: string }>(await searchParams)
  const ctx = await learningContext()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state === "disabled") return learningOff()
  if (ctx.state !== "ready") notFound()

  const language = ctx.person.language
  const t = dictionary(language).learning
  const companyCode = ctx.person.companyCode
  const [courses, enrollments] = await Promise.all([listCourses(companyCode), enrollmentsForPerson(companyCode, ctx.person.id)])
  const [facts, certs] = await Promise.all([progressFactsMany(companyCode, enrollments.map(e => e.id)), certificatesForPerson(companyCode, ctx.person.id)])
  const certNumber = (i: MyCourse) => certs.find(c => c.enrollmentId === i.enrollment?.id && !c.revokedAt)?.registrationNumber ?? null
  const filter = learningFilterFromQuery(q)

  // Viditeľné = zapísané + otvorené zverejnené (rám: počty filtra z nich).
  const enrolledKeys = new Set(enrollments.map(e => e.courseKey))
  const visible = courses.filter(c => enrolledKeys.has(c.key) || (c.openEnrollment && publishedVersion(c)))
  const all = groupMyCourses({ courses, enrollments, factsByEnrollment: facts })
  const groups = groupMyCourses({ courses, enrollments, factsByEnrollment: facts, filter })
  const facets = learningFacets(visible, filter)
  const total = all.inProgress.length + all.toEnroll.length + all.done.length
  const shown = groups.inProgress.length + groups.toEnroll.length + groups.done.length

  const page = Math.max(1, Number(q.page) || 1)
  const doneSlice = groups.done.slice((page - 1) * DONE_PAGE, page * DONE_PAGE)
  const donePages = Math.max(1, Math.ceil(groups.done.length / DONE_PAGE))
  const filterNames = [
    ...(filter.topicKey ? [facets.topics.find(x => x.key === filter.topicKey)?.label ?? filter.topicKey] : []),
    ...filter.tags.map(x => labelOf(facets, x)),
  ].map(n => `„${n}“`).join(", ")

  const cards = (items: MyCourse[], kindOf: (i: MyCourse) => CourseCardKind) => (
    <div className="lcards">
      {items.map(i => <CourseCard key={i.course.key} item={i} kind={kindOf(i)} filter={filter} language={language} enrolAction={enrolAction} certificateNumber={certNumber(i)} />)}
    </div>
  )

  return (
    <AppShell language={language}>
      <div className="lp" style={tenantStyle(brandingView(ctx.tenant))}>
        <div className="lp-head">
          <div className="grow">
            <h1 className="page-title">{t.heading}</h1>
            <p className="quiet page-lead lp-lead">{t.intro}</p>
          </div>
        </div>
        <Notice language={language} message={q.msg} error={q.error === "1"} back="/learning" />

        {total === 0 ? (
          <div className="empty">
            <div className="empty-title">{t.empty}</div>
            <div className="empty-text">{t.emptyNote}</div>
          </div>
        ) : (
          <div className="lp-cols">
            <Filters facets={facets} filter={filter} language={language} />
            <div>
              <MobileFilters facets={facets} filter={filter} language={language} />
              {filter.tags.length > 0 && (
                <div className="lchips">
                  {filter.tags.map(x => (
                    <Link key={tagId(x)} className="library-chip" href={learningHref(filter, { toggleTag: x })} aria-label={t.removeFilter(labelOf(facets, x))}>
                      {labelOf(facets, x)} <span className="library-chip-x" aria-hidden="true">×</span>
                    </Link>
                  ))}
                  <Link className="linkish" href={learningHref(filter, { clear: true })}>{t.clearFilters}</Link>
                </div>
              )}

              {shown === 0 && isFiltered(filter) && (
                <div className="empty">
                  <div className="empty-text">{t.filterNone(filterNames)}</div>
                  <p style={{ margin: "12px 0 0" }}><Link className="button button--quiet" href={learningHref(filter, { clear: true })}>{t.clearFilters}</Link></p>
                </div>
              )}
              {shown > 0 && !isFiltered(filter) && all.inProgress.length === 0 && all.toEnroll.length === 0 && (
                <div className="empty empty--compact">
                  <div className="empty-title">{t.nothingWaiting}</div>
                  <div className="empty-text">{t.nothingWaitingNote}</div>
                </div>
              )}

              {groups.inProgress.length > 0 && (
                <section className="lgroup">
                  <div className="lgroup-head"><h2>{t.groupInProgress}</h2><span className="quiet">{groups.inProgress.length}</span></div>
                  {cards(groups.inProgress, () => "in-progress")}
                </section>
              )}
              {groups.toEnroll.length > 0 && (
                <section className="lgroup">
                  <div className="lgroup-head"><h2>{t.groupToEnroll}</h2><span className="quiet">{groups.toEnroll.length}</span></div>
                  {cards(groups.toEnroll, i => (i.enrollment ? "assigned" : "open"))}
                </section>
              )}
              {groups.done.length > 0 && (
                <section className="lgroup">
                  <div className="lgroup-head"><h2>{t.groupDone}</h2><span className="quiet">{groups.done.length}</span></div>
                  {cards(doneSlice, () => "done")}
                  {donePages > 1 && (
                    <nav className="pager" aria-label={t.groupDone}>
                      <span className="pager-count">{page} / {donePages}</span>
                      <span className="pager-spacer" />
                      <Link className="button button--quiet pager-link" aria-disabled={page <= 1} href={pageHref(filter, page - 1)}>‹</Link>
                      <Link className="button button--quiet pager-link" aria-disabled={page >= donePages} href={pageHref(filter, page + 1)}>›</Link>
                    </nav>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function pageHref(f: LearningFilter, page: number): string {
  const base = learningHref(f)
  return page <= 1 ? base : `${base}${base.includes("?") ? "&" : "?"}page=${page}`
}

type Facets = ReturnType<typeof learningFacets>

function labelOf(facets: Facets, tag: { key: string; value: string }): string {
  return facets.tagGroups.find(g => g.key === tag.key)?.values.find(v => v.value === tag.value)?.label ?? tagId(tag)
}

/** Desktop (≥ 1024 px): stĺpec vľavo — téma jedna hodnota, tagy po kľúčoch. */
function Filters({ facets, filter, language }: { facets: Facets; filter: LearningFilter; language: UiLanguage }) {
  const t = dictionary(language).learning
  const on = new Set(filter.tags.map(tagId))
  return (
    <aside className="lf" aria-label={t.topic}>
      {facets.topics.length > 0 && (
        <div>
          <p className="lf-k">{t.topic}</p>
          <div className="lf-group">
            <Link className={`facet${!filter.topicKey ? " is-on" : ""}`} href={learningHref(filter, { topicKey: null })}>
              <span className="facet-name">{t.allTopics}</span>
            </Link>
            {facets.topics.map(x => (
              <Link key={x.key} className={`facet${filter.topicKey === x.key ? " is-on" : ""}`} href={learningHref(filter, { topicKey: x.key })}>
                <span className="facet-name">{x.label}</span><span className="facet-count">{x.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {facets.tagGroups.map(g => (
        <div key={g.key}>
          <p className="lf-k">{g.keyLabel}</p>
          <div className="lf-group">
            {g.values.map(v => (
              <Link key={v.value} className={`facet${on.has(tagId(v)) ? " is-on" : ""}`} href={learningHref(filter, { toggleTag: v })}>
                <span className="facet-box" aria-hidden="true">{on.has(tagId(v)) ? "✓" : ""}</span>
                <span className="facet-name">{v.valueLabel}</span><span className="facet-count">{v.count}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
      {facets.tagGroups.length > 0 && <p className="lf-note">{t.filterNote}</p>}
    </aside>
  )
}

/** Pod 1024 px: pilulky tém a `<details>` so smart:tagmi (otvorené, keď je niečo zvolené). */
function MobileFilters({ facets, filter, language }: { facets: Facets; filter: LearningFilter; language: UiLanguage }) {
  const t = dictionary(language).learning
  const on = new Set(filter.tags.map(tagId))
  return (
    <div className="lf-mobile">
      {facets.topics.length > 1 && (
        <div className="lpills">
          <Link className={`pill${!filter.topicKey ? " is-on" : ""}`} href={learningHref(filter, { topicKey: null })}>{t.allTopics}</Link>
          {facets.topics.map(x => (
            <Link key={x.key} className={`pill${filter.topicKey === x.key ? " is-on" : ""}`} href={learningHref(filter, { topicKey: x.key })}>
              {x.label} <span className="pill-count">{x.count}</span>
            </Link>
          ))}
        </div>
      )}
      {facets.tagGroups.length > 0 && (
        <details className="lfd" open={filter.tags.length > 0}>
          <summary>{t.smartTags}{filter.tags.length > 0 && <span className="quiet">{t.selected(filter.tags.length)}</span>}</summary>
          <div className="lfd-body">
            {facets.tagGroups.map(g => (
              <div key={g.key} className="lf-group">
                <p className="lf-k">{g.keyLabel}</p>
                {g.values.map(v => (
                  <Link key={v.value} className={`stag${on.has(tagId(v)) ? " is-on" : ""}`} href={learningHref(filter, { toggleTag: v })}>
                    {v.valueLabel} <span className="pill-count">{v.count}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

/**
 * Organizácia nemá modul zapnutý (SHELL-menu-v-hlavicke, Q5). Vzdelávanie
 * je v lište aj v menu u každého, preto tu nie je 404 ani presmerovanie,
 * ale vysvetlenie a cesta ďalej. Správca organizácie navyše vidí, komu
 * napísať — modul zapína prevádzkovateľ, nie organizácia sama.
 */
async function learningOff() {
  const ctx = await onboardingContext()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()
  const language = ctx.person.language
  const t = dictionary(language).learning.off
  const isOrgAdmin = (await peopleContext()).state === "ready"
  return (
    <AppShell language={language}>
      <section className="card learning-off" style={tenantStyle(brandingView(ctx.tenant))}>
        <span className="learning-off-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.6 7 9 3.4 16.4 7 9 10.6z" />
            <path d="M4.6 8.5v3.6c1.2 1.3 2.7 2 4.4 2s3.2-.7 4.4-2V8.5" />
            <path d="M16.4 7v4.2" />
          </svg>
        </span>
        <h1 className="page-title">{t.title}</h1>
        <p className="quiet page-lead">{t.lead}</p>
        {isOrgAdmin && <p className="learning-off-admin">{t.admin(OPERATOR_CONTACT)}</p>}
        <div className="learning-off-actions">
          <Link className="button" href="/documents">{t.tasks}</Link>
          <Link className="button button--quiet" href="/">{t.back}</Link>
        </div>
      </section>
    </AppShell>
  )
}
