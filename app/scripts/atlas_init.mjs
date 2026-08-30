/**
 * atlas_init.mjs — založí kolekcie a oba search indexy (ADR-001, ATLAS_SETUP).
 *
 *     node scripts/atlas_init.mjs            vytvorí, čo chýba
 *     node scripts/atlas_init.mjs --pockaj   navyše počká, kým sa indexy dostavajú
 *     node scripts/atlas_init.mjs --znovu    zmaže a vytvorí indexy nanovo
 *
 * Prečo skriptom a nie v UI: Atlas nedovolí vytvoriť search index nad
 * neexistujúcou kolekciou, takže poradie je dôležité. A definícia indexu
 * patrí do repozitára, nie do klikačky — inak ju nikto nezopakuje.
 */

import { MongoClient } from "mongodb"

const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? "contineo"
const COL = "document_chunks"
const VECTOR_INDEX = process.env.VECTOR_INDEX ?? "rag_vector_index"
const TEXT_INDEX = process.env.TEXT_INDEX ?? "rag_text_index"
const MODEL = process.env.EMBEDDING_MODEL ?? "voyage-4"
// Pri Automated Embedding sa indexuje TEXTOVÉ pole — Atlas si vektory
// drží sám v oddelenej internej kolekcii. Viď docs/ATLAS_SETUP.md.
const VECTOR_PATH = process.env.VECTOR_PATH ?? "text"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const again = process.argv.includes("--znovu")
const wait = process.argv.includes("--pockaj")

if (!URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Nastav ju v app/.env.local alebo:`)
  console.error(`     export MONGODB_URI="mongodb+srv://..."`)
  process.exit(1)
}

const VECTOR_DEF = {
  fields: [
    { type: "autoEmbed", modality: "text", path: VECTOR_PATH, model: MODEL },
    { type: "filter", path: "companyCode" },
    { type: "filter", path: "sectionKey" },
    { type: "filter", path: "accessLevel" },
    { type: "filter", path: "scope" },
    { type: "filter", path: "isActive" },
    { type: "filter", path: "language" },
  ],
}

const TEXT_DEF = {
  mappings: {
    dynamic: false,
    fields: {
      text:        { type: "string", analyzer: "lucene.standard" },
      heading:     { type: "string", analyzer: "lucene.standard" },
      articleRef:  { type: "string", analyzer: "lucene.keyword" },
      companyCode: { type: "token" },
      sectionKey:  { type: "token" },
      accessLevel: { type: "token" },
      scope:       { type: "token" },
      language:    { type: "token" },
      isActive:    { type: "boolean" },
    },
  },
}

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const info = await client.db().admin().command({ buildInfo: 1 })
  console.log(`${OK} pripojené · MongoDB ${info.version}\n`)
  const db = client.db(DB)

  // ── 1. kolekcie ──
  const existing = (await db.listCollections().toArray()).map(c => c.name)
  for (const name of ["documents", COL, "tenant_profiles"]) {
    if (existing.includes(name)) {
      console.log(`${INFO} kolekcia ${name} už existuje`)
    } else {
      await db.createCollection(name)
      console.log(`${OK} vytvorená kolekcia ${name}`)
    }
  }

  const col = db.collection(COL)

  // ── 2. search indexy ──
  let existingIndexes = []
  try {
    existingIndexes = await col.listSearchIndexes().toArray()
  } catch (e) {
    console.error(`\n${FAIL} Search indexy nie sú dostupné: ${e.message}`)
    console.error(`    Bežíš na Atlase? Lokálne MongoDB potrebuje mongot.`)
    process.exit(1)
  }

  for (const [name, type, definition] of [
    [VECTOR_INDEX, "vectorSearch", VECTOR_DEF],
    [TEXT_INDEX, "search", TEXT_DEF],
  ]) {
    const uz = existingIndexes.find(i => i.name === name)
    if (uz && !again) {
      console.log(`${INFO} index ${name} už existuje (${uz.status}) — preskakujem`)
      console.log(`    prepísať: node scripts/atlas_init.mjs --znovu`)
      continue
    }
    if (uz && again) {
      await col.dropSearchIndex(name)
      console.log(`${INFO} index ${name} zmazaný`)
      await new Promise(r => setTimeout(r, 3000))
    }
    await col.createSearchIndex({ name: name, type: type, definition: definition })
    console.log(`${OK} index ${name} vytvorený (${type})`)
  }

  // ── 3. voliteľné čakanie ──
  if (wait) {
    console.log(`\n${INFO} čakám, kým sa indexy dostavajú…`)
    const deadline = Date.now() + 10 * 60 * 1000
    while (Date.now() < deadline) {
      const states = await col.listSearchIndexes().toArray()
      const wanted = states.filter(i => [VECTOR_INDEX, TEXT_INDEX].includes(i.name))
      const label = wanted.map(i => `${i.name}=${i.status}`).join("  ")
      process.stdout.write(`\r    ${label}          `)
      if (wanted.length === 2 && wanted.every(i => i.status === "READY")) {
        console.log(`\n${OK} oba indexy sú READY`)
        break
      }
      await new Promise(r => setTimeout(r, 5000))
    }
  }

  console.log(`\n${OK} Hotovo. Over stav:  node scripts/atlas_check.mjs`)
  if (!wait) {
    console.log(`${INFO} Indexy sa budujú asynchrónne — kým nie sú READY,`)
    console.log(`    dotazy vrátia PRÁZDNE výsledky bez chyby.`)
  }

} catch (e) {
  console.error(`\n${FAIL} ${e.message}`)
  if (/authentication|auth failed/i.test(e.message)) {
    console.error("    Skontroluj používateľa a heslo v connection stringu.")
  } else if (/ENOTFOUND|ETIMEDOUT|serverSelection/i.test(e.message)) {
    console.error("    Skontroluj Network Access v Atlase — je tvoja IP povolená?")
  } else if (/command not found|not supported|autoEmbed/i.test(e.message)) {
    console.error("    Automated Embedding možno nie je dostupné na tomto clusteri")
    console.error("    alebo chýba Voyage API kľúč (Atlas UI → AI Models).")
  }
  process.exitCode = 1
} finally {
  await client.close()
}
