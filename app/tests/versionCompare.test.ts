/**
 * versionCompare.test.ts — porovnanie dvoch znení po článkoch (plán „znenia
 * v indexe", krok 7).
 */
import { describe, it, expect } from "vitest"
import { compareArticles, comparePair, selectDetail, versionText, DETAIL_LIMIT } from "../src/lib/versionCompare"
import type { ArticlePiece } from "../src/lib/versionCompare"
import { compareInstruction } from "../src/lib/versionContext"
import { chunkText } from "../src/lib/chunker.mjs"
import type { DocumentRecord } from "../src/lib/documents"

const d = (s: string) => new Date(`${s}T00:00:00Z`)
const v = (versionId: string, from: string, to: string | null, isActive: boolean, markdown?: string) =>
  ({ versionId, label: versionId, effectiveFrom: d(from), effectiveTo: to ? d(to) : null, isActive, markdown })
const doc = (versions: ReturnType<typeof v>[], markdown?: string) =>
  ({ documentId: "x", title: "Poriadok", versions, markdown }) as unknown as DocumentRecord
const NOW = new Date("2026-09-29T10:00:00Z")

describe("comparePair — ktoré dve znenia", () => {
  const old = v("1.0", "2020-01-01", "2024-01-01", false)
  const cur = v("2.0", "2024-01-01", null, true)

  it("predchádzajúce ↔ dnešné", () => {
    const r = comparePair(doc([old, cur]), NOW)
    expect(r).toMatchObject({ ok: true, direction: "previous", from: { versionId: "1.0" }, to: { versionId: "2.0" } })
  })

  it("novela zverejnená vopred: dnešné ↔ budúce", () => {
    const cur2 = v("2.0", "2024-01-01", "2027-01-01", false)
    const next = v("3.0", "2027-01-01", null, true)
    const r = comparePair(doc([old, cur2, next]), NOW)
    expect(r).toMatchObject({ ok: true, direction: "upcoming", from: { versionId: "2.0" }, to: { versionId: "3.0" } })
  })

  it("s dátumom: znenie platné vtedy ↔ dnešné", () => {
    const mid = v("1.5", "2022-01-01", "2024-01-01", false)
    const old2 = v("1.0", "2020-01-01", "2022-01-01", false)
    const r = comparePair(doc([old2, mid, cur]), NOW, d("2020-06-01"))
    expect(r).toMatchObject({ ok: true, direction: "since", from: { versionId: "1.0" }, to: { versionId: "2.0" } })
  })

  it("jediné znenie sa porovnať nedá", () => {
    expect(comparePair(doc([v("1.0", "2020-01-01", null, true)]), NOW)).toEqual({ ok: false, reason: "single-version" })
  })
})

describe("versionText", () => {
  it("staršiemu zneniu sa nepodstrčí text najnovšieho", () => {
    const old = v("1.0", "2020-01-01", "2024-01-01", false)
    const cur = v("2.0", "2024-01-01", null, true)
    const x = doc([old, cur], "najnovší text")
    expect(versionText(x, cur)).toBe("najnovší text")
    expect(versionText(x, old)).toBeNull()
  })
})

const piece = (chunkIndex: number, articleRef: string | null, text: string, heading = ""): ArticlePiece =>
  ({ chunkIndex, articleRef, text, heading })

describe("compareArticles", () => {
  const before = [
    piece(0, "čl. 1", "Úvod.", "Úvodné ustanovenia"),
    piece(1, "čl. 2", "Lehota je 15 dní.", "Lehoty"),
    piece(2, "čl. 3", "Zrušená vec.", "Staré"),
  ]
  const after = [
    piece(0, "čl. 1", "Úvod.", "Úvodné ustanovenia"),
    piece(1, "čl. 2", "Lehota je 30 dní.", "Lehoty"),
    piece(2, "čl. 4", "Nová vec.", "Nové"),
  ]

  it("zmenený, pridaný a zrušený článok; nezmenený vynechá", () => {
    const c = compareArticles(before, after)
    expect(c.map(x => [x.ref, x.kind])).toEqual([["čl. 2", "changed"], ["čl. 4", "added"], ["čl. 3", "removed"]])
    expect(c[0]).toMatchObject({ before: "Lehota je 15 dní.", after: "Lehota je 30 dní.", added: 1, removed: 1 })
  })

  it("úlomky jedného článku sa spoja", () => {
    const c = compareArticles([piece(0, "čl. 5", "A"), piece(1, "čl. 5", "B")], [piece(0, "čl. 5", "A"), piece(1, "čl. 5", "C")])
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ before: "A\nB", after: "A\nC" })
  })

  it("označenie sa porovná bez ohľadu na medzery a veľkosť písmen", () => {
    expect(compareArticles([piece(0, "Čl. 2", "x")], [piece(0, "čl.2", "x")])).toEqual([])
  })

  it("prečíslovanie vyjde ako zrušený a pridaný (známe obmedzenie)", () => {
    const c = compareArticles([piece(0, "čl. 7", "Text.")], [piece(0, "čl. 8", "Text.")])
    expect(c.map(x => x.kind).sort()).toEqual(["added", "removed"])
  })

  it("zhodné texty nemajú zmenu", () => {
    expect(compareArticles(before, before)).toEqual([])
  })

  it("so skutočným chunkerom na dvoch zneniach", () => {
    const text = (lehota: string) => `Článok 1\nÚvod\nToto je poriadok.\n\nČlánok 2\nLehoty\nLehota na odvolanie je ${lehota} dní odo dňa doručenia rozhodnutia.\n\nČlánok 3\nZáver\nPoriadok nadobúda účinnosť dňom schválenia.`
    const cut = (t: string) => chunkText(t, { nazovDokumentu: "Poriadok" }).chunky
    const c = compareArticles(cut(text("15")), cut(text("30")))
    expect(c).toHaveLength(1)
    expect(c[0].kind).toBe("changed")
    expect(c[0].after).toContain("30 dní")
  })
})

describe("selectDetail", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ ref: `čl. ${i + 1}`, heading: "", kind: "changed" as const, added: 1, removed: 1 }))
  it("najviac 8, najprv články z hľadania", () => {
    const s = selectDetail(many, ["čl. 11", "čl. 3"])
    expect(s).toHaveLength(DETAIL_LIMIT)
    expect(s.slice(0, 2).map(c => c.ref)).toEqual(["čl. 3", "čl. 11"])
  })
})

describe("compareInstruction", () => {
  it("menuje obe znenia a označí články len v prehľade", () => {
    const p = compareInstruction({
      title: "Poriadok",
      from: { label: "1.0", effectiveFrom: d("2020-01-01"), effectiveTo: d("2024-01-01") },
      to: { label: "2.0", effectiveFrom: d("2024-01-01"), effectiveTo: null },
      changes: [{ ref: "čl. 2", heading: "Lehoty", kind: "changed" }, { ref: "čl. 9", heading: "", kind: "removed" }],
      detailRefs: ["čl. 2"],
    })
    expect(p).toContain("staršie: znenie 1.0 · účinné od 1. 1. 2020 do 1. 1. 2024")
    expect(p).toContain("novšie: znenie 2.0 · účinné od 1. 1. 2024")
    expect(p).toContain("- čl. 2 (Lehoty): zmenený\n")
    expect(p).toContain("- čl. 9: zrušený — len v prehľade")
  })
})
