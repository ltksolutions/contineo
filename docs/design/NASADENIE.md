# Nasadenie návrhu do contineo — plán po PR

Tento dokument nadväzuje na `design_handoff_contineo_intranet/README.md` (pôvodný desktop
návrh) a nahrádza jeho časť o navigácii a responzivite. Zdroj pravdy pre vzhľad sú súbory
`Contineo Obrazovky.dc.html` (sada prvkov + obrazovky v 3 šírkach) a
`Contineo Mobile.dc.html` (audit + mobilná knižnica).

**Súbory sú dizajnová referencia, nie kód na skopírovanie.** Inline štýly v nich sú
technická požiadavka prostredia prototypu. V produkcii ide všetko do
`app/src/app/globals.css` a do komponentov v `app/src/components/`.

---

## Čo je hotové v repozitári a čo sa mení

Existuje a **zostáva**: `AppShell.tsx`, `AppNav.tsx`, `appNav.ts`, `MultiSelect.tsx`,
`Icon.tsx`, `ContineoMark.tsx`, `ColorSelect.tsx`, `TenantHeader.tsx`,
facety a query builder v `library/page.tsx`.

Mení sa **tvar** týchto vecí na úzkych šírkach, nie ich logika.

---

## PR 1 — Tokeny a breakpointy

**Prečo prvé:** všetko ostatné z nich číta.

1. `globals.css` — pridať do **oboch** blokov (`:root` aj `html[data-theme="dark"]`):
   ```
   --accent-soft   /* accent @ 11 % alfa */
   --pad-main      16px  /* vzdušná 28px */
   --card-pad      16px  /* 24px */
   --list-py        9px  /* 14px */
   --gap           14px  /* 20px */
   --row-py         7px  /* 12px */
   --font-row      13px  /* 14px */
   ```
   `--accent` ostáva `#232a35`. `--accent-strong` ostáva `darken(hex, 0.16)`.
   `--accent-soft` doplniť do `tenantStyle()` v `TenantHeader.tsx` ako
   `rgba(r, g, b, .11)`.

2. **Breakpointy zjednotiť na dva: 640 a 1024.** Dnes ich je osem
   (419 · 520 · 560 · 640 · 760 · 860 · 900 · 940). Prejsť `globals.css` a každý
   `@media` presunúť na najbližší z dvoch. Toto je mechanická, ale nutná úprava —
   bez nej sa layout medzi telefónom a notebookom preskupuje osemkrát.

3. **Dotykové ciele 44 px** pod 640 px: `.facet`, `.library-chip`, `.tree-row`,
   × v chipoch, „Upraviť" v strome.

Nič vizuálne sa zatiaľ nemení. Merateľné: `grep -c "@media" globals.css` klesne na ~2
skupiny.

---

## PR 2 — Navigácia: spodná lišta a prepad do „Viac"

**Súbor:** `AppNav.tsx`, `appNav.ts`, nová routa `/more`.

1. **Pod 640 px** — namiesto `<details>` zásuvky hore je **pevná spodná lišta**
   s piatimi položkami: Prehľad · Opýtať sa · Knižnica · Úlohy · Viac.
   - „Úlohy" zlučuje `toAcknowledge + toApprove` (súčet do odznaku).
   - Zvyšok `navItems()` ide na `/more` — zoznam v skupinách
     (Organizácia / Správa / Účet), riadky 52 px.
   - Lišta: výška 56 px + `env(safe-area-inset-bottom)`, ikona 21 px nad
     popiskom 10,5 px, aktívna v `--accent`.

2. **640–1023 px** — vodorovný pás pod hlavičkou, výška 44 px.
   Položky, ktoré sa nezmestia, spadnú do tlačidla **„Viac N"** na konci pásu,
   ktoré otvorí ponuku (`<details>` ukotvený vpravo).
   **Pás sa nikdy neroluje vodorovne** — skrytá položka, ktorú treba najprv nájsť
   posunutím, je pre väčšinu ľudí stratená položka.
   Meranie šírky: `ResizeObserver` na páse, položky sa presúvajú do „Viac", kým
   `scrollWidth > clientWidth`. Bez JS sa vykreslí prvých 6 + „Viac".

3. **≥ 1024 px** — ten istý pás, 42 px, všetkých 10 položiek sa zmestí.

Jedno pole položiek z `navItems()`, tri tvary. Odznak sa kreslí len keď je `> 0`.

---

## PR 3 — Hlavička

**Súbor:** `Header.tsx`, `AppShell.tsx`.

- **Jedna hlavička, nie dve.** Dnes `layout.tsx` kreslí Header a AppShell pridá
  druhý pás — na 390 px je prvý dokument až pod ~1 100 px. Zlúčiť do jednej,
  výška 56 px na všetkých šírkach.
- Obsah zľava: **logo** · názov organizácie · pole „opýtať sa" · zvonček · avatár.
- **Logo:** ak tenant nahral logo, servíruje sa z `/api/brand/<code>?v=<version>`;
  ak nie, **predvolené je značka Continea** (`ContineoMark`) v bielej na
  `--accent` — nie iniciála z názvu. Iniciála vyzerá ako rozbité logo.
  Rozmer 28 px (r8) na všetkých šírkach.
- **Pole:** výška 36, r9, značka Continea 16 px vľavo, `⌘K` vpravo (mizne
  pod 640 px). Značka, nie lupa — nie je to hľadanie, je to otázka.
  Rovnaké rozmery na desktope, tablete aj telefóne.
- **Názov organizácie** sa pod 640 px skracuje na `shortName` (napr. „SFZ"),
  nie na ellipsis — skratku má tenant v dátach.
- Zvonček: ikona `notifications`, **treba doplniť do `Icon.tsx`** (v návrhu je
  nakreslená na mriežke 18×18). Bodka `--bad-fg` 7 px s 2px lemom `--surface`.

---

## PR 4 — Knižnica

**Súbor:** `library/page.tsx`, `globals.css`, nová routa `/library/folders`.

1. **Správa priečinkov von z panelu filtrov.** Dnes je v ňom premenovanie, presun,
   mazanie, poradie ťahaním a tvorba nového — na mobile je to stĺpec dlhý stovky
   riadkov pod výsledkami. Presunúť `TreeWithOrder` + formuláre na
   `/library/folders`; v paneli ostane len **výber** priečinka a odkaz
   „Správa priečinkov →". Filtrovanie a správa sú dve úlohy.

2. **Filtre: stĺpec ↔ sheet.**
   - ≥ 1024 px: ľavý stĺpec 250 px — facety ako checkbox riadky 34 px,
     štítky (MultiSelect), priečinky.
   - < 1024 px: tlačidlo **„Filtre N"** vedľa poľa hľadania otvorí
     `<details class="filter-sheet">` ukotvený dole. Ten istý obsah, iný tvar:
     facety ako pilulky 36 px (r9, rámik), primárne „Zobraziť N dokumentov"
     na celú šírku dole.

3. **Hromadné akcie až po označení.** `filters.picked` je už v URL, takže server
   vie, či niečo je označené — `.bulk-bar` vykresliť len keď
   `picked.length > 0`. Na telefóne nahradí spodnú lištu. No-JS ostáva.

4. **Tabuľka ↔ karty.** Pod 640 px len karty, prepínač skrytý (tabuľka má
   `min-width` ~1160 px, na 390 px z nej ostane názov). Od 1024 px tabuľka.

5. **Akcie v hlavičke.** Primárna je jedna („Nahrať dokument"), Export CSV
   sekundárna, zvyšok (Kolá, Kurácia) do ponuky „⋯". Dnes sa šesť tlačidiel
   na telefóne zalomí do troch riadkov.

---

## PR 5 — Detail dokumentu a Prehľad

- **Detail:** `AcknowledgeButton` pod 640 px ako **sticky spodný pás**
  (výška 50, r12, celá šírka) — potvrdenie je dôvod, prečo je človek na stránke.
  Pravý panel (potvrdenia, metadáta, súvisiace) sa na telefóne stáva kartou
  **nad** textom, nie pod ním.
- **Prehľad** do AppShellu: KPI 2×2 na telefóne, 4×1 na desktope; zoznam úloh
  s termínovým chipom; „Novinky v knižnici".
- **Na potvrdenie / Na schválenie:** desktop tabuľka, telefón karty.
  Pri schvaľovaní sú na telefóne obe akcie pod sebou, každá 44 px — „Schváliť"
  a „Vrátiť s pripomienkou" vedľa seba sa na 390 px preklikávajú omylom.

---

## PR 6 — Adresár a zvyšok

- **Adresár:** karty na **všetkých** šírkach (3 / 2 / 1 stĺpec). Tabuľka so
  šiestimi stĺpcami sa na telefóne nečíta. Na telefóne sú e-mail a telefón
  **akcie** (36 px tlačidlá), nie text na prečítanie.
- Pridelené normy, Reťaz dôkazov, Osoby, Na posúdenie — rovnaký vzor
  (desktop tabuľka / mobil karty), návrh dorobím na požiadanie.

---

## Prierezové veci

**i18n** — `CLAUDE.md` zakazuje text natvrdo; všetko cez `lib/i18n.ts` v sk/cs/en.
Slovenské texty v návrhu sú zadanie pre `sk` vetvu. Postupovať po sekciách:
najprv celý interface sekcie, potom sk, cs, en ako blok. Sekcie v poradí
implementácie (nav → hlavička → knižnica → detail → adresár).

**Ikony** — všetko z `Icon.tsx` (mriežka 18×18, `strokeWidth` sa dopočítava tak,
aby vykreslený ťah bol vždy 1,5 px). Doplniť treba **`notifications`** (zvonček);
v návrhu je nakreslený na tej istej mriežke. Žiadny externý set.

**Tmavá téma** — po každom PR prejsť `html[data-theme="dark"]`. Návrh ju
neporušuje (používa len tokeny), ale nové tokeny musia byť v oboch blokoch.

**No-JS** — spodná lišta, sheet filtrov aj „Viac" sú `<details>` alebo odkazy.
Nič z toho nevyžaduje JS. Hromadné akcie sa riadia `picked` v URL.

**`:focus-visible`** — doplniť viditeľný focus na tlačidlá a riadky tabuliek;
prototyp to má len na vstupoch.

---

## Poradie a veľkosť

| PR | Rozsah | Riziko |
| --- | --- | --- |
| 1 · Tokeny a breakpointy | stredný, mechanický | nízke — nič sa vizuálne nemení |
| 2 · Navigácia | stredný | stredné — nová routa `/more` |
| 3 · Hlavička | malý | stredné — zlúčenie dvoch hlavičiek |
| 4 · Knižnica | **veľký** | vyššie — nová routa `/library/folders` |
| 5 · Detail a Prehľad | stredný | nízke |
| 6 · Adresár a zvyšok | malý | nízke |

PR 1 a 2 sa dajú mergnúť nezávisle. PR 4 je najväčší — neskladať ho s ničím iným.

**`layout.tsx` sa nemení.** AppShell ostáva opt-in obal, ktorý si stránka vyžiada
sama. Stránky sa doň presúvajú po jednej, každá vlastným PR. Kým je stránka mimo
shellu, funguje presne ako dnes.
