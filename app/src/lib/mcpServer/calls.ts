/**
 * calls.ts — stopa každého volania MCP servera (ADR-038; D177 otočené).
 *
 * Cudzí klient volá pod identitou osoby. Zapisuje sa: osoba (kópia mena,
 * D158), klient, nástroj, trvanie, výsledok a veľkosť odpovede — **bez
 * znenia otázky ani odpovede**, rovnako ako výkaz spotreby AI (ADR-026)
 * a stopa konektorov (`connector_calls`). Otázky cez `ask` sú v histórii
 * otázok ako z webu. Záznamy sa nemenia (D24).
 */

import { getCollection } from "../mongodb"

export const MCP_CALLS_COLLECTION = "mcp_calls"

export interface McpCallRecord {
  companyCode: string
  personId: string
  personName: string
  clientId: string
  clientName: string
  grantId: string
  /** `tool:<názov>` alebo `resource:<šablóna>`. */
  tool: string
  at: Date
  ms: number
  outcome: "ok" | "error" | "forbidden"
  /** Približná veľkosť odpovede v znakoch — nie obsah. */
  size: number
  error?: string
}

export async function logMcpCall(rec: Omit<McpCallRecord, "at">): Promise<void> {
  try {
    const col = await getCollection<McpCallRecord>(MCP_CALLS_COLLECTION)
    await col.insertOne({ ...rec, at: new Date() })
  } catch (e) {
    console.error("[mcp] stopa volania sa nezapísala:", e)
  }
}
