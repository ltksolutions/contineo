/**
 * Pozvanie jednej osoby.
 *
 * **Nič sa neodosiela.** Pozvanie je zápis do `persons`, nie e-mail: človek sa
 * prihlási vtedy, keď si sám vyžiada odkaz alebo klikne na pracovné konto.
 * Posielať mu odkaz dopredu by znamenalo, že vyprší skôr, než ho otvorí.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { peopleContext } from "@/lib/people"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { UI_LANGUAGES } from "@/lib/i18n"
import Vyber from "@/components/Vyber"
import { pozviOsobu } from "../akcie"

/** Kód jazyka sám o sebe nepovie nič — „sk" je pre nás jasné, pre iných nie. */
const JAZYKY: Record<string, string> = {
  sk: "slovenčina",
  cs: "čeština",
  en: "angličtina",
}

export const dynamic = "force-dynamic"

export default async function NovaOsoba({
  searchParams,
}: {
  searchParams: Promise<{ chyba?: string; email?: string; fullName?: string; department?: string }>
}) {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const q = await searchParams
  const branding = brandingView(ctx.tenant)

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 560, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href="/osoby" style={{ fontSize: 14 }}>← Späť na zoznam</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Pozvať osobu</h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 20px" }}>
        Zapíše sa do organizácie <strong>{ctx.tenant.companyCode}</strong>. Skupiny
        a trasy sa doplnia na jej detaile — po pozvaní tam prídeš rovno.
      </p>

      {q.chyba && (
        <p className="karta" style={{ padding: "12px 16px", margin: "0 0 18px", fontSize: 14.5, color: "var(--warn-fg)" }}>
          {q.chyba}
        </p>
      )}

      <form action={pozviOsobu} className="karta" style={{ padding: 20, display: "grid", gap: 16 }}>
        <label className="pole">
          <span className="pole-popis">E-mailová adresa</span>
          <input
            className="pole-vstup"
            name="email"
            type="email"
            required
            defaultValue={q.email ?? ""}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <span className="tichy pole-napoveda">
            Neskôr sa meniť nedá — je to kľúč, na ktorý sa naviažu potvrdenia
            aj prihlasovacie kontá. Skontroluj ju.
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">Meno</span>
          <input className="pole-vstup" name="fullName" required defaultValue={q.fullName ?? ""} />
        </label>

        <label className="pole">
          <span className="pole-popis">Útvar</span>
          <input className="pole-vstup" name="department" defaultValue={q.department ?? ""} />
        </label>

        <div className="pole">
          <span className="pole-popis">Typ osoby</span>
          <Vyber
            meno="personType"
            volby={[
              { hodnota: "employee", popis: "zamestnanec" },
              { hodnota: "external", popis: "externý" },
              { hodnota: "referee", popis: "rozhodca" },
              { hodnota: "official", popis: "funkcionár" },
            ]}
            predvolena="employee"
            popisPola="Typ osoby"
          />
        </div>

        <div className="pole">
          <span className="pole-popis">Jazyk prostredia</span>
          <Vyber
            meno="language"
            volby={UI_LANGUAGES.map(l => ({ hodnota: l, popis: JAZYKY[l] ?? l }))}
            predvolena="sk"
            popisPola="Jazyk prostredia"
          />
          <span className="tichy pole-napoveda">
            Skupiny a trasy sa vyberajú až na detaile — tam už vidno, čo
            v organizácii existuje.
          </span>
        </div>

        <div>
          <button className="tlacidlo" type="submit">Pozvať</button>
        </div>
      </form>
    </div>
  )
}
