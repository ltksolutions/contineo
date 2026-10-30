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

## Vlákno ticketu (od 29. 10.)
- Poradie v `.detail-main`: karta „Posledná prijatá správa" (`#last-message`), pod ňou odpoveď (`#answer`), pod ňou história vlákna (`#history`) **od najstaršej správy** — číta sa ako rozhovor.
- Správa je `.thread-msg` (pruh vľavo `--line-strong`); odpoveď helpdesku `.thread-msg--out` je **odsadená** (24 px, pod 640 px 12 px) a má pruh `--accent`, takže dvojica došlá správa → odpoveď je vidieť na prvý pohľad. Hlavička `.thread-msg-head`: pri došlej meno a „došlá správa", pri odpovedi „Odpoveď helpdesku".
- Správa zobrazená nad odpoveďou je v histórii zbalená do riadku (`details.thread-msg` + `.thread-msg-preview`), aby sa neopakovala celá.
- Zoznam ticketov má prepínač pohľadu `.view-switch` Otvorené · Vybavené · Všetky; Vybavené sú odpovedané aj zavreté (nová správa pýtajúceho vráti oba do Otvorených).
- Fronta Na posúdenie má prepínač `.view-switch.view-switch--fit` Čaká · Posúdené · Vyradené s počtom `.view-switch-count` (od 30. 10.). Rozhodnutý podnet je na čítanie: posudok štítkami `.tag` v `.eval-head`, overené znenie citátom `.quote`; vyradený má tiché „Vrátiť do fronty“. Predchádzajúce otázky tej istej osoby (do hodiny, z toho istého zdroja) sú citáty `.quote` nad otázkou podnetu, odpoveď k nim zbalená v `details.eval-ans` (od 30. 10.).

## Externý widget kanála (od 27. 10., KANAL-widget-riadok-otazky)
Widget kanála typu *widget* vložený v cudzom systéme (ISSF). Beží v Shadow DOM, preto ho
skript nesie celý (`lib/widgetScript.ts`, `WIDGET_CSS`); triedy `.xw-*` sú v `globals.css`
a test `widgetCss` stráži, že sa nerozídu. Vzorom je pole otázky v hlavičke a plachta otázky.
- Zatvorený **hore alebo dole v strede**: `div.xw-dock` > `button.xw-row.xw-row--grip` + `button.xw-grip` (úchyt ⋮⋮ na ľavom
  okraji riadku, 36 × 44 px: ťahanie, šípky, Home a dvojklik vráti; miesto si pamätá prehliadač, nastavenie kanála nie). Riadok `button.xw-row` — `span.xw-row-mark` (značka Continea, farba
  organizácie), `span.xw-row-text` (nápoveda z nastavenia kanála, rozpísaný text `.is-draft`),
  `span.xw-row-go` (šípka). 52 px, oblý, s tieňom. Na ostatných šiestich miestach tlačidlo.
  Klik, Enter alebo písanie ho rozbalí; písaný znak pokračuje v poli.
- **Zbalený na tlačidlo** (Ján 28. 10. 2026): `button.xw-fold` (40 × 44 px, ikona `arrow.down.right.and.arrow.up.left`) na pravom
  okraji riadku (`.xw-row--fold`) ho zbalí na `button.xw-pill` — značka + „Opýtajte sa…", 44 px, oblé, s tieňom
  (`.xw-dock.is-compact`). Tlačidlo sa ťahá celé (pohyb pod 5 px je klik), šípky ho posúvajú, Home a dvojklik vrátia;
  klik ho rozbalí späť na riadok pri tom istom okraji obrazovky. Tvar aj miesto si pamätá prehliadač.
- **Tip na požiadanie** (Ján 28. 10. 2026): `button.xw-help` (žiarovka `lightbulb`, 40 × 44 px) vľavo od `.xw-fold`
  (`.xw-row--help`) ukáže úvodný tip znova. Tip pod riadkom má šírku riadku a pre každý ovládač riadok `p.xw-tip-move`
  s jeho ikonou (úchyt ⋮⋮, zbalenie ⤡); kým je tip otvorený, má `aria-expanded=true` a sivý podklad. Len v tvare riadku.
- Otvorený: `.xw-scrim` (závoj) + `section.xw-sheet[role=dialog]` — pri veľkosti „na obrazovku"
  80 % × 80 % v strede, inak pri tlačidle; pod 640 px celá obrazovka. Vyrastá z miesta zatvoreného
  widgetu (`scale`, 0,32 s; bez animácie pri `prefers-reduced-motion`). Esc, `.xw-close` alebo závoj zavrie.
- Hlavička `.xw-head`: značka, `.xw-head-title`, prepínač jazyka `.xw-langs` > `button.xw-lang` so skratkami SK / CZ / EN
  (tvar `Picker(.segmented)`, sivý ako `.view-switch`; zvolený `.is-on` + `aria-pressed`, plný názov v `aria-label`; len kanál
  s viac jazykmi), „Zdroje: … ▾"
  (`.button--quiet.button--sm`, riadky pod hlavičkou), `.xw-close` (44 px).
- Telo `.xw-body` > `.xw-col` (720 px v strede). Prázdne: `.xw-empty` > `h2`, `p.xw-lead`,
  `form.xw-form` > `.xw-field` (`.xw-field-mark` + `textarea`) a `.xw-bar` (`.xw-hint` + jediné plné „Opýtať sa"),
  potom nedávne otázky (`.ask-sheet-examples.ask-sheet-mine`) a vzory (`.ask-sheet-examples`) — ako v plachte otázky.
- Rozhovor: `.xw-log` > `.xw-q` (otázka, farba organizácie), `.xw-a` (`.xw-a-head`, text `.xw-md` — Markdown odpovede ako `FormattedText`: odseky, `.xw-md-h` nadpisy, zoznamy, tučné —, `.xw-src`, `.xw-rate`
  s tichými `.button--sm`), `.xw-sys`; hľadanie `.xw-wait` (`.button-spinner` + „Hľadám…“) v karte odpovede; poďakovanie za hodnotenie a odoslaná správa helpdesku sú zelený `.lnote` so ✓ (`role="status"`), nie sivý `.xw-sys`; správa helpdesku `.xw-card` (`h3`, `.xw-muted`, `textarea`, plné „Odoslať helpdesku"
  + tiché „Zrušiť"). Pole pod rozhovorom `.xw-composer` > `.xw-composer-in` s tichým „Napísať helpdesku".
- Úvodný tip (`TipKit`, popover tip) pri prvej návšteve: `div.xw-tip[role=status]` pod zatvoreným widgetom (nad ním, keď
  dole nie je miesto: `.is-above`), šípka mieri na úchyt (`--tip-x`). `.xw-tip-head` (`.xw-tip-title` + `.xw-tip-close` 44 px),
  dve vety (`p`, druhá `.xw-tip-move` s úchytom), `.xw-tip-actions` — plné `.button--sm` „Vyskúšať" a tiché „Rozumiem".
  Úchyt medzitým bliká (`.xw-dock.is-tip`, bez animácie pri `prefers-reduced-motion`). Bez závoja, fokus neberie; raz v prehliadači.
- Pätka plachty `.xw-foot` (vždy, aj v prázdnom stave), ako pätička aplikácie: `a.xw-foot-brand` „Systém beží na aplikácii
  [značka] **Contineo**" → contineo.app, Ochrana osobných údajov organizácie (`/privacy` na jej doméne), Zdrojový kód
  (GitHub), „verzia 0.1.0 · revízia". Odkazy v novej karte (`target=_blank`, `rel=noreferrer`), 12 px, terč 24 px.
- Tlačidlá widgetu majú terč 44 px aj na počítači. Widget vyká.

## Značka v pohybe a zvuku (od 29. 10., web, sociálne siete, články)
Video a zvuk Continea sa nekreslia ani neskladajú nanovo — berú sa hotové z
`web/public/media/pomocnik-issf/` (verejne `contineo.app/media/pomocnik-issf/…`), zdroj a výroba
v `web/scripts/pomocnik-issf/`. Platí pre každé video, príspevok na sociálne siete aj článok.
- **Zvukové logo (jingle)** `contineo-jingle.m4a` (`.wav` na strih): šesť tónov G C E **G** E C,
  paličkový nástroj so zvončekom, na konci tichý akord C dur; 4,3 s, z toho 1,4 s melódia. Otázka
  vystúpi hore, odpoveď sa vráti dole. **Melódia, tempo ani nástroj sa nemenia**; vyrába ho
  `jingle.py`. Znie vždy s logom: na konci každého videa (posledný tón doznie s koncom) a pri
  premene lupy na Contineo. Nie pod hovoreným slovom, nie viackrát v jednom videe.
- **Animácia loga** `contineo-logo-animacia.mp4` (9 s, 2160 × 2160, štvorec pre sociálne siete):
  lupa v tme, rozsvietenie, premena na Contineo, bodky doskočia, vypísaná odpoveď, jingle.
- **Záverečné logo** `contineo-zaverecne-logo.mp4` (4,8 s): logo, oči žmurknú, „Opýtajte sa.
  Nehľadajte." a contineo.app, jingle. Ním končí každé video Continea.
- **Intro** `contineo-intro-s-hlasom.mp4` / `-bez-hlasu.mp4` (16,8 s): „Stále hľadáte
  a dostávate možnosti?" → „Opýtajte sa. Nehľadajte." → „Pýtajte sa, a dostávajte odpovede."
  → „Jedna overená odpoveď namiesto zoznamu odkazov."
- **Hlas komentára** je „LTK" v ElevenLabs: pokojný vecný prednes, vety sa vyrábajú so susednými
  vetami ako kontextom, **koniec každej vety ide hlasom dole** (aj jednoslovnej);
  otázka na konci stúpa (v texte pre hlas sa píše „??", s jedným otáznikom končí plocho).
- Slogan sa v obraze ani v texte neparafrázuje: **„Opýtajte sa. Nehľadajte."**; podtitul
  „Jedna overená odpoveď namiesto zoznamu odkazov.". SFZ sa číta celým názvom zväzu.
- Video na webe má titulky sk/cs/en (`titulky-*.vtt`) a náhľad (`poster-video.jpg`); vety
  vypálené v obraze sa do titulkov v tom istom jazyku neopakujú.

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
