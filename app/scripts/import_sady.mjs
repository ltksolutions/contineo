/**
 * import_sady.mjs — nahrá zlatú sadu D9 do databázy.
 *
 *     node --env-file=.env.local scripts/import_sady.mjs
 *     node --env-file=.env.local scripts/import_sady.mjs --nasucho
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

const OK = "\x1b[32m✔\x1b[0m", ZLE = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const nasucho = process.argv.includes("--nasucho")

const HERE = dirname(fileURLToPath(import.meta.url))
const SEED = join(HERE, "..", "..", "eval", "seed", "questions_seed.json")

if (!process.env.MONGODB_URI) {
  console.error(`${ZLE} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

let seed
try {
  seed = JSON.parse(readFileSync(SEED, "utf8"))
} catch (e) {
  console.error(`${ZLE} Nedá sa načítať ${SEED}\n   ${e.message}`)
  process.exit(1)
}

if (!Array.isArray(seed) || !seed.length) {
  console.error(`${ZLE} Seed je prázdny alebo nemá tvar poľa.`)
  process.exit(1)
}

console.log(`${INFO} Načítaných ${seed.length} otázok zo seedu.`)

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("eval_questions")

  await col.createIndex({ id: 1 }, { unique: true })

  let novych = 0, aktualizovanych = 0, sUpravou = 0

  for (const q of seed) {
    if (!q.id || !q.question) {
      console.warn(`${ZLE} Otázka bez id alebo znenia, preskakujem:`, JSON.stringify(q).slice(0, 80))
      continue
    }

    const existujuca = await col.findOne({ id: q.id })

    // Polia zo seedu — tie sa prepisujú vždy, sú našou pravdou.
    const zoSeedu = {
      id: q.id,
      povodneZnenie: q.question,
      searchMode: q.searchMode ?? "hybrid",
      sectionKey: q.sectionKey ?? null,
      companyCode: q.companyCode ?? "SFZ",
      accessLevel: q.accessLevel ?? "public",
      precedenceRule: q.precedenceRule ?? null,
      trapType: q.trapType ?? null,
      expectedBehaviour: q.expectedBehaviour ?? "answer",
      goldChunkIds: q.goldChunkIds ?? [],
    }

    if (!existujuca) {
      await (nasucho ? Promise.resolve() : col.insertOne({
        ...zoSeedu,
        // Prácu hodnotiteľa zakladáme prázdnu; seed do nej nikdy nesiahne.
        upraveneZnenie: null,
        vyradena: false,
        dovodVyradenia: null,
        vytvorene: new Date(),
      }))
      novych++
      continue
    }

    // Aktualizujeme LEN polia zo seedu. `upraveneZnenie`, `vyradena`
    // a `dovodVyradenia` sú výsledkom práce človeka — prepísať ich by
    // znamenalo zmazať hodiny odbornej práce pri rutinnom reimporte.
    await (nasucho ? Promise.resolve() : col.updateOne({ id: q.id }, { $set: zoSeedu }))
    aktualizovanych++
    if (existujuca.upraveneZnenie) sUpravou++
  }

  console.log()
  console.log(`${OK} Nových: ${novych}`)
  console.log(`${OK} Aktualizovaných: ${aktualizovanych}`)
  if (sUpravou) {
    console.log(`${INFO} Z toho ${sUpravou} má znenie upravené hodnotiteľom — ponechané.`)
  }
  if (nasucho) console.log(`\n${INFO} Beh nasucho — do databázy sa nič nezapísalo.`)

  // Prehľad pokrytia, nech je vidieť, či sada sedí s D9.
  if (!nasucho) {
    const spolu = await col.countDocuments()
    const pasce = await col.countDocuments({ trapType: { $ne: null } })
    const precedencia = await col.countDocuments({ precedenceRule: { $ne: null } })
    console.log(`\n${INFO} V databáze: ${spolu} otázok, z toho ${pasce} pascí a ${precedencia} na precedenciu.`)
  }
} finally {
  await client.close()
}
