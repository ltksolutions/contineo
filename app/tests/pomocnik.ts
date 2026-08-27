/**
 * pomocnik.ts — most medzi pôvodným tvarom testov a Vitestom.
 *
 * Suity v tomto projekte sú písané ako `t("popis", podmienka)`. Je to čitateľné
 * a popisy sú po slovensky, takže sa výpis dá prečítať bez znalosti anglických
 * matcherov. Pri prechode na Vitest sme ich **neprepisovali** — 2 200 riadkov
 * ručne prepísaných tvrdení je 2 200 príležitostí na preklep, a testy sú práve
 * to miesto, kde sa preklep neprejaví zlyhaním, ale falošným pokojom.
 *
 * `t()` teda zostáva a len registruje test do Vitestu.
 *
 * **Nové testy píš idiomaticky** — `expect(skutocne).toBe(ocakavane)` dá pri
 * zlyhaní rozdiel dvoch hodnôt, kým `t()` vie povedať len „nebola pravda".
 */
import { it, expect } from "vitest"

export function t(nazov: string, ok: boolean, extra = ""): void {
  it(nazov, () => {
    // Porovnávame reťazce, nie boolean: pri zlyhaní tak Vitest vypíše
    // `extra` ako skutočnú hodnotu namiesto neužitočného `false !== true`.
    expect(ok ? "OK" : (extra || "podmienka nebola splnená")).toBe("OK")
  })
}
