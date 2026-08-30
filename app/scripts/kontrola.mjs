/**
 * kontrola.mjs — invarianty medzi dokumentmi, úsekmi a potvrdeniami (D59).
 *
 * Odkedy sa dá chunker ladiť a preindexovávať, pribudlo miest, kde sa dáta
 * môžu rozísť potichu. Nič nespadne — len sa zhoršia odpovede alebo niekomu
 * naskočí povinnosť, ktorú nemá. Tento skript to hľadá menovite.
 *
 * **Nič neopravuje.** Oprava je vždy rozhodnutie: preindexovať, dopublikovať
 * alebo nechať tak. Skript, ktorý „to spraví za teba", by pri prvej
 * nečakanej odchýlke prepísal niečo, čo nikto nechcel.
 *
 *     node --env-file=.env.local scripts/kontrola.mjs
 *     node --env-file=.env.local scripts/kontrola.mjs --tenant SFZ
 *
 * Návratový kód 1, keď našiel rozpor — dá sa zavesiť za preindexovanie.
 */

import { MongoClient } from "mongodb"

const OK = "\x1b[32m✔\x1b[0m", CHYBA = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

function arg(meno) {
  const i = process.argv.indexOf(meno)
  return i === -1 ? null : process.argv[i + 1] ?? null
}
const TENANT = arg("--tenant")

if (!process.env.MONGODB_URI) {
  console.error(`${CHYBA} Chýba MONGODB_URI.`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const db = client.db(process.env.MONGODB_DB ?? "contineo")
const filterTenanta = TENANT ? { companyCode: TENANT } : {}

const dokumenty = await db.collection("documents").find(filterTenanta).toArray()
const chunky = await db.collection("document_chunks").find(filterTenanta).toArray()
const potvrdenia = await db.collection("acknowledgements")
  .find({ ...filterTenanta, type: "acknowledgement" }).toArray()

const nalezy = []
const zisti = (podmienka, sprava, preco) => { if (podmienka) nalezy.push({ sprava, preco }) }

console.log(
  `\nKontrola${TENANT ? ` · ${TENANT}` : ""}: ` +
  `${dokumenty.length} dokumentov, ${chunky.length} úsekov, ${potvrdenia.length} potvrdení\n`,
)

// 1. Aktívny úsek musí ukazovať na existujúce znenie.
const znenia = new Map()
for (const d of dokumenty) {
  for (const v of d.versions ?? []) znenia.set(`${d.documentId}|${v.versionId}`, v)
}
for (const ch of chunky.filter(c => c.isActive)) {
  zisti(
    !znenia.has(`${ch.documentId}|${ch.versionId}`),
    `úsek ${ch.documentId} #${ch.chunkIndex} ukazuje na znenie ${ch.versionId}, ktoré v dokumente nie je`,
    "vyhľadávanie by vrátilo text, ktorý sa nedá spojiť so žiadnym platným znením",
  )
}

// 2. Jeden dokument = jedno aktívne členenie.
const podlaDokumentu = new Map()
for (const ch of chunky.filter(c => c.isActive)) {
  const z = podlaDokumentu.get(ch.documentId) ?? new Set()
  z.add(ch.chunkingId ?? "(bez chunkingId)")
  podlaDokumentu.set(ch.documentId, z)
}
for (const [doc, ids] of podlaDokumentu) {
  zisti(
    ids.size > 1,
    `dokument ${doc} má naraz ${ids.size} aktívnych členení`,
    "výsledky vyhľadávania by obsahovali ten istý text dvakrát, zakaždým inak narezaný",
  )
}

// 3. Potvrdené znenie musí mať text.
for (const p of potvrdenia) {
  const v = znenia.get(`${p.documentId}|${p.versionId}`)
  zisti(
    !v,
    `potvrdenie ${p.email} → ${p.documentId} ukazuje na znenie ${p.versionId}, ktoré neexistuje`,
    "dôkaz o oboznámení bez textu, s ktorým sa človek oboznámil, je bezcenný",
  )
  zisti(
    Boolean(v) && !String(v.markdown ?? "").trim(),
    `znenie ${p.versionId} (${p.documentId}) je potvrdené, ale nemá uložený text`,
    "to isté: nedá sa ukázať, čo človek čítal",
  )
}

// 4. Publikované znenie musí mať aktívne úseky.
for (const d of dokumenty) {
  const platne = (d.versions ?? []).filter(v => v.isActive && v.effectiveFrom)
  if (!platne.length) continue
  const maUseky = chunky.some(c => c.documentId === d.documentId && c.isActive)
  zisti(
    !maUseky,
    `${d.documentId} má platné znenie, ale ani jeden aktívny úsek`,
    "norma je publikovaná a vyhľadávanie o nej nevie — preindexuj ju",
  )
}

// 5. Model vektorov musí sedieť s nastavením.
const model = process.env.EMBEDDING_MODEL ?? "voyage-4"
const modely = new Set(chunky.filter(c => c.isActive).map(c => c.embeddingModel ?? "(chýba)"))
for (const m of modely) {
  zisti(
    m !== model,
    `aktívne úseky vyrobené modelom ${m}, v nastavení je ${model}`,
    "vektory nie sú prenositeľné medzi modelmi — nič nespadne, len sa ticho zhoršia výsledky",
  )
}

// 6. Znenie bez dátumu platnosti sa nedá potvrdiť (D6) — upozornenie, nie chyba.
let bezPlatnosti = 0
for (const d of dokumenty) {
  for (const v of d.versions ?? []) if (v.isActive && !v.effectiveFrom) bezPlatnosti++
}

// 7. Cesta priečinka musí sedieť so zaradením.
const priecinky = await db.collection("cms_folders").find(filterTenanta).toArray()
const podlaId = new Map(priecinky.map(p => [p.id, p]))
for (const d of dokumenty) {
  const cesta = []
  let teraz = d.folderId ? podlaId.get(d.folderId) : null
  let poistka = 0
  while (teraz && poistka++ < 8) {
    cesta.unshift(teraz.id)
    teraz = teraz.parentId ? podlaId.get(teraz.parentId) : null
  }
  const ulozena = d.folderPath ?? []
  zisti(
    cesta.length !== ulozena.length || cesta.some((x, i) => x !== ulozena[i]),
    `${d.documentId} má nesúhlasnú cestu priečinkov`,
    "filter na priečinok vrátane podpriečinkov by dokument nenašiel",
  )
}

if (bezPlatnosti > 0) {
  console.log(`${INFO} ${bezPlatnosti} aktívnych znení nemá dátum platnosti — nedajú sa potvrdiť (D6)\n`)
}

if (nalezy.length === 0) {
  console.log(`${OK} bez rozporov\n`)
  await client.close()
  process.exit(0)
}

console.log(`${CHYBA} rozporov: ${nalezy.length}\n`)
for (const n of nalezy) {
  console.log(`  ${CHYBA} ${n.sprava}`)
  console.log(`     ${n.preco}\n`)
}
await client.close()
process.exit(1)
