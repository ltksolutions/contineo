/**
 * complianceNextFinding.test.ts — „Uložiť a ďalší" pri identifikátore
 * dokumentu s dvojbodkou (18. 10. 2026).
 */
import { describe, it, expect } from "vitest"
import { parseNextFinding } from "../src/lib/complianceView"

describe("parseNextFinding", () => {
  it("delí podľa poslednej dvojbodky", () => {
    expect(parseNextFinding("sfz:issf_00_prehlad:f003")).toEqual({ documentId: "sfz:issf_00_prehlad", findingId: "f003" })
  })
  it("prázdne alebo bez dvojbodky — nič", () => {
    expect(parseNextFinding("")).toEqual({ documentId: "", findingId: "" })
    expect(parseNextFinding("f003")).toEqual({ documentId: "", findingId: "" })
  })
})
