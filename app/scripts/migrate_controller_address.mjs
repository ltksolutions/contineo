/**
 * migrate_controller_address.mjs — rozdelí sídlo organizácie na časti
 * (10. 10. 2026).
 *
 *     npm run migrate:address              # náhľad
 *     npm run migrate:address -- --zapisat
 *
 * Do 10. 10. 2026 bolo sídlo jeden riadok `controller.address`
 * („Tomášikova 30C, 821 01 Bratislava"). Odteraz sa ukladajú časti
 * `street`, `streetNumber`, `postalCode`, `city` a riadok sa skladá
 * (`formatAddress()`, D27). Skript riadok rozloží tou istou funkciou ako
 * formulár (`parseAddress()`) a starý riadok zmaže.
 *
 * Riadok, ktorý sa nedá rozpoznať, sa **nemigruje** a vypíše sa — celý by
 * skončil v ulici a do päty dokumentov by išiel bez PSČ a mesta. Opraví ho
 * človek v Organizácia → Vzhľad; uloženie ho rozdelí samo.
 *
 * Idempotentný: organizácia, ktorá už má časti, sa preskočí.
 */
import { getClient, getCollection } from "../src/lib/mongodb.ts"
import { TENANTS_COLLECTION } from "../src/lib/tenants.ts"
import { formatAddress, parseAddress } from "../src/lib/address.ts"

const ZAPISAT = process.argv.includes("--zapisat")
const OK = "\x1b[32m✔\x1b[0m", INFO = "\x1b[33m·\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m"

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spúšťa sa cez \`npm run migrate:address\`.`)
  process.exit(1)
}

const col = await getCollection(TENANTS_COLLECTION)
const tenants = await col.find(
  { "controller.address": { $exists: true, $ne: "" } },
  { projection: { companyCode: 1, controller: 1 } },
).toArray()

const plan = [], skipped = []
for (const t of tenants) {
  const c = t.controller ?? {}
  if ([c.street, c.streetNumber, c.postalCode, c.city].some(v => v && v.trim())) continue
  const parts = parseAddress(c.address)
  // Rozpoznané = všetky štyri časti a zložený riadok sa zhoduje s pôvodným
  // (až na medzery a tvar PSČ). Inak radšej človek.
  const complete = parts.street && parts.streetNumber && parts.postalCode && parts.city
  if (complete) plan.push({ code: t.companyCode, from: c.address, parts })
  else skipped.push({ code: t.companyCode, from: c.address })
}

console.log(`\n${INFO} organizácií s jednoriadkovým sídlom: ${plan.length + skipped.length} · rozdelí sa: ${plan.length} · nerozpoznané: ${skipped.length}\n`)
for (const p of plan) {
  console.log(`  ${p.code}  „${p.from}"`)
  console.log(`        → ulica „${p.parts.street}" · číslo „${p.parts.streetNumber}" · PSČ „${p.parts.postalCode}" · mesto „${p.parts.city}"`)
  console.log(`        → riadok: „${formatAddress(p.parts)}"`)
}
for (const s of skipped) console.log(`  ${s.code}  „${s.from}"  (nerozpoznané — opraviť v Organizácia → Vzhľad)`)

if (!ZAPISAT) {
  console.log(`\n${INFO} len náhľad — zapíše sa s --zapisat`)
} else {
  for (const p of plan) {
    // Organizácia aj „ešte bez častí" v podmienke — súbežné uloženie
    // formulára medzi náhľadom a zápisom sa neprepíše.
    await col.updateOne(
      { companyCode: p.code, "controller.address": p.from, "controller.street": { $in: [null, ""] } },
      {
        $set: {
          "controller.street": p.parts.street,
          "controller.streetNumber": p.parts.streetNumber,
          "controller.postalCode": p.parts.postalCode,
          "controller.city": p.parts.city,
        },
        $unset: { "controller.address": "" },
      },
    )
  }
  console.log(`\n${OK} zapísané: ${plan.length}`)
}
await (await getClient()).close()
