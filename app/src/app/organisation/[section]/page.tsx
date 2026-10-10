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
import Link from "next/link"
import TabsBar from "@/components/TabsBar"
import OrgNav from "@/components/OrgNav"
import { isOrgSection, orgSectionHref, type OrgSection } from "@/lib/orgSections"
import SubmitButton from "@/components/SubmitButton"
import FormPendingSignal from "@/components/FormPendingSignal"
import { treeOptions } from "@/lib/treeOptions"
import { orgPageContext } from "@/lib/orgSettings"
import { retentionSettings, RETENTION_LIMITS } from "@/lib/retention"
import { saveGdprPageAction } from "@/app/dpo/actions"
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
import ConnectorList from "../_connectors/ConnectorList"
import ConnectorDetail from "../_connectors/ConnectorDetail"
import { listConnectors, connectorById, connectorView, channelsUsingConnector } from "@/lib/connectors"
import { connectorCallbackUrl } from "@/lib/mcp/callbackUrl"
import { AI_USAGE_PURPOSES, usageFilterFromQuery, usageRows, usageTotals, usagePeople } from "@/lib/aiUsage"
import { ratesForDate, formatUsd } from "@/lib/pricing"

import { saveBrandingAction, deleteLogoAction, saveSignInPageAction, deleteSignInAction, requestDomainAction, verifyDomainAction, cancelDomainAction } from "../actions"
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
import { addressParts, formatAddress } from "@/lib/address"
import { LEGAL_BASES } from "@/lib/versionResponsibility"
import {
  addLegalBasisAction, retireLegalBasisAction, toggleStandardLegalBasisAction,
} from "../actions"


export const dynamic = "force-dynamic"

/** Koľko riadkov spotreby ukáže obrazovka; export berie celé obdobie. */
const USAGE_SCREEN_LIMIT = 500

/**
 * Sekcia jedného poskytovateľa v spoločnom formulári Prihlásenia
 * (ZAKLAD-lista-ulozenia, 7. 10. 2026). Polia nesú predponu poskytovateľa
 * (`microsoft.clientId`) — uloží ich jedna lišta spolu s druhým
 * poskytovateľom aj doménami automatického zakladania.
 *
 * **Tajomstvo sa nikdy nevypisuje;** prázdne pole znamená „nemeň" (D43).
 */
function ProviderSection({
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
  const f = (field: string) => `${provider}.${field}`

  return (
    <section className="set-sec" id={`signin-${provider}`}>
      <div className="set-sec-head">
        <h2>
          {t.heading(name)}{" "}
          <span className={s.state === "unreadable" ? "tag tag--warn" : s.state === "set" ? "tag tag--published" : "tag"}>
            {s.state === "set" ? t.stateOn
              : s.state === "from-environment" ? t.stateFromSupplier
              : s.state === "unreadable" ? t.stateUnreadable : t.stateOff}
          </span>
        </h2>
        <p>{t.introBefore}<strong>{t.introHighlight(name)}</strong>{t.introAfter}</p>
      </div>
      <div className="set-sec-body">
        <div className="set-callback">
          <span className="quiet field-hint">{t.callback}</span>
          <code>{back}</code>
        </div>
        <label className="field">
          <span className="field-label">{t.clientId}</span>
          <input className="field-input" name={f("clientId")} defaultValue={s.source === "tenant" ? s.clientId : ""} />
        </label>
        <label className="field">
          <span className="field-label">{t.clientSecret}</span>
          <input className="field-input" name={f("clientSecret")} type="password" autoComplete="off" />
          <span className="quiet field-hint">{t.clientSecretNote}</span>
        </label>
        {provider === "microsoft" ? (
          <>
            <label className="field">
              <span className="field-label">{t.tenantMode}</span>
              <input className="field-input" name={f("tenantMode")} defaultValue={tenant.oauth?.microsoft?.tenantMode ?? "organizations"} />
              <span className="quiet field-hint">{t.tenantModeBefore}<strong>{t.tenantModeHighlight}</strong>{t.tenantModeAfter}</span>
            </label>
            <label className="field">
              <span className="field-label">{t.allowedTenantIds}</span>
              <input className="field-input" name={f("allowedTenantIds")} defaultValue={(tenant.oauth?.microsoft?.allowedTenantIds ?? []).join(", ")} />
              <span className="quiet field-hint">{t.allowedTenantIdsNote}</span>
            </label>
          </>
        ) : (
          <label className="field">
            <span className="field-label">{t.hostedDomain}</span>
            <input className="field-input" name={f("hostedDomain")} defaultValue={tenant.oauth?.google?.hostedDomain ?? ""} />
          </label>
        )}
      </div>
    </section>
  )
}

/**
 * Riadok „Odstrániť vlastné prihlásenie" v karte Ďalšie akcie. Potvrdenie
 * kódom organizácie sa otvorí až po kliknutí (`?remove=<poskytovateľ>`,
 * ZAKLAD-lista-ulozenia Q1) — stále viditeľné pole kódu vyzeralo ako
 * súčasť nastavenia a v spoločnom formulári by sa odoslalo s „Uložiť".
 */
function RemoveSignInRow({ tenant, provider, open, language }: {
  tenant: Tenant
  provider: OAuthProviderName
  open: boolean
  language?: UiLanguage
}) {
  const t = dictionary(language).org.signIn
  const here = orgSectionHref("signin")
  return (
    <>
      <div className="more-row">
        <div className="more-main">
          <b>{t.removeOwnTitle(PROVIDER_LABEL[provider])}</b>
          <span>{t.removeOwnNote}</span>
        </div>
        {!open && <Link className="button button--danger" href={`${here}?remove=${provider}#remove-${provider}`}>{t.removeOpen}</Link>}
      </div>
      {open && (
        <form action={deleteSignInAction} className="more-confirm" id={`remove-${provider}`}>
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="tab" value="signin" />
          <p>{t.deleteNote}</p>
          <label className="field">
            <span className="field-label">{t.confirmLabel(tenant.companyCode)}</span>
            <input className="field-input" name="confirmation" autoCapitalize="characters" autoCorrect="off" required />
          </label>
          <div className="more-acts">
            <SubmitButton className="button button--danger">{t.deleteSubmit}</SubmitButton>
            <Link className="button button--quiet" href={here}>{t.cancel}</Link>
          </div>
        </form>
      )}
    </>
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

  const query = normalizeQuery<{ msg?: string; error?: string; search?: string; list?: string; view?: string; from?: string; to?: string; person?: string; purpose?: string; remove?: string; request?: string; new?: string; endpoint?: string; name?: string; connector?: string; instructions?: string; try?: string; scope?: string }>(await searchParams)
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
  // Sídlo po častiach; organizácia pred migráciou dostane rozložený starý riadok (10. 10. 2026).
  const address = addressParts(tenant.controller)
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

  // Detail konektora (`/organisation/connectors/<id>`, návrh ORG-konektory):
  // cesta pod hlavičkou ho pomenuje, preto sa načíta pred vykreslením.
  const connector = now === "connectors" && query.connector
    ? await connectorById(tenant.companyCode, query.connector)
    : null
  if (now === "connectors" && query.connector && !connector) notFound()
  const connectorHref = connector ? `/organisation/connectors/${encodeURIComponent(connector.id)}` : null

  const records = now === "audit"
    ? await auditRecords(tenant.companyCode, { search: search, limit: 200 })
    : []

  return (
    <AppShell language={ctx.person.language}
              title={now === "ai" && aiView === "usage" ? tu.tabUsage : connector ? connector.name : t.tabs[now]}
              trail={now === "ai" && aiView === "usage"
                ? { "/organisation": t.heading, "/organisation/ai": t.tabs.ai }
                : connector
                ? { "/organisation": t.heading, "/organisation/connectors": t.tabs.connectors }
                : { "/organisation": t.heading }}>
    <div className="org-set" style={tenantStyle(branding)}>
      {/* Chyba pri pridávaní konektora sa ukáže v úlohe, nie tu (ORG-konektory). */}
      <Notice
        language={language}
        message={now === "connectors" && query.new === "1" && error === "1" ? undefined : message}
        error={error === "1"}
        back={connectorHref ?? orgSectionHref(now)}
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
                    <SubmitButton className="set-remove" form="remove-logo"
                            title={t.branding.logoRemoveNote}>
                      {t.branding.logoRemove}
                    </SubmitButton>
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
                <span className="field-label">{t.branding.controllerStreet}</span>
                <input className="field-input" name="controllerStreet" autoComplete="address-line1" defaultValue={address.street ?? ""} />
              </label>
              <label className="field">
                <span className="field-label">{t.branding.controllerStreetNumber}</span>
                <input className="field-input" name="controllerStreetNumber" defaultValue={address.streetNumber ?? ""} />
              </label>
            </div>
            <div className="set-pair">
              <label className="field">
                <span className="field-label">{t.branding.controllerPostalCode}</span>
                <input className="field-input" name="controllerPostalCode" inputMode="numeric" autoComplete="postal-code"
                       placeholder="821 01" defaultValue={address.postalCode ?? ""} />
              </label>
              <label className="field">
                <span className="field-label">{t.branding.controllerCity}</span>
                <input className="field-input" name="controllerCity" autoComplete="address-level2" defaultValue={address.city ?? ""} />
              </label>
            </div>
            <div className="set-pair">
              <label className="field">
                <span className="field-label">{t.branding.controllerRegistrationNumber}</span>
                <input className="field-input" name="controllerRegistrationNumber" inputMode="numeric"
                       defaultValue={tenant.controller?.registrationNumber ?? ""} />
              </label>
            </div>
            {/* DIČ a IČ DPH (ADR-031) — päta dokumentov, neskôr faktúry za služby. */}
            <div className="set-pair">
              <label className="field">
                <span className="field-label">{t.branding.controllerTaxId}</span>
                <input className="field-input" name="controllerTaxId" inputMode="numeric"
                       defaultValue={tenant.controller?.taxId ?? ""} />
              </label>
              <label className="field">
                <span className="field-label">{t.branding.controllerVatId}</span>
                <input className="field-input" name="controllerVatId" autoCapitalize="characters"
                       defaultValue={tenant.controller?.vatId ?? ""} />
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
              {(formatAddress(tenant.controller) || tenant.controller?.registrationNumber) &&
                ` · ${tp.controllerDetails(formatAddress(tenant.controller), tenant.controller?.registrationNumber ?? "")}`}
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

        {/* Kontakt na dokumentoch (ADR-031) — päta PDF vygenerovaného z Markdownu. */}
        <section className="set-sec">
          <div className="set-sec-head">
            <h2>{t.branding.secDocumentContact}</h2>
            <p>{t.branding.secDocumentContactNote}</p>
          </div>
          <div className="set-sec-body">
            <label className="field">
              <span className="field-label">{t.branding.contactWeb}</span>
              <input className="field-input" name="contactWeb" inputMode="url" autoCapitalize="none"
                     defaultValue={tenant.contact?.web ?? ""} />
            </label>
            <div className="set-pair">
              <label className="field">
                <span className="field-label">{t.branding.contactEmail}</span>
                <input className="field-input" name="contactEmail" type="email" defaultValue={tenant.contact?.email ?? ""} />
              </label>
              <label className="field">
                <span className="field-label">{t.branding.contactPhone}</span>
                <input className="field-input" name="contactPhone" type="tel" defaultValue={tenant.contact?.phone ?? ""} />
              </label>
            </div>
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head">
            <h2>{t.branding.languages}</h2>
          </div>
          <div className="set-sec-body">
            {/* Výber viacerých — riadky s kruhom vľavo, nie pilulky
                (ZAKLAD-vyber-a-prepinace, Q3). */}
            <div className="card form-group-body form-group-body--rows">
            <div className="form-list">
              {UI_LANGUAGES.map(j => (
                <label key={j} className="form-row select-row">
                  <input type="checkbox" name="languages" value={j} defaultChecked={tenant.languages.includes(j)} />
                  <span className="form-row-main">{d.people.languages[j] ?? j}</span>
                </label>
              ))}
            </div>
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
          <FormPendingSignal form="remove-logo" />
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

      {/*
        Domény (ZAKLAD-lista-ulozenia, 7. 10. 2026): zoznam s akciami
        v riadkoch, bez lišty. Jediné plné tlačidlo „Požiadať o doménu" je
        v hlavičke časti a otvorí úlohu `?request=1`, ktorá ho prevezme (Q3).
        „Overiť" je kontrola, preto tiché. Odstránenie fungujúcej domény ide
        cez potvrdenie `?remove=<doména>` (Q4).
      */}
      {now === "domains" && (
      <>
        <div className="page-head page-head--section">
          <h2>{t.tabs.domains}</h2>
          <span className="page-head-spacer" aria-hidden="true" />
          {query.request !== "1" && <Link className="button" href={`${orgSectionHref("domains")}?request=1#request`}>{t.domains.requestOpen}</Link>}
        </div>

        {query.request === "1" && (
          <form action={requestDomainAction} className="card task-card" id="request">
            <input type="hidden" name="tab" value="domains" />
            <h2>{t.domains.requestOpen}</h2>
            <label className="field">
              <span className="field-label">{t.domains.add}</span>
              <input className="field-input" name="host" placeholder={t.domains.hostPlaceholder} autoCapitalize="none" autoCorrect="off" required />
              <span className="quiet field-hint">{t.domains.addNote}</span>
            </label>
            <div className="task-acts">
              <SubmitButton className="button">{t.domains.request}</SubmitButton>
              <Link className="button button--quiet" href={orgSectionHref("domains")}>{t.domains.cancel}</Link>
            </div>
          </form>
        )}

        <div className="card form-list domain-list">
          {tenant.hostnames.map(h => (
            <div key={h} className="domain-row">
              <div className="domain-head">
                <b>{h}</b>
                <span className="tag tag--published">{t.domains.works}</span>
                {tenant.hostnames.length > 1 && query.remove !== h && (
                  <Link className="button button--danger button--sm domain-end" href={`${orgSectionHref("domains")}?remove=${encodeURIComponent(h)}#remove`}>{t.domains.removeOpen}</Link>
                )}
              </div>
              {tenant.hostnames.length > 1 && query.remove === h && (
                <form action={cancelDomainAction} className="more-confirm domain-confirm" id="remove">
                  <input type="hidden" name="host" value={h} />
                  <input type="hidden" name="tab" value="domains" />
                  <p>{t.domains.removeConfirm(h)}</p>
                  <div className="more-acts">
                    <SubmitButton className="button button--danger">{t.domains.remove}</SubmitButton>
                    <Link className="button button--quiet" href={orgSectionHref("domains")}>{t.domains.cancel}</Link>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>

        {pending.length > 0 && (
          <section className="form-group">
            <h2 className="form-group-head">{t.domains.pendingHeading(pending.length)}</h2>
            <div className="card form-list domain-list">
              {pending.map(z => {
                const p = domainInstruction(z.host)
                return (
                  <div key={z.host} className="domain-row">
                    <div className="domain-head">
                      <b>{z.host}</b>
                      <span className="tag tag--warn">{t.domains.waitingDns}</span>
                      <span className="quiet domain-end">{t.domains.since(formatDate(z.requestedAt, language))}</span>
                    </div>
                    {p && (
                      <p className="quiet domain-dns">
                        {t.domains.dnsBefore}<strong>{p.type}</strong>{t.domains.dnsMiddle}
                        <code>{p.name}</code> → <code>{p.value}</code>
                      </p>
                    )}
                    <div className="more-acts">
                      <form action={verifyDomainAction}>
                        <input type="hidden" name="host" value={z.host} />
                        <input type="hidden" name="tab" value="domains" />
                        <SubmitButton className="button button--quiet button--sm">{t.domains.verify}</SubmitButton>
                      </form>
                      <form action={cancelDomainAction}>
                        <input type="hidden" name="host" value={z.host} />
                        <input type="hidden" name="tab" value="domains" />
                        <SubmitButton className="button button--quiet button--sm">{t.domains.cancelRequest}</SubmitButton>
                      </form>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="form-group-foot quiet">{t.domains.pendingNote}</p>
          </section>
        )}
      </>
      )}

      {/*
        Prihlásenie jedným formulárom a jednou lištou (ZAKLAD-lista-ulozenia,
        7. 10. 2026): Microsoft, Google a automatické zakladanie. Odstránenie
        vlastného prihlásenia je v „Ďalšie akcie" pod formulárom.
      */}
      {now === "signin" && (
      <>
        <form action={saveSignInPageAction} className="card set-form">
          <input type="hidden" name="tab" value="signin" />
          <ProviderSection tenant={tenant} provider="microsoft" domain={tenant.hostnames[0]} language={language} />
          <ProviderSection tenant={tenant} provider="google" domain={tenant.hostnames[0]} language={language} />
          {/*
            Automatické založenie patrí k prihlasovaniu, nie k vzhľadu (Ján
            25. 9. 2026). Sú to **e-mailové domény pracovných kont**, nie webové
            adresy portálu zo záložky Domény — preto to veta hovorí nahlas.
          */}
          <section className="set-sec" id="auto-provision">
            <div className="set-sec-head"><h2>{t.branding.secAutoProvision}</h2></div>
            <div className="set-sec-body">
              <label className="field">
                <span className="field-label">{t.branding.autoProvision}</span>
                <textarea
                  className="field-input"
                  name="autoProvisionDomains"
                  rows={2}
                  defaultValue={(tenant.autoProvisionDomains ?? []).join("\n")}
                  placeholder={dictionary(language).common.domainsPlaceholder}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <span className="quiet field-hint">
                  {t.branding.autoProvisionBefore}<strong>{t.branding.autoProvisionHighlight}</strong>{t.branding.autoProvisionAfter}
                </span>
                <span className="quiet field-hint">{t.branding.autoProvisionNotHosts}</span>
              </label>
            </div>
          </section>
          <div className="set-savebar">
            <SubmitButton className="button">{t.branding.save}</SubmitButton>
            <span className="quiet">{dictionary(language).common.saveBarNote}</span>
          </div>
        </form>
        {(["microsoft", "google"] as const).some(p => providerStatus(tenant, p).source === "tenant") && (
          <section className="card more">
            <div className="more-head"><h2>{dictionary(language).common.moreActions}</h2></div>
            {(["microsoft", "google"] as const).filter(p => providerStatus(tenant, p).source === "tenant").map(p => (
              <RemoveSignInRow key={p} tenant={tenant} provider={p} open={query.remove === p} language={language} />
            ))}
          </section>
        )}
      </>
      )}

      {now === "codelists" && (
      // `minmax(0, 1fr)`: bez neho sa stĺpec mriežky roztiahne na šírku pásu
      // záložiek a na telefóne roztiahne celú stránku (565 px pri 375 px,
      // 3. 10. 2026) — pás sa má posúvať, nie tlačiť.
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr)" }}>
        <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: 0, maxWidth: 620 }}>
          {t.codelists.introBefore}<strong>{t.codelists.introHighlight}</strong>{t.codelists.introAfter}
        </p>

        {/*
          Jeden číselník naraz (Ján 3. 10. 2026) — výber zo zoznamu, nie druhé
          farebné podmenu pod bočným zoznamom organizácie: dva farebné
          ovládače nad sebou sa nesmú dať zameniť (rozhodnutie R6, 6. 10. 2026,
          Picker .menu). Parameter `?list=` ostáva — miesto sa nemení, mení sa
          zoznam. S JavaScriptom zaberie výber hneď (`LiveFilter`), bez neho
          tlačidlo.
        */}
        <LiveFilter className="cl-pick" action="/organisation/codelists" label={t.codelists.pick}>
          <label className="field">
            <span className="field-label">{t.codelists.pick}</span>
            <select className="field-input" name="list" defaultValue={list}>
              {codelists.map(c => (
                <option key={c.name} value={c.name}>{t.codelists.labels[c.name].name}</option>
              ))}
              <option value="legal">{tr.orgHeading}</option>
            </select>
          </label>
          <noscript><button className="button button--quiet" type="submit">{t.codelists.show}</button></noscript>
        </LiveFilter>

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
            <fieldset className="form-group">
              <legend className="form-group-head">{tr.categoryField}</legend>
              {/* Jedna z mála volieb — fajka vpravo (ZAKLAD-vyber-a-prepinace). */}
              <div className="card form-group-body form-group-body--rows">
              <div className="form-list">
              {LEGAL_BASES.map(b => (
                <label key={b} className="form-row choice-row">
                  <input type="radio" name="basis" value={b} required />
                  <span className="form-row-main">
                    <span>{tr.basisLabel[b]}</span>
                    <span className="form-row-sub">{tr.basisHint[b]}</span>
                  </span>
                </label>
              ))}
              </div>
              </div>
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
        Konektory (ADR-029, D178; návrh ORG-konektory, 9. 10. 2026): prehľad
        riadkov s pridaním z adresy (`?new=1`) a detail na vlastnej ceste.
      */}
      {now === "connectors" && !connector && (
        <ConnectorList connectors={(await listConnectors(tenant.companyCode)).map(connectorView)} language={language} query={query} />
      )}
      {now === "connectors" && connector && (
        <ConnectorDetail
          c={connectorView(connector)}
          channels={await channelsUsingConnector(tenant.companyCode, connector.id)}
          query={query}
          language={language}
          redirectUrl={await connectorCallbackUrl()}
          ctx={{ actor: { personId: ctx.person.id, personName: ctx.person.fullName } }}
        />
      )}

      {/*
        Umelá inteligencia (D157, 5. 10. 2026): kľúč a modely. Kľúč sa nikdy
        neukazuje — ani zašifrovaný; obrazovka vie len, či je nastavený,
        jeho koncovku a kto ho kedy zadal.
      */}
      {now === "ai" && (
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr)" }}>
        {/* Nastavenie a Spotreba (ADR-026) — dve časti tej istej sekcie. Spotreba
            má od 6. 10. 2026 vlastnú adresu `/organisation/ai/usage` (R5). */}
        <nav className="tabs" aria-label={t.tabs.ai}>
          <TabsBar>
            <TabLink href="/organisation/ai" active={aiView === "settings"}>{tu.tabSettings}</TabLink>
            <TabLink href="/organisation/ai/usage" active={aiView === "usage"}>{tu.tabUsage}</TabLink>
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
                <SubmitButton className="button button--quiet" form="remove-ai-key">{t.ai.deleteKey}</SubmitButton>
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
        <FormPendingSignal form="remove-ai-key" />
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
        <form action="/organisation/ai/usage" method="get" className="card usage-filter">
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
          {/* Filter nie je hlavná akcia — tiché (DESIGN_ODCHYLKY). */}
          <div><button className="button button--quiet" type="submit">{tu.apply}</button></div>
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
      <>
        {!ctx.canEditGdpr && <p className="quiet org-note">{t.gdpr.readOnly}</p>}

        {/* Jeden formulár a jedna lišta (ZAKLAD-lista-ulozenia, 7. 10. 2026);
            kto nie je DPO, má polia len na čítanie a lištu nevidí. */}
        <form action={saveGdprPageAction} className="card set-form">
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
              </div>
            </section>

            {/* Lehoty (D136) — tie isté čísla číta mazacia dávka aj `/privacy`.
                Zapíšu sa len pri zmene (Q2). */}
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
                  ["ticketMonths", tt.ticketMonths, tt.ticketMonthsNote],
                ] as const).map(([name, label, note]) => (
                  <label key={name} className="field">
                    <span className="field-label">{label}</span>
                    <input className="field-input field-input--num" type="number" name={name} required inputMode="numeric"
                           min={RETENTION_LIMITS[name][0]} max={RETENTION_LIMITS[name][1]} defaultValue={retention[name]} />
                    <span className="quiet field-hint">{note}</span>
                  </label>
                ))}
                <p className="quiet field-hint">{tt.fixed}</p>
                {ctx.canEditGdpr && (
                  <div className="lnote lnote--bad"><span className="lnote-mark" aria-hidden="true">!</span><span className="lnote-text">{tt.warning}</span></div>
                )}
              </div>
            </section>

            {/* Doplnok na /privacy (D137) — v jazykoch organizácie. */}
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
              </div>
            </section>
          </fieldset>
          {ctx.canEditGdpr && (
            <div className="set-savebar">
              <SubmitButton className="button">{t.branding.save}</SubmitButton>
              <span className="quiet">{d.common.saveBarNote}</span>
            </div>
          )}
        </form>
      </>
      )}
      </div>
      </div>
    </div>
    </AppShell>
  )
}
