/**
 * stav.mjs — read-only obhliadka: čo v databáze naozaj je.
 *
 *     npm run stav
 *
 * Vznikol 2026-08-28 z konkrétnej potreby: pred overovaním Fázy 9a nebolo
 * odkiaľ zistiť, či sa cez `persons` už niekto prihlásil. Odpoveď (nie,
 * `lastLoginAt` bolo prázdne) zmenila poradie práce — preto tu skript
 * zostáva, nie je to jednorazová pomôcka.
 *
 * **Nič nezapisuje.** Odpovedá na tri otázky:
 *   · sú v `persons` skutoční ľudia, majú trasy a prihlásil sa už niekto?
 *   · existujú trasy a majú kroky?
 *   · majú dokumenty platné znenie? (Verzia bez `effectiveFrom` neplatí, D6 —
 *     taký dokument sa nedá potvrdiť, aj keď v zozname vyzerá v poriadku.)
 *
 * Výpis ide na štandardný výstup, hlásenia na chybový.
 */

import { getCollection } from "../src/lib/mongodb.ts"

const ERR = "\x1b[31m✘\x1b[0m"

if (!process.env.MONGODB_URI) {
  console.error(`${ERR} Chýba MONGODB_URI (app/.env.local alebo export).`)
  console.error(`  set -a && . ./.env.local && set +a && npm run stav`)
  process.exit(1)
}

const p = await getCollection("persons")
const t = await getCollection("onboarding_tracks")
const d = await getCollection("documents")

const osoby = await p
  .find({}, { projection: { email: 1, companyCode: 1, tracks: 1, roles: 1, status: 1, lastLoginAt: 1 } })
  .toArray()

console.log(`PERSONS: ${osoby.length}`)
for (const o of osoby) {
  console.log(
    `  ${o.email} | ${o.companyCode} | stav=${o.status}` +
    ` | trasy=[${(o.tracks ?? []).join(",")}]` +
    ` | role=[${(o.roles ?? []).join(",")}]` +
    ` | posl. prihlásenie=${o.lastLoginAt ? new Date(o.lastLoginAt).toISOString() : "—"}`
  )
}

const trasy = await t.find({}).toArray()
console.log(`\nTRACKS: ${trasy.length}`)
for (const tr of trasy) {
  const kroky = (tr.steps ?? []).map(s => s.documentId ?? s.pageId).join(", ")
  console.log(`  ${tr.key} | ${tr.companyCode} | aktívna=${tr.isActive} | krokov=${(tr.steps ?? []).length} | ${kroky}`)
}

const doky = await d
  .find({}, { projection: { documentId: 1, title: 1, companyCode: 1, versions: 1 } })
  .toArray()

console.log(`\nDOCUMENTS: ${doky.length}`)
for (const dd of doky) {
  const vs = dd.versions ?? []
  // Platí len aktívna verzia s určeným `effectiveFrom` (D6). Dokument bez
  // takej verzie sa nedá potvrdiť — a to je najčastejšia tichá príčina,
  // prečo sa niečo v zozname neobjaví.
  const platne = vs.filter(v => v.isActive && v.effectiveFrom)
  const znak = platne.length > 0 ? " " : "!"
  console.log(`${znak} ${dd.documentId} | ${dd.companyCode ?? "—"} | verzií=${vs.length} | s platnosťou=${platne.length} | ${dd.title ?? ""}`)
}

console.log(`\n(! = dokument nemá platné znenie, nedá sa potvrdiť)`)
process.exit(0)
