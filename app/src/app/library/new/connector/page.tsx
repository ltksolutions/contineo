/**
 * Import článkov z MCP konektora (ADR-029, použitie B).
 *
 * Dva kroky na jednej stránke: **hľadanie** je `GET` (stav v adrese:
 * konektor, rozsah, otázka — dá sa poslať odkazom a funguje bez skriptu),
 * **import** je `POST` s vybranými článkami a metadátami. Server nemá
 * zoznam súborov, preto sa vyberá z výsledkov hľadania, nie zo stromu.
 *
 * Z každého vybraného článku vznikne koncept dokumentu; čo už v knižnici
 * z tej istej cesty je, zoznam ukáže (a či sa na serveri odvtedy zmenilo).
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import Notice from "@/components/Notice"
import Select from "@/components/Select"
import ValueSelect, { withCodelistNote } from "@/components/ValueSelect"
import SubmitButton from "@/components/SubmitButton"
import SearchStrip from "@/components/SearchStrip"
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
import { dictionary, errorText } from "@/lib/i18n"
import { listConnectors } from "@/lib/connectors"
import { profileFor } from "@/lib/mcp/profiles"
import { searchForImport, type ImportCandidate } from "@/lib/connectorImport"
import { connectorCallbackUrl } from "@/lib/mcp/callbackUrl"
import { AppError } from "@/lib/appError"
import { importConnectorArticlesAction } from "../../actions"

export const dynamic = "force-dynamic"

export default async function ConnectorImportPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const q = normalizeQuery<{ connector?: string; scope?: string; q?: string; msg?: string; error?: string }>(await searchParams)
  const language = ctx.person.language
  const t = dictionary(language).library.connectorImport
  const tu = dictionary(language).library.upload
  const tf = dictionary(language).library.fields
  const tl = dictionary(language).library.list
  const extras = tenantExtras(ctx.tenant)
  const branding = brandingView(ctx.tenant)
  const companyCode = ctx.tenant.companyCode

  const connectors = (await listConnectors(companyCode)).filter(c => c.uses.ingest.enabled && c.status === "connected" && profileFor(c.profile).fetch)
  const connector = connectors.find(c => c.id === q.connector) ?? connectors[0] ?? null
  const scopeKey = connector?.scopes.some(s => s.key === q.scope) ? q.scope! : (connector?.scopes[0]?.key ?? "")
  const query = (q.q ?? "").trim()

  let candidates: ImportCandidate[] = []
  let searchError: string | null = null
  if (connector && query) {
    try {
      candidates = await searchForImport(companyCode, connector.id, query, scopeKey, await connectorCallbackUrl(), {
        actor: { personId: ctx.person.id, personName: ctx.person.fullName },
      })
    } catch (e) {
      if (!(e instanceof AppError)) console.error("[import] hľadanie zlyhalo:", e)
      searchError = errorText(e, language)
    }
  }

  const [departmentRows, folders, tags] = await Promise.all([
    flattenTree(await allDepartments(companyCode)),
    allFolders(companyCode),
    tagOptions(companyCode, extras),
  ])
  const folderOptions = treeOptions(flattenFolders(folders).map(r => ({ id: r.folder.id, name: r.folder.name, level: r.level })))
  const self = `/library/new/connector?${new URLSearchParams({ ...(connector ? { connector: connector.id } : {}), ...(scopeKey ? { scope: scopeKey } : {}), ...(query ? { q: query } : {}) }).toString()}`

  return (
    <AppShell language={language} title={t.heading} trail={{ "/library/new": tu.heading }}>
    <div style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <h1 className="page-title">{t.heading}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 20px" }}>{t.intro}</p>
      <Notice message={q.msg ?? (q.error ? `${t.errorBefore}${q.error}` : undefined)} error={Boolean(q.error)} back={self} language={language} />

      {connectors.length === 0 ? (
        <p className="quiet">{t.noConnector} <Link href="/organisation/connectors">{t.noConnectorLink}</Link></p>
      ) : (
        <>
          {/* Hľadanie — GET, stav v adrese. */}
          <form method="get" action="/library/new/connector" className="card upload-section" style={{ display: "grid", gap: 14, marginBottom: 20 }}>
            <div className="upload-grid">
              <div className="field">
                <span className="field-label">{t.connector}</span>
                <Select language={language} name="connector" fieldLabel={t.connector} initial={connector?.id ?? ""} options={connectors.map(c => ({ value: c.id, label: c.name }))} />
              </div>
              {connector && connector.scopes.length > 0 && (
                <div className="field">
                  <span className="field-label">{t.scope}</span>
                  <Select language={language} name="scope" fieldLabel={t.scope} initial={scopeKey} options={connector.scopes.map(s => ({ value: s.key, label: s.label }))} />
                </div>
              )}
            </div>
            <SearchStrip name="q" defaultValue={query} placeholder={t.queryPlaceholder} label={t.query} submitLabel={t.search} />
            <span className="quiet field-hint">{t.queryHint}</span>
          </form>

          {searchError && <p className="quiet" role="alert">{t.errorBefore}{searchError}</p>}

          {connector && query && !searchError && (
            candidates.length === 0 ? (
              <p className="quiet">{t.nothingFound}</p>
            ) : (
              <form action={importConnectorArticlesAction} className="upload-form">
                <input type="hidden" name="connectorId" value={connector.id} />
                <input type="hidden" name="back" value={self} />
                <section className="form-group form-group--lg">
                  <h2 className="form-group-head form-group-head--step"><span className="assign-step" aria-hidden="true">1</span>{t.pick(candidates.length)}</h2>
                  <div className="card form-group-body" style={{ display: "grid", gap: 10 }}>
                    {candidates.map(c => (
                      <label key={c.externalId} className="form-row form-row--bare" style={{ alignItems: "flex-start", gap: 10 }}>
                        <input type="checkbox" name="externalId" value={c.externalId} defaultChecked={!c.existingDocumentId || c.changed} />
                        <span style={{ display: "grid", gap: 2 }}>
                          <span style={{ fontWeight: 600 }}>{c.title}{c.group ? <span className="quiet"> · {c.group}</span> : null}</span>
                          <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>{c.excerpt}</span>
                          <code className="quiet" style={{ fontSize: "var(--fs-micro)" }}>{c.externalId}</code>
                          {c.existingDocumentId && (
                            <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>
                              {c.changed ? t.alreadyChanged : t.alreadySame}{" "}
                              <Link href={`/library/${encodeURIComponent(c.existingDocumentId)}`}>{t.open}</Link>
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="form-group form-group--lg">
                  <h2 className="form-group-head form-group-head--step"><span className="assign-step" aria-hidden="true">2</span>{tu.sectionMeta}</h2>
                  <div className="card form-group-body">
                    <p className="quiet" style={{ margin: "0 0 12px" }}>{t.metaNote}</p>
                    <div className="upload-grid">
                      <div className="field">
                        <span className="field-label">{t.folder}</span>
                        <Select language={language} name="folderId" fieldLabel={t.folder} initial="" options={[{ value: "", label: t.folderNone }, ...folderOptions]} />
                      </div>
                      <div className="field">
                        <span className="field-label">{tl.category}</span>
                        <Select language={language} name="category" fieldLabel={tl.category} initial={codelistOptions("category", extras)[0]?.value ?? ""} options={codelistOptions("category", extras)} />
                      </div>
                      <div className="field">
                        <span className="field-label">{tu.accessLevel}</span>
                        <Select language={language} name="accessLevel" options={codelistOptions("accessLevel")} initial="internal" fieldLabel={tu.accessLevel} />
                        <span className="quiet field-hint">{t.accessHint}</span>
                      </div>
                      <div className="field">
                        <span className="field-label">{tu.documentLanguage}</span>
                        <Select language={language} name="language" options={codelistOptions("language")} initial={ctx.tenant.defaultLanguage ?? "sk"} fieldLabel={tu.documentLanguage} />
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
              </form>
            )
          )}
        </>
      )}
    </div>
    </AppShell>
  )
}
