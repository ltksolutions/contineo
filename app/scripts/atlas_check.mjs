/**
 * atlas_check.mjs — overí, že Atlas je pripravený na import a dotazovanie.
 *
 *     node scripts/atlas_check.mjs
 *
 * Kontroluje pripojenie, kolekcie, oba indexy a ich stav. Index, ktorý sa
 * ešte buduje, vracia na dotazy PRÁZDNE VÝSLEDKY BEZ CHYBY — to je zradné,
 * preto sa stav kontroluje výslovne.
 */

import { MongoClient } from "mongodb"

const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? "contineo"
const COL = "document_chunks"
const VECTOR_INDEX = process.env.VECTOR_INDEX ?? "rag_vector_index"
const TEXT_INDEX = process.env.TEXT_INDEX ?? "rag_text_index"

const OK = "[32m✔[0m"
const FAIL = "[31m✘[0m"
const WARN = "[33m![0m"

if (!URI) {
  console.error(`${FAIL} Chýba MONGODB_URI.\n  Nastav ju v app/.env.local alebo:`)
  console.error(`     export MONGODB_URI="mongodb+srv://..."`)
  process.exit(1)
}

let problems = 0
const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })

try {
  // ── pripojenie ──
  await client.connect()
  const admin = client.db().admin()
  const info = await admin.command({ buildInfo: 1 })
  console.log(`${OK} pripojenie · MongoDB ${info.version}`)

  const [major, minor] = info.version.split(".").map(Number)
  if (major < 8 || (major === 8 && minor < 3)) {
    console.log(`${WARN} $rerank vyžaduje 8.3+ — nastav v profile rerank.kind = "none"`)
  }

  const db = client.db(DB)

  // ── kolekcie ──
  const collections = (await db.listCollections().toArray()).map(c => c.name)
  for (const name of ["documents", COL]) {
    if (collections.includes(name)) {
      const count = await db.collection(name).countDocuments()
      console.log(`${OK} kolekcia ${name} · ${count} dokumentov`)
    } else {
      console.log(`${WARN} kolekcia ${name} neexistuje — vznikne pri prvom importe`)
    }
  }

  // ── indexy ──
  let indexes = []
  try {
    indexes = await db.collection(COL).listSearchIndexes().toArray()
  } catch (e) {
    console.log(`${FAIL} nepodarilo sa načítať search indexy: ${e.message}`)
    console.log(`    (Search indexy nie sú dostupné na lokálnom MongoDB bez mongot.)`)
    problems++
  }

  for (const [name, type] of [[VECTOR_INDEX, "vectorSearch"], [TEXT_INDEX, "search"]]) {
    const idx = indexes.find(i => i.name === name)
    if (!idx) {
      console.log(`${FAIL} index ${name} neexistuje — viď docs/ATLAS_SETUP.md`)
      problems++
      continue
    }
    const state = idx.status ?? "?"
    if (state === "READY") {
      console.log(`${OK} index ${name} · ${state}`)
    } else {
      console.log(`${WARN} index ${name} · ${state} — ešte sa buduje, dotazy vrátia prázdno`)
      problems++
    }

    // pri vektorovom indexe overíme, ze path ukazuje na TEXTOVE pole
    if (type === "vectorSearch") {
      const fields = idx.latestDefinition?.fields ?? []
      const auto = fields.find(f => f.type === "autoEmbed")
      if (auto) {
        console.log(`    autoEmbed · model ${auto.model} · path "${auto.path}"`)
        if (auto.path === "embedding") {
          console.log(`${FAIL} path je "embedding" — pri autoEmbed musí ukazovať na TEXTOVÉ pole (napr. "text")`)
          problems++
        }
      } else {
        console.log(`    ${WARN} index nemá autoEmbed — vektory musí zapisovať aplikácia`)
      }
      const filters = fields.filter(f => f.type === "filter").map(f => f.path)
      const needed = ["companyCode", "sectionKey", "accessLevel", "isActive"]
      const error = needed.filter(p => !filters.includes(p))
      if (error.length) {
        console.log(`${FAIL} chýbajú filtre: ${error.join(", ")} — dotaz s nimi zlyhá`)
        problems++
      } else {
        console.log(`    filtre: ${filters.join(", ")}`)
      }
    }
  }

  console.log()
  if (problems === 0) {
    console.log(`${OK} Atlas je pripravený. Môžeš spustiť import.`)
  } else {
    console.log(`${FAIL} ${problems} problém(ov) — postup nájdeš v docs/ATLAS_SETUP.md`)
  }
  process.exitCode = problems ? 1 : 0

} catch (e) {
  console.error(`${FAIL} ${e.message}`)
  if (/authentication|auth failed/i.test(e.message)) {
    console.error("    Skontroluj používateľa a heslo v connection stringu.")
  } else if (/ENOTFOUND|ETIMEDOUT|serverSelection/i.test(e.message)) {
    console.error("    Skontroluj Network Access v Atlase — je tvoja IP povolená?")
  }
  process.exitCode = 1
} finally {
  await client.close()
}
