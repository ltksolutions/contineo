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
import { libraryList, libraryFacets, statusTagClass } from "@/lib/libraryRead"
import { allFolders, flattenTree, counts } from "@/lib/folders"
import { allDepartments } from "@/lib/departments"
import { documentsProgress } from "@/lib/libraryProgress"
import { codelistOptions } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import Select from "@/components/Select"
import LiveFilter from "@/components/LiveFilter"
import { moveManyAction, assignManyAction } from "./actions"
import AppShell from "@/components/AppShell"
import WaitingForApproval from "@/components/WaitingForApproval"
import { openRounds, documentTitles } from "@/lib/approvalsDb"
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
  togglePick, pickPage, clearPicked, pickedOutsideCount,
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
  const tfd = dictionary(uiLanguage).library.fields
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
    ownerDepartment: filters.ownerDepartment,
    conditions: filters.conditions,
    match: filters.match,
  }

  const [rows, folders, folderCounts, facets, waiting, departments] = await Promise.all([
    libraryList(ctx.tenant.companyCode, listFilter),
    allFolders(ctx.tenant.companyCode),
    counts(ctx.tenant.companyCode),
    libraryFacets(ctx.tenant.companyCode, listFilter),
    // Bežiace kolá schvaľovania. **Nefiltrujú sa filtrami zoznamu**: čo čaká
    // na rozhodnutie, čaká bez ohľadu na to, čo si človek práve odfiltroval —
    // a schovať to za filter by znamenalo, že si toho nikto nevšimne.
    openRounds(ctx.tenant.companyCode),
    // Strom oddelení sa načíta **raz**, kvôli názvom vo facete. V riadkoch
    // zoznamu je len identifikátor (D49) — dotaz na názov pri každom riadku
    // by bol sto dotazov na jedno vykreslenie.
    allDepartments(ctx.tenant.companyCode),
  ])
  const tree = flattenTree(folders)
  const waitingTitles = await documentTitles(
    ctx.tenant.companyCode,
    waiting.map(r => r.documentId),
  )

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
  /*
    V automatickom pohľade nie je zvýraznená voľba človeka, ale to, čo je
    práve vidieť — a to vie až prehliadač. Preto trieda, ktorú prepne tá istá
    medza ako zoznam; `aria-current` sa nedáva, lebo nikto nič nevybral.
  */
  const viewSwitchClass = (key: "table" | "cards") =>
    view === key ? " is-on" : view === "auto" ? ` view-switch-item--auto-${key}` : ""
  /*
   * Potvrdenia len pre **viditeľnú stranu**, teda až po stránkovaní a nie
   * v `Promise.all` vyššie. Počítať ich pre celý zoznam by znamenalo počítať
   * publiká aj pre riadky, ktoré nikto neuvidí; takto sú to tri dotazy na
   * najviac dvadsaťpäť riadkov, nech má knižnica dokumentov koľkokoľvek.
   */
  const progress = await documentsProgress(
    ctx.tenant.companyCode,
    paged.rows.map(r => r.effectiveVersionId).filter((v): v is string => Boolean(v)),
  )
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
   * Výber je v adrese, nie vo formulári, takže „označené na tejto strane“ sa
   * musí dopočítať: `filters.picked` nesie aj to, čo je na inej strane alebo
   * po zmene filtra už mimo zoznamu.
   */
  const pageIds = paged.rows.map(r => r.documentId)
  const isPicked = (id: string) => filters.picked.includes(id)
  const allPagePicked = pageIds.length > 0 && pageIds.every(isPicked)
  const pickedOutside = pickedOutsideCount(filters.picked, pageIds)

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
  const departmentNames = new Map(departments.map(o => [o.id, o.name]))
  /*
    Zmazané oddelenie ukáže identifikátor, nie prázdno. Dokument, ktorý naň
    ešte odkazuje, sa tak dá nájsť a opraviť — prázdny riadok vo filtri by
    znamenal, že o ňom nikto nevie.
  */
  const departmentLabel = (value: string) => departmentNames.get(value) ?? value
  const categoryLabel = labelFrom("category")
  const tagLabel = labelFrom("tags")
  const accessLabel = labelFrom("accessLevel")
  const statusLabel = (value: string) =>
    value === "published" ? t.statusPublished
    : value === "in-review" ? t.statusInReview
    : t.statusDrafts

  /* Text pilulky pri jednom dokumente — facetové „koncepty" je množné
     číslo a na riadku by klamalo počtom. */
  const statusPill = (value: string) =>
    value === "published" ? t.statusPublished
    : value === "in-review" ? t.statusInReview
    : t.draft

  const facetLabel: Record<MultiKey, { title: string; label: (v: string) => string }> = {
    category: { title: t.category, label: categoryLabel },
    status: { title: t.status, label: statusLabel },
    tag: { title: t.tag, label: tagLabel },
    accessLevel: { title: t.accessLevel, label: accessLabel },
    language: { title: t.status, label: (v) => v },
    ownerDepartment: { title: tfd.ownerDepartmentShort, label: departmentLabel },
  }

  /** Skupiny, ktoré sa v paneli vykresľujú ako zoznam s počtami. */
  const facetGroups: { key: MultiKey; rows: { value: string; count: number }[] }[] = [
    { key: "category", rows: facets.category },
    { key: "status", rows: facets.status },
    { key: "accessLevel", rows: facets.accessLevel },
    // Až za prístupom: je to nepovinné pole, takže pri väčšine organizácií
    // bude skupina prázdna a `facetGroups` ju vtedy nevykreslí vôbec.
    { key: "ownerDepartment", rows: facets.ownerDepartment },
  ]


  /*
   * Obsah panela filtrov (NASADENIE, PR 4) — **jedna definícia, dva tvary**:
   * na širokej obrazovke stĺpec vedľa zoznamu (`.library-folders`), pod
   * 1024 px zásuvka `<details class="filter-sheet">` pri poli hľadania.
   * Oba tvary sú v DOM naraz a prepína ich `@media` — rovnaký vzor ako
   * tabuľka ↔ karty nižšie: `display: none` skryje druhý aj pred čítačkou.
   *
   * Správa priečinkov tu už nie je — filtrovanie a správa sú dve úlohy.
   * Panel priečinok len **vyberá**; premenovanie, presun, poradie aj
   * zakladanie sú na `/library/folders` (odkaz pod stromom).
   */
  const filterPanel = (
    <>
      {/*
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
            <button className="button button--quiet facet-apply" type="submit">{t.apply}</button>
          </form>
        )}
      </div>

      <h2 className="field-label" style={{ margin: "0 0 8px" }}>{tf.heading}</h2>

      <ul className="tree">
        <li className="tree-item">
          <Link
            href={withFolder(undefined)}
            className={`tree-row${!folder ? " is-active" : ""}`}
          >
            <span className="tree-name">{tf.allDocuments}</span>
          </Link>
        </li>
        <li className="tree-item">
          <Link
            href={withFolder("nezaradene")}
            className={`tree-row${folder === "nezaradene" ? " is-active" : ""}`}
          >
            <span className="quiet tree-name">{tf.unfiled}</span>
          </Link>
        </li>
      </ul>

      {/* Fixné položky vyššie nie sú priečinky, ale pohľady na celý zoznam —
          preto stoja mimo stromu s čiarami. */}
      <ul className="tree tree--lines">
        {tree.map(({ folder: p, level: level }) => {
          const c = folderCounts.get(p.id) ?? { direct: 0, withDescendants: 0 }
          return (
            <li key={p.id} className="tree-item" style={{ "--level": level } as React.CSSProperties}>
              <Link
                href={withFolder(p.id)}
                className={`tree-row${folder === p.id ? " is-active" : ""}`}
              >
                <span className="tree-name">{p.name}</span>
                <span className="quiet tree-count">{c.withDescendants}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      <Link className="folders-manage" href="/library/folders">{tf.manage} →</Link>
    </>
  )

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

      {/*
        Nad zoznamom, nie v ňom: je to úloha, nie obsah knižnice. Názvy sa
        načítavajú zvlášť, nie z riadkov zoznamu — tie sú prefiltrované, takže
        dokument v kole medzi nimi byť nemusí a zostalo by po ňom `documentId`.
      */}
      <WaitingForApproval rounds={waiting} titles={waitingTitles} language={uiLanguage} />

      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 6px" }}>
        <h1 className="page-title" style={{ margin: 0 }}>{t.heading}</h1>
        {/* „N z M" hovorí, či je krátky zoznam výsledok filtra alebo stav
            knižnice. Bez toho čísla sa to nedá rozoznať. */}
        <span className="quiet library-count">{t.shown(facets.total, facets.all)}</span>

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
              className={`view-switch-item${viewSwitchClass(key)}`}
              aria-current={view === key ? "true" : undefined}
            >
              {label}
            </Link>
          ))}
        </span>
        <Link className="button" href="/library/new">{t.upload}</Link>
        {/*
          Export nesie **tie isté filtre**, aké sú na obrazovke — preto
          `toQuery(filters, …)` a nie holá adresa. Kto si vyfiltruje osem
          dokumentov, má dostať osem, nie stoštyridsaťosem.
        */}
        <Link className="button button--quiet" href={toQuery(filters, "/library/csv")}>
          {t.exportCsv}
        </Link>
        {/*
          Zvyšné akcie v ponuke „⋯" (NASADENIE, PR 4). Primárna akcia je
          jedna — nahrať dokument; šesť tlačidiel vedľa seba sa na telefóne
          lámalo do troch riadkov a všetky vyzerali rovnako dôležité.
          `<details>`, takže bez JavaScriptu; vzor ako „Viac" v navigácii.
        */}
        <details className="page-more">
          <summary className="button button--quiet page-more-toggle" aria-label={t.moreActions}>⋯</summary>
          <div className="page-more-menu">
            <Link className="page-more-item" href="/library/tracks">
              {dictionary(uiLanguage).library.tracks.heading}
            </Link>
            {/* Kurácia: overené odpovede pripravené hodnotiteľom (D11). */}
            <Link className="page-more-item" href="/library/curation">
              {dictionary(uiLanguage).curation.open}
            </Link>
          </div>
        </details>
      </div>
      <p className="quiet page-lead" style={{ margin: "0 0 20px" }}>
        {t.introBefore}<strong>{t.introHighlight}</strong>{t.introAfter}
      </p>


      <div className="library-grid">
        <aside className="library-folders">
          {filterPanel}
        </aside>

        <div className="library-list" id="results">

      {/*
        Lišta nástrojov zoznamu (vzor, PR 7): pole hľadania, chips aktívnych
        filtrov a „+ Podmienka" v jednom riadku **v stĺpci zoznamu**, nie cez
        celú šírku nad mriežkou — filtre vľavo, všetko o zozname pri zozname.

        Hľadanie zostáva formulárom (`method="get"`), nie odkazom: text sa
        píše a odošle, nie vyberá. Skryté polia nesú zvyšok pohľadu — bez nich
        by odoslanie hľadania zrušilo facety, priečinok aj variant navigácie.
      */}
      <div className="library-toolbar">
        <LiveFilter className="library-search" action="/library" label={t.search}>
          {/* Bez viditeľného labelu (vzor) — meno poľa nesie `aria-label`
              a placeholder; lišta má byť jeden riadok. */}
          <input
            className="field-input library-search-input"
            name="search"
            defaultValue={search ?? ""}
            placeholder={t.searchPlaceholder}
            aria-label={t.search}
          />
          {carried
            .filter(([k]) => k !== "search")
            .map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
          <button className="button button--quiet" type="submit">{t.filter}</button>
        </LiveFilter>

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
          Zásuvka filtrov pod 1024 px (NASADENIE, PR 4): ten istý obsah ako
          stĺpec, iný tvar — facety ako pilulky, dole „Zobraziť N dokumentov".
          `<details>`, takže bez JavaScriptu: každý facet je odkaz, stránka
          sa ním načíta znova a zásuvka sa tým zavrie; hlavné tlačidlo je
          odkaz na výsledky. Na širokej obrazovke ju CSS skryje — tam je
          panel stĺpec vedľa zoznamu.
        */}
        <details className="filter-sheet">
          <summary className="button button--quiet filter-sheet-toggle">
            {t.filters}
            {activeChips(filters).length > 0 && (
              <span className="builder-count">{activeChips(filters).length}</span>
            )}
          </summary>
          <div className="filter-sheet-body">
            {filterPanel}
            <Link className="button filter-sheet-apply" href={toQuery(filters) + "#results"}>
              {t.showResults(facets.total)}
            </Link>
          </div>
        </details>
      </div>


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
          <div className="field">
            <span className="field-label">{tb.field}</span>
            <Select name="add" options={fieldOps} initial={fieldOps[0]?.value} fieldLabel={tb.field} />
          </div>
          <label className="field builder-value">
            <span className="field-label">{tb.value}</span>
            <input className="field-input" name="value" required />
          </label>
          {carried.map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
          {/* Dve tlačidlá jedného formulára, nie prepínač vedľa neho: spojka
              je vlastnosť tohto pridania a takto sa vyberá tým istým klikom,
              ktorým sa podmienka pridáva. Pri prvej podmienke sa spojka nemá
              čoho chytiť, preto je vtedy len jedno. */}
          <button className="button button--quiet" type="submit" name="join" value="and">
            {conditions.length === 0 ? tb.add : tb.addAnd}
          </button>
          {conditions.length > 0 && (
            <button className="button button--quiet" type="submit" name="join" value="or">
              {tb.addOr}
            </button>
          )}
        </form>

        <p className="quiet builder-hint">{tb.hint}</p>
      </details>


      {rows.length === 0 ? (
        <p className="card" style={{ padding: 20, fontSize: "var(--fs-lead)" }}>
          {search ? t.nothingFound : t.empty}
        </p>
      ) : (
        /*
          Výber riadkov je **v adrese**, nie stav formulára. Zaškrtávacie
          políčko bez JavaScriptu neprežije prechod na druhú stranu — odošle
          sa až akciou, takže dovtedy o ňom server nevie. Odkaz áno: klik na
          riadok prepíše adresu a označenie sa odvtedy nesie v každom ďalšom
          odkaze (`carryFields`), teda aj cez stránkovanie a zmenu filtra.

          Cena je viditeľnosť: označený dokument môže po zúžení filtra
          z obrazovky zmiznúť a zostať vybraný. Preto sa nad zoznamom píše,
          koľko z označených nie je vidieť, a vedľa je odkaz na zrušenie —
          tichý výber, ktorý sa vlečie naprieč filtrami, je pri hromadnom
          presune drahé prekvapenie.
        */
        <form className="bulk-form">
          {/*
            Výber ide do akcie skrytými poľami, nie políčkami v riadkoch:
            `moveManyAction` a `assignManyAction` čítajú `document` z formulára
            a bez tohto by po zrušení políčok dostali prázdny zoznam. Zároveň
            sa tým do akcie dostane aj to, čo je označené na inej strane.
          */}
          {filters.picked.map(id => (
            <input key={id} type="hidden" name="document" value={id} />
          ))}

          {/*
            Pás hromadných akcií — **nad zoznamom a vo farbe akcentu** (vzor,
            PR 7): „Označené: N", presun, vyžiadanie potvrdenia a zrušenie
            výberu na jednom mieste. Kreslí sa len pri výbere — výber je
            v adrese, takže server to vie. Na telefóne pás prekryje spodnú
            lištu navigácie (viď CSS): kto vyberá, je uprostred úlohy.

            „Vyžiadať potvrdenie" nič nezapisuje — odovzdá výber obrazovke
            `/hr/assign`, ktorá prideľovanie už vie (D30, D6). Druhá kópia
            tých pravidiel tu by sa raz rozišla s prvou.
          */}
          {filters.picked.length > 0 && (
          <div className="bulk-bar">
            <span className="bulk-title">{tl.picked(filters.picked.length)}</span>
            {pickedOutside > 0 && (
              <span className="bulk-picked-outside">{tl.pickedOutside(pickedOutside)}</span>
            )}

            <div className="field bulk-folder">
              <span className="field-label">{tl.moveTo}</span>
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

            <button className="button button--quiet" type="submit" formAction={moveManyAction}>
              {tl.move}
            </button>
            <button className="button button--quiet" type="submit" formAction={assignManyAction}>
              {tl.assign}
            </button>
            <Link className="bulk-clear" href={toQuery(clearPicked(filters))}>
              {tl.clearPicked}
            </Link>

            {/* Kam sa vrátiť — s filtrom, triedením aj stranou; po akcii je
                výber minutý, vraciame sa bez neho. */}
            <input type="hidden" name="back" value={toQuery(clearPicked(filters))} />
          </div>
          )}
          {/*
            Tabuľka, nie karty: v knižnici sa dokumenty **porovnávajú** —
            ktoré znenie platí, čo sa kedy zmenilo. Na to musia byť tie isté
            údaje pod sebou v stĺpci, nie rozsypané v každej karte inak.
            Na telefóne to ale neplatí: tabuľka je široká 1160 px a v 340 px
            obale z nej vidno názov dokumentu a nič viac — stav, platnosť ani
            potvrdenia už nie. Preto sa v automatickom pohľade vykreslia oba
            zoznamy a vyberá medzi nimi CSS. Vykresliť oba je lacnejšie než
            hádať šírku na serveri alebo ju dopĺňať skriptom, a `display: none`
            ten druhý skryje aj pred čítačkou, takže sa neprečíta dvakrát.

            Obal roluje vodorovne a tabuľka má `min-width`: stĺpce sa nesmú
            stlačiť tak, že sa dátum zalomí do troch riadkov. Na telefóne je
            posun prstom čitateľnejší než rozbitá mriežka.
          */}
          {view !== "table" && (
          /*
            Karty sú na prezeranie, nie na porovnávanie: názov má miesto na tri
            riadky a údaje sú pod ním, nie v stĺpci. Preto tu nie sú hlavičky
            na triedenie — poradie sa nastavilo v tabuľke a nesie sa ďalej
            v adrese, len sa tu nedá meniť klikom na stĺpec, ktorý neexistuje.
          */
          <ul className={`doc-cards${view === "auto" ? " doc-view-auto" : ""}`}>
            {paged.rows.map(r => (
              <li key={r.documentId} className="doc-card">
                <div className="doc-card-top">
                  <Link
                    href={toQuery(togglePick(filters, r.documentId))}
                    className={`bulk-pick${isPicked(r.documentId) ? " is-on" : ""}`}
                    aria-pressed={isPicked(r.documentId)}
                  >
                    <span className="bulk-pick-box" aria-hidden="true">{isPicked(r.documentId) ? "✓" : ""}</span>
                    <span className="bulk-pick-text">{tl.pick(r.title)}</span>
                  </Link>
                  <span className={statusTagClass(r.status)}>{statusPill(r.status)}</span>
                      {/* Technický stav spracovania len keď niečo hovorí —
                          „vo vyhľadávaní" je normálny koniec a pri každom
                          riadku by bol šum; zlyhanie je jediné červené.
                          Pilulka „koncept" splynula so stavovou. */}
                      {r.processingState !== "indexed" && (
                        <span className={r.processingState === "failed" ? "tag tag--expired" : "tag"}>
                          {t.processing[r.processingState] ?? r.processingState}
                        </span>
                      )}
                  {r.category && <span className="quiet doc-card-kind">{categoryLabel(r.category)}</span>}
                </div>

                <Link href={`/library/${encodeURIComponent(r.documentId)}`} className="doc-card-title">
                  {r.title}
                </Link>

                <div className="quiet doc-meta">
                  {r.internalNumber && `${r.internalNumber} · `}
                  {r.folderTrail?.length ? `${r.folderTrail.join(" / ")} · ` : ""}
                  {r.documentId}
                </div>

                <div className="quiet doc-meta doc-card-foot">
                  {r.effectiveLabel}
                  {r.effectiveTo && ` · ${t.colEffectiveTo} ${formatDate(r.effectiveTo, uiLanguage)}`}
                  {(() => {
                    const p = r.effectiveVersionId ? progress.get(r.effectiveVersionId) : undefined
                    return p && p.percent !== null
                      ? ` · ${p.percent} % (${t.acknowledgedOf(p.acknowledged, p.assigned)})`
                      : ""
                  })()}
                  {r.updatedAt && ` · ${formatDate(r.updatedAt, uiLanguage)}`}
                </div>
              </li>
            ))}
          </ul>
          )}

          {view !== "cards" && (
          <div className={`doc-table-wrap${view === "auto" ? " doc-view-auto" : ""}`}>
            <table className="doc-table">
              <thead>
                <tr>
                  <th scope="col" className="doc-col-pick">
                    {/* Označí alebo odznačí **túto stranu**, nie celý výsledok:
                        „označiť všetkých 148" je iná akcia s iným následkom
                        a mýliť si ich pri hromadnom presune je drahé. */}
                    <Link
                      href={toQuery(pickPage(filters, pageIds, !allPagePicked))}
                      className={`bulk-pick${allPagePicked ? " is-on" : ""}`}
                      aria-pressed={allPagePicked}
                    >
                      <span className="bulk-pick-box" aria-hidden="true">{allPagePicked ? "✓" : ""}</span>
                      <span className="bulk-pick-text">{tl.pickColumn}</span>
                    </Link>
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
                  <th scope="col" className="doc-col-date">{t.colEffectiveFrom}</th>
                  <th scope="col" className="doc-col-date">{t.colEffectiveTo}</th>
                  <th scope="col">{t.colAcknowledged}</th>
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
                      <Link
                        href={toQuery(togglePick(filters, r.documentId))}
                        className={`bulk-pick${isPicked(r.documentId) ? " is-on" : ""}`}
                        aria-pressed={isPicked(r.documentId)}
                      >
                        <span className="bulk-pick-box" aria-hidden="true">{isPicked(r.documentId) ? "✓" : ""}</span>
                        <span className="bulk-pick-text">{tl.pick(r.title)}</span>
                      </Link>
                    </td>
                    <td className="doc-col-title">
                      <Link href={`/library/${encodeURIComponent(r.documentId)}`} className="doc-title">
                        {r.title}
                      </Link>
                      {/* Identifikátor a cesta pod názvom, nie vo vlastnom
                          stĺpci: hľadá sa v nich len vtedy, keď názvy
                          nestačia, a dva stĺpce navyše by zúžili ten,
                          na ktorom záleží. */}
                      {/*
                          Interné číslo je **prvé** v riadku pod názvom, nie
                          vo vlastnom stĺpci: je to označenie dokumentu, patrí
                          teda k identifikátoru, a ôsmy stĺpec by tabuľku na
                          telefóne rozšíril kvôli údaju, ktorý väčšina
                          dokumentov nemá.
                      */}
                      <div className="quiet doc-meta">
                        {r.internalNumber && `${r.internalNumber} · `}
                        {r.folderTrail?.length ? `${r.folderTrail.join(" / ")} · ` : ""}
                        {r.documentId}
                        {r.originalFile && ` · ${r.originalFile.name} (${formatSize(r.originalFile.bytes)})`}
                      </div>
                    </td>
                    <td className="doc-cell-quiet">{r.category ? categoryLabel(r.category) : "—"}</td>
                    <td>
                      {/* Farba nesie stav (KNIZNICA.md, úloha 1). */}
                      <span className={statusTagClass(r.status)}>{statusPill(r.status)}</span>
                      {/* Technický stav spracovania len keď niečo hovorí —
                          „vo vyhľadávaní" je normálny koniec a pri každom
                          riadku by bol šum; zlyhanie je jediné červené.
                          Pilulka „koncept" splynula so stavovou. */}
                      {r.processingState !== "indexed" && (
                        <span className={r.processingState === "failed" ? "tag tag--expired" : "tag"}>
                          {t.processing[r.processingState] ?? r.processingState}
                        </span>
                      )}
                    </td>
                    <td className="doc-cell-quiet">
                      {r.effectiveLabel}
                      {r.versionCount > 0 && <div className="quiet doc-meta">{t.versions(r.versionCount)}</div>}
                    </td>
                    {/*
                      Pomlčka, nie prázdna bunka: prázdne miesto v tabuľke vyzerá
                      ako chýbajúci údaj, pomlčka hovorí, že dokument práve
                      **nemá platné znenie** — čo je stav, nie porucha.
                    */}
                    <td className="doc-cell-quiet doc-col-date">
                      {r.effectiveFrom ? formatDate(r.effectiveFrom, uiLanguage) : "—"}
                    </td>
                    {/*
                      Prázdne „platné do" znamená **do odvolania**, nie chýbajúci
                      údaj — preto tá istá pomlčka ako pri „platná od" a nie
                      prázdna bunka.
                    */}
                    <td className="doc-cell-quiet doc-col-date">
                      {r.effectiveTo ? formatDate(r.effectiveTo, uiLanguage) : "—"}
                    </td>
                    {/*
                      Percento **nikdy samo** (O6/7): pod ním je menovateľ.
                      „100 %" pri dokumente pridelenom trom ľuďom a „100 %" pri
                      dokumente pridelenom štyristo ľuďom sú dve rôzne správy
                      a bez menovateľa vyzerajú rovnako.

                      Pomlčka znamená „nikomu nepridelené", nie „nikto
                      nepotvrdil" — to sú dve rôzne veci a nula by z prvého
                      spravila druhé.
                    */}
                    <td className="doc-cell-quiet">
                      {(() => {
                        const p = r.effectiveVersionId ? progress.get(r.effectiveVersionId) : undefined
                        if (!p || p.percent === null) return "—"
                        return (
                          <>
                            {p.percent} %
                            <div className="quiet doc-meta">
                              {t.acknowledgedOf(p.acknowledged, p.assigned)}
                            </div>
                          </>
                        )
                      })()}
                    </td>
                    <td className="doc-col-right doc-cell-quiet">
                      {r.updatedAt ? formatDate(r.updatedAt, uiLanguage) : "—"}
                      {r.updatedBy && <div className="quiet doc-meta">{r.updatedBy}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}


          {/*
            Pätička je aj tam, kde je strana jediná — číslo „koľko z koľkých"
            je odpoveď na otázku, ktorú si človek kladie vždy, nielen keď sa
            stránkuje.
          */}
          <div className="doc-foot">
            <span className="quiet">{t.pageRange(paged.from, paged.to, rows.length)}</span>
            {paged.pages > 1 && (
              <span className="doc-pager">
                {paged.page > 1 && (
                  <Link className="doc-page" href={toQuery(withPage(filters, paged.page - 1))}>
                    {t.prevPage}
                  </Link>
                )}
                <span className="quiet">{t.pageOf(paged.page, paged.pages)}</span>
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
