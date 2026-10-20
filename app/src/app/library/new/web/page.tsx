/**
 * Predpis zo Slov-Lexu do knižnice (ADR-037, krok B).
 *
 * Dva kroky na jednej stránke ako pri importe z konektora: **načítanie**
 * je `GET` (adresa predpisu v adrese stránky — dá sa poslať odkazom
 * a funguje bez skriptu) a ukáže, čo sa našlo: názov, znenie účinné dnes,
 * neskoršie vyhlásené znenia a či predpis v knižnici už je. **Import** je
 * `POST` s metadátami; vznikne koncept so záväzným PDF zo Slov-Lexu
 * a textom na vyhľadávanie (D243).
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import Notice from "@/components/Notice"
import Select from "@/components/Select"
import ValueSelect, { withCodelistNote } from "@/components/ValueSelect"
import SubmitButton from "@/components/SubmitButton"
import AppShell from "@/components/AppShell"
import { libraryContext } from "@/lib/library"
import { codelistOptions } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { tagOptions } from "@/lib/libraryRead"
import { allDepartments, flattenTree } from "@/lib/departments"
import { allFolders, flattenTree as flattenFolders } from "@/lib/folders"
import { treeOptions } from "@/lib/treeOptions"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, errorText, formatDate } from "@/lib/i18n"
import { previewSlovLex, type WebPreview } from "@/lib/webImport"
import { AppError } from "@/lib/appError"
import { importWebDocumentAction } from "../../actions"

export const dynamic = "force-dynamic"

export default async function WebImportPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const q = normalizeQuery<{ address?: string; msg?: string; error?: string }>(await searchParams)
  const language = ctx.person.language
  const t = dictionary(language).library.webImport
  const tci = dictionary(language).library.connectorImport
  const tu = dictionary(language).library.upload
  const tf = dictionary(language).library.fields
  const tl = dictionary(language).library.list
  const extras = tenantExtras(ctx.tenant)
  const branding = brandingView(ctx.tenant)
  const companyCode = ctx.tenant.companyCode
  const address = (q.address ?? "").trim()

  let preview: WebPreview | null = null
  let loadError: string | null = null
  if (address) {
    try {
      preview = await previewSlovLex(companyCode, address)
    } catch (e) {
      if (!(e instanceof AppError)) console.error("[web-import] načítanie zlyhalo:", e)
      loadError = errorText(e, language)
    }
  }

  const [departmentRows, folders, tags] = await Promise.all([
    flattenTree(await allDepartments(companyCode)),
    allFolders(companyCode),
    tagOptions(companyCode, extras),
  ])
  const folderOptions = treeOptions(flattenFolders(folders).map(r => ({ id: r.folder.id, name: r.folder.name, level: r.level })))
  const categories = codelistOptions("category", extras)
  // Zákon je predvolený druh — na to táto cesta vznikla; keď ho organizácia nemá, prvý v zozname.
  const defaultCategory = categories.find(c => c.value === "zakon")?.value ?? categories[0]?.value ?? ""
  const self = `/library/new/web${address ? `?${new URLSearchParams({ address }).toString()}` : ""}`
  const date = (iso: string) => formatDate(new Date(iso), language)

  return (
    <AppShell language={language} title={t.heading} trail={{ "/library/new": tu.heading }}>
    <div style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <h1 className="page-title">{t.heading}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 20px" }}>{t.intro}</p>
      <Notice message={q.msg ?? (q.error ? `${t.errorBefore}${q.error}` : undefined)} error={Boolean(q.error)} back={self} language={language} />

      {/* Načítanie — GET, adresa predpisu v adrese stránky. */}
      <form method="get" action="/library/new/web" className="card upload-section" style={{ display: "grid", gap: 14, marginBottom: 20 }}>
        <label className="field">
          <span className="field-label">{t.address}</span>
          <input className="field-input" type="text" name="address" defaultValue={address} placeholder={t.addressPlaceholder} required autoComplete="off" />
          <span className="quiet field-hint">{t.addressHint}</span>
        </label>
        <div>
          <SubmitButton className="button button--quiet">{t.load}</SubmitButton>
        </div>
      </form>

      {loadError && <p className="quiet" role="alert">{t.errorBefore}{loadError}</p>}

      {preview && (
        <form action={importWebDocumentAction} className="upload-form">
          <input type="hidden" name="address" value={address} />
          <section className="form-group form-group--lg">
            <h2 className="form-group-head form-group-head--step"><span className="assign-step" aria-hidden="true">1</span>{t.found}</h2>
            <div className="card form-group-body" style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>{preview.title}</span>
              <span className="quiet">{t.number}: {preview.number} · {t.effectiveSince(date(preview.current.effectiveFrom))}</span>
              {preview.later.length > 0 && (
                <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>
                  {t.later(preview.later.length)} {preview.later.map(r => t.laterRow(date(r.effectiveFrom), r.amendment)).join("; ")}
                </span>
              )}
              {preview.existing && (
                <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>
                  {t.exists}{" "}
                  <Link href={`/library/${encodeURIComponent(preview.existing.documentId)}`}>{t.open}</Link>
                </span>
              )}
            </div>
          </section>

          {!preview.existing && (
            <>
              <section className="form-group form-group--lg">
                <h2 className="form-group-head form-group-head--step"><span className="assign-step" aria-hidden="true">2</span>{tu.sectionMeta}</h2>
                <div className="card form-group-body">
                  <p className="quiet" style={{ margin: "0 0 12px" }}>{t.metaNote}</p>
                  <div className="upload-grid">
                    <div className="field">
                      <span className="field-label">{tci.folder}</span>
                      <Select language={language} name="folderId" fieldLabel={tci.folder} initial="" options={[{ value: "", label: tci.folderNone }, ...folderOptions]} />
                    </div>
                    <div className="field">
                      <span className="field-label">{tl.category}</span>
                      <Select language={language} name="category" fieldLabel={tl.category} initial={defaultCategory} options={categories} />
                    </div>
                    <div className="field">
                      <span className="field-label">{tu.accessLevel}</span>
                      {/* Zákon je verejný — každý si ho prečíta aj na Slov-Lexe. */}
                      <Select language={language} name="accessLevel" options={codelistOptions("accessLevel")} initial="public" fieldLabel={tu.accessLevel} />
                    </div>
                    <div className="field">
                      <span className="field-label">{tu.documentLanguage}</span>
                      <Select language={language} name="language" options={codelistOptions("language")} initial="sk" fieldLabel={tu.documentLanguage} />
                    </div>
                    <div className="field">
                      <span className="field-label">{tf.ownerDepartment}</span>
                      <Select language={language} name="ownerDepartmentId" initial="" fieldLabel={tf.ownerDepartment}
                        options={[{ value: "", label: tf.ownerDepartmentNone }, ...treeOptions(departmentRows.map(r => ({ id: r.department.id, name: r.department.name, level: r.level })))]} />
                    </div>
                    <div className="upload-wide">
                      <ValueSelect kind="tags" name="tags" legend={tu.tags} selected={[]} language={language}
                                   options={withCodelistNote(tags, language)} />
                    </div>
                  </div>
                </div>
              </section>
              {/* Odoslanie po náhľade — plné tlačidlo na konci (R2). */}
              <div className="upload-submit">
                <SubmitButton className="button">{t.import}</SubmitButton>
              </div>
              <p className="quiet field-hint">{t.afterNote}</p>
            </>
          )}
        </form>
      )}
    </div>
    </AppShell>
  )
}
