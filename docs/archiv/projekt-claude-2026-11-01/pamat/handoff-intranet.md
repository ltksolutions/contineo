---
name: handoff-intranet
description: Dizajnový handoff intranetu (design_handoff_contineo_intranet) — poradie krokov, rozhodnutia používateľa a rozpory návrhu proti kódu
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

Balík `design_handoff_contineo_intranet/` je **dizajnová referencia**, nie kód na skopírovanie. **Zoznam prác a stav krokov je v `docs/TODO.md`**, sekcia D2, podsekcia „Intranet — dizajnový handoff".

## Rozhodnutia používateľa (2026-09-07/08)

- **`layout.tsx` sa nemení.** Shell je opt-in obal `AppShell.tsx`; v ňom je zatiaľ len `/library`.
- **Predvolený `--accent` zostáva `#232a35`**; **`darken(hex, 0.16)` sa nemení.**
- i18n **po sekciách**; **nové CSS triedy anglicky** (viď [[konvencie-kodu]]).
- **Prepínač organizácie sa nerobí** — tenanta určuje hostiteľ (D29).
- **Hromadné akcie:** knižnica prideľovanie neprepisuje, výber odovzdá na `/hr/assign`; výber platí len pre viditeľnú stranu; dávka sa spracúva po dokumentoch.
- **Detail dokumentu:** editora sa nedotýkať; percento potvrdení dopočítať pre jeden dokument.
- Terminológia: **„Oddelenie", nie „Útvar"**; **„Druh" a „Značka"**, nie „Kategória" a „Štítok".

## Vlastné rozhodnutia, ktoré sa odchýlili od návrhu (a prečo)

- **Query builder nemieša „a" s „alebo"** — bez zátvoriek nemá `A alebo B a C` jednoznačný význam.
- **Pole a operátor v builderi sú jeden výber** („Názov obsahuje").
- **Nahrávanie má číslované sekcie, nie stepper** — schvaľovací krok z návrhu v systéme neexistuje.
- **Zóna na pretiahnutie je `<label>` okolo `<input type="file">`** — drag & drop bez skriptu.
- **Na telefóne idú v knižnici najprv výsledky, panel filtrov pod ne.**
- Vstupy 16 px kvôli iOS zoomu; ikony navigácie ani badge čísla sa nerobili.

## Stav (2026-09-08) — kroky 1–4, 5a a 5b sú v produkcii

**Zmergované do `main` a nasadené** (PR #1, #2, #3, merge commity `2534b44`, `9db595c`, `3edf36c`). Produkcia beží na `intranet.futbalsfz.sk`, `app.contineo.app`, `contineo-app.vercel.app` — overené, že nasadené CSS obsahuje nové triedy.

Vidno to na `/library`, `/library/[id]` a `/library/new`. **Úvodná stránka `/` je zámerne nezmenená** — to je krok 5c.

Zostáva: **5c** („Opýtať sa" na `/` — najpoužívanejšia stránka, opatrne), **6** (nastavenia organizácie), **7** (tmavá téma, `:focus-visible`, mobilná zásuvka filtrov, `<noscript>` cesty). Plus odložené veci v `docs/TODO.md`: oddelenie a percento potvrdení v zozname, zátvorky v builderi, presun ostatných stránok do shellu, premenovanie 125 CSS tried, `cache()` nad kontextami.

## Nasadenie a prostredia

- Vercel projekt `contineo-app` (`prj_m4nMtJakOfTVxI0Eow9vQD6edwtG`, tím `team_zOjpCy17mO8XqqD9qLALGQh4`), produkcia z `main`, `gh` na Macu prihlásený.
- **Preview nasadenia sú na dve veci nepoužiteľné:** sú za prihlásením do Vercelu (SSO) a hlavne **preview doména nie je v `hostnames` tenanta** — tenanta určuje hostiteľ (D29), takže preview skončí ako neznáma organizácia. Overovať treba lokálne alebo po merge.
- `npm run build` prepisuje `.next` bežiacemu dev serveru — spúšťať až na záver.

## Kde už niečo existuje — pozrieť skôr, než písať

- **`/hr/assign`** prideľuje N noriem × M publík s jedným dôvodom, bez JS, dôvod povinný (D30), znenie bez `effectiveFrom` odmietne (D6), a **číta `?document=…` z adresy**.
- **`assignDocument()`** (`lib/folders.ts`) presúva dokument do priečinka aj s auditom.
- `audienceMembers()` + `ACKNOWLEDGEMENTS_COLLECTION` = základ pre počítanie potvrdení.

## Pasce, ktoré ma stáli čas

- **`encodeURIComponent` nekóduje `~`** (ani `! * ' ( ) - _ .`).
- **Cascade:** `@media` blok patrí **za** deklarácie, ktoré prepisuje.
- **`display: grid` bez `grid-template-columns`** natiahne track na `max-content` → `minmax(0, 1fr)`.
- **Šírka stĺpca tabuľky nikdy na `:first-child`** — pridanie stĺpca ju presunie inam.
- **Podmienky Mongo dotazu skladaj do `$and`**: dva filtre s `$or` si ho v jednom objekte prepíšu.
- **Rozhodovač rovnosti pri triedení sa nesmie obracať** so smerom.
- `FormData.get()` vráti z opakovaného kľúča len prvú hodnotu.
- **Slovenská koncová úvodzovka v TS reťazci:** `„text"` s ASCII `"` ukončí reťazec (parse error). Použi `“`. To isté rozbije python heredoc.
- Cesta z formulára do `redirect()` vždy overiť prefixom — inak open redirect.
- `do shell script` so `sleep 60` a zloženými rúrami občas zlyhá — radšej krátke príkazy.

## Ako overiť vzhľad bez prihlásenia

`device_stage_files` na `globals.css`, v kontajneri statické HTML s markupom, ktorý React vykreslí, a screenshot cez Playwright (`/home/claude/.npm-global/lib/node_modules/playwright/index.js`). Tému prepneš `document.documentElement.dataset.theme`, farbu tenanta cez `--accent` / `--accent-strong` / `--accent-soft`. Odhalilo to deväť skutočných chýb, ktoré `tsc` ani testy nevidia.

## Aktualizácia 2026-09-21

- [stated] Rozhodnutie: implementovať sa má kompletný nový dizajn všetkých navrhnutých stránok projektu, nie len jednotlivé obrazovky.
- [stated] Handoffy pripravuje v Claude design projekte (tam je celý návrh) a ukladá ich do `~/GitHub/design_handoff_contineo_intranet/` (zatiaľ NASADENIE.md a KNIZNICA.md); jeden PR = jedno zadanie, nespájať.

## Aktualizácia 2026-09-22 — ako chodia zadania do `docs/design/`

- [stated] Odteraz už neposiela celé súbory do `docs/design/`, len konkrétne sekcie s miestom, kam patria.
- [stated] Keby predsa prišiel celý súbor, ktorý uberá riadky, mám sa zastaviť pred commitom.
