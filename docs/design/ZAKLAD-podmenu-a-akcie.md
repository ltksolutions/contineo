# ZAKLAD — podmenu, pohľady, akcie, odkazy späť

Referencia: `ZAKLAD-podmenu-a-akcie.html`. Základ: `ZAKLAD.md`, `ZAKLAD-zalozky.md`. Snímky: `uploads/Snímka obrazovky 2026-10-02 o 14.45.40 / 14.49.31 / 14.50.25.png`, `2026-10-01 o 21.56.24.png`.

## Čo je zle

1. Tlačidlá (`.button` + `.button--quiet`) robia tri rôzne veci: prechod na podstránku (`/hr` → Výkaz, Pripomienky, Trasy), prepnutie pohľadu (`/hr/overview` Podľa dokumentu/osoby/trasy) a akciu (Prideliť dokument, Pozvať osobu). Plné tlačidlo vedľa tichých vyzerá ako „vybraná položka".
2. `.button--quiet` (`globals.css` ~885): `background: transparent`, okraj `--line` 12 % na sivom `--bg` — tiché tlačidlá sú zle vidieť.
3. „← Späť na prehľad" opakuje rodiča, ktorý je v ceste pod hlavičkou; „prehľad" sa navyše plietol s Prehľadom (domov).

## Systém — jedno pravidlo

**Kam idem = záložka · ako to vidím = prepínač · čo urobím = tlačidlo · odkiaľ som prišiel = cesta.**

| Čo | Prvok | Existuje |
| --- | --- | --- |
| Iná stránka tej istej sekcie | `.tabs` + `TabLink` pod nadpisom sekcie, na všetkých jej stránkach rovnaké | ✅ ZAKLAD-zalozky |
| Iné zoskupenie toho istého zoznamu | `.view-switch` | ✅ `/library`, `/dpo`, `/hr/reminders` |
| Akcia | `.button`: **najviac jedno plné** na obrazovke, vpravo v riadku nadpisu (`.page-head` + `.page-head-spacer`); ostatné `.button--quiet` | ✅ |
| Návrat k rodičovi | cesta (`Breadcrumbs`). Odkaz „← Späť…" sa nekreslí | ✅ |

Výnimka zo „späť": **tlačidlo ďalšieho kroku na konci úlohy** — výsledok testu „Späť na časť", certifikát „Späť na kurz", `/learning` pri vypnutom module „Späť na Prehľad" (SHELL-menu-v-hlavicke Q5). Tie ostávajú.

## 1 — `.button--quiet` (celá aplikácia, len CSS)

```css
.button--quiet {
  background: var(--surface);          /* bolo transparent */
  color: var(--ink);
  border-color: var(--line-strong);    /* bolo --line */
}
.button--quiet:hover:not(:disabled) { background: var(--surface-2); }
```
Platí naraz pre detail dokumentu, karty, formuláre. V karte (biela na bielej) okraj `--line-strong` stačí na odlíšenie.

## 2 — HR: záložky sekcie

Nový komponent `components/SectionTabs.tsx` (serverový obal okolo `TabLink`) — `tabs: {href, label}[]`, `active` = najdlhšia zhoda cesty (`activeHref()` z `lib/appNav.ts`). Na `/hr`, `/hr/overview`, `/hr/reminders`, `/hr/tracks`, `/hr/evidence` (Q1):

- Nadpis **„Pridelené dokumenty"** (sekcia) na všetkých; úvodná veta (`page-lead`) pod záložkami je veta záložky (dnešné `intro` každej stránky). Vzor `/learning/tests`.
- Záložky: **Pridelenia** (`/hr`, Q4) · Výkaz potvrdení · Pripomienky · Trasy · Reťaz dôkazov (Q1).
- Záložky len na týchto piatich. Hlbšie stránky (`/hr/[id]`, `/hr/assign`, `/hr/tracks/[key]`, `notify`, `revoke`) ich nemajú — tam stačí cesta.
- „Prideliť dokument" → `.page-head` vpravo, len na záložke Pridelenia. Rad tlačidiel `hr/page.tsx:56–68` preč.
- `/hr/reminders`: nadpis sekcie, `noticeHeading`/`heading` ide do `page-lead` ako prvá veta, alebo ostáva v `<title>` (rozhodne Claude Code podľa i18n).
- `<title>` stránky ostáva názov záložky (`AppShell title=`) — karta prehliadača má povedať, kde človek je.

**Mobil (<640):** päť záložiek sa nezmestí — lišta sa posúva do strán (ako dnes), vpravo zoslabený okraj (`mask-image` alebo pseudo-element s prechodom do `--bg`), **aktívna záložka posunutá do zorného poľa** pri načítaní (Q3). Malý klientsky efekt v `SectionTabs`: `nav.scrollLeft = active.offsetLeft - 14` — **nie `scrollIntoView`** (posúva celú stránku). Bez JS lišta funguje, len začína zľava.

## 3 — `/hr/overview`: pohľad = prepínač

- `nav` s tlačidlami (`overview/page.tsx:112–121`) → `<nav className="view-switch">` s `view-switch-item` + `is-on` + `aria-current`, odkazy `?view=` bez zmeny.
- Riadok: prepínač vľavo, `.page-head-spacer`, „Stiahnuť ako CSV" (`button--quiet`) vpravo. CSV z riadku nadpisu preč.
- <640: prepínač cez celú šírku (`.view-switch { display:flex }`, položky `flex:1`), krátke popisy `hr.report.viewsShort` (Dokument / Osoba / Trasa); CSV pod ním na celú šírku.
- Pozor: `.view-switch` je pod 640 px dnes skrytý (`globals.css` ~3738, kvôli knižnici). Na `/dpo` sa vracia výnimkou `.dpo .view-switch` — rovnako pridať `.hr-report .view-switch { display:flex }`.

## 4 — `/people`: akcie do riadku nadpisu

- `.page-head`: nadpis, spacer, „Import z CSV" (quiet), „Pozvať všetkých" (quiet), „Pozvať osobu" (plné, posledné).
- <640: plné na celú šírku, dve tiché pod ním vedľa seba (mriežka 1fr 1fr).

## 5 — Odkazy späť preč

| Súbor | Odkaz | |
| --- | --- | --- |
| `hr/overview/page.tsx:97` | „← Späť na prehľad" | preč |
| `hr/tracks/page.tsx:46` | „Späť do knižnice" → `/library` | preč (navyše zlý cieľ, Trasy sú v HR od 2. 10.) |
| `learning/[courseKey]/[partKey]/page.tsx:78` | „← Späť na kurz" | preč (Q2) |
| `organisation/[section]/page.tsx:283` | `.org-back` „‹ Nastavenie organizácie" (<1024) | preč aj s CSS (Q2) |

Nepoužité i18n kľúče (`hr.detail.back`, ak ho nikto iný nečíta) zmazať.

## Rozhodnuté (2. 10. 2026 — všetky podľa odporúčania)

- **Q1 — Patrí „Reťaz dôkazov" (`/hr/evidence`) medzi záložky HR?**
  **Áno.** Dôvod: je pod `/hr`, robí ju tá istá rola (personalista, D67) a v menu ostane ako samostatná položka, takže sa nič nestratí; bez nej by `/hr/evidence` bola jediná stránka HR bez záložiek.
- **Q2 — Zrušiť aj „← Späť na kurz" na časti kurzu a „‹ Nastavenie organizácie" na mobile?**
  **Áno, obe.** Dôvod: v ceste je kurz aj Nastavenie organizácie ako odkaz, takže pravidlo platí bez výnimky; `.org-back` sme navrhli my 1. 10., nie je to Jánovo rozhodnutie. Ak by sa ukázalo, že na mobile chýba, vrátime ho ako výnimku.
- **Q3 — Na mobile posúvať lištu záložiek tak, aby bola aktívna vidieť?**
  **Áno.** Dôvod: na Výkaze by inak bolo vidieť Pridelenia a Pripomienky a človek by nevedel, kde je; je to päť riadkov kódu a bez JS sa nič nepokazí.
- **Q4 — Prvá záložka HR „Pridelenia"?** (nadpis sekcie je „Pridelené dokumenty", dve rovnaké slová nad sebou by sa čítali ako chyba)
  **„Pridelenia".** Dôvod: krátke, presné (zoznam pridelení) a nemýli sa s nadpisom ani s Prehľadom.

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | `/hr` dnes / návrh · `/hr/overview` dnes / návrh · `/people` dnes / návrh |
| **834** | ako 1440 (5 záložiek sa zmestí), nekreslí sa |
| **390** | `/hr` · `/hr/overview` · `/people` v tmavej téme |

## Údaje, ktoré v modeli NEEXISTUJÚ

Žiadne. Nové i18n (sk/cs/en): `hr.tabs.{assignments,report,reminders,tracks,evidence}` („Pridelenia", „Výkaz potvrdení", „Pripomienky", „Trasy", „Reťaz dôkazov"), `hr.tabsLabel` („Časti sekcie"), `hr.report.viewsShort.{document,person,track}` („Dokument", „Osoba", „Trasa").

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/ZAKLAD-podmenu-a-akcie.html + .md.
Vetva design/podmenu-a-akcie z main.

Pravidlo: kam idem = záložka (.tabs), ako to vidím = .view-switch,
čo urobím = tlačidlo (najviac 1 plné, vpravo v .page-head), odkiaľ som
prišiel = cesta (žiadne „← Späť…").

1. globals.css .button--quiet: background var(--surface),
   border-color var(--line-strong).
2. components/SectionTabs.tsx okolo TabLink; aktívna = activeHref().
   Na mobile posunúť aktívnu do zorného poľa cez nav.scrollLeft
   (NIE scrollIntoView) + zoslabený pravý okraj.
3. HR: /hr, /hr/overview, /hr/reminders, /hr/tracks, /hr/evidence —
   nadpis „Pridelené dokumenty", záložky Pridelenia · Výkaz potvrdení ·
   Pripomienky · Trasy · Reťaz dôkazov; intro záložky pod nimi.
   Rad tlačidiel v hr/page.tsx preč, „Prideliť dokument" do .page-head
   (len /hr). <title> = názov záložky.
4. /hr/overview: pohľady → .view-switch (?view= ostáva), CSV quiet
   vpravo v riadku prepínača; <640 prepínač cez celú šírku s krátkymi
   popismi, výnimka .hr-report .view-switch {display:flex}.
5. /people: akcie do .page-head (quiet, quiet, plné posledné);
   <640 plné na celú šírku, tiché 1fr 1fr pod ním.
6. Preč: hr/overview:97 „← Späť na prehľad", hr/tracks:46 „Späť do
   knižnice", learning/[courseKey]/[partKey]:78 „← Späť na kurz",
   organisation/[section]:283 .org-back (+ CSS). Výsledok testu,
   certifikát a /learning pri vypnutom module ostávajú.
7. i18n sk/cs/en podľa .md.

layout.tsx nemeniť. Over svetlú aj tmavú, 390/834/1440. Pred commitom
tsc, eslint, vitest, build. Komentáre: odkaz na ZAKLAD-podmenu-a-akcie
(2. 10. 2026).
```
