/**
 * Členenie dokumentu na úseky — editor členenia, krok A (ADR-027, Ján 5. 10. 2026).
 *
 * Len na čítanie: uložené úseky platného znenia (z tých odpovedá asistent),
 * súhrn, upozornenia a rozbor textu analyzátorom. Nič sa tu nemení —
 * skúšobný rez s inými parametrami a uloženie ako pomenovaný profil je krok B,
 * analýza modelom krok C. Preindexovanie ostáva v detaile dokumentu.
 *
 * Vidí ho správca obsahu (`libraryContext`), ten istý, ktorý smie preindexovať.
 */

import { notFound, redirect } from "next/navigation"
import { libraryContext } from "@/lib/library"
import { inspectChunking, OVERSIZE_FACTOR, type ChunkWarning } from "@/lib/chunkingInspect"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary } from "@/lib/i18n"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

/** Koľko znakov z úseku ukázať v zbalenom riadku. */
const PREVIEW_CHARS = 180

export default async function ChunksPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const documentId = decodeURIComponent((await params).id)
  const r = await inspectChunking(ctx.tenant.companyCode, documentId)
  if (!r) notFound()

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

  // Rozbor: sedí profil, iné slovo, alebo nič (voľný text).
  const best = r.analysis?.suggestions[0]
  const analysisVerdict = !r.analysis ? null
    : !r.analysis.confident || !best?.articleWord ? t.analysisPlain
    : best.articleWord === r.profile.values.articleWord ? t.analysisFits(best.articleWord)
    : t.analysisOther(best.articleWord)

  return (
    <AppShell language={language} title={t.heading} trail={{ [`/library/${documentId}`]: r.title }}>
    <div className="chunks-page" style={{ maxWidth: 900, ...tenantStyle(branding) }}>
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

      {r.stored.length > 0 && (
        <>
          <h2 className="chunks-list-heading">{t.listHeading}</h2>
          {/* Natívne `<details>`: rozbalí sa bez JavaScriptu a prehliadač
              v zbalenom texte vie hľadať (rovnako ako reťaz dôkazov). */}
          <ol className="chunks-list">
            {r.stored.map(c => (
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
                      {c.tokens > limit && <> <span className="tag tag--expired">{t.oversizedTag}</span></>}
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
      )}
    </div>
    </AppShell>
  )
}
