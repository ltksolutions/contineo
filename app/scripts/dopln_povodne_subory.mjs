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

const OK = "\x1b[32m✔\x1b[0m", CHYBA = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const ZAPIS = process.argv.includes("--zapis")
const PRIECINOK = "data/vzorky"

/** documentId → názov pôvodného PDF. Ručne, nie podľa podobnosti názvov. */
const PRIRADENIE = {
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
  console.error(`${CHYBA} Chýba MONGODB_URI.`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const db = client.db(process.env.MONGODB_DB ?? "contineo")
const kolDoc = db.collection("documents")
const bucket = new GridFSBucket(db, { bucketName: "cms_files" })

let doplnenych = 0
let preskocenych = 0
let chybajucich = 0

console.log("")
for (const [documentId, nazovSuboru] of Object.entries(PRIRADENIE)) {
  const doc = await kolDoc.findOne({ documentId })
  if (!doc) {
    console.log(`  ${CHYBA} ${documentId}: dokument v databáze nie je`)
    chybajucich++
    continue
  }
  if (doc.originalFile) {
    console.log(`  ${INFO} ${documentId}: pôvodný súbor už má (${doc.originalFile.nazov})`)
    preskocenych++
    continue
  }

  const cesta = join(PRIECINOK, nazovSuboru)
  if (!existsSync(cesta)) {
    console.log(`  ${CHYBA} ${documentId}: chýba ${cesta}`)
    chybajucich++
    continue
  }

  const bajtov = statSync(cesta).size
  console.log(`  ${ZAPIS ? OK : INFO} ${documentId.padEnd(38)} ← ${nazovSuboru} (${Math.round(bajtov / 1024)} kB)`)
  if (!ZAPIS) { doplnenych++; continue }

  const data = readFileSync(cesta)
  const prud = bucket.openUploadStream(nazovSuboru, {
    contentType: "application/pdf",
    metadata: {
      companyCode: doc.companyCode,
      aktor: "script:dopln_povodne_subory",
      nahraneKedy: new Date(),
    },
  })
  await new Promise((hotovo, chyba) => {
    prud.on("error", chyba)
    prud.on("finish", hotovo)
    prud.end(data)
  })

  await kolDoc.updateOne({ documentId }, {
    $set: {
      originalFile: {
        id: String(prud.id),
        nazov: nazovSuboru,
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
  doplnenych++
}

console.log(
  `\n${ZAPIS ? OK : INFO} ${ZAPIS ? "doplnených" : "doplnilo by sa"}: ${doplnenych}` +
  `${preskocenych ? ` · preskočených: ${preskocenych}` : ""}` +
  `${chybajucich ? ` · chýbajúcich: ${chybajucich}` : ""}`,
)
if (!ZAPIS) console.log(`${INFO} nasucho — nič sa nezapísalo. Zápis: rovnaký príkaz s --zapis\n`)
else console.log("")

await client.close()
