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
