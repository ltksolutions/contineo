# KNIZ — detail dokumentu v knižnici (`/library/[id]`)

> **Stav: rozhodnuté** 12. 10. 2026 — Q1–Q9 podľa A (používateľ: „Súhlasím").

Referencia: `KNIZ-detail-dokumentu.html`. Základ: `ZAKLAD.md`, `ZAKLAD-podmenu-a-akcie.md`, `ZAKLAD-lista-ulozenia.md` (`.more`, `.more-confirm`), `KNIZNICA-postup-znenia.md`, `KNIZNICA-akcie-dokumentu.md`, `DETAIL-starsie-znenia.md`, `EVAL-posudok.md` (`.quote`). Zdroj: `app/library/[id]/page.tsx`, `lib/versionFlow.ts`, `lib/versionResponsibility.ts`, `components/BasisTasks.tsx`, `lib/documentArchiveState.ts`, ADR-006, ADR-014, ADR-016, ADR-023, ADR-025, ADR-029.

## Čo sa mení
Detail sa navrhuje od základu. **Ostávajú** serverové akcie a ich polia: `prepareDraftAction`, `cancelApprovalAction`, `publishVersionAction`, `carryOverAssignmentsAction`, `setResponsibleAction`, `LegalBasisForm` (+ `setDraftLegalBasis`), `fixTextAction`, `reindexDocumentAction`, `reindexVersionAction`, `resyncConnectorDocumentAction`, `revokeVersionAction`, `archiveDocumentAction`, `restoreDocumentAction`; panely `?open=`, `?older=all`, existujúce texty `library.*` / `flow.*`. `/edit`, `/text`, `/chunks`, `/version`, `/faq` sa nemenia.

### 1 · Rozloženie (Q1) — SwiftUI `.inspector`
- **≥ 1024:** `.doc-grid` = obsah (`minmax(0,1fr)`) + inšpektor 340 px (sticky). Vľavo, čo sa robí: karta postupu `#flow` → `section#versions` Znenia → `section.card.more#more` Ďalšie akcie. Vpravo súhrn: **Stav**, **Potvrdenia**, **Dokument**, **Text**.
- **< 1024:** Stav hneď pod hlavičkou, zvyšok inšpektora pod Ďalšie akcie.
- Žiadne `<details>` pre nič podstatné. Ostáva len `<details>` vo vnútri panelov, kde je dnes (napr. pôvodný text pri oprave).

### 2 · Hlavička (Q6)
- `.page-head-main`: `h1.page-title` + **jeden** štítok stavu dokumentu (nové `library.state.*`): `Koncept` (`.tag--draft`) · `V schvaľovaní` (`.tag--info`) · `Schválené` · `Platí` (`.tag--published`) · `Archivuje sa` (`.tag--draft`) · `Archivovaný` (`.tag`).
- Pod ním `.meta` drobne: druh (názov z číselníka), priečinok, `t.effectiveFrom(d)` „účinné od {d}" (prvé znenie: `t.proposedFrom(d)` „navrhovaná účinnosť {d}"; archivovaný: `t.invalidFrom(d)` „neplatí od {d}"), identifikátor v `<code>`. Pri MCP `t.fromConnector(názov)` „z konektora {názov}".
- Štítok spracovania (`Spracúva sa` `.tag--info`, `Chyba spracovania` `.tag--bad`) len počas behu alebo pri chybe. „prevedené, nepublikované" a surový kód zdroja sa rušia.
- `.page-tools`: `Stiahnuť ▾` (ostáva, Q9) · tiché `Upraviť dokument` (len tu) · hlavná akcia podľa kroku, posledná:
  | Stav | Úkon |
  |---|---|
  | nič sa nepripravuje | plné `Nové znenie` |
  | krok 1 | tiché `Pokračovať v príprave` → `#flow` |
  | krok 2 | tiché `t.flow.status` „Stav schvaľovania" → `#flow` |
  | krok 3 | tiché `t.flow.publishLink` „Zverejniť…" → `#flow` (plné ostáva v karte) |
  | krok 4 | tiché `Nové znenie` (plné je „Prideliť" v karte) |
  | FAQ | plné `t.faq.edit` „Upraviť záznamy" → `/library/[id]/faq` |

### 3 · Inšpektor
- **Stav** `.card.stat`: `b` jedna veta, kto je na ťahu (`t.status.*`, odvodené z `versionFlow` + čitateľa): „Čaká sa na schválenie Agátou Galkovou" · „Nové znenie je v príprave — na ťahu ste vy" · „Schválené — na ťahu ste vy" · „Platí od {d}" · „Archivovaný od {d}". `span` podrobnosť (kolo, dátum, kto ďalej). Čitateľa oslovuje „vy", nikdy menom.
- **Potvrdenia** — percento, `.bar`, „41 z 50", po termíne, odkaz „Výkaz potvrdení" (len personalistovi — odkaz do `/hr`). Bez platného znenia jedna veta.
- **Dokument** `.lrs` > `.labeled-row` (`LabeledContent`): Druh, Priečinok, Značky, Prístup, Jazyk, Pôvod, Identifikátor — **názvy** z číselníkov a `t.access.*` / `t.language.*` / `t.origin.*` („Nahraté ručne", „Z konektora …"), nie `manual / public / sk`. Bez tlačidla úpravy.
- **Text**: PDF (konceptu, platné), Zdroj, Pôvodný súbor — názov súboru = odkaz na stiahnutie, pod ním `small` kto a kedy **menom** (nie e-mail). Päta: tiché `Editor textu` → `/text`, `Členenie` → `/chunks`. Dnešný blok 5 riadkov v Ďalších akciách sa ruší.

### 4 · Karta postupu `#flow` (Q2)
Kreslí sa ako dnes podľa `versionFlow` (kroky 1–4). Hlavička: `h2` `flow.heading` + `FlowSteps` (✓ hotové, aktuálny farbou organizácie, zamietnuté kolo ✕ červené).
1. **Pás zamietnutia** (posledné kolo zamietnuté, krok 1): `div.lnote.lnote--bad` — `flow.rejectedBy`, dôvod v `.quote`, veta `t.flow.rejectedNext`.
2. **Teraz** (`.fsec`, `t.flow.now` „Teraz" + krok):
   - krok 1: `.inset` riadky PDF · Text · Údaje o znení s tichými Vymeniť / Editor / Upraviť; schvaľovatelia `.select-row` (D110). Formulár údajov ako dnes.
   - krok 2: schvaľovatelia `.chk` (ikona, meno, oddelenie, `Čaká` / ✓ / ✕) + **jeden riadok** `t.flow.lockedLine` „🔒 PDF · text · údaje o znení — zamknuté počas kola". „Čo sa schvaľuje" a rámček „Potom" sa **rušia**.
   - krok 3: voľba prenosu (D111) + `CarryOverFields` bez zmeny.
   - krok 4: `carryOverAssignmentsAction` ako dnes.
3. **Pred zverejnením** (`t.flow.beforePublish`, `t.flow.doneOf(n,4)`) — `.inset` > `.chk` s ikonou stavu (`ok` ✓, `wait` ◷, `todo` !, `off` prázdny, `bad` ✕): **Schválenie** · **Zodpovedná osoba** · **Právny základ** · **Dátum účinnosti**. Nevyriešený (alebo meniteľný) riadok má tiché tlačidlo 44 px: `Určiť` / `Zmeniť`. Kreslí sa v krokoch 1–3.
4. **Päta** `.foot`: plné tlačidlo kroku (R2) — krok 1 `Uložiť a predložiť na schválenie` / `flow.resubmit(n)`, krok 3 `Zverejniť a prideliť` / `Zverejniť od {d}`; krok 2 plné nemá. Tiché úkony kroku ako **tlačidlá**: krok 1 `Len uložiť`, krok 2 `t.flow.withdrawOpen` „Stiahnuť kolo…", krok 3 `Zmeniť zodpovednú osobu`.
5. **História** `#history` (Q5).

### 5 · Stiahnuť kolo (Q3) — `confirmationDialog`
`?withdraw=1#flow`: v päte namiesto tlačidla `form.more-confirm` (`cancelApprovalAction`): `h3` `t.flow.withdrawTitle(n)` „Stiahnuť kolo {n}?", zoznam `t.flow.withdrawEffects` (vráti sa do prípravy a údaje sa odomknú · schvaľovateľom {mená} zmizne úloha · kolo sa zapíše ako zrušené), `textarea name="reason" required` `t.flow.withdrawReason` „Dôvod" (uvidia ho schvaľovatelia), `.button--danger` `flow.withdraw`, odkaz „Zrušiť" (adresa bez `withdraw`).

### 6 · Právny základ (Q4)
- Riadok v „Pred zverejnení": `Neurčený` (`.tag--draft`) alebo názov z číselníka · kto a kedy.
- **Kto smie** (`canSetLegalBasis()`, D155): zodpovedná osoba prípravy **alebo správca obsahu** → tiché `Určiť` / `Zmeniť` → `?open=basis#flow`, formulár (`LegalBasisForm` pre koncept) **v karte pod riadkom**; uloženie tiché, „Zrušiť" = bez `open`.
- Kto nesmie: `t.basis.byOther(meno)` „Určí {meno} — dostal(a) upozornenie".
- Čitateľ je zodpovedná osoba: `t.basis.byYou` „Určujete vy ako zodpovedná osoba." Nikdy tretia osoba o čitateľovi.
- Vždy veta `t.basis.notApproval` „Nie je súčasť schválenia — dá sa určiť aj počas kola." (D139: nezamyká sa).
- Karta úlohy zverejneného znenia (`BasisTasks`, D151) ostáva nad kartou postupu pre zodpovednú osobu, kým základ neurčí.

### 7 · História — časový rad (Q5)
`ol.tl`, najnovšie hore: predložené (kto, kolo) · schválil (zelené) · zamietol + dôvod `.quote` (červené) · stiahnuté + dôvod (sivé) · zverejnené · zmena zodpovednej osoby / základu · archivované / obnovené. Posledných 5 + `t.history.all(n)` „Celá história (N)" → `?history=all#history`. Pri prvom bežiacom kole bez inej udalosti sa nekreslí. Ten istý `ol.tl` je v paneli **História** pri znení (`?open=history`) namiesto troch rozbaľovačiek (zmeny osoby/základu, opravy údajov, opravy textu).

### 8 · Znenia (Q7) — SwiftUI `List`
`section.card#versions`, `h2` `t.versions` „Znenia" + počet:
1. **Novela vopred** — riadok so štítkom `.tag--info` `t.validFrom(d)` „Platí od {d}", rozbalený ako platné.
2. **Platné znenie** rozbalené `.vcur`: `.labeled-row` Zodpovedná osoba · Právny základ · **Prijal (orgán)** · Autor · Potvrdenia; tiché `PDF`, `Zodpovedná osoba`, `Právny základ`, `Opraviť text`, `História` → `?open=responsible|basis|fix|history#current`; `•••` (`Menu`) → `Odvolať potvrdenia…` (`?open=revoke`), `Preindexovať toto znenie` (`?open=reindex`).
3. **Staršie** — riadky z `DETAIL-starsie-znenia` (3 + `?older=all`, ponuka ••• bez zmeny).
Panely sa otvárajú pod znením ako dnes (`?open=`).

### 9 · Ďalšie akcie (Q8)
Len pre celý dokument, `.more-row` s jednou vetou a tichým tlačidlom:
- `Preindexovať všetky znenia` — `t.reindexAllNote` „Text sa nemení, potvrdenia ostávajú." (4-riadkový odsek sa ruší).
- `Skontrolovať zmeny v zdroji` — len MCP, veta: konektor · cesta · posledná kontrola.
- `Archivovať` `.button--danger` → `?archive=1#more` → `form.more-confirm` (dátum, povinný dôvod, dôsledky s počtami) ako dnes. Pri `archiveBlocked` veta s dôvodom namiesto tlačidla. Archivovaný: `Obnoviť platnosť` tiché, bez potvrdenia.
- „Opraviť text" sa z Ďalších akcií **ruší** — je pri platnom znení. Riadok Text a súbory sa presúvajú do inšpektora.

### 10 · Ostatné stavy
Tabuľka na konci `.html`: prvé znenie krok 1/3, platné + krok 2/4, novela vopred, archivovaný naplánovaný/platný, FAQ, spracovanie beží / zlyhalo (`.lnote--bad` pod hlavičkou s tichým „Spracovať znova").

## Kde
`app/library/[id]/page.tsx` (celá stránka okrem `edit: "document"`), `components/BasisTasks.tsx` (bez zmeny), `components/FlowSteps` (ak je samostatný, inak v `page.tsx`), `globals.css` (`.doc-grid`, `.insp`, `.stat`, `.chk`, `.ico`, `.tl`, `.vcur`, `.menu`), `i18n` sk/cs/en.

## Prečo
- Úlohy (stiahnuť kolo, určiť základ) boli schované v 20 px `<details>` na spodku 819 px karty — vyzerali ako poznámka.
- Čitateľ, ktorý mal úlohu, čítal o sebe v tretej osobe.
- Hlavička a metadáta mali technické kódy a dvojité „Upraviť dokument".
- Krok 2 opakoval krokovník; „Potom" nič nepridával.
- Ďalšie akcie miešali celý dokument, súbory a jedno znenie.

## Rozhodnutia v repozitári — dodržané
- Schvaľuje sa znenie, schvaľovateľ rozhoduje v `/approvals` (ADR-006). Na stránke nie je pripomínanie, komentáre ani rozhodovanie.
- Vždy jedno bežiace kolo; zrušené kolo sivé, zamietnuté červené (ADR-006, dodatok 12. 10. 2026, komentár v `page.tsx` r. 1131).
- Stiahnutie kola s povinným dôvodom (`cancelRound`, `approval.reasonRequired`).
- Údaje o znení sa zamknú počas kola (ADR-013); právny základ a zodpovedná osoba nie sú súčasť schválenia (D109, D139).
- **Kto určuje právny základ: zodpovedná osoba alebo správca obsahu** (D155, dodatok 2 ADR-023). Zadanie hovorí „správca len ako náhradník" — to platilo pred 2. 10. (D91); návrh kreslí D155. Úloha a upozornenie patria zodpovednej osobe (D151).
- Karta úlohy zodpovednej osoby je na `/library/[id]`, nie na čitateľskej karte (D151) — ostáva.
- Kým sa znenie pripravuje, Nové znenie sa nedá začať (ADR-014) — v krokoch 1–3 sa v hlavičke neponúka.
- Archivácia (ADR-025): nedá sa s rozpracovaným znením / bežiacim kolom / novelou vopred; archivovaný smie mať nové znenie; obnovenie tiché; odvolané pridelenia sa neobnovia.
- Označenie znenia sa nezadáva ani neukazuje (ADR-016); „Opraviť údaje" zrušené.
- Prenos pridelení ako voľba pri zverejnení, len personalistovi (D111, D67).
- „Prijal (orgán)", nie „Schválil" (ADR-013).
- `Stiahnuť ▾` a „Pokračovať v príprave" v hlavičke (KNIZNICA-akcie-dokumentu, 8. 10.) — ponechané, Q9.
- Potvrdenie nevratných úkonov adresou, bez modálneho okna (ZAKLAD-lista-ulozenia).

## Rámy
1. **1440 svetlá** — „Kredity z prerozdelenia príspevkov a futbalnet.shop", prvé znenie v kroku 2, 0 z 1 (Agáta Galková, IT), základ neurčený, číta Ján Letko (zodpovedná osoba).
2. **1440 svetlá** — to isté s `?open=basis#flow` (výrez).
3. **1440 svetlá** — platný predpis, nové znenie v kroku 1 po zamietnutom kole 1: pás zamietnutia, história, 2 staršie, potvrdenia 82 % (41 z 50), `archiveBlocked`.
4. **1440 svetlá** — platný bez prípravy, Znenia s platným a 4 staršími (3 + Všetky), ••• otvorená.
5. **834 svetlá** — krok 3 s prenosom pridelení, „Pred zverejnením" celé zelené, Stav hore, inšpektor dole.
6. **390 tmavá** — archivovaný predpis s novým znením v kroku 2, `?withdraw=1`, časový rad so stiahnutým aj zamietnutým kolom, „Obnoviť platnosť".
7. **390 tmavá** — Ďalšie akcie s `?archive=1` na platnom predpise z MCP konektora.

Rám 390 zo zadania je rozdelený na 6 a 7: archivovať sa nedá počas kola ani už archivovaný predpis (ADR-025), takže `?archive=1` a krok 2 nemôžu byť na jednom dokumente.

## Stav v adrese
Ostáva `?open=…#current|#flow`, `?older=all#older`, `?archive=1#more`. Nové: `?withdraw=1#flow`, `?open=basis#flow` (formulár v karte postupu pre koncept), `?history=all#history`, `?menu=<versionId>#v-<id>` (••• platného znenia — rovnako ako pri starších). Všetko odkazy a `form`, bez JS.

## Údaje, ktoré v modeli neexistujú
Nové dáta nie sú potrebné. Overiť:
1. **Udalosti časového radu** — skladajú sa z kôl (`submittedAt`, rozhodnutia, `cancelledAt` + dôvod), histórie znenia (zodpovedná osoba, základ, opravy textu), `archives[]` a `publishedAt`. Ak „Nové znenie začaté" nemá dátum, riadok vynechať.
2. **„dostal(a) upozornenie"** — overiť, že `draftResponsibleAssigned` sa poslal (D141); ak sa to nedá zistiť, len „Určí {meno}".
3. **Oddelenie schvaľovateľa** — z adresára, ak je; inak len meno.
4. **Počty v potvrdení archivácie** („36 nepotvrdených", „92 potvrdení") — z pridelení a potvrdení platného znenia; ak dotaz chýba, vety bez čísel.

## Rozhodnuté
Všetky otázky rozhodnuté 12. 10. 2026 podľa **A**.

## Otázky
**Q1 ✅ A — Jedna stránka s inšpektorom vpravo (od 1024 px), alebo záložky (Postup · Znenia · Údaje)?**
A: inšpektor · B: záložky (`SectionTabs`).
**Odporúčam A** — stav, potvrdenia a súbory treba vidieť popri úlohe, nie namiesto nej.

**Q2 ✅ A — „Pred zverejnením" ako kontrolný zoznam so štyrmi riadkami, alebo každá vec v kroku, kde sa určuje?**
A: zoznam · B: po krokoch.
**Odporúčam A** — zodpovedná osoba a základ sa dajú určiť v krokoch 1–3; zoznam ich ukáže vždy na rovnakom mieste.

**Q3 ✅ A — Stiahnuť kolo potvrdiť adresou s povinným dôvodom, alebo dnešná rozbaľovačka s dôvodom?**
A: `?withdraw=1` + `.more-confirm` · B: `<details>`.
**Odporúčam A** — schvaľovateľom zmizne úloha; rovnaký vzor ako archivácia.

**Q4 ✅ A — Formulár právneho základu v karte postupu (`?open=basis#flow`), alebo len odkaz na panel pri znení?**
A: v karte · B: panel pri znení.
**Odporúčam A** — pri prvom znení žiadne platné znenie nie je a základ patrí konceptu (D139).

**Q5 ✅ A — História ako vždy viditeľný časový rad (posledných 5), alebo zbalená?**
A: viditeľná · B: zbalená.
**Odporúčam A** — dôvod zamietnutia či stiahnutia je to, čo predkladateľ potrebuje pri ďalšom kole.

**Q6 ✅ A — V hlavičke len jeden štítok stavu, štítok spracovania len pri chybe alebo počas behu?**
A: áno · B: ponechať všetky štítky.
**Odporúčam A** — „prevedené, nepublikované" a „manual" nepovedia správcovi nič, čo by mal urobiť.

**Q7 ✅ A — Platné znenie rozbalené so zriedkavými úkonmi v •••, alebo všetky úkony ako tlačidlá?**
A: ••• pre Odvolať a Preindexovať · B: všetko tlačidlá.
**Odporúčam A** — odvolanie potvrdení je zriedkavé a s následkom; nemá stáť vedľa PDF.

**Q8 ✅ A — Ďalšie akcie len pre celý dokument (súbory do inšpektora, Opraviť text len pri znení)?**
A: áno · B: ponechať dnešné riadky.
**Odporúčam A** — „Opraviť text" bol na dvoch miestach a riadok súborov nie je úkon.

**Q9 ✅ A — „Stiahnuť ▾" v hlavičke ponechať aj popri súboroch v inšpektore?** *(mení KNIZNICA-akcie-dokumentu, ak B)*
A: ponechať · B: zrušiť, súbory len v inšpektore.
**Odporúčam A** — na telefóne je inšpektor až na konci stránky a PDF je najčastejší úkon.

## Prompt pre Claude Code
```
Prečítaj design_handoff_contineo_intranet/KNIZ-detail-dokumentu.md a .html
a prestav app/src/app/library/[id]/page.tsx podľa neho (Q1–Q9 rozhodnuté
podľa A, 12. 10. 2026).
- Serverové akcie a ich polia nemeň. /edit, /text, /chunks, /version, /faq
  nemeň. Existujúce texty ponechaj, nové pridaj do sk/cs/en podľa .md.
- Rozloženie .doc-grid (obsah + inšpektor 340 px od 1024 px; pod 1024 px
  Stav hore, zvyšok dole). Triedy: .labeled-row, .lnote, .task-card,
  .more-row, .more-confirm, .empty, FlowSteps; nové .stat, .chk, .ico, .tl,
  .vcur do globals.css z tokenov (svetlá aj tmavá).
- Karta postupu: Teraz / Pred zverejnením / päta (R2) / História. Žiadne
  <details> pre Stiahnuť kolo, Právny základ, Históriu, Zmeniť zodpovednú osobu.
- Nové adresy: ?withdraw=1#flow, ?open=basis#flow, ?history=all#history,
  ?menu=<id>. Bez JavaScriptu.
- Právny základ: canSetLegalBasis() (D155) rozhoduje o „Určiť"; čitateľa
  oslovuj „vy".
- Najviac jedno plné .button na obrazovke; terč 44 px pod 1024 px.
- Testy: vykreslenie v stavoch z tabuľky „Ostatné stavy" a rámov 1–7.
Zapíš do docs/DEVLOG.md a do github.md v Claude Design.
```
