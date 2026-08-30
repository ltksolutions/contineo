/**
 * ts-hook.mjs — dovolí skriptom importovať moduly zo `src/` priamo.
 *
 * Node 26 vie TypeScript spustiť sám (odstráni typy), ale nevie dohľadať
 * bezprípónové relatívne importy — `import { x } from "./mongodb"` — lebo ESM
 * príponu vyžaduje. TypeScript ju naopak nechce. Tento háčik ten rozdiel
 * premostí: keď špecifikátor príponu nemá, skúsi `.ts`, `.mjs` a `.js`.
 *
 * **Prečo to stojí za tých dvadsať riadkov:** bez neho by skripty museli mať
 * vlastnú kópiu pravidiel — napríklad toho, ktorá verzia dokumentu platí.
 * Dve implementácie právneho pravidla sa raz rozídu a nikto si to nevšimne,
 * lebo obe „fungujú". Takto je pravidlo jedno.
 *
 * Použitie:
 *     node --import ./scripts/lib/ts-hook.mjs scripts/import_persons.mjs …
 */

import { register } from "node:module"
import { pathToFileURL } from "node:url"
import { existsSync } from "node:fs"

const EXTENSIONS = [".ts", ".mjs", ".js", "/index.ts"]

register(
  "data:text/javascript," + encodeURIComponent(`
    export async function resolve(specifier, context, nextResolve) {
      const relativny = specifier.startsWith("./") || specifier.startsWith("../")
      const maPriponu = /\\.[cm]?[jt]s$/.test(specifier)
      if (relativny && !maPriponu && context.parentURL) {
        for (const p of ${JSON.stringify(EXTENSIONS)}) {
          try { return await nextResolve(specifier + p, context) } catch {}
        }
      }
      return nextResolve(specifier, context)
    }
  `),
  pathToFileURL("./")
)

// `existsSync` sa nepoužíva priamo — je tu ako pripomienka, že háčik nič
// nekontroluje dopredu a spolieha sa na to, že `nextResolve` zlyhá.
void existsSync
