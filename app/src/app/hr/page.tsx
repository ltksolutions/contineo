/**
 * HR prehľad — čo je v organizácii nevybavené (D33).
 *
 * Opak widgetu na úvodnej strane: ten ukazuje „čo čaká na mňa", tento „ako je
 * na tom organizácia". Preto je za inou rolou (D36) a na doméne, ktorá tejto
 * organizácii patrí (D29, D32).
 *
 * Čísla sa **počítajú pri zobrazení**. Uložený súčet je druhá kópia pravdy
 * a rozíde sa s ňou práve vtedy, keď na nej niekomu záleží (D27).
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { hrContext } from "@/lib/hr"
import { assignmentOverviews, audienceLabel } from "@/lib/assignments"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate } from "@/lib/i18n"
import Notice from "@/components/Notice"
import { revokeAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function HrOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ sprava?: string; chyba?: string }>
}) {
  const ctx = await hrContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { sprava: message, chyba: error } = await searchParams
  const overview = await assignmentOverviews(ctx.person.companyCode)
  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 860, ...tenantStyle(branding) }}>
      <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
        Pridelené normy
      </h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 18px", maxWidth: 620 }}>
        Čo bolo komu uložené a kto to už potvrdil. Počty sa počítajú pri
        zobrazení — a týkajú sa ľudí, ktorí do skupiny patria <em>dnes</em>.
      </p>

      <Notice sprava={message} chyba={error === "1"} spat="/hr" />

      <p style={{ margin: "0 0 24px" }}>
        <Link className="tlacidlo" href="/hr/pridelit">Prideliť normu</Link>
      </p>

      {overview.length === 0 ? (
        <p className="karta" style={{ padding: 20, fontSize: 15 }}>
          Zatiaľ nie je pridelené nič. Kým sa norma nepridelí, ľuďom sa objaví
          len vtedy, keď je krokom ich trasy — a nikde nezostane stopa, kedy sa
          to stalo a prečo.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
          {overview.map(p => {
            const error = p.osob - p.potvrdili
            return (
              <li key={p.id} className="karta" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <Link
                    href={`/hr/${encodeURIComponent(p.id)}`}
                    style={{ fontSize: 16.5, fontWeight: 700, textDecoration: "none" }}
                  >
                    {p.subject.documentTitle}
                  </Link>
                  <span className="stitok">verzia {p.subject.versionLabel}</span>
                </div>

                <p className="tichy" style={{ fontSize: 13.5, margin: "8px 0 0" }}>
                  {audienceLabel(p.audience)} · pridelil {p.assignedBy} ·{" "}
                  {formatDate(p.assignedAt, language)}
                </p>

                {/* Dôvod je to, čím sa uzatvára D30 — nie ozdoba, ale jediné
                    miesto, kde je napísané, prečo sa norma potvrdzuje znova. */}
                <p style={{ fontSize: 14.5, margin: "10px 0 0", lineHeight: 1.55 }}>
                  {p.reason}
                </p>

                <div className="admin-udaje">
                  <div>
                    <div className="tichy" style={{ fontSize: 12.5 }}>Potvrdili</div>
                    <div style={{ fontSize: 15.5, fontWeight: 600 }}>
                      {p.potvrdili} / {p.osob}
                    </div>
                  </div>
                  <div>
                    <div className="tichy" style={{ fontSize: 12.5 }}>Dali sme vedieť</div>
                    <div style={{ fontSize: 15.5, fontWeight: 600, color: p.oznamene ? undefined : "var(--muted)" }}>
                      {p.oznamene
                        ? `${formatDate(p.oznamene.at, language)}${p.oznameniSpolu > 1 ? ` · ${p.oznameniSpolu}×` : ""}`
                        : "nie"}
                    </div>
                  </div>
                  <div>
                    <div className="tichy" style={{ fontSize: 12.5 }}>Chýba</div>
                    <div
                      style={{
                        fontSize: 15.5,
                        fontWeight: 600,
                        color: error > 0 ? "var(--warn-fg)" : "var(--muted)",
                      }}
                    >
                      {error === 0 ? "nikto" : `${error}`}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  {/* Dať vedieť je samostatné rozhodnutie, nie vedľajší účinok
                      pridelenia — preto odkaz na náhľad, nie tlačidlo „poslať". */}
                  {error > 0 && (
                    <Link className="tlacidlo tlacidlo--tiche" href={`/hr/${encodeURIComponent(p.id)}/oznamit`}>
                      Dať vedieť e-mailom
                    </Link>
                  )}
                  <form action={revokeAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="tlacidlo tlacidlo--tiche" type="submit">
                      Odvolať pridelenie
                    </button>
                  </form>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
