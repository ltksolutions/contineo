/**
 * connectors.ts — MCP konektory organizácie (ADR-029, D171, D172).
 *
 * Konektor je **pripojenie organizácie k cudziemu MCP serveru** s viacerými
 * použitiami, ktoré správca zapína nezávisle: živý zdroj pri odpovedi (A),
 * import do knižnice (B), nástroje asistenta (C). Nie je to podtyp zdroja
 * do CMS — to bol zápis z júna 2026, ktorý prvý skutočný server prekonal.
 *
 * Tajomstvá (`*Enc`) sa ukladajú cez `secrets.ts` ako kľúč AI a tajomstvo
 * schránky; na obrazovku ide `connectorView()` bez nich. Bez šifrovacieho
 * kľúča sa konektor založiť nedá — token v čitateľnej podobe by bol prístup
 * do cudzieho systému pod identitou organizácie (D172).
 *
 * Identita volania má tri režimy (`auth.mode`); fáza 1 vie `tenant` — jeden
 * zdieľaný token, dnes osobný účet toho, kto konektor pripojil
 * (`connectedBy`). Je to zapísaná odchýlka od servisného účtu, viď ADR-029.
 */

import { randomUUID } from "node:crypto"
import { getCollection } from "./mongodb"
import { requireCompanyCode } from "./tenantScope"
import { AppError } from "./appError"
import { encrypt, decrypt, encryptionAvailable } from "./secrets"
import { writeAudit } from "./audit"
import { PROFILES, isProfileKey, type ProfileKey } from "./mcp/profiles"

export const CONNECTORS_COLLECTION = "connectors"

export class ConnectorError extends AppError {}

export type ConnectorAuthMode = "tenant" | "person" | "none"
export type ConnectorStatus = "new" | "connected" | "disconnected" | "error"
export type ConnectorAccessLevel = "public" | "internal"

/** Pomenovaný výsek servera (D175) — filter posiela server, nie my. */
export interface ConnectorScope {
  key: string
  label: string
  /** Filter v tvare, ktorému rozumie profil servera (napr. `{ project: "issf" }`). */
  filter: Record<string, string>
}

/**
 * Politika redukcie (D176) — zúženie pre interných, nie brána pre
 * verejnosť. Všetko deterministické; prázdna politika nič nereže.
 */
export interface ReductionPolicy {
  /** Zahodiť sekcie, ktorých nadpis (bez `#`) sa rovná niektorému z týchto. */
  dropSections: string[]
  /** Regulárne výrazy; zhody sa nahradia `[…]`. */
  scrubPatterns: string[]
  /** Cesty na serveri, ktoré sa vynechajú (regulárny výraz nad `externalId`). */
  skipPaths: string[]
}

export interface ConnectorAuth {
  mode: ConnectorAuthMode
  /** Dynamicky registrovaný klient (RFC 7591) — `issuer` drží, u koho. */
  clientInfoEnc?: string
  /** Tokeny ako ich vracia server (`access_token`, `refresh_token`, `expires_in`, `issuer`). */
  tokensEnc?: string
  /** Kedy vyprší prístupový token — na rozhodnutie o obnove bez dešifrovania. */
  accessExpiresAt?: Date | null
  /** Rozpracované prihlásenie: PKCE verifier a `state`, kým sa človek nevráti. */
  pendingEnc?: string
  pendingState?: string
  connectedBy?: string
  connectedAt?: Date
}

export interface ConnectorUses {
  retrieval: { enabled: boolean; accessLevel: ConnectorAccessLevel; reduction: ReductionPolicy }
  ingest: { enabled: boolean }
  agentTools: { allowed: string[] }
}

export interface ConnectorCapabilities {
  tools: { name: string; description: string }[]
  discoveredAt: Date
}

export interface Connector {
  companyCode: string
  id: string
  name: string
  endpoint: string
  profile: ProfileKey
  auth: ConnectorAuth
  scopes: ConnectorScope[]
  uses: ConnectorUses
  capabilities: ConnectorCapabilities | null
  status: ConnectorStatus
  lastError: string | null
  createdAt: Date
  createdBy: string
  updatedAt: Date
}

/** Čo smie vidieť obrazovka — bez tajomstiev. */
export type ConnectorView = Omit<Connector, "auth"> & {
  auth: { mode: ConnectorAuthMode; connectedBy?: string; connectedAt?: Date; hasTokens: boolean }
}

export function connectorView(c: Connector): ConnectorView {
  const { auth, ...rest } = c
  return { ...rest, auth: { mode: auth.mode, connectedBy: auth.connectedBy, connectedAt: auth.connectedAt, hasTokens: Boolean(auth.tokensEnc) } }
}

/** Identifikátor rozsahu v kanáli: `<connectorId>:<scopeKey>` (D175). */
export function scopeRef(connectorId: string, scopeKey: string): string {
  return `${connectorId}:${scopeKey}`
}
export function parseScopeRef(ref: string): { connectorId: string; scopeKey: string } | null {
  const i = ref.indexOf(":")
  if (i <= 0 || i === ref.length - 1) return null
  return { connectorId: ref.slice(0, i), scopeKey: ref.slice(i + 1) }
}

export const EMPTY_REDUCTION: ReductionPolicy = { dropSections: [], scrubPatterns: [], skipPaths: [] }

export async function listConnectors(companyCode: string): Promise<Connector[]> {
  const code = requireCompanyCode(companyCode, "listConnectors")
  const col = await getCollection<Connector>(CONNECTORS_COLLECTION)
  return col.find({ companyCode: code }).sort({ name: 1 }).toArray()
}

export async function connectorById(companyCode: string, id: string): Promise<Connector | null> {
  const code = requireCompanyCode(companyCode, "connectorById")
  const col = await getCollection<Connector>(CONNECTORS_COLLECTION)
  return col.findOne({ companyCode: code, id })
}

export interface ConnectorInput {
  id?: string
  name: string
  endpoint: string
  profile: string
  retrievalEnabled: boolean
  retrievalAccessLevel: string
  reduction?: Partial<ReductionPolicy>
  /** Rozsahy ako riadky `key | label | filter=value, filter=value`. */
  scopes?: ConnectorScope[]
}

function tidyLines(xs: string[] | undefined): string[] {
  return (xs ?? []).map(x => x.trim()).filter(Boolean)
}

/** Regulárny výraz, ktorý sa nedá skompilovať, sa neuloží — zlyhal by až pri otázke. */
function validRegex(src: string): boolean {
  try { new RegExp(src); return true } catch { return false }
}

export async function saveConnector(companyCode: string, input: ConnectorInput, actor: string): Promise<Connector> {
  const code = requireCompanyCode(companyCode, "saveConnector")
  if (!encryptionAvailable()) throw new ConnectorError("tenant.noEncryptionKey", "Šifrovací kľúč nie je nastavený — konektor sa nedá uložiť.")
  const name = input.name.replace(/\s+/g, " ").trim()
  if (!name) throw new ConnectorError("connector.nameRequired", "Názov konektora je povinný.")
  let endpoint: string
  try {
    const u = new URL(input.endpoint.trim())
    if (u.protocol !== "https:") throw new Error("https")
    endpoint = u.toString()
  } catch {
    throw new ConnectorError("connector.endpoint", "Adresa servera musí byť úplná a začínať https://.")
  }
  if (!isProfileKey(input.profile)) throw new ConnectorError("connector.profile", "Neznámy profil servera.", { profile: input.profile })
  const accessLevel: ConnectorAccessLevel = input.retrievalAccessLevel === "public" ? "public" : "internal"
  const scrub = tidyLines(input.reduction?.scrubPatterns)
  const bad = scrub.find(p => !validRegex(p)) ?? tidyLines(input.reduction?.skipPaths).find(p => !validRegex(p))
  if (bad) throw new ConnectorError("connector.badPattern", "Vzor sa nedá použiť ako regulárny výraz.", { pattern: bad })
  const reduction: ReductionPolicy = {
    dropSections: tidyLines(input.reduction?.dropSections),
    scrubPatterns: scrub,
    skipPaths: tidyLines(input.reduction?.skipPaths),
  }
  // Rozsahy: kľúč je identita (odkazujú sa naň kanály), nesmie sa opakovať.
  const scopes = (input.scopes ?? []).map(s => ({ key: s.key.trim(), label: s.label.trim() || s.key.trim(), filter: s.filter }))
    .filter(s => s.key && Object.keys(s.filter).length)
  if (new Set(scopes.map(s => s.key)).size !== scopes.length) throw new ConnectorError("connector.scopeDuplicate", "Dva rozsahy majú rovnaký kľúč.")

  const col = await getCollection<Connector>(CONNECTORS_COLLECTION)
  const now = new Date()
  const existing = input.id ? await col.findOne({ companyCode: code, id: input.id }) : null
  if (input.id && !existing) throw new ConnectorError("connector.notFound", "Taký konektor tu nie je.")

  // Iný server = iné prihlásenie. Tokeny patria serveru, nie záznamu.
  const endpointChanged = existing ? existing.endpoint !== endpoint : false
  const auth: ConnectorAuth = existing && !endpointChanged ? existing.auth : { mode: "tenant" }

  const connector: Connector = {
    companyCode: code,
    id: existing?.id ?? randomUUID(),
    name, endpoint,
    profile: input.profile,
    auth,
    scopes,
    uses: {
      retrieval: { enabled: Boolean(input.retrievalEnabled), accessLevel, reduction },
      ingest: existing?.uses.ingest ?? { enabled: false },
      agentTools: existing?.uses.agentTools ?? { allowed: [] },
    },
    capabilities: endpointChanged ? null : existing?.capabilities ?? null,
    status: existing && !endpointChanged ? existing.status : "new",
    lastError: endpointChanged ? null : existing?.lastError ?? null,
    createdAt: existing?.createdAt ?? now,
    createdBy: existing?.createdBy ?? actor,
    updatedAt: now,
  }
  await col.replaceOne({ companyCode: code, id: connector.id }, connector, { upsert: true })
  await writeAudit({
    companyCode: code, subject: "connector", action: existing ? "changed" : "created", actor,
    targetId: connector.id, targetLabel: name,
    changes: existing ? {
      ...(existing.name !== name ? { name: { from: existing.name, to: name } } : {}),
      ...(endpointChanged ? { endpoint: { from: existing.endpoint, to: endpoint } } : {}),
      ...(existing.uses.retrieval.enabled !== connector.uses.retrieval.enabled ? { retrieval: { from: existing.uses.retrieval.enabled, to: connector.uses.retrieval.enabled } } : {}),
      ...(existing.uses.retrieval.accessLevel !== accessLevel ? { accessLevel: { from: existing.uses.retrieval.accessLevel, to: accessLevel } } : {}),
    } : undefined,
  })
  return connector
}

export async function removeConnector(companyCode: string, id: string, actor: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "removeConnector")
  const col = await getCollection<Connector>(CONNECTORS_COLLECTION)
  const existing = await col.findOne({ companyCode: code, id })
  if (!existing) throw new ConnectorError("connector.notFound", "Taký konektor tu nie je.")
  await col.deleteOne({ companyCode: code, id })
  await writeAudit({ companyCode: code, subject: "connector", action: "deleted", actor, targetId: id, targetLabel: existing.name })
}

/** Odpojenie: tokeny preč, záznam a rozsahy ostávajú — kanály sa naň odkazujú. */
export async function disconnectConnector(companyCode: string, id: string, actor: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "disconnectConnector")
  const col = await getCollection<Connector>(CONNECTORS_COLLECTION)
  const existing = await col.findOne({ companyCode: code, id })
  if (!existing) throw new ConnectorError("connector.notFound", "Taký konektor tu nie je.")
  await col.updateOne({ companyCode: code, id }, {
    $unset: { "auth.tokensEnc": "", "auth.accessExpiresAt": "", "auth.pendingEnc": "", "auth.pendingState": "", "auth.connectedBy": "", "auth.connectedAt": "" },
    $set: { status: "disconnected", updatedAt: new Date() },
  })
  await writeAudit({ companyCode: code, subject: "connector", action: "disconnected", actor, targetId: id, targetLabel: existing.name })
}

// ── Úložisko pre OAuth klienta zo SDK ───────────────────────────────────────

/** Tokeny v tvare SDK; `null`, keď nie sú alebo sa nedajú rozšifrovať. */
export function readTokens(c: Connector): Record<string, unknown> | null {
  if (!c.auth.tokensEnc) return null
  try { return JSON.parse(decrypt(c.auth.tokensEnc)) } catch { return null }
}
export function readClientInfo(c: Connector): Record<string, unknown> | null {
  if (!c.auth.clientInfoEnc) return null
  try { return JSON.parse(decrypt(c.auth.clientInfoEnc)) } catch { return null }
}
export function readPending(c: Connector): { codeVerifier: string } | null {
  if (!c.auth.pendingEnc) return null
  try { return JSON.parse(decrypt(c.auth.pendingEnc)) } catch { return null }
}

export async function saveTokens(companyCode: string, id: string, tokens: Record<string, unknown>, actor?: string): Promise<void> {
  const col = await getCollection<Connector>(CONNECTORS_COLLECTION)
  const expiresIn = typeof tokens.expires_in === "number" ? tokens.expires_in : null
  const set: Record<string, unknown> = {
    "auth.tokensEnc": encrypt(JSON.stringify(tokens)),
    "auth.accessExpiresAt": expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    status: "connected", lastError: null, updatedAt: new Date(),
  }
  if (actor) { set["auth.connectedBy"] = actor; set["auth.connectedAt"] = new Date() }
  await col.updateOne({ companyCode, id }, { $set: set, $unset: { "auth.pendingEnc": "", "auth.pendingState": "" } })
}
export async function saveClientInfo(companyCode: string, id: string, info: Record<string, unknown>): Promise<void> {
  const col = await getCollection<Connector>(CONNECTORS_COLLECTION)
  await col.updateOne({ companyCode, id }, { $set: { "auth.clientInfoEnc": encrypt(JSON.stringify(info)), updatedAt: new Date() } })
}
export async function savePending(companyCode: string, id: string, state: string, codeVerifier: string): Promise<void> {
  const col = await getCollection<Connector>(CONNECTORS_COLLECTION)
  await col.updateOne({ companyCode, id }, { $set: { "auth.pendingEnc": encrypt(JSON.stringify({ codeVerifier })), "auth.pendingState": state, updatedAt: new Date() } })
}
export async function markConnectorError(companyCode: string, id: string, message: string, status: ConnectorStatus = "error"): Promise<void> {
  const col = await getCollection<Connector>(CONNECTORS_COLLECTION)
  await col.updateOne({ companyCode, id }, { $set: { status, lastError: message.slice(0, 500), updatedAt: new Date() } })
}
export async function saveCapabilities(companyCode: string, id: string, tools: { name: string; description: string }[]): Promise<void> {
  const col = await getCollection<Connector>(CONNECTORS_COLLECTION)
  await col.updateOne({ companyCode, id }, { $set: { capabilities: { tools, discoveredAt: new Date() }, updatedAt: new Date() } })
}

/** Konektor podľa `state` z návratu OAuth — `state` je náhodný a jednorazový. */
export async function connectorByPendingState(state: string): Promise<Connector | null> {
  if (!state) return null
  const col = await getCollection<Connector>(CONNECTORS_COLLECTION)
  return col.findOne({ "auth.pendingState": state })
}

/** Profily na výber v nastavení (kľúč → názov). */
export function profileOptions(): { value: ProfileKey; label: string }[] {
  return (Object.keys(PROFILES) as ProfileKey[]).map(k => ({ value: k, label: PROFILES[k].label }))
}
