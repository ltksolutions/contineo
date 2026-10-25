/**
 * sources.ts — zdroje, v ktorých MCP server hľadá (ADR-038, ADR-040 D266).
 *
 * Výber zdrojov pre `search_library` a `ask` sa skladá **z registra zdrojov**
 * (`sourcesRegister.ts`) tými istými pravidlami ako výber na Opýtať sa
 * (`liveSourcesFor`): knižnica vždy, ďalej zapnuté, pripojené, rezidenciou
 * dovolené zdroje, ktoré vedia hľadať a nepresahujú úroveň prístupu osoby.
 * Tá istá položka registra je ten istý riadok vo výbere — MCP nemá vlastný
 * zoznam (D266).
 */

import { sourcesRegister, liveSourcesFor, type RegisteredSource, type SourceKind } from "../sourcesRegister"
import { dictionary } from "../i18n"
import type { McpActor } from "./auth"

export const LIBRARY_SOURCE_ID = "library"

export interface McpSource {
  /** `library`, `law` alebo id konektora — to isté id ako `?src=` na portáli. */
  id: string
  name: string
  kind: SourceKind
  /** Adaptér zdroja druhu web (`slov-lex`). */
  adapter: string | null
  /** Hľadá sa v ňom aj bez výslovného výberu (na Opýtať sa). */
  defaultOn: boolean
  /** Čo zdroj obsahuje — pre model, aby vedel, kedy ho vybrať. */
  description: string
}

const DESCRIPTION: Record<SourceKind, string> = {
  file: "The organisation's own documents in the library — curated, approved and versioned. Default source.",
  web: "Legislation from Slov-Lex (laws and decrees the organisation follows), versions in force on the given day. Public text, not the organisation's own rules.",
  mcp: "A connected external knowledge source (MCP connector). Live, not curated by the organisation — cite it as such.",
  mailbox: "Helpdesk mailbox.",
}

/**
 * Zdroje, ktoré smie táto osoba vybrať: knižnica a živé zdroje z registra.
 * Čistá funkcia — testuje sa bez databázy.
 */
export function searchableSources(register: RegisteredSource[], accessLevel: "public" | "internal"): McpSource[] {
  const live = new Set(liveSourcesFor(register, accessLevel).map(s => s.id))
  return register
    .filter(s => s.id === LIBRARY_SOURCE_ID || live.has(s.id))
    .map(s => ({
      id: s.id, name: s.name, kind: s.kind, adapter: s.adapter, defaultOn: s.defaultOn,
      description: DESCRIPTION[s.kind],
    }))
}

/**
 * Výber zo žiadosti proti povoleným zdrojom. Neznáme id je chyba, nie ticho
 * menej — model má vedieť, že zdroj nemá (a z `list_sources`, ktoré má).
 * Chýbajúci výber = `fallback`.
 */
/**
 * Staré id zdrojov → dnešné (ADR-040 Dodatok 1, D268): `law` bol do 25. 10.
 * id druhu, dnes je to zdroj `slov-lex`. Klient, ktorý si zapamätal výsledok
 * `list_sources`, posiela starý tvar — prekladá sa, neodmieta.
 */
const LEGACY_SOURCE_IDS: Record<string, string> = { law: "slov-lex" }

export function pickSources(requested: readonly string[] | undefined, allowed: McpSource[], fallback: string[]): { picked: McpSource[]; unknown: string[] } {
  const ids = requested?.length ? [...new Set(requested.map(id => LEGACY_SOURCE_IDS[id] ?? id))] : fallback
  const byId = new Map(allowed.map(s => [s.id, s]))
  return {
    picked: ids.map(id => byId.get(id)).filter((s): s is McpSource => Boolean(s)),
    unknown: ids.filter(id => !byId.has(id)),
  }
}

export async function sourcesFor(actor: Pick<McpActor, "tenant" | "person" | "accessLevel">): Promise<McpSource[]> {
  const register = await sourcesRegister(actor.tenant.companyCode, actor.person.language)
  return searchableSources(register, actor.accessLevel)
}

/** Veta pre model, keď vybral zdroj, ktorý organizácia nemá. */
export function unknownSourcesMessage(unknown: string[], allowed: McpSource[]): string {
  return `Unknown or unavailable source(s): ${unknown.join(", ")}. Available: ${allowed.map(s => `${s.id} (${s.name})`).join(", ")}. Use list_sources.`
}

/** Názov knižnice v jazyku osoby — pre „v čom sa hľadalo". */
export function libraryName(language: string): string {
  return dictionary(language).ask.scopeLibrary
}
