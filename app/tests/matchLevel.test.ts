/**
 * matchLevel.test.ts — zhoda zdroja v troch stupňoch (rozhodnutie Jána 2026-09-22).
 *
 * Surové `score` sa ukázať nedá: pri `$rankFusion` a `$rerank` nie je
 * v rozsahu 0–1 a medzi režimami hľadania nie je porovnateľné. Porovnateľné
 * sú zdroje **medzi sebou v jednej odpovedi** — a presne to stupeň hovorí.
 * Test stráži, že sa z toho nestane absolútna škála.
 */

import { describe, it, expect } from "vitest"
import { matchLevel } from "../src/lib/llmGenerator"

describe("stupen zhody je relativny, nie absolutny", () => {
  it("najlepsi zdroj ma vzdy vysoku zhodu — aj ked je jeho skore male", () => {
    expect(matchLevel(0.04, 0.04)).toBe("high")
    expect(matchLevel(187, 187)).toBe("high")
  })

  it("stupne sa delia podielom k najlepsiemu, nie pevnou hranicou", () => {
    expect(matchLevel(8, 10)).toBe("high")     // 80 %
    expect(matchLevel(7.9, 10)).toBe("medium")
    expect(matchLevel(5, 10)).toBe("medium")   // 50 %
    expect(matchLevel(4.9, 10)).toBe("low")
  })

  it("bez skore nie je stupen ziadny — radsej nic nez vymyslena hodnota", () => {
    expect(matchLevel(undefined, 10)).toBeUndefined()
    expect(matchLevel(5, undefined)).toBeUndefined()
    // Nulovy alebo zaporny najlepsi vysledok by dal delenie nulou.
    expect(matchLevel(5, 0)).toBeUndefined()
    expect(matchLevel(-1, -0.5)).toBeUndefined()
  })
})
