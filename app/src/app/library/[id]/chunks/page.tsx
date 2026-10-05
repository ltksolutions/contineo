/**
 * Členenie dokumentu na úseky — editor členenia, krok A (ADR-027, Ján 5. 10. 2026).
 *
 * Uložené úseky platného znenia (z tých odpovedá asistent), súhrn,
 * upozornenia a rozbor textu analyzátorom (krok A). **Skúšobný rez** s inými
 * hodnotami je GET — nič neukladá, hodnoty sú v adrese; uloží sa až výber
 * profilu: existujúci, alebo nový pomenovaný z hodnôt skúšky (krok B, D79).
 * Analýza modelom je krok C. Preindexovanie ostáva v detaile dokumentu.
 *
 * Vidí ho správca obsahu (`libraryContext`), ten istý, ktorý smie preindexovať.
 */

import { notFound, redirect } from "next/navigation"
import { libraryContext } from "@/lib/library"
import { inspectChunking, OVERSIZE_FACTOR, type ChunkWarning, type InspectedChunk } from "@/lib/chunkingInspect"
import { clampChunking } from "@/lib/tenantAdmin"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import Notice from "@/components/Notice"
import { applyChunkingProfileAction, saveChunkingProfileAction } from "../../actions"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary } from "@/lib/i18n"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

/** Koľko znakov z úseku ukázať v zbalenom riadku. */
const PREVIEW_CHARS = 180

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
  const q = normalizeQuery<{
    msg?: string; error?: string; trial?: string
    articleWord?: string; annexWord?: string; minTokens?: string; maxTokens?: string
  }>(await searchParams)
  const base = await inspectChunking(ctx.tenant.companyCode, documentId)
  if (!base) notFound()
  // Skúška: hodnoty z adresy, orezané tak ako pri uložení profilu.
  const num = (v?: string) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined)
  const trialValues = q.trial === "1"
    ? clampChunking({
        ...base.profile.values,
        ...(q.articleWord !== undefined ? { articleWord: q.articleWord } : {}),
        ...(q.annexWord !== undefined ? { annexWord: q.annexWord } : {}),
        ...(num(q.minTokens) !== undefined ? { minTokens: num(q.minTokens) } : {}),
        ...(num(q.maxTokens) !== undefined ? { maxTokens: num(q.maxTokens) } : {}),
      })
    : null
  const r = trialValues ? (await inspectChunking(ctx.tenant.companyCode, documentId, trialValues))! : base
  const here = `/library/${encodeURIComponent(documentId)}/chunks`

  const language = ctx.person.language
  const t = dictionary(language).library.chunks
  const branding = brandingView(ctx.tenant)
  const limit = Math.round(r.profile.values.maxTokens * OVERSIZE_FACTOR)

  const warningText = (w: ChunkWarning) => {
    switch (w.code) {
      case "oneBlock": return t.warnings.oneBlock
      case "fewArticles": return t.warnings.fewArticles(w.percent)
      case "oversized": return t.warnings.oversized(w.count, w.limit)
      case "fragments": return t.warnings.fragments(w.count)
    }
  }

  // Zoznam úsekov — uložených, alebo po skúšobnom reze.
  // Natívne `<details>`: rozbalí sa bez JavaScriptu a prehliadač v zbalenom
  // texte vie hľadať (rovnako ako reťaz dôkazov).
  const chunkList = (heading: string, chunks: InspectedChunk[], max: number) => chunks.length > 0 && (
    <>
      <h2 className="chunks-list-heading">{heading}</h2>
      <ol className="chunks-list">
        {chunks.map(c => (
          <li key={c.chunkIndex}>
            <details className="card chunk-item">
              <summary>
                <span className="quiet chunk-no">{c.chunkIndex + 1}</span>
                <span className="chunk-head">
                  <strong>{c.articleRef ?? t.noArticle}</strong>
                  {c.heading && <span className="quiet"> · {c.heading}</span>}
                </span>
                <span className="quiet chunk-size">
                  {t.tokens(c.tokens)}
                  {c.tokens > max && <> <span className="tag tag--expired">{t.oversizedTag}</span></>}
                </span>
                <span className="quiet chunk-preview">
                  {c.text.slice(0, PREVIEW_CHARS)}{c.text.length > PREVIEW_CHARS ? "…" : ""}
                </span>
              </summary>
              <pre className="chunk-text">{c.text}</pre>
            </details>
          </li>
        ))}
      </ol>
    </>
  )

  // Rozbor: sedí profil, iné slovo, alebo nič (voľný text).
  const best = r.analysis?.suggestions[0]
  const analysisVerdict = !r.analysis ? null
    : !r.analysis.confident || !best?.articleWord ? t.analysisPlain
    : best.articleWord === r.profile.values.articleWord ? t.analysisFits(best.articleWord)
    : t.analysisOther(best.articleWord)

  return (
    <AppShell language={language} title={t.heading} trail={{ [`/library/${documentId}`]: r.title }}>
    <div className="chunks-page" style={{ maxWidth: 900, ...tenantStyle(branding) }}>
      <Notice message={q.msg} error={q.error === "1"} back={here} />
      <h1 className="page-title" style={{ margin: "0 0 4px" }}>{t.heading}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 18px", maxWidth: 680 }}>{t.intro}</p>

      <section className="card chunks-summary">
        <dl className="detail-meta" style={{ margin: 0 }}>
          <div className="detail-meta-row">
            <dt className="quiet detail-meta-key">{t.profile}</dt>
            <dd className="detail-meta-value">
              {r.profile.label} · {`„${r.profile.values.articleWord}“`} · {t.target(r.profile.values.minTokens, r.profile.values.maxTokens)}
            </dd>
          </div>
          {r.version && (
            <div className="detail-meta-row">
              <dt className="quiet detail-meta-key">{t.version}</dt>
              <dd className="detail-meta-value">{r.version.label}</dd>
            </div>
          )}
        </dl>

        {!r.version ? (
          <p className="quiet" style={{ margin: 0 }}>{t.noVersion}</p>
        ) : (
          <>
            <div className="chunks-stats">
              <div><span className="quiet">{t.statsCount}</span><strong>{r.stats.count}</strong></div>
              <div><span className="quiet">{t.statsArticles}</span><strong>{r.stats.withArticlePercent} %</strong></div>
              <div>
                <span className="quiet">{t.statsTokens}</span>
                <strong>{t.tokensRange(r.stats.tokensMin, r.stats.tokensAvg, r.stats.tokensMax)}</strong>
              </div>
            </div>
            {r.today && (
              r.today.outdated ? (
                <div className="lnote lnote--warn">
                  <span className="lnote-mark" aria-hidden="true">!</span>
                  <span className="lnote-text">
                    {t.outdated(r.stats.count, r.today.count)} {t.reindexHint}
                  </span>
                </div>
              ) : (
                <p className="quiet" style={{ margin: 0 }}>{t.upToDate}</p>
              )
            )}
          </>
        )}
      </section>

      {r.version && (
        <section className="card chunks-block">
          <h2>{t.warningsHeading}</h2>
          {r.warnings.length === 0 ? (
            <p className="quiet" style={{ margin: 0 }}>{t.noWarnings}</p>
          ) : (
            <ul className="chunks-warnings">
              {r.warnings.map(w => <li key={w.code}>{warningText(w)}</li>)}
            </ul>
          )}
        </section>
      )}

      {r.analysis && (
        <section className="card chunks-block">
          <h2>{t.analysisHeading}</h2>
          <p style={{ margin: 0 }}>{analysisVerdict}</p>
          <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-small)" }}>
            {t.analysisFound(
              r.analysis.signals.lines, r.analysis.signals.articleWord, r.analysis.signals.paragraphSign,
              r.analysis.signals.pointWord, r.analysis.signals.markdownHeadings,
            )}
          </p>
        </section>
      )}

      {/* Skúšobný rez — GET, nič sa neukladá; hodnoty sú v adrese. */}
      {r.analysis && (
        <form action={here} method="get" className="card chunks-block">
          <input type="hidden" name="trial" value="1" />
          <h2>{t.trialHeading}</h2>
          <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-small)" }}>{t.trialIntro}</p>
          <div className="chunks-fields">
            <label className="field">
              <span className="field-label">{t.fieldArticleWord}</span>
              <input className="field-input" name="articleWord" defaultValue={(r.trial?.values ?? r.profile.values).articleWord} />
              <span className="quiet field-hint">{t.fieldArticleWordHint}</span>
            </label>
            <label className="field">
              <span className="field-label">{t.fieldAnnexWord}</span>
              <input className="field-input" name="annexWord" defaultValue={(r.trial?.values ?? r.profile.values).annexWord} />
            </label>
            <label className="field">
              <span className="field-label">{t.fieldMinTokens}</span>
              <input className="field-input" type="number" name="minTokens" min={50} max={2000} inputMode="numeric"
                     defaultValue={(r.trial?.values ?? r.profile.values).minTokens} />
            </label>
            <label className="field">
              <span className="field-label">{t.fieldMaxTokens}</span>
              <input className="field-input" type="number" name="maxTokens" min={100} max={4000} inputMode="numeric"
                     defaultValue={(r.trial?.values ?? r.profile.values).maxTokens} />
            </label>
          </div>
          <div className="chunks-actions">
            <button className="button button--quiet" type="submit">{t.trialShow}</button>
            {r.trial && <a href={here}>{t.trialReset}</a>}
          </div>
        </form>
      )}

      {r.trial && (
        <section className="card chunks-block">
          <h2>{t.compareHeading}</h2>
          <table className="chunks-compare">
            <thead><tr><th /><th>{t.compareNow}</th><th>{t.compareTrial}</th></tr></thead>
            <tbody>
              <tr><th scope="row">{t.statsCount}</th><td>{r.stats.count}</td><td>{r.trial.stats.count}</td></tr>
              <tr><th scope="row">{t.statsArticles}</th><td>{r.stats.withArticlePercent} %</td><td>{r.trial.stats.withArticlePercent} %</td></tr>
              <tr><th scope="row">{t.compareMax}</th><td>{r.stats.tokensMax}</td><td>{r.trial.stats.tokensMax}</td></tr>
            </tbody>
          </table>
          {r.trial.warnings.length > 0 && (
            <ul className="chunks-warnings">
              {r.trial.warnings.map(w => <li key={w.code}>{warningText(w)}</li>)}
            </ul>
          )}
          {r.trial.matchesProfile && (
            <p className="quiet" style={{ margin: 0 }}>
              {t.trialMatches(r.profiles.find(p => p.key === r.trial!.matchesProfile)?.label ?? r.trial.matchesProfile)}
            </p>
          )}
        </section>
      )}

      {/* Profil pre dokument (D79): existujúci, alebo nový pomenovaný z hodnôt skúšky. */}
      <section className="card chunks-block">
        <h2>{t.saveHeading}</h2>
        <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-small)" }}>{t.saveIntro}</p>
        {r.profiles.length > 1 && (
          <form action={applyChunkingProfileAction} className="chunks-row">
            <input type="hidden" name="documentId" value={documentId} />
            <label className="field">
              <span className="field-label">{t.useProfile}</span>
              <select className="field-input" name="profileKey" defaultValue={r.trial?.matchesProfile ?? r.profile.key}>
                {r.profiles.map(p => (
                  <option key={p.key} value={p.key}>
                    {p.label} · „{p.values.articleWord}“{p.key === r.profile.key ? ` (${t.currentProfile})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div><button className="button button--quiet" type="submit">{t.useProfileButton}</button></div>
          </form>
        )}
        {r.trial && !r.trial.matchesProfile && (
          <form action={saveChunkingProfileAction} className="chunks-row">
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="articleWord" value={r.trial.values.articleWord} />
            <input type="hidden" name="annexWord" value={r.trial.values.annexWord} />
            <input type="hidden" name="headerRepeats" value={r.trial.values.headerRepeats} />
            <input type="hidden" name="minTokens" value={r.trial.values.minTokens} />
            <input type="hidden" name="maxTokens" value={r.trial.values.maxTokens} />
            <label className="field">
              <span className="field-label">{t.newProfile}</span>
              <input className="field-input" name="label" required maxLength={60} placeholder={t.newProfileLabel} aria-label={t.newProfileLabel} />
              <span className="quiet field-hint">{t.newProfileHint}</span>
            </label>
            <div><button className="button" type="submit">{t.newProfileButton}</button></div>
          </form>
        )}
      </section>

      {r.trial
        ? chunkList(t.trialListHeading, r.trial.chunks, Math.round(r.trial.values.maxTokens * OVERSIZE_FACTOR))
        : chunkList(t.listHeading, r.stored, limit)}
    </div>
    </AppShell>
  )
}
