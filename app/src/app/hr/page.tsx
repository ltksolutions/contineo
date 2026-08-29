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
import { odvolat } from "./akcie"

export const dynamic = "force-dynamic"

export default async function HrPrehlad({
  searchParams,
}: {
  searchParams: Promise<{ sprava?: string }>
}) {
  const ctx = await hrContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { sprava } = await searchParams
  const prehlad = await assignmentOverviews(ctx.person.companyCode)
  const branding = brandingView(ctx.tenant)
  const jazyk = ctx.person.language

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 860, ...tenantStyle(branding) }}>
      <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
        Pridelené normy
      </h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 18px", maxWidth: 620 }}>
        Čo bolo komu uložené a kto to už potvrdil. Počty sa počítajú pri
        zobrazení — a týkajú sa ľudí, ktorí do skupiny patria <em>dnes</em>.
      </p>

      {sprava && (
        <p className="karta" style={{ padding: "12px 16px", margin: "0 0 18px", fontSize: 14.5 }}>
          {sprava}
        </p>
      )}

      <p style={{ margin: "0 0 24px" }}>
        <Link className="tlacidlo" href="/hr/pridelit">Prideliť normu</Link>
      </p>

      {prehlad.length === 0 ? (
        <p className="karta" style={{ padding: 20, fontSize: 15 }}>
          Zatiaľ nie je pridelené nič. Kým sa norma nepridelí, ľuďom sa objaví
          len vtedy, keď je krokom ich trasy — a nikde nezostane stopa, kedy sa
          to stalo a prečo.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
          {prehlad.map(p => {
            const chyba = p.osob - p.potvrdili
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
                  {formatDate(p.assignedAt, jazyk)}
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
                    <div className="tichy" style={{ fontSize: 12.5 }}>Chýba</div>
                    <div
                      style={{
                        fontSize: 15.5,
                        fontWeight: 600,
                        color: chyba > 0 ? "var(--warn-fg)" : "var(--muted)",
                      }}
                    >
                      {chyba === 0 ? "nikto" : `${chyba}`}
                    </div>
                  </div>
                </div>

                <form action={odvolat} style={{ marginTop: 14 }}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="tlacidlo tlacidlo--tiche" type="submit">
                    Odvolať pridelenie
                  </button>
                </form>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
