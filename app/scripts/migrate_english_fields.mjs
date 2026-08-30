/**
 * migrate_english_fields.mjs — slovenské názvy polí a hodnôt v Atlase
 * na anglické (jednorazovo).
 *
 *     node scripts/migrate_english_fields.mjs            # nasucho, nič nezapíše
 *     node scripts/migrate_english_fields.mjs --zapis    # zapíše
 *
 * Prečo naraz a nie postupne: názov poľa je zmluva medzi kódom a databázou.
 * Kým sa nezhodujú, aplikácia číta prázdno — nie chybu, ale ticho prázdno,
 * čo je horšie. Preto sa migrácia púšťa tesne pred nasadením kódu, ktorý
 * nové názvy očakáva, a nie skôr.
 *
 * Záloha ide do `data/backup/<čas>/` ako JSON, jeden súbor na kolekciu.
 * Bez nej sa nezapisuje — pri 150 dokumentoch nie je dôvod riskovať.
 *
 * Skript prepisuje celé dokumenty (`replaceOne`), nie `$rename`: polia
 * v poliach (`departmentHistory[].od`) sa cez `$rename` prepísať nedajú
 * a dve rôzne techniky v jednej migrácii sú horšie než jedna pomalšia.
 */
import { MongoClient } from "mongodb"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const OK = "\x1b[32m✓\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[2m·\x1b[0m"
const WRITE = process.argv.includes("--zapis")

const URI = process.env.MONGODB_URI
if (!URI) { console.error(`${FAIL} Chýba MONGODB_URI.`); process.exit(1) }

/** Ploché premenovania na najvyššej úrovni dokumentu. */
const TOP = {
  audit: {
    predmet: "subject", akcia: "action", aktor: "actor", kedy: "at",
    cielId: "targetId", cielPopis: "targetLabel", poznamka: "note", zmeny: "changes",
  },
  departments: { nazov: "name", poradie: "order" },
  cms_folders: { nazov: "name", poradie: "order" },
  documents: { konverzia: "conversion" },
  eval_questions: {
    povodneZnenie: "originalText", upraveneZnenie: "editedText", vyradena: "excluded",
    dovodVyradenia: "exclusionReason", vytvorene: "createdAt",
  },
  evaluations: {
    otazka: "question", otazkaId: "questionId", odpoved: "answer", spravna: "correct",
    halucinacia: "hallucination", hodnotitel: "reviewer", citacie: "citations",
    overeneCitacie: "verifiedCitations", zdroje: "sources", poznamka: "note",
    upravene: "updatedAt", vytvorene: "createdAt", celkovoMs: "totalMs",
    tokeny: "tokens", naklad: "cost", casy: "timings",
    overenaOdpoved: "verifiedAnswer", spravneZdroje: "correctSources",
  },
  tenants: { ciselniky: "codelists", chunkovanie: "chunking" },
}

/** Premenovania vnútri vnorených objektov, po prepise na najvyššej úrovni. */
const NESTED = {
  documents: {
    conversion: { kedy: "at", sposob: "method", upozornenia: "warnings" },
    originalFile: {
      nazov: "name", typ: "type", bajtov: "bytes",
      nahralKto: "uploadedBy", nahraneKedy: "uploadedAt",
    },
  },
  evaluations: {
    tokens: { vstup: "input", vystup: "output", cacheZapis: "cacheWrite", cacheCitanie: "cacheRead" },
    cost: { verziaCennika: "pricelistVersion", cennikExpirovany: "pricelistExpired", neznamyModel: "unknownModel" },
    timings: { klasifikacia: "classification", "vyhladavanie a rerank": "searchAndRerank" },
  },
  "cms_files.files": {
    metadata: { aktor: "actor", nahraneKedy: "uploadedAt" },
  },
  tenants: {
    chunking: { slovoClanok: "articleWord", slovoPriloha: "annexWord", opakovaniHlavicky: "headerRepeats", cielMinTokenov: "targetMinTokens", cielMaxTokenov: "targetMaxTokens" },
  },
}

/** Premenovania v prvkoch poľa. */
const IN_ARRAYS = {
  persons: {
    departmentHistory: { od: "from", do: "to" },
    groupHistory: { od: "from", do: "to" },
    emailHistory: { doKedy: "until", zmenil: "changedBy" },
  },
}

/** Hodnoty, ktoré sú tiež identifikátormi. */
const VALUES = {
  audit: {
    subject: {
      osoba: "person", oddelenie: "department", utvar: "department", dokument: "document",
      priecinok: "folder", pridelenie: "assignment", organizacia: "organisation",
      domena: "domain", "prihlasenie-nastavenie": "signin-settings",
    },
    action: {
      zalozene: "created", zmenene: "changed", vyradene: "excluded", vratene: "restored",
      premenovane: "renamed", presunute: "moved", zrusene: "deleted", pridelene: "assigned",
      odvolane: "revoked", oznamene: "notified", poziadane: "requested", overene: "verified",
      publikovane: "published", preindexovane: "reindexed", preusporiadane: "reordered",
      "navrh-modelu": "model-draft", "oprava-znenia": "version-fix",
      "nahrate-nove-znenie": "new-version",
    },
  },
  documents: {
    processingStatus: { nahrate: "uploaded", prevedene: "converted", zaindexovane: "indexed", zlyhalo: "failed" },
  },
}

/** Staré indexy auditu — kľúčujú podľa polí, ktoré po migrácii neexistujú. */
const OLD_INDEXES = { audit: ["podla_casu", "podla_predmetu", "podla_ciela"] }
const NEW_INDEXES = {
  audit: [
    { key: { companyCode: 1, at: -1 }, name: "by_time" },
    { key: { companyCode: 1, subject: 1, at: -1 }, name: "by_subject" },
    { key: { companyCode: 1, targetId: 1, at: -1 }, name: "by_target" },
  ],
}

function renameKeys(obj, map) {
  if (!obj || typeof obj !== "object") return { value: obj, changed: 0 }
  let changed = 0
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (map[k] !== undefined) { out[map[k]] = v; changed++ }
    else out[k] = v
  }
  return { value: out, changed }
}

/** Vnútro `audit.changes`: každé pole má `{ z, na }`. */
function renameChanges(changes) {
  if (!changes || typeof changes !== "object") return { value: changes, changed: 0 }
  let changed = 0
  const out = {}
  for (const [field, delta] of Object.entries(changes)) {
    const r = renameKeys(delta, { z: "from", na: "to" })
    changed += r.changed
    out[field] = r.value
  }
  return { value: out, changed }
}

const client = new MongoClient(URI)
await client.connect()
const db = client.db(process.env.MONGODB_DB || "contineo")

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
const backupDir = join(process.cwd(), "data", "backup", stamp)

const collections = [...new Set([
  ...Object.keys(TOP), ...Object.keys(NESTED), ...Object.keys(IN_ARRAYS), ...Object.keys(VALUES),
])].sort()

let touchedTotal = 0
const report = []

for (const name of collections) {
  const col = db.collection(name)
  const docs = await col.find({}).toArray()
  if (docs.length === 0) { report.push([name, 0, 0, "prázdna"]); continue }

  if (WRITE) {
    mkdirSync(backupDir, { recursive: true })
    writeFileSync(join(backupDir, `${name}.json`), JSON.stringify(docs, null, 1))
  }

  let touched = 0, fields = 0
  for (const doc of docs) {
    let d = doc, n = 0

    if (TOP[name]) { const r = renameKeys(d, TOP[name]); d = r.value; n += r.changed }
    if (name === "audit" && d.changes) { const r = renameChanges(d.changes); d.changes = r.value; n += r.changed }

    for (const [parent, map] of Object.entries(NESTED[name] ?? {})) {
      if (d[parent] && typeof d[parent] === "object" && !Array.isArray(d[parent])) {
        const r = renameKeys(d[parent], map); d[parent] = r.value; n += r.changed
      }
    }

    for (const [field, map] of Object.entries(IN_ARRAYS[name] ?? {})) {
      if (Array.isArray(d[field])) {
        d[field] = d[field].map(item => { const r = renameKeys(item, map); n += r.changed; return r.value })
      }
    }

    for (const [field, map] of Object.entries(VALUES[name] ?? {})) {
      const now = d[field]
      if (typeof now === "string" && map[now] !== undefined && map[now] !== now) { d[field] = map[now]; n++ }
    }

    if (n > 0) {
      touched++; fields += n
      if (WRITE) await col.replaceOne({ _id: doc._id }, d)
    }
  }
  touchedTotal += touched
  fields += 0
  report.push([name, docs.length, touched, `${fields} polí`])
}

console.log(`\n${WRITE ? "ZÁPIS" : "NASUCHO"} — databáza ${db.databaseName}\n`)
for (const [name, total, touched, note] of report) {
  const mark = touched > 0 ? OK : INFO
  console.log(`  ${mark} ${name.padEnd(18)} ${String(touched).padStart(4)} / ${String(total).padEnd(5)} ${note}`)
}

if (WRITE) {
  for (const [name, names] of Object.entries(OLD_INDEXES)) {
    for (const idx of names) {
      try { await db.collection(name).dropIndex(idx); console.log(`  ${OK} index zrušený: ${name}.${idx}`) }
      catch { console.log(`  ${INFO} index ${name}.${idx} tam nebol`) }
    }
  }
  for (const [name, defs] of Object.entries(NEW_INDEXES)) {
    for (const d of defs) {
      await db.collection(name).createIndex(d.key, { name: d.name })
      console.log(`  ${OK} index vytvorený: ${name}.${d.name}`)
    }
  }
  console.log(`\n${OK} hotovo — zmenených dokumentov: ${touchedTotal}`)
  console.log(`${INFO} záloha: data/backup/${stamp}/`)
} else {
  console.log(`\n${INFO} nasucho — zmenilo by sa ${touchedTotal} dokumentov`)
  console.log(`${INFO} spusti s \`--zapis\`, keď to sedí`)
}

await client.close()
