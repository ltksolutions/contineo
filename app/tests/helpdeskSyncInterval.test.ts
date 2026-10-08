/**
 * helpdeskSyncInterval.test.ts — interval synchronizacie schranky (Jan 8. 10. 2026).
 *
 * Spustac bezi kazdych 5 minut; route berie len kanaly, ktorym ich interval
 * uplynul. Bez predosleho behu je kanal na rade vzdy.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const state = vi.hoisted(() => ({ channels: [] as unknown[], synced: [] as string[] }))

vi.mock("@/lib/channels", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/channels")>()),
  channelsWithMailbox: async () => state.channels,
  syncChannel: async (_code: string, key: string) => {
    state.synced.push(key)
    return { key, pages: 1, created: 0, appended: 0, skipped: 0, beforeStart: 0, done: true, error: null }
  },
}))

const { isSyncDue, DEFAULT_SYNC_INTERVAL } = await import("../src/lib/channels")
const { GET } = await import("../src/app/api/cron/helpdesk-sync/route")

const now = new Date("2026-10-08T10:00:00Z")
const ago = (min: number) => new Date(now.getTime() - min * 60_000)

describe("isSyncDue", () => {
  it("bez predosleho behu je na rade", () => {
    expect(isSyncDue({ lastSyncAt: null }, now)).toBe(true)
  })
  it("predvolene 5 minut, s rezervou na nepresny spustac", () => {
    expect(DEFAULT_SYNC_INTERVAL).toBe(5)
    expect(isSyncDue({ lastSyncAt: ago(5) }, now)).toBe(true)
    expect(isSyncDue({ lastSyncAt: ago(4.5) }, now)).toBe(true)
    expect(isSyncDue({ lastSyncAt: ago(3) }, now)).toBe(false)
  })
  it("dlhsi interval kanala", () => {
    expect(isSyncDue({ lastSyncAt: ago(20), syncIntervalMinutes: 30 }, now)).toBe(false)
    expect(isSyncDue({ lastSyncAt: ago(30), syncIntervalMinutes: 30 }, now)).toBe(true)
    expect(isSyncDue({ lastSyncAt: ago(600), syncIntervalMinutes: 1440 }, now)).toBe(false)
  })
})

describe("/api/cron/helpdesk-sync", () => {
  beforeEach(() => {
    state.synced = []
    vi.stubEnv("CRON_SECRET", "s3cret")
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(now)
  })

  it("bez spravneho tajomstva 401 a nic sa nesynchronizuje", async () => {
    const r = await GET(new Request("https://x/api/cron/helpdesk-sync", { headers: { authorization: "Bearer zle" } }))
    expect(r.status).toBe(401)
    expect(state.synced).toEqual([])
  })

  it("synchronizuje len kanaly, ktorym uplynul interval", async () => {
    state.channels = [
      { companyCode: "SFZ", key: "nikdy", mailbox: { lastSyncAt: null } },
      { companyCode: "SFZ", key: "pred-6-min", mailbox: { lastSyncAt: ago(6) } },
      { companyCode: "SFZ", key: "pred-2-min", mailbox: { lastSyncAt: ago(2) } },
      { companyCode: "SFZ", key: "hodinovy", mailbox: { lastSyncAt: ago(20), syncIntervalMinutes: 60 } },
    ]
    const r = await GET(new Request("https://x/api/cron/helpdesk-sync", { headers: { authorization: "Bearer s3cret" } }))
    const body = await r.json()
    expect(state.synced).toEqual(["nikdy", "pred-6-min"])
    expect(body.notDue).toBe(2)
  })
})
