/**
 * Upozornenia — čo sa stalo, keď sa človek nepozeral.
 *
 * **Vidí ju každý prihlásený a vidí v nej len seba** (D32). Nie je to prehľad
 * organizácie: udalosti chodia tomu, kto akciu spustil, a pri cronových
 * pripomienkach tým, ktorých sa týkajú rolou.
 *
 * **Nie sú tu počty povinností.** „Na potvrdenie 3" hovorí štítok v navigácii
 * a je tam, kde sa naň klikne; zopakovať to tu by znamenalo druhé miesto
 * s tou istou pravdou. Tu sú veci, ktoré sa stali raz a nezanechali stav,
 * z ktorého by sa dali dopočítať.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import {
  recentNotifications, notificationHref, RETENTION_DAYS,
  type Notification, type NotificationParams,
} from "@/lib/notifications"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import { markAllReadAction } from "./actions"

export const dynamic = "force-dynamic"

/**
 * Veta k jednému upozorneniu. Skladá sa **tu**, z druhu a parametrov.
 *
 * Neznámy druh (starý záznam po zmene kódu) sa nezahodí a nevypíše sa preň
 * prázdny riadok — ukáže sa aspoň to, čoho sa týkal. Prázdny riadok v zozname
 * vyzerá ako chyba vykreslenia, nie ako stará udalosť.
 */
function sentence(language: UiLanguage, kind: string, params: NotificationParams): string {
  const t = dictionary(language).notifications.kinds
  const title = params.documentTitle ?? params.documentId ?? ""
  switch (kind) {
    case "reindexed": return t.reindexed(title, params.count ?? 0)
    case "rewritten": return t.rewritten(title)
    case "remindersSent": return t.remindersSent(params.count ?? 0)
    case "versionPublished": return t.versionPublished(title, params.versionLabel ?? "")
    default: return title || kind
  }
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()

  const { msg: message } = normalizeQuery<{ msg?: string }>(await searchParams)
  const language = ctx.person.language
  const t = dictionary(language).notifications
  const branding = brandingView(ctx.tenant)

  // Vlastné záznamy, nikdy cudzie: identita ide z prihlásenej osoby (D32).
  const rows: Notification[] = await recentNotifications(ctx.person.companyCode, ctx.person.id)
  const unread = rows.filter(r => !r.readAt).length

  return (
    <AppShell language={language}>
      <div style={{ maxWidth: 820, ...tenantStyle(branding) }}>
        {message && <Notice message={message} back="/notifications" />}

        <h1 className="page-title">{t.title}</h1>
        <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "0 0 18px" }}>
          {t.retentionNote(RETENTION_DAYS)}
        </p>

        {rows.length === 0 ? (
          <p className="card" style={{ padding: 18 }}>{t.empty}</p>
        ) : (
          <>
            {unread > 0 && (
              <form action={markAllReadAction} style={{ margin: "0 0 18px" }}>
                <button className="button" type="submit">{t.markAllRead}</button>
                <span className="quiet" style={{ fontSize: "var(--fs-small)", marginLeft: 12 }}>{t.unread(unread)}</span>
              </form>
            )}

            <ul className="card" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {rows.map((r, i) => {
                const href = notificationHref(r.kind, r.params)
                const text = sentence(language, r.kind, r.params)
                return (
                  <li
                    key={String(r._id ?? i)}
                    style={{
                      padding: "14px 18px",
                      borderBottom: i === rows.length - 1 ? 0 : "1px solid var(--line)",
                      // Neprečítané sa líši **hrúbkou písma, nie farbou**:
                      // farba by sa v tmavej téme aj pri slabom zraku stratila.
                      fontWeight: r.readAt ? 400 : 600,
                    }}
                  >
                    {href ? <Link href={href}>{text}</Link> : <span>{text}</span>}
                    <div className="quiet" style={{ fontSize: "var(--fs-small)", fontWeight: 400, marginTop: 4 }}>
                      {formatDate(r.createdAt, language)}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </AppShell>
  )
}
