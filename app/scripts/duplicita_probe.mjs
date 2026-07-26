/**
 * duplicita_probe.mjs — nájde stage, ktorý zdvojuje výsledky.
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

const OK = "\x1b[32m✔\x1b[0m", ZLE = "\x1b[31m✘\x1b[0m"
const i = process.argv.indexOf("--dotaz")
const DOTAZ = i >= 0 ? process.argv[i + 1] : "Koľko je odstupné za hráča od 20 rokov z 3. ligy?"

if (!process.env.MONGODB_URI) {
  console.error(`${ZLE} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

/** Spustí pipeline a povie, či v nej sú zdvojené _id. */
async function zmeraj(col, nazov, pipeline) {
  try {
    const r = await col.aggregate([...pipeline, { $project: { _id: 1, articleRef: 1 } }]).toArray()
    const unikatnych = new Set(r.map(x => String(x._id))).size
    const cisto = r.length === unikatnych
    console.log(`${cisto ? OK : ZLE} ${nazov.padEnd(46)} ${String(r.length).padStart(3)} výsledkov · ${String(unikatnych).padStart(3)} jedinečných`)
    if (!cisto) {
      const pocty = new Map()
      for (const x of r) pocty.set(String(x._id), (pocty.get(String(x._id)) ?? 0) + 1)
      const zdvojene = [...pocty].filter(([, n]) => n > 1).slice(0, 3)
      for (const [id, n] of zdvojene) {
        const vzor = r.find(x => String(x._id) === id)
        console.log(`      ${n}× ${vzor?.articleRef ?? "—"}  (_id ${id.slice(-8)})`)
      }
    }
    return cisto
  } catch (e) {
    console.log(`${ZLE} ${nazov.padEnd(46)} ${e.message.split("\n")[0].slice(0, 60)}`)
    return true
  }
}

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("document_chunks")

  console.log(`\nDotaz: „${DOTAZ}“\n`)

  const vector = {
    $vectorSearch: {
      index: "rag_vector_index", path: "text", query: DOTAZ,
      numCandidates: 200, limit: 20, filter: { isActive: true },
    }
  }
  const rerank = {
    $rerank: {
      query: { text: DOTAZ }, path: "text",
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
  await zmeraj(col, "$vectorSearch", [vector])
  await zmeraj(col, "$vectorSearch → $rerank", [vector, rerank])
  await zmeraj(col, "$vectorSearch → $rerank → $limit", [vector, rerank, { $limit: 5 }])
  await zmeraj(col, "$vectorSearch → $lookup", [vector, lookup])
  await zmeraj(col, "$vectorSearch → $lookup → $unwind", [vector, lookup, unwind])
  await zmeraj(col, "celá vektorová pipeline", [vector, rerank, { $limit: 5 }, lookup, unwind])

  // $lookup mieri na documents._id — over, či tam nie je viac zhôd.
  console.log("\nKontrola cieľa $lookup")
  console.log("─".repeat(84))
  const vzorka = await col.findOne({ isActive: true })
  const zhody = await db.collection("documents")
    .find({ documentId: vzorka.documentId }).project({ documentId: 1, versionId: 1 }).toArray()
  console.log(`${zhody.length === 1 ? OK : ZLE} documents.documentId = "${vzorka.documentId}" → ${zhody.length} zhôd`)
  if (zhody.length !== 1) console.log(`      viac zhôd = $lookup zdvojí každý chunk`)

  console.log("\nHybridná vetva")
  console.log("─".repeat(84))
  const rankFusion = {
    $rankFusion: {
      input: { pipelines: {
        text: [{ $search: { index: "rag_text_index",
                 compound: { should: [{ text: { query: DOTAZ, path: "text" } }] } } },
                { $limit: 20 }],
        vec:  [vector],
      } },
    }
  }
  await zmeraj(col, "$rankFusion", [rankFusion])
  await zmeraj(col, "$rankFusion → $rerank → $limit", [rankFusion, rerank, { $limit: 5 }])

} catch (e) {
  console.error(`\n${ZLE} ${e.message}`)
  process.exitCode = 1
} finally {
  await client.close()
}
