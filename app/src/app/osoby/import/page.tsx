/**
 * Import osôb z CSV.
 *
 * To isté, čo robí `npm run persons:import` — a **tou istou knižnicou**
 * (`lib/personsImport.ts`). Dva importéry toho istého súboru sú spoľahlivý
 * spôsob, ako jedného dňa naimportovať dva rôzne výsledky.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { peopleContext } from "@/lib/people"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import ImportOsob from "@/components/ImportOsob"

export const dynamic = "force-dynamic"

export default async function ImportStranka() {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const branding = brandingView(ctx.tenant)

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 680, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href="/osoby" style={{ fontSize: 14 }}>← Späť na zoznam</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Import z CSV</h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 20px", maxWidth: 600 }}>
        Najprv uvidíš, <strong>čo by sa stalo</strong>, a zapíše sa až potom.
        Nahratie stovky ľudí naslepo je presne tá operácia, po ktorej sa hľadá,
        ako to vrátiť späť — a vrátiť sa nedá. Všetci sa zapíšu do organizácie{" "}
        <strong>{ctx.tenant.companyCode}</strong>, aj keď je v súbore niečo iné.
      </p>

      <ImportOsob />
    </div>
  )
}
