---
name: testy-vitest
description: "Testy v Contineu bežia na Vitest — ako sú písané, prečo sa neprepisovali a ako testovať kód nad databázou"
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:36:09Z
---

# Testy — Vitest (od 2026-08-27)

`npm test` = `vitest run` (+ `test:watch`, `test:coverage`). Konfigurácia: `app/vitest.config.mts` (musí byť `.mts`, inak Vite hlási, že načíta ESM ako CommonJS).

**Spúšťať na Macu cez Control your Mac** — v mounte to nejde, `node_modules` sú pre macOS/arm64. Viď [[git-workflow-mounted-repo]].

Stav po prechode: **16 súborov, 442 testov, ~0,7 s**.

## Prečo sa prešlo

Nie preto, že je to štandard. Konkrétny strop: funkcie volajúce `getCollection()` sa nedali otestovať **vôbec** — a boli medzi nimi tie najdôležitejšie: `osobaSmiePrihlasenie()` (brána medzi internými smernicami a internetom), `potvrd()` (zápis právneho záznamu), `zalozOsoby()` (hromadný import). Obísť sa to dalo len pridaním testovacieho švu do verejného rozhrania každého modulu, čo je presne ten šum, ktorý sa v tomto repe nerobí. `vi.mock()` to rieši bez toho.

## Ako sú testy písané — dva štýly, vedome

**Staré suity (13 súborov) sa NEPREPISOVALI.** Pôvodný tvar `t("popis", podmienka)` zostal; `tests/pomocnik.ts` ho len registruje do Vitestu. Dôvod: 2 200 riadkov ručne prepísaných tvrdení je 2 200 príležitostí na preklep, a v testoch sa preklep neprejaví zlyhaním, ale **falošným pokojom**.

**Nové testy píš idiomaticky** — `expect(skutočné).toBe(očakávané)`, `toMatchObject`, `resolves`. `t()` vie povedať len „nebola pravda"; `expect()` ukáže rozdiel hodnôt. Staré suity prepisovať postupne, vždy keď sa nejakej aj tak dotýkame.

`.mjs` suita (`chunker.test.mjs`) má most inline — kvôli dvom riadkom netreba ťahať TypeScriptový modul.

## Testovanie kódu nad databázou

Vzor je v `app/tests/onboardingDb.test.ts`: `vi.mock("../src/lib/mongodb")` vracia falošné kolekcie s `findOne`/`countDocuments`/`insertOne`/`updateOne`/`find`, ktoré sa v `beforeEach` resetujú. Testuje sa tým **zloženie**, nie mongodb driver — napr. že `potvrd()` si verziu určí na serveri a nedá sa podvrhnúť staršia, alebo že chyba DB v `osobaSmiePrihlasenie()` vráti `false`, nie `true`.

Keď test zámerne vyvolá chybu, ktorú kód loguje, stlm ju: `vi.spyOn(console, "error").mockImplementation(() => {})`. Výpis, ktorý sa naučíme prehliadať, prestane byť užitočný.

## Nedoriešené

- `app/tests/run.mjs` (starý beh testov) sa už nepoužíva, ale **nebol zmazaný** — mazanie súborov je na používateľovo slovo.
- **Bezpečnostné upozornenia v produkčných závislostiach** (nájdené pri inštalácii Vitestu, nesúvisia s ním): `next` 14.2.35 spadá do rozsahu vysoko závažného upozornenia, `postcss` ≤ 8.5.22 má XSS (GHSA-qx2v-qp2m-jg93). `npm audit fix --force` dvíha Next o hlavnú verziu — nerobiť pod termínom, naplánovať samostatne. Vedené v `docs/TODO.md` medzi bránami pred ostrou prevádzkou.
