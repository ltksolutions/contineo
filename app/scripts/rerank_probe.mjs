/**
 * rerank_probe.mjs — zistí správnu syntax $rerank stage empiricky.
 *
 *     node --env-file=.env.local scripts/rerank_probe.mjs
 *
 * Dokumentácia k $rerank je JS-renderovaná a stage je natoľko nový, že sa
 * nedá spoľahlivo dohľadať. Server ale vracia presné serde hlášky, takže
 * najrýchlejšia cesta k pravde je nechať Atlas povedať, čo mu chýba.
 *
 * Prvý beh zistil tvar `query` a tri povinné polia. Skript teraz postupuje
 * automaticky: začne minimálnym spec-om a kým server hlási `missing field X`,
 * dopĺňa X zo zoznamu známych hodnôt. Tým sa odhalia aj polia, o ktorých
 * zatiaľ nevieme.
 *
 * Skript nič nemení — iba číta.
 */
import { MongoClient } from "mongodb"

const OK = "\x1b[32m✔\x1b[0m", CHYBA = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const DOTAZ = "lehota na podanie námietky"

if (!process.env.MONGODB_URI) {
  console.error(`${CHYBA} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

/** Hodnoty, ktoré vieme doplniť, keď si ich server vypýta. */
const HODNOTY = {
  query:           { text: DOTAZ },
  path:            "text",
  model:           "rerank-2",
  numDocsToRerank: 20,
  limit:           5,
  index:           "rag_rerank_index",
  scoreDetails:    false,
}

/** Modely na vyskúšanie, ak server odmietne ten prvý. */
// Názvy podľa Atlas → AI Model APIs → Rate Limits (overené v UI).
const MODELY = [
  "rerank-2",
  "rerank-2-lite",
  "voyage-rerank-2",
  "voyage/rerank-2",
]

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

/** Jeden pokus. Vráti {ok, vysledky} alebo {ok:false, chyba}. */
async function skus(col, spec) {
  const pipeline = [
    { $match: { isActive: true } },
    { $limit: 20 },
    { $rerank: spec },
    { $project: { _id: 0, articleRef: 1, heading: 1, skore: { $meta: "score" } } },
  ]
  try {
    return { ok: true, vysledky: await col.aggregate(pipeline).toArray() }
  } catch (e) {
    return { ok: false, chyba: e.message.split("\n")[0] }
  }
}

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("document_chunks")
  const { version } = await db.admin().serverStatus()
  console.log(`\nMongoDB ${version}\n`)

  let spec = { query: HODNOTY.query }
  let hotovo = null

  for (let krok = 1; krok <= 12; krok++) {
    const r = await skus(col, spec)

    if (r.ok) { hotovo = { spec, vysledky: r.vysledky }; break }

    console.log(`${INFO} ${krok}. ${JSON.stringify(spec)}`)
    console.log(`    ${r.chyba.slice(0, 170)}`)

    // "missing field `model`" → doplň model
    const chyba = r.chyba.match(/missing field [`'"](\w+)[`'"]/)
    if (chyba && HODNOTY[chyba[1]] !== undefined && spec[chyba[1]] === undefined) {
      spec = { ...spec, [chyba[1]]: HODNOTY[chyba[1]] }
      continue
    }
    if (chyba) {
      console.log(`\n${CHYBA} Server pýta pole \`${chyba[1]}\`, ktoré nepoznám.`)
      console.log(`   Doplň ho do HODNOTY v tomto skripte a spusti znova.`)
      break
    }

    // Spec je poskladaný, ale server ho odmieta z iného dôvodu —
    // najpravdepodobnejšie nesedí názov modelu.
    if (spec.model && /model|not found|unsupported|unknown/i.test(r.chyba)) {
      const dalsi = MODELY[MODELY.indexOf(spec.model) + 1]
      if (dalsi) {
        console.log(`    → skúšam model "${dalsi}"`)
        spec = { ...spec, model: dalsi }
        continue
      }
    }
    break
  }

  console.log("\n" + "─".repeat(74))

  if (hotovo) {
    console.log(`\n${OK} Správna syntax $rerank:\n`)
    console.log(JSON.stringify({ $rerank: hotovo.spec }, null, 2))
    console.log(`\n${hotovo.vysledky.length} výsledkov, top 3:`)
    for (const v of hotovo.vysledky.slice(0, 3)) {
      console.log(`  • ${v.articleRef ?? "—"}  skóre ${v.skore}  ${(v.heading ?? "").slice(0, 55)}`)
    }
  } else {
    console.log(`\n${CHYBA} Syntax sa nepodarilo poskladať — pošli mi výpis vyššie.`)
  }

} catch (e) {
  console.error(`\n${CHYBA} ${e.message}`)
  process.exitCode = 1
} finally {
  await client.close()
}
