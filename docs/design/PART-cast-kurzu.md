# PART — Časť kurzu (`/learning/[courseKey]/[partKey]`)

Referencia: `PART-cast-kurzu.html`. Základ: `ZAKLAD.md`, `COURSE-prehlad-kurzu.md` (`PartList`, `.notice--info`). Zadanie: `docs/design/LEARNING-zadanie.md`, rám 3 z 9. Model: ADR-018 (D117, D119, D122).

## Čo sa mení

Nová obrazovka časti kurzu. Nové komponenty: **blok obsahu** (6 typov), **prehrávač videa** (JavaScript — výnimka zo zadania), **pás časti** (testy + označenie).

## Rozloženie

- Navigácia: „← Kurz · Časť 4 z 6 · Ďalšia →". „Ďalšia" v postupnom kurze `aria-disabled`, kým časť nie je hotová.
- Hlavička: `.page-title`, `.tag` Povinná/Nepovinná, názov kurzu, odhad času.
- Bloky pod sebou, gap 22 px, text max 68ch.
- **1440**: vľavo osnova častí 230 px (sticky, `PartList` v malom), obsah max 760 px.
- **834 / 390**: jeden stĺpec.

## Bloky obsahu

| Typ | Tvar |
| --- | --- |
| text | FormattedText, `--fs-lead` (390: 16 px), line-height 1.7 |
| obrázok | `<figure>` r12 + `figcaption` 12.5 px `--muted` |
| galéria | mriežka 3 stĺpce (390: 2), 4:3; lightbox nie — odkaz na plný obrázok |
| dokument z knižnice | `.card`: ikona PDF · „DOKUMENT Z KNIŽNICE" · názov · „Znenie 3 · platné od … · oddelenie" · `.button--quiet` „Otvoriť PDF" + „Detail v knižnici". Odkaz na **konkrétne znenie**, nie kópia. |
| video interné | vlastný prehrávač (nižšie) |
| video externé | iframe poskytovateľa + čip „Externé video · dopozeranie sa neoveruje" |

## Prehrávač videa (JavaScript)

- 16:9, r12, tmavé pozadie aj vo svetlej téme. Ovládanie: prehrať/pauza, čas `7:26 / 12:00`, pás, hlasitosť, celá obrazovka. Na 390 tlačidlá 36 px.
- Ikony `play`, `pause`, `volume`, `fullscreen` z `Icon.tsx` (mriežka 18×18, ťah 1.5–1.6) — ak chýbajú, doplniť tam; nie znaky Unicode (kreslí ich systém a každý inak).
- Pás: pozreté rozsahy (biela 55 %), aktuálna pozícia (biela), **čiarkovaná hranica** = najďalej pozreté miesto.
- **Povinné dopozeranie**: pretáčanie dopredu len po hranicu. Čip pod videom v `--warn`: „Povinné dopozeranie · pozreté 62 %" + malý pás; veta „Dopredu sa dá pretáčať len po miesto, ktoré ste už videli. Treba aspoň 90 %."
- Dopozerané (≥ 90 %, vyhodnocuje server z rozsahov `video_watch`): čip `--ok` „✓ Dopozerané", pretáčanie voľné.
- Priebežne posiela rozsahy na server (meranie, nie dôkaz — D119). Bez JS: natívne `<video controls>` a veta, že dopozeranie sa bez JavaScriptu nezaznamená.

## Pás časti (sticky dole)

- 1440 / 834: karta pod obsahom, `position:sticky; bottom:0`, `--shadow`.
- 390: na celú šírku nad spodnou lištou, horná čiara + tieň — **len súhrn povinného testu v jednom riadku** („Povinný test: neprešiel 60 % · ďalší pokus o 30 minút · Testy ↓") + označenie. Plný zoznam testov je v toku stránky ako `.card` „Testy tejto časti" za posledným blokom. Pás nesmie zakryť video, ktoré stráži.
- Hore **testy časti** — riadok: „Test: názov · povinný/nepovinný" · výsledok · akcia:
  - nespustený → `.button--quiet` „Spustiť"
  - prešiel → „prešiel 85 %" `--ok-fg` + odkaz „Výsledok"
  - neprešiel → „neprešiel 60 %" `--bad-fg` + „ďalší pokus o 30 minút" + vypnuté „Skúsiť znova"
- Dole **označenie**:

| Stav | Obsah |
| --- | --- |
| nezačatá / video rozpozerané | vypnuté „Označiť ako prejdené" + veta s percentom a hranicou 90 % |
| pripravená | zapnuté tlačidlo (`<form method="post">`) + veta „Po označení je časť hotová." |
| označená, chýba povinný test | ! v `--warn` · „Označené 17. 9. · časť bude hotová po prejdení povinného testu" (Q1) |
| hotová | ✓ · „Časť je hotová · 17. 9. 2026" · „Ďalšia časť →" |
| hotová, nepovinný test nespravený | to isté + „nepovinný test môžete spraviť kedykoľvek" |

Tlačidlo sa vypína **len** kvôli povinnému videu (zadanie). Povinný test je samostatná podmienka hotovej časti (D119).

## Rámy

- **390**: video rozpozerané (celá stránka) · nezačatá · pripravená · označená bez testu · hotová · hotová + nepovinný test · tmavá (výrezy video + pás).
- **834**: video rozpozerané.
- **1440**: video rozpozerané.

## Čo je v repozitári UŽ HOTOVÉ — nerob znova

| Čo | Kde |
| --- | --- |
| FormattedText | komponent (textový blok) |
| Kartička znenia s PDF | `/documents`, `PdfView` |
| Úložisko súborov, nahrávanie po kúskoch | `fileStore.ts`, GridFS (ADR-011) |
| `.card`, `.tag`, `.button`, `aria-disabled` | `globals.css` (ZAKLAD úloha 3) |
| AppShell, spodná lišta | `AppNav.tsx` |

Nové: `ContentBlock`, `VideoPlayer` (klient), `PartDock`, `.vid-*`, `.vchip`, `.bdoc-*`, `.pdock`, `.ptr`.

## Údaje, ktoré v modeli zatiaľ nie sú

- `block.video.durationSec`, `block.video.requireFullWatch`, poster (prvá snímka alebo nahratý obrázok).
- `video_watch` rozsahy → odvodené percento a najďalej pozreté miesto.
- `part.estimatedMinutes` (alebo súčet z blokov).
- Čas ďalšieho pokusu = posledný pokus + pauza testu.

## Rozhodnutia Jána 27. 9. 2026

- **Q1 ✅** Časť sa dá označiť ako prejdená aj pred prejdením povinného
  testu; tlačidlo stráži len video. Časť potom ukazuje „bude hotová po
  prejdení povinného testu" — hotová je až s testom (D119).
- **Q2 ✅** Pod kartičkou dokumentu veta „Platné je už znenie N", odkaz
  ostáva na znenie z kurzu.

## Otázky pre Jána

- **Q1** — Môže človek označiť časť ako prejdenú **pred** prejdením povinného testu? Návrh: áno (tlačidlo stráži len video, ako v zadaní), časť potom ukazuje „bude hotová po prejdení povinného testu". Alternatíva: tlačidlo vypnúť aj kvôli testu.
- **Q2** — Blok „dokument z knižnice" odkazuje na znenie zmrazené pri zverejnení kurzu. Keď v knižnici medzitým platí novšie znenie, ukázať pod kartičkou vetu „Platné je už znenie 4"? Návrh: áno, odkaz ostáva na znenie z kurzu.
