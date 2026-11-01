import { describe, it, expect } from "vitest"
import { canRewritePdf } from "../src/lib/llmRewrite"

describe("canRewritePdf — prepis skenu sa riadi pôvodným súborom", () => {
  it("pôvodné PDF sa prepísať dá", () => {
    expect(canRewritePdf({ type: "pdf" })).toBe(true)
  })

  it("koncept z Markdownu nie, hoci má vygenerované PDF", () => {
    // Skúšobný poriadok 1. 11. 2026: vľavo PDF konceptu, pôvodný súbor .md.
    expect(canRewritePdf({ type: "markdown" })).toBe(false)
  })

  it("bez pôvodného súboru nie", () => {
    expect(canRewritePdf(undefined)).toBe(false)
    expect(canRewritePdf(null)).toBe(false)
  })
})
