/**
 * osoba.mjs — role a skupiny jednej osoby (D38, D33).
 *
 *     npm run osoba                                          # vypíše všetkých
 *     npm run osoba -- --email jan.letko@futbalsfz.sk        # jednu
 *     npm run osoba -- --email … --rola hr
 *     npm run osoba -- --email … --rola hr --odobrat
 *     npm run osoba -- --email … --skupiny "rozhodcovia, delegati"
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
const OK = "\x1b[32m✔\x1b[0m", CHYBA = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const ZNAME_ROLE = ["hr"]

function arg(meno) {
  const i = process.argv.indexOf(meno)
  return i === -1 ? null : process.argv[i + 1] ?? null
}
const EMAIL = arg("--email")?.trim().toLowerCase() ?? null
const ROLA = arg("--rola")
const SKUPINY = arg("--skupiny")
const ODOBRAT = process.argv.includes("--odobrat")

if (!URI) {
  console.error(`${CHYBA} Chýba MONGODB_URI (app/.env.local alebo export).`)
  process.exit(1)
}
if (ROLA && !ZNAME_ROLE.includes(ROLA)) {
  console.error(`${CHYBA} Neznáma rola „${ROLA}". Známe: ${ZNAME_ROLE.join(", ")}.`)
  console.error(`     Správcu platformy nastavuje: npm run admin`)
  process.exit(1)
}

const kluceZoZoznamu = s =>
  [...new Set(s.split(/[,;|]/).map(x => x.trim().toLowerCase()).filter(Boolean))]

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })
try {
  await client.connect()
  const col = client.db(DB).collection("persons")

  if (!EMAIL) {
    const vsetci = await col
      .find({}, { projection: { email: 1, companyCode: 1, fullName: 1, roles: 1, groups: 1 } })
      .sort({ companyCode: 1, email: 1 })
      .toArray()
    for (const o of vsetci) {
      console.log(`${o.email} | ${o.companyCode} | ${o.fullName}`)
      console.log(`   role=[${(o.roles ?? []).join(", ")}] skupiny=[${(o.groups ?? []).join(", ")}]`)
    }
    console.log(`\n${INFO} ${vsetci.length} osôb`)
    process.exit(0)
  }

  const osoba = await col.findOne({ email: EMAIL })
  if (!osoba) {
    console.error(`${CHYBA} ${EMAIL} v persons nie je. Založ ju importom: npm run persons:import`)
    process.exit(1)
  }

  const zmeny = {}
  if (ROLA) {
    const role = new Set(osoba.roles ?? [])
    ODOBRAT ? role.delete(ROLA) : role.add(ROLA)
    zmeny.roles = [...role]
  }
  if (SKUPINY !== null) zmeny.groups = kluceZoZoznamu(SKUPINY)

  if (Object.keys(zmeny).length === 0) {
    console.log(`${EMAIL} | ${osoba.companyCode} | ${osoba.fullName}`)
    console.log(`   role=[${(osoba.roles ?? []).join(", ")}] skupiny=[${(osoba.groups ?? []).join(", ")}]`)
    process.exit(0)
  }

  await col.updateOne({ email: EMAIL }, { $set: zmeny })
  const po = await col.findOne({ email: EMAIL })
  console.log(`${OK} ${EMAIL} | ${po.companyCode}`)
  console.log(`   role=[${(po.roles ?? []).join(", ")}] skupiny=[${(po.groups ?? []).join(", ")}]`)
} catch (e) {
  console.error(`${CHYBA} ${e.message ?? e}`)
  process.exitCode = 1
} finally {
  await client.close()
}
