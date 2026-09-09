# Handoff: Contineo — responzívny intranet, knižnica a inteligentné zoznamy

## Overview
Návrh firemného intranetu pre `contineo.app`: prehľad (dashboard), knižnica dokumentov
s inteligentnými zoznamami, detail dokumentu, RAG vyhľadávanie („Opýtať sa"), nahrávanie
a schvaľovanie, nastavenia organizácie (multitenant branding) a prihlásenie.

Cieľ: nahradiť dnešný jednostĺpcový layout (`.obal`, `max-width: 900px`) plnohodnotným
aplikačným shellom s navigáciou, faceted filtrami, query builderom a kompaktnou tabuľkou.

## About the Design Files
Súbory v tomto balíku sú **dizajnová referencia napísaná v HTML** — prototyp, ktorý ukazuje
zamýšľaný vzhľad a chovanie. **Nie je to produkčný kód na skopírovanie.**

Cieľový kód je Next.js App Router (`app/`), React server + client komponenty, TypeScript,
jeden globálny stylesheet `app/src/app/globals.css` so slovenským názvoslovím tried
(`tlacidlo`, `pole-vstup`, `stitok`, `vyber`, `karta`, `strom`). Návrh treba **prepísať do
týchto existujúcich vzorov** — teda do CSS tried v `globals.css` a do komponentov v
`app/src/components/`, nie do inline štýlov, ktoré prototyp používa (inline štýly sú
technická požiadavka prostredia prototypu, nie odporúčanie).

Existujúce komponenty, ktoré návrh vedome znovupoužíva a NETREBA písať odznova:
- `components/Select.tsx` — vlastný single-select (nie natívny `<select>`)
- `components/TagSelect.tsx` — výber štítkov s možnosťou pridať nový
- `components/ColorSelect.tsx` — paleta hlavnej farby tenanta
- `components/TenantHeader.tsx` — `tenantStyle()`, ktorý nastavuje `--accent`
- `components/AcknowledgeButton.tsx` — potvrdenie prečítania
- `components/Answer.tsx`, `components/Search.tsx` — RAG odpoveď a citácie
- `components/TreeWithOrder.tsx` — strom priečinkov

## Fidelity
**High-fidelity.** Farby, typografia, odsadenia a stavy sú finálne a odvodené z
`app/src/app/globals.css`. Rozmery v prototype sú zámerné — dodržať ich.
Výnimka: prototyp používa na dvoch miestach natívny `<select>` (query builder, formulár
metadát). V produkcii tam patrí existujúci `components/Select.tsx`.

---

## Screens / Views

### 1. App shell (platí pre všetky obrazovky okrem prihlásenia)

**Layout**
- `min-height: 100vh`, `display: flex; flex-direction: column`
- Header: `position: sticky; top: 0; z-index: 30`, `min-height: 52px`, `padding: 8px 14px`,
  `background: var(--surface)`, `border-bottom: 1px solid var(--line)`, `flex-wrap: wrap`
- Telo: `flex: 1; display: flex; align-items: stretch`
- Main: `flex: 1; min-width: 0; padding: var(--pad-main) var(--pad-main) 56px`

**Header — komponenty (zľava doprava)**
1. Logo tenanta: `26×26`, `border-radius: 7px`, `background: var(--accent)`,
   `color: var(--on-accent)`, iniciála `12px/700`. V produkcii sem ide nahraté logo
   z `/api/brand/<companyCode>?v=<version>` (viď `lib/branding.ts`), fallback iniciála.
2. Prepínač organizácie: text `13.5px/600`, `letter-spacing: -.01em`, šípka `▾ 9px`,
   hover `background: var(--surface-2)`, `border-radius: 7px`, `padding: 3px 6px`.
   Otvára dropdown `280px`, `border-radius: 11px`, `box-shadow: var(--shadow)`,
   `padding: 6px`, riadky `padding: 6px 8px`, farebná dlaždica tenanta `22×22/6px`,
   názov `13px/550`, doména `11px` v `--muted`, ✓ pri aktívnom v `--accent`.
   Prepnutie tenanta mení názov **aj hlavnú farbu** (demonštrácia multitenantu).
3. Globálne vyhľadávanie: `flex: 1 1 240px`, výška `32px`, `padding: 0 11px 0 30px`,
   `background: var(--bg)`, `border: 1px solid var(--line)`, `border-radius: 8px`.
   Focus: `border-color: var(--accent); background: var(--surface);
   box-shadow: 0 0 0 3px var(--accent-soft)`. Placeholder: „Opýtajte sa svojich
   dokumentov…  ⌘K". Ikona `⌕` `12px` v `--muted`, `position: absolute; left: 10px`.
   Focus na tomto poli naviguje na obrazovku „Opýtať sa".
4. Zvonček upozornení: `30×30`, `border-radius: 8px`, hover `--surface-2`; bodka
   `6×6`, `background: var(--bad-fg)`, `top: 4px; right: 4px`.
5. Avatár osoby: `28×28`, `border-radius: 50%`, `background: var(--surface-2)`,
   iniciály `11px/650`; hover `background: var(--accent); color: var(--on-accent)`.
   V prototype vedie na prihlásenie (odhlásenie).

**Navigácia — DVA VARIANTY (implementovať oba, prepínač na úrovni organizácie
alebo osoby; default `topbar`)**

*A) `sidebar` — bočný panel*
- `flex: 0 0 212px`, `padding: 12px 8px`, `background: var(--surface)`,
  `border-right: 1px solid var(--line)`, `display: flex; flex-direction: column; gap: 2px`
- Položka: `padding: 7px 9px`, `border-radius: 8px`, `font-size: 13px`, ikona `15px`
  na šírku a `12px` veľkosť, badge `10.5px`, `padding: 1px 5px`, `border-radius: 20px`,
  `background: var(--surface-2)`, `tabular-nums`
- Aktívna položka: `font-weight: 650`, `color: var(--accent)`,
  `background: var(--accent-soft)`; neaktívna `color: var(--muted); font-weight: 500`
- Sekcia „Uložené pohľady": nadpis `10.5px/650`, `letter-spacing: .07em`, uppercase,
  `--muted`; položky `12.5px` s farebnou bodkou `6×6/2px` a počtom vpravo
- Na spodku karta upozornenia: `padding: 9px`, `border-radius: 9px`,
  `background: var(--bg)`, `border: 1px solid var(--line)`

*B) `topbar` — vodorovné záložky*
- `position: sticky; top: 52px; z-index: 20`, `padding: 0 10px`,
  `background: var(--surface)`, `border-bottom: 1px solid var(--line)`,
  `overflow-x: auto`
- Záložka: `padding: 9px 11px`, `font-size: 13px`, aktívna
  `border-bottom: 2px solid var(--accent); color: var(--accent); font-weight: 650`
- V tomto variante uložené pohľady patria do ľavého panelu Knižnice, nie do navigácie.

**Položky navigácie (v tomto poradí)**
| Kľúč | Label | Ikona | Badge |
| --- | --- | --- | --- |
| dashboard | Prehľad | ▦ | 6 |
| library | Knižnica | ▤ | 148 |
| search | Opýtať sa | ⌕ | — |
| upload | Nahrávanie | ↑ | 3 |
| doc | Posledný dokument | ▪ | — |
| settings | Nastavenia | ⚙ | — |

Ikony sú v prototype textové znaky — v produkcii ich **nahradiť ikonovým setom
projektu** (SVG, `currentColor`, 16px). Nekresliť nové SVG od ruky.

---

### 2. Prehľad (`/`)

**Purpose:** čo odo mňa niekto čaká a čo je nové; vstup do RAG vyhľadávania.

**Layout:** `max-width: 1180px; margin: 0 auto`, `display: flex; flex-direction: column;
gap: var(--gap)`.

**Sekcia „ask" (hero)**
- `padding: var(--card-pad)`, `border-radius: var(--radius)`, `background: var(--surface)`,
  `border: 1px solid var(--line)`, `box-shadow: var(--shadow)`
- H1 „Dobrý deň, <meno>": `19px`, `letter-spacing: -.02em`, `margin: 0 0 3px`
- Podtitul: `13px`, `--muted` — „Opýtajte sa — odpoveď príde z predpisov vašej
  organizácie, s citáciou." (tón podľa `docs/brand-messaging.md`)
- Pole: `flex: 1 1 320px`, výška `38px`, `border-radius: 9px`;
  placeholder „Napr. Do kedy treba nahlásiť prestup hráča?"
- Primárne tlačidlo „Opýtať sa": výška `38px`, `padding: 0 16px`, `border-radius: 9px`,
  `background: var(--accent)`, `color: var(--on-accent)`, `13.5px/600`;
  hover `background: var(--accent-strong)`
- Návrhy otázok: pilulky `padding: 4px 9px`, `border: 1px solid var(--line)`,
  `border-radius: 20px`, `12px`, `--muted`; hover `border-color/color: var(--accent)`.
  Klik vyplní pole a naviguje na vyhľadávanie.

**KPI pás**
- `display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px`
- Dlaždica: `padding: var(--list-py) 13px`, `border-radius: 11px`,
  `border: 1px solid var(--line)`, hover `border-color: var(--accent)`
- Label: `11px/650`, `letter-spacing: .05em`, uppercase, `--muted`
- Číslo: `25px/640`, `letter-spacing: -.03em`, `tabular-nums`
- Obsah: Na potvrdenie **6** (`--bad-fg`, „2 do piatku") · Čaká na schválenie **3**
  („moje") · Nové za 7 dní **12** („dokumentov") · Expiruje do 30 dní **2**
  (`--warn-fg`, „predpisy"). Každá dlaždica je odkaz na predfiltrovaný zoznam.

**Dva panely** (`grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px`)
- *Vyžaduje vašu pozornosť* — hlavička `padding: 11px 13px`, `13.5px/650`, oddelená
  `border-bottom`. Riadok: `padding: var(--list-py) 13px`; názov `13px/550`
  (hover `--accent`), meta `11.5px` `--muted`, termínový chip `11.5px/600`,
  `padding: 2px 7px`, `border-radius: 6px` (do 7 dní `--bad-bg/--bad-fg`, do 30 dní
  `--warn-bg/--warn-fg`, inak `--surface-2/--muted`), akčné tlačidlo
  „Potvrdiť"/„Schváliť" `padding: 4px 10px`, `border-radius: 7px`,
  `border: 1px solid var(--line)`, hover celé v `--accent`.
- *Novinky v knižnici* — stavový chip vľavo `10.5px/650`, `padding: 1px 6px`,
  `border-radius: 5px`; názov `13px`; meta „Kategória · Útvar · kedy".

---

### 3. Knižnica dokumentov (`/library`) — jadro návrhu

**Layout:** `max-width: 1400px`. Hlavička (názov + počet + akcie), pod ňou
`display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap`:
- `aside` filtre: `flex: 0 1 216px; min-width: 196px`
- obsah: `flex: 1 1 560px; min-width: 0`
Vďaka `flex-wrap` sa panel filtrov na úzkom viewporte zabalí **nad** zoznam — žiadne
media queries. (Ak chcete pravý mobilný režim, viď „Responsive behavior".)

**Hlavička**
- H1 „Knižnica dokumentov" `19px`, `letter-spacing: -.02em`; vedľa počet `12.5px`
  `--muted` v tvare „`N` z `M` dokumentov"
- „Nahrať dokument" primárne (`32px`, `padding: 0 13px`, `border-radius: 8px`,
  `--accent`), „Export CSV" sekundárne (`border: 1px solid var(--line)`,
  `background: var(--surface)`), prepínač Tabuľka/Karty: obal
  `background: var(--surface-2)`, `border-radius: 8px`, `padding: 2px`; aktívny segment
  `background: var(--surface)`, `12.5px/600`

**Panel filtrov (faceted)**
- `padding: 11px`, `border-radius: var(--radius)`, `background: var(--surface)`,
  `border: 1px solid var(--line)`
- Hlavička: „FILTRE" `11px/650`, `letter-spacing: .06em`, uppercase, `--muted`;
  vpravo „Zrušiť" `11.5px/600` v `--accent`
- Hľadanie vo filtroch: výška `30px`, `border-radius: 7px`, `background: var(--bg)`;
  filtruje **položky facetov**, nie dokumenty
- Skupina: nadpis `11.5px/650`, `margin-bottom: 5px`; položka
  `display: flex; gap: 7px; padding: 3px 4px; border-radius: 6px`,
  hover `background: var(--surface-2)`
- Checkbox: `14×14`, `border-radius: 4px`, `border: 1px solid var(--line)`;
  zaškrtnutý `background/border-color: var(--accent)`, ✓ `9px/800` v `--on-accent`
- Label `12.5px` s ellipsis, počet `11px` `--muted` `tabular-nums`
- Facety: **Kategória** (Norma 41, Smernica 62, Metodický pokyn 23, Manuál 22 —
  z `codelists/category.json`), **Stav** (Platný 118, Návrh 14, Na schválenie 9,
  Expirovaný 7)
- Pod oddeľovačom tri multiselecty s vyhľadávaním: **Útvar / stredisko**, **Štítky**
  (`codelists/tags.json`), **Autor / schvaľovateľ**

**Multiselect s vyhľadávaním** (`MultiSelect.dc.html`, produkčne rozšírenie
`components/TagSelect.tsx` / nový `components/MultiSelect.tsx`)
- Label `11px/650`, `letter-spacing: .06em`, uppercase, `--muted`
- Kontrolka: `min-height: 32px`, `padding: 4px 6px`, `border-radius: 8px`,
  `border: 1px solid var(--line)`, `display: flex; flex-wrap: wrap; gap: 4px`,
  `cursor: text`; hover `border-color: var(--accent)`
- Chip vybranej hodnoty: výška `22px`, `padding: 0 4px 0 7px`, `border-radius: 5px`,
  `background: var(--surface-2)`, `12px`; × `15×15`, `border-radius: 4px`,
  hover `background: rgba(20,28,42,.10)`
- Vnútorný input: `flex: 1 1 70px`, bez rámika, `13px`; vpravo počítadlo
  „vybrané/všetky" `11px` `--muted`
- Dropdown: `position: absolute; top: 100%; margin-top: 4px`, `max-height: 230px`,
  `overflow: auto`, `border-radius: 10px`,
  `box-shadow: 0 1px 2px rgba(20,28,42,.05), 0 12px 28px rgba(20,28,42,.14)`,
  `z-index: 40`; položka `padding: 6px 9px`, `13px`, hover `--surface-2`,
  ✓ v `--accent` `10px/800`, počet vpravo `11px`
- Pätička dropdownu `position: sticky; bottom: 0`: „Zrušiť výber" (`--muted`) /
  „Hotovo" (`--accent`, `600`)
- Klávesnica: **Enter** pridá napísanú hodnotu (ak neexistuje a `allowNew`, vytvorí ju —
  normalizácia `trim().toLowerCase().replace(/\s+/g,"_")`, rovnako ako
  `normalizeKeys()` na serveri), **Backspace** pri prázdnom vstupe odoberie poslednú,
  **Escape** zatvorí. Klik mimo zatvára (`mousedown` listener na `document`).
- Výber položky na `onMouseDown` s `preventDefault()`, nie `onClick` — inak listener
  „mimo" zatvorí zoznam skôr, než sa hodnota vyberie (rovnaký dôvod ako v `Select.tsx`).
- `<noscript>` fallback: pôvodné textové pole s rovnakým `name` (vzor z `TagSelect.tsx`).

**Panel hľadania + query builder**
- Obal `padding: 9px 10px`, `border-radius: 11px`, `background: var(--surface)`,
  `border: 1px solid var(--line)`
- Fulltext: `flex: 1 1 240px`, výška `30px`, `border-radius: 7px`;
  placeholder „Hľadať v názve, obsahu, čísle predpisu…"
- Aktívne filtre ako chips: výška `26px`, `padding: 0 5px 0 9px`, `border-radius: 6px`,
  `background: var(--accent-soft)`, `color: var(--accent-strong)`, `12px`; formát
  „Kategória: Norma", „Útvar: Právne", „Štítok: Poriadok"; × odoberá jeden filter
- „+ Podmienka" / „− Skryť podmienky": `border: 1px dashed var(--line)`,
  `border-radius: 6px`, `12px/600`, `--muted`; hover `--accent`
- Vpravo „Uložiť pohľad" `12px/600` v `--accent` (uloží aktuálny filter do
  „Uložených pohľadov")
- Rozbalený builder: `border-top: 1px solid var(--line)`, `padding-top: 9px`,
  `gap: 6px`, animácia `cnt-in .12s ease-out`. Riadok podmienky:
  1. spojka: `width: 40px`, `padding: 5px 0`, `border-radius: 6px`, `11.5px/700`;
     prvý riadok „KDE" (nekliknuteľné, `--muted`), ďalšie prepínajú
     **AND ↔ ALEBO** (`background: var(--surface-2)`)
  2. pole: Kategória / Útvar / Stav / Platnosť od / Potvrdenia / Názov
  3. operátor: je / nie je / obsahuje / pred / po
  4. hodnota: `flex: 1 1 130px`
  5. × odobrať: `26×26`, hover `background: var(--bad-bg); color: var(--bad-fg)`
  Všetky kontrolky výška `29px`, `border-radius: 7px`, `background: var(--bg)`, `12.5px`
- Pod riadkami „+ Podmienka" a **monospace náhľad dotazu**: `11.5px`, `--muted`,
  napr. `category is „Norma" AND status not „Návrh"` — je to kontrola, že človek
  a systém rozumejú dotazu rovnako.
- Query builder aj facety musia byť **serializovateľné do URL** (`?search=&category=&
  status=&folder=&tag=&accessLevel=`) — dnešná `library/page.tsx` to už robí cez
  `normalizeQuery` a `withFilter()`; zachovať, aby sa pohľad dal poslať odkazom.

**Panel hromadných akcií** (zjaví sa pri označení ≥ 1 riadku)
- `padding: 7px 10px`, `border-radius: 9px`, `background: var(--accent)`,
  `color: var(--on-accent)`, animácia `cnt-in`
- „Označené: N" `12.5px/600`; akcie „Priradiť útvarom", „Vyžiadať potvrdenie",
  „Presunúť" — `background: rgba(255,255,255,.16)`, hover `.28`,
  `padding: 4px 10px`, `border-radius: 7px`; vpravo „Zrušiť"

**Tabuľka (kompaktná)**
- Obal `border-radius: var(--radius)`, `overflow: hidden`,
  `border: 1px solid var(--line)`; `overflow-x: auto`, tabuľka `min-width: 880px`,
  `border-collapse: collapse`
- Hlavička: `background: var(--bg)`, `padding: 7px 10px`, `10.5px/650`,
  `letter-spacing: .06em`, uppercase, `--muted`, `white-space: nowrap`,
  `cursor: pointer`, `user-select: none`; aktívne triedenie pridá „ ↑"/„ ↓";
  hover `color: var(--ink)`
- Stĺpce: [checkbox 34px] Dokument · Kategória · Útvar · Verzia · Platnosť od · Stav ·
  Potvrdenia · Zmenené (vpravo)
- Riadok: `border-bottom: 1px solid var(--line)`, `padding: var(--row-py) 10px`,
  hover `background: var(--bg)`; označený riadok `background: var(--accent-soft)`
- Bunka „Dokument": `max-width: 340px`; názov `var(--font-row)`/`600` s ellipsis,
  hover `--accent`; pod ním `11px` `--muted` „`<id>` · `<priečinok>`"
- Verzia a dátumy `12.5px`, `tabular-nums`, `nowrap`
- Stavový chip: `padding: 2px 7px`, `border-radius: 5px`, `11.5px/600` —
  Platný `--ok-bg/--ok-fg`, Návrh `--warn-bg/--warn-fg`, Na schválenie
  `--accent-soft/--accent-strong`, Expirovaný `--bad-bg/--bad-fg`
- Potvrdenia: pásik `height: 5px`, `border-radius: 3px`,
  `background: var(--surface-2)`, výplň podľa percenta — ≥ 90 % `--ok-fg`,
  ≥ 50 % `--accent`, inak `--warn-fg`; vedľa percento `11px` `--muted`
- Hlavičkový checkbox: prázdny → nič, časť označená → „–", všetko → „✓"
- Pätička: `padding: 8px 11px`, `background: var(--bg)`,
  `border-top: 1px solid var(--line)`; vľavo „Zobrazené 1–N z M", vpravo stránkovanie
  (`27px`, `border-radius: 7px`)

**Karty (alternatívny pohľad)**
- `grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px`
- Karta `padding: 12px`, `border-radius: 11px`, hover `border-color: var(--accent)`;
  hore stavový chip + kategória + verzia, názov `13.5px/600`, `line-height: 1.35`,
  `text-wrap: pretty`, pod ním `11.5px` meta a pásik potvrdení

---

### 4. Detail dokumentu (`/library/[id]`)

**Layout:** `max-width: 1180px`; breadcrumb, potom `flex` — obsah
`flex: 1 1 520px`, pravý panel `flex: 0 1 258px; min-width: 230px`, `gap: 12px`.

**Breadcrumb:** `12px`, `--muted`, „Knižnica / <priečinok> / <názov>", posledná časť
v `--ink`; cesta z `folderTrail` (`lib/libraryRead.ts`).

**Hlavička dokumentu**
- Chips: „Platný" (`--ok-*`), kategória (`--surface-2/--muted`), „Potvrdenie do 12. 9."
  (`--warn-*`) — `padding: 2px 8px`, `border-radius: 5px`, `11.5px/600`
- H1 `22px`, `line-height: 1.25`, `letter-spacing: -.02em`, `text-wrap: pretty`
- Meta riadok `13px` `--muted`: „RPP-2026-04 · verzia 4.2 · účinné od 1. 1. 2026 ·
  nahradzuje v4.1"
- Akcie (výška `33px`, `border-radius: 8px`): **Potvrdiť prečítanie** primárne;
  po potvrdení sa mení na „✓ Potvrdené <dátum>" s `background: var(--ok-bg);
  color: var(--ok-fg)` (napojiť na `components/AcknowledgeButton.tsx` a
  `lib/acknowledgements.ts`). Ďalej „Nová verzia", „Stiahnuť PDF", „⋯".

**Záložky obsahu:** Obsah / Zmeny / Citované časti / Audit — `padding: 9px 11px`,
`12.5px`, aktívna `border-bottom: 2px solid var(--accent)`, `650`;
pás `background: var(--bg)`, `overflow-x: auto`.

**Telo:** `padding: 16px 18px`, `max-width: 70ch`; H2 `14px/650`; odstavce
`13.5px`, `line-height: 1.65`, `text-wrap: pretty`. Blok „Zmena oproti v4.1":
`padding: 11px 13px`, `border-radius: 9px`, `background: var(--bg)`,
`border: 1px solid var(--line)`, `border-left: 3px solid var(--accent)`.

**Verzie a schválenie:** riadok `padding: 9px 13px` s bodkou `8×8` (aktuálna
`--ok-fg`, archív `--muted`, návrh `--warn-fg`), label `13px/550`, meta `11.5px`,
vpravo chip Aktuálna / Archív / Návrh.

**Pravý panel**
- *Potvrdenia*: „68 %" `24px/640`, vedľa „142 / 210 osôb" `12px` `--muted`; pásik
  `height: 6px` s výplňou `var(--accent)`; odkaz „Kto nepotvrdil →" `12px/600`
- *Metadáta*: riadky `flex`, kľúč `flex: 0 0 88px`, `12px`, `--muted`; hodnota
  `12.5px`. Polia: Kategória, Útvar, Štítky, Prístup (`codelists/accessLevel.json`),
  Zdroj (`codelists/sourceType.json`), Schválil, Identifikátor
- *Súvisiace predpisy*: odkazy `12.5px` v `--accent`, `line-height: 1.4`

---

### 5. Opýtať sa / globálne vyhľadávanie (`/search`)

**Layout:** `max-width: 860px; margin: 0 auto`.
- Pole `height: 40px`, `14px`, `border-radius: 10px`, placeholder „Opýtajte sa celou
  vetou…"; tlačidlo „Opýtať sa" `40px`, `padding: 0 16px`
- Rozsah hľadania: „Hľadať len v:" `11.5px` `--muted` + pilulky Knižnica / Intranet /
  Verejný web / Archív — `padding: 4px 10px`, `border-radius: 20px`; aktívna
  `background: var(--accent-soft)`, `color: var(--accent-strong)`,
  `border-color: var(--accent)`
- **Karta odpovede** (`components/Answer.tsx`): hlavička — značka `20×20/6px`
  v `--accent` + „ODPOVEĎ Z VAŠICH DOKUMENTOV" `11px/650`, uppercase,
  `letter-spacing: .06em`. Text `14.5px`, `line-height: 1.65`, `text-wrap: pretty`;
  citácie ako `<sup>` `10px/700` v `--accent` (`[1]`, `[2]`, `[3]`)
- **Zdroje**: klikateľné karty `padding: 9px 10px`, `border-radius: 9px`,
  `background: var(--bg)`, hover `border-color: var(--accent)`; číslo `11px/700`
  v `--accent`, názov `12.5px/600`, meta „Článok 4, odsek 1 · účinné od…" `11.5px`,
  vpravo skóre `11px` `tabular-nums` (formát „0,94" — desatinná čiarka, sk-SK)
- **Hodnotenie** (`components/Rating.tsx`): „Bola odpoveď užitočná?" + Áno / Nie +
  „Nahlásiť nepresnosť" `12px/600` v `--accent`; `border-top: 1px solid var(--line)`
- **Ďalšie zhody**: karty `padding: 11px 12px`, `border-radius: 10px`; názov
  `13px/600`, meta `11px`, úryvok `12.5px`, `line-height: 1.55` v `--muted`

---

### 6. Nahrávanie a schvaľovanie (`/library/new`)

**Layout:** `max-width: 880px`.
- H1 `19px` + podtitul `13px` `--muted`
- Stepper: 3 kroky (Súbor / Metadáta / Schválenie), `padding: 8px 12px`,
  `border-radius: 9px`; aktívny `background: var(--accent-soft)`,
  `border-color: var(--accent)`, číslo v kruhu `19×19` `background: var(--accent)`,
  `color: var(--on-accent)`, `10.5px/700`; neaktívny `--surface/--line/--muted`
- Dropzone: `padding: 18px`, `border: 1px dashed var(--line)`, `border-radius: 11px`,
  `background: repeating-linear-gradient(135deg, rgba(20,28,42,.03) 0 8px,
  transparent 8px 16px)`; nadpis `13.5px/600`, popis **monospace** `11.5px`
  `--muted`: „PDF · DOCX · MD · sken (OCR) — max 40 MB / SVG zámerne nepodporujeme"
  (dôvod v `lib/branding.ts`); tlačidlo „Vybrať súbor" `33px`
- Nahratý súbor: `padding: 9px 11px`, `border-radius: 9px`, `background: var(--bg)`;
  názov `12.5px/600` s ellipsis, veľkosť + počet strán `11.5px` `--muted`, chip
  „Rozpoznané" `--ok-*`
- Metadáta: `grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 13px`;
  polia Názov, Kategória (`Select`), Priradiť útvarom (multiselect), Štítky
  (multiselect s pridávaním), Schvaľovatelia (multiselect), Účinné od.
  Popisky `11px/650`, uppercase, `letter-spacing: .06em`, `--muted`; vstupy `32px`,
  `border-radius: 8px`, `background: var(--bg)`
- Prepínač „Vyžadovať potvrdenie prečítania": `padding: 10px 11px`,
  `border-radius: 9px`, `background: var(--bg)`; checkbox `15×15`; titulok
  `12.5px/600`, vysvetlenie `11.5px` `--muted`, `line-height: 1.45`
- Schvaľovacia cesta: riadky `padding: 8px 0` s `border-bottom`; avatár `26×26`
  `border-radius: 50%` `--surface-2`, iniciály `10.5px/650`; meno `13px/550`,
  rola `11.5px` `--muted`; chip stavu „Čaká" (`--warn-*`) / „Po Marekovi"
  (`--surface-2/--muted`) — poradie je sekvenčné
- Akcie: „Poslať na schválenie" primárne `35px`, „Uložiť ako návrh" sekundárne,
  „Zrušiť" tiché (`--muted`, hover `--ink`)

---

### 7. Nastavenia organizácie (`/organisation`, `/admin/tenants/[code]`)

**Hlavná farba** — najdôležitejšia časť multitenantu
- Vysvetľujúci text `12.5px`, `--muted`, `max-width: 62ch`: paleta je pevná a každý
  odtieň znesie biely text (dôvod je v komentári `ColorSelect.tsx` — zachovať ho)
- Paleta: 10 dlaždíc `34×34`, `border-radius: 9px`, `gap: 7px`; vybraná dlaždica má
  `box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px <hex>` a biely ✓ `13px/800`
  (biely znak je zároveň skúškou čitateľnosti)
- Hexy (presne ako `PALETTE` v `ColorSelect.tsx`):
  `#232a35 #1f4ed8 #0e7490 #047857 #4d7c0f #b45309 #b91c1c #9f1239 #6d28d9 #334155`
- „Vlastná hodnota": pole `170px`, monospace `13px`, placeholder `#1f4ed8`
- Náhľad: `padding: 10px`, `background: var(--bg)`, `border-radius: 9px` — tlačidlo
  „Potvrdiť", chip „Filter", odkaz „odkaz" — všetko v aktuálnej farbe, takže dôsledok
  voľby je vidieť okamžite
- **Zmena farby prekresľuje celé UI naživo** (nastavuje CSS premenné na
  `document.documentElement`)

**Logo:** slot `96×96`, `border: 1px dashed var(--line)`, `border-radius: 11px`,
pruhované pozadie, monospace popis „logo 512×512"; tlačidlá „Nahrať logo" /
„Odstrániť" (hover `--bad-fg`). Text „PNG, JPEG alebo WebP, najviac 256 kB. V hlavičke
má 26 px — väčší súbor nič nepridá." zodpovedá `MAX_BYTES` a `ALLOWED_TYPES`
v `lib/branding.ts` — SVG zámerne nie.

**Organizácie v systéme:** tabuľka Organizácia / Domény / Osoby / Dokumenty / Farba;
hlavička ako v Knižnici, riadky `padding: 8px 14px`, farba ako `14×14/4px` vzorka +
monospace hex `11.5px` `--muted`.

---

### 8. Prihlásenie (`/sign-in`)

- `min-height: 100vh`, `display: flex; flex-wrap: wrap` — ľavý panel
  `flex: 1 1 420px` (formulár, `max-width: 360px`, `padding: 48px 24px`), pravý
  `flex: 1 1 380px` s obrázkom (`background: var(--surface-2)`,
  `border-left: 1px solid var(--line)`)
- Značka: `30×30/8px` v `--accent` s „C" + „Contineo" `15px/650`
- H1 „Opýtajte sa. Nehľadajte." `25px`, `line-height: 1.2`, `letter-spacing: -.02em`
  (headline z `docs/brand-messaging.md`); podtitul „Odpovede z obsahu vašej
  organizácie — s citáciou zdroja." `13.5px`, `--muted`, `max-width: 34ch`
- Pole e-mail `38px`, primárne „Pokračovať" `38px` na celú šírku, oddeľovač „alebo"
  (`1px` linky + `11.5px`), sekundárne „Prihlásiť sa firemným kontom"
- Pod tým `11.5px` `--muted`: „Prístup je viazaný na domény vašej organizácie.
  Bez prihlásenia vidíte len verejné dokumenty." (`lib/customerDomains.ts`,
  `accessLevel: public`)
- Obrázkový slot `aspect-ratio: 4/3`, pruhované pozadie, monospace popis
  „obrázok tenanta / foto sídla 1200×900" — **doplniť reálny obrázok, nekresliť SVG**

---

## Interactions & Behavior

- **Navigácia:** prepínanie obrazoviek; v produkcii to sú routy
  (`/`, `/library`, `/library/[id]`, `/search`, `/library/new`, `/organisation`,
  `/sign-in`) — nie klientský state.
- **Prepínač organizácie:** mení názov, iniciálu a hlavnú farbu. Zatvára sa klikom mimo.
- **Facety a chips:** každý klik prepína hodnotu, zoznam sa filtruje okamžite, chip sa
  pridá/odoberie. „Zrušiť" vyprázdni všetky facety, multiselecty aj fulltext.
- **Triedenie:** klik na hlavičku stĺpca; druhý klik obráti smer (`↑`/`↓`).
  Textové stĺpce triediť `localeCompare(…, "sk")` — inak sa diakritika zoradí zle.
- **Označovanie riadkov:** checkbox na riadku, hlavičkový checkbox označí/odznačí
  všetko viditeľné (stav „–" pri čiastočnom výbere); pri ≥ 1 označenom sa zjaví panel
  hromadných akcií.
- **Query builder:** pridávanie/odoberanie podmienok, prepínanie AND ↔ ALEBO
  (prvá spojka je „KDE" a nekliká sa), živý monospace náhľad dotazu.
- **Multiselect:** viď klávesnicu vyššie. Ponúka aj hodnoty, ktoré má záznam, ale
  v organizácii ich už nikto iný nemá — inak by sa uložením ticho stratili
  (rovnaká logika ako `TagSelect.tsx`).
- **Potvrdenie prečítania:** tlačidlo prepne na „✓ Potvrdené <dátum>" v zelenej.
  V produkcii `components/AcknowledgeButton.tsx` + `ReadingTimer.tsx`.
- **Animácie:** jediný keyframe `cnt-in` — `opacity 0→1`, `translateY(4px)→0`,
  `.12s ease-out`; použitý na dropdowny, query builder a panel hromadných akcií.
  Nič iné sa nehýbe — je to pracovný nástroj.
- **Hover stavy:** riadky `background: var(--bg)`; karty a dlaždice
  `border-color: var(--accent)`; tiché tlačidlá `background: var(--surface-2)`;
  primárne `background: var(--accent-strong)`.
- **Focus:** `border-color: var(--accent)` +
  `box-shadow: 0 0 0 3px var(--accent-soft)` na všetkých vstupoch. Doplniť viditeľný
  `:focus-visible` aj na tlačidlá a riadky tabuľky — prototyp to nemá dotiahnuté.
- **Loading / error / empty:** prototyp neukazuje. Použiť existujúce vzory —
  `components/Notice.tsx` na správy a chyby, prázdny zoznam ako `.karta`
  s `padding: 20px` a textom „Nič sa nenašlo" / „Knižnica je prázdna"
  (`library/page.tsx` to už rieši).
- **Responsive behavior:** návrh je fluidný, **bez media queries** — `flex-wrap`,
  `grid-template-columns: repeat(auto-fit, minmax(…, 1fr))` a `overflow-x: auto`
  na tabuľke. Panel filtrov sa na úzkom viewporte zabalí nad zoznam.
  *Na mobile doplniť:* filtre do zásuvky (drawer) alebo `<details>`, prepnutie
  tabuľky na kartový pohľad pod ~640 px, bočnú navigáciu na spodnú lištu, a hit
  targety min. 44 px (prototyp má 26–34 px, čo je pre desktop v poriadku, pre dotyk nie).

## State Management

Prototyp drží všetko v jednej komponente. V produkcii rozdeliť:

**URL (zdroj pravdy pre zoznam — zachovať dnešný `normalizeQuery`)**
`search`, `status`, `folder`, `category`, `language`, `accessLevel`, `tag`,
`sort`, `dir`, `page` — aby sa pohľad dal poslať odkazom a fungoval bez JS.

**Server (Next.js server komponenty / server actions)**
- zoznam dokumentov `libraryList()`, priečinky `allFolders()`/`counts()`
- číselníky `codelistOptions()` + `tenantExtras()`
- tenant `resolveTenant()` a `brandingView()`
- potvrdenia `lib/acknowledgements.ts`, audit `lib/audit.ts`

**Klient (lokálny UI state)**
- `view: "table" | "cards"`, `sel: string[]` (označené riadky),
  `builderOpen: boolean`, `conds: {field, op, value, join}[]`,
  `tenantsOpen`, `facetQuery`, otvorenosť jednotlivých multiselectov,
  `docTab`, `scopes: string[]`
- Multiselect: `open`, `query`, `chosen: string[]`, `extra` (novo napísané hodnoty)

**Preferencie (uložiť na osobu alebo organizáciu)**
`layout: "sidebar" | "topbar"`, `density: "compact" | "comfortable"`,
uložené pohľady.

## Design Tokens

Prevzaté 1:1 z `app/src/app/globals.css` — **nezavádzať nové farby.**

**Svetlá téma**
```
--bg: #f5f6f8        --surface: #ffffff    --surface-2: #eceef1
--ink: #161b22       --muted: #5c6675      --line: rgba(20,28,42,.12)
--accent: <farba tenanta, default #1f4ed8>
--accent-strong: <accent × 0.76>       --on-accent: #ffffff
--accent-soft: <accent @ 11 % alfa>    ← NOVÝ token, viď nižšie
--ok-bg: #ecfdf5     --ok-fg: #047857
--bad-bg: #fef2f2    --bad-fg: #b91c1c
--warn-bg: #fffbeb   --warn-fg: #b45309
--radius: 12px       --radius-lg: 18px
--shadow: 0 1px 2px rgba(20,28,42,.05), 0 10px 30px rgba(20,28,42,.07)
```
**Pozor — oprava po kontrole kódu:** tmavá téma NIE je na `prefers-color-scheme`, ale na
`html[data-theme="dark"]`. Každý nový token treba pridať do **oboch** blokov —
`:root` aj `html[data-theme="dark"]`. Návrh tmavú tému neporušuje (používa len tokeny),
ale prejsť ju po implementácii.

**Oprava:** `--accent` je v `globals.css` `#232a35` (tmavá neutrálna), nie `#1f4ed8`.
`#1f4ed8` je len farba ukážkového tenanta v prototype. Default sa **nemení** — modrá
prichádza výhradne z `branding.accentColor` konkrétnej organizácie.

**Nové tokeny, ktoré treba pridať do `globals.css`**
```
--accent-soft   accent s ~11 % alfou   ← jediný nový farebný token (chips aktívnych filtrov, aktívna položka
                navigácie, označený riadok tabuľky)
--pad-main      16px kompaktne / 28px vzdušne
--card-pad      16px / 24px
--list-py       9px / 14px
--gap           14px / 20px
--row-py        7px / 12px
--font-row      13px / 14px
```
Hustota (`density`) je len prepnutie týchto šiestich premenných na `:root` —
žiadne duplikované triedy.

**Ako sa nastavuje farba tenanta** (rovnaký vzor ako `TenantHeader.tsx → tenantStyle()`)
```
--accent        = branding.accentColor
--accent-strong = darken(branding.accentColor, 0.16)   // existujúca funkcia, NEMENIŤ
--accent-soft   = rgba(r, g, b, .11)
```
**Oprava:** `tenantStyle()` používa `darken(hex, 0.16)`. Prototyp mal 0.24 — to bola
chyba návrhu, nie zámer. Ostať na **0.16**: zmena koeficientu by potichu prekreslila
hover stavy u všetkých existujúcich tenantov.
Prototyp ich nastavuje na `document.documentElement`; v Next.js ich radšej dať ako
inline `style` na obal (server render, bez bliknutia) — presne ako `tenantStyle()`
robí dnes. `darken()` a `soft()` sú v `Contineo Intranet.dc.html`, funkcia `darken`
už existuje v `TenantHeader.tsx` — použiť tú.

**Typografia**
```
font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial,
             sans-serif                          (bez zmeny, z globals.css)
mono:        ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
             (identifikátory, hexy, technické popisy)

10.5px / 650 / .06em / uppercase   hlavičky tabuliek, drobné nadpisy sekcií
11px    / 650 / .06em / uppercase  popisky polí, labely
11.5px  / 400–600                  meta, počty, chips
12.5px  / 400–550                  sekundárny text, bunky tabuliek
13px    / 500–600                  základ UI, navigácia, riadky
13.5px  / 550–650                  nadpisy kariet, tlačidlá
14.5px  / 400 / 1.65               text odpovede RAG
19px    / 600 / -.02em             H1 obrazovky
22px    / 600 / -.02em / 1.25      H1 detailu dokumentu
25px    / 640 / -.03em             čísla v KPI
```
Čísla vždy `font-variant-numeric: tabular-nums`. Dlhé texty `text-wrap: pretty`.

**Spacing:** 2 · 4 · 5 · 6 · 7 · 9 · 10 · 11 · 12 · 13 · 14 · 16 · 18 · 20 · 24 · 28
(px). Rádiusy: 4 · 5 · 6 · 7 · 8 · 9 · 10 · 11 · 12 (`--radius`) · 20 (pilulky) ·
50 % (avatáry). Výšky kontroliek: 26 · 29 · 30 · 32 · 33 · 38 · 40.

**Kontrast:** všetky stavové chips sú plnou farbou na svetlom podklade (≥ 4.5:1).
`--muted` na `--surface` je ~5.2:1. Pri vlastnej farbe tenanta mimo palety kontrast
negarantujeme — preto je paleta pevná a vlastná hodnota je vedomý krok.

## Texty a lokalizácia (povinné)

`CLAUDE.md` v repozitári zakazuje text natvrdo v komponente — všetko ide cez
`lib/i18n.ts` v `sk` / `cs` / `en`. Ten súbor má ~5 200 riadkov a každý kľúč sa dopĺňa
na štyroch miestach (interface + tri jazyky).

Všetky slovenské texty v tomto README sú preto **zadanie pre `sk` vetvu**, nie kód.
Praktický postup, aby to nebolo 200 samostatných úprav:

1. Najprv doplniť **celý interface** pre novú sekciu naraz (napr. `nav`, `libraryList`,
   `multiSelect`, `queryBuilder`, `upload`, `settings.branding`).
2. Potom `sk` (texty sú v tomto README), potom `cs` a `en` ako jeden blok na sekciu.
3. Kľúče držať v rovnakom poradí vo všetkých troch jazykoch — inak sa chýbajúci
   preklad nedá nájsť očami.
4. Sekcie robiť v poradí implementácie (nav → knižnica → multiselect → nahrávanie →
   nastavenia), nie všetky naraz.

Odhad: je to väčšia časť práce než samotné UI. Neobchádzať to — nekonzistentný
jazyk je v multitenant portáli viditeľná chyba.

## Assets

Prototyp neobsahuje žiadne bitmapy ani vlastné SVG kresby.
- **Ikony navigácie** sú zastupujúce textové znaky (▦ ▤ ⌕ ↑ ▪ ⚙ ⠿ ✓ ×) —
  nahradiť ikonovým setom projektu (SVG, `currentColor`, 16 px).
- **Značka Contineo** je v `components/ContineoMark.tsx` — použiť ju, nekresliť novú.
- **Logo tenanta** sa servíruje z `/api/brand/<companyCode>?v=<version>`
  (`lib/branding.ts`).
- **Dva obrázkové sloty** (prihlásenie 1200×900, logo 512×512) sú pruhované
  placeholdery — doplniť reálne materiály.

## Files

| Súbor | Čo obsahuje |
| --- | --- |
| `Contineo Intranet.dc.html` | všetkých 7 obrazoviek, app shell, oba varianty navigácie, tokeny, dáta ukážky |
| `MultiSelect.dc.html` | multiselect s vyhľadávaním, chips, klávesnicou a pridávaním hodnôt |
| `support.js` | runtime prototypu — **do produkcie nepatrí** |
| `github.md` | mapa obrazovka → zdrojové súbory v repozitári |

Otvorte `Contineo Intranet.dc.html` v prehliadači; navigácia je klikateľná,
filtre, triedenie, označovanie riadkov aj multiselecty sú funkčné.
Variant navigácie a hustotu prepnete v paneli Tweaks (`layout`, `density`,
`accent`, `tenantName`).

## Ako to dostať do repozitára — návrh postupu

1. **Tokeny** — do `app/src/app/globals.css` pridať `--accent-soft` a šesticu
   premenných hustoty (svetlá aj tmavá téma). Nič nemazať.
2. **App shell — NEMENIŤ `layout.tsx` globálne.** `layout.tsx` obaľuje `.obal`
   (max 900 px) všetky stránky — `/documents`, `/hr`, `/people`, `/admin`,
   `/golden-set`, `/library` — a tie sú na tú šírku stavané. Globálna zmena ich
   rozbije všetky naraz.

   Namiesto toho: pridať `components/AppShell.tsx` (header s prepínačom organizácie +
   globálne pole + `AppNav` s variantmi `sidebar`/`topbar`) ako **opt-in obal**, ktorý
   si stránka vyžiada sama. `layout.tsx` zostáva ako je. Prvá a jediná stránka
   v shelli je `/library` (krok 4) — tam sa shell overí na reálnom obsahu.
   Ostatné stránky sa presúvajú až potom, jedna po druhej, každá s vlastným PR.
   Kým je stránka mimo shellu, funguje presne ako dnes.
3. **MultiSelect** — nový `components/MultiSelect.tsx` podľa `MultiSelect.dc.html`,
   s `<noscript>` fallbackom a klávesnicou ako `Select.tsx`. Nasadiť na útvary,
   štítky, osoby, typy dokumentov a stav workflow.
4. **Knižnica** — `app/src/app/library/page.tsx`: doplniť faceted panel, chips,
   query builder, tabuľkový/kartový pohľad, triedenie a hromadné akcie.
   Filtre nechať v URL (`normalizeQuery` + `withFilter`).
5. **Detail, nahrávanie, vyhľadávanie** — doplniť layouty a pravý panel;
   znovupoužiť `Answer.tsx`, `AcknowledgeButton.tsx`, `Rating.tsx`.
6. **Nastavenia** — `ColorSelect.tsx` obohatiť o živý náhľad; slot na logo napojiť
   na `saveBrand()`.
7. **Na konci** — prejsť tmavú tému, `:focus-visible`, mobilný režim
   (drawer + karty + 44 px hit targety) a `<noscript>` cesty.

Odporúčam brať to po krokoch 1–3 v jednom PR (základ), potom 4 samostatne
(najväčší kus), 5–6 v treťom.
