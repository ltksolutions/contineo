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
import { overdue, byPersonReminder, DEFAULT_DAYS, NOTICE_DAYS, thresholdDays } from "@/lib/reminders"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import Notice from "@/components/Notice"
import { dictionary } from "@/lib/i18n"
import { dutyState, dutyTagClass } from "@/lib/due"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { sendRemindersAction } from "../actions"
import AppShell from "@/components/AppShell"

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
  // Prah je v adrese, nie v nastavení organizácie: sú to dve otázky, ktoré
  // si personalista kladie v rôznych chvíľach — „daj vedieť všetkým" (0)
  // a „kto mešká mesiac?" (30) — a ani jedna nemá prečo bývať vo formulári.
  const days = thresholdDays(q.days)
  // Prah nula nie je „pripomienka s nulou dní", ale prvé oznámenie. Mení to
  // nadpis, vetu na obrazovke aj text e-mailu — pripomínať človeku niečo,
  // čo pribudlo dnes, znamená vyčítať mu meškanie, ktoré nemal ako spôsobiť.
  const notice = days === NOTICE_DAYS

  const language = ctx.person.language
  const t = dictionary(language).hr.reminders
  const tds = dictionary(language).hr.dutyState
  const now = new Date()
  const branding = brandingView(ctx.tenant)

  const people = byPersonReminder(await overdue(ctx.person.companyCode, days))

  return (
    <AppShell language={ctx.person.language}>
    <div style={{ maxWidth: 760, ...tenantStyle(branding) }}>
      <Notice message={q.msg} error={q.error === "1"} back="/hr/reminders" />

      <p style={{ margin: "0 0 16px" }}>
        <Link className="quiet" href="/hr" style={{ fontSize: "var(--fs-body)" }}>{t.back}</Link>
      </p>

      <h1 className="page-title">
        {notice ? t.noticeHeading : t.heading}
      </h1>
      <p className="quiet page-lead" style={{ margin: "0 0 16px" }}>
        {notice ? t.noticeIntro : t.intro(days)}
      </p>

      {/* Dva odkazy, nie tlačidlá s JavaScriptom: režim je súčasťou adresy,
          takže sa dá poslať aj s ním a funguje bez skriptu — rovnako ako
          prepínač pohľadu v knižnici. */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0 0 24px" }}>
        <span className="quiet" style={{ fontSize: "var(--fs-micro)" }}>{t.modeLabel}</span>
        <span className="view-switch" role="group" aria-label={t.modeLabel}>
          <Link
            className={`view-switch-item${notice ? " is-on" : ""}`}
            href={`/hr/reminders?days=${NOTICE_DAYS}`}
            aria-current={notice ? "true" : undefined}
          >
            {t.modeNotice}
          </Link>
          <Link
            className={`view-switch-item${notice ? "" : " is-on"}`}
            href="/hr/reminders"
            aria-current={notice ? undefined : "true"}
          >
            {t.modeOverdue(DEFAULT_DAYS)}
          </Link>
        </span>
      </div>

      {people.length === 0 ? (
        <p className="card" style={{ padding: 20 }}>{notice ? t.noticeNone : t.none(days)}</p>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "grid", gap: 10 }}>
            {people.map(p => (
              <li key={p.personId} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "var(--fs-lead)", flex: "1 1 200px" }}>{p.fullName}</strong>
                  <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>{p.email}</span>
                </div>
                <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "6px 0 0" }}>
                  {notice ? t.noticePerson(p.items.length) : t.person(p.items.length, p.worstDays)}
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", fontSize: "var(--fs-small)" }}>
                  {p.items.map(o => (
                    <li key={o.duty.versionId} className="quiet" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                      <span>· {o.duty.documentTitle} ({o.duty.versionLabel})</span>
                      {/* Jedna škála pre celú rolu (HR.md, úloha 1): tu je
                          každý nepotvrdený — pilulka povie, či aspoň otvoril
                          a či už horí termín. */}
                      <span className={dutyTagClass(o.duty, now)}>{tds[dutyState(o.duty, now)]}</span>
                      {/* Odkiaľ povinnosť plynie. Pri trase je to jediné
                          vysvetlenie, prečo tu človek je — pridelenie, ktoré
                          by personalista hľadal v zozname, neexistuje. */}
                      {o.duty.trackTitles.length > 0 && <span>· {t.fromTrack(o.duty.trackTitles.join(", "))}</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          {/* Súhrn pred odoslaním (HR.md, úloha 4) — ten istý blok ako pred
              pridelením, len s iným slovesom: povie, čo sa stane, nie čo sa
              poslalo. Jeden e-mail na človeka, preto počet ľudí = počet
              e-mailov; kto už potvrdil, v zozname nie je (D61). */}
          <div className="assign-impact" role="status">
            <div className="assign-impact-count">{t.impactEmails(people.length)}</div>
            <div className="quiet" style={{ fontSize: "var(--fs-small)" }}>{t.impactNote}</div>
          </div>

          <form action={sendRemindersAction}>
            <input type="hidden" name="days" value={String(days)} />
            <button className="button" type="submit">
              {notice ? t.noticeSend(people.length) : t.send(people.length)}
            </button>
          </form>
        </>
      )}
    </div>
    </AppShell>
  )
}
