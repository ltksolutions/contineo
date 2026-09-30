/**
 * pdfView.test.ts — PDF znenia po stranách (ADR-011, rozhodnutie 30. 9. 2026).
 *
 * Samotné kreslenie strán beží len v prehliadači (pdf.js, plátno). Tu sa
 * overuje to, čo sa overiť dá bez neho: počty rozmeru plátna, popis strany
 * a to, že stránka zo servera nesie odkaz na PDF — bez JavaScriptu alebo pri
 * chybe pdf.js je to jediná cesta k textu, ktorý človek potvrdzuje.
 */
import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import PdfView from "../src/components/PdfView"
import { MAX_CANVAS_PIXELS, MAX_OUTPUT_SCALE, pageLabel, pageRenderSize } from "../src/lib/pdfPages"
import { DICTIONARY, UI_LANGUAGES } from "../src/lib/i18n"

// A4 v bodoch PDF.
const A4 = { w: 595.28, h: 841.89 }

describe("rozmer plátna strany", () => {
  it("strana sa roztiahne na šírku kontajnera a drží pomer strán", () => {
    const s = pageRenderSize(A4.w, A4.h, 360, 1)!
    expect(s.cssWidth).toBe(360)
    expect(s.cssHeight).toBe(Math.round((360 * A4.h) / A4.w))
    expect(s.pixelWidth).toBe(360)
    expect(s.viewportScale).toBeCloseTo(360 / A4.w)
  })

  it("hustota displeja zväčší plátno, nie stranu na stránke", () => {
    const s = pageRenderSize(A4.w, A4.h, 360, 3)!
    expect(s.cssWidth).toBe(360)
    expect(s.pixelWidth).toBe(1080)
    expect(s.pixelHeight).toBe(Math.floor(A4.h * s.viewportScale))
  })

  it("hustota sa zhora aj zdola orezáva", () => {
    expect(pageRenderSize(A4.w, A4.h, 300, 5)!.pixelWidth).toBe(300 * MAX_OUTPUT_SCALE)
    expect(pageRenderSize(A4.w, A4.h, 300, 0.5)!.pixelWidth).toBe(300)
    expect(pageRenderSize(A4.w, A4.h, 300, 0)!.pixelWidth).toBe(300)
  })

  it("veľké plátno sa zmestí pod strop pixelov (iOS by ho nevykreslil)", () => {
    const s = pageRenderSize(A4.w, A4.h, 1600, 3)!
    expect(s.pixelWidth * s.pixelHeight).toBeLessThanOrEqual(MAX_CANVAS_PIXELS)
    expect(s.cssWidth).toBe(1600)
    // Aj pod stropom zostáva aspoň pôvodná hustota, ak sa zmestí.
    expect(s.pixelWidth).toBeGreaterThanOrEqual(1600)
  })

  it("strana na šírku (otočená) má nižšie plátno než vyššie", () => {
    const s = pageRenderSize(A4.h, A4.w, 400, 1)!
    expect(s.cssHeight).toBeLessThan(s.cssWidth)
  })

  it("nulový alebo chýbajúci rozmer nevykreslí nič", () => {
    expect(pageRenderSize(A4.w, A4.h, 0, 2)).toBeNull()
    expect(pageRenderSize(0, A4.h, 300, 2)).toBeNull()
    expect(pageRenderSize(A4.w, Number.NaN, 300, 2)).toBeNull()
  })
})

describe("popis strany", () => {
  it("vzor zo slovníka dostane číslo strany a počet", () => {
    expect(pageLabel(DICTIONARY.sk.common.pdf.page, 3, 12)).toBe("Strana 3 z 12")
    expect(pageLabel(DICTIONARY.en.common.pdf.page, 1, 2)).toBe("Page 1 of 2")
  })

  it("každý jazyk má v popise strany obe miesta", () => {
    for (const language of UI_LANGUAGES) {
      const template = DICTIONARY[language].common.pdf.page
      expect(template, language).toContain("{page}")
      expect(template, language).toContain("{pages}")
    }
  })
})

describe("PdfView zo servera", () => {
  const href = "/api/documents/D1/pdf?version=v2"
  const html = renderToStaticMarkup(
    createElement(PdfView, {
      href,
      name: "smernica.pdf",
      bytes: 1_300_000,
      labels: { open: "Otvoriť PDF", ...DICTIONARY.sk.common.pdf },
    }),
  )

  it("nesie odkaz na PDF (dlaždica aj tlačidlo) bez JavaScriptu", () => {
    const links = html.match(/<a [^>]*href="\/api\/documents\/D1\/pdf\?version=v2"/g) ?? []
    expect(links.length).toBe(2)
    expect(html).toContain("Otvoriť PDF")
    expect(html).toContain("smernica.pdf · 1.2 MB")
  })

  it("bez JavaScriptu neukazuje „Načítavam\", ktoré by tam ostalo navždy", () => {
    expect(html).not.toContain(DICTIONARY.sk.common.pdf.loading)
    expect(html).toContain('class="pdf-pages"')
  })

  it("už nevkladá PDF cez <object> (iOS ukazoval len prvú stranu)", () => {
    expect(html).not.toContain("<object")
  })
})
