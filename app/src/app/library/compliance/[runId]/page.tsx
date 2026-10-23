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

import { modelLabel } from "@/lib/aiSettings"
import NormCitation from "@/components/NormCitation"
import { loadNormPreview, type NormPreview } from "@/lib/normPreview"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import SubmitButton from "@/components/SubmitButton"
import CopyLink from "@/components/CopyLink"
import TextEditor from "@/components/TextEditor"
import { complianceViewContext, type ComplianceViewContext } from "@/lib/complianceAccess"
import { isRunning, documentRun, draftBase, currentWording, suggestOnCurrent, runUsage, runModel, MAX_FAILURES, type DocumentFinding, type DocumentResult, type ComplianceRun } from "@/lib/complianceCheck"
import { checkById, roundsOf } from "@/lib/complianceChecks"
import {
  defaultDocument, filterFindings, findingAnchor, findingState, isFindingView, nextOpen, openCount, orderedFindings, runProgress,
  roundDelta, roundTabs, roundState, type FindingView, findingContext } from "@/lib/complianceView"
import { wordDiff, readableInline } from "@/lib/wordDiff"
import { getCollection } from "@/lib/mongodb"
import { PERSONS_COLLECTION, type Person } from "@/lib/persons"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate, formatAmount, type UiLanguage } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { renameRunAction, decideFindingAction, applyFindingAction, stopRunAction, archiveRunAction } from "../../complianceActions"

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

/**
 * Zmena znenia v celom odseku (Ján 23. 10. 2026: „potrebujem vidieť viac
 * súvislostí, aby som nezmenil význam celého bloku textu"). Nadpis oddielu
 * a bloky pred a za sú sivé; blok s úryvkom ukazuje zmenu. Keď úryvok
 * v koncepte nie je (zmenil ho iný nález), ostane samotný rozdiel s poznámkou.
 */
function ChangeInContext({ t, f, base }: { t: T; f: DocumentFinding; base: string | null }) {
  const only = f.proposed ? <Diff before={f.quote} after={f.proposed} /> : <div className="pr-diff cf-diff">{readableInline(f.quote)}</div>
  const c = base ? findingContext(base, f.quote, f.proposed) : null
  return (
    <div className="cf-blk">
      <span className="cf-blk-l">{t.change}</span>
      {c ? (
        <>
          {/* Len triedy z design systému: okolie je `.cf-diff` s `.quiet`, nadpis oddielu `.cf-blk-l`. */}
          {c.heading && <span className="cf-blk-l">{c.heading}</span>}
          {c.before && <div className="cf-diff quiet">{readableInline(c.before)}</div>}
          {c.blockAfter ? <Diff before={c.block} after={c.blockAfter} /> : <>
            <div className="pr-diff cf-diff">{readableInline(c.block)}</div>
            {f.proposed && only}
          </>}
          {c.after && <div className="cf-diff quiet">{readableInline(c.after)}</div>}
          <span className="quiet field-hint">{t.contextNote}</span>
        </>
      ) : (
        <>
          {only}
          {base !== null && <span className="quiet field-hint">{t.contextMissing}</span>}
        </>
      )}
    </div>
  )
}

/** Text citovaného článku na náhľad (voľba 1, Ján 11. 10. 2026) a záväzné PDF. */
function Norm({ t, f, preview }: { t: T; f: DocumentFinding; preview?: NormPreview | null }) {
  // Doplnenie len z praxe helpdesku (ADR-034, D221) — nie je dokument, na ktorý by sa dalo odkázať.
  if (f.citation.documentId.startsWith("helpdesk:")) {
    return (
      <div className="cf-blk">
        <span className="cf-blk-l">{t.helpdeskSource}</span>
        <p>{f.citation.title}{f.citation.articleRef ? `, ${f.citation.articleRef}` : ""}</p>
        {f.citation.quote && <blockquote className="quote">{f.citation.quote}</blockquote>}
      </div>
    )
  }
  return <NormCitation citation={f.citation} preview={preview} labels={{ norm: t.norm, opensNewWindow: t.opensNewWindow, showArticle: t.showArticle, articleNote: t.articleNote, openPdf: t.openPdf }} />
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
        <TextEditor name="text" initial={overlap ? (f.status ? overlap.text : suggestOnCurrent(f, overlap.text)) : f.acceptedText ?? f.proposed ?? f.quote} compact label={t.proposed} mode="markdown" />
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
  /*
   * Adresa je kontrola (ADR-036, D239) alebo beh. Kolo kontroly na svojej
   * adrese presmeruje na kontrolu s `?round=` (odkazy z upozornení a e-mailov
   * platia ďalej); beh spred D239 bez kontroly sa ukáže v starom tvare, len
   * na čítanie (zrušený 20. 10. 2026).
   */
  const { runId: idParam } = await params
  const id = decodeURIComponent(idParam)
  const sp = await searchParams
  const check = await checkById(ctx.tenant.companyCode, id)
  const rounds = check ? await roundsOf(ctx.tenant.companyCode, check.checkId) : []
  if (check && !rounds.length) redirect(`/library/compliance/confirm?check=${encodeURIComponent(check.checkId)}`)
  const wantRound = Number(Array.isArray(sp.round) ? sp.round[0] : sp.round)
  const run = check ? (rounds.find(r => r.round === wantRound) ?? rounds[rounds.length - 1]) : await documentRun(ctx.tenant.companyCode, id)
  if (!run) notFound()
  if (!check && run.checkId) {
    const keep = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : [v]) if (x !== undefined) keep.append(k, String(x))
    keep.set("round", String(run.round ?? 1))
    redirect(`/library/compliance/${encodeURIComponent(run.checkId)}?${keep.toString()}`)
  }
  const latestRun = check ? rounds[rounds.length - 1] : run
  const isLatest = run.runId === latestRun.runId
  // Rozhoduje sa len v poslednom kole nezrušenej kontroly (Q3); beh spred D239 je na čítanie.
  const readOnly = !check || !isLatest || Boolean(check.archivedAt)
  const canDecide = ctx.isReviewer && !readOnly
  const roundOfRun = new Map(rounds.map(r => [r.runId, r.round ?? 1]))
  const prevRound = check ? rounds[rounds.indexOf(run) - 1] ?? null : null
  // Meno, nie e-mail: beh nesie len adresu toho, kto ho spustil (kópia v čase spustenia).
  const starter = await (await getCollection<Person>(PERSONS_COLLECTION)).findOne({ companyCode: ctx.tenant.companyCode, email: run.startedBy }, { projection: { _id: 0, fullName: 1 } })
  const startedByName = starter?.fullName?.trim() || run.startedBy
  const q = normalizeQuery<{ msg?: string; error?: string; doc?: string; view?: string; f?: string; change?: string; docs?: string; rounds?: string; rename?: string; cancel?: string; usage?: string }>(sp)
  const language: UiLanguage = ctx.person.language
  const dict = dictionary(language)
  const t = dict.library.compliance
  const branding = brandingView(ctx.tenant)
  const [usage, modelId] = await Promise.all([runUsage(run), runModel(run)])
  // Názov, nie identifikátor (`claude-opus-5-5` → „Claude Opus 5.5").
  const model = modelId ? modelLabel(modelId) : null
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

  const base = `/library/compliance/${encodeURIComponent(check?.checkId ?? run.runId)}`
  // Staršie kolo nesie `?round=` vo všetkých odkazoch; posledné je predvolené.
  const roundQuery = check && !isLatest ? `round=${run.round ?? 1}` : ""
  const results = run.results ?? []
  const progress = runProgress(run)
  const view: FindingView = isFindingView(q.view) ? q.view : "open"
  const selected = results.find(r => r.documentId === q.doc) ?? defaultDocument(results)
  // Náhľad článku len pre otvorený nález — jeden dokument na načítanie, nie 62.
  const openFinding = selected?.findings.find(x => x.id === q.f) ?? null
  const normPreview = openFinding ? await loadNormPreview(ctx.tenant.companyCode, openFinding.citation) : null
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
    if (roundQuery) p.set("round", String(run.round ?? 1))
    const s = p.toString()
    return `${base}${s ? `?${s}` : ""}${anchor ? `#${anchor}` : ""}`
  }
  const subjectIds = run.scope.kind === "documents" ? run.scope.subjectIds : []
  const helpdesk = run.scope.kind === "documents" ? run.scope.helpdesk ?? null : null

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

  // Nález nový v tomto kole (bez prenesenia) — od kola 2 (návrh, „Nový v kole n").
  const newTag = (f: DocumentFinding) => check && (run.round ?? 1) > 1 && !f.carriedFrom
    ? <span className="tag tag--review">{t.ck.newInRound(run.round ?? 1)}</span> : null

  const findingCard = (res: DocumentResult, f: DocumentFinding) => {
    const anchor = findingAnchor(res.documentId, f.id)
    const state = findingState(f)
    const isOpen = q.f === f.id && res.documentId === selected?.documentId
    const editing = isOpen && (state === "open" || q.change === "1") && canDecide
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
            {newTag(f)}
            <b>{f.location}</b>
            <Link href={href({ doc: res.documentId, view }, anchor)}>{t.collapse}</Link>
          </div>
          <ChangeInContext t={t} f={f} base={openBase} />
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
          {newTag(f)}
          {canDecide && <Link className="button button--quiet button--sm" href={href({ doc: res.documentId, view, f: f.id }, anchor)}>{t.decide}</Link>}
        </div>
      )
    }
    const who = t.decidedWhoWhen(f.decidedBy ?? "—", f.decidedAt ? formatDate(f.decidedAt, language) : "—")
    const openDraft = <Link className="button button--quiet" href={`/library/${encodeURIComponent(res.documentId)}/text`}>{t.openDraft}</Link>
    const changeLink = canDecide && <Link className="button button--quiet" href={href({ doc: res.documentId, view, f: f.id, change: true }, anchor)}>{t.changeDecision}</Link>
    const accepted = f.acceptedText ?? f.proposed ?? f.quote
    return (
      <article key={f.id} id={anchor} className="card cf">
        <div className="cf-head"><KindTag t={t} f={f} />{newTag(f)}<b>{f.location}</b></div>
        {state === "draft" && <StateNote t={t} f={f} cls="" mark="✓" title={t.stateDraft} who={who} />}
        {state === "kept" && <StateNote t={t} f={f} cls="lnote--info" mark="–" title={t.stateKept} who={who} note={f.carriedFrom ? (roundOfRun.has(f.carriedFrom.runId) ? t.ck.carriedFrom(roundOfRun.get(f.carriedFrom.runId)!) : t.carriedNote) : undefined} />}
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
          {state === "pending" && (ctx.canEditDrafts && !readOnly ? (
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

  /* ── Kontrola a kolá (KNIZ-kontroly-a-kola, 20. 10. 2026) ─────────────── */
  const title = check ? (check.name || t.runDefaultName(formatDate(check.createdAt, language))) : run.name || t.runDefaultName(when)
  const lead = check
    ? `${check.kind === "helpdesk" ? t.ck.kindHelpdesk : t.ck.kindDocuments} · ${check.kind === "helpdesk"
        ? t.ck.scopeHelpdesk(helpdesk?.items.length ?? 0, check.channelName ?? "", subjectIds.length)
        : t.ck.scopeDocs(subjectIds.length, run.documentIds.length)}`
    : t.runScope(subjectIds.length || run.total, run.documents.length, startedByName, when)
  const anyRunning = rounds.some(r => isRunning(r))
  const manageable = Boolean(check && ctx.isReviewer && !check.archivedAt)
  const tabs = check ? roundTabs(rounds.map(r => r.round ?? 1), run.round ?? 1) : { shown: [], older: false }
  const delta = check && prevRound ? roundDelta(prevRound, run) : null
  const roundHref = (n: number) => n === (latestRun.round ?? 1) ? base : `${base}?round=${n}`
  const state = roundState(run).state

  return (
    <AppShell language={language} title={title}>
    <div className="cf-page" style={tenantStyle(branding)}>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">{title}</h1>
          <p className="quiet page-lead">{lead}</p>
        </div>
        {/* Akcie kontroly (`toolbar`): Premenovať a plné „Nové kolo" — kým nič nebeží. */}
        {manageable && (
          <div className="page-tools">
            <Link className="button button--quiet" href={`${base}?rename=1`}>{t.rename}</Link>
            {!anyRunning && <Link className="button" href={`/library/compliance/confirm?check=${encodeURIComponent(check!.checkId)}`}>{t.ck.newRound}</Link>}
          </div>
        )}
      </div>
      {manageable && q.rename === "1" && (
        <form action={renameRunAction} className="card task-card ck-rename">
          <input type="hidden" name="checkId" value={check!.checkId} />
          <label className="field" style={{ margin: 0 }}>
            <span className="field-label">{t.nameLabel}</span>
            <input className="field-input" name="name" defaultValue={check!.name} maxLength={120} placeholder={t.runDefaultName(formatDate(check!.createdAt, language))} />
            <span className="quiet field-hint">{t.nameHint}</span>
          </label>
          <div className="task-acts">
            <SubmitButton className="button button--quiet">{t.saveName}</SubmitButton>
            <Link className="button button--quiet" href={base}>{t.ck.cancel}</Link>
          </div>
        </form>
      )}
      <Notice message={q.msg} error={q.error === "1"} back={href({ doc: q.doc, view, f: q.f })} language={language} />
      {(check?.archivedAt ?? (!check ? run.archivedAt : null)) && (
        <div className="lnote lnote--warn" style={{ marginBottom: 12 }}>
          <span className="lnote-mark" aria-hidden="true">!</span>
          <div className="lnote-text">{t.archivedBanner(formatDate((check?.archivedAt ?? run.archivedAt)!, language), (check?.archivedBy ?? run.archivedBy) ?? "")}</div>
        </div>
      )}
      {!check && (
        <div className="lnote lnote--info" style={{ marginBottom: 12 }}>
          <span className="lnote-mark" aria-hidden="true">i</span>
          <div className="lnote-text">{t.ck.legacyReadOnly}</div>
        </div>
      )}

      {/* Kolá (Q1, `Picker(.segmented)`): posledné predvolené, staršie cez `?round=`. */}
      {check && (
        <div className="ck-rounds">
          {rounds.length > 1 && (
            <nav className="view-switch" aria-label={t.ck.roundsLabel}>
              {tabs.shown.map(n => (
                <Link key={n} className={`view-switch-item${n === (run.round ?? 1) && q.rounds !== "all" ? " is-on" : ""}`} href={roundHref(n)}
                      aria-current={n === (run.round ?? 1) ? "page" : undefined}>{t.ck.roundN(n)}</Link>
              ))}
              {tabs.older && <Link className={`view-switch-item${q.rounds === "all" ? " is-on" : ""}`} href={`${base}?rounds=all`}>{t.ck.olderRounds}</Link>}
            </nav>
          )}
          <span className="quiet">{rounds.length === 1 && `${t.ck.roundN(run.round ?? 1)} · `}{t.ck.roundMeta(when, startedByName)}</span>
        </div>
      )}
      {check && q.rounds === "all" && (
        <div className="card form-group-body form-group-body--rows ck-all-rounds">
          <div className="form-list">
            {[...rounds].reverse().map(r => (
              <Link key={r.runId} className="form-row" href={roundHref(r.round ?? 1)}>
                <span className="form-row-main">
                  <b>{t.ck.roundN(r.round ?? 1)}</b>
                  <span className="form-row-sub">{formatDate(r.startedAt, language)} · {t.ck.roundStates[roundState(r).state]}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {check && !isLatest && (
        <div className="lnote lnote--info" style={{ marginBottom: 12 }}>
          <span className="lnote-mark" aria-hidden="true">i</span>
          <div className="lnote-text"><b>{t.ck.olderReadOnly}</b> <Link href={base}>{t.ck.goToLatest(latestRun.round ?? 1)}</Link></div>
        </div>
      )}

      {/* Pás priebehu kola. */}
      <section className="card cf-prog">
        <div className="cf-prog-body">
          {running ? (
            <>
              <div className="cf-prog-top">
                <b className={stopped ? "bad-fg" : undefined}>{stopped ? t.stopped : t.progress(run.total - run.pending.length, run.total)}</b>
                {metaSummary && <span className="quiet">{metaSummary}</span>}
              </div>
              <div className="cf-bar" role="progressbar" aria-valuemin={0} aria-valuemax={run.total} aria-valuenow={run.total - run.pending.length}>
                <i style={{ width: `${run.total ? ((run.total - run.pending.length) / run.total) * 100 : 0}%` }} />
              </div>
              {!stopped && <p className="quiet" style={{ margin: 0 }}>{t.ck.runningNote}</p>}
              {/* Omylom spustené kolo sa nemusí dobehnúť a zaplatiť (ADR-036, D237). */}
              {ctx.isReviewer && isRunning(run) && (
                <form action={stopRunAction}>
                  <input type="hidden" name="runId" value={run.runId} />
                  <SubmitButton className="button button--quiet">{t.stopRun}</SubmitButton>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="cf-prog-top">
                <b>{t.decidedOf(progress.decided, progress.total)}</b>
                {progress.total > progress.decided && <span className="quiet">{t.remaining(progress.total - progress.decided)}</span>}
                {run.stoppedAt && <span className="tag tag--warn">{t.stoppedNote(formatDate(run.stoppedAt, language))}</span>}
                {metaSummary && <span className="quiet ck-usage">{metaSummary}</span>}
              </div>
              <div className="cf-bar" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.decided}>
                <i style={{ width: `${progress.total ? (progress.decided / progress.total) * 100 : 0}%` }} />
              </div>
            </>
          )}
          {state === "failed" && (
            <div className="lnote lnote--bad">
              <span className="lnote-mark" aria-hidden="true">✕</span>
              <div className="lnote-text">{t.ck.failedNote}{run.error && <small>{run.error}</small>}</div>
            </div>
          )}
          {progress.byKind.length > 0 && (
            <div className="cf-kinds">
              {progress.byKind.map(k => <span key={k.kind} className={k.kind === "conflict" ? "tag tag--warn" : "tag"}>{t.kindsShort[k.kind]} {k.count}</span>)}
            </div>
          )}
          <Link className="ck-usage-toggle" href={q.usage === "1" ? href({ doc: q.doc, view }) : `${href({ doc: q.doc, view })}${href({ doc: q.doc, view }).includes("?") ? "&" : "?"}usage=1`}>
            {q.usage === "1" ? t.ck.usageLess : t.ck.usageMore}
          </Link>
          {q.usage === "1" && <div className="ck-usage-rows">{meta.map(([k, v]) => <div key={k} className="labeled-row"><span>{k}</span><span>{v}</span></div>)}</div>}
        </div>
        {/* Zmena oproti predošlému kolu (od kola 2) — odvodená z prenesených ponechaní a prijatí. */}
        {delta && prevRound && !running && (
          <div className="delta">
            <span><b>{t.ck.deltaNew(delta.fresh)}</b></span>
            {delta.carried > 0 && <span>{t.ck.deltaCarried(delta.carried)}</span>}
            {delta.gone > 0 && <span>{t.ck.deltaGone(delta.gone, prevRound.round ?? 1)}</span>}
            {delta.fresh > 0 && <Link href={href({ doc: q.doc, view: "new" })}>{t.ck.showNew}</Link>}
          </div>
        )}
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

      {/* Ďalšie akcie: Zrušiť kontrolu (D238) — na konci, potvrdenie v adrese (`confirmationDialog`). */}
      {manageable && (
        <section className="card more ck-more" id="more">
          <div className="more-head"><h2>{dict.common.moreActions}</h2></div>
          <div className="more-row">
            <div className="more-main">
              <b>{t.ck.cancelCheck}</b>
              <span>{t.ck.cancelCheckNote}</span>
            </div>
            {q.cancel !== "1" && <Link className="button button--danger" href={`${base}?cancel=1#more`}>{t.ck.cancelCheck}</Link>}
          </div>
          {q.cancel === "1" && (
            <form action={archiveRunAction} className="more-confirm">
              <input type="hidden" name="checkId" value={check!.checkId} />
              <h3>{t.ck.cancelTitle(title)}</h3>
              <ul className="ck-effects">
                {t.ck.cancelEffects.map(e => <li key={e}>{e}</li>)}
                {anyRunning && <li>{t.ck.cancelRunning}</li>}
              </ul>
              <label className="field" style={{ margin: 0 }}>
                <span className="field-label">{t.ck.cancelReason}</span>
                <textarea className="field-input" name="reason" rows={2} maxLength={1000} />
              </label>
              <div className="more-acts">
                <SubmitButton className="button button--danger">{t.ck.cancelCheck}</SubmitButton>
                <Link className="button button--quiet" href={`${base}#more`}>{t.ck.keep}</Link>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
    </AppShell>
  )
}
