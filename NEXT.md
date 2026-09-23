# NEXT — kde sme a čo je ďalší krok

> Jedna strana pre rituál **„Zorientuj sa"**. Podrobnosti a odôvodnenia sú
> v `docs/TODO.md`; sem patrí len to, čo treba vedieť pri štarte.
>
> **Tento súbor je indícia, `git log` je pravda.** Keď si protirečia, verí sa
> gitu a NEXT.md sa opraví. Aktualizuje sa pri rituáli **„Poupratuj"**.

Posledná aktualizácia: **2026-09-23** (po zlúčení rámov knižnice, oprave výpadku s filtrom a zapnutí `no-use-before-define`)

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

Repozitár: pracovný strom čistý, **nula otvorených PR**. Vetvy `fix/panel-filtrov-podla-ramu`,
`fix/tdz-v-kniznici` a `chore/lint-use-before-define` sú zlúčené a **nezmazané** —
na mazanie treba Jánov súhlas.

## Čo čaká na rozhodnutie Jána

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

1. **Tridsať nadbytočných `text-decoration: none` v `globals.css`** — odkedy
   je pravidlo v koreni, potláčajú si podčiarknutie samé bez dôvodu. Samostatné
   upratovanie, nie prílepok: v jednom veľkom diffe by sa stratila vecná zmena
   a pri každom pravidle treba overiť, že ho naozaj drží len koreň. Patrí sem
   aj `.notice-confirm`. Podrobnosti v `docs/TODO.md`.
2. **„Všetko, čo vyhovuje filtru" namiesto zoznamu ID v adrese** — strop výberu
   (`MAX_PICKED = 200`) rieši rezervu, nie princíp. Chce vlastný plán: mení sa
   sémantika hromadnej akcie. Podrobnosti v `docs/TODO.md`.

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

Baseline, proti ktorej sa porovnáva: **0 errors, 42 warnings, 1440 testov
v 88 súboroch.** Nová chyba alebo nové varovanie znamená regresiu, nie šum.

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
