/**
 * admin_set.mjs — priradí alebo odoberie rolu `platform-admin` (D41).
 *
 *     npm run admin                                        # kto ju má
 *     npm run admin -- --email office@ltk.solutions --meno "Ján Letko"
 *     npm run admin -- --email office@ltk.solutions --odobrat
 *
 * Rola je **výslovná výnimka z D32**: jej držiteľ vidí prehľad všetkých
 * organizácií — počty, domény, stav — ale **nie ich obsah**. Na dokumenty
 * a potvrdenia cudzej organizácie nevidí a vidieť nemá.
 *
 * Prečo záznam v `persons` a nie premenná so zoznamom: ide overenou cestou
 * prihlásenia (I1c) vrátane evidencie a odhlásenia, a odobratie práv je zmena
 * jedného záznamu, nie premennej a nasadenia. Presne taká premenná
 * (`POVOLENE_EMAILY`) navyše skrývala, že sa cesta cez `persons` nikdy
 * netestovala.
 *
 * Správca patrí pod tenanta dodávateľa (`LTK`), nie pod zákazníka — obrazovka
 * beží len na jeho doméne (D42).
 */

import crypto from "node:crypto"
import { MongoClient } from "mongodb"

const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? "contineo"
const OK = "\x1b[32m✔\x1b[0m", CHYBA = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const ROLA = "platform-admin"
/** Tenant dodávateľa. Správca zákazníka touto rolou nikdy nie je. */
const TENANT = process.env.PLATFORM_TENANT ?? "LTK"

if (!URI) {
  console.error(`${CHYBA} Chýba MONGODB_URI (app/.env.local alebo export).`)
  process.exit(1)
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--odobrat") { out.odobrat = true; continue }
    if (!a.startsWith("--")) continue
    const v = argv[i + 1]
    if (v === undefined || v.startsWith("--")) {
      console.error(`${CHYBA} Prepínač ${a} potrebuje hodnotu`)
      process.exit(1)
    }
    i++
    if (a === "--email") out.email = v.trim().toLowerCase()
    else if (a === "--meno") out.meno = v
    else { console.error(`${CHYBA} Neznámy prepínač ${a}`); process.exit(1) }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const col = client.db(DB).collection("persons")

  if (!args.email) {
    const drzitelia = await col.find({ roles: ROLA }).toArray()
    if (!drzitelia.length) {
      console.log(`${INFO} rolu ${ROLA} nemá nikto — správa tenantov je zavretá`)
    }
    for (const p of drzitelia) {
      const kedy = p.lastLoginAt ? new Date(p.lastLoginAt).toISOString().slice(0, 16).replace("T", " ") : "—"
      console.log(`${OK} ${p.email} · ${p.companyCode} · stav=${p.status} · posl. prihlásenie=${kedy}`)
    }
    process.exit(0)
  }

  const existuje = await col.findOne({ email: args.email })

  if (args.odobrat) {
    if (!existuje) {
      console.error(`${CHYBA} ${args.email} v persons nie je`)
      process.exit(1)
    }
    // Odoberá sa **rola**, nie osoba. Zmazať človeka, ktorý niečo potvrdil,
    // by znamenalo osirotené auditné záznamy (D24).
    await col.updateOne({ email: args.email }, { $pull: { roles: ROLA } })
    console.log(`${OK} ${args.email} — rola ${ROLA} odobraná (osoba zostáva)`)
    process.exit(0)
  }

  if (existuje) {
    if (existuje.companyCode !== TENANT) {
      console.error(`${CHYBA} ${args.email} patrí organizácii ${existuje.companyCode}, nie ${TENANT}.`)
      console.error(`     Rolu ${ROLA} dostáva len človek dodávateľa — inak by správca`)
      console.error(`     zákazníka videl prehľad ostatných organizácií (D41).`)
      process.exit(1)
    }
    await col.updateOne({ email: args.email }, { $addToSet: { roles: ROLA } })
    console.log(`${OK} ${args.email} — rola ${ROLA} pridaná k existujúcej osobe`)
    process.exit(0)
  }

  if (!args.meno) {
    console.error(`${CHYBA} nová osoba potrebuje --meno`)
    process.exit(1)
  }

  const now = new Date()
  await col.insertOne({
    id: crypto.randomUUID(),
    companyCode: TENANT,
    email: args.email,
    fullName: args.meno,
    personType: "employee",
    // `invited` je správny počiatočný stav: na `active` sa prepne až prvým
    // prihlásením, rovnako ako u ostatných (`recordSignIn`).
    status: "invited",
    language: "sk",
    tracks: [],
    roles: [ROLA],
    invitedAt: now,
    externalRef: { sportnetId: null, entraObjectId: null },
    createdBy: "admin_set.mjs",
    createdAt: now,
  })
  console.log(`${OK} ${args.email} založený v ${TENANT} s rolou ${ROLA}`)
  console.log(`   Prihlásiť sa dá na doméne tenanta ${TENANT} (app.contineo.app).`)
} catch (e) {
  console.error(`${CHYBA} ${e.message}`)
  process.exit(1)
} finally {
  await client.close()
}
