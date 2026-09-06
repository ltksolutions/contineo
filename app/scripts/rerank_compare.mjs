/**
 * rerank_compare.mjs — o KOĽKO sa od seba líšia rerank modely.
 *
 *     node --env-file=.env.local scripts/rerank_compare.mjs
 *     node --env-file=.env.local scripts/rerank_compare.mjs --pocet 40
 *     node --env-file=.env.local scripts/rerank_compare.mjs --modely rerank-2,rerank-3,rerank-3-lite
 *     node --env-file=.env.local scripts/rerank_compare.mjs --ulozit
 *
 * ČO TENTO SKRIPT NEMERIA: kvalitu. Zlatá sada D9 má zatiaľ prázdne
 * `goldChunkIds` (stav 2026-09-06), takže neexistuje pravda, voči ktorej by
 * sa dalo povedať „model X je lepší". Skóre z rôznych rerankerov sa navyše
 * nedajú porovnávať — každý má vlastnú kalibráciu.
 *
 * ČO MERIA: nakoľko sa modely zhodnú na tom, čo patrí do top-K. To je
 * rozhodnutie o tom, či sa výberom modelu vôbec oplatí zaoberať:
 *
 *   vysoký prekryv  → modely vracajú prakticky to isté, výber je jedno,
 *                     zostávame na rerank-2 a téma sa zatvára
 *   nízky prekryv   → modely sa reálne rozchádzajú, oplatí sa dotlačiť
 *                     vyplnenie zlatej sady a rozhodnúť meraním
 *
 * Navyše porovnáva každý model proti poradiu BEZ reranku (čisté $rankFusion).
 * Ak ani rerank samotný poradím veľmi nehýbe, je to dôležitejšie zistenie
 * než ktorýkoľvek súboj modelov medzi sebou.
 *
 * Používa SKUTOČNÝ hybridSearch zo src/lib, nie jeho kópiu — inak by skript
 * meral niečo iné, než čo beží v aplikácii. TypeScript spúšťa priamo Node
 * (natívne odstránenie typov, od v22.18), preto tu NIE JE esbuild —
 * ten bol z projektu odstránený 28. 8. 2026.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { MongoClient } from "mongodb"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, "../src")
const SEED = resolve(HERE, "../../eval/seed/questions_seed.json")
const VYSLEDKY = resolve(HERE, "../../eval/vysledky")

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const POCET  = Number(flag("--pocet", 20))
const TOPK   = Number(flag("--topk", 5))
const MODELY = flag("--modely", "rerank-2,rerank-2.5,rerank-3").split(",").map(s => s.trim()).filter(Boolean)
const ROLA   = args.includes("--verejne") ? "public" : "internal"
const ULOZIT = args.includes("--ulozit")

const BEZ = "bez reranku"

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}

// ── otázky ───────────────────────────────────────────────────────────────────
// Pasce (trapType) vynechávame — sú stavané na to, aby systém NEodpovedal,
// takže o zhode rerankerov na relevantnom obsahu nepovedia nič.
let otazky
try {
  const seed = JSON.parse(readFileSync(SEED, "utf8"))
  otazky = seed.filter(q => q.question && !q.trapType).slice(0, POCET)
} catch (e) {
  console.error(`${FAIL} Nedá sa načítať zlatá sada: ${SEED}\n   ${e.message}`)
  process.exit(1)
}
if (!otazky.length) { console.error(`${FAIL} Žiadne použiteľné otázky.`); process.exit(1) }

// ── skutočný kód aplikácie ───────────────────────────────────────────────────
let hybridSearch
try {
  ;({ hybridSearch } = await import(pathToFileURL(resolve(SRC, "lib/mongoSearch.ts")).href))
} catch (e) {
  console.error(`${FAIL} Nedá sa načítať mongoSearch.ts priamo cez Node.`)
  console.error(`   ${e.message.split("\n")[0]}`)
  console.error(`   Potrebný je Node ≥ 22.18 (máš ${process.version}) a typové importy`)
  console.error(`   v mongoSearch.ts musia byť písané ako \`import type\`.`)
  process.exit(1)
}

// vectorPath rovnako ako defaultProfile() v tenantProfile.ts.
// Zámerne `||`, nie `??`: `vercel env pull` zapisuje premenné bez hodnoty ako
// `VECTOR_PATH=`, čo je prázdny reťazec, nie `undefined` — `??` ho pustí ďalej
// a $vectorSearch potom spadne na `Path '' is not indexed`. Rovnaká pasca je
// popísaná v auth.ts pri ALLOWED_EMAILS.
const vectorPath = process.env.VECTOR_PATH || "text"

// ── metriky ──────────────────────────────────────────────────────────────────
const prekryv = (a, b) => {
  const s = new Set(b)
  const n = Math.min(a.length, b.length)
  return n ? a.filter(x => s.has(x)).length / n : 0
}
const rovnakePoradie = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
const priemer = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
const pct = x => `${(x * 100).toFixed(0)} %`

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const col = db.collection("document_chunks")

  const varianty = [BEZ, ...MODELY]
  console.log(`\n${INFO} ${otazky.length} otázok × ${MODELY.length} modelov · top-${TOPK} · rola "${ROLA}" · vectorPath "${vectorPath}"`)
  console.log(`${INFO} volaní reranku: ${otazky.length * MODELY.length}\n`)

  const kluc = (a, b) => `${a} ⇄ ${b}`
  const stat = new Map()
  for (let i = 0; i < varianty.length; i++)
    for (let j = i + 1; j < varianty.length; j++)
      stat.set(kluc(varianty[i], varianty[j]), { prekryv: [], top1: [], zhodne: [] })

  let zlyhane = 0, prazdne = 0
  const detail = []

  for (const [n, q] of otazky.entries()) {
    const base = { query: q.question, accessLevel: ROLA, limit: 20, rerankLimit: TOPK, vectorPath }
    const poradia = {}

    try {
      const bez = await hybridSearch(col, { ...base, useStageRerank: false })
      poradia[BEZ] = bez.slice(0, TOPK).map(c => String(c._id))
      for (const m of MODELY) {
        const r = await hybridSearch(col, { ...base, useStageRerank: true, rerankModel: m })
        poradia[m] = r.slice(0, TOPK).map(c => String(c._id))
      }
    } catch (e) {
      zlyhane++
      console.log(`${FAIL} ${q.id}: ${e.message.replace(/\s+/g, " ").slice(0, 130)}`)
      continue
    }

    if (!poradia[BEZ].length) {
      prazdne++
      console.log(`${INFO} ${q.id}: bez výsledkov — „${q.question.slice(0, 55)}"`)
      continue
    }

    for (let i = 0; i < varianty.length; i++) {
      for (let j = i + 1; j < varianty.length; j++) {
        const a = poradia[varianty[i]], b = poradia[varianty[j]]
        const s = stat.get(kluc(varianty[i], varianty[j]))
        s.prekryv.push(prekryv(a, b))
        s.top1.push(a[0] === b[0] ? 1 : 0)
        s.zhodne.push(rovnakePoradie(a, b) ? 1 : 0)
      }
    }
    detail.push({ id: q.id, otazka: q.question, poradia })
    process.stdout.write(`\r${INFO} spracované ${n + 1}/${otazky.length}   `)
  }
  console.log("\n")

  const riadky = [...stat.entries()]
    .filter(([, s]) => s.prekryv.length)
    .map(([k, s]) => ({ dvojica: k, prekryv: priemer(s.prekryv), top1: priemer(s.top1), zhodne: priemer(s.zhodne) }))
    .sort((a, b) => a.prekryv - b.prekryv)

  if (!riadky.length) {
    console.log(`${FAIL} Nič sa nezmeralo — všetky otázky zlyhali alebo nevrátili výsledky.`)
    process.exitCode = 1
  } else {
    const sirka = Math.max(...riadky.map(r => r.dvojica.length), 10)
    console.log("─".repeat(sirka + 42))
    console.log(`${"dvojica".padEnd(sirka)}   prekryv@${TOPK}   rovnaké #1   identické poradie`)
    console.log("─".repeat(sirka + 42))
    for (const r of riadky)
      console.log(`${r.dvojica.padEnd(sirka)}   ${pct(r.prekryv).padStart(9)}   ${pct(r.top1).padStart(10)}   ${pct(r.zhodne).padStart(17)}`)
    console.log("─".repeat(sirka + 42))
    console.log(`\n${INFO} zmeraných otázok: ${detail.length}` +
                (zlyhane ? ` · zlyhaných: ${zlyhane}` : "") +
                (prazdne ? ` · bez výsledkov: ${prazdne}` : ""))

    const medzi = riadky.filter(r => !r.dvojica.includes(BEZ))
    const najnizsi = medzi.length ? Math.min(...medzi.map(r => r.prekryv)) : 1
    const rerankVplyv = riadky.filter(r => r.dvojica.includes(BEZ))
    const najvyssiBez = rerankVplyv.length ? Math.max(...rerankVplyv.map(r => r.prekryv)) : 0

    console.log()
    if (najnizsi >= 0.9) {
      console.log(`${OK} Modely sa zhodujú (najnižší prekryv medzi nimi ${pct(najnizsi)}).`)
      console.log(`   Výber modelu je bezpredmetný — zostať na rerank-2, tému zavrieť.`)
    } else if (najnizsi >= 0.7) {
      console.log(`${INFO} Modely sa čiastočne rozchádzajú (najnižší prekryv ${pct(najnizsi)}).`)
      console.log(`   Rozdiel je merateľný, ale bez zlatej sady sa nedá povedať, ktorým smerom je lepší.`)
    } else {
      console.log(`${INFO} Modely sa výrazne rozchádzajú (najnižší prekryv ${pct(najnizsi)}).`)
      console.log(`   Výber modelu má reálny dopad → dotlačiť vyplnenie goldChunkIds (D9).`)
    }
    if (najvyssiBez >= 0.9) {
      console.log(`\n${INFO} Pozor: rerank mení poradie len málo (prekryv s „${BEZ}" až ${pct(najvyssiBez)}).`)
      console.log(`   Otázka potom nie je ktorý model, ale či sa ten krok oplatí platiť.`)
    }
  }

  if (ULOZIT && detail.length) {
    mkdirSync(VYSLEDKY, { recursive: true })
    const out = resolve(VYSLEDKY, `rerank_compare_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`)
    writeFileSync(out, JSON.stringify({ kedy: new Date().toISOString(), rola: ROLA, topK: TOPK, modely: MODELY, suhrn: riadky, detail }, null, 2))
    console.log(`\n${OK} Uložené: ${out}`)
  }

} catch (e) {
  console.error(`\n${FAIL} ${e.message}`)
  process.exitCode = 1
} finally {
  await client.close()
}
