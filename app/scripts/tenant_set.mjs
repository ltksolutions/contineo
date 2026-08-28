/**
 * tenant_set.mjs — založenie a úprava tenanta (D29).
 *
 *     node scripts/tenant_set.mjs --stav
 *     node scripts/tenant_set.mjs --company SFZ \
 *       --host intranet.futbalsfz.sk --host app.contineo.app \
 *       --name "Slovenský futbalový zväz" --short SFZ \
 *       --language sk --languages sk,cs,en
 *
 * `tenants` je jediné miesto, kde je napísané, ktorá doména patrí komu.
 * Neznámy hostiteľ sa správa ako zakázaný (`src/lib/tenants.ts`), takže
 * **pridanie domény vo Verceli samo o sebe nič nesprístupní** — kým doména
 * nie je aj tu, portál na nej nič neukáže. Je to zámerné: dve nezávislé
 * miesta znamenajú, že preklep v jednom z nich nikoho nepustí dnu.
 *
 * Doména sa nedá priradiť dvom tenantom naraz. Skript to odmietne, nie
 * prepíše — tiché prevzatie domény je presne ten druh chyby, ktorý sa zistí
 * až vtedy, keď ľudia z jednej organizácie uvidia hlavičku druhej.
 */

import { MongoClient } from "mongodb"

const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? "contineo"
const OK = "\x1b[32m✔\x1b[0m", CHYBA = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const UI_LANGUAGES = ["sk", "cs", "en"]

if (!URI) {
  console.error(`${CHYBA} Chýba MONGODB_URI. Nastav ju v app/.env.local alebo:`)
  console.error(`     export MONGODB_URI="mongodb+srv://..."`)
  process.exit(1)
}

// ── Argumenty ────────────────────────────────────────────────────────────────

/** `--host` sa smie opakovať; ostatné prepíšu predchádzajúcu hodnotu. */
function parseArgs(argv) {
  const out = { hosts: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--stav") { out.status = true; continue }
    if (!a.startsWith("--")) continue
    const value = argv[i + 1]
    if (value === undefined || value.startsWith("--")) {
      console.error(`${CHYBA} Prepínač ${a} potrebuje hodnotu`)
      process.exit(1)
    }
    i++
    switch (a) {
      case "--company": out.company = value; break
      case "--host": out.hosts.push(value); break
      case "--name": out.name = value; break
      case "--short": out.short = value; break
      case "--logo": out.logo = value; break
      case "--accent": out.accent = value; break
      case "--support": out.support = value; break
      case "--language": out.language = value; break
      case "--languages": out.languages = value.split(",").map(s => s.trim()); break
      case "--disable": out.disable = value === "true" || value === "1"; break
      default:
        console.error(`${CHYBA} Neznámy prepínač ${a}`)
        process.exit(1)
    }
  }
  return out
}

/**
 * Rovnaké pravidlo ako `normalizeHostname()` v `src/lib/tenants.ts`, len
 * v jednoduchšom tvare: skript zapisuje, aplikácia číta, a keby sa tvary
 * rozišli, zápis by sa nikdy nenašiel.
 */
function normalizeHostname(raw) {
  let h = String(raw ?? "").trim().toLowerCase()
  if (h.startsWith("[")) {
    const end = h.indexOf("]")
    if (end > 0) return h.slice(1, end)
  }
  const colon = h.lastIndexOf(":")
  if (colon > 0 && /^\d+$/.test(h.slice(colon + 1)) && h.indexOf(":") === colon) {
    h = h.slice(0, colon)
  }
  if (h.endsWith(".")) h = h.slice(0, -1)
  return h
}

const args = parseArgs(process.argv.slice(2))

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const col = client.db(DB).collection("tenants")

  // ── Výpis stavu ───────────────────────────────────────────────────────────
  if (args.status || !args.company) {
    const all = await col.find({}).sort({ companyCode: 1 }).toArray()
    if (!all.length) {
      console.log(`${INFO} kolekcia tenants je prázdna — na žiadnej doméne sa nič neukáže`)
    }
    for (const t of all) {
      const mark = t.status === "active" ? OK : INFO
      console.log(`${mark} ${t.companyCode} · ${t.branding?.displayName ?? ""} · ${t.status}`)
      console.log(`   domény: ${(t.hostnames ?? []).join(", ") || "(žiadne)"}`)
      console.log(`   jazyky: ${(t.languages ?? []).join(", ")} (predvolený ${t.defaultLanguage})`)
    }
    if (!args.company) {
      console.log(`\n${INFO} bez --company sa nič nemení`)
      process.exit(0)
    }
  }

  // ── Zápis ─────────────────────────────────────────────────────────────────
  const companyCode = args.company
  const hostnames = [...new Set(args.hosts.map(normalizeHostname).filter(Boolean))]

  // Doména patrí najviac jednému tenantovi. Kontrola ide PRED zápisom —
  // po zápise by sa už nedalo zistiť, čo tam bolo predtým.
  if (hostnames.length) {
    const collision = await col.findOne({
      hostnames: { $in: hostnames },
      companyCode: { $ne: companyCode },
    })
    if (collision) {
      const which = hostnames.filter(h => (collision.hostnames ?? []).includes(h))
      console.error(`${CHYBA} doména ${which.join(", ")} už patrí tenantovi ${collision.companyCode}`)
      console.error(`     Najprv ju odober tam, potom prirad sem. Nič sa nezapísalo.`)
      process.exit(1)
    }
  }

  const languages = (args.languages ?? []).filter(l => UI_LANGUAGES.includes(l))
  if (args.languages && languages.length !== args.languages.length) {
    const bad = args.languages.filter(l => !UI_LANGUAGES.includes(l))
    console.error(`${CHYBA} neznámy jazyk: ${bad.join(", ")} (povolené: ${UI_LANGUAGES.join(", ")})`)
    process.exit(1)
  }
  if (args.language && !UI_LANGUAGES.includes(args.language)) {
    console.error(`${CHYBA} neznámy predvolený jazyk: ${args.language}`)
    process.exit(1)
  }

  const existing = await col.findOne({ companyCode })
  const now = new Date()

  const set = { updatedAt: now }
  if (hostnames.length) set.hostnames = hostnames
  if (args.name !== undefined) set["branding.displayName"] = args.name
  if (args.short !== undefined) set["branding.shortName"] = args.short
  if (args.logo !== undefined) set["branding.logoUrl"] = args.logo
  if (args.accent !== undefined) set["branding.accentColor"] = args.accent
  if (args.support !== undefined) set["branding.supportEmail"] = args.support.toLowerCase()
  if (args.language) set.defaultLanguage = args.language
  if (languages.length) set.languages = languages
  if (args.disable !== undefined) set.status = args.disable ? "disabled" : "active"

  // Pri zakladaní musia existovať rozumné predvolby — inak by vznikol záznam,
  // ktorý sa síce nájde, ale nedá sa z neho vykresliť stránka.
  const setOnInsert = { companyCode, createdAt: now }
  if (!set.hostnames) setOnInsert.hostnames = []
  if (!set.defaultLanguage) setOnInsert.defaultLanguage = "sk"
  if (!set.languages) setOnInsert.languages = ["sk"]
  if (!set.status) setOnInsert.status = "active"
  if (set["branding.displayName"] === undefined) setOnInsert["branding.displayName"] = companyCode

  await col.updateOne({ companyCode }, { $set: set, $setOnInsert: setOnInsert }, { upsert: true })

  const after = await col.findOne({ companyCode })
  console.log(`${OK} ${existing ? "upravený" : "založený"} tenant ${companyCode}`)
  console.log(`   názov:  ${after.branding?.displayName ?? ""}`)
  console.log(`   domény: ${(after.hostnames ?? []).join(", ") || "(žiadne — portál sa nikde neukáže)"}`)
  console.log(`   jazyky: ${(after.languages ?? []).join(", ")} (predvolený ${after.defaultLanguage})`)
  console.log(`   stav:   ${after.status}`)
} catch (e) {
  console.error(`${CHYBA} ${e.message}`)
  process.exit(1)
} finally {
  await client.close()
}
