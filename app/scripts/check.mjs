/**
 * check.mjs — invarianty medzi dokumentmi, úsekmi a potvrdeniami (D59).
 *
 * Odkedy sa dá chunker ladiť a preindexovávať, pribudlo miest, kde sa dáta
 * môžu rozísť potichu. Nič nespadne — len sa zhoršia odpovede alebo niekomu
 * naskočí povinnosť, ktorú nemá. Tento skript to hľadá menovite.
 *
 * **Nič neopravuje.** Oprava je vždy rozhodnutie: preindexovať, dopublikovať
 * alebo nechať tak. Skript, ktorý „to spraví za teba", by pri prvej
 * nečakanej odchýlke prepísal niečo, čo nikto nechcel.
 *
 *     node --env-file=.env.local scripts/check.mjs
 *     node --env-file=.env.local scripts/check.mjs --tenant SFZ
 *
 * Návratový kód 1, keď našiel rozpor — dá sa zavesiť za preindexovanie.
 */

import { MongoClient } from "mongodb"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

function arg(name) {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1] ?? null
}
const TENANT = arg("--tenant")

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI.`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const db = client.db(process.env.MONGODB_DB ?? "contineo")
const tenantFilter = TENANT ? { companyCode: TENANT } : {}

const documents = await db.collection("documents").find(tenantFilter).toArray()
const chunks = await db.collection("document_chunks").find(tenantFilter).toArray()
const acknowledgements = await db.collection("acknowledgements")
  .find({ ...tenantFilter, type: "acknowledgement" }).toArray()

const findings = []
const check = (condition, message, why) => { if (condition) findings.push({ sprava: message, preco: why }) }

console.log(
  `\nKontrola${TENANT ? ` · ${TENANT}` : ""}: ` +
  `${documents.length} dokumentov, ${chunks.length} úsekov, ${acknowledgements.length} potvrdení\n`,
)

// 1. Aktívny úsek musí ukazovať na existujúce znenie.
const versions = new Map()
for (const d of documents) {
  for (const v of d.versions ?? []) versions.set(`${d.documentId}|${v.versionId}`, v)
}
for (const ch of chunks.filter(c => c.isActive)) {
  check(
    !versions.has(`${ch.documentId}|${ch.versionId}`),
    `úsek ${ch.documentId} #${ch.chunkIndex} ukazuje na znenie ${ch.versionId}, ktoré v dokumente nie je`,
    "vyhľadávanie by vrátilo text, ktorý sa nedá spojiť so žiadnym platným znením",
  )
}

// 2. Jeden dokument = jedno aktívne členenie.
const byDocument = new Map()
for (const ch of chunks.filter(c => c.isActive)) {
  const z = byDocument.get(ch.documentId) ?? new Set()
  z.add(ch.chunkingId ?? "(bez chunkingId)")
  byDocument.set(ch.documentId, z)
}
for (const [doc, ids] of byDocument) {
  check(
    ids.size > 1,
    `dokument ${doc} má naraz ${ids.size} aktívnych členení`,
    "výsledky vyhľadávania by obsahovali ten istý text dvakrát, zakaždým inak narezaný",
  )
}

// 3. Potvrdené znenie musí mať text.
for (const p of acknowledgements) {
  const v = versions.get(`${p.documentId}|${p.versionId}`)
  check(
    !v,
    `potvrdenie ${p.email} → ${p.documentId} ukazuje na znenie ${p.versionId}, ktoré neexistuje`,
    "dôkaz o oboznámení bez textu, s ktorým sa človek oboznámil, je bezcenný",
  )
  check(
    Boolean(v) && !String(v.markdown ?? "").trim(),
    `znenie ${p.versionId} (${p.documentId}) je potvrdené, ale nemá uložený text`,
    "to isté: nedá sa ukázať, čo človek čítal",
  )
}

// 4. Publikované znenie musí mať aktívne úseky.
for (const d of documents) {
  const valid = (d.versions ?? []).filter(v => v.isActive && v.effectiveFrom)
  if (!valid.length) continue
  const hasChunks = chunks.some(c => c.documentId === d.documentId && c.isActive)
  check(
    !hasChunks,
    `${d.documentId} má platné znenie, ale ani jeden aktívny úsek`,
    "norma je publikovaná a vyhľadávanie o nej nevie — preindexuj ju",
  )
}

// 5. Model vektorov musí sedieť s nastavením.
const model = process.env.EMBEDDING_MODEL ?? "voyage-4"
const models = new Set(chunks.filter(c => c.isActive).map(c => c.embeddingModel ?? "(chýba)"))
for (const m of models) {
  check(
    m !== model,
    `aktívne úseky vyrobené modelom ${m}, v nastavení je ${model}`,
    "vektory nie sú prenositeľné medzi modelmi — nič nespadne, len sa ticho zhoršia výsledky",
  )
}

// 6. Znenie bez dátumu platnosti sa nedá potvrdiť (D6) — upozornenie, nie chyba.
let withoutValidity = 0
for (const d of documents) {
  for (const v of d.versions ?? []) if (v.isActive && !v.effectiveFrom) withoutValidity++
}

// 7. Cesta priečinka musí sedieť so zaradením.
const folders = await db.collection("cms_folders").find(tenantFilter).toArray()
const byId = new Map(folders.map(p => [p.id, p]))
for (const d of documents) {
  const path = []
  let current = d.folderId ? byId.get(d.folderId) : null
  let guard = 0
  while (current && guard++ < 8) {
    path.unshift(current.id)
    current = current.parentId ? byId.get(current.parentId) : null
  }
  const stored = d.folderPath ?? []
  check(
    path.length !== stored.length || path.some((x, i) => x !== stored[i]),
    `${d.documentId} má nesúhlasnú cestu priečinkov`,
    "filter na priečinok vrátane podpriečinkov by dokument nenašiel",
  )
}

if (withoutValidity > 0) {
  console.log(`${INFO} ${withoutValidity} aktívnych znení nemá dátum platnosti — nedajú sa potvrdiť (D6)\n`)
}

if (findings.length === 0) {
  console.log(`${OK} bez rozporov\n`)
  await client.close()
  process.exit(0)
}

console.log(`${FAIL} rozporov: ${findings.length}\n`)
for (const n of findings) {
  console.log(`  ${FAIL} ${n.sprava}`)
  console.log(`     ${n.preco}\n`)
}
await client.close()
process.exit(1)
