/**
 * savedAnswer.test.ts — uložená odpoveď pomenuje nové znenie
 * (ASK-historia-otazok, rám `/ask/a/{id}`).
 */

import { describe, it, expect } from "vitest"
import { newerVersions } from "../src/lib/savedAnswer"
import type { DocumentRecord } from "../src/lib/documents"

const D = (s: string) => new Date(`${s}T00:00:00Z`)
const doc = (versions: { label: string; from: string; active?: boolean; to?: string }[]) => ({
  documentId: "sfz:rp",
  title: "Registračný poriadok",
  versions: versions.map(v => ({
    versionId: v.label, label: v.label, isActive: v.active ?? true,
    effectiveFrom: D(v.from), effectiveTo: v.to ? D(v.to) : null,
  })),
}) as unknown as DocumentRecord

const source = { index: 1, title: "RP", documentId: "sfz:rp", version: { label: "2026/1", effectiveFrom: "2026-07-01", effectiveTo: null } }

describe("nové znenie od odpovede", () => {
  it("dokument má dnes neskoršie platné znenie → pomenuje ho", () => {
    const d = doc([{ label: "2026/1", from: "2026-07-01", active: false, to: "2026-10-01" }, { label: "2026/2", from: "2026-10-01" }])
    expect(newerVersions([source], [d], D("2026-11-01"))).toEqual([
      { documentId: "sfz:rp", title: "Registračný poriadok", label: "2026/2", effectiveFrom: D("2026-10-01") },
    ])
  })

  it("to isté znenie platí → nič", () => {
    expect(newerVersions([source], [doc([{ label: "2026/1", from: "2026-07-01" }])], D("2026-11-01"))).toEqual([])
  })

  it("novela ešte neplatí → nič", () => {
    const d = doc([{ label: "2026/1", from: "2026-07-01" }, { label: "2026/2", from: "2027-01-01" }])
    expect(newerVersions([source], [d], D("2026-11-01"))).toEqual([])
  })

  it("zdroj bez dokumentu alebo znenia sa neporovnáva", () => {
    const d = doc([{ label: "2026/2", from: "2026-10-01" }])
    expect(newerVersions([{ ...source, documentId: undefined }], [d], D("2026-11-01"))).toEqual([])
    expect(newerVersions([{ ...source, version: undefined }], [d], D("2026-11-01"))).toEqual([])
  })

  it("ten istý dokument v dvoch zdrojoch — jeden riadok", () => {
    const d = doc([{ label: "2026/2", from: "2026-10-01" }])
    expect(newerVersions([source, { ...source, index: 2 }], [d], D("2026-11-01"))).toHaveLength(1)
  })
})
