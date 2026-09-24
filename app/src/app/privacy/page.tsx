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
import { dpoContacts, PRIVACY_NOTICE_VERSION } from "@/lib/privacy"

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

export default async function PrivacyPage() {
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
  const dpos = await dpoContacts(tenant.companyCode).catch(() => [])

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
                    {d.fullName} · <a href={`mailto:${d.email}`}>{d.email}</a>
                  </p>
                ))
              : <p>{t.dpoMissing}</p>}
            {/* Presunuté z konca stránky (Ján 24. 9.) — patrí ku kontaktu. */}
            <p className="quiet">{t.requests}</p>
          </section>
        </div>

        <h2 id="purpose">{t.purposeHeading}</h2>
        <p>{t.purpose}</p>

        <h2 id="data">{t.dataHeading}</h2>
        <Table columns={t.dataColumns} rows={t.data} />
        <p>{t.hrNote}</p>
        <p>{t.responsibleNote}</p>

        <h2 id="basis">{t.basisHeading}</h2>
        <p>{t.basisIntro}</p>
        <ul className="privacy-list">
          <li>{t.basisObligation}</li>
          <li>{t.basisInterest}</li>
        </ul>
        <p>{t.basisDirectory}</p>

        <h2 id="retention">{t.retentionHeading}</h2>
        <Table columns={t.retentionColumns} rows={t.retention} />
        <p>{t.retentionDelete}</p>

        <h2 id="recipients">{t.recipientsHeading}</h2>
        <p>{t.recipients}</p>
        <Table columns={t.processorsColumns} rows={t.processors} />
        <p>{t.noSale}</p>

        <h2 id="rights">{t.rightsHeading}</h2>
        <p>{t.rights}</p>
        {/* Právo namietať v rámčeku s nadpisom (bod 4, Ján 24. 9.). */}
        <div className="privacy-objection">
          <h3>{t.objectionHeading}</h3>
          <p>{t.objection}</p>
        </div>
        <p>{t.complaint}</p>

        <p className="privacy-foot">
          {t.version(formatDate(PRIVACY_NOTICE_VERSION, language))}
        </p>
      </div>
    </div>
  )
}
