# D79 — členenie per dokument (plán realizácie)

> **Stav:** 🔄 Etapa 1 (A, B) hotová; z Etapy 2 hotové C1 (`lib/chunkingAnalysis.ts`)
> a C3 (`npm run chunking:analyze`), migrácia `npm run migrate:profiles`. Otvorené
> zostávajú C2, D1 (`chunkerPlain.mjs` neexistuje), E1, E2 a F1.
> Nadväzuje na **D58** (profil členenia
> per organizácia), **D57** (oddelenie `versionId` od `chunkingId`), **D1**
> (štruktúrne chunkovanie).
> **Založené:** 2026-09-13. **Rozhodnuté:** 2026-09-13 (Ján).

## 0. Rozhodnutia

1. **Termín:** kroky **A + B ešte pred ostrou prevádzkou** (Fáza 8), kroky
   **C + D + E až po nej**. Odôvodnenie v §4.
2. **Dávková analýza áno** — aj nad existujúcou knižnicou, nielen pri nahratí.
   Navrhuje, nemení (§3.3).
3. **Len pomenované profily.** Žiadne výnimky na úrovni dokumentu (§3.1).

## 1. Čo je dnes

Profil členenia je **jeden na organizáciu** (`tenants.chunking`, záložka
`/organisation?tab=chunking`). Pri každom zápise do knižnice sa berie ten istý
profil — `actor()` v `src/app/library/actions.ts` ho podá z `ctx.tenant.chunking`
do `uploadDocument()`, `publish()`, `reindex()`, `reindexAll()`.

Profil má päť parametrov: slovo článku, slovo prílohy, prah hlavičiek, cieľová
veľkosť úseku od–do. Všetko sú to **parametre jedného algoritmu** — štruktúrneho
chunkera odladeného na predpisoch SFZ.

## 2. Prečo to nestačí

Korpus, ktorý má do knižnice prísť, nie je homogénny:

| Typ obsahu | Členenie | Súčasný profil |
|---|---|---|
| Predpisy SFZ | `Článok N` | ✅ sadne |
| Zákony a vyhlášky | `§ N` | ❌ iné slovo |
| Manuály, zápisnice | žiadne formálne | ❌ **žiadny profil nepomôže** |
| Zmluvy a smernice iných tenantov | vlastné konvencie | ❌ iné slovo |

Prvé tri riadky sa v jednej organizácii stretnú **naraz**. Jeden profil na
tenanta znamená, že nastavením `§` sa rozbijú predpisy SFZ a naopak.

**Kľúčové rozlíšenie, ktoré dnes v modeli chýba:**

- **profil** = parametre *v rámci* jedného algoritmu (slovo, prahy, veľkosti);
- **stratégia** = *ktorý* algoritmus sa použije.

Manuál bez článkov nepotrebuje iný profil, potrebuje **iný algoritmus**. Žiadne
nastavenie slova mu nepomôže — `audit_chunks.mjs` taký dokument dnes ukáže ako
„1 nadpis, 0 % článkov", teda celý spadol do jedného bloku.

## 3. Návrh

### 3.1 Tri úrovne, nie dve

```
predvolený profil (kód)
  └── pomenované profily tenanta        napr. „Predpis SFZ", „Zákon (§)", „Voľný text"
        └── priradenie k dokumentu      len kľúč profilu, nič viac
```

**Žiadne výnimky na dokumente (rozhodnuté).** Dokument nesie **iba kľúč
pomenovaného profilu** — žiadne vlastné hodnoty. Ad-hoc nastavenie na dokumente
je opačný extrém: o pol roka nikto nevie povedať, prečo sú dva podobné predpisy
narezané inak, a oprava chunkera sa musí premietnuť do N kópií — presne to, čomu
sa D58 vyhýbalo pri kóde.

Dôsledok, ktorý je vlastnosťou a nie obmedzením: **keď dokument nesadne ani
jednému profilu, vzniká nový pomenovaný profil.** Odchýlka sa tým zapíše raz,
s menom a viditeľne — namiesto aby sa skryla do jedného záznamu, ktorý nikto
nenájde. Profil je opraviteľný na jednom mieste a je vidieť, koľko dokumentov
ho používa.

### 3.2 Analýza navrhuje, človek potvrdzuje

Automatika, ktorá si profil zvolí sama a ticho, je v rozpore s tým, ako je
Contineo postavené (D58: uloženie profilu nepreindexuje nič samo; D59: kontrola
nič neopravuje, oprava je vždy rozhodnutie).

Analyzátor preto **skóruje a navrhne**, obrazovka ukáže ukážku rezu a človek
potvrdí. Signály sú už zmerateľné tým, čo existuje:

- podiel riadkov zodpovedajúcich `Článok N` / `§ N` / `Bod N`;
- počet rozpoznaných nadpisov a častí;
- podiel chunkov s rozpoznaným `articleRef` (to meria `scripts/audit_chunks.mjs`);
- počet opakovaných riadkov (hlavičky/päty);
- rozptyl veľkosti chunkov.

Ak žiadny štruktúrny vzor neprekročí prah → návrh je stratégia „voľný text".

**Beží v dvoch režimoch (rozhodnuté):**

- **pri nahratí** — návrh profilu hneď v obrazovke nahrávania;
- **dávkovo nad existujúcou knižnicou** — prejde všetky dokumenty tenanta
  a vyrobí zoznam „dokument → navrhovaný profil → istota → prečo".

Dávka **nič nemení**. Je to čítanie, ktorého výstupom je tabuľka na potvrdenie —
buď po jednom, alebo hromadne za celý navrhovaný profil. Preindexovanie je až
samostatný, vedomý krok. Ten istý princíp ako `npm run check` (D59): meria
a pomenuje, opravu spraví človek.

### 3.3 Druhý algoritmus pre neštruktúrovaný obsah

Nový súbor, **`chunker.mjs` sa nedotýka** (jeho hlavička na to výslovne
upozorňuje a je odladený na deviatich skutočných predpisoch). Nová stratégia:
delenie po nadpisoch Markdownu, inak rekurzívne po odsekoch do cieľovej
veľkosti, s prekryvom — a s rovnakým breadcrumbom, aby citácia neklamala.

## 4. Kroky

### Etapa 1 — teraz, pred ostrou prevádzkou (~1,5 d)

| # | Krok | Výstup | Odhad |
|---|---|---|---|
| A1 | ~~Diagnostika: `audit_chunks.mjs` nad knižnicou~~ | ✅ **hotové 2026-09-13**, viď nižšie | — |
| A2 | Prah pre „nerozpoznaný" (napr. < 20 % chunkov s `articleRef`) | číslo v kóde + test | 1 h |
| B1 | Dátový model: pomenované profily v `tenants`, kľúč profilu na dokumente | typy + migračný skript | 0,5 d |
| B2 | Rozlíšenie profilu pri zápise — všetkých 7 vstupov v `libraryWrite.ts` | kód + testy | 1 d |
| B3 | Migrácia existujúcich dokumentov na profil „Predpis SFZ" | skript, `chunkingId` sa **nemení** | 0,5 d |

### Etapa 2 — po Fáze 8 (~6 d)

| # | Krok | Výstup | Odhad |
|---|---|---|---|
| C1 | Analyzátor (čistá funkcia nad textom, bez DB) | `src/lib/chunkingAnalysis.ts` + testy | 1 d |
| C2 | Ukážka rezu v detaile dokumentu (to, čo dnes vie `chunk_preview.mjs`) | obrazovka | 1 d |
| C3 | **Dávková analýza** nad celou knižnicou + hromadné potvrdenie | skript + obrazovka | 1 d |
| D1 | Stratégia „voľný text" | `src/lib/chunkerPlain.mjs` + testy | 1,5 d |
| E1 | UI: záložka Členenie → zoznam profilov; výber profilu na dokumente | mobile-first | 1,5 d |
| E2 | Preindexovanie po profiloch, nie naraz | úprava `reindexAll` | 0,5 d |
| F1 | Dokumentácia: ADR-008, `KNIZNICA_DOKUMENTOV.md`, `OPEN_DECISIONS.md`, devlog | | 0,5 d |

### A1 — výsledok diagnostiky (2026-09-13)

`audit_chunks.mjs` nad dnešnou knižnicou (10 dokumentov, 1 860 úsekov, z toho
582 aktívnych):

| dokument | chunkov | s článkom | stav |
|---|---|---|---|
| `disciplinarny_poriadok` | 114 | 99 % | ✔ |
| `registracny_prestupovy_poriadok` | 125 | 99 % | ✔ |
| `sutazny_poriadok` | 108 | 99 % | ✔ |
| `poriadok_komory_sporov` | 48 | 98 % | ✔ |
| `stanovy` | 104 | 98 % | ✔ |
| `rokovaci_poriadok_konferencie` | 32 | 97 % | ✔ |
| `organizacny_navstevny_poriadok` | 23 | 96 % | ✔ |
| `revizny_poriadok` | 14 | 93 % | ✔ |
| `volebny_poriadok` | 13 | 92 % | ✔ |
| `test_onboarding` | 1 | 0 % | ✘ nerozobraný (skúšobný záznam, nie norma) |

**Záver:** dnešný korpus problém s členením **nemá** — deväť z desiatich
dokumentov je rozpoznaných na 92–99 %, jediný nerozobraný je skúšobný záznam
s jedným odsekom. `npm run check` hlási 0 rozporov.

Z toho plynie dvojité potvrdenie plánu: (a) D79 nerieši dnešnú chybu, ale
**pripravuje sa na prichádzajúci korpus** (zákony `§`, manuály), takže odklad
C/D/E za Fázu 8 je správny; (b) ostré znenia predpisov SFZ sa zajtra narežú
predvoleným profilom správne a **netreba nič stíhať pred ich nahratím**.

### Prečo takto rozdelené

**A + B teraz.** A1 je čítanie bez rizika a bez neho sa ďalej rozhoduje od stola.
B je **zmena dátového modelu a migrácia** — tá je lacná pri dnešnej, stále
testovacej knižnici a drahá pri stovkách dokumentov v ostrej prevádzke, kde
každá migrácia ide cez rozvahu „čo ak to spadne v polovici". Po B je systém plne
funkčný aj bez C, D, E: má jeden pomenovaný profil, správa sa presne ako dnes
a nič sa nepreindexuje.

**C + D + E až po Fáze 8.** Sú to nové obrazovky a nový algoritmus — nová
funkcia, nie príprava modelu. Fáza 8 je brána pred ostrou prevádzkou a druhá
stratégia chunkovania je presne ten druh práce, ktorou sa dá minúť mesiac.

## 5. Dotknuté súbory

**Model a logika**

- `app/src/lib/chunkingProfile.ts` — identita profilu, register pomenovaných profilov
- `app/src/lib/chunkIdentity.ts` — **pozor, viď riziká** (fingerprint)
- `app/src/lib/tenants.ts`, `app/src/lib/tenantAdmin.ts` — zoznam profilov tenanta
- `app/src/lib/documents.ts` — `DocumentRecord.chunkingProfile` (**iba kľúč profilu**)
- `app/src/lib/libraryWrite.ts` — `uploadDocument`, `publish`, `reindex`, `fixVersion`, `fixText`, `reindexState`, `reindexAll`
- `app/src/lib/chunkingAnalysis.ts` — **nový** (analyzátor, čistá funkcia)
- `app/src/lib/chunkerPlain.mjs` — **nový** (krok D1)
- `app/src/lib/chunker.mjs` — **nemeniť**

**Rozhranie**

- `app/src/app/organisation/page.tsx`, `app/src/app/organisation/actions.ts`
- `app/src/app/library/actions.ts` — `actor()` už nepodá profil tenanta paušálne
- detail dokumentu v knižnici — výber profilu, návrh analýzy, ukážka rezu
- `app/src/lib/i18n.ts` — texty SK/CS/EN (D35)

**Skripty a testy**

- `app/scripts/migrate_chunking_profile.mjs` — rozšíriť, alebo nový migračný skript
- `app/scripts/audit_chunks.mjs`, `app/scripts/chunk_preview.mjs` — zdroj signálov
- `app/scripts/analyze_library.mjs` — **nový**, dávková analýza (krok C3), len číta
- `app/tests/chunking.test.ts`, `app/tests/chunker.test.mjs` + nové testy

## 6. Riziká

| # | Riziko | Ako ho ošetriť |
|---|---|---|
| R1 | **Odtlačok.** `chunkingFingerprint()` hashuje profil tak, ako ho dostane. Keby doň pribudol názov profilu alebo názov stratégie, zmenil by sa `chunkingId` **každého** dokumentu a celá knižnica by naraz vyzerala ako nepreindexovaná. | Hashuje sa **výhradne** to, čo vráti `toChunkerProfile()`. Názov profilu je metadát, nie parameter rezu. Test: existujúci dokument musí po migrácii dať rovnaký `chunkingId`. |
| R2 | Potvrdenia. | Nehrozí — D57 oddelilo `versionId` (len text) od `chunkingId`. Preindexovanie sa `versions[]` nedotkne. Test to musí strážiť. |
| R3 | `reindexAll` beží s profilom tenanta. Po zmene by paušálne prerezal aj dokumenty s vlastným profilom. | Preindexovanie rozlišuje profil dokumentu; dávkovanie po profiloch. |
| R4 | Miešané profily v jednom tenante → citácie majú rôzny tvar („Článok 5" vs „§ 12" vs „Kapitola 3"). | Skontrolovať vykresľovanie citácie a odpovedaciu politiku (D3) skôr než pribudne druhá stratégia. |
| R5 | Analyzátor navrhne zle a človek to odklikne. | Návrh sa **nedá potvrdiť bez zobrazenej ukážky rezu**; pri istote pod prahom sa návrh nezobrazí vôbec. |
| R6 | Rozsah. Krok D je samostatný algoritmus, nie parameter — dá sa ním minúť celá Fáza 8. | B a D sú oddelené; D sa nasadzuje až po Fáze 8, ak sa tak rozhodneme. |
| R7 | `CHUNKER_VERSION` sa zvyšuje ručne. Pri novej stratégii sa naň zabudne. | Test, ktorý porovná výstup referenčných dokumentov proti uloženému odtlačku. |
| R8 | **Hromadné potvrdenie dávky.** „Potvrď všetkých 40 návrhov" je jeden klik, ktorý prerazí knižnicu. | Hromadné potvrdenie mení **len priradenie profilu**, nepreindexuje. Preindexovanie je druhý, samostatný krok a beží po dávkach (R3). |
| R9 | Bez výnimiek na dokumente môže počet profilov narásť („profil pre jeden dokument"). | Zoznam profilov ukazuje počet dokumentov; profil s jedným dokumentom je viditeľný a dá sa zlúčiť. Je to lepší stav než neviditeľná výnimka. |

## 7. Definition of Done

- `npm test` a lint prejdú; test na nezmenený `chunkingId` po migrácii je zelený
- obrazovky overené mobile-first
- `docs/OPEN_DECISIONS.md` (D79), `KNIZNICA_DOKUMENTOV.md`, `TODO.md`, devlog aktualizované
- commit podľa konvencie

## 8. Jazyk kľúčov (rozhodnuté 2026-09-13)

Profily sú **per tenant** — žijú v `tenants`, rovnako ako vlastné položky
číselníkov (D55). To ale nie je to, čo určuje jazyk kľúča. Deliaca čiara
v Contineu vedie inde: **kľúč, na ktorom vetví kód, je anglicky; kľúč, ktorý je
len menovka obsahu, je slovensky.**

| | príklad z dnešného kódu | jazyk |
|---|---|---|
| strojový kľúč, kód sa podľa neho rozhoduje | `scope`: `global`, `company`, `region`; `sourceType`: `pdf`, `md`, `web`; návratové hodnoty `"no-effective-version"` | anglicky |
| menovka obsahu, kód ju len prenáša | `sectionKey`: `stanovy`, `sutazny_poriadok`; `category`: `norma`, `smernica`, `metodicky_pokyn` | slovensky |

Preto sa **rozdeľujú na dve veci:**

1. **`strategy`** — `"structured"` \| `"plain"` — **anglicky, uzavretý enum v kóde**,
   nie údaj tenanta. Kód sa podľa neho rozhoduje, ktorý algoritmus zavolá.
   Patrí k `scope` a `sourceType`.
2. **kľúč profilu** — **slovensky**: `sfz_predpis` („Predpis SFZ"), `zakon`
   („Zákon (§)"), `volny_text` („Voľný text", až s krokom D1). Je to menovka,
   kód sa podľa nej nevetví. Patrí k `sectionKey` a `category`.

Pravidlá pre kľúč profilu: `KEY_PATTERN` z `codelists.ts` — malé písmená,
číslice, podčiarkovník, **bez diakritiky** (`sutazny_poriadok`, nie
`súťažný_poriadok`). Kľúč sa objaví v adresách, logoch a exportoch.

**Na jazyku kľúča `chunkingId` nezávisí** — do hashovaného objektu profilu
nevstupuje ani kľúč, ani názov, ani `strategy` (viď R1). Premenovanie profilu
teda nikdy nespôsobí preindexovanie.
