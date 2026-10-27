# KANAL-widget-riadok-otazky — návrh

- **Zdroj:** artefakt *Design* https://claude.ai/artifact/TRb1BuTwYqCRpGDwk7BJwD
  (s design systémom „Contineo — design system"), 27. 10. 2026.
- **Zadanie a otázky:** `KANAL-widget-riadok-otazky-zadanie.md`.
- **Hlavná plocha:** `KANAL-widget-riadok-otazky.html` (1440, hrateľná: riadok
  hore v strede, rozbalenie na 80 %, odpoveď, správa helpdesku). Ďalšie plochy
  v artefakte: 834 s odpoveďou, 390 zatvorený a rozbalený s históriou
  a vzormi, formulár správy helpdesku.

## Rozhodnuté (Ján, 27. 10. 2026)

R1 A s predvolenou polohou hore v strede, R2 A, R3 A, R4 B (história aj vzory),
R5 A; návrh schválený ako finálny; doplnený výber jazyka. Zapísané ako
ADR-042, Dodatok 2 (D286–D290).

## Odchýlky implementácie od návrhu

- **Výber jazyka** (`select.xw-lang`) v hlavičke plachty — v návrhu nie je,
  pribudol po schválení (D290).
- V návrhu boli texty a odpoveď vyznačené miesta; implementácia berie texty
  z `i18n.ts` (vyká) a nastavenia kanála.
- Nové triedy `.xw-*` z návrhu (`.wrow*`, `.wsheet`, …) sú v design systéme
  pod menom externého widgetu (`globals.css`, `conventions.md`).
