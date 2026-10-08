/**
 * widgetEmbed.test.ts — kód na vloženie widgetu a kontakt pri výpadku
 * (Ján 8. 10. 2026).
 */

import { describe, it, expect } from "vitest"
import { widgetEmbedCode, FALLBACK_ELEMENT_ID } from "../src/lib/widgetEmbed"
import { widgetFallbackContact } from "../src/lib/channels"
import { widgetScript } from "../src/lib/widgetScript"

const base = { host: "intranet.futbalsfz.sk", channelKey: "d9589242-8b85-4850-a10a-a30ebbbe8f18", fallbackText: "Pomocníka sa nepodarilo načítať. Napíšte na" }

describe("kód na vloženie", () => {
  it("skript z domény organizácie s kľúčom kanála a parametrami", () => {
    const code = widgetEmbedCode({ ...base, contact: "helpdesk@futbalsfz.sk" })
    expect(code).toContain('src="https://intranet.futbalsfz.sk/api/widget/d9589242-8b85-4850-a10a-a30ebbbe8f18/script"')
    expect(code).toContain("data-token=")
    expect(code).toContain('data-token-url="/api/contineo-token"')
    expect(code).toContain("defer></script>")
  })
  it("s kontaktom: skrytý náhradný blok a onerror, ktorý ho ukáže", () => {
    const code = widgetEmbedCode({ ...base, contact: "helpdesk@futbalsfz.sk" })
    expect(code).toContain(`<div id="${FALLBACK_ELEMENT_ID}" hidden>`)
    expect(code).toContain('<a href="mailto:helpdesk@futbalsfz.sk">helpdesk@futbalsfz.sk</a>')
    expect(code).toContain(`onerror="document.getElementById('${FALLBACK_ELEMENT_ID}').hidden=false"`)
  })
  it("bez kontaktu bez náhradného bloku", () => {
    const code = widgetEmbedCode({ ...base, contact: null })
    expect(code).not.toContain(FALLBACK_ELEMENT_ID)
    expect(code).not.toContain("onerror")
  })
  it("text sa escapuje", () => {
    expect(widgetEmbedCode({ ...base, fallbackText: "<b>x</b>", contact: "a@b.sk" })).toContain("&lt;b&gt;x&lt;/b&gt;")
  })
})

describe("popis v kóde", () => {
  it("komentár nad kódom s parametrami a tokenom, bez `--` vnútri", () => {
    const code = widgetEmbedCode({ ...base, contact: "a@b.sk", doc: {
      title: "Pomocník", params: [{ name: "src", text: "adresa -- nemeniť" }, { name: "data-token", text: "token" }],
      tokenHeading: "Token", token: "iss, aud",
    } })
    expect(code.startsWith("<!-- Pomocník")).toBe(true)
    expect(code).toContain("     src         adresa — nemeniť")
    expect(code).toContain("Token: iss, aud")
    const comment = code.slice(4, code.indexOf("-->"))
    expect(comment).not.toContain("--")
    expect(code.indexOf("-->")).toBeLessThan(code.indexOf("<div"))
  })
})

describe("kontakt pri výpadku", () => {
  it("kanál má prednosť, inak kontaktná adresa organizácie", () => {
    expect(widgetFallbackContact({ widget: { origins: [], rateLimitPerHour: 60, fallbackEmail: "kanal@x.sk" } }, "org@x.sk")).toBe("kanal@x.sk")
    expect(widgetFallbackContact({ widget: { origins: [], rateLimitPerHour: 60 } }, "org@x.sk")).toBe("org@x.sk")
    expect(widgetFallbackContact({ widget: { origins: [], rateLimitPerHour: 60 } }, undefined)).toBeNull()
  })
  it("widget nesie kontakt do chyby", () => {
    const js = widgetScript({ apiBase: "https://x", channel: "k", accent: "#000", texts: { contact: "Napíš:" }, language: "sk", contact: "org@x.sk" })
    expect(js).toContain('"contact":"org@x.sk"')
    expect(js).toContain("function contact()")
  })
})
