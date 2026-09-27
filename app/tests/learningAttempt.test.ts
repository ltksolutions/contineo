/**
 * learningAttempt.test.ts — pokus o test v kurze (rámy TEST-ATTEMPT, RESULT):
 * riadok testu v časti, úvod (spustiť / pauza / vyčerpané), priebeh (typ
 * otázky, veta nad viac správnymi, prehľad, potvrdenie, čas vypršal),
 * výsledok (prešiel, neprešiel s pauzou, skryté odpovede).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { testRowView } from "../src/lib/testView"
import { answerFromForm, type QuestionSnapshot, type TestAttempt } from "../src/lib/testAttempts"

const s = vi.hoisted(() => ({ ctx: null as unknown, attempt: null as unknown, facts: { completions: [], watches: [], passedTests: [] } }))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/SubmitButton", async () => { const { createElement: h } = await import("react"); return { default: ({ children }: { children: string }) => h("button", { type: "submit" }, children) } })
vi.mock("@/components/AttemptBar", async () => { const { createElement: h } = await import("react"); return { default: ({ labels }: { labels: { position: string } }) => h("div", { className: "abar" }, labels.position) } })
vi.mock("@/lib/testPage", () => ({ loadTestContext: async () => s.ctx }))
vi.mock("@/lib/testAttemptsDb", () => ({ getAttempt: async () => s.attempt }))
vi.mock("@/lib/learningProgressDb", () => ({ progressFacts: async () => s.facts }))
vi.mock("../src/app/learning/actions", () => ({ startAttemptAction: async () => {}, answerAction: async () => {} }))

const at = new Date("2026-10-01T10:00:00Z")
const snap = (key: string, over: Partial<QuestionSnapshot> = {}): QuestionSnapshot => ({
  questionKey: key, questionVersion: 1, type: "single", text: `Otázka ${key}`, media: [], weight: 1,
  answers: [{ id: "a1", text: "Áno", correct: true }, { id: "a2", text: "Nie", correct: false }], ...over,
})
const attempt = (over: Partial<TestAttempt> = {}): TestAttempt => ({
  id: "att1", companyCode: "SFZ", testKey: "t", testVersion: 1, personId: "p", email: "p@x", fullName: "P",
  context: { kind: "course", courseKey: "bozp", versionId: "v1", partKey: "cast", enrollmentId: "e1" },
  attemptNumber: 1, seed: 1, questions: [snap("q1"), snap("q2", { type: "multiple", answers: [{ id: "x", text: "X", correct: true }, { id: "y", text: "Y", correct: true }, { id: "z", text: "Z", correct: false }] }), snap("q3", { type: "short_text", answers: [], expected: ["150"] })],
  startedAt: at, deadlineAt: new Date(at.getTime() + 30 * 60000), answers: { q1: { kind: "choice", ids: ["a1"], savedAt: at } },
  passingPercent: 80, showAnswers: "after_submit", idempotencyKey: "k", submittedAt: null, resetAt: null, ...over,
})
const av = (over = {}) => ({ open: null, canStart: true, reason: null, nextAt: null, used: 0, remaining: 3, lastPassed: false, ...over })
const ctx = (over: Record<string, unknown> = {}) => ({
  state: "ready", companyCode: "SFZ", personId: "p", language: "sk", courseKey: "bozp", partKey: "cast",
  part: { key: "cast", title: "Evakuácia", required: true, blocks: [], tests: [{ testKey: "t", required: true }] },
  enrollment: { id: "e1" }, base: "/learning/bozp/cast/test/t", partHref: "/learning/bozp/cast",
  row: { testKey: "t", required: true, test: { title: "Evakuácia a únikové cesty", responsible: [{ fullName: "Marek Horák" }] }, rules: { passingPercent: 80, maxAttempts: 3, timeLimitMinutes: 30, showAnswers: "after_submit" }, questionCount: 3, attempts: [], availability: av(), last: null },
  ...over,
})
const params = (extra: Record<string, string> = {}) => Promise.resolve({ courseKey: "bozp", partKey: "cast", testKey: "t", attemptId: "att1", ...extra })

async function intro() {
  const { default: Page } = await import("../src/app/learning/[courseKey]/[partKey]/test/[testKey]/page")
  return renderToStaticMarkup(await Page({ params: params(), searchParams: Promise.resolve({}) }))
}
async function run(query: Record<string, string> = {}) {
  const { default: Page } = await import("../src/app/learning/[courseKey]/[partKey]/test/[testKey]/[attemptId]/page")
  return renderToStaticMarkup(await Page({ params: params(), searchParams: Promise.resolve(query) }))
}
async function result() {
  const { default: Page } = await import("../src/app/learning/[courseKey]/[partKey]/test/[testKey]/[attemptId]/result/page")
  return renderToStaticMarkup(await Page({ params: params(), searchParams: Promise.resolve({}) }))
}

beforeEach(() => { s.ctx = ctx(); s.attempt = attempt() })

describe("riadok testu", () => {
  const t = { testOpen: (x: string | null, q: number, n: number) => `open ${x} ${q}/${n}`, testPassedPct: (p: number) => `ok ${p}`, testFailedPct: (p: number) => `fail ${p}`, nextAttemptAt: (x: string) => `next ${x}`, attemptsLeft: (r: number, m: number) => `${r}/${m}`, continueTest: "Pokračovať", retry: "Skúsiť", notStarted: "nespustený", start: "Spustiť" }
  const base = { testKey: "t", rules: { maxAttempts: 3 }, questionCount: 20, attempts: [{ id: "o", answers: { a: 1, b: 2 } }], last: null }
  it("otvorený pokus: zostáva a otázka, Pokračovať", () => {
    const v = testRowView({ ...base, availability: av({ open: { id: "o", deadlineAt: new Date(at.getTime() + 12 * 60000) }, canStart: false }) }, "/c/p", t, at, () => "")
    expect(v).toMatchObject({ state: "open 12 min 3/20", tone: "warn", action: { label: "Pokračovať", href: "/c/p/test/t/o" } })
  })
  it("pauza a vyčerpané bez akcie", () => {
    expect(testRowView({ ...base, last: { id: "l", percent: 60 }, availability: av({ canStart: false, reason: "pause", nextAt: at }) }, "/c/p", t, at, () => "10:52").state).toBe("fail 60 · next 10:52")
    expect(testRowView({ ...base, last: { id: "l", percent: 60 }, availability: av({ canStart: false, reason: "exhausted", remaining: 0 }) }, "/c/p", t, at, () => "").action).toBeNull()
  })
  it("odpoveď z formulára", () => {
    expect(answerFromForm(snap("q"), ["a2", "a1", "cudzie"])).toEqual({ kind: "choice", ids: ["a2"] })
    expect(answerFromForm(snap("q", { type: "true_false", answers: [] }), [])).toBeNull()
  })
})

describe("úvod testu", () => {
  it("fakty, pravidlá a Spustiť s kľúčom", async () => {
    const html = await intro()
    expect(html).toContain("Evakuácia a únikové cesty")
    expect(html).toContain("30 min")
    expect(html).toContain("1 z 3")
    expect(html).toContain("Správne odpovede uvidíte po odovzdaní.")
    expect(html).toContain('name="idempotencyKey"')
  })
  it("vyčerpané: vypnuté s menom zodpovednej osoby", async () => {
    s.ctx = ctx({ row: { ...(ctx().row as object), availability: av({ canStart: false, reason: "exhausted", used: 3, remaining: 0 }), last: { percent: 60, submittedAt: at, passed: false } } })
    const html = await intro()
    expect(html).toContain('disabled="" aria-disabled="true"')
    expect(html).toContain("Využili ste 3 z 3 pokusov")
    expect(html).toContain("Marek Horák")
  })
  it("otvorený pokus rovno pokračuje", async () => {
    s.ctx = ctx({ row: { ...(ctx().row as object), availability: av({ open: { id: "att1", deadlineAt: null }, canStart: false }) } })
    await expect(intro()).rejects.toThrow("redirect /learning/bozp/cast/test/t/att1?q=2")
  })
})

describe("priebeh", () => {
  it("pokračuje na prvej nezodpovedanej, viac správnych s vetou nad otázkou", async () => {
    const html = await run()
    expect(html).toContain("Otázka 2 / 3")
    expect(html).toContain("Táto otázka má viac správnych odpovedí")
    expect(html).toContain('type="checkbox" name="a" value="x"')
    expect(html).toContain("Prehľad odpovedí · 2 nezodpovedané")
  })
  it("krátky text a jedna správna so zapamätanou voľbou", async () => {
    expect(await run({ q: "3" })).toContain("Na diakritike a veľkých písmenách nezáleží.")
    expect(await run({ q: "1" })).toMatch(/type="radio" name="a" (checked="" value="a1"|value="a1" checked="")/)
  })
  it("prehľad a potvrdenie s číslami nezodpovedaných", async () => {
    expect(await run({ review: "1" })).toContain("Odovzdať test")
    expect(await run({ review: "1", confirm: "1" })).toContain("Nezodpovedané otázky: 2 (2, 3)")
  })
  it("čas vypršal a odovzdaný", async () => {
    s.attempt = attempt({ submittedAt: at, closedBy: "timeout", percent: 33 })
    expect(await run()).toContain("Čas vypršal")
    s.attempt = attempt({ submittedAt: at, closedBy: "user" })
    await expect(run()).rejects.toThrow("redirect /learning/bozp/cast/test/t/att1/result")
  })
})

describe("výsledok", () => {
  it("prešiel: skóre, body, prehľad otázok", async () => {
    s.attempt = attempt({ submittedAt: new Date(at.getTime() + 750000), closedBy: "user", points: 3, maxPoints: 3, percent: 100, passed: true,
      answers: { q1: { kind: "choice", ids: ["a1"], savedAt: at }, q2: { kind: "choice", ids: ["x", "y"], savedAt: at }, q3: { kind: "text", value: "150", savedAt: at } } })
    const html = await result()
    expect(html).toContain("100 %")
    expect(html).toContain("3 z 3 bodov · Prešiel")
    expect(html).toContain("Prehľad otázok")
    expect(html).toContain("12 min 30 s")
  })
  it("neprešiel s pauzou a skrytými odpoveďami", async () => {
    s.attempt = attempt({ submittedAt: at, closedBy: "user", points: 1, maxPoints: 3, percent: 33, passed: false, showAnswers: "after_pass" })
    s.ctx = ctx({ row: { ...(ctx().row as object), availability: av({ canStart: false, reason: "pause", nextAt: new Date(at.getTime() + 1800000) }) } })
    const html = await result()
    expect(html).toContain("chýba 47 percentuálnych bodov do hranice 80 %")
    expect(html).toContain("Správne odpovede sa nezobrazujú")
    expect(html).toContain("Nesprávne odpovede: 2.")
    expect(html).toContain('aria-describedby="rs-why"')
  })
})
