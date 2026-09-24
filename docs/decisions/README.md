# Rozhodnutia (ADR)

Tu ležia **architektonické rozhodnutia** — čo sme rozhodli, kedy, kto a prečo.
Priečinok `docs/decisions/` je konvencia [MADR](https://adr.github.io/madr/).

Názvy súborov sú `ADR-NNN-nazov.md`. MADR odporúča štvorciferný tvar bez
prefixu (`0006-nazov.md`), my zostávame pri `ADR-006` — **to označenie je
identita rozhodnutia** a je použité v stovkách komentárov v kóde
(`// D28, viď ADR-006`). Prefix sa číta lepšie než holé číslo.

## Prijaté rozhodnutia

| # | O čom | Stav |
|---|---|---|
| [ADR-001](ADR-001-provider-adaptery.md) | Tri provider adaptéry vyberané konfiguráciou tenanta | ✅ prijaté |
| [ADR-002](ADR-002-datova-rezidencia.md) | Dátová rezidencia ako vlastnosť tenanta | ✅ prijaté |
| [ADR-003](ADR-003-onboarding-a-potvrdzovanie.md) | Onboarding a potvrdzovanie noriem | ✅ schválené |
| [ADR-004](ADR-004-termin-potvrdenia.md) | Termín potvrdenia (`due`) a pripomienky | ✅ schválené |
| [ADR-005](ADR-005-retaz-dokazov.md) | Reťaz dôkazov: od pridelenia po potvrdenie | ✅ schválené |
| [ADR-006](ADR-006-schvalovanie-znenia.md) | Schvaľovanie znenia pred zverejnením | ✅ schválené |
| [ADR-007](ADR-007-oprava-textu-znenia.md) | Oprava textu publikovaného znenia bez novej verzie | ✅ schválené |
| [ADR-008](ADR-008-zrusenie-zlatej-sady.md) | Zrušenie zlatej sady; kvalita sa meria z prevádzky | ✅ prijaté |
| [ADR-009](ADR-009-on-prem-referencna-architektura.md) | Atlas ako základ, on-prem ako referenčná architektúra | ✅ prijaté |
| [ADR-010](ADR-010-metadata-bez-rucnych-klucov.md) | Metadáta bez ručných kľúčov | ✅ prijaté |
| [ADR-011](ADR-011-pdf-ako-schvalovany-dokument.md) | Schvaľuje a potvrdzuje sa PDF; text je na vyhľadávanie | ✅ prijaté |
| [ADR-012](ADR-012-retencia-dokazov-a-dpo.md) | Retencia reťaze dôkazov, rola DPO a námietka | ✅ prijaté |
| [ADR-013](ADR-013-udaje-o-zneni.md) | Údaje o znení: autor, schválil, dátumy | ✅ prijaté |

## Čo sem nepatrí

**Otvorené rozhodnutia** sú v `docs/OPEN_DECISIONS.md` — očíslované `D1`, `D2`…
ADR vzniká až vtedy, keď je rozhodnuté. Keď ADR prekoná staršie `D`, napíše sa
to do hlavičky (viď ADR-008, ktoré prekonáva D9).

**Plány** (`docs/D79_plan_*.md`, `docs/O7_plan_*.md`) sú návrhy postupu, nie
rozhodnutia. Zostávajú v `docs/`.

## Nové ADR

Ďalšie voľné číslo je **ADR-014**. Súbor `ADR-014-kratky-nazov.md` sem, riadok
do tabuľky vyššie, a v hlavičke sa uvedie stav, dátum, kto rozhodol a na čo to
nadväzuje. Rituál **„Rozhodni"** robí presne toto.
