# Zadanie pre Claude Design — ASK-zdroje-v-plachte

> Podklad pre **výber zdrojov už v plachte otázky** (pole „Opýtajte sa
> svojich dokumentov…" v hlavičke, `AskSheet`). Pripravené 23. 10. 2026 na
> pokyn Jána, ktorý výber zdrojov v plachte hľadal a nenašiel: dnes je len na
> obrazovke odpovede (ASK-zdroje-hladania, PR #418), takže zdroje sa dajú
> zmeniť až po prvej, už zaplatenej odpovedi. Časť „Prompt pre Claude
> Design" sa skopíruje do projektu „Contineo.app responzivny design", zvyšok
> je kontext pre Jána.
>
> **Meradlo je design system Contineo** (`.design-sync/conventions.md`,
> `app/src/app/globals.css`) a vzor `docs/design/ASK-zdroje-hladania.*`.

## Prečo

- Kto vopred vie, že chce hľadať aj v Sportnet dokumentácii, musí sa
  najprv opýtať, potom prepnúť zdroje a opýtať sa znova. Platí dve odpovede.
- Plachta tvrdí „Odpoveď sa skladá len z dokumentov organizácie Intranet
  SFZ", hoci organizácia má aj živý zdroj. Veta už nie je pravdivá.

## Čo je dnes

`components/AskSheet.tsx`, dva tvary s jedným obsahom:

- `overlay`: pole v hlavičke sa po kliknutí, fokuse alebo ⌘K rozšíri na
  mieste. Pod 640 px ide na celú obrazovku s „×" hore a „Opýtať sa" dole.
- `inline`: `/ask` bez otázky, tá istá plachta vložená do stránky.

Obsah zhora:
1. Viacriadkové pole otázky.
2. Lišta s nápovedou („↑↓ vybrať · Enter otvorí · Esc zavrie") a plné
   „Opýtať sa →".
3. Veta `.ask-sheet-info` („Odpoveď sa skladá len z dokumentov
   organizácie…").
4. „Nedávne otázky" a „Napríklad".

Je to `<form method="get" action="/ask">` s `<textarea name="q">`, odošle sa
aj bez JavaScriptu. Na obrazovke odpovede je výber `details.ask-scope`
s riadkami `.select-row` a parametrom `?src=` (PR #418, pozri
`ASK-zdroje-hladania.md`). Zdroje sú vždy vymenované („Zdroje: Knižnica,
Sportnet dokumentácia"). Predvolene je Knižnica a konektory s „používať
predvolene" (Ján 8. 10. 2026).

## Čo navrhnúť

1. **Výber zdrojov v plachte** pred odoslaním, tým istým tvarom ako na
   obrazovke odpovede: „Zdroje: Knižnica ▾", zdroje vymenované, riadky
   `.select-row`, aspoň jeden zapnutý. Výber ide s otázkou ako `src`
   (rovnaký formulár, funguje aj bez JS).
2. **Veta o zdrojoch** podľa výberu: „Odpoveď sa skladá len z dokumentov
   SFZ" / „… z dokumentov SFZ a zo zdroja Sportnet dokumentácia" (znenie
   hlavičky odpovede).
3. **Nadväznosť:** obrazovka odpovede začne s výberom z plachty a „Upraviť
   otázku" otvorí plachtu s aktuálnym výberom.
4. Organizácia bez živého zdroja: výber sa nekreslí, veta ostáva ako dnes.
5. `overlay` aj `inline`; 390 / 834 / 1440, svetlá aj tmavá téma;
   klávesnica (plachta už má ↑↓, Enter a Esc pre nedávne otázky).

## Otázky na rozhodnutie (s odporúčaním)

- **Q1 — Kde je výber v plachte:**
  - A) v lište vľavo od „Opýtať sa", namiesto alebo vedľa nápovedy
    klávesov: tiché `.button--sm` „Zdroje: Knižnica ▾", ktoré rozbalí riadky
    pod lištou *(odporúčam: je pri tlačidle, ktoré otázku odošle, a nápoveda
    klávesov je pod 640 px aj tak skrytá)*.
  - B) samostatný riadok nad vetou o zdrojoch.
- **Q2 — Rozbalenie:**
  - A) riadky sa rozbalia v plachte pod lištou, nie druhý popover nad
    popoverom *(odporúčam: plachta je už sama nad obrazovkou)*.
  - B) popover `.ask-scope-pop` ako na obrazovke odpovede.
- **Q3 — Pamätanie výberu:**
  - A) nepamätá sa: plachta začína predvoleným výberom, na obrazovke
    odpovede výberom z adresy *(odporúčam: rovnaké pravidlo ako dnes; čo sa
    hľadá, je vidieť v tlačidle pred každou otázkou)*.
  - B) pamätať si posledný výber v prehliadači.
- **Q4 — Veta o zdrojoch:**
  - A) mení sa podľa výberu (bod 2) *(odporúčam: inak klame)*.
  - B) všeobecná veta bez menovania zdrojov.

## Prompt pre Claude Design

> Navrhni **výber zdrojov v plachte otázky** intranetu Contineo (pole
> „Opýtajte sa svojich dokumentov…" v hlavičke, `AskSheet`, tvary
> `overlay` aj `inline`). Použi **výhradne design system Contineo**
> (pripojený „Contineo — design system"). Vzor je výber na obrazovke
> odpovede `ASK-zdroje-hladania`: tiché tlačidlo „Zdroje: … ▾", zdroje vždy
> vymenované, riadky `.form-row.select-row` s natívnym checkboxom, aspoň
> jeden zapnutý. Čo v systéme chýba, pomenuj ako odchýlku s odporúčaním.
> Apple HIG / SwiftUI, mobile first (390, 834, 1440), svetlá aj tmavá téma,
> slovenské texty, farba organizácie.
>
> Dnes sa zdroje dajú zmeniť až na obrazovke odpovede, teda po prvej,
> zaplatenej odpovedi. A veta v plachte „Odpoveď sa skladá len z dokumentov
> organizácie" neplatí, keď je zapnutý aj živý zdroj.
>
> Navrhni:
> 1. **Výber zdrojov v plachte** pred odoslaním. Odporúčané (Q1 A, Q2 A):
>    tiché `.button--sm` „Zdroje: Knižnica ▾" v lište vľavo od plného
>    „Opýtať sa", riadky sa rozbalia v plachte pod lištou. Výber sa odošle
>    s otázkou ako `src` v tom istom GET formulári (funguje bez JS).
> 2. **Veta o zdrojoch** podľa výberu: „Odpoveď sa skladá len z dokumentov
>    SFZ" / „… z dokumentov SFZ a zo zdroja Sportnet dokumentácia".
> 3. **Nadväznosť** s obrazovkou odpovede: tá začne s výberom z plachty;
>    „Upraviť otázku" otvorí plachtu s aktuálnym výberom.
> 4. Stavy: predvolene, výber rozbalený, len živý zdroj, organizácia bez
>    živého zdroja (výber nie je), overlay pod 640 px (celá obrazovka,
>    „Opýtať sa" dole nad klávesnicou).
>
> Pravidlá: najviac jedno plné tlačidlo („Opýtať sa"); zmena zdrojov nič
> nespúšťa; terč aspoň 44 px; stav v adrese (`?q=&src=`). Súbory
> `ASK-zdroje-v-plachte.html` + `.md`, otázky Q1–Q4 s odporúčaním v sekcii
> „Rozhodnuté".
