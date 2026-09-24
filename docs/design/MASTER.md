# MASTER.md — všetky obrazovky Continea

**Pre Cowork. Zoznam obrazoviek podľa rout, poradie implementácie,
a pri každej či návrh existuje.**

`ZAKLAD.md` sa implementuje ako **prvý** — obrazovky sa na jeho komponenty
len odkazujú.

---

## Pravidlá, ktoré platia VŠADE

Zopakované zámerne, aby sa nemuseli hľadať:

1. **Žiadny text natvrdo** — i18n `sk`/`cs`/`en` cez `lib/i18n.ts`.
   Chýbajúci preklad padá na slovenčinu, nie na kľúč.
2. **Nič nevyžaduje JavaScript** — filtre a výber sú odkazy, formuláre sú
   `<form>`, stav nesie adresa. `normalizeQuery` / `toQuery` sa **nemenia**.
3. **Breakpointy len 640 a 1024.** Mobile first je povinnosť (`CLAUDE.md`).
4. **`--accent` ostáva `#232a35`**, `darken(hex, 0.16)` ostáva, tenant farbu
   skladá `tenantStyle()`.
5. **`layout.tsx` sa bez Jánovho súhlasu nemení.**
6. **Nové tokeny do `:root` aj `html[data-theme="dark"]`.**
7. **Terminológia** — viď nižšie. Mocky používali staré slová; platí kód.
8. **Jeden commit na úlohu, jedna obrazovka = jeden PR.**

---

## ADR-010 platí nad zadaniami (21. 9. 2026)

Po napísaní tohto handoffu Ján prijal **ADR-010 — Metadáta bez ručných
kľúčov**. Mení dve veci, ktoré sa zadaní dotýkajú:

| Čo | Dopad | Kde je to zapracované |
| --- | --- | --- |
| Kľúč dokumentu sa **generuje** zo názvu, formulár ukazuje náhľad | `/library/new` | `NAHRAVANIE.md` úloha 4 |
| Pole **Zaradenie mizne**, zoskupovanie preberá **Druh** | `/library/new`, filtre | `NAHRAVANIE.md` úloha 5 |
| `companyCode` **navrhuje systém**, admin potvrdzuje | `/admin` | `ADMIN.md` úloha 1.4 |

**Statické rámy (`SPRAVA.html`) ADR-010 nezohľadňujú** — kreslia starý
formulár so Zaradením aj Kľúčom. V tomto jednom bode platí zadanie, nie rám;
všetko ostatné v rámoch platí.

Zadania sú prepísané, netreba nič dopočítavať. Ak ADR-010 čítaš celé
(`docs/decisions/ADR-010-metadata-bez-rucnych-klucov.md`), pozor na jeho bod 2:
**migrácia hodnôt `sectionKey` → `category` ide až po Fáze 8**, nie
s formulárom.

---

## Terminológia — platí kód, nie mock

V rámoch `.dc.html` som miestami použil slová, ktoré sa s konvenciou repozitára
bijú. **Platí pravý stĺpec.**

| V mocku (zle) | Správne | V kóde |
| --- | --- | --- |
| Kategória | **Druh** | `category`, `codelists/category.json` |
| Štítok | **Značka** | `tag`, `codelists/tags.json` |
| Útvar | **Oddelenie** | `ownerDepartment`, `departments.ts` |
| Priradiť útvarom | **Prideliť oddeleniu** | `assignments` |

Dôvod: `docs/TODO.md` (riadok 58) aj `D49` hovoria *druhy dokumentov*,
*značky*, *oddelenia*. „Útvar" je navyše obsadený — v audite znamená niečo
iné. Identifikátory v kóde zostávajú anglické (`CLAUDE.md`).

**Úloha pre Cowork:** pri každej obrazovke skontroluj i18n kľúče a ak niekde
ostalo staré slovo, oprav ho. Nie hromadným `sed` — `category` ako
identifikátor sa nemení, len zobrazený text.

---

## Stavový model dokumentu — ROZHODNUTÉ

Mock ukazoval **Platný / Návrh / Na schválenie / Expirovaný / Archív**.
Kód má dve nezávislé osi (`ADR-006`): `documents.status` a schvaľovacie kolo.

### Mapovanie na `.tag--*` varianty

| Zobrazené | Podmienka | Trieda |
| --- | --- | --- |
| **Platný** | `status: "published"` a platné znenie nemá `effectiveTo` v minulosti | `.tag--published` |
| **Návrh** | `status: "draft"`, žiadne kolo nebeží | `.tag--draft` |
| **Na schválenie** | beží schvaľovacie kolo (`in-review`) | `.tag--review` |
| **Expirovaný** | `status: "published"` a `effectiveTo` v minulosti | `.tag--expired` |

`statusTagClass()` v `lib/libraryRead.ts` toto už robí (PR 8) — **overiť, nie
prepisovať.**

### „Expirovaný" je ODVODENÝ PRÍZNAK, nie hodnota facetu

Rozhodnutie k otvorenej otázke z `TODO.md` (riadok 149):

**Facet „Stav" má tri hodnoty: Platný · Návrh · Na schválenie.**
Expirovaný medzi ne nepatrí, pretože expirované znenie **je** publikované
znenie — len po dátume. Keby bol štvrtou hodnotou, súčty facetov by
nesedeli (jeden dokument v dvoch hodnotách) a filter „Platný" by musel
tajne znamenať „platný a nie expirovaný".

Namiesto toho:
- **pilulka** v zozname expiráciu ukazuje (`.tag--expired`) — je to
  odvodené z dát, ktoré riadok už má,
- **stĺpec „Platné do"** v tabuľke nesie dátum,
- kto chce zoznam expirovaných, použije **query builder**:
  `Platné do` `pred` `dnes`. Presne na to builder je.

**„Archív" sa ruší.** V modeli nič také nie je a `.tag--archived` zostáva
nepoužitý pre neskoršie použitie (napr. staré verzie v detaile).

### ⏳ Prechodný stav (22. 9. 2026)

Kým query builder nevie pole „Platné do" s hodnotou „dnes", **facet
`expired` v kóde zostáva** — bez neho by sa expirované dokumenty nedali
vypísať vôbec. Rozhodnutie vyššie platí, len sa vykoná v dvoch krokoch:

1. **PR A — builder:** pole `effectiveTo` („Platné do"), operátory
   `pred` / `po`, hodnota `dnes` ako token (nie dátum — odkaz poslaný
   zajtra má znamenať zajtrajšok). Vlastné testy.
2. **PR B — facet preč:** až po A. Hodnota `expired` zmizne z facetu,
   `?status=expired` sa preloží na podmienku `Platné do pred dnes`, aby
   staré odkazy fungovali ďalej a ukázali to isté.

Dovtedy facet Stav má štyri hodnoty a je to vedomá výnimka, nie chyba.

### 🔴 Zmeny schémy — schvaľuje Ján osobitne

Nič v tomto bode zmenu schémy nepotrebuje. Ak by sa Expirovaný mal stať
facetom, znamenalo by to denormalizovať odvodený stav na dokument — proti
**D27** („stav sa odvodzuje, neukladá"). **Nerob to bez Jánovho súhlasu.**

---

## „Uložiť pohľad" — NEROBÍ SA v tejto vlne

Rozhodnutie k otvorenej otázke z `TODO.md` (PR 7, „zostáva k vzoru").

V mocku je v lište knižnice odkaz „Uložiť pohľad". **Odstráň ho z mocku
aj z i18n** — funkcia neexistuje a odkaz, ktorý nič nerobí, je horší než
chýbajúci odkaz.

**Prečo nie teraz:** adresa **už je** uložený pohľad. Filtre, triedenie,
stránka aj výber sú v URL (`toQuery`), takže pohľad sa dá poslať odkazom,
uložiť do záložiek prehliadača a vrátiť sa k nemu. Uložené pohľady by
pridali druhé miesto pre tú istú pravdu.

**Čo by to znamenalo, keby sa raz robilo** (pre Jánovo rozhodnutie, nie pre
implementáciu):
- 🔴 **zmena schémy** — pohľady sú na osobe (`persons.savedViews[]`) alebo
  vlastná kolekcia; obsah je názov + query string + čas vzniku,
- limit ~20 na osobu (nad tým je to zoznam, ktorý sa sám potrebuje filtrovať),
- premenovanie a zmazanie, teda ďalšie dve serverové akcie a dva formuláre,
- rozhodnutie, či sú pohľady zdieľateľné v rámci oddelenia — ak áno, je to
  oprávnenie, nie nastavenie.

Zaradiť najskôr ako samostatný PR **po** dokončení všetkých obrazoviek.

---

## Stĺpce tabuľky knižnice — ROZHODNUTÉ

> ⚠️ **Táto tabuľka je cieľ, nie popis stavu.** Do 22. 9. 2026 tu stála veta
> „Zodpovedá dnešnému kódu (`library/page.tsx`, ~790), takže sa **nemení**".
> Nezodpovedala: piaty stĺpec mal v kóde hlavičku „Platné znenie" a celý
> voľný text označenia znenia, nie „Verzia". Rozišlo sa to skôr, než tento
> súbor vznikol, a **tá veta bola horšia než ten stĺpec** — nesprávny stĺpec
> sa opraví za pol hodiny, veta, ktorá odrádza od kontroly, pokazí každý
> ďalší PR (rozhodnutie Jána 2026-09-22).
>
> **Pravidlo:** pri úprave tabuľky sa tento zoznam overuje **proti kódu**,
> nie naopak. Keď sa líšia, platí kód a opraví sa zápis.

Presné poradie zľava.

| # | Stĺpec | Zarovnanie | Pozn. |
| --- | --- | --- | --- |
| 1 | výber (checkbox) | — | `.doc-col-pick`, 36 px |
| 2 | **Dokument** | vľavo | `min-width: 280px`; pod názvom `internalNumber · počet znení · priečinok · id` |
| 3 | **Druh** | vľavo | triediteľný |
| 4 | **Stav** | vľavo | triediteľný, pilulka |
| 5 | **Verzia** | vľavo | `.doc-col-version`: `tabular-nums`, `nowrap`, `max-width: 88px`, orezanie elipsou, plné znenie v `title` |
| 6 | **Platné od** | vľavo | `.doc-col-date` |
| 7 | **Platné do** | vľavo | `.doc-col-date` — **ostáva** |
| 8 | **Potvrdenia** | vľavo | `.ack-bar`, min. 104 px |
| 9 | **Zmenené** | **vpravo** | triediteľné, predvolené triedenie |

**Stĺpec 5 nie je „len číslo".** Pôvodný zápis to žiadal, ale také pole
schéma nemá: `Version.label` je v `documents.ts` výslovne **voľný text**
(„ľudské označenie: 1.2, novela 2026"). Dokument s labelom „novela 2026"
číslo nemá a vytiahnuť z neho „2026" by bolo nesprávne. Preto celý label,
ale na jednom riadku a orezaný — úzky stĺpec sa dosiahne šírkou, nie
vymyslenou štruktúrou.

**Počet znení patrí pod názov**, nie do stĺpca Verzia: je to údaj
o dokumente, nie o práve platnom znení.

**Knižnica má vlastný strop šírky.** Deväť stĺpcov sa do predvolených
1240 px (`--shell-maxw`) nezmestí — namerané 22. 9. 2026: pri okne 1440 px
má stĺpec zoznamu 938 px a tabuľka potrebuje najmenej 1060 px, takže
Potvrdenia a Zmenené odišli do vodorovného posunu. Knižnica preto volá
`<AppShell wide>` a berie `--shell-maxw-wide` (1440 px); stĺpec zoznamu
má potom 1138 px, teda ~78 px rezervy na dlhšie preklady. **Je to strop,
nie plná šírka okna** — bez stropu by riadok na 27" monitore presiahol
2000 px a oko stratí spojitosť medzi názvom vľavo a dátumom vpravo.

**Pod približne 1360 px tabuľka aj naďalej pretečie** do vodorovného
posunu vo `.doc-table-wrap`. To je zámer, nie chyba: `overflow-x: auto`
je tam preto, aby sa stĺpce nestlačili na nečitateľné.

**„Platné do" ostáva** — je to nosič expirácie, keďže Expirovaný nie je
facet (viď vyššie). Bez tohto stĺpca by sa expirácia dala zistiť len
otvorením dokumentu.

**„Zmenené" je ABSOLÚTNY dátum, nie relatívny čas.** V mockoch som písal
„dnes 09:12", „2 dni" — to bola chyba. Dôvody:
1. `lib/i18n.ts` má **deterministický dátum** zámerne — relatívny čas sa
   pri serverovom vykreslení a klientskej hydratácii rozíde („2 dni" vs
   „3 dni" o polnoci) a React ohlási nesúlad,
2. relatívny čas sa nedá triediť očami ani porovnať medzi riadkami,
3. je to pracovný nástroj — kto hľadá, čo sa zmenilo v pondelok, chce dátum.

Použi `formatDate(r.updatedAt, uiLanguage)`, ako to kód robí dnes.

---

## Rozdelenie `/` a `/ask` — ROZHODNUTÉ

Rozhodnutie Jána (21. 9. 2026):

- **`/` je Prehľad s KPI** a je to úvodná obrazovka po prihlásení. Dnešný
  `page.tsx` to už robí (PR 5) — mení sa len to, čo je v `PREHLAD.md`.
- **`/ask` zostáva** a je to jediné miesto, kde sa otázka odpovedá. Pole
  v hlavičke odosiela `GET` s `?q=` práve sem, takže routa sa **nemaže**;
  bez nej by bolo pole v hlavičke rozbité na každej obrazovke.
- Hlavička poľa je na celom portáli, odpoveď na jednom mieste. Prehľad má
  vlastné hero pole, ktoré odosiela na to isté miesto — nie druhú
  odpovedaciu obrazovku.

`/ask/page.tsx` má dnes v hlavičke komentár „Domovská strana" — je to
pozostatok z čias, keď `/` a `/ask` boli jedno. **Oprav komentár**, nie
obsah.

## Obrazovky — poradie implementácie

Poradie je podľa toho, koľko ľudí obrazovku vidí. Prehľad vidí každý deň
každý; `/admin` vidím ja raz za mesiac.

### Vlna A — každodenné obrazovky · NAVRHNUTÉ

| # | Routa | Obrazovka | Návrh | Zadanie |
| --- | --- | --- | --- | --- |
| 0 | — | Spoločný základ | ✅ | `ZAKLAD.md` + `ZAKLAD.html` |
| 1 | `/` | Prehľad (KPI) — úvodná obrazovka | ✅ | `PREHLAD.md` + `PREHLAD.html` |
| 2 | `/ask` | Opýtať sa (odpoveď na `?q=`) | ✅ | `ASK.md` + `ASK.html` |
| 3 | `/documents` | Na potvrdenie | ✅ | `DOCUMENTS.md` + `DOCUMENTS.html` |
| 4 | `/documents/[documentId]` | Znenie na potvrdenie | ✅ | `ZNENIE.md` + `DETAIL.html` |
| 5 | `/approvals` | Na schválenie | ✅ | `APPROVALS.md` + `APPROVALS.html` |
| 6 | `/library` | Knižnica | ✅ hotové (PR 8) | `KNIZNICA.md` |
| 7 | `/library/[id]` | Detail dokumentu | ✅ | `DETAIL.md` + `DETAIL.html` |
| 8 | `/directory` | Adresár | ✅ hotové (PR 6) | — |

### Vlna B — správca obsahu · NAVRHNUTÉ

| # | Routa | Obrazovka | Návrh |
| --- | --- | --- | --- |
| 9 | `/library/new` | Nahrať dokument | ✅ `NAHRAVANIE.md` + `SPRAVA.html` |
| 10 | `/library/folders` | Správa priečinkov | ✅ `PRIECINKY.md` + `SPRAVA.html` |
| 11 | `/library/tracks` | Kolá (trasy) | ✅ `SPRAVA.md` §1 |
| 12 | `/library/curation` | Kurácia odpovedí | ✅ `SPRAVA.md` §2 |
| 13 | `/notifications` | Upozornenia | ✅ `SPRAVA.md` §3 |
| 14 | `/more` | Viac | ✅ `SPRAVA.md` §4 |

### Vlna C — HR a dôkazy · NAVRHNUTÉ

| # | Routa | Obrazovka | Návrh |
| --- | --- | --- | --- |
| 15 | `/hr` | Výkaz HR | ✅ `HR.md` + `HR.html` |
| 16 | `/hr/overview` | Prehľad HR | ✅ `HR.md` |
| 17 | `/hr/[id]` | Výkaz k dokumentu | ✅ `HR.md` |
| 18 | `/hr/assign` | Prideliť normu | ✅ `HR.md` úloha 3 |
| 19 | `/hr/evidence` | Reťaz dôkazov | ✅ `HR.md` úloha 5 |
| 20 | `/hr/reminders` | Pripomienky | ✅ `HR.md` úloha 4 |
| 21 | `/acknowledgements` | Moje potvrdenia | ✅ `POSUDENIE.md` §2 |
| 22 | `/evaluation` | Na posúdenie | ✅ `POSUDENIE.md` §1 |

### Vlna D — správa a okraje · NAVRHNUTÉ

| # | Routa | Obrazovka | Návrh |
| --- | --- | --- | --- |
| 23 | `/people` | Osoby | ✅ `OSOBY.md` + `PEOPLE.html` |
| 24 | `/people/[id]` | Karta osoby | ✅ `OSOBY.md` úloha 3 |
| 25 | `/people/new` | Nová osoba | ✅ `OSOBY.md` |
| 26 | `/people/invite` | Pozvanie | ✅ `OSOBY.md` |
| 27 | `/people/import` | Import osôb z CSV | ✅ `OSOBY.md` |
| 28 | `/organisation` | Nastavenia organizácie | ✅ čiastočne (`docs/design/README.md` §7) |
| 29 | `/admin` | Správa platformy | ✅ `ADMIN.md` §1 |
| 30 | `/guide` | Príručka | ✅ `ADMIN.md` §2 |
| 31 | `/sign-in` | Prihlásenie | ✅ hotové (`README.md` §8) |

**Zoznam je úplný k 21. 9. 2026** — overený proti `app/src/app/**/page.tsx`.
Oproti prvej verzii tohto dokumentu pribudlo sedem rout, ktoré som predtým
nemal: `/hr/overview`, `/hr/[id]`, `/hr/reminders`, `/people/[id]`,
`/people/new`, `/people/invite`, `/people/import`.

## ✅ Všetkých 31 rout je navrhnutých

Od 21. 9. 2026 nie je v aplikácii obrazovka bez zadania. Zoznam vyššie je
úplný a overený proti `app/src/app/**/page.tsx`.

**Čo to znamená pre implementáciu:** keď pri práci naďabíš na niečo, čo
zadanie danej obrazovky nepokrýva, **napíš to do PR ako otázku a kód nechaj,
ako je.** Neplatí to len pre nenavrhnuté obrazovky — platí to pre všetko, čo
v zadaní nie je. Zadania sú diffy proti skutočnému kódu; čo v nich nie je,
je buď v poriadku, alebo o tom ešte nepadlo rozhodnutie.

Zoznam vecí, o ktorých rozhodnutie **nepadlo**, je v sekcii nižšie a
v jednotlivých zadaniach pod značkou 🔴.

## Údaje, ktoré v modeli NEEXISTUJÚ

Tri veci z mockov nemajú pod sebou dáta. Sú to **samostatné rozhodnutia
s dopadom na model, nie súčasť CSS úloh** — pri implementácii ich vynechaj
a nechaj otvorené.

### 1. Facet a stĺpec „Oddelenie" na dokumente

Dokument oddelenie **nenesie**. Pridelenie žije v `assignments`
(`audience.kind`), takže filter aj stĺpec znamenajú spojenie naprieč
kolekciami. Zapísané v `TODO.md` (riadok 144).

Poznámka: `ownerDepartment` (oddelenie, ktoré dokument **spravuje**)
existuje a je šiestym facetom — to je iná vec než „komu je pridelený".
Nemýliť si ich.

🔴 Rozhodnutie pre Jána: denormalizovať adresátov na dokument (rýchle
čítanie, ale ukladá odvodený stav — proti D27), alebo agregovať z
`assignments` pri každom zobrazení.

### 2. Rozsah hľadania („Knižnica / Intranet / Verejný web / Archív")

**V systéme nič také neexistuje.** Prehľadáva sa `document_chunks` jednej
organizácie a jediné delenie je `accessLevel`. Pilulky by predstierali
voľbu, ktorá nič nemení. Zapísané v `TODO.md` (riadok 146).

**V `ASK.md` ich preto nekreslím.** Ak ich uvidíš v starom ráme
`_archiv/Contineo Obrazovky.dc.html`, ignoruj ich.

### 3. Skóre zhody pri zdrojoch odpovede

Mock ukazuje „0,94" pri každom zdroji. Hodnota z vyhľadávania existuje, ale
**nie je to číslo pre človeka** — je to vzdialenosť vo vektorovom priestore,
ktorá sa medzi dotazmi nedá porovnávať. Ukázať ju znamená tvrdiť, že
0,94 je lepšie než 0,83, čo nie je pravda v zmysle, v akom to človek čaká.

**Nerobí sa.** Zdroje sú zoradené podľa relevancie a poradie je tá informácia.

---

## Renderované referencie

Rámy v `_archiv/Contineo Obrazovky.dc.html` sú **šablóny** (`{{ d.status }}`,
`support.js`) a v prehliadači sa bez behového prostredia nevykreslia.

Preto je pri každom `<OBRAZOVKA>.md` **statické HTML** s reálnymi hodnotami
namiesto `{{ }}`, bez závislostí:

```
ZAKLAD.html          komponenty vo všetkých stavoch, svetlá + tmavá
PREHLAD.html         1440 / 834 / 390 + prázdny stav
ASK.html             1440 / 390 + bez otázky + odpoveď + nič sa nenašlo
DOCUMENTS.html       1440 / 390 + prázdny stav + po termíne
APPROVALS.html       1440 / 390 + prázdny stav + vrátené s pripomienkou
```

Otvor priamo v prehliadači. Sú to jediné súbory, podľa ktorých sa dá
porovnávať — `.dc.html` needituj a needituj ani ich.
