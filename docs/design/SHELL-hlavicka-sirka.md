# SHELL — šírka hlavičky

Referencia: `SHELL-hlavicka-sirka.html`. Základ: `ZAKLAD.md`, `SHELL-menu-v-hlavicke`. Zdroj: `components/Header.tsx` (`.header-row`), `globals.css` (`.header-row` ~296, `.header-search-wrap` ~375, `.wrap--shell` ~4894).

## Čo je zle

Snímka `uploads/Snímka obrazovky 2026-10-01 o 18.22.47.png` (`/dpo`, okno ~1010 px): cesta a obsah idú po pravý okraj `--shell-maxw`, hlavička končí avatarom o stovky px skôr. Strop majú všetky tri rovnaký (`.wrap--shell`, `.app-path-row`, `.app-main` = 1240 px). Chyba je vnútri riadka: `.header-search-wrap` má `max-width: 600px` a za ním nič neodtláča zvonček a avatar doprava. Platí na každej stránke.

## Čo sa mení

1. **Pole v strede** — dve medzery v `Header.tsx`, pred `<HeaderAsk>` a hneď za ním:
   ```tsx
   <span className="header-spacer" aria-hidden="true" />
   <HeaderAsk … />
   <span className="header-spacer" aria-hidden="true" />
   ```
   ```css
   .header-spacer { flex: 1 1 0; min-width: 0; }
   ```
   Prázdny prvok, nie `margin-left: auto` na zvončeku — rovnaký dôvod ako `.page-head-spacer` (zvonček a menu sa podľa stavu skrývajú). Pole drží `max-width: 600px`. Plachta otázky (`.ask-sheet--overlay`) je ukotvená k obalu poľa, ide s ním — overiť na 834 a 1440.
2. **Ikona menu lícuje s ľavým okrajom obsahu.** Tlačidlo plachty (`SectionsSheet`) má 36 px a glyf 18 px, glyf je teda o 9 px vpravo od cesty a nadpisu. Na tlačidlo `margin-left: -9px` (len ≥ 640 px, kde je v hlavičke). Plocha kliku sa nemení.

Pod 640 px: pole si šírku nepýta (existujúci blok), medzera dostane 0 — žiadna zmena.

## Rozhodnuté

- **Q1 — B, pole v strede** medzi značkou a zvončekom (1. 10. 2026). Mení polohu poľa zo `SHELL-menu-v-hlavicke` (tam vľavo pri značke).

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | dnes (s čiarami okrajov) a návrh |
| **834** | návrh |
| **390** | bez zmeny — nekreslí sa |

## Údaje, ktoré v modeli NEEXISTUJÚ

Žiadne. Len CSS a dva prázdne prvky. `layout.tsx` sa nemení.

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/SHELL-hlavicka-sirka.html + .md.
Vetva design/shell-hlavicka-sirka z main.

Chyba: v hlavičke končí avatar ďaleko pred pravým okrajom cesty a obsahu
(všetky majú strop --shell-maxw 1240 px). Príčina: .header-search-wrap má
max-width 600px a v .header-row nič neodtláča zvonček a avatar doprava.

1. Header.tsx: pred <HeaderAsk> a hneď za ním prázdny
   <span className="header-spacer" aria-hidden="true" /> — pole v strede
   (rozhodnuté Q1 B, 1. 10. 2026). Len pre prihláseného, rovnako ako HeaderAsk.
2. globals.css pri .header-row: .header-spacer { flex: 1 1 0; min-width: 0; }
   Prázdny prvok, nie margin-left: auto (vzor .page-head-spacer).
3. Tlačidlo plachty menu (SectionsSheet) od 640 px: margin-left: -9px, aby
   glyf 9 bodiek lícoval s cestou a nadpisom. Plocha kliku bez zmeny.
4. Pod 640 px sa nemení nič — over, že medzery majú 0 a riadok ostáva 56 px.

Over: plachta otázky (.ask-sheet--overlay) sa otvára pod poľom aj po
vycentrovaní, na 834 aj 1440; ⌘K; neprihlásený (len značka + téma) bez
medzier navyše. layout.tsx nemeniť. Pred commitom tsc, eslint, vitest, build.
Do komentára v Header.tsx odkaz na SHELL-hlavicka-sirka (Q1 B mení polohu
poľa zo SHELL-menu-v-hlavicke).
```
