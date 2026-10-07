/**
 * Profil `sportnet-docs` — `mcp.sportnet.online` (ADR-029, D173).
 *
 * Server vracia na `search-sportnet-documentation` jeden textový blok:
 * pred ním **preambula „SESSION CONTEXT"** s profilom prihlásenej osoby
 * (meno, e-mail, dátum narodenia) a s pokynmi pre model. To je presne text,
 * ktorý sa k poskytovateľovi modelu dostať nesmie — zahadzuje sa tu, nie
 * až v prompte. Potom nasledujú projekty (`# projekt — názov (n articles ·
 * best score x)`), pod každým prehľad projektu a články
 * (`## Názov · cesta.md · score 0.78`). Vraciame len články; prehľad
 * projektu je ten istý text pri každom výsledku a nič k otázke nehovorí.
 */

import { textOf, type LiveArticle, type McpToolCaller, type ServerProfile } from "./types"

const PREAMBLE = /^\s*\[SESSION CONTEXT[^\]]*\][\s\S]*?(?=^# |\Z)/m

/** Zahodí preambulu servera; keď chýba, text sa nemení. */
export function stripSessionContext(text: string): string {
  return text.replace(PREAMBLE, "").trimStart()
}

const PROJECT_HEAD = /^# (\S+)\s+—\s+(.+?)\s+\((\d+) articles? · best score [\d.]+\)\s*$/
const ARTICLE_HEAD = /^## (.+?)\s+·\s+(\S+\.md)\s+·\s+score ([\d.]+)\s*$/

/** Rozklad výsledku hľadania na články. Exportované kvôli testom. */
export function parseSearchResult(raw: string): LiveArticle[] {
  const text = stripSessionContext(raw)
  const out: LiveArticle[] = []
  let group: string | undefined
  let current: LiveArticle | null = null
  const flush = () => { if (current) { current.text = current.text.trim(); if (current.text) out.push(current) } ; current = null }
  for (const line of text.split("\n")) {
    const p = line.match(PROJECT_HEAD)
    if (p) { flush(); group = p[1]; continue }
    const a = line.match(ARTICLE_HEAD)
    if (a) {
      flush()
      current = { externalId: a[2], title: a[1].trim(), group, text: "", score: Number(a[3]) }
      continue
    }
    if (current) current.text += line + "\n"
  }
  flush()
  return out
}

export const sportnetDocs: ServerProfile = {
  key: "sportnet-docs",
  label: "Sportnet — dokumentácia",
  filterFields: [
    { key: "project", label: "project" },
    { key: "category", label: "category" },
    { key: "tags", label: "tags" },
  ],
  async search(client: McpToolCaller, query: string, filter: Record<string, string>, limit: number) {
    const args: Record<string, unknown> = { query, limit: Math.max(1, Math.min(10, limit)) }
    if (filter.project) args.project = filter.project
    if (filter.category) args.category = filter.category
    if (filter.tags) args.tags = filter.tags.split(",").map(s => s.trim()).filter(Boolean)
    const result = await client.callTool("search-sportnet-documentation", args)
    return parseSearchResult(textOf(result))
  },
  async fetch(client: McpToolCaller, externalId: string) {
    const result = await client.callTool("get-documentation-file", { file: externalId })
    const text = stripSessionContext(textOf(result))
    if (!text) return null
    // Prvý riadok je `cesta — Názov`, článok začína nadpisom `# …`.
    const title = text.match(/^# (.+)$/m)?.[1]?.trim() ?? externalId
    const body = text.replace(/^[^\n]*\n/, "")
    return { externalId, title, text: body.trim(), group: externalId.split("/")[1] }
  },
}
