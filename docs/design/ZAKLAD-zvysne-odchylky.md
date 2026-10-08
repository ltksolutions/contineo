# ZAKLAD — zvyšné odchýlky

> **Stav: rozhodnuté 8. 10. 2026** — Q1–Q4 podľa odporúčania, pripravené na implementáciu. Nahrádza `ODCHYLKY-otazky-tagy-prikazy` (presunutý do `_archiv/`, neimplementovať).

Referencia: `ZAKLAD-zvysne-odchylky.html`. Základ: `ZAKLAD.md`, `ZAKLAD-vyber-a-prepinace.md` (`.select-row`, `.choice-row`), `HR-pridelit-nadpis-karty.md` (`.form-group`), `ZAKLAD-lista-ulozenia.md` (domény v detaile organizácie). Zdroj: `app/learning/manage/page.tsx` (r. ~330–380), `components/MergeSelectionBar.tsx`, `app/learning/tests/page.tsx` (r. ~330–350), `app/hr/assign/page.tsx` (r. ~250–256), `app/admin/page.tsx` (r. 69–80, 137). DESIGN_ODCHYLKY: §5 learning/manage, §5 learning/tests, P12.

Je to **rozdiel oproti existujúcim obrazovkám**. Mená polí (`sel`, `to`, `answer_i`, `correct`), serverové akcie (`renameTagAction`, `renameKeyAction`, `mergeTagsAction`, `saveQuestionAction`) a existujúce texty ostávajú.

## Čo sa mení

### 1 · Výber značiek na zlúčenie (`/learning/manage/tags`)
- **Kľúč:** `.card.tgk` s hlavičkou v karte → `fieldset.form-group`: `legend.form-group-head` = názov kľúča + `span.n` súčet použitia (`tm.usage`) + vpravo tichý `a` „Premenovať kľúč" (`?editKey=`, existujúci `tm.renameKey`). Pod tým `div.card.form-group-body--rows > .form-list`.
- **Hodnota:** `.tgv` → `div.form-row.select-row`:
  - `label.select-row-label` (celý blok terč, min. 44 px) > natívny `input type="checkbox" name="sel" value={id}` (kruh 22 px) + `span.form-row-main` > `Stag` (pilulka) + `span.form-row-sub` (`tm.usage(...)`).
  - Vpravo **mimo labelu** tichý `a.lnk` „Premenovať" (`?edit=<id>`), aby klik naň riadok nezaškrtol.
  - Vybraný riadok: len plný kruh. `--accent-soft` a pruh vľavo (`.tgv.is-on`) sa rušia (Q3).
- **Premenovanie (`?edit=`):** riadok bez kruhu: `input.field-input name="to" form="rename-tag"` + `SubmitButton.button--quiet.button--sm` `tm.rename` / `tm.mergeButton` (pri `exists=1`) + `a.button--quiet.button--sm` „Zrušiť". Pod 640 px pole na celý riadok, tlačidlá pod ním 1fr 1fr (Q2).
- **Lišta výberu** (`MergeSelectionBar`) bez zmeny.
- Zrušiť `.tgk*`, `.tgv*` v `globals.css`, ak ich nič iné nepoužíva.

### 2 · Správna odpoveď v editore otázky (`/learning/tests`)
- Nad zoznamom odpovedí `p.form-group-hint`: `tt.markCorrectSingle` „Označte správnu odpoveď." / `tt.markCorrectMultiple` „Označte správne odpovede." (nové).
- Riadok `.form-row.ans`: vľavo **pred poľom** `label.ans-mark` (44 × 44 px) s natívnym inputom `name="correct" value={i}`:
  - **viac správnych** (`multiple`): `type="checkbox"`, vzhľad kruhu `.select-row` (prázdny / plný s fajkou);
  - **jedna správna** (`single`): `type="radio"`, vzhľad `.choice-row`: zvolená = fajka `--accent`, nezvolená = tenký prerušovaný krúžok 16 px ako nápoveda terča (Q1).
  - `aria-label` = `tt.answerCorrect(i+1)` („Odpoveď 2, správna"). Viditeľné slovo „Správna" sa ruší.
  - Potom `input.field-input name="answer_i"` (bez zmeny).
- Pätička `form-group-foot` „Prázdne riadky sa neuložia." (nový `tt.emptyRowsNote`).
- `.mc-check` sa ruší. Pravda/nepravda (`.tf-opt`) tento návrh nemení.

### 3 · `/hr/assign` bez skupín a trás
- Namiesto vety s `npm run person` je v karte Komu (skupiny a trasy) `div.empty`:
  - `empty-title` `t.noAudiencesTitle` „Zatiaľ žiadne skupiny ani trasy"
  - `empty-text` `t.noAudiencesText` „Skupina vznikne, keď ju niekto dostane na karte osoby alebo v importe. Trasu založíte v časti Trasy."
  - `div.empty-links` s odkazmi `t.linkPeople` → `/people`, `t.linkImport` → `/people/import`, `t.linkTracks` → `/hr/tracks` (terč 44 px).

### 4 · `/admin`
- Veta `domainsNoteBefore` + `npm run domains` + `domainsNoteAfter` pod zoznamom sa **zmaže** (aj kľúče i18n).
- Organizácia bez domény (`hostnames.length === 0`): dnešný červený `p.ask-error` `noDomainWarning` → `a.tag.tag--draft` „Bez domény ›" v riadku s názvom, odkaz `/admin/tenants/<kód>#domains` (nový `t.noDomainTag`). Vychádza len z uložených údajov, bez volania Vercelu.
- „Čaká na DNS" sa na zozname **nekreslí**, kým nie je uložený stav (Q4).

## Kde

`app/learning/manage/page.tsx`, `app/learning/tests/page.tsx`, `app/hr/assign/page.tsx`, `app/admin/page.tsx`, `globals.css` (`.select-row-label`, `.form-group-hint`, `.ans`, `.ans-mark`, `.empty-links`; zrušiť `.tgk*`, `.tgv*`, `.mc-check`), i18n (`learning.manage.*` bez zmeny, `learning.tests.markCorrectSingle/Multiple`, `answerCorrect`, `emptyRowsNote`; `hr.assign.noAudiencesTitle/Text`, `linkPeople/Import/Tracks`; `admin.list.noDomainTag`; zmazať `admin.list.domainsNoteBefore/After`).

## Prečo

- Holý checkbox 16 px je pod terčom 44 px a pruh vľavo pri vybranom riadku je vzor, ktorý aplikácia inde nemá. Výber viacerých má od 6. 10. jeden tvar: kruh vľavo.
- Hlavička kľúča v karte robila z karty dva bloky. Nadpis nad kartou je `Form` + `Section` ako všade inde.
- „Správna" vpravo za dlhým poľom je odďaleka neviditeľné a na telefóne malé. Kruh alebo fajka vľavo je prvé, čo oko pri riadku vidí.
- Príkaz `npm run …` personalista ani správca platformy nespustí a nedozvie sa z neho, kde v aplikácii to urobiť.

## Rozhodnutia v repozitári — dodržané

- **Premenovanie na existujúci tag je zlúčenie; prvý raz upozornenie a „Zlúčiť"** (MANAGE Q1) — bez zmeny.
- **Výber sú políčka vo `<form method="get">`; lišta je doplnok, bez JS tiché „Zlúčiť vybraté"** (`MergeSelectionBar`) — bez zmeny.
- **Číselník skupín zámerne nie je; skupina vznikne tým, že ju niekto dostane** (D38) — veta na `/hr/assign` to hovorí.
- **Stav domén sa číta naživo v detaile organizácie** (D27) — zoznam nevolá Vercel, ukazuje len to, čo je uložené.
- **Bez domény sa do organizácie nedá prihlásiť; je to porucha, nie poznámka** (ADMIN úloha 1.5) — ostáva viditeľné ako štítok pri názve, s odkazom na nápravu.
- **`/admin` na doméne zákazníka neexistuje** (D42) — bez zmeny.
- **Typ otázky, `rows`, `MAX_ANSWERS`** — bez zmeny.

## Rámy

- **1440 svetlá:** značky (dva kľúče, dve vybrané, lišta) · editor otázky Jedna správna a Viac správnych vedľa seba.
- **390 tmavá:** značky s otvoreným premenovaním · editor Viac správnych · `/hr/assign` bez skupín a trás · `/admin` s organizáciou bez domény.

## SwiftUI

| SwiftUI | Tu |
| --- | --- |
| `List(selection:)` v `Section` + `EditButton` lišta | značky `.select-row` + `MergeSelectionBar` |
| `Picker(.inline)` / výber v `List` s `TextField` | správna odpoveď `.ans` |
| `ContentUnavailableView` s odkazmi | `/hr/assign` `.empty` |
| `Label` štítok stavu v riadku | `/admin` „Bez domény" |

## Údaje, ktoré v modeli neexistujú

- **Uložený stav domény** (napr. `tenant.domainCheck: { host, state, checkedAt }` zapísaný pri otvorení detailu organizácie alebo pri „Overiť"). Bez neho zoznam vie len „Bez domény". Nepovinné, pozri Q4.
- Ostatné sú len texty i18n (pozri Kde).

## Rozhodnuté (8. 10. 2026 — všetky podľa odporúčania)

- **Q1** Jedna správna: fajka vľavo, nezvolená tenký prerušovaný krúžok 16 px.
- **Q2** „Premenovať" pri otvorenom premenovaní tiché.
- **Q3** Vybraný riadok len plným kruhom, bez podfarbenia a pruhu.
- **Q4** Na `/admin` len „Bez domény" z uložených údajov; „Čaká na DNS" až s uloženým stavom domény.

## Otázky

Žiadne otvorené.

<!-- pôvodné znenie otázok:
- **Q1** — Jedna správna: fajka vľavo (`.choice-row`) a pri nezvolenej odpovedi tenký prerušovaný krúžok ako nápoveda, kam ťuknúť?
  **Odporúčam áno.** Samotná fajka bez krúžku by pri nezvolených odpovediach nechala prázdne miesto a nebolo by jasné, že sa tam dá ťuknúť. Prerušovaný krúžok je slabší než kruh výberu viacerých, takže tvary sa nezamenia.
- **Q2** — „Premenovať" pri otvorenom premenovaní tiché (dnes plné)?
  **Odporúčam áno.** Plné tlačidlo má lišta výberu a dve plné na obrazovke by porušili pravidlo.
- **Q3** — Vybraný riadok len plným kruhom, bez podfarbenia a pruhu vľavo?
  **Odporúčam áno.** Tak vyzerá výber všade inde (`.select-row`). Pruh vľavo je navyše vzor, ktorý sa v aplikácii nepoužíva.
- **Q4** — „Čaká na DNS" na zozname `/admin` zatiaľ nekresliť a ukazovať len „Bez domény" (z uložených údajov)?
  **Odporúčam áno.** Volať Vercel pri každom zobrazení zoznamu nechceme (D27) a uložený stav domény zatiaľ nie je. Ak ho neskôr pridáte, štítok „Čaká na DNS" je jeden riadok kódu navyše.

-->

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/ZAKLAD-zvysne-odchylky.html + .md.
(ODCHYLKY-otazky-tagy-prikazy je v _archiv a neimplementuje sa.)
Vetva design/zvysne-odchylky z main. DESIGN_ODCHYLKY §5 learning/manage, §5 learning/tests, P12.

1. learning/manage/tags: .card.tgk → fieldset.form-group (legend: kľúč + .n použitie
   + tichý odkaz Premenovať kľúč). .tgv → div.form-row.select-row = label.select-row-label
   (checkbox name="sel", Stag, .form-row-sub použitie) + mimo labelu tichý a.lnk
   Premenovať (?edit=). Vybraný bez podfarbenia a pruhu. ?edit=: pole to + tiché
   Premenovať/Zlúčiť + Zrušiť (<640 pole na celý riadok). MergeSelectionBar bez zmeny.
   Zrušiť .tgk*, .tgv*.
2. learning/tests editor: p.form-group-hint (markCorrectSingle/Multiple) nad odpoveďami;
   riadok .ans = label.ans-mark 44 px pred poľom (multiple: checkbox, kruh .select-row;
   single: radio, fajka .choice-row, nezvolená prerušovaný krúžok 16 px), aria-label
   answerCorrect(i+1); pätička emptyRowsNote. Zrušiť .mc-check.
3. hr/assign bez skupín a trás: div.empty (noAudiencesTitle, noAudiencesText,
   .empty-links: /people, /people/import, /hr/tracks); bez npm run person.
4. admin: zmazať vetu s npm run domains a kľúče domainsNoteBefore/After; pri
   hostnames.length === 0 a.tag.tag--draft „Bez domény ›" → /admin/tenants/<kód>#domains
   namiesto p.ask-error. Žiadne volanie Vercelu v zozname.
5. i18n sk/cs/en podľa .md; inline štýly v dotknutých miestach → triedy.

Bez JS musí fungovať všetko. Over 1440 svetlá + 390 tmavá, len klávesnicou
(Tab cez riadky, medzerník zaškrtne, šípky v rádiách), VoiceOver. tsc, eslint,
vitest, build. Komentáre: odkaz na ZAKLAD-zvysne-odchylky (8. 10. 2026).
DESIGN_ODCHYLKY: P12 a dotknuté riadky §5 stav ✓.
```
