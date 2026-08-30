/**
 * Prideliť normy — hromadne.
 *
 * Prideľuje sa **N noriem × M publík naraz**, s jedným spoločným dôvodom.
 * Nie je to zrýchlenie pre lenivých: reálne zadanie znie „nový rozhodca
 * dostáva päť predpisov" alebo „novela sa týka rozhodcov aj delegátov aj
 * klubov". Prideľovať to po jednom znamená napísať ten istý dôvod pätnásťkrát
 * — a pri pätnástom už nikto nepíše to isté, takže sa záznamy o tej istej
 * udalosti rozídu.
 *
 * Serverový formulár bez klientskeho stavu: funguje aj bez jediného riadku
 * JavaScriptu a po chybe sa vráti aj s celým výberom. Zaškrtávacie políčka,
 * nie `select multiple` — ten sa na telefóne ovláda mizerne a viacnásobný
 * výber v ňom nie je vidieť.
 *
 * **Dôvod je povinný.** Systém nevie odlíšiť opravu preklepu od novej
 * povinnosti (D30) a nemá sa o to pokúšať; rozhodne to človek a tu to napíše.
 * O rok je to jediné miesto, kde sa dá zistiť, prečo sto ľudí muselo niečo
 * potvrdiť znova.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { hrContext, assignableDocuments } from "@/lib/hr"
import { audiencesInOrg } from "@/lib/persons"
import { allDepartments, flattenTree, counts } from "@/lib/departments"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate } from "@/lib/i18n"
import { assignAction } from "../actions"

export const dynamic = "force-dynamic"

/** Hodnoty z adresy sa vracajú späť do formulára — viď `spatSChybou`. */
function akoPole(v: string | string[] | undefined): string[] {
  if (v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

export default async function AssignPage({
  searchParams,
}: {
  searchParams: Promise<{
    chyba?: string
    dokument?: string | string[]
    publikum?: string | string[]
    vsetci?: string
    adresy?: string
    dovod?: string
  }>
}) {
  const ctx = await hrContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const q = await searchParams
  const [dokumenty, publika, strom, poctyUtvarov] = await Promise.all([
    assignableDocuments(ctx.person.companyCode),
    audiencesInOrg(ctx.person.companyCode),
    allDepartments(ctx.person.companyCode),
    counts(ctx.person.companyCode),
  ])
  const stromRiadky = flattenTree(strom)
  const branding = brandingView(ctx.tenant)
  const jazyk = ctx.person.language

  const vybraneDokumenty = new Set(akoPole(q.dokument))
  const vybranePublika = new Set(akoPole(q.publikum))

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 680, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href="/hr" style={{ fontSize: 14 }}>← Späť na prehľad</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Prideliť normy</h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 20px" }}>
        Prideľuje sa <strong>konkrétne znenie</strong>, nie dokument. Keď
        pribudne novšie, staré pridelenie zaň neplatí — to je zámer.
      </p>

      {q.chyba && (
        <p
          className="karta"
          style={{ padding: "12px 16px", margin: "0 0 18px", fontSize: 14.5, color: "var(--warn-fg)" }}
        >
          {q.chyba}
        </p>
      )}

      {dokumenty.length === 0 ? (
        <p className="karta" style={{ padding: 20, fontSize: 15 }}>
          Žiadny dokument nemá platné znenie, takže prideliť sa nedá nič.
          Znenie bez dátumu platnosti sa nedá ani potvrdiť (D6).
        </p>
      ) : (
        <form action={assignAction} style={{ display: "grid", gap: 22 }}>
          <fieldset className="karta hr-skupina">
            <legend className="pole-popis">Ktoré normy</legend>
            <ul className="hr-volby">
              {dokumenty.map(d => (
                <li key={d.documentId}>
                  <label className="hr-volba">
                    <input
                      type="checkbox"
                      name="dokument"
                      value={d.documentId}
                      defaultChecked={vybraneDokumenty.has(d.documentId)}
                    />
                    <span>
                      {d.title}
                      <span className="tichy pole-napoveda">
                        {" "}verzia {d.versionLabel}, platná od {formatDate(d.effectiveFrom, jazyk)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="karta hr-skupina">
            <legend className="pole-popis">Komu</legend>

            <label className="hr-volba" style={{ marginBottom: 10 }}>
              <input type="checkbox" name="vsetci" value="1" defaultChecked={q.vsetci === "1"} />
              <span>
                <strong>Všetkým v organizácii</strong>
                <span className="tichy pole-napoveda">
                  {" "}prebije výber nižšie — inak by to isté znenie viselo v prehľade
                  niekoľkokrát a nikto by nevedel, ktorý riadok niečo znamená
                </span>
              </span>
            </label>

            {stromRiadky.length > 0 && (
              <>
                <div className="hr-podnadpis">Oddelenia</div>
                <p className="tichy pole-napoveda" style={{ margin: "0 0 8px" }}>
                  Pridelenie oddelenia platí <strong>aj pre všetky podriadené</strong>. Číslo
                  je počet ľudí vrátane nich — to je to, koho sa to naozaj týka.
                </p>
                <div className="stitky-zoznam">
                  {stromRiadky.map(({ oddelenie, uroven }) => {
                    const p = poctyUtvarov.get(oddelenie.id) ?? { priamo: 0, sPodriadenymi: 0 }
                    return (
                      <label
                        key={`d-${oddelenie.id}`}
                        className="stitok stitok--volba stitok--pole"
                        style={{ marginLeft: (uroven - 1) * 14 }}
                      >
                        <input
                          type="checkbox"
                          name="publikum"
                          value={`department:${oddelenie.id}`}
                          defaultChecked={vybranePublika.has(`department:${oddelenie.id}`)}
                        />
                        <span className="stitok-znak" aria-hidden="true" />
                        {oddelenie.nazov}
                        <span className="stitok-pocet">{p.sPodriadenymi}</span>
                      </label>
                    )
                  })}
                </div>
              </>
            )}

            {publika.skupiny.length === 0 && publika.trasy.length === 0 ? (
              <p className="tichy pole-napoveda" style={{ margin: "10px 0 0" }}>
                V organizácii zatiaľ nie sú skupiny ani trasy. Skupiny sa
                zadávajú pri importe osôb (stĺpec &bdquo;skupiny&ldquo;) alebo príkazom
                <code> npm run osoba</code>.
              </p>
            ) : (
              <>
                {/* Rovnaké štítky ako pri úprave osoby — tá istá vec má
                    vyzerať rovnako. Tu ich ale nesie zaškrtávacie políčko,
                    lebo tento formulár funguje aj bez JavaScriptu. */}
                {publika.skupiny.length > 0 && (
                  <>
                    <div className="hr-podnadpis">Skupiny</div>
                    <div className="stitky-zoznam">
                      {publika.skupiny.map(s => (
                        <label key={`g-${s.hodnota}`} className="stitok stitok--volba stitok--pole">
                          <input
                            type="checkbox"
                            name="publikum"
                            value={`group:${s.hodnota}`}
                            defaultChecked={vybranePublika.has(`group:${s.hodnota}`)}
                          />
                          <span className="stitok-znak" aria-hidden="true" />
                          {s.hodnota}
                          <span className="stitok-pocet">{s.osob}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}

                {publika.trasy.length > 0 && (
                  <>
                    <div className="hr-podnadpis">Trasy</div>
                    <div className="stitky-zoznam">
                      {publika.trasy.map(t => (
                        <label key={`t-${t.hodnota}`} className="stitok stitok--volba stitok--pole">
                          <input
                            type="checkbox"
                            name="publikum"
                            value={`track:${t.hodnota}`}
                            defaultChecked={vybranePublika.has(`track:${t.hodnota}`)}
                          />
                          <span className="stitok-znak" aria-hidden="true" />
                          {t.hodnota}
                          <span className="stitok-pocet">{t.osob}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            <label className="pole" style={{ marginTop: 14 }}>
              <span className="pole-popis">Jednotlivé adresy</span>
              <textarea
                className="pole-vstup"
                name="adresy"
                rows={2}
                defaultValue={q.adresy ?? ""}
                placeholder="jan.novak@example.sk, eva.mala@example.sk"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <span className="tichy pole-napoveda">
                Nepovinné. Oddeľ čiarkou alebo novým riadkom.
              </span>
            </label>
          </fieldset>

          <label className="pole">
            <span className="pole-popis">Dôvod</span>
            <textarea
              name="dovod"
              defaultValue={q.dovod ?? ""}
              required
              rows={3}
              className="pole-vstup"
              placeholder="napr. novela čl. 12 — mení sa lehota na podanie odvolania"
            />
            <span className="tichy pole-napoveda">
              Povinný a spoločný pre celý výber. Je to jediné miesto, kde bude
              o rok napísané, prečo sa normy potvrdzovali znova — a príde aj
              v e-maile ľuďom.
            </span>
          </label>

          <div>
            <button className="tlacidlo" type="submit">Prideliť</button>
          </div>
        </form>
      )}
    </div>
  )
}
