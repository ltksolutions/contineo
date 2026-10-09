/**
 * operations.ts — hľadanie a stiahnutie článku cez konektor (ADR-029, D178).
 *
 * Jedno miesto, kde sa rozhodne, či výsledok číta profil (známy server,
 * jeho nástroj) alebo všeobecné čítanie podľa štandardu (`generic.ts`).
 * Používa ho živý zdroj, import do knižnice aj Vyskúšať hľadanie na detaile
 * konektora — všetky tri tak vidia ten istý výsledok.
 */

import { ConnectorError, searchSetup, type Connector } from "../connectors"
import { profileFor, type LiveArticle, type McpToolCaller } from "./profiles"
import { parseGenericResult, toolArgs } from "./generic"

/** Konektor, ktorý vie hľadať: má nástroj na hľadanie (z nastavenia alebo profilu). */
export function canSearch(c: Pick<Connector, "profile" | "uses" | "capabilities">): boolean {
  return searchSetup(c) !== null
}

export async function searchArticles(client: McpToolCaller, c: Connector, query: string, filter: Record<string, string>, limit: number): Promise<LiveArticle[]> {
  const setup = searchSetup(c)
  if (!setup) throw new ConnectorError("connector.noSearch", "Konektor nemá nástroj na hľadanie.")
  const profile = profileFor(c.profile)
  if (setup.viaProfile && profile.search) return profile.search(client, query, filter, limit)
  const tool = c.capabilities?.tools.find(t => t.name === setup.tool)
  const result = await client.callTool(setup.tool, toolArgs(tool, setup.queryArg, query, filter, limit))
  return parseGenericResult(result, profile.cleanText).slice(0, Math.max(limit, 1))
}

/** Celý článok: profil, inak `resources/read` nad adresou zdroja. */
export async function fetchArticle(
  client: McpToolCaller & { readResource?(uri: string): Promise<unknown> }, c: Connector, externalId: string,
): Promise<LiveArticle | null> {
  const profile = profileFor(c.profile)
  if (profile.fetch) return profile.fetch(client, externalId)
  if (!c.capabilities?.resources || !client.readResource) throw new ConnectorError("connector.noImportProfile", "Server nesprístupňuje dokumenty.")
  const r = (await client.readResource(externalId)) as { contents?: { uri?: string; text?: string }[] }
  const text = (r.contents ?? []).map(x => x.text ?? "").join("\n").trim()
  const clean = profile.cleanText ? profile.cleanText(text) : text
  if (!clean) return null
  const title = clean.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? externalId.split("/").pop() ?? externalId
  return { externalId, title, text: clean }
}
