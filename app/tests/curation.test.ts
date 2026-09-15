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
