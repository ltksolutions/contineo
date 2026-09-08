/**
 * Pozvanie jednej osoby.
 *
 * **Nič sa neodosiela.** Pozvanie je zápis do `persons`, nie e-mail: človek sa
 * prihlási vtedy, keď si sám vyžiada odkaz alebo klikne na pracovné konto.
 * Posielať mu odkaz dopredu by znamenalo, že vyprší skôr, než ho otvorí.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { peopleContext } from "@/lib/people"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { UI_LANGUAGES, dictionary } from "@/lib/i18n"
import Select from "@/components/Select"
import { invitePersonAction } from "../actions"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

export default async function NewPersonPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const q = normalizeQuery<{ error?: string; email?: string; fullName?: string; department?: string }>(await searchParams)
  const branding = brandingView(ctx.tenant)
  const d = dictionary(ctx.person.language).people
  const t = d.invite

  return (
    <AppShell language={ctx.person.language}>
    <div style={{ maxWidth: 560, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="quiet" href="/people" style={{ fontSize: 14 }}>{t.back}</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{t.heading}</h1>
      <p className="quiet" style={{ fontSize: 15, margin: "0 0 20px" }}>
        {t.introBefore}<strong>{ctx.tenant.companyCode}</strong>{t.introAfter}
      </p>

      {q.error && (
        <p className="card" style={{ padding: "12px 16px", margin: "0 0 18px", fontSize: 14.5, color: "var(--warn-fg)" }}>
          {q.error}
        </p>
      )}

      <form action={invitePersonAction} className="card" style={{ padding: 20, display: "grid", gap: 16 }}>
        <label className="field">
          <span className="field-label">{t.email}</span>
          <input
            className="field-input"
            name="email"
            type="email"
            required
            defaultValue={q.email ?? ""}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <span className="quiet field-hint">{t.emailNote}</span>
        </label>

        <label className="field">
          <span className="field-label">{t.fullName}</span>
          <input className="field-input" name="fullName" required defaultValue={q.fullName ?? ""} />
        </label>

        <label className="field">
          <span className="field-label">{t.department}</span>
          <input className="field-input" name="department" defaultValue={q.department ?? ""} />
        </label>

        <div className="field">
          <span className="field-label">{t.personType}</span>
          <Select
            name="personType"
            options={Object.entries(d.types).map(([value, label]) => ({ value, label }))}
            initial="employee"
            fieldLabel={t.personType}
          />
        </div>

        <div className="field">
          <span className="field-label">{t.language}</span>
          <Select
            name="language"
            options={UI_LANGUAGES.map(l => ({ value: l, label: d.languages[l] ?? l }))}
            initial="sk"
            fieldLabel={t.language}
          />
          <span className="quiet field-hint">{t.languageNote}</span>
        </div>

        <div>
          <button className="button" type="submit">{t.submit}</button>
        </div>
      </form>
    </div>
    </AppShell>
  )
}
