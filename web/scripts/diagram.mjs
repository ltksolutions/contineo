/**
 * diagram.mjs — obrázok architektúry: kontrola zhody a PNG.
 *
 * Zdrojom sú **tri SVG** vo `web/public/` (sk, cs, en) a ich kópia
 * v `docs/contineo_diagram.svg`. Do 6. 10. 2026 ich mal generovať
 * `gen_diagram.py`, ale obrázok sa odvtedy dvakrát menil priamo v SVG
 * (#280, D169) a generátor zostal pri starom rozložení — spustený by
 * prepísal správny obrázok starým. Zmazaný; namiesto neho dve veci,
 * ktoré skutočný postup potrebuje:
 *
 *   node web/scripts/diagram.mjs check   — tri SVG majú rovnakú štruktúru
 *                                          (líšia sa len textom) a kópia
 *                                          v docs/ je zhodná so slovenským;
 *   node web/scripts/diagram.mjs render  — PNG zo slovenského SVG cez
 *                                          `sharp` (3040×2020) a kópia do docs/.
 *
 * Prečo kontrola štruktúry: tri ručne udržiavané kópie sa rozchádzajú
 * potichu (2026-08: `rerank-2.5` vs `rerank-2`). Keď sa po zmene jedného SVG
 * zabudne na ostatné dve, `check` to povie — to je to, čo generátor sľuboval
 * a nedodržal.
 */

import { readFileSync, writeFileSync, copyFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, "..", "..")
const PUBLIC = path.join(ROOT, "web", "public")
const FILES = {
  sk: path.join(PUBLIC, "contineo_diagram.svg"),
  cs: path.join(PUBLIC, "contineo_diagram.cs.svg"),
  en: path.join(PUBLIC, "contineo_diagram.en.svg"),
}
const DOCS_COPY = path.join(ROOT, "docs", "contineo_diagram.svg")
const PNG = path.join(PUBLIC, "contineo_diagram.png")

/** Štruktúra = SVG bez textového obsahu prvkov. */
const structure = svg => svg.replace(/>[^<]*</g, "><")

function check() {
  const svgs = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, readFileSync(f, "utf8")]))
  const problems = []
  const skStructure = structure(svgs.sk).split("\n")
  for (const lang of ["cs", "en"]) {
    const other = structure(svgs[lang]).split("\n")
    const n = Math.max(skStructure.length, other.length)
    for (let i = 0; i < n; i++) {
      if (skStructure[i] !== other[i]) { problems.push(`${lang}: riadok ${i + 1} má inú štruktúru než sk`); break }
    }
  }
  if (readFileSync(DOCS_COPY, "utf8") !== svgs.sk) problems.push("docs/contineo_diagram.svg nie je zhodná so slovenským SVG — spusti render")
  if (problems.length) { for (const p of problems) console.error("✗", p); process.exit(1) }
  console.log("✔ tri SVG majú rovnakú štruktúru, kópia v docs/ sedí")
}

async function render() {
  const require = createRequire(path.join(ROOT, "web", "package.json"))
  const sharp = require("sharp")
  const info = await sharp(FILES.sk, { density: 144 }).resize(3040, 2020).png().toFile(PNG)
  copyFileSync(FILES.sk, DOCS_COPY)
  console.log(`✔ PNG ${info.width}×${info.height}, kópia v docs/ obnovená`)
}

const cmd = process.argv[2]
if (cmd === "check") check()
else if (cmd === "render") await render()
else { console.error("použitie: node web/scripts/diagram.mjs check | render"); process.exit(2) }
