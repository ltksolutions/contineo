/**
 * migrate_document_kinds.mjs — druh „Norma" sa delí na Stanovy a Poriadok
 * (ADR-034, D217, 13. 10. 2026).
 *
 *     npm run migrate:kinds                                 # náhľad
 *     npm run migrate:kinds -- --zapisat
 *     npm run migrate:kinds -- --zapisat --priecinok="Poriadky SFZ"
 *
 * Pravidlo Jána: **všetko, čo má v názve „poriadok", je poriadok**; Stanovy
 * sú vlastný druh nad poriadkami. Dokument s druhom `norma`, ktorý nie je ani
 * jedno, sa nemigruje a vypíše sa — druh mu určí človek. Vlastný druh
 * organizácie s kľúčom `poriadok` sa z jej číselníka odoberie: od ADR-034 je
 * základný a dvakrát v ponuke byť nemá.
 *
 * `--priecinok` (id alebo presný názov) presunie poriadky do priečinka.
 * Bez neho priečinky ostanú, ako sú.
 *
 * Každá zmena druhu sa zapíše do auditu. Idempotentný: dokument, ktorý už
 * druh má, sa preskočí.
 */
import { getClient, getCollection } from "../src/lib/mongodb.ts"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents.ts"
import { TENANTS_COLLECTION } from "../src/lib/tenants.ts"
import { FOLDERS_COLLECTION } from "../src/lib/folders.ts"
import { writeAudit } from "../src/lib/audit.ts"

const ZAPISAT = process.argv.includes("--zapisat")
const folderArg = (process.argv.find(a => a.startsWith("--priecinok=")) ?? "").slice("--priecinok=".length).trim()
const ACTOR = "migracia ADR-034"
const OK = "\x1b[32m✔\x1b[0m", INFO = "\x1b[33m·\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m"

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spúšťa sa cez \`npm run migrate:kinds\`.`)
  process.exit(1)
}

/** Nový druh podľa názvu; `null` = nevie sa, rozhodne človek. */
export function kindFor(title) {
  const t = String(title ?? "")
  if (/^\s*stanovy\b/i.test(t)) return "stanovy"
  if (/poriad/i.test(t)) return "poriadok"
  return null
}

const docs = await getCollection(DOCUMENTS_COLLECTION)
const rows = await docs.find(
  { $or: [{ category: { $in: ["norma", "poriadok"] } }, { title: /poriad|^\s*stanovy/i }] },
  { projection: { companyCode: 1, documentId: 1, title: 1, category: 1, folderId: 1 } },
).toArray()

const plan = [], unknown = []
for (const d of rows) {
  const to = kindFor(d.title)
  if (!to) { if (d.category === "norma") unknown.push(d); continue }
  if (to !== d.category) plan.push({ ...d, to })
}

let folder = null
if (folderArg) {
  const fcol = await getCollection(FOLDERS_COLLECTION)
  const found = await fcol.find({ $or: [{ id: folderArg }, { name: folderArg }] }).toArray()
  if (found.length !== 1) {
    console.error(`${FAIL} Priečinok „${folderArg}" ${found.length ? "nie je jednoznačný" : "neexistuje"}.`)
    process.exit(1)
  }
  folder = found[0]
}
const toFolder = folder ? rows.filter(d => kindFor(d.title) === "poriadok" && d.companyCode === folder.companyCode && d.folderId !== folder.id) : []

const tenants = await getCollection(TENANTS_COLLECTION)
const withCustom = await tenants.find({ "codelists.category.key": "poriadok" }, { projection: { companyCode: 1 } }).toArray()

console.log(`\n${INFO} zmena druhu: ${plan.length} · bez pravidla: ${unknown.length} · do priečinka: ${toFolder.length} · vlastný druh „poriadok" v organizáciách: ${withCustom.length}\n`)
for (const p of plan) console.log(`  ${p.companyCode}  ${p.category ?? "—"} → ${p.to}  ${p.title}`)
for (const u of unknown) console.log(`  ${u.companyCode}  norma → ?  ${u.title}  (druh určí človek)`)
for (const d of toFolder) console.log(`  ${d.companyCode}  priečinok → „${folder.name}"  ${d.title}`)
for (const t of withCustom) console.log(`  ${t.companyCode}  odoberie sa vlastný druh „poriadok"`)

if (!ZAPISAT) {
  console.log(`\n${INFO} len náhľad — zapíše sa s --zapisat`)
} else {
  for (const p of plan) {
    // Starý druh v podmienke — súbežná zmena na obrazovke sa neprepíše.
    const r = await docs.updateOne({ companyCode: p.companyCode, documentId: p.documentId, category: p.category }, { $set: { category: p.to } })
    if (r.modifiedCount) {
      await writeAudit({
        companyCode: p.companyCode, subject: "document", action: "changed", actor: ACTOR,
        targetId: p.documentId, targetLabel: p.title,
        changes: { category: { from: p.category, to: p.to } }, note: "druh podľa ADR-034 (D217)",
      })
    }
  }
  for (const d of toFolder) {
    await docs.updateOne({ companyCode: d.companyCode, documentId: d.documentId }, { $set: { folderId: folder.id } })
    await writeAudit({
      companyCode: d.companyCode, subject: "document", action: "changed", actor: ACTOR,
      targetId: d.documentId, targetLabel: d.title,
      changes: { folderId: { from: d.folderId ?? null, to: folder.id } }, note: `priečinok „${folder.name}" (ADR-034)`,
    })
  }
  for (const t of withCustom) {
    await tenants.updateOne({ companyCode: t.companyCode }, { $pull: { "codelists.category": { key: "poriadok" } } })
  }
  console.log(`\n${OK} druh: ${plan.length} · priečinok: ${toFolder.length} · číselník: ${withCustom.length}`)
}
await (await getClient()).close()
