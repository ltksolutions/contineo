/**
 * chunking_status.mjs — ktorý dokument je narezaný podľa čoho (D79).
 *
 *     npm run chunking:status -- --company SFZ
 *
 * Pre každý dokument ukáže jeho profil členenia a či uložené `chunkingId`
 * sedí s tým, čo by dnes vyšlo. Nič nemení — iba číta a počíta.
 *
 * Stĺpec `podľa profilu` je stav po D79 (profil dokumentu), stĺpec `podľa
 * organizácie` je stav pred ním (`tenant.chunking`). Sú tam oba zámerne: keď
 * sa dokument zrazu javí ako neaktuálny, prvá otázka je, či za to môže
 * zavedenie profilov, alebo bol neaktuálny už predtým.
 */
import { MongoClient } from "mongodb"
import { chunkingFor, toChunkerProfile } from "../src/lib/chunkingProfile.ts"
import { chunkText, DEFAULT_PROFILE } from "../src/lib/chunker.mjs"
import { chunkingFingerprint, needsReindex } from "../src/lib/chunkIdentity.ts"

const OK = "\x1b[32m✔\x1b[0m", BAD = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const arg = (f) => { const i = process.argv.indexOf(f); return i === -1 ? null : process.argv[i + 1] ?? null }
const company = arg("--company")

if (!process.env.MONGODB_URI) {
  console.error(`${BAD} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const filter = company ? { companyCode: company } : {}
  const tenants = await db.collection("tenants").find(filter).toArray()
  const documents = await db.collection("documents").find(filter).toArray()

  const byCode = new Map(tenants.map(t => [t.companyCode, t]))
  const pad = (s, n) => String(s).padEnd(n)

  console.log([pad("documentId", 38), pad("profil", 12), pad("podľa profilu", 16), "podľa organizácie"].join(" "))
  console.log("─".repeat(96))

  let outdatedNew = 0, outdatedOld = 0, counted = 0
  for (const d of documents.sort((a, b) => String(a.documentId).localeCompare(String(b.documentId)))) {
    const tenant = byCode.get(d.companyCode)
    const effective = (d.versions ?? []).find(v => v.isActive)
    const text = String(effective?.markdown ?? d.markdown ?? "").trim()
    if (!text) {
      console.log([pad(d.documentId, 38), pad(d.chunkingProfile ?? "—", 12), `${INFO} bez textu`].join(" "))
      continue
    }
    counted++

    const fingerprint = (profile) => {
      const forChunker = toChunkerProfile(profile)
      const { chunky } = chunkText(text, { nazovDokumentu: d.title ?? "", profil: forChunker })
      if (!chunky.length) return null
      return chunkingFingerprint(chunky, { ...DEFAULT_PROFILE, ...forChunker })
    }

    const novy = fingerprint(chunkingFor(tenant, d.chunkingProfile))
    const stary = fingerprint(tenant?.chunking)
    const badNew = !novy || needsReindex(d.chunkingId, novy)
    const badOld = !stary || needsReindex(d.chunkingId, stary)
    if (badNew) outdatedNew++
    if (badOld) outdatedOld++

    console.log([
      pad(d.documentId, 38),
      pad(d.chunkingProfile ?? "—", 12),
      pad(badNew ? `${BAD} neaktuálne` : `${OK} sedí`, 16),
      badOld ? `${BAD} neaktuálne` : `${OK} sedí`,
    ].join(" "))
  }

  console.log("─".repeat(96))
  console.log(`${counted} dokumentov s textom · neaktuálnych podľa profilu: ${outdatedNew} · podľa organizácie: ${outdatedOld}`)
  if (outdatedNew === outdatedOld) {
    console.log(`${OK} Zavedenie profilov na tom nič nezmenilo — rozdiel má inú príčinu.`)
  } else {
    console.log(`${BAD} Profily to zmenili. To je presne ten stav, ktorý D79 nesmie spôsobiť.`)
  }
} finally {
  await client.close()
}
