/**
 * person.mjs — role a skupiny jednej osoby (D38, D33).
 *
 *     npm run person                                          # vypíše všetkých
 *     npm run person -- --email jan.letko@futbalsfz.sk        # jednu
 *     npm run person -- --email … --rola hr
 *     npm run person -- --email … --rola hr --odobrat
 *     npm run person -- --email … --skupiny "rozhodcovia, delegati"
 *
 * **Osobu nezakladá.** Na to je import (`npm run persons:import`), ktorý má
 * náhľad — nahratie človeka naslepo je operácia, po ktorej sa hľadá, ako to
 * vrátiť späť. Tento skript len mení, čo osoba má.
 *
 * Rola `platform-admin` sa sem zámerne nedá nastaviť: patrí tenantovi
 * dodávateľa a má vlastný skript (`npm run admin`), ktorý o tom vie.
 */

import { MongoClient } from "mongodb"

const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? "contineo"
const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

/**
 * Roly, ktoré patria tenantovi. Zhodné s `PRIDELITELNE_ROLE` v `lib/people.ts`.
 * `platform-admin` medzi nimi nie je zámerne — patrí tenantovi dodávateľa
 * a má vlastný skript (`npm run admin`), ktorý o tom vie.
 */
const KNOWN_ROLES = ["hr", "people-admin"]

function arg(name) {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1] ?? null
}
const EMAIL = arg("--email")?.trim().toLowerCase() ?? null
const ROLE = arg("--rola")
const GROUPS = arg("--skupiny")
const REMOVE = process.argv.includes("--odobrat")

if (!URI) {
  console.error(`${FAIL} Chýba MONGODB_URI (app/.env.local alebo export).`)
  process.exit(1)
}
if (ROLE && !KNOWN_ROLES.includes(ROLE)) {
  console.error(`${FAIL} Neznáma rola „${ROLE}". Známe: ${KNOWN_ROLES.join(", ")}.`)
  console.error(`     Správcu platformy nastavuje: npm run admin`)
  process.exit(1)
}

const keysFromList = s =>
  [...new Set(s.split(/[,;|]/).map(x => x.trim().toLowerCase()).filter(Boolean))]

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })
try {
  await client.connect()
  const col = client.db(DB).collection("persons")

  if (!EMAIL) {
    const all = await col
      .find({}, { projection: { email: 1, companyCode: 1, fullName: 1, roles: 1, groups: 1 } })
      .sort({ companyCode: 1, email: 1 })
      .toArray()
    for (const o of all) {
      console.log(`${o.email} | ${o.companyCode} | ${o.fullName}`)
      console.log(`   role=[${(o.roles ?? []).join(", ")}] skupiny=[${(o.groups ?? []).join(", ")}]`)
    }
    console.log(`\n${INFO} ${all.length} osôb`)
    process.exit(0)
  }

  const person = await col.findOne({ email: EMAIL })
  if (!person) {
    console.error(`${FAIL} ${EMAIL} v persons nie je. Založ ju importom: npm run persons:import`)
    process.exit(1)
  }

  const changes = {}
  if (ROLE) {
    const role = new Set(person.roles ?? [])
    REMOVE ? role.delete(ROLE) : role.add(ROLE)
    changes.roles = [...role]
  }
  if (GROUPS !== null) {
    const groups = keysFromList(GROUPS)
    changes.groups = groups
    // História členstva (D50) — rovnaké pravidlo ako v `persons.ts`, len bez
    // importu: tento skript beží bez TypeScriptového háku. Nezmenené členstvo
    // sa nedotkne, odchod uzavrie úsek, príchod otvorí nový.
    const now = new Date()
    const added = new Set(groups)
    const history = (person.groupHistory ?? []).map(z => ({ ...z }))
    for (const z of history) if (!z.do && !added.has(z.group)) z.do = now
    const open = new Set(history.filter(z => !z.do).map(z => z.group))
    for (const g of added) if (!open.has(g)) history.push({ group: g, od: now })
    changes.groupHistory = history
  }

  if (Object.keys(changes).length === 0) {
    console.log(`${EMAIL} | ${person.companyCode} | ${person.fullName}`)
    console.log(`   role=[${(person.roles ?? []).join(", ")}] skupiny=[${(person.groups ?? []).join(", ")}]`)
    process.exit(0)
  }

  await col.updateOne({ email: EMAIL }, { $set: changes })
  const po = await col.findOne({ email: EMAIL })
  console.log(`${OK} ${EMAIL} | ${po.companyCode}`)
  console.log(`   role=[${(po.roles ?? []).join(", ")}] skupiny=[${(po.groups ?? []).join(", ")}]`)
} catch (e) {
  console.error(`${FAIL} ${e.message ?? e}`)
  process.exitCode = 1
} finally {
  await client.close()
}
