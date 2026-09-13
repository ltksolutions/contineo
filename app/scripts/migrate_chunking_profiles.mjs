/**
 * migrate_chunking_profiles.mjs — pomenované profily členenia (D79, krok B3).
 *
 *     node --env-file=.env.local --import ./scripts/lib/ts-hook.mjs scripts/migrate_chunking_profiles.mjs
 *     ... --zapis
 *
 * Z `tenants.chunking` spraví **základný pomenovaný profil** a opečiatkuje ním
 * dokumenty organizácie.
 *
 * **Nič sa nesmie narezať inak.** Profil má po migrácii tie isté hodnoty, aké
 * mal predtým, takže `toChunkerProfile()` vráti to isté a `chunkingId` každého
 * dokumentu zostáva platný. Skript to pri každom dokumente **overí porovnaním
 * vyriešeného profilu pred a po** — a pri prvom rozdiele nezapíše nič. Keby to
 * neoveroval, celá knižnica by naraz vyzerala ako nepreindexovaná, hoci by sa
 * v texte nezmenilo nič.
 *
 * Predvolene beží nasucho. Návratový kód 1 pri rozpore.
 */
import { MongoClient } from "mongodb"
import { chunkingFor, toChunkerProfile, DEFAULT_PROFILE_KEY } from "../src/lib/chunkingProfile.ts"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const write = process.argv.includes("--zapis")
const LABEL = "Základný"

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
let problems = 0

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const tenants = db.collection("tenants")
  const documents = db.collection("documents")

  const rows = await tenants.find({}).toArray()
  console.log(`${INFO} Organizácií: ${rows.length}\n`)

  const plan = []
  for (const t of rows) {
    const already = (t.chunkingProfiles ?? []).some(p => p.key === DEFAULT_PROFILE_KEY)
    const base = { key: DEFAULT_PROFILE_KEY, label: LABEL, ...(t.chunking ?? {}) }
    const profiles = already ? t.chunkingProfiles : [...(t.chunkingProfiles ?? []), base]

    const docs = await documents
      .find({ companyCode: t.companyCode })
      .project({ documentId: 1, chunkingProfile: 1 })
      .toArray()

    // Porovnanie toho, čo naozaj ide do chunkera — nie toho, čo je v poli.
    const before = JSON.stringify(toChunkerProfile(chunkingFor(t, null)) ?? null)
    const after = JSON.stringify(
      toChunkerProfile(chunkingFor({ ...t, chunkingProfiles: profiles }, DEFAULT_PROFILE_KEY)) ?? null,
    )
    const same = before === after
    if (!same) problems++

    plan.push({ t, profiles, docs, already, same })
    console.log(
      `${String(t.companyCode).padEnd(10)} ${String(docs.length).padStart(3)} dok · ` +
      (already ? `${INFO} profil už má` : `${OK} pridá sa "${DEFAULT_PROFILE_KEY}"`) +
      (same ? "" : `\n   ${FAIL} REZALO BY INAK\n     pred: ${before}\n     po:   ${after}`),
    )
  }

  if (problems > 0) {
    console.error(`\n${FAIL} Migrácia sa nespustí: ${problems} rozporov. Nezapísalo sa nič.`)
    process.exit(1)
  }

  const toStamp = plan.reduce((n, p) => n + p.docs.filter(d => !d.chunkingProfile).length, 0)
  console.log(`\n${INFO} Opečiatkovať dokumentov: ${toStamp}`)

  if (!write) {
    console.log(`${INFO} Náhľad. Spusti znova s --zapis.`)
    process.exit(0)
  }

  for (const p of plan) {
    if (!p.already) {
      await tenants.updateOne({ companyCode: p.t.companyCode }, { $set: { chunkingProfiles: p.profiles } })
    }
    const r = await documents.updateMany(
      { companyCode: p.t.companyCode, chunkingProfile: { $exists: false } },
      { $set: { chunkingProfile: DEFAULT_PROFILE_KEY } },
    )
    console.log(`${OK} ${p.t.companyCode}: profil uložený, opečiatkovaných ${r.modifiedCount}`)
  }

  console.log(`\n${INFO} Spusti \`npm run check\` — overí, že nevznikli rozpory.`)
  console.log(`${INFO} V nastavení organizácie, záložka Členenie, nesmie pribudnúť ani jeden neaktuálny dokument.`)
} finally {
  await client.close()
}
