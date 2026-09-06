/**
 * migrate_index_names.mjs — slovenské názvy indexov na anglické.
 *
 *     npm run migrate:indexes            náhľad, nič nezapíše
 *     npm run migrate:indexes -- --zapis vykoná
 *
 * **Prečo vôbec.** Názov indexu nie je nikde v dotazoch — Mongo si plán
 * vyberá podľa kľúča, nie podľa mena. Je to teda čisto čitateľnosť: kto
 * otvorí Atlas a uvidí `podla_osoby` vedľa `reading_by_document`, nevie,
 * ktoré meno je pravidlo a ktoré výnimka.
 *
 * **Poradie musí byť zahodiť → vytvoriť, hoci by sme chceli opak.** Mongo
 * druhý index nad tým istým kľúčom neprijme („Index already exists with a
 * different name"), takže bezpečné poradie neexistuje — premenovanie indexu
 * ako operácia v Mongu nie je.
 *
 * Pri unikátnom indexe tým vzniká okno, v ktorom obmedzenie neplatí. Je
 * krátke (dva príkazy za sebou), ale je. Preto sa pred zahodením **overí, že
 * duplicity neexistujú**: keby existovali, `createIndex` by po zahodení
 * zlyhal a kolekcia by zostala bez obmedzenia — a pri `acknowledgements` je
 * to obmedzenie to jediné, čo drží dvojité potvrdenie toho istého znenia
 * (D24). Radšej sa nespraví nič, než aby sa spravila polovica.
 *
 * Voľby sa **kopírujú z existujúceho indexu**, nie prepisujú ručne.
 * Prepísaný `partialFilterExpression` alebo zabudnuté `unique` by spravili
 * index, ktorý vyzerá rovnako a nedrží nič.
 */

import { MongoClient } from "mongodb"

const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? "contineo"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const write = process.argv.includes("--zapis")

if (!URI) {
  console.error(`${FAIL} Chýba MONGODB_URI.`)
  process.exit(1)
}

/** kolekcia → [starý názov, nový názov] */
const RENAMES = {
  persons: [
    ["tenant_trasa_stav", "tenant_track_status"],
    ["tenant_utvar_stav", "tenant_department_status"],
    ["tenant_utvar_historia", "tenant_department_history"],
    ["tenant_skupina_historia", "tenant_group_history"],
  ],
  departments: [
    ["tenant_utvar_unique", "tenant_department_unique"],
    ["podla_nadriadeneho", "by_parent"],
  ],
  // Priečinky knižnice sú `cms_folders`, nie `folders` — v prvom behu to
  // skript minul a ticho preskočil. Preto sa neexistujúca kolekcia hlási.
  cms_folders: [
    ["tenant_priecinok_unique", "tenant_folder_unique"],
    ["podla_nadriadeneho", "by_parent"],
  ],
  documents: [
    ["tenant_priecinok", "tenant_folder"],
    ["tenant_druh", "tenant_category"],
    ["tenant_znacky", "tenant_tags"],
  ],
  acknowledgements: [
    ["potvrdenie_unique", "acknowledgement_unique"],
    ["podla_dokumentu", "by_document"],
    ["podla_osoby", "by_person"],
  ],
  onboarding_tracks: [
    ["tenant_kluc_unique", "tenant_key_unique"],
  ],
  assignments: [
    ["podla_znenia", "by_version"],
    ["podla_publika", "by_audience"],
    ["podla_casu", "by_time"],
  ],
}

/**
 * Existuje dvojica dokumentov s rovnakým kľúčom?
 *
 * Vracia prvú takú kombináciu, alebo `null`. Rešpektuje
 * `partialFilterExpression` — bez toho by sa duplicita hlásila aj tam, kde
 * ju index nikdy nesledoval (napr. odvolania v `acknowledgements`).
 */
async function duplicatesFor(col, spec) {
  const fields = Object.keys(spec.key)
  const id = Object.fromEntries(fields.map(f => [f.replace(/\./g, "_"), `$${f}`]))
  const pipeline = []
  if (spec.partialFilterExpression) pipeline.push({ $match: spec.partialFilterExpression })
  pipeline.push({ $group: { _id: id, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $limit: 1 })
  const [found] = await col.aggregate(pipeline).toArray()
  return found ?? null
}

/** Voľby indexu bez toho, čo patrí Mongu, nie nám. */
function optionsOf(spec) {
  const { v, key, name, ns, ...rest } = spec
  return rest
}

const client = new MongoClient(URI)
let renamed = 0, skipped = 0, missing = 0, failed = 0

try {
  await client.connect()
  const db = client.db(DB)
  console.log(`${OK} pripojené · databáza ${DB}${write ? "" : "  \x1b[33m(NÁHĽAD — nič sa nezapíše)\x1b[0m"}\n`)

  const collections = (await db.listCollections().toArray()).map(c => c.name)

  for (const [collection, pairs] of Object.entries(RENAMES)) {
    if (!collections.includes(collection)) {
      console.log(`${INFO} kolekcia ${collection} tu nie je — preskakujem`)
      continue
    }
    const col = db.collection(collection)
    console.log(`\n${collection}`)

    for (const [from, to] of pairs) {
      const specs = await col.indexes()
      const names = specs.map(i => i.name)

      if (names.includes(to)) {
        console.log(`   ${INFO} ${to} už existuje`)
        skipped++
        // Starý zostal visieť po predchádzajúcom nedokončenom behu.
        if (names.includes(from)) {
          if (write) {
            await col.dropIndex(from)
            console.log(`   ${OK} zahodený zvyšok ${from}`)
          } else {
            console.log(`   ${INFO} zahodil by sa zvyšok ${from}`)
          }
        }
        continue
      }
      if (!names.includes(from)) {
        console.log(`   ${INFO} ${from} tu nie je`)
        missing++
        continue
      }

      const spec = specs.find(i => i.name === from)
      const opts = optionsOf(spec)

      if (!write) {
        console.log(`   ${INFO} ${from} → ${to}   ${JSON.stringify(spec.key)}${opts.unique ? "  unique" : ""}`)
        renamed++
        continue
      }

      // Unikátny index sa zahodiť smie, len keď je isté, že sa dá vytvoriť
      // znova. Inak by po zlyhaní zostala kolekcia bez obmedzenia — a to je
      // horší stav než ten, z ktorého sme vyšli.
      if (opts.unique) {
        const duplicates = await duplicatesFor(col, spec)
        if (duplicates) {
          console.error(`   ${FAIL} ${from}: v dátach je duplicita, index sa po zahodení nevytvorí — nechávam tak`)
          console.error(`      ${JSON.stringify(duplicates)}`)
          failed++
          continue
        }
      }

      await col.dropIndex(from)
      try {
        await col.createIndex(spec.key, { ...opts, name: to })
      } catch (e) {
        // Toto je jediné miesto, kde sa dá skončiť horšie, než sa začalo.
        // Preto je hlásenie hlasné a hovorí, čo presne treba vrátiť.
        console.error(`   ${FAIL} ${to} sa nevytvoril po zahodení ${from}!`)
        console.error(`      ${e.message}`)
        console.error(`      OBNOV RUČNE: db.${collection}.createIndex(${JSON.stringify(spec.key)}, ${JSON.stringify({ ...opts, name: from })})`)
        failed++
        continue
      }
      console.log(`   ${OK} ${from} → ${to}`)
      renamed++
    }
  }

  console.log(
    `\n${OK} ${write ? "premenované" : "na premenovanie"}: ${renamed}` +
    `, preskočené: ${skipped}, chýbajúce: ${missing}` +
    (failed ? `, \x1b[31mZLYHALO: ${failed}\x1b[0m` : ""),
  )
  if (failed) process.exitCode = 1
  if (!write) console.log(`${INFO} spusti s --zapis, ak to sedí`)
} catch (e) {
  console.error(`${FAIL} ${e.message}`)
  process.exitCode = 1
} finally {
  await client.close()
}
