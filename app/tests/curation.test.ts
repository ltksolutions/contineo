/**
 * curation.test.ts — co drzi vetu „unik cez accessLevel nikdy nesmie nastat".
 *
 * `strictestAccessLevel()` je jedine miesto, kde sa o pristupe k overenej
 * odpovedi rozhoduje. Nie je to pomocka, je to bezpecnostna funkcia, takze
 * sa testuje aj to, co sa „nema stat": prazdny zoznam, neznama hodnota,
 * null. Vsetky tri koncia na `internal` — nevediet znamena zavriet.
 */

import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))

import { strictestAccessLevel, QA_SOURCE_TYPE } from "../src/lib/curation"

describe("strictestAccessLevel", () => {
  it("verejne vyjde len vtedy, ked je verejny KAZDY zdroj", () => {
    expect(strictestAccessLevel(["public"])).toBe("public")
    expect(strictestAccessLevel(["public", "public", "public"])).toBe("public")
  })

  it("jediny interny zdroj rozhodne o celom pare", () => {
    // Overena odpoved napisana nad internym predpisom je interna, aj keby
    // vznikla popri desiatich verejnych.
    expect(strictestAccessLevel(["public", "internal"])).toBe("internal")
    expect(strictestAccessLevel(["internal", "public", "public"])).toBe("internal")
  })

  it("nevediet znamena zavriet, nie otvorit", () => {
    expect(strictestAccessLevel([])).toBe("internal")
    expect(strictestAccessLevel([undefined])).toBe("internal")
    expect(strictestAccessLevel([null])).toBe("internal")
    expect(strictestAccessLevel(["public", undefined])).toBe("internal")
  })

  it("neznama hodnota sa berie ako interna", () => {
    // Preklep, stare data, ina uroven v buducnosti — nic z toho sa nesmie
    // vyhodnotit ako „verejne".
    expect(strictestAccessLevel(["Public"])).toBe("internal")
    expect(strictestAccessLevel(["verejne"])).toBe("internal")
    expect(strictestAccessLevel([""])).toBe("internal")
  })

  it("oznacenie useku je stabilne", () => {
    // Podla neho filtruje kontrola invariantov aj archivacia pri zmene normy.
    expect(QA_SOURCE_TYPE).toBe("qa")
  })
})

describe("co sa deje, ked sa zmeni uroven zdroja", () => {
  /*
   * Toto nie je test funkcie, ale zapisane pravidlo. `saveMetadata()` meni
   * `accessLevel` na vsetkych usekoch dokumentu naraz; keby to zasiahlo aj
   * pary, par odvodeny z troch predpisov by prevzal uroven jedneho z nich.
   * Scenar nizsie je presne ten, ktory sa tym zavrel.
   */
  it("par z verejneho a interneho zdroja zostava interny aj po zverejneni jedneho z nich", () => {
    // Pred zmenou: jeden zdroj verejny, druhy interny -> par je interny.
    expect(strictestAccessLevel(["public", "internal"])).toBe("internal")
    // Druhy zdroj sa medzitym stal verejnym -> az teraz je par verejny.
    expect(strictestAccessLevel(["public", "public"])).toBe("public")
    // A naopak: sprisnenie ktorehokolvek zdroja par zavrie.
    expect(strictestAccessLevel(["public", "public", "internal"])).toBe("internal")
  })

  it("zdroj bez uskov sa pocita ako interny", () => {
    // Ked sa dokument prestane indexovat, jeho uroven sa neda zistit.
    // Prepocet vtedy dosadi prazdny retazec — a ten nie je „public".
    expect(strictestAccessLevel(["public", ""])).toBe("internal")
  })
})

