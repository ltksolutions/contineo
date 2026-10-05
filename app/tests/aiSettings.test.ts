import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { AI_MODELS, aiSettingsView, defaultModels, resolveAi } from "@/lib/aiSettings"
import { withAi, defaultProfile } from "@/lib/tenantProfile"
import { encrypt } from "@/lib/secrets"
import { PRICELIST } from "@/lib/pricing"

const KEY = "a".repeat(64)
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = { e: process.env.OAUTH_SECRET_ENCRYPTION_KEY, a: process.env.ANTHROPIC_API_KEY }
  process.env.OAUTH_SECRET_ENCRYPTION_KEY = KEY
  process.env.ANTHROPIC_API_KEY = "sk-operator"
})
afterEach(() => {
  process.env.OAUTH_SECRET_ENCRYPTION_KEY = saved.e
  process.env.ANTHROPIC_API_KEY = saved.a
})

describe("aiSettings — kľúč a modely organizácie (D157)", () => {
  it("bez nastavenia: kľúč prevádzkovateľa a dnešné modely", () => {
    const r = resolveAi(undefined)
    expect(r).toMatchObject({ apiKey: "sk-operator", keySource: "operator", ownKeyUnreadable: false })
    expect(r.models).toEqual(defaultModels())
  })

  it("vlastný kľúč má prednosť a rozšifruje sa", () => {
    const r = resolveAi({ provider: "anthropic", apiKeyEnc: encrypt("sk-ant-own-1234") })
    expect(r).toMatchObject({ apiKey: "sk-ant-own-1234", keySource: "tenant" })
  })

  it("nečitateľný vlastný kľúč nepadá potichu na kľúč prevádzkovateľa", () => {
    const r = resolveAi({ provider: "anthropic", apiKeyEnc: "nezmysel" })
    expect(r).toMatchObject({ apiKey: null, keySource: null, ownKeyUnreadable: true })
  })

  it("model mimo ponuky sa nepoužije", () => {
    const r = resolveAi({ provider: "anthropic", models: { answer: "claude-opus-5-5", rewrite: "gpt-5" } })
    expect(r.models.answer).toBe("claude-opus-5-5")
    expect(r.models.rewrite).toBe(defaultModels().rewrite)
  })

  it("každý model v ponuke má cenu v cenníku", () => {
    for (const list of Object.values(AI_MODELS)) {
      for (const m of list) expect(PRICELIST[m.id], m.id).toBeDefined()
    }
  })

  it("obrazovka nedostane kľúč, len koncovku", () => {
    const v = aiSettingsView({ provider: "anthropic", apiKeyEnc: encrypt("sk-ant-xyz-9876"), apiKeyHint: "9876" })
    expect(JSON.stringify(v)).not.toContain("sk-ant")
    expect(v).toMatchObject({ hasOwnKey: true, apiKeyHint: "9876" })
  })
})

describe("withAi — profil s nastavením organizácie", () => {
  it("doplní model a kľúč do generovania aj pomocného modelu", () => {
    const p = withAi(defaultProfile("SFZ"), resolveAi({
      provider: "anthropic", apiKeyEnc: encrypt("sk-ant-own"), models: { answer: "claude-sonnet-5-5" },
    }))
    expect(p.providers.generation).toMatchObject({ model: "claude-sonnet-5-5", apiKey: "sk-ant-own" })
    expect(p.providers.utility).toMatchObject({ apiKey: "sk-ant-own" })
  })

  it("bez vlastného kľúča nechá adaptér siahnuť po kľúči prevádzkovateľa", () => {
    process.env.ANTHROPIC_API_KEY = ""
    const p = withAi(defaultProfile("SFZ"), resolveAi(undefined))
    expect(p.providers.generation.apiKey).toBeUndefined()
  })

  it("nečitateľný vlastný kľúč = prázdny reťazec, adaptér zlyhá", () => {
    const p = withAi(defaultProfile("SFZ"), resolveAi({ provider: "anthropic", apiKeyEnc: "nezmysel" }))
    expect(p.providers.generation.apiKey).toBe("")
  })

  it("Bedrock sa nastavením organizácie nemení", () => {
    const base = defaultProfile("SFZ")
    base.providers.generation = { ...base.providers.generation, kind: "bedrock", region: "eu-central-1" }
    const p = withAi(base, resolveAi({ provider: "anthropic", models: { answer: "claude-opus-5-5" } }))
    expect(p.providers.generation.model).toBe(base.providers.generation.model)
    expect(p.providers.generation.apiKey).toBeUndefined()
  })
})
