/**
 * Detail trasy — poradie krokov.
 *
 * Kroky sa posielajú **celé pri každej zmene** (skryté polia v jednom
 * formulári). Vyzerá to zbytočne, ale je to jediný spôsob, ako mať poradie
 * na jednom mieste: pridanie, odobranie aj posun sú tu tri spôsoby, ako
 * zostaviť to isté pole, a očísluje ho až `setTrackSteps()`.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { libraryContext } from "@/lib/library"
import { trackByKey } from "@/lib/tracks"
import { libraryList } from "@/lib/libraryRead"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import Select from "@/components/Select"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary } from "@/lib/i18n"
import {
  renameTrackAction, addStepAction, removeStepAction, moveStepAction, setTrackActiveAction,
} from "../actions"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

export default async function TrackDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>
  searchParams: Promise<RawQuery>
}) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const { key } = await params
  const { msg: message, error } = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)

  const t = dictionary(ctx.person.language).library.tracks
  const branding = brandingView(ctx.tenant)

  const track = await trackByKey(ctx.tenant.companyCode, key)
  if (!track) notFound()

  const documents = await libraryList(ctx.tenant.companyCode, {})
  const titles = new Map(documents.map(d => [d.documentId, d.title]))
  const steps = track.steps.filter(s => s.documentId)

  const here = `/library/tracks/${encodeURIComponent(track.key)}`

  // Skryté polia, ktoré nesú aktuálne poradie do každej akcie. Bez nich by
  // sa zmena vyhodnotila proti stavu v databáze a dve otvorené záložky by
  // sa navzájom potichu prepísali.
  const carry = (
    <>
      <input type="hidden" name="key" value={track.key} />
      {steps.map(s => (
        <span key={`carry-${s.documentId}`}>
          <input type="hidden" name="stepDocumentId" value={s.documentId!} />
          {s.requiresAcknowledgement && (
            <input type="hidden" name="stepAck" value={s.documentId!} />
          )}
        </span>
      ))}
    </>
  )

  // Do ponuky patria len dokumenty, ktoré v trase ešte nie sú — ten istý
  // dokument dva razy je krok, ktorý sa potvrdí sám sebou.
  const used = new Set(steps.map(s => s.documentId))
  const available = documents
    .filter(d => !used.has(d.documentId))
    .map(d => ({ value: d.documentId, label: d.title }))

  return (
    <AppShell language={ctx.person.language}>
    <div style={{ maxWidth: 760, ...tenantStyle(branding) }}>
      <Notice message={message ?? error} error={Boolean(error)} back={here} />

      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href="/library/tracks" style={{ fontSize: 14 }}>{t.back}</Link>
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 6px" }}>
        <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: 0, flex: "1 1 auto" }}>
          {track.title}
        </h1>
        <span
          className="stitok"
          style={track.isActive ? { background: "var(--ok-bg)", color: "var(--ok-fg)" } : undefined}
        >
          {track.isActive ? t.active : t.inactive}
        </span>
      </div>
      <p className="tichy" style={{ fontSize: 13.5, margin: "0 0 24px" }}>
        <code>{track.key}</code> · {t.stepCount(steps.length)}
      </p>

      {/* ── kroky ── */}

      <h2 style={{ fontSize: 19, letterSpacing: "-0.01em", margin: "0 0 12px" }}>{t.steps}</h2>

      {steps.length === 0 && (
        <p className="karta" style={{ padding: 20, margin: "0 0 20px" }}>{t.noSteps}</p>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "grid", gap: 12 }}>
        {steps.map((s, i) => (
          <li key={s.documentId} className="karta" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <span className="tichy" style={{ fontSize: 13 }}>{i + 1}.</span>
              <strong style={{ fontSize: 15.5, flex: "1 1 240px" }}>
                {titles.get(s.documentId!) ?? s.documentId}
              </strong>
              <span className="stitok">{s.requiresAcknowledgement ? t.ackYes : t.ackNo}</span>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 0" }}>
              <form action={moveStepAction}>
                {carry}
                <input type="hidden" name="documentId" value={s.documentId!} />
                <input type="hidden" name="direction" value="up" />
                <button className="tlacidlo tlacidlo--tiche" type="submit" disabled={i === 0}>
                  {t.moveUp}
                </button>
              </form>
              <form action={moveStepAction}>
                {carry}
                <input type="hidden" name="documentId" value={s.documentId!} />
                <input type="hidden" name="direction" value="down" />
                <button className="tlacidlo tlacidlo--tiche" type="submit" disabled={i === steps.length - 1}>
                  {t.moveDown}
                </button>
              </form>
              <form action={removeStepAction}>
                {carry}
                <input type="hidden" name="documentId" value={s.documentId!} />
                <button className="tlacidlo tlacidlo--tiche" type="submit">{t.remove}</button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      {available.length > 0 && (
        <form action={addStepAction} className="karta" style={{ padding: 20, display: "grid", gap: 14, margin: "0 0 32px" }}>
          {carry}
          <div className="pole">
            <span className="pole-popis">{t.addStep}</span>
            <Select
              name="documentId"
              options={[{ value: "", label: t.chooseDocument }, ...available]}
              initial=""
              fieldLabel={t.addStep}
            />
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5 }}>
            <input type="checkbox" name="requiresAcknowledgement" defaultChecked style={{ marginTop: 3 }} />
            <span>
              {t.requiresAck}
              <span className="tichy" style={{ display: "block", fontSize: 13 }}>{t.requiresAckHint}</span>
            </span>
          </label>

          <p style={{ margin: 0 }}>
            <button className="tlacidlo" type="submit">{t.addStep}</button>
          </p>
        </form>
      )}

      {/* ── zapnutie ── */}

      <form action={setTrackActiveAction} style={{ margin: "0 0 32px" }}>
        <input type="hidden" name="key" value={track.key} />
        <input type="hidden" name="isActive" value={track.isActive ? "0" : "1"} />
        <button className="tlacidlo tlacidlo--tiche" type="submit">
          {track.isActive ? t.disable : t.enable}
        </button>
      </form>

      {/* ── názov ── */}

      <form action={renameTrackAction} className="karta" style={{ padding: 20, display: "grid", gap: 16 }}>
        <input type="hidden" name="key" value={track.key} />
        <label className="pole">
          <span className="pole-popis">{t.title}</span>
          <input className="pole-vstup" name="title" defaultValue={track.title} required />
        </label>
        <label className="pole">
          <span className="pole-popis">{t.description}</span>
          <input className="pole-vstup" name="description" defaultValue={track.description ?? ""} />
        </label>
        <p style={{ margin: 0 }}>
          <button className="tlacidlo tlacidlo--tiche" type="submit">{t.rename}</button>
        </p>
      </form>
    </div>
    </AppShell>
  )
}
