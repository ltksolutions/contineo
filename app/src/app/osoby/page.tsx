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
import { formatDate } from "@/lib/i18n"
import Oznam from "@/components/Oznam"

export const dynamic = "force-dynamic"

const STAVY = {
  invited: { text: "pozvaná", tichy: true },
  active: { text: "aktívna", tichy: false },
  inactive: { text: "vyradená", tichy: false },
} as const

export default async function Osoby({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sprava?: string; chyba?: string }>
}) {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { q, sprava, chyba } = await searchParams
  const osoby = await listPeople(ctx.person.companyCode, q)
  const branding = brandingView(ctx.tenant)
  const jazyk = ctx.person.language

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 880, ...tenantStyle(branding) }}>
      <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Osoby</h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 18px", maxWidth: 620 }}>
        Kto do organizácie patrí. Osoba sa <strong>nemaže</strong> — vyradenie ju
        odstrihne od portálu, ale jej potvrdenia zostávajú platnými záznamami.
      </p>

      <Oznam sprava={sprava} chyba={chyba === "1"} spat={q ? `/osoby?q=${encodeURIComponent(q)}` : "/osoby"} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "0 0 20px" }}>
        <Link className="tlacidlo" href="/osoby/nova">Pozvať osobu</Link>
        <Link className="tlacidlo tlacidlo--tiche" href="/osoby/import">Import z CSV</Link>
      </div>

      {/* Serverový formulár — hľadanie je v adrese, takže sa dá poslať odkazom
          a vrátiť sa naň z histórie prehliadača. */}
      <form className="pole" style={{ margin: "0 0 20px" }}>
        <input
          className="pole-vstup"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Hľadať v mene, adrese alebo útvare"
          autoCapitalize="none"
          autoCorrect="off"
        />
      </form>

      <p className="tichy" style={{ fontSize: 13.5, margin: "0 0 10px" }}>
        {osoby.length === 0
          ? "Nič sa nenašlo."
          : `${osoby.length} ${osoby.length === 1 ? "osoba" : osoby.length < 5 ? "osoby" : "osôb"}${q ? " vyhovuje hľadaniu" : ""}`}
        {osoby.length === 500 && " — zobrazených prvých 500, zúž hľadanie"}
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
        {osoby.map(o => {
          const stav = STAVY[o.status]
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
                  {stav.text}
                </span>
                {o.roles.map(r => (
                  <span key={r} className="stitok">{r}</span>
                ))}
                <span className="tichy" style={{ fontSize: 13, marginLeft: "auto" }}>
                  {o.lastLoginAt ? formatDate(o.lastLoginAt, jazyk) : "neprihlásená"}
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
