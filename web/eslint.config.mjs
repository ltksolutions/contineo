/**
 * eslint.config.mjs — plochá konfigurácia (ESLint 9, Next 16).
 *
 * `next lint` v Next 16 už neexistuje — volá sa priamo `eslint`, a ten
 * potrebuje vlastnú konfiguráciu; predtým ju mlčky dodával Next.
 * `eslint-config-next` je od verzie 16 už v plochom tvare, takže
 * kompatibilná vrstva netreba; stačí ho rozbaliť.
 *
 * Tvar je zámerne rovnaký ako v `app/eslint.config.mjs`. Rozdiel je len
 * v tom, čo `web/` nemá: TypeScript (kód je v JavaScripte) a testy nad
 * databázou. Dovtedy bol rozdiel medzi polovicami repozitára vecou verzií
 * — `web/` bežal na Next 14, kde plochý tvar neexistoval.
 */

import coreWebVitals from "eslint-config-next/core-web-vitals"

const konfiguracia = [
  {
    // Generované a cudzie veci sa nekontrolujú. `public/` sú obrázky
    // a diagramy, `scripts/gen_diagram.py` je Python — ESLint tam nemá čo
    // hľadať a chyby by len zaplavili výpis.
    ignores: [".next/**", "node_modules/**", "public/**", "scripts/**"],
  },

  ...coreWebVitals,

  {
    /**
     * `react/no-unescaped-entities` — vypnuté zámerne.
     *
     * Apostrofy a úvodzovky sú v slovenskom, českom aj anglickom texte
     * bežné a escapovať ich v JSX by z marketingových textov spravilo
     * nečitateľnú kašu. Na webe v troch jazykoch je to šum, nie nález.
     */
    rules: { "react/no-unescaped-entities": "off" },
  },
]

export default konfiguracia
