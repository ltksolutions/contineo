/**
 * uploadLimit.test.ts — stropy nahrávania do seba zapadajú.
 *
 * **Prečo tento test existuje.** 23. 9. 2026 formulár sľuboval 32 MB, Next
 * pustil 1 MB a Vercel by pustil 4,5 MB — tri čísla, ktoré o sebe nevedeli,
 * a nahrávanie z rozhrania padalo s chybou servera. Od ADR-011 sa veľký súbor
 * posiela po kúskoch; každá požiadavka sa musí zmestiť pod strop Vercelu.
 */
import { describe, it, expect } from "vitest"
import { MAX_BYTES, MAX_FORM_BYTES, CHUNK_BYTES, chunkCount, expectedChunkLength } from "../src/lib/fileStore"
import nextConfig from "../next.config.mjs"

/** Strop Vercelu pre telo požiadavky do funkcie. Nedá sa nastaviť. */
const VERCEL_BODY_LIMIT = 4.5 * 1024 * 1024

function parseSize(v: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(kb|mb)$/i.exec(v)
  if (!m) throw new Error(`Nečitateľná veľkosť: ${v}`)
  return Number(m[1]) * 1024 * (m[2].toLowerCase() === "mb" ? 1024 : 1)
}

describe("stropy nahrávania", () => {
  const limit = nextConfig.experimental?.serverActions?.bodySizeLimit

  it("strop súboru je 25 MB (ADR-011)", () => {
    expect(MAX_BYTES).toBe(25 * 1024 * 1024)
  })

  it("jeden kúsok sa zmestí do požiadavky na Verceli", () => {
    expect(CHUNK_BYTES).toBeLessThan(VERCEL_BODY_LIMIT)
  })

  it("nahratie formulárom (bez JavaScriptu) sa zmestí do požiadavky", () => {
    expect(MAX_FORM_BYTES).toBeLessThan(VERCEL_BODY_LIMIT)
  })

  it("strop serverovej akcie je nad stropom formulára, ale nie nad Vercelom", () => {
    expect(typeof limit).toBe("string")
    expect(parseSize(limit as string)).toBeGreaterThan(MAX_FORM_BYTES)
    expect(parseSize(limit as string)).toBeLessThanOrEqual(VERCEL_BODY_LIMIT)
  })
})

describe("rozdelenie na kúsky", () => {
  const C = 3

  it("počet kúskov", () => {
    expect(chunkCount(1, C)).toBe(1)
    expect(chunkCount(3, C)).toBe(1)
    expect(chunkCount(4, C)).toBe(2)
    expect(chunkCount(25 * 1024 * 1024)).toBe(9)
  })

  it("každý kúsok okrem posledného má plnú dĺžku — inak by GridFS poskladal dieru", () => {
    expect(expectedChunkLength(7, 0, C)).toBe(3)
    expect(expectedChunkLength(7, 1, C)).toBe(3)
    expect(expectedChunkLength(7, 2, C)).toBe(1)
    expect(expectedChunkLength(6, 1, C)).toBe(3)
  })

  it("kúsok mimo rozsahu sa odmietne", () => {
    expect(expectedChunkLength(7, 3, C)).toBeNull()
    expect(expectedChunkLength(7, -1, C)).toBeNull()
    expect(expectedChunkLength(7, 1.5, C)).toBeNull()
  })
})
