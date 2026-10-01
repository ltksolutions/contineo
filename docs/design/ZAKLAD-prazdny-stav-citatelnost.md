# ZAKLAD — prázdny stav, čitateľnosť

Referencia: `ZAKLAD-prazdny-stav-citatelnost.html`. Základ: `ZAKLAD.md` úloha 1. Zdroj: `globals.css` `.empty` ~816, `.empty--compact` ~6980.

## Čo je zle

Snímky `uploads/Snímka obrazovky 2026-10-01 o 20.07.56 / 20.08.10 / 20.08.24.png`. `.empty` má `1px dashed var(--line)` (12 % čiernej) priamo na `--bg #f5f6f8` a bez pozadia. Okraj takmer nevidieť, rámik splynie s plochou, popis 13 px v `--muted` pôsobí ako poznámka pod čiarou.

## Čo sa mení — len CSS, jedna trieda

```css
.empty {
  display: grid;
  justify-items: center;
  gap: 6px;                         /* 4 → 6 */
  padding: 36px 24px;               /* 32/20 → 36/24 */
  background: var(--surface);       /* nové */
  border: 1px solid var(--line);    /* dashed → solid */
  border-radius: var(--radius);
  text-align: center;
}
.empty-title { font-size: 16px; font-weight: 600; color: var(--ink); }
.empty-text {
  font-size: var(--fs-body);        /* 13 → 14 */
  color: var(--muted);
  line-height: 1.55;
  max-width: 52ch;                  /* 46 → 52 */
  text-wrap: pretty;
}
.empty-action { margin-top: 12px; }
.empty--compact { padding: 18px 16px; gap: 3px; }   /* margin ponechať */
.empty--compact .empty-title { font-size: var(--fs-lead); }

/* Vnútri karty bez vlastného rámu — rám v ráme (vzor .panel-empty). */
.card .empty { background: transparent; border: 0; padding: 20px 12px; }
```

Prečo:
- **Biele pozadie** robí z rámika kartu ako ostatné na stránke; odlíši sa bez novej farby. Tmavá téma: `--surface` na `--bg`, tie isté tokeny.
- **Plný okraj** — prerušovaný znamená „sem pustite súbor" (zóna nahrávania); tu sa nič nepúšťa.
- **Väčší text**: `--muted` na bielej 5,9 : 1 (na `--bg` 5,4 : 1), 14 px sa číta bez námahy.
- Bez ikony a ilustrácie — ZAKLAD úloha 1 platí.

Nemení sa: texty, i18n, štruktúra (`.empty-title` / `.empty-text` / `.empty-action`), tlačidlá.

## Kde to platí (skontrolované v repozitári)

Trieda `.empty` — opraví sa automaticky:
`/learning` (3×, vrátane `--compact`), `/learning/tests` (testy, banka, výsledky), `/learning/manage` (kurzy, smart:tagy), `/learning/manage/[courseKey]` (časti, účastníci), `/approvals`, `/hr`, `/hr/reminders`, `/hr/overview`, `/hr/assign`, `/hr/evidence`, `/hr/[id]`, `/library` (2×), `/library/folders`, `/library/tracks`, `/library/curation`, `/documents`, `/notifications`, `/people`, `/people/[id]`, `/people/invite`, `/admin`, `/dpo` (3×).

Mimo `.empty` — **overiť, či nepotrebujú to isté** (otázky nižšie):
- `ask/history/page.tsx:121` — `<p class="quiet ask-history-empty">` holá veta.
- `evaluation/page.tsx:76` — `<p>` s `--fs-lead`.
- `organisation/page.tsx:473` — `<p class="quiet">` (oddelenia, pravdepodobne v karte — ok).
- `components/LibraryReader.tsx:50` — `<p className="empty">` bez `.empty-title`/`-text`; po zmene dostane biely rámik, over vzhľad.
- `components/AuditList.tsx:48` — `.card`, ok.
- `.panel-empty` (Prehľad) — vnútri panela, nemení sa.

## Rozhodnuté

- **Q1 — áno** (1. 10. 2026): `ask/history:121` a `evaluation:76` previesť na `.empty` s `.empty-title` + `.empty-text`. Titulok = doterajšia veta; ak nový text treba, doplniť i18n (sk/cs/en) — návrh v kóde, nie natvrdo.
- **Q2 — ok** (1. 10. 2026): Claude Code overí `/dpo` (`.empty.dpo-section`) a `/learning/manage/[courseKey]:644`. Ak `.empty` nie je v `.card`, `.card .empty` sa ho netýka a nič sa nerobí.

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | dnes · návrh `/learning` · `/learning/tests` s akciou · `/approvals` · kompaktný · v karte |
| **834** | ako 1440, nekreslí sa |
| **390** | svetlá · tmavá |

## Údaje, ktoré v modeli NEEXISTUJÚ

Žiadne. Len CSS.

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/ZAKLAD-prazdny-stav-citatelnost.html + .md.
Vetva design/prazdny-stav-citatelnost z main.

Chyba: .empty (globals.css ~816) má dashed okraj --line na sivom --bg bez
pozadia — rámik nevidieť, text sa zle číta. Platí na ~30 obrazovkách
(/learning, /learning/tests, /approvals, /hr/reminders, /learning/manage…).

1. globals.css .empty: background var(--surface), border 1px solid var(--line),
   padding 36px 24px, gap 6px.
2. .empty-title: font-size 16px, color var(--ink).
   .empty-text: font-size var(--fs-body), max-width 52ch, text-wrap pretty.
   .empty-action: margin-top 12px.
3. .empty--compact (~6980): padding 18px 16px, gap 3px, titulok --fs-lead.
4. Nové: .card .empty { background: transparent; border: 0; padding: 20px 12px; }
5. Over LibraryReader.tsx:50 (<p className="empty">) — po zmene dostane rámik.
6. Q1 áno: ask/history/page.tsx:121 a evaluation/page.tsx:76 previesť na
   .empty (.empty-title + .empty-text), texty cez i18n sk/cs/en.
7. Q2: over, či .empty na /dpo a learning/manage/[courseKey]:644 stojí v .card.

Texty a i18n sa nemenia. Over svetlú aj tmavú tému na /learning, /approvals,
/learning/tests, /dpo, /library s filtrom. layout.tsx nemeniť.
Pred commitom tsc, eslint, vitest, build. Komentár pri .empty: odkaz na
ZAKLAD-prazdny-stav-citatelnost (dashed → solid + surface, 1. 10. 2026).
```
