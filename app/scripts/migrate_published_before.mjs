/**
 * migrate_published_before.mjs — označí znenia zverejnené **pred zavedením
 * schvaľovania** (ADR-006, D74).
 *
 *     npm run migrate:grandfather -- --company SFZ            náhľad
 *     npm run migrate:grandfather -- --company SFZ --zapis    vykoná
 *
 * **Nedopisuje schválenie.** To by znamenalo vyrobiť súhlas, ktorý nikto
 * nedal — to isté, čo sme odmietli pri termínoch (D61) a pri chýbajúcom čase
 * čítania (D65). Zapisuje jediný príznak, ktorý hovorí: *toto znenie tu bolo
 * skôr, než sa začalo schvaľovať.*
 *
 * **Dočasné lešenie (D75).** Príznak zmizne spolu so skúšobným korpusom, keď
 * ho nahradia oficiálne znenia prevedené cez schvaľovanie. Poradie sa nedá
 * obrátiť: najprv schvaľovanie funguje, potom sa cezeň nahrajú oficiálne
 * znenia, až potom sa odstráni skúšobný korpus — inak by z oficiálnych noriem
 * bol druhý prípad grandfatheringu a stratila by sa jediná príležitosť mať
 * úplnú reťaz dôkazov od prvého dňa.
 *
 * **Len zverejnené dokumenty.** Koncept nikto nezverejnil, takže označiť ho
 * ako „zverejnený pred zavedením schvaľovania" by bola nepravda — a hlavne by
 * mu to otvorilo bránu pri prideľovaní. Koncepty ostávajú konceptmi a pôjdu
 * schvaľovaním ako všetko ostatné.
 *
 * **Spustiť sa dá opakovane.** Zapisuje len tam, kde príznak ešte nie je, a čo
 * neurobí, to ani neeviduje v audite.
 */

import { getCollection } from "../src/lib/mongodb.ts"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents.ts"
import { TENANTS_COLLECTION } from "../src/lib/tenants.ts"
import { writeAudit } from "../src/lib/audit.ts"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const args = process.argv.slice(2)
const write = args.includes("--zapis")
const company = (args[args.indexOf("--company") + 1] ?? "").trim()
const actor = (args[args.indexOf("--actor") + 1] ?? "").trim() || "script:migrate_published_before"

if (!company || company.startsWith("--")) {
  console.error(`${FAIL} Chýba --company (napr. --company SFZ)`)
  process.exit(1)
}

const tenants = await getCollection(TENANTS_COLLECTION)
if (!(await tenants.findOne({ companyCode: company }))) {
  console.error(`${FAIL} Organizácia ${company} tu nie je.`)
  process.exit(1)
}

const documents = await getCollection(DOCUMENTS_COLLECTION)
const rows = await documents
  .find(
    { companyCode: company },
    { projection: { documentId: 1, title: 1, status: 1, versions: 1 } },
  )
  .toArray()

console.log(`\n${INFO} Organizácia ${company}: ${rows.length} dokumentov`)
console.log(`${INFO} Režim: ${write ? "ZÁPIS" : "náhľad (nič sa nemení)"}\n`)

let toMark = 0, marked = 0, already = 0, skippedDrafts = 0, noVersions = 0

for (const d of rows) {
  const versions = Array.isArray(d.versions) ? d.versions : []
  const status = String(d.status ?? "draft")
  const title = String(d.title ?? d.documentId)

  if (versions.length === 0) {
    noVersions++
    console.log(`${INFO} ${title} — bez znení, preskočené`)
    continue
  }
  if (status !== "published") {
    skippedDrafts++
    console.log(`${INFO} ${title} — koncept, zámerne neoznačený (${versions.length} znení)`)
    continue
  }

  const pending = versions.filter(v => v.publishedBefore !== true)
  already += versions.length - pending.length
  if (pending.length === 0) {
    console.log(`${OK} ${title} — už označené (${versions.length})`)
    continue
  }

  toMark += pending.length
  const labels = pending.map(v => v.label ?? v.versionId).join(", ")
  console.log(`${write ? OK : INFO} ${title} — ${pending.length} znení: ${labels}`)

  if (!write) continue

  const res = await documents.updateOne(
    { documentId: d.documentId, companyCode: company },
    { $set: { "versions.$[bez].publishedBefore": true } },
    { arrayFilters: [{ "bez.publishedBefore": { $ne: true } }] },
  )
  if (res.modifiedCount !== 1) {
    console.error(`${FAIL} ${title} — zápis neprešiel`)
    continue
  }
  marked += pending.length

  // Audit až po úspešnom zápise (D51) — opačné poradie eviduje zmeny, ktoré
  // sa nestali. Cieľom je dokument, lebo znenie vlastný záznam v audite nemá.
  await writeAudit({
    companyCode: company,
    subject: "document",
    action: "grandfathered",
    actor,
    targetId: String(d.documentId),
    targetLabel: title,
    note:
      `Znenia označené ako zverejnené pred zavedením schvaľovania (ADR-006, D74): ${labels}. ` +
      `Nie je to schválenie — je to pomenované prázdne miesto, ktoré zmizne s nahradením skúšobného korpusu (D75).`,
  })
}

console.log(`\n${INFO} Znení na označenie: ${toMark}`)
if (write) console.log(`${OK} Označených: ${marked}`)
console.log(`${INFO} Už označených skôr: ${already}`)
console.log(`${INFO} Konceptov preskočených: ${skippedDrafts}`)
console.log(`${INFO} Dokumentov bez znení: ${noVersions}`)
if (!write) console.log(`\n${INFO} Náhľad. Zápis: doplň --zapis\n`)

process.exit(0)
