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
- `SubmitButton` vyradený: používa `useFormStatus` z `react-dom`, ktoré má
  len React 19 pribalený v Nexte. Do Claude Design ide React 18.3.1
  z `app/node_modules` a tam funkcia nie je — náhľad bol prázdny.
- `Notice`, `TabLink`, `SectionTabs`, `Breadcrumbs`, `AppNav`… závisia od
  `next/link`/`next/navigation`. Ich vzhľad pokrývajú triedy (`.tabs`,
  `.tab`, `.view-switch`…) v conventions.md.

## Prostredie
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
- Ak aplikácia prejde na React 19 v `node_modules`, dá sa vrátiť `SubmitButton`.
- Zoznam ikon v `dtsPropsFor.Icon` je kópia kľúčov `PATHS` v `Icon.tsx`.
