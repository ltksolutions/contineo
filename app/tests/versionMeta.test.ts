/**
 * versionMeta.test.ts — údaje o znení (ADR-013): tvar, identita konceptu,
 * návrh z prvej strany dokumentu a zámok po predložení.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const col = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(async () => ({ matchedCount: 1 })),
}))
const state = vi.hoisted(() => ({ versionStateFor: vi.fn(async () => "draft") }))
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async () => col) }))
vi.mock("../src/lib/approvalsDb", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/approvalsDb")>()),
  versionStateFor: state.versionStateFor,
}))
vi.mock("../src/lib/audit", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/audit")>()),
  writeAudit: vi.fn(async () => {}),
}))

import {
  parseDate, suggestMetaFromMarkdown, documentDraftIdentity, metaCanonical, normalizeMeta, metaProblem, EMPTY_META, metaLocked,
} from "../src/lib/versionMeta"
import { draftIdentity } from "../src/lib/chunkIdentity"
import { saveDraftMeta } from "../src/lib/libraryWrite"

const Y = (s: string) => new Date(`${s}T00:00:00Z`)

describe("parseDate", () => {
  it("slovenský zápis aj ISO", () => {
    expect(parseDate("07.09.2026")).toEqual(Y("2026-09-07"))
    expect(parseDate("7. 9. 2026")).toEqual(Y("2026-09-07"))
    expect(parseDate("2026-09-07")).toEqual(Y("2026-09-07"))
  })
  it("neplatný deň nie je posunutý dátum", () => {
    expect(parseDate("31.02.2026")).toBeNull()
    expect(parseDate("zajtra")).toBeNull()
  })
})

describe("návrh z prvej strany (D108)", () => {
  // Presne tvar, aký dáva prevod pracovného poriadku SFZ.
  const md = [
    "Pracovný poriadok SFZ",
    "",
    "| **Názov dokumentu** | Pracovný poriadok SFZ |",
    "| --- | --- |",
    "| **Spoločnosť / Právny subjekt** | Slovenský futbalový zväz (SFZ) |",
    "| **Orgán / Oddelenie** | Oddelenie ľudských zdrojov |",
    "| **Schválil** | VV SFZ |",
    "| **Dátum schválenia** | 07.09.2026 |",
    "| **Dátum účinnosti** | 07.09.2026 |",
    "",
    "# Časť I – Základné ustanovenia",
    "",
    "| **Schválil** | niekto iný v texte |",
  ].join("\n")

  it("prečíta štyri údaje z tabuľky pred prvým nadpisom", () => {
    expect(suggestMetaFromMarkdown(md)).toEqual({
      author: "Oddelenie ľudských zdrojov",
      approvedBy: "VV SFZ",
      approvedOn: Y("2026-09-07"),
      effectiveFrom: Y("2026-09-07"),
    })
  })
  it("text bez tabuľky nedá nič", () => {
    expect(suggestMetaFromMarkdown("# Článok 1\n\nText.")).toEqual(EMPTY_META)
  })
})

describe("identita konceptu (D107)", () => {
  const meta = normalizeMeta({ author: "HR", approvedBy: "VV SFZ", approvedOn: Y("2026-09-07"), effectiveFrom: Y("2026-09-07") })

  it("bez údajov sa identita nemení — staré kolá platia ďalej", () => {
    expect(documentDraftIdentity({ draftMarkdown: "Text", draftPdf: { sha256: "a" } })).toBe(draftIdentity("Text", "a"))
  })
  it("doplnené údaje identitu zmenia; iný dátum účinnosti = iná identita", () => {
    const base = documentDraftIdentity({ draftMarkdown: "Text", draftPdf: { sha256: "a" }, draftMeta: meta })
    expect(base).not.toBe(draftIdentity("Text", "a"))
    const other = documentDraftIdentity({ draftMarkdown: "Text", draftPdf: { sha256: "a" }, draftMeta: { ...meta, effectiveFrom: Y("2026-10-01") } })
    expect(other).not.toBe(base)
  })
  it("čas dňa ani medzery identitu nemenia", () => {
    const a = metaCanonical(meta)
    const b = metaCanonical(normalizeMeta({ ...meta, author: "  HR ", effectiveFrom: new Date("2026-09-07T15:30:00Z") }))
    expect(b).toBe(a)
  })
  it("bez dátumu účinnosti sa nepredkladá", () => {
    expect(metaProblem(null)).toBe("meta.effectiveFromRequired")
    expect(metaProblem(meta)).toBeNull()
  })
})

describe("saveDraftMeta — zámok po predložení (D106)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    col.findOne.mockResolvedValue({ documentId: "sfz:pp", title: "PP", draftMarkdown: "Text", draftPdf: { sha256: "a" } })
  })

  it("koncept bez kola: uloží sa", async () => {
    await saveDraftMeta("SFZ", "sfz:pp", normalizeMeta({ approvedBy: "VV SFZ", effectiveFrom: Y("2026-09-07") }), "jan@sfz.sk")
    const set = (col.updateOne.mock.calls[0] as unknown as [unknown, { $set: { draftMeta: { approvedBy: string } } }])[1].$set
    expect(set.draftMeta.approvedBy).toBe("VV SFZ")
  })

  it("zámok: počas kola vždy, po schválení len ak údaje boli súčasťou schválenia", () => {
    expect(metaLocked("in-review", false)).toBe(true)
    expect(metaLocked("approved", true)).toBe(true)
    expect(metaLocked("approved", false)).toBe(false) // schválené pred ADR-013 — doplnenie zruší schválenie
    expect(metaLocked("draft", true)).toBe(false)
  })

  it("schválené pred ADR-013 bez údajov: doplniť sa smú", async () => {
    state.versionStateFor.mockResolvedValueOnce("approved")
    await saveDraftMeta("SFZ", "sfz:pp", normalizeMeta({ approvedBy: "VV SFZ" }), "jan@sfz.sk")
    expect(col.updateOne).toHaveBeenCalled()
  })

  it.each(["in-review", "approved"])("koncept %s s údajmi: zmena sa odmietne", async s => {
    col.findOne.mockResolvedValue({ documentId: "sfz:pp", title: "PP", draftMarkdown: "Text", draftPdf: { sha256: "a" }, draftMeta: { approvedBy: "VV" } })
    state.versionStateFor.mockResolvedValueOnce(s)
    await expect(saveDraftMeta("SFZ", "sfz:pp", normalizeMeta({ approvedBy: "X" }), "jan@sfz.sk"))
      .rejects.toMatchObject({ code: "meta.locked" })
    expect(col.updateOne).not.toHaveBeenCalled()
  })

  it("dátum schválenia v budúcnosti sa odmietne", async () => {
    await expect(saveDraftMeta("SFZ", "sfz:pp", normalizeMeta({ approvedOn: Y("2099-01-01") }), "jan@sfz.sk", Y("2026-09-24")))
      .rejects.toMatchObject({ code: "meta.approvedOnInFuture" })
  })
})
