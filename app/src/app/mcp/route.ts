/**
 * /mcp — Contineo ako MCP server (ADR-038). Verejná cesta = zmluva:
 * klienti ju majú uložené, nepremenúva sa.
 *
 * Brána je v `lib/mcpServer/auth.ts` (organizácia z domény, zapnutie
 * a rezidencia, OAuth token, aktívna osoba); tu sa len volá a odpoveď
 * sa podá transportu zo SDK. `GET` bez relácie (stream oznámení) v režime
 * bez stavu nemá čo poslať — SDK odpovie podľa špecifikácie.
 */

import { mcpGate } from "@/lib/mcpServer/auth"
import { handleMcpRequest } from "@/lib/mcpServer/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function handle(req: Request): Promise<Response> {
  const gate = await mcpGate(req)
  if (!gate.ok) return gate.response
  try {
    return await handleMcpRequest(req, gate.actor)
  } catch (e) {
    console.error("[mcp] požiadavka zlyhala:", e)
    return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null }), {
      status: 500, headers: { "content-type": "application/json" },
    })
  }
}

export const GET = handle
export const POST = handle
export const DELETE = handle
