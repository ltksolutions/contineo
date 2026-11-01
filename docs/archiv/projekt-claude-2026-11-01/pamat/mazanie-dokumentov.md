---
name: mazanie-dokumentov
description: Ako sa v Contineu mažú dokumenty (npm run docs:delete), čo skript blokuje a prečo — čítať pred akýmkoľvek mazaním knižnice
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

**`npm run docs:delete`** (`app/scripts/delete_documents.mjs`, pridané 2026-09-13)
je jediná cesta, ako mazať dokumenty. Pozor na zámenu: **`delete_test_data.mjs`
napriek názvu maže iba `evaluations`** s `reviewer: "anonym"`, dokumentov sa
nedotkne.

Why: pred nahratím ostrých znení (D74) treba zmazať skúšobný korpus, ale
potvrdenie bez dokumentu je dôkaz bez predmetu (ADR-005).

How to apply:

- predvolene beží **nasucho**, mazanie sa pýta cez `--naozaj`;
- výber je vždy menovitý — `--id`, `--tag` alebo `--grandfathered`, práve jeden.
  Režim „zmaž všetko" neexistuje a nedopĺňaj ho;
- dokument s väzbou (potvrdenie, pridelenie, krok onboardingu, kolo
  schvaľovania) hromadný výber **nikdy** nezmaže — len menovite cez `--id`
  spolu s `--aj-s-vazbami`;
- úseky sa archivujú, nemažú (D6); `--useky zmazat` je vedomá výnimka;
- po mazaní pustiť `npm run check`.

**Stav korpusu k 2026-09-13** (10 dokumentov, 1 860 úsekov, 582 aktívnych):
`sfz:test_onboarding` má 6 záznamov o potvrdení, 2 pridelenia, 1 krok trasy
a 3 kolá schvaľovania; `sfz:revizny_poriadok` má **1 pridelenie**. Ostatných
osem je bez väzieb. Všetkých 10 má `versions.publishedBefore` aj značku `test`.

**Rozhodnutia Jána (2026-09-13):** `sfz:test_onboarding` aj archivované úseky
zatiaľ **nechať**. Skript sa spustí až keď bude hotové D79 a finálne dokumenty —
nie pri zajtrajšom nahrávaní ostrých znení.

Súvisí s [[chunking-per-dokument-d79]].
