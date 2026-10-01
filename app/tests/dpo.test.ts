/**
 * dpo.test.ts — výkaz právnych základov a štvrťročný rytmus (ADR-012, D104).
 */
import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/session", () => ({ currentTenant: vi.fn(), currentPerson: vi.fn() }))

import {
  legalBasisReport, quarterKey, isQuarterStart, summarize, isDpo, DPO_ROLE,
  parseDpoQuery, searchLegalBasisRows, filterLegalBasisRows, dpoFacets, groupByPerson, personMailto, dpoHref, highlight,
  MAIL_LIST_MAX, type LegalBasisRow,
} from "../src/lib/dpo"
import { dpoReportEmail } from "../src/lib/ecomail"

const NOW = new Date("2026-10-01T06:00:00Z")
const Y = (s: string) => new Date(`${s}T00:00:00Z`)

function doc(documentId: string, title: string, v: Record<string, unknown>) {
  return {
    documentId, title,
    versions: [{ versionId: `${documentId}-v1`, label: "1", isActive: true, effectiveFrom: Y("2026-01-01"), effectiveTo: null, ...v }],
  } as never
}

describe("legalBasisReport", () => {
  const active = new Set(["g1"])
  const rows = legalBasisReport([
    doc("a", "Bozp", { legalBasis: "legal_obligation", legalBasisKey: "bozp", legalBasisReference: "§ 7 z. 124/2006", responsiblePerson: { personId: "g1", fullName: "G", email: "g@x" } }),
    doc("b", "Etický kódex", { legalBasis: "legitimate_interest", legalBasisKey: null, responsiblePerson: { personId: "g2", fullName: "H", email: "h@x" } }),
    doc("c", "Archív", { isActive: false }),
    doc("d", "Bez základu", {}),
    doc("e", "Zákon bez odkazu", { legalBasis: "legal_obligation", legalBasisKey: "x", responsiblePerson: { personId: "g1", fullName: "G", email: "g@x" } }),
  ], active, NOW)

  it("len platné znenia — archív DPO nekontroluje", () => {
    expect(rows.map(r => r.documentId)).not.toContain("c")
    expect(rows).toHaveLength(4)
  })
  it("pomenuje, čo chýba", () => {
    const by = Object.fromEntries(rows.map(r => [r.documentId, r.problems]))
    expect(by.a).toEqual([])
    expect(by.b).toEqual(["outsideCodelist", "inactiveResponsible"])
    expect(by.d).toEqual(["noBasis", "noResponsible"])
    expect(by.e).toEqual(["noReference"])
  })
  it("znenia s nedostatkom sú hore", () => {
    expect(rows[rows.length - 1].documentId).toBe("a")
  })
  it("súhrn do e-mailu", () => {
    expect(summarize(rows)).toEqual({ total: 4, legalObligation: 2, legitimateInterest: 1, withProblems: 3 })
  })
})

describe("štvrťrok", () => {
  it("kľúč kvartálu", () => {
    expect(quarterKey(Y("2026-10-01"))).toBe("2026-Q4")
    expect(quarterKey(Y("2027-03-31"))).toBe("2027-Q1")
  })
  it("posiela sa len v prvý deň kvartálu", () => {
    expect(isQuarterStart(Y("2026-10-01"))).toBe(true)
    expect(isQuarterStart(Y("2026-11-01"))).toBe(false)
    expect(isQuarterStart(Y("2026-10-02"))).toBe(false)
  })
})

describe("rola a e-mail", () => {
  it("rola dpo", () => {
    expect(isDpo({ roles: [DPO_ROLE] })).toBe(true)
    expect(isDpo({ roles: ["hr"] })).toBe(false)
  })
  it("e-mail nesie len počty, nie názvy predpisov", () => {
    const m = dpoReportEmail("https://x/dpo", "x", "2026-Q4", { total: 4, legalObligation: 2, legitimateInterest: 1, withProblems: 3 }, "sk")
    expect(m.subject).toContain("2026-Q4")
    expect(m.text).toContain("s nedostatkom: 3")
    expect(m.text).toContain("https://x/dpo")
  })
})

describe("výkaz s hľadaním (DPO-vykaz-hladanie)", () => {
  const JL = { fullName: "Ján Letko", email: "jan.letko@sfz.sk" }
  const MH = { fullName: "Marek Horák", email: "Marek.Horak@sfz.sk" }
  const r = (title: string, over: Partial<LegalBasisRow> = {}): LegalBasisRow => ({
    documentId: title, title, versionId: "v1", versionLabel: "1.0", effectiveFrom: null,
    legalBasis: null, categories: [], basisLabel: null, reference: null,
    responsible: JL, problems: ["noBasis"], ...over,
  })
  const rows = [
    r("Registračný a prestupový poriadok", { responsible: MH }),
    r("Disciplinárny poriadok"),
    r("Pracovný poriadok", {
      legalBasis: "legal_obligation", categories: ["legal_obligation"], basisLabel: "Oboznámenie pri nástupe",
      reference: "§ 47 Zákonníka práce", problems: [],
    }),
    r("Finančná smernica", { legalBasis: "legitimate_interest", categories: ["legitimate_interest"], problems: [] }),
    r("Volebný poriadok", { responsible: null, problems: ["noBasis", "noResponsible"] }),
  ]

  it("adresa: neznáme hodnoty sa ignorujú, predvolené zoskupenie je podľa osoby", () => {
    expect(parseDpoQuery({ state: "x", basis: "y", person: "nie-adresa", group: "z" }))
      .toEqual({ q: "", state: undefined, basis: undefined, person: undefined, group: "person" })
    expect(parseDpoQuery({ q: " prestup ", state: "ok", basis: "none", person: "Jan.Letko@SFZ.sk", group: "state" }))
      .toEqual({ q: "prestup", state: "ok", basis: "none", person: "jan.letko@sfz.sk", group: "state" })
  })

  it("hľadá v názve, základe, odkaze aj mene — bez diakritiky a veľkosti písmen", () => {
    const find = (q: string) => searchLegalBasisRows(rows, q).map(x => x.title)
    expect(find("PRESTUP")).toEqual(["Registračný a prestupový poriadok"])
    expect(find("nastupe")).toEqual(["Pracovný poriadok"])
    expect(find("zakonnika")).toEqual(["Pracovný poriadok"])
    expect(find("horak")).toEqual(["Registračný a prestupový poriadok"])
    // Každé slovo musí sedieť.
    expect(find("poriadok letko")).toEqual(["Disciplinárny poriadok", "Pracovný poriadok"])
  })

  it("filtre stav, základ a osoba", () => {
    const q = (o: Record<string, string>) => filterLegalBasisRows(rows, parseDpoQuery(o)).map(x => x.title)
    expect(q({ state: "ok" })).toEqual(["Pracovný poriadok", "Finančná smernica"])
    expect(q({ basis: "none" })).toHaveLength(3)
    expect(q({ basis: "legitimateInterest" })).toEqual(["Finančná smernica"])
    expect(q({ person: "marek.horak@sfz.sk" })).toEqual(["Registračný a prestupový poriadok"])
    expect(q({ q: "poriadok", state: "problems", person: "jan.letko@sfz.sk" })).toEqual(["Disciplinárny poriadok"])
  })

  it("počty: z výsledku hľadania, každá skupina bez vlastného filtra", () => {
    const f = dpoFacets(rows, parseDpoQuery({ state: "problems" }))
    // Stav ráta bez filtra stavu — „V poriadku" ukáže 2, nie 0.
    expect(f.state).toEqual({ all: 5, problems: 3, ok: 2 })
    // Základ a osoba sú už zúžené na nedostatky.
    expect(f.basis).toEqual({ all: 3, legalObligation: 0, legitimateInterest: 0, none: 3 })
    expect(f.person.people).toEqual([
      { email: "jan.letko@sfz.sk", fullName: "Ján Letko", count: 1 },
      { email: "marek.horak@sfz.sk", fullName: "Marek Horák", count: 1 },
    ])
    expect(dpoFacets(rows, parseDpoQuery({ q: "prestup" })).state.all).toBe(1)
  })

  it("zvolená osoba ostáva vo filtroch aj s nulou", () => {
    const f = dpoFacets(rows, parseDpoQuery({ q: "volebny", person: "marek.horak@sfz.sk" }))
    expect(f.person.people).toContainEqual({ email: "marek.horak@sfz.sk", fullName: "Marek Horák", count: 0 })
  })

  it("podľa osoby: bez osoby prvá, v osobe najprv s nedostatkom", () => {
    const g = groupByPerson(rows)
    expect(g.map(x => x.person?.fullName ?? null)).toEqual([null, "Ján Letko", "Marek Horák"])
    expect(g[1].rows.map(x => x.title)).toEqual(["Disciplinárny poriadok", "Finančná smernica", "Pracovný poriadok"])
    expect(g[1].bad).toBe(1)
  })

  const texts = { subject: "Predmet", body: (l: string) => `Zoznam:\n${l}`, bodyLink: (n: number, u: string) => `${n} → ${u}` }

  it("mailto do 25 predpisov nesie zoznam s nedostatkom", () => {
    const href = personMailto(groupByPerson(rows)[1], texts, "https://intranet.sfz.sk")!
    expect(href.startsWith("mailto:jan.letko@sfz.sk?subject=Predmet&body=")).toBe(true)
    expect(decodeURIComponent(href.split("body=")[1])).toBe("Zoznam:\n- Disciplinárny poriadok")
  })

  it("nad 25 len počet a odkaz na výkaz osoby; bez nedostatku a bez osoby nič", () => {
    const many = Array.from({ length: MAIL_LIST_MAX + 1 }, (_, i) => r(`P${i}`))
    const href = personMailto(groupByPerson(many)[0], texts, "https://intranet.sfz.sk")!
    expect(decodeURIComponent(href.split("body=")[1])).toBe("26 → https://intranet.sfz.sk/dpo?person=jan.letko%40sfz.sk")
    expect(personMailto({ person: JL, rows: [], bad: 0 }, texts, "x")).toBeNull()
    expect(personMailto(groupByPerson(rows)[0], texts, "x")).toBeNull()
  })

  it("odkaz nesie dopyt a predvolené zoskupenie do adresy nepíše", () => {
    const q = parseDpoQuery({ q: "a b", state: "ok" })
    expect(dpoHref(q)).toBe("/dpo?q=a+b&state=ok")
    expect(dpoHref(q, { state: undefined, group: "state" })).toBe("/dpo?q=a+b&group=state")
    expect(dpoHref(parseDpoQuery({}))).toBe("/dpo")
  })

  it("zvýraznenie bez diakritiky, s pôvodnými znakmi", () => {
    expect(highlight("Registračný a prestupový", "PRESTUPOVY")).toEqual([
      { text: "Registračný a ", hit: false }, { text: "prestupový", hit: true },
    ])
    expect(highlight("<b>", "")).toEqual([{ text: "<b>", hit: false }])
  })
})
