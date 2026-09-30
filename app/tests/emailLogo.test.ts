/**
 * emailLogo.test.ts — logo v e-maile musí byť absolútna adresa.
 *
 * Značka nesie logo ako `/api/brand/<kód>?v=…`. V prehliadači je to cesta na
 * tej istej doméne, v schránke nemá byť k čomu relatívna — a do 2026-09-17
 * ju absolútnou robil len prihlasovací e-mail. Upozornenia z cronu,
 * schvaľovania a pozvánky posielali cestu tak, ako je, takže sa logo
 * nezobrazilo. Test stráži všetky e-maily naraz, nie ten jeden opravený.
 */
import { describe, it, expect } from "vitest"
import {
  approvalEmail, assignmentEmail, dpoReportEmail, dueReminderEmail, inviteEmail, reminderEmail, signInEmail,
} from "../src/lib/ecomail"

const HOST = "intranet.futbalsfz.sk"
const LINK = `https://${HOST}/documents`
const BRANDING = {
  displayName: "Slovenský futbalový zväz",
  logoUrl: "/api/brand/sfz?v=mu5i3kdz",
  accentColor: "#1450DF",
}
const DOCUMENT = { title: "Stanovy", versionLabel: "úplné znenie", effectiveFrom: "1. 1. 2026" }
const ITEMS = [{ title: "Stanovy", versionLabel: "úplné znenie", days: 3 }]
const DUE = [{ title: "Stanovy", versionLabel: "úplné znenie", due: "20. 9. 2026", daysLeft: 3 }]

const emails = (): Record<string, { html: string }> => ({
  prihlásenie: signInEmail(LINK, HOST, "sk", BRANDING),
  pridelenie: assignmentEmail(LINK, HOST, DOCUMENT, "nová smernica", "sk", BRANDING),
  pripomienka: reminderEmail(LINK, HOST, ITEMS, "sk", BRANDING),
  pozvánka: inviteEmail(LINK, HOST, "sk", BRANDING),
  schválenie: approvalEmail(LINK, HOST, DOCUMENT, "jan.letko@futbalsfz.sk", "", "sk", BRANDING),
  termín: dueReminderEmail(LINK, HOST, DUE, "soon", "sk", BRANDING),
})

describe("logo v e-mailoch", () => {
  it("každý e-mail má logo s absolútnou adresou", () => {
    for (const [name, mail] of Object.entries(emails())) {
      expect(mail.html, name).toContain(`src="https://${HOST}/api/brand/sfz?v=mu5i3kdz"`)
      expect(mail.html, name).not.toContain('src="/api/brand')
    }
  })

  it("adresa, ktorá už je absolútna, sa neprepisuje", () => {
    const mail = signInEmail(LINK, HOST, "sk", { ...BRANDING, logoUrl: "https://cdn.inde.sk/logo.png" })
    expect(mail.html).toContain('src="https://cdn.inde.sk/logo.png"')
  })

  it("bez loga organizácie sa jej obrázok nevykreslí — ostane len ikona Contineo v pätičke", () => {
    const mail = signInEmail(LINK, HOST, "sk", { displayName: "Contineo" })
    expect(mail.html.match(/<img /g)).toHaveLength(1)
    expect(mail.html).not.toContain("/api/brand/")
  })
})

describe("pozvánka a informovanie o spracúvaní (C1)", () => {
  it("nesie odkaz na /privacy v HTML aj v texte, v každom jazyku", () => {
    for (const lang of ["sk", "cs", "en"] as const) {
      const mail = inviteEmail(LINK, HOST, lang, BRANDING)
      expect(mail.html, lang).toContain(`href="https://${HOST}/privacy"`)
      expect(mail.text, lang).toContain(`https://${HOST}/privacy`)
    }
    expect(inviteEmail(LINK, HOST, "sk", BRANDING).html).toContain("Ochrana osobných údajov")
  })
})

describe("pozvánka: kto pozýva a kam (Ján 28. 9. 2026)", () => {
  it("„{Právny názov} vás pozýva do {Názov portálu}“; rovnaké názvy = „do svojho interného portálu“", () => {
    const a = inviteEmail(LINK, HOST, "sk", { ...BRANDING, displayName: "Intranet SFZ", legalName: "Slovenský futbalový zväz" })
    expect(a.text).toContain("Slovenský futbalový zväz vás pozýva do Intranet SFZ. Nájdete v ňom dokumenty a úlohy")
    expect(a.subject).toBe("Pozvánka — Intranet SFZ")
    const b = inviteEmail(LINK, HOST, "sk", BRANDING)
    expect(b.text).toContain("Slovenský futbalový zväz vás pozýva do svojho interného portálu.")
    expect(inviteEmail(LINK, HOST, "en", { ...BRANDING, displayName: "SFZ Intranet", legalName: "Slovak Football Association" }).text)
      .toContain("Slovak Football Association invites you to SFZ Intranet.")
  })
})

describe("pätička e-mailov (Ján 30. 9. 2026)", () => {
  const all = () => ({
    ...emails(),
    dpo: dpoReportEmail(LINK, HOST, "2026 Q3", { total: 1, legalObligation: 1, legitimateInterest: 0, withProblems: 0 }, "sk", BRANDING),
  })

  it("každý e-mail končí značkou Contineo.app s ikonou a odkazom na contineo.app — nie LTK Solutions", () => {
    for (const [name, mail] of Object.entries(all())) {
      expect(mail.html, name).not.toContain("LTK")
      expect(mail.html, name).toContain('href="https://contineo.app"')
      expect(mail.html, name).toContain(">Contineo.app</a>")
      // PNG z tej istej domény, absolútne — SVG poštoví klienti nezobrazia.
      expect(mail.html, name).toContain(`src="https://${HOST}/apple-icon.png"`)
    }
  })
})
