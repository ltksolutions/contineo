/**
 * Obrazovka schvaľovateľa — čo čaká na moje rozhodnutie (ADR-006, krok 4).
 * Podoba podľa rámu `docs/design/APPROVALS-pdf-konceptu.md` (24. 9. 2026):
 * karta v troch pásoch — hlavička, čo schvaľuješ, rozhodnutie.
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
import MetaFacts from "@/components/MetaFacts"
import { initials } from "@/lib/initials"
import { listPeople } from "@/lib/people"
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
      { projection: { documentId: 1, title: 1, versions: 1, draftMarkdown: 1, draftPdf: 1, draftMeta: 1, draftTitle: 1 } },
    )
    .toArray()

  const byId = new Map(docs.map(d => [String(d.documentId), d]))
  // Kolo nesie adresu predkladateľa; na obrazovku patrí meno.
  const people = rounds.length === 0 ? [] : await listPeople(person.companyCode)
  const nameOf = (email: string) => people.find(p => p.email.toLowerCase() === email.toLowerCase())?.fullName ?? email

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

        <ul className="ap-list">
          {rounds.map(r => {
            const doc = byId.get(r.documentId) as
              { title?: unknown; versions?: Version[]; draftMarkdown?: unknown; draftPdf?: VersionFile | null; draftMeta?: Record<string, unknown> | null; draftTitle?: string | null } | undefined
            const version = (doc?.versions ?? []).find(v => v.versionId === r.versionId)
            const shown = approvalText(doc, r.versionId, text =>
              documentDraftIdentity({ draftMarkdown: text, draftPdf: doc?.draftPdf, draftMeta: doc?.draftMeta, draftTitle: doc?.draftTitle }))
            // PDF k tomu istému, čo je v texte: koncept → PDF konceptu,
            // zverejnené znenie → jeho PDF (ADR-011). Znenia spred ADR-011 ho nemajú.
            const encodedId = encodeURIComponent(r.documentId)
            const pdf = shown.kind === "draft" && doc?.draftPdf
              ? { file: doc.draftPdf, href: `/api/documents/${encodedId}/pdf?draft=1` }
              : shown.kind === "version" && version?.pdf
                ? { file: version.pdf, href: `/api/documents/${encodedId}/pdf?version=${encodeURIComponent(r.versionId)}` }
                : null
            const others = r.approvers.filter(a => a.email !== person.email)

            const changed = shown.kind === "changed"
            const hasCurrent = (doc?.versions ?? []).some(v => v.isActive && v.effectiveFrom)
            const draftMeta = shown.kind === "draft" && doc?.draftMeta ? normalizeMeta(doc.draftMeta) : null
            const versionMeta = version ? normalizeMeta({
              author: version.author, approvedBy: version.approvedBy,
              approvedOn: version.approvedOn, effectiveFrom: version.effectiveFrom,
            }) : null
            const meta = draftMeta ?? versionMeta
            /*
              Štítok znenia (rám, Q1). Koncept označenie ešte nemá — dovtedy
              sa tu ukazovalo technické `versionId`. Teraz ten istý názov ako
              karta na detaile: „Nové znenie od …" / „Prvé znenie od …".
            */
            const draftFrom = draftMeta?.effectiveFrom ? formatDate(draftMeta.effectiveFrom, person.language) : ""
            const label = version?.label
              ?? (!draftFrom ? t.draftVersion : hasCurrent ? t.newVersionFrom(draftFrom) : t.firstVersionFrom(draftFrom))
            // Nový názov z prípravy sa schvaľuje spolu so znením (ADR-015, D112).
            const title = shown.kind === "draft" && doc?.draftTitle ? doc.draftTitle : String(doc?.title ?? r.documentId)
            const kicker = t.kicker(r.round, nameOf(r.submittedBy), formatDate(r.submittedAt, person.language))

            const body = (
              <div className="ap-body">
                {/* Zmenený koncept: upozornenie hore, „Schváliť" ostáva aktívne
                    (rám, Q3 = nie). Schválenie sa týka podoby z predloženia. */}
                {changed && <p className="ap-warn">{t.draftChanged}</p>}

                {/*
                  Schvaľuje sa **PDF aj text** (ADR-011, D96) a údaje o znení
                  (D107) — jedným rozhodnutím. PDF hore, text zbalený pod ním.
                */}
                {!changed && (
                  <section className="ap-sec">
                    <h3 className="ap-sec-h">{t.whatYouApprove}<span>{t.whatYouApproveNote}</span></h3>
                    {pdf && (
                      <PdfView href={pdf.href} name={pdf.file.name} bytes={pdf.file.bytes} labels={{ open: t.openPdf }} />
                    )}
                    {pdf && "text" in shown ? (
                      <details className="approval-search-text">
                        <summary>{t.searchTextNote}</summary>
                        <article className="answer approval-text">
                          <FormattedText text={shown.text} />
                        </article>
                      </details>
                    ) : (
                      <article className="answer approval-text">
                        {"text" in shown ? <FormattedText text={shown.text} /> : t.noText}
                      </article>
                    )}
                  </section>
                )}

                {meta ? (
                  <section className="ap-sec">
                    <h3 className="ap-sec-h">{t.metaHeading}<span>{t.metaNote}</span></h3>
                    <div className="ap-box"><MetaFacts meta={meta} language={person.language} omitEmpty /></div>
                  </section>
                ) : (
                  <div className="approval-meta">{t.noEffectiveFrom}</div>
                )}

                {r.note && (
                  <section className="ap-sec">
                    <h3 className="ap-sec-h">{t.noteFrom}</h3>
                    <p className="ap-box ap-note">{r.note}</p>
                  </section>
                )}

                {/*
                  Ostatní schvaľovatelia bez ich rozhodnutí — kolo je súbežné
                  (D70) a každý rozhoduje sám. Zoznam hovorí, kto ešte musí
                  rozhodnúť, nie ako rozhodla väčšina.
                */}
                {others.length > 0 && (
                  <section className="ap-sec">
                    <h3 className="ap-sec-h">{t.alsoDecidingHeading}</h3>
                    <div className="ap-chips">
                      {others.map(a => (
                        <span key={a.email} className="ap-chip">
                          <span className="flow-av" aria-hidden="true">{initials(a.fullName, a.email)}</span>
                          {a.fullName}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )

            /*
              Dve tlačidlá v jednom formulári, nie dva formuláre: dôvod je
              jedno pole a pri zamietnutí je povinný. Povinnosť dôvodu stráži
              server (D71) — bez JavaScriptu ju formulár vynútiť nevie, keď sa
              dá odoslať dvoma rôznymi tlačidlami. Päta so sivým pozadím
              oddeľuje rozhodnutie od čítania (rám, bod 6).
            */
            const decide = (
              <form action={decideAction} className="ap-decide">
                <input type="hidden" name="documentId" value={r.documentId} />
                <input type="hidden" name="versionId" value={r.versionId} />
                <input type="hidden" name="round" value={r.round} />

                <label className="field">
                  <span className="field-label">{t.reason}</span>
                  <textarea className="field-input" name="reason" rows={2} placeholder={t.reasonPlaceholder} />
                  <span className="quiet field-hint">{t.reasonHint}</span>
                </label>

                <div className="ap-btns">
                  <button className="button" type="submit" name="decision" value="approved">
                    {t.approve}
                  </button>
                  <button className="button button--quiet" type="submit" name="decision" value="rejected">
                    {t.reject}
                  </button>
                </div>
              </form>
            )

            const kick = (
              <div className="ap-kicker">
                <span className="tag">{label}</span>
                <span>{kicker}</span>
              </div>
            )

            /*
              Jedno kolo: karta rozbalená. Schvaľuje sa text (D68), ktorý sa
              doslova ocitne v potvrdzovacej formulke (D28) — skryť ho za klik
              by bolo ako pýtať si podpis na zatvorenej obálke. Dve a viac:
              každé kolo je riadok s „Prečítať a rozhodnúť" (rám, Q2), klik
              rozbalí tú istú kartu.
            */
            return (
              <li key={`${r.documentId}-${r.versionId}-${r.round}`} className="card ap-card">
                {rounds.length === 1 ? (
                  <>
                    <div className="ap-head">
                      {kick}
                      <h2 className="ap-title">{title}</h2>
                    </div>
                    {body}
                    {decide}
                  </>
                ) : (
                  <details className="ap-fold">
                    <summary className="ap-row">
                      <span className="ap-row-main">
                        {kick}
                        <span className="ap-title">{title}</span>
                      </span>
                      <span className="button button--quiet ap-open">{t.readAndDecide}</span>
                    </summary>
                    {body}
                    {decide}
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </AppShell>
  )
}
