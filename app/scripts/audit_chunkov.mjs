/**
 * audit_chunkov.mjs — ukáže, ako dobre chunker rozčlenil každý dokument.
 *
 *     node --env-file=.env.local scripts/audit_chunkov.mjs
 *     node --env-file=.env.local scripts/audit_chunkov.mjs --ukazky
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

const OK = "\x1b[32m✔\x1b[0m", ZLE = "\x1b[31m✘\x1b[0m", VARUJ = "\x1b[33m▲\x1b[0m"
const ukazky = process.argv.includes("--ukazky")

if (!process.env.MONGODB_URI) {
  console.error(`${ZLE} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("document_chunks")

  const riadky = await col.aggregate([
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

  let zlych = 0
  for (const r of riadky) {
    const podiel = r.chunkov ? r.sClankom / r.chunkov : 0
    const nadpisov = r.nadpisy.filter(Boolean).length
    // Dokument s jedným nadpisom a bez článkov chunker nerozobral.
    const zle  = podiel < 0.2 || nadpisov <= 2
    const vlazne = !zle && podiel < 0.8
    if (zle) zlych++
    const stav = zle ? `${ZLE} nerozobraný` : vlazne ? `${VARUJ} čiastočne` : `${OK} v poriadku`
    console.log(
      String(r._id).padEnd(38) +
      String(r.chunkov).padStart(8) +
      `${Math.round(podiel * 100)} %`.padStart(8) +
      String(nadpisov).padStart(10) +
      String(Math.round(r.znakovPriem)).padStart(12) +
      "  " + stav
    )
  }

  console.log("─".repeat(88))
  console.log(`\n${riadky.length} dokumentov · ${zlych} nerozobraných\n`)

  if (ukazky) {
    console.log("Ukážky nadpisov podľa dokumentu:\n")
    for (const r of riadky) {
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

  if (zlych) {
    console.log(`\n${VARUJ} Nerozobrané dokumenty treba pozrieť v markdowne v app/data/vzorky/`)
    console.log(`   — pravdepodobne majú nadpisy článkov zapísané inak, než chunker očakáva.`)
  }

} catch (e) {
  console.error(`\n${ZLE} ${e.message}`)
  process.exitCode = 1
} finally {
  await client.close()
}
