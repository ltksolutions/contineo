/**
 * migrate_person_name.mjs — rozdelí `fullName` na meno a priezvisko (D83).
 *
 *     node --env-file=.env.local scripts/migrate_person_name.mjs            náhľad
 *     node --env-file=.env.local scripts/migrate_person_name.mjs --zapis    vykoná
 *
 * **`fullName` sa neprepisuje. Nikdy.** Je to hodnota, ktorú si potvrdenia
 * a audit nesú ako kópiu v čase; migrácia dopĺňa len časti, z ktorých sa
 * `fullName` **odteraz** skladá. Prepočíta sa až pri prvom uložení karty osoby —
 * vtedy je za ním človek, ktorý tie polia videl.
 *
 * Poradie zdrojov:
 *   1. `givenName`/`surname` už vyplnené adresárom — použijú sa, nič sa nehádže.
 *   2. inak sa `fullName` rozdelí po prvej medzere (`splitFullName`).
 *   3. čo sa rozdeliť nedá — jedno slovo, meno rovné adrese — sa **vypíše
 *      a nechá prázdne**. Uhádnuté priezvisko sa od zadaného nedá odlíšiť,
 *      a to je horšie než prázdno: karta osoby prázdno označí a personalista
 *      ho doplní, kým nesprávne priezvisko nikto nikdy nenájde.
 *
 * Obrátené poradie („Letko Ján") rozdelí naopak. Presne preto beží najprv
 * nasucho a výsledok sa **číta**, nie odklikne.
 *
 * Predvolene beží nasucho.
 */
import { MongoClient } from "mongodb"
import { splitFullName } from "../src/lib/personFields.ts"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", WARN = "\x1b[33m▲\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const write = process.argv.includes("--zapis")

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("persons")

  const people = await col.find({}, {
    projection: { id: 1, companyCode: 1, email: 1, fullName: 1, givenName: 1, surname: 1 },
  }).toArray()

  console.log(`${INFO} Osôb v databáze: ${people.length}`)
  console.log(write ? `${INFO} Režim: ZÁPIS` : `${INFO} Režim: náhľad (bez --zapis sa nič nezapíše)`)
  console.log("")

  const fromDirectory = []   // už má obe časti — nesaháme
  const toSplit = []         // rozdelí sa
  const unsplittable = []    // nechá sa prázdne

  for (const p of people) {
    const hasParts = Boolean(p.givenName?.trim() && p.surname?.trim())
    if (hasParts) { fromDirectory.push(p); continue }

    const split = splitFullName(p.fullName ?? "")
    // Meno rovné adrese je osoba založená automaticky (D47) — nie je to meno.
    const looksLikeEmail = (p.fullName ?? "").trim().toLowerCase() === (p.email ?? "").toLowerCase()
    if (!split || looksLikeEmail) { unsplittable.push(p); continue }
    toSplit.push({ ...p, split })
  }

  console.log(`${OK} Už rozdelené adresárom: ${fromDirectory.length}`)
  console.log(`${INFO} Na rozdelenie: ${toSplit.length}`)
  console.log(`${WARN} Nedá sa rozdeliť: ${unsplittable.length}`)
  console.log("")

  if (toSplit.length > 0) {
    console.log("Ukážka rozdelenia (prvých 20) — PREČÍTAJ, či sedí poradie:")
    for (const p of toSplit.slice(0, 20)) {
      console.log(`   „${p.fullName}"  →  meno „${p.split.givenName}"  ·  priezvisko „${p.split.surname}"`)
    }
    if (toSplit.length > 20) console.log(`   … a ďalších ${toSplit.length - 20}`)
    console.log("")
  }

  if (unsplittable.length > 0) {
    console.log(`${WARN} Tieto zostanú prázdne a doplní ich personalista na karte osoby:`)
    for (const p of unsplittable.slice(0, 30)) {
      console.log(`   ${p.email} — „${p.fullName ?? ""}"`)
    }
    if (unsplittable.length > 30) console.log(`   … a ďalších ${unsplittable.length - 30}`)
    console.log("")
  }

  if (!write) {
    console.log(`${INFO} Nič sa nezapísalo. Keď poradie v ukážke sedí, spusti znova s --zapis.`)
    process.exit(0)
  }

  let written = 0
  for (const p of toSplit) {
    // Zapisujú sa **len časti**. `fullName` sa nedotýkame — pozri hlavičku.
    await col.updateOne(
      { _id: p._id },
      { $set: { givenName: p.split.givenName, surname: p.split.surname } },
    )
    written++
  }

  console.log(`${OK} Doplnené meno a priezvisko: ${written}`)
  console.log(`${INFO} Hodnota fullName sa nezmenila ani u jednej osoby.`)
} catch (e) {
  console.error(`${FAIL} Migrácia zlyhala:`, e.message)
  process.exit(1)
} finally {
  await client.close()
}
