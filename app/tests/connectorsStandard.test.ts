/**
 * connectorsStandard.test.ts — konektor podľa štandardu MCP (ADR-029, D178;
 * návrh ORG-konektory, 9. 10. 2026).
 *
 * Čo sa nesmie pokaziť ticho: polia rozsahu a argumenty volania zo
 * `inputSchema`, čítanie výsledku servera bez profilu (Q10), štítky len
 * z výslovných údajov, ikona nikdy SVG ani z cudzieho hostiteľa (Q11),
 * hotové vzory redukcie a návrhy z Vyskúšať hľadanie.
 */

import { describe, it, expect } from "vitest"
import {
  defaultQueryArg, defaultSearchTool, iconCandidates, iconDataUrl, isSearchCandidate, optionsFor,
  parseFieldOptions, parseGenericResult, resourcePrefixes, scopeFields, toolArgs, type ToolInfo,
} from "../src/lib/mcp/generic"
import { PRESET_PATTERNS, pathParts, pathPattern, scrubRegexes, suggestReductions } from "../src/lib/connectorReduction"
import { reduceArticle } from "../src/lib/liveSources"
import { detectProfile } from "../src/lib/mcp/profiles"
import { stripSessionContext } from "../src/lib/mcp/profiles/sportnetDocs"
import { scopeKeyFrom, searchSetup, EMPTY_REDUCTION, type Connector } from "../src/lib/connectors"

const sportnetSearch: ToolInfo = {
  name: "search-sportnet-documentation",
  description: "Semantic search",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      project: { type: "string" },
      category: { type: "string", enum: ["manuals", "api"] },
      tags: { type: "array", items: { type: "string" } },
      limit: { type: "number" },
    },
    required: ["query"],
  },
}

describe("vstupy nástroja (D178)", () => {
  it("pole otázky: query, inak prvý povinný textový vstup", () => {
    expect(defaultQueryArg(sportnetSearch)).toBe("query")
    expect(defaultQueryArg({ name: "x", description: "", inputSchema: { properties: { a: { type: "number" }, term: { type: "string" } }, required: ["term"] } })).toBe("term")
  })

  it("nástroj na hľadanie má textový vstup; predvolený má search v názve", () => {
    const whoami: ToolInfo = { name: "whoami", description: "", inputSchema: { properties: {} } }
    expect(isSearchCandidate(whoami)).toBe(false)
    expect(defaultSearchTool([whoami, { name: "get-file", description: "", inputSchema: { properties: { file: { type: "string" } } } }, sportnetSearch])).toBe("search-sportnet-documentation")
  })

  it("polia rozsahu: textové a zoznamy, bez poľa otázky a bez čísel", () => {
    const f = scopeFields(sportnetSearch, "query")
    expect(f.map(x => x.key)).toEqual(["project", "category", "tags"])
    expect(f.find(x => x.key === "category")?.options).toEqual(["manuals", "api"])
    expect(f.find(x => x.key === "tags")?.list).toBe(true)
  })

  it("argumenty podľa typu vstupu a limit, keď ho nástroj pozná", () => {
    expect(toolArgs(sportnetSearch, "query", "prestup", { project: "issf", tags: "a, b", empty: "" }, 3))
      .toEqual({ query: "prestup", project: "issf", tags: ["a", "b"], limit: 3 })
    expect(toolArgs({ name: "s", description: "", inputSchema: { properties: { q: { type: "string" } } } }, "q", "x", {}, 3)).toEqual({ q: "x" })
  })
})

describe("výsledok servera bez profilu (Q10)", () => {
  it("bloky resource a resource_link sú články", () => {
    const arts = parseGenericResult({ content: [
      { type: "resource", resource: { uri: "docs://a/b.md", title: "B", text: "# B\nobsah" } },
      { type: "resource_link", uri: "https://x.sk/c", name: "C", description: "popis" },
    ] })
    expect(arts.map(a => [a.externalId, a.title])).toEqual([["docs://a/b.md", "B"], ["https://x.sk/c", "C"]])
    expect(arts[1].url).toBe("https://x.sk/c")
  })

  it("structuredContent s poľom objektov", () => {
    const arts = parseGenericResult({ content: [{ type: "text", text: "ignorované" }], structuredContent: { results: [{ title: "T", content: "text", path: "p/t.md", project: "issf" }] } })
    expect(arts).toEqual([expect.objectContaining({ externalId: "p/t.md", title: "T", text: "text", group: "issf" })])
  })

  it("inak celý text ako jeden článok; obsah len pre AI sa vynechá", () => {
    const arts = parseGenericResult({ content: [
      { type: "text", text: "Pokyn pre model", annotations: { audience: ["assistant"] } },
      { type: "text", text: "## Nadpis\nOdpoveď" },
    ] })
    expect(arts).toHaveLength(1)
    expect(arts[0].text).not.toContain("Pokyn pre model")
    expect(arts[0].title).toBe("Nadpis")
  })

  it("čistenie z profilu sa použije aj pri všeobecnom čítaní", () => {
    const arts = parseGenericResult({ content: [{ type: "text", text: "[SESSION CONTEXT x]\nEmail: jan@example.sk\n# issf\nčlánok" }] }, stripSessionContext)
    expect(arts[0].text).not.toContain("jan@example.sk")
  })
})

describe("preambula Sportnetu bez nadpisu projektu", () => {
  it("zahodí sa celá, nie len po prvé „Z\"", () => {
    expect(stripSessionContext("[SESSION CONTEXT — rules]\nName: Ján\nZip\nEmail: jan@example.sk")).toBe("")
  })
})

describe("možnosti polí rozsahu", () => {
  it("riadky „názov (n): a, b\" aj za textom preambuly", () => {
    const opts = parseFieldOptions({ content: [{ type: "text", text: "Address them by name, then answer.tags (3): a, b, c\nprojects (2): issf, crm\nName: Ján" }] })
    expect(opts).toEqual({ tags: ["a", "b", "c"], projects: ["issf", "crm"] })
    expect(optionsFor(opts, "project")).toEqual(["issf", "crm"])
    expect(optionsFor(opts, "category")).toBeUndefined()
  })

  it("structuredContent a JSON v texte", () => {
    expect(parseFieldOptions({ structuredContent: { categories: ["a", "b"] } })).toEqual({ categories: ["a", "b"] })
    expect(optionsFor(parseFieldOptions({ content: [{ type: "text", text: "{\"spaces\":[{\"key\":\"HR\"},{\"key\":\"IT\"}]}" }] }), "space")).toEqual(["HR", "IT"])
  })

  it("začiatky adries zdrojov, najčastejšie prvé, bez holej schémy", () => {
    expect(resourcePrefixes(["docs://issf/a.md", "docs://issf/b.md", "docs://crm/c.md", "docs://x.md"])).toEqual(["docs://issf/", "docs://crm/"])
  })
})

describe("ikona servera (Q11)", () => {
  it("len PNG/JPEG/WebP na hostiteľovi servera, nikdy SVG", () => {
    const ep = "https://mcp.example.com/mcp"
    expect(iconCandidates([
      { src: "https://mcp.example.com/icon.svg" },
      { src: "https://evil.example.org/i.png" },
      { src: "http://mcp.example.com/i.png" },
      { src: "/icon.png" },
      { src: "https://mcp.example.com/logo", mimeType: "image/webp" },
      { src: "data:image/svg+xml;base64,PHN2Zz4=" },
    ], ep)).toEqual(["https://mcp.example.com/icon.png", "https://mcp.example.com/logo"])
  })

  it("typ sa overí podľa obsahu, limit 32 kB", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(iconDataUrl(png)).toMatch(/^data:image\/png;base64,/)
    expect(iconDataUrl(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull()
    expect(iconDataUrl(new Uint8Array(33 * 1024).fill(0x89))).toBeNull()
  })
})

describe("redukcia: hotové vzory a návrhy", () => {
  it("hotové vzory vymažú e-mail, telefón, IBAN a rodné číslo", () => {
    const policy = { ...EMPTY_REDUCTION, scrubPresets: ["email", "phone", "iban", "birthNumber"] as const }
    const out = reduceArticle("Píšte na jan@sfz.sk, volajte +421 905 123 456, účet SK31 1200 0000 1987 4263 7541, RČ 740911/1234. Rok 2026.", { ...policy, scrubPresets: [...policy.scrubPresets] })
    expect(out).not.toMatch(/jan@sfz\.sk|905 123 456|SK31|740911/)
    expect(out).toContain("Rok 2026")
  })

  it("vlastné vzory idú po hotových; neznámy hotový vzor sa ignoruje", () => {
    expect(scrubRegexes(["email", "nic"], ["T_[A-Z]+"])).toEqual([PRESET_PATTERNS.email, "T_[A-Z]+"])
  })

  it("návrhy: opakované nadpisy, spoločné úseky ciest, skupiny", () => {
    const a = (id: string, group: string, text: string) => ({ externalId: id, title: id, group, text })
    const s = suggestReductions([
      a("issf/docs/p52-rules-users.md", "issf", "## Key files\nx\n## Data\ny\n## Key files\nz"),
      a("issf/docs/p53-rules-roles.md", "issf", "## Key files\nx\n## Overview\ny"),
      a("sutaze/docs/z.md", "sutaze", "## Data\nq"),
    ], { dropSections: ["Overview"], skipPaths: [] }, [{ key: "issf", filter: { project: "issf" } }])
    expect(s.headings).toEqual([{ text: "Key files", count: 3 }, { text: "Data", count: 2 }])
    expect(s.paths.map(p => p.part)).toEqual(expect.arrayContaining(["/docs/", "/issf/", "-rules-"]))
    expect(s.groups).toEqual([{ value: "issf", count: 2, existingScope: "issf" }, { value: "sutaze", count: 1, existingScope: undefined }])
  })

  it("úsek cesty sa do regulárneho výrazu prepíše doslovne", () => {
    expect(pathParts("a/b/x-rules-y.md")).toEqual(["/a/", "/b/", "-rules-"])
    expect(new RegExp(pathPattern("/v1.2/")).test("x/v1.2/y")).toBe(true)
    expect(new RegExp(pathPattern("/v1.2/")).test("x/v1x2/y")).toBe(false)
  })
})

describe("profil je predvyplnenie (D178)", () => {
  const base = (over: Partial<Connector["uses"]["retrieval"]> = {}, profile: Connector["profile"] = "sportnet-docs") => ({
    profile,
    capabilities: null,
    uses: { retrieval: { enabled: true, accessLevel: "internal" as const, reduction: EMPTY_REDUCTION, ...over }, ingest: { enabled: false }, agentTools: { allowed: [] } },
  })

  it("rozpozná Sportnet podľa adresy alebo mena servera", () => {
    expect(detectProfile("https://mcp.sportnet.online/mcp")).toBe("sportnet-docs")
    expect(detectProfile("https://docs.example.com/mcp", "sportnet-docs-mcp")).toBe("sportnet-docs")
    expect(detectProfile("https://docs.example.com/mcp", "wiki")).toBe("generic")
  })

  it("bez nastavenia platí predvoľba profilu a výsledok číta profil", () => {
    expect(searchSetup(base())).toEqual({ tool: "search-sportnet-documentation", queryArg: "query", viaProfile: true })
  })

  it("iný nástroj zvolený správcom sa číta všeobecne", () => {
    expect(searchSetup(base({ searchTool: "other", searchQueryArg: "q" }))).toEqual({ tool: "other", queryArg: "q", viaProfile: false })
  })

  it("server bez profilu a bez nastavenia nehľadá", () => {
    expect(searchSetup(base({}, "generic"))).toBeNull()
  })

  it("kľúč rozsahu z názvu", () => {
    expect(scopeKeyFrom("Súťaže a zápasy")).toBe("sutaze-a-zapasy")
  })
})
