# Devlog — Contineo

> Denník práce. **Nie je to `CHANGELOG.md`.** Changelog hovorí, *čo sa zmenilo*
> a je písaný pre toho, kto sa na projekt pozrie o rok. Devlog hovorí, *ako to
> šlo* — čo sa rozhodlo a prečo, čo nevyšlo, čo stálo čas a čo by som nabudúce
> urobil inak. Zápis vzniká na konci pracovného dňa.
>
> Založené 2026-09-15. Staršie dni zapísané nie sú; ich stopa je v `CHANGELOG.md`
> a v `git log`.

---

## 2026-09-17 (noc) — bezpečnostná kontrola pred prvou ostrou verziou

Ján si vyžiadal komplexnú kontrolu: kód, závislosti, infra a súlad webu
s repozitárom, plus zápis on-prem cesty. Výsledok je v
`docs/BEZPECNOSTNA_KONTROLA_2026-09.md` a `docs/ADR-009-on-prem-referencna-architektura.md`.

**V kóde sa kritická diera nenašla** — D90 drží, brány sú konzistentné,
tajomstvá v repozitári nie sú. Tri veci s prioritou: O12 (Atlas allowlist),
zraniteľné `xlsx` a `dompurify` (cez toast-ui), a CSV exporty bez ochrany
pred formula injection (`=` na začiatku bunky sa v Exceli vyhodnotí ako
vzorec aj v úvodzovkách — `toCsv()` to nefiltruje).

**Web je poctivejší, než som čakal** — on-prem označuje „pripravujeme",
režim `eu-data` sedí, čísla (60/40, voyage-4/1024, rerank-2) sedia s kódom.
Najvážnejší nesúlad: sekcie o `scope: global` a hierarchii centrála →
jednotky opisujú krížovú viditeľnosť, ktorú D90 včera zrušil. Ďalej Vertex AI
(adaptér neexistuje), TEI + voyage-4-nano (TEI ho nepodporuje, O7 nález A)
a anglické „we have a zero-retention agreement with Anthropic" v prítomnom
čase. Úpravy webu sa nerobili — čakajú na schválenie.

**ADR-009 vzalo číslo, s ktorým počítal ClubUp** — plán ClubUp ADR sa písal
skôr, ale dokument nevznikol; ClubUp dostane ADR-010. Zapísané v ADR-009.

Čo by som nabudúce spravil inak: `npm audit` spúšťať pravidelne, nie až pri
kontrole pred vydaním — `xlsx` je zraniteľné mesiace a nikto to nevidel.

---

## 2026-09-17 (večer) — audit D90 opravený celý

Ján: „oprav všetko, čo si našla". Štyri commity po skupinách nálezov, nie jeden
veľký — každá skupina mení iný druh správania a pri probléme sa má dať vrátiť
samostatne.

**Pred zmenou som sa pozrel do dát, nie len do kódu.** Povinná organizácia vo
`validAcknowledgements()` by pri zázname bez `companyCode` ticho „stratila"
potvrdenie — a výkaz by tvrdil, že človek nič nepotvrdil. Dotaz nad ostrou
databázou: všetkých 7 potvrdení, 6 časov čítania a 10 hodnotení má organizáciu
zhodnú s osobou. Jedna vec vyzerala zle: 115 úsekov s inou organizáciou než
dokument. Druhý dotaz ukázal, že dokument k nim neexistuje — sú to archivované
úseky zmazaného nácviku. Keby som skončil pri prvom čísle, písal by som o úniku,
ktorý nie je.

**Najcitlivejšia bola brána prihlásenia.** Po zmene rozhoduje organizácia domény,
nie „ktorákoľvek". Testy to overia len s atrapou, tak som pustil `next start`
a poslal skutočnú žiadosť o odkaz — s prázdnym `ECOMAIL_API_KEY` v prostredí,
aby e-mail naozaj neodišiel (Next hodnotu z `.env.local` neprepíše, ak už
v prostredí je, aj prázdna; log to potvrdil vetou „e-mail sa neodoslal"). Ján na
SFZ: povolil. Ján na LTK: odmietol. Presne to D90 chce, ale pre Jána to znamená,
že na `app.contineo.app` sa dostane len cez núdzovú brzdu alebo ako osoba LTK.

**Pri logu hrozila nová diera cez CDN.** Výnimka pre správcu platformy vracia
logo inej organizácie — a odpoveď mala `public, immutable`. Vercel by ju uložil
a vydal ďalšiemu, neprihlásenému návštevníkovi tej istej adresy. Preto
`private, no-store` práve pre tú vetvu.

**Čo zostalo mimo:** e-maily z cronu, schvaľovania a pozvánok posielajú logo ako
relatívnu adresu — v schránke nemá k čomu byť relatívna. S oddelením tenantov to
nesúvisí a neoveril som, ako to vyzerá v pošte; je to v TODO. A región `iad1`:
Vercel vie bežať vo Frankfurte (`regions: ["fra1"]`), ale je to produkčné
nastavenie — čaká na Jánovo áno.

**Dodatok (neskôr večer):** Ján povedal oboje áno. Logo som neopravil v piatich
volajúcich, ale v `ecomail.ts` — tam, kde sa hlavička vykresľuje. Päť kópií toho
istého pravidla je presne to, čo sa raz rozíde; `auth.ts` svoju kópiu stratil.
Test kontroluje všetkých šesť e-mailov naraz, nie ten, ktorý som práve menil.
Región je `fra1` — a rovno to zapíšme aj k O12: **Static IPs sa zapínajú pre
región**, takže sa musia zapnúť pre Frankfurt, nie pre Washington.

**Upratovanie na koniec dňa.** `npm run check` nad ostrými dátami: 10 dokumentov,
1991 úsekov, 5 potvrdení, 3 osoby, **bez rozporov** — po dni, v ktorom sa menila
podmienka skoro každého dotazu, je to to jediné číslo, ktoré ma zaujímalo.
V kóde nezostal ani jeden `TODO`/`FIXME` okrem odkazov do `docs/TODO.md`. Osem
commitov, všetko na `main` a nasadené.

Drobnosť na inokedy: `npm run check` a `npm run status` nemajú v `package.json`
`--env-file=.env.local` (na rozdiel od `smoke` a dnešného `docs:import`), takže
bez exportovanej premennej skončia na „Chýba MONGODB_URI". Nie je to chyba
kontroly, len jej spustenia — zapísané do TODO.

---

## 2026-09-17 (poobede) — drobnosti Fázy 8, z ktorých jedna nebola drobnosť

Ján: „dorobme D. Drobnosti v kóde". Štyri body z `TODO.md`: `/api/chat` na
predvolenom profile, neznámy hostiteľ s `307` pred `404`, logo cez presmerovanie,
import mimo schvaľovania. Pred plánom som každý prešiel v kóde a pozrel sa do
ostrej databázy dotazom, ktorý nič nezapisuje — a plán sa tým zmenil.

**„Chat na predvolenom profile" bol v skutočnosti únik.** Route nielenže nemal
profil tenanta — hľadal **bez `companyCode`**, lebo filter bol v `mongoSearch.ts`
nepovinný. Zápis v TODO to opisoval ako kozmetiku. Dnes je všetok obsah SFZ, takže
reálny dosah bol jeden interný úsek pre jedinú osobu LTK; o zákazníka neskôr by
to bola plná knižnica. Poučenie: **nepovinný bezpečnostný filter je chýbajúci
filter** — nikto ho nevyplní a výsledok nevyzerá ako chyba, len ako lepšia odpoveď.

**Ján to rozhodol jednou vetou:** „filter musí byť VŽDY, tenanti galvanicky
oddelení" — a k `sharedWithCompanyCodes`: „zdieľanie radšej nie". Pri hľadaní som
našiel ďalšie dve cesty cez hranicu, obe podľa D32: `canSeeDocument()` pustil verejný
dokument ktorejkoľvek organizácie a `assignableDocuments()` ho ponúkol na pridelenie.
Vzniklo D90. Filter som dal do najnižšej vrstvy (`tenantFilter()` vyhodí výnimku),
nie do route — kontrola v route je presne to, čo tu raz chýbalo. Overené aj živo:
`smoke --organizacia LTK` nájde nula úsekov.

**Súhlas na zmenu indexov som nevyužil.** Ján ho dal pre prípad zdieľania; bez
zdieľania stačí `companyCode`, ktorý je filtrovacím poľom v oboch indexoch od začiatku.

**Poznámka v TODO bola zastaraná o dve verzie Nextu.** „Middleware beží na edge
a do Atlasu nevidí" platilo pre Next 14. Next 16 ho premenoval na `proxy.ts`
a beží na Node.js — overené v `node_modules/next/dist/docs`, nie z pamäti. Kontrola
tenanta tak je jeden `resolveTenant()` bez verejného endpointu, ktorý TODO navrhovalo.
Výnimku má len `/api/cron/`, lebo z akej domény Vercel volá cron, neviem — a raz už
cron ticho nebežal práve kvôli bráne v middlewari. Po nasadení: `contineo-app.vercel.app`
→ `404`, cron `401`, `intranet.futbalsfz.sk` bez zmeny, v logoch žiadna chyba.

**Import bol horší, než hovoril zápis.** Okrem zverejňovania mimo schvaľovania
skladal `documentId` zo `sectionKey`, teda identitou spred D80. Prepísal som ho na
volanie tej istej `uploadDocument()` ako obrazovka — dve cesty s dvomi sadami
pravidiel sa rozídu presne pri novele. `--actor` je povinný a musí to byť osoba
s rolou; do auditu nemá ísť „import.mjs". Prvá verzia padla na tom, že `library.ts`
ťahá `next/headers`; druhá hlásila „Nepodarilo sa to" pri každej vlastnej kontrole,
lebo `errorText()` maskuje obyčajné `Error`. Oboje chytil beh nasucho, nie testy.

**Logo** vyriešil Ján tým, že ho nahral znova — zapísal ho existujúci kód, bez skriptu.

**D5 — audit dotazov** je len výpis (`docs/D90_audit_dotazov.md`). Najväčšie nálezy:
posudok, spätná väzba a kurácia sa zapisujú podľa `_id` bez organizácie, a osoba
sa hľadá len podľa e-mailu. Mimochodom: funkcie produkcie bežia v `iad1` (USA) —
nikde v dokumentácii to nie je, pýtam sa.

**Čo by som nabudúce urobil inak:** v predmete prvého commitu je preklep („naprec")
a je už na `main`. Správu commitu si pred pushom prečítať celú, nie len kód.

---

## 2026-09-17 (skoro ráno) — kostry, a jedna prestavba v horúcej ceste

Ján: „chýbajú mi inteligentné pekné preloadery na stránkach … ideálne v štýle
Skeleton Loaders.“ Prvé, čo som urobil, bolo, že som to šiel zmerať v kóde,
a výsledok bol jednoznačný: **nula `loading.tsx`, nula `Suspense`** na 34
routách. Nebolo teda čo vylepšovať — nebolo tam nič.

**Kde som skoro urobil kostru zle.** Prvý návrh mal `SkeletonPanel` všade.
Potom som sa pozrel, z čoho sú zoznamy naozaj postavené: `/documents`,
`/people`, `/hr` aj `/library` sú stĺpce `.card`, nie panel s riadkami. Kostra
z panela by mala o medzery medzi kartami menej a po načítaní by sa zoznam
roztiahol. Poučenie je to isté ako pri dokumentácii: **tvar sa berie z kódu,
nie z predstavy.**

**`AppShell` nie je v `layout.tsx`** — vyžiada si ho každá stránka sama. To som
zistil až pri prvom `loading.tsx` a je to pre kostru určujúce: `loading.tsx`
nahrádza stránku, takže počas čakania zmizne aj pás odkazov. Preto
`SkeletonShell` s obrysom navigácie a `min-height: 44px` — to isté číslo, aké
majú skutočné položky pásu.

**Prestavba `/api/chat` bola jediné možné čestné riešenie.** Jánovi som
dopredu napísal, že hlášky typu „hľadám v predpisoch…“ sa dajú urobiť buď
pravdivo (práca dovnútra streamu a udalosti `phase`), alebo ako animácia bez
vzťahu k skutočnosti. Vybral pravdivú cestu. Stálo to dve zmeny správania,
ktoré sú zapísané v hlavičke route aj v changelogu: hlavičky `X-Search-Mode`
a spol. nahradila udalosť `meta` (hlavičky sa nastavujú pred prácou, teda
by boli prázdne) a nezhoda vektorového priestoru už nie je HTTP 500, ale
`error` v streame. Ani jedno nikto v repozitári nečítal — overené grepom,
nie odhadom.

**Čo som nedokázal overiť sám.** Ako to vyzerá. `tsc`, lint (0 chýb),
1318 testov aj `npm run build` prešli, ale kostra je vec oka a na to
potrebujem prehliadač. Zostáva to na vizuálnu kontrolu po nasadení —
a skôr než ju niekto urobí, platí, že počty riadkov v kostrách sú odhad,
nie meranie. Zapísané ako otvorený bod v TODO, nie zamlčané.

**A vizuálna kontrola našla chybu, ktorú by `tsc` nikdy nenašiel.** Zostavil
som statickú ukážku kostier s **ostrým `globals.css` z nasadeného buildu**
(nie s približnou kópiou) a otvoril ju na 375 px. Na telefóne bol vidno pás
odkazov **aj** zásuvku naraz. Príčina: `.skeleton-nav` mala `display: flex`
a je v súbore nižšie než `@media (max-width: 939px) { .app-nav--topbar {
display: none } }` — rovnaká špecifickosť, neskôr vyhráva. Oprava je nič
nedeklarovať: `display` si dodá `.app-nav`. Poučenie na kostry ako celok:
**trieda, ktorá sa pridáva k existujúcej, nesmie prepisovať to, čo tá
existujúca rieši cez `@media`.**

**Lint ma chytil na `setBusy(false)` priamo v efekte.** Reťazové vykreslenie.
Oprava je `requestAnimationFrame` — pre oko to isté, pre React obyčajná zmena
stavu. Dobré pravidlo bolo v nástroji skôr než v mojej hlave.

---

## 2026-09-16 (neskorá noc) — Vercel nedostal webhook druhýkrát

Včera som si do tohto denníka napísal, že stratený webhook bol **jednorazový
výpadok**. Nebol. Dnešný `621b014` má na GitHube `state: pending` a **0 commit
statuses** — presne ten istý obraz ako vtedy. Vercel sa o pushi nedozvedel.

Dva rovnaké príznaky nie sú náhoda, sú jav. Záver „jednorazový“ som postavil na
tom, že dva nasledujúce pushe prešli — teda na tom, že sa chyba neopakovala
hneď. To nie je dôkaz, to je krátke okno. Rovnaká chyba ako pri O18: vzal som
záver namiesto toho, aby som ho odvodil z toho, čo naozaj viem.

Záchranná cesta zabrala oba razy rovnako: `POST /v13/deployments` s `gitSource`
(`repoId`, `ref: main`, `sha`). Zapísaná je v TODO, aby sa nemusela vymýšľať
tretíkrát.

**Nabudúce:** ručné nasadenie je liečenie príznaku. Pri treťom výskyte ísť na
doručovanie webhookov GitHub App (Recent Deliveries), nie znova na API.

---

## 2026-09-16 (noc) — web dobehnutý, a jedno rozhodnutie navyše

Druhá dávka opráv webu. Ján pritom povedal vetu, ktorá zmenila tón celého
balíka: **„v prvom kole musíme rozbehať Anthropic a MongoDB riešenie, až keď
príde hardware, pojdeme na onpremise"**.

To nie je detail, to je roadmapa. Namiesto vágneho „pripravujeme" je odteraz na
webe pri každom on-prem tvrdení napísané, že **prvé nasadenie príde
s hardvérom**. Je to poctivejšie a zároveň silší predajný príbeh než sľub bez
dátumu — a v obstarávaní sa to dá obhájiť.

### Čo ma pri opravách prekvapilo

**Ukážka kódu na stránke Technológia si protirečila sama so sebou.** Mala
`embedding: [0.0123, …]` v dokumente a zároveň `embeddingProvider: "atlas-auto"`.
Pri Automated Embedding sa vektor v dokumente **neukladá** — drží ho Atlas,
a `tenantProfile.ts` dokonca vyhodí chybu, keď `vectorPath` ukazuje na
`embedding`. Stránku Technológia číta práve ten čitateľ, ktorý si toho všimne.

**Slovenské úvodzovky ma dobehli tretíkrát.** `„sedí / nesedí"` — zatvárací
znak musí byť `“`, nie `"`. Tentoraz to zhodilo `require()` na slovníku, nie
`tsc`. **Začína to byť vzor, nie náhoda:** keď generíš kód so slovenským textom,
skontroluj úvodzovky ešte pred spustením.

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
výpadok. [**Oprava 2026-09-16:** nebol jednorazový — o deň neskôr to
isté; pozri zápis zo 16. 9. (neskorá noc).] **Nabudúce:** ak nasadenie
nenabehne do pár minút, ísť rovno na commit statuses v GitHube; to je
najkratšia cesta k rozlíšeniu „Vercel to
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
