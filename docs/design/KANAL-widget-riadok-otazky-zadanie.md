# Zadanie návrhu — KANAL-widget-riadok-otazky

> Podklad pre **nový tvar zatvoreného widgetu a jeho rozbalenie** (kanál ISSF
> Helpdesk vložený v ISSF, ADR-028, ADR-042). Pripravené 27. 10. 2026 na
> pokyn Jána po ukážke widgetu v ISSF: „chcel by som design tlačidla
> ‚Opýtať sa' inak, modernejšie, interaktívnejšie, navrhujem rovno riadok
> ako v hlavičke Contineo na otázku s placeholderom … s ikonou Contineo na
> začiatku riadku. Kľudne môžeme rozbaliť po kliknutí do riadku/textarea
> animáciou celé Contineo widget na 80 % obrazovky vodorovne aj zvislo, nech
> je viac priestoru na pýtanie sa, podobne ako je to priamo v Contineo."
>
> **Meradlo je design system Contineo** (artefakt „Contineo — design
> system", https://claude.ai/artifact/AGZnHYA4nCDzqsXZvw7Lzh;
> `.design-sync/conventions.md`, `app/src/app/globals.css`). Vzorom je pole
> otázky v hlavičke (`.header-search`, `HeaderAsk.tsx`) a plachta otázky
> (`.ask-sheet--overlay`, `AskSheet.tsx`, ASK-otazka-z-hlavicky). Čo v systéme
> chýba, návrh pomenuje ako odchýlku — nekreslí to vlastnými triedami potichu.
>
> **Artefakt návrhu:** https://claude.ai/artifact/TRb1BuTwYqCRpGDwk7BJwD
> (plochy 1440 hrateľná a 1440 variant R1 B, 834, 390 zatvorený
> a rozbalený, formulár správy helpdesku; s design systémom Contineo).

## Prečo

Dnes je widget zatvorený ako oblé plné tlačidlo „Opýtať sa" pri okraji
obrazovky (predvolene vpravo v strede, D282). Človek v ISSF z neho nevie,
na čo sa môže pýtať, a tlačidlo nepozýva písať. V Contineu je otázka
**pole**, nie tlačidlo: riadok so značkou Continea a nápovedou, ktorý sa po
kliknutí rozšíri na mieste do plachty s viacriadkovým poľom.

## Čo je dnes

- `lib/widgetScript.ts`: jeden skript bez závislostí, Shadow DOM, tokeny
  a triedy prenesené z `globals.css` doslova (test `widgetTokens`).
- Zatvorený: `.fab` — plné tlačidlo, výška 44 px, text z nastavenia kanála.
- Otvorený: panel na mieste tlačidla, tri veľkosti (360 × 520 / 400 × 600 /
  480 × 720 px, D283), pod 640 px celá obrazovka. Hlavička s názvom
  a „×", pás „Zdroje: …", rozhovor, pole otázky a „Odoslať", tichý odkaz
  „Napísať helpdesku", formulár správy helpdesku (krok 5).
- Poloha je nastavenie kanála: osem miest okolo obrazovky (D282).
- Svetlá téma; tmavú widget nemá (je v cudzej stránke).

## Čo navrhnúť

1. **Zatvorený widget ako riadok otázky.** Tvar `.header-search`: oblé pole,
   značka Continea na začiatku (`ContineoMark` 18 px, farba organizácie),
   nápoveda v poli, napr. „Máte otázku k predpisom SFZ alebo k ISSF?
   Potrebujete návod? Pýtajte sa, sme tu pre vás." (text je nastavenie
   kanála v jazykoch kanála, ako dnes text tlačidla). Terč aspoň 44 px.
   Riadok je skutočné pole — kliknutie, fokus alebo písanie ho rozbalí.
2. **Rozbalenie animáciou** z miesta riadku do panela **80 % šírky a 80 %
   výšky** obrazovky, so závojom za ním (ako `.ask-sheet--overlay`). Text
   napísaný v riadku sa prenesie do poľa. Esc, „×" alebo klik na závoj
   zavrie; rozpísaný text ostane v riadku. Pri `prefers-reduced-motion` bez
   animácie.
3. **Obsah rozbaleného widgetu** podľa plachty otázky: hore viacriadkové
   pole (rastie do šiestich riadkov) so značkou, lišta „Zdroje: … ▾"
   a „Opýtať sa", pod ňou rozhovor (otázka, odpoveď s hlavičkou zdrojov,
   zoznam „Zdroje", palce), „Napísať helpdesku" a formulár správy. Pri
   80 % šírky na počítači má rozhovor čitateľnú šírku (stĺpec ~720 px
   v strede), nie riadky cez celú obrazovku.
4. **Stavy:** zatvorený riadok (prázdny, s rozpísaným textom), rozbalený
   prázdny (privítanie, vzory otázok?), počas odpovede, s odpoveďou
   a palcami, formulár správy helpdesku s „Odpoveď príde na …", chyba
   s kontaktom.
5. **Plochy:** 390 (telefón), 834 (tablet), 1440 (počítač, nad stránkou
   ISSF — tmavomodrá hlavička, sivé pozadie, tabuľky).

## Rozpory s rozhodnutiami (na rozhodnutie Jána, s odporúčaním)

- **R1 — Poloha (D282, osem miest).** Riadok je široký; pri boku obrazovky
  (vpravo v strede) by stál cez obsah.
  - **A) Riadok len dole v strede alebo hore v strede** (dve z ôsmich
    polôh), šírka `min(560px, 100vw − 32px)`; pri ostatných šiestich
    polohách ostane dnešné tlačidlo. *(Odporúčam: riadok potrebuje šírku
    a v ISSF dole v strede nie je tlačidlo ani menu; osem polôh ostane
    štandardom pre tlačidlo.)*
  - B) Riadok na všetkých ôsmich miestach, pri bokoch užší (~320 px).
  - C) Nový prepínač v nastavení kanála „Tvar: tlačidlo / riadok otázky".
- **R2 — Veľkosť (D283, tri predvoľby).** 80 % × 80 % je nová predvoľba.
  - **A) Pridať štvrtú veľkosť „veľký na obrazovku" (80 % × 80 %)
    a pre tvar riadku ju dať predvolene.** *(Odporúčam: D283 ostáva —
    predvoľby, nie voľné pixely; 80 % sa nerozbije na žiadnej šírke.)*
  - B) Riadok vždy 80 % × 80 %, bez výberu.
- **R3 — Pod 640 px.** **A) Riadok na telefóne ostane, rozbalí sa na celú
  obrazovku ako dnes** *(odporúčam: 80 % na telefóne je menej miesta, nie
  viac)*. B) Na telefóne len okrúhle tlačidlo so značkou.
- **R4 — Vzory otázok v prázdnom paneli** (ako v plachte v Contineu).
  **A) Nie teraz** — privítanie z nastavenia stačí, vzory by boli ďalšie
  nastavenie kanála. *(Odporúčam.)* B) Áno, ako nastavenie kanála.

- **R5 — Oslovenie.** Nápoveda v riadku vyká („Pýtajte sa, sme tu pre
  vás"), texty widgetu dnes tykajú („Napíš helpdesku"). **A) Widget
  vyká** — prepísať texty `widget` v sk a cs *(odporúčam: ISSF aj SFZ
  píšu ľuďom „Vy", helpdesk je úradný kontakt)*. B) Tykanie ostane, len
  nápoveda riadku vyká.

## Odchýlky od design systému v návrhu

- **W-R1 — riadok otázky widgetu** (`.wrow-field`): tvar `.header-search`,
  ale výška 52 px, tieň a tlačidlo so šípkou vpravo — stojí nad cudzou
  stránkou a musí byť vidieť. V systéme nie je.
- **W-R2 — plachta 80 % × 80 %** (`.wsheet`): tvar `.ask-sheet--overlay`
  so závojom, otvára sa animáciou z riadku (zväčšenie od spodného stredu,
  0,32 s). V systéme je plachta len pod poľom v hlavičke.
- Rozhovor v plachte (bubliny otázky a odpovede) je dnešný widget, nie
  nový prvok.

## Čo sa nemení

Zmluva s ISSF (D281): ten istý `<script>`, `data-token`, `data-token-url`;
zmena príde do 5 minút (D284). `ContineoHelpdesk.open()` otvorí rozbalený
widget. Farba je organizácie, terče 44 px, kontrast WCAG AA.
