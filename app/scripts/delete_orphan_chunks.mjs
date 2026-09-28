/**
 * delete_orphan_chunks.mjs — zmaže osirelé úseky (neaktívne úseky znení,
 * ktoré v organizácii už neexistujú).
 *
 *     npm run chunks:orphans -- --company SFZ              náhľad
 *     npm run chunks:orphans -- --company SFZ --naozaj     záloha + zmazanie
 *
 * Mazanie schválil Ján 2026-09-28 pred krokom 3 plánu „znenia v indexe"
 * (`docs/TODO.md`): úseky nie sú dôkazné, do hľadania nevstupujú, ale
 * automatický embedding ich vektorizuje a pri zmene indexu by ich zbytočne
 * prepočítal. Čo je osirelé, určuje `orphanVerdict()` (`src/lib/chunkOrphans.ts`)
 * a má na to testy — aktívne úseky, overené odpovede a úseky bez znenia sa
 * nemažú nikdy.
 *
 * **Predvolene beží nasucho.** Pri `--naozaj` sa najprv uloží záloha celých
 * úsekov do `data/backup/<čas>/` (mimo repozitára); bez úspešnej zálohy sa
 * nemaže. Po zmazaní sa zapíše jeden záznam do auditu organizácie.
 *
 * `companyCode` je v podmienke každého dotazu (D32).
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { getCollection } from "../src/lib/mongodb.ts"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents.ts"
import { CHUNKS_COLLECTION } from "../src/lib/libraryWrite.ts"
import { writeAudit } from "../src/lib/audit.ts"
import { orphanVerdict, versionIndex } from "../src/lib/chunkOrphans.ts"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const args = process.argv.slice(2)
const val = (f) => {
  const i = args.indexOf(f)
  const v = i === -1 ? null : args[i + 1] ?? null
  return v && !v.startsWith("--") ? v.trim() : null
}
const company = val("--company")
const confirmed = args.includes("--naozaj")
const actor = val("--actor") ?? "script:delete_orphan_chunks"

if (!company) {
  console.error(`${FAIL} Chýba --company (napr. --company SFZ)\n`)
  console.error("Použitie:")
  console.error("  npm run chunks:orphans -- --company SFZ            náhľad")
  console.error("  npm run chunks:orphans -- --company SFZ --naozaj   záloha a zmazanie")
  process.exit(1)
}

try {
  const documents = await getCollection(DOCUMENTS_COLLECTION)
  const chunks = await getCollection(CHUNKS_COLLECTION)

  const docs = await documents
    .find({ companyCode: company }, { projection: { documentId: 1, "versions.versionId": 1 } })
    .toArray()
  const { versionsByDocument, allVersionIds } = versionIndex(docs)

  // Len kandidáti: neaktívne úseky normy. Konečné rozhodnutie je `orphanVerdict()`.
  const candidates = await chunks
    .find(
      { companyCode: company, isActive: false, sourceType: { $ne: "qa" } },
      { projection: { _id: 1, documentId: 1, versionId: 1, isActive: 1, sourceType: 1, text: 1 } },
    )
    .toArray()

  const orphans = []
  const byDocument = new Map()
  let chars = 0
  for (const c of candidates) {
    const v = orphanVerdict(c, versionsByDocument, allVersionIds)
    if (!v.orphan) continue
    orphans.push(c._id)
    chars += String(c.text ?? "").length
    const key = `${c.documentId ?? "?"} (${v.reason === "document-missing" ? "dokument neexistuje" : "znenie neexistuje"})`
    byDocument.set(key, (byDocument.get(key) ?? 0) + 1)
  }

  console.log(`${INFO} organizácia ${company}: ${docs.length} dokumentov, ${allVersionIds.size} znení`)
  console.log(`${INFO} neaktívne úseky normy: ${candidates.length}, z toho osirelé: ${orphans.length} (${chars.toLocaleString("sk")} znakov)`)
  for (const [key, n] of [...byDocument.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(5)}  ${key}`)
  }

  if (orphans.length === 0) {
    console.log(`${OK} Niet čo mazať.`)
    process.exit(0)
  }
  if (!confirmed) {
    console.log(`\n${INFO} Náhľad — nič sa nezmazalo. Zmazať: pridaj --naozaj`)
    process.exit(0)
  }

  // Záloha celých úsekov — bez nej sa nemaže.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const backupDir = join(process.cwd(), "data", "backup", stamp)
  const full = await chunks.find({ companyCode: company, _id: { $in: orphans } }).toArray()
  mkdirSync(backupDir, { recursive: true })
  writeFileSync(join(backupDir, "document_chunks_orphans.json"), JSON.stringify(full, null, 1))
  console.log(`${OK} záloha: data/backup/${stamp}/document_chunks_orphans.json (${full.length} úsekov)`)

  let deleted = 0
  for (let i = 0; i < orphans.length; i += 500) {
    const batch = orphans.slice(i, i + 500)
    // Podmienka zopakuje, prečo je úsek kandidát — keby sa medzitým aktivoval,
    // nezmaže sa.
    const r = await chunks.deleteMany({ companyCode: company, isActive: false, _id: { $in: batch } })
    deleted += r.deletedCount
  }

  await writeAudit({
    companyCode: company,
    subject: "document",
    action: "deleted",
    actor,
    targetId: "document_chunks:orphans",
    targetLabel: "Osirelé úseky (znenie neexistuje)",
    note: `zmazaných ${deleted} úsekov z ${byDocument.size} skupín; záloha data/backup/${stamp}/`,
  })

  console.log(`${OK} zmazaných ${deleted} osirelých úsekov, zapísané do auditu`)
  process.exit(deleted === orphans.length ? 0 : 1)
} catch (e) {
  console.error(`${FAIL} ${e?.message ?? e}`)
  process.exit(1)
}
