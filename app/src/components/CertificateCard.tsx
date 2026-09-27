/**
 * Karta certifikátu (rám CERTIFICATE) — logo organizácie z kópie pri
 * vydaní, alebo logo Contineo, keď organizácia logo nemá (Ján 27. 9. 2026).
 * Údaje sú kópie v certifikáte, nič sa nečíta z kurzu ani z organizácie.
 */

import { ContineoMark } from "./ContineoMark"
import type { Certificate } from "@/lib/certificates"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"

/** Adresa loga certifikátu: kópia v úložisku (overí sa hashom), statické logo, alebo nič. */
export function certificateLogoSrc(c: Pick<Certificate, "issuedBy" | "registrationNumber" | "verificationHash">): string | null {
  if (c.issuedBy.logoFileId) return `/verify/${encodeURIComponent(c.registrationNumber)}/logo?h=${c.verificationHash}`
  return c.issuedBy.logoUrl ?? null
}

export function CertificateLogo({ c, height = 40 }: { c: Pick<Certificate, "issuedBy" | "registrationNumber" | "verificationHash">; height?: number }) {
  const src = certificateLogoSrc(c)
  // eslint-disable-next-line @next/next/no-img-element -- logo z kópie certifikátu (za hashom), nie statický obrázok
  return src ? <img className="cert-logo" src={src} alt={c.issuedBy.name} style={{ maxHeight: height }} /> : <span className="cert-logo"><ContineoMark size={height - 4} /></span>
}

export default function CertificateCard({ c, language }: { c: Certificate; language: UiLanguage }) {
  const t = dictionary(language).learning.cert
  const revoked = Boolean(c.revokedAt)
  return (
    <article className={`card cert-card${revoked ? " is-revoked" : ""}`}>
      <div className="cert-top">
        <CertificateLogo c={c} />
        <span className={revoked ? "tag tag--expired" : "tag tag--published"}>{revoked ? t.revoked : t.valid}</span>
      </div>
      <p className="cert-kicker">{t.kicker}</p>
      <h1 className="cert-name">{c.holderName ?? "—"}</h1>
      <p className="cert-course">{t.completedCourse(c.courseTitle, c.courseVersion, c.holderSalutation)}</p>
      <dl className="cert-facts">
        <div><dt>{t.number}</dt><dd><code>{c.registrationNumber}</code></dd></div>
        <div><dt>{t.completed}</dt><dd>{formatDate(c.completedAt, language)}</dd></div>
        <div><dt>{t.issuer}</dt><dd>{c.issuedBy.name}</dd></div>
      </dl>
    </article>
  )
}
