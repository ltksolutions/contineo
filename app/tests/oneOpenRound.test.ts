/**
 * oneOpenRound.test.ts — jedno bežiace kolo schvaľovania na dokument
 * (Ján 12. 10. 2026). Kolo starej podoby konceptu sa po zmene uzavrie a
 * druhé kolo vedľa bežiaceho sa predložiť nedá. 11. 10. 2026 boli ISSF-04
 * a ISSF-05 v „čaká na schválenie" dvakrát — jedno kolo patrilo starému PDF.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

type Row = Record<string, unknown>
const db = vi.hoisted(() => ({ cols: {} as Record<string, Row[]>, notified: [] as Row[], audit: [] as Row[] }))

function matches(row: Row, filter: Row): boolean {
  return Object.entries(filter).every(([k, v]) => {
    const value = row[k]
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      const op = v as Row
      if ("$ne" in op) return value !== op.$ne
      if ("$in" in op) return (op.$in as unknown[]).includes(value)
    }
    return value === v
  })
}

vi.mock("../src/lib/mongodb", () => ({
  getCollection: async (name: string) => {
    const rows = (db.cols[name] ??= [])
    return {
      findOne: async (f: Row) => rows.find(r => matches(r, f)) ?? null,
      find: (f: Row) => ({ toArray: async () => rows.filter(r => matches(r, f)), sort: () => ({ toArray: async () => rows.filter(r => matches(r, f)) }) }),
      updateOne: async (f: Row, u: { $set: Row }) => {
        const r = rows.find(x => matches(x, f))
        if (r) Object.assign(r, u.$set)
        return { matchedCount: r ? 1 : 0, modifiedCount: r ? 1 : 0 }
      },
      insertOne: async (r: Row) => { rows.push(r) },
    }
  },
}))
vi.mock("../src/lib/audit", () => ({ writeAudit: async (r: Row) => { db.audit.push(r) } }))
vi.mock("../src/lib/notifications", () => ({ notifyPeople: async (r: Row) => { db.notified.push(r) } }))

import { documentDraftIdentity } from "../src/lib/versionMeta"

const pdf = (sha: string) => ({ id: sha, name: "a.pdf", sha256: sha, type: "pdf" })
const DOC = { companyCode: "SFZ", documentId: "sfz:issf_05", title: "Súťaže", draftMarkdown: "nový text", draftPdf: pdf("new"), draftMeta: null, versions: [] as Row[] }
const OLD_ID = documentDraftIdentity({ draftMarkdown: "starý text", draftPdf: pdf("old") })
const CUR_ID = documentDraftIdentity(DOC)
const round = (versionId: string, extra: Row = {}) => ({
  companyCode: "SFZ", documentId: "sfz:issf_05", versionId, round: 1, submittedBy: "jan@sfz.sk", submittedAt: new Date(),
  approvers: [{ email: "agata@sfz.sk", fullName: "Agáta", decision: null, decidedAt: null }], closedAt: null, outcome: null, ...extra,
})

beforeEach(() => {
  db.cols = {
    documents: [{ ...DOC }],
    approval_rounds: [],
    persons: [{ companyCode: "SFZ", id: "agata", email: "agata@sfz.sk" }],
  }
  db.notified = []; db.audit = []
})

describe("zastarané kolá", () => {
  it("kolo starej podoby konceptu sa uzavrie, schvaľovateľ dostane upozornenie", async () => {
    const { closeStaleRounds } = await import("../src/lib/approvalsDb")
    db.cols.approval_rounds = [round(OLD_ID), round(CUR_ID)]
    const closed = await closeStaleRounds("SFZ", "sfz:issf_05", "jan@sfz.sk")
    expect(closed.map(r => r.versionId)).toEqual([OLD_ID])
    const [old, cur] = db.cols.approval_rounds
    expect(old).toMatchObject({ outcome: "cancelled" })
    expect(String(old.note)).toContain("koncept sa po predložení zmenil")
    expect(cur).toMatchObject({ outcome: null })
    expect(db.audit[0]).toMatchObject({ action: "approval-cancelled" })
    expect(db.notified[0]).toMatchObject({ kind: "approvalCancelled", personIds: ["agata"] })
  })

  it("kolo zverejneného znenia ani aktuálneho konceptu sa nedotkne", async () => {
    const { closeStaleRounds } = await import("../src/lib/approvalsDb")
    db.cols.documents[0].versions = [{ versionId: "pub1" }]
    db.cols.approval_rounds = [round("pub1"), round(CUR_ID, { round: 2 })]
    expect(await closeStaleRounds("SFZ", "sfz:issf_05", "jan@sfz.sk")).toEqual([])
    expect(db.notified).toEqual([])
  })

  it("chyba databázy nezhodí uloženie konceptu", async () => {
    const { closeStaleRounds } = await import("../src/lib/approvalsDb")
    db.cols.documents = null as never
    await expect(closeStaleRounds("SFZ", "sfz:issf_05", "jan@sfz.sk")).resolves.toEqual([])
  })
})

describe("predloženie", () => {
  const meta = { effectiveFrom: new Date("2026-11-01") }
  const submit = async () => {
    const { submitForApproval } = await import("../src/lib/approvalsDb")
    const doc = db.cols.documents[0]
    return submitForApproval({
      companyCode: "SFZ", documentId: "sfz:issf_05", versionId: documentDraftIdentity(doc as never),
      approverIds: ["agata"], submittedBy: "jan@sfz.sk",
    } as never)
  }
  beforeEach(() => {
    Object.assign(db.cols.documents[0], { draftMeta: meta })
    Object.assign(db.cols.persons[0], { fullName: "Agáta", status: "active" })
  })

  it("staré kolo sa pri predložení uzavrie a nové prejde", async () => {
    const old = documentDraftIdentity({ draftMarkdown: "starý text", draftPdf: pdf("old"), draftMeta: meta })
    db.cols.approval_rounds = [round(old)]
    const r = await submit()
    expect(r.outcome).toBeNull()
    expect(db.cols.approval_rounds[0]).toMatchObject({ versionId: old, outcome: "cancelled" })
  })

  it("druhé kolo vedľa bežiaceho iného znenia sa predložiť nedá", async () => {
    db.cols.documents[0].versions = [{ versionId: "pub1" }]
    db.cols.approval_rounds = [round("pub1")]
    await expect(submit()).rejects.toMatchObject({ code: "approval.otherRunning" })
  })
})
