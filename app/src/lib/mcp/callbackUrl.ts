/**
 * Adresa návratu po prihlásení ku konektoru (ADR-029, D172).
 *
 * Jedna pevná cesta, hostiteľ z požiadavky — organizácie majú každá svoju
 * doménu a OAuth server porovnáva návratovú adresu doslovne. Mimo
 * požiadavky (cron) sa neprihlasuje, takže prázdna hodnota nie je chyba:
 * SDK ju potrebuje len vtedy, keď by človeka presmerovalo.
 */

import { headers } from "next/headers"

export const CONNECTOR_CALLBACK_PATH = "/api/connectors/callback"

export async function connectorCallbackUrl(): Promise<string> {
  try {
    const h = await headers()
    const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim()
    if (!host) return ""
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")
    return `${proto}://${host}${CONNECTOR_CALLBACK_PATH}`
  } catch {
    return ""
  }
}
