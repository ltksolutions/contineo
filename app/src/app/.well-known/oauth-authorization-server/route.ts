/**
 * /.well-known/oauth-authorization-server — metadáta autorizačného servera
 * (RFC 8414). Contineo vydáva tokeny samo (ADR-038, D249); `issuer` je
 * pôvod požiadavky, teda doména organizácie.
 */

import { tenantForMcp } from "@/lib/mcpServer/auth"
import { originOf } from "@/lib/mcpServer/origin"
import { authorizationServerMetadata, jsonResponse } from "@/lib/mcpServer/metadata"
import { CORS_HEADERS, preflight } from "@/lib/mcpServer/oauthHttp"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const found = await tenantForMcp()
  if (!found?.state.active) return new Response(null, { status: 404 })
  return jsonResponse(authorizationServerMetadata(originOf(req)), 200, CORS_HEADERS)
}

export function OPTIONS() { return preflight() }
