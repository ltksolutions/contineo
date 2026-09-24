/** versionLabel.test.ts — označenie znenia z dátumu účinnosti (ADR-016, D113). */
import { describe, it, expect } from "vitest"
import { autoVersionLabel } from "../src/lib/versionLabel"

const D = new Date("2027-01-01T00:00:00Z")

describe("autoVersionLabel", () => {
  it("skladá sa z dátumu účinnosti v jazyku dokumentu", () => {
    expect(autoVersionLabel(D, "sk")).toBe("znenie účinné od 1. 1. 2027")
    expect(autoVersionLabel(D, "cs")).toBe("znění účinné od 1. 1. 2027")
  })

  it("rovnaká účinnosť dostane poradie", () => {
    expect(autoVersionLabel(D, "sk", ["znenie účinné od 1. 1. 2027"])).toBe("znenie účinné od 1. 1. 2027 (2)")
    expect(autoVersionLabel(D, "sk", ["znenie účinné od 1. 1. 2027", "znenie účinné od 1. 1. 2027 (2)"]))
      .toBe("znenie účinné od 1. 1. 2027 (3)")
  })
})
