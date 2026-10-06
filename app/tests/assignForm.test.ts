/**
 * assignForm.test.ts — `/hr/assign` s hľadaním (HR-pridelit-normy-hladanie).
 *
 * Poradie zoznamov, súhrn výberu a zoznam noriem s hľadaním. Dopad (počet
 * ľudí) tu nie je — ten počíta len server cez `matchesAudience()`.
 */
import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { sortDocumentsByEffective, sortPeopleBySurname } from "../src/lib/assignOrder"
import { audienceKeys, audienceSignature, selectionCounts } from "../src/lib/assignSummary"
import { audienceFromSelection } from "../src/lib/assignments"
import { ListSearchView } from "../src/components/PeopleSearch"

describe("poradie", () => {
  it("normy: najnovšie účinné znenie hore, pri zhode abecedne", () => {
    const docs = [
      { title: "Stanovy SFZ", effectiveFrom: new Date("2025-06-12") },
      { title: "Pracovný poriadok SFZ", effectiveFrom: new Date("2026-09-07") },
      { title: "Finančná smernica SFZ", effectiveFrom: new Date("2026-09-07") },
      { title: "Etický kódex SFZ", effectiveFrom: new Date("2024-01-01") },
    ]
    expect(sortDocumentsByEffective(docs).map(d => d.title)).toEqual([
      "Finančná smernica SFZ", "Pracovný poriadok SFZ", "Stanovy SFZ", "Etický kódex SFZ",
    ])
  })

  it("osoby: podľa priezviska slovensky (č po c), pri zhode podľa mena, bez priezviska z celého mena", () => {
    const people = [
      { fullName: "Emma Čačaná", surname: "Čačaná" },
      { fullName: "Darina Škodlerová", surname: "Škodlerová" },
      { fullName: "Ján Cibula" },                        // bez `surname` → splitFullName
      { fullName: "Zuzana Rybárová", surname: "Rybárová" },
      { fullName: "Andrea Rybárová", surname: "Rybárová" },
      { fullName: "Madonna" },                           // jedno slovo → celé meno
      { fullName: "Stanislav Sokol", surname: "Sokol" },
    ]
    expect(sortPeopleBySurname(people).map(p => p.fullName)).toEqual([
      "Ján Cibula", "Emma Čačaná", "Madonna", "Andrea Rybárová", "Zuzana Rybárová", "Stanislav Sokol", "Darina Škodlerová",
    ])
  })
})

describe("súhrn výberu", () => {
  const sel = {
    all: false,
    audience: ["department:d1", "department:d2", "track:rozhodcovia-2026", "person:Jozef@SFZ.sk", "person:zle", "group:"],
    addresses: "jozef@sfz.sk, eva@sfz.sk\nnie-adresa",
    documents: ["rpp", "dp", "rpp"],
  }

  it("rozklad publík je ten istý ako na serveri (`audienceFromSelection`)", () => {
    const server = audienceFromSelection({ selected: sel.audience, addresses: sel.addresses })
      .map(a => `${a.kind}:${a.value}`).sort()
    expect([...audienceKeys(sel)].sort()).toEqual(server)
    expect(audienceKeys({ ...sel, all: true })).toEqual(["all"])
  })

  it("počty: normy bez duplicít, osoba zo zoznamu a z adries raz", () => {
    expect(selectionCounts(sel)).toEqual({ documents: 2, all: false, departments: 2, groups: 0, tracks: 1, people: 2 })
  })

  it("podpis nezávisí od poradia ani od noriem — dopad je len o publiku", () => {
    const a = audienceSignature(sel)
    expect(audienceSignature({ ...sel, audience: [...sel.audience].reverse() })).toBe(a)
    expect(audienceSignature({ ...sel, addresses: "eva@sfz.sk" })).toBe(a)
    expect(audienceSignature({ ...sel, audience: sel.audience.slice(1) })).not.toBe(a)
  })
})

describe("normy s hľadaním", () => {
  const items = Array.from({ length: 9 }, (_, i) => ({
    id: `d${i}`,
    name: i === 0 ? "Registračný a prestupový poriadok SFZ" : `Smernica č. ${i}`,
    meta: [`znenie účinné od ${i + 1}. 1. 2026`],
    flagged: i % 3 === 0,
  }))
  const view = (over: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(ListSearchView, {
    kind: "documents", items, name: "document", language: "sk", multiple: true, listLabel: "Ktoré normy",
    listClassName: "assign-doc-list", interactive: true, query: "", selected: ["d0", "d4"], ...over,
  }))

  it("riadok .hr-doc s poľom `document`, štítkom a znením; čipy „Vybrané (n)\"", () => {
    const html = view()
    expect(html).toContain('class="approval-people assign-doc-list"')
    // Riadok výberu s kruhom vľavo (ZAKLAD-vyber-a-prepinace).
    expect(html).toMatch(/<label class="form-row select-row hr-doc"><input type="checkbox" name="document"[^>]*value="d0"/)
    expect(html).toContain("bez právneho základu")
    expect(html).toContain("znenie účinné od 1. 1. 2026")
    expect(html).toContain("Vybrané (2)")
    expect(html).toContain("len bez právneho základu (3)")
  })

  it("hľadá v názve bez diakritiky; odfiltrovaná vybraná norma ostáva vo formulári", () => {
    const html = view({ query: "registracny" })
    expect(html).toContain("1 z 9")
    const d4 = html.slice(html.indexOf('value="d4"') - 80, html.indexOf('value="d4"'))
    expect(d4).toContain("hidden")
    expect(html).toMatch(/value="d4"/)
  })

  it("filter len bez právneho základu a prázdny výsledok s dôvodom", () => {
    expect(view({ onlyFlagged: true })).toContain("zobraziť všetky")
    expect(view({ onlyFlagged: true })).toContain("3 z 9")
    expect(view({ query: "hazard" })).toContain("Nič nevyhovuje „hazard“. Prideliť sa dá len platné znenie.")
  })

  it("bez JS (pred hydratáciou) len zoznam — bez poľa, čipov a filtra", () => {
    const html = view({ interactive: false })
    expect(html).not.toContain('type="search"')
    expect(html).not.toContain("Vybrané")
    expect(html).not.toContain("len bez právneho")
    expect(html).not.toContain("hidden")
  })
})

describe("„Všetkým v organizácii\" ako prepínač (ZAKLAD-vyber-a-prepinace, Q2)", () => {
  it("natívny checkbox s role=switch, to isté meno a hodnota", async () => {
    const { AudienceAll } = await import("../src/components/AssignForm")
    const html = renderToStaticMarkup(createElement(AudienceAll, { label: "Všetkým", note: "prebije výber", defaultChecked: true, children: "x" }))
    expect(html).toMatch(/<label class="form-row"><input type="checkbox" role="switch" class="toggle"[^>]*name="all"[^>]*value="1"/)
    expect(html).toMatch(/checked=""/)
    expect(html).toContain('<span class="form-row-sub">prebije výber</span>')
  })
})
