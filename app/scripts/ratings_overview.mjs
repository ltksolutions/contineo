/**
 * ratings_overview.mjs — stav hodnotení odpovedí.
 *
 *     node --env-file=.env.local scripts/ratings_overview.mjs
 *     node --env-file=.env.local scripts/ratings_overview.mjs --posledny
 *
 * Skript nič nemení — iba číta kolekciu `evaluations`.
 *
 * **Pripravená sada otázok bola zrušená 2026-09-15** a s ňou aj tá časť
 * tohto výpisu, ktorá merala, ako ďaleko je jej vypĺňanie. Čo zostáva, sú
 * metriky nad **skutočnou prevádzkou** — a jedna z nich je dôležitejšia než
 * všetky ostatné dohromady:
 *
 *   **Únik interného obsahu je tvrdá brána.** Ráta sa zo zdrojov, ktoré
 *   systém použil pri odpovedi, takže sadu nikdy nepotreboval. Jediný
 *   výskyt znamená neúspech bez ohľadu na ostatné čísla.
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

  const records = await col.find({}).sort({ createdAt: 1 }).toArray()

  if (!records.length) {
    console.log(`${WARN} Kolekcia evaluations je prázdna — zatiaľ sa nikto na nič nespýtal.`)
    process.exit(0)
  }

  if (last) {
    const z = records[records.length - 1]
    console.log("── posledný záznam ────────────────────────────────────")
    console.log("otázka:      ", z.question)
    console.log("odpoveď:     ", (z.answer ?? "").slice(0, 120) + "…")
    console.log("zdroje:      ", z.sources?.length ?? 0, "· citácie:", z.citations?.length ?? 0)
    console.log("správna:     ", z.correct, "· halucinácia:", z.hallucination)
    console.log("§ od človeka:", z.correctSources ?? "—")
    console.log("overená odp.:", z.verifiedAnswer ? z.verifiedAnswer.slice(0, 80) + "…" : "—")
    console.log("poznámka:    ", z.note ?? "—")
    console.log("nahlásené:   ", z.readerNote ? z.readerNote.slice(0, 80) + "…" : "—")
    console.log("hodnotiteľ:  ", z.reviewer, "· model:", z.model)
    console.log("TTFT:        ", z.ttftMs, "ms · celkovo:", z.celkovoMs, "ms")
    console.log("fázy:        ", JSON.stringify(z.casy ?? {}))
    console.log()
  }

  const reviewed = records.filter(z => z.correct !== null && z.correct !== undefined)
  const correct = reviewed.filter(z => z.correct === 1)
  const hallucinations = records.filter(z => z.hallucination === 1)
  const withVerified = records.filter(z => z.verifiedAnswer?.trim())
  const withParagraphs = records.filter(z => z.correctSources?.trim())
  const reported = records.filter(z => z.readerNote?.trim())

  console.log("── zber ───────────────────────────────────────────────")
  console.log(`odpovedí spolu:        ${records.length}`)
  console.log(`posúdených človekom:   ${reviewed.length}  (${pct(reviewed.length, records.length)} %)`)
  console.log(`nahlásených ako zlé:   ${reported.length}`)
  console.log(`s overenou odpoveďou:  ${withVerified.length}`)
  console.log(`s doplnenými §:        ${withParagraphs.length}`)
  console.log()

  console.log("── metriky ────────────────────────────────────────────")

  if (reviewed.length) {
    const ratio = pct(correct.length, reviewed.length)
    console.log(`${ratio >= 90 ? OK : BAD} správnosť odpovede    ${ratio} %  (orientačne ≥ 90 %, z ${reviewed.length} posúdených)`)
    const ratioH = pct(hallucinations.length, reviewed.length)
    console.log(`${ratioH <= 2 ? OK : BAD} halucinácie           ${ratioH} %  (orientačne ≤ 2 %)`)
  } else {
    console.log(`${WARN} správnosť a halucinácie — zatiaľ nikto neposúdil`)
  }

  const ttft = p95(records.map(z => z.ttftMs))
  if (ttft !== null) {
    console.log(`${ttft < 2000 ? OK : BAD} latencia p95 (TTFT)   ${(ttft / 1000).toFixed(1)} s  (prah < 2 s)`)
  }

  // Tvrdá brána: interný obsah medzi zdrojmi verejnej odpovede.
  const leaks = records.filter(z => z.sources?.some(s => s.accessLevel === "internal"))
  console.log(`${leaks.length === 0 ? OK : BAD} únik interného obsahu ${leaks.length}  (prah 0 — tvrdá brána)`)

  const withoutCitations = records.filter(z => !z.citations?.length)
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

  // Nahlásené nepresnosti vypisujeme celé — je to jediné miesto, kde človek
  // vlastnými slovami povedal, čo bolo zle, a zhrnúť sa to nedá.
  if (reported.length) {
    console.log("── nahlásené nepresnosti ──────────────────────────────")
    for (const z of reported.slice(-10)) {
      console.log(`  „${String(z.question).slice(0, 70)}"`)
      console.log(`    → ${String(z.readerNote).slice(0, 160)}`)
    }
    console.log()
  }
} finally {
  await client.close()
}
