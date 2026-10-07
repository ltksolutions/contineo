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
 *
 * Akcie podľa `docs/design/MANAGE-COURSE-akcie.md` (7. 10. 2026): jedno plné
 * tlačidlo na obrazovke — otvorená úloha (`?add=`, `?editBlock=`,
 * `?assign=1`, `?archive=1`, `?removePart=1`) ho prevezme; karta stavu len
 * na koreni kurzu, inde štítok stavu.
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
import TabsBar from "@/components/TabsBar"
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
import { trackNames } from "@/lib/tracks"
import { allDepartments, flattenTree, counts } from "@/lib/departments"
import { courseRoster, type RosterRow, type RosterState } from "@/lib/learningStats"
import { listTests } from "@/lib/testsDb"
import { certificatesForCourse } from "@/lib/certificatesDb"
import { questionCount, type Test } from "@/lib/tests"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { coursePath, partPath } from "@/lib/learningPaths"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import {
  addBlockAction, addPartAction, archiveAction, moveBlockAction, movePartAction, newVersionAction,
  addPartTestAction, assignCourseAction, revokeCertificateAction, savePartTestsAction, publishAction, removePartTestAction, removeBlockAction, removePartAction, saveSettingsAction, updateBlockAction, updatePartAction,
} from "./actions"

export const dynamic = "force-dynamic"

type Q = {
  tab?: string; part?: string; add?: string; src?: string; editBlock?: string; msg?: string; error?: string
  archive?: string; removePart?: string
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
  const base = coursePath(course.key)
  const stats = (await courseStats(ctx.person.companyCode, [course])).get(course.key) ?? { enrolled: 0, completed: 0 }
  const part = q.part ? shown.parts.find(p => p.key === q.part) ?? null : null
  // Neznáma časť na vlastnej adrese (R3) je 404, nie zoznam častí.
  if (q.part && !part) notFound()
  const docs = part && draft && q.add === "document" ? await documentChoices(ctx.person.companyCode) : []
  const allTests = part ? await listTests(ctx.person.companyCode) : []
  const tab = q.tab === "settings" ? "settings" : q.tab === "people" ? "people" : "parts"
  const usage = tab === "settings" ? await smartTagUsage(ctx.person.companyCode) : []
  // Podstránka (časť, Nastavenia, Zapísaní) má v ceste vlastný krok pod
  // kurzom (R3); na koreni kurzu je posledným krokom kurz.
  const pageName = part ? part.title : tab === "settings" ? te.tabSettings : tab === "people" ? te.tabPeople : null

  // Karta stavu len na koreni kurzu; na podstránkach štítok v hlavičke
  // (MANAGE-COURSE-akcie Q1, 7. 10. 2026) — inak by nad Nastaveniami
  // a časťou viselo druhé plné tlačidlo a pol obrazovky kontrol.
  const root = tab === "parts" && !part
  const archiving = root && q.archive === "1" && Boolean(published) && !draft
  const removingPart = Boolean(part && draft && q.removePart === "1")

  return (
    <AppShell language={language} title={pageName ?? shown.title} trail={pageName ? { [base]: shown.title } : undefined}>
      <div className="mc" style={tenantStyle(brandingView(ctx.tenant))}>
        <Notice language={language} message={q.msg} error={q.error === "1"} back={part ? partPath(course.key, part.key) : coursePath(course.key, tab)} />
        <header className="ch">
          <span className="ch-topic">{course.topicLabel}</span>
          <h1 className="page-title">{shown.title}</h1>
          <div className="ch-facts">
            <code>{course.key}</code>
            {!root && <StatusChip href={base} draft={draft} published={published} te={te} />}
          </div>
        </header>

        {root && <StatusCard course={course} draft={draft} published={published} latest={latest} inProgress={stats.enrolled - stats.completed} te={te} language={language} />}

        <nav className="tabs" aria-label={t.manage.tabsLabel}>
          <TabsBar>
            <TabLink href={base} active={tab === "parts"}>{te.tabParts}</TabLink>
            <TabLink href={coursePath(course.key, "settings")} active={tab === "settings"}>{te.tabSettings}</TabLink>
            <TabLink href={coursePath(course.key, "people")} active={tab === "people"}>{te.tabPeople}</TabLink>
          </TabsBar>
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

        {archiving && published && (
          <ConfirmSheet title={te.archiveTitle(shown.title)} cancel={base} cancelLabel={te.cancel}
                        action={archiveAction} values={{ courseKey: course.key }} confirm={te.archiveButton}>
            <ul>
              <li>{te.archiveNoNew}</li>
              {stats.enrolled - stats.completed > 0 && <li>{te.archiveInProgress(stats.enrolled - stats.completed, published.version)}</li>}
              <li>{te.archiveKeeps}</li>
            </ul>
            <p>{te.archiveRestoreNote}</p>
          </ConfirmSheet>
        )}
        {removingPart && part && draft && (
          <ConfirmSheet title={te.removePartTitle(part.title, part.blocks.length, part.tests.length)} cancel={partPath(course.key, part.key)} cancelLabel={te.cancel}
                        action={removePartAction} values={{ courseKey: course.key, partKey: part.key }} confirm={te.removePartButton}>
            <p>{te.removePartNote(draft.version)}</p>
          </ConfirmSheet>
        )}
      </div>
    </AppShell>
  )
}

function Hidden({ values }: { values: Record<string, string> }) {
  return <>{Object.entries(values).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}</>
}

/**
 * Potvrdenie nevratného kroku (MANAGE-COURSE-akcie Q4, 7. 10. 2026) —
 * SwiftUI `.confirmationDialog`. Vykreslí ho server podľa adresy
 * (`?archive=1`, `?removePart=1`), takže funguje bez JavaScriptu; „Zrušiť"
 * aj stlmená stránka pod ním sú odkaz bez parametra. Pod 640 px plachta
 * zdola, od 640 px okno v strede.
 */
function ConfirmSheet({ title, cancel, cancelLabel, action, values, confirm, children }: {
  title: string
  cancel: string
  cancelLabel: string
  action: (fd: FormData) => Promise<void>
  values: Record<string, string>
  confirm: string
  children: React.ReactNode
}) {
  return (
    <div className="confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <Link className="confirm-scrim" href={cancel} aria-label={cancelLabel} tabIndex={-1} />
      <div className="confirm-card">
        <span className="sheet-grip" aria-hidden="true" />
        <h2 id="confirm-title">{title}</h2>
        {children}
        <form action={action} className="confirm-actions">
          <Hidden values={values} />
          <SubmitButton className="button button--destructive">{confirm}</SubmitButton>
          <Link className="button button--quiet" href={cancel}>{cancelLabel}</Link>
        </form>
      </div>
    </div>
  )
}

/** Štítok stavu verzie na podstránke — odkaz na kartu stavu na koreni kurzu (Q1). */
function StatusChip({ href, draft, published, te }: { href: string; draft: CourseVersion | null; published: CourseVersion | null; te: Edit }) {
  if (draft) {
    const missing = publishProblems(draft).length
    return (
      <Link className={`mc-stchip ${missing ? "is-warn" : "is-ok"}`} href={href} aria-label={te.statusLabel}>
        {missing ? te.statusDraftMissing(draft.version, missing) : te.statusDraftReady(draft.version)} <span aria-hidden="true">›</span>
      </Link>
    )
  }
  return <span className={`tag ${published ? "tag--published" : "tag--archived"}`}>{published ? te.statusPublished(published.version) : te.statusArchived}</span>
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
  const base = coursePath(course.key)
  // Náhľad ako študent (Q2): verzia, ktorú správca práve vidí, len na čítanie.
  const preview = (v: CourseVersion) => <Link className="button button--quiet" href={`/learning/${encodeURIComponent(course.key)}?preview=${v.version}`}>{te.previewAsStudent}</Link>
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
        {/* Stavový krok ostáva v päte karty, nie v `.page-head` (Q5) — pri
            vypnutom „Zverejniť" je vedľa neho vidno, čo chýba. */}
        <div className="flow-foot mc-foot">
          <form action={publishAction}>
            <Hidden values={key} />
            {problems.length
              ? <button type="button" className="button" disabled aria-disabled="true">{te.publishButton(draft.version)}</button>
              : <SubmitButton className="button">{te.publishButton(draft.version)}</SubmitButton>}
          </form>
          {preview(draft)}
          <span className="quiet mc-foot-note">{problems.length ? te.publishDisabledNote : te.savedAt(formatDate(draft.updatedAt ?? draft.createdAt, language))}</span>
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
          {preview(published)}
          {/* Archivácia zastaví zápis všetkým — najprv potvrdenie (Q4). */}
          <Link className="button button--danger" href={`${base}?archive=1`}>{te.archiveOpen}</Link>
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
  return (
    <div className="mc-root">
      {version.parts.length === 0 ? (
        <div className="empty"><div className="empty-title">{te.noParts}</div></div>
      ) : (
        <section className="mc-group">
          <h2 className="form-group-head">{te.partsHeading} <span className="quiet">{version.parts.length}</span></h2>
          {/* Riadok časti je odkaz na celý riadok (NavigationLink); šípky
              poradia ostávajú samostatné formuláre bez JS (MANAGE-COURSE-akcie). */}
          <ol className="card mc-list mc-links">
            {version.parts.map((p, i) => (
              <li key={p.key} className="mc-lrow">
                <Link className="mc-lrow-link" href={partPath(course.key, p.key)}>
                  <span className="pr-mark pr-mark--sm" aria-hidden="true">{i + 1}</span>
                  <span className="mc-row-main">
                    <b>{p.title}</b>
                    <span className="mc-row-meta">
                      <span className={p.required ? "tag" : "tag tag--archived"}>{p.required ? te.required : te.optional}</span>
                      {te.blocksTests(p.blocks.length, p.tests.length)}
                    </span>
                  </span>
                  <span className="mc-chev" aria-hidden="true">›</span>
                </Link>
                {editable && (
                  <span className="mc-arrows">
                    <MoveButton action={movePartAction} values={{ courseKey: course.key, partKey: p.key, dir: "up" }} label={te.up} disabled={i === 0} glyph="↑" />
                    <MoveButton action={movePartAction} values={{ courseKey: course.key, partKey: p.key, dir: "down" }} label={te.down} disabled={i === version.parts.length - 1} glyph="↓" />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      {editable && (
        <form action={addPartAction} className="mc-group">
          <Hidden values={{ courseKey: course.key }} />
          <fieldset className="form-group">
            <legend className="form-group-head">{te.newPart}</legend>
            <div className="card form-group-body form-group-body--rows">
              <div><input className="field-input" name="title" aria-label={te.partTitle} placeholder={te.partTitle} required /></div>
              <div className="form-list">
                <label className="form-row"><input type="checkbox" role="switch" className="toggle" name="required" value="1" defaultChecked /><span className="form-row-main">{te.required}</span></label>
              </div>
            </div>
          </fieldset>
          {/* Tiché — plné je stavový krok v karte stavu (jedno plné). */}
          <div className="mg-actions"><SubmitButton className="button button--quiet">{te.addPart}</SubmitButton></div>
        </form>
      )}
    </div>
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
      <SubmitButton className="button button--quiet mc-arrow" ariaLabel={label} disabled={disabled}>{glyph}</SubmitButton>
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

function blockLabel(b: ContentBlock, te: Edit): string {
  return b.type === "video" && b.source.kind === "external" ? te.blockTypes.videoExternal : te.blockTypes[b.type]
}

/** Typy, pri ktorých má úprava polia; pri ostatných ponúka len odstránenie. */
function editableBlock(b: ContentBlock): boolean {
  return b.type === "text" || b.type === "image" || (b.type === "video" && b.source.kind !== "external")
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
  const self = partPath(course.key, part.key)
  const ids = { courseKey: course.key, partKey: part.key }
  const index = version.parts.findIndex(p => p.key === part.key)
  const add = editable && (BLOCK_TYPES as readonly string[]).includes(q.add ?? "") ? (q.add as (typeof BLOCK_TYPES)[number]) : null
  const editing = editable ? part.blocks.find(b => b.id === q.editBlock) ?? null : null
  // Pred 7. 10. 2026 sa zdroj videa volil odkazom `?src=external`; starý
  // odkaz ešte predvolí externý zdroj.
  const external = q.src === "external"
  const mediaLabels = (kind: "image" | "video") => ({
    title: kind === "video" ? te.mediaVideo : te.mediaImage, note: te.mediaNote, progressTitle: te.progressTitle,
    uploading: te.uploading, failed: te.uploadFailed, tooLarge: te.tooLarge,
  })
  const published = publishedVersion(course)

  return (
    <div className="mc-detail">
      {/* „← Všetky časti" preč — kurz je v ceste pod hlavičkou (R3,
          MANAGE-COURSE-akcie). Bočný zoznam ostáva od 1024 px. */}
      <aside className="mc-side">
        {version.parts.map((p, i) => (
          <Link key={p.key} className={`pp-orow${p.key === part.key ? " is-current" : ""}`} href={partPath(course.key, p.key)} aria-current={p.key === part.key ? "page" : undefined}>
            <span className="pr-mark pr-mark--sm" aria-hidden="true">{i + 1}</span><span>{p.title}</span>
          </Link>
        ))}
      </aside>

      <div className="mc-main">
        {/* Hlavná akcia časti v toolbare: „Pridať blok ▾" (SwiftUI `Menu`,
            `<details>` bez JS). Pri otvorenej úlohe (nový blok, úprava bloku)
            ju prevezme úloha a tu sa nekreslí. */}
        <div className="page-head mc-parthead">
          <h2 className="mc-h2">{index + 1} · {part.title}</h2>
          <span className="page-head-spacer" aria-hidden="true" />
          {editable && !add && !editing && (
            <details className="mc-menu">
              <summary className="button">{te.addBlock} <span aria-hidden="true">▾</span></summary>
              <div className="mc-menu-list">
                {BLOCK_TYPES.map(k => (
                  <Link key={k} href={`${self}?add=${k}#add`}>
                    {te.blockTypes[k]}
                    {(k === "document" || k === "video") && <small>{te.blockMenuNote[k]}</small>}
                  </Link>
                ))}
              </div>
            </details>
          )}
        </div>

        {add && (
          <form action={addBlockAction} className="mc-group" id="add">
            <Hidden values={{ ...ids, type: add }} />
            <fieldset className="form-group">
              <legend className="form-group-head form-group-head--step">{te.newBlockHeading(te.blockTypes[add])}</legend>
              {add === "video" ? (
                // Zdroj videa: Picker(.inline) — dva riadky s fajkou, pole pod
                // zvoleným (`:has`, bez JS). Bez `:has` sú vidno obe a server
                // číta len to, ktoré patrí k zvolenému `source`.
                <div className="card form-group-body form-group-body--rows">
                  <div className="form-list">
                    <label className="form-row choice-row"><input type="radio" name="source" value="upload" defaultChecked={!external} />
                      <span className="form-row-main">{te.sourceUpload}</span></label>
                    <div className="choice-field choice-field--block">
                      <CourseMediaUpload kind="video" accept=".mp4,.webm" maxBytes={MAX_BYTES} labels={mediaLabels("video")} />
                    </div>
                    <label className="form-row choice-row"><input type="radio" name="source" value="external" defaultChecked={external} />
                      <span className="form-row-main"><span>{te.sourceExternal}</span><span className="form-row-sub">{te.sourceExternalSub}</span></span></label>
                    <div className="choice-field choice-field--block">
                      <label className="field"><span className="field-label">{te.url}</span><input className="field-input" name="url" type="url" /></label>
                      <div className="lnote lnote--warn"><span className="lnote-mark" aria-hidden="true">!</span><span className="lnote-text">{te.externalWarn}</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card form-group-body">
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
                </div>
              )}
            </fieldset>
            {add === "video" && (
              <fieldset className="form-group">
                <div className="card form-group-body form-group-body--rows">
                  <div className="form-list">
                    <label className="form-row"><input type="checkbox" role="switch" className="toggle" name="mustWatch" value="1" />
                      <span className="form-row-main"><span>{te.mustWatch}</span><span className="form-row-sub">{te.mustWatchNote}</span></span></label>
                  </div>
                </div>
              </fieldset>
            )}
            {/* Otvorená úloha prevezme plné tlačidlo (MANAGE-COURSE-akcie). */}
            <div className="mg-actions">
              <SubmitButton className="button">{te.addBlock}</SubmitButton>
              <Link className="button button--quiet" href={self}>{te.cancel}</Link>
            </div>
          </form>
        )}

        {editing && (
          <div className="mc-group" id="edit">
            <form action={updateBlockAction} className="mc-group">
              <Hidden values={{ ...ids, blockId: editing.id }} />
              <fieldset className="form-group">
                <legend className="form-group-head form-group-head--step">{te.blockHeading(part.blocks.indexOf(editing) + 1, blockLabel(editing, te))}</legend>
                {editing.type === "video" ? (
                  <div className="card form-group-body form-group-body--rows">
                    <div className="form-list">
                      <label className="form-row"><input type="checkbox" role="switch" className="toggle" name="mustWatch" value="1" defaultChecked={editing.mustWatch} />
                        <span className="form-row-main"><span>{te.mustWatch}</span><span className="form-row-sub">{te.mustWatchNote}</span></span></label>
                    </div>
                  </div>
                ) : (
                  <div className="card form-group-body">
                    {editing.type === "text" && <textarea className="field-input" name="markdown" rows={8} defaultValue={editing.markdown} aria-label={te.markdown} />}
                    {editing.type === "image" && (
                      <>
                        <label className="field"><span className="field-label">{te.alt}</span><input className="field-input" name="alt" defaultValue={editing.alt} required /></label>
                        <label className="field"><span className="field-label">{te.caption}</span><input className="field-input" name="caption" defaultValue={editing.caption ?? ""} /></label>
                      </>
                    )}
                    {!editableBlock(editing) && <p className="quiet" style={{ margin: 0 }}>{blockSummary(editing, te)} — {te.noEditBlock}</p>}
                  </div>
                )}
              </fieldset>
              <div className="mg-actions">
                {editableBlock(editing) && <SubmitButton className="button">{te.saveBlock}</SubmitButton>}
                <Link className="button button--quiet" href={self}>{te.cancel}</Link>
              </div>
            </form>
            {/* Odstránenie je zámerný krok v úprave, nie v riadku (Q3). */}
            <form action={removeBlockAction} className="mc-danger">
              <Hidden values={{ ...ids, blockId: editing.id }} />
              <SubmitButton className="button button--danger">{te.removeBlockButton}</SubmitButton>
              <p className="quiet mc-note">{te.removeBlockNote(version.version, published?.version ?? null)}</p>
            </form>
          </div>
        )}

        <section className="mc-group">
          <h3 className="form-group-head">{te.blocksHeading} <span className="quiet">{part.blocks.length}</span></h3>
          <div className="card mc-list mc-links">
            {part.blocks.length === 0 && <p className="quiet mc-row">{te.noBlocks}</p>}
            {part.blocks.map((b, i) => (
              <div key={b.id} className={`mc-lrow${editing?.id === b.id ? " is-current" : ""}`}>
                {editable ? (
                  <Link className="mc-lrow-link" href={`${self}?editBlock=${encodeURIComponent(b.id)}#edit`}>
                    <span className="btype">{blockLabel(b, te)}</span>
                    <span className="mc-row-main"><span className="mc-row-meta">{blockSummary(b, te)}</span></span>
                    <span className="mc-chev" aria-hidden="true">›</span>
                  </Link>
                ) : (
                  <span className="mc-lrow-link">
                    <span className="btype">{blockLabel(b, te)}</span>
                    <span className="mc-row-main"><span className="mc-row-meta">{blockSummary(b, te)}</span></span>
                  </span>
                )}
                {editable && (
                  <span className="mc-arrows">
                    <MoveButton action={moveBlockAction} values={{ ...ids, blockId: b.id, dir: "up" }} label={te.up} disabled={i === 0} glyph="↑" />
                    <MoveButton action={moveBlockAction} values={{ ...ids, blockId: b.id, dir: "down" }} label={te.down} disabled={i === part.blocks.length - 1} glyph="↓" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        <PartTests part={part} tests={tests} ids={ids} editable={editable} te={te} ta={ta} language={language} />

        {editable && (
          <form action={updatePartAction} className="mc-group">
            <Hidden values={ids} />
            <fieldset className="form-group">
              <legend className="form-group-head">{te.partGroup}</legend>
              <div className="card form-group-body form-group-body--rows">
                <label className="field"><span className="field-label">{te.partTitle}</span><input className="field-input" name="title" defaultValue={part.title} required /></label>
                <label className="field"><span className="field-label">{te.summary}</span><input className="field-input" name="summary" defaultValue={part.summary ?? ""} /></label>
                <label className="field mc-minutes"><span className="field-label">{te.minutes}</span><input className="field-input" name="estimatedMinutes" type="number" min="1" defaultValue={part.estimatedMinutes ?? ""} /></label>
                <div className="form-list">
                  <label className="form-row"><input type="checkbox" role="switch" className="toggle" name="required" value="1" defaultChecked={part.required} /><span className="form-row-main">{te.required}</span></label>
                </div>
              </div>
            </fieldset>
            <div className="mg-actions"><SubmitButton className="button button--quiet">{te.savePart}</SubmitButton></div>
          </form>
        )}

        {editable && (
          <div className="mc-danger">
            <Link className="button button--danger" href={`${self}?removePart=1`}>{te.removePartOpen}</Link>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Testy časti ako jeden formulár (MANAGE-COURSE-akcie, 7. 10. 2026): prepínač
 * „Povinný" pri každom teste, „Odobrať" a „Priradiť test" cez `formaction`,
 * prepínače zapíše „Uložiť testy" (Toggle sa ukladá tlačidlom, nie hneď).
 */
function PartTests({ part, tests, ids, editable, te, ta, language }: {
  part: Part
  tests: Test[]
  ids: { courseKey: string; partKey: string }
  editable: boolean
  te: Edit
  ta: ReturnType<typeof dictionary>["learning"]["attempt"]
  language: UiLanguage
}) {
  const offer = tests.filter(t => t.status === "ready" && !part.tests.some(x => x.testKey === t.key))
  const meta = (key: string) => {
    const t = tests.find(x => x.key === key)
    return t ? ta.testMeta(questionCount(t), t.rules.passingPercent, t.rules.maxAttempts, t.responsible.map(r => r.fullName).join(", ")) : ""
  }
  const title = (key: string) => tests.find(x => x.key === key)?.title ?? key

  if (!editable) {
    return (
      <section className="mc-group">
        <h3 className="form-group-head">{te.testsHeading}</h3>
        <div className="card mc-list">
          {part.tests.length === 0 && <p className="quiet mc-row">{ta.noReadyTests}</p>}
          {part.tests.map(pt => (
            <div key={pt.testKey} className="mc-row">
              <span className="mc-row-main"><Link className="mg-title" href={`/learning/tests/${pt.testKey}`}>{title(pt.testKey)}</Link><span className="mc-row-meta">{meta(pt.testKey)}</span></span>
              <span className="quiet">{pt.required ? ta.testRequired : ""}{pt.testVersion ? ` · v${pt.testVersion}` : ""}</span>
            </div>
          ))}
        </div>
      </section>
    )
  }
  return (
    <form action={savePartTestsAction} className="mc-group">
      <Hidden values={ids} />
      <fieldset className="form-group">
        <legend className="form-group-head">{te.testsHeading}</legend>
        <div className="card form-group-body form-group-body--rows">
          {part.tests.length > 0 && (
            <div className="form-list">
              {part.tests.map(pt => (
                <label key={pt.testKey} className="form-row">
                  <input type="checkbox" role="switch" className="toggle" name={`required:${pt.testKey}`} value="1" defaultChecked={pt.required} aria-label={`${ta.testRequired}: ${title(pt.testKey)}`} />
                  <span className="form-row-main">
                    <span><Link className="mg-title" href={`/learning/tests/${pt.testKey}`}>{title(pt.testKey)}</Link></span>
                    <span className="form-row-sub">
                      {meta(pt.testKey)}{" · "}
                      <SubmitButton className="linkish" formAction={removePartTestAction} name="removeTestKey" value={pt.testKey}>{ta.removeTest}</SubmitButton>
                    </span>
                  </span>
                  <span className="quiet mc-toggle-label" aria-hidden="true">{ta.testRequired}</span>
                </label>
              ))}
            </div>
          )}
          {offer.length ? (
            <div className="mc-addtest">
              <Select name="addTestKey" searchable options={offer.map(t => ({ value: t.key, label: t.title }))} fieldLabel={ta.assignTest} language={language} />
              <SubmitButton className="button button--quiet" formAction={addPartTestAction}>{ta.assignTest}</SubmitButton>
            </div>
          ) : <p className="quiet mc-foot-note">{ta.noReadyTests}</p>}
        </div>
      </fieldset>
      {part.tests.length > 0 && <div className="mg-actions"><SubmitButton className="button button--quiet">{te.saveTests}</SubmitButton></div>}
    </form>
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

      {/* Nadpis nad kartou (HR-pridelit-nadpis-karty, 6. 10. 2026). */}
      <fieldset className="form-group">
        <legend className="form-group-head">{ts.groupFlow}</legend>
        {/* Áno/nie nastavenia kurzu ako prepínače (ZAKLAD-vyber-a-prepinace);
            uložia sa tlačidlom, nie hneď (Q4). */}
        <div className="card form-group-body form-group-body--rows">
        <div className="form-list">
          <label className="form-row">
            <input type="checkbox" role="switch" className="toggle" name="sequential" value="1" defaultChecked={version.sequential} />
            <span className="form-row-main">
              <span>{ts.sequential}</span>
              <span className="form-row-sub">{ts.sequentialNote}</span>
            </span>
          </label>
          <label className="form-row">
            <input type="checkbox" role="switch" className="toggle" name="openEnrollment" value="1" defaultChecked={course.openEnrollment} />
            <span className="form-row-main">
              <span>{ts.openEnrollment}</span>
              <span className="form-row-sub">{ts.openEnrollmentNote}</span>
            </span>
          </label>
          <label className="form-row">
            <input type="checkbox" role="switch" className="toggle" name="issuesCertificate" value="1" defaultChecked={version.issuesCertificate} />
            <span className="form-row-main">
              <span>{ts.issuesCertificate}</span>
            </span>
          </label>
        </div>
        <div className="mc-grid2">
          <label className="field"><span className="field-label">{ts.signerName}</span><input className="field-input" name="signerName" defaultValue={version.signer?.name ?? tenant.certificateSigner?.name ?? ""} /></label>
          <label className="field"><span className="field-label">{ts.signerRole}</span><input className="field-input" name="signerRole" defaultValue={version.signer?.role ?? tenant.certificateSigner?.role ?? ""} /></label>
        </div>
        </div>
      </fieldset>

      <fieldset className="form-group">
        <legend className="form-group-head">{ts.groupLegal}</legend>
        <div className="card form-group-body">
        <Select name="legalBasisKey" initial={version.legalBasisKey ?? ""} options={[{ value: "", label: ts.legalNone }, ...legal.map(o => ({ value: o.key, label: o.label, path: d.responsibility.basisLabel[o.basis] }))]} fieldLabel={ts.groupLegal} language={language} />
        </div>
        <p className="form-group-foot quiet">{ts.legalNote}</p>
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
  const people = coursePath(course.key, "people")
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
      const [tree, audiences, departmentCounts, names] = await Promise.all([allDepartments(companyCode), audiencesInOrg(companyCode), counts(companyCode), trackNames(companyCode)])
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
          <form method="get" action={people} className="mc-form">
            <input type="hidden" name="assign" value="1" />
            <input type="hidden" name="preview" value="1" />
            {/* „Všetkým" ako prepínač, ako na /hr/assign (ZAKLAD-vyber-a-prepinace, Q2). */}
            <div className="card form-group-body form-group-body--rows">
              <div className="form-list">
                <label className="form-row">
                  <input type="checkbox" role="switch" className="toggle" name="all" value="1" defaultChecked={q.all === "1"} />
                  <span className="form-row-main">
                    <span>{tp.everyone}</span>
                    <span className="form-row-sub">{tp.everyoneNote}</span>
                  </span>
                </label>
              </div>
            </div>
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
              <fieldset className="form-group"><legend className="form-group-head">{tp.groups}</legend>
                <div className="card form-group-body form-group-body--rows"><div className="form-list">
                {audiences.groups.map(g => <label key={g.value} className="form-row select-row"><input type="checkbox" name="audience" value={`group:${g.value}`} defaultChecked={selected.includes(`group:${g.value}`)} /><span className="form-row-main">{g.value}</span><span className="form-row-sub">{g.count}</span></label>)}
                </div></div>
              </fieldset>
            )}
            {audiences.tracks.length > 0 && (
              <fieldset className="form-group"><legend className="form-group-head">{tp.tracks}</legend>
                <div className="card form-group-body form-group-body--rows"><div className="form-list">
                {audiences.tracks.map(g => <label key={g.value} className="form-row select-row"><input type="checkbox" name="audience" value={`track:${g.value}`} defaultChecked={selected.includes(`track:${g.value}`)} /><span className="form-row-main">{names[g.value] ?? g.value}</span><span className="form-row-sub">{g.count}</span></label>)}
                </div></div>
                <p className="form-group-foot quiet">{tp.tracksNote}</p>
              </fieldset>
            )}
            <div className="mg-actions"><button type="submit" className="button button--quiet">{tp.check}</button><Link className="button button--quiet" href={people}>{tp.cancel}</Link></div>
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
        {/* Filter zapísaných = prepínač pohľadu (DESIGN_ODCHYLKY P4). */}
        <nav className="view-switch view-switch--fit" aria-label={d.learning.statusFilter}>
          {filters.map(f => (
            <Link key={f} className={`view-switch-item${f === filter ? " is-on" : ""}`} aria-current={f === filter ? "true" : undefined}
                  href={`${people}${f === "all" ? "" : `?filter=${f}`}`}>
              {label[f]} <span className="view-switch-count">{f === "all" ? roster.length : roster.filter(r => r.state === f).length}</span>
            </Link>
          ))}
        </nav>
        <div className="mg-actions">
          {/* Otvorená úloha (prideľovanie, odvolanie) prevezme plné tlačidlo
              a tlačidlo, ktoré ju otvorilo, zmizne (MANAGE-COURSE-akcie). */}
          {q.assign !== "1" && !revoking && <Link className="button" href={`${people}?assign=1`}>{tp.assign}</Link>}
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
          <div className="mg-actions"><SubmitButton className="button">{tcert.revokeButton}</SubmitButton><Link className="button button--quiet" href={people}>{tcert.cancel}</Link></div>
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
                    <td><CertCell c={certOf(r.enrollment.id)} href={`${people}?revoke=${r.enrollment.id}`} t={tcert} /></td>
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
                <CertCell c={certOf(r.enrollment.id)} href={`${people}?revoke=${r.enrollment.id}`} t={tcert} />
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
