/**
 * Založenie FAQ (ADR-028, D164).
 *
 * Na rozdiel od `/library/new` tu nie je súbor: FAQ sa píše v aplikácii a
 * PDF aj text znenia sa skladajú zo záznamov (`lib/faq.ts`). Ostatné
 * metadáta sú tie isté a overujú sa proti tým istým číselníkom — FAQ je
 * dokument knižnice, nie iný druh veci.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import Notice from "@/components/Notice"
import KeyPreview from "@/components/KeyPreview"
import Select from "@/components/Select"
import ValueSelect, { withCodelistNote } from "@/components/ValueSelect"
import AppShell from "@/components/AppShell"
import { libraryContext } from "@/lib/library"
import { codelistOptions } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { tagOptions } from "@/lib/libraryRead"
import { allDepartments, flattenTree } from "@/lib/departments"
import { treeOptions } from "@/lib/treeOptions"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary } from "@/lib/i18n"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { createFaqAction } from "../../actions"

export const dynamic = "force-dynamic"

export default async function NewFaqPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { error, title, documentKey } = normalizeQuery<{ error?: string; title?: string; documentKey?: string }>(await searchParams)
  const language = ctx.person.language
  const t = dictionary(language).library.faq
  const tu = dictionary(language).library.upload
  const tf = dictionary(language).library.fields
  const extras = tenantExtras(ctx.tenant)
  const branding = brandingView(ctx.tenant)
  const departmentRows = flattenTree(await allDepartments(ctx.tenant.companyCode))
  const usedKeys = (await (await getCollection(DOCUMENTS_COLLECTION))
    .find({ companyCode: ctx.tenant.companyCode }, { projection: { documentKey: 1 } })
    .toArray() as unknown as { documentKey?: string }[])
    .map(d => d.documentKey ?? "").filter(Boolean).sort()

  return (
    <AppShell language={language} title={t.newHeading}>
    <div style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <h1 className="page-title">{t.newHeading}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 20px" }}>{t.newIntro}</p>
      <Notice message={error ? `${tu.errorBefore}${error}` : undefined} error back="/library/new/faq" language={language} />

      <form action={createFaqAction} className="upload-form">
        <section className="card upload-section">
          <div className="upload-grid">
            <KeyPreview
              prefix={ctx.tenant.companyCode.toLowerCase()}
              usedKeys={usedKeys}
              initialTitle={title ?? ""}
              initialKey={documentKey ?? ""}
              labels={{
                title: tu.title, titlePlaceholder: tu.titlePlaceholder, titleNote: tu.titleNote,
                preview: tu.keyPreview, manualSummary: tu.keyManualSummary, manualLabel: tu.key,
                manualNote: tu.keyManualNote, taken: tu.keyTaken, keysTaken: tu.keysTaken,
              }}
            />
            <div className="field">
              <span className="field-label">{tu.accessLevel}</span>
              <Select language={language} name="accessLevel" options={codelistOptions("accessLevel")} initial="internal" fieldLabel={tu.accessLevel} />
              <span className="quiet field-hint">
                <code>internal</code>{tu.accessInternalNote}<code>public</code>{tu.accessPublicNote}
              </span>
            </div>
            <div className="field">
              <span className="field-label">{tu.documentLanguage}</span>
              <Select language={language} name="language" options={codelistOptions("language")} initial={ctx.tenant.defaultLanguage ?? "sk"} fieldLabel={tu.documentLanguage} />
            </div>
            <div className="field">
              <span className="field-label">{tf.ownerDepartment}</span>
              <Select language={language} name="ownerDepartmentId" initial="" fieldLabel={tf.ownerDepartment}
                options={[
                  { value: "", label: tf.ownerDepartmentNone },
                  ...treeOptions(departmentRows.map(r => ({ id: r.department.id, name: r.department.name, level: r.level }))),
                ]} />
            </div>
            <div className="upload-wide">
              <ValueSelect kind="tags" name="tags" legend={tu.tags} selected={[]} language={language}
                           options={withCodelistNote(await tagOptions(ctx.tenant.companyCode, extras), language)} />
            </div>
          </div>
        </section>
        <div className="upload-submit">
          <button className="button" type="submit">{t.create}</button>
          <Link className="button button--quiet" href="/library/new">{tu.heading}</Link>
        </div>
        <p className="quiet field-hint">{t.pdfNote}</p>
      </form>
    </div>
    </AppShell>
  )
}
