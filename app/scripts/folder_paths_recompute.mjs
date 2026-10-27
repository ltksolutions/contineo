/**
 * folder_paths_recompute.mjs — dopočíta `folderPath` dokumentom, ktorým
 * nesedí so zaradením do priečinka (`npm run check`, bod 7).
 *
 *     npm run folders:recompute                 # náhľad
 *     npm run folders:recompute -- --zapisat
 *
 * Cesta je odvodený údaj (index pre filter „vrátane podpriečinkov") a
 * obrazovka ju pri presune ukladá sama. Rozíde sa, keď dokument presunie
 * niečo mimo nej — 27. 10. 2026 to bola migrácia ADR-034, ktorá 8 poriadkom
 * nastavila priečinok bez cesty. Zápis robí `recomputePaths`, tá istá funkcia
 * ako pri presune priečinka. Mení sa len `folderPath`, nič iné.
 */
import { getClient, getCollection } from "../src/lib/mongodb.ts"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents.ts"
import { allFolders, pathIdsTo, recomputePaths } from "../src/lib/folders.ts"

const ZAPISAT = process.argv.includes("--zapisat")
const INFO = "\x1b[33m·\x1b[0m", OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m"

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spúšťa sa cez \`npm run folders:recompute\`.`)
  process.exit(1)
}

const docs = await getCollection(DOCUMENTS_COLLECTION)
const companies = await docs.distinct("companyCode")
let total = 0
for (const companyCode of companies) {
  const all = await allFolders(companyCode)
  const rows = await docs.find({ companyCode }, { projection: { documentId: 1, folderId: 1, folderPath: 1 } }).toArray()
  const wrong = rows.filter(d => {
    const next = pathIdsTo(all, d.folderId)
    const old = d.folderPath ?? []
    return next.length !== old.length || next.some((x, i) => x !== old[i])
  })
  if (!wrong.length) continue
  total += wrong.length
  for (const d of wrong) console.log(`  ${companyCode}  ${d.documentId}`)
  if (ZAPISAT) console.log(`${OK} ${companyCode}: prepočítané ${await recomputePaths(companyCode)}`)
}

console.log(total ? `\n${INFO} nesúhlasná cesta: ${total}${ZAPISAT ? "" : " — len náhľad, zapíše sa s --zapisat"}` : `${OK} všetky cesty sedia`)
await (await getClient()).close()
