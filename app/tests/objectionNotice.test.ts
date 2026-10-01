/**
 * objectionNotice.test.ts — e-maily k námietke podanej v aplikácii (D153).
 *
 * Upozornenie DPO nesie meno a odkaz, **nie znenie** — to je osobný údaj
 * a zostáva v aplikácii. Potvrdenie osobe znenie nesie: je to jej doklad.
 */
import { describe, it, expect, vi } from "vitest"

// `tenants.ts` ťahá Reactovú `cache`, ktorá mimo servera nie je; tu ho netreba.
vi.mock("../src/lib/tenants", () => ({ brandingView: () => ({}) }))
const m = vi.hoisted(() => ({ notifyPeople: vi.fn(async () => {}), sent: [] as string[] }))
vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async () => ({
    find: () => ({ toArray: async () => [{ id: "p-dpo", email: "jan.letko@futbalsfz.sk", language: "sk" }] }),
  })),
}))
vi.mock("../src/lib/dpo", () => ({ DPO_ROLE: "dpo" }))
vi.mock("../src/lib/notifications", () => ({ notifyPeople: m.notifyPeople }))
vi.mock("../src/lib/ecomail", async orig => ({
  ...(await orig<typeof import("../src/lib/ecomail")>()),
  send: async (msg: { to: string }) => { m.sent.push(msg.to) },
}))
import { objectionRecipients, announceObjection } from "../src/lib/objectionNotice"
import { objectionNoticeEmail, objectionReceiptEmail } from "../src/lib/ecomail"

describe("príjemcovia upozornenia", () => {
  it("osoby s rolou DPO a kontakt GDPR, každá adresa raz", () => {
    const r = objectionRecipients(
      [{ email: "Jan.Letko@futbalsfz.sk", language: "sk" }, { email: "dpo2@futbalsfz.sk", language: "en" }],
      "gdpr@futbalsfz.sk", "sk",
    )
    expect(r).toEqual([
      { email: "jan.letko@futbalsfz.sk", language: "sk" },
      { email: "dpo2@futbalsfz.sk", language: "en" },
      { email: "gdpr@futbalsfz.sk", language: "sk" },
    ])
  })
  it("kontakt, ktorý je zároveň DPO, nedostane dva e-maily", () => {
    expect(objectionRecipients([{ email: "gdpr@futbalsfz.sk", language: "cs" }], "GDPR@futbalsfz.sk", "sk"))
      .toEqual([{ email: "gdpr@futbalsfz.sk", language: "cs" }])
  })
  it("bez kontaktu len DPO; bez oboch nikto", () => {
    expect(objectionRecipients([{ email: "a@b.sk", language: "sk" }], null, "sk")).toHaveLength(1)
    expect(objectionRecipients([], undefined, "sk")).toEqual([])
  })
})

describe("e-maily", () => {
  const branding = { displayName: "Intranet SFZ" }

  it("upozornenie DPO: meno, dátum a odkaz, bez znenia námietky", () => {
    const m = objectionNoticeEmail("https://intranet.futbalsfz.sk/dpo#objections", "intranet.futbalsfz.sk", "Ján Letko", "1. 10. 2026", "sk", branding)
    expect(m.subject).toBe("Nová námietka — Intranet SFZ")
    expect(m.text).toContain("Ján Letko podal(a) 1. 10. 2026")
    expect(m.html).toContain("https://intranet.futbalsfz.sk/dpo#objections")
    expect(m.text).not.toContain("Namietam")
  })
  it("potvrdenie osobe: znenie, dátum a kontakt; HTML escapované", () => {
    const m = objectionReceiptEmail("intranet.futbalsfz.sk", "1. 10. 2026", "Namietam <b>všetko</b>.", "gdpr@futbalsfz.sk", "sk", branding)
    expect(m.subject).toBe("Potvrdenie námietky — Intranet SFZ")
    expect(m.text).toContain("Namietam <b>všetko</b>.")
    expect(m.html).toContain("Namietam &lt;b&gt;všetko&lt;/b&gt;.")
    expect(m.text).toContain("Otázky posielajte na gdpr@futbalsfz.sk")
  })
  it("česky aj anglicky", () => {
    expect(objectionReceiptEmail("h", "1. 10. 2026", "x", null, "cs").subject).toContain("Potvrzení námitky")
    expect(objectionNoticeEmail("l", "h", "Jan", "1 Oct 2026", "en").subject).toContain("New objection")
  })
})

describe("announceObjection", () => {
  it("zvonček všetkým s rolou DPO (aj keď podal sám), e-maily DPO, kontaktu a podávajúcemu", async () => {
    const tenant = { companyCode: "SFZ", hostnames: ["intranet.futbalsfz.sk"], defaultLanguage: "sk", privacy: { contact: { email: "gdpr@futbalsfz.sk" } } }
    const objection = { personName: "Ján Letko", receivedAt: new Date("2026-10-01T15:48:00Z"), text: "Namietam." }
    await announceObjection(tenant as never, objection as never, { email: "jan.letko@futbalsfz.sk", language: "sk" })
    expect(m.notifyPeople).toHaveBeenCalledWith({ companyCode: "SFZ", personIds: ["p-dpo"], kind: "objectionSubmitted" })
    expect(m.sent).toEqual(["jan.letko@futbalsfz.sk", "gdpr@futbalsfz.sk", "jan.letko@futbalsfz.sk"])
  })
})
