/**
 * mcpServer.test.ts — Contineo ako MCP server, fáza 1 (ADR-038).
 *
 * Zoznam nástrojov je prienik rozsahu tokenu a rolí osoby (D249); zapnutie
 * obmedzuje rezidencia (D251); „len verejný obsah" zužuje úroveň aj zoznam
 * dokumentov (D252); bežný člen vidí len dokumenty s platným znením.
 */

import { describe, it, expect } from "vitest"
import { TOOL_CATALOG, toolsFor, visibleRows, toHit } from "../src/lib/mcpServer/tools"
import { assistantsState, mcpAccessLevel } from "../src/lib/mcpServer/access"
import { bearerToken, originOf } from "../src/lib/mcpServer/origin"
import type { LibraryRow } from "../src/lib/libraryRead"
import { searchableSources, pickSources } from "../src/lib/mcpServer/sources"
import { pickLawVersion } from "../src/lib/mcpServer/law"
import type { RegisteredSource } from "../src/lib/sourcesRegister"

describe("zoznam nástrojov podľa rozsahu a rolí (D249)", () => {
  it("bez rozsahov len whoami", () => expect(toolsFor([])).toEqual(["whoami"]))
  it("library.read dáva čítanie, nie ask", () => {
    const tools = toolsFor(["library.read"])
    expect(tools).toContain("search_library")
    expect(tools).toContain("get_document")
    expect(tools).not.toContain("ask")
  })
  it("ask bez library.read dáva len ask a whoami", () => expect(toolsFor(["ask"])).toEqual(["whoami", "ask"]))
  it("každý nástroj katalógu má rozsah alebo je voľný", () => {
    for (const t of TOOL_CATALOG) expect(t.scope === null || typeof t.scope === "string").toBe(true)
  })
})

describe("zapnutie a rezidencia (D251)", () => {
  it("predvolene vypnuté", () => expect(assistantsState({}, "eu-data").active).toBe(false))
  it("zapnuté v global a eu-data bez poznámky", () => {
    expect(assistantsState({ assistants: { enabled: true } }, "global").active).toBe(true)
    const s = assistantsState({ assistants: { enabled: true } }, "eu-data")
    expect(s.active).toBe(true)
    expect(s.note).toBe(false)
  })
  it("eu-full s poznámkou", () => expect(assistantsState({ assistants: { enabled: true } }, "eu-full").note).toBe(true))
  it("on-prem a air-gap sa zapnúť nedajú, aj keď prepínač hovorí áno", () => {
    for (const r of ["on-prem", "air-gap"] as const) {
      const s = assistantsState({ assistants: { enabled: true } }, r)
      expect(s.allowed).toBe(false)
      expect(s.active).toBe(false)
    }
  })
})

describe("len verejný obsah (D252)", () => {
  const rows = [
    { documentId: "a", title: "Stanovy", accessLevel: "public", status: "published", effectiveFrom: new Date("2026-01-01"), effectiveTo: null, archived: false, tags: [], parentIds: [], versionCount: 1, effectiveLabel: "1.0", processingState: "indexed", hasDraft: false },
    { documentId: "b", title: "Interná smernica", accessLevel: "internal", status: "published", effectiveFrom: new Date("2026-01-01"), effectiveTo: null, archived: false, tags: [], parentIds: [], versionCount: 1, effectiveLabel: "1.0", processingState: "indexed", hasDraft: false },
    { documentId: "c", title: "Koncept", accessLevel: "public", status: "draft", effectiveFrom: null, effectiveTo: null, archived: false, tags: [], parentIds: [], versionCount: 0, effectiveLabel: "—", processingState: "indexed", hasDraft: true },
    { documentId: "d", title: "Archív", accessLevel: "public", status: "published", effectiveFrom: new Date("2020-01-01"), effectiveTo: null, archived: true, tags: [], parentIds: [], versionCount: 1, effectiveLabel: "1.0", processingState: "indexed", hasDraft: false },
  ] as unknown as LibraryRow[]

  it("úroveň je internal, kým správca nezapne len verejný obsah", () => {
    expect(mcpAccessLevel({ publicOnly: false })).toBe("internal")
    expect(mcpAccessLevel({ publicOnly: true })).toBe("public")
  })
  it("bežný člen vidí len dokumenty s platným znením, bez archívu", () => {
    expect(visibleRows(rows, { accessLevel: "internal", roles: [] }, false).map(r => r.documentId)).toEqual(["a", "b"])
  })
  it("verejná úroveň schová interný dokument", () => {
    expect(visibleRows(rows, { accessLevel: "public", roles: [] }, false).map(r => r.documentId)).toEqual(["a"])
  })
  it("správca obsahu s includeDrafts vidí aj koncept a archív", () => {
    expect(visibleRows(rows, { accessLevel: "internal", roles: ["content-admin"] }, true).map(r => r.documentId)).toEqual(["a", "b", "c", "d"])
  })
  it("includeDrafts bez roly nič nepridá", () => {
    expect(visibleRows(rows, { accessLevel: "internal", roles: [] }, true).map(r => r.documentId)).toEqual(["a", "b"])
  })
})

describe("výsledok hľadania", () => {
  it("nesie dokument, článok, znenie a adresu na portáli", () => {
    const hit = toHit({
      _id: "x", text: "Text článku", documentId: "sfz:stanovy", articleRef: "čl. 5", heading: "Členstvo",
      document: { title: "Stanovy SFZ", slug: "stanovy", category: "stanovy" },
      version: { label: "2026", effectiveFrom: new Date("2026-03-01T00:00:00Z"), effectiveTo: null },
    }, "https://intranet.futbalsfz.sk")
    expect(hit.title).toBe("Stanovy SFZ")
    expect(hit.versionLabel).toBe("2026")
    expect(hit.effectiveFrom).toBe("2026-03-01")
    expect(hit.url).toBe("https://intranet.futbalsfz.sk/documents/sfz%3Astanovy")
  })
})

describe("pôvod a token z požiadavky", () => {
  it("za proxy rozhoduje x-forwarded-host", () => {
    const req = new Request("http://internal:3000/mcp", { headers: { "x-forwarded-host": "intranet.futbalsfz.sk", "x-forwarded-proto": "https" } })
    expect(originOf(req)).toBe("https://intranet.futbalsfz.sk")
  })
  it("localhost je http", () => {
    expect(originOf(new Request("http://localhost:3000/mcp", { headers: { host: "localhost:3000" } }))).toBe("http://localhost:3000")
  })
  it("Bearer token sa vyberie, iné schémy nie", () => {
    expect(bearerToken(new Request("http://x/mcp", { headers: { authorization: "Bearer cnt_a_abc" } }))).toBe("cnt_a_abc")
    expect(bearerToken(new Request("http://x/mcp", { headers: { authorization: "Basic abc" } }))).toBe(null)
    expect(bearerToken(new Request("http://x/mcp"))).toBe(null)
  })
})

describe("zdroje z registra (ADR-040 D266)", () => {
  const base = { adapter: null, connected: true, allowed: true, defaultOn: false, href: "", detail: null }
  const register: RegisteredSource[] = [
    { ...base, id: "library", kind: "file", name: "Knižnica", enabled: true, defaultOn: true, accessLevel: "internal", uses: { retrieval: true, import: true, tools: false } },
    { ...base, id: "mbx", kind: "mailbox", name: "Helpdesk", enabled: true, accessLevel: "internal", uses: { retrieval: false, import: true, tools: false } },
    { ...base, id: "c1", kind: "mcp", name: "Sportnet", enabled: true, accessLevel: "internal", uses: { retrieval: true, import: true, tools: false } },
    { ...base, id: "c2", kind: "mcp", name: "Odpojený", enabled: true, connected: false, accessLevel: "public", uses: { retrieval: true, import: true, tools: false } },
    { ...base, id: "law", kind: "web", adapter: "slov-lex", name: "Legislatíva", enabled: true, accessLevel: "public", uses: { retrieval: true, import: false, tools: false } },
  ]

  it("knižnica, Legislatíva a pripojený konektor; schránka a odpojený nie", () => {
    expect(searchableSources(register, "internal").map(s => s.id)).toEqual(["library", "c1", "law"])
  })
  it("len verejný obsah schová interný konektor, knižnica ostáva", () => {
    expect(searchableSources(register, "public").map(s => s.id)).toEqual(["library", "law"])
  })
  it("Legislatíva bez odberu sa neponúkne", () => {
    const off = register.map(s => s.id === "law" ? { ...s, enabled: false } : s)
    expect(searchableSources(off, "internal").map(s => s.id)).toEqual(["library", "c1"])
  })
  it("výber: bez žiadosti predvolene knižnica, neznámy zdroj je chyba", () => {
    const allowed = searchableSources(register, "internal")
    expect(pickSources(undefined, allowed, ["library"]).picked.map(s => s.id)).toEqual(["library"])
    expect(pickSources(["law", "law"], allowed, ["library"]).picked.map(s => s.id)).toEqual(["law"])
    expect(pickSources(["library", "c2"], allowed, ["library"]).unknown).toEqual(["c2"])
  })
})

describe("výsledok hľadania podľa pôvodu", () => {
  it("Legislatíva vedie na Slov-Lex a nesie zdroj law", () => {
    const hit = toHit({
      _id: "x", text: "§ 3", documentId: "law:SK/ZZ/2015/440", articleRef: "§ 3", sourceType: "law",
      document: { title: "Zákon o športe", slug: "", sourceUrl: "https://www.slov-lex.sk/x", category: "law" },
      law: { actId: "SK/ZZ/2015/440", number: "440/2015", timepoint: "20260101", url: "https://www.slov-lex.sk/ezbierky/pravne-predpisy/SK/ZZ/2015/440/20260101#paragraf-3" },
    }, "https://intranet.futbalsfz.sk")
    expect(hit.source).toBe("law")
    expect(hit.url).toContain("slov-lex.sk")
  })
  it("konektor vedie na svoj server a nesie id konektora", () => {
    const hit = toHit({
      _id: "y", text: "ISSF", documentId: "live:c1:doc", sourceType: "mcp",
      document: { title: "Manuál", slug: "", sourceUrl: "https://docs.sportnet.online/x", category: "live" },
      live: { connectorId: "c1", connectorName: "Sportnet", externalId: "doc" },
    }, "https://intranet.futbalsfz.sk")
    expect(hit.source).toBe("c1")
    expect(hit.url).toBe("https://docs.sportnet.online/x")
  })
  it("knižnica ostáva na portáli", () => {
    expect(toHit({ _id: "z", text: "t", documentId: "sfz:stanovy" }, "https://intranet.futbalsfz.sk").source).toBe("library")
  })
})

describe("nové nástroje potrebujú library.read", () => {
  it("list_sources, list_law_acts a get_law_act s library.read, bez neho nie", () => {
    expect(toolsFor(["library.read"])).toEqual(expect.arrayContaining(["list_sources", "list_law_acts", "get_law_act"]))
    expect(toolsFor(["ask"])).not.toContain("list_sources")
  })
})

describe("znenie predpisu (ADR-039)", () => {
  const v = (timepoint: string, from: string, to: string | null) => ({
    actId: "SK/ZZ/2015/440", timepoint, effectiveFrom: new Date(`${from}T00:00:00Z`), effectiveTo: to ? new Date(`${to}T00:00:00Z`) : null,
  })
  const versions = [v("20250101", "2025-01-01", "2025-12-31"), v("20260101", "2026-01-01", null), v("20270101", "2027-01-01", null)]

  it("k dňu vyberie znenie účinné vtedy", () => {
    expect(pickLawVersion(versions, new Date("2025-06-01T12:00:00Z"))?.timepoint).toBe("20250101")
    expect(pickLawVersion(versions, new Date("2026-10-25T12:00:00Z"))?.timepoint).toBe("20260101")
  })
  it("konkrétna časová verzia má prednosť pred dňom", () => {
    expect(pickLawVersion(versions, new Date("2026-10-25T12:00:00Z"), "20270101")?.timepoint).toBe("20270101")
    expect(pickLawVersion(versions, new Date(), "19990101")).toBe(null)
  })
})
