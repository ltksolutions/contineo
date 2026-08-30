/**
 * vitest.config.ts
 *
 * Nahrádza vlastný beh testov (`tests/run.mjs` + esbuild). Dôvod nebol
 * „Vitest je štandard", ale konkrétny strop: funkcie, ktoré volajú
 * `getCollection()`, sa nedali otestovať vôbec — a sú medzi nimi tie
 * najdôležitejšie (zápis potvrdenia, brána prihlásenia, hromadný import).
 * Obísť sa to dalo len tak, že by sa do verejného rozhrania každého modulu
 * pridal testovací šev; `vi.mock()` to rieši bez toho.
 */
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // `@/` funguje v Next cez `tsconfig.paths`; Vitest o tom nevie sám a bez
  // toho zlyhá každý test, ktorý sa dotkne modulu s takým importom —
  // napríklad číselníkov, ktoré sa čítajú ako JSON z `src/codelists/`.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,mjs}"],
    // Rovnaká náhrada ako mal starý beh: moduly si spojenie zostavujú až pri
    // prvom použití, ale premenná musí existovať, aby import neplakal.
    env: { MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://stub" },
  },
})
