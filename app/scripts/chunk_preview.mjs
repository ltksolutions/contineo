/**
 * chunk_preview.mjs — ukáže, ako sa dokument rozseká, BEZ zápisu do databázy.
 *
 *     node scripts/chunk_preview.mjs data/vzorky/rapp.md
 *     node scripts/chunk_preview.mjs data/vzorky/rapp.md --pocet 5
 *     node scripts/chunk_preview.mjs data/vzorky/rapp.md --cely 12
 *     node scripts/chunk_preview.mjs data/vzorky/rapp.md --problemy
 *
 * Zmyslom je pozrieť sa človekom na to, či delenie dáva zmysel, skôr než
 * sa čokoľvek naimportuje. Chunkovanie má najväčší jediný vplyv na kvalitu
 * vyhľadávania (D1) a chybu v ňom neskôr ťažko odhalíš.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { chunkText, estimateTokens } from "./lib/chunker.mjs"
import { loadMeta, metaTemplate, metaPath } from "./lib/meta.mjs"

const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith("--"))
const num = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? Number(args[i + 1]) : d }
const count = num("--pocet", 3)
const whole = num("--cely", -1)
const onlyProblems = args.includes("--problemy")

if (!file) {
  console.error("Použitie: node scripts/chunk_preview.mjs <subor.md> [--pocet N] [--cely N] [--problemy] [--vytvor-meta]")
  process.exit(1)
}

// Vytvorenie šablóny metadát — hodnoty NEODHADUJEME z názvu súboru.
if (args.includes("--vytvor-meta")) {
  const path = metaPath(file)
  if (existsSync(path)) {
    console.error(`${path} už existuje — nechcem ho prepísať.`)
    process.exit(1)
  }
  writeFileSync(path, JSON.stringify(metaTemplate(), null, 2) + "\n", "utf8")
  console.log(`Vytvorená šablóna: ${path}`)
  console.log("Vyplň ju — najmä title, sectionKey a companyCode (hodnoty z číselníkov).")
  process.exit(0)
}

let meta
try {
  meta = loadMeta(file)
} catch (e) {
  console.error(`\n${e.message}\n`)
  process.exit(1)
}

const text = readFileSync(file, "utf8")
const { chunky: chunks, statistiky: s } = chunkText(text, { nazovDokumentu: meta.title })

const rule = (z = "─") => console.log(z.repeat(74))

console.log(`\nSúbor: ${file}`)
console.log(`Dokument: ${meta.title}`)
console.log(`Tagy: ${meta.sectionKey} · ${meta.companyCode} · ${meta.scope} · ${meta.accessLevel}`)
rule()
console.log("ČISTENIE")
console.log(`  odstránené hlavičky/päty:   ${s.odstranene.hlavicka}`)
console.log(`  odstránené čísla strán:     ${s.odstranene.cisloStrany}`)
console.log(`  odstránené poznámky p. č.:  ${s.odstranene.poznamka}`)
console.log(`  riadkov po očistení:        ${s.riadkovPoOcisteni}`)
rule()
console.log("ŠTRUKTÚRA")
console.log(`  jednotiek: ${s.clankov}  (z toho príloh: ${s.priloh})`)
console.log(`  chunkov:   ${s.chunkov}`)
rule()
console.log("VEĽKOSTI (odhad tokenov, cieľ 300–800)")
console.log(`  min ${s.tokenyMin} · priemer ${s.tokenyPriemer} · max ${s.tokenyMax}`)
console.log(`  nad 800:            ${s.nadLimit}${s.nadLimit ? "  ← pozri --problemy" : ""}`)
console.log(`  krátke úlomky:      ${s.kratkeUlomky}${s.kratkeUlomky ? "  ← pozri --problemy" : ""}`)
console.log(`  krátke úplné články: ${s.kratkeUplne}  (v poriadku — celý článok je dobrý chunk)`)
rule()

if (whole >= 0) {
  const ch = chunks[whole]
  if (!ch) { console.error(`Chunk ${whole} neexistuje (0–${chunks.length - 1}).`); process.exit(1) }
  console.log(`CHUNK ${whole}  ·  ${estimateTokens(ch.text)} tokenov  ·  ${ch.articleRef ?? "—"}`)
  rule()
  console.log(ch.text)
  rule()
  process.exit(0)
}

// Problém = nad limitom, alebo krátky ÚLOMOK. Krátky úplný článok problém nie je.
const pick = onlyProblems
  ? chunks.filter(c => { const t = estimateTokens(c.text); return t > 800 || (!c.uplnaJednotka && t < 300) })
  : chunks.slice(0, count)

if (onlyProblems) {
  console.log(`PROBLÉMOVÉ CHUNKY (${pick.length} z ${chunks.length})`)
  if (!pick.length) console.log("  žiadne — všetky sú v rozsahu 300–800 tokenov")
}

for (const ch of pick.slice(0, onlyProblems ? 12 : count)) {
  const t = estimateTokens(ch.text)
  const mark = t > 800 ? "  ⚠ nad limit" : t < 300 ? "  ⚠ pod limit" : ""
  console.log(`\n[${ch.chunkIndex}]  ${t} tokenov${mark}`)
  console.log(`  articleRef: ${ch.articleRef ?? "—"}${ch.typ === "priloha" ? "   (príloha)" : ""}`)
  console.log(`  heading:    ${ch.heading}`)
  console.log(`  časť:       ${ch.cast ?? "—"}`)
  console.log(`  ── text ──`)
  const sample = ch.text.length > 600 ? ch.text.slice(0, 600) + "\n  […]" : ch.text
  console.log(sample.split("\n").map(r => "  " + r).join("\n"))
}

console.log()
if (!onlyProblems) {
  console.log(`Celý chunk:  node scripts/chunk_preview.mjs ${file} --cely 12`)
  console.log(`Len problémy: node scripts/chunk_preview.mjs ${file} --problemy`)
}
