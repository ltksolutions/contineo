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
const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const ROLE = "platform-admin"
/** Tenant dodávateľa. Správca zákazníka touto rolou nikdy nie je. */
const TENANT = process.env.PLATFORM_TENANT ?? "LTK"

if (!URI) {
  console.error(`${FAIL} Chýba MONGODB_URI (app/.env.local alebo export).`)
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
      console.error(`${FAIL} Prepínač ${a} potrebuje hodnotu`)
      process.exit(1)
    }
    i++
    if (a === "--email") out.email = v.trim().toLowerCase()
    else if (a === "--meno") out.meno = v
    else { console.error(`${FAIL} Neznámy prepínač ${a}`); process.exit(1) }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const col = client.db(DB).collection("persons")

  if (!args.email) {
    const holders = await col.find({ roles: ROLE }).toArray()
    if (!holders.length) {
      console.log(`${INFO} rolu ${ROLE} nemá nikto — správa tenantov je zavretá`)
    }
    for (const p of holders) {
      const when = p.lastLoginAt ? new Date(p.lastLoginAt).toISOString().slice(0, 16).replace("T", " ") : "—"
      console.log(`${OK} ${p.email} · ${p.companyCode} · stav=${p.status} · posl. prihlásenie=${when}`)
    }
    process.exit(0)
  }

  const existing = await col.findOne({ email: args.email })

  if (args.odobrat) {
    if (!existing) {
      console.error(`${FAIL} ${args.email} v persons nie je`)
      process.exit(1)
    }
    // Odoberá sa **rola**, nie osoba. Zmazať človeka, ktorý niečo potvrdil,
    // by znamenalo osirotené auditné záznamy (D24).
    await col.updateOne({ email: args.email }, { $pull: { roles: ROLE } })
    console.log(`${OK} ${args.email} — rola ${ROLE} odobraná (osoba zostáva)`)
    process.exit(0)
  }

  if (existing) {
    if (existing.companyCode !== TENANT) {
      console.error(`${FAIL} ${args.email} patrí organizácii ${existing.companyCode}, nie ${TENANT}.`)
      console.error(`     Rolu ${ROLE} dostáva len človek dodávateľa — inak by správca`)
      console.error(`     zákazníka videl prehľad ostatných organizácií (D41).`)
      process.exit(1)
    }
    await col.updateOne({ email: args.email }, { $addToSet: { roles: ROLE } })
    console.log(`${OK} ${args.email} — rola ${ROLE} pridaná k existujúcej osobe`)
    process.exit(0)
  }

  if (!args.meno) {
    console.error(`${FAIL} nová osoba potrebuje --meno`)
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
    roles: [ROLE],
    invitedAt: now,
    externalRef: { sportnetId: null, entraObjectId: null },
    createdBy: "admin_set.mjs",
    createdAt: now,
  })
  console.log(`${OK} ${args.email} založený v ${TENANT} s rolou ${ROLE}`)
  console.log(`   Prihlásiť sa dá na doméne tenanta ${TENANT} (app.contineo.app).`)
} catch (e) {
  console.error(`${FAIL} ${e.message}`)
  process.exit(1)
} finally {
  await client.close()
}
