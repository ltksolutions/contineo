/**
 * migrate_document_key.mjs — oddelí identitu dokumentu od zaradenia (D80).
 *
 *     node --env-file=.env.local scripts/migrate_document_key.mjs            náhľad
 *     node --env-file=.env.local scripts/migrate_document_key.mjs --zapis    vykoná
 *
 * Doplní `documents.documentKey` a vytvorí unikátny index na
 * `documents.documentId`.
 *
 * **Kľúč sa odvodzuje z `documentId`, nie zo `sectionKey`.** Znie to ako
 * detail, ale nie je: `sfz:test_onboarding` má `sectionKey: "smernice"`, takže
 * odvodenie zo zaradenia by mu identitu zmenilo na `sfz:smernice`. Prvý beh
 * nasucho to našiel. `documentId` je jediná hodnota, ktorá je dnes pravdivá —
 * a tá sa meniť nesmie, takže kľúč je presne jej druhá polovica.
 *
 * **Žiadnemu dokumentu sa nesmie zmeniť `documentId`.** Je to cudzí kľúč
 * v `acknowledgements`, `document_chunks`, `assignments`, `approval_rounds`,
 * `onboarding_tracks` aj v auditnom zázname — zmena by ich rozviazala a
 * prejavila by sa až tým, že niekomu naskočí povinnosť, ktorú nemá. Skript
 * to preto pri každom dokumente **overí** a pri prvom rozdiele nezapíše nič.
 *
 * **Unikátny index doteraz neexistoval** — jedinečnosť `documentId` držal
 * výhradne filter `upsert`u. Odkedy sa kolízia odmieta (D80/A3), je medzi
 * kontrolou a zápisom okno; index ho zatvára.
 *
 * Predvolene beží nasucho. Návratový kód 1 pri rozpore.
 */
import { MongoClient } from "mongodb"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", WARN = "\x1b[33m▲\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const write = process.argv.includes("--zapis")

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
let problems = 0

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("documents")

  const rows = await col.find({}).project({ documentId: 1, documentKey: 1, sectionKey: 1, companyCode: 1, title: 1 }).toArray()
  console.log(`${INFO} Dokumentov: ${rows.length}\n`)

  const plan = []
  for (const d of rows) {
    // Druhá polovica `documentId` — všetko za prvou dvojbodkou. Kľúč ju môže
    // obsahovať len cez `KEY_PATTERN`, takže rozdelenie je jednoznačné.
    const id = String(d.documentId ?? "")
    const derived = id.slice(id.indexOf(":") + 1)
    const key = String(d.documentKey ?? (derived || d.sectionKey || ""))
    const wouldBe = `${d.companyCode}:${key}`.toLowerCase()
    const same = wouldBe === id
    if (!same) problems++
    const note = !d.documentKey && key !== String(d.sectionKey ?? "")
      ? ` ${WARN} zaradenie je "${d.sectionKey}", kľúč je iný — správne`
      : ""
    plan.push({ d, key, wouldBe, same, already: Boolean(d.documentKey) })
    const stav = !same
      ? `${FAIL} ZMENILO BY SA na ${wouldBe}`
      : d.documentKey ? `${INFO} už má documentKey` : `${OK} doplní sa "${key}"${note}`
    console.log(`${id.padEnd(40)} ${stav}`)
  }

  // Dvakrát ten istý identifikátor by unikátny index odmietol — a zistiť to
  // až pádom pri jeho vytváraní je horšie než to povedať dopredu.
  const seen = new Map()
  for (const d of rows) seen.set(d.documentId, (seen.get(d.documentId) ?? 0) + 1)
  const duplicates = [...seen.entries()].filter(([, n]) => n > 1)
  if (duplicates.length) {
    problems++
    console.error(`\n${FAIL} Zdvojené documentId: ${duplicates.map(([k, n]) => `${k} (${n}×)`).join(", ")}`)
    console.error("   Unikátny index sa na takýchto dátach vytvoriť nedá — najprv to treba rozhodnúť.")
  }

  if (problems > 0) {
    console.error(`\n${FAIL} Migrácia sa nespustí: ${problems} rozporov. Nezapísalo sa nič.`)
    process.exit(1)
  }

  const toFill = plan.filter(p => !p.already)
  console.log(`\n${INFO} Doplniť documentKey: ${toFill.length} · už má: ${plan.length - toFill.length}`)

  if (!write) {
    console.log(`${INFO} Náhľad. Spusti znova s --zapis.`)
    process.exit(0)
  }

  for (const p of toFill) {
    await col.updateOne({ documentId: p.d.documentId }, { $set: { documentKey: p.key } })
  }
  console.log(`${OK} documentKey doplnený ${toFill.length} dokumentom.`)

  // Kontrola po zápise, nie dôvera pred ním.
  const after = await col.find({}).project({ documentId: 1 }).toArray()
  const before = new Set(rows.map(d => d.documentId))
  const changed = after.filter(d => !before.has(d.documentId))
  if (changed.length) {
    console.error(`${FAIL} Zmenil sa documentId: ${changed.map(d => d.documentId).join(", ")}`)
    process.exit(1)
  }
  console.log(`${OK} Žiadnemu dokumentu sa documentId nezmenil.`)

  try {
    await col.createIndex({ documentId: 1 }, { unique: true, name: "document_id_unique" })
    console.log(`${OK} Unikátny index document_id_unique vytvorený.`)
  } catch (e) {
    console.error(`${WARN} Index sa nepodarilo vytvoriť: ${e?.message ?? e}`)
    process.exit(1)
  }

  console.log(`\n${INFO} Spusti \`npm run check\` — overí, že nevznikli rozpory.`)
} finally {
  await client.close()
}
