/**
 * /learning/manage/[courseKey] — úprava kurzu (rám `docs/design/MANAGE-COURSE-uprava-kurzu.md`).
 *
 * Karta stavu verzie Koncept → Zverejnené → Archív (tvar karty postupu
 * znenia, `.flow`) a záložka Časti: zoznam s poradím, detail časti s blokmi
 * a formulár „Pridať blok" (text, obrázok, galéria, dokument z knižnice,
 * video nahraté alebo externé). Meniť sa dá len koncept — zverejnená verzia
 * je len na čítanie (D118), zmena = „Nová verzia".
 *
 * Záložka Nastavenia: polia verzie, téma, smart:tagy (`SmartTagInput`),
 * priebeh a právny základ. Záložka Zapísaní: stav bez skóre (D121),
 * prideľovanie adresátom ako pri norme a export CSV.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { learningAdminContext } from "@/lib/learning"
import { getCourse } from "@/lib/coursesDb"
import { draftVersion, publishedVersion, publishProblems, type ContentBlock, type Course, type CourseVersion, type Part } from "@/lib/courses"
import { courseStats } from "@/lib/learningStats"
import { documentChoices } from "@/lib/courseDocs"
import { MAX_BYTES } from "@/lib/fileStore"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import TabLink from "@/components/TabLink"
import FlowSteps from "@/components/FlowSteps"
import SubmitButton from "@/components/SubmitButton"
import Select from "@/components/Select"
import CourseMediaUpload from "@/components/CourseMediaUpload"
import SmartTagInput from "@/components/SmartTagInput"
import { topicOptions } from "@/lib/learningTopics"
import { smartTagUsage } from "@/lib/smartTagsDb"
import { legalBasisOptions } from "@/lib/legalBases"
import { UI_LANGUAGES } from "@/lib/i18n"
import type { Tenant } from "@/lib/tenants"
import MultiSelect from "@/components/MultiSelect"
import { treeOptions } from "@/lib/treeOptions"
import { audienceFromSelection, audienceMembers } from "@/lib/assignments"
import { audiencesInOrg } from "@/lib/persons"
import { allDepartments, flattenTree, counts } from "@/lib/departments"
import { courseRoster, type RosterRow, type RosterState } from "@/lib/learningStats"
import { listTests } from "@/lib/testsDb"
import { certificatesForCourse } from "@/lib/certificatesDb"
import { questionCount, type Test } from "@/lib/tests"
import { normalizeLayout } from "@/lib/appNav"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import {
  addBlockAction, addPartAction, archiveAction, moveBlockAction, movePartAction, newVersionAction,
  addPartTestAction, assignCourseAction, revokeCertificateAction, partTestRequiredAction, publishAction, removePartTestAction, removeBlockAction, removePartAction, saveSettingsAction, updateBlockAction, updatePartAction,
} from "./actions"

export const dynamic = "force-dynamic"

type Q = {
  layout?: string; tab?: string; part?: string; add?: string; src?: string; editBlock?: string; msg?: string; error?: string
  filter?: string; assign?: string; preview?: string; all?: string; audience?: string | string[]; revoke?: string
}
type Edit = ReturnType<typeof dictionary>["learning"]["edit"]

const BLOCK_TYPES = ["text", "image", "gallery", "document", "video"] as const

export default async function ManageCoursePage({ params, searchParams }: {
  params: Promise<{ courseKey: string }>
  searchParams: Promise<RawQuery>
}) {
  const q = normalizeQuery<Q>(await searchParams)
  const ctx = await learningAdminContext()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()
  const courseKey = decodeURIComponent((await params).courseKey)
  const course = await getCourse(ctx.person.companyCode, courseKey)
  if (!course) notFound()

  const language = ctx.person.language
  const t = dictionary(language).learning
  const te = t.edit
  const draft = draftVersion(course)
  const published = publishedVersion(course)
  const latest = [...course.versions].sort((a, b) => b.version - a.version)[0]
  const shown = draft ?? published ?? latest
  const base = `/learning/manage/${course.key}`
  const stats = (await courseStats(ctx.person.companyCode, [course])).get(course.key) ?? { enrolled: 0, completed: 0 }
  const part = q.part ? shown.parts.find(p => p.key === q.part) ?? null : null
  const docs = part && draft && q.add === "document" ? await documentChoices(ctx.person.companyCode) : []
  const allTests = part ? await listTests(ctx.person.companyCode) : []
  const tab = q.tab === "settings" ? "settings" : q.tab === "people" ? "people" : "parts"
  const usage = tab === "settings" ? await smartTagUsage(ctx.person.companyCode) : []

  return (
    <AppShell layout={normalizeLayout(q.layout)} language={language}>
      <div className="mc" style={tenantStyle(brandingView(ctx.tenant))}>
        <p className="detail-back"><Link className="quiet" href="/learning/manage">← {t.manageHeading}</Link></p>
        <Notice message={q.msg} error={q.error === "1"} back={`${base}${part ? `?tab=parts&part=${part.key}` : ""}`} />
        <header className="ch">
          <span className="ch-topic">{course.topicLabel}</span>
          <h1 className="page-title">{shown.title}</h1>
          <div className="ch-facts"><code>{course.key}</code></div>
        </header>

        <StatusCard course={course} draft={draft} published={published} latest={latest} inProgress={stats.enrolled - stats.completed} te={te} language={language} />

        <nav className="tabs" aria-label={t.manage.tabsLabel}>
          <TabLink href={`${base}?tab=parts`} active={tab === "parts"}>{te.tabParts}</TabLink>
          <TabLink href={`${base}?tab=settings`} active={tab === "settings"}>{te.tabSettings}</TabLink>
          <TabLink href={`${base}?tab=people`} active={tab === "people"}>{te.tabPeople}</TabLink>
        </nav>

        <div className="mc-body">
          {tab === "people" ? (
            await PeopleTab({ course, published, companyCode: ctx.person.companyCode, q, language })
          ) : tab === "settings" ? (
            <SettingsTab course={course} version={shown} editable={Boolean(draft)} tenant={ctx.tenant} usage={usage} language={language} />
          ) : (
            <>
              {!draft && <p className="mc-ro">{te.readOnly(shown.version)}</p>}
              {part
                ? <PartDetail course={course} version={shown} part={part} editable={Boolean(draft)} q={q} docs={docs} tests={allTests} te={te} language={language} />
                : <PartList course={course} version={shown} editable={Boolean(draft)} te={te} />}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function Hidden({ values }: { values: Record<string, string> }) {
  return <>{Object.entries(values).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}</>
}

function StatusCard({ course, draft, published, latest, inProgress, te, language }: {
  course: Course
  draft: CourseVersion | null
  published: CourseVersion | null
  latest: CourseVersion
  inProgress: number
  te: Edit
  language: UiLanguage
}) {
  const key = { courseKey: course.key }
  if (draft) {
    const problems = publishProblems(draft)
    const partProblems = problems.filter(p => !["noLegalBasis", "noIssuer"].includes(p.code))
    const other = problems.filter(p => p.code === "noIssuer")
    const legalOk = !problems.some(p => p.code === "noLegalBasis")
    const partTitle = (p: (typeof problems)[number]) => ("partKey" in p ? draft.parts.find(x => x.key === p.partKey)?.title ?? p.partKey : "")
    return (
      <section className="card flow mc-status">
        <div className="flow-head"><h2>{problems.length ? te.missingHeading : te.readyHeading}</h2></div>
        <FlowSteps states={["current", "todo", "todo"]} names={te.steps} subs={[te.stepSub.draft(draft.version), published ? te.stepSub.published(published.version) : "", ""]} label={te.stepsLabel} />
        <div className="flow-body">
          <div className="flow-check">
            <CheckRow ok={partProblems.length === 0} title={te.checkParts} notes={partProblems.map(p => te.problem(p.code, partTitle(p)))} />
            <CheckRow ok={legalOk} title={te.checkLegal} notes={legalOk ? [] : [te.problem("noLegalBasis", "")]} />
            <CheckRow ok title={te.checkTopic} notes={[course.topicLabel]} />
            {other.map(p => <CheckRow key={p.code} ok={false} title={te.problem(p.code, "")} notes={[]} />)}
          </div>
          {published && <p className="flow-lead">{te.keepPublished(published.version, draft.version)}</p>}
        </div>
        <div className="flow-foot mc-foot">
          <form action={publishAction}>
            <Hidden values={key} />
            {problems.length
              ? <button type="button" className="button" disabled aria-disabled="true">{te.publishButton(draft.version)}</button>
              : <SubmitButton className="button">{te.publishButton(draft.version)}</SubmitButton>}
          </form>
          <span className="quiet">{problems.length ? te.publishDisabledNote : te.savedAt(formatDate(draft.updatedAt ?? draft.createdAt, language))}</span>
        </div>
      </section>
    )
  }
  if (published) {
    return (
      <section className="card flow mc-status">
        <FlowSteps states={["done", "current", "todo"]} names={te.steps} subs={["", te.stepSub.published(published.version), ""]} label={te.stepsLabel} />
        <div className="flow-body"><p className="flow-lead">{te.publishedLead}</p></div>
        <div className="flow-foot mc-foot">
          <form action={newVersionAction}><Hidden values={key} /><SubmitButton className="button">{te.newVersion}</SubmitButton></form>
          <form action={archiveAction}><Hidden values={key} /><SubmitButton className="button button--quiet">{te.archive}</SubmitButton></form>
        </div>
      </section>
    )
  }
  return (
    <section className="card flow mc-status">
      <FlowSteps states={["done", "done", "current"]} names={te.steps} subs={["", "", te.stepSub.archived(latest.version)]} label={te.stepsLabel} />
      <div className="flow-body"><p className="flow-lead">{te.archivedLead(inProgress)}</p></div>
      <div className="flow-foot mc-foot">
        <form action={newVersionAction}><Hidden values={key} /><SubmitButton className="button">{te.restore}</SubmitButton></form>
      </div>
    </section>
  )
}

function CheckRow({ ok, title, notes }: { ok: boolean; title: string; notes: string[] }) {
  return (
    <div className="flow-check-row">
      <span className={`flow-check-ico ${ok ? "is-ok" : "is-todo"}`} aria-hidden="true">{ok ? "✓" : "!"}</span>
      <div className="flow-check-main">
        {title}
        {notes.map(n => <div key={n} className="flow-check-note">{n}</div>)}
      </div>
    </div>
  )
}

function PartList({ course, version, editable, te }: { course: Course; version: CourseVersion; editable: boolean; te: Edit }) {
  const base = `/learning/manage/${course.key}`
  return (
    <>
      {version.parts.length === 0 ? (
        <div className="empty"><div className="empty-title">{te.noParts}</div></div>
      ) : (
        <section className="card mc-list">
          <div className="parts-head"><h2>{te.partsHeading}</h2></div>
          <ol className="pr-list">
            {version.parts.map((p, i) => (
              <li key={p.key} className="mc-row">
                <span className="pr-mark pr-mark--sm" aria-hidden="true">{i + 1}</span>
                <span className="mc-row-main">
                  <b>{p.title}</b>
                  <span className="mc-row-meta">
                    <span className={p.required ? "tag" : "tag tag--archived"}>{p.required ? te.required : te.optional}</span>
                    {te.blocksTests(p.blocks.length, p.tests.length)}
                  </span>
                </span>
                {editable && (
                  <span className="mc-arrows">
                    <MoveButton action={movePartAction} values={{ courseKey: course.key, partKey: p.key, dir: "up" }} label={te.up} disabled={i === 0} glyph="↑" />
                    <MoveButton action={movePartAction} values={{ courseKey: course.key, partKey: p.key, dir: "down" }} label={te.down} disabled={i === version.parts.length - 1} glyph="↓" />
                  </span>
                )}
                <Link className="lc-link" href={`${base}?tab=parts&part=${p.key}`}>{editable ? te.editPart : te.view}</Link>
              </li>
            ))}
          </ol>
        </section>
      )}
      {editable && (
        <section className="card mg-new">
          <h2>{te.newPart}</h2>
          <form action={addPartAction} className="mc-inline">
            <Hidden values={{ courseKey: course.key }} />
            <input className="field-input" name="title" aria-label={te.partTitle} placeholder={te.partTitle} required />
            <label className="mc-check"><input type="checkbox" name="required" value="1" defaultChecked /> {te.required}</label>
            <SubmitButton className="button">{te.addPart}</SubmitButton>
          </form>
        </section>
      )}
    </>
  )
}

function MoveButton({ action, values, label, disabled, glyph }: {
  action: (fd: FormData) => Promise<void>
  values: Record<string, string>
  label: string
  disabled: boolean
  glyph: string
}) {
  return (
    <form action={action}>
      <Hidden values={values} />
      <button type="submit" className="button button--quiet mc-arrow" aria-label={label} disabled={disabled}>{glyph}</button>
    </form>
  )
}

function blockSummary(b: ContentBlock, te: Edit): string {
  switch (b.type) {
    case "text": return b.markdown.replace(/[#*_>`]/g, "").slice(0, 90)
    case "image": return b.alt
    case "gallery": return `${b.items.length} × ${b.items[0]?.alt ?? ""}`
    case "document": return b.title
    case "video":
      if (b.source.kind === "external") return b.source.url
      return [b.durationSec ? `${Math.floor(b.durationSec / 60)}:${String(b.durationSec % 60).padStart(2, "0")}` : "", b.mustWatch ? te.mustWatchShort : ""].filter(Boolean).join(" · ")
  }
}

function PartDetail({ course, version, part, editable, q, docs, tests, te, language }: {
  course: Course
  version: CourseVersion
  part: Part
  editable: boolean
  q: Q
  docs: Awaited<ReturnType<typeof documentChoices>>
  tests: Test[]
  te: Edit
  language: UiLanguage
}) {
  const ta = dictionary(language).learning.attempt
  const base = `/learning/manage/${course.key}`
  const self = `${base}?tab=parts&part=${part.key}`
  const ids = { courseKey: course.key, partKey: part.key }
  const add = (BLOCK_TYPES as readonly string[]).includes(q.add ?? "") ? q.add! : "text"
  const external = q.src === "external"
  const mediaLabels = (kind: "image" | "video") => ({
    title: kind === "video" ? te.mediaVideo : te.mediaImage, note: te.mediaNote, progressTitle: te.progressTitle,
    uploading: te.uploading, failed: te.uploadFailed, tooLarge: te.tooLarge,
  })

  return (
    <div className="mc-detail">
      <aside className="mc-side">
        <Link className="lc-link mc-back" href={`${base}?tab=parts`}>{te.allParts}</Link>
        {version.parts.map((p, i) => (
          <Link key={p.key} className={`pp-orow${p.key === part.key ? " is-current" : ""}`} href={`${base}?tab=parts&part=${p.key}`}>
            <span className="pr-mark pr-mark--sm" aria-hidden="true">{i + 1}</span><span>{p.title}</span>
          </Link>
        ))}
      </aside>

      <div className="mc-main">
        {editable ? (
          <section className="card mg-new mc-partform">
            <form action={updatePartAction} className="mc-form">
              <Hidden values={ids} />
              <label className="field"><span className="field-label">{te.partTitle}</span><input className="field-input" name="title" defaultValue={part.title} required /></label>
              <label className="field"><span className="field-label">{te.summary}</span><input className="field-input" name="summary" defaultValue={part.summary ?? ""} /></label>
              <div className="mc-inline">
                <label className="mc-check"><input type="checkbox" name="required" value="1" defaultChecked={part.required} /> {te.required}</label>
                <label className="field mc-minutes"><span className="field-label">{te.minutes}</span><input className="field-input" name="estimatedMinutes" type="number" min="1" defaultValue={part.estimatedMinutes ?? ""} /></label>
              </div>
              <div className="mg-actions"><SubmitButton className="button">{te.save}</SubmitButton></div>
            </form>
            <form action={removePartAction}><Hidden values={ids} /><SubmitButton className="button button--quiet">{te.removePart}</SubmitButton></form>
          </section>
        ) : (
          <h2 className="mc-h2">{part.title}</h2>
        )}

        <section className="card mc-list">
          <div className="parts-head"><h2>{te.blocksHeading}</h2></div>
          {part.blocks.length === 0 && <p className="quiet mc-row">{te.noBlocks}</p>}
          {part.blocks.map((b, i) => (
            <div key={b.id} className="mc-row">
              <span className="btype">{b.type === "video" && b.source.kind === "external" ? te.blockTypes.videoExternal : te.blockTypes[b.type]}</span>
              <span className="mc-row-main"><span className="mc-row-meta">{blockSummary(b, te)}</span></span>
              {editable && (
                <>
                  <span className="mc-arrows">
                    <MoveButton action={moveBlockAction} values={{ ...ids, blockId: b.id, dir: "up" }} label={te.up} disabled={i === 0} glyph="↑" />
                    <MoveButton action={moveBlockAction} values={{ ...ids, blockId: b.id, dir: "down" }} label={te.down} disabled={i === part.blocks.length - 1} glyph="↓" />
                  </span>
                  {["text", "image", "video"].includes(b.type) && !(b.type === "video" && b.source.kind === "external") && (
                    <Link className="lc-link" href={`${self}&editBlock=${b.id}`}>{te.editBlock}</Link>
                  )}
                  <form action={removeBlockAction}><Hidden values={{ ...ids, blockId: b.id }} /><SubmitButton className="button button--quiet">{te.removeBlock}</SubmitButton></form>
                </>
              )}
              {editable && q.editBlock === b.id && (
                <form action={updateBlockAction} className="mc-form mc-blockedit">
                  <Hidden values={{ ...ids, blockId: b.id }} />
                  {b.type === "text" && <textarea className="field-input" name="markdown" rows={8} defaultValue={b.markdown} aria-label={te.markdown} />}
                  {b.type === "image" && (
                    <>
                      <label className="field"><span className="field-label">{te.alt}</span><input className="field-input" name="alt" defaultValue={b.alt} required /></label>
                      <label className="field"><span className="field-label">{te.caption}</span><input className="field-input" name="caption" defaultValue={b.caption ?? ""} /></label>
                    </>
                  )}
                  {b.type === "video" && <label className="mc-check"><input type="checkbox" name="mustWatch" value="1" defaultChecked={b.mustWatch} /> {te.mustWatch}</label>}
                  <div className="mg-actions"><SubmitButton className="button">{te.save}</SubmitButton><Link className="button button--quiet" href={self}>{te.cancel}</Link></div>
                </form>
              )}
            </div>
          ))}
        </section>

        {editable && (
          <section className="card mg-new" id="add">
            <h2>{te.addBlock}</h2>
            <nav className="lpills" aria-label={te.blockType}>
              {BLOCK_TYPES.map(k => (
                <Link key={k} className={`pill${k === add ? " is-on" : ""}`} href={`${self}&add=${k}#add`}>{te.blockTypes[k]}</Link>
              ))}
            </nav>
            <form action={addBlockAction} className="mc-form">
              <Hidden values={{ ...ids, type: add, ...(add === "video" ? { source: external ? "external" : "upload" } : {}) }} />
              {add === "text" && <textarea className="field-input" name="markdown" rows={8} aria-label={te.markdown} required />}
              {(add === "image" || add === "gallery") && (
                <>
                  <CourseMediaUpload kind={add} accept=".jpg,.jpeg,.png,.webp,.gif" maxBytes={MAX_BYTES} labels={mediaLabels("image")} />
                  <label className="field"><span className="field-label">{add === "gallery" ? te.altGallery : te.alt}</span><input className="field-input" name="alt" required /></label>
                  {add === "image" && <label className="field"><span className="field-label">{te.caption}</span><input className="field-input" name="caption" /></label>}
                </>
              )}
              {add === "document" && (docs.length
                ? <label className="field"><span className="field-label">{te.document}</span><Select name="document" required searchable options={docs.map(d => ({ value: `${d.documentId}|${d.versionId}`, label: d.title, path: d.label }))} fieldLabel={te.document} language={language} /></label>
                : <p className="quiet">{te.noDocuments}</p>)}
              {add === "video" && (
                <>
                  <nav className="lpills" aria-label={te.videoSource}>
                    <Link className={`pill${!external ? " is-on" : ""}`} href={`${self}&add=video#add`}>{te.sourceUpload}</Link>
                    <Link className={`pill${external ? " is-on" : ""}`} href={`${self}&add=video&src=external#add`}>{te.sourceExternal}</Link>
                  </nav>
                  {external ? (
                    <>
                      <label className="field"><span className="field-label">{te.url}</span><input className="field-input" name="url" type="url" required /></label>
                      <div className="lnote lnote--warn"><span className="lnote-mark" aria-hidden="true">!</span><span className="lnote-text">{te.externalWarn}</span></div>
                    </>
                  ) : (
                    <>
                      <CourseMediaUpload kind="video" accept=".mp4,.webm" maxBytes={MAX_BYTES} labels={mediaLabels("video")} />
                      <label className="mc-check"><input type="checkbox" name="mustWatch" value="1" /> {te.mustWatch}</label>
                      <p className="quiet mc-note">{te.mustWatchNote}</p>
                    </>
                  )}
                </>
              )}
              <div className="mg-actions"><SubmitButton className="button">{te.add}</SubmitButton></div>
            </form>
          </section>
        )}

        <section className="card mc-list">
          <div className="parts-head"><h2>{te.testsHeading}</h2></div>
          {part.tests.map(pt => {
            const t = tests.find(x => x.key === pt.testKey)
            return (
              <div key={pt.testKey} className="mc-row">
                <span className="mc-row-main">
                  <Link className="mg-title" href={`/learning/tests/${pt.testKey}`}>{t?.title ?? pt.testKey}</Link>
                  {t && <span className="mc-row-meta">{ta.testMeta(questionCount(t), t.rules.passingPercent, t.rules.maxAttempts, t.responsible.map(r => r.fullName).join(", "))}</span>}
                </span>
                {editable ? (
                  <>
                    <form action={partTestRequiredAction}><Hidden values={{ ...ids, testKey: pt.testKey, required: pt.required ? "0" : "1" }} />
                      <button type="submit" className="button button--quiet" aria-pressed={pt.required}>{pt.required ? `✓ ${ta.testRequired}` : ta.testRequired}</button></form>
                    <form action={removePartTestAction}><Hidden values={{ ...ids, testKey: pt.testKey }} /><SubmitButton className="button button--quiet">{ta.removeTest}</SubmitButton></form>
                  </>
                ) : <span className="quiet">{pt.required ? ta.testRequired : ""}{pt.testVersion ? ` · v${pt.testVersion}` : ""}</span>}
              </div>
            )
          })}
          {editable && (() => {
            const offer = tests.filter(t => t.status === "ready" && !part.tests.some(x => x.testKey === t.key))
            return offer.length ? (
              <form action={addPartTestAction} className="mc-row mc-inline">
                <Hidden values={ids} />
                <Select name="testKey" searchable options={offer.map(t => ({ value: t.key, label: t.title }))} fieldLabel={ta.assignTest} language={language} />
                <label className="mc-check"><input type="checkbox" name="required" value="1" defaultChecked /> {ta.testRequired}</label>
                <SubmitButton className="button">{ta.assignTest}</SubmitButton>
              </form>
            ) : <p className="quiet mc-row">{ta.noReadyTests}</p>
          })()}
        </section>
      </div>
    </div>
  )
}

function SettingsTab({ course, version, editable, tenant, usage, language }: {
  course: Course
  version: CourseVersion
  editable: boolean
  tenant: Tenant
  usage: Awaited<ReturnType<typeof smartTagUsage>>
  language: UiLanguage
}) {
  const d = dictionary(language)
  const ts = d.learning.settings
  const tc = d.learning.course
  const tm = d.learning.manage
  const topics = topicOptions(tenant)
  // Vyradená téma kurzu zostáva v ponuke, kým ju človek nezmení.
  const topicList = topics.some(x => x.key === course.topicKey) ? topics : [{ key: course.topicKey, label: course.topicLabel }, ...topics]
  const legal = legalBasisOptions(tenant)
  const langName = (l: string) => d.people.languages[l] ?? l

  if (!editable) {
    const rows: [string, string][] = [
      [ts.title, version.title], [ts.subtitle, version.subtitle ?? ts.none], [ts.topic, course.topicLabel],
      [ts.language, langName(course.language)], [ts.estimate, version.estimatedMinutes ? String(version.estimatedMinutes) : ts.none],
      [ts.smartTags, course.smartTags.map(x => x.label).join(", ") || ts.none],
      [ts.sequential, version.sequential ? tc.yes : tc.no], [ts.openEnrollment, course.openEnrollment ? tc.yes : tc.no],
      [ts.issuesCertificate, version.issuesCertificate ? tc.yes : tc.no], [ts.groupLegal, version.legalBasisLabel ?? ts.none],
    ]
    return (
      <>
        <p className="mc-ro">{ts.readOnly(version.version)}</p>
        <dl className="card kv mc-kv">{rows.map(([k, v]) => <div key={k} className="mc-kv-row"><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </>
    )
  }

  return (
    <form action={saveSettingsAction} className="card mc-settings">
      <input type="hidden" name="courseKey" value={course.key} />
      <label className="field"><span className="field-label">{ts.title}</span><input className="field-input" name="title" defaultValue={version.title} required /><span className="quiet field-hint">{ts.keyNote} <code>{course.key}</code></span></label>
      <label className="field"><span className="field-label">{ts.subtitle}</span><input className="field-input" name="subtitle" defaultValue={version.subtitle ?? ""} /></label>
      <label className="field"><span className="field-label">{ts.description}</span><textarea className="field-input" name="description" rows={5} defaultValue={version.description ?? ""} /></label>
      <div className="mc-grid2">
        <label className="field"><span className="field-label">{ts.topic}</span><Select name="topicKey" required initial={course.topicKey} options={topicList.map(x => ({ value: x.key, label: x.label }))} fieldLabel={ts.topic} language={language} /></label>
        <label className="field"><span className="field-label">{ts.language}</span><Select name="language" initial={course.language} options={UI_LANGUAGES.map(l => ({ value: l, label: langName(l) }))} fieldLabel={ts.language} language={language} /><span className="quiet field-hint">{ts.languageNote}</span></label>
      </div>
      <label className="field mc-minutes"><span className="field-label">{ts.estimate}</span><input className="field-input" name="estimatedMinutes" type="number" min="1" defaultValue={version.estimatedMinutes ?? ""} /></label>
      <div className="field">
        <span className="field-label">{ts.smartTags}</span>
        <SmartTagInput
          name="smartTags"
          initial={course.smartTags.map(x => x.label)}
          suggestions={usage.map(u => ({ key: u.key, value: u.value, label: u.label, usage: tm.usage(u.courses, u.questions, u.tests) }))}
          labels={{ placeholder: ts.tagPlaceholder, newKey: ts.tagNewKey, newValue: ts.tagNewValue, remove: ts.tagRemove, values: ts.tagValues, field: ts.tagField, noScript: ts.tagNoScript }}
        />
      </div>

      <fieldset className="mc-group">
        <legend className="field-label">{ts.groupFlow}</legend>
        <label className="mc-check"><input type="checkbox" name="sequential" value="1" defaultChecked={version.sequential} /> {ts.sequential}</label>
        <p className="quiet mc-note">{ts.sequentialNote}</p>
        <label className="mc-check"><input type="checkbox" name="openEnrollment" value="1" defaultChecked={course.openEnrollment} /> {ts.openEnrollment}</label>
        <p className="quiet mc-note">{ts.openEnrollmentNote}</p>
        <label className="mc-check"><input type="checkbox" name="issuesCertificate" value="1" defaultChecked={version.issuesCertificate} /> {ts.issuesCertificate}</label>
        <div className="mc-grid2">
          <label className="field"><span className="field-label">{ts.signerName}</span><input className="field-input" name="signerName" defaultValue={version.signer?.name ?? tenant.certificateSigner?.name ?? ""} /></label>
          <label className="field"><span className="field-label">{ts.signerRole}</span><input className="field-input" name="signerRole" defaultValue={version.signer?.role ?? tenant.certificateSigner?.role ?? ""} /></label>
        </div>
      </fieldset>

      <fieldset className="mc-group">
        <legend className="field-label">{ts.groupLegal}</legend>
        <p className="quiet mc-note">{ts.legalNote}</p>
        <Select name="legalBasisKey" initial={version.legalBasisKey ?? ""} options={[{ value: "", label: ts.legalNone }, ...legal.map(o => ({ value: o.key, label: o.label, path: d.responsibility.basisLabel[o.basis] }))]} fieldLabel={ts.groupLegal} language={language} />
      </fieldset>

      <div className="mg-actions"><SubmitButton className="button">{ts.save}</SubmitButton></div>
    </form>
  )
}

async function PeopleTab({ course, published, companyCode, q, language }: {
  course: Course
  published: CourseVersion | null
  companyCode: string
  q: Q
  language: UiLanguage
}) {
  const d = dictionary(language)
  const tp = d.learning.people
  const tc = d.learning.course
  const base = `/learning/manage/${course.key}`
  const [roster, certs] = await Promise.all([courseRoster(companyCode, course), certificatesForCourse(companyCode, course.key)])
  const tcert = d.learning.cert
  const certOf = (enrollmentId: string) => certs.find(c => c.enrollmentId === enrollmentId) ?? null
  const revoking = q.revoke ? roster.find(r => r.enrollment.id === q.revoke) : null
  const filters: ("all" | RosterState)[] = ["all", "not-started", "in-progress", "done"]
  const filter = filters.includes(q.filter as RosterState) ? (q.filter as RosterState) : "all"
  const shown = filter === "all" ? roster : roster.filter(r => r.state === filter)
  const label = { all: tp.filterAll, "not-started": tp.notStarted, "in-progress": tp.inProgress, done: tp.done }
  const stateText = (r: RosterRow) => r.state === "done" && r.completedAt
    ? <span className="ok-fg">{tp.stateDone(formatDate(r.completedAt, language))}</span>
    : r.state === "in-progress" ? tp.stateProgress(r.requiredDone, r.requiredTotal) : tp.stateNotStarted

  let assign: React.ReactNode = null
  if (q.assign === "1") {
    if (!published) {
      assign = <section className="card mg-new"><h2>{tp.assignHeading}</h2><p className="quiet" style={{ margin: 0 }}>{tp.notPublished}</p></section>
    } else {
      const [tree, audiences, departmentCounts] = await Promise.all([allDepartments(companyCode), audiencesInOrg(companyCode), counts(companyCode)])
      const selected = (Array.isArray(q.audience) ? q.audience : q.audience ? [q.audience] : [])
      const chosen = q.preview === "1" ? audienceFromSelection({ all: q.all === "1", selected, departmentNames: Object.fromEntries(tree.map(o => [o.id, o.name])) }) : []
      let impact: { total: number; already: number } | null = null
      if (chosen.length) {
        const ids = new Set<string>()
        for (const a of chosen) for (const m of await audienceMembers(companyCode, a)) ids.add(m.id)
        const enrolled = new Set(roster.map(r => r.enrollment.personId))
        const already = [...ids].filter(id => enrolled.has(id)).length
        impact = { total: ids.size - already, already }
      }
      const rows = flattenTree(tree)
      assign = (
        <section className="card mg-new">
          <h2>{tp.assignHeading}</h2>
          <form method="get" action={base} className="mc-form">
            <input type="hidden" name="tab" value="people" />
            <input type="hidden" name="assign" value="1" />
            <input type="hidden" name="preview" value="1" />
            <label className="mc-check"><input type="checkbox" name="all" value="1" defaultChecked={q.all === "1"} /> <b>{tp.everyone}</b> <span className="quiet">{tp.everyoneNote}</span></label>
            {rows.length > 0 && (
              <div className="field">
                <span className="field-label">{tp.departments}</span>
                <MultiSelect name="audience" emit="repeat" caseSensitive noscript="checkboxes" language={language}
                  selected={selected.filter(a => a.startsWith("department:"))}
                  options={treeOptions(rows.map(r => ({ id: r.department.id, name: r.department.name, level: r.level })))
                    .map(o => ({ ...o, value: `department:${o.value}`, count: (departmentCounts.get(o.value) ?? { withDescendants: 0 }).withDescendants }))} />
              </div>
            )}
            {audiences.groups.length > 0 && (
              <fieldset className="mc-group"><legend className="field-label">{tp.groups}</legend>
                {audiences.groups.map(g => <label key={g.value} className="mc-check"><input type="checkbox" name="audience" value={`group:${g.value}`} defaultChecked={selected.includes(`group:${g.value}`)} /> {g.value} <span className="quiet">{g.count}</span></label>)}
              </fieldset>
            )}
            {audiences.tracks.length > 0 && (
              <fieldset className="mc-group"><legend className="field-label">{tp.tracks}</legend>
                <p className="quiet mc-note">{tp.tracksNote}</p>
                {audiences.tracks.map(g => <label key={g.value} className="mc-check"><input type="checkbox" name="audience" value={`track:${g.value}`} defaultChecked={selected.includes(`track:${g.value}`)} /> {g.value} <span className="quiet">{g.count}</span></label>)}
              </fieldset>
            )}
            <div className="mg-actions"><button type="submit" className="button button--quiet">{tp.check}</button><Link className="button button--quiet" href={`${base}?tab=people`}>{tp.cancel}</Link></div>
          </form>
          {impact && (
            <form action={assignCourseAction} className="mc-form mc-impact">
              <input type="hidden" name="courseKey" value={course.key} />
              {q.all === "1" && <input type="hidden" name="all" value="1" />}
              {selected.map(a => <input key={a} type="hidden" name="audience" value={a} />)}
              <p className="mg-impact">{impact.total + impact.already === 0 ? tp.nobody : tp.summary(impact.total, published.version, impact.already)}</p>
              {impact.total > 0 && <div className="mg-actions"><SubmitButton className="button">{tp.assignButton(impact.total)}</SubmitButton></div>}
            </form>
          )}
        </section>
      )
    }
  }

  return (
    <>
      <div className="mc-people-head">
        <div className="lpills">
          {filters.map(f => (
            <Link key={f} className={`pill${f === filter ? " is-on" : ""}`} href={`${base}?tab=people${f === "all" ? "" : `&filter=${f}`}`}>
              {label[f]} <span className="pill-count">{f === "all" ? roster.length : roster.filter(r => r.state === f).length}</span>
            </Link>
          ))}
        </div>
        <div className="mg-actions">
          <Link className="button" href={`${base}?tab=people&assign=1`}>{tp.assign}</Link>
          <a className="button button--quiet" href={`/api/learning/courses/${course.key}/people`}>{tp.exportCsv}</a>
        </div>
      </div>
      {assign}
      {revoking && certOf(revoking.enrollment.id) && !certOf(revoking.enrollment.id)!.revokedAt && (
        <form action={revokeCertificateAction} className="card mg-new rs-reset">
          <input type="hidden" name="courseKey" value={course.key} />
          <input type="hidden" name="enrollmentId" value={revoking.enrollment.id} />
          <h2>{tcert.revokeTitle(revoking.enrollment.fullName)}</h2>
          <p className="quiet mc-note">{tcert.revokeText}</p>
          <label className="field"><span className="field-label">{tcert.revokeReason}</span><textarea className="field-input" name="reason" rows={2} required /></label>
          <div className="mg-actions"><SubmitButton className="button">{tcert.revokeButton}</SubmitButton><Link className="button button--quiet" href={`${base}?tab=people`}>{tcert.cancel}</Link></div>
        </form>
      )}
      {roster.length === 0 ? (
        <div className="empty"><div className="empty-text">{tp.empty}</div></div>
      ) : (
        <>
          <div className="doc-table-wrap mg-table">
            <table className="doc-table">
              <thead><tr><th>{tp.colName}</th><th>{tp.colDepartment}</th><th>{tp.colEnrollment}</th><th>{tp.colState}</th><th>{tp.colActivity}</th><th>{tcert.colCertificate}</th></tr></thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.enrollment.id}>
                    <td><b>{r.enrollment.fullName}</b><div className="mg-sub">{r.enrollment.email}</div></td>
                    <td>{r.department ?? "—"}</td>
                    <td>{tc.enrolledVia[r.enrollment.source]}</td>
                    <td>{stateText(r)}</td>
                    <td>{formatDate(r.lastActivity, language)}</td>
                    <td><CertCell c={certOf(r.enrollment.id)} href={`${base}?tab=people&revoke=${r.enrollment.id}`} t={tcert} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mg-cards">
            {shown.map(r => (
              <div key={r.enrollment.id} className="card mg-card">
                <span className="mg-title">{r.enrollment.fullName}</span>
                <span className="mg-sub">{[r.department, tc.enrolledVia[r.enrollment.source]].filter(Boolean).join(" · ")}</span>
                <span className="mg-sub">{stateText(r)} · {formatDate(r.lastActivity, language)}</span>
                <CertCell c={certOf(r.enrollment.id)} href={`${base}?tab=people&revoke=${r.enrollment.id}`} t={tcert} />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function CertCell({ c, href, t }: { c: import("@/lib/certificates").Certificate | null; href: string; t: ReturnType<typeof dictionary>["learning"]["cert"] }) {
  if (!c) return <span className="quiet">—</span>
  return (
    <span className="mc-cert">
      <code>{c.registrationNumber}</code>
      {c.revokedAt ? <span className="tag tag--expired">{t.revoked}</span> : <Link className="lc-link" href={href}>{t.revoke}</Link>}
    </span>
  )
}
