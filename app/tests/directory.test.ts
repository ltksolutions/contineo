/**
 * directory.test.ts — interný adresár (D87).
 *
 * Testuje sa **dotaz**, nie vykreslenie: adresár je prvá obrazovka, ktorú vidí
 * každý prihlásený, takže chyba v podmienke by neznamenala rozbitú stránku,
 * ale ticho zobrazené cudzie údaje. Preto sa overuje, že `companyCode` je
 * v podmienke dotazu (D32) a že vyradení v ňom nie sú.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

let lastFilter: Record<string, unknown> | undefined
const rows: unknown[] = []

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async () => ({
    find: vi.fn((filter: Record<string, unknown>) => {
      lastFilter = filter
      return { sort: () => ({ limit: () => ({ toArray: async () => rows }) }) }
    }),
  })),
  getDb: vi.fn(),
  getClient: vi.fn(),
}))

const { listDirectory } = await import("../src/lib/directory")

beforeEach(() => { lastFilter = undefined; rows.length = 0 })

describe("dotaz adresára", () => {
  it("organizácia je v podmienke, nie v kontrole nad ňou (D32)", async () => {
    await listDirectory("SFZ")
    expect(lastFilter).toMatchObject({ companyCode: "SFZ" })
  })

  it("vyradení v adresári nie sú", async () => {
    // Sú v `persons` kvôli potvrdeniam, ktoré musia prežiť odchod človeka,
    // ale ako kontakt už neplatia.
    await listDirectory("SFZ")
    expect(lastFilter?.status).toEqual({ $ne: "inactive" })
  })

  it("bez hľadania sa nefiltruje ničím navyše", async () => {
    await listDirectory("SFZ", "   ")
    expect(lastFilter?.$or).toBeUndefined()
  })

  it("hľadá v mene, pozícii, oddelení, pracovisku aj adrese", async () => {
    await listDirectory("SFZ", "Senec")
    const fields = (lastFilter?.$or as Record<string, unknown>[]).map(o => Object.keys(o)[0])
    expect(fields).toEqual(["fullName", "jobTitle", "department", "workplace", "email"])
  })

  it("bodka v adrese sa nesmie stať „ľubovoľným znakom“", async () => {
    await listDirectory("SFZ", "a.b@x.sk")
    const first = (lastFilter?.$or as { fullName: { $regex: string } }[])[0]
    expect(first.fullName.$regex).toBe("a\\.b@x\\.sk")
  })

  it("organizácia sa hľadaním nedá prebiť", async () => {
    // `$or` sa pridáva vedľa `companyCode`, nie namiesto neho.
    await listDirectory("SFZ", "čokoľvek")
    expect(lastFilter?.companyCode).toBe("SFZ")
  })
})

describe("čo sa z osoby dostane von", () => {
  it("roly, trasy ani skupiny v zázname adresára nie sú", async () => {
    rows.push({
      id: "p1", companyCode: "SFZ", email: "a@b.sk", fullName: "Ján Letko",
      mobilePhone: "+421905123456", workplace: "senec", jobTitle: "Správca",
      roles: ["hr"], tracks: ["t1"], groups: ["rozhodcovia"], status: "active",
      language: "sk", personType: "employee",
    })
    const [entry] = await listDirectory("SFZ")
    expect(entry).toMatchObject({
      fullName: "Ján Letko", mobilePhone: "+421905123456", workplace: "senec",
    })
    // Správa prístupov patrí do /people, nie do adresára.
    expect(entry).not.toHaveProperty("roles")
    expect(entry).not.toHaveProperty("tracks")
    expect(entry).not.toHaveProperty("groups")
  })
})
