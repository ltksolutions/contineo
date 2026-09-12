/**
 * migrate_ack_cycle.mjs — poradie pokusu pri potvrdeniach (odvolanie, D24).
 *
 *     node scripts/migrate_ack_cycle.mjs --stav   len vypíše, čo by urobil
 *     node scripts/migrate_ack_cycle.mjs          vykoná
 *
 * **Prečo.** Po odvolaní potvrdenia povinnosť ožije a človek musí potvrdiť
 * znova. Dnešný unikátny index `{companyCode, personId, versionId}` mu to
 * nedovolí — a má pravdu, drží dvojité kliknutie (D24). Do kľúča preto pribúda
 * `cycle`: prvé potvrdenie 1, po odvolaní 2. Dve súbežné kliknutia vypočítajú
 * to isté číslo, takže ochrana zostáva presne taká, aká bola.
 *
 * **Poradie krokov je bezpečnostné, nie kozmetické:**
 *   1. dopíš `cycle: 1` potvrdeniam, ktoré ho nemajú,
 *   2. over, že na novom kľúči nie sú duplicity,
 *   3. vytvor **nový** index a až potom
 *   4. zahoď starý.
 *
 * Opačné poradie otvára okno, v ktorom kolekcia nemá žiadnu ochranu proti
 * dvojitému potvrdeniu. Dva indexy na chvíľu sú lacnejšie než žiadny.
 *
 * Skript je idempotentný: druhé spustenie nespraví nič.
 */

import { MongoClient } from "mongodb"

const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? "contineo"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const statusOnly = process.argv.includes("--stav")

const OLD_NAME = "acknowledgement_unique"
const NEW_NAME = "acknowledgement_cycle_unique"
const NEW_KEY = { companyCode: 1, personId: 1, versionId: 1, cycle: 1 }
const NEW_OPTS = { unique: true, name: NEW_NAME, partialFilterExpression: { type: "acknowledgement" } }

if (!URI) {
  console.error(`${FAIL} Chýba MONGODB_URI.`)
  process.exit(1)
}

const client = new MongoClient(URI)
await client.connect()
const col = client.db(DB).collection("acknowledgements")

try {
  const names = (await col.indexes()).map(i => i.name)
  const hasOld = names.includes(OLD_NAME)
  const hasNew = names.includes(NEW_NAME)

  // ── 1. Doplnenie poľa ────────────────────────────────────────────────────
  // Existujúce potvrdenia sú všetky prvý pokus. Keby pole chýbalo, indexovalo
  // by sa ako `null` a nový záznam s `cycle: 1` by sa od nich líšil — čiže by
  // prešlo druhé potvrdenie toho istého znenia. Preto sa dopisuje, nie
  // odvodzuje.
  const missing = await col.countDocuments({ type: "acknowledgement", cycle: { $exists: false } })
  if (statusOnly) {
    console.log(`${INFO} potvrdení bez \`cycle\`: ${missing}`)
  } else if (missing > 0) {
    const r = await col.updateMany(
      { type: "acknowledgement", cycle: { $exists: false } },
      { $set: { cycle: 1 } },
    )
    console.log(`${OK} \`cycle: 1\` dopísaný: ${r.modifiedCount}`)
  } else {
    console.log(`${INFO} \`cycle\` majú všetky potvrdenia`)
  }

  // ── 2. Kontrola duplicít ─────────────────────────────────────────────────
  // Keby `createIndex` zlyhal na duplicite až po zahodení starého, kolekcia by
  // zostala bez obmedzenia. Radšej sa nespraví nič, než aby sa spravila
  // polovica — rovnaká úvaha ako v `migrate_index_names.mjs`.
  const [dup] = await col.aggregate([
    { $match: { type: "acknowledgement" } },
    { $group: { _id: { companyCode: "$companyCode", personId: "$personId", versionId: "$versionId", cycle: "$cycle" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $limit: 1 },
  ]).toArray()

  if (dup) {
    console.error(`${FAIL} Na novom kľúči je duplicita, index sa nevytvorí:`)
    console.error(`     ${JSON.stringify(dup._id)} — ${dup.n}×`)
    process.exit(1)
  }
  console.log(`${OK} duplicity na novom kľúči nie sú`)

  // ── 3. Nový index ────────────────────────────────────────────────────────
  if (hasNew) {
    console.log(`${INFO} ${NEW_NAME} už existuje`)
  } else if (statusOnly) {
    console.log(`${INFO} vytvoril by som ${NEW_NAME}`)
  } else {
    await col.createIndex(NEW_KEY, NEW_OPTS)
    console.log(`${OK} ${NEW_NAME} vytvorený`)
  }

  // ── 4. Starý index až teraz ──────────────────────────────────────────────
  if (!hasOld) {
    console.log(`${INFO} ${OLD_NAME} tu nie je`)
  } else if (statusOnly) {
    console.log(`${INFO} zahodil by som ${OLD_NAME}`)
  } else {
    await col.dropIndex(OLD_NAME)
    console.log(`${OK} ${OLD_NAME} zahodený`)
  }
} finally {
  await client.close()
}
