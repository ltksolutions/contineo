/**
 * migrate_chunking_profile.mjs — profil členenia na anglické názvy (jednorazovo).
 *
 *     node scripts/migrate_chunking_profile.mjs            # nasucho, nič nezapíše
 *     node scripts/migrate_chunking_profile.mjs --zapis    # zapíše
 *
 * **Čo sa stalo.** Pri veľkom premenovaní na anglické názvy sa `tenants.chunkovanie`
 * premenovalo na `tenants.chunking`, ale `tenantAdmin.ts` naďalej zapisoval do
 * starého poľa. Uloženie profilu členenia teda od tej migrácie **nemalo žiadny
 * účinok** — zápis šiel do poľa, ktoré už nikto nečítal. Zároveň sa vnútorné
 * kľúče profilu (`slovoClanok`, `slovoPriloha`, …) nikdy nepremenovali, kým typy
 * v `tenants.ts` už hovorili po anglicky.
 *
 * **Čo tento skript robí.** Poskladá profil z toho, čo v dokumente je — najprv
 * `chunking`, potom staršie `chunkovanie` — prevedie kľúče na anglické a zapíše
 * ho do `chunking`. Staré `chunkovanie` odstráni.
 *
 * **Prečo sa nemení odtlačok členenia.** `chunkingId` sa počíta z profilu v tvare,
 * akému rozumie chunker (`toChunkerProfile()` v `src/lib/chunkingProfile.ts`).
 * Táto migrácia mení len to, ako je profil uložený, nie to, čo dostane chunker —
 * dokumenty preto nezačnú vyzerať ako „narezané inak“ a nikomu nenaskočí
 * povinnosť potvrdzovať znova (D57).
 */
import { MongoClient } from "mongodb"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const OK = "\x1b[32m✓\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[2m·\x1b[0m"
const WRITE = process.argv.includes("--zapis")

const URI = process.env.MONGODB_URI
if (!URI) { console.error(`${FAIL} Chýba MONGODB_URI.`); process.exit(1) }

/** Staré meno → nové meno. Čokoľvek iné sa nechá tak a vypíše. */
const KEYS = {
  slovoClanok: "articleWord",
  articleWord: "articleWord",
  slovoPriloha: "annexWord",
  annexWord: "annexWord",
  opakovaniHlavicky: "headerRepeats",
  headerRepeats: "headerRepeats",
  cielMinTokenov: "minTokens",
  minTokens: "minTokens",
  cielMaxTokenov: "maxTokens",
  maxTokens: "maxTokens",
}

const client = new MongoClient(URI)
await client.connect()
const db = client.db(process.env.MONGODB_DB || "contineo")
const col = db.collection("tenants")

const all = await col.find({
  $or: [{ chunking: { $exists: true } }, { chunkovanie: { $exists: true } }],
}).toArray()

if (all.length === 0) {
  console.log(`${OK} Žiadny tenant nemá vlastný profil členenia. Niet čo migrovať.`)
  await client.close()
  process.exit(0)
}

const planned = []
for (const t of all) {
  // Novšie pole má prednosť: keby v oboch bolo niečo iné, `chunking` je to,
  // čo aplikácia doteraz čítala, a teda to, čo človek videl.
  const source = { ...(t.chunkovanie ?? {}), ...(t.chunking ?? {}) }
  const next = {}
  const unknown = []
  for (const [k, v] of Object.entries(source)) {
    if (KEYS[k]) next[KEYS[k]] = v
    else unknown.push(k)
  }
  const same =
    JSON.stringify(next) === JSON.stringify(t.chunking ?? {}) && t.chunkovanie === undefined
  planned.push({ code: t.companyCode, from: source, to: next, unknown, same })
}

console.log(`\nTenantov s profilom: ${all.length}\n`)
for (const p of planned) {
  console.log(`${p.same ? OK : INFO} ${p.code}`)
  console.log(`    z: ${JSON.stringify(p.from)}`)
  console.log(`    na: ${JSON.stringify(p.to)}`)
  if (p.unknown.length) console.log(`    ${FAIL} neznáme kľúče (zahodia sa): ${p.unknown.join(", ")}`)
}

const todo = planned.filter(p => !p.same)
if (todo.length === 0) {
  console.log(`\n${OK} Všetko je už v anglickej podobe. Nič sa nemení.`)
  await client.close()
  process.exit(0)
}

if (!WRITE) {
  console.log(`\n${INFO} Nasucho. Zapíše sa až s --zapis (${todo.length} ${todo.length === 1 ? "tenant" : "tenantov"}).`)
  await client.close()
  process.exit(0)
}

// Záloha pred zápisom. Bez nej sa nezapisuje.
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const dir = join("data", "backup", stamp)
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, "tenants.json"), JSON.stringify(all, null, 2))
console.log(`\n${OK} Záloha: ${join(dir, "tenants.json")}`)

let done = 0
for (const p of todo) {
  const r = await col.updateOne(
    { companyCode: p.code },
    { $set: { chunking: p.to }, $unset: { chunkovanie: "" } },
  )
  if (r.modifiedCount) done++
}
console.log(`${OK} Upravených tenantov: ${done}`)
await client.close()
