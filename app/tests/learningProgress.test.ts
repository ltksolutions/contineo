/**
 * learningProgress.test.ts — stav postupu odvodený z udalostí (ADR-018,
 * D119): časť hotová len s dokončením, dopozeraným videom a prejdeným
 * povinným testom; zamknutie len pri `sequential`.
 */
import { describe, it, expect } from "vitest"
import {
  mergeRanges, watchedShare, furthestSecond, isWatched, evaluatePart, partStates, courseProgress, completionBlockers,
  type ProgressFacts,
} from "../src/lib/learningProgress"
import type { CourseVersion, Part } from "../src/lib/courses"

const D = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T10:00:00Z`)

const part = (key: string, over: Partial<Part> = {}): Part => ({
  key, title: key, required: true, tests: [],
  blocks: [{ id: `${key}-t`, type: "text", markdown: "x" }],
  ...over,
})
const videoPart = (key: string) => part(key, {
  blocks: [{ id: `${key}-v`, type: "video", source: { kind: "internal", assetId: "a" }, mustWatch: true, durationSec: 100 }],
})
const version = (parts: Part[], sequential = false): Pick<CourseVersion, "parts" | "sequential"> => ({ parts, sequential })
const facts = (over: Partial<ProgressFacts> = {}): ProgressFacts => ({ completions: [], watches: [], passedTests: [], ...over })

describe("video", () => {
  it("zlúči prekryté úseky a oreže dĺžkou", () => {
    expect(mergeRanges([[50, 70], [0, 30], [20, 40], [90, 200], [10, 5]], 100)).toEqual([[0, 40], [50, 70], [90, 100]])
  })
  it("dvakrát pozretý úsek sa neráta dvakrát", () => {
    expect(watchedShare([[0, 50], [0, 50]], 100)).toBe(0.5)
  })
  it("hranica 90 %", () => {
    expect(isWatched([[0, 89]], 100)).toBe(false)
    expect(isWatched([[0, 90]], 100)).toBe(true)
    expect(isWatched([[0, 90]], undefined)).toBe(false)
  })
  it("najďalej pozreté = koniec súvislého úseku od začiatku", () => {
    expect(furthestSecond([[0, 30], [50, 80]], 100)).toBe(30)
    expect(furthestSecond([[40, 80]], 100)).toBe(0)
  })
})

describe("evaluatePart", () => {
  it("bez dokončenia hotová nie je, aj keď je video pozreté", () => {
    const p = videoPart("a")
    const e = evaluatePart(p, facts({ watches: [{ partKey: "a", blockId: "a-v", watchedRanges: [[0, 100]], durationSec: 100, reachedAt: D(2), updatedAt: D(3) }] }))
    expect(e.done).toBe(false)
    expect(e.touched).toBe(true)
    expect(e.videosMissing).toEqual([])
  })
  it("dĺžka z verzie má prednosť pred meraním prehrávača", () => {
    const p = videoPart("a")
    const e = evaluatePart(p, facts({
      completions: [{ partKey: "a", at: D(4) }],
      watches: [{ partKey: "a", blockId: "a-v", watchedRanges: [[0, 20]], durationSec: 20, updatedAt: D(3) }],
    }))
    expect(e.done).toBe(false)
    expect(e.videosMissing).toEqual(["a-v"])
  })
  it("hotová: dátum posledného dôkazu", () => {
    const p = part("a", { tests: [{ testKey: "t1", required: true }, { testKey: "t2", required: false }] })
    const e = evaluatePart(p, facts({ completions: [{ partKey: "a", at: D(2) }], passedTests: [{ partKey: "a", testKey: "t1", at: D(5) }] }))
    expect(e.done).toBe(true)
    expect(e.doneAt).toEqual(D(5))
  })
  it("povinný test bez prejdenia časť nedokončí", () => {
    const p = part("a", { tests: [{ testKey: "t1", required: true }] })
    const e = evaluatePart(p, facts({ completions: [{ partKey: "a", at: D(2) }], passedTests: [{ partKey: "b", testKey: "t1", at: D(5) }] }))
    expect(e.done).toBe(false)
    expect(e.testsMissing).toEqual(["t1"])
  })
})

describe("partStates a courseProgress", () => {
  const parts = [part("a"), part("b", { required: false }), part("c"), part("d")]

  it("ľubovoľné poradie: nič nie je zamknuté", () => {
    const s = partStates(version(parts), facts())
    expect(s.map(p => p.state)).toEqual(["available", "available", "available", "available"])
  })

  it("postupne: zamyká len nehotová povinná časť, nepovinná cestu nezatvára", () => {
    const s = partStates(version(parts, true), facts({ completions: [{ partKey: "a", at: D(1) }] }))
    expect(s.map(p => p.state)).toEqual(["done", "available", "available", "locked"])
  })

  it("rozpracovaná = nejaká udalosť bez hotovej", () => {
    const vp = [videoPart("v")]
    const s = partStates(version(vp), facts({ watches: [{ partKey: "v", blockId: "v-v", watchedRanges: [[0, 30]], durationSec: 100, updatedAt: D(1) }] }))
    expect(s[0].state).toBe("in-progress")
  })

  it("kurz: N z M povinných, ďalšia časť a dátum dokončenia", () => {
    const f = facts({ completions: [{ partKey: "a", at: D(1) }, { partKey: "c", at: D(3) }] })
    const p = courseProgress(version(parts), f)
    expect([p.requiredDone, p.requiredTotal, p.nextPart?.key, p.done]).toEqual([2, 3, "d", false])
    const all = courseProgress(version(parts), facts({ completions: [...f.completions, { partKey: "d", at: D(7) }] }))
    expect(all.done).toBe(true)
    expect(all.completedAt).toEqual(D(7))
    expect(all.nextPart).toBeNull()
  })

  it("bez udalostí nezačatý", () => {
    expect(courseProgress(version(parts), facts()).started).toBe(false)
  })
})

describe("completionBlockers", () => {
  it("video bez 90 % bráni, zamknutá časť bráni, hotová hlási alreadyCompleted", () => {
    const v = version([part("a"), videoPart("b")], true)
    expect(completionBlockers(v, "b", facts(), { allowBeforeRequiredTests: true })?.map(b => b.code)).toEqual(["locked", "videoNotWatched"])
    const done = facts({ completions: [{ partKey: "a", at: D(1) }] })
    expect(completionBlockers(v, "a", done, { allowBeforeRequiredTests: true })?.map(b => b.code)).toEqual(["alreadyCompleted"])
    expect(completionBlockers(v, "x", done, { allowBeforeRequiredTests: true })).toBeNull()
  })
  it("povinný test bráni len pri allowBeforeRequiredTests = false (PART Q1 otvorená)", () => {
    const v = version([part("a", { tests: [{ testKey: "t1", required: true }] })])
    expect(completionBlockers(v, "a", facts(), { allowBeforeRequiredTests: true })).toEqual([])
    expect(completionBlockers(v, "a", facts(), { allowBeforeRequiredTests: false })?.map(b => b.code)).toEqual(["testNotPassed"])
  })
})
