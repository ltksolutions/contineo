/**
 * Nová organizácia (Fáza 5b, rozsah C).
 *
 * Zakladá sa najprv v `tenants` a až potom sa domény pridávajú do Vercelu —
 * zdroj pravdy je náš zápis a výpadok cudzieho API nesmie brániť organizáciu
 * založiť. Keď sa doména pridať nepodarí, povie sa to a doplní sa ručne.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { platformContext } from "@/lib/admin"
import { createTenantAction } from "../actions"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

export default async function NewTenantPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await platformContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { msg: message } = normalizeQuery<{ msg?: string }>(await searchParams)

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 620 }}>
      <p style={{ margin: "0 0 12px" }}>
        <Link href="/admin" className="tichy" style={{ fontSize: 14 }}>
          ← Správa tenantov
        </Link>
      </p>

      <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
        Nová organizácia
      </h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 20px" }}>
        Subdoména pod <code>contineo.app</code> funguje hneď — pokrýva ju
        wildcard. Vlastná doména zákazníka sa pridá do Vercelu automaticky
        a zostane mu nastaviť jeden <code>CNAME</code>.
      </p>

      {message && (
        <p className="karta" style={{ padding: "12px 16px", margin: "0 0 20px", fontSize: 14.5 }}>
          {message}
        </p>
      )}

      <form action={createTenantAction} className="karta admin-forma">
        <label className="pole">
          <span className="pole-popis">Kód organizácie</span>
          <input className="pole-vstup" name="companyCode" required />
          <span className="tichy pole-napoveda">
            Veľké písmená, číslice, pomlčka. Nesie ho každá osoba, dokument aj
            potvrdenie — <strong>neskôr sa nemení</strong>.
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">Názov</span>
          <input className="pole-vstup" name="displayName" required />
          <span className="tichy pole-napoveda">To, čo ľudia uvidia v hlavičke portálu.</span>
        </label>

        <label className="pole">
          <span className="pole-popis">Kontakt organizácie</span>
          <input className="pole-vstup" name="supportEmail" type="email" />
          <span className="tichy pole-napoveda">Sem pôjdu pokyny k doméne.</span>
        </label>

        <label className="pole">
          <span className="pole-popis">Domény</span>
          <textarea className="pole-vstup" name="hostnames" rows={3} placeholder="klub.contineo.app" />
          <span className="tichy pole-napoveda">
            Jedna na riadok. Bez domény sa portál organizácie nikde neukáže.
          </span>
        </label>

        <button className="tlacidlo" type="submit">Založiť</button>
      </form>
    </div>
  )
}
