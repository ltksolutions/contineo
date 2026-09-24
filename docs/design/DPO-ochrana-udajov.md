# DPO — ochrana údajov (`/dpo`)

Referencia: `DPO-ochrana-udajov.html`. Základ: `ZAKLAD.md`. Zdroj: `app/src/app/dpo/page.tsx`, `lib/dpo.ts` (`summarize`), i18n `dpo`, ADR-012 (D104, D105).

## Čo funguje — nemení sa

DPO kontroluje, neurčuje (O15/A10) — stránka nič nemení na predpisoch. Výkaz, CSV, námietky: zápis a rozhodnutie sú dva formuláre, do rozhodnutia sa nič nemaže, vyhovenie maže hneď. Texty z i18n.

## Čo sa mení (podoba)

1. **Dlaždice s počtami** nad výkazom: Platné predpisy · S nedostatkom · Zákonná povinnosť · Oprávnený záujem — z `summarize()` (tie isté čísla ako v e-maile `dpoEmail`). Nové krátke popisky.
2. **Tabuľka od 1024 px** (Predpis + znenie · Právny základ + predpis · Zodpovedná osoba · Stav), pod 1024 px karty ako dnes.
3. **Skupiny** „S nedostatkom · n" a „V poriadku · n" (nové texty). Poradie v skupine bez zmeny.
4. **Karta pod 1024 px**: názov a stav v jednom riadku, `<dl>` Znenie · Základ · Garant.
5. **Zodpovedná osoba** ako `mailto:` odkaz.
6. **Námietka**: hlavička (meno, stav, doručená/zaevidoval), text v rámčeku, rozhodnutie v päte `--bg`. Voľby ako dlaždice; „Vyhovieť" pri výbere `--bad-*`, `upheldWarning` v červenom rámčeku (dnes sivá nápoveda).
7. **Zaevidovať námietku** v `<details>` so `summary` ako tlačidlo „+ Zaevidovať námietku", zatvorené (na telefóne v referencii otvorené na ukážku). Pri chybe (`?error=`) otvorené.
8. **Počet čakajúcich námietok** ako štítok pri nadpise sekcie (nový text „{n} čaká na rozhodnutie").

## Otázky pre Jána

- Bod 1 „Garant" v karte na telefóne namiesto „Zodpovedná osoba" (šetrí riadok). Alebo nechať „Zodpovedná osoba"?
- Bod 7: formulár zbaliť? Námietka príde zriedka, ale DPO ju má zaevidovať hneď.

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | tabuľka, 1 námietka čaká + 1 rozhodnutá |
| **834** | karty v skupinách |
| **390** | karty, formulár námietky otvorený |

## Údaje, ktoré v modeli NEEXISTUJÚ

Žiadne — všetko je v `legalBasisRows()` a `listObjections()`. 🔴 Zmena schémy: **žiadna.**
