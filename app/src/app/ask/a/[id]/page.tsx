/**
 * /ask/a/{id} — uložená odpoveď (ASK-historia-otazok).
 *
 * Tá istá odpoveď, aká vtedy prišla — rozloženie ako živá (dva stĺpce pri
 * citáciách), ale **bez značiek `[n]`**: poloha citácií v texte sa neukladá
 * (ASK-odpoved-dva-stlpce, Q1). Nad ňou pás s dátumom, a keď má citovaný
 * dokument odvtedy iné platné znenie, pás ho pomenuje. „Opýtať sa znova"
 * spustí nový beh.
 *
 * Sem prepne adresu aj živý beh po dobehnutí (H4) — obnovenie stránky tak
 * beh nespúšťa znova a odkaz sa dá poslať. Otvorí ju ten, kto sa pýtal,
 * a rola s prístupom k hodnoteniu; inak 404 (H3, D32).
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import AppShell from "@/components/AppShell"
import { AnswerBody, AnswerAside, type AnswerState } from "@/components/Answer"
import { answerHasCitations } from "@/lib/answerCitations"
import { answerForViewer } from "@/lib/askHistory"
import { evaluationContext } from "@/lib/evaluation"
import { loadDocument } from "@/lib/documents"
import { newerVersions } from "@/lib/savedAnswer"
import { brandingView } from "@/lib/tenants"
import { SEARCH_TIME_ZONE } from "@/lib/versionContext"
import { dictionary, formatDate } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function SavedAnswerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()

  const canEvaluate = (await evaluationContext()).state === "ready"
  const record = await answerForViewer(ctx.tenant.companyCode, decodeURIComponent(id), ctx.person.id, canEvaluate)
  if (!record) notFound()

  const language = ctx.person.language
  const t = dictionary(language).ask
  const branding = brandingView(ctx.tenant)
  const short = branding.shortName?.trim() || branding.displayName

  const documentIds = [...new Set(record.sources.map(s => s.documentId).filter((d): d is string => Boolean(d)))]
  const docs = (await Promise.all(documentIds.map(d => loadDocument(ctx.tenant.companyCode, d)))).filter(d => d !== null)
  const newer = newerVersions(record.sources, docs)

  /*
   * „Podľa znení platných dnes" by pri odpovedi spred týždňa klamalo — „dnes"
   * bol deň otázky. Uložená odpoveď preto hovorí „k {deň}".
   */
  const time = record.time?.kind === "today" ? { ...record.time, kind: "asOf" as const } : record.time
  const state: AnswerState = {
    question: record.question,
    text: record.answer,
    // Bez `at` — značky v texte sa nekreslia, citácie áno.
    citations: record.citations.map(c => ({ ...c, at: undefined })),
    running: false,
    time,
    done: {
      text: record.answer,
      citations: record.citations,
      sources: record.sources,
      model: record.model,
      provider: record.provider,
      verifiedCitations: record.verifiedCitations,
      ttftMs: record.ttftMs,
      totalMs: record.totalMs,
      timings: record.timings,
      tokens: record.tokens,
      cost: record.cost,
      time,
    },
  }
  const split = answerHasCitations(state)
  const when = record.createdAt.toLocaleString(language, {
    timeZone: SEARCH_TIME_ZONE, day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  })

  return (
    <AppShell language={language} title={record.question}>
      <div className="ask-page">
        <div className={split ? "ask-layout is-split" : "ask-layout"}>
          <div className="ask-main">
            <div className="saved-banner" role="note">
              <div className="saved-banner-text">
                <span>{t.saved.banner(when)}</span>
                {newer.map(n => (
                  <span key={n.documentId}>{t.saved.newVersion(n.title, n.label, formatDate(n.effectiveFrom, language))}</span>
                ))}
              </div>
              <Link className="button button--quiet saved-banner-again" href={`/ask?q=${encodeURIComponent(record.question)}`}>
                {t.saved.askAgain}
              </Link>
            </div>
            <div className="ask-asked">
              <h1 className="ask-asked-title">{record.question}</h1>
            </div>
            <AnswerBody state={state} organisation={short} language={language} />
          </div>
          <aside className="ask-aside">
            <AnswerAside state={state} canEvaluate={canEvaluate} language={language} />
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
