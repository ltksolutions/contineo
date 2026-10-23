# Zadanie pre Claude Design — KANAL-widget-zdroje

> Podklad pre **výber zdrojov a hlavičku odpovede vo widgete kanála**
> (ISSF helpdesk vložený v ISSF, ADR-028). Pripravené 23. 10. 2026 na pokyn
> Jána: „tieto funkcionality musíme mať aj v kanáli ISSF helpdesk vloženom
> v inej aplikácii“ a „zdroje vymenované, nie skryté za ‚Všetky‘, aby bolo
> jasné, v čom sa hľadalo“. Mení rozhodnutie z 8. 10. 2026 („kanálov sa to
> netýka, rozsah vyberá správca kanála“). Správca zdroje ďalej **povoľuje**,
> človek si z povolených vyberá. Časť „Prompt pre Claude Design“ sa skopíruje
> do projektu „Contineo.app responzivny design“, zvyšok je kontext pre Jána.
>
> **Meradlo je design system Contineo** (`.design-sync/conventions.md`,
> `app/src/app/globals.css`) a vzor obrazovky Opýtať sa
> (`docs/design/ASK-zdroje-hladania.*`, PR #418).

## Prečo

Na `/ask` si človek vyberá zdroje (Knižnica, Sportnet dokumentácia) a odpoveď
hovorí, odkiaľ je. Vo widgete nie je ani jedno: zdroje sú pevne z nastavenia
kanála (`connectorScopes`) a odpoveď nepovie, či prišla z predpisov SFZ alebo
zo Sportnet dokumentácie. Pre helpdesk je to podstatné, lebo živý zdroj
neprešiel kurátorom (D174).

## Čo je dnes

- `lib/widgetScript.ts`: jeden skript bez závislostí, **Shadow DOM** s vlastnými
  štýlmi. Štýly aplikácie (`globals.css`) sa doň nedostanú, vzhľad sa preberá
  ručne, farba je organizácie (`accent`).
- Plávajúce tlačidlo, panel `min(400px, 100vw − 32px)` × `min(600px, 100vh −
  100px)`, pod 640 px celá obrazovka. Hlavička s názvom a zavretím, správy
  (otázka a odpoveď po kúskoch), pod odpoveďou zoznam „Zdroje“ a palce. Po
  dvoch negatívnych hodnoteniach ponuka ticketu. Dole pole otázky
  a „Odoslať“.
- Texty idú zo servera podľa jazyka kanála (`dictionary().widget`).
- Nastavenie kanála (`/channels/<id>/settings`): „Živé zdroje“ ako výber
  dvojíc konektor a rozsah. Verejný widget dostane len verejné konektory
  (D174).

## Čo navrhnúť

1. **Výber zdrojov v paneli.** Povolené zdroje kanála (Knižnica a živé zdroje
   z `connectorScopes`), **vymenované** v ovládači: „Zdroje: Knižnica,
   Sportnet dokumentácia ▾“, nikdy „všetky“. Aspoň jeden ostáva zapnutý.
   Kanál s jediným zdrojom ovládač nekreslí.
2. **Zmena nič nespúšťa.** Platí od ďalšej otázky. Keď je posledná odpoveď
   z iných zdrojov, pri nej je „Opýtať sa znova“ (tá istá otázka, nové
   zdroje).
3. **Hlavička každej odpovede** menuje, **v čom sa hľadalo** (Ján 23. 10.
   2026, A), aj keď z niektorého zdroja nič neprišlo: „Odpoveď z dokumentov
   SFZ“ / „… a zo zdroja Sportnet dokumentácia“ / „Odpoveď zo zdroja
   Sportnet dokumentácia“. Rovnaké znenie ako na `/ask`. Z čoho odpoveď
   naozaj je, ukazuje zoznam „Zdroje“ (dokumenty a články) pod ňou.
   Záznam odpovede kanála ukladá `searchedScope` ako `/ask` (PR #418).
4. **Nastavenie kanála.** Čo správca povolí a čo je zapnuté predvolene (Q3).
5. Stavy: predvolene, výber otvorený, zmenené zdroje pri poslednej odpovedi,
   počas písania (výber nedostupný), kanál s jediným zdrojom. Panel 400 px aj
   celá obrazovka 390 px, svetlá téma. Tmavú widget dnes nemá, je v cudzej
   stránke.

## Otázky na rozhodnutie (s odporúčaním)

- **Q1 — Kde je výber zdrojov:**
  - A) riadok pod hlavičkou panela „Zdroje: Knižnica, Sportnet dokumentácia ▾“.
    Rozbalí sa **v paneli** ako zoznam riadkov so zaškrtávacím poľom
    (`.select-row` z design systému, prevzatý do štýlov widgetu) a tlačidlom
    „Hotovo“. *(Odporúčam: v 400 px paneli nie je miesto na popover ani
    druhú plachtu a výber je vidieť ešte pred otázkou.)*
  - B) ikona pri poli otázky dole (menej miesta, ale výber nie je vidieť).
- **Q2 — Po zmene zdrojov:**
  - A) platí od ďalšej otázky. Pri poslednej odpovedi pribudne tiché
    „Opýtať sa znova“ s novými zdrojmi *(odporúčam: rovnaké pravidlo ako na
    `/ask`; v rozhovore sa nič nemaže a nič sa nespúšťa samo)*.
  - B) len od ďalšej otázky, bez „Opýtať sa znova“.
- **Q3 — Predvolené zdroje kanála:**
  - A) všetky povolené zdroje zapnuté *(odporúčam: rovnako ako widget hľadá
    dnes, takže pre ISSF sa bez zásahu nič nemení; bez nového nastavenia)*.
  - B) správca pri každom zdroji určí „zapnuté predvolene“ (nové pole
    v nastavení kanála).
- **Q4 — Rozsahy konektora:** jeden konektor môže mať v kanáli viac rozsahov
  (`<konektor>:<rozsah>`).
  - A) vo výbere jeden riadok za konektor (všetky jeho povolené rozsahy
    spolu) *(odporúčam: človek pozná „Sportnet dokumentácia“, nie rozsah;
    rozsahy sú vec správcu)*.
  - B) riadok za každý rozsah.
- **Q5 — Uloženie výberu:**
  - A) platí počas otvoreného panela (rozhovoru) *(odporúčam: widget nemá
    účet a pamätanie v prehliadači cudzej stránky by bolo prekvapenie)*.
  - B) pamätať si v prehliadači.

## Prompt pre Claude Design

> Navrhni **výber zdrojov a hlavičku odpovede vo widgete kanála** Contineo.
> Widget je panel helpdesku vložený do cudzej aplikácie (ISSF), Shadow DOM,
> panel 400 × 600 px, pod 640 px celá obrazovka. Použi **design system
> Contineo** (pripojený „Contineo — design system“): riadky `.select-row`,
> `.lnote`, tiché a plné tlačidlá, tokeny. Keďže widget štýly aplikácie
> nemá, opíš v `.md`, ktoré pravidlá sa do jeho štýlov prenesú. Čo
> v systéme chýba, pomenuj ako odchýlku s odporúčaním. Vzor je obrazovka
> Opýtať sa (`ASK-zdroje-hladania`). Farba je organizácie (`--accent`),
> texty po slovensky, svetlá téma.
>
> Navrhni:
> 1. **Výber zdrojov** pod hlavičkou panela. Zdroje sú vždy **vymenované**
>    („Zdroje: Knižnica, Sportnet dokumentácia ▾“), nikdy „všetky“. Rozbalí
>    sa v paneli ako riadky so zaškrtávacím poľom a „Hotovo“. Aspoň jeden
>    zdroj ostáva zapnutý. Pri jedinom zdroji sa ovládač nekreslí.
> 2. **Zmena nič nespúšťa** a platí od ďalšej otázky. Keď posledná odpoveď
>    vznikla z iných zdrojov, pri nej je tiché „Opýtať sa znova“.
> 3. **Hlavička každej odpovede** v rozhovore menuje, **v čom sa hľadalo**
>    (aj zdroj, z ktorého nič neprišlo): „Odpoveď
>    z dokumentov SFZ“, „Odpoveď z dokumentov SFZ a zo zdroja Sportnet
>    dokumentácia“, „Odpoveď zo zdroja Sportnet dokumentácia“. Pod
>    odpoveďou ostáva zoznam zdrojov a palce ako dnes.
> 4. Stavy: predvolene (oba zdroje zapnuté), výber otvorený, zmenené zdroje
>    pri poslednej odpovedi, počas písania (výber nedostupný), kanál s
>    jediným zdrojom. Rámy panel 400 px a mobil 390 px.
>
> Pravidlá: najviac jedno plné tlačidlo (v paneli je to „Odoslať“); terč
> aspoň 44 px; nič sa nespúšťa bez vedomého kliknutia (každá otázka stojí
> volanie modelu). Súbory `KANAL-widget-zdroje.html` + `.md`, otázky Q1–Q5
> s odporúčaním v sekcii „Rozhodnuté“.
