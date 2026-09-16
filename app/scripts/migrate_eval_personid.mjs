/**
 * migrate_eval_personid.mjs — v `evaluations` nahradí e-mail za `persons.id` (O17).
 *
 *     node --env-file=.env.local scripts/migrate_eval_personid.mjs           # náhľad
 *     node --env-file=.env.local scripts/migrate_eval_personid.mjs --zapisat
 *
 * Päť polí drží podpis človeka: `reviewer`, `readerNoteBy`, `evaluatedBy`,
 * `curation.preparedBy` a `curation.publishedBy`. Od O17 v nich má byť
 * `persons.id`, nie adresa — dôvod je v `RatingRecord.reviewer`: záznam
 * o hodnotení nie je dôkaz (na rozdiel od `acknowledgements`, D24), takže
 * odkaz stačí a má zomrieť spolu s osobou.
 *
 * **Migrácia je nevratná** — e-mail sa zahadzuje, to je celý jej zmysel.
 * Preto je náhľad predvolený a zápis si treba vypýtať prepínačom.
 *
 * E-mail, ktorý sa v `persons` nenájde (testovací záznam, zaniknutá osoba),
 * sa **nemapuje a pole sa odoberie**. Je to správne: bez záznamu v adresári
 * by z adresy nevznikol odkaz, len osobný údaj bez účelu.
 *
 * Skript je idempotentný — hodnota bez `@` sa považuje za už zmigrovanú.
 */
import { MongoClient } from "mongodb"

const POLIA = ["reviewer", "readerNoteBy", "evaluatedBy", "curation.preparedBy", "curation.publishedBy"]
const ZAPISAT = process.argv.includes("--zapisat")

const OK = "\x1b[32m✔\x1b[0m", INFO = "\x1b[33m·\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m"
const mask = e => String(e).replace(/(.{3}).*(@.*)/, "$1***$2")
const hodnota = (z, pole) => (pole.startsWith("curation.") ? z.curation?.[pole.slice(9)] : z[pole])

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
try {
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("evaluations")
  const zaznamy = await col.find({}).toArray()

  // Adresár raz, nie na každý záznam.
  const osoby = await db.collection("persons")
    .find({}, { projection: { id: 1, email: 1, fullName: 1 } })
    .toArray()
  const podlaEmailu = new Map(osoby.map(o => [String(o.email ?? "").toLowerCase(), o]))

  let nazapis = 0, bezOsoby = 0, hotove = 0
  const plan = []

  for (const z of zaznamy) {
    const set = {}, unset = {}
    for (const pole of POLIA) {
      const v = hodnota(z, pole)
      if (typeof v !== "string" || !v) continue
      if (!v.includes("@")) { hotove++; continue }

      const osoba = podlaEmailu.get(v.toLowerCase())
      if (osoba?.id) { set[pole] = osoba.id; nazapis++ }
      else { unset[pole] = ""; bezOsoby++ }
    }
    if (Object.keys(set).length || Object.keys(unset).length) {
      plan.push({ id: z._id, set, unset })
    }
  }

  console.log(`\n${INFO} záznamov: ${zaznamy.length} · na premapovanie: ${nazapis} · bez osoby v adresári: ${bezOsoby} · už zmigrovaných: ${hotove}\n`)

  for (const r of plan) {
    for (const [pole, id] of Object.entries(r.set)) {
      const povodny = [...podlaEmailu.entries()].find(([, o]) => o.id === id)?.[0] ?? "?"
      console.log(`  ${r.id}  ${pole}: ${mask(povodny)} → ${id}`)
    }
    for (const pole of Object.keys(r.unset)) {
      console.log(`  ${r.id}  ${pole}: ${mask(hodnota(zaznamy.find(z => String(z._id) === String(r.id)), pole))} → (odobrané, osoba nie je v adresári)`)
    }
  }

  if (!plan.length) {
    console.log(`${OK} niet čo migrovať — v podpisoch nie je ani jeden e-mail.\n`)
    process.exit(0)
  }

  if (!ZAPISAT) {
    console.log(`\n${INFO} Náhľad. Na zápis spusti znova s --zapisat\n`)
    process.exit(0)
  }

  let zmenene = 0
  for (const r of plan) {
    const update = {}
    if (Object.keys(r.set).length) update.$set = r.set
    if (Object.keys(r.unset).length) update.$unset = r.unset
    const v = await col.updateOne({ _id: r.id }, update)
    zmenene += v.modifiedCount
  }
  console.log(`\n${OK} zmenených záznamov: ${zmenene}\n`)
} finally {
  await client.close()
}
