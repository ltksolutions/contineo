import { describe, it, expect } from "vitest"
import { blockAnchors, articleHash, articleSection, articleLabel, citedParagraphs } from "../src/lib/articleAnchors"
import { toBlocks } from "../src/lib/formatText"

const NORM = [
  "## Úvodné ustanovenia",
  "## čl. 18 ods. 1–7 — Prestup amatéra",
  "(1) Prvý odsek.",
  "(2) Druhý odsek.",
  "## čl. 18 ods. 8–19 — Prestup amatéra",
  "(8) Súhlas materského klubu.",
  "(19) Výnimka.",
  "## čl. 19 — Obdobia",
  "(1) Iný článok.",
  "## Príloha č. 2 – Sadzobník poplatkov",
  "(1) Bez článku.",
].join("\n")

describe("kotvy na články a odseky (11. 10. 2026)", () => {
  it("článok, odseky aj príloha; rozdelený článok má kotvu raz", () => {
    const ids = blockAnchors(toBlocks(NORM)).filter(Boolean)
    expect(ids).toEqual(["cl-18", "cl-18-ods-1", "cl-18-ods-2", "cl-18-ods-8", "cl-18-ods-19", "cl-19", "cl-19-ods-1", "priloha-2"])
  })
  it("citácia z nálezu → kotva prvého miesta", () => {
    expect(articleHash("čl. 18 ods. 8 a ods. 19")).toBe("#cl-18-ods-8")
    expect(articleHash("čl. 25 ods. 11 v spojení s čl. 27 ods. 1")).toBe("#cl-25-ods-11")
    expect(articleHash("čl. 54")).toBe("#cl-54")
    expect(articleHash("Príloha č. 2 – Sadzobník poplatkov")).toBe("#priloha-2")
    expect(articleHash("Článok 4a")).toBe("#cl-4a")
    expect(articleHash("")).toBe("")
    expect(articleHash(null)).toBe("")
  })
})

describe("text citovaného článku na náhľad", () => {
  it("celý rozdelený článok, bez susedných", () => {
    const s = articleSection(NORM, "čl. 18 ods. 8 a ods. 19")!
    expect(s.hash).toBe("#cl-18-ods-8")
    expect(s.text.startsWith("## čl. 18 ods. 1–7")).toBe(true)
    expect(s.text).toContain("(19) Výnimka.")
    expect(s.text).not.toContain("čl. 19")
  })
  it("príloha a nenájdený článok", () => {
    expect(articleSection(NORM, "Príloha č. 2")!.text).toContain("(1) Bez článku.")
    expect(articleSection(NORM, "čl. 99")).toBeNull()
    expect(articleSection(NORM, "")).toBeNull()
  })
})

describe("názov citovaného miesta", () => {
  it("článok a príloha", () => {
    expect(articleLabel("čl. 18 ods. 8 a ods. 19")).toBe("čl. 18")
    expect(articleLabel("Príloha č. 2 – Sadzobník poplatkov")).toBe("príloha č. 2")
    expect(articleLabel("")).toBe("")
  })
})

describe("citované odseky na zvýraznenie", () => {
  const ods = (ref: string) => citedParagraphs(ref).map(x => x.replace(/^cl-\d+[a-z]?-ods-/, ""))
  it("tvary zo skutočných nálezov", () => {
    expect(ods("čl. 18 ods. 8 a ods. 19")).toEqual(["8", "19"])
    expect(ods("čl. 27 ods. 3 a 4")).toEqual(["3", "4"])
    expect(ods("čl. 8 ods. 14–19")).toEqual(["14", "15", "16", "17", "18", "19"])
    expect(ods("čl. 8 ods. 8, 14 až 17, 20")).toEqual(["8", "14", "15", "16", "17", "20"])
    expect(ods("čl. 84 ods. 1 a 2, čl. 12 ods. 9")).toEqual(["1", "2"])
    expect(ods("čl. 35 ods. 7 písm. c) Stanov SFZ")).toEqual(["7"])
    expect(ods("čl. 41 ods. 1, 7 a 8; príloha č. 2")).toEqual(["1", "7", "8"])
    expect(ods("čl. 45 ods. 1–2 Súťažného poriadku futbalu SFZ")).toEqual(["1", "2"])
    expect(ods("čl. 25; čl. 43 ods. 2 písm. c)")).toEqual([])
    expect(citedParagraphs("čl. 18 ods. 8")).toEqual(["cl-18-ods-8"])
  })
})
