/**
 * Pôvodný nahratý súbor.
 *
 * **Neverejný.** Je to obsah zákazníka, nie značka: vyžaduje prihlásenie, rolu
 * správcu obsahu a zhodu organizácie (D32). Identifikátor v GridFS sa dá
 * uhádnuť a bez podmienky na organizáciu by sa dali skúšaním vytiahnuť
 * dokumenty cudzieho zväzu.
 *
 * Servíruje sa **na stiahnutie a na náhľad**, nie ako stránka: `nosniff`
 * a `Content-Disposition: inline` s vlastným názvom. PDF si prehliadač
 * zobrazí sám, čo je presne to, čo editor potrebuje vedľa Markdownu.
 */

import { libraryContext } from "@/lib/library"
import { loadFile } from "@/lib/fileStore"

export const dynamic = "force-dynamic"

/** Typ sa určuje z prípony, nie z toho, čo pri nahratí tvrdil prehliadač. */
const TYPY: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    return new Response(null, { status: ctx.state === "not-signed-in" ? 401 : 403 })
  }

  const { id } = await params

  let s
  try {
    s = await loadFile(ctx.tenant.companyCode, decodeURIComponent(id))
  } catch (e) {
    console.error("[kniznica] súbor sa nepodarilo načítať:", e)
    return new Response(null, { status: 500 })
  }
  if (!s) return new Response(null, { status: 404 })

  const pripona = s.nazov.toLowerCase().split(".").pop() ?? ""
  const typ = TYPY[pripona] ?? "application/octet-stream"

  return new Response(new Uint8Array(s.data), {
    headers: {
      "Content-Type": typ,
      "Content-Length": String(s.data.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(s.nazov)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
