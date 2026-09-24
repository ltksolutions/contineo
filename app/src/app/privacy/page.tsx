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

function Table({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="privacy-table">
        <thead><tr>{columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{rows.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
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

  const h2 = { fontSize: "var(--fs-section)", margin: "28px 0 8px" } as const
  const p = { margin: "0 0 10px", lineHeight: 1.65 } as const

  return (
    <div className="wrap" style={{ padding: "40px 16px 64px", maxWidth: 760, ...tenantStyle(branding) }}>
      <h1 className="page-title">{t.title}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 8px" }}>{t.lead}</p>

      <h2 style={h2}>{t.controllerHeading}</h2>
      <p style={p}>{t.controller(tenant.controller?.legalName || branding.displayName)}</p>
      {(tenant.controller?.address || tenant.controller?.registrationNumber) && (
        <p className="quiet" style={p}>
          {t.controllerDetails(tenant.controller?.address ?? "", tenant.controller?.registrationNumber ?? "")}
        </p>
      )}

      <h2 style={h2}>{t.dpoHeading}</h2>
      {dpos.length > 0
        ? dpos.map(d => (
            <p key={d.email} style={p}>
              {d.fullName} · <a href={`mailto:${d.email}`}>{d.email}</a>
            </p>
          ))
        : <p style={p}>{t.dpoMissing}</p>}

      <h2 style={h2}>{t.purposeHeading}</h2>
      <p style={p}>{t.purpose}</p>

      <h2 style={h2}>{t.dataHeading}</h2>
      <Table columns={t.dataColumns} rows={t.data} />
      <p style={{ ...p, marginTop: 12 }}>{t.hrNote}</p>
      <p style={p}>{t.responsibleNote}</p>

      <h2 style={h2}>{t.basisHeading}</h2>
      <p style={p}>{t.basisIntro}</p>
      <ul style={{ margin: "0 0 10px", paddingLeft: 20, lineHeight: 1.65 }}>
        <li>{t.basisObligation}</li>
        <li>{t.basisInterest}</li>
      </ul>
      <p style={p}>{t.basisDirectory}</p>

      <h2 style={h2}>{t.retentionHeading}</h2>
      <Table columns={t.retentionColumns} rows={t.retention} />
      <p style={{ ...p, marginTop: 12 }}>{t.retentionDelete}</p>

      <h2 style={h2}>{t.recipientsHeading}</h2>
      <p style={p}>{t.recipients}</p>
      <Table columns={t.processorsColumns} rows={t.processors} />
      <p style={{ ...p, marginTop: 12 }}>{t.noSale}</p>

      <h2 style={h2}>{t.rightsHeading}</h2>
      <p style={p}>{t.rights}</p>
      <p style={p}><strong>{t.objection}</strong></p>
      <p style={p}>{t.complaint}</p>
      <p style={p}>{t.requests}</p>

      <p className="quiet" style={{ fontSize: "var(--fs-small)", marginTop: 28 }}>
        {t.version(formatDate(PRIVACY_NOTICE_VERSION, language))}
      </p>
    </div>
  )
}
