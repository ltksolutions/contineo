/**
 * widgetHistory.test.ts — história otázok vo widgete (ADR-042, Dodatok 2, D288).
 */

import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/mongodb", () => ({ getCollection: async () => { throw new Error("bez databázy") } }))
const { widgetAskerFilter, askerFilter } = await import("../src/lib/askHistory")

describe("widgetAskerFilter", () => {
  it("vlastné neskryté otázky osoby, ale len verejné — interné z intranetu do cudzieho systému nejdú", () => {
    const f = widgetAskerFilter("SFZ", "p1")
    expect(f).toMatchObject({ ...askerFilter("SFZ", "p1"), askerAccessLevel: "public" })
    expect(f).toHaveProperty("hiddenForAsker", { $ne: true })
  })
})
