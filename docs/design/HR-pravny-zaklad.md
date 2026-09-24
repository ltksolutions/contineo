# HR — právny základ (`/hr/assign`, `/hr/evidence`)

Referencia: `HR-pravny-zaklad.html`. Základ: `ZAKLAD.md`, `HR.md`. Zdroj: `app/src/app/hr/assign/page.tsx`, `hr/evidence/page.tsx`, i18n `hr.assign`, `responsibility` (`missingBasisTag`, `missingBasisNote`), ADR-012, D91.

## Čo funguje — nemení sa

Pridelenie bez právneho základu **prejde** (upozornenie, nie brána, D91). „Všetkým" prebije výber. Oddelenie platí aj pre podriadené. Dôvod povinný a spoločný. Termín nepovinný (dátum / počet dní). „Skontrolovať dopad". Formulár bez JavaScriptu. Reťaz: `<details>` na riadok, `dutyState()` farby, os udalostí.

## Čo sa mení (podoba)

### /hr/assign
1. **`missingBasisNote`** — jantárový rámček (`--warn-*`, ⚠) hore v skupine „Ktoré normy" namiesto sivej `field-hint`.
2. **Riadok predpisu** — mriežka: checkbox · názov · štítok vpravo; druhý riadok verzia + platnosť s elipsou. Vybraný riadok `--accent-soft`.
3. ⚠️ **Nahradené `KOMPONENT-vyber-oddelenia`** (MultiSelect so stromom a hľadaním). Pôvodný návrh: **Strom oddelení** — namiesto `tag--choice` s `marginLeft` zoznam riadkov 34 px: checkbox · názov (odsadenie + ľavá čiara podľa `level`) · počet vpravo (`withDescendants`, nula `opacity .55`). Od 640 px `columns: 2`, pod 640 px jeden stĺpec. Tie isté `<input name="audience">`.
4. **Termín** — tri `radio` (bez termínu / do dátumu / do počtu dní), pole vedľa svojej voľby. ⚠️ Dnes `<select>` + dve polia; server číta tie isté názvy polí — overiť, že radio môže niesť rovnaké `name`/hodnoty ako select.
5. **Hlavička skupiny** — nadpis + počet („13 platných · vybrané 2") — počet vybraných len s JS; bez JS len „13 platných". Nový text.

### /hr/evidence
6. **Riadok ako tabuľka** od 640 px: Osoba · Predpis · znenie · Stav · Dátum · šípka. Pod 640 px dnešná karta.
7. **Neotvorené** — dátum „—", nie druhýkrát „neotvorené" (`when` = `tds["not-opened"]` duplikuje štítok).
8. **Aktívna položka navigácie** — na snímke sú na `/hr/evidence` podčiarknuté dve položky (Pridelené normy aj Reťaz dôkazov). Chyba v `appNav` — aktívna má byť len Reťaz dôkazov.

## Otázky pre Jána

**Odpovede Jána 24. 9. 2026:** Q1 ✅ áno — zodpovedná osoba a právny základ v rozbalenom riadku reťaze · Q2 ❌ súhrn v prehliadači netreba, stačí „Skontrolovať dopad".

- **Q1** — Zobraziť v rozbalenom riadku reťaze **Zodpovednú osobu a Právny základ v čase potvrdenia** (dnes len v CSV)? Údaj existuje, pribudol by na obrazovke.
- **Q2** — Súhrn „vybrané: 2 oddelenia · 4 ľudia" v hlavičke skupiny „Komu" počíta klient (JS). Chceš ho, alebo stačí „Skontrolovať dopad"?

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | Prideliť normy, 2 vybrané predpisy, 2 oddelenia |
| **834** | Reťaz dôkazov, riadok rozbalený |
| **390** | Prideliť normy, strom v jednom stĺpci |

🔴 Zmena schémy: **žiadna.**
