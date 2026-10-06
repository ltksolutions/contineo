/**
 * Nastavenie organizácie — jedna časť, `/organisation/{section}` (D48).
 *
 * Každá časť má vlastnú cestu (2. 10. 2026, Ján, možnosť 1): cesta pod
 * hlavičkou nesie názov časti a adresa vždy zodpovedá tomu, čo je na
 * obrazovke. Rozcestník je `/organisation` (`../page.tsx`), staré
 * `?tab=` prekladá `proxy.ts` (`legacyOrgSection`). Rozloženie podľa
 * ZAKLAD-zalozky (1. 10. 2026): zoznam častí vľavo od 1024 px, pod tým
 * časť; späť vedie cesta pod hlavičkou (ZAKLAD-podmenu-a-akcie, 2. 10. 2026).
 *
 * Čo tu **je**: vzhľad, jazyky, vlastné prihlasovacie údaje, domény
 * s overením a domény pre automatické zakladanie.
 *
 * Čo tu **nie je**: vypnutie organizácie a jej kód. To sú veci medzi
 * zákazníkom a nami a zostávajú v `/admin`, kde má správca platformy naďalej
 * plnú správu všetkých organizácií — kvôli podpore a helpdesku.
 */

import { notFound, redirect } from "next/navigation"
import TabLink from "@/components/TabLink"
import TabsBar from "@/components/TabsBar"
import OrgNav from "@/components/OrgNav"
import { isOrgSection, orgSectionHref, type OrgSection } from "@/lib/orgSections"
import SubmitButton from "@/components/SubmitButton"
import { treeOptions } from "@/lib/treeOptions"
import Link from "next/link"
import { orgPageContext } from "@/lib/orgSettings"
import { retentionSettings, RETENTION_LIMITS } from "@/lib/retention"
import { saveGdprContactAction, saveRetentionAction, saveExtraAction } from "@/app/dpo/actions"
import { domainRequests, domainInstruction } from "@/lib/customerDomains"
import { providerStatus, PROVIDER_LABEL, PROVIDER_ID } from "@/lib/oauth"
import { brandingView, tenantByCompanyCode } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import LiveFilter from "@/components/LiveFilter"
import SearchStrip from "@/components/SearchStrip"
import { countryForPrefix, phoneCountries } from "@/lib/phoneCountries"
import { UI_LANGUAGES, formatDate, dictionary } from "@/lib/i18n"
import type { UiLanguage } from "@/lib/i18n"
import Select from "@/components/Select"
import ColorSelect from "@/components/ColorSelect"
import Notice from "@/components/Notice"
import { saveAiSettingsAction, deleteAiKeyAction } from "../actions"
import { AI_MODELS, aiSettingsView } from "@/lib/aiSettings"
import { AI_USAGE_PURPOSES, usageFilterFromQuery, usageRows, usageTotals, usagePeople } from "@/lib/aiUsage"
import { ratesForDate, formatUsd } from "@/lib/pricing"

import { saveBrandingAction, saveAutoProvisionAction, deleteLogoAction, saveSignInAction, deleteSignInAction, requestDomainAction, verifyDomainAction, cancelDomainAction } from "../actions"
import { createDepartmentAction, renameDepartmentAction, moveDepartmentAction, deleteDepartmentAction } from "../actions"
import { addCodelistItemAction, removeCodelistItemAction, saveAcknowledgementAction } from "../actions"
import { overdueDaysFor } from "@/lib/reminders"
import { shiftDepartmentAction, saveDepartmentOrderAction } from "../actions"
import TreeWithOrder from "@/components/TreeWithOrder"
import KeyFromLabel from "@/components/KeyFromLabel"
import { availableOptions, customItems, codelistUsage } from "@/lib/codelistsTenant"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
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
} from "../actions"


export const dynamic = "force-dynamic"

/** Koľko riadkov spotreby ukáže obrazovka; export berie celé obdobie. */
const USAGE_SCREEN_LIMIT = 500

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

        <div><SubmitButton className="button">{t.save}</SubmitButton></div>
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
          <div><SubmitButton className="button button--quiet">{t.deleteSubmit}</SubmitButton></div>
        </form>
      )}
    </section>
  )
}

export default async function OrganisationSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>
  searchParams: Promise<RawQuery>
}) {
  const ctx = await orgPageContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const query = normalizeQuery<{ msg?: string; error?: string; search?: string; list?: string; view?: string; from?: string; to?: string; person?: string; purpose?: string }>(await searchParams)
  const { msg: message, error, search, list: listParam } = query
  const { section } = await params
  // Neznáma časť je 404 — adresa je zmluva, nie návrh. DPO bez roly
  // správcu osôb má len GDPR (D154); ostatné časti preňho neexistujú.
  if (!isOrgSection(section)) notFound()
  if (!ctx.canAdmin && section !== "gdpr") notFound()
  const now: OrgSection = section
  // Jedna časť (DPO, D154): bez zoznamu a bez odkazu späť — nie je kam.
  const single = !ctx.canAdmin
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
  // Náhľad úvodnej vety pozvánky z uložených hodnôt (rovnaké skladanie ako `inviteEmail`).
  const inviteIntro = d.inviteEmail.intro(tenant.controller?.legalName?.trim() || tenant.branding.displayName, tenant.branding.displayName)
  const pending = ctx.canAdmin
    ? (await domainRequests(tenant.companyCode)).filter(z => !tenant.hostnames.includes(z.host))
    : []
  const retention = retentionSettings(tenant.privacy?.retention)
  const tt = d.dpo.retention

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
  // Číselníky ako záložky (3. 10. 2026): jeden číselník naraz, `?list=`.
  // Neznáma hodnota padá na prvý — starý odkaz s kotvou `#cl-…` tiež.
  const codelistTabs = [...CUSTOM_CODELISTS, "legal"] as const
  const list: (typeof codelistTabs)[number] = (codelistTabs as readonly string[]).includes(listParam ?? "")
    ? listParam as (typeof codelistTabs)[number] : "category"
  const hiddenBases = new Set(tenant.legalBasesHidden ?? [])
  const tr = d.responsibility

  // Nastavenie AI (D157) — len pre svoju časť; kľúč sa sem nedostane.
  const aiView: "settings" | "usage" = query.view === "usage" ? "usage" : "settings"
  const ai = now === "ai" && aiView === "settings" ? aiSettingsView(tenant.ai) : null
  const tu = t.aiUsage
  // Spotreba (D158): súčty za celé obdobie, na obrazovke najnovších 500.
  const usage = now === "ai" && aiView === "usage"
    ? await (async () => {
        const filter = usageFilterFromQuery(query)
        const [rows, totals, people] = await Promise.all([
          usageRows(tenant.companyCode, filter, USAGE_SCREEN_LIMIT),
          usageTotals(tenant.companyCode, filter),
          usagePeople(tenant.companyCode),
        ])
        const q = new URLSearchParams({ from: filter.fromText, to: filter.toText })
        if (filter.personId) q.set("person", filter.personId)
        if (filter.purpose) q.set("purpose", filter.purpose)
        return { filter, rows, totals, people, query: q.toString() }
      })()
    : null
  const locale = language === "en" ? "en-GB" : language === "cs" ? "cs-CZ" : "sk-SK"
  const num = (n: number) => new Intl.NumberFormat(locale).format(n)
  // Čas volania v miestnom čase organizácie, nie UTC — „o 23:30" má byť
  // ten istý deň, aký si človek pamätá.
  const when = (d: Date) => new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Bratislava", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d)
  const modelName = (id: string) =>
    Object.values(AI_MODELS).flat().find(m => m.id === id)?.label ?? id
  // „Claude Sonnet 5 — vstup 2 $ · výstup 10 $" (cena za milión tokenov dnes).
  const modelLabel = (id: string, label: string) => {
    const r = ratesForDate(id).sadzby
    return r ? `${label} — ${t.ai.price(String(r.input), String(r.output))}` : label
  }

  const records = now === "audit"
    ? await auditRecords(tenant.companyCode, { search: search, limit: 200 })
    : []

  return (
    <AppShell language={ctx.person.language} title={t.tabs[now]} trail={{ "/organisation": t.heading }}>
    <div className="org-set" style={tenantStyle(branding)}>
      <Notice
        message={message}
        error={error === "1"}
        back={orgSectionHref(now)}
      />

      <div className="org-head">
        <h1 className="page-title">{t.heading}</h1>
        <p className="quiet page-lead" style={{ margin: "0 0 22px", maxWidth: 620 }}>
          {t.introBefore}<strong>{tenant.companyCode}</strong>{t.introAfter}
        </p>
      </div>

      <div className={single ? "org-grid org-grid--single" : "org-grid"}>
      {!single && <OrgNav current={now} label={t.tabsLabel} groups={t.groups} sections={t.tabs} />}

      <div className="org-body">

      {/*
        Všeobecné (do 3. 10. 2026 „Vzhľad a jazyky") v sekciách (rám ADMIN-prevadzkovatel-a-ciselniky):
        nadpis a vysvetlenie vľavo, polia vpravo (od 1024 px), jeden
        formulár a jedno Uložiť v lište, ktorá je vždy na dosah.
      */}
      {now === "general" && (
      <form action={saveBrandingAction} className="card set-form">
        <input type="hidden" name="tab" value="general" />

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

            {/*
              Prevádzkovateľ (C1, ADR-012) v jednom bloku s názvom portálu
              (Ján 28. 9. 2026): pozvánka ich skladá do jednej vety
              „{Právny názov} vás pozýva do {Názov portálu}". Pod poľami náhľad
              viet z uložených hodnôt — bez JavaScriptu, takže ukazuje, čo platí.
            */}
            <h3 className="set-sub">{t.branding.controller}</h3>
            <p className="quiet field-hint set-sub-note">{t.branding.controllerNote}</p>
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
            {/* Krajina určuje dozorný úrad a zákony na stránke Ochrana osobných údajov (ADR-022). */}
            <label className="field">
              <span className="field-label">{t.branding.controllerCountry}</span>
              <select className="field-input" name="controllerCountry" defaultValue={tenant.controller?.country ?? "SK"}>
                {(["SK", "CZ"] as const).map(c => <option key={c} value={c}>{t.branding.countries[c]}</option>)}
              </select>
            </label>
            <p className="set-preview">
              {t.branding.invitePreview}{" "}
              <b>„{inviteIntro}“</b>
            </p>
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

            {/* Predvolená krajina telefónu (D86). Zoznam namiesto voľného poľa
                (4. 10. 2026): do poľa „Predvoľba" sa písalo celé číslo. Ukladá
                sa naďalej predvoľba (`+421`), krajinu z nej odvodí
                `countryForPrefix()`. */}
            <div className="field">
              <span className="field-label">{t.branding.phonePrefix}</span>
              <Select language={language}
                name="phoneCountry"
                fieldLabel={t.branding.phonePrefix}
                initial={countryForPrefix(tenant.phonePrefix)}
                options={phoneCountries(language).map(c => ({ value: c.code, label: c.label }))}
              />
              <span className="quiet field-hint">{t.branding.phonePrefixNote}</span>
            </div>
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

        <div className="set-savebar">
          <SubmitButton className="button">{t.branding.save}</SubmitButton>
          <span className="quiet">{t.branding.saveBarNote}</span>
        </div>
      </form>
      )}

      {/* Formulár odstránenia loga — samostatný (formuláre sa vnárať nedajú),
          volá ho tlačidlo pri logu cez `form="remove-logo"`. */}
      {now === "general" && tenant.branding.logoUrl && (
        <form id="remove-logo" action={deleteLogoAction} hidden>
          <input type="hidden" name="tab" value="general" />
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
                            <SubmitButton className="button button--quiet"
                                    ariaLabel={t.departments.moveUp(department.name)}>{t.departments.up}</SubmitButton>
                          </form>
                          <form action={shiftDepartmentAction}>
                            <input type="hidden" name="tab" value="departments" />
                            <input type="hidden" name="id" value={department.id} />
                            <input type="hidden" name="direction" value="down" />
                            <SubmitButton className="button button--quiet"
                                    ariaLabel={t.departments.moveDown(department.name)}>{t.departments.down}</SubmitButton>
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
                          <SubmitButton className="button button--quiet">{t.departments.rename}</SubmitButton>
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
                          <SubmitButton className="button button--quiet">{t.departments.move}</SubmitButton>
                        </form>

                        {p.withDescendants === 0 && inside.size === 1 ? (
                          <form action={deleteDepartmentAction}>
                            <input type="hidden" name="tab" value="departments" />
                            <input type="hidden" name="id" value={department.id} />
                            <SubmitButton className="button button--quiet">{t.departments.remove}</SubmitButton>
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

          <div><SubmitButton className="button">{t.departments.create}</SubmitButton></div>
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
                  <SubmitButton className="button button--quiet" style={{ padding: "5px 10px", fontSize: "var(--fs-small)" }}>
                    {t.domains.remove}
                  </SubmitButton>
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
                      <SubmitButton className="button" style={{ padding: "6px 14px", fontSize: "var(--fs-small)" }}>
                        {t.domains.verify}
                      </SubmitButton>
                    </form>
                    <form action={cancelDomainAction}>
                      <input type="hidden" name="host" value={z.host} />
                      <input type="hidden" name="tab" value="domains" />
                      <SubmitButton className="button button--quiet" style={{ padding: "6px 14px", fontSize: "var(--fs-small)" }}>
                        {t.domains.cancelRequest}
                      </SubmitButton>
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
          <div><SubmitButton className="button button--quiet">{t.domains.request}</SubmitButton></div>
        </form>
      </section>
      )}

      {now === "signin" && (
      <div style={{ display: "grid", gap: 16 }}>
        <ProviderRow tenant={tenant} provider="microsoft" domain={tenant.hostnames[0]} language={language} />
        <ProviderRow tenant={tenant} provider="google" domain={tenant.hostnames[0]} language={language} />

        {/*
          Automatické založenie patrí k prihlasovaniu, nie k vzhľadu (Ján
          25. 9. 2026). Sú to **e-mailové domény pracovných kont**, nie webové
          adresy portálu zo záložky Domény — preto to veta hovorí nahlas.
        */}
        <form action={saveAutoProvisionAction} className="card" style={{ padding: "18px 20px", display: "grid", gap: 12 }}>
          <input type="hidden" name="tab" value="signin" />
          <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{t.branding.secAutoProvision}</h2>
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
            <span className="quiet field-hint">{t.branding.autoProvisionNotHosts}</span>
          </label>
          <div><SubmitButton className="button">{t.branding.save}</SubmitButton></div>
        </form>
      </div>
      )}

      {now === "codelists" && (
      // `minmax(0, 1fr)`: bez neho sa stĺpec mriežky roztiahne na šírku pásu
      // záložiek a na telefóne roztiahne celú stránku (565 px pri 375 px,
      // 3. 10. 2026) — pás sa má posúvať, nie tlačiť.
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr)" }}>
        <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: 0, maxWidth: 620 }}>
          {t.codelists.introBefore}<strong>{t.codelists.introHighlight}</strong>{t.codelists.introAfter}
        </p>

        {/* Záložky — jeden číselník naraz (Ján 3. 10. 2026). Bez počtu položiek: nič nehlásil. */}
        <nav className="tabs" aria-label={t.tabs.codelists}>
          <TabsBar>
            {codelists.map(c => (
              <TabLink key={c.name} href={`/organisation/codelists?list=${c.name}`} active={list === c.name}>
                {t.codelists.labels[c.name].name}
              </TabLink>
            ))}
            <TabLink href="/organisation/codelists?list=legal" active={list === "legal"}>
              {tr.orgHeading}
            </TabLink>
          </TabsBar>
        </nav>

        {codelists.filter(c => c.name === list).map(c => {
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
                      <input type="hidden" name="list" value={list} />
                      <input type="hidden" name="codelist" value={c.name} />
                      <input type="hidden" name="key" value={p.key} />
                      <SubmitButton className="button button--quiet">{t.codelists.remove}</SubmitButton>
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
                      <input type="hidden" name="list" value={list} />
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
              <SubmitButton className="button button--quiet">{t.codelists.add}</SubmitButton>
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
        {list === "legal" && (
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
                      <input type="hidden" name="list" value={list} />
                          <input type="hidden" name="key" value={i.key} />
                          <input type="hidden" name="hidden" value={i.off ? "0" : "1"} />
                          <SubmitButton className="button button--quiet">{i.off ? tr.unhide : tr.hide}</SubmitButton>
                        </form>
                      )}
                      {i.source === "custom" && !i.off && (
                        <form action={retireLegalBasisAction}>
                          <input type="hidden" name="tab" value="codelists" />
                      <input type="hidden" name="list" value={list} />
                          <input type="hidden" name="key" value={i.key} />
                          <SubmitButton className="button button--quiet">{tr.retire}</SubmitButton>
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
                      <input type="hidden" name="list" value={list} />
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
            <div><SubmitButton className="button button--quiet">{tr.addButton}</SubmitButton></div>
          </form>
          </details>
        </section>
        )}
      </div>
      )}

      {/*
        Potvrdzovanie (3. 10. 2026). Len prah meškania — termín potvrdenia
        je na pridelení a na trase, nie tu (ADR-004).
      */}
      {now === "acknowledgements" && (
      <form action={saveAcknowledgementAction} className="card" style={{ padding: 20, display: "grid", gap: 16 }}>
        <input type="hidden" name="tab" value="acknowledgements" />
        <div>
          <h2 style={{ fontSize: "var(--fs-section)", margin: "0 0 4px" }}>{t.acknowledgements.heading}</h2>
          <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: 0 }}>{t.acknowledgements.intro}</p>
        </div>
        <label className="field" style={{ maxWidth: 260 }}>
          <span className="field-label">{t.acknowledgements.overdueDays}</span>
          <input className="field-input" type="number" name="overdueDays" min={1} max={365} required
                 defaultValue={overdueDaysFor(tenant)} />
        </label>
        <span className="quiet field-hint">{t.acknowledgements.overdueDaysNote}</span>
        <div><SubmitButton className="button">{t.acknowledgements.save}</SubmitButton></div>
      </form>
      )}

      {now === "audit" && (
      <div>
        <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: "0 0 16px", maxWidth: 620 }}>
          {t.auditTab.introBefore}<strong>{t.auditTab.introHighlight}</strong>{t.auditTab.introAfter}
        </p>

        {/* Formulár metódou GET: filter je v adrese, dá sa poslať odkazom
            a funguje bez jediného riadku JavaScriptu. */}
        <LiveFilter className="audit-filter" action="/organisation/audit" label={t.auditTab.search}>
          {/* Pás s lupou vnútri (`SearchStrip`, ZAKLAD odchýlka B) — hľadá sa
              reťazec v zozname záznamov, rovnako ako v knižnici, adresári
              a osobách. Tlačidlo je len pre čítačku; Enter aj `LiveFilter`
              odosielajú sami. */}
          <SearchStrip
            name="search"
            defaultValue={search ?? ""}
            placeholder={t.auditTab.searchPlaceholder}
            label={t.auditTab.search}
            submitLabel={t.auditTab.searchSubmit}
            autoCapitalize="none"
          />
          {search ? (
            <Link className="audit-filter-clear" href="/organisation/audit">
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

      {/*
        Umelá inteligencia (D157, 5. 10. 2026): kľúč a modely. Kľúč sa nikdy
        neukazuje — ani zašifrovaný; obrazovka vie len, či je nastavený,
        jeho koncovku a kto ho kedy zadal.
      */}
      {now === "ai" && (
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr)" }}>
        {/* Nastavenie a Spotreba (ADR-026) — dve časti tej istej sekcie, `?view=`. */}
        <nav className="tabs" aria-label={t.tabs.ai}>
          <TabsBar>
            <TabLink href="/organisation/ai" active={aiView === "settings"}>{tu.tabSettings}</TabLink>
            <TabLink href="/organisation/ai?view=usage" active={aiView === "usage"}>{tu.tabUsage}</TabLink>
          </TabsBar>
        </nav>

      {aiView === "settings" && ai && (
      <>
      <form action={saveAiSettingsAction} className="card set-form">
        <input type="hidden" name="tab" value="ai" />
        <p className="quiet" style={{ margin: 0, padding: "18px 20px 0", maxWidth: 680 }}>{t.ai.intro}</p>

        <section className="set-sec">
          <div className="set-sec-head">
            <h2>{t.ai.secProvider}</h2>
            <p>{t.ai.providerNote}</p>
          </div>
          <div className="set-sec-body">
            <p style={{ margin: 0, fontWeight: 600 }}>{t.ai.provider}</p>
          </div>
        </section>

        <section className="set-sec" id="key">
          <div className="set-sec-head">
            <h2>{t.ai.secKey}</h2>
            <p>{t.ai.secKeyNote}</p>
          </div>
          <div className="set-sec-body">
            <p style={{ margin: 0 }}>
              {ai.hasOwnKey
                ? t.ai.keyOwn(ai.apiKeyHint ?? "", ai.apiKeySetAt ? formatDate(ai.apiKeySetAt, language) : "—", ai.apiKeySetBy ?? "—")
                : ai.operatorKeyAvailable ? t.ai.keyOperator : t.ai.keyNone}
            </p>
            <label className="field">
              <span className="field-label">{t.ai.keyLabel}</span>
              <input className="field-input" name="apiKey" type="password" autoComplete="off"
                     spellCheck={false} placeholder="sk-ant-…" />
              <span className="quiet field-hint">{t.ai.keyHint}</span>
            </label>
            {ai.hasOwnKey && (
              <div>
                <button className="button button--quiet" type="submit" form="remove-ai-key">{t.ai.deleteKey}</button>
                <span className="quiet field-hint" style={{ display: "block", marginTop: 6 }}>{t.ai.deleteKeyNote}</span>
              </div>
            )}
          </div>
        </section>

        <section className="set-sec" id="models">
          <div className="set-sec-head">
            <h2>{t.ai.secModels}</h2>
            <p>{t.ai.secModelsNote}</p>
          </div>
          <div className="set-sec-body">
            <div className="field">
              <span className="field-label">{t.ai.answer}</span>
              <Select language={language}
                name="modelAnswer"
                fieldLabel={t.ai.answer}
                initial={ai.models.answer}
                options={AI_MODELS.answer.map(m => ({ value: m.id, label: modelLabel(m.id, m.label) }))}
              />
              <span className="quiet field-hint">{t.ai.answerNote}</span>
            </div>
            {/* Jediná voľba — text, nie zoznam (Haiku 4.5, `AI_MODELS.utility`). */}
            <div className="field">
              <span className="field-label">{t.ai.utility}</span>
              <p style={{ margin: 0 }}>{AI_MODELS.utility.map(m => modelLabel(m.id, m.label)).join(", ")}</p>
              <span className="quiet field-hint">{t.ai.utilityNote}</span>
            </div>
            <div className="field">
              <span className="field-label">{t.ai.rewrite}</span>
              <Select language={language}
                name="modelRewrite"
                fieldLabel={t.ai.rewrite}
                initial={ai.models.rewrite}
                options={AI_MODELS.rewrite.map(m => ({ value: m.id, label: modelLabel(m.id, m.label) }))}
              />
              <span className="quiet field-hint">{t.ai.rewriteNote}</span>
            </div>
          </div>
        </section>

        <div className="set-savebar">
          <SubmitButton className="button">{t.ai.save}</SubmitButton>
        </div>
      </form>
      {/* Odstránenie kľúča — vlastný formulár, tlačidlo je hore pri kľúči. */}
      <form id="remove-ai-key" action={deleteAiKeyAction} hidden>
        <input type="hidden" name="tab" value="ai" />
      </form>
      </>
      )}

      {/*
        Spotreba (D158): filter obdobia od–do, osoby a účelu; súčty za celé
        obdobie, najnovších 500 riadkov, export CSV a Excel s tými istými
        filtrami (`/api/ai-usage`). Formulár je GET — stav je v adrese.
      */}
      {aiView === "usage" && usage && (
      <>
        <form action="/organisation/ai" method="get" className="card usage-filter">
          <input type="hidden" name="view" value="usage" />
          <label className="field">
            <span className="field-label">{tu.from}</span>
            <input className="field-input" type="date" name="from" defaultValue={usage.filter.fromText} />
          </label>
          <label className="field">
            <span className="field-label">{tu.to}</span>
            <input className="field-input" type="date" name="to" defaultValue={usage.filter.toText} />
          </label>
          <label className="field">
            <span className="field-label">{tu.person}</span>
            {/* Obyčajný `<select>` — filter musí fungovať bez JavaScriptu. */}
            <select className="field-input" name="person" defaultValue={usage.filter.personId ?? ""}>
              <option value="">{tu.all}</option>
              {usage.people.map(p => <option key={p.personId} value={p.personId}>{p.personName}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{tu.purpose}</span>
            <select className="field-input" name="purpose" defaultValue={usage.filter.purpose ?? ""}>
              <option value="">{tu.all}</option>
              {AI_USAGE_PURPOSES.map(p => <option key={p} value={p}>{tu.purposes[p].label}</option>)}
            </select>
          </label>
          <div><button className="button" type="submit">{tu.apply}</button></div>
        </form>

        <div className="usage-summary card">
          <div><span className="quiet">{tu.calls}</span><strong>{num(usage.totals.calls)}</strong></div>
          <div><span className="quiet">{tu.tokensIn}</span><strong>{num(usage.totals.tokens.input)}</strong></div>
          <div><span className="quiet">{tu.tokensOut}</span><strong>{num(usage.totals.tokens.output)}</strong></div>
          <div><span className="quiet">{tu.tokensCache}</span><strong>{num(usage.totals.tokens.cacheRead + usage.totals.tokens.cacheWrite)}</strong></div>
          <div><span className="quiet">{tu.total}</span><strong>{formatUsd(usage.totals.usd)}</strong></div>
          <span className="page-head-spacer" aria-hidden="true" />
          <div className="usage-export">
            <a className="button button--quiet" href={`/api/ai-usage?format=csv&${usage.query}`}>{tu.exportCsv}</a>
            <a className="button button--quiet" href={`/api/ai-usage?format=xlsx&${usage.query}`}>{tu.exportXlsx}</a>
          </div>
        </div>

        {usage.rows.length === 0 ? (
          <div className="empty">
            <div className="empty-title">{tu.empty}</div>
            <div className="empty-text">{tu.emptyText}</div>
          </div>
        ) : (
          <div className="usage-table" role="table">
            <div className="usage-row usage-head" role="row" aria-hidden="true">
              <span>{tu.colWhen}</span><span>{tu.colPerson}</span><span>{tu.colWhat}</span>
              <span>{tu.colModel}</span><span className="usage-num">{tu.colTokens}</span><span className="usage-num">{tu.colSum}</span>
            </div>
            {usage.rows.map(r => {
              const p = tu.purposes[r.purpose]
              return (
                <div className="usage-row card" role="row" key={String(r._id ?? `${r.at.getTime()}-${r.purpose}`)}>
                  <span className="quiet usage-when">{when(r.at)}</span>
                  <span className="usage-person">{r.personName}</span>
                  <span className="usage-what">
                    <strong>{p?.label ?? r.purpose}</strong>
                    {r.subject && <> · {r.subject}</>}
                    <span className="quiet"> — {p?.why}</span>
                    {r.failed && <> <span className="tag tag--expired">{tu.failed}</span></>}
                    {r.keySource && <span className="quiet usage-key">{r.keySource === "tenant" ? tu.keyTenant : tu.keyOperator}</span>}
                  </span>
                  <span className="quiet usage-model">{modelName(r.model)}</span>
                  <span className="usage-num usage-tokens">
                    {num(r.tokens.input)} / {num(r.tokens.output)}
                    {(r.tokens.cacheRead + r.tokens.cacheWrite) > 0 && <span className="quiet"> + {num(r.tokens.cacheRead + r.tokens.cacheWrite)}</span>}
                  </span>
                  <span className="usage-num usage-sum">{formatUsd(r.usd)}</span>
                </div>
              )
            })}
          </div>
        )}
        {usage.totals.calls > usage.rows.length && (
          <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-small)" }}>{tu.capped(usage.rows.length, usage.totals.calls)}</p>
        )}
        <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-small)", maxWidth: 680 }}>{tu.note}</p>
      </>
      )}
      </div>
      )}

      {/*
        GDPR (D154): kontakt, lehoty uchovávania a doplnok na stránku Ochrana
        osobných údajov. Upravuje len DPO (D136, D137) — správca osôb bez roly
        DPO vidí to isté na čítanie (`fieldset disabled`, bez tlačidiel).
        Akcie sú v `dpo/actions.ts` a strážia ich `dpoContext()`.
      */}
      {now === "gdpr" && (
      <div style={{ display: "grid", gap: 16 }}>
        {!ctx.canEditGdpr && <p className="quiet" style={{ margin: 0 }}>{t.gdpr.readOnly}</p>}

        <form action={saveGdprContactAction} className="card set-form">
          <fieldset disabled={!ctx.canEditGdpr} className="set-fieldset">
            <section className="set-sec" id="contact">
              <div className="set-sec-head">
                <h2>{t.branding.secGdpr}</h2>
                <p>{t.branding.secGdprNote}</p>
              </div>
              <div className="set-sec-body">
                <div className="set-pair">
                  <label className="field">
                    <span className="field-label">{t.branding.gdprName}</span>
                    <input className="field-input" name="privacyContactName" autoComplete="off"
                           defaultValue={tenant.privacy?.contact?.name ?? ""} />
                  </label>
                  <label className="field">
                    <span className="field-label">{t.branding.gdprEmail}</span>
                    <input className="field-input" name="privacyContactEmail" type="email" autoComplete="off"
                           defaultValue={tenant.privacy?.contact?.email ?? ""} />
                    <span className="quiet field-hint">{t.branding.gdprEmailNote}</span>
                  </label>
                </div>
                {ctx.canEditGdpr && <div><SubmitButton className="button">{t.gdpr.saveContact}</SubmitButton></div>}
              </div>
            </section>
          </fieldset>
        </form>

        {/* Lehoty (D136) — tie isté čísla číta mazacia dávka aj `/privacy`. */}
        <form action={saveRetentionAction} className="card set-form">
          <fieldset disabled={!ctx.canEditGdpr} className="set-fieldset">
            <section className="set-sec" id="retention">
              <div className="set-sec-head">
                <h2>{tt.heading}</h2>
                <p>{tt.intro}</p>
              </div>
              <div className="set-sec-body">
                {([
                  ["evidenceYears", tt.evidenceYears, tt.evidenceYearsNote],
                  ["capYears", tt.capYears, tt.capYearsNote],
                  ["learningDetailMonths", tt.learningDetailMonths, tt.learningDetailMonthsNote],
                  ["answersMonths", tt.answersMonths, tt.answersMonthsNote],
                ] as const).map(([name, label, note]) => (
                  <label key={name} className="field">
                    <span className="field-label">{label}</span>
                    <input className="field-input" type="number" name={name} required inputMode="numeric"
                           min={RETENTION_LIMITS[name][0]} max={RETENTION_LIMITS[name][1]} defaultValue={retention[name]}
                           style={{ maxWidth: 140 }} />
                    <span className="quiet field-hint">{note}</span>
                  </label>
                ))}
                <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-small)" }}>{tt.fixed}</p>
                {ctx.canEditGdpr && (
                  <>
                    <div className="lnote lnote--bad"><span className="lnote-mark" aria-hidden="true">!</span><span className="lnote-text">{tt.warning}</span></div>
                    <div><SubmitButton className="button">{tt.save}</SubmitButton></div>
                  </>
                )}
              </div>
            </section>
          </fieldset>
        </form>

        {/* Doplnok na /privacy (D137) — v jazykoch organizácie. */}
        <form action={saveExtraAction} className="card set-form">
          <fieldset disabled={!ctx.canEditGdpr} className="set-fieldset">
            <section className="set-sec" id="privacy-extra">
              <div className="set-sec-head">
                <h2>{d.dpo.extra.heading}</h2>
                <p>{d.dpo.extra.intro}</p>
              </div>
              <div className="set-sec-body">
                {tenant.languages.map(l => (
                  <label key={l} className="field">
                    <span className="field-label">{d.dpo.extra.label(d.people.languages[l] ?? l)}</span>
                    <textarea className="field-input" name={`extra-${l}`} rows={5} maxLength={4000}
                              defaultValue={tenant.privacy?.extra?.[l] ?? ""} />
                  </label>
                ))}
                {ctx.canEditGdpr && <div><SubmitButton className="button">{d.dpo.extra.save}</SubmitButton></div>}
              </div>
            </section>
          </fieldset>
        </form>
      </div>
      )}
      </div>
      </div>
    </div>
    </AppShell>
  )
}
