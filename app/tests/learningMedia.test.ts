/**
 * learningMedia.test.ts — súbory kurzu: `Range` pre video (206, strop úseku),
 * prístup len k súboru z viditeľného kurzu, vloženie externého videa.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const s = vi.hoisted(() => ({ allowed: true, ranges: [] as [number, number][] }))
vi.mock("@/lib/learning", () => ({
  learningContext: async () => ({ state: "ready", person: { id: "p", companyCode: "SFZ" }, isAdmin: false }),
}))
vi.mock("@/lib/learningMedia", () => ({ canSeeCourseFile: async () => s.allowed }))
vi.mock("@/lib/fileStore", () => ({
  fileInfo: async () => ({ id: "a", name: "evakuacia.mp4", contentType: "video/mp4", bytes: 10 * 1024 * 1024, sha256: "abc" }),
  openFileRange: async (_c: string, _i: string, start: number, end: number) => { s.ranges.push([start, end]); return { stream: new ReadableStream(), name: "x", contentType: "", bytes: 0 } },
  openFileStream: async () => ({ stream: new ReadableStream(), name: "plan.png", bytes: 10, sha256: null }),
}))

import { GET } from "../src/app/api/learning/media/[id]/route"
import { embedUrl, partSummary } from "../src/lib/courseView"

const get = (range?: string) => GET(new Request("https://x/api/learning/media/a", { headers: range ? { range } : {} }), { params: Promise.resolve({ id: "a" }) })

beforeEach(() => { s.allowed = true; s.ranges = [] })

describe("/api/learning/media/[id]", () => {
  it("Range → 206 s úsekom najviac 2 MB", async () => {
    const r = await get("bytes=0-")
    expect(r.status).toBe(206)
    expect(r.headers.get("Content-Range")).toBe(`bytes 0-${2 * 1024 * 1024 - 1}/${10 * 1024 * 1024}`)
    expect(r.headers.get("Content-Type")).toBe("video/mp4")
    expect(r.headers.get("Accept-Ranges")).toBe("bytes")
  })
  it("koncový úsek a mimo súboru", async () => {
    const r = await get("bytes=-100")
    expect(r.headers.get("Content-Range")).toBe(`bytes ${10 * 1024 * 1024 - 100}-${10 * 1024 * 1024 - 1}/${10 * 1024 * 1024}`)
    expect((await get(`bytes=${20 * 1024 * 1024}-`)).status).toBe(416)
  })
  it("súbor z kurzu, ktorý človek nevidí, je 404", async () => {
    s.allowed = false
    expect((await get("bytes=0-")).status).toBe(404)
  })
})

describe("embedUrl a partSummary", () => {
  it("YouTube a Vimeo na prehrávač, http odmietne", () => {
    expect(embedUrl("youtube", "https://youtu.be/abcdefghijk")).toBe("https://www.youtube-nocookie.com/embed/abcdefghijk")
    expect(embedUrl("vimeo", "https://vimeo.com/123456")).toBe("https://player.vimeo.com/video/123456")
    expect(embedUrl("youtube", "http://youtube.com/watch?v=abcdefghijk")).toBeNull()
    expect(embedUrl("youtube", "nie adresa")).toBeNull()
  })
  it("súhrn obsahu časti", () => {
    expect(partSummary({ key: "a", title: "a", required: true, tests: [], blocks: [
      { id: "1", type: "text", markdown: "" },
      { id: "2", type: "video", source: { kind: "internal", assetId: "x" }, mustWatch: true, durationSec: 150 },
      { id: "3", type: "gallery", items: [] },
      { id: "4", type: "video", source: { kind: "external", provider: "vimeo", url: "https://vimeo.com/1" }, mustWatch: false },
    ] })).toEqual({ blocks: 4, types: ["gallery", "videoExternal"], mustWatchMinutes: 3 })
  })
})
