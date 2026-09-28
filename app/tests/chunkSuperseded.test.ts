/**
 * chunkSuperseded.test.ts — rozlíšenie nahradeného znenia od nahradeného
 * členenia (plán „znenia v indexe", krok 2).
 */
import { describe, it, expect } from "vitest"
import { classifyChunkings } from "../src/lib/chunkSuperseded"

const d = (s: string) => new Date(s)

describe("platné a nahradené členenie", () => {
  it("úseky nahradeného znenia zostávajú platným členením toho znenia", () => {
    const r = classifyChunkings([
      { _id: "old-1", versionId: "v1", chunkingId: "c1", isActive: false, createdAt: d("2026-01-01") },
      { _id: "new-1", versionId: "v2", chunkingId: "c2", isActive: true, createdAt: d("2026-09-01") },
    ])
    expect(r.current.sort()).toEqual(["new-1", "old-1"])
    expect(r.superseded).toEqual([])
  })

  it("staršie členenie platného znenia je nahradené", () => {
    const r = classifyChunkings([
      { _id: "a", versionId: "v1", chunkingId: "c-stary", isActive: false, createdAt: d("2026-05-01") },
      { _id: "b", versionId: "v1", chunkingId: "c-novy", isActive: true, createdAt: d("2026-09-01") },
    ])
    expect(r.current).toEqual(["b"])
    expect(r.superseded).toEqual(["a"])
  })

  it("pri nahradenom znení s dvomi členeniami platí to najnovšie", () => {
    const r = classifyChunkings([
      { _id: "x", versionId: "v1", chunkingId: "c1", isActive: false, createdAt: d("2026-02-01") },
      { _id: "y", versionId: "v1", chunkingId: "c2", isActive: false, embeddedAt: d("2026-03-01") },
    ])
    expect(r.current).toEqual(["y"])
    expect(r.superseded).toEqual(["x"])
  })

  it("overené odpovede a úseky bez znenia sa nezaraďujú", () => {
    const r = classifyChunkings([
      { _id: "qa", versionId: "v1", sourceType: "qa", isActive: false },
      { _id: "bez", versionId: null, isActive: false },
    ])
    expect(r).toEqual({ current: [], superseded: [] })
  })
})
