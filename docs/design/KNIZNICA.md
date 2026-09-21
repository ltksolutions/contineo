# Handoff — Knižnica dokumentov (`/library`)

**Pre Cowork. Samostatné zadanie, nezávislé od ostatných PR.**

Vizuálnym zdrojom bol `Contineo Obrazovky.dc.html`, sekcia `#s-kniznica`
(štyri rámy: Desktop 1440, Tablet 834, Telefón 390, Telefón 390 so sheetom
filtrov) — súbor z repozitára odišiel pri výmene handoffu 2026-09-21.
Zadanie je **hotové** (PR 8, 2026-09-21) a ostáva ako archív.

---

## Čo je v repozitári UŽ HOTOVÉ — nerob znova

Prečítal som `app/src/app/library/page.tsx` (954 riadkov) a `globals.css`.
Tieto veci existujú a **fungujú podľa návrhu**:

| Vec | Kde |
| --- | --- |
| Mriežka `250px 1fr` od 1024 px | `.library-grid` (globals.css:1824) |
| Panel filtrov ako stĺpec, pod 1024 px skrytý | `.library-folders` (1841) |
| Zásuvka filtrov `<details>` ukotvená dole | `.filter-sheet` (2744) |
| Facety ako pilulky 36 px v zásuvke | `.filter-sheet .facet` (2777) |
| Facety ako checkbox riadky v stĺpci | `.facet` (1924) |
| „Zobraziť N dokumentov" dole v zásuvke | `.filter-sheet-apply` (2789) |
| Chips aktívnych filtrov s × | `.library-chips` (2804) |
| Query builder s AND/ALEBO | `libraryConditions.ts`, page.tsx:623 |
| Hromadné akcie len pri `picked.length > 0` | page.tsx:677 |
| Prepínač Tabuľka / Karty ako odkazy v URL | `.view-switch`, page.tsx:404 |
| `auto` pohľad — karty pod 1024, tabuľka nad | `.doc-view-auto` (2001) |
| Sekundárne akcie v ponuke „⋯" | `.page-more`, page.tsx:432 |
| Správa priečinkov na `/library/folders` | page.tsx:365 |
| Dotykové ciele 44 px pod 640 px | globals.css:4113 |
| Breakpointy zjednotené na 640 / 1024 | celý globals.css |
| MultiSelect pre štítky | page.tsx:303 |

**Nezavádzaj nové breakpointy** a nepridávaj `overflow-x` na navigáciu.

---

## Čo CHÝBA — päť úloh

### 1. Stavová pilulka má farbu podľa stavu

**Teraz:** `<span className="tag">` — všetky stavy sivé (`globals.css:627`).
V tabuľke aj na kartách vyzerá „Expirovaný" rovnako ako „Platný".

**Má byť:** farba nesie význam, lebo v zozname 148 dokumentov je stav to prvé,
čo človek hľadá. Pridaj varianty k `.tag`:

```css
.tag--published { background: var(--ok-bg); color: var(--ok-fg); }
.tag--draft     { background: var(--warn-bg); color: var(--warn-fg); }
.tag--review    { background: var(--accent-soft); color: var(--accent-strong); }
.tag--expired   { background: var(--bad-bg); color: var(--bad-fg); }
.tag--archived  { background: var(--surface-2); color: var(--muted); }
```

Rozmery zostávajú: `11.5px/600`, `padding: 2px 7px`, `border-radius: 5px`.
Mapovanie rob z `r.status` / `r.processingState` — jedna čistá funkcia
`statusTagClass(status)` v `lib/libraryRead.ts` alebo vedľa v page.tsx,
nie ternárny výraz v JSX.

**Doplň do oboch tém.** `--bad-bg`/`--bad-fg` skontroluj — ak v
`html[data-theme="dark"]` chýbajú, pridaj ich.

### 2. Potvrdenia ako pásik, nie text v zátvorke

**Teraz:** `68 % (142 z 210)` ako súčasť `.doc-meta` — text, ktorý treba
prečítať, aby sa dal porovnať s riadkom nad ním.

**Má byť:** vodorovný pásik + percento vpravo. Dôvod: v tabuľke je to stĺpec,
ktorý sa skenuje očami zhora dolu — 8 čísel v texte sa neskenuje, 8 pásikov áno.

```css
.ack-bar { display: flex; align-items: center; gap: 6px; min-width: 104px; }
.ack-track {
  flex: 1; height: 5px; border-radius: 3px;
  background: var(--surface-2); overflow: hidden;
}
.ack-fill { display: block; height: 100%; }
.ack-fill--high { background: var(--ok-fg); }   /* ≥ 90 % */
.ack-fill--mid  { background: var(--accent); }  /* ≥ 50 % */
.ack-fill--low  { background: var(--warn-fg); } /* < 50 % */
.ack-value { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
```

Šírku výplne dávaj inline (`style={{ width: \`${percent}%\` }}`) — je to dátová
hodnota, nie štýl. Keď `percent === null` (dokument nikomu nepridelený),
vykresli `—` v `.quiet`, nie prázdny pásik: prázdny pásik znamená „nikto
nepotvrdil", pomlčka znamená „nie je čo potvrdzovať". To je rozdiel.

Text pre čítačku ponechaj: `<span className="sr-only">{t.acknowledgedOf(a, b)}</span>`.

Nasaď **v tabuľke aj na kartách** (v karte je pásik posledný riadok).

### 3. Pole hľadania nesie značku Continea

**Teraz:** `.library-search-input` je holý input.

**Má byť:** vľavo v poli značka Continea 16 px v `--muted`, ako v hlavičke.
Dôvod: v celom portáli platí jedno pravidlo — **každé vstupné pole nesie značku,
nie lupu.** Nie je to hľadanie v tabuľke, je to otázka položená obsahu.

Použi `<ContineoMark size={16} />` z `components/ContineoMark.tsx`
(už ho importuje `Header.tsx` aj `Footer.tsx`). Obal pole a značku do
`.library-search` s `display: flex; align-items: center; gap: 9px`
a značku daj `flex: 0 0 auto; color: var(--muted)`.

Výška poľa **36 px, `border-radius: 9px`** — rovnako ako pole v hlavičke.
Toto je jediný rozmer, na ktorom trvám: dve polia na tej istej obrazovke
v dvoch výškach vyzerajú ako nedorobok.

### 4. Hromadné akcie na telefóne nahradia spodnú lištu

**Teraz:** `.bulk-bar` je v toku stránky. Na 390 px je pod ňou ešte spodná
navigačná lišta — dva pásy nad sebou, oba tvrdia, že sú dôležité.

**Má byť:** pod 640 px je `.bulk-bar` `position: fixed` na spodku, v
`--accent`, a **spodná lišta sa skryje**, kým je niečo označené.

```css
@media (max-width: 639px) {
  .bulk-bar {
    position: fixed; inset: auto 0 0 0; z-index: 40;
    border-radius: 0;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  }
  body:has(.bulk-bar) .app-nav-bottom { display: none; }
}
```

`:has()` funguje vo všetkých cieľových prehliadačoch; ak by bol problém,
daj `AppShell` prop `hasSelection` z `filters.picked.length > 0` — knižnica
ho vie, je to server komponent.

Akcie v pásme: **Presunúť**, **Vyžiadať potvrdenie**, **×** (zrušiť výber).
Na 390 px sa tretia akcia nezmestí — nechaj tie dve a zvyšok neskrývaj do „⋯",
radšej ho tam nedávaj vôbec. Výška tlačidiel 40 px.

Zoznam musí mať `padding-bottom` aspoň 84 px, aby posledná karta nezostala
pod pásom.

### 5. Karta dokumentu: stav a kategória do jedného riadku

**Teraz:** `.doc-card-top` má výber, `.tag` processing state, `.tag` draft
a kategóriu — štyri prvky, ktoré sa na 390 px lámu.

**Má byť** (podľa rámu Telefón 390):
- prvý riadok: **stavová pilulka** (farebná, úloha 1) · kategória v `--muted` ·
  `flex: 1` · **verzia** vpravo
- názov `15px/600`, `line-height: 1.3`, `text-wrap: pretty`, tri riadky miesta
- pod ním `12px` `--muted`: `internalNumber · priečinok`
- posledný riadok: **pásik potvrdení** (úloha 2)

Výber (`.bulk-pick`) presuň **vľavo mimo obsahu** — `22×22` checkbox
v samostatnom stĺpci karty, ako v rámoch. Karta je `display: flex; gap: 12px`.

Označená karta: `background: var(--accent-soft)`, `border-color: var(--accent)`.

---

## Prierezové pravidlá

**i18n** — žiadny text natvrdo (`CLAUDE.md`). Nové kľúče do `lib/i18n.ts`
pod `library.list`, vo všetkých troch jazykoch (sk / cs / en). Doplň interface
najprv celý, potom jazyky ako blok.

**No-JS** — nič z tohto nevyžaduje JavaScript. Výber je odkaz (`togglePick`),
zásuvka je `<details>`, hromadné akcie sú formulár. Zachovaj to.

**Tmavá téma** — nové tokeny a varianty do `:root` **aj** do
`html[data-theme="dark"]`. Po dokončení prejdi knižnicu v tmavom režime;
farebné pilulky sú tam najrizikovejšie.

**`:focus-visible`** — nové interaktívne prvky (značka v poli nie je
interaktívna) musia mať viditeľný prstenec. Facety a triedenie ho už majú.

**Čo nemeniť:** `normalizeQuery` a `toQuery` — filtre zostávajú v URL, aby sa
pohľad dal poslať odkazom a fungoval bez skriptu. `--accent` ostáva `#232a35`.
`darken(hex, 0.16)` ostáva.

---

## Poradie

Úlohy 1 a 2 sú najviditeľnejšie a navzájom nezávislé — začni nimi.
Úloha 5 na nich stojí (potrebuje pilulku aj pásik), takže ju rob až po nich.
Úlohy 3 a 4 sa dajú robiť kedykoľvek.

Jeden commit na úlohu; celé to môže byť jeden PR.
