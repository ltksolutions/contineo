/**
 * ts-hook.mjs — dovolí skriptom importovať moduly zo `src/` priamo.
 *
 * Node 26 vie TypeScript spustiť sám (odstráni typy), ale nevie dohľadať
 * bezpríponové relatívne importy — `import { x } from "./mongodb"` — lebo ESM
 * príponu vyžaduje. TypeScript ju naopak nechce. Tento háčik ten rozdiel
 * premostí: keď špecifikátor príponu nemá, skúsi `.ts`, `.mjs`, `.js`, `.json`.
 *
 * Rieši ešte dve veci, ktoré s tým súvisia:
 *
 * 1. **Alias `@/`**, ktorý má aplikácia v `tsconfig.json` a Node ho nepozná.
 *    Bez neho spadne každý skript, ktorý sa čo i len nepriamo dotkne
 *    `src/lib/codelists.ts` — tá načítava `@/codelists/*.json`. Zlyhanie
 *    pritom nevyzerá ako alias, ale ako chýbajúci balík
 *    (`Cannot find package '@/codelists'`), takže sa hľadá zle.
 *
 * 2. **`with { type: "json" }`** pri číselníkoch. ESM bez tejto vlastnosti
 *    JSON odmietne; TypeScript ani Next ju nevyžadujú, takže v zdrojoch nie
 *    je — a dopisovať ju tam kvôli skriptom by bola daň za niečo, čo
 *    aplikácia nepotrebuje. Dopĺňa sa preto tu.
 *
 * **Prečo to stojí za tých pár riadkov:** bez neho by skripty museli mať
 * vlastnú kópiu pravidiel — napríklad toho, ktorá verzia dokumentu platí,
 * alebo ktoré hodnoty číselník pripúšťa. Dve implementácie toho istého
 * pravidla sa raz rozídu a nikto si to nevšimne, lebo obe „fungujú".
 *
 * Použitie:
 *     node --import ./scripts/lib/ts-hook.mjs scripts/import_persons.mjs …
 */

import { register } from "node:module"
import { pathToFileURL } from "node:url"

const EXTENSIONS = [".ts", ".mjs", ".js", ".json", "/index.ts"]

/** Kam ukazuje `@/`. Musí sedieť s `paths` v `tsconfig.json`. */
const SRC = new URL("../../src/", import.meta.url).href

register(
  "data:text/javascript," + encodeURIComponent(`
    const SRC = ${JSON.stringify(SRC)}
    const EXTENSIONS = ${JSON.stringify(EXTENSIONS)}

    /**
     * Vlastnosť importu sa vracia **vo výsledku** hooku, nie v kontexte,
     * ktorý sa podáva ďalej. Podanie v kontexte sa tvári, že funguje, ale
     * \`load\` ho neuvidí a chyba zostane rovnaká — stálo to jeden pokus.
     */
    function sJson(result) {
      return result?.url?.endsWith(".json")
        ? { ...result, importAttributes: { ...result.importAttributes, type: "json" } }
        : result
    }

    export async function resolve(specifier, context, nextResolve) {
      const ciel = specifier.startsWith("@/") ? SRC + specifier.slice(2) : specifier

      const dohladatelny =
        ciel.startsWith("./") || ciel.startsWith("../") || ciel.startsWith("file:")
      const maPriponu = /\\.([cm]?[jt]s|json)$/.test(ciel)

      if (dohladatelny && !maPriponu && context.parentURL) {
        for (const p of EXTENSIONS) {
          try { return sJson(await nextResolve(ciel + p, context)) } catch {}
        }
      }
      return sJson(await nextResolve(ciel, context))
    }
  `),
  pathToFileURL("./"),
)
