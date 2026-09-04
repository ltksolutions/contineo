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
import { dictionary } from "@/lib/i18n"

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
  const t = dictionary(ctx.person.language).admin.create

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 620 }}>
      <p style={{ margin: "0 0 12px" }}>
        <Link href="/admin" className="tichy" style={{ fontSize: 14 }}>
          {t.back}
        </Link>
      </p>

      <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{t.heading}</h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 20px" }}>
        {t.introBefore}<code>contineo.app</code>{t.introMiddle}<code>CNAME</code>{t.introAfter}
      </p>

      {message && (
        <p className="karta" style={{ padding: "12px 16px", margin: "0 0 20px", fontSize: 14.5 }}>
          {message}
        </p>
      )}

      <form action={createTenantAction} className="karta admin-forma">
        <label className="pole">
          <span className="pole-popis">{t.code}</span>
          <input className="pole-vstup" name="companyCode" required />
          <span className="tichy pole-napoveda">
            {t.codeNoteBefore}<strong>{t.codeNoteHighlight}</strong>{t.codeNoteAfter}
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">{t.name}</span>
          <input className="pole-vstup" name="displayName" required />
          <span className="tichy pole-napoveda">{t.nameNote}</span>
        </label>

        <label className="pole">
          <span className="pole-popis">{t.supportEmail}</span>
          <input className="pole-vstup" name="supportEmail" type="email" />
          <span className="tichy pole-napoveda">{t.supportEmailNote}</span>
        </label>

        <label className="pole">
          <span className="pole-popis">{t.domains}</span>
          <textarea className="pole-vstup" name="hostnames" rows={3} placeholder={t.domainsPlaceholder} />
          <span className="tichy pole-napoveda">{t.domainsNote}</span>
        </label>

        <button className="tlacidlo" type="submit">{t.submit}</button>
      </form>
    </div>
  )
}
