/**
 * migrate_remove_faq.mjs — FAQ zaniká (ADR-034, D220, 14. 10. 2026).
 *
 *     npm run migrate:remove-faq                # náhľad
 *     npm run migrate:remove-faq -- --zapisat
 *
 * Rozhodnutie Jána: po vytvorení návrhov na doplnenie manuálov sa celé FAQ
 * **zmaže, nearchivuje sa**. Skript:
 *
 *   1. otvorené návrhy FAQ preklopí na otázky z helpdesku (`helpdesk_questions`),
 *      ak kanál ešte žiadne nemá — z nich sa ďalej navrhujú doplnenia manuálov;
 *   2. zmaže dokumenty druhu FAQ (aj ich súbory) a ich úseky v indexe;
 *   3. zmaže návrhy FAQ, behy kontroly návrhov FAQ a upozornenia „kontrola
 *      návrhov FAQ dobehla"; z kanálov a požiadaviek odstráni odkazy na FAQ.
 *
 * Kolá schvaľovania a audit dokumentov FAQ ostávajú — sú to dôkazné záznamy
 * (D24); zmazanie dokumentu sa do auditu zapíše.
 */
import { randomBytes } from "node:crypto"
import { getClient, getCollection } from "../src/lib/mongodb.ts"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents.ts"
import { deleteFile } from "../src/lib/fileStore.ts"
import { writeAudit } from "../src/lib/audit.ts"
import { HELPDESK_QUESTIONS_COLLECTION } from "../src/lib/helpdeskQuestions.ts"

const ZAPISAT = process.argv.includes("--zapisat")
const ACTOR = "migracia ADR-034"
const OK = "\x1b[32m✔\x1b[0m", INFO = "\x1b[33m·\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m"
if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spúšťa sa cez \`npm run migrate:remove-faq\`.`)
  process.exit(1)
}

const docs = await getCollection(DOCUMENTS_COLLECTION)
const proposals = await getCollection("faq_proposals")
const questions = await getCollection(HELPDESK_QUESTIONS_COLLECTION)
const chunks = await getCollection("document_chunks")
const channels = await getCollection("channels")
const runs = await getCollection("compliance_runs")
const requests = await getCollection("compliance_requests")
const notifications = await getCollection("notifications")
const rounds = await getCollection("approval_rounds")

const faqDocs = await docs.find({ category: "faq" }).toArray()
const faqIds = faqDocs.map(d => d.documentId)
const files = d => [d.draftPdf, d.draftSource, d.originalFile, ...(d.versions ?? []).flatMap(v => [v.pdf, v.source, v.originalFile])].map(f => f?.id).filter(Boolean)
const open = await proposals.find({ status: "open" }).toArray()
const haveQuestions = new Set((await questions.find({}, { projection: { _id: 0, companyCode: 1, channelKey: 1 } }).toArray()).map(q => `${q.companyCode}|${q.channelKey}`))
const toCopy = open.filter(p => !haveQuestions.has(`${p.companyCode}|${p.channelKey}`))
const counts = {
  faqDocs: faqDocs.length,
  files: [...new Set(faqDocs.flatMap(files))].length,
  chunks: await chunks.countDocuments({ $or: [{ faqVersionId: { $exists: true } }, { documentId: { $in: faqIds } }] }),
  proposals: await proposals.countDocuments({}),
  copyQuestions: toCopy.length,
  proposalRuns: await runs.countDocuments({ $or: [{ "scope.kind": "proposals" }, { scopeKey: /^proposals:/ }] }),
  channelsWithFaq: await channels.countDocuments({ faqDocumentId: { $exists: true } }),
  requestsWithFaq: await requests.countDocuments({ faq: { $exists: true } }),
  notifications: await notifications.countDocuments({ kind: "faqReviewDone" }),
  roundsKept: await rounds.countDocuments({ documentId: { $in: faqIds } }),
}
console.log(`\n${INFO} ${JSON.stringify(counts, null, 1)}\n`)
for (const d of faqDocs) console.log(`  ${d.companyCode}  zmaže sa FAQ „${d.title}" (${d.documentId})`)

if (!ZAPISAT) {
  console.log(`\n${INFO} len náhľad — zapíše sa s --zapisat`)
} else {
  // 1. Otázky z návrhov — kópia, pôvod (vlákna) sa nenesie.
  if (toCopy.length) {
    await questions.insertMany(toCopy.map(p => ({
      companyCode: p.companyCode, channelKey: p.channelKey, id: `q${randomBytes(6).toString("hex")}`,
      topicKey: p.topicKey ?? "", topicLabel: p.topicLabel ?? "", question: p.question ?? "", answer: p.answer ?? "",
      threads: Number(p.threads ?? 0), firstMonth: p.firstMonth ?? null, lastMonth: p.lastMonth ?? null,
      documentIds: [...new Set((p.sources ?? []).map(s => s.documentId).filter(Boolean))], createdAt: new Date(),
    })))
  }
  // 2. Dokumenty FAQ, ich súbory a úseky.
  for (const d of faqDocs) {
    for (const id of [...new Set(files(d))]) await deleteFile(d.companyCode, id).catch(e => console.warn(`  súbor ${id}: ${e.message}`))
    await docs.deleteOne({ companyCode: d.companyCode, documentId: d.documentId })
    await writeAudit({
      companyCode: d.companyCode, subject: "document", action: "deleted", actor: ACTOR,
      targetId: d.documentId, targetLabel: String(d.title ?? d.documentId), note: "FAQ zaniká (ADR-034, D220) — zmazané aj so súbormi a úsekmi",
    })
  }
  await chunks.deleteMany({ $or: [{ faqVersionId: { $exists: true } }, { documentId: { $in: faqIds } }] })
  // 3. Návrhy, behy, upozornenia, odkazy.
  await proposals.deleteMany({})
  await runs.deleteMany({ $or: [{ "scope.kind": "proposals" }, { scopeKey: /^proposals:/ }] })
  await notifications.deleteMany({ kind: "faqReviewDone" })
  await channels.updateMany({ faqDocumentId: { $exists: true } }, { $unset: { faqDocumentId: "" } })
  await requests.updateMany({ faq: { $exists: true } }, { $unset: { faq: "" } })
  console.log(`\n${OK} hotovo`)
}
await (await getClient()).close()
