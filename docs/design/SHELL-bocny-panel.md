# SHELL — ľavý bočný panel s ikonami

Referencia: `SHELL-bocny-panel.html`. Základ: `ZAKLAD.md`, `docs/design/README.md` (Navigácia — dva varianty), `DESIGN_GAP.md`.
Zdroj: `components/AppNav.tsx` (variant `sidebar` už existuje), `lib/appNav.ts` (`navItems`, `activeHref`, `tabbarItems`, `MORE_GROUPS`), `components/Icon.tsx`, `components/AppShell.tsx`, `Header.tsx`.

## Čo sa mení

1. **≥ 1024 px: bočný panel namiesto pásu.** Rozbalený 236 px (ikona + text), zbaliteľný na lištu ikon 64 px. Predvolene rozbalený.
2. **640–1023 px: lišta ikon 64 px**, panel sa vysúva nad obsah (260 px, závoj). Hamburger v hlavičke vľavo od loga + „Rozbaliť" dole. „Viac N" v páse odpadá.
3. **Skupiny:** (bez nadpisu) Prehľad, Opýtať sa · **Moje úlohy**: Na potvrdenie, Na schválenie · **Organizácia**: Adresár, Knižnica, Vzdelávanie · **Správa**: Pridelené normy, Reťaz dôkazov, Osoby, Na posúdenie, Ochrana údajov, Správa kurzov, Testy. Prázdna skupina sa nevykreslí.
4. **Lišta ikon:** nadpisy skupín → deliaca čiara; popis pri hover/focus; `aria-label` s názvom a počtom.
5. **Zbaliť/rozbaliť** dole v paneli; stav v cookie `nav=rail|wide` (server vykreslí bez preblikania). Bez JS formulár so serverovou akciou.
6. **Pod 640 px bez zmeny** — spodná lišta `tabbarItems()`.

Nemení sa: zoznam položiek a podmienky rolí (`navItems`, D32/D67/D87), aktívna položka (`activeHref`), počty (nula sa nekreslí), ikony (`Icon.tsx`, nič nové sa nekreslí), hlavička, šírky stránok.

## Prečo

Personalista/správca má 10–14 položiek. V páse sú bez skupín, na 834 padajú do „Viac N" a textový pás ikony nemôže mať (PR 7: s ikonami sa nezmestí). Zvislý panel má miesto na ikony, skupiny aj rast (Vzdelávanie pridalo tri položky), a zbalený zaberie menej ako pás.

## Konflikt s rozhodnutím v repozitári

README (návrh) a `DESIGN_GAP.md`: „implementovať oba, default `topbar`". `AppNav.tsx`: „Pás je textový (vzor, PR 7)". Tento návrh predvolený variant **obracia** a pás ruší.

## Rozhodnutia 29. 9. 2026

- **Q1 ✅** Predvolený variant na desktope = **bočný panel**. Pás (`topbar`) sa **ruší**, nie ponecháva ako druhý variant. Dôvod: README počítalo so 6 položkami, dnes ich je 10–14; pás musí byť textový (PR 7) a aj tak prepadá do „Viac N"; dva varianty = dvojnásobné testy bez spôsobu, ako ich prepnúť (voľba sa neukladá). `?layout=` a `normalizeLayout()` odchádzajú.
- **Q2 ✅** „Na schválenie" patrí do **Moje úlohy** — schvaľovatelia sú menovaní ľudia (D69), nie rola, na telefóne sú už obe pod „Úlohami". **`/more` sa zjednotí:** nová skupina „Moje úlohy" (Na schválenie) nad „Organizáciou"; zo „Správy" odchádza.
- **Q3 ✅** 640–1023 px: **lišta ikon 64 px + vysúvanie** nad obsah. Obsahu ostáva ~770 px (formuláre sú 680–760), „Viac N" zaniká, odznaky sú vidieť stále.
- **Q4 ✅** Zbalenie v **cookie** `nav=rail|wide` (voľba zariadenia, nie osoby). Bez zmeny schémy. TODO „uložiť variant navigácie na osobu" sa zatvára ako zbytočné.

Rozhodnutie pripravil návrh, odsúhlasil používateľ 29. 9. 2026 — Code ho zapíše do `docs/DEVLOG.md` a poznámku do README (Navigácia) a `DESIGN_GAP.md`.

## Rámy

- **1440** rozbalený, personalista + správca, aktívne „Pridelené normy".
- **1440** lišta ikon s popisom pri prejdení myšou.
- **834** lišta ikon; **834** vysunutý panel so závojom.
- **390** spodná lišta (referencia, bez zmeny).
- Bežná osoba bez rolí — rozbalený aj lišta (6 položiek, bez „Správy").

## Rozmery

Panel 236 / 64 / drawer 260. Položka 38 px (lišta 44), padding 0 10, radius 8, ikona 17 px, text 14/500, aktívna 650 + `--accent-soft` + čiarka 3 px. Nadpis skupiny 10.5/650 uppercase `--muted`. Odznak `--bad-fg`, 11/650. Panel `position: sticky; top: 56px; height: calc(100dvh - 56px)`, roluje sa sám.

## i18n (sk/cs/en)

`nav.group.tasks` „Moje úlohy", `nav.group.organisation` „Organizácia", `nav.group.management` „Správa", `nav.collapse` „Zbaliť panel", `nav.expand` „Rozbaliť panel", `nav.menu` „Menu". Názvy položiek existujú (`dictionary().nav`).

## Údaje, ktoré v modeli neexistujú

Žiadne. Cookie `nav` je klientska voľba, nie údaj v databáze. 🔴 Zmena schémy: **žiadna**.

## Prompt pre Claude Code

```
Implementuj design_handoff_contineo_intranet/SHELL-bocny-panel.html + .md. Rozhodnutia Q1–Q4
sú v .md (29. 9. 2026): bočný panel je predvolený na desktope, pás topbar sa RUŠÍ.
Najprv si prečítaj AppNav.tsx, lib/appNav.ts, AppShell.tsx, Header.tsx, Icon.tsx a testy
appNav.test.ts / legacyRoutes.test.ts.

Rozsah (vetva design/shell-bocny-panel):
1. lib/appNav.ts: navGroups(items) → [{key: null|"tasks"|"organisation"|"management", items}]
   (null: overview, ask · tasks: toAcknowledge, toApprove · organisation: directory, library,
   learning · management: zvyšok); prázdne skupiny vynechať; neznámy kľúč do "management".
   MORE_GROUPS: pridať "tasks" (toApprove) pred "organisation", toApprove zo "management" preč;
   /more a i18n nadpis skupiny. Testy na obe.
2. AppNav.tsx: jeden desktopový tvar — panel so skupinami, stav wide (236) / rail (64),
   tlačidlo Zbaliť/Rozbaliť dole, v rail nadpisy → deliaca čiara, tooltip pri hover a
   focus-visible, aria-label s názvom a počtom, aktívna podľa activeHref, nula sa nekreslí.
   Odstrániť topbar vetvu, meranie prepadu (ResizeObserver, .app-nav--measure, „Viac N"),
   STRIP_DEFAULT_VISIBLE, NavLayout/normalizeLayout a ?layout= (+ ich CSS a testy).
3. Stav v cookie nav=rail|wide: čítať v AppShell na serveri (bez preblikania), prepínať
   serverovou akciou cez <form> (funguje bez JS); s JS okamžite, bez reloadu.
4. 640–1023 px: vždy rail; hamburger v Header.tsx vľavo od loga + „Rozbaliť" vysunie panel
   260 px nad obsah so závojom rgba(17,21,28,.28); Esc, klik mimo, zmena pathname zavrie;
   fokus do panelu a späť na hamburger. Bez JS <details>.
5. Panel position:sticky; top:56px; height:calc(100dvh - 56px); zoznam overflow-y:auto,
   pätička vždy viditeľná. Šírky stránok sa nemenia. Pod 640 px nič nemeniť (tabbar).
Ikony len z Icon.tsx; nové fold/unfold/burger nakresliť na mriežke 18 cez iconProps (tvary v .html).
Rozmery a i18n (sk/cs/en) v .md. Zapíš rozhodnutie do docs/DEVLOG.md, poznámku do
docs/design/README.md (Navigácia) a DESIGN_GAP.md; TODO „uložiť variant navigácie" zavrieť.
Overenie: tsc, eslint (baseline), vitest, build; render 1440 wide + rail, 834 rail + drawer,
390, svetlá aj tmavá; bez JS.
```
