/**
 * notifications.test.ts — pravidlá zvončeka bez databázy.
 *
 * Testuje sa to, čo rozhoduje o tom, čo človek uvidí a čo sa zmaže: kam vedie
 * odkaz a odkedy je záznam za hranicou retencie. Zápis sa netestuje — ten je
 * databáza a je zámerne napísaný tak, aby nikdy nevyhodil výnimku.
 */

import { describe, it, expect } from "vitest"
import { notificationHref, retentionCutoff, RETENTION_DAYS } from "../src/lib/notifications"

describe("kam vedie upozornenie", () => {
  it("udalosti o dokumente vedu na jeho detail", () => {
    for (const kind of ["reindexed", "rewritten", "versionPublished"] as const) {
      expect(notificationHref(kind, { documentId: "sfz:stanovy" }), kind)
        .toBe("/library/sfz%3Astanovy")
    }
  })

  it("dvojbodka v identifikatore sa zakoduje", () => {
    // Bez toho by odkaz na `sfz:stanovy` skoncil na inej ceste, nez kde
    // dokument je — a clovek by dostal prazdnu stranku bez chyby.
    expect(notificationHref("reindexed", { documentId: "sfz:sutazny_poriadok" }))
      .toBe("/library/sfz%3Asutazny_poriadok")
  })

  it("bez dokumentu nie je odkaz, nie je to chyba", () => {
    // Upozornenie bez ciela je stale platna sprava. `null` znamena „bez
    // odkazu", nie „nieco sa pokazilo".
    expect(notificationHref("reindexed", {})).toBeNull()
    expect(notificationHref("versionPublished", { documentId: "   " })).toBeNull()
  })

  it("rozposlane pripomienky vedu na ich obrazovku, nie na dokument", () => {
    expect(notificationHref("remindersSent", {})).toBe("/hr/reminders")
  })

  it("neznamy druh nikam nevedie", () => {
    // Stary zaznam po zmene kodu. Radsej nikam, nez na obrazovku, ktora
    // s udalostou nesuvisi.
    expect(notificationHref("nieco-ine" as never, { documentId: "sfz:stanovy" })).toBeNull()
  })
})

describe("retencia", () => {
  it("hranica je presne devatdesiat dni dozadu", () => {
    const now = new Date(2026, 8, 15, 12, 0, 0)
    const cutoff = retentionCutoff(now)
    expect(RETENTION_DAYS).toBe(90)
    expect(Math.round((now.getTime() - cutoff.getTime()) / 86400000)).toBe(90)
  })

  it("hranica sa hybe s casom, nie je pevna", () => {
    const a = retentionCutoff(new Date(2026, 0, 1))
    const b = retentionCutoff(new Date(2026, 0, 2))
    expect(b.getTime()).toBeGreaterThan(a.getTime())
  })
})
