/**
 * vitest.config.mjs — testy pre marketingový web.
 *
 * Úmyselne úzke. `web/` sú hlavne prezentačné komponenty; testovať sa oplatí
 * len to, čo naozaj niečo počíta alebo čo sa dá ticho pokaziť pri písaní
 * obsahu. Sú to dve veci: **zhoda kľúčov medzi jazykmi** (tri slovníky,
 * 2300 riadkov — pridať kľúč do `sk` a zabudnúť na `cs`/`en` je otázka času)
 * a **`skrat()`**, ktorý má v komentári zapísanú minulú chybu s rezaním
 * uprostred slova.
 *
 * Alias `@/` je v `jsconfig.json`, ale Vitest o ňom sám nevie — rovnaký
 * dôvod aj rovnaké riešenie ako v `app/vitest.config.mts`.
 */
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.mjs"],
  },
})
