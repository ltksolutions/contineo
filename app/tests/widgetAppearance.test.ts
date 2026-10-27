/**
 * widgetAppearance.test.ts — vzhľad a správanie widgetu z nastavenia kanála
 * (ADR-042, Dodatok 1, D281–D284).
 */

import { describe, it, expect, vi } from "vitest"
import { widgetAppearance, appearanceForScript, normalizePhrase, DEFAULT_WIDGET_APPEARANCE, DEFAULT_PHRASES, WIDGET_POSITIONS } from "../src/lib/widgetAppearance"
import { widgetScript, anchorCss } from "../src/lib/widgetScript"

const SECRET = "skusobny-kluc"
vi.mock("../src/lib/channels", () => ({ widgetSecret: (c: { widget: { secretEnc?: string } }) => (c.widget.secretEnc ? SECRET : null) }))
const { previewToken, previewSubject } = await import("../src/lib/widgetPreview")
const { verifyWidgetToken } = await import("../src/lib/widgetToken")

describe("widgetAppearance", () => {
  it("predvolene vpravo v strede, stredný panel, helpdesk po dvoch neúspechoch (D282, D275)", () => {
    expect(widgetAppearance(undefined)).toEqual(DEFAULT_WIDGET_APPEARANCE)
    expect(DEFAULT_WIDGET_APPEARANCE).toMatchObject({ position: "right-middle", size: "m", escalateAfter: 2 })
  })
  it("osem miest okolo obrazovky", () => {
    expect(WIDGET_POSITIONS).toHaveLength(8)
  })
  it("neznáma hodnota padá na predvolenú, nie na chybu", () => {
    expect(widgetAppearance({ position: "stred", size: "xl", escalateAfter: 7 })).toMatchObject({ position: "right-middle", size: "m", escalateAfter: 2 })
    expect(widgetAppearance({ position: "right-top", size: "l", escalateAfter: "3" })).toMatchObject({ position: "right-top", size: "l", escalateAfter: 3 })
  })
  it("texty: len jazyky rozhrania, orezané, prázdne vynechané, so stropom", () => {
    const a = widgetAppearance({ launcher: { sk: "  Pomoc  ", cs: "", de: "Hilfe", en: "x".repeat(60) }, greeting: { sk: "Dobrý deň,\r\nako pomôžem?" } })
    expect(a.launcher).toEqual({ sk: "Pomoc", en: "x".repeat(40) })
    expect(a.greeting).toEqual({ sk: "Dobrý deň,\nako pomôžem?" })
  })
  it("pre skript texty jedného jazyka; chýbajúci = prázdny (predvolený text)", () => {
    const a = widgetAppearance({ launcher: { sk: "Pomoc" } })
    expect(appearanceForScript(a, "sk").launcher).toBe("Pomoc")
    expect(appearanceForScript(a, "en").launcher).toBe("")
  })
})

describe("ponuka správy helpdesku (D275, D283)", () => {
  it("predvolene odkaz zapnutý a predvolené frázy; staršie kanály bez poľa tiež", () => {
    expect(DEFAULT_WIDGET_APPEARANCE).toMatchObject({ offerLink: true, phrases: {} })
    expect(widgetAppearance({ position: "top" }).offerLink).toBe(true)
    expect(widgetAppearance({ offerLink: false }).offerLink).toBe(false)
  })
  it("frázy: len jazyky rozhrania, bez prázdnych a duplicít, so stropom", () => {
    const a = widgetAppearance({ phrases: { sk: ["  chcem   človeka ", "", "chcem človeka", 7], de: ["Mensch"], cs: Array.from({ length: 30 }, (_, i) => `f${i}`) } })
    expect(a.phrases.sk).toEqual(["chcem človeka"])
    expect(a.phrases.cs).toHaveLength(20)
    expect(a.phrases).not.toHaveProperty("de")
  })
  it("porovnáva sa bez diakritiky a veľkých písmen", () => {
    expect(normalizePhrase("  Spojiť sa  s ČLOVEKOM ")).toBe("spojit sa s clovekom")
  })
  it("predvolené jadrá zachytia ohnuté tvary a iný slovosled", () => {
    const hit = (q: string) => appearanceForScript(DEFAULT_WIDGET_APPEARANCE, "sk").phrases.some(p => normalizePhrase(q).includes(p))
    expect(hit("Chcem sa SPOJIŤ s clovekom prosím")).toBe(true)
    expect(hit("Ako napíšem helpdesku?")).toBe(true)
    expect(hit("Chci mluvit s člověkem")).toBe(true)
    expect(hit("Ako zmením heslo?")).toBe(false)
  })
  it("skript dostane frázy všetkých jazykov; nastavený jazyk nahradí predvolené", () => {
    const def = appearanceForScript(DEFAULT_WIDGET_APPEARANCE, "sk")
    expect(def.phrases).toContain(normalizePhrase(DEFAULT_PHRASES.sk[0]))
    expect(def.phrases).toContain(normalizePhrase(DEFAULT_PHRASES.en[0]))
    const own = appearanceForScript(widgetAppearance({ phrases: { sk: ["Zavolajte mi"] } }), "cs")
    expect(own.phrases).toContain("zavolajte mi")
    expect(own.phrases).not.toContain(normalizePhrase(DEFAULT_PHRASES.sk[1]))
    expect(own.phrases).toContain(normalizePhrase(DEFAULT_PHRASES.cs[1]))
  })
})

describe("skript widgetu podľa nastavenia", () => {
  const base = { apiBase: "https://intranet.futbalsfz.sk", channel: "k", accent: "#123456", texts: { open: "Opýtať sa" }, language: "sk", contact: null }
  it("ukotvenie: rohy odstupom, stredy strán posunom", () => {
    expect(anchorCss("left-middle")).toBe("left:16px;top:50%;transform:translateY(-50%)")
    expect(anchorCss("top")).toBe("left:50%;top:16px;transform:translateX(-50%)")
    expect(anchorCss("right-bottom")).toBe("right:16px;bottom:16px;transform:none")
  })
  it("bez nastavenia vpravo v strede so stredným panelom", () => {
    const js = widgetScript(base)
    expect(js).toContain(".fab{position:fixed;right:16px;top:50%;transform:translateY(-50%);")
    expect(js).toContain("width:min(400px,calc(100vw - 32px));height:min(600px,calc(100vh - 32px))")
  })
  it("poloha, veľkosť, text tlačidla, privítanie a prah idú do skriptu", () => {
    const look = appearanceForScript(widgetAppearance({ position: "right-top", size: "l", escalateAfter: 1, launcher: { sk: "Pomoc" }, greeting: { sk: "Ahoj" } }), "sk")
    const js = widgetScript({ ...base, appearance: look })
    expect(js).toContain(".panel{position:fixed;right:16px;top:16px;transform:none;")
    expect(js).toContain("width:min(480px,calc(100vw - 32px));height:min(720px,calc(100vh - 32px))")
    expect(js).toContain('"appearance":{"position":"right-top","size":"l","escalateAfter":1,"launcher":"Pomoc","greeting":"Ahoj","offerLink":true,')
    expect(js).toContain("negatives>=LOOK.escalateAfter")
    expect(js).not.toContain("negatives>=2")
  })
  it("je platný JavaScript a ponúka ContineoHelpdesk.open() (D285)", () => {
    const js = widgetScript({ ...base, appearance: appearanceForScript(DEFAULT_WIDGET_APPEARANCE, "sk") })
    expect(() => new Function(js)).not.toThrow()
    expect(js).toContain("window.ContineoHelpdesk={open:function(){openPanel();return true}}")
    // Regulárny výraz diakritiky musí do prehliadača prísť ako únik, nie zlomený.
    expect(js).toContain("replace(/[\\u0300-\\u036f]/g,'')")
  })
  it("na telefóne celá obrazovka bez ohľadu na polohu", () => {
    expect(widgetScript(base)).toContain("@media (max-width:640px){.panel{top:0;right:0;bottom:0;left:0;transform:none;width:100vw;height:100vh;border-radius:0}}")
  })
})

describe("náhľad widgetu (D284)", () => {
  const person = { id: "p1", email: "jan@futbalsfz.sk", fullName: "Ján Správca", givenName: "Ján", surname: "Správca", language: "sk" as const }
  const channel = (over: Record<string, unknown> = {}) => ({ key: "kanal", kind: "widget", widget: { origins: ["https://issf.futbalsfz.sk"], rateLimitPerHour: 60, secretEnc: "x", ...over } }) as never
  it("token prejde overením ako token cudzieho systému, so správcom a prvým pôvodom", () => {
    const r = previewToken(channel(), person)
    if (!("token" in r)) throw new Error("bez tokenu")
    const id = verifyWidgetToken(r.token, { key: "kanal", secret: SECRET, origins: ["https://issf.futbalsfz.sk"] })
    expect(id).toMatchObject({ externalId: previewSubject(person), email: "jan@futbalsfz.sk", name: "Ján Správca", issuer: "https://issf.futbalsfz.sk" })
  })
  it("bez tajného kľúča alebo pôvodu sa nedá", () => {
    expect(previewToken(channel({ secretEnc: undefined }), person)).toEqual({ error: "noSecret" })
    expect(previewToken(channel({ origins: [] }), person)).toEqual({ error: "noOrigins" })
  })
})
