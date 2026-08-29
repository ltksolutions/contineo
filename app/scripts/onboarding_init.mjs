/**
 * onboarding_init.mjs — kolekcie a indexy Fázy 8 (onboarding, ADR-003).
 *
 *     node scripts/onboarding_init.mjs           vytvorí, čo chýba
 *     node scripts/onboarding_init.mjs --stav    len vypíše, čo existuje
 *
 * Oddelené od `atlas_init.mjs` zámerne: ten rieši **search** indexy nad
 * `document_chunks` a beží proti Atlasu. Tieto sú obyčajné indexy a musia
 * fungovať aj proti MongoDB Community (on-prem režim), kde search indexy
 * nemusia existovať vôbec.
 *
 * Definícia indexu patrí do repozitára, nie do klikačky — inak ju nikto
 * nezopakuje. Schéma a zdôvodnenie: `docs/ONBOARDING_KONCEPCIA.md` kap. 3.
 */

import { MongoClient } from "mongodb"

const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? "contineo"

const OK = "\x1b[32m✔\x1b[0m", CHYBA = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const lenStav = process.argv.includes("--stav")

if (!URI) {
  console.error(`${CHYBA} Chýba MONGODB_URI. Nastav ju v app/.env.local alebo:`)
  console.error(`     export MONGODB_URI="mongodb+srv://..."`)
  process.exit(1)
}

/**
 * Indexy per kolekcia. `partialFilterExpression` pri potvrdeniach je to
 * podstatné miesto: unikátnosť platí len pre samotné potvrdenia, nie pre
 * odvolania a opravy — tie sú nové záznamy, ktoré ukazujú na starý (D24).
 */
const PLAN = [
  {
    kolekcia: "persons",
    indexy: [
      { kluc: { companyCode: 1, email: 1 }, opts: { unique: true, name: "tenant_email_unique" },
        preco: "jedna osoba = jedna adresa v rámci tenanta" },
      { kluc: { email: 1 }, opts: { name: "email" },
        preco: "prihlásenie hľadá podľa adresy bez znalosti tenanta" },
      { kluc: { companyCode: 1, tracks: 1, status: 1 }, opts: { name: "tenant_trasa_stav" },
        preco: "kto z tejto trasy ešte nemá hotovo" },
    ],
  },
  {
    kolekcia: "acknowledgements",
    indexy: [
      { kluc: { companyCode: 1, personId: 1, versionId: 1 },
        opts: { unique: true, name: "potvrdenie_unique",
                partialFilterExpression: { type: "acknowledgement" } },
        preco: "dvojité potvrdenie tej istej verzie nie je chyba používateľa, ale naša" },
      { kluc: { companyCode: 1, documentId: 1, versionId: 1, acknowledgedAt: -1 },
        opts: { name: "podla_dokumentu" },
        preco: "dashboard „kto potvrdil túto smernicu“" },
      { kluc: { companyCode: 1, personId: 1, acknowledgedAt: -1 },
        opts: { name: "podla_osoby" },
        preco: "história jednej osoby" },
    ],
  },
  {
    kolekcia: "tenants",
    indexy: [
      { kluc: { companyCode: 1 }, opts: { unique: true, name: "tenant_unique" },
        preco: "jeden zaznam na tenanta" },
      { kluc: { hostnames: 1 }, opts: { unique: true, name: "hostname_unique" },
        preco: "domena patri najviac jednemu tenantovi \u2014 databaza to drzi aj vtedy, ked to skript prehliadne" },
    ],
  },
  {
    kolekcia: "onboarding_tracks",
    indexy: [
      { kluc: { companyCode: 1, key: 1 }, opts: { unique: true, name: "tenant_kluc_unique" },
        preco: "kľúč trasy je jedinečný v rámci tenanta" },
    ],
  },
  {
    kolekcia: "assignments",
    indexy: [
      { kluc: { companyCode: 1, "subject.versionId": 1 }, opts: { name: "podla_znenia" },
        preco: "prehľad „kto má potvrdiť toto znenie“" },
      { kluc: { companyCode: 1, revokedAt: 1, "audience.kind": 1, "audience.value": 1 },
        opts: { name: "podla_publika" },
        preco: "widget sa pri každom otvorení úvodnej strany pýta, čo je pridelené mne" },
      { kluc: { companyCode: 1, assignedAt: -1 }, opts: { name: "podla_casu" },
        preco: "HR prehľad, najnovšie hore" },
    ],
  },
]

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const info = await client.db().admin().command({ buildInfo: 1 })
  console.log(`${OK} pripojené · MongoDB ${info.version} · databáza ${DB}\n`)
  const db = client.db(DB)
  const existujuce = (await db.listCollections().toArray()).map(c => c.name)

  for (const { kolekcia, indexy } of PLAN) {
    if (existujuce.includes(kolekcia)) {
      console.log(`${INFO} kolekcia ${kolekcia} už existuje`)
    } else if (lenStav) {
      console.log(`${INFO} kolekcia ${kolekcia} CHÝBA`)
      continue
    } else {
      await db.createCollection(kolekcia)
      console.log(`${OK} vytvorená kolekcia ${kolekcia}`)
    }

    const col = db.collection(kolekcia)
    const uz = await col.indexes()
    for (const { kluc, opts, preco } of indexy) {
      const mena = uz.map(i => i.name)
      if (mena.includes(opts.name)) {
        console.log(`   ${INFO} index ${opts.name} už existuje`)
        continue
      }
      if (lenStav) {
        console.log(`   ${INFO} index ${opts.name} CHÝBA — ${preco}`)
        continue
      }
      await col.createIndex(kluc, opts)
      console.log(`   ${OK} index ${opts.name} — ${preco}`)
    }
    console.log("")
  }

  if (lenStav) console.log(`${INFO} len výpis stavu, nič sa nezmenilo`)
  else console.log(`${OK} hotovo`)
} catch (e) {
  console.error(`${CHYBA} ${e.message ?? e}`)
  process.exitCode = 1
} finally {
  await client.close()
}
