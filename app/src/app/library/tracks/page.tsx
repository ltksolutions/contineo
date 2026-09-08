/**
 * Zoznam trás onboardingu (rozsah C).
 *
 * Trasa dovtedy vznikala len seedovacím skriptom — zákazník si poradie
 * krokov nevedel poskladať sám. Toto je tá obrazovka.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { libraryContext } from "@/lib/library"
import { allTracks } from "@/lib/tracks"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary } from "@/lib/i18n"
import { createTrackAction } from "./actions"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

export default async function TracksPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const { msg: message, error, key, title } = normalizeQuery<{
    msg?: string; error?: string; key?: string; title?: string
  }>(await searchParams)

  const t = dictionary(ctx.person.language).library.tracks
  const branding = brandingView(ctx.tenant)
  const tracks = await allTracks(ctx.tenant.companyCode)

  return (
    <AppShell language={ctx.person.language}>
    <div style={{ maxWidth: 760, ...tenantStyle(branding) }}>
      <Notice message={message ?? error} error={Boolean(error)} back="/library/tracks" />

      <p style={{ margin: "0 0 16px" }}>
        <Link className="quiet" href="/library" style={{ fontSize: 14 }}>
          {dictionary(ctx.person.language).library.upload.back}
        </Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{t.heading}</h1>
      <p className="quiet" style={{ fontSize: 15, margin: "0 0 24px" }}>{t.intro}</p>

      {tracks.length === 0 && (
        <p className="card" style={{ padding: 20, margin: "0 0 24px" }}>{t.empty}</p>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "grid", gap: 12 }}>
        {tracks.map(tr => (
          <li key={tr.key} className="card" style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <Link href={`/library/tracks/${encodeURIComponent(tr.key)}`} style={{ fontSize: 16.5, fontWeight: 600, flex: "1 1 240px" }}>
                {tr.title}
              </Link>
              <span
                className="tag"
                style={tr.isActive ? { background: "var(--ok-bg)", color: "var(--ok-fg)" } : undefined}
              >
                {tr.isActive ? t.active : t.inactive}
              </span>
            </div>
            <p className="quiet" style={{ fontSize: 13.5, margin: "6px 0 0" }}>
              <code>{tr.key}</code> · {t.stepCount(tr.steps.length)}
            </p>
            {tr.description && (
              <p className="quiet" style={{ fontSize: 14, margin: "6px 0 0" }}>{tr.description}</p>
            )}
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: 19, letterSpacing: "-0.01em", margin: "0 0 12px" }}>{t.newHeading}</h2>

      <form action={createTrackAction} className="card" style={{ padding: 20, display: "grid", gap: 16 }}>
        <label className="field">
          <span className="field-label">{t.title}</span>
          <input className="field-input" name="title" defaultValue={title ?? ""} required />
        </label>

        <label className="field">
          <span className="field-label">{t.key}</span>
          <input
            className="field-input"
            name="key"
            defaultValue={key ?? ""}
            required
            placeholder="novy-zamestnanec"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <span className="quiet field-hint">{t.keyHint}</span>
        </label>

        <label className="field">
          <span className="field-label">{t.description}</span>
          <input className="field-input" name="description" />
        </label>

        <p style={{ margin: 0 }}>
          <button className="button" type="submit">{t.create}</button>
        </p>
      </form>
    </div>
    </AppShell>
  )
}
