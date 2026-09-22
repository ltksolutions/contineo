# ZAKLAD.md — spoločný základ rozhrania

**Pre Cowork. Toto je PR 0: implementuje sa PRVÝ a všetky obrazovky sa naň už
len odkazujú.** Keď v `<OBRAZOVKA>.md` čítaš „tlačidlo primárne" alebo
„stavová pilulka", hodnoty sú tu, nie tam.

Statická vizuálna referencia: `ZAKLAD.html` — otvor v prehliadači, nepotrebuje
nič ďalšie. Sú v nej všetky komponenty vo všetkých stavoch, v svetlej aj tmavej
téme.

---

## Čo je v repozitári UŽ HOTOVÉ — nerob znova

Prečítal som `app/src/app/globals.css` (4221 riadkov) k 21. 9. 2026.
**Väčšina základu existuje.** Čísla sú skutočné riadky.

| Komponent | Trieda | Riadok | Stav |
| --- | --- | --- | --- |
| Farebné tokeny, svetlá téma | `:root` | 10 | ✅ |
| Farebné tokeny, tmavá téma | `html[data-theme="dark"]` | 120 | ✅ |
| `--accent-soft` (accent @ 11 %) | `:root` + tmavá | 66, 156 | ✅ |
| Hustota — 6 premenných | `html[data-density="comfortable"]` | 168 | ✅ |
| Typografická stupnica `--fs-*` | `:root` | 100–113 | ✅ |
| `--control-h: 40px` | `:root` | 114 | ✅ |
| `--fs-control` 16 → 15 px od 640 | `@media` | 118 | ✅ |
| Tlačidlo primárne + hover + focus | `.button` | 697 | ✅ |
| Tlačidlo sekundárne | `.button--quiet` | 724 | ✅ |
| Textové pole + focus | `.field-input` | 767 | ✅ |
| Natívny `<select>` s chevronom | `select.field-input` | 795 | ✅ |
| Vlastný rozbaľovací výber | `.select` | 820 | ✅ |
| Stavová pilulka + 5 variantov | `.tag`, `.tag--*` | 627, 647 | ✅ |
| Pásik potvrdení + 3 prahy | `.ack-bar`, `.ack-fill--*` | 2675 | ✅ |
| Checkbox výberu (22 px na karte) | `.bulk-pick`, `.bulk-pick-box` | 2439 | ✅ |
| Chip filtra s × | `.library-chip` | 2812 | ✅ |
| Facet ako riadok / ako pilulka | `.facet`, `.filter-sheet .facet` | 1924, 2777 | ✅ |
| Tabuľka — hlavička, riadok, hover | `.doc-table` | 2008 | ✅ |
| Karta dokumentu | `.doc-card` | 2622 | ✅ |
| Hláška | `.notice`, `.notice--error` | 490, 514 | ✅ |
| Nadpis a úvodný odsek obrazovky | `.page-title`, `.page-lead` | 672, 679 | ✅ |
| Hlavička obrazovky s akciami | `.page-head` | 686 | ✅ |
| Ponuka „⋯" | `.page-more` | — | ✅ |
| Prepínač pohľadu | `.view-switch` | 2755 | ✅ |
| Spoločný `:focus-visible` cez `:where()` | — | ~3107 | ✅ |
| Dotykové ciele 44 px pod 640 | `@media` | 4112 | ✅ |
| Breakpointy len 640 / 1024 | celý súbor | — | ✅ |
| Ikony na mriežke 18×18 | `Icon.tsx` | — | ✅ |
| Značka Continea | `ContineoMark.tsx` | — | ✅ |

**Z toho vyplýva:** PR 0 nie je „postav základ", ale **„dopln štyri chýbajúce
prvky a zjednoť tri odchýlky"**. Nič z tabuľky vyššie neprepisuj.

---

## Úloha 1 — Prázdny stav ako komponent

**Teraz:** každá obrazovka si prázdno píše sama. `/library` má `.karta`
s odsekom, `/documents` vetu v `.quiet`, `/approvals` nič — pri prázdnom
zozname zostane len nadpis a pod ním biela plocha.

**Má byť:** jedna trieda, tri časti — čo tu nie je, prečo, a čo s tým.
Prázdno nie je chyba; je to stav, ktorý má povedať, či je zoznam prázdny
preto, že filter nič nenašiel, alebo preto, že v knižnici nič nie je.
To sú dve rôzne vety a dnes sa nedajú rozoznať.

```css
.empty {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 32px 20px;
  border: 1px dashed var(--line);
  border-radius: var(--radius);
  text-align: center;
}
.empty-title { font-size: var(--fs-lead); font-weight: 600; }
.empty-text {
  font-size: var(--fs-small);
  color: var(--muted);
  line-height: 1.55;
  max-width: 46ch;
}
.empty-action { margin-top: 10px; }
```

Bez ikony a bez ilustrácie. Prázdny zoznam je bežný stav pracovného nástroja,
nie udalosť, ktorú treba ozdobiť.

**Dva texty, nie jeden** — rozhoduje, či je nasadený filter:
- filter aktívny → „Filtru nič nevyhovuje" + tlačidlo `.button--quiet`
  „Zrušiť filtre" (odkaz na `clearFilters`)
- filter neaktívny → „V knižnici zatiaľ nič nie je" + primárna akcia obrazovky
  („Nahrať dokument"), alebo bez akcie tam, kde človek nemá čo urobiť

i18n: `common.empty.filtered`, `common.empty.none` + per-obrazovkové texty.

## Úloha 2 — Stránkovanie ako komponent

**Teraz:** `/library` má pätičku tabuľky s počtami a dvomi odkazmi,
napísanú priamo v `page.tsx`. Ostatné zoznamy stránkovanie nemajú vôbec —
`/directory` a `/people` vypíšu všetkých.

**Má byť:** jedna trieda, použiteľná pod tabuľkou aj pod kartami.

```css
.pager {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: var(--bg);
  border-top: 1px solid var(--line);
  font-size: var(--fs-micro);
  color: var(--muted);
}
.pager-count { font-variant-numeric: tabular-nums; }
.pager-spacer { flex: 1; }
.pager-link { min-height: 28px; padding: 0 10px; }      /* .button--quiet */
.pager-link[aria-disabled="true"] { opacity: .45; pointer-events: none; }
```

Pod 640 px `.pager-link` dostane 44 px (spoločné pravidlo na riadku 4112
rozšír o `.pager-link`).

**Text vľavo je „Zobrazené 1–8 z 24", nie „Strana 1 z 3".** Číslo strany
nehovorí nič o tom, koľko toho je; rozsah áno. Neaktívny odkaz zostáva
odkazom s `aria-disabled`, nie `<button disabled>` — stránkovanie musí
fungovať bez JavaScriptu.

## Úloha 3 — Vypnutý stav ovládačov

**Teraz:** `.button` má `:hover:not(:disabled)`, ale `:disabled` sám nič
nemení. Vypnuté tlačidlo vyzerá ako zapnuté a zistí sa to až kliknutím.

**Má byť:**

```css
.button:disabled,
.button[aria-disabled="true"] {
  opacity: .5;
  cursor: not-allowed;
}
.field-input:disabled {
  background: var(--surface-2);
  color: var(--muted);
  cursor: not-allowed;
}
```

`opacity`, nie vlastná sivá farba: tlačidlo si drží tenant farbu, takže
vypnuté „Schváliť" je rozoznateľné od vypnutého „Zmazať". Sivá by z oboch
urobila to isté tlačidlo.

**`aria-disabled` je tam preto**, že odkaz sa `disabled` atribútom vypnúť
nedá a stránkovanie aj nepovolené akcie sú odkazy.

## Úloha 4 — Označený riadok tabuľky má okraj, nie len pozadie

**Teraz:** označený riadok má `background: var(--accent-soft)` (PR 8).
V tmavej téme je to `rgba(238,241,245,.11)` — proti `--surface` `#161b22`
rozdiel, ktorý pri jednom riadku medzi neoznačenými nie je vidieť.

**Má byť:** k pozadiu ešte ľavý pruh 3 px v `--accent`.

```css
.doc-table tbody tr.is-picked { background: var(--accent-soft); }
.doc-table tbody tr.is-picked td:first-child {
  box-shadow: inset 3px 0 0 var(--accent);
}
```

`box-shadow: inset`, nie `border-left` — okraj by riadok posunul o 3 px
a stĺpce by sa medzi označeným a neoznačeným riadkom rozišli.

Karta má `border-color: var(--accent)` (PR 8, ponechať) — celý rám tam
funguje, lebo karty stoja v mriežke a rám nič neposúva.

---

## Úloha 5 — Pravý stĺpec tabuľky: hlavička sa rozchádza s dátami

**Teraz:** `globals.css:2089` definuje `.doc-col-right { text-align: right }`
ako holú triedu. Špecificita (0,1,0) prehrá s `.doc-table th` (0,1,1) na
riadku ~2030, ktoré nastavuje `text-align: left`.

Dôsledok: v knižnici má stĺpec **„Zmenené" hlavičku vľavo a dátumy vpravo**.
`<td>` zarovnanie dostane (nemá proti sebe type-qualified pravidlo), `<th>`
nie. Je to jediný pravý stĺpec v rozhraní, takže si to nikto nevšimol.

**Má byť** — jedna deklarácia:

```css
.doc-table th.doc-col-right { text-align: right; }
```

Type-qualified selektor je tu **nutný**, nie štýl: bez `th` v selektore
špecificita nestačí. `!important` netreba a nepatrí tam.

Overiť v `/library` v tabuľkovom pohľade — hlavička „Zmenené" má sedieť nad
dátumami, nie vľavo od nich.

## Tri odchýlky na zjednotenie

Nie sú to nové komponenty, ale rozdiely, ktoré sa v rozhraní vidia.

### A. Pole hľadania má dve výšky

`--control-h` je **40 px**, ale pole v hlavičke a pole hľadania v knižnici
majú **36 px r9** (PR 3 a PR 8, správne — sedia so 28 px logom v 56 px páse).

**Nechaj obe, ale pojmenuj to.** Zaveď druhý token, aby to bol zámer a nie
náhoda:

```css
:root { --control-h-sm: 36px; }
```

a v `.header-ask` aj `.library-search-input` použi `var(--control-h-sm)`
namiesto natvrdo napísaných 36 px. Tretia výška nesmie vzniknúť.

Pravidlo: **36 px = pole v páse (hlavička, lišta zoznamu), 40 px = pole vo
formulári.** Formulár sa vypĺňa, pás sa používa.

### B1. Odznak upozornení: text z `--on-accent`, nie `#fff`

Zvonček nesie skutočný počet (PR 7), takže odznak má číslo, ktoré sa musí dať
prečítať. Pozadie je `var(--bad-fg)` — a to je **foreground token**: v svetlej
téme `#b91c1c`, v tmavej `#fca5a5`, teda svetlý odtieň určený na tmavý
podklad. S natvrdo napísaným `color: #fff` má odznak v tmavej téme kontrast
**1,90 : 1** a číslo v ňom nie je vidieť.

```css
/* nie #fff */
color: var(--on-accent);
```

`--on-accent` je `#ffffff` v svetlej (6,47 : 1) a `#11151c` v tmavej
(≈ 9 : 1). Pozadie sa nemení a nová farba sa nezavádza.

Pravidlo pre celé rozhranie: **na farebnom podklade nikdy `#fff` natvrdo** —
vždy `var(--on-accent)`, inak sa pri prepnutí témy pár farieb prevráti.
Platí pre odznak v zvončeku, odznak „Úlohy" v spodnej lište aj pás hromadných
akcií.

### B. Ikona v poli podľa toho, čo pole robí

⚠️ **Opravené 22. 9. 2026 — pôvodné pravidlo bolo prehnané a zlé.**

Písal som „každé pole nesie značku Continea, nikdy lupu". Dve veci na tom
neplatia:

1. **Tie polia nerobia to isté.** Pole v hlavičke (*„Opýtajte sa svojich
   dokumentov"*) ide na model — tam lupa klame. Pole v knižnici, adresári
   a osobách (*„názov alebo kľúč"*) hľadá reťazec v zozname — **tam je lupa
   vecne správna** a značka mätie.
2. **Značka pri 16 px vyzerá ako lupa.** `ContineoMark` je kružnica s dvoma
   bodkami a chvostíkom; v malom je z toho krúžok s rúčkou a bodky splynú
   s odleskom skla. Úloha sa dá splniť a výsledok aj tak povie „lupa".

Platné pravidlo:

| Pole | Ikona |
| --- | --- |
| hlavička — otázka pre model | `ask` z `Icon.tsx` (bublina reči, tá istá ako v navigácii) |
| knižnica, adresár, osoby — hľadanie v zozname | lupa |

`ContineoMark` sa **pri 16 px nepoužíva**. Značku neprekresľuj — jedna
značka, a v malom má miesto logo (28 px), nie ikona v poli.

### C. Rádiusy: 10 je základ, 12 je karta

V kóde je `.button` r10, `.field-input` r10, `--radius` 12px, `.tag` 999px.
To je konzistentné — **nemeň to.** V mockoch som miestami kreslil r9 a r11;
platí kód, nie mock.

---

## Pravidlá, ktoré platia v každom PR

- **Žiadny text natvrdo.** Všetko cez `lib/i18n.ts`, tri jazyky (sk/cs/en).
  Interface sekcie najprv celý, potom jazyky ako blok.
- **Nič nevyžaduje JavaScript.** Filtre a výber sú odkazy, formuláre sú
  `<form>`, stav nesie adresa. `normalizeQuery` a `toQuery` sa nemenia.
- **Breakpointy len 640 a 1024** (`max-width` tvary 639/1023). Mobile first.
- **`--accent` ostáva `#232a35`, `darken(hex, 0.16)` ostáva.** Tenant farbu
  skladá `tenantStyle()`.
- **`layout.tsx` sa bez Jánovho súhlasu nemení.**
- **Nové tokeny vždy do `:root` aj do `html[data-theme="dark"]`.**
  Výnimka: hustota a typografia sú od témy nezávislé a v tmavom bloku sa
  zámerne neopakujú (dôvod je v komentári na riadku 92).
- **Overenie pred commitom:** `npx tsc --noEmit`, `npx eslint .`,
  `npx vitest run`, `npm run build`.

## Poradie a commity

Jeden commit na úlohu, päť úloh + tri odchýlky = jeden PR.
Úlohy 1 a 2 sú nezávislé, začni nimi. Úloha 4 sa overuje v tmavej téme,
úloha 5 je jednoriadková a dá sa spraviť prvá.

Po dokončení prejdi knižnicu a prehľad v **tmavej téme** — úlohy 3 a 4 sú
tam najrizikovejšie.
