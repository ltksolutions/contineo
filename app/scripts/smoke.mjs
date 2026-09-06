/**
 * smoke.mjs — overí celú reťaz od dotazu po odpoveď nad reálnymi dátami.
 *
 *     npm run smoke
 *     npm run smoke -- --odpoved     (aj generovanie cez Claude)
 *     npm run smoke -- --dotaz "Aká je lehota na námietku?"
 *
 * Zámerne používa SKUTOČNÝ kód z src/lib, nie jeho kópiu — inak by test
 * overoval niečo iné, než čo beží v aplikácii. TypeScript spúšťa priamo Node
 * (odstránenie typov) cez háčik scripts/lib/ts-hook.mjs; esbuild bol
 * z projektu odstránený 28. 8. 2026 a skript bol odvtedy nespustiteľný.
 *
 * Bez --odpoved nevolá Claude, takže nič nestojí a testuje len retrieval.
 */
import { MongoClient } from "mongodb"

// Skutočný kód aplikácie, nie jeho kópia. Bezpríponové importy vnútri týchto
// modulov dopĺňa scripts/lib/ts-hook.mjs — preto sa skript spúšťa cez
// `npm run smoke`, nie holým `node`.
import { fulltextSearch, vectorSearch, hybridSearch } from "../src/lib/mongoSearch.ts"
import { classifyQuery } from "../src/lib/queryClassifier.ts"
import { defaultProfile } from "../src/lib/tenantProfile.ts"
import { getProviders } from "../src/lib/providers/factory.ts"
import { assertEmbeddingSpace } from "../src/lib/embeddingGuard.ts"
import { generateAnswer } from "../src/lib/llmGenerator.ts"

const args = process.argv.slice(2)
const wantAnswer = args.includes("--odpoved")
const asPublic = args.includes("--verejne")
const role = asPublic ? "public" : "internal"
const i = args.indexOf("--dotaz")
const customQuery = i >= 0 ? args[i + 1] : null

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const QUERIES = customQuery ? [customQuery] : [
  "Aká je lehota na podanie námietky?",
  "Kto schvaľuje prestup maloletého hráča?",
  "Koľko je odstupné za hráča od 20 rokov z 3. ligy?",
  "Aký je trest za tri žlté karty?",
  "Ako sa volí prezident SFZ?",
]

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}


const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("document_chunks")

  const count = await col.countDocuments({ isActive: true })
  console.log(`\n${OK} pripojené · ${count} aktívnych chunkov\n`)
  if (!count) {
    console.error(`${FAIL} Korpus je prázdny — najprv spusti import.`)
    process.exit(1)
  }

  // Rozloženie accessLevel — ak by sa nič nenašlo, toto povie prečo.
  const byAccess = await col.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: "$accessLevel", n: { $sum: 1 } } },
  ]).toArray()
  console.log(`Prístupové úrovne: ${byAccess.map(x => `${x._id}=${x.n}`).join(" · ")}`)
  console.log(`Testujem ako: ${role}${asPublic ? "" : "   (--verejne = len verejný obsah)"}\n`)

  // getProviders vytvára všetky adaptéry naraz, teda aj generovanie. Bez
  // --odpoved sa generovanie nepoužije, tak kľúč len zastúpime — inak by
  // sa retrieval nedal otestovať bez platného Anthropic kľúča.
  if (!wantAnswer && !process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = "sk-ant-zastupny-nepouzije-sa"
    console.log(`${INFO} ANTHROPIC_API_KEY nie je nastavený — generovanie preskočené, retrieval sa testuje normálne.`)
  }
  if (wantAnswer && !process.env.ANTHROPIC_API_KEY) {
    console.error(`${FAIL} --odpoved vyžaduje ANTHROPIC_API_KEY v .env.local`)
    process.exit(1)
  }

  const profile = defaultProfile()
  const providers = getProviders(profile)
  console.log(`Profil: embedding=${profile.providers.embedding.kind}/${profile.providers.embedding.model}` +
              ` · rerank=${profile.providers.rerank.kind}` +
              ` · generovanie=${profile.providers.generation.kind}/${profile.providers.generation.model}`)
  console.log(`vectorPath=${profile.providers.embedding.vectorPath}\n`)

  let failed = 0

  for (const query of QUERIES) {
    console.log("─".repeat(74))
    console.log(`DOTAZ: ${query}`)

    const mod = await classifyQuery(query, false)
    const opts = {
      query: query, accessLevel: role, limit: 20, rerankLimit: 5,
      useStageRerank: providers.rerank.isPipelineStage,
      rerankModel: profile.providers.rerank.model,
      vectorPath: profile.providers.embedding.vectorPath,
    }

    let chunks
    const t0 = Date.now()
    try {
      chunks = mod === "fulltext" ? await fulltextSearch(col, opts)
             : mod === "vector"   ? await vectorSearch(col, opts)
             :                      await hybridSearch(col, opts)
    } catch (e) {
      failed++
      console.log(`  ${FAIL} vyhľadávanie zlyhalo (${mod}):`)
      console.log(`     ${e.message.replace(/\s+/g, " ")}`)
      if (/rerank/i.test(e.message)) {
        console.log(`     → skús RERANK_KIND="none" v .env.local`)
      }
      continue
    }
    const ms = Date.now() - t0

    console.log(`  režim: ${mod} · nájdených: ${chunks.length} · ${ms} ms`)
    if (!chunks.length) {
      failed++
      console.log(`  ${FAIL} nič sa nenašlo — buď sa ešte negenerujú vektory, alebo je zle filter`)
      continue
    }

    try {
      assertEmbeddingSpace(chunks, profile.providers.embedding.model)
    } catch (e) {
      failed++
      console.log(`  ${FAIL} ${e.message.slice(0, 160)}`)
    }

    // Archivované verzie sa NESMÚ dostať do výsledkov — odpoveď by citovala
    // zrušené znenie normy. Toto sa raz stalo, tak to kontrolujeme vždy.
    const archive = chunks.filter(c => c.isActive === false)
    if (archive.length) {
      failed++
      console.log(`  ${FAIL} ${archive.length} výsledkov je z ARCHIVOVANEJ verzie (isActive:false)`)
    }
    const preambles = chunks.filter(c => c.chunkType === "preambula")
    if (preambles.length) {
      failed++
      console.log(`  ${FAIL} ${preambles.length} výsledkov je preambula — filter nefunguje`)
    }
    // Koľko rôznych jednotiek a dokumentov je v top-5? Nízke číslo znamená,
    // že jeden dlhý článok obsadil väčšinu miest a zvyšok korpusu sa
    // nedostal k slovu.
    const units = new Set(chunks.map(c => `${c.documentId}|${c.articleRef}`)).size
    const documents = new Set(chunks.map(c => c.documentId)).size
    console.log(`  rozmanitosť: ${units} jednotiek · ${documents} dokumentov z ${chunks.length} výsledkov`)

    // chunkIndex a typ vypisujeme zámerne: dlhá jednotka sa delí na viac
    // chunkov s ROVNAKÝM articleRef aj heading. Bez indexu to vyzerá ako
    // duplicita a stálo nás to hodinu hľadania neexistujúcej chyby.
    for (const c of chunks.slice(0, 3)) {
      const source = c.document?.title ?? c.documentId
      const score = c.score != null ? ` · skóre ${Number(c.score).toFixed(4)}` : ""
      const type = c.chunkType && c.chunkType !== "clanok" ? ` [${c.chunkType}]` : ""
      console.log(`    • #${String(c.chunkIndex).padStart(3)} ${c.articleRef ?? "—"}${type}  ${source}${score}`)
      console.log(`          ${(c.heading ?? "").slice(0, 66)}`)
    }

    if (wantAnswer) {
      const stream = generateAnswer({ query: query, chunks: chunks.slice(0, 8), userRole: role, profile })
      const reader = stream.getReader()
      const dec = new TextDecoder()
      let text = "", citations = 0, model = "?", buf = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // Buffer je nutný: JSON sa môže rozdeliť medzi dva pakety a bez
        // neho by sa taký riadok ticho stratil.
        buf += dec.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const r of lines) {
          if (!r.startsWith("data:")) continue
          try {
            const ev = JSON.parse(r.slice(5))
            if (ev.type === "token") text += ev.token
            else if (ev.type === "citation") citations++
            else if (ev.type === "done") model = ev.model
            else if (ev.type === "error") { failed++; console.log(`  ${FAIL} generovanie: ${ev.message}`) }
          } catch {}
        }
      }
      if (text) {
        console.log(`\n  ODPOVEĎ (${model}, ${citations} overiteľných citácií):`)
        console.log(text.split("\n").map(r => "    " + r).join("\n"))
      }
    }
  }

  console.log("─".repeat(74))
  console.log(failed ? `\n${FAIL} ${failed} problém(ov)` : `\n${OK} Celá reťaz funguje.`)
  if (!wantAnswer) console.log(`${INFO} Skús aj generovanie:  --odpoved`)
  process.exitCode = failed ? 1 : 0

} catch (e) {
  console.error(`\n${FAIL} ${e.message}`)
  process.exitCode = 1
} finally {
  await client.close()
}
