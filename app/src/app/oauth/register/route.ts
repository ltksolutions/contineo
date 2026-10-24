/**
 * POST /oauth/register — dynamická registrácia klienta (RFC 7591), ADR-038.
 *
 * Klient (Claude.ai, Claude Code, inšpektor) pošle svoje metadáta a dostane
 * `client_id`; verejný klient bez tajomstva. Registrácia patrí organizácii
 * hostiteľa — ten istý klient na inej doméne sa registruje znova (D32).
 * Novšia revízia špecifikácie dáva prednosť Client ID Metadata Document
 * (D256); táto cesta ostáva pre klientov, ktorí ho ešte nevedia.
 */

import { tenantForMcp } from "@/lib/mcpServer/auth"
import { registerClient, OAuthError } from "@/lib/oauthServer"
import { jsonResponse } from "@/lib/mcpServer/metadata"
import { CORS_HEADERS, oauthErrorResponse, preflight } from "@/lib/mcpServer/oauthHttp"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const found = await tenantForMcp()
  if (!found?.state.active) return new Response(null, { status: 404 })
  try {
    let body: unknown
    try { body = await req.json() } catch { throw new OAuthError("invalid_client_metadata", "Telo nie je JSON.") }
    const { record, clientSecret } = await registerClient(found.tenant.companyCode, body)
    return jsonResponse({
      client_id: record.clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
      client_id_issued_at: Math.floor(record.createdAt.getTime() / 1000),
      client_name: record.clientName,
      redirect_uris: record.redirectUris,
      token_endpoint_auth_method: record.tokenEndpointAuthMethod,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      ...(record.clientUri ? { client_uri: record.clientUri } : {}),
      ...(record.logoUri ? { logo_uri: record.logoUri } : {}),
    }, 201, CORS_HEADERS)
  } catch (e) {
    return oauthErrorResponse(e)
  }
}

export function OPTIONS() { return preflight() }
