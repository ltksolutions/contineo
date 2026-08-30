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
import { formatDate } from "@/lib/i18n"

export const dynamic = "force-dynamic"

function Fact({ popis: label, hodnota: value, tichy: muted }: { popis: string; hodnota: string; tichy?: boolean }) {
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

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 900 }}>
      <h1 style={{ fontSize: 27, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
        Správa tenantov
      </h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 16px", maxWidth: 640 }}>
        Prehľad organizácií na platforme. Čísla sa počítajú pri zobrazení, nikde
        sa neukladajú. Obsah organizácií — dokumenty a potvrdenia — táto rola
        nesprístupňuje.
      </p>

      <p style={{ margin: "0 0 24px" }}>
        <Link className="tlacidlo" href="/admin/novy">Nová organizácia</Link>
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
        {overview.map(t => (
          <li key={t.companyCode} className="karta" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <Link
                href={`/admin/tenanti/${encodeURIComponent(t.companyCode)}`}
                style={{ fontSize: 17, fontWeight: 700, textDecoration: "none" }}
              >
                {t.displayName}
              </Link>
              <span className="stitok">{t.companyCode}</span>
              {t.status !== "active" && (
                <span className="stitok" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
                  vypnutý
                </span>
              )}
              <span className="tichy" style={{ fontSize: 13, marginLeft: "auto" }}>
                {t.languages.join(" · ")}
              </span>
            </div>

            <p className="tichy" style={{ fontSize: 13.5, margin: "8px 0 0", overflowWrap: "anywhere" }}>
              {t.hostnames.join(", ") || "žiadna doména — portál sa nikde neukáže"}
            </p>

            <div className="admin-udaje">
              <Fact
                popis="Osoby"
                hodnota={`${t.osoby.prihlaseni} / ${t.osoby.spolu} prihlásených`}
                tichy={t.osoby.spolu === 0}
              />
              <Fact popis="Trasy" hodnota={String(t.trasy)} tichy={t.trasy === 0} />
              <Fact
                popis="Dokumenty"
                hodnota={`${t.dokumenty.spolu - t.dokumenty.bezZnenia.length} / ${t.dokumenty.spolu} platných`}
                tichy={t.dokumenty.spolu === 0}
              />
              <Fact popis="Potvrdenia" hodnota={String(t.potvrdenia)} tichy={t.potvrdenia === 0} />
            </div>

            {/* Dokumenty bez platného znenia sú menovite. Je to najčastejšia
                tichá príčina, prečo človek v zozname nič nevidí (D6) — a bez
                mena sa nedá povedať, ktorý z nich opraviť. */}
            {t.dokumenty.bezZnenia.length > 0 && (
              <p style={{ margin: "12px 0 0", fontSize: 13.5 }}>
                <span className="stitok" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
                  bez platného znenia
                </span>{" "}
                <span className="tichy">{t.dokumenty.bezZnenia.join(", ")}</span>
              </p>
            )}

            {t.pokynyPoslane && (
              <p className="tichy" style={{ margin: "10px 0 0", fontSize: 13 }}>
                Pokyny k doméne poslané {formatDate(t.pokynyPoslane.kedy, "sk")} na{" "}
                {t.pokynyPoslane.komu}
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="tichy" style={{ fontSize: 13, marginTop: 20 }}>
        Stav domén vo Verceli ukáže <code>npm run domains</code>; do obrazovky
        pribudne v rozsahu C spolu so zakladaním tenantov.
      </p>
    </div>
  )
}
