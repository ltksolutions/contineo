/**
 * widgetEmbed.test.ts — kód na vloženie widgetu a kontakt pri výpadku
 * (Ján 8. 10. 2026).
 */

import { describe, it, expect } from "vitest"
import { widgetEmbedCode, FALLBACK_ELEMENT_ID, tokenPayloadLines, TOKEN_CLAIMS, javaTokenExample } from "../src/lib/widgetEmbed"
import { verifyWidgetToken } from "../src/lib/widgetToken"
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
      token: { heading: "Token", iss: "https://issf.futbalsfz.sk", aud: "kluc", levels: { required: "POVINNÉ", recommended: "odporúčané", optional: "nepovinné" }, claims: { iss: "pôvod" }, signing: ["HS256"] },
    } })
    expect(code.startsWith("<!-- Pomocník")).toBe(true)
    expect(code).toContain("     src         adresa — nemeniť")
    expect(code).toContain('"iss": "https://issf.futbalsfz.sk",')
    expect(code).toContain("// POVINNÉ — pôvod")
    expect(code).toContain("HS256")
    const comment = code.slice(4, code.indexOf("-->"))
    expect(comment).not.toContain("--")
    expect(code.indexOf("-->")).toBeLessThan(code.indexOf("<div"))
  })
})

describe("vzor tokenu", () => {
  const doc = { heading: "Token", iss: "https://issf.futbalsfz.sk", aud: "d958", levels: { required: "POVINNÉ", recommended: "odporúčané", optional: "nepovinné" } as const, claims: {}, signing: [] }
  it("je platný JSON po odstránení komentárov a nesie iss a aud kanála", () => {
    const json = tokenPayloadLines(doc).map(l => l.replace(/\s{2,}\/\/ .*$/, "")).join("\n")
    const payload = JSON.parse(json)
    expect(payload.iss).toBe("https://issf.futbalsfz.sk")
    expect(payload.aud).toBe("d958")
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(900)
  })
  it("povinné sú presne tie, ktoré server vyžaduje", () => {
    expect(TOKEN_CLAIMS.filter(c => c.level === "required").map(c => c.name).sort()).toEqual(["aud", "email", "exp", "iat", "iss", "sub"])
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

describe("vzor v Jave (ISSF, 26. 10. 2026)", () => {
  const ch = { key: "d9589242-8b85-4850-a10a-a30ebbbe8f18", secret: "skusobny-tajny-kluc-123", origins: ["https://issf.futbalsfz.sk"] }
  it("nesie iss a aud kanála a podpisuje HmacSHA256", () => {
    const java = javaTokenExample({ iss: ch.origins[0], aud: ch.key })
    expect(java).toContain('static final String ISSUER = "https://issf.futbalsfz.sk";')
    expect(java).toContain(`static final String CHANNEL_KEY = "${ch.key}";`)
    expect(java).toContain('Mac.getInstance("HmacSHA256")')
    expect(java).toContain("(iat + 900)")
    expect(java).toContain("Map<String, String> context")
  })
  // Token vydal práve tento kód (javac 16, kľúč `skusobny-tajny-kluc-123`) —
  // meno s diakritikou, úvodzovkami a spätnou lomkou, telefón a `context`
  // s úvodzovkami (ADR-042, D276). Údaje sú vymyslené. Pri zmene vzoru ho
  // treba vydať znova, inak test overuje starý kód.
  const fromJava = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2lzc2YuZnV0YmFsc2Z6LnNrIiwiYXVkIjoiZDk1ODkyNDItOGI4NS00ODUwLWExMGEtYTMwZWJiYmU4ZjE4Iiwic3ViIjoiMTIzNDU2NyIsImVtYWlsIjoiamFuLm5vdmFrQGV4YW1wbGUuc2siLCJnaXZlbl9uYW1lIjoiSsOhbiIsImZhbWlseV9uYW1lIjoiTm92w6FrIFwiSmFub1wiIFxcIHgiLCJyb2xlcyI6WyJrbHVib3bDvSBtYW5hxb7DqXIiXSwiY2x1YiI6Ik1GSyBCeXTEjWEiLCJsYW5nIjoic2siLCJwaG9uZV9udW1iZXIiOiIrNDIxOTAwMTIzNDU2IiwiY29udGV4dCI6eyJJRCBrbHVidSI6IjEyMzQiLCJadsOkenkiOiJPYkZaIFwiU2VuaWNhXCIifSwiaWF0IjoxNzkzMDU5NzcxLCJleHAiOjE3OTMwNjA2NzF9.MLP5EBbFiN8XFGL18KWENo4d4LxBe4t9Qp0zUtqSqg4"
  it("token z Javy Contineo prijme v čase vydania, s iným kľúčom nie", () => {
    const at = new Date(1793059771 * 1000)
    const id = verifyWidgetToken(fromJava, ch, at)
    expect(id).toMatchObject({ externalId: "1234567", familyName: 'Novák "Jano" \\ x', roles: ["klubový manažér"], club: "MFK Bytča", language: "sk", phone: "+421900123456" })
    expect(id.context).toEqual([{ label: "ID klubu", value: "1234" }, { label: "Zväzy", value: 'ObFZ "Senica"' }])
    expect(() => verifyWidgetToken(fromJava, { ...ch, secret: "iny" }, at)).toThrow()
  })
})
