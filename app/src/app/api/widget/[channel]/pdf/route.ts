/**
 * GET /api/widget/[channel]/pdf — PDF citovaného znenia a náhľad jeho strany
 * pre widget (Ján 3. 11. 2026, KANAL-widget-strana).
 *
 *   · `?d=&v=&e=&s=` — PDF znenia; s `&download=1` na stiahnutie;
 *   · `…&page=N` — PNG náhľad strany N, s `&size=large` celá strana ako WebP
 *     pre prehliadač strán vo widgete (`renderPdfPage`);
 *   · `…&meta=1` — `{ pages }`, počet strán pre prehliadač (s CORS — číta
 *     ho skript widgetu na cudzej stránke).
 *
 * Človek z ISSF nie je prihlásený do intranetu, preto tu nie je relácia, ale
 * **podpis kanála** (`widgetPdfLink.ts`), ktorý vzniká len pri odpovedi
 * z úsekov, ktoré kanál smel citovať. Navyše sa tu znova overí, že dokument
 * je stále **verejný** (`accessLevel: "public"`) — dokument, ktorý medzitým
 * prešiel na interný, cez starý odkaz neodíde.
 *
 * CORS len pri `meta` a len pre pôvod kanála: `<img>` a otvorenie v novej
 * karte ho nepotrebujú a skript cudzej stránky si PDF prečítať nemá.
 *
 * Každá chyba je 404 — z odpovede sa nemá dať vyčítať, či dokument existuje.
 */

import { currentTenant } from "@/lib/session"
import { channelByKey, widgetSecret } from "@/lib/channels"
import { loadDocument } from "@/lib/documents"
import { loadFile, openFileStream } from "@/lib/fileStore"
import { verifyPdfLink } from "@/lib/widgetPdfLink"
import { PAGE_PIXEL_WIDTH, pdfPageCount, renderPdfPage } from "@/lib/pdfThumb"
import { corsHeaders, originAllowed, requestOrigin } from "@/lib/widgetApi"

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

  if (q.get("meta") === "1") {
    const origin = requestOrigin(req.headers)
    const cors = origin && originAllowed(channel, origin) ? corsHeaders(origin) : {}
    const loaded = await loadFile(tenant.companyCode, file.id)
    if (!loaded) return notFound()
    const pages = await pdfPageCount(new Uint8Array(loaded.data)).catch(() => 0)
    return Response.json({ pages }, { headers: { ...cors, "Cache-Control": "private, max-age=86400" } })
  }

  const pageParam = q.get("page")
  if (pageParam !== null) {
    const page = Number(pageParam)
    if (!Number.isInteger(page) || page < 1 || page > 9999) return notFound()
    const large = q.get("size") === "large"
    const loaded = await loadFile(tenant.companyCode, file.id)
    if (!loaded) return notFound()
    let image: Buffer | null = null
    try {
      image = large
        ? await renderPdfPage(new Uint8Array(loaded.data), page, PAGE_PIXEL_WIDTH, "webp")
        : await renderPdfPage(new Uint8Array(loaded.data), page)
    } catch (e) {
      // Widget pri chybe ukáže prázdny papier s číslom strany — odkaz ostáva.
      console.error(`[widget] stranu ${page} sa nepodarilo vykresliť:`, e)
    }
    if (!image) return notFound()
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": large ? "image/webp" : "image/png",
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
      // „Stiahnuť PDF" v prehliadači strán — inak sa PDF otvorí v prehliadači.
      "Content-Disposition": `${q.get("download") === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      ETag: `"${file.sha256}"`,
    },
  })
}
