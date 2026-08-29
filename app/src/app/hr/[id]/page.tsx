/**
 * Detail pridelenia — kto z publika ešte nepotvrdil.
 *
 * Menovite, nie číslom. Číslo („chýba 17") sa dá pozerať mesiace a nedá sa
 * s ním nič spraviť; zoznam mien je to, na základe čoho niekto zdvihne telefón.
 *
 * Je to zároveň najcitlivejšia obrazovka v systéme: ukazuje, kto si čo
 * neprečítal. Preto je za rolou `hr` **v rámci vlastnej organizácie** a
 * správca platformy sa sem nedostane (D32, D41).
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { hrContext } from "@/lib/hr"
import { assignmentOverviews, nepotvrdili, audienceLabel } from "@/lib/assignments"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function DetailPridelenia({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await hrContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { id } = await params
  const kod = ctx.person.companyCode

  // Prehľad nesie kópiu údajov o pridelení; načítať ho cez ten istý zoznam
  // znamená, že sa nikde nepočíta druhýkrát niečo, čo prehľad už spočítal.
  const pridelenie = (await assignmentOverviews(kod)).find(p => p.id === id)
  // Neexistuje vs. patrí inému tenantovi je zámerne tá istá odpoveď —
  // inak by sa skúšaním identifikátorov dalo zistiť, čo prideľujú iní.
  if (!pridelenie) notFound()

  const chybajuci = await nepotvrdili(kod, id)
  const branding = brandingView(ctx.tenant)
  const jazyk = ctx.person.language

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 720, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href="/hr" style={{ fontSize: 14 }}>← Späť na prehľad</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
        {pridelenie.subject.documentTitle}
      </h1>
      <p className="tichy" style={{ fontSize: 14, margin: "0 0 4px" }}>
        verzia {pridelenie.subject.versionLabel}
        {pridelenie.subject.effectiveFrom &&
          `, platná od ${formatDate(pridelenie.subject.effectiveFrom, jazyk)}`}
      </p>
      <p className="tichy" style={{ fontSize: 14, margin: "0 0 18px" }}>
        {audienceLabel(pridelenie.audience)} · pridelil {pridelenie.assignedBy} ·{" "}
        {formatDate(pridelenie.assignedAt, jazyk)}
      </p>

      <p className="karta" style={{ padding: "14px 18px", margin: "0 0 24px", fontSize: 15, lineHeight: 1.6 }}>
        {pridelenie.reason}
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 10px" }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>
          Nepotvrdili ({chybajuci.length} z {pridelenie.osob})
        </h2>
        {chybajuci.length > 0 && (
          <Link href={`/hr/${encodeURIComponent(id)}/oznamit`} style={{ fontSize: 14 }}>
            dať im vedieť e-mailom →
          </Link>
        )}
      </div>

      {chybajuci.length === 0 ? (
        <p className="karta" style={{ padding: 18, fontSize: 15 }}>
          Potvrdili všetci, ktorých sa pridelenie dnes týka.
        </p>
      ) : (
        <ul className="admin-domeny">
          {chybajuci.map(o => (
            <li key={o.id} className="karta" style={{ padding: "12px 16px" }}>
              <div style={{ fontWeight: 600 }}>{o.fullName}</div>
              <div className="tichy" style={{ fontSize: 13.5 }}>{o.email}</div>
            </li>
          ))}
        </ul>
      )}

      <p className="tichy" style={{ fontSize: 13, marginTop: 18, maxWidth: 560 }}>
        Zoznam sa počíta pri zobrazení a týka sa ľudí, ktorí do publika patria
        dnes. Kto medzitým z organizácie odišiel, tu nie je — jeho potvrdenie
        (alebo jeho chýbanie) však zostáva v záznamoch.
      </p>
    </div>
  )
}
