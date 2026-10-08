/**
 * valueSelect.test.ts — zlúčenie zaškrtnutých a nových hodnôt a varovanie
 * pri podobnom názve (ZAKLAD-vyber-skupin-a-znaciek, 8. 10. 2026).
 */
import { describe, it, expect } from "vitest"
import { readValues, similarValue, splitSimilar } from "../src/lib/valueSelect"

const form = (pairs: [string, string][]) => { const fd = new FormData(); for (const [k, v] of pairs) fd.append(k, v); return fd }

describe("readValues", () => {
  it("zaškrtnuté, nové čiarkou a starý tvar a, b v jednom poli", () => {
    const r = readValues(form([["groups", "rozhodcovia"], ["groups", "delegati, komisari"], ["groupsNew", "media; dobrovolnici"]]), "groups")
    expect(r.picked).toEqual(["rozhodcovia", "delegati", "komisari"])
    expect(r.fresh).toEqual(["media", "dobrovolnici"])
    expect(r.forced).toEqual([])
  })
})

describe("similarValue", () => {
  it("rovnaké bez diakritiky a veľkých písmen, alebo jedno písmeno od dĺžky 5", () => {
    expect(similarValue("Rozhodcovia", ["rozhodcovia"])).toBeNull() // tá istá hodnota = výber
    expect(similarValue("rozhodcová", ["rozhodcova"])).toBe("rozhodcova")
    expect(similarValue("rozhodcova", ["rozhodcovia"])).toBe("rozhodcovia")
    expect(similarValue("media", ["medic"])).toBe("medic")
    expect(similarValue("tim", ["tom"])).toBeNull() // krátke sa neporovnávajú o písmeno
    expect(similarValue("komisari", ["rozhodcovia"])).toBeNull()
  })
})

describe("splitSimilar", () => {
  it("podobnú novú neuloží, vynútenú áno", () => {
    expect(splitSimilar(["rozhodcova", "media"], ["rozhodcovia"], [])).toEqual({ keep: ["media"], similar: [{ value: "rozhodcova", like: "rozhodcovia" }] })
    expect(splitSimilar(["rozhodcova"], ["rozhodcovia"], ["rozhodcova"])).toEqual({ keep: ["rozhodcova"], similar: [] })
  })
})
