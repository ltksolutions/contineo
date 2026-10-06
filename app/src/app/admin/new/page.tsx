/**
 * Nová organizácia (Fáza 5b, rozsah C).
 *
 * Zakladá sa najprv v `tenants` a až potom sa domény pridávajú do Vercelu —
 * zdroj pravdy je náš zápis a výpadok cudzieho API nesmie brániť organizáciu
 * založiť. Keď sa doména pridať nepodarí, povie sa to a doplní sa ručne.
 */

import { notFound, redirect } from "next/navigation"
import { platformContext, tenantOverviews } from "@/lib/admin"
import CompanyCodeField from "@/components/CompanyCodeField"
import { createTenantAction } from "../actions"
import { normalizeQuery, hrefWithout, type RawQuery } from "@/lib/urlParams"
import Notice from "@/components/Notice"
import { dictionary } from "@/lib/i18n"
import AppShell from "@/components/AppShell"
import SubmitButton from "@/components/SubmitButton"

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

  const raw = await searchParams
  const q = normalizeQuery<{ msg?: string; error?: string; companyCode?: string; displayName?: string }>(raw)
  const t = dictionary(ctx.person.language).admin.create

  // Obsadené kódy sa načítajú **raz, pri otvorení** — kolízia sa tak dá
  // ukázať pri písaní bez nového API a bez dotazu pri každom údere. Zoznam
  // môže byť starý o dĺžku otvorenia formulára; poslednou bránou je zápis.
  const usedCodes = (await tenantOverviews()).map(o => o.companyCode)

  return (
    <AppShell language={ctx.person.language} title={t.heading}>
    <div style={{ maxWidth: 620 }}>
      <h1 className="page-title">{t.heading}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 20px" }}>
        {t.introBefore}<code>contineo.app</code>{t.introMiddle}<code>CNAME</code>{t.introAfter}
      </p>

      {/* Kód a názov, ktoré akcia vrátila v adrese, po potvrdení ostanú. */}
      <Notice language={ctx.person.language} message={q.msg} error={q.error === "1"} back={hrefWithout("/admin/new", raw, ["msg", "error"])} />

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

        <SubmitButton className="button">{t.submit}</SubmitButton>
      </form>
    </div>
    </AppShell>
  )
}
