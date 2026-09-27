/**
 * Súbor kurzu — obrázok, galéria, video (modul Vzdelávanie, ADR-018 D122).
 *
 * Neverejný: prihlásenie, zapnutý modul a právo vidieť kurz, v ktorom je
 * súbor použitý (`canSeeCourseFile`). Video sa posiela **po úsekoch**
 * (`Range` → 206): bez toho sa v ňom nedá posúvať a každý úsek je pod
 * stropom odpovede na Verceli (4,5 MB, ADR-011 D98).
 */

import { learningContext } from "@/lib/learning"
import { canSeeCourseFile } from "@/lib/learningMedia"
import { fileInfo, openFileRange, openFileStream } from "@/lib/fileStore"

export const dynamic = "force-dynamic"

/** Najväčší úsek jednej odpovede — pod stropom 4,5 MB. */
const MAX_RANGE = 2 * 1024 * 1024

/** Typ z prípony — nie z toho, čo tvrdil prehliadač pri nahratí. */
const TYPES: Record<string, string> = {
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await learningContext()
  if (ctx.state === "not-signed-in") return new Response(null, { status: 401 })
  if (ctx.state !== "ready") return new Response(null, { status: 404 })
  const id = decodeURIComponent((await params).id)

  if (!(await canSeeCourseFile(ctx.person, ctx.isAdmin, id))) return new Response(null, { status: 404 })
  const info = await fileInfo(ctx.person.companyCode, id)
  if (!info) return new Response(null, { status: 404 })
  const type = TYPES[info.name.toLowerCase().split(".").pop() ?? ""] ?? "application/octet-stream"
  const common = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    ...(info.sha256 ? { ETag: `"${info.sha256}"` } : {}),
  }

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "")
  if (range) {
    let start = range[1] ? Number(range[1]) : Math.max(0, info.bytes - Number(range[2]))
    let end = range[1] && range[2] ? Number(range[2]) : info.bytes - 1
    if (!range[1]) end = info.bytes - 1
    if (start >= info.bytes || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.bytes}` } })
    }
    end = Math.min(end, start + MAX_RANGE - 1, info.bytes - 1)
    start = Math.max(0, start)
    const part = await openFileRange(ctx.person.companyCode, id, start, end)
    if (!part) return new Response(null, { status: 404 })
    return new Response(part.stream, {
      status: 206,
      headers: { ...common, "Content-Range": `bytes ${start}-${end}/${info.bytes}`, "Content-Length": String(end - start + 1) },
    })
  }

  // Bez Range (obrázok): celý súbor prúdom, bez dĺžky — ako v knižnici.
  const s = await openFileStream(ctx.person.companyCode, id)
  if (!s) return new Response(null, { status: 404 })
  return new Response(s.stream, { headers: { ...common, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(s.name)}` } })
}
