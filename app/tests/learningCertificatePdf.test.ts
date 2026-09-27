/**
 * learningCertificatePdf.test.ts — PDF certifikátu (rám CERTIFICATE, D122):
 * skutočné vykreslenie s vloženými písmami (diakritika v mene sa nesmie
 * stratiť — `subset: true` ju strácal), A4 na šírku, overovacia adresa,
 * zalamovanie; adresa organizácie nie je localhost.
 */
import { describe, it, expect } from "vitest"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { certificatePdfTexts, PAGE, renderCertificatePdf, wrapText } from "../src/lib/certificatePdf"
import { tenantOrigin } from "../src/lib/certificates"

const at = new Date("2026-09-18T00:00:00Z")
const c = {
  registrationNumber: "SFZ-2026-0198", holderName: "Ľubomír Ďurčanský-Šťastný", signer: { name: "Ján Letko", role: "generálny sekretár" },
  issuedBy: { kind: "tenant" as const, name: "SFZ", legalName: "Slovenský futbalový zväz" },
  courseTitle: "Bezpečnosť pri práci", courseVersion: 2, partsCount: 6, testsPassed: 2, completedAt: at, issuedAt: at,
}
const url = "https://intranet.futbalsfz.sk/verify/SFZ-2026-0198?h=abcdefghijkmnpqr"

async function text(pdf: Uint8Array): Promise<string> {
  const doc = await getDocument({ data: pdf.slice(), useWorkerFetch: false }).promise
  const content = await (await doc.getPage(1)).getTextContent()
  return content.items.map(i => ("str" in i ? i.str : "")).join("")
}

describe("certificatePdf", () => {
  it("A4 na šírku, jedna strana, meno s diakritikou, texty a overovacia adresa", async () => {
    const pdf = await renderCertificatePdf({ certificate: c, texts: certificatePdfTexts(c, "sk"), verifyUrl: url, createdAt: at })
    const doc = await PDFDocument.load(pdf)
    expect(doc.getPageCount()).toBe(1)
    const { width, height } = doc.getPage(0).getSize()
    expect([Math.round(width), Math.round(height)]).toEqual([Math.round(PAGE.width), Math.round(PAGE.height)])
    expect(pdf.byteLength).toBeLessThan(300_000)
    const t = (await text(pdf)).replace(/\s+/g, "")
    for (const s of ["ĽubomírĎurčanský-Šťastný", "oabsolvovaníkurzu", "Slovenskýfutbalovýzväzpotvrdzuje,že", "SFZ-2026-0198", "Vydané18.9.2026", "JánLetko", "Overenie"]) expect(t).toContain(s)
    expect(t).toContain(url.replace(/\s+/g, ""))
  })

  it("tvar slovesa podľa oslovenia v kópii; nevyplnené = absolvoval(a)", async () => {
    const say = async (holderSalutation?: "mr" | "ms") =>
      (await text(await renderCertificatePdf({ certificate: c, texts: certificatePdfTexts({ ...c, holderSalutation }, "sk"), verifyUrl: url }))).replace(/\s+/g, "")
    expect(await say("ms")).toContain("úspešneabsolvovalakurz")
    expect(await say("mr")).toContain("úspešneabsolvovalkurz")
    expect(await say()).toContain("úspešneabsolvoval(a)kurz")
  })

  it("česky: vety z českého slovníka", async () => {
    const pdf = await renderCertificatePdf({ certificate: c, texts: certificatePdfTexts(c, "cs"), verifyUrl: url })
    expect((await text(pdf)).replace(/\s+/g, "")).toContain("oabsolvováníkurzu")
  })

  it("bez mena (anonymizovaný) a bez podpisujúceho: pomlčka a slovo podpis", async () => {
    const pdf = await renderCertificatePdf({ certificate: { ...c, holderName: null, signer: undefined }, texts: certificatePdfTexts(c, "sk"), verifyUrl: url })
    const t = await text(pdf)
    expect(t).toContain("—")
    expect(t).toContain("podpis")
  })

  it("wrapText: po slovách do šírky, dlhé slovo po znakoch", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica)
    const lines = wrapText("jedna dva tri štyri", font, 10, font.widthOfTextAtSize("jedna dva", 10))
    expect(lines[0]).toBe("jedna dva")
    expect(wrapText("x".repeat(50), font, 10, 40).every(l => font.widthOfTextAtSize(l, 10) <= 40)).toBe(true)
  })

  it("tenantOrigin: prvá nie-lokálna doména", () => {
    expect(tenantOrigin(["sfz.localhost", "intranet.futbalsfz.sk"])).toBe("https://intranet.futbalsfz.sk")
    expect(tenantOrigin(["localhost"])).toBe("https://localhost")
  })
})
