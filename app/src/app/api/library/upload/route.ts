/**
 * POST /api/library/upload — nahrávanie súboru po kúskoch (ADR-011, D98).
 *
 * Tri kroky, jedna adresa:
 *
 *   · `?step=start`  — JSON `{ name, bytes }` → `{ uploadId, chunkSize, chunks }`
 *   · `?step=chunk&uploadId=…&n=…` — telo sú holé bajty jedného kúska
 *   · `?step=finish&uploadId=…` — overí počet, spočíta SHA-256, založí súbor
 *
 * **Prečo nie serverová akcia:** tá berie `FormData` a jej telo spadá pod ten
 * istý strop 4,5 MB, ktorý tu obchádzame. Tu ide jeden kúsok (3 MB) na
 * požiadavku, takže strop Vercelu neprekročí nič.
 *
 * Prístup ako k nahrávaniu cez formulár: prihlásený **správca obsahu**
 * vlastnej organizácie. Rozpracované nahratie patrí autorovi — kúsky doň
 * nepridá nikto iný (`fileStore.sessionOf`).
 */

import { libraryContext } from "@/lib/library"
import { startUpload, putChunk, finishUpload } from "@/lib/fileStore"
import { AppError } from "@/lib/appError"
import { errorText } from "@/lib/i18n"
import { sameOrigin } from "@/lib/sameOrigin"

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
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    return json({ error: "forbidden" }, ctx.state === "not-signed-in" ? 401 : 403)
  }
  const companyCode = ctx.tenant.companyCode
  const actor = ctx.person.email
  const url = new URL(request.url)
  const step = url.searchParams.get("step")
  const uploadId = url.searchParams.get("uploadId") ?? ""

  try {
    if (step === "start") {
      const body = (await request.json().catch(() => ({}))) as { name?: unknown; bytes?: unknown }
      return json(await startUpload(companyCode, actor, String(body.name ?? ""), Number(body.bytes)))
    }
    if (step === "chunk") {
      const n = Number(url.searchParams.get("n"))
      const data = Buffer.from(await request.arrayBuffer())
      await putChunk(companyCode, actor, uploadId, n, data)
      return json({ ok: true })
    }
    if (step === "finish") {
      const file = await finishUpload(companyCode, actor, uploadId)
      return json({ fileId: file.id, name: file.name, bytes: file.bajtov, sha256: file.sha256 })
    }
    return json({ error: "unknown step" }, 400)
  } catch (e) {
    // Veta v jazyku človeka, ktorý nahráva — prehliadač ju ukáže tak, ako je.
    if (!(e instanceof AppError)) console.error("[nahravanie] zlyhalo:", e)
    return json({ error: errorText(e, ctx.person.language) }, e instanceof AppError ? 400 : 500)
  }
}
