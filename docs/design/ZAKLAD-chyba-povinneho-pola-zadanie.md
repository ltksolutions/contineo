# Zadanie pre Claude Design — ZAKLAD-chyba-povinneho-pola

> Podklad pre to, ako formulár povie, že **povinné pole ostalo prázdne**.
> Pripravené 2. 11. 2026 na Jánovu požiadavku („ten tooltip design sa mi
> nepáči, Apple SwiftUI nemá iný?"). Vzniká v Claude ako artefakt typu
> *Design* s pripojeným artefaktom „Contineo — design system". Časť
> „Prompt pre Claude Design" sa vloží do toho artefaktu, zvyšok je kontext
> pre Jána.
>
> **Artefakt *Design*:** https://claude.ai/artifact/UjbnVF4oDkkbbm8BnAFzYw
> (plochy 1440 / 834 / 390 svetlá a 390 tmavá; odchýlky `.field-error`,
> `.is-invalid`, `.upload-summary` sú v `<helmet>` hlavnej plochy).
>
> **Stav:** čaká na návrh a rozhodnutie Q1–Q4.
>
> **Meradlo je design system Contineo** (`.design-sync/conventions.md`,
> `app/src/app/globals.css`, `app/src/components/`). Čo v ňom chýba, návrh
> pomenuje ako **odchýlku**.

## Prečo

Pri nahrávaní dokumentu (`/library/new`, 2. 11. 2026) ostal prázdny
povinný **Druh**. Jediný signál bola bublina prehliadača „Vyplňte toto
pole" — malá, v Safari takmer neviditeľná, kreslí ju systém (CSS na ňu
nesiaha), zmizne po pár sekundách a ukáže **len prvé** chybné pole.

PR #523 pridal červený okraj s podkladom a popis „Povinné — vyplňte"
(`:user-invalid`). Bublina však ostala a Jánovi sa nepáči.

## Čo robí Apple

SwiftUI **validačnú bublinu nemá**. Apple v rozhraní používa tri vzory:

| vzor | kde u Applu | pre nás |
|---|---|---|
| **A. červený text pod poľom** (pätička `Section` / riadok pod `TextField`) | vytvorenie Apple ID, Nastavenia → heslo | funguje na webe aj s dlhým formulárom, povie *ktoré* pole a *čo* |
| B. neaktívne hlavné tlačidlo, kým nie je všetko vyplnené (`.disabled(!isValid)`) | „Hotovo" v Kontaktoch, nový účet v Mail | nepovie, čo chýba; na dlhom formulári hádanie; bez JS nefunguje |
| C. upozornenie (`.alert`) so zoznamom | zriedka, pri odoslaní | prerušuje, chyba nie je pri poli |

**Odporúčanie: A** — zhoduje sa s HIG („povedz pri poli, čo je zle,
a ako to opraviť") a so zásadou, že stránka funguje bez JavaScriptu.

## Čo je dnes

- Povinné pole má za popisom sivé „Povinné" (`--t-required`, 12. 10.).
- Po pokuse o odoslanie (`:user-invalid`, PR #523): okraj `--bad-fg`,
  podklad `--bad-bg`, popis „Povinné — vyplňte" červeno.
- Vlastný `Select` stráži povinnosť skrytým `.select-required`.
- Bublinu kreslí prehliadač pri prvom chybnom poli.
- Chybu zo servera hlási `Notice` (`.notice--error`) hore na stránke.

## Čo navrhnúť

Obrazovka **Nahrať dokument** (`/library/new`), krok 2 Metadáta, po
stlačení „Nahrať" s prázdnym **Názvom** a **Druhom**:

1. **Pole s chybou** — okraj a podklad ako dnes (`--bad-fg` / `--bad-bg`).
2. **Riadok pod poľom** namiesto bubliny: ikona „!" a krátka veta, čo
   doplniť („Zadajte názov dokumentu.", „Vyberte druh dokumentu."). Nahrádza
   nápovedu pod poľom, alebo stojí nad ňou — Q2.
3. **Prvé chybné pole** dostane fokus a stránka k nemu doroluje.
4. **Pri tlačidle „Nahrať"** (na konci formulára) súhrn „Chýbajú 2 povinné
   údaje." — Q3.
5. Bublina prehliadača sa **s JavaScriptom nezobrazí**; bez neho ostáva
   ako záloha.

Plochy: **390** (iOS), **834** (iPadOS), **1440** (macOS), svetlá aj
tmavá téma.

## Otázky pre Jána (s odporúčaním)

- **Q1 — Vzor.** **A (odporúčané)** červený text pod poľom · B neaktívne
  tlačidlo · C upozornenie. A povie, ktoré pole a čo s ním, aj na dlhom
  formulári.
- **Q2 — Veta a nápoveda.** **Veta nahradí nápovedu, kým je chyba
  (odporúčané)** · obe pod sebou. Dve vety pod poľom na telefóne odtlačia
  ďalšie pole o tri riadky.
- **Q3 — Súhrn pri tlačidle.** **Áno, jedna veta s počtom (odporúčané)** ·
  nie. Po stlačení na telefóne je prvé chybné pole často mimo obrazovky —
  veta pri tlačidle povie, prečo sa nič nestalo.
- **Q4 — „Povinné — vyplňte" v popise.** **Späť na sivé „Povinné"
  (odporúčané)** · ponechať červené. Keď chybu nesie riadok pod poľom,
  červený popis ju hovorí druhýkrát.

## Prompt pre Claude Design

> Navrhni, ako formulár Contineo povie, že povinné pole ostalo prázdne —
> **namiesto bubliny prehliadača „Vyplňte toto pole"**. Vzor je Apple HIG
> a SwiftUI: chyba je **červený riadok priamo pod poľom** (ikona „!" +
> krátka veta, čo doplniť), nie bublina ani alert.
>
> Obrazovka: **Nahrať dokument**, krok „2 Metadáta" (`.form-group--lg`,
> `.form-group-head--step`, `div.card.form-group-body`, mriežka
> `.upload-grid`). Polia: **Názov** (`label.field` > `.field-label`,
> `input.field-input`, `.field-hint` „Objaví sa doslovne v potvrdzovacej
> formulke…"), **Druh** (komponent `Select`, nápoveda „Typ dokumentu —
> práve jeden…"), **Prístupnosť**, **Jazyk dokumentu**, `<details>` Ďalšie
> údaje. Na konci formulára plné tlačidlo „Nahrať".
>
> Stav na kreslenie: človek stlačil „Nahrať", **Názov a Druh sú prázdne**.
> - pole s chybou: okraj `--bad-fg`, podklad `--bad-bg` (existuje);
> - pod poľom riadok chyby: „!" v kruhu + „Zadajte názov dokumentu." /
>   „Vyberte druh dokumentu.", farba `--bad-fg`, `--fs-micro`; kým je
>   chyba, nahrádza nápovedu;
> - popis poľa ostáva s **sivým** „Povinné";
> - pri tlačidle „Nahrať" veta „Chýbajú 2 povinné údaje." (`--bad-fg`);
> - fokus na prvom chybnom poli (obrys `--accent`, 2 px).
>
> Plochy 390 / 834 / 1440, svetlá aj tmavá téma. Používaj len tokeny
> a triedy z pripojeného design systému; **čo v ňom chýba** (riadok chyby
> pod poľom, súhrn pri tlačidle), **pomenuj ako odchýlku** v `<helmet>`
> a v poznámke na plátne. Nekresli bublinu, toast ani modálne okno.
