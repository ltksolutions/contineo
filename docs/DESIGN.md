# Ako pracovať s dizajnom

> Návod pre Jána aj kolegu: kde sa navrhujú obrazovky, ako sa z návrhu stane
> kód a kedy a ako sa synchronizuje design system s Claude Design.
> Zavedené 3. – 4. 10. 2026 (PR #246).

## Dva projekty v Claude Design

| Projekt | Načo je | Kto doň píše |
|---|---|---|
| **Contineo.app responzivny design** (`5f2e4189-…`) | **návrhy obrazoviek** — nové stránky, zmeny, otázky Q1, Q2… | Ján s dizajnovým agentom |
| **Contineo — design system** (`f95a5ca5-…`) | knižnica: štýly, tokeny a komponenty z kódu aplikácie | **len `/design-sync`** z tohto repozitára, nikdy ručne |

Design system je k návrhovému projektu **pripojený** (v projekte „+" pri poli
chatu → Designs → Design system). Agent preto kreslí so skutočnými triedami
a farbami aplikácie, nie s vlastným odhadom.

- Návrhy: https://claude.ai/design/p/5f2e4189-f298-4a85-8936-1b45f9d34ae1
- Design system: https://claude.ai/design/p/f95a5ca5-9a29-4e6d-8915-5818da1a2b0e

## Ako navrhnúť novú obrazovku

1. **V Claude Design**, v projekte „Contineo.app responzivny design", napíš
   do chatu, čo chceš — napr. *„Návrh obrazovky Moje kurzy na telefóne
   a desktope"*.
2. Agent podľa `CLAUDE.md` toho projektu:
   - vytvorí v `design_handoff_contineo_intranet/` dvojicu `NAZOV-zmeny.html` + `.md`;
   - kreslí rámy 390 / 834 / 1440;
   - vychádza zo SwiftUI (pod 640 px iOS, 640–1023 px iPadOS, od 1024 px macOS);
   - pri každej otázke dá odporúčanie.
3. Na otázky odpovieš v chate; agent ich zapíše do `.md` ako „Rozhodnuté".
4. **V Claude Code** napíš:
   > stiahni design NAZOV-zmeny

   Súbory sa prečítajú priamo z Claude Design (bez sťahovania do
   `Downloads`) do `docs/design/`, nasleduje vetva + worktree,
   implementácia, overenie, DEVLOG, CHANGELOG a PR. Prompt z konca `.md`
   („Prompt pre Claude Code") sa dá vložiť aj rovno.
5. Potom ako vždy: „zapni Auto-fix na #N" a „zlúč #N".

Pravidlá, ktoré pri tom platia (rozhodnutie v repozitári má prednosť pred
návrhom, odchýlky do PR, jeden návrh = jedna vetva), sú v `CLAUDE.md`,
sekcia „Návrhy z Claude Design".

## Kedy spustiť `/design-sync`

Len keď sa **zmení vzhľad v kóde** a Claude Design to má vedieť:

- po zlúčení PR, ktorý mení `app/src/app/globals.css` (nové tokeny alebo
  triedy, napr. nový ovládač);
- keď sa zmení niektorý z komponentov v knižnici;
- keď chceš do knižnice pridať ďalší komponent.

Postup: v Claude Code napíš `/design-sync`. Pokračuje z `.design-sync/config.json`,
overí len zmenené komponenty, nahrá ich do „Contineo — design system"
a na konci ponúkne PR so zmenami v `.design-sync/`. Nie po každom návrhu —
skôr raz za niekoľko PR, ktoré menia štýly.

Spúšťa ho **len používateľ** (asistent ho sám spustiť nesmie). Prístup ku
Claude Design dáva jednorazové `/design-login` v interaktívnom `claude`
v Termináli; pri prvom behu na novom počítači treba urobiť znova.

## Čo je v `.design-sync/`

| Súbor | Čo to je | Kedy sa mení |
|---|---|---|
| `config.json` | cieľový projekt, vstup, štýly, **ručné typy props** (`dtsPropsFor`) | zmena props komponentu, nový komponent |
| `previews/*.tsx` | náhľady komponentov, ktoré vidno v knižnici | nový komponent, zmena vzhľadu |
| `conventions.md` | **návod pre dizajnového agenta** — tokeny, triedy, pravidlo ovládačov, ukážka | ručne, keď treba agenta naučiť nové pravidlo |
| `NOTES.md` | ako je to postavené, čo nejde a prečo, riziká pri ďalšej synchronizácii | píše ho synchronizácia |

**`app/design-sync.entry.ts`** vyberá, ktoré komponenty idú do knižnice.
Smú tam byť **len komponenty bez `next/link`, `next/navigation`, relácie
a databázy** — iné by sa v Claude Design nevykreslili. Dnes ich je 12:
`Icon`, `ContineoMark`, `SearchStrip`, `Select`, `MultiSelect`, `Skeleton`,
`SkeletonCard`, `SkeletonList`, `Fact`, `TabsBar`, `CopyLink`, `SubmitButton`. Vzhľad zvyšku
aplikácie nesú triedy z `globals.css` opísané v `conventions.md`.

Do gitu nejde (`.gitignore`): `.ds-sync/`, `ds-bundle/`,
`.design-sync/.cache/`, `.design-sync/learnings/` — pracovné súbory, vyrobia
sa vždy znova.

## Ako pridať komponent do knižnice

V Claude Code: *„pridaj do design systemu komponent X"*. Komponent sa overí
na závislosti; ak je čisto prezentačný, pribudne do `design-sync.entry.ts`
a `config.json`, dostane náhľad v `previews/` a spustí sa `/design-sync`.
Ak závisí od Nextu či databázy, namiesto neho sa jeho triedy opíšu
v `conventions.md`.

## Na čo si dať pozor

- **Typy props v `config.json` sú ručné** — aplikácia nemá zostavené `.d.ts`.
  Keď sa zmenia props komponentu z knižnice, treba ich upraviť, inak agent
  použije starú verziu.
- **React v knižnici je ten z `app/node_modules`** (od 4. 10. 2026 verzia 19,
  rovnaká ako React, ktorý si pribaľuje Next). Pri zmene verzie Reactu
  v aplikácii treba spustiť `/design-sync`.
- **Pravidlo ovládačov** (kam idem / ako to vidím / čo urobím / odkiaľ som
  prišiel) je na troch miestach: `CLAUDE.md` repozitára, `CLAUDE.md` projektu
  v Claude Design a `.design-sync/conventions.md`. Pri zmene treba všetky tri.
- **V projekte „Contineo — design system" sa ručne nič neupravuje.** Ďalšia
  synchronizácia by to prepísala a kotva `_ds_sync.json` by prestala sedieť.
