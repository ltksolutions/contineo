/**
 * dueReminderEmail.test.ts — pripomienka termínu (ADR-004, krok 4).
 *
 * Testuje sa to, čo môže spôsobiť škodu: zámena tónu (upokojujúca veta nad
 * vecou po termíne je klamlivá), deň termínu vydávaný za meškanie, a tvary
 * čísloviek — „zostáva 2 dní" vyzerá ako pokazený systém a človek podľa toho
 * posudzuje aj obsah.
 */

import { describe, it, expect } from "vitest"
import { dueReminderEmail } from "../src/lib/ecomail"
import { weekKey, dayKey } from "../src/lib/reminders"

const item = (daysLeft: number) => ({
  title: "Revízny poriadok",
  versionLabel: "1.0",
  due: "20. 9. 2026",
  daysLeft,
})

const mail = (daysLeft: number, tone: "soon" | "over", language: "sk" | "cs" | "en" = "sk") =>
  dueReminderEmail("https://x/documents", "x", [item(daysLeft)], tone, language, {
    displayName: "Slovenský futbalový zväz",
  })

describe("pripomienka termínu", () => {
  it("pred termínom hovorí, koľko zostáva", () => {
    expect(mail(3, "soon").text).toContain("zostávajú 3 dni")
    expect(mail(1, "soon").text).toContain("zostáva deň")
    expect(mail(5, "soon").text).toContain("zostáva 5 dní")
  })

  it("v deň termínu nehovorí o meškaní", () => {
    // Kto potvrdí v ten deň, termín splnil — veta o meškaní by bola nepravda.
    const t = mail(0, "soon").text
    expect(t).toContain("termín je dnes")
    expect(t).not.toContain("po ňom")
  })

  it("po termíne hovorí, o koľko", () => {
    expect(mail(-1, "over").text).toContain("ste po ňom deň")
    expect(mail(-3, "over").text).toContain("ste po ňom 3 dni")
    expect(mail(-9, "over").text).toContain("ste po ňom 9 dní")
  })

  it("tón mení predmet aj úvod", () => {
    expect(mail(3, "soon").subject).toContain("Blíži sa")
    expect(mail(-3, "over").subject).toContain("po termíne")
    expect(mail(3, "soon").text).toContain("termín sa blíži")
    expect(mail(-3, "over").text).toContain("termín už uplynul")
  })

  it("odkaz vedie na zoznam, nie na jeden dokument", () => {
    expect(mail(3, "soon").text).toContain("/documents")
  })

  it("ampersand v názve nerozsype HTML", () => {
    const e = dueReminderEmail("https://x/documents", "x",
      [{ ...item(2), title: "Práva & povinnosti" }], "soon", "sk")
    expect(e.html).toContain("Práva &amp; povinnosti")
  })

  it("funguje vo všetkých troch jazykoch", () => {
    expect(mail(2, "soon", "cs").text).toContain("zbývají 2 dny")
    expect(mail(2, "soon", "en").text).toContain("2 days left")
  })
})

describe("kľúče proti dvojitému odoslaniu", () => {
  it("deň je deň, nie okamih", () => {
    // Dva behy crona v ten istý deň musia dať ten istý kľúč, aj keď medzi
    // nimi prejde pol dňa.
    expect(dayKey(new Date("2026-09-20T06:00:00Z"))).toBe("2026-09-20")
    expect(dayKey(new Date("2026-09-20T23:59:00Z"))).toBe("2026-09-20")
  })

  it("týždeň sa počíta od pondelka", () => {
    // Nedeľa patrí k týždňu, ktorý začal v pondelok — `getUTCDay()` je pre
    // nedeľu 0, takže posun je 6, nie -1. Tu sa dá pomýliť o celý týždeň.
    expect(weekKey(new Date("2026-09-21T06:00:00Z"))).toBe("2026-09-21") // pondelok
    expect(weekKey(new Date("2026-09-24T06:00:00Z"))).toBe("2026-09-21") // štvrtok
    expect(weekKey(new Date("2026-09-27T23:00:00Z"))).toBe("2026-09-21") // nedeľa
    expect(weekKey(new Date("2026-09-28T00:30:00Z"))).toBe("2026-09-28") // ďalší pondelok
  })
})
