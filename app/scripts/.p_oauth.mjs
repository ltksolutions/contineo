/** Read-only kontrola nastavenia prihlasovania. Tajomstvo nevypisuje. */
import { MongoClient } from "mongodb"
import { rozsifruj } from "../src/lib/tajomstva.ts"

const c = new MongoClient(process.env.MONGODB_URI)
await c.connect()
const t = await c.db(process.env.MONGODB_DB ?? "contineo").collection("tenants")
  .find({}).sort({ companyCode: 1 }).toArray()

for (const x of t) {
  console.log(`\n### ${x.companyCode} — ${x.hostnames.join(", ")}`)
  for (const p of ["microsoft", "google"]) {
    const o = x.oauth?.[p]
    if (!o) { console.log(`   ${p}: nenastavené`); continue }
    let stav = "?"
    try { stav = rozsifruj(o.clientSecretEnc) ? "čitateľné" : "prázdne" }
    catch (e) { stav = "NEČITATEĽNÉ — " + e.message }
    console.log(`   ${p}: clientId=${o.clientId}`)
    console.log(`      tajomstvo: ${stav}`)
    if (p === "microsoft") {
      console.log(`      tenantMode: ${o.tenantMode ?? "(prázdne → organizations)"}`)
      console.log(`      allowedTenantIds: [${(o.allowedTenantIds ?? []).join(", ")}]`)
    }
  }
}
await c.close()
