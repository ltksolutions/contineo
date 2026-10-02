# Devlog — Contineo

> Denník práce. **Nie je to `CHANGELOG.md`.** Changelog hovorí, *čo sa zmenilo*
> a je písaný pre toho, kto sa na projekt pozrie o rok. Devlog hovorí, *ako to
> šlo* — čo sa rozhodlo a prečo, čo nevyšlo, čo stálo čas a čo by som nabudúce
> urobil inak. Zápis vzniká na konci pracovného dňa.
>
> Založené 2026-09-15. Staršie dni zapísané nie sú; ich stopa je v `CHANGELOG.md`
> a v `git log`.

---

## 2026-10-01 — čas po prvý token, `/dpo` naostro, námietka po prihlásení (PR #205–#216)

**Čas po prvý token (D9).** Na 26 hodnoteniach mal TTFT medián 5,2 s
a p95 9,7 s; zmerané fázy vysvetlili len polovicu. Fáza 1 (PR #205)
doplnila meranie podotázok a hlavného modelu. `ratings_overview.mjs`
čítal rozpad zo starého poľa `casy` a vypisoval ho vždy prázdny. Fáza 2
(PR #209): podotázky súbežne s hlavným hľadaním a strop prepisu otázky
2,5 s. Pôvodne navrhnutých 1,5 s by podľa nameraných časov zahodilo
prepis pri ~40 % otázok — rozhodlo sa podľa čísel, nie podľa plánu.
**Nález:** udalosť `done` posielala `tokeny` a `naklad`, klient čítal
`tokens` a `cost`, takže žiadne hodnotenie nemalo tokeny ani cenu.
Výsledok: najväčšia položka je hlavný model (2,8–6,2 s po prvý token pri
vstupe ~8–9 tis. tokenov), nie prepis; fáza 3 sa rozhodne podľa
hodnotení.

**Uložená odpoveď `/ask/a/[id]` padala v produkcii** od 30. 9. (PR #206):
serverová stránka volala `answerHasCitations()` z `"use client"` modulu.
Prešli tsc, eslint, testy aj build. Pribudol `clientBoundary.test.ts`,
ktorý túto triedu chýb hľadá staticky (len `src/app/` — v `lib/` by
hlásil planý poplach, `peopleSearch.ts` je čisto klientsky).

**`/dpo` naostro.** Výkaz a CSV sedeli počtom riadkov, ale nie počtom
pri oprávnenom záujme (2 verzus 4): kombinácia „BOZP + interná smernica"
má hlavný druh zákonnú povinnosť a CSV ostatné zamlčalo — PR #214 pridal
stĺpec `categories`. Námietku Ján podal za seba a zamietol; testovaciu
osobu (môj návrh) odmietol ako zbytočnú — zamietnutie nič nemaže a výmaz
pokrývajú testy. Mal pravdu.

**D153 a D154 vznikli za pochodu z Jánovej spätnej väzby:** námietka len
od prihlásenej osoby alebo e-mailom na `gdpr@futbalsfz.sk` (kontakt
v nastaveniach), potom piata dlaždica a zvonček, potom presun lehôt
a doplnku do záložky GDPR. Pri presune bolo podstatné, že lehoty podľa
D136 nastavuje DPO, nie správca osôb — záložka je preto pre DPO na úpravu
a pre správcu len na čítanie. Dlaždicu námietok o hodinu neskôr nahradil
pás z výkazu DPO s hľadaním (PR #218, druhá session).

**Čo nevyšlo:**

- Prvé úpravy opravy #206 skončili v hlavnej pracovnej kópii namiesto
  vo worktree: `cd` do worktree platil len v jednom príkaze a ďalší
  `python3` bežal v `app/` hlavnej kópie. Presunuté pred commitom, `main`
  čistý. Odvtedy cesty do worktree absolútne v každom príkaze.
- Tri e-maily pri prvej námietke prekvapili: DPO je zároveň podávajúci
  a kontakt `gdpr@` je iná adresa, takže upozornenie dostal dvakrát.
  Podľa návrhu; ponechané.

**Večer — zvyšok naostro.** Druhá námietka overila zvonček, e-maily
a potvrdenie. Záložku GDPR očami správcu osôb bez roly DPO Ján vyskúšal tak,
že si rolu DPO dočasne odobral (ako správca osôb si ju vie vrátiť sám).
Opačný variant — DPO bez správcu — sa naostro neskúšal: správcu osôb by si
cez aplikáciu nevrátil. Upozornenie DPO prišlo aj na jeho osobnú adresu,
hoci rolu už nemal — audit ukázal, že ju odobral minútu **po** podaní.
Dátum skončenia čaká na prvý skutočný odchod: vyradiť niekoho kvôli testu by
spustilo lehotu jeho dokladov.

---

## 2026-10-02 — časti nastavenia organizácie na vlastných cestách

**Zadanie (Ján):** časť nastavenia má mať cestu, nie `?tab=`. Po
ZAKLAD-zalozky ukazovala cesta pod hlavičkou názov časti len vtedy, keď
`?tab` prišiel, a `/organisation` na počítači otváralo prvú časť, na
telefóne rozcestník — tá istá adresa, dva rôzne obsahy. Rozhodnutie:
možnosť 1, `/organisation` je rozcestník na každej šírke.

- `/organisation/{section}` (`[section]/page.tsx`, presunutý obsah),
  neznáma časť 404. DPO bez roly správcu: rozcestník ho pošle na
  `/organisation/gdpr`, iné časti sú 404 (dovtedy ticho dostal GDPR).
- Starý `?tab=` (aj `?zalozka=` a staré hodnoty) prekladá `proxy.ts`
  307 na cestu, ostatné parametre nesie (`legacyOrgSection` v
  `lib/orgSections.ts`). Uloženie formulára vracia na cestu časti.
- Cesta sa skladá sama z adresy (`title` + `trail`); pomôcka `leaf`
  v `AppShell` z #221 je preč.
- `revalidatePath("/organisation", "layout")` — bez druhého argumentu by
  sa týkal len rozcestníka, nie stránok častí.

---

## 2026-10-01 — záložky a nastavenie organizácie (ZAKLAD-zalozky)

**Záložky:** aktívna mala to isté pozadie ako ostatné a 2 px čiaru, ktorá
sa cez `margin-bottom: -3px` prekrývala s okrajom lišty. Teraz podklad
`--accent-soft` a pruh `box-shadow: inset` (neposúva text), lišta s novým
tokenom `--line-strong`. Platí pre všetky `.tabs` naraz.

**`/organisation`:** osem záložiek sa nezmestilo ani na 1440 (stĺpec
720 px), na telefóne bolo vidieť dve a pol. Teraz zoznam častí v štyroch
skupinách — od 1024 px vľavo, pod tým rozcestník a časť ako samostatná
obrazovka s odkazom späť. Server vie, či prišiel `?tab`, takže to prepína
CSS (`org-set--index`), bez JavaScriptu.

**Čo bolo treba navyše:**

- `TabLink` dostal voliteľnú triedu, aby položky zoznamu mali stav
  načítavania ako záložky; pruh je pri nich zvislý vľavo a stlmí sa
  `.org-body`.
- Názov časti v ceste (Q2): cesta sa skladá z adresy a `?tab` v nej nie je.
  `AppShell` dostal `leaf` — krok za stránkou. Bez `?tab` sa nepridáva:
  na telefóne je to rozcestník, nie časť.
- Test GDPR záložky čakal pri DPO bez roly správcu odkaz na `?tab=gdpr`;
  pri jedinej časti sa navigácia podľa návrhu nekreslí vôbec.

---

## 2026-10-01 — čitateľný prázdny stav (ZAKLAD-prazdny-stav-citatelnost)

`.empty` mal prerušovaný okraj `--line` priamo na sivom `--bg` a bez
pozadia — rámik nebolo vidieť a popis v 13 px vyzeral ako poznámka.
Teraz biela karta s plným okrajom, titulok 16 px, popis 14 px. Jedna
trieda, ~30 obrazoviek naraz.

Q1: história otázok a hodnotenie odpovedí mali vlastný prázdny stav
(holá veta, resp. karta s dvomi odsekmi) — prevedené na `.empty`.
História dostala druhú vetu (`emptyText`, `emptyFilterText`, sk/cs/en);
doterajšia veta sa rozdelila na titulok a popis. Knižnica pre bežnú osobu
mala `<p className="empty">` bez titulku — teraz titulok.

Q2: na `/dpo` ani v `learning/manage/[courseKey]` `.empty` nestojí v `.card`,
takže nové `.card .empty` (bez rámu v ráme) sa ich netýka.

---

## 2026-10-01 — výkaz DPO s hľadaním (DPO-vykaz-hladanie)

**Zadanie:** 13 riadkov výkazu pod sebou, 11 s rovnakým nedostatkom a tou
istou zodpovednou osobou. DPO hľadal predpis očami a každej osobe písal
zvlášť. Rozhodnuté Q1–Q5: dlaždice preč, počty pri filtroch, predvolene
podľa osoby, CSV vždy celé, `mailto:` so zoznamom do 25 predpisov.

**Čisté funkcie v `lib/dpo.ts`** (`parseDpoQuery`, `filterLegalBasisRows`,
`dpoFacets`, `groupByPerson`, `personMailto`, `dpoHref`, `highlight`),
stránka ich len skladá. Počty sa rátajú ako facety knižnice — každá
skupina bez vlastného filtra, inak by pri „S nedostatkom" stálo pri
„V poriadku" nula a nedalo by sa vedieť, čo prepnutie prinesie.

**Čo nebolo zrejmé:**

- `highlight` z `lib/peopleSearch.ts` sa na serveri použiť nedá: `fold`
  berie z `MultiSelect.tsx`, ktorý má `"use client"`, a funkcia z klientskeho
  modulu je v serverovom komponente len odkaz, nie funkcia. `lib/dpo.ts`
  má preto vlastnú, rovnakú.
- Spoločné CSS skrýva `.view-switch` pod 640 px (v knižnici prepína
  tabuľku, ktorá sa na telefón nezmestí). Na `/dpo` prepína len skupiny
  kariet, takže tu ostáva — rám 390 ho má.
- `.button--sm` z návrhu v kóde nie je; malé tlačidlo je `.dpo-button-sm`
  (32 px, na telefóne 44).

---

## 2026-10-01 — hlavička na šírku obsahu (SHELL-hlavicka-sirka)

**Zadanie:** avatar v hlavičke končil stovky pixelov pred pravým okrajom
cesty a obsahu. Pole otázky má strop 600 px a v riadku za ním nebolo nič,
čo by zvonček a avatar odtlačilo doprava. Rozhodnuté Q1 B: pole do stredu,
dve prázdne medzery okolo neho.

**Návrh nestačil doslova.** S `flex: 1 1 0` na medzerách a `flex: 1 1 240px`
na poli si voľné miesto rozdelili tretinou a pole na 1440 skončilo na
428 px namiesto 600. Pole preto od 640 px dostalo `flex-grow: 999` —
najprv dorastie do stropu, medzery berú zvyšok. Pod 640 px sa medzery
nekreslia vôbec: aj s nulovou šírkou by každá pridala `gap` do riadka,
ktorý je na telefóne najtesnejší.

**Ikona menu:** návrh rátal s tlačidlom 36 px (posun −9 px), v kóde má
40 px, takže posun je −11 px. Zmerané: glyf aj nadpis začínajú na
rovnakom pixeli (1440 aj 834).

---

## 2026-09-30 – 10-01 — test potvrdzovania naostro (PR #196–#208)

**Zadanie (Ján):** otestovať potvrdzovanie pri pridelení osobe, oddeleniu
a cez trasu — automaticky aj naostro. Naostro na `sfz:test_znenia`, cieľom
Ján; Oddelenie IT znamenalo aj Agátu Galkovú a Branislava Rozboru (ten
pribudol do oddelenia v ten istý deň o 15:03, preto náhľad hlásil 3, nie 2).

**Automatický test najprv.** `acknowledgementAudiences.test.ts` púšťa
skutočný kód reťaze (pridelenie → `acknowledgementDuties` → `acknowledge`
→ `duties`) nad pamäťovou kolekciou, ktorá **vyhodnocuje podmienky dotazu**.
Doterajšie testy si susedov podvrhovali, takže dotaz `assignmentsForPerson`
a `matchesAudience()` sa spolu nikdy neskúšali. Test hneď našiel chybu:
pri prideleniach mimo trás sa D50 neuplatnilo (nováčik mal dátum spred
príchodu) a termín bral posledné pridelenie, nie skoršie (#196).

**Naostro sa ukázalo, čo testy nevidia** — a takmer každý krok niečo:

- **Náhľad PDF bol prázdny všetkým** — `frame-ancestors 'none'` z hlavičiek
  N4 platí aj pre `<object>` (#197). Potom Ján na telefóne: PDF sa tam
  zámerne nevkladalo → pdf.js po stranách (#199, robil to paralelný agent
  vo worktree; konflikt s #198 som riešil zlúčením `main`). Text na
  vyhľadávanie pri potvrdzovaní odišiel (#200) — potvrdzuje sa PDF.
- **Formulár na právny základ na čitateľskej karte** (ADR-023 D140) Jána
  mýlil → **D151**, presun na kartu v správe. Prekážka: Michaela Žikavská je
  zodpovedná osoba, nie správkyňa obsahu → obmedzený pohľad len s jej
  úlohou (#198). Zvonček vedie tam.
- **„Odvolať pridelenie" jedným kliknutím** — po odvolaní sa karty posunú
  a druhé kliknutie na to isté miesto odvolalo iné pridelenie. Stalo sa
  dvakrát (17:26 a 17:30) — najprv som to považoval za dvojité odoslanie,
  audit ukázal dve rôzne pridelenia, každé z inej karty. Potvrdzovacia stránka s popisom
  dôsledkov a dôvodom do auditu (#201). Pri tom „publikum" → „adresát":
  slovo z kódu sa dostalo do hlásení.
- **Formulka v mužskom rode pre každého** — chytené pred Agátiným
  potvrdením, ktoré by sa uložilo navždy (D28) → **D152** (#203). Agáta
  potom potvrdila s „oboznámila".
- **Dvojité potvrdenie** — Agáta z iPhonu a o 9 s z Macu, dva záznamy.
  Unikátny index chráni len súbežné kliknutia; od odvolania (12. 9.) je
  ďalší cyklus „počet + 1". `acknowledge()` teraz odmietne, kým platí
  potvrdenie (#208). V databáze je to jediná duplicita.
- Drobnosti: pätička e-mailov Contineo.app, presmerovanie po potvrdení
  (#202), menu 9 bodiek na 1920 px pri okraji okna (#204, z TeamViewera
  u Branislava).

**Čo nevyšlo.** Vercel po zlúčení #204 nevytvoril produkčné nasadenie —
pomohol prázdny commit. Pri odvolávaní som pred klikom overil identitu
formulára (skrytý `id`), nie len poradie tlačidiel — v zozname, ktorý sa
po úkone prekreslí, je poradie nespoľahlivé. Ján omylom potvrdil najprv
Pracovný poriadok namiesto skúšobného — ukázalo to aspoň, že ostrá norma
sa potvrdzuje správne (odtlačok PDF sedí).

**Nabudúce.** Overovať zápisy cez skutočný kód (`acknowledgementDuties`,
`duties` s `ts-hook`, len čítanie) — dáva presne to, čo obrazovka, a vidno
pôvod každej povinnosti. Pred testom naostro preveriť, koho sa publikum
naozaj týka (náhľad dopadu), a ktoré zápisy sú nezmazateľné.

---

## 2026-09-30 — menu v hlavičke, lišta pre každého rovnaká (SHELL-menu-v-hlavicke)

**Rozhodnutia (Ján, 30. 9. 2026, Q1–Q5 v `docs/design/SHELL-menu-v-hlavicke.md`).**
Tlačidlo 9 bodiek je **v hlavičke vľavo pred logom** na každej stránke,
aj na Prehľade (Q1 A) — mení **SHELL-rozcestnik Q3/Q5** (ikona bola v páse
cesty, na Prehľade teda chýbala). Pred ním je „Preskočiť na obsah" (Q2).
Lišta na telefóne je **Prehľad · Knižnica · Vzdelávanie · Úlohy · Menu**
u každého (Q3–Q5) — mení **rám LEARNING Q1 z 27. 9.** (Vzdelávanie na 3.
mieste len bez Knižnice). „Opýtať sa" z lišty odišlo, otázka je v hlavičke.

**Dve otázky počas práce (Ján, 30. 9.).**

- **Knižnica pre každého — rozpor s predpokladom návrhu.** Návrh počítal
  s tým, že „nie každý uvidí všetky dokumenty" podľa `accessLevel`. V kóde
  platí D90 (`canSeeDocument()`): v organizácii smie každý čítať každý jej
  dokument, `accessLevel` rozhoduje len o verejnom webe. Rozhodnutie: bežná
  osoba vidí **platné dokumenty organizácie** (`readableDocuments()` —
  platné znenie dnes, bez konceptov a archívu) a riadok vedie na čitateľský
  detail `/documents/{id}`. Správca obsahu má `/library` ako doteraz;
  `/library/{id}` bez roly presmeruje na `/documents/{id}` (tam 404 pre
  cudzí dokument).
- **Kontakt prevádzkovateľa** pri vypnutom Vzdelávaní: `office@ltk.solutions`
  (`OPERATOR_CONTACT` v `lib/learning.ts`).

**Čo sa spravilo.**

- `lib/appNav.ts`: Knižnica a Vzdelávanie v `navItems()` pre každého;
  nové `tabbarKeys()`/`inTabbar()`, `menuCount()` (odznak „Menu" = súčet
  sekcií mimo lišty), `menuGroups()` = celé menu (Hlavné · Organizácia ·
  Správa) pre plachtu aj `/more` (Q4), `menuColumns()` s textami.
- `SectionsSheet`: `MenuPanel` (spoločný obsah), plachta v hlavičke
  (`<details>`, 40 × 40, pod hlavičkou vľavo, závoj od spodku hlavičky),
  `BottomMenu` — spodná plachta nad lištou (úchyt, ×, závoj medzi
  hlavičkou a lištou, potiahnutie nadol, Esc, výber, zmena stránky).
- Menu pre hlavičku skladá `layout.tsx` zo `shellNavData()` (`cache()`, bez
  dotazov navyše); `<main id="content">` je cieľ preskočenia.
- „Menu" v lište: bez JS odkaz na `/more`, so skriptom tlačidlo
  s `aria-expanded`. Pás cesty je len cesta.
- `/learning` pri vypnutom module: úvodná obrazovka namiesto 404; správca
  organizácie (rola správy osôb) vidí aj kontakt. Podstránky modulu ďalej 404.
- 834: názov organizácie v hlavičke ustúpi poľu otázky.

**Overenie.** tsc, eslint (baseline), vitest, build; stránka z ozajstných
`Header`, `SectionsSheet`, `Breadcrumbs`, `AppNav` a `globals.css` — plachta
na Prehľade aj podstránke (1200, 834), poradie Tab (preskočenie → menu →
logo → pole), lišta a spodná plachta (390, Esc), bez JS (`<details>`,
„Menu" → `/more`); `/learning` vypnuté a čitateľská Knižnica vykreslené
so zamockovanými dátami, svetlá aj tmavá.

---

## 2026-09-30 — história otázok (ASK-historia-otazok)

**Rozhodnutia (Ján, 30. 9. 2026, H1–H4 v `docs/design/ASK-historia-otazok.md`,
a dve doplnené počas práce).**

- **H1** zdroj histórie je `evaluations`, nová kolekcia nie je. **Rozpor
  s repozitárom:** návrh počítal s `reviewer` ako „kto sa pýtal", ale
  `saveVerdict()` doň pri posudku zapíše hodnotiteľa (a `evaluation.ts`
  pritom tvrdí opak). Ján rozhodol: **nové pole `askedBy`** zapisované
  v `recordAnswer()`; staršie záznamy bez neho podľa `reviewer`, len kým
  neboli posúdené. Posúdené staršie záznamy sa v histórii neukážu — autor
  sa spätne nedá zistiť.
- **H2** `evaluations` idú do retencie, `answersMonths` (predvolene 12,
  1–60) v nastavení organizácie. **Doplnené:** kurované záznamy
  (`curation`) sa nemažú — je z nich overená odpoveď v indexe a podľa nich
  sa archivuje; po lehote im zmizne len väzba na osobu (`askedBy`,
  `reviewer`, `readerNoteBy`). Skrytie z histórie nie je výmaz.
- **H3** uložená odpoveď — kto sa pýtal a rola s hodnotením, inak 404.
- **H4** po `done` `replaceState` na `/ask/a/{id}`.
- **Pred nasadením schváliť s DPO** — zapísané v TODO; PR sa dovtedy
  nezlučuje.

**Čo sa spravilo.**

- `lib/askHistory.ts` (+ `askHistoryMatch.ts`): zoznam po stranách,
  hľadanie slov bez diakritiky (AND, v aplikácii — regex v Mongu
  diakritiku neignoruje), posledných 5 rôznych otázok, skrytie / vrátenie
  jednej aj všetkých (s rovnakým `hiddenAt`, aby „Vrátiť" vrátilo práve
  tie), `answerForViewer()`. Indexy `{companyCode, askedBy|reviewer,
  createdAt}`.
- `GET /api/ask/history`, `POST …/{id}/hide|unhide` pre plachtu; stránka
  `/ask/history` má serverové akcie — × aj „Vymazať celú históriu" (s
  potvrdením v adrese) fungujú bez JS. Oznam „Vrátiť" zmizne po 5 s.
- Plachta: „Nedávne otázky" / „Z vašich otázok", ↑/↓ + Enter otvorí
  uloženú odpoveď, × s „Vrátiť", odkaz „Celá história".
- `/ask/a/{id}`: rozloženie ako živá odpoveď, bez značiek, pás s dátumom
  a novým znením (`lib/savedAnswer.ts` — porovnanie začiatku účinnosti
  zdroja s dnes platným znením cez `effectiveVersion()`), „Opýtať sa znova".
- Retencia: `purgeAnswers()` v `runRetention`, `retention_log` s dôvodom
  `answers` (bez osoby). DPO nastaví lehotu v Ochrane údajov; `/privacy`
  má riadok o otázkach, `PRIVACY_NOTICE_VERSION` 30. 9.
- `docs/C2_…` činnosť 3: účel, kategórie, lehota.

**Počas práce opravené v kroku 2 (PR #192).**

- „Otvoriť v knižnici" viedol na `url` zdroja — to je originál mimo
  aplikácie. Zdroj nesie `documentId` a odkaz ide na `/documents/{id}`.
- Klient posielal pri uložení odpovede aj polohu `at` a API ju uložilo.
  Odrezáva sa — uložená odpoveď ju podľa Q1 nemá.

**Overenie.** Pozri PR — vykreslenie `/ask/history` a `/ask/a/{id}` so
zamockovanou databázou, plachta s históriou cez podstrčené API.

---

## 2026-09-30 — odpoveď v dvoch stĺpcoch (ASK-odpoved-dva-stlpce)

**Rozhodnutia (Ján, 30. 9. 2026, Q1–Q2 v `docs/design/ASK-odpoved-dva-stlpce.md`).**
Poloha značky `[n]` sa berie z okamihu, keď citácia prišla: `sseClient`
zapíše `at = text.length` a značka ide na najbližší koniec vety — bez zmeny
servera a schémy (Q1). Technické údaje sú zbalené a len pre roly
s hodnotením (Q2).

**Čo sa spravilo.**

- `sseClient`: `at` pri udalosti `citation`; k citáciám z `done` sa doplní
  podľa poradia (server posiela ten istý zoznam — `llmGenerator.ts`).
- `formatText`: `groupCitations()` (zlúčenie aj s číslom pre každú pôvodnú
  citáciu), `citationEnd()`, `sentenceStart()`, `markCitations()` — zarážky
  zo súkromnej oblasti Unicode vložené pred rozkladom na bloky.
  `FormattedText` z nich kreslí `<button class="cite">` a `span.cite-sentence`.
- `Answer.tsx` rozdelený na `AnswerBody` (karta) a `AnswerAside` (doslovné
  citácie, zdroje v kontexte, technické údaje). Citácia: číslo, úryvok,
  dokument · článok · znenie, „Otvoriť v knižnici" na `/documents/{id}`
  (citácia ↔ zdroj cez `chunkIndex + 1`). Zdroj preto nesie `documentId`
  (`buildSources`) — dovtedy mal len `slug` (stratový) a `url`, čo je
  originál mimo aplikácie; prvý pokus viedol odkaz práve tam. Pás vľavo odišiel.
  `default export` ostáva ako jeden stĺpec (testy, uložená odpoveď).
- `Search`: mriežka `.ask-layout` — ≥ 1180 px a citácie (alebo beh) → dva
  stĺpce 1fr / 400, pravý `sticky`; inak otázka a odpoveď, citácie,
  hodnotenie pod sebou. Prepojenie značka ↔ citácia delegovanými udalosťami
  (prejdenie, fokus, klik pripne); 640–1179 klik posunie na citáciu,
  < 640 `CitationSheet` zospodu s listovaním.

**Nefungovalo / poučenie.**

- **Skratky.** Prvý tvar konca vety („bodka a medzera") by značku postavil
  za „čl." v „čl. 18 ods. 2" — v predpisoch v každej druhej vete. Koniec
  vety je preto bodka, medzera **a veľké písmeno** (alebo koniec riadku).
- Citácia prichádza raz pred textom vety, raz za ním. Keď text pred `at`
  končí vetou (aj s medzerou za bodkou), patrí značka k nej, nie k ďalšej.
- `CitationSheet` mal `onClose` v závislostiach efektu — pri každom
  prekreslení `Search` (prejdenie myšou) sa efekt spustil znova a fokus
  skočil späť na značku. `onClose` je v `ref`.
- Overenie: stránka z ozajstných komponentov a `globals.css`, `/api/chat`
  nahradený prúdom udalostí s citáciami medzi vetami. 1200/1440 (dva stĺpce,
  pripnutie), beh s pribúdajúcimi citáciami, adaptér bez citácií (jeden
  stĺpec), 834 (posun na citáciu), 390 (spodná plachta, Esc), tmavá téma,
  fokus z klávesnice. Ozajstný model som nespúšťal.

---

## 2026-09-30 — otázka z hlavičky, `/ask` s behom (ASK-otazka-z-hlavicky)

**Rozhodnutia (Ján, 30. 9. 2026, Q1–Q4 v `docs/design/ASK-otazka-z-hlavicky.md`).**
Pole v hlavičke je **jediné miesto na otázku** — hero pole na `/ask` aj na
Prehľade robili to isté na troch miestach (Q3). V poli je **značka Continea
18 px** namiesto bubliny `ask` (Q1) — mení `ZAKLAD.md`, odchýlku B; poznámka
je tam. Z `/ask` odišli „Nevybavené žiadosti" (`PendingWidget`, D36 platilo
pre `/ask` ako úvodnú stranu) a úvod testovacieho rozhrania (Q2). V záložke
je „{stránka} · {organizácia}" namiesto „Contineo — testovacie rozhranie" (Q4).

**Čo sa spravilo.**

- `HeaderAsk.tsx`: pole 40 px / r20 / max. 600. Klik, fokus alebo `⌘K`
  otvorí na mieste plachtu `AskSheet.tsx` (textarea do 6 riadkov, Enter /
  Shift+Enter / Esc, počítadlo od 800, veta o odpovedaní, vzory, ktoré
  otázku vložia, neodošlú). Závoj je v `body` pod hlavičkou (z-index 9 < 10),
  hlavička ostáva nezatienená. Pod 640 px celá obrazovka s tlačidlom dole.
  Bez JS ostáva obyčajný `GET` formulár.
- `/ask?q=`: `Search` spustí beh pri pripojení (raz — `ref` proti dvojitému
  efektu v StrictMode). Nadpis je otázka, pod ňou „Upraviť otázku" a čas.
  „Upraviť otázku" je **`<label>` poľa v hlavičke**: klik pole zameria, fokus
  otvorí plachtu s otázkou — bez spoločného stavu medzi `layout.tsx`
  a stránkou. `/ask` bez `q`: nadpis, veta a plachta vložená do stránky; je
  to `GET` formulár, takže odošle aj bez JS.
- Hlavička odpovede „Odpoveď z dokumentov {skratka}".
- Favicon: `icon.svg`, `favicon.ico`, `apple-icon.png` z `web/app/` do
  `app/src/app/` — v aplikácii dovtedy neboli vôbec, hoci ich `proxy.ts`
  z presmerovania vynechával.
- Záložka: `lib/pageTitle.ts` — posledný krok cesty (sekcia) + názov
  organizácie, adresa z tej istej hlavičky ako cesta pod hlavičkou. Vlastný
  názov knižnice („Knižnica dokumentov — Contineo") odišiel.
- Preč: `PendingWidget.tsx`, `home.heading/intro`, `ask.placeholder/stop/
  searching/askAgain/askThis`, `overview.lede/askPlaceholder/ask/suggestions`
  a CSS `.ask-hero`, `.ask-field`, `.overview-ask`… **`pending.*` ostáva** —
  číta ho `lib/pending.ts`.

**Odchýlky od návrhu.**

- Veta v plachte: „Odpoveď sa skladá len z dokumentov **organizácie
  {názov}**." Návrh má genitív („zväzu"), ten sa z názvu organizácie
  poskladať nedá.
- Nadpis `/ask` bez otázky je „Opýtať sa", ale sekcia v ceste aj v záložke sa
  volá tak ako v navigácii („Voľné otázky").
- Prehľad nemá pod oslovením vetu „Traja ľudia od vás niečo čakajú" z rámu —
  taký súhrn dnes neexistuje; oslovenie ostáva samo nad KPI.

**Nefungovalo / poučenie.**

- Plachta na telefóne je `fixed` v hlavičke, ktorá je `sticky` so
  `z-index: 10` — spodná lišta (25) jej prekryla tlačidlo. Kým je plachta
  otvorená, lišta sa skryje (`body:has(.ask-sheet--overlay)`).
- Globálny prstenec fokusu (`:where(…textarea…):focus-visible`) kreslil rám
  okolo poľa vnútri plachty.
- Vypnuté tlačidlo pri prázdnom poli by bez JS zablokovalo vloženú plachtu
  na `/ask` — vypína sa až po načítaní skriptu.
- Overenie: stránka zložená z ozajstných `Header`, `HeaderAsk`, `AskSheet`,
  `Search`, `Answer`, `AppNav` a `globals.css` mimo repa; `/api/chat`
  nahradený prúdom udalostí v tom istom formáte (SSE), takže beh išiel cez
  ozajstný `sseClient`. 1440 / 834 / 390, svetlá aj tmavá, bez JS. Ozajstnú
  aplikáciu s modelom som nespúšťal — beh zapisuje hodnotenie do produkčnej
  databázy.

---

## 2026-09-30 — odkazy „← Späť" odišli, nesie ich cesta

**Rozhodnutie (Ján, 30. 9. 2026).** Po rozcestníku mali hlbšie stránky dve
cesty k rodičovi: pás cesty pod hlavičkou a vlastný odkaz „← Späť na …"
nad nadpisom. Odkaz sa ruší — cesta vedie na to isté miesto a navyše
ukazuje, kde človek je.

**Čo sa spravilo.** Odstránené z 24 stránok: knižnica (detail a úprava
normy, text, nové znenie, nová norma, trasa, priečinky, kurácia), Na
potvrdenie (detail), personalistika (pridelenie, jeho upozornenie,
Prideliť normy, pripomienky), osoby (detail, nová, import, pozvánka),
správa tenantov (nový, detail) a Vzdelávanie (kurz, certifikát, test,
výsledok, správa kurzu, test v správe). S nimi odišli importy `Link`,
ktoré tam iné použitie nemali, a trieda `.detail-back`.

**Čo zostalo zámerne.** Tlačidlá, ktoré sú **akciou po dokončení**, nie
orientáciou: „Späť na časť" vo výsledku testu, „Späť na kurz" pri
certifikáte a v jeho tlačovej verzii. A stránkovanie častí kurzu
(`.pnav` — „← Späť na kurz · Časť 2 z 5 · Ďalšia časť →"): je to pager,
jeho prvý odkaz nesie rovnováhu riadku a čítanie kurzu po častiach.

---

## 2026-09-29 — znenia na karte dokumentu, preindexovanie a oprava textu (D150)

**Čo sa spravilo.** Tri fázy na Jánovu otázku „pri starších zneniach nemáme
možnosť preindexovať“ (PR #183–#186).

- **Fáza 1 — karta ukazuje znenia podľa platnosti.** „Platné znenie“ = platné
  dnes (`effectiveVersion()`), nová karta **Pripravované znenie** pre novelu
  vopred, staršie len minulé. Rozdelené na `current` (zobrazenie) a `latest`
  (postup nového znenia).
- **Fáza 2 — `reindexVersion()`.** Preindexuje jedno znenie a dotkne sa len jeho
  úsekov; aktívne členenie ostáva jedno (naposledy zverejnené). V ponuke ⋯ pri
  každom znení „Preindexovať“, v Správe „Preindexovať všetky znenia“.
- **Fáza 3 — oprava textu platného aj pripravovaného znenia (D150, dodatok
  k ADR-007).** „Opraviť text“ pri znení nahrá jeho text do editora, blok opravy
  povie, ktoré znenie opravuje; minulé sa neopravuje (D78).
- Hlásenie o novej verzii portálu je všeobecné (Ján): „Obnovením stránky
  prejdete na ňu.“
- Naostro na `sfz:test_znenia`: karta, oba spôsoby preindexovania (bez zápisu),
  oprava interpunkcie v čl. 7 novely — dotkla sa len novely.

**Nefungovalo / poučenie.**

- **Chyba, ktorú nikto nehlásil:** karta aj `reindex()` a `fixText()` brali
  „platné“ ako naposledy zverejnené (`isActive`). Pri novele vopred karta
  ukazovala budúce znenie ako platné a dnes platné medzi staršími s vetou
  „Ľudia ich už nevidia“; preindexovanie a oprava by išli do budúceho znenia.
  Vzniklo to D143 (nahradené platí ďalej) — stránka pre čitateľa bola
  opravená, karta nie.
- `Date.now()` v render funkcii zhodila ESLint (čistota React) — nebolo ho
  treba: naposledy zverejnené, ktoré dnes neplatí a nemá koniec, je vždy novela.
- Editor je Toast UI (ProseMirror), nie `<textarea>` — naostro sa text menil
  kurzorom a klávesnicou.
- **V dôvode opravy som obrátil poradie** („bodkočiarka namiesto čiarky“ namiesto
  „čiarka namiesto bodkočiarky“). Je v `textFixes[]` aj v audite a nemení sa (D24).
- Bodka za „vyhovie“ z plánu v novele už bola — skúška prešla na čl. 7.

---

## 2026-09-29 — Prehľad ako rozcestník, bez stáleho menu (SHELL-rozcestnik)

**Rozhodnutie (Ján, 29. 9. 2026, Q1–Q5 v `docs/design/SHELL-rozcestnik.md`).**
Bočný panel z rána sa **ruší** a nekombinuje sa: od 640 px nie je stále menu
vôbec. Panel bral obsahu šírku a pôsobil ako administrácia/ERP; dve
navigácie by boli dvojnásobná údržba (Q1). Sekcie sú **dlaždice na
Prehľade** so skupinami Organizácia · Správa a jednou vetou, čo v sekcii je
(bežná osoba nevie, čo je „Reťaz dôkazov"). Na podstránkach stačí zvonček
so súčtom (Q2), hlavička ostáva bez menu (Q3), rýchle prepnutie je ikona
9 bodiek na začiatku **pásu cesty** s plachtou všetkých sekcií (Q5). `/more`
na telefóne má tie isté dlaždice (Q4). Cena, ktorú návrh priznáva: prepnutie
sekcie sú dva kliky a počty po sekciách na podstránke nevidno.

**Čo sa spravilo.**

- `lib/appNav.ts`: `sectionGroups()` (dlaždice), `breadcrumbs()` (cesta),
  `moreGroups()` = „Moje úlohy" + tie isté skupiny bez sekcií na lište.
  Z panela odišli `navGroups()`, `NavState`, cookie `nav`, udalosť hamburgera,
  `app/shellActions.ts` aj `lib/shellBack.ts`.
- `Breadcrumbs.tsx` (server, bez JS), `SectionsSheet.tsx` (`<details>`,
  s JS Esc, klik mimo, výber, zmena stránky, fokus), `SectionTiles.tsx`.
  `AppNav` je už len spodná lišta. `Header.tsx` je presne ako pred
  panelom. Ikona `grid` (3 × 3 plné bodky).
- Cesta sa skladá z **adresy**: serverový komponent ju od Nextu nedostane,
  podáva ju `proxy.ts` v hlavičke požiadavky `x-contineo-pathname` (nastavuje
  ju vždy nanovo, klientovu prepíše). Názvy hlbších krokov dodáva stránka —
  `AppShell` dostal `title` a `trail`; doplnené na každej hlbšej stránke, testy
  Vzdelávania berú kurz, časť a test z `loadTestContext()`.
- Prehľad: hero → KPI → dlaždice → „Pre vás" (panely 2 × `minmax(0,1fr)`,
  rovnaká výška, odkaz na celý zoznam v pätičke). „Celá knižnica" sa kreslí
  len správcovi obsahu — `/library` je obrazovka správy a ostatným by
  skončila na 404 (dovtedy ju dostal každý, keď panel niečo skrýval).

**Odchýlky od návrhu.**

- Popisy „Na posúdenie" a „Ochrana údajov" v `T` z `.html` nesedeli s tým,
  čo tie sekcie sú: posúdenie je fronta **odpovedí**, ktoré niekto označil
  ako nesprávne (nie nové znenia), ochrana údajov je výkaz právnych základov
  a námietky (nie žiadosti dotknutých osôb). Vety sú podľa obrazoviek.
- Na 834 px sú dlaždice **3 v rade**, nie 2: `minmax(250px, 1fr)` z návrhu
  na 800 px obsahu dá tri. Rám ich kreslí rovnako, dvojku tvrdí len text.
- Hero s poľom otázky na Prehľade ostáva (PREHLAD.md); rám ho nekreslí.
- i18n kľúče sú ploché (`groupMain`, `allSections`, `desc.*`) ako zvyšok
  `nav`, nie `nav.group.main`.

**Nefungovalo / poučenie.**

- Závoj plachty je v kontexte pásu (`z-index: -1`) a pozadie pásu sa kreslí
  úplne dospodu — pás bol zatienený spolu s obsahom. Pozadie pri otvorení
  nesie `::before` s `z-index: 0`; prvý pokus so `-2` ho dal **pod** závoj.
- `/more` nemá rodiča s `gap` ako `.overview`, skupiny dlaždíc sa lepili.
- Overenie: stránka zložená z ozajstných `Header`, `Breadcrumbs`,
  `SectionsSheet`, `SectionTiles` a `AppNav` s ozajstným `globals.css` mimo
  repa (Prehľad je náhrada so skutočnými triedami, dáta nie sú z databázy).
  1440 / 834 / 390, Prehľad, `/hr`, `/hr/assign`, `/more`, detail s dlhým
  názvom, plachta otvorená, personalista aj bežná osoba, svetlá aj tmavá,
  bez JS. Ozajstnú aplikáciu s prihlásením som nevidel.

---

## 2026-09-29 — bočný panel namiesto pásu (SHELL-bocny-panel)

**Rozhodnutie (Ján, 29. 9. 2026, Q1–Q4 v `docs/design/SHELL-bocny-panel.md`).**
Na desktope je jediný tvar navigácie — **bočný panel**; pás `topbar` sa ruší,
nie ponecháva ako druhý variant. README (návrh) aj `DESIGN_GAP.md` hovorili
„oba, default `topbar`" — to platilo pre šesť položiek, dnes ich je 10–14,
pás musel byť textový (PR 7) a aj tak prepadal do „Viac N". „Na schválenie"
patrí do „Moje úlohy" (aj na `/more`). Na 640–1023 px lišta ikon +
vysúvanie. Zbalenie je voľba zariadenia v cookie `nav=rail|wide` — TODO
„uložiť variant navigácie na osobu" sa zatvára ako zbytočné.

**Čo sa spravilo.**

- `lib/appNav.ts`: `navGroups()`, `NavState`/`normalizeNavState()`,
  `NAV_COOKIE`, `NAV_DRAWER_EVENT`; `/more` má skupinu „Moje úlohy".
  Odišli `NavLayout`, `normalizeLayout()`, `STRIP_DEFAULT_VISIBLE` a
  `?layout=` z 20 stránok aj z `libraryFilters`.
- `AppNav.tsx`: panel so skupinami, zbalenie formulárom so serverovou akciou
  (`app/shellActions.ts`, návrat podľa `Referer` len na ten istý hostiteľ —
  `lib/shellBack.ts`), s JS okamžite a cookie zapíše prehliadač. Vysúvanie je
  `<details>`, s JS Esc, klik mimo, zmena stránky a návrat fokusu.
- `AppShell` číta cookie na serveri. `SkeletonShell` sa presťahoval do
  vlastného súboru a kreslí obrys panela v tej istej šírke.
- `Header.tsx`: hamburger na 640–1023 px — udalosť na `window` (hlavička je
  v `layout.tsx`, panel v `AppShell`), bez JS odkaz na `/more`.
- Ikony `fold`, `unfold`, `burger` z rámu v `Icon.tsx`.

**Nefungovalo / poučenie.**

- **Popis v lište ikon bol orezaný.** Zoznam panela má `overflow-y: auto`
  a to núti aj `overflow-x` — všetko, čo z panela vytŕča, je odseknuté.
  Popis je preto jeden, `position: fixed`, a umiestni ho skript pri
  prejdení myšou aj fokuse.
- `SkeletonShell` v `Skeleton.tsx` s `next/headers` zhodil build: ten modul
  načítava aj klientsky `Answer.tsx`. Kostra shellu má vlastný súbor.
- Hlavička má 56 px **+ 1 px linky** — sticky panel s číslom 56 z rámu bol
  o pixel vyšší než okno. Je 57.
- Na 834 px s cookie `wide` mal panel 236 px: `.app-panel.is-wide` má vyššiu
  špecifickosť než `.app-panel` v `@media`.
- Hlavička nad panelom ide cez celú šírku (logo pri ľavom okraji ako v ráme),
  centrovaná na 1240 px by logo od panela odsunula.
- **Otvorené:** knižnica má na 1440 px s rozbaleným panelom o 236 px menej
  (obsah 1204 px). Deväťstĺpcová tabuľka potrebuje ~1060 px vedľa panela
  filtrov 250 px — pravdepodobne sa nezmestí a zroluje sa vo
  `.doc-table-wrap`; so zbaleným panelom áno. Treba pozrieť na náhľade.
- Overenie: stránka zložená z ozajstných `Header` a `AppNav` s ozajstným
  `globals.css` mimo repa (router Nextu a serverová akcia nahradené),
  1440 rozbalený aj lišta, 834 lišta aj vysunutý, 390, svetlá aj tmavá, bez JS.

---

## 2026-09-29 — Prideliť normy: dva stĺpce a hľadanie (HR-pridelit-normy-hladanie)

**Čo sa spravilo.**

- Podklady uložené do `docs/design/HR-pridelit-normy-hladanie.*`.
- `PeopleSearch` je teraz všeobecný `ListSearch` (`kind: "people" |
  "documents"`). `PeopleSearch` aj `PeopleSearchView` majú to isté rozhranie,
  pribudol `DocumentSearch`. Texty si komponent berie z i18n podľa druhu,
  lebo zo servera sa funkcie poslať nedajú.
- `AssignForm.tsx`: `AssignFinish` (súhrn, zastaraný dopad, „Prideliť N
  ľuďom") a `AudienceAll` (stlmenie pri „Všetkým"). Výber čítajú z
  `FormData` celého formulára. Polia patria trom rôznym komponentom a
  spoločný majú len formulár.
- Poradie: `assignOrder.ts` (normy podľa `effectiveFrom` zostupne, osoby
  podľa `surname`, rezervne `splitFullName`). Súhrn: `assignSummary.ts`,
  test stráži, že rozklad publík je ten istý ako v
  `audienceFromSelection()`.

**Nefungovalo / poučenie.**

- `MultiSelect` pridáva a odoberá skryté polia bez udalosti, a čip × aj
  Enter v `ListSearch` menia políčko len cez stav. Súhrn preto počúva aj
  `MutationObserver` a `ListSearch` po zmene výberu vyšle `change`.
- Zastaraný dopad sa porovnáva **len podľa publika**. Dopad je počet ľudí
  a zmena noriem ho nemení. Podpis výberu, pre ktorý sa dopad počítal,
  skladá server z tej istej adresy ako `impact`.
- `clientLabels.test` (žiadny prop klientskeho komponentu nevracia string)
  zachytil dve vnútorné funkcie s podpisom `=> string`. Boli to falošné
  poplachy, ale obe sa dali napísať jednoduchšie.
- Kompilátor Reactu odmietol ref v `useCallback`. Formulár sa preto hľadá
  podľa `id`. React je 18, takže `inert` sa nastavuje cez vlastnosť v efekte.
- Pri skúške v prehliadači trafil klik podľa súradníc pri emulácii 1440
  zaškrtávacie políčko osoby a Enter na ňom natívne odoslal formulár.
  Nebola to chyba poľa hľadania. Skúšať treba s fokusom nastaveným priamo.
- Overenie: stránka zložená z ozajstných komponentov a `globals.css` mimo
  repa, 1440 svetlá, 390 tmavá a bez JS. Ozajstnú `/hr/assign` s dátami
  treba pozrieť na náhľade.
- Zlúčené ako PR #187. Ján 29. 9. potvrdil všetky štyri otázky Q1–Q4
  („1, 1, 1, 1"): výnimka šírky pre `/hr/assign` je zapísaná v `HR.md`,
  filter, tlačidlo s počtom a stlmenie ostávajú.

---

## 2026-09-29 — pole hľadania a filtre podľa KNIZNICA.html

**Čo sa spravilo.**

- Ján poslal rám 1 z `KNIZNICA.html`: implementácia poľa hľadania a filtrov
  sa od neho líšila, a nielen v knižnici.
- Nový `SearchStrip` (pás 36 px, lupa vnútri, tvar ako `.header-search`)
  v knižnici, adresári a osobách. Tlačidlo „Filtrovať" je už len pre
  čítačku.
- Knižnica: lišta je pole · „Filtre N" (pod 1024) · „+ Podmienka" ako
  prerušovaný čip 28 px. Čipy filtrov sú riadok pod lištou v tvare z rámu
  (28 px, r6, 12 px).

**Nefungovalo / poučenie.**

- Implementácia mala lupu ako samostatný prvok **pred** poľom
  s vlastným rámikom a v adresári aj osobách pri nej ostali dva
  protichodné komentáre („značka, nie lupa" a hneď pod ním „lupa, nie
  značka"). Oprava odchýlky B z 22. 9. zmenila ikonu, ale tvar poľa nie.
- Čipy boli v lište medzi poľom a „+ Podmienka", takže pri filtri
  odtlačili podmienku na ďalší riadok. Rám ich má pod lištou.
- Audit v organizácii dostal ten istý pás v nasledujúcom PR. Ján ho
  správne zaradil medzi hľadanie v zozname: aj keď rám audit nekreslí,
  pravidlo zo ZAKLAD (odchýlka B) platí pre každé hľadanie v zozname.
  V pôvodnom PR som ho nesprávne nechal bokom.
- Stránku `/hr/evidence` som nesprávne nazval „výkaz HR". V návrhu je to
  **Reťaz dôkazov**; výkaz potvrdení je `/hr`. Jej filtre (Osoba + Stav
  s popismi, `.evidence-filters`) sú podľa `HR.html` a ostávajú.

---

## 2026-09-29 — staršie znenia ako zoznam (DETAIL-starsie-znenia)

**Čo sa spravilo.**

- Podklady z Claude Design uložené do `docs/design/DETAIL-starsie-znenia.*`.
- `library/[id]`: staršie znenia sú karta `.older` so zoznamom. PDF je vidieť
  priamo, ostatné úkony sú v ⋯ (`<details>`). Panel sa otvára pod riadkom
  a zoznam ukazuje tri znenia, zvyšok je za `?older=all`. Úkony pri znení
  (`versionPanels`) sa teraz skladajú na jednom mieste pre kartu platného
  znenia aj pre ⋯, takže sa pravidlo „odvolanie len HR s potvrdeniami“
  nemôže rozísť.
- Q1 a Q2 z rámu ostávajú otvorené: zmena zodpovednej osoby zostáva v ⋯
  a `effectiveTo` sa zobrazuje ako doteraz.

**Nefungovalo / poučenie.**

- Pilulky v karte platného znenia sú celé vety („Znenie nemá určenú
  zodpovednú osobu."); do riadku sa nezmestia. Podmienky a `.tag--draft` sú
  rovnaké, texty sú krátke tvary z rámu (`older.responsibleMissing`…).
- `?older=all` sa drží aj v odkazoch úkonov a vo „Zavrieť", inak by sa po
  otvorení panelu na štvrtom znení zoznam znova zbalil.
- Karta nesmie mať `overflow: hidden`, ponuka ⋯ pri poslednom riadku by sa
  orezala. Zaoblenie spodku preto nesie posledný riadok.
- Vzhľad sa overoval na stránke vykreslenej mockmi z `libraryDetailFlow`
  (mimo repa) na 1440/834/390. Živé dáta treba pozrieť na náhľade.

---

## 2026-09-29 — hľadanie v zozname osôb (KOMPONENT-hladanie-osob)

**Čo sa spravilo.**

- Podklady z Claude Design (`KOMPONENT-hladanie-osob.md/.html`, rozhodnutia
  Q1–Q3 z 29. 9.) uložené do `docs/design/`.
- Nový klientsky obal `PeopleSearch` okolo `.approval-people`; čistá logika
  (filter, zvýraznenie, klávesy) v `lib/peopleSearch.ts`. Použitý
  v `ResponsiblePicker` (prepínač aj `multiple`), v príprave znenia
  (`library/[id]`) a v `ApprovalPanel`. Texty `people.search.*` v sk/cs/en.
- `/hr/assign` „Komu" (Q3) je zámerne mimo — samostatný krok.

**Nefungovalo / poučenie.**

- **`hidden` na riadku by nič neskryl:** `.approval-person { display: flex }`
  prebije predvolené pravidlo prehliadača pre `[hidden]`. Treba výslovné
  `.approval-person[hidden] { display: none }`.
- **Povinný prepínač v skrytom riadku:** prehliadač nemá kde ukázať „vyber
  osobu" a formulár mlčky neodíde. `onInvalid` preto hľadanie zruší.
- Zvýraznenie sa skladá po znakoch, nie `fold()` celého textu — pozície
  musia sedieť s pôvodným textom aj pri znakoch, ktoré sa zložia na dva.
- Vybraný riadok sa podfarbuje cez `:has(> input:checked)`, nie triedou
  `is-on` z rámu — funguje aj bez skriptu.
- Testy bežia v Node bez DOM: vykreslenie je oddelené do bezstavového
  `PeopleSearchView` a overuje sa `renderToStaticMarkup`.
- Stiahnutie podkladov: DesignSync bez autorizácie a Claude Design za
  prihlásením; súbory sa nakoniec čítali cez prihlásený prehliadač.
- **Fokus po zrušení hľadania:** „Zrušiť hľadanie" aj × v poli po kliknutí
  zmiznú a fokus padol na `body`. Našlo sa až pri skúške v prehliadači;
  fokus sa teraz vracia do poľa.
- Živá skúška na `sfz.localhost` nevyšla (prihlásenie sa v paneli
  nedržalo), komponent sa preto skúšal izolovane: zbalený s ozajstným
  `globals.css` na testovacej stránke mimo repa. Overené písanie, Enter
  pri troch aj jednom výsledku, ↓, Esc, × na čipoch, odoslanie so skrytým
  zaškrtnutým, povinný prepínač v skrytých riadkoch, režim bez JS a 390 px.
  Na stránke knižnice to treba ešte pozrieť na náhľade z Vercelu.
- **„Komu" v `/hr/assign` (Q3)** ako druhý PR nad prvým: políčka
  `audience=person:<e-mail>`. Je to to isté publikum, aké vzniká z napísanej
  adresy, takže na serveri stačilo prijať `person:` v `audienceFromSelection()`.
  Schéma, pridelenie ani súhrn dopadu sa nemenili a návrat s chybou vráti výber
  cez tú istú adresu. Pole na adresy ostalo na vloženie zoznamu z tabuľky.

---

## 2026-09-29 — asistent odpovedá podľa znenia platného k dňu otázky (ADR-024)

**Čo sa spravilo.**

- Celý plán „Asistent: znenia v indexe" (9 krokov) za jeden deň, PR #170–#176,
  rozhodnutia v **ADR-024** (D144–D149).
- **Atlas (kroky 0–3):** zmazaných 1 392 osirelých úsekov (70 % textu v indexe;
  záloha v `app/data/backup/`), príznak `superseded` na úsekoch, do indexov
  `versionId`, `superseded`, neskôr `sourceType`, `sectionKey` von. Indexy sa
  menili **na mieste** (`atlas_init.mjs --upravit`) — trikrát bez výpadku.
- **Hľadanie (4):** úseky podľa znení platných k dňu, počítaných z `documents`
  cez `effectiveVersion()`, nie podľa `isActive`; overené odpovede len pre
  dnešok. Výsledky pri otázke na dnešok zhodné so stavom pred zmenou.
- **Model a zdroje (5):** znenie a účinnosť pri úseku, deň odpovede v pokyne,
  znenie pri zdroji aj v hodnoteniach.
- **Deň otázky (6):** pravidlá pri každej otázke, model ako záloha, štítok nad
  odpoveďou. **Porovnanie (7):** dvojica znení, po článkoch, najviac 8
  podrobne.
- **Skúška (8):** `sfz:test_znenia` s tromi zneniami — koncepty skriptom
  (`npm run seed:versions`), predložil a zverejnil Ján, schválila Michaela
  Žikavská. `npm run versions:questions`: 6 z 6.

**Nefungovalo / poučenie.**

- **Skúška na živých dátach našla, čo testy nie.** Rok v otázke prepol
  hľadanie do fulltextu (heuristika berie rok za kód normy) — dátum sa teraz
  z otázky vyberá. Automatické označenie znenia (ADR-016) už nesie dátum,
  takže štítok ukazoval „znenie znenie účinné od … · účinné od …". Model
  písal o minulej zmene v budúcom čase. Prvý pokyn pridával nevyžiadanú
  „Poznámku k účinnosti". Všetko opravené, ale až po behu naostro.
- **`publish()` má schvaľovaciu bránu** — v pláne kroku 8 som tvrdil opak.
  Chyba plánu, nie kódu; Ján volil cestu cez kartu. Druhá prekážka až na
  karte: **sám seba schváliť nemožno**, schvaľovateľ dostane upozornenie —
  rozhodnutie o kolegovi patrilo Jánovi.
- `sfz:test_onboarding` sa k asistentovi nedostane: celý text v jednom
  riadku → chunker ho uloží ako preambulu a preambuly hľadanie vynecháva.
- Automatický režim zablokoval úpravu indexu v kroku 4; spustil ju Ján.
- `atlas_check.mjs` hlásil počas úpravy na mieste „dotazy vrátia prázdno",
  hoci stará definícia odpovedala — opravené (`queryable`, `mainIndex`).
- Porovnanie pri dokumente s jediným znením ťahalo celé texty (594 ms) —
  texty sa načítajú až keď je čo porovnať (27–52 ms).
- Kontrola `npm run check` hlásila Jánove roly `dpo` a `learning-admin` ako
  neznáme — zoznam v kontrole zaostal za `ASSIGNABLE_ROLES`.
- Prepis otázky modelom trvá až 3,7 s — nesúvisí s plánom, zaťažuje čas po
  prvý token (D9).

---

## 2026-09-28 (večer) — právny základ už v príprave (ADR-023)

**Čo sa spravilo.**

- Krok 3 z `NEXT.md`: návrh s piatimi otázkami, Ján odpovedal áno / áno /
  zostane / áno / áno. **ADR-023** (D139–D142), tri commity na vetve
  `claude/lucid-curie-9giv6d`.
- Pole `draftLegalBasis` na koncepte; `publish()` ho prenesie do znenia
  (`legalBasisFromDraft()`), história nesie `inPreparation`.
- `/documents/[id]`: karta pripravovaného znenia pre zodpovednú osobu aj pri
  dokumente, ktorý by inak nevidela; karta pre zverejnené, ešte neúčinné
  znenie. Knižnica: stav základu v krokoch 1–3, formulár pre náhradníka.

**Nefungovalo / poučenie.**

- **Medzera, ktorú nikto nehlásil:** upozornenie zo zverejnenia posielalo
  zodpovednú osobu na stránku, ktorá formulár na základ pri znení s budúcou
  účinnosťou neukázala (`effectiveVersion()`). Opravené v tom istom kroku.
- Vedľajšie zistenie `publish()` vyradí staré znenie hneď — potvrdené testom
  a **opravené v tom istom PR (D143)**. Pôvodne som navrhoval zmenu
  v `publish()`; pri čítaní kódu vyšlo, že štyri miesta hľadajú „prvé
  aktívne znenie" ako „posledné zverejnené" a preindexovanie by siahlo na
  staré. Oprava je preto v `effectiveVersion()` — dáta už správny koniec
  platnosti mali, len ho výber ignoroval.
- Ján schválil plán „asistent a znenia v indexe" (TODO, 9 krokov); krok 0
  (Atlas) čaká na neho.
- `npm ci` v cloudovej session padol na 403 pre `cdn.sheetjs.com` (balík
  `xlsx`); závislosti sa nainštalovali v kópii mimo repa s `xlsx` z registra.
- `publish()` nemá test úspešného zverejnenia (chunker, kolá) — prenos
  základu je preto čistá funkcia testovaná samostatne.

---

## 2026-09-28 — ochrana údajov podľa organizácie, pozvánky odoslané

**Čo sa spravilo.**

- **ADR-021** (Ján ako DPO): záznamy vzdelávania majú lehotu dokladov,
  podrobnosti (odpovede, úseky videa) sa orežú rok po dokončení kurzu.
  Anonymizáciu certifikátu Ján **zamietol** — vydaný certifikát platí
  a drží sa kvôli archivácii (D132). Retencia v kóde (#157), beží ako výkaz.
- **Osoby:** stav „Nová" po importe, „Pozvaná" až po odoslaní pozvánky
  (odvodené z `invitationSentAt`); pozvánka aj zo zoznamu osôb.
- **Pozvánka:** odkaz na `/privacy`; univerzálny text „{Právny názov} vás
  pozýva do {Názov portálu}"; v nastaveniach blok „Názov portálu" spojený
  s prevádzkovateľom. SFZ premenovalo portál na „Intranet SFZ".
- **`/privacy`:** Vzdelávanie a pohlavie (DPO schválil 28. 9.), odkaz
  v pätičke; **ADR-022** — krajina sídla (úrad, zákon o archívoch),
  sprostredkovatelia z profilu adaptérov, lehoty organizácie na `/dpo`
  (tie isté čísla číta mazacia dávka), doplnkový text DPO, verzia textu
  podľa organizácie.
- **Pozvánky odišli:** 146 hromadne 16:41 (+1 kolegovi), bez chyby; do
  hodiny sa prihlásilo 8 ľudí.

**Nefungovalo / poučenie.**

- **Stará karta = stará verzia.** Kolegovi prišla pozvánka so starým
  textom hodinu po nasadení nového: karta otvorená pred nasadením posiela
  akcie verzii, z ktorej sa načítala (Vercel skew protection). Overené
  v logoch Vercelu podľa `deploymentId`. Pribudla hláška „Je dostupná nová
  verzia — Obnoviť" (`VersionNotice`, `/api/version`). Hromadné pozvánky
  už obslúžila nová verzia (dd04697) — tiež overené v logoch.
- Pri návrhu D131 som počítal so zmazaním celého sledovania videa; až pri
  kóde vyšlo, že dokončenie časti sa z neho odvodzuje. Orezávajú sa len
  úseky, `reachedAt` zostáva — ADR doplnené.
- Pohlavie sa najprv volalo „oslovenie"; Ján ho prepol, lebo poslúži aj
  štatistikám. Pole nemalo dáta, premenovanie bez migrácie.
- Pri veľkej záťaži stroja (load ~100) padali tri staré testy na 5 s
  limite importu stránky — aj bez zmien. `--maxWorkers=3` prejde celé.
- V odpovediach nehlásiť kroky rituálu, ktoré nič nenašli (Ján: „toto nám
  treba?").

## 2026-09-27 (5) — Vzdelávanie L0 až L3 v produkcii; PDF certifikátu; pohlavie osoby

**Čo sa spravilo.** Modul `learning` (ADR-018) prešiel od kostry po
certifikáty za jeden deň, v poradí L0 → L1 → L2 → L3, jeden rám z Claude
Design = jeden PR (#130–#153). Pre SFZ je zapnutý, Ján má rolu
`learning-admin`, indexy vytvoril `learning_init.mjs`.

- L1: smart:tagy (premenovanie aj zlúčenie všade — rozhodnutie Jána
  MANAGE Q1 = B), kurzy s verziami, zápisy, odvodený postup (D119),
  video s povinným dopozeraním (Range 206), obrazovky študenta a správcu.
- L2: banka otázok (aj obrázky a videá v otázkach), testy ako recept
  (sekcie = filter + počet), pokus so serverovým časom a autosave,
  výsledky len pre zodpovedné osoby (D121).
- L3: certifikát pri dokončení (znova overené z udalostí), číslo
  `SFZ-2026-0001`, overenie `/verify/…?h=` bez mena, odvolanie s dôvodom,
  tlač A4 a **PDF s QR** (Ján: áno závislostiam `pdf-lib`, fontkit,
  `qrcode`; rate limit na `/verify` nie).
- **Pohlavie osoby** (`persons.gender`): najprv „oslovenie" kvôli
  „absolvoval / absolvovala", po Jánovej otázke prepnuté na pohlavie —
  poslúži aj na štatistiky. Pole nemalo dáta, preto bez migrácie.

**Nefungovalo / poučenie.**

- `@pdf-lib/fontkit` so `subset: true` z Noto stratil znaky (z „CERTIFIKÁT"
  zostalo „CER"). Písma sú preto orezané vopred cez `pyftsubset` a vkladajú
  sa celé (`app/assets/fonts/README.md`). Chyba bola vidieť až na obrázku
  PDF — test s čítaním textu cez pdfjs ju teraz chytí.
- Next nepovolí `react-dom/server` v aplikácii — značka Contineo pre PDF je
  reťazec SVG hneď pod komponentom `ContineoMark`.
- Tlačová stránka A4 pretekala na telefóne do strany (1154 px). Vidno to
  len pri 390 px; odteraz sa každá „pevná" stránka skúša aj na mobile.
- Overovacia adresa v PDF sa berie z domény organizácie, nie z hlavičky
  `host`: lokálny server píše do ostrej databázy a `sfz.localhost` by na
  uloženom PDF zostal navždy.
- Slovenčina: „percentuálnych bodov", nie „percentných" (Ján) — aj s tvarmi
  1 / 2–4 / 5+.
- `sed -E` na macOS nepozná `\b` — premenovanie `salutation` → `gender` prešlo
  len čiastočne; dorobené cez `perl -pi`.

## 2026-09-27 (4) — import osôb SFZ hotový; hľadanie v náhľade; upratovanie

**Import prebehol.** Ján nahral opravený hárok (2. verzia Excelu): 153 osôb
(bez `spravca.letko@`, `mailgateway.issf@`, `misko@naraznicek.sk` a technických
kont z hárku „Vynechané"). Náhľad ukázal 150 nových + 3 existujúce na
doplnenie, zápis prešiel — „všetko ok, celý import". 22 ľudí z
`@sfzmarketing.sk` je v tenante SFZ ako `employee` (Ján neurčil inak).
Ján sám v exporte nie je (iný typ licencie než Basic/Standard) — vie o tom.

**Hľadanie v náhľade (PR #151).** „Seba nevidím" bola prvá otázka nad
tabuľkou so 150 riadkami; filter podľa stavu na ňu neodpovedá. Pole
„Hľadať v mene alebo adrese" sa kombinuje s filtrom. Druhý worktree
(`import-search`) podľa ADR-020, po zlúčení odstránený aj s vetvou.

**Upratovanie dvoch sessions naraz.** Toto „Poupratuj" ide cez worktree
`chore/poupratuj-import` a PR, lebo druhá session upratuje learning L3 v tom
istom čase — `NEXT.md`, devlog a changelog sa zrazia; kto zlučuje druhý,
rieši konflikt „ponechať oboje".

## 2026-09-27 (3) — náhľad importu ako tabuľka; prvý worktree

**Zadanie.** Ján ukázal screenshot náhľadu importu (155 e-mailov oddelených
čiarkou): „vyzerá strašne". Chcel tabuľku s farebným rozlíšením, čo pribudne
a čo sa mení.

**Ako sa to spravilo.** Nie len vizuál. Aby náhľad vedel povedať *čo* sa
zmení, musel počítať to isté, čo zápis — preto z `upsertPersons()` vznikla
čistá `planChanges(existing, row, mode, now)` a `previewImport()` vracia
plán po riadkoch (`RowPlan`: stav + zmeny „pred → po"). Skript aj obrazovka
ho ukazujú. Jedna funkcia = jedna pravda; predtým mal náhľad vlastnú,
hrubšiu logiku („existuje/neexistuje").

**Rozhodnuté (ADR-020).** Ján nechal na mňa, či worktree po zlúčení
odstrániť a či ho zaviesť ako pravidlo: áno, oboje. Vlastná vetva bez
vlastnej pracovnej kópie problém z rána nerieši. Odstránenie ide spolu
s vetvou podľa existujúceho pravidla o automatickom mazaní po zlúčení.

**Nefungovalo / poučenie.**

- Pri zlúčení `origin/main` do vetvy (PR #147 medzitým pridal CSS
  certifikátov) git zaradil zatvárajúcu `}` môjho `@media` bloku do
  spoločnej časti konfliktu; „ponechať oboje" bez kontroly zátvoriek by
  rozbilo CSS. Odteraz po každom konflikte v `globals.css` počítať `{`/`}`.
- Prvé testy `planChanges()` padli na mojich fixtures, nie na kóde:
  `resolveName()` z celého mena odvodí aj `givenName`/`surname`, takže
  „existujúca osoba" bez nich vyzerala ako osoba s prázdnymi poľami.
- Druhá session bežala na vetve `learning-l3-certificates` s rozrobeným
  `i18n.ts`. Podľa nového pravidla v `CLAUDE.md` som nešiel cez `checkout`
  (jedna pracovná kópia by to nevyriešila), ale cez **`git worktree`**
  v `.worktrees/import-preview` (vylúčené v `.git/info/exclude`,
  `node_modules` symlinkom). Prvýkrát v tomto repe; funguje — build, testy
  aj lint bežia v worktree nezávisle.
- `do shell script` v Control your Mac má časový strop — celá sada testov
  + build sa musí spustiť cez `nohup` a čítať z logu.

## 2026-09-27 (2) — import osôb SFZ: pravidlo pre existujúcich (ADR-019)

**Zadanie.** Založiť 155 zamestnancov a spolupracovníkov SFZ z licenčného
zoznamu M365 (hárok „Na import do contineo"). Súbor `sfz-osoby-import.csv`
(Meno, Priezvisko, Email, Pozicia = Title + Department z exportu; oddelenie
zámerne vynechané — je to číselník, zaradí sa ručne). Náhľad proti databáze:
152 nových, 3 existujúci, 0 chybných. Samotný import spúšťa Ján na obrazovke.

**Čo sa našlo po ceste.**

- `scripts/import_persons.mjs` importoval `riadokNaOsobu`, `DOVODY`, `ALIASY`
  — názvy, ktoré po premenovaní knižnice do angličtiny (`20800fc`) už
  neexistovali. Skript teda od toho dňa padal; obrazovka bola v poriadku.
  Opravené, pribudol `--org=KOD` (skript nemá prihláseného človeka, od
  ktorého by organizáciu vzal).
- Otázka k vete „Prázdna bunka v stĺpci, ktorý súbor má, hodnotu vymaže"
  odhalila dve veci: že import je pre existujúcich nebezpečný predvolene, a že
  `department`/`startDate` išli do `$set` ako `undefined` → driver ich uložil
  ako `null`. Dokumentácia sľubovala „chýbajúci stĺpec sa nedotkne", kód to
  pri dvoch poliach nedodržal.

**Rozhodnutie (ADR-019, D124–D126).** Prvý návrh bol tvrdo preskočiť
existujúcich; Ján ho upravil na „doplniť len prázdne polia, ako pri Entra" —
a prepis nechať ako výslovný prepínač. Je to lepšie pravidlo: bezpečné
predvolene, a doplnenie chýbajúcich údajov je práve ten častý prípad, o ktorý
by tvrdé preskočenie prišlo.

**Prevádzková poznámka.** Z Cowork VM sa Atlas nedosiahne (SRV dotaz padá);
náhľad aj testy bežali cez Control your Mac. Popri tom v repe beží druhá
session na learning module (necommitnuté zmeny v `i18n.ts` a inde) — commit
tejto zmeny berie z `i18n.ts` len vlastné hunky, cez `git apply --cached`.

## 2026-09-27 — Vzdelávanie ako modul platformy: ADR-018 (bez kódu)

**Čo sa rozhodlo.** LMS (ClubUp) bude **modul `learning`** tej istej
platformy, nie samostatný produkt s prepojením. Plán zo 17. 9. ležal
odložený za onboardingom; dnes sa otvoril, prešiel hĺbkovou analýzou
a stal sa ADR-018 s rozhodnutiami D117–D123. Onboarding beží ďalej
v druhej session — preto sa `tracks.ts` nedotýkam a modul zostane pre SFZ
vypnutý, kým Ján nepovie.

**Čo stálo za rozmyslenie.**

- **ClubUpový strom sa neprebral.** ClubUp má Kurz → Úroveň → Téma → Modul →
  Časť a uložený `Progress`. Ján to zjednodušil na **plochý kurz → časti**,
  téma je číselník, úrovne sú **trasy** (4 trasy, jedna na úroveň). Contineo
  k tomu dodá D27 — stav sa odvodzuje z udalostí (zápis, dokončenie časti,
  pokus, certifikát), nič sa neukladá ako príznak.
- **Testy nie sú súčasť kurzu, ale služba platformy** s bankou otázok
  a smart:tagmi `Kľúč: Hodnota`. Test je *recept* (sekcie = filter tagov +
  počet), otázky sa losujú, odpovede miešajú, pokus si uloží snímky. Test sa
  prideľuje ako hotový — k časti kurzu, neskôr aj ako krok trasy (O18, po
  dohode s onboardingom, lebo to mení `/documents` a ADR-005).
- **HR skóre nevidí.** Výsledok testu je hodnotenie osoby; vidia ho
  menovite zodpovedné osoby testu (ako schvaľovatelia znenia, D69), nie rola.
- **Video ako pri knižnici**: GridFS do 25 MB (`fileStore.ts`, po kúskoch),
  adaptér S3/Azure až pri prvom zákazníkovi s dlhými videami. Vercel Blob
  som navrhol omylom — v projekte nie je; Ján to zachytil.
- **Dizajn ide cez Claude Design nad ZAKLADOM** — zadanie
  `docs/design/LEARNING-zadanie.md` (časť A raz, časť B po ráme).

**Čo nevyšlo.** `git status` z pripojeného priečinka nechal v repe
`.git/index.lock` (mount nevie mazať) a commit cez Control your Mac
spadol. Riešenie: git len cez Mac shell; zámok sa zmazal so súhlasom.
Heredoc v `do shell script` nefunguje — správa commitu ide cez viac `-m`.

**Ďalej.** L0 (modul v profile tenanta, rola `learning-admin`, navigácia,
i18n, prázdne `/learning*`) vo vetve `learning-l0` cez PR — dotkne sa
súborov, na ktorých pracuje aj onboarding. Pokračuje sa v Claude Code.

## 2026-09-24/25 — rámy z Claude Design a štyri rozhodnutia o znení (PR #109–#128)

**Postup s Claude Design sa ustálil.** Ján navrhne rám, napíše „stiahni
design"; archív sa stiahne cez Share → Project HTML → Project archive
(Claude Design do repozitára zapisovať nevie — Ján to overil), rozbalí sa
Pythonom (názvy v cp437, NFC), nové rámy idú do `docs/design` samostatným
commitom a každý rám je potom **jeden PR**. Otvorené otázky z rámu sa pýtajú
naraz a odpovede sa zapisujú späť do `.md` rámu, aby ich videl aj Claude
Design. Posledná sada (šesť rámov) mala deväť otázok — dve dávky
`AskUserQuestion` stačili.

**Rámy (PR #114–#123):** ZNENIE, KNIZNICA postup znenia (karta so štyrmi
krokmi, ADR-014), APPROVALS, DPO, PRIVACY, OSOBY, výber oddelenia s hľadaním,
HR, ADMIN, úprava dokumentu (ADR-015). Čo stálo za rozmyslenie:

- **Krok karty sa odvodzuje** (`versionFlow.ts`) — v modeli nepribudol žiadny
  stav. Kolá sa číslujú na identite konceptu, takže po výmene PDF začína
  „kolo 1" znova; tlačidlo „Predložiť kolo N" preto berie počet kôl na
  aktuálnej identite, nie posledné kolo dokumentu.
- **Kroky 1–3 sa nedali vidieť naživo** — v databáze nebol dokument
  v príprave a zápis do produkcie bez súhlasu nie. Riešenie: **test, ktorý
  vykreslí serverovú stránku s podvrhnutými dátami** (`libraryDetailFlow`,
  `approvalsPage`, `dpoPage`) a z neho statické HTML so štýlmi aplikácie na
  pozretie očami. Chytil dve chyby, ktoré `tsc` nevidí (e-mail namiesto mena,
  veta začínajúca malým písmenom).
- **Screenshot po posune stránky v paneli prehliadača vychádza prázdny.**
  Pomohlo emulovať vysoké okno a nescrollovať, alebo prvok presunúť hore.
- **Nový názov dokumentu vstupuje do identity konceptu len keď je** — rovnaký
  trik ako pri údajoch o znení (D107), aby bežiace kolá platili ďalej.
- **Výber s hľadaním sa zapína sám od 8 možností** a oddelenia nesú cestu
  („A › B") namiesto odsadenia. `MultiSelect` dostal `caseSensitive`
  (identifikátory sa nesmú meniť na malé písmená) a zálohu bez JS ako
  zaškrtávacie políčka. Test klientskych komponentov odmietol funkciu ako
  parameter — nahradená príznakom.
- **Navigácia svietila dvakrát** (`/hr` aj `/hr/evidence`) — aktívna je teraz
  najdlhšia zhodná adresa.

**Štyri rozhodnutia Jána nad rámec rámov:**

- **ADR-016 (PR #124, #125):** „Odkiaľ je dátum", „Označenie znenia" ani
  „Dôvod opravy" netreba. Prvý krok skladal označenie z dátumu; Ján chcel
  označenie preč úplne. Formulka je teraz „… v znení účinnom od 1. 1. 2027".
  Existujúce označenia („1.0") sa neprepisovali — pôvodné aj testovacie
  dokumenty sa pred ostrou prevádzkou zmažú celé.
- **ADR-017 (PR #127):** viac právnych základov pri znení. Aby sa nerozbilo
  ~200 miest, ktoré čítajú jeden základ, **pôvodné pole nesie rozhodujúci
  druh** (zákonná povinnosť má prednosť) a spojené názvy — námietky,
  retencia a kontroly tak platia bez zmeny; presný zoznam je v `legalBases[]`.
- **Stiahnuť zdrojový súbor** v knižnici (PR #126), len pre správcu obsahu —
  stráži to `libraryContext()` aj `/api/library/file`.
- **Automatické založenie do Prihlasovania** (PR #128) — Ján ho považoval za
  duplicitu záložky Domény; sú to e-mailové domény kont, nie webové adresy.

**Pomocný skript** `ship.sh` (v scratchpade, nie v repozitári): PR, čakanie
na kontroly, zlúčenie, čakanie na nasadenie, zmazanie vetvy. Pri #123
najprv zlyhal `tsc` na type mocku v teste — CI to chytilo, opravené
samostatným commitom, vetva zmazaná až po úspešnom nasadení.

**Naostro neoverené:** predloženie a zverejnenie cez novú kartu (vrátane
nového názvu a prenosu pridelení), uloženie kombinácie právnych základov,
námietka, vyradená osoba. Všetko má testy, nič z toho nebolo stlačené na
produkcii.

---

## 2026-09-24 — druhé kolo DPO: retencia, rola DPO, námietky, /privacy; údaje o znení

**Ráno kontrola nahratia (PR #101).** Ján nahral pracovný poriadok znova;
čítal som priamo z databázy, nič nezapisoval. Nahratie sedelo, ale našli sa
štyri drobnosti: 881 escapovaných `\_` z prázdnych miest vo formulároch
(šum do vyhľadávania), osamotené „Obsah" po odstránení obsahu z Wordu,
CRLF z `<textarea>` a **osirelé súbory predošlého konceptu** — každé „Nové
znenie" nechávalo v GridFS dva súbory bez odkazu. Opravené a overené na
skutočnom `.docx` stiahnutom z GridFS (`\_` 881 → 0, tabuľky a poznámky
zostali). Pri ďalšom nahratí Jána sa staré súbory zmazali samy.

**Druhé kolo odpovedí DPO prišlo so zaškrtávacími okienkami, ktoré sa nedali
použiť** — odpovede boli červené podfarbenie. Čítal som ich z `w:highlight`
v XML, nie zo stavu okienok. Ďalšie dotazníky už bez okienok (pamäť
`questionnaire-no-checkboxes`): očíslované voľby a riadok „Odpoveď:".

**ADR-012 v piatich PR (#102–#106).** Tri rozhodnutia dal Ján: strop 5 rokov
len pre vyradené osoby (aktívnym by zmiznuté doklady znamenali, že im predpisy
naskočia ako nepotvrdené), nová rola `dpo`, mazanie najprv len ako výkaz.
Čo stálo za rozmyslenie:

- **`deactivatedAt` sa ukladá, hoci je v audite** — výnimka z D27, lebo audit
  sa po 24 mesiacoch maže a lehota dokladov je 3 roky od skončenia.
- **Kolá schvaľovania platného znenia sa nemažú nikdy** — stav znenia sa
  z nich odvodzuje a bez nich by zverejnené znenie vyzeralo ako neschválené.
- **Testy výmazu nad malou náhradou Monga, ktorá filtre naozaj vyhodnocuje.**
  Mock, ktorý overí, že sa zavolal `deleteMany`, by nepovedal, *čo* by sa
  zmazalo — a pri výmaze dôkazov je to jediná otázka.
- **Prvá verzia dávky robila tri dotazy na každú osobu denne** — prepísané
  na tri agregácie na organizáciu ešte pred prvým commitom.
- **Námietku eviduje DPO na `/dpo`, nie HR na karte osoby** — karta patrí
  správe osôb a námietka nie je údaj pre ňu. ADR som podľa toho opravil.

**Na produkcii so súhlasom:** indexy (`objections`, `audit_ttl` — najstarší
audit je z 30. 8., nič sa nezmazalo), migrácia `deactivatedAt` (nemala čo
doplniť), rola `dpo` Jánovi a prevádzkovateľ SFZ (IČO bez medzier) — oboje
priamym zápisom s audit záznamom, lebo obrazovka pre to neexistovala alebo
by to robil Ján pod sebou.

**`/privacy` je verejná** — informovanie má predchádzať zberu, teda aj
prvému prihláseniu z pozvánky. Overené na 375 px bez vodorovného rolovania
a naostro telom odpovede.

**ADR-013 (PR #108) — údaje o znení.** Ján chcel autora, schvaľujúci orgán
a dátumy „už pri zadávaní" a nemenné po schválení. Pri mapovaní vyšlo, že
**dátum účinnosti už existuje** („Platné od" pri zverejnení) a že **po
schválení sa dnes nezamyká nič** — úprava len zneplatní schválenie. Štyri
otázky, Ján zvolil všetky odporúčania: jedno pole, súčasť schválenia (do
`draftIdentity`, len keď údaje sú — staré kolá platia), text s návrhmi,
predvyplnenie z tabuľky prvej strany `.docx` ako návrh.

**Chyba, ktorú som našiel až v prehliadači:** pracovný poriadok je schválený
bez údajov a zámok „po schválení" ich nedovolil doplniť — teda presne to, čo
Ján chcel spraviť. Zámok je odteraz počas kola vždy, po schválení len keď
údaje boli súčasťou schválenia. Karta sa predvyplnila z dokumentu správne;
**neuložil som ju** — zápis do ostrých dát a zrušenie schválenia je Jánovo
rozhodnutie.

**Čo stálo čas:** `gh pr create --body "$(cat <<EOF …)"` padol na zátvorke
v tele (bash parsuje `$( )` aj s heredocom) — telo PR odvtedy zo súboru.
A `find ~/Library/CloudStorage` visel na OneDrive; súbor som vzal z GridFS.

**Neoverené naostro:** `/dpo` (výkaz, CSV, námietka), dátum skončenia na
karte osoby, uloženie údajov o znení a zverejnenie s nimi. Retenčná dávka
beží v režime `report` a dnes by nezmazala nič.

---

## 2026-09-23 (7) — prvé ostré nahratie, ADR-011, CSRF

**Ján nahral Pracovný poriadok (2,5 MB .docx) a padlo to dvakrát.** Prvý raz
na strope serverovej akcie 1 MB (formulár sľuboval 32 MB — cez rozhranie sa
dovtedy nenahrávalo, normy šli skriptom). Druhý raz `RangeError` pri zápise:
dokument mal vo vnútri 34 MB obrázok EMF, mammoth ho vložil do HTML ako
base64 a z textu bolo 47 MB. Súbor som stiahol z GridFS a pád zopakoval
lokálne — až potom oprava. Varovanie „obrázky sa neprepísali" pritom tvrdilo
opak toho, čo prevod robil, a pri PNG nezaznelo nikdy.

**Z toho vyšla skutočná otázka.** Ján: dokumenty majú prílohy, formuláre,
obrázky — schvaľovať sa musí celok, Markdown je len na RAG. Pri mapovaní sa
ukázalo, že je to horšie, než to znelo: schvaľovalo aj potvrdzovalo sa
Markdown, odtlačok originálu neexistoval, znenie si ani nepamätalo, z akého
súboru vzniklo — a **schvaľovateľ videl platné znenie namiesto konceptu**.
Tú chybu (PR #91) som opravil prvú, lebo nezávisela od ničoho.

**ADR-011 za jedno popoludnie, v piatich PR.** Rozhodnutia, ktoré dal Ján:
25 MB, povinné PDF, zostávame v Atlase. Doplnil počas práce: zdroj nie je
len pre text, ale **predloha pre ďalšie znenie** („dve muchy jednou ranou").
Kľúčové technické rozhodnutie bolo, kam dať odtlačok PDF — do identity
konceptu (`draftIdentity`), nie do samostatného poľa pri kole. Kolá, publish
aj chunky tak idú cez jednu hodnotu a bez PDF je to presne `textFingerprint`,
takže staré znenia sa nepohli.

**Čo som overil v dokumentácii, nie odhadol:** strop 4,5 MB na Verceli platí
pre request aj response, **odpoveď v prúde je výnimka**. Preto čítanie prúdom
a bez `Content-Length`.

**Chyba, ktorú som takmer zopakoval:** poslať funkciu zo serverovej stránky
do klientskeho komponentu (texty s parametrom) — presne toto raz zhodilo
`/library/new`. Chytil som to pri písaní; texty idú ako šablóny `{name}`.

**CSRF:** nová cesta na nahrávanie dostala `sameOrigin()`; ďalšie štyri POST
cesty ju nemali (PR #96). `SameSite=Lax` nestačí na `*.contineo.app`, kde sú
organizácie „same-site".

**Neoverené naostro:** nič z ADR-011 — žiadne znenie ešte nemá PDF. Lokálne
som skúšal len vykreslenie a čítanie existujúceho originálu prúdom; zápis
do ostrej DB som nerobil. Prvé nahratie robí Ján.

---

## 2026-09-23 (6) — D93 PR 0 a 1: export s filtrom oddelenia, audit presunu

Obe chyby z plánu D93, ktoré nečakajú na rozhodnutie o variante, sú v jednom
PR (#86) ako dva commity.

**Export:** mapovanie `filters → LibraryFilter` je odteraz jedna funkcia
`listFilterOf()`. Návratový typ vyžaduje každý kľúč `LibraryFilter` — keby
pribudol ďalší filter, `tsc` zastaví práve toto miesto. Bez toho by sa tá
istá chyba vrátila pri prvom novom facete.

**Audit presunu:** pôvodný priečinok sa berie z `findOneAndUpdate`
s `returnDocument: "before"`, nie zo samostatného `findOne` — medzi dvomi
dotazmi by dokument mohol presunúť niekto iný a audit by tvrdil presun
odinakiaľ. Priečinky sa zapisujú cestou názvov, nie `id`.

**Piata brzda sa vyplatila hneď v prvý deň** — `no-use-before-define`
zachytilo konštantu v mojom novom teste, použitú v mocku nad deklaráciou.

**Čo stálo čas: lokálne prihlásenie.** `localhost` patrí tenantovi **LTK**,
SFZ je na **`sfz.localhost:3000`** a osoba (D90) existuje len v SFZ — na
`localhost` bol Ján prihlásený, hlavička ukazovala avatar, ale knižnica
hlásila „Stránka sa nenašla" a export 401. Na `sfz.localhost` sa treba
prihlásiť zvlášť (cookies sú na hostiteľa) a odkaz z e-mailu má v `callbackUrl`
**https**, ktoré dev server nevie — po prihlásení treba ručne otvoriť
`http://sfz.localhost:3000/...`. Prihlasovací odkaz otvára Ján, nie asistent.

**Overenie:** chyba potvrdená najprv na produkcii (filter oddelenia: obrazovka
0, CSV 10), potom oprava na `sfz.localhost` (0 a 0; ďalšie štyri filtre
obrazovka = CSV). Audit presunu **naživo neoverený** — lokálny server píše do
ostrej databázy a záznam v audite sa nedá zmazať. Kladný prípad filtra
oddelenia tiež nie: v SFZ ho zatiaľ nemá vyplnený žiadny dokument.

Chyba na mojej strane: `npm run build` som pustil pri bežiacom `next dev`,
hoci NEXT.md varuje, že zdieľajú `.next`. Tentoraz dev server prežil;
nabudúce ho najprv zastaviť.

---

## 2026-09-23 (5) — prechod do VS Code, zodpovedná osoba, `text-decoration`, plán D93

**Prvé sedenie v Claude Code vo VS Code na Jánovom Macu**, nie na claude.ai.
Repozitár už bol v `~/GitHub/contineo`, stačilo overiť, že sedí s `origin`,
a spustiť sadu proti baseline. Pamäť z predošlých sedení sa neprenáša — nesie
ju `CLAUDE.md`, `NEXT.md` a `docs/`, a stačilo to. Pri „Zorientuj sa" NEXT.md
ešte nepoznal PR #79; povedané nahlas, opravené upratovaním #81.

**Zodpovedná osoba pre všetky platné znenia je Ján** (jeho pokyn: „všade
pridaj mňa"). Skript `set_responsible.mjs` zapisuje cez `setVersionResponsible()`,
nie priamo do kolekcie — história v `responsibleChanges[]` a audit vznikli
rovnako ako z obrazovky. Nahradené znenia (2) som nechal: spätne dopísaná
osoba by tvrdila, že za ne vtedy niekto zodpovedal. Záloha pred zápisom
v `private/zalohy/`. Právny základ som nevyberal — to je rozhodnutie
zodpovednej osoby, nie skriptu.

**„Založ číselník podľa návrhu" znamenalo menej, než to znelo** — číselník
už v kóde bol od D92 a každá organizácia ho mala. Rozdiel proti dokumentu
pre Švehlovú boli štyri texty; kľúče sa nemenili, takže sa nič nerozviazalo.

**`text-decoration`: čítanie by jedno pravidlo zmazalo zle.** Prešiel som
všetky výskyty tried cez AST (je to odkaz? je v `<p>` alebo pod triedou,
ktorá podčiarknutie vracia?) a z 29 vyšli 3, ktoré zostať musia. Potom som
porovnal vypočítaný `text-decoration-line` so starým a novým CSS v Chrome
pri 390 a 1440 px — a našiel sa štvrtý: `.bulk-clear` je podčiarknutý
zámerne a jeho `none` v `@media` ruší **vlastné** pravidlo, nie koreň.
Z AST sa to vidieť nedalo, lebo nejde o predka, ale o zlom. Poučenie:
pri mazaní CSS porovnávať vypočítané hodnoty, nie selektory.

Obrazovky som po prihlásení **nevidel** — lokálne prihlásenie by chcelo
zápis relácie do ostrej databázy a to bez výslovného súhlasu nerobím.

**Plán D93** (výber podľa filtra) pripravil podagent, tri jeho nálezy som
overil v kóde sám, kým šli do dokumentu: presun do priečinka nezapisuje
audit, CSV ignoruje filter oddelenia a „z toho N mimo" počíta proti strane.
Prvé dva sú chyby nezávislé od rozhodnutia o variante.

Zlúčené PR #82–#84 na Jánov pokyn, všetky zlúčené vetvy zmazané
(`--no-merged` vrátil nulu). Na `origin` zostal jediný `main`.

---

## 2026-09-23 (4) — číselník právnych základov (D92)

Ján navrhol, aby odkaz na zákon nebol voľný text, ale číselník s predvyplnenými
položkami. Rozdelil som to na dve úrovne: **kategória** zostáva v kóde (riadi
výmaz a námietku, organizácia ju meniť nemá) a **položka** je v číselníku.
Štandardné položky sú v JSON, aby ich každá organizácia mala bez migrácie; tie
isté kľúče si organizácia vie skryť, ale nie prepísať.

Predvyplnené odkazy **nie sú overené** — pri ochrane pred požiarmi a oznamovateľoch
chýba paragraf. Nechcel som si ich vymyslieť, preto šli Švehlovej ako samostatný
dokument na kontrolu (druhé kolo už bolo odoslané). Do JSON sa opravia po odpovedi.

Mobile som znova neoveril očami — lokálne treba prihlásenie.

**Nasadené** (PR #80, merge `555a958`) na Jánov pokyn aj pred odpoveďou DPO;
korekcie číselníka prídu, keď Švehlová pošle dokument späť.

---

## 2026-09-23 (3) — odpovede DPO k O15/O16 a zodpovedná osoba pri znení (D91)

**Odpovede prišli v revízii Wordu a prvýkrát som ich prečítal zle.** DPO
nezaškrtávala políčka, ale zvolenú možnosť podfarbila červenou. Moja extrakcia
hľadala len červený *text*, tak som hlásil „odpovedala na 6 z 21". Ján ma
opravil; po prečítaní podfarbenia (`w:highlight`) je zodpovedaných 15.
Pravidlo do budúcna: pri revízii od človeka hľadať text, farbu textu,
zvýraznenie aj revízie — nie len to, čo som si vopred myslel, že tam bude.

**A1 zmenilo model.** Namiesto jedného právneho základu pre všetko DPO chce
kategóriu podľa predpisu (zákonná povinnosť, alebo oprávnený záujem). Plán
som trikrát prepracoval podľa Jánových odpovedí, a zakaždým to bolo správne:

1. najprv rola `legal`, ktorá smie meniť základ;
2. potom zodpovedná osoba pri **predpise** — lebo ľudia potrebujú vedieť,
   na koho sa obrátiť, a garanti sú z rôznych oddelení;
3. nakoniec pri **znení**, povinná a nededená — lebo novela súťažného
   poriadku o tri roky môže mať iného garanta a pôvodný mohol odísť.

Z tretej verzie vypadla rola úplne: kto smie určiť základ, sa **odvodzuje**
z toho, kto je zodpovednou osobou znenia (D27). Správca obsahu je náhradník.

**Kde je formulár.** Knižnica je len pre `content-admin`, zodpovedná osoba ním
byť nemusí. Formulár je preto na stránke znenia pre čitateľa a zvonček
(`responsibleAssigned`) vedie tam. Oprávnenie stráži `setVersionLegalBasis()`
proti uloženému zneniu, nie obrazovka.

**Čo som neoveril:** vzhľad na telefóne. Lokálny dev server chce prihlásenie
a to za Jána robiť nebudem. Formuláre používajú existujúce triedy
(`approval-people`, `hr-choice`, `field`), ktoré sú na mobile odskúšané
z výberu schvaľovateľov, ale oko na to treba.

**Čo zostáva:** druhé kolo otázok pre DPO (B1 číslo a strop, B5–B7, časť C,
§6 a čl. 21, osoby bez pracovného pomeru); lehoty v databáze až potom.
Evidencia na obrazovke odtlačok ešte neukazuje, výkaz áno.

---

## 2026-09-23 (2) — výpadok knižnice s filtrom a brzda, ktorá ho nabudúce zastaví

**Po zlúčení PR #75 knižnica spadla pri každom filtri.** Bez filtra fungovala,
s akýmkoľvek facetom vrátila „A server error occurred". Runtime log Vercelu:
`ReferenceError: Cannot access 'aZ' before initialization` v `Array.map`,
digest `1208623390`.

**Príčinou bolo poradie deklarácií.** `activeNames` stálo v súbore nad
`facetLabel` a siahalo naň. Pole sa vyhodnocuje v mieste zápisu, takže `.map`
bežal ihneď a `facetLabel` bol v tej chvíli ešte v dočasnej mŕtvej zóne —
`const` o sedemdesiat riadkov nižšie. Oprava je presun deklarácie, nič iné.

**Prečo to nikto nevidel:** bez filtra vráti `activeChips(filters)` prázdne
pole, callback sa nezavolá a k `facetLabel` sa nikdy nesiahne. Stránka teda
fungovala presne dovtedy, kým človek nepoužil filter.

**A tu je moja chyba, nie tá v kóde.** Pol hodiny predtým som Jánovi napísal,
že je všetko nasadené, a meral som pritom prázdnu knižnicu: nadpis, pätičku,
panel, hlavičku. Ani raz som nezafiltroval. Overoval som **to, čo som menil**,
namiesto toho, čo ľudia s tou obrazovkou robia. Knižnica je nástroj na
hľadanie; keď ju nasadím a nevyskúšam filter, neoveril som ju vôbec.

**Druhá chyba, tentokrát v diagnostike.** Prvý pokus reprodukovať som robil
cez `fetch` a pozeral len stavový kód. Osem adries vrátilo 200 a na chvíľu som
si myslel, že chyba neexistuje. Next totiž chybovú stránku servíruje s kódom
**200**. Až keď som pozrel telo odpovede, bolo to vidieť okamžite. Pravidlo do
budúcna: pri overovaní stránky sa pozerá do tela, nie na stavový kód.

**Zo štyroch bŕzd nezastavila výpadok ani jedna, a stojí za to vedieť prečo.**
`tsc` hlási `TS2448` len pri priamom odkaze v tom istom mieste; náš odkaz bol
vnútri callbacku pre `.map` a telo funkcie je pre kompilátor **odložené
vykonanie** — nemá ako vedieť, že sa zavolá ihneď a nie o hodinu. Mlčal teda
správne. Testy tú stránku nevykresľujú. `next build` prešiel, lebo je to chyba
za behu. ESLint mal pravidlo vypnuté.

**Zapnuté je odteraz `@typescript-eslint/no-use-before-define` ako chyba**
(PR #77). Rieši to hrubšie než TypeScript: neuvažuje, kedy sa callback zavolá,
a ohlási samotný odkaz nahor. Práve tá hrubosť je cenná. Overené tak, že som
chybu vrátil späť do kódu — `tsc` naďalej nula, eslint dve chyby s menom
`facetLabel` — a až potom ju zase odstránil.

Pravidlo našlo ešte tri miesta a **ani jedno nebola chyba**: `fieldStyle`
v `Rating.tsx` je modulová konštanta v JSX, ktoré sa kreslí až po dobehnutí
modulu, a `currentTenant` v `session.ts` sa volá vnútri async funkcie. Obe by
za behu prešli. Presunul som ich, lebo inak sa pravidlo nedá zapnúť ako chyba,
a ako varovanie by dnešok nezastavilo. Sú to čisté presuny — toľko riadkov
pribudlo, koľko ubudlo, ani jeden riadok kódu sa nezmenil.

**Čo si z toho odnášam okrem pravidla:** dve zo štyroch dnešných chýb boli
v overovaní, nie v kóde. Prvá bola v tom, čo som overil (svoju zmenu, nie
použitie obrazovky), druhá v tom, ako (stavový kód namiesto tela odpovede).
Pravidlo v ESLinte chytí len tú prvú triedu problémov. Druhá sa dá ošetriť
len návykom.

---

## 2026-09-23 — výpadok produkcie, knižnica proti MASTER.md a rámy 1–8

**Deň začal tým, že `/library/new` na produkcii nešla vôbec.** Hláška „A server
error occurred" a v runtime logoch Vercelu dôvod: funkcia sa nedá serializovať
cez hranicu servera a klienta. Vinník bol slovníkový kľúč `keyTaken`, ktorý bol
napísaný ako funkcia `(id) => string` a odovzdával sa klientskemu komponentu ako
prop. Na serveri to roky fungovalo; v klientskom komponente to padne vždy.
Prerobené na šablónu s `{id}`, ktorú si komponent dosadí sám. To isté bolo na
`/admin/new` — našiel som to až keď som hľadal druhý výskyt namiesto toho, aby
som opravil ten nahlásený a šiel ďalej.

**`tsc` túto chybu nevie chytiť a nikdy nebude.** Typ `(id: string) => string` je
úplne platný typ; chybné je až to, že hodnota toho typu prekročí hranicu RSC.
Preto k oprave pribudol test, ktorý prejde každý `"use client"` súbor pod
`src/components` a `src/app` a hľadá prop, ktorého typ sa končí na `=> string`.
Overil som ho tak, že som chybu zámerne vrátil — test spadol — a až potom ju
zase odstránil. Test, ktorý som nevidel padnúť, nič nedokazuje.

**Potom prišlo šesť bodov, v ktorých knižnica nesedí s `MASTER.md`.** Ján chcel
najprv vedieť, čo je regresia z dizajnového handoffu a čo tam bolo vždy.
`git log -S` na každý z nich: päť z nich je staršie než PR #46–#62, handoff ich
len zviditeľnil. Regresia bola čiastočne jedna — stavová pilulka je nová
(`49c7beb`, 21. 9.), ale napojila sa na už existujúce množné facetové reťazce.
Toto poradie — najprv zistiť, odkiaľ vec pochádza, až potom ju opravovať — stálo
polhodinu a ušetrilo hádanie v troch ďalších bodoch.

**Pilulka stavu nemala vetvu pre expirovaný** a prepadla do predvolenej, takže
expirovaný dokument hlásil „koncept". To nie je nepresné slovo, to je nesprávny
stav. Odvodenie je teraz v `displayStatus()` hneď vedľa `statusTagClass()`, aby
farba aj názov vychádzali z jedného výpočtu; `asOf` je parameter, nie
`new Date()` vnútri, inak sa to nedá otestovať inak než čakaním.

**Podčiarknutie odkazov sa vyriešilo koreňovo** — `a { text-decoration: none }`
a výslovné vrátenie v bežnom texte. Prešiel som po tom 22 odkazov na
jedenástich obrazovkách. Tri by sa tým zhoršili a doplnili sa do pravidla:
`.field-hint` a `.ask-error` sú bežné vety s odkazom uprostred, len nie sú v
`<p>`, a `.directory-contact` je vedomá odchýlka — e-mail a telefón v adresári
majú vyzerať ako odkazy, lebo adresár existuje práve na to. Tridsať pravidiel,
ktoré si podčiarknutie potláčali samy, tým stratilo dôvod; neodstránil som ich,
je to samostatné upratovanie.

**K expirovanému facetu som odmietol siahnuť, kým to builder nevie.** Ján
rozhodol podľa `MASTER.md`, že expirovaný nie je hodnota facetu, ale odvodený
príznak, a chcel ho preložiť na podmienku „Platné do · pred · dnes". Overil som,
či to query builder vie — nevedel: pole `effectiveTo` v ňom nebolo a hodnota sa
čítala cez `new Date(c.value)`, takže slovo „dnes" by skončilo ako `Invalid
Date`. Napísal som to a nerobil to. Rozdelilo sa to na dva PR: najprv builder
dostal pole aj token, až potom facet odišiel.

**Najcennejšia časť tých dvoch PR je pasca s `effectiveTo` na znení.** Koniec
platnosti nie je na dokumente, je na každom znení zvlášť, takže naivné
`effectiveTo < dnes` by vrátilo aj dokument, ktorý má jedno staré znenie
a jedno platné. Preto `$not: { $elemMatch: … }` — žiadne znenie nie je platné.
A preto som `expiredCondition()` **nechal ako samostatný kód** a neprepísal ju
tak, aby volala nový builder: test tvrdí, že obe cesty vrátia ten istý dotaz,
a keby jedna volala druhú, netvrdil by nič.

**Chyba, ktorú som spravil ja: prepísal som `MASTER.md` staršou kópiou.** Ján
poslal súbor, ja som ho commitol a tým ticho zmizlo 36 riadkov vrátane
varovania, ktoré sám predtým označil za dôležitejšie než ten nesprávny stĺpec.
Všimol som si to až po pushnutí. Obnovené cez `git checkout <vetva> -- súbor`
a overené, že proti predchádzajúcemu stavu neubudol ani riadok. Poučenie je
konkrétne: **pri celosúborovej kópii sa pozerám, koľko riadkov ubudlo**, nie
koľko pribudlo. Ján odvtedy posiela len konkrétne sekcie s miestom, kam patria.

**Zvyšok noci a ráno išli rámy z `KNIZNICA.html`, jeden po druhom.** Postup,
ktorý sa osvedčil: vykreslím rám, vykreslím našu značku pod naším `globals.css`
a porovnám **vypočítané hodnoty prvok po prvku**. Čítaním CSS by sa nenašlo nič
z toho, čo sa našlo — že „Nezaradené" sa zarovnalo vpravo, lebo
`span:last-child { margin-left: auto }` platilo aj na riadok bez počtu; že
`auto-fill minmax(250px, 1fr)` dáva na tablete tri stĺpce tam, kde rám má dva;
že akcie v hlavičke končia na 973 px zo 1408.

**Panel filtrov nebol karta a prišiel som na to až na druhý raz.** V prvom kole
som porovnával pravidlo `.library-folders` proti pravidlu `.library-folders`
a sedelo. Vzhľad karty ale v ráme nesie **druhá trieda v tej istej značke**
(`class="card library-folders"`), takže panel u nás bol priehľadný a bez okraja
— presne to, na čo sa Ján sťažoval slovami „filtre a priečinky vľavo nesedia".
Poučenie: porovnávať celý `class`, nie jeho hlavnú časť.

**Chrome sa celý deň nedal spoľahlivo zmenšiť** — zostával na 500 px a hlásil
`outerWidth: 0`. Overovanie sa preto presťahovalo do Playwrightu v kontajneri,
kde sa načíta skutočný `globals.css`. Bolo to rýchlejšie aj presnejšie, lebo sa
dá merať, nie pozerať. Neskoro večer Chrome zafungoval a doplatil sa dlh:
kontrola tabuľky pri 1440 px, stĺpec obsahu presne 1138 px, bez vodorovného
posunu.

**Jazyková chyba, ktorú by test nechytil:** moja funkcia na skloňovanie by
napísala „Máte nasadených 2 filtre". Správne je „nasadené". Prepísané na vetvy
1 / 2–4 / 5+ pre slovenčinu aj češtinu. A do commit správy sa mi raz dostala
azbuka („brało"); odvtedy každú správu pred commitom preženiem skriptom, ktorý
hľadá cyriliku.

**Čo zostalo otvorené:** PR #75 je otvorený a nezlúčený; tridsať nadbytočných
`text-decoration: none` čaká na samostatné upratovanie; a `.page-head` má
medzeru 12 px a spodný odstup 6 px proti rámovým 10 a 14 — triedu zdieľa
`/hr/evidence`, takže to nie je zmena do PR o knižnici.

---

## 2026-09-22 (3) — web na Next 16, upratané vetvy a téma bez stavu

**Tri PR sa zlúčili po jednom, nie naraz.** Na rozdiel od včerajšieho stohu
(17 PR jedným merge commitom) išli #65 → #66 → #67 samostatne: každý menil
niečo iné a každý si zaslúžil vlastné nasadenie. Po #66 a #67 bolo treba
prebázovať základ ďalšieho PR na `main` — GitHub to sám nerobí, kým sa
pôvodná vetva nezmaže. Overené naostro: `https://contineo.app/` vracia **200**
s OG značkami aj obrázkom, teda oprava koreňa z #67 naozaj funguje tam,
kde na nej záleží.

**`web/` povýšený z Next 14 na 16.** Podmienka bola jednoduchá — `app/` na
16.3.3 už mesiac beží, takže `web/` na 14 znamenal dve sady konvencií
v jednom repozitári. Rozsah vyšiel menší, než príručka naznačuje: `web/`
nepoužíva `next/image`, nemá jediný `fetch()`, žiadne paralelné cesty ani
webpack konfiguráciu, takže väčšina kapitol o zmenách bola bezpredmetná.
Zostali štyri veci: verzie, asynchrónne `params` (26 miest v 17 súboroch),
`middleware.js` → `proxy.js` a `next lint` → plochý ESLint.

**React zostal na 18.3.1 zámerne.** Príručka odporúča povýšiť ho spolu
s Next, ale `app/` beží na Next 16 s Reactom 18.3.1 v produkcii — to nie je
teória, to je fakt z `node_modules`. Jedna premenná menej v migrácii, ktorá
sa aj tak dotýka sedemnástich súborov.

**Jediná tichá zmena boli `params`.** Ostatné by pri chybe spadli hlasno.
`params.lang` by v Next 16 nevrátil chybu, ale `undefined` — stránka by sa
postavila, len bez slovníka. Preto sa menili exaktným porovnaním s kontrolou
počtu zásahov, nie regexom cez súbory naslepo.

**`npm install` padol prvý raz na `ENOTEMPTY`** pri odstraňovaní starého
`next` — `package.json` sa už prepísal, ale `node_modules` zostali rozbité
uprostred. Druhý, obyčajný `npm install` to dorovnal. Nestálo to nič okrem
minúty, ale je dobré vedieť, že to nie je dôvod mazať `node_modules`.

**Turbopack varoval na súbor, ktorý s projektom nemal nič spoločné.**
Build hlásil, že ignoruje `package-lock.json` v `/Users/janletko`. V domovskom
priečinku ležal 87-bajtový prázdny zámok z 14. júna — bez `package.json`, bez
`node_modules`. Vznikol tak, že niekto pustil inštalačný príkaz v termináli,
ktorý štartuje v `~`, a npm si názov doplnil z priečinka (`"name": "janletko"`).
Turbopack hľadá koreň projektu smerom nahor a tento zámok našiel prvý; keďže
leží mimo gitu, správne ho ignoroval. Presunutý do Koša, nie zmazaný natvrdo —
je to súbor v používateľovom domove. Build je odvtedy **úplne bez varovania**
a `turbopack.root` v konfigurácii netreba: príčina je preč, nie zamaskovaná.

**Pri hlásení som ten súbor pomenoval zle** — napísal som `package.json`,
hoci išlo o `package-lock.json`. Ján sa oprávnene pýtal, ako sa tam dostal
`package.json`, lebo taký tam nikdy nebol. Rozdiel jedného slova poslal
otázku úplne inam.

**Vetvy upratané: 64 vzdialených a 64 lokálnych.** `git branch -r --no-merged
origin/main` vrátil nulu, takže žiadna z nich nenesie prácu, ktorá by nebola
v `main`. Lokálne sa mazali cez `git branch -d` (nie `-D`) — git tak sám
odmietne vetvu, ktorá by zlúčená nebola, a poistka nestojí nič. Zostal len
`main`, lokálne aj na `origin`. Bolo to v `docs/TODO.md` od zlúčenia handoffu
a čakalo to výhradne na súhlas.

**`ThemeToggle` prestal mať stav.** `eslint-config-next@16` priniesol pravidlo
`react-hooks/set-state-in-effect` a v tomto komponente malo pravdu. Pri
povýšení verzie sa neprepisoval — miešať migráciu s prestavbou komponentu je
presne to, po čom sa v diffe nedá nič nájsť — a zostal ako výstraha. Vyriešil
sa hneď potom, samostatne.

Podstata: téma nikdy nebola stav komponentu. Žije v atribúte `data-theme` na
`<html>` a nastavuje ju vložený skript v `app/layout.js`. Komponent si ju
zrkadlil do `useState` cez `useEffect` — dva zdroje pravdy a vykreslenie
navyše pri každom načítaní. `useSyncExternalStore` číta atribút priamo
a prihlasuje sa `MutationObserverom`, takže `setState` zmizol aj z prepínača:
zapíše atribút a o prekreslenie sa postará pozorovateľ. S ním odišiel aj
príznak `mounted` — `getServerSnapshot` rieši zhodu servera a klienta priamo.

**Že to nebliká, sa dalo overiť, nie iba tvrdiť.** V HTML zo servera je
synchronný `<script>` na pozícii 3423 a `<body>` začína až na 3823 — atribút
je teda nastavený pred parsovaním tela, a teda pred prvým pixelom. Server
vykreslí výhradne mesiac (svetlá téma), slnko ani raz, takže hydratácia beží
na hodnote, ktorú `getServerSnapshot` sľubuje. V konzole po tvrdom načítaní
v tmavej téme nie je ani jedno varovanie Reactu o hydratácii — všetkých sedem
hlášok je z rozšírenia prehliadača, nie zo stránky.

**Mobil sa opäť neoveril naživo.** Chrome na Macu sa nedá zúžiť pod šírku
okna; `resize_window` hlási úspech a snímka je ďalej 1501 px. Namiesto tvrdenia
zostáva doklad: v celej vetve sa nezmenil ani jeden CSS súbor (`git diff
--name-only` na `web/**/*.css` je prázdny) a jediná zmena v značkách je atribút
na `<html>`. Rozloženie sa teda zmeniť nemohlo. Skutočná mobilná kontrola
patrí na telefón, nie do tohto prehliadača.

---

## 2026-09-22 (2) — nasadenie do produkcie a migrácia O21 krok 2

**Stoh sa zlúčil do `main` naraz.** Sedemnásť zreťazených PR (#46–#62, 105
commitov) išlo do `main` jedným merge commitom `415d5d7`. Alternatíva —
zlučovať zdola nahor po jednom — by znamenala sedemnásť nasadení a v každom
medzistave nedokončený handoff na ostrom intranete. Skúšobné zlúčenie
(`git merge-tree`) neukázalo ani jeden konflikt, čo je čakateľné: vetvy boli
lineárne a `main` sa medzitým nepohla. Podriadené PR sa nezavreli samy —
ich základom boli vetvy, nie `main` — takže dostali komentár, kde ich práca
skončila, a zavreli sa ručne. **Žiadna vetva sa nemazala.**

**Rituál „Zorientuj sa" dostal, na čom stáť.** Preferencia hovorí načítať
`CLAUDE.md`, `NEXT.md`, `git log -20` a vetvu; `NEXT.md` v repozitári nebol
a jeho úlohu suploval `docs/TODO.md` s 833 riadkami. Orientovať sa v ňom pri
štarte je presný opak toho, na čo rituál je. `NEXT.md` je teraz jedna strana
a platí preň jedno pravidlo: **aktualizuje sa výhradne pri „Poupratuj"**.
Inak by z neho bol tretí zdroj pravdy, ktorý klame — presne to, čo sme
v `TODO.md` deň predtým opravovali.

Hneď sa to aj potvrdilo: po zlúčení `NEXT.md` tvrdil „17 otvorených PR, nič
v `main`". Nepravda stará dvadsať minút. Prepísal sa v tom istom ťahu.

**ADR sa presťahovali do `docs/decisions/`.** Rituál „Rozhodni" s tým
priečinkom počítal, v repozitári nebol a ADR ležali priamo v `docs/`
pomiešané s plánmi a koncepciami. `docs/decisions/` je konvencia MADR, čiže
nie vymyslené miesto. Desať súborov cez `git mv` (história zostala), 51
odkazov s cestou prepísaných v 27 súboroch. **Názvy sa nemenili** — MADR
odporúča `0006-nazov.md`, ale „ADR-006" je v repozitári použité asi 400-krát
ako identita rozhodnutia. Z konvencie sa oplatí vziať priečinok a nechať
číslovanie; opačne by to znamenalo veľký diff naprieč kódom výmenou za nič.

**Migrácia `sectionKey` → `category` prebehla na produkčných dátach.**
Desať dokumentov: deväť malo druh „norma" a prišlo len o zaradenie, jednému
(`sfz:test_onboarding`) zaradenie „smernice" doplnilo druh „smernica".
Žiadne neznáme zaradenie, žiadny dokument bez `documentKey` — kontrola, na
ktorej skript inak zastane, lebo bez kľúča je zaradenie záložná identita
a jeho odstránenie by pri najbližšej úprave metadát zmenilo `documentId`
a rozviazalo potvrdenia. Z `document_chunks` odišlo `sectionKey` z **1991**
úsekov. Pred zápisom sa odložila snímka pôvodných hodnôt do
`private/zalohy/` — nie preto, že by sa čakal problém, ale preto, že
`$unset` sa inak nedá vrátiť.

Čo stálo za overenie: Atlas index má `sectionKey` ako filter aj token
(`scripts/atlas_init.mjs`). Chýbajúce pole Atlas Search znesie a dotazy sa
naň už nepýtajú, takže to bola len zbytočnosť, nie porucha — potvrdené
otázkou na ostrom intranete hneď po migrácii: osem doslovných citácií,
odpoveď v poriadku. Index sa prekreslí pri najbližšom preindexovaní.

**Testovanie na produkcii našlo dve veci, ktoré testy nenašli.** Prvá:
prázdny stav knižnice nerozlišuje „nič tu nie je" od „filtru nič
nevyhovuje" — podmienka pozerá len na text hľadania. Riadok je z 18. 9.,
čiže nie regresia z handoffu; viditeľný je až teraz, lebo filter
„expirované" vracia nulu najčastejšie. Druhá: stupne zhody vyšli všetky
rovnaké, päťkrát „vysoká". Po reranku sú prvé zdroje tesne pri sebe, takže
podiel voči najlepšiemu takmer vždy prekročí 0,8. Obe zapísané, ani jedna
opravená — prvá je zmena textu na obrazovke, druhá by bola ladenie prahov
od stola.

Poučenie dňa: **jednotkové testy nepovedia, či obrazovka hovorí pravdu.**
Oba nálezy vyšli z troch minút klikania na živej aplikácii.

**Pri upratovaní po migrácii klamali dva komentáre v kóde.** `codelists.ts`
tvrdil, že `sectionKey` „v dátach starých dokumentov zostáva" — hodinu po
migrácii už nezostával nikde. `libraryWrite.ts` písal o záložnej identite
dokumentov spred D80 vetou „a to sa nemení", ktorá sa práve zmenila. Ani jeden
nebol chybný, keď vznikal; oba prestali platiť zmenou dát, nie kódu — a tým
sa dajú prehliadnuť najlepšie, lebo testy ani prekladač o tom nič nevedia.
Opravené na stav veci, spätný pád v kóde zostal (je mŕtvy v tomto tenantovi,
nie v kóde, ktorý obsluhuje aj ďalšie).

Zvyšné zmienky o `TODO` v kóde sú odkazy do `docs/TODO.md`, nie zabudnuté
značky — prešlé, v poriadku. Pracovný strom je čistý, všetko pushnuté,
nula otvorených PR.

**Čo sa neupratovalo:** v repozitári je **58 vzdialených vetiev, ktorých práca
je celá v `main`**. Mazanie vetvy je výslovný súhlas Jána, takže zostávajú
— zapísané sem, aby sa na to nečakalo ako na náhodu.

---


## 2026-09-22 — celý handoff (PR 0–14), oprava dátovej straty v importe a dorábky

**Handoff je hotový: PR 0 až 14, zreťazené jeden na druhom.** Dnes pribudli
PR 9a/9b (Správa), 10–12 (HR), 13 (Osoby) a 14 (Admin a Príručka). Každý PR
má commit na úlohu, zápis v `TODO.md` vrátane odchýlok a otázky v tele PR
namiesto dotvárania z hlavy. Zadanie sa nikde nedopĺňalo domyslením — kde
návrh popisoval niečo, čo v kóde nie je, odišla otázka do PR.

**Najdôležitejšie zistenie dňa nie je z dizajnu, ale z kódu: import osôb
mazal ľuďom roly.** `upsertPersons()` zapisovalo `tracks`, `groups` a `roles`
vždy, takže súbor bez stĺpca ich existujúcim ľuďom vyprázdnil — a `roles`
CSV nerozpoznáva vôbec, takže **každý import zmazal roly každému, koho sa
dotkol**. Našlo sa to pri PR 13, keď som pre obrazovku importu zisťoval, čo
sa vlastne stane s existujúcou osobou; zadanie to viedlo ako „napíš, ako sa
to chová". Napísalo sa aj opravilo: chýbajúce pole znamená „o tomto nič
nehovorím", prázdne znamená „vyprázdni". Rozdiel vie rozlíšiť len čítanie
CSV, kde vidno hlavičky (`hasField()`) — dovtedy prázdna bunka padala do
`undefined` rovnako ako chýbajúci stĺpec, takže vyprázdniť sa nedalo vôbec.

**Poučenie, ktoré sa opakuje tretíkrát: TODO klame skôr než kód.** Pri
otázke „čo ešte treba dorobiť" sa ukázalo, že dve z piatich „chýbajúcich"
vecí sú dávno hotové — dokument oddelenie **nesie** (`ownerDepartmentId`,
facet aj stĺpec) a percento potvrdení kreslí `.ack-bar` v tabuľke aj na
karte. Zápisy boli spred PR 7/8 knižnice a nikto ich neodškrtol. Odškrtnuté
dnes, s poznámkou, kedy vznikli.

**Zhoda zdroja: tri stupne namiesto čísla.** Surové `score` sa ukázať nedalo
— pri `$rankFusion` a `$rerank` nie je v rozsahu 0–1 a medzi režimami
hľadania nie je porovnateľné, takže „0,94" by predstieralo presnosť, ktorú
nemá. Stupeň sa počíta **relatívne k najlepšiemu zdroju tej istej odpovede**:
to je porovnanie, ktoré dáva zmysel, lebo presne tú otázku si človek kladie.
Bez skóre sa nekreslí nič.

**Expirované je štvrtá hodnota filtra, nie štvrtý stav.** Expirovaná norma je
publikovaná norma po dátume — stav dokumentu zostáva `published` (D27).
Podmienka sa preto skladá dotazom (`expiredCondition()`): publikovaný
dokument, ktorý dnes nemá platné znenie, hoci aspoň jedno už mal. To isté
pravidlo, aké v JS počíta `effectiveVersion()`; v databáze preto, že zoznam
je stránkovaný.

**Strop výberu 200.** Výber v knižnici sa nesie v adrese, aby prežil prechod
na ďalšiu stranu a fungoval bez skriptu; pri 148 označených je to ~4 kB a bez
rezervy k hranici 8 kB. Strop nie je riešenie princípu, ale zabraňuje tichému
pretečeniu — bez neho sa adresa niekde oreže a výber zmizne bez vysvetlenia.
Správna odpoveď pri väčších dávkach je „všetko, čo vyhovuje filtru" ako jeden
príznak; zapísané ako otvorená vec.

**O21 krok 2 — Zaradenie sa zlúčilo do Druhu.** Ukázalo sa, že to nie je
premenovanie: `sectionKey` hovoril *kam dokument patrí* (Stanovy, Zápisnice,
Zmluvy), `category` hovorí *čo to je* (norma, smernica, zákon). Mapovanie
bolo treba vyrobiť — pravidlo „poriadok je norma" a tri nové druhy
(zápisnica, zmluva, tlačivo), lebo inak by import zo zaradenia musel klamať.
Migračný skript **odmietne zapísať čokoľvek**, kým existuje dokument bez
`documentKey`: zaradenie je jeho záložná identita a odstrániť ho skôr by pri
najbližšej úprave metadát zmenilo `documentId` a rozviazalo potvrdenia, úseky
aj pridelenia. Skript je napísaný a nespustený.

**Čo stálo čas:** dvakrát som si regexom s `re.S` zmazal viac riadkov v
`TODO.md`, než som chcel — raz to spojilo zápisy dvoch PR. Oboje som zachytil
pri kontrole diffu pred commitom, ale je to zbytočné riziko: pri úprave
jedného riadku dlhého súboru sa má hľadať v tom riadku, nie v celom texte.

---

## 2026-09-21 (2) — výmena handoffu a kontrola konzistencie

**`docs/design/` vymenil kompletný handoff všetkých obrazoviek** (`ae9d2ea`):
21 `.md` + 9 `.html`, stará vlna (NASADENIE.md, SPRAVCA.md, OSOBY.html,
`.dc.html` šablóny, support.js) odišla. Pred implementáciou som handoff
prečítal celý a porovnal s kódom — nič sa ešte neimplementovalo.

**MASTER tvrdil „31 rout, úplné" — kód má obrazoviek viac.** Päť skutočných
obrazoviek (`/admin/new`, `/admin/tenants/[code]`, `/hr/[id]/notify`,
`/library/[id]/text`, `/library/tracks/[key]`) zadanie nemá; v kóde sú od
augusta a septembra. Najkrikľavejšie: `SPRAVA.md` úloha 1.3 tvrdila, že
úprava krokov trasy neexistuje a „kroky sa prideľujú inde" — pritom
`/library/tracks/[key]` s pridávaním, odoberaním a posúvaním krokov žije
od 6. 9. To isté poučenie ako pri README: dokumentácia je indícia, kód je
pravda — a platí to aj na deň starý handoff.

Menšie pozostatky starších verzií textov: POSTUP mal v úvode „8 z 31",
ZADANIE „PR 15" namiesto PR 12, POSUDENIE a SPRAVA zlé čísla častí HTML
referencií, INDEX tvrdil, že `.dc.html` sú v koreni repa. Opravené; MASTER
dostal sekciu „Obrazovky mimo handoffu" a výnimku pre jediný JS prvok
(ZNENIE úloha 4). TODO.md dostal sekciu tretej vlny, stará (NASADENIE)
je uzavretá ako história, DESIGN_GAP má poznámku o odídených súboroch.

Odkazy na NASADENIE v komentároch kódu (~30 miest v `globals.css`,
`Header.tsx`, …) nechávam — sú to citácie zdroja rozhodnutí, nie funkčné
odkazy na súbor.

## 2026-09-21 — kontrola proti vzoru a PR 7

**Ján porovnal produkciu so vzorom a mal pravdu vo všetkom podstatnom.**
Najväčší kus: hľadanie a Podmienky som v PR 4 nechal cez celú šírku nad
mriežkou, lebo NASADENIE ich v odrážkach nespomínalo — ale vzor ich má
v stĺpci zoznamu. Poučenie: odrážky plánu nie sú celý návrh; obrazovka
v `.dc.html` je záväznejšia než zoznam bodov, ktorý z nej niekto vypísal.

**„Viac 1" na širokom monitore mal dve príčiny naraz.** Prvá moja: dvojník
merania kreslil všetky položky v aktívnom (hrubšom) reze — „opatrné"
meranie, ktoré prepad hlásilo aj tam, kde nebol. Druhá koncepčná: pás mal
pri každej položke ikonu, ktorú vzor nemá — 10 × ~23 px navyše sa do
shellu nezmestí nikdy. Textový pás + presné meranie a všetkých desať
položiek sedí.

**„Norma (norma)" nebol v dátach, ale v kóde** — `codelistOptions()`
lepil kľúč do popisku. Deň predtým som pri README správne povedal „kód je
pravda, dokumentácia klame" a dnes to platilo naopak: kód klamal oku.
Kľúč je adresa pre stroj; kde ho správca potrebuje, ukáže sa zvlášť.

**Dve zvrátené rozhodnutia z NASADENIA, obe Jánove a obe správne:**
zvonček znova ukazuje počet (bodka hovorí „niečo", číslo „koľko")
a `layout.tsx` dostal svoju prvú zmenu — `viewport-fit=cover` — po
výslovnom súhlase. Frozen súbor nie je zakázaný súbor; je to súbor,
ktorý sa mení nahlas.

**Otvorené pre solo handoff Knižnice** (Ján ho pripraví v dizajnovom
projekte): „Uložiť pohľad", presné stĺpce tabuľky (Zmenené, Potvrdenia %
— to druhé čaká aj na dáta), správanie chips pri podmienkach.

**Pozvánka, ktorá nikdy neodišla.** Ján hlásil, že pozvaná kolegyňa nedostala
e-mail. V databáze bola v poriadku — `status: invited`, `firstLoginAt` chýba.
Chyba bola v kóde a bola to tá najnepríjemnejšia trieda chýb: `grep 'send('`
v `people/actions.ts` vrátil **jediný** výskyt, a ten bol v hromadnej akcii.
Formulár „Pozvať osobu" osobu len zapísal a ohlásil „Pozvaná" — hláška hovorila
o evidencii, používateľ ju čítal ako o pošte. Nikde nespadla výnimka, nikde
nebol červený log; systém robil presne to, čo mal napísané, len to nikto
nechcel.

Poučenie do ďalšieho čítania kódu: **hláška po akcii je tvrdenie o tom, čo sa
stalo.** „Pozvaná" pri akcii, ktorá neposiela, je nepravdivé tvrdenie a nedá
sa naň prísť testom — treba ho prečítať očami niekoho, kto na to tlačidlo
klikol.

Vedľajší nález, ktorý stojí za zapamätanie: `needsInvitation()` som najprv
napísal do `people.ts` — a test ho odtiaľ nevedel importovať, lebo `people.ts`
ťahá `session.ts` s Reactovým `cache()`. To nie je nepríjemnosť testu, to je
signál: pravidlo, ktoré potrebuje obrazovka aj server aj test, patrí do
čistého modulu. Repo naň už jeden má (`personFields.ts`) a docstring v ňom
presne tento dôvod menuje. Stačilo ho poslúchnuť.

**PR 8 — solo handoff prišiel a bol radosť čítať.** KNIZNICA.md malo tabuľku
„čo je hotové — nerob znova" s číslami riadkov: polovica práce pri handoffe
je zvyčajne zistiť, čo neplatí, a tu to autor spravil za mňa. Päť úloh,
commit na úlohu. Dve miesta, kde som sa musel rozhodnúť sám: pilulka
v stĺpci Stav dovtedy ukazovala **technický stav spracovania** („vo
vyhľadávaní" pri každom riadku) — handoff hovorí o stave dokumentu, tak
stavová pilulka nesie `r.status` a spracovanie sa ukáže len keď niečo
hovorí, zlyhanie červené. A pravidlo O6/7 „percento nikdy samo" vyzeralo
v spore s pásikom — nie je: menovateľ sa presunul do `title` a `.sr-only`,
takže oku zostal pásik a pravda zostala dostupná. `Potvrdenia %` na riadok,
ktoré TODO odkladalo „na dáta", mimochodom celý čas existovalo
(`documentsProgress` počíta viditeľnú stranu) — odložený bod bol o facete
a stĺpci pre celý zoznam, nie o tomto.

---

## 2026-09-20 — nový balík handoffu a PR 1 (dva breakpointy)

**Commit balíka nebol slepé kopírovanie.** Nový export
`design_handoff_contineo_intranet/` mal štyri nové súbory (Obrazovky, Mobile,
NASADENIE, ios-frame) — tie šli do `docs/design/`. Ale README v exporte bolo
**staršie než repo**: nemalo `/ask` (malo `/search`), malo ešte `/golden-set`
a chýbala mu poznámka o vlastných ikonách. Export z dizajnového projektu nevie
o živote repa; keby sa prevzal celý, vrátil by tri opravené veci. README ostalo
repové a v commite je to zapísané.

**NASADENIE vs. kód: prvý krok PR 1 už bol hotový.** Tokeny, `--accent-soft`
v oboch témach aj `tenantStyle()` v kóde boli („jedna stupnica veľkostí",
6389a2d). NASADENIE chcelo hustotu „do oboch blokov", kód ju má len v `:root`
so zdôvodnením (od témy nezávislá, prepína ju `data-density`) — kód je pravda,
NASADENIE písané pred tými commitmi. Neprepisoval som fungujúce.

**Dve vedomé odchýlky od „najbližšieho breakpointu".** Prepínač
tabuľka↔karty (760) nešiel na 640, ale na 1024 — PR 4 hovorí výslovne
„od 1024 px tabuľka" a tabuľka má ~1160 px; na tablete by z nej bol vodorovný
posun. A `max-width: 419px` pre skratku názvu v hlavičke sa roztiahol na 639 —
príde o zmysel aj tak až so `shortName` v PR 3.

**Čo stálo čas:** komentáre. `globals.css` vysvetľuje hranice v ôsmich
komentároch („Hranica je 760 px, nie 640: …") a po premapovaní by klamali.
Mechanická zmena hodnôt je sed na minútu; nájsť a prepísať prózu, ktorá tie
hodnoty zdôvodňuje, trvalo dlhšie než samotný kód. Presne preto je zvyk písať
*prečo* do komentárov dobrý — donútil ma pri každej hranici overiť, či dôvod
platí aj po zmene.

**PR 2 — navigácia.** Tri tvary z jedného poľa. Najťažšie rozhodnutie nebolo
v CSS, ale v tom, kam vedie zlúčená položka „Úlohy": jedna položka, dve
obrazovky. Vedie na „Na potvrdenie" (častejšia povinnosť) a „Na schválenie"
som pridal do zoznamu na `/more` — návrh ho tam nemá, ale bez toho by sa
schvaľovanie z telefónu nedalo otvoriť vôbec. Skupina „Účet" z návrhu sa
nerobí: hlavička s avatarom na telefóne zostáva a druhá kópia tých istých
položiek je presne to, pred čím varuje komentár v `Header.tsx`.

Meranie prepadu „Viac N": šírky sa čítajú zo skrytého dvojníka pásu
(`visibility: hidden`, takže je mimo stromu prístupnosti aj klávesnice),
nie z pásu samotného — ten sa práve mení a meranie by sa naháňalo
s výsledkom. Dvojník meria položky v aktívnom reze (650): merať 500 by
znamenalo, že pás pretečie práve na otvorenej stránke. Bez JavaScriptu
sa vykreslí prvých 6 + „Viac" — serverové HTML je presne tento stav.

Drobnosť s dosahom: `env(safe-area-inset-bottom)` je v CSS, ale ožije až
s `viewport-fit=cover` — a to je `export const viewport` v `layout.tsx`,
ktorý sa bez Jánovho súhlasu nemení. Zapísané v TODO k PR 3.

Overené screenshotmi (390/800/1280, svetlá aj tmavá) cez Playwright nad
statickou kostrou — stačilo raz vidieť, že odznak na ikone „Úloh" sedí
a ponuka „Viac" kotví vpravo.

**PR 3 — hlavička.** Menej kódu, viac archeológie. Riadok hlavičky prešiel
za mesiac cestou pevná výška → zalamovanie → pole v riadku bez vlastnej
šírky — a NASADENIE ho vracia k pevným 56 px. Tentoraz to sedí, lebo dôvod
zalamovania medzičasom zmizol: pole si šírku nepýta a značka má elipsu.
Komentáre v CSS, ktoré tú históriu rozprávali, bolo treba prepísať, nie
zmazať — ten príbeh je presne to, čo zabráni štvrtému kolu.

Bodka namiesto čísla na zvončeku vyzerá ako ochudobnenie, ale nie je:
číslo tam bolo na jeden pohľad aj tak nečitateľné (18 px krúžok) a počet
hovorí `aria-label` aj stránka upozornení. V tmavej téme ma screenshot
nachvíľu oklamal — dvojité overenie cez `getComputedStyle` potvrdilo, že
`--accent`/`--on-accent` sa obracajú správne a dlaždica značky je v tmavej
svetlá. Oko na 28 px klame, vypočítaný štýl nie.

**PR 4 — knižnica, najväčší kus dňa.** Tri veci stoja za zápis.

Prvá: TODO malo zapísané, že zásuvka filtrov „má zmysel až s klientskym
stavom", a NASADENIE ju aj tak žiadalo. Rozpor je zdanlivý — starý zápis
predpokladal, že zásuvka sa musí dať držať otvorená na desktope. Nemusí:
na desktope zásuvka vôbec nie je (panel je stĺpec) a pod 1024 px sa
`<details>` zaviera sám tým, že každý facet je odkaz a stránka sa načíta
znova. Jedna definícia panela, dva tvary v DOM, `@media` vyberá — presne
vzor tabuľka↔karty, ktorý v repozitári už bol. Zapísal som prekonanie
starého bodu priamo k nemu.

Druhá: komentár pri `.bulk-bar` tvrdil, že panel musí byť vidieť stále,
lebo „server sa bez JavaScriptu nedozvie, čo je zaškrtnuté". To prestalo
platiť vo chvíli, keď sa výber presunul do adresy — komentár prežil svoj
dôvod o dva týždne. Kód je pravda, ale komentár je pamäť: keby som ho
nečítal, panel by som nechal tak.

Tretia: akcie priečinkov sa nedotkli — len `backToLibrary()` dostal biely
zoznam `return=folders`, aby formuláre zo správy vracali na správu.
Open redirect tu nehrozí: porovnáva sa konštanta, nie hodnota.

**PR 5 — detail a Prehľad.** Najmenej kódu zo všetkých, dve poznámky.
Prehľad z NASADENIA („KPI, úlohy s chipom, Novinky") už celý existoval —
jediné, čo z toho zostalo, bola mriežka dlaždíc: `auto-fit` vyzeral
šikovne, ale na stredných šírkach dával tri stĺpce a štvrtú dlaždicu
osamelú; výslovné 2×2 / 4×1 je hlúpejšie a správnejšie. A obrátil som
vlastné staré rozhodnutie: panel detailu bol na telefóne pod textom
s peknym dôvodom („človek prišiel čítať"), návrh ho dáva nad text.
Ani jedno sa nedá zmerať bez používateľov — v takom spore vyhráva návrh,
lebo je novší a Jánov. Starý dôvod som nechal v komentári v zátvorke,
nech tretie kolo nezačne od nuly.

**PR 6 — adresár, bodka za dňom.** Skoro všetko už bolo: karty existovali,
`mailto:`/`tel:` boli odkazy. Zostal tretí stĺpec od 1024 px a tvar
kontaktov na telefóne — z textového odkazu tlačidlo 36 px. Zvyšné obrazovky
(Pridelené normy, Reťaz dôkazov, Osoby, Na posúdenie) NASADENIE výslovne
odkladá na návrh, tak sa nerobili.

**Bilancia dňa: šesť PR (#37–#42), celé NASADENIE okrem odloženého.**
Vzor dňa: polovica „novej" práce už v repozitári bola — najcennejšie nebolo
písať kód, ale zistiť, čo z plánu už neplatí, a zapísať prekonané body tam,
kde ležia. Dve systémové resty: `viewport-fit=cover` čaká na rozhodnutie
o `layout.tsx` a tmavú tému som overoval len bodovo — celý prechod po
všetkých PR by si zaslúžil vlastnú kontrolu (krok 7 pôvodného plánu).

---

## 2026-09-18 (noc) — mobilná knižnica, zhnité skripty a Voyage

**Rozhodnutie, ktoré si Ján nechal na mne: karty na telefóne.** Najprv som to
chcel nechať tak — kartový pohľad tam je a v kóde stálo, že „na telefóne je
posun prstom čitateľnejší než rozbitá mriežka". Potom som to zmeral: tabuľka
1160 px v 340 px obale, deväť stĺpcov, a z prvej obrazovky vidno `Výber`
a `Dokument`. Stav, platnosť od, platnosť do, potvrdenia — všetko za hranou.
To nie je „posun prstom", to je skrytý obsah. Rozhodol som teda za karty.

**Ako sa to dá spraviť bez toho, aby jedna adresa vyzerala inde inak.** Server
šírku obrazovky nepozná a hádať ju z `User-Agent` by znamenalo, že ten istý
odkaz ukáže dvom ľuďom dve rôzne veci. Preto sa v automatickom pohľade
vykreslia **oba** zoznamy a vyberá medza v CSS. Stránka je stránkovaná po 25
riadkoch, takže druhá kópia stojí pár kilobajtov, a `display: none` ju skryje
aj pred čítačkou. Vedľajší dôsledok, ktorý bolo treba domyslieť: `view=table`
musí byť v adrese zapísateľné. Dovtedy „prázdno" znamenalo tabuľku, takže
výslovná voľba tabuľky by na telefóne vyrobila prázdnu adresu — a tá tam
odteraz znamená karty. Voľba, ktorú sa nedá vybrať, nie je voľba.

**Drobnosti z TODO: dve z troch boli už dávno hotové.** `branding.logoUrl`
v databáze je `/api/brand/sfz?v=…`, nie stará cesta; docstringy v `i18n.ts`
sedia nad svojimi skupinami. Poznámky v TODO boli zastarané. Pravidlo „kód
a databáza sú pravda, dokumentácia je indícia" sa vyplatilo doslova — keby som
obe „opravil", zmenil by som funkčný stav na základe starého zápisu.

**Tretia drobnosť odkryla dve väčšie.** Chýbajúci `--env-file` v `check`
a `status` bol skutočný. Keď som to opravoval, skúsil som aj `npm run tenant` —
a ten spadol na importe: `pridajDomenu` sa po premenovaní volá `addDomain`.
Pod tým čakala druhá vrstva toho istého: vetvy výsledku testovali `v.stav ===
"pridana"`, kým typ dnes vracia `state: "added"`. Skript teda buď nebežal, alebo
by o doménach klamal. Poučenie: veľké premenovanie treba overiť aj tam, kde
TypeScript nedosiahne — `.mjs` skripty importujúce `.ts` cez hook sú presne to
miesto, kde tsc mlčí.

**O18 sa posunulo z „treba sa opýtať" na „vieme tri veci".** Najdôležitejšia:
zber dát na trénovanie Voyage modelov je v Atlase **predvolene zapnutý**
a vypína ho prepínač v Organization Settings. To nie je otázka na support, to je
prepínač, ktorý má niekto prepnúť. Europe Geography existuje od 1. 9. 2026, ale
kryje priame API, nie automated embedding — presne tú cestu, ktorou ideme.
A doba uchovania logov nikde napísaná nie je; to zostáva otázkou na MongoDB.

tsc čistý, eslint 0 chýb, vitest 1367/1367, build prešiel.

---

## 2026-09-18 (neskoro večer) — dizajnová stupnica, živé filtre, widgety

Ján po preklikaní: „zjednoť veľkosti tlačidiel, písma, polí a pills,
dorob aktívne filtrovanie, Reťaz dôkazov ako rozbaľovacie widgety,
zvonček väčší". Najprv som si to zmeral, nie odhadol: `grep` našiel **370
inline `fontSize` v 18 hodnotách** a h1 v troch veľkostiach naprieč 25
obrazovkami. To nie je vec vkusu, to je chýbajúca stupnica.

**Čo sa ukázalo pri výške ovládačov.** Tlačidlo, pole a select si výšku
odvodzovali z písma a odsadenia, každý inak — a natívny select si k tomu
pridal svoje. Token `--control-h` to zrovnal, ale prvé meranie v prehliadači
ukázalo 42 vs 40 px: pole dedilo `line-height: 1.6` z `body`, takže obsah
mal 24 px a pretlačil `min-height`. Merať v prehliadači, nie veriť CSS —
to je poučenie dňa.

**Živý filter je serverový, nie prehliadačový.** Filtrovať to, čo je práve
vykreslené, by dávalo iné výsledky než odoslaný formulár (zoznam môže mať
viac strán a filtre sa skladajú) — dve pravdy o tom istom zozname. Preto sa
mení adresa a zoznam skladá server; `router.replace` a nie `push`, inak by
tlačidlo Späť prechádzalo písmeno po písmene. Pozor na React: `onChange`
na formulári vyskočí aj pri písaní, takže „výber hneď, písanie s odkladom"
sa musí rozlíšiť podľa prvku (`HTMLSelectElement`), nie podľa udalosti.

**Widgety sú natívne `<details>`.** Žiadny stav, žiadny klient — rozbalenie
funguje bez JavaScriptu, ovláda sa klávesnicou a prehliadač nájde text aj
v zloženej karte. Overené naživo: filter „galk" zúžil 7 povinností na 3,
fokus zostal v poli a otvorená karta zostala otvorená.

tsc čistý, eslint 0 chýb, vitest 1367/1367, build prešiel.

**Overenie na 375 px stálo viac než samotná oprava.** `resize_window`
v rozšírení ani zmena rozmerov okna cez AppleScript layout viewport
nepohli — `innerWidth` zostal 1011 bez ohľadu na okno. Použiteľná bola až
emulácia v zabudovanom prehliadači (375 × 812). Poučenie: merať mobil sa
dá len tam, kde sa dá vynútiť viewport, nie zmenšením okna.

Meranie potom našlo dve miesta, ktoré stupnicu obchádzali, a ani jedno
nebolo vidieť na stolnom monitore: pole hľadania v hlavičke (32 px / 13 px)
a návrhy otázok na úvodnej stránke (29 px / 12 px). Prvé je skutočná chyba
— Safari na iOS pri kliknutí do poľa s písmom pod 16 px stránku priblíži
a sám ju nevráti späť; druhé je terč, do ktorého sa palcom trafí ťažko.

Falošný poplach na `/library`: živý filter tam „nefungoval", ale chyba bola
v teste — klik padol na popisku, nie do políčka, takže sa nikam nepísalo.
Po správnom teste sa 10 dokumentov zúžilo na 1 a adresa sa zmenila. Overené
sú všetky zoznamy: knižnica, osoby, adresár, reťaz dôkazov aj audit —
vrátane toho, že audit si pri filtrovaní ponechá `tab=audit`.

Otvorené (pre Jána): knižnica má na úzkej obrazovke prepínač Tabuľka/Karty
a predvolená je tabuľka, ktorá sa posúva do strany. Karty už existujú —
je to rozhodnutie, nie chyba.

---

## 2026-09-18 (večer 2) — spätná väzba z preklikania: číselníky, Návod, zvonček, selecty

Ján poslal štyri nálezy zo živého klikania. Najvážnejší: **číselníky
padali na 500** — `CUSTOM_CODELISTS` dostal s D85 tretí druh `workplace`,
ale popisky v slovníku nikto nedoplnil a `labels[name].name` na `undefined`
zhodil celú obrazovku. Ponaučenie na zapamätanie: `Record<string, …>`
v slovníku znamená, že typová kontrola mlčí — každý zoznam kľúčov, cez
ktorý sa mapuje do slovníka, potrebuje test. `codelistLabels.test.ts`
odteraz beží za všetky tri jazyky.

Návod dostal bielu kartu a hlavne pravdu: pôvodný text tvrdil, že skenované
PDF „prepisuje jazykový model" — v skutočnosti ho prevod odmietne a prepis
je ručný krok z editora s návrhom na prevzatie. Sekcia 4 teraz hovorí presne
to, na čo sa Ján pýtal: členenie robia pravidlá (žiadne LLM), odtlačky
počíta databáza pri uložení, model prichádza až pri odpovedi. Pri kontrole
vypadol aj bonus: accept nového znenia na detaile ponúkal `.doc/.rtf/.odt`,
ktoré prevod nepozná, a nevedel `.xlsx/.csv`.

Zvonček: pilulka `.app-nav-count` vedľa ikony pôsobila ako podčiarknuté
číslo — nahradená `.bell-badge`, červený krúžok cez roh ikony s lemom vo
farbe podkladu. Selecty: jediný natívny `<select>` je filter v Reťazi
dôkazov (+ `noscript` zálohy) — namiesto prepisovania na komponent stačilo
`appearance: none` a vlastný chevron v CSS, s tmavým variantom (dátová
adresa premennú nevie, chevron je preto dvakrát).

tsc čistý, eslint 0 chýb, vitest 1367/1367, build prešiel.

---

## 2026-09-18 (dodatok 2) — contineoapp obmedzený na cluster Contineo

Ján dotiahol prístup aplikačného používateľa: v Atlase zapol „Restrict
Access to Specific Clusters" a nechal len cluster Contineo. Rola v rámci
clustra zostáva readWriteAnyDatabase — pri jednom clustri s jedinou
databázou je to prakticky to isté ako readWrite@contineo, takže položku
zatváram bez ďalšieho zužovania. Overil som po zmene: connectionStatus
prejde, číta 1991 úsekov, skúšobný zápis do `_ping_test` prešiel a hneď
sa zmazal, sign-in vracia 200. Z kompenzačných krokov O12 zostáva rotácia
hesla starého správcovského účtu a Atlas alerty.

---

## 2026-09-18 (dodatok) — TextEditor bez SSR chyby

Drobnosť z logov opravená hneď: toast-ui sa v `TextEditor.tsx` importuje
dynamicky až v `useEffect`, statický import nahradil `import type` (typ sa
z behu vymaže, takže server modul knižnice už vôbec nevyhodnocuje). Efekt
má zrušenie (`cancelled`) pre prípad odmontovania počas načítavania a
cleanup ničí editor cez `editor.current`. CSS import zostal statický —
štýl DOM nepotrebuje. tsc, eslint, 1364 testov aj build prešli.

---

## 2026-09-18 (poobede) — produkcia už nebeží na správcovskom účte DB

Ján založil aplikačného používateľa `contineoapp` (readWriteAnyDatabase,
bez atlasAdmin), vymenil URI vo Verceli aj lokálne a redeployol. Overenie:

- `connectionStatus` cez nové URI: jediná rola `readWriteAnyDatabase` —
  správa clustra a používateľov už z aplikačného pripojenia nejde.
- Knižnica na intranete načítala všetkých 10 dokumentov z produkčnej DB.
- `/ask` prešiel celou reťazou: $rankFusion → $rerank → generovanie —
  odpoveď o predčasnom ukončení stretnutia so 7 doslovnými citáciami
  z čl. 70 Súťažného poriadku. Čítanie aj zápis (záznam o odpovedi) teda
  fungujú pod novým používateľom.
- Logy nového nasadenia: nula chýb.

Bonus z Jánovho screenshotu: **logo v e-mailoch sa v schránke naozaj
zobrazuje** — denná pripomienka termínu niesla hlavičku SFZ. Posledná
neoverená vec z opravy `logoTag()` odškrtnutá.

Do TODO pribudli dve drobnosti: voliteľné zúženie `contineoapp` na
`readWrite@contineo` (Specific Privileges v Atlase) a rotácia hesla
starého správcovského účtu, ktorého URI dosiaľ ležalo vo Verceli.

A jeden starý známy v logoch: `ReferenceError: Element is not defined`
pri SSR module TextEditora na `/library/[id]/text` — existuje od 30. 8.
(dávno pred dompurify 3.4.15), stránke nebráni, spustí sa raz pri otvorení
editora. Zapísané nižšie ako drobnosť na opravu (dynamický import bez SSR).

---

## 2026-09-18 (noc) — O12 revidované: Static IPs odložené, allowlist kryjú lacnejšie opatrenia

Ján: „pri jednom tenantovi toto celé považujem za zbytočný náklad". Cena
overená v oficiálnej dokumentácii Vercelu: **100 $/mes. na projekt** plus
metrovaný Private Data Transfer — cez statické IP tečie každý dotaz do
Atlasu. Pri jednom tenantovi ročne 1 200+ USD za druhý faktor k databáze,
ktorého hrozbový model (únik connection stringu) sa dá z väčšej časti pokryť
zadarmo. Súhlasil som s odkladom — s podmienkou, že sa nezapíše ako
„zbytočné", ale ako **odložené so spúšťačmi**: druhý platiaci tenant,
verejný widget, tender/bezpečnostný dotazník. Vtedy sa to prestane platiť
z nákladov a začne predávať.

**Nález pri zápise, ktorý celé rozhodnutie robí naliehavejším:**
`connectionStatus` z produkčného URI ukázal, že aplikácia sa pripája ako
`janletko_db_user` s rolami `atlasAdmin`, `readWriteAnyDatabase`,
`dbAdminAnyDatabase`. Produkcia teda beží na plnom správcovskom účte
clustra — uniknutý URI by nedal útočníkovi len dáta, ale celý cluster
vrátane správy používateľov. Prvý kompenzačný krok je preto samostatný
aplikačný používateľ len s `readWrite` na `contineo` a potom rotácia hesla
správcovského účtu. Zapísané v TODO pod revidovaným O12.

Papierovačky: revízia v `OPEN_DECISIONS.md` (riadok O12), dodatok k N1
v bezpečnostnej kontrole, TODO preklopené z blokátora na tri kompenzačné
kroky. **Prvé ostré potvrdenie tým prestalo mať blokátor v O12.**

---

## 2026-09-18 (večer) — N4 a N6, z kontroly zostáva už len O12

**Hlavičky (N4):** `headers()` v `next.config.mjs` — frame-ancestors,
X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy. Vedome BEZ
plnej CSP: Next vkladá inline skripty, poctivá CSP znamená nonce cez
middleware a testovanie všetkých obrazoviek — prílepok k dnešku by skončil
buď deravou politikou, alebo rozbitou stránkou. Zapísané ako samostatný
krok s nižšou prioritou.

**Hláška (N6):** `generateAnswer()` má vlastný catch vnútri streamu a ten
posielal `err.message` doslovne — route svoju všeobecnú vetu uplatňoval len
na chyby PRED generovaním. Jazyk sa do `GenerateOptions` odovzdáva z route;
`smoke.mjs` ho nedáva a padá na slovenčinu, čo je preň správne. Test vyvolá
chybu profilom s neznámym druhom generovania — žiadna sieť, žiadne mocky
SDK — a overí, že von ide `answer.failed` a nie text výnimky.

tsc čistý, eslint 0 chýb, vitest 1364/1364 (3 nové), build prešiel, dev
server nebežal (overené pred buildom).

---

## 2026-09-18 (dokončenie) — editor s dompurify 3.4.15 overený v produkcii

Posledný otvorený kúsok N2. Najprv staticky: toast-ui volá na dompurify len
API, ktoré v 3.4.x existuje (`sanitize`, `addHook`, `setConfig`,
`isValidAttribute`…) — skok 2.x → 3.x teda nemal čo rozbiť. Potom naživo,
v Chrome na intranete (build `5a6a747` podľa pätičky), na skúšobnej smernici
`sfz:test_onboarding` a bez uloženia:

- WYSIWYG vykreslil nadpisy, tučné, zoznamy aj kódový span; prepínanie
  Markdown ↔ WYSIWYG tam a späť bez chyby v konzole.
- Payload `<img src=x onerror=…>` + `<script>…</script>` v Markdown režime:
  náhľad `onerror` odstránil, `<script>` zahodil celý, nič sa nespustilo.
  Po prepnutí do WYSIWYG to isté — obsah skriptu skončil ako neškodný text.
- Testovací riadok som z editora zmazal a odišiel bez uloženia; buffer končí
  pôvodnou vetou.

N2 je tým uzavreté celé. Z bezpečnostnej kontroly zostáva O12, hlavičky (N4)
a hláška v `generateAnswer()` (N6).

---

## 2026-09-18 (pokračovanie) — N2 a N3 z bezpečnostnej kontroly vyriešené

Ján: „toto vyriešme prosím — CSV formula injection a xlsx/dompurify".

**CSV (N3):** apostrof pred bunky začínajúce `=`, `+`, `-`, `@`, tab, CR
v `toCsv()`. Jedna vec stojí za zápis: escapoval som aj `-`, hoci to raz môže
dať apostrof zápornému číslu — Excel totiž `-2+3+cmd|...` spustí ako vzorec
rovnako ochotne ako `=`. Dnes žiadny export záporné čísla nevypisuje, takže
kompromis nič nestojí.

**xlsx (N2):** npm registri zostane 0.18.5 navždy — SheetJS z npm odišiel.
Rozhodnutie Jána: oficiálna distribúcia. `package.json` ukazuje na pinovaný
tarball `cdn.sheetjs.com/xlsx-0.20.3/...` (0.20.4+ neexistuje, overené HEAD
dotazmi), lockfile drží integritu. API sedí, `conversion.ts` bez zmeny.

**dompurify (N2):** toast-ui si žiada ^2.3.3; `overrides` vynútil 3.4.15.
Skok 2.x → 3.x pod cudzou knižnicou je jediné riziko dňa — tsc, 1361 testov
aj build prešli, ale náhľad editora testy nepokrývajú. Nechal som v TODO
„raz preklikať editor v knižnici".

`npm audit`: **0 zraniteľností** (z 1 high + 2 moderate). Pozor pre budúce
inštalácie: `npm install` teraz ťahá tarball z cdn.sheetjs.com — offline
inštalácia bez cache zlyhá na tomto balíku.

Pri zápise `package.json` cez python v heredoc-u mi ušiel doslovný `\n` na
konci súboru a npm ho odmietol parsovať — quoted heredoc neexpanduje escape
sekvencie ani v reťazcoch, ktoré vyzerajú ako python. Opravené, zapamätať si.

---

## 2026-09-18 — web zosúladený s D90 (a s tým, čo máme na papieri)

Ján schválil opravy nesúladov z včerajšej kontroly. `web/lib/dictionaries.js`,
všetky tri jazyky naraz (i18n test webu neexistuje, tak aspoň disciplína):

- **Hierarchia a `scope: global`** už nesľubujú krížovú viditeľnosť — všade
  „zdieľanie v hierarchii pripravujeme", viditeľnosť je vlastná organizácia
  (D90). Prípadová štúdia SFZ hovorí „samostatné organizácie s vlastným
  obsahom". Pravidlo značkovania „nekopírovať pre každú jednotku" muselo
  preč tiež — po D90 by bolo návodom na neviditeľný obsah.
- **Vertex AI von, Bedrock zostáva** — rozhodnutie Jána: tabuľka tvrdí len
  to, čo v kóde je; Bedrock je jediná cesta k eu-full generovaniu bez GPU.
- **„Infinity (voyage-4-nano) / TEI (BGE-M3)"** — TEI voyage-4-nano
  nepodporuje (O7 nález A); zátvorky teraz sedia s realitou serverov.
- **Zero-retention pri Anthropic zmiernené na „potvrdzujeme zmluvne"** —
  Ján 2026-09-18 poslal žiadosť na Anthropic sales support; keď príde
  písomné potvrdenie, silné znenie sa vráti (SK 220, CS 953, EN 1687 +
  sekcia Bezpečnosť a „otvorený bod" v rezidencii).
- Zmienka o „eval sade D9" sa na webe už nenachádza — položka v TODO bola
  zastaraná, odškrtnutá bez zmeny kódu.

`npm run build` webu prešiel (statický export). Lint vo `web/` nie je
nakonfigurovaný — nechávam tak, nie je súčasť rozsahu.

---

## 2026-09-17 (noc) — bezpečnostná kontrola pred prvou ostrou verziou

Ján si vyžiadal komplexnú kontrolu: kód, závislosti, infra a súlad webu
s repozitárom, plus zápis on-prem cesty. Výsledok je v
`docs/BEZPECNOSTNA_KONTROLA_2026-09.md` a `docs/decisions/ADR-009-on-prem-referencna-architektura.md`.

**V kóde sa kritická diera nenašla** — D90 drží, brány sú konzistentné,
tajomstvá v repozitári nie sú. Tri veci s prioritou: O12 (Atlas allowlist),
zraniteľné `xlsx` a `dompurify` (cez toast-ui), a CSV exporty bez ochrany
pred formula injection (`=` na začiatku bunky sa v Exceli vyhodnotí ako
vzorec aj v úvodzovkách — `toCsv()` to nefiltruje).

**Web je poctivejší, než som čakal** — on-prem označuje „pripravujeme",
režim `eu-data` sedí, čísla (60/40, voyage-4/1024, rerank-2) sedia s kódom.
Najvážnejší nesúlad: sekcie o `scope: global` a hierarchii centrála →
jednotky opisujú krížovú viditeľnosť, ktorú D90 včera zrušil. Ďalej Vertex AI
(adaptér neexistuje), TEI + voyage-4-nano (TEI ho nepodporuje, O7 nález A)
a anglické „we have a zero-retention agreement with Anthropic" v prítomnom
čase. Úpravy webu sa nerobili — čakajú na schválenie.

**ADR-009 vzalo číslo, s ktorým počítal ClubUp** — plán ClubUp ADR sa písal
skôr, ale dokument nevznikol; ClubUp dostane ADR-010. Zapísané v ADR-009.

Čo by som nabudúce spravil inak: `npm audit` spúšťať pravidelne, nie až pri
kontrole pred vydaním — `xlsx` je zraniteľné mesiace a nikto to nevidel.

---

## 2026-09-17 (večer) — audit D90 opravený celý

Ján: „oprav všetko, čo si našla". Štyri commity po skupinách nálezov, nie jeden
veľký — každá skupina mení iný druh správania a pri probléme sa má dať vrátiť
samostatne.

**Pred zmenou som sa pozrel do dát, nie len do kódu.** Povinná organizácia vo
`validAcknowledgements()` by pri zázname bez `companyCode` ticho „stratila"
potvrdenie — a výkaz by tvrdil, že človek nič nepotvrdil. Dotaz nad ostrou
databázou: všetkých 7 potvrdení, 6 časov čítania a 10 hodnotení má organizáciu
zhodnú s osobou. Jedna vec vyzerala zle: 115 úsekov s inou organizáciou než
dokument. Druhý dotaz ukázal, že dokument k nim neexistuje — sú to archivované
úseky zmazaného nácviku. Keby som skončil pri prvom čísle, písal by som o úniku,
ktorý nie je.

**Najcitlivejšia bola brána prihlásenia.** Po zmene rozhoduje organizácia domény,
nie „ktorákoľvek". Testy to overia len s atrapou, tak som pustil `next start`
a poslal skutočnú žiadosť o odkaz — s prázdnym `ECOMAIL_API_KEY` v prostredí,
aby e-mail naozaj neodišiel (Next hodnotu z `.env.local` neprepíše, ak už
v prostredí je, aj prázdna; log to potvrdil vetou „e-mail sa neodoslal"). Ján na
SFZ: povolil. Ján na LTK: odmietol. Presne to D90 chce, ale pre Jána to znamená,
že na `app.contineo.app` sa dostane len cez núdzovú brzdu alebo ako osoba LTK.

**Pri logu hrozila nová diera cez CDN.** Výnimka pre správcu platformy vracia
logo inej organizácie — a odpoveď mala `public, immutable`. Vercel by ju uložil
a vydal ďalšiemu, neprihlásenému návštevníkovi tej istej adresy. Preto
`private, no-store` práve pre tú vetvu.

**Čo zostalo mimo:** e-maily z cronu, schvaľovania a pozvánok posielajú logo ako
relatívnu adresu — v schránke nemá k čomu byť relatívna. S oddelením tenantov to
nesúvisí a neoveril som, ako to vyzerá v pošte; je to v TODO. A región `iad1`:
Vercel vie bežať vo Frankfurte (`regions: ["fra1"]`), ale je to produkčné
nastavenie — čaká na Jánovo áno.

**Dodatok (neskôr večer):** Ján povedal oboje áno. Logo som neopravil v piatich
volajúcich, ale v `ecomail.ts` — tam, kde sa hlavička vykresľuje. Päť kópií toho
istého pravidla je presne to, čo sa raz rozíde; `auth.ts` svoju kópiu stratil.
Test kontroluje všetkých šesť e-mailov naraz, nie ten, ktorý som práve menil.
Región je `fra1` — a rovno to zapíšme aj k O12: **Static IPs sa zapínajú pre
región**, takže sa musia zapnúť pre Frankfurt, nie pre Washington.

**Upratovanie na koniec dňa.** `npm run check` nad ostrými dátami: 10 dokumentov,
1991 úsekov, 5 potvrdení, 3 osoby, **bez rozporov** — po dni, v ktorom sa menila
podmienka skoro každého dotazu, je to to jediné číslo, ktoré ma zaujímalo.
V kóde nezostal ani jeden `TODO`/`FIXME` okrem odkazov do `docs/TODO.md`. Osem
commitov, všetko na `main` a nasadené.

Drobnosť na inokedy: `npm run check` a `npm run status` nemajú v `package.json`
`--env-file=.env.local` (na rozdiel od `smoke` a dnešného `docs:import`), takže
bez exportovanej premennej skončia na „Chýba MONGODB_URI". Nie je to chyba
kontroly, len jej spustenia — zapísané do TODO.

---

## 2026-09-17 (poobede) — drobnosti Fázy 8, z ktorých jedna nebola drobnosť

Ján: „dorobme D. Drobnosti v kóde". Štyri body z `TODO.md`: `/api/chat` na
predvolenom profile, neznámy hostiteľ s `307` pred `404`, logo cez presmerovanie,
import mimo schvaľovania. Pred plánom som každý prešiel v kóde a pozrel sa do
ostrej databázy dotazom, ktorý nič nezapisuje — a plán sa tým zmenil.

**„Chat na predvolenom profile" bol v skutočnosti únik.** Route nielenže nemal
profil tenanta — hľadal **bez `companyCode`**, lebo filter bol v `mongoSearch.ts`
nepovinný. Zápis v TODO to opisoval ako kozmetiku. Dnes je všetok obsah SFZ, takže
reálny dosah bol jeden interný úsek pre jedinú osobu LTK; o zákazníka neskôr by
to bola plná knižnica. Poučenie: **nepovinný bezpečnostný filter je chýbajúci
filter** — nikto ho nevyplní a výsledok nevyzerá ako chyba, len ako lepšia odpoveď.

**Ján to rozhodol jednou vetou:** „filter musí byť VŽDY, tenanti galvanicky
oddelení" — a k `sharedWithCompanyCodes`: „zdieľanie radšej nie". Pri hľadaní som
našiel ďalšie dve cesty cez hranicu, obe podľa D32: `canSeeDocument()` pustil verejný
dokument ktorejkoľvek organizácie a `assignableDocuments()` ho ponúkol na pridelenie.
Vzniklo D90. Filter som dal do najnižšej vrstvy (`tenantFilter()` vyhodí výnimku),
nie do route — kontrola v route je presne to, čo tu raz chýbalo. Overené aj živo:
`smoke --organizacia LTK` nájde nula úsekov.

**Súhlas na zmenu indexov som nevyužil.** Ján ho dal pre prípad zdieľania; bez
zdieľania stačí `companyCode`, ktorý je filtrovacím poľom v oboch indexoch od začiatku.

**Poznámka v TODO bola zastaraná o dve verzie Nextu.** „Middleware beží na edge
a do Atlasu nevidí" platilo pre Next 14. Next 16 ho premenoval na `proxy.ts`
a beží na Node.js — overené v `node_modules/next/dist/docs`, nie z pamäti. Kontrola
tenanta tak je jeden `resolveTenant()` bez verejného endpointu, ktorý TODO navrhovalo.
Výnimku má len `/api/cron/`, lebo z akej domény Vercel volá cron, neviem — a raz už
cron ticho nebežal práve kvôli bráne v middlewari. Po nasadení: `contineo-app.vercel.app`
→ `404`, cron `401`, `intranet.futbalsfz.sk` bez zmeny, v logoch žiadna chyba.

**Import bol horší, než hovoril zápis.** Okrem zverejňovania mimo schvaľovania
skladal `documentId` zo `sectionKey`, teda identitou spred D80. Prepísal som ho na
volanie tej istej `uploadDocument()` ako obrazovka — dve cesty s dvomi sadami
pravidiel sa rozídu presne pri novele. `--actor` je povinný a musí to byť osoba
s rolou; do auditu nemá ísť „import.mjs". Prvá verzia padla na tom, že `library.ts`
ťahá `next/headers`; druhá hlásila „Nepodarilo sa to" pri každej vlastnej kontrole,
lebo `errorText()` maskuje obyčajné `Error`. Oboje chytil beh nasucho, nie testy.

**Logo** vyriešil Ján tým, že ho nahral znova — zapísal ho existujúci kód, bez skriptu.

**D5 — audit dotazov** je len výpis (`docs/D90_audit_dotazov.md`). Najväčšie nálezy:
posudok, spätná väzba a kurácia sa zapisujú podľa `_id` bez organizácie, a osoba
sa hľadá len podľa e-mailu. Mimochodom: funkcie produkcie bežia v `iad1` (USA) —
nikde v dokumentácii to nie je, pýtam sa.

**Čo by som nabudúce urobil inak:** v predmete prvého commitu je preklep („naprec")
a je už na `main`. Správu commitu si pred pushom prečítať celú, nie len kód.

---

## 2026-09-17 (skoro ráno) — kostry, a jedna prestavba v horúcej ceste

Ján: „chýbajú mi inteligentné pekné preloadery na stránkach … ideálne v štýle
Skeleton Loaders.“ Prvé, čo som urobil, bolo, že som to šiel zmerať v kóde,
a výsledok bol jednoznačný: **nula `loading.tsx`, nula `Suspense`** na 34
routách. Nebolo teda čo vylepšovať — nebolo tam nič.

**Kde som skoro urobil kostru zle.** Prvý návrh mal `SkeletonPanel` všade.
Potom som sa pozrel, z čoho sú zoznamy naozaj postavené: `/documents`,
`/people`, `/hr` aj `/library` sú stĺpce `.card`, nie panel s riadkami. Kostra
z panela by mala o medzery medzi kartami menej a po načítaní by sa zoznam
roztiahol. Poučenie je to isté ako pri dokumentácii: **tvar sa berie z kódu,
nie z predstavy.**

**`AppShell` nie je v `layout.tsx`** — vyžiada si ho každá stránka sama. To som
zistil až pri prvom `loading.tsx` a je to pre kostru určujúce: `loading.tsx`
nahrádza stránku, takže počas čakania zmizne aj pás odkazov. Preto
`SkeletonShell` s obrysom navigácie a `min-height: 44px` — to isté číslo, aké
majú skutočné položky pásu.

**Prestavba `/api/chat` bola jediné možné čestné riešenie.** Jánovi som
dopredu napísal, že hlášky typu „hľadám v predpisoch…“ sa dajú urobiť buď
pravdivo (práca dovnútra streamu a udalosti `phase`), alebo ako animácia bez
vzťahu k skutočnosti. Vybral pravdivú cestu. Stálo to dve zmeny správania,
ktoré sú zapísané v hlavičke route aj v changelogu: hlavičky `X-Search-Mode`
a spol. nahradila udalosť `meta` (hlavičky sa nastavujú pred prácou, teda
by boli prázdne) a nezhoda vektorového priestoru už nie je HTTP 500, ale
`error` v streame. Ani jedno nikto v repozitári nečítal — overené grepom,
nie odhadom.

**Čo som nedokázal overiť sám.** Ako to vyzerá. `tsc`, lint (0 chýb),
1318 testov aj `npm run build` prešli, ale kostra je vec oka a na to
potrebujem prehliadač. Zostáva to na vizuálnu kontrolu po nasadení —
a skôr než ju niekto urobí, platí, že počty riadkov v kostrách sú odhad,
nie meranie. Zapísané ako otvorený bod v TODO, nie zamlčané.

**A vizuálna kontrola našla chybu, ktorú by `tsc` nikdy nenašiel.** Zostavil
som statickú ukážku kostier s **ostrým `globals.css` z nasadeného buildu**
(nie s približnou kópiou) a otvoril ju na 375 px. Na telefóne bol vidno pás
odkazov **aj** zásuvku naraz. Príčina: `.skeleton-nav` mala `display: flex`
a je v súbore nižšie než `@media (max-width: 939px) { .app-nav--topbar {
display: none } }` — rovnaká špecifickosť, neskôr vyhráva. Oprava je nič
nedeklarovať: `display` si dodá `.app-nav`. Poučenie na kostry ako celok:
**trieda, ktorá sa pridáva k existujúcej, nesmie prepisovať to, čo tá
existujúca rieši cez `@media`.**

**Lint ma chytil na `setBusy(false)` priamo v efekte.** Reťazové vykreslenie.
Oprava je `requestAnimationFrame` — pre oko to isté, pre React obyčajná zmena
stavu. Dobré pravidlo bolo v nástroji skôr než v mojej hlave.

---

## 2026-09-16 (neskorá noc) — Vercel nedostal webhook druhýkrát

Včera som si do tohto denníka napísal, že stratený webhook bol **jednorazový
výpadok**. Nebol. Dnešný `621b014` má na GitHube `state: pending` a **0 commit
statuses** — presne ten istý obraz ako vtedy. Vercel sa o pushi nedozvedel.

Dva rovnaké príznaky nie sú náhoda, sú jav. Záver „jednorazový“ som postavil na
tom, že dva nasledujúce pushe prešli — teda na tom, že sa chyba neopakovala
hneď. To nie je dôkaz, to je krátke okno. Rovnaká chyba ako pri O18: vzal som
záver namiesto toho, aby som ho odvodil z toho, čo naozaj viem.

Záchranná cesta zabrala oba razy rovnako: `POST /v13/deployments` s `gitSource`
(`repoId`, `ref: main`, `sha`). Zapísaná je v TODO, aby sa nemusela vymýšľať
tretíkrát.

**Nabudúce:** ručné nasadenie je liečenie príznaku. Pri treťom výskyte ísť na
doručovanie webhookov GitHub App (Recent Deliveries), nie znova na API.

---

## 2026-09-16 (noc) — web dobehnutý, a jedno rozhodnutie navyše

Druhá dávka opráv webu. Ján pritom povedal vetu, ktorá zmenila tón celého
balíka: **„v prvom kole musíme rozbehať Anthropic a MongoDB riešenie, až keď
príde hardware, pojdeme na onpremise"**.

To nie je detail, to je roadmapa. Namiesto vágneho „pripravujeme" je odteraz na
webe pri každom on-prem tvrdení napísané, že **prvé nasadenie príde
s hardvérom**. Je to poctivejšie a zároveň silší predajný príbeh než sľub bez
dátumu — a v obstarávaní sa to dá obhájiť.

### Čo ma pri opravách prekvapilo

**Ukážka kódu na stránke Technológia si protirečila sama so sebou.** Mala
`embedding: [0.0123, …]` v dokumente a zároveň `embeddingProvider: "atlas-auto"`.
Pri Automated Embedding sa vektor v dokumente **neukladá** — drží ho Atlas,
a `tenantProfile.ts` dokonca vyhodí chybu, keď `vectorPath` ukazuje na
`embedding`. Stránku Technológia číta práve ten čitateľ, ktorý si toho všimne.

**Slovenské úvodzovky ma dobehli tretíkrát.** `„sedí / nesedí"` — zatvárací
znak musí byť `“`, nie `"`. Tentoraz to zhodilo `require()` na slovníku, nie
`tsc`. **Začína to byť vzor, nie náhoda:** keď generíš kód so slovenským textom,
skontroluj úvodzovky ešte pred spustením.

---

## 2026-09-16 (neskoro večer) — audit webu a moja druhá chyba v O18

Ján dal skontrolovať marketingový web proti skutočnosti. Rovnaká metóda ako pri
dokumentácii, iný kľúč triedenia: web **smie** hovoriť o vízii, nesmie ju vydávať
za dnešok. Výsledok: **48 tvrdení, ktoré opísujú ako hotové niečo, čo nie je** —
a každé tri razy, lebo slovník má SK, CZ aj EN.

### Chyba, ktorú našiel audit webu u mňa

Pri O18 som dvakrát napísal, že text opúšťa infraštruktúru „na dvoch miestach".
Je to **štyrikrát**: prepis dotazu (Anthropic Haiku), embedding, preradenie
a generovanie. Prepis dotazu som vynechal úplne — beží pred vyhľadávaním
a predvolene je zapnutý.

Najčastejšie by som povedal, že som to prehliadol. Ale stalo sa niečo konkrétnejšie:
`AKO_TO_BEZI.md` má nad tabuľkou vetu „text otázky opustí EÚ **trikrát**" a pod ňou
tabuľku so **štyrmi riadkami**. Prevzal som číslo z vety namiesto toho, aby som
spočítal riadky. **Keď dokument uvádza číslo aj zoznam, platí zoznam** — presne
ako pri kóde a dokumentácii. Opravené na oboch miestach vrátane samotného
`AKO_TO_BEZI.md`, ktorý si protirečil od júla.

### Čo to znamená pre web

Tri najzavažnejšie veci nie sú štýlové. Web sľubuje **on-prem a „data ostanú
u vás"** (segment, ktorý si podľa toho vyberá dodáváteľa), **helpdesk a ticketing**
(v názve produktu, v pilieroch aj v deme) a **prihlásenie cez sportnet.online**
v prípadovej štúdii. Ani jedno neexistuje. Text sa nepíše sám — predložené Jánovi
ako plán, nie opravé potichu: je to jeho pozicioning, nie moja vec.

---

## 2026-09-16 (večer) — O17: z auditu vyšla prvá zmena kódu

Audit skôr dnes našiel zásadu o pseudonymizácii a kolekciu, ktorá ju nespĺňa.
Ján sa spýtal to správne: **„potrebujeme e-mail? nestačí nejaké internal/external
ID?"** — a tá otázka rozhodla celý návrh.

### Čo ma na tom prekvapilo

**Tretí prípad neexistoval.** Ján váhal medzi `personId` a externým ID, lebo si
predstavil človeka prihláseného cez cudzí systém. Keď som sa pozrel do kódu,
`persons` už nesie `externalRef { sportnetId, entraObjectId, googleSub }`
a D47 osobu pri prihlásení zakladá automaticky — takže taký človek **má
`personId`**. Otázka sa tým zmenšila z troch možností na dve. Poučenie:
keď sa návrh láme na „čo keď nastane X", najprv over, či X vôbec môže nastať.

**Argument, ktorý som skoro nepovedal.** Chcel som porovnávať `personId`
a externé ID podľa toho, ktoré je „bezpečnejšie". Nie je to tak: **oba sú
pseudonymné identifikátory a oba sú osobný údaj.** Zisk nie je v tvare
identifikátora, ale v tom, že väzba zomrie s osobou. Bez tejto vety by sa
rozhodovalo o nesprávnej veci.

**Skoro som zachoval literál, ktorý už nič neznamená.** Plán rátal s tým, že
`"anonym"` treba nechať kvôli `delete_test_data.mjs`. Spočítal som to a v produkcii
je **0 takých záznamov** — skript už nemá čo robiť a obmedzenie zmizlo.

### Detail, ktorý sa oplatí držať

Invariant v `npm run check` (žiadne `@` v podpisových poliach) nie je opatrnosť navyše.
Sú to polia, ktoré sa bežne nečítajú — keby ich jeden zabudnutý volajúci začal
plniť e-mailom, nezistilo by sa to málokedy, ale **nikdy**.

---

## 2026-09-16 — audit dokumentácie proti kódu

**Zadanie Jána:** „Doplnme správne dokumentáciu nech je to v súlade so
skutočnosťou, oprav aj tie docstringy."

### Ako sa to robilo

Nie čítaním od začiatku. Najprv som z kódu vytiahol **pravdu**: zoznam ciest
(`find src/app -name page.tsx`), `npm run` príkazov z `package.json`, kolekcií
(konštanty `*_COLLECTION` + `getCollection()`) a rolí. Až potom sa proti tomuto
zoznamu merali dokumenty — v štyroch paralelných dávkach, každá s tým istým
zadaním a tým istým kľúčom triedenia: **A** nepravdivý opis súčasnosti,
**B** datovaný zápis, **C** plán. Bez toho kľúča by audit skončil návrhom
prepísať históriu — a to je horšie než zastaralý zápis.

Výsledok: **93 nezrovnalostí typu A**, 31 typu B. Nič z toho nebolo vidieť
„pri bežnom čítaní"; väčšina vyzerá správne, kým si nečítate kód.

### Čo ma prekvapilo

**Dokument o prístupových právach mlčal o polovici mechanizmu prístupu.**
`PRISTUPOVE_PRAVA.md` popisuje polia na obsahu, ale o tom, že `accessLevel`
kurovaných odpovedí sa **odvodzuje**, nemal ani vetu. Nie je to nepravdivé
tvrdenie — je to diera, a diery audit nájde ťažšie než omyly.

**Najhorší nález bol pravdivý opak.** `INGESTION` tvrdilo, že prevod skenov
robí model s automatickým ústupom. D53 pritom zakázala práve ten tichý ústup
a hlavička `conversion.ts` to vysvetľuje na desiatich riadkoch. Dokument
a kód si protirečili v zásade, nie v detaile.

**Hlavičky modulov klamali plošne.** Devätnásť súborov v `lib/` sa
predstavovalo slovenským menom z čias pred premenovaním. Našlo sa to jedným
cyklom — porovnaj prvý riadok hlavičky s `basename`. Taký test by mohol byť
v `npm run check`.

### Druhá polovica (po schválení)

Dva balíky som najprv **nechal na schválenie** — prepis stavových sekcií (tam sa
nemení meno, ale obsah kapitoly) a GDPR (podklad pre DPO). Ján ich schválil
a dobehli v ten istý deň.

**Najužitočnejší krok celého dňa bol jeden príkaz:** `vercel env ls production`.
Dokument tvrdil, že nastavená je `NEXTAUTH_URL` (ktorá nastavená byť **nesmie**)
a že chýbajú `VERCEL_TOKEN` a `OAUTH_SECRET_ENCRYPTION_KEY`. Skutočnosť bola
presne opačná v oboch smeroch. Tri otvorené položky v troch dokumentoch tým
padli. **Poučenie:** keď sa dokument odvoláva na stav vonkajšieho systému,
overiť sa dá priamo — a spravidla to trvá kratšie než prečítať odsek o ňom.

**Čo som odmietol prepísať.** Dve zásady v GDPR sú napísané ako splnené
a splnené nie sú: `evaluations` drží e-maily doslovne, a hoci úložisko je v EÚ,
embedding a rerank idú cez Atlas. Opraviť ich „formuláciou" by znamenalo
zamiesť problém pod dokument, ktorý ide DPO. Sú označené ako **O17** a **O18**
a čakajú na rozhodnutie.

### Poznámka bokom

`docs/SPRAVA_TENANTOV.md` má v hlavičke e-mail správcovského konta. Oznámené
Jánovi; **rozhodol nechať** — je to všeobecné firemné konto, nie osobný ani
prístupový údaj. Pravidlo o tajomstvách sa naň nevzťahuje.

---

## 2026-09-15 — meranie kvality: von so zlatou sadou, dnu s prevádzkou

**Commity:** `75a494d`, `98af0a8`, `e38eec8`, `b556a00`, `29285f5`, `0533101`,
`3abeae5`, `7b90ac4`. Deň mal jednu líniu: reťaz *bežný človek → hodnotiteľ →
overená odpoveď v znalostiach*.

### Rozhodnutia (Ján Letko)

- **Zlatá sada von, celá.** Nie odložiť, nie zmenšiť — zrušiť. Dva mesiace bez
  jediného posudku sú odpoveď. `docs/decisions/ADR-008-zrusenie-zlatej-sady.md`.
- **Rola `evaluator`.** Bežný človek povie „sedí / nesedí" a čo mu vadilo;
  posudok potvrdzuje a opravuje hodnotiteľ. Identifikátor po anglicky,
  preklady SK/CZ/EN.
- **Kurácia ako stav na zázname** (varianta A), nie nová kolekcia.
- **„Únik cez `accessLevel` nikdy nesmie nastať."** Táto veta určila návrh
  celej kurácie viac než čokoľvek iné.
- **Štítok „overená odpoveď"** v zozname zdrojov.
- **Premenovať `spravca-obsahu` → `content-admin`.**

### Čo nevyšlo a čo sa z toho dá vziať

**Založil som kolekciu `answer_reports`, ktorá duplikovala `evaluations`.**
Najdrahšia chyba dňa a celá moja. Hlásenie nepresnosti *je* pole existujúceho
záznamu o odpovedi — otázka aj odpoveď už v ňom sú. Opravené v `75a494d`,
kolekcia zahodená. Poučenie je krátke: **pred novou kolekciou sa pozrieť, čo
už existuje**, nie navrhovať od nuly.

**Vercel 86 minút nenasadil `98af0a8`.** Diagnostika po vrstvách, nie hádanie:
projekt nie je pozastavený (`paused: null`), väzba na git drží
(`productionBranch: main`, sedí `repoId`), `commandForIgnoringBuildStep` nie je
nastavený, konto aktívne. Rozhodol až pohľad do GitHubu: `main` na správnom
SHA, ale **0 commit statuses** oproti štyrom pri predchádzajúcom commite —
teda Vercel sa o pushi nikdy nedozvedel. Stratené doručenie webhooku GitHub
App. Riešené vytvorením nasadenia cez API (`POST /v13/deployments` s
`gitSource`). Ďalšie dva pushe sa nasadili samy, takže to bol jednorazový
výpadok. [**Oprava 2026-09-16:** nebol jednorazový — o deň neskôr to
isté; pozri zápis zo 16. 9. (neskorá noc).] **Nabudúce:** ak nasadenie
nenabehne do pár minút, ísť rovno na commit statuses v GitHube; to je
najkratšia cesta k rozlíšeniu „Vercel to
nevzal" od „Vercel to nedostal".

**Skript na úpravu `i18n.ts` prestrelil koniec skupiny.** Typový blok sa
zatvára `  }` bez čiarky, hľadalo sa `  },` — tak zmizli aj `admin`, `org`,
`people` a `errors`. Chytil to `tsc` (~30 chýb), nie oko. `git checkout --` a
skript prepísať tak, aby uznal oba tvary.

**Slovenské úvodzovky mi dvakrát ukončili reťazec.** `„Nesedí"` — zatvárací
znak je `“`, nie `"`. TS1002/TS1005. Pri generovaní TSX z Pythonu je to pasca,
do ktorej sa dá spadnúť opakovane.

**Skoro som odstránil `preset`.** Vyzeralo to ako zvyšok po zlatej sade; v
skutočnosti je to odovzdanie otázky z hlavičky na `/ask?q=`. Chytil `tsc`.
Doplnený komentár, nech to nabudúce nevyzerá ako sirota.

**`.next/types/validator.ts` sa odvolával na zmazanú routu.** Typová kontrola
padala na súbore, ktorý sa generuje. `rm -rf .next/types` pred každým `tsc`.

**Git na Macu si vypýtal licenciu Xcode** uprostred práce. Dočasne
`/Library/Developer/CommandLineTools/usr/bin/git`, potom to Ján vyriešil
natrvalo (`xcodebuild -license`).

### Nález, ktorý stál za celý deň

Pri štítku sa ukázalo, že **`saveMetadata()` prepisoval `accessLevel` na
všetkých úsekoch dokumentu vrátane kurovaných párov**. Pár odvodený z troch
predpisov by prevzal úroveň jedného z nich — stačilo prepnúť ten jeden na
verejný. Nenašlo sa to premýšľaním o kurácii, ale čítaním všetkých ciest
zápisu do knižnice. Odvtedy je v hlavičke `lib/curation.ts` napísané, čo každá
z nich s párom robí, aby sa to pri štvrtej ceste (RSS, e-mail, ISSF) nemuselo
objavovať znova.

### Vedomé obmedzenie

`buildSources()` doteraz neniesol `chunkId`, takže **odpovede spred dneška sa
kurovať nedajú** — nedá sa spätne povedať, z ktorých úsekov vznikli, a úroveň
prístupu by bola odhad. Radšej nič než pár, ktorého úroveň je odhad.

### Stav na konci dňa

`main` nasadený na `intranet.futbalsfz.sk`, `npm run check` bez nálezu, 1318
testov zelených, `eslint` 0 errors. Overované na produkcii, nie na dôvere:
čitateľova cesta („nesedí" + poznámka → fronta), posudok hodnotiteľa
(`evaluatedAt`/`evaluatedBy` v databáze, položka z fronty zmizne), kurácia
(pripraviť → zverejniť → štítok v živej odpovedi → archivovať) aj premenovanie
roly (pred migráciou, po nej a po odstránení prechodu).

**Otvorené** je v `docs/TODO.md` — tlmenie páru v poradí (spúšťač: po prvých
desiatich pároch), štvrtá cesta zápisu, brána pred go-live nad rámec tvrdého
prahu na únik, retencia `evaluations` a zmienka o „eval sade D9" na verejnom
webe.
