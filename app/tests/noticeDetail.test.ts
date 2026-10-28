/**
 * Nový tajný kľúč kanála je v oznamom okne, nie len na stránke pod ním.
 * „Rozumiem“ stránku načíta znova a kľúč sa ukazuje len raz — 28. 10. 2026
 * ho tak správca nevidel: bol pod ztmaveným pozadím a po potvrdení zmizol.
 */
import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Notice from "../src/components/Notice"

describe("Notice s hodnotou na skopírovanie", () => {
  it("ukáže hodnotu v okne oznamu", () => {
    const html = renderToStaticMarkup(createElement(Notice, { message: "Nový tajný kľúč", detail: "abc_123", back: "/x", language: "sk" }))
    expect(html).toContain('role="alertdialog"')
    expect(html).toMatch(/<code[^>]*>abc_123<\/code>/)
  })
  it("bez hodnoty je oznam ako doteraz", () => {
    const html = renderToStaticMarkup(createElement(Notice, { message: "Uložené.", back: "/x", language: "sk" }))
    expect(html).not.toContain("<code")
  })
})
