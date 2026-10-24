/**
 * POST /oauth/revoke — odvolanie tokenu klientom (RFC 7009), ADR-038.
 *
 * Odpoveď je 200 aj pri neznámom tokene — klient sa o cudzích tokenoch
 * nemá dozvedieť nič. Odvolanie obnovovacieho tokenu zruší celé pripojenie.
 * Funguje aj po vypnutí MCP v organizácii: odpojiť sa má dať vždy.
 */

import { tenantForMcp } from "@/lib/mcpServer/auth"
import { revokeToken, OAuthError } from "@/lib/oauthServer"
import { authenticateClient, CORS_HEADERS, oauthErrorResponse, preflight, readForm } from "@/lib/mcpServer/oauthHttp"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const found = await tenantForMcp()
  if (!found) return new Response(null, { status: 404 })
  try {
    const form = await readForm(req)
    const client = await authenticateClient(req, form, found.tenant.companyCode)
    if (!form.token) throw new OAuthError("invalid_request", "Chýba token.")
    await revokeToken(found.tenant.companyCode, client, form.token)
    return new Response(null, { status: 200, headers: CORS_HEADERS })
  } catch (e) {
    return oauthErrorResponse(e)
  }
}

export function OPTIONS() { return preflight() }
