/**
 * Moje potvrdenia — čo o mne systém eviduje.
 *
 * **Vidí ju každý prihlásený a vidí v nej len seba.** Nie je to výkaz pre
 * personalistu (ten je v `/hr`), ale právo človeka vedieť, čo je o ňom
 * zapísané, a mať to v ruke bez toho, aby o to musel žiadať. Dôkazný záznam
 * (D24) je o ňom; keby sa k nemu dostal len cez HR, bol by to doklad, ktorý
 * má proti sebe a nie v rukách.
 *
 * **Ukazuje sa doslovné znenie formulky**, nie jej zhrnutie. Práve to človek
 * potvrdil a práve to je obsah dokladu; prerozprávané vlastnými slovami by to
 * bol iný text než ten, pod ktorý sa podpísal (D28).
 *
 * Odvolania sú v tom istom zozname a sú označené. Zoznam, v ktorom by boli
 * len potvrdenia, by tvrdil, že povinnosť je splnená aj tam, kde ju
 * personalista medzitým odvolal.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import { personAcknowledgements } from "@/lib/acknowledgements"
import { dictionary, formatDate } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function MyAcknowledgementsPage() {
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state === "not-in-tenant") notFound()

  const language = ctx.person.language
  const t = dictionary(language).myAcknowledgements
  const branding = brandingView(ctx.tenant)

  // Vlastné záznamy, nikdy nie cudzie: identifikátor ide z prihlásenej osoby,
  // nie z adresy (D32).
  const records = await personAcknowledgements(ctx.person.companyCode, ctx.person.id)

  return (
    <AppShell language={language}>
      <div style={{ maxWidth: 820, ...tenantStyle(branding) }}>
        <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{t.heading}</h1>
        <p className="quiet" style={{ fontSize: 15, margin: "0 0 18px", maxWidth: 620 }}>{t.intro}</p>

        {records.length === 0 ? (
          <p className="card" style={{ padding: 18 }}>{t.nothing}</p>
        ) : (
          <>
            <p style={{ margin: "0 0 20px" }}>
              {/*
                Obyčajný odkaz, nie tlačidlo so skriptom: súbor servíruje
                serverová cesta, takže sťahovanie funguje aj bez JavaScriptu.
              */}
              <a className="button" href="/api/acknowledgements/export">{t.download}</a>
              <span className="quiet" style={{ fontSize: 13, marginLeft: 12 }}>{t.count(records.length)}</span>
            </p>

            <div style={{ display: "grid", gap: 12 }}>
              {records.map(r => (
                <article key={String(r._id)} className="card" style={{ padding: "16px 18px" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 16, flex: "1 1 240px" }}>{r.documentTitle}</strong>
                    <span
                      className="tag"
                      style={r.type === "revocation"
                        ? { background: "var(--warn-bg)", color: "var(--warn-fg)" }
                        : { background: "var(--ok-bg)", color: "var(--ok-fg)" }}
                    >
                      {r.type === "revocation" ? t.revoked : t.acknowledged}
                    </span>
                  </div>

                  <p className="quiet" style={{ fontSize: 13.5, margin: "6px 0 0" }}>
                    {t.versionLine(r.versionLabel, formatDate(r.effectiveFrom, language))}
                    {" · "}
                    {r.type === "revocation"
                      ? t.revokedWhenLine(formatDate(r.acknowledgedAt, language))
                      : t.whenLine(formatDate(r.acknowledgedAt, language))}
                    {r.trackId && <> · {t.viaTrack(r.trackId)}</>}
                  </p>

                  {/*
                    Doslovné znenie formulky — obsah dokladu, nie jeho popis.
                    Pri odvolaní nesie záznam to isté znenie (odvolanie je nový
                    záznam, nie úprava starého, D24), takže sa musí povedať,
                    že je to znenie **zrušeného** potvrdenia. Bez toho nad
                    štítkom „odvolané" stojí veta „Potvrdzujem, že…".
                  */}
                  {r.type === "revocation" && (
                    <p className="quiet" style={{ fontSize: 13, margin: "12px 0 0" }}>
                      {t.revokedStatement}
                    </p>
                  )}
                  <blockquote
                    style={{
                      margin: "6px 0 0", padding: "10px 14px",
                      borderLeft: "3px solid var(--line)",
                      fontSize: 14.5, lineHeight: 1.6,
                    }}
                  >
                    {r.statementText}
                  </blockquote>

                  {r.reason && (
                    <p className="quiet" style={{ fontSize: 13.5, margin: "10px 0 0" }}>
                      {t.reason(r.reason)}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </>
        )}

        <p className="quiet" style={{ fontSize: 13.5, margin: "22px 0 0" }}>
          {t.footnoteBefore}<Link href="/guide">{t.footnoteGuide}</Link>{t.footnoteAfter}
        </p>
      </div>
    </AppShell>
  )
}
