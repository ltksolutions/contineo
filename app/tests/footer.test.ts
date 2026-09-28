/**
 * footer.test.ts — pätička nesie odkaz na informovanie o spracúvaní (C1)
 * v jazyku prostredia; je na každej stránke vrátane prihlásenia.
 */
import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Footer from "../src/components/Footer"

describe("pätička", () => {
  it("odkaz na /privacy v troch jazykoch", () => {
    expect(renderToStaticMarkup(createElement(Footer, { language: "sk" }))).toContain('href="/privacy">Ochrana osobných údajov<')
    expect(renderToStaticMarkup(createElement(Footer, { language: "cs" }))).toContain(">Ochrana osobních údajů<")
    expect(renderToStaticMarkup(createElement(Footer, { language: "en" }))).toContain(">Data protection<")
  })
})
