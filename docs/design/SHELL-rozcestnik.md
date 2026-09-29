# SHELL — Prehľad ako rozcestník, bez stáleho menu

Referencia: `SHELL-rozcestnik.html`. Alternatíva k `SHELL-bocny-panel` (používateľ 29. 9.: bočný panel berie šírku a pôsobí ako admin/ERP). Základ: `ZAKLAD.md`, `PREHLAD.md`. Úpravy 29. 9. (2. kolo): cesta pod hlavičkou namiesto tlačidla Späť, hlavička bez navigácie, panely zarovnané s dlaždicami.
Zdroj: `components/AppNav.tsx`, `lib/appNav.ts` (`navItems`, `MORE_GROUPS`, `tabbarItems`), `Header.tsx`, `app/src/app/page.tsx`, `Icon.tsx`.

## Čo sa mení

1. **≥ 640 px bez stáleho menu.** Ruší sa pás `topbar` aj variant `sidebar` (a „Viac N", meranie prepadu, `?layout=`).
2. **Prehľad = rozcestník.** Pod KPI pribudnú dlaždice sekcií v skupinách **Organizácia** a **Správa** (poradie ako `MORE_GROUPS`, roly z `navItems()`). Panely pozornosti a noviniek idú pod dlaždice. Prázdna skupina sa nevykreslí.
3. **Hlavička bez navigácie** — logo (odkaz na `/` ako dnes), Opýtajte sa… ⌘K, zvonček, avatar.
4. **Cesta pod hlavičkou** na každej stránke okrem Prehľadu: Prehľad › Skupina › Sekcia › … › Aktuálna. Každý krok okrem posledného je odkaz; skupina → `/#sprava`. Skladá sa z pathname (`breadcrumbs(pathname, names)` v `lib/appNav.ts`), nie z histórie — rovnaká aj z odkazu v e-maile. Detail nesie vlastný názov (napr. normy). `<nav aria-label="Cesta"><ol>`, posledný `aria-current="page"`, bez JS.
4a. **Panely** „Čaká na vás" a „Nové v knižnici" v mriežke 2 × `minmax(0,1fr)`, gap 12 — lícujú s dlaždicami, rovnaká výška, odkaz na celý zoznam v pätičke. Nadpis skupiny „Pre vás".
5. **834 ako desktop** (bez lišty, bez hamburgera). Dlaždice 2 v rade.
6. **Pod 640 px** spodná lišta bez zmeny; cesta pod hlavičkou ako na desktope, dlhá sa zalomí.
7. **Plachta celého menu** — ikona 9 bodiek na začiatku pásu cesty (nie v hlavičke). Otvorí plachtu 760 px so všetkými sekciami v stĺpcoch Hlavné (Prehľad, Opýtať sa, Na potvrdenie, Na schválenie) · Organizácia · Správa; počty ako odznaky, aktuálna zvýraznená. 834: 2 stĺpce, 390: 1 stĺpec, položky 44 px. Závoj 18 %; Esc / klik mimo / výber / zmena pathname zavrie; fokus do plachty a späť na ikonu. Bez JS `<details>`. Na Prehľade pás nie je (dlaždice sú vidieť).

## Prečo

Obsah má celú šírku na každej šírke obrazovky. Menu nerastie so sekciami — nová sekcia = nová dlaždica. Dlaždica unesie aj vetu, čo v sekcii je (bežná osoba nevie, čo je „Reťaz dôkazov"). Bez panela to pôsobí ako intranet, nie ako administrácia.

**Cena:** prepnutie medzi sekciami sú dva kliky (9 bodiek → sekcia) a na podstránke nevidno počty mimo zvončeka a plachty. Pre personalistu, ktorý strieda Pridelené normy a Osoby, je to pomalšie ako panel.

## Konflikt s rozhodnutím

`SHELL-bocny-panel` sa **ruší** (Q1 nižšie) vrátane jeho rozhodnutí Q1–Q4 z 29. 9. README/`DESIGN_GAP.md` („oba varianty, default topbar") sa ruší tiež. Z panela ostáva len zlúčenie „Na schválenie" do Mojich úloh na `/more` — tu je v KPI, sedí.

## Rozhodnutia 29. 9. 2026 (Q5 doplnené v 3. kole)

- **Q1 ✅** Rozcestník **nahrádza** bočný panel úplne, nekombinuje sa. Ruší sa `topbar` aj `sidebar`, „Viac N", meranie prepadu, `?layout=`, `normalizeLayout()`. Dôvod: dve navigácie = dvojnásobná údržba; panel berie šírku a pôsobí ako administrácia.
- **Q2 ✅** Na podstránkach **stačí zvonček** so súčtom. Počty po sekciách sú na Prehľade (KPI, odznaky na dlaždiciach). Ďalší ukazovateľ by musel byť v hlavičke — tá ostáva bez navigácie.
- **Q3 ✅** Do **hlavičky** žiadne menu. Rýchle prepnutie áno, ale ako ikona 9 bodiek v **páse cesty** (Q5).
- **Q5 ✅** Plachta celého menu z ikony 9 bodiek v páse cesty — požiadavka používateľa 29. 9. 2026. Prepnutie sekcie = 2 kliky bez návratu na Prehľad.
- **Q4 ✅** `/more` na telefóne používa **ten istý komponent** `SectionTiles` ako Prehľad (jeden stĺpec). Rovnaké poradie, názvy a popisy všade.

Odsúhlasil používateľ 29. 9. 2026 — Code zapíše do `docs/DEVLOG.md`, poznámku do README (Navigácia) a `DESIGN_GAP.md`; `SHELL-bocny-panel.*` označí ako zrušený. TODO „uložiť variant navigácie na osobu" sa zatvára.

## Rámy

- **1440** Prehľad (personalista + správca), `/hr`, `/hr/assign`.
- **834** Prehľad, `/hr`.
- **390** Prehľad, `/hr` (tabbar bez zmeny).
- **1440 / 834 / 390** `/hr` s otvorenou plachtou.
- **1440** bežná osoba — iba Organizácia.

## Rozmery

Dlaždica: padding 16, radius 12, ikona 20 v štvorci 42 (`--surface-2`, radius 11), názov 15/620, veta 13 `--muted`, odznak `--bad-fg` 11/650 vpravo hore. Mriežka `repeat(auto-fill, minmax(250px, 1fr))`, gap 12. Nadpis skupiny 17/650. Cesta: pás 40 px (`--surface`, spodná čiara), text 13, kroky `--muted`, aktuálny `--ink` 600, oddeľovač šípka 6 px. Na 390 text 12.5, odkazy s paddingom 6 px (cieľ ~30 px, pás 44 px).

## i18n (sk/cs/en)

`nav.breadcrumb` „Cesta" (aria-label), `nav.allSections` „Všetky sekcie", `nav.group.main` „Hlavné", `nav.sheetHint` „Všetky sekcie s popisom sú na Prehľade", `overview.forYou` „Pre vás", `overview.sections.organisation`, `overview.sections.management`, `nav.desc.{key}` — jedna veta na sekciu (texty v `.html`, objekt `T`).

## Údaje, ktoré v modeli neexistujú

Žiadne. Popisy sekcií sú i18n texty. Cesta sa skladá z pathname a názvov, ktoré stránka už má. 🔴 Zmena schémy: **žiadna**.

## Prompt pre Claude Code

```
Implementuj design_handoff_contineo_intranet/SHELL-rozcestnik.html + .md (rozhodnutia Q1–Q5
29. 9. 2026). Nahrádza SHELL-bocny-panel — ten neimplementuj. Najprv prečítaj AppNav.tsx,
lib/appNav.ts, AppShell.tsx, Header.tsx, Icon.tsx, app/src/app/page.tsx, app/more/page.tsx
a testy appNav.test.ts / legacyRoutes.test.ts; docs/decisions/ a docs/DEVLOG.md k navigácii.

Rozsah (vetva design/shell-rozcestnik):
1. lib/appNav.ts: sectionGroups(items) → [{key:"organisation"|"management", items}] z
   navItems() (roly D32/D67/D87 bez zmeny); overview, ask, toAcknowledge, toApprove nie sú
   dlaždice; prázdne skupiny vynechať. MORE_GROUPS: "tasks" (toApprove) pred "organisation",
   toApprove zo "management" preč. breadcrumbs(pathname, names) → [{label, href|null}]:
   Prehľad → skupina (/#organisation | /#management) → sekcia → … → aktuálna (href null);
   detail berie názov zo stránky (napr. názov normy); neznáma cesta → [Prehľad, aktuálna].
   Testy na všetky tri.
2. components/SectionTiles.tsx: dlaždice v skupinách (ikona z Icon.tsx v štvorci 42, názov,
   veta nav.desc.{key}, odznak pri nenulovom počte). Použiť na / (pod KPI, nad panelmi) aj na
   /more (jeden stĺpec). Nadpis skupiny s id pre kotvu.
3. components/Breadcrumbs.tsx: <nav aria-label="Cesta"><ol>, pás 40 px pod hlavičkou na
   každej stránke okrem /; posledný krok aria-current="page", nie odkaz. Server komponent,
   bez JS. Pod 640 px text 12.5, zalamuje sa.
3a. components/SectionsSheet.tsx: tlačidlo 9 bodiek (nová ikona "grid" v Icon.tsx, 3×3 bodky
   r 1.5 na mriežke 18, tvar v .html) na začiatku pásu cesty + plachta so stĺpcami Hlavné /
   Organizácia / Správa (sectionGroups + overview, ask, toAcknowledge, toApprove), počty,
   aktuálna podľa activeHref. aria-expanded/aria-controls, Esc, klik mimo, zmena pathname
   zavrie, fokus späť na tlačidlo. Bez JS <details>. 834: 2 stĺpce, < 640: 1 stĺpec, 44 px.
4. Prehľad (page.tsx): poradie hero → KPI → SectionTiles → „Pre vás" (panely). .overview-panels
   = repeat(2, minmax(0,1fr)), gap 12 ako dlaždice, rovnaká výška, odkaz v pätičke karty;
   < 1024 pod sebou. Zachovať úlohy z PREHLAD.md.
5. AppNav.tsx / AppShell.tsx: ≥ 640 px žiadna navigácia. Odstrániť topbar aj sidebar vetvu,
   ResizeObserver, .app-nav--measure, „Viac N", STRIP_DEFAULT_VISIBLE, NavLayout,
   normalizeLayout, ?layout= (+ CSS a testy). Pod 640 px tabbarItems() bez zmeny.
   Header.tsx bez zmeny (žiadne tlačidlo späť, žiadne menu).
Rozmery a i18n (sk/cs/en) v .md; popisy sekcií v objekte T v .html.
Zapíš rozhodnutie do docs/DEVLOG.md, poznámku do docs/design/README.md (Navigácia) a
DESIGN_GAP.md; SHELL-bocny-panel označ ako zrušený; TODO „uložiť variant navigácie" zavri.
Overenie: tsc, eslint (baseline), vitest, build; render 1440 / 834 / 390 (Prehľad, /hr,
/hr/assign, /more, plachta otvorená), personalista aj bežná osoba, svetlá aj tmavá; bez JS.
```
