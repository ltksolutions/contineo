/**
 * migrate_document_uuid.mjs — existujúce dokumenty dostanú kľúč UUID (ADR-044).
 *
 *     node --env-file=.env.local scripts/migrate_document_uuid.mjs            náhľad
 *     node --env-file=.env.local scripts/migrate_document_uuid.mjs --zapis    vykoná
 *
 * Každý dokument, ktorého `documentId` ešte nie je v tvare `sfz:<32 hexa>`,
 * dostane nový kľúč a **starý identifikátor sa prepíše všade** — v potvrdeniach,
 * prideleniach, audite, úsekoch, trasách, kurzoch, notifikáciách… Ján 2. 11.
 * 2026: „B — prepísať všetko". Výnimka z D24 je zapísaná v ADR-044.
 *
 * **Prečo skenovať dáta, nie zoznam polí z kódu.** Polí, v ktorých
 * `documentId` žije, je vyše dvadsať v pätnástich kolekciách a zoznam
 * z kódu by raz zaostal. Skript preto prejde **každú kolekciu a každú
 * hodnotu** a prepíše starý identifikátor — aj v poliach, aj v kľúčoch
 * objektov, aj v `_id`. Okrem presnej zhody aj **uprostred textu**
 * (zoznam „sfz:a, sfz:b" v audite, odkaz `/library/sfz:a`), ale len ako
 * celé slovo: `sfz:stanovy` sa v `sfz:stanovy_2` neprepíše. Prepisy
 * v texte sa vypíšu zvlášť, aby ich bolo vidieť. Odkazy mimo databázy
 * (odoslané e-maily, záložky) prekladá `document_id_aliases`.
 *
 * **Poradie a opakovanie.** Najprv sa zapíšu dvojice starý → nový do
 * `document_id_aliases` (unikátny index). Opakovaný beh po prerušení
 * vezme tie isté nové identifikátory, takže sa dá spustiť znova bez škody.
 *
 * **Kedy spustiť.** Keď nikto nepracuje — dokument nahratý alebo potvrdený
 * počas behu môže zostať so starým identifikátorom. Druhý beh ho dorobí.
 *
 * Predvolene beží nasucho (nové identifikátory v náhľade sú len ukážka,
 * zápis vylosuje iné). Návratový kód 1 pri rozpore.
 */
import { randomUUID } from "node:crypto"
import { MongoClient } from "mongodb"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", WARN = "\x1b[33m▲\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const write = process.argv.includes("--zapis")

const ALIASES = "document_id_aliases"
/** Nový tvar — rovnaký ako `UUID_DOCUMENT_ID` v `src/lib/documentAliases.ts`. */
const UUID_DOCUMENT_ID = /^[a-z0-9]+:[0-9a-f]{32}$/
/** Kolekcie, ktoré sa neskenujú: zoznam dvojíc samotný. */
const SKIP = new Set([ALIASES])

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

/** Hodnota, do ktorej sa nevnára (ObjectId, Date, Binary, Decimal…). */
function isLeaf(v) {
  return v === null || typeof v !== "object" || v instanceof Date || v._bsontype !== undefined
}

/** Znak, ktorý môže byť súčasťou identifikátora — hranica slova je iný znak. */
const ID_CHAR = /[a-z0-9_:]/

/** Starý identifikátor ako celé slovo uprostred textu → nový. */
function rewriteInText(value, map) {
  let out = value
  for (const [old, next] of map) {
    let at = out.indexOf(old)
    while (at >= 0) {
      const before = at === 0 ? "" : out.charAt(at - 1)
      const after = out.charAt(at + old.length)
      if (!ID_CHAR.test(before) && !ID_CHAR.test(after)) {
        out = out.slice(0, at) + next + out.slice(at + old.length)
        at = out.indexOf(old, at + next.length)
      } else {
        at = out.indexOf(old, at + old.length)
      }
    }
  }
  return out
}

/**
 * Prepíše starý identifikátor v hodnote. Vracia novú hodnotu; do `hits`
 * zapíše cesty s presnou zhodou, do `partial` cesty, kde sa prepisovalo
 * uprostred textu.
 */
function rewrite(value, map, path, hits, partial) {
  if (typeof value === "string") {
    const next = map.get(value)
    if (next) { hits.push(path); return next }
    if (!value.includes(":")) return value
    const text = rewriteInText(value, map)
    if (text !== value) {
      hits.push(path)
      partial.push({ path, sample: value.length > 120 ? `${value.slice(0, 117)}…` : value })
    }
    return text
  }
  if (isLeaf(value)) return value
  if (Array.isArray(value)) {
    // Vektory (embeddingy) sú tisíce čísel — nič v nich nehľadáme.
    if (value.length > 64 && typeof value[0] === "number") return value
    let changed = false
    const out = value.map((v, i) => {
      const n = rewrite(v, map, `${path}[${i}]`, hits, partial)
      if (n !== v) changed = true
      return n
    })
    return changed ? out : value
  }
  let changed = false
  const out = {}
  for (const [k, v] of Object.entries(value)) {
    const key = map.get(k) ?? k
    if (key !== k) hits.push(`${path}.{${k}}`)
    const n = rewrite(v, map, path ? `${path}.${k}` : k, hits, partial)
    if (key !== k || n !== v) changed = true
    out[key] = n
  }
  return changed ? out : value
}

/** `acknowledgements[3].documentId` → `documentId` — na súhrn podľa poľa. */
const fieldOf = p => p.replace(/\[\d+\]/g, "[]").replace(/\{[^}]*\}/g, "{kľúč}")

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
let problems = 0

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const documents = db.collection("documents")
  const aliases = db.collection(ALIASES)

  // 1. Plán: starý → nový. Už zapísaná dvojica (prerušený beh) sa použije znova.
  const known = new Map((await aliases.find({}).toArray()).map(a => [a.oldId, a.newId]))
  const rows = await documents.find({}).project({ documentId: 1, documentKey: 1, companyCode: 1, title: 1 }).toArray()
  const plan = []
  for (const d of rows) {
    const oldId = String(d.documentId ?? "")
    if (!oldId || UUID_DOCUMENT_ID.test(oldId)) continue
    const colon = oldId.indexOf(":")
    if (colon < 1) { problems++; console.error(`${FAIL} ${oldId}: identifikátor bez organizácie — neviem, aký prefix dať`); continue }
    const newId = known.get(oldId) ?? `${oldId.slice(0, colon)}:${randomUUID().replace(/-/g, "")}`
    plan.push({ companyCode: String(d.companyCode ?? ""), oldId, newId, title: String(d.title ?? "") })
  }
  const done = rows.filter(d => UUID_DOCUMENT_ID.test(String(d.documentId ?? ""))).length
  console.log(`${INFO} Dokumentov: ${rows.length}, už v novom tvare: ${done}, na migráciu: ${plan.length}\n`)
  for (const p of plan) console.log(`${p.oldId.padEnd(56)} → ${p.newId}  ${INFO} ${p.title.slice(0, 60)}`)

  // Dva staré identifikátory na ten istý nový sa stať nemôžu (náhoda UUID),
  // ale starý zdvojený by znamenal, že dva dokumenty zdieľajú záznamy.
  const dupes = plan.filter((p, i) => plan.findIndex(q => q.oldId === p.oldId) !== i)
  if (dupes.length) { problems++; console.error(`\n${FAIL} Zdvojené documentId: ${dupes.map(d => d.oldId).join(", ")}`) }

  // Aj dvojice z predošlého behu: ak sa zápis prerušil, dokument už môže mať
  // nový identifikátor, ale potvrdenia ešte starý — sken ich musí nájsť.
  const map = new Map([...known, ...plan.map(p => [p.oldId, p.newId])])
  if (map.size === 0) { console.log(`\n${OK} Nie je čo migrovať.`); process.exit(0) }

  // 2. Sken všetkých kolekcií.
  const collections = (await db.listCollections({ type: "collection" }).toArray())
    .map(c => c.name).filter(n => !n.startsWith("system.") && !SKIP.has(n)).sort()
  const work = []
  const partialAll = []
  console.log(`\n${INFO} Skenujem ${collections.length} kolekcií…\n`)
  for (const name of collections) {
    const col = db.collection(name)
    const fields = new Map()
    let docs = 0
    for await (const doc of col.find({}).batchSize(200)) {
      const hits = [], partial = []
      const next = rewrite(doc, map, "", hits, partial)
      for (const p of partial) partialAll.push({ name, ...p })
      if (next === doc) continue
      docs++
      for (const h of hits) fields.set(fieldOf(h), (fields.get(fieldOf(h)) ?? 0) + 1)
      // Kolekcia `documents`: kľúč je druhá polovica nového identifikátora.
      if (name === "documents" && next.documentId !== doc.documentId) {
        next.documentKey = String(next.documentId).slice(String(next.documentId).indexOf(":") + 1)
      }
      work.push({ name, before: doc, after: next })
    }
    if (docs) {
      const list = [...fields.entries()].map(([f, n]) => `${f} ×${n}`).join(", ")
      console.log(`${OK} ${name.padEnd(28)} ${String(docs).padStart(5)} záznamov  ${list}`)
    }
  }

  if (partialAll.length) {
    console.log(`\n${WARN} Starý identifikátor uprostred textu — prepíše sa celé slovo (pôvodná hodnota):`)
    const by = new Map()
    for (const p of partialAll) {
      const k = `${p.name} · ${fieldOf(p.path)}`
      if (!by.has(k)) by.set(k, [])
      by.get(k).push(p.sample)
    }
    for (const [k, samples] of by) console.log(`   ${k} ×${samples.length}  napr. ${JSON.stringify(samples[0])}`)
  }

  if (problems > 0) {
    console.error(`\n${FAIL} ${problems} rozpor(ov) — nič sa nezapísalo.`)
    process.exit(1)
  }
  if (plan.length === 0 && work.length === 0) {
    console.log(`\n${OK} Nie je čo migrovať.`)
    process.exit(0)
  }
  if (!write) {
    console.log(`\n${INFO} Nasucho: ${plan.length} dokumentov, ${work.length} záznamov na prepis. Spusti s --zapis.`)
    process.exit(0)
  }

  // 3. Zápis: najprv dvojice (opakovaný beh ich vezme), potom záznamy.
  await aliases.createIndex({ companyCode: 1, oldId: 1 }, { unique: true, name: "alias_old_unique" })
  const by = process.env.USER ?? "migrate_document_uuid"
  for (const p of plan) {
    if (known.has(p.oldId)) continue
    await aliases.insertOne({ companyCode: p.companyCode, oldId: p.oldId, newId: p.newId, title: p.title, migratedAt: new Date(), migratedBy: by })
  }
  console.log(`\n${OK} Zapísaných dvojíc: ${plan.filter(p => !known.has(p.oldId)).length}`)

  let written = 0
  for (const w of work) {
    const col = db.collection(w.name)
    if (w.after._id === w.before._id || String(w.after._id) === String(w.before._id)) {
      const r = await col.replaceOne({ _id: w.before._id }, w.after)
      if (r.matchedCount !== 1) { problems++; console.error(`${FAIL} ${w.name} ${String(w.before._id)}: záznam medzitým zmizol`) }
    } else {
      // `_id` je nemenný — nový záznam a starý preč.
      await col.insertOne(w.after)
      await col.deleteOne({ _id: w.before._id })
    }
    written++
  }
  console.log(`${OK} Prepísaných záznamov: ${written}`)
  if (problems > 0) { console.error(`${FAIL} ${problems} rozpor(ov) pri zápise — spusti znova, dorobí zvyšok.`); process.exit(1) }
  console.log(`${OK} Hotovo. Druhý beh nasucho má povedať „Nie je čo migrovať".`)
} finally {
  await client.close()
}
