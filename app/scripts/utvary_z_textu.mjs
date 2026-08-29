/**
 * utvary_z_textu.mjs — založí útvary z toho, čo je zapísané pri ľuďoch (D49).
 *
 * Do zavedenia štruktúry bol útvar **voľný text** na osobe. Tento skript ho
 * prevedie na stromové útvary a ľudí do nich zaradí.
 *
 * Tri veci, ktoré robí zámerne inak, než by sa čakalo:
 *
 *   - **pôvodný text sa nemaže.** Zostáva v `department` ako stopa, z čoho
 *     útvar vznikol. Keby zmizol, po nevydarenom prevode by sa nedalo zistiť,
 *     kto kam patril;
 *   - **strom je plochý.** Zo zápisu „Odbor médií" sa nedá vyčítať, pod koho
 *     patrí. Hádať to podľa podreťazcov by vyrobilo štruktúru, ktorá vyzerá
 *     hotovo a nesedí. Hierarchiu doklikne človek v `/organizacia`;
 *   - **veľké a malé písmená sú ten istý útvar** („Legislatíva" aj
 *     „legislatíva"), ale zapíše sa najčastejší tvar zápisu.
 *
 * Predvolene **nič nezapisuje**.
 *
 *   npm run utvary -- --tenant SFZ
 *   npm run utvary -- --tenant SFZ --zapis
 */

import { randomUUID } from "node:crypto"
import { MongoClient } from "mongodb"

const OK = "\x1b[32m✓\x1b[0m"
const CHYBA = "\x1b[31m✗\x1b[0m"

function arg(meno) {
  const i = process.argv.indexOf(meno)
  return i === -1 ? null : process.argv[i + 1] ?? null
}
const TENANT = arg("--tenant")
const ZAPIS = process.argv.includes("--zapis")

if (!TENANT) {
  console.error("Použitie: npm run utvary -- --tenant <KOD> [--zapis]")
  process.exit(1)
}
if (!process.env.MONGODB_URI) {
  console.error(`${CHYBA} Chýba MONGODB_URI.`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const db = client.db(process.env.MONGODB_DB ?? "contineo")
const osobyCol = db.collection("persons")
const utvaryCol = db.collection("departments")

const osoby = await osobyCol
  .find({ companyCode: TENANT })
  .project({ id: 1, fullName: 1, department: 1, departmentId: 1 })
  .toArray()

if (osoby.length === 0) {
  console.error(`${CHYBA} Organizácia ${TENANT} nemá žiadne osoby.`)
  await client.close()
  process.exit(1)
}

// Zoskupenie podľa normalizovaného tvaru; zapíše sa najčastejší zápis.
const skupiny = new Map()
for (const o of osoby) {
  const text = (o.department ?? "").trim()
  if (!text) continue
  const kluc = text.toLowerCase()
  const z = skupiny.get(kluc) ?? { tvary: new Map(), osoby: [] }
  z.tvary.set(text, (z.tvary.get(text) ?? 0) + 1)
  z.osoby.push(o)
  skupiny.set(kluc, z)
}

const existujuce = await utvaryCol.find({ companyCode: TENANT }).toArray()
const podlaNazvu = new Map(existujuce.map(u => [u.nazov.trim().toLowerCase(), u]))

const bezUtvaru = osoby.filter(o => !(o.department ?? "").trim() && !o.departmentId)
const uzZaradeni = osoby.filter(o => o.departmentId).length

console.log(`\nOrganizácia ${TENANT}: ${osoby.length} osôb, ${uzZaradeni} už zaradených v štruktúre.`)
console.log(`Textových útvarov: ${skupiny.size}. Bez akéhokoľvek útvaru: ${bezUtvaru.length}.\n`)

let zalozene = 0
let zaradene = 0

for (const [kluc, z] of [...skupiny].sort((a, b) => b[1].osoby.length - a[1].osoby.length)) {
  const nazov = [...z.tvary].sort((a, b) => b[1] - a[1])[0][0]
  const uz = podlaNazvu.get(kluc)
  const id = uz?.id ?? randomUUID()

  const naZaradenie = z.osoby.filter(o => !o.departmentId)
  console.log(
    `${uz ? "existuje" : "nový   "}  ${nazov.padEnd(34)} ${String(z.osoby.length).padStart(4)} osôb` +
    (naZaradenie.length !== z.osoby.length ? `  (zaradí sa ${naZaradenie.length})` : ""),
  )
  if (z.tvary.size > 1) {
    console.log(`          zlúčené zápisy: ${[...z.tvary.keys()].join(" | ")}`)
  }

  if (!ZAPIS) {
    zalozene += uz ? 0 : 1
    zaradene += naZaradenie.length
    continue
  }

  if (!uz) {
    await utvaryCol.insertOne({
      companyCode: TENANT,
      id,
      nazov,
      parentId: null,
      createdAt: new Date(),
      createdBy: "script:utvary_z_textu",
    })
    zalozene++
  }

  for (const o of naZaradenie) {
    // Cesta plochého stromu je jednoprvková. Zapisuje sa spolu so zaradením,
    // nie zvlášť — inak by chvíľu platilo, že človek do útvaru patrí, ale
    // pridelenie útvaru sa ho netýka.
    await osobyCol.updateOne(
      { companyCode: TENANT, id: o.id },
      { $set: { departmentId: id, departmentPath: [id], updatedAt: new Date(), updatedBy: "script:utvary_z_textu" } },
    )
    zaradene++
  }
}

console.log(
  `\n${ZAPIS ? OK : "skúšobne"} útvarov ${ZAPIS ? "založených" : "by pribudlo"}: ${zalozene}, ` +
  `osôb ${ZAPIS ? "zaradených" : "by sa zaradilo"}: ${zaradene}.`,
)
if (!ZAPIS) console.log("Nič sa nezapísalo. Zápis: rovnaký príkaz s --zapis.\n")
else console.log("Strom je plochý — hierarchiu nastav v /organizacia, záložka Útvary.\n")

await client.close()
