<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-044 — Aj existujúce dokumenty dostanú kľúč UUID; identifikátor sa prepíše všade

> **Stav:** prijaté · **Dátum:** 2026-11-02
> **Rozhodol:** Ján Letko (2026-11-02) — „vymeňme za UUID kľúče aj existujúce
> dokumenty aj s migráciou"; z dvoch možností (A: alias, dôkazy bez zmeny ·
> B: prepísať všetko) zvolil **„B — prepísať všetko"**, hoci odporúčanie bolo A.
> **Prekonáva:** ADR-043, časť „Čo sa nemení" (existujúce dokumenty si kľúč
> nechávajú). Zvyšok ADR-043 platí.
> **Výnimka z:** D24 (dôkazné záznamy sa nemenia) — jednorazovo, len pre
> pole s identifikátorom dokumentu.
> **Rozhodnutie:** D295

---

## Kontext

ADR-043 dalo kľúč UUID len novým dokumentom. Staré mali ostať, lebo
`documentId` je v potvrdeniach, prideleniach a audite (D24) a je to adresa
dokumentu. Ján chce jednotný tvar pre všetky dokumenty.

Súpis pred rozhodnutím (2. 11. 2026, ostrá databáza, nasucho):
24 dokumentov, **4 609 záznamov v 17 kolekciách** — potvrdenia (219),
kolá schvaľovania, pridelenia, audit (615), úseky textu (2 804), posudky,
kontroly súladu, notifikácie, trasy, otvorenia a čas čítania, tickety.

`documentId` **nie je v žiadnom odtlačku ani podpise**: `versionId` sa
skladá z textu, PDF a metadát, `statementHash` z vety formulky (názov
a dátum, nie identifikátor), `pdfSha256` zo súboru. Prepis teda nerozbije
žiadny dôkaz o obsahu — mení len to, ako sú záznamy navzájom spojené.

## Rozhodnutie

- Každý dokument, ktorého identifikátor nie je v tvare `sfz:<32 hexa>`,
  dostane nový kľúč (UUID bez pomlčiek, ako ADR-043).
- Skript `app/scripts/migrate_document_uuid.mjs` prejde **každú kolekciu
  a každú hodnotu** a starý identifikátor prepíše: presnú zhodu v poli,
  v kľúči objektu aj v `_id`; uprostred textu len ako celé slovo
  (`sfz:stanovy` v `sfz:stanovy_2` nie). Skenujú sa dáta, nie zoznam polí
  z kódu — zoznam by raz zaostal.
- **Výnimka z D24:** v dôkazných záznamoch (`acknowledgements`,
  `assignments`, `approval_rounds`, `audit`, `document_opens`) sa prepíše
  **len identifikátor dokumentu**. Čo človek videl a potvrdil (formulka,
  názov, dátum, verzia, odtlačky), ostáva bez zmeny. Precedens je
  `migrate_versionid.mjs`.
- Dvojica starý → nový sa zapíše do kolekcie **`document_id_aliases`**
  (s dátumom a tým, kto migráciu spustil) a **nemaže sa**. Je to záznam
  o tom, že a kedy sa identifikátor zmenil, a podľa nej sa prekladajú
  odkazy mimo databázy:
  - `proxy.ts` presmeruje `/library/<starý>/…`, `/documents/<starý>`
    a `/api/documents/<starý>/pdf` na nový (307),
  - `loadDocumentFor()` nájde dokument aj podľa starého identifikátora
    (klient MCP si ho mohol zapamätať).
- Zápis spúšťa Ján, keď nikto nepracuje (`--zapis`); predvolene skript
  beží nasucho. Opakovaný beh po prerušení dorobí zvyšok s tými istými
  novými identifikátormi.

## Čo tým padá — a hovoríme to nahlas

- **Čitateľnosť identifikátora v dátach.** Kto hľadá dokument v databáze
  alebo v exporte, hľadá podľa názvu; `document_id_aliases` povie, aký
  identifikátor mal predtým.
- **Nemennosť dôkazných záznamov bez výnimky.** D24 má odteraz jednu
  zapísanú výnimku. Audit si ju pamätá cez `document_id_aliases`, nie cez
  nový auditný záznam pri každom prepísanom potvrdení.

## Riziká

- Záznam zapísaný **počas** behu môže ostať so starým identifikátorom —
  preto beh pri pokoji a druhý beh nasucho („Nie je čo migrovať").
- Cache (Next, vyhľadávanie) môže krátko vracať starý identifikátor;
  odkaz naň presmeruje `proxy.ts`.
