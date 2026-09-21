/**
 * Správa priečinkov knižnice (NASADENIE, PR 4).
 *
 * Bývala v paneli filtrov na `/library` — premenovanie, presun, poradie
 * ťahaním aj zakladanie. Na telefóne z toho bol stĺpec dlhý stovky riadkov
 * pod výsledkami a hlavne: **filtrovanie a správa sú dve rôzne úlohy.**
 * Panel odteraz priečinok len vyberá; všetko, čo priečinky mení, je tu.
 *
 * Akcie sú tie isté ako predtým (`../actions`) — nesú `return=folders`,
 * takže `backToLibrary()` vracia človeka sem a nie na zoznam.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { libraryContext } from "@/lib/library"
import { allFolders, flattenTree, subtree, counts, depth, MAX_DEPTH } from "@/lib/folders"
import {
  createFolderAction, renameFolderAction, moveFolderAction, deleteFolderAction,
  shiftFolderAction, saveFolderOrderAction,
} from "../actions"
import TreeWithOrder from "@/components/TreeWithOrder"
import Select from "@/components/Select"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import { normalizeLayout } from "@/lib/appNav"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

export default async function FoldersPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const q = normalizeQuery<{ msg?: string; error?: string; layout?: string }>(await searchParams)
  const branding = brandingView(ctx.tenant)
  const uiLanguage = ctx.person.language
  const t = dictionary(uiLanguage).library.list
  const tf = dictionary(uiLanguage).library.folders

  const folders = await allFolders(ctx.tenant.companyCode)
  const folderCounts = await counts(ctx.tenant.companyCode)
  const tree = flattenTree(folders)

  /** Po akcii späť sem, nie na zoznam — viď `backToLibrary()` v akciách. */
  const carried: [string, string][] = [["return", "folders"]]

  return (
    <AppShell layout={normalizeLayout(q.layout)} language={uiLanguage}>
      <div style={{ maxWidth: 640, ...tenantStyle(branding) }}>
        <Notice message={q.msg} error={q.error === "1"} back="/library/folders" />

        <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 6px" }}>
          <h1 className="page-title" style={{ margin: 0 }}>{tf.manage}</h1>
          <Link className="quiet" href="/library" style={{ marginLeft: "auto" }}>
            ← {t.heading}
          </Link>
        </div>

        {/*
          Prázdny strom (PRIECINKY, úloha 1): `.empty` zo ZAKLADU nad
          formulárom, bez tlačidla — formulár je hneď pod tým a dve výzvy
          k tomu istému sú šum.
        */}
        {folders.length === 0 && (
          <div className="empty">
            <div className="empty-title">{tf.emptyTitle}</div>
            <div className="empty-text">{tf.emptyText}</div>
          </div>
        )}

        <TreeWithOrder
          language={uiLanguage}
          hidden={carried}
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
                <div className="tree-row" style={{ gap: 6 }}>
                  <span className="tree-grip" aria-hidden="true">⠿</span>
                  {/* Názov vedie na vyfiltrovaný zoznam — správca si obsah
                      priečinka pozrie tam, kde sa s ním pracuje. */}
                  <Link href={`/library?folder=${encodeURIComponent(p.id)}`} className="tree-name">
                    {p.name}
                  </Link>
                  <span className="quiet tree-count">{c.withDescendants}</span>
                </div>

                <details>
                  <summary className="quiet tree-edit-toggle">
                    {tf.edit}
                  </summary>
                  <div className="tree-edit">
                    {/* Posun o jedno miesto. Ťahanie myšou robí to isté,
                        ale toto funguje aj bez JavaScriptu a klávesnicou. */}
                    <div className="tree-arrows">
                      <form action={shiftFolderAction}>
                        <input type="hidden" name="id" value={p.id} />
                        {carried.map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
                        <input type="hidden" name="direction" value="up" />
                        <button className="button button--quiet" type="submit"
                                aria-label={tf.moveUp(p.name)}>{tf.up}</button>
                      </form>
                      <form action={shiftFolderAction}>
                        <input type="hidden" name="id" value={p.id} />
                        {carried.map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
                        <input type="hidden" name="direction" value="down" />
                        <button className="button button--quiet" type="submit"
                                aria-label={tf.moveDown(p.name)}>{tf.down}</button>
                      </form>
                    </div>

                    <form action={renameFolderAction} className="tree-form">
                      <input type="hidden" name="id" value={p.id} />
                      {carried.map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
                      <input className="field-input" name="name" defaultValue={p.name}
                             aria-label={tf.nameOf(p.name)} required />
                      <button className="button button--quiet" type="submit">{tf.rename}</button>
                    </form>

                    <form action={moveFolderAction} className="tree-form">
                      <input type="hidden" name="id" value={p.id} />
                      {carried.map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
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
                      <button className="button button--quiet" type="submit">{tf.move}</button>
                    </form>

                    {c.withDescendants === 0 && inside.size === 1 ? (
                      <form action={deleteFolderAction}>
                        <input type="hidden" name="id" value={p.id} />
                        {carried.map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
                        <button className="button button--quiet" type="submit">{tf.remove}</button>
                      </form>
                    ) : (
                      <p className="quiet" style={{ fontSize: "var(--fs-micro)", margin: 0 }}>
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

        <form action={createFolderAction} className="tree-form" style={{ marginTop: 12 }}>
          {carried.map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
          <input className="field-input" name="name" placeholder={tf.newFolder}
                 aria-label={tf.newFolderName} required />
          <Select
            name="parentId"
            initial=""
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
          <button className="button button--quiet" type="submit">{tf.create}</button>
        </form>
      </div>
    </AppShell>
  )
}
