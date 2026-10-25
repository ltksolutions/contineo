/**
 * sourcesRegister.ts — register zdrojov obsahu organizácie (ADR-040, D264–D266).
 *
 * Spoločný tvar nad dnešnými dátami, **nie nová kolekcia**: knižnica je
 * stály prvý riadok, MCP konektory sú z `connectors` (ADR-029), Legislatíva
 * zo Slov-Lexu z odberov katalógu (ADR-039). Druh zdroja je zo spoločnej
 * schémy so stránkou Technológia a číselníkom `sourceType`; adaptér je
 * vlastnosť zdroja druhu web, nie druh sám (D265).
 *
 * Register je **jediný vstup pre výber zdrojov** na Opýtať sa, v plachte
 * otázky a v nástroji `ask` MCP servera (D266): tá istá položka tu je ten
 * istý riadok vo výbere. Pravidlo, ktorý konektor smie byť živým zdrojom,
 * ostáva v `liveSources.ts` (`liveConnectorsFor`) — register ho volá, aby
 * výber zdrojov a odpoveď nikdy nevideli iný zoznam.
 */

import { listConnectors, connectorAllowed, type Connector } from "./connectors"
import { listChannels, mailboxStalled, type HelpdeskChannel } from "./channels"
import { canSearch } from "./mcp/operations"
import { lawSourceState, LAW_SOURCE_ID } from "./lawCatalog"
import { SLOV_LEX_ADAPTER } from "./slovLex"
import { dictionary, type UiLanguage } from "./i18n"
import type { AskLiveSource } from "./askScope"

/** Druhy zo schémy „Zdroje obsahu" (Technológia) a číselníka `sourceType` (D264). */
export type SourceKind = "file" | "mailbox" | "mcp" | "web"

export interface RegisteredSource {
  /** `library`, id konektora, `law` — to isté id, aké má zdroj vo výbere (`?src=`). */
  id: string
  kind: SourceKind
  /** Adaptér zdroja druhu web (`slov-lex`); ostatné druhy ho nemajú. */
  adapter: string | null
  name: string
  /** Organizácia ho má zapnutý (konektor: živý zdroj alebo import; legislatíva: aspoň jeden predpis). */
  enabled: boolean
  /** Spojenie funguje (konektor pripojený; knižnica a katalóg vždy). */
  connected: boolean
  /** Rezidencia organizácie ho dovoľuje (ADR-002, ADR-039 D257). */
  allowed: boolean
  /** Na Opýtať sa sa volá aj bez výslovného výberu. */
  defaultOn: boolean
  accessLevel: "public" | "internal"
  /** Čo zdroj vie (D264). */
  uses: { retrieval: boolean; import: boolean; tools: boolean }
  /** Kde sa zdroj nastavuje. */
  href: string
  /** Krátky údaj do riadku: adresa servera, počet predpisov… */
  detail: string | null
}

const CONNECTORS_HREF = "/organisation/sources/connectors"
export const SOURCES_HREF = "/organisation/sources"
export const LAW_HREF = `${SOURCES_HREF}/law`

function fromConnector(c: Connector, allowed: boolean): RegisteredSource {
  let host: string | null = null
  try { host = new URL(c.endpoint).host } catch { host = null }
  return {
    id: c.id, kind: "mcp", adapter: null, name: c.name,
    enabled: c.uses.retrieval.enabled || c.uses.ingest.enabled || c.uses.agentTools.allowed.length > 0,
    connected: c.status === "connected",
    allowed,
    defaultOn: Boolean(c.uses.retrieval.defaultOn),
    accessLevel: c.uses.retrieval.accessLevel,
    uses: { retrieval: c.uses.retrieval.enabled && canSearch(c), import: c.uses.ingest.enabled, tools: c.uses.agentTools.allowed.length > 0 },
    href: `${CONNECTORS_HREF}/${encodeURIComponent(c.id)}`,
    detail: host,
  }
}

/**
 * Schránka helpdesku ako zdroj (ADR-040 krok 3, D264): register ju ukazuje,
 * nepreberá — nastavuje sa pri kanáli (ADR-028). Obsah z nej neide do
 * hľadania priamo: otázky číta analýza a navrhuje doplnenie manuálov
 * (ADR-030, ADR-034), preto „import", nie „živý zdroj".
 */
function fromMailbox(ch: HelpdeskChannel): RegisteredSource | null {
  if (!ch.mailbox) return null
  return {
    id: `mailbox:${ch.key}`, kind: "mailbox", adapter: ch.mailbox.kind, name: ch.name,
    enabled: true, connected: !mailboxStalled(ch.mailbox), allowed: true, defaultOn: false, accessLevel: "public",
    uses: { retrieval: false, import: true, tools: false },
    href: `/channels/${encodeURIComponent(ch.key)}`, detail: ch.mailbox.address,
  }
}

/** Celý register organizácie — pre sekciu Zdroje aj pre výber zdrojov. */
export async function sourcesRegister(companyCode: string, language: UiLanguage): Promise<RegisteredSource[]> {
  const t = dictionary(language)
  const [connectors, law, channels] = await Promise.all([listConnectors(companyCode), lawSourceState(companyCode), listChannels(companyCode)])
  const allowed = await Promise.all(connectors.map(c => connectorAllowed(companyCode, c.endpoint)))
  const mailboxes = channels.map(fromMailbox).filter((s): s is RegisteredSource => s !== null)
  return [
    {
      id: "library", kind: "file", adapter: null, name: t.ask.scopeLibrary,
      enabled: true, connected: true, allowed: true, defaultOn: true, accessLevel: "internal",
      uses: { retrieval: true, import: true, tools: false },
      href: "/library", detail: null,
    },
    ...mailboxes,
    ...connectors.map((c, i) => fromConnector(c, allowed[i])),
    {
      id: LAW_SOURCE_ID, kind: "web", adapter: SLOV_LEX_ADAPTER, name: t.ask.scopeLaw,
      enabled: law.actIds.length > 0, connected: true, allowed: law.allowed, defaultOn: law.defaultOn, accessLevel: "public",
      // Odber do knižnice je fáza 2 ADR-039 (D260).
      uses: { retrieval: true, import: false, tools: false },
      href: LAW_HREF, detail: law.actIds.length ? t.org.sources.actCount(law.actIds.length) : null,
    },
  ]
}

/**
 * Živé zdroje pre výber na Opýtať sa (D266): všetko okrem knižnice, čo je
 * zapnuté, pripojené, dovolené rezidenciou, vie hľadať a nepresahuje úroveň
 * pýtajúceho sa. Čistá funkcia — testuje sa bez databázy.
 */
export function liveSourcesFor(register: RegisteredSource[], accessLevel: "public" | "internal"): AskLiveSource[] {
  return register
    .filter(s => s.kind !== "file" && s.enabled && s.connected && s.allowed && s.uses.retrieval)
    .filter(s => accessLevel === "internal" || s.accessLevel === "public")
    .map(s => ({ id: s.id, name: s.name, defaultOn: s.defaultOn }))
}
