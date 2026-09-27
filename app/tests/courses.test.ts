/**
 * courses.test.ts — pravidlá kurzu (ADR-018, D118): čo bráni zverejneniu,
 * nová verzia ako kópia, rozdelenie „Moje kurzy" (rám LEARNING).
 */
import { describe, it, expect } from "vitest"
import { publishProblems, draftFrom, estimatedMinutes, isArchived, type CourseVersion, type Course, type Part } from "../src/lib/courses"
import { groupMyCourses, type Enrollment } from "../src/lib/enrollments"
import type { ProgressFacts } from "../src/lib/learningProgress"
import { newTopicProblem } from "../src/lib/learningTopics"
import { parseSmartTag } from "../src/lib/smartTags"

const at = new Date("2026-10-01T00:00:00Z")
const part = (key: string, over: Partial<Part> = {}): Part => ({ key, title: key, required: true, tests: [], blocks: [{ id: "t", type: "text", markdown: "x" }], ...over })
const version = (over: Partial<CourseVersion> = {}): CourseVersion => ({
  versionId: "v1", version: 1, state: "published", title: "BOZP", sequential: false, parts: [part("uvod")],
  issuesCertificate: false, createdAt: at, createdBy: "jan@sfz.sk", ...over,
})
const course = (key: string, over: Partial<Course> = {}): Course => ({
  companyCode: "SFZ", key, title: key, topicKey: "bozp", topicLabel: "BOZP", smartTags: [], language: "sk",
  openEnrollment: false, versions: [version({ versionId: `${key}-v1`, title: key })], createdAt: at, createdBy: "jan@sfz.sk", ...over,
})
const enrollment = (courseKey: string, over: Partial<Enrollment> = {}): Enrollment => ({
  id: `e-${courseKey}`, companyCode: "SFZ", personId: "p", email: "p@sfz.sk", fullName: "P", courseKey,
  versionId: `${courseKey}-v1`, courseTitle: courseKey, enrolledAt: at, source: "assignment", ...over,
})

describe("publishProblems", () => {
  it("čistý koncept prejde", () => expect(publishProblems(version())).toEqual([]))
  it("pomenuje všetko, čo chýba", () => {
    const codes = publishProblems(version({
      title: " ",
      issuesCertificate: true,
      parts: [
        part("a", { required: false, blocks: [] }),
        part("a", { required: false, tests: [{ testKey: "t1", required: true }], blocks: [
          { id: "v1", type: "video", source: { kind: "external", provider: "youtube", url: "https://y" }, mustWatch: true, durationSec: 60 },
          { id: "v2", type: "video", source: { kind: "internal", assetId: "x" }, mustWatch: true },
        ] }),
        part("Zlý kľúč"),
      ],
    })).map(p => p.code)
    expect(codes).toEqual(["noTitle", "emptyPart", "duplicatePartKey", "mustWatchExternal", "videoWithoutDuration", "testNotReady", "badPartKey", "noIssuer"])
  })
  it("bez povinnej časti a bez častí", () => {
    expect(publishProblems(version({ parts: [part("a", { required: false })] })).map(p => p.code)).toEqual(["noRequiredPart"])
    expect(publishProblems(version({ parts: [] })).map(p => p.code)).toEqual(["noParts"])
  })
  it("test v stave ready prejde", () => {
    expect(publishProblems(version({ parts: [part("a", { tests: [{ testKey: "t1", required: true }] })] }), new Set(["t1"]))).toEqual([])
  })
})

describe("draftFrom", () => {
  it("hlboká kópia, koncept bez údajov o zverejnení a bez zmrazených testov", () => {
    const from = version({ publishedAt: at, publishedBy: "x", parts: [part("a", { tests: [{ testKey: "t", required: true, testVersion: 3 }] })] })
    const d = draftFrom(from, { versionId: "v2", version: 2, at, actor: "y" })
    expect(d).toMatchObject({ versionId: "v2", version: 2, state: "draft", createdBy: "y" })
    expect(d.publishedAt).toBeUndefined()
    expect(d.parts[0].tests).toEqual([{ testKey: "t", required: true }])
    d.parts[0].title = "zmenené"
    expect(from.parts[0].title).toBe("a")
  })
})

describe("estimatedMinutes a archív", () => {
  it("zadaný odhad, inak súčet častí, inak null", () => {
    expect(estimatedMinutes(version({ estimatedMinutes: 40 }))).toBe(40)
    expect(estimatedMinutes(version({ parts: [part("a", { estimatedMinutes: 10 }), part("b", { estimatedMinutes: 5 })] }))).toBe(15)
    expect(estimatedMinutes(version())).toBeNull()
  })
  it("archivovaný = nič zverejnené, ale niečo vyšlo", () => {
    expect(isArchived(course("a", { versions: [version({ state: "archived" })] }))).toBe(true)
    expect(isArchived(course("a", { versions: [version({ state: "draft" })] }))).toBe(false)
  })
})

describe("groupMyCourses", () => {
  const tag = parseSmartTag("Úroveň: 1")!
  const courses = [
    course("rozpracovany"),
    course("prideleny"),
    course("hotovy"),
    course("otvoreny", { openEnrollment: true, smartTags: [tag] }),
    course("otvoreny-archiv", { openEnrollment: true, versions: [version({ versionId: "otvoreny-archiv-v1", state: "archived" })] }),
    course("archiv-rozpracovany", { versions: [version({ versionId: "archiv-rozpracovany-v1", state: "archived" })] }),
  ]
  const enrollments = [
    enrollment("rozpracovany"), enrollment("prideleny"), enrollment("hotovy"), enrollment("archiv-rozpracovany"),
    enrollment("zruseny", { cancelledAt: at }),
  ]
  const touched: ProgressFacts = { completions: [], watches: [{ partKey: "uvod", blockId: "t", watchedRanges: [[0, 5]] as [number, number][], durationSec: 10, updatedAt: at }], passedTests: [] }
  const facts = new Map<string, ProgressFacts>([
    ["e-rozpracovany", touched],
    ["e-archiv-rozpracovany", touched],
    ["e-hotovy", { completions: [{ partKey: "uvod", at }], watches: [], passedTests: [] }],
  ])

  it("tri skupiny; archivovaný rozpracovaný zostáva, archivovaný otvorený sa neponúka (Q2)", () => {
    const g = groupMyCourses({ courses, enrollments, factsByEnrollment: facts })
    expect(g.inProgress.map(c => c.course.key)).toEqual(["archiv-rozpracovany", "rozpracovany"])
    expect(g.inProgress[0].archived).toBe(true)
    expect(g.toEnroll.map(c => c.course.key)).toEqual(["prideleny", "otvoreny"])
    expect(g.done.map(c => c.course.key)).toEqual(["hotovy"])
    expect(g.done[0].progress?.completedAt).toEqual(at)
  })

  it("filter smart:tagov platí na všetky skupiny", () => {
    const g = groupMyCourses({ courses, enrollments, factsByEnrollment: facts, filter: { tags: [tag] } })
    expect([...g.inProgress, ...g.toEnroll, ...g.done].map(c => c.course.key)).toEqual(["otvoreny"])
  })
})

describe("témy", () => {
  it("kľúč z názvu, obsadený aj medzi vyradenými", () => {
    const tenant = { learningTopics: [{ key: "bozp", label: "BOZP", retiredAt: at }] }
    expect(newTopicProblem(tenant, { label: "Rozhodcovia" })).toEqual({ problem: null, key: "rozhodcovia" })
    expect(newTopicProblem(tenant, { label: "BOZP" }).problem).toBe("learning.topicKeyTaken")
    expect(newTopicProblem(tenant, { label: " " }).problem).toBe("learning.topicLabelRequired")
  })
})
