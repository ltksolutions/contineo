/**
 * zmaz_testovacie.mjs — odstráni záznamy z ladenia pred ostrým zberom.
 *
 *     node --env-file=.env.local scripts/zmaz_testovacie.mjs            (len ukáže)
 *     node --env-file=.env.local scripts/zmaz_testovacie.mjs --naozaj   (zmaže)
 *
 * Kritérium je jediné a zámerne úzke: `hodnotitel: "anonym"`. Tak sa označili
 * odpovede z obdobia, keď ešte nebolo prihlasovanie — teda výhradne testy pri
 * stavbe. Od nasadenia má každý záznam e-mail prihláseného človeka, takže sa
 * skutočná práca hodnotiteľa nemôže zmazať ani omylom.
 *
 * Predvolene beží nasucho. Mazať sa musí vypýtať.
 */
import { MongoClient } from "mongodb"

const OK = "\x1b[32m✔\x1b[0m", ZLE = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const naozaj = process.argv.includes("--naozaj")

if (!process.env.MONGODB_URI) {
  console.error(`${ZLE} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const col = client.db(process.env.MONGODB_DB ?? "contineo").collection("evaluations")

  const filter = { hodnotitel: "anonym" }
  const naZmazanie = await col.find(filter).toArray()

  if (!naZmazanie.length) {
    console.log(`${OK} Žiadne testovacie záznamy — kolekcia je čistá.`)
    process.exit(0)
  }

  console.log(`Nájdených ${naZmazanie.length} záznamov od „anonym":\n`)
  for (const z of naZmazanie) {
    const kedy = z.vytvorene?.toISOString?.().slice(0, 16).replace("T", " ") ?? "?"
    console.log(`  ${kedy}  ${z.otazkaId ?? "(voľný dotaz)"}  „${(z.otazka ?? "").slice(0, 60)}"`)
    console.log(`              správna: ${z.spravna}, halucinácia: ${z.halucinacia}`)
  }
  console.log()

  // Poistka: keby sa niekedy zmenilo, ako sa označuje neprihlásený, nech to
  // radšej spadne, než aby to zmazalo prácu človeka.
  const sEmailom = naZmazanie.filter(z => String(z.hodnotitel ?? "").includes("@"))
  if (sEmailom.length) {
    console.error(`${ZLE} Medzi nájdenými je ${sEmailom.length} záznamov s e-mailom. Nemažem nič.`)
    process.exit(1)
  }

  if (!naozaj) {
    console.log(`${INFO} Beh nasucho. Na zmazanie spusti znova s --naozaj`)
    process.exit(0)
  }

  const r = await col.deleteMany(filter)
  console.log(`${OK} Zmazaných ${r.deletedCount} záznamov.`)

  const zostava = await col.countDocuments()
  console.log(`${INFO} V kolekcii zostáva ${zostava} záznamov.`)
} finally {
  await client.close()
}
