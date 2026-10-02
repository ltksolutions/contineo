/**
 * trackNames.test.ts — trasa podľa názvu, kľúč sa neukazuje (2. 10. 2026).
 */
import { describe, it, expect } from "vitest"
import { sameTrackTitle, trackKeyFor } from "../src/lib/trackNames"
import { audienceFromSelection, audienceLabel } from "../src/lib/assignments"
import { csvToPersons, emptyNotes } from "../src/lib/personsImport"

const TRACKS = [
  { key: "novy-zamestnanec", title: "Nový zamestnanec" },
  { key: "3f1c0b7e-0000-4000-8000-000000000001", title: "Rozhodcovia 2026" },
]

describe("názov trasy", () => {
  it("porovnanie nehľadí na veľkosť písmen a medzery navyše", () => {
    expect(sameTrackTitle("  nový   ZAMESTNANEC ", "Nový zamestnanec")).toBe(true)
    expect(sameTrackTitle("Nový zamestnanec", "Nová zamestnankyňa")).toBe(false)
  })

  it("kľúč podľa názvu, podľa staršieho kľúča, inak nič — nová trasa sa nevymyslí", () => {
    expect(trackKeyFor("rozhodcovia 2026", TRACKS)).toBe("3f1c0b7e-0000-4000-8000-000000000001")
    expect(trackKeyFor("novy-zamestnanec", TRACKS)).toBe("novy-zamestnanec")
    expect(trackKeyFor("Delegáti", TRACKS)).toBeNull()
    expect(trackKeyFor("  ", TRACKS)).toBeNull()
  })
})

describe("pridelenie trase nesie názov", () => {
  it("výber zapíše do pridelenia kópiu názvu a označenie ho ukáže namiesto kľúča", () => {
    const [a] = audienceFromSelection({
      selected: ["track:3f1c0b7e-0000-4000-8000-000000000001"],
      trackNames: { "3f1c0b7e-0000-4000-8000-000000000001": "Rozhodcovia 2026" },
    })
    expect(a).toEqual({ kind: "track", value: "3f1c0b7e-0000-4000-8000-000000000001", label: "Rozhodcovia 2026" })
    expect(audienceLabel(a)).toBe("trasa „Rozhodcovia 2026\"")
  })

  it("staršie pridelenie bez kópie ukáže kľúč (vtedy čitateľný)", () => {
    expect(audienceLabel({ kind: "track", value: "test-2026" })).toBe("trasa „test-2026\"")
  })
})

describe("import osôb: stĺpec trasy nesie názvy", () => {
  const csv = (tracks: string) => `email;meno;priezvisko;trasy\njan@sfz.sk;Ján;Novák;${tracks}`

  it("názov aj starší kľúč sa preložia na kľúč, neznámy názov ide do poznámok", () => {
    const notes = emptyNotes()
    const [p] = csvToPersons(csv("Rozhodcovia 2026, novy-zamestnanec, Delegáti"), "SFZ", { tracks: TRACKS }, notes)
    expect(p.tracks).toEqual(["3f1c0b7e-0000-4000-8000-000000000001", "novy-zamestnanec"])
    expect(notes.unknownTracks).toEqual(["Delegáti"])
  })

  it("bez zoznamu trás sa hodnoty berú ako doteraz", () => {
    const [p] = csvToPersons(csv("zaklad"), "SFZ")
    expect(p.tracks).toEqual(["zaklad"])
  })
})
