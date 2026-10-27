/**
 * GET /channels/[key]/preview — náhľad widgetu kanála (ADR-042, Dodatok 1, D284).
 *
 * Prázdna stránka, ktorá stojí namiesto cudzej stránky: vloží skript
 * widgetu presne ako cudzí systém, s tokenom prihláseného správcu.
 * Je to `route.ts`, nie `page.tsx` — widget sa nemá vykresliť nad
 * rozhraním intranetu, ale nad prázdnou stránkou, ako u cudzieho systému.
 *
 * Len správca organizácie (rovnako ako nastavenie kanála). Token je
 * v stránke, preto `no-store`.
 */

import { orgContext } from "@/lib/orgSettings"
import { channelByKey } from "@/lib/channels"
import { requestHostname } from "@/lib/session"
import { dictionary } from "@/lib/i18n"
import { previewToken } from "@/lib/widgetPreview"

export const dynamic = "force-dynamic"

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const ctx = await orgContext()
  if (ctx.state === "not-signed-in") return Response.redirect(new URL("/sign-in", `https://${await requestHostname()}`), 303)
  if (ctx.state !== "ready") return new Response(null, { status: 404 })
  const { key } = await params
  const channel = await channelByKey(ctx.tenant.companyCode, decodeURIComponent(key))
  if (!channel || channel.kind !== "widget") return new Response(null, { status: 404 })

  const language = ctx.person.language
  const t = dictionary(language).channels
  const host = await requestHostname()
  const result = previewToken(channel, ctx.person)
  const origin = channel.widget.origins[0] ?? ""
  const tokenUrl = `/channels/${encodeURIComponent(channel.key)}/preview/token`
  const body = "token" in result
    ? `<p>${esc(t.previewIntro(origin))}</p>
<p class="note">${esc(t.previewReal)}</p>
<script src="https://${esc(host)}/api/widget/${encodeURIComponent(channel.key)}/script" data-token="${esc(result.token)}" data-token-url="${esc(tokenUrl)}" defer></script>`
    : `<p class="note">${esc(result.error === "noSecret" ? t.previewNoSecret : t.previewNoOrigins)}</p>`

  const html = `<!doctype html>
<html lang="${esc(language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(t.previewTitle(channel.name))}</title>
<style>
:root{color-scheme:light}
body{margin:0;padding:24px 16px;background:#f5f6f8;color:#161b22;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:0 auto}
h1{font-size:20px;margin:0 0 12px}
p{margin:0 0 10px}
.note{color:#5c6675;font-size:13px}
</style>
</head>
<body>
<main>
<h1>${esc(t.previewTitle(channel.name))}</h1>
${body}
</main>
</body>
</html>`
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
