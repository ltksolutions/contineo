/**
 * atlas_init.mjs — založí kolekcie a oba search indexy (ADR-001, ATLAS_SETUP).
 *
 *     node scripts/atlas_init.mjs                      vytvorí, čo chýba
 *     node scripts/atlas_init.mjs --pockaj             navyše počká, kým sa indexy dostavajú
 *     node scripts/atlas_init.mjs --upravit            ukáže rozdiel živých indexov oproti repozitáru
 *     node scripts/atlas_init.mjs --upravit --naozaj   upraví indexy NA MIESTE (updateSearchIndex)
 *     node scripts/atlas_init.mjs --znovu              zmaže a vytvorí indexy nanovo
 *
 * Prečo skriptom a nie v UI: Atlas nedovolí vytvoriť search index nad
 * neexistujúcou kolekciou, takže poradie je dôležité. A definícia indexu
 * patrí do repozitára, nie do klikačky — inak ju nikto nezopakuje.
 * Definície sú v `scripts/lib/searchIndexes.mjs`.
 *
 * **Na produkcii `--upravit`, nie `--znovu`.** `--znovu` index zmaže — kým sa
 * nový nedostavia, hľadanie vracia prázdne výsledky bez chyby. `--upravit`
 * stavia novú definíciu na pozadí a stará dovtedy odpovedá (krok 0 plánu
 * „znenia v indexe", `docs/TODO.md`). Návrat = `--upravit --naozaj` so
 * starou definíciou z gitu.
 */

import { MongoClient } from "mongodb"
import { COLLECTION as COL, VECTOR_INDEX, TEXT_INDEX, wantedIndexes, definitionDiff } from "./lib/searchIndexes.mjs"

const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? "contineo"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const again = process.argv.includes("--znovu")
const wait = process.argv.includes("--pockaj")
const update = process.argv.includes("--upravit")
const confirmed = process.argv.includes("--naozaj")

if (again && update) {
  console.error(`${FAIL} --znovu a --upravit naraz nejde — vyber jedno`)
  process.exit(1)
}

if (!URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Nastav ju v app/.env.local alebo:`)
  console.error(`     export MONGODB_URI="mongodb+srv://..."`)
  process.exit(1)
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

  let changed = false
  for (const { name, type, definition } of wantedIndexes()) {
    const uz = existingIndexes.find(i => i.name === name)
    if (!uz && update && !confirmed) {
      console.log(`${INFO} index ${name} neexistuje — vytvorí sa s --naozaj`)
      continue
    }
    if (uz && update) {
      const diff = definitionDiff(uz.latestDefinition, definition)
      if (!diff.differs) {
        console.log(`${OK} index ${name} zodpovedá repozitáru — bez zmeny`)
        continue
      }
      console.log(`${INFO} index ${name} (${uz.status}) sa líši od repozitára:`)
      for (const f of diff.added) console.log(`    + ${f}`)
      for (const f of diff.removed) console.log(`    − ${f}`)
      if (!confirmed) {
        console.log(`    náhľad — nič sa nezmenilo; upraviť: pridaj --naozaj`)
        continue
      }
      await col.updateSearchIndex(name, definition)
      changed = true
      console.log(`${OK} index ${name} upravený na mieste — nová definícia sa stavia na pozadí, stará zatiaľ odpovedá`)
      continue
    }
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
  // Pri úprave na mieste nestačí READY: počas stavby je READY aj stará
  // definícia. Hotovo je, až keď živá definícia zodpovedá repozitáru a Atlas
  // nehlási rozostavanú (`stagedIndex`).
  if (wait || changed) {
    console.log(`\n${INFO} čakám, kým sa indexy dostavajú…`)
    const deadline = Date.now() + 20 * 60 * 1000
    const want = wantedIndexes()
    let finished = false
    while (Date.now() < deadline) {
      const states = await col.listSearchIndexes().toArray()
      const wanted = states.filter(i => [VECTOR_INDEX, TEXT_INDEX].includes(i.name))
      const done = i => i.status === "READY" &&
        !(i.statusDetail ?? []).some(d => d.stagedIndex) &&
        !definitionDiff(i.latestDefinition, want.find(w => w.name === i.name).definition).differs
      const label = wanted.map(i => `${i.name}=${i.status}${done(i) ? "" : " (stavia sa)"}`).join("  ")
      process.stdout.write(`\r    ${label}          `)
      if (wanted.length === 2 && wanted.every(done)) {
        console.log(`\n${OK} oba indexy sú READY s definíciou z repozitára`)
        finished = true
        break
      }
      await new Promise(r => setTimeout(r, 5000))
    }
    if (!finished) {
      console.log(`\n${FAIL} indexy sa do 20 minút nedostavali — stav: node scripts/atlas_check.mjs`)
      process.exitCode = 1
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
