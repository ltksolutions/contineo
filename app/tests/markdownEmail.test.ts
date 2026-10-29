import { describe, it, expect } from "vitest"
import { markdownEmailHtml } from "../src/lib/markdownEmail"

describe("markdownEmailHtml — odpoveď na ticket ako HTML e-mail", () => {
  const html = markdownEmailHtml([
    "Dobrý deň,", "",
    "**Kto a ako podáva žiadosť**", "",
    "O preukaz môžete požiadať dvoma spôsobmi:", "",
    "1. **Cez klub** – po registrácii.",
    "2. Sám za seba.", "",
    "## Príloha", "- fotografia 600 × 800", "",
    "S pozdravom", "Helpdesk SFZ",
  ].join("\n"))

  it("bez značiek Markdownu: nadpisy, tučné, zoznamy", () => {
    expect(html).not.toMatch(/\*\*|##/)
    expect(html).toContain(">Kto a ako podáva žiadosť</p>")
    expect(html).toContain('<li value="1" style="margin:0 0 4px"><strong>Cez klub</strong> – po registrácii.</li>')
    expect(html).toContain("<ul ")
  })

  it("zalomenie v podpise ostane", () => {
    expect(html).toContain("S pozdravom<br>Helpdesk SFZ")
  })

  it("text sa escapuje a odkaz do intranetu ostane textom", () => {
    const h = markdownEmailHtml('<img src=x onerror="alert(1)"> a [Smernica](/library/x) & **<b>**')
    expect(h).not.toContain("<img")
    expect(h).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;")
    expect(h).not.toContain("/library/x")
    expect(h).toContain("<strong>&lt;b&gt;</strong>")
    expect(h).toContain("&amp;")
  })

  it("zoznam, ktorý nezačína jednotkou, má start — prevod na text value nečíta", () => {
    const out = markdownEmailHtml("1. Prvý\n\nMedzi tým.\n\n3. Tretí\n4. Štvrtý")
    expect(out).toContain('<ol style=')
    expect(out).toContain('<ol start="3" style=')
    expect(out).toContain('<li value="4"')
  })
})
