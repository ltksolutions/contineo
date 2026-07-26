/**
 * smoke.mjs — overí celú reťaz od dotazu po odpoveď nad reálnymi dátami.
 *
 *     node --env-file=.env.local scripts/smoke.mjs
 *     node --env-file=.env.local scripts/smoke.mjs --odpoved     (aj generovanie cez Claude)
 *     node --env-file=.env.local scripts/smoke.mjs --dotaz "Aká je lehota na námietku?"
 *
 * Zámerne používa SKUTOČNÝ kód z src/lib (zbundlovaný esbuildom), nie jeho
 * kópiu — inak by test overoval niečo iné, než čo beží v aplikácii.
 *
 * Bez --odpoved nevolá Claude, takže nič nestojí a testuje len retrieval.
 */
import { build } from "esbuild"
import { mkdirSync, rmSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { MongoClient } from "mongodb"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, "../src")

const args = process.argv.slice(2)
const chceOdpoved = args.includes("--odpoved")
const akoVerejny = args.includes("--verejne")
const rola = akoVerejny ? "public" : "internal"
const i = args.indexOf("--dotaz")
const vlastnyDotaz = i >= 0 ? args[i + 1] : null

const OK = "\x1b[32m✔\x1b[0m", CHYBA = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const DOTAZY = vlastnyDotaz ? [vlastnyDotaz] : [
  "Aká je lehota na podanie námietky?",
  "Kto schvaľuje prestup maloletého hráča?",
  "Koľko je odstupné za hráča od 20 rokov z 3. ligy?",
  "Aký je trest za tri žlté karty?",
  "Ako sa volí prezident SFZ?",
]

if (!process.env.MONGODB_URI) {
  console.error(`${CHYBA} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

// ── zbundlovanie skutočného kódu ─────────────────────────────────────────────
// Bundle musí vzniknúť VNÚTRI projektu — `mongodb` necháme ako externú
// závislosť a Node ju hľadá v node_modules relatívne k súboru. Z /tmp
// by ju nenašiel.
const tmp = resolve(HERE, "../node_modules/.contineo-smoke")
mkdirSync(tmp, { recursive: true })
const bundle = join(tmp, "lib.mjs")
await build({
  stdin: {
    contents: `
      export { fulltextSearch, vectorSearch, hybridSearch } from "${SRC}/lib/mongoSearch.ts"
      export { classifyQuery } from "${SRC}/lib/queryClassifier.ts"
      export { defaultProfile } from "${SRC}/lib/tenantProfile.ts"
      export { getProviders } from "${SRC}/lib/providers/factory.ts"
      export { assertEmbeddingSpace, embeddingStats } from "${SRC}/lib/embeddingGuard.ts"
      export { generateAnswer } from "${SRC}/lib/llmGenerator.ts"
    `,
    resolveDir: SRC,
    loader: "ts",
  },
  bundle: true, outfile: bundle, format: "esm", platform: "node",
  external: ["mongodb"], logLevel: "error",
})
const lib = await import(pathToFileURL(bundle).href)

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("document_chunks")

  const pocet = await col.countDocuments({ isActive: true })
  console.log(`\n${OK} pripojené · ${pocet} aktívnych chunkov\n`)
  if (!pocet) {
    console.error(`${CHYBA} Korpus je prázdny — najprv spusti import.`)
    process.exit(1)
  }

  // Rozloženie accessLevel — ak by sa nič nenašlo, toto povie prečo.
  const podlaPristupu = await col.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: "$accessLevel", n: { $sum: 1 } } },
  ]).toArray()
  console.log(`Prístupové úrovne: ${podlaPristupu.map(x => `${x._id}=${x.n}`).join(" · ")}`)
  console.log(`Testujem ako: ${rola}${akoVerejny ? "" : "   (--verejne = len verejný obsah)"}\n`)

  // getProviders vytvára všetky adaptéry naraz, teda aj generovanie. Bez
  // --odpoved sa generovanie nepoužije, tak kľúč len zastúpime — inak by
  // sa retrieval nedal otestovať bez platného Anthropic kľúča.
  if (!chceOdpoved && !process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = "sk-ant-zastupny-nepouzije-sa"
    console.log(`${INFO} ANTHROPIC_API_KEY nie je nastavený — generovanie preskočené, retrieval sa testuje normálne.`)
  }
  if (chceOdpoved && !process.env.ANTHROPIC_API_KEY) {
    console.error(`${CHYBA} --odpoved vyžaduje ANTHROPIC_API_KEY v .env.local`)
    process.exit(1)
  }

  const profile = lib.defaultProfile()
  const providers = lib.getProviders(profile)
  console.log(`Profil: embedding=${profile.providers.embedding.kind}/${profile.providers.embedding.model}` +
              ` · rerank=${profile.providers.rerank.kind}` +
              ` · generovanie=${profile.providers.generation.kind}/${profile.providers.generation.model}`)
  console.log(`vectorPath=${profile.providers.embedding.vectorPath}\n`)

  let zlyhalo = 0

  for (const dotaz of DOTAZY) {
    console.log("─".repeat(74))
    console.log(`DOTAZ: ${dotaz}`)

    const mod = await lib.classifyQuery(dotaz, false)
    const opts = {
      query: dotaz, accessLevel: rola, limit: 20, rerankLimit: 5,
      useStageRerank: providers.rerank.isPipelineStage,
      rerankModel: profile.providers.rerank.model,
      vectorPath: profile.providers.embedding.vectorPath,
    }

    let chunky
    const t0 = Date.now()
    try {
      chunky = mod === "fulltext" ? await lib.fulltextSearch(col, opts)
             : mod === "vector"   ? await lib.vectorSearch(col, opts)
             :                      await lib.hybridSearch(col, opts)
    } catch (e) {
      zlyhalo++
      console.log(`  ${CHYBA} vyhľadávanie zlyhalo (${mod}):`)
      console.log(`     ${e.message.replace(/\s+/g, " ")}`)
      if (/rerank/i.test(e.message)) {
        console.log(`     → skús RERANK_KIND="none" v .env.local`)
      }
      continue
    }
    const ms = Date.now() - t0

    console.log(`  režim: ${mod} · nájdených: ${chunky.length} · ${ms} ms`)
    if (!chunky.length) {
      zlyhalo++
      console.log(`  ${CHYBA} nič sa nenašlo — buď sa ešte negenerujú vektory, alebo je zle filter`)
      continue
    }

    try {
      lib.assertEmbeddingSpace(chunky, profile.providers.embedding.model)
    } catch (e) {
      zlyhalo++
      console.log(`  ${CHYBA} ${e.message.slice(0, 160)}`)
    }

    for (const c of chunky.slice(0, 3)) {
      const zdroj = c.document?.title ?? c.documentId
      const skore = c.score != null ? ` · skóre ${Number(c.score).toFixed(4)}` : ""
      console.log(`    • ${c.articleRef ?? "—"}  ${zdroj}${skore}`)
      console.log(`      ${(c.heading ?? "").slice(0, 70)}`)
    }

    if (chceOdpoved) {
      const stream = lib.generateAnswer({ query: dotaz, chunks: chunky.slice(0, 8), userRole: rola, profile })
      const reader = stream.getReader()
      const dec = new TextDecoder()
      let text = "", citacii = 0, model = "?", buf = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // Buffer je nutný: JSON sa môže rozdeliť medzi dva pakety a bez
        // neho by sa taký riadok ticho stratil.
        buf += dec.decode(value, { stream: true })
        const riadky = buf.split("\n")
        buf = riadky.pop() ?? ""
        for (const r of riadky) {
          if (!r.startsWith("data:")) continue
          try {
            const ev = JSON.parse(r.slice(5))
            if (ev.type === "token") text += ev.token
            else if (ev.type === "citation") citacii++
            else if (ev.type === "done") model = ev.model
            else if (ev.type === "error") { zlyhalo++; console.log(`  ${CHYBA} generovanie: ${ev.message}`) }
          } catch {}
        }
      }
      if (text) {
        console.log(`\n  ODPOVEĎ (${model}, ${citacii} overiteľných citácií):`)
        console.log(text.split("\n").map(r => "    " + r).join("\n"))
      }
    }
  }

  console.log("─".repeat(74))
  console.log(zlyhalo ? `\n${CHYBA} ${zlyhalo} problém(ov)` : `\n${OK} Celá reťaz funguje.`)
  if (!chceOdpoved) console.log(`${INFO} Skús aj generovanie:  --odpoved`)
  process.exitCode = zlyhalo ? 1 : 0

} catch (e) {
  console.error(`\n${CHYBA} ${e.message}`)
  process.exitCode = 1
} finally {
  await client.close()
  rmSync(tmp, { recursive: true, force: true })
}
