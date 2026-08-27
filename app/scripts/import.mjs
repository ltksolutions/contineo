/**
 * import.mjs — naimportuje dokument(y) do MongoDB.
 *
 *     node --env-file=.env.local scripts/import.mjs data/vzorky/revizny_poriadok.md
 *     node --env-file=.env.local scripts/import.mjs data/vzorky/*.md
 *     node --env-file=.env.local scripts/import.mjs data/vzorky/*.md --nasucho
 *
 * Čo robí:
 *   1. načíta .md + .meta.json (metadáta NIKDY z názvu súboru)
 *   2. zvaliduje tagy proti číselníkom — čo tam nie je, neprejde
 *   3. rozseká na chunky (D1: štruktúrne po článkoch, breadcrumb v texte)
 *   4. zapíše `documents` + `document_chunks`
 *
 * Verzovanie (D6): pri opakovanom importe sa staré chunky NEMAŽÚ, len
 * dostanú `isActive: false`. Do RAG dotazu vstupujú len aktívne.
 *
 * Vektory pri cloudovom režime NEZAPISUJEME — Automated Embedding si ich
 * Atlas vyrobí sám z poľa `text` a drží ich v oddelenej internej kolekcii.
 * Zapisujeme len metadáta o modeli, aby fungoval embeddingGuard.
 */
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { MongoClient } from "mongodb"
import { chunkuj, odhadTokenov } from "./lib/chunker.mjs"
import { nacitajMeta, nacitajCiselnik } from "./lib/meta.mjs"

const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? "contineo"
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "voyage-4"
const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM ?? 1024)
const EMBEDDING_KIND = process.env.EMBEDDING_KIND ?? "atlas-auto"

const OK = "\x1b[32m✔\x1b[0m", CHYBA = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const args = process.argv.slice(2)
const nasucho = args.includes("--nasucho")
const subory = args.filter(a => !a.startsWith("--"))

if (!subory.length) {
  console.error("Použitie: node --env-file=.env.local scripts/import.mjs <subor.md…> [--nasucho]")
  process.exit(1)
}
if (!URI && !nasucho) {
  console.error(`${CHYBA} Chýba MONGODB_URI (alebo použi --nasucho).`)
  process.exit(1)
}

const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16)

/** Stabilný identifikátor dokumentu — nezávislý od názvu súboru. */
const idDokumentu = (meta) => `${meta.companyCode}:${meta.sectionKey}`.toLowerCase()

function pripravDokument(subor) {
  const meta = nacitajMeta(subor)

  // Tagy sa validujú zvlášť — je to pole, nie skalár.
  const cTags = nacitajCiselnik("tags")
  const tags = Array.isArray(meta.tags) ? meta.tags : []
  const zleTagy = cTags ? tags.filter(t => !cTags.kluce.has(t)) : []
  if (zleTagy.length) {
    throw new Error(`${subor}: tagy mimo číselníka: ${zleTagy.join(", ")}`)
  }

  const text = readFileSync(subor, "utf8")
  const { chunky, statistiky } = chunkuj(text, { nazovDokumentu: meta.title })
  if (!chunky.length) throw new Error(`${subor}: nevznikol ani jeden chunk`)

  const documentId = idDokumentu(meta)
  /**
   * Verzia sa počíta z VÝSLEDNÝCH CHUNKOV, nie zo zdrojového textu.
   *
   * Pôvodne to bol hash zdroja — a to bola chyba: keď sme opravili chunker
   * tak, aby rozpoznal dvojriadkový nadpis článku, obsah súborov sa nezmenil,
   * takže import všetko preskočil a v databáze ostalo staré zlé členenie.
   * Zmena chunkovacieho algoritmu je pritom rovnako podstatná zmena ako
   * zmena textu normy.
   *
   * Hashuje sa PRESNE TO, čo sa zapíše do databázy (viď `chunkDoDb`),
   * takže každé nové pole sa do verzie premietne samo.
   */
  const predbezne = { meta, tags }
  const otlacok = JSON.stringify(chunky.map(ch => chunkDoDb(ch, predbezne)))
  const versionId = hash(otlacok)

  return { subor, meta, tags, chunky, statistiky, documentId, versionId, markdown: text }
}

/**
 * Prevedie chunk na dokument tak, ako sa uloží do `document_chunks` —
 * bez polí, ktoré sa menia pri každom behu (časy, versionId).
 *
 * Otlačok pre `versionId` sa počíta PRÁVE Z TOHTO. Dvakrát nás totiž
 * doplatilo, že sa hashovalo niečo iné, než sa ukladá:
 *
 *   1× hash zo zdrojového textu → oprava chunkera sa neprejavila
 *   1× hash z vybraných polí   → pridanie chunkType sa neprejavilo
 *
 * Takto sa každé nové pole premietne do verzie samo a nedá sa naň zabudnúť.
 */
function chunkDoDb(ch, d) {
  return {
    chunkIndex: ch.chunkIndex,
    text: ch.text,                    // <- Atlas z tohto poľa robí vektor
    heading: ch.heading,
    articleRef: ch.articleRef ?? null,
    /**
     * "clanok" | "priloha" | "preambula"
     *
     * Preambula je titulná strana, zoznam novelizácií a osnova. Necháme ju
     * v databáze — obsahuje dátumy schválenia, ktoré sú potrebné pri
     * posudzovaní platného znenia (R3) — ale vyhľadávanie ju preskakuje.
     * Sémanticky sa totiž podobá na hocijakú otázku o danej doméne a
     * vytláčala z výsledkov skutočné články.
     */
    chunkType: ch.typ ?? "clanok",
    // tagovanie / filtre
    sectionKey: d.meta.sectionKey, companyCode: d.meta.companyCode,
    scope: d.meta.scope, accessLevel: d.meta.accessLevel,
    language: d.meta.language, tags: d.tags,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDim: EMBEDDING_DIM,
    embeddingProvider: EMBEDDING_KIND,
  }
}

/**
 * Doplní záznam do `documents.versions[]` (D25).
 *
 * **Zmena obsahu = nová položka, nikdy prepis.** Predchádzajúcej otvorenej
 * verzii sa doplní `effectiveTo` — ale len vtedy, keď nová verzia platnosť
 * vôbec má; inak by dokument ostal bez platného znenia kvôli niečomu, čo ešte
 * nikto neschválil.
 *
 * Idempotentné podľa `versionId`: opakovaný beh históriu nezdvojí.
 *
 * > **Známy rozpor s D25, pravidlo 2.** Rozhodnutie hovorí, že kanál nikdy
 * > nezneplatní platnú verziu sám — nová má prísť `isActive:false` a platnosť
 * > jej má určiť kurátor. Tento import ale publikuje priamo (`status:
 * > "published"`), lebo kurátorské rozhranie zatiaľ neexistuje (Fáza 4).
 * > Zapisujeme preto stav taký, aký naozaj je, a nepredstierame schválenie.
 * > Zosúladiť pri review UI — vedené v `docs/TODO.md` sekcii I.
 */
async function dopisVerziu(kolDoc, d, teraz) {
  const ma = await kolDoc.findOne({
    documentId: d.documentId, "versions.versionId": d.versionId,
  })
  if (ma) return

  const platnaOd = d.meta.effectiveFrom ?? null

  if (platnaOd) {
    await kolDoc.updateOne(
      { documentId: d.documentId },
      { $set: { "versions.$[stara].effectiveTo": platnaOd, "versions.$[stara].isActive": false } },
      { arrayFilters: [{ "stara.effectiveTo": null, "stara.versionId": { $ne: d.versionId } }] }
    )
  }

  await kolDoc.updateOne(
    { documentId: d.documentId },
    {
      $push: {
        versions: {
          versionId: d.versionId,
          // Ľudské označenie zatiaľ nemáme — meta ho nenesie. Otlačok obsahu
          // je aspoň jednoznačný; kurátor ho premenuje, keď bude čím.
          label: d.meta.version ?? d.versionId,
          effectiveFrom: platnaOd,
          effectiveTo: d.meta.effectiveTo ?? null,
          isActive: true,
          contentHash: d.versionId,
          // Text znenia patrí k verzii, nie len na dokument: človek musí
          // čítať tú verziu, ktorú potvrdzuje, nie tú najnovšiu.
          markdown: d.markdown,
          // `requiresReacknowledgement` sa zámerne NEnastavuje: vypĺňa ho
          // človek (D30) a `false` by bolo tiché rozhodnutie, že zmena nie je
          // podstatná. Chýbajúce pole znamená „nikto zatiaľ nerozhodol".
          publishedAt: teraz,
          publishedBy: "import.mjs",
        },
      },
    },
    { upsert: false }
  )
}

async function zapis(db, d) {
  const kolDoc = db.collection("documents")
  const kolChunk = db.collection("document_chunks")
  const teraz = new Date()

  // Rovnaký obsah už naimportovaný? Chunky sa nedotýkame — import je idempotentný.
  const existuje = await kolDoc.findOne({ documentId: d.documentId, versionId: d.versionId })
  if (existuje) {
    // Dokumentu, ktorý vznikol pred zavedením `versions[]` (D25), sa záznam
    // o verzii doplní aj tak. Bez neho sa nedá potvrdiť oboznámenie, lebo
    // potvrdenie sa viaže na verziu, nie na dokument.
    await dopisVerziu(kolDoc, d, teraz)
    return { preskocene: true, deaktivovane: 0, vlozene: 0 }
  }

  // Nová verzia — staré chunky archivujeme, NEMAŽEME (D6).
  const deakt = await kolChunk.updateMany(
    { documentId: d.documentId, isActive: true },
    { $set: { isActive: false, effectiveTo: teraz } }
  )

  await kolDoc.updateOne(
    { documentId: d.documentId },
    {
      $set: {
        documentId: d.documentId, versionId: d.versionId,
        title: d.meta.title, slug: d.documentId.replace(/[:]/g, "-"),
        sectionKey: d.meta.sectionKey, companyCode: d.meta.companyCode,
        scope: d.meta.scope, accessLevel: d.meta.accessLevel,
        language: d.meta.language, category: d.meta.category,
        sourceType: d.meta.sourceType, sourceUrl: d.meta.sourceUrl ?? null,
        tags: d.tags,
        effectiveFrom: d.meta.effectiveFrom ?? null,
        effectiveTo: d.meta.effectiveTo ?? null,
        status: "published", processingStatus: "indexed",
        updatedAt: teraz,
      },
      $setOnInsert: { createdAt: teraz },
    },
    { upsert: true }
  )

  await dopisVerziu(kolDoc, d, teraz)

  const dokumenty = d.chunky.map(ch => ({
    ...chunkDoDb(ch, d),
    // Premenlivé polia — zámerne MIMO chunkDoDb, aby nekazili otlačok.
    documentId: d.documentId, versionId: d.versionId,
    embeddedAt: teraz,
    // stav
    isActive: true,
    effectiveFrom: d.meta.effectiveFrom ?? null,
    effectiveTo: null,
    createdAt: teraz,
  }))

  await kolChunk.insertMany(dokumenty, { ordered: false })
  return { preskocene: false, deaktivovane: deakt.modifiedCount, vlozene: dokumenty.length }
}

// ── beh ──────────────────────────────────────────────────────────────────────
const pripravene = []
let chyb = 0
const preskocene = []
const davka = subory.length > 1

for (const s of subory) {
  try {
    const d = pripravDokument(s)
    pripravene.push(d)
    const t = d.chunky.map(c => odhadTokenov(c.text))
    console.log(`${OK} ${d.meta.title}`)
    console.log(`    ${d.chunky.length} chunkov · ${Math.min(...t)}–${Math.max(...t)} tokenov · ` +
                `${d.statistiky.priloh} príloh · verzia ${d.versionId}`)
  } catch (e) {
    // V dávke je súbor bez metadát skoro vždy cudzí (README a pod.) —
    // preskočíme ho. Pri jednom výslovne zadanom súbore je to chyba.
    const chybaMeta = e.message.startsWith("Chýba súbor s metadátami")
    if (davka && chybaMeta) {
      preskocene.push(s)
      console.log(`${INFO} ${s} — bez .meta.json, preskakujem`)
    } else {
      chyb++
      console.error(`${CHYBA} ${e.message}`)
    }
  }
}

if (chyb) {
  console.error(`\n${CHYBA} ${chyb} dokument(ov) neprešlo — nič sa nezapísalo.`)
  process.exit(1)
}

const spolu = pripravene.reduce((n, d) => n + d.chunky.length, 0)
console.log(`\nSpolu: ${pripravene.length} dokumentov, ${spolu} chunkov`)

if (preskocene.length) {
  // Vypisujeme menovite — pri väčšej dávke sa jednotlivé riadky odrolujú
  // a zabudnuté .meta.json pri skutočnom dokumente by tak prešlo bez povšimnutia.
  console.log(`\n${INFO} Preskočené (${preskocene.length}) — bez .meta.json:`)
  for (const s of preskocene) console.log(`    ${s}`)
  console.log(`    Ak niektorý z nich MÁ byť v korpuse, vytvor mu metadáta:`)
  console.log(`    node scripts/chunk_preview.mjs <subor.md> --vytvor-meta`)
}

if (nasucho) {
  console.log(`${INFO} --nasucho: do databázy sa nezapisovalo.`)
  process.exit(0)
}

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })
try {
  await client.connect()
  const db = client.db(DB)
  console.log()
  let vlozeneSpolu = 0
  for (const d of pripravene) {
    const r = await zapis(db, d)
    if (r.preskocene) {
      console.log(`${INFO} ${d.meta.title} — rovnaká verzia už je v DB, preskakujem`)
    } else {
      vlozeneSpolu += r.vlozene
      const arch = r.deaktivovane ? `, ${r.deaktivovane} starých archivovaných` : ""
      console.log(`${OK} ${d.meta.title} — ${r.vlozene} chunkov${arch}`)
    }
  }
  console.log(`\n${OK} Zapísaných ${vlozeneSpolu} chunkov.`)
  if (vlozeneSpolu) {
    console.log(`${INFO} Automated Embedding generuje vektory asynchrónne —`)
    console.log(`    kým nedobehne, vyhľadávanie ich ešte nenájde.`)
  }
} catch (e) {
  console.error(`\n${CHYBA} ${e.message}`)
  process.exitCode = 1
} finally {
  await client.close()
}
