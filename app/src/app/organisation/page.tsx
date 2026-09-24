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
import { treeOptions } from "@/lib/treeOptions"
import Link from "next/link"
import { orgContext } from "@/lib/orgSettings"
import { domainRequests, domainInstruction } from "@/lib/customerDomains"
import { providerStatus, PROVIDER_LABEL, PROVIDER_ID } from "@/lib/oauth"
import { brandingView, tenantByCompanyCode } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import LiveFilter from "@/components/LiveFilter"
import { DEFAULT_PHONE_PREFIX } from "@/lib/personFields"
import { UI_LANGUAGES, formatDate, dictionary } from "@/lib/i18n"
import type { UiLanguage } from "@/lib/i18n"
import Select from "@/components/Select"
import ColorSelect from "@/components/ColorSelect"
import Notice from "@/components/Notice"
import { saveBrandingAction, deleteLogoAction, saveSignInAction, deleteSignInAction, requestDomainAction, verifyDomainAction, cancelDomainAction } from "./actions"
import { createDepartmentAction, renameDepartmentAction, moveDepartmentAction, deleteDepartmentAction } from "./actions"
import { addCodelistItemAction, removeCodelistItemAction, saveChunkingProfileAction, reindexAllAction } from "./actions"
import { shiftDepartmentAction, saveDepartmentOrderAction } from "./actions"
import TreeWithOrder from "@/components/TreeWithOrder"
import KeyFromLabel from "@/components/KeyFromLabel"
import { reindexState } from "@/lib/libraryWrite"
import { DEFAULT_CHUNKING, DEFAULT_PROFILE_KEY } from "@/lib/chunkingProfile"
import { availableOptions, customItems, codelistUsage } from "@/lib/codelistsTenant"
import { normalizeQuery, tabValue, type RawQuery } from "@/lib/urlParams"
import { CUSTOM_CODELISTS } from "@/lib/codelists"
import { allDepartments, flattenTree, subtree, counts, MAX_DEPTH, depth } from "@/lib/departments"
import { auditRecords } from "@/lib/audit"
import AuditList from "@/components/AuditList"
import type { OAuthProviderName } from "@/lib/oauth"
import type { Tenant } from "@/lib/tenants"
import AppShell from "@/components/AppShell"
import { STANDARD_LEGAL_BASES, MAX_LEGAL_REFERENCE_FIELD } from "@/lib/legalBases"
import { legalBasisUsage } from "@/lib/legalBasesDb"
import { LEGAL_BASES } from "@/lib/versionResponsibility"
import {
  addLegalBasisAction, retireLegalBasisAction, toggleStandardLegalBasisAction,
} from "./actions"

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
    <section className="card" style={{ padding: "18px 20px", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{t.heading(name)}</h2>
        <span
          className="tag"
          style={s.state === "unreadable" ? { background: "var(--warn-bg)", color: "var(--warn-fg)" } : undefined}
        >
          {s.state === "set" ? t.stateOn
            : s.state === "from-environment" ? t.stateFromSupplier
            : s.state === "unreadable" ? t.stateUnreadable : t.stateOff}
        </span>
      </div>

      <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
        {t.introBefore}<strong>{t.introHighlight(name)}</strong>{t.introAfter}
      </p>

      <div>
        <div className="quiet field-hint">
          {t.callback}
        </div>
        <code style={{ fontSize: "var(--fs-small)", overflowWrap: "anywhere" }}>{back}</code>
      </div>

      <form action={saveSignInAction} style={{ display: "grid", gap: 14 }}>
        <input type="hidden" name="provider" value={provider} />
        <input type="hidden" name="tab" value="signin" />

        <label className="field">
          <span className="field-label">{t.clientId}</span>
          <input className="field-input" name="clientId" defaultValue={s.source === "tenant" ? s.clientId : ""} />
        </label>

        <label className="field">
          <span className="field-label">{t.clientSecret}</span>
          <input className="field-input" name="clientSecret" type="password" />
          <span className="quiet field-hint">{t.clientSecretNote}</span>
        </label>

        {provider === "microsoft" ? (
          <>
            <label className="field">
              <span className="field-label">{t.tenantMode}</span>
              <input
                className="field-input"
                name="tenantMode"
                defaultValue={tenant.oauth?.microsoft?.tenantMode ?? "organizations"}
              />
              <span className="quiet field-hint">
                {t.tenantModeBefore}<strong>{t.tenantModeHighlight}</strong>{t.tenantModeAfter}
              </span>
            </label>
            <label className="field">
              <span className="field-label">{t.allowedTenantIds}</span>
              <input
                className="field-input"
                name="allowedTenantIds"
                defaultValue={(tenant.oauth?.microsoft?.allowedTenantIds ?? []).join(", ")}
              />
              <span className="quiet field-hint">{t.allowedTenantIdsNote}</span>
            </label>
          </>
        ) : (
          <label className="field">
            <span className="field-label">{t.hostedDomain}</span>
            <input
              className="field-input"
              name="hostedDomain"
              defaultValue={tenant.oauth?.google?.hostedDomain ?? ""}
            />
          </label>
        )}

        <div><button className="button" type="submit">{t.save}</button></div>
      </form>

      {s.source === "tenant" && (
        <form action={deleteSignInAction} style={{ display: "grid", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="tab" value="signin" />
          <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-body)" }}>{t.deleteNote}</p>
          <label className="field">
            <span className="field-label">{t.confirmLabel(tenant.companyCode)}</span>
            <input className="field-input" name="confirmation" autoCapitalize="characters" autoCorrect="off" />
          </label>
          <div><button className="button button--quiet" type="submit">{t.deleteSubmit}</button></div>
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
    if (ctx.state === "not-signed-in") redirect("/sign-in")
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
  /*
    Organizácia **priamo z databázy**, nie z `ctx.tenant`.

    Po uložení (serverová akcia → `redirect`) sa táto stránka vykreslí v tej
    istej požiadavke. `currentTenant()` je zapamätaný na požiadavku a akcia
    ho načítala ešte **pred** zápisom — obrazovka tak ukázala stav spred
    zmeny a nová položka číselníka sa objavila až po obnovení (24. 9. 2026).
    Nastavenie je jediné miesto, kde musí byť vidieť presne to, čo je
    uložené; na ostatných stránkach stačí zapamätaný tvar.
  */
  const tenant = (await tenantByCompanyCode(ctx.tenant.companyCode)) ?? ctx.tenant
  const branding = brandingView(tenant)
  const language = ctx.person.language
  const d = dictionary(language)
  const t = d.org
  const tp = d.privacy
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

  // Právne základy (D92) — na tej istej záložke ako ostatné číselníky.
  const basisUsage = now === "codelists" ? await legalBasisUsage(tenant.companyCode) : new Map<string, number>()
  const hiddenBases = new Set(tenant.legalBasesHidden ?? [])
  const tr = d.responsibility

  // Koľko dokumentov by nový profil narezal inak. Počíta sa naozajstným
  // narezaním — odhad by pri zmene parametra nevedel povedať, či na tomto
  // obsahu vôbec niečo spraví.
  const indexState = now === "chunking"
    ? await reindexState(tenant.companyCode)
    : null

  // Hodnoty v poliach idú zo **základného pomenovaného profilu** (D79).
  // `tenant.chunking` je už len záchyt pre organizácie, ktoré profily ešte
  // nemajú — čítať oba naraz by znamenalo ukazovať niečo iné, než sa použije.
  const baseProfile = (tenant.chunkingProfiles ?? []).find(p => p.key === DEFAULT_PROFILE_KEY)
  const chunkingValues = baseProfile ?? tenant.chunking ?? DEFAULT_CHUNKING

  const records = now === "audit"
    ? await auditRecords(tenant.companyCode, { search: search, limit: 200 })
    : []

  return (
    <AppShell language={ctx.person.language}>
    <div style={{ maxWidth: 720, ...tenantStyle(branding) }}>
      <Notice
        message={message}
        error={error === "1"}
        back={`/organisation?tab=${now}`}
      />

      <h1 className="page-title">{t.heading}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 22px", maxWidth: 620 }}>
        {t.introBefore}<strong>{tenant.companyCode}</strong>{t.introAfter}
      </p>

      {/* Záložky, nie jeden dlhý stĺpec. Blokov je päť a na telefóne to
          znamenalo, že sa k prihlasovaniu človek dostal až po dvoch
          obrazovkách posúvania cez veci, ktoré nehľadal. */}
      <nav className="tabs" aria-label={t.tabsLabel}>
        {TAB_KEYS.map(k => (
          <Link
            key={k}
            href={`/organisation?tab=${k}`}
            className={`tab${k === now ? " is-active" : ""}`}
            aria-current={k === now ? "page" : undefined}
          >
            {t.tabs[k] ?? k}
          </Link>
        ))}
      </nav>

      {/*
        Vzhľad a jazyky v sekciách (rám ADMIN-prevadzkovatel-a-ciselniky):
        nadpis a vysvetlenie vľavo, polia vpravo (od 1024 px), jeden
        formulár a jedno Uložiť v lište, ktorá je vždy na dosah.
      */}
      {now === "branding" && (
      <form action={saveBrandingAction} className="card set-form">
        <input type="hidden" name="tab" value="branding" />

        <section className="set-sec">
          <div className="set-sec-head">
            <h2>{t.branding.secIdentity}</h2>
            <p>{t.branding.secIdentityNote}</p>
          </div>
          <div className="set-sec-body">
            <label className="field">
              <span className="field-label">{t.branding.name}</span>
              <input className="field-input" name="displayName" defaultValue={tenant.branding.displayName} required />
              <span className="quiet field-hint">{t.branding.nameNote}</span>
            </label>

            <label className="field">
              <span className="field-label">{t.branding.shortName}</span>
              <input className="field-input" name="shortName" defaultValue={tenant.branding.shortName ?? ""} />
              <span className="quiet field-hint">{t.branding.shortNameNote}</span>
            </label>

            <div className="field">
              <span className="field-label">{t.branding.logo}</span>
              {/* Slot je veľký 96 px, hoci v hlavičke má logo 26 — na 26 px sa
                  nedá posúdiť, či je obrázok orezaný alebo rozmazaný, a práve to
                  je jediné, čo sa tu dá skontrolovať pred uložením. */}
              <div className="logo-row">
                <div className="logo-slot">
                  {tenant.branding.logoUrl ? (
                    // `alt` nie je prázdny, na rozdiel od hlavičky: tu je logo obsah.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tenant.branding.logoUrl} alt={t.branding.logoCurrent} />
                  ) : (
                    <span className="logo-slot-empty">{t.branding.logoEmpty}</span>
                  )}
                </div>
                <div className="logo-row-fields">
                  <input className="field-input" type="file" name="logo" accept="image/png,image/jpeg,image/webp" />
                  {/* „Odstrániť logo" pri logu (rám, Q1 — Ján 24. 9.). Je to druhý
                      formulár; vnoriť sa nedá, tlačidlo ho volá cez `form`. */}
                  {tenant.branding.logoUrl && (
                    <button className="set-remove" type="submit" form="remove-logo"
                            title={t.branding.logoRemoveNote}>
                      {t.branding.logoRemove}
                    </button>
                  )}
                  <span className="quiet field-hint">{t.branding.logoNote}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head">
            <h2>{t.branding.color}</h2>
            <p>{t.branding.colorNote}</p>
          </div>
          <div className="set-sec-body">
            <ColorSelect name="accentColor" value={tenant.branding.accentColor} language={language} />
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head">
            <h2>{t.branding.secContact}</h2>
          </div>
          <div className="set-sec-body">
            <label className="field">
              <span className="field-label">{t.branding.supportEmail}</span>
              <input className="field-input" name="supportEmail" type="email" defaultValue={tenant.branding.supportEmail ?? ""} />
              <span className="quiet field-hint">{t.branding.supportEmailNote}</span>
            </label>

            {/* Predvoľba telefónu (D86) — nastavenie organizácie, jediné pole
                vo svojej skupine; vlastná záložka by ho skryla. */}
            <label className="field">
              <span className="field-label">{t.branding.phonePrefix}</span>
              <input
                className="field-input"
                name="phonePrefix"
                inputMode="tel"
                placeholder={DEFAULT_PHONE_PREFIX}
                defaultValue={tenant.phonePrefix ?? ""}
              />
              <span className="quiet field-hint">{t.branding.phonePrefixNote}</span>
            </label>
          </div>
        </section>

        {/*
          Prevádzkovateľ (C1, ADR-012) — údaje do informovania dotknutých
          osôb na `/privacy`. Pod poľami náhľad vety z tej stránky (rám, Q2)
          z uložených hodnôt — bez JavaScriptu, takže ukazuje, čo platí.
        */}
        <section className="set-sec">
          <div className="set-sec-head">
            <h2>{t.branding.controller}</h2>
            <p>{t.branding.controllerNote}</p>
          </div>
          <div className="set-sec-body">
            <label className="field">
              <span className="field-label">{t.branding.controllerLegalName}</span>
              <input className="field-input" name="controllerLegalName" defaultValue={tenant.controller?.legalName ?? ""}
                     placeholder={tenant.branding.displayName} />
            </label>
            <div className="set-pair">
              <label className="field">
                <span className="field-label">{t.branding.controllerAddress}</span>
                <input className="field-input" name="controllerAddress" defaultValue={tenant.controller?.address ?? ""} />
              </label>
              <label className="field">
                <span className="field-label">{t.branding.controllerRegistrationNumber}</span>
                <input className="field-input" name="controllerRegistrationNumber" inputMode="numeric"
                       defaultValue={tenant.controller?.registrationNumber ?? ""} />
              </label>
            </div>
            <p className="set-preview">
              {t.branding.controllerPreview}{" "}
              <b>„{tp.controller(tenant.controller?.legalName || tenant.branding.displayName)}“</b>
              {(tenant.controller?.address || tenant.controller?.registrationNumber) &&
                ` · ${tp.controllerDetails(tenant.controller?.address ?? "", tenant.controller?.registrationNumber ?? "")}`}
            </p>
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head">
            <h2>{t.branding.languages}</h2>
          </div>
          <div className="set-sec-body">
            <div className="tags-list">
              {UI_LANGUAGES.map(j => (
                <label key={j} className="tag tag--choice tag--field">
                  <input type="checkbox" name="languages" value={j} defaultChecked={tenant.languages.includes(j)} />
                  <span className="tag-mark" aria-hidden="true" />
                  {d.people.languages[j] ?? j}
                </label>
              ))}
            </div>
            <div className="field">
              <span className="field-label">{t.branding.defaultLanguage}</span>
              <Select language={language}
                name="defaultLanguage"
                options={UI_LANGUAGES.map(j => ({ value: j, label: d.people.languages[j] ?? j }))}
                initial={tenant.defaultLanguage}
                fieldLabel={t.branding.defaultLanguage}
              />
              <span className="quiet field-hint">{t.branding.defaultLanguageNote}</span>
            </div>
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head">
            <h2>{t.branding.secAutoProvision}</h2>
          </div>
          <div className="set-sec-body">
            <label className="field">
              <span className="field-label">{t.branding.autoProvision}</span>
              <textarea
                className="field-input"
                name="autoProvisionDomains"
                rows={2}
                defaultValue={(tenant.autoProvisionDomains ?? []).join("\n")}
                placeholder="futbalsfz.sk&#10;sfzmarketing.sk"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <span className="quiet field-hint">
                {t.branding.autoProvisionBefore}<strong>{t.branding.autoProvisionHighlight}</strong>{t.branding.autoProvisionAfter}
              </span>
            </label>
          </div>
        </section>

        <div className="set-savebar">
          <button className="button" type="submit">{t.branding.save}</button>
          <span className="quiet">{t.branding.saveBarNote}</span>
        </div>
      </form>
      )}

      {/* Formulár odstránenia loga — samostatný (formuláre sa vnárať nedajú),
          volá ho tlačidlo pri logu cez `form="remove-logo"`. */}
      {now === "branding" && tenant.branding.logoUrl && (
        <form id="remove-logo" action={deleteLogoAction} hidden>
          <input type="hidden" name="tab" value="branding" />
        </form>
      )}

      {now === "departments" && (
      <div style={{ display: "grid", gap: 16 }}>
        <section className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: "var(--fs-section)", margin: "0 0 4px" }}>{t.departments.heading}</h2>
            <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: 0 }}>
              {t.departments.introBefore}<strong>{t.departments.introHighlight}</strong>
              {t.departments.introMiddle}
              <Link href="/people">{t.departments.groupsLink}</Link>
              {t.departments.introAfter}
            </p>
          </div>

          {rows.length === 0 ? (
            <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: 0 }}>{t.departments.empty}</p>
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
                      <summary className="tree-row">
                        <span className="tree-grip" aria-hidden="true">⠿</span>
                        <span className="tree-name">{department.name}</span>
                        <span className="quiet tree-count">
                          {p.direct}
                          {p.withDescendants !== p.direct ? t.departments.withDescendants(p.withDescendants) : ""}
                        </span>
                      </summary>

                      <div className="tree-edit">
                        {/* Posun o jedno miesto — obyčajné tlačidlá. Ťahanie
                            myšou robí to isté, ale toto funguje aj bez
                            JavaScriptu, klávesnicou a na telefóne. */}
                        <div className="tree-arrows">
                          <form action={shiftDepartmentAction}>
                            <input type="hidden" name="tab" value="departments" />
                            <input type="hidden" name="id" value={department.id} />
                            <input type="hidden" name="direction" value="up" />
                            <button className="button button--quiet" type="submit"
                                    aria-label={t.departments.moveUp(department.name)}>{t.departments.up}</button>
                          </form>
                          <form action={shiftDepartmentAction}>
                            <input type="hidden" name="tab" value="departments" />
                            <input type="hidden" name="id" value={department.id} />
                            <input type="hidden" name="direction" value="down" />
                            <button className="button button--quiet" type="submit"
                                    aria-label={t.departments.moveDown(department.name)}>{t.departments.down}</button>
                          </form>
                        </div>

                        <form action={renameDepartmentAction} className="tree-form">
                          <input type="hidden" name="tab" value="departments" />
                          <input type="hidden" name="id" value={department.id} />
                          <input
                            className="field-input"
                            name="name"
                            defaultValue={department.name}
                            aria-label={t.departments.nameOf(department.name)}
                            required
                          />
                          <button className="button button--quiet" type="submit">{t.departments.rename}</button>
                        </form>

                        <form action={moveDepartmentAction} className="tree-form">
                          <input type="hidden" name="tab" value="departments" />
                          <input type="hidden" name="id" value={department.id} />
                          <Select language={language}
                            name="parentId"
                            initial={department.parentId ?? ""}
                            fieldLabel={t.departments.parentOf(department.name)}
                            options={[
                              { value: "", label: t.departments.topLevel },
                              // Pod seba ani pod vlastného potomka sa presunúť
                              // nedá, tak sa to ani neponúka. Pravidlo aj tak
                              // platí na serveri — toto len šetrí človeku chybu.
                              ...treeOptions(rows.map(r => ({ id: r.department.id, name: r.department.name, level: r.level })))
                                .filter(o => !inside.has(o.value)),
                            ]}
                          />
                          <button className="button button--quiet" type="submit">{t.departments.move}</button>
                        </form>

                        {p.withDescendants === 0 && inside.size === 1 ? (
                          <form action={deleteDepartmentAction}>
                            <input type="hidden" name="tab" value="departments" />
                            <input type="hidden" name="id" value={department.id} />
                            <button className="button button--quiet" type="submit">{t.departments.remove}</button>
                          </form>
                        ) : (
                          <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: 0 }}>{t.departments.removeHint}</p>
                        )}
                      </div>
                    </details>
                  ),
                }
              })}
            />
          )}
        </section>

        <form action={createDepartmentAction} className="card" style={{ padding: 20, display: "grid", gap: 14 }}>
          <input type="hidden" name="tab" value="departments" />
          <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{t.departments.newHeading}</h2>

          <label className="field">
            <span className="field-label">{t.departments.name}</span>
            <input className="field-input" name="name" placeholder={t.departments.namePlaceholder} required />
          </label>

          <label className="field">
            <span className="field-label">{t.departments.parent}</span>
            <Select language={language}
              name="parentId"
              initial=""
              options={[
                { value: "", label: t.departments.topLevel },
                // Hlbšie než povolené sa založiť nedá, tak sa to neponúka.
                ...treeOptions(rows.map(r => ({ id: r.department.id, name: r.department.name, level: r.level })))
                  .filter(o => depth(tenantDepartments, o.value) < MAX_DEPTH),
              ]}
            />
            <span className="quiet field-hint">{t.departments.maxDepth(MAX_DEPTH)}</span>
          </label>

          <div><button className="button" type="submit">{t.departments.create}</button></div>
        </form>
      </div>
      )}

      {now === "domains" && (
      <section className="card" style={{ padding: "18px 20px", display: "grid", gap: 14 }}>

        <ul className="admin-domains">
          {tenant.hostnames.map(h => (
            <li key={h} className="card" style={{ padding: "10px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600 }}>{h}</span>
              <span className="tag" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>{t.domains.works}</span>
              {tenant.hostnames.length > 1 && (
                <form action={cancelDomainAction} style={{ marginLeft: "auto" }}>
                  <input type="hidden" name="host" value={h} />
                  <input type="hidden" name="tab" value="domains" />
                  <button className="button button--quiet" type="submit" style={{ padding: "5px 10px", fontSize: "var(--fs-small)" }}>
                    {t.domains.remove}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {pending.length > 0 && (
          <ul className="admin-domains">
            {pending.map(z => {
              const p = domainInstruction(z.host)
              return (
                <li key={z.host} className="card" style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600 }}>{z.host}</span>
                    <span className="tag" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
                      {t.domains.waitingDns}
                    </span>
                    <span className="quiet" style={{ fontSize: "var(--fs-small)", marginLeft: "auto" }}>
                      {t.domains.since(formatDate(z.requestedAt, language))}
                    </span>
                  </div>

                  {p && (
                    <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-small)", overflowWrap: "anywhere" }}>
                      {t.domains.dnsBefore}<strong>{p.type}</strong>{t.domains.dnsMiddle}
                      <code>{p.name}</code> → <code>{p.value}</code>
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <form action={verifyDomainAction}>
                      <input type="hidden" name="host" value={z.host} />
                      <input type="hidden" name="tab" value="domains" />
                      <button className="button" type="submit" style={{ padding: "6px 14px", fontSize: "var(--fs-small)" }}>
                        {t.domains.verify}
                      </button>
                    </form>
                    <form action={cancelDomainAction}>
                      <input type="hidden" name="host" value={z.host} />
                      <input type="hidden" name="tab" value="domains" />
                      <button className="button button--quiet" type="submit" style={{ padding: "6px 14px", fontSize: "var(--fs-small)" }}>
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
          <label className="field">
            <span className="field-label">{t.domains.add}</span>
            <input className="field-input" name="host" placeholder={t.domains.hostPlaceholder} autoCapitalize="none" autoCorrect="off" />
            <span className="quiet field-hint">{t.domains.addNote}</span>
          </label>
          <div><button className="button button--quiet" type="submit">{t.domains.request}</button></div>
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
        <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: 0, maxWidth: 620 }}>
          {t.codelists.introBefore}<strong>{t.codelists.introHighlight}</strong>{t.codelists.introAfter}
        </p>

        {/* Rozcestník s počtom položiek (rám ADMIN, bod 5). */}
        <nav className="cl-nav" aria-label={t.tabs.codelists}>
          {codelists.map(c => (
            <a key={c.name} href={`#cl-${c.name}`}>
              {t.codelists.labels[c.name].name} <span>{c.vsetky.length}</span>
            </a>
          ))}
          <a href="#cl-legal">{tr.orgHeading} <span>{STANDARD_LEGAL_BASES.length + (tenant.legalBases ?? []).length}</span></a>
        </nav>

        {codelists.map(c => {
          const isCustom = (key: string) => c.vlastne.some(v => v.key === key)
          const base = c.vsetky.filter(p => !isCustom(p.key))
          const custom = c.vsetky.filter(p => isCustom(p.key))
          const row = (p: (typeof c.vsetky)[number]) => {
            const own = isCustom(p.key)
            return (
              <div key={p.key} className="cl-row">
                <span className="cl-name">{p.label ?? p.key}</span>
                <code className="cl-key">{p.key}</code>
                <span className="cl-use">
                  {!own ? <span className="cl-badge">{t.codelists.baseBadge}</span>
                    : c.pocty[p.key] > 0 ? t.codelists.used(c.pocty[p.key]) : ""}
                </span>
                <span className="cl-act">
                  {own && (
                    <form action={removeCodelistItemAction}>
                      <input type="hidden" name="tab" value="codelists" />
                      <input type="hidden" name="codelist" value={c.name} />
                      <input type="hidden" name="key" value={p.key} />
                      <button className="button button--quiet" type="submit">{t.codelists.remove}</button>
                    </form>
                  )}
                </span>
              </div>
            )
          }
          return (
          <section key={c.name} id={`cl-${c.name}`} className="card cl">
            <div className="cl-head">
              <h2>{t.codelists.labels[c.name].name}</h2>
              <p>{t.codelists.labels[c.name].hint}</p>
            </div>
            <div className="cl-row cl-th" aria-hidden="true">
              <span>{t.codelists.colName}</span><span>{t.codelists.colKey}</span><span>{t.codelists.colUse}</span><span />
            </div>
            {/* Základné položky nad tri zbalené (rám, Q3 — Ján 24. 9.): sú tu
                vždy a nedá sa s nimi nič robiť. Vlastné sú vidieť celé. */}
            {base.slice(0, 3).map(row)}
            {base.length > 3 && (
              <details className="cl-more">
                <summary>{t.codelists.moreBase(base.length - 3)}</summary>
                {base.slice(3).map(row)}
              </details>
            )}
            {custom.map(row)}

            <form action={addCodelistItemAction} className="tree-form cl-add">
              <input type="hidden" name="tab" value="codelists" />
              <input type="hidden" name="codelist" value={c.name} />
              {/* Kľúč sa predgeneruje z názvu (ako pri novom dokumente, ADR-010).
                  Príklad v poli je `placeholder` pre daný číselník (rám, bod 7). */}
              <KeyFromLabel
                usedKeys={c.vsetky.map(p => p.key)}
                labels={{
                  label: t.codelists.newItemLabel(t.codelists.labels[c.name].name),
                  labelPlaceholder: t.codelists.examples[c.name]?.label ?? t.codelists.newItemPlaceholder,
                  key: t.codelists.key,
                  keyPlaceholder: t.codelists.examples[c.name]?.key ?? t.codelists.keyPlaceholder,
                  taken: t.codelists.keyTakenHint,
                }}
              />
              <button className="button button--quiet" type="submit">{t.codelists.add}</button>
            </form>
            <p className="quiet cl-note">{t.codelists.keyNote}</p>
          </section>
          )
        })}

        {/*
          Právne základy (D92). Iný tvar než ostatné číselníky — položka má
          kategóriu a odkaz na predpis — a nič sa nemaže: štandardná sa skryje,
          vlastná vyradí. Znenia si nesú kópiu, takže sa ich to nedotkne.
          Zoskupené podľa kategórie, odkaz na predpis pod názvom, akcia vždy
          v stĺpci (rám, bod 8).
        */}
        <section id="cl-legal" className="card cl">
          <div className="cl-head">
            <h2>{tr.orgHeading}</h2>
            <p>{tr.orgHint}</p>
          </div>
          <div className="cl-row cl-th" aria-hidden="true">
            <span>{t.codelists.colName}</span><span>{t.codelists.colKey}</span><span>{t.codelists.colUse}</span><span />
          </div>
          {LEGAL_BASES.map(group => {
            const items = [
              ...STANDARD_LEGAL_BASES.map(i => ({ ...i, source: "standard" as const, off: hiddenBases.has(i.key) })),
              ...(tenant.legalBases ?? []).map(i => ({ ...i, source: "custom" as const, off: Boolean(i.retiredAt) })),
            ].filter(i => i.basis === group)
            if (items.length === 0) return null
            return (
              <div key={group}>
                <div className="cl-group">{tr.basisLabel[group]}</div>
                {items.map(i => (
                  <div key={i.key} className={`cl-row${i.off ? " is-off" : ""}`}>
                    <span className="cl-name">
                      {i.label}
                      {i.reference && <span className="cl-sub">{i.reference}</span>}
                    </span>
                    <code className="cl-key">{i.key}</code>
                    <span className="cl-use">
                      {(basisUsage.get(i.key) ?? 0) > 0
                        ? tr.usedIn(basisUsage.get(i.key) ?? 0)
                        : <span className="cl-badge">{i.source === "standard" ? tr.standardTag : tr.customTag}</span>}
                      {i.off && ` · ${i.source === "standard" ? tr.hiddenTag : tr.retiredTag}`}
                    </span>
                    <span className="cl-act">
                      {i.source === "standard" && (
                        <form action={toggleStandardLegalBasisAction}>
                          <input type="hidden" name="tab" value="codelists" />
                          <input type="hidden" name="key" value={i.key} />
                          <input type="hidden" name="hidden" value={i.off ? "0" : "1"} />
                          <button className="button button--quiet" type="submit">{i.off ? tr.unhide : tr.hide}</button>
                        </form>
                      )}
                      {i.source === "custom" && !i.off && (
                        <form action={retireLegalBasisAction}>
                          <input type="hidden" name="tab" value="codelists" />
                          <input type="hidden" name="key" value={i.key} />
                          <button className="button button--quiet" type="submit">{tr.retire}</button>
                        </form>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}

          <details className="cl-more cl-add-basis">
            <summary>+ {tr.addHeading}</summary>
          <form action={addLegalBasisAction} style={{ display: "grid", gap: 10, padding: "12px 18px 18px" }}>
            <input type="hidden" name="tab" value="codelists" />
            <KeyFromLabel
              layout="fields"
              usedKeys={[...STANDARD_LEGAL_BASES.map(i => i.key), ...(tenant.legalBases ?? []).map(i => i.key)]}
              labels={{
                label: tr.labelField,
                labelPlaceholder: tr.labelPlaceholder,
                key: tr.keyField,
                keyPlaceholder: tr.keyPlaceholder,
                taken: t.codelists.keyTakenHint,
              }}
            />
            <fieldset className="hr-group">
              <legend className="field-label">{tr.categoryField}</legend>
              {LEGAL_BASES.map(b => (
                <label key={b} className="hr-choice">
                  <input type="radio" name="basis" value={b} required />
                  <span>
                    {tr.basisLabel[b]}
                    <span className="quiet field-hint"> {tr.basisHint[b]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="field">
              <span className="field-label">{tr.referenceField}</span>
              <input className="field-input" name="reference" maxLength={MAX_LEGAL_REFERENCE_FIELD}
                     placeholder={tr.referencePlaceholder} />
              <span className="quiet field-hint">{tr.referenceNote}</span>
            </label>
            <div><button className="button button--quiet" type="submit">{tr.addButton}</button></div>
          </form>
          </details>
        </section>
      </div>
      )}

      {now === "chunking" && (
      <form action={saveChunkingProfileAction} className="card" style={{ padding: 20, display: "grid", gap: 16 }}>
        <input type="hidden" name="tab" value="chunking" />

        <div>
          <h2 style={{ fontSize: "var(--fs-section)", margin: "0 0 4px" }}>{t.chunking.heading}</h2>
          <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: 0 }}>
            {t.chunking.introBefore}
            <strong>{t.chunking.introHighlight}</strong>{t.chunking.introAfter}
          </p>
        </div>

        <label className="field">
          <span className="field-label">{t.chunking.articleWord}</span>
          <input className="field-input" name="articleWord"
                 defaultValue={chunkingValues.articleWord ?? DEFAULT_CHUNKING.articleWord} />
          <span className="quiet field-hint">
            {t.chunking.articleNote1}<code>Článok</code>{t.chunking.articleNote2}<code>§</code>
            {t.chunking.articleNote3}<code>Bod</code>{t.chunking.articleNote4}
            <strong>{t.chunking.articleNoteHighlight}</strong>{t.chunking.articleNote5}
          </span>
        </label>

        <label className="field">
          <span className="field-label">{t.chunking.annexWord}</span>
          <input className="field-input" name="annexWord"
                 defaultValue={chunkingValues.annexWord ?? DEFAULT_CHUNKING.annexWord} />
          <span className="quiet field-hint">{t.chunking.annexWordNote}</span>
        </label>

        <label className="field">
          <span className="field-label">{t.chunking.headerRepeats}</span>
          <input className="field-input" type="number" name="headerRepeats" min={2} max={50}
                 defaultValue={chunkingValues.headerRepeats ?? DEFAULT_CHUNKING.headerRepeats} />
          <span className="quiet field-hint">{t.chunking.headerRepeatsNote}</span>
        </label>

        <label className="field">
          <span className="field-label">{t.chunking.minTokens}</span>
          <input className="field-input" type="number" name="minTokens" min={50} max={2000}
                 defaultValue={chunkingValues.minTokens ?? DEFAULT_CHUNKING.minTokens} />
        </label>

        <label className="field">
          <span className="field-label">{t.chunking.maxTokens}</span>
          <input className="field-input" type="number" name="maxTokens" min={100} max={4000}
                 defaultValue={chunkingValues.maxTokens ?? DEFAULT_CHUNKING.maxTokens} />
          <span className="quiet field-hint">
            {t.chunking.tokensNoteBefore}<code>300–800</code>{t.chunking.tokensNoteAfter}
          </span>
        </label>

        <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: 0 }}>
          {t.chunking.saveNoteBefore}<strong>{t.chunking.saveNoteHighlight}</strong>
          {t.chunking.saveNoteMiddle}<em>{t.chunking.saveNoteButton}</em>{t.chunking.saveNoteAfter}
        </p>

        <div><button className="button" type="submit">{t.chunking.save}</button></div>
      </form>
      )}

      {now === "chunking" && indexState && (
      <form action={reindexAllAction} className="card" style={{ padding: 20, display: "grid", gap: 12, marginTop: 16 }}>
        <input type="hidden" name="tab" value="chunking" />
        <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{t.chunking.reindexAllHeading}</h2>

        {indexState.neaktualnych === 0 ? (
          <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: 0 }}>
            {t.chunking.allUpToDate(indexState.celkom)}
          </p>
        ) : (
          <>
            <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: 0 }}>
              <strong>{indexState.neaktualnych}</strong>{t.chunking.outdatedOf(indexState.celkom)}
              <strong>{t.chunking.outdatedHighlight}</strong>{t.chunking.outdatedAfter}
            </p>
            <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: 0 }}>{t.chunking.batchNote}</p>
            <div>
              <button className="button" type="submit">
                {t.chunking.reindexAll(indexState.neaktualnych)}
              </button>
            </div>
          </>
        )}
      </form>
      )}

      {now === "audit" && (
      <div>
        <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: "0 0 16px", maxWidth: 620 }}>
          {t.auditTab.introBefore}<strong>{t.auditTab.introHighlight}</strong>{t.auditTab.introAfter}
        </p>

        {/* Formulár metódou GET: filter je v adrese, dá sa poslať odkazom
            a funguje bez jediného riadku JavaScriptu. */}
        <LiveFilter className="audit-filter" action="/organisation" label={t.auditTab.search}>
          <input type="hidden" name="tab" value="audit" />
          <label className="field">
            <span className="field-label">{t.auditTab.search}</span>
            <input
              className="field-input"
              name="search"
              defaultValue={search ?? ""}
              placeholder={t.auditTab.searchPlaceholder}
              autoCapitalize="none"
            />
          </label>
          <button className="button button--quiet" type="submit">{t.auditTab.searchSubmit}</button>
          {search ? (
            <Link className="quiet" href="/organisation?tab=audit" style={{ fontSize: "var(--fs-body)" }}>
              {t.auditTab.clearFilter}
            </Link>
          ) : null}
        </LiveFilter>

        <AuditList records={records} language={language} />

        {records.length >= 200 && (
          <p className="quiet" style={{ fontSize: "var(--fs-small)", marginTop: 14 }}>{t.auditTab.capped}</p>
        )}
      </div>
      )}
    </div>
    </AppShell>
  )
}
