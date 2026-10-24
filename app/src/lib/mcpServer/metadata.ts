/**
 * metadata.ts — metadáta chráneného zdroja (RFC 9728) a autorizačného
 * servera (RFC 8414) pre MCP klientov (ADR-038, D249).
 *
 * Klient dostane z `/mcp` odpoveď 401 s odkazom sem, odtiaľto zistí, kde
 * sa prihlásiť a čo server vie. Všetko sa skladá z pôvodu požiadavky —
 * každá organizácia má svoju doménu a teda svoje metadáta (D29).
 */

import { OAUTH_SCOPES, resourceFor } from "../oauthServer"

export function protectedResourceMetadata(origin: string): Record<string, unknown> {
  return {
    resource: resourceFor(origin),
    authorization_servers: [origin],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "Contineo",
    resource_documentation: "https://contineo.app/sk/technologia",
  }
}

export function authorizationServerMetadata(origin: string): Record<string, unknown> {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: [...OAUTH_SCOPES],
    // Client ID Metadata Documents (D256) — klient sa predstaví adresou dokumentu.
    client_id_metadata_document_supported: true,
    service_documentation: "https://contineo.app/sk/technologia",
  }
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  })
}
