/**
 * Knižnica dokumentov (D53).
 *
 * Doteraz sa normy dostávali dnu **len príkazovým riadkom** — `.md` plus
 * `.meta.json` pripravené vývojárom. Znamenalo to, že zákazník si novelu
 * nevie nahrať sám a pri každej zmene predpisu musí čakať na nás.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { libraryContext } from "@/lib/library"
import { libraryList } from "@/lib/libraryRead"
import { allFolders, flattenTree, subtree, counts, depth, MAX_DEPTH } from "@/lib/folders"
import { codelistOptions } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import Select from "@/components/Select"
import {
  createFolderAction, renameFolderAction, moveFolderAction, deleteFolderAction,
  shiftFolderAction, saveFolderOrderAction,
} from "./actions"
import TreeWithOrder from "@/components/TreeWithOrder"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate } from "@/lib/i18n"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

const PROCESSING_LABEL: Record<string, string> = {
  nahrate: "nahraté",
  prevedene: "prevedené, nepublikované",
  zaindexovane: "vo vyhľadávaní",
  zlyhalo: "prevod zlyhal",
}

function formatSize(bytes: number): string {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} kB`
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const q = normalizeQuery<{
    msg?: string; error?: string; search?: string; status?: string
    folder?: string; category?: string; language?: string; accessLevel?: string; tag?: string
  }>(await searchParams)
  const { msg: message, error, search, status: state, folder, category, language, accessLevel, tag } = q
  const branding = brandingView(ctx.tenant)
  const uiLanguage = ctx.person.language
  const extras = tenantExtras(ctx.tenant)

  const [rows, folders, folderCounts] = await Promise.all([
    libraryList(ctx.tenant.companyCode, { hladat: search, stav: state, priecinok: folder, category, language, accessLevel, tag }),
    allFolders(ctx.tenant.companyCode),
    counts(ctx.tenant.companyCode),
  ])
  const tree = flattenTree(folders)

  // Filtre sa nesú ďalej v každom odkaze aj v každom formulári — inak by sa
  // človek po založení priečinka ocitol späť na nefiltrovanom zozname.
  const filters = Object.entries({ hladat: search, stav: state, priecinok: folder, category, language, accessLevel, tag })
    .filter(([, v]) => Boolean(v)) as [string, string][]
  const withFilter = (change: Record<string, string | undefined>) => {
    const p = new URLSearchParams(filters)
    for (const [k, v] of Object.entries(change)) {
      if (v === undefined || v === "") p.delete(k)
      else p.set(k, v)
    }
    const s = p.toString()
    return s ? `/kniznica?${s}` : "/kniznica"
  }
  const hasFilter = filters.length > 0

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 900, ...tenantStyle(branding) }}>
      <Notice sprava={message} chyba={error === "1"} spat="/kniznica" />

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
          <input className="pole-vstup" name="search" defaultValue={search ?? ""} placeholder="názov alebo kľúč" />
        </label>

        <div className="pole" style={{ flex: "0 1 180px", margin: 0 }}>
          <span className="pole-popis">Druh</span>
          <Select
            meno="category"
            volby={[{ hodnota: "", popis: "— všetky —" }, ...codelistOptions("category", extras)]}
            predvolena={category ?? ""}
            popisPola="Druh dokumentu"
          />
        </div>

        <div className="pole" style={{ flex: "0 1 160px", margin: 0 }}>
          <span className="pole-popis">Značka</span>
          <Select
            meno="tag"
            volby={[{ hodnota: "", popis: "— všetky —" }, ...codelistOptions("tags", extras)]}
            predvolena={tag ?? ""}
            popisPola="Značka"
          />
        </div>

        <div className="pole" style={{ flex: "0 1 150px", margin: 0 }}>
          <span className="pole-popis">Stav</span>
          <Select
            meno="status"
            volby={[
              { hodnota: "", popis: "— všetky —" },
              { hodnota: "publikovane", popis: "publikované" },
              { hodnota: "koncept", popis: "koncepty" },
            ]}
            predvolena={state ?? ""}
            popisPola="Stav"
          />
        </div>

        {/* Priečinok sa vyberá kliknutím v strome vedľa, nie tu — ale musí sa
            preniesť, inak by odoslanie filtra vyskočilo z priečinka von. */}
        {folder && <input type="hidden" name="folder" value={folder} />}
        {language && <input type="hidden" name="language" value={language} />}
        {accessLevel && <input type="hidden" name="accessLevel" value={accessLevel} />}

        <button className="tlacidlo tlacidlo--tiche" type="submit">Filtrovať</button>
        {hasFilter && (
          <Link className="tichy" href="/kniznica" style={{ fontSize: 14 }}>zrušiť filtre</Link>
        )}
      </form>

      <div className="kniznica-mriezka">
        <aside className="kniznica-priecinky">
          <h2 className="pole-popis" style={{ margin: "0 0 8px" }}>Priečinky</h2>

          <ul className="strom">
            <li className="strom-polozka">
              <Link
                href={withFilter({ priecinok: undefined })}
                className={`strom-riadok${!folder ? " je-aktivny" : ""}`}
              >
                <span className="strom-nazov">Všetky dokumenty</span>
              </Link>
            </li>
            <li className="strom-polozka">
              <Link
                href={withFilter({ priecinok: "nezaradene" })}
                className={`strom-riadok${folder === "nezaradene" ? " je-aktivny" : ""}`}
              >
                <span className="tichy strom-nazov">Nezaradené</span>
              </Link>
            </li>

          </ul>

          {/* Fixné položky vyššie do preusporadúvania nepatria — nie sú to
              priečinky, ale pohľady na celý zoznam. */}
          <TreeWithOrder
            skryte={Object.fromEntries(filters)}
            akcia={saveFolderOrderAction}
            polozky={tree.map(({ priecinok: p, uroven: level }) => {
              const c = folderCounts.get(p.id) ?? { priamo: 0, sPodriadenymi: 0 }
              const inside = subtree(folders, p.id)
              return {
                id: p.id,
                nazov: p.nazov,
                parentId: p.parentId ?? null,
                uroven: level,
                obsah: (
                  <>
                  <div className="strom-riadok" style={{ gap: 6 }}>
                    <span className="strom-uchop" aria-hidden="true">⠿</span>
                    <Link
                      href={withFilter({ priecinok: p.id })}
                      className={`strom-nazov${folder === p.id ? " je-aktivny" : ""}`}
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
                        <form action={shiftFolderAction}>
                          <input type="hidden" name="id" value={p.id} />
                          {filters.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                          <input type="hidden" name="smer" value="hore" />
                          <button className="tlacidlo tlacidlo--tiche" type="submit"
                                  aria-label={`Posunúť ${p.nazov} vyššie`}>↑ vyššie</button>
                        </form>
                        <form action={shiftFolderAction}>
                          <input type="hidden" name="id" value={p.id} />
                          {filters.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                          <input type="hidden" name="smer" value="dole" />
                          <button className="tlacidlo tlacidlo--tiche" type="submit"
                                  aria-label={`Posunúť ${p.nazov} nižšie`}>↓ nižšie</button>
                        </form>
                      </div>

                      <form action={renameFolderAction} className="strom-forma">
                        <input type="hidden" name="id" value={p.id} />
                        {filters.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                        <input className="pole-vstup" name="nazov" defaultValue={p.nazov}
                               aria-label={`Názov priečinka ${p.nazov}`} required />
                        <button className="tlacidlo tlacidlo--tiche" type="submit">Premenovať</button>
                      </form>

                      <form action={moveFolderAction} className="strom-forma">
                        <input type="hidden" name="id" value={p.id} />
                        {filters.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                        <Select
                          meno="parentId"
                          predvolena={p.parentId ?? ""}
                          popisPola={`Nadriadený priečinok pre ${p.nazov}`}
                          volby={[
                            { hodnota: "", popis: "— najvyššia úroveň —" },
                            ...tree
                              .filter(r => !inside.has(r.priecinok.id))
                              .map(r => ({
                                hodnota: r.priecinok.id,
                                popis: `${"— ".repeat(r.uroven - 1)}${r.priecinok.nazov}`,
                              })),
                          ]}
                        />
                        <button className="tlacidlo tlacidlo--tiche" type="submit">Presunúť</button>
                      </form>

                      {c.sPodriadenymi === 0 && inside.size === 1 ? (
                        <form action={deleteFolderAction}>
                          <input type="hidden" name="id" value={p.id} />
                          {filters.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
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

          <form action={createFolderAction} className="strom-forma" style={{ marginTop: 12 }}>
            {filters.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <input className="pole-vstup" name="nazov" placeholder="Nový priečinok"
                   aria-label="Názov nového priečinka" required />
            <Select
              meno="parentId"
              predvolena={folder && folder !== "nezaradene" ? folder : ""}
              popisPola="Nadriadený priečinok"
              volby={[
                { hodnota: "", popis: "— najvyššia úroveň —" },
                ...tree
                  .filter(r => depth(folders, r.priecinok.id) < MAX_DEPTH)
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

      {rows.length === 0 ? (
        <p className="karta" style={{ padding: 20, fontSize: 15 }}>
          {search ? "Nič sa nenašlo." : "Zatiaľ tu nie je nič. Začni nahratím prvého dokumentu."}
        </p>
      ) : (
        <ul className="audit">
          {rows.map(r => (
            <li key={r.documentId} className="karta audit-zaznam">
              <div className="audit-hlavicka">
                <Link href={`/kniznica/${encodeURIComponent(r.documentId)}`} style={{ fontWeight: 600 }}>
                  {r.title}
                </Link>
                <span className="stitok">{PROCESSING_LABEL[r.stavSpracovania] ?? r.stavSpracovania}</span>
                {r.maKoncept && r.stav !== "published" && <span className="stitok">koncept</span>}
              </div>

              <div className="tichy audit-kto">
                {r.cestaPriecinkov?.length ? `${r.cestaPriecinkov.join(" / ")} · ` : ""}
                {r.documentId}
                {r.povodnySubor && ` · ${r.povodnySubor.nazov} (${formatSize(r.povodnySubor.bajtov)})`}
                {r.updatedAt && ` · ${formatDate(r.updatedAt, uiLanguage)}`}
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
