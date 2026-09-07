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
import { libraryList, libraryFacets } from "@/lib/libraryRead"
import { allFolders, flattenTree, subtree, counts, depth, MAX_DEPTH } from "@/lib/folders"
import { codelistOptions } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import Select from "@/components/Select"
import {
  createFolderAction, renameFolderAction, moveFolderAction, deleteFolderAction,
  shiftFolderAction, saveFolderOrderAction,
} from "./actions"
import TreeWithOrder from "@/components/TreeWithOrder"
import AppShell from "@/components/AppShell"
import { normalizeLayout } from "@/components/AppNav"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, dictionary } from "@/lib/i18n"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import {
  readFilters, toggle, setValue, clearFilters, isEmpty, toQuery, carryFields, activeChips,
  type MultiKey,
} from "@/lib/libraryFilters"
import MultiSelect from "@/components/MultiSelect"

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
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const q = normalizeQuery<{
    msg?: string; error?: string; search?: string; status?: string
    folder?: string; category?: string; language?: string; accessLevel?: string; tag?: string
    layout?: string
  }>(await searchParams)
  const { msg: message, error } = q
  const filters = readFilters(q)
  const { search, folder } = filters
  const branding = brandingView(ctx.tenant)
  const uiLanguage = ctx.person.language
  const t = dictionary(uiLanguage).library.list
  const tf = dictionary(uiLanguage).library.folders
  const extras = tenantExtras(ctx.tenant)

  // Filtre z adresy v tvare, aký čaká dotazová vrstva. Ten istý objekt ide
  // do zoznamu aj do počtov — keby sa rozišli, panel by ukazoval čísla
  // k inému pohľadu, než je na obrazovke.
  const listFilter = {
    search: filters.search,
    status: filters.status,
    priecinok: filters.folder,
    category: filters.category,
    language: filters.language,
    accessLevel: filters.accessLevel,
    tag: filters.tag,
  }

  const [rows, folders, folderCounts, facets] = await Promise.all([
    libraryList(ctx.tenant.companyCode, listFilter),
    allFolders(ctx.tenant.companyCode),
    counts(ctx.tenant.companyCode),
    libraryFacets(ctx.tenant.companyCode, listFilter),
  ])
  const tree = flattenTree(folders)

  // Filtre sa nesú ďalej v každom odkaze aj v každom formulári — inak by sa
  // človek po založení priečinka ocitol späť na nefiltrovanom zozname.
  // Variant navigácie a pohľad sa nesú spolu s nimi z toho istého dôvodu.
  const carried = carryFields(filters)
  const hasFilter = !isEmpty(filters)

  /** Odkaz s vymeneným priečinkom; ostatné filtre zostávajú. */
  const withFolder = (folderId?: string) => toQuery(setValue(filters, "folder", folderId))

  /** Odkaz, ktorý prepne jednu hodnotu facetu. */
  const facetHref = (key: MultiKey, value: string) => toQuery(toggle(filters, key, value))

  /**
   * Popisky facetov z číselníka. Hodnota v databáze je kľúč (`norma`),
   * v paneli má byť to, čo číselník hovorí (`Norma`) — a keď hodnota
   * v číselníku už nie je, ukáže sa kľúč, nie prázdno.
   */
  const labelFrom = (codelist: string) => {
    const map = new Map(codelistOptions(codelist, extras).map(o => [o.value, o.label]))
    return (value: string) => map.get(value) ?? value
  }
  const categoryLabel = labelFrom("category")
  const tagLabel = labelFrom("tags")
  const accessLabel = labelFrom("accessLevel")
  const statusLabel = (value: string) => (value === "published" ? t.statusPublished : t.statusDrafts)

  const facetLabel: Record<MultiKey, { title: string; label: (v: string) => string }> = {
    category: { title: t.category, label: categoryLabel },
    status: { title: t.status, label: statusLabel },
    tag: { title: t.tag, label: tagLabel },
    accessLevel: { title: t.accessLevel, label: accessLabel },
    language: { title: t.status, label: (v) => v },
  }

  /** Skupiny, ktoré sa v paneli vykresľujú ako zoznam s počtami. */
  const facetGroups: { key: MultiKey; rows: { value: string; count: number }[] }[] = [
    { key: "category", rows: facets.category },
    { key: "status", rows: facets.status },
    { key: "accessLevel", rows: facets.accessLevel },
  ]


  return (
    /*
     * Prvá stránka v aplikačnom shelli (viď `components/AppShell.tsx`).
     *
     * `.obal` s max. 900 px tu skončil zámerne: knižnica je zoznam s filtrami
     * a na 900 px sa vedľa seba nezmestí panel filtrov a zoznam. Ostatné
     * stránky ho majú ďalej — shell je opt-in a presúvajú sa po jednej.
     *
     * Variant navigácie je zatiaľ len z adresy (`?layout=sidebar`). Uložiť ho
     * na osobu alebo organizáciu znamená zmenu schémy, a tá je samostatné
     * rozhodnutie s vlastnou migráciou.
     */
    <AppShell layout={normalizeLayout(q.layout)} language={uiLanguage}>
    <div style={tenantStyle(branding)}>
      <Notice message={message} error={error === "1"} back="/library" />

      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 6px" }}>
        <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: 0 }}>{t.heading}</h1>
        {/* „N z M" hovorí, či je krátky zoznam výsledok filtra alebo stav
            knižnice. Bez toho čísla sa to nedá rozoznať. */}
        <span className="tichy library-count">{t.shown(facets.total, facets.all)}</span>
        <Link className="tlacidlo" href="/library/new">{t.upload}</Link>
        <Link className="tlacidlo tlacidlo--tiche" href="/library/tracks">
          {dictionary(uiLanguage).library.tracks.heading}
        </Link>
      </div>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 20px", maxWidth: 640 }}>
        {t.introBefore}<strong>{t.introHighlight}</strong>{t.introAfter}
      </p>

      {/*
        Hľadanie zostáva formulárom (`method="get"`), nie odkazom: text sa
        píše a odošle, nie vyberá. Skryté polia nesú zvyšok pohľadu — bez nich
        by odoslanie hľadania zrušilo facety, priečinok aj variant navigácie.
      */}
      <form className="library-search" method="get" action="/library">
        <label className="pole" style={{ flex: "1 1 240px", margin: 0 }}>
          <span className="pole-popis">{t.search}</span>
          <input className="pole-vstup" name="search" defaultValue={search ?? ""} placeholder={t.searchPlaceholder} />
        </label>
        {carried
          .filter(([k]) => k !== "search")
          .map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
        <button className="tlacidlo tlacidlo--tiche" type="submit">{t.filter}</button>
      </form>

      {/*
        Chips aktívnych filtrov. Sú tu preto, že panel filtrov sa na úzkej
        obrazovke zabalí nad zoznam a človek by inak nemal ako vidieť, prečo
        je zoznam krátky — a hlavne ako to zrušiť. Krížik odoberá jeden filter,
        nie všetky.
      */}
      {hasFilter && (
        <div className="library-chips">
          {activeChips(filters).map(({ key, value }) => (
            <Link
              key={`${key}-${value}`}
              href={facetHref(key, value)}
              className="library-chip"
              aria-label={t.removeFilter(facetLabel[key].label(value))}
            >
              <span className="library-chip-key">{facetLabel[key].title}:</span>
              {facetLabel[key].label(value)}
              <span className="library-chip-x" aria-hidden="true">×</span>
            </Link>
          ))}
          <Link className="library-chips-clear" href={toQuery(clearFilters(filters))}>{t.clearFilters}</Link>
        </div>
      )}

      <div className="kniznica-mriezka">
        <aside className="kniznica-priecinky">
          {/*
            Panel filtrov.
            
            Počty pri hodnotách sú tu preto, že bez nich je facet hádanie:
            človek klikne a dozvie sa, že tam nič nie je. A počítajú sa **bez
            vlastného filtra** (`libraryFacets`), takže po výbere „Norma"
            ostatné druhy stále hovoria, koľko by ich bolo — to je informácia,
            ktorá o prepnutí rozhoduje.

            Hodnoty s nulou sa nezobrazujú: agregácia ich nevráti, lebo
            v tejto organizácii taký dokument neexistuje. Ponúkať filtre,
            ktoré nikdy nič nenájdu, je len dlhší panel.
          */}
          <div className="facets">
            <div className="facets-head">
              <h2 className="facets-title">{t.filtersTitle}</h2>
              {hasFilter && (
                <Link className="facets-clear" href={toQuery(clearFilters(filters))}>{t.clearFilters}</Link>
              )}
            </div>

            {facetGroups.map(group => group.rows.length === 0 ? null : (
              <div className="facet-group" key={group.key}>
                <h3 className="facet-group-title">{facetLabel[group.key].title}</h3>
                {group.rows.map(row => {
                  const on = filters[group.key].includes(row.value)
                  return (
                    <Link
                      key={row.value}
                      href={facetHref(group.key, row.value)}
                      className={`facet${on ? " is-on" : ""}`}
                    >
                      <span className="facet-box" aria-hidden="true">{on ? "✓" : ""}</span>
                      <span className="facet-name">{facetLabel[group.key].label(row.value)}</span>
                      <span className="facet-count">{row.count}</span>
                    </Link>
                  )
                })}
              </div>
            ))}

            {/*
              Značky nie sú zoznam, ale viacnásobný výber s hľadaním: je ich
              rádovo viac než druhov a tridsať riadkov v paneli sa nedá
              prečítať. `emit="repeat"` preto, že tu ide o adresu
              (`?tag=a&tag=b`), nie o uloženie záznamu.

              Vlastná hodnota sa tu pridať nedá (`allowNew` je vypnuté) —
              filtrovať podľa značky, ktorú nikto nemá, znamená prázdny zoznam
              a človek by hľadal chybu v dátach.
            */}
            {facets.tag.length > 0 && (
              <form className="facet-group" method="get" action="/library">
                <MultiSelect
                  name="tag"
                  label={t.tag}
                  emit="repeat"
                  placeholder={t.tagSearch}
                  language={uiLanguage}
                  selected={filters.tag}
                  options={facets.tag.map(r => ({
                    value: r.value,
                    label: tagLabel(r.value),
                    count: r.count,
                  }))}
                />
                {carried
                  .filter(([k]) => k !== "tag")
                  .map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
                <button className="tlacidlo tlacidlo--tiche facet-apply" type="submit">{t.apply}</button>
              </form>
            )}
          </div>

          <h2 className="pole-popis" style={{ margin: "0 0 8px" }}>{tf.heading}</h2>

          <ul className="strom">
            <li className="strom-polozka">
              <Link
                href={withFolder(undefined)}
                className={`strom-riadok${!folder ? " je-aktivny" : ""}`}
              >
                <span className="strom-nazov">{tf.allDocuments}</span>
              </Link>
            </li>
            <li className="strom-polozka">
              <Link
                href={withFolder("nezaradene")}
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
                  <div className="strom-riadok" style={{ gap: 6 }}>
                    <span className="strom-uchop" aria-hidden="true">⠿</span>
                    <Link
                      href={withFolder(p.id)}
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
                          {carried.map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
                          <input type="hidden" name="direction" value="up" />
                          <button className="tlacidlo tlacidlo--tiche" type="submit"
                                  aria-label={tf.moveUp(p.name)}>{tf.up}</button>
                        </form>
                        <form action={shiftFolderAction}>
                          <input type="hidden" name="id" value={p.id} />
                          {carried.map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
                          <input type="hidden" name="direction" value="down" />
                          <button className="tlacidlo tlacidlo--tiche" type="submit"
                                  aria-label={tf.moveDown(p.name)}>{tf.down}</button>
                        </form>
                      </div>

                      <form action={renameFolderAction} className="strom-forma">
                        <input type="hidden" name="id" value={p.id} />
                        {carried.map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
                        <input className="pole-vstup" name="name" defaultValue={p.name}
                               aria-label={tf.nameOf(p.name)} required />
                        <button className="tlacidlo tlacidlo--tiche" type="submit">{tf.rename}</button>
                      </form>

                      <form action={moveFolderAction} className="strom-forma">
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
                        <button className="tlacidlo tlacidlo--tiche" type="submit">{tf.move}</button>
                      </form>

                      {c.withDescendants === 0 && inside.size === 1 ? (
                        <form action={deleteFolderAction}>
                          <input type="hidden" name="id" value={p.id} />
                          {carried.map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
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
            {carried.map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
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
                <Link href={`/library/${encodeURIComponent(r.documentId)}`} style={{ fontWeight: 600 }}>
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
    </AppShell>
  )
}
