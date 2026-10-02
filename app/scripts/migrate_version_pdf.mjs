/**
 * migrate_version_pdf.mjs — pôvodné PDF dokumentu k jeho platnému zneniu.
 *
 *     npm run files:version-pdf -- --company SFZ              náhľad
 *     npm run files:version-pdf -- --company SFZ --naozaj     zápis + audit
 *
 * Deväť pôvodných noriem SFZ prišlo 30. 8. 2026 ako ručne prevedený text
 * a ich PDF sa doplnilo skriptom k **dokumentu** (`documents.originalFile`,
 * `attach_original_files.mjs`). Súbory pri **znení** (`versions[].pdf`,
 * ADR-011) vtedy ešte neexistovali — a detail dokumentu aj potvrdzovanie
 * dnes čítajú PDF len zo znenia. Tlačidlo „Stiahnuť PDF" preto chýbalo
 * (Ján 1. 10. 2026, Volebný poriadok vs. Pracovný poriadok).
 *
 * **Čo robí:** pri dokumente, ktorý má `originalFile` typu PDF a ktorého
 * platné znenie PDF nemá, zapíše do toho znenia `pdf` — ten istý súbor
 * v úložisku (nekopíruje sa), s dopočítaným `sha256`. Zdrojový súbor
 * (`source`) nedopĺňa: `.docx` k týmto normám neexistuje.
 *
 * **Čo nerobí:** nemení text, `originalFile` ani existujúce potvrdenia.
 * Potvrdenia spred zápisu ostanú bez odtlačku PDF (D24); nové ho už ponesú.
 * Znenie, ktoré PDF má, preskočí — skript sa dá pustiť opakovane.
 */

import { createHash } from "node:crypto"
import { getCollection } from "../src/lib/mongodb.ts"
import { DOCUMENTS_COLLECTION, effectiveVersion } from "../src/lib/documents.ts"
import { loadFile } from "../src/lib/fileStore.ts"
import { writeAudit } from "../src/lib/audit.ts"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const args = process.argv.slice(2)
const val = (f) => {
  const i = args.indexOf(f)
  const v = i === -1 ? null : args[i + 1] ?? null
  return v && !v.startsWith("--") ? v.trim() : null
}
const company = val("--company")
const confirmed = args.includes("--naozaj")
const actor = val("--actor") ?? "script:migrate_version_pdf"

if (!company) {
  console.error(`${FAIL} Chýba --company (napr. --company SFZ)\n`)
  console.error("Použitie:")
  console.error("  npm run files:version-pdf -- --company SFZ            náhľad")
  console.error("  npm run files:version-pdf -- --company SFZ --naozaj   zápis a audit")
  process.exit(1)
}

try {
  const documents = await getCollection(DOCUMENTS_COLLECTION)
  const docs = await documents
    .find({ companyCode: company, "originalFile.type": "pdf" })
    .sort({ documentId: 1 })
    .toArray()

  let planned = 0, written = 0, failed = 0
  console.log("")
  for (const doc of docs) {
    const current = effectiveVersion(doc).version
    if (!current) {
      console.log(`  ${INFO} ${doc.documentId}: nemá platné znenie — preskočené`)
      continue
    }
    if (current.pdf) {
      console.log(`  ${INFO} ${doc.documentId}: znenie ${current.label ?? current.versionId} PDF už má — preskočené`)
      continue
    }

    const file = await loadFile(company, doc.originalFile.id)
    if (!file) {
      console.log(`  ${FAIL} ${doc.documentId}: súbor ${doc.originalFile.name} v úložisku nie je`)
      failed++
      continue
    }
    const sha256 = createHash("sha256").update(file.data).digest("hex")
    const label = current.label ?? current.versionId
    console.log(`  ${confirmed ? OK : INFO} ${doc.documentId.padEnd(38)} znenie ${label} ← ${doc.originalFile.name} (${Math.round(file.data.byteLength / 1024)} kB, sha256 ${sha256.slice(0, 12)}…)`)
    planned++
    if (!confirmed) continue

    const pdf = {
      id: doc.originalFile.id,
      name: doc.originalFile.name,
      bytes: file.data.byteLength,
      sha256,
      type: "pdf",
      uploadedAt: doc.originalFile.uploadedAt ?? new Date(),
      uploadedBy: doc.originalFile.uploadedBy ?? actor,
    }
    // Podmienka zopakuje, že znenie PDF nemá — keby ho medzitým niekto
    // nahral, neprepíše sa.
    const r = await documents.updateOne(
      { companyCode: company, documentId: doc.documentId },
      { $set: { "versions.$[v].pdf": pdf } },
      { arrayFilters: [{ "v.versionId": current.versionId, "v.pdf": { $exists: false } }] },
    )
    if (r.modifiedCount !== 1) {
      console.log(`    ${FAIL} zápis sa neuskutočnil (znenie medzitým PDF dostalo?)`)
      failed++
      continue
    }
    await writeAudit({
      companyCode: company,
      subject: "document",
      action: "changed",
      actor,
      targetId: doc.documentId,
      targetLabel: doc.title ?? doc.documentId,
      changes: { [`versions.${label}.pdf`]: { from: null, to: `${pdf.name} (sha256 ${sha256})` } },
      note: "Pôvodné PDF dokumentu pripojené k platnému zneniu (súbory pri znení, ADR-011). Text sa nemenil.",
    })
    written++
  }

  console.log("")
  if (!confirmed) {
    console.log(`${INFO} Náhľad — nič sa nezapísalo. ${planned} znení by dostalo PDF. Zapísať: pridaj --naozaj`)
  } else {
    console.log(`${OK} ${written} znení dostalo PDF, zapísané do auditu${failed ? `; ${failed} zlyhalo` : ""}`)
  }
  process.exit(failed ? 1 : 0)
} catch (e) {
  console.error(`${FAIL} ${e?.message ?? e}`)
  process.exit(1)
}
