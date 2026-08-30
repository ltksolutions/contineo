/**
 * meta.mjs — načítanie a validácia metadát dokumentu.
 *
 * Zásada: **názov súboru NIE JE dátový vstup.** Je to náhodný artefakt —
 * môže obsahovať diakritiku, medzery, verziu, čokoľvek. Metadáta musia
 * prísť z `<dokument>.meta.json`, inak sa dokument nespracuje.
 *
 * Hodnoty sa validujú proti číselníkom v app/src/codelists/ — čo tam nie je,
 * neprejde (zásada „closed vocabulary" z CISELNIKY_governance.md).
 */
import { readFileSync, existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const CODELISTS = resolve(HERE, "../../src/codelists")

export const REQUIRED = ["title", "sectionKey", "companyCode", "scope", "accessLevel", "language"]

/** Načíta číselník a vráti množinu povolených kľúčov. */
export function loadCodelist(name) {
  const path = join(CODELISTS, `${name}.json`)
  if (!existsSync(path)) return null
  const data = JSON.parse(readFileSync(path, "utf8"))
  return {
    kluce: new Set((data.items ?? []).map(i => i.key)),
    uzavrety: data.closed !== false,
    polozky: data.items ?? [],
  }
}

export function metaPath(mdFile) {
  return mdFile.replace(/\.md$/i, "") + ".meta.json"
}

/**
 * Načíta metadáta k dokumentu. Vyhodí zrozumiteľnú chybu, ak chýbajú
 * alebo obsahujú hodnotu mimo číselníka.
 */
export function loadMeta(mdFile) {
  const path = metaPath(mdFile)
  if (!existsSync(path)) {
    throw new Error(
      `Chýba súbor s metadátami: ${path}\n` +
      `  Názov súboru sa zámerne nepoužíva ako zdroj metadát.\n` +
      `  Šablónu vytvoríš: node scripts/chunk_preview.mjs ${mdFile} --vytvor-meta`
    )
  }

  let meta
  try {
    meta = JSON.parse(readFileSync(path, "utf8"))
  } catch (e) {
    throw new Error(`${path} nie je platný JSON: ${e.message}`)
  }

  const errors = []
  for (const p of REQUIRED) {
    if (!meta[p] || String(meta[p]).trim() === "") errors.push(`chýba povinné pole "${p}"`)
  }

  // Validácia proti číselníkom.
  for (const [field, codelist] of [
    ["sectionKey", "sectionKey"],
    ["companyCode", "companyCode"],
    ["scope", "scope"],
    ["accessLevel", "accessLevel"],
    ["category", "category"],
    ["sourceType", "sourceType"],
  ]) {
    const value = meta[field]
    if (!value) continue
    const c = loadCodelist(codelist)
    if (!c) continue
    if (!c.kluce.has(value)) {
      const draft = [...c.kluce].slice(0, 8).join(", ")
      errors.push(
        `"${field}": hodnota "${value}" nie je v číselníku ${codelist}.json\n` +
        `      povolené (ukážka): ${draft}${c.kluce.size > 8 ? ", …" : ""}` +
        (c.uzavrety ? "" : `\n      číselník je rozšíriteľný — novú hodnotu doplň cez governance`)
      )
    }
  }

  if (errors.length) {
    throw new Error(`Metadáta v ${path} nie sú v poriadku:\n  - ` + errors.join("\n  - "))
  }
  return meta
}

/** Šablóna na vyplnenie — hodnoty sú zástupné, nie odhad z názvu súboru. */
export function metaTemplate() {
  return {
    title: "",
    sectionKey: "",
    companyCode: "",
    scope: "global",
    accessLevel: "public",
    language: "sk",
    category: "norma",
    sourceType: "pdf",
    sourceUrl: "",
    effectiveFrom: "",
    effectiveTo: null,
  }
}
