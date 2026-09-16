# Devlog — Contineo

> Denník práce. **Nie je to `CHANGELOG.md`.** Changelog hovorí, *čo sa zmenilo*
> a je písaný pre toho, kto sa na projekt pozrie o rok. Devlog hovorí, *ako to
> šlo* — čo sa rozhodlo a prečo, čo nevyšlo, čo stálo čas a čo by som nabudúce
> urobil inak. Zápis vzniká na konci pracovného dňa.
>
> Založené 2026-09-15. Staršie dni zapísané nie sú; ich stopa je v `CHANGELOG.md`
> a v `git log`.

---

## 2026-09-16 (neskoro večer) — audit webu a moja druhá chyba v O18

Ján dal skontrolovať marketingový web proti skutočnosti. Rovnaká metóda ako pri
dokumentácii, iný kľúč triedenia: web **smie** hovoriť o vízii, nesmie ju vydávať
za dnešok. Výsledok: **48 tvrdení, ktoré opísujú ako hotové niečo, čo nie je** —
a každé tri razy, lebo slovník má SK, CZ aj EN.

### Chyba, ktorú našiel audit webu u mňa

Pri O18 som dvakrát napísal, že text opúšťa infraštruktúru „na dvoch miestach".
Je to **štyrikrát**: prepis dotazu (Anthropic Haiku), embedding, preradenie
a generovanie. Prepis dotazu som vynechal úplne — beží pred vyhľadávaním
a predvolene je zapnutý.

Najčastejšie by som povedal, že som to prehliadol. Ale stalo sa niečo konkrétnejšie:
`AKO_TO_BEZI.md` má nad tabuľkou vetu „text otázky opustí EÚ **trikrát**" a pod ňou
tabuľku so **štyrmi riadkami**. Prevzal som číslo z vety namiesto toho, aby som
spočítal riadky. **Keď dokument uvádza číslo aj zoznam, platí zoznam** — presne
ako pri kóde a dokumentácii. Opravené na oboch miestach vrátane samotného
`AKO_TO_BEZI.md`, ktorý si protirečil od júla.

### Čo to znamená pre web

Tri najzavažnejšie veci nie sú štýlové. Web sľubuje **on-prem a „data ostanú
u vás"** (segment, ktorý si podľa toho vyberá dodáváteľa), **helpdesk a ticketing**
(v názve produktu, v pilieroch aj v deme) a **prihlásenie cez sportnet.online**
v prípadovej štúdii. Ani jedno neexistuje. Text sa nepíše sám — predložené Jánovi
ako plán, nie opravé potichu: je to jeho pozicioning, nie moja vec.

---

## 2026-09-16 (večer) — O17: z auditu vyšla prvá zmena kódu

Audit skôr dnes našiel zásadu o pseudonymizácii a kolekciu, ktorá ju nespĺňa.
Ján sa spýtal to správne: **„potrebujeme e-mail? nestačí nejaké internal/external
ID?"** — a tá otázka rozhodla celý návrh.

### Čo ma na tom prekvapilo

**Tretí prípad neexistoval.** Ján váhal medzi `personId` a externým ID, lebo si
predstavil človeka prihláseného cez cudzí systém. Keď som sa pozrel do kódu,
`persons` už nesie `externalRef { sportnetId, entraObjectId, googleSub }`
a D47 osobu pri prihlásení zakladá automaticky — takže taký človek **má
`personId`**. Otázka sa tým zmenšila z troch možností na dve. Poučenie:
keď sa návrh láme na „čo keď nastane X", najprv over, či X vôbec môže nastať.

**Argument, ktorý som skoro nepovedal.** Chcel som porovnávať `personId`
a externé ID podľa toho, ktoré je „bezpečnejšie". Nie je to tak: **oba sú
pseudonymné identifikátory a oba sú osobný údaj.** Zisk nie je v tvare
identifikátora, ale v tom, že väzba zomrie s osobou. Bez tejto vety by sa
rozhodovalo o nesprávnej veci.

**Skoro som zachoval literál, ktorý už nič neznamená.** Plán rátal s tým, že
`"anonym"` treba nechať kvôli `delete_test_data.mjs`. Spočítal som to a v produkcii
je **0 takých záznamov** — skript už nemá čo robiť a obmedzenie zmizlo.

### Detail, ktorý sa oplatí držať

Invariant v `npm run check` (žiadne `@` v podpisových poliach) nie je opatrnosť navyše.
Sú to polia, ktoré sa bežne nečítajú — keby ich jeden zabudnutý volajúci začal
plniť e-mailom, nezistilo by sa to málokedy, ale **nikdy**.

---

## 2026-09-16 — audit dokumentácie proti kódu

**Zadanie Jána:** „Doplnme správne dokumentáciu nech je to v súlade so
skutočnosťou, oprav aj tie docstringy."

### Ako sa to robilo

Nie čítaním od začiatku. Najprv som z kódu vytiahol **pravdu**: zoznam ciest
(`find src/app -name page.tsx`), `npm run` príkazov z `package.json`, kolekcií
(konštanty `*_COLLECTION` + `getCollection()`) a rolí. Až potom sa proti tomuto
zoznamu merali dokumenty — v štyroch paralelných dávkach, každá s tým istým
zadaním a tým istým kľúčom triedenia: **A** nepravdivý opis súčasnosti,
**B** datovaný zápis, **C** plán. Bez toho kľúča by audit skončil návrhom
prepísať históriu — a to je horšie než zastaralý zápis.

Výsledok: **93 nezrovnalostí typu A**, 31 typu B. Nič z toho nebolo vidieť
„pri bežnom čítaní"; väčšina vyzerá správne, kým si nečítate kód.

### Čo ma prekvapilo

**Dokument o prístupových právach mlčal o polovici mechanizmu prístupu.**
`PRISTUPOVE_PRAVA.md` popisuje polia na obsahu, ale o tom, že `accessLevel`
kurovaných odpovedí sa **odvodzuje**, nemal ani vetu. Nie je to nepravdivé
tvrdenie — je to diera, a diery audit nájde ťažšie než omyly.

**Najhorší nález bol pravdivý opak.** `INGESTION` tvrdilo, že prevod skenov
robí model s automatickým ústupom. D53 pritom zakázala práve ten tichý ústup
a hlavička `conversion.ts` to vysvetľuje na desiatich riadkoch. Dokument
a kód si protirečili v zásade, nie v detaile.

**Hlavičky modulov klamali plošne.** Devätnásť súborov v `lib/` sa
predstavovalo slovenským menom z čias pred premenovaním. Našlo sa to jedným
cyklom — porovnaj prvý riadok hlavičky s `basename`. Taký test by mohol byť
v `npm run check`.

### Druhá polovica (po schválení)

Dva balíky som najprv **nechal na schválenie** — prepis stavových sekcií (tam sa
nemení meno, ale obsah kapitoly) a GDPR (podklad pre DPO). Ján ich schválil
a dobehli v ten istý deň.

**Najužitočnejší krok celého dňa bol jeden príkaz:** `vercel env ls production`.
Dokument tvrdil, že nastavená je `NEXTAUTH_URL` (ktorá nastavená byť **nesmie**)
a že chýbajú `VERCEL_TOKEN` a `OAUTH_SECRET_ENCRYPTION_KEY`. Skutočnosť bola
presne opačná v oboch smeroch. Tri otvorené položky v troch dokumentoch tým
padli. **Poučenie:** keď sa dokument odvoláva na stav vonkajšieho systému,
overiť sa dá priamo — a spravidla to trvá kratšie než prečítať odsek o ňom.

**Čo som odmietol prepísať.** Dve zásady v GDPR sú napísané ako splnené
a splnené nie sú: `evaluations` drží e-maily doslovne, a hoci úložisko je v EÚ,
embedding a rerank idú cez Atlas. Opraviť ich „formuláciou" by znamenalo
zamiesť problém pod dokument, ktorý ide DPO. Sú označené ako **O17** a **O18**
a čakajú na rozhodnutie.

### Poznámka bokom

`docs/SPRAVA_TENANTOV.md` má v hlavičke e-mail správcovského konta. Oznámené
Jánovi; **rozhodol nechať** — je to všeobecné firemné konto, nie osobný ani
prístupový údaj. Pravidlo o tajomstvách sa naň nevzťahuje.

---

## 2026-09-15 — meranie kvality: von so zlatou sadou, dnu s prevádzkou

**Commity:** `75a494d`, `98af0a8`, `e38eec8`, `b556a00`, `29285f5`, `0533101`,
`3abeae5`, `7b90ac4`. Deň mal jednu líniu: reťaz *bežný človek → hodnotiteľ →
overená odpoveď v znalostiach*.

### Rozhodnutia (Ján Letko)

- **Zlatá sada von, celá.** Nie odložiť, nie zmenšiť — zrušiť. Dva mesiace bez
  jediného posudku sú odpoveď. `docs/ADR-008-zrusenie-zlatej-sady.md`.
- **Rola `evaluator`.** Bežný človek povie „sedí / nesedí" a čo mu vadilo;
  posudok potvrdzuje a opravuje hodnotiteľ. Identifikátor po anglicky,
  preklady SK/CZ/EN.
- **Kurácia ako stav na zázname** (varianta A), nie nová kolekcia.
- **„Únik cez `accessLevel` nikdy nesmie nastať."** Táto veta určila návrh
  celej kurácie viac než čokoľvek iné.
- **Štítok „overená odpoveď"** v zozname zdrojov.
- **Premenovať `spravca-obsahu` → `content-admin`.**

### Čo nevyšlo a čo sa z toho dá vziať

**Založil som kolekciu `answer_reports`, ktorá duplikovala `evaluations`.**
Najdrahšia chyba dňa a celá moja. Hlásenie nepresnosti *je* pole existujúceho
záznamu o odpovedi — otázka aj odpoveď už v ňom sú. Opravené v `75a494d`,
kolekcia zahodená. Poučenie je krátke: **pred novou kolekciou sa pozrieť, čo
už existuje**, nie navrhovať od nuly.

**Vercel 86 minút nenasadil `98af0a8`.** Diagnostika po vrstvách, nie hádanie:
projekt nie je pozastavený (`paused: null`), väzba na git drží
(`productionBranch: main`, sedí `repoId`), `commandForIgnoringBuildStep` nie je
nastavený, konto aktívne. Rozhodol až pohľad do GitHubu: `main` na správnom
SHA, ale **0 commit statuses** oproti štyrom pri predchádzajúcom commite —
teda Vercel sa o pushi nikdy nedozvedel. Stratené doručenie webhooku GitHub
App. Riešené vytvorením nasadenia cez API (`POST /v13/deployments` s
`gitSource`). Ďalšie dva pushe sa nasadili samy, takže to bol jednorazový
výpadok. **Nabudúce:** ak nasadenie nenabehne do pár minút, ísť rovno na
commit statuses v GitHube; to je najkratšia cesta k rozlíšeniu „Vercel to
nevzal" od „Vercel to nedostal".

**Skript na úpravu `i18n.ts` prestrelil koniec skupiny.** Typový blok sa
zatvára `  }` bez čiarky, hľadalo sa `  },` — tak zmizli aj `admin`, `org`,
`people` a `errors`. Chytil to `tsc` (~30 chýb), nie oko. `git checkout --` a
skript prepísať tak, aby uznal oba tvary.

**Slovenské úvodzovky mi dvakrát ukončili reťazec.** `„Nesedí"` — zatvárací
znak je `“`, nie `"`. TS1002/TS1005. Pri generovaní TSX z Pythonu je to pasca,
do ktorej sa dá spadnúť opakovane.

**Skoro som odstránil `preset`.** Vyzeralo to ako zvyšok po zlatej sade; v
skutočnosti je to odovzdanie otázky z hlavičky na `/ask?q=`. Chytil `tsc`.
Doplnený komentár, nech to nabudúce nevyzerá ako sirota.

**`.next/types/validator.ts` sa odvolával na zmazanú routu.** Typová kontrola
padala na súbore, ktorý sa generuje. `rm -rf .next/types` pred každým `tsc`.

**Git na Macu si vypýtal licenciu Xcode** uprostred práce. Dočasne
`/Library/Developer/CommandLineTools/usr/bin/git`, potom to Ján vyriešil
natrvalo (`xcodebuild -license`).

### Nález, ktorý stál za celý deň

Pri štítku sa ukázalo, že **`saveMetadata()` prepisoval `accessLevel` na
všetkých úsekoch dokumentu vrátane kurovaných párov**. Pár odvodený z troch
predpisov by prevzal úroveň jedného z nich — stačilo prepnúť ten jeden na
verejný. Nenašlo sa to premýšľaním o kurácii, ale čítaním všetkých ciest
zápisu do knižnice. Odvtedy je v hlavičke `lib/curation.ts` napísané, čo každá
z nich s párom robí, aby sa to pri štvrtej ceste (RSS, e-mail, ISSF) nemuselo
objavovať znova.

### Vedomé obmedzenie

`buildSources()` doteraz neniesol `chunkId`, takže **odpovede spred dneška sa
kurovať nedajú** — nedá sa spätne povedať, z ktorých úsekov vznikli, a úroveň
prístupu by bola odhad. Radšej nič než pár, ktorého úroveň je odhad.

### Stav na konci dňa

`main` nasadený na `intranet.futbalsfz.sk`, `npm run check` bez nálezu, 1318
testov zelených, `eslint` 0 errors. Overované na produkcii, nie na dôvere:
čitateľova cesta („nesedí" + poznámka → fronta), posudok hodnotiteľa
(`evaluatedAt`/`evaluatedBy` v databáze, položka z fronty zmizne), kurácia
(pripraviť → zverejniť → štítok v živej odpovedi → archivovať) aj premenovanie
roly (pred migráciou, po nej a po odstránení prechodu).

**Otvorené** je v `docs/TODO.md` — tlmenie páru v poradí (spúšťač: po prvých
desiatich pároch), štvrtá cesta zápisu, brána pred go-live nad rámec tvrdého
prahu na únik, retencia `evaluations` a zmienka o „eval sade D9" na verejnom
webe.
