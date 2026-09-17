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
  approvalEmail, assignmentEmail, dueReminderEmail, inviteEmail, reminderEmail, signInEmail,
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

  it("bez loga sa obrázok nevykreslí vôbec", () => {
    const mail = signInEmail(LINK, HOST, "sk", { displayName: "Contineo" })
    expect(mail.html).not.toContain("<img")
  })
})
