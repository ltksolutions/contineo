# HR — Prideliť normy: hľadanie nad zoznamami, dva stĺpce

Referencia: `HR-pridelit-normy-hladanie.html`. Základ: `ZAKLAD.md`, `HR.md` (úloha 3), `HR-pravny-zaklad.md`, `KOMPONENT-hladanie-osob.md`, `KOMPONENT-vyber-oddelenia.md`.
Zdroj: `app/hr/assign/page.tsx`, `components/PeopleSearch.tsx`, `components/MultiSelect.tsx`, `.hr-group`, `.hr-doc`, `.hr-due`, `.assign-impact` v `globals.css`.

## Čo sa mení

1. **Rozloženie** — od 1100 px dva stĺpce: **Ktoré normy | Komu**, šírka obsahu 1180 (dnes 680). Pod nimi jedna karta **Dôvod | Termín** a súhrn s tlačidlami na celú šírku. Pod 1100 jeden stĺpec v dnešnom poradí.
2. **Normy s hľadaním** — ten istý obal ako `PeopleSearch` (pole od 8 položiek, bez diakritiky, AND, počet „n z 14", čipy „Vybrané (n)", Enter pri jednom výsledku vyberie, formulár nikdy neodošle). Zoznam v rámiku s posunom (max 420 px / 340 / 300 na mobile).
3. **Filter „len bez právneho základu (n)"** pod poľom noriem — zúži na normy so štítkom. Upozornenie D91 nad zoznamom ostáva.
4. **Komu** — podsekcie oddelené čiarou (nie nadpisy veľkými písmenami); Oddelenia `MultiSelect`, Trasy/Skupiny pilulky, Osoby `PeopleSearch`, Jednotlivé adresy. Pri „Všetkým v organizácii" sa zvyšok s JS stlmí (hodnoty ostávajú, server ich ignoruje ako dnes).
5. **Poradie** — normy podľa platnosti, najnovšie účinné znenie hore (`effectiveFrom` zostupne; dnes abecedne). Osoby podľa priezviska vzostupne (`localeCompare` s `sk`), pri zhode podľa mena. Filter ani výber poradie nemení. Priezvisko z `surname` (`listPeople()` ho vracia, `people.ts` r. 139); keď chýba, `splitFullName(fullName).surname`. Rovnako radí adresár (`directory.ts` r. 87: `surname, fullName`).
6. **Očíslované kroky 1–4** v nadpisoch kariet (Normy, Komu, Dôvod, Termín) — nie sprievodca, len orientácia.
7. **Súhrn výberu** nad tlačidlami: „2 normy · 2 oddelenia · 1 trasa · 1 osoba" — počíta prehliadač z výberu, nie je to dopad.
8. **Zastaraný dopad** — keď sa po „Skontrolovať dopad" výber zmení, `.assign-impact` zjantárovie: „Výber sa zmenil — skontroluj dopad znova". Tlačidlo „Prideliť 28 ľuďom" sa vráti na „Prideliť".

Mená polí, hodnoty (`document`, `audience`, `all`, `addresses`, `reason`, `dueMode/dueDate/dueDays`) a serverové akcie sa **nemenia**.

## Prečo

Na 1440 je dnes dve tretiny obrazovky prázdne a 14 noriem odscrolluje z dohľadu, kým sa vyberá publikum. Pri desiatkach noriem a stovkách osôb sa bez hľadania v zozname neorientuje. Súhrn výberu hovorí, čo sa odošle, bez scrollovania hore.

## Nemení sa (rozhodnutia v repozitári)

- Dopad sa **nepočíta živo**, len po „Skontrolovať dopad" (Ján, 22. 9. 2026, TODO PR 11). Súhrn z bodu 6 je len počet vybraných položiek, nie počet ľudí.
- Formulár funguje **bez JavaScriptu**: bez JS sa nevykreslí pole hľadania, čipy, súhrn, stlmenie ani jantárový stav — zostanú dnešné políčka, len v dvoch stĺpcoch.
- Dôvod povinný (D30), termín výslovnou voľbou (D61), `.hr-group` inline margin (HR.md).

## Rámy

- **1440** — dva stĺpce; 2 normy, 2 oddelenia, 1 trasa, 1 osoba; po kontrole dopadu („Povinnosť vznikne 28 ľuďom").
- **834** — jeden stĺpec; hľadá sa „poriadok" v normách.
- **390** — jeden stĺpec; hľadá sa osoba „gal"; tlačidlá na celú šírku 44 px, vstupy 16 px.
- Stavy: Všetkým (stlmené), norma nevyhovuje, výber zmenený po kontrole.

## i18n (sk/cs/en)

`hr.assign.docSearch` „Hľadať normu", `hr.assign.docNone(q)` „Nič nevyhovuje „{q}". Prideliť sa dá len platné znenie.", `hr.assign.onlyMissingBasis(n)` „len bez právneho základu ({n})", `hr.assign.showAll` „zobraziť všetky", `hr.assign.picked(n)` „Vybrané ({n})", `hr.assign.summary(...)` „{n} normy · {n} oddelenia · …", `hr.assign.impactStale` „Výber sa zmenil — skontroluj dopad znova", `hr.assign.impactStaleNote(n)`, `hr.assign.submitN(n)` „Prideliť {n} ľuďom". Počty pre `people.search.count` sa použijú aj pre normy.

## Údaje, ktoré v modeli neexistujú

Žiadne. `assignableDocuments()` má `title`, `versionLabel`, `effectiveFrom`, `legalBasisMissing`. 🔴 Zmena schémy: **žiadna**.

## Otázky na Jána

- **Q1** Dva stĺpce od 1100 px a šírka 1180 — HR.md hovorí, že HR obrazovky držia 680–900 px („formuláre, nie tabuľky"). Súhlas s výnimkou pre `/hr/assign`?
- **Q2** Filter „len bez právneho základu" — chceš ho, alebo stačí štítok v riadku?
- **Q3** Tlačidlo „Prideliť {n} ľuďom" po kontrole dopadu (a späť „Prideliť", keď sa výber zmení) — áno?
- **Q4** Pri „Všetkým" stlmiť zvyšok Komu — áno, alebo nechať ako dnes?

## Prompt pre Claude Code

```
Implementuj návrh design_handoff_contineo_intranet/HR-pridelit-normy-hladanie.html + .md
na /hr/assign (app/src/app/hr/assign/page.tsx). Najprv si prečítaj .md, HR.md úlohu 3,
KOMPONENT-hladanie-osob.md, DEVLOG a TODO PR 11 — rozhodnutia v repozitári majú prednosť.

Rozsah (jeden PR, vetva design/hr-assign-hladanie):
1. Rozloženie: od 1100 px dva stĺpce „Ktoré normy | Komu" (grid minmax(0,1fr) ×2, align-items:start),
   maxWidth 1180 namiesto 680. Pod nimi jedna .card: Dôvod | Termín (1.1fr/1fr), pod tým súhrn
   a tlačidlá. Pod 1100 jeden stĺpec v dnešnom poradí. Nadpisy kariet s číslom kroku 1–4.
2. Normy s hľadaním: zovšeobecni PeopleSearch (alebo z neho vytiahni spoločný obal) tak, aby
   vedel aj zoznam noriem — pole od 8 položiek, bez diakritiky, AND, počet „n z N", čipy
   „Vybrané (n)", Enter pri jednom výsledku vyberie a NIKDY neodošle formulár, ↓/Esc.
   Riadok .hr-doc ostáva (názov, štítok vpravo, znenie pod ním); zoznam v rámiku s posunom
   (max-height 420 / 340 pod 1100 / 300 pod 640). Hodnoty name="document" sa nemenia.
3. Odkaz „len bez právneho základu (n)" pod poľom noriem — len klientsky filter (hidden),
   upozornenie .hr-warn ostáva. (Q2 otvorená — urob ho, dá sa ľahko vypnúť.)
4. Komu: podsekcie oddelené čiarou (border-top), poradie a komponenty ako dnes
   (Všetkým → MultiSelect oddelení → skupiny/trasy .tag--choice → PeopleSearch → adresy).
   Pri zaškrtnutom „Všetkým" s JS stlmiť zvyšok (opacity + pointer-events), hodnoty nemazať.
5. Poradie: normy podľa effectiveFrom zostupne (najnovšie hore) v assignableDocuments()
   alebo v page.tsx; osoby podľa surname vzostupne, localeCompare "sk", pri zhode fullName
   (fallback splitFullName). Rovnako ako directory.ts. Pridaj test na obe radenia.
6. Súhrn nad tlačidlami (klientsky, len s JS): „2 normy · 2 oddelenia · 1 trasa · 1 osoba",
   slovenské/české tvary množného čísla; každá dvojica číslo+slovo v jednom <span>.
   Toto NIE je dopad — počet ľudí ostáva len po „Skontrolovať dopad" (rozhodnutie Jána 22. 9.).
7. Zastaraný dopad: keď sa po preview=1 výber zmení, .assign-impact dostane jantárový stav
   „Výber sa zmenil — skontroluj dopad znova" + „Pre predošlý výber by povinnosť vznikla N ľuďom".
   Po kontrole primárne tlačidlo „Prideliť N ľuďom", pri zmene späť „Prideliť". (Q3 otvorená.)

Nemeniť: mená a hodnoty polí, assignAction / previewAssignAction, audienceImpact/matchesAudience,
povinný dôvod (D30), dueMode none/date/days (D61), .hr-group inline margin. Bez JS musí formulár
fungovať ako dnes (pole hľadania, čipy, súhrn, stlmenie sa nevykreslia). Schéma bez zmeny.

i18n sk/cs/en: kľúče v .md (sekcia i18n). Na 390: tlačidlá 44 px na celú šírku, vstupy 16 px, čip 36 px.

Overenie: tsc, eslint (baseline), vitest, build; render svetlá 1440 + tmavá 390; bez JS.
Otvorené otázky Q1–Q4 z .md nechaj v PR popise.
```
