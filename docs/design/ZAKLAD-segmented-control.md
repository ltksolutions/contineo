# ZAKLAD — prepínač pohľadu ako segmented control

Referencia: `ZAKLAD-segmented-control.html`. Nadväzuje na `ZAKLAD-podmenu-a-akcie` (prepínač pohľadu = `.view-switch`). Podnet: používateľ 2. 10. 2026 — páči sa mu Segmented Control zo SwiftUI.

## Čo sa mení — len CSS `.view-switch` (~3700)

Trieda, značkovanie, `?view=`, `is-on`, `aria-current` ostávajú. Platí naraz: `/library` (tabuľka/karty), `/dpo` (zoskupiť), `/hr/reminders` (režim), `/hr/overview` (nový).

```css
:root {
  --seg-track: rgba(118,118,128,.12);
  --seg-thumb: #ffffff;
  --seg-shadow: 0 3px 8px rgba(0,0,0,.12), 0 3px 1px rgba(0,0,0,.04);
  --seg-sep: rgba(60,60,67,.18);
}
html[data-theme="dark"] {
  --seg-track: rgba(118,118,128,.24);
  --seg-thumb: #636366;
  --seg-shadow: 0 3px 8px rgba(0,0,0,.3);
  --seg-sep: rgba(255,255,255,.14);
}
.view-switch {
  display: inline-grid; grid-auto-flow: column; grid-auto-columns: 1fr;
  padding: 2px; border-radius: 9px; background: var(--seg-track);
}
.view-switch-item {
  position: relative; display: flex; align-items: center; justify-content: center;
  min-height: 32px; padding: 0 16px; border-radius: 7px;
  font-size: 13.5px; font-weight: 500; color: var(--ink); white-space: nowrap;
}
.view-switch-item + .view-switch-item::before {
  content: ""; position: absolute; left: 0; top: 8px; bottom: 8px; width: 1px;
  background: var(--seg-sep);
}
.view-switch-item.is-on { background: var(--seg-thumb); font-weight: 600; box-shadow: var(--seg-shadow); }
.view-switch-item.is-on::before, .view-switch-item.is-on + .view-switch-item::before { opacity: 0; }
@media (max-width: 639px) { .view-switch-item { min-height: 36px; } }
```

- Rovnako široké segmenty (`1fr`), text nevybraných `--ink` (výber nesie doska, nie farba).
- Bez farby tenantu — neutrálny ovládač.
- `.view-switch--full` (nové): `display: grid; width: 100%` — na 390 vo Výkaze potvrdení.
- Knižnica: `--auto-cards` / `--auto-table` (~3732) prepísať na tie isté hodnoty (`--seg-thumb`, tieň) — inak by automatický režim vyzeral po starom.
- Prechod dosky (animácia posunu) **nie** — položky sú odkazy, stránka sa načíta znova.

## Rozhodnuté (2. 10. 2026)

- **Q1 — Použiť segmented control aj na podmenu sekcie (HR, Správa kurzov, Testy) namiesto záložiek?**
  **Nie** — podmenu je TabView pás (`ZAKLAD-podmenu-tabview`). Dôvod: segmented control je na prepnutie pohľadu s 2–4 krátkymi voľbami (tak ho delí aj Apple oproti tab baru); päť záložiek HR by sa na 390 do segmentov nezmestilo a dva rovnaké ovládače nad sebou (Výkaz: podmenu + pohľad) by sa nedali rozlíšiť.

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | `/hr/overview` dnes / návrh · `/library` · `/dpo` |
| **834** | ako 1440 |
| **390** | `/hr/overview` svetlá · tmavá |

## Údaje, ktoré v modeli NEEXISTUJÚ

Žiadne. Nové tokeny `--seg-*` (obe témy).

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/ZAKLAD-segmented-control.html + .md.
Môže ísť do tej istej vetvy ako ZAKLAD-podmenu-a-akcie
(design/podmenu-a-akcie), alebo samostatne design/segmented-control.

1. Tokeny --seg-track, --seg-thumb, --seg-shadow, --seg-sep v :root
   aj html[data-theme="dark"] podľa .md.
2. .view-switch / .view-switch-item / .is-on podľa .md (rovnaké šírky,
   doska s tieňom, oddeľovače, 32 px, <640 36 px).
3. .view-switch--full pre /hr/overview na <640.
4. Knižnica --auto-cards / --auto-table na nové hodnoty.
Over /library, /dpo, /hr/reminders, /hr/overview, svetlá aj tmavá,
390/1440. Podmenu ostáva .tabs (Q1). Pred commitom tsc, eslint,
vitest, build. Komentár: odkaz na ZAKLAD-segmented-control (2. 10. 2026).
```
