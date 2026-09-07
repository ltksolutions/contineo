/**
 * Náhľad pred rozposlaním pripomienok.
 *
 * Rovnaký vzor ako pri oznámení o pridelení: **nič sa neposiela ako vedľajší
 * účinok inej akcie.** Najprv je vidieť, komu presne a s koľkými položkami to
 * pôjde, a až potom je tlačidlo. Pridelenie sa dá odvolať, odoslaný e-mail nie.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { hrContext } from "@/lib/hr"
import { overdue, byPersonReminder, DEFAULT_DAYS } from "@/lib/reminders"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import Notice from "@/components/Notice"
import { dictionary } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { sendRemindersAction } from "../actions"

export const dynamic = "force-dynamic"

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await hrContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const q = normalizeQuery<{ msg?: string; error?: string; days?: string }>(await searchParams)
  // Prah sa dá zmeniť v adrese. Nie je to nastavenie organizácie — je to
  // otázka „a čo tí, čo meškajú mesiac?", ktorú si personalista položí raz
  // za čas a ktorá nemá prečo bývať vo formulári.
  const days = Math.max(1, Number(q.days) || DEFAULT_DAYS)

  const language = ctx.person.language
  const t = dictionary(language).hr.reminders
  const branding = brandingView(ctx.tenant)

  const people = byPersonReminder(await overdue(ctx.person.companyCode, days))

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 760, ...tenantStyle(branding) }}>
      <Notice message={q.msg} error={q.error === "1"} back="/hr/reminders" />

      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href="/hr" style={{ fontSize: 14 }}>{t.back}</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{t.heading}</h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 24px", maxWidth: 640 }}>{t.intro(days)}</p>

      {people.length === 0 ? (
        <p className="karta" style={{ padding: 20 }}>{t.none(days)}</p>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "grid", gap: 10 }}>
            {people.map(p => (
              <li key={p.personId} className="karta" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 15.5, flex: "1 1 200px" }}>{p.fullName}</strong>
                  <span className="tichy" style={{ fontSize: 13.5 }}>{p.email}</span>
                </div>
                <p className="tichy" style={{ fontSize: 13.5, margin: "6px 0 0" }}>
                  {t.person(p.items.length, p.worstDays)}
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", fontSize: 13.5 }}>
                  {p.items.map(o => (
                    <li key={o.duty.versionId} className="tichy">
                      · {o.duty.documentTitle} ({o.duty.versionLabel})
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <p className="tichy" style={{ fontSize: 14, margin: "0 0 14px" }}>{t.preview}</p>

          <form action={sendRemindersAction}>
            <input type="hidden" name="days" value={String(days)} />
            <button className="tlacidlo" type="submit">{t.send(people.length)}</button>
          </form>
        </>
      )}
    </div>
  )
}
