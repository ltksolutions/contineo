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
import { overdue, byPersonReminder, DEFAULT_DAYS, dueRemindersFor, claimReminder, dayKey, weekKey } from "@/lib/reminders"
import { send, reminderEmail, dueReminderEmail } from "@/lib/ecomail"
import { normalizeLanguage, formatDate } from "@/lib/i18n"

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
   * Pripomienky podľa termínu (ADR-004, krok 4). **Odosielajú sa.**
   *
   * Kadencia je overená na skutočných dátach pred zapnutím: výpočet sa
   * spustil k dvanástim dňom dopredu (D-5 až D+21) a prešiel deň po dni —
   * šesť správ pred termínom, potom D+1, D+3, D+7 a odvtedy raz týždenne
   * spolu s personalistom. Nie tridsať e-mailov za mesiac, ale jedenásť.
   *
   * **Jedna správa na človeka a deň, nikdy dve.** Právo ozvať sa sa zaberá
   * v `reminder_log` **pred odoslaním** — pri páde medzi odoslaním a zápisom
   * by inak človek dostal to isté dvakrát. V najhoršom prípade jedna správa
   * v jeden deň nepríde a príde nasledujúci; dvakrát poslaná pripomienka je
   * horšia než raz vynechaná.
   *
   * Odkaz vedie na **zoznam** `/documents`, nie na jeden dokument: kto má
   * pred sebou tri povinnosti, potrebuje jedno miesto.
   */
  const dueReport: { companyCode: string; sent: number; skipped: number; failed: number }[] = []

  for (const tenant of tenants) {
    let sent = 0, skipped = 0, failed = 0
    try {
      const host = tenant.hostnames[0]
      const branding = brandingView(tenant)
      const link = `https://${host}/documents`
      const today = dayKey(new Date())
      /*
        Eskalácia od siedmeho dňa po termíne (ADR-004, časť 3.2). Po termíne
        už problém nie je v tom, že človek zabudol — tam je problém
        organizačný, a preto o ňom má vedieť aj personalista. Chodí **raz za
        týždeň**, hoci beh je denný.
      */
      const escalate: { fullName: string; email: string; worstDays: number }[] = []

      for (const r of await dueRemindersFor(tenant.companyCode)) {
        if (r.alsoHr) {
          escalate.push({
            fullName: r.fullName,
            email: r.email,
            worstDays: Math.abs(Math.min(...r.items.map(i => i.daysLeft))),
          })
        }
        if (!(await claimReminder(tenant.companyCode, `due:${r.personId}`, today))) {
          skipped++
          continue
        }
        const language = normalizeLanguage(
          (await personCol.findOne({ companyCode: tenant.companyCode, id: r.personId } as never,
            { projection: { language: 1 } }))?.language,
        )
        try {
          await send({
            to: r.email,
            ...dueReminderEmail(
              link,
              host,
              r.items.map(i => ({
                title: i.duty.documentTitle,
                versionLabel: i.duty.versionLabel,
                due: formatDate(i.due, language),
                daysLeft: i.daysLeft,
              })),
              r.tone,
              language,
              branding,
            ),
          })
          sent++
        } catch (e) {
          // Adresa nie celá: log si prečíta viac ľudí než výkaz (O14).
          console.error(`[cron] pripomienka na ${r.email.replace(/^(.).*(@.*)$/, "$1***$2")} zlyhala:`, e)
          failed++
        }
      }

      if (escalate.length > 0) {
        const hr = await personCol
          .find(
            { companyCode: tenant.companyCode, roles: HR_ROLE, status: { $ne: "inactive" } } as never,
            { projection: { email: 1, language: 1 } },
          )
          .toArray()
        const week = weekKey(new Date())
        for (const person of hr) {
          if (!(await claimReminder(tenant.companyCode, `hr-due:${person.email}`, week))) continue
          try {
            await send({
              to: person.email,
              // Personalistovi ide **súhrn ľudí**, nie zoznam dokumentov:
              // otázka, ktorú rieši, je „s kým sa treba porozprávať".
              ...reminderEmail(
                `https://${host}/hr`,
                host,
                escalate.map(e => ({ title: e.fullName, versionLabel: e.email, days: e.worstDays })),
                normalizeLanguage(person.language),
                branding,
              ),
            })
          } catch (e) {
            console.error(`[cron] súhrn termínov pre ${person.email} zlyhal:`, e)
          }
        }
      }
    } catch (e) {
      // Jeden pokazený tenant nesmie zhodiť beh pre ostatných.
      console.error(`[cron] termíny pre ${tenant.companyCode} zlyhali:`, e)
    }
    dueReport.push({ companyCode: tenant.companyCode, sent, skipped, failed })
  }

  /*
   * Pôvodný týždenný prehľad pre personalistu podľa prahu 14 dní. **Zostáva**,
   * a nie je to duplicita: týka sa pridelení **bez termínu**, ktoré termínová
   * kadencia nevidí vôbec. Prah je spúšťač prehľadu, termín je sľub daný
   * človeku — dve rôzne veci (D61).
   *
   * Odteraz beží denne, lebo denná je termínová kadencia. Prehľad pre
   * personalistu si preto zaberá právo raz za deň tou istou cestou ako
   * pripomienky — inak by mu ten istý zoznam chodil každé ráno a do troch dní
   * by ho prestal otvárať.
   */
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

  return NextResponse.json({ ok: true, tenants: report, due: dueReport })
}
