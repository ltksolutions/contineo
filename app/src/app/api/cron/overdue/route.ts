/**
 * GET /api/cron/overdue — týždenné upozornenie pre HR.
 *
 * **Nerozposiela pripomienky ľuďom.** Spočíta, kto v ktorej organizácii mešká,
 * a napíše o tom **personalistom** — jeden e-mail na personalistu, s odkazom
 * na `/hr/reminders`, kde si zoznam pozrie a odošle sám (rozhodnuté
 * 2026-09-06).
 *
 * Dôvod je ten istý, pre ktorý má náhľad aj oznámenie o pridelení: jedna
 * chyba v podmienke by sa pri automatickom rozposielaní prejavila až tým, že
 * sa ozve sto nahnevaných ľudí. Tu sa prejaví tým, že personalista otvorí
 * zoznam a povie „toto nesedí".
 *
 * **Týždenne, nie denne.** Prah je 14 dní; denný e-mail o tom istom zozname
 * je do troch dní pošta, ktorú personalista prestane otvárať — a tým prestane
 * fungovať aj upozorňovanie.
 *
 * Beh je chránený `CRON_SECRET`, ktorý Vercel posiela v hlavičke. Bez neho by
 * to bol verejný odkaz, ktorý komukoľvek prezradí, koľko ľudí v organizácii
 * mešká.
 */

import { NextResponse } from "next/server"
import { getCollection } from "@/lib/mongodb"
import { TENANTS_COLLECTION, brandingView, normalizeTenant } from "@/lib/tenants"
import type { Tenant } from "@/lib/tenants"
import { PERSONS_COLLECTION } from "@/lib/persons"
import type { Person } from "@/lib/persons"
import { HR_ROLE } from "@/lib/hr"
import { overdue, byPersonReminder, DEFAULT_DAYS } from "@/lib/reminders"
import { send, reminderEmail } from "@/lib/ecomail"
import { normalizeLanguage } from "@/lib/i18n"

export const dynamic = "force-dynamic"
/** Prehľad naprieč tenantmi trvá; predvolených 10 s by nestačilo. */
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  // Bez nastaveného tajomstva sa beh **odmietne**, nie povolí. Chýbajúca
  // premenná pri nasadení by inak spravila z odkazu verejný výpis.
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const tenantCol = await getCollection<Tenant>(TENANTS_COLLECTION)
  const personCol = await getCollection<Person>(PERSONS_COLLECTION)
  const tenants = (await tenantCol.find({ status: "active" }).toArray()).map(normalizeTenant)

  const report: { companyCode: string; behind: number; notified: number }[] = []

  for (const tenant of tenants) {
    let people
    try {
      people = byPersonReminder(await overdue(tenant.companyCode, DEFAULT_DAYS))
    } catch (e) {
      // Jeden pokazený tenant nesmie zhodiť beh pre ostatných.
      console.error(`[cron] prehľad pre ${tenant.companyCode} zlyhal:`, e)
      continue
    }
    if (people.length === 0) continue

    const hr = await personCol
      .find(
        { companyCode: tenant.companyCode, roles: HR_ROLE, status: { $ne: "inactive" } } as never,
        { projection: { email: 1, language: 1 } },
      )
      .toArray()

    if (hr.length === 0) {
      // Organizácia bez personalistu nie je chyba behu, ale je to stav, o
      // ktorom sa treba dozvedieť — inak by sa ticho nedialo nič.
      console.warn(`[cron] ${tenant.companyCode}: ${people.length} meškajúcich, ale nikto s rolou hr`)
      report.push({ companyCode: tenant.companyCode, behind: people.length, notified: 0 })
      continue
    }

    const host = tenant.hostnames[0]
    const branding = brandingView(tenant)
    const link = `https://${host}/hr/reminders`

    // Personalistovi ide **súhrn**, nie pripomienka jeho vlastných povinností:
    // riadky sú „meškajúci ľudia", nie „dokumenty, ktoré má potvrdiť".
    const items = people.slice(0, 20).map(p => ({
      title: p.fullName,
      versionLabel: p.email,
      days: p.worstDays,
    }))

    let notified = 0
    for (const person of hr) {
      try {
        await send({
          to: person.email,
          ...reminderEmail(link, host, items, normalizeLanguage(person.language), branding),
        })
        notified++
      } catch (e) {
        console.error(`[cron] upozornenie na ${person.email} zlyhalo:`, e)
      }
    }
    report.push({ companyCode: tenant.companyCode, behind: people.length, notified })
  }

  return NextResponse.json({ ok: true, tenants: report })
}
