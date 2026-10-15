/**
 * linkPreview.ts — náhľad odkazu von v správe Kuriéra (ADR-033, D222).
 *
 * Náhľad sa získa **raz, pri odoslaní**, a uloží sa k správe ako kópia:
 * názov, popis, doména a zmenšený obrázok. Čitateľ tak cudzí web nevolá
 * (ani cez obrázok — cudzí server sa nedozvie, kto a kedy správu čítal),
 * náhľad prežije zmazanú stránku a spätne sa nemení. Ktorákoľvek chyba
 * (nedostupná stránka, súkromná adresa, nič v hlavičke) znamená len to, že
 * náhľad nebude; správa sa pošle vždy.
 */

import { safeFetch } from "./safeFetch"
import { hostOf, isExternalHref } from "./courierLinks"

export interface LinkPreview {
  url: string
  host: string
  title: string
  description: string
  siteName: string
  /** Zmenšený obrázok ako `data:image/webp;base64,…`; prázdny = bez obrázka. */
  image: string
  fetchedAt: Date
}

const HTML_MAX = 512 * 1024
const IMAGE_MAX = 3 * 1024 * 1024
const THUMB_WIDTH = 480

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " }

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

const clean = (s: string | undefined, max: number) => {
  const t = decode(s ?? "").replace(/\s+/g, " ").trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

/** Hodnota atribútu z jednej značky (úvodzovky aj apostrofy). */
function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag)
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined
}

/**
 * Open Graph, Twitter karta a záložne `<title>` a `meta description` —
 * len z `<head>`. Regulárne výrazy, nie HTML parser: hľadáme pár značiek
 * a nič z cudzej stránky sa nikdy nevykreslí ako HTML.
 */
export function parseMeta(html: string, pageUrl: string): { title: string; description: string; siteName: string; image: string } {
  const end = html.search(/<\/head\s*>/i)
  const head = end >= 0 ? html.slice(0, end) : html
  const meta: Record<string, string> = {}
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase()
    const content = attr(tag, "content")
    if (key && content !== undefined && !(key in meta)) meta[key] = content
  }
  const titleTag = /<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1]
  let image = meta["og:image:secure_url"] ?? meta["og:image"] ?? meta["twitter:image"] ?? meta["twitter:image:src"] ?? ""
  try {
    image = image ? new URL(decode(image), pageUrl).toString() : ""
  } catch {
    image = ""
  }
  return {
    title: clean(meta["og:title"] ?? meta["twitter:title"] ?? titleTag, 200),
    description: clean(meta["og:description"] ?? meta["twitter:description"] ?? meta["description"], 300),
    siteName: clean(meta["og:site_name"], 80),
    image: isExternalHref(image) ? image : "",
  }
}

/** Obrázok → miniatúra WebP ako data URL; čokoľvek zlyhá = bez obrázka. */
async function thumbnail(src: string): Promise<string> {
  try {
    const res = await safeFetch(src, { maxBytes: IMAGE_MAX, accept: "image/*", timeoutMs: 5000 })
    if (!/^image\//i.test(res.contentType) || /svg/i.test(res.contentType)) return ""
    const sharp = (await import("sharp")).default
    const out = await sharp(res.body, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: THUMB_WIDTH, height: Math.round(THUMB_WIDTH / 1.91), fit: "cover", withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer()
    return out.length <= 80 * 1024 ? `data:image/webp;base64,${out.toString("base64")}` : ""
  } catch {
    return ""
  }
}

/** Náhľad jedného odkazu; `null`, keď stránka nič použiteľné nemá alebo nie je dostupná. */
export async function fetchPreview(href: string, now: Date = new Date()): Promise<LinkPreview | null> {
  if (!isExternalHref(href)) return null
  try {
    const res = await safeFetch(href, { maxBytes: HTML_MAX, accept: "text/html,application/xhtml+xml" })
    if (!/html/i.test(res.contentType)) return null
    const meta = parseMeta(res.body.toString("utf8"), res.url)
    if (!meta.title && !meta.description) return null
    return {
      url: href,
      host: hostOf(href),
      title: meta.title,
      description: meta.description,
      siteName: meta.siteName,
      image: meta.image ? await thumbnail(meta.image) : "",
      fetchedAt: now,
    }
  } catch {
    return null
  }
}

/** Náhľady všetkých odkazov naraz (najviac `MAX_PREVIEWS`), bez tých, čo zlyhali. */
export async function fetchPreviews(hrefs: string[], now: Date = new Date()): Promise<LinkPreview[]> {
  const all = await Promise.all(hrefs.map(h => fetchPreview(h, now)))
  return all.filter((p): p is LinkPreview => p !== null)
}
