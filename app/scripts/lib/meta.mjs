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

export const POVINNE = ["title", "sectionKey", "companyCode", "scope", "accessLevel", "language"]

/** Načíta číselník a vráti množinu povolených kľúčov. */
export function nacitajCiselnik(nazov) {
  const cesta = join(CODELISTS, `${nazov}.json`)
  if (!existsSync(cesta)) return null
  const data = JSON.parse(readFileSync(cesta, "utf8"))
  return {
    kluce: new Set((data.items ?? []).map(i => i.key)),
    uzavrety: data.closed !== false,
    polozky: data.items ?? [],
  }
}

export function cestaMeta(suborMd) {
  return suborMd.replace(/\.md$/i, "") + ".meta.json"
}

/**
 * Načíta metadáta k dokumentu. Vyhodí zrozumiteľnú chybu, ak chýbajú
 * alebo obsahujú hodnotu mimo číselníka.
 */
export function nacitajMeta(suborMd) {
  const cesta = cestaMeta(suborMd)
  if (!existsSync(cesta)) {
    throw new Error(
      `Chýba súbor s metadátami: ${cesta}\n` +
      `  Názov súboru sa zámerne nepoužíva ako zdroj metadát.\n` +
      `  Šablónu vytvoríš: node scripts/chunk_preview.mjs ${suborMd} --vytvor-meta`
    )
  }

  let meta
  try {
    meta = JSON.parse(readFileSync(cesta, "utf8"))
  } catch (e) {
    throw new Error(`${cesta} nie je platný JSON: ${e.message}`)
  }

  const chyby = []
  for (const p of POVINNE) {
    if (!meta[p] || String(meta[p]).trim() === "") chyby.push(`chýba povinné pole "${p}"`)
  }

  // Validácia proti číselníkom.
  for (const [pole, ciselnik] of [
    ["sectionKey", "sectionKey"],
    ["companyCode", "companyCode"],
    ["scope", "scope"],
    ["accessLevel", "accessLevel"],
    ["category", "category"],
    ["sourceType", "sourceType"],
  ]) {
    const hodnota = meta[pole]
    if (!hodnota) continue
    const c = nacitajCiselnik(ciselnik)
    if (!c) continue
    if (!c.kluce.has(hodnota)) {
      const navrh = [...c.kluce].slice(0, 8).join(", ")
      chyby.push(
        `"${pole}": hodnota "${hodnota}" nie je v číselníku ${ciselnik}.json\n` +
        `      povolené (ukážka): ${navrh}${c.kluce.size > 8 ? ", …" : ""}` +
        (c.uzavrety ? "" : `\n      číselník je rozšíriteľný — novú hodnotu doplň cez governance`)
      )
    }
  }

  if (chyby.length) {
    throw new Error(`Metadáta v ${cesta} nie sú v poriadku:\n  - ` + chyby.join("\n  - "))
  }
  return meta
}

/** Šablóna na vyplnenie — hodnoty sú zástupné, nie odhad z názvu súboru. */
export function sablonaMeta() {
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
