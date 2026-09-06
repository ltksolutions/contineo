/**
 * reminders.test.ts — kto meška a komu sa píše.
 *
 * Sú to čisté funkcie nad výstupom `duties()`, takže databáza tu netreba.
 * Testuje sa to, čo pri chybe znamená e-mail navyše — a e-mail navyše je
 * presne to, po čom si ľudia zapnú filter.
 */
import { describe, it, expect } from "vitest"
import { overdueFrom, byPersonReminder, DEFAULT_DAYS } from "../src/lib/reminders"
import type { Duty } from "../src/lib/hrReport"

const NOW = new Date("2026-09-06T12:00:00Z")
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)

function duty(over: Partial<Duty> = {}): Duty {
  return {
    personId: "p1", fullName: "Novák", email: "novak@futbalsfz.sk",
    documentId: "d1", documentTitle: "Etický kódex",
    versionId: "v1", versionLabel: "1.0",
    sources: ["assignment"], trackTitles: [],
    since: daysAgo(30), acknowledgedAt: null, readingSeconds: null,
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
