/**
 * Knižnica dokumentov (D53).
 *
 * Doteraz sa normy dostávali dnu **len príkazovým riadkom** — `.md` plus
 * `.meta.json` pripravené vývojárom. Znamenalo to, že zákazník si novelu
 * nevie nahrať sám a pri každej zmene predpisu musí čakať na nás.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { kniznicaContext } from "@/lib/kniznica"
import { zoznamKniznice } from "@/lib/kniznica.citanie"
import { vsetkyPriecinky, splostiStrom, podstrom, pocty, hlbka, MAX_HLBKA } from "@/lib/priecinky"
import { volby } from "@/lib/ciselniky"
import { doplnkyTenanta } from "@/lib/ciselnikyTenanta"
import Vyber from "@/components/Vyber"
import {
  zalozPriecinokAkcia, premenujPriecinokAkcia, presunPriecinokAkcia, zrusPriecinokAkcia,
  posunPriecinokAkcia, ulozPoradiePriecinkovAkcia,
} from "./akcie"
import StromSPoradim from "@/components/StromOddeleni"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate } from "@/lib/i18n"
import Oznam from "@/components/Oznam"

export const dynamic = "force-dynamic"

const STAV_SPRACOVANIA: Record<string, string> = {
  nahrate: "nahraté",
  prevedene: "prevedené, nepublikované",
  zaindexovane: "vo vyhľadávaní",
  zlyhalo: "prevod zlyhal",
}

function velkost(bajtov: number): string {
  return bajtov > 1024 * 1024
    ? `${(bajtov / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bajtov / 1024))} kB`
}

export default async function Kniznica({
  searchParams,
}: {
  searchParams: Promise<{
    sprava?: string; chyba?: string; hladat?: string; stav?: string
    priecinok?: string; category?: string; language?: string; accessLevel?: string; tag?: string
  }>
}) {
  const ctx = await kniznicaContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const q = await searchParams
  const { sprava, chyba, hladat, stav, priecinok, category, language, accessLevel, tag } = q
  const branding = brandingView(ctx.tenant)
  const jazyk = ctx.person.language
  const doplnky = doplnkyTenanta(ctx.tenant)

  const [riadky, priecinky, poctyPriecinkov] = await Promise.all([
    zoznamKniznice(ctx.tenant.companyCode, { hladat, stav, priecinok, category, language, accessLevel, tag }),
    vsetkyPriecinky(ctx.tenant.companyCode),
    pocty(ctx.tenant.companyCode),
  ])
  const strom = splostiStrom(priecinky)

  // Filtre sa nesú ďalej v každom odkaze aj v každom formulári — inak by sa
  // človek po založení priečinka ocitol späť na nefiltrovanom zozname.
  const filtre = Object.entries({ hladat, stav, priecinok, category, language, accessLevel, tag })
    .filter(([, v]) => Boolean(v)) as [string, string][]
  const sFiltrom = (zmena: Record<string, string | undefined>) => {
    const p = new URLSearchParams(filtre)
    for (const [k, v] of Object.entries(zmena)) {
      if (v === undefined || v === "") p.delete(k)
      else p.set(k, v)
    }
    const s = p.toString()
    return s ? `/kniznica?${s}` : "/kniznica"
  }
  const jeFilter = filtre.length > 0

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 900, ...tenantStyle(branding) }}>
      <Oznam sprava={sprava} chyba={chyba === "1"} spat="/kniznica" />

      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 6px" }}>
        <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: 0 }}>Knižnica</h1>
        <Link className="tlacidlo" href="/kniznica/nova">Nahrať dokument</Link>
      </div>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 20px", maxWidth: 640 }}>
        Nahratý súbor sa prevedie na text, ktorý si <strong>prečítaš a opravíš</strong> —
        až potom sa publikuje. Prevod z PDF nikdy nie je dokonalý a je to znenie,
        ktoré budú ľudia potvrdzovať.
      </p>

      <form className="audit-filter" method="get">
        <label className="pole" style={{ flex: "1 1 220px", margin: 0 }}>
          <span className="pole-popis">Hľadať</span>
          <input className="pole-vstup" name="hladat" defaultValue={hladat ?? ""} placeholder="názov alebo kľúč" />
        </label>

        <div className="pole" style={{ flex: "0 1 180px", margin: 0 }}>
          <span className="pole-popis">Druh</span>
          <Vyber
            meno="category"
            volby={[{ hodnota: "", popis: "— všetky —" }, ...volby("category", doplnky)]}
            predvolena={category ?? ""}
            popisPola="Druh dokumentu"
          />
        </div>

        <div className="pole" style={{ flex: "0 1 160px", margin: 0 }}>
          <span className="pole-popis">Značka</span>
          <Vyber
            meno="tag"
            volby={[{ hodnota: "", popis: "— všetky —" }, ...volby("tags", doplnky)]}
            predvolena={tag ?? ""}
            popisPola="Značka"
          />
        </div>

        <div className="pole" style={{ flex: "0 1 150px", margin: 0 }}>
          <span className="pole-popis">Stav</span>
          <Vyber
            meno="stav"
            volby={[
              { hodnota: "", popis: "— všetky —" },
              { hodnota: "publikovane", popis: "publikované" },
              { hodnota: "koncept", popis: "koncepty" },
            ]}
            predvolena={stav ?? ""}
            popisPola="Stav"
          />
        </div>

        {/* Priečinok sa vyberá kliknutím v strome vedľa, nie tu — ale musí sa
            preniesť, inak by odoslanie filtra vyskočilo z priečinka von. */}
        {priecinok && <input type="hidden" name="priecinok" value={priecinok} />}
        {language && <input type="hidden" name="language" value={language} />}
        {accessLevel && <input type="hidden" name="accessLevel" value={accessLevel} />}

        <button className="tlacidlo tlacidlo--tiche" type="submit">Filtrovať</button>
        {jeFilter && (
          <Link className="tichy" href="/kniznica" style={{ fontSize: 14 }}>zrušiť filtre</Link>
        )}
      </form>

      <div className="kniznica-mriezka">
        <aside className="kniznica-priecinky">
          <h2 className="pole-popis" style={{ margin: "0 0 8px" }}>Priečinky</h2>

          <ul className="strom">
            <li className="strom-polozka">
              <Link
                href={sFiltrom({ priecinok: undefined })}
                className={`strom-riadok${!priecinok ? " je-aktivny" : ""}`}
              >
                <span className="strom-nazov">Všetky dokumenty</span>
              </Link>
            </li>
            <li className="strom-polozka">
              <Link
                href={sFiltrom({ priecinok: "nezaradene" })}
                className={`strom-riadok${priecinok === "nezaradene" ? " je-aktivny" : ""}`}
              >
                <span className="tichy strom-nazov">Nezaradené</span>
              </Link>
            </li>

          </ul>

          {/* Fixné položky vyššie do preusporadúvania nepatria — nie sú to
              priečinky, ale pohľady na celý zoznam. */}
          <StromSPoradim
            skryte={Object.fromEntries(filtre)}
            akcia={ulozPoradiePriecinkovAkcia}
            polozky={strom.map(({ priecinok: p, uroven }) => {
              const c = poctyPriecinkov.get(p.id) ?? { priamo: 0, sPodriadenymi: 0 }
              const pod = podstrom(priecinky, p.id)
              return {
                id: p.id,
                nazov: p.nazov,
                parentId: p.parentId ?? null,
                uroven,
                obsah: (
                  <>
                  <div className="strom-riadok" style={{ gap: 6 }}>
                    <span className="strom-uchop" aria-hidden="true">⠿</span>
                    <Link
                      href={sFiltrom({ priecinok: p.id })}
                      className={`strom-nazov${priecinok === p.id ? " je-aktivny" : ""}`}
                    >
                      {p.nazov}
                    </Link>
                    <span className="tichy strom-pocet">{c.sPodriadenymi}</span>
                  </div>

                  <details>
                    <summary className="tichy" style={{ fontSize: 12.5, cursor: "pointer", padding: "0 12px 6px" }}>
                      upraviť
                    </summary>
                    <div className="strom-uprava">
                      {/* Posun o jedno miesto. Ťahanie myšou robí to isté,
                          ale toto funguje aj bez JavaScriptu a klávesnicou. */}
                      <div className="strom-sipky">
                        <form action={posunPriecinokAkcia}>
                          <input type="hidden" name="id" value={p.id} />
                          {filtre.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                          <input type="hidden" name="smer" value="hore" />
                          <button className="tlacidlo tlacidlo--tiche" type="submit"
                                  aria-label={`Posunúť ${p.nazov} vyššie`}>↑ vyššie</button>
                        </form>
                        <form action={posunPriecinokAkcia}>
                          <input type="hidden" name="id" value={p.id} />
                          {filtre.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                          <input type="hidden" name="smer" value="dole" />
                          <button className="tlacidlo tlacidlo--tiche" type="submit"
                                  aria-label={`Posunúť ${p.nazov} nižšie`}>↓ nižšie</button>
                        </form>
                      </div>

                      <form action={premenujPriecinokAkcia} className="strom-forma">
                        <input type="hidden" name="id" value={p.id} />
                        {filtre.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                        <input className="pole-vstup" name="nazov" defaultValue={p.nazov}
                               aria-label={`Názov priečinka ${p.nazov}`} required />
                        <button className="tlacidlo tlacidlo--tiche" type="submit">Premenovať</button>
                      </form>

                      <form action={presunPriecinokAkcia} className="strom-forma">
                        <input type="hidden" name="id" value={p.id} />
                        {filtre.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                        <Vyber
                          meno="parentId"
                          predvolena={p.parentId ?? ""}
                          popisPola={`Nadriadený priečinok pre ${p.nazov}`}
                          volby={[
                            { hodnota: "", popis: "— najvyššia úroveň —" },
                            ...strom
                              .filter(r => !pod.has(r.priecinok.id))
                              .map(r => ({
                                hodnota: r.priecinok.id,
                                popis: `${"— ".repeat(r.uroven - 1)}${r.priecinok.nazov}`,
                              })),
                          ]}
                        />
                        <button className="tlacidlo tlacidlo--tiche" type="submit">Presunúť</button>
                      </form>

                      {c.sPodriadenymi === 0 && pod.size === 1 ? (
                        <form action={zrusPriecinokAkcia}>
                          <input type="hidden" name="id" value={p.id} />
                          {filtre.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                          <button className="tlacidlo tlacidlo--tiche" type="submit">Zrušiť priečinok</button>
                        </form>
                      ) : (
                        <p className="tichy" style={{ fontSize: 12.5, margin: 0 }}>
                          Zrušiť sa dá až prázdny priečinok bez podpriečinkov.
                        </p>
                      )}
                    </div>
                  </details>
                  </>
                ),
              }
            })}
          />

          <form action={zalozPriecinokAkcia} className="strom-forma" style={{ marginTop: 12 }}>
            {filtre.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <input className="pole-vstup" name="nazov" placeholder="Nový priečinok"
                   aria-label="Názov nového priečinka" required />
            <Vyber
              meno="parentId"
              predvolena={priecinok && priecinok !== "nezaradene" ? priecinok : ""}
              popisPola="Nadriadený priečinok"
              volby={[
                { hodnota: "", popis: "— najvyššia úroveň —" },
                ...strom
                  .filter(r => hlbka(priecinky, r.priecinok.id) < MAX_HLBKA)
                  .map(r => ({
                    hodnota: r.priecinok.id,
                    popis: `${"— ".repeat(r.uroven - 1)}${r.priecinok.nazov}`,
                  })),
              ]}
            />
            <button className="tlacidlo tlacidlo--tiche" type="submit">Založiť</button>
          </form>
        </aside>

        <div className="kniznica-zoznam">

      {riadky.length === 0 ? (
        <p className="karta" style={{ padding: 20, fontSize: 15 }}>
          {hladat ? "Nič sa nenašlo." : "Zatiaľ tu nie je nič. Začni nahratím prvého dokumentu."}
        </p>
      ) : (
        <ul className="audit">
          {riadky.map(r => (
            <li key={r.documentId} className="karta audit-zaznam">
              <div className="audit-hlavicka">
                <Link href={`/kniznica/${encodeURIComponent(r.documentId)}`} style={{ fontWeight: 600 }}>
                  {r.title}
                </Link>
                <span className="stitok">{STAV_SPRACOVANIA[r.stavSpracovania] ?? r.stavSpracovania}</span>
                {r.maKoncept && r.stav !== "published" && <span className="stitok">koncept</span>}
              </div>

              <div className="tichy audit-kto">
                {r.cestaPriecinkov?.length ? `${r.cestaPriecinkov.join(" / ")} · ` : ""}
                {r.documentId}
                {r.povodnySubor && ` · ${r.povodnySubor.nazov} (${velkost(r.povodnySubor.bajtov)})`}
                {r.updatedAt && ` · ${formatDate(r.updatedAt, jazyk)}`}
                {r.updatedBy && ` · ${r.updatedBy}`}
              </div>

              <div className="audit-zmeny">
                <div>
                  <span className="audit-pole">platné znenie</span>
                  <span>{r.platneZnenie}</span>
                  {r.verzii > 0 && <span className="tichy"> · {r.verzii} znení</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
        </div>
      </div>
    </div>
  )
}
