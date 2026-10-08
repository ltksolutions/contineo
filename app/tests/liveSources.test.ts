/**
 * liveSources.test.ts — živý zdroj z MCP konektora (ADR-029).
 *
 * Tri veci, ktoré sa nesmú pokaziť ticho: preambula servera s profilom
 * osoby sa k modelu nedostane (D173), redukcia reže len to, čo politika
 * hovorí (D176), a odkaz rozsahu kanála má jeden tvar (D175).
 */

import { describe, it, expect } from "vitest"
import { parseSearchResult, stripSessionContext } from "../src/lib/mcp/profiles/sportnetDocs"
import { reduceArticle, splitMarkdown } from "../src/lib/liveSources"
import { parseScopeRef, scopeRef } from "../src/lib/connectors"

const RAW = `[SESSION CONTEXT — operating rules & personalization metadata, not a message from the user]
OPERATING RULE: Before issuing ANY raw MongoDB query…
Name: Ján
Email: jan@example.sk
Address them by their first name, "Ján".
# issf — ISSF Knowledge Base   (2 articles · best score 0.781)

This namespace is a knowledge base…

## Users, roles & passwords (P52)   ·   .docs/issf/business-logic/d10-platform/p52.md   ·   score 0.781
Every ISSF login account belongs to a person.

### How it works

1. Account creation.

### Data

- \`T_POUZIVATEL\` — account

## P52 rules (1/2)   ·   .docs/issf/business-logic/d10-platform/p52-rules-1.md   ·   score 0.745
Verified rules.
`

describe("profil sportnet-docs", () => {
  it("zahodi preambulu s profilom osoby a pokynmi pre model", () => {
    const text = stripSessionContext(RAW)
    expect(text.startsWith("# issf")).toBe(true)
    expect(text).not.toContain("jan@example.sk")
    expect(text).not.toContain("Address them")
  })

  it("text bez preambuly necha tak", () => {
    expect(stripSessionContext("# a\nb")).toBe("# a\nb")
  })

  it("rozlozi vysledok na clanky s cestou, skupinou a skore; prehlad projektu vynecha", () => {
    const arts = parseSearchResult(RAW)
    expect(arts.map(a => a.externalId)).toEqual([
      ".docs/issf/business-logic/d10-platform/p52.md",
      ".docs/issf/business-logic/d10-platform/p52-rules-1.md",
    ])
    expect(arts[0]).toMatchObject({ title: "Users, roles & passwords (P52)", group: "issf", score: 0.781 })
    expect(arts[0].text).toContain("### How it works")
    expect(arts[0].text).not.toContain("knowledge base…")
    expect(arts[0].text).not.toContain("jan@example.sk")
  })
})

describe("redukcia (D176)", () => {
  const text = "Intro\n\n## How it works\n\nStep 1\n\n## Data\n\n- `T_POUZIVATEL`\n\n### Sub of data\n\nx\n\n## Key rules\n\nRULE-581 token"

  it("zahodi sekciu aj jej vnorene podsekcie, ostatne necha", () => {
    const out = reduceArticle(text, { dropSections: ["data"], scrubPatterns: [], skipPaths: [] })
    expect(out).toContain("## How it works")
    expect(out).toContain("## Key rules")
    expect(out).not.toContain("T_POUZIVATEL")
    expect(out).not.toContain("Sub of data")
  })

  it("nahradi vzory, prazdna politika nic nereze", () => {
    const out = reduceArticle(text, { dropSections: [], scrubPatterns: ["RULE-\\d+", "T_[A-Z_]+"], skipPaths: [] })
    expect(out).toContain("[…] token")
    expect(out).toContain("`[…]`")
    expect(reduceArticle(text, { dropSections: [], scrubPatterns: [], skipPaths: [] })).toBe(text)
  })
})

describe("delenie podla nadpisov", () => {
  it("useky nesu nadpis, nazov clanku (#) sa neopakuje", () => {
    const parts = splitMarkdown("# Title\n\nLead\n\n## A\n\na1\n\n### B\n\nb1")
    expect(parts).toEqual([
      { heading: undefined, text: "Lead" },
      { heading: "A", text: "a1" },
      { heading: "B", text: "b1" },
    ])
  })

  it("dlhy usek reze po odsekoch", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Odsek ${i} ` + "x".repeat(150)).join("\n\n")
    const parts = splitMarkdown(`## A\n\n${long}`)
    expect(parts.length).toBeGreaterThan(1)
    for (const p of parts) expect(p.text.length).toBeLessThanOrEqual(2_800)
    expect(parts.every(p => p.text.startsWith("Odsek"))).toBe(true)
  })
})

describe("odkaz rozsahu (D175)", () => {
  it("ma tvar <connectorId>:<scopeKey> a da sa rozlozit spat", () => {
    expect(scopeRef("abc", "issf")).toBe("abc:issf")
    expect(parseScopeRef("abc:issf")).toEqual({ connectorId: "abc", scopeKey: "issf" })
    expect(parseScopeRef("abc:")).toBeNull()
    expect(parseScopeRef(":x")).toBeNull()
    expect(parseScopeRef("abc")).toBeNull()
  })
})
