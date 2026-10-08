/**
 * Detail organizácie — úprava a stav domén (Fáza 5b, rozsahy B a C).
 *
 * Formuláre sú serverové, bez klientskeho stavu: odošlú sa, akcia presmeruje
 * späť so správou v adrese. Na telefóne to znamená, že stránka funguje aj bez
 * jediného riadku JavaScriptu — a to je pri správcovskej obrazovke, ktorú
 * človek otvorí raz za mesiac, prednosť, nie ústupok.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { auditRecords } from "@/lib/audit"
import AuditList from "@/components/AuditList"
import { platformContext, tenantOverviews, trackCount } from "@/lib/admin"
import Fact from "@/components/Fact"
import { allTenants } from "@/lib/tenantAdmin"
import { domainStatus, cnameInstruction } from "@/lib/vercel"
import { UI_LANGUAGES, dictionary } from "@/lib/i18n"
import type { UiLanguage } from "@/lib/i18n"
import Select from "@/components/Select"
import ColorSelect from "@/components/ColorSelect"
import Notice from "@/components/Notice"
import { providerStatus, PROVIDER_LABEL, PROVIDER_ID } from "@/lib/oauth"
import { saveTenantPageAction, toggleTenantStatusAction, sendInstructionsAction, deleteSignInAction } from "../../actions"
import type { DomainStatus } from "@/lib/vercel"
import type { OAuthProviderName } from "@/lib/oauth"
import type { Tenant } from "@/lib/tenants"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import AppShell from "@/components/AppShell"
import SubmitButton from "@/components/SubmitButton"


/**
 * Prihlasovacie údaje jedného poskytovateľa (D43) ako sekcia spoločného
 * formulára (ZAKLAD-lista-ulozenia, 7. 10. 2026). Polia nesú predponu
 * poskytovateľa (`microsoft.clientId`), uloží ich lišta celej stránky.
 *
 * **Tajomstvo sa nikdy nevypisuje.** Pole je pri každom otvorení prázdne
 * a prázdne znamená „nemeň" — inak by uloženie zmeneného `clientId` ticho
 * vymazalo tajomstvo a prihlásenie by prestalo fungovať.
 */
function ProviderSection({
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
  const f = (field: string) => `${provider}.${field}`
  // Slovník má stavy pod pôvodnými kľúčmi (`nastavene`…); `providerStatus`
  // vracia anglické. Bez prekladu sa v štítku ukazovalo holé „set" / „unset".
  const stateKey = ({ set: "nastavene", "from-environment": "z-prostredia", unreadable: "necitatelne", unset: "nenastavene" } as const)[s.state]

  return (
    <section className="set-sec" id={`signin-${provider}`}>
      <div className="set-sec-head">
        <h2>
          {t.heading(name)}{" "}
          <span className={s.state === "unreadable" ? "tag tag--warn" : s.state === "set" ? "tag tag--published" : "tag"}>
            {t.state[stateKey] ?? s.state}
          </span>
        </h2>
        <p>{t.stateLong[stateKey] ?? s.state}</p>
      </div>
      <div className="set-sec-body">
        {/* Najčastejšia príčina toho, prečo prihlásenie hneď na prvý raz nejde. */}
        <div className="set-callback">
          <span className="quiet field-hint">{t.callback}</span>
          <code>{back}</code>
        </div>
        <Field name={f("clientId")} label={t.clientId} value={s.source === "tenant" ? s.clientId : ""} />
        <Field name={f("clientSecret")} label={t.clientSecret} type="password" hint={t.clientSecretHint} />
        {provider === "microsoft" ? (
          <>
            <Field name={f("tenantMode")} label={t.tenantMode} value={tenant.oauth?.microsoft?.tenantMode ?? "organizations"} hint={t.tenantModeHint} />
            <Field name={f("allowedTenantIds")} label={t.allowedTenantIds} value={(tenant.oauth?.microsoft?.allowedTenantIds ?? []).join(", ")} hint={t.allowedTenantIdsHint} />
          </>
        ) : (
          <Field name={f("hostedDomain")} label={t.hostedDomain} value={tenant.oauth?.google?.hostedDomain ?? ""} hint={t.hostedDomainHint} />
        )}
      </div>
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
    <label className="field">
      <span className="field-label">{label}</span>
      <input className="field-input" type={type} name={name} defaultValue={value ?? ""} />
      {hint && <span className="quiet field-hint">{hint}</span>}
    </label>
  )
}

function DomainRow({ s, language }: { s: DomainStatus; language?: UiLanguage }) {
  const t = dictionary(language).admin.detail
  if (s.skipped) {
    return <li className="quiet">{t.nothingNeeded(s.host, s.skipped)}</li>
  }
  if (!s.inProject) {
    return (
      <li>
        <strong>{s.host}</strong> — <span className="domain-state is-bad">{t.notInVercel}</span>
      </li>
    )
  }
  if (!s.configuredBy) {
    return (
      <li>
        <strong>{s.host}</strong> — {t.waitingForCustomer}{" "}
        <code>{cnameInstruction(s.host, s.cname)}</code>
        {s.conflicts.length > 0 && (
          <div className="domain-state is-bad domain-conflicts">
            {t.conflicts(s.conflicts.join(", "))}
          </div>
        )}
      </li>
    )
  }
  return (
    <li>
      <strong>{s.host}</strong> — {t.configuredVia(s.configuredBy)}
      {!s.verified && <span className="domain-state is-warn">{t.unverified}</span>}
    </li>
  )
}

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<RawQuery>
}) {
  const ctx = await platformContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const { code } = await params
  const { msg: message, error, remove, disable } = normalizeQuery<{ msg?: string; error?: string; remove?: string; disable?: string }>(await searchParams)
  const tenant = (await allTenants()).find(t => t.companyCode === code.toUpperCase())
  if (!tenant) notFound()

  // Stav domén sa číta naživo pri každom zobrazení (D27) — uložený by klamal
  // presne vtedy, keď si zákazník DNS prestaví.
  const domains = await Promise.all(tenant.hostnames.map(domainStatus))
  // Správca platformy vidí audit každej organizácie — kvôli podpore. Je to
  // ten istý výpis, aký vidí zákazník u seba (D51), len sem sa dostane bez
  // prepínania domén.
  const records = await auditRecords(tenant.companyCode, { limit: 50 })
  // Čísla tejto jednej organizácie — `tenantOverviews()` s kódom počíta len
  // ju. Trasy sú navyše oproti prehľadu: tu je na ne miesto a otázka „koľko
  // ich vlastne má" sa kladie práve pri jednej organizácii (rozhodnutie Jána
  // 2026-09-22).
  const [overview] = await tenantOverviews(tenant.companyCode)
  const tracks = await trackCount(tenant.companyCode)
  const pending = domains.filter(d => !d.skipped && !d.configuredBy)
  const enabled = tenant.status === "active"
  const language = ctx.person.language
  const d = dictionary(language)
  const t = d.admin.detail

  return (
    <AppShell language={ctx.person.language} title={tenant.branding.displayName}>
    <div style={{ maxWidth: 760 }}>
      <h1 className="page-title" style={{ margin: "0 0 4px" }}>
        {tenant.branding.displayName}
      </h1>
      <p className="quiet" style={{ margin: "0 0 20px" }}>
        {tenant.companyCode}
        {!enabled && t.disabled}
      </p>

      <Notice language={language} message={message} error={error === "1"} back={`/admin/tenants/${encodeURIComponent(code)}`} />

      {overview && (
        <section className="card" style={{ padding: "18px 20px", marginBottom: 16 }}>
          <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{t.numbersHeading}</h2>
          {/* Tie isté dlaždice ako v prehľade (`Fact` + `.admin-data`), v tom
              istom poradí — inak by si človek čísla medzi obrazovkami
              nespojil. Trasy sú na konci: sú to vnútorné dráhy, nie to, čo
              organizácia „má". */}
          <div className="admin-data">
            <Fact
              label={d.admin.list.documents}
              value={d.admin.list.documentsValue(
                overview.documents.total - overview.documents.withoutVersion.length,
                overview.documents.total,
              )}
              muted={overview.documents.total === 0}
            />
            <Fact label={d.admin.list.versions} value={String(overview.versions)} muted={overview.versions === 0} />
            <Fact
              label={d.admin.list.people}
              value={d.admin.list.peopleValue(overview.people.signedIn, overview.people.total)}
              muted={overview.people.total === 0}
            />
            <Fact
              label={d.admin.list.acknowledgements}
              value={String(overview.acknowledgements)}
              muted={overview.acknowledgements === 0}
            />
            <Fact label={t.tracks} value={String(tracks)} muted={tracks === 0} />
          </div>
        </section>
      )}

      <section className="card" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <h2 style={{ fontSize: "var(--fs-section)", margin: "0 0 12px" }}>{t.domainsHeading}</h2>
        <ul className="admin-domains">
          {domains.map(x => <DomainRow key={x.host} s={x} language={language} />)}
        </ul>

      </section>

      {/*
        Jeden formulár a jedna lišta (ZAKLAD-lista-ulozenia, 7. 10. 2026):
        vzhľad a údaje, domény a zakladanie, Microsoft a Google. Prihlasovacie
        údaje patria k zavedeniu zákazníka — preto až za údajmi organizácie.
      */}
      <form action={saveTenantPageAction} className="card set-form admin-set">
        <input type="hidden" name="companyCode" value={tenant.companyCode} />
        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.brandingHeading}</h2></div>
          <div className="set-sec-body">
            <Field name="displayName" label={t.displayName} value={tenant.branding.displayName} />
            <Field name="shortName" label={t.shortName} value={tenant.branding.shortName} />
            <div className="field">
              <span className="field-label">{t.logo}</span>
              {tenant.branding.logoUrl && (
                <span className="logo-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={tenant.branding.logoUrl} alt="" width={34} height={34} />
                  <span className="quiet field-hint">{t.logoCurrent}</span>
                </span>
              )}
              <input className="field-input" type="file" name="logo" accept="image/png,image/jpeg,image/webp" />
              <span className="quiet field-hint">{t.logoNote}</span>
            </div>
            <div className="field">
              <span className="field-label">{t.color}</span>
              <ColorSelect name="accentColor" value={tenant.branding.accentColor} language={language} />
              <span className="quiet field-hint">{t.colorNote}</span>
            </div>
            <Field name="supportEmail" label={t.supportEmail} value={tenant.branding.supportEmail} type="email" hint={t.supportEmailNote} />
            {/* Výber viacerých — riadky s kruhom vľavo, ako jazyky v nastaveniach
                organizácie (ZAKLAD-vyber-a-prepinace, DESIGN_ODCHYLKY). */}
            <fieldset className="form-group">
              <legend className="form-group-head">{t.languages}</legend>
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
            </fieldset>
            <div className="field">
              <span className="field-label">{t.defaultLanguage}</span>
              <Select language={language}
                name="defaultLanguage"
                options={UI_LANGUAGES.map(j => ({ value: j, label: d.people.languages[j] ?? j }))}
                initial={tenant.defaultLanguage}
                fieldLabel={t.defaultLanguage}
              />
              <span className="quiet field-hint">{t.defaultLanguageNote}</span>
            </div>
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.domainsSection}</h2></div>
          <div className="set-sec-body">
            <label className="field">
              <span className="field-label">{t.domains}</span>
              <textarea className="field-input" name="hostnames" rows={3} defaultValue={tenant.hostnames.join("\n")} />
              <span className="quiet field-hint">{t.domainsNote}</span>
            </label>
            <label className="field">
              <span className="field-label">{t.autoProvision}</span>
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
                {t.autoProvisionBefore}<strong>{t.autoProvisionHighlight}</strong>{t.autoProvisionAfter}
              </span>
            </label>
          </div>
        </section>

        <ProviderSection tenant={tenant} provider="microsoft" domain={tenant.hostnames[0]} language={language} />
        <ProviderSection tenant={tenant} provider="google" domain={tenant.hostnames[0]} language={language} />

        <div className="set-savebar">
          <SubmitButton className="button">{t.save}</SubmitButton>
          <span className="quiet">{d.common.saveBarNote}</span>
        </div>
      </form>

      {/*
        Ďalšie akcie — nič neukladajú (ZAKLAD-lista-ulozenia). Vratné tiché,
        nevratné `--danger` s potvrdením cez adresu: odstránenie vlastného
        prihlásenia (`?remove=`) a vypnutie organizácie (`?disable=1`) si
        pýtajú kód organizácie — „naozaj?" sa odklikne skôr, než sa prečíta.
      */}
      <section className="card more admin-more">
        <div className="more-head"><h2>{d.common.moreActions}</h2></div>

        {pending.length > 0 && (
          <form action={sendInstructionsAction} className="more-row">
            <input type="hidden" name="companyCode" value={tenant.companyCode} />
            <input type="hidden" name="hostnames" value={tenant.hostnames.join(" ")} />
            <div className="more-main">
              <b>{t.sendTitle}</b>
              <span>{t.sendHint(pending.length)}</span>
              <input className="field-input" type="email" name="to" defaultValue={tenant.branding.supportEmail} aria-label={t.sendTo} />
            </div>
            <SubmitButton className="button button--quiet">{t.send}</SubmitButton>
          </form>
        )}

        {(["microsoft", "google"] as const).filter(p => providerStatus(tenant, p).source === "tenant").map(p => {
          const ts = d.admin.signIn
          return (
            <div key={p}>
              <div className="more-row">
                <div className="more-main">
                  <b>{ts.removeOwnTitle(PROVIDER_LABEL[p])}</b>
                  <span>{ts.removeOwnNote}</span>
                </div>
                {remove !== p && <Link className="button button--danger" href={`${`/admin/tenants/${encodeURIComponent(tenant.companyCode)}`}?remove=${p}#remove-${p}`}>{ts.removeOpen}</Link>}
              </div>
              {remove === p && (
                <form action={deleteSignInAction} className="more-confirm" id={`remove-${p}`}>
                  <input type="hidden" name="companyCode" value={tenant.companyCode} />
                  <input type="hidden" name="provider" value={p} />
                  <p>{ts.deleteNote}</p>
                  <Field name="confirmation" label={ts.confirmLabel(tenant.companyCode)} />
                  <div className="more-acts">
                    <SubmitButton className="button button--danger">{ts.deleteSubmit}</SubmitButton>
                    <Link className="button button--quiet" href={`/admin/tenants/${encodeURIComponent(tenant.companyCode)}`}>{ts.cancel}</Link>
                  </div>
                </form>
              )}
            </div>
          )
        })}

        {enabled ? (
          <>
            <div className="more-row">
              <div className="more-main">
                <b>{t.disableHeading}</b>
                <span>{t.disableNote}</span>
              </div>
              {disable !== "1" && <Link className="button button--danger" href={`${`/admin/tenants/${encodeURIComponent(tenant.companyCode)}`}?disable=1#disable`}>{t.disableOpen}</Link>}
            </div>
            {disable === "1" && (
              <form action={toggleTenantStatusAction} className="more-confirm" id="disable">
                <input type="hidden" name="companyCode" value={tenant.companyCode} />
                <input type="hidden" name="status" value="disabled" />
                <Field name="confirmation" label={t.confirmLabel(tenant.companyCode)} hint={t.confirmHint} />
                <div className="more-acts">
                  <SubmitButton className="button button--danger">{t.disable}</SubmitButton>
                  <Link className="button button--quiet" href={`/admin/tenants/${encodeURIComponent(tenant.companyCode)}`}>{t.cancel}</Link>
                </div>
              </form>
            )}
          </>
        ) : (
          // Zapnutie je vratné — tiché, bez potvrdenia (Q5).
          <form action={toggleTenantStatusAction} className="more-row">
            <input type="hidden" name="companyCode" value={tenant.companyCode} />
            <input type="hidden" name="status" value="active" />
            <div className="more-main">
              <b>{t.enableHeading}</b>
              <span>{t.enableNote}</span>
            </div>
            <SubmitButton className="button button--quiet">{t.enable}</SubmitButton>
          </form>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: "var(--fs-section)", margin: "0 0 4px" }}>{t.auditHeading}</h2>
        <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: "0 0 12px" }}>{t.auditNote}</p>
        <AuditList records={records} language={language} />
      </section>
    </div>
    </AppShell>
  )
}
