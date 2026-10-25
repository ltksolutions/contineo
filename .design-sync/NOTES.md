# /design-sync — poznámky pre ďalšiu synchronizáciu

Projekt: „Contineo — design system" (`projectId` v `config.json`),
https://claude.ai/design/p/f95a5ca5-9a29-4e6d-8915-5818da1a2b0e. Pripája sa
k návrhovému projektu „Contineo.app responzivny design".

## Ako je to postavené
- Contineo nie je knižnica komponentov, ale Next.js aplikácia bez `dist/`.
  Vstup je `app/design-sync.entry.ts` — re-exportuje **len** čisto
  prezentačné komponenty (bez `next/link`, `next/navigation`, relácie, DB).
  Ostatné by sa v Claude Design nevykreslili.
- Vstup leží v `app/`, nie v `.design-sync/`: balíkom (PKG_DIR) musí byť
  `app/`, inak `cssEntry` (`src/app/globals.css`) a `@types/react` ležia
  „mimo balíka" a zostavenie ich preskočí.
- Typy props nie sú zo zostavených `.d.ts` (aplikácia ich nemá) — sú ručne
  v `config.json` → `dtsPropsFor`. **Pri zmene props komponentu ich treba
  upraviť ručne.**
- Vzhľad aplikácie nesú hlavne triedy z `globals.css`; opisuje ich
  `.design-sync/conventions.md` (hlavička README pre dizajnového agenta).

## Čo nejde a prečo
- `SubmitButton` je späť od 4. 10. 2026: aplikácia prešla na React 19
  (`app/package.json`), takže `useFormStatus` z `react-dom` je k dispozícii aj
  v balíku pre Claude Design. Dovtedy bol React 18.3.1 a náhľad bol prázdny.
- `Notice`, `TabLink`, `SectionTabs`, `Breadcrumbs`, `AppNav`… závisia od
  `next/link`/`next/navigation`. Ich vzhľad pokrývajú triedy (`.tabs`,
  `.tab`, `.view-switch`…) v conventions.md.

## Prostredie
- **V novom worktree** chýba `.ds-sync/` aj `ds-bundle/` (sú v `.gitignore`):
  skopírovať skripty skillu a nainštalovať `esbuild ts-morph @types/react
  playwright@1.63.0` do `.ds-sync/` (verzia playwrightu zodpovedá
  `chromium_headless_shell-1243` v `~/Library/Caches/ms-playwright`).
  Známky (`.design-sync/.cache/review/`) sú tiež len lokálne — úplný
  `package-capture` v novom worktree hlási nezmenené komponenty ako
  „need grading"; overené nahratím (kotva), netreba ich hodnotiť znova.
- Spúšťa sa z koreňa repozitára:
  `node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules app/node_modules --entry app/design-sync.entry.ts --out ./ds-bundle [--remote .design-sync/.cache/remote-sync.json]`
- Playwright + chromium-headless-shell v `.ds-sync/` (nainštalované 3. 10. 2026).

## Known render warns
- Sivá plocha pod každou bunkou na snímkach je pozadie `html` (`--bg`) pod
  bielym telom karty — artefakt snímky, nie chyba komponentu.

## Re-sync risks
- `dtsPropsFor` je ručná kópia props — zastará, keď sa zmení komponent.
- `conventions.md` menuje triedy a tokeny z `globals.css` — pri premenovaní
  triedy treba overiť (`grep` proti `ds-bundle/_ds_bundle.css`).
- React v `_vendor/` je z `app/node_modules` — pri zmene verzie Reactu v aplikácii sa celý balík nahrá znova.
- Zoznam ikon v `dtsPropsFor.Icon` je kópia kľúčov `PATHS` v `Icon.tsx`.
  Pri synchronizácii 8. 10. 2026 zastaral (chýbali `channels`, `helpdesk`,
  `edit`, `download`) aj `dtsPropsFor.SubmitButton` (chýbali `title`,
  `ariaPressed`, `disabled`, `pendingLabel`, `formAction`, `form`). Pred
  každou synchronizáciou porovnať s `git log --since=<posledná> -- <súbory
  z componentSrcMap>`; driver to nevidí, lebo náhľady sa nezmenili.
  23. 10. 2026 znova: chýbalo 7 ikon (`courier`, `link`, `bullets`,
  `numbered` z Kuriéra, `curation`, `tracks`, `compliance` zo Správy).
  Rýchla kontrola: porovnať kľúče `PATHS` v `Icon.tsx` so zoznamom
  v `dtsPropsFor.Icon` (krátky `node -e` skript nad oboma súbormi).
- `SubmitButton` importuje `@/lib/formPending` — ak by tam pribudla závislosť
  od Nextu alebo DB, balík pre Claude Design sa nezostaví.
- `conventions.md` od 8. 10. nesie aj `.set-savebar`, `.more`, `.lnote`,
  `.page-tools` a `.seg` — pri ich premenovaní v `globals.css` ju upraviť.

## RangeField (25. 10. 2026)
- Posuvník `.field-range` pribudol do `globals.css` a `conventions.md` (Ján
  25. 10., stropy úsekov MCP v AI asistentoch). Komponent je klientsky
  (`useState` pre zobrazenú hodnotu), bez Nextu — do knižnice patrí.
  Náhľad: `SearchCaps` (dva posuvníky s nápovedou) a `Bounds` (krajné
  hodnoty). V artefakte bez farby organizácie je jazdec v predvolenom
  `--accent` — svetlá téma tmavý, tmavá téma svetlý.
- `conventions.md` spomína „SwiftUI `Slider`" — kontrola mien to hlási ako
  komponent, ktorý v buildi nie je; je to odkaz na SwiftUI, nie chyba.

## Export do artefaktu (od 24. 10. 2026)
- **Publikovanie do artefaktu chce najprv `read` artefaktu (bez `path`)**
  v tej istej konverzácii — `list` ani `read` jedného súboru nestačí — a
  `file_path` ako **absolútnu** cestu; inak publikovanie odmietne s „You
  haven't viewed the latest version". 25. 10. verzia 10.
- `export-artifact.mjs` prekladá `ds-bundle/` do formátu typu *Design System*
  (`format.md` typu: `read` na artefakte, `artifact-type/reference/`). Index
  má `"editing": "code"` — stránka sa sama neukladá, každý export ju prepíše.
- Prvý export zmazal 70 ciest zo staršej migrácie (`_ds_bundle.*`,
  `_preview/`, `_vendor/`, `components/general/**`, `migration-map.json`,
  starý `manifest.json`) — do `--published` patrí aktuálny zoznam súborov.
- `.d.ts` server neprijme bez `contentType: "text/plain"`.
- Náhľad komponentu je `preview.html` (riadok 1 `@dsCard`, jeden `<script
  src="./preview.js">`) + `preview.js` = skompilovaný `_preview/<Comp>.js`
  s pripojeným mountom. Rámec artefaktu načíta tokens.css, bundle.css,
  `components/lib/react.js` (React 19 z aplikácie — `useFormStatus`
  v SubmitButton) a bundle.js.
- Obálka má triedy s prefixom `cover-` — `bundle.css` (globals.css) má `.tag`
  a prebil by ich.
- Overenie pred publikovaním: náhľad vložený do stránky s tokens.css,
  bundle.css, react.js a bundle.js (Playwright), svetlá aj tmavá téma.
  Pozor pri skladaní: vkladať cez funkciu `replace(x, () => …)` — v kóde
  Reactu je `$&` a reťazcová náhrada ho rozbije.
- Zobrazovač brand booku nepozná zalomené pokračovanie odrážky — každý riadok
  by bol odsek. Export ich spája (`joinListContinuations`); `conventions.md`
  ostáva zalomený na 90 znakov.
- Stránku artefaktu skontroloval Claude 24. 10. po Jánovom prihlásení
  vo vstavanom prehliadači: pás „synced from code", obálka, farby v oboch
  témach s kontrastom, živé náhľady všetkých 12 komponentov (spodné sa
  načítajú až pri posunutí).
