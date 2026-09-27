/**
 * Certifikát na tlač — A4 na šírku, jedna strana (rám CERTIFICATE, „PDF").
 *
 * PDF s QR kódom sa sťahuje zo `certificate/pdf`; táto stránka je na
 * priamu tlač. Obsah je len z kópií v certifikáte, takže vyzerá rovnako
 * aj o rok.
 * Farby sú pevné (tlač, nie téma); pätkové písmo len nadpis a meno (Q2 ✅).
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { learningContext } from "@/lib/learning"
import { enrollmentFor } from "@/lib/enrollmentsDb"
import { certificateForEnrollment, withHolderSalutation } from "@/lib/certificatesDb"
import { tenantOrigin, verifyPath } from "@/lib/certificates"
import { CertificateLogo } from "@/components/CertificateCard"
import { dictionary, formatDate } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function CertificatePrintPage({ params }: { params: Promise<{ courseKey: string }> }) {
  const ctx = await learningContext()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()
  const key = decodeURIComponent((await params).courseKey)
  const e = await enrollmentFor(ctx.person.companyCode, ctx.person.id, key)
  if (!e) notFound()
  const found = await certificateForEnrollment(ctx.person.companyCode, e.id)
  if (!found || found.revokedAt) redirect(`/learning/${key}/certificate`)
  const c = await withHolderSalutation(found)
  const language = ctx.person.language
  const t = dictionary(language).learning.cert
  const url = `${tenantOrigin(ctx.tenant.hostnames)}${verifyPath(c)}`

  return (
    <div className="cert-print-wrap">
      <p className="cert-print-hint no-print">{t.printNote} <Link className="linkish" href={`/learning/${key}/certificate`}>{t.backToCourse}</Link></p>
      <section className="cert-print">
        <div className="cp-top">
          <CertificateLogo c={c} height={64} />
          <div className="cp-no"><code>{c.registrationNumber}</code><span>{t.issuedOn(formatDate(c.issuedAt, language))}</span></div>
        </div>
        <div className="cp-mid">
          <p className="cp-title">{t.pdfTitle}</p>
          <p className="cp-sub">{t.pdfSub}</p>
          <p className="cp-line">{t.pdfConfirms(c.issuedBy.legalName ?? c.issuedBy.name)}</p>
          <p className="cp-name">{c.holderName ?? "—"}</p>
          <p className="cp-line">{t.pdfCompleted(c.courseTitle, c.holderSalutation)}</p>
          <p className="cp-meta">{t.pdfMeta(c.courseVersion, c.partsCount, c.testsPassed, formatDate(c.completedAt, language))}</p>
        </div>
        <div className="cp-bottom">
          <div className="cp-sign">
            <span className="cp-sign-line" />
            <b>{c.signer?.name ?? ""}</b>
            <span>{c.signer?.role ?? t.signature}</span>
          </div>
          <div className="cp-verify"><span>{t.pdfVerify}</span><code>{url}</code></div>
        </div>
      </section>
    </div>
  )
}
