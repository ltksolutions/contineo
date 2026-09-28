/**
 * migrate_chunk_superseded.mjs — doplní úsekom príznak `superseded`
 * (plán „znenia v indexe", krok 2; `docs/TODO.md`).
 *
 *     npm run chunks:superseded -- --company SFZ              náhľad
 *     npm run chunks:superseded -- --company SFZ --naozaj     zapíše
 *
 * `true` = členenie nahradené preindexovaním toho istého znenia,
 * `false` = platné členenie svojho znenia (aj keď znenie samo už neplatí).
 * Pravidlo je `classifyChunkings()` (`src/lib/chunkSuperseded.ts`, testy).
 * Nové úseky ho dostávajú pri zápise v `publish()` a `reindex()`; tento skript
 * je pre úseky, ktoré vznikli skôr.
 *
 * **Dá sa púšťať opakovane** — zapíše len úseky, ktorým hodnota chýba alebo
 * je iná. Pole len pribúda, nič sa nemaže; návrat je
 * `updateMany({}, { $unset: { superseded: "", supersededAt: "" } })`, preto
 * sa záloha nerobí. Zapíše jeden záznam do auditu organizácie.
 *
 * Púšťa sa po nasadení kódu, ktorý príznak zapisuje — inak by úseky zo
 * zverejnenia medzi migráciou a nasadením príznak nemali (`npm run check`
 * to vypíše a stačí migráciu zopakovať).
 */

import { getCollection } from "../src/lib/mongodb.ts"
import { CHUNKS_COLLECTION } from "../src/lib/libraryWrite.ts"
import { writeAudit } from "../src/lib/audit.ts"
import { classifyChunkings } from "../src/lib/chunkSuperseded.ts"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const args = process.argv.slice(2)
const val = (f) => {
  const i = args.indexOf(f)
  const v = i === -1 ? null : args[i + 1] ?? null
  return v && !v.startsWith("--") ? v.trim() : null
}
const company = val("--company")
const confirmed = args.includes("--naozaj")
const actor = val("--actor") ?? "script:migrate_chunk_superseded"

if (!company) {
  console.error(`${FAIL} Chýba --company (napr. --company SFZ)\n`)
  console.error("  npm run chunks:superseded -- --company SFZ            náhľad")
  console.error("  npm run chunks:superseded -- --company SFZ --naozaj   zapíše")
  process.exit(1)
}

try {
  const chunks = await getCollection(CHUNKS_COLLECTION)
  const rows = await chunks
    .find(
      { companyCode: company },
      { projection: { _id: 1, versionId: 1, chunkingId: 1, isActive: 1, sourceType: 1, createdAt: 1, embeddedAt: 1, superseded: 1 } },
    )
    .toArray()

  const { current, superseded } = classifyChunkings(rows)
  const state = new Map(rows.map(r => [String(r._id), r.superseded]))
  const toFalse = current.filter(id => state.get(String(id)) !== false)
  const toTrue = superseded.filter(id => state.get(String(id)) !== true)
  const untouched = rows.length - current.length - superseded.length

  console.log(`${INFO} organizácia ${company}: ${rows.length} úsekov`)
  console.log(`    platné členenie znenia:   ${current.length} (zapísať: ${toFalse.length})`)
  console.log(`    nahradené členenie:       ${superseded.length} (zapísať: ${toTrue.length})`)
  console.log(`    bez znenia / overené odp.: ${untouched} (nemenia sa)`)

  if (toFalse.length + toTrue.length === 0) {
    console.log(`${OK} Všetky úseky majú príznak správne — niet čo zapisovať.`)
    process.exit(0)
  }
  if (!confirmed) {
    console.log(`\n${INFO} Náhľad — nič sa nezapísalo. Zapísať: pridaj --naozaj`)
    process.exit(0)
  }

  const now = new Date()
  let written = 0
  for (let i = 0; i < toFalse.length; i += 500) {
    const r = await chunks.updateMany(
      { companyCode: company, _id: { $in: toFalse.slice(i, i + 500) } },
      { $set: { superseded: false } },
    )
    written += r.modifiedCount
  }
  for (let i = 0; i < toTrue.length; i += 500) {
    const r = await chunks.updateMany(
      { companyCode: company, _id: { $in: toTrue.slice(i, i + 500) } },
      { $set: { superseded: true, supersededAt: now } },
    )
    written += r.modifiedCount
  }

  await writeAudit({
    companyCode: company,
    subject: "document",
    action: "changed",
    actor,
    targetId: "document_chunks:superseded",
    targetLabel: "Príznak nahradeného členenia úsekov",
    note: `platné členenie: ${toFalse.length}, nahradené: ${toTrue.length} (plán „znenia v indexe", krok 2)`,
  })

  console.log(`${OK} zapísaných ${written} úsekov, zapísané do auditu`)
  process.exit(written === toFalse.length + toTrue.length ? 0 : 1)
} catch (e) {
  console.error(`${FAIL} ${e?.message ?? e}`)
  process.exit(1)
}
