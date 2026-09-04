/**
 * Nastavenie organizácie — na doméne zákazníka (D48).
 *
 * Čo tu **je**: vzhľad, jazyky, vlastné prihlasovacie údaje, domény
 * s overením a domény pre automatické zakladanie.
 *
 * Čo tu **nie je**: vypnutie organizácie a jej kód. To sú veci medzi
 * zákazníkom a nami a zostávajú v `/admin`, kde má správca platformy naďalej
 * plnú správu všetkých organizácií — kvôli podpore a helpdesku.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { orgContext } from "@/lib/orgSettings"
import { domainRequests, domainInstruction } from "@/lib/customerDomains"
import { providerStatus, PROVIDER_LABEL, PROVIDER_ID } from "@/lib/oauth"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { UI_LANGUAGES, formatDate, dictionary } from "@/lib/i18n"
import type { UiLanguage } from "@/lib/i18n"
import Select from "@/components/Select"
import ColorSelect from "@/components/ColorSelect"
import Notice from "@/components/Notice"
import { saveBrandingAction, saveSignInAction, deleteSignInAction, requestDomainAction, verifyDomainAction, cancelDomainAction } from "./actions"
import { createDepartmentAction, renameDepartmentAction, moveDepartmentAction, deleteDepartmentAction } from "./actions"
import { addCodelistItemAction, removeCodelistItemAction, saveChunkingProfileAction, reindexAllAction } from "./actions"
import { shiftDepartmentAction, saveDepartmentOrderAction } from "./actions"
import TreeWithOrder from "@/components/TreeWithOrder"
import { reindexState } from "@/lib/libraryWrite"
import { DEFAULT_CHUNKING } from "@/lib/chunkingProfile"
import { availableOptions, customItems, codelistUsage } from "@/lib/codelistsTenant"
import { normalizeQuery, tabValue, type RawQuery } from "@/lib/urlParams"
import { CUSTOM_CODELISTS } from "@/lib/codelists"
import { allDepartments, flattenTree, subtree, counts, MAX_DEPTH, depth } from "@/lib/departments"
import { auditRecords } from "@/lib/audit"
import AuditList from "@/components/AuditList"
import type { OAuthProviderName } from "@/lib/oauth"
import type { Tenant } from "@/lib/tenants"

const TAB_KEYS = ["branding", "departments", "domains", "signin", "codelists", "chunking", "audit"]

export const dynamic = "force-dynamic"

function ProviderRow({
  tenant, provider, domain, language,
}: {
  tenant: Tenant
  provider: OAuthProviderName
  domain?: string
  language?: UiLanguage
}) {
  const t = dictionary(language).org.signIn
  const name = PROVIDER_LABEL[provider]
  const s = providerStatus(tenant, provider)
  const back = `https://${domain ?? "<…>"}/api/auth/callback/${PROVIDER_ID[provider]}`

  return (
    <section className="karta" style={{ padding: "18px 20px", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>{t.heading(name)}</h2>
        <span
          className="stitok"
          style={s.state === "necitatelne" ? { background: "var(--warn-bg)", color: "var(--warn-fg)" } : undefined}
        >
          {s.state === "nastavene" ? t.stateOn
            : s.state === "z-prostredia" ? t.stateFromSupplier
            : s.state === "necitatelne" ? t.stateUnreadable : t.stateOff}
        </span>
      </div>

      <p className="tichy" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
        {t.introBefore}<strong>{t.introHighlight(name)}</strong>{t.introAfter}
      </p>

      <div>
        <div className="tichy pole-napoveda">
          {t.callback}
        </div>
        <code style={{ fontSize: 13.5, overflowWrap: "anywhere" }}>{back}</code>
      </div>

      <form action={saveSignInAction} style={{ display: "grid", gap: 14 }}>
        <input type="hidden" name="provider" value={provider} />
        <input type="hidden" name="tab" value="signin" />

        <label className="pole">
          <span className="pole-popis">{t.clientId}</span>
          <input className="pole-vstup" name="clientId" defaultValue={s.zdroj === "tenant" ? s.clientId : ""} />
        </label>

        <label className="pole">
          <span className="pole-popis">{t.clientSecret}</span>
          <input className="pole-vstup" name="clientSecret" type="password" />
          <span className="tichy pole-napoveda">{t.clientSecretNote}</span>
        </label>

        {provider === "microsoft" ? (
          <>
            <label className="pole">
              <span className="pole-popis">{t.tenantMode}</span>
              <input
                className="pole-vstup"
                name="tenantMode"
                defaultValue={tenant.oauth?.microsoft?.tenantMode ?? "organizations"}
              />
              <span className="tichy pole-napoveda">
                {t.tenantModeBefore}<strong>{t.tenantModeHighlight}</strong>{t.tenantModeAfter}
              </span>
            </label>
            <label className="pole">
              <span className="pole-popis">{t.allowedTenantIds}</span>
              <input
                className="pole-vstup"
                name="allowedTenantIds"
                defaultValue={(tenant.oauth?.microsoft?.allowedTenantIds ?? []).join(", ")}
              />
              <span className="tichy pole-napoveda">{t.allowedTenantIdsNote}</span>
            </label>
          </>
        ) : (
          <label className="pole">
            <span className="pole-popis">{t.hostedDomain}</span>
            <input
              className="pole-vstup"
              name="hostedDomain"
              defaultValue={tenant.oauth?.google?.hostedDomain ?? ""}
            />
          </label>
        )}

        <div><button className="tlacidlo" type="submit">{t.save}</button></div>
      </form>

      {s.zdroj === "tenant" && (
        <form action={deleteSignInAction} style={{ display: "grid", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="tab" value="signin" />
          <p className="tichy" style={{ margin: 0, fontSize: 14 }}>{t.deleteNote}</p>
          <label className="pole">
            <span className="pole-popis">{t.confirmLabel(tenant.companyCode)}</span>
            <input className="pole-vstup" name="confirmation" autoCapitalize="characters" autoCorrect="off" />
          </label>
          <div><button className="tlacidlo tlacidlo--tiche" type="submit">{t.deleteSubmit}</button></div>
        </form>
      )}
    </section>
  )
}

export default async function OrganisationPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await orgContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { msg: message, error, tab, search } = normalizeQuery<{ msg?: string; error?: string; tab?: string; search?: string }>(await searchParams)
  // Záložka je v adrese, nie v klientskom stave: dá sa poslať odkazom,
  // vrátiť sa naň z histórie a funguje bez jediného riadku JavaScriptu.
  // `strom` je starý kľúč tejto záložky. Odkazy s ním existujú v e-mailoch
  // aj v záložkách prehliadača — presmerovať by ich rozbilo, tak sa len
  // preloží. Zmizne, keď prestane chodiť.
  const key = tabValue(tab)
  const now = TAB_KEYS.includes(key ?? "") ? key! : "branding"
  const tenant = ctx.tenant
  const branding = brandingView(tenant)
  const language = ctx.person.language
  const d = dictionary(language)
  const t = d.org
  const pending = (await domainRequests(tenant.companyCode)).filter(
    z => !tenant.hostnames.includes(z.host),
  )

  // Strom sa načítava len pre svoju záložku. Na ostatných by to bol dotaz
  // navyše za nič.
  const tenantDepartments = now === "departments" ? await allDepartments(tenant.companyCode) : []
  const rows = now === "departments" ? flattenTree(tenantDepartments) : []
  const peopleCounts = now === "departments" ? await counts(tenant.companyCode) : new Map()
  // Počty použití sa čítajú len pre svoju záložku — inak by to boli dva
  // dotazy na dokumenty pri každom otvorení nastavenia.
  const codelists = now === "codelists"
    ? await Promise.all(CUSTOM_CODELISTS.map(async name => ({
        name,
        vsetky: availableOptions(tenant, name),
        vlastne: customItems(tenant, name),
        pocty: Object.fromEntries(
          await Promise.all(
            customItems(tenant, name).map(async p =>
              [p.key, await codelistUsage(tenant.companyCode, name, p.key)] as const),
          ),
        ) as Record<string, number>,
      })))
    : []

  // Koľko dokumentov by nový profil narezal inak. Počíta sa naozajstným
  // narezaním — odhad by pri zmene parametra nevedel povedať, či na tomto
  // obsahu vôbec niečo spraví.
  const indexState = now === "chunking"
    ? await reindexState(tenant.companyCode, tenant.chunking)
    : null

  const records = now === "audit"
    ? await auditRecords(tenant.companyCode, { search: search, limit: 200 })
    : []

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 720, ...tenantStyle(branding) }}>
      <Notice
        message={message}
        error={error === "1"}
        back={`/organizacia?tab=${now}`}
      />

      <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{t.heading}</h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 22px", maxWidth: 620 }}>
        {t.introBefore}<strong>{tenant.companyCode}</strong>{t.introAfter}
      </p>

      {/* Záložky, nie jeden dlhý stĺpec. Blokov je päť a na telefóne to
          znamenalo, že sa k prihlasovaniu človek dostal až po dvoch
          obrazovkách posúvania cez veci, ktoré nehľadal. */}
      <nav className="zalozky" aria-label={t.tabsLabel}>
        {TAB_KEYS.map(k => (
          <Link
            key={k}
            href={`/organizacia?tab=${k}`}
            className={`zalozka${k === now ? " je-aktivna" : ""}`}
            aria-current={k === now ? "page" : undefined}
          >
            {t.tabs[k] ?? k}
          </Link>
        ))}
      </nav>

      {now === "branding" && (
      <form action={saveBrandingAction} className="karta" style={{ padding: 20, display: "grid", gap: 16 }} encType="multipart/form-data">
        <input type="hidden" name="tab" value="branding" />

        <label className="pole">
          <span className="pole-popis">{t.branding.name}</span>
          <input className="pole-vstup" name="displayName" defaultValue={tenant.branding.displayName} required />
          <span className="tichy pole-napoveda">{t.branding.nameNote}</span>
        </label>

        <label className="pole">
          <span className="pole-popis">{t.branding.shortName}</span>
          <input className="pole-vstup" name="shortName" defaultValue={tenant.branding.shortName ?? ""} />
          <span className="tichy pole-napoveda">{t.branding.shortNameNote}</span>
        </label>

        <div className="pole">
          <span className="pole-popis">{t.branding.logo}</span>
          {tenant.branding.logoUrl && (
            <span className="logo-nahlad">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tenant.branding.logoUrl} alt="" width={34} height={34} />
              <span className="tichy pole-napoveda">{t.branding.logoCurrent}</span>
            </span>
          )}
          <input className="pole-vstup" type="file" name="logo" accept="image/png,image/jpeg,image/webp" />
          <span className="tichy pole-napoveda">{t.branding.logoNote}</span>
        </div>

        <div className="pole">
          <span className="pole-popis">{t.branding.color}</span>
          <ColorSelect name="accentColor" value={tenant.branding.accentColor} language={language} />
          <span className="tichy pole-napoveda">{t.branding.colorNote}</span>
        </div>

        <label className="pole">
          <span className="pole-popis">{t.branding.supportEmail}</span>
          <input className="pole-vstup" name="supportEmail" type="email" defaultValue={tenant.branding.supportEmail ?? ""} />
          <span className="tichy pole-napoveda">{t.branding.supportEmailNote}</span>
        </label>

        <fieldset className="hr-skupina" style={{ border: "1px solid var(--line)" }}>
          <legend className="pole-popis">{t.branding.languages}</legend>
          <div className="stitky-zoznam">
            {UI_LANGUAGES.map(j => (
              <label key={j} className="stitok stitok--volba stitok--pole">
                <input type="checkbox" name="languages" value={j} defaultChecked={tenant.languages.includes(j)} />
                <span className="stitok-znak" aria-hidden="true" />
                {d.people.languages[j] ?? j}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="pole">
          <span className="pole-popis">{t.branding.defaultLanguage}</span>
          <Select
            name="defaultLanguage"
            options={UI_LANGUAGES.map(j => ({ value: j, label: d.people.languages[j] ?? j }))}
            initial={tenant.defaultLanguage}
            fieldLabel={t.branding.defaultLanguage}
          />
          <span className="tichy pole-napoveda">{t.branding.defaultLanguageNote}</span>
        </div>

        <label className="pole">
          <span className="pole-popis">{t.branding.autoProvision}</span>
          <textarea
            className="pole-vstup"
            name="autoProvisionDomains"
            rows={2}
            defaultValue={(tenant.autoProvisionDomains ?? []).join("\n")}
            placeholder="futbalsfz.sk&#10;sfzmarketing.sk"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <span className="tichy pole-napoveda">
            {t.branding.autoProvisionBefore}<strong>{t.branding.autoProvisionHighlight}</strong>{t.branding.autoProvisionAfter}
          </span>
        </label>

        <div><button className="tlacidlo" type="submit">{t.branding.save}</button></div>
      </form>
      )}

      {now === "departments" && (
      <div style={{ display: "grid", gap: 16 }}>
        <section className="karta" style={{ padding: 20, display: "grid", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>{t.departments.heading}</h2>
            <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
              {t.departments.introBefore}<strong>{t.departments.introHighlight}</strong>
              {t.departments.introMiddle}
              <Link href="/osoby">{t.departments.groupsLink}</Link>
              {t.departments.introAfter}
            </p>
          </div>

          {rows.length === 0 ? (
            <p className="tichy" style={{ fontSize: 14, margin: 0 }}>{t.departments.empty}</p>
          ) : (
            <TreeWithOrder
              hidden={{ tab: "departments" }}
              action={saveDepartmentOrderAction}
              items={rows.map(({ department, level }) => {
                const p = peopleCounts.get(department.id) ?? { direct: 0, withDescendants: 0 }
                const inside = subtree(tenantDepartments, department.id)
                return {
                  id: department.id,
                  name: department.name,
                  parentId: department.parentId ?? null,
                  level: level,
                  content: (
                    <details>
                      <summary className="strom-riadok">
                        <span className="strom-uchop" aria-hidden="true">⠿</span>
                        <span className="strom-nazov">{department.name}</span>
                        <span className="tichy strom-pocet">
                          {p.direct}
                          {p.withDescendants !== p.direct ? t.departments.withDescendants(p.withDescendants) : ""}
                        </span>
                      </summary>

                      <div className="strom-uprava">
                        {/* Posun o jedno miesto — obyčajné tlačidlá. Ťahanie
                            myšou robí to isté, ale toto funguje aj bez
                            JavaScriptu, klávesnicou a na telefóne. */}
                        <div className="strom-sipky">
                          <form action={shiftDepartmentAction}>
                            <input type="hidden" name="tab" value="departments" />
                            <input type="hidden" name="id" value={department.id} />
                            <input type="hidden" name="direction" value="up" />
                            <button className="tlacidlo tlacidlo--tiche" type="submit"
                                    aria-label={t.departments.moveUp(department.name)}>{t.departments.up}</button>
                          </form>
                          <form action={shiftDepartmentAction}>
                            <input type="hidden" name="tab" value="departments" />
                            <input type="hidden" name="id" value={department.id} />
                            <input type="hidden" name="direction" value="down" />
                            <button className="tlacidlo tlacidlo--tiche" type="submit"
                                    aria-label={t.departments.moveDown(department.name)}>{t.departments.down}</button>
                          </form>
                        </div>

                        <form action={renameDepartmentAction} className="strom-forma">
                          <input type="hidden" name="tab" value="departments" />
                          <input type="hidden" name="id" value={department.id} />
                          <input
                            className="pole-vstup"
                            name="name"
                            defaultValue={department.name}
                            aria-label={t.departments.nameOf(department.name)}
                            required
                          />
                          <button className="tlacidlo tlacidlo--tiche" type="submit">{t.departments.rename}</button>
                        </form>

                        <form action={moveDepartmentAction} className="strom-forma">
                          <input type="hidden" name="tab" value="departments" />
                          <input type="hidden" name="id" value={department.id} />
                          <Select
                            name="parentId"
                            initial={department.parentId ?? ""}
                            fieldLabel={t.departments.parentOf(department.name)}
                            options={[
                              { value: "", label: t.departments.topLevel },
                              ...rows
                                // Pod seba ani pod vlastného potomka sa presunúť
                                // nedá, tak sa to ani neponúka. Pravidlo aj tak
                                // platí na serveri — toto len šetrí človeku chybu.
                                .filter(r => !inside.has(r.department.id))
                                .map(r => ({
                                  value: r.department.id,
                                  label: `${"— ".repeat(r.level - 1)}${r.department.name}`,
                                })),
                            ]}
                          />
                          <button className="tlacidlo tlacidlo--tiche" type="submit">{t.departments.move}</button>
                        </form>

                        {p.withDescendants === 0 && inside.size === 1 ? (
                          <form action={deleteDepartmentAction}>
                            <input type="hidden" name="tab" value="departments" />
                            <input type="hidden" name="id" value={department.id} />
                            <button className="tlacidlo tlacidlo--tiche" type="submit">{t.departments.remove}</button>
                          </form>
                        ) : (
                          <p className="tichy" style={{ fontSize: 13, margin: 0 }}>{t.departments.removeHint}</p>
                        )}
                      </div>
                    </details>
                  ),
                }
              })}
            />
          )}
        </section>

        <form action={createDepartmentAction} className="karta" style={{ padding: 20, display: "grid", gap: 14 }}>
          <input type="hidden" name="tab" value="departments" />
          <h2 style={{ fontSize: 17, margin: 0 }}>{t.departments.newHeading}</h2>

          <label className="pole">
            <span className="pole-popis">{t.departments.name}</span>
            <input className="pole-vstup" name="name" placeholder={t.departments.namePlaceholder} required />
          </label>

          <label className="pole">
            <span className="pole-popis">{t.departments.parent}</span>
            <Select
              name="parentId"
              initial=""
              options={[
                { value: "", label: t.departments.topLevel },
                ...rows
                  // Hlbšie než povolené sa založiť nedá, tak sa to neponúka.
                  .filter(r => depth(tenantDepartments, r.department.id) < MAX_DEPTH)
                  .map(r => ({
                    value: r.department.id,
                    label: `${"— ".repeat(r.level - 1)}${r.department.name}`,
                  })),
              ]}
            />
            <span className="tichy pole-napoveda">{t.departments.maxDepth(MAX_DEPTH)}</span>
          </label>

          <div><button className="tlacidlo" type="submit">{t.departments.create}</button></div>
        </form>
      </div>
      )}

      {now === "domains" && (
      <section className="karta" style={{ padding: "18px 20px", display: "grid", gap: 14 }}>

        <ul className="admin-domeny">
          {tenant.hostnames.map(h => (
            <li key={h} className="karta" style={{ padding: "10px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600 }}>{h}</span>
              <span className="stitok" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>{t.domains.works}</span>
              {tenant.hostnames.length > 1 && (
                <form action={cancelDomainAction} style={{ marginLeft: "auto" }}>
                  <input type="hidden" name="host" value={h} />
                  <input type="hidden" name="tab" value="domains" />
                  <button className="tlacidlo tlacidlo--tiche" type="submit" style={{ padding: "5px 10px", fontSize: 13 }}>
                    {t.domains.remove}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {pending.length > 0 && (
          <ul className="admin-domeny">
            {pending.map(z => {
              const p = domainInstruction(z.host)
              return (
                <li key={z.host} className="karta" style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600 }}>{z.host}</span>
                    <span className="stitok" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
                      {t.domains.waitingDns}
                    </span>
                    <span className="tichy" style={{ fontSize: 13, marginLeft: "auto" }}>
                      {t.domains.since(formatDate(z.requestedAt, language))}
                    </span>
                  </div>

                  {p && (
                    <p className="tichy" style={{ margin: 0, fontSize: 13.5, overflowWrap: "anywhere" }}>
                      {t.domains.dnsBefore}<strong>{p.type}</strong>{t.domains.dnsMiddle}
                      <code>{p.name}</code> → <code>{p.value}</code>
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <form action={verifyDomainAction}>
                      <input type="hidden" name="host" value={z.host} />
                      <input type="hidden" name="tab" value="domains" />
                      <button className="tlacidlo" type="submit" style={{ padding: "6px 14px", fontSize: 13.5 }}>
                        {t.domains.verify}
                      </button>
                    </form>
                    <form action={cancelDomainAction}>
                      <input type="hidden" name="host" value={z.host} />
                      <input type="hidden" name="tab" value="domains" />
                      <button className="tlacidlo tlacidlo--tiche" type="submit" style={{ padding: "6px 14px", fontSize: 13.5 }}>
                        {t.domains.cancelRequest}
                      </button>
                    </form>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <form action={requestDomainAction} style={{ display: "grid", gap: 10 }}>
          <input type="hidden" name="tab" value="domains" />
          <label className="pole">
            <span className="pole-popis">{t.domains.add}</span>
            <input className="pole-vstup" name="host" placeholder={t.domains.hostPlaceholder} autoCapitalize="none" autoCorrect="off" />
            <span className="tichy pole-napoveda">{t.domains.addNote}</span>
          </label>
          <div><button className="tlacidlo tlacidlo--tiche" type="submit">{t.domains.request}</button></div>
        </form>
      </section>
      )}

      {now === "signin" && (
      <div style={{ display: "grid", gap: 16 }}>
        <ProviderRow tenant={tenant} provider="microsoft" domain={tenant.hostnames[0]} language={language} />
        <ProviderRow tenant={tenant} provider="google" domain={tenant.hostnames[0]} language={language} />
      </div>
      )}

      {now === "codelists" && (
      <div style={{ display: "grid", gap: 16 }}>
        <p className="tichy" style={{ fontSize: 14.5, margin: 0, maxWidth: 620 }}>
          {t.codelists.introBefore}<strong>{t.codelists.introHighlight}</strong>{t.codelists.introAfter}
        </p>

        {codelists.map(c => (
          <section key={c.name} className="karta" style={{ padding: 20, display: "grid", gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>{t.codelists.labels[c.name].name}</h2>
              <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
                {t.codelists.labels[c.name].hint}
              </p>
            </div>

            <ul className="strom">
              {c.vsetky.map(p => {
                const custom = c.vlastne.some(v => v.key === p.key)
                return (
                  <li key={p.key} className="strom-polozka">
                    <div className="strom-riadok">
                      <span className="strom-nazov">{p.label ?? p.key}</span>
                      <span className="tichy strom-pocet">
                        <code>{p.key}</code>
                        {!custom && t.codelists.base}
                        {custom && c.pocty[p.key] > 0 && t.codelists.used(c.pocty[p.key])}
                      </span>
                      {custom && (
                        <form action={removeCodelistItemAction} style={{ marginLeft: "auto" }}>
                          <input type="hidden" name="tab" value="codelists" />
                          <input type="hidden" name="codelist" value={c.name} />
                          <input type="hidden" name="key" value={p.key} />
                          <button className="tlacidlo tlacidlo--tiche" type="submit">{t.codelists.remove}</button>
                        </form>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            <form action={addCodelistItemAction} className="strom-forma">
              <input type="hidden" name="tab" value="codelists" />
              <input type="hidden" name="codelist" value={c.name} />
              <input className="pole-vstup" name="label" placeholder={t.codelists.newItemPlaceholder}
                     aria-label={t.codelists.newItemLabel(t.codelists.labels[c.name].name)} required />
              <input className="pole-vstup" name="key" placeholder={t.codelists.keyPlaceholder}
                     aria-label={t.codelists.key} autoCapitalize="none" autoCorrect="off" required
                     style={{ maxWidth: 220 }} />
              <button className="tlacidlo tlacidlo--tiche" type="submit">{t.codelists.add}</button>
            </form>

            <p className="tichy" style={{ fontSize: 13, margin: 0 }}>{t.codelists.keyNote}</p>
          </section>
        ))}
      </div>
      )}

      {now === "chunking" && (
      <form action={saveChunkingProfileAction} className="karta" style={{ padding: 20, display: "grid", gap: 16 }}>
        <input type="hidden" name="tab" value="chunking" />

        <div>
          <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>{t.chunking.heading}</h2>
          <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
            {t.chunking.introBefore}
            <strong>{t.chunking.introHighlight}</strong>{t.chunking.introAfter}
          </p>
        </div>

        <label className="pole">
          <span className="pole-popis">{t.chunking.articleWord}</span>
          <input className="pole-vstup" name="articleWord"
                 defaultValue={tenant.chunking?.articleWord ?? DEFAULT_CHUNKING.articleWord} />
          <span className="tichy pole-napoveda">
            {t.chunking.articleNote1}<code>Článok</code>{t.chunking.articleNote2}<code>§</code>
            {t.chunking.articleNote3}<code>Bod</code>{t.chunking.articleNote4}
            <strong>{t.chunking.articleNoteHighlight}</strong>{t.chunking.articleNote5}
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">{t.chunking.annexWord}</span>
          <input className="pole-vstup" name="annexWord"
                 defaultValue={tenant.chunking?.annexWord ?? DEFAULT_CHUNKING.annexWord} />
          <span className="tichy pole-napoveda">{t.chunking.annexWordNote}</span>
        </label>

        <label className="pole">
          <span className="pole-popis">{t.chunking.headerRepeats}</span>
          <input className="pole-vstup" type="number" name="headerRepeats" min={2} max={50}
                 defaultValue={tenant.chunking?.headerRepeats ?? DEFAULT_CHUNKING.headerRepeats} />
          <span className="tichy pole-napoveda">{t.chunking.headerRepeatsNote}</span>
        </label>

        <label className="pole">
          <span className="pole-popis">{t.chunking.minTokens}</span>
          <input className="pole-vstup" type="number" name="minTokens" min={50} max={2000}
                 defaultValue={tenant.chunking?.minTokens ?? DEFAULT_CHUNKING.minTokens} />
        </label>

        <label className="pole">
          <span className="pole-popis">{t.chunking.maxTokens}</span>
          <input className="pole-vstup" type="number" name="maxTokens" min={100} max={4000}
                 defaultValue={tenant.chunking?.maxTokens ?? DEFAULT_CHUNKING.maxTokens} />
          <span className="tichy pole-napoveda">
            {t.chunking.tokensNoteBefore}<code>300–800</code>{t.chunking.tokensNoteAfter}
          </span>
        </label>

        <p className="tichy" style={{ fontSize: 13.5, margin: 0 }}>
          {t.chunking.saveNoteBefore}<strong>{t.chunking.saveNoteHighlight}</strong>
          {t.chunking.saveNoteMiddle}<em>{t.chunking.saveNoteButton}</em>{t.chunking.saveNoteAfter}
        </p>

        <div><button className="tlacidlo" type="submit">{t.chunking.save}</button></div>
      </form>
      )}

      {now === "chunking" && indexState && (
      <form action={reindexAllAction} className="karta" style={{ padding: 20, display: "grid", gap: 12, marginTop: 16 }}>
        <input type="hidden" name="tab" value="chunking" />
        <h2 style={{ fontSize: 17, margin: 0 }}>{t.chunking.reindexAllHeading}</h2>

        {indexState.neaktualnych === 0 ? (
          <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
            {t.chunking.allUpToDate(indexState.celkom)}
          </p>
        ) : (
          <>
            <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
              <strong>{indexState.neaktualnych}</strong>{t.chunking.outdatedOf(indexState.celkom)}
              <strong>{t.chunking.outdatedHighlight}</strong>{t.chunking.outdatedAfter}
            </p>
            <p className="tichy" style={{ fontSize: 13, margin: 0 }}>{t.chunking.batchNote}</p>
            <div>
              <button className="tlacidlo" type="submit">
                {t.chunking.reindexAll(indexState.neaktualnych)}
              </button>
            </div>
          </>
        )}
      </form>
      )}

      {now === "audit" && (
      <div>
        <p className="tichy" style={{ fontSize: 14.5, margin: "0 0 16px", maxWidth: 620 }}>
          {t.auditTab.introBefore}<strong>{t.auditTab.introHighlight}</strong>{t.auditTab.introAfter}
        </p>

        {/* Formulár metódou GET: filter je v adrese, dá sa poslať odkazom
            a funguje bez jediného riadku JavaScriptu. */}
        <form className="audit-filter" method="get">
          <input type="hidden" name="tab" value="audit" />
          <label className="pole" style={{ flex: "1 1 260px", margin: 0 }}>
            <span className="pole-popis">{t.auditTab.search}</span>
            <input
              className="pole-vstup"
              name="search"
              defaultValue={search ?? ""}
              placeholder={t.auditTab.searchPlaceholder}
              autoCapitalize="none"
            />
          </label>
          <button className="tlacidlo tlacidlo--tiche" type="submit">{t.auditTab.searchSubmit}</button>
          {search ? (
            <Link className="tichy" href="/organizacia?tab=audit" style={{ fontSize: 14 }}>
              {t.auditTab.clearFilter}
            </Link>
          ) : null}
        </form>

        <AuditList records={records} language={language} />

        {records.length >= 200 && (
          <p className="tichy" style={{ fontSize: 13, marginTop: 14 }}>{t.auditTab.capped}</p>
        )}
      </div>
      )}
    </div>
  )
}
