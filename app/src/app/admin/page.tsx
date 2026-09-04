/**
 * Správa tenantov — prehľad (Fáza 5b, rozsah A).
 *
 * Na doméne zákazníka táto stránka **neexistuje** (D42): odpovie `notFound()`,
 * nie „nemáte prístup". To isté platí pre prihláseného bez roly — kto sa sem
 * nemá dostať, nemá sa ani dozvedieť, že tu niečo je.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { platformContext, tenantOverviews } from "@/lib/admin"
import { formatDate, dictionary } from "@/lib/i18n"

export const dynamic = "force-dynamic"

function Fact({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <div className="tichy" style={{ fontSize: 12.5 }}>{label}</div>
      <div style={{ fontSize: 15.5, fontWeight: 600, color: muted ? "var(--muted)" : undefined }}>
        {value}
      </div>
    </div>
  )
}

export default async function TenantAdminPage() {
  const ctx = await platformContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const overview = await tenantOverviews()
  const language = ctx.person.language
  const t = dictionary(language).admin.list

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 900 }}>
      <h1 style={{ fontSize: 27, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{t.heading}</h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 16px", maxWidth: 640 }}>{t.intro}</p>

      <p style={{ margin: "0 0 24px" }}>
        <Link className="tlacidlo" href="/admin/novy">{t.newTenant}</Link>
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
        {overview.map(tenant => (
          <li key={tenant.companyCode} className="karta" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <Link
                href={`/admin/tenanti/${encodeURIComponent(tenant.companyCode)}`}
                style={{ fontSize: 17, fontWeight: 700, textDecoration: "none" }}
              >
                {tenant.displayName}
              </Link>
              <span className="stitok">{tenant.companyCode}</span>
              {tenant.status !== "active" && (
                <span className="stitok" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
                  {t.disabled}
                </span>
              )}
              <span className="tichy" style={{ fontSize: 13, marginLeft: "auto" }}>
                {tenant.languages.join(" · ")}
              </span>
            </div>

            <p className="tichy" style={{ fontSize: 13.5, margin: "8px 0 0", overflowWrap: "anywhere" }}>
              {tenant.hostnames.join(", ") || t.noDomain}
            </p>

            <div className="admin-udaje">
              <Fact
                label={t.people}
                value={t.peopleValue(tenant.people.signedIn, tenant.people.total)}
                muted={tenant.people.total === 0}
              />
              <Fact label={t.tracks} value={String(tenant.tracks)} muted={tenant.tracks === 0} />
              <Fact
                label={t.documents}
                value={t.documentsValue(
                  tenant.documents.total - tenant.documents.withoutVersion.length,
                  tenant.documents.total,
                )}
                muted={tenant.documents.total === 0}
              />
              <Fact
                label={t.acknowledgements}
                value={String(tenant.acknowledgements)}
                muted={tenant.acknowledgements === 0}
              />
            </div>

            {/* Dokumenty bez platného znenia sú menovite. Je to najčastejšia
                tichá príčina, prečo človek v zozname nič nevidí (D6) — a bez
                mena sa nedá povedať, ktorý z nich opraviť. */}
            {tenant.documents.withoutVersion.length > 0 && (
              <p style={{ margin: "12px 0 0", fontSize: 13.5 }}>
                <span className="stitok" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
                  {t.withoutVersion}
                </span>{" "}
                <span className="tichy">{tenant.documents.withoutVersion.join(", ")}</span>
              </p>
            )}

            {tenant.pokynyPoslane && (
              <p className="tichy" style={{ margin: "10px 0 0", fontSize: 13 }}>
                {t.instructionsSent(
                  formatDate(tenant.pokynyPoslane.at, language),
                  tenant.pokynyPoslane.to,
                )}
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="tichy" style={{ fontSize: 13, marginTop: 20 }}>
        {t.domainsNoteBefore}<code>npm run domains</code>{t.domainsNoteAfter}
      </p>
    </div>
  )
}
