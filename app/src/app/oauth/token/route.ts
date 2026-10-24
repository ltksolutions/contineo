/**
 * POST /oauth/token — výmena kódu za tokeny a obnova (ADR-038, D249).
 *
 * `authorization_code`: kód + PKCE overovač + návratová adresa + `resource`.
 * `refresh_token`: otočenie — starý sa odvolá, vydá sa nový pár.
 * Odpoveď je vždy `no-store`; token je tajomstvo klienta.
 */

import { tenantForMcp } from "@/lib/mcpServer/auth"
import { originOf } from "@/lib/mcpServer/origin"
import { exchangeCode, refreshTokens, OAuthError } from "@/lib/oauthServer"
import { jsonResponse } from "@/lib/mcpServer/metadata"
import { authenticateClient, CORS_HEADERS, oauthErrorResponse, preflight, readForm } from "@/lib/mcpServer/oauthHttp"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const found = await tenantForMcp()
  if (!found?.state.active) return new Response(null, { status: 404 })
  const companyCode = found.tenant.companyCode
  const origin = originOf(req)
  try {
    const form = await readForm(req)
    const client = await authenticateClient(req, form, companyCode)
    const grantType = form.grant_type ?? ""
    if (grantType === "authorization_code") {
      if (!form.code) throw new OAuthError("invalid_request", "Chýba code.")
      const tokens = await exchangeCode({
        companyCode, client, code: form.code, codeVerifier: form.code_verifier ?? null,
        redirectUri: form.redirect_uri ?? null, resource: form.resource ?? null, origin,
      })
      return jsonResponse(tokens, 200, CORS_HEADERS)
    }
    if (grantType === "refresh_token") {
      if (!form.refresh_token) throw new OAuthError("invalid_request", "Chýba refresh_token.")
      const tokens = await refreshTokens({
        companyCode, client, refreshToken: form.refresh_token, scope: form.scope ?? null, resource: form.resource ?? null, origin,
      })
      return jsonResponse(tokens, 200, CORS_HEADERS)
    }
    throw new OAuthError("unsupported_grant_type", `Nepodporovaný grant_type: ${grantType || "(prázdny)"}`)
  } catch (e) {
    return oauthErrorResponse(e)
  }
}

export function OPTIONS() { return preflight() }
