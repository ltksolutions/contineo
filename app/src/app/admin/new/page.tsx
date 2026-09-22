/**
 * Nová organizácia (Fáza 5b, rozsah C).
 *
 * Zakladá sa najprv v `tenants` a až potom sa domény pridávajú do Vercelu —
 * zdroj pravdy je náš zápis a výpadok cudzieho API nesmie brániť organizáciu
 * založiť. Keď sa doména pridať nepodarí, povie sa to a doplní sa ručne.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { platformContext, tenantOverviews } from "@/lib/admin"
import CompanyCodeField from "@/components/CompanyCodeField"
import { createTenantAction } from "../actions"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary } from "@/lib/i18n"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

export default async function NewTenantPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await platformContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const q = normalizeQuery<{ msg?: string; companyCode?: string; displayName?: string }>(await searchParams)
  const t = dictionary(ctx.person.language).admin.create

  // Obsadené kódy sa načítajú **raz, pri otvorení** — kolízia sa tak dá
  // ukázať pri písaní bez nového API a bez dotazu pri každom údere. Zoznam
  // môže byť starý o dĺžku otvorenia formulára; poslednou bránou je zápis.
  const usedCodes = (await tenantOverviews()).map(o => o.companyCode)

  return (
    <AppShell language={ctx.person.language}>
    <div style={{ maxWidth: 620 }}>
      <p style={{ margin: "0 0 12px" }}>
        <Link href="/admin" className="quiet" style={{ fontSize: "var(--fs-body)" }}>
          {t.back}
        </Link>
      </p>

      <h1 className="page-title">{t.heading}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 20px" }}>
        {t.introBefore}<code>contineo.app</code>{t.introMiddle}<code>CNAME</code>{t.introAfter}
      </p>

      {q.msg && (
        <p className="card" style={{ padding: "12px 16px", margin: "0 0 20px", fontSize: "var(--fs-body)" }}>
          {q.msg}
        </p>
      )}

      <form action={createTenantAction} className="card admin-form">
        {/*
          Názov je prvý a kód z neho vzniká (ADR-010, ADMIN úloha 1.4):
          poradie polí hovorí, čo z čoho plynie. Bez skriptu sú to dve
          obyčajné povinné polia a formulár sa odošle rovnako.
        */}
        <CompanyCodeField
          usedCodes={usedCodes}
          initialName={q.displayName ?? ""}
          initialCode={q.companyCode ?? ""}
          labels={{
            name: t.name,
            nameNote: t.nameNote,
            code: t.code,
            codeNote: t.codeNoteBefore,
            codeNoteHighlight: t.codeNoteHighlight,
            codeNoteAfter: t.codeNoteAfter,
            taken: t.codeTaken,
          }}
        />

        <label className="field">
          <span className="field-label">{t.supportEmail}</span>
          <input className="field-input" name="supportEmail" type="email" />
          <span className="quiet field-hint">{t.supportEmailNote}</span>
        </label>

        <label className="field">
          <span className="field-label">{t.domains}</span>
          <textarea className="field-input" name="hostnames" rows={3} placeholder={t.domainsPlaceholder} />
          <span className="quiet field-hint">{t.domainsNote}</span>
        </label>

        <button className="button" type="submit">{t.submit}</button>
      </form>
    </div>
    </AppShell>
  )
}
