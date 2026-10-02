/**
 * /organisation — rozcestník nastavenia organizácie (D48).
 *
 * Zoznam častí v skupinách na každej šírke (2. 10. 2026, Ján, možnosť 1).
 * Časť má vlastnú adresu `/organisation/{section}` (`[section]/page.tsx`),
 * takže adresa vždy zodpovedá tomu, čo je na obrazovke — aj na počítači,
 * kde sa tu dovtedy rovno otvárala prvá časť a cesta nevedela ktorá.
 *
 * Staré `?tab=` sem nedôjde: `proxy.ts` ho presmeruje na cestu časti.
 */

import { notFound, redirect } from "next/navigation"
import AppShell from "@/components/AppShell"
import OrgNav from "@/components/OrgNav"
import { tenantStyle } from "@/components/TenantHeader"
import { orgPageContext } from "@/lib/orgSettings"
import { brandingView } from "@/lib/tenants"
import { dictionary } from "@/lib/i18n"
import { orgSectionHref } from "@/lib/orgSections"

export const dynamic = "force-dynamic"

export default async function OrganisationPage() {
  const ctx = await orgPageContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  // DPO bez roly správcu osôb má jedinú časť (D154) — rozcestník s jednou
  // položkou by bol klik navyše za nič.
  if (!ctx.canAdmin) redirect(orgSectionHref("gdpr"))

  const t = dictionary(ctx.person.language).org

  return (
    <AppShell language={ctx.person.language} title={t.heading}>
      <div className="org-set" style={tenantStyle(brandingView(ctx.tenant))}>
        <h1 className="page-title">{t.heading}</h1>
        <p className="quiet page-lead" style={{ margin: "0 0 22px", maxWidth: 620 }}>
          {t.introBefore}<strong>{ctx.tenant.companyCode}</strong>{t.introAfter}
        </p>
        <OrgNav className="org-nav org-index" label={t.tabsLabel} groups={t.groups} sections={t.tabs} />
      </div>
    </AppShell>
  )
}
