# ZAKLAD-chyba-povinneho-pola — návrh a implementácia

> **Zdroj:** artefakt *Design* https://claude.ai/artifact/UjbnVF4oDkkbbm8BnAFzYw,
> hlavná plocha `Main.dc.html` → `ZAKLAD-chyba-povinneho-pola.html`.
> Plochy 1440 / 834 / 390 svetlá, 390 tmavá. Zadanie:
> `ZAKLAD-chyba-povinneho-pola-zadanie.md`.

## Rozhodnuté (Ján, 2. 11. 2026 — „Áno, podľa odporúčania")

- **Q1** vzor A — červený riadok priamo pod poľom, nie bublina.
- **Q2** veta pod poľom nahrádza nápovedu, kým je chyba.
- **Q3** súhrn pri tlačidle odoslania áno.
- **Q4** popis poľa ostáva so sivým „Povinné".

## Implementácia

| čo | kde |
|---|---|
| okraj, podklad, `.field-error`, skrytie nápovedy, všeobecná veta, `.form-summary` | `app/src/app/globals.css` (blok „Nevyplnené povinné pole") |
| potlačenie bubliny, fokus na prvé pole, skladanie súhrnu | `app/src/components/RequiredFieldsGuard.tsx` (v `layout.tsx`) |
| vety pri Názve a Druhu, súhrn pri „Nahrať" | `app/src/app/library/new/page.tsx` |
| texty sk/cs/en | `common.requiredMissing`, `missingOne`, `missingMany`; `library.upload.titleMissing`, `categoryMissing` |

## Odchýlky od návrhu

- Návrh kreslí stav triedou `.is-invalid`; aplikácia ho má z `:user-invalid`
  (trieda nevznikla).
- Súhrn je **pred** tlačidlom v existujúcom `.upload-submit` (riadok zarovnaný
  vľavo ako doteraz), nie zarovnaný vpravo ako na plátne.
- Súhrn menuje polia bez počtu („Chýbajú povinné údaje: Názov, Druh.") —
  počet by v slovenčine potreboval tri tvary (údaj / údaje / údajov).
- Pole bez vlastnej vety dostane všeobecnú „Toto pole je povinné." bez
  značky „!" (pseudo-prvok značku s kruhom nevie).
