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
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

function Fact({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>{label}</div>
      <div style={{ fontSize: "var(--fs-lead)", fontWeight: 600, color: muted ? "var(--muted)" : undefined }}>
        {value}
      </div>
    </div>
  )
}

export default async function TenantAdminPage() {
  const ctx = await platformContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const overview = await tenantOverviews()
  const language = ctx.person.language
  const t = dictionary(language).admin.list

  return (
    <AppShell language={ctx.person.language}>
    <div style={{ maxWidth: 900 }}>
      <h1 className="page-title">{t.heading}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 16px" }}>{t.intro}</p>

      <p style={{ margin: "0 0 24px" }}>
        <Link className="button" href="/admin/new">{t.newTenant}</Link>
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
        {overview.map(tenant => (
          <li key={tenant.companyCode} className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <Link
                href={`/admin/tenants/${encodeURIComponent(tenant.companyCode)}`}
                style={{ fontSize: "var(--fs-section)", fontWeight: 700, textDecoration: "none" }}
              >
                {tenant.displayName}
              </Link>
              <span className="tag">{tenant.companyCode}</span>
              {/* Variant zo ZAKLADU, nie inline farba (ADMIN, úloha 1.1):
                  jantárová znamená „rozrobené, niečo chýba" — presne to. */}
              {tenant.status !== "active" && <span className="tag tag--draft">{t.disabled}</span>}
              <span className="quiet" style={{ fontSize: "var(--fs-small)", marginLeft: "auto" }}>
                {tenant.languages.join(" · ")}
              </span>
            </div>

            <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "8px 0 0", overflowWrap: "anywhere" }}>
              {tenant.hostnames.join(", ") || t.noDomain}
            </p>

            {/*
              Poradie podľa dôležitosti (ADMIN, úloha 1.2): Contineo je systém
              na dokumenty, takže prvé číslo je o nich. Zadanie píše
              „dokumenty, znenia, osoby, potvrdenia"; znenia sa tu nepočítajú
              (druhé číslo sú trasy) — necháva sa na jeho mieste, otázka v PR.
            */}
            <div className="admin-data">
              <Fact
                label={t.documents}
                value={t.documentsValue(
                  tenant.documents.total - tenant.documents.withoutVersion.length,
                  tenant.documents.total,
                )}
                muted={tenant.documents.total === 0}
              />
              <Fact label={t.tracks} value={String(tenant.tracks)} muted={tenant.tracks === 0} />
              <Fact
                label={t.people}
                value={t.peopleValue(tenant.people.signedIn, tenant.people.total)}
                muted={tenant.people.total === 0}
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
              <p style={{ margin: "12px 0 0", fontSize: "var(--fs-small)" }}>
                <span className="tag tag--draft">{t.withoutVersion}</span>{" "}
                <span className="quiet">{tenant.documents.withoutVersion.join(", ")}</span>
              </p>
            )}

            {tenant.pokynyPoslane && (
              <p className="quiet" style={{ margin: "10px 0 0", fontSize: "var(--fs-small)" }}>
                {t.instructionsSent(
                  formatDate(tenant.pokynyPoslane.at, language),
                  tenant.pokynyPoslane.to,
                )}
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="quiet" style={{ fontSize: "var(--fs-small)", marginTop: 20 }}>
        {t.domainsNoteBefore}<code>npm run domains</code>{t.domainsNoteAfter}
      </p>
    </div>
    </AppShell>
  )
}
