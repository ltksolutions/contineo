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
const CHYBA = "[31m✘[0m"
const VAROVANIE = "[33m![0m"

if (!URI) {
  console.error(`${CHYBA} Chýba MONGODB_URI.\n  Nastav ju v app/.env.local alebo:`)
  console.error(`     export MONGODB_URI="mongodb+srv://..."`)
  process.exit(1)
}

let problemy = 0
const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })

try {
  // ── pripojenie ──
  await client.connect()
  const admin = client.db().admin()
  const info = await admin.command({ buildInfo: 1 })
  console.log(`${OK} pripojenie · MongoDB ${info.version}`)

  const [major, minor] = info.version.split(".").map(Number)
  if (major < 8 || (major === 8 && minor < 3)) {
    console.log(`${VAROVANIE} $rerank vyžaduje 8.3+ — nastav v profile rerank.kind = "none"`)
  }

  const db = client.db(DB)

  // ── kolekcie ──
  const kolekcie = (await db.listCollections().toArray()).map(c => c.name)
  for (const nazov of ["documents", COL]) {
    if (kolekcie.includes(nazov)) {
      const pocet = await db.collection(nazov).countDocuments()
      console.log(`${OK} kolekcia ${nazov} · ${pocet} dokumentov`)
    } else {
      console.log(`${VAROVANIE} kolekcia ${nazov} neexistuje — vznikne pri prvom importe`)
    }
  }

  // ── indexy ──
  let indexy = []
  try {
    indexy = await db.collection(COL).listSearchIndexes().toArray()
  } catch (e) {
    console.log(`${CHYBA} nepodarilo sa načítať search indexy: ${e.message}`)
    console.log(`    (Search indexy nie sú dostupné na lokálnom MongoDB bez mongot.)`)
    problemy++
  }

  for (const [nazov, typ] of [[VECTOR_INDEX, "vectorSearch"], [TEXT_INDEX, "search"]]) {
    const idx = indexy.find(i => i.name === nazov)
    if (!idx) {
      console.log(`${CHYBA} index ${nazov} neexistuje — viď docs/ATLAS_SETUP.md`)
      problemy++
      continue
    }
    const stav = idx.status ?? "?"
    if (stav === "READY") {
      console.log(`${OK} index ${nazov} · ${stav}`)
    } else {
      console.log(`${VAROVANIE} index ${nazov} · ${stav} — ešte sa buduje, dotazy vrátia prázdno`)
      problemy++
    }

    // pri vektorovom indexe overíme, ze path ukazuje na TEXTOVE pole
    if (typ === "vectorSearch") {
      const polia = idx.latestDefinition?.fields ?? []
      const auto = polia.find(f => f.type === "autoEmbed")
      if (auto) {
        console.log(`    autoEmbed · model ${auto.model} · path "${auto.path}"`)
        if (auto.path === "embedding") {
          console.log(`${CHYBA} path je "embedding" — pri autoEmbed musí ukazovať na TEXTOVÉ pole (napr. "text")`)
          problemy++
        }
      } else {
        console.log(`    ${VAROVANIE} index nemá autoEmbed — vektory musí zapisovať aplikácia`)
      }
      const filtre = polia.filter(f => f.type === "filter").map(f => f.path)
      const treba = ["companyCode", "sectionKey", "accessLevel", "isActive"]
      const chyba = treba.filter(p => !filtre.includes(p))
      if (chyba.length) {
        console.log(`${CHYBA} chýbajú filtre: ${chyba.join(", ")} — dotaz s nimi zlyhá`)
        problemy++
      } else {
        console.log(`    filtre: ${filtre.join(", ")}`)
      }
    }
  }

  console.log()
  if (problemy === 0) {
    console.log(`${OK} Atlas je pripravený. Môžeš spustiť import.`)
  } else {
    console.log(`${CHYBA} ${problemy} problém(ov) — postup nájdeš v docs/ATLAS_SETUP.md`)
  }
  process.exitCode = problemy ? 1 : 0

} catch (e) {
  console.error(`${CHYBA} ${e.message}`)
  if (/authentication|auth failed/i.test(e.message)) {
    console.error("    Skontroluj používateľa a heslo v connection stringu.")
  } else if (/ENOTFOUND|ETIMEDOUT|serverSelection/i.test(e.message)) {
    console.error("    Skontroluj Network Access v Atlase — je tvoja IP povolená?")
  }
  process.exitCode = 1
} finally {
  await client.close()
}
