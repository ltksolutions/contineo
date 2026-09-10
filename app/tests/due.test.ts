/**
 * due.test.ts — termín potvrdenia a kadencia pripomienok (ADR-004).
 *
 * Dve miesta, kde sa dá pomýliť o jeden deň a človek to pocíti:
 *
 *  1. **deň termínu** — kto potvrdí v ten deň, termín splnil, takže stav je
 *     „blíži sa", nie „po termíne". Chyba by znamenala e-mail „ste po termíne"
 *     v deň, keď po ňom nie je;
 *  2. **relatívny termín pri neskoršom príchode** — celý dôvod, prečo tvar
 *     `days` v modeli je (D50, D62).
 */

import { describe, it, expect } from "vitest"
import {
  dueFrom, dueState, daysLeft, addDays, reminderPlan, SOON_DAYS,
  dueFromFields, normalizeDueMode,
} from "../src/lib/due"
import { dueForPerson } from "../src/lib/assignments"

/** Poludnie, aby sa test nechytal na letný čas ani na hranicu dňa. */
const at = (iso: string) => new Date(`${iso}T12:00:00`)

describe("termín z dátumu vzniku povinnosti", () => {
  it("absolútny termín platí pre všetkých rovnako", () => {
    const due = { kind: "date", at: at("2026-09-30") } as const
    expect(dueFrom(at("2026-09-01"), due)).toEqual(at("2026-09-30"))
    // Neskorší príchod na absolútnom termíne nič nemení — to je jeho zmysel
    // aj jeho diera, a preto existuje druhý tvar.
    expect(dueFrom(at("2026-09-29"), due)).toEqual(at("2026-09-30"))
  })

  it("relatívny termín beží odkedy povinnosť vznikla pre danú osobu", () => {
    const due = { kind: "days", days: 14 } as const
    expect(daysLeft(dueFrom(at("2026-09-01"), due)!, at("2026-09-01"))).toBe(14)
    // Kto prišiel 29. 9., dostane tiež 14 dní — nie termín v minulosti (D50).
    expect(daysLeft(dueFrom(at("2026-09-29"), due)!, at("2026-09-29"))).toBe(14)
  })

  it("bez termínu je platný stav, nie chyba", () => {
    expect(dueFrom(at("2026-09-01"), null)).toBeNull()
    expect(dueFrom(at("2026-09-01"), undefined)).toBeNull()
    expect(dueState(null, at("2026-09-01"))).toBe("none")
    // Nezmysel v dňoch nesmie vyrobiť „Invalid Date" a s ním termín, ktorý
    // sa v rozhraní zobrazí ako NaN.
    expect(dueFrom(at("2026-09-01"), { kind: "days", days: Number.NaN })).toBeNull()
  })
})

describe("stav voči termínu (D63)", () => {
  const now = at("2026-09-09")

  it("deň termínu je ešte blíži sa, nie po termíne", () => {
    expect(dueState(at("2026-09-09"), now)).toBe("soon")
    expect(dueState(at("2026-09-08"), now)).toBe("over")
  })

  it("hranica piatich dní", () => {
    expect(dueState(addDays(now, SOON_DAYS), now)).toBe("soon")
    expect(dueState(addDays(now, SOON_DAYS + 1), now)).toBe("open")
  })

  it("stav sa počas dňa nemení", () => {
    const due = at("2026-09-14")
    const rano = new Date("2026-09-09T06:00:00")
    const vecer = new Date("2026-09-09T23:30:00")
    expect(daysLeft(due, rano)).toBe(daysLeft(due, vecer))
  })
})

describe("kadencia pripomienok — eskalácia, nie opakovanie", () => {
  const due = at("2026-09-30")
  const dayBefore = (n: number) => addDays(due, -n)
  const dayAfter = (n: number) => addDays(due, n)

  it("pred termínom šesť dní denne, predtým nič", () => {
    for (const n of [5, 4, 3, 2, 1, 0]) {
      const p = reminderPlan(due, dayBefore(n))
      expect(p, `D-${n}`).toEqual({ person: true, hr: false, tone: "soon" })
    }
    // Šesť dní pred termínom sa ešte neozývame — inak to prestane byť
    // upozornenie a stane sa pošta.
    expect(reminderPlan(due, dayBefore(6)).person).toBe(false)
    expect(reminderPlan(due, dayBefore(30)).person).toBe(false)
  })

  it("po termíne D+1, D+3, D+7 — nie každý deň", () => {
    expect(reminderPlan(due, dayAfter(1))).toEqual({ person: true, hr: false, tone: "over" })
    expect(reminderPlan(due, dayAfter(2)).person).toBe(false)
    expect(reminderPlan(due, dayAfter(3))).toEqual({ person: true, hr: false, tone: "over" })
    for (const n of [4, 5, 6]) expect(reminderPlan(due, dayAfter(n)).person, `D+${n}`).toBe(false)
  })

  it("od siedmeho dňa aj personalistovi a potom raz týždenne", () => {
    expect(reminderPlan(due, dayAfter(7))).toEqual({ person: true, hr: true, tone: "over" })
    expect(reminderPlan(due, dayAfter(14))).toEqual({ person: true, hr: true, tone: "over" })
    expect(reminderPlan(due, dayAfter(21)).hr).toBe(true)
    // Medzi týždňami ticho: mesiac neprítomnosti nemá znamenať tridsať
    // e-mailov, ale štyri a jedného personalistu.
    for (const n of [8, 10, 13, 15, 20]) {
      expect(reminderPlan(due, dayAfter(n)).person, `D+${n}`).toBe(false)
    }
  })

  it("za tridsať dní po termíne odíde najviac sedem e-mailov osobe", () => {
    // Toto je to číslo, kvôli ktorému sme denný režim zamietli: pri dennom
    // by ich bolo tridsať.
    const sent = Array.from({ length: 31 }, (_, i) => reminderPlan(due, dayAfter(i)))
      .filter(p => p.person).length
    expect(sent).toBeLessThanOrEqual(7)
  })

  it("bez termínu sa automaticky nepripomína vôbec", () => {
    expect(reminderPlan(null, at("2026-09-09"))).toEqual({ person: false, hr: false, tone: null })
  })
})

describe("termín z formulára prideľovania", () => {
  const ok = (r: ReturnType<typeof dueFromFields>) => {
    if ("error" in r) throw new Error(`čakala sa hodnota, prišla chyba ${r.error}`)
    return r.due
  }

  it("voľba rozhoduje, nie vyplnenosť poľa", () => {
    // Prázdne pole je dvojznačné: „termín nechcem" verzus „zabudol som".
    // Pri sľube danom človeku sa to hádať nemá.
    expect(ok(dueFromFields({ mode: "none", date: "2026-09-30", days: "14" }))).toBeNull()
    expect(ok(dueFromFields({ mode: "date", date: "2026-09-30", days: "14" })))
      .toEqual({ kind: "date", at: new Date(2026, 8, 30) })
    expect(ok(dueFromFields({ mode: "days", date: "2026-09-30", days: "14" })))
      .toEqual({ kind: "days", days: 14 })
  })

  it("dátum sa číta ako miestna polnoc, nie ako UTC", () => {
    // `new Date("2026-09-30")` je polnoc v UTC. V našom pásme by z termínu
    // vyšiel 30. 9. o druhej ráno a na západ od Greenwichu dokonca 29. 9. —
    // teda termín o deň skôr, než personalista zadal.
    const due = ok(dueFromFields({ mode: "date", date: "2026-09-30" }))
    if (due?.kind !== "date") throw new Error("čakal sa dátumový termín")
    expect(due.at.getFullYear()).toBe(2026)
    expect(due.at.getMonth()).toBe(8)
    expect(due.at.getDate()).toBe(30)
    expect(due.at.getHours()).toBe(0)
  })

  it("nezmysel vráti kód chyby, nie výnimku", () => {
    // Volajúci ju musí vedieť ukázať pri formulári spolu s tým, čo už človek
    // vyplnil — nie ho vyhodiť na chybovú stránku.
    expect(dueFromFields({ mode: "date", date: "" })).toEqual({ error: "assignment.badDue" })
    expect(dueFromFields({ mode: "date", date: "30.9.2026" })).toEqual({ error: "assignment.badDue" })
    expect(dueFromFields({ mode: "days", days: "0" })).toEqual({ error: "assignment.badDueDays" })
    expect(dueFromFields({ mode: "days", days: "-3" })).toEqual({ error: "assignment.badDueDays" })
    expect(dueFromFields({ mode: "days", days: "" })).toEqual({ error: "assignment.badDueDays" })
  })

  it("neznáma voľba je bez termínu, nie chyba", () => {
    // Hodnota ide z formulára, teda od kohokoľvek. Preklep nemá zhodiť
    // prideľovanie ani ticho vyrobiť termín.
    expect(normalizeDueMode("nieco")).toBe("none")
    expect(normalizeDueMode(undefined)).toBe("none")
    expect(ok(dueFromFields({ mode: "nieco", date: "2026-09-30" }))).toBeNull()
  })
})

describe("termín pre konkrétnu osobu (D62 + D50)", () => {
  const assignedAt = new Date(2026, 8, 1)          // 1. 9.
  const prisiel = new Date(2026, 8, 29)            // 29. 9., teda neskôr

  /** Osoba, ktorá je v oddelení od `from`. */
  const person = (from: Date | null) => ({
    departmentHistory: from
      ? [{ departmentId: "it", departmentPath: ["it"], from }]
      : [],
    groupHistory: [],
  })

  const forDepartment = (due: Parameters<typeof dueForPerson>[0]["due"]) => ({
    audience: { kind: "department" as const, value: "it" },
    assignedAt,
    due,
  })

  it("absolútny termín platí pre všetkých rovnako — aj pre neskorší príchod", () => {
    const a = forDepartment({ kind: "date", at: new Date(2026, 8, 30) })
    expect(dueForPerson(a, person(null))).toEqual(new Date(2026, 8, 30))
    // Kto prišiel 29. 9., má na normu jeden deň. To je vlastnosť absolútneho
    // termínu, nie chyba — a presne preto existuje aj druhý tvar.
    expect(dueForPerson(a, person(prisiel))).toEqual(new Date(2026, 8, 30))
  })

  it("relatívny termín beží odo dňa príchodu do oddelenia (D50)", () => {
    const a = forDepartment({ kind: "days", days: 14 })
    // Kto bol v oddelení od začiatku: 14 dní od pridelenia.
    expect(dueForPerson(a, person(null))).toEqual(new Date(2026, 8, 15))
    // Kto prišiel 29. 9.: 14 dní od príchodu, teda 13. 10. — nie termín
    // v minulosti. Toto je celý dôvod, prečo tvar `days` v modeli je.
    expect(dueForPerson(a, person(prisiel))).toEqual(new Date(2026, 9, 13))
  })

  it("bez termínu vráti null, nie dnešok", () => {
    expect(dueForPerson(forDepartment(null), person(null))).toBeNull()
    expect(dueForPerson(forDepartment(undefined), person(prisiel))).toBeNull()
  })
})
