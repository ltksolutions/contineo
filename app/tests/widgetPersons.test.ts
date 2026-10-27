/**
 * widgetPersons.test.ts — osoba z widgetu je e-mailový kontakt, účet ISSF
 * je údaj (ADR-042, D280).
 *
 * Jeden e-mail zdieľa viac účtov (rodič za deti): osoba je jedna, účty
 * pribúdajú do zoznamu, nič sa neprepisuje a meno ostáva z prvého tokenu.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import type { WidgetIdentity } from "../src/lib/widgetToken"

type Doc = Record<string, unknown> & { _id: number }
const store: Doc[] = []
const fake = {
  findOne: async (q: Record<string, unknown>) => store.find(d => Object.entries(q).every(([k, v]) => d[k] === v)) ?? null,
  insertOne: async (doc: Record<string, unknown>) => { store.push({ ...structuredClone(doc), _id: store.length + 1 }); return {} },
  updateOne: async (q: { _id: number }, u: { $set: Record<string, unknown> }) => {
    const d = store.find(x => x._id === q._id)!
    for (const [k, v] of Object.entries(u.$set)) {
      const parts = k.split(".")
      let cur = d as Record<string, unknown>
      for (const p of parts.slice(0, -1)) cur = (cur[p] ??= {}) as Record<string, unknown>
      cur[parts.at(-1)!] = v
    }
  },
}
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async () => fake) }))

const { ensureWidgetPerson, widgetRefs } = await import("../src/lib/widgetPersons")

const id = (over: Partial<WidgetIdentity>): WidgetIdentity => ({
  externalId: "1111111", email: "rodic@example.sk", givenName: "Peter", familyName: "Hráč", name: "Peter Hráč",
  roles: ["HRAC"], club: null, language: "sk", issuer: "https://issf.futbalsfz.sk", expiresAt: new Date(), ...over,
})
const refs = (d: Doc) => (d.externalRef as { widget: Record<string, unknown> }).widget.k

beforeEach(() => { store.length = 0 })

describe("ensureWidgetPerson", () => {
  it("nový kontakt: druh external, zoznam s jedným účtom, meno z tokenu", async () => {
    await ensureWidgetPerson("SFZ", "k", id({}), "sk")
    expect(store).toHaveLength(1)
    expect(store[0]).toMatchObject({ personType: "external", email: "rodic@example.sk", fullName: "Peter Hráč" })
    expect(refs(store[0])).toEqual(["1111111"])
  })

  it("dva účty z jednej adresy: jedna osoba, oba účty, nič sa neprepína ani neprepisuje", async () => {
    await ensureWidgetPerson("SFZ", "k", id({}), "sk")
    await ensureWidgetPerson("SFZ", "k", id({ externalId: "2222222", givenName: "Jana", familyName: "Hráčová", name: "Jana Hráčová" }), "sk")
    await ensureWidgetPerson("SFZ", "k", id({}), "sk")
    expect(store).toHaveLength(1)
    expect(refs(store[0])).toEqual(["1111111", "2222222"])
    expect(store[0].fullName).toBe("Peter Hráč")
  })

  it("reťazec spred migrácie sa prevedie na zoznam a účet sa pridá", async () => {
    store.push({ _id: 1, companyCode: "SFZ", email: "rodic@example.sk", personType: "external", fullName: "Peter Hráč", externalRef: { widget: { k: "1111111" } } })
    await ensureWidgetPerson("SFZ", "k", id({}), "sk")
    expect(refs(store[0])).toEqual(["1111111"])
    await ensureWidgetPerson("SFZ", "k", id({ externalId: "2222222" }), "sk")
    expect(refs(store[0])).toEqual(["1111111", "2222222"])
  })

  it("zamestnanec s rovnakou adresou: spáruje sa, druh a meno ostávajú", async () => {
    store.push({ _id: 1, companyCode: "SFZ", email: "rodic@example.sk", personType: "employee", fullName: "Zamestnanec SFZ", externalRef: {} })
    await ensureWidgetPerson("SFZ", "k", id({}), "sk")
    expect(store).toHaveLength(1)
    expect(store[0]).toMatchObject({ personType: "employee", fullName: "Zamestnanec SFZ" })
    expect(refs(store[0])).toEqual(["1111111"])
  })

  it("ten istý účet s inou adresou je iný kontakt — odpovedá sa na adresu", async () => {
    await ensureWidgetPerson("SFZ", "k", id({}), "sk")
    await ensureWidgetPerson("SFZ", "k", id({ email: "novy@example.sk" }), "sk")
    expect(store.map(d => d.email)).toEqual(["rodic@example.sk", "novy@example.sk"])
  })
})

describe("widgetRefs", () => {
  it("zoznam, reťazec aj nič", () => {
    expect(widgetRefs(["a", "b"])).toEqual(["a", "b"])
    expect(widgetRefs("a")).toEqual(["a"])
    expect(widgetRefs(undefined)).toEqual([])
  })
})
