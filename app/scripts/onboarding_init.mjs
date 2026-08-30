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

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const statusOnly = process.argv.includes("--stav")

if (!URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Nastav ju v app/.env.local alebo:`)
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
      { kluc: { companyCode: 1, departmentPath: 1, status: 1 }, opts: { name: "tenant_utvar_stav" },
        preco: "kto patrí do oddelenia vrátane podriadených (D49)" },
      { kluc: { companyCode: 1, "departmentHistory.departmentPath": 1 },
        opts: { name: "tenant_utvar_historia" },
        preco: "kto v oddelení kedysi bol a odišiel bez potvrdenia (D50)" },
      { kluc: { companyCode: 1, "groupHistory.group": 1 }, opts: { name: "tenant_skupina_historia" },
        preco: "kto v skupine kedysi bol a odišiel bez potvrdenia (D50)" },
    ],
  },
  {
    kolekcia: "departments",
    indexy: [
      { kluc: { companyCode: 1, id: 1 }, opts: { unique: true, name: "tenant_utvar_unique" },
        preco: "identifikátor oddelenia je jedinečný v rámci tenanta" },
      { kluc: { companyCode: 1, parentId: 1 }, opts: { name: "podla_nadriadeneho" },
        preco: "vykreslenie stromu ide po úrovniach" },
    ],
  },
  {
    kolekcia: "cms_folders",
    indexy: [
      { kluc: { companyCode: 1, id: 1 }, opts: { unique: true, name: "tenant_priecinok_unique" },
        preco: "identifikátor priečinka je jedinečný v rámci tenanta (D56)" },
      { kluc: { companyCode: 1, parentId: 1 }, opts: { name: "podla_nadriadeneho" },
        preco: "vykreslenie stromu ide po úrovniach" },
    ],
  },
  {
    kolekcia: "documents",
    indexy: [
      { kluc: { companyCode: 1, folderPath: 1 }, opts: { name: "tenant_priecinok" },
        preco: "filter na priečinok vrátane podpriečinkov (D56)" },
      { kluc: { companyCode: 1, category: 1 }, opts: { name: "tenant_druh" },
        preco: "filter na druh dokumentu" },
      { kluc: { companyCode: 1, tags: 1 }, opts: { name: "tenant_znacky" },
        preco: "filter na značku" },
    ],
  },
  {
    kolekcia: "audit",
    indexy: [
      { kluc: { companyCode: 1, kedy: -1 }, opts: { name: "podla_casu" },
        preco: "výpis auditu, najnovšie hore (D51)" },
      { kluc: { companyCode: 1, predmet: 1, kedy: -1 }, opts: { name: "podla_predmetu" },
        preco: "filter na osoby, oddelenia, pridelenia" },
      { kluc: { companyCode: 1, cielId: 1, kedy: -1 }, opts: { name: "podla_ciela" },
        preco: "história jednej osoby alebo jedného oddelenia" },
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
  const existing = (await db.listCollections().toArray()).map(c => c.name)

  for (const { kolekcia: collection, indexy: indexes } of PLAN) {
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
    const uz = await col.indexes()
    for (const { kluc: key, opts, preco: why } of indexes) {
      const names = uz.map(i => i.name)
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
