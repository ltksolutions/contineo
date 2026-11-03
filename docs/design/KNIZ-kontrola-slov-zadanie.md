# Zadanie pre Claude Design — KNIZ-kontrola-slov

> Podklad pre nové zobrazenie **kontroly slov s originálom** na obrazovke
> Text dokumentu (`/library/[id]/text`, sekcia `#check`). Pripravené
> 3. 11. 2026 na Jánovu požiadavku pri rozpise ÚLK 2026/2027 („nevieme
> navrhnúť inú formu zobrazenia, vôbec netuším čo mám schváliť, aký je
> problém…"). Vzniká v Claude ako artefakt typu *Design* s pripojeným
> artefaktom „Contineo — design system".
>
> **Artefakt *Design*:** https://claude.ai/artifact/RqVgZzeqTUSizvqHBsJG4M
> (plochy 1440 a 834 svetlá, 390 tmavá, 390 všetko potvrdené; odchýlky
> `.diff-mark`, `.diff-mark--gone` a karta strany v poznámke na plátne).
>
> **Stav: rozhodnuté 3. 11. 2026** — Q1–Q5 podľa odporúčania (A).
>
> **Meradlo je design system Contineo** (`.design-sync/conventions.md`,
> `app/src/app/globals.css`, `app/src/components/`). Čo v ňom chýba, návrh
> pomenuje ako **odchýlku**.

## Prečo

Po prevode PDF modelom (ADR-046, D300–D302) sa text strojovo porovná
s textovou vrstvou PDF slovo po slove. Každý rozdiel musí človek potvrdiť,
inak dokument nejde na schválenie. Dnes je to zoznam zaškrtávacích riadkov:

> ☐ V PDF: `Bratislava` · V texte: `nič`
> &nbsp;&nbsp;&nbsp;hlavná … telovýchovného · strana 11 · riadok 412

Človek z toho nevie povedať, **čo sa stalo**, **či je to chyba** ani **čo
vlastne potvrdzuje**. Pri rozpise ÚLK (53 strán, 22 392 slov, 27 rozdielov)
bola väčšina rozdielov **presun**: model prečítal bunky tabuliek na
stranách 11–12 v inom poradí. Taký presun sa ukáže ako dva nesúvisiace
riadky („chýba" a o kus nižšie „navyše" s tými istými slovami).

Skutočné rozdiely ÚLK, z ktorých návrh kreslí:

| druh v kontrole | strana | čo | čo to je |
|---|---|---|---|
| missing + added | 11–12 | telefónne čísla, „Bratislava", „sportreha gmail. com", „Ambulancia telovýchovného lekárstva…" | presun buniek tabuľky |
| changed | 7 | PDF „cm²", text „cm" | iné slovo |
| added, `nearImage` | 1 | „*Obrázok v origináli: logo Únie ligových klubov*" | opis obrázka |
| missing | 41 | „Priezvisko a meno Tel. kontakt Bydlisko E mail" | chýba hlavička tabuľky |
| missing | 26 | „o" | chýba slovo |
| `minor` | rôzne | interpunkcia | len interpunkcia |

## Čo robí Apple

**Pages / Word — Sledovanie zmien** a **Xcode — porovnanie verzií**: každá
zmena je jedna položka s vetou okolo nej, zmenené slová sú vyznačené,
pri položke sú dve akcie („Prijať" / „Odmietnuť"). **Fotky — duplikáty**:
dvojice toho istého sa ukazujú spolu, nie ako dve položky.

## Otázky (odporúčanie prvé)

- **Q1 — Presuny.** **A (odporúčané):** dvojica „chýba" + „navyše" s tými
  istými slovami je **jedna položka „Presunuté"** s vetou, odkiaľ kam.
  Vysvetlenie: „Rovnaké slová sú v texte na inom mieste — väčšinou poradie
  buniek v tabuľke. Skontrolujte, či údaje patria správnemu riadku."
  B: ponechať dve položky. *Prečo A: presun nie je strata slov, ale môže
  priradiť telefón inému človeku — a to je presne to, čo treba
  skontrolovať.*
- **Q2 — Ako sa potvrdzuje.** **A (odporúčané):** pri každej položke tiché
  tlačidlo **„Text je správny"**, pri skupine strany **„Potvrdiť stranu 11
  (n)"**, dole jedno **„Potvrdiť interpunkciu (n)"**. Zaškrtávacie okienka
  zmiznú. B: ponechať okienka a jedno tlačidlo. *Prečo A: človek potvrdzuje
  to, čo práve čítal; okienka v dlhom zozname sa zaškrtávajú naslepo.*
- **Q3 — Vyznačenie slov.** **A (odporúčané):** veta z textu s **vyznačenými
  slovami, ktoré sa líšia** — nový prvok `.diff-mark` (podčiarknutie
  a jemné pozadie farbou upozornenia; pre „chýba" prečiarknuté slová z PDF).
  B: bez vyznačenia, len tučné písmo. *Prečo A: oko hneď nájde miesto;
  tučné sa v Markdowne bije s tučným textom dokumentu.* — **odchýlka od
  design systému**, pred použitím sa pridá do `globals.css` a
  `conventions.md`.
- **Q4 — Kde je originál.** **A (odporúčané):** pri každej skupine strany
  odkaz **„Otvoriť PDF na strane 11"** (nová karta, `#page=11`). B: náhľad
  strany PDF vedľa zoznamu od 1024 px. *Prečo A: funguje na telefóne aj
  bez JavaScriptu; náhľad je ťažký a o rozpor sa nestará.*
- **Q5 — Oprava.** **A (odporúčané):** tiché **„Opraviť v texte"** otvorí
  editor nižšie na stránke a s JavaScriptom označí to miesto v poli; bez
  neho len posunie k editoru. B: oprava priamo v položke (malé pole).
  *Prečo A: opravuje sa v jednom editore, druhé miesto zápisu by sa
  rozišlo s textom.*

## Prompt pre Claude Design

> Navrhni nové zobrazenie sekcie **„Kontrola slov s originálom"** na
> obrazovke **Text dokumentu** (knižnica, dokument po prevode PDF modelom).
> Úloha človeka: pochopiť, v čom sa text líši od PDF, a potvrdiť, že je
> správny, alebo ho opraviť.
>
> Obsah (skutočné dáta rozpisu ÚLK, 53 strán, 27 rozdielov):
> 1. **Hlavička sekcie**: nadpis, veta „22 392 slov z PDF, 22 237 rovnakých,
>    27 miest na kontrolu" a jedna veta, čo znamená potvrdiť: „Text sme
>    porovnali s PDF slovo po slove. Na týchto miestach sa líšia. Pozrite
>    sa do PDF — ak je text správne, potvrďte; ak nie, opravte ho. Bez toho
>    dokument nepôjde na schválenie." (`lnote lnote--warn`).
> 2. **Skupiny podľa strany** — „Strana 11" + tichý odkaz „Otvoriť PDF na
>    strane 11" + tiché „Potvrdiť stranu 11 (6)".
> 3. **Položka** = karta s nadpisom druhu, vetou a dvomi tichými
>    tlačidlami „Text je správny" / „Opraviť v texte". Druhy:
>    - **Presunuté** — „Bratislava, 02/123 456 78" je v texte o riadok nižšie
>      než v PDF; vysvetlenie „Rovnaké slová sú v texte na inom mieste —
>      väčšinou poradie buniek v tabuľke. Skontrolujte, či údaje patria
>      správnemu riadku."
>    - **Iné slovo** (str. 7) — „…rozmer najmenej 20 **cm** (v PDF: **cm²**)…"
>    - **Chýba v texte** (str. 41) — „~~Priezvisko a meno Tel. kontakt
>      Bydlisko E mail~~" + „V PDF je, v texte nie — chýba hlavička
>      tabuľky?"
>    - **Opis obrázka** (str. 1) — „*Obrázok v origináli: logo Únie
>      ligových klubov*" + „Text, ktorý model dopísal k obrázku. V PDF nie je
>      ako text, preto ho stroj neoverí."
> 4. **Dole**: „Potvrdiť interpunkciu (14)" a pod ním stav po potvrdení
>    všetkého („Všetkých 27 miest potvrdených.", `lnote` s ✓).
>
> Plochy **390 / 834 / 1440**, svetlá aj tmavá téma (390 tmavá). Na 1440
> sú skupiny v jednom stĺpci do šírky čítania, nie tabuľka. Žiadne plné
> tlačidlo (plné patrí `.page-head`), žiadne modálne okno ani toast, terč
> aspoň 44 px. Používaj len tokeny a triedy z pripojeného design systému
> (`card`, `lnote`, `button--quiet`, `button--sm`, `quiet`, `tag`); čo v ňom
> chýba (vyznačenie rozdielnych slov `.diff-mark`, prečiarknutie
> chýbajúcich), **pomenuj ako odchýlku** v `<helmet>` a v poznámke na
> plátne.
