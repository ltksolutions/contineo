/**
 * dopln_povodne_subory.mjs — pripojí pôvodné PDF k normám z importu (D53).
 *
 * Deväť noriem SFZ sa do systému dostalo príkazovým riadkom ako `.md` súbory,
 * ktoré vznikli ručným prevodom z PDF. Samotné PDF pritom máme — sú v
 * `data/vzorky/`. Bez nich sa v editore nedá porovnať text s originálom
 * a v detaile svieti „bez pôvodného súboru".
 *
 * **Text sa nedotýka.** Toto pripája súbor, nie prevádza dokument: markdown
 * v databáze je odladený a nahradiť ho novým prevodom by znamenalo zmenu
 * znenia bez toho, aby ju niekto chcel.
 *
 * Priradenie je **vypísané ručne**, nie hádané z názvu súboru. Názov je
 * náhodný artefakt (rovnaká zásada ako pri metadátach) a uhádnuté priradenie
 * by pripojilo cudzie PDF k norme — čo je horšie než žiadne.
 *
 *     node --env-file=.env.local scripts/dopln_povodne_subory.mjs
 *     node --env-file=.env.local scripts/dopln_povodne_subory.mjs --zapis
 */

import { readFileSync, existsSync, statSync } from "node:fs"
import { join } from "node:path"
import { MongoClient, GridFSBucket } from "mongodb"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const WRITE = process.argv.includes("--zapis")
const FOLDER = "data/vzorky"

/** documentId → názov pôvodného PDF. Ručne, nie podľa podobnosti názvov. */
const MAPPING = {
  "sfz:disciplinarny_poriadok": "Disciplinárny poriadok SFZ.pdf",
  "sfz:organizacny_navstevny_poriadok": "Organizačný a návštevný poriadok.pdf",
  "sfz:poriadok_komory_sporov": "Poriadok komory pre riešenie sporov.pdf",
  "sfz:registracny_prestupovy_poriadok": "Registračný a prestupový poriadok SFZ.pdf",
  "sfz:revizny_poriadok": "Revízny poriadok.pdf",
  "sfz:rokovaci_poriadok_konferencie": "Rokovací poriadok Konferencie SFZ.pdf",
  "sfz:stanovy": "STANOVY Slovenského futbalového zväzu.pdf",
  "sfz:sutazny_poriadok": "Súťažný poriadok futbalu SFZ.pdf",
  "sfz:volebny_poriadok": "Volebný poriadok SFZ.pdf",
}

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI.`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const db = client.db(process.env.MONGODB_DB ?? "contineo")
const docCol = db.collection("documents")
const bucket = new GridFSBucket(db, { bucketName: "cms_files" })

let added = 0
let skipped = 0
let missing = 0

console.log("")
for (const [documentId, fileName] of Object.entries(MAPPING)) {
  const doc = await docCol.findOne({ documentId })
  if (!doc) {
    console.log(`  ${FAIL} ${documentId}: dokument v databáze nie je`)
    missing++
    continue
  }
  if (doc.originalFile) {
    console.log(`  ${INFO} ${documentId}: pôvodný súbor už má (${doc.originalFile.nazov})`)
    skipped++
    continue
  }

  const path = join(FOLDER, fileName)
  if (!existsSync(path)) {
    console.log(`  ${FAIL} ${documentId}: chýba ${path}`)
    missing++
    continue
  }

  const bytes = statSync(path).size
  console.log(`  ${WRITE ? OK : INFO} ${documentId.padEnd(38)} ← ${fileName} (${Math.round(bytes / 1024)} kB)`)
  if (!WRITE) { added++; continue }

  const data = readFileSync(path)
  const stream = bucket.openUploadStream(fileName, {
    contentType: "application/pdf",
    metadata: {
      companyCode: doc.companyCode,
      aktor: "script:dopln_povodne_subory",
      nahraneKedy: new Date(),
    },
  })
  await new Promise((done, failed) => {
    stream.on("error", failed)
    stream.on("finish", done)
    stream.end(data)
  })

  await docCol.updateOne({ documentId }, {
    $set: {
      originalFile: {
        id: String(stream.id),
        nazov: fileName,
        contentType: "application/pdf",
        bajtov: data.byteLength,
        typ: "pdf",
        nahraneKedy: new Date(),
        nahralKto: "script:dopln_povodne_subory",
      },
      // Poctivo: markdown v databáze nevznikol týmto prevodom, ale ručne
      // pred zavedením knižnice. Tvrdiť opak by znamenalo, že sa o rok nedá
      // zistiť, prečo sa text a nový prevod toho istého PDF líšia.
      konverzia: {
        sposob: "ručný prevod pred zavedením knižnice; PDF doplnené dodatočne",
        upozornenia: [
          "Text nevznikol automatickým prevodom tohto PDF — porovnaj ho s originálom.",
        ],
        kedy: new Date(),
      },
    },
  })
  added++
}

console.log(
  `\n${WRITE ? OK : INFO} ${WRITE ? "doplnených" : "doplnilo by sa"}: ${added}` +
  `${skipped ? ` · preskočených: ${skipped}` : ""}` +
  `${missing ? ` · chýbajúcich: ${missing}` : ""}`,
)
if (!WRITE) console.log(`${INFO} nasucho — nič sa nezapísalo. Zápis: rovnaký príkaz s --zapis\n`)
else console.log("")

await client.close()
