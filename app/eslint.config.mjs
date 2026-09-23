/**
 * eslint.config.mjs — plochá konfigurácia (ESLint 9, Next 16).
 *
 * `next lint` v Next 16 už neexistuje: slovo „lint" si vyloží ako názov
 * priečinka a skončí hláškou „Invalid project directory provided, no such
 * directory: …/app/lint". Volá sa preto priamo `eslint`, a ten potrebuje
 * vlastnú konfiguráciu — predtým ju mlčky dodával Next.
 *
 * `eslint-config-next` je od verzie 16 už v plochom tvare, takže kompatibilná
 * vrstva netreba; stačí ho rozbaliť.
 */

import coreWebVitals from "eslint-config-next/core-web-vitals"
import typescript from "eslint-config-next/typescript"

const konfiguracia = [
  {
    // Generované a cudzie veci sa nekontrolujú. Chyby v nich sa nedajú
    // opraviť a zaplavili by výpis natoľko, že by sa v ňom prehliadli tie
    // vlastné.
    ignores: [".next/**", "node_modules/**", "public/**", "coverage/**"],
  },

  ...coreWebVitals,
  ...typescript,

  {
    /**
     * Použitie premennej nad jej deklaráciou je **chyba, nie štýl**.
     *
     * 23. 9. 2026 na tom spadla produkčná knižnica s akýmkoľvek filtrom:
     * `activeNames` siahalo na `facetLabel`, ktorý vznikal o sedemdesiat
     * riadkov nižšie. Pole sa vyhodnocuje v mieste zápisu, takže `.map`
     * bežal ihneď a `facetLabel` bol ešte v dočasnej mŕtvej zóne.
     *
     * **TypeScript to nevie chytiť a nie je to jeho chyba.** `TS2448` hlási
     * len priamy odkaz v tom istom mieste; náš odkaz bol vnútri callbacku
     * a telo funkcie je pre kompilátor odložené vykonanie — nemá ako vedieť,
     * že ten callback sa zavolá hneď a nie o hodinu. Testy tú stránku
     * nevykresľujú, takže ju nechytili tiež.
     *
     * ESLint to rieši hrubšie: neuvažuje, kedy sa callback zavolá, a ohlási
     * samotný odkaz nahor. Práve tá hrubosť je tu cenná.
     *
     * `functions: false`, lebo deklarácie funkcií sa vyťahujú nahor a volať
     * ich zhora nadol je v tomto repozitári bežné a bezpečné. `typedefs`
     * a `enums` sú typy, tie za behu neexistujú.
     */
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Základné pravidlo musí ísť preč, inak hlásia obe naraz.
      "no-use-before-define": "off",
      "@typescript-eslint/no-use-before-define": [
        "error",
        {
          functions: false,
          classes: false,
          typedefs: false,
          enums: false,
          variables: true,
          allowNamedExports: true,
        },
      ],
    },
  },

  {
    /**
     * V testoch je `any` nástroj, nie nedbalosť.
     *
     * Atrapa má úmyselne nesprávny tvar — testuje sa práve to, čo sa stane,
     * keď príde niečo iné, než čo typ sľubuje. Vynútiť tu presné typy by
     * znamenalo písať atrapy, ktoré nikdy nepadnú, a tým testovať typový
     * systém namiesto kódu.
     */
    files: ["tests/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },

  {
    /**
     * Adaptéry cudzích API — `any` je tu **dlh, nie zámer**.
     *
     * Odpovede OpenAI, Anthropicu a Bedrocku sa parsujú z JSON-u, ktorý nemá
     * typ; správne by bolo `unknown` a zúženie. Prepísať to naraz by ale
     * znamenalo siahnuť do každej generujúcej cesty bez toho, aby sa čokoľvek
     * z toho dalo overiť inak než v produkcii. Zostáva to preto ako výstraha —
     * viditeľná v každom behu, ale nezastavuje nasadenie — kým sa adaptéry
     * nebudú meniť z iného dôvodu.
     */
    files: ["src/lib/providers/**"],
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
]

export default konfiguracia
