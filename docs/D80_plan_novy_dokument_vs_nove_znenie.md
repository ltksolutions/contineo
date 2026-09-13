# D80 — nový dokument vs. nové znenie (plán, na schválenie)

> **Stav:** ⬜ návrh. Nadväzuje na D6 (verzovanie), D53 (číselníky), D75
> (oficiálne znenia cez schvaľovanie), ADR-006, ADR-007.
> **Založené:** 2026-09-13 (podnet Ján).

## 1. Čo je dnes — overené v kóde

`makeDocumentId()` (`app/src/lib/libraryWrite.ts:71`) skladá identitu ako
`companyCode:sectionKey`. Z toho plynú tri veci, z ktorých ani jedna nie je
zapísaná ako rozhodnutie:

**1. Nahratie na existujúci kľúč ticho prepíše dokument.**
`uploadDocument()` robí `updateOne(..., { upsert: true })` nad
`{ documentId }` (`libraryWrite.ts:145–172`). Prepíše sa `title`, `scope`,
`accessLevel`, `language`, `category`, `tags`, `draftMarkdown`, `conversion`
**aj `originalFile`**. Publikované znenia vo `versions[]` prežijú, koncept
a pôvodný nahraný súbor nie.

**2. Rozhranie na to neupozorní.** `uploadDocument()` vracia `isNew`
(`libraryWrite.ts:188`) a **nikto ju nepoužíva** — `uploadAction`
(`app/src/app/library/actions.ts:119–130`) ju ignoruje a presmeruje vždy
rovnakou hláškou. Rozdiel sa premietne len do auditu (`nahrate-nove-znenie`
vs `zalozene`). Jediné upozornenie je statická veta v nápovede pod poľom
(`i18n.ts:3217–3220`).

**3. Cesta „nahrať nové znenie" neexistuje.** Detail dokumentu
(`app/src/app/library/[id]/page.tsx`) nemá **žiadny** vstup na súbor — má
editor textu, publikovanie z konceptu, opravu textu, opravu údajov
a preindexovanie. Nový súbor sa dá dostať dnu **jedine** opätovným
prechodom cez `/library/new` s tým istým kľúčom, teda práve tou tichou
cestou. (`DESIGN_GAP.md` to už pozná — bod „tlačidlá *Nová verzia* /
*Stiahnuť PDF* v hlavičke detailu — chýba".)

## 2. Hlbšia príčina

`sectionKey` nesie **dve rôzne veci naraz**: kam dokument patrí (zaradenie)
a ktorý dokument to je (identita).

Kým je knižnica zoznamom deviatich predpisov, je to neviditeľné — „Súťažný
poriadok" je zároveň zaradenie aj dokument. Číselník to aj ukazuje:
`sectionKey.json` má 15 položiek, z toho **6 kategórií** (`poriadky`,
`smernice`, `rozpisy_manualy`…) a **9 konkrétnych predpisov**
(`sutazny_poriadok`, `volebny_poriadok`…). Sú to dva rôzne druhy hodnôt
v jednom číselníku.

Rozpadne sa to pri prvej dávke zápisníc alebo smerníc: **dva rôzne dokumenty
s tým istým zaradením sa dnes nedajú mať.** Desať zápisníc výkonného výboru
by si vyžiadalo desať hodnôt v `sectionKey`.

Je to tá istá choroba ako pri D79 — model odvodený z homogénneho korpusu
deviatich predpisov, ktorý neprežije prvý nehomogénny prírastok.

## 3. Návrh

### 3.1 Oddeliť identitu od zaradenia

Pribudne pole **`documentKey`**. `documentId` sa skladá z neho, nie zo
`sectionKey`:

```
documentId = companyCode : documentKey      (dnes: companyCode : sectionKey)
sectionKey = už len zaradenie
```

**Migrácia je nulová.** Existujúcim dokumentom sa `documentKey` nastaví na
ich dnešný `sectionKey`, takže `documentId` sa **nezmení ani jednému** — a to
je podstatné, lebo `documentId` je cudzí kľúč v `acknowledgements`,
`document_chunks`, `assignments`, `approval_rounds`, `onboarding_tracks`
aj v auditnom zázname.

Pri zakladaní sa `documentKey` predvyplní zo `sectionKey` (správanie ako
dnes) a dá sa prepísať — `zapisnica_vv_2026_03`, `smernica_gdpr`. Platí preň
`KEY_PATTERN`.

**Číselník `sectionKey` sa tým upratuje** na 6 kategórií. Deviatim predpisom
sa `sectionKey` **nemení nasilu** — zmena zaradenia je vecné rozhodnutie
kurátora, nie vedľajší účinok migrácie.

### 3.2 Dve oddelené cesty

| | nový dokument | nové znenie |
|---|---|---|
| kde | `/library/new` | detail dokumentu, tlačidlo **Nové znenie** |
| identita | zakladá `documentId` | pracuje nad existujúcim |
| kolízia kľúča | **odmietne** a ponúkne odkaz na existujúci dokument | nenastane |
| metadáta | vypĺňa človek | **preberajú sa**, needitujú sa tu |
| pred uložením | náhľad prevedeného textu | **porovnanie s platným znením** |
| ďalej | koncept → schválenie → publikovanie → chunkovanie | to isté |

**Kolízia sa odmieta, neprepisuje.** `uploadDocument()` dostane explicitný
zámer (`mode: "new" | "version"`); pri `"new"` a existujúcom `documentId`
vyhodí `LibraryError` s odkazom na detail. Je to jediná zmena, ktorá
zabráni tichej strate konceptu a pôvodného súboru.

**Porovnanie je súčasťou nahrania nového znenia, nie ďalší krok.** Rovnaký
princíp ako pri oprave textu (ADR-007): rozdiel musí byť vidieť pred
uložením. Bez neho sa nedá odlíšiť novela od znovunahratia toho istého PDF.

### 3.3 Čo sa nemení

Schvaľovanie (ADR-006), potvrdzovanie (ADR-003), `versionId` ako identita
znenia (D76) ani chunkovanie. Nové znenie je **nová verzia existujúceho
dokumentu** a prechádza tým, čím prechádza dnes — mení sa len to, ako sa
súbor dostane dnu, a to, že sa to nedá spraviť omylom.

## 4. Kroky

| # | Krok | Výstup | Odhad |
|---|---|---|---|
| A1 | `documentKey` v type a v zápise; `makeDocumentId()` z neho | kód + testy | 0,5 d |
| A2 | Migrácia: `documentKey = sectionKey` všetkým existujúcim | skript, `documentId` sa **nemení** | 0,5 d |
| A3 | `mode: "new" \| "version"` v `uploadDocument()`, odmietnutie kolízie | kód + testy | 0,5 d |
| B1 | `/library/new`: pole `documentKey`, kontrola kolízie ešte pred nahratím | obrazovka, mobile-first | 1 d |
| B2 | Detail dokumentu: **Nové znenie** — vstup na súbor, prevod, porovnanie | obrazovka, mobile-first | 1,5 d |
| C1 | Upratanie `sectionKey.json` na kategórie + poznámka do `CISELNIKY_governance.md` | číselník | 0,5 d |
| C2 | Dokumentácia: ADR-008 alebo sekcia v `KNIZNICA_DOKUMENTOV.md`, CHANGELOG, TODO | | 0,5 d |

Kroky A sa dajú nasadiť samostatne — po nich už tichý prepis nenastane, aj
keď obrazovka na nové znenie ešte nebude.

## 5. Riziká

| # | Riziko | Ošetrenie |
|---|---|---|
| R1 | `documentId` je cudzí kľúč v šiestich kolekciách. Zmena formátu by ich rozviazala. | Migrácia `documentKey = sectionKey` **nemení ani jeden `documentId`**. Test: po migrácii sa množina `documentId` rovná množine spred nej. |
| R2 | Unikátnosť `documentId` drží dnes **len filter upsertu** — index v kóde nie je (`scripts/onboarding_init.mjs` má indexy na `documentId` len pre `acknowledgements`, `reading`, `opens`, `approvals`). Po zmene na odmietanie kolízie vznikne okno medzi kontrolou a zápisom. | Doplniť unikátny index na `documents.documentId` (zmena schémy — **vyžaduje súhlas**). |
| R3 | Odmietnutie kolízie rozbije zabehnutý postup, ak ho niekto používa ako „nahrať nové znenie". | Chybová hláška ponúka odkaz priamo na detail dokumentu a na tlačidlo Nové znenie. B2 preto nemá zaostávať za A3 o mesiac. |
| R4 | Kurátor založí druhý dokument tam, kde chcel nové znenie. | Kontrola kolízie beží **pri písaní kľúča**, nie až po nahratí súboru. |

## 6. Otvorené otázky

1. **Kedy?** Kroky A sú malé a odstraňujú tichú stratu dát — pred ostrou
   prevádzkou, alebo spolu s B po Fáze 8?
2. **Unikátny index na `documents.documentId`** — je to zmena schémy,
   potrebuje výslovný súhlas (R2).
3. **Prepísať `sectionKey` deviatim dnešným predpisom** na kategórie
   (`sutazny_poriadok` → `poriadky`), alebo ich nechať tak?
