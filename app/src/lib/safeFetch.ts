/**
 * safeFetch.ts — stiahnutie cudzej stránky pre náhľad odkazu (ADR-033, D222).
 *
 * Server tu ide na adresu, ktorú napísal človek. Bez stráží by sa cez náhľad
 * dalo pozrieť do vnútornej siete (metadáta cloudu `169.254.169.254`,
 * `localhost`, databáza v privátnom rozsahu) — klasický SSRF. Preto:
 *
 *   - len `https:` na štandardnom porte, bez mena a hesla v adrese;
 *   - doména sa preloží **raz** a spojenie ide práve na overenú adresu
 *     (`lookup` pri požiadavke) — inak by DNS mohol medzi kontrolou
 *     a spojením odpovedať inou, vnútornou adresou (DNS rebinding);
 *   - všetky adresy domény musia byť verejné;
 *   - presmerovanie najviac trikrát, každé sa overí znova;
 *   - časový limit a strop veľkosti odpovede; nič sa neposiela (žiadne
 *     cookies, žiadne prihlásenie).
 */

import { lookup as dnsLookup } from "node:dns/promises"
import { request } from "node:https"
import { isIP } from "node:net"
import type { LookupFunction } from "node:net"

export class SafeFetchError extends Error {}

const MAX_REDIRECTS = 3

function v4Parts(ip: string): number[] | null {
  const p = ip.split(".").map(Number)
  return p.length === 4 && p.every(n => Number.isInteger(n) && n >= 0 && n <= 255) ? p : null
}

/** Adresa, kam server nesmie ísť: súkromná, lokálna, rezervovaná, multicast. */
export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) {
    const [a, b] = v4Parts(ip)!
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0)
      || (a === 198 && (b === 18 || b === 19))
  }
  if (kind === 6) {
    const s = ip.toLowerCase()
    if (s === "::" || s === "::1") return true
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s)
    if (mapped) return isPrivateIp(mapped[1])
    return /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || s.startsWith("ff") || s.startsWith("2001:db8") || s.startsWith("64:ff9b")
  }
  return true
}

/** Overí adresu a vráti jedinú verejnú IP, na ktorú sa smie pripojiť. */
async function vetted(url: URL): Promise<{ address: string; family: number }> {
  if (url.protocol !== "https:") throw new SafeFetchError("not-https")
  if (url.username || url.password) throw new SafeFetchError("credentials")
  if (url.port && url.port !== "443") throw new SafeFetchError("port")
  const host = url.hostname.replace(/^\[|\]$/g, "")
  const all = isIP(host) ? [{ address: host, family: isIP(host) }] : await dnsLookup(host, { all: true })
  if (!all.length || all.some(a => isPrivateIp(a.address))) throw new SafeFetchError("private-address")
  return all[0]
}

export interface Fetched { url: string; contentType: string; body: Buffer }

function once(url: URL, pin: { address: string; family: number }, maxBytes: number, accept: string, deadline: number):
  Promise<{ status: number; location?: string; contentType: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    // Spojenie ide na overenú adresu; meno domény ostáva pre TLS (SNI) a Host.
    // Node so `autoSelectFamily` sa pýta `{ all: true }` a čaká pole adries.
    const lookup = ((_h: string, o: { all?: boolean }, cb: (...a: unknown[]) => void) =>
      o?.all ? cb(null, [{ address: pin.address, family: pin.family }]) : cb(null, pin.address, pin.family)) as unknown as LookupFunction
    const req = request(url, {
      method: "GET",
      lookup,
      headers: { "User-Agent": "ContineoLinkPreview/1.0 (+https://contineo.sk)", Accept: accept, "Accept-Language": "sk,cs;q=0.9,en;q=0.8" },
      timeout: Math.max(1, deadline - Date.now()),
    }, res => {
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400) {
        res.resume()
        resolve({ status, location: res.headers.location, contentType: "", body: Buffer.alloc(0) })
        return
      }
      const chunks: Buffer[] = []
      let size = 0
      res.on("data", (c: Buffer) => {
        size += c.length
        if (size > maxBytes) {
          // Strop: zvyšok sa nečíta, stačí začiatok (meta značky sú v `<head>`).
          chunks.push(c.subarray(0, Math.max(0, c.length - (size - maxBytes))))
          res.destroy()
          resolve({ status, contentType: String(res.headers["content-type"] ?? ""), body: Buffer.concat(chunks) })
          return
        }
        chunks.push(c)
      })
      res.on("end", () => resolve({ status, contentType: String(res.headers["content-type"] ?? ""), body: Buffer.concat(chunks) }))
      res.on("error", reject)
    })
    req.on("timeout", () => req.destroy(new SafeFetchError("timeout")))
    req.on("error", reject)
    req.end()
  })
}

/** Stiahne verejnú `https` adresu so strážami vyššie. Chyba = žiadny náhľad. */
export async function safeFetch(href: string, opts: { maxBytes: number; accept: string; timeoutMs?: number }): Promise<Fetched> {
  const deadline = Date.now() + (opts.timeoutMs ?? 5000)
  let url = new URL(href)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const pin = await vetted(url)
    const res = await once(url, pin, opts.maxBytes, opts.accept, deadline)
    if (res.status >= 300 && res.status < 400 && res.location) {
      url = new URL(res.location, url)
      continue
    }
    if (res.status < 200 || res.status >= 300) throw new SafeFetchError(`status-${res.status}`)
    return { url: url.toString(), contentType: res.contentType, body: res.body }
  }
  throw new SafeFetchError("too-many-redirects")
}
