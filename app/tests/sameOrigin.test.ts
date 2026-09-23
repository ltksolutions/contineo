/**
 * sameOrigin.test.ts — ochrana ciest, ktoré zapisujú, pred požiadavkou z cudzej stránky.
 */
import { describe, it, expect } from "vitest"
import { sameOrigin } from "../src/lib/sameOrigin"

const h = (o: Record<string, string>) => new Headers(o)

describe("sameOrigin", () => {
  it("vlastná stránka prejde", () => {
    expect(sameOrigin(h({ origin: "https://intranet.futbalsfz.sk", host: "intranet.futbalsfz.sk" }))).toBe(true)
  })
  it("za proxy rozhoduje x-forwarded-host", () => {
    expect(sameOrigin(h({ origin: "https://intranet.futbalsfz.sk", host: "internal:3000", "x-forwarded-host": "intranet.futbalsfz.sk" }))).toBe(true)
  })
  it("lokálne s portom", () => {
    expect(sameOrigin(h({ origin: "http://sfz.localhost:3000", host: "sfz.localhost:3000" }))).toBe(true)
  })
  it("cudzia stránka neprejde", () => {
    expect(sameOrigin(h({ origin: "https://zly.example", host: "intranet.futbalsfz.sk" }))).toBe(false)
  })
  it("iná organizácia na tom istom nasadení neprejde", () => {
    expect(sameOrigin(h({ origin: "https://app.contineo.app", host: "intranet.futbalsfz.sk" }))).toBe(false)
  })
  it("chýbajúci Origin sa odmieta", () => {
    expect(sameOrigin(h({ host: "intranet.futbalsfz.sk" }))).toBe(false)
  })
})
