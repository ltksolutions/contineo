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
  shiftFolderAction, saveFolderOrderAction, moveManyAction, assignManyAction,
} from "./actions"
import TreeWithOrder from "@/components/TreeWithOrder"
import AppShell from "@/components/AppShell"
import { normalizeLayout } from "@/lib/appNav"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, dictionary } from "@/lib/i18n"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import {
  readFilters, toggle, setValue, clearFilters, isEmpty, toQuery, carryFields, activeChips,
  sortBy, currentSort, pageOf, withPage, sortRows, pageRows, setView, currentView,
  addCondition, removeCondition, splitConditions, mergeConditions,
  type MultiKey, type SortKey,
} from "@/lib/libraryFilters"
import {
  OPS_FOR_FIELD, CONDITION_FIELDS, decodeCondition, describeConditions,
  normalizeGroups, startsGroup,
  type ConditionField, type ConditionOp,
} from "@/lib/libraryConditions"
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
    add?: string; value?: string; join?: string
  }>(await searchParams)
  const { msg: message, error } = q
  const filters = readFilters(q)
  const { search, folder } = filters

  /*
   * Pridanie podmienky sa dokončí presmerovaním na čistú adresu.
   *
   * Formulár odošle `add` a `value`; keby zostali v adrese, každý ďalší odkaz
   * by ich niesol so sebou a podmienka by sa pri návrate v histórii pridala
   * druhýkrát. `redirect()` je tu zámerne mimo `try` — vyhadzuje výnimku.
   */
  const pending = q.add && q.value ? decodeCondition(`${q.add}~${encodeURIComponent(q.value)}`) : null
  // `join=or` otvorí novú skupinu, čokoľvek iné pripojí podmienku k poslednej.
  // Rozhoduje o tom **tlačidlo, ktorým sa formulár odoslal** — nie prepínač
  // niekde inde na obrazovke: spojka je vlastnosť tohto pridania.
  if (pending) redirect(toQuery(addCondition(filters, pending, q.join === "or" ? "or" : "and")))
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
    conditions: filters.conditions,
    match: filters.match,
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

  // Poradie a strana sa počítajú tu, nad načítanými riadkami — dôvod je
  // v `sortRows`: podľa cesty priečinkov ani platného znenia sa v databáze
  // triediť nedá, lebo obe vznikajú až tu.
  const sort = currentSort(filters)
  const paged = pageRows(sortRows(rows, sort.key, sort.dir), pageOf(filters))
  const view = currentView(filters)
  const tb = t.builder
  const tl = t.bulk
  const conditions = filters.conditions
  /*
   * Podmienky s doplnenými skupinami. Robí sa to raz tu, nie v každom
   * odkaze: starý odkaz nesie podmienky bez skupiny a keby si ju každé
   * miesto domýšľalo samo, na jednom z nich by sa raz domyslelo inak — a
   * riadok by sa presunul do inej skupiny, než na akú človek klikol.
   */
  const condRows = normalizeGroups(conditions, filters.match)

  /*
   * Dvojice pole + operátor ako jedna ponuka. Vzniká z tabuľky povolených
   * operátorov, takže neplatná kombinácia sa nedá vybrať — nie preto, že ju
   * server odmietne, ale preto, že v zozname nie je.
   */
  const fieldOps = CONDITION_FIELDS.flatMap((field: ConditionField) =>
    OPS_FOR_FIELD[field].map((op: ConditionOp) => ({
      value: `${field}~${op}`,
      label: `${tb.fields[field]} ${tb.ops[op]}`,
    })),
  )

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

        {/*
          Skok na filtre — **len na telefóne** (na širokej obrazovke ich má
          človek vedľa zoznamu a odkaz CSS skryje).

          V jednom stĺpci je panel filtrov pod výsledkami, aby nad prvým
          dokumentom nestála obrazovka a pol filtrov. Bez tohto odkazu sa
          k nim ale človek dostane len rolovaním cez celý zoznam. Je to
          obyčajná kotva: funguje bez skriptu a dá sa poslať v adrese.
        */}
        <a className="filters-jump" href="#filtre">{t.jumpToFilters}</a>

        {/*
          Prepínač pohľadu. Sú to dva odkazy, nie tlačidlá s JavaScriptom:
          pohľad je súčasť adresy, takže sa dá poslať aj s ním — a funguje bez
          skriptu. Aktívny odkaz zostáva odkazom (vedie sám na seba), lebo
          `aria-current` povie čítačke to isté a nemusí sa riešiť dvojaký tvar.
        */}
        <span className="view-switch" role="group" aria-label={t.viewSwitch}>
          {([["table", t.viewTable], ["cards", t.viewCards]] as const).map(([key, label]) => (
            <Link
              key={key}
              href={toQuery(setView(filters, key))}
              className={`view-switch-item${view === key ? " is-on" : ""}`}
              aria-current={view === key ? "true" : undefined}
            >
              {label}
            </Link>
          ))}
        </span>
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

      {/*
        Query builder.

        Celý beží bez JavaScriptu: podmienky sú v adrese, pridanie je odoslanie
        formulára, odobranie aj zmena spojky sú odkazy.

        **Zátvorky sú skupiny, nie znaky.** Vnútri skupiny platí A, medzi
        skupinami ALEBO — teda `(A a B) alebo (C a D)`. Písané zátvorky by
        znamenali parser a klientsky stav; takto je logika vidieť z odsadenia
        a zo spojky pred riadkom, a mení sa jedným kliknutím.

        Pole a operátor sú **jeden výber**, nie dva: „Názov obsahuje" je aj
        veta, ktorou to človek povie, a hlavne sa tak nedá zostaviť dvojica,
        ktorá nedáva zmysel („Zmenené obsahuje").
      */}
      <details className="builder" open={conditions.length > 0}>
        <summary className="builder-summary">
          {tb.heading}
          {conditions.length > 0 && <span className="builder-count">{conditions.length}</span>}
        </summary>

        {conditions.length > 0 && (
          <>
            <ul className="builder-rows">
              {condRows.map((c, i) => {
                const opens = startsGroup(condRows, i)
                return (
                  <li
                    key={`${c.field}-${c.op}-${c.value}-${i}`}
                    className={`builder-row${opens && i > 0 ? " builder-row--group" : ""}`}
                  >
                    <span className="builder-join">
                      {i === 0 ? tb.joinFirst : opens ? tb.joinAny : tb.joinAll}
                    </span>
                    <span className="builder-text">
                      {tb.fields[c.field]} {tb.ops[c.op]} <strong>{c.value}</strong>
                    </span>
                    {/* Zmena spojky pred riadkom. Odkaz, nie prepínač: vedie
                        na inú adresu a funguje bez skriptu. Pri prvom riadku
                        nie je čo meniť — pred ním nič nie je. */}
                    {i > 0 && (
                      <Link
                        className="builder-join-switch"
                        href={toQuery(
                          opens ? mergeConditions(filters, i) : splitConditions(filters, i),
                        )}
                      >
                        {opens ? tb.makeAnd : tb.makeOr}
                      </Link>
                    )}
                    <Link
                      className="builder-remove"
                      href={toQuery(removeCondition(filters, i))}
                      aria-label={tb.remove(`${tb.fields[c.field]} ${tb.ops[c.op]} ${c.value}`)}
                    >
                      ×
                    </Link>
                  </li>
                )
              })}
            </ul>

            {/* Náhľad dotazu vetou — kontrola, že človek a systém rozumejú
                tomu istému. Skladá sa z uložených podmienok, nie z toho,
                čo je práve rozpísané vo formulári. */}
            <p className="builder-preview">
              {tb.preview}{" "}
              {describeConditions(
                conditions,
                filters.match,
                f => tb.fields[f],
                o => tb.ops[o],
                m => (m === "any" ? tb.joinAny : tb.joinAll),
              )}
            </p>
          </>
        )}

        <form className="builder-add" method="get" action="/library">
          <div className="pole">
            <span className="pole-popis">{tb.field}</span>
            <Select name="add" options={fieldOps} initial={fieldOps[0]?.value} fieldLabel={tb.field} />
          </div>
          <label className="pole builder-value">
            <span className="pole-popis">{tb.value}</span>
            <input className="pole-vstup" name="value" required />
          </label>
          {carried.map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
          {/* Dve tlačidlá jedného formulára, nie prepínač vedľa neho: spojka
              je vlastnosť tohto pridania a takto sa vyberá tým istým klikom,
              ktorým sa podmienka pridáva. Pri prvej podmienke sa spojka nemá
              čoho chytiť, preto je vtedy len jedno. */}
          <button className="tlacidlo tlacidlo--tiche" type="submit" name="join" value="and">
            {conditions.length === 0 ? tb.add : tb.addAnd}
          </button>
          {conditions.length > 0 && (
            <button className="tlacidlo tlacidlo--tiche" type="submit" name="join" value="or">
              {tb.addOr}
            </button>
          )}
        </form>

        <p className="tichy builder-hint">{tb.hint}</p>
      </details>

      <div className="kniznica-mriezka">
        <aside className="kniznica-priecinky" id="filtre">
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

          {/* Cesta späť. Kto zíde dolu k filtrom, musí sa vedieť vrátiť
              k výsledkom bez rolovania cez celý panel. Tiež len na telefóne. */}
          <a className="filters-jump filters-jump--back" href="#zoznam">{t.backToList}</a>
        </aside>

        <div className="kniznica-zoznam" id="zoznam">

      {rows.length === 0 ? (
        <p className="karta" style={{ padding: 20, fontSize: 15 }}>
          {search ? t.nothingFound : t.empty}
        </p>
      ) : (
        /*
          Výber riadkov je stav formulára, nie klienta — celá knižnica beží
          bez JavaScriptu. Dôsledok, ktorý je lepšie povedať nahlas: **výber
          platí pre viditeľnú stranu.** Prechod na inú stranu ho zabudne, lebo
          formulár sa odošle až akciou. Pri 25 riadkoch na stranu to na bežnú
          prácu stačí a je to čitateľnejšie než výber, ktorý sa neviditeľne
          vlečie naprieč filtrami a človek netuší, čo v ňom ešte je.
        */
        <form className="bulk-form">
          {/*
            Tabuľka, nie karty: v knižnici sa dokumenty **porovnávajú** —
            ktoré znenie platí, čo sa kedy zmenilo. Na to musia byť tie isté
            údaje pod sebou v stĺpci, nie rozsypané v každej karte inak.
            Kartový pohľad je vedľa nej ako voľba, nie namiesto nej.

            Obal roluje vodorovne a tabuľka má `min-width`: stĺpce sa nesmú
            stlačiť tak, že sa dátum zalomí do troch riadkov. Na telefóne je
            posun prstom čitateľnejší než rozbitá mriežka.
          */}
          {view === "cards" ? (
          /*
            Karty sú na prezeranie, nie na porovnávanie: názov má miesto na tri
            riadky a údaje sú pod ním, nie v stĺpci. Preto tu nie sú hlavičky
            na triedenie — poradie sa nastavilo v tabuľke a nesie sa ďalej
            v adrese, len sa tu nedá meniť klikom na stĺpec, ktorý neexistuje.
          */
          <ul className="doc-cards">
            {paged.rows.map(r => (
              <li key={r.documentId} className="doc-card">
                <div className="doc-card-top">
                  <label className="bulk-pick">
                    <input type="checkbox" name="document" value={r.documentId} />
                    <span className="bulk-pick-text">{tl.pick(r.title)}</span>
                  </label>
                  <span className="stitok">{t.processing[r.processingState] ?? r.processingState}</span>
                  {r.hasDraft && r.status !== "published" && <span className="stitok">{t.draft}</span>}
                  {r.category && <span className="tichy doc-card-kind">{categoryLabel(r.category)}</span>}
                </div>

                <Link href={`/library/${encodeURIComponent(r.documentId)}`} className="doc-card-title">
                  {r.title}
                </Link>

                <div className="tichy doc-meta">
                  {r.folderTrail?.length ? `${r.folderTrail.join(" / ")} · ` : ""}
                  {r.documentId}
                </div>

                <div className="tichy doc-meta doc-card-foot">
                  {r.effectiveLabel}
                  {r.updatedAt && ` · ${formatDate(r.updatedAt, uiLanguage)}`}
                </div>
              </li>
            ))}
          </ul>
          ) : (
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>
                  <th scope="col" className="doc-col-pick">
                    <span className="bulk-pick-text">{tl.pickColumn}</span>
                  </th>
                  {([
                    ["title", t.colDocument],
                    ["category", t.category],
                    ["status", t.status],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <th key={key} scope="col" className={key === "title" ? "doc-col-title" : undefined}>
                      <Link href={toQuery(sortBy(filters, key))} className="doc-sort"
                            aria-label={t.sortBy(label)}>
                        {label}
                        <span className="doc-sort-mark" aria-hidden="true">
                          {sort.key === key ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                        </span>
                      </Link>
                    </th>
                  ))}
                  <th scope="col">{t.colVersion}</th>
                  <th scope="col" className="doc-col-right">
                    <Link href={toQuery(sortBy(filters, "updatedAt"))} className="doc-sort"
                          aria-label={t.sortBy(t.colChanged)}>
                      {t.colChanged}
                      <span className="doc-sort-mark" aria-hidden="true">
                        {sort.key === "updatedAt" ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                      </span>
                    </Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.rows.map(r => (
                  <tr key={r.documentId}>
                    <td className="doc-col-pick">
                      <label className="bulk-pick">
                        <input type="checkbox" name="document" value={r.documentId} />
                        <span className="bulk-pick-text">{tl.pick(r.title)}</span>
                      </label>
                    </td>
                    <td className="doc-col-title">
                      <Link href={`/library/${encodeURIComponent(r.documentId)}`} className="doc-title">
                        {r.title}
                      </Link>
                      {/* Identifikátor a cesta pod názvom, nie vo vlastnom
                          stĺpci: hľadá sa v nich len vtedy, keď názvy
                          nestačia, a dva stĺpce navyše by zúžili ten,
                          na ktorom záleží. */}
                      <div className="tichy doc-meta">
                        {r.folderTrail?.length ? `${r.folderTrail.join(" / ")} · ` : ""}
                        {r.documentId}
                        {r.originalFile && ` · ${r.originalFile.name} (${formatSize(r.originalFile.bytes)})`}
                      </div>
                    </td>
                    <td className="doc-cell-quiet">{r.category ? categoryLabel(r.category) : "—"}</td>
                    <td>
                      <span className="stitok">{t.processing[r.processingState] ?? r.processingState}</span>
                      {r.hasDraft && r.status !== "published" && <span className="stitok">{t.draft}</span>}
                    </td>
                    <td className="doc-cell-quiet">
                      {r.effectiveLabel}
                      {r.versionCount > 0 && <div className="tichy doc-meta">{t.versions(r.versionCount)}</div>}
                    </td>
                    <td className="doc-col-right doc-cell-quiet">
                      {r.updatedAt ? formatDate(r.updatedAt, uiLanguage) : "—"}
                      {r.updatedBy && <div className="tichy doc-meta">{r.updatedBy}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {/*
            Panel hromadných akcií.

            Je vidieť stále, nie až po označení: bez JavaScriptu sa server
            nedozvie, či je niečo zaškrtnuté, a panel, ktorý sa zjaví „až
            keď", by tu nefungoval. Prázdny výber preto rieši akcia hlásením,
            nie skrytým tlačidlom.

            „Vyžiadať potvrdenie" nič nezapisuje — odovzdá výber obrazovke
            `/hr/assign`, ktorá prideľovanie už vie: N noriem × M publík
            s jedným dôvodom, povinným (D30), a znenie bez platnosti odmietne
            (D6). Druhá kópia tých pravidiel tu by sa raz rozišla s prvou.
          */}
          <div className="bulk-bar">
            <span className="bulk-title">{tl.heading}</span>

            <div className="pole bulk-folder">
              <span className="pole-popis">{tl.moveTo}</span>
              <Select
                name="folderId"
                fieldLabel={tl.moveTo}
                options={[
                  { value: "", label: tf.unfiled },
                  ...tree.map(r => ({
                    value: r.folder.id,
                    label: `${"— ".repeat(r.level - 1)}${r.folder.name}`,
                  })),
                ]}
              />
            </div>

            <button className="tlacidlo tlacidlo--tiche" type="submit" formAction={moveManyAction}>
              {tl.move}
            </button>
            <button className="tlacidlo tlacidlo--tiche" type="submit" formAction={assignManyAction}>
              {tl.assign}
            </button>

            {/* Kam sa vrátiť — s filtrom, triedením aj stranou. */}
            <input type="hidden" name="back" value={toQuery(filters)} />
          </div>

          {/*
            Pätička je aj tam, kde je strana jediná — číslo „koľko z koľkých"
            je odpoveď na otázku, ktorú si človek kladie vždy, nielen keď sa
            stránkuje.
          */}
          <div className="doc-foot">
            <span className="tichy">{t.pageRange(paged.from, paged.to, rows.length)}</span>
            {paged.pages > 1 && (
              <span className="doc-pager">
                {paged.page > 1 && (
                  <Link className="doc-page" href={toQuery(withPage(filters, paged.page - 1))}>
                    {t.prevPage}
                  </Link>
                )}
                <span className="tichy">{t.pageOf(paged.page, paged.pages)}</span>
                {paged.page < paged.pages && (
                  <Link className="doc-page" href={toQuery(withPage(filters, paged.page + 1))}>
                    {t.nextPage}
                  </Link>
                )}
              </span>
            )}
          </div>
        </form>
      )}
        </div>
      </div>
    </div>
    </AppShell>
  )
}
