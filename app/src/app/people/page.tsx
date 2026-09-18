/**
 * Zoznam osôb organizácie (D46).
 *
 * Vyradení sú v zozname tiež, len označení. Skryť ich by znamenalo, že
 * personalista nevie, prečo sa mu nedá pozvať adresa, ktorú tam „nikto nemá" —
 * a skončil by tak, že skúša tú istú vec dvakrát.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { peopleContext, listPeople } from "@/lib/people"
import { availableOptions } from "@/lib/codelistsTenant"
import { displayName, workplaceLabel } from "@/lib/personFields"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import LiveFilter from "@/components/LiveFilter"
import { formatDate, dictionary } from "@/lib/i18n"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const { q, msg: message, error } = normalizeQuery<{ q?: string; msg?: string; error?: string }>(await searchParams)
  const people = await listPeople(ctx.person.companyCode, q)
  const workplaces = availableOptions(ctx.tenant, "workplace")
  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language
  const t = dictionary(language).people.list

  return (
    <AppShell language={language}>
    <div style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <h1 className="page-title">{t.heading}</h1>
      <p className="quiet page-lead" style={{ maxWidth: 620 }}>
        {t.introBefore}<strong>{t.introHighlight}</strong>{t.introAfter}
      </p>

      <Notice message={message} error={error === "1"} back={q ? `/people?q=${encodeURIComponent(q)}` : "/people"} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "0 0 20px" }}>
        <Link className="button" href="/people/new">{t.invite}</Link>
        <Link className="button button--quiet" href="/people/import">{t.importCsv}</Link>
        <Link className="button button--quiet" href="/people/invite">
          {dictionary(language).people.inviteAll.open}
        </Link>
      </div>

      {/* Serverový formulár — hľadanie je v adrese, takže sa dá poslať odkazom
          a vrátiť sa naň z histórie prehliadača. */}
      <LiveFilter className="field" action="/people" label={t.searchPlaceholder}>
        <input
          className="field-input"
          name="q"
          defaultValue={q ?? ""}
          placeholder={t.searchPlaceholder}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </LiveFilter>

      <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "0 0 10px" }}>
        {people.length === 0
          ? t.nothingFound
          : `${t.count(people.length)}${q ? t.matchesSearch : ""}`}
        {people.length === 500 && t.capped}
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
        {people.map(o => {
          return (
            <li key={o.id} className="card" style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <Link
                  href={`/people/${encodeURIComponent(o.id)}`}
                  style={{ fontSize: "var(--fs-lead)", fontWeight: 700, textDecoration: "none" }}
                >
                  {displayName(o)}
                </Link>
                <span
                  className="tag"
                  style={o.status === "inactive"
                    ? { background: "var(--warn-bg)", color: "var(--warn-fg)" }
                    : undefined}
                >
                  {t.status[o.status] ?? o.status}
                </span>
                {o.roles.map(r => (
                  <span key={r} className="tag">{r}</span>
                ))}
                <span className="quiet" style={{ fontSize: "var(--fs-small)", marginLeft: "auto" }}>
                  {o.lastLoginAt ? formatDate(o.lastLoginAt, language) : t.neverSignedIn}
                </span>
              </div>

              {/*
                Pozícia a pracovisko patria do prvého riadku pod meno: keď
                personalista hľadá „správcu ihriska v Senci", je to presne to,
                podľa čoho v zozname rozhoduje. Adresa a skupiny sú až potom.
              */}
              {(o.jobTitle || o.workplace) && (
                <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "5px 0 0" }}>
                  {[o.jobTitle, workplaceLabel(o.workplace, workplaces)].filter(Boolean).join(" · ")}
                </p>
              )}

              <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "3px 0 0", overflowWrap: "anywhere" }}>
                {o.email}
                {o.department && ` · ${o.department}`}
                {o.groups.length > 0 && ` · ${o.groups.join(", ")}`}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
    </AppShell>
  )
}
