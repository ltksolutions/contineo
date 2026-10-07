/**
 * saveBar.test.ts — spoločné uloženie stránok s jednou lištou
 * (ZAKLAD-lista-ulozenia, 7. 10. 2026).
 *
 * - `plannedOAuth`: poskytovateľ bez vlastného nastavenia s prázdnymi poľami
 *   sa preskočí; polovica údajov zastaví uloženie skôr, než sa niečo zapíše (Q6).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const s = vi.hoisted(() => ({
  existing: null as unknown,
  encryption: true,
}))

vi.mock("../src/lib/mongodb", () => ({ getCollection: async () => ({ findOne: async () => s.existing }) }))
vi.mock("../src/lib/secrets", () => ({ encrypt: (x: string) => `enc:${x}`, encryptionAvailable: () => s.encryption }))

import { plannedOAuth } from "../src/lib/tenantAdmin"

describe("plannedOAuth", () => {
  beforeEach(() => { s.existing = { companyCode: "SFZ", oauth: {} }; s.encryption = true })

  it("nezaložený poskytovateľ s prázdnymi poľami sa preskočí", async () => {
    expect(await plannedOAuth("SFZ", { microsoft: { clientId: "", clientSecret: "", tenantMode: "" }, google: {} })).toEqual([])
  })

  it("nový poskytovateľ potrebuje obe polia; uložený sa dá doplniť polovicou", async () => {
    await expect(plannedOAuth("SFZ", { google: { clientId: "abc" } })).rejects.toMatchObject({ code: "tenant.needsBothCredentials" })
    expect(await plannedOAuth("SFZ", { google: { clientId: "abc", clientSecret: "x" } })).toEqual(["google"])
    s.existing = { companyCode: "SFZ", oauth: { microsoft: { clientId: "id", clientSecretEnc: "e" } } }
    expect(await plannedOAuth("SFZ", { microsoft: { clientId: "", clientSecret: "", tenantMode: "organizations" }, google: {} })).toEqual(["microsoft"])
  })

  it("tajomstvo bez šifrovacieho kľúča zastaví uloženie", async () => {
    s.encryption = false
    await expect(plannedOAuth("SFZ", { microsoft: { clientId: "a", clientSecret: "b" } })).rejects.toMatchObject({ code: "tenant.noEncryptionKey" })
  })
})
