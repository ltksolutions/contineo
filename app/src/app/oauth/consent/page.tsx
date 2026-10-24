/**
 * /oauth/consent — obrazovka súhlasu (ADR-038, D249).
 *
 * Človek vidí, **ktorá aplikácia** žiada, **za koho** bude pracovať a **čo
 * smie** (rozsahy ľudskou rečou). Jedno plné tlačidlo Povoliť, tiché
 * Zamietnuť — rozloženie prihlasovacej stránky (karta so značkou
 * organizácie), lebo je to ten istý okamih: človek práve prišiel
 * z cudzej aplikácie a potrebuje vedieť, čia je táto stránka.
 *
 * Cesta je v `PUBLIC_PATHS`, preto si prihlásenie overuje sama a
 * neprihláseného posiela na `/sign-in` s celou adresou vrátane `req`.
 */

import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { authRequestById } from "@/lib/oauthServer"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import TenantHeader from "@/components/TenantHeader"
import SubmitButton from "@/components/SubmitButton"
import { dictionary } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { approveConsentAction, denyConsentAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function ConsentPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const query = normalizeQuery<{ req?: string; expired?: string }>(await searchParams)
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") {
    const back = `/oauth/consent${query.req ? `?req=${encodeURIComponent(query.req)}` : ""}`
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(back)}`)
  }
  if (ctx.state !== "ready") notFound()

  const { tenant, person } = ctx
  const branding = brandingView(tenant)
  const t = dictionary(person.language).mcp
  const req = query.req ? await authRequestById(tenant.companyCode, query.req) : null

  return (
    <div className="wrap" style={{ padding: "64px 20px", maxWidth: 520, ...tenantStyle(branding) }}>
      <TenantHeader branding={branding} size={40} />
      {!req ? (
        <div className="card" style={{ padding: 22 }}>
          <h1 className="signin-title">{t.consent.expired}</h1>
          <p className="quiet" style={{ margin: 0, lineHeight: 1.6 }}>{t.consent.expiredText}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 22, display: "grid", gap: 16 }}>
          <div>
            <h1 className="signin-title" style={{ marginBottom: 6 }}>{t.consent.heading(req.clientName)}</h1>
            <p className="quiet" style={{ margin: 0, lineHeight: 1.6 }}>{t.consent.intro(req.clientName, branding.displayName)}</p>
          </div>
          <p style={{ margin: 0, fontSize: "var(--fs-small)" }}>{t.consent.asPerson(person.fullName, person.email)}</p>
          <section>
            <h2 style={{ fontSize: "var(--fs-section)", margin: "0 0 8px" }}>{t.consent.scopesHeading}</h2>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
              {req.scopes.map(s => (
                <li key={s}>
                  <b>{t.scopes[s].title}</b>
                  <div className="quiet" style={{ fontSize: "var(--fs-small)", lineHeight: 1.55 }}>{t.scopes[s].text}</div>
                </li>
              ))}
            </ul>
          </section>
          <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-small)", lineHeight: 1.55 }}>{t.consent.note}</p>
          {/* Dve formy, dve akcie: bez skriptu fungujú oboje. Jediné plné tlačidlo je Povoliť. */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <form action={denyConsentAction}>
              <input type="hidden" name="req" value={req.id} />
              <SubmitButton className="button button--quiet">{t.consent.deny}</SubmitButton>
            </form>
            <form action={approveConsentAction}>
              <input type="hidden" name="req" value={req.id} />
              <SubmitButton className="button">{t.consent.allow}</SubmitButton>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
