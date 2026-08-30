/**
 * acknowledgement_report.mjs — výkaz potvrdení pre HR (Fáza 8, D24/D33).
 *
 *     npm run ack:report -- --company SFZ --documents smernica-gdpr > vykaz.csv
 *
 * Bez tohto je ultra-MVP nepoužiteľné: ľudia by potvrdzovali, ale HR by nemalo
 * ako zistiť výsledok. Preto vzniká skôr než dashboard — ten je až rozsah B.
 *
 * **Rozsah je jeden `companyCode`, nie strom.** Hierarchia neudeľuje prístup
 * (D32, D33): HR vidí svoju jednotku, nie potomkov ani nadradenú. Keby mala
 * centrála vidieť dcéru, je to explicitné oprávnenie, nie vlastnosť stromu —
 * a to sa nemá diať potichu cez skript.
 *
 * Výkaz ide na štandardný výstup, hlásenia na chybový, takže sa dá presmerovať
 * do súboru bez toho, aby sa doň zamiešali.
 */

import { getCollection } from "../src/lib/mongodb.ts"
import { loadDocument, effectiveVersion } from "../src/lib/documents.ts"
import { PERSONS_COLLECTION } from "../src/lib/persons.ts"
import { ACKNOWLEDGEMENTS_COLLECTION } from "../src/lib/acknowledgements.ts"
import { toCsv } from "./lib/csv.mjs"

const ERR = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const log = (...a) => console.error(...a)

/** Prečo dokument nemá platné znenie — strojový kľúč na vetu pre človeka. */
const NO_VERSION = {
  "no-versions": "dokument nemá ani jednu verziu",
  "validity-not-set": "verzii nikto neurčil dátum platnosti",
  "all-archived": "všetky verzie sú archivované",
  "not-yet-effective": "platnosť sa ešte nezačala",
  "no-longer-effective": "platnosť už skončila",
}

const args = process.argv.slice(2)
const arg = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const company = arg("--company")
const documents = (arg("--documents") ?? "").split(",").map(s => s.trim()).filter(Boolean)
const track = arg("--track")

if (!company || documents.length === 0 || args.includes("--help")) {
  log("Použitie: node scripts/acknowledgement_report.mjs --company <kód> --documents <id,id> [--track <kľúč>]")
  log("\n  --company    organizácia (companyCode). Výkaz je vždy len za ňu.")
  log("  --documents  identifikátory dokumentov, oddelené čiarkou")
  log("  --track      voliteľne len osoby zaradené do tejto trasy")
  log("\nVýkaz ide na štandardný výstup: … > vykaz.csv")
  process.exit(company && documents.length ? 0 : 1)
}

if (!process.env.MONGODB_URI) {
  log(`${ERR} Chýba MONGODB_URI (app/.env.local alebo export).`)
  process.exit(1)
}

// ── platné znenie ku každému dokumentu ───────────────────────────────────────

const valid = []
for (const documentId of documents) {
  const doc = await loadDocument(documentId)
  if (!doc) { log(`${ERR} dokument ${documentId} neexistuje — preskakujem`); continue }

  const v = effectiveVersion(doc)
  if (!v.ok) {
    log(`${ERR} ${documentId}: ${NO_VERSION[v.reason] ?? v.reason} — nedá sa potvrdiť, preskakujem`)
    continue
  }
  valid.push({ doc, version: v.version })
  log(`${INFO} ${documentId}: platná verzia ${v.version.label} (${v.version.versionId})`)
}

if (valid.length === 0) {
  log(`${ERR} Ani jeden dokument nemá platné znenie — výkaz by bol prázdny.`)
  process.exit(1)
}

// ── osoby a ich potvrdenia ───────────────────────────────────────────────────

const personFilter = { companyCode: company, status: { $ne: "inactive" } }
if (track) personFilter.tracks = track

const persons = await (await getCollection(PERSONS_COLLECTION))
  .find(personFilter).sort({ email: 1 }).toArray()

log(`${INFO} osôb v rozsahu: ${persons.length}${track ? ` (trasa ${track})` : ""}`)

const acks = await (await getCollection(ACKNOWLEDGEMENTS_COLLECTION)).find({
  companyCode: company,
  type: "acknowledgement",
  versionId: { $in: valid.map(p => p.version.versionId) },
}).toArray()

// Kľúč osoba+verzia — potvrdenie je jedno na dvojicu (unikátny index, D24).
const byKey = new Map(acks.map(a => [`${a.personId}|${a.versionId}`, a]))

const rows = []
for (const person of persons) {
  for (const { doc, version } of valid) {
    const ack = byKey.get(`${person.id}|${version.versionId}`)
    rows.push({ person, doc, version, ack })
  }
}

// ── výkaz ────────────────────────────────────────────────────────────────────

const COLUMNS = [
  { label: "Organizácia",       value: r => r.person.companyCode },
  { label: "E-mail",            value: r => r.person.email },
  { label: "Meno",              value: r => r.person.fullName },
  // Oddelenie v čase potvrdenia, nie dnešný: po reorganizácii by výkaz za minulý
  // rok inak povedal niečo iné než vtedy (D50). Dnešné zaradenie je náhradou
  // len tam, kde odtlačok chýba — teda pri potvrdeniach spred zavedenia poľa.
  {
    label: "Oddelenie (v čase potvrdenia)",
    value: r => r.ack?.departmentNames?.join(" › ")
      || r.ack?.departmentId && "(zrušený oddelenie)"
      || r.person.department
      || "",
  },
  { label: "Dokument",          value: r => r.doc.title },
  { label: "Verzia",            value: r => r.version.label },
  { label: "Platná od",         value: r => date(r.version.effectiveFrom) },
  { label: "Stav",              value: r => (r.ack ? "potvrdené" : "NEPOTVRDENÉ") },
  { label: "Potvrdené dňa",     value: r => (r.ack ? date(r.ack.acknowledgedAt) : "") },
  { label: "Jazyk potvrdenia",  value: r => r.ack?.language ?? "" },
  { label: "Jazyk dokumentu",   value: r => r.doc.language ?? "" },
]

/** Dátum aj s časom, lebo pri audite ide o poradie udalostí, nie o deň. */
function date(d) {
  if (!(d instanceof Date)) return ""
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

process.stdout.write(toCsv(rows, COLUMNS))

const error = rows.filter(r => !r.ack).length
log(`\n${INFO} spolu ${rows.length} riadkov · nepotvrdených ${error}`)
process.exit(0)
