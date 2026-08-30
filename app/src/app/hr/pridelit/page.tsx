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
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

/** Hodnoty z adresy sa vracajú späť do formulára — viď `spatSChybou`. */
function asArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

type Query = {
  error?: string
  document?: string | string[]
  audience?: string | string[]
  all?: string
  addresses?: string
  reason?: string
}

export default async function AssignPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await hrContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const q = normalizeQuery<Query>(await searchParams)
  const [documents, audiences, tree, departmentCounts] = await Promise.all([
    assignableDocuments(ctx.person.companyCode),
    audiencesInOrg(ctx.person.companyCode),
    allDepartments(ctx.person.companyCode),
    counts(ctx.person.companyCode),
  ])
  const treeRows = flattenTree(tree)
  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language

  const selectedDocuments = new Set(asArray(q.document))
  const selectedAudiences = new Set(asArray(q.audience))

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

      {q.error && (
        <p
          className="karta"
          style={{ padding: "12px 16px", margin: "0 0 18px", fontSize: 14.5, color: "var(--warn-fg)" }}
        >
          {q.error}
        </p>
      )}

      {documents.length === 0 ? (
        <p className="karta" style={{ padding: 20, fontSize: 15 }}>
          Žiadny dokument nemá platné znenie, takže prideliť sa nedá nič.
          Znenie bez dátumu platnosti sa nedá ani potvrdiť (D6).
        </p>
      ) : (
        <form action={assignAction} style={{ display: "grid", gap: 22 }}>
          <fieldset className="karta hr-skupina">
            <legend className="pole-popis">Ktoré normy</legend>
            <ul className="hr-volby">
              {documents.map(d => (
                <li key={d.documentId}>
                  <label className="hr-volba">
                    <input
                      type="checkbox"
                      name="document"
                      value={d.documentId}
                      defaultChecked={selectedDocuments.has(d.documentId)}
                    />
                    <span>
                      {d.title}
                      <span className="tichy pole-napoveda">
                        {" "}verzia {d.versionLabel}, platná od {formatDate(d.effectiveFrom, language)}
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
              <input type="checkbox" name="vsetci" value="1" defaultChecked={q.all === "1"} />
              <span>
                <strong>Všetkým v organizácii</strong>
                <span className="tichy pole-napoveda">
                  {" "}prebije výber nižšie — inak by to isté znenie viselo v prehľade
                  niekoľkokrát a nikto by nevedel, ktorý riadok niečo znamená
                </span>
              </span>
            </label>

            {treeRows.length > 0 && (
              <>
                <div className="hr-podnadpis">Oddelenia</div>
                <p className="tichy pole-napoveda" style={{ margin: "0 0 8px" }}>
                  Pridelenie oddelenia platí <strong>aj pre všetky podriadené</strong>. Číslo
                  je počet ľudí vrátane nich — to je to, koho sa to naozaj týka.
                </p>
                <div className="stitky-zoznam">
                  {treeRows.map(({ department: department, level: level }) => {
                    const p = departmentCounts.get(department.id) ?? { priamo: 0, sPodriadenymi: 0 }
                    return (
                      <label
                        key={`d-${department.id}`}
                        className="stitok stitok--volba stitok--pole"
                        style={{ marginLeft: (level - 1) * 14 }}
                      >
                        <input
                          type="checkbox"
                          name="audience"
                          value={`department:${department.id}`}
                          defaultChecked={selectedAudiences.has(`department:${department.id}`)}
                        />
                        <span className="stitok-znak" aria-hidden="true" />
                        {department.name}
                        <span className="stitok-pocet">{p.sPodriadenymi}</span>
                      </label>
                    )
                  })}
                </div>
              </>
            )}

            {audiences.groups.length === 0 && audiences.tracks.length === 0 ? (
              <p className="tichy pole-napoveda" style={{ margin: "10px 0 0" }}>
                V organizácii zatiaľ nie sú skupiny ani trasy. Skupiny sa
                zadávajú pri importe osôb (stĺpec &bdquo;skupiny&ldquo;) alebo príkazom
                <code> npm run person</code>.
              </p>
            ) : (
              <>
                {/* Rovnaké štítky ako pri úprave osoby — tá istá vec má
                    vyzerať rovnako. Tu ich ale nesie zaškrtávacie políčko,
                    lebo tento formulár funguje aj bez JavaScriptu. */}
                {audiences.groups.length > 0 && (
                  <>
                    <div className="hr-podnadpis">Skupiny</div>
                    <div className="stitky-zoznam">
                      {audiences.groups.map(s => (
                        <label key={`g-${s.value}`} className="stitok stitok--volba stitok--pole">
                          <input
                            type="checkbox"
                            name="audience"
                            value={`group:${s.value}`}
                            defaultChecked={selectedAudiences.has(`group:${s.value}`)}
                          />
                          <span className="stitok-znak" aria-hidden="true" />
                          {s.value}
                          <span className="stitok-pocet">{s.count}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}

                {audiences.tracks.length > 0 && (
                  <>
                    <div className="hr-podnadpis">Trasy</div>
                    <div className="stitky-zoznam">
                      {audiences.tracks.map(t => (
                        <label key={`t-${t.value}`} className="stitok stitok--volba stitok--pole">
                          <input
                            type="checkbox"
                            name="audience"
                            value={`track:${t.value}`}
                            defaultChecked={selectedAudiences.has(`track:${t.value}`)}
                          />
                          <span className="stitok-znak" aria-hidden="true" />
                          {t.value}
                          <span className="stitok-pocet">{t.count}</span>
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
                defaultValue={q.addresses ?? ""}
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
              defaultValue={q.reason ?? ""}
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
