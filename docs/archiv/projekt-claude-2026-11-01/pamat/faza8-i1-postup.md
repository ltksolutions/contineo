---
name: faza8-i1-postup
description: "Fáza 8 / I1 — ultra-MVP onboardingu beží v testovacom prostredí; čo kde je a čo zostáva"
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

# Fáza 8 / I1 — prostredie stojí (2026-08-28)

Repo čisté a zosynchronizované. **18 súborov testov, 464 testov**, `type-check` čistý, `next build` prechádza, `npm audit`: **0 zraniteľností**.

## Stav prostredia

- **Atlas M10** (AWS Frankfurt) s Cloud Backup — **D31 vybavené**.
- Kolekcie `persons`, `acknowledgements`, `onboarding_tracks` + indexy **založené v živej databáze** (`npm run seed:test`, `node scripts/onboarding_init.mjs`).
- **Skúšobný dokument** `sfz:test_onboarding` (verzia 1.0, platná od 1. 1. 2026), trasa `test-2026`, osoba správcu ([e-mail maskovaný]).
- Vercel má všetky premenné **vrátane `ECOMAIL_API_KEY`** — prihlasovanie odkazom v e-maile má fungovať. (`NASADENIE_app.md` tvrdil opak, opravené.)

**9 skutočných noriem SFZ sa potvrdiť NEDÁ** — v `.meta.json` majú `effectiveFrom: null`. Nikto im platnosť nevyhlásil a **dátumy sa nesmú vymýšľať**; je to vyhlásenie kurátora (D25). Doplniť do `app/data/vzorky/*.meta.json` a znova spustiť import.

## Verzie a bezpečnosť (2026-08-28)

Next **14.2.35 → 16.3.3**, next-auth → **4.24.15**, `esbuild` odstránený z devDependencies (zostal po starom behu testov, držal strom na neplatnej verzii pre Vite 8 a bol posledným upozornením). Audit hlásil **21 upozornení pre Next**; oprava existuje až v 16.x.

Migrácia bola menšia, než hrozila: **next-auth 4.24.15 podporuje Next 16** (žiadny Auth.js v5) a **Next 16 akceptuje React 18** (žiadny React 19). Zásah do kódu si vyžiadali len `params` a `searchParams`, ktoré sú od Next 15 **prísľuby** — upravené `prihlasenie`, `sada/[id]`, `dokumenty/[documentId]`.

## Rozhodnutia v kóde, ktoré sa nesmú stratiť

- **Núdzová brzda ide prvá**; **chyba DB neotvára prístup**.
- **Dokument sa načítava pre osobu** (`loadDocumentFor`) — aj v `acknowledge()`. Neviditeľný sa tvári ako neexistujúci.
- **Verzia bez `effectiveFrom` neplatí**; **verziu určuje server**; **znenie na obrazovke skladá tá istá funkcia, ktorá ho ukladá**; čítaný text sa berie **z verzie**, nie z dokumentu.
- „Už potvrdené" = **409**. Import **nezapíše nič**, keď je čo i len jeden riadok chybný.
- Prihlásený bez záznamu v `persons` dostane vetu, **nie presmerovanie na prihlásenie** (vyzeralo by to ako odhlásenie).

## Zostáva

1. **Vercel Static IPs** (O12) — až na ostrú prevádzku, tak sa dohodlo.
2. `app/tests/run.mjs` je mŕtvy (esbuild odstránený) — **čaká na slovo o zmazaní**.
3. Rozsah B (I2): HR dashboard, hromadné pozvánky a pripomienky, opätovné potvrdenie pri novej verzii, profil tenanta podľa hostiteľa (D29).
4. Preklad rozhrania do CS/EN.
