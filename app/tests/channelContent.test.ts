/**
 * channelContent.test.ts — úroveň kanála a dôvody vynechania v náhľade
 * (Ján 8. 10. 2026). Widget je verejný vždy; portál predvolene verejný.
 */

import { describe, it, expect } from "vitest"
import { excludedReason } from "../src/lib/channelContent"
import { channelAccessLevel } from "../src/lib/channels"

const day = new Date("2026-10-08T12:00:00Z")
const ver = (from: string | null, to: string | null = null) => ({ versionId: "v1", label: "1.0", isActive: true, effectiveFrom: from ? new Date(from) : null, effectiveTo: to ? new Date(to) : null })

describe("úroveň kanála", () => {
  it("widget je verejný vždy, aj s internal v zázname", () => {
    expect(channelAccessLevel({ kind: "widget", accessLevel: "internal" })).toBe("public")
  })
  it("portál podľa nastavenia, predvolene verejný", () => {
    expect(channelAccessLevel({ kind: "portal" })).toBe("public")
    expect(channelAccessLevel({ kind: "portal", accessLevel: "internal" })).toBe("internal")
  })
})

describe("dôvod vynechania", () => {
  it("koncept bez znenia", () => {
    expect(excludedReason({ documentId: "a", title: "A", versions: [] } as never, "public", day)).toBe("draft")
  })
  it("znenie ešte neplatí", () => {
    expect(excludedReason({ documentId: "a", accessLevel: "public", versions: [ver("2027-01-01")] } as never, "public", day)).toBe("notEffective")
  })
  it("interný dokument vo verejnom kanáli, v internom prejde", () => {
    const d = { documentId: "a", accessLevel: "internal", versions: [ver("2026-01-01")] } as never
    expect(excludedReason(d, "public", day)).toBe("internal")
    expect(excludedReason(d, "internal", day)).toBeNull()
  })
  it("verejný platný dokument prejde", () => {
    expect(excludedReason({ documentId: "a", accessLevel: "public", versions: [ver("2026-01-01")] } as never, "public", day)).toBeNull()
  })
})
