/** personalData.test.ts — čistenie osobných údajov pravidlom (ADR-030; presunuté z faqMining, ADR-034). */
import { describe, it, expect } from "vitest"
import { scrubPersonalData } from "../src/lib/personalData"

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
  it("cislo od 6 cislic (registracne cislo, faktura) nahradi, rok a clanok nie", () => {
    expect(scrubPersonalData("Reg. č. 1234567, faktúra 2026001234, rok 2026, čl. 12")).toBe("Reg. č. [číslo], faktúra [číslo], rok 2026, čl. 12")
  })
  it("kratke cisla (clanok 12, rok 2026) necha", () => {
    expect(scrubPersonalData("čl. 12 ods. 3, sezóna 2026/2027")).toBe("čl. 12 ods. 3, sezóna 2026/2027")
  })
})
