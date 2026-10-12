/**
 * Kuriér — vlákna prihlásenej osoby (ADR-033).
 *
 * **Vidí každý prihlásený a vidí len seba** (D209): zoznam je z vlákien,
 * ktorých je účastníkom, `companyCode` aj osoba sú v podmienke dotazu (D32).
 * Neexistuje pohľad „všetky správy organizácie" — ani pre správcu.
 *
 * Stav je v adrese: `?page=` stránkuje po 50 (D213). Bez JavaScriptu to
 * funguje celé; živé prekresľovanie (D210) pribudne nad touto stránkou,
 * nie namiesto nej.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { listThreads } from "@/lib/courier"
import { dictionary } from "@/lib/i18n"
import { messageTime } from "./time"

export const dynamic = "force-dynamic"

export default async function CourierPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()

  const q = normalizeQuery<{ msg?: string; error?: string; page?: string }>(await searchParams)
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1)
  const language = ctx.person.language
  const t = dictionary(language).courier
  const branding = brandingView(ctx.tenant)

  const { rows, hasMore } = await listThreads(ctx.person.companyCode, ctx.person.id, page)
  const unread = rows.filter(r => r.unread).length

  return (
    <AppShell language={language} title={t.title}>
      <div style={{ maxWidth: 820, ...tenantStyle(branding) }}>
        <Notice language={language} message={q.msg} error={q.error === "1"} back="/courier" />

        {/* Jediné plné tlačidlo obrazovky: napísať. Zoznam sám akcie nemá. */}
        <div className="page-head">
          <h1 className="page-title">{t.title}</h1>
          {unread > 0 && <span className="tag tag--review">{t.unread(unread)}</span>}
          <span className="page-head-spacer" aria-hidden="true" />
          <Link className="button" href="/courier/new">{t.write}</Link>
        </div>
        <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "0 0 18px" }}>{t.stayNote}</p>

        {rows.length === 0 ? (
          <div className="empty">
            <div className="empty-title">{t.emptyTitle}</div>
            <div className="empty-text">{t.emptyText}</div>
          </div>
        ) : (
          <ul className="card notif-list">
            {rows.map(r => (
              <li key={r.id} className={r.unread ? "notif-row is-unread" : "notif-row"}>
                {/* Celý riadok je odkaz — ako v upozorneniach; neprečítané
                    nesie farbu a váhu riadku, nie ďalší odznak. */}
                <Link href={`/courier/${encodeURIComponent(r.id)}`} className="notif-row-link">
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                      {r.kind === "announcement" && <span className="tag tag--new" style={{ marginRight: 8 }}>{t.announcement}</span>}
                      {r.subject}
                    </span>
                    <span className="quiet notif-row-date" style={{ fontSize: "var(--fs-small)", marginTop: 0 }}>
                      {messageTime(r.lastMessageAt, language)}
                    </span>
                  </div>
                  <div className="quiet" style={{ fontSize: "var(--fs-small)", fontWeight: 400, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.kind === "direct" ? r.counterpart : `${r.counterpart} · ${t.recipients(r.recipients)}`}
                    {r.preview && <> — {r.preview}</>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {hasMore && (
          <p style={{ marginTop: 14 }}>
            <Link className="button button--quiet" href={`/courier?page=${page + 1}`}>{t.older}</Link>
          </p>
        )}
      </div>
    </AppShell>
  )
}
