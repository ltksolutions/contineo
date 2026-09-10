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
import { overdue, byPersonReminder, DEFAULT_DAYS, dueRemindersFor } from "@/lib/reminders"
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

  /*
   * Pripomienky podľa termínu (ADR-004) zatiaľ **len naprázdno**.
   *
   * Beh spočíta, komu by sa dnes ozval a v akom tóne, a vypíše to. **Nič
   * neodošle.** Dôvod je ten istý, pre ktorý má náhľad aj prideľovanie: cron
   * beží na Verceli, náhľady sú za SSO, a overiť sa to inak než na ostro nedá.
   * Jedna chyba v kadencii by sa pri rovno zapnutom odosielaní prejavila až
   * tým, že sa ozve sto ľudí — a pri termíne je to sľub, nie upozornenie.
   *
   * Odosielanie sa zapne samostatnou zmenou, keď sa na tomto výpise zhodneme.
   */
  const dueDryRun: {
    companyCode: string
    person: string
    tone: "soon" | "over"
    alsoHr: boolean
    items: { document: string; daysLeft: number }[]
  }[] = []

  for (const tenant of tenants) {
    try {
      for (const r of await dueRemindersFor(tenant.companyCode)) {
        dueDryRun.push({
          companyCode: tenant.companyCode,
          // Adresa sa do výpisu nepíše celá — log si prečíta viac ľudí než
          // výkaz a je to osobný údaj (O14).
          person: r.email.replace(/^(.).*(@.*)$/, "$1***$2"),
          tone: r.tone,
          alsoHr: r.alsoHr,
          items: r.items.map(i => ({ document: i.duty.documentTitle, daysLeft: i.daysLeft })),
        })
      }
    } catch (e) {
      console.error(`[cron] termíny pre ${tenant.companyCode} zlyhali:`, e)
    }

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

  if (dueDryRun.length > 0) {
    console.warn(
      `[cron] termíny — naprázdno, neodoslané: ${dueDryRun.length} ľuďom`,
      JSON.stringify(dueDryRun),
    )
  }

  return NextResponse.json({ ok: true, tenants: report, dueDryRun })
}
