/**
 * Ranný súhrn Kuriéra (ADR-033, D207).
 *
 * Raz denne ráno jeden e-mail tomu, kto má neprečítané vlákno, ktoré ešte
 * v súhrne nebolo: zoznam „kto · predmet" a tlačidlo. **Text správ platformu
 * neopustí.** Kto nemá nič nové, nedostane nič; kto si súhrn vypol
 * (`courierDigest: false` na osobe), tiež nie.
 *
 * Prečo nie pri každej správe: oznam 120 ľuďom by bol 120 odoslaní naraz
 * (dlhšie než limit požiadavky) a živý rozhovor by poslal desať e-mailov za
 * minútu. Jeden beh vezme najviac 100 osôb (D207); odoslané sa označia
 * (`digestedAt`), takže ďalší beh pokračuje tam, kde tento skončil.
 *
 * Rozvrh je v UTC (`vercel.json`): 5:30 UTC = 7:30 v lete, 6:30 v zime.
 */

import { NextResponse } from "next/server"
import { getCollection } from "@/lib/mongodb"
import { TENANTS_COLLECTION, brandingView, normalizeTenant, type Tenant } from "@/lib/tenants"
import { PERSONS_COLLECTION, type Person } from "@/lib/persons"
import { pendingDigests, markDigested } from "@/lib/courier"
import { send, courierDigestEmail } from "@/lib/ecomail"
import { normalizeLanguage } from "@/lib/i18n"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Koľko osôb za jeden beh — zvyšok dobehne ďalší beh. */
const BATCH = 100

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const tenantCol = await getCollection<Tenant>(TENANTS_COLLECTION)
  const personCol = await getCollection<Person & { courierDigest?: boolean }>(PERSONS_COLLECTION)
  const tenants = (await tenantCol.find({ status: "active" }).toArray()).map(normalizeTenant)

  const report: { companyCode: string; sent: number; skipped: number; failed: number }[] = []
  for (const tenant of tenants) {
    let sent = 0, skipped = 0, failed = 0
    try {
      const host = tenant.hostnames[0]
      const branding = brandingView(tenant)
      const link = `https://${host}/courier`
      for (const d of await pendingDigests(tenant.companyCode, BATCH)) {
        const person = await personCol.findOne(
          { companyCode: tenant.companyCode, id: d.personId } as never,
          { projection: { language: 1, status: 1, courierDigest: 1, email: 1 } },
        )
        // Vyradená osoba alebo vypnutý súhrn: označiť ako vybavené, aby to
        // nečakalo vo fronte každé ráno.
        if (!person || person.status === "inactive" || person.courierDigest === false) {
          await markDigested(tenant.companyCode, d.personId, d.items.map(i => i.threadId))
          skipped++
          continue
        }
        try {
          await send({
            to: person.email ?? d.email,
            ...courierDigestEmail(link, host, d.items.map(i => ({ from: i.from, subject: i.subject })), normalizeLanguage(person.language), branding),
          })
          await markDigested(tenant.companyCode, d.personId, d.items.map(i => i.threadId))
          sent++
        } catch (e) {
          // Adresa nie celá: log si prečíta viac ľudí než výkaz (O14).
          console.error(`[courier-digest] súhrn na ${d.email.replace(/^(.).*(@.*)$/, "$1***$2")} zlyhal:`, e)
          failed++
        }
      }
    } catch (e) {
      console.error(`[courier-digest] ${tenant.companyCode} zlyhal:`, e)
    }
    report.push({ companyCode: tenant.companyCode, sent, skipped, failed })
  }
  return NextResponse.json({ ok: true, report })
}
