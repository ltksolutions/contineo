# NEXT — kde sme a čo je ďalší krok

> Jedna strana pre rituál **„Zorientuj sa"**. Podrobnosti a odôvodnenia sú
> v `docs/TODO.md`; sem patrí len to, čo treba vedieť pri štarte.
>
> **Tento súbor je indícia, `git log` je pravda.** Keď si protirečia, verí sa
> gitu a NEXT.md sa opraví. Aktualizuje sa pri rituáli **„Poupratuj"**.

Posledná aktualizácia: **2026-09-23 popoludní** (po PR #96: ADR-011 — PDF ako schvaľovaný dokument, nahrávanie do 25 MB, CSRF na POST cestách)

---

## Kde sme teraz

Celý designový handoff — **PR 0 až 14** (`docs/design/*.md`) — plus štyri
dorábky a upratanie sú **zlúčené v `main`**: merge commit `415d5d7`, 105
commitov, PR #46–#62. Všetkých 17 PR je zavretých, vetvy zostali.

**Nasadené do produkcie** 2026-09-22: Vercel projekt `contineo-app`, domény
`intranet.futbalsfz.sk` a `app.contineo.app`. Prítomnosť znenia sa dá overiť
v pätičke — píše sa tam krátky hash nasadeného commitu.

Overenie pred zlúčením: `tsc` ✓, `eslint` 0 errors (42 warnings = baseline),
`vitest` 1422 ✓ / 87 súborov, `build` ✓ — dnešná baseline je **1440 / 88**,
viď nižšie. Po nasadení prešlé naostro: prehľad, knižnica (tabuľka aj karty),
filter stavu, `/hr` s pásikom potvrdení, odpoveď na otázku so **stupňami
zhody** pri zdrojoch, a mobilné zobrazenie na 390 px.

**Migrácia `sectionKey` → `category` prebehla** 2026-09-22 na produkčných
dátach: desiatim dokumentom odišlo zaradenie, jednému z neho pribudol druh
(„smernice" → `smernica`), z 1991 úsekov odišiel nepotrebný údaj. Snímka
pôvodných hodnôt je v `private/zalohy/pred-o21-krok2-2026-09-22.json`.
Vyhľadávanie overené po migrácii na ostrom intranete.

**Marketingový web beží na Next 16.** Obe polovice repozitára sú tým na
rovnakej veľkej verzii: `app/` od 17. 9., `web/` od 22. 9. Zanikol tým aj
rozdiel v ESLinte (obe majú plochú konfiguráciu) a v bráne (`proxy.js`
namiesto `middleware.js`). React zostáva v oboch na 18.3.1.

Všetkých 64 zlúčených vetiev sa zmazalo 22. 9. so súhlasom Jána; po nich
zostal chvíľu jediný `main`.

**Po handoffe prišlo kolo opráv proti `MASTER.md` a `KNIZNICA.html`** (22.–23. 9.).
Zlúčené sú **PR #70 až #74**: ikony v poliach podľa toho, čo pole robí; oprava
produkcie, kde `/library/new` padala na funkcii odovzdanej klientskemu
komponentu; knižnica proti `MASTER.md` (koreňové pravidlo podčiarknutia, jeden
slovník stavov, panel filtrov); query builder s poľom „Platné do" a hodnotou
`dnes` ako tokenom; a odchod facetu `expired`, ktorý sa odteraz prekladá na
podmienku „Platné do pred dnes".

**`KNIZNICA.html` je nasadený celý** (PR #75, zlúčený 23. 9.): prejdených je
všetkých osem rámov — panel filtrov, zásuvka na telefóne, dva prázdne stavy,
karty na tablete a telefóne, panel ako karta, akcie v hlavičke vpravo, prázdna
knižnica a tmavá téma.

**Po tom zlúčení knižnica s filtrom spadla** a hneď sa to opravilo (PR #76).
`activeNames` siahalo na `facetLabel`, ktorý vznikal o sedemdesiat riadkov
nižšie — `ReferenceError` v dočasnej mŕtvej zóne. Bez filtra stránka fungovala,
lebo `activeChips` vrátilo prázdne pole a callback sa nezavolal.

**Ani jedna z našich štyroch bŕzd to nezastavila**, preto pribudla piata:
`@typescript-eslint/no-use-before-define` je odteraz **chyba** (PR #77).
`tsc` to chytiť nevie — `TS2448` hlási len priamy odkaz v tom istom mieste,
a náš bol vnútri callbacku, teda pre kompilátor odložené vykonanie.

**Prišli odpovede DPO k O15/O16** (Švehlová, 23. 9.) — 15 z 21 otázok; zapísané
v `docs/O15_O16_otazky_pre_DPO.md`. Z nich vznikli dve zmeny, obe **zlúčené a nasadené**:

- **D91 (PR #79)** — pri každom znení je **povinná zodpovedná osoba** (nededí sa)
  a **právny základ** (zákonná povinnosť / oprávnený záujem). Základ určuje
  zodpovedná osoba na stránke znenia, správca obsahu len ako náhradník.
  Potvrdenie nesie odtlačok oboch. Kontakt vidno nad potvrdzovacou kartou.
- **D92 (PR #80)** — právny základ sa vyberá **len z číselníka**; štandardné
  položky v `codelists/legalBasis.json`, vlastné spravuje správca organizácie
  v Nastavenie organizácie → Číselníky.

**Obe obrazovky neboli overené očami na mobile** (lokálne treba prihlásenie).

**Večer 23. 9. zlúčené a nasadené PR #82 až #84** (práca už z VS Code na Jánovom Macu):

- **Zodpovedná osoba je doplnená všetkým 10 platným zneniam** v SFZ — Ján,
  kým sa garanti neurčia menovite. Zapísané skriptom `npm run responsible:set`
  cez `setVersionResponsible()`, teda s históriou a auditom. Nahradené znenia
  nechané bez osoby zámerne. `npm run check` ich už nevypisuje.
- **Číselník právnych základov** je zosúladený so znením, ktoré dostala DPO
  (štyri texty, kľúče bez zmeny).
- **Krok „nadbytočné `text-decoration`" je hotový** — 24 pravidiel a tri
  inline štýly preč; päť zostalo a každé má dôvod v komentári. Overené
  porovnaním vypočítaných štýlov v Chrome (390 a 1440 px), **nie očami na
  prihlásených obrazovkách**.
- **Plán D93** (výber podľa filtra) je v `docs/D93_plan_vyber_podla_filtra.md`.

**Potom zlúčené PR #86 — D93 PR 0 a 1**, dve chyby nezávislé od rozhodnutia
o variante:

- **Export CSV rešpektuje filter oddelenia** — obrazovka aj export berú
  filtre z jednej funkcie `listFilterOf()`. Overené na `sfz.localhost`:
  obrazovka = CSV pri piatich filtroch (produkcia pred opravou 0 vs. 10).
- **Presun do priečinka zapisuje audit** — po jednom aj hromadne, priečinky
  cestou názvov. **Naživo neoverené**, len testy: lokálny server píše do ostrej
  databázy a záznam v audite je nevratný. Pozrieť pri prvom skutočnom presune.

**Potom prvé nahratie ostrého dokumentu cez rozhranie — a z neho ADR-011**
(PR #88–#96). Pracovný poriadok SFZ (2,5 MB `.docx`) padol dvakrát: najprv
na strope serverovej akcie 1 MB, potom na 34 MB obrázku EMF, ktorý prevod
vkladal do textu ako base64 (47 MB → zápis do Monga padol). Obe opravené.
Ján pritom pomenoval skutočný problém: **schvaľovalo a potvrdzovalo sa
Markdown**, bez príloh, formulárov a obrázkov. Odtiaľ ADR-011:

- **PDF je dôkaz** (povinné pri znení), **upraviteľný zdroj** (`.docx`…) je
  odporúčaný — text na vyhľadávanie aj predloha pre ďalšie znenie.
- **Súbory do 25 MB** po kúskoch do GridFS (Atlas, žiadne druhé úložisko),
  čítanie prúdom, SHA-256 pri každom súbore.
- **Identita konceptu = PDF + text** (`draftIdentity`); zmena ktoréhokoľvek
  zruší schválenie. Znenia spred ADR-011 majú identitu z textu ako doteraz.
- Schvaľovateľ a zamestnanec **vidia PDF**; potvrdenie nesie SHA-256 PDF.
- Popri tom: schvaľovateľ videl platné znenie namiesto konceptu (PR #91),
  a kontrola `Origin` na POST cestách (PR #93, #96).

**Nič z ADR-011 zatiaľ nebolo vyskúšané naostro** — žiadne znenie PDF ešte
nemá. Prvé nahratie PDF + `.docx` robí Ján.

Zlúčené vetvy sa odteraz mažú automaticky (`CLAUDE.md`, súhlas Jána);
na `origin` aj lokálne je jediný `main`.

## Čo čaká na rozhodnutie Jána

**Automatický prevod `.docx` → PDF** (ADR-011, časť 4) — ušetril by správcovi
krok, ale cez Microsoft Graph chce nové povolenia v Entra ID. Kým nie je
rozhodnuté, správca ukladá PDF z Wordu sám.

**D93 — deväť otázok v časti 6 plánu** (`docs/D93_plan_vyber_podla_filtra.md`):
kľúč v adrese, čo s dokumentom, ktorý medzi náhľadom a vykonaním z filtra
vypadol alebo pribudol, povinnosť náhľadu, audit presunu, prideľovanie
v režime „filter" a strop. Odporúčanie je v pláne; bez odpovedí sa začína
len PR 0 a 1, ktoré na rozhodnutí nezávisia.

**Dva dokumenty sú u DPO (Švehlová)** v `Claude outputs`:
`O15_O16_otazky_pre_DPO_kolo2.docx` (presné číslo retencie a strop, B5–B7, časť C,
čl. 21 pri oprávnenom záujme, osoby bez pracovného pomeru) a
`Pravne_zaklady_navrh_ciselnika.docx` (kontrola predvyplnených odkazov). **Kým
neodpovie, lehoty v databáze sa neimplementujú** a odkazy v číselníku sú návrh IT.
C1 (informovanie) a A3 (balančný test) sú **brány pred pilotom**.

**Atlas index má stále `sectionKey` ako filter a token** (`scripts/atlas_init.mjs`).
Nič tým nepokázil — Atlas Search chýbajúce pole znesie a dotazy sa naň už
nepýtajú — ale je to mŕtva definícia. Vyhodí sa pri najbližšom
preindexovaní; prekresliť index len kvôli tomu za to nestojí.

**`.page-head` nesedí s rámom o dve hodnoty** — medzera 12 px a spodný odstup
6 px proti rámovým 10 a 14 (`KNIZNICA.html`, rám 1). Triedu zdieľa
`/hr/evidence`, takže zmena siaha mimo knižnicu a do PR #75 nepatrí. Otázka
je, či sa má rám dotiahnuť na obe obrazovky, alebo či knižnica dostane vlastnú
hodnotu.

## Najbližšie kroky

0. **Prvé nahratie podľa ADR-011** — Pracovný poriadok SFZ ako PDF (povinné)
   + `.docx` (zdroj). Overiť: nahratie po kúskoch s percentami, text zo
   zdroja bez obrázkov, PDF a zdroj na detaile, predloženie na schválenie,
   PDF u schvaľovateľa na počítači aj telefóne (390 px). Pri chybe logy
   Vercelu (`POST /library/new`, `/api/library/upload`).
1. **Právny základ pre 10 platných znení** — vyberá ho zodpovedná osoba (Ján)
   na stránke znenia; `npm run check` ich vypíše. Po odpovedi Švehlovej opraviť
   `codelists/legalBasis.json` **skôr**, než sa podľa neho začnú vyberať
   základy — znenia si nesú kópiu. Zodpovedná osoba je doplnená (PR #82).
2. **D93 PR 2 — poistná sieť:** testy `moveManyAction` pri dnešnom správaní
   (prázdny výber, čiastočná dávka, `back` bez open redirectu). Na rozhodnutí
   nezávisí; treba nový vzor mockovania `libraryContext` a `next/navigation`.
3. **D93 PR 3 a ďalej — výber „všetko, čo vyhovuje filtru"** podľa plánu,
   až po odpovediach na otázky v časti 6. „z toho N mimo tohto zoznamu"
   (počíta proti strane, nie filtru) sa opravuje v PR 4.

Prázdny stav knižnice pri filtri, ktorý nič nenájde, bol pôvodne prvým krokom
a **je vybavený** (`19db418`, `accb500`): prázdno z filtra vymenuje filtre, ktoré
zoznam vyprázdnili, a prázdna knižnica je odteraz iná stránka — bez panela,
hľadania a exportu, lebo pri nule dokumentov niet čo filtrovať.

Ďalšie otvorené veci (história zmien na osobe, obsah príručky, rozsah hľadania
čakajúci na druhý vstupný kanál) sú v `docs/TODO.md` — nie sú na rade.

## Ako sa projekt overuje

Všetko sa púšťa z adresára `app/`:

```
cd app && npx tsc --noEmit && npx eslint . && npx vitest run && npm run build
```

Baseline, proti ktorej sa porovnáva: **0 errors, 42 warnings, 1548 testov
v 97 súboroch.** Nová chyba alebo nové varovanie znamená regresiu, nie šum.

**Tieto štyri brzdy nevidia chyby za behu.** 23. 9. prešli všetky štyri
a produkcia aj tak spadla (dočasná mŕtva zóna v `library/page.tsx`). Preto
je odteraz `@typescript-eslint/no-use-before-define` zapnuté ako **chyba** —
`tsc` túto triedu chýb chytiť nevie, hlási len priamy odkaz v tom istom
mieste, nie odkaz vnútri callbacku.

**Stránka sa overuje telom odpovede, nie stavovým kódom.** Next servíruje
chybovú stránku s kódom **200**, takže `curl -o /dev/null -w '%{http_code}'`
o ničom nevypovedá. Hľadá sa reťazec „A server error occurred" v tele.

**A overuje sa to, čo ľudia s obrazovkou robia, nie to, čo sa menilo.**
Knižnica nasadená bez vyskúšaného filtra nie je overená knižnica.

Rozhranie sa overuje **mobile first**: 390 px tmavá a 1440 px svetlá.
Zlomové body sú len **640 a 1024**, iné nepribúdajú.

`npm run build` zhodí bežiaci `npm run dev` — zdieľajú `.next`. Buildom sa
overuje až po zastavení dev servera.

**Lokálne SFZ je na `http://sfz.localhost:3000`, nie na `localhost`** — ten
patrí tenantovi LTK a osoba Jána tam nie je (D90), takže knižnica hlási
„Stránka sa nenašla" aj pri prihlásení. Prihlasuje sa zvlášť; odkaz z e-mailu
má v `callbackUrl` https, po prihlásení treba ručne otvoriť `http://`.
**Lokálny server píše do ostrej databázy** — zápisy (presun, audit) sa
naživo skúšajú len so súhlasom Jána.

**Marketingový web má vlastnú sadu** a púšťa sa z `web/`:

```
cd web && npx eslint . && npx vitest run && npm run build
```

Baseline: **0 errors, 0 warnings, 13 testov v 2 súboroch, 62 predgenerovaných
stránok** (z toho 18 OG a Twitter obrázkov). `next lint` tu už neexistuje —
volá sa priamo `eslint`.

## Mapa dokumentácie

`CLAUDE.md` sú konvencie repozitára a rituály. **`NEXT.md` (tento súbor)** je
stav a ďalší krok. `docs/TODO.md` je dlhý backlog s odôvodneniami — čo sa
nerobí a prečo. `docs/DEVLOG.md` je datovaný denník práce. `CHANGELOG.md` sú
zmeny pre používateľa. **Rozhodnutia sú v `docs/decisions/`** (prijaté ADR,
rozcestník v `README.md` toho priečinka, konvencia MADR) a `docs/OPEN_DECISIONS.md`
(otvorené, očíslované `D1`, `D2`…). Plány `docs/D79_plan_*.md` a `docs/O7_plan_*.md`
sú návrhy postupu, nie rozhodnutia, a zostávajú v `docs/`.
