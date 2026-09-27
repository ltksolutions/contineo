/**
 * Nahrávanie súborov kurzu po kúskoch — obrázky a video (modul
 * Vzdelávanie, rám MANAGE-COURSE, ADR-018 D122).
 *
 * Ten istý postup ako knižnica (`/api/library/upload`, `chunkedUpload`):
 * `start` → `chunk` × N → `finish`. Rozdiely: brána je rola
 * `learning-admin` a prípony sú len obrázky a hotové MP4/WebM (bez
 * prekódovania, D122). Strop 25 MB platí z `fileStore` (GridFS); väčšie
 * videá pribudnú s adaptérom `videoStorage`.
 */

import { learningAdminContext } from "@/lib/learning"
import { startUpload, putChunk, finishUpload } from "@/lib/fileStore"
import { AppError } from "@/lib/appError"
import { errorText } from "@/lib/i18n"
import { sameOrigin } from "@/lib/sameOrigin"
import { COURSE_MEDIA_EXTENSIONS } from "@/lib/learningMedia"

export const dynamic = "force-dynamic"

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  })
}

export async function POST(request: Request) {
  // Pred čímkoľvek iným: cesta zapisuje a cookie by prišla aj z cudzej stránky.
  if (!sameOrigin(request.headers)) return json({ error: "forbidden" }, 403)
  const ctx = await learningAdminContext()
  if (ctx.state !== "ready") return json({ error: "forbidden" }, ctx.state === "not-signed-in" ? 401 : 403)
  const companyCode = ctx.person.companyCode
  const actor = ctx.person.email
  const url = new URL(request.url)
  const step = url.searchParams.get("step")
  const uploadId = url.searchParams.get("uploadId") ?? ""

  try {
    if (step === "start") {
      const body = (await request.json().catch(() => ({}))) as { name?: unknown; bytes?: unknown }
      const name = String(body.name ?? "")
      const ext = `.${name.toLowerCase().split(".").pop() ?? ""}`
      if (!(COURSE_MEDIA_EXTENSIONS as readonly string[]).includes(ext)) {
        throw new AppError("learning.mediaType", `Súbor ${name} nie je obrázok ani video MP4/WebM.`, { name })
      }
      return json(await startUpload(companyCode, actor, name, Number(body.bytes)))
    }
    if (step === "chunk") {
      const n = Number(url.searchParams.get("n"))
      await putChunk(companyCode, actor, uploadId, n, Buffer.from(await request.arrayBuffer()))
      return json({ ok: true })
    }
    if (step === "finish") {
      const file = await finishUpload(companyCode, actor, uploadId)
      return json({ fileId: file.id, name: file.name, bytes: file.bajtov, sha256: file.sha256 })
    }
    return json({ error: "unknown step" }, 400)
  } catch (e) {
    // Ten istý tvar ako knižnica — `chunkedUpload` ukáže vetu z `error`.
    if (!(e instanceof AppError)) console.error("[learning] nahrávanie zlyhalo:", e)
    return json({ error: errorText(e, ctx.person.language) }, e instanceof AppError ? 400 : 500)
  }
}
