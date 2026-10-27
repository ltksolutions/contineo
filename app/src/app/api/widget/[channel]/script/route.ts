/**
 * GET /api/widget/[channel]/script — skript widgetu (ADR-028, D166).
 *
 * Verejný (bez prihlásenia), ale len pre kanál s povolenými pôvodmi a bez
 * tajomstiev: skript nesie adresu API, kľúč kanála, farbu organizácie
 * a texty v jazyku kanála. Pôvod sa tu neoveruje — `<script src>` hlavičku
 * `Origin` neposiela; overí sa pri každom volaní API.
 */

import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { widgetAppearance, appearanceForScript } from "@/lib/widgetAppearance"
import { currentTenant, requestHostname } from "@/lib/session"
import { channelByKey, widgetFallbackContact } from "@/lib/channels"
import { dictionary } from "@/lib/i18n"
import { brandingView } from "@/lib/tenants"
import { widgetScript } from "@/lib/widgetScript"
import { widgetSources } from "@/lib/widgetSources"
import { accentVars } from "@/components/TenantHeader"

export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel: key } = await params
  const tenant = await currentTenant().catch(() => null)
  if (!tenant) return new Response(null, { status: 404 })
  const channel = await channelByKey(tenant.companyCode, key)
  if (!channel || channel.kind !== "widget" || !channel.widget.origins.length) return new Response(null, { status: 404 })
  const language = channel.languages[0] ?? tenant.defaultLanguage
  const host = await requestHostname()
  const tw = dictionary(language).widget
  const branding = brandingView(tenant)
  const accent = branding.accentColor ?? "#1f6feb"
  const org = branding.shortName?.trim() || branding.displayName
  // Povolené zdroje kanála (KANAL-widget-zdroje): Knižnica a verejné konektory
  // z `connectorScopes`, jeden za konektor. Podnadpis riadku je hotový text.
  const sources = (await widgetSources(tenant.companyCode, channel, language, tw.scopeLibrary))
    .map(s => ({ ...s, sub: s.id === "library" ? tw.scopeLibrarySub.replace("{org}", org) : tw.scopeLiveSub }))
  const js = widgetScript({
    apiBase: `https://${host}`,
    channel: channel.key,
    accent,
    // Hover plného tlačidla ako v aplikácii (`--accent-strong` z `accentVars`).
    accentStrong: accentVars(accent)["--accent-strong"] ?? accent,
    sources,
    texts: { ...dictionary(language).widget, rateLimited: dictionary(language).errors["widget.rateLimited"] ?? "" } as Record<string, string>,
    language,
    contact: widgetFallbackContact(channel, tenant.branding?.supportEmail),
    appearance: appearanceForScript(widgetAppearance(channel.widget.appearance), language),
  })
  // ETag z obsahu (D284): prehliadač sa po 5 minútach opýta, a keď sa
  // nastavenie kanála nezmenilo, dostane 304 bez tela.
  const etag = `"${createHash("sha256").update(js).digest("base64url").slice(0, 27)}"`
  const headers = {
    "Content-Type": "application/javascript; charset=utf-8",
    // 5 minút (D284): zmena vzhľadu, textov alebo farby sa v cudzom systéme
    // prejaví do 5 minút, bez zásahu u neho.
    "Cache-Control": "public, max-age=300",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  }
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers })
  return new NextResponse(js, { headers })
}
