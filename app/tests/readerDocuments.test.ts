/**
 * readerDocuments.test.ts — jeden zoznam dokumentov pre čitateľa (ADR-041,
 * D270): dokumenty knižnice a odoberané predpisy spolu, podľa dátumu znenia,
 * s chipmi „nové" a „expiruje"; predpis bez znenia účinného dnes vypadne.
 */
import { describe, it, expect } from "vitest"
import { mergeReaderDocuments, findReaderDocuments, groupTasks, LAW_CATEGORY, NEW_DAYS, EXPIRING_DAYS } from "../src/lib/overview"

const now = new Date("2026-10-26T12:00:00Z")
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000)
const doc = (documentId: string, extra: Partial<Parameters<typeof mergeReaderDocuments>[0][number]> = {}) => ({
  documentId, title: documentId, category: "smernica" as string | null, versionLabel: "1",
  effectiveFrom: days(-100), effectiveTo: null as Date | null, publishedAt: days(-100) as Date | null, lawActId: null as string | null, ...extra,
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

describe("nové pre mňa (PREHLAD-ulohy-a-dokumenty Q3)", () => {
  it("nové je len zverejnené po predchádzajúcom prihlásení", () => {
    const rows = mergeReaderDocuments([
      doc("pred", { publishedAt: days(-3) }),
      doc("po", { publishedAt: days(-1) }),
    ], [], now, days(-2))
    const by = Object.fromEntries(rows.map(r => [r.key, r]))
    expect(by["doc:pred"].isNew).toBe(false)
    expect(by["doc:po"].isNew).toBe(true)
  })

  it("kto tu ešte nebol, nemá nové nič — celá knižnica by svietila", () => {
    const rows = mergeReaderDocuments([doc("a", { publishedAt: days(-1) })], [], now, null)
    expect(rows[0].isNew).toBe(false)
  })
})

describe("groupTasks — úlohy podľa naliehavosti", () => {
  it("po termíne, blíži sa termín, ďalšie; v skupine skorší termín prvý", () => {
    const items = [
      { id: "bez", due: null },
      { id: "o-mesiac", due: days(30) },
      { id: "vcera", due: days(-1) },
      { id: "o-dva", due: days(2) },
      { id: "pred-tyzdnom", due: days(-7) },
    ]
    const groups = groupTasks(items, now)
    expect(groups.map(g => g.group)).toEqual(["over", "soon", "rest"])
    expect(groups[0].items.map(i => i.id)).toEqual(["pred-tyzdnom", "vcera"])
    expect(groups[1].items.map(i => i.id)).toEqual(["o-dva"])
    expect(groups[2].items.map(i => i.id)).toEqual(["o-mesiac", "bez"])
  })

  it("prázdne skupiny sa nevracajú", () => {
    expect(groupTasks([{ due: null }], now).map(g => g.group)).toEqual(["rest"])
  })
})

describe("findReaderDocuments — hľadanie s rozsahmi", () => {
  const rows = mergeReaderDocuments([
    doc("Registračný a prestupový poriadok", { category: "poriadok" }),
    doc("Elektronický prestup hráča", { category: "manual" }),
    doc("Finančná smernica", { category: "smernica" }),
  ], [], now)

  it("počty pri druhoch sú po hľadaní a druh bez výsledku sa neukazuje", () => {
    const r = findReaderDocuments(rows, "prestup", "")
    expect(r.matchedTotal).toBe(2)
    expect(r.kinds.map(k => k.key).sort()).toEqual(["manual", "poriadok"])
    expect(r.shown).toHaveLength(2)
  })

  it("zvolený druh bez výsledku ostáva s nulou", () => {
    const r = findReaderDocuments(rows, "finančná", "manual")
    expect(r.activeKind).toBe("manual")
    expect(r.shown).toHaveLength(0)
    expect(r.kinds.find(k => k.key === "manual")?.count).toBe(0)
    expect(r.matchedTotal).toBe(1)
  })

  it("neznámy druh v adrese sa ignoruje", () => {
    const r = findReaderDocuments(rows, "", "vymysleny")
    expect(r.activeKind).toBe("")
    expect(r.shown).toHaveLength(3)
  })

  it("hľadá bez diakritiky", () => {
    expect(findReaderDocuments(rows, "financna", "").shown).toHaveLength(1)
  })
})

describe("zákon v knižnici aj v katalógu", () => {
  it("sa vypíše raz, ako dokument knižnice", () => {
    const rows = mergeReaderDocuments(
      [doc("sfz:zakon_440_2015", { category: "zakon", lawActId: "SK/ZZ/2015/440" })],
      [
        { actId: "SK/ZZ/2015/440", title: "Zákon č. 440/2015 Z. z. o športe", current: { effectiveFrom: days(-30) } },
        { actId: "SK/ZZ/2018/18", title: "Zákon č. 18/2018 Z. z.", current: { effectiveFrom: days(-30) } },
      ],
      now,
    )
    expect(rows.map(r => r.key).sort()).toEqual(["doc:sfz:zakon_440_2015", "law:SK/ZZ/2018/18"])
  })
})
