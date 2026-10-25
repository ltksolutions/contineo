/**
 * webImport.test.ts — odber do knižnice z katalógu (ADR-039 fáza 2, D260):
 * znenie katalógu má tvar riadku histórie z ADR-037, takže výber znenia
 * účinného dnes a znení vyhlásených vopred ostáva tou istou funkciou.
 */

import { describe, it, expect } from "vitest"
import { rowOf } from "../src/lib/webImport"
import { effectiveRow, newerRows } from "../src/lib/slovLex"

describe("znenie katalógu ako riadok histórie", () => {
  const rows = [
    rowOf({ timepoint: "20160101", effectiveFrom: new Date("2016-01-01"), effectiveTo: new Date("2025-12-31"), amendment: null }),
    rowOf({ timepoint: "20260101", effectiveFrom: new Date("2026-01-01"), effectiveTo: null, amendment: "104/2025 Z. z." }),
    rowOf({ timepoint: "20270101", effectiveFrom: new Date("2027-01-01"), effectiveTo: null, amendment: "9/2026 Z. z." }),
  ]
  it("dátumy ako ISO deň, koniec účinnosti len keď je", () => {
    expect(rows[0]).toEqual({ timepoint: "20160101", effectiveFrom: "2016-01-01", effectiveTo: "2025-12-31", amendment: null })
    expect(rows[1].effectiveTo).toBeNull()
  })
  it("znenie účinné dnes a znenia vyhlásené vopred — tie isté pravidlá ako pri portáli", () => {
    expect(effectiveRow(rows, new Date("2026-10-26"))?.timepoint).toBe("20260101")
    expect(newerRows(rows, "20260101").map(r => r.timepoint)).toEqual(["20270101"])
  })
})
