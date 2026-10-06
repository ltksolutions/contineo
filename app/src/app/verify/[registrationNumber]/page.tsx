/**
 * /verify/[registrationNumber]?h= — verejné overenie certifikátu (rám
 * CERTIFICATE). Bez prihlásenia a bez AppShell.
 *
 * Ukáže číslo, kurz, dátum a vydavateľa — **meno držiteľa nikdy**. Odvolaný: dátum, **dôvod nie** (môže byť
 * osobný údaj). Zlé číslo aj zlý `h` = tá istá stránka „nenašiel sa"
 * s kódom 404 — neprezradí sa, či číslo existuje. `noindex`.
 */

import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { currentTenant } from "@/lib/session"
import { certificateToVerify } from "@/lib/certificatesDb"
import { CertificateLogo } from "@/components/CertificateCard"
import { ContineoMark } from "@/components/ContineoMark"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"
import { publicPageTitle } from "@/lib/publicPageTitle"

export const dynamic = "force-dynamic"
export async function generateMetadata(): Promise<Metadata> {
  // Názov v karte (verejná stránka — `lib/publicPageTitle.ts`); indexovať nie.
  return { ...(await publicPageTitle("/verify")), robots: { index: false, follow: false } }
}

export default async function VerifyPage({ params, searchParams }: { params: Promise<{ registrationNumber: string }>; searchParams: Promise<RawQuery> }) {
  const q = normalizeQuery<{ h?: string }>(await searchParams)
  const tenant = await currentTenant().catch(() => null)
  if (!tenant) notFound()
  const number = decodeURIComponent((await params).registrationNumber)
  const c = await certificateToVerify(tenant.companyCode, number, q.h ?? "")
  if (!c) notFound()
  const language = tenant.defaultLanguage
  const t = dictionary(language).learning.cert
  const issuerLine = [c.issuedBy.legalName ?? c.issuedBy.name, c.issuedBy.address, c.issuedBy.registrationNumber ? t.registrationNumber(c.issuedBy.registrationNumber) : null].filter(Boolean).join(" · ")

  return (
    <div className="vf">
      <div className="vf-logo"><CertificateLogo c={c} /></div>
      <section className="card vf-card">
        <h1 className="mc-h2">{t.vTitle}</h1>
        {c.revokedAt
          ? <div className="lnote lnote--bad"><span className="lnote-mark" aria-hidden="true">✕</span><span className="lnote-text">{t.vRevoked(formatDate(c.revokedAt, language))}</span></div>
          : <div className="lnote"><span className="lnote-mark" aria-hidden="true">✓</span><span className="lnote-text">{t.vValid(c.issuedBy.name)}</span></div>}
        <dl className="cert-facts">
          <div><dt>{t.number}</dt><dd><code>{c.registrationNumber}</code></dd></div>
          <div><dt>{t.vCourse}</dt><dd>{c.courseTitle}</dd></div>
          <div><dt>{t.completed}</dt><dd>{formatDate(c.completedAt, language)}</dd></div>
          <div><dt>{t.vIssuer}</dt><dd>{issuerLine}</dd></div>
        </dl>
        <p className="quiet mc-note">{t.vNameNote}</p>
      </section>
      <p className="vf-foot quiet"><ContineoMark size={16} /> {t.vFooter}</p>
    </div>
  )
}
