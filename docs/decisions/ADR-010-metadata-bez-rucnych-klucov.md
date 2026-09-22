# ADR-010 — Metadáta bez ručných kľúčov

> **Stav:** prijaté 2026-09-21
> **Rozhodol:** Ján Letko
> **Nadväzuje na:** D80 (`docs/D80_plan_novy_dokument_vs_nove_znenie.md`), D90
> **Súvisiace:** `docs/OPEN_DECISIONS.md`, `docs/CISELNIKY_governance.md`, TODO sekcia **O21**

---

## Kontext

Pri nahrávaní ostrého dokumentu (Pracovný poriadok SFZ, 2026-09-21) sa
ukázalo, že formulár `/library/new` pýta od človeka veci, ktoré má vedieť
systém:

1. **Kľúč dokumentu** treba vymyslieť ručne. Nápoveda síce hovorí, že
   nevyplnený sa doplní zo zaradenia — ale zaradenie je kategória
   (`poriadky` zdieľajú všetky poriadky), takže doplnenie zo zaradenia je
   pasca: prvý dokument kategórie kľúč obsadí a identita dokumentu je potom
   lož („poriadky" nie je identita Pracovného poriadku).
2. **Zaradenie (`sectionKey`) a Druh (`category`) sa prekrývajú.** Od D80 je
   zaradenie len zoskupovanie — a presne to isté robí Druh. Dve polia na
   jednu rolu znamenajú, že pri každom dokumente niekto rieši, čím sa líšia.
3. **`companyCode`** pri zakladaní tenanta vzniká čisto ručne
   (`normalizeCompanyCode()` len validuje tvar), bez návrhu a bez kontroly
   kolízie na vstupe.

Kľúč zostáva čitateľný zámerne. `documentId` (`sfz:pracovny_poriadok`) žije
roky v potvrdeniach, audite, exportoch a migračných skriptoch — náhodný hash
by porušil zásadu „o rok čitateľné, čo sa vtedy stalo". Mení sa **kto ho
píše**, nie jeho podoba.

## Rozhodnutie

### 1. Kľúč dokumentu sa generuje, formulár ukazuje náhľad

- Kľúč vzniká automaticky ako **slug z názvu dokumentu**: malé písmená bez
  diakritiky, medzery a interpunkcia na podčiarkovník („Pracovný poriadok
  SFZ" → `pracovny_poriadok_sfz`).
- Formulár pole nepýta; ukazuje **náhľad výsledného identifikátora**
  (`sfz:pracovny_poriadok_sfz`) živý podľa názvu, s možnosťou ručne prepísať
  pre prípady, keď názov nie je dobrý slug.
- Pri kolízii s obsadeným kľúčom formulár varuje **pred odoslaním** —
  serverová kontrola v `uploadDocument()` (D80/A3) zostáva poslednou bránou.
- **Kľúč vzniká raz.** Premenovanie dokumentu ho nemení — kľúč je identita,
  nie zobrazenie. To už dnes drží `saveMetadata()`, ktoré kľúč neprepisuje.
- Doplnenie kľúča zo **zaradenia sa ruší** (bod 2 ho ruší celý).

### 2. Zaradenie sa zlučuje do Druhu

- Pole **Zaradenie z formulára mizne**. Zoskupovanie a filtrovanie preberá
  **Druh** (`category`) — vlastný číselník tenanta, ktorý na to bol zavedený.
- Hodnoty zo `sectionKey.json`, ktoré v `category.json` chýbajú, sa do neho
  **prenesú migráciou** (deväť predpisov spred D80 je hodnotami existujúcich
  dokumentov — neodoberajú sa, viď O3).
- `sectionKey` **v dátach zostáva**, už len ako historická záložka identity:
  dokumentom spred D80 určuje `documentId` a `makeDocumentId()` naň padá,
  keď `documentKey` chýba. To sa nemení — zmena by zmenila identitu.
- Filter vyhľadávania a zoznamu (`mongoSearch.ts`, `libraryRead.ts`)
  prechádza zo `sectionKey` na `category`. Historické adresy s parametrom
  zaradenia sa **prekladajú** cez `lib/urlParams.ts`, nemažú (CLAUDE.md).

### 3. `companyCode` navrhuje Contineo, potvrdzuje admin

- Pri zakladaní tenanta systém **navrhne** kód: iniciály názvu bez
  diakritiky („Stredoslovenská vodárenská spoločnosť" → `SVS`), s kontrolou
  kolízie voči existujúcim tenantom a návrhom variantu pri obsadení.
- Admin návrh **vidí a môže prepísať** — organizácie svoju skratku spravidla
  už majú (`SFZ`, `StVPS`) a tá má prednosť pred strojovým odvodením.
- Po založení sa kód **nemení nikdy**: je zapečený v `documentId` každého
  dokumentu, v potvrdeniach a v audite.
- Zakladanie tenantov je zriedkavé a robí ho admin — preto návrh + potvrdenie,
  nie tichá automatika ako pri kľúči dokumentu.

## Čo tým padá — a hovoríme to nahlas

- **Ručné vymýšľanie kľúčov** bežným používateľom. Kto kľúč naozaj chce
  ovplyvniť, stále môže — prepíše náhľad.
- **`sectionKey` ako povinný číselník** (`REQUIRED_CODELISTS`). Zostáva len
  ako dátové pole starých dokumentov.
- **Otvorené body O3** o skrývaní deviatich predpisov v ponuke zaradenia a
  o zmene zaradenia cez `saveMetadata()` — obe otázky miznú s poľom samotným.

## Kroky, dotknuté súbory, riziká → TODO sekcia **O21**

Poradie: (1) náhľad kľúča, (3) návrh `companyCode` — malé, samostatné;
(2) zlúčenie zaradenia je migrácia na ostrých dátach a ide až po Fáze 8.

## Poznámka na okraj

Tenant ukladá kód veľkými písmenami (`SFZ`, `CODE_PATTERN` v
`tenantAdmin.ts`), ale `makeDocumentId()` celý identifikátor znižuje na malé
(`sfz:kluc`). Funguje to, lebo dotazy na dokumenty idú cez `documentId` — ale
pri každom novom dotaze, ktorý by porovnával `companyCode` z tenanta
s prefixom `documentId`, na to treba myslieť.
