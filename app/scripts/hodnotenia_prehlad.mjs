/**
 * hodnotenia_prehlad.mjs — stav zberu zlatej sady (D9).
 *
 *     node --env-file=.env.local scripts/hodnotenia_prehlad.mjs
 *     node --env-file=.env.local scripts/hodnotenia_prehlad.mjs --posledny
 *
 * Hodnotenia sa zbierajú priamo v testovacom rozhraní namiesto Excelu.
 * Tento skript ukáže, ako ďaleko je zber a čo z metrík D9 už vieme
 * spočítať bez človeka.
 *
 * Skript nič nemení — iba číta.
 */
import { MongoClient } from "mongodb"

const OK = "\x1b[32m✔\x1b[0m", ZLE = "\x1b[31m✘\x1b[0m", VARUJ = "\x1b[33m▲\x1b[0m"
const posledny = process.argv.includes("--posledny")

if (!process.env.MONGODB_URI) {
  console.error(`${ZLE} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

/** Percentá tak, aby 0 z 0 nebolo NaN. */
const pct = (cast, celok) => (celok ? Math.round((cast / celok) * 100) : 0)

/** p95 z poľa čísel. Pri málo hodnotách je to orientačné, nie záväzné. */
function p95(hodnoty) {
  const h = hodnoty.filter(x => typeof x === "number").sort((a, b) => a - b)
  if (!h.length) return null
  return h[Math.min(h.length - 1, Math.ceil(h.length * 0.95) - 1)]
}

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("evaluations")

  const zaznamy = await col.find({}).sort({ vytvorene: 1 }).toArray()

  if (!zaznamy.length) {
    console.log(`${VARUJ} Kolekcia evaluations je prázdna — zatiaľ nikto nič nehodnotil.`)
    process.exit(0)
  }

  if (posledny) {
    const z = zaznamy[zaznamy.length - 1]
    console.log("── posledný záznam ────────────────────────────────────")
    console.log("otázka:      ", z.otazka)
    console.log("otázkaId:    ", z.otazkaId ?? "(voľný dotaz)")
    console.log("odpoveď:     ", (z.odpoved ?? "").slice(0, 120) + "…")
    console.log("zdroje:      ", z.zdroje?.length ?? 0, "· citácie:", z.citacie?.length ?? 0)
    console.log("správna:     ", z.spravna, "· halucinácia:", z.halucinacia)
    console.log("§ od človeka:", z.spravneZdroje ?? "—")
    console.log("overená odp.:", z.overenaOdpoved ? z.overenaOdpoved.slice(0, 80) + "…" : "—")
    console.log("poznámka:    ", z.poznamka ?? "—")
    console.log("hodnotiteľ:  ", z.hodnotitel, "· model:", z.model)
    console.log("TTFT:        ", z.ttftMs, "ms · celkovo:", z.celkovoMs, "ms")
    console.log("fázy:        ", JSON.stringify(z.casy ?? {}))
    console.log()
  }

  const zoSady = zaznamy.filter(z => z.otazkaId)
  const volne = zaznamy.filter(z => !z.otazkaId)

  // Pri opakovanom hodnotení tej istej otázky platí posledné.
  const podlaOtazky = new Map()
  for (const z of zoSady) podlaOtazky.set(z.otazkaId, z)

  const posudene = zaznamy.filter(z => z.spravna !== null)
  const spravne = posudene.filter(z => z.spravna === 1)
  const halucinacie = zaznamy.filter(z => z.halucinacia === 1)
  const sOverenou = zaznamy.filter(z => z.overenaOdpoved?.trim())
  const sParagrafmi = zaznamy.filter(z => z.spravneZdroje?.trim())

  console.log("── zber ───────────────────────────────────────────────")
  console.log(`odpovedí spolu:        ${zaznamy.length}`)
  console.log(`  z toho zo sady:      ${zoSady.length}  (${podlaOtazky.size} rôznych otázok zo 74)`)
  console.log(`  voľných dotazov:     ${volne.length}`)
  console.log(`posúdených človekom:   ${posudene.length}  (${pct(posudene.length, zaznamy.length)} %)`)
  console.log(`s overenou odpoveďou:  ${sOverenou.length}`)
  console.log(`s doplnenými §:        ${sParagrafmi.length}`)
  console.log()

  console.log("── metriky D9, ktoré už vieme ─────────────────────────")

  if (posudene.length) {
    const podiel = pct(spravne.length, posudene.length)
    console.log(`${podiel >= 90 ? OK : ZLE} správnosť odpovede    ${podiel} %  (prah ≥ 90 %, z ${posudene.length} posúdených)`)
    const podielH = pct(halucinacie.length, posudene.length)
    console.log(`${podielH <= 2 ? OK : ZLE} halucinácie           ${podielH} %  (prah ≤ 2 %)`)
  } else {
    console.log(`${VARUJ} správnosť a halucinácie — zatiaľ nikto neposúdil`)
  }

  const ttft = p95(zaznamy.map(z => z.ttftMs))
  if (ttft !== null) {
    console.log(`${ttft < 2000 ? OK : ZLE} latencia p95 (TTFT)   ${(ttft / 1000).toFixed(1)} s  (prah < 2 s)`)
  }

  // Únik dát je tvrdá brána: interný obsah medzi zdrojmi verejnej odpovede.
  const uniky = zaznamy.filter(z => z.zdroje?.some(s => s.accessLevel === "internal"))
  console.log(`${uniky.length === 0 ? OK : ZLE} únik interného obsahu ${uniky.length}  (prah 0 — tvrdá brána)`)

  const bezCitacii = zaznamy.filter(z => !z.citacie?.length)
  console.log(`${VARUJ} odpovede bez citácie  ${bezCitacii.length}  (${pct(bezCitacii.length, zaznamy.length)} %)`)
  console.log()

  // Rozpad času — kvôli otvorenému bodu E6.
  const faz = {}
  for (const z of zaznamy) {
    for (const [k, v] of Object.entries(z.casy ?? {})) {
      ;(faz[k] ??= []).push(v)
    }
  }
  if (Object.keys(faz).length) {
    console.log("── priemerné trvanie fáz ──────────────────────────────")
    for (const [k, v] of Object.entries(faz)) {
      const priemer = Math.round(v.reduce((a, b) => a + b, 0) / v.length)
      console.log(`  ${k.padEnd(24)} ${String(priemer).padStart(6)} ms`)
    }
    console.log()
  }

  // ── zhoda medzi hodnotiteľmi (D9, otvorený bod E5) ──────────────────────
  //
  // Otázky na precedenciu a pasce majú posúdiť dvaja nezávisle. Nezhoda nie
  // je chyba merania — je to nález: ukazuje, kde je doména neurčitá, a teda
  // kde systém nemá odpovedať autoritatívne.
  const otazkyKol = db.collection("eval_questions")
  const naDvoch = new Set(
    (await otazkyKol
      .find({ $or: [{ precedenceRule: { $ne: null } }, { trapType: { $ne: null } }] },
            { projection: { id: 1 } })
      .toArray()).map(o => o.id)
  )

  // Posudok každého človeka zvlášť; pri opakovaní platí posledný.
  const podlaLudi = new Map()
  for (const z of zaznamy) {
    if (!z.otazkaId || z.spravna === null || z.spravna === undefined) continue
    if (!podlaLudi.has(z.otazkaId)) podlaLudi.set(z.otazkaId, new Map())
    podlaLudi.get(z.otazkaId).set(z.hodnotitel ?? "anonym", z.spravna)
  }

  const dvojite = [...podlaLudi].filter(([, ludia]) => ludia.size >= 2)
  const sporne = dvojite.filter(([, ludia]) => new Set(ludia.values()).size > 1)

  console.log("── zhoda hodnotiteľov ─────────────────────────────────")
  console.log(`otázok pre dvoch:       ${naDvoch.size}`)
  console.log(`z toho posúdili dvaja:  ${dvojite.length}`)
  if (dvojite.length) {
    const podiel = pct(dvojite.length - sporne.length, dvojite.length)
    console.log(`${sporne.length === 0 ? OK : VARUJ} zhoda:                 ${podiel} %`)
    if (sporne.length) {
      console.log(`\n${VARUJ} Rozišli sa na ${sporne.length} otázkach:`)
      for (const [id, ludia] of sporne) {
        const kto = [...ludia].map(([k, v]) => `${k}=${v === 1 ? "správna" : "nesprávna"}`).join(", ")
        console.log(`   ${id}  ${kto}`)
      }
      console.log("\n   Nezhoda nie je chyba — sú to otázky, kde je výklad sporný.")
      console.log("   Zvážiť, či nepatria medzi pasce typu ambiguous_conflict:")
      console.log("   tam systém nemá rozhodnúť, ale ponúknuť eskaláciu.")
    }
  } else {
    console.log(`${VARUJ} zatiaľ žiadnu otázku neposúdili dvaja`)
  }
  console.log()

  if (podlaOtazky.size < 74) {
    console.log(`${VARUJ} Zo zlatej sady zostáva ${74 - podlaOtazky.size} otázok.`)
  }
} finally {
  await client.close()
}
