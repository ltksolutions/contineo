/**
 * seed_version_test.mjs — pripraví koncept ďalšieho znenia skúšobného
 * dokumentu `sfz:test_znenia` (plán „znenia v indexe", krok 8).
 *
 *     npm run seed:versions -- --znenie 1.0 --subory ~/Downloads/contineo_test_znenia            náhľad
 *     npm run seed:versions -- --znenie 1.0 --subory ~/Downloads/contineo_test_znenia --zapis    koncept
 *
 * **Skript pripravuje, nezverejňuje.** Nahrá PDF a Word cez `uploadDocument()`
 * (tá istá cesta ako obrazovka „Nahrať dokument", s auditom), vyplní údaje
 * o znení a zodpovednú osobu. Predložiť, schváliť a zverejniť musí človek na
 * karte dokumentu — `publish()` neschválené znenie odmietne (D73) a schválenie
 * v mene niekoho, kto nič neklikol, by bol falošný dôkazný záznam (rozhodol
 * Ján 2026-09-29).
 *
 * Znenia idú za sebou: koncept 2.0 sa dá pripraviť až po zverejnení 1.0.
 *
 * | znenie | účinné od  | zmena                                  |
 * |--------|------------|----------------------------------------|
 * | 1.0    | 1. 1. 2024 | východiskové, čl. 1–6                   |
 * | 2.0    | 1. 7. 2026 | čl. 2 lehota 15 → 30 dní, + čl. 7, − čl. 5 |
 * | 3.0    | 1. 1. 2027 | čl. 4 poplatok 50 → 80 eur (novela vopred) |
 *
 * Súbory `skusobny_poriadok_<znenie>.pdf` a `.docx` sú mimo repozitára.
 */

import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { uploadDocument, saveDraftResponsible } from "../src/lib/libraryWrite.ts"
import { getCollection } from "../src/lib/mongodb.ts"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents.ts"
import { PERSONS_COLLECTION } from "../src/lib/persons.ts"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const COMPANY = "SFZ"
const DOCUMENT_ID = "sfz:test_znenia"
const RESPONSIBLE_EMAIL = "jan.letko@futbalsfz.sk"
const VERSIONS = {
  "1.0": { effectiveFrom: new Date(Date.UTC(2024, 0, 1)) },
  "2.0": { effectiveFrom: new Date(Date.UTC(2026, 6, 1)) },
  "3.0": { effectiveFrom: new Date(Date.UTC(2027, 0, 1)) },
}

const args = process.argv.slice(2)
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined }
const label = val("--znenie")
const dir = (val("--subory") ?? "").replace(/^~/, process.env.HOME ?? "~")
const write = args.includes("--zapis")

if (!VERSIONS[label] || !dir) {
  console.error(`${FAIL} Použitie: npm run seed:versions -- --znenie 1.0|2.0|3.0 --subory <priečinok> [--zapis]`)
  process.exit(1)
}

try {
  const pdfPath = join(dir, `skusobny_poriadok_${label}.pdf`)
  const docxPath = join(dir, `skusobny_poriadok_${label}.docx`)
  for (const p of [pdfPath, docxPath]) {
    if (!existsSync(p)) throw new Error(`chýba súbor ${p}`)
  }

  const docs = await getCollection(DOCUMENTS_COLLECTION)
  const existing = await docs.findOne({ companyCode: COMPANY, documentId: DOCUMENT_ID })
  if (existing && !String(existing.title ?? "").startsWith("Skúšobný poriadok")) {
    throw new Error(`${DOCUMENT_ID} existuje a nevyzerá ako skúšobný — nesiaham naň`)
  }
  const published = (existing?.versions ?? []).map(v => v.effectiveFrom?.toISOString().slice(0, 10))
  const wanted = VERSIONS[label].effectiveFrom.toISOString().slice(0, 10)
  if (published.includes(wanted)) {
    console.log(`${OK} znenie ${label} (účinné od ${wanted}) je už zverejnené — niet čo robiť`)
    process.exit(0)
  }
  const previous = Object.keys(VERSIONS).filter(k => k < label)
  const missing = previous.filter(k => !published.includes(VERSIONS[k].effectiveFrom.toISOString().slice(0, 10)))
  if (missing.length) throw new Error(`najprv treba zverejniť znenie ${missing.join(", ")}`)

  const persons = await getCollection(PERSONS_COLLECTION)
  const responsible = await persons.findOne({ companyCode: COMPANY, email: RESPONSIBLE_EMAIL }, { projection: { id: 1 } })
  if (!responsible?.id) throw new Error(`zodpovedná osoba ${RESPONSIBLE_EMAIL} tu nie je`)

  console.log(`${INFO} ${DOCUMENT_ID}: ${existing ? `${published.length} zverejnené znenia` : "nový dokument"}`)
  console.log(`${INFO} koncept znenia ${label}, účinné od ${wanted}, zodpovedná osoba ${RESPONSIBLE_EMAIL}`)
  console.log(`    ${pdfPath}\n    ${docxPath}`)
  if (!write) {
    console.log(`\n${INFO} Náhľad — nič sa nezapísalo. Zapísať: pridaj --zapis`)
    process.exit(0)
  }

  const r = await uploadDocument(
    {
      title: "Skúšobný poriadok (znenia v indexe)",
      documentKey: "test_znenia",
      sectionKey: "",
      companyCode: COMPANY,
      scope: "company",
      accessLevel: "internal",
      language: "sk",
      category: "norma",
      tags: ["test"],
    },
    {
      pdf: { name: `skusobny_poriadok_${label}.pdf`, data: readFileSync(pdfPath) },
      source: { name: `skusobny_poriadok_${label}.docx`, data: readFileSync(docxPath) },
    },
    RESPONSIBLE_EMAIL,
    existing ? "version" : "new",
    { author: "Contineo — skúšobný dokument", approvedBy: null, approvedOn: null, effectiveFrom: VERSIONS[label].effectiveFrom },
  )
  await saveDraftResponsible(COMPANY, DOCUMENT_ID, responsible.id, RESPONSIBLE_EMAIL)

  console.log(`${OK} koncept pripravený (${r.markdown.length} znakov textu${r.warnings.length ? `; upozornenia: ${r.warnings.join(" · ")}` : ""})`)
  console.log(`${INFO} Ďalej na karte dokumentu: Uložiť a predložiť → schváliť → Zverejniť.`)
  console.log(`    https://intranet.futbalsfz.sk/library/${encodeURIComponent(DOCUMENT_ID)}`)
  process.exit(0)
} catch (e) {
  console.error(`${FAIL} ${e?.message ?? e}`)
  process.exit(1)
}
