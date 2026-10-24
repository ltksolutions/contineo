/**
 * /.well-known/oauth-protected-resource — metadáta chráneného zdroja
 * (RFC 9728) pre MCP klientov (ADR-038). Odpovedá len organizácia, ktorá
 * má MCP zapnuté a dovolené; inak 404 — server sa nemá čím prezradiť.
 */

import { tenantForMcp } from "@/lib/mcpServer/auth"
import { originOf } from "@/lib/mcpServer/origin"
import { jsonResponse, protectedResourceMetadata } from "@/lib/mcpServer/metadata"
import { CORS_HEADERS, preflight } from "@/lib/mcpServer/oauthHttp"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const found = await tenantForMcp()
  if (!found?.state.active) return new Response(null, { status: 404 })
  return jsonResponse(protectedResourceMetadata(originOf(req)), 200, CORS_HEADERS)
}

export function OPTIONS() { return preflight() }
