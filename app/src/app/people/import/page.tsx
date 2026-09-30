/**
 * Import osôb z CSV.
 *
 * To isté, čo robí `npm run persons:import` — a **tou istou knižnicou**
 * (`lib/personsImport.ts`). Dva importéry toho istého súboru sú spoľahlivý
 * spôsob, ako jedného dňa naimportovať dva rôzne výsledky.
 */

import { notFound, redirect } from "next/navigation"
import { peopleContext } from "@/lib/people"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import PeopleImport from "@/components/PeopleImport"
import { dictionary } from "@/lib/i18n"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

export default async function ImportPage() {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language
  const t = dictionary(language).people.import

  return (
    <AppShell language={ctx.person.language} title={t.heading}>
    <div style={{ maxWidth: 680, ...tenantStyle(branding) }}>
      <h1 className="page-title">{t.heading}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 20px", maxWidth: 600 }}>
        {t.introBefore}<strong>{t.introHighlight}</strong>{t.introMiddle}
        <strong>{ctx.tenant.companyCode}</strong>{t.introAfter}
      </p>

      {/*
        Blok „čo sa stane s tým, kto už v systéme je" stojí pred nahraním, nie
        až v náhľade (OSOBY.md, úloha 5) — a od ADR-019 je v komponente, lebo
        jeho znenie závisí od prepínača „Aktualizovať existujúcich", a ten je
        klientsky stav.
      */}
      <PeopleImport language={language} />
    </div>
    </AppShell>
  )
}
