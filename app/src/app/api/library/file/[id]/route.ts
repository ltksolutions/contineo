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
 *
 * **Posiela sa prúdom** (ADR-011, D98). Odpoveď poslaná naraz má na Verceli
 * strop 4,5 MB; 25 MB PDF by skončilo chybou 413 ešte pred prehliadačom.
 */

import { libraryContext } from "@/lib/library"
import { openFileStream } from "@/lib/fileStore"

export const dynamic = "force-dynamic"

/** Typ sa určuje z prípony, nie z toho, čo pri nahratí tvrdil prehliadač. */
const TYPES: Record<string, string> = {
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
    s = await openFileStream(ctx.tenant.companyCode, decodeURIComponent(id))
  } catch (e) {
    console.error("[kniznica] súbor sa nepodarilo načítať:", e)
    return new Response(null, { status: 500 })
  }
  if (!s) return new Response(null, { status: 404 })

  const extension = s.name.toLowerCase().split(".").pop() ?? ""
  const type = TYPES[extension] ?? "application/octet-stream"

  return new Response(s.stream, {
    headers: {
      "Content-Type": type,
      // `Content-Length` zámerne nie: odpoveď so známou dĺžkou môže platforma
      // spracovať ako celú, nie ako prúd — a tým ju vrátiť pod strop 4,5 MB.
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(s.name)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      // Odtlačok ako ETag: súbor sa pod rovnakým id nikdy nemení.
      ...(s.sha256 ? { ETag: `"${s.sha256}"` } : {}),
    },
  })
}
