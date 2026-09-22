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
import Fact from "@/components/Fact"

export const dynamic = "force-dynamic"

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

      {/* V praxi sa nestane — `/admin` vidí ten, kto organizáciu už má —
          ale prázdna obrazovka bez textu je horšia než veta, ktorá sa
          nezobrazí (ADMIN, úloha 1.3). */}
      {overview.length === 0 && (
        <div className="empty">
          <div className="empty-title">{t.emptyTitle}</div>
          <div className="empty-text">{t.emptyText}</div>
        </div>
      )}

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

            {/*
              Bez domény sa do organizácie **nedá prihlásiť** (ADMIN, úloha
              1.5) — to nie je poznámka medzi ostatnými, ale porucha. Inline
              blok ako chyba vyhľadávania; `.notice` je modálne okno a na
              stav v karte sa nehodí.
            */}
            {tenant.hostnames.length > 0 ? (
              <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "8px 0 0", overflowWrap: "anywhere" }}>
                {tenant.hostnames.join(", ")}
              </p>
            ) : (
              <p className="ask-error" style={{ margin: "10px 0 0" }} role="alert">
                {t.noDomainWarning}
              </p>
            )}

            {/*
              Poradie podľa dôležitosti (ADMIN, úloha 1.2): Contineo je systém
              na dokumenty, takže prvé číslo je o nich a druhé o ich zneniach —
              to je to, čo organizácia naozaj má. Počet trás bola vnútorná
              mechanika (rozhodnutie Jána 2026-09-22); znenia sa počítajú
              z dokumentov, ktoré `tenantOverviews()` už načítalo.
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
              <Fact label={t.versions} value={String(tenant.versions)} muted={tenant.versions === 0} />
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
