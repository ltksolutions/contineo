/**
 * rename_audit_department.mjs — `predmet: "utvar"` → `"oddelenie"` (jednorazovo).
 *
 * Pri premenovaní v rozhraní sa zmenil aj predmet, ktorý sa do auditu
 * zapisuje. Existujúce záznamy zostali so starým kľúčom — a dva rôzne kľúče
 * pre tú istú vec znamenajú, že filter na oddelenia časť histórie nenájde.
 *
 * **Je to zásah do auditu**, takže: predvolene nasucho, s výpisom každého
 * záznamu, a robí sa raz, kým sú tie záznamy dva. Pri stovkách by som
 * radšej nechal starý kľúč a preložil ho pri čítaní.
 *
 *     node --env-file=.env.local scripts/rename_audit_department.mjs
 *     node --env-file=.env.local scripts/rename_audit_department.mjs --zapis
 */

import { MongoClient } from "mongodb"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const WRITE = process.argv.includes("--zapis")

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI.`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const db = client.db(process.env.MONGODB_DB ?? "contineo")
const col = db.collection("audit")

const records = await col.find({ predmet: "utvar" }).sort({ kedy: 1 }).toArray()
console.log(`\nzáznamov so starým predmetom: ${records.length}\n`)
for (const z of records) {
  console.log(`  ${z.kedy?.toISOString?.()} · ${z.akcia} · ${z.cielPopis ?? ""} · ${z.aktor}`)
}

if (!WRITE) {
  console.log(`\n${INFO} nasucho — nič sa nezapísalo. Zápis: rovnaký príkaz s --zapis\n`)
  await client.close()
  process.exit(0)
}

const r = await col.updateMany({ predmet: "utvar" }, { $set: { predmet: "oddelenie" } })
console.log(`\n${OK} prepísaných: ${r.modifiedCount}\n`)
await client.close()
