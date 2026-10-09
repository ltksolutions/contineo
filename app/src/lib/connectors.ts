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
 * Od 9. 10. 2026 (D178, návrh ORG-konektory) sa konektor zakladá len z adresy:
 * prihlásenie, predstavenie servera a nástroje so schémou vstupov dáva
 * štandard MCP; profil je predvyplnenie pre známy server a nástroj na
 * hľadanie vyberá správca.
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
import { profileFor, detectProfile, type ProfileKey } from "./mcp/profiles"
import type { ToolInfo } from "./mcp/generic"
import { isScrubPreset, type ScrubPreset } from "./connectorReduction"
import { listChannels } from "./channels"
import { checkConnector } from "./residency"
import { getTenantProfile } from "./tenantProfile"

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
  /** Hotové vzory (e-mail, telefón, IBAN, rodné číslo) — regulárne výrazy sú v kóde. */
  scrubPresets?: ScrubPreset[]
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
  /** Vlastný klient (Client ID/Secret od správcu servera) — obrazovka vie „nastavený" bez dešifrovania. */
  customClient?: boolean
}

export interface ConnectorUses {
  retrieval: {
    enabled: boolean
    accessLevel: ConnectorAccessLevel
    reduction: ReductionPolicy
    /**
     * Volať aj bez toho, aby si človek konektor zapol pilulkou (Ján 8. 10. 2026:
     * predvolene sa hľadá len v knižnici). Kanálov sa netýka — tam rozsah
     * vyberá správca kanálu (D175).
     */
    defaultOn?: boolean
    /** Nástroj na hľadanie a jeho vstup pre otázku (D178). Prázdne = podľa profilu. */
    searchTool?: string
    searchQueryArg?: string
    /** Nástroj, ktorý vymenuje hodnoty polí rozsahu (Sportnet: `list-documentation-filters`). */
    optionsTool?: string
  }
  ingest: { enabled: boolean }
  agentTools: { allowed: string[] }
}

export interface ConnectorCapabilities {
  /** Celé `tools/list` — `inputSchema` a `annotations` sú od 9. 10. 2026, staršie záznamy ich nemajú. */
  tools: ToolInfo[]
  discoveredAt: Date
  /** Server ponúka `resources` (import bez profilu cez `resources/read`). */
  resources?: boolean
  /** Začiatky adries zdrojov — ponuka hodnôt pre rozsahy. */
  resourcePrefixes?: string[]
  /** Hodnoty polí rozsahu z nástroja s možnosťami (kľúč = vstup nástroja na hľadanie). */
  fieldOptions?: Record<string, string[]>
}

/** Ako sa server predstavil v `initialize` (`serverInfo`, `instructions`). */
export interface ConnectorServerInfo {
  name: string
  title?: string
  version?: string
  websiteUrl?: string
  /** `data:` obrázok — PNG/JPEG/WebP do 32 kB, stiahnutý pri pripojení; nikdy SVG (Q11). */
  icon?: string
  /** Pokyny servera — len sa zobrazujú, modelu sa neposielajú (D174, Q13). */
  instructions?: string
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
  server?: ConnectorServerInfo | null
  /** Názov sa pri pripojení prevezme zo servera — správca ho pri zakladaní nevyplnil. */
  autoName?: boolean
  status: ConnectorStatus
  lastError: string | null
  createdAt: Date
  createdBy: string
  updatedAt: Date
}

/** Čo smie vidieť obrazovka — bez tajomstiev. */
export type ConnectorView = Omit<Connector, "auth"> & {
  auth: { mode: ConnectorAuthMode; connectedBy?: string; connectedAt?: Date; hasTokens: boolean; customClient: boolean }
}

export function connectorView(c: Connector): ConnectorView {
  const { auth, ...rest } = c
  return { ...rest, auth: { mode: auth.mode, connectedBy: auth.connectedBy, connectedAt: auth.connectedAt, hasTokens: Boolean(auth.tokensEnc), customClient: Boolean(auth.customClient) } }
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

/**
 * Brána rezidencie a izolácie (ADR-002 × ADR-029): vyhodí chybu, keď režim
 * organizácie konektor na tejto adrese nepripúšťa. Volá sa pri uložení aj
 * pred každým volaním servera — profil sa mohol sprísniť, kým konektor
 * existoval, a vtedy sa nesmie volať, nie len neukladať.
 */
export async function assertConnectorAllowed(companyCode: string, endpoint: string): Promise<void> {
  const profile = await getTenantProfile(companyCode)
  const v = checkConnector(profile, endpoint)
  if (!v) return
  if (v.axis === "residency") {
    throw new ConnectorError("connector.residency", `Konektor sa v režime „${v.limit}" nedá použiť: ${v.message}`, { mode: v.limit })
  }
  throw new ConnectorError("connector.isolation", `Konektor sa pri úrovni izolácie ${v.limit} nedá použiť: ${v.message}`, { tier: v.limit })
}

/** To isté bez výnimky — na filtrovanie zoznamov (pilulky, rozsahy kanála). */
export async function connectorAllowed(companyCode: string, endpoint: string): Promise<boolean> {
  try { await assertConnectorAllowed(companyCode, endpoint); return true } catch { return false }
}

export const EMPTY_REDUCTION: ReductionPolicy = { dropSections: [], scrubPatterns: [], skipPaths: [], scrubPresets: [] }

/**
 * Nástroj na hľadanie a pole otázky: nastavenie konektora, inak predvoľba
 * profilu (D178). `null`, keď konektor hľadať nevie.
 */
export function searchSetup(c: Pick<Connector, "profile" | "uses" | "capabilities">): { tool: string; queryArg: string; viaProfile: boolean } | null {
  const profile = profileFor(c.profile)
  const r = c.uses.retrieval
  const tool = r.searchTool || profile.defaults?.searchTool
  const queryArg = r.searchQueryArg || profile.defaults?.searchQueryArg
  if (!tool || !queryArg) return null
  // Profil číta výsledok po svojom len pri svojom nástroji; iný nástroj sa číta všeobecne.
  const viaProfile = Boolean(profile.search) && tool === profile.defaults?.searchTool
  return { tool, queryArg, viaProfile }
}

/** Konektor vie importovať: profil vie stiahnuť článok, alebo server ponúka `resources`. */
export function canImport(c: Pick<Connector, "profile" | "capabilities">): boolean {
  return Boolean(profileFor(c.profile).fetch || c.capabilities?.resources)
}

/** Kanály, ktoré používajú rozsahy tohto konektora — do potvrdenia odstránenia. */
export async function channelsUsingConnector(companyCode: string, id: string): Promise<{ key: string; name: string; scopes: string[] }[]> {
  const prefix = `${id}:`
  return (await listChannels(companyCode))
    .map(ch => ({ key: ch.key, name: ch.name, scopes: (ch.connectorScopes ?? []).filter(r => r.startsWith(prefix)).map(r => r.slice(prefix.length)) }))
    .filter(ch => ch.scopes.length)
}

/** Kľúč rozsahu z názvu, keď ho správca nevyplnil: malé písmená, číslice, pomlčky. */
export function scopeKeyFrom(label: string): string {
  return label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)
}

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
  /** Prázdny pri založení = prevezme sa zo servera (`autoName`). */
  name: string
  /** Len pri založení — iný server je nový konektor (Q14). */
  endpoint?: string
  /** Vlastný klient OAuth (Pokročilé prihlásenie), len pri založení. */
  clientId?: string
  clientSecret?: string
  retrievalEnabled: boolean
  retrievalAccessLevel: string
  /** Hľadať v konektore aj bez zapnutia pilulkou (len portál). */
  retrievalDefaultOn?: boolean
  /** Použitie B (import do knižnice). Nezadané = bez zmeny. */
  ingestEnabled?: boolean
  reduction?: Partial<ReductionPolicy>
  /** Rozsahy (riadky formulára). Nezadané = bez zmeny. */
  scopes?: ConnectorScope[]
  searchTool?: string
  searchQueryArg?: string
  optionsTool?: string
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
  const col = await getCollection<Connector>(CONNECTORS_COLLECTION)
  const now = new Date()
  const existing = input.id ? await col.findOne({ companyCode: code, id: input.id }) : null
  if (input.id && !existing) throw new ConnectorError("connector.notFound", "Taký konektor tu nie je.")

  // Adresa sa zadáva len pri založení (Q14): nová adresa = nové prihlásenie,
  // nové nástroje a rozsahy, a kanály by sa ticho odkazovali na iný server.
  let endpoint: string
  if (existing) endpoint = existing.endpoint
  else {
    try {
      const u = new URL((input.endpoint ?? "").trim())
      if (u.protocol !== "https:") throw new Error("https")
      endpoint = u.toString()
    } catch {
      throw new ConnectorError("connector.endpoint", "Adresa servera musí byť úplná a začínať https://.")
    }
  }
  await assertConnectorAllowed(code, endpoint)

  // Názov je pri založení nepovinný — do pripojenia je ním hostiteľ, potom
  // ho nahradí názov, ktorým sa server predstaví (Q1).
  const typed = input.name.replace(/\s+/g, " ").trim()
  const autoName = !typed
  const name = typed || existing?.server?.title || existing?.server?.name || new URL(endpoint).host

  const accessLevel: ConnectorAccessLevel = input.retrievalAccessLevel === "public" ? "public" : "internal"
  const scrub = tidyLines(input.reduction?.scrubPatterns)
  const bad = scrub.find(p => !validRegex(p)) ?? tidyLines(input.reduction?.skipPaths).find(p => !validRegex(p))
  if (bad) throw new ConnectorError("connector.badPattern", "Vzor sa nedá použiť ako regulárny výraz.", { pattern: bad })
  const reduction: ReductionPolicy = {
    dropSections: tidyLines(input.reduction?.dropSections),
    scrubPatterns: scrub,
    skipPaths: tidyLines(input.reduction?.skipPaths),
    scrubPresets: (input.reduction?.scrubPresets ?? existing?.uses.retrieval.reduction.scrubPresets ?? []).filter(isScrubPreset),
  }

  // Rozsahy: kľúč je identita (odkazujú sa naň kanály, `<id>:<kľúč>`), nesmie
  // sa opakovať a po uložení sa nemení — formulár ho pri uloženom rozsahu
  // posiela skrytý. Rozsah bez názvu aj hodnôt je zmazaný.
  const scopes = input.scopes === undefined ? existing?.scopes ?? [] : input.scopes
    .map(sc => {
      const filter = Object.fromEntries(Object.entries(sc.filter).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))
      const label = sc.label.trim()
      const key = (sc.key.trim() || scopeKeyFrom(label || Object.values(filter).join("-"))).slice(0, 40)
      return { key, label: label || key, filter }
    })
    .filter(sc => sc.key && (sc.label !== sc.key || Object.keys(sc.filter).length))
  if (new Set(scopes.map(sc => sc.key)).size !== scopes.length) throw new ConnectorError("connector.scopeDuplicate", "Dva rozsahy majú rovnaký kľúč.")

  const profile: ProfileKey = existing?.profile ?? detectProfile(endpoint)
  const r0 = existing?.uses.retrieval
  const keep = (given: string | undefined, before: string | undefined) => given === undefined ? before : given.trim() || undefined

  // Vlastný klient OAuth (Pokročilé prihlásenie) ide tam, kam by SDK uložilo
  // dynamicky registrovaného klienta — `clientInformation()` ho vráti rovnako.
  const clientId = input.clientId?.trim()
  const auth: ConnectorAuth = existing?.auth ?? { mode: "tenant" }
  if (!existing && clientId) {
    auth.clientInfoEnc = encrypt(JSON.stringify({ client_id: clientId, ...(input.clientSecret?.trim() ? { client_secret: input.clientSecret.trim() } : {}) }))
    auth.customClient = true
  }

  const profileDefaultsOn = !existing && Boolean(profileFor(profile).defaults?.searchTool)
  const connector: Connector = {
    companyCode: code,
    id: existing?.id ?? randomUUID(),
    name, endpoint, profile, auth, scopes,
    autoName: autoName || undefined,
    uses: {
      retrieval: {
        // Pri založení je živý zdroj zapnutý, keď profil vie hľadať; inak ho zapne správca.
        enabled: existing ? Boolean(input.retrievalEnabled) : (input.retrievalEnabled || profileDefaultsOn),
        accessLevel, reduction,
        defaultOn: Boolean(input.retrievalDefaultOn),
        searchTool: keep(input.searchTool, r0?.searchTool),
        searchQueryArg: keep(input.searchQueryArg, r0?.searchQueryArg),
        optionsTool: keep(input.optionsTool, r0?.optionsTool),
      },
      ingest: { enabled: input.ingestEnabled ?? existing?.uses.ingest.enabled ?? false },
      agentTools: existing?.uses.agentTools ?? { allowed: [] },
    },
    capabilities: existing?.capabilities ?? null,
    server: existing?.server ?? null,
    status: existing?.status ?? "new",
    lastError: existing?.lastError ?? null,
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
      ...(existing.uses.retrieval.enabled !== connector.uses.retrieval.enabled ? { retrieval: { from: existing.uses.retrieval.enabled, to: connector.uses.retrieval.enabled } } : {}),
      ...(existing.uses.retrieval.accessLevel !== accessLevel ? { accessLevel: { from: existing.uses.retrieval.accessLevel, to: accessLevel } } : {}),
      ...((existing.uses.retrieval.searchTool ?? "") !== (connector.uses.retrieval.searchTool ?? "") ? { searchTool: { from: existing.uses.retrieval.searchTool ?? "", to: connector.uses.retrieval.searchTool ?? "" } } : {}),
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
/**
 * Čo server povedal pri pripojení (D178): predstavenie, nástroje, zdroje
 * a hodnoty polí. Názov sa prevezme, len keď ho správca nevyplnil; profil
 * sa doplní, keď ho server prezradil až menom.
 */
export async function saveDiscovery(companyCode: string, id: string, found: {
  server: ConnectorServerInfo | null
  capabilities: Omit<ConnectorCapabilities, "discoveredAt">
}): Promise<void> {
  const col = await getCollection<Connector>(CONNECTORS_COLLECTION)
  const c = await col.findOne({ companyCode, id })
  if (!c) return
  const set: Record<string, unknown> = {
    server: found.server,
    capabilities: { ...found.capabilities, discoveredAt: new Date() },
    updatedAt: new Date(),
  }
  if (c.autoName && found.server) set.name = found.server.title || found.server.name || c.name
  if (c.profile === "generic") {
    const detected = detectProfile(c.endpoint, found.server?.name)
    if (detected !== "generic") {
      set.profile = detected
      if (!c.uses.retrieval.searchTool && profileFor(detected).defaults?.searchTool) set["uses.retrieval.enabled"] = true
    }
  }
  await col.updateOne({ companyCode, id }, { $set: set })
}

/** Konektor podľa `state` z návratu OAuth — `state` je náhodný a jednorazový. */
export async function connectorByPendingState(state: string): Promise<Connector | null> {
  if (!state) return null
  const col = await getCollection<Connector>(CONNECTORS_COLLECTION)
  return col.findOne({ "auth.pendingState": state })
}


