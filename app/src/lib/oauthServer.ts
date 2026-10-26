/**
 * oauthServer.ts — Contineo ako autorizačný server pre vlastný MCP server
 * (ADR-038, D249).
 *
 * Človek sa prihlási existujúcou prihlasovacou stránkou, prejde bránou
 * `persons` (D45) a na obrazovke súhlasu povolí klientovi (Claude Code,
 * Cowork, Claude.ai…) vymenované rozsahy. Odtiaľ je to OAuth 2.1 podľa
 * špecifikácie MCP (revízia 2026-07-28): PKCE S256 povinné, `resource`
 * (RFC 8707) viazaný na adresu servera, dynamická registrácia klienta
 * (RFC 7591) aj Client ID Metadata Document (D256).
 *
 * **Čo sa ukladá:**
 *   · `oauth_clients`  — registrovaní klienti (jeden záznam na organizáciu,
 *     v ktorej sa klient registroval; `companyCode` je v podmienke, D32),
 *   · `oauth_requests` — rozpracovaná žiadosť o povolenie, kým človek
 *     nerozhodne (10 minút),
 *   · `oauth_codes`    — jednorazové kódy (hash, 5 minút),
 *   · `oauth_tokens`   — prístupové a obnovovacie tokeny — **len hash**,
 *     token sám nikdy (ako heslo),
 *   · `oauth_grants`   — súhlasy: kto, kedy, ktorému klientovi, aké
 *     rozsahy a **doslovné znenie súhlasu v jazyku, v ktorom ho videl**
 *     (D24, D28). Odvolanie je `revokedAt`, nie `deleteOne`.
 *
 * Token nesie (organizácia, osoba, klient, rozsahy). Rozsah nerozširuje
 * role: čo osoba nesmie, jej klient nedostane, aj keby rozsah mal.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { getCollection } from "./mongodb"
import { AppError } from "./appError"
import type { UiLanguage } from "./i18n"

// ── Rozsahy ──────────────────────────────────────────────────────────────────

/**
 * Rozsahy fázy 1 (D250): čítanie knižnice a otázka asistentovi. Ďalšie
 * (`library.write`, `compliance.*`, `helpdesk`…) pribudnú s fázami 2 a 3 —
 * tu, nie v klientoch: čo tu nie je, obrazovka súhlasu neponúkne a token
 * nedostane.
 */
export const OAUTH_SCOPES = ["library.read", "ask"] as const
export type OAuthScope = (typeof OAUTH_SCOPES)[number]

export function isScope(x: unknown): x is OAuthScope {
  return typeof x === "string" && (OAUTH_SCOPES as readonly string[]).includes(x)
}

/**
 * Rozsahy zo žiadosti. Chýbajúci parameter znamená všetky (OAuth 2.1 dovoľuje
 * serveru predvoliť), neznámy rozsah je chyba — klient, ktorý si pýta
 * `library.write`, má dostať `invalid_scope`, nie ticho menej.
 */
export function parseScopes(raw: string | null | undefined): OAuthScope[] {
  const parts = String(raw ?? "").split(/\s+/).map(s => s.trim()).filter(Boolean)
  if (!parts.length) return [...OAUTH_SCOPES]
  const unknown = parts.filter(p => !isScope(p))
  if (unknown.length) throw new OAuthError("invalid_scope", `Neznámy rozsah: ${unknown.join(", ")}`)
  return [...new Set(parts)] as OAuthScope[]
}

// ── Chyby ────────────────────────────────────────────────────────────────────

/** Chyba podľa OAuth: kód ide klientovi, veta do logu. */
export class OAuthError extends AppError {
  readonly status: number
  constructor(code: string, message: string, status = 400) {
    super(`oauth.${code}`, message)
    this.status = status
  }
  get oauthCode(): string { return this.code.slice("oauth.".length) }
}

// ── Pomocné čisté funkcie (testované) ────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** Odtlačok tokenu alebo kódu — do databázy ide ten, nie hodnota. */
export function hashSecret(value: string): string {
  return base64url(createHash("sha256").update(value, "utf8").digest())
}

/** Token s predponou podľa druhu, aby sa v logoch dal rozoznať od čohokoľvek iného. */
export function newSecret(kind: "a" | "r" | "c" | "s" | "q"): string {
  return `cnt_${kind}_${base64url(randomBytes(32))}`
}

/**
 * PKCE S256 (RFC 7636). Overovač má 43–128 znakov z bezpečnej abecedy;
 * porovnanie v konštantnom čase, aby sa výsledok nedal odmerať.
 */
export function verifyPkce(verifier: string | null | undefined, challenge: string): boolean {
  if (!verifier || verifier.length < 43 || verifier.length > 128) return false
  if (!/^[A-Za-z0-9\-._~]+$/.test(verifier)) return false
  const computed = Buffer.from(hashSecret(verifier))
  const expected = Buffer.from(challenge)
  return computed.length === expected.length && timingSafeEqual(computed, expected)
}

/** Návrat na vlastný počítač — tu sa smie `http://` a port sa neporovnáva (RFC 8252). */
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"]

/**
 * Návratová adresa klienta: `https://` kamkoľvek, `http://` len na loopback
 * (Claude Code a inšpektor počúvajú na `localhost`). Bez fragmentu.
 */
export function isAllowedRedirectUri(uri: string): boolean {
  let u: URL
  try { u = new URL(uri) } catch { return false }
  if (u.hash) return false
  if (u.protocol === "https:") return true
  if (u.protocol === "http:") return LOOPBACK_HOSTS.includes(u.hostname.toLowerCase())
  return false
}

/**
 * Je žiadaná návratová adresa medzi registrovanými? Doslovne — okrem
 * návratu na vlastný počítač (loopback, `http://localhost…`), kde sa **port
 * neporovnáva** (RFC 8252 § 7.3): natívny klient počúva na porte, ktorý
 * dostane od systému až pri prihlásení. Claude Code registruje
 * `http://localhost/callback` a prihlasuje sa s `http://localhost:53624/callback`
 * (Ján 25. 10. 2026). Schéma, hostiteľ, cesta a parametre musia sedieť.
 */
export function redirectUriMatches(registered: readonly string[], requested: string): boolean {
  if (registered.includes(requested)) return true
  let want: URL
  try { want = new URL(requested) } catch { return false }
  if (want.protocol !== "http:" || !LOOPBACK_HOSTS.includes(want.hostname.toLowerCase())) return false
  return registered.some(r => {
    let u: URL
    try { u = new URL(r) } catch { return false }
    return u.protocol === "http:" && u.hostname.toLowerCase() === want.hostname.toLowerCase()
      && u.pathname === want.pathname && u.search === want.search
  })
}

/**
 * Client ID Metadata Document (D256): identifikátor klienta je HTTPS adresa
 * **s cestou**, na ktorej leží JSON s jeho metadátami. Samotný pôvod
 * (`https://claude.ai`) nestačí — dokument musí mať kam ležať.
 */
export function isClientIdMetadataUrl(clientId: string): boolean {
  let u: URL
  try { u = new URL(clientId) } catch { return false }
  return u.protocol === "https:" && u.pathname.length > 1 && !u.hash && !u.username && !u.password
}

export interface ClientMetadata {
  clientName: string
  redirectUris: string[]
  tokenEndpointAuthMethod: "none" | "client_secret_post" | "client_secret_basic"
  clientUri?: string
  logoUri?: string
  scope?: string
}

/**
 * Metadáta klienta z registrácie alebo z dokumentu. Prísne: zlá návratová
 * adresa je chyba celej registrácie, nie vynechaný riadok — klient by inak
 * nevedel, prečo ho prihlásenie nikam nevráti.
 */
export function validateClientMetadata(doc: unknown): ClientMetadata {
  const d = (doc ?? {}) as Record<string, unknown>
  const uris = Array.isArray(d.redirect_uris) ? d.redirect_uris.filter((u): u is string => typeof u === "string") : []
  if (!uris.length) throw new OAuthError("invalid_redirect_uri", "Klient nemá žiadnu návratovú adresu.")
  const bad = uris.filter(u => !isAllowedRedirectUri(u))
  if (bad.length) throw new OAuthError("invalid_redirect_uri", `Nepovolená návratová adresa: ${bad.join(", ")}`)
  const method = d.token_endpoint_auth_method === undefined ? "none" : d.token_endpoint_auth_method
  if (method !== "none" && method !== "client_secret_post" && method !== "client_secret_basic") {
    throw new OAuthError("invalid_client_metadata", `Nepodporovaný spôsob overenia klienta: ${String(method)}`)
  }
  const grants = Array.isArray(d.grant_types) ? d.grant_types : ["authorization_code"]
  if (!grants.includes("authorization_code")) {
    throw new OAuthError("invalid_client_metadata", "Klient musí podporovať authorization_code.")
  }
  const name = typeof d.client_name === "string" && d.client_name.trim() ? d.client_name.trim().slice(0, 120) : ""
  const httpsOrNone = (v: unknown) => typeof v === "string" && /^https:\/\//.test(v) ? v.slice(0, 500) : undefined
  return {
    clientName: name || clientNameFromUris(uris),
    redirectUris: [...new Set(uris)],
    tokenEndpointAuthMethod: method,
    clientUri: httpsOrNone(d.client_uri),
    logoUri: httpsOrNone(d.logo_uri),
    scope: typeof d.scope === "string" ? d.scope : undefined,
  }
}

/** Bez mena aspoň hostiteľ návratu — „localhost" povie viac než prázdno. */
function clientNameFromUris(uris: string[]): string {
  try { return new URL(uris[0]).hostname } catch { return "neznámy klient" }
}

/** Adresa chráneného zdroja (RFC 8707) — MCP server tejto organizácie. */
export function resourceFor(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/mcp`
}

/**
 * Porovnanie `resource` zo žiadosti s našou adresou: bez koncovej lomky,
 * hostiteľ bez ohľadu na veľkosť písmen. Token pre iný server (iná doména
 * = iná organizácia) sa nevydá ani neprijme.
 */
export function resourceMatches(given: string | null | undefined, origin: string): boolean {
  if (!given) return true
  const norm = (s: string) => {
    try { const u = new URL(s); return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}` } catch { return "" }
  }
  const a = norm(given)
  return a !== "" && a === norm(resourceFor(origin))
}

// ── Záznamy ─────────────────────────────────────────────────────────────────

export const OAUTH_CLIENTS_COLLECTION = "oauth_clients"
export const OAUTH_REQUESTS_COLLECTION = "oauth_requests"
export const OAUTH_CODES_COLLECTION = "oauth_codes"
export const OAUTH_TOKENS_COLLECTION = "oauth_tokens"
export const OAUTH_GRANTS_COLLECTION = "oauth_grants"

export interface OAuthClientRecord extends ClientMetadata {
  clientId: string
  companyCode: string
  /** Hash tajomstva pri `client_secret_*`; verejný klient (`none`) ho nemá. */
  clientSecretHash?: string
  /** `dynamic` = RFC 7591, `metadata-document` = Client ID Metadata Document (D256). */
  source: "dynamic" | "metadata-document"
  createdAt: Date
  /** Pri dokumente: kedy sa naposledy stiahol — po dni sa číta znova. */
  fetchedAt?: Date
}

export interface OAuthRequestRecord {
  id: string
  companyCode: string
  clientId: string
  clientName: string
  redirectUri: string
  scopes: OAuthScope[]
  state?: string
  codeChallenge: string
  resource?: string
  createdAt: Date
  expiresAt: Date
}

interface OAuthCodeRecord {
  codeHash: string
  companyCode: string
  clientId: string
  personId: string
  grantId: string
  redirectUri: string
  scopes: OAuthScope[]
  codeChallenge: string
  resource?: string
  createdAt: Date
  expiresAt: Date
  usedAt?: Date | null
}

export interface OAuthTokenRecord {
  tokenHash: string
  kind: "access" | "refresh"
  companyCode: string
  clientId: string
  personId: string
  grantId: string
  scopes: OAuthScope[]
  createdAt: Date
  expiresAt: Date
  revokedAt?: Date | null
  lastUsedAt?: Date | null
}

export interface OAuthGrantRecord {
  grantId: string
  companyCode: string
  personId: string
  /** Kópie (D158): o rok má byť čitateľné, kto a čomu povolil, aj keď osoba odíde. */
  personName: string
  personEmail: string
  clientId: string
  clientName: string
  scopes: OAuthScope[]
  /** Jazyk a doslovné znenie súhlasu, ako ho človek videl (D28). */
  language: UiLanguage
  consentText: string
  grantedAt: Date
  lastUsedAt?: Date | null
  revokedAt?: Date | null
  /** Kto odvolal — adresa; `self` keď sám. */
  revokedBy?: string | null
}

export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
const CODE_TTL_MS = 5 * 60 * 1000
const REQUEST_TTL_MS = 10 * 60 * 1000
const METADATA_DOCUMENT_TTL_MS = 24 * 60 * 60 * 1000

// ── Klienti ─────────────────────────────────────────────────────────────────

/** Dynamická registrácia (RFC 7591). Tajomstvo sa vracia raz, ukladá sa hash. */
export async function registerClient(companyCode: string, metadata: unknown): Promise<{ record: OAuthClientRecord; clientSecret?: string }> {
  const meta = validateClientMetadata(metadata)
  const col = await getCollection<OAuthClientRecord>(OAUTH_CLIENTS_COLLECTION)
  const clientSecret = meta.tokenEndpointAuthMethod === "none" ? undefined : newSecret("s")
  const record: OAuthClientRecord = {
    ...meta,
    clientId: `cnt_c_${base64url(randomBytes(16))}`,
    companyCode,
    ...(clientSecret ? { clientSecretHash: hashSecret(clientSecret) } : {}),
    source: "dynamic",
    createdAt: new Date(),
  }
  await col.insertOne(record)
  return { record, clientSecret }
}

/**
 * Klient podľa identifikátora. Dynamicky registrovaný sa hľadá v organizácii
 * hostiteľa; identifikátor v tvare HTTPS adresy je dokument (D256), ktorý sa
 * stiahne a uloží — do organizácie, ktorá sa ho pýta.
 */
export async function clientById(companyCode: string, clientId: string): Promise<OAuthClientRecord | null> {
  if (!clientId) return null
  const col = await getCollection<OAuthClientRecord>(OAUTH_CLIENTS_COLLECTION)
  const known = await col.findOne({ companyCode, clientId })
  if (known && (known.source !== "metadata-document" || fresh(known.fetchedAt))) return known
  if (!isClientIdMetadataUrl(clientId)) return known
  const fetched = await fetchClientMetadataDocument(clientId)
  if (!fetched) return known
  const record: OAuthClientRecord = {
    ...fetched, clientId, companyCode, source: "metadata-document",
    createdAt: known?.createdAt ?? new Date(), fetchedAt: new Date(),
  }
  await col.updateOne({ companyCode, clientId }, { $set: record }, { upsert: true })
  return record
}

function fresh(at: Date | undefined): boolean {
  return Boolean(at && Date.now() - new Date(at).getTime() < METADATA_DOCUMENT_TTL_MS)
}

/**
 * Stiahne Client ID Metadata Document. Krátky časový limit a strop veľkosti:
 * je to cudzia adresa, ktorú si zvolil klient. Dokument musí sám uviesť
 * `client_id` zhodný s adresou — inak by ktokoľvek mohol podstrčiť cudzie
 * meno klienta na obrazovku súhlasu.
 */
async function fetchClientMetadataDocument(clientId: string): Promise<ClientMetadata | null> {
  try {
    const res = await fetch(clientId, {
      headers: { accept: "application/json" }, redirect: "error",
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const text = await res.text()
    if (text.length > 32 * 1024) return null
    const doc = JSON.parse(text) as Record<string, unknown>
    if (doc.client_id !== clientId) return null
    const meta = validateClientMetadata(doc)
    // Dokument hovorí za verejného klienta: tajomstvo by nemal kde držať.
    if (meta.tokenEndpointAuthMethod !== "none") return null
    return meta
  } catch (e) {
    console.error("[oauth] dokument klienta sa nepodarilo prečítať:", clientId, e instanceof Error ? e.message : e)
    return null
  }
}

/** Overenie tajomstva klienta; verejný klient (`none`) prejde bez neho. */
export function clientSecretOk(client: OAuthClientRecord, secret: string | null | undefined): boolean {
  if (client.tokenEndpointAuthMethod === "none") return true
  if (!client.clientSecretHash || !secret) return false
  const a = Buffer.from(hashSecret(secret))
  const b = Buffer.from(client.clientSecretHash)
  return a.length === b.length && timingSafeEqual(a, b)
}

// ── Žiadosť o povolenie ─────────────────────────────────────────────────────

export async function createAuthRequest(input: Omit<OAuthRequestRecord, "id" | "createdAt" | "expiresAt">): Promise<OAuthRequestRecord> {
  const col = await getCollection<OAuthRequestRecord>(OAUTH_REQUESTS_COLLECTION)
  const now = new Date()
  const record: OAuthRequestRecord = {
    ...input, id: newSecret("q"), createdAt: now, expiresAt: new Date(now.getTime() + REQUEST_TTL_MS),
  }
  await col.insertOne(record)
  return record
}

export async function authRequestById(companyCode: string, id: string): Promise<OAuthRequestRecord | null> {
  if (!id) return null
  const col = await getCollection<OAuthRequestRecord>(OAUTH_REQUESTS_COLLECTION)
  const r = await col.findOne({ companyCode, id })
  if (!r || new Date(r.expiresAt).getTime() < Date.now()) return null
  return r
}

/** Adresa návratu s kódom alebo chybou — `state` sa vracia vždy, keď prišiel. */
export function redirectWith(redirectUri: string, params: Record<string, string | undefined>): string {
  const u = new URL(redirectUri)
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, v)
  return u.toString()
}

export interface ConsentPerson {
  id: string
  fullName: string
  email: string
  language: UiLanguage
}

/**
 * Človek povolil: vznikne súhlas (dôkazný záznam) a jednorazový kód. Žiadosť
 * sa zmaže — je to pracovný stav, nie dôkaz.
 */
export async function approveAuthRequest(req: OAuthRequestRecord, person: ConsentPerson, consentText: string): Promise<string> {
  const grants = await getCollection<OAuthGrantRecord>(OAUTH_GRANTS_COLLECTION)
  const codes = await getCollection<OAuthCodeRecord>(OAUTH_CODES_COLLECTION)
  const requests = await getCollection<OAuthRequestRecord>(OAUTH_REQUESTS_COLLECTION)
  const now = new Date()
  const grantId = newSecret("q").replace("cnt_q_", "grant_")
  await grants.insertOne({
    grantId, companyCode: req.companyCode, personId: person.id, personName: person.fullName, personEmail: person.email,
    clientId: req.clientId, clientName: req.clientName, scopes: req.scopes,
    language: person.language, consentText, grantedAt: now, lastUsedAt: null, revokedAt: null, revokedBy: null,
  })
  const code = newSecret("c")
  await codes.insertOne({
    codeHash: hashSecret(code), companyCode: req.companyCode, clientId: req.clientId, personId: person.id, grantId,
    redirectUri: req.redirectUri, scopes: req.scopes, codeChallenge: req.codeChallenge, resource: req.resource,
    createdAt: now, expiresAt: new Date(now.getTime() + CODE_TTL_MS), usedAt: null,
  })
  await requests.deleteOne({ companyCode: req.companyCode, id: req.id })
  return redirectWith(req.redirectUri, { code, state: req.state })
}

export async function denyAuthRequest(req: OAuthRequestRecord): Promise<string> {
  const requests = await getCollection<OAuthRequestRecord>(OAUTH_REQUESTS_COLLECTION)
  await requests.deleteOne({ companyCode: req.companyCode, id: req.id })
  return redirectWith(req.redirectUri, { error: "access_denied", state: req.state })
}

// ── Tokeny ──────────────────────────────────────────────────────────────────

export interface IssuedTokens {
  access_token: string
  token_type: "Bearer"
  expires_in: number
  refresh_token: string
  scope: string
}

async function issueTokens(base: Pick<OAuthTokenRecord, "companyCode" | "clientId" | "personId" | "grantId" | "scopes">): Promise<IssuedTokens> {
  const col = await getCollection<OAuthTokenRecord>(OAUTH_TOKENS_COLLECTION)
  const now = new Date()
  const access = newSecret("a")
  const refresh = newSecret("r")
  await col.insertMany([
    { ...base, tokenHash: hashSecret(access), kind: "access", createdAt: now, expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS), revokedAt: null, lastUsedAt: null },
    { ...base, tokenHash: hashSecret(refresh), kind: "refresh", createdAt: now, expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS), revokedAt: null, lastUsedAt: null },
  ])
  return { access_token: access, token_type: "Bearer", expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000), refresh_token: refresh, scope: base.scopes.join(" ") }
}

/**
 * Výmena kódu za tokeny. Kód je jednorazový: druhé použitie **odvolá aj
 * tokeny z prvého** — podľa OAuth 2.1 je to znak, že kód niekto ukradol.
 */
export async function exchangeCode(input: {
  companyCode: string; client: OAuthClientRecord; code: string; codeVerifier: string | null
  redirectUri: string | null; resource: string | null; origin: string
}): Promise<IssuedTokens> {
  const codes = await getCollection<OAuthCodeRecord>(OAUTH_CODES_COLLECTION)
  const rec = await codes.findOne({ companyCode: input.companyCode, codeHash: hashSecret(input.code) })
  if (!rec || rec.clientId !== input.client.clientId) throw new OAuthError("invalid_grant", "Neznámy kód.")
  if (rec.usedAt) {
    await revokeGrantTokens(rec.companyCode, rec.grantId)
    throw new OAuthError("invalid_grant", "Kód už bol použitý.")
  }
  if (new Date(rec.expiresAt).getTime() < Date.now()) throw new OAuthError("invalid_grant", "Kód vypršal.")
  if (input.redirectUri && input.redirectUri !== rec.redirectUri) throw new OAuthError("invalid_grant", "Návratová adresa nesedí.")
  if (!verifyPkce(input.codeVerifier, rec.codeChallenge)) throw new OAuthError("invalid_grant", "PKCE overenie zlyhalo.")
  if (!resourceMatches(input.resource, input.origin)) throw new OAuthError("invalid_target", "Token pre iný server sa nevydá.")
  await codes.updateOne({ codeHash: rec.codeHash }, { $set: { usedAt: new Date() } })
  return issueTokens({ companyCode: rec.companyCode, clientId: rec.clientId, personId: rec.personId, grantId: rec.grantId, scopes: rec.scopes })
}

/**
 * Obnova: starý obnovovací token sa odvolá a vydá sa nový pár (otáčanie).
 * Rozsahy sa dajú len zúžiť, nikdy rozšíriť.
 */
export async function refreshTokens(input: {
  companyCode: string; client: OAuthClientRecord; refreshToken: string; scope: string | null; resource: string | null; origin: string
}): Promise<IssuedTokens> {
  const col = await getCollection<OAuthTokenRecord>(OAUTH_TOKENS_COLLECTION)
  const rec = await col.findOne({ companyCode: input.companyCode, tokenHash: hashSecret(input.refreshToken), kind: "refresh" })
  if (!rec || rec.clientId !== input.client.clientId) throw new OAuthError("invalid_grant", "Neznámy obnovovací token.")
  if (rec.revokedAt || new Date(rec.expiresAt).getTime() < Date.now()) throw new OAuthError("invalid_grant", "Obnovovací token neplatí.")
  if (!(await grantActive(rec.companyCode, rec.grantId))) throw new OAuthError("invalid_grant", "Súhlas bol odvolaný.")
  if (!resourceMatches(input.resource, input.origin)) throw new OAuthError("invalid_target", "Token pre iný server sa nevydá.")
  let scopes = rec.scopes
  if (input.scope) {
    const wanted = parseScopes(input.scope)
    if (wanted.some(s => !rec.scopes.includes(s))) throw new OAuthError("invalid_scope", "Rozsah sa obnovou nedá rozšíriť.")
    scopes = wanted
  }
  await col.updateOne({ tokenHash: rec.tokenHash }, { $set: { revokedAt: new Date() } })
  return issueTokens({ companyCode: rec.companyCode, clientId: rec.clientId, personId: rec.personId, grantId: rec.grantId, scopes })
}

/** Odvolanie (RFC 7009): neznámy token je úspech — klient sa o ňom nemá dozvedieť nič. */
export async function revokeToken(companyCode: string, client: OAuthClientRecord, token: string): Promise<void> {
  const col = await getCollection<OAuthTokenRecord>(OAUTH_TOKENS_COLLECTION)
  const rec = await col.findOne({ companyCode, tokenHash: hashSecret(token) })
  if (!rec || rec.clientId !== client.clientId) return
  // Obnovovací token je celé pripojenie; prístupový len hodina.
  if (rec.kind === "refresh") await revokeGrantTokens(companyCode, rec.grantId)
  else await col.updateOne({ tokenHash: rec.tokenHash }, { $set: { revokedAt: new Date() } })
}

async function revokeGrantTokens(companyCode: string, grantId: string): Promise<void> {
  const col = await getCollection<OAuthTokenRecord>(OAUTH_TOKENS_COLLECTION)
  await col.updateMany({ companyCode, grantId, revokedAt: null }, { $set: { revokedAt: new Date() } })
}

async function grantActive(companyCode: string, grantId: string): Promise<boolean> {
  const grants = await getCollection<OAuthGrantRecord>(OAUTH_GRANTS_COLLECTION)
  const g = await grants.findOne({ companyCode, grantId }, { projection: { revokedAt: 1 } })
  return Boolean(g && !g.revokedAt)
}

export interface AccessTokenInfo {
  clientId: string
  personId: string
  grantId: string
  scopes: OAuthScope[]
  expiresAt: Date
}

/**
 * Overenie prístupového tokenu pre `/mcp`. Organizácia je z hostiteľa a je
 * v podmienke (D32): token vydaný na inej doméne tu neexistuje. Posledné
 * použitie sa zapisuje na súhlas, aby plachta účtu vedela povedať „naposledy
 * dnes" — bez znenia čohokoľvek.
 */
export async function verifyAccessToken(companyCode: string, token: string): Promise<AccessTokenInfo | null> {
  if (!token.startsWith("cnt_a_")) return null
  const col = await getCollection<OAuthTokenRecord>(OAUTH_TOKENS_COLLECTION)
  const rec = await col.findOne({ companyCode, tokenHash: hashSecret(token), kind: "access" })
  if (!rec || rec.revokedAt || new Date(rec.expiresAt).getTime() < Date.now()) return null
  if (!(await grantActive(companyCode, rec.grantId))) return null
  const now = new Date()
  const grants = await getCollection<OAuthGrantRecord>(OAUTH_GRANTS_COLLECTION)
  void Promise.all([
    col.updateOne({ tokenHash: rec.tokenHash }, { $set: { lastUsedAt: now } }),
    grants.updateOne({ companyCode, grantId: rec.grantId }, { $set: { lastUsedAt: now } }),
  ]).catch(e => console.error("[oauth] posledné použitie sa nezapísalo:", e))
  return { clientId: rec.clientId, personId: rec.personId, grantId: rec.grantId, scopes: rec.scopes, expiresAt: rec.expiresAt }
}

// ── Súhlasy (plachta účtu, správca organizácie) ─────────────────────────────

export async function grantsForPerson(companyCode: string, personId: string): Promise<OAuthGrantRecord[]> {
  const grants = await getCollection<OAuthGrantRecord>(OAUTH_GRANTS_COLLECTION)
  return grants.find({ companyCode, personId }).sort({ grantedAt: -1 }).toArray()
}

export async function grantsForCompany(companyCode: string): Promise<OAuthGrantRecord[]> {
  const grants = await getCollection<OAuthGrantRecord>(OAUTH_GRANTS_COLLECTION)
  return grants.find({ companyCode }).sort({ grantedAt: -1 }).limit(500).toArray()
}

/**
 * Odvolanie súhlasu: `revokedAt` na súhlase a na všetkých jeho tokenoch
 * (D24 — záznam ostáva). `personId` zužuje na vlastné súhlasy; správca osôb
 * ho nedáva a smie odvolať komukoľvek v organizácii (D252).
 */
export async function revokeGrant(companyCode: string, grantId: string, by: string, personId?: string): Promise<boolean> {
  const grants = await getCollection<OAuthGrantRecord>(OAUTH_GRANTS_COLLECTION)
  const filter = { companyCode, grantId, revokedAt: null, ...(personId ? { personId } : {}) }
  const r = await grants.updateOne(filter, { $set: { revokedAt: new Date(), revokedBy: by } })
  if (!r.matchedCount) return false
  await revokeGrantTokens(companyCode, grantId)
  return true
}
