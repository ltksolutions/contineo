/**
 * Nová správa jednej osobe (ADR-033, D204 — 1:1 smie ktokoľvek).
 *
 * Adresát sa vyberá z osôb organizácie; externé osoby z okna pomoci sa
 * neponúkajú (ich cesta je ticket) a vyradené tiež nie. Formulár je obyčajný
 * `POST` — pri chybe sa vráti aj s tým, čo človek napísal.
 *
 * Hromadná správa oddeleniu či skupine (len role, s náhľadom) pribudne na
 * tejto adrese ako druhá voľba, nie ako iná stránka.
 */

import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import PeopleSearch from "@/components/PeopleSearch"
import SubmitButton from "@/components/SubmitButton"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { listPeople } from "@/lib/people"
import { sortPeopleBySurname } from "@/lib/assignOrder"
import Link from "next/link"
import { SUBJECT_MAX, TEXT_MAX, canAnnounce } from "@/lib/courier"
import { dictionary } from "@/lib/i18n"
import { sendDirectAction } from "../actions"

export const dynamic = "force-dynamic"

export default async function NewMessagePage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()

  const q = normalizeQuery<{ error?: string; to?: string; subject?: string; text?: string }>(await searchParams)
  const language = ctx.person.language
  const d = dictionary(language)
  const t = d.courier
  const branding = brandingView(ctx.tenant)

  const people = await listPeople(ctx.person.companyCode)
  const choices = sortPeopleBySurname(
    people.filter(p => p.status !== "inactive" && p.personType !== "external" && p.id !== ctx.person.id),
  ).map(p => ({ id: p.id, fullName: p.fullName, email: p.email, department: p.department }))

  return (
    <AppShell language={language} title={t.newTitle} trail={{ "/courier": t.title }}>
      <div style={{ maxWidth: 820, ...tenantStyle(branding) }}>
        <Notice language={language} message={q.error} error back="/courier/new" />

        <div className="page-head">
          <h1 className="page-title">{t.newTitle}</h1>
          <span className="page-head-spacer" aria-hidden="true" />
          {/* Oznam skupine len pre role (D204) — tichý odkaz, plné je Odoslať dole. */}
          {canAnnounce(ctx.person) && <Link className="button button--quiet" href="/courier/announce">{t.modeAnnounce}</Link>}
        </div>

        <form action={sendDirectAction} className="card" style={{ padding: "18px 20px", display: "grid", gap: 16 }}>
          <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <legend className="field-label" style={{ padding: 0, marginBottom: 6 }}>{t.to}</legend>
            <PeopleSearch
              people={choices}
              name="to"
              language={language}
              required
              defaultSelected={q.to ? [q.to] : []}
              listLabel={t.toList}
              missing="people"
            />
          </fieldset>

          <label className="field">
            <span className="field-label">{t.subject}</span>
            <input className="field-input" name="subject" required maxLength={SUBJECT_MAX} defaultValue={q.subject ?? ""} autoComplete="off" />
          </label>

          <label className="field">
            <span className="field-label">{t.text}</span>
            <textarea className="field-input" name="text" required rows={10} maxLength={TEXT_MAX} defaultValue={q.text ?? ""} style={{ resize: "vertical", lineHeight: 1.5 }} />
            <span className="quiet field-hint">{t.textHint}</span>
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <SubmitButton className="button" pendingLabel={d.common.pending.sending}>{t.send}</SubmitButton>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
