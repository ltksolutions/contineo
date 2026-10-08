/**
 * channels.test.ts — kanal organizacie (ADR-028, D161, D169).
 *
 * Co sa drzi: tajomstva sa na obrazovku nedostanu (`channelView`), adapter
 * sa vybera podla nastavenia a bez tajomstva alebo pri IMAP zlyha nahlas.
 */

import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))

import { channelView, mailboxFor, mailboxStalled, HELPDESK_ROLE, CHANNEL_KINDS, type HelpdeskChannel } from "../src/lib/channels"
import { ASSIGNABLE_ROLES } from "../src/lib/people"

const now = new Date("2026-10-06T10:00:00Z")
const channel = (over: Partial<HelpdeskChannel> = {}): HelpdeskChannel => ({
  companyCode: "SFZ", key: "issf", kind: "widget", name: "ISSF", audience: "kluby", folderIds: ["f1"], tickets: true,
  mailbox: {
    kind: "graph", address: "helpdesk@futbalsfz.sk",
    graph: { tenantId: "t", clientId: "c", clientSecretEnc: "v1.x.y.z", clientSecretHint: "ab12", secretSetAt: now, secretSetBy: "a@b.sk" },
    cursor: "https://graph…delta", syncSince: now, lastSyncAt: now, lastSyncError: null, lastSyncCounts: null,
  },
  assigneeIds: [], widget: { secretEnc: "v1.a.b.c", secretHint: "zz99", origins: ["https://issf.futbalsfz.sk"], rateLimitPerHour: 60 },
  languages: ["sk"], createdAt: now, createdBy: "a", updatedAt: now, updatedBy: "a", ...over,
})

describe("channelView", () => {
  it("nenesie ani jedno zasifrovane tajomstvo, len koncovky a priznak", () => {
    const v = channelView(channel())
    expect(JSON.stringify(v)).not.toContain("v1.")
    expect(v.mailbox?.graph?.hasSecret).toBe(true)
    expect(v.mailbox?.graph?.clientSecretHint).toBe("ab12")
    expect(v.widget.hasSecret).toBe(true)
    expect(v.widget.secretHint).toBe("zz99")
    expect(v.mailbox?.cursor).toBe("https://graph…delta")
  })
  it("kanal bez schranky", () => {
    expect(channelView(channel({ mailbox: null })).mailbox).toBeNull()
  })
})

describe("mailboxFor", () => {
  it("bez schranky, bez tajomstva a pri IMAP zlyha s kodom", () => {
    expect(() => mailboxFor(channel({ mailbox: null }))).toThrow(/schránku/)
    const noSecret = channel(); noSecret.mailbox!.graph!.clientSecretEnc = undefined
    expect(() => mailboxFor(noSecret)).toThrow(/tajomstvo/)
    const imap = channel(); imap.mailbox!.kind = "imap"
    expect(() => mailboxFor(imap)).toThrow(/IMAP/)
  })
  it("necitatelne tajomstvo nepada potichu", () => {
    // `v1.x.y.z` nie je platny sifrovany tvar — decrypt vyhodi, my prelozime.
    expect(() => mailboxFor(channel())).toThrow(/rozšifrovať/)
  })
})

describe("typy kanalov (D169)", () => {
  it("widget a portal, nic ine", () => {
    expect(CHANNEL_KINDS).toEqual(["widget", "portal"])
    expect(channelView(channel({ kind: "portal", mailbox: null })).kind).toBe("portal")
  })
})

describe("rola helpdesk", () => {
  it("je priradovatelna (D167)", () => {
    expect(ASSIGNABLE_ROLES).toContain(HELPDESK_ROLE)
  })
})

describe("mailboxStalled (KANALY-prehlad Q1)", () => {
  const now = new Date("2026-10-08T12:00:00Z")
  const ago = (min: number) => new Date(now.getTime() - min * 60_000)
  it("chyba posledného behu je porucha hneď", () => {
    expect(mailboxStalled({ lastSyncAt: ago(1), lastSyncError: "graph.401", syncIntervalMinutes: 5 }, now)).toBe(true)
  })
  it("bez prvého behu nie — čaká na cron", () => {
    expect(mailboxStalled({ lastSyncAt: null, lastSyncError: null, syncIntervalMinutes: 5 }, now)).toBe(false)
  })
  it("pri 5 min intervale hranica 30 min, nie 15", () => {
    expect(mailboxStalled({ lastSyncAt: ago(20), lastSyncError: null, syncIntervalMinutes: 5 }, now)).toBe(false)
    expect(mailboxStalled({ lastSyncAt: ago(31), lastSyncError: null, syncIntervalMinutes: 5 }, now)).toBe(true)
  })
  it("pri hodinovom intervale trojnásobok", () => {
    expect(mailboxStalled({ lastSyncAt: ago(170), lastSyncError: null, syncIntervalMinutes: 60 }, now)).toBe(false)
    expect(mailboxStalled({ lastSyncAt: ago(181), lastSyncError: null, syncIntervalMinutes: 60 }, now)).toBe(true)
  })
})
