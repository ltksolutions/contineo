/**
 * Fotografia osoby.
 *
 * **Neverejná, na rozdiel od loga.** Logo visí na prihlasovacej stránke; fotka
 * je osobný údaj zamestnanca. Preto sa vydá len prihlásenému človeku a len
 * z jeho vlastnej organizácie (D32) — inak by sa dal z cudzej domény vyťahať
 * fotoalbum firmy skúšaním identifikátorov.
 *
 * Pamäť je dlhá a nemenná, ale **súkromná**: `private` v `Cache-Control`
 * zabráni tomu, aby si fotku odložila spoločná medzipamäť po ceste.
 */

import { currentPerson } from "@/lib/session"
import { nacitajFotku } from "@/lib/fotka"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ja = await currentPerson()
  if (!ja) return new Response(null, { status: 401 })

  const { id } = await params

  let f
  try {
    f = await nacitajFotku(ja.companyCode, decodeURIComponent(id))
  } catch (e) {
    console.error("[fotka] načítanie zlyhalo:", e)
    return new Response(null, { status: 500 })
  }
  if (!f) return new Response(null, { status: 404 })

  const bajty = (f.data as unknown as { buffer?: Uint8Array }).buffer ?? f.data

  return new Response(new Uint8Array(bajty as Uint8Array), {
    headers: {
      "Content-Type": f.contentType,
      "Content-Length": String(f.bajtov),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
