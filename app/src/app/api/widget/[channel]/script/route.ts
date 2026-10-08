/**
 * GET /api/widget/[channel]/script — skript widgetu (ADR-028, D166).
 *
 * Verejný (bez prihlásenia), ale len pre kanál s povolenými pôvodmi a bez
 * tajomstiev: skript nesie adresu API, kľúč kanála, farbu organizácie
 * a texty v jazyku kanála. Pôvod sa tu neoveruje — `<script src>` hlavičku
 * `Origin` neposiela; overí sa pri každom volaní API.
 */

import { NextResponse } from "next/server"
import { currentTenant, requestHostname } from "@/lib/session"
import { channelByKey, widgetFallbackContact } from "@/lib/channels"
import { dictionary } from "@/lib/i18n"
import { brandingView } from "@/lib/tenants"
import { widgetScript } from "@/lib/widgetScript"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel: key } = await params
  const tenant = await currentTenant().catch(() => null)
  if (!tenant) return new Response(null, { status: 404 })
  const channel = await channelByKey(tenant.companyCode, key)
  if (!channel || channel.kind !== "widget" || !channel.widget.origins.length) return new Response(null, { status: 404 })
  const language = channel.languages[0] ?? tenant.defaultLanguage
  const host = await requestHostname()
  const js = widgetScript({
    apiBase: `https://${host}`,
    channel: channel.key,
    accent: brandingView(tenant).accentColor ?? "#1f6feb",
    texts: { ...dictionary(language).widget, rateLimited: dictionary(language).errors["widget.rateLimited"] ?? "" } as Record<string, string>,
    language,
    contact: widgetFallbackContact(channel, tenant.branding?.supportEmail),
  })
  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Hodina: zmena textu alebo farby sa prejaví do hodiny, bez nasadenia.
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
