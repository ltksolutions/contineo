/**
 * origin.ts — pôvod (schéma a hostiteľ) požiadavky na MCP server a OAuth.
 *
 * Organizácie majú každá svoju doménu (D29) a OAuth porovnáva adresy
 * doslovne: `issuer`, `resource` aj návratové adresy sa skladajú z toho,
 * na čo požiadavka prišla, nie z konštanty. Za proxy Vercelu je pôvodný
 * hostiteľ v `x-forwarded-host` — rovnaký zdroj ako `requestHostname()`.
 */

export function originOf(req: Request): string {
  const h = req.headers
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim()
  if (!host) return new URL(req.url).origin
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim()
    || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")
  return `${proto}://${host}`
}

/** Token z hlavičky `Authorization: Bearer …`, inak `null`. */
export function bearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? ""
  const m = /^Bearer\s+(\S+)$/i.exec(auth)
  return m ? m[1] : null
}
