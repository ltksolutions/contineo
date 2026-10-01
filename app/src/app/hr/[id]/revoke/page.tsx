/**
 * Potvrdenie odvolania pridelenia.
 *
 * Do 30. 9. 2026 odvolávalo tlačidlo v zozname jedným kliknutím. Odvolaná
 * karta zmizla, ďalšie sa posunuli nahor a druhé kliknutie na to isté miesto
 * odvolalo **iné** pridelenie — naostro dvakrát za sebou. Odvolanie sa nedá
 * vrátiť (D24: záznam sa nemení, len prestane platiť), preto má pred sebou
 * túto stránku: ktoré pridelenie, komu zmizne úloha, čo zostane — a až potom
 * tlačidlo. Ten istý vzor ako náhľad pred rozposlaním e-mailu (`notify`).
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { hrContext } from "@/lib/hr"
import { loadAssignment, notAcknowledged, audienceMembers, audienceLabel } from "@/lib/assignments"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, dictionary } from "@/lib/i18n"
import { loadDocument, effectiveVersion } from "@/lib/documents"
import { revokeAction } from "../../actions"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

export default async function RevokeAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await hrContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const { id } = await params
  const code = ctx.person.companyCode
  const assignment = await loadAssignment(code, id)
  if (!assignment) notFound()

  const language = ctx.person.language
  const t = dictionary(language).hr.revokeAssignment

  // Počty rovnakým pravidlom ako zoznam a e-mail: členovia publika dnes,
  // bývalí členovia oddelenia (D50) sa do „zmizne úloha" nerátajú — tí ju
  // na obrazovke aj tak nemajú.
  const [members, unacknowledged] = assignment.revokedAt
    ? [[], []]
    : await Promise.all([
        audienceMembers(code, assignment.audience),
        notAcknowledged(code, id).then(list => list.filter(o => !o.former)),
      ])
  const acknowledged = Math.max(0, members.length - unacknowledged.length)

  /*
    Pridelenie staršieho znenia (1. 10. 2026, Skúšobná smernica 1.0 pri
    platnom 1.2). Také znenie sa potvrdiť nedá, `pending.ts` ho ráta medzi
    zablokované — „zmizne úloha" by teda nebola pravda. Výkaz HR ho však
    ukazuje ako nepotvrdené navždy, a práve to odvolanie rieši.
  */
  const doc = assignment.revokedAt ? null : await loadDocument(code, assignment.subject.documentId)
  const effective = doc ? effectiveVersion(doc) : null
  const superseded = effective?.ok && effective.version.versionId !== assignment.subject.versionId
    ? effective.version.label
    : null

  return (
    <AppShell language={language} title={t.heading} trail={{ [`/hr/${id}`]: assignment.subject.documentTitle }}>
    <div style={{ maxWidth: 720, ...tenantStyle(brandingView(ctx.tenant)) }}>
      <h1 className="page-title">{t.heading}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 20px", maxWidth: 600 }}>{t.lead}</p>

      <section className="card" style={{ padding: "18px 20px", margin: "0 0 22px" }}>
        <div style={{ fontSize: "var(--fs-section)", fontWeight: 700 }}>{assignment.subject.documentTitle}</div>
        <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "6px 0 0" }}>
          {assignment.subject.versionLabel} · {audienceLabel(assignment.audience)} · {assignment.assignedBy} ·{" "}
          {formatDate(assignment.assignedAt, language)}
        </p>
        <p style={{ fontSize: "var(--fs-body)", margin: "10px 0 0", lineHeight: 1.55 }}>{assignment.reason}</p>
      </section>

      {assignment.revokedAt ? (
        <p className="card" style={{ padding: "12px 16px", fontSize: "var(--fs-body)" }}>
          {t.alreadyRevoked}{" "}
          <Link href="/hr">{t.cancel}</Link>
        </p>
      ) : (
        <>
          <h2 style={{ fontSize: "var(--fs-section)", margin: "0 0 10px" }}>{t.whatHappensHeading}</h2>
          <ul className="revoke-effects">
            <li>
              {superseded
                ? t.versionSuperseded(assignment.subject.versionLabel, superseded, unacknowledged.length)
                : unacknowledged.length > 0 ? t.tasksDisappear(unacknowledged.length) : t.nobodyLoses}
            </li>
            <li>{t.acknowledgementsStay(acknowledged)}</li>
            <li>{t.recordStays}</li>
            <li>{t.reassign}</li>
          </ul>

          <form action={revokeAction} className="revoke-form">
            <input type="hidden" name="id" value={id} />
            <label className="field-label" htmlFor="revoke-reason">{t.reasonLabel}</label>
            <textarea id="revoke-reason" name="reason" className="field-input" rows={3} maxLength={500} />
            <p className="quiet field-hint" style={{ margin: 0 }}>{t.reasonHint}</p>
            <div className="revoke-actions">
              <button className="button button--danger" type="submit">{t.confirm}</button>
              <Link className="button button--quiet" href="/hr">{t.cancel}</Link>
            </div>
          </form>
        </>
      )}
    </div>
    </AppShell>
  )
}
