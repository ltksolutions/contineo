# Ako sa vyvíja a overuje

> Referenčný dokument pre každého, kto píše kód v `app/`. Pravidlá a pasce,
> ktoré sa v tomto repozitári opakovali — každá so stručným *prečo*. Dopĺňa
> `CLAUDE.md` (pravidlá, ktoré platia bez pripomínania) a `AKO_TO_BEZI.md`
> (ako beží jedna otázka). História, kedy čo vzniklo, je v `DEVLOG.md`.
>
> Vznikol 1. 11. 2026 prenesením poznatkov z archivovaného claude.ai
> projektu (`docs/archiv/projekt-claude-2026-11-01/pamat/`).

## 1. Skripty v `app/scripts/` a TypeScript

**V projekte nie je esbuild ani iný bundler** a nevracia sa (odstránený
28. 8. 2026 pri bezpečnostných aktualizáciách). Nepridávať ho ani cez `tsx`,
ktorý si ho ťahá so sebou.

Skript, ktorý importuje kód zo `src/`, beží priamo v Node s háčikom
`app/scripts/lib/ts-hook.mjs` — ten dopĺňa prípony k bezpríponovým
relatívnym importom (`./mongodb` → `./mongodb.ts`). Node TypeScript spustiť
vie (odstráni typy), ale v ESM vyžaduje príponu, kým TypeScript ju nechce.
Tvar npm skriptu:

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 \
     --env-file=.env.local --import ./scripts/lib/ts-hook.mjs scripts/<meno>.mjs
```

Dve pravidlá, bez ktorých to spadne až za behu:

1. **Typový import musí byť `import type`.** Odstraňovanie typov je textové —
   Node nevie, že `Collection` je interface, a `import { Collection }` sa pokúsi
   vykonať. Padne na `does not provide an export named 'X'` alebo pri CJS
   balíkoch (`mongodb`) na `is a CommonJS module, which may not support all
   named exports`. Pozor na zmiešané moduly: `providers/types.ts` exportuje
   samé typy okrem triedy `ProviderConfigError` — taký import treba rozdeliť.
2. **Žiadne parameter properties v konštruktore.** `constructor(readonly x:
   string)` nie je typový zápis, musí sa transformovať na kód; Node zahlási
   `TypeScript parameter property is not supported in strip-only mode`. Polia
   priraďovať výslovne.

**Logiku zo `src/` do skriptu neprepisovať.** Dve implementácie toho istého
pravidla (napríklad ktorá verzia dokumentu platí) sa raz rozídu a nikto si
to nevšimne, lebo obe „fungujú". Importovať skutočný modul — háčik na to je.

## 2. Testy

`npm test` = `vitest run` (`test:watch`, `test:coverage`). Konfigurácia je
`app/vitest.config.mts` — musí byť `.mts`, inak Vite hlási, že načíta ESM
ako CommonJS.

**Prečo Vitest, nie vlastný beh:** funkcie volajúce `getCollection()` sa bez
`vi.mock()` nedali otestovať vôbec — a boli medzi nimi tie najdôležitejšie
(brána prihlásenia, zápis potvrdenia, hromadný import). Alternatívou bol
testovací šev vo verejnom rozhraní každého modulu, a to je presne šum, ktorý
sa tu nerobí.

**Dva štýly, vedome.** Staré suity v tvare `t("popis", podmienka)` sa
**neprepisovali** — `tests/helper.ts` ich len registruje do Vitestu. 2 200
ručne prepísaných tvrdení je 2 200 príležitostí na preklep, a preklep v teste
sa neprejaví zlyhaním, ale falošným pokojom. Nové testy sa píšu idiomaticky
(`expect(...).toBe(...)`, `toMatchObject`, `resolves`): `t()` vie povedať len
„nebola pravda", `expect()` ukáže rozdiel hodnôt. Starú suitu prepísať vždy,
keď sa jej aj tak niekto dotýka.

**Kód nad databázou** sa testuje vzorom z `app/tests/onboardingDb.test.ts`:
`vi.mock("../src/lib/mongodb")` vracia falošné kolekcie (`findOne`,
`countDocuments`, `insertOne`, `updateOne`, `find`), ktoré sa v `beforeEach`
resetujú. Testuje sa **zloženie**, nie driver — napríklad že verziu určí
server a nedá sa podvrhnúť staršia, alebo že chyba DB v bráne prihlásenia
vráti `false`, nie `true`.

Keď test zámerne vyvolá chybu, ktorú kód loguje, stlm ju:
`vi.spyOn(console, "error").mockImplementation(() => {})`. Výpis, ktorý sa
naučíme prehliadať, prestane byť užitočný.

**Testujeme funkciu, nie preklady.** Výber jazyka, fallback na `sk`, invariant
„formulka v každom jazyku nesie názov, verziu aj dátum" — áno. Konkrétne
znenie českej vety — nie; to by bol slovník udržiavaný dvakrát.
`tests/i18n.test.ts` stráži, že `cs` a `en` majú rovnaké kľúče ako `sk`
a žiadny text nie je prázdny.

## 3. Build verzus dev server

`npm run build` a `npm run dev` (v `app/` aj vo `web/`) **zdieľajú priečinok
`.next`**. Build spustený popri bežiacom dev serveri mu prepíše chunky pod
rukami a server začne vracať 404 alebo 500 na každú stránku.

Počas ladenia v prehliadači overovať cez `npx tsc --noEmit`, `npx eslint .`
a `npx vitest run` — tie `.next` nechytajú. Build až na záver, alebo dev
server pred ním zastaviť. Náprava po kolízii je **reštart dev servera, nie
mazanie `.next`**; po `pkill` skontrolovať, že nezostali sirotské procesy
(`ps ax | grep -E 'next dev|next-server'`).

## 4. Git z pripojeného priečinka

Keď asistent pracuje z pripojeného priečinka (Linux VM nad macOS súbormi),
**mazanie súborov je blokované** — a git svoje `.lock` súbory práve maže.
`git commit`, `pull`, `stash` aj obyčajný `git status` tam po sebe nechajú
`.git/index.lock`, ktorý potom blokuje git na Macu („File exists").

Preto: z pripojeného priečinka **len čítať a editovať súbory**. `commit`,
`push`, `npm test`, `npm run build` spúšťať na Macu (Control your Mac,
`do shell script`), s `rm -f .git/index.lock` pred prvým git príkazom
a s `export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH`, inak `node` ani
`npm` nenájde. `node_modules` sú pre macOS/arm64 — v Linux VM `next` aj
`esbuild` padnú na „installed for another platform", nie je to chyba kódu.

Správa commitu s diakritikou cez `do shell script`: viac `-m` prepínačov
prejde bez problému; alternatíva je `git commit -F <súbor>`.

## 5. `.env.local` a premenné na Verceli

**`??` reaguje len na `undefined`, nie na prázdny reťazec.** Vzor
`process.env.X ?? "predvoľba"` pri riadku `X=` v `.env.local` predvoľbu
neprepustí — nastaví `""` a `$vectorSearch` spadne na `Path '' is not
indexed`. Prázdna premenná je horšia než chýbajúca: **nepotrebnú premennú
zakomentovať, nie vyprázdniť.** Pomocník `env(...names)` v
`src/lib/ecomail.ts` berie prvú *neprázdnu* premennú zo zoznamu a rieši aj
preklad starého názvu na nový — pri ďalšom preklade premennej použiť ten
istý vzor, aby nasadenie nespadlo medzi zmenou kódu a zmenou premennej.

**`vercel env pull` nie je obnova, je to strata.** Pri premennej typu
*Secret* zapíše doslova `X="[SENSITIVE]"` — a to prejde každou kontrolou
„je to vyplnené". Opakovaný pull prepíše aj ručne vyplnené hodnoty. Preto
pred pullom odložiť kópiu a pullovať do dočasného súboru, nie priamo do
`.env.local`. Hodnotu Secret premennej z Vercelu neprečíta ani CLI, ani
API — len UI cez Edit. Stĺpec „value" v `vercel env ls` **nie je hodnota**,
je to vnútorné kódovanie Vercelu; nediagnostikovať z neho.

**Zmena premennej na Verceli sa prejaví až novým nasadením** — premenné sa
viažu na build. Po každej zmene redeploy, inak beží stav, ktorý už
v konfigurácii nie je.

Odosielanie e-mailov sa z konfigurácie overiť nedá. Skutočný test je
vyžiadať si prihlasovací odkaz na `/sign-in` a pozrieť, či príde a s akou
adresou odosielateľa.

## 6. Pasce v kóde, ktoré už stáli čas

Každá sa stala aspoň raz. Poradie nič neznamená.

- **`@media` blok patrí za deklarácie, ktoré prepisuje** — kaskáda, nie
  špecificita. Blok napísaný pred nimi nerobí nič.
- **`display: grid` bez `grid-template-columns`** natiahne track na
  `max-content`; chceš `minmax(0, 1fr)`.
- **Šírka stĺpca tabuľky nikdy cez `:first-child`** — pridanie stĺpca ju
  presunie inam. Flex, ktorý pod 640 px ide do stĺpca, má deti so
  `flex-basis: auto` (spoločný blok na konci `globals.css`, viď `CLAUDE.md`).
- **Podmienky Mongo dotazu skladať do `$and`** — dva filtre, ktoré obe
  pridávajú `$or` do jedného objektu, si ho navzájom prepíšu.
- **Rozhodovač rovnosti pri triedení sa nesmie obracať** so smerom triedenia.
- **`FormData.get()` vráti z opakovaného kľúča len prvú hodnotu** — na
  zoznam je `getAll()`.
- **`encodeURIComponent` nekóduje `~`** (ani `! * ' ( ) - _ .`).
- **Slovenská koncová úvodzovka v TS reťazci:** `„text"` s ASCII `"` ukončí
  reťazec a je z toho parse error. V reťazci použiť `“`. To isté rozbije
  heredoc v Pythone.
- **Cesta z formulára do `redirect()` sa vždy overuje prefixom** — inak je
  to open redirect. A `redirect()` vyhadzuje výnimku: nie vnútri `try`,
  ktorého `catch` hlási chybu zápisu (`isRedirect()` v `lib/redirects.ts`).
- **Funkcia sa nedá odovzdať klientskemu komponentu** — hranicu RSC
  neprekročí a `tsc` to nevidí, lebo typ funkcie je platný typ.
  `tests/clientLabels.test.ts` hľadá prop typu `=> string` v každom
  `"use client"` súbore.
- **Dočasná mŕtva zóna v callbacku** — premenná použitá nad svojou
  deklaráciou vnútri funkcie prejde `tsc` aj buildom a spadne až pri
  vykreslení. Preto je `@typescript-eslint/no-use-before-define` zapnuté
  ako chyba (podrobne `CLAUDE.md`, „Čo tieto štyri brzdy nevidia").
- **Hromadné premenovanie regexom cez celý súbor** rozbije slovenské
  komentáre (slová *jazyk*, *verzia*, *dátum*, *osoba* sú v nich bežné)
  aj obsah regulárnych výrazov v testoch (`/verzia 1\.2/`). Nástroj musí
  rozdeliť zdroják na kód / komentár / reťazec a meniť len kód; regulárne
  výrazy ošetriť zvlášť.
- **Hláška po akcii je tvrdenie o tom, čo sa stalo.** „Pozvaná" pri akcii,
  ktorá e-mail neposiela, je nepravda, na ktorú test nepríde — treba ju
  prečítať očami človeka, ktorý na tlačidlo klikol.
- **Pravidlo, ktoré potrebuje obrazovka, server aj test, patrí do čistého
  modulu** bez `session.ts`/`cache()` — inak sa v teste nedá importovať
  (vzor: `needsInvitation()` v `lib/personFields.ts`).

## 7. Práca s jazykovým modelom v pipeline

- **Dlhé volania musia streamovať.** SDK odmieta nestreamované volanie
  s veľkým `max_tokens` („Streaming is required for operations that may
  take longer than 10 minutes") — a prepis cez `llmRewrite.ts` preto raz
  nefungoval vôbec. Rozpočet tokenov neznižovať; orezanie by prepis ticho
  zastavilo v polovici predpisu.
- **Zadanie pri štruktúrnych úrovniach musí byť doslovné a s príkladmi.**
  Voľné „obnov členenie" viedlo k tomu, že model skrátil `Článok` → `čl.`
  a úroveň `ČASŤ` zahodil. Model, ktorý dostane „obnov členenie", si
  členenie vymyslí.
- **Zhodné čísla nie sú dôkaz zhodného výsledku.** Oprava chunkera raz
  sedela v počtoch úsekov aj v podiele rozpoznaných článkov dokonale —
  a bola horšia, lebo zahadzovala `ods. N–N`. Odhalilo to až porovnanie
  textu úsekov. Analyzátor (`chunkingAnalysis.ts`) a chunker musia poznať
  ten istý tvar hlavičky.
- Overenie po zmene zadania stojí jedno volanie modelu: stiahnuť originál
  z GridFS, pustiť prepis a spočítať `ČASŤ`, `^#+\s*Článok N`,
  `^#+\s*čl\. N`. Veľké PDF beží cez 10 minút — na pozadí, `osascript` má
  krátky strop.

## 8. Ako overiť vzhľad bez prihlásenia

Statické HTML s markupom, ktorý React vykreslí, nad skutočným
`globals.css`, a screenshot cez Playwright na 390 px (tmavá) a 1440 px
(svetlá). Tému prepína `document.documentElement.dataset.theme`, farbu
tenanta `--accent` / `--accent-strong` / `--accent-soft`. Raz to odhalilo
deväť skutočných chýb, ktoré `tsc` ani testy nevidia. Čo platí pre
nasadenú stránku, je v `CLAUDE.md` („Ako sa overuje nasadená stránka").
