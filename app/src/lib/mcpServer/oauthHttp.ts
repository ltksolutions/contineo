/**
 * oauthHttp.ts — spoločné pre OAuth endpointy (`/oauth/*`): čítanie tela,
 * overenie klienta a odpoveď s chybou v tvare RFC 6749 § 5.2.
 */

import { OAuthError, clientById, clientSecretOk, type OAuthClientRecord } from "../oauthServer"
import { jsonResponse } from "./metadata"

/** `application/x-www-form-urlencoded` (OAuth) aj JSON (niektoré klienty). */
export async function readForm(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? ""
  const out: Record<string, string> = {}
  try {
    if (type.includes("application/json")) {
      const body = await req.json() as Record<string, unknown>
      for (const [k, v] of Object.entries(body ?? {})) if (typeof v === "string") out[k] = v
    } else {
      const text = await req.text()
      for (const [k, v] of new URLSearchParams(text)) out[k] = v
    }
  } catch {
    // Nečitateľné telo = prázdny formulár; chýbajúce polia ohlási volajúci.
  }
  return out
}

/**
 * Identita klienta: `client_secret_basic` z hlavičky, `client_secret_post`
 * z tela, verejný klient len `client_id`. Nesprávne tajomstvo je
 * `invalid_client` (401), nie `invalid_grant`.
 */
export async function authenticateClient(req: Request, form: Record<string, string>, companyCode: string): Promise<OAuthClientRecord> {
  let clientId = form.client_id ?? ""
  let secret: string | null = form.client_secret ?? null
  const auth = req.headers.get("authorization") ?? ""
  if (/^Basic\s+/i.test(auth)) {
    try {
      const [id, ...rest] = Buffer.from(auth.replace(/^Basic\s+/i, ""), "base64").toString("utf8").split(":")
      clientId = decodeURIComponent(id)
      secret = decodeURIComponent(rest.join(":"))
    } catch {
      throw new OAuthError("invalid_client", "Hlavička Authorization sa nedá prečítať.", 401)
    }
  }
  if (!clientId) throw new OAuthError("invalid_client", "Chýba client_id.", 401)
  const client = await clientById(companyCode, clientId)
  if (!client) throw new OAuthError("invalid_client", "Neznámy klient.", 401)
  if (!clientSecretOk(client, secret)) throw new OAuthError("invalid_client", "Tajomstvo klienta nesedí.", 401)
  return client
}

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
}

export function oauthErrorResponse(e: unknown): Response {
  if (e instanceof OAuthError) {
    return jsonResponse({ error: e.oauthCode, error_description: e.message }, e.status, {
      ...CORS_HEADERS, ...(e.status === 401 ? { "www-authenticate": `Basic realm="Contineo"` } : {}),
    })
  }
  console.error("[oauth] endpoint zlyhal:", e)
  return jsonResponse({ error: "server_error" }, 500, CORS_HEADERS)
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
