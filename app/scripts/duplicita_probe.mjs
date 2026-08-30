/**
 * duplicita_probe.mjs — nájde stage, ktorý zdvojuje výsledky.
 *
 * ⚠️ POUČENIE Z PRVÉHO BEHU: tento skript má pipeline napísanú NAZNOVO,
 * a to je jeho slabina. Prvý raz vyšiel čisto, hoci aplikácia duplicity
 * vracala — lebo som doňho dala `filter: { isActive: true }`, ktorý
 * v produkčnom kóde chýbal. Testoval teda niečo iné, než čo beží.
 *
 * Na overenie skutočného správania slúži `smoke.mjs`, ktorý bundluje
 * kód zo `src/lib`. Táto sonda je len na hľadanie vinníka MEDZI stage-mi,
 * keď už vieme, že problém existuje.
 *
 *     node --env-file=.env.local scripts/duplicita_probe.mjs
 *     node --env-file=.env.local scripts/duplicita_probe.mjs --dotaz "..."
 *
 * Smoke test vracia ten istý chunk dvakrát, hoci audit ukázal, že databáza
 * je čistá — žiadne zdvojené dokumenty ani chunky. Duplicita teda vzniká
 * až v agregácii.
 *
 * Skript púšťa pipeline po častiach a po každom stage počíta, koľko je
 * výsledkov a koľko z nich má jedinečné _id. Prvý riadok, kde sa tie dve
 * čísla rozídu, ukazuje na vinníka.
 *
 * Skript nič nemení — iba číta.
 */
import { MongoClient } from "mongodb"

const OK = "\x1b[32m✔\x1b[0m", BAD = "\x1b[31m✘\x1b[0m"
const i = process.argv.indexOf("--dotaz")
const QUERY = i >= 0 ? process.argv[i + 1] : "Koľko je odstupné za hráča od 20 rokov z 3. ligy?"

if (!process.env.MONGODB_URI) {
  console.error(`${BAD} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

/** Spustí pipeline a povie, či v nej sú zdvojené _id. */
async function measure(col, name, pipeline) {
  try {
    const r = await col.aggregate([...pipeline, { $project: { _id: 1, articleRef: 1 } }]).toArray()
    const unique = new Set(r.map(x => String(x._id))).size
    const pure = r.length === unique
    console.log(`${pure ? OK : BAD} ${name.padEnd(46)} ${String(r.length).padStart(3)} výsledkov · ${String(unique).padStart(3)} jedinečných`)
    if (!pure) {
      const counts = new Map()
      for (const x of r) counts.set(String(x._id), (counts.get(String(x._id)) ?? 0) + 1)
      const duplicated = [...counts].filter(([, n]) => n > 1).slice(0, 3)
      for (const [id, n] of duplicated) {
        const pattern = r.find(x => String(x._id) === id)
        console.log(`      ${n}× ${pattern?.articleRef ?? "—"}  (_id ${id.slice(-8)})`)
      }
    }
    return pure
  } catch (e) {
    console.log(`${BAD} ${name.padEnd(46)} ${e.message.split("\n")[0].slice(0, 60)}`)
    return true
  }
}

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("document_chunks")

  console.log(`\nDotaz: „${QUERY}“\n`)

  const vector = {
    $vectorSearch: {
      index: "rag_vector_index", path: "text", query: QUERY,
      numCandidates: 200, limit: 20, filter: { isActive: true },
    }
  }
  const rerank = {
    $rerank: {
      query: { text: QUERY }, path: "text",
      model: "rerank-2", numDocsToRerank: 20,
    }
  }
  const lookup = {
    $lookup: {
      from: "documents", localField: "documentId", foreignField: "documentId",
      as: "document", pipeline: [{ $project: { title: 1 } }],
    }
  }
  const unwind = { $unwind: { path: "$document", preserveNullAndEmptyArrays: true } }

  console.log("Vektorová vetva — stage po stage")
  console.log("─".repeat(84))
  await measure(col, "$vectorSearch", [vector])
  await measure(col, "$vectorSearch → $rerank", [vector, rerank])
  await measure(col, "$vectorSearch → $rerank → $limit", [vector, rerank, { $limit: 5 }])
  await measure(col, "$vectorSearch → $lookup", [vector, lookup])
  await measure(col, "$vectorSearch → $lookup → $unwind", [vector, lookup, unwind])
  await measure(col, "celá vektorová pipeline", [vector, rerank, { $limit: 5 }, lookup, unwind])

  // $lookup mieri na documents._id — over, či tam nie je viac zhôd.
  console.log("\nKontrola cieľa $lookup")
  console.log("─".repeat(84))
  const sample = await col.findOne({ isActive: true })
  const matches = await db.collection("documents")
    .find({ documentId: sample.documentId }).project({ documentId: 1, versionId: 1 }).toArray()
  console.log(`${matches.length === 1 ? OK : BAD} documents.documentId = "${sample.documentId}" → ${matches.length} zhôd`)
  if (matches.length !== 1) console.log(`      viac zhôd = $lookup zdvojí každý chunk`)

  console.log("\nHybridná vetva")
  console.log("─".repeat(84))
  const rankFusion = {
    $rankFusion: {
      input: { pipelines: {
        text: [{ $search: { index: "rag_text_index",
                 compound: { should: [{ text: { query: QUERY, path: "text" } }] } } },
                { $limit: 20 }],
        vec:  [vector],
      } },
    }
  }
  await measure(col, "$rankFusion", [rankFusion])
  await measure(col, "$rankFusion → $rerank → $limit", [rankFusion, rerank, { $limit: 5 }])

} catch (e) {
  console.error(`\n${BAD} ${e.message}`)
  process.exitCode = 1
} finally {
  await client.close()
}
