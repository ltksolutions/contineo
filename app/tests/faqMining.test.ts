/**
 * faqMining.test.ts — tazba historie schranky do navrhov FAQ (ADR-028, D165).
 *
 * Ciste casti: vlakna z sprav (len otazka + odpoved helpdesku), ocistenie
 * od osobnych udajov, prevod odpovede modelu na overene zaznamy.
 */

import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))

import { threadsFrom, scrubPersonalData, threadTranscript, parseMined } from "../src/lib/faqMining"
import type { MailMessage } from "../src/lib/mailbox/types"

const at = (h: number) => new Date(`2026-10-06T0${h}:00:00Z`)
const msg = (over: Partial<MailMessage>): MailMessage => ({
  id: "m", internetMessageId: "<m@x>", threadRef: "t1", from: { address: "a@klub.sk", name: "A" }, to: [],
  subject: "Registrácia", text: "Otázka?", receivedAt: at(1), outgoing: false, attachments: [], ...over,
})

describe("threadsFrom", () => {
  it("vlakno ma otazku zvonku a aspon jednu odpoved zo schranky; ostatne sa vynechaju", () => {
    const threads = threadsFrom([
      msg({ id: "1", internetMessageId: "<1>", text: "Ako registrovať hráča?" }),
      msg({ id: "2", internetMessageId: "<2>", outgoing: true, from: { address: "helpdesk@f.sk", name: null }, text: "Cez ISSF.\n\nOd: A\nOdoslané: …\n> Ako registrovať", receivedAt: at(2) }),
      msg({ id: "3", internetMessageId: "<3>", threadRef: "t2", text: "Bez odpovede" }),
      msg({ id: "4", internetMessageId: "<4>", threadRef: "t3", outgoing: true, text: "Interná pošta" }),
    ])
    expect(threads).toHaveLength(1)
    expect(threads[0].question).toBe("Ako registrovať hráča?")
    expect(threads[0].answers).toEqual(["Cez ISSF."])
    expect(threads[0].messageIds).toEqual(["<1>", "<2>"])
  })
})

describe("scrubPersonalData", () => {
  it("adresy, telefony, dlhe cisla, IBAN a odkazy", () => {
    const out = scrubPersonalData("Hráč Ján Novák, RČ 740911/1234, tel. +421 905 123 456, jan@novak.sk, IBAN SK31 1200 0000 1987 4263 7541, viď https://issf.futbalsfz.sk/x")
    expect(out).not.toContain("740911")
    expect(out).not.toContain("905 123")
    expect(out).not.toContain("jan@novak.sk")
    expect(out).not.toContain("1987 4263")
    expect(out).not.toContain("https://")
    expect(out).toContain("Ján Novák") // mena pravidlo nechyti — o tie sa stara pokyn a schvalenie
  })
  it("kratke cisla (clanok 12, rok 2026) necha", () => {
    expect(scrubPersonalData("čl. 12 ods. 3, sezóna 2026/2027")).toBe("čl. 12 ods. 3, sezóna 2026/2027")
  })
})

describe("threadTranscript + parseMined", () => {
  it("prepis cisluje vlakna a model vracia zaznamy s odkazom na ne", () => {
    const t = threadsFrom([msg({ id: "1" }), msg({ id: "2", outgoing: true, text: "Odpoveď", receivedAt: at(2) })])[0]
    expect(threadTranscript(t, 0)).toContain("### Vlákno 1")
    const mined = parseMined({ entries: [
      { question: "Ako registrovať hráča?", variants: ["Registrácia"], answer: "Cez ISSF.", audience: ["klubový manažér"], threads: [1, 7] },
      { question: "", answer: "bez otázky", variants: [], audience: [], threads: [] },
    ] }, 1)
    expect(mined).toHaveLength(1)
    expect(mined[0].threadIndexes).toEqual([0])
    expect(mined[0].sources).toEqual([])
    expect(parseMined("nonsense", 1)).toEqual([])
  })
})
