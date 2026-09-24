# KNIZNICA — úprava dokumentu (`/library/[id]?edit=document`)

Referencia: `KNIZNICA-uprava-dokumentu.html`. Základ: `ZAKLAD.md`, `KNIZNICA-postup-znenia.md`, `NAHRAVANIE-pdf-a-udaje-o-zneni.md`.
Zdroj: `app/src/app/library/[id]/page.tsx` (blok `#document-data`, ~r. 1076–1170; `assignToFolderAction` ~r. 1210), `saveDocumentMetadataAction`, i18n `library.detail`, `library.fields`.

## Dnes

„Upraviť dokument" (hlavička aj bočný panel) vedie na `?edit=document#document-data` — otvorí „Správa" a v nej `<details>` „Údaje o dokumente": Názov, Rozsah, Prístup, Jazyk, Druh, Oddelenie, Interné číslo, Značky, poznámka o kľúči, Uložiť. Priečinok je samostatný formulár nižšie v Správe.

## Čo sa nemení

Polia, ich hodnoty, nápovedy a `saveDocumentMetadataAction`. Úprava dokumentu nemení znenie ani schválenie. Bez JavaScriptu (adresa `?edit=document`).

## Čo sa mení (podoba)

1. **Samostatný pohľad** — pri `?edit=document` sa hlavný stĺpec detailu nahradí formulárom (karta „Nové znenie", „Platné znenie" a Správa sa nekreslia). Nadpis „Upraviť dokument" s názvom dokumentu nad ním, „← Späť na dokument".
2. **Úseky ako pri nahratí** (`.upload-section`, `.upload-step`): **1 Základné údaje** — Názov (cez celú šírku), Druh, Prístup, Jazyk dokumentu. **2 Zaradenie** (nepovinné) — Priečinok, Oddelenie, Interné číslo, Rozsah, Značky.
3. **Identifikátor** — riadok len na čítanie (`keyNoteBefore` + `documentId` + `keyNoteAfter`).
4. **Uložiť / Zrušiť** v sticky lište + veta „Mení údaje o dokumente, nie znenie. Schválenie ani potvrdenia sa tým nerušia." (nová; overiť, že to platí aj pre Názov — viď otázky).
5. **„Upravuje sa inde"** — bočná karta (na telefóne pod formulárom) s odkazmi: Nové znenie · Údaje o znení · Zodpovedná osoba a právny základ · Text na vyhľadávanie. Nové texty.

## Rozhodnutia Jána 24. 9. 2026

- **Q1 ✅** Poradie polí ako pri nahratí: Názov, Druh, Prístup, Jazyk | Priečinok, Oddelenie, Interné číslo, Rozsah, Značky.
- **Q2 ✅** Priečinok sa presúva do tohto formulára. **Zápis presunu do auditu zostáva** — `saveDocumentMetadataAction` pri zmene `folderId` zapíše ten istý auditný záznam ako `assignToFolderAction` (kto, kedy, odkiaľ kam, názvami priečinkov). Samostatný formulár priečinka v Správe odpadá; hromadný presun v knižnici ostáva.
- **Q3 ✅** Názov sa **mení len novým znením.** Keď má dokument platné (zverejnené) znenie, pole Názov je len na čítanie (🔒, odkaz „novým znením") a server zmenu názvu odmietne. Bez platného znenia (len koncept) sa názov upraviť dá. Nové znenie má v príprave pole Názov predvyplnené z dokumentu; zverejnením nového znenia sa zmení názov dokumentu. ⚠️ To je zmena správania — nové pole názvu v kroku 1 karty „Nové znenie" (`KNIZNICA-postup-znenia`) a názov vstupuje do identity konceptu (D96), aby ho schvaľovatelia schválili.

## Pôvodné otázky

- **Q1 — Poradie polí ako pri nahratí** (Názov, Druh, Prístup, Jazyk | Oddelenie, Interné číslo, Rozsah, Značky). Dnes je Rozsah druhý a Druh piaty. Súhlas?
- **Q2 — Priečinok do tohto formulára.** Dnes samostatná akcia `assignToFolderAction` (so zápisom do auditu). Zlúčenie = `saveDocumentMetadataAction` by musela zapísať aj presun do auditu rovnako. Alebo nechať Priečinok v Správe?
- **Q3 — Zmena názvu.** Názov je doslova vo formulke (`titleNote`). Potvrdenia si nesú kópiu, takže staré doklady sa nezmenia — ale nové potvrdenia platného znenia by mali iný názov než schválené PDF. Upozorniť pri zmene názvu („Nové potvrdenia budú mať nový názov")? Alebo názov pri platnom znení zamknúť a meniť len novým znením?

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | formulár + rozcestník vpravo |
| **834** | formulár |
| **390** | formulár, rozcestník pod ním, tlačidlá 44 px |

🔴 Zmena schémy: **žiadna.**
