/**
 * import_goldenset.mjs — nahrá zlatú sadu D9 do databázy.
 *
 *     node --env-file=.env.local scripts/import_goldenset.mjs
 *     node --env-file=.env.local scripts/import_goldenset.mjs --nasucho
 *
 * Otázky žijú v `eval/seed/questions_seed.json`, teda MIMO priečinka `app/`.
 * Kým sa spúšťali len lokálne skripty, nevadilo to; testovacie rozhranie ale
 * pôjde na Vercel, kde je nasadený iba obsah `app/` — súbor by tam nebol.
 * Preto sa sada prenesie do kolekcie `eval_questions`.
 *
 * Import je idempotentný a **nikdy neprepíše prácu hodnotiteľa**: znenie
 * upravené človekom, poznámky ani stav sa zo seedu neprepisujú. Prepisuje sa
 * len to, čo je zo seedu — pôvodné znenie a metadáta pokrytia.
 */
import { MongoClient } from "mongodb"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const OK = "\x1b[32m✔\x1b[0m", BAD = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const dryRun = process.argv.includes("--nasucho")

const HERE = dirname(fileURLToPath(import.meta.url))
const SEED = join(HERE, "..", "..", "eval", "seed", "questions_seed.json")

if (!process.env.MONGODB_URI) {
  console.error(`${BAD} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

let seed
try {
  seed = JSON.parse(readFileSync(SEED, "utf8"))
} catch (e) {
  console.error(`${BAD} Nedá sa načítať ${SEED}\n   ${e.message}`)
  process.exit(1)
}

if (!Array.isArray(seed) || !seed.length) {
  console.error(`${BAD} Seed je prázdny alebo nemá tvar poľa.`)
  process.exit(1)
}

console.log(`${INFO} Načítaných ${seed.length} otázok zo seedu.`)

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("eval_questions")

  await col.createIndex({ id: 1 }, { unique: true })

  let created = 0, updated = 0, edited = 0

  for (const q of seed) {
    if (!q.id || !q.question) {
      console.warn(`${BAD} Otázka bez id alebo znenia, preskakujem:`, JSON.stringify(q).slice(0, 80))
      continue
    }

    const existing = await col.findOne({ id: q.id })

    // Polia zo seedu — tie sa prepisujú vždy, sú našou pravdou.
    const fromSeed = {
      id: q.id,
      originalText: q.question,
      searchMode: q.searchMode ?? "hybrid",
      sectionKey: q.sectionKey ?? null,
      companyCode: q.companyCode ?? "SFZ",
      accessLevel: q.accessLevel ?? "public",
      precedenceRule: q.precedenceRule ?? null,
      trapType: q.trapType ?? null,
      expectedBehaviour: q.expectedBehaviour ?? "answer",
      goldChunkIds: q.goldChunkIds ?? [],
    }

    if (!existing) {
      await (dryRun ? Promise.resolve() : col.insertOne({
        ...fromSeed,
        // Prácu hodnotiteľa zakladáme prázdnu; seed do nej nikdy nesiahne.
        editedText: null,
        excluded: false,
        exclusionReason: null,
        createdAt: new Date(),
      }))
      created++
      continue
    }

    // Aktualizujeme LEN polia zo seedu. `upraveneZnenie`, `vyradena`
    // a `dovodVyradenia` sú výsledkom práce človeka — prepísať ich by
    // znamenalo zmazať hodiny odbornej práce pri rutinnom reimporte.
    await (dryRun ? Promise.resolve() : col.updateOne({ id: q.id }, { $set: fromSeed }))
    updated++
    if (existing.updatedAtZnenie) edited++
  }

  console.log()
  console.log(`${OK} Nových: ${created}`)
  console.log(`${OK} Aktualizovaných: ${updated}`)
  if (edited) {
    console.log(`${INFO} Z toho ${edited} má znenie upravené hodnotiteľom — ponechané.`)
  }
  if (dryRun) console.log(`\n${INFO} Beh nasucho — do databázy sa nič nezapísalo.`)

  // Prehľad pokrytia, nech je vidieť, či sada sedí s D9.
  if (!dryRun) {
    const total = await col.countDocuments()
    const traps = await col.countDocuments({ trapType: { $ne: null } })
    const precedence = await col.countDocuments({ precedenceRule: { $ne: null } })
    console.log(`\n${INFO} V databáze: ${total} otázok, z toho ${traps} pascí a ${precedence} na precedenciu.`)
  }
} finally {
  await client.close()
}
