/**
 * _tmp_pred_mazanim.mjs — DOČASNÝ, LEN ČÍTA. Nič nemení.
 *
 * Odpovedá na jednu otázku: čo na dnešné dokumenty ukazuje, kým sa zmažú.
 *
 *     node --env-file=.env.local scripts/_tmp_pred_mazanim.mjs
 */
import { MongoClient } from "mongodb"

const mask = (e) => {
  const s = String(e ?? "")
  const i = s.indexOf("@")
  if (i < 1) return "***"
  return s.slice(0, 2) + "***" + s.slice(i)
}

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const db = client.db(process.env.MONGODB_DB ?? "contineo")

const documents = await db.collection("documents").find({}).toArray()
const chunks = await db.collection("document_chunks").find({}).toArray()
const acks = await db.collection("acknowledgements").find({}).toArray()
let audit = []
let tracks = []
try { audit = await db.collection("audit").find({}).toArray() } catch {}
try { tracks = await db.collection("onboarding_tracks").find({}).toArray() } catch {}

const byDoc = (arr) => {
  const m = new Map()
  for (const x of arr) {
    const k = x.documentId ?? "(bez documentId)"
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}
const chunksBy = byDoc(chunks)
const acksBy = byDoc(acks.filter(a => a.type === "acknowledgement"))
const allAcksBy = byDoc(acks)
const auditBy = byDoc(audit)

console.log("DOKUMENTY\n")
console.log(["documentId", "companyCode", "verzie", "useky(akt/spolu)", "potvrdenia", "audit"].join(" | "))
for (const d of documents.sort((a, b) => String(a.documentId).localeCompare(String(b.documentId)))) {
  const act = chunks.filter(c => c.documentId === d.documentId && c.isActive).length
  console.log([
    d.documentId,
    d.companyCode ?? "-",
    (d.versions ?? []).length,
    act + "/" + (chunksBy.get(d.documentId) ?? 0),
    acksBy.get(d.documentId) ?? 0,
    auditBy.get(d.documentId) ?? 0,
  ].join(" | "))
}

console.log("\nZAZNAMY V acknowledgements (vsetky typy)\n")
for (const a of acks) {
  console.log([
    a.type ?? "(bez type)",
    a.documentId ?? "-",
    a.versionId ? String(a.versionId).slice(0, 10) : "-",
    mask(a.email ?? a.personEmail),
    a.companyCode ?? "-",
    a.acknowledgedAt ?? a.createdAt ?? a.assignedAt ?? "-",
  ].join(" | "))
}

const docIds = new Set(documents.map(d => d.documentId))
const sirotyAck = acks.filter(a => a.documentId && !docIds.has(a.documentId))
const sirotyChunk = [...chunksBy.keys()].filter(k => !docIds.has(k))

console.log("\nSUHRN")
console.log("dokumenty: " + documents.length)
console.log("useky: " + chunks.length + " (aktivnych " + chunks.filter(c => c.isActive).length + ")")
console.log("acknowledgements (vsetky typy): " + acks.length)
console.log("  z toho type=acknowledgement: " + acks.filter(a => a.type === "acknowledgement").length)
console.log("onboarding_tracks: " + tracks.length)
console.log("audit zaznamov s documentId: " + audit.filter(a => a.documentId).length)
console.log("siroty uz teraz - ack bez dokumentu: " + sirotyAck.length + ", useky bez dokumentu: " + sirotyChunk.length)
console.log("\ndokumenty s aspon jednym zaznamom v acknowledgements: " + ([...allAcksBy.keys()].filter(k => docIds.has(k)).join(", ") || "ziadne"))

await client.close()
