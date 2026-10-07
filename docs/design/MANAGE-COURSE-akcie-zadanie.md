# Zadanie pre Claude Design — MANAGE-COURSE-akcie

> Podklad pre návrh **správy kurzu s jedným plným tlačidlom** (súpis
> `docs/DESIGN_ODCHYLKY.md`, sekcia 5 „learning/manage/[courseKey]").
> Pripravené 7. 10. 2026 proti `main` po #292 (R3 — vlastné adresy).
> Časť „Prompt pre Claude Design" sa skopíruje do projektu v Claude Design;
> zvyšok je kontext pre Jána.

## Prečo

Obrazovka kurzu vznikla pred pravidlom ovládačov (ZAKLAD-podmenu-a-akcie,
2. 10. 2026) a pred konvenciou formulárov. Mechanické opravy sú hotové
(prepínač pohľadu P4, prepínače áno/nie P6, vlastné adresy R3). Ostali
veci, ktoré menia tvar obrazovky — preto návrh, nie oprava v kóde.

## Dnešný stav (kód na `main`)

Obrazovka má štyri adresy so spoločnou hlavičkou kurzu, kartou stavu verzie
a podmenu **Časti · Nastavenia · Zapísaní**:

| Adresa | Čo je na nej |
|---|---|
| `/learning/manage/<kurz>` | zoznam častí (poradie šípkami), formulár „Nová časť" |
| `/learning/manage/<kurz>/parts/<časť>` | bočný zoznam častí, úprava časti, bloky, „Pridať blok", testy časti |
| `/learning/manage/<kurz>/settings` | polia verzie, téma, smart:tagy, priebeh, právny základ |
| `/learning/manage/<kurz>/people` | filter stavu, tabuľka zapísaných, „Prideliť kurz" (`?assign=1`), odvolanie certifikátu (`?revoke=`) |

**Plné tlačidlá, ktoré sa dnes ukážu naraz** (koncept kurzu):

- karta stavu: „Zverejniť verziu N" (pri chýbajúcich podmienkach vypnuté);
- Časti: „Pridať časť";
- detail časti: „Uložiť" (časť), „Uložiť" (upravovaný blok), „Pridať" (blok),
  „Priradiť test" — štyri naraz;
- Nastavenia: „Uložiť";
- Zapísaní: „Prideliť kurz" v riadku nad tabuľkou, vo formulári
  „Prideliť N ľuďom", pri odvolaní „Odvolať certifikát".

Zverejnený kurz: plné „Nová verzia" (+ tiché „Archivovať"). Archív: plné
„Obnoviť ako novú verziu".

**Ďalšie nálezy zo súpisu:**

- Hlavička kurzu je vlastná (`.ch`: téma, nadpis, kľúč), nie `.page-head`
  — akcie nemajú kam ísť.
- Typ bloku (text · obrázok · galéria · dokument · video) a zdroj videa
  (nahrať · externý odkaz) sú `.pill` odkazy **vo formulári**. Konvencia:
  pilulky sú len na čítanie a `.view-switch` do formulára nepatrí. Bez JS
  pritom voľba mení polia formulára, takže dnes je to odkaz (`?add=video`).
- Na telefóne je v detaile časti „← Všetky časti". Odkaz späť sa nekreslí;
  od R3 má časť vlastný krok v ceste pod hlavičkou.
- Formulár časti (Názov, Zhrnutie, Povinná, Minúty) stojí v karte nad
  blokmi — „Uložiť" časti a „Pridať" bloku sú vedľa seba dve rovnocenné
  hlavné akcie.

## Pravidlá, ktoré návrh musí dodržať

Z `CLAUDE.md` a `.design-sync/conventions.md` (Claude Design ich má
v systéme):

- **Najviac jedno plné tlačidlo na obrazovke**, vpravo v `.page-head`;
  ostatné `.button--quiet`. Výnimka len „Odoslať po náhľade" na konci
  (R2) — sem patrí „Prideliť N ľuďom" po súhrne dopadu.
- Podmenu (`.tabs`) = kam idem; `.view-switch` = pohľad na ten istý
  zoznam; cesta pod hlavičkou = odkiaľ som prišiel, žiadne „← Späť".
- Formuláre: `.form-group` (nadpis nad kartou), `.form-row`, `.choice-row`
  (jedna z 2–5, fajka vpravo, pole voľby v `.choice-field`), `.select-row`,
  `input.toggle role="switch"`.
- Všetko funguje bez JavaScriptu: stav je v adrese, ovládače sú odkazy
  a formuláre.
- Mobile first: rámy 390 (tmavá) a 1440 (svetlá); terč aspoň 44 px.
- Texty sk (cs/en doplní kód).

## Otázky (s odporúčaním — odporúčaná je prvá)

**Q1 — Kde je „Zverejniť".**
- **A (odporúčam):** v `.page-head` kurzu ako jediné plné tlačidlo, na
  všetkých štyroch adresách. Pri chýbajúcich podmienkach je vypnuté a karta
  stavu hovorí, čo chýba. Zverejnenie je hlavný cieľ celej obrazovky.
- B: ostáva v päte karty stavu; `.page-head` je bez akcie.

**Q2 — Karta stavu verzie na podstránkach.**
- **A (odporúčam):** plná karta (kroky + kontrola) len na koreni kurzu
  (Časti); na časti, Nastaveniach a Zapísaných len štítok stavu
  v hlavičke („Koncept · v3"). Dnes sa celá karta opakuje nad každou
  podstránkou a tlačí obsah dole, na telefóne o celú obrazovku.
- B: karta všade, ako dnes.

**Q3 — Ďalšie akcie na podstránkach** (Uložiť nastavenia, Pridať časť,
Pridať blok, Priradiť test, Prideliť kurz).
- **A (odporúčam):** všetky tiché. Formuláre na podstránke sú
  „dokončenie kroku", nie hlavný cieľ. Plné je len „Zverejniť" (Q1).
  Výnimka R2: „Prideliť N ľuďom" po súhrne je plné na konci formulára.
- B: na podstránke je plné jej vlastné tlačidlo (Nastavenia → Uložiť)
  a „Zverejniť" je tam tiché.

**Q4 — Výber typu bloku a zdroja videa.**
- **A (odporúčam):** dvojkrok ako „Pridať" v iOS — najprv `.form-list`
  s piatimi riadkami typov (ikona, názov, jedna veta), každý vedie na
  `?add=<typ>`; potom formulár toho typu s nadpisom „Pridať video"
  a odkazom „Zmeniť typ". Zdroj videa vo formulári ako dva `.choice-row`
  (Nahrať MP4 / Externý odkaz) s poľom v `.choice-field` — bez JS sa
  ukážu obe polia, s `:has` len zvolené.
- B: typ ako `.choice-row` priamo vo formulári so všetkými poľami
  v `.choice-field` (jeden formulár, dlhší).

**Q5 — Úprava časti.**
- **A (odporúčam):** názov a nastavenia časti v `.form-group` „Časť"
  pod blokmi a testami (dole, ako „Nastavenia" v iOS), s tichým „Uložiť";
  hore je obsah časti. „Odstrániť časť" ako `.form-row--danger`.
- B: ostáva navrchu, ako dnes.

## Rámy

- 390 tmavá: koreň kurzu (koncept s chýbajúcou podmienkou) · detail časti
  s „Pridať blok" krok 1 a krok 2 (video, externý odkaz) · Nastavenia ·
  Zapísaní s otvoreným „Prideliť kurz".
- 1440 svetlá: koreň kurzu (koncept pripravený) · detail časti · zverejnený
  kurz (len na čítanie) · Zapísaní.

## Prompt pre Claude Design

```
Navrhni MANAGE-COURSE-akcie — úpravu obrazovky správy kurzu
(/learning/manage/<kurz> a podstránky /parts/<časť>, /settings, /people)
tak, aby mala najviac jedno plné tlačidlo a formuláre podľa konvencie
.form-group / .form-row. Je to DIFF proti existujúcemu rámu
MANAGE-COURSE-uprava-kurzu, nie nová obrazovka: obsah, polia a stavy
(koncept / zverejnený / archív, kontrola zverejnenia, zapísaní bez skóre)
ostávajú.

Na detaile časti je dnes naraz päť plných tlačidiel (Zverejniť v karte
stavu, Uložiť časť, Uložiť blok, Pridať blok, Priradiť test); na ostatných
podstránkach dve (Zverejniť + Pridať časť / Uložiť nastavenia / Prideliť
kurz). Hlavička kurzu (.ch: téma, nadpis, kľúč) nie je
.page-head. Typ bloku a zdroj videa sú .pill odkazy vo formulári. Na
telefóne je odkaz „← Všetky časti", hoci časť má vlastný krok v ceste.

Pravidlá: najviac jedno plné .button vpravo v .page-head, ostatné
.button--quiet; výnimka „odoslanie po náhľade" (Prideliť N ľuďom po
súhrne) je plné na konci formulára. Podmenu Časti · Nastavenia · Zapísaní
ostáva (.tabs), filter zapísaných je .view-switch. Žiadne „← Späť".
Formuláre .form-group (nadpis nad kartou), voľby .choice-row / .select-row,
áno/nie input.toggle role="switch". Pilulky len na čítanie. Všetko bez
JavaScriptu (stav v adrese, odkazy a formuláre). Rámy 390 tmavá a 1440
svetlá.

Moje odporúčania (navrhni podľa nich, odchýlku zdôvodni):
1. „Zverejniť verziu N" je jediné plné tlačidlo, v .page-head kurzu na
   všetkých podstránkach; pri chýbajúcich podmienkach vypnuté. Zverejnený
   kurz: plné „Nová verzia", tiché „Archivovať". Archív: plné „Obnoviť ako
   novú verziu".
2. Plná karta stavu (kroky + kontrola) len na koreni kurzu; na
   podstránkach štítok stavu v hlavičke („Koncept · v3").
3. Uložiť nastavenia, Pridať časť, Pridať blok, Priradiť test, Prideliť
   kurz sú tiché.
4. Pridať blok ako dvojkrok: zoznam typov (.form-list, 5 riadkov s ikonou
   a vetou, každý odkaz ?add=<typ>), potom formulár typu so „Zmeniť typ".
   Zdroj videa dva .choice-row s poľom v .choice-field.
5. Nastavenia časti (názov, zhrnutie, povinná, minúty) v .form-group
   „Časť" pod blokmi a testami, tiché Uložiť; Odstrániť časť ako
   .form-row--danger.

Rámy: 390 tmavá — koreň kurzu (koncept, chýba právny základ), detail časti
s Pridať blok krok 1 a krok 2 (video, externý odkaz), Nastavenia, Zapísaní
s otvoreným Prideliť kurz. 1440 svetlá — koreň kurzu (koncept pripravený),
detail časti, zverejnený kurz (len na čítanie), Zapísaní.

Výstup ako doteraz: MANAGE-COURSE-akcie.html + .md so sekciami Čo sa mení,
Kde, Prečo, Rozhodnutia v repozitári, Rámy, Údaje, ktoré v modeli
neexistujú, Rozhodnuté, Otázky (každá s odporúčaním, odporúčaná prvá)
a Prompt pre Claude Code.
```
