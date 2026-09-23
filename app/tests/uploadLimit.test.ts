/**
 * uploadLimit.test.ts — strop nahrávaného súboru sedí so stropmi pod ním.
 *
 * **Prečo tento test existuje.** 23. 9. 2026 formulár sľuboval 32 MB, Next
 * pustil 1 MB a Vercel by pustil 4,5 MB — tri čísla, ktoré o sebe nevedeli,
 * a nahrávanie z rozhrania padalo s chybou servera. Toto sú dve nerovnosti,
 * ktoré musia platiť, aby človek dostal buď úspech, alebo zrozumiteľnú vetu.
 */
import { describe, it, expect } from "vitest"
import { MAX_BYTES } from "../src/lib/fileStore"
import nextConfig from "../next.config.mjs"

/** Strop Vercelu pre telo požiadavky do funkcie. Nedá sa nastaviť. */
const VERCEL_BODY_LIMIT = 4.5 * 1024 * 1024

function parseSize(v: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(kb|mb)$/i.exec(v)
  if (!m) throw new Error(`Nečitateľná veľkosť: ${v}`)
  return Number(m[1]) * 1024 * (m[2].toLowerCase() === "mb" ? 1024 : 1)
}

describe("strop nahrávania", () => {
  const limit = nextConfig.experimental?.serverActions?.bodySizeLimit

  it("sľúbený strop sa zmestí do tela požiadavky na Verceli", () => {
    expect(MAX_BYTES).toBeLessThan(VERCEL_BODY_LIMIT)
  })

  it("strop serverovej akcie je nad stropom súboru — príliš veľký súbor dostane vetu, nie chybu", () => {
    expect(typeof limit).toBe("string")
    expect(parseSize(limit as string)).toBeGreaterThan(MAX_BYTES)
  })

  it("…ale nie nad stropom Vercelu, kde by už nič neznamenal", () => {
    expect(parseSize(limit as string)).toBeLessThanOrEqual(VERCEL_BODY_LIMIT)
  })
})
