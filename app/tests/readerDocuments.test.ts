/**
 * readerDocuments.test.ts — jeden zoznam dokumentov pre čitateľa (ADR-041,
 * D270): dokumenty knižnice a odoberané predpisy spolu, podľa dátumu znenia,
 * s chipmi „nové" a „expiruje"; predpis bez znenia účinného dnes vypadne.
 */
import { describe, it, expect } from "vitest"
import { mergeReaderDocuments, LAW_CATEGORY, NEW_DAYS, EXPIRING_DAYS } from "../src/lib/overview"

const now = new Date("2026-10-26T12:00:00Z")
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000)
const doc = (documentId: string, extra: Partial<Parameters<typeof mergeReaderDocuments>[0][number]> = {}) => ({
  documentId, title: documentId, category: "smernica" as string | null, versionLabel: "1",
  effectiveFrom: days(-100), effectiveTo: null as Date | null, publishedAt: days(-100) as Date | null, ...extra,
})

describe("mergeReaderDocuments", () => {
  it("spojí dokumenty a predpisy, najnovšie znenie prvé", () => {
    const rows = mergeReaderDocuments(
      [doc("a", { effectiveFrom: days(-10) }), doc("b", { effectiveFrom: days(-300) })],
      [{ actId: "SK/ZZ/2015/440", title: "Zákon o športe", current: { effectiveFrom: days(-50) } }],
      now,
    )
    expect(rows.map(r => r.key)).toEqual(["doc:a", "law:SK/ZZ/2015/440", "doc:b"])
    expect(rows[1]).toMatchObject({ kind: "law", category: LAW_CATEGORY, href: "/documents/law/SK/ZZ/2015/440", askHref: "/ask?src=slov-lex" })
    expect(rows[0]).toMatchObject({ kind: "document", href: "/documents/a", askHref: "/ask?src=library&doc=a" })
  })

  it("predpis len s budúcim znením sa čitateľovi neponúka", () => {
    expect(mergeReaderDocuments([], [{ actId: "x", title: "x", current: null }], now)).toEqual([])
  })

  it("chip nové podľa zverejnenia, expiruje podľa konca platnosti", () => {
    const rows = mergeReaderDocuments([
      doc("new", { publishedAt: days(-(NEW_DAYS - 1)) }),
      doc("old", { publishedAt: days(-(NEW_DAYS + 1)) }),
      doc("ending", { effectiveTo: days(EXPIRING_DAYS - 1) }),
      doc("later", { effectiveTo: days(EXPIRING_DAYS + 1) }),
    ], [], now)
    const by = Object.fromEntries(rows.map(r => [r.key, r]))
    expect(by["doc:new"].isNew).toBe(true)
    expect(by["doc:old"].isNew).toBe(false)
    expect(by["doc:ending"].expiring).toBe(true)
    expect(by["doc:later"].expiring).toBe(false)
  })

  it("hranice okien: presne 7 dní je ešte nové, presne 30 dní ešte expiruje; čo už vypršalo, neexpiruje", () => {
    const rows = mergeReaderDocuments([
      doc("edge-new", { publishedAt: days(-NEW_DAYS) }),
      doc("future", { publishedAt: days(2) }),
      doc("edge-exp", { effectiveTo: days(EXPIRING_DAYS) }),
      doc("gone", { effectiveTo: days(-1) }),
    ], [], now)
    const by = Object.fromEntries(rows.map(r => [r.key, r]))
    expect(by["doc:edge-new"].isNew).toBe(true)
    // Zverejniť sa dá s dátumom dopredu; „nové" znamená „pribudlo", nie „raz pribudne".
    expect(by["doc:future"].isNew).toBe(false)
    expect(by["doc:edge-exp"].expiring).toBe(true)
    // `effectiveTo` v minulosti nie je varovanie do budúcnosti, je to iný stav.
    expect(by["doc:gone"].expiring).toBe(false)
  })

  it("dokument bez druhu má category null a ostáva v zozname", () => {
    const rows = mergeReaderDocuments([doc("x", { category: null })], [], now)
    expect(rows[0].category).toBeNull()
  })
})
