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
import { formatDate, dictionary } from "@/lib/i18n"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

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
  const t = dictionary(uiLanguage).library.list
  const tf = dictionary(uiLanguage).library.folders
  const extras = tenantExtras(ctx.tenant)

  const [rows, folders, folderCounts] = await Promise.all([
    libraryList(ctx.tenant.companyCode, { search: search, status: state, priecinok: folder, category, language, accessLevel, tag }),
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
      <Notice message={message} error={error === "1"} back="/kniznica" />

      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 6px" }}>
        <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: 0 }}>{t.heading}</h1>
        <Link className="tlacidlo" href="/kniznica/nova">{t.upload}</Link>
      </div>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 20px", maxWidth: 640 }}>
        {t.introBefore}<strong>{t.introHighlight}</strong>{t.introAfter}
      </p>

      <form className="audit-filter" method="get">
        <label className="pole" style={{ flex: "1 1 220px", margin: 0 }}>
          <span className="pole-popis">{t.search}</span>
          <input className="pole-vstup" name="search" defaultValue={search ?? ""} placeholder={t.searchPlaceholder} />
        </label>

        <div className="pole" style={{ flex: "0 1 180px", margin: 0 }}>
          <span className="pole-popis">{t.category}</span>
          <Select
            name="category"
            options={[{ value: "", label: t.all }, ...codelistOptions("category", extras)]}
            initial={category ?? ""}
            fieldLabel={t.categoryField}
          />
        </div>

        <div className="pole" style={{ flex: "0 1 160px", margin: 0 }}>
          <span className="pole-popis">{t.tag}</span>
          <Select
            name="tag"
            options={[{ value: "", label: t.all }, ...codelistOptions("tags", extras)]}
            initial={tag ?? ""}
            fieldLabel={t.tag}
          />
        </div>

        <div className="pole" style={{ flex: "0 1 150px", margin: 0 }}>
          <span className="pole-popis">{t.status}</span>
          <Select
            name="status"
            options={[
              { value: "", label: t.all },
              { value: "published", label: t.statusPublished },
              { value: "draft", label: t.statusDrafts },
            ]}
            initial={state ?? ""}
            fieldLabel={t.status}
          />
        </div>

        {/* Priečinok sa vyberá kliknutím v strome vedľa, nie tu — ale musí sa
            preniesť, inak by odoslanie filtra vyskočilo z priečinka von. */}
        {folder && <input type="hidden" name="folder" value={folder} />}
        {language && <input type="hidden" name="language" value={language} />}
        {accessLevel && <input type="hidden" name="accessLevel" value={accessLevel} />}

        <button className="tlacidlo tlacidlo--tiche" type="submit">{t.filter}</button>
        {hasFilter && (
          <Link className="tichy" href="/kniznica" style={{ fontSize: 14 }}>{t.clearFilters}</Link>
        )}
      </form>

      <div className="kniznica-mriezka">
        <aside className="kniznica-priecinky">
          <h2 className="pole-popis" style={{ margin: "0 0 8px" }}>{tf.heading}</h2>

          <ul className="strom">
            <li className="strom-polozka">
              <Link
                href={withFilter({ priecinok: undefined })}
                className={`strom-riadok${!folder ? " je-aktivny" : ""}`}
              >
                <span className="strom-nazov">{tf.allDocuments}</span>
              </Link>
            </li>
            <li className="strom-polozka">
              <Link
                href={withFilter({ priecinok: "nezaradene" })}
                className={`strom-riadok${folder === "nezaradene" ? " je-aktivny" : ""}`}
              >
                <span className="tichy strom-nazov">{tf.unfiled}</span>
              </Link>
            </li>

          </ul>

          {/* Fixné položky vyššie do preusporadúvania nepatria — nie sú to
              priečinky, ale pohľady na celý zoznam. */}
          <TreeWithOrder
            language={uiLanguage}
            hidden={Object.fromEntries(filters)}
            action={saveFolderOrderAction}
            items={tree.map(({ folder: p, level: level }) => {
              const c = folderCounts.get(p.id) ?? { direct: 0, withDescendants: 0 }
              const inside = subtree(folders, p.id)
              return {
                id: p.id,
                name: p.name,
                parentId: p.parentId ?? null,
                level: level,
                content: (
                  <>
                  <div className="strom-riadok" style={{ gap: 6 }}>
                    <span className="strom-uchop" aria-hidden="true">⠿</span>
                    <Link
                      href={withFilter({ priecinok: p.id })}
                      className={`strom-nazov${folder === p.id ? " je-aktivny" : ""}`}
                    >
                      {p.name}
                    </Link>
                    <span className="tichy strom-pocet">{c.withDescendants}</span>
                  </div>

                  <details>
                    <summary className="tichy" style={{ fontSize: 12.5, cursor: "pointer", padding: "0 12px 6px" }}>
                      {tf.edit}
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
                                  aria-label={tf.moveUp(p.name)}>{tf.up}</button>
                        </form>
                        <form action={shiftFolderAction}>
                          <input type="hidden" name="id" value={p.id} />
                          {filters.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                          <input type="hidden" name="smer" value="dole" />
                          <button className="tlacidlo tlacidlo--tiche" type="submit"
                                  aria-label={tf.moveDown(p.name)}>{tf.down}</button>
                        </form>
                      </div>

                      <form action={renameFolderAction} className="strom-forma">
                        <input type="hidden" name="id" value={p.id} />
                        {filters.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                        <input className="pole-vstup" name="name" defaultValue={p.name}
                               aria-label={tf.nameOf(p.name)} required />
                        <button className="tlacidlo tlacidlo--tiche" type="submit">{tf.rename}</button>
                      </form>

                      <form action={moveFolderAction} className="strom-forma">
                        <input type="hidden" name="id" value={p.id} />
                        {filters.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                        <Select
                          name="parentId"
                          initial={p.parentId ?? ""}
                          fieldLabel={tf.parentOf(p.name)}
                          options={[
                            { value: "", label: tf.topLevel },
                            ...tree
                              .filter(r => !inside.has(r.folder.id))
                              .map(r => ({
                                value: r.folder.id,
                                label: `${"— ".repeat(r.level - 1)}${r.folder.name}`,
                              })),
                          ]}
                        />
                        <button className="tlacidlo tlacidlo--tiche" type="submit">{tf.move}</button>
                      </form>

                      {c.withDescendants === 0 && inside.size === 1 ? (
                        <form action={deleteFolderAction}>
                          <input type="hidden" name="id" value={p.id} />
                          {filters.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                          <button className="tlacidlo tlacidlo--tiche" type="submit">{tf.remove}</button>
                        </form>
                      ) : (
                        <p className="tichy" style={{ fontSize: 12.5, margin: 0 }}>
                          {tf.removeHint}
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
            <input className="pole-vstup" name="name" placeholder={tf.newFolder}
                   aria-label={tf.newFolderName} required />
            <Select
              name="parentId"
              initial={folder && folder !== "nezaradene" ? folder : ""}
              fieldLabel={tf.parentFolder}
              options={[
                { value: "", label: tf.topLevel },
                ...tree
                  .filter(r => depth(folders, r.folder.id) < MAX_DEPTH)
                  .map(r => ({
                    value: r.folder.id,
                    label: `${"— ".repeat(r.level - 1)}${r.folder.name}`,
                  })),
              ]}
            />
            <button className="tlacidlo tlacidlo--tiche" type="submit">{tf.create}</button>
          </form>
        </aside>

        <div className="kniznica-zoznam">

      {rows.length === 0 ? (
        <p className="karta" style={{ padding: 20, fontSize: 15 }}>
          {search ? t.nothingFound : t.empty}
        </p>
      ) : (
        <ul className="audit">
          {rows.map(r => (
            <li key={r.documentId} className="karta audit-zaznam">
              <div className="audit-hlavicka">
                <Link href={`/kniznica/${encodeURIComponent(r.documentId)}`} style={{ fontWeight: 600 }}>
                  {r.title}
                </Link>
                <span className="stitok">{t.processing[r.processingState] ?? r.processingState}</span>
                {r.hasDraft && r.status !== "published" && <span className="stitok">{t.draft}</span>}
              </div>

              <div className="tichy audit-kto">
                {r.folderTrail?.length ? `${r.folderTrail.join(" / ")} · ` : ""}
                {r.documentId}
                {r.originalFile && ` · ${r.originalFile.name} (${formatSize(r.originalFile.bytes)})`}
                {r.updatedAt && ` · ${formatDate(r.updatedAt, uiLanguage)}`}
                {r.updatedBy && ` · ${r.updatedBy}`}
              </div>

              <div className="audit-zmeny">
                <div>
                  <span className="audit-pole">{t.effectiveVersion}</span>
                  <span>{r.effectiveLabel}</span>
                  {r.versionCount > 0 && <span className="tichy"> · {t.versions(r.versionCount)}</span>}
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
