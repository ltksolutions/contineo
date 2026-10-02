/**
 * Náhľad pred rozposlaním e-mailu ľuďom na trase (2. 10. 2026).
 *
 * Ten istý vzor ako pri pridelení (`/hr/[id]/notify`): najprv komu presne
 * a s akým textom, až potom tlačidlo. Píše sa len tým, ktorí z trasy ešte
 * niečo nepotvrdili; každý dostane jeden e-mail so svojimi dokumentmi.
 */

import { notFound, redirect } from "next/navigation"
import { trackManagerContext } from "@/lib/hr"
import { trackRecipients } from "@/lib/trackNotify"
import { reminderEmail } from "@/lib/ecomail"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { requestHostname } from "@/lib/session"
import { normalizeLanguage, dictionary } from "@/lib/i18n"
import { sendTrackNotificationAction } from "../../actions"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

export default async function TrackNotifyPage({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await trackManagerContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const { key } = await params
  const found = await trackRecipients(ctx.person.companyCode, decodeURIComponent(key))
  if (!found) notFound()
  const { track, recipients } = found

  const t = dictionary(ctx.person.language).hr.notify
  const branding = brandingView(ctx.tenant)
  const host = await requestHostname()
  const here = `/hr/tracks/${encodeURIComponent(track.key)}`
  // Ukazuje sa **presne to znenie**, ktoré odíde prvému príjemcovi — zložené
  // tou istou funkciou. Ostatní dostanú svoj zoznam dokumentov.
  const first = recipients[0]
  const preview = first
    ? reminderEmail(
        `https://${host}/documents`, host,
        first.open.map(d => ({ title: d.documentTitle, versionLabel: d.versionLabel, days: 0 })),
        normalizeLanguage(ctx.person.language), branding, "notice",
      )
    : null

  return (
    <AppShell language={ctx.person.language} title={t.heading} trail={{ "/hr/tracks": dictionary(ctx.person.language).library.tracks.heading, [here]: track.title }}>
    <div style={{ maxWidth: 720, ...tenantStyle(branding) }}>
      <h1 className="page-title">{t.heading}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 20px", maxWidth: 600 }}>
        {t.introBefore}<strong>{t.introHighlight}</strong>{t.introAfter}
      </p>

      <h2 style={{ fontSize: "var(--fs-section)", margin: "0 0 10px" }}>{t.to(recipients.length)}</h2>

      {recipients.length === 0 || !preview ? (
        <p className="card" style={{ padding: 18, fontSize: "var(--fs-lead)" }}>
          {t.allAcknowledged(`trasa „${track.title}"`)}
        </p>
      ) : (
        <>
          <ul className="admin-domains" style={{ marginBottom: 26 }}>
            {recipients.map(r => (
              <li key={r.person.id} className="card" style={{ padding: "10px 14px" }}>
                <span style={{ fontWeight: 600 }}>{r.person.fullName}</span>{" "}
                <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>
                  {r.person.email} · {r.open.map(d => d.documentTitle).join(", ")}
                </span>
              </li>
            ))}
          </ul>

          <h2 style={{ fontSize: "var(--fs-section)", margin: "0 0 10px" }}>{t.preview}</h2>
          <p className="quiet field-hint" style={{ margin: "0 0 10px" }}>{t.previewSubject(preview.subject)}</p>
          <pre
            className="card"
            style={{
              padding: 18, margin: "0 0 26px", fontSize: "var(--fs-body)", lineHeight: 1.6,
              whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit",
            }}
          >
            {preview.text}
          </pre>

          <form action={sendTrackNotificationAction}>
            <input type="hidden" name="key" value={track.key} />
            <button className="button" type="submit">{t.send(recipients.length)}</button>
          </form>
        </>
      )}
    </div>
    </AppShell>
  )
}
