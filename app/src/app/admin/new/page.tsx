/**
 * Nová organizácia (Fáza 5b, rozsah C).
 *
 * Zakladá sa najprv v `tenants` a až potom sa domény pridávajú do Vercelu —
 * zdroj pravdy je náš zápis a výpadok cudzieho API nesmie brániť organizáciu
 * založiť. Keď sa doména pridať nepodarí, povie sa to a doplní sa ručne.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { platformContext } from "@/lib/admin"
import { createTenantAction } from "../actions"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary } from "@/lib/i18n"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

export default async function NewTenantPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await platformContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const { msg: message } = normalizeQuery<{ msg?: string }>(await searchParams)
  const t = dictionary(ctx.person.language).admin.create

  return (
    <AppShell language={ctx.person.language}>
    <div style={{ maxWidth: 620 }}>
      <p style={{ margin: "0 0 12px" }}>
        <Link href="/admin" className="quiet" style={{ fontSize: 14 }}>
          {t.back}
        </Link>
      </p>

      <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{t.heading}</h1>
      <p className="quiet" style={{ fontSize: 15, margin: "0 0 20px" }}>
        {t.introBefore}<code>contineo.app</code>{t.introMiddle}<code>CNAME</code>{t.introAfter}
      </p>

      {message && (
        <p className="card" style={{ padding: "12px 16px", margin: "0 0 20px", fontSize: 14.5 }}>
          {message}
        </p>
      )}

      <form action={createTenantAction} className="card admin-form">
        <label className="field">
          <span className="field-label">{t.code}</span>
          <input className="field-input" name="companyCode" required />
          <span className="quiet field-hint">
            {t.codeNoteBefore}<strong>{t.codeNoteHighlight}</strong>{t.codeNoteAfter}
          </span>
        </label>

        <label className="field">
          <span className="field-label">{t.name}</span>
          <input className="field-input" name="displayName" required />
          <span className="quiet field-hint">{t.nameNote}</span>
        </label>

        <label className="field">
          <span className="field-label">{t.supportEmail}</span>
          <input className="field-input" name="supportEmail" type="email" />
          <span className="quiet field-hint">{t.supportEmailNote}</span>
        </label>

        <label className="field">
          <span className="field-label">{t.domains}</span>
          <textarea className="field-input" name="hostnames" rows={3} placeholder={t.domainsPlaceholder} />
          <span className="quiet field-hint">{t.domainsNote}</span>
        </label>

        <button className="button" type="submit">{t.submit}</button>
      </form>
    </div>
    </AppShell>
  )
}
