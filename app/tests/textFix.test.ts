/**
 * textFix.test.ts — oprava textu publikovaného znenia bez novej verzie.
 *
 * Dve veci, ktoré sa musia držať, lebo na nich stojí platnosť cudzích podpisov:
 *
 *  1. **brána sa pýta v poradí** — rola, potom platné znenie, potom text, až
 *     nakoniec dôvod. Kto nesmie konať, nemá sa dozvedieť ani to, či je čo
 *     opravovať (rovnaký princíp ako pri odvolaní potvrdenia);
 *  2. **„nezmenilo sa nič“ znamená to isté ako „odtlačok je ten istý“** (D57).
 *     Keby mala brána vlastnú normalizáciu, vznikol by zápis o oprave, pri
 *     ktorej sa nezmenilo nič — alebo, horšie, ticho prejde zmena, ktorú
 *     pravidlo nevidí.
 */

import { describe, it, expect } from "vitest"
import { textFixProblem, textDiff, fixableVersions, closestVersion, draftIsFree } from "../src/lib/textFix"
import { textFingerprint } from "../src/lib/chunkIdentity"

const ok = {
  canManageContent: true,
  hasEffectiveVersion: true,
  before: "Čl. 1\nHráč je povinný",
  after: "Čl. 1\nHráč je povinný,",
  reason: "chýbajúca čiarka",
}

describe("textFixProblem", () => {
  it("pustí opravu, keď je všetko na mieste", () => {
    expect(textFixProblem(ok)).toBeNull()
  })

  it("rolu pýta prvú — kto nesmie konať, nedozvie sa ani to, či je čo opraviť", () => {
    expect(textFixProblem({ ...ok, canManageContent: false, after: ok.before, reason: "" }))
      .toBe("textFix.notContentManager")
  })

  it("archivované znenie sa neopravuje — je to doklad o tom, čo platilo", () => {
    expect(textFixProblem({ ...ok, hasEffectiveVersion: false })).toBe("textFix.noEffectiveVersion")
  })

  it("prázdny text nie je oprava", () => {
    expect(textFixProblem({ ...ok, after: "   " })).toBe("textFix.emptyText")
  })

  it("bez zmeny nie je čo zapisovať", () => {
    expect(textFixProblem({ ...ok, after: ok.before })).toBe("textFix.noChange")
  })

  it("zhodu meria tou istou normalizáciou ako odtlačok — CRLF nie je zmena", () => {
    const before = "Čl. 1\nHráč je povinný"
    const after = "Čl. 1\r\nHráč je povinný  "
    expect(textFingerprint(before)).toBe(textFingerprint(after))
    expect(textFixProblem({ ...ok, before, after })).toBe("textFix.noChange")
  })

  it("odmietne text, ktorý sa medzitým zmenil pod rukami", () => {
    expect(textFixProblem({ ...ok, expectedFingerprint: textFingerprint("nieco ine") }))
      .toBe("textFix.draftChanged")
  })

  it("odtlačok, ktorý sedí, nič neblokuje", () => {
    expect(textFixProblem({ ...ok, expectedFingerprint: textFingerprint(ok.after) })).toBeNull()
  })

  it("dôvod je povinný — o rok sa inak nedá zistiť, čo sa opravovalo", () => {
    expect(textFixProblem({ ...ok, reason: "  " })).toBe("textFix.reasonRequired")
  })
})

describe("textDiff", () => {
  it("z jednej opravenej čiarky urobí jeden odobraný a jeden pridaný riadok", () => {
    const d = textDiff("a\nHráč je povinný\nc", "a\nHráč je povinný,\nc")
    expect(d.added).toBe(1)
    expect(d.removed).toBe(1)
    expect(d.coarse).toBe(false)
    expect(d.lines.filter(l => l.kind === "removed").map(l => l.text)).toEqual(["Hráč je povinný"])
    expect(d.lines.filter(l => l.kind === "added").map(l => l.text)).toEqual(["Hráč je povinný,"])
  })

  it("ukazuje okolie zmeny, nie zmenu samu", () => {
    const before = ["r1", "r2", "r3", "STARÝ", "r5", "r6", "r7"].join("\n")
    const after = ["r1", "r2", "r3", "NOVÝ", "r5", "r6", "r7"].join("\n")
    const d = textDiff(before, after, 2)
    expect(d.lines.map(l => l.text)).toEqual(["r2", "r3", "STARÝ", "NOVÝ", "r5", "r6"])
  })

  it("dlhý nezmenený úsek medzi dvoma zmenami zbalí", () => {
    const middle = Array.from({ length: 40 }, (_, i) => `m${i}`)
    const before = ["A", ...middle, "B"].join("\n")
    const after = ["A2", ...middle, "B2"].join("\n")
    const d = textDiff(before, after, 2)
    const gaps = d.lines.filter(l => l.kind === "gap")
    expect(gaps).toHaveLength(1)
    expect(gaps[0].text).toBe("36")
    expect(d.added).toBe(2)
    expect(d.removed).toBe(2)
  })

  it("pri zhodnom texte nehlási nič", () => {
    const d = textDiff("a\nb\nc", "a\nb\nc")
    expect(d.added).toBe(0)
    expect(d.removed).toBe(0)
    expect(d.lines.every(l => l.kind === "same")).toBe(true)
  })

  it("prvý a posledný riadok sa dajú opraviť tiež", () => {
    const d = textDiff("prvy\nb", "PRVY\nb")
    expect(d.removed).toBe(1)
    expect(d.added).toBe(1)
  })

  it("pri obrovskej zmene sa neporovnáva po riadkoch, ale poctivo po blokoch", () => {
    const before = Array.from({ length: 500 }, (_, i) => `x${i}`).join("\n")
    const after = Array.from({ length: 500 }, (_, i) => `y${i}`).join("\n")
    const d = textDiff(before, after)
    expect(d.coarse).toBe(true)
    expect(d.removed).toBe(500)
    expect(d.added).toBe(500)
  })
})


describe("ktoré znenie sa smie opraviť (fáza 3, D78, D150)", () => {
  const old = { versionId: "old", isActive: false, effectiveTo: new Date("2026-07-01"), markdown: "Lehota 15 dní." }
  const cur = { versionId: "cur", isActive: false, effectiveTo: new Date("2027-01-01"), markdown: "Lehota 30 dní." }
  const next = { versionId: "next", isActive: true, effectiveTo: null, markdown: "Lehota 30 dní. Poplatok 80 eur." }

  it("minulé znenie je doklad — oprava sa odmietne", () => {
    expect(textFixProblem({ ...ok, targetIsPast: true })).toBe("textFix.pastVersion")
  })

  it("platné a novela vopred áno, minulé nie", () => {
    expect(fixableVersions([old, cur, next], "cur").map(v => v.versionId)).toEqual(["cur", "next"])
    expect(fixableVersions([old, { ...cur, isActive: true, effectiveTo: null }], "cur").map(v => v.versionId)).toEqual(["cur"])
    // Dokument po skončení platnosti: naposledy zverejnené má koniec — nie je pripravované.
    expect(fixableVersions([{ ...cur, isActive: true }], undefined)).toEqual([])
  })

  it("cieľ je znenie, ktorého text je konceptu najbližší (po riadkoch)", () => {
    const a = { versionId: "cur", markdown: "Čl. 1\nÚčel.\nČl. 2\nLehota 30 dní.\nČl. 4\nPoplatok 50 eur." }
    const b = { versionId: "next", markdown: "Čl. 1\nÚčel.\nČl. 2\nLehota 30 dní.\nČl. 4\nPoplatok 80 eur." }
    // Preklep opravený v platnom znení — od novely sa líši o dva riadky, od platného o jeden.
    expect(closestVersion("Čl. 1\nÚčel,\nČl. 2\nLehota 30 dní.\nČl. 4\nPoplatok 50 eur.", [a, b])?.versionId).toBe("cur")
    expect(closestVersion("Čl. 1\nÚčel,\nČl. 2\nLehota 30 dní.\nČl. 4\nPoplatok 80 eur.", [a, b])?.versionId).toBe("next")
  })

  it("koncept je voľný, len keď sa nepripravuje nové znenie", () => {
    expect(draftIsFree("", [cur])).toBe(true)
    expect(draftIsFree("Lehota 30 dní.\n", [old, cur])).toBe(true)
    expect(draftIsFree("Úplne nový text novely.", [old, cur])).toBe(false)
    // Nové PDF je nové znenie, aj keď text sedí (ADR-011).
    expect(draftIsFree("Lehota 30 dní.", [cur], "pdf-nove", ["pdf-cur"])).toBe(false)
    expect(draftIsFree("Lehota 30 dní.", [cur], "pdf-cur", ["pdf-cur"])).toBe(true)
  })
})
