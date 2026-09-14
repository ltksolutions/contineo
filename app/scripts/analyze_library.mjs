/**
 * analyze_library.mjs — aký profil členenia by sadol každému dokumentu (D79/C3).
 *
 *     npm run chunking:analyze -- --company SFZ
 *     npm run chunking:analyze -- --company SFZ --rozdiely
 *
 * **Číta, nemení.** Výstupom je tabuľka na potvrdenie, nie zápis. Je to tá istá
 * zásada ako pri `npm run check` (D59): skript meria a pomenúva, rozhoduje človek.
 * Preindexovanie je až samostatný, vedomý krok.
 *
 * `--rozdiely` vypíše len dokumenty, kde sa návrh **líši** od dnes priradeného
 * profilu — pri stovke dokumentov je to jediný použiteľný pohľad.
 */
import { MongoClient } from "mongodb"
import { analyseChunking, analysisReason, PLAIN_PROFILE_KEY } from "../src/lib/chunkingAnalysis.ts"
import { DEFAULT_PROFILE_KEY } from "../src/lib/chunkingProfile.ts"

const OK = "\x1b[32m✔\x1b[0m", BAD = "\x1b[31m✘\x1b[0m", WARN = "\x1b[33m▲\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const arg = (f) => { const i = process.argv.indexOf(f); return i === -1 ? null : process.argv[i + 1] ?? null }
const company = arg("--company")
const onlyDiff = process.argv.includes("--rozdiely")

if (!process.env.MONGODB_URI) {
  console.error(`${BAD} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const filter = company ? { companyCode: company } : {}
  const documents = await db.collection("documents").find(filter).toArray()
  const tenants = await db.collection("tenants").find(filter).toArray()
  const profilesByCode = new Map(tenants.map(t => [t.companyCode, (t.chunkingProfiles ?? []).map(p => p.key)]))

  const pad = (s, n) => String(s).padEnd(n)
  const rows = []

  for (const d of documents) {
    const effective = (d.versions ?? []).find(v => v.isActive)
    const text = String(effective?.markdown ?? d.markdown ?? "").trim()
    if (!text) { rows.push({ d, skip: "bez textu" }); continue }

    const a = analyseChunking(text)
    const suggested = a.confident ? a.suggestions[0].key : PLAIN_PROFILE_KEY
    const current = d.chunkingProfile ?? DEFAULT_PROFILE_KEY
    rows.push({ d, a, suggested, current, same: suggested === current })
  }

  const shown = onlyDiff ? rows.filter(r => r.a && !r.same) : rows
  console.log(`\n${INFO} Dokumentov: ${documents.length}${onlyDiff ? ` · zobrazené len rozdiely: ${shown.length}` : ""}\n`)
  console.log([pad("documentId", 38), pad("dnes", 14), pad("návrh", 14), "prečo"].join(" "))
  console.log("─".repeat(120))

  for (const r of shown) {
    if (r.skip) { console.log(`${pad(r.d.documentId, 38)} ${INFO} ${r.skip}`); continue }
    const mark = r.same ? OK : WARN
    console.log([
      pad(r.d.documentId, 38),
      pad(r.current, 14),
      pad(r.suggested, 14),
      `${mark} ${analysisReason(r.a)}`,
    ].join(" "))
  }

  const diffs = rows.filter(r => r.a && !r.same)
  const plain = rows.filter(r => r.a && !r.a.confident)
  console.log("─".repeat(120))
  console.log(`${rows.filter(r => r.a).length} dokumentov s textom · ${diffs.length} s odlišným návrhom · ${plain.length} bez rozpoznaného členenia`)

  // Profil, ktorý by návrh potreboval a organizácia ho nemá, je podstatnejší
  // než samotný rozdiel: bez neho sa návrh nedá potvrdiť, len prečítať.
  const missing = new Set()
  for (const r of diffs) {
    const have = profilesByCode.get(r.d.companyCode) ?? []
    if (!have.includes(r.suggested)) missing.add(`${r.d.companyCode}:${r.suggested}`)
  }
  if (missing.size) {
    console.log(`\n${WARN} Profily, ktoré návrh potrebuje a organizácia ich nemá: ${[...missing].join(", ")}`)
    console.log(`   Bez nich sa návrh nedá potvrdiť. Založ ich v nastavení organizácie, záložka Členenie.`)
  }
  if (diffs.length === 0) {
    console.log(`${OK} Každý dokument má profil, ktorý mu podľa textu aj patrí.`)
  } else {
    console.log(`${INFO} Skript nič nemenil. Profil sa mení na dokumente a preindexovanie je samostatný krok.`)
  }
} finally {
  await client.close()
}
