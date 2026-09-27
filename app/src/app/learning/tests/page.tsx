/**
 * /learning/tests — banka otázok, testy a výsledky (rola `learning-admin`).
 *
 * L0 (ADR-018): kostra s prázdnym stavom. Obsah pribudne podľa rámov
 * z Claude Design (`docs/design/LEARNING-zadanie.md`). Pri vypnutom module
 * stránka neexistuje (D123).
 */

import { notFound, redirect } from "next/navigation"
import { learningAdminContext } from "@/lib/learning"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import { normalizeLayout } from "@/lib/appNav"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function LearningTestsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const q = normalizeQuery<{ layout?: string }>(await searchParams)
  const ctx = await learningAdminContext()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()

  const language = ctx.person.language
  const t = dictionary(language).learning

  return (
    <AppShell layout={normalizeLayout(q.layout)} language={language}>
      <div style={tenantStyle(brandingView(ctx.tenant))}>
        <h1 className="page-title">{t.testsHeading}</h1>
        <p className="quiet page-lead" style={{ margin: "0 0 20px", maxWidth: 640 }}>{t.testsIntro}</p>
        <div className="empty">
          <div className="empty-title">{t.testsEmpty}</div>
          <div className="empty-text">{t.testsEmptyNote}</div>
        </div>
      </div>
    </AppShell>
  )
}
