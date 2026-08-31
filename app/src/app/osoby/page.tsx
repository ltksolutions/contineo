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
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, dictionary } from "@/lib/i18n"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { q, msg: message, error } = normalizeQuery<{ q?: string; msg?: string; error?: string }>(await searchParams)
  const people = await listPeople(ctx.person.companyCode, q)
  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language
  const t = dictionary(language).people.list

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 880, ...tenantStyle(branding) }}>
      <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{t.heading}</h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 18px", maxWidth: 620 }}>
        {t.introBefore}<strong>{t.introHighlight}</strong>{t.introAfter}
      </p>

      <Notice message={message} error={error === "1"} back={q ? `/osoby?q=${encodeURIComponent(q)}` : "/osoby"} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "0 0 20px" }}>
        <Link className="tlacidlo" href="/osoby/nova">{t.invite}</Link>
        <Link className="tlacidlo tlacidlo--tiche" href="/osoby/import">{t.importCsv}</Link>
      </div>

      {/* Serverový formulár — hľadanie je v adrese, takže sa dá poslať odkazom
          a vrátiť sa naň z histórie prehliadača. */}
      <form className="pole" style={{ margin: "0 0 20px" }}>
        <input
          className="pole-vstup"
          name="q"
          defaultValue={q ?? ""}
          placeholder={t.searchPlaceholder}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </form>

      <p className="tichy" style={{ fontSize: 13.5, margin: "0 0 10px" }}>
        {people.length === 0
          ? t.nothingFound
          : `${t.count(people.length)}${q ? t.matchesSearch : ""}`}
        {people.length === 500 && t.capped}
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
        {people.map(o => {
          return (
            <li key={o.id} className="karta" style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <Link
                  href={`/osoby/${encodeURIComponent(o.id)}`}
                  style={{ fontSize: 16, fontWeight: 700, textDecoration: "none" }}
                >
                  {o.fullName}
                </Link>
                <span
                  className="stitok"
                  style={o.status === "inactive"
                    ? { background: "var(--warn-bg)", color: "var(--warn-fg)" }
                    : undefined}
                >
                  {t.status[o.status] ?? o.status}
                </span>
                {o.roles.map(r => (
                  <span key={r} className="stitok">{r}</span>
                ))}
                <span className="tichy" style={{ fontSize: 13, marginLeft: "auto" }}>
                  {o.lastLoginAt ? formatDate(o.lastLoginAt, language) : t.neverSignedIn}
                </span>
              </div>

              <p className="tichy" style={{ fontSize: 13.5, margin: "5px 0 0", overflowWrap: "anywhere" }}>
                {o.email}
                {o.department && ` · ${o.department}`}
                {o.groups.length > 0 && ` · ${o.groups.join(", ")}`}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
