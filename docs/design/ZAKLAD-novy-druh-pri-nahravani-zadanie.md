# Zadanie pre Claude Design — ZAKLAD-novy-druh-pri-nahravani

> Podklad pre založenie **nového Druhu dokumentu priamo vo formulári
> nahrávania**. Pripravené 2. 11. 2026 na Jánovu požiadavku („ak pridávam
> nový dokument a potrebujem pridať nový Druh, nevedel by som to priamo pri
> zadaní dokumentu? toto by mohol len ten, čo má práva na správu
> číselníkov"). Vzniká v Claude ako artefakt typu *Design* s pripojeným
> artefaktom „Contineo — design system".
>
> **Artefakt *Design*:** https://claude.ai/artifact/BbZ8yzZShmytzyz8wD4Q3Y
> (plochy 1440 a 834 nový druh vybraný, 390 hľadanie, 390 tmavá bez práva;
> odchýlka `.select-create` v poznámke na plátne).
>
> **Stav: rozhodnuté 2. 11. 2026** — Q1–Q4 podľa odporúčania.
>
> **Meradlo je design system Contineo** (`.design-sync/conventions.md`,
> `app/src/app/globals.css`, `app/src/components/`). Čo v ňom chýba, návrh
> pomenuje ako **odchýlku**.

## Prečo

Na `/library/new` je Druh povinný a vyberá sa z číselníka organizácie
(D55). Keď vhodný druh chýba („Rozpis"), hľadanie v zozname povie len
„Nič sa nenašlo." — človek musí formulár opustiť, ísť do Organizácia →
Číselníky, druh založiť a začať nahrávanie odznova (súbor sa vyberá znova).

Značky sa vo formulári zakladať dajú už od 8. 10.
(ZAKLAD-vyber-skupin-a-znaciek). Druh je iný v dvoch veciach: má **úlohu**
(záväzný predpis / usmernenie / záznam, ADR-034), ktorá určuje poradie
v kontrole súladu, a číselník spravuje **správca osôb** (`people-admin`).

## Čo robí Apple

Finder (štítky), Pripomienky (zoznamy) a Kontakty (skupiny): pole hľadania
nad zoznamom, a keď napísaný text nezodpovedá žiadnej položke, posledný
riadok zoznamu je **„Vytvoriť ‚…'"**. Nová položka sa ukáže hneď ako
vybraná; podrobnosti sa dopĺňajú pod ňou, nie v novom okne.

## Rozhodnuté (Ján 2. 11. 2026, podľa odporúčania)

- **Q1 — Kto.** Len **správca osôb** — ten istý človek, ktorý spravuje
  Číselníky. Ostatní vidia pri prázdnom výsledku vetu „Nový druh pridá
  správca číselníkov."
- **Q2 — Kde.** Riadok **„+ Pridať druh ‚Rozpis'"** na konci zoznamu
  v rozbaľovacom výbere, keď napísaný text nie je presne existujúci druh.
  Po kliknutí sa namiesto výberu ukáže pole s názvom (predvyplnené)
  a pod ním výber úlohy.
- **Q3 — Kedy vznikne.** **Naraz s dokumentom** po stlačení „Nahrať", ako
  nová značka. Nedokončené nahrávanie nenechá v číselníku osirelý druh.
- **Q4 — Úloha.** Výber s predvoľbou **„usmernenie"**, ako v Číselníkoch.

Podobný názov („Rozpisy" popri „Rozpis") sa nezaloží — dokument dostane
existujúci druh a hlásenie po nahratí to povie.

## Prompt pre Claude Design

> Navrhni, ako na obrazovke **Nahrať dokument** (krok „2 Metadáta")
> správca číselníkov **založí nový Druh dokumentu** bez odchodu z
> formulára. Vzor je SwiftUI / Finder: posledný riadok zoznamu pri hľadaní
> je „+ Pridať druh ‚Rozpis'".
>
> Stavy na kreslenie (pole Druh, komponent `Select` s hľadaním —
> `.select`, `.select-pop`, `.select-search`, `.select-list`,
> `.select-item`, `.select-empty`):
> 1. **Zoznam s hľadaním „Rozpis"**, nič sa nenašlo → pod „Nič sa
>    nenašlo." riadok „+ Pridať druh ‚Rozpis'" (farba `--accent`, výška
>    riadku ako `.select-item`).
> 2. **Po kliknutí**: namiesto výberu pole `input.field-input` s textom
>    „Rozpis", pod ním tiché tlačidlo „Vybrať existujúci", ďalej pole
>    **Úloha** (`Select`: Záväzný predpis / Usmernenie / Záznam,
>    predvolené Usmernenie) s nápovedou. Za popisom „Druh" tichý text
>    „· nový" (pilulka `.tag` do formulára nepatrí).
> 3. **Bez práva** (nie správca osôb): pod „Nič sa nenašlo." sivá veta
>    „Nový druh pridá správca číselníkov."
>
> Plochy 390 / 834 / 1440, svetlá aj tmavá téma. Používaj len tokeny
> a triedy z pripojeného design systému; čo v ňom chýba (riadok
> „+ Pridať…" v zozname výberu), **pomenuj ako odchýlku** v `<helmet>`
> a v poznámke na plátne. Nekresli modálne okno ani toast.
