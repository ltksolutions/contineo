/**
 * copy_pdfjs_assets.mjs — pomocné súbory pdf.js do `public/pdfjs/`.
 *
 * `PdfPages` (PDF znenia na stránke) ich pdf.js dáva ako adresy: CMapy
 * a štandardné písma pre PDF s nevloženým písmom, dekodéry JPEG 2000 / JBIG2
 * pre skeny a farebný profil. Bundler ich nevidí — pdf.js si ich doťahuje
 * za behu podľa adresy —, takže musia ležať ako statické súbory.
 *
 * Kopírujú sa pred `dev` aj `build` (`predev`, `prebuild` v `package.json`)
 * z tej istej verzie `pdfjs-dist`, ktorá je v `node_modules`, takže sa
 * s knižnicou nerozídu. Do gitu nejdú (`.gitignore`) — 4 MB binárok, ktoré
 * vie ktokoľvek kedykoľvek vyrobiť znova.
 */

import { cpSync, rmSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"

const source = new URL("../node_modules/pdfjs-dist/", import.meta.url)
const target = new URL("../public/pdfjs/", import.meta.url)

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  cpSync(new URL(`${dir}/`, source), new URL(`${dir}/`, target), { recursive: true })
}
console.log(`[pdfjs] pomocné súbory skopírované do ${fileURLToPath(target)}`)
