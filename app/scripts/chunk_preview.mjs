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
import { chunkuj, odhadTokenov } from "./lib/chunker.mjs"
import { nacitajMeta, sablonaMeta, cestaMeta } from "./lib/meta.mjs"

const args = process.argv.slice(2)
const subor = args.find(a => !a.startsWith("--"))
const cislo = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? Number(args[i + 1]) : d }
const pocet = cislo("--pocet", 3)
const cely = cislo("--cely", -1)
const lenProblemy = args.includes("--problemy")

if (!subor) {
  console.error("Použitie: node scripts/chunk_preview.mjs <subor.md> [--pocet N] [--cely N] [--problemy] [--vytvor-meta]")
  process.exit(1)
}

// Vytvorenie šablóny metadát — hodnoty NEODHADUJEME z názvu súboru.
if (args.includes("--vytvor-meta")) {
  const cesta = cestaMeta(subor)
  if (existsSync(cesta)) {
    console.error(`${cesta} už existuje — nechcem ho prepísať.`)
    process.exit(1)
  }
  writeFileSync(cesta, JSON.stringify(sablonaMeta(), null, 2) + "\n", "utf8")
  console.log(`Vytvorená šablóna: ${cesta}`)
  console.log("Vyplň ju — najmä title, sectionKey a companyCode (hodnoty z číselníkov).")
  process.exit(0)
}

let meta
try {
  meta = nacitajMeta(subor)
} catch (e) {
  console.error(`\n${e.message}\n`)
  process.exit(1)
}

const text = readFileSync(subor, "utf8")
const { chunky, statistiky: s } = chunkuj(text, { nazovDokumentu: meta.title })

const ciara = (z = "─") => console.log(z.repeat(74))

console.log(`\nSúbor: ${subor}`)
console.log(`Dokument: ${meta.title}`)
console.log(`Tagy: ${meta.sectionKey} · ${meta.companyCode} · ${meta.scope} · ${meta.accessLevel}`)
ciara()
console.log("ČISTENIE")
console.log(`  odstránené hlavičky/päty:   ${s.odstranene.hlavicka}`)
console.log(`  odstránené čísla strán:     ${s.odstranene.cisloStrany}`)
console.log(`  odstránené poznámky p. č.:  ${s.odstranene.poznamka}`)
console.log(`  riadkov po očistení:        ${s.riadkovPoOcisteni}`)
ciara()
console.log("ŠTRUKTÚRA")
console.log(`  jednotiek: ${s.clankov}  (z toho príloh: ${s.priloh})`)
console.log(`  chunkov:   ${s.chunkov}`)
ciara()
console.log("VEĽKOSTI (odhad tokenov, cieľ 300–800)")
console.log(`  min ${s.tokenyMin} · priemer ${s.tokenyPriemer} · max ${s.tokenyMax}`)
console.log(`  nad 800:            ${s.nadLimit}${s.nadLimit ? "  ← pozri --problemy" : ""}`)
console.log(`  krátke úlomky:      ${s.kratkeUlomky}${s.kratkeUlomky ? "  ← pozri --problemy" : ""}`)
console.log(`  krátke úplné články: ${s.kratkeUplne}  (v poriadku — celý článok je dobrý chunk)`)
ciara()

if (cely >= 0) {
  const ch = chunky[cely]
  if (!ch) { console.error(`Chunk ${cely} neexistuje (0–${chunky.length - 1}).`); process.exit(1) }
  console.log(`CHUNK ${cely}  ·  ${odhadTokenov(ch.text)} tokenov  ·  ${ch.articleRef ?? "—"}`)
  ciara()
  console.log(ch.text)
  ciara()
  process.exit(0)
}

// Problém = nad limitom, alebo krátky ÚLOMOK. Krátky úplný článok problém nie je.
const vyber = lenProblemy
  ? chunky.filter(c => { const t = odhadTokenov(c.text); return t > 800 || (!c.uplnaJednotka && t < 300) })
  : chunky.slice(0, pocet)

if (lenProblemy) {
  console.log(`PROBLÉMOVÉ CHUNKY (${vyber.length} z ${chunky.length})`)
  if (!vyber.length) console.log("  žiadne — všetky sú v rozsahu 300–800 tokenov")
}

for (const ch of vyber.slice(0, lenProblemy ? 12 : pocet)) {
  const t = odhadTokenov(ch.text)
  const znak = t > 800 ? "  ⚠ nad limit" : t < 300 ? "  ⚠ pod limit" : ""
  console.log(`\n[${ch.chunkIndex}]  ${t} tokenov${znak}`)
  console.log(`  articleRef: ${ch.articleRef ?? "—"}${ch.typ === "priloha" ? "   (príloha)" : ""}`)
  console.log(`  heading:    ${ch.heading}`)
  console.log(`  časť:       ${ch.cast ?? "—"}`)
  console.log(`  ── text ──`)
  const ukazka = ch.text.length > 600 ? ch.text.slice(0, 600) + "\n  […]" : ch.text
  console.log(ukazka.split("\n").map(r => "  " + r).join("\n"))
}

console.log()
if (!lenProblemy) {
  console.log(`Celý chunk:  node scripts/chunk_preview.mjs ${subor} --cely 12`)
  console.log(`Len problémy: node scripts/chunk_preview.mjs ${subor} --problemy`)
}
