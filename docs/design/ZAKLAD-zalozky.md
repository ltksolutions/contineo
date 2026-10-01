# ZAKLAD — záložky a nastavenie organizácie

Referencia: `ZAKLAD-zalozky.html`. Základ: `ZAKLAD.md`. Zdroj: `globals.css` `.tabs` ~1670, `.tab-pending` ~6911; `components/TabLink.tsx`; `organisation/page.tsx` ~185, ~271; i18n `organisation.tabs` (~5045).

## Čo je zle

Snímka `uploads/Snímka obrazovky 2026-10-01 o 20.40.38.png`. Aktívna a neaktívna záložka majú rovnaké pozadie; rozdiel je hrúbka písma a 2 px čiara, ktorá sa cez `margin-bottom: -3px` prekrýva s 1 px okrajom lišty. Na `/organisation` je 8 záložiek — na 390 je vidieť dve a pol, na 1440 sa nezmestia do stĺpca 720 px.

## Kde to platí (skontrolované)

`.tabs` / `TabLink`: `/learning/tests` (2×), `/learning/manage`, `/learning/manage/[courseKey]`, `/organisation`.
`.view-switch` (`/library`, `/dpo`, `/hr/reminders`) je prepínač pohľadu, nie záložky — aktívna voľba má biely podklad na sivej koľajnici, čitateľné. **Nemení sa.**

## 1 — Záložky (všetky obrazovky, len CSS)

```css
.tabs {
  display: flex; gap: 2px; margin: 0 0 20px;
  border-bottom: 1px solid var(--line-strong);   /* bolo --line */
  overflow-x: auto; scrollbar-width: none;       /* padding-bottom preč */
}
.tab {
  flex: none; display: inline-flex; align-items: center;
  min-height: 44px; padding: 0 16px;
  border-radius: 10px 10px 0 0;
  font-size: var(--fs-lead); font-weight: 600;   /* 14.5/500 → 15/600 */
  color: var(--muted); white-space: nowrap;
  box-shadow: inset 0 -3px 0 transparent;        /* border-bottom + margin -3px preč */
}
.tab:hover { color: var(--ink); background: var(--surface-2); }
.tab.is-active {
  color: var(--ink); font-weight: 700;
  background: var(--accent-soft);
  box-shadow: inset 0 -3px 0 var(--accent);
}
.tab-pending.is-on { bottom: 0; height: 3px; }   /* zvyšok bez zmeny */
```

`box-shadow: inset`, nie `border` — rovnaký dôvod ako ZAKLAD úloha 4 (neposúva text). `--line-strong` v `globals.css` **nie je** — nový token do `:root` (`rgba(20,28,42,.18)`) aj do `html[data-theme="dark"]` (`rgba(255,255,255,.18)`). `--accent-soft` je v oboch témach.

## 2 — /organisation: zoznam častí namiesto 8 záložiek

- **≥ 1024 px**: mriežka `220px minmax(0,720px)`, gap 28. Vľavo `<nav class="org-nav">` (sticky), položky v skupinách (Q1), aktívna `--accent-soft` + `box-shadow: inset 3px 0 0 var(--accent)`. Položky ostávajú `TabLink` s `?tab=`. Bez `?tab` → prvá časť ako dnes.
- **< 1024 px**: bez `?tab` sa ukáže **zoznam častí** (karty po skupinách, riadok 52 px, šípka vpravo) a obsah žiadnej časti. S `?tab` sa ukáže len časť a nad ňou odkaz „‹ Nastavenie organizácie" (`/organisation`, 44 px); zoznam skrytý.
- Server pozná, či `?tab` prišiel: obal dostane `org-set--index`. CSS: `@media (max-width:1023px) { .org-set--index .org-body { display:none } .org-set:not(.org-set--index) .org-nav { display:none } }`, odkaz späť `display:none` od 1024. Bez JavaScriptu.
- **Jedna časť** (DPO bez roly správcu, ADR-022 D154): navigácia sa nekreslí vôbec, ani odkaz späť; `/organisation` rovno otvorí GDPR.
- `<Notice back=…>` ostáva `?tab=${now}`.
- Mení sa len `organisation/page.tsx` (`maxWidth: 720` → mriežka). `layout.tsx` nie.

## Rozhodnuté (1. 10. 2026 — všetky podľa odporúčania)

- **Q1 — áno.** Skupiny v zozname: Organizácia (Vzhľad a jazyky, Oddelenia, Číselníky) · Prístup (Domény, Prihlasovanie) · Dokumenty (Členenie) · Dohľad (Audit, GDPR).
  Dôvod: osem položiek bez nadpisov sa číta ako jeden dlhý zoznam; v skupinách človek nájde „Prihlasovanie" bez čítania všetkého.
- **Q2 — áno, na všetkých šírkach.** Cesta nesie aj názov časti („… › Nastavenie organizácie › Prihlasovanie").
  Dôvod: časť je pod 1024 samostatná obrazovka a cesta má povedať, kde človek je; od 1024 to nič nestojí a ostane to rovnaké.
- **Q3 — áno.** Poradie záložiek podľa skupín (dnes Číselníky sú až 5.).
  Dôvod: poradie `TAB_KEYS` = poradie v skupinách; inak by sa zoznam a predvolená prvá časť rozišli len kvôli poradiu v poli.

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | záložky dnes / návrh (`/learning/tests`) · `/organisation` so zoznamom vľavo |
| **834** | `/organisation?tab=signin` (časť s odkazom späť) |
| **390** | záložky svetlá / tmavá (`/learning/manage`) · `/organisation` zoznam · `?tab=signin` |

## Údaje, ktoré v modeli NEEXISTUJÚ

Žiadne. Nový token `--line-strong` (obe témy). Nové i18n (sk/cs/en): `organisation.groups.{org,access,documents,oversight}` („Organizácia", „Prístup", „Dokumenty", „Dohľad"), `organisation.back` („Nastavenie organizácie").

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/ZAKLAD-zalozky.html + .md.
Vetva design/zalozky z main.

1. globals.css .tabs/.tab (~1670) podľa .md časť 1: aktívna záložka
   --accent-soft + inset 3px --accent, 15px/600, min-height 44px, okraj
   lišty --line-strong; preč border-bottom a margin-bottom -3px na .tab.
   .tab-pending.is-on: bottom 0, height 3px. Over /learning/tests,
   /learning/manage, /learning/manage/[courseKey], svetlá aj tmavá.
   .view-switch sa nemení.
2. /organisation podľa .md časť 2: ≥1024 zvislý zoznam vľavo v skupinách
   (Q1), <1024 zoznam → časť s odkazom späť; trieda org-set--index podľa
   toho, či prišiel ?tab. Jedna časť (DPO, D154) → bez navigácie.
   TAB_KEYS v poradí skupín (Q3). Cesta nesie názov časti (Q2).
3. i18n sk/cs/en: organisation.groups.*, organisation.back.

Nič nevyžaduje JS, layout.tsx nemeniť. Pred commitom tsc, eslint,
vitest, build. Komentár pri .tabs a v organisation/page.tsx: odkaz na
ZAKLAD-zalozky (1. 10. 2026).
```
