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
import { libraryList, libraryFacets, statusTagClass, displayStatus } from "@/lib/libraryRead"
import { allFolders, flattenTree, counts } from "@/lib/folders"
import { allDepartments } from "@/lib/departments"
import { documentsProgress } from "@/lib/libraryProgress"
import { codelistOptions } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import Select from "@/components/Select"
import AckBar from "@/components/AckBar"
import LiveFilter from "@/components/LiveFilter"
import Icon from "@/components/Icon"
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
  togglePick, pickPage, clearPicked, pickedOutsideCount, MAX_PICKED,
  type MultiKey, type SortKey,
} from "@/lib/libraryFilters"
import {
  OPS_FOR_FIELD, CONDITION_FIELDS, decodeCondition, describeConditions,
  normalizeGroups, startsGroup,
  type ConditionField, type ConditionOp,
} from "@/lib/libraryConditions"
import MultiSelect from "@/components/MultiSelect"

export const dynamic = "force-dynamic"

/*
 * Vlastný názov karty prehliadača. Dovtedy niesli všetky stránky jeden názov
 * z `layout.tsx` a podľa záložky sa nedalo rozoznať, ktorá je ktorá.
 *
 * Nadpis na obrazovke je krátky („Knižnica", rámy 1–8), tu je dlhý: karta
 * nie je hlavička stránky a pri viacerých otvorených záložkách je samotné
 * „Knižnica" málo.
 *
 * Jazyk osoby tu ešte nepoznáme — metadáta sa skladajú skôr, než je jasné,
 * kto sa pozerá — preto predvolený slovník, rovnako ako v `layout.tsx`.
 */
export const metadata = { title: dictionary(undefined).library.list.metaTitle }

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

  /*
   * Zoznam priečinkov pre presun — **jeden na dve miesta**. Od 640 px stojí
   * výber v páse, pod ním v zásuvke; dve kópie toho istého poľa by sa raz
   * rozišli v odsadení úrovní.
   */
  const folderOptions = [
    { value: "", label: tf.unfiled },
    ...tree.map(r => ({
      value: r.folder.id,
      label: `${"— ".repeat(r.level - 1)}${r.folder.name}`,
    })),
  ]
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

  /*
   * Mená filtrov, ktoré sú práve nasadené — pre prázdny stav.
   *
   * Vymenúvajú sa tie, ktoré sa **dajú pomenovať**: facety, hľadanie
   * a priečinok. Podmienky buildera medzi nimi nie sú — tie sú vypísané
   * hneď nad zoznamom vo vlastnom paneli, takže ich opakovať by bolo
   * dvakrát to isté a veta by narástla cez tri riadky.
   */
  const activeNames = [
    ...activeChips(filters).map(
      ({ key, value }) => `${facetLabel[key].title}: ${facetLabel[key].label(value)}`,
    ),
    ...(search ? [`${t.search}: ${search}`] : []),
    ...(folder ? [`${tf.heading}: ${folder === "nezaradene" ? tf.unfiled : (tree.find(x => x.folder.id === folder)?.folder.name ?? folder)}`] : []),
  ]

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
  /*
   * Názvy hodnôt facetu — **tie isté ako pri pilulke** (`KNIZNICA.html`,
   * rám 1): Platný · Návrh · Na schválenie.
   *
   * Do 23. 9. 2026 tu boli vlastné reťazce v množnom čísle („publikované",
   * „koncepty"). Boli to dva slovníky o tom istom a na jednej obrazovke
   * vedľa seba: riadok hovoril „Platný", panel „publikované". Množné číslo
   * dávalo zmysel, kým v paneli stálo za číslom — ale pilulka aj facet
   * pomenúvajú ten istý stav a majú ho volať rovnako.
   */
  const statusLabel = (value: string) =>
    value === "published" ? t.statusLabel.published
    : value === "in-review" ? t.statusLabel.review
    : value === "expired" ? t.statusLabel.expired
    : t.statusLabel.draft

  /** Pilulka riadku: farba aj názov z toho istého odvodeného stavu. */
  const statusTag = (row: { status: string; effectiveTo?: Date | string | null }) => {
    const stav = displayStatus(row.status, row.effectiveTo)
    return <span className={statusTagClass(stav)}>{statusLabel(stav)}</span>
  }

  /*
   * Potvrdenia ako pásik (KNIZNICA.md, úloha 2): stĺpec sa skenuje očami
   * zhora dolu — osem čísel v texte sa neskenuje, osem pásikov áno.
   * Tvar aj prahy má `<AckBar>` — ten istý, čo kreslí `/hr` (HR.md, úloha 2).
   * Bez záznamu o priebehu je to pomlčka: nie je čo potvrdzovať.
   */
  const ackBar = (versionId?: string) => {
    const p = versionId ? progress.get(versionId) : undefined
    if (!p) return <span className="quiet">—</span>
    return (
      <AckBar
        acknowledged={p.acknowledged}
        assigned={p.assigned}
        label={t.acknowledgedOf(p.acknowledged, p.assigned)}
      />
    )
  }

  const facetLabel: Record<MultiKey, { title: string; label: (v: string) => string }> = {
    category: { title: t.category, label: categoryLabel },
    status: { title: t.status, label: statusLabel },
    tag: { title: t.tag, label: tagLabel },
    accessLevel: { title: t.accessLevel, label: accessLabel },
    language: { title: t.language, label: (v) => v },
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
        {/*
          Panel nemá viditeľný nadpis (`KNIZNICA.html`, rám 1) — začína rovno
          skupinou Priečinky. Nadpis „Filtre" nad štyrmi pomenovanými
          skupinami hovoril to, čo je aj tak vidieť, a bral riadok.

          Pre čítačku ale sekcia meno mať musí, inak je to blok odkazov
          bez kontextu. Preto zostáva skrytý — `.sr-only`, nie `display: none`.

          Zrušenie filtrov je vlastný riadok a kreslí sa len vtedy, keď je
          čo rušiť; inak panel naozaj začína prvou skupinou.
        */}
        <h2 className="sr-only">{t.filtersTitle}</h2>
        {hasFilter && (
          <div className="facets-head">
            <Link className="facets-clear" href={toQuery(clearFilters(filters))}>{t.clearFilters}</Link>
          </div>
        )}

        {/*
          Priečinky sú **prvá skupina panela** (`KNIZNICA.html`, rám 1).
          Je to ten filter, ktorý ľudia používajú najčastejšie a ako prvý —
          hľadá sa „kde to leží", nie „akého je to druhu".

          Všetky skupiny majú jeden štýl nadpisu (`.lf-title`). Dovtedy tu
          boli tri (`.facets-title`, `.facet-group-title`, `.field-label`)
          a hovorili, že ide o tri rôzne druhy vecí. Sú to filtre.
        */}
        <div className="facet-group facet-group--folders">
          {/*
            Nadpis nesie aj odkaz na správu (`KNIZNICA.html`, rám 1): je to
            jedna vec o priečinkoch, nie dve. Dovtedy stál odkaz až pod
            stromom, oddelený čiarou — vyzeral ako pätička celého panela,
            hoci patrí k tejto skupine.
          */}
          <h3 className="lf-title">
            {tf.heading}
            <Link className="lf-manage" href="/library/folders">{tf.manage} →</Link>
          </h3>

          {/*
            Riadky priečinkov **nie sú strom s čiarami, ale zoznam ako facety**
            (rám 1). Zanorenie nesie odsadenie zľava, nič iné — v paneli
            širokom 250 px sa čiary aj tak zlievajú a berú miesto názvu.

            Checkbox tu nie je zámerne: priečinok je **jedna voľba**, nie
            viacnásobná ako druh či stav. Zaškrtávacie políčko by sľubovalo
            výber viacerých naraz.
          */}
          <Link
            href={withFolder(undefined)}
            className={`lf-folder${!folder ? " is-on" : ""}`}
          >
            <span>{tf.allDocuments}</span>
            <span>{facets.all}</span>
          </Link>

          {/*
            „Nezaradené" v ráme nie je — v mocku bol každý dokument zaradený.
            V ostrých dátach je to jediná cesta k dokumentom mimo priečinkov
            a pri nahratí tam padne každý nový, takže zostáva.
          */}
          <Link
            href={withFolder("nezaradene")}
            className={`lf-folder${folder === "nezaradene" ? " is-on" : ""}`}
          >
            <span className="quiet">{tf.unfiled}</span>
          </Link>

          {tree.map(({ folder: p, level: level }) => {
            const c = folderCounts.get(p.id) ?? { direct: 0, withDescendants: 0 }
            return (
              <Link
                key={p.id}
                href={withFolder(p.id)}
                className={`lf-folder${folder === p.id ? " is-on" : ""}`}
                style={{ paddingLeft: 6 + (level - 1) * 16 }}
              >
                <span>{p.name}</span>
                <span>{c.withDescendants}</span>
              </Link>
            )
          })}
        </div>

        {facetGroups.map(group => group.rows.length === 0 ? null : (
          <div className="facet-group" key={group.key}>
            <h3 className="lf-title">{facetLabel[group.key].title}</h3>
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

    </>
  )

  /*
    Prázdna knižnica je **iná stránka**, nie zoznam s nulou riadkov
    (`KNIZNICA.html`, rám 7): zostane nadpis, počet, „Nahrať dokument",
    ponuka „⋯" a prázdny stav. Panel priečinkov, hľadanie, prepínač pohľadu,
    zásuvka filtrov, staviteľ podmienok aj Export CSV odchádzajú.

    Dôvod je vecný, nie vzhľadový: pri nule dokumentov niet čo filtrovať,
    niet medzi čím hľadať, každý facet je nula a export dá prázdny súbor.
    Všetko to sľubuje prácu, ktorá nikam nevedie.

    Ponuka „⋯" zostáva zámerne, proti rámu (rozhodnutie Jána, 23. 9. 2026):
    vedie na Trasy onboardingu a Kuráciu, čo nie sú obsah knižnice — bez nej
    by sa z prázdnej knižnice nedali dosiahnuť vôbec.

    `facets.all` je počet **bez filtrov**, takže nula znamená prázdnu
    knižnicu, nie prísny filter.
  */
  const emptyLibrary = facets.all === 0

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
    // `wide`: knižnica je jediná obrazovka s bočným panelom **aj**
    // deväťstĺpcovou tabuľkou — do 1240 px sa nezmestí (namerané:
    // pri 1440 px okna má stĺpec zoznamu 938 px, tabuľka potrebuje ~1060).
    <AppShell layout={normalizeLayout(q.layout)} language={uiLanguage} wide>
    <div style={tenantStyle(branding)}>
      <Notice message={message} error={error === "1"} back="/library" />

      {/*
        Nad zoznamom, nie v ňom: je to úloha, nie obsah knižnice. Názvy sa
        načítavajú zvlášť, nie z riadkov zoznamu — tie sú prefiltrované, takže
        dokument v kole medzi nimi byť nemusí a zostalo by po ňom `documentId`.
      */}
      <WaitingForApproval rounds={waiting} titles={waitingTitles} language={uiLanguage} />

      {/*
        Hlavička stránky je `.page-head` ako inde v portáli, nie vlastné
        inline štýly — boli to tie isté hodnoty, len opísané druhýkrát.

        Medzera (`.page-head-spacer`) tlačí akcie k pravému okraju, ako v
        `KNIZNICA.html` (rámy 1 a 8). Je to prvok, nie `margin-left: auto`
        na prepínači pohľadu: pod 640 px je prepínač skrytý a odsadenie by
        s ním zmizlo, hoci rám 4 má akcie vpravo aj na telefóne.
      */}
      <div className="page-head">
        <h1 className="page-title" style={{ margin: 0 }}>{t.heading}</h1>
        {/* „N z M" hovorí, či je krátky zoznam výsledok filtra alebo stav
            knižnice. Bez toho čísla sa to nedá rozoznať. */}
        <span className="quiet library-count">{t.shown(facets.total, facets.all)}</span>

        <span className="page-head-spacer" aria-hidden="true" />

        {/*
          Prepínač pohľadu. Sú to dva odkazy, nie tlačidlá s JavaScriptom:
          pohľad je súčasť adresy, takže sa dá poslať aj s ním — a funguje bez
          skriptu. Aktívny odkaz zostáva odkazom (vedie sám na seba), lebo
          `aria-current` povie čítačke to isté a nemusí sa riešiť dvojaký tvar.

          Pri prázdnej knižnici prepínač nie je (rám 7): tabuľka aj karty by
          ukázali to isté prázdno.
        */}
        {!emptyLibrary && (
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
        )}
        {/*
          Poradie akcií je z rámu 1: tiché akcie (Export CSV, ⋯) obklopujú
          primárnu (Nahrať dokument), nie naopak. Primárna akcia takto nie je
          prvá v rade zľava, ale je jediná plná — to ju odlíši.

          Export nesie **tie isté filtre**, aké sú na obrazovke — preto
          `toQuery(filters, …)` a nie holá adresa. Kto si vyfiltruje osem
          dokumentov, má dostať osem, nie stoštyridsaťosem.
        */}
        {!emptyLibrary && (
        <Link className="button button--quiet" href={toQuery(filters, "/library/csv")}>
          {t.exportCsv}
        </Link>
        )}
        <Link className="button" href="/library/new">{t.upload}</Link>
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


      {emptyLibrary ? (
        /* Rám 7: prázdna knižnica je nadpis a prázdny stav, nič viac. */
        <div className="empty">
          <div className="empty-title">{t.empty}</div>
          <div className="empty-text">{t.emptyText}</div>
          <div className="empty-action">
            <Link className="button" href="/library/new">{t.upload}</Link>
          </div>
        </div>
      ) : (
      <div className="library-grid">
        {/*
          Panel je **karta** (`KNIZNICA.html`, rámy 1 a 8): plocha `--surface`,
          rám `--line`, rádius 12. Dovtedy bol priehľadný, takže priečinky
          a facety splývali s pozadím stránky a stĺpec vľavo nemal okraj —
          vyzeral ako text nalepený vedľa tabuľky, nie ako panel.

          Výplň 14 px si drží `.library-folders`; `.card` má 18/20 px, čo je
          na 250 px široký stĺpec veľa.
        */}
        <aside className="card library-folders">
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
          {/* Lupa (`ZAKLAD.md`, odchýlka B v znení z 22. 9. 2026): toto pole
              hľadá reťazec v zozname dokumentov, nepýta sa modelu — lupa je
              tu vecne správna. Bublina `ask` patrí poľu v hlavičke. Dovtedy
              tu bola značka; pri 16 px z nej aj tak vyšla lupa, len horšie
              čitateľná. Nie je interaktívna, prstenec nemá. */}
          <span className="library-search-mark" aria-hidden="true">
            <Icon name="search" size={16} />
          </span>
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
            {/*
              Zásuvka má **vlastnú hlavičku a držadlo** (`KNIZNICA.html`,
              rám 5). V stĺpci panel nadpis nepotrebuje — je vidieť, že je to
              bočný panel. Zásuvka vyskočí cez obsah a bez nadpisu nie je
              jasné, čo to vyskočilo; držadlo navyše hovorí, že sa to dá
              stiahnuť dole.

              „Zrušiť všetky" je tu hore, nie dole pri tlačidle: keď človek
              otvorí zásuvku a vidí, že filtre nič nenašli, chce ich zrušiť
              hneď, nie po prerolovaní všetkých skupín.
            */}
            <div className="sheet-grip" aria-hidden="true" />
            <div className="sheet-h">
              <strong>{t.filters}</strong>
              {hasFilter && (
                <Link className="sheet-clear" href={toQuery(clearFilters(filters))}>
                  {t.clearFilters}
                </Link>
              )}
            </div>
            {filterPanel}
            <Link className="button filter-sheet-apply" href={toQuery(filters) + "#results"}>
              {t.showResults(facets.total)}
            </Link>
          </div>
        </details>

      {/*
        Query builder — **v lište nástrojov, nie kartou pod ňou**
        (`docs/design/README.md`, „Panel hľadania + query builder").

        Bez nasadenej podmienky je to jeden ovládač „+ Podmienka" v riadku
        hľadania; až rozbalený dostane panel. Dovtedy stál ako samostatná
        karta s prerušovaným rámikom a tvrdil, že je vlastným nástrojím —
        pritom je to druhá polovica hľadania. Obe polovice vznikli
        s odstupom (builder 8. 9., lišta 21. 9.) a nikto ich nespojil.

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
            {/*
              Veta je vidieť vždy, nie až po výbere „Platné do po".
              Bez JavaScriptu sa na zmenu výberu zareagovať nedá, a keby
              chýbala celkom, vyzeralo by to ako chyba v zozname: dokument
              s neobmedzenou platnosťou má koniec platnosti prázdny, takže
              otázke na koniec platnosti nevyhovie.
            */}
            <span className="quiet field-hint">{tb.fieldNote}</span>
          </div>
          <label className="field builder-value">
            <span className="field-label">{tb.value}</span>
            {/*
              `<datalist>` ponúkne „dnes" pri dátumových poliach a je to
              nápoveda, nie obmedzenie — do poľa sa ďalej dá napísať dátum.
              Prehliadač bez podpory ju ignoruje a pole zostane obyčajné,
              takže to funguje aj bez skriptu.

              Napísané slovo sa uloží ako **token**, nie ako dnešný dátum
              (`normalizeDateValue`): odkaz poslaný dnes má o týždeň stále
              znamenať „dnes", nie ten dávny deň.
            */}
            <input className="field-input" name="value" list="builder-hodnoty" required />
            <datalist id="builder-hodnoty">
              <option value={tb.today} />
            </datalist>
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
      </div>




      {rows.length === 0 ? (
        /*
          Sem sa dostane len prázdno **z filtra** — prázdnu knižnicu rieši
          `emptyLibrary` vyššie, na úrovni celej stránky.

          Rozdiel je v tom, čo má človek spraviť: prázdna knižnica chce
          nahrať prvý dokument, prázdny filter chce filter zrušiť. Dovtedy
          sa pri nule vždy písalo „Začni nahratím prvého dokumentu", hoci
          podmienka pozerala len na text hľadania — pri 148 dokumentoch
          a zapnutom filtri to posielalo človeka robiť niečo, čo nepotrebuje.
        */
          <div className="empty">
            <div className="empty-title">{t.emptyFilteredTitle}</div>
            <div className="empty-text">
              {/*
                Filtre sa **vymenujú**, nie zhrnú do „skúste iné filtre".
                Človek nevidí panel (na telefóne je v zásuvke) a bez mena
                nevie, ktorý z nich zoznam vyprázdnil.
              */}
              {activeNames.length > 0 ? (
                <>
                  {t.emptyFilteredBefore(activeNames.length)}{" "}
                  {activeNames.map((n, i) => (
                    <span key={n}>
                      {i > 0 && (i === activeNames.length - 1 ? ` ${t.and} ` : ", ")}
                      <strong>{n}</strong>
                    </span>
                  ))}
                  {". "}
                </>
              ) : null}
              {t.emptyFilteredAfter}
            </div>
            <div className="empty-action">
              <Link className="button button--quiet" href={toQuery(clearFilters(filters))}>
                {t.clearFilters}
              </Link>
            </div>
          </div>
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
        <>
        {/*
          Formulár zásuvky presunu. Stojí **vedľa** formulára hromadných
          akcií, nie v ňom — polia v zásuvke sa naň viažu atribútom `form`.
          Nesie tie isté skryté polia, lebo je to samostatné odoslanie:
          `moveManyAction` číta `document` z formulára, ktorý ho spustil.
        */}
        {filters.picked.length > 0 && (
          <form id="bulk-move" action={moveManyAction} className="bulk-move-form">
            {filters.picked.map(id => (
              <input key={id} type="hidden" name="document" value={id} />
            ))}
            <input type="hidden" name="back" value={toQuery(clearPicked(filters))} />
          </form>
        )}

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
            {/*
              Pod 640 px ukazuje pás **len číslo** (KNIZNICA.md, úloha 4) —
              „Označené: 2" + dve tlačidlá + × sa do 366 px nezmestí a pás
              by sa zalomil na dva riadky, teda na 120 px, a prekryl poslednú
              kartu. Celá veta ale nesmie zmiznúť pre čítačku, preto sú tu
              oba tvary a CSS medzi nimi prepína. `aria-label` na obyčajnom
              `<span>` by nestačil: prvok bez role ho nedostane prečítaný.
            */}
            <span className="bulk-title">
              <span className="bulk-title-long">{tl.picked(filters.picked.length)}</span>
              <span className="bulk-title-short" aria-hidden="true">{filters.picked.length}</span>
            </span>
            {pickedOutside > 0 && (
              <span className="bulk-picked-outside">{tl.pickedOutside(pickedOutside)}</span>
            )}
            {/* Strop sa povie nahlas. Bez toho by ďalšie označenie ticho
                nefungovalo a človek by hľadal chybu v zozname. */}
            {filters.picked.length >= MAX_PICKED && (
              <span className="bulk-picked-outside">{tl.pickedMax(MAX_PICKED)}</span>
            )}

            {/*
              Výber priečinka priamo v páse — **len od 640 px**. Pod ním naň
              nie je miesto: `.bulk-folder` má 240 px a s dvoma tlačidlami
              a × by pás pretiekol. Tam presun prevezme zásuvka nižšie.
            */}
            <div className="field bulk-folder">
              <span className="field-label">{tl.moveTo}</span>
              <Select
                name="folderId"
                fieldLabel={tl.moveTo}
                options={folderOptions}
              />
            </div>

            <button className="button button--quiet bulk-move-wide" type="submit" formAction={moveManyAction}>
              {tl.move}
            </button>

            {/*
              Presun na telefóne — zásuvka, nie výber v páse (KNIZNICA.md,
              úloha 4). Je to tá istá `filter-sheet` ako pri filtroch, teda
              `<details>` a **žiadny JavaScript**.

              Cieľ presunu sa vyberá až v nej a presun sa stane až odoslaním
              jej formulára; klik v páse nepresunie nič. Bez toho by „Presunúť"
              muselo buď tiché brať prázdny priečinok (teda „nezaradené"),
              alebo by výber musel zostať v páse — a ten by sa zalomil.

              Polia patria formuláru `bulk-move` cez atribút `form`, hoci
              stoja vnútri formulára hromadných akcií: vnorený `<form>` nie je
              platné HTML, `form="…"` áno a je to presne na tento prípad.
            */}
            <details className="filter-sheet bulk-move">
              <summary className="button button--quiet filter-sheet-toggle">
                {tl.move}
              </summary>
              <div className="filter-sheet-body bulk-move-body">
                <div className="field">
                  <span className="field-label">{tl.moveTo}</span>
                  <Select
                    name="folderId"
                    fieldLabel={tl.moveTo}
                    options={folderOptions}
                    form="bulk-move"
                  />
                </div>
                <button className="button filter-sheet-apply" type="submit" form="bulk-move">
                  {tl.moveConfirm(filters.picked.length)}
                </button>
              </div>
            </details>
            <button className="button button--quiet" type="submit" formAction={assignManyAction}>
              {tl.assign}
            </button>
            {/* Na telefóne sa text nezmestí — ostáva ×; meno akcie nesie
                `aria-label` (KNIZNICA.md, úloha 4). */}
            <Link className="bulk-clear" href={toQuery(clearPicked(filters))} aria-label={tl.clearPicked}>
              <span className="bulk-clear-label">{tl.clearPicked}</span>
              <span className="bulk-clear-x" aria-hidden="true">×</span>
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
              <li key={r.documentId} className={`doc-card${isPicked(r.documentId) ? " is-picked" : ""}`}>
                {/* Výber vľavo mimo obsahu (KNIZNICA.md, úloha 5): 22 px
                    políčko vo vlastnom stĺpci karty, ako v rámoch — v riadku
                    pilúl sa strácalo medzi nimi. */}
                <Link
                  href={toQuery(togglePick(filters, r.documentId))}
                  className={`bulk-pick doc-card-pick${isPicked(r.documentId) ? " is-on" : ""}`}
                  aria-pressed={isPicked(r.documentId)}
                >
                  <span className="bulk-pick-box" aria-hidden="true">{isPicked(r.documentId) ? "✓" : ""}</span>
                  <span className="bulk-pick-text">{tl.pick(r.title)}</span>
                </Link>

                <div className="doc-card-body">
                  <div className="doc-card-top">
                    {statusTag(r)}
                    {/* Technický stav spracovania len keď niečo hovorí —
                        „vo vyhľadávaní" je normálny koniec a pri každom
                        riadku by bol šum; zlyhanie je jediné červené. */}
                    {r.processingState !== "indexed" && (
                      <span className={r.processingState === "failed" ? "tag tag--expired" : "tag"}>
                        {t.processing[r.processingState] ?? r.processingState}
                      </span>
                    )}
                    {r.category && <span className="quiet doc-card-kind">{categoryLabel(r.category)}</span>}
                    {/* Verzia vpravo — čo platí, na jeden pohľad. */}
                    <span className="quiet doc-card-version">{r.effectiveLabel}</span>
                  </div>

                  <Link href={`/library/${encodeURIComponent(r.documentId)}`} className="doc-card-title">
                    {r.title}
                  </Link>

                  {/*
                    Kde dokument je a koľko ho je — `interné číslo · priečinok ·
                    počet znení` (`KNIZNICA.html`, rám 4). Počet znení tu
                    dovtedy chýbal; na karte niet stĺpca Verzia ako v tabuľke,
                    takže bez neho sa z karty nedalo zistiť, či má dokument
                    jedno znenie alebo sedem.

                    Kľúč je záloha, keď niet ničoho iného — riadok nemá byť
                    prázdny.
                  */}
                  <div className="quiet doc-card-where">
                    {[
                      r.internalNumber,
                      r.folderTrail?.length ? r.folderTrail.join(" / ") : undefined,
                      r.versionCount > 0 ? t.versions(r.versionCount) : undefined,
                    ].filter(Boolean).join(" · ") || r.documentId}
                  </div>

                  {/* Pásik potvrdení je posledný riadok karty (úloha 2). */}
                  {ackBar(r.effectiveVersionId)}
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
                  <tr key={r.documentId} className={isPicked(r.documentId) ? "is-picked" : undefined}>
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
                      {/*
                          Počet znení je tu, nie v stĺpci Verzia (MASTER.md):
                          je to údaj **o dokumente**, nie o tom znení, ktoré
                          práve platí — a v úzkom stĺpci robil z jedného riadka
                          dva.
                      */}
                      {/*
                        Presne tri údaje: **počet znení · interné číslo ·
                        priečinok** (`MASTER.md`). Dovtedy tu bolo aj `documentId`
                        a názov súboru s veľkosťou — technické údaje, ktoré patria
                        detailu dokumentu, nie riadku v zozname. Riadok sa nimi
                        predlžoval a údaje, podľa ktorých sa dokument naozaj hľadá,
                        v ňom zanikali.
                      */}
                      <div className="quiet doc-meta">
                        {[
                          r.versionCount > 0 ? t.versions(r.versionCount) : null,
                          r.internalNumber || null,
                          r.folderTrail?.length ? r.folderTrail.join(" / ") : null,
                        ].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="doc-cell-quiet">{r.category ? categoryLabel(r.category) : "—"}</td>
                    <td>
                      {/* Farba nesie stav (KNIZNICA.md, úloha 1). */}
                      {statusTag(r)}
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
                    {/*
                      Jeden riadok, nie zalomený odsek. `label` je **voľný text**
                      (`documents.ts`: „1.2", „novela 2026") — MASTER.md píta „len
                      číslo", ale také pole schéma nemá a vytiahnuť ho z labelu by
                      znamenalo vymyslieť si štruktúru. Preto celý label, ale
                      orezaný elipsou a s plným znením v `title`: stĺpec ostane
                      úzky a nič sa nestratí.
                    */}
                    <td className="doc-cell-quiet doc-col-version" title={r.effectiveLabel}>
                      {r.effectiveLabel}
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
                      Pásik + percento (KNIZNICA.md, úloha 2). Menovateľ
                      (O6/7 — percento nikdy samo) nesie `title` a text pre
                      čítačku: „100 %" z troch a „100 %" zo štyristo sú dve
                      rôzne správy.
                    */}
                    <td>{ackBar(r.effectiveVersionId)}</td>
                    <td className="doc-col-right doc-cell-quiet">
                      {/* Len dátum. E-mail autora je údaj o tom, kto zapisoval —
                          patrí do záznamu na detaile, nie do stĺpca, ktorý sa
                          skenuje očami zhora nadol (`MASTER.md`). */}
                      {r.updatedAt ? formatDate(r.updatedAt, uiLanguage) : "—"}
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
          {/*
            Komponent `.pager` (ZAKLAD, úloha 2). Neaktívny smer zostáva
            odkazom s `aria-disabled`, nie tlačidlom — stránkovanie sú odkazy
            a beží bez JavaScriptu. „Strana X z Y" odišla: rozsah vľavo
            hovorí to isté a navyše koľko toho je.
          */}
          <div className="pager">
            <span className="pager-count">{t.pageRange(paged.from, paged.to, rows.length)}</span>
            <span className="pager-spacer" aria-hidden="true" />
            {paged.pages > 1 && (
              <>
                {paged.page > 1 ? (
                  <Link className="button button--quiet pager-link" href={toQuery(withPage(filters, paged.page - 1))}>
                    {t.prevPage}
                  </Link>
                ) : (
                  <a className="button button--quiet pager-link" aria-disabled="true">{t.prevPage}</a>
                )}
                {paged.page < paged.pages ? (
                  <Link className="button button--quiet pager-link" href={toQuery(withPage(filters, paged.page + 1))}>
                    {t.nextPage}
                  </Link>
                ) : (
                  <a className="button button--quiet pager-link" aria-disabled="true">{t.nextPage}</a>
                )}
              </>
            )}
          </div>
        </form>
        </>
      )}
        </div>
      </div>
      )}
    </div>
    </AppShell>
  )
}
