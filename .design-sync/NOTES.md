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
- `SubmitButton` importuje `@/lib/formPending` — ak by tam pribudla závislosť
  od Nextu alebo DB, balík pre Claude Design sa nezostaví.
- `conventions.md` od 8. 10. nesie aj `.set-savebar`, `.more`, `.lnote`,
  `.page-tools` a `.seg` — pri ich premenovaní v `globals.css` ju upraviť.
