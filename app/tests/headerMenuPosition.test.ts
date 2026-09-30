/**
 * headerMenuPosition.test.ts — menu 9 bodiek visí pod tlačidlom (30. 9. 2026).
 *
 * `position: fixed; left: 10px` ho na širokom monitore otváralo stovky pixelov
 * vľavo od tlačidla, lebo hlavička je vycentrovaná. Rozloženie sa v testoch
 * nevykresľuje, preto sa stráži pravidlo samo.
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")

describe("menu v hlavičke", () => {
  it("kotví sa k riadku hlavičky, nie k oknu", () => {
    const rule = css.match(/\.sections\[open\] > \.sections-sheet \{([^}]*)\}/)?.[1] ?? ""
    expect(rule).toContain("position: absolute")
    expect(rule).not.toContain("position: fixed")
    expect(rule).toContain("max-width: calc(100% - 20px)")
  })

  it("riadok hlavičky je jeho kotva", () => {
    const row = css.match(/\.header-row \{([^}]*)\}/)?.[1] ?? ""
    expect(row).toContain("position: relative")
  })
})
