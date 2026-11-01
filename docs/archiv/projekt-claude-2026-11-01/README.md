# Archív projektu „Contineo" z claude.ai (stav k 2026-11-01)

Tento priečinok je **archív**, nie zdroj pravdy. Vznikol 1. 11. 2026 pred
zmazaním claude.ai projektu „Contineo" (rozhodnutie Jána Letka, varianta C:
projekt zmazať, obsah archivovať do repozitára).

**Zdroj pravdy je repozitár:** `CLAUDE.md`, `NEXT.md`, `docs/DEVLOG.md`,
`docs/TODO.md`, `docs/decisions/`. Všetko tu je datované september 2026
a od 27. 9. 2026 sa nemenilo — pri rozpore s kódom alebo `git log` platí kód.

## Čo tu je

### `pamat/` — 26 pamäťových súborov projektu

Poznatky, ktoré si Claude ukladal pri práci na Contineu v claude.ai projekte
(prečo niečo zlyhalo, ako sa čo overuje, rozhodnutia Jána s dátumom).
Súbory sú doslovné kópie vrátane YAML hlavičky; dve výnimky:

- **e-mailové adresy sú maskované** (`[e-mail maskovaný]`) — pravidlo
  repozitára, že do dokumentácie nejdú osobné údaje ani prístupové údaje;
- `people/` obsahuje dve krátke poznámky o kolegyniach (len rola v projekte).

Veľká časť týchto poznatkov už je v `CLAUDE.md` alebo `docs/`. Čo tam ešte
nie je a stojí za prenesenie, sa rieši samostatným PR, nie úpravou tohto
archívu.

### `projektove-dokumenty/` — 12 dokumentov z „Project knowledge"

Stavové snímky (`stav-2026-09-*.md`) písané na konci dňa ako odovzdanie do
ďalšej session, pracovný návrh ADR-018, plán learning modulu v2, zhrnutie
bezpečnostnej kontroly a plán ADR pre ClubUp. Všetky majú protějšok v repe
(`docs/DEVLOG.md`, `docs/decisions/ADR-018-modul-learning.md`,
`docs/LEARNING_analyza_a_plan.md`, `docs/BEZPECNOSTNA_KONTROLA_2026-09.md`),
ktorý je novší alebo rovnaký. Uložené pre úplnosť, lebo zmazanie projektu je
nevratné.

## Čo tu nie je

- História chatov projektu — tá sa s projektom stráca.
- Pamäť na úrovni účtu (`/areas/contineo.md` a pod.) — tá na projekt viazaná
  nie je a zmazaním projektu sa nemení.
