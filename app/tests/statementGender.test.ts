/**
 * statementGender.test.ts — formulka potvrdenia podľa rodu (D152, 30. 9. 2026).
 *
 * Formulka sa ukladá doslovne a spätne sa nemení (D28), takže nesprávny tvar
 * („oboznámil" pri žene) by v zázname ostal navždy. Pravidlo je to isté ako
 * na certifikáte: muž / žena / nevyplnené = tvar so zátvorkou.
 */
import { describe, it, expect } from "vitest"
import { buildStatement } from "../src/lib/acknowledgements"

const DAY = new Date("2026-07-01T10:00:00Z")
// Dátum sa formátuje s nezalomiteľnými medzerami — porovnáva sa text, nie typ medzery.
const plain = (text: string) => text.replace(/\u00a0/g, " ")

describe("formulka podľa rodu", () => {
  it("slovenčina: muž, žena, nevyplnené", () => {
    expect(plain(buildStatement("Poriadok", DAY, "sk", "male")))
      .toBe("Potvrdzujem, že som sa oboznámil s dokumentom „Poriadok\" v znení účinnom od 1. 7. 2026, porozumel som jeho obsahu a zaväzujem sa ho dodržiavať.")
    expect(plain(buildStatement("Poriadok", DAY, "sk", "female")))
      .toBe("Potvrdzujem, že som sa oboznámila s dokumentom „Poriadok\" v znení účinnom od 1. 7. 2026, porozumela som jeho obsahu a zaväzujem sa ho dodržiavať.")
    expect(buildStatement("Poriadok", DAY, "sk"))
      .toContain("som sa oboznámil(a) s dokumentom")
    expect(buildStatement("Poriadok", DAY, "sk", null)).toContain("porozumel(a) som")
  })

  it("čeština má ten istý rod", () => {
    expect(buildStatement("Řád", DAY, "cs", "female")).toContain("jsem se seznámila s dokumentem")
    expect(buildStatement("Řád", DAY, "cs", "female")).toContain("porozuměla jsem")
    expect(buildStatement("Řád", DAY, "cs", "male")).toContain("jsem se seznámil s dokumentem")
    expect(buildStatement("Řád", DAY, "cs")).toContain("seznámil(a)")
  })

  it("angličtina rod nemá — text je pre všetkých rovnaký", () => {
    const male = buildStatement("Rules", DAY, "en", "male")
    expect(buildStatement("Rules", DAY, "en", "female")).toBe(male)
    expect(buildStatement("Rules", DAY, "en")).toBe(male)
  })

  it("neznáma hodnota sa správa ako nevyplnené, nie ako muž", () => {
    expect(buildStatement("Poriadok", DAY, "sk", "other")).toContain("oboznámil(a)")
  })
})
