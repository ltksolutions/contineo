/**
 * /learning/[courseKey]/certificate/pdf — PDF certifikátu na stiahnutie
 * (rám CERTIFICATE, D122). Len držiteľ, len platný certifikát; PDF sa
 * vyrobí raz a potom sa vracia uložené (`certificatePdf`).
 */

import { notFound, redirect } from "next/navigation"
import { learningContext } from "@/lib/learning"
import { enrollmentFor } from "@/lib/enrollmentsDb"
import { certificateForEnrollment, certificatePdf } from "@/lib/certificatesDb"
import { tenantOrigin } from "@/lib/certificates"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ courseKey: string }> }) {
  const ctx = await learningContext()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()
  const key = decodeURIComponent((await params).courseKey)
  const e = await enrollmentFor(ctx.person.companyCode, ctx.person.id, key)
  if (!e) notFound()
  const c = await certificateForEnrollment(ctx.person.companyCode, e.id)
  if (!c) notFound()
  const pdf = await certificatePdf(c, tenantOrigin(ctx.tenant.hostnames), ctx.person.language)
  // Odvolaný: späť na stránku certifikátu, kde je vysvetlené prečo.
  if (!pdf) redirect(`/learning/${encodeURIComponent(key)}/certificate`)
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certifikat-${c.registrationNumber.replace(/[^A-Za-z0-9-]/g, "")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
