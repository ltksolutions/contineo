/**
 * /library/compliance/[runId] — detail kontroly súladu (ADR-032, D196, D199;
 * návrh KNIZ-kontrola-suladu-detail, 11. 10. 2026).
 *
 * `NavigationSplitView`: od 1024 px vľavo zoznam kontrolovaných dokumentov,
 * vpravo nálezy jedného dokumentu; pod 1024 px riadok „Dokument 8 z 10 ›"
 * nad obsahom a zoznam na celú šírku cez `?docs=1` (Q1, Q5). Stav je
 * v adrese: `?doc=` dokument, `view=open|decided|all` filter (predvolené
 * Nerozhodnuté, Q2), `f=` otvorený nález, `change=1` zmena rozhodnutia.
 *
 * Rozhodnutie ostáva podľa D199: dve voľby, povinný dôvod, prijaté znenie
 * ide do konceptu. „Uložiť a ďalší" otvorí ďalší nerozhodnutý nález.
 * Plné tlačidlo na obrazovke nie je — zoznam kariet s vlastnými úkonmi.
 * Bez JavaScriptu funguje všetko okrem „Kopírovať znenie".
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import SubmitButton from "@/components/SubmitButton"
import CopyLink from "@/components/CopyLink"
import TextEditor from "@/components/TextEditor"
import { articleHash, articleSection, articleLabel, citedParagraphs } from "@/lib/articleAnchors"
import ScrollToCited from "@/components/ScrollToCited"
import FormattedText from "@/components/FormattedText"
import { DOCUMENTS_COLLECTION, effectiveVersion, type DocumentRecord } from "@/lib/documents"
import { complianceViewContext, type ComplianceViewContext } from "@/lib/complianceAccess"
import { documentRun, draftBase, currentWording, suggestOnCurrent, runUsage, runModel, MAX_FAILURES, type DocumentFinding, type DocumentResult, type ComplianceRun } from "@/lib/complianceCheck"
import {
  defaultDocument, filterFindings, findingAnchor, findingState, isFindingView, nextOpen, openCount, orderedFindings, runProgress,
  type FindingView,
} from "@/lib/complianceView"
import { wordDiff, readableInline } from "@/lib/wordDiff"
import { getCollection } from "@/lib/mongodb"
import { PERSONS_COLLECTION, type Person } from "@/lib/persons"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate, formatAmount, type UiLanguage } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { decideFindingAction, applyFindingAction, startDocumentReviewAction } from "../../complianceActions"

export const dynamic = "force-dynamic"

type T = ReturnType<typeof dictionary>["library"]["compliance"]
type Ready = Extract<ComplianceViewContext, { state: "ready" }>

/** Zmena znenia ako jeden text: vyškrtnuté a doplnené (vzor `.pr-diff` z fronty FAQ). */
function Diff({ before, after }: { before: string; after: string }) {
  return (
    <div className="pr-diff cf-diff">
      {wordDiff(readableInline(before), readableInline(after)).map((part, i) =>
        part.kind === "removed" ? <del key={i}>{part.text}</del> : part.kind === "added" ? <ins key={i}>{part.text}</ins> : <span key={i}>{part.text}</span>,
      )}
    </div>
  )
}

/** Text citovaného článku na náhľad (voľba 1, Ján 11. 10. 2026) a záväzné PDF. */
interface NormPreview { text: string; hash: string; cited: string[]; pdfHref: string | null }

async function loadNormPreview(companyCode: string, f: DocumentFinding): Promise<NormPreview | null> {
  const doc = await (await getCollection(DOCUMENTS_COLLECTION)).findOne({ companyCode, documentId: f.citation.documentId }) as unknown as DocumentRecord | null
  if (!doc) return null
  const v = effectiveVersion(doc)
  const markdown = v.ok ? String(v.version.markdown ?? doc.markdown ?? "") : String((doc as { draftMarkdown?: string }).draftMarkdown ?? "")
  const section = articleSection(markdown, f.citation.articleRef)
  if (!section) return null
  const pdfHref = v.ok && v.version.pdf
    ? `/api/documents/${encodeURIComponent(doc.documentId)}/pdf?version=${encodeURIComponent(v.version.versionId)}`
    : null
  // Všetky citované odseky („ods. 8 a ods. 19"); bez odsekov aspoň miesto z kotvy.
  const cited = citedParagraphs(f.citation.articleRef)
  return { ...section, cited: cited.length ? cited : [section.hash.slice(1)], pdfHref }
}

function Norm({ t, f, preview }: { t: T; f: DocumentFinding; preview?: NormPreview | null }) {
  return (
    <div className="cf-blk">
      <span className="cf-blk-l">{t.norm}</span>
      {/* Náhľad normy v novom okne (Ján 11. 10. 2026) — čitateľský pohľad, nie karta
          v správe; rozpracované rozhodnutie na tejto stránke ostáva. */}
      <p>
        <a href={`/documents/${encodeURIComponent(f.citation.documentId)}${articleHash(f.citation.articleRef)}`} target="_blank" rel="noopener">
          {f.citation.title}{f.citation.articleRef ? `, ${f.citation.articleRef}` : ""}
          <svg className="ext-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5h5v5M9.5 2.5 3 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="sr-only"> {t.opensNewWindow}</span>
        </a>
      </p>
      {f.citation.quote && <blockquote className="quote">{f.citation.quote}</blockquote>}
      {/* Náhľad celého článku pri náleze. Čitateľský pohľad pri PDF text neukazuje
          (ADR-011, rozhodnutie 30. 9. 2026), preto je text tu — označený ako
          text na vyhľadávanie, záväzné ostáva PDF. */}
      {preview && (
        <details className="norm-preview">
          <summary>{t.showArticle(articleLabel(f.citation.articleRef))}</summary>
          <div className="norm-preview-body">
            <p className="quiet field-hint">
              {t.articleNote}
              {preview.pdfHref && <> · <a href={preview.pdfHref} target="_blank" rel="noopener">{t.openPdf}<span className="sr-only"> {t.opensNewWindow}</span></a></>}
            </p>
            <div className="answer">
              <FormattedText text={preview.text} anchors highlight={preview.cited} />
            </div>
            <ScrollToCited />
          </div>
        </details>
      )}
    </div>
  )
}

function KindTag({ t, f }: { t: T; f: DocumentFinding }) {
  return <span className={f.kind === "conflict" ? "tag tag--warn" : "tag"}>{t.kinds[f.kind]}</span>
}

function DecisionForm({ t, run, res, f, ctx, view, next, nextLabel, overlap }: {
  t: T; run: ComplianceRun; res: DocumentResult; f: DocumentFinding; ctx: Ready; view: FindingView
  next: { documentId: string; findingId: string } | null; nextLabel: string | null
  /** Miesto už zmenil iný prijatý nález — pole začína jeho aktuálnym znením. */
  overlap?: { text: string; via: DocumentFinding } | null
}) {
  const hint = !ctx.canEditDrafts ? t.proposedHintNoRights : res.state === "valid" ? t.proposedHintValid : t.proposedHintDraft
  // Nerozhodnutý nález s navrhnutým znením má predvolene „Prijať a upraviť" (rám návrhu) — pole Nové znenie je hneď vidieť.
  const prior = f.status === "kept" ? "kept" : f.status || f.proposed ? "accepted" : null
  return (
    <form action={decideFindingAction} className="decision cf-dec">
      <input type="hidden" name="runId" value={run.runId} />
      <input type="hidden" name="documentId" value={res.documentId} />
      <input type="hidden" name="findingId" value={f.id} />
      <input type="hidden" name="view" value={view} />
      {next && <input type="hidden" name="next" value={`${next.documentId}:${next.findingId}`} />}
      <fieldset className="decision-fieldset">
        <legend className="field-label">{t.status}</legend>
        <div className="decision-switch">
          <label className="decision-option">
            <input type="radio" name="decision" value="kept" required defaultChecked={prior === "kept"} />
            <span>{t.decisionKeep}</span>
            <span className="decision-tick" aria-hidden="true">✓</span>
          </label>
          <label className="decision-option">
            <input type="radio" name="decision" value="accepted" required defaultChecked={prior === "accepted"} />
            <span>{t.decisionAccept}</span>
            <span className="decision-tick" aria-hidden="true">✓</span>
          </label>
        </div>
      </fieldset>
      {/* Editor Markdownu z knižnice (vizuálny aj zdrojový režim) — úryvok je zdroj konceptu.
          Nie `<label>`: editor je viacero ovládačov, názov nesie `label`. */}
      <div className="field decision-text">
        <span className="field-label">{t.proposed}</span>
        <TextEditor name="text" initial={overlap ? (f.status ? overlap.text : suggestOnCurrent(f, overlap.text)) : f.acceptedText ?? f.proposed ?? f.quote} compact label={t.proposed} />
        {overlap && <span className="quiet field-hint">{t.overlapNote(overlap.via.location, !f.status && suggestOnCurrent(f, overlap.text) !== overlap.text)}</span>}
        <span className="quiet field-hint">{f.proposed || f.acceptedText ? hint : `${t.proposedMissing} ${hint}`}</span>
      </div>
      <label className="field">
        <span className="field-label">{t.reason}</span>
        <textarea className="field-input" name="reason" rows={3} required maxLength={1000} defaultValue={f.reason ?? ""} placeholder={t.reasonPlaceholder} />
        <span className="quiet field-hint">{t.reasonHint}</span>
      </label>
      <div className="cf-acts">
        <SubmitButton className="button button--quiet">{next ? t.saveNext : t.save}</SubmitButton>
        <span className="quiet">{nextLabel ?? t.lastOpen}</span>
      </div>
    </form>
  )
}

/** Poznámka so stavom rozhodnutého nálezu (stavy 3–6 návrhu). */
function StateNote({ t, f, cls, mark, title, who, note }: {
  t: T; f: DocumentFinding; cls: string; mark: string; title: string; who: string; note?: string
}) {
  return (
    <div className={`lnote ${cls}`}>
      <span className="lnote-mark" aria-hidden="true">{mark}</span>
      <span className="lnote-text">
        <b>{title}</b> · {who}
        {note && <small>{note}</small>}
        {f.reason && <small className="cf-reason">{t.reasonLine(f.reason)}</small>}
      </span>
    </div>
  )
}

export default async function ComplianceRunPage({ params, searchParams }: { params: Promise<{ runId: string }>; searchParams: Promise<RawQuery> }) {
  const ctx = await complianceViewContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { runId } = await params
  const run = await documentRun(ctx.tenant.companyCode, decodeURIComponent(runId))
  if (!run) notFound()
  // Meno, nie e-mail: beh nesie len adresu toho, kto ho spustil (kópia v čase spustenia).
  const starter = await (await getCollection<Person>(PERSONS_COLLECTION)).findOne({ companyCode: ctx.tenant.companyCode, email: run.startedBy }, { projection: { _id: 0, fullName: 1 } })
  const startedByName = starter?.fullName?.trim() || run.startedBy
  const q = normalizeQuery<{ msg?: string; error?: string; doc?: string; view?: string; f?: string; change?: string; docs?: string }>(await searchParams)
  const language: UiLanguage = ctx.person.language
  const dict = dictionary(language)
  const t = dict.library.compliance
  const branding = brandingView(ctx.tenant)
  const [usage, model] = await Promise.all([runUsage(run), runModel(run)])
  const when = formatDate(run.startedAt, language)
  const minutes = run.finishedAt ? Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 60_000) : null
  const running = run.pending.length > 0
  const stopped = running && run.failures >= MAX_FAILURES
  const meta: [string, string][] = [
    [t.metaStarted, `${formatDate(run.startedAt, language)}, ${startedByName}`],
    [t.metaFinished, run.finishedAt ? formatDate(run.finishedAt, language) : t.running],
    [t.metaDuration, minutes === null ? t.metaUnknown : t.duration(minutes)],
    [t.metaModel, model ?? t.metaUnknown],
    [t.metaCalls, usage ? t.calls(usage.calls, usage.failed) : t.metaUnknown],
    [t.metaTokens, usage ? t.tokens(usage.input + usage.cacheWrite, usage.output, usage.cacheRead) : t.metaUnknown],
    [t.metaCost, usage ? `${formatAmount(usage.usd, language)} USD` : t.metaUnknown],
    [t.references, run.documents.map(d => `${d.title}${d.state === "draft" ? ` (${t.draftMark})` : d.label ? ` (${d.label})` : ""}`).join(", ")],
    [t.metaSteps, t.steps(run.steps)],
  ]
  const metaSummary = [model, minutes === null ? null : t.duration(minutes), usage ? `${formatAmount(usage.usd, language)} USD` : null].filter(Boolean).join(" · ")

  const base = `/library/compliance/${encodeURIComponent(run.runId)}`
  const results = run.results ?? []
  const progress = runProgress(run)
  const view: FindingView = isFindingView(q.view) ? q.view : "open"
  const selected = results.find(r => r.documentId === q.doc) ?? defaultDocument(results)
  // Náhľad článku len pre otvorený nález — jeden dokument na načítanie, nie 62.
  const openFinding = selected?.findings.find(x => x.id === q.f) ?? null
  const normPreview = openFinding ? await loadNormPreview(ctx.tenant.companyCode, openFinding) : null
  // Iný prijatý nález už prepísal to isté miesto — pole začne aktuálnym znením z konceptu.
  const openBase = openFinding && selected ? await draftBase(ctx.tenant.companyCode, selected.documentId) : null
  const overlap = openFinding && selected && openBase !== null ? currentWording(openBase, openFinding, selected.findings) : null
  const position = selected ? results.indexOf(selected) + 1 : 0
  const showDocs = q.docs === "1"
  // Odkaz so stavom obrazovky; filter `open` je predvolený a do adresy nejde.
  const href = (o: { doc?: string; view?: FindingView; f?: string; change?: boolean; docs?: boolean } = {}, anchor = "") => {
    const p = new URLSearchParams()
    if (o.doc) p.set("doc", o.doc)
    if (o.view && o.view !== "open") p.set("view", o.view)
    if (o.f) p.set("f", o.f)
    if (o.change) p.set("change", "1")
    if (o.docs) p.set("docs", "1")
    const s = p.toString()
    return `${base}${s ? `?${s}` : ""}${anchor ? `#${anchor}` : ""}`
  }
  const subjectIds = run.scope.kind === "documents" ? run.scope.subjectIds : []

  const docRow = (res: DocumentResult) => {
    const open = openCount(res)
    const on = res.documentId === selected?.documentId
    return (
      <Link key={res.documentId} className={`form-row cf-doc${on && !showDocs ? " is-on" : ""}`} href={href({ doc: res.documentId, view })}
            aria-current={on ? "page" : undefined}>
        <span className="form-row-main">
          <b>{res.title}</b>
          <span className="form-row-sub">{res.state === "draft" ? t.draftMark : res.label ? t.validLabel(res.label) : ""}</span>
        </span>
        {res.findings.length === 0 ? <span className="tag">{t.docNoFindings}</span>
          : open === 0 ? <span className="tag tag--published">{t.docDone}</span>
          : <span className="cf-n" title={t.openOfTitle(open)}>{t.openOf(open, res.findings.length)}</span>}
      </Link>
    )
  }
  const docList = (
    <div className="cf-side">
      <div className="cf-side-h">{t.documents(results.length)}</div>
      <div className="card form-group-body form-group-body--rows"><div className="form-list">{results.map(docRow)}</div></div>
    </div>
  )

  const findingCard = (res: DocumentResult, f: DocumentFinding) => {
    const anchor = findingAnchor(res.documentId, f.id)
    const state = findingState(f)
    const isOpen = q.f === f.id && res.documentId === selected?.documentId
    const editing = isOpen && (state === "open" || q.change === "1") && ctx.isReviewer
    if (editing) {
      const next = nextOpen(results, res.documentId, f.id)
      const nextFinding = next ? results.find(r => r.documentId === next.documentId)?.findings.find(x => x.id === next.findingId) : null
      const nextLabel = next && nextFinding
        ? next.documentId === res.documentId ? t.nextIs(nextFinding.location) : t.nextInDoc(results.find(r => r.documentId === next.documentId)!.title)
        : null
      return (
        <article key={f.id} id={anchor} className="card cf is-open">
          <div className="cf-head">
            <KindTag t={t} f={f} />
            <b>{f.location}</b>
            <Link href={href({ doc: res.documentId, view }, anchor)}>{t.collapse}</Link>
          </div>
          <div className="cf-blk">
            <span className="cf-blk-l">{t.change}</span>
            {f.proposed ? <Diff before={f.quote} after={f.proposed} /> : <div className="pr-diff cf-diff">{readableInline(f.quote)}</div>}
          </div>
          <Norm t={t} f={f} preview={normPreview} />
          {f.recommendation && <div className="cf-blk"><span className="cf-blk-l">{t.recommendation}</span><p>{f.recommendation}</p></div>}
          <DecisionForm t={t} run={run} res={res} f={f} ctx={ctx} view={view} next={next} nextLabel={nextLabel} overlap={overlap} />
        </article>
      )
    }
    if (state === "open") {
      return (
        <div key={f.id} id={anchor} className="card cf-row">
          <KindTag t={t} f={f} />
          <span className="cf-loc">{f.location}</span>
          {ctx.isReviewer && <Link className="button button--quiet button--sm" href={href({ doc: res.documentId, view, f: f.id }, anchor)}>{t.decide}</Link>}
        </div>
      )
    }
    const who = t.decidedWhoWhen(f.decidedBy ?? "—", f.decidedAt ? formatDate(f.decidedAt, language) : "—")
    const openDraft = <Link className="button button--quiet" href={`/library/${encodeURIComponent(res.documentId)}/text`}>{t.openDraft}</Link>
    const changeLink = ctx.isReviewer && <Link className="button button--quiet" href={href({ doc: res.documentId, view, f: f.id, change: true }, anchor)}>{t.changeDecision}</Link>
    const accepted = f.acceptedText ?? f.proposed ?? f.quote
    return (
      <article key={f.id} id={anchor} className="card cf">
        <div className="cf-head"><KindTag t={t} f={f} /><b>{f.location}</b></div>
        {state === "draft" && <StateNote t={t} f={f} cls="" mark="✓" title={t.stateDraft} who={who} />}
        {state === "kept" && <StateNote t={t} f={f} cls="lnote--info" mark="–" title={t.stateKept} who={who} />}
        {state === "pending" && (
          <StateNote t={t} f={f} cls="lnote--warn" mark="!" title={t.stateWaiting}
                     who={t.acceptedBy(f.decidedBy ?? "—", f.decidedAt ? formatDate(f.decidedAt, language) : "—")} note={t.waitingNote} />
        )}
        {state === "manual" && <StateNote t={t} f={f} cls="lnote--warn" mark="!" title={t.stateManual} who={who} note={t.manualNote} />}
        <div className="cf-blk">
          <span className="cf-blk-l">{state === "kept" ? t.keptText : t.acceptedText}</span>
          {state === "kept" ? <div className="pr-diff cf-diff">{readableInline(f.quote)}</div> : <Diff before={f.quote} after={accepted} />}
        </div>
        <Norm t={t} f={f} />
        {state === "manual" && (
          <label className="field">
            <span className="field-label">{t.manualText}</span>
            <textarea className="field-input" readOnly rows={4} value={accepted} />
          </label>
        )}
        <div className="cf-acts">
          {state === "pending" && (ctx.canEditDrafts ? (
            <form action={applyFindingAction}>
              <input type="hidden" name="runId" value={run.runId} />
              <input type="hidden" name="documentId" value={res.documentId} />
              <input type="hidden" name="findingId" value={f.id} />
              <input type="hidden" name="view" value={view} />
              <SubmitButton className="button button--quiet">{t.applyToDraft}</SubmitButton>
            </form>
          ) : <span className="quiet">{t.waitingNotified}</span>)}
          {state === "manual" && <CopyLink value={accepted} label={t.copyText} done={t.copied} />}
          {(state === "draft" || state === "manual") && openDraft}
          {changeLink}
        </div>
      </article>
    )
  }

  const findings = selected ? filterFindings(orderedFindings(selected), view) : []
  const counts = selected ? { open: openCount(selected), all: selected.findings.length } : { open: 0, all: 0 }
  const nextDoc = selected ? results.find(r => r.documentId !== selected.documentId && openCount(r) > 0) : null

  const docMain = selected && (
    <div className="cf-main">
      <div className="cf-doc-head">
        <div className="cf-doc-title">
          <h2>{selected.title}</h2>
          {selected.state === "draft" ? <span className="tag tag--draft">{t.draftMark}</span> : selected.label && <span className="tag">{t.validLabel(selected.label)}</span>}
          <Link className="cf-doc-open" href={selected.state === "draft" ? `/library/${encodeURIComponent(selected.documentId)}/text` : `/library/${encodeURIComponent(selected.documentId)}`}>
            {selected.state === "draft" ? t.openDraft : t.openDocument}
          </Link>
        </div>
        {selected.summary && <p>{selected.summary}</p>}
      </div>
      {selected.findings.length === 0 ? (
        <div className="card empty empty--compact"><div className="empty-text">{t.noFindings}</div></div>
      ) : (
        <>
          <nav className="view-switch cf-filter" aria-label={t.viewLabel}>
            {([["open", t.viewOpen, counts.open], ["decided", t.viewDecided, counts.all - counts.open], ["all", t.viewAll, counts.all]] as const).map(([k, label, n]) => (
              <Link key={k} className={`view-switch-item${view === k ? " is-on" : ""}`} href={href({ doc: selected.documentId, view: k })} aria-current={view === k ? "page" : undefined}>
                {label}<span className="view-switch-count">{n}</span>
              </Link>
            ))}
          </nav>
          {findings.length === 0 ? (
            <div className="card empty empty--compact">
              <div className="empty-text">{view === "open" ? t.docAllDecided : t.docNoneDecided}</div>
              {view === "open" && nextDoc && <div className="empty-action"><Link href={href({ doc: nextDoc.documentId })}>{t.nextDocument(nextDoc.title)}</Link></div>}
            </div>
          ) : (
            <div className="cf-list">{findings.map(f => findingCard(selected, f))}</div>
          )}
        </>
      )}
    </div>
  )

  return (
    <AppShell language={language} title={run.name || t.runDefaultName(when)} trail={ctx.isReviewer ? { "/library": dict.library.list.heading, "/library/compliance": t.heading } : { "/library": dict.library.list.heading }}>
    <div className="cf-page" style={tenantStyle(branding)}>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">{run.name || t.runDefaultName(when)}</h1>
          <p className="quiet page-lead">{t.runScope(subjectIds.length || run.total, run.documents.length, startedByName, when)}</p>
        </div>
        {ctx.isReviewer && subjectIds.length > 0 && (
          <form action={startDocumentReviewAction} className="page-tools">
            {subjectIds.map(id => <input key={id} type="hidden" name="subjectIds" value={id} />)}
            {run.documentIds.map(id => <input key={id} type="hidden" name="documentIds" value={id} />)}
            {run.name && <input type="hidden" name="name" value={run.name} />}
            <SubmitButton className="button button--quiet">{t.runAgain}</SubmitButton>
          </form>
        )}
      </div>
      <Notice message={q.msg} error={q.error === "1"} back={href({ doc: q.doc, view, f: q.f })} language={language} />

      <section className="card cf-prog">
        <div className="cf-prog-body">
          {running ? (
            <>
              <div className="cf-prog-top"><b className={stopped ? "bad-fg" : undefined}>{stopped ? t.stopped : t.progress(run.total - run.pending.length, run.total)}</b></div>
              <div className="cf-bar" role="progressbar" aria-valuemin={0} aria-valuemax={run.total} aria-valuenow={run.total - run.pending.length}>
                <i style={{ width: `${run.total ? ((run.total - run.pending.length) / run.total) * 100 : 0}%` }} />
              </div>
            </>
          ) : (
            <>
              <div className="cf-prog-top"><b>{t.decidedOf(progress.decided, progress.total)}</b>{progress.total > progress.decided && <span className="quiet">{t.remaining(progress.total - progress.decided)}</span>}</div>
              <div className="cf-bar" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.decided}>
                <i style={{ width: `${progress.total ? (progress.decided / progress.total) * 100 : 0}%` }} />
              </div>
            </>
          )}
          {progress.byKind.length > 0 && (
            <div className="cf-kinds">
              {progress.byKind.map(k => <span key={k.kind} className={k.kind === "conflict" ? "tag tag--warn" : "tag"}>{t.kindsShort[k.kind]} {k.count}</span>)}
            </div>
          )}
        </div>
        <details className="cf-meta">
          <summary><span className="quiet">{t.metaHeading}</span>{metaSummary && <span>{metaSummary}</span>}</summary>
          {meta.map(([k, v]) => <div key={k} className="labeled-row"><span>{k}</span><span>{v}</span></div>)}
        </details>
      </section>

      {results.length > 0 && (
        <div className="cf-split">
          <div className="cf-split-side">{docList}</div>
          {/* `?docs=1` platí len pod 1024 px; od 1024 px je zoznam v paneli a obsah ostáva. */}
          <div className={showDocs ? "cf-split-main is-docs" : "cf-split-main"}>
            {showDocs && <div className="cf-docs-full">{docList}</div>}
            {(
              <>
                {selected && (
                  <Link className="card form-row cf-pick" href={href({ doc: selected.documentId, view, docs: true })}>
                    <span className="form-row-main">
                      <span className="cf-pick-k">{t.docPosition(position, results.length)}</span>
                      <b>{selected.title}</b>
                    </span>
                    {selected.findings.length > 0 && <span className="cf-n">{t.openOf(openCount(selected), selected.findings.length)}</span>}
                    <span className="cf-pick-chev" aria-hidden="true">›</span>
                  </Link>
                )}
                {docMain}
              </>
            )}
          </div>
        </div>
      )}
    </div>
    </AppShell>
  )
}
