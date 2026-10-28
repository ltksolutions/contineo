/**
 * widgetAppearance.test.ts — vzhľad a správanie widgetu z nastavenia kanála
 * (ADR-042, Dodatok 1, D281–D284).
 */

import { describe, it, expect, vi } from "vitest"
import { readFileSync } from "node:fs"
import { widgetAppearance, appearanceForScript, normalizePhrase, isRowPosition, DEFAULT_WIDGET_APPEARANCE, DEFAULT_PHRASES, WIDGET_POSITIONS } from "../src/lib/widgetAppearance"
import { widgetScript, anchorCss, WIDGET_CSS } from "../src/lib/widgetScript"
import { dictionary } from "../src/lib/i18n"

const SECRET = "skusobny-kluc"
vi.mock("../src/lib/channels", () => ({ widgetSecret: (c: { widget: { secretEnc?: string } }) => (c.widget.secretEnc ? SECRET : null) }))
const { previewToken, previewSubject } = await import("../src/lib/widgetPreview")
const { verifyWidgetToken } = await import("../src/lib/widgetToken")

describe("widgetAppearance", () => {
  it("predvolene riadok hore v strede, plachta na obrazovku, helpdesk po dvoch neúspechoch (D286, D287, D275)", () => {
    expect(widgetAppearance(undefined)).toEqual(DEFAULT_WIDGET_APPEARANCE)
    expect(DEFAULT_WIDGET_APPEARANCE).toMatchObject({ position: "top", size: "xl", escalateAfter: 2 })
  })
  it("osem miest okolo obrazovky", () => {
    expect(WIDGET_POSITIONS).toHaveLength(8)
  })
  it("neznáma hodnota padá na predvolenú, nie na chybu", () => {
    expect(widgetAppearance({ position: "stred", size: "xl", escalateAfter: 7 })).toMatchObject({ position: "top", size: "xl", escalateAfter: 2 })
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
  it("bez nastavenia riadok otázky hore v strede a plachta 80 % × 80 % so závojom (D286, D287)", () => {
    const js = widgetScript(base)
    expect(js).toContain(".xw-dock{position:fixed;z-index:2147483000;top:16px;left:50%;transform:translateX(-50%);width:min(640px,calc(100vw - 32px))}")
    // Úchyt na posúvanie: myš, šípky, Home a dvojklik vráti; miesto si pamätá prehliadač.
    expect(js).toContain("var POS='contineo-widget-pos:'+CFG.channel")
    expect(js).toContain("h.addEventListener('dblclick',resetPos)")
    expect(js).toContain("if(e.key==='Home')")
    expect(js).toContain("draggable(grip);draggable(pill)")
    expect(js).toContain("left:10vw;top:10vh;width:80vw;height:80vh;transform:none;transform-origin:center top")
    expect(js).not.toContain(".xw-scrim{display:none}.xw-sheet")
    expect(js).toContain("var ROW=true")
  })
  it("riadok sa dá zbaliť na posúvateľné tlačidlo „Opýtajte sa…“ a klikom rozbaliť späť (Ján 28. 10. 2026)", () => {
    const js = widgetScript(base)
    expect(js).toContain("fold=el('button','xw-fold')")
    expect(js).toContain("pill=el('button','xw-pill')")
    // Tvar si pamätá prehliadač; klik po ťahaní tlačidlo nerozbalí.
    expect(js).toContain("MODE='contineo-widget-mode:'+CFG.channel")
    expect(js).toContain("if(m==='button')setCompact(true,false)")
    expect(js).toContain("if(Date.now()-dragEnd<400)return;setCompact(false,true)")
    // Miesto sa drží bližšieho okraja, aby rozbalenie a zbalenie nič neposunuli.
    expect(js).toContain("s:right?'r':'l'")
    expect(dictionary("sk").widget.pill).toBe("Opýtajte sa…")
    expect(dictionary("cs").widget.pill).toBe("Zeptejte se…")
    expect(dictionary("en").widget.pill).toBe("Ask…")
  })
  it("žiarovka v riadku ukáže tip znova, aj keď kanál automatický tip vypol (Ján 28. 10. 2026)", () => {
    const js = widgetScript(base)
    expect(js).toContain("help=el('button','xw-help')")
    expect(js).toContain("help.addEventListener('click',function(){if(tip)hideTip();else showTip(true)})")
    expect(js).toContain("if(tip||isOpen()||dock.hidden||!asked&&(!LOOK.tip||tipSeen()))return")
    expect(dictionary("cs").widget.tipShow).toBe("Jak pomocník funguje")
    // Riadky tipu s ikonou úchytu aj zbalenia; pod riadkom má tip jeho šírku.
    expect(js).toContain("[[GRIP,'tipMove'],[FOLD,'tipFold']]")
    expect(js).toContain("tip.style.width=grip&&!compact?r.width+'px':''")
    for (const l of ["sk", "cs", "en"] as const) expect(dictionary(l).widget.tipFold).toBeTruthy()
  })
  it("v rohu tlačidlo a plachta pri ňom bez závoja; veľkosť, texty a prah idú do skriptu", () => {
    const look = appearanceForScript(widgetAppearance({ position: "right-top", size: "l", escalateAfter: 1, launcher: { sk: "Pomoc" }, greeting: { sk: "Ahoj" } }), "sk")
    const js = widgetScript({ ...base, appearance: look })
    expect(js).toContain("var ROW=false")
    expect(js).toContain(".fab{position:fixed;right:16px;top:16px;transform:none;")
    expect(js).toContain(".xw-sheet{position:fixed;z-index:2147483001;right:16px;top:16px;transform:none;width:min(480px,calc(100vw - 32px));height:min(720px,calc(100vh - 32px));transform-origin:right top}")
    expect(js).toContain(".xw-scrim{display:none}")
    expect(js).toContain('"launcher":"Pomoc","greeting":"Ahoj"')
    expect(js).toContain("negatives>=LOOK.escalateAfter")
  })
  it("úvodný tip: predvolene zapnutý, vypína sa v nastavení, raz v prehliadači (D291)", () => {
    expect(DEFAULT_WIDGET_APPEARANCE.tip).toBe(true)
    expect(widgetAppearance({ position: "top" }).tip).toBe(true)
    expect(appearanceForScript(widgetAppearance({ tip: false }), "sk").tip).toBe(false)
    const js = widgetScript(base)
    expect(js).toContain("var TIPKEY='contineo-widget-tip:'+CFG.channel")
    expect(js).toContain("if(tip||isOpen()||dock.hidden||!asked&&(!LOOK.tip||tipSeen()))return")
    expect(js).toContain("function openPanel(){hideTip();")
  })
  it("pätka: na čom beží, ochrana údajov, zdrojový kód a verzia; odkazy v novej karte", () => {
    const js = widgetScript({ ...base, version: "0.1.0 · abc1234", privacyUrl: "https://intranet.futbalsfz.sk/privacy" })
    expect(js).toContain("ext('https://contineo.app')")
    expect(js).toContain("ext('https://github.com/ltksolutions/contineo')")
    expect(js).toContain('"privacyUrl":"https://intranet.futbalsfz.sk/privacy"')
    expect(js).toContain('"version":"0.1.0 · abc1234"')
    expect(js).toContain("a.target='_blank';a.rel='noreferrer'")
  })
  it("riadok len hore a dole v strede", () => {
    expect(WIDGET_POSITIONS.filter(isRowPosition)).toEqual(["top", "bottom"])
    const js = widgetScript({ ...base, appearance: appearanceForScript(widgetAppearance({ position: "bottom" }), "sk") })
    expect(js).toContain("bottom:16px;left:50%;transform:translateX(-50%)")
    expect(js).toContain("transform-origin:center bottom")
  })
  it("na telefóne celá obrazovka bez ohľadu na polohu", () => {
    expect(widgetScript(base)).toContain("@media (max-width:640px){.xw-sheet{top:0;right:0;bottom:0;left:0;transform:none;width:100vw;height:100vh;height:100dvh;border-radius:0;border:0}")
  })
  it("nápoveda riadku a vzory otázok podľa jazyka (D288)", () => {
    const a = widgetAppearance({ placeholder: { sk: "Máte otázku k ISSF?" }, examples: { sk: ["Ako zmením heslo?", "", "Ako zmením heslo?"], en: Array.from({ length: 9 }, (_, i) => `q${i}`) } })
    expect(appearanceForScript(a, "sk")).toMatchObject({ placeholder: "Máte otázku k ISSF?", examples: ["Ako zmením heslo?"] })
    expect(appearanceForScript(a, "en").examples).toHaveLength(6)
    expect(appearanceForScript(a, "cs")).toMatchObject({ placeholder: "", examples: [] })
  })
  it("všetky jazyky kanála idú do skriptu; jeden jazyk = bez výberu (D290)", () => {
    const packs = (["sk", "en"] as const).map(code => ({ code, label: code, texts: { open: code }, appearance: appearanceForScript(DEFAULT_WIDGET_APPEARANCE, code), sources: [] }))
    const js = widgetScript({ ...base, languages: packs })
    expect(js).toContain('"languages":[{"code":"sk"')
    expect(js).toContain("if(PACKS.length>1)")
    expect(widgetScript(base)).toContain('"languages":[{"code":"sk","label":"sk"')
  })
})

describe("design system vo widgete (KANAL-widget-riadok-otazky)", () => {
  it("každé pravidlo WIDGET_CSS je doslova v globals.css", () => {
    const n = (c: string) => c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{};:,>])\s*/g, "$1").replace(/;}/g, "}")
    const globals = n(readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8"))
    const missing = WIDGET_CSS.filter(r => !globals.includes(n(r)))
    expect(missing).toEqual([])
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
