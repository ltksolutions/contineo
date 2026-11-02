<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-043 — Kľúč nového dokumentu je UUID, nie slug z názvu

> **Stav:** prijaté · **Dátum:** 2026-11-02
> **Rozhodol:** Ján Letko (2026-11-02) — „identifikátor navrhujem všade
> zmeniť na generický jedinečný UUID reťazec, nie je dôležité, aby bol
> čitateľný človekom"; „mením rozhodnutie ADR-010, nemusia byť čitateľné"
> **Prekonáva:** ADR-010 bod 1 (kľúč dokumentu ako slug z názvu, náhľad
> a ručný kľúč vo formulári). Body 2 a 3 ADR-010 platia ďalej.
> **Rozhodnutie:** D294
> **Čiastočne prekonané:** [ADR-044](ADR-044-migracia-klucov-na-uuid.md) (2026-11-02) — aj existujúce dokumenty dostanú UUID, identifikátor sa prepíše všade.

---

## Kontext

ADR-010 nechal kľúč dokumentu čitateľný — slug z názvu
(`sfz:pracovny_poriadok_sfz`) — s odôvodnením, že `documentId` žije roky
v potvrdeniach, audite a exportoch a má byť „o rok čitateľné, čo sa vtedy
stalo".

Pri nahrávaní dokumentu 2. 11. 2026 („Rozpis republikových súťaží riadených
SFZ (Slovenský futbalový zväz) pre súťažný ročník 2026/2027.") vznikol kľúč
`sfz:rozpis_republikovych_sutazi_riadenych_sfz_slovensky_futbalov` — useknutý
na 60 znakoch uprostred slova. Ukázalo sa:

1. **Čitateľnosť v kľúči nič nedokazuje.** Kópiu názvu v čase udalosti nesú
   záznamy samy (zásada „kópia, nie odkaz" — názov dokumentu v potvrdení,
   v audite). Kľúč na to netreba.
2. **Slug po čase klame.** Kľúč sa pri premenovaní nemení (ADR-010), takže
   po prvom premenovaní hovorí niečo iné než názov. Pri ročníkových
   dokumentoch (`…2026/2027`) je to istota.
3. **Formulár ukazuje vec, ktorú človek nepotrebuje** — náhľad
   identifikátora a „Zadať kľúč ručne" sú dva riadky navyše v kroku, ktorý
   má byť len o súbore a o názve.

## Rozhodnutie

- Kľúč **nového** dokumentu je **náhodné UUID bez pomlčiek** (32 hexa
  znakov): `sfz:3f2a9c…`. Vzniká na serveri v `checkMetadata()`
  (`newDocumentKey()` v `lib/libraryWrite.ts`), keď kľúč nepríde.
- Bez pomlčiek zámerne: tvar sedí so spoločným `KEY_PATTERN` a identifikátor
  v adrese (`/library/sfz:…`) netreba kódovať.
- Prefix organizácie (`sfz:`) ostáva — `makeDocumentId()` sa nemení
  a `companyCode` patrí do podmienky dotazu ako doteraz (D32).
- **Formulár identifikátor neukazuje ani nepýta.** `KeyPreview` zaniká,
  na jeho mieste je obyčajné pole názvu.
- Platí pre všetky cesty, ktorými nový dokument vzniká: formulár, import
  zo Slov-Lexu (`webImport.ts`) aj MCP konektor (`connectorImport.ts`).
  Oba importy párujú dokument podľa zdroja (`existingByAct`, `externalId`),
  nie podľa kľúča — náhodný kľúč im duplicitu nespôsobí.

## Čo sa nemení — a prečo

- **Existujúce dokumenty si kľúč nechávajú.** `documentId` je zapečený
  v potvrdeniach, priradeniach a audite, ktoré sa nemenia (D24), a je to
  adresa dokumentu (`/library/<documentId>`) — verejná cesta je zmluva.
  Migrácia by znamenala prepísať dôkazné záznamy; to nerobíme.
- Kľúče položiek číselníka, kurzov, testov a trás (`slugifyKey`,
  `KeyFromLabel`) ostávajú zo slugu. Sú to kľúče, ktoré si admin volí
  vedome a vidí ich; rozhodnutie sa týka identity dokumentu.

## Dôsledky

- V knižnici budú popri sebe staré čitateľné a nové náhodné identifikátory.
  Človek ich nevidí — zoznamy a detail ukazujú názov.
- Kto potrebuje dokument nájsť v databáze alebo v skripte, hľadá podľa
  `title`, nie podľa `documentId`.
