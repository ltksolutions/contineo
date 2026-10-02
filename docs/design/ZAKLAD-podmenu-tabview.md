# ZAKLAD — podmenu sekcie ako SwiftUI TabView

Referencia: `ZAKLAD-podmenu-tabview.html`. Nadväzuje na `ZAKLAD-podmenu-a-akcie` (podmenu = `.tabs`) a `ZAKLAD-segmented-control` (pohľad = segmented). Podnet: používateľ 2. 10. 2026 — skúsiť podmenu v štýle SwiftUI TabView.

## Čo sa mení

Len vzhľad `.tabs` / `.tab` (ak vyhrá B). Značkovanie `<nav className="tabs">` + `TabLink`, odkazy, `is-active`, `aria-current`, pruh načítania ostávajú. Platí pre všetky podmenu: HR (5), `/learning/manage` (3), `/learning/tests` (2–3).

- **A** — záložky s podčiarknutím (rozhodnuté v `ZAKLAD-podmenu-a-akcie`).
- **B** — TabView z iPadOS: plávajúci oblý pás pod nadpisom.

Spodný TabView z iPhonu sa **nepoužíva**: spodok obrazovky patrí hlavnej lište aplikácie (SHELL-menu-v-hlavicke, Q5 — rozhodnuté). Dve lišty dole by sa pomýlili.

## B — CSS

```css
:root {
  --tv-bar: rgba(255,255,255,.82);
  --tv-shadow: 0 1px 2px rgba(20,28,42,.06), 0 8px 24px rgba(20,28,42,.10);
}
html[data-theme="dark"] {
  --tv-bar: rgba(29,35,44,.86);
  --tv-shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.4);
}
.tabs {                                   /* obal: zarovnanie (Q2) */
  display: flex; justify-content: center; /* Q2 B: flex-start */
  margin: 18px 0 20px; border: 0;
}
.tabs-bar {                               /* nový vnútorný span */
  display: inline-flex; gap: 2px; padding: 4px; max-width: 100%;
  border-radius: 999px; background: var(--tv-bar);
  border: 1px solid var(--line); box-shadow: var(--tv-shadow);
  backdrop-filter: blur(20px);
  overflow-x: auto; scrollbar-width: none;
}
.tab {
  flex: none; display: inline-flex; align-items: center;
  min-height: 38px; padding: 0 18px; border-radius: 999px;
  font-size: var(--fs-lead); font-weight: 550; color: var(--ink);
  white-space: nowrap; box-shadow: none;
}
.tab:hover { background: var(--surface-2); }
.tab.is-active { background: var(--accent-soft); color: var(--accent); font-weight: 650; box-shadow: none; }
@media (max-width: 639px) { .tabs { justify-content: flex-start; } .tab { padding: 0 14px; } }
```

- Vybraná položka má **farbu organizácie** (`--accent`), prepínač pohľadu je **sivý bez farby** — dva ovládače nad sebou sa nepomýlia.
- `TabLink` sa nemení; obal `.tabs-bar` pridá `SectionTabs` (a `/learning/manage`, `/learning/tests`).
- Mobil: posun aktívnej do zorného poľa (`bar.scrollLeft`, nie `scrollIntoView`) — ako pri A.
- Kontrast: `--accent` SFZ `#1d4ed8` na `--accent-soft` cez bielu ≈ 6 : 1. Pri tenantoch so svetlou farbou over `tenantStyle()`.

## Rozhodnuté (2. 10. 2026)

- **Q1 — Podmenu ako A (záložky) alebo B (TabView pás)?**
  **B.** Dôvod: páči sa vám, je to známy vzor z iPadu, farebný výber ho jasne odlíši od sivého prepínača pohľadu a je to len CSS nad tým istým značkovaním; nevýhoda je, že pri piatich položkách na 390 sa pás posúva (rovnako ako A).
- **Q2 — Pás uprostred (ako iPadOS), alebo zarovnaný vľavo k nadpisu?**
  **Vľavo** (`justify-content: flex-start` na všetkých šírkach). Dôvod: nadpis, cesta aj obsah začínajú pri ľavom okraji, pás uprostred by na 1440 visel ďaleko od nadpisu a oko by ho hľadalo; iPadOS ho dáva doprostred, lebo tam nadpis nad ním nie je.

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | `/hr/overview` A vs. B · `/learning/manage` B uprostred vs. vľavo |
| **834** | ako 1440 |
| **390** | B svetlá · tmavá (s lištou aplikácie dole) |

## Údaje, ktoré v modeli NEEXISTUJÚ

Žiadne. Nové tokeny `--tv-bar`, `--tv-shadow` (obe témy).

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/ZAKLAD-podmenu-tabview.html + .md.
Ide do vetvy design/podmenu-a-akcie (spolu so ZAKLAD-podmenu-a-akcie
a ZAKLAD-segmented-control).

Podľa Q1/Q2 v .md:
1. Tokeny --tv-bar, --tv-shadow (svetlá + tmavá).
2. .tabs = obal (zarovnanie podľa Q2), nový .tabs-bar = kapsula,
   .tab / .tab.is-active podľa .md. TabLink bez zmeny; .tabs-bar
   pridať v SectionTabs, /learning/manage, /learning/tests.
3. Mobil: posun aktívnej cez bar.scrollLeft (NIE scrollIntoView).
4. Over HR (5), /learning/manage (3), /learning/tests, svetlá aj tmavá,
   390/834/1440; pruh načítania .tab-pending musí sedieť v kapsule.
Pred commitom tsc, eslint, vitest, build. Komentár: odkaz na
ZAKLAD-podmenu-tabview (2. 10. 2026).
```
