/**
 * reindex_library.mjs — preindexovanie knižnice organizácie (D160).
 *
 *     npm run chunking:reindex -- --company SFZ              náhľad (koľko je neaktuálnych)
 *     npm run chunking:reindex -- --company SFZ --naozaj     preindexovať
 *
 * Do 5. 10. 2026 to bolo tlačidlo „Preindexovať" v Nastaveniach organizácie
 * → Členenie. Preindexovanie celej knižnice treba len vtedy, keď sa zmení
 * algoritmus členenia (`CHUNKER_VERSION`) — a to je úloha prevádzkovateľa,
 * nie správcu organizácie. Jeden dokument sa dá preindexovať v jeho detaile.
 *
 * Beží tou istou funkciou ako tlačidlo (`reindexAll`), po dávkach po 25,
 * kým nie je hotovo. Každý dokument sa reže **svojím** profilom (D79);
 * znenia (`versions[]`) a potvrdenia sa nemenia (D57).
 *
 * **Predvolene beží nasucho.** `companyCode` je v podmienke každého dotazu (D32).
 */

import { reindexAll, reindexState } from "../src/lib/libraryWrite.ts"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const args = process.argv.slice(2)
const val = (f) => {
  const i = args.indexOf(f)
  const v = i === -1 ? null : args[i + 1] ?? null
  return v && !v.startsWith("--") ? v.trim() : null
}
const company = val("--company")
const confirmed = args.includes("--naozaj")
const actor = val("--actor") ?? "script:reindex_library"

if (!company) {
  console.error(`${FAIL} Chýba --company (napr. --company SFZ)\n`)
  console.error("  npm run chunking:reindex -- --company SFZ            náhľad")
  console.error("  npm run chunking:reindex -- --company SFZ --naozaj   preindexovať")
  process.exit(1)
}

try {
  const state = await reindexState(company)
  console.log(`${INFO} ${company}: ${state.neaktualnych} z ${state.celkom} dokumentov je narezaných inak, než by vyšlo dnes.`)
  if (state.neaktualnych === 0) {
    console.log(`${OK} Nie je čo preindexovať.`)
    process.exit(0)
  }
  if (!confirmed) {
    console.log(`${INFO} Nasucho. Preindexovať: pridaj --naozaj`)
    process.exit(0)
  }

  let total = 0
  for (let round = 1; round <= 100; round++) {
    const v = await reindexAll(company, actor, 25)
    total += v.preindexovanych
    console.log(`${INFO} dávka ${round}: preindexovaných ${v.preindexovanych}, preskočených ${v.preskocenych}, zostáva ${v.remaining}`)
    for (const e of v.errors) console.error(`${FAIL} ${e}`)
    if (v.errors.length) process.exit(1)
    if (!v.remaining) break
  }
  console.log(`${OK} Hotovo — preindexovaných ${total} dokumentov.`)
  process.exit(0)
} catch (e) {
  console.error(`${FAIL} ${e instanceof Error ? e.message : e}`)
  process.exit(1)
}
