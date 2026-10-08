/**
 * valueSelectRender.test.ts — `ValueSelect` (ZAKLAD-vyber-skupin-a-znaciek):
 * natívne checkboxy, zaškrtnuté hore, „len tu", pole novej hodnoty,
 * hľadanie až od 12 možností a prázdny stav.
 */
import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"

vi.mock("next/link", () => ({ default: ({ href, children, className }: { href: string; children: unknown; className?: string }) => createElement("a", { href, className }, children as never) }))

import ValueSelect, { SimilarWarning } from "../src/components/ValueSelect"

const render = (props: Partial<Parameters<typeof ValueSelect>[0]>) => renderToStaticMarkup(createElement(ValueSelect, {
  kind: "groups", name: "groups", legend: "Skupiny", options: [], selected: [], language: "sk", ...props,
}))

describe("ValueSelect", () => {
  it("zaškrtnuté hore, ostatné abecedne; počet a len tu", () => {
    const html = render({
      options: [{ value: "rozhodcovia", count: 14 }, { value: "delegati", count: 6 }, { value: "komisari", count: 1 }],
      selected: ["komisari", "vlastna"],
    })
    const order = [...html.matchAll(/name="groups"(?: checked="")? value="([^"]+)"/g)].map(m => m[1])
    expect(order).toEqual(["komisari", "vlastna", "delegati", "rozhodcovia"])
    expect(html).toContain("14 ľudí")
    expect(html.match(/len tu/g)).toHaveLength(2)
    // Jedno pole „Hľadať alebo pridať" navrchu karty pri každom počte (Q6).
    expect(html).toContain('<div class="sel-combo">')
    expect(html).toContain('placeholder="Hľadať alebo pridať skupinu"')
    expect(html).toContain('name="groupsNew"')
    expect(html).toContain("Nová skupina vznikne uložením osoby.")
  })

  it("prázdny zoznam: len pole novej hodnoty a veta, ako skupina vznikne", () => {
    const html = render({})
    expect(html).not.toContain('type="checkbox"')
    expect(html).toContain('placeholder="Pridať skupinu"')
    expect(html).toContain("Zatiaľ žiadna skupina")
  })

  it("varovanie pri podobnom názve s dvoma voľbami", () => {
    const html = renderToStaticMarkup(createElement(SimilarWarning, { href: "/people/p1", anchor: "groups", kind: "groups", similar: "rozhodcova", like: "rozhodcovia", language: "sk" }))
    expect(html).toContain("„rozhodcova“ sme neuložili")
    expect(html).toContain('href="/people/p1?similar=rozhodcova&amp;like=rozhodcovia&amp;pick=like#groups"')
    expect(html).toContain("pick=new#groups")
  })
})
