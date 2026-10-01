/**
 * /privacy — informovanie dotknutých osôb (čl. 13 GDPR), C1 / ADR-012.
 *
 * **Verejná stránka** (`publicRoutes.ts`): informovanie má byť dostupné skôr,
 * než sa údaje začnú zbierať — teda aj pred prvým prihlásením, z pozvánky.
 * Ukazuje len údaje o organizácii a kontakt na DPO, nič o prihlásenom človeku.
 */

import { notFound } from "next/navigation"
import { currentTenant, currentPerson } from "@/lib/session"
import { brandingView, type Tenant } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate, normalizeLanguage } from "@/lib/i18n"
import { dpoContacts, privacyProcessors, PRIVACY_NOTICE_VERSION } from "@/lib/privacy"
import { defaultProfile, getTenantProfile } from "@/lib/tenantProfile"
import { retentionSettings } from "@/lib/retention"
import { pendingObjectionOf } from "@/lib/objectionsDb"
import { OBJECTION_TEXT_MAX } from "@/lib/objections"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import Notice from "@/components/Notice"
import { submitObjectionAction } from "./actions"

export const dynamic = "force-dynamic"

/**
 * Tabuľka od 640 px, pod tým zoznam kariet (rám PRIVACY-citatelnost, bod 3):
 * prvý stĺpec tučne, ostatné pod ním. Obe podoby sú v HTML, prepína CSS.
 */
function Table({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <>
      <table className="privacy-table">
        <thead><tr>{columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{rows.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
      </table>
      <ul className="privacy-stack">
        {rows.map(r => (
          <li key={r[0]} className="card">
            <strong>{r[0]}</strong>
            {r.slice(1).filter(Boolean).length > 0 && <span className="quiet">{r.slice(1).filter(Boolean).join(" · ")}</span>}
          </li>
        ))}
      </ul>
    </>
  )
}

export default async function PrivacyPage({ searchParams }: { searchParams?: Promise<RawQuery> } = {}) {
  const q = normalizeQuery<{ msg?: string; error?: string }>(searchParams ? await searchParams : {})
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    console.error("[privacy] tenanta sa nepodarilo načítať:", e)
  }
  if (!tenant) notFound()

  // Prihlásený číta vo svojom jazyku, neprihlásený v jazyku organizácie.
  const person = await currentPerson().catch(() => null)
  const language = normalizeLanguage(person?.language ?? tenant.defaultLanguage)
  const t = dictionary(language).privacy
  const branding = brandingView(tenant)
  // Kontakt GDPR z nastavení organizácie (D153) má prednosť; bez neho osoby
  // s rolou `dpo` ako doteraz.
  const contact = tenant.privacy?.contact?.email
    ? [{ fullName: tenant.privacy.contact.name ?? "", email: tenant.privacy.contact.email }]
    : null
  const dpos = contact ?? await dpoContacts(tenant.companyCode).catch(() => [])
  const objectionAddress = dpos[0]?.email
  // Námietka po prihlásení (D153): len osoba tejto organizácie; kým sa
  // predošlá posudzuje, namiesto formulára veta s jej dátumom.
  const signedIn = Boolean(person?.id && person.companyCode === tenant.companyCode)
  const pending = signedIn && person
    ? await pendingObjectionOf(tenant.companyCode, person.id).catch(() => null)
    : null
  // Vzdelávanie len organizácii, ktorá ho má zapnuté (ADR-018, D123) —
  // inak by text sľuboval spracúvanie, ktoré sa nedeje.
  const learning = tenant.modules?.learning ? t.learning : null
  // Úrad a zákony podľa krajiny sídla prevádzkovateľa, nie podľa jazyka (ADR-022).
  const country = tenant.controller?.country ?? "SK"
  const profile = await getTenantProfile(tenant.companyCode).catch(() => defaultProfile(tenant.companyCode))
  // Lehoty organizácie — tie isté čísla číta mazacia dávka (ADR-022, D136).
  const r = retentionSettings(tenant.privacy?.retention)
  const period = (rows: [string, string][]) => rows.map(([a, b]) => [a, b
    .replace("{evidence}", t.years(r.evidenceYears))
    .replace("{cap}", t.years(r.capYears))
    .replace("{months}", t.months(r.learningDetailMonths))
    .replace("{answers}", t.months(r.answersMonths))] as [string, string])
  // Verzia textu: neskoršia zo spoločného textu a nastavení organizácie (D138).
  const updated = tenant.privacy?.updatedAt ? new Date(tenant.privacy.updatedAt) : null
  const version = updated && updated > PRIVACY_NOTICE_VERSION ? updated : PRIVACY_NOTICE_VERSION
  // Doplnok DPO organizácie (D137): jazyk čitateľa, inak predvolený jazyk organizácie.
  const extra = (tenant.privacy?.extra?.[language] || tenant.privacy?.extra?.[tenant.defaultLanguage] || "").trim()
  const processors = privacyProcessors(profile).map(({ key, region }) =>
    t.processors[key].map(cell => cell.replace("{region}", region ?? "")) as [string, string, string])

  /*
   * Obsah stránky (rám, bod 1): nadpisy sekcií s kotvami. Od 1024 px bočný
   * stĺpec, pod tým riadok odkazov. Text je právny dokument — mení sa len
   * podoba, žiadna veta (C1).
   */
  const sections: [string, string][] = [
    ["purpose", t.purposeHeading],
    ["data", t.dataHeading],
    ["basis", t.basisHeading],
    ["retention", t.retentionHeading],
    ["recipients", t.recipientsHeading],
    ["rights", t.rightsHeading],
    ...(extra ? [["extra", t.extraHeading] as [string, string]] : []),
  ]
  const toc = (className: string) => (
    <nav className={className} aria-label={t.tocHeading}>
      {className === "privacy-toc" && <p className="privacy-toc-h">{t.tocHeading}</p>}
      {sections.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
    </nav>
  )

  return (
    <div className="wrap privacy" style={tenantStyle(branding)}>
      {toc("privacy-toc")}
      <div className="privacy-main">
        <h1 className="page-title">{t.title}</h1>
        <Notice message={q.msg} error={q.error === "1"} back="/privacy#rights" />
        <p className="quiet page-lead">{t.lead}</p>
        {toc("privacy-chips")}

        {/* Prevádzkovateľ a DPO ako dve karty hneď pod úvodom (bod 2). */}
        <div className="privacy-who">
          <section className="card privacy-who-card">
            <h2>{t.controllerHeading}</h2>
            <p>{t.controller(tenant.controller?.legalName || branding.displayName)}</p>
            {(tenant.controller?.address || tenant.controller?.registrationNumber) && (
              <p className="quiet">
                {t.controllerDetails(tenant.controller?.address ?? "", tenant.controller?.registrationNumber ?? "")}
              </p>
            )}
          </section>
          <section className="card privacy-who-card">
            <h2>{t.dpoHeading}</h2>
            {dpos.length > 0
              ? dpos.map(d => (
                  <p key={d.email}>
                    {d.fullName && <>{d.fullName} · </>}<a href={`mailto:${d.email}`}>{d.email}</a>
                  </p>
                ))
              : <p>{t.dpoMissing}</p>}
            {/* Presunuté z konca stránky (Ján 24. 9.) — patrí ku kontaktu. */}
            <p className="quiet">{t.requests}</p>
          </section>
        </div>

        <h2 id="purpose">{t.purposeHeading}</h2>
        <p>{t.purpose}{learning && <> {learning.purpose}</>}</p>

        <h2 id="data">{t.dataHeading}</h2>
        <Table columns={t.dataColumns} rows={learning ? [...t.data, ...learning.data] : t.data} />
        <p>{t.hrNote}</p>
        <p>{t.responsibleNote}</p>

        <h2 id="basis">{t.basisHeading}</h2>
        <p>{t.basisIntro}</p>
        <ul className="privacy-list">
          <li>{t.basisObligation}</li>
          <li>{t.basisInterest}</li>
        </ul>
        <p>{t.basisDirectory}</p>
        {learning && <p>{learning.basis(t.archiveLaw[country])}</p>}

        <h2 id="retention">{t.retentionHeading}</h2>
        <Table columns={t.retentionColumns} rows={period(learning ? [...t.retention, ...learning.retention] : t.retention)} />
        <p>{t.retentionDelete}{learning && <> {learning.retentionNote}</>}</p>

        <h2 id="recipients">{t.recipientsHeading}</h2>
        <p>{t.recipients}</p>
        {learning && <p>{learning.recipients}</p>}
        <Table columns={t.processorsColumns} rows={processors} />
        <p>{t.noSale} {learning ? learning.automated : t.automated}</p>

        <h2 id="rights">{t.rightsHeading}</h2>
        <p>{t.rights}{learning && <> {learning.rights}</>}</p>
        {/* Právo namietať v rámčeku s nadpisom (bod 4, Ján 24. 9.). */}
        <div className="privacy-objection">
          <h3>{t.objectionHeading}</h3>
          <p>{t.objection}</p>
          {objectionAddress && (
            <p>{t.objectionEmail} <a href={`mailto:${objectionAddress}`}>{objectionAddress}</a>.</p>
          )}
          {!signedIn && <p>{t.objectionSignIn} <a href="/sign-in">{t.objectionSignInLink}</a></p>}
          {signedIn && pending && <p><strong>{t.objectionPending(formatDate(pending.receivedAt, language))}</strong></p>}
          {signedIn && !pending && (
            <form action={submitObjectionAction} className="privacy-objection-form">
              <label className="field">
                <span className="field-label">{t.objectionFormLabel}</span>
                <textarea className="field-input" name="text" rows={4} required maxLength={OBJECTION_TEXT_MAX} />
                <span className="quiet field-hint">{t.objectionFormHint}</span>
              </label>
              <button className="button" type="submit">{t.objectionSubmit}</button>
            </form>
          )}
        </div>
        <p>{t.complaint[country]}</p>

        {/* Doplnok prevádzkovateľa (ADR-022, D137) — obyčajný text po odsekoch, nie HTML. */}
        {extra && (
          <>
            <h2 id="extra">{t.extraHeading}</h2>
            {extra.split(/\n\s*\n/).map((para, i) => <p key={i} style={{ whiteSpace: "pre-line" }}>{para}</p>)}
          </>
        )}

        <p className="privacy-foot">
          {t.version(formatDate(version, language))}
        </p>
      </div>
    </div>
  )
}
