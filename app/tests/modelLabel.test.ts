import { describe, it, expect } from "vitest"
import { modelLabel } from "../src/lib/aiSettings"

describe("modelLabel — názov modelu pre človeka", () => {
  it("známy model má názov z ponuky", () => {
    expect(modelLabel("claude-opus-5-5")).toBe("Claude Opus 5.5")
    expect(modelLabel("claude-haiku-4-5-20251001")).toBe("Claude Haiku 4.5")
  })
  it("neznámy (starší) model ostane identifikátorom", () => {
    expect(modelLabel("claude-legacy-1")).toBe("claude-legacy-1")
  })
})
