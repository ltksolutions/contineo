/**
 * securityHeaders.test.ts — hlavičky proti vloženiu do rámu (N4, ADR-011).
 *
 * **Prečo tento test existuje.** 30. 9. 2026 sa naostro ukázalo, že náhľad
 * PDF na karte dokumentu je prázdny: `frame-ancestors 'none'` platilo aj
 * pre `/api/documents/…/pdf` a Chrome ho uplatní aj na `<object>`. Stránky
 * vložiť nesmie nikto; PDF znenia smie vložiť len vlastná stránka.
 */
import { describe, it, expect } from "vitest"
import nextConfig from "../next.config.mjs"

type Rule = { source: string; headers: { key: string; value: string }[] }

/** Hodnota hlavičky pre adresu — neskoršie pravidlo prepíše skoršie ako v Nexte. */
function headerFor(rules: Rule[], path: string, key: string): string | undefined {
  let value: string | undefined
  for (const rule of rules) {
    const pattern = new RegExp(
      "^" + rule.source.replace(/:[a-zA-Z]+\*/g, ".*").replace(/:[a-zA-Z]+/g, "[^/]+") + "$",
    )
    if (!pattern.test(path)) continue
    for (const h of rule.headers) if (h.key === key) value = h.value
  }
  return value
}

describe("vloženie do rámu", async () => {
  const rules = (await nextConfig.headers!()) as Rule[]

  it("stránky nesmie vložiť nikto — ani potvrdenie dokumentu", () => {
    for (const path of ["/", "/documents/sfz%3Atest_znenia", "/approvals"]) {
      expect(headerFor(rules, path, "Content-Security-Policy")).toBe("frame-ancestors 'none'")
      expect(headerFor(rules, path, "X-Frame-Options")).toBe("DENY")
    }
  })

  it("PDF znenia smie vložiť vlastná stránka, cudzia nie", () => {
    const path = "/api/documents/sfz%3Atest_znenia/pdf"
    expect(headerFor(rules, path, "Content-Security-Policy")).toBe("frame-ancestors 'self'")
    expect(headerFor(rules, path, "X-Frame-Options")).toBe("SAMEORIGIN")
    expect(headerFor(rules, path, "X-Content-Type-Options")).toBe("nosniff")
  })

  it("ostatné API zostáva zamknuté", () => {
    expect(headerFor(rules, "/api/documents/sfz%3Atest_znenia", "X-Frame-Options")).toBe("DENY")
  })
})
