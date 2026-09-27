/**
 * /learning/[courseKey]/certificate — certifikát pre držiteľa (rám CERTIFICATE).
 *
 * Karta z kópií v certifikáte, PDF na stiahnutie (A4 na šírku, s QR), tlač,
 * overovací odkaz. Odvolaný: dôvod vidí len držiteľ, tlač sa neponúka
 * a overovací blok sa neukazuje. Certifikát sa tu vydá, ak kurz je
 * dokončený a ešte vydaný nebol (`ensureCertificate` si to overí sám).
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { learningContext } from "@/lib/learning"
import { getCourse } from "@/lib/coursesDb"
import { enrollmentFor } from "@/lib/enrollmentsDb"
import { ensureCertificate } from "@/lib/certificatesDb"
import { tenantOrigin, verifyPath } from "@/lib/certificates"
import { versionById } from "@/lib/courses"
import AppShell from "@/components/AppShell"
import CertificateCard from "@/components/CertificateCard"
import CopyLink from "@/components/CopyLink"
import { normalizeLayout } from "@/lib/appNav"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function CertificatePage({ params, searchParams }: { params: Promise<{ courseKey: string }>; searchParams: Promise<RawQuery> }) {
  const q = normalizeQuery<{ layout?: string }>(await searchParams)
  const ctx = await learningContext()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()
  const key = decodeURIComponent((await params).courseKey)
  const course = await getCourse(ctx.person.companyCode, key)
  if (!course) notFound()
  const e = await enrollmentFor(ctx.person.companyCode, ctx.person.id, key)
  if (!e || e.cancelledAt) redirect(`/learning/${course.key}`)
  const version = versionById(course, e.versionId)
  const language = ctx.person.language
  const t = dictionary(language).learning.cert
  const c = await ensureCertificate(e, ctx.tenant)
  const base = `/learning/${course.key}`

  let body
  if (!c) {
    body = (
      <section className="card rs-hidden">
        <p>{version?.issuesCertificate ? t.notYet : t.noCertificate}</p>
        <Link className="button button--quiet" href={base}>{t.backToCourse}</Link>
      </section>
    )
  } else {
    const url = `${tenantOrigin(ctx.tenant.hostnames)}${verifyPath(c)}`
    body = (
      <div className="rs-cols">
        <div className="rs-main">
          {c.revokedAt && (
            <div className="lnote lnote--bad"><span className="lnote-mark" aria-hidden="true">!</span><span className="lnote-text">{t.revokedNotice(formatDate(c.revokedAt, language), c.revokedReason ?? "")}</span></div>
          )}
          <CertificateCard c={c} language={language} />
          <div className="rs-act">
            {c.revokedAt
              ? <><button type="button" className="button" disabled aria-disabled="true" aria-describedby="cert-why">{t.downloadPdf}</button><p id="cert-why" className="quiet">{t.revokedPdf}</p></>
              : <><a className="button" href={`${base}/certificate/pdf`} download>{t.downloadPdf}</a><Link className="button button--quiet" href={`${base}/certificate/print`}>{t.print}</Link></>}
            <Link className="button button--quiet" href={base}>{t.backToCourse}</Link>
          </div>
          {!c.revokedAt && (
            <section className="card cert-verify">
              <h2 className="mc-h2">{t.verifyHeading}</h2>
              <code className="cert-url">{url}</code>
              <p className="quiet mc-note">{t.verifyNote}</p>
              <CopyLink value={url} label={t.copy} done={t.copy} />
            </section>
          )}
        </div>
        <aside className="rs-side">
          <section className="card rs-who"><h2 className="mc-h2">{t.sideVerify}</h2><p className="quiet">{t.sideVerifyText}</p></section>
          <section className="card rs-who"><h2 className="mc-h2">{t.sideKeep}</h2><p className="quiet">{t.sideKeepText}</p></section>
        </aside>
      </div>
    )
  }

  return (
    <AppShell layout={normalizeLayout(q.layout)} language={language}>
      <div className="at rs">
        <p className="detail-back"><Link className="quiet" href={base}>← {version?.title ?? course.title}</Link></p>
        {body}
      </div>
    </AppShell>
  )
}
