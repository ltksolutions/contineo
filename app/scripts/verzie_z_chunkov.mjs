/**
 * verzie_z_chunkov.mjs — doplní `versions[]` dokumentom, ktoré prišli importom.
 *
 * Deväť noriem SFZ prišlo cez RAG import (`import.mjs`): dokument nesie
 * `versionId` navrchu, text žije v `document_chunks` a `versions[]` nemá vôbec.
 * Pre vyhľadávanie to stačilo. Pre potvrdzovanie nie — `effectiveVersion()`
 * číta výhradne `versions[]` (D6, D25), takže taký dokument je v onboardingu
 * „bez platného znenia" a nikto ho potvrdiť nemôže.
 *
 * Skript si nič nevymýšľa:
 *
 *   - verzii ponechá **ten istý `versionId`**, aký má dokument aj jeho chunky.
 *     Potvrdenie sa tým viaže presne na to znenie, z ktorého systém odpovedá;
 *     iné číslo by vytvorilo druhú pravdu o tom istom texte;
 *   - text poskladá z chunkov v poradí `chunkIndex`. Chunky sa neprekrývajú —
 *     sú to články, každý uvedený hlavičkou „Dokument › Článok N - Nadpis",
 *     ktorá je tam kvôli vyhľadávaniu. Pri súvislom čítaní zavadzia, tak sa
 *     odstráni a nahradí nadpisom;
 *   - dátum platnosti **nedopĺňa odhadom**. Musí ho zadať človek (D6, D25).
 *
 * Predvolene nič nezapisuje.
 *
 *   npm run verzie                                # ukáže, čo by spravil
 *   npm run verzie -- --od 2026-01-01 --zapis     # zapíše
 */

import { MongoClient } from "mongodb"
import { addVersion, loadDocument } from "../src/lib/documents.ts"

const OK = "\x1b[32m✓\x1b[0m"
const CHYBA = "\x1b[31m✗\x1b[0m"

function arg(meno) {
  const i = process.argv.indexOf(meno)
  return i === -1 ? null : process.argv[i + 1] ?? null
}
const ZAPIS = process.argv.includes("--zapis")
const LEN = arg("--doc")
const LABEL = arg("--label") ?? "1.0"
const OD = arg("--od")

if (ZAPIS && !OD) {
  console.error(`${CHYBA} Zápis bez --od nedáva zmysel: verzia bez dátumu platnosti neplatí (D6).`)
  process.exit(1)
}
const datum = OD ? new Date(`${OD}T00:00:00.000Z`) : null
if (OD && Number.isNaN(datum.getTime())) {
  console.error(`${CHYBA} --od ${OD} nie je dátum. Očakáva sa RRRR-MM-DD.`)
  process.exit(1)
}

/** Hlavička „Dokument › Článok 1 - Nadpis" na začiatku chunku. */
function bezHlavicky(text) {
  const i = text.indexOf("\n\n")
  if (i !== -1 && i < 240 && text.slice(0, i).includes("›")) return text.slice(i + 2)
  return text
}

function zlozMarkdown(chunky) {
  const casti = []
  let posledny = null
  for (const ch of chunky) {
    const nadpis = [ch.articleRef, ch.heading].filter(Boolean).join(" — ")
    if (nadpis && nadpis !== posledny) {
      casti.push(`## ${nadpis}`)
      posledny = nadpis
    }
    const t = bezHlavicky(ch.text ?? "").trim()
    if (t) casti.push(t)
  }
  return casti.join("\n\n").trim()
}

const klient = new MongoClient(process.env.MONGODB_URI)
await klient.connect()
const db = klient.db(process.env.MONGODB_DB ?? "contineo")

const filter = { versionId: { $exists: true }, versions: { $exists: false } }
if (LEN) filter.documentId = LEN
const dokumenty = await db.collection("documents").find(filter).sort({ documentId: 1 }).toArray()

if (dokumenty.length === 0) {
  console.log("Žiadny dokument bez `versions[]`. Niet čo doplniť.")
  await klient.close()
  process.exit(0)
}

console.log(ZAPIS
  ? `Zapisujem znenie platné od ${OD}, označenie „${LABEL}".\n`
  : `Skúška nasucho — nič sa nemení. Zápis: --od RRRR-MM-DD --zapis\n`)

let hotovo = 0
for (const d of dokumenty) {
  const chunky = await db.collection("document_chunks")
    .find({ documentId: d.documentId, versionId: d.versionId })
    .project({ chunkIndex: 1, text: 1, heading: 1, articleRef: 1 })
    .sort({ chunkIndex: 1 })
    .toArray()

  if (chunky.length === 0) {
    console.log(`${CHYBA} ${d.documentId}: k verzii ${d.versionId} nie sú chunky — preskakujem`)
    continue
  }

  const markdown = zlozMarkdown(chunky)
  console.log(`${d.documentId}`)
  console.log(`   verzia ${d.versionId} · ${chunky.length} chunkov · ${markdown.length} znakov`)
  console.log(`   začiatok: ${JSON.stringify(markdown.slice(0, 90))}`)

  if (!ZAPIS) { hotovo++; continue }

  await addVersion(d.documentId, {
    versionId: d.versionId,
    label: LABEL,
    effectiveFrom: datum,
    effectiveTo: null,
    isActive: true,
    markdown,
    changeNote: `Znenie poskladané z indexovaných chunkov verzie ${d.versionId}.`,
    publishedAt: new Date(),
    publishedBy: "verzie_z_chunkov.mjs",
  })

  const po = await loadDocument(d.documentId)
  const n = (po?.versions ?? []).length
  console.log(n === 1 ? `   ${OK} zapísané` : `   ${CHYBA} po zápise má ${n} verzií — pozri sa na to`)
  hotovo++
}

console.log(`\n${hotovo}/${dokumenty.length} ${ZAPIS ? "zapísaných" : "pripravených"}.`)
await klient.close()
