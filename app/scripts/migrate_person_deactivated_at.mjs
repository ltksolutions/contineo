/**
 * migrate_person_deactivated_at.mjs — doplní `persons.deactivatedAt` z auditu
 * (ADR-012, D100).
 *
 *     node --env-file=.env.local scripts/migrate_person_deactivated_at.mjs           # náhľad
 *     node --env-file=.env.local scripts/migrate_person_deactivated_at.mjs --zapisat
 *
 * Od ADR-012 sa dátum vyradenia zapisuje pri osobe, lebo audit sa po 24
 * mesiacoch maže a lehota dokladov plynie dlhšie. Osoby vyradené skôr ho
 * nemajú — tu sa doplní z **posledného** záznamu auditu `vyradene` pri osobe.
 *
 * Vyradená osoba bez záznamu v audite (vyradená skriptom alebo importom) sa
 * **nedopĺňa** a vypíše sa. Vymyslený dátum by posunul lehotu; bez dátumu
 * platí strop 5 rokov od poslednej udalosti (D100), čo je správne správanie.
 *
 * Idempotentný: osoba, ktorá `deactivatedAt` už má, sa preskočí.
 */
import { MongoClient } from "mongodb"

const ZAPISAT = process.argv.includes("--zapisat")
const OK = "\x1b[32m✔\x1b[0m", INFO = "\x1b[33m·\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m"

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
try {
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const persons = await db.collection("persons")
    .find({ status: "inactive", deactivatedAt: { $in: [null] } }, { projection: { id: 1, companyCode: 1, fullName: 1 } })
    .toArray()

  const plan = [], bezAuditu = []
  for (const p of persons) {
    // Organizácia v podmienke (D32) — `targetId` je náhodné, ale nie posvätné.
    const last = await db.collection("audit").findOne(
      { companyCode: p.companyCode, subject: "person", action: "vyradene", targetId: p.id },
      { sort: { at: -1 }, projection: { at: 1 } },
    )
    if (last?.at) plan.push({ p, at: last.at })
    else bezAuditu.push(p)
  }

  console.log(`\n${INFO} vyradených bez dátumu: ${persons.length} · doplní sa z auditu: ${plan.length} · bez záznamu v audite: ${bezAuditu.length}\n`)
  for (const { p, at } of plan) console.log(`  ${p.companyCode}  ${p.id}  → ${at.toISOString()}`)
  for (const p of bezAuditu) console.log(`  ${p.companyCode}  ${p.id}  (bez záznamu — nedopĺňa sa, platí strop 5 rokov)`)

  if (!ZAPISAT) {
    console.log(`\n${INFO} len náhľad — zapíše sa s --zapisat`)
  } else {
    for (const { p, at } of plan) {
      await db.collection("persons").updateOne(
        { companyCode: p.companyCode, id: p.id, deactivatedAt: { $in: [null] } },
        { $set: { deactivatedAt: at } },
      )
    }
    console.log(`\n${OK} zapísané: ${plan.length}`)
  }
} catch (e) {
  console.error(`${FAIL} ${e.message ?? e}`)
  process.exitCode = 1
} finally {
  await client.close()
}
