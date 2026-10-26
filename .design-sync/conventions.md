# Contineo — ako stavať obrazovky

Contineo je intranet organizácie (predpisy, potvrdenia, vzdelávanie). Vzhľad nesú
**triedy a tokeny z `styles.css`** (globals.css aplikácie); komponenty z `window.Contineo`
sú len doplnok. Texty sú po slovensky.

## Nastavenie
- Bez providera. Téma: `<html data-theme="light|dark">` — tokeny sa prepnú samy.
- Farba organizácie: prepíš `--accent` (a `--accent-soft`, `--on-accent`) na obale stránky;
  nikdy systémová modrá.

## Tokeny (`var(--…)`)
- Plochy: `--bg` (stránka), `--surface` (karta), `--surface-2` (hover), `--line`, `--line-strong`.
- Text: `--ink`, `--muted`; stavy `--ok-fg/--ok-bg`, `--warn-fg/--warn-bg`, `--bad-fg/--bad-bg`.
- Písmo: `--fs-title` (26), `--fs-section` (17), `--fs-lead` (15), `--fs-body` (14),
  `--fs-small` (13), `--fs-micro` (12). Rozmery: `--radius` (12), `--gap`, `--card-pad`,
  `--control-h` (40), `--control-h-sm` (36).

## Pravidlo ovládačov (vzor Apple HIG / SwiftUI)
| Čo | Prvok |
|---|---|
| kam idem (časti sekcie) | `<nav class="tabs"><TabsBar><a class="tab is-active">…</a>…</TabsBar></nav>` |
| ako to vidím (pohľad) | `<nav class="view-switch"><a class="view-switch-item is-on">…</a>…</nav>` — sivý, bez farby |
| čo urobím | `.button` — **najviac jedno plné**, vpravo v `.page-head`; ostatné `.button button--quiet`. V zozname kariet sú tlačidlá kariet tiché. Výnimka: „Odoslať" po náhľade je plné na konci stránky |
| odkiaľ som prišiel | cesta pod hlavičkou; **nikdy „← Späť…"** |

## Triedy
- Stránka: `.page-head` (riadok nadpisu, `flex-wrap`) s `.page-title`, `.page-head-spacer`,
  akcie; pod ním `p.quiet.page-lead`.
- Obsah: `.card`; prázdny stav `.empty` > `.empty-title`, `.empty-text`, `.empty-action`.
- Formulár: `label.field` > `.field-label`, `.field-input`, `.field-hint`; nastavenia
  `.set-form` > `section.set-sec`.
- Štítky: `.tag`, `.tag--draft` (upozornenie); tlmený text `.quiet`.
- Hľadanie v zozname: komponent `SearchStrip` vo `<form method="get">`.
- Na telefóne terč aspoň 44 px; zoznamy pod 1024 px ako karty, od 1024 px tabuľka — len ak sa
  porovnávajú stĺpce; zoznam s 2–3 údajmi ostáva kartami.

## Formuláre (SwiftUI `Form` + `Section`)
- Skupina polí: `<fieldset class="form-group">` > `legend.form-group-head` (nadpis **nad**
  kartou) + `div.card.form-group-body` (obsah) + voliteľne `p.form-group-foot.quiet`
  (nápoveda **pod** kartou). Kroky s číslom: `.form-group--lg`, nadpis
  `.form-group-head--step`. Legendu nikdy nekresli do okraja karty.
- Karta s riadkami výberu: `.card.form-group-body.form-group-body--rows` > `.form-list` >
  `label.form-row` (celý riadok je terč, min. 44 px). Text v `span.form-row-main`,
  podnadpis `span.form-row-sub`. Vždy natívny `input`, nikdy vlastný `div`:
  | čo sa vyberá | riadok | input |
  |---|---|---|
  | niekoľko zo zoznamu | `.form-row.select-row` (kruh vľavo) | `type="checkbox"` |
  | jedna z 2–5 | `.form-row.choice-row` (fajka vpravo) | `type="radio"`; pole voľby v `div.choice-field` hneď za riadkom |
  | zapnuté / vypnuté | `.form-row` | `type="checkbox" role="switch" class="toggle"` |
- Číslo v malom rozsahu s rozumnou predvoľbou (SwiftUI `Slider`, od 25. 10.): komponent
  `RangeField` → `div.field.field-range` > `.field-range-head` (`label.field-label` +
  `output.field-range-value`), natívny `input.field-range-input type="range"` (farba
  organizácie cez `accent-color`, terč 44 px), `.field-range-scale` (min a max), `.field-hint`.
  Presné číslo (suma, dátum, počet osôb) je `.field-input`, nie posuvník.
- Pilulky (`.tag`) sú len na čítanie, vo formulári nie. `.view-switch` do formulára nepatrí.

```jsx
<fieldset className="form-group">
  <legend className="form-group-head">Komu</legend>
  <div className="card form-group-body form-group-body--rows"><div className="form-list">
    <label className="form-row"><input type="checkbox" role="switch" className="toggle" name="all" value="1" />
      <span className="form-row-main"><span>Všetkým v organizácii</span><span className="form-row-sub">prebije výber nižšie</span></span></label>
    <label className="form-row select-row"><input type="checkbox" name="audience" value="track:a" />
      <span className="form-row-main">Rozhodcovia 2026</span><span className="form-row-sub">14</span></label>
  </div></div>
  <p className="form-group-foot quiet">Osoba dostane všetko, čo je trase pridelené.</p>
</fieldset>
```

## Uloženie, ďalšie akcie, hlášky (od 7. 10.)
- Dlhý formulár: jeden `form.card.set-form` so sekciami `section.set-sec`; na konci
  `div.set-savebar` (prilepená dole) s jediným plným `.button` „Uložiť" a vetou `.quiet`.
- Zriedkavé a nevratné úkony pod formulárom: `section.card.more` > `.more-head` (`h2`
  „Ďalšie akcie") + riadky `.more-row` > `.more-main` (`b` názov, `span` vysvetlenie) +
  tlačidlo; vratné `.button--quiet`, nevratné `.button--danger`. Nevratné sa potvrdzuje
  **adresou** (`?archive=1#more`) — pod riadkom `form.more-confirm` s poľami, `.button--danger`
  a odkazom „Zrušiť". Žiadne modálne okno.
- Hláška v obsahu: `div.lnote` (+ `.lnote--warn` / `.lnote--bad`) > `span.lnote-mark` („!", „✓")
  + `span.lnote-text`. Nie `.notice` (to je modálne okno).
  S akciou: `.lnote.lnote--action` + `button.button.button--sm` za textom (zalomí sa pod text).
- Krátky výber nad obrazovkou (popover): `<details>` > `summary.button.button--quiet.button--sm`
  s hodnotou („Zdroje: Knižnica ▾") + `form.filter-sheet-body.ask-scope-pop` s `.sheet-h`,
  riadkami `.form-row.select-row` a jediným plným `button.filter-sheet-apply`. Pod 640 px
  spodná plachta nad `.ask-scrim`, od 640 px popover 360 px pod tlačidlom. Zmena výberu
  nič nespúšťa, akcia je až tlačidlo.
- Výber vnútri plachty, ktorá už je nad obrazovkou (plachta otázky): bez druhého popoveru —
  `details.ask-scope.ask-sheet-scope` v lište drží len tlačidlo, riadky sú sesterský
  `fieldset.ask-sheet-scope-pane.form-group` pod lištou, zobrazený cez `:has([open])`.
- Nástroje v hlavičke: `.page-head` > `.page-head-main` (`h1.page-title` + `p.page-lead`)
  + `.page-tools` (tiché tlačidlá, hlavná akcia posledná).
- Jediná výnimka z „`.view-switch` do formulára nepatrí": áno/nie s významom v posudku je
  `.seg` > dva `label.seg-opt` s natívnym `input type="radio"`; zvolený dostane `.is-ok`
  alebo `.is-bad`. Inde vo formulári ostáva `.choice-row`.

## Grafy a matice (od 24. 10., ORG-ai-prehlad)
Kreslí ich server z CSS — bez knižnice, bez JavaScriptu. Graf má textovú alternatívu v
`p.sr-only` a samotný je `aria-hidden`; čísla sú vždy aj v matici pod ním.
- Séria: `.series-1` … `.series-5` sú odtiene farby organizácie (líšia sa svetlosťou),
  `.series-6` je sivé „Ostatné". V legende `ul.chart-legend` > `li` > `span.chart-swatch.series-N`.
- Stĺpce po obdobiach: `section.card.chart-card` > `h2` + `.chart-plot` (premenná
  `--chart-cols`) > `.chart-gridline` (popis osi v `span`) + `.chart-cols` > `a.chart-col`
  > `span.chart-seg.series-N` (výška v %) + `small.chart-col-total`. Budúce obdobie je
  `div.chart-col.is-future` (bodkovaná čiara, nie nula). Pod tým `.chart-labels`.
- Rebríček (jedno obdobie): `.chart-rank` > `a.chart-rank-row` > `.chart-rank-name`
  (swatch + `b`), `.chart-rank-track` > `.chart-rank-fill.series-N`, `.chart-rank-val`.
- Matica položka × obdobie: od 1024 px `section.card.matrix-wrap` > `.matrix`
  (`--matrix-cols` = šablóna stĺpcov) > `.matrix-row` (`.matrix-head`, `.matrix-foot`,
  podriadok `.matrix-sub`) > `.matrix-name`, `.matrix-cell` (odkaz v bunke),
  `.matrix-total`, `.matrix-meta`. Pod 1024 px tie isté riadky ako `.matrix-cards` >
  `.card.matrix-card` (`.matrix-card-name`, `-sum`, `-meta`, `-last`, `-wide`) a malý graf
  `span.spark` (12 × `span`, budúci `.is-future`); na konci `.card.matrix-cards-foot`.
- Rýchly výber obdobia pod filtrom: `p.quiet.quick-ranges` s odkazmi, zvolený `a.is-on`.
- Široká časť organizácie (matica s mesiacmi): `.org-grid.org-grid--wide` — telo bez
  hranice 720 px.

## Zoznamy na výber a hľadanie s rozsahmi (od 26. 10., PREHLAD-ulohy-a-dokumenty)
Vzor SwiftUI `List` + `NavigationLink` a `.searchable` + `.searchScopes`.
- Zoznam, z ktorého sa vyberá (nie koná): `.card.panel` > `a.panel-row.panel-row--link` — **celý riadok je odkaz** na detail, vpravo `svg.panel-chevron` (šípka ›). V riadku `.panel-main` > `.panel-name` + `.panel-meta`, voliteľne `.due-chip` alebo `.tag` pred šípkou. Bez `.panel-action`: akcie sú na detaile.
- Skupiny v jednom paneli: `div.panel-group` (nadpis skupiny, `--fs-micro`, podklad `--surface-2`); `.panel-group--bad` pre „Po termíne".
- Úloha má vľavo `span.task-icon` (kruh 36 px s ikonou druhu úlohy): `--bad` po termíne, `--soon` blíži sa termín, `--decide` rozhodnutie. Farba nesie naliehavosť, nie druh. Pod 640 px ide termín úlohy pod text.
- Hľadanie s rozsahmi: `SearchStrip` vo `<form method="get">` (aplikácia ho odosiela počas písania) a pod ním (od 1024 px vedľa) `nav.view-switch.view-switch--scroll` — rozsahy s počtom `.view-switch-count` **po hľadaní**; pri 5+ voľbách sa pás roluje vodorovne, neláme. Rozsah bez výsledku sa neukazuje, okrem zvoleného.

## Príklad
```jsx
<div>
  <div className="page-head">
    <h1 className="page-title">Pridelené dokumenty</h1>
    <span className="page-head-spacer" />
    <a className="button" href="/hr/assign">Prideliť dokument</a>
  </div>
  <nav className="tabs"><Contineo.TabsBar>
    <a className="tab is-active" href="/hr">Pridelenia</a>
    <a className="tab" href="/hr/overview">Výkaz potvrdení</a>
  </Contineo.TabsBar></nav>
  <p className="quiet page-lead">Čo bolo komu uložené a kto to už potvrdil.</p>
  <div className="empty">
    <div className="empty-title">Zatiaľ nič nepridelené</div>
    <div className="empty-text">Dokument pridelíte tlačidlom vpravo hore.</div>
  </div>
</div>
```
