/**
 * ratings_overview.mjs — stav zberu zlatej sady (D9).
 *
 *     node --env-file=.env.local scripts/ratings_overview.mjs
 *     node --env-file=.env.local scripts/ratings_overview.mjs --posledny
 *
 * Hodnotenia sa zbierajú priamo v testovacom rozhraní namiesto Excelu.
 * Tento skript ukáže, ako ďaleko je zber a čo z metrík D9 už vieme
 * spočítať bez človeka.
 *
 * Skript nič nemení — iba číta.
 */
import { MongoClient } from "mongodb"

const OK = "\x1b[32m✔\x1b[0m", BAD = "\x1b[31m✘\x1b[0m", WARN = "\x1b[33m▲\x1b[0m"
const last = process.argv.includes("--posledny")

if (!process.env.MONGODB_URI) {
  console.error(`${BAD} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

/** Percentá tak, aby 0 z 0 nebolo NaN. */
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0)

/** p95 z poľa čísel. Pri málo hodnotách je to orientačné, nie záväzné. */
function p95(values) {
  const h = values.filter(x => typeof x === "number").sort((a, b) => a - b)
  if (!h.length) return null
  return h[Math.min(h.length - 1, Math.ceil(h.length * 0.95) - 1)]
}

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("evaluations")

  const records = await col.find({}).sort({ vytvorene: 1 }).toArray()

  if (!records.length) {
    console.log(`${WARN} Kolekcia evaluations je prázdna — zatiaľ nikto nič nehodnotil.`)
    process.exit(0)
  }

  if (last) {
    const z = records[records.length - 1]
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

  const fromSet = records.filter(z => z.otazkaId)
  const free = records.filter(z => !z.otazkaId)

  // Pri opakovanom hodnotení tej istej otázky platí posledné.
  const byQuestion = new Map()
  for (const z of fromSet) byQuestion.set(z.otazkaId, z)

  const reviewed = records.filter(z => z.spravna !== null)
  const correct = reviewed.filter(z => z.spravna === 1)
  const hallucinations = records.filter(z => z.halucinacia === 1)
  const withVerified = records.filter(z => z.overenaOdpoved?.trim())
  const withParagraphs = records.filter(z => z.spravneZdroje?.trim())

  console.log("── zber ───────────────────────────────────────────────")
  console.log(`odpovedí spolu:        ${records.length}`)
  console.log(`  z toho zo sady:      ${fromSet.length}  (${byQuestion.size} rôznych otázok zo 74)`)
  console.log(`  voľných dotazov:     ${free.length}`)
  console.log(`posúdených človekom:   ${reviewed.length}  (${pct(reviewed.length, records.length)} %)`)
  console.log(`s overenou odpoveďou:  ${withVerified.length}`)
  console.log(`s doplnenými §:        ${withParagraphs.length}`)
  console.log()

  console.log("── metriky D9, ktoré už vieme ─────────────────────────")

  if (reviewed.length) {
    const ratio = pct(correct.length, reviewed.length)
    console.log(`${ratio >= 90 ? OK : BAD} správnosť odpovede    ${ratio} %  (prah ≥ 90 %, z ${reviewed.length} posúdených)`)
    const ratioH = pct(hallucinations.length, reviewed.length)
    console.log(`${ratioH <= 2 ? OK : BAD} halucinácie           ${ratioH} %  (prah ≤ 2 %)`)
  } else {
    console.log(`${WARN} správnosť a halucinácie — zatiaľ nikto neposúdil`)
  }

  const ttft = p95(records.map(z => z.ttftMs))
  if (ttft !== null) {
    console.log(`${ttft < 2000 ? OK : BAD} latencia p95 (TTFT)   ${(ttft / 1000).toFixed(1)} s  (prah < 2 s)`)
  }

  // Únik dát je tvrdá brána: interný obsah medzi zdrojmi verejnej odpovede.
  const leaks = records.filter(z => z.zdroje?.some(s => s.accessLevel === "internal"))
  console.log(`${leaks.length === 0 ? OK : BAD} únik interného obsahu ${leaks.length}  (prah 0 — tvrdá brána)`)

  const withoutCitations = records.filter(z => !z.citacie?.length)
  console.log(`${WARN} odpovede bez citácie  ${withoutCitations.length}  (${pct(withoutCitations.length, records.length)} %)`)
  console.log()

  // Rozpad času — kvôli otvorenému bodu E6.
  const phases = {}
  for (const z of records) {
    for (const [k, v] of Object.entries(z.casy ?? {})) {
      ;(phases[k] ??= []).push(v)
    }
  }
  if (Object.keys(phases).length) {
    console.log("── priemerné trvanie fáz ──────────────────────────────")
    for (const [k, v] of Object.entries(phases)) {
      const average = Math.round(v.reduce((a, b) => a + b, 0) / v.length)
      console.log(`  ${k.padEnd(24)} ${String(average).padStart(6)} ms`)
    }
    console.log()
  }

  // ── zhoda medzi hodnotiteľmi (D9, otvorený bod E5) ──────────────────────
  //
  // Otázky na precedenciu a pasce majú posúdiť dvaja nezávisle. Nezhoda nie
  // je chyba merania — je to nález: ukazuje, kde je doména neurčitá, a teda
  // kde systém nemá odpovedať autoritatívne.
  const questionRounds = db.collection("eval_questions")
  const onTwo = new Set(
    (await questionRounds
      .find({ $or: [{ precedenceRule: { $ne: null } }, { trapType: { $ne: null } }] },
            { projection: { id: 1 } })
      .toArray()).map(o => o.id)
  )

  // Posudok každého človeka zvlášť; pri opakovaní platí posledný.
  const byPerson = new Map()
  for (const z of records) {
    if (!z.otazkaId || z.spravna === null || z.spravna === undefined) continue
    if (!byPerson.has(z.otazkaId)) byPerson.set(z.otazkaId, new Map())
    byPerson.get(z.otazkaId).set(z.hodnotitel ?? "anonym", z.spravna)
  }

  const doubled = [...byPerson].filter(([, people]) => people.size >= 2)
  const disputed = doubled.filter(([, people]) => new Set(people.values()).size > 1)

  console.log("── zhoda hodnotiteľov ─────────────────────────────────")
  console.log(`otázok pre dvoch:       ${onTwo.size}`)
  console.log(`z toho posúdili dvaja:  ${doubled.length}`)
  if (doubled.length) {
    const ratio = pct(doubled.length - disputed.length, doubled.length)
    console.log(`${disputed.length === 0 ? OK : WARN} zhoda:                 ${ratio} %`)
    if (disputed.length) {
      console.log(`\n${WARN} Rozišli sa na ${disputed.length} otázkach:`)
      for (const [id, people] of disputed) {
        const who = [...people].map(([k, v]) => `${k}=${v === 1 ? "správna" : "nesprávna"}`).join(", ")
        console.log(`   ${id}  ${who}`)
      }
      console.log("\n   Nezhoda nie je chyba — sú to otázky, kde je výklad sporný.")
      console.log("   Zvážiť, či nepatria medzi pasce typu ambiguous_conflict:")
      console.log("   tam systém nemá rozhodnúť, ale ponúknuť eskaláciu.")
    }
  } else {
    console.log(`${WARN} zatiaľ žiadnu otázku neposúdili dvaja`)
  }
  console.log()

  if (byQuestion.size < 74) {
    console.log(`${WARN} Zo zlatej sady zostáva ${74 - byQuestion.size} otázok.`)
  }
} finally {
  await client.close()
}
