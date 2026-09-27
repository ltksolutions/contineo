/**
 * learning_init.mjs — kolekcie a indexy modulu Vzdelávanie (ADR-018, D123).
 *
 *     node scripts/learning_init.mjs           vytvorí, čo chýba
 *     node scripts/learning_init.mjs --stav    len vypíše, čo existuje
 *
 * Len nové kolekcie modulu — existujúce sa nemenia (žiadna migrácia).
 * `certificates` pribudne s L3. Model: `docs/LEARNING_analyza_a_plan.md` kap. 4.
 */

import { MongoClient } from "mongodb"

const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? "contineo"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const statusOnly = process.argv.includes("--stav")

if (!URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Nastav ju v app/.env.local alebo:`)
  console.error(`     export MONGODB_URI="mongodb+srv://..."`)
  process.exit(1)
}

const PLAN = [
  {
    collection: "courses",
    indexes: [
      { key: { companyCode: 1, key: 1 }, opts: { unique: true, name: "tenant_course_unique" },
        why: "kľúč kurzu je jedinečný v rámci tenanta (je v adrese)" },
      { key: { companyCode: 1, "smartTags.key": 1, "smartTags.value": 1 }, opts: { name: "tenant_smart_tags" },
        why: "filter podľa smart:tagov (D117)" },
    ],
  },
  {
    collection: "enrollments",
    indexes: [
      { key: { companyCode: 1, personId: 1, courseKey: 1 }, opts: { unique: true, name: "tenant_person_course_unique" },
        why: "jeden zápis osoby do kurzu — druhý obnovuje prvý" },
      { key: { companyCode: 1, id: 1 }, opts: { unique: true, name: "tenant_enrollment_id" },
        why: "zápis podľa identifikátora (udalosti postupu naň odkazujú)" },
      { key: { companyCode: 1, courseKey: 1 }, opts: { name: "tenant_course" },
        why: "zapísaní do kurzu (správa kurzu, ?tab=people)" },
    ],
  },
  {
    collection: "part_completions",
    indexes: [
      { key: { companyCode: 1, enrollmentId: 1, partKey: 1 }, opts: { unique: true, name: "enrollment_part_unique" },
        why: "dokončenie časti vzniká raz (D24) — dvojklik zapíše raz" },
    ],
  },
  {
    collection: "video_watch",
    indexes: [
      { key: { companyCode: 1, enrollmentId: 1, partKey: 1, blockId: 1 }, opts: { unique: true, name: "enrollment_block_unique" },
        why: "jedno meranie sledovania na blok videa v zápise" },
    ],
  },
  // ── L2: banka otázok, testy, pokusy (D120, D121) ──
  {
    collection: "questions",
    indexes: [
      { key: { companyCode: 1, key: 1 }, opts: { unique: true, name: "tenant_question_unique" },
        why: "kľúč otázky je jedinečný v tenante (import CSV cez id)" },
      { key: { companyCode: 1, "smartTags.key": 1, "smartTags.value": 1 }, opts: { name: "tenant_question_tags" },
        why: "losovanie a filter banky podľa smart:tagov" },
    ],
  },
  {
    collection: "question_imports",
    indexes: [
      { key: { expiresAt: 1 }, opts: { expireAfterSeconds: 0, name: "expires_ttl" },
        why: "dočasný súbor importu CSV zmizne po 24 h" },
    ],
  },
  {
    collection: "tests",
    indexes: [
      { key: { companyCode: 1, key: 1 }, opts: { unique: true, name: "tenant_test_unique" },
        why: "kľúč testu je jedinečný v tenante (je v adrese)" },
      { key: { companyCode: 1, "responsible.personId": 1 }, opts: { name: "tenant_test_responsible" },
        why: "záložka Výsledky — testy, za ktoré človek zodpovedá (D121)" },
    ],
  },
  {
    collection: "test_attempts",
    indexes: [
      { key: { companyCode: 1, id: 1 }, opts: { unique: true, name: "tenant_attempt_id" },
        why: "pokus podľa identifikátora (je v adrese)" },
      { key: { companyCode: 1, idempotencyKey: 1 }, opts: { unique: true, name: "attempt_idempotency" },
        why: "jedno „Spustiť“ = jeden pokus aj pri dvojkliku" },
      { key: { companyCode: 1, personId: 1, testKey: 1 }, opts: { name: "tenant_person_test" },
        why: "pokusy osoby o test — dostupnosť, pauza, počet" },
      { key: { companyCode: 1, "context.enrollmentId": 1 }, opts: { name: "tenant_attempt_enrollment" },
        why: "prejdené testy zápisu — odvodenie postupu (D119)" },
      { key: { companyCode: 1, testKey: 1, startedAt: -1 }, opts: { name: "tenant_test_attempts" },
        why: "záložka Výsledky — pokusy o test" },
    ],
  },
]
const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const info = await client.db().admin().command({ buildInfo: 1 })
  console.log(`${OK} pripojené · MongoDB ${info.version} · databáza ${DB}\n`)
  const db = client.db(DB)
  const existing = (await db.listCollections().toArray()).map(c => c.name)

  for (const { collection, indexes } of PLAN) {
    if (existing.includes(collection)) {
      console.log(`${INFO} kolekcia ${collection} už existuje`)
    } else if (statusOnly) {
      console.log(`${INFO} kolekcia ${collection} CHÝBA`)
      continue
    } else {
      await db.createCollection(collection)
      console.log(`${OK} vytvorená kolekcia ${collection}`)
    }

    const col = db.collection(collection)
    const existingIndexes = await col.indexes()
    for (const { key, opts, why } of indexes) {
      const names = existingIndexes.map(i => i.name)
      if (names.includes(opts.name)) {
        console.log(`   ${INFO} index ${opts.name} už existuje`)
        continue
      }
      if (statusOnly) {
        console.log(`   ${INFO} index ${opts.name} CHÝBA — ${why}`)
        continue
      }
      await col.createIndex(key, opts)
      console.log(`   ${OK} index ${opts.name} — ${why}`)
    }
    console.log("")
  }

  if (statusOnly) console.log(`${INFO} len výpis stavu, nič sa nezmenilo`)
  else console.log(`${OK} hotovo`)
} catch (e) {
  console.error(`${FAIL} ${e.message ?? e}`)
  process.exitCode = 1
} finally {
  await client.close()
}
