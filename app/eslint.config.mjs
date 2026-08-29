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
