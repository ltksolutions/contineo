/**
 * GET /oauth/authorize — začiatok povolenia (ADR-038, D249).
 *
 * Poradie je záväzné:
 *   1. organizácia z domény má MCP zapnuté a dovolené, inak 404;
 *   2. klient a návratová adresa — kým nesedia, **nikam sa nepresmeruje**:
 *      chyba ide ako text, inak by sa cez nás dal poslať človek na cudziu
 *      adresu;
 *   3. ostatné chyby žiadosti (PKCE, rozsah, `resource`) idú klientovi
 *      presmerovaním s `error`;
 *   4. prihlásenie: neprihlásený ide na `/sign-in` s **celou** adresou
 *      žiadosti v `callbackUrl` (proxy by uložila len cestu); prihlásený
 *      mimo organizácie dostane `access_denied`;
 *   5. žiadosť sa uloží a človek ide na obrazovku súhlasu.
 */

import { NextResponse, type NextRequest } from "next/server"
import { tenantForMcp } from "@/lib/mcpServer/auth"
import { originOf } from "@/lib/mcpServer/origin"
import { onboardingContext } from "@/lib/session"
import { clientById, createAuthRequest, parseScopes, redirectWith, resourceMatches, OAuthError } from "@/lib/oauthServer"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const found = await tenantForMcp()
  if (!found?.state.active) return new Response(null, { status: 404 })
  const companyCode = found.tenant.companyCode
  const origin = originOf(req)
  const q = req.nextUrl.searchParams

  const client = await clientById(companyCode, q.get("client_id") ?? "")
  if (!client) return new Response("invalid_client: neznámy klient", { status: 400 })
  const redirectUri = q.get("redirect_uri") ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : "")
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return new Response("invalid_request: návratová adresa nie je registrovaná", { status: 400 })
  }
  const state = q.get("state") ?? undefined
  const fail = (error: string, description: string) =>
    NextResponse.redirect(redirectWith(redirectUri, { error, error_description: description, state }), 302)

  if (q.get("response_type") !== "code") return fail("unsupported_response_type", "Podporované je len response_type=code.")
  const codeChallenge = q.get("code_challenge") ?? ""
  if (!codeChallenge || (q.get("code_challenge_method") ?? "S256") !== "S256") return fail("invalid_request", "PKCE S256 je povinné.")
  const resource = q.get("resource") ?? undefined
  if (!resourceMatches(resource, origin)) return fail("invalid_target", "Token pre iný server sa nevydá.")
  let scopes
  try { scopes = parseScopes(q.get("scope")) } catch (e) {
    return fail(e instanceof OAuthError ? e.oauthCode : "invalid_scope", e instanceof Error ? e.message : "Neznámy rozsah.")
  }

  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") return new Response(null, { status: 404 })
  if (ctx.state === "not-signed-in") {
    const back = `${req.nextUrl.pathname}${req.nextUrl.search}`
    return NextResponse.redirect(new URL(`/sign-in?callbackUrl=${encodeURIComponent(back)}`, origin), 302)
  }
  if (ctx.state !== "ready") return fail("access_denied", "Prihlásená osoba nepatrí do tejto organizácie.")

  const request = await createAuthRequest({
    companyCode, clientId: client.clientId, clientName: client.clientName, redirectUri, scopes, state, codeChallenge, resource,
  })
  return NextResponse.redirect(new URL(`/oauth/consent?req=${encodeURIComponent(request.id)}`, origin), 302)
}
