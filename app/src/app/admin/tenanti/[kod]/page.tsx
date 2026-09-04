/**
 * Detail organizácie — úprava a stav domén (Fáza 5b, rozsahy B a C).
 *
 * Formuláre sú serverové, bez klientskeho stavu: odošlú sa, akcia presmeruje
 * späť so správou v adrese. Na telefóne to znamená, že stránka funguje aj bez
 * jediného riadku JavaScriptu — a to je pri správcovskej obrazovke, ktorú
 * človek otvorí raz za mesiac, prednosť, nie ústupok.
 */

import { notFound, redirect } from "next/navigation"
import { auditRecords } from "@/lib/audit"
import AuditList from "@/components/AuditList"
import Link from "next/link"
import { platformContext } from "@/lib/admin"
import { allTenants } from "@/lib/tenantAdmin"
import { domainStatus, cnameInstruction } from "@/lib/vercel"
import { UI_LANGUAGES, dictionary } from "@/lib/i18n"
import type { UiLanguage } from "@/lib/i18n"
import Select from "@/components/Select"
import ColorSelect from "@/components/ColorSelect"
import Notice from "@/components/Notice"
import { providerStatus, PROVIDER_LABEL, PROVIDER_ID } from "@/lib/oauth"
import { saveTenantAction, toggleTenantStatusAction, sendInstructionsAction, saveSignInAction, deleteSignInAction } from "../../actions"
import type { DomainStatus } from "@/lib/vercel"
import type { OAuthProviderName } from "@/lib/oauth"
import type { Tenant } from "@/lib/tenants"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"


/**
 * Prihlasovacie údaje jedného poskytovateľa (D43).
 *
 * **Tajomstvo sa nikdy nevypisuje.** Pole je pri každom otvorení prázdne
 * a prázdne znamená „nemeň" — inak by uloženie zmeneného `clientId` ticho
 * vymazalo tajomstvo a prihlásenie by prestalo fungovať.
 */
function ProviderRow({
  tenant, provider, domain, language,
}: {
  tenant: Tenant
  provider: OAuthProviderName
  /** Prvá doména tenanta — do nej sa skladá adresa návratu. */
  domain?: string
  language?: UiLanguage
}) {
  const t = dictionary(language).admin.signIn
  const name = PROVIDER_LABEL[provider]
  const s = providerStatus(tenant, provider)
  const back = `https://${domain ?? "<…>"}/api/auth/callback/${PROVIDER_ID[provider]}`
  const statusLabel = t.stateLong[s.state] ?? s.state

  return (
    <section className="karta" style={{ padding: "18px 20px", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>{t.heading(name)}</h2>
        <span
          className="stitok"
          style={s.state === "necitatelne"
            ? { background: "var(--warn-bg)", color: "var(--warn-fg)" }
            : undefined}
        >
          {t.state[s.state] ?? s.state}
        </span>
      </div>

      <p className="tichy" style={{ margin: 0, fontSize: 14 }}>{statusLabel}</p>

      {/* Najčastejšia príčina toho, prečo prihlásenie hneď na prvý raz nejde. */}
      <div>
        <div className="tichy pole-napoveda">{t.callback}</div>
        <code style={{ fontSize: 13.5, overflowWrap: "anywhere" }}>{back}</code>
      </div>

      <form action={saveSignInAction} style={{ display: "grid", gap: 14 }}>
        <input type="hidden" name="companyCode" value={tenant.companyCode} />
        <input type="hidden" name="provider" value={provider} />

        <Field name="clientId" label={t.clientId} value={s.zdroj === "tenant" ? s.clientId : ""} />
        <Field name="clientSecret" label={t.clientSecret} type="password" hint={t.clientSecretHint} />

        {provider === "microsoft" ? (
          <>
            <Field
              name="tenantMode"
              label={t.tenantMode}
              value={tenant.oauth?.microsoft?.tenantMode ?? "organizations"}
              hint={t.tenantModeHint}
            />
            <Field
              name="allowedTenantIds"
              label={t.allowedTenantIds}
              value={(tenant.oauth?.microsoft?.allowedTenantIds ?? []).join(", ")}
              hint={t.allowedTenantIdsHint}
            />
          </>
        ) : (
          <Field
            name="hostedDomain"
            label={t.hostedDomain}
            value={tenant.oauth?.google?.hostedDomain ?? ""}
            hint={t.hostedDomainHint}
          />
        )}

        <div>
          <button className="tlacidlo" type="submit">{t.save}</button>
        </div>
      </form>

      {s.zdroj === "tenant" && (
        <form action={deleteSignInAction} style={{ display: "grid", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <input type="hidden" name="companyCode" value={tenant.companyCode} />
          <input type="hidden" name="provider" value={provider} />
          <p className="tichy" style={{ margin: 0, fontSize: 14 }}>{t.deleteNote}</p>
          <Field name="confirmation" label={t.confirmLabel(tenant.companyCode)} />
          <button className="tlacidlo tlacidlo--tiche" type="submit">{t.deleteSubmit}</button>
        </form>
      )}
    </section>
  )
}

export const dynamic = "force-dynamic"

function Field({
  name, label, value, hint, type = "text",
}: {
  name: string; label: string; value?: string; hint?: string; type?: string
}) {
  return (
    <label className="pole">
      <span className="pole-popis">{label}</span>
      <input className="pole-vstup" type={type} name={name} defaultValue={value ?? ""} />
      {hint && <span className="tichy pole-napoveda">{hint}</span>}
    </label>
  )
}

function DomainRow({ s, language }: { s: DomainStatus; language?: UiLanguage }) {
  const t = dictionary(language).admin.detail
  if (s.skipped) {
    return <li className="tichy">{t.nothingNeeded(s.host, s.skipped)}</li>
  }
  if (!s.vProjekte) {
    return (
      <li>
        <strong>{s.host}</strong> — <span style={{ color: "var(--bad-fg)" }}>{t.notInVercel}</span>
      </li>
    )
  }
  if (!s.nastaveneCez) {
    return (
      <li>
        <strong>{s.host}</strong> — {t.waitingForCustomer}{" "}
        <code>{cnameInstruction(s.host, s.cname)}</code>
        {s.conflicts.length > 0 && (
          <div style={{ color: "var(--bad-fg)", fontSize: 13 }}>
            {t.conflicts(s.conflicts.join(", "))}
          </div>
        )}
      </li>
    )
  }
  return (
    <li>
      <strong>{s.host}</strong> — {t.configuredVia(s.nastaveneCez)}
      {!s.verified && <span style={{ color: "var(--warn-fg)" }}>{t.unverified}</span>}
    </li>
  )
}

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ kod: string }>
  searchParams: Promise<RawQuery>
}) {
  const ctx = await platformContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { kod: code } = await params
  const { msg: message, error } = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const tenant = (await allTenants()).find(t => t.companyCode === code.toUpperCase())
  if (!tenant) notFound()

  // Stav domén sa číta naživo pri každom zobrazení (D27) — uložený by klamal
  // presne vtedy, keď si zákazník DNS prestaví.
  const domains = await Promise.all(tenant.hostnames.map(domainStatus))
  // Správca platformy vidí audit každej organizácie — kvôli podpore. Je to
  // ten istý výpis, aký vidí zákazník u seba (D51), len sem sa dostane bez
  // prepínania domén.
  const records = await auditRecords(tenant.companyCode, { limit: 50 })
  const pending = domains.filter(d => !d.skipped && !d.nastaveneCez)
  const enabled = tenant.status === "active"
  const language = ctx.person.language
  const d = dictionary(language)
  const t = d.admin.detail

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 760 }}>
      <p style={{ margin: "0 0 12px" }}>
        <Link href="/admin" className="tichy" style={{ fontSize: 14 }}>
          {t.back}
        </Link>
      </p>

      <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
        {tenant.branding.displayName}
      </h1>
      <p className="tichy" style={{ margin: "0 0 20px" }}>
        {tenant.companyCode}
        {!enabled && t.disabled}
      </p>

      <Notice message={message} error={error === "1"} back={`/admin/tenanti/${encodeURIComponent(code)}`} />

      <section className="karta" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>{t.domainsHeading}</h2>
        <ul className="admin-domeny">
          {domains.map(x => <DomainRow key={x.host} s={x} language={language} />)}
        </ul>

        {pending.length > 0 && (
          <form action={sendInstructionsAction} className="admin-podforma">
            <input type="hidden" name="companyCode" value={tenant.companyCode} />
            <input type="hidden" name="hostnames" value={tenant.hostnames.join(" ")} />
            <Field
              name="to"
              label={t.sendTo}
              value={tenant.branding.supportEmail}
              type="email"
              hint={t.sendHint(pending.length)}
            />
            <button className="tlacidlo" type="submit">{t.send}</button>
          </form>
        )}
      </section>

      <form action={saveTenantAction} className="karta admin-forma" encType="multipart/form-data">
        <input type="hidden" name="companyCode" value={tenant.companyCode} />
        <h2 style={{ fontSize: 17, margin: 0 }}>{t.brandingHeading}</h2>

        <Field name="displayName" label={t.displayName} value={tenant.branding.displayName} />
        <Field name="shortName" label={t.shortName} value={tenant.branding.shortName} />
        <div className="pole">
          <span className="pole-popis">{t.logo}</span>
          {tenant.branding.logoUrl && (
            <span className="logo-nahlad">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tenant.branding.logoUrl} alt="" width={34} height={34} />
              <span className="tichy pole-napoveda">{t.logoCurrent}</span>
            </span>
          )}
          <input className="pole-vstup" type="file" name="logo" accept="image/png,image/jpeg,image/webp" />
          <span className="tichy pole-napoveda">{t.logoNote}</span>
        </div>
        <div className="pole">
          <span className="pole-popis">{t.color}</span>
          <ColorSelect name="accentColor" value={tenant.branding.accentColor} language={language} />
          <span className="tichy pole-napoveda">{t.colorNote}</span>
        </div>
        <Field
          name="supportEmail"
          label={t.supportEmail}
          value={tenant.branding.supportEmail}
          type="email"
          hint={t.supportEmailNote}
        />

        <fieldset className="pole" style={{ border: 0, padding: 0, margin: 0 }}>
          <span className="pole-popis">{t.languages}</span>
          <span className="admin-jazyky">
            {UI_LANGUAGES.map(j => (
              <label key={j} className="stitok" style={{ gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="languages"
                  value={j}
                  defaultChecked={tenant.languages.includes(j)}
                />
                {j}
              </label>
            ))}
          </span>
        </fieldset>

        <div className="pole">
          <span className="pole-popis">{t.defaultLanguage}</span>
          <Select
            name="defaultLanguage"
            options={UI_LANGUAGES.map(j => ({ value: j, label: d.people.languages[j] ?? j }))}
            initial={tenant.defaultLanguage}
            fieldLabel={t.defaultLanguage}
          />
          <span className="tichy pole-napoveda">{t.defaultLanguageNote}</span>
        </div>

        <label className="pole">
          <span className="pole-popis">{t.domains}</span>
          <textarea
            className="pole-vstup"
            name="hostnames"
            rows={3}
            defaultValue={tenant.hostnames.join("\n")}
          />
          <span className="tichy pole-napoveda">{t.domainsNote}</span>
        </label>

        <label className="pole">
          <span className="pole-popis">{t.autoProvision}</span>
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
            {t.autoProvisionBefore}<strong>{t.autoProvisionHighlight}</strong>{t.autoProvisionAfter}
          </span>
        </label>

        <button className="tlacidlo" type="submit">{t.save}</button>
      </form>

      {/* Prihlasovacie údaje sú medzi úpravou a vypnutím zámerne: patria
          k zavedeniu zákazníka, nie k jeho dennému nastaveniu. */}
      <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
        <ProviderRow tenant={tenant} provider="microsoft" domain={tenant.hostnames[0]} language={language} />
        <ProviderRow tenant={tenant} provider="google" domain={tenant.hostnames[0]} language={language} />
      </div>

      <form action={toggleTenantStatusAction} className="karta admin-forma" style={{ marginTop: 16 }}>
        <input type="hidden" name="companyCode" value={tenant.companyCode} />
        <input type="hidden" name="status" value={enabled ? "disabled" : "active"} />
        <h2 style={{ fontSize: 17, margin: 0 }}>
          {enabled ? t.disableHeading : t.enableHeading}
        </h2>
        {enabled ? (
          <>
            <p className="tichy" style={{ margin: 0, fontSize: 14 }}>{t.disableNote}</p>
            <Field
              name="confirmation"
              label={t.confirmLabel(tenant.companyCode)}
              hint={t.confirmHint}
            />
            <button className="tlacidlo tlacidlo--tiche" type="submit">{t.disable}</button>
          </>
        ) : (
          <button className="tlacidlo" type="submit">{t.enable}</button>
        )}
      </form>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>{t.auditHeading}</h2>
        <p className="tichy" style={{ fontSize: 14, margin: "0 0 12px" }}>{t.auditNote}</p>
        <AuditList records={records} language={language} />
      </section>
    </div>
  )
}
