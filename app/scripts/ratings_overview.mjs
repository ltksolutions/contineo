/**
 * ratings_overview.mjs — stav hodnotení odpovedí.
 *
 *     node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/ratings_overview.mjs
 *     node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/ratings_overview.mjs --posledny
 *
 * Prepínač len umlčí varovanie Node pri importe `src/lib/accessLevel.ts`;
 * skript beží aj bez neho.
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
 *
 *   **Únik je verejná odpoveď s interným zdrojom** (`isInternalLeak()`).
 *   Do 2026-10-01 sa rátal každý interný zdroj, aj v odpovedi prihlásenému
 *   zamestnancovi, ktorý interné vidieť smie — 28.–29. 9. tak brána hlásila
 *   štyri „úniky", ktoré žiadnym neboli. Interný zdroj v internej odpovedi
 *   sa teraz len ukazuje (▲), bránu nezhadzuje.
 */
import { MongoClient } from "mongodb"
import { isInternalLeak, isInternalSourceForInternal } from "../src/lib/accessLevel.ts"

const OK = "\x1b[32m✔\x1b[0m", BAD = "\x1b[31m✘\x1b[0m", WARN = "\x1b[33m▲\x1b[0m"
const last = process.argv.includes("--posledny")

if (!process.env.MONGODB_URI) {
  console.error(`${BAD} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

/** Percentá tak, aby 0 z 0 nebolo NaN. */
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0)

/** Kvantil z poľa čísel (0,5 = medián). Pri málo hodnotách je orientačný, nie záväzný. */
function quantile(values, q) {
  const h = values.filter(x => typeof x === "number").sort((a, b) => a - b)
  if (!h.length) return null
  return h[Math.min(h.length - 1, Math.ceil(h.length * q) - 1)]
}
const p95 = values => quantile(values, 0.95)

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("evaluations")

  const records = await col.find({}).sort({ createdAt: 1 }).toArray()

  /*
   * Podpisy su od O17 `persons.id`, nie e-maily — meno sa dohladava. Ked
   * osoba medzitym zanikla, ostane holy identifikator a je to spravne:
   * vazba ma zomriet s nou.
   */
  const osoby = await db.collection("persons").find({}, { projection: { id: 1, fullName: 1 } }).toArray()
  const menaOsob = new Map(osoby.map(o => [o.id, o.fullName ?? ""]))
  const meno = id => (id ? menaOsob.get(id) || `${id} (nie je v adresari)` : "neprihlaseny")

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
    console.log("hodnotiteľ:  ", meno(z.reviewer), "· model:", z.model)
    console.log("TTFT:        ", z.ttftMs, "ms · celkovo:", z.totalMs, "ms")
    console.log("fázy:        ", JSON.stringify(z.timings ?? {}))
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
    const median = quantile(records.map(z => z.ttftMs), 0.5)
    console.log(`${ttft < 2000 ? OK : BAD} latencia p95 (TTFT)   ${(ttft / 1000).toFixed(1)} s  (prah < 2 s; medián ${(median / 1000).toFixed(1)} s)`)
  }

  // Veľkosť vstupu hlavného modelu — od nej závisí jeho čas po prvý token.
  // Tokeny sa ukladajú až od 1. 10. 2026 (dovtedy išli pod kľúčom, ktorý
  // nikto nečítal), staršie záznamy ich nemajú.
  const withTokens = records.filter(z => z.tokens?.input)
  if (withTokens.length) {
    const input = withTokens.map(z => z.tokens.input)
    const cached = withTokens.filter(z => z.tokens.cacheRead > 0).length
    console.log(`${WARN} vstup modelu          medián ${quantile(input, 0.5)} tokenov, p95 ${p95(input)}  (z cache čítalo ${cached} z ${withTokens.length})`)
  }

  // Tvrdá brána: interný obsah medzi zdrojmi verejnej odpovede.
  const leaks = records.filter(isInternalLeak)
  console.log(`${leaks.length === 0 ? OK : BAD} únik interného obsahu ${leaks.length}  (prah 0 — tvrdá brána, len verejné odpovede)`)
  const internalForInternal = records.filter(isInternalSourceForInternal)
  console.log(`${WARN} interné zdroje v interných odpovediach ${internalForInternal.length}  (v poriadku, len pre prehľad)`)

  const withoutCitations = records.filter(z => !z.citations?.length)
  console.log(`${WARN} odpovede bez citácie  ${withoutCitations.length}  (${pct(withoutCitations.length, records.length)} %)`)
  console.log()

  // Rozpad času — kvôli otvorenému bodu E6. Pole sa po migrácii volá
  // `timings`; čítanie starého `casy` vypisovalo rozpad vždy prázdny.
  const phases = {}
  for (const z of records) {
    for (const [k, v] of Object.entries(z.timings ?? {})) {
      ;(phases[k] ??= []).push(v)
    }
  }
  if (Object.keys(phases).length) {
    // Medián a p95, nie priemer: jeden studený štart by priemer posunul
    // a prah D9 je aj tak na p95.
    console.log("── trvanie fáz (medián / p95) ─────────────────────────")
    for (const [k, v] of Object.entries(phases)) {
      const n = `n=${v.length}`
      console.log(`  ${k.padEnd(24)} ${String(quantile(v, 0.5)).padStart(6)} ms  ${String(p95(v)).padStart(6)} ms  ${n}`)
    }
    console.log()
  }

  // Únik sa vypisuje celý: pri tvrdej bráne treba hneď vedieť, ktorá odpoveď
  // a komu — nie len číslo.
  if (leaks.length) {
    console.log("── únik interného obsahu ──────────────────────────────")
    for (const z of leaks) {
      const titles = [...new Set(z.sources.filter(s => s.accessLevel === "internal").map(s => s.title))]
      console.log(`  ${z.createdAt?.toISOString?.() ?? "—"} · ${meno(z.askedBy ?? z.reviewer)} · „${String(z.question).slice(0, 70)}"`)
      console.log(`    → ${titles.join(", ")}`)
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
