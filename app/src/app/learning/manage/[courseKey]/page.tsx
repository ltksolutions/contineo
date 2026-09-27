/**
 * /learning/manage/[courseKey] — úprava kurzu (rám `docs/design/MANAGE-COURSE-uprava-kurzu.md`).
 *
 * Karta stavu verzie Koncept → Zverejnené → Archív (tvar karty postupu
 * znenia, `.flow`) a záložka Časti: zoznam s poradím, detail časti s blokmi
 * a formulár „Pridať blok" (text, obrázok, galéria, dokument z knižnice,
 * video nahraté alebo externé). Meniť sa dá len koncept — zverejnená verzia
 * je len na čítanie (D118), zmena = „Nová verzia".
 *
 * Záložky Nastavenia a Zapísaní pribudnú v ďalších PR tohto rámu.
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
import { normalizeLayout } from "@/lib/appNav"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import {
  addBlockAction, addPartAction, archiveAction, moveBlockAction, movePartAction, newVersionAction,
  publishAction, removeBlockAction, removePartAction, updateBlockAction, updatePartAction,
} from "./actions"

export const dynamic = "force-dynamic"

type Q = { layout?: string; tab?: string; part?: string; add?: string; src?: string; editBlock?: string; msg?: string; error?: string }
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
          <TabLink href={`${base}?tab=parts`} active>{te.tabParts}</TabLink>
        </nav>

        <div className="mc-body">
          {!draft && <p className="mc-ro">{te.readOnly(shown.version)}</p>}
          {part
            ? <PartDetail course={course} version={shown} part={part} editable={Boolean(draft)} q={q} docs={docs} te={te} language={language} />
            : <PartList course={course} version={shown} editable={Boolean(draft)} te={te} />}
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

function PartDetail({ course, version, part, editable, q, docs, te, language }: {
  course: Course
  version: CourseVersion
  part: Part
  editable: boolean
  q: Q
  docs: Awaited<ReturnType<typeof documentChoices>>
  te: Edit
  language: UiLanguage
}) {
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
          <p className="quiet mc-row">{te.testsLater}</p>
        </section>
      </div>
    </div>
  )
}
