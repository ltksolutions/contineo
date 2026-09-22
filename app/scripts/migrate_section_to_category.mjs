/**
 * migrate_section_to_category.mjs — zlúči Zaradenie do Druhu (O21 krok 2, ADR-010).
 *
 *     node --env-file=.env.local --import ./scripts/lib/ts-hook.mjs \
 *       scripts/migrate_section_to_category.mjs            náhľad
 *     node --env-file=.env.local --import ./scripts/lib/ts-hook.mjs \
 *       scripts/migrate_section_to_category.mjs --zapis    vykoná
 *
 * `sectionKey` (kam dokument patrí) a `category` (čo to je) boli dve škatuľky
 * na to isté, odkedy identitu dokumentu nesie `documentKey` (D80). Zaradenie
 * odchádza — druh zostáva. Mapovanie je v `src/lib/sectionToCategory.ts`
 * a používa ho aj aplikácia, takže sa nemôžu rozísť.
 *
 * Skript robí tri veci, v tomto poradí:
 *
 *   1. **Doplní `category`** tam, kde chýba, podľa zaradenia.
 *   2. **Overí, že nikomu nechýba `documentKey`** — ten je identitou (D80)
 *      a `saveMetadata()` ho pri chýbaní dopočítava zo `sectionKey`. Keby sa
 *      zaradenie odstránilo skôr, najbližšia úprava metadát by dokumentu
 *      zmenila `documentId` a rozviazala potvrdenia, úseky aj pridelenia.
 *      Pri chýbajúcom kľúči skript **nezapíše nič** a pošle na
 *      `migrate_document_key.mjs`.
 *   3. **Odstráni `sectionKey`** z dokumentov.
 *
 * Dokument s neznámym zaradením sa vypíše menovite a **nechá tak** — druh mu
 * dá človek, nie skript. Zaradenie sa mu neodstráni.
 *
 * Predvolene beží nasucho. Návratový kód 1 pri rozpore.
 */
import { MongoClient } from "mongodb"
import { SECTION_TO_CATEGORY } from "../src/lib/sectionToCategory"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", WARN = "\x1b[33m▲\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const write = process.argv.includes("--zapis")

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("documents")

  const rows = await col
    .find({})
    .project({ documentId: 1, documentKey: 1, sectionKey: 1, category: 1, title: 1 })
    .toArray()
  console.log(`${INFO} Dokumentov: ${rows.length}\n`)

  const setCategory = []   // doplní sa druh
  const unknown = []       // zaradenie, ktoré mapovanie nepozná
  const noKey = []         // chýba documentKey — identita by sa rozpadla
  const dropOnly = []      // druh má, stačí odstrániť zaradenie

  for (const d of rows) {
    const id = String(d.documentId ?? "")
    const section = String(d.sectionKey ?? "").trim().toLowerCase()
    const hasCategory = Boolean(String(d.category ?? "").trim())
    if (!String(d.documentKey ?? "").trim()) noKey.push(id)

    if (!section) {
      console.log(`${id.padEnd(40)} ${INFO} zaradenie nemá`)
      continue
    }
    if (hasCategory) {
      dropOnly.push(d)
      console.log(`${id.padEnd(40)} ${INFO} druh už má ("${d.category}") · zaradenie sa odstráni`)
      continue
    }
    const category = SECTION_TO_CATEGORY[section]
    if (!category) {
      unknown.push({ id, section })
      console.log(`${id.padEnd(40)} ${WARN} neznáme zaradenie "${section}" — nechá sa tak`)
      continue
    }
    setCategory.push({ d, category })
    console.log(`${id.padEnd(40)} ${OK} "${section}" → druh "${category}"`)
  }

  if (noKey.length) {
    console.error(`\n${FAIL} Bez documentKey: ${noKey.length}`)
    console.error(`   ${noKey.slice(0, 5).join(", ")}${noKey.length > 5 ? " …" : ""}`)
    console.error("   Zaradenie je ich záložná identita — odstrániť ho teraz znamená, že najbližšia")
    console.error("   úprava metadát im zmení documentId a rozviaže potvrdenia. Najprv spusti")
    console.error("   scripts/migrate_document_key.mjs. Nezapísalo sa nič.")
    process.exit(1)
  }

  console.log(
    `\n${INFO} Doplniť druh: ${setCategory.length} · len odstrániť zaradenie: ${dropOnly.length}` +
    ` · nechať tak: ${unknown.length}`,
  )
  if (unknown.length) {
    const kinds = [...new Set(unknown.map(u => u.section))]
    console.log(`${WARN} Neznáme zaradenia: ${kinds.join(", ")}`)
    console.log("   Týmto dokumentom druh doplňte na obrazovke; zaradenie im zostane.")
  }

  if (!write) {
    console.log(`${INFO} Náhľad. Spusti znova s --zapis.`)
    process.exit(0)
  }

  let filled = 0
  for (const { d, category } of setCategory) {
    await col.updateOne({ _id: d._id }, { $set: { category } })
    filled++
  }

  // Zaradenie odchádza len tam, kde druh naozaj je — dokument s neznámym
  // zaradením si ho ponechá, inak by prišiel o jedinú stopu, čo to bolo.
  const clear = [...setCategory.map(x => x.d._id), ...dropOnly.map(d => d._id)]
  const dropped = clear.length
    ? (await col.updateMany({ _id: { $in: clear } }, { $unset: { sectionKey: "" } })).modifiedCount
    : 0

  // Úseky nesú kópiu zaradenia z čias, keď sa podľa neho filtrovalo
  // vyhľadávanie. Dnes ju nečíta nikto a v novo indexovaných chunkoch už
  // nevzniká — tak nech ju nenesú ani staré.
  const chunks = await db.collection("document_chunks")
    .updateMany({ sectionKey: { $exists: true } }, { $unset: { sectionKey: "" } })

  console.log(`\n${OK} Doplnený druh: ${filled} · odstránené zaradenie: ${dropped}`)
  console.log(`${OK} Úsekov vyčistených: ${chunks.modifiedCount}`)
  if (unknown.length) console.log(`${WARN} Ponechané so zaradením: ${unknown.length}`)
  console.log(`${INFO} Atlas index má stále filter na sectionKey (scripts/atlas_init.mjs) —`)
  console.log("   prekáža len tým, že je zbytočný; zmeniť ho pri najbližšom preindexovaní.")
} catch (e) {
  console.error(`${FAIL} ${e?.message ?? e}`)
  process.exitCode = 1
} finally {
  await client.close()
}
