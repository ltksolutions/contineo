/**
 * /account/apps — pripojené aplikácie prihlásenej osoby (ADR-038, D249).
 *
 * Zoznam súhlasov: ktorej aplikácii, kedy, aký rozsah, posledné použitie,
 * a tiché tlačidlo Odvolať pri každom. Odvolané ostávajú v zozname sivé —
 * súhlas je dôkazný záznam, nie nastavenie (D24).
 */

import { notFound, redirect } from "next/navigation"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import SubmitButton from "@/components/SubmitButton"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { grantsForPerson } from "@/lib/oauthServer"
import { dictionary, formatDate } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { revokeOwnGrantAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function ConnectedAppsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const query = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()

  const { person, tenant } = ctx
  const language = person.language
  const d = dictionary(language)
  const t = d.mcp
  const grants = await grantsForPerson(tenant.companyCode, person.id)

  return (
    <AppShell language={language} title={t.apps.heading}>
      <div style={{ maxWidth: 820, ...tenantStyle(brandingView(tenant)) }}>
        <Notice language={language} message={query.msg} error={query.error === "1"} back="/account/apps" />
        <div className="page-head">
          <h1 className="page-title">{t.apps.heading}</h1>
        </div>
        <p className="quiet page-lead" style={{ maxWidth: 620 }}>{t.apps.intro}</p>

        {grants.length === 0 ? (
          <div className="empty"><div className="empty-title">{t.apps.none}</div></div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {grants.map(g => (
              <article key={g.grantId} className="card" style={{ padding: "16px 18px", opacity: g.revokedAt ? 0.7 : 1 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 280px", minWidth: 0, display: "grid", gap: 4 }}>
                    <b style={{ fontSize: 15 }}>{g.clientName}</b>
                    <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>
                      {g.revokedAt
                        ? t.apps.revoked(formatDate(new Date(g.revokedAt), language))
                        : `${t.apps.granted(formatDate(new Date(g.grantedAt), language))} · ${g.lastUsedAt ? t.apps.lastUsed(formatDate(new Date(g.lastUsedAt), language)) : t.apps.neverUsed}`}
                    </span>
                    <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>
                      {t.apps.scopesLabel}: {g.scopes.map(s => t.scopes[s]?.title ?? s).join(", ")}
                    </span>
                  </div>
                  {!g.revokedAt && (
                    <form action={revokeOwnGrantAction}>
                      <input type="hidden" name="grantId" value={g.grantId} />
                      <input type="hidden" name="clientName" value={g.clientName} />
                      <SubmitButton className="button button--quiet">{t.apps.revoke}</SubmitButton>
                    </form>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
