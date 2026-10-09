/**
 * Profil MCP servera (ADR-029, D173) — jediné miesto so znalosťou
 * konkrétneho servera: ktorý nástroj je „hľadaj", ako vyzerá jeho výsledok,
 * aké filtre pozná a čo z odpovede vyčistiť. Všetko ostatné je generické.
 */

export interface LiveArticle {
  /** Identifikátor na serveri (cesta k súboru, id stránky) — na odkaz a na import. */
  externalId: string
  title: string
  /** Skupina (projekt, priestor) — do citácie, aby bolo vidieť, odkiaľ článok je. */
  group?: string
  /** Čistý Markdown článku — už bez preambúl servera. */
  text: string
  url?: string
  score?: number
}

export interface McpToolCaller {
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>
}

/** Jedno pole filtra, ktoré profil ponúka v nastavení rozsahu (D175). */
export interface ProfileFilterField {
  key: string
  label: string
}

/**
 * Predvyplnenie pre známy server (D178): profil už nie je jediné miesto so
 * znalosťou servera, len navrhne, ktorý nástroj je hľadanie. Správca to na
 * detaile konektora môže zmeniť.
 */
export interface ProfileDefaults {
  searchTool?: string
  searchQueryArg?: string
  optionsTool?: string
}

export interface ServerProfile {
  key: string
  label: string
  /** Polia, z ktorých sa skladá rozsah; prázdne = server filtre nemá. */
  filterFields: ProfileFilterField[]
  /** Rozpoznanie servera podľa adresy alebo `serverInfo.name` — správca profil nevyberá (Q1). */
  matches?(endpoint: string, serverName?: string): boolean
  defaults?: ProfileDefaults
  /** Rozsah oprávnení OAuth, ktorý server potrebuje; inak ho povedia metadáta servera (Q12). */
  oauthScope?: string
  /** Čistenie textu odpovede (preambula servera) — platí aj pre všeobecné čítanie výsledku. */
  cleanText?(text: string): string
  /** Hľadanie vlastným rozkladom výsledku; bez neho sa výsledok číta všeobecne (`generic.ts`). */
  search?(client: McpToolCaller, query: string, filter: Record<string, string>, limit: number): Promise<LiveArticle[]>
  /** Celý článok podľa `externalId` — pre import (fáza 2); bez neho `resources/read`. */
  fetch?(client: McpToolCaller, externalId: string): Promise<LiveArticle | null>
}

/** Text z výsledku nástroja MCP — obsah typu `text`, spojený. */
export function textOf(result: unknown): string {
  const r = result as { content?: { type?: string; text?: string }[] } | null
  if (!r?.content) return typeof result === "string" ? result : ""
  return r.content.filter(c => c?.type === "text" && typeof c.text === "string").map(c => c.text as string).join("\n")
}
