/**
 * migrate_widget_refs.mjs — `persons.externalRef.widget.<kanál>` z reťazca
 * na zoznam (ADR-042, D280).
 *
 *     npm run migrate:widget-refs             # náhľad
 *     npm run migrate:widget-refs -- --zapisat
 *
 * Osoba z widgetu je e-mailový kontakt a jeden e-mail v ISSF zdieľa viac
 * účtov (rodič za deti). Do 27. 10. 2026 nesla jeden identifikátor účtu,
 * ktorý sa pri striedaní účtov prepisoval; odteraz je to zoznam všetkých
 * účtov, z ktorých z adresy písali. Kód číta oba tvary (`widgetRefs()`),
 * migrácia len zjednotí dáta — poradie nasadenie → migrácia je bezpečné.
 *
 * Idempotentný: zoznam sa nemení, reťazec sa obalí do zoznamu. Vypisuje sa
 * len počet a identifikátor osoby (`id`), nie meno ani e-mail.
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
    .find({ "externalRef.widget": { $type: "object" } }, { projection: { id: 1, companyCode: 1, "externalRef.widget": 1 } })
    .toArray()

  const plan = []
  for (const p of persons) {
    const set = {}
    for (const [channel, value] of Object.entries(p.externalRef.widget ?? {})) {
      if (typeof value === "string" && value) set[`externalRef.widget.${channel}`] = [value]
    }
    if (Object.keys(set).length) plan.push({ p, set })
  }

  console.log(`\n${INFO} osôb z widgetu: ${persons.length} · na prevod reťazca na zoznam: ${plan.length}\n`)
  for (const { p, set } of plan) console.log(`  ${p.companyCode}  ${p.id}  ${Object.keys(set).length} kanál(y)`)

  if (!ZAPISAT) {
    console.log(`\n${INFO} len náhľad — zapíše sa s --zapisat`)
  } else {
    for (const { p, set } of plan) {
      // Organizácia v podmienke (D32).
      await db.collection("persons").updateOne({ companyCode: p.companyCode, id: p.id }, { $set: set })
    }
    console.log(`\n${OK} zapísané: ${plan.length}`)
  }
} catch (e) {
  console.error(`${FAIL} ${e.message ?? e}`)
  process.exitCode = 1
} finally {
  await client.close()
}
