/**
 * GET /api/widget/[channel]/pdf — PDF citovaného znenia a náhľad jeho strany
 * pre widget (Ján 3. 11. 2026, KANAL-widget-strana).
 *
 *   · `?d=&v=&e=&s=` — PDF znenia (odkaz „Strana N" otvorí `#page=N`);
 *   · `…&page=N` — PNG náhľad strany N (`renderPdfPageThumb`).
 *
 * Človek z ISSF nie je prihlásený do intranetu, preto tu nie je relácia, ale
 * **podpis kanála** (`widgetPdfLink.ts`), ktorý vzniká len pri odpovedi
 * z úsekov, ktoré kanál smel citovať. Navyše sa tu znova overí, že dokument
 * je stále **verejný** (`accessLevel: "public"`) — dokument, ktorý medzitým
 * prešiel na interný, cez starý odkaz neodíde.
 *
 * Bez CORS hlavičiek zámerne: `<img>` a otvorenie v novej karte ich
 * nepotrebujú a skript cudzej stránky si PDF prečítať nemá.
 *
 * Každá chyba je 404 — z odpovede sa nemá dať vyčítať, či dokument existuje.
 */

import { currentTenant } from "@/lib/session"
import { channelByKey, widgetSecret } from "@/lib/channels"
import { loadDocument } from "@/lib/documents"
import { loadFile, openFileStream } from "@/lib/fileStore"
import { verifyPdfLink } from "@/lib/widgetPdfLink"
import { renderPdfPageThumb } from "@/lib/pdfThumb"

export const dynamic = "force-dynamic"

const notFound = () => new Response(null, { status: 404 })

export async function GET(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel: key } = await params
  const tenant = await currentTenant().catch(() => null)
  if (!tenant) return notFound()
  const channel = await channelByKey(tenant.companyCode, key)
  if (!channel || channel.kind !== "widget") return notFound()
  const secret = widgetSecret(channel)
  if (!secret) return notFound()

  const q = new URL(req.url).searchParams
  const claims = { channelKey: channel.key, documentId: q.get("d") ?? "", versionId: q.get("v") ?? "", exp: Number(q.get("e")) }
  if (!verifyPdfLink(claims, q.get("s") ?? "", secret)) return notFound()

  // `companyCode` je v podmienke dotazu (D32) — podpis iného tenanta sem nedosiahne.
  const doc = await loadDocument(tenant.companyCode, claims.documentId)
  if (!doc || doc.accessLevel !== "public") return notFound()
  const file = doc.versions?.find(v => v.versionId === claims.versionId)?.pdf
  if (!file) return notFound()

  const pageParam = q.get("page")
  if (pageParam !== null) {
    const page = Number(pageParam)
    if (!Number.isInteger(page) || page < 1 || page > 9999) return notFound()
    const loaded = await loadFile(tenant.companyCode, file.id)
    if (!loaded) return notFound()
    let png: Buffer | null = null
    try {
      png = await renderPdfPageThumb(new Uint8Array(loaded.data), page)
    } catch (e) {
      // Widget pri chybe ukáže prázdny papier s číslom strany — odkaz ostáva.
      console.error(`[widget] náhľad strany ${page} sa nepodarilo vykresliť:`, e)
    }
    if (!png) return notFound()
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        // Znenie sa nemení (D25) — obrázok strany je ten istý, kým platí podpis.
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        // `<img>` na cudzej stránke (ISSF) — bez toho by ho Chrome zablokoval.
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    })
  }

  const s = await openFileStream(tenant.companyCode, file.id)
  if (!s) return notFound()
  return new Response(s.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      ETag: `"${file.sha256}"`,
    },
  })
}
