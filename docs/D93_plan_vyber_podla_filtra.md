# D93 — „Všetko, čo vyhovuje filtru" namiesto zoznamu ID v adrese

> **Stav:** 📝 plán, **čaká na rozhodnutie Jána** (otázky v časti 6).
> Nadväzuje na `docs/TODO.md` (výber, ktorý prežije stránkovanie; `MAX_PICKED`),
> D32 (`companyCode` v podmienke), D51 (audit), D27 (stav sa odvodzuje).
> Podklad z kódu k 2026-09-23 (`main` po PR #81).

## 1. Problém

Hromadný výber v knižnici je zoznam ID v adrese (`?pick=a&pick=b` alebo
čiarkami, `readFilters()` v `lib/libraryFilters.ts`). Adresa rastie lineárne
s počtom označených, preto má strop `MAX_PICKED = 200` (~6 kB adresy). Strop
rieši rezervu, nie princíp: kto označuje 148 dokumentov, v skutočnosti chce
„všetko z tohto filtra".

Háčik je v sémantike. Medzi tým, čo človek videl, a tým, nad čím akcia beží,
sa výsledok filtra môže zmeniť:

1. token `today` v podmienke „Platné do pred dnes" sa o polnoci posunie;
2. stav `in-review` závisí od inej kolekcie (`approval_rounds`);
3. iný správca medzitým publikuje, presunie alebo premenuje;
4. **akcia sama**: presun mení `folderPath` aj `updatedAt`, takže filter
   „priečinok X" po prvom presunutom dokumente vracia inú množinu. Zoznam sa
   preto musí zhmotniť **raz, pred cyklom** — nikdy nie počas neho.

## 2. Ako to funguje dnes

- Zaškrtnutie riadka je **odkaz** (`toQuery(togglePick(...))`, `aria-pressed`),
  „označiť stranu" tiež (`pickPage()`). Všetko funguje bez JavaScriptu
  a adresa je uložený pohľad.
- Pás hromadných akcií (`library/page.tsx`, pri `picked.length > 0`) posiela
  výber skrytými poľami `name="document"` — **v tele POST**, nie v adrese.
- Akcie sú dve (`app/library/actions.ts`):
  - **`moveManyAction`** — cyklus nad `assignDocument()` (`lib/folders.ts`),
    `companyCode` v podmienke `updateOne` (D32 drží). Čiastočná dávka sa
    vypíše do `msg` v adrese návratu.
  - **`assignManyAction`** — nič nezapisuje, presmeruje na
    `/hr/assign?document=…` (`assignHref()` v `lib/libraryBulk.ts`), teda
    **zoznam ID opäť v adrese**. `/hr/assign` predvyplní len dokumenty
    s platným znením; ostatné **ticho vypadnú**.
- Filter → dotaz: `buildQuery()` / `queryParts()` v `lib/libraryRead.ts`.
  Hľadanie je escapovaný `$regex`, nie Atlas Search — **deterministické**.
  `libraryList()` nemá limit; stránkuje sa v Node (`PAGE_SIZE = 25`).
  Ten istý dotaz sa teda na serveri pri vykonaní spustiť dá hneď.

### Nálezy, ktoré s D93 nesúvisia, ale treba ich opraviť tak či tak

| # | nález | kde |
|---|---|---|
| N1 | **Presun dokumentu do priečinka nezapisuje audit** — ani po jednom, ani hromadne. Ostatné operácie s priečinkami ho zapisujú. Zápis v TODO „audit zostáva" je nepravdivý. | `assignDocument()`, `lib/folders.ts` |
| N2 | **Export CSV ignoruje filter oddelenia** — `route.ts` neposiela `ownerDepartment`, obrazovka áno. Export vráti viac, než človek vidí. Príčina: dve ručné kópie mapovania `filters → LibraryFilter`. | `library/csv/route.ts` vs. `library/page.tsx` |
| N3 | **„z toho N mimo tohto zoznamu" počíta proti strane, nie proti filtru** — na strane 2 sa dokumenty označené na strane 1 hlásia ako „mimo", hoci filtru vyhovujú. | `pickedOutsideCount(filters.picked, pageIds)` v `library/page.tsx` |

## 3. Varianty

**A — príznak + filter, server dopočíta pri vykonaní.** Adresa nesie jeden
príznak, akcia si zoznam spočíta sama. Najjednoduchšie, ale **mení
sémantiku potichu**: spracuje aj dokument, ktorý pribudol a človek ho nikdy
nevidel. Presne obava z TODO.

**B1 — odtlačok.** Náhľad pošle počet, `asOf` a hash zoznamu; server spočíta
znova a pri rozdiele odmietne. Vyžaduje pretiahnuť `asOf` cez `buildQuery()`
(dnes sa `conditionQuery()` volá vždy s `new Date()`), nepokryje `in-review`
a pri rozdiele vie povedať len „zmenilo sa", nie čo.

**B2 — zmrazený zoznam v tele formulára.** Príznak v adrese nesie zámer;
pred akciou sa zobrazí **náhľad** (počet, prvých ~25 názvov, „a ďalších N"),
ktorý zhmotní zoznam na serveri a pošle ho **skrytými poľami v tele POST** —
rovnako ako dnešný pás. `moveManyAction` sa nemení. Pribudnutý dokument sa
nespracuje nikdy; vypadnutý podľa rozhodnutia (otázka 2).

**C — „všetko okrem" (zoznam výnimiek).** Rieši „všetkých 148 okrem troch".
Zmysel má len spolu s A alebo B2; pridáva texty a režim riadkov. Odložiť,
kým sa neukáže potreba.

### Odporúčanie: A ako stav v adrese + B2 ako povinný krok pred akciou

Príznak nesie zámer („všetko z tohto filtra"), náhľad ho premení na zoznam,
ktorý človek videl s číslom, a akcia beží nad týmto zoznamom. Zmena medzi
zobrazením a vykonaním sa **povie nahlas** — rovnaký princíp ako dnešné
„z toho N mimo". Ručný výber `pick` so stropom zostáva pre malé výbery;
režimy sa vylučujú.

| | A | B1 | **B2** |
|---|---|---|---|
| dokument pribudol | spracuje sa ⚠️ | odmietne celú akciu | nespracuje sa, povie sa |
| dokument vypadol | nespracuje sa, ticho | odmietne celú akciu | podľa otázky 2, povie sa |
| človek videl počet | nie | áno | áno, aj názvy |
| mení `moveManyAction` | áno | áno | **nie** |
| bez JavaScriptu | áno | áno | áno |
| adresa | príznak | príznak + odtlačok | príznak |

Limit tela: serverové akcie Next majú predvolený `bodySizeLimit` 1 MB
(**neoverené pre Next 16**, `next.config.mjs` ho nenastavuje). 1 000 ID
× ~30 B ≈ 30 kB.

## 4. Postup po PR

PR 0 a 1 opravujú existujúce chyby a dajú sa zlúčiť **bez ohľadu na
rozhodnutie o variante**.

| # | PR | obsah | čo sa testuje |
|---|---|---|---|
| 0 | Jedno mapovanie filtra | `listFilterOf(filters)` používa obrazovka aj export → **opraví N2**. | test, že nesie všetky facety vrátane `ownerDepartment`; ručne CSV s filtrom oddelenia = počet na obrazovke |
| 1 | Audit presunu | `assignDocument()` zapíše audit (priečinok z → do, názov dokumentu ako kópia) → **opraví N1**, aj pre presun po jednom. | mock Monga podľa `tests/fixVersion.test.ts`: úspech zapíše audit, neexistujúci dokument nie |
| 2 | Poistná sieť | testy `moveManyAction` pri dnešnom správaní: prázdny výber, čiastočná dávka, `back` bez open redirectu. | nový vzor mockovania `libraryContext` a `next/navigation` — overiť vo `vitest.config.mts` |
| 3 | Stav v adrese | nový kľúč (otázka 1) v `ActiveFilters`, `readFilters`, `carryFields`; `pickAllMatching()`, vzájomné vylúčenie s `pick`, správanie pri zmene filtra (otázka 5). | `tests/libraryFilters.test.ts`: čítanie/zápis, prežije stránkovanie, prepnutie režimu vyprázdni `pick` |
| 4 | Vstup do režimu | „Označiť všetkých N vyhovujúcich filtru" v páse (otázka 9), sk/cs/en; popri tom **oprava N3**. | jednotkový test počtu; ručne 390 px tmavá a 1440 px svetlá, bez JS, telo bez „A server error occurred" |
| 5 | Náhľad a zmrazenie (B2) pre presun | stav `confirm=move&folderId=…` vykreslí počet, názvy a formulár so skrytými `document`; súhrnný audit s opisom filtra; hlásenie driftu (otázky 2–3); prípadný strop (otázka 8). | čistá funkcia náhľadu (orezanie, „a ďalších N"); drift s mockom; ručne presun v druhom okne medzi náhľadom a potvrdením |
| 6 | Prideľovanie v režime „filter" | podľa otázky 7. | adresa nerastie; hláška „dá sa prideliť X z Y" |
| 7 | Dokumentácia | `TODO.md` (vrátane opravy zápisu o audite), `CHANGELOG.md`, `KNIZNICA_DOKUMENTOV.md`, komentár pri `MAX_PICKED`. | celá sada: `tsc`, `eslint`, `vitest`, `build` |

## 5. Riziká

| riziko | ošetrenie |
|---|---|
| akcia zasiahne dokument, ktorý človek nevidel | B2: vykonáva sa len zmrazený zoznam z náhľadu |
| presun mení množinu filtra počas cyklu | zoznam sa zhmotní raz, v náhľade |
| hláška o čiastočnej dávke vypisuje ID do adresy | v režime „filter" počet a prvých N, zvyšok v audite |
| číslo v náhľade ≠ `facets.total` v hlavičke (dva dotazy) | v náhľade ukazovať dĺžku zhmotneného zoznamu |
| preklik na nefiltrovanej knižnici („všetko" = celá knižnica) | náhľad s číslom; prípadne strop (otázka 8) |

## 6. Otázky pre Jána

1. **Kľúč v adrese:** `select=filter`, alebo iný? Kľúč je verejná zmluva
   a nepremenúva sa. (`pick=all` by miešalo ID a príznak v jednom kľúči.)
2. **Dokument, ktorý medzi náhľadom a vykonaním z filtra vypadol:** spracovať
   (videl ho v náhľade), alebo preskočiť a vypísať?
3. **Dokument, ktorý medzitým pribudol,** sa nespracuje — hlásiť to
   („medzičasom pribudli 3, nespracované")?
4. **Náhľad povinne pri každej akcii v režime „filter",** alebo až nad jednu
   stranu (25)?
5. **Zmena filtra v režime „filter":** režim zruší (bezpečnejšie), alebo ide
   ďalej so zmeneným filtrom?
6. **Audit presunu (N1):** záznam na každý dokument, jeden súhrnný, alebo
   oboje? Odporúčam oboje v režime „filter", po jednom inak.
7. **„Vyžiadať potvrdenie" v režime „filter":** (a) `/hr/assign` si výber
   dopočíta z filtra, (b) zmrazený zoznam POST-om, (c) zatiaľ neponúkať.
   Odporúčam (c) v prvom kole a (b) potom. A má `/hr/assign` povedať
   „z 148 sa dá prideliť 131" namiesto tichého vynechania?
8. **Horný strop aj v režime „filter"** (napr. 1 000), alebo bez stropu?
9. **Vstup do režimu** ako ponuka „Označiť všetkých N", ktorá sa objaví po
   „označiť stranu", keď je strán viac (vzor Gmail) — v poriadku?
