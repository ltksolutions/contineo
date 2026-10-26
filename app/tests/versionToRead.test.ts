/**
 * versionToRead.test.ts — znenia pre čitateľa (ADR-041, D272): vydané
 * znenia aj staršie a budúce, koncept nikdy; vyžiadané znenie má prednosť,
 * neznáme padá na platné.
 */
import { describe, it, expect } from "vitest"
import { readableVersions, versionToRead, versionState, type DocumentRecord, type Version } from "../src/lib/documents"

const d = (s: string) => new Date(s)
const v = (versionId: string, extra: Partial<Version>): Version =>
  ({ versionId, label: versionId, effectiveFrom: null, effectiveTo: null, isActive: false, ...extra }) as Version

const doc: DocumentRecord = {
  documentId: "sfz:smernica",
  title: "Smernica",
  companyCode: "sfz",
  versions: [
    v("2024-01", { effectiveFrom: d("2024-01-01"), effectiveTo: d("2025-07-01"), isActive: false }),
    v("2025-07", { effectiveFrom: d("2025-07-01"), effectiveTo: d("2026-01-01"), isActive: false }),
    v("2026-01", { effectiveFrom: d("2026-01-01"), isActive: true }),
    v("2027-01", { effectiveFrom: d("2027-01-01"), isActive: true }),
    v("koncept", { isActive: false }),
    v("bez-platnosti", { isActive: true }),
  ],
}
const now = d("2026-10-26")

describe("readableVersions", () => {
  it("vracia vydané znenia vrátane starších a budúcich, najnovšie prvé", () => {
    expect(readableVersions(doc).map(x => x.versionId)).toEqual(["2027-01", "2026-01", "2025-07", "2024-01"])
  })
  it("koncept a znenie bez platnosti čitateľ nevidí", () => {
    const ids = readableVersions(doc).map(x => x.versionId)
    expect(ids).not.toContain("koncept")
    expect(ids).not.toContain("bez-platnosti")
  })
})

describe("versionToRead", () => {
  it("bez parametra je to platné znenie", () => {
    expect(versionToRead(doc, undefined, now)?.versionId).toBe("2026-01")
  })
  it("vyžiadané staršie aj budúce znenie má prednosť", () => {
    expect(versionToRead(doc, "2025-07", now)?.versionId).toBe("2025-07")
    expect(versionToRead(doc, "2027-01", now)?.versionId).toBe("2027-01")
  })
  it("koncept ani neznámy identifikátor sa nedá vyžiadať — padá na platné", () => {
    expect(versionToRead(doc, "koncept", now)?.versionId).toBe("2026-01")
    expect(versionToRead(doc, "nic", now)?.versionId).toBe("2026-01")
  })
  it("dokument bez platného znenia dá null", () => {
    expect(versionToRead({ ...doc, versions: [doc.versions![4]] }, undefined, now)).toBeNull()
  })
})

describe("versionState", () => {
  it("rozlíši budúce, minulé a dnešné", () => {
    expect(versionState(doc.versions![3], now)).toBe("later")
    expect(versionState(doc.versions![1], now)).toBe("past")
    expect(versionState(doc.versions![2], now)).toBe("now")
  })
})
