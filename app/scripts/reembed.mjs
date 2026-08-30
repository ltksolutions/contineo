/**
 * reembed.mjs — správa vektorového priestoru korpusu (ADR-001, sekcia 4).
 *
 *   node scripts/reembed.mjs --stav
 *       Prehľad: koľko chunkov je z ktorého modelu, koľko čaká na backfill.
 *
 *   node scripts/reembed.mjs --backfill --model voyage-4 [--dry-run]
 *       Doplní embeddingModel/Dim/Provider na staré chunky, ktoré pole nemajú.
 *       NEPREPOČÍTAVA vektory — len ich označí. Použiť len vtedy, keď naozaj
 *       vieš, ktorým modelom boli vyrobené.
 *
 *   node scripts/reembed.mjs --reembed --from voyage-4 --to BAAI/bge-m3 --dim 1024
 *       Naplánuje prepočet: označí dotknuté chunky ako `reembedPending`.
 *       Samotný prepočet robí worker — ten musí vektory vyrobiť novým modelom
 *       a zapísať ich spolu s novým embeddingModel.
 *
 * Prečo to nie je jeden príkaz „prepni model":
 *   Vektory sa medzi modelmi neprenášajú. Zmena modelu = prepočet celého
 *   korpusu tenanta. Index sa smie prepnúť AŽ po dokončení, inak by časť
 *   korpusu bola v starom a časť v novom priestore — a retrieval by tíško
 *   vracal nezmysly.
 *
 * Výnimka: rodina voyage-4 zdieľa vektorový priestor (voyage-4, -large,
 * -lite, -nano), takže prechod v rámci nej prepočet NEVYŽADUJE.
 */

import { MongoClient } from "mongodb"

const SHARED_SPACES = {
  "voyage-4": ["voyage-4", "voyage-4-large", "voyage-4-lite", "voyage-4-nano"],
}
const space = (m) => {
  const k = String(m).trim().toLowerCase()
  for (const [s, members] of Object.entries(SHARED_SPACES)) if (members.includes(k)) return s
  return k
}
const compatible = (a, b) => space(a) === space(b)

// ── argumenty ────────────────────────────────────────────────────────────────
const A = process.argv.slice(2)
const has = (f) => A.includes(f)
const val = (f, d = null) => { const i = A.indexOf(f); return i >= 0 && A[i + 1] ? A[i + 1] : d }

const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? "contineo"
const COL = "document_chunks"
const DRY = has("--dry-run")

if (!URI) { console.error("Chýba MONGODB_URI"); process.exit(1) }

const client = new MongoClient(URI)
await client.connect()
const col = client.db(DB).collection(COL)

try {
  if (has("--stav")) await state()
  else if (has("--backfill")) await backfill()
  else if (has("--reembed")) await reembed()
  else {
    console.log("Použi --stav, --backfill alebo --reembed. Popis je v hlavičke súboru.")
  }
} finally {
  await client.close()
}

// ── prehľad ──────────────────────────────────────────────────────────────────
async function state() {
  const total = await col.countDocuments({})
  const withoutModel = await col.countDocuments({ embeddingModel: { $in: [null, ""] } })
  const missingField = await col.countDocuments({ embeddingModel: { $exists: false } })
  const pending = await col.countDocuments({ reembedPending: true })

  const byModel = await col.aggregate([
    { $group: { _id: { model: "$embeddingModel", dim: "$embeddingDim", provider: "$embeddingProvider" },
                pocet: { $sum: 1 } } },
    { $sort: { pocet: -1 } },
  ]).toArray()

  console.log(`\nKorpus: ${total} chunkov v ${DB}.${COL}\n`)
  console.log("Podľa modelu:")
  for (const r of byModel) {
    const m = r._id.model ?? "(pole chýba)"
    const d = r._id.dim ? `${r._id.dim} dim` : "dim neznámy"
    const p = r._id.provider ?? "provider neznámy"
    console.log(`  ${String(m).padEnd(28)} ${String(d).padEnd(14)} ${String(p).padEnd(14)} ${r.pocet}`)
  }

  const toBackfill = withoutModel + missingField
  console.log(`\n  čaká na backfill: ${toBackfill}`)
  console.log(`  označené na re-embed: ${pending}`)

  const models = byModel.map(r => r._id.model).filter(Boolean)
  const spaces = [...new Set(models.map(space))]
  if (spaces.length > 1) {
    console.log(`\n  POZOR: korpus obsahuje ${spaces.length} nekompatibilné vektorové priestory (${spaces.join(", ")}).`)
    console.log("  Retrieval bude vracať nezmysly, kým sa to nezjednotí.")
  } else if (spaces.length === 1) {
    console.log(`\n  Vektorový priestor je jednotný: ${spaces[0]}`)
  }
  console.log()
}

// ── backfill ─────────────────────────────────────────────────────────────────
async function backfill() {
  const model = val("--model")
  const dim = Number(val("--dim", 1024))
  const provider = val("--provider", "atlas-auto")
  if (!model) { console.error("Chýba --model (napr. --model voyage-4)"); process.exit(1) }

  const filter = { $or: [{ embeddingModel: { $exists: false } }, { embeddingModel: { $in: [null, ""] } }] }
  const count = await col.countDocuments(filter)

  console.log(`\nBackfill: ${count} chunkov dostane embeddingModel="${model}", dim=${dim}, provider="${provider}"`)
  console.log("Vektory sa NEPREPOČÍTAVAJÚ — len sa označia. Použi len ak vieš, ktorým modelom vznikli.\n")

  if (!count) { console.log("Niet čo dopĺňať.\n"); return }
  if (DRY) { console.log("--dry-run: nič sa nezapísalo.\n"); return }

  const r = await col.updateMany(filter, {
    $set: { embeddingModel: model, embeddingDim: dim, embeddingProvider: provider,
            embeddedAt: new Date() },
  })
  console.log(`Upravených: ${r.modifiedCount}\n`)
}

// ── re-embed ─────────────────────────────────────────────────────────────────
async function reembed() {
  const from = val("--from")
  const to = val("--to")
  const dim = Number(val("--dim", 1024))
  if (!from || !to) { console.error("Chýba --from a --to"); process.exit(1) }

  if (compatible(from, to)) {
    console.log(`\n"${from}" a "${to}" zdieľajú vektorový priestor (${space(from)}).`)
    console.log("Prepočet nie je potrebný — stačí prepnúť model v profile tenanta.\n")
    return
  }

  const filter = { embeddingModel: from }
  const count = await col.countDocuments(filter)

  console.log(`\nRe-embed: ${from} → ${to} (${dim} dim)`)
  console.log(`Dotknutých chunkov: ${count}`)
  console.log("\nPostup:")
  console.log("  1. tento skript označí chunky ako reembedPending")
  console.log("  2. worker ich prepočíta novým modelom a prepíše embedding + embeddingModel")
  console.log("  3. AŽ POTOM prepni vektorový index a model v profile tenanta")
  console.log("\n  Index neprepínaj skôr — časť korpusu by bola v starom priestore.\n")

  if (!count) { console.log("Niet čo prepočítavať.\n"); return }
  if (DRY) { console.log("--dry-run: nič sa nezapísalo.\n"); return }

  const r = await col.updateMany(filter, {
    $set: { reembedPending: true, reembedTarget: { model: to, dim }, reembedQueuedAt: new Date() },
  })
  console.log(`Označených na prepočet: ${r.modifiedCount}`)
  console.log(`Sleduj priebeh: node scripts/reembed.mjs --stav\n`)
}
