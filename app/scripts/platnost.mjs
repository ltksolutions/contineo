/**
 * platnost.mjs — nastaví dátum platnosti znenia (D6).
 *
 * `effectiveFrom` nie je technický údaj. Doslovne sa prepisuje do
 * potvrdzovacej formulky („platná od …", D28) a tým aj do záznamu
 * v `acknowledgements`, ktorý má prežiť roky. Preto tento skript:
 *
 *   - dátum **nehádže z ničoho** — zadáva ho človek (`--od`);
 *   - vyžaduje `--zdroj`, teda odkiaľ ten dátum je. Uloží sa k verzii, takže
 *     o rok sa dá zistiť, či číslo pochádza z ustanovenia o účinnosti, alebo
 *     to bol niečí odhad. Bez tohto údaja je dátum tvrdenie bez pôvodu;
 *   - predvolene **nič nezapisuje**.
 *
 *   npm run platnost -- --doc sfz:stanovy --od 2026-02-27 --zdroj "..."
 *   npm run platnost -- --doc sfz:stanovy --od 2026-02-27 --zdroj "..." --zapis
 */

import { MongoClient } from "mongodb"

const OK = "\x1b[32m✓\x1b[0m"
const FAIL = "\x1b[31m✗\x1b[0m"

function arg(name) {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1] ?? null
}
const DOC = arg("--doc")
const FROM = arg("--od")
const SOURCE = arg("--zdroj")
const VERSION = arg("--verzia")
const WRITE = process.argv.includes("--zapis")

if (!DOC || !FROM) {
  console.error("Použitie: npm run platnost -- --doc <documentId> --od RRRR-MM-DD --zdroj \"<citácia>\" [--verzia <versionId>] [--zapis]")
  process.exit(1)
}
const date = new Date(`${FROM}T00:00:00.000Z`)
if (Number.isNaN(date.getTime())) {
  console.error(`${FAIL} --od ${FROM} nie je dátum. Očakáva sa RRRR-MM-DD.`)
  process.exit(1)
}
if (WRITE && !SOURCE) {
  console.error(`${FAIL} Zápis bez --zdroj nie je dovolený: dátum bez pôvodu sa o rok nedá overiť.`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const col = client.db(process.env.MONGODB_DB ?? "contineo").collection("documents")

const doc = await col.findOne({ documentId: DOC })
if (!doc) {
  console.error(`${FAIL} Dokument ${DOC} neexistuje.`)
  await client.close()
  process.exit(1)
}

const versions = doc.versions ?? []
if (versions.length === 0) {
  console.error(`${FAIL} ${DOC} nemá žiadne znenie. Najprv spusti: npm run verzie`)
  await client.close()
  process.exit(1)
}

const target = VERSION
  ? versions.find(v => v.versionId === VERSION)
  : (versions.length === 1 ? versions[0] : versions.find(v => v.isActive))

if (!target) {
  console.error(`${FAIL} ${DOC} má ${versions.length} znení — dopln --verzia <versionId>:`)
  for (const v of versions) console.error(`     ${v.versionId} | ${v.label} | od ${v.effectiveFrom ?? "—"}`)
  await client.close()
  process.exit(1)
}

console.log(`${DOC}`)
console.log(`   znenie ${target.versionId} („${target.label}")`)
console.log(`   platnosť: ${target.effectiveFrom ?? "—"}  →  ${date.toISOString().slice(0, 10)}`)
if (SOURCE) console.log(`   zdroj: ${SOURCE}`)

if (!WRITE) {
  console.log(`\nSkúška nasucho — nič sa nezmenilo. Zápis: doplň --zapis`)
  await client.close()
  process.exit(0)
}

const changes = { "versions.$[v].effectiveFrom": date }
if (SOURCE) changes["versions.$[v].effectiveFromSource"] = SOURCE

const r = await col.updateOne(
  { documentId: DOC },
  { $set: changes },
  { arrayFilters: [{ "v.versionId": target.versionId }] },
)
console.log(r.modifiedCount === 1 ? `   ${OK} zapísané` : `   ${FAIL} nezapísalo sa (modifiedCount=${r.modifiedCount})`)
await client.close()
