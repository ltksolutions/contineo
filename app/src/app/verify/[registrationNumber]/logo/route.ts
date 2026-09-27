/**
 * Logo z kópie certifikátu (rám CERTIFICATE). Verejné ako samotné overenie,
 * ale len s platným číslom **aj** hashom — súbor sa inak neprezradí.
 */

import { currentTenant } from "@/lib/session"
import { certificateToVerify } from "@/lib/certificatesDb"
import { openFileStream } from "@/lib/fileStore"

export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: Promise<{ registrationNumber: string }> }) {
  const tenant = await currentTenant().catch(() => null)
  if (!tenant) return new Response(null, { status: 404 })
  const number = decodeURIComponent((await params).registrationNumber)
  const c = await certificateToVerify(tenant.companyCode, number, new URL(req.url).searchParams.get("h") ?? "")
  if (!c?.issuedBy.logoFileId) return new Response(null, { status: 404 })
  const s = await openFileStream(tenant.companyCode, c.issuedBy.logoFileId)
  if (!s) return new Response(null, { status: 404 })
  const ext = s.name.toLowerCase().split(".").pop()
  const type = ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg"
  return new Response(s.stream, {
    headers: { "Content-Type": type, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" },
  })
}
