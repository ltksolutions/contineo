# D82 — čo je vo formulke, sa po prvom potvrdení zamyká

> **Stav:** ✅ rozhodnuté 2026-09-13 (Ján), realizuje sa. Ruší voľbu
> `onDateChange` z ADR-007 a **zamieta D81**.
> Nadväzuje na D28 (znenie formulky), D24 (append-only), D57/D76 (`versionId`
> je identita znenia), ADR-006 (schvaľovanie), ADR-007 (opravy).

## 1. Pravidlo

Potvrdzovacia formulka obsahuje presne tri údaje:

> „Potvrdzujem, že som sa oboznámil s dokumentom **„{názov}"**, verzia
> **{označenie}**, platná od **{dátum}**…"

**Deliaca čiara nie je „malá vs. veľká zmena", ale „je ten údaj vo vete, ktorú
človek podpísal?"**

| údaj | po prvom platnom potvrdení |
|---|---|
| text znenia | **voľne opraviteľný** (ADR-007) — vo formulke nie je |
| `label` (označenie znenia) | **zamknuté** |
| `effectiveFrom` (dátum platnosti) | **zamknuté** |
| poznámka o zmene, zdroj dátumu, zaradenie, značky | voľné |

Zamknutý údaj odomkne **jedine hromadné odvolanie potvrdení** toho znenia.
Potom sa opraví a ľudia potvrdia opravenú formulku.

**Prečo taká tvrdá cena.** Dátum platnosti nie je preklep v čiarke — je to
údaj, od ktorého sa počíta viazanosť. A hlavne: **nikdy sa nedá vedieť, že
podľa zlého dátumu nikto nekonal.** Práve preto padá D81 aj pôvodná voľba
„oprava zápisu": obe stáli na predpoklade, ktorý sa nedá overiť.

## 2. Prečo nie „nová verzia a znovu schváliť"

Pôvodná formulácia rozhodnutia znela „inak sa musí vyrobiť nová verzia
dokumentu a schvaľuje sa znovu". Cieľ je správny, cesta nie — a dôvody sú
v kóde:

**Novú verziu s tým istým textom vyrobiť nejde.** `versionId = textFingerprint(markdown)`
a `publish()` pri už existujúcom odtlačku vráti `alreadyDone` a neurobí nič.
Dve verzie s identickým textom by navyše znamenali nejednoznačnú odpoveď na
otázku „ktoré znenie platí" a zdvojené úseky vo vyhľadávaní.

**Schvaľovanie sa viaže na text, nie na dátum.** Schvaľovatelia schvaľujú
`versionId`, teda text; dátum sa zadáva až pri publikovaní a schvaľovaním
nikdy neprešiel. Znovu schvaľovať nezmenený text je obrad bez obsahu.

**Kto dátum naozaj podpísal, sú tí, čo potvrdili.** Preto sa opakuje
**potvrdenie**, nie schválenie. Nová verzia a nové schvaľovanie zostávajú tam,
kam patria — pri zmene textu.

## 3. Diera, ktorá sa pritom našla

Voľba „podstatná zmena" nastavovala `versions[].requiresReacknowledgement`
a **ten príznak nikto nečíta.** Jediný výskyt mimo zápisu je štítok v histórii
verzií; žiadna povinnosť z neho nevzniká. Povinnosť sa počíta ako *pridelenie
× platná verzia − potvrdenia*, takže kto raz potvrdil dané `versionId`, je
hotový — a nové pridelenie toho istého znenia mu novú povinnosť nevyrobí.

Dialóg pri zmene dátumu teda ponúkal dve možnosti, z ktorých **prvá vyrobila
rozpor v záznamoch a druhá nerobila nič.**

Pole sa preto **prestáva zapisovať** a v type zostáva označené ako historické —
nesú ho staré záznamy a história verzií ho vypisuje. Odstrániť ho by znamenalo
migráciu za nič.

## 4. Čo sa mení v kóde

| # | Zmena | Súbor |
|---|---|---|
| 1 | `versionFixProblem()` — pravidlo bez databázy | `src/lib/textFix.ts` |
| 2 | `fixVersion()` odmietne zmenu `label`/`effectiveFrom` pri platných potvrdeniach; parameter `onDateChange` zaniká | `src/lib/libraryWrite.ts` |
| 3 | `revokeVersion()` — hromadné odvolanie potvrdení jedného znenia, dôvod povinný | `src/lib/acknowledgements.ts` |
| 4 | Obrazovka: pri zamknutom znení sa polia neponúkajú a je vidieť prečo + cesta ďalej | `src/app/library/[id]/page.tsx` |
| 5 | `effectiveFromSource` **povinný pri publikovaní** | `src/lib/libraryWrite.ts`, obrazovka |
| 6 | `requiresReacknowledgement` sa prestane zapisovať | `src/lib/libraryWrite.ts` |

**Hromadné odvolanie robí personalista** (`isHr`), rovnako ako odvolanie
jednotlivého potvrdenia. Je to iný úkon než oprava údaja: mení **povinnosť**
ľudí, nie zápis o znení. Správca obsahu zamknutý údaj neopraví sám — obrazovka
mu povie, čo si má vypýtať. V malej organizácii býva jeden človek oboje a
kontrola prejde; pravidlo ale nestojí na tom.

## 5. Prečo `effectiveFromSource` povinne

Zamknutie posúva obranu dopredu: okno na bezbolestnú opravu je od publikovania
po prvé potvrdenie, a to býva minúty. Povinný zdroj dátumu nie je evidencia pre
evidenciu — **kto musí napísať „uznesenie VV SFZ č. … z …", ten sa doň
pozrie.** Útočí to na príčinu, nie na následok.

Existujúcich znení sa to nedotýka: povinnosť platí pri **publikovaní nového**,
nie spätne.

## 6. Riziká

| # | Riziko | Ošetrenie |
|---|---|---|
| R1 | Hromadné odvolanie je jedným kliknutím zrušená povinnosť pre desiatky ľudí. | Dôvod povinný, počet vidieť pred potvrdením, každé odvolanie je samostatný záznam s `supersedes` a `actedBy`. Robí personalista. |
| R2 | Zamknutie zablokuje aj opravu preklepu v označení („Súťažný poridok"). | Áno, a je to zámer — označenie je vo formulke. Kto to nechce riskovať, prečíta si formulku pred publikovaním; obrazovka ju ukazuje. |
| R3 | Povinný zdroj dátumu sa bude vypĺňať „ok" len aby prešiel. | Neošetruje sa strojom. Pole je v zázname a v audite; kto tam napíše „ok", podpíše sa pod to menom. |
| R4 | Po hromadnom odvolaní ožije povinnosť s **pôvodným termínom** — ak už prešiel, ľudia sú hneď po termíne. | Je to pravda, nie chyba (rovnako ako pri jednotlivom odvolaní). Obrazovka to povie dopredu. |

## 7. Čo tým padá

- **D81** (oprava záznamu o potvrdení, typ `correction`) — **zamietnuté**.
  Rozpor medzi záznamom a znením už nevznikne, takže netreba mechanizmus na
  jeho vysvetľovanie. Typ `correction` zostáva v `RecordType` nevyužitý.
- **Voľba `onDateChange: "correction" | "reacknowledge"`** z ADR-007 —
  zrušená. ADR-007 ju zaviedlo vedome; toto je zmena rozhodnutia, nie oprava
  chyby, a patrí do jeho dodatku.
