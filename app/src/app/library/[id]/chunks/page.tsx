/**
 * Členenie na úseky — vizuálny rezač blokov (KNIZ-rezac-blokov, 15. 10. 2026).
 *
 * Text znenia celý na obrazovke, úseky ako farebné bloky (`.cut-block`).
 * Tri pohľady v adrese (`?view=`): **Dnes** — úseky, z ktorých asistent
 * odpovedá (pri koncepte: ako by sa narezal pri zverejnení); **Návrh** —
 * rez podľa kola návrhu AI; **Rozdiel** — návrh ako prekrytie s novými
 * a zrušenými hranicami a zdôvodnením.
 *
 * Model navrhuje len hranice, text nemení (`lib/chunkProposal.ts`). Nič sa
 * neuloží bez „Prijať a preindexovať" — jediné plné tlačidlo, na konci (R2).
 * Formulár skúšobného rezu so štyrmi poľami zanikol; pomenovaný profil (D79)
 * sa dá vybrať v rozbaľovači na konci.
 *
 * Vidí ho správca obsahu (`libraryContext`). Bez JavaScriptu.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import type { ReactNode } from "react"
import { libraryContext } from "@/lib/library"
import { OVERSIZE_FACTOR } from "@/lib/chunkingInspect"
import { cutterState } from "@/lib/chunkCutter"
import { splitBlocks, groupBlocks, boundaryDiff, groupTokens, headingText, type TextBlock } from "@/lib/chunkBlocks"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import Notice from "@/components/Notice"
import FormattedText from "@/components/FormattedText"
import SubmitButton from "@/components/SubmitButton"
import { applyChunkingProfileAction, proposeChunkCutAction, acceptChunkRoundAction } from "../../actions"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate } from "@/lib/i18n"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

type View = "today" | "proposal" | "diff"

/** Tón bloku — šesť jemných odtieňov farby organizácie, nie dúha. */
const tone = (i: number) => `cut-tone-${(i % 6) + 1}`

/** Jeden blok textu — nadpis, tabuľka v rámiku, ostatné ako formátovaný text. */
function BlockView({ block }: { block: TextBlock }) {
  if (block.kind === "heading") {
    return block.level <= 2 ? <h2>{headingText(block)}</h2> : <h3>{headingText(block)}</h3>
  }
  if (block.kind === "table") return <pre className="cut-pre">{block.text}</pre>
  return <FormattedText text={block.text} />
}

export default async function ChunksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<RawQuery>
}) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const documentId = decodeURIComponent((await params).id)
  const q = normalizeQuery<{ msg?: string; error?: string; view?: string; round?: string }>(await searchParams)
  const state = await cutterState(ctx.tenant.companyCode, documentId)
  if (!state) notFound()
  const r = state.inspection
  const here = `/library/${encodeURIComponent(documentId)}/chunks`

  const language = ctx.person.language
  const t = dictionary(language).library.chunks
  const c = t.cut
  const branding = brandingView(ctx.tenant)
  const limit = Math.round(r.profile.values.maxTokens * OVERSIZE_FACTOR)
  const min = r.profile.values.minTokens

  // Kolo: z adresy, inak najnovšie. Bez kola je len pohľad Dnes.
  const round = state.rounds.find(x => String(x.no) === q.round) ?? state.rounds[0] ?? null
  const view: View = round && (q.view === "proposal" || q.view === "diff") ? q.view : "today"
  const href = (v: View, no = round?.no) => `${here}?view=${v}${no ? `&round=${no}` : ""}`

  const todayTokens = state.todayChunks.map(x => x.tokens)
  const stat = (tokens: number[]) => tokens.length
    ? `${Math.min(...tokens)} – ${Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length)} – ${Math.max(...tokens)}`
    : "—"
  const badToday = state.todayChunks.filter(x => x.tokens > limit || (x.complete === false && x.tokens < min / 2)).length
  const proposalTokens = round ? groupTokens(state.blocks, round.boundaries) : []
  // Pri návrhu len veľké úseky: krátka celá časť je prirodzená jednotka,
  // úlomok vzniká len delením (to isté pravidlo ako v pohľade Dnes).
  const badProposal = proposalTokens.filter(n => n > limit).length
  const diff = round ? boundaryDiff(state.current, round.boundaries) : null
  const reasonOf = (b: number) => round?.reasons.find(x => x.block === b)?.why ?? ""
  const label = (b: number) => {
    const block = state.blocks[b]
    if (!block) return ""
    return block.kind === "heading" ? headingText(block) : block.text.replace(/\s+/g, " ").slice(0, 60)
  }

  /*
   * ── pohľad Dnes: uložené úseky (pri koncepte rez pri zverejnení) ──
   *
   * Uložený text úseku je zlúčený do jedného riadku (chunker spája riadky),
   * takže sa vykresľujú **bloky znenia** podľa hraníc uložených úsekov —
   * s nadpismi a tabuľkami tak, ako sú v texte. Len keď sa hranice nedajú
   * nájsť presne, ukáže sa uložený text, ako je.
   */
  const todayGroups = groupBlocks(state.blocks.length, state.current)
  const todayFromBlocks = !state.approximate && todayGroups.length === state.todayChunks.length
  const todayView = (
    <article className="cut-doc card" aria-label={c.docLabel}>
      {state.todayChunks.map((ch, i) => {
        const oversized = ch.tokens > limit
        const fragment = !oversized && ch.complete === false && ch.tokens < min / 2
        return (
          <section key={ch.chunkIndex} className={`cut-block ${tone(i)}${oversized ? " is-oversized" : ""}${fragment ? " is-fragment" : ""}`}
                   aria-label={c.chunkLabel(ch.chunkIndex + 1)}>
            <header className="cut-head">
              <span className="cut-no">{ch.chunkIndex + 1}</span>
              <span className="cut-ref">
                {ch.articleRef
                  ?? (todayFromBlocks ? todayGroups[i].map(b => state.blocks[b]).find(b => b.kind === "heading") : undefined)?.text.replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "")
                  ?? t.noArticle}
              </span>
              <span className="cut-tokens quiet">{t.tokens(ch.tokens)}</span>
              {oversized && <><span className="tag tag--expired">{t.oversizedTag}</span><span className="cut-note quiet">{c.oversizedNote(limit)}</span></>}
              {fragment && <><span className="tag tag--draft">{c.fragmentTag}</span><span className="cut-note quiet">{c.fragmentNote}</span></>}
            </header>
            <div className="cut-body">
              {todayFromBlocks
                ? todayGroups[i].map(b => <BlockView key={b} block={state.blocks[b]} />)
                : splitBlocks(ch.text).map(b => <BlockView key={b.index} block={b} />)}
            </div>
          </section>
        )
      })}
    </article>
  )

  /* ── pohľad Návrh a Rozdiel: bloky textu podľa hraníc kola ── */
  const groups = round ? groupBlocks(state.blocks.length, round.boundaries) : []
  const proposalView = (withDiff: boolean) => (
    <article className="cut-doc card" aria-label={c.docLabel}>
      {groups.map((g, i) => {
        const start = g[0]
        const added = withDiff && diff!.added.includes(start)
        const tokens = proposalTokens[i]
        const nodes: ReactNode[] = []
        g.forEach(b => {
          if (withDiff && b !== start && diff!.removed.includes(b)) {
            nodes.push(
              <div key={`rm-${b}`} className="cut-boundary cut-boundary--removed cut-boundary--inside" role="note">
                <span className="cut-boundary-label">{c.removedBoundary(label(b))}</span>
                <span className="cut-boundary-line" aria-hidden="true" />
                {reasonOf(b) && <span className="cut-boundary-why">{reasonOf(b)}</span>}
              </div>,
            )
          }
          nodes.push(<BlockView key={b} block={state.blocks[b]} />)
        })
        return (
          <div key={start} className="cut-group">
            {added && (
              <div className="cut-boundary cut-boundary--new" role="note">
                <span className="cut-boundary-label">{c.newBoundary(label(start))}</span>
                <span className="cut-boundary-line" aria-hidden="true" />
                {reasonOf(start) && <span className="cut-boundary-why">{reasonOf(start)}</span>}
              </div>
            )}
            <section className={`cut-block ${tone(i)}${tokens > limit ? " is-oversized" : ""}`} aria-label={c.chunkLabel(i + 1)}>
              <header className="cut-head">
                <span className="cut-no">{i + 1}</span>
                <span className="cut-ref">{state.blocks[start].kind === "heading" ? headingText(state.blocks[start]) : c.continuation}</span>
                <span className="cut-tokens quiet">{t.tokens(tokens)}</span>
                {added && <span className="tag tag--new">{c.newChunkTag}</span>}
                {tokens > limit && <span className="tag tag--expired">{t.oversizedTag}</span>}
              </header>
              <div className="cut-body">{nodes}</div>
            </section>
          </div>
        )
      })}
    </article>
  )

  return (
    <AppShell language={language} title={t.heading} trail={{ [`/library/${documentId}`]: r.title }}>
    <div className="cut-page" style={{ maxWidth: 1180, ...tenantStyle(branding) }}>
      <Notice language={language} message={q.msg} error={q.error === "1"} back={here} />

      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">{t.heading}</h1>
          <p className="quiet page-lead">
            {round && view !== "today"
              ? c.roundLead(formatDate(new Date(round.at), language), round.model, round.no)
              : t.intro}
          </p>
        </div>
        <span className="page-head-spacer" aria-hidden="true" />
        {!round && state.text && (
          <form action={proposeChunkCutAction} className="page-tools">
            <input type="hidden" name="documentId" value={documentId} />
            <SubmitButton className="button button--quiet" pendingLabel={c.proposing}>{c.propose}</SubmitButton>
          </form>
        )}
      </div>

      {state.draft && (
        <div className="lnote lnote--warn" style={{ marginBottom: 14 }}>
          <span className="lnote-mark" aria-hidden="true">!</span>
          <span className="lnote-text">{c.draftNote}</span>
        </div>
      )}

      {!state.text ? (
        <div className="empty">
          <div className="empty-title">{c.noTextTitle}</div>
          <div className="empty-text">{t.noVersion}</div>
        </div>
      ) : (
        <>
          <div className="cut-summary card">
            <span><span className="quiet">{t.version}</span> <strong>{state.draft ? c.draftVersion : (r.version?.label ?? "—")}</strong></span>
            <span><span className="quiet">{c.method}</span> <strong>{state.manual ? c.methodManual : r.profile.label}</strong></span>
            {view === "today" ? (
              <>
                <span><span className="quiet">{t.statsCount}</span> <strong>{state.todayChunks.length}</strong></span>
                <span><span className="quiet">{t.statsTokens}</span> <strong>{stat(todayTokens)}</strong> <span className="quiet">({t.target(min, r.profile.values.maxTokens)})</span></span>
                <span className={`tag ${badToday ? "tag--draft" : "tag--published"}`}>{badToday ? c.badCount(badToday) : c.noBad}</span>
              </>
            ) : (
              <>
                <span><span className="quiet">{c.today}</span> <strong>{c.chunksCount(state.current.length + 1)}</strong></span>
                <span><span className="quiet">{c.proposal}</span> <strong>{c.chunksCount(groups.length)}</strong> <span className="quiet">· {stat(proposalTokens)}</span></span>
                <span className={`tag ${badProposal ? "tag--draft" : "tag--published"}`}>{badProposal ? c.badCount(badProposal) : c.noBad}</span>
              </>
            )}
            <span className="page-head-spacer" aria-hidden="true" />
            {round && (
              <nav className="view-switch" aria-label={c.viewLabel}>
                <Link className={`view-switch-item${view === "today" ? " is-on" : ""}`} href={href("today")} aria-current={view === "today" ? "page" : undefined}>{c.viewToday}</Link>
                <Link className={`view-switch-item${view === "proposal" ? " is-on" : ""}`} href={href("proposal")} aria-current={view === "proposal" ? "page" : undefined}>{c.viewProposal}</Link>
                <Link className={`view-switch-item${view === "diff" ? " is-on" : ""}`} href={href("diff")} aria-current={view === "diff" ? "page" : undefined}>{c.viewDiff}</Link>
              </nav>
            )}
          </div>

          {view === "today" && r.today?.outdated && !state.draft && (
            <div className="lnote lnote--warn" style={{ marginBottom: 14 }}>
              <span className="lnote-mark" aria-hidden="true">!</span>
              <span className="lnote-text">{t.outdated(r.stats.count, r.today.count)} {t.reindexHint}</span>
            </div>
          )}

          {view === "diff" && round && diff && (
            <div className="lnote" style={{ marginBottom: 14 }}>
              <span className="lnote-mark" aria-hidden="true">✓</span>
              <span className="lnote-text">
                {c.diffLead(diff.added.length, diff.removed.length)}
                {round.summary && <> {round.summary}</>}
                {state.approximate && <> {c.approximate}</>}
              </span>
            </div>
          )}

          {view === "today" ? todayView : proposalView(view === "diff")}

          {round && round.issues.length > 0 && view !== "today" && (
            <section className="card chunks-block">
              <h2>{c.issuesHeading}</h2>
              <ul className="chunks-warnings">{round.issues.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </section>
          )}

          {round && (
            <>
              <form action={proposeChunkCutAction} className="form-group cut-form">
                <input type="hidden" name="documentId" value={documentId} />
                <h2 className="form-group-head">{c.noteHeading}</h2>
                <div className="card form-group-body cut-form-body">
                  <label className="field">
                    <span className="field-label">{c.noteLabel}</span>
                    <textarea className="field-input" name="note" rows={3} maxLength={2000} placeholder={c.notePlaceholder} />
                    <span className="quiet field-hint">{c.noteHint}</span>
                  </label>
                  <div><SubmitButton className="button button--quiet" pendingLabel={c.proposing}>{c.proposeAgain}</SubmitButton></div>
                </div>
              </form>

              <section className="form-group cut-form" aria-labelledby="cut-rounds">
                <h2 className="form-group-head" id="cut-rounds">{c.roundsHeading}</h2>
                <div className="card cut-rounds">
                  {state.rounds.map(x => (
                    <div key={x.no} className="cut-round">
                      <span className="cut-round-no">{x.no}</span>
                      <div>
                        <div className="cut-round-meta">
                          <strong>{x.source === "auto" ? c.roundAuto : x.by}</strong> · {formatDate(new Date(x.at), language)} · {x.model}
                        </div>
                        {x.note
                          ? <p className="cut-round-note">„{x.note}“</p>
                          : <p className="cut-round-note quiet">{c.roundNoNote}</p>}
                        {x.summary && <p className="cut-round-change quiet">{x.summary}</p>}
                      </div>
                      {x.no === round.no
                        ? <span className="tag tag--new">{c.roundShown}</span>
                        : <Link className="button button--quiet button--sm" href={href("diff", x.no)}>{c.roundShow}</Link>}
                    </div>
                  ))}
                </div>
              </section>

              <form action={acceptChunkRoundAction} className="card cut-accept">
                <input type="hidden" name="documentId" value={documentId} />
                <input type="hidden" name="round" value={round.no} />
                <div className="cut-accept-main">
                  <div className="cut-accept-title">{c.acceptTitle(round.no)}</div>
                  <div className="quiet cut-accept-note">{state.draft ? c.acceptNoteDraft(groups.length) : c.acceptNote(groups.length)}</div>
                </div>
                <SubmitButton className="button" pendingLabel={c.accepting}>{c.accept}</SubmitButton>
              </form>
            </>
          )}

          {!round && (
            <section className="card chunks-block">
              <h2>{c.proposeHeading}</h2>
              <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-small)" }}>{c.proposeIntro}</p>
            </section>
          )}

          {/* Pomenovaný profil (D79) — rez profilom ostáva pre dokumenty bez ručných hraníc. */}
          {r.profiles.length > 1 && (
            <details className="card chunks-block cut-profile">
              <summary>{t.saveHeading} · {r.profile.label}</summary>
              <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-small)" }}>{t.saveIntro}</p>
              <form action={applyChunkingProfileAction} className="chunks-row">
                <input type="hidden" name="documentId" value={documentId} />
                <label className="field">
                  <span className="field-label">{t.useProfile}</span>
                  <select className="field-input" name="profileKey" defaultValue={r.profile.key}>
                    {r.profiles.map(p => (
                      <option key={p.key} value={p.key}>
                        {p.label} · „{p.values.articleWord}“{p.key === r.profile.key ? ` (${t.currentProfile})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <div><SubmitButton className="button button--quiet">{t.useProfileButton}</SubmitButton></div>
              </form>
            </details>
          )}
        </>
      )}
    </div>
    </AppShell>
  )
}
