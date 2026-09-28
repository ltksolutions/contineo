/**
 * peopleStatus.test.ts — stav osoby na obrazovke (Ján 28. 9. 2026):
 * po importe „Nová", „Pozvaná" až keď pozvánka naozaj odišla; tlačidlo
 * pozvánky aj v zozname osôb.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { personDisplayStatus, personTagClass } from "../src/lib/persons"

const s = vi.hoisted(() => ({ people: [] as unknown[] }))
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound") }, redirect: (to: string) => { throw new Error(`redirect ${to}`) } }))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/LiveFilter", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/SubmitButton", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("../src/app/people/actions", () => ({ resendInviteAction: async () => {} }))
vi.mock("@/lib/people", () => ({
  peopleContext: async () => ({ state: "ready", person: { companyCode: "SFZ", language: "sk" }, tenant: { companyCode: "SFZ", branding: {}, codelists: {} } }),
  listPeople: async () => s.people,
}))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/codelistsTenant", () => ({ availableOptions: () => [] }))

const at = new Date("2026-09-28T08:00:00Z")
const row = (over: Record<string, unknown>) => ({
  id: "p", email: "a@sfz.sk", fullName: "Anna Nová", status: "invited", roles: [], groups: [], tracks: [], emailHistory: [], accounts: [], ...over,
})

describe("personDisplayStatus", () => {
  it("zapísaná bez odoslanej pozvánky = nová; po odoslaní pozvaná; ostatné bez zmeny", () => {
    expect(personDisplayStatus({ status: "invited" })).toBe("new")
    expect(personDisplayStatus({ status: "invited", invitationSentAt: at })).toBe("invited")
    expect(personDisplayStatus({ status: "active" })).toBe("active")
    expect(personDisplayStatus({ status: "inactive" })).toBe("inactive")
    expect(personTagClass({ status: "invited" })).toBe("tag tag--draft")
    expect(personTagClass({ status: "invited", invitationSentAt: at })).toBe("tag tag--review")
  })
})

describe("/people", () => {
  beforeEach(() => {
    s.people = [
      row({ id: "n", fullName: "Nová Osoba" }),
      row({ id: "i", fullName: "Pozvaná Osoba", invitationSentAt: at }),
      row({ id: "a", fullName: "Aktívna Osoba", status: "active", firstLoginAt: at, lastLoginAt: at }),
      row({ id: "x", fullName: "Vyradená Osoba", status: "inactive" }),
    ]
  })
  async function render() {
    const { default: Page } = await import("../src/app/people/page")
    return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ q: "osoba" }) }))
  }
  it("stav Nová / Pozvaná a tlačidlo pozvánky len tým, čo sa ešte neprihlásili", async () => {
    const html = await render()
    expect(html).toContain(">nová<")
    expect(html).toContain(">pozvaná<")
    expect(html).toContain(">Poslať pozvánku<")
    expect(html).toContain(">Poslať pozvánku znovu<")
    expect(html.match(/name="id" value="[a-z]"/g)).toEqual(['name="id" value="n"', 'name="id" value="i"'])
    expect(html).toContain('name="back" value="/people?q=osoba"')
  })
})
