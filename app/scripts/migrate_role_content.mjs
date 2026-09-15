/**
 * migrate_role_content.mjs — `spravca-obsahu` → `content-admin`.
 *
 *     node --env-file=.env.local scripts/migrate_role_content.mjs           # náhľad
 *     node --env-file=.env.local scripts/migrate_role_content.mjs --zapisat
 *
 * Bolo to jediné slovenské označenie roly v systéme; ostatné sú `hr`,
 * `people-admin` a `evaluator`. Premenovanie je zásah do `persons`, preto
 * **náhľad je predvolený** a zápis si treba vypýtať prepínačom.
 *
 * **Poradie je dôležité.** Kód uznáva obe označenia naraz
 * (`LEGACY_CONTENT_ROLE` v `lib/library.ts`), takže sa dá nasadiť kedykoľvek
 * a migrovať potom. Keby sa uznávalo len nové, každý nezmigrovaný človek by
 * o prístup do knižnice prišiel v okamihu nasadenia.
 *
 * Skript je **idempotentný**: kto už má nové označenie, sa nezmení, a keby
 * mal omylom obe, staré sa len odoberie.
 */
import { MongoClient } from "mongodb"

const STARE = "spravca-obsahu"
const NOVE = "content-admin"
const ZAPISAT = process.argv.includes("--zapisat")

const OK = "\x1b[32m✔\x1b[0m", INFO = "\x1b[33m·\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m"

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
try {
  const col = client.db(process.env.MONGODB_DB ?? "contineo").collection("persons")
  const dotknuti = await col.find({ roles: STARE }, { projection: { email: 1, companyCode: 1, roles: 1 } }).toArray()

  console.log(`\n${INFO} osôb so starým označením: ${dotknuti.length}`)
  for (const o of dotknuti) {
    const mask = String(o.email ?? "").replace(/(.{3}).*(@.*)/, "$1***$2")
    console.log(`   ${mask} · ${o.companyCode} · [${(o.roles ?? []).join(", ")}]`)
  }

  if (!dotknuti.length) {
    console.log(`\n${OK} niet čo migrovať\n`)
  } else if (!ZAPISAT) {
    console.log(`\n${INFO} NÁHĽAD — nič sa nezapísalo. Spusti s --zapisat.\n`)
  } else {
    // Dve operácie, nie jedna: `$addToSet` nové, potom `$pull` staré. Opačné
    // poradie by na okamih nechalo človeka bez roly úplne.
    const pridane = await col.updateMany({ roles: STARE }, { $addToSet: { roles: NOVE } })
    const odobrate = await col.updateMany({ roles: STARE }, { $pull: { roles: STARE } })
    console.log(`\n${OK} doplnené „${NOVE}": ${pridane.modifiedCount}`)
    console.log(`${OK} odobraté „${STARE}": ${odobrate.modifiedCount}`)
    const zostava = await col.countDocuments({ roles: STARE })
    console.log(`${zostava === 0 ? OK : FAIL} osôb so starým označením po migrácii: ${zostava}\n`)
  }
} finally {
  await client.close()
}
