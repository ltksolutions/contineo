/**
 * dpoPage.test.ts — /dpo vykreslené bez databázy (rámy DPO-ochrana-udajov
 * a DPO-vykaz-hladanie): hľadanie, filtre s počtami, zoskupenie podľa osoby
 * a stavu, `mailto:` do 25 a nad 25, pás čakajúcej námietky, prázdny stav,
 * zbalené zaevidovanie, ktoré sa po chybe otvorí.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const state = vi.hoisted(() => ({ rows: [] as unknown[], objections: [] as unknown[] }))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/lib/dpo", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/dpo")>()),
  dpoContext: async () => ({
    state: "ready",
    tenant: { companyCode: "SFZ", name: "SFZ", hostnames: ["sfz.localhost", "intranet.sfz.sk"], languages: ["sk", "cs"], privacy: { retention: { evidenceYears: 2 }, extra: { sk: "Kamerový systém v sídle." } } },
    person: { id: "p-jan", email: "jan@sfz.sk", companyCode: "SFZ", language: "sk" },
  }),
}))
vi.mock("@/lib/dpoDb", () => ({ legalBasisRows: async () => state.rows }))
vi.mock("@/lib/objectionsDb", () => ({ listObjections: async () => state.objections }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/session", () => ({}))
vi.mock("../src/app/dpo/actions", () => ({ recordObjectionAction: async () => {}, decideObjectionAction: async () => {}, saveRetentionAction: async () => {}, saveExtraAction: async () => {} }))

const row = (over: Record<string, unknown>) => ({
  documentId: "sfz:a", title: "Predpis A", versionId: "v1", versionLabel: "1.0",
  effectiveFrom: new Date("2026-09-07T00:00:00Z"), legalBasis: null, categories: [], basisLabel: null, reference: null,
  responsible: { fullName: "Ján Letko", email: "jan@sfz.sk" }, problems: ["noBasis"], ...over,
})

async function render(query: Record<string, string> = {}) {
  const { default: Page } = await import("../src/app/dpo/page")
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }))
}

beforeEach(() => {
  state.rows = [
    row({}),
    row({ documentId: "sfz:b", title: "Predpis B", legalBasis: "legal_obligation", categories: ["legal_obligation", "legitimate_interest"], reference: "§ 47 ZP", problems: [] }),
  ]
  state.objections = [{
    id: "o1", companyCode: "SFZ", personId: "p-x", personName: "Martin Novák",
    receivedAt: new Date("2026-09-22T00:00:00Z"), channel: "email", text: "Nesúhlasím.",
    recordedBy: "Ján Letko", recordedAt: new Date("2026-09-22T00:00:00Z"), status: "pending",
  }]
})

const html = (s: string) => s.replace(/&amp;/g, "&")

describe("/dpo", () => {
  it("bez dlaždíc; počty pri filtroch, predvolene zoskupené podľa osoby", async () => {
    const page = await render()
    expect(page).not.toContain("dpo-tile")
    expect(page).toContain("2 platných predpisov, z toho 1 s nedostatkom.")
    // Filtre: stav, základ (predpis s oboma druhmi v oboch, ADR-017), osoba.
    expect(page).toMatch(/S nedostatkom<\/span><span class="facet-count is-warn">1</)
    expect(page).toMatch(/Zákonná povinnosť<\/span><span class="facet-count">1</)
    expect(page).toMatch(/Oprávnený záujem<\/span><span class="facet-count">1</)
    expect(page).toMatch(/Ján Letko<\/span><span class="facet-count">2</)
    // Podľa osoby: hlavička skupiny, bez stĺpca Zodpovedná osoba v tabuľke.
    expect(page).toMatch(/class="view-switch-item is-on"[^>]*href="\/dpo"[^>]*>Podľa osoby/)
    expect(page).toContain("jan@sfz.sk · 2 predpisy, 1 s nedostatkom")
    expect(page).not.toContain("<th>Zodpovedná osoba</th>")
    // Karty pod 1024 px drží „Zodpovedná osoba", nie „Garant".
    expect(page).toContain("<dt>Zodpovedná osoba</dt>")
  })

  it("podľa stavu: dnešné skupiny a stĺpec Zodpovedná osoba", async () => {
    const page = await render({ group: "state" })
    expect(page).toContain("S nedostatkom · 1")
    expect(page).toContain("V poriadku · 1")
    expect(page).toContain("<th>Zodpovedná osoba</th>")
    expect(page).toContain('href="mailto:jan@sfz.sk"')
  })

  it("hľadanie: zhoda v <mark>, čip, filter ostáva v skrytom poli", async () => {
    state.rows = [...state.rows, row({ documentId: "sfz:c", title: "Prestupový <poriadok>" })]
    const page = await render({ q: "prestup", state: "problems" })
    expect(page).toContain("<mark>Prestup</mark>ový &lt;poriadok&gt;")
    expect(page).not.toContain("Predpis A</a>")
    expect(page).toContain("1 z 3 predpisov")
    expect(page).toContain('<input type="hidden" name="state" value="problems"/>')
    expect(page).toContain('<span class="library-chip-key">hľadanie</span>prestup')
    expect(html(page)).toMatch(/class="library-chip"[^>]*href="\/dpo\?state=problems"/)
    expect(html(page)).toContain('class="library-chips-clear" href="/dpo"')
  })

  it("filter základu: druhý klik ho zruší, ostatné sa nesú", async () => {
    const page = html(await render({ basis: "legalObligation", group: "state" }))
    expect(page).toContain("Predpis B")
    expect(page).not.toContain(">Predpis A<")
    expect(page).toMatch(/class="facet is-on"[^>]*href="\/dpo\?group=state"><span class="facet-box facet-box--radio" aria-hidden="true"><\/span><span class="facet-name">Zákonná povinnosť/)
  })

  it("e-mail osobe: zoznam do 25, nad 25 počet a odkaz na jej výkaz", async () => {
    const few = html(await render())
    expect(few).toContain("Napísať e-mail · 1")
    expect(decodeURIComponent(few.match(/href="(mailto:[^"]+)"/)![1])).toContain("- Predpis A")

    state.rows = Array.from({ length: 26 }, (_, i) => row({ documentId: `sfz:${i}`, title: `Predpis ${i}` }))
    const many = html(await render())
    expect(many).toContain("Napísať e-mail · 26")
    const body = decodeURIComponent(many.match(/href="(mailto:[^"]+)"/)![1])
    expect(body).toContain("pri 26 predpisoch")
    expect(body).toContain("https://intranet.sfz.sk/dpo?person=jan%40sfz.sk")
    expect(body).not.toContain("- Predpis 0")
  })

  it("prázdny stav hľadania odkazuje na knižnicu a ruší hľadanie", async () => {
    const page = await render({ q: "kódex" })
    expect(page).toContain("Hľadaniu nič nevyhovuje")
    expect(page).toContain('href="/library"')
    expect(page).toContain('href="/dpo">Zrušiť hľadanie')
  })

  it("bez predpisov ostáva pôvodná veta, bez filtrov", async () => {
    state.rows = []
    const page = await render()
    expect(page).toContain("Organizácia zatiaľ nemá platný predpis.")
    expect(page).not.toContain("dpo-facets")
  })

  it("čakajúca námietka: pás nad výkazom, voľby ako dlaždice, zaevidovanie zbalené v hlavičke", async () => {
    const page = await render()
    expect(page).toContain("1 námietka čaká na rozhodnutie")
    expect(page).toContain("Martin Novák · doručená 22. 9. 2026")
    expect(page).toContain('<a class="button dpo-button-sm" href="#objections">Rozhodnúť</a>')
    expect(page).toContain("1 čaká na rozhodnutie")
    expect(page).toContain("dpo-choice--danger")
    expect(page).toMatch(/<details class="dpo-record">/)
  })

  it("bez čakajúcej námietky pás nie je; rozhodnuté sú zbalené", async () => {
    state.objections = [{ ...(state.objections[0] as object), status: "rejected", decidedBy: "Ján", decidedAt: new Date("2026-09-25T00:00:00Z") }]
    const page = await render()
    expect(page).not.toContain("dpo-alert")
    expect(page).toContain('<details class="dpo-decided"><summary>Rozhodnuté námietky (1) · zobraziť</summary>')
  })

  it("po chybe je zaevidovanie otvorené", async () => {
    expect(await render({ error: "1", msg: "chyba" })).toMatch(/<details class="dpo-record" open="">/)
  })

  it("lehoty a doplnok tu už nie sú — odkaz na záložku GDPR v nastaveniach (D154)", async () => {
    const page = await render()
    expect(page).not.toContain('id="retention"')
    expect(page).not.toContain('name="extra-sk"')
    expect(page).toContain('href="/organisation?tab=gdpr"')
  })
})
