/**
 * version_questions.mjs — skúšobné otázky na dokumente s tromi zneniami
 * (plán „znenia v indexe", krok 8; dokument `sfz:test_znenia`,
 * `scripts/seed_version_test.mjs`).
 *
 *     npm run versions:questions                 hľadanie a porovnanie, bez modelu
 *     npm run versions:questions -- --odpoved    aj odpoveď modelu
 *
 * Prejde tú istú cestu ako `/api/chat` — deň otázky, otázka bez dátumu pre
 * klasifikáciu a hľadanie, znenia platné k tomu dňu, porovnanie — a pri každej
 * otázke overí, **z ktorého znenia** prišiel zdroj a či nesie očakávaný text.
 * Odpoveď modelu sa len vypíše: je to jazyk, nie údaj, a overuje ju človek.
 *
 * Očakávania platia, kým sú zverejnené všetky tri znenia (1. 1. 2024,
 * 1. 7. 2026, 1. 1. 2027) a dnešok je medzi 1. 7. 2026 a 1. 1. 2027.
 */

import { getCollection } from "../src/lib/mongodb.ts"
import { hybridSearch } from "../src/lib/mongoSearch.ts"
import { searchScope, attachVersions } from "../src/lib/searchVersions.ts"
import { detectQueryTime, searchInstant, withoutTimePhrase } from "../src/lib/queryTime.ts"
import { buildComparison } from "../src/lib/comparison.ts"
import { defaultProfile } from "../src/lib/tenantProfile.ts"
import { getProviders } from "../src/lib/providers/factory.ts"
import { generateAnswer } from "../src/lib/llmGenerator.ts"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const COMPANY = "SFZ"
const DOCUMENT_ID = "sfz:test_znenia"
const wantAnswer = process.argv.includes("--odpoved")

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)

/**
 * `from` = deň účinnosti znenia, z ktorého má byť zdroj; `text` = čo v ňom
 * musí stáť. Pri porovnaní dvojica znení a zmenené články.
 */
const QUESTIONS = [
  { q: "Aká je lehota na odvolanie podľa skúšobného poriadku?", kind: "today", from: "2026-07-01", text: "30 dní" },
  { q: "Aký je poplatok za odvolanie podľa skúšobného poriadku?", kind: "today", from: "2026-07-01", text: "50 eur" },
  { q: "Aká bola lehota na odvolanie podľa skúšobného poriadku k 1. 3. 2025?", kind: "asOf", from: "2024-01-01", text: "15 dní" },
  { q: "Aký bude poplatok za odvolanie podľa skúšobného poriadku k 1. 1. 2027?", kind: "asOf", from: "2027-01-01", text: "80 eur" },
  // Čl. 7: v novele opravená interpunkcia (oprava textu 29. 9. 2026, D150) — porovnanie ju vidí ako zmenu.
  { q: "Čo sa zmení v skúšobnom poriadku?", kind: "compare", pair: ["2026-07-01", "2027-01-01"], changes: ["čl. 4 changed", "čl. 7 changed"] },
  { q: "Čo sa zmenilo v skúšobnom poriadku od roku 2024?", kind: "compare", pair: ["2024-01-01", "2026-07-01"],
    changes: ["čl. 2 changed", "čl. 7 added", "čl. 5 removed"] },
]

try {
  const collection = await getCollection("document_chunks")
  const profile = defaultProfile(COMPANY)
  if (!wantAnswer && !process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = "sk-ant-zastupny-nepouzije-sa"
  const providers = getProviders(profile)
  let failed = 0

  for (const t of QUESTIONS) {
    const now = new Date()
    const time = detectQueryTime(t.q, now)
    const scope = await searchScope(COMPANY, searchInstant(time, now), now)
    const chunks = attachVersions(await hybridSearch(collection, {
      query: withoutTimePhrase(t.q), accessLevel: "internal", companyCode: COMPANY, limit: 20, rerankLimit: 5,
      useStageRerank: providers.rerank.isPipelineStage, rerankModel: profile.providers.rerank.model,
      vectorPath: profile.providers.embedding.vectorPath,
      versionIds: scope.versionIds, verifiedAnswers: scope.verifiedAnswers && time.kind !== "compare",
    }), scope.versions)

    const problems = []
    if (time.kind !== t.kind) problems.push(`druh otázky ${time.kind}, čakal som ${t.kind}`)
    const ours = chunks.filter(c => c.documentId === DOCUMENT_ID)
    let answerChunks = chunks
    let comparison

    if (t.kind === "compare") {
      const top = chunks.find(c => c.sourceType !== "qa")
      if (top?.documentId !== DOCUMENT_ID) problems.push(`najlepší výsledok je ${top?.documentId ?? "nič"}, nie ${DOCUMENT_ID}`)
      const cmp = await buildComparison(COMPANY, DOCUMENT_ID, now,
        time.since ? new Date(`${time.since}T12:00:00Z`) : undefined,
        ours.map(c => c.articleRef).filter(Boolean))
      if (!cmp.ok) problems.push(`porovnanie: ${cmp.reason}`)
      else {
        const pair = [day(cmp.from.effectiveFrom), day(cmp.to.effectiveFrom)]
        if (pair.join() !== t.pair.join()) problems.push(`dvojica ${pair.join(" → ")}, čakal som ${t.pair.join(" → ")}`)
        const got = cmp.changes.map(c => `${c.ref} ${c.kind}`)
        if (got.join() !== t.changes.join()) problems.push(`zmeny [${got.join(", ")}], čakal som [${t.changes.join(", ")}]`)
        answerChunks = cmp.chunks
        comparison = { title: cmp.title, from: cmp.from, to: cmp.to,
          changes: cmp.changes.map(c => ({ ref: c.ref, heading: c.heading, kind: c.kind })),
          detailRefs: [...new Set(cmp.chunks.map(c => c.articleRef))] }
      }
    } else {
      const hit = ours.find(c => c.text.includes(t.text))
      if (!hit) problems.push(`žiadny zdroj z ${DOCUMENT_ID} s textom „${t.text}"`)
      else if (day(hit.version?.effectiveFrom) !== t.from) problems.push(`zdroj je zo znenia od ${day(hit.version?.effectiveFrom)}, čakal som ${t.from}`)
      const foreign = ours.filter(c => day(c.version?.effectiveFrom) !== t.from)
      if (foreign.length) problems.push(`${foreign.length} zdrojov z iného znenia`)
    }

    console.log(`${problems.length ? FAIL : OK} ${t.q}`)
    console.log(`    čas: ${time.kind} · ${time.asOf}${time.since ? ` · od ${time.since}` : ""} · zdroje z testu: ${ours.length}`)
    for (const p of problems) console.log(`    ${FAIL} ${p}`)
    if (problems.length) failed++

    if (wantAnswer && answerChunks.length) {
      const stream = generateAnswer({ query: t.q, chunks: answerChunks, userRole: "internal", profile, asOf: scope.asOf, time, comparison })
      const reader = stream.getReader(); const dec = new TextDecoder(); let buf = "", text = ""
      for (;;) {
        const { done, value } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split("\n\n"); buf = parts.pop() ?? ""
        for (const p of parts) { try { const e = JSON.parse(p.replace(/^data: /, "")); if (e.type === "token") text += e.token } catch { /* neúplný blok */ } }
      }
      console.log(`    ${INFO} ${text.replace(/\n+/g, " ").slice(0, 400)}`)
    }
  }

  console.log(failed ? `\n${FAIL} ${failed} z ${QUESTIONS.length} otázok nesedí` : `\n${OK} všetkých ${QUESTIONS.length} otázok sedí`)
  process.exit(failed ? 1 : 0)
} catch (e) {
  console.error(`${FAIL} ${e?.message ?? e}`)
  process.exit(1)
}
