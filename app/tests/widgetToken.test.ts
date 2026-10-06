/**
 * widgetToken.test.ts — token z cudzieho systemu (ADR-028, D166).
 *
 * Co sa drzi: podpis, platnost (najviac 15 min), kanal (aud), povoleny
 * povod (iss), povinne sub a e-mail. Zly token nikdy neprejde potichu.
 */

import { describe, it, expect } from "vitest"
import { signWidgetToken, verifyWidgetToken } from "../src/lib/widgetToken"

const now = new Date("2026-10-06T10:00:00Z")
const channel = { key: "issf", secret: "tajomstvo-kanala", origins: ["https://issf.futbalsfz.sk/"] }
const claims = { iss: "https://issf.futbalsfz.sk", aud: "issf", sub: "55a6733f", email: "Jan@Klub.sk", name: "Ján  Letko", roles: ["klubový manažér"], club: "FK Test", lang: "sk" }

describe("verifyWidgetToken", () => {
  it("platny token da identitu s normalizovanym e-mailom a menom", () => {
    const id = verifyWidgetToken(signWidgetToken(claims, channel.secret, now), channel, now)
    expect(id).toMatchObject({ externalId: "55a6733f", email: "jan@klub.sk", name: "Ján Letko", roles: ["klubový manažér"], club: "FK Test", language: "sk", issuer: "https://issf.futbalsfz.sk" })
    expect(id.expiresAt.toISOString()).toBe("2026-10-06T10:15:00.000Z")
  })
  it("iny podpis, iny kanal, cudzi povod", () => {
    expect(() => verifyWidgetToken(signWidgetToken(claims, "ine", now), channel, now)).toThrow(/Podpis/)
    expect(() => verifyWidgetToken(signWidgetToken({ ...claims, aud: "iny" }, channel.secret, now), channel, now)).toThrow(/inému kanálu/)
    expect(() => verifyWidgetToken(signWidgetToken({ ...claims, iss: "https://zly.sk" }, channel.secret, now), channel, now)).toThrow(/Vydavateľ/)
  })
  it("vyprsany token a token s dlhou platnostou", () => {
    const token = signWidgetToken(claims, channel.secret, now)
    expect(() => verifyWidgetToken(token, channel, new Date("2026-10-06T10:16:30Z"))).toThrow(/vypršal/)
    // minuta tolerancie hodin
    expect(() => verifyWidgetToken(token, channel, new Date("2026-10-06T10:15:30Z"))).not.toThrow()
    expect(() => verifyWidgetToken(signWidgetToken(claims, channel.secret, now, 3600), channel, now)).toThrow(/15 minút/)
  })
  it("bez sub alebo e-mailu neprejde", () => {
    expect(() => verifyWidgetToken(signWidgetToken({ ...claims, email: "nie-email" }, channel.secret, now), channel, now)).toThrow(/e-mail/)
    expect(() => verifyWidgetToken(signWidgetToken({ ...claims, sub: "" }, channel.secret, now), channel, now)).toThrow(/identifikátor/)
    expect(() => verifyWidgetToken("abc", channel, now)).toThrow(/tvar/)
  })
})
