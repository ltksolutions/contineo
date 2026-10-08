# EVAL — posudok (`Rating.tsx`, `/evaluation`)

> **Stav: rozhodnuté 8. 10. 2026** — Q1–Q5 podľa odporúčania, pripravené na implementáciu.

Referencia: `EVAL-posudok.html`. Základ: `ZAKLAD.md`, `ZAKLAD-vyber-a-prepinace.md`, `ZAKLAD-podmenu-a-akcie.md`, `OSOBY-karta-osoby.md` (`.sec-rows`). Zdroj: `components/Rating.tsx`, `components/ReportInaccuracy.tsx`, `app/evaluation/page.tsx`, `components/Answer.tsx`.

Je to **rozdiel oproti existujúcim obrazovkám**. Texty (`rating.*`, `report.*`, `evaluation.*`, `curation.*`), `PATCH /api/rating`, polia (`correct`, `hallucination`, `verifiedAnswer`, `correctSources`, `note`, `readerVerdict`, `readerNote`) a správanie ostávajú.

## Čo sa mení

### Panel hodnotiteľa (`Rating`, `canEvaluate`)
- Komponent dostane prop `as: "card" | "section"`. Pod odpoveďou (`Answer.tsx`) je to `div.card` (súrodenec karty odpovede), vo fronte `section.rating` v karte položky. Inline `borderColor: --teal-100` a `background: --surface-2` sa rušia.
- Hlavička `.rating-head`: `h3` „Posudok" (`t.heading`, 15 px, bez `uppercase`) + vpravo `.rating-status` s `aria-live="polite"`: `t.saving` (tlmene), `✓ t.saved` (`--ok-fg`), `t.saveFailed` (`--bad-fg`, tučne).
- **Každá otázka = jeden riadok** `div.rating-q[role=radiogroup][aria-labelledby]`: vľavo `span.rq-label` (`t.correctQuestion`, `t.hallucinationQuestion`), vpravo **`.seg`** — dva `label.seg-opt` s natívnym `input type="radio" name="correct-<id>"` / `"hallucination-<id>"` (vizuálne skrytý, `:focus-visible` na segmente). Vzor SwiftUI `LabeledContent` + `Picker(.segmented)` v riadku `Form` (Q1). `onChange` → `save()` ako dnes. Riadky oddeľuje čiara. Od 640 px má segment výšku 34 px, pod 640 px je otázka nad segmentom, segment cez celú šírku a 44 px.
- `fieldset` + `legend` sa nepoužije, lebo `legend` sa nedá spoľahlivo dať do mriežky vedľa ovládača. Náhrada je `role="radiogroup"` s `aria-labelledby` na text otázky.
- **Farba až po voľbe:** nezvolený segment je sivý (`--surface-2`). Zvolený má `.is-ok` / `.is-bad` (podklad `--ok-bg` / `--bad-bg`, text a vnútorný obrys `--ok-fg` / `--bad-fg`, tučne, fajka ✓), takže stav nenesie len farba. Význam: `correct=1` ok, `correct=0` bad, `hallucination=1` bad, `hallucination=0` ok.
- **Nie je to `.view-switch`.** Ten je sivý odkaz na iný pohľad a do formulára nepatrí. `.seg` je ovládač formulára (rádiá) a farbu dostane po voľbe.
- Doplnenie: `<details class="rating-more">` so `summary` `t.showDetail`. `t.hideDetail` sa už nepoužíva (otvorenosť ukazuje šípka `details`). Stav `detail` v Reacte sa ruší; reset pri zmene `recordId` zabezpečí `key={recordId}` na `details`.
- Polia: `label.field` > `span.field-label` + `textarea.field-input` / `input.field-input`. `fieldStyle` sa ruší. Uloženie `onBlur` ostáva.
- Zlyhanie (Q3): pri `status === "failed"` sa pod `fieldset`, ktorého zmena neprešla (alebo pod poľom), ukáže `.lnote.lnote--bad`: „Táto voľba sa neuložila. Kliknite na ňu znova; ak sa to opakuje, obnovte stránku." (nový `t.saveFailedHint`). Pre polia: „Text sa neuložil. Kliknite do poľa a znova ho opustite." Zvolená hodnota ostane zvolená.

### Panel čitateľa (`ReaderPanel`, `ReportInaccuracy`)
- Riadok `.reader-row`: `t.readerQuestion` (tlmene) + `button.button.button--quiet.button--sm` `t.fits` / `t.doesNotFit` s `aria-pressed`. Zvolené „Nesedí" má `.is-bad` (obrys a text `--bad-fg`, podklad `--bad-bg`). Farba sa objaví až po kliknutí. Na telefóne sú tlačidlá v jednom riadku na celú šírku, 44 px.
- „Sedí" sa uloží hneď a riadok sa vymení za `t.readerThanks`, ako dnes.
- Po „Nesedí" ostáva `ReportInaccuracy`: `label.field`, nápoveda, chyba ako `.lnote--bad` namiesto inline červeného textu, **tiché** `button.button--quiet` `t.submit` (Q2). Inline `maxWidth: 560` → trieda `.reader` (max 560 px).

### Fronta `/evaluation`
- Obal `.page-narrow--wide` (max 860) namiesto inline. `p.page-lead` bez inline okrajov.
- Položka = **jedna** `article.card.ev-item`:
  - `.ev-main`: `.ev-head` (štítky `tag--expired` `t.saidDoesNotFit`, `tag` `t.reported`, vpravo `.ev-date` `t.askedAt …`), `p.ev-q` (otázka), `blockquote.quote` (`span.quote-who` „Čitateľ napísal" — nový `t.readerWrote`, `span.quote-text` doslovne s `white-space: pre-wrap`), `details.ev-ans` (odpoveď a zdroje).
  - `Rating as="section"`: oddelená `border-top`, bez vlastnej karty.
- Inline štýly štítkov (`fontSize`, `fontWeight`) sa rušia, veľkosť má `.tag` sám.
- Na stránke nie je plné tlačidlo.

### Pripraviť ako overenú odpoveď
- `section.form-group.form-group--lg`: `h2.form-group-head` `tc.prepareHeading` + `p.form-group-lead` `tc.prepareIntro` (nová trieda, Q5).
- Položka = `form.card.prep`: hlavička (štítok `tc.draftBadge`, dátum), polia Otázka a Odpoveď, **zdroje ako `.sec-rows`** (nadpis, riadky `.form-row.select-row`, pätička `tc.sourcesHint` + „§ podľa hodnotiteľa: …") **bez vlastnej karty** (Q4), tiché `tc.save`.
- „Otvoriť kuráciu" ostáva ako odkaz, bez „→".

## Kde

`components/Rating.tsx`, `components/ReportInaccuracy.tsx`, `components/Answer.tsx` (len prop `as="card"`), `app/evaluation/page.tsx`, `globals.css` (`.rating*`, `.seg`, `.seg-opt.is-ok/.is-bad`, `.reader*`, `.button.is-bad`, `.ev-*`, `.quote*`, `.prep`, `.form-group-lead`), i18n (`rating.readerWrote`, `rating.saveFailedHint`, `rating.saveFailedFieldHint`).

## Prečo

- Dnešné voľby sú dve samostatné tlačidlá s farbou natvrdo a bez väzby na otázku. Segment v riadku zachová úsporu miesta, ale je to jeden ovládač s natívnymi rádiami (šípky na klávesnici, „1 z 2“ v čítačke). Farba sa objaví až na zvolenej voľbe a vždy spolu s fajkou.
- Nadpis veľkými písmenami a karta s inou farbou robili z posudku cudzí prvok. Vo fronte vznikla karta v karte.
- Tlačidlo-odkaz „Doplniť…" je presne to, na čo je `<details>`: zbalí, ukáže šípku a funguje klávesnicou bez vlastného stavu.
- Plné „Odoslať" pod odpoveďou súperilo s plným „Opýtať sa" na tej istej obrazovke.
- Ľavý farebný pruh pri citáte je vzor, ktorý sa v aplikácii inde nepoužíva. `.quote` je tlmený podklad s menom autora.

## Rozhodnutia v repozitári — dodržané

- **Hodnotiteľ nemá Uložiť; voľba sa uloží po kliknutí, text po opustení poľa; stav uloženia je vidieť** (Ján 15. 9. 2026, hlavička `Rating.tsx`) — bez zmeny.
- **Čitateľ odosiela vedome; „Sedí" sa uloží hneď a končí, pri „Nesedí" sa verdikt uloží hneď a formulár ostane** (`ReaderPanel`) — bez zmeny.
- **Formulár „Nesedí" sa ukáže až po kliknutí, nie ako rozbaľovačka pod každou odpoveďou** (`ReportInaccuracy`, 15. 9.) — bez zmeny.
- **Panel vyžaduje JavaScript** (odpoveď sa streamuje, `ReportInaccuracy`) — výnimka z pravidla bez JS ostáva.
- **Slová čitateľa doslovne a celé** (`evaluation/page.tsx`) — dodržané (`pre-wrap`, bez skracovania).
- **Odpoveď vo fronte zbalená** — dodržané.
- **Do fronty len „Nesedí" alebo nahlásené** (Ján 15. 9.) — bez zmeny.
- **Jeden panel a jedna cesta `PATCH /api/rating` pod odpoveďou aj vo fronte** — dodržané: ten istý komponent, len `as`.
- **Nová odpoveď = čisté hodnotenie** (reset pri `recordId`) — dodržané cez `key`.
- **Zverejňuje správca obsahu; tlačidlo je „Uložiť", nie „Zverejniť"; každá položka má vlastné tiché uloženie** (R1, 6. 10. 2026) — dodržané.

## Rámy

- **1440 svetlá:** `/evaluation` — neposúdená položka · posúdená (Nie / Nie, všetko má oporu) s otvoreným doplnením a stavom „uložené" · Pripraviť ako overenú odpoveď s jednou položkou.
- **390 tmavá:** čitateľ pod odpoveďou po „Nesedí" · hodnotiteľ pod odpoveďou („ukladám…") · položka fronty so stavom „neuložilo sa" a hláškou.

## SwiftUI

| SwiftUI | Tu |
| --- | --- |
| `LabeledContent` + `Picker(.segmented)` v `Form` | `.rating-q` + `.seg` |
| `DisclosureGroup` | `details.rating-more`, `details.ev-ans` |
| `Section` v `List` | posudok ako sekcia karty položky |
| `Button(.bordered).controlSize(.small)` | Sedí / Nesedí |

## Údaje, ktoré v modeli neexistujú

Žiadne. Nové sú len texty: `rating.readerWrote` („Čitateľ napísal"), `rating.saveFailedHint`, `rating.saveFailedFieldHint` (sk/cs/en). `rating.hideDetail` sa prestane používať.

## Rozhodnuté (8. 10. 2026 — všetky podľa odporúčania)

- **Q1** Hodnotenie v riadku: otázka vľavo, segment `.seg` s dvoma natívnymi rádiami vpravo; farba a fajka len na zvolenom. Do `ZAKLAD-vyber-a-prepinace` pribudne riadok „áno/nie s významom → `.seg`" (nie `.view-switch`).
- **Q2** Čitateľovo „Odoslať" tiché.
- **Q3** Pri „neuložilo sa" aj `.lnote--bad` pri otázke alebo poli s návodom.
- **Q4** Zdroje v „Pripraviť ako overenú odpoveď" ako `.sec-rows` bez vlastnej karty.
- **Q5** Citát čitateľa ako `.quote`.

## Otázky

Žiadne otvorené.

<!-- pôvodné znenie otázok:
- **Q1** — Hodnotenie v riadku: otázka vľavo, vpravo dvojdielny segment `.seg` (natívne rádiá, farba a fajka len na zvolenom). Je to nový ovládač formulára, odlišný od `.view-switch`. Do `ZAKLAD-vyber-a-prepinace` by pribudol riadok „áno/nie s významom → `.seg`“?
  **Odporúčam áno.** Šetrí miesto ako dnes, celý segment je terč a od `.view-switch` ho odlíši farba po voľbe. `.choice-row` by na dve krátke voľby zabral štyri riadky.
- **Q2** — Čitateľovo „Odoslať" tiché (`.button--quiet`)?
  **Odporúčam áno.** Na obrazovke „Opýtať sa" je plné tlačidlo na položenie otázky. Hlásenie nepresnosti je vedľajšia úloha a dve plné tlačidlá by pravidlo porušili.
- **Q3** — Pri „neuložilo sa" ukázať okrem stavu v hlavičke aj `.lnote--bad` pri otázke alebo poli s návodom, čo urobiť?
  **Odporúčam áno.** Samotné slovo v rohu ľahko prehliadnuť a hodnotiteľ by odišiel v domnení, že posudok je uložený. Hláška pri mieste chyby povie, čo kliknúť znova.
- **Q4** — Zdroje v „Pripraviť ako overenú odpoveď" ako `.sec-rows` bez vlastnej karty (dnes `.form-group` s kartou vnútri karty formulára)?
  **Odporúčam áno.** Je to rovnaká karta v karte, akú sme zrušili na karte osoby, a `.sec-rows` je na to už nasadené.
- **Q5** — Citát čitateľa ako nová `.quote` (tlmený podklad + „Čitateľ napísal"), nie `.lnote--warn`?
  **Odporúčam `.quote`.** `.lnote` je hláška aplikácie. Žltá farba by slovám čitateľa dodala váhu systémového varovania, a pritom je to len citát.

-->

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/EVAL-posudok.html + .md.
Vetva design/eval-posudok z main.

1. Rating.tsx: prop as="card"|"section" (Answer.tsx → card, /evaluation → section).
   Zrušiť Choice, fieldStyle a inline štýly. .rating-head: h3 t.heading + .rating-status
   (aria-live; saving / ✓ saved --ok-fg / saveFailed --bad-fg). Otázky div.rating-q[role=radiogroup] = span.rq-label + .seg s 2× label.seg-opt
   (natívne radio, vizuálne skryté, focus-visible na segmente), onChange → save();
   <640 otázka nad segmentom, segment 1fr 1fr, 44 px. Zvolený segment .is-ok/.is-bad podľa významu (correct 1 ok / 0 bad,
   hallucination 1 bad / 0 ok). Doplnenie <details class="rating-more" key={recordId}>
   so summary t.showDetail; polia label.field/.field-label/.field-input, onBlur save.
   Pri failed .lnote--bad pri otázke/poli, ktorého zmena neprešla.
2. ReaderPanel: .reader-row s t.readerQuestion + button.button--quiet.button--sm
   Sedí / Nesedí (aria-pressed, zvolené Nesedí .is-bad). ReportInaccuracy: .reader
   (max 560), chyba .lnote--bad, Odoslať button--quiet.
3. /evaluation: obal bez inline maxWidth; položka article.card.ev-item = .ev-main
   (.ev-head štítky + .ev-date, p.ev-q, blockquote.quote s t.readerWrote a textom
   pre-wrap, details.ev-ans) + <Rating as="section">. Štítky bez inline štýlov.
   Žiadne plné tlačidlo.
4. Pripraviť ako overenú odpoveď: section.form-group.form-group--lg, h2.form-group-head,
   p.form-group-lead; položka form.card.prep, zdroje .sec-rows bez vlastnej karty,
   tiché Uložiť; „Otvoriť kuráciu" odkaz bez šípky.
5. globals.css: .rating*, .seg, .seg-opt.is-ok/.is-bad, .reader*, .button.is-bad,
   .ev-*, .quote*, .prep, .form-group-lead (svetlá aj tmavá, 44 px na <640).
6. i18n sk/cs/en: rating.readerWrote, saveFailedHint, saveFailedFieldHint.
7. docs/design/ZAKLAD-vyber-a-prepinace.md: do tabuľky riadok „áno/nie s významom
   (posudok) → .seg (natívne rádiá, farba po voľbe), nie .view-switch".

Over 1440 svetlá + 390 tmavá (čitateľ Sedí/Nesedí, hodnotiteľ pod odpoveďou aj vo
fronte, uložené/neuložilo sa — napr. vypnutou sieťou), klávesnicou (šípky v rádiách,
Enter na summary), VoiceOver ohlási „prepínač, 1 z 2". tsc, eslint, vitest, build.
Komentáre: odkaz na EVAL-posudok (8. 10. 2026).
```
