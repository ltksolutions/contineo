/**
 * generic.ts — čo sa o MCP serveri dá vyčítať zo štandardu (ADR-029, D178).
 *
 * Profil (`profiles/*`) je od 9. 10. 2026 len predvyplnenie pre známy
 * server. Všetko ostatné — ktoré vstupy má nástroj na hľadanie, ako
 * z nich poskladať rozsah, ako prečítať výsledok servera bez profilu —
 * sa odvodzuje zo `inputSchema`, `annotations` a z tvaru výsledku podľa
 * štandardu. Funkcie sú čisté (bez volania servera), aby sa dali testovať.
 */

import { textOf, type LiveArticle } from "./profiles/types"

/** Nástroj tak, ako ho uloží pripojenie (`tools/list`). */
export interface ToolInfo {
  name: string
  title?: string
  description: string
  inputSchema?: { type?: string; properties?: Record<string, JsonSchemaProp>; required?: string[] }
  annotations?: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean }
}

export interface JsonSchemaProp {
  type?: string | string[]
  title?: string
  description?: string
  enum?: unknown[]
  items?: { type?: string | string[]; enum?: unknown[] }
}

function hasType(p: JsonSchemaProp | undefined, t: string): boolean {
  if (!p) return false
  return Array.isArray(p.type) ? p.type.includes(t) : p.type === t
}

function isStringish(p: JsonSchemaProp): boolean {
  return hasType(p, "string") || (!p.type && Array.isArray(p.enum) && p.enum.every(v => typeof v === "string"))
}

function isStringArray(p: JsonSchemaProp): boolean {
  return hasType(p, "array") && Boolean(p.items) && (hasType(p.items, "string") || Array.isArray(p.items?.enum))
}

/** Textové vstupy nástroja — kandidáti na pole otázky. */
export function stringInputs(tool: ToolInfo): string[] {
  const props = tool.inputSchema?.properties ?? {}
  return Object.keys(props).filter(k => isStringish(props[k]))
}

/** Nástroj, ktorý sa dá použiť na hľadanie: má aspoň jeden textový vstup. */
export function isSearchCandidate(tool: ToolInfo): boolean {
  return stringInputs(tool).length > 0
}

/** Predvolené pole otázky: `query`, `q`, prvý povinný textový vstup, prvý textový. */
export function defaultQueryArg(tool: ToolInfo): string | undefined {
  const strings = stringInputs(tool)
  for (const k of ["query", "q", "search", "text"]) if (strings.includes(k)) return k
  const required = tool.inputSchema?.required ?? []
  return strings.find(k => required.includes(k)) ?? strings[0]
}

/** Predvolený nástroj na hľadanie: má `search` v názve a textový vstup. */
export function defaultSearchTool(tools: ToolInfo[]): string | undefined {
  const candidates = tools.filter(isSearchCandidate)
  return (candidates.find(t => /search/i.test(t.name)) ?? candidates.find(t => /query|find/i.test(t.name)))?.name
}

export interface ScopeField {
  key: string
  label: string
  description?: string
  /** Hodnoty zo schémy (`enum`) — pole sa kreslí ako výber. */
  options?: string[]
  /** Vstup je pole reťazcov; v rozsahu sa hodnoty píšu oddelené čiarkou. */
  list: boolean
}

/**
 * Polia rozsahu (D175, D178): vstupy nástroja na hľadanie okrem poľa
 * otázky. Číselné a logické vstupy (`limit`) sa vynechajú — rozsah je
 * výsek obsahu, nie nastavenie počtu výsledkov.
 */
export function scopeFields(tool: ToolInfo | undefined, queryArg: string | undefined): ScopeField[] {
  const props = tool?.inputSchema?.properties ?? {}
  return Object.entries(props)
    .filter(([k, p]) => k !== queryArg && (isStringish(p) || isStringArray(p)))
    .map(([k, p]) => {
      const list = isStringArray(p)
      const raw = list ? p.items?.enum : p.enum
      const options = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : undefined
      return { key: k, label: p.title || k, description: p.description, options: options?.length ? options : undefined, list }
    })
}

/** Argumenty volania: otázka, hodnoty rozsahu podľa typu vstupu, limit, keď ho nástroj pozná. */
export function toolArgs(tool: ToolInfo | undefined, queryArg: string, query: string, filter: Record<string, string>, limit: number): Record<string, unknown> {
  const props = tool?.inputSchema?.properties ?? {}
  const args: Record<string, unknown> = { [queryArg]: query }
  for (const [k, v] of Object.entries(filter)) {
    if (!v || k === queryArg) continue
    const p = props[k]
    if (p && hasType(p, "array")) args[k] = v.split(",").map(s => s.trim()).filter(Boolean)
    else if (p && (hasType(p, "number") || hasType(p, "integer"))) args[k] = Number(v)
    else if (p && hasType(p, "boolean")) args[k] = v === "true"
    else args[k] = v
  }
  for (const k of ["limit", "max_results", "maxResults", "top_k"]) {
    const p = props[k]
    if (p && (hasType(p, "number") || hasType(p, "integer"))) { args[k] = limit; break }
  }
  return args
}

// ── Výsledok servera bez profilu (Q10) ──────────────────────────────────────

interface ContentBlock {
  type?: string
  text?: string
  uri?: string
  name?: string
  title?: string
  description?: string
  resource?: { uri?: string; text?: string; title?: string; name?: string; mimeType?: string }
  annotations?: { audience?: string[] }
}

/**
 * Obsah, ktorý server označil len pre model (`annotations.audience` bez
 * „user"), sa vynechá — sú to pokyny pre asistenta, nie text pre človeka,
 * a pokyny cudzieho servera nie sú pokyn pre nás (D174).
 */
function forPeople(b: ContentBlock): boolean {
  const aud = b?.annotations?.audience
  return !Array.isArray(aud) || aud.includes("user")
}

function pick(o: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) if (typeof o[k] === "string" && (o[k] as string).trim()) return (o[k] as string).trim()
  return undefined
}

/** Prvé pole objektov v `structuredContent` (priamo alebo o úroveň nižšie). */
function firstObjectArray(sc: unknown): Record<string, unknown>[] | null {
  const isObjArray = (v: unknown): v is Record<string, unknown>[] =>
    Array.isArray(v) && v.length > 0 && v.every(x => x && typeof x === "object" && !Array.isArray(x))
  if (isObjArray(sc)) return sc
  if (sc && typeof sc === "object") {
    for (const v of Object.values(sc as Record<string, unknown>)) if (isObjArray(v)) return v
  }
  return null
}

/**
 * Výsledok nástroja na články, keď server nemá profil:
 * 1. bloky `resource` a `resource_link` — každý je článok;
 * 2. `structuredContent` s poľom objektov `{title, text|content, uri}`;
 * 3. inak celý text je jeden článok.
 * `clean` je čistenie z profilu (preambula), ak nejaké je.
 */
export function parseGenericResult(result: unknown, clean: (s: string) => string = s => s): LiveArticle[] {
  const r = (result ?? {}) as { content?: ContentBlock[]; structuredContent?: unknown }
  const blocks = (Array.isArray(r.content) ? r.content : []).filter(forPeople)
  const fromBlocks: LiveArticle[] = []
  for (const b of blocks) {
    if (b?.type === "resource" && b.resource?.uri) {
      const text = clean(b.resource.text ?? "")
      if (text.trim()) fromBlocks.push({ externalId: b.resource.uri, title: b.resource.title || b.resource.name || b.resource.uri, text: text.trim(), url: httpUrl(b.resource.uri) })
    } else if (b?.type === "resource_link" && b.uri) {
      fromBlocks.push({ externalId: b.uri, title: b.title || b.name || b.uri, text: (b.description ?? "").trim(), url: httpUrl(b.uri) })
    }
  }
  if (fromBlocks.length) return fromBlocks

  const items = firstObjectArray(r.structuredContent)
  if (items) {
    const out = items.map((o, i) => {
      const text = clean(pick(o, ["text", "content", "body", "markdown", "snippet", "excerpt", "description"]) ?? "")
      const id = pick(o, ["uri", "url", "path", "file", "id"]) ?? String(i + 1)
      const group = pick(o, ["group", "project", "space", "collection", "category"])
      const score = typeof o.score === "number" ? o.score : undefined
      return { externalId: id, title: pick(o, ["title", "name", "heading"]) ?? id, text: text.trim(), group, url: httpUrl(pick(o, ["url", "uri"])), score }
    }).filter(a => a.text)
    if (out.length) return out
  }

  const text = clean(Array.isArray(r.content) ? textOf({ content: blocks }) : textOf(result)).trim()
  if (!text) return []
  const title = text.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim() ?? "—"
  return [{ externalId: "result", title, text }]
}

function httpUrl(s: string | undefined): string | undefined {
  return s && /^https?:\/\//.test(s) ? s : undefined
}

// ── Možnosti polí (nástroj s možnosťami) ────────────────────────────────────

/**
 * Výsledok „nástroja s možnosťami" na hodnoty polí rozsahu. Štandard tvar
 * nepredpisuje, preto sa skúšajú tri bežné: `structuredContent` (objekt
 * polí reťazcov), JSON v texte, riadky `názov (n): a, b, c`.
 */
export function parseFieldOptions(result: unknown, clean: (s: string) => string = s => s): Record<string, string[]> {
  const r = (result ?? {}) as { structuredContent?: unknown }
  const fromObject = (o: unknown): Record<string, string[]> => {
    const out: Record<string, string[]> = {}
    if (o && typeof o === "object" && !Array.isArray(o)) {
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        if (Array.isArray(v)) {
          const vals = v.map(x => typeof x === "string" ? x : (x && typeof x === "object" ? pick(x as Record<string, unknown>, ["value", "key", "name", "id"]) : undefined)).filter((x): x is string => Boolean(x))
          if (vals.length) out[k] = vals
        }
      }
    }
    return out
  }
  const structured = fromObject(r.structuredContent)
  if (Object.keys(structured).length) return structured

  const text = clean(textOf(result))
  try {
    const parsed = fromObject(JSON.parse(text))
    if (Object.keys(parsed).length) return parsed
  } catch { /* nie je JSON */ }

  const out: Record<string, string[]> = {}
  // Riadok môže začínať hneď za predchádzajúcim textom (Sportnet: „…answer.tags (1570): …").
  const re = /([A-Za-z_][\w-]*)\s*(?:\(\d+\))?:\s*([^\n]+)/g
  for (const line of text.split("\n")) {
    const m = [...line.matchAll(re)].pop()
    if (!m) continue
    const vals = m[2].split(",").map(s => s.trim()).filter(Boolean)
    if (vals.length >= 2) out[m[1].replace(/^.*\./, "")] = vals
  }
  return out
}

/** Hodnoty pre pole rozsahu: kľúč presne, v množnom čísle alebo naopak. */
export function optionsFor(fieldOptions: Record<string, string[]> | undefined, field: string): string[] | undefined {
  if (!fieldOptions) return undefined
  const f = field.toLowerCase()
  const plural = [f, `${f}s`, f.endsWith("y") ? `${f.slice(0, -1)}ies` : "", f.endsWith("s") ? f.slice(0, -1) : ""].filter(Boolean)
  const key = Object.keys(fieldOptions).find(k => plural.includes(k.toLowerCase()))
  return key ? fieldOptions[key] : undefined
}

/** Začiatky adries zdrojov (`resources/list`) — „priečinky", najčastejšie prvé. */
export function resourcePrefixes(uris: string[], max = 30): string[] {
  const counts = new Map<string, number>()
  for (const uri of uris) {
    const i = uri.lastIndexOf("/")
    if (i <= 0) continue
    const prefix = uri.slice(0, i + 1)
    if (/^[a-z][\w+.-]*:\/+$/i.test(prefix)) continue  // len schéma, nič nezužuje
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([p]) => p)
}

// ── Ikona servera (Q11) ─────────────────────────────────────────────────────

export const ICON_MAX_BYTES = 32 * 1024
export const ICON_TYPES = ["image/png", "image/jpeg", "image/webp"] as const

/**
 * Kandidáti na ikonu zo `serverInfo.icons`: len PNG, JPEG a WebP, nikdy SVG
 * (môže niesť skript a dodáva ho cudzí server). Adresa musí byť `https`
 * na tom istom hostiteľovi ako server — nie ľubovoľná adresa, ktorú by nám
 * server podstrčil na stiahnutie zvnútra našej siete.
 */
export function iconCandidates(icons: { src?: string; mimeType?: string }[] | undefined, endpoint: string): string[] {
  let host: string
  try { host = new URL(endpoint).host } catch { return [] }
  const okType = (src: string, mime?: string) => {
    const m = (mime ?? "").toLowerCase()
    if (m) return (ICON_TYPES as readonly string[]).includes(m)
    return /\.(png|jpe?g|webp)(\?|$)/i.test(src)
  }
  return (icons ?? []).flatMap(i => {
    const src = (i.src ?? "").trim()
    if (!src) return []
    if (src.startsWith("data:")) return /^data:image\/(png|jpeg|webp);base64,/i.test(src) && src.length <= ICON_MAX_BYTES * 1.4 ? [src] : []
    try {
      const u = new URL(src, endpoint)
      return u.protocol === "https:" && u.host === host && okType(u.pathname, i.mimeType) ? [u.toString()] : []
    } catch { return [] }
  })
}

/** Stiahnutý obrázok → `data:` adresa, ak je to PNG/JPEG/WebP do limitu (podľa obsahu, nie hlavičky). */
export function iconDataUrl(bytes: Uint8Array): string | null {
  if (!bytes.length || bytes.length > ICON_MAX_BYTES) return null
  const b = bytes
  const type =
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? "image/png"
    : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? "image/jpeg"
    : b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 ? "image/webp"
    : null
  if (!type) return null
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`
}
