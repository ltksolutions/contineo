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
    collection: "persons",
    indexes: [
      { key: { companyCode: 1, email: 1 }, opts: { unique: true, name: "tenant_email_unique" },
        why: "jedna osoba = jedna adresa v rámci tenanta" },
      { key: { email: 1 }, opts: { name: "email" },
        why: "prihlásenie hľadá podľa adresy bez znalosti tenanta" },
      { key: { companyCode: 1, tracks: 1, status: 1 }, opts: { name: "tenant_track_status" },
        why: "kto z tejto trasy ešte nemá hotovo" },
      { key: { companyCode: 1, departmentPath: 1, status: 1 }, opts: { name: "tenant_department_status" },
        why: "kto patrí do oddelenia vrátane podriadených (D49)" },
      { key: { companyCode: 1, "departmentHistory.departmentPath": 1 },
        opts: { name: "tenant_department_history" },
        why: "kto v oddelení kedysi bol a odišiel bez potvrdenia (D50)" },
      { key: { companyCode: 1, "groupHistory.group": 1 }, opts: { name: "tenant_group_history" },
        why: "kto v skupine kedysi bol a odišiel bez potvrdenia (D50)" },
    ],
  },
  {
    collection: "departments",
    indexes: [
      { key: { companyCode: 1, id: 1 }, opts: { unique: true, name: "tenant_department_unique" },
        why: "identifikátor oddelenia je jedinečný v rámci tenanta" },
      { key: { companyCode: 1, parentId: 1 }, opts: { name: "by_parent" },
        why: "vykreslenie stromu ide po úrovniach" },
    ],
  },
  {
    collection: "cms_folders",
    indexes: [
      { key: { companyCode: 1, id: 1 }, opts: { unique: true, name: "tenant_folder_unique" },
        why: "identifikátor priečinka je jedinečný v rámci tenanta (D56)" },
      { key: { companyCode: 1, parentId: 1 }, opts: { name: "by_parent" },
        why: "vykreslenie stromu ide po úrovniach" },
    ],
  },
  {
    collection: "documents",
    indexes: [
      { key: { companyCode: 1, folderPath: 1 }, opts: { name: "tenant_folder" },
        why: "filter na priečinok vrátane podpriečinkov (D56)" },
      { key: { companyCode: 1, category: 1 }, opts: { name: "tenant_category" },
        why: "filter na druh dokumentu" },
      { key: { companyCode: 1, tags: 1 }, opts: { name: "tenant_tags" },
        why: "filter na značku" },
    ],
  },
  {
    collection: "audit",
    indexes: [
      { key: { companyCode: 1, at: -1 }, opts: { name: "by_time" },
        why: "výpis auditu, najnovšie hore (D51)" },
      { key: { companyCode: 1, subject: 1, at: -1 }, opts: { name: "by_subject" },
        why: "filter na osoby, oddelenia, pridelenia" },
      { key: { companyCode: 1, targetId: 1, at: -1 }, opts: { name: "by_target" },
        why: "história jednej osoby alebo jedného oddelenia" },
    ],
  },
  {
    collection: "acknowledgements",
    indexes: [
      { key: { companyCode: 1, personId: 1, versionId: 1 },
        opts: { unique: true, name: "acknowledgement_unique",
                partialFilterExpression: { type: "acknowledgement" } },
        why: "dvojité potvrdenie tej istej verzie nie je chyba používateľa, ale naša" },
      { key: { companyCode: 1, documentId: 1, versionId: 1, acknowledgedAt: -1 },
        opts: { name: "by_document" },
        why: "dashboard „kto potvrdil túto smernicu“" },
      { key: { companyCode: 1, personId: 1, acknowledgedAt: -1 },
        opts: { name: "by_person" },
        why: "história jednej osoby" },
    ],
  },
  {
    collection: "tenants",
    indexes: [
      { key: { companyCode: 1 }, opts: { unique: true, name: "tenant_unique" },
        why: "jeden zaznam na tenanta" },
      { key: { hostnames: 1 }, opts: { unique: true, name: "hostname_unique" },
        why: "domena patri najviac jednemu tenantovi \u2014 databaza to drzi aj vtedy, ked to skript prehliadne" },
    ],
  },
  {
    collection: "reading_times",
    indexes: [
      { key: { personId: 1, versionId: 1 }, opts: { unique: true, name: "reading_person_version_unique" },
        why: "jeden zaznam na osobu a znenie \u2014 uklada sa maximum, nie kazde meranie" },
      { key: { companyCode: 1, documentId: 1 }, opts: { name: "reading_by_document" },
        why: "prehlad casov nad jednym dokumentom" },
      // TTL: rok (rozhodnutie 2026-09-06). Cas citania nie je dokaz a na rozdiel
      // od potvrdenia prezit nemusi. TTL maze cele dokumenty, nie polia \u2014 preto
      // je to samostatna kolekcia a nie pole v `acknowledgements`.
      { key: { updatedAt: 1 }, opts: { name: "reading_ttl", expireAfterSeconds: 365 * 24 * 60 * 60 },
        why: "retencia 1 rok" },
    ],
  },
  {
    collection: "onboarding_tracks",
    indexes: [
      { key: { companyCode: 1, key: 1 }, opts: { unique: true, name: "tenant_key_unique" },
        why: "kľúč trasy je jedinečný v rámci tenanta" },
    ],
  },
  {
    collection: "assignments",
    indexes: [
      { key: { companyCode: 1, "subject.versionId": 1 }, opts: { name: "by_version" },
        why: "prehľad „kto má potvrdiť toto znenie“" },
      { key: { companyCode: 1, revokedAt: 1, "audience.kind": 1, "audience.value": 1 },
        opts: { name: "by_audience" },
        why: "widget sa pri každom otvorení úvodnej strany pýta, čo je pridelené mne" },
      { key: { companyCode: 1, assignedAt: -1 }, opts: { name: "by_time" },
        why: "HR prehľad, najnovšie hore" },
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

  for (const { collection, indexes } of PLAN) {
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
    const existingIndexes = await col.indexes()
    for (const { key, opts, why } of indexes) {
      const names = existingIndexes.map(i => i.name)
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
