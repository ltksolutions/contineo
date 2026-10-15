import { describe, it, expect } from "vitest"
import { isExternalHref, splitExternal, externalLinksOf, hostOf, MAX_PREVIEWS } from "../src/lib/courierLinks"
import { isPrivateIp } from "../src/lib/safeFetch"
import { parseMeta } from "../src/lib/linkPreview"
import { toBlocks } from "../src/lib/formatText"
import { markdownToDoc, docToMarkdown } from "../src/lib/richText"

describe("odkazy von v Kuriéri (D222)", () => {
  it("len https s doménou, bez mena a hesla", () => {
    expect(isExternalHref("https://www.futbalnet.sk/clanok")).toBe(true)
    expect(isExternalHref("http://futbalnet.sk")).toBe(false)
    expect(isExternalHref("javascript:alert(1)")).toBe(false)
    expect(isExternalHref("https://user:pw@futbalnet.sk")).toBe(false)
    expect(isExternalHref("https://localhost")).toBe(false)
    expect(isExternalHref("/documents/x")).toBe(false)
  })

  it("rozklad a doména bez www", () => {
    expect(splitExternal("Pozri [článok](https://www.futbalnet.sk/a) dnes")).toEqual([
      { druh: "text", text: "Pozri " },
      { druh: "von", text: "článok", href: "https://www.futbalnet.sk/a", host: "futbalnet.sk" },
      { druh: "text", text: " dnes" },
    ])
    expect(hostOf("https://www.sfz.sk/x")).toBe("sfz.sk")
  })

  it("odkazy na náhľad: jedinečné, najviac tri", () => {
    const md = [1, 2, 3, 4, 1].map(n => `[a](https://s${n}.sk/)`).join(" ")
    expect(externalLinksOf(md)).toEqual(["https://s1.sk/", "https://s2.sk/", "https://s3.sk/"])
    expect(MAX_PREVIEWS).toBe(3)
  })

  it("spoločný rozklad (odpoveď asistenta) odkaz von nevyrobí — ostane text", () => {
    const blocks = toBlocks("Klik [sem](https://zly.web/x)")
    expect(blocks[0]).toEqual({ druh: "odsek", segments: [{ druh: "text", text: "Klik [sem](https://zly.web/x)" }] })
  })

  it("editor: odkaz von prežije cestu tam a späť", () => {
    const md = "Pozri [článok](https://futbalnet.sk/a) a [poriadok](/documents/x)."
    expect(docToMarkdown(markdownToDoc(md))).toBe(md)
  })
})

describe("stráž pred vnútornou sieťou (SSRF)", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1",
    "::1", "::", "fc00::1", "fd12::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "nie-ip"])("%s je zakázaná", ip => {
    expect(isPrivateIp(ip)).toBe(true)
  })
  it.each(["8.8.8.8", "172.32.0.1", "185.1.2.3", "2a00:1450:4001::1"])("%s je verejná", ip => {
    expect(isPrivateIp(ip)).toBe(false)
  })
})

describe("náhľad z hlavičky stránky", () => {
  it("Open Graph má prednosť, entity sa dekódujú, obrázok je absolútny", () => {
    const html = `<html><head><title>Záložný</title>
      <meta property="og:title" content="Nový &amp; lepší rozpis">
      <meta name="description" content="Popis zo stránky">
      <meta property="og:site_name" content='Futbalnet'>
      <meta property="og:image" content="/img/a.jpg"></head><body><meta property="og:title" content="z tela"></body></html>`
    expect(parseMeta(html, "https://futbalnet.sk/clanok")).toEqual({
      title: "Nový & lepší rozpis", description: "Popis zo stránky", siteName: "Futbalnet", image: "https://futbalnet.sk/img/a.jpg",
    })
  })
  it("bez OG záložne <title>; obrázok cez http sa zahodí", () => {
    const m = parseMeta(`<head><title>Len titulok</title><meta property="og:image" content="http://x.sk/a.png"></head>`, "https://x.sk/")
    expect(m.title).toBe("Len titulok")
    expect(m.image).toBe("")
  })
})
