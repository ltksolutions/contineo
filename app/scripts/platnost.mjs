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
const CHYBA = "\x1b[31m✗\x1b[0m"

function arg(meno) {
  const i = process.argv.indexOf(meno)
  return i === -1 ? null : process.argv[i + 1] ?? null
}
const DOC = arg("--doc")
const OD = arg("--od")
const ZDROJ = arg("--zdroj")
const VERZIA = arg("--verzia")
const ZAPIS = process.argv.includes("--zapis")

if (!DOC || !OD) {
  console.error("Použitie: npm run platnost -- --doc <documentId> --od RRRR-MM-DD --zdroj \"<citácia>\" [--verzia <versionId>] [--zapis]")
  process.exit(1)
}
const datum = new Date(`${OD}T00:00:00.000Z`)
if (Number.isNaN(datum.getTime())) {
  console.error(`${CHYBA} --od ${OD} nie je dátum. Očakáva sa RRRR-MM-DD.`)
  process.exit(1)
}
if (ZAPIS && !ZDROJ) {
  console.error(`${CHYBA} Zápis bez --zdroj nie je dovolený: dátum bez pôvodu sa o rok nedá overiť.`)
  process.exit(1)
}

const klient = new MongoClient(process.env.MONGODB_URI)
await klient.connect()
const col = klient.db(process.env.MONGODB_DB ?? "contineo").collection("documents")

const doc = await col.findOne({ documentId: DOC })
if (!doc) {
  console.error(`${CHYBA} Dokument ${DOC} neexistuje.`)
  await klient.close()
  process.exit(1)
}

const verzie = doc.versions ?? []
if (verzie.length === 0) {
  console.error(`${CHYBA} ${DOC} nemá žiadne znenie. Najprv spusti: npm run verzie`)
  await klient.close()
  process.exit(1)
}

const ciel = VERZIA
  ? verzie.find(v => v.versionId === VERZIA)
  : (verzie.length === 1 ? verzie[0] : verzie.find(v => v.isActive))

if (!ciel) {
  console.error(`${CHYBA} ${DOC} má ${verzie.length} znení — dopln --verzia <versionId>:`)
  for (const v of verzie) console.error(`     ${v.versionId} | ${v.label} | od ${v.effectiveFrom ?? "—"}`)
  await klient.close()
  process.exit(1)
}

console.log(`${DOC}`)
console.log(`   znenie ${ciel.versionId} („${ciel.label}")`)
console.log(`   platnosť: ${ciel.effectiveFrom ?? "—"}  →  ${datum.toISOString().slice(0, 10)}`)
if (ZDROJ) console.log(`   zdroj: ${ZDROJ}`)

if (!ZAPIS) {
  console.log(`\nSkúška nasucho — nič sa nezmenilo. Zápis: doplň --zapis`)
  await klient.close()
  process.exit(0)
}

const zmeny = { "versions.$[v].effectiveFrom": datum }
if (ZDROJ) zmeny["versions.$[v].effectiveFromSource"] = ZDROJ

const r = await col.updateOne(
  { documentId: DOC },
  { $set: zmeny },
  { arrayFilters: [{ "v.versionId": ciel.versionId }] },
)
console.log(r.modifiedCount === 1 ? `   ${OK} zapísané` : `   ${CHYBA} nezapísalo sa (modifiedCount=${r.modifiedCount})`)
await klient.close()
