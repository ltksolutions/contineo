---
name: zamknutie-udajov-znenia-d82
description: Označenie a dátum platnosti sa po prvom potvrdení zamykajú (D82) — pravidlo, prečo a ako sa odomyká; čítať pred zásahom do fixVersion alebo potvrdení
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:36:09Z
---

**Hotové 2026-09-13 (commit `d6fc37c`).**

**Pravidlo:** deliaca čiara nie je „malá vs. veľká zmena", ale **je ten údaj vo
vete, ktorú človek podpísal?** Formulka (D28) obsahuje názov, označenie znenia
a dátum platnosti.

- text znenia → vo formulke nie je → opravuje sa voľne (ADR-007, `fixText`);
- `label` a `effectiveFrom` → vo formulke sú → **po prvom platnom potvrdení
  zamknuté**;
- poznámka o zmene, zdroj dátumu, zaradenie, značky → voľné.

Odomyká **jedine `revokeVersion()`** — hromadné odvolanie potvrdení znenia,
dôvod povinný, robí **personalista** (`isHr`). Potom sa údaj opraví a ľudia
potvrdia opravenú formulku. Zamknuté polia sa v obrazovke **neponúkajú**.

`effectiveFromSource` je **povinný pri publikovaní**: okno na bezbolestnú
opravu je odteraz od publikovania po prvé potvrdenie, teda minúty.

**Čo padlo:**

- voľba `onDateChange: "correction" | "reacknowledge"` z ADR-007 — zrušená.
  Prvá vyrábala rozpor, druhá nastavovala `requiresReacknowledgement`, ktorý
  **nikto nečíta**, takže nerobila nič. Pole sa prestalo zapisovať, v type
  zostáva kvôli starým záznamom;
- **D81** (oprava záznamu o potvrdení, typ `correction`) — zamietnuté. Stálo na
  predpoklade, že sa dá rozlíšiť preklep, podľa ktorého nikto nekonal — a ten sa
  nedá overiť.

**Prečo nie „nová verzia a znovu schváliť":** `versionId = textFingerprint(markdown)`
a `publish()` pri rovnakom texte vráti `alreadyDone` — novú verziu s nezmeneným
textom vyrobiť nejde. Schvaľovanie sa viaže na text, nie na dátum; dátum sa
zadáva až pri publikovaní. Kto dátum podpísal, sú tí, čo potvrdili — preto sa
opakuje **potvrdenie**, nie schválenie.

Otvorené: dodatok do ADR-007 o zrušení `onDateChange` (`TODO.md`, O4).
