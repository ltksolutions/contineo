/**
 * reminders.test.ts — kto meška a komu sa píše.
 *
 * Sú to čisté funkcie nad výstupom `duties()`, takže databáza tu netreba.
 * Testuje sa to, čo pri chybe znamená e-mail navyše — a e-mail navyše je
 * presne to, po čom si ľudia zapnú filter.
 */
import { describe, it, expect } from "vitest"
import { overdueFrom, byPersonReminder, DEFAULT_DAYS, NOTICE_DAYS, thresholdDays } from "../src/lib/reminders"
import type { Duty } from "../src/lib/hrReport"

const NOW = new Date("2026-09-06T12:00:00Z")
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)

function duty(over: Partial<Duty> = {}): Duty {
  return {
    personId: "p1", fullName: "Novák", email: "novak@futbalsfz.sk",
    documentId: "d1", documentTitle: "Etický kódex",
    versionId: "v1", versionLabel: "1.0",
    sources: ["assignment"], trackTitles: [],
    since: daysAgo(30), due: null, acknowledgedAt: null, readingSeconds: null,
    ...over,
  }
}

describe("kto meska", () => {
  it("potvrdene sa nepripomina", () => {
    // Pripomienka nieco, co clovek spravil, je presne ta posta, po ktorej
    // si zapne filter aj na tu dolezitu.
    const rows = overdueFrom([duty({ acknowledgedAt: daysAgo(1) })], DEFAULT_DAYS, NOW)
    expect(rows).toHaveLength(0)
  })

  it("povinnost bez zaciatku sa za meskajucu nepovazuje", () => {
    // Radsej niekoho neupozornit nez mu vycitat omeskanie, ktore sa neda
    // dolozit.
    expect(overdueFrom([duty({ since: null })], DEFAULT_DAYS, NOW)).toHaveLength(0)
  })

  it("presne na prahu este nemeska, den nad prahom uz ano", () => {
    expect(overdueFrom([duty({ since: daysAgo(13) })], 14, NOW)).toHaveLength(0)
    expect(overdueFrom([duty({ since: daysAgo(14) })], 14, NOW)).toHaveLength(1)
  })

  it("pocita cele dni", () => {
    expect(overdueFrom([duty({ since: daysAgo(20) })], 14, NOW)[0].days).toBe(20)
  })

  it("najdlhsie meskanie je hore", () => {
    const rows = overdueFrom([
      duty({ personId: "a", fullName: "A", versionId: "v1", since: daysAgo(20) }),
      duty({ personId: "b", fullName: "B", versionId: "v2", since: daysAgo(60) }),
    ], 14, NOW)
    expect(rows.map(r => r.days)).toEqual([60, 20])
  })
})

describe("zoskupenie po ludoch", () => {
  it("styri smernice jedneho cloveka su JEDEN e-mail so styrmi riadkami", () => {
    const rows = overdueFrom(
      ["v1", "v2", "v3", "v4"].map(versionId => duty({ versionId, since: daysAgo(20) })),
      14, NOW,
    )
    const people = byPersonReminder(rows)
    expect(people).toHaveLength(1)
    expect(people[0].items).toHaveLength(4)
  })

  it("worstDays je najdlhsie meskanie cloveka, nie sucet ani priemer", () => {
    const rows = overdueFrom([
      duty({ versionId: "v1", since: daysAgo(20) }),
      duty({ versionId: "v2", since: daysAgo(90) }),
    ], 14, NOW)
    expect(byPersonReminder(rows)[0].worstDays).toBe(90)
  })

  it("ludia su zoradeni podla najdlhsieho meskania", () => {
    const rows = overdueFrom([
      duty({ personId: "a", fullName: "A", email: "a@x.sk", since: daysAgo(20) }),
      duty({ personId: "b", fullName: "B", email: "b@x.sk", since: daysAgo(50) }),
    ], 14, NOW)
    expect(byPersonReminder(rows).map(p => p.personId)).toEqual(["b", "a"])
  })

  it("prazdny vstup nevyrobi ziadneho prijemcu", () => {
    expect(byPersonReminder([])).toEqual([])
  })
})

describe("prah z adresy", () => {
  it("prazdna hodnota znamena predvoleny prah", () => {
    expect(thresholdDays(undefined)).toBe(DEFAULT_DAYS)
    expect(thresholdDays("")).toBe(DEFAULT_DAYS)
    expect(thresholdDays("   ")).toBe(DEFAULT_DAYS)
  })

  it("nulu prijme ako nulu", () => {
    // Tvar `Number(raw) || DEFAULT_DAYS`, ktory tu bol, cez `||` poslal nulu
    // na 14 — prah 0 sa nedal nastavit vobec a povinnosti z tras zostali
    // bez cesty k e-mailu.
    expect(thresholdDays("0")).toBe(NOTICE_DAYS)
    expect(thresholdDays("0")).toBe(0)
  })

  it("nezmysel padne na predvoleny prah, nie na nulu", () => {
    // Nula by rozposlala e-maily vsetkym namiesto meskajucim. Preklep
    // v adrese nesmie mat taky nasledok.
    expect(thresholdDays("abc")).toBe(DEFAULT_DAYS)
    expect(thresholdDays("NaN")).toBe(DEFAULT_DAYS)
  })

  it("zaporne cislo je nula, desatinne sa oreze nadol", () => {
    expect(thresholdDays("-5")).toBe(0)
    expect(thresholdDays("7.9")).toBe(7)
  })
})

describe("prah nula — dat vediet vsetkym", () => {
  it("zahrnie aj povinnost, ktora vznikla dnes", () => {
    // Presne ten pripad, ktory doteraz nemal ako dat o sebe vediet:
    // dokument pribudol dnes a `days=14` ho nezachyti.
    const rows = overdueFrom([duty({ since: NOW })], NOTICE_DAYS, NOW)
    expect(rows).toHaveLength(1)
    expect(rows[0].days).toBe(0)
  })

  it("zahrnie povinnost z trasy, ku ktorej pridelenie neexistuje", () => {
    const rows = overdueFrom(
      [duty({ sources: ["track"], trackTitles: ["Nástup"], since: NOW })],
      NOTICE_DAYS, NOW,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].duty.trackTitles).toEqual(["Nástup"])
  })

  it("potvrdene nezahrnie ani pri nule", () => {
    const rows = overdueFrom([duty({ since: NOW, acknowledgedAt: NOW })], NOTICE_DAYS, NOW)
    expect(rows).toHaveLength(0)
  })

  it("povinnost bez zaciatku nezahrnie ani pri nule", () => {
    // Bez `since` sa neda povedat, odkedy o nej clovek vie — jedine, co by
    // e-mail dosiahol, je pripomenut nieco, co uz pripomenute bolo.
    const rows = overdueFrom([duty({ since: null })], NOTICE_DAYS, NOW)
    expect(rows).toHaveLength(0)
  })
})
