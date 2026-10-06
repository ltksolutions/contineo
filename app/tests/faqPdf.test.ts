/**
 * faqPdf.test.ts — PDF zo zaznamov FAQ (ADR-028, D164).
 *
 * Rovnaky vstup musi dat rovnake bajty: identita znenia je odtlacok PDF
 * a textu (D96) a dve ulozenia tych istych zaznamov nesmu byt dve znenia.
 */

import { describe, it, expect } from "vitest"
import { renderFaqPdf } from "../src/lib/faqPdf"
import type { FaqEntry } from "../src/lib/faq"

const now = new Date("2026-10-06T10:00:00Z")
const texts = {
  intro: "Časté otázky.", variants: "Ďalšie znenia", answer: "Odpoveď", sources: "Zdroje", audience: "Pre koho",
  empty: "Zatiaľ bez záznamov.", page: (n: number, total: number) => `strana ${n} z ${total}`,
}
const entries: FaqEntry[] = Array.from({ length: 12 }, (_, i) => ({
  id: `e${i}`, question: `Otázka č. ${i + 1} s ľ, ť, ô a ž?`, variants: ["Iné znenie"],
  answer: "Odpoveď s diakritikou: ľščťžýáíéôň. ".repeat(20), sources: [{ documentId: "sfz:rp", articleRef: "čl. 3" }],
  audience: ["rozhodca"], createdAt: now, createdBy: "a", updatedAt: now, updatedBy: "a",
}))

describe("renderFaqPdf", () => {
  it("rovnaky vstup da rovnake bajty a viac stran", async () => {
    const a = await renderFaqPdf({ title: "FAQ", entries, texts, titles: new Map([["sfz:rp", "Registračný poriadok"]]) })
    const b = await renderFaqPdf({ title: "FAQ", entries, texts, titles: new Map([["sfz:rp", "Registračný poriadok"]]) })
    expect(Buffer.from(a).subarray(0, 5).toString("latin1")).toBe("%PDF-")
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
    expect(Buffer.from(a).toString("latin1").match(/\/Type \/Page[^s]/g)?.length ?? 0).toBeGreaterThan(1)
  }, 20000)
  it("prazdne FAQ sa vykresli", async () => {
    const pdf = await renderFaqPdf({ title: "FAQ", entries: [], texts, titles: new Map() })
    expect(pdf.byteLength).toBeGreaterThan(1000)
  })
})
