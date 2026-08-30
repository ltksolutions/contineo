/**
 * import_persons.mjs — import osôb z CSV do kolekcie `persons` (Fáza 8, D26).
 *
 *     npm run persons:import -- osoby.csv            len náhľad
 *     npm run persons:import -- osoby.csv --zapis    naozaj zapíše
 *
 * **Náhľad je predvolené správanie, zápis sa musí vypýtať.** Nahratie stovky
 * ľudí naslepo je presne tá operácia, po ktorej sa hľadá, ako to vrátiť späť —
 * a `persons` rollback nemá.
 *
 * Pravidlá overovania aj samotný zápis sú v `src/lib/persons.ts`; tento skript
 * je len obal okolo CSV. Zámerne: dve implementácie toho, čo je platný riadok,
 * by sa raz rozišli.
 */

import { readFileSync } from "node:fs"
import { parseCsv } from "../src/lib/csv.ts"
import { riadokNaOsobu, DOVODY } from "../src/lib/personsImport.ts"
import { previewImport, upsertPersons } from "../src/lib/persons.ts"

const OK = "\x1b[32m✔\x1b[0m", ERR = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

// ── beh ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith("--"))
const write = args.includes("--zapis")

if (!file || args.includes("--help")) {
  console.log("Použitie: node scripts/import_persons.mjs <súbor.csv> [--zapis]")
  console.log("\nStĺpce (stačí jeden z tvarov, na diakritike ani veľkosti nezáleží):")
  for (const [field, names] of Object.entries(ALIASY)) {
    console.log(`  ${field.padEnd(12)} ${names.join(" · ")}`)
  }
  console.log("\nPovinné sú e-mail, meno a organizácia. Bez --zapis sa len ukáže náhľad.")
  process.exit(file ? 0 : 1)
}

if (!process.env.MONGODB_URI) {
  console.error(`${ERR} Chýba MONGODB_URI (app/.env.local alebo export).`)
  process.exit(1)
}

const { rows, headers, separator } = parseCsv(readFileSync(file, "utf8"))
console.log(`${INFO} ${file}: ${rows.length} riadkov, oddeľovač „${separator}"`)
console.log(`${INFO} rozpoznané stĺpce: ${headers.join(", ")}\n`)

const people = rows.map(naOsobu)
const preview = await previewImport(people)

console.log(`${OK} nových:     ${preview.created.length}`)
console.log(`${INFO} existujúcich: ${preview.existing.length}  (aktualizujú sa)`)
if (preview.errors.length) {
  console.log(`${ERR} chybných:    ${preview.errors.length}`)
  for (const e of preview.errors.slice(0, 20)) {
    console.log(`     ${e.email || "(bez adresy)"} — ${DOVODY[e.reason] ?? e.reason}`)
  }
  if (preview.errors.length > 20) console.log(`     … a ďalších ${preview.errors.length - 20}`)
}

if (!write) {
  console.log(`\n${INFO} Len náhľad, nič sa nezapísalo. Zápis: pridaj --zapis`)
  process.exit(preview.errors.length ? 1 : 0)
}

if (preview.errors.length) {
  console.log(`\n${ERR} Sú tam chybné riadky — oprav ich a spusti znova.`)
  console.log(`${INFO} Zápis po častiach by nechal databázu v polovičnom stave.`)
  process.exit(1)
}

const v = await upsertPersons(people, process.env.USER ?? "import_persons.mjs")
console.log(`\n${OK} zapísané — nových ${v.created}, aktualizovaných ${v.updated}, bez zmeny ${v.unchanged}`)
if (v.errors.length) {
  console.log(`${ERR} pri zápise zlyhalo ${v.errors.length}:`)
  for (const e of v.errors) console.log(`     ${e.email} — ${e.reason}`)
}
process.exit(v.errors.length ? 1 : 0)
