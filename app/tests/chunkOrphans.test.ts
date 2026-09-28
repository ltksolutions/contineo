/**
 * chunkOrphans.test.ts — pravidlo, ktoré úseky sa smú zmazať ako osirelé.
 */
import { describe, it, expect } from "vitest"
import { orphanVerdict, versionIndex } from "../src/lib/chunkOrphans"

const docs = [
  { documentId: "sfz:stanovy", versions: [{ versionId: "v-stanovy-1" }, { versionId: "v-stanovy-2" }] },
  { documentId: "sfz:sp", versions: [{ versionId: "v-sp-1" }] },
]
const { versionsByDocument, allVersionIds } = versionIndex(docs)
const verdict = (c: Parameters<typeof orphanVerdict>[0]) => orphanVerdict(c, versionsByDocument, allVersionIds)

describe("osirelé úseky", () => {
  it("neaktívny úsek zmazaného dokumentu je osirelý", () => {
    expect(verdict({ documentId: "sfz:zmazany", versionId: "v-x", isActive: false }))
      .toEqual({ orphan: true, reason: "document-missing" })
  })

  it("neaktívny úsek staršieho indexovania existujúceho dokumentu je osirelý", () => {
    expect(verdict({ documentId: "sfz:stanovy", versionId: "v-stary-odtlacok", isActive: false }))
      .toEqual({ orphan: true, reason: "version-missing" })
  })

  it("úsek existujúceho znenia sa nemaže — ani nahradeného, ani so starším členením", () => {
    expect(verdict({ documentId: "sfz:stanovy", versionId: "v-stanovy-1", isActive: false }).orphan).toBe(false)
  })

  it("znenie pod iným identifikátorom dokumentu ho tiež drží (D80)", () => {
    expect(verdict({ documentId: "sfz:stary_kluc", versionId: "v-sp-1", isActive: false }).orphan).toBe(false)
  })

  it("aktívny úsek sa nemaže, ani keď mu znenie chýba", () => {
    expect(verdict({ documentId: "sfz:zmazany", versionId: "v-x", isActive: true }).orphan).toBe(false)
    expect(verdict({ documentId: "sfz:zmazany", versionId: "v-x" }).orphan).toBe(false)
  })

  it("overená odpoveď a úsek bez znenia sa nemažú", () => {
    expect(verdict({ documentId: "sfz:zmazany", versionId: "v-x", isActive: false, sourceType: "qa" }).orphan).toBe(false)
    expect(verdict({ documentId: "sfz:zmazany", versionId: "", isActive: false }).orphan).toBe(false)
    expect(verdict({ documentId: "sfz:zmazany", versionId: null, isActive: false }).orphan).toBe(false)
  })
})
