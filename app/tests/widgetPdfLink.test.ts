/**
 * widgetPdfLink.test.ts — podpísaný odkaz na PDF pre widget (KANAL-widget-strana).
 *
 * Adresa púšťa človeka bez prihlásenia k súboru, preto test stráži hlavne
 * to, čo sa s ňou **nesmie** dať urobiť: prepísať dokument, znenie alebo
 * kanál, použiť ju po platnosti alebo s kľúčom iného kanála.
 */

import { describe, expect, it } from "vitest"
import { PDF_LINK_DAYS, signPdfLink, verifyPdfLink, widgetPageLinks } from "../src/lib/widgetPdfLink"

const NOW = Date.UTC(2026, 10, 3, 12)
const SECRET = "kluc-kanala"
const claims = { channelKey: "issf", documentId: "sfz:pravidla", versionId: "v1", exp: Math.floor(NOW / 1000) + 3600 }

describe("verifyPdfLink", () => {
  const sig = signPdfLink(claims, SECRET)

  it("prijme vlastný podpis pred koncom platnosti", () => {
    expect(verifyPdfLink(claims, sig, SECRET, NOW)).toBe(true)
  })

  it("odmietne iný dokument, iné znenie a iný kanál", () => {
    expect(verifyPdfLink({ ...claims, documentId: "sfz:interna-smernica" }, sig, SECRET, NOW)).toBe(false)
    expect(verifyPdfLink({ ...claims, versionId: "v2" }, sig, SECRET, NOW)).toBe(false)
    expect(verifyPdfLink({ ...claims, channelKey: "iny" }, sig, SECRET, NOW)).toBe(false)
  })

  it("odmietne predĺženú platnosť aj podpis iným kľúčom", () => {
    expect(verifyPdfLink({ ...claims, exp: claims.exp + 86400 }, sig, SECRET, NOW)).toBe(false)
    expect(verifyPdfLink(claims, signPdfLink(claims, "iny-kluc"), SECRET, NOW)).toBe(false)
  })

  it("odmietne odkaz po platnosti a nezmyselné vstupy", () => {
    expect(verifyPdfLink(claims, sig, SECRET, (claims.exp + 1) * 1000)).toBe(false)
    expect(verifyPdfLink({ ...claims, exp: Number.NaN }, sig, SECRET, NOW)).toBe(false)
    expect(verifyPdfLink(claims, "", SECRET, NOW)).toBe(false)
    expect(verifyPdfLink(claims, "nie-je-podpis!", SECRET, NOW)).toBe(false)
  })
})

describe("widgetPageLinks", () => {
  const input = { apiBase: "https://intranet.futbalsfz.sk", channelKey: "issf", secret: SECRET, now: NOW }

  it("k zneniu so stranami dá PDF na strane schémy a náhľad tej istej strany", () => {
    const [link] = widgetPageLinks([{ documentId: "sfz:pravidla", versionId: "v1", pages: { from: 11, to: 11, figure: 12 } }], input)
    expect(link).toMatchObject({ page: 12, from: 11, to: 11, figure: true })
    const pdf = new URL(link!.pdf)
    expect(pdf.pathname).toBe("/api/widget/issf/pdf")
    expect(pdf.hash).toBe("#page=12")
    expect(link!.thumb.startsWith(link!.base + "&")).toBe(true)
    expect(link!.pdf.startsWith(link!.base + "#")).toBe(true)
    const thumb = new URL(link!.thumb)
    expect(thumb.searchParams.get("page")).toBe("12")
    const exp = Number(thumb.searchParams.get("e"))
    expect(exp).toBe(Math.floor(NOW / 1000) + PDF_LINK_DAYS * 86400)
    const c = { channelKey: "issf", documentId: thumb.searchParams.get("d")!, versionId: thumb.searchParams.get("v")!, exp }
    expect(verifyPdfLink(c, thumb.searchParams.get("s")!, SECRET, NOW)).toBe(true)
  })

  it("bez schémy cituje začiatok úseku", () => {
    const [link] = widgetPageLinks([{ documentId: "d", versionId: "v", pages: { from: 19, to: 20 } }], input)
    expect(link).toMatchObject({ page: 19, figure: false })
  })

  it("živý zdroj, zákon a úsek bez strán odkaz nedostanú, poradie ostáva", () => {
    const links = widgetPageLinks([
      { documentId: "d", versionId: "v", pages: { from: 1, to: 1 }, live: true },
      { documentId: "d", versionId: "v", pages: { from: 1, to: 1 }, law: { act: "x" } },
      { documentId: "d", versionId: "v" },
      { title: "overená odpoveď" },
      null,
      { documentId: "d", versionId: "v", pages: { from: 3, to: 3 } },
    ], input)
    expect(links.slice(0, 5)).toEqual([null, null, null, null, null])
    expect(links[5]?.page).toBe(3)
  })
})
