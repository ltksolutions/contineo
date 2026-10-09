/**
 * client.ts — tenký obal nad MCP klientom zo SDK (ADR-029, D172, D177).
 *
 * Čo je tu: pripojenie k serveru cez Streamable HTTP s OAuth poskytovateľom,
 * ktorý tokeny číta a ukladá do konektora (šifrované), prihlásenie v dvoch
 * krokoch (presmerovanie → návrat s kódom), zoznam nástrojov, volanie
 * nástroja s časovým limitom a **stopa každého volania** (D177).
 *
 * Čo tu nie je: OAuth sám. PKCE, dynamickú registráciu klienta a obnovu
 * tokenu rieši SDK (`auth()`); my mu dávame len úložisko. Čo SDK vie, sa
 * neprepisuje.
 */

import { randomBytes } from "node:crypto"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { auth, UnauthorizedError, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js"
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js"
import {
  ConnectorError, connectorById, connectorByPendingState, markConnectorError, readClientInfo, readPending, readTokens,
  saveDiscovery, saveClientInfo, savePending, saveTokens, assertConnectorAllowed, searchSetup,
  type Connector, type ConnectorServerInfo,
} from "../connectors"
import { profileFor } from "./profiles"
import { iconCandidates, iconDataUrl, optionsFor, parseFieldOptions, resourcePrefixes, scopeFields, type ToolInfo } from "./generic"
import { getCollection } from "../mongodb"
import type { McpToolCaller } from "./profiles/types"

/** Koľko najviac čaká odpoveď z knižnice na server (D174). */
export const CALL_TIMEOUT_MS = 5_000

export const CONNECTOR_CALLS_COLLECTION = "connector_calls"

export interface ConnectorCallRecord {
  companyCode: string
  connectorId: string
  connectorName: string
  tool: string
  /** Kto volanie vyvolal — kópia (D158), alebo `null` pri systémovom behu. */
  actor: { personId: string | null; personName: string | null } | null
  channelKey: string | null
  at: Date
  ms: number
  outcome: "ok" | "timeout" | "unauthorized" | "error"
  error?: string
}

/** Stopa volania (D177). Bez znenia otázky — rovnako ako výkaz spotreby AI. */
export async function logConnectorCall(rec: Omit<ConnectorCallRecord, "at">): Promise<void> {
  try {
    const col = await getCollection<ConnectorCallRecord>(CONNECTOR_CALLS_COLLECTION)
    await col.insertOne({ ...rec, at: new Date() })
  } catch (e) {
    console.error("[connector] stopa volania sa nezapísala:", e)
  }
}

export interface CallContext {
  actor?: { personId: string | null; personName: string | null } | null
  channelKey?: string | null
}

// ── OAuth poskytovateľ nad konektorom ───────────────────────────────────────

/**
 * Rozsah oprávnení (Q12): ten, ktorý pozná profil (Sportnet `docs.read`),
 * inak žiadny — SDK potom vezme `scopes_supported` z metadát chráneného
 * zdroja, a keď server nič neohlási, rozsah sa neposiela vôbec.
 */
function oauthScope(c: Connector): string | undefined {
  return profileFor(c.profile).oauthScope
}

function clientMetadata(redirectUrl: string, scope: string | undefined): OAuthClientMetadata {
  return {
    client_name: "Contineo",
    redirect_uris: [redirectUrl],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    ...(scope ? { scope } : {}),
  }
}

/**
 * Úložisko pre SDK. Jedna inštancia na jedno pripojenie; `redirectTo` zachytí
 * adresu na prihlásenie namiesto presmerovania — sme na serveri, presmeruje
 * až akcia.
 */
function providerFor(c: Connector, redirectUrl: string, actor?: string): OAuthClientProvider & { authorizationUrl: URL | null } {
  const state = randomBytes(24).toString("base64url")
  // Nové tokeny po obnove má mať ďalšie volanie v tej istej inštancii bez čítania z DB.
  let fresh: OAuthTokens | undefined
  const provider: OAuthClientProvider & { authorizationUrl: URL | null } = {
    authorizationUrl: null,
    get redirectUrl() { return redirectUrl },
    get clientMetadata() { return clientMetadata(redirectUrl, oauthScope(c)) },
    state: () => state,
    clientInformation: () => (readClientInfo(c) ?? undefined) as OAuthClientInformationMixed | undefined,
    saveClientInformation: info => saveClientInfo(c.companyCode, c.id, info as unknown as Record<string, unknown>),
    tokens: () => fresh ?? ((readTokens(c) ?? undefined) as OAuthTokens | undefined),
    saveTokens: async tokens => {
      fresh = tokens
      await saveTokens(c.companyCode, c.id, tokens as unknown as Record<string, unknown>, actor)
    },
    redirectToAuthorization: url => { provider.authorizationUrl = url },
    saveCodeVerifier: verifier => savePending(c.companyCode, c.id, state, verifier),
    codeVerifier: () => {
      const p = readPending(c)
      if (!p) throw new ConnectorError("connector.noPending", "Prihlásenie nebolo začaté alebo už vypršalo — skúste znova.")
      return p.codeVerifier
    },
  }
  return provider
}

// ── Prihlásenie ─────────────────────────────────────────────────────────────

/**
 * Krok 1: adresa, kam poslať človeka. Stav prihlásenia sa uloží do konektora.
 * Keď tokeny ešte platia (prípadne sa obnovili), človek nikam nejde — vráti
 * sa `null` a nanovo sa načíta zoznam nástrojov; „Pripojiť znova" tak nikdy
 * nie je chyba, len kontrola.
 */
export async function startAuthorization(c: Connector, redirectUrl: string): Promise<URL | null> {
  await assertConnectorAllowed(c.companyCode, c.endpoint)
  const provider = providerFor(c, redirectUrl)
  let result: "AUTHORIZED" | "REDIRECT"
  try {
    result = await auth(provider, { serverUrl: c.endpoint, scope: oauthScope(c) })
  } catch (e) {
    throw new ConnectorError("connector.authStart", "Server nedovolil začať prihlásenie.", { detail: String((e as Error)?.message ?? e) })
  }
  if (result === "AUTHORIZED") {
    await discover(c, redirectUrl, c.auth.connectedBy ?? null)
    return null
  }
  if (!provider.authorizationUrl) throw new ConnectorError("connector.authStart", "Server nedal adresu na prihlásenie.")
  return provider.authorizationUrl
}

/** Ikona servera: prvý vhodný kandidát, stiahnutý a overený podľa obsahu (Q11). Zlyhanie = bez ikony. */
async function fetchIcon(icons: { src?: string; mimeType?: string }[] | undefined, endpoint: string): Promise<string | undefined> {
  for (const src of iconCandidates(icons, endpoint)) {
    if (src.startsWith("data:")) return src
    try {
      const res = await fetch(src, { signal: AbortSignal.timeout(3_000), redirect: "error" })
      if (!res.ok) continue
      const len = Number(res.headers.get("content-length") ?? 0)
      if (len > 32 * 1024) continue
      const data = iconDataUrl(new Uint8Array(await res.arrayBuffer()))
      if (data) return data
    } catch { /* ďalší kandidát */ }
  }
  return undefined
}

/**
 * Čo server ponúka (D178) — zapíše sa pri pripojení a pri „Načítať znova":
 * predstavenie (`serverInfo`, `instructions`), celé `tools/list`, zdroje
 * a hodnoty polí z nástroja s možnosťami. Zlyhanie sa len zaloguje —
 * pripojenie samo platí aj bez toho.
 */
async function discover(c: Connector, redirectUrl: string, actor: string | null): Promise<void> {
  // Záznam nanovo z databázy: po výmene kódu `c` tokeny ešte nenesie.
  const fresh = await connectorById(c.companyCode, c.id)
  if (!fresh) return
  const ctx = { actor: { personId: null, personName: actor } }
  try {
    const found = await withClient({ ...fresh, status: "connected" }, redirectUrl, async client => {
      const info = client.getServerVersion()
      const caps = client.getServerCapabilities()
      const tools: ToolInfo[] = []
      let cursor: string | undefined
      for (let page = 0; page < 5; page++) {
        const r = await client.listTools(cursor ? { cursor } : undefined)
        for (const t of r.tools) {
          tools.push({
            name: t.name,
            title: t.title ?? t.annotations?.title,
            description: t.description ?? "",
            inputSchema: t.inputSchema as ToolInfo["inputSchema"],
            ...(t.annotations ? { annotations: t.annotations } : {}),
          })
        }
        cursor = r.nextCursor
        if (!cursor) break
      }
      let prefixes: string[] | undefined
      if (caps?.resources) {
        try { prefixes = resourcePrefixes((await client.listResources()).resources.map(r => r.uri)) } catch { /* zdroje sú doplnok */ }
      }
      // Hodnoty polí rozsahu: len pre vstupy nástroja na hľadanie — nič iné
      // z odpovede (napr. profil osoby v preambule servera) sa neukladá.
      const profile = profileFor(fresh.profile)
      const optionsTool = fresh.uses.retrieval.optionsTool || profile.defaults?.optionsTool
      let fieldOptions: Record<string, string[]> | undefined
      if (optionsTool && tools.some(t => t.name === optionsTool)) {
        try {
          const parsed = parseFieldOptions(await client.callTool({ name: optionsTool, arguments: {} }))
          const setup = searchSetup({ ...fresh, capabilities: { tools, discoveredAt: new Date() } })
          const fields = scopeFields(tools.find(t => t.name === setup?.tool), setup?.queryArg)
          fieldOptions = Object.fromEntries(fields.flatMap(f => {
            const vals = optionsFor(parsed, f.key)
            return vals ? [[f.key, vals.slice(0, 2000)]] : []
          }))
        } catch { /* možnosti sú doplnok */ }
      }
      return {
        info: info ?? null,
        instructions: client.getInstructions(),
        capabilities: { tools, resources: Boolean(caps?.resources), resourcePrefixes: prefixes, fieldOptions },
      }
    }, ctx, "discover", 20_000)
    const i = found.info as (typeof found.info & { title?: string; websiteUrl?: string; icons?: { src?: string; mimeType?: string }[] }) | null
    const server: ConnectorServerInfo | null = i ? {
      name: i.name,
      ...(i.title ? { title: i.title } : {}),
      ...(i.version ? { version: i.version } : {}),
      ...(i.websiteUrl && /^https:\/\//.test(i.websiteUrl) ? { websiteUrl: i.websiteUrl } : {}),
      ...(found.instructions ? { instructions: found.instructions.slice(0, 20_000) } : {}),
    } : null
    if (server) {
      const icon = await fetchIcon(i?.icons, fresh.endpoint)
      if (icon) server.icon = icon
    }
    await saveDiscovery(c.companyCode, c.id, { server, capabilities: found.capabilities })
  } catch (e) {
    console.error("[connector] údaje o serveri sa nepodarilo načítať:", e)
  }
}

/**
 * Krok 2: návrat s kódom. `state` je jednorazový a náhodný — podľa neho sa
 * nájde konektor (a s ním organizácia), nie podľa čohokoľvek z adresy.
 */
export async function finishAuthorization(state: string, code: string, redirectUrl: string, actor: string): Promise<Connector> {
  const c = await connectorByPendingState(state)
  if (!c) throw new ConnectorError("connector.noPending", "Prihlásenie nebolo začaté alebo už vypršalo — skúste znova.")
  await assertConnectorAllowed(c.companyCode, c.endpoint)
  const provider = providerFor(c, redirectUrl, actor)
  try {
    const result = await auth(provider, { serverUrl: c.endpoint, authorizationCode: code, scope: oauthScope(c) })
    if (result !== "AUTHORIZED") throw new Error(result)
  } catch (e) {
    const msg = String((e as Error)?.message ?? e)
    await markConnectorError(c.companyCode, c.id, msg)
    throw new ConnectorError("connector.authFinish", "Výmena kódu za token zlyhala.", { detail: msg })
  }
  await discover(c, redirectUrl, actor)
  return (await connectorById(c.companyCode, c.id)) ?? c
}

// ── Volanie ─────────────────────────────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), ms)
  })
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer))
}
class TimeoutError extends Error { constructor() { super("timeout"); this.name = "TimeoutError" } }

/**
 * Pripojí sa, vykoná `fn`, odpojí. Nepripojený konektor nevolá server —
 * prihlásenie je ľudský krok, nie niečo, čo sa deje pri otázke.
 */
export async function withClient<T>(
  c: Connector, redirectUrl: string, fn: (client: Client) => Promise<T>, ctx: CallContext, tool: string, timeoutMs = CALL_TIMEOUT_MS,
): Promise<T> {
  if (c.status !== "connected" || !c.auth.tokensEnc && !readTokens(c)) {
    throw new ConnectorError("connector.notConnected", "Konektor nie je pripojený.")
  }
  // Rezidencia sa kontroluje pri každom volaní, nie len pri uložení — profil
  // organizácie sa mohol medzitým sprísniť (ADR-002 × ADR-029).
  await assertConnectorAllowed(c.companyCode, c.endpoint)
  const started = Date.now()
  const provider = providerFor(c, redirectUrl)
  const transport = new StreamableHTTPClientTransport(new URL(c.endpoint), { authProvider: provider })
  const client = new Client({ name: "contineo", version: "1" })
  const base = { companyCode: c.companyCode, connectorId: c.id, connectorName: c.name, tool, actor: ctx.actor ?? null, channelKey: ctx.channelKey ?? null }
  try {
    const result = await withTimeout((async () => {
      await client.connect(transport)
      return fn(client)
    })(), timeoutMs)
    void logConnectorCall({ ...base, ms: Date.now() - started, outcome: "ok" })
    return result
  } catch (e) {
    const ms = Date.now() - started
    if (e instanceof TimeoutError) {
      void logConnectorCall({ ...base, ms, outcome: "timeout" })
      throw new ConnectorError("connector.timeout", "Server neodpovedal včas.")
    }
    if (e instanceof UnauthorizedError) {
      // Obnova tokenu zlyhala — stav sa zapíše raz, nie pri každej otázke znova.
      void logConnectorCall({ ...base, ms, outcome: "unauthorized" })
      await markConnectorError(c.companyCode, c.id, "Prihlásenie vypršalo — pripojte konektor znova.", "disconnected")
      throw new ConnectorError("connector.unauthorized", "Prihlásenie ku konektoru vypršalo — pripojte ho znova.")
    }
    void logConnectorCall({ ...base, ms, outcome: "error", error: String((e as Error)?.message ?? e).slice(0, 300) })
    throw e
  } finally {
    await client.close().catch(() => {})
  }
}

/** Volanie jedného nástroja — tvar, ktorému rozumejú profily; `readResource` pre import bez profilu. */
export function toolCaller(client: Client): McpToolCaller & { readResource(uri: string): Promise<unknown> } {
  return {
    callTool: (name, args) => client.callTool({ name, arguments: args }),
    readResource: uri => client.readResource({ uri }),
  }
}
