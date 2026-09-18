/**
 * Interný adresár organizácie (D87).
 *
 * **Vidí ho každý prihlásený vo vlastnej organizácii**, nie len personalista:
 * je to zoznam kolegov, nie správa prístupov. Čo v ňom zámerne nie je — roly,
 * trasy, skupiny, vyradené osoby — je odôvodnené v `lib/directory.ts`.
 *
 * Mobilný telefón je osobný údaj sprístupnený celej organizácii; je nepovinný
 * a v zázname o spracovateľských činnostiach je vedený (`GDPR_DATA_PROTECTION.md`).
 *
 * Karty, nie tabuľka: na telefóne je tabuľka so šiestimi stĺpcami nečitateľná
 * a vodorovné posúvanie v adresári znamená, že sa číslo hľadá dvoma prstami.
 */

import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import LiveFilter from "@/components/LiveFilter"
import AppShell from "@/components/AppShell"
import { listDirectory } from "@/lib/directory"
import { availableOptions } from "@/lib/codelistsTenant"
import { displayName, workplaceLabel } from "@/lib/personFields"
import { dictionary } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

/** Iniciály, keď človek nemá fotku — prázdny štvorec nepovie nič. */
function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("")
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state === "not-in-tenant") notFound()

  const { q } = normalizeQuery<{ q?: string }>(await searchParams)
  const language = ctx.person.language
  const t = dictionary(language).directory
  const branding = brandingView(ctx.tenant)

  // Organizácia ide z prihláseného človeka, nikdy z adresy (D32).
  const people = await listDirectory(ctx.person.companyCode, q)
  const workplaces = availableOptions(ctx.tenant, "workplace")

  return (
    <AppShell language={language}>
    <div style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <h1 className="page-title">{t.heading}</h1>
      <p className="quiet page-lead" style={{ maxWidth: 620 }}>{t.intro}</p>

      {/* Hľadanie je v adrese — dá sa poslať odkazom a vrátiť sa naň z histórie. */}
      <LiveFilter className="field" action="/directory" label={t.searchPlaceholder}>
        <input
          className="field-input"
          name="q"
          defaultValue={q ?? ""}
          placeholder={t.searchPlaceholder}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </LiveFilter>

      <p className="quiet" style={{ fontSize: 13.5, margin: "0 0 10px" }}>
        {people.length === 0 ? t.nothingFound : t.count(people.length)}
      </p>

      <ul className="directory-grid">
        {people.map(o => {
          const where = [o.jobTitle, o.department, workplaceLabel(o.workplace, workplaces)]
            .filter(Boolean).join(" · ")
          return (
            <li key={o.id} className="card directory-card">
              <div className="directory-avatar" aria-hidden="true">
                {o.photoVersion ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/photo/${encodeURIComponent(o.id)}?v=${encodeURIComponent(o.photoVersion)}`}
                    alt=""
                    width={44}
                    height={44}
                  />
                ) : initials(o.fullName)}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700 }}>{displayName(o)}</div>
                {where && (
                  <div className="quiet" style={{ fontSize: 13.5, marginTop: 2 }}>{where}</div>
                )}

                {/*
                  Adresa a číslo sú odkazy, nie text. Adresár existuje preto,
                  aby sa niekomu dalo ozvať — opísať číslo z obrazovky do
                  telefónu je presne ten krok, ktorý má odpadnúť.
                */}
                <div className="directory-contact">
                  <a href={`mailto:${o.email}`}>{o.email}</a>
                  {o.mobilePhone && <a href={`tel:${o.mobilePhone}`}>{o.mobilePhone}</a>}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
    </AppShell>
  )
}
