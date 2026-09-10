/**
 * evidence.test.ts — reťaz dôkazov (ADR-005).
 *
 * Testuje sa to, čo pri obhajobe rozhoduje: či os rozlíši **„nestalo sa to"**
 * od **„vtedy sa to nezaznamenávalo"**. Zameniť tie dve veci znamená obviniť
 * človeka z niečoho, čo sa nedá zistiť — a to je horšie než nemať os vôbec.
 */

import { describe, it, expect } from "vitest"
import {
  evidenceTimeline, evidenceState, OPENS_RECORDED_SINCE,
  type EvidenceEvent, type EvidenceKind,
} from "../src/lib/evidence"

const at = (iso: string) => new Date(`${iso}T12:00:00Z`)
const find = (os: EvidenceEvent[], kind: EvidenceKind) => os.find(e => e.kind === kind)!

/** Povinnosť, ktorá vznikla po zavedení záznamu otvorení. */
const nova = (over: Partial<Parameters<typeof evidenceTimeline>[0]> = {}) =>
  evidenceTimeline({
    assignedAt: at("2026-09-15"),
    assignedBy: "hr@x.test",
    reason: "novela článku 4",
    ...over,
  })

describe("váha riadkov", () => {
  it("pridelenie, otvorenie a potvrdenie sú dôkazy", () => {
    const os = nova({ firstOpenedAt: at("2026-09-16"), acknowledgedAt: at("2026-09-17") })
    expect(find(os, "assigned").weight).toBe("proof")
    expect(find(os, "opened").weight).toBe("proof")
    expect(find(os, "acknowledged").weight).toBe("proof")
  })

  it("čas čítania je len informatívny", () => {
    // `readingTime.ts` o sebe hovorí, že dôkaz nie je: kto nechá kartu
    // otvorenú, „číta" hodinu. Os to musí povedať tiež.
    const os = nova({ readingSeconds: 720 })
    expect(find(os, "read").weight).toBe("informative")
    expect(find(os, "read").detail?.seconds).toBe(720)
  })
})

describe("chýbajúci riadok sa pomenuje, nevynechá", () => {
  it("os má vždy všetkých päť druhov", () => {
    // Prázdne miesto vyzerá ako zmazaný záznam. Preto tam riadok je vždy —
    // len s inou váhou.
    const os = evidenceTimeline({ assignedAt: null })
    expect(os.map(e => e.kind)).toEqual(["assigned", "opened", "read", "acknowledged"])
  })

  it("stará povinnosť nemá otvorenie preto, že sa vtedy nezaznamenávalo", () => {
    const os = evidenceTimeline({ assignedAt: at("2026-08-01"), acknowledgedAt: at("2026-08-02") })
    const o = find(os, "opened")
    expect(o.weight).toBe("absent")
    expect(o.gap).toBe("before-recording")
  })

  it("nová povinnosť bez otvorenia znamená, že ho človek naozaj neotvoril", () => {
    const o = find(nova(), "opened")
    expect(o.weight).toBe("absent")
    expect(o.gap).toBe("not-yet")
  })

  it("hranica zavedenia záznamu je presná", () => {
    const tesnePred = new Date(OPENS_RECORDED_SINCE.getTime() - 1000)
    const tesnePo = new Date(OPENS_RECORDED_SINCE.getTime() + 1000)
    expect(find(evidenceTimeline({ assignedAt: tesnePred }), "opened").gap).toBe("before-recording")
    expect(find(evidenceTimeline({ assignedAt: tesnePo }), "opened").gap).toBe("not-yet")
  })

  it("chýbajúci čas čítania po roku je premlčané meranie, nie „nečítal“", () => {
    const davno = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
    expect(find(evidenceTimeline({ assignedAt: davno }), "read").gap).toBe("expired")
  })
})

describe("upozornenia", () => {
  it("jeden riadok s počtom, nie zoznam", () => {
    // Tri riadky by z osi spravili log. Človek potrebuje vedieť „ozvalo sa jej
    // trikrát, naposledy vtedy".
    const os = nova({ notifiedAt: [at("2026-09-16"), at("2026-09-18"), at("2026-09-20")] })
    const n = find(os, "notified")
    expect(n.detail?.count).toBe(3)
    expect(n.at).toEqual(at("2026-09-20"))
  })

  it("bez upozornenia riadok nie je", () => {
    // Tu chýbanie nič nehovorí: neozvať sa je platný stav (pridelenie bez
    // termínu sa automaticky nepripomína).
    expect(nova().find(e => e.kind === "notified")).toBeUndefined()
  })
})

describe("zhrnutie stavu", () => {
  it("potvrdené vyhráva nad všetkým", () => {
    expect(evidenceState({ assignedAt: at("2026-09-15"), acknowledgedAt: at("2026-09-17") }))
      .toBe("acknowledged")
  })

  it("otvoril a nepotvrdil je vlastný stav", () => {
    // Je to práve tá otázka, kvôli ktorej reťaz vznikla — a zároveň údaj,
    // ktorý má bližšie k hodnoteniu človeka než čokoľvek ostatné (O14).
    expect(evidenceState({ assignedAt: at("2026-09-15"), firstOpenedAt: at("2026-09-16") }))
      .toBe("opened-not-acknowledged")
  })

  it("ani neotvoril", () => {
    expect(evidenceState({ assignedAt: at("2026-09-15") })).toBe("not-opened")
  })
})
