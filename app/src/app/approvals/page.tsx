/**
 * Obrazovka schvaľovateľa — čo čaká na moje rozhodnutie (ADR-006, krok 4).
 *
 * **Prečo vlastná obrazovka a nie detail dokumentu**, ako predpokladalo ADR:
 * schvaľovatelia sú **menovaní ľudia** (D69), nie držitelia roly. Kolegyňa
 * z právneho útvaru nemá rolu `content-admin`, takže sa do knižnice
 * nedostane — a keby sme jej ju kvôli schvaľovaniu dali, mohla by odvtedy
 * nahrávať a publikovať normy. Rozhodovanie preto býva tam, kam sa dostane
 * každý prihlásený, a stránka sama ukáže len to, na čom je menovaný.
 *
 * Znenie sa ukazuje **celé a priamo tu**. Schvaľuje sa text (D68) a je to
 * text, ktorý sa doslova ocitne v potvrdzovacej formulke (D28) — odkázať
 * schvaľovateľa na „platné znenie" inde by znamenalo, že schvaľuje niečo iné,
 * než číta: schvaľované znenie účinné ešte nie je a byť nemusí (D73).
 */

import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import FormattedText from "@/components/FormattedText"
import PdfView from "@/components/PdfView"
import { normalizeLayout } from "@/lib/appNav"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"
import { roundsWaitingFor } from "@/lib/approvalsDb"
import { approvalText } from "@/lib/approvals"
import { documentDraftIdentity, normalizeMeta } from "@/lib/versionMeta"
import VersionMetaLine from "@/components/VersionMetaLine"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION, type Version, type VersionFile } from "@/lib/documents"
import { decideAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const q = normalizeQuery<{ layout?: string; msg?: string; error?: string }>(await searchParams)
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state === "not-in-tenant") notFound()

  const person = ctx.person
  const branding = brandingView(ctx.tenant)
  const t = dictionary(person.language).approvals
  const rounds = await roundsWaitingFor(person.companyCode, person.email)

  /*
    Názvy dokumentov a znenia jedným dotazom. Pri kole sa ukladá `documentId`
    a `versionId`, nie názov: názov je vec dokumentu a mení sa, kým kolo je
    záznam o rozhodovaní. Odtlačok mena schvaľovateľa je iná vec — ten
    v zázname byť musí (D24), lebo bez neho sa nedá povedať, kto rozhodol.
  */
  const ids = [...new Set(rounds.map(r => r.documentId))]
  const docs = ids.length === 0 ? [] : await (await getCollection(DOCUMENTS_COLLECTION))
    .find(
      { companyCode: person.companyCode, documentId: { $in: ids } },
      { projection: { documentId: 1, title: 1, versions: 1, draftMarkdown: 1, draftPdf: 1, draftMeta: 1 } },
    )
    .toArray()

  const byId = new Map(docs.map(d => [String(d.documentId), d]))

  return (
    <AppShell layout={normalizeLayout(q.layout)} language={person.language}>
      <div className="approval-page" style={tenantStyle(branding)}>
        <Notice message={q.msg} error={q.error === "1"} back="/approvals" />

        <h1 className="page-title">{t.heading}</h1>
        <p className="quiet page-lead">{t.intro}</p>

        {/* `.empty` zo ZAKLADU, bez akcie (APPROVALS, úloha 3): schvaľovateľ
            si prácu nevie nájsť sám — musí ho niekto určiť. */}
        {rounds.length === 0 && (
          <div className="empty">
            <div className="empty-title">{t.emptyTitle}</div>
            <div className="empty-text">{t.emptyText}</div>
          </div>
        )}

        <ul className="approval-list">
          {rounds.map(r => {
            const doc = byId.get(r.documentId) as
              { title?: unknown; versions?: Version[]; draftMarkdown?: unknown; draftPdf?: VersionFile | null; draftMeta?: Record<string, unknown> | null } | undefined
            const version = (doc?.versions ?? []).find(v => v.versionId === r.versionId)
            const shown = approvalText(doc, r.versionId, text =>
              documentDraftIdentity({ draftMarkdown: text, draftPdf: doc?.draftPdf, draftMeta: doc?.draftMeta }))
            // PDF k tomu istému, čo je v texte: koncept → PDF konceptu,
            // zverejnené znenie → jeho PDF (ADR-011). Znenia spred ADR-011 ho nemajú.
            const encodedId = encodeURIComponent(r.documentId)
            const pdf = shown.kind === "draft" && doc?.draftPdf
              ? { file: doc.draftPdf, href: `/api/documents/${encodedId}/pdf?draft=1` }
              : shown.kind === "version" && version?.pdf
                ? { file: version.pdf, href: `/api/documents/${encodedId}/pdf?version=${encodeURIComponent(r.versionId)}` }
                : null
            const others = r.approvers.filter(a => a.email !== person.email)

            return (
              <li key={`${r.documentId}-${r.versionId}-${r.round}`} className="card approval-card">
                <h2 className="approval-title">{String(doc?.title ?? r.documentId)}</h2>
                <div className="approval-meta">
                  {t.versionLine(version?.label ?? r.versionId, t.roundLine(r.round))}
                  {" · "}
                  {t.submittedBy(r.submittedBy, formatDate(r.submittedAt, person.language))}
                </div>

                {/*
                  Údaje o znení (ADR-013) sú **súčasťou schvaľovaného** — pri
                  koncepte z konceptu, pri zverejnenom znení zo znenia.
                */}
                {shown.kind === "draft" && doc?.draftMeta ? (
                  <VersionMetaLine {...normalizeMeta(doc.draftMeta)} language={person.language} />
                ) : (
                  <>
                    <div className="approval-meta">
                      {version?.effectiveFrom
                        ? t.effectiveFrom(formatDate(version.effectiveFrom, person.language))
                        : t.noEffectiveFrom}
                    </div>
                    {version && (
                      <VersionMetaLine author={version.author} approvedBy={version.approvedBy}
                                       approvedOn={version.approvedOn} language={person.language} />
                    )}
                  </>
                )}

                {r.note && <p className="approval-card-note">{r.note}</p>}

                {/*
                  Ostatní schvaľovatelia sú vidieť, ale ich rozhodnutie sa
                  neukazuje ako odporúčanie — kolo je súbežné (D70) a každý
                  rozhoduje sám. Zoznam je tu preto, aby bolo jasné, kto ešte
                  bude musieť rozhodnúť, nie aby sa človek pridal k väčšine.
                */}
                {others.length > 0 && (
                  <div className="approval-meta approval-others">
                    {t.alsoDeciding(others.map(a => a.fullName).join(", "))}
                  </div>
                )}

                {/*
                  Rozbalené pri jednom kole, zbalené pri dvoch a viac
                  (APPROVALS, úloha 1). Schvaľuje sa text (D68), ktorý sa
                  doslova ocitne v potvrdzovacej formulke (D28) — pri jednom
                  kole je skryť ho za klik ako pýtať si podpis na zatvorenej
                  obálke. Tri plné znenia pod sebou sa naopak nedajú čítať.
                */}
                <details className="approval-read" open={rounds.length === 1}>
                  <summary>{t.readText}</summary>
                  {/*
                    Schvaľuje sa **PDF aj text** (ADR-011, D96): PDF je predpis,
                    ako ho ľudia uvidia, text je to, z čoho systém odpovedá.
                    PDF hore, text zbalený pod ním — ten si väčšina prečíta
                    len vtedy, keď chce vedieť, čo bude vyhľadávanie hovoriť.
                  */}
                  {pdf && (
                    <PdfView href={pdf.href} name={pdf.file.name} bytes={pdf.file.bytes} labels={{ open: t.openPdf }} />
                  )}
                  {pdf && "text" in shown ? (
                    <details className="approval-search-text">
                      <summary>{t.searchText}</summary>
                      <article className="answer approval-text">
                        <FormattedText text={shown.text} />
                      </article>
                    </details>
                  ) : (
                    <article className="answer approval-text">
                      {"text" in shown
                        ? <FormattedText text={shown.text} />
                        : shown.kind === "changed" ? t.draftChanged : t.noText}
                    </article>
                  )}
                </details>

                {/*
                  Dve tlačidlá v jednom formulári, nie dva formuláre: dôvod je
                  jedno pole a pri zamietnutí je povinný. Dva formuláre by
                  znamenali dve polia na dôvod a človek by vypĺňal to druhé.
                  Povinnosť dôvodu pri zamietnutí stráži server (D71) — bez
                  JavaScriptu ju formulár vynútiť nevie, keď sa dá odoslať
                  dvoma rôznymi tlačidlami.
                */}
                <form action={decideAction} className="approval-form">
                  <input type="hidden" name="documentId" value={r.documentId} />
                  <input type="hidden" name="versionId" value={r.versionId} />
                  <input type="hidden" name="round" value={r.round} />

                  <label className="field">
                    <span className="field-label">{t.reason}</span>
                    {/* Dva riadky, nie jeden (APPROVALS, úloha 2): pri zamietnutí
                        sem človek píše vetu-dve a musí si ich vedieť prečítať. */}
                    <textarea className="field-input" name="reason" rows={2} placeholder={t.reasonPlaceholder} />
                    <span className="quiet field-hint">{t.reasonHint}</span>
                  </label>

                  <div className="approval-decide">
                    <button className="button" type="submit" name="decision" value="approved">
                      {t.approve}
                    </button>
                    <button className="button button--quiet" type="submit" name="decision" value="rejected">
                      {t.reject}
                    </button>
                  </div>
                </form>
              </li>
            )
          })}
        </ul>
      </div>
    </AppShell>
  )
}
