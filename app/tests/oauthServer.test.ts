/**
 * oauthServer.test.ts — Contineo ako autorizačný server (ADR-038, D249).
 *
 * Čo sa nesmie pokaziť ticho: PKCE, návratové adresy (loopback áno, cudzie
 * `http://` nie), rozsahy (neznámy je chyba, nie ticho menej), väzba tokenu
 * na adresu servera (`resource`) a čítanie metadát klienta.
 */

import { createHash } from "node:crypto"
import { describe, it, expect } from "vitest"
import {
  OAUTH_SCOPES, OAuthError, hashSecret, isAllowedRedirectUri, isClientIdMetadataUrl, newSecret, parseScopes, redirectUriMatches,
  redirectWith, resourceFor, resourceMatches, validateClientMetadata, verifyPkce,
} from "../src/lib/oauthServer"

const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk-abcdefghij"
const challenge = createHash("sha256").update(verifier).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

describe("PKCE S256", () => {
  it("správny overovač prejde", () => expect(verifyPkce(verifier, challenge)).toBe(true))
  it("iný overovač neprejde", () => expect(verifyPkce(`${verifier}x`, challenge)).toBe(false))
  it("krátky alebo chýbajúci overovač neprejde", () => {
    expect(verifyPkce("kratky", challenge)).toBe(false)
    expect(verifyPkce(null, challenge)).toBe(false)
  })
})

describe("tokeny", () => {
  it("odtlačok je deterministický a nie je hodnota", () => {
    const token = newSecret("a")
    expect(token.startsWith("cnt_a_")).toBe(true)
    expect(hashSecret(token)).toBe(hashSecret(token))
    expect(hashSecret(token)).not.toContain(token.slice(6, 20))
  })
})

describe("návratové adresy", () => {
  it("https kamkoľvek, http len na loopback", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true)
    expect(isAllowedRedirectUri("http://localhost:6274/oauth/callback")).toBe(true)
    expect(isAllowedRedirectUri("http://127.0.0.1:8080/cb")).toBe(true)
    expect(isAllowedRedirectUri("http://example.com/cb")).toBe(false)
    expect(isAllowedRedirectUri("https://x.y/cb#frag")).toBe(false)
    expect(isAllowedRedirectUri("nie-adresa")).toBe(false)
  })
  it("state sa vracia len keď prišiel", () => {
    expect(redirectWith("http://localhost:1/cb", { code: "abc", state: "s1" })).toBe("http://localhost:1/cb?code=abc&state=s1")
    expect(redirectWith("http://localhost:1/cb?x=1", { error: "access_denied", state: undefined })).toBe("http://localhost:1/cb?x=1&error=access_denied")
  })
})

describe("rozsahy", () => {
  it("prázdne = všetky fázy 1", () => expect(parseScopes(undefined)).toEqual([...OAUTH_SCOPES]))
  it("známe sa vrátia bez duplikátov", () => expect(parseScopes("ask ask library.read")).toEqual(["ask", "library.read"]))
  it("neznámy je invalid_scope, nie ticho menej", () => {
    expect(() => parseScopes("library.read library.write")).toThrow(OAuthError)
    try { parseScopes("library.write") } catch (e) { expect((e as OAuthError).oauthCode).toBe("invalid_scope") }
  })
})

describe("resource (RFC 8707)", () => {
  it("adresa servera je /mcp na pôvode", () => expect(resourceFor("https://intranet.futbalsfz.sk/")).toBe("https://intranet.futbalsfz.sk/mcp"))
  it("sedí bez ohľadu na koncovú lomku a veľkosť hostiteľa", () => {
    expect(resourceMatches("https://Intranet.FutbalSFZ.sk/mcp/", "https://intranet.futbalsfz.sk")).toBe(true)
    expect(resourceMatches(undefined, "https://intranet.futbalsfz.sk")).toBe(true)
  })
  it("iná doména = iná organizácia, token sa nevydá", () => {
    expect(resourceMatches("https://test.contineo.app/mcp", "https://intranet.futbalsfz.sk")).toBe(false)
    expect(resourceMatches("https://intranet.futbalsfz.sk/api/chat", "https://intranet.futbalsfz.sk")).toBe(false)
  })
})

describe("metadáta klienta", () => {
  it("verejný klient s loopback návratom prejde", () => {
    const m = validateClientMetadata({ client_name: "Claude Code", redirect_uris: ["http://localhost:4000/cb"] })
    expect(m.clientName).toBe("Claude Code")
    expect(m.tokenEndpointAuthMethod).toBe("none")
  })
  it("bez návratovej adresy alebo s cudzou http sa klient neregistruje", () => {
    expect(() => validateClientMetadata({ client_name: "X" })).toThrow(OAuthError)
    expect(() => validateClientMetadata({ redirect_uris: ["http://evil.example/cb"] })).toThrow(OAuthError)
  })
  it("bez mena aspoň hostiteľ návratu", () => {
    expect(validateClientMetadata({ redirect_uris: ["https://claude.ai/cb"] }).clientName).toBe("claude.ai")
  })
  it("Client ID Metadata Document je https adresa s cestou (D256)", () => {
    expect(isClientIdMetadataUrl("https://claude.ai/.well-known/oauth-client")).toBe(true)
    expect(isClientIdMetadataUrl("https://claude.ai")).toBe(false)
    expect(isClientIdMetadataUrl("http://claude.ai/x")).toBe(false)
    expect(isClientIdMetadataUrl("cnt_c_abc")).toBe(false)
  })
})

describe("návratová adresa pri prihlásení (RFC 8252 § 7.3)", () => {
  // Presne to, čo registruje Claude Code (claude.ai/oauth/claude-code-client-metadata).
  const claudeCode = ["http://localhost/callback", "http://127.0.0.1/callback"]

  it("loopback s ľubovoľným portom prejde", () => {
    expect(redirectUriMatches(claudeCode, "http://localhost:53624/callback")).toBe(true)
    expect(redirectUriMatches(claudeCode, "http://127.0.0.1:61000/callback")).toBe(true)
  })
  it("iná cesta, iný hostiteľ alebo https na loopback neprejde", () => {
    expect(redirectUriMatches(claudeCode, "http://localhost:53624/evil")).toBe(false)
    expect(redirectUriMatches(claudeCode, "http://[::1]:53624/callback")).toBe(false)
    expect(redirectUriMatches(claudeCode, "https://localhost:53624/callback")).toBe(false)
    expect(redirectUriMatches(["http://localhost/callback"], "http://localhost:1/callback?x=1")).toBe(false)
  })
  it("verejná adresa sa porovnáva doslovne, vrátane portu", () => {
    const web = ["https://claude.ai/api/mcp/auth_callback"]
    expect(redirectUriMatches(web, "https://claude.ai/api/mcp/auth_callback")).toBe(true)
    expect(redirectUriMatches(web, "https://claude.ai:8443/api/mcp/auth_callback")).toBe(false)
    expect(redirectUriMatches(web, "http://claude.ai/api/mcp/auth_callback")).toBe(false)
  })
})
