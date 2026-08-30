/**
 * migracia_versionid.mjs — versionId z textu, nie z chunkov (D57).
 *
 * Dovtedy sa `versionId` počítal z výsledných chunkov. Znamenalo to, že
 * vyladenie chunkera vyrobilo novú verziu — a tým aj povinnosť potvrdiť
 * normu znova, hoci sa v nej nezmenilo ani slovo.
 *
 * Tento skript prepočíta `versionId` na odtlačok textu a prepíše ho **všade,
 * kde sa naň niečo viaže**: vo `versions[]`, na dokumente, v úsekoch aj
 * v potvrdeniach. Zároveň doplní `chunkingId` k existujúcim úsekom.
 *
 * **Robí sa raz a teraz preto, že potvrdení je nula.** O pol roka by to bol
 * zásah do dôkazných záznamov.
 *
 *     node --env-file=.env.local scripts/migracia_versionid.mjs
 *     node --env-file=.env.local scripts/migracia_versionid.mjs --zapis
 */

import { createHash } from "node:crypto"
import { MongoClient } from "mongodb"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const WRITE = process.argv.includes("--zapis")

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI.`)
  process.exit(1)
}

const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16)

/** Zhodné s `odtlacokTextu()` v `src/lib/chunkovanie.ts`. */
const textFingerprint = (markdown) =>
  hash(String(markdown ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trim())

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const db = client.db(process.env.MONGODB_DB ?? "contineo")

const documents = await db.collection("documents").find({}).toArray()
console.log(`\n${documents.length} dokumentov\n`)

let changedVersions = 0
let withoutText = 0
const mapping = []

for (const d of documents) {
  for (const v of d.versions ?? []) {
    const text = String(v.markdown ?? d.markdown ?? "").trim()
    if (!text) {
      withoutText++
      console.log(`  ${INFO} ${d.documentId} · ${v.label}: znenie nemá text, preskakujem`)
      continue
    }
    const next = textFingerprint(text)
    if (next === v.versionId) continue
    mapping.push({ documentId: d.documentId, stary: v.versionId, novy: next, label: v.label })
    changedVersions++
    console.log(`  ${d.documentId.padEnd(38)} ${v.label.padEnd(10)} ${v.versionId} → ${next}`)
  }
}

console.log(`\nznení na prepis: ${changedVersions}${withoutText ? ` · bez textu: ${withoutText}` : ""}`)

// Koľkých úsekov a potvrdení sa to dotkne — vypísať PRED zápisom.
let chunkCount = 0
let acknowledgements = 0
for (const m of mapping) {
  chunkCount += await db.collection("document_chunks")
    .countDocuments({ documentId: m.documentId, versionId: m.stary })
  acknowledgements += await db.collection("acknowledgements")
    .countDocuments({ documentId: m.documentId, versionId: m.stary })
}
console.log(`dotknutých úsekov: ${chunkCount} · potvrdení: ${acknowledgements}`)

if (!WRITE) {
  console.log(`\n${INFO} nasucho — nič sa nezapísalo. Zápis: rovnaký príkaz s --zapis\n`)
  await client.close()
  process.exit(0)
}

for (const m of mapping) {
  await db.collection("documents").updateOne(
    { documentId: m.documentId },
    { $set: { "versions.$[v].versionId": m.novy, "versions.$[v].contentHash": m.novy } },
    { arrayFilters: [{ "v.versionId": m.stary }] },
  )
  // Ukazovateľ na najnovšie znenie na samotnom dokumente.
  await db.collection("documents").updateOne(
    { documentId: m.documentId, versionId: m.stary },
    { $set: { versionId: m.novy } },
  )
  await db.collection("document_chunks").updateMany(
    { documentId: m.documentId, versionId: m.stary },
    // `chunkingId` je starý `versionId`: bol to práve odtlačok chunkov, takže
    // je to presne tá hodnota, ktorá členenie identifikuje. Nič sa nestráca
    // a nemusí sa preindexovávať.
    { $set: { versionId: m.novy, chunkingId: m.stary, verziaChunkera: 1 } },
  )
  await db.collection("acknowledgements").updateMany(
    { documentId: m.documentId, versionId: m.stary },
    { $set: { versionId: m.novy } },
  )
  await db.collection("assignments").updateMany(
    { "subject.versionId": m.stary },
    { $set: { "subject.versionId": m.novy } },
  )
}

// Na dokument sa dopíše chunkingId platného znenia, aby bolo vidieť,
// či treba preindexovať.
for (const m of mapping) {
  await db.collection("documents").updateOne(
    { documentId: m.documentId },
    { $set: { chunkingId: m.stary } },
  )
}

console.log(`\n${OK} prepísané: ${changedVersions} znení, ${chunkCount} úsekov, ${acknowledgements} potvrdení`)
console.log(`${INFO} spusti kontrolu: npm run kontrola\n`)

await client.close()
