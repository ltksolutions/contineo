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
const persons = await db.collection("persons")
  .find(tenantFilter, { projection: { id: 1, email: 1, roles: 1, status: 1 } }).toArray()

const findings = []
const check = (condition, message, why) => { if (condition) findings.push({ sprava: message, preco: why }) }

console.log(
  `\nKontrola${TENANT ? ` · ${TENANT}` : ""}: ` +
  `${documents.length} dokumentov, ${chunks.length} úsekov, ${acknowledgements.length} potvrdení, ${persons.length} osôb\n`,
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

/*
 * N. Rola, ktorú kód nepozná, je tichý odobratý prístup.
 *
 * Roly sú obyčajné reťazce v poli — preklep ani staré označenie nikde
 * nevyhodí chybu, len prestane platiť. `spravca-obsahu` je tu zámerne:
 * je to staré meno `content-admin` (premenované 2026-09-15). Kód ho už
 * neuznáva, takže keby sa znova objavilo — napríklad zo zálohy — človek
 * o prístup ticho príde. Preto sa naň pýtame aj po migrácii.
 */
const ZNAME_ROLE = new Set(["hr", "people-admin", "content-admin", "evaluator", "platform-admin"])
const STARE_ROLE = new Set(["spravca-obsahu"])
for (const o of persons) {
  for (const r of o.roles ?? []) {
    check(
      STARE_ROLE.has(r),
      `${o.email} má staré označenie roly „${r}"`,
      "kód ho už neuznáva, takže človek o prístup do knižnice prišiel — spusti `npm run migrate:role-content -- --zapisat`",
    )
    check(
      !ZNAME_ROLE.has(r) && !STARE_ROLE.has(r),
      `${o.email} má rolu „${r}", ktorú kód nepozná`,
      "rola je obyčajný reťazec — preklep nikde nevyhodí chybu, len ticho neplatí",
    )
  }
}

/*
 * N. Overená odpoveď nesmie byť prístupnejšia než predpis, z ktorého vznikla.
 *
 * Toto je **tvrdá kontrola, nie odporúčanie**. Úroveň sa pri zverejnení
 * odvodzuje najprísnejšou stranou (`lib/curation.ts`), takže tu by nemalo
 * nikdy nič byť — a práve preto sa to kontroluje: chyba, ktorá sa nemá stať,
 * sa inak zistí až tým, že interný text zaznie vo verejnej odpovedi.
 */
const qaChunks = chunks.filter(c => c.sourceType === "qa")
const byDocumentAccess = new Map()
for (const ch of chunks.filter(c => c.sourceType !== "qa")) {
  const z = byDocumentAccess.get(ch.documentId) ?? new Set()
  z.add(ch.accessLevel ?? "(chýba)")
  byDocumentAccess.set(ch.documentId, z)
}
for (const qa of qaChunks) {
  const zdroje = qa.derivedFrom ?? (qa.documentId ? [qa.documentId] : [])
  const urovne = zdroje.flatMap(d => [...(byDocumentAccess.get(d) ?? ["(chýba)"])])
  const maByt = urovne.length && urovne.every(u => u === "public") ? "public" : "internal"
  check(
    qa.accessLevel !== maByt,
    `overená odpoveď ${qa._id} má prístup „${qa.accessLevel ?? "(chýba)"}", ale zo zdrojov vychádza „${maByt}"`,
    "pár by sa ukázal tam, kde sa ukázať nesmie — alebo naopak nikde; oboje je chyba, prvé je únik",
  )
  check(
    !zdroje.length,
    `overená odpoveď ${qa._id} nemá ani jeden zdrojový dokument`,
    "nedá sa z nej odvodiť prístup ani ju archivovať, keď sa norma zmení",
  )
  check(
    Boolean(qa.isActive) && zdroje.some(d => !chunks.some(c => c.documentId === d && c.isActive && c.sourceType !== "qa")),
    `overená odpoveď ${qa._id} je aktívna, ale predpis, z ktorého vznikla, aktívne úseky nemá`,
    "odpoveď prežila normu — archivuj ju alebo predpis preindexuj",
  )
}
if (qaChunks.length) {
  console.log(`${INFO} overených odpovedí v indexe: ${qaChunks.filter(c => c.isActive).length} aktívnych z ${qaChunks.length}\n`)
}

/*
 * N. V zázname o hodnotení nesmie byť e-mail (O17).
 *
 * Podpisy sú `persons.id`, nie adresy — dôvod je v `RatingRecord.reviewer`.
 * Bez tejto kontroly by sa e-mail vrátil pri prvom volajúcom, ktorý na to
 * zabudne, a nikto by si to nevšimol: je to pole, ktoré sa bežne nečíta.
 */
const POLIA_PODPISU = ["reviewer", "readerNoteBy", "evaluatedBy", "curation.preparedBy", "curation.publishedBy"]
const hodnotenia = await db.collection("evaluations")
  .find(tenantFilter, { projection: { reviewer: 1, readerNoteBy: 1, evaluatedBy: 1, curation: 1 } })
  .toArray()
for (const z of hodnotenia) {
  for (const pole of POLIA_PODPISU) {
    const hodnota = pole.startsWith("curation.") ? z.curation?.[pole.slice(9)] : z[pole]
    check(
      typeof hodnota === "string" && hodnota.includes("@"),
      `hodnotenie ${z._id} má v poli „${pole}" e-mail, nie „persons.id"`,
      "záznam o hodnotení nie je dôkaz a nemá držať osobný údaj doslovne — spusti `npm run migrate:eval-personid -- --zapisat`",
    )
  }
}

/*
 * Zodpovedná osoba a právny základ pri **platnom** znení (D91, O15).
 *
 * Informácia, nie rozpor: znenia spred D91 ich nemajú a mať nemôžu — nikto
 * ich spätne nedopĺňa za človeka. Pridelenie bez právneho základu sa zámerne
 * neblokuje (rozhodnutie 2026-09-23), preto sa to vypisuje tu, aby sa to
 * doplnilo pred ostrou prevádzkou. Neaktívna zodpovedná osoba je horšia než
 * žiadna: ľudí posiela za niekým, kto im neodpovie.
 */
const activePersonIds = new Set(persons.filter(o => o.status !== "inactive").map(o => o.id))
const withoutResponsible = [], inactiveResponsible = [], withoutBasis = [], outsideCodelist = []
for (const d of documents) {
  const v = (d.versions ?? []).find(x => x.isActive && !x.effectiveTo)
  if (!v) continue
  const name = `${d.documentId} (${v.label})`
  if (!v.responsiblePerson) withoutResponsible.push(name)
  else if (!activePersonIds.has(v.responsiblePerson.personId)) inactiveResponsible.push(`${name} — ${v.responsiblePerson.fullName}`)
  if (!v.legalBasis) withoutBasis.push(name)
  else if (!v.legalBasisKey) outsideCodelist.push(`${name} — ${v.legalBasisReference ?? v.legalBasis}`)
}
const listOut = (title, list) => {
  if (list.length === 0) return
  console.log(`${INFO} ${title}: ${list.length}`)
  for (const x of list.slice(0, 20)) console.log(`     ${x}`)
  if (list.length > 20) console.log(`     … a ďalších ${list.length - 20}`)
  console.log("")
}
listOut("platné znenia bez zodpovednej osoby (D91) — doplní správca obsahu v knižnici", withoutResponsible)
listOut("platné znenia, ktorých zodpovedná osoba už nie je aktívna — treba určiť novú", inactiveResponsible)
listOut("platné znenia bez právneho základu (O15) — určí zodpovedná osoba", withoutBasis)
listOut("platné znenia s právnym základom mimo číselníka (D92) — vybrať položku z číselníka", outsideCodelist)

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
