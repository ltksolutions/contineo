/**
 * audit_chunks.mjs — ukáže, ako dobre chunker rozčlenil každý dokument.
 *
 *     node --env-file=.env.local scripts/audit_chunks.mjs
 *     node --env-file=.env.local scripts/audit_chunks.mjs --ukazky
 *
 * Smoke test odhalil, že articleRef a heading sedia len pri jednom dokumente.
 * Tento skript to premení z dojmu na čísla: koľko chunkov má rozpoznaný
 * článok, koľko rôznych nadpisov dokument má, a aké veľké sú chunky.
 *
 * Dokument, ktorý má 1 nadpis a 0 % článkov, chunker nerozpoznal vôbec —
 * celý spadol do jedného bloku a vyhľadávanie v ňom nemá čoho chytiť.
 *
 * Skript nič nemení — iba číta.
 */
import { MongoClient } from "mongodb"

const OK = "\x1b[32m✔\x1b[0m", BAD = "\x1b[31m✘\x1b[0m", WARN = "\x1b[33m▲\x1b[0m"
const samples = process.argv.includes("--ukazky")

if (!process.env.MONGODB_URI) {
  console.error(`${BAD} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("document_chunks")

  const rows = await col.aggregate([
    { $match: { isActive: true } },
    { $group: {
        _id: "$documentId",
        chunkov:     { $sum: 1 },
        sClankom:    { $sum: { $cond: [{ $and: [
                        { $ne: ["$articleRef", null] },
                        { $ne: ["$articleRef", ""] },
                      ] }, 1, 0] } },
        nadpisy:     { $addToSet: "$heading" },
        clanky:      { $addToSet: "$articleRef" },
        znakovMin:   { $min: { $strLenCP: "$text" } },
        znakovMax:   { $max: { $strLenCP: "$text" } },
        znakovPriem: { $avg: { $strLenCP: "$text" } },
    } },
    { $sort: { _id: 1 } },
  ]).toArray()

  console.log()
  console.log("dokument".padEnd(38) + "chunkov".padStart(8) + "s čl.".padStart(8) +
              "nadpisov".padStart(10) + "priem. zn.".padStart(12) + "  stav")
  console.log("─".repeat(88))

  let badCount = 0
  for (const r of rows) {
    const ratio = r.chunkov ? r.sClankom / r.chunkov : 0
    const headings = r.nadpisy.filter(Boolean).length
    // Dokument s jedným nadpisom a bez článkov chunker nerozobral.
    const broken  = ratio < 0.2 || headings <= 2
    const lukewarm = !broken && ratio < 0.8
    if (broken) badCount++
    const state = broken ? `${BAD} nerozobraný` : lukewarm ? `${WARN} čiastočne` : `${OK} v poriadku`
    console.log(
      String(r._id).padEnd(38) +
      String(r.chunkov).padStart(8) +
      `${Math.round(ratio * 100)} %`.padStart(8) +
      String(headings).padStart(10) +
      String(Math.round(r.znakovPriem)).padStart(12) +
      "  " + state
    )
  }

  console.log("─".repeat(88))
  console.log(`\n${rows.length} dokumentov · ${badCount} nerozobraných\n`)


  // ── Duplicity ──────────────────────────────────────────────────────────────
  // Smoke test ukázal ten istý chunk dvakrát vo výsledkoch. Príčina býva
  // v kolekcii `documents`: ak sú tam pre jeden documentId dva záznamy,
  // $lookup + $unwind zdvojí každý chunk. Overujeme obe strany.

  // Rozpis podľa typu — filter na preambuly stojí a padá na tomto poli.
  const byType = await col.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: "$chunkType", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]).toArray()
  console.log("Typy chunkov: " + byType.map(x => `${x._id ?? "(chýba)"}=${x.n}`).join(" · "))

  // Chunky bez článku, ktoré NIE SÚ označené ako preambula — tie prechádzajú
  // filtrom a tlačia sa do výsledkov.
  const suspicious = await col.find({
    isActive: true,
    $or: [{ articleRef: null }, { articleRef: "" }],
    chunkType: { $ne: "preambula" },
  }).project({ documentId: 1, heading: 1, chunkType: 1, chunkIndex: 1 }).limit(15).toArray()

  if (suspicious.length) {
    console.log(`\n${WARN} ${suspicious.length} chunkov bez článku, ktoré NIE SÚ preambuly:`)
    for (const c of suspicious) {
      console.log(`   ${c.documentId} #${c.chunkIndex} · typ=${c.chunkType ?? "(chýba)"} · "${(c.heading ?? "").slice(0, 50)}"`)
    }
  } else {
    console.log(`${OK} každý chunk bez článku je označený ako preambula`)
  }

  console.log("\nKontrola duplicít")
  console.log("─".repeat(88))

  const docDupes = await db.collection("documents").aggregate([
    { $group: { _id: "$documentId", n: { $sum: 1 }, verzie: { $addToSet: "$versionId" } } },
    { $match: { n: { $gt: 1 } } },
  ]).toArray()

  if (docDupes.length) {
    console.log(`${BAD} kolekcia documents má viacnásobné záznamy — TOTO zdvojuje výsledky:`)
    for (const d of docDupes) {
      console.log(`   ${d._id}: ${d.n} záznamov, verzie: ${d.verzie.join(", ")}`)
    }
  } else {
    console.log(`${OK} documents — každý documentId práve raz`)
  }

  const chunkDupes = await col.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: { d: "$documentId", i: "$chunkIndex" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: "spolu" },
  ]).toArray()

  const n = chunkDupes[0]?.spolu ?? 0
  console.log(n
    ? `${BAD} ${n} aktívnych chunkov má rovnaký documentId + chunkIndex`
    : `${OK} document_chunks — žiadne zdvojené aktívne chunky`)

  const byVersion = await col.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: "$documentId", verzie: { $addToSet: "$versionId" } } },
    { $match: { $expr: { $gt: [{ $size: "$verzie" }, 1] } } },
  ]).toArray()

  if (byVersion.length) {
    console.log(`${BAD} niektoré dokumenty majú aktívne chunky z VIACERÝCH verzií:`)
    for (const d of byVersion) console.log(`   ${d._id}: ${d.verzie.join(", ")}`)
  } else {
    console.log(`${OK} každý dokument má aktívne chunky len z jednej verzie`)
  }

  if (samples) {
    console.log("Ukážky nadpisov podľa dokumentu:\n")
    for (const r of rows) {
      const n = r.nadpisy.filter(Boolean)
      console.log(`  ${r._id}`)
      console.log(`    nadpisy (${n.length}): ${n.slice(0, 5).map(x => `"${x}"`).join(", ")}${n.length > 5 ? " …" : ""}`)
      const c = r.clanky.filter(Boolean)
      console.log(`    články (${c.length}): ${c.slice(0, 6).join(" · ") || "žiadne"}${c.length > 6 ? " …" : ""}`)
      console.log()
    }
  } else {
    console.log(`Podrobnosti o nadpisoch: --ukazky`)
  }

  if (badCount) {
    console.log(`\n${WARN} Nerozobrané dokumenty treba pozrieť v markdowne v app/data/vzorky/`)
    console.log(`   — pravdepodobne majú nadpisy článkov zapísané inak, než chunker očakáva.`)
  }

} catch (e) {
  console.error(`\n${BAD} ${e.message}`)
  process.exitCode = 1
} finally {
  await client.close()
}
