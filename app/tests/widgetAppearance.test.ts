/**
 * widgetAppearance.test.ts — vzhľad a správanie widgetu z nastavenia kanála
 * (ADR-042, Dodatok 1, D281–D284).
 */

import { describe, it, expect, vi } from "vitest"
import { widgetAppearance, appearanceForScript, DEFAULT_WIDGET_APPEARANCE, WIDGET_POSITIONS } from "../src/lib/widgetAppearance"
import { widgetScript, anchorCss } from "../src/lib/widgetScript"

const SECRET = "skusobny-kluc"
vi.mock("../src/lib/channels", () => ({ widgetSecret: (c: { widget: { secretEnc?: string } }) => (c.widget.secretEnc ? SECRET : null) }))
const { previewToken, previewSubject } = await import("../src/lib/widgetPreview")
const { verifyWidgetToken } = await import("../src/lib/widgetToken")

describe("widgetAppearance", () => {
  it("predvolene vľavo v strede, stredný panel, helpdesk po dvoch neúspechoch (D282, D275)", () => {
    expect(widgetAppearance(undefined)).toEqual(DEFAULT_WIDGET_APPEARANCE)
    expect(DEFAULT_WIDGET_APPEARANCE).toMatchObject({ position: "left-middle", size: "m", escalateAfter: 2 })
  })
  it("osem miest okolo obrazovky", () => {
    expect(WIDGET_POSITIONS).toHaveLength(8)
  })
  it("neznáma hodnota padá na predvolenú, nie na chybu", () => {
    expect(widgetAppearance({ position: "stred", size: "xl", escalateAfter: 7 })).toMatchObject({ position: "left-middle", size: "m", escalateAfter: 2 })
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

describe("skript widgetu podľa nastavenia", () => {
  const base = { apiBase: "https://intranet.futbalsfz.sk", channel: "k", accent: "#123456", texts: { open: "Opýtať sa" }, language: "sk", contact: null }
  it("ukotvenie: rohy odstupom, stredy strán posunom", () => {
    expect(anchorCss("left-middle")).toBe("left:16px;top:50%;transform:translateY(-50%)")
    expect(anchorCss("top")).toBe("left:50%;top:16px;transform:translateX(-50%)")
    expect(anchorCss("right-bottom")).toBe("right:16px;bottom:16px;transform:none")
  })
  it("bez nastavenia vľavo v strede so stredným panelom", () => {
    const js = widgetScript(base)
    expect(js).toContain(".fab{position:fixed;left:16px;top:50%;transform:translateY(-50%);")
    expect(js).toContain("width:min(400px,calc(100vw - 32px));height:min(600px,calc(100vh - 32px))")
  })
  it("poloha, veľkosť, text tlačidla, privítanie a prah idú do skriptu", () => {
    const look = appearanceForScript(widgetAppearance({ position: "right-top", size: "l", escalateAfter: 1, launcher: { sk: "Pomoc" }, greeting: { sk: "Ahoj" } }), "sk")
    const js = widgetScript({ ...base, appearance: look })
    expect(js).toContain(".panel{position:fixed;right:16px;top:16px;transform:none;")
    expect(js).toContain("width:min(480px,calc(100vw - 32px));height:min(720px,calc(100vh - 32px))")
    expect(js).toContain('"appearance":{"position":"right-top","size":"l","escalateAfter":1,"launcher":"Pomoc","greeting":"Ahoj"}')
    expect(js).toContain("negatives>=LOOK.escalateAfter")
    expect(js).not.toContain("negatives>=2")
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
