/**
 * utvary_z_textu.mjs — založí oddelenia z toho, čo je zapísané pri ľuďoch (D49).
 *
 * Do zavedenia štruktúry bol oddelenie **voľný text** na osobe. Tento skript ho
 * prevedie na stromové oddelenia a ľudí do nich zaradí.
 *
 * Tri veci, ktoré robí zámerne inak, než by sa čakalo:
 *
 *   - **pôvodný text sa nemaže.** Zostáva v `department` ako stopa, z čoho
 *     oddelenie vznikol. Keby zmizol, po nevydarenom prevode by sa nedalo zistiť,
 *     kto kam patril;
 *   - **strom je plochý.** Zo zápisu „Odbor médií" sa nedá vyčítať, pod koho
 *     patrí. Hádať to podľa podreťazcov by vyrobilo štruktúru, ktorá vyzerá
 *     hotovo a nesedí. Hierarchiu doklikne človek v `/organizacia`;
 *   - **veľké a malé písmená sú ten istý oddelenie** („Legislatíva" aj
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
const FAIL = "\x1b[31m✗\x1b[0m"

function arg(name) {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1] ?? null
}
const TENANT = arg("--tenant")
const WRITE = process.argv.includes("--zapis")

if (!TENANT) {
  console.error("Použitie: npm run utvary -- --tenant <KOD> [--zapis]")
  process.exit(1)
}
if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI.`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const db = client.db(process.env.MONGODB_DB ?? "contineo")
const personCol = db.collection("persons")
const departmentCol = db.collection("departments")

const people = await personCol
  .find({ companyCode: TENANT })
  .project({ id: 1, fullName: 1, department: 1, departmentId: 1 })
  .toArray()

if (people.length === 0) {
  console.error(`${FAIL} Organizácia ${TENANT} nemá žiadne osoby.`)
  await client.close()
  process.exit(1)
}

// Zoskupenie podľa normalizovaného tvaru; zapíše sa najčastejší zápis.
const groups = new Map()
for (const o of people) {
  const text = (o.department ?? "").trim()
  if (!text) continue
  const key = text.toLowerCase()
  const z = groups.get(key) ?? { tvary: new Map(), osoby: [] }
  z.tvary.set(text, (z.tvary.get(text) ?? 0) + 1)
  z.osoby.push(o)
  groups.set(key, z)
}

const existing = await departmentCol.find({ companyCode: TENANT }).toArray()
const byName = new Map(existing.map(u => [u.nazov.trim().toLowerCase(), u]))

const withoutDepartment = people.filter(o => !(o.department ?? "").trim() && !o.departmentId)
const alreadyPlaced = people.filter(o => o.departmentId).length

console.log(`\nOrganizácia ${TENANT}: ${people.length} osôb, ${alreadyPlaced} už zaradených v štruktúre.`)
console.log(`Textových oddelení: ${groups.size}. Bez akéhokoľvek oddelenia: ${withoutDepartment.length}.\n`)

let created = 0
let placed = 0

for (const [key, z] of [...groups].sort((a, b) => b[1].osoby.length - a[1].osoby.length)) {
  const name = [...z.tvary].sort((a, b) => b[1] - a[1])[0][0]
  const uz = byName.get(key)
  const id = uz?.id ?? randomUUID()

  const toPlace = z.osoby.filter(o => !o.departmentId)
  console.log(
    `${uz ? "existuje" : "nový   "}  ${name.padEnd(34)} ${String(z.osoby.length).padStart(4)} osôb` +
    (toPlace.length !== z.osoby.length ? `  (zaradí sa ${toPlace.length})` : ""),
  )
  if (z.tvary.size > 1) {
    console.log(`          zlúčené zápisy: ${[...z.tvary.keys()].join(" | ")}`)
  }

  if (!WRITE) {
    created += uz ? 0 : 1
    placed += toPlace.length
    continue
  }

  if (!uz) {
    await departmentCol.insertOne({
      companyCode: TENANT,
      id,
      nazov: name,
      parentId: null,
      createdAt: new Date(),
      createdBy: "script:utvary_z_textu",
    })
    created++
  }

  for (const o of toPlace) {
    // Cesta plochého stromu je jednoprvková. Zapisuje sa spolu so zaradením,
    // nie zvlášť — inak by chvíľu platilo, že človek do oddelenia patrí, ale
    // pridelenie oddelenia sa ho netýka.
    const now = new Date()
    await personCol.updateOne(
      { companyCode: TENANT, id: o.id },
      {
        $set: {
          departmentId: id,
          departmentPath: [id],
          // Prevod nie je príchod. História sa otvára dátumom prevodu, ale
          // pridelenia oddelenia sú v tej chvíli všetky staršie — a majú platiť,
          // lebo tí ľudia v oddelení naozaj boli. Preto `od` v minulosti:
          // epocha znamená „odjakživa", nie „práve prišiel".
          departmentHistory: [{ departmentId: id, departmentPath: [id], od: new Date(0) }],
          updatedAt: now,
          updatedBy: "script:utvary_z_textu",
        },
      },
    )
    placed++
  }
}

console.log(
  `\n${WRITE ? OK : "skúšobne"} oddelení ${WRITE ? "založených" : "by pribudlo"}: ${created}, ` +
  `osôb ${WRITE ? "zaradených" : "by sa zaradilo"}: ${placed}.`,
)
if (!WRITE) console.log("Nič sa nezapísalo. Zápis: rovnaký príkaz s --zapis.\n")
else console.log("Strom je plochý — hierarchiu nastav v /organizacia, záložka Oddelenia.\n")

await client.close()
