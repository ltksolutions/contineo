# DPO — výkaz s hľadaním (`/dpo`)

Referencia: `DPO-vykaz-hladanie.html`. Základ: `ZAKLAD.md`. Nadväzuje na `DPO-ochrana-udajov` (v kóde). Zdroj: `app/src/app/dpo/page.tsx`, `lib/dpo.ts` (`LegalBasisRow`, `summarize`), i18n `dpo`, ADR-012 (D104, D105, D153).

## Prečo

13 riadkov pod sebou, 11 s rovnakým nedostatkom a tou istou zodpovednou osobou. DPO hľadá jeden predpis očami a každej osobe píše zvlášť pri každom predpise.

## Čo sa nemení

DPO kontroluje, neurčuje (O15/A10). CSV, zápis a rozhodnutie námietky (D105), „Vyhovieť" červené, `upheldWarning`. Karta drží „Zodpovedná osoba", nie „Garant" (Ján 24. 9.). Odkaz z upozornenia `/dpo#objections` (D153) platí.

## Čo sa mení

1. **Hľadanie** — `<form method="get">`, `?q=`, lupa (ZAKLAD B), 36 px (`--control-h-sm`). Filtruje sa na serveri nad `legalBasisRows()`: `title`, `basisLabel`, `reference`, `responsible.fullName`; bez diakritiky a veľkosti písmen. Zhoda v názve v `<mark>`.
2. **Filtre s počtami namiesto dlaždíc** — Stav (všetky / s nedostatkom / v poriadku), Právny základ (zákonná povinnosť / oprávnený záujem / bez základu), Zodpovedná osoba. Odkazy, `?state=`, `?basis=`, `?person=`. Počty z `summarize()` nad výsledkom hľadania. Od 1024 px stĺpec vľavo (ako knižnica), pod 1024 px vodorovné pilulky. Nad zoznamom čipy nasadených filtrov + „Zrušiť všetko".
3. **Zoskupiť** — prepínač `?group=state|person`. Podľa stavu = dnešné skupiny. Podľa osoby: hlavička skupiny s menom, adresou, „n predpisov, m s nedostatkom" a tlačidlom **„Napísať e-mail · m"** (`mailto:` s predmetom a zoznamom predpisov s nedostatkom v tele). Stĺpec Zodpovedná osoba vtedy odpadá. Riadky bez osoby = skupina „Bez zodpovednej osoby" na začiatku.
4. **Čakajúca námietka ako pás nad výkazom** (`pending > 0`), tlačidlo „Rozhodnúť" → `#objections`. Nahrádza piatu dlaždicu.
5. **Námietky**: „+ Zaevidovať námietku" do hlavičky sekcie (stále `<details>`), rozhodnuté námietky zbalené pod „Rozhodnuté (n) · zobraziť".
6. **Prázdny stav** s filtrom podľa ZAKLAD úloha 1: „Hľadaniu nič nevyhovuje" + „Zrušiť hľadanie" → `/dpo`, v texte odkaz na knižnicu (archívne a pripravované znenia).
7. Telefón: CSV na koniec zoznamu (v hlavičke sa nezmestí).

Nové texty (sk/cs/en): `searchPlaceholder`, `filterState`, `filterBasis`, `filterPerson`, `groupBy`, `groupState`, `groupPerson`, `writeEmail(n)`, `mailSubject`, `mailBody(list)`, `groupPersonMeta(total, bad)`, `pendingBanner(n)`, `pendingBannerMeta(name, date)`, `noMatch`, `noMatchText`, `clearSearch`, `decidedToggle(n)`.

## Rozhodnuté (1. 10. 2026)

- **Q1** Dlaždice sa rušia, čísla sú vo filtroch. Piatu (námietky) nahrádza pás. Mení bod 1 `DPO-ochrana-udajov`.
- **Q2** Predvolené zoskupenie **podľa zodpovednej osoby** (`group` chýba = `person`); podľa stavu je druhá voľba.
- **Q3** CSV **vždy celý výkaz**, bez filtra a hľadania (výkaz je doklad). `/dpo/csv` sa nemení.
- **Q4** `mailto:` do 25 predpisov so zoznamom v tele; nad 25 len počet a odkaz `/dpo?person=…`.
- **Q5** Len platné znenia (`legalBasisReport`). Prázdny stav odkazuje na knižnicu.

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | bez hľadania, podľa osoby, 1 námietka čaká |
| **834** | hľadanie „prestup" + filter Bez základu, 1 výsledok |
| **390** | predvolený stav (z e-mailu); druhý rám — hľadanie bez výsledku |

## Údaje, ktoré v modeli NEEXISTUJÚ

Žiadne. V referencii je druhá zodpovedná osoba (Marek Horák) len na ukážku zoskupenia. 🔴 Zmena schémy: **žiadna.**

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/DPO-vykaz-hladanie.html + .md.
Vetva design/dpo-vykaz-hladanie z main. Rozhodnutia Q1–Q5 v .md (1. 10. 2026).
Nadväzuje na DPO-ochrana-udajov (v kóde). DPO kontroluje, neurčuje — nič
nové nezapisuje. Bez JS: filtre sú odkazy, hľadanie GET formulár, stav v adrese.

1. Parametre /dpo cez normalizeQuery: q, state (problems|ok), basis
   (legalObligation|legitimateInterest|none), person (e-mail), group (person|state;
   chýba = person). Neznáme hodnoty ignorovať.
2. Čistá funkcia v lib/dpo.ts, napr. filterLegalBasisRows(rows, query):
   hľadá v title, basisLabel, reference, responsible.fullName — bez diakritiky
   a veľkosti písmen; potom state/basis/person. Testy v dpo.test.ts.
   Počty filtrov = summarize() nad výsledkom hľadania (pred state/basis/person
   pre ich vlastnú skupinu, ako facety v knižnici).
3. Dlaždice (.dpo-tiles) zrušiť. Pás .dpo-alert nad výkazom len pri pending > 0:
   „{n} námietka čaká na rozhodnutie", meno + dátum najstaršej, tlačidlo
   „Rozhodnúť" → #objections.
4. ≥1024 px: stĺpec filtrov vľavo (240 px, sticky; vzor facety knižnice),
   vpravo pole hľadania (lupa, --control-h-sm) + prepínač .view-switch
   „Podľa stavu / Podľa osoby". <1024 px: filtre ako vodorovne posúvateľné
   pilulky pod poľom. Nad zoznamom čipy nasadených filtrov + „Zrušiť všetko".
   Zhoda v názve <mark> (na serveri, escapovať).
5. group=person: skupina na osobu (riadky bez osoby = „Bez zodpovednej osoby"
   prvá), v osobe najprv s nedostatkom. Hlavička: meno, e-mail,
   „n predpisov, m s nedostatkom", tlačidlo „Napísať e-mail · m" (mailto:
   predmet + zoznam predpisov s nedostatkom; nad 25 len počet a odkaz
   https://<host>/dpo?person=<email>). Stĺpec Zodpovedná osoba vtedy nie je.
   Tlačidlo len pri m > 0. group=state: dnešné skupiny bez zmeny.
6. Karty pod 1024 px bez zmeny („Zodpovedná osoba", nie „Garant").
   Na telefóne CSV na konci zoznamu. CSV (/dpo/csv) vždy celý výkaz — nemeniť.
7. Prázdny stav (ZAKLAD úloha 1): „Hľadaniu nič nevyhovuje", text s odkazom
   na knižnicu, „Zrušiť hľadanie" → /dpo. Bez predpisov ostáva dnešný t.empty.
8. Námietky: „+ Zaevidovať námietku" do hlavičky sekcie (stále <details>,
   pri ?error=1 otvorené), rozhodnuté zbalené pod „Rozhodnuté (n)".
   #objections a rozhodovací formulár bez zmeny.
9. i18n sk/cs/en: searchPlaceholder, filterState, filterBasis, filterPerson,
   groupBy, groupState, groupPerson, noPerson, writeEmail(n), mailSubject,
   mailBody(list), mailBodyLink(n, url), groupPersonMeta(total, bad),
   pendingBanner(n), pendingBannerMeta(name, date), noMatch, noMatchText,
   clearSearch, clearAll, decidedToggle(n).

Testy: dpoPage.test.ts — hľadanie, filter, oba pohľady, mailto do 25 / nad 25,
pás pri pending, prázdny stav. Over 390 / 834 / 1440 a tmavú tému.
Pred commitom tsc, eslint, vitest, build. Do hlavičky page.tsx odkaz na
DPO-vykaz-hladanie (mení bod 1 DPO-ochrana-udajov).
```
