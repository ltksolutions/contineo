# Devlog — Contineo

> Denník práce. **Nie je to `CHANGELOG.md`.** Changelog hovorí, *čo sa zmenilo*
> a je písaný pre toho, kto sa na projekt pozrie o rok. Devlog hovorí, *ako to
> šlo* — čo sa rozhodlo a prečo, čo nevyšlo, čo stálo čas a čo by som nabudúce
> urobil inak. Zápis vzniká na konci pracovného dňa.
>
> Založené 2026-09-15. Staršie dni zapísané nie sú; ich stopa je v `CHANGELOG.md`
> a v `git log`.

---

## 2026-09-22 (3) — web na Next 16, upratané vetvy a téma bez stavu

**Tri PR sa zlúčili po jednom, nie naraz.** Na rozdiel od včerajšieho stohu
(17 PR jedným merge commitom) išli #65 → #66 → #67 samostatne: každý menil
niečo iné a každý si zaslúžil vlastné nasadenie. Po #66 a #67 bolo treba
prebázovať základ ďalšieho PR na `main` — GitHub to sám nerobí, kým sa
pôvodná vetva nezmaže. Overené naostro: `https://contineo.app/` vracia **200**
s OG značkami aj obrázkom, teda oprava koreňa z #67 naozaj funguje tam,
kde na nej záleží.

**`web/` povýšený z Next 14 na 16.** Podmienka bola jednoduchá — `app/` na
16.3.3 už mesiac beží, takže `web/` na 14 znamenal dve sady konvencií
v jednom repozitári. Rozsah vyšiel menší, než príručka naznačuje: `web/`
nepoužíva `next/image`, nemá jediný `fetch()`, žiadne paralelné cesty ani
webpack konfiguráciu, takže väčšina kapitol o zmenách bola bezpredmetná.
Zostali štyri veci: verzie, asynchrónne `params` (26 miest v 17 súboroch),
`middleware.js` → `proxy.js` a `next lint` → plochý ESLint.

**React zostal na 18.3.1 zámerne.** Príručka odporúča povýšiť ho spolu
s Next, ale `app/` beží na Next 16 s Reactom 18.3.1 v produkcii — to nie je
teória, to je fakt z `node_modules`. Jedna premenná menej v migrácii, ktorá
sa aj tak dotýka sedemnástich súborov.

**Jediná tichá zmena boli `params`.** Ostatné by pri chybe spadli hlasno.
`params.lang` by v Next 16 nevrátil chybu, ale `undefined` — stránka by sa
postavila, len bez slovníka. Preto sa menili exaktným porovnaním s kontrolou
počtu zásahov, nie regexom cez súbory naslepo.

**`npm install` padol prvý raz na `ENOTEMPTY`** pri odstraňovaní starého
`next` — `package.json` sa už prepísal, ale `node_modules` zostali rozbité
uprostred. Druhý, obyčajný `npm install` to dorovnal. Nestálo to nič okrem
minúty, ale je dobré vedieť, že to nie je dôvod mazať `node_modules`.

**Turbopack varoval na súbor, ktorý s projektom nemal nič spoločné.**
Build hlásil, že ignoruje `package-lock.json` v `/Users/janletko`. V domovskom
priečinku ležal 87-bajtový prázdny zámok z 14. júna — bez `package.json`, bez
`node_modules`. Vznikol tak, že niekto pustil inštalačný príkaz v termináli,
ktorý štartuje v `~`, a npm si názov doplnil z priečinka (`"name": "janletko"`).
Turbopack hľadá koreň projektu smerom nahor a tento zámok našiel prvý; keďže
leží mimo gitu, správne ho ignoroval. Presunutý do Koša, nie zmazaný natvrdo —
je to súbor v používateľovom domove. Build je odvtedy **úplne bez varovania**
a `turbopack.root` v konfigurácii netreba: príčina je preč, nie zamaskovaná.

**Pri hlásení som ten súbor pomenoval zle** — napísal som `package.json`,
hoci išlo o `package-lock.json`. Ján sa oprávnene pýtal, ako sa tam dostal
`package.json`, lebo taký tam nikdy nebol. Rozdiel jedného slova poslal
otázku úplne inam.

**Vetvy upratané: 64 vzdialených a 64 lokálnych.** `git branch -r --no-merged
origin/main` vrátil nulu, takže žiadna z nich nenesie prácu, ktorá by nebola
v `main`. Lokálne sa mazali cez `git branch -d` (nie `-D`) — git tak sám
odmietne vetvu, ktorá by zlúčená nebola, a poistka nestojí nič. Zostal len
`main`, lokálne aj na `origin`. Bolo to v `docs/TODO.md` od zlúčenia handoffu
a čakalo to výhradne na súhlas.

**`ThemeToggle` prestal mať stav.** `eslint-config-next@16` priniesol pravidlo
`react-hooks/set-state-in-effect` a v tomto komponente malo pravdu. Pri
povýšení verzie sa neprepisoval — miešať migráciu s prestavbou komponentu je
presne to, po čom sa v diffe nedá nič nájsť — a zostal ako výstraha. Vyriešil
sa hneď potom, samostatne.

Podstata: téma nikdy nebola stav komponentu. Žije v atribúte `data-theme` na
`<html>` a nastavuje ju vložený skript v `app/layout.js`. Komponent si ju
zrkadlil do `useState` cez `useEffect` — dva zdroje pravdy a vykreslenie
navyše pri každom načítaní. `useSyncExternalStore` číta atribút priamo
a prihlasuje sa `MutationObserverom`, takže `setState` zmizol aj z prepínača:
zapíše atribút a o prekreslenie sa postará pozorovateľ. S ním odišiel aj
príznak `mounted` — `getServerSnapshot` rieši zhodu servera a klienta priamo.

**Že to nebliká, sa dalo overiť, nie iba tvrdiť.** V HTML zo servera je
synchronný `<script>` na pozícii 3423 a `<body>` začína až na 3823 — atribút
je teda nastavený pred parsovaním tela, a teda pred prvým pixelom. Server
vykreslí výhradne mesiac (svetlá téma), slnko ani raz, takže hydratácia beží
na hodnote, ktorú `getServerSnapshot` sľubuje. V konzole po tvrdom načítaní
v tmavej téme nie je ani jedno varovanie Reactu o hydratácii — všetkých sedem
hlášok je z rozšírenia prehliadača, nie zo stránky.

**Mobil sa opäť neoveril naživo.** Chrome na Macu sa nedá zúžiť pod šírku
okna; `resize_window` hlási úspech a snímka je ďalej 1501 px. Namiesto tvrdenia
zostáva doklad: v celej vetve sa nezmenil ani jeden CSS súbor (`git diff
--name-only` na `web/**/*.css` je prázdny) a jediná zmena v značkách je atribút
na `<html>`. Rozloženie sa teda zmeniť nemohlo. Skutočná mobilná kontrola
patrí na telefón, nie do tohto prehliadača.

---

## 2026-09-22 (2) — nasadenie do produkcie a migrácia O21 krok 2

**Stoh sa zlúčil do `main` naraz.** Sedemnásť zreťazených PR (#46–#62, 105
commitov) išlo do `main` jedným merge commitom `415d5d7`. Alternatíva —
zlučovať zdola nahor po jednom — by znamenala sedemnásť nasadení a v každom
medzistave nedokončený handoff na ostrom intranete. Skúšobné zlúčenie
(`git merge-tree`) neukázalo ani jeden konflikt, čo je čakateľné: vetvy boli
lineárne a `main` sa medzitým nepohla. Podriadené PR sa nezavreli samy —
ich základom boli vetvy, nie `main` — takže dostali komentár, kde ich práca
skončila, a zavreli sa ručne. **Žiadna vetva sa nemazala.**

**Rituál „Zorientuj sa" dostal, na čom stáť.** Preferencia hovorí načítať
`CLAUDE.md`, `NEXT.md`, `git log -20` a vetvu; `NEXT.md` v repozitári nebol
a jeho úlohu suploval `docs/TODO.md` s 833 riadkami. Orientovať sa v ňom pri
štarte je presný opak toho, na čo rituál je. `NEXT.md` je teraz jedna strana
a platí preň jedno pravidlo: **aktualizuje sa výhradne pri „Poupratuj"**.
Inak by z neho bol tretí zdroj pravdy, ktorý klame — presne to, čo sme
v `TODO.md` deň predtým opravovali.

Hneď sa to aj potvrdilo: po zlúčení `NEXT.md` tvrdil „17 otvorených PR, nič
v `main`". Nepravda stará dvadsať minút. Prepísal sa v tom istom ťahu.

**ADR sa presťahovali do `docs/decisions/`.** Rituál „Rozhodni" s tým
priečinkom počítal, v repozitári nebol a ADR ležali priamo v `docs/`
pomiešané s plánmi a koncepciami. `docs/decisions/` je konvencia MADR, čiže
nie vymyslené miesto. Desať súborov cez `git mv` (história zostala), 51
odkazov s cestou prepísaných v 27 súboroch. **Názvy sa nemenili** — MADR
odporúča `0006-nazov.md`, ale „ADR-006" je v repozitári použité asi 400-krát
ako identita rozhodnutia. Z konvencie sa oplatí vziať priečinok a nechať
číslovanie; opačne by to znamenalo veľký diff naprieč kódom výmenou za nič.

**Migrácia `sectionKey` → `category` prebehla na produkčných dátach.**
Desať dokumentov: deväť malo druh „norma" a prišlo len o zaradenie, jednému
(`sfz:test_onboarding`) zaradenie „smernice" doplnilo druh „smernica".
Žiadne neznáme zaradenie, žiadny dokument bez `documentKey` — kontrola, na
ktorej skript inak zastane, lebo bez kľúča je zaradenie záložná identita
a jeho odstránenie by pri najbližšej úprave metadát zmenilo `documentId`
a rozviazalo potvrdenia. Z `document_chunks` odišlo `sectionKey` z **1991**
úsekov. Pred zápisom sa odložila snímka pôvodných hodnôt do
`private/zalohy/` — nie preto, že by sa čakal problém, ale preto, že
`$unset` sa inak nedá vrátiť.

Čo stálo za overenie: Atlas index má `sectionKey` ako filter aj token
(`scripts/atlas_init.mjs`). Chýbajúce pole Atlas Search znesie a dotazy sa
naň už nepýtajú, takže to bola len zbytočnosť, nie porucha — potvrdené
otázkou na ostrom intranete hneď po migrácii: osem doslovných citácií,
odpoveď v poriadku. Index sa prekreslí pri najbližšom preindexovaní.

**Testovanie na produkcii našlo dve veci, ktoré testy nenašli.** Prvá:
prázdny stav knižnice nerozlišuje „nič tu nie je" od „filtru nič
nevyhovuje" — podmienka pozerá len na text hľadania. Riadok je z 18. 9.,
čiže nie regresia z handoffu; viditeľný je až teraz, lebo filter
„expirované" vracia nulu najčastejšie. Druhá: stupne zhody vyšli všetky
rovnaké, päťkrát „vysoká". Po reranku sú prvé zdroje tesne pri sebe, takže
podiel voči najlepšiemu takmer vždy prekročí 0,8. Obe zapísané, ani jedna
opravená — prvá je zmena textu na obrazovke, druhá by bola ladenie prahov
od stola.

Poučenie dňa: **jednotkové testy nepovedia, či obrazovka hovorí pravdu.**
Oba nálezy vyšli z troch minút klikania na živej aplikácii.

**Pri upratovaní po migrácii klamali dva komentáre v kóde.** `codelists.ts`
tvrdil, že `sectionKey` „v dátach starých dokumentov zostáva" — hodinu po
migrácii už nezostával nikde. `libraryWrite.ts` písal o záložnej identite
dokumentov spred D80 vetou „a to sa nemení", ktorá sa práve zmenila. Ani jeden
nebol chybný, keď vznikal; oba prestali platiť zmenou dát, nie kódu — a tým
sa dajú prehliadnuť najlepšie, lebo testy ani prekladač o tom nič nevedia.
Opravené na stav veci, spätný pád v kóde zostal (je mŕtvy v tomto tenantovi,
nie v kóde, ktorý obsluhuje aj ďalšie).

Zvyšné zmienky o `TODO` v kóde sú odkazy do `docs/TODO.md`, nie zabudnuté
značky — prešlé, v poriadku. Pracovný strom je čistý, všetko pushnuté,
nula otvorených PR.

**Čo sa neupratovalo:** v repozitári je **58 vzdialených vetiev, ktorých práca
je celá v `main`**. Mazanie vetvy je výslovný súhlas Jána, takže zostávajú
— zapísané sem, aby sa na to nečakalo ako na náhodu.

---


## 2026-09-22 — celý handoff (PR 0–14), oprava dátovej straty v importe a dorábky

**Handoff je hotový: PR 0 až 14, zreťazené jeden na druhom.** Dnes pribudli
PR 9a/9b (Správa), 10–12 (HR), 13 (Osoby) a 14 (Admin a Príručka). Každý PR
má commit na úlohu, zápis v `TODO.md` vrátane odchýlok a otázky v tele PR
namiesto dotvárania z hlavy. Zadanie sa nikde nedopĺňalo domyslením — kde
návrh popisoval niečo, čo v kóde nie je, odišla otázka do PR.

**Najdôležitejšie zistenie dňa nie je z dizajnu, ale z kódu: import osôb
mazal ľuďom roly.** `upsertPersons()` zapisovalo `tracks`, `groups` a `roles`
vždy, takže súbor bez stĺpca ich existujúcim ľuďom vyprázdnil — a `roles`
CSV nerozpoznáva vôbec, takže **každý import zmazal roly každému, koho sa
dotkol**. Našlo sa to pri PR 13, keď som pre obrazovku importu zisťoval, čo
sa vlastne stane s existujúcou osobou; zadanie to viedlo ako „napíš, ako sa
to chová". Napísalo sa aj opravilo: chýbajúce pole znamená „o tomto nič
nehovorím", prázdne znamená „vyprázdni". Rozdiel vie rozlíšiť len čítanie
CSV, kde vidno hlavičky (`hasField()`) — dovtedy prázdna bunka padala do
`undefined` rovnako ako chýbajúci stĺpec, takže vyprázdniť sa nedalo vôbec.

**Poučenie, ktoré sa opakuje tretíkrát: TODO klame skôr než kód.** Pri
otázke „čo ešte treba dorobiť" sa ukázalo, že dve z piatich „chýbajúcich"
vecí sú dávno hotové — dokument oddelenie **nesie** (`ownerDepartmentId`,
facet aj stĺpec) a percento potvrdení kreslí `.ack-bar` v tabuľke aj na
karte. Zápisy boli spred PR 7/8 knižnice a nikto ich neodškrtol. Odškrtnuté
dnes, s poznámkou, kedy vznikli.

**Zhoda zdroja: tri stupne namiesto čísla.** Surové `score` sa ukázať nedalo
— pri `$rankFusion` a `$rerank` nie je v rozsahu 0–1 a medzi režimami
hľadania nie je porovnateľné, takže „0,94" by predstieralo presnosť, ktorú
nemá. Stupeň sa počíta **relatívne k najlepšiemu zdroju tej istej odpovede**:
to je porovnanie, ktoré dáva zmysel, lebo presne tú otázku si človek kladie.
Bez skóre sa nekreslí nič.

**Expirované je štvrtá hodnota filtra, nie štvrtý stav.** Expirovaná norma je
publikovaná norma po dátume — stav dokumentu zostáva `published` (D27).
Podmienka sa preto skladá dotazom (`expiredCondition()`): publikovaný
dokument, ktorý dnes nemá platné znenie, hoci aspoň jedno už mal. To isté
pravidlo, aké v JS počíta `effectiveVersion()`; v databáze preto, že zoznam
je stránkovaný.

**Strop výberu 200.** Výber v knižnici sa nesie v adrese, aby prežil prechod
na ďalšiu stranu a fungoval bez skriptu; pri 148 označených je to ~4 kB a bez
rezervy k hranici 8 kB. Strop nie je riešenie princípu, ale zabraňuje tichému
pretečeniu — bez neho sa adresa niekde oreže a výber zmizne bez vysvetlenia.
Správna odpoveď pri väčších dávkach je „všetko, čo vyhovuje filtru" ako jeden
príznak; zapísané ako otvorená vec.

**O21 krok 2 — Zaradenie sa zlúčilo do Druhu.** Ukázalo sa, že to nie je
premenovanie: `sectionKey` hovoril *kam dokument patrí* (Stanovy, Zápisnice,
Zmluvy), `category` hovorí *čo to je* (norma, smernica, zákon). Mapovanie
bolo treba vyrobiť — pravidlo „poriadok je norma" a tri nové druhy
(zápisnica, zmluva, tlačivo), lebo inak by import zo zaradenia musel klamať.
Migračný skript **odmietne zapísať čokoľvek**, kým existuje dokument bez
`documentKey`: zaradenie je jeho záložná identita a odstrániť ho skôr by pri
najbližšej úprave metadát zmenilo `documentId` a rozviazalo potvrdenia, úseky
aj pridelenia. Skript je napísaný a nespustený.

**Čo stálo čas:** dvakrát som si regexom s `re.S` zmazal viac riadkov v
`TODO.md`, než som chcel — raz to spojilo zápisy dvoch PR. Oboje som zachytil
pri kontrole diffu pred commitom, ale je to zbytočné riziko: pri úprave
jedného riadku dlhého súboru sa má hľadať v tom riadku, nie v celom texte.

---

## 2026-09-21 (2) — výmena handoffu a kontrola konzistencie

**`docs/design/` vymenil kompletný handoff všetkých obrazoviek** (`ae9d2ea`):
21 `.md` + 9 `.html`, stará vlna (NASADENIE.md, SPRAVCA.md, OSOBY.html,
`.dc.html` šablóny, support.js) odišla. Pred implementáciou som handoff
prečítal celý a porovnal s kódom — nič sa ešte neimplementovalo.

**MASTER tvrdil „31 rout, úplné" — kód má obrazoviek viac.** Päť skutočných
obrazoviek (`/admin/new`, `/admin/tenants/[code]`, `/hr/[id]/notify`,
`/library/[id]/text`, `/library/tracks/[key]`) zadanie nemá; v kóde sú od
augusta a septembra. Najkrikľavejšie: `SPRAVA.md` úloha 1.3 tvrdila, že
úprava krokov trasy neexistuje a „kroky sa prideľujú inde" — pritom
`/library/tracks/[key]` s pridávaním, odoberaním a posúvaním krokov žije
od 6. 9. To isté poučenie ako pri README: dokumentácia je indícia, kód je
pravda — a platí to aj na deň starý handoff.

Menšie pozostatky starších verzií textov: POSTUP mal v úvode „8 z 31",
ZADANIE „PR 15" namiesto PR 12, POSUDENIE a SPRAVA zlé čísla častí HTML
referencií, INDEX tvrdil, že `.dc.html` sú v koreni repa. Opravené; MASTER
dostal sekciu „Obrazovky mimo handoffu" a výnimku pre jediný JS prvok
(ZNENIE úloha 4). TODO.md dostal sekciu tretej vlny, stará (NASADENIE)
je uzavretá ako história, DESIGN_GAP má poznámku o odídených súboroch.

Odkazy na NASADENIE v komentároch kódu (~30 miest v `globals.css`,
`Header.tsx`, …) nechávam — sú to citácie zdroja rozhodnutí, nie funkčné
odkazy na súbor.

## 2026-09-21 — kontrola proti vzoru a PR 7

**Ján porovnal produkciu so vzorom a mal pravdu vo všetkom podstatnom.**
Najväčší kus: hľadanie a Podmienky som v PR 4 nechal cez celú šírku nad
mriežkou, lebo NASADENIE ich v odrážkach nespomínalo — ale vzor ich má
v stĺpci zoznamu. Poučenie: odrážky plánu nie sú celý návrh; obrazovka
v `.dc.html` je záväznejšia než zoznam bodov, ktorý z nej niekto vypísal.

**„Viac 1" na širokom monitore mal dve príčiny naraz.** Prvá moja: dvojník
merania kreslil všetky položky v aktívnom (hrubšom) reze — „opatrné"
meranie, ktoré prepad hlásilo aj tam, kde nebol. Druhá koncepčná: pás mal
pri každej položke ikonu, ktorú vzor nemá — 10 × ~23 px navyše sa do
shellu nezmestí nikdy. Textový pás + presné meranie a všetkých desať
položiek sedí.

**„Norma (norma)" nebol v dátach, ale v kóde** — `codelistOptions()`
lepil kľúč do popisku. Deň predtým som pri README správne povedal „kód je
pravda, dokumentácia klame" a dnes to platilo naopak: kód klamal oku.
Kľúč je adresa pre stroj; kde ho správca potrebuje, ukáže sa zvlášť.

**Dve zvrátené rozhodnutia z NASADENIA, obe Jánove a obe správne:**
zvonček znova ukazuje počet (bodka hovorí „niečo", číslo „koľko")
a `layout.tsx` dostal svoju prvú zmenu — `viewport-fit=cover` — po
výslovnom súhlase. Frozen súbor nie je zakázaný súbor; je to súbor,
ktorý sa mení nahlas.

**Otvorené pre solo handoff Knižnice** (Ján ho pripraví v dizajnovom
projekte): „Uložiť pohľad", presné stĺpce tabuľky (Zmenené, Potvrdenia %
— to druhé čaká aj na dáta), správanie chips pri podmienkach.

**Pozvánka, ktorá nikdy neodišla.** Ján hlásil, že pozvaná kolegyňa nedostala
e-mail. V databáze bola v poriadku — `status: invited`, `firstLoginAt` chýba.
Chyba bola v kóde a bola to tá najnepríjemnejšia trieda chýb: `grep 'send('`
v `people/actions.ts` vrátil **jediný** výskyt, a ten bol v hromadnej akcii.
Formulár „Pozvať osobu" osobu len zapísal a ohlásil „Pozvaná" — hláška hovorila
o evidencii, používateľ ju čítal ako o pošte. Nikde nespadla výnimka, nikde
nebol červený log; systém robil presne to, čo mal napísané, len to nikto
nechcel.

Poučenie do ďalšieho čítania kódu: **hláška po akcii je tvrdenie o tom, čo sa
stalo.** „Pozvaná" pri akcii, ktorá neposiela, je nepravdivé tvrdenie a nedá
sa naň prísť testom — treba ho prečítať očami niekoho, kto na to tlačidlo
klikol.

Vedľajší nález, ktorý stojí za zapamätanie: `needsInvitation()` som najprv
napísal do `people.ts` — a test ho odtiaľ nevedel importovať, lebo `people.ts`
ťahá `session.ts` s Reactovým `cache()`. To nie je nepríjemnosť testu, to je
signál: pravidlo, ktoré potrebuje obrazovka aj server aj test, patrí do
čistého modulu. Repo naň už jeden má (`personFields.ts`) a docstring v ňom
presne tento dôvod menuje. Stačilo ho poslúchnuť.

**PR 8 — solo handoff prišiel a bol radosť čítať.** KNIZNICA.md malo tabuľku
„čo je hotové — nerob znova" s číslami riadkov: polovica práce pri handoffe
je zvyčajne zistiť, čo neplatí, a tu to autor spravil za mňa. Päť úloh,
commit na úlohu. Dve miesta, kde som sa musel rozhodnúť sám: pilulka
v stĺpci Stav dovtedy ukazovala **technický stav spracovania** („vo
vyhľadávaní" pri každom riadku) — handoff hovorí o stave dokumentu, tak
stavová pilulka nesie `r.status` a spracovanie sa ukáže len keď niečo
hovorí, zlyhanie červené. A pravidlo O6/7 „percento nikdy samo" vyzeralo
v spore s pásikom — nie je: menovateľ sa presunul do `title` a `.sr-only`,
takže oku zostal pásik a pravda zostala dostupná. `Potvrdenia %` na riadok,
ktoré TODO odkladalo „na dáta", mimochodom celý čas existovalo
(`documentsProgress` počíta viditeľnú stranu) — odložený bod bol o facete
a stĺpci pre celý zoznam, nie o tomto.

---

## 2026-09-20 — nový balík handoffu a PR 1 (dva breakpointy)

**Commit balíka nebol slepé kopírovanie.** Nový export
`design_handoff_contineo_intranet/` mal štyri nové súbory (Obrazovky, Mobile,
NASADENIE, ios-frame) — tie šli do `docs/design/`. Ale README v exporte bolo
**staršie než repo**: nemalo `/ask` (malo `/search`), malo ešte `/golden-set`
a chýbala mu poznámka o vlastných ikonách. Export z dizajnového projektu nevie
o živote repa; keby sa prevzal celý, vrátil by tri opravené veci. README ostalo
repové a v commite je to zapísané.

**NASADENIE vs. kód: prvý krok PR 1 už bol hotový.** Tokeny, `--accent-soft`
v oboch témach aj `tenantStyle()` v kóde boli („jedna stupnica veľkostí",
6389a2d). NASADENIE chcelo hustotu „do oboch blokov", kód ju má len v `:root`
so zdôvodnením (od témy nezávislá, prepína ju `data-density`) — kód je pravda,
NASADENIE písané pred tými commitmi. Neprepisoval som fungujúce.

**Dve vedomé odchýlky od „najbližšieho breakpointu".** Prepínač
tabuľka↔karty (760) nešiel na 640, ale na 1024 — PR 4 hovorí výslovne
„od 1024 px tabuľka" a tabuľka má ~1160 px; na tablete by z nej bol vodorovný
posun. A `max-width: 419px` pre skratku názvu v hlavičke sa roztiahol na 639 —
príde o zmysel aj tak až so `shortName` v PR 3.

**Čo stálo čas:** komentáre. `globals.css` vysvetľuje hranice v ôsmich
komentároch („Hranica je 760 px, nie 640: …") a po premapovaní by klamali.
Mechanická zmena hodnôt je sed na minútu; nájsť a prepísať prózu, ktorá tie
hodnoty zdôvodňuje, trvalo dlhšie než samotný kód. Presne preto je zvyk písať
*prečo* do komentárov dobrý — donútil ma pri každej hranici overiť, či dôvod
platí aj po zmene.

**PR 2 — navigácia.** Tri tvary z jedného poľa. Najťažšie rozhodnutie nebolo
v CSS, ale v tom, kam vedie zlúčená položka „Úlohy": jedna položka, dve
obrazovky. Vedie na „Na potvrdenie" (častejšia povinnosť) a „Na schválenie"
som pridal do zoznamu na `/more` — návrh ho tam nemá, ale bez toho by sa
schvaľovanie z telefónu nedalo otvoriť vôbec. Skupina „Účet" z návrhu sa
nerobí: hlavička s avatarom na telefóne zostáva a druhá kópia tých istých
položiek je presne to, pred čím varuje komentár v `Header.tsx`.

Meranie prepadu „Viac N": šírky sa čítajú zo skrytého dvojníka pásu
(`visibility: hidden`, takže je mimo stromu prístupnosti aj klávesnice),
nie z pásu samotného — ten sa práve mení a meranie by sa naháňalo
s výsledkom. Dvojník meria položky v aktívnom reze (650): merať 500 by
znamenalo, že pás pretečie práve na otvorenej stránke. Bez JavaScriptu
sa vykreslí prvých 6 + „Viac" — serverové HTML je presne tento stav.

Drobnosť s dosahom: `env(safe-area-inset-bottom)` je v CSS, ale ožije až
s `viewport-fit=cover` — a to je `export const viewport` v `layout.tsx`,
ktorý sa bez Jánovho súhlasu nemení. Zapísané v TODO k PR 3.

Overené screenshotmi (390/800/1280, svetlá aj tmavá) cez Playwright nad
statickou kostrou — stačilo raz vidieť, že odznak na ikone „Úloh" sedí
a ponuka „Viac" kotví vpravo.

**PR 3 — hlavička.** Menej kódu, viac archeológie. Riadok hlavičky prešiel
za mesiac cestou pevná výška → zalamovanie → pole v riadku bez vlastnej
šírky — a NASADENIE ho vracia k pevným 56 px. Tentoraz to sedí, lebo dôvod
zalamovania medzičasom zmizol: pole si šírku nepýta a značka má elipsu.
Komentáre v CSS, ktoré tú históriu rozprávali, bolo treba prepísať, nie
zmazať — ten príbeh je presne to, čo zabráni štvrtému kolu.

Bodka namiesto čísla na zvončeku vyzerá ako ochudobnenie, ale nie je:
číslo tam bolo na jeden pohľad aj tak nečitateľné (18 px krúžok) a počet
hovorí `aria-label` aj stránka upozornení. V tmavej téme ma screenshot
nachvíľu oklamal — dvojité overenie cez `getComputedStyle` potvrdilo, že
`--accent`/`--on-accent` sa obracajú správne a dlaždica značky je v tmavej
svetlá. Oko na 28 px klame, vypočítaný štýl nie.

**PR 4 — knižnica, najväčší kus dňa.** Tri veci stoja za zápis.

Prvá: TODO malo zapísané, že zásuvka filtrov „má zmysel až s klientskym
stavom", a NASADENIE ju aj tak žiadalo. Rozpor je zdanlivý — starý zápis
predpokladal, že zásuvka sa musí dať držať otvorená na desktope. Nemusí:
na desktope zásuvka vôbec nie je (panel je stĺpec) a pod 1024 px sa
`<details>` zaviera sám tým, že každý facet je odkaz a stránka sa načíta
znova. Jedna definícia panela, dva tvary v DOM, `@media` vyberá — presne
vzor tabuľka↔karty, ktorý v repozitári už bol. Zapísal som prekonanie
starého bodu priamo k nemu.

Druhá: komentár pri `.bulk-bar` tvrdil, že panel musí byť vidieť stále,
lebo „server sa bez JavaScriptu nedozvie, čo je zaškrtnuté". To prestalo
platiť vo chvíli, keď sa výber presunul do adresy — komentár prežil svoj
dôvod o dva týždne. Kód je pravda, ale komentár je pamäť: keby som ho
nečítal, panel by som nechal tak.

Tretia: akcie priečinkov sa nedotkli — len `backToLibrary()` dostal biely
zoznam `return=folders`, aby formuláre zo správy vracali na správu.
Open redirect tu nehrozí: porovnáva sa konštanta, nie hodnota.

**PR 5 — detail a Prehľad.** Najmenej kódu zo všetkých, dve poznámky.
Prehľad z NASADENIA („KPI, úlohy s chipom, Novinky") už celý existoval —
jediné, čo z toho zostalo, bola mriežka dlaždíc: `auto-fit` vyzeral
šikovne, ale na stredných šírkach dával tri stĺpce a štvrtú dlaždicu
osamelú; výslovné 2×2 / 4×1 je hlúpejšie a správnejšie. A obrátil som
vlastné staré rozhodnutie: panel detailu bol na telefóne pod textom
s peknym dôvodom („človek prišiel čítať"), návrh ho dáva nad text.
Ani jedno sa nedá zmerať bez používateľov — v takom spore vyhráva návrh,
lebo je novší a Jánov. Starý dôvod som nechal v komentári v zátvorke,
nech tretie kolo nezačne od nuly.

**PR 6 — adresár, bodka za dňom.** Skoro všetko už bolo: karty existovali,
`mailto:`/`tel:` boli odkazy. Zostal tretí stĺpec od 1024 px a tvar
kontaktov na telefóne — z textového odkazu tlačidlo 36 px. Zvyšné obrazovky
(Pridelené normy, Reťaz dôkazov, Osoby, Na posúdenie) NASADENIE výslovne
odkladá na návrh, tak sa nerobili.

**Bilancia dňa: šesť PR (#37–#42), celé NASADENIE okrem odloženého.**
Vzor dňa: polovica „novej" práce už v repozitári bola — najcennejšie nebolo
písať kód, ale zistiť, čo z plánu už neplatí, a zapísať prekonané body tam,
kde ležia. Dve systémové resty: `viewport-fit=cover` čaká na rozhodnutie
o `layout.tsx` a tmavú tému som overoval len bodovo — celý prechod po
všetkých PR by si zaslúžil vlastnú kontrolu (krok 7 pôvodného plánu).

---

## 2026-09-18 (noc) — mobilná knižnica, zhnité skripty a Voyage

**Rozhodnutie, ktoré si Ján nechal na mne: karty na telefóne.** Najprv som to
chcel nechať tak — kartový pohľad tam je a v kóde stálo, že „na telefóne je
posun prstom čitateľnejší než rozbitá mriežka". Potom som to zmeral: tabuľka
1160 px v 340 px obale, deväť stĺpcov, a z prvej obrazovky vidno `Výber`
a `Dokument`. Stav, platnosť od, platnosť do, potvrdenia — všetko za hranou.
To nie je „posun prstom", to je skrytý obsah. Rozhodol som teda za karty.

**Ako sa to dá spraviť bez toho, aby jedna adresa vyzerala inde inak.** Server
šírku obrazovky nepozná a hádať ju z `User-Agent` by znamenalo, že ten istý
odkaz ukáže dvom ľuďom dve rôzne veci. Preto sa v automatickom pohľade
vykreslia **oba** zoznamy a vyberá medza v CSS. Stránka je stránkovaná po 25
riadkoch, takže druhá kópia stojí pár kilobajtov, a `display: none` ju skryje
aj pred čítačkou. Vedľajší dôsledok, ktorý bolo treba domyslieť: `view=table`
musí byť v adrese zapísateľné. Dovtedy „prázdno" znamenalo tabuľku, takže
výslovná voľba tabuľky by na telefóne vyrobila prázdnu adresu — a tá tam
odteraz znamená karty. Voľba, ktorú sa nedá vybrať, nie je voľba.

**Drobnosti z TODO: dve z troch boli už dávno hotové.** `branding.logoUrl`
v databáze je `/api/brand/sfz?v=…`, nie stará cesta; docstringy v `i18n.ts`
sedia nad svojimi skupinami. Poznámky v TODO boli zastarané. Pravidlo „kód
a databáza sú pravda, dokumentácia je indícia" sa vyplatilo doslova — keby som
obe „opravil", zmenil by som funkčný stav na základe starého zápisu.

**Tretia drobnosť odkryla dve väčšie.** Chýbajúci `--env-file` v `check`
a `status` bol skutočný. Keď som to opravoval, skúsil som aj `npm run tenant` —
a ten spadol na importe: `pridajDomenu` sa po premenovaní volá `addDomain`.
Pod tým čakala druhá vrstva toho istého: vetvy výsledku testovali `v.stav ===
"pridana"`, kým typ dnes vracia `state: "added"`. Skript teda buď nebežal, alebo
by o doménach klamal. Poučenie: veľké premenovanie treba overiť aj tam, kde
TypeScript nedosiahne — `.mjs` skripty importujúce `.ts` cez hook sú presne to
miesto, kde tsc mlčí.

**O18 sa posunulo z „treba sa opýtať" na „vieme tri veci".** Najdôležitejšia:
zber dát na trénovanie Voyage modelov je v Atlase **predvolene zapnutý**
a vypína ho prepínač v Organization Settings. To nie je otázka na support, to je
prepínač, ktorý má niekto prepnúť. Europe Geography existuje od 1. 9. 2026, ale
kryje priame API, nie automated embedding — presne tú cestu, ktorou ideme.
A doba uchovania logov nikde napísaná nie je; to zostáva otázkou na MongoDB.

tsc čistý, eslint 0 chýb, vitest 1367/1367, build prešiel.

---

## 2026-09-18 (neskoro večer) — dizajnová stupnica, živé filtre, widgety

Ján po preklikaní: „zjednoť veľkosti tlačidiel, písma, polí a pills,
dorob aktívne filtrovanie, Reťaz dôkazov ako rozbaľovacie widgety,
zvonček väčší". Najprv som si to zmeral, nie odhadol: `grep` našiel **370
inline `fontSize` v 18 hodnotách** a h1 v troch veľkostiach naprieč 25
obrazovkami. To nie je vec vkusu, to je chýbajúca stupnica.

**Čo sa ukázalo pri výške ovládačov.** Tlačidlo, pole a select si výšku
odvodzovali z písma a odsadenia, každý inak — a natívny select si k tomu
pridal svoje. Token `--control-h` to zrovnal, ale prvé meranie v prehliadači
ukázalo 42 vs 40 px: pole dedilo `line-height: 1.6` z `body`, takže obsah
mal 24 px a pretlačil `min-height`. Merať v prehliadači, nie veriť CSS —
to je poučenie dňa.

**Živý filter je serverový, nie prehliadačový.** Filtrovať to, čo je práve
vykreslené, by dávalo iné výsledky než odoslaný formulár (zoznam môže mať
viac strán a filtre sa skladajú) — dve pravdy o tom istom zozname. Preto sa
mení adresa a zoznam skladá server; `router.replace` a nie `push`, inak by
tlačidlo Späť prechádzalo písmeno po písmene. Pozor na React: `onChange`
na formulári vyskočí aj pri písaní, takže „výber hneď, písanie s odkladom"
sa musí rozlíšiť podľa prvku (`HTMLSelectElement`), nie podľa udalosti.

**Widgety sú natívne `<details>`.** Žiadny stav, žiadny klient — rozbalenie
funguje bez JavaScriptu, ovláda sa klávesnicou a prehliadač nájde text aj
v zloženej karte. Overené naživo: filter „galk" zúžil 7 povinností na 3,
fokus zostal v poli a otvorená karta zostala otvorená.

tsc čistý, eslint 0 chýb, vitest 1367/1367, build prešiel.

**Overenie na 375 px stálo viac než samotná oprava.** `resize_window`
v rozšírení ani zmena rozmerov okna cez AppleScript layout viewport
nepohli — `innerWidth` zostal 1011 bez ohľadu na okno. Použiteľná bola až
emulácia v zabudovanom prehliadači (375 × 812). Poučenie: merať mobil sa
dá len tam, kde sa dá vynútiť viewport, nie zmenšením okna.

Meranie potom našlo dve miesta, ktoré stupnicu obchádzali, a ani jedno
nebolo vidieť na stolnom monitore: pole hľadania v hlavičke (32 px / 13 px)
a návrhy otázok na úvodnej stránke (29 px / 12 px). Prvé je skutočná chyba
— Safari na iOS pri kliknutí do poľa s písmom pod 16 px stránku priblíži
a sám ju nevráti späť; druhé je terč, do ktorého sa palcom trafí ťažko.

Falošný poplach na `/library`: živý filter tam „nefungoval", ale chyba bola
v teste — klik padol na popisku, nie do políčka, takže sa nikam nepísalo.
Po správnom teste sa 10 dokumentov zúžilo na 1 a adresa sa zmenila. Overené
sú všetky zoznamy: knižnica, osoby, adresár, reťaz dôkazov aj audit —
vrátane toho, že audit si pri filtrovaní ponechá `tab=audit`.

Otvorené (pre Jána): knižnica má na úzkej obrazovke prepínač Tabuľka/Karty
a predvolená je tabuľka, ktorá sa posúva do strany. Karty už existujú —
je to rozhodnutie, nie chyba.

---

## 2026-09-18 (večer 2) — spätná väzba z preklikania: číselníky, Návod, zvonček, selecty

Ján poslal štyri nálezy zo živého klikania. Najvážnejší: **číselníky
padali na 500** — `CUSTOM_CODELISTS` dostal s D85 tretí druh `workplace`,
ale popisky v slovníku nikto nedoplnil a `labels[name].name` na `undefined`
zhodil celú obrazovku. Ponaučenie na zapamätanie: `Record<string, …>`
v slovníku znamená, že typová kontrola mlčí — každý zoznam kľúčov, cez
ktorý sa mapuje do slovníka, potrebuje test. `codelistLabels.test.ts`
odteraz beží za všetky tri jazyky.

Návod dostal bielu kartu a hlavne pravdu: pôvodný text tvrdil, že skenované
PDF „prepisuje jazykový model" — v skutočnosti ho prevod odmietne a prepis
je ručný krok z editora s návrhom na prevzatie. Sekcia 4 teraz hovorí presne
to, na čo sa Ján pýtal: členenie robia pravidlá (žiadne LLM), odtlačky
počíta databáza pri uložení, model prichádza až pri odpovedi. Pri kontrole
vypadol aj bonus: accept nového znenia na detaile ponúkal `.doc/.rtf/.odt`,
ktoré prevod nepozná, a nevedel `.xlsx/.csv`.

Zvonček: pilulka `.app-nav-count` vedľa ikony pôsobila ako podčiarknuté
číslo — nahradená `.bell-badge`, červený krúžok cez roh ikony s lemom vo
farbe podkladu. Selecty: jediný natívny `<select>` je filter v Reťazi
dôkazov (+ `noscript` zálohy) — namiesto prepisovania na komponent stačilo
`appearance: none` a vlastný chevron v CSS, s tmavým variantom (dátová
adresa premennú nevie, chevron je preto dvakrát).

tsc čistý, eslint 0 chýb, vitest 1367/1367, build prešiel.

---

## 2026-09-18 (dodatok 2) — contineoapp obmedzený na cluster Contineo

Ján dotiahol prístup aplikačného používateľa: v Atlase zapol „Restrict
Access to Specific Clusters" a nechal len cluster Contineo. Rola v rámci
clustra zostáva readWriteAnyDatabase — pri jednom clustri s jedinou
databázou je to prakticky to isté ako readWrite@contineo, takže položku
zatváram bez ďalšieho zužovania. Overil som po zmene: connectionStatus
prejde, číta 1991 úsekov, skúšobný zápis do `_ping_test` prešiel a hneď
sa zmazal, sign-in vracia 200. Z kompenzačných krokov O12 zostáva rotácia
hesla starého správcovského účtu a Atlas alerty.

---

## 2026-09-18 (dodatok) — TextEditor bez SSR chyby

Drobnosť z logov opravená hneď: toast-ui sa v `TextEditor.tsx` importuje
dynamicky až v `useEffect`, statický import nahradil `import type` (typ sa
z behu vymaže, takže server modul knižnice už vôbec nevyhodnocuje). Efekt
má zrušenie (`cancelled`) pre prípad odmontovania počas načítavania a
cleanup ničí editor cez `editor.current`. CSS import zostal statický —
štýl DOM nepotrebuje. tsc, eslint, 1364 testov aj build prešli.

---

## 2026-09-18 (poobede) — produkcia už nebeží na správcovskom účte DB

Ján založil aplikačného používateľa `contineoapp` (readWriteAnyDatabase,
bez atlasAdmin), vymenil URI vo Verceli aj lokálne a redeployol. Overenie:

- `connectionStatus` cez nové URI: jediná rola `readWriteAnyDatabase` —
  správa clustra a používateľov už z aplikačného pripojenia nejde.
- Knižnica na intranete načítala všetkých 10 dokumentov z produkčnej DB.
- `/ask` prešiel celou reťazou: $rankFusion → $rerank → generovanie —
  odpoveď o predčasnom ukončení stretnutia so 7 doslovnými citáciami
  z čl. 70 Súťažného poriadku. Čítanie aj zápis (záznam o odpovedi) teda
  fungujú pod novým používateľom.
- Logy nového nasadenia: nula chýb.

Bonus z Jánovho screenshotu: **logo v e-mailoch sa v schránke naozaj
zobrazuje** — denná pripomienka termínu niesla hlavičku SFZ. Posledná
neoverená vec z opravy `logoTag()` odškrtnutá.

Do TODO pribudli dve drobnosti: voliteľné zúženie `contineoapp` na
`readWrite@contineo` (Specific Privileges v Atlase) a rotácia hesla
starého správcovského účtu, ktorého URI dosiaľ ležalo vo Verceli.

A jeden starý známy v logoch: `ReferenceError: Element is not defined`
pri SSR module TextEditora na `/library/[id]/text` — existuje od 30. 8.
(dávno pred dompurify 3.4.15), stránke nebráni, spustí sa raz pri otvorení
editora. Zapísané nižšie ako drobnosť na opravu (dynamický import bez SSR).

---

## 2026-09-18 (noc) — O12 revidované: Static IPs odložené, allowlist kryjú lacnejšie opatrenia

Ján: „pri jednom tenantovi toto celé považujem za zbytočný náklad". Cena
overená v oficiálnej dokumentácii Vercelu: **100 $/mes. na projekt** plus
metrovaný Private Data Transfer — cez statické IP tečie každý dotaz do
Atlasu. Pri jednom tenantovi ročne 1 200+ USD za druhý faktor k databáze,
ktorého hrozbový model (únik connection stringu) sa dá z väčšej časti pokryť
zadarmo. Súhlasil som s odkladom — s podmienkou, že sa nezapíše ako
„zbytočné", ale ako **odložené so spúšťačmi**: druhý platiaci tenant,
verejný widget, tender/bezpečnostný dotazník. Vtedy sa to prestane platiť
z nákladov a začne predávať.

**Nález pri zápise, ktorý celé rozhodnutie robí naliehavejším:**
`connectionStatus` z produkčného URI ukázal, že aplikácia sa pripája ako
`janletko_db_user` s rolami `atlasAdmin`, `readWriteAnyDatabase`,
`dbAdminAnyDatabase`. Produkcia teda beží na plnom správcovskom účte
clustra — uniknutý URI by nedal útočníkovi len dáta, ale celý cluster
vrátane správy používateľov. Prvý kompenzačný krok je preto samostatný
aplikačný používateľ len s `readWrite` na `contineo` a potom rotácia hesla
správcovského účtu. Zapísané v TODO pod revidovaným O12.

Papierovačky: revízia v `OPEN_DECISIONS.md` (riadok O12), dodatok k N1
v bezpečnostnej kontrole, TODO preklopené z blokátora na tri kompenzačné
kroky. **Prvé ostré potvrdenie tým prestalo mať blokátor v O12.**

---

## 2026-09-18 (večer) — N4 a N6, z kontroly zostáva už len O12

**Hlavičky (N4):** `headers()` v `next.config.mjs` — frame-ancestors,
X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy. Vedome BEZ
plnej CSP: Next vkladá inline skripty, poctivá CSP znamená nonce cez
middleware a testovanie všetkých obrazoviek — prílepok k dnešku by skončil
buď deravou politikou, alebo rozbitou stránkou. Zapísané ako samostatný
krok s nižšou prioritou.

**Hláška (N6):** `generateAnswer()` má vlastný catch vnútri streamu a ten
posielal `err.message` doslovne — route svoju všeobecnú vetu uplatňoval len
na chyby PRED generovaním. Jazyk sa do `GenerateOptions` odovzdáva z route;
`smoke.mjs` ho nedáva a padá na slovenčinu, čo je preň správne. Test vyvolá
chybu profilom s neznámym druhom generovania — žiadna sieť, žiadne mocky
SDK — a overí, že von ide `answer.failed` a nie text výnimky.

tsc čistý, eslint 0 chýb, vitest 1364/1364 (3 nové), build prešiel, dev
server nebežal (overené pred buildom).

---

## 2026-09-18 (dokončenie) — editor s dompurify 3.4.15 overený v produkcii

Posledný otvorený kúsok N2. Najprv staticky: toast-ui volá na dompurify len
API, ktoré v 3.4.x existuje (`sanitize`, `addHook`, `setConfig`,
`isValidAttribute`…) — skok 2.x → 3.x teda nemal čo rozbiť. Potom naživo,
v Chrome na intranete (build `5a6a747` podľa pätičky), na skúšobnej smernici
`sfz:test_onboarding` a bez uloženia:

- WYSIWYG vykreslil nadpisy, tučné, zoznamy aj kódový span; prepínanie
  Markdown ↔ WYSIWYG tam a späť bez chyby v konzole.
- Payload `<img src=x onerror=…>` + `<script>…</script>` v Markdown režime:
  náhľad `onerror` odstránil, `<script>` zahodil celý, nič sa nespustilo.
  Po prepnutí do WYSIWYG to isté — obsah skriptu skončil ako neškodný text.
- Testovací riadok som z editora zmazal a odišiel bez uloženia; buffer končí
  pôvodnou vetou.

N2 je tým uzavreté celé. Z bezpečnostnej kontroly zostáva O12, hlavičky (N4)
a hláška v `generateAnswer()` (N6).

---

## 2026-09-18 (pokračovanie) — N2 a N3 z bezpečnostnej kontroly vyriešené

Ján: „toto vyriešme prosím — CSV formula injection a xlsx/dompurify".

**CSV (N3):** apostrof pred bunky začínajúce `=`, `+`, `-`, `@`, tab, CR
v `toCsv()`. Jedna vec stojí za zápis: escapoval som aj `-`, hoci to raz môže
dať apostrof zápornému číslu — Excel totiž `-2+3+cmd|...` spustí ako vzorec
rovnako ochotne ako `=`. Dnes žiadny export záporné čísla nevypisuje, takže
kompromis nič nestojí.

**xlsx (N2):** npm registri zostane 0.18.5 navždy — SheetJS z npm odišiel.
Rozhodnutie Jána: oficiálna distribúcia. `package.json` ukazuje na pinovaný
tarball `cdn.sheetjs.com/xlsx-0.20.3/...` (0.20.4+ neexistuje, overené HEAD
dotazmi), lockfile drží integritu. API sedí, `conversion.ts` bez zmeny.

**dompurify (N2):** toast-ui si žiada ^2.3.3; `overrides` vynútil 3.4.15.
Skok 2.x → 3.x pod cudzou knižnicou je jediné riziko dňa — tsc, 1361 testov
aj build prešli, ale náhľad editora testy nepokrývajú. Nechal som v TODO
„raz preklikať editor v knižnici".

`npm audit`: **0 zraniteľností** (z 1 high + 2 moderate). Pozor pre budúce
inštalácie: `npm install` teraz ťahá tarball z cdn.sheetjs.com — offline
inštalácia bez cache zlyhá na tomto balíku.

Pri zápise `package.json` cez python v heredoc-u mi ušiel doslovný `\n` na
konci súboru a npm ho odmietol parsovať — quoted heredoc neexpanduje escape
sekvencie ani v reťazcoch, ktoré vyzerajú ako python. Opravené, zapamätať si.

---

## 2026-09-18 — web zosúladený s D90 (a s tým, čo máme na papieri)

Ján schválil opravy nesúladov z včerajšej kontroly. `web/lib/dictionaries.js`,
všetky tri jazyky naraz (i18n test webu neexistuje, tak aspoň disciplína):

- **Hierarchia a `scope: global`** už nesľubujú krížovú viditeľnosť — všade
  „zdieľanie v hierarchii pripravujeme", viditeľnosť je vlastná organizácia
  (D90). Prípadová štúdia SFZ hovorí „samostatné organizácie s vlastným
  obsahom". Pravidlo značkovania „nekopírovať pre každú jednotku" muselo
  preč tiež — po D90 by bolo návodom na neviditeľný obsah.
- **Vertex AI von, Bedrock zostáva** — rozhodnutie Jána: tabuľka tvrdí len
  to, čo v kóde je; Bedrock je jediná cesta k eu-full generovaniu bez GPU.
- **„Infinity (voyage-4-nano) / TEI (BGE-M3)"** — TEI voyage-4-nano
  nepodporuje (O7 nález A); zátvorky teraz sedia s realitou serverov.
- **Zero-retention pri Anthropic zmiernené na „potvrdzujeme zmluvne"** —
  Ján 2026-09-18 poslal žiadosť na Anthropic sales support; keď príde
  písomné potvrdenie, silné znenie sa vráti (SK 220, CS 953, EN 1687 +
  sekcia Bezpečnosť a „otvorený bod" v rezidencii).
- Zmienka o „eval sade D9" sa na webe už nenachádza — položka v TODO bola
  zastaraná, odškrtnutá bez zmeny kódu.

`npm run build` webu prešiel (statický export). Lint vo `web/` nie je
nakonfigurovaný — nechávam tak, nie je súčasť rozsahu.

---

## 2026-09-17 (noc) — bezpečnostná kontrola pred prvou ostrou verziou

Ján si vyžiadal komplexnú kontrolu: kód, závislosti, infra a súlad webu
s repozitárom, plus zápis on-prem cesty. Výsledok je v
`docs/BEZPECNOSTNA_KONTROLA_2026-09.md` a `docs/decisions/ADR-009-on-prem-referencna-architektura.md`.

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
  jediného posudku sú odpoveď. `docs/decisions/ADR-008-zrusenie-zlatej-sady.md`.
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
