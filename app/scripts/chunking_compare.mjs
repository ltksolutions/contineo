/**
 * chunking_compare.mjs — porovnanie uložených úsekov s dnešným rezom
 * (ADR-035, D233). Nič nemení — iba číta a počíta.
 *
 *     npm run chunking:compare -- --company SFZ
 *     npm run chunking:compare -- --company SFZ --refs    aj zoznam citácií, ktoré by zmizli
 *
 * Pre každý dokument s platným znením: spôsob dnešného rezu (ručné hranice,
 * podľa nadpisov, bez štruktúry), počet úsekov a podiel s citáciou (článok,
 * §, nadpis) pred a po, úseky nad 1,5 × cieľ, a či treba preindexovať.
 *
 * Preindexovanie existujúcich dokumentov sa púšťa až po tomto porovnaní
 * (`npm run chunking:reindex`) — poistka „nestratiť články" (14. 9. 2026)
 * ostáva aj v samotnom preindexovaní.
 */
import { MongoClient } from "mongodb"
import { cutForIndex } from "../src/lib/chunkCut.ts"
import { chunkingFingerprint, needsReindex } from "../src/lib/chunkIdentity.ts"
import { estimateTokens } from "../src/lib/chunker.mjs"
import { CUT_MAX } from "../src/lib/chunkHeadings.ts"

const OK = "\x1b[32m✔\x1b[0m", BAD = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const arg = (f) => { const i = process.argv.indexOf(f); return i === -1 ? null : process.argv[i + 1] ?? null }
const company = arg("--company")
const showRefs = process.argv.includes("--refs")

if (!process.env.MONGODB_URI) {
  console.error(`${BAD} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
const pad = (s, n) => String(s).padEnd(n)
const pct = (part, all) => (all ? `${Math.round((part / all) * 100)} %` : "—")
const big = Math.round(CUT_MAX * 1.5)

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const filter = company ? { companyCode: company } : {}
  const documents = await db.collection("documents").find(filter, { projection: { documentId: 1, companyCode: 1, title: 1, versions: 1, chunkCuts: 1 } }).toArray()

  console.log([pad("documentId", 44), pad("spôsob", 10), pad("úseky pred → po", 16), pad("s citáciou pred → po", 22), pad("veľké", 6), "preindexovať"].join(" "))
  let total = 0, outdated = 0, losing = 0
  for (const d of documents) {
    const effective = (d.versions ?? []).find(v => v.isActive)
    const text = String(effective?.markdown ?? "").trim()
    if (!effective || !text) continue
    total++
    const stored = await db.collection("document_chunks")
      .find({ companyCode: d.companyCode, documentId: d.documentId, versionId: effective.versionId, superseded: { $ne: true } }, { projection: { articleRef: 1, chunkingId: 1 } })
      .toArray()
    const cut = cutForIndex(text, d.title ?? "", d.chunkCuts)
    const fp = chunkingFingerprint(cut.chunks, cut.fingerprintProfile)
    const stale = needsReindex(stored[0]?.chunkingId, fp)
    if (stale) outdated++
    const before = stored.filter(c => c.articleRef).length
    const after = cut.chunks.filter(c => c.articleRef).length
    const shareBefore = stored.length ? before / stored.length : 0
    const shareAfter = cut.chunks.length ? after / cut.chunks.length : 0
    // Tá istá podmienka ako poistka v `reindexVersion()`.
    const wouldLose = !cut.manual && stored.length > 0 && shareBefore >= 0.5 && shareAfter < 0.5
    if (wouldLose) losing++
    const oversized = cut.chunks.filter(c => estimateTokens(c.text) > big).length
    console.log([
      pad(d.documentId, 44), pad(cut.method, 10),
      pad(`${stored.length} → ${cut.chunks.length}`, 16),
      pad(`${pct(before, stored.length)} → ${pct(after, cut.chunks.length)}`, 22),
      pad(oversized || "", 6),
      wouldLose ? `${BAD} stratil by citácie` : stale ? `${INFO} áno` : `${OK} nie`,
    ].join(" "))
    if (showRefs) {
      // Porovnáva sa článok bez odsekov: „čl. 12 ods. 1–9" a „čl. 12 ods. 1–5"
      // sú ten istý článok; chýba len článok, ktorý prišiel o vlastný úsek.
      const base = (r) => String(r).replace(/ ods\. .*$/, "")
      const now = new Set(cut.chunks.map(c => c.articleRef).filter(Boolean).map(base))
      const gone = [...new Set(stored.map(c => c.articleRef).filter(Boolean).map(base))].filter(r => !now.has(r))
      if (gone.length) console.log(`   zmiznú citácie: ${gone.slice(0, 20).join(", ")}${gone.length > 20 ? " …" : ""}`)
    }
  }
  console.log(`\n${total} dokumentov s platným znením · ${outdated} treba preindexovať · ${losing} by stratilo citácie (preindexovanie ich odmietne)`)
} finally {
  await client.close()
}
