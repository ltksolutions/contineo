# Changelog

Všetky podstatné zmeny projektu Contineo. Formát vychádza z [Keep a Changelog](https://keepachangelog.com/sk/).

## [Unreleased]

### Import osôb už nemaže roly, skupiny ani trasy (2026-09-22)

**Každý import zmazal roly každému, koho sa dotkol.** `upsertPersons()`
zapisovalo `tracks`, `groups` a `roles` vždy — aj keď o nich súbor nehovoril.
Súbor bez stĺpca skupín ich teda existujúcim ľuďom vyprázdnil, a keďže roly
CSV nerozpoznáva vôbec, prišiel o ne pri každom behu každý, kto bol v súbore.

- **Zapisuje sa len to, čo v riadku naozaj je.** Chýbajúce pole znamená
  „o tomto nič nehovorím", prázdne znamená „vyprázdni" — dva rôzne pokyny,
  ktoré dovtedy splývali.
- **Prázdny stĺpec teraz naozaj vyprázdni.** Dovtedy sa to nedalo vôbec:
  prázdna bunka padala do `undefined` rovnako ako chýbajúci stĺpec. Rozdiel
  vie rozlíšiť jedine čítanie CSV, kde vidno hlavičky (`hasField()`).
- **História členstva sa hýbe spolu so skupinami**, nie samostatne — keď
  riadok o skupinách mlčí, členstvo sa nemení, takže nie je čo zapisovať.
- Obrazovka importu to hovorí **pred** nahraním, nie až v náhľade.

### Zhoda zdroja v troch stupňoch (2026-09-22)

Pri odpovedi sa už nekreslí surové skóre, ale „vysoká / stredná / slabá
zhoda" — **relatívne k najlepšiemu zdroju tej istej odpovede**. Číslo ako
„0,94" by predstieralo presnosť, ktorú nemá: pri hybridnom hľadaní nie je
v rozsahu 0–1 a medzi režimami nie je porovnateľné. Bez skóre sa nekreslí nič.

### Expirované znenia sa dajú vyfiltrovať (2026-09-22)

Filter stavu v knižnici má štvrtú hodnotu **Expirované**: publikovaný
dokument, ktorý dnes nemá platné znenie, hoci aspoň jedno už mal. Stav
dokumentu sa tým nemení (D27) — je to podmnožina publikovaných, odvodená
z platnosti znenia, nie uložený príznak.

### Zaradenie sa zlúčilo do Druhu (2026-09-22, ADR-010 / O21)

Dokument mal dve podobné políčka: **Zaradenie** (kam patrí) a **Druh** (čo to
je). Odkedy identitu nesie kľúč dokumentu (D80), bolo Zaradenie druhou
škatuľkou na to isté. Odchádza — do Druhu pribudli zápisnica, zmluva
a tlačivo, aby mali kam prejsť dokumenty, ktoré normy nie sú. Zaradenie sa
už nikam nezapisuje; z existujúcich dát ho odstráni migračný skript, ktorý
najprv beží nasucho.

### Výber v knižnici má strop (2026-09-22)

Naraz sa dá označiť najviac 200 dokumentov. Výber sa nesie v adrese, aby
prežil prechod na ďalšiu stranu a fungoval bez JavaScriptu; nad stropom by sa
adresa niekde po ceste orezala a výber by zmizol bez vysvetlenia. Pás akcií
to povie nahlas.

### Správa platformy: kód organizácie navrhne Contineo (2026-09-22, ADR-010)

Pri zakladaní organizácie sa kód navrhne z názvu (iniciály bez diakritiky,
obsadený dostane variant) a admin ho môže prepísať — organizácie svoju
skratku spravidla majú. Kód je súčasťou identifikátora každého dokumentu
a po založení sa nemení, tak to hovorí aj nápoveda. Keď je zvolený kód
obsadený, hláška zo servera rovno ponúkne voľný.

### Pozvánka sa naozaj odosiela — a dá sa poslať znovu (2026-09-21)

**Formulár „Pozvať osobu" e-mail neposielal vôbec.** Osobu zapísal, nastavil
jej stav `invited` a ohlásil „Pozvaná" — hlásil teda zápis do evidencie, nie
odoslanie. E-mail odchádzal až hromadnou akciou na `/people/invite`, o ktorej
ten, kto niekoho pozval, nemusel vedieť. Nájdené na skutočnom prípade:
pozvaná osoba čakala na e-mail, ktorý nikdy nikto neposlal.

- **Pozvanie osoby teraz pozvánku aj odošle.** Zlyhanie pošty osobu nezruší:
  zostáva zapísaná a hláška povie, že pozvánku treba poslať znovu.
- **Nové tlačidlo „Poslať pozvánku znovu"** na detaile osoby. Ponúka sa len
  tomu, kto ešte ani raz nebol dnu a nie je vyradený.
- **Jedno kritérium na jednom mieste** — `needsInvitation()` v
  `lib/personFields.ts` rozhoduje o tlačidle aj o serverovej akcii a je to tá
  istá podmienka, akú kladie `neverSignedIn()` do databázy. Rozhoduje
  `firstLoginAt`, nie `status`: osoby z importu a zo samozaloženia (D47) majú
  `active` od začiatku a pozvánku nikdy nedostali.
- Skladanie pozvánky je v jednej funkcii (`sendInviteTo`) pre formulár,
  tlačidlo aj hromadné rozosielanie — dve kópie by sa raz rozišli.

### Knižnica podľa solo handoffu: farebné stavy, pásiky potvrdení, karta pre palec (2026-09-21)

Implementácia `docs/design/KNIZNICA.md` (vizuál `Contineo Obrazovky.dc.html`,
sekcia `#s-kniznica`), päť úloh:

- **Stavové pilulky nesú farbu** — publikované zelené, koncept oranžový,
  na schválenie v akcente, zlyhanie prevodu červené. Technický stav
  spracovania sa ukazuje len keď niečo hovorí („vo vyhľadávaní" pri každom
  riadku bol šum).
- **Potvrdenia sú vodorovný pásik + percento** v tabuľke aj na karte —
  osem pásikov sa dá porovnať pohľadom, osem čísel v texte nie. Menovateľ
  (O6/7) nezmizol: nesie ho `title` a text pre čítačku. Pomlčka znamená
  „nikomu nepridelené", nie „nikto nepotvrdil".
- **Pole hľadania nesie značku Continea** (nie lupu) a má 36 px / r9 ako
  pole v hlavičke.
- **Pás hromadných akcií na telefóne nahradí spodnú navigačnú lištu** —
  dva pásy nad sebou by oba tvrdili, že sú dôležité. „Zrušiť výber" je ×
  v rohu pásu.
- **Karta dokumentu podľa rámu Telefón 390**: výber 22 px vľavo vo vlastnom
  stĺpci, prvý riadok pilulka · kategória · verzia, pod názvom
  `interné číslo · priečinok`, posledný riadok pásik potvrdení. Označená
  karta to povie plochou.

### Knižnica podľa vzoru: nástroje pri zozname, pás akcií vo farbe, textová navigácia (2026-09-21)

Opravy z Jánovej kontroly produkcie proti návrhu (Obrazovky.dc.html):

- **Hľadanie, chips a „+ Podmienka" sú v stĺpci zoznamu**, nie cez celú
  šírku nad mriežkou — filtre vľavo, všetko o zozname pri zozname.
- **Pás hromadných akcií je nad tabuľkou a vo farbe akcentu**, so
  „zrušiť výber" priamo v ňom. Tichá karta pod tabuľkou sa strácala.
- **Pás navigácie je textový.** S ikonou pri každej položke sa desať
  položiek do šírky shellu nezmestilo a „Na posúdenie" prepadávalo do
  „Viac" aj na širokom monitore. Ikony ostávajú v spodnej lište a bočnom
  paneli, kde nesú informáciu samy.
- **Číselníky bez kľúča v popisku** — „Norma (norma)" bol pozostatok
  ladenia v `codelistOptions()`; facety aj formuláre teraz ukazujú čisté
  názvy.
- **Zvonček znova ukazuje skutočný počet** neprečítaných — bodka z návrhu
  hovorila len „niečo", číslo hovorí „koľko" (rozhodnutie 2026-09-21).
- **`viewport-fit=cover`** (`layout.tsx`, prvá a jediná zmena od handoffu,
  schválená) — spodná lišta na iPhone rešpektuje domáci indikátor.
- Nadpis „Knižnica dokumentov" podľa vzoru.

### Adresár: tri stĺpce a kontakty pod palcom (2026-09-20)

Posledný krok dnešnej vlny plánu nasadenia (`docs/design/NASADENIE.md`, PR 6):

- **Karty na všetkých šírkach: 1 / 2 / 3 stĺpce** (3 od 1024 px).
- **E-mail a telefón sú na telefóne akčné tlačidlá 36 px**, nie text —
  adresár existuje preto, aby sa niekomu dalo ozvať. Na desktope ostávajú
  textové odkazy: tam sa kontakt aj kopíruje.

### Detail a Prehľad na telefóne: potvrdenie pod palcom (2026-09-20)

Plán nasadenia (`docs/design/NASADENIE.md`, PR 5):

- **Potvrdzovacie tlačidlo pod 640 px pláva nad spodnou lištou** ako pás
  50 px na celú šírku — potvrdenie je dôvod, prečo je človek na stránke,
  a tlačidlo na konci dlhého textu bolo treba hľadať. Formulka zostáva
  v karte a ukladá sa doslovne (D28), pás na nej nič nemení.
- **Bočný panel detailu je na telefóne kartou nad textom**, nie pod ním —
  potvrdenia, platnosť a súvisiace sa kontrolujú na pár sekúnd; kto prišiel
  čítať, preskočí ich jedným potiahnutím. (Obrat pôvodného rozhodnutia.)
- **KPI dlaždice Prehľadu: 2×2 na telefóne, 4×1 od 1024 px** — `auto-fit`
  robil medzistav s tromi stĺpcami a štvrtou dlaždicou osamelou.
- **Akcie schvaľovania sú na telefóne pod sebou, každá 44 px** — „Schváliť"
  a „Vrátiť s pripomienkou" vedľa seba sa na 390 px preklikávali omylom.

### Knižnica: správa priečinkov na vlastnej stránke, zásuvka filtrov, akcie pod palcom (2026-09-20)

Najväčší krok plánu nasadenia (`docs/design/NASADENIE.md`, PR 4):

- **`/library/folders`** — premenovanie, presun, poradie ťahaním aj
  zakladanie priečinkov odišli z panela filtrov na vlastnú stránku.
  Filtrovanie a správa sú dve úlohy; na telefóne bol panel stĺpec dlhý
  stovky riadkov. Panel priečinok len vyberá a odkazuje na správu.
- **Filtre: stĺpec ↔ zásuvka.** Od 1024 px stĺpec vedľa zoznamu; pod ňou
  tlačidlo „Filtre N" pri poli hľadania otvorí zásuvku ukotvenú dole —
  ten istý obsah, facety ako pilulky 36 px, dole „Zobraziť N dokumentov".
  Bez JavaScriptu: `<details>`, každý facet je odkaz. Kotvy „Filtre ↓"
  a „↑ Späť na zoznam" tým skončili.
- **Hromadné akcie až po označení.** Výber je v adrese, takže server vie,
  či niečo označené je — pruh ovládačov bez výberu nemal na čom pracovať.
  Na telefóne panel prekryje spodnú lištu navigácie.
- **Prepínač pohľadu sa pod 640 px skrýva** — sú tam len karty. Výslovné
  `view=table` v adrese platí ďalej.
- **Akcie hlavičky:** primárna jedna (Nahrať dokument), Export CSV
  sekundárny, Kolá a Kurácia v ponuke „⋯". Šesť tlačidiel sa na telefóne
  lámalo do troch riadkov.

### Hlavička: jeden riadok 56 px, značka namiesto lupy, bodka namiesto čísla (2026-09-20)

Podľa plánu nasadenia (`docs/design/NASADENIE.md`, PR 3):

- **Riadok hlavičky je pevných 56 px na všetkých šírkach.** Zalamovanie bolo
  poistkou z čias, keď si pole pýtalo pevnú šírku; odkedy si berie zvyšok
  riadka, druhý riadok hlavičky bol len mrhaním zvislým miestom.
- **Logo tenanta 28 px (r8); kto logo nenahral, má značku Continea v bielej
  na `--accent`** — nie iniciálu z názvu, tá vyzerá ako rozbité logo.
- **Pole „opýtať sa" má 36 px, r9 a značku Continea vľavo** — nie lupu:
  nie je to hľadanie, je to otázka. Vpravo nápoveda `⌘K` (`Ctrl K` mimo
  Macu), pod 640 px sa skrýva.
- **Zvonček je v `Icon.tsx`** (`notifications`, tá istá mriežka 18×18) a
  číslo na ňom nahradila **bodka 7 px** `--bad-fg` s lemom `--surface` —
  signál na jeden pohľad; počet povie `aria-label` a stránka upozornení.

### Navigácia v troch tvaroch: spodná lišta, pás s prepadom, plný pás (2026-09-20)

**Na telefóne bola navigácia zásuvka `<details>`, ktorú bolo treba najprv
nájsť a otvoriť.** Podľa plánu nasadenia (`docs/design/NASADENIE.md`, PR 2)
ju nahrádza pevná spodná lišta: Prehľad · Opýtať sa · Knižnica · Úlohy ·
Viac — vždy na obrazovke, na dosah palca.

- **„Úlohy" zlučujú** „Na potvrdenie" a „Na schválenie": súčet v odznaku,
  položka svieti na oboch cestách. „Na schválenie" je aj v zozname „Viac",
  inak by sa naň z telefónu nedalo dostať.
- **Nová routa `/more`**: zvyšok navigácie v skupinách Organizácia / Správa,
  riadky 52 px. Osobné veci ostávajú pod avatarom v hlavičke — bez duplicít.
- **Pás (640–1023 px) sa už nikdy neroluje vodorovne** — čo sa nezmestí,
  spadne do ponuky „Viac N" na konci pásu. Šírky meria `ResizeObserver` nad
  skrytým dvojníkom pásu; bez JavaScriptu sa vykreslí prvých 6 položiek
  + „Viac" so zvyškom. Od 1024 px je pás 42 px a zmestí sa celý.
- Role a počty pre navigáciu sa presunuli z `AppShell` do `lib/navData.ts`
  (`cache()`), takže `/more` kreslí presne to, čo lišta, bez dotazov navyše.
- Kostra (`Skeleton.tsx`) dostala spodnú lištu namiesto zásuvky; ikona „Viac"
  (tri bodky) pribudla do `Icon.tsx`.

### Dva breakpointy namiesto ôsmich (2026-09-20)

**Rozhranie malo osem šírok zlomu (419–940 px), takže sa layout medzi telefónom
a notebookom preskupoval osemkrát.** Podľa plánu nasadenia návrhu
(`docs/design/NASADENIE.md`, PR 1) sú odteraz dva: **640 a 1024**.

- Všetkých 28 `@media` v `globals.css` presunutých na najbližší z dvoch;
  `max-width` tvary používajú 639/1023, takže sa s `min-width` neprekrývajú
  (zmizol aj presný prekryv na 640 px pri lište editora).
- Prepínač tabuľka↔karty v knižnici prepína na **1024 px**, nie na mechanicky
  najbližších 640: tabuľka je široká ~1160 px a plán pri knižnici hovorí
  „od 1024 px tabuľka". Na tablete sú teda karty, nie oškrtaná tabuľka.
- **Dotykové ciele 44 px pod 640 px**: facety, chips filtrov, riadky stromu
  priečinkov, × v chipoch výberu a „Upraviť" v strome (inline štýl nahradila
  trieda `tree-edit-toggle`).
- Tokeny z PR 1 (`--accent-soft`, šestica hustoty) už v kóde boli — doplnené
  len komentáre pri zmenených hraniciach (`globals.css`, `Skeleton.tsx`).

### Knižnica na telefóne, opravené skripty a čo je doložené o Voyage (2026-09-18)

**Knižnica mala na telefóne predvolenú tabuľku, z ktorej nebolo vidieť nič
podstatné.** Tabuľka má deväť stĺpcov a je široká 1160 px; v 340 px obale z nej
bolo vidieť názov dokumentu a nič viac — stav, platnosť ani potvrdenia už nie,
a dopátrať sa k nim znamenalo tri a pol obrazovky posunu prstom.

- Predvolený pohľad je odteraz **automatický**: od 760 px tabuľka (dokumenty sa
  porovnávajú a na to musia byť tie isté údaje pod sebou), pod ňou karty.
  Vykreslia sa oba zoznamy a vyberá medzi nimi CSS — server šírku obrazovky
  nepozná a jedna adresa má vyzerať rovnako na každom zariadení.
  `display: none` ten druhý skryje aj pred čítačkou, takže sa zoznam neprečíta
  dvakrát.
- **Výslovná voľba v prepínači šírku prebije** a zapíše sa do adresy. `view=table`
  je preto odteraz skutočná hodnota, nie „prázdno znamená tabuľka" — inak by sa
  tabuľka na telefóne nedala vybrať vôbec. V automatickom pohľade nie je
  zvýraznená voľba človeka (nikto nič nevybral), ale to, čo je práve vidieť.

**`npm run tenant` vôbec nebežal.** Importoval `pridajDomenu` z `lib/vercel.ts`,
kde sa funkcia po premenovaní volá `addDomain`, a všetky vetvy výsledku testoval
na staré slovenské hodnoty (`v.stav === "pridana"`), kým typ vracia
`state: "added"` — takže aj keby sa import podaril, správy o doménach by boli
nesprávne. Opravené a overené naživo. `check`, `status` aj `tenant` dostali
`--env-file=.env.local`, bez ktorej končili na „Chýba MONGODB_URI".

**O18 — čo je o Voyage doložiteľné.** Trénovanie na odoslaných dátach je
predvolene **zapnuté** a vypína sa prepínačom *Help Improve Voyage AI Models*
v Atlase — **a ten je od 2026-09-18 vypnutý**. Europe Geography je od 1. 9. 2026
v public preview, ale kryje priame Embedding and Reranking API, nie automated
embedding, ktorý používame. Doba uchovania logovaných payloadov zverejnená nie je. Zapísané v `docs/TODO.md`
a v tabuľke sub-procesorov v `docs/GDPR_DATA_PROTECTION.md`.

### Jedna stupnica veľkostí, živé filtre a rozbaľovacie widgety (2026-09-18)

**Rozhranie vyzeralo poskladané z viacerých období** a bolo to merateľné:
18 rôznych veľkostí písma v ~370 inline štýloch a nadpis obrazovky v troch
veľkostiach (25, 26, 27 px) podľa toho, kedy obrazovka vznikla. Tlačidlo,
textové pole a `<select>` mali každý inú výšku, takže vo filtri stáli
v rade a nesedeli — najviditeľnejšie v Reťazi dôkazov.

- **Tokeny v `:root`**: `--fs-title|section|lead|body|small|micro|label`,
  `--fs-control` (16 px na telefóne kvôli priblíženiu v Safari, 15 px od
  760 px) a `--control-h: 40px`. Tlačidlo, `.field-input`,
  `select.field-input` aj `.select-button` majú odteraz rovnakú výšku aj
  písmo; pole má vlastný `line-height`, lebo zdedených 1.6 z `body` ho
  robilo o dva pixely vyšším než tlačidlo vedľa.
- `.page-title`, `.page-lead` a `.page-head` nahradili inline nadpisy
  a úvodné odstavce na 34 miestach; štítky (`.tag`) majú jednu veľkosť
  a výšku 24 px. Zvyšných 307 inline veľkostí sa prepísalo na tokeny, takže
  zmena stupnice je odteraz zmena na jednom mieste.
- **Zvonček** v hlavičke: ikona 17 → 21 px, terč 40 px ako avatar vedľa
  neho, väčší odznak s počtom.
- **Živé filtrovanie** (`components/LiveFilter.tsx`) na piatich zoznamoch —
  knižnica, osoby, adresár, reťaz dôkazov, audit. Píše sa do poľa a zoznam
  sa obnoví sám (250 ms po poslednom údere; výber v `<select>` hneď).
  Filtruje **server**, mení sa adresa (`router.replace`, nie `push`, aby sa
  Späť neprehrýzalo písmenami), takže odkaz zostáva zdieľateľný a výsledok
  je ten istý ako po odoslaní. Bez JavaScriptu zostáva formulár aj tlačidlo.
- **Reťaz dôkazov ako rozbaľovacie karty** na natívnom `<details>`: zložené
  je vidieť kto, stav a znenie, os sa otvorí až keď ju niekto chce čítať.
  Sedem povinností dovtedy znamenalo takmer tridsať riadkov osí pod sebou.
- **Dve výnimky z tej istej stupnice** našlo až meranie na 375 px:
  hľadanie v hlavičke malo 32 px a 13 px písmo — pod 16 px Safari na iOS
  pri kliknutí do poľa stránku priblíži a už sa nevráti — a návrhy otázok
  na úvodnej stránke mali 29 px, čo je na dotykový terč málo. Obe sú
  odteraz na `--control-h` a `--fs-control`, respektíve 32 px a `--fs-small`.

### Číselníky opäť fungujú, Návod hovorí pravdu, krajší zvonček a selecty (2026-09-18)

**Obrazovka číselníkov padala na 500.** `CUSTOM_CODELISTS` má tri druhy
(`category`, `tags`, `workplace`), ale slovník mal popisky len pre prvé dva —
`workplace` pribudol s osobnými údajmi (D85) a `/organisation?tab=codelists`
padal na `labels["workplace"].name`. Popisky „Pracoviská" doplnené v SK/CS/EN
a `tests/codelistLabels.test.ts` odteraz stráži, že každý číselník má popisky
vo všetkých jazykoch — typová kontrola to pri `Record<string, …>` nevidí.

**Návod:** text je na bielej karte ako ostatné obrazovky; k typom súborov
pribudli TXT a CSV; veta o skenovanom PDF opravená podľa skutočnosti (prevod
ho odmietne — prepis jazykovým modelom je ručný krok z editora a výsledok je
návrh na prevzatie); sekcia „Členenie, index a inteligentné vyhľadávanie"
prepísaná: kedy index vzniká, že členenie robia pravidlá **bez LLM**,
odtlačky počíta databáza automaticky a jazykový model prichádza na rad až
pri odpovedi. Formulár nového znenia na detaile dokumentu mal navyše zlý
zoznam prípon (`.doc/.rtf/.odt`, ktoré prevod nevie, chýbali `.xlsx/.csv`) —
zjednotený s nahratím nového dokumentu.

**Zvonček v hlavičke** má namiesto pilulky vedľa ikony červený krúžok
s počtom cez pravý horný roh (`.bell-badge`); pri nule sa nekreslí.
**Natívne selecty** (`select.field-input` — filter v Reťazi dôkazov,
`noscript` zálohy) vyzerajú ako ostatné polia: bez systémových šípok,
vlastný chevron, svetlá aj tmavá téma.

### Editor textu sa už nepokúša načítať na serveri (2026-09-18)

`@toast-ui/editor` siaha na DOM (`Element`) už pri vyhodnotení modulu, takže
SSR stránky `/library/[id]/text` zapisoval do logov
`ReferenceError: Element is not defined` pri každom otvorení editora
(od 30. 8. — vidieť to bolo len v logoch, stránka fungovala z klienta).
Import sa presunul do `useEffect`, ktorý beží výhradne v prehliadači; na
vrchu súboru zostal len `import type`. Záloha bez JavaScriptu (skryté pole
s pôvodným textom + `noscript` textarea) sa nemení.

### Bezpečnostné hlavičky a chybová hláška generovania (2026-09-18)

**Každá odpoveď nesie bezpečnostné hlavičky** (`headers()` v
`next.config.mjs`, nález N4): `frame-ancestors 'none'` + `X-Frame-Options:
DENY` (portál sa nedá vložiť do cudzieho rámu — clickjacking na tlačidlo
potvrdenia by bol pri norme obzvlášť zlý), `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin` a vypnuté senzory cez
`Permissions-Policy`. Plná CSP zámerne nie je — inline skripty Nextu by
vyžadovali nonce cez middleware, to je samostatný krok.

**Zlyhanie generovania už nevynáša text výnimky** (nález N6):
`generateAnswer()` posielal do udalosti `error` surové `err.message` z SDK
poskytovateľa. Teraz ide človeku všeobecná veta v jeho jazyku
(`answer.failed`, jazyk sa odovzdáva z `/api/chat`) a príčina do logu —
rovnaké pravidlo, aké `/api/chat` uplatňoval na chyby pred generovaním.
Stráži `tests/llmGeneratorError.test.ts`.

### Bezpečnosť: CSV exporty a zraniteľné závislosti (2026-09-18)

**CSV exporty sú chránené pred formula injection.** Bunku začínajúcu `=`,
`+`, `-`, `@`, tabulátorom alebo CR vyhodnotí Excel ako vzorec — úvodzovky
okolo poľa tomu nezabránia. Do exportov (reťaz dôkazov, prehľad, knižnica,
moje potvrdenia) pritom vstupujú hodnoty, ktoré píše človek alebo prehliadač.
`toCsv()` v `lib/csv.ts` teraz takéto bunky neutralizuje apostrofom;
`tests/csv.test.ts` to stráži. Nález N3 z `docs/BEZPECNOSTNA_KONTROLA_2026-09.md`.

**`npm audit` je čistý — 0 zraniteľností** (bolo 1 high, 2 moderate; nález N2):

- **`xlsx` 0.18.5 → 0.20.3 z oficiálnej distribúcie SheetJS**
  (`cdn.sheetjs.com`) — verzia v npm registri je opustená na 0.18.5 so známym
  prototype pollution a ReDoS a oprava tam nikdy nepríde. API je rovnaké,
  `conversion.ts` sa nemenil; lockfile tarball pinuje aj s integritou.
- **`dompurify` 2.5.9 → 3.4.15 cez `overrides`** — `@toast-ui/editor` si žiada
  zraniteľný rad 2.x a vlastnú opravu nevydal. Override drží aktuálnu verziu,
  kým ju editor nezačne žiadať sám. WYSIWYG náhľad v knižnici treba po
  nasadení raz preklikať — API je kompatibilné, ale je to jeho závislosť.

### Logo v e-mailoch a funkcie vo Frankfurte (2026-09-17)

**Logo v upozorneniach chýbalo.** Značka nesie logo ako `/api/brand/<kód>?v=…`
a absolútnou adresu robil len prihlasovací e-mail. E-maily z cronu, zo
schvaľovania, pozvánky, pripomienky aj oznámenia o pridelení posielali cestu
tak, ako je — v schránke nemá byť k čomu relatívna. Opravené na jedinom mieste,
ktoré hlavičku vykresľuje: `logoTag()` v `ecomail.ts`. Adresa, ktorá už je
absolútna, sa neprepisuje; bez loga sa `<img>` nevykreslí vôbec. `auth.ts` svoju
kópiu pravidla stratil. Stráži to `tests/emailLogo.test.ts` — naraz pre všetkých
šesť e-mailov, nie pre ten jeden opravený.

**Funkcie bežia vo `fra1` (Frankfurt).** Dovtedy `iad1` (Washington), zatiaľ čo
Atlas je vo Frankfurte — každý dotaz do databázy išiel cez Atlantik a späť.
`"regions": ["fra1"]` vo `vercel.json` (rozhodol Ján Letko). Súvisí s ADR-002
(rezidencia údajov) aj s O12: **Static IPs sa zapínajú pre región**, takže sa
zapnú pre `fra1`. Sieť Vercelu doručuje statické súbory naďalej z najbližšieho
miesta — mení sa, kde beží kód, nie odkiaľ sa sťahujú obrázky.

### Audit D90 opravený — organizácia v podmienke každého dotazu (2026-09-17)

Všetky nálezy z `docs/D90_audit_dotazov.md`. Spoločné pravidlo je
`src/lib/tenantScope.ts` — `requireCompanyCode()` bez organizácie vyhodí výnimku.

- **Zápis do záznamu inej organizácie podľa `_id` (A1–A4).** Posudok, spätná väzba
  čitateľa aj kurácia teraz hľadajú záznam podľa `_id` a organizácie konajúceho.
  Predtým vedel správca obsahu zverejniť pripravený pár do znalostí inej organizácie,
  lebo organizácia sa brala zo záznamu. `/api/rating` berie organizáciu z domény
  a osoby ako `/api/chat`; `recordAnswer()` ju vyžaduje.
- **Logo (A5)** sa vydá len na doméne svojej organizácie, výnimka pre správcu platformy
  s pamäťou `private, no-store`.
- **Osoba = organizácia domény + e-mail (B1–B3).** `currentPerson()`, brána prihlásenia,
  evidencia prihlásení, jazyk e-mailu aj skripty `person.mjs` (pri `--email` povinné
  `--company`) a `admin_set.mjs`. **Zmena správania:** kto nie je v organizácii domény,
  neprihlási sa tam — odmietne sa už žiadosť o odkaz, nie až stránka. Núdzová brzda
  `ALLOWED_EMAILS` bez zmeny.
- **Obrana do hĺbky (C1–C5).** `validAcknowledgements()`, `personAcknowledgements()`,
  časy čítania, `loadDocument()`, `addVersion()` a práca s úsekmi v `libraryWrite`
  majú organizáciu v podmienke vždy.

Overené na lokálnom `next start`: logo SFZ na `sfz.localhost` 200, na `localhost` 404;
`/api/rating` bez prihlásenia 401; `jan.letko@` na `sfz.localhost` „persons povolil",
na `localhost` (LTK) „ODMIETOL". Testy 1355/1355.

### Neznáma doména dostane hneď 404 — `middleware.ts` → `proxy.ts` (D29, 2026-09-17)

Neznámy hostiteľ dostal najprv `307` na `/sign-in` a až stránka povedala `404`.
Obsah neunikal, ale cudzia doména sa dozvedela, že tu nejaká prihlasovacia cesta
je — D29 hovorí, že sa nemá dozvedieť nič. TODO to odkladalo s tým, že middleware
beží na edge a do Atlasu nevidí; to platilo pre Next 14.

- **`git mv src/middleware.ts src/proxy.ts`**, funkcia `proxy`. Next 16 názov
  `middleware` označil za zastaraný (build to hlásil) a proxy beží na Node.js.
- **Doména tenanta sa overuje ako prvá bránka** — pred prekladom starých adries
  aj pred prihlásením. `resolveTenant()` s jeho pamäťou (5 min známe, 30 s neznáme).
- **Výnimka jediná: `/api/cron/`** (`HOST_CHECK_EXEMPT` v `publicRoutes.ts`).
  Z akej domény ho Vercel volá, nie je overené; chráni ho `CRON_SECRET`.
- **Výpadok databázy nerozhoduje v proxy** — pokračuje sa ako doteraz a tenanta
  si overí brána prihlásenia aj stránka. `404` pri výpadku by ľuďom tvrdilo, že ich
  organizácia neexistuje.
- **Dôsledok:** náhľady Vercelu (`*.vercel.app`) dostanú `404`, lebo nie sú
  v `tenants`. Rozhodnuté vedome — výnimka sa dá doplniť, keď bude treba.

Overené na lokálnom `next start` s hlavičkou `Host`: cudzia doména → `404` na `/`,
`/sign-in`, `/prihlasenie`, `/api/chat` aj `/api/brand/…`, cron → `401` (tajomstvo);
`sfz.localhost` a `localhost` → `307` na prihlásenie, `/sign-in` `200`.

### `import.mjs` zakladá koncepty, nezverejňuje (D75, 2026-09-17)

Skript zapisoval `status: "published"` a rovno aktívne úseky — dokument bol po
behu okamžite vo vyhľadávaní a dal sa prideliť. Bola to jediná cesta **okolo**
schvaľovania (ADR-006), hoci D75 hovorí, že oficiálne znenia musia prejsť cezeň.
Zdôvodnenie v hlavičke („kurátorské rozhranie neexistuje") od septembra neplatilo.
Navyše skladal `documentId` zo `sectionKey`, teda identitou spred D80.

Skript je prepísaný a robí to isté ako obrazovka **Nový dokument**:

- volá `uploadDocument()` s `checkMetadata()` vrátane rozšírení číselníkov tenanta
  a s ochranou pred kolíziou kľúča (D80); výsledok je **koncept**, úseky vznikajú
  až pri zverejnení,
- **`--actor` je povinný** a musí to byť nevyradená osoba organizácie z metadát
  s rolou `content-admin` — do auditu ide človek, nie „import.mjs"; do cudzej
  organizácie sa zapísať nedá (D90),
- `--nove-znenie` nahrá koncept nového znenia existujúceho dokumentu a metadáta
  berie zo záznamu, nie zo súboru — ako obrazovka,
- **predvolene nasucho**, zápis s `--zapis` (predtým opačne, `--nasucho`),
- všetko alebo nič: pri jedinom chybnom súbore sa nezapíše nič,
- prijíma každý formát, ktorý vie prevod (Markdown, PDF, …); metadáta sú
  v `<súbor bez prípony>.meta.json`,
- nový príkaz `npm run docs:import`.

Overené nasucho na ostrých dátach: existujúci dokument bez `--nove-znenie`
odmietne, s ním prejde; neznámu osobu a chýbajúce metadáta odmietne menovite.
Zápis (`--zapis`) sa na ostrých dátach neskúšal — vytvoril by koncept; zapisuje
tá istá `uploadDocument()`, ktorú používa obrazovka.

### Tenanti oddelení galvanicky (D90, 2026-09-17)

**Bezpečnostná oprava.** `/api/chat` bežal na predvolenom profile a hľadal
**bez `companyCode`** — filter organizácie bol v `mongoSearch.ts` nepovinný
a route ho nevyplnil. Prihlásená osoba z ktorejkoľvek organizácie teda dostávala
odpovede z interných úsekov všetkých. Dnes je všetok obsah SFZ, takže reálne
išlo o jeden interný úsek viditeľný jedinej osobe LTK; s prvým ďalším zákazníkom
by to bol plný únik.

Pri oprave vyšli najavo ďalšie dve cesty cez hranicu tenanta, obe podľa D32:
`canSeeDocument()` pustil verejný dokument **ktorejkoľvek** organizácie
a `assignableDocuments()` ho ponúkol personalistovi inej organizácie na pridelenie.
Rozhodnutie D90 ich ruší — jediný zdroj viditeľnosti je zhoda `companyCode`.

- **`mongoSearch.ts`:** `companyCode` je povinný (`companyCodes?: string[]` preč).
  `tenantFilter()` bez neho vyhodí `MissingTenantError` aj za behu, lebo skripty
  `.mjs` typovú kontrolu neprejdú. Organizácia je prvá klauzula v oboch filtroch,
  ako rovnosť, nie zoznam; podmienené rozbalenie filtra zmizlo, filter je vždy.
- **`/api/chat`:** organizácia z `onboardingContext()` ešte pred čítaním tela —
  neznáma doména `404` bez tela, neprihlásený `401`, osoba mimo organizácie `403`.
  Profil z `getTenantProfile(companyCode)` (kolekcia `tenant_profiles` je prázdna,
  správanie sa nemení). Vetva „bez tokenu = public" odstránená — middleware
  `/api/chat` bez prihlásenia nepustí, bola to mŕtva cesta.
- **`canSeeDocument()`, `assignableDocuments()`:** len vlastný `companyCode`.
- **`sharedWithCompanyCodes`** odstránené z kódu aj z modelu v dokumentácii;
  nemal ho ani jeden dokument, migrácia netreba.
- **Skripty** `smoke.mjs` a `rerank_compare.mjs` majú `--organizacia` (predvolene
  SFZ, vypíše sa); `rerank_compare` berie otázky z `evaluations` len tej organizácie.
- **Testy:** `tests/visibility.test.ts` otočený (cudzí verejný dokument nevidno),
  nový `tests/searchTenant.test.ts`. Na živých dátach `npm run smoke` nájde pre SFZ
  5 úsekov, s `--organizacia LTK` nula.

Indexy sa nemenili — `companyCode` je filtrovacím poľom v oboch od začiatku.

### Kostry namiesto prázdnej obrazovky (O20, 2026-09-16)

Aplikácia nemala **ani jeden** `loading.tsx` a ani jednu `Suspense` hranicu.
Po kliknutí na odkaz sa teda nestalo nič, kým serverový komponent nedobehol
celý — a na obrazovke `/ask` bola karta odpovede prázdna tri až päť sekúnd,
lebo klasifikácia, prepis dotazu, vyhľadanie aj rerank bežali **pred** otvorením
streamu.

**Čo pribudlo.** Kostra (`components/Skeleton.tsx`) s tvarmi podľa skutočných
tried stránky a `loading.tsx` na všetkých 34 routách. Kostra nie je koliesko:
hovorí, *čo* príde, nie len *že* sa čaká. Tvar sa berie z hotovej stránky,
lebo kostra, po ktorej obsah poskočí, je horšia než prázdne miesto.

**`SkeletonShell`.** `AppShell` si vyžiada každá stránka sama a v `layout.tsx`
zámerne nie je; `loading.tsx` ho teda nahrádza aj s navigáciou. Obrys pásu
odkazov drží tú istú geometriu — vrátane prahu 940 px, kde sa pás mení na
zásuvku — takže obsah neposkočí.

**`/api/chat` posiela fázy.** Práca pred generovaním sa presunula **dovnútra**
streamu a každá fáza sa ohlási udalosťou `phase` (`reading`, `searching`,
`ranking`, `writing`). Sú to skutočné fázy, nie animácia: `ranking` sa
v cloude neposiela vôbec, lebo rerank tam robí agregačná pipeline. Dva
dôsledky, ktoré treba vedieť: hlavičky `X-Search-Mode`, `X-Preprocessed`
a `X-Chunks-Count` nahradila udalosť `meta` (nastaviť sa dajú len pred
vyhľadávaním), a nezhoda vektorového priestoru už nie je HTTP 500, ale
udalosť `error` v streame.

**Prúžok priebehu.** 2 px nad hlavičkou od kliknutia po zmenu adresy. Nikdy
nedôjde na 100 % — koľko z načítania je hotové, nikto nevie, a pruh, ktorý
dobehne a potom stojí, tvrdí, že je hotovo.

Kostry aj prúžok rešpektujú `prefers-reduced-motion`: plocha zostáva, prestane
sa hýbať.

### V zázname o hodnotení už nie je e-mail (O17, 2026-09-16)

Audit dokumentácie našiel v `GDPR_DATA_PROTECTION.md` zásadu „`userId`/`sessionId`
pseudonymizovať" a hneď vedľa kolekciu, ktorá ju nespĺňa. **Päť polí
v `evaluations` — `reviewer`, `readerNoteBy`, `evaluatedBy`,
`curation.preparedBy` a `curation.publishedBy` — držalo e-mailovú adresu
doslovne.** Odteraz drží `persons.id`.

**Prečo tu odkaz stačí, a v potvrdení nie.** `acknowledgements` e-mail držia
zámerne: sú dôkaz o oboznámení so zäväzným predpisom a platí pri nich „kópia,
nie odkaz" (D24) — o rok musia byť čitateľné bez dohľadávania. Záznam
o hodnotení dôkaz nie je, je to meranie kvality. Odkaz preto stačí a má
vlastnosť, ktorú kópia nemá: **keď osobu zmažeme, väzba zmizne s ňou.**

**Externé ID sa sem nezapísuje** — a nemusí. `persons.externalRef` už nesie
`sportnetId`, `entraObjectId` aj `googleSub`, a osoba prihlásená cez cudzí
systém sa zakladá automaticky (D47), takže `personId` má. Dve miesta pre tú istú
identitu by sa raz rozšli. Pri rozhodovaní padla aj poznámka, ktorá stojí za
zapamätanie: **externé ID nie je „menej osobný údaj" než `personId`** — oba sú
pseudonymné identifikátory. Zisk nie je v tvare, ale v tom, že väzba zomrie
s osobou.

**Chýbajúce pole znamená „nikto prihlásený"** — verejný widget. E-mail z tokenu
sa už nezapísuje vôbec.

- **Meno sa dohľadáva, neukladá.** `/library/curation` ukáže meno z `persons`,
  alebo „osoba už nie je v adresári", keď zanikla — jeden dotaz na celý zoznam.
- **Migrácia** `npm run migrate:eval-personid` s náhľadom ako predvolbou.
  Na produkcii: 7 záznamov, 12 polí, 0 nenamapovaných; opakovaný beh už nemá čo
  robiť.
- **Invariant v `npm run check`:** v tých piatich poliach nesmie byť znak `@`.
  Bez neho by sa e-mail vrátil prvým zabudnutým volajúcim a nikto by si to
  nevšimol — je to pole, ktoré sa bežne nečíta.

- **`scripts/delete_test_data.mjs` odstránený** (so súhlasom Jána). Mazal
  hodnotenia s `reviewer: "anonym"` — záznamy z čias pred prihlasovaním.
  V produkcii nebol ani jeden a po O17 sa už žiadny taký nemôže objaviť:
  neprihlásené volanie nezapíše podpis vôbec. Skript, ktorý nikdy nič
  nenájde, je horší než žiadny — vyzerá, že niečo stráži.

Rozhodnutie a plán: **`docs/O17_plan_personid_v_hodnoteniach.md`**.

### Dokumentácia dobehla kód — audit 30 dokumentov (2026-09-16)

„Dokumentácia je indícia, kód a `git log` sú pravda." Po dni, ktorý zrušil
zlatú sadu a postavil kuráciu, sme tú indíciu prvýkrát systémovo zmerali proti
pravde: všetkých 30 dokumentov proti cestám, kolekciám, rolám, názvom súborov
a `npm run` príkazom, ktoré v repozitári naozaj sú. **93 miest nesedelo.**

Nálezy sa delili na tri druhy a každý sa riešil inak:

- **Nepravdivý opis súčasnosti** — opraví sa.
- **Datovaný zápis** („hotové 2026-08-30: … rola `spravca-obsahu`") —
  **neprepísava sa**, dostane poznámku. Prepísať ho by znamenalo tvrdiť, že sa
  vtedy volalo inak, než sa volalo.
- **Plán do budúcna** — v poriadku, pokiaľ už nie je hotový.

Štyri nálezy stoja za mení:

**`PRISTUPOVE_PRAVA.md` malo dieru presne tam, kam patrí.** Kapitola o poľiach
na obsahu mlčala o tom, že v indexe žijú aj úseky, ktoré nepochádzajú
z dokumentu, a že ich `accessLevel` sa **nikdy nezadáva ručne**. Doplnené.

**`INGESTION_zdroje_reconciliation.md` tvrdilo presný opak zásady z D53** —
že prevod PDF a skenov robí model s automatickým ústupom na `llama3.2-vision`.
Prevod beží u nás a model je druhý krok, ktorý vyvolá človek. Kto by podľa
toho dokumentu stavil štvrtý adaptér, porušil by práve to pravidlo, kvôli
ktorému vzniklo.

**`AKO_TO_BEZI.md` menovalo ako jedinú verejnú cestu `/prihlasenie`.** Verejný
je `/sign-in`, `/api/auth`, `/tenants/`, `/api/brand/` a `/api/cron/` —
a práve neúplnosť tohto zoznamu raz spôsobila, že sa cron ticho nevykonával.

**Tri ADR tvrdili „Implementácia: zatiaľ žiadna".** Onboarding, termíny
potvrdenia aj reťaz dôkazov bežia v produkcii. Je to najrýchlejší spôsob, ako
niekoho presvedčiť, že má ešte len postaviť to, čo už stojí.

**Aj hlavičky modulov klamali.** Devätnásť súborov v `lib/` sa v prvom riadku
predstavovalo slovenským menom, ktoré už neexistuje (`konverzia.ts`
v `conversion.ts`, `hodnotenia.ts` v `ratings.ts`). Opravené spolu s odkazmi
medzi modulmi a s tromi osirelými docstringmi v `lib/i18n.ts`.

**Prepisané boli aj štyri stavové dokumenty**, kde sa nemenilo meno veci, ale
obsah kapitoly. `DATA_MODEL_konzistencia.md` sa vyhlasuje za jediný zdroj pravdy
pre názvy polí a predpisoval `access_level` a `chunk_index` — v kóde je
`accessLevel` a `chunkIndex`. `rag-architecture.md` malo tri hotové fázy ako
„plánované" a súbory vo Vercel Blobe (sú v GridFS). Projektový plán menoval
Crawlee, LangChain.js a Vercel Blob — ani jeden v projekte nie je. `DESIGN_GAP.md`
mal zoznam „Chýba" nepravdivý na šiestich miestach.

**GDPR: tri zoznamy pre DPO neobsahovali `auth_users` a `auth_tokens`** —
kolekcie, ktoré držia e-mail a jednorazový prihlasovací token každého
používateľa. V prílohe chýbala aj `persons` (kam D87 pridal mobil a pracovisko)
a uvedená bola neexistujúca `person_memberships`. Retencia „17 kolekcií"
nahradená menovitým zoznamom dvadsiatich jednej.

**Dve zásady sú napísané ako splnené a splnené nie sú** — označené, nie
prepísané, lebo sú to rozhodnutia: `evaluations` ukladá e-maily doslovne
(zásada hovorí pseudonymizovať), a hoci úložisko je v EÚ, vektory a preradení
sa volajú cez Atlas, takže text otázky ide poskytovateľovi modelu. Vedie sa to
ako **O17** a **O18**.

**`NEXTAUTH_URL` bola medzi „nastavenými premennými"**, hoci ten istý dokument
o 110 riadkov vyššie vysvetľuje, že v produkcii existovať **nesmie** — a varuje,
že kto ju uvidí chýbať, „opraví" ju doplnením. Zoznam presne tú chybu vyvolával.
Overené proti Vercelu (len názvy, hodnoty sa nečítali): premenných je
sedemnásť, `NEXTAUTH_URL` medzi nimi nie je — a naopak
`OAUTH_SECRET_ENCRYPTION_KEY` aj `VERCEL_TOKEN` už nastavené sú, takže tri
otvorené položky v TODO sú vybavené.

### Upratovanie po dni — dokumenty dobehli kód (2026-09-15)

`git log` je pravda, dokumentácia indícia — a po dnešnom dni indícia zaostávala
na štyroch miestach. Kurácia beží **bez kolekcie `qa_pairs`**, ale
`OPEN_DECISIONS.md` (D11), `GDPR_DATA_PROTECTION.md` (tabuľky údajov a retencie),
`DATA_MODEL_konzistencia.md` a projektový plán ju stále menovali ako kolekciu,
ktorá ešte len vznikne. D11 má odteraz revíznu poznámku v rovnakom tvare ako
D9: pôvodné rozhodnutia platia ďalej, len sa napĺňajú inde — a helpdesk
(`tickets`, SLA, smerovanie per zväz) z D11 zostáva otvorený.

- **`docs/DEVLOG.md` (nový)** — denník práce. Changelog hovorí, čo sa zmenilo;
  devlog, ako to šlo: rozhodnutia dňa, čo nevyšlo a prečo, čo stálo čas.
  Prvý zápis je dnešný — vrátane zbytočnej kolekcie `answer_reports`,
  86 minút čakania na Vercel kvôli stratenému webhooku a dvoch pascí
  (slovenské úvodzovky v TSX, koniec skupiny v `i18n.ts` bez čiarky).
- **Mŕtve zmienky o zlatej sade v kóde** — `rerank_compare.mjs` už neposiela
  človeka dotláčať vyplnenie `goldChunkIds`, ale porovnávať na hodnoteniach
  z prevádzky (ADR-008); osirelý docstring po skupine `goldenSet` v `i18n.ts`
  odstránený. Tri ďalšie osirelé docstringy tam zostali — sú staršie než
  dnešok a sú **zapísané v TODO**, nie ticho opravené pri inej práci.
- **Historické zmienky `spravca-obsahu`** v TODO dostali poznámku
  `(dnes content-admin)`. Zápis z augusta sa neprepísal — vtedy sa rola tak
  naozaj volala.

### Štítok „overená odpoveď" — a diera, ktorú pri tom našiel (2026-09-15)

Kurovaná odpoveď je krátka a presne formulovaná, takže vo vyhľadávaní často
vyhrá nad článkom normy. Odteraz je v zozname zdrojov **označená** a je pri
nej napísané, čo to znamená: *znenie, ktoré niekto overil nad predpisom — nie
samotné znenie predpisu*. `sourceType` prechádza z indexu cez `buildSources()`
až na obrazovku; dovtedy sa v projekcii vyhľadávania vôbec nevracal.

**Pri tom sa našla skutočná diera v prístupe.** `saveMetadata()` mení
`accessLevel` na všetkých úsekoch dokumentu naraz — **a párov sa to týkalo
tiež**. Pár odvodený z troch predpisov by tak prevzal úroveň jedného z nich:
stačilo prepnúť ten jeden na verejný a zverejnilo by sa aj to, čo v páre
zaznelo z interného. Opačný smer platil rovnako — sprísnenie iného zdroja by
pár nechalo, ako bol.

- Páry sa z hromadnej zmeny **vynímajú** a úroveň sa im počíta znova, zo
  všetkých ich zdrojov, tým istým pravidlom ako pri zverejnení.
- **Zlyhanie sa tu neprehliada.** Pri archivácii párov sa zhovievavosť dá
  obhájiť — nezarchivovaný pár je zastaraný, nie nebezpečný. Tu ide
  o prístup, takže pri chybe sa všetky páry z dokumentu **stiahnu na
  `internal`**. Radšej pár, ktorý nikto nenájde, než pár, ktorý uvidí niekto,
  kto nemá.

**Ranku sme sa nedotkli, a je to rozhodnutie, nie odklad.** Pri nule
zverejnených párov by bolo tlmenie odhad. Spúšťač je zapísaný v TODO: po
prvých desiatich pároch pozrieť, v koľkých odpovediach je pár medzi top 3
zdrojmi.

**Napísané aj to, čo sa s párom deje pri každej ceste zápisu do knižnice** —
nové znenie ho expiruje, zmena metadát mu prepočíta prístup, preindexovanie
a oprava textu ho nechávajú platiť. Je to v hlavičke `lib/curation.ts`, aby
sa to pri štvrtej ceste (RSS, e-mail, ISSF) nemuselo objavovať znova.

### Kurácia — overená odpoveď späť do znalostí (2026-09-15, D11 revidované)

Posledný článok reťaze, ktorá dnes vznikla: bežný človek povie „nesedí",
hodnotiteľ posúdi a napíše, ako to malo znieť, a **z toho znenia sa stane
overená odpoveď v znalostiach**.

**Žiadna kolekcia `qa_pairs`.** D11 ju pomenúvala, ale pravda o páre už je na
zázname v `evaluations`. Úsek v `document_chunks` so `sourceType: "qa"` nie je
druhá pravda, ale premietnutie do indexu — ten istý vzťah, aký má dokument
a jeho úseky. Rozhodnutie Jána Letka; D11 je tým revidovaná.

**Dvaja ľudia, dva kroky.** Hodnotiteľ pripraví znenie a vyberie úseky
predpisu, z ktorých odpoveď vznikla (`/evaluation`). Zverejňuje **správca
obsahu** (`/library/curation`) — a zverejňuje presne to, čo hodnotiteľ
napísal: text sa berie zo záznamu, nie z formulára, takže ho cestou nemôže
zmeniť.

**„Únik cez `accessLevel` nikdy nesmie nastať"** (požiadavka Jána Letka) drží
päť vrstiev, nie jedna kontrola:

- `strictestAccessLevel()` je jediné miesto, kde sa o prístupe rozhoduje.
  `public` vyjde len vtedy, keď je verejný **každý** zdroj. Prázdny zoznam,
  `null` aj neznáma hodnota sú `internal` — nevedieť znamená zavrieť.
- Zdrojové úseky sa načítajú **z databázy**; z klienta prichádzajú len
  identifikátory.
- Chýbajúci alebo cudzí úsek zverejnenie **zastaví**. Žiadne „zvyšok stačí".
- Náhľad úrovne na obrazovke nesľubuje viac než zápis: pri chýbajúcom úseku
  spadne na `internal` rovnako, ako ho zverejnenie odmietne.
- `npm run check` má invariant: pár nesmie byť prístupnejší než jeho zdroje.

Ďalej: **žiadny úsek predpisu sa pri zverejnení nemení ani nearchivuje** — to
je mechanizmus za vetou „nový pár nikdy potichu neprepíše schválený predpis".
Opačný smer platí tiež: nové znenie normy páry z nej odvodené archivuje.

**Znenie otázky je upraviteľné, a je to zámer.** Pôvodná otázka je voľný text
od človeka a môže obsahovať aj to, čo do zdieľaného indexu nepatrí.

**Embedding sa nikde nepočíta** — `$vectorSearch` beží nad textovým poľom
(Atlas Automated Embedding), takže vložením úseku je pár vyhľadateľný.
`buildSources()` po novom nesie `chunkId`; bez neho sa spätne nedá povedať,
z ktorých úsekov odpoveď vznikla. Odpovede spred dneška ho nemajú, takže sa
z nich pár pripraviť nedá — radšej nič než pár, ktorého úroveň je odhad.

### Rola `evaluator` — posudok už nie je vec každého (2026-09-15)

Do dnešného dňa videl hodnotiaci panel pod odpoveďou **každý prihlásený**
a zapisoval priamo do záznamu. V databáze sa preto nedalo rozlíšiť, či
odpoveď posúdil legislatívec alebo niekto, kto na tlačidlo klikol zo
zvedavosti. Rozhodnutie Jána Letka: **bežný človek povie len „sedí /
nesedí" a čo mu vadilo; či mal pravdu, potvrdí alebo opraví hodnotiteľ.**

- **Nová rola `evaluator`.** Identifikátor je anglický, ako `hr`
  a `people-admin`; popis má preklad do sk, cs aj en. Prideľuje sa na
  `/people/{id}` alebo cez `npm run person`. **Nie `reviewer`** — to je na
  zázname pole s iným významom (kto bol prihlásený, keď odpoveď vznikla)
  a dve rôzne veci s jedným menom sa raz zamenia.
- **Panel pod odpoveďou má dva režimy.** „Očakávaná odpoveď" a „správne
  predpisy" sú expertné polia; vyplnené od oka robia hodnotiteľovi viac
  práce, než keď zostanú prázdne. Bývalý riadok „Nahlásiť nepresnosť" je
  odteraz vetvou „Nesedí" — dve voľné textové polia pod jednou odpoveďou
  boli šum.
- **Rolová brána je v API, nie v databázovej funkcii.** Je to rozhodnutie
  o prístupe a to patrí na hranicu systému, kde je známa prihlásená osoba.
  Skladá sa zo session, nikdy z tela požiadavky (D32) — príznak podstrčený
  z prehliadača posudok neuloží.
- **Fronta `/evaluation`** ukazuje **len to, kde niečo nesedí**. Potvrdzovať
  správne odpovede by znamenalo minúť najdrahší čas v celom cykle na
  klikanie „áno, bolo to dobré" — a fronta, do ktorej sa nikto nepozrie, je
  presne to, na čom stroskotala zlatá sada. Prvý posudok nastaví
  `evaluatedAt` a záznam z fronty odchádza.
- **Tri nové polia na zázname** (`readerVerdict`, `evaluatedAt`,
  `evaluatedBy`) a **`companyCode`**, bez ktorého by fronta prekročila
  organizáciu: hodnotiteľ SFZ by videl otázky z SsFZ. Zapisuje sa
  z prihlásenej osoby, nikdy z tela požiadavky. Staršie záznamy ho nemajú,
  takže sa do žiadnej fronty nedostanú — a je to tak správne.
- **Vedľajší nález opravený:** `scripts/person.mjs` poznal len roly `hr`
  a `people-admin` a `spravca-obsahu` odmietal ako neznámu.

Trinásť testov nad `isEvaluator()`, `needsEvaluation()` a bránou kontextu.
**Ďalší krok je kurácia** (D11, `qa_pairs`): potvrdené znenie sa uloží ako
overená odpoveď a embeduje späť do znalostí. Bez hodnotiteľa nebolo čo
kurovať — to je dôvod, prečo ide táto vrstva prvá.

### Zlatá sada zrušená (2026-09-15) — a povedané, čo tým padá

Rozhodnutie Jána Letka: **kvalitu meriame z prevádzky, nie z pripravenej sady.**
Zdôvodnenie a dôsledky sú v `docs/ADR-008-zrusenie-zlatej-sady.md`.

Sada mala 74 otázok, vlastné obrazovky so zoznamom, detailom, prekryvom dvoch
hodnotiteľov aj úpravou znenia otázok. **Za dva mesiace ju neposúdil nikto** —
v databáze bolo štrnásť odpovedí zo sady a nula posudkov. Dôvod nie je záhada:
stojí 4–8 hodín práce doménového experta na človeka a ten čas nikto nemá.

Preč je celá: `/golden-set`, `/api/golden-set`, `lib/goldenSet.ts`,
`GoldenSetQuestion.tsx`, položka v navigácii aj s ikonou, skupina v i18n,
staré cesty `/sada`, materiály v `eval/` (okrem `o1/`, ktoré patrí k O1
z ADR-001) a kolekcia `eval_questions`.

- **`docs/D9_EVAL_zlata_sada.md` sa nemazal.** Je označený ako prekonaný
  a zostáva ako záznam, čo sa malo merať a s akými prahmi. Zmazať ho by
  znamenalo, že o rok nikto nezistí, čo sa zrušilo a prečo. Rovnako sme to
  spravili s D39/D40.
- **Hodnotiaci panel prežil, len sa presťahoval.** Jeho texty boli
  podskupinou `goldenSet.rating` — teraz je to vlastná skupina `rating`.
  Panel pod odpoveďou zostáva, sada bola len jeden z jeho dvoch režimov.
- **Tvrdá brána na únik interného obsahu zostáva v platnosti.** Pri
  odstraňovaní sa ukázalo, že ju `ratings_overview.mjs` **nikdy nerátal zo
  sady**, ale zo zdrojov, ktoré systém pri odpovedi použil — teda z reálnej
  prevádzky. Prah je naďalej nula.
- **`rerank_compare.mjs` berie otázky z `evaluations`** namiesto zo seedu.
  Vecne je to lepšie: rerank sa meria na tom, na čo sa ľudia naozaj pýtajú.

**Čo tým padá, a je to napísané, nie zamlčané:** regresia sa nedá merať (voľné
otázky sú zakaždým iné); 32 otázok na pasce a precedenciu R1–R4 sa netestuje
vôbec, lebo na otázku, kde systém *nemá* odpovedať, sa nikto nespýta sám;
ADR-001 a ADR-002 strácajú meradlo pre voľbu modelu a on-prem verzus cloud;
a `run_eval.py` bola jediná automatická metrika hit@5 a presnosti citácie.
**Čo je odteraz brána pred go-live, nie je rozhodnuté** — zapísané ako otvorený
bod v `OPEN_DECISIONS.md`.

### „Nahlásiť nepresnosť" — a oprava vlastnej chyby v ten istý deň (2026-09-15)

Prvé z piatich „pohodlí" (O6, bod 12) a jediné, ktoré rieši skutočnú dieru:
dovtedy sme vedeli, koľko otázok padlo, ale nie **ktoré odpovede boli mimo**.
Zlatá sada testuje to, na čo sme sa dopredu spýtali; toto zachytáva to, na čo
sme sa nespýtali.

Pod každou dokončenou odpoveďou je zabalený riadok „Nahlásiť nepresnosť".
Neukazuje sa počas streamovania ani pri chybe — tam ešte nie je čo hodnotiť.

- **Popis chyby je povinný.** Palec dole nie je hlásenie: bez vety „čo je zle"
  sa nedá nič opraviť.
- **Hlásenie sa pripisuje k záznamu, ktorý už existuje.** Každá dobehnutá
  odpoveď sa ukladá do `evaluations` — otázka, odpoveď, zdroje aj citácie —
  ešte predtým, než ju niekto posúdi. Z prehliadača preto odchádza len popis
  chyby a identifikátor záznamu; ostatné server dávno má.
- **Vlastné pole, nie `note`.** `note` patrí hodnotiteľovi a ukladá sa pri
  každom opustení poľa. Keby doň písali obaja, neskorší zápis by prepísal
  skorší — a prepísaná by bola práve veta, kvôli ktorej sa niekto namáhal
  niečo napísať.
- **Hlásenie nie je posudok.** Nepodpisuje sa ako `reviewer` a nehýbe časom
  poslednej zmeny: podľa neho sa radí, ktorý posudok tej istej otázky platí.
- **Odpoveď sa po odoslaní nestratí.** Nič sa nepresmeruje; vymení sa len
  obsah bloku za poďakovanie. Kto hlási nepresnosť, má ju stále pred očami.

**Postavené dvakrát a je to tu napísané zámerne.** Prvá verzia mala vlastnú
kolekciu `answer_reports`, ktorá znovu ukladala otázku, odpoveď a zdroje —
teda presne to, čo `evaluations` ukladá pri každej odpovedi. Bola to druhá
kópia tej istej pravdy, práve to, proti čomu je zvyšok systému postavený.
Vzniklo to tak, že sa `lib/ratings.ts` pred stavbou neprečítal. Zahodené
v ten istý deň: kolekcia, jej indexy, mazanie v crone aj tri súbory.

**Zbočná, ale podstatnejšia oprava dokumentácie.** Pri tom sa ukázalo, že
`evaluations` nikdy neboli v GDPR tabuľke ani menovite v retenčnej — pritom
od D9 držia **otázku aj odpoveď doslovne pri každej odpovedi** a e-mail toho,
kto sa pýtal, a **nemažú sa vôbec**. Dopísané do oboch dokumentov a otázka
na DPO je prepísaná na ne, nie na zrušenú kolekciu.

### Zvonček upozornení (2026-09-15) — a dve rozhodnutia, ktoré tým padli

Systém po prvýkrát hovorí, **čo sa stalo, keď sa človek nepozeral**: keď dobehne
preindexovanie, prepis naskenovaného PDF, rozposlanie pripomienok alebo
zverejnenie znenia, pribudne záznam v zvončeku vedľa avatara.

**D39 a D40 sú tým prekonané — a nie obídené.** Koncepcia z 28. 8. kolekciu
`notifications` zámerne nezaložila a stanovila si podmienku: *„vznikne až
vtedy, keď bude existovať prvý skutočný odosielateľ takých správ."* Tá
podmienka je dnes splnená; odosielatelia sú v kóde a bežia. Zapísané je to
v `UDALOSTI_A_UPOZORNENIA_KONCEPCIA.md` ako D89, nie nechané tak, aby dokument
klamal.

- **Zvonček nesie udalosti, nie počty povinností.** „Na potvrdenie 3" hovorí
  štítok v navigácii a je tam, kde sa naň klikne. Druhé miesto s tou istou
  pravdou sa raz rozíde.
- **Oznam ide tomu, kto akciu spustil.** Jediná výnimka je cron
  `/api/cron/overdue`: pripomienky rozposiela sám, iniciátor neexistuje, takže
  oznam ide ľuďom s rolou `hr` — je to ich agenda a dnes o odoslaní nevie nikto
  okrem `reminder_log`.
- **Neukladá sa hotový text, ale druh a parametre.** Opak toho, čo platí pri
  potvrdeniach, a je to zámer: formulka potvrdenia je **dôkaz** a musí zostať
  presne tá, pod ktorú sa človek podpísal; upozornenie dôkaz nie je. Zamrznutý
  text by len znamenal, že kto si prepne jazyk, číta staré oznamy po starom.
  Z rovnakého dôvodu sa neukladá ani odkaz — cesty sa menia a uložená adresa
  zostarne ticho.
- **Zápis upozornenia nikdy nevyhodí výnimku.** Keby zlyhaný zápis zhodil
  preindexovanie, pokazili by sme operáciu preto, že sa nepodarilo povedať, že
  dobehla.
- **Retencia 90 dní**, zhodná s `reminder_log`, lebo je to údaj rovnakej
  povahy — o správaní, nie o plnení povinnosti. Mazanie jazdí v tom istom
  dennom crone; ďalší záznam vo `vercel.json` by bol druhé miesto, ktoré
  treba pri zmene rozvrhu nezabudnúť. Zapísané v GDPR aj v retenčnej tabuľke,
  **právny základ je otázka na DPO** a je v O15/O16.

**Čo nech nie je prekvapenie:** tri zo štyroch udalostí sú dnes synchrónne —
človek na ne čaká a výsledok vidí hneď na obrazovke. Zvonček im dáva
**históriu, nie novinku**; hodnota narastie, keď sa tie operácie presunú na
pozadie. Jediná dnes naozaj nepozorovaná operácia je cronové rozposielanie
pripomienok a práve tá doteraz nemala kde byť vidieť.

Ikona zvončeka je **kreslená ručne** v rukopise tých siedmich v hlavičke
(18×18, `currentColor`, ťah 1,6). Je to vedomá odchýlka od `design/README.md`
podľa rozhodnutia z O6 bodu 1, nie nedopatrenie — a zároveň prvý krok tej
úlohy.

### Nové znenie sa dá prideliť rovnakým publikám ako predošlé (2026-09-14)

Odpoveď na pomlčku, ktorú v knižnici ukázal nový stĺpec „Potvrdenia".
`subject.versionId` pripína pridelenie na konkrétne znenie (D28), takže po
zverejnení novely **nie je na nové znenie pridelený nikto**, kým sa nepridelí
znova. Dovtedy to nebolo z ničoho vidieť.

Na detaile dokumentu je preto karta „Prideliť aj nové znenie" so zoznamom
publík z predošlých znení, zaškrtnutých vopred.

**Viazaná je na stav, nie na okamih zverejnenia**, a to je podstata návrhu:
znenie sa bežne zverejní v septembri s účinnosťou od januára a `assign()`
neúčinné znenie odmietne (D73/D6). Ponuka po publikovaní by teda polovicu
prípadov skončila hláškou „zatiaľ to nejde" — a kto ju vtedy preklikne, už sa
k nej nevráti. Takto sa to dá doriešiť aj o týždeň.

Štyri rozhodnutia Jána Letka:

- **Dôvod je nový a povinný** (D30), s predvyplneným návrhom. Pôvodný („nástup
  do zamestnania") sa novely netýka a prevziať ho doslovne by znamenalo
  zapísať do dôkazného záznamu nepravdu.
- **Termín sa neprenáša** — pôvodný býva v minulosti a hneď by vyrobil
  omeškanie u všetkých.
- **E-maily sa neposielajú.** Jeden klik nemá poslať mail stovke ľudí.
- **Prideľuje personalista**, nie správca obsahu: je to zápis povinnosti
  človeku. Rolu overuje akcia, nie to, že karta bola vidieť.

Pravidlo je čistá funkcia `carryOverFrom()` — bez databázy, šesť testov bez
mocku. Publikum, ktoré nové znenie už má, sa neponúka; pri tom istom publiku
vyhráva najnovšie pridelenie aj jeho dôvod; odvolané pridelenia sa neprenášajú,
lebo odvolanie je rozhodnutie a novela ho neruší.

**Chyba nájdená pred spustením, nie po ňom:** obrazovka počítala ponuku nad
znením `isActive`, akcia by zapisovala nad `effectiveVersion()`. Sú to dve
rôzne pravidlá a keby sa rozišli, zaškrtnuté publikum by sa ticho nepridelilo
a nikto by nevedel prečo.

Overené na produkcii na Skúšobnej smernici: dve staré pridelenia na dvoch
zneniach sa zliali do jedného publika s **najnovším** dôvodom, presne ako má.

### Knižnica: oddelenie správcu, interné číslo, platnosť do a potvrdenia (2026-09-14)

Štyri body O6 naraz — všetky sú o tom, že v zozname noriem chýbali údaje,
podľa ktorých sa v ňom hľadá.

- **Nepovinné „oddelenie, ktoré dokument spravuje"** + filter. Je to
  **vlastníctvo, nie adresáti**: kto má dokument potvrdiť, hovoria naďalej
  `assignments`. Odkaz do stromu oddelení (D49) nemenným `id`, nie voľný
  text — ten by vrátil „Legislatíva", „legislatíva" a „Legislat." ako tri
  oddelenia. Existenciu overuje `checkOwnerDepartment()` v zápise, **pred**
  uložením súboru; `checkMetadata()` zostáva čistá funkcia bez databázy.
- **Nepovinné interné číslo predpisu.** V riadku pod názvom vedľa
  identifikátora, nie vo vlastnom stĺpci, a vo fulltexte — podľa čísla, ktorým
  predpis volá polovica domu, sa musí dať hľadať. **Do formulky potvrdenia
  nevstupuje**: nemá ho každý predpis a diera vo vete, pod ktorú sa človek
  podpisuje, vyzerá ako chyba systému.
- **Stĺpec „Platnosť do".** Nie štvrtá hodnota facetu Stav: stav hovorí, kde je
  dokument v procese, platnosť je iná os. Prázdna hodnota znamená „do
  odvolania", nie chýbajúci údaj — preto pomlčka.
- **Stĺpec „Potvrdenia" s menovateľom pri čísle** („0 %", pod tým „0 z 2
  pridelených"). Percento bez menovateľa si každý vyloží po svojom.

**Číslo, ktoré bolo označené za nedostupné, dostupné je.** Komentár
v `libraryProgress.ts` sám hovoril, že to isté číslo v zozname je samostatná
úloha, lebo by to bol dotaz na každý riadok. `documentsProgress()` má **tri
dotazy, nech je riadkov koľkokoľvek**: pridelenia, osoby (raz, nie raz na každé
publikum) a potvrdenia. Príslušnosť k publiku rozhoduje v pamäti
`matchesAudience()` — **to isté pravidlo**, aké používa `audienceMembers()`.
Počíta sa až po stránkovaní, teda pre najviac 25 viditeľných riadkov.

**Pomlčka nie je nula.** Znenie, ktoré nikomu pridelené nie je, sa do výsledku
vôbec nedostane: „nikomu nepridelené" a „nikto nepotvrdil" sú dve rôzne vety
a stĺpec ich nesmie nakresliť rovnako.

Overené na produkcii pri 420 px: deväť stĺpcov, tabuľka roluje vodorovne
(`min-width` 720 → 880 px), oba údaje sú aj v kartovom pohľade a obe nové polia
sú na detaile dokumentu na celú šírku. Čísla porovnané s databázou, nie
odhadnuté: „0 z 2" sedí s dvomi aktívnymi ľuďmi v Oddelení IT a nulou
potvrdení k tomu zneniu.

### Predvoľba telefónu sa dá nastaviť (2026-09-14)

Dokončenie D86. Normalizácia do E.164 v repozitári už bola, ale predvoľbu
**nebolo kde zadať** — každá organizácia teda ticho používala `+421`, aj česká.
Pribudol zápis v `saveTenant()` (ukladá len tvar `+` a číslice; prázdna hodnota
sa zapíše prázdna, lebo inak by sa raz nastavená predvoľba nedala zrušiť)
a pole v Nastavení organizácie.

### Nácvik dobehol celú cestu (2026-09-14)

Nahratie → prevod → prečistenie členenia → schválenie → zverejnenie → index → vyhľadávanie → pridelenie → potvrdenie. Na skutočnom Disciplinárnom poriadku SFZ.

- **Index: 115 úsekov, 114 s rozpoznaným článkom (99 %).** Breadcrumb nesie úroveň `ČASŤ` (`… › PRVÁ ČASŤ — Všeobecná časť › čl. 1`) — presne tú, ktorú prepis modelom zahadzoval. Dlhé články narezané po odsekoch: `čl. 50 ods. 1`, `čl. 50 ods. 2–6`, `čl. 50 ods. 7–8`.
- **Vyhľadávanie odpovedalo správne** na „Aká je najvyššia pokuta pre právnickú osobu?" — čl. 12 ods. 6, 50 000 eur, a samo odlíšilo poriadkovú pokutu podľa čl. 75. Citácie overené.
- **Znenie sa na obrazovke vykresľuje ako text**: 110 skutočných nadpisov, žiadne `##`, žiadna pätička strany.
- **Dôkazný záznam je úplný:** typ, osoba, čas, označenie znenia, platnosť, cyklus, pôvod, IP, prehliadač, odtlačok formulky a celá cesta oddelení v čase potvrdenia.

Siedmy nález dňa prišiel až tu: **štítok „Na potvrdenie" počítal z trás aj pridelení, obrazovka kreslila len trasy** — kto mal dokument pridelený mimo trasy, nemal ako splniť povinnosť, ktorú mu systém pripomínal číslom. Opravené jedným výpočtom pre obe strany.

### Nácvik nanečisto na ostrom PDF (2026-09-14) — šesť nálezov, ani jeden z čítania kódu

Pred nahratím oficiálnych znení sme prešli celú cestu na skutočnom Disciplinárnom poriadku SFZ (49 strán, 97 článkov): nahratie → prevod → prečistenie členenia → prijatie do konceptu. **Cesta cez rozhranie sa dovtedy nikdy neprešla** — dnešných desať noriem sa nahrávalo skriptom `import.mjs`. To je jediný dôvod, prečo prvý nález mohol tak dlho prežiť.

1. **Prevod PDF v produkcii nefungoval vôbec.** `pdfjs-dist` si za behu doťahuje `pdf.worker.mjs` a ten v serverless zväzku nebol. Oprava mala dve časti a **prvá nestačila** — `serverExternalPackages` chybu len presunul z `.next/server/chunks/` do `node_modules/`; súbor bolo treba priložiť cez `outputFileTracingIncludes`. Keby sa po prvej oprave neoverovalo v produkcii, hlásili by sme „opravené" a nefungovalo by to.
2. **Hláška „Nepodarilo sa to. Skús to znova."** pri chybe, ktorá sa opakovaním nespraví. Zlyhanie knižnice dostalo vlastný kód a vetu, ktorá povie, čo sa stalo.
3. **Prečistenie členenia modelom vracalo polovicu dokumentu.** `max_tokens: 32 000` je strop výstupu a `stop_reason` nikto nečítal. **Včerajší zápis „51 článkov a `PRVÁ ČASŤ` zachovaná" bol chybný záver** — dokument má 97 článkov a štyri časti; 51 bolo prijaté ako úspech len preto, že je to viac než nula. Odteraz sa na useknutej odpovedi padá.
4. **Rozhranie tvrdilo, že text prepísal model, keď nie.** Po prechode na pravidlá zostali štítok „návrh modelu" aj hláška „Model vrátil návrh." Je to tvrdenie o pôvode textu normy — musí sedieť v oboch smeroch.
5. **Po prijatí návrhu sa dal prijatý text ticho prepísať späť.** Editor sa vytvára raz a obrazovka zostala na starom texte; skryté pole formulára ho nieslo tiež, takže „Uložiť text" by prijatý návrh vrátil. Najvážnejší nález dňa — bez chyby, bez varovania.
6. **Pri odvolanom potvrdení stálo „potvrdené" a veta „Potvrdzujem, že…".** Pravdivé v dátach, opačné na obrazovke.

**Poznatok, ktorý stojí za zapamätanie:** šesť z týchto šiestich nálezov našlo **spustenie a klik**, nie čítanie kódu ani testy. Testy pritom prechádzali po celý čas (1 279 → 1 285). Nie sú zlé — kontrolujú to, na čo boli napísané. Ale cesta, ktorou pôjdu ostré dokumenty, sa nedá overiť inak než tým, že sa ňou naozaj prejde.


### Added (2026-09-14 — Návod v osobnom menu)

Systém dovtedy nikde nehovoril, ako sa v ňom pracuje. Návod je na `/guide`, v osobnom menu pod avatarom, a **vidí ho každý prihlásený** — nie len správca obsahu. Kto potvrdzuje záväzný predpis, má právo vedieť, odkiaľ sa tam vzal a čo sa s ním dialo; návod pre obsluhu by to nepovedal.

Štyri časti podľa zadania: **postup od nahratia dokumentu**, **možnosti schvaľovania**, **čo je trasa** (s príkladom štvorkrokovej trasy pri nástupe) a **členenie, index a inteligentné vyhľadávanie**.

- **Text je v `src/content/guide.ts` ako Markdown, nie v `i18n.ts`.** Slovník má 6 800 riadkov krátkych reťazcov pre rozhranie; súvislý text na dve obrazovky by v ňom nikto nenašiel a pri troch jazykoch by ho strojnásobil. V slovníku zostal len obal obrazovky. Vykresľuje ho `FormattedText` — ten istý komponent ako znenie predpisu, takže úprava textu nesiaha do komponentu.
- **Zatiaľ len po slovensky** (rozhodnutie Jána Letka). Česká a anglická obrazovka to povedia nahlas namiesto toho, aby ticho ukázali cudzí jazyk. Poznámka je preložená vo všetkých troch jazykoch, ale ukáže sa len na neslovenskej obrazovke — prázdna hodnota v slovníku vyzerá rovnako ako nedokončený preklad a `tests/i18n.test.ts` ju právom odmieta.
- **`tests/guide.test.ts` porovnáva odkazy v texte so skutočným adresárom `src/app`.** Návod je jediný text v systéme, ktorý hovorí „kliknite sem" — keď sa obrazovka presunie, odkaz stíchne mlčky: nikto nedostane chybu, len prázdnu stránku. Zoznam ciest udržiavaný vedľa toho prvého by sa rozišiel rovnako.
- Overené: `tsc` čisto, **1267 testov**, lint bez chýb.


### Added (2026-09-14 — evidencia osoby: meno a priezvisko zvlášť, tituly, mobil, pracovisko, interný adresár)

Pri osobe sa evidovalo **jedno pole na meno**. Personalista potreboval Meno, Priezvisko, Pozíciu, Oddelenie, Mobil a Pracovisko. Plán a odôvodnenia: `docs/D83_plan_osobne_udaje.md`.

Východisko po prečítaní kódu (nie dokumentácie): `givenName`, `surname` a `jobTitle` v schéme **už boli** (D52), ale prvé dve plnil výhradne Entra adresár a nikde sa nedali zadať; mobil a pracovisko neexistovali vôbec.

- **`fullName` sa skladá, nezadáva sa (D83).** Formulár má Meno a Priezvisko, celé meno dopočíta server. Žiadny existujúci záznam sa nemení — potvrdenia a audit si `fullName` nesú ako kópiu v čase a nevedia, že vznikol inak. Migrácia `npm run migrate:personname` dopĺňa len časti a `fullName` neprepisuje nikdy; čo sa rozdeliť nedá, nechá prázdne a vypíše — uhádnuté priezvisko sa od zadaného nedá odlíšiť.
- **Tituly `titleBefore`/`titleAfter` sú mimo `fullName` (D84).** Titul počas života pribudne; keby bol v mene, ten istý človek by v starých potvrdeniach vystupoval pod iným menom než v nových.
- **Pracovisko je číselník na tenanta (D85)**, nie voľný text — „BA", „Bratislava" a „bratislava" by boli tri pracoviská a filter by nesadol ani na jedno. Využitý existujúci mechanizmus `CUSTOM_CODELISTS`; je to prvý číselník o **ľuďoch**, nie o obsahu, takže `codelistUsage()` vie, nad ktorou kolekciou počítať.
- **Mobil sa ukladá v E.164 (D86)**, predvoľba je `Tenant.phonePrefix` (chýbajúca = `+421`). Zadrôtovaná slovenská predvoľba by českému zákazníkovi ticho vyrobila neplatné čísla. Holé číslice bez nuly aj bez `+` sa odmietnu — krajina sa nehádže.
- **Interný adresár `/directory` (D87)** — vidí ho každý prihlásený vo vlastnej organizácii, nie len personalista. Vyradení, roly, trasy ani skupiny v ňom nie sú. `companyCode` je v podmienke dotazu, nie v kontrole nad ňou (D32), a je to overené testom.
- **`directorySyncedAt` nahrádza `givenName` ako známka doplnenia z adresára (D88).** Bez toho by prvá ručne doplnená osoba prestala z Graphu dostávať čokoľvek — stará otázka „má prázdny `givenName`?" platila len dovtedy, kým ho plnil výhradne Graph.
- **CSV import** pozná nové stĺpce. O tom, či je „Meno" krstné meno alebo celé meno, rozhoduje **prítomnosť stĺpca „Priezvisko"**; bez toho by starý súbor zapísal celé meno ako krstné a organizácia by mala priezviská prázdne. Nové polia sa zapisujú **len keď v riadku sú** — inak by opakovaný import bez tých stĺpcov ticho vymazal mobily celej organizácii. Neznáme pracovisko a nečitateľné číslo **pole nevyplnia a riadok nezahodia**; náhľad ich vypíše, aby import neprešiel „bez chyby" a s prázdnymi poliami.
- **Entra adresár** dopĺňa `mobilePhone` a `officeLocation`/`city` — naďalej len do prázdneho poľa, takže ručná oprava vydrží. Nespárované pracovisko a neprečítateľné číslo sa nedopĺňajú.
- **GDPR:** mobil je nová kategória osobného údaja a jeho sprístupnenie celej organizácii je **zmena okruhu príjemcov** — `docs/GDPR_DATA_PROTECTION.md` kap. 2.1 hovorí, čo z toho ostáva na zákazníka (záznam o spracovateľských činnostiach, informačná povinnosť).
- Overené: `tsc` čisto, lint 0 chýb, **1253 testov** zelených, `next build` prejde. Migrácia zatiaľ spustená **len nasucho**.

### Fixed (2026-09-14 — znenie predpisu sa vykresľuje ako text, nie ako Markdown)

Na obrazovke schvaľovania a v detaile dokumentu sa znenie vypisovalo surové: čitateľ videl `## Článok 1 — Účel` aj s mriežkami a hviezdičky okolo zvýraznení. Je to presne ten text, ktorý má pred potvrdením prečítať — a ktorý svojím potvrdením zaväzuje sám seba.

Príčina nie je chýbajúca knižnica, ale to, že rozklad Markdownu existoval **len pre odpoveď vyhľadávania**. Znenie predpisu ide cez prepis jazykovým modelom, takže je v Markdowne rovnako ako odpoveď — len sa vykresľovalo cez `white-space: pre-wrap`.

- **Nový `FormattedText`** — vykresľovanie z `Answer.tsx` vydelené do komponentu bez `"use client"` a bez stavu, takže ho použije aj serverový komponent (detail dokumentu) aj klientsky (odpoveď). Naďalej nikde žiadne `dangerouslySetInnerHTML`: text sa mení na dátovú štruktúru a React ju vykreslí ako uzly.
- **Odsek normy `(N)` je samostatný blok.** V norme stoja odseky na susedných riadkoch bez prázdneho riadku medzi nimi — bez vlastného pravidla by sa zliali do jedného odstavca a z dvoch povinností by bola jedna veta. Číslo **zostáva v texte**, nerobí sa `<ol>`: odsek `(4a)` aj preskočené číslovanie po novele sú v normách bežné a zoznam by ich prečísloval, takže by citácia ukazovala na iný odsek, než na aký sa odvoláva človek.
- Prepnuté dve obrazovky: `/documents/[documentId]` a `/approvals`. Rozdielový náhľad v knižnici zostáva neproporcionálnym písmom — tam je surový text zámer.
- Tabuľky renderer zatiaľ nepozná. Doplnia sa, až keď bude vidieť, v akom tvare ich prepis vracia na ostrých predpisoch.
- **Konce riadkov `\r\n`.** Uložené znenie prišlo z Wordu a PDF, takže má `\r\n`. Vzory odrážok a číslovaných bodov osamotené `\r` na konci riadku **nerozpoznajú** — `.` v nich nezahŕňa znak konca riadku — a číslovaný zoznam sa zlial do jedného odseku. Nadpisy fungovali, lebo tie sa hľadajú v orezanom riadku, a preto to z kódu nebolo vidieť: odhalila to až obrazovka na telefóne, na skutočnom dokumente.
- Overené: `tsc` čisto, **1251 testov**, lint bez chýb; vykreslenie overené na ostrom dokumente v `intranet.futbalsfz.sk` pri šírke 420 px.


### Fixed (2026-09-14 — prepis cez model bol pokazený a zahadzoval úroveň ČASŤ)

Tri nálezy, všetky zo **skúšobného prepisu skutočného PDF**, nie z čítania kódu.

- **Prepis nefungoval vôbec.** SDK odmieta nestreamované volanie s `max_tokens: 32 000` — *„Streaming is required for operations that may take longer than 10 minutes."* Týkalo sa to oboch ciest: „prečistiť text" aj „prepísať sken". Pravdepodobne od aktualizácie SDK pri prechode na Next 16 (28. 8.). Opravené streamovaním; rozpočet tokenov zostáva, orezať ho by znamenalo prepis ticho zastavený v polovici predpisu.
- **Zadanie pre model bolo priveľmi voľné.** Hovorilo len „obnov členenie" a model si to vyložil po svojom: skrátil `Článok` na `čl.`, dlhé články rozsekal na `ods. 1–6` a `ods. 7–12`, a **úroveň `ČASŤ` zahodil úplne**. Zadanie je teraz pri štruktúrnych úrovniach doslovné a s príkladmi — model, ktorý dostane „obnov členenie", si členenie vymyslí; model, ktorý dostane vzor, ho dodrží.
- **V nadpise Markdownu je pomlčka nepovinná.** Model píše raz `## Článok 1 - Predmet`, inokedy `## Článok 1 Predmet`. Mimo nadpisu sa pomlčka vyžaduje ďalej: bez nej by veta „Článok 5 sa mení takto" vyrobila článok s názvom „sa mení takto".
- Chunker sa naučil aj **časť v tvare nadpisu** (`## PRVÁ ČASŤ - …`) a mriežky sa do breadcrumbu nedostanú — breadcrumb ide do textu chunku, teda do embeddingu.

**Overené na dvoch ostrých PDF:** Volebný poriadok — 10 z 10 nadpisov `## Článok N`, žiadne `čl.`; Disciplinárny poriadok — **51 článkov a `PRVÁ ČASŤ` zachovaná** (predtým 0 výskytov v celom dokumente).

Overené: `tsc` čisto, **1191 testov**, lint bez chýb.


### Fixed (2026-09-14 — chunker sa naučil hlavičky v tvare Markdownu, `CHUNKER_VERSION` 2)

Ranná poistka bránila škode; toto je príčina. Chunker poznal len tvar `Článok 5 - Názov`, kým text v databáze má `## čl. 5 — Názov` — zmerané na korpuse: **547 hlavičiek, 14 rôznych tvarov**, z toho 349× `## čl. N — …` a 126× `## čl. N ods. N–N — …`.

- **Rozšírené vzory, nie nová vetva v parsovaní.** Slučka v `parseStructure()` je odladená na deviatich predpisoch; druhé miesto, kde sa rozhoduje, čo je článok, by sa s prvým rozišlo. Pokryté: `## čl. N`, `## čl. N ods. N–N`, `## čl. Na`, `## Článok N`, `## príloha č. N` — aj pôvodné tvary bez `##`.
- **Rozpoznanie článkov je späť na 92–99 %** (bolo 0 %). Poistka `library.reindexWouldLoseArticles` tým prejde sama, presne ako bola navrhnutá.
- **`ods. N–N` zostáva súčasťou čísla.** Prvá verzia opravy ho zahadzovala — počty úsekov aj podiel rozpoznaných článkov sedeli **dokonale**, a napriek tomu bola horšia: citácia „čl. 2 ods. 1–6" by sa scvrkla na „čl. 2". Odhalilo sa to až porovnaním textu úsekov, nie počtov. Stojí za zapamätanie, že zhodné čísla nie sú dôkaz zhodného výsledku.
- Analyzátor členenia dostal tie isté vzory. **Analyzátor a chunker musia poznať ten istý tvar** — keď sa jeden naučí nový, druhý sa musí naučiť tiež.
- Overené: `tsc` čisto, **1186 testov**, lint bez chýb.

**Preindexovanie napriek tomu ešte nespúšťať** — a to je druhý nález dňa: prepis cez jazykový model **zahodil úroveň `ČASŤ`**. V dnešnom `versions[].markdown` nie je ani raz (Disciplinárny poriadok: 0 výskytov, Stanovy: 0), hoci uložené úseky ju v breadcrumbe majú, lebo vznikli z pôvodného textu. Preindexovaním by sa tá úroveň stratila aj z indexu. Nie je to chyba chunkera — je to strata v publikovanom texte, teda v tom, čo ľudia čítajú a potvrdzujú. Pôvodné PDF sú v GridFS, takže sa to dá opraviť; rozhodnutie je v `docs/TODO.md`, O2.


### Fixed (2026-09-14 — preindexovanie by pokazilo deväť predpisov, poistka)

Záložka Členenie hlásila, že deväť z desiatich dokumentov je narezaných inak, než by vyšlo dnes, a ponúkala tlačidlo „Preindexovať". **To tlačidlo by knižnicu pokazilo.**

Príčina: uložený `versions[].markdown` prešiel prepisom cez jazykový model a hlavičky v ňom nie sú `Článok 5`, ale `## čl. 5 — Názov`. Chunker taký tvar nepozná (D1). Merané na ostrých dátach: `volebny_poriadok` má uložených 12 z 13 úsekov s rozpoznaným článkom a po narezaní by mal **0 z 8**; `disciplinarny_poriadok` 113 zo 114 → **0 z 65**. Citácie by prišli o odkaz na článok a zistilo by sa to až tým, že model prestane citovať presne.

- **Poistka v `reindex()`:** zápis sa odmietne, keď rozpoznanie článkov spadne z väčšiny na menšinu (`library.reindexWouldLoseArticles`). Nie je to prepínač na obídenie — je to tvrdenie, že takto narezaný dokument je horší než ten, čo tam je. Keď sa chunker naučí nový tvar hlavičiek, poistka prejde sama.
- **Skutočná príčina zostáva otvorená** (`docs/TODO.md`, O2): chunker sa musí naučiť hlavičky v tvare Markdownu, a treba rozhodnúť, či ich má prepis cez jazykový model vôbec vyrábať. Sú to dva kroky tej istej linky, ktoré si dnes nerozumejú.

### Added (2026-09-14 — analyzátor členenia a dávková analýza, D79/C1, C3)

- **`chunkingAnalysis.ts`** — čistá funkcia nad textom, bez databázy a bez jazykového modelu. Signály sú spočítateľné riadky; vracia poradie profilov so skóre a vetu, prečo. **Navrhuje, nerozhoduje** (rovnaká zásada ako D58 a D59).
- **Dokument bez členenia sa prizná**, nedostane najlepší zo zlých: prah je **podiel** riadkov, nie počet, a „voľný text" je vždy posledná možnosť v zozname. Tri hlavičky v krátkom predpise sú členenie, tri v trojstovkovom texte nie.
- **`npm run chunking:analyze`** prejde celú knižnicu a povie, kde sa návrh líši od dnes priradeného profilu (`--rozdiely` vypíše len tie). Číta, nemení. Upozorní aj na profily, ktoré návrh potrebuje a organizácia ich nemá — bez nich sa návrh nedá potvrdiť, len prečítať.
- Prvý beh tejto dávky bol práve to, čo odhalilo chybu vyššie.

### Added (2026-09-14 — zálohovacia a retenčná politika)

`docs/ZALOHOVANIE_A_RETENCIA.md` — čo sa zálohuje, ako sa obnovuje a ako dlho sa čo drží, po kolekciách.

- **Pôvodné PDF sú v zálohe tiež** — sú v GridFS v tom istom clusteri, nie v cudzej službe (ADR-002). Tajomstvá v zálohe nie sú a to je správne: obnova databázy preto nie je obnova prevádzky.
- **Dva nálezy, ktoré zápis dovtedy zakrýval:** politika snímok Atlasu nie je overená (vieme, že Cloud Backup je zapnutý, nie akú má politiku — takže **RPO a RTO sú neznáme**), a **skúšobná obnova sa nikdy nerobila**. Záloha, ktorá sa neobnovila, je domnienka.
- **Pri `persons` nestačí jedno číslo:** doklady na ňu ukazujú cez `personId` a majú prežiť odchod. Tri cesty (nechať / anonymizovať / zmazať oboje) sú pomenované, vyberá právnik (O16).
- **Záloha vs. právo na výmaz** má vlastnú kapitolu — zmazané v prevádzkovej databáze zostáva v starších snímkach do ich expirácie a po obnove sa výmaz musí zopakovať.

### Changed (2026-09-14 — dodatok do ADR-007)

Zrušenie voľby `onDateChange` (D82) je zapísané tam, kde to rozhodnutie vzniklo — `docs/ADR-007-oprava-textu-znenia.md`, Dodatok 1 — nielen v CHANGELOGu. Inak by si ho o pol roka niekto prečítal a riadil sa niečím, čo už neplatí.


### Changed (2026-09-13 — čo je vo formulke, sa po prvom potvrdení zamyká, D82)

Potvrdzovacia formulka obsahuje **názov, označenie znenia a dátum platnosti** (D28). Meniť tie údaje pod už podpísanými záznamami znamenalo vyrobiť rozpor medzi tým, čo ľudia podpísali, a tým, čo systém tvrdí. Dialóg pri zmene dátumu (ADR-007) na to ponúkal dve možnosti a **ani jedna nefungovala**: „oprava zápisu" ten rozpor vyrobila, „podstatná zmena" nastavila `versions[].requiresReacknowledgement` — príznak, ktorý **nikto nečíta**, takže nerobila nič.

Rozhodnutia a odôvodnenie: `docs/D82_plan_zamknutie_udajov_znenia.md`.

- **Deliaca čiara nie je „malá vs. veľká zmena", ale „je ten údaj vo vete, ktorú človek podpísal?"** Text znenia vo formulke nie je, takže jeho oprava zostáva ako bola (ADR-007). `label` a `effectiveFrom` v nej sú a po prvom platnom potvrdení sa **zamykajú**.
- **Odomkne ich jedine hromadné odvolanie potvrdení** toho znenia — `revokeVersion()`, dôvod povinný, robí personalista. Potom sa údaj opraví a ľudia potvrdia opravenú formulku. Nie je to slučka nad `revoke()` kvôli pohodliu: kto by odvolával po jednom z výkazu, pri štyridsiatich ľuďoch to nedokončí a znenie zostane v polovičnom stave.
- **Zamknuté polia sa v obrazovke neponúkajú**, nie sú len odmietnuté pri uložení. Formulár, ktorý dá pole vyplniť a potom povie, že sa nedá, je horší než formulár, ktorý ho nemá a rovno povie prečo.
- **Zdroj dátumu je povinný pri publikovaní.** Okno na bezbolestnú opravu je odteraz od publikovania po prvé potvrdenie, teda minúty — obrana sa preto presúva dopredu. Kto musí napísať „uznesenie VV SFZ č. … z …", ten sa doň pozrie. Existujúcich znení sa to netýka.
- **`requiresReacknowledgement` sa prestáva zapisovať.** V type zostáva kvôli starým záznamom a histórii verzií; pole, ktoré sľubuje povinnosť a nevyrába ju, je horšie než žiadne.
- **Prečo nie „nová verzia a znovu schváliť":** `versionId` je odtlačok textu a `publish()` pri rovnakom texte vráti `alreadyDone` — novú verziu s nezmeneným textom vyrobiť nejde. Schvaľovanie sa navyše viaže na text, nie na dátum; dátum sa zadáva až pri publikovaní a schvaľovaním nikdy neprešiel. Kto dátum naozaj podpísal, sú tí, čo potvrdili — preto sa opakuje **potvrdenie**, nie schválenie.
- **D81 (oprava záznamu o potvrdení, typ `correction`) zamietnuté.** Rozpor medzi záznamom a znením už nevznikne, takže netreba mechanizmus na jeho vysvetľovanie.
- Overené: `tsc` čisto, **1168 testov**, lint bez chýb.


### Added (2026-09-13 — porovnanie nového znenia a obsadené kľúče, D80/O3)

- **Nahratie nového znenia rovno povie, či sa text vôbec líši** od platného znenia — jednou vetou, s počtom pridaných a odobraných riadkov. Bez toho sa nedá odlíšiť novela od znovunahratia toho istého PDF, a to je chyba, ktorá sa zistí až vtedy, keď stovka ľudí potvrdí „nové" znenie s nezmeneným textom. Rozdiel po riadkoch je aj naďalej na detaile dokumentu, pred publikovaním.
- **Obrazovka nového dokumentu ukazuje obsadené kľúče** organizácie. Nahratie na obsadený kľúč sa od D80 odmietne — dozvedieť sa to až po vyplnení formulára a nahratí súboru je zbytočne neskoro. Zoznam je serverový: obrazovka nevyžaduje JavaScript kvôli nápovede.
- **`sectionKey` je popísaný ako zaradenie**, nie identita, a pribudli skupiny `zakony`, `zapisnice` a `zmluvy` — korpus, ktorý prichádza. Deväť konkrétnych predpisov medzi položkami (`sutazny_poriadok`…) sa **neodstraňuje**: sú to hodnoty, ktorými sú otagované existujúce dokumenty, a odobrať ich by z nich spravilo neplatné údaje. Nové dokumenty majú dostať skupinu a vlastný `documentKey`.
- Overené: `tsc` čisto, 1162 testov, lint bez chýb.


### Changed (2026-09-13 — členenie sa rozlišuje podľa dokumentu, nie podľa organizácie, D79)

Profil členenia bol **jeden na organizáciu** (D58) a do zápisu sa podával z obrazovky. Kým je knižnica zoznamom deviatich predpisov SFZ, sedí to. Vo chvíli, keď v nej stoja vedľa seba predpisy (`Článok`), zákony (`§`) a manuály bez formálneho členenia, je to garantovane zlé pre časť korpusu — a dávkové preindexovanie by navyše prerezalo **všetky** dokumenty profilom organizácie, aj tie s vlastným.

Plán a rozhodnutia: `docs/D79_plan_clenenie_per_dokument.md`. Toto je etapa 1 — dátový model. Analyzátor, dávková analýza a druhá stratégia chunkovania sú etapa 2, za Fázou 8.

- **Pomenované profily, žiadne výnimky na dokumente.** Dokument nesie **iba kľúč** profilu. Ad-hoc hodnoty na dokumente by znamenali, že o pol roka nikto nevie, prečo sú dva podobné predpisy narezané inak. Keď dokument nesadne ani jednému profilu, vzniká nový pomenovaný profil — odchýlka sa tým zapíše raz, s menom a viditeľne.
- **Profil si rozlišuje zápis sám**, z dokumentu. `publish()`, `reindex()`, `fixText()`, `reindexState()` a `reindexAll()` prestali brať profil ako parameter. Podávaný zvonku bol presne tou cestou, ktorou by hromadné preindexovanie zahodilo ladenie jednotlivých dokumentov.
- **Reťaz je štvorčlánková a každý článok má dôvod:** profil dokumentu → základný profil organizácie → `tenant.chunking` (organizácia spred D79) → `undefined`, teda predvoľby chunkera. Tretí článok tam nie je pre poriadok: bez neho by organizácii bez profilov začali dokumenty rezať predvolenými hodnotami namiesto jej vlastných a prejavilo by sa to až tým, že model odcituje nesprávny článok.
- **Kľúč ani menovka profilu nevstupujú do odtlačku členenia.** Hashuje sa výhradne to, čo vráti `toChunkerProfile()`. Keby sa tam dostali, zmenil by sa `chunkingId` každého dokumentu a celá knižnica by naraz vyzerala ako nepreindexovaná, hoci by sa v texte nezmenilo nič. Je to riziko R1 z plánu a je napísané ako test.
- **Záložka Členenie zapisuje do základného profilu**, nie do `tenant.chunking`. Keby zapisovala tam, obrazovka by od zavedenia profilov nemala žiadny účinok — tichá pasca presne toho druhu, pred ktorým D79 varuje.
- **Migrácia** `npm run migrate:profiles` porovnáva vyriešený profil pred a po a pri prvom rozdiele nezapíše nič. Prebehla na ostrých dátach: 3 organizácie, 10 dokumentov opečiatkovaných.
- **Nový skript** `npm run chunking:status` ukazuje pre každý dokument jeho profil a či uložené `chunkingId` sedí — a to zvlášť podľa profilu aj podľa organizácie, aby sa dalo rozlíšiť, či za prípadný rozdiel môže zavedenie profilov.
- Overené: `tsc` čisto, **1162 testov**, lint bez chýb, `npm run check` po migrácii bez rozporov.

**Nález, ktorý s D79 nesúvisí, ale vyšiel najavo pri jeho overovaní:** deväť z desiatich dokumentov má uložené `chunkingId`, ktoré nesedí s tým, čo by dnešný chunker vyrobil — a nesedelo ani pred zavedením profilov (`npm run chunking:status` to ukazuje v oboch stĺpcoch rovnako). Záložka Členenie teda ponúka „preindexovať 9 dokumentov" už dlhšie. Preindexovanie je bezpečné (`versionId` sa nemení, potvrdenia platia), ale príčinu treba nájsť — vedené v `docs/TODO.md`, sekcia O2.


### Changed (2026-09-13 — nový dokument a nové znenie sú dve rôzne veci, D80)

`documentId` sa skladal z `companyCode:sectionKey`, takže `sectionKey` niesol dve rôzne veci naraz: **kam** dokument patrí a **ktorý** dokument to je. Kým je knižnica zoznamom deviatich predpisov, je to neviditeľné. Dôsledky boli dva a oba nepríjemné: nahratie súboru na existujúci kľúč **ticho prepísalo** koncept, metadáta aj pôvodný súbor existujúceho dokumentu (rozhranie nepovedalo nič a `isNew` z `uploadDocument()` nikto nečítal), a **dva rôzne dokumenty s tým istým zaradením sa nedali mať** — desať zápisníc výkonného výboru by potrebovalo desať zaradení.

Plán a rozhodnutia: `docs/D80_plan_novy_dokument_vs_nove_znenie.md`.

- **`documentKey` oddelený od `sectionKey`.** Identita je `documentKey`, zaradenie je `sectionKey`. `makeDocumentId()` berie kľúč a keď chýba, berie zaradenie — presne pôvodné správanie.
- **Migrácia nezmenila identitu ani jednému dokumentu.** `documentId` je cudzí kľúč v `acknowledgements`, `document_chunks`, `assignments`, `approval_rounds`, `onboarding_tracks` aj v audite; skript to overuje pred zápisom aj po ňom a pri prvom rozdiele nezapíše nič.
- **Kľúč sa odvodzuje z `documentId`, nie zo `sectionKey`** — a to prvý beh nasucho ukázal ako nutné: `sfz:test_onboarding` má `sectionKey: "smernice"`, takže odvodenie zo zaradenia by mu identitu zmenilo na `sfz:smernice`. `documentId` je jediná dnes pravdivá hodnota.
- **Nahrávanie dostalo zámer** (`mode: "new" | "version"`), povinný a bez predvolenej hodnoty. Pri `"new"` a existujúcom kľúči sa zápis **odmietne** — a kontrola beží **pred** uložením súboru, aby po odmietnutí nezostal v úložisku súbor, ku ktorému nevedie záznam.
- **Nové znenie zo súboru má vlastnú cestu** na detaile dokumentu. Metadáta sa preberajú z existujúceho záznamu, formulár ich neposiela: nové znenie mení text, nie pôsobnosť ani prístupnosť. Publikované znenie sa nemení — vzniká koncept a publikuje sa samostatným úkonom cez schvaľovanie (D75).
- **Unikátny index `document_id_unique`** (so súhlasom). Dovtedy jedinečnosť `documentId` držal výhradne filter `upsert`u; odkedy sa kolízia odmieta, je medzi kontrolou a zápisom okno.
- Obrazovka nahrávania má dve polia namiesto jedného: **Zaradenie** a **Kľúč dokumentu** (nepovinný, dopĺňa sa zo zaradenia).
- Overené: `tsc` čisto, **1154 testov**, lint bez chýb, migrácia na ostrých dátach a `npm run check` bez rozporov.

**Zostáva z D80:** porovnanie nového znenia s platným pred uložením (dnes sa text číta až v editore) a upratanie `sectionKey.json` na kategórie. Vedené v `docs/TODO.md`, sekcia O3.


### Added (2026-09-13 — skript na mazanie dokumentov + plán členenia per dokument)

Pred nahratím ostrých znení treba vedieť zmazať skúšobný korpus (D74). Skript na to dovtedy neexistoval — `delete_test_data.mjs` napriek názvu maže iba `evaluations` s `reviewer: "anonym"` a dokumentov sa nedotkne. Mazanie by teda bol ručný zásah do Mongo.

- **`npm run docs:delete`** (`scripts/delete_documents.mjs`) — zmaže dokumenty, archivuje ich úseky a zapíše auditný záznam. **Predvolene beží nasucho**, mazať sa musí vypýtať cez `--naozaj`.
- **Výber je vždy menovitý.** `--id`, `--tag` alebo `--grandfathered`, práve jedno z nich. Režim „zmaž všetko v organizácii" skript nemá — prepínač, ktorý zmaže knižnicu jedným slovom, sa raz použije omylom.
- **Dokument s väzbami hromadný výber nikdy nezmaže.** Ak naň ukazuje potvrdenie, pridelenie, krok onboardingu alebo kolo schvaľovania, preskočí sa a skript vypíše, čo presne naň visí. Zmazať sa dá len menovite cez `--id` spolu s `--aj-s-vazbami`. Dôvod je ADR-005: potvrdenie bez dokumentu je dôkaz bez predmetu.
- **Úseky sa archivujú, nemažú** (`isActive: false` + `effectiveTo`), zhodne s D6. `--useky zmazat` je vedomá výnimka, nie predvoľba.
- Prvý beh nasucho hneď niečo našiel: okrem `sfz:test_onboarding` (6 potvrdení, 2 pridelenia, 1 krok, 3 kolá) má väzbu aj **`sfz:revizny_poriadok` — jedno pridelenie**. Bez poistky by hromadné mazanie po značke vzalo aj ten.

Zároveň vznikol plán **D79 — členenie per dokument** (`docs/D79_plan_clenenie_per_dokument.md`). Jeden profil členenia na organizáciu (D58) nestačí, keď v jednej knižnici stoja predpisy SFZ (`Článok`), zákony (`§`) a manuály bez formálneho členenia. Rozhodnuté: len pomenované profily bez výnimiek na dokumente, analýza navrhuje a nerozhoduje, dátový model pred ostrou prevádzkou a nové obrazovky až po Fáze 8. Naprogramované zatiaľ nie je nič okrem diagnostiky.

- **Diagnostika (krok A1) hotová:** `audit_chunks.mjs` ukazuje, že dnešný korpus problém s členením **nemá** — 9 z 10 dokumentov je rozpoznaných na 92–99 %, jediný nerozobraný je skúšobný jednoodsekový záznam. D79 sa teda pripravuje na prichádzajúci obsah, nerieši dnešnú chybu.
- Overené: **1147 testov**, lint bez chýb, `npm run check` bez rozporov.


### Added (2026-09-13 — text publikovaného znenia sa dá opraviť bez novej verzie)

Predpis je schválený, pridelený a v RAG, ľudia ho potvrdzujú — a príde pripomienka, že v článku 4 chýba čiarka. Dovtedy sa to dalo vyriešiť **jedine novým znením**: `versionId` je odtlačok textu (D57), takže jednoznaková zmena vyrobila novú verziu, novú povinnosť pre všetkých, ktorí už potvrdili, a v histórii záznam, o ktorom o rok nikto nevie, či bol novela alebo preklep. Cena za opravu preklepu bola vyššia než cena za to nechať ho tam.

Rozhodnutia sú v `docs/ADR-007-oprava-textu-znenia.md` (D76–D78).

- **`versionId` sa nemení, `contentHash` áno.** `versionId` je **identita** znenia — visia na ňom potvrdenia, pridelenia, trasy aj chunky. Odtlačok dnešného textu nesie `contentHash`; pole existovalo, pri publikovaní dostávalo tú istú hodnotu a odteraz sa po prvej oprave rozíde. Žiadne nové pole na to nebolo treba.
- **Opravuje správca obsahu** a má štyri podmienky, z ktorých žiadna nie je ozdoba: rola, **povinný dôvod**, **rozdiel vidieť pred uložením** a **snímok celého predchádzajúceho textu** v `versions[].textFixes[]`. „Nemení to význam“ je tvrdenie toho, kto opravuje, a stojí na ňom platnosť cudzích podpisov — tvrdenie, ktoré si nikto nemohol overiť, nie je doklad.
- **Potvrdenia zostávajú platné.** Formulka, ktorú ľudia podpísali, cituje názov, označenie a dátum platnosti (D28), nie text.
- **Preindexovanie je súčasť úkonu, nie ďalšie tlačidlo.** `reindex()` vymení chunky **pri tom istom `versionId`** — presne to, čo zadanie žiadalo. Keby to bol samostatný krok, existoval by stav, v ktorom knižnica ukazuje opravený text a RAG odpovedá zo starého.
- **Opravuje sa len platné znenie.** Archivované je doklad o tom, čo platilo vtedy (D78).
- **Cena, ktorá sa nezakrýva:** schválenie zostáva pri pôvodnom texte, takže brána z D73 sa tu obchádza. Je to vedomé a vyvážené tými štyrmi podmienkami; kto mení význam, publikuje nové znenie a to prejde schvaľovaním celé. Napísané je to v ADR aj priamo v rozhraní nad tlačidlom.
- **Ukladá sa to, čoho rozdiel bol vidieť.** Cez formulár ide odtlačok konceptu, nie celý text; server ho overí a odmietne zápis, ak sa koncept medzitým zmenil pod rukami.
- **Ponuka sa nezobrazí, keď sa text reálne nelíši.** Hláška „koncept sa líši“ porovnáva surové reťazce, kým odtlačok normalizuje konce riadkov (D57); editor vie text preuložiť tak, že reťazce sa líšia a odtlačok nie. Ponúkať v takom stave tlačidlo, ktoré zápis odmietne, je horšie než neponúknuť nič.
- Overené: `tsc` čisto, **1147 testov**, lint bez chýb, `build` prejde.
- **Overené na produkcii** (2026-09-13, skúšobná smernica, znenie 1.2 — oprava `Neni` → `Nie je`):
  `versionId` `79427d4b…` **zostal**, `contentHash` sa zmenil na `9ab573e8…`; `textFixes[0]` nesie kto, kedy, dôvod, odtlačok pred aj po a celý predchádzajúci text (916 znakov); chunky vymenené **pri tom istom `versionId`** (starý archivovaný); potvrdenia bez zmeny; schválenie zostalo pri znení („Schválené · 3 kolá“) — presne tá cena, ktorú ADR-007 pomenúva. Rozdiel `+1 / −1` bol vidieť pred uložením.


### Added (2026-09-12 — potvrdenie sa dá odvolať)

Kto potvrdil omylom, to dovtedy **nevedel vziať späť** — vedel len potvrdiť znova. Kolekcia je zámerne append-only (D24), `supersedes` bolo v type aj v zázname, ale `acknowledge()` doň vždy dalo `null` a druhá cesta neexistovala. V pilote je to prvá vec, ktorá nastane.

- **Odvoláva len personalista** (rozhodnuté 2026-09-12). Doklad, ktorý si podpísaný môže kedykoľvek zobrať späť, nie je doklad; osoba požiada, personalista odvolá a v zázname je vidieť, kto rozhodol. **Dôvod je povinný**, rovnako ako pri zamietnutí znenia (D71).
- **Odvolanie je nový záznam**, nie úprava starého: nesie to isté, čo rušené potvrdenie — meno, dokument, znenie aj doslovnú formulku — plus dôvod a odtlačok toho, kto odvolal. Z histórie tým nezmizne, že potvrdenie raz existovalo.
- **Povinnosť ožije s pôvodným termínom.** Nič sa neprepisuje ani nepresúva; stav sa odvodzuje pri každom čítaní (D27). Ak termín medzitým prešiel, osoba je hneď po termíne — je to pravda, nie chyba, a formulár to hovorí dopredu.
- **Zmena schémy a indexu** (so súhlasom): pole `cycle` (poradie pokusu) a index `acknowledgement_cycle_unique` namiesto `acknowledgement_unique`. Bez neho by po odvolaní druhé potvrdenie toho istého znenia index odmietol. Ochrana proti dvom súbežným kliknutiam zostáva: obe vypočítajú to isté číslo. Migrácia `scripts/migrate_ack_cycle.mjs` najprv dopíše pole, overí duplicity, **vytvorí nový index a až potom zahodí starý** — aby nevzniklo okno bez ochrany.
- **Jedno miesto na čítanie.** `validAcknowledgements()` (potvrdenia mínus odvolania) nahradilo sedem samostatných dotazov v `assignments`, `hrReport`, `libraryProgress`, `libraryWrite`, `admin` a v skripte výkazu. Každé z nich by inak muselo samo vedieť, že odvolanie existuje — a stačilo by, aby na to jedno zabudlo.
- **Čas čítania a prvé otvorenie sa odvolaním nemenia.** Sú to merania, nie doklad: človek ten text naozaj otvoril.
- Overené: `tsc` čisto, **1132 testov**, lint bez chýb, `build` prejde.


### Added (2026-09-12 — neschválené znenie sa už nedá zverejniť)

Brána z D73 sa posúva o krok skôr. Dovtedy stála len pri prideľovaní: neschválené znenie sa **zverejniť dalo**, objavilo sa v knižnici a RAG z neho odpovedal — len sa nedalo prideliť na potvrdenie. Kto si predpis nájde sám, číta ho bez ohľadu na to, či ho niekto schválil.

- **`publishBlock({ state })`** — pravidlo ako čistá funkcia vedľa `assignBlock()`, testovateľná bez Monga. Dva kódy, nie jeden: „ešte si nepredložil" a „už to beží" vedú človeka k inému ďalšiemu kroku.
- **Brána vnútri `publish()`, nie v serverovej akcii.** Akcií môže raz pribudnúť viac a brána, ktorú sa dá obísť iným vstupom, nie je brána.
- **Až za kontrolou idempotencie.** Opätovné zverejnenie rovnakého textu sa naďalej ticho nič-nedeje — inak by sa dnešný korpus spred zavedenia schvaľovania (D74) prestal dať publikovať.
- **Schvaľuje sa koncept, nie hotové znenie.** `versionId` vzniká až vnútri `publish()` ako odtlačok textu (D57), takže pred publikovaním znenie neexistuje. Kolo sa vedie na odtlačku `draftMarkdown` a znenie, ktoré z neho vznikne, má ten istý `versionId`.
- **Dôsledok, ktorý rozhranie hovorí nahlas:** po schválení sa text už nesmie meniť — každá úprava zmení odtlačok a schválenie prestane platiť (D28, D72).
- **Panel nad formulárom, nie chybová hláška po odoslaní.** Kto vypĺňa označenie a dátum platnosti, vidí vopred, že bez schválenia to neprejde. Formulár, ktorý sa dá celý vyplniť a až potom odmietne, je stratený čas a vyzerá ako porucha.
- Overené: `tsc` čisto, **1121 testov**, lint bez chýb, `build` prejde.


### Fixed (2026-09-12 — odkaz „Kto nepotvrdil→" viedol inam a videl ho aj ten, kto tam nesmie)

Našlo sa to pri overovaní bodu 6 mapy. Zápis tvrdil, že odkaz **chýba**; v skutočnosti bol na mieste a robil dve veci zle.

- **Viedol na ,** teda na celý výkaz, nie na to, čo štítok sľubuje. Teraz mieri na  — na zoznam pre **toto znenie**.
- **Ukazoval sa každému, kto smie do knižnice** — vrátane správcu obsahu, ktorý do  nesmie (D67). Odkaz, ktorý skončí na 404, je horší než žiadny: prezradí, že v systéme niečo je, a zároveň nepustí. Teraz ho vidí len personalista.
- Pri prezeraní sa overili aj ostatné odkazy na rolou chránené sekcie. Druhý taký odkaz ( → ) je v poriadku: obe strany chráni tá istá rola.
- Overené:  čisto, 1117 testov, lint bez chýb,  prejde.


### Added (2026-09-12 — knižnica: stĺpec „Platnosť od" a Export CSV)

Časť bodu 5 z `docs/DESIGN_GAP.md`. **Zvyšok toho bodu bol už dávno hotový a mapa to nevedela** — stĺpec s verziou aj identifikátor pod názvom v tabuľke sú; prerátané proti kódu, nie proti zápisu.

- **Stĺpec „Platnosť od".** Dovtedy bolo v zozname vidieť, *ktoré* znenie platí, ale nie *odkedy* — a práve to je údaj, kvôli ktorému sa do knižnice chodí. `nowrap` a `tabular-nums`, aby dátumy stáli pod sebou.
- **Pomlčka, nie prázdna bunka,** keď dokument nemá platné znenie. Prázdne miesto vyzerá ako chýbajúci údaj; dokument bez platného znenia je legitímny stav (koncept, znenie s budúcou účinnosťou), nie porucha.
- **`effectiveFrom` je `Date`, nie text.** Vedľa `validityLabel()` pribudla `validityFrom()`: jedna vracia text pre človeka, druhá dátum pre stroj. Keby to bola jedna hodnota, do exportu by sa dostal dátum už naformátovaný podľa jazyka — a taký sa nedá zoradiť.
- **`/library/csv` — export zoznamu.** Ide cez **tú istú cestu** ako obrazovka (`readFilters()` → `libraryList()` → `sortRows()`), takže výkaz sa nemôže rozísť s tým, čo človek vidí. Odkaz nesie aktuálne filtre: kto si vyfiltruje osem dokumentov, dostane osem.
- **Bez stránkovania, zámerne.** Na obrazovke je strana, v exporte celý vyfiltrovaný výsledok.
- **Prístup sa overuje aj v route.** To, že odkaz visí na chránenej stránke, nie je kontrola prístupu — adresu si vie napísať ktokoľvek.
- Dátumy v CSV sú **ISO**, nie miestny tvar: „12. 9. 2026" sa v tabuľkovom procesore zoradí ako text.
- Overené: `tsc` čisto, **1117 testov**, lint bez chýb, `build` prejde; na produkcii sa export zhoduje s obrazovkou pri troch filtroch (bez filtra 10 = 10, `search=smernica` 1 = 1, `status=draft` 0 = 0). Tabuľka pri 390 px nerozbíja stránku — posúva sa vo vlastnom ráme, ako doteraz.


### Added (2026-09-12 — navigácia hovorí, koľko čaká, a na telefóne je zásuvkou)

Bod 2 z `docs/DESIGN_GAP.md`.

- **Štítok s počtom pri „Na potvrdenie" a „Na schválenie".** Počty idú z `pendingForPerson()` a `roundsWaitingFor()` — z tých istých funkcií, ktoré kreslia obrazovky, na ktoré položky odkazujú. Číslo, ktoré po kliknutí nesedí s tým, čo tam človek uvidí, je horšie než žiadne.
- **Nula sa nekreslí.** Štítok s nulou nie je informácia, je to šum; kto nemá čo potvrdzovať, dozvie sa to tým, že tam nič nesvieti. V dátach sa `0` a „nepočítalo sa" rozlišujú ďalej — zliať ich by znamenalo, že sa prázdny stav už nikdy neodlíši od pokazeného.
- **Zásuvka namiesto rolovacieho pásu pod 940 px.** Deväť položiek bolo na telefóne dlhších než výrez a pás to nepriznával — posledná položka bola odseknutá v polovici slova. Prah je meraný, nie okrúhly: položky zaberajú ~855 px, s odsadením shellu potrebuje pás ~930 px.
- **Zásuvka je `<details>`/`<summary>`,** takže funguje bez JavaScriptu, a jej prepínač má 44 px na výšku (krok 7 handoffu). Na prepínači stojí súčet — pri zavretej zásuvke by človek inak nevedel, že naňho niečo čaká.
- **Pás aj zásuvka sú v DOM naraz** a prepína ich `@media`. Obsah `<details>` skrýva prehliadač sám a CSS ho nevie odkryť späť, takže jedna forma prepínaná štýlom nestačí. Čo je `display: none`, nie je ani v strome prístupnosti — čítačka vidí vždy len jednu navigáciu.
- **`cache()` na reláciu, hostiteľa, tenanta a osobu** (`lib/session.ts`). Shell si zisťuje tri roly a každá z nich potrebovala tenanta aj osobu; s obrazovkou pod ním to bolo šesť tých istých dotazov na jedno načítanie. Zámerne nie na `findPerson()` — tú volajú aj serverové akcie po zápise a pamäť by im vracala stav spred neho. Bez tejto zmeny by počty znamenali ďalšie dotazy navyše; s ňou ich je menej než predtým.
- **Zvonček upozornení sa nerobil** (rozhodnutie Jána Letka): systém zatiaľ nemá čo oznamovať, bodka by sa rozsvietila z toho istého čísla ako štítok a klik by viedol na Prehľad, ktorý je prvá položka navigácie. Tri cesty k jednému číslu. Zvonček sa postaví, keď bude mať obsah (`UDALOSTI_A_UPOZORNENIA_KONCEPCIA.md`).
- Overené: `tsc` čisto, **1117 testov**, lint bez chýb, `build` prejde; na produkcii pri 320 / 390 / 900 / 1000 / 1440 px. Pod prahom je zásuvka a pás je preč, nad prahom naopak a pás sa zmestí bez posunu (`scrollWidth` = `clientWidth` = 1000). Riadok aj prepínač majú 44 px. Štítok v navigácii ukazuje to isté číslo ako dlaždica Prehľadu.


### Changed (2026-09-11 — Prehľad je domov, otázky sa presťahovali na `/ask`)

Rozhodnutie, ktoré včerajší zápis nechával otvorené: **prvá obrazovka po kliknutí na prihlasovací odkaz je Prehľad.**

- **`/` je Prehľad.** Tak to má návrh (`docs/design/README.md`, časť 2) a tak to dáva zmysel: domov má byť to, čo od človeka niekto chce, nie ukážka toho, čo systém vie.
- **Obrazovka otázok je na `/ask`.** Po anglicky, ako ostatné routy (`/documents`, `/approvals`, `/library`); zároveň tým zmizla jediná slovenská routa. Hľadanie zostáva v hlavičke na celom portáli, takže sa naň nemusí chodiť.
- **`/prehlad` zostáva ako trvalé presmerovanie na `/`.** Odkaz, ktorý si niekto uložil za posledný deň, nemá spadnúť na 404 — a kto ho otvorí, má skončiť pri obsahu, nie pri vysvetlení.
- **`/?q=…` prenesie otázku na `/ask?q=…`.** Kým Prehľad žil inde, odpovedalo sa na domovskej adrese; taký odkaz môže byť v záložke alebo v poslanom e-maile a otázka sa z neho nesmie stratiť.
- Overené: `tsc` čisto, **1113 testov**, lint bez chýb, `build` prejde.

### Changed (2026-09-11 — zapísané, kto smie commitovať priamo do `main`)

- `CLAUDE.md`: Ján Letko priamo, ktokoľvek iný cez pull request. Nie je to o dôvere, ale o zodpovednosti za to, čo sa nasadí — `main` je to, čo o pár minút beží na `intranet.futbalsfz.sk`. `force push`, rebase zdieľanej vetvy a mazanie vetvy zostávajú bez výnimky na výslovný súhlas.


### Added (2026-09-10 — Prehľad má obrazovku)

Časť 2 návrhu (`docs/design/README.md`). Prvá obrazovka, ktorá neodpovedá na otázku, ale hovorí, čo od človeka niekto chce.

- **`/prehlad`** — hero s otázkou (obyčajný `GET` na `/`, teda funguje bez JavaScriptu), KPI pás štyroch dlaždíc a dva panely: „Vyžaduje vašu pozornosť“ a „Novinky v knižnici“.
- **Žiadna dlaždica si svoje číslo nepočíta po svojom.** Povinnosti sú z `pendingForPerson()`, kolá z `roundsWaitingFor()` — z tých istých funkcií, ktoré kreslia obrazovky, na ktoré dlaždice odkazujú. Dva pohľady, ktoré si to isté počítajú každý po svojom, si raz budú odporovať, a rozdiel uvidí človek skôr než my.
- **Každá dlaždica je odkaz na predfiltrovaný zoznam.** Číslo bez cesty k nemu je ozdoba.
- **„Nové“ počíta `publishedAt` znenia, nie `updatedAt` dokumentu.** Oprava preklepu v názve nie je novinka v knižnici.
- **„Expiruje“ berie len účinné znenia s `effectiveTo` v okne 30 dní dopredu.** Čo už vypršalo, neexpiruje — to je iný stav a patrí inam.
- **„Čaká na schválenie“ počíta to, čo čaká na *mňa*,** nie na celú organizáciu (návrh píše „moje“ a odkazuje na `/approvals`). Číslo, ktoré po kliknutí nesedí s tým, čo vidím, je horšie než žiadne.
- **Podtitul „2 súrne“ je z termínov, nie z počtu dní od pridelenia** (D61): prah pripomienok nie je termín daný človeku.
- Farba nie je jediným nosičom stavu — pod každým zvýrazneným číslom stojí veta, ktorá to isté povie slovami.
- Overené: `tsc` čisto, **1113 testov**, lint bez chýb, `build` prejde; na produkcii pri 390 px bez vodorovného posunu (`scrollWidth` = `innerWidth` = 390), dlaždice v dvoch stĺpcoch a panely pod sebou.

**Adresa bola otvorená otázka a 2026-09-11 sa rozhodla:** Prehľad je `/`, otázky sú na `/ask`. Zápis vyššie.


### Added (2026-09-10 — reťaz dôkazov aj na karte osoby)

Krok 4 z ADR-005. Tým je ADR-005 hotové okrem jednej vedome otvorenej veci.

- **Ten istý komponent nad tou istou funkciou** ako `/hr/evidence` (D67). Karta osoby nepočíta nič vlastné — dva pohľady, ktoré si to isté počítajú každý po svojom, si raz budú odporovať.
- **Podmienené rolou `hr`, nie `people-admin`.** Kartu osoby spravuje `people-admin`, ale reťaz dôkazov je údaj o tom, ako si človek plní povinnosti. Kto smie meniť meno a oddelenie, nemá tým automaticky vidieť, čo kto otvoril a nepotvrdil. Väčšinou je to ten istý človek; keď nie je, rozhoduje rola, nie zvyk.
- **Os je posledná, pod správou osoby.** Keby stála hore, karta by prestala byť obrazovkou na úpravu údajov a stala by sa výkazom.

### Changed (2026-09-10 — upratovanie: zápisy proti kódu)

- **O14 v `OPEN_DECISIONS.md`** už neznie, akoby sa nič nerozhodlo. Čas nad znením sa meria a je výslovne informatívny, prvé otvorenie sa zaznamenáva ako serverový fakt (D64) a oboje je v GDPR dokumentácii. Otvorené zostáva **„otvoril a nepotvrdil"** ako údaj o človeku a doskrolovanie na koniec, ktoré sa nemeria vôbec.
- **`docs/TODO.md`** — odškrtnutá časová os na karte osoby aj s tým, ako sa vyriešila rola.
- V kóde zostali **tri** poznámky typu TODO a všetky tri odkazujú na zápis v `docs/TODO.md`, ktorý stále platí. Žiadna nie je zabudnutý kus práce.

### Added (2026-09-10 — reťaz dôkazov má obrazovku)

Kroky 3 a 5 z ADR-005.

- **`/hr/evidence`** — časová os každej povinnosti s filtrom cez osobu a stav, a s exportom CSV. Filtre sú **v adrese**, takže sa pohľad dá poslať kolegovi aj s filtrom a funguje bez JavaScriptu.
- **Jeden komponent nad jednou funkciou** (D67). Karta osoby, ktorá pribudne, bude kresliť ten istý `EvidenceTimeline` nad tým istým `evidenceRows()`. Dva pohľady, ktoré si to isté počítajú každý po svojom, si raz budú odporovať — a pri dôkaze je to horšie než nemať druhý.
- **Váha riadku je pri riadku, nie v legende.** Kto číta jeden riadok, musí z neho vedieť, čo unesie; legenda o dva odseky nižšie sa pri citovaní stratí. Chýbajúci riadok má namiesto dátumu vetu, **prečo** chýba, a prázdny krúžok namiesto plnej bodky — farba nie je jediným nositeľom stavu.
- **V CSV je čas čítania označený ako informatívny priamo v názve stĺpca** (`readingSeconds_informative`), nie v poznámke pod tabuľkou. Kto si export otvorí v Exceli, poznámku nevidí — a práve tam sa z merania najľahšie stane „dôkaz".
- **Export používa ten istý zoznam a tie isté filtre ako obrazovka.** Výkaz, ktorý sa nezhoduje s obrazovkou, je horší než žiadny.
- **Prístup má personalista, nie správca obsahu** (D67, D32): je to údaj o ľuďoch, nie o dokumentoch.
- **Chýbajúci riadok o upozorneniach je pomenovaný na obrazovke**, nie zamlčaný. `reminder_log` je prevádzkový a po 90 dňoch sa maže; `assignments.notified[]` hovorí „ozvalo sa N ľuďom", nie ktorým. Ani jedno neunesie vetu „ozvalo sa **jej**" — a vymyslieť ju z toho, čo máme, je presne to, čomu sa ADR-005 vyhýba.
- Overené: `tsc` čisto, 1104 testov, lint bez chýb, build prejde.

**Zostáva z ADR-005:** časová os na karte osoby a trvalý per-person záznam o upozorneniach.

### Added (2026-09-10 — prvé otvorenie znenia sa zaznamenáva, reťaz dôkazov má základ)

Kroky 6, 1 a 2 z ADR-005 — **v tomto poradí**. GDPR dokumentácia išla prvá.

- **`document_opens` je fakt so serverovým časom, nie telemetria.** Zapisuje **server**, nie klient (beacon sa dá zablokovať a stratiť); zapíše sa **raz a nikdy sa neprepíše** (`$setOnInsert` na všetky polia, takže druhé otvorenie nezmení ani čas); a zapisuje sa **len tomu, kto povinnosť má** — personalista, ktorý si znenie otvorí na kontrolu, sa nezaznamená.
- **Volá sa to „otvoril", nie „prečítal".** Server vie, že obsah odoslal. Že ho človek čítal, nevie a tvrdiť to nebude.
- **Bez TTL, na rozdiel od času čítania.** Otvorenie je súčasťou reťaze a má žiť ako potvrdenie; otvorenie **bez** potvrdenia je tiež údaj — hovorí, že človek vedel a nepotvrdil.
- **`lib/evidence.ts` skladá os a nič neukladá** (D65). Potvrdenie zostáva samonosné (D24).
- **Pri každom riadku je vidieť jeho váhu:** `proof` pre pridelenie, otvorenie a potvrdenie; `informative` pre čas čítania, ktorý o sebe v `readingTime.ts` hovorí, že dôkaz nie je.
- **Chýbajúci riadok sa pomenuje, nevynechá** — a rozlišuje **tri dôvody**: „vtedy sa to ešte nezaznamenávalo", „meranie sa po roku zmazalo" a „nestalo sa to". Zameniť prvé za tretie by znamenalo obviniť človeka z niečoho, čo sa nedá zistiť.
- **Hranica `OPENS_RECORDED_SINCE` je konštanta, nie dopočet z dát.** „Najstaršie otvorenie v databáze" by sa menilo podľa toho, čo sa práve zmazalo, a os by po prvom výmaze začala tvrdiť niečo iné než včera.
- **Upozornenia sú jeden riadok s počtom**, nie zoznam: „ozvalo sa jej trikrát, naposledy 20. 9." Tri riadky by z osi spravili log.
- Overené: `tsc` čisto, **1104 testov** (12 nových), lint bez chýb, build prejde.

**Zostáva z ADR-005:** komponent časovej osi, karta osoby a obrazovka `/hr/evidence` s filtrami a exportom. Kolekcia `document_opens` v Atlase ešte vytvorená nie je.

### Fixed (2026-09-10 — naplánovaný beh sa nikdy nevykonal)

Nájdené pri overovaní odosielania pripomienok, nie hlásené.

- **`/api/cron/overdue` bola za bránou prihlásenia.** Vercel volá cron obyčajným HTTP dotazom s hlavičkou `Authorization: Bearer <CRON_SECRET>` a nemá — ani nemôže mať — sedenie prihláseného človeka. Middleware ho preto odmietol **skôr, než sa route vôbec spustila**, a vrátil `401 not-signed-in`.
- **Bolo to takto od zavedenia crona (2026-08-29).** Týždenný prehľad pre personalistu teda nikdy neodišiel. Nebolo to vidieť nikde: Vercel neúspešný beh ticho zahodí a v aplikácii po ňom nezostane stopa.
- **Nie je to diera, je to iná brána.** Route si autorizáciu robí sama a bez tajomstva vracia 401 — vrátane prípadu, keď premenná nie je nastavená vôbec. Prepustiť cestu cez middleware neznamená otvoriť ju; znamená to nechať rozhodnúť tú bránu, ktorá vie, o čo ide.
- **Zoznam verejných ciest sa presunul do `lib/publicRoutes.ts` a dostal testy.** V `middleware.ts` sa otestovať nedal — modul ťahá `next-auth/jwt` a beží v edge prostredí. Presne preto sa chyba dala urobiť ticho. Test stráži aj opačný smer: že obsah noriem cez bránu neprejde.
- Overené: `tsc` čisto, **1092 testov** (6 nových), lint bez chýb, build prejde.

### Added (2026-09-10 — pripomienky termínu sa naozaj odosielajú)

Druhá polovica kroku 4 z ADR-004. **Mení produkčné nastavenie a mení zvyk:** doteraz systém e-maily ľuďom neposielal nikdy, len personalistovi.

- **Kadencia overená na skutočných dátach, nie na skúšobných.** Pred zapnutím sa výpočet spustil k dvanástim dňom dopredu a prešiel deň po dni: D-5 až D-0 každý deň (šesť správ), potom D+1, D+3, D+7 a odvtedy raz týždenne spolu s personalistom. **Jedenásť správ za mesiac, nie tridsať** — presne eskalácia, na ktorej sme sa dohodli.
- **Jedna správa na človeka a deň, nikdy dve.** Právo ozvať sa sa zaberá v novej kolekcii `reminder_log` **pred odoslaním**. Opačné poradie znie lákavo (nezapíš, čo neodišlo), ale pri páde medzi odoslaním a zápisom by človek dostal to isté dvakrát. Takto v najhoršom prípade jedna správa v jeden deň nepríde a príde nasledujúci — dvakrát poslaná pripomienka je horšia než raz vynechaná. Jedinečnosť stráži index, nie kontrola pred zápisom: dva behy naraz by sa v kontrole minuli.
- **Retencia `reminder_log` je 90 dní.** Je to prevádzkový záznam o odoslaní, nie dôkaz — dôkazom je `notified[]` na pridelení a potvrdenie samo.
- **Dva tóny jednej šablóny.** Text hovorí **stav**, nie len fakt: „termín je 20. 9., zostávajú 3 dni" verzus „termín bol 20. 9., ste po ňom 3 dni". V **deň termínu** sa o meškaní nehovorí — kto potvrdí v ten deň, termín splnil. Tvary čísloviek sú v `i18n`, nie v šablóne.
- **Eskalácia od D+7 aj personalistovi**, ale **raz za týždeň**, hoci beh je denný. Po termíne už problém nie je v tom, že človek zabudol; tam je organizačný.
- **Týždenný prehľad podľa prahu 14 dní zostáva** a nie je to duplicita: týka sa pridelení **bez termínu**, ktoré termínová kadencia nevidí vôbec. Zostáva **týždenný**, hoci beh je odteraz denný — denný e-mail o tom istom zozname je do troch dní pošta, ktorú personalista prestane otvárať. Právo ozvať sa si preto zaberá na týždeň, tou istou cestou ako pripomienky.
- **`vercel.json`: `0 6 * * 1` → `0 6 * * *`.** Denná kadencia potrebuje denný beh; týždenný by z nej minul takmer všetko.
- Overené: `tsc` čisto, **1086 testov** (13 nových), lint bez chýb, build prejde.

### Added (2026-09-10 — prideliť sa dá len schválené znenie)

Krok 2 z ADR-006, zámerne až posledný. Tým je ADR-006 hotové.

- **Brána pri prideľovaní** (D73) má **dve nezávislé podmienky a dve rôzne hlásenia**: schválené znamená „ľudia sa zhodli, že text je správny", účinné znamená „odkedy zaväzuje" (D6). Znenie sa dá schváliť v septembri s účinnosťou od januára — aj mať dátum bez toho, aby ho ktokoľvek videl. Personalista musí vedieť, ktorá z nich mu chýba, inak hľadá naslepo.
- **Pravidlo je v `approvals.ts` a je bez databázy**; `assign()` si preň len načíta stav. Stav sa nikam neukladá (D27) — uložený by sa raz rozišiel s kolami, z ktorých vznikol, a rozišiel by sa presne vtedy, keď na tom záleží.
- **Znenia zverejnené pred zavedením schvaľovania prechádzajú** (D74), takže sa zo dňa na deň neprestalo dať prideliť nič, čo je dnes v knižnici.
- **Poradie bolo záväzné:** brána ide až po predložení, rozhodovaní a upozorneniach. Opačné poradie by znamenalo, že sa nové znenie dá nahrať, ale nie schváliť — a teda ani prideliť.

### Added (2026-09-10 — facet Stav dostal „na schválenie")

- **Tretia hodnota, ale nie tretia priehradka.** Koncept a publikované sú rozdelenie knižnice — buď alebo. „Na schválenie" je **iná os**: dokument môže byť publikovaný a zároveň mať bežiace kolo nad novým znením. Preto sa k rozdeleniu pridáva cez `$or`, nie doňho. Zaškrtnúť koncept aj publikované zostáva „všetko" a filter vtedy nevzniká.
- **Dva dotazy namiesto spojenia kolekcií.** Stav je odvodený z `approval_rounds`; zoznam `documentId` z bežiacich kôl ide do `$in`. Kolá sú jednotky až desiatky, takže je to lacnejšie než agregácia naprieč kolekciami pri každom otvorení knižnice — a hlavne sa to dá prečítať.
- **Zoznam kôl sa načíta len vtedy, keď sa naň filtruje.** Bez toho by každé otvorenie knižnice platilo dotaz navyše za filter, ktorý nikto nezapol.
- **Nula sa neukazuje.** Prázdny riadok filtra len zaberá miesto a tvrdí, že sa dá na niečo prepnúť.
- Overené: `tsc` čisto, **1077 testov** (4 nové na filter), lint bez chýb, build prejde.

### Added (2026-09-10 — vidieť, čo čaká na schválenie a na koho)

Krok 6 z ADR-006, s dvomi odchýlkami.

- **Zoznam, nie počet.** Návrh má na Prehľade dlaždicu s číslom. Číslo samo hovorí len to, že sa niečo deje; predkladateľ potrebuje vedieť, **na koho** sa čaká a **ako dlho** — to je jediné, s čím vie niečo urobiť. Preto zoznam s menami a dátumom predloženia.
- **Zatiaľ nad knižnicou, nie na Prehľade** — Prehľad ešte neexistuje. Knižnica je obrazovka správcu obsahu, teda toho, kto znenia predkladá. Keď Prehľad vznikne, presunie sa tam **ten istý komponent nad tou istou funkciou**: dva pohľady, ktoré si to isté počítajú každý po svojom, sa raz rozídu.
- **Nefiltruje sa filtrami zoznamu.** Čo čaká na rozhodnutie, čaká bez ohľadu na to, čo si človek práve odfiltroval — schovať to za filter by znamenalo, že si toho nikto nevšimne.
- **Názvy sa načítavajú zvlášť**, nie z riadkov zoznamu: tie sú prefiltrované, takže dokument v kole medzi nimi byť nemusí a zostalo by po ňom holé `documentId`.
- Overené: `tsc` čisto, 1073 testov, lint bez chýb, build prejde.

**Čo z kroku 6 hotové nie je:** facet `Stav` v knižnici nedostal hodnoty schvaľovania. Stav znenia je odvodený z inej kolekcie, takže filter by potreboval spojenie dvoch dotazov — a to je vlastné rozhodnutie, nie prílepok. Zapísané v `docs/TODO.md`.

### Added (2026-09-10 — schvaľovateľ sa dozvie, že sa naňho čaká)

Krok 5 z ADR-006.

- **Menovitá správa, nie hromadná pošta.** Chodí len tým, koho predkladateľ menoval (D69), a chodí **raz** — pri predložení. Nemá kadenciu a nie je to pripomienka: kolo, ktoré leží, sa rieši rozhovorom alebo zrušením, nie tým, že sa to isté pošle piaty raz. Práve v tom je rozdiel oproti termínom (ADR-004), kde pripomínanie zmysel má.
- **`ApproverDecision.notifiedAt`** — kedy sa tomu človeku ozvalo. `null` je **údaj, nie chyba**: bez neho by „nerozhodla" a „nikto jej to nepovedal" vyzerali v histórii rovnako, a to je presne tá otázka, ktorú si niekto o pol roka položí.
- **Odosielanie je mimo zápisu kola.** Keby zhodilo zápis, vzniklo by kolo, ktoré v databáze nie je, a predkladateľ by ho otvoril druhý raz. Naopak zlyhané odoslanie kolo nezruší — kolo beží ďalej a hláška povie, koľkým ľuďom sa neozvalo.
- **Zapisuje sa až po odoslaní** a len tým, ktorým správa naozaj odišla. Zapísať to dopredu by znamenalo tvrdiť, že sa človek dozvedel niečo, čo mu nikdy neprišlo.
- **Odkaz vedie na zoznam `/approvals`**, nie na jedno kolo: kto má pred sebou tri znenia, potrebuje jedno miesto, nie tri odkazy. Rovnaké pravidlo ako pri pripomienke.
- E-mail je v jazyku **príjemcu**, nie predkladateľa, a bez poznámky sa jej nadpis neukáže — prázdny nadpis nad prázdnym miestom vyzerá ako chyba šablóny.
- Overené: `tsc` čisto, **1073 testov** (6 nových na šablónu), lint bez chýb, build prejde.

### Added (2026-09-10 — schvaľovateľ môže rozhodnúť)

Krok 4 z ADR-006. Kolo sa tým dá po prvý raz uzavrieť.

- **Vlastná obrazovka `/approvals`, nie detail dokumentu**, ako predpokladalo ADR. Dôvod je vecný: schvaľovatelia sú **menovaní ľudia** (D69), nie držitelia roly. Kolegyňa z právneho útvaru nemá rolu `spravca-obsahu`, takže sa do knižnice nedostane — a keby sme jej ju kvôli schvaľovaniu dali, mohla by odvtedy normy aj nahrávať a publikovať. Rozhodovanie preto býva tam, kam sa dostane každý prihlásený, a stránka ukáže len to, na čom je menovaný.
- **Znenie sa číta priamo tam.** Schvaľuje sa text (D68), ktorý sa doslova ocitne v potvrdzovacej formulke (D28) — a schvaľované znenie **účinné ešte nie je a byť nemusí** (D73), takže odkázať schvaľovateľa na „platné znenie" inde by znamenalo, že schvaľuje niečo iné, než číta.
- **Rozhodnutie je nemenné** (rovnaká úvaha ako pri potvrdení, D24). Kto raz schválil, neprepíše to na zamietnutie: záznam, ktorý sa dá zmeniť, nie je dôkazom o tom, čo si človek vtedy myslel. Kto si to rozmyslí, dá kolo zrušiť a otvoriť nové — v histórii je vidieť oboje.
- **Podmienka „ešte nerozhodol" je súčasťou dotazu, nie len kontrolou pred ním.** Dvaja ľudia, ktorí kliknú naraz, tak nemôžu prepísať jeden druhého, a ten istý človek nezapíše dvoma kartami dve rôzne veci. Výsledok kola sa počíta z rozhodnutí, ktoré sú **v databáze** — nie z tých, ktoré sme si domysleli.
- **Dôvod je povinný len pri zamietnutí** (D71). Pri schválení by bol obradom navyše: kto súhlasí, nemá čo vysvetľovať.
- **Ostatní schvaľovatelia sú vidieť, ich rozhodnutie sa neukazuje.** Kolo je súbežné (D70) a každý rozhoduje sám; zoznam mien hovorí, kto ešte bude musieť rozhodnúť, nie ku komu sa pridať.
- **Opravené z minulého overenia:** v uzavretom kole sa pri schvaľovateľovi, ktorý nerozhodol, už nepíše „čaká", ale „nerozhodol". V zrušenom kole sa na nikoho nečaká a je to text v histórii, ktorá má byť dôkazom.
- Overené: `tsc` čisto, **1067 testov** (7 nových), lint bez chýb, build prejde.

### Added (2026-09-10 — znenie sa dá predložiť na schválenie)

Krok 3 z ADR-006 — tretí krok nahrávania z návrhu. Rozhodovanie (krok 4) tu ešte nie je.

- **`lib/approvalsDb.ts`** číta a zapisuje kolá; **čo sa smie, rozhoduje `approvals.ts`**, ktorý je bez databázy. Kolekcia je append-only ako `acknowledgements`: kolo sa nemaže a druhé kolo po zamietnutí je **nové kolo**, nie prepísané staré — inak by z histórie zmizlo, že prvý pokus neprešiel.
- **Mená schvaľovateľov sa berú zo záznamu osoby, nie z formulára.** Odtlačok mena v kole je dôkazná vec (D24) a formulár je vstup od človeka: kto si ho prepíše, prepíše si aj to, kto podľa záznamu schvaľoval. Preto do akcie chodia `persons.id`.
- **Znenie spred zavedenia schvaľovania sa predložiť nedá** (D74). Nie je to technická prekážka: keby sa dalo, znenie by počas kola stratilo príznak, prepadlo by do „v schvaľovaní" a brána pri prideľovaní by ho zastavila — norma, ktorá sa dnes prideľuje, by sa prideľovať prestala.
- **Zrušenie kola nemaže, len uzavrie s povinným dôvodom.** Je to jediná cesta, ako zo zoznamu odstrániť schvaľovateľa, ktorý tam byť nemá; meniť zoznam za behu by znamenalo, že sa dá nepohodlný schvaľovateľ potichu vymeniť.
- **Formulár nad serverovou akciou, nie API** — predloženie otvára ostatným povinnosť rozhodnúť a cudzia stránka to nemá vedieť spustiť za prihláseného človeka.
- **Zaškrtávacie políčka namiesto `select multiple`:** na telefóne sa viacnásobný výber v rozbaľovacom zozname ovláda zle a bez JavaScriptu ho nemá čo nahradiť. Zoznam je v posuvnom rámiku a klikací je celý riadok, nie len políčko.
- **Vyradení ľudia a predkladateľ sa neponúkajú.** Kolo, ktoré čaká na človeka, čo v zväze už nie je, sa neuzavrie nikdy; a ponúkať voľbu, ktorú server vzápätí odmietne, je zlé rozhranie.
- Overené: `tsc` čisto, **1060 testov** (2 nové), lint bez chýb, build prejde. **Obrazovka na 390 px overená zatiaľ nie je** — vyžaduje prihlásenú reláciu.
- **Otvorené:** unikátny index `{companyCode, documentId, versionId, round}` je doplnený do `onboarding_init.mjs`, ale **v Atlase ešte vytvorený nie je**. Bez neho môžu dvaja ľudia, ktorí naraz stlačia „Predložiť", otvoriť dve kolá nad tým istým znením.

### Changed (2026-09-10 — znenia z knižnice sú označené ako zverejnené pred schvaľovaním)

Migrácia k ADR-006 (D74). **Nedopisuje sa žiadne schválenie** — to by znamenalo vyrobiť súhlas, ktorý nikto nedal.

- **`Version.publishedBefore`** — jediný príznak, ktorý hovorí: toto znenie tu bolo skôr, než sa začalo schvaľovať. Je to **pomenované prázdne miesto**, nie stav „schválené kedysi predtým". Dočasné lešenie (D75): zmizne spolu so skúšobným korpusom, keď ho nahradia oficiálne znenia prevedené cez schvaľovanie.
- **`npm run migrate:grandfather -- --company SFZ [--zapis]`** — náhľad je predvolený, zápis treba pýtať. Označilo sa **11 znení v 10 dokumentoch SFZ**, vzniklo 10 auditných záznamov (`document` / `grandfathered`). Druhý beh neoznačí nič: zapisuje sa len tam, kde príznak ešte nie je.
- **Koncepty sa zámerne neoznačujú.** Koncept nikto nezverejnil, takže označiť ho ako „zverejnený pred zavedením schvaľovania" by bola nepravda — a hlavne by mu to otvorilo bránu pri prideľovaní. V SFZ dnes koncept nie je ani jeden; podmienka je tam pre to, čo pribudne zajtra.
- **Nové znenia príznak nedostávajú nikdy.** Čo vznikne po zavedení schvaľovania, ním musí prejsť; inak by grandfathering nebol prechodný stav, ale zadné dvierka.
- **Poradie krokov ADR-006 sa mení:** brána pri prideľovaní (krok 2) ide **až po** predložení a rozhodovaní (kroky 3 a 4). Pôvodné poradie by medzi krokom 2 a 4 znamenalo, že nové znenie sa dá nahrať, ale nie schváliť — a teda ani prideliť.
- Overené: `tsc` čisto, 1058 testov, lint bez chýb, build prejde; migrácia spustená naprázdno pred zápisom a druhý raz po ňom.

### Added (2026-09-10 — model schvaľovania znenia: stav sa odvodzuje, nie ukladá)

Krok 1 z ADR-006. **Nič v behu systému sa nemení** — je to pravidlo bez cesty k nemu.

- **`lib/approvals.ts` je zámerne bez databázy.** Pravidlo, na ktorom bude stáť brána pri prideľovaní, sa musí dať otestovať bez Monga a bez toho, aby si ho niekto domýšľal z dotazu. Rovnaké delenie ako pri `due.ts`.
- **Stav znenia je odvodený z kôl** (D27), nie uložený, a rozhoduje **posledné kolo, nie súčet**: po zamietnutí a novom predložení platí nové kolo, staré zostáva v histórii. Uložený stav by sa raz rozišiel s kolami, z ktorých vznikol.
- **Jedno zamietnutie zastaví celé kolo** (D71) — aj keď ostatní schválili a aj keď ešte nerozhodli všetci. Hlasy, ktoré prídu neskôr, už výsledok nezmenia; čakať na ne znamená držať znenie v limbe.
- **Prázdne kolo nie je schválené kolo.** `every` na prázdnom poli vracia `true`, takže bez výslovnej podmienky by kolo bez schvaľovateľov prešlo ako schválené a znenie by sa dalo prideliť bez súhlasu. Má vlastný test.
- **Predkladateľ nesmie byť medzi schvaľovateľmi** (D69) — porovnáva sa bez ohľadu na veľkosť písmen. Kto text nahral, ho neschvaľuje; inak je schválenie podpis pod vlastnú prácu.
- **Brána pri prideľovaní hlási dva rôzne dôvody** (D73): `notApproved` a `versionNotEffective`. Schválené a účinné sú dve nezávislé osi — personalista musí vedieť, ktorá mu chýba, inak hľadá naslepo.
- **`published-before` je dočasné lešenie, nie pojem** (D74, D75): znenia zverejnené pred zavedením schvaľovania cez bránu prejdú, aby personalista zo dňa na deň nemohol ostať bez ničoho. Zmizne spolu so skúšobným korpusom, keď ho nahradia oficiálne znenia prevedené cez schvaľovanie.
- Overené: `tsc` čisto, **1058 testov** (24 nových), lint bez chýb, build prejde.

### Added (2026-09-10 — kto by dnes dostal pripomienku: výpočet a beh naprázdno)

Prvá polovica kroku 4 z ADR-004. **Zámerne nič neodosiela.**

- **`dueRemindersFrom()`** — čistá funkcia nad povinnosťami: kto sa má dnes ozvať, v akom tóne a či o tom má vedieť aj personalista. Kadencia zostáva v `due.ts`, takže sa testuje bez databázy.
- **Jeden e-mail na človeka, nie na povinnosť.** Štyri samostatné správy v jednej minúte vyzerajú ako pokazený systém a človek ich prestane čítať — čím prestane fungovať pripomínanie samo. Rovnaké pravidlo ako pri `byPersonReminder()`.
- **Horší tón vyhráva.** Kto má jednu vec po termíne a druhú pred ním, dostane „ste po termíne", nie upokojujúce „blíži sa".
- **Potvrdené povinnosti vypadnú pri výbere**, nie až v šablóne: e-mail o niečom, čo je hotové, je horší než žiadny.
- **`Duty.due`** sa počíta `dueForPerson()` — ten istý výpočet ako vo widgete. Vo výkaze pribudla história oddelení a skupín do projekcie, lebo bez nej relatívny termín neviem počítať pre človeka, ktorý prišiel neskôr (D62). Pri dvoch prideleniach platí **skorší** termín, rovnako ako v `pending.ts` — inak by výkaz a widget pri tej istej povinnosti ukázali iné číslo.
- **Cron beží naprázdno.** Spočíta, komu by sa dnes ozval, vypíše to do logu a vráti vo výstupe — a **nepošle nič**. Adresy sú vo výpise maskované (O14). Odosielanie sa zapne samostatnou zmenou, keď sa na výpise zhodneme; `vercel.json` zostáva týždenný.
- Overené: `tsc` čisto, **1034 testov** (6 nových), build prejde.

### Added (2026-09-10 — termín je vidieť tam, kde človek povinnosť rieši)

Krok 3 z ADR-004. Tým je termín kompletný od zadania po zobrazenie; zostávajú pripomienky.

- **`PendingItem.due`** — termín pre **túto osobu**, počítaný `dueForPerson()` z toho istého pridelenia, z ktorého sa počíta aj „čaká od". Žiadny druhý výpočet: dve kópie pravidla „aký je termín" by sa raz rozišli presne vtedy, keď na tom záleží.
- **Pri dvoch prideleniach tej istej verzie platí skorší termín.** Prísnejší zaväzuje — opačné poradie by znamenalo, že druhé pridelenie ticho predĺži termín z prvého, čo nikto nerozhodol.
- **Povinnosť z trasy má termín len vtedy, keď ju kryje pridelenie s termínom.** Trasa vlastný termín zatiaľ niesť nevie; `null` je platný stav a widget vtedy nenapíše nič — rovnaké pravidlo ako pri `assignedAt`.
- **Chip pri názve, nie medzi metadátami** (D63): je to jediný údaj v riadku, ktorý hovorí, čo sa stane, keď človek nič neurobí. Štyri podoby: `do 12. 9.` (ticho, keď je čas), `do 12. 9.` v jantárovej pri piatich a menej dňoch, `termín dnes`, `po termíne o 3 dni` v červenej.
- **Farba nie je jediným nositeľom stavu** — text hovorí to isté slovami, takže chip funguje pri farbosleposti aj v čiernobielej tlači. Tvary čísloviek („o deň / o 2 dni / o 5 dní") sú v `i18n`, nie v komponente.
- Jeden okamih pre celý zoznam: keby si ho každý riadok bral sám, dva riadky vykreslené o polnoci by mohli byť v inom stave.
- Overené: `tsc` čisto, **1028 testov** (3 nové na `dueForPerson`, vrátane neskoršieho príchodu do oddelenia), build prejde, štyri stavy chipu prekreslené na 720 px aj 390 px v svetlej aj tmavej téme.

### Added (2026-09-10 — termín sa dá zadať pri prideľovaní)

Krok 2 z ADR-004. Bez neho termín nikto nezadá a model z kroku 1 leží.

- **Výslovná voľba, nie „čo je vyplnené, to platí"** — „bez termínu" / „do dátumu" / „do počtu dní od vzniku povinnosti". Prázdne pole je dvojznačné: personalista, ktorý dátum zadá a potom si to rozmyslí, ho prepíše na prázdno, a bez voľby by sa nedalo odlíšiť „termín nechcel" od „zabudol vyplniť". Pri sľube danom človeku sa to hádať nemá.
- **Obe polia zostávajú vidieť**, aj keď k voľbe nepatria: formulár beží bez JavaScriptu, takže sa skryť nedajú — a kto sa prepne z dátumu na dni a späť, o svoj dátum nepríde.
- **Dátum sa číta ako miestna polnoc, nie ako UTC.** `new Date("2026-09-30")` je polnoc v UTC: v našom pásme by z termínu vyšiel 30. 9. o druhej ráno a na západ od Greenwichu **29. 9.** — teda termín o deň skôr, než personalista zadal. Má vlastný test.
- **Chyba vracia kód, nie výnimku** — volajúci ju ukáže pri formulári spolu s tým, čo už človek vyplnil, namiesto vyhodenia na chybovú stránku. Termín sa parsuje pred cyklom prideľovania: čiastočne prideliť a potom spadnúť na termíne by znamenalo pridelenia bez neho.
- Rámik termínu je `hr-group`, teda ten istý ako pri výbere publika nad ním — druhý vzhľad pre druhý fieldset v jednom formulári je presne to, čo robí obrazovku nejednotnou.
- Overené: `tsc` čisto, **1025 testov** (4 nové), build prejde, formulár prekreslený na 720 px aj 390 px.

### Added (2026-09-09 — termín potvrdenia: model a kadencia pripomienok)

Prvý krok z `docs/ADR-004-termin-potvrdenia.md`. Zámerne len model a čisté funkcie — prideľovací formulár, zobrazenie a e-maily idú ďalšími PR.

- **`lib/due.ts`** — termín ako hodnota, bez závislosti na databáze aj na pridelení, takže sa dá otestovať bez Monga a nevzniká kruh v importoch.
- **Dva tvary termínu (D62).** `{ kind: "date" }` je to, čo personalista obvykle chce („všetci do konferencie"), a `{ kind: "days" }` to, čo nemá jeho dieru: kto do oddelenia príde deň pred absolútnym termínom, dostal by na normu jeden deň. Relatívny tvar sedí na D50 a pri povinnosti z trasy je jediný možný — trasa pridelenie nemá, takže absolútny dátum nemá kam zapísať.
- **`dueForPerson()`** počíta relatívny termín od okamihu, ktorý už vracia `dateForPerson()`. Žiadne nové pravidlo „odkedy povinnosť beží" nevzniklo.
- **Stav je odvodený, nie uložený (D63).** `none` / `open` / `soon` / `over`, pričom **deň termínu patrí do `soon`** — kto potvrdí v ten deň, termín splnil. Je to presne to miesto, kde sa dá pomýliť o jeden deň a človek by dostal e-mail „ste po termíne" v deň, keď po ňom nie je.
- **Kadencia je eskalácia, nie opakovanie** (`reminderPlan()`): D-5 … D-0 osobe denne, potom D+1, D+3, D+7 a od týždňa raz týždenne aj personalistovi. Zadanie znelo „po termíne každý deň"; namietol som a Ján Letko eskaláciu schválil. Test to drží číslom: **za tridsať dní po termíne odíde osobe najviac sedem e-mailov**, pri dennom režime by ich bolo tridsať.
- **Nezmyselný termín sa neuloží.** Absolútny termín pred dňom platnosti znenia je povinnosť, ktorá sa nedá splniť skôr, než vznikne (D6); nula dní je pasca, nie termín. Termín ide do auditu spolu s dôvodom — je to sľub daný človeku, nie nastavenie (D51).
- **Bez migrácie.** Pridelenia spred ADR-004 termín nemajú a nedopočítava sa im: dopísať ho spätne by znamenalo vymyslieť dátum, ktorý nikto nedal. Bez termínu sa automaticky nepripomína a ostáva dnešná cesta cez personalistu.
- Overené: `tsc` čisto, `eslint` bez chýb, **1021 testov** (11 nových), produkčný build prejde.

### Changed (2026-09-09 — hlavička podľa návrhu a návrh do repozitára)

**Ján postavil vedľa seba návrh a produkciu a mal pravdu**: hlavička nesedela. Zo siedmich obrazoviek návrhu je jedna blízko, štyri sú čiastkové a „Prehľad" neexistuje vôbec. Príčina nebola v tom, že by kroky neboli urobené, ale v tom, ako som ich overoval — skúšobné strany som napísal sám z toho, ako som si návrh prečítal, a potom porovnával snímky **tých** strán. To nedokazuje nič o vernosti návrhu.

- **Návrh je v repozitári** (`docs/design/`) — celý export z Claude Design vrátane zadania s rozmermi. Verzovaný vstup sa nedá stratiť ani prekrútiť spamäti.
- **`docs/DESIGN_GAP.md`** — rozdiely po obrazovkách, príčina zlého overovania a plán rozdelený na to, čo dnešné dáta unesú, a čo potrebuje najprv rozhodnutie.
- **Celý názov organizácie namiesto skratky** (13.5 px/600, elipsa na 30 vw). „SFZ" je z pohľadu človeka, ktorý potvrdzuje záväzný predpis, menej než „Slovenský futbalový zväz".
- **Globálne pole v hlavičke** — `flex: 1 1 240px`, 32 px, ikona vľavo, fokusový prstenec z `--accent-soft`. Je to **otázka, nie filter zoznamu**: míri na `/` s `?q=`, ktoré si domovská stránka prečíta a predvyplní ním pole odpovede. Obyčajný `<form method="get">`, takže **funguje bez JavaScriptu**; `⌘K`/`Ctrl+K` je len zrýchlenie navrch.
- **Hlavička sa zalamuje** (`flex-wrap`, `min-height: 52px`) namiesto pevných 56 px. Na telefóne sa zlomí do dvoch riadkov — presne ako návrh; s pevnou výškou by sa pole na otázku nezmestilo.
- **Navigácia je potichšia**: 13 px z návrhu namiesto 15 px, a aktívna položka sa kreslí **podčiarknutím v páse** a dlaždicou v bočnom paneli. Dlaždica v oboch znamenala, že pás nevyzeral ako záložky.
- **Odstránené mŕtve CSS hlavičky** po presune navigácie do shellu (`.header-link`, `.header-hamburger`, `.header-nav`). Nebolo to len smetie: `.header-name { font-size: 17px }` a `.header-row { height: 60px }` v ňom boli **príčinou** toho, že hlavička nesedela s návrhom ani po zmene základných pravidiel.
- Overené **proti návrhu, nie proti sebe**: hlavička vyrezaná z kanvasu a vykreslená vedľa našej na 1000 px aj 390 px, a porovnané **namerané** hodnoty — názov 13.5 px/600 a šírka 189 px v oboch, pole 13 px/32 px v oboch, hlavička 52 vs 53 px. Vedomá odchýlka: položka navigácie 44 px namiesto 35 px (krok 7 handoffu žiada 44 px terče).
- Zámerne bez zvončeka upozornení a počtov pri položkách — obe potrebujú ten istý dotaz a robia sa spolu.

### Changed (2026-09-08 — anglické názvy CSS tried)

**Mechanická zmena bez dopadu na vzhľad.** Rozhranie malo triedy po slovensky (`.tlacidlo`, `.karta`, `.pole-vstup`, `.strom-riadok`), čo pri čítaní kódu znamenalo prepínať jazyk vetu po vete a pri hľadaní `button` nenájsť tlačidlo.

- **109 tried v 47 súboroch**, vrátane `je-*` → `is-*` (`je-aktivna`/`je-aktivny` splynuli do jedného `is-active`). Naviac: dva slovenské `@keyframes` (`oznam-prichod` → `notice-in`, `blik` → `blink`), štyri slovenské `id` a kotvy (`#zoznam` → `#results`, `#filtre` → `#filters`) a vlastná premenná `--uroven` → `--level`.
- **Nahrádzalo sa cielene, nie slepo v texte.** `pole`, `karta`, `strom`, `farba` sú v tomto repozitári aj názvy premenných, polí formulárov a hlavne slov v komentároch — komentáre zostávajú po slovensky zámerne. Skript menil len token **za bodkou** v CSS a len vnútri `className=` v TSX; jediný výskyt názvu triedy v JavaScripte (`querySelector(".is-active")`) bol už predtým anglický.
- **Overené obrázkom, nie dôverou.** Päť skúšobných strán × dve šírky (390 px, 1000 px) × dve témy = **20 renderov, všetkých 20 zhodných na pixel** so starým CSS a starým značkovaním. Prvý pokus tri rozdiely našiel — ukázali sa ako `transition` zachytený v polovici prepnutia témy, nie ako chyba premenovania.
- Overené aj: `tsc --noEmit` čisto, `eslint` bez chýb, 1010 testov, produkčný build prejde.

### Added (2026-09-08 — výber, ktorý prežije stránkovanie)

**Označené dokumenty sú v adrese, nie v stave formulára.** Dovtedy to boli zaškrtávacie políčka jedného formulára, takže výber platil pre viditeľnú stranu a prechod na ďalšiu ho zabudol — políčko sa odošle až akciou, takže dovtedy o ňom server nevie a knižnica beží bez JavaScriptu zámerne.

- **Políčko je odkaz, nie `<input type=checkbox>`.** Klik prepíše adresu a od tej chvíle sa `pick=<id>` nesie v **každom** ďalšom odkaze (`carryFields`) — teda cez stránkovanie, triedenie aj zmenu filtra. Štvorček je nakreslený (`.bulk-pick-box`), stav nesie `aria-pressed`.
- **Do akcie ide výber skrytými poľami `document`.** `moveManyAction` ani `assignManyAction` sa nemenili — čítajú z formulára to isté, čo predtým posielali políčka, len sa tam teraz dostane aj to, čo je označené na inej strane.
- **Označený dokument, ktorý filtru už nevyhovuje, sa nezahodí — prizná sa.** Nad zoznamom je „Označené: N“ a „z toho M mimo tohto zoznamu“ plus odkaz „zrušiť výber“. Tiché zahodenie by znamenalo, že sa presunie menej, než človek čaká; tichá pamäť, že sa presunie viac. Obe sú pri hromadnom presune drahé.
- **„Označiť stranu“ označí stranu, nie výsledok.** Zvyšok výberu nechá nedotknutý: je to pomôcka na tejto strane, nie príkaz „chcem presne toto“. Označiť všetkých 148 je iná akcia s iným následkom a mýliť si ich pri hromadnom presune je drahé.
- **Označenie riadka nevracia na prvú stranu**, na rozdiel od filtrov — tie stranu resetujú preto, že po zúžení môže byť strana 4 prázdna, ale označenie zoznam nezúži. Inak by sa na strane 3 nedalo označiť nič.
- Po vykonanej hromadnej akcii je výber minutý — `back` sa vracia bez neho.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, 1010 testov (7 nových na výber v adrese), produkčný build prejde, prekreslené na 1000 px aj 390 px v svetlej aj tmavej téme.

### Fixed (2026-09-08 — jedno rozhranie namiesto dvoch)

**Toto je oprava chyby v mojom rozhodnutí, nie nová funkcia.** Dohoda „shell je opt-in a stránky sa presúvajú po jednej" znamenala, že systém je po celý čas presunu v stave, ktorý je horší než oba jeho konce. Pri dvoch obrazovkách v shelli a ôsmich mimo bolo naraz vidieť:

- dva navigačné systémy — menu v hlavičke a pás pod ňou — s **iným poradím položiek** (hlavička mala Zlatú sadu druhú a Knižnicu poslednú, shell naopak),
- iný vzhľad aktívnej položky (sivá vs. farba organizácie),
- iné zarovnanie obsahu (na stred vs. pri ľavom okraji).

Čo sa zmenilo:

- **Shell je na každej prihlásenej obrazovke.** Dvadsaťštyri stránok, vrátane podstránok knižnice, HR, osôb, zlatej sady, nastavenia organizácie a správy tenantov. Prihlasovacia obrazovka ho nemá zámerne — navigácia obsahu by na nej viedla na miesta, kam sa neprihlásený človek nedostane.
- **Hlavička už navigáciu obsahu nevykresľuje.** Zostáva v nej značka organizácie a osobné menu pod avatarom (nastavenia, správa tenantov, téma, odhlásenie) — to shell nemá a je to správne, sú to veci otvárané raz za mesiac.
- **`shellRoutes.ts` sa otočil.** Namiesto zoznamu obrazoviek, ktoré shell majú, je tam zoznam **výnimiek**, ktoré ho nemajú. Vymenovať výnimky je lacnejšie než vymenovať pravidlo — a nová obrazovka tým dostane navigáciu bez toho, aby si na to niekto musel vzpomenúť.
- **Jedna šírka pre hlavičku, navigáciu, obsah aj pätičku** (`--shell-maxw`). Dovtedy mala každá z tých štyroch vrstiev vlastný ľavý okraj: logo centrované na 940 px, navigácia od kraja obrazovky, obsah shellu na 1240 px. Na širokom monitore boli všetky tri začiatky riadka vidieť naraz.
- **Pás navigácie ide cez celú šírku, ale položky sú zarovnané s obsahom.** Riešené odsadením s `max()`, nie hornou hranicou šírky: keď pás hranicu dostal, biely pruh uprostred širokej obrazovky **skončil** a vyzeral ako nedokreslený prvok.
- **Dvojitý padding je preč.** Stránky mali odsadenie z `.obal`, shell ho má v `.app-main` — na telefóne by dve vrstvy zjedli tretinu šírky.
- **Layout prestal zisťovať dve role.** Rolu HR a správy obsahu si počíta `AppShell` sám; v `layout.tsx` to boli dva dotazy na každú stránku pre odkazy, ktoré hlavička už nevykresľuje.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, 1003 testov (hranica shellu prepísaná na nové pravidlo), produkčný build prejde, tri obrazovky prekreslené na 1600 px aj na 390 px.


### Added (2026-09-08 — zátvorky v query builderi ako skupiny podmienok)

- **Zátvorky sú skupiny, nie znaky.** Vnútri skupiny platí „a", medzi skupinami „alebo" — teda `(A a B) alebo (C a D)`. Do tejto formy sa dá previesť každý booleovský výraz, takže sa nič nestráca, a rozhranie zostáva dvojúrovňové: opísateľné jednou vetou a **ovládateľné bez JavaScriptu**, na čom knižnica zámerne stojí. Strom ľubovoľnej hĺbky by si vyžiadal klientsky stav a s ním by prestala fungovať bez skriptu.
- **Logika je vidieť, nie sa píše.** Spojka pred riadkom („a" / „alebo"), medzera a linka medzi skupinami — a zmena spojky je odkaz vedľa riadka. Žiadny parser, žiadne znaky, ktoré by človek musel trafiť.
- **„Alebo odtiaľto" posunie aj riadky za sebou**, nie len ten, na ktorý sa klikne. Keby zostali v starej skupine, jedno kliknutie by zmenilo logiku na dvoch miestach naraz. Opačný smer („a namiesto alebo") presúva len ten riadok — spojka pred riadkom je vec toho riadka.
- **Skupina je predpona v adrese** (`g0~pole~op~hodnota`), nie štvrtá časť. Hodnota môže obsahovať vlnovku (a `encodeURIComponent` ju nekóduje), takže čokoľvek za hodnotou by sa od nej nedalo odlíšiť.
- **Staré odkazy fungujú ďalej.** Podmienka bez skupiny sa vykladá podľa `match`: `all` = jedna skupina so všetkým, `any` = každá podmienka sama. Sú to presne tie dva krajné prípady, ktoré builder mal predtým, takže odkaz spred zmeny vracia to isté. `match` sa už nezapisuje — skupinu nesie samotná podmienka a dva zdroje tej istej pravdy by si raz odporovali.
- **Skupiny sa po odobraní prečíslujú bez dier.** Diera by z čísla skupiny prestala robiť jej poradie a odkazy „alebo odtiaľto" by presúvali riadok inam, než na čo človek klikol.
- **Skupina, z ktorej všetko vypadlo, sa zahodí celá** (napríklad pri neplatnom dátume z adresy). Prázdny `$and` by dotaz zhodil a prázdny `$or` by nevrátil nič — knižnica by vyzerala prázdna.
- Náhľad dotazu píše zátvorky **len pri dvoch a viac skupinách**; pri jedinej by boli ozdoba, ktorá vetu predlžuje a nič nerozlišuje.
- **Na telefóne je odkaz na zmenu spojky pod podmienkou, nie vedľa nej.** Vedľa nej sa text na 390 px zalomí a odkaz mu leží pri poslednom slove — na snímke sa „rozhodcovia" a „zmeniť na a" dotýkali. Krížik zostáva na tom istom riadku ako odkaz, vpravo.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, **1003 testov** (16 nových), builder prekreslený na 390 px, na desktope aj v tmavej téme.


### Changed (2026-09-08 — „Na potvrdenie" beží v aplikačnom shelli)

Druhá sekcia v shelli, prvá presunutá **celá** aj s podstránkami. Presúva sa po jednej a každá vlastným PR — dohoda z kroku 2.

- **`shellRoutes.ts` má dva zoznamy, nie jeden.** `SHELL_ROUTES` je presná zhoda pre sekcie, z ktorých je v shelli len úvodná stránka (`/library` áno, `/library/new` nie — prefix by mu zobral menu v hlavičke a nedal by mu namiesto neho nič). `SHELL_SECTIONS` je pre sekcie presunuté celé; tam prefix treba, inak by detail dokumentu zostal **bez akejkoľvek navigácie**.
- **Hranicou sekcie je lomka, nie začiatok reťazca** — inak by `/documentsomething` prešlo ako podstránka `/documents`. Je na to test, rovnako ako na to, že cesta v zozname nesmie končiť lomkou (`//` v prefixe by sekciu vypol navždy a nikto by to nehľadal v tomto súbore).
- **Šírka 760 px zostáva** na oboch stránkach. Shell dáva navigáciu a odsadenie; dĺžku riadka určuje obsah — je to znenie normy na čítanie, nie tabuľka.
- **Vetva „nie ste v tejto organizácii" shell nedostala** zámerne: kto nie je medzi osobami tenanta, nemá kam navigovať a navigácia by mu ponúkla sekcie, do ktorých ho stránky nepustia.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, **989 testov** (2 nové nad hranicou sekcie), produkčný build prejde.


### Added (2026-09-08 — dať vedieť e-mailom aj o povinnostiach z trasy)

Nájdené pri skúške na skúšobnej smernici: **„Dať vedieť" existovalo len nad prideleniami.** Keď povinnosť vznikla krokom v trase, pridelenie neexistovalo a tlačidlo nebolo nikde — pritom presne tadiaľ chodí onboarding.

- **Jedna obrazovka, dva režimy nad tým istým výpočtom.** `/hr/reminders` teraz vie „všetkým nepotvrdeným" (prah 0) aj „len meškajúcim" (prah 14 dní). Nie je to nový mechanizmus: `duties()` v `hrReport.ts` už spája pridelenia aj trasy a je to ten istý zdroj, z ktorého počítal výkaz. Druhá cesta k tomu istému zoznamu by sa raz rozišla s prvou.
- **Prah 0 sa dovtedy nedal nastaviť.** `Math.max(1, Number(q.days) || DEFAULT_DAYS)` mal dve zábrany naraz — jednotku ako dolnú hranicu a `||`, cez ktoré nula prepadla na 14. Teraz to rieši `thresholdDays()` a **preklep v adrese padá na predvolený prah, nie na nulu**: nula by rozposlala e-maily všetkým namiesto meškajúcim, čo je presne ten druh chyby, ktorý sa prejaví až tým, že sa ozve sto ľudí.
- **E-mail má dva tvary.** Pri prahu 0 sa neuvádzajú dni a predmet znie „Na potvrdenie", nie „Pripomienka". Dokument, ktorý pribudol dnes, „nečaká nula dní" — a veta o čakaní by z prvého oslovenia spravila výčitku za meškanie, ktoré človek nemal ako spôsobiť.
- **Pri každej položke je vidieť, z ktorej trasy plynie.** Pri povinnosti z trasy je to jediné vysvetlenie, prečo je človek v zozname: pridelenie, ktoré by personalista hľadal, neexistuje.
- **Povinnosť bez začiatku sa nezahrnie ani pri nule.** Bez `since` sa nedá povedať, odkedy o nej človek vie, a jediné, čo by e-mail dosiahol, je pripomenúť niečo, čo možno pripomenuté už bolo.
- Prepínač režimu sú **dva odkazy, nie tlačidlá** — režim je súčasťou adresy, takže sa dá poslať aj s ním a funguje bez skriptu.
- Nič sa neposiela automaticky ani teraz: náhľad, kto to dostane, a až potom tlačidlo. Zmena schémy nebola potrebná — pripomienky zapisovali audit, nie `notified[]` na pridelení, a oznámenie to robí rovnako.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, **987 testov** (8 nových nad prahom a režimom oznámenia).


### Fixed (2026-09-08 — potvrdenie dokumentu funguje aj bez JavaScriptu)

Potvrdenie sa posielalo skriptom (`fetch` na `/api/acknowledgements`), takže bez JavaScriptu tlačidlo mlčalo. Pri **právne záväznom úkone** je to priveľa: prehliadač bez skriptu, firemná politika alebo výpadok pri načítaní balíka znamenali, že záväzok sa nedá splniť — a človek nevidel dôvod, len tlačidlo, ktoré nič nerobí.

- **Je to formulár nad serverovou akciou** (`documents/[documentId]/actions.ts`), ktorá volá **tú istú `acknowledge()`** ako API. Žiadne pravidlo okolo dôkazného záznamu sa nepíše druhýkrát: verziu, znenie, jazyk aj odtlačok oddelenia určuje server (D24, D28) a dokument sa načítava pre osobu (D32).
- **Nie formulár mierený na `/api/acknowledgements`** — a to je jadro veci, nie detail. To API chráni pred cudzou stránkou len to, že klient posiela `Content-Type: application/json`: taký `fetch` z iného pôvodu si vyžiada predletovú kontrolu a prehliadač ho zastaví. Obyčajný `<form method="post">` ale cudzí web odoslať **vie** a typ obsahu mu určí prehliadač. Pripojiť formulár priamo na to API by teda znamenalo vyrobiť CSRF na potvrdzovaní noriem: cudzia stránka by dokázala potvrdiť normu za prihláseného človeka. Serverová akcia si pôvod overuje sama.
- **Tlačidlo zostalo klientske kvôli jednej veci** — `useFormStatus()` dá stav odosielania, takže počas zápisu povie „Potvrdzujem…". Bez toho človek klikne druhýkrát; druhý klik síce nič nepokazí (unikátny index, D24), ale ticho po prvom vyzerá ako pokazená stránka. `useFormStatus()` musí byť **vnútri** formulára, preto má vlastný podkomponent — v rodičovi by vracal stav nadradeného formulára, teda vždy `false`.
- **Zmizol `fetch`, `router.refresh()` aj lokálny stav „hotovo".** Stav sa neukladá, odvodzuje sa (D27): po presmerovaní vráti `hasAcknowledged()` už `true` a namiesto tlačidla je štítok. Menej kódu a jedna pravda namiesto dvoch.
- **Výsledok sa nesie v adrese** (`?msg=`) a zobrazuje ho `Notice` — rovnako pre človeka so skriptom aj bez neho. Dve cesty k tej istej hláške by sa raz rozišli. Vety zostali tie isté, aké používalo tlačidlo (`onboarding.error`), vrátane „Toto znenie už máte potvrdené" na 409.
- **`clientIp()` je teraz v `lib/requestMeta.ts`** a čítajú ju obe cesty. Dve rôzne čítania tej istej hlavičky by znamenali dva tvary IP v jednej kolekcii a pri audite by sa nedalo povedať, ktorý je správny. Pribudlo 6 testov — vrátane toho, že pokazená hlavička `", 10.0.0.1"` vráti `null` a nie adresu proxy: zapísať adresu Vercelu ako adresu človeka je horšie než nezapísať nič.
- **`/api/acknowledgements` zostáva** pre programový prístup; v hlavičke súboru je napísané, že obrazovka ho už nevolá.
- Hláška „Potvrdenie potrebuje JavaScript" z kroku 7 aj s jej tromi i18n kľúčmi je odstránená — prestala byť pravdivá.
- **Otvorené:** IP z `headers()` v serverovej akcii sa dá potvrdiť len v produkcii (náhľady sú za SSO). Zapísané v `docs/TODO.md`.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, **979 testov** (6 nových), produkčný build prejde.


### Fixed (2026-09-08 — dotiahnutie: fokus, tmavá téma, cesty bez JavaScriptu)

Krok 7 handoffu. Tým je dizajnový balík prejdený celý.

- **Viditeľný fokus na všetkom, čo sa dá chytiť klávesnicou.** Prstenec mala doteraz asi polovica prvkov a zvyšok sa spoliehal na predvolený obrys prehliadača — ten je v tmavej téme miestami sotva vidieť a **na primárnom tlačidle s farbou organizácie splynie úplne**. Pribudlo jedno pravidlo v `:where()`, teda so **nulovou špecificitou**: je to záchytná sieť, nie prepis — kde už prstenec s vlastným odsadením je (facety, triedenie v tabuľke, položky navigácie), platí ďalej. A pokryje aj prvky, ktoré pribudnú neskôr; na tie sa inak zabudne.
- Tlačidlá majú prstenec **mimo** plochy (`outline-offset: 2px`) — vnútri by na pozadí `--accent` nebol vidieť.
- **Pruhované pozadie zóny na súbor bolo v tmavej téme neviditeľné.** Bola namiešaná napevno z tmavej s 3 % alfou, teda tmavá na tmavom: zóna vyzerala ako prázdny rámček. Teraz je z `--surface-2`, ktorý sa v oboch témach otočí sám. Rovnaký prístup má aj nový slot na logo.
- **Filtre sú na telefóne na jedno ťuknutie.** Panel zostáva pod výsledkami — nad prvým dokumentom nemá stáť obrazovka a pol filtrov — ale v hlavičke je kotva „Filtre ↓" a pod panelom „↑ Späť na zoznam". Sú to obyčajné odkazy: fungujú bez skriptu a dajú sa poslať v adrese. Zásuvka z návrhu zostáva otvorená (`docs/TODO.md`): `<details>` sa na širokej obrazovke nedá spoľahlivo držať otvorené cez CSS a druhá kópia panelu v DOM je horšia než kotva.
- **Tri miesta teraz povedia, že bez JavaScriptu nefungujú** — otázka, prihlásenie a potvrdenie dokumentu. Doteraz mlčali: formulár, ktorý po odoslaní nič neurobí, vyzerá ako pokazená stránka a človek skúša znova a znova.
- **Pri otázke je to zámer, pri ostatných dvoch dlh.** Odpoveď prichádza po častiach, ako ju model píše (SSE) — to sa serverovým formulárom nahradiť nedá, a hláška preto ponúka cestu k dokumentom, ktoré sa čítajú bez skriptu. Prihlásenie a potvrdenie ale serverovú cestu mať majú: potvrdenie je **právne záväzný úkon** a dnes stojí na `fetch`. Oboje je zapísané v `docs/TODO.md` aj s návrhom riešenia — hláška je náplasť, nie oprava.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, 973 testov, produkčný build prejde, prstence aj tmavá téma prekreslené na 390 px a na desktope.


### Added (2026-09-08 — nastavenie organizácie: živý náhľad farby a odstránenie loga)

Krok 6 dizajnového handoffu.

- **Voľba farby prekresľuje celé rozhranie naživo.** Je to jediné nastavenie, ktorého dôsledok nie je z hodnoty vidieť — `#0e7490` nikomu nepovie, ako bude vyzerať hlavička, tlačidlo a odkaz naraz.
- **Premenné sa nastavujú na `<html>` a na každý predok s vlastnými inline premennými.** Nastaviť len `:root` nestačí: `tenantStyle()` ich sype inline na `<body>` a na obal obrazovky, a inline štýl má vyššiu prioritu — náhľad by sa neprejavil práve v tom obale, v ktorom formulár býva.
- **Neuložená voľba neprežije odchod z obrazovky.** Pri odídení sa vrátia pôvodné hodnoty; inak by človek videl farbu, ktorú v databáze nikto nemá, a hádal by, či je uložená.
- **Farba je jeden výpočet, nie dva** (`accentVars()` v `TenantHeader.tsx`). Náhľad ju nastavuje cez `setProperty()`, obal stránky do `style` atribútu — dva výpočty tej istej trojice by sa raz rozišli a náhľad by ukázal inú farbu, než sa uloží.
- **Ukážka na troch prvkoch**, na ktorých farba naozaj je: primárne tlačidlo (pozadie + biely text), chip filtra (`--accent-soft`) a odkaz v texte. Sú to `span`-y, nie tlačidlá — ukážka sa nesmie dať kliknúť ani chytiť klávesnicou. Premenné dostáva vlastným štýlom, takže ukazuje správne aj vtedy, keď živý náhľad nezaberie.
- **Vybraná dlaždica má prstenec vo vlastnej farbe** namiesto čierneho obrysu. Obrys je vidieť, ale nepovie nič navyše; prstenec ukáže odtieň druhýkrát mimo plochy, takže sa dá porovnať so susednými.
- **Slot na logo 96×96** s pruhovaným pozadím a monospace popisom. Je väčší, než logo v hlavičke (26 px), zámerne: na 26 px sa nedá posúdiť, či je obrázok orezaný alebo rozmazaný — a to je jediné, čo sa tu dá skontrolovať pred uložením. `alt` obrázka nie je prázdny na rozdiel od hlavičky: tam je logo ozdoba vedľa názvu, tu je to jediný spôsob, ako zistiť, aké logo je uložené.
- **Logo sa dá odstrániť.** `deleteBrand()` v `lib/branding.ts` existoval od začiatku, ale nemal volajúceho — organizácia sa teda loga nezbavila bez nás. Rovnaká polovica funkcie ako `fixes[]` a `trackId` predtým.
- **Maže sa obrázok aj odkaz naň.** Len odkaz by znamenal osirené binárky v `tenant_assets`, ktoré nikto nepočíta; len obrázok by nechal v hlavičke adresu vracajúcu 404.
- **Bez písania kódu organizácie**, na rozdiel od odstránenia prihlasovania kontom. Tam je následok nezvratný a okamžitý (ľudia sa prestanú dostať dnu), tu stačí nahrať logo znova. Obradnosť neúmerná následku učí ľudí preklikávať potvrdenia bez čítania — a potom ju prehliadnu aj tam, kde na nej záleží. Tlačidlo je preto vo vlastnom formulári pod čiarou, nie vedľa „Uložiť".
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, **973 testov** (4 nové nad `accentVars()`), obrazovka prekreslená na 390 px, na desktope aj v tmavej téme.


### Changed (2026-09-08 — „Opýtať sa": hero, karta odpovede, zdroje)

Krok 5c, tretia a posledná časť kroku 5. Je to najpoužívanejšia obrazovka systému, preto sa zmenilo len to, čo je vidieť — SSE, odosielanie ani prerušenie otázky sa nedotklo ani jeden riadok.

- **Pole na otázku má vlastnú kartu.** Doteraz „plávalo" priamo na pozadí stránky a nič nehovorilo, že práve toto je hlavná vec, ktorú tu človek robí. Odpoveď a hodnotenie zostávajú **mimo** karty: sú to následky, nie súčasť zadávania.
- Inline štýly textového poľa a príkladov nahradili triedy (`.ask-field`, `.ask-example`). Pole zostáva na **16 px** — pod 16 px iOS Safari pri fokuse priblíži celú stránku a tlačidlo „Opýtať sa" skončí mimo obrazovky.
- **Príklad je pilulka, nie `.stitok`.** Štítok je stav („publikované"), toto je ponuka na kliknutie — a ten rozdiel musí byť vidieť skôr, než sa naň ukáže myšou.
- **Karta odpovede dostala hlavičku „Odpoveď z vašich dokumentov."** Hovorí to, čo sa inak dá len tušiť: odpoveď je zostavená z dokumentov organizácie, nie z toho, čo model vie odinakiaľ. Pri chybe sa neukazuje — nad hláškou „nepodarilo sa" by to bolo tvrdenie o niečom, čo neexistuje.
- **Zdroje sú karty a keď zdroj nesie `sourceUrl`, je celá karta odkaz** (`target="_blank"`, `rel="noopener noreferrer"`). Doteraz sa na zdroj nedalo kliknúť vôbec. Karta bez adresy zostáva `div` — karta, ktorá vyzerá klikateľne a nič nerobí, je horšia než obyčajný riadok.
- **Rozsah hľadania a skóre zhody z návrhu sa nerobili** a sú zapísané v `docs/TODO.md` s tým, čo by si vyžiadali. Rozsahy („Knižnica / Intranet / Verejný web / Archív") v systéme neexistujú — prehľadáva sa jedna kolekcia jednej organizácie a jediné delenie je úroveň prístupu; pilulky by predstierali voľbu, ktorá nič nemení. Skóre vyhľadávanie vracia, ale pri `$rankFusion` a reranku nie je v rozsahu 0–1 ani porovnateľné medzi režimami hľadania — „zhoda 94 %" by klamala presnosťou.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, 969 testov, obrazovka prekreslená na 390 px, na desktope aj v tmavej téme.


### Fixed (2026-09-08 — knižnica padala na 500)

`/library` v produkcii nešla: SSR skončilo hláškou „Attempted to call
`normalizeLayout()` from the server but `normalizeLayout` is on the client".

- **Príčina.** `normalizeLayout()` bývalo vyexportované z `components/AppNav.tsx`,
  čo je klientsky komponent (`"use client"`). Z takého modulu nie je pre server
  funkcia, ale **odkaz na klienta** — zavolať sa nedá. Serverová `/library` ho
  pritom volá, aby z adresy určila variant navigácie.
- **Prečo to neodhalil ani `tsc`, ani testy, ani vývojový režim.** Typy sedia
  (je to obyčajná funkcia), test si ju importuje priamo (mimo Next.js) a vo
  vývojovom režime hranica server → klient tak prísna nie je. Zlyhá to až
  v produkčnom builde, za behu.
- **Oprava.** Čisté funkcie a typy navigácie sú v novom `lib/appNav.ts`, ktorý
  žiadnu direktívu nemá — importuje si ich server aj `AppNav.tsx`. Správanie
  ani jedna z nich nemení, sťahujú sa len o súbor nižšie.
- Pravidlo do budúcna: **čo potrebuje server aj klient, nesmie bývať v module
  s `"use client"`.** Zapísané v hlavičke `lib/appNav.ts`.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, 969 testov, produkčný build
  prejde a v serverových chunkoch po `normalizeLayout` nezostal klientský odkaz.


### Changed (2026-09-08 — nahrávanie dokumentu)

Druhá časť kroku 5.

- **Číslované sekcie, nie stepper.** Návrh má tri kroky (Súbor / Metadáta / Schválenie) a prepínanie medzi nimi. Lenže nahratie je **jedno odoslanie formulára** a schvaľovací krok v systéme neexistuje — sprievodca by sľuboval priebeh, ktorý sa nekoná, a tretí krok by nikam neviedol. Číslo pri nadpise dá tú istú orientáciu bez toho klamstva.
- **Zóna na pretiahnutie je `<label>` okolo skutočného `<input type="file">`.** Prehliadač doň súbor pustí sám, takže drag & drop funguje bez jediného riadku skriptu; vlastná zóna postavená na JavaScripte by bez neho nefungovala vôbec.
- Metadáta idú do mriežky, ktorá sa sama zalomí podľa šírky. Názov, kľúč a značky sú cez celú šírku — sú to dlhé hodnoty a v polovici stĺpca sa v nich zle číta.
- Polia, ich mená ani validácia sa nemenili; je to prekreslenie, nie zmena správania.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, 969 testov, obrazovka prekreslená na 390 px aj na desktope.

### Added (2026-09-08 — detail dokumentu: pravý panel a potvrdenia)

Prvá časť kroku 5 z handoffu `design_handoff_contineo_intranet`. **Editora sa to nedotklo** — originál vedľa Markdownu je fungujúca vec, ktorú návrh nerieši, a miešať ju do prekresľovania by znamenalo riskovať niečo, čo dnes ľudia používajú.

- **Koľko ľudí platné znenie potvrdilo** (`lib/libraryProgress.ts`). Spája tri veci, ktoré samé o sebe existujú, ale nikto ich nespájal: komu je znenie pridelené (`assignments`), kto to sú (`audienceMembers`) a kto potvrdil (`acknowledgements`).
- **Menovateľ sú pridelené osoby, nie celá organizácia.** Norma pridelená rozhodcom sa netýka ekonomiky; keby tam bola, percento by nikdy nedosiahlo sto a nič by nehovorilo. „67 % z pridelených" je veta, po ktorej sa dá niečo spraviť.
- **Publiká sa zjednocujú podľa osoby.** Ten istý človek môže byť v oddelení aj v skupine, ktorým je znenie pridelené — bez zjednotenia by sa v menovateli počítal dvakrát a percento by bolo nižšie, než je pravda.
- **Počíta sa len platné znenie.** Potvrdenie sa viaže na konkrétne znenie (D28); cez všetky verzie by sa sčítali ľudia, ktorí potvrdili niečo, čo dnes neplatí.
- **Zaokrúhľuje sa dole.** 199 z 200 je 99 %, nie 100 — pri dôkaznom zázname je ten jeden človek presne ten dôvod, prečo sa to celé robí. A keď nie je komu prideliť, nezobrazí sa nula percent, ale veta: nula by tvrdila, že nikto nepotvrdil.
- **Pravý panel je zhrnutie, nie ovládanie** — meniť sa dá vo formulári „Údaje o dokumente" vyššie. Na telefóne je pod obsahom: človek prišiel čítať dokument, nie metadáta.
- Pásik pod percentom je `aria-hidden` — je to obrázok toho istého čísla, nie druhý údaj, a čítačka by ho prečítala dvakrát.
- Je to **jeden dotaz navyše na stránku**. To isté číslo v stĺpci zoznamu zostáva odložené (`docs/TODO.md`) — tam by to bol dotaz na každý riadok.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, **969 testov prechádza** (4 nové), panel prekreslený na 390 px aj na desktope.

### Added (2026-09-07 — knižnica: hromadné akcie)

Krok 4e z handoffu `design_handoff_contineo_intranet`. Tým je krok 4 hotový celý.

- **Prideľovanie sa nepísalo druhýkrát.** `/hr/assign` už prideľuje N noriem × M publík s jedným spoločným dôvodom, dôvod má povinný (D30) a znenie bez platnosti odmieta (D6) — a už dnes číta predvybrané dokumenty z adresy. Knižnica preto výber len **odovzdá**: „Vyžiadať potvrdenie" nič nezapisuje, prenesie označené dokumenty na tú obrazovku. Druhá kópia pravidiel okolo dôkazných záznamov by sa raz rozišla s prvou.
- **Hromadný presun do priečinka** je cyklus nad tou istou `assignDocument()`, akú používa presun po jednom — kontroly aj audit zostávajú a nevzniká druhá cesta, ako sa dokument dostane do priečinka.
- **Dávka môže skončiť čiastočne a je to zámer.** Kolekcie sa v tomto projekte menia po zázname; transakcia naprieč dokumentmi by sem zaviedla nástroj, ktorý sa nikde inde nepoužíva. Preto sa na konci vypíše „presunuté 23 z 25" aj s tým, ktoré neprešli a prečo — ticho presunúť časť je horšie než nepresunúť nič.
- **Výber platí pre viditeľnú stranu.** Celá knižnica beží bez JavaScriptu, takže výber je stav formulára; prechod na inú stranu ho zabudne. Pri 25 riadkoch na stranu to na bežnú prácu stačí a je to čitateľnejšie než výber, ktorý sa neviditeľne vlečie naprieč filtrami.
- **Panel je vidieť stále**, nie až po označení — bez skriptu sa server nedozvie, či je niečo zaškrtnuté. Prázdny výber rieši akcia hlásením, nie skrytým tlačidlom.
- Po akcii sa človek vracia **na ten istý filter, triedenie aj stranu** (nesie sa v skrytom poli). Z formulára sa prijíma len cesta v knižnici — celá adresa by sa dala zneužiť na presmerovanie preč.
- Popisky zaškrtávacích políčok sú pre čítačku obrazovky, nie na obrazovku; skrývajú sa `clip-path`, nie `display: none`, ktorý by ich zahodil aj pre ňu.
- **Chyba, ktorú našiel render:** spodná hranica šírky stĺpca s názvom bola viazaná na `:first-child`, takže po pridaní stĺpca s políčkom sa presunula naň a tabuľka mala prázdnu tretinu vľavo. Teraz visí na triede.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, **965 testov prechádza** (6 nových).

### Added (2026-09-07 — knižnica: query builder)

Krok 4d z handoffu `design_handoff_contineo_intranet`. Tým je krok 4 hotový okrem hromadných akcií (4e), ktoré sú zápisy do dát a čakajú na rozhodnutie.

- **Podmienky sú nad facetmi, nie namiesto nich.** Facet odpovedá na „ktoré z týchto", podmienka na „všetko, čo spĺňa" — sú to dve otázky a preto dva nástroje. V dotaze sa spájajú: vybraný druh a zostavená podmienka platia naraz.
- **Nemieša sa „a" s „alebo".** Prototyp má spojku pri každom riadku, lenže `A alebo B a C` nemá bez zátvoriek jednoznačný význam a builder, ktorý si ho domyslí, vracia potichu iné výsledky, než človek čakal. Platí **jeden režim pre celý dotaz** — spĺňa všetky, alebo ktorúkoľvek — a je to na obrazovke napísané aj s dôvodom. Zátvorky sú samostatná úloha.
- **Celý builder beží bez JavaScriptu.** Podmienky sú v adrese (opakovaný kľúč `cond`), pridanie je odoslanie formulára, odobranie je odkaz. Zostavený dotaz sa dá poslať odkazom.
- **Pole a operátor sú jeden výber**, nie dva. „Názov obsahuje" je veta, ktorou to človek povie — a hlavne sa tak nedá zostaviť dvojica, ktorá nedáva zmysel („Zmenené obsahuje"). Ponuka vzniká z tabuľky povolených operátorov, takže nezmyselná kombinácia v zozname nie je a ručne upravená adresa ju neprepašuje.
- **Pridanie sa dokončí presmerovaním na čistú adresu.** Keby `add` a `value` zostali v adrese, každý ďalší odkaz by ich niesol a podmienka by sa pri návrate v histórii pridala druhýkrát.
- **Náhľad dotazu vetou** v monospace: je to kontrola, že človek a systém rozumejú tomu istému, a skladá sa z uložených podmienok, nie z rozpísaného formulára.
- Neplatný dátum sa **zahodí, nie použije** — `$lt: Invalid Date` nevráti nič a vyzeralo by to, že knižnica je prázdna. Text v „obsahuje" sa escapuje rovnako ako pri fulltexte.
- **Chyba, ktorú našiel test:** `encodeURIComponent` nechá vlnovku nezakódovanú, takže názov s `~` rozsekal podmienku na štyri časti a tá sa ticho zahodila. Dekódovanie teraz odreže prvé dva oddeľovače a zvyšok berie ako hodnotu.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, **959 testov prechádza** (16 nových), builder prekreslený na 390 px aj na desktope.

### Added (2026-09-07 — knižnica: kartový pohľad)

Krok 4c z handoffu `design_handoff_contineo_intranet`.

- **Karty ako druhý pohľad na ten istý zoznam.** Tabuľka zostáva predvolená, lebo v knižnici sa dokumenty porovnávajú; karty sú na prezeranie — názov dostane miesto na tri riadky a údaje idú pod neho, nie do stĺpca. Počet stĺpcov určuje šírka okna (`auto-fill` s `minmax(250px, 1fr)`), nie breakpoint, takže to sedí aj na tablete na šírku.
- **Prepínač sú dva odkazy, nie tlačidlá so skriptom.** Pohľad je súčasť adresy, takže sa dá poslať odkazom aj s ním a funguje bez JavaScriptu.
- **Do adresy sa píšu len karty** (`?view=cards`); tabuľka je predvolená a nezapisuje sa — rovnaké pravidlo ako pri triedení, aby dva odkazy na ten istý pohľad nevyzerali ako dva rôzne.
- **Prepnutie pohľadu nemení filtre, stranu ani triedenie.** Je to tá istá množina dokumentov, len inak nakreslená; zrušenie filtrov pohľad tiež necháva.
- V kartách nie sú hlavičky na triedenie — poradie sa nastaví v tabuľke a nesie sa ďalej, len sa v kartách nedá meniť klikom na stĺpec, ktorý tam nie je.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, **943 testov prechádza** (4 nové), karty prekreslené na 390 px aj na desktope.

### Added (2026-09-07 — knižnica: kompaktná tabuľka, triedenie a stránkovanie)

Krok 4b z handoffu `design_handoff_contineo_intranet`.

- **Tabuľka namiesto kariet.** V knižnici sa dokumenty porovnávajú — ktoré znenie platí, čo sa kedy zmenilo — a na to musia byť tie isté údaje pod sebou v stĺpci, nie rozsypané v každej karte inak. Stĺpce: dokument (s cestou priečinkov a identifikátorom pod názvom), druh, stav, platné znenie, zmenené. Kartový pohľad pribudne ako voľba (krok 4c).
- **Triedenie je v adrese** (`?sort=&dir=`), takže sa dá poslať odkazom aj zoradený pohľad. Kliknutie na stĺpec, podľa ktorého sa už triedi, obráti smer; iný stĺpec začne svojím predvoleným — pri texte A→Z, pri dátume najnovšie hore. Jednotný smer pre všetko by znamenal, že prvý klik na „Zmenené" ukáže najstaršie dokumenty. **Predvolené triedenie sa do adresy nepíše**, aby odkaz na ten istý pohľad vyzeral vždy rovnako.
- **Texty sa triedia po slovensky** (`localeCompare(…, "sk")`) — binárne porovnanie hodí „Čas" až za „Zima". Triedi a stránkuje sa nad načítanými riadkami, nie v databáze: zoznam sa aj tak ťahá celý, lebo cesta priečinkov aj označenie platného znenia vznikajú až v Node a v Monge sa podľa nich triediť nedá. Pri knižnici jednej organizácie sú to stovky riadkov.
- **Pri rovnosti rozhoduje názov, a vždy vzostupne.** Keby sa obrátil aj rozhodovač rovnosti, dva dokumenty s tým istým dátumom by si pri prepnutí smeru vymenili miesto bez zjavnej príčiny — test to odhalil.
- **Zmena filtra vracia na prvú stranu, triedenie nie.** Po zúžení filtra by človek skončil na piatej strane zoznamu, ktorý má strany dve, teda na prázdnej obrazovke vyzerajúcej ako „nič sa nenašlo". Strana za koncom vráti poslednú, nie prázdno.
- Pätička s **„Zobrazené X–Y z N"** je aj tam, kde je strana jediná — je to odpoveď na otázku, ktorú si človek kladie vždy, nielen keď sa stránkuje.
- Neznáme triedenie z adresy sa **zahodí, nie použije**: hodnota ide od kohokoľvek a ako názov poľa by sa ňou dala vypýtať vec, ktorá do zoznamu nepatrí.
- Tabuľka roluje vodorovne a prvý stĺpec má spodnú hranicu šírky — bez nej ho prehliadač na telefóne stlačí na tretinu a názov dokumentu spadne do štyroch riadkov.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, **939 testov prechádza** (11 nových), tabuľka prekreslená na 390 px aj na desktope, vo svetlej aj tmavej téme.

### Added (2026-09-07 — knižnica: faceted filtre s počtami)

Krok 4a z handoffu `design_handoff_contineo_intranet`. Krok 4 je rozdelený na päť častí, lebo ako jeden diff je nerecenzovateľný: **4a filtre**, 4b tabuľka a triedenie, 4c kartový pohľad, 4d query builder, 4e hromadné akcie.

- **Facety sú viachodnotové.** „Norma alebo smernica" je bežná otázka a jednohodnotový filter na ňu odpovedať nevie. V adrese je to opakovaný kľúč (`?category=norma&category=smernica`) — presne to, čo prehliadač pošle z formulára s viacerými zaškrtnutými políčkami, nie vlastný formát s čiarkami, ktorý by nikto iný neprečítal. Dotaz z nich skladá `$in`; jedna hodnota zostáva rovnosťou a **staré odkazy s jednou hodnotou ďalej fungujú**.
- **Počty pri hodnotách sa počítajú bez vlastného filtra.** Keby sa počítali s ním, po kliknutí na „Norma" by ostatné druhy mali nulu — a pritom práve to číslo o prepnutí rozhoduje. Rieši to jedna agregácia (`libraryFacets`) s `$facet`: kolekcia sa prechádza raz a každá vetva si priloží svoj `$match` bez tej podmienky, ktorú počíta.
- **`lib/libraryFilters.ts`** — filtre ako hodnota, nie ako reťazec v adrese: `readFilters` → `toggle`/`replace`/`clearFilters` → `toQuery`. Adresa zostáva zdrojom pravdy, takže pohľad sa dá poslať odkazom, otvoriť zo záložky a funguje bez JavaScriptu. Poradie kľúčov je pevné — dva odkazy na ten istý pohľad musia vyzerať rovnako, inak nesadnú na seba v histórii prehliadača.
- **Podmienky dotazu sa skladajú do `$and`** (`queryParts`), nie do jedného objektu: fulltext aj „nezaradené" používajú `$or` a v jednom objekte by si ho navzájom prepísali — jeden z filtrov by potichu prestal platiť. Test to stráži.
- **Oba stavy naraz nie sú filter.** Zaškrtnuté „publikované" aj „koncepty" znamená „všetko"; `$and` dvoch protikladov by nevrátil nič.
- **`MultiSelect` je nasadený na značky** — je ich rádovo viac než druhov a tridsať riadkov v paneli sa nedá prečítať. Pribudol mu prepínač tvaru skrytého poľa (`emit`): `csv` pre formulár záznamu (`FormData.get()` by z opakovaného kľúča vrátil len prvú hodnotu), `repeat` pre adresu. Vlastnú hodnotu tu pridať nemožno — filtrovať podľa značky, ktorú nikto nemá, znamená prázdny zoznam a hľadanie chyby v dátach.
- **Chips aktívnych filtrov** nad zoznamom: panel sa na úzkej obrazovke zabalí a človek by inak nemal ako vidieť, prečo je zoznam krátky. Krížik odoberá jeden filter, nie všetky.
- **Na telefóne sú najprv výsledky, potom panel na ich zmenu.** V jednom stĺpci by nad prvým dokumentom stál celý panel aj strom priečinkov — obrazovka a pol rolovania k tomu, po čo človek prišiel. Zásuvka z návrhu potrebuje JavaScript a je to krok 7; toto je poradie v mriežke a funguje bez neho.
- Hlavička ukazuje **„N z M dokumentov"** — bez toho čísla sa nedá rozoznať, či je krátky zoznam výsledok filtra alebo stav knižnice.
- `TreeWithOrder` prijíma skryté polia aj ako zoznam dvojíc; v objekte sa viachodnotový filter nezmestí (`Object.fromEntries` by z troch značiek nechal jednu). Volanie v nastavení organizácie sa nemenilo.
- Terminológia: panel používa **„Druh" a „Značka"**, ako hovorí zvyšok aplikácie — nie „Kategória" a „Štítok" z prototypu.
- **Čo v dátach nie je a preto sa nerobilo:** facet „Oddelenie" (dokument oddelenie nenesie, pridelenie je v `assignments`), stĺpec „Potvrdenia %" (agregácia nad potvrdeniami pre každý riadok) a stavy „Na schválenie" a „Expirovaný" (schvaľovací workflow v knižnici neexistuje). Sú to samostatné rozhodnutia, nie prílepok k filtrom.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, **928 testov prechádza** (19 nových), panel prekreslený na 390 px aj na desktope, vo svetlej aj tmavej téme a s farbou tenanta.

### Added (2026-09-07 — aplikačný shell, opt-in)

Krok 2 z handoffu `design_handoff_contineo_intranet`, ale **inak, než návrh žiadal**.

- **`layout.tsx` zostáva nedotknutý.** Návrh chcel prepnúť globálny obal z `.obal` (max 900 px) na aplikačný shell. Ten obal však nesú všetky stránky — `/documents`, `/hr`, `/people`, `/admin`, `/golden-set` — a sú na tú šírku postavené; globálna zmena by ich rozbila všetky naraz. Shell je preto **opt-in**: `components/AppShell.tsx` si vyžiada stránka sama. Prvá a zatiaľ jediná je `/library`. Ostatné sa presúvajú po jednej, každá vlastným PR, a kým sú mimo shellu, fungujú presne ako dnes.
- **`components/AppNav.tsx`** — navigácia v dvoch variantoch (`sidebar`, `topbar`), jeden komponent a rozdiel len v CSS. **Mobile first doslova:** oba varianty sú na úzkej obrazovke ten istý vodorovný pás, ktorý sa dá posunúť prstom; bočným panelom sa `sidebar` stáva od 760 px, na tej istej hranici, kde sa rozbaľuje menu v hlavičke. Bočný panel na 360 px by zabral tretinu šírky a obsahu nechal stĺpec, do ktorého sa nezmestí ani názov dokumentu.
- Aktívna položka na páse sa **doroluje do výrezu** — inak človek na telefóne nevidí, kde je. Posúva sa vlastný `scrollLeft` pásu, nie `scrollIntoView()`: ten hýbe aj stránkou a pri načítaní by ju stiahol pod hlavičku.
- **Položky sú skutočné routy podmienené rolami**, nie zoznam z prototypu: odkaz na neexistujúcu obrazovku vedie na 404 a odkaz do sekcie, kam človek nesmie, mu prezrádza, čo v systéme je. Príznaky rolí si `AppShell` zisťuje tými istými funkciami, ktoré rozhodujú aj o samotných stránkach — druhá kópia pravidla „kto smie kam" je horšia než pár dotazov navyše. Správcovské odkazy zostávajú pod avatarom v hlavičke, kde sú dnes.
- **Ikony navigácie zatiaľ nie sú.** Prototyp má na ich mieste textové znaky (▦ ▤ ⌕), tie do produkcie nepatria, projekt vlastný ikonový set nemá a kresliť šesť nových od ruky handoff zakazuje. Rovnako zatiaľ **nie sú badge čísla** — každé je dotaz do databázy a patria k prehľadu, ktorý ešte neexistuje.
- **Prepínač organizácie sa nerobil.** Tenanta určuje hostiteľ (D29) — jedna doména, jedna organizácia — takže v produkcii by to bolo tlačidlo predstierajúce schopnosť, ktorú systém nemá. V prototype je ako ukážka multitenantu; správca platformy prepína organizácie cez `/admin`.
- **Variant navigácie je zatiaľ len z adresy** (`?layout=sidebar`, predvolený `topbar`) a nesie sa ďalej spolu s filtrami. Uložiť ho na osobu alebo organizáciu znamená zmenu schémy — samostatné rozhodnutie s vlastnou migráciou.
- **`Header` skrýva svoje menu na stránkach v shelli** (`lib/shellRoutes.ts`), inak by na `/library` boli dve navigácie nad sebou. Zhoda je **presná, nie na prefix**: `/library/new` v shelli ešte nie je a prefix by mu menu zobral a nič nedal. Osobné menu pod avatarom zostáva všade — sú v ňom nastavenia, téma a odhlásenie, ktoré shell nemá.
- `/library` zahodila `.obal` s max. 900 px: je to zoznam, ku ktorému v kroku 4 pribudne panel filtrov vedľa, a na 900 px sa vedľa seba nezmestia.
- Aktívna položka je **prvý skutočný odberateľ `--accent-soft`** z predchádzajúceho kroku — farbu organizácie nesie naznačenú, nie plnú.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, **909 testov prechádza** (10 nových), oba varianty prekreslené na 390 px aj na desktope, vo svetlej aj tmavej téme a s farbou tenanta.

### Added (2026-09-07 — dizajnové tokeny a viacnásobný výber)

Prvé dva kroky z dizajnového handoffu `design_handoff_contineo_intranet` (návrh intranetu, knižnice a inteligentných zoznamov). Obidva sú **aditívne** — žiadna existujúca obrazovka nemení vzhľad ani správanie a dajú sa mergnúť samostatne.

- **`--accent-soft`** — hlavná farba s 11 % alfou. Je to jediný nový farebný token a patrí tam, kde má byť farba organizácie len naznačená: chip aktívneho filtra, aktívna položka navigácie, označený riadok tabuľky. Priehľadnosť, a nie predpočítaný svetlý odtieň, preto, že podklad pod ním nie je vždy rovnaký (`--surface` v karte, `--bg` v pätičke) a v tmavej téme je opačný. Tenantovi ju skladá `tenantStyle()` cez novú `soft()`; pri nečitateľnej farbe sa premenná vôbec nenastaví a platí predvolená — pokazená hodnota by zahodila aj tú.
- **Hustota rozhrania** — šestica premenných (`--pad-main`, `--card-pad`, `--list-py`, `--gap`, `--row-py`, `--font-row`) prepínaná atribútom `html[data-density="comfortable"]`, nie druhá sada tried. Duplikované triedy by znamenali, že každý nový prvok treba napísať dvakrát, a raz sa na to zabudne. Kompaktné je predvolené: knižnica dokumentov je pracovný nástroj, kde rozhoduje, koľko riadkov je vidieť naraz.
- **`darken(hex, 0.16)` zostáva nezmenený.** Handoff navrhoval 0,24; zmena koeficientu by potichu prekreslila hover stavy u všetkých existujúcich tenantov.
- **`components/MultiSelect.tsx`** — viacnásobný výber s hľadaním. `TagSelect` vypíše všetky možnosti naraz, čo pri skupinách osôb stačí, ale pri oddeleniach a štítkoch knižnice nie: tridsať pilulák je stena, v ktorej sa nedá nič nájsť. Tu sú zvolené hodnoty vidieť ako chips a ostatné sa hľadajú písaním — **bez diakritiky**, lebo kto píše „oddelenie", myslí „Oddelenie". Ponúka aj hodnotu, ktorú má už len tento jediný záznam, inak by ju uloženie ticho odstránilo (rovnaký dôvod ako v `TagSelect`).
- **Normalizácia je `trim().toLowerCase()`, teda presne `normalizeKeys()` na serveri.** Handoff navrhoval nahrádzať medzery podčiarkovníkom — server to nerobí, takže by pre tú istú vec vznikli dve hodnoty a jedna by nikdy nikomu nesadla. Test to porovnáva priamo so serverovou funkciou a uzatvára kruh cez `splitList()`.
- Zo `Select.tsx` prevzaté zámerne: výber na `onMouseDown` s `preventDefault()` (pri `onClick` zatvorí zoznam poslucháč „klik mimo" skôr, než sa hodnota vyberie), `<noscript>` s obyčajným poľom rovnakého mena a ovládanie klávesnicou. Rozmery sedia s `.vyber`, nie s prototypom: obe polia stoja na tom istom formulári vedľa seba.
- **Nové CSS triedy sú anglické** (`.multiselect-*`, `.is-highlighted`). Zvyšných 125 tried v `globals.css` je zatiaľ slovenských — angličtina v nich je posledná vrstva, na ktorú sa po identifikátoroch, routách a názvoch indexov ešte nedostalo; premenovanie patrí do vlastného PR, nie sem.
- **Komponent zatiaľ nikde nie je nasadený.** Nasadenie na oddelenia, štítky a osoby mení existujúce formuláre a patrí do vlastného PR.
- Overené: `tsc --noEmit` čisto, `eslint` bez chýb, **899 testov prechádza** (13 nových).

### Fixed (2026-09-06 — skripty vedia znova spustiť TypeScript zo `src/`)

- **`smoke.mjs` bol od 28. 8. nespustiteľný.** Vtedajšie bezpečnostné upratovanie odstránilo `esbuild` z devDependencies a s ním aj bundlovanie, na ktorom skript stál. Nevšimlo sa to, lebo `smoke.mjs` nie je súčasťou `npm test` — spúšťa sa ručne. Opravené **bez vrátenia závislosti**: skript teraz importuje moduly zo `src/` priamo a beží cez `scripts/lib/ts-hook.mjs`, rovnako ako `status`, `tenant` či `persons:import`. Pribudol `npm run smoke`.
- **Typové importy sú označené ako typové.** Node pri spúšťaní TypeScriptu iba odstraňuje typy — nevie, že `ChunkResult` je interface, a `import { ChunkResult }` sa preto pokúsi vykonať za behu. Trinásť súborov v `src/lib` prepísaných na `import type`; kde sa v jednom importe miešali typy s triedou `ProviderConfigError`, import sa rozdelil. Pri `isolatedModules: true` je to aj tak odporúčaný tvar, takže pre `tsc` ani Next sa nemení nič.
- **`EmbeddingSpaceMismatchError` už nepoužíva parameter properties** v konštruktore. Tie nie sú len typový zápis — musia sa transformovať na kód, čo odstraňovanie typov nerobí. Polia sa priraďujú výslovne; správanie identické.
- Overené: `npm run type-check` čisto, **865 testov prechádza**, `npm run lint` bez chýb, `npm run smoke` prejde celou reťazou nad 581 chunkami.

### Added (2026-09-06 — porovnanie rerank modelov)

- **`scripts/rerank_compare.mjs`** — zmeria, **o koľko** sa od seba líšia rerank modely (prekryv top-K, zhoda na prvom mieste, zhoda celého poradia), a každý z nich aj proti poradiu bez reranku. Kvalitu **nemeria a merať nemôže**: zlatá sada D9 má zatiaľ prázdne `goldChunkIds`, takže neexistuje pravda, voči ktorej by sa porovnávalo. Skript má povedať jedinú vec — či sa výberom modelu vôbec oplatí zaoberať, kým sada nie je vyplnená.
- Overené na Atlase (cluster 9.0.0, FCV 8.3): `$rankFusion` aj `$rerank` fungujú a stage prijme `rerank-2`, `rerank-2.5`, `rerank-3` aj ich `-lite` varianty. Skupinové limity sú spoločné, takže prechod na novší model nestojí žiadnu kapacitu. Skóre z rôznych rerankerov sa **navzájom porovnávať nedajú** — každý má vlastnú kalibráciu.


### Changed (2026-08-30 — kód, príkazy, adresa aj databáza po anglicky)

- **Identifikátory v kóde sú anglické, komentáre a texty pre používateľa slovenské.** Dôvod je praktický: celý ekosystém okolo (Next, Mongo, typy, chybové hlášky) je anglický a miešanie znamenalo prekladať medzi kódom a databázou v každom druhom riadku (`Oddelenie` verzus `departments`). Pravidlo je zapísané v `CLAUDE.md`, nech sa to neopravuje znova.
- Premenovanie prebehlo cez jazykový server TypeScriptu (`findRenameLocations`), nie hľadaj-nahraď: menili sa skutočné symboly, nie výskyty v komentároch a v slovenských textoch. Spolu ~2 300 identifikátorov a názvov polí.
- **Výstup chunkera sa nezmenil ani o bajt** — overené na desiatich vzorkových dokumentoch pred aj po. Potvrdenia sa teda nemajú prečo rozísť.
- **`npm run` príkazy a súbory v `scripts/`**: `kontrola` → `check`, `stav` → `status`, `domeny` → `domains`, `osoba` → `person`, `verzie` → `versions`, `platnost` → `validity`, `utvary` → `departments`, `subory:doplnit` → `files:attach`.
- **Kľúče a hodnoty v adrese** sú anglické (`?zalozka=clenenie` → `?tab=chunking`). **Staré odkazy fungujú ďalej** — prekladajú sa cez tabuľku v `lib/urlParams.ts`, pri čítaní stránky aj pri návrate zo serverovej akcie. Zmizne, keď staré odkazy prestanú chodiť.
- **Migrácia databázy** (`npm run migrate:fields`): názvy polí aj tie hodnoty, ktoré sú v skutočnosti identifikátory — `audit.predmet: "oddelenie"` → `subject: "department"`, `akcia: "zalozene"` → `action: "created"`. Spravilo sa to teraz, kým sú v databáze desiatky dokumentov a ani jedno potvrdenie; o rok by to bola úplne iná operácia. Skript zálohuje dotknuté kolekcie do `data/backup/<čas>/` a bez zálohy nezapisuje.
- Staré indexy auditu (`podla_casu`, `podla_predmetu`, `podla_ciela`) sa zrušili a nahradili `by_time`, `by_subject`, `by_target` — kľúčovali podľa polí, ktoré po migrácii neexistujú.

### Added (2026-08-30 — poradie aj pre priečinky knižnice)

- **Priečinky knižnice majú vlastné poradie** (D60), rovnako ako oddelenia: ťahanie myšou v rámci úrovne, šípky hore/dole ako cesta bez JavaScriptu, čiary hierarchie. Priečinky sú usporiadanie, ktoré si niekto premyslel — „Normy" pred „Internými smernicami", nie naopak preto, že I je pred N.
- **Jeden komponent na obidva stromy.** Dva by znamenali, že sa jeden z nich raz začne správať inak a nikto nebude vedieť, ktorý je ten správny. Preusporiadanie si so sebou nesie filtre, v ktorých človek práve je — inak by ho po uložení hodilo na iný pohľad.
- „Všetky dokumenty" a „Nezaradené" do preusporadúvania nepatria: nie sú to priečinky, ale pohľady na celý zoznam.

### Added (2026-08-30 — poradie oddelení a čiary hierarchie)

- **Vlastné poradie medzi súrodencami (D60).** Organizačná schéma nie je abecedný zoznam: prezident stojí nad výkonným výborom bez ohľadu na to, ako sa volajú. Kto poradie neurčí, má naďalej abecedu — nemuselo sa nič migrovať a miešaný stav je zámerný, lebo prinútiť organizáciu očíslovať celý strom skôr, než presunie jednu položku, by bolo horšie než dočasná nedôslednosť.
- **Presúvanie ťahaním myšou** v rámci jednej úrovne. **Ťahať sa dá len medzi súrodencami** — pretiahnuť oddelenie inému rodičovi by bola zmena štruktúry maskovaná ako preusporiadanie, a práve to je pohyb, ktorý sa myšou spraví omylom; na zmenu nadriadeného zostáva samostatný výber.
- **Šípky hore/dole pri každej položke** ako rovnocenná cesta: obyčajný formulár, funguje bez JavaScriptu, ovláda sa klávesnicou a na telefóne sa trafí ľahšie než ťahanie prstom. Na dotykových obrazovkách sa úchop na ťahanie ani neponúka — bil by sa s posúvaním stránky.
- **Poradie sa zapíše až tlačidlom**, nie po každom pustení: ťahanie po zozname je hľadanie miesta, nie sedem rozhodnutí, a sedem zápisov v audite by z histórie spravilo šum.
- **Čiary hierarchie** v strome. Bez nich je hlbší strom len zoznam s medzerami naľavo a odsadenie sa musí merať očami.

### Changed (2026-08-30)

- **Jedno hlásenie na všetky uloženia** — „Zmeny boli uložené." Každá akcia mala vlastnú vetu a bola to zbytočná príležitosť pomýliť sa v skloňovaní; po premenovaní z toho vzniklo „Oddelenie pribudol." Vlastnú vetu si nechávajú len akcie, ktoré hovoria niečo, čo z obrazovky vidieť nie je (napríklad že treba nastaviť CNAME).
- Preklad starého kľúča záložky je teraz **jedna tabuľka na jednom mieste** — potrebuje ho stránka pri čítaní adresy aj serverová akcia pri návrate. Dve kópie sa hneď aj rozišli: hromadné premenovanie CSS tried prepísalo `utvary` aj v tej druhej.

### Fixed (2026-08-30)

- **Zakladanie oddelenia hlásilo chybu, hoci sa oddelenie vytvorilo.** `redirect()` v Nexte vyhadzuje výnimku a v mojich nových akciách bolo volanie na ceste úspechu **vnútri `try`**, takže ho zachytil vlastný `catch` a ohlásil ako neúspech. Je to najhorší druh chyby: hlási neúspech tam, kde bol úspech, takže sa akcia opakuje a vzniknú duplicity. Týkalo sa to trinástich akcií v nastavení organizácie (oddelenia, číselníky, členenie, domény). Rozoznanie presmerovania je teraz **jedna funkcia na jednom mieste** — nie `"digest" in e` rozpísané v každej akcii, čo by navyše zožralo aj `notFound()`.

### Changed (2026-08-30)

- **„Útvar" sa premenoval na „Oddelenie"** v celom rozhraní aj dokumentácii. Je to štandardnejšie pomenovanie pre organizačnú štruktúru; databázové polia (`departmentId`, `departmentPath`, kolekcia `departments`) sa nemenili — je to len pomenovanie, nie zmena významu.
- **Aj kľúč záložky v adrese** (`?zalozka=utvary` → `oddelenia`), predmet v audite a názvy CSS tried. Starý kľúč záložky sa **prekladá, nie presmerováva**: odkazy s ním existujú v záložkách prehliadača a presmerovanie by ich rozbilo; zmizne, keď prestane chodiť. Dva staré audítorské záznamy sa prepísali jednorazovým skriptom — dva rôzne kľúče pre tú istú vec by znamenali, že filter na oddelenia časť histórie nenájde. CSS triedy dostali neutrálne `.strom-*`, lebo ich medzitým používajú aj priečinky knižnice a číselníky.

### Added (2026-08-30 — pôvodné súbory a hromadné preindexovanie)

- **Pôvodné PDF doplnené k deviatim normám SFZ** (`npm run files:attach`). Prišli do systému ako `.md` z ručného prevodu, ale PDF sme mali celý čas v repozitári — bez nich sa v editore nedalo porovnať text s originálom. Text sa pritom **nedotkol**: skript pripája súbor, neprevádza dokument. Priradenie je vypísané ručne, nie hádané z názvu súboru — uhádnuté priradenie by pripojilo cudzie PDF k norme, čo je horšie než žiadne. V zázname o prevode je poctivo napísané, že text nevznikol prevodom toho PDF.
- **Hromadné preindexovanie** v záložke Členenie. Ukazuje, koľko dokumentov by nový profil narezal inak — počítané naozajstným narezaním, nie odhadom, lebo inak sa nedá povedať, či zmena parametra na tomto obsahu vôbec niečo spraví. Spracuje najviac 25 naraz: pád na časovom strope uprostred by nechal časť dokumentov narezanú po starom. Opakovanie je lacné, hotové sa preskočia.

### Changed (2026-08-30 — identita znenia oddelená od členenia)

- **`versionId` sa počíta z textu, nie z chunkov (D57).** Doteraz z chunkov — a keďže sa naň viažu potvrdenia, vyladenie chunkera by stovke ľudí ukázalo, že normu nemajú potvrdenú, hoci sa v nej nezmenilo ani slovo. Jedno číslo nieslo dve rôzne veci: text normy je právny artefakt, členenie na úseky technický. Úseky teraz nesú vlastné `chunkingId` (verzia chunkera + profil + výsledok), takže je stále vidieť, kedy treba preindexovať.
- **Označenie ani dátum platnosti do identity nevstupujú** — preklep sa musí dať opraviť bez toho, aby sa rozbili potvrdenia.
- **Preindexovanie bez novej verzie.** V detaile dokumentu; nareže platné znenie znova podľa aktuálneho profilu, `versions[]` sa nedotkne a potvrdenia zostávajú.
- **Oprava údajov znenia.** Pri zmene dátumu na znení, ktoré už niekto potvrdil, obrazovka odmietne uložiť bez rozhodnutia: oprava zápisu, alebo podstatná zmena vyžadujúca nové potvrdenie. Dôvod je povinný. Potvrdzovacia formulka obsahuje dátum doslovne — ticho ho opraviť pod podpísaným záznamom by z auditu spravilo niečo, čo sa dá spätne meniť.
- **Migrácia spustená**: 10 znení, 581 úsekov, 0 potvrdení. Robilo sa to teraz práve preto, že potvrdení je nula.

### Added (2026-08-30 — profil členenia a kontrola konzistencie)

- **Profil členenia per organizácia (D58)** v `/organizacia`, záložka **Členenie**: slovo článku a prílohy, prah na hlavičky, cieľová veľkosť úseku. Jeden algoritmus, parametre navonok — vlastný chunker per zákazník by znamenal N kópií jedného pravidla a chyba v jednej by sa prejavila tým, že model odcituje nesprávny článok o pol roka.
- **Konfiguruje sa slovom, nie regulárnym výrazom**, a čísla sa držia v rozumnom rozsahu. Vzor od zákazníka je vec, ktorú nikto neodladí — a spôsob, ako jedným zápisom zavesiť spracovanie dokumentu.
- **Predvolený profil reže presne tak ako doteraz** — overené porovnaním na všetkých desiatich vzorových dokumentoch (10 zhôd, 0 rozdielov).
- **`npm run check` (D59)** — overí, že aktívne úseky ukazujú na existujúce znenia, že dokument nemá dve aktívne členenia, že potvrdené znenie má text, že publikované znenie má úseky, že model vektorov sedí a že cesty priečinkov súhlasia. Nič neopravuje: oprava je vždy rozhodnutie. Prvý beh našiel skutočný nález (testovací dokument bez úsekov).
- 12 nových testov (spolu 778).

### Added (2026-08-30 — knižnica: priečinky, filtre, WYSIWYG, vlastné číselníky)

- **Virtuálne priečinky (D56).** Strom s rovnakým tvarom ako oddelenia — dokument je práve v jednom, filter nájde aj to, čo je v podpriečinkoch. „Virtuálne" znamená, že sa nič nepresúva: súbor leží v GridFS a text v `documents`, priečinok je len zaradenie, ktoré sa dá kedykoľvek zmeniť. Zrušiť sa dá len prázdny priečinok bez podpriečinkov.
- **Filtrovanie a hľadanie** nad knižnicou: priečinok, druh, značka, stav (publikované / koncepty) a fulltext v názve a kľúči. Filtre sa nesú v adrese aj vo formulároch — po založení priečinka sa človek nevráti na nefiltrovaný zoznam.
- **Vlastné číselníky organizácie (D55).** Druhy dokumentov a značky si zákazník spravuje sám v `/organizacia`, záložka **Číselníky**; dovtedy ich musel dopísať vývojár do repozitára a nasadiť. Základné hodnoty zostávajú v ponuke vždy — je nimi otagovaný existujúci obsah. Odobratie vlastnej položky ju odstráni **len z ponuky**; dokumenty, ktoré ju majú, si ju nesú ďalej, lebo prepisovať cudzí obsah kvôli upratovaniu číselníka by bola tichá zmena dát. `scope`, `accessLevel` a `language` zostávajú globálne a uzavreté — sú to filtre, na ktorých stojí prístup.
- **WYSIWYG editor (D54).** Správca obsahu je legislatívec, nie vývojár; v surovom Markdowne buď nechá členenie tak, ako ho vypľul prevod, alebo ho pokazí. Uložený tvar zostáva Markdown — z neho žije chunker aj potvrdzovanie — takže vizuálny režim je pohľad na ten istý text a prepínač je rovnocenný, nie „pokročilé nastavenie".
- **Úprava údajov o dokumente** priamo v detaile: názov, pôsobnosť, prístupnosť, jazyk, druh a značky. Zmena filtrov sa prepíše **aj do úsekov** — bez toho by sa prejavila v knižnici, ale vyhľadávanie by ďalej filtrovalo podľa starých hodnôt. Kľúč a organizácia sa meniť nedajú: tvoria `documentId`, ktorý je v úsekoch, prideleniach aj potvrdeniach.
- Indexy pre `cms_folders` a filtre nad `documents`.
- 10 nových testov (spolu 766).

### Fixed (2026-08-30)

- **Editor knižnice sa pri normách z importu otváral prázdny.** Čítal `draftMarkdown ?? markdown`, ale dokumenty naimportované skriptom nemajú ani jedno — text si nesie len položka vo `versions[]`. Vyzeralo to, akoby sa norma stratila. Text sa teraz berie v poradí koncept → platné znenie → najnovšie zapísané.

### Added (2026-08-30 — knižnica dokumentov)

- **`/kniznica` (D53).** Normy sa dovtedy dostávali dnu len príkazovým riadkom — `.md` plus `.meta.json` pripravené vývojárom — takže si zákazník novelu nevedel nahrať sám. Teraz: zoznam s filtrami, detail s históriou znení, nahratie súboru s formulárom metadát namiesto `.meta.json`.
- **Prevod docx, PDF, xlsx a textu do Markdownu beží v aplikácii.** Typ sa určuje z obsahu aj prípony, nie z toho, čo tvrdí prehliadač. Staré `.doc` a `.xls` sa odmietnu s návodom, čo s nimi.
- **Jazykový model je druhý krok, ktorý vyvolá človek** — nikdy nie tichý ústup po zlyhaní prevodu. Norma je text, podľa ktorého ľudia konajú; model vie potichu preštylizovať vetu a nikto si toho nemusí všimnúť, lebo výsledok vyzerá lepšie než vstup. Volá sa kliknutím v editore (prečistiť členenie / prepísať sken) a jeho výstup sa ukladá **ako návrh vedľa konceptu**, nie doňho.
- **Skenované PDF sa neprevádza ticho.** Prevod povie, že v súbore nie je text, a ponúkne prepis modelom — text, ktorý vyzerá správne a nie je, je pri norme horší než chýbajúci dokument.
- **Editor ukazuje originál vedľa Markdownu.** Rozdiel medzi „vyzerá to dobre" a „je to naozaj to, čo je v norme" sa dá zistiť len porovnaním, a človek, ktorý musí prepínať okná, ho neurobí.
- **Nahratie nič nepublikuje.** Technický stav je oddelený od kurátorského a chunky vznikajú až pri publikovaní. Publikovanie pýta **označenie znenia, dátum platnosti a citáciu, odkiaľ dátum je** — dovtedy to skript dopĺňal ako „1.0" pri všetkých deviatich normách, čo je vymyslené číslo, ktoré sa objavuje doslovne v každom zázname o potvrdení.
- **Pôvodný súbor sa nemaže a leží v GridFS** v tej istej databáze; ďalšie úložisko by znamenalo ďalší token a ďalšie miesto, kde žijú údaje zákazníka. Cesta k nemu je neverejná — vyžaduje rolu aj zhodu organizácie.
- **Nová rola `spravca-obsahu`**, oddelená od `hr`: kto normy prideľuje, nie je nutne ten, kto ich píše.
- **`chunker.mjs` sa presunul do `src/lib/` bez jediného zásahu do kódu** (typy sú vedľa v `.d.ts`), takže obrazovka aj `import.mjs` režú rovnako. Prepis do TypeScriptu by bol stovky mechanických zmien v algoritme, ktorý sa meniť nemá.
- 21 nových testov (spolu 756).

### Added (2026-08-30 — údaje z adresára)

- **Meno, oddelenie, pozícia, jazyk a fotografia z Microsoft Graphu (D52).** Osoba založená automaticky (D47) sa dovtedy v zozname volala rovnako ako jej adresa a personalista ju musel prepísať ručne — hoci ten údaj bol v adresári zákazníka celý čas. Meno a priezvisko sa berú zvlášť; `displayName` je až záloha, lebo v niektorých adresároch je v tvare „Priezvisko, Meno (oddelenie)" a to sa v zozname číta zle.
- **Dopĺňa sa, neprepisuje.** Adresár nie je nadriadený personalistovi: kto meno alebo oddelenie opraví v `/osoby`, o tú opravu ďalším prihlásením nepríde. Výnimka je meno rovné adrese — tak vyzerá osoba, ktorej meno nebolo odkiaľ vziať, a to sa berie ako chýbajúce.
- **Do Graphu sa ide len vtedy, keď naozaj niečo chýba.** Väčšina prihlásení je opakovaná; bez tejto podmienky by každé platilo dve cudzie požiadavky za nič.
- **Zlyhanie Graphu nikdy nezablokuje prihlásenie** — štvorsekundový strop na obe požiadavky a celé v `try`. Osoba bez fotky je nepríjemnosť, človek zamknutý vonku je porucha.
- **Prihlasovanie cez Microsoft si teraz pýta aj `User.Read`.** S predvolenými rozsahmi Graph odpovie 403 aj na fotku, ktorú si next-auth ťahá sám. Je to najzákladnejšie delegované oprávnenie Entry, schvaľuje si ho používateľ sám a k nikomu inému neotvára prístup; keď ho aplikácia zákazníka nemá, do logu ide menovitá hláška a zvyšok funguje.
- **Avatar v hlavičke ukáže fotku, keď ju človek má** — inak zostanú iniciály. Fotka je uložená vo vlastnej kolekcii (ten istý dôvod ako pri logu: záznam osoby sa číta pri každej požiadavke) a servíruje sa **neverejnou** cestou: vyžaduje prihlásenie a zhodu organizácie, lebo je to osobný údaj, nie značka.
- Pozícia (`jobTitle`) pribudla aj do formulára osoby, aby sa dala opraviť.
- 7 nových testov (spolu 735).

### Added (2026-08-29 — audit a história skupín)

- **Audit správcovských zmien (D51).** Nová kolekcia `audit`: kto, čo a kedy zmenil — osoby (rola, stav, adresa, oddelenie, skupiny, trasy), oddelenia, pridelenia, nastavenie organizácie, domény a prihlasovacie údaje. Doteraz sa zapisovalo len `updatedBy`, čo odpovedá na „kto to menil naposledy" a na nič viac; kto komu udelil rolu `hr` alebo kto vymenil tajomstvo Entry, sa po druhej zmene už nedalo zistiť. Pri systéme, ktorý má dokazovať oboznámenie s predpismi, je to diera na nesprávnom mieste — kto si vie zmeniť rolu, vie si zmeniť publikum.
- **Zapisuje sa rozdiel, nie celý objekt.** Inak by v zázname o zmene jazyka bolo aj meno, adresa a všetky skupiny — po roku by sa v tom nedalo nič nájsť a bola by to zbytočná kópia osobných údajov. Odvodené polia (cesta oddelenia, histórie) sa do rozdielu neberú.
- **Tajomstvá sa nezapisujú nikdy** — pri poli so `secret`, `token`, `heslo` alebo `tajomstvo` v názve je v zázname len „(zmenené)". Audit, ktorý zbiera heslá, je sám o sebe únik, a to s dlhšou retenciou než to, čo chráni.
- **Zápis auditu nikdy nezhodí samotnú zmenu.** Jeden pokazený index by inak zablokoval správu osôb celej organizácii; zlyhanie sa loguje. Volá sa po úspešnej zmene, nie pred ňou.
- **Vidí ho správca osôb vo svojej organizácii** (`/organizacia`, záložka Audit, s hľadaním) **a správca platformy pri každom tenantovi** (posledných 50 v `/admin/tenanti/<KOD>`) — kvôli podpore. Ten istý komponent na oboch miestach, aby jeden z nich o pol roka neukazoval niečo iné.
- **Skupiny dostali históriu členstva.** Pôvodné odôvodnenie, že sa menia vedome a jednotlivo, neobstálo: skupina je najčastejší adresát noriem (rozhodcovia, delegáti, štatutári), takže kto z nej vypadol pred potvrdením, mizol zo zoznamu nepotvrdených presne tak ticho ako predtým pri oddeleniach. Platí teraz to isté pravidlo ako pri oddeleniach — vrátane toho, že návrat do skupiny je nový úsek, nie oživenie starého. Zapisuje sa aj pri CSV importe, ktorý je najčastejšia hromadná zmena.
- Indexy pre `audit` a históriu skupín v `onboarding_init.mjs`.
- 12 nových testov (spolu 728).

### Added (2026-08-29 — reorganizácia)

- **Úloha z oddelenia platí odo dňa príchodu (D50).** Kto do oddelenia pribudne, jeho staršie pridelenia dostane — to je zámer — ale s dátumom svojho zaradenia. S pôvodným dátumom by mal nováčik prvý deň v práci úlohu spred roka, teda hneď po termíne, a bez príznaku „nové", lebo pridelenie je staršie než jeho predošlé prihlásenie. Osoba preto nesie históriu zaradení. Prázdna história znamená „odjakživa", nie „nikdy" — ľuďom zapísaným pred zavedením štruktúry by inak všetky staré normy zmizli.
- **Presun celej vetvy nie je príchod.** Keď sa oddelenie presunie pod iného rodiča, ľuďom sa opraví cesta, ale záznam histórie sa neotvára — inak by to vyzeralo, že do svojho oddelenia práve prišli všetci naraz.
- **Kto odíde bez potvrdenia, zostane v prehľade** označený *už nie je v oddelení*. Ticho by inak vypadol a nikto by sa nedozvedel, že sa to nedoriešilo. **E-mail sa mu ale neposiela** — pripomínať normu oddelenia, v ktorom človek už nie je, je nezmysel; čo s tým, rozhodne personalista. Hľadá sa prekryv s obdobím platnosti pridelenia, nie „bol tam v deň pridelenia": kto prišiel týždeň po pridelení a o mesiac odišiel, mal povinnosť tiež.
- **Potvrdenie nesie odtlačok oddelenia** — identifikátor aj názvy celej cesty v čase potvrdenia, rovnako ako meno a adresa. Bez toho by výkaz „potvrdenia po oddeleniach" za minulý rok po reorganizácii povedal niečo iné než vtedy. Vo výkaze `ack:report` je preto stĺpec „Oddelenie (v čase potvrdenia)"; dnešné zaradenie je náhradou len tam, kde odtlačok chýba.
- Indexy pre `departments` a dva nové nad `persons` v `onboarding_init.mjs`.
- 9 nových testov (spolu 716).

### Added (2026-08-29 — organizačná štruktúra)

- **Oddelenia sú strom (D49).** Zakladajú sa v `/organizacia`, záložka **Oddelenia**: názov, nadriadený oddelenie, premenovanie, presun a zrušenie. Pri každom je počet ľudí priamo a počet aj s podriadenými — to druhé je to, koho sa pridelenie naozaj týka.
- **Osoba patrí do práve jedného oddelenia.** Dovtedy to bol voľný text: pri desiatich ľuďoch to stačilo, pri stovke znamená, že „Legislatíva", „legislatíva" a „Legislat." sú tri oddelenia a otázka „koľko ľudí má úsek" nemá odpoveď. Pôvodný text sa **nemaže** — ostáva ako stopa, z čoho oddelenie vznikol.
- **Oddelenie a skupina zostávajú dve rôzne veci.** Oddelenie je *kam patrím* (práve jeden, ako v organizačnej schéme), skupina je *komu sa to posiela* (koľko treba, naprieč oddeleniami). Zlúčiť ich by znamenalo, že normu pre rozhodcov nemožno poslať bez toho, aby rozhodcovia boli oddelením — čím prestane platiť, že oddelenie je štruktúra.
- **Prideliť sa dá oddelenia, a platí to aj pre celý jeho podstrom.** Kto prideľuje úseku, myslí tým úsek; prideľovanie po jednom odbore by znamenalo, že pri ďalšom odbore sa na to zabudne a nikto si to nevšimne.
- **Materializovaná cesta na osobe — vedomá výnimka z D27.** O príslušnosti rozhoduje `matchesAudience()`, čistá funkcia bez databázy a jediné miesto s tým pravidlom. Bez cesty by musela dostať celý strom (a prestala by byť čistá), alebo by vznikla druhá kópia pravidla v agregácii — a tá by sa s prvou rozišla presne pri reorganizácii. Cena je zapísaná v kóde: pri presune oddelenia sa cesty prepočítajú celému podstromu a zaradenie osoby sa zapisuje spolu s cestou v jednom zápise.
- **Názov oddelenia sa do pridelenia ukladá ako kópia**, rovnako ako názov dokumentu: oddelenie sa premenuje a o rok musí byť čitateľné, komu sa vtedy prideľovalo. Príslušnosť sa vždy počíta z identifikátora, nie z názvu.
- **Zrušiť sa dá len prázdny oddelenie bez podriadených**, a strom má najviac 6 úrovní — hlbší sa na telefóne nedá prehľadne ukázať a to najhlbšie v ňom býva v skutočnosti skupina.
- **`npm run departments -- --tenant SFZ`** prevedie existujúce textové oddelenia na stromové a ľudí do nich zaradí. Predvolene nič nezapisuje. Strom po prevode je **plochý**: zo zápisu „Odbor médií" sa nedá vyčítať, pod koho patrí, a hádať to podľa podreťazcov by vyrobilo štruktúru, ktorá vyzerá hotovo a nesedí.
- 19 nových testov (spolu 707).

### Added (2026-08-29 — organizácia si spravuje nastavenie sama)

- **`/organizacia` na doméne zákazníka (D48).** Vzhľad, jazyky, logo, farba, kontakt, vlastné prihlasovacie údaje Entra/Google, domény pre automatické zakladanie a **vlastné domény**. Rolou `people-admin`; kód organizácie a vypnutie portálu tam zámerne nie sú. **Správca platformy si ponecháva plnú správu všetkých organizácií** cez `/admin` — kvôli podpore a helpdesku.
- **Domény: požiadať, nie zapísať.** Na otázku „ak to nie je nebezpečné" je odpoveď, že voľný zápis nebezpečný **je**, a to dvomi spôsobmi. Prvý: každá doména sa pridáva do *nášho* projektu vo Verceli, takže zákazník by mohol zapísať cudziu — Vercel na ňu drží nárok v našom účte a jej skutočný majiteľ si ju do svojho projektu nepridá. To je odstávka spôsobená tretej strane, z nášho účtu. Druhý: `*.contineo.app` už smeruje na naše nasadenie, takže voľná subdoména by sa zapísaním okamžite rozsvietila pod našou značkou; kontrola „nepatrí inému tenantovi" na to nestačí, lebo nepatrí zatiaľ nikomu.
- Bezpečnou to robí **dôkaz cez DNS** — jediný, ktorý existuje. Zákazník o doménu požiada, dostane presný CNAME, a doména sa zapne (a do Vercelu pridá) až vtedy, keď smeruje na nás. Overuje sa CNAME aj výsledná adresa: apex domény a niektoré správcovstvá DNS CNAME neponúkajú a nahrádzajú ho ALIAS-om.
- **Správcovské odkazy sa presunuli pod avatar.** Lišta je navigácia obsahu — to, čo človek otvára denne; nastavenie organizácie a správa tenantov sa otvárajú raz za mesiac a v lište len zaberali miesto.
- 22 nových testov.


### Changed (2026-08-29 — jednotný vzhľad ovládacích prvkov a hlavička)

- **Skupiny a trasy sa vyberajú, nepíšu.** Dovtedy to bolo textové pole oddelené čiarkou. Vyzeralo to nevinne, ale bola to pasca: `rozhodcovia` a `rozhodcova` vyzerajú v poli rovnako a v databáze sú to dve skupiny, z ktorých jedna nedostane nikdy nič — a personalista nemal ako vedieť, ktoré skupiny vôbec existujú. Teraz sa vyberá z existujúcich, pri každej je počet ľudí, a **napísať novú sa dá** — len vedome, samostatným poľom.
- **Vlastný rozbaľovací výber namiesto `<select>`.** Rozbalený zoznam natívneho selectu kreslí operačný systém a CSS naň nesiaha; v tmavej téme vyzerá ako cudzí prvok a vo zvyšku rozhrania má všetko rovnaký rámček a rádius. Nový výber sa ovláda aj klávesnicou (šípky, Home/End, Enter, Escape) — `<select>` to vie a náhrada, ktorá to nevie, je krok späť. **Bez JavaScriptu zostáva v `<noscript>` skutočný `<select>`** s tým istým `name`; prehliadač obsah `noscript` pri zapnutom JS neparsuje ako prvky, takže sa hodnota nikdy neodošle dvakrát.
- **Štítky vyzerajú rovnako na oboch obrazovkách**, hoci sú postavené inak: v správe osôb sú to tlačidlá s klientskym stavom, pri prideľovaní noriem zaškrtávacie políčka (ten formulár funguje bez JavaScriptu). Stav nesie `:has()`. Tá istá vec má vyzerať rovnako — inak človek háda, či je to naozaj to isté.
- **Horné menu má responzivitu.** Pod 760 px sa položky schovajú za ikonu a vysunú sa pod lištu; dovtedy sa lámali do druhého riadka a hlavička rástla do výšky. Hranica je 760, nie obvyklých 640: pri troch správcovských odkazoch sa lišta láme skôr — a bude ich pribúdať.
- **Odhlásenie a téma sa presunuli do osobného menu pod avatarom.** Patria k človeku, nie k obsahu; v lište zaberali miesto navigácii a odhlásenie navyše stálo hneď vedľa odkazov, na ktoré sa klikne omylom. Pri systéme, kde sa potvrdzujú smernice, je „vypadol som" drahšie než jeden klik navyše.
- **Avatar má zatiaľ iniciály, nie fotografiu.** Google ju v profile vracia, Microsoft nie — vyžaduje volanie Graphu a oprávnenie navyše od IT zákazníka. Polovica ľudí s fotografiou a polovica bez nej vyzerá horšie než iniciály pre všetkých. Farba sa počíta z adresy, takže ten istý človek má vždy tú istú — inak by avatar prestal byť tým, čím má byť.
- Dlhý názov organizácie sa v lište skracuje namiesto lámania do druhého riadka.
- **`publikaVOrganizacii()` sa presunulo do `persons.ts`.** Volá ho prideľovanie noriem aj správa osôb; keby si to každý riešil sám, dve obrazovky by ponúkali dva rôzne zoznamy tých istých skupín.
- 9 nových testov (spolu 657).

### Added (2026-08-29 — správa osôb, etapa 2)

- **Rola `people-admin` a obrazovky `/osoby` (D46).** Zoznam s hľadaním, detail, úprava, pozvanie, vyradenie a import z CSV.
- **Vlastná rola, nie `hr`.** Sú to dve rôzne oprávnenia: `hr` prideľuje normy a vidí, kto ich nepotvrdil — to je o obsahu; `people-admin` zakladá a vyraďuje ľudí — to je o prístupe. V mnohých organizáciách to robia dvaja rôzni ľudia (personalista a IT), a spojiť ich do jednej roly znamená, že IT správca zároveň uvidí, kto si neprečítal disciplinárny poriadok. Správca platformy sem prístup nemá (D41 mu dáva počty, nie mená).
- **Osoba sa nemaže.** Vyradenie je `status: "inactive"`; potvrdenia sú záznamy a musia prežiť odchod človeka (O16). Vyžiada si napísanie adresy — je to jediná zmena, ktorá človeka okamžite odstrihne. Vrátenie dáva `invited`, nie `active`: „aktívna" znamená *už sa prihlásila* a to sa vrátením nestalo.
- **Adresa sa nedá zmeniť.** Je to kľúč, na ktorý sú naviazané potvrdenia aj prihlasovacie kontá; prepísať ho pod existujúcimi záznamami by znamenalo, že sa audit odkazuje na niekoho, kto tam už nie je. Preklep sa rieši vyradením a pozvaním nanovo — je to nepohodlnejšie a je to správne.
- **Import z CSV s náhľadom pred zápisom** — to isté, čo robí `npm run persons:import`, a **tou istou knižnicou**. Čítanie CSV aj mapovanie hlavičiek sa presunuli zo `scripts/lib/csv.mjs` do `src/lib/csv.ts` a `src/lib/personsImport.ts`; dva importéry toho istého súboru sú spoľahlivý spôsob, ako jedného dňa naimportovať dva rôzne výsledky. Chybné riadky sa vypíšu **menovite** — „5 chybných" sa nedá opraviť.
- Import zapíše všetkých do organizácie toho, kto ho robí, aj keď je v súbore niečo iné: personalista zväzu nesmie importom založiť človeka do cudzej organizácie (D32).
- Vyradení zostávajú v zozname, len označení. Skryť ich by znamenalo, že personalista nevie, prečo sa nedá pozvať adresa, ktorú tam „nikto nemá".
- 25 nových testov (spolu 648).

### Changed (2026-08-29 — správa osôb)

- **Obrazovka importu je jediná v správe s klientskym stavom** a je to vedomá výnimka: medzi „vyber súbor" a „zapíš" musí byť náhľad, a ten znamená podržať obsah súboru. Nechať človeka vybrať ten istý súbor druhýkrát je horšie — najmä preto, že medzi prvým a druhým výberom by sa dal podstrčiť iný. Bez JavaScriptu zostáva skript.

### Added (2026-08-29 — prihlásenie pracovným kontom, etapa 1)

> Koncepcia a rozhodnutia D43–D46: `docs/PRIHLASENIE_A_SPRAVA_OSOB.md`

- **Prihlásenie cez Microsoft (Entra ID) a Google.** Vedľa odkazu v e-maile, nie namiesto neho: odkaz je jediná cesta, ktorá nezávisí od cudzej služby, a keď Entra vypadne, musí zostať spôsob, ako sa dostať dnu. Ľudia bez pracovného konta (rozhodcovia, delegáti) ho potrebujú tak či tak.
- **Aplikácia patrí zákazníkovi, nie nám (D43).** SFZ si zaregistruje vlastnú Entra aplikáciu a pošle `clientId` a `clientSecret`; my ich zadáme v `/admin/tenanti/[kod]`. Dôvod nie je technický: zväz, ktorý dá do systému vlastné predpisy, má vedieť **sám odvolať prístup** a **sám vidieť, kto sa prihlasoval** — a nemá sa o to prosiť dodávateľa. Premenné prostredia zostávajú len ako núdzový zdroj pre náš vlastný tenant a pre vývoj.
- **Tajomstvá sa šifrujú (`lib/tajomstva.ts`, AES-256-GCM).** Nie je to náš údaj, je to prístup do cudzieho systému. GCM a nie CBC preto, že overuje aj neporušenosť — zmenený zápis spadne namiesto toho, aby sa rozšifroval na nezmysel. Obrazovka ukazuje „nastavené / nenastavené / nečitateľné", hodnotu nevracia nikdy. Chýbajúci `OAUTH_SECRET_ENCRYPTION_KEY` poskytovateľov vypne, aplikáciu nezhodí; **zle dlhý kľúč je naopak chyba** — znamená, že ho niekto nastaviť chcel a pomýlil sa.
- **Poskytovatelia sa skladajú podľa hostiteľa (D44).** Ktorý Microsoft je „ten správny", závisí od domény (D29), takže `authOptions` nemôžu byť konštanta vyhodnotená pri štarte. Route handler ich zostavuje pri každej požiadavke; tenant má vlastnú pamäť, takže do databázy sa pri tom väčšinou vôbec nejde.
- **Konto overuje adresu, vstup povoľuje `persons` (D45).** Konto hovorí „toto je naozaj tá adresa"; že ten človek patrí do organizácie, hovorí výhradne `persons` — tá istá brána ako doteraz. Bez tohto rozlíšenia by prvá zle nastavená Entra aplikácia otvorila interné smernice komukoľvek s pracovným kontom na svete.
- **Kontrola pôvodu pred bránou.** Microsoft musí mať `tid` a — keď je vyplnený zoznam — musí byť medzi povolenými Entra tenantmi; pri režime `organizations` je to jediná zábrana proti tomu, aby sa dnu dostal človek z cudzej organizácie s rovnakou adresou. Google musí mať `email_verified`; `hd` sa vynucuje na odpovedi, nie požiadavkou (tam je to len nápoveda, ktorá sa dá obísť).
- **Spájanie kont podľa overenej adresy.** Ten istý človek sa dnes prihlási e-mailom a zajtra kontom; bez toho by NextAuth druhý pokus odmietol a človek by nemal ako zistiť prečo. Bezpečné je to preto, že adresa tu **nie je identitou** — identitou je záznam v `persons`, konto je len dôkaz. Neoverená adresa sa nespojí nikdy.
- **`persons.externalRef` sa začal plniť** (`entraObjectId`, `googleSub`) — až po povolení a len na rozpoznanie toho istého konta, keď sa človeku zmení adresa. Prístup neudeľuje.
- Adresa návratu je na obrazovke vypísaná v presnom tvare, aký musí zákazník zapísať do svojej aplikácie — je to najčastejšia príčina toho, prečo prihlásenie hneď na prvý raz nejde.
- 28 nových testov.

### Added (2026-08-29 — Fáza 9 rozsah B: prideľovanie prestalo byť tiché)

- **Kolekcia `assignments` (D37).** Doteraz bolo rozposlanie úlohy tiché: pribudla nová verzia normy a `trackProgress()` ju začal rátať ako nepotvrdenú každému, koho sa trasa týkala — bez rozhodnutia a bez stopy. Model má odteraz dve pravdy s rôznym pôvodom: *čo mám urobiť* sa naďalej odvodzuje (D27), *že sa to má urobiť* je záznam. Záznam sa nemení a nemaže — odvolanie je `revokedAt`, nie `deleteOne`.
- **`persons.groups` ako tretia dimenzia (D38).** Trasa je obsah, oddelenie je štruktúra, skupina je adresát. Zlúčiť skupiny s trasami by znamenalo, že jednorazová úloha si vyžiada umelú trasu; zlúčiť ich s oddeleniami by znamenalo, že sa nedá osloviť skupina naprieč oddeleniami — a práve tá býva adresátom noriem (rozhodcovia, delegáti, štatutári). **Číselník skupín sa nezakladá**, zoznam sa odvodzuje z ľudí: číselník by bol druhá pravda a prideliť niečo prázdnej skupine je tichý spôsob, ako neprideliť nikomu.
- **Obrazovky `/hr`.** Prehľad pridelení s počtami, formulár na pridelenie a **menovitý** zoznam, kto ešte nepotvrdil. Číslo „chýba 17" sa dá pozerať mesiace; mená sú to, na základe čoho niekto zdvihne telefón.
- **Rola `hr` a brána `hrContext()`.** Rola **a** príslušnosť k organizácii, obe naraz — rovnaký vzor ako `platformContext()`, o poschodie nižšie. **Správca platformy sem prístup nemá:** D41 mu dáva počty naprieč tenantmi, nie menovitý zoznam ľudí, ktorí si niečo neprečítali. To je obsah, nie prehľad.
- **Widget vie „čaká od" a „nové".** Oboje z `assignments.assignedAt` (D39). Kde pridelenie nie je, widget o čase **mlčí** — náhradný čas by bol horší než žiadny.
- **`persons.previousLoginAt`.** Bez neho by „nové" znamenalo „pribudlo počas tejto relácie", teda spravidla nič. Posun starej hodnoty a zápis novej sú jedna operácia (aktualizácia rúrou), inak by pri prihlásení z dvoch zariadení jedno z histórie zmizlo.
- **Pridelené znenie, ktoré už neplatí, sa nedá potvrdiť**, tak sa počíta medzi zablokované, nie medzi úlohy. Inak by úloha z widgetu nikdy nezmizla: `/dokumenty/…` ukáže novšie znenie a potvrdenie by sa viazalo na inú verziu.
- 32 nových testov (spolu 579).

### Added (2026-08-29 — dokončenie rozsahu B)

- **E-mail „pridelili sme vám…" sa posiela tlačidlom, nie ako vedľajší účinok pridelenia.** Pridelenie sa dá odvolať; odoslaný e-mail nie. Preto samostatná obrazovka s náhľadom: komu presne to pôjde a **presne to znenie**, ktoré odíde (skladá ho tá istá funkcia — podobný text by sa časom rozišiel so skutočným).
- **Posiela sa len tým, ktorí ešte nepotvrdili.** Kto to má za sebou, by dostal pripomienku niečoho, čo spravil — a to je presne ten druh pošty, po ktorom si ľudia zapnú filter a prestanú čítať aj tú dôležitú.
- **`assignments.notified[]`** — pole, nie jedna hodnota. Je rozdiel medzi „poslali sme raz pred pol rokom" a „posielame štvrtý týždeň po sebe". Zapisuje sa **po** odoslaní a s počtom, ktorý naozaj odišiel; zápis dopredu by pri výpadku pošty tvrdil, že ľudia vedia, hoci nedostali nič.
- E-mail nesie **dôvod od človeka** a ide v jazyku príjemcu. Z obsahu normy len názov — do schránky, ktorá môže byť súkromná alebo mimo našej správy, obsah interného predpisu nepatrí. Odkaz vedie na dokument, nie na prihlásenie: posielať prihlasovací odkaz by znamenalo vyrobiť druhý jednorazový vstup do systému kvôli oznámeniu, ktoré nič nepotvrdzuje.
- Strop **150 e-mailov naraz**. Nad ním sa akcia odmietne a povie prečo; serverová akcia má obmedzený čas behu a rozposlať náhodnú polovicu je horšie než neposlať nič.
- **Hromadné pridelenie: N noriem × M publík**, jeden spoločný dôvod. Reálne zadanie znie „nový rozhodca dostáva päť predpisov" alebo „novela sa týka rozhodcov aj delegátov aj klubov"; prideľovať to po jednom znamená napísať ten istý dôvod pätnásťkrát — a pri pätnástom už nikto nepíše to isté, takže sa záznamy o tej istej udalosti rozídu.
- „Všetkým v organizácii" **prebije zvyšok výberu**. Inak by vzniklo pridelenie pre všetkých a k nemu pridelenia pre skupiny, ktoré sú jeho podmnožinou.
- Zaškrtávacie políčka s terčom 44 px, nie `select multiple` — ten sa na telefóne ovláda mizerne a viacnásobný výber v ňom nie je vidieť. Po chybe sa vracia **celý výber**, nie len hláška: kto zaškrtal päť noriem, tri skupiny a napísal odsek odôvodnenia, to druhýkrát nenapíše.
- 16 nových testov (spolu 595). Medzi nimi ten najdôležitejší: **prázdny výber publík je prázdny zoznam, nie „všetci"** — inak by stačilo nezaškrtnúť nič a norma by odišla celej organizácii.

### Changed (2026-08-29)

- **D30 a O13 sa rušia, nezodpovedajú sa.** Hľadala sa definícia „podstatnej zmeny" — kritérium, podľa ktorého by systém rozhodoval, kedy treba potvrdiť znova. Také kritérium neexistuje: rovnaká zmena je v jednej norme preklep a v druhej nová povinnosť. Nahradila ho **udalosť s povinným dôvodom**. „Novela čl. 12 mení lehotu na odvolanie" sa o rok dá overiť; „naplnilo sa kritérium C" nie.

### Fixed (2026-08-29 — nasadenie)

- **Dve `DYNAMIC_SERVER_USAGE` chyby v logu nasadenia.** Next sa pokúšal predgenerovať `/_not-found` a zakopol o `headers()` v obale. Zachytené to bolo, nasadenie prešlo — ale chyba, ktorá sa má prehliadať, je presne to, čo spôsobí, že sa raz prehliadne aj skutočná. Obal je odteraz `force-dynamic`, čo len hovorí nahlas, čo aj tak platí: **hostiteľ určuje tenanta** (D29), takže sa vopred nedá vygenerovať nič.
- **`npm run lint` nefungoval.** `next lint` v Next 16 už neexistuje a slovo „lint" si vyloží ako názov priečinka (`no such directory: …/app/lint`). Volá sa priamo `eslint` s plochou konfiguráciou. Pri tom vyšli najavo aj tri skutočné drobnosti: neescapované úvodzovky v troch komponentoch a zvyšné importy v `domeny.mjs` po presune hľadania tokenu do `vercel-auth.mjs`.
- `@typescript-eslint/no-explicit-any` je v `src/lib/providers/**` znížené na výstrahu — `any` je tam **dlh, nie zámer** (parsovanie JSON-u cudzích API, správne by bolo `unknown` a zúženie) a prepisovať každú generujúcu cestu bez možnosti overiť to inak než v produkcii nie je zmena, ktorá patrí sem.

### Added (2026-08-29 — ostré normy dostali platné znenie)

- **`npm run versions`** — deväť noriem SFZ prišlo RAG importom a `versions[]` nemalo vôbec: `versionId` navrchu, text v `document_chunks`. Pre vyhľadávanie to stačilo, pre potvrdzovanie nie — `effectiveVersion()` číta výhradne `versions[]` (D6, D25), takže všetkých deväť bolo v onboardingu „bez platného znenia".
  - Verzia dostane **ten istý `versionId`**, aký už majú dokument aj jeho chunky. Potvrdenie sa tým viaže presne na to znenie, z ktorého systém odpovedá; nové číslo by vytvorilo druhú pravdu o tom istom texte.
  - Text sa poskladá z chunkov v poradí `chunkIndex`. Chunky sa neprekrývajú — sú to články, každý uvedený hlavičkou „Dokument › Článok N", ktorá je tam kvôli vyhľadávaniu; pri súvislom čítaní sa odstráni a nahradí nadpisom.
  - Dátum platnosti skript **nedopĺňa odhadom**. Musí ho zadať človek (`--od`), pretože to je presne to rozhodnutie, ktoré systém spravíť nevie (D6, D25). Bez `--zapis` nezapisuje nič.
- **`npm run validity`** — nastaví dátum platnosti znenia. Vyžaduje `--zdroj`, teda odkiaľ ten dátum je; citácia sa uloží k verzii (`versions[].effectiveFromSource`). Dátum sa doslovne prepisuje do potvrdzovacej formulky a tým aj do záznamu v `acknowledgements` (D28) — o rok musí byť možné zistiť, či pochádza z ustanovenia o účinnosti, alebo to bol niečí odhad. Bez `--zapis` nezapisuje nič.
- **Osem noriem SFZ má skutočný dátum účinnosti**, prevzatý z ustanovenia o účinnosti v ich vlastnom texte (`scripts/sfz_dates.sh` drží citácie):
  | norma | účinnosť od |
  |---|---|
  | Organizačný a návštevný poriadok | 1. 7. 2014 |
  | Rokovací poriadok Konferencie | 4. 6. 2016 |
  | Volebný poriadok | 4. 6. 2016 |
  | Poriadok komory pre riešenie sporov | 7. 12. 2021 |
  | Disciplinárny poriadok | 1. 7. 2023 |
  | Stanovy | 27. 2. 2026 |
  | Registračný a prestupový poriadok | 1. 6. 2026 |
  | Súťažný poriadok | 24. 6. 2026 |

  Pri **Stanovách a Súťažnom poriadku** je dátum odvodený z dvoch miest (ustanovenie „dňom schválenia" + deň schválenia poslednej novely zo záhlavia), nie odcitovaný z jedného — a je to tak aj zapísané.
- **Revízny poriadok zostáva zástupný.** Hovorí „nadobúda účinnosť dňom jeho schválenia VV SFZ" a dátum schválenia v texte nie je; z dokumentu sa určiť nedá. Je označený priamo v `effectiveFromSource` a treba ho doplniť z uznesenia VV SFZ.
- **Označenie znenia je zatiaľ všade „1.0"** a to je vymyslené číslo — normy vlastné číslovanie verzií nemajú. Objaví sa v potvrdzovacej formulke, takže sa raz bude musieť nahradiť niečím, čo naozaj niečo znamená (napr. dňom schválenia novely).

### Fixed (2026-08-29)

- **`addVersion()` padával práve na prvej verzii dokumentu.** Uzatvorenie platnosti predchádzajúcej verzie sa robí cez `arrayFilters`, a tých sa Mongo odmietne dotknúť, keď pole `versions` ešte neexistuje („The path 'versions' must exist"). Chyba teda nastala v jedinom prípade, keď niet čo uzatvárať. Podmienka `versions.0` ten krok preskočí. Doteraz si toho nikto nevšimol, lebo jediný dokument s `versions[]` vznikol seedom, ktorý pole rovno zapisuje.

### Added (2026-08-28 — správa tenantov, rozsahy B a C)

- **Úprava organizácie z obrazovky:** názov, skratka, logo, farba, kontakt, jazyky a domény. Nevyplnené pole sa **nemení, nemaže** — inak by uloženie názvu zmazalo logo (kryté testom).
- **Vypnutie si vyžiada napísanie kódu organizácie.** Je to jediná zmena, ktorá ľudí okamžite odstrihne od portálu; obyčajné „naozaj?" sa odklikne skôr, než sa prečíta. Tenant sa pritom nemaže — záznamy potvrdení musia prežiť koniec spolupráce.
- **Zakladanie novej organizácie**, vrátane priradenia domény projektu vo Verceli a odoslania pokynov zákazníkovi jedným tlačidlom. Poradie je zámerné: najprv `tenants`, potom Vercel — zápis je zdroj pravdy a výpadok cudzieho API nesmie brániť organizáciu založiť.
- **Pravidlá o doménach majú jednu definíciu.** `lib/tenantAdmin.ts` (vlastníctvo, normalizácia, zápis) a `lib/vercel.ts` (priradenie projektu, stav, znenie pokynov) volajú rovnako obrazovka aj skripty. `tenant_set.mjs` mal dovtedy vlastnú kópiu kontroly kolízie a `domeny.mjs` vlastné znenie e-mailu — dva rôzne texty o tom istom nastavení sú spoľahlivý spôsob, ako poradiť dvakrát rozdielne.
- **Serverové formuláre bez klientskeho stavu.** Správcovská obrazovka funguje aj bez jediného riadku JavaScriptu; chyby sa vracajú do adresy. Vstupy majú `font-size: 16px`, inak Safari na iPhone pri kliknutí do poľa stránku priblíži.
- **Každá akcia začína bránou.** Serverová akcia je koncový bod ako každý iný — to, že sa volá z chránenej stránky, nie je kontrola prístupu.
- 15 nových testov (spolu 547).

### Fixed (2026-08-28)

- **Parametrové vlastnosti v `UnknownHostError`** (`constructor(public readonly …)`) Node pri spúšťaní skriptov cez `--import ts-hook` odstrániť nevie (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`). Kým `tenants.ts` nikto zo skriptov neimportoval, nevadilo to; odkedy `tenant_set.mjs` volá pravidlá z `lib/`, musí byť načítateľný. Prepísané na priradenie v tele — rovnaký kód, bez syntaxe, ktorú Node odmieta.
- **`node scripts/tenant_set.mjs` už nefunguje**, skript importuje z `src/lib` a potrebuje ts-hook: `npm run tenant -- …`. Príkazy v dokumentácii prepísané.

### Added (2026-08-28 — `npm run domains`)

- **Stav domén tenantov jedným príkazom.** Pre každú doménu: či je vo Verceli, či zákazník už nastavil DNS, či mu v zóne nekolidujú staré záznamy, a ak čaká, presný `CNAME`. Odpovedá na otázku „prečo mu tá doména ešte nejde" bez klikania v dashboarde.
- **`--poslat` odošle pokyny zákazníkovi** na `branding.supportEmail` (`--komu` ju prebije) cez Ecomail. Hromadné rozposielanie zámerne nie je — `--poslat` vyžaduje `--company`.
- **Stav ani pokyny sa neukladajú.** Oboje sa číta naživo z Vercelu a odvodí z hostname; uložená kópia by klamala presne vtedy, keď na tom najviac záleží — zákazník si prestaví DNS a náš záznam by ďalej tvrdil „nastavené". Rovnaké pravidlo ako D27.
- **Zaznamenáva sa len akt:** `domainSetup { requestedAt, requestedTo, hostnames }` — komu a kedy sme pokyny poslali a čo sme pýtali. To sa odvodiť nedá; rovnaké rozlíšenie ako medzi úlohou a jej pridelením (D37).

### Added (2026-08-28 — vlastná doména zákazníka je tiež jeden príkaz)

- **`tenant_set.mjs` pridá vlastnú doménu do Vercelu sám** (`POST /v10/projects/{id}/domains`) a vypíše `CNAME`, ktorý má nastaviť zákazník. Dovtedy to bol jediný ručný úkon na zákazníka; teraz z našej strany nezostáva žiadny. Zvyšok je v zóne zákazníka a certifikát vydá Vercel automaticky.
- **Prihlásenie sa berie z lokálneho `vercel login`**, `VERCEL_TOKEN` má prednosť (beh mimo vývojárskeho stroja). Token nie je nikde v repozitári. `--no-vercel` krok vypne.
- **Poradie je zámerné: najprv `tenants`, potom Vercel.** Zápis tenanta je zdroj pravdy a zlyhanie cudzieho API nesmie brániť založiť organizáciu — skript to povie a doména sa doplní ručne.
- **Preskakuje, čo netreba,** a povie prečo: `*.contineo.app` (pokrýva wildcard), `localhost` a `*.localhost` (k Vercelu nedorazia), `*.vercel.app` (prideľuje ich Vercel).
- Overené na existujúcich tenantoch: `intranet.futbalsfz.sk` → „už v projekte je", `sfz.localhost` a `test.contineo.app` → preskočené s dôvodom.

### Added (2026-08-28 — `*.contineo.app` beží, nový zákazník je jeden príkaz)

- **Wildcard certifikát vydaný** (`cert_PdcCSg43yjBCGiGOmxOODZpL`, 90 dní, automatická obnova) po zapísaní `_acme-challenge TXT` do zóny `contineo.app`. Tým je celý reťazec kompletný: doména v projekte → `CNAME *` → certifikát.
- **Overené naživo na skúšobnom tenantovi `TEST`:** `test.contineo.app` vráti `200` a prihlasovaciu stránku so značkou „Skúšobná organizácia"; `nahodne123.contineo.app` vráti `404`, lebo v `tenants` nie je (D29).
- **Nový zákazník je odteraz jeden príkaz** — `tenant_set.mjs --company X --host x.contineo.app --name "…"`. Žiadny zásah do Vercelu, žiadne DNS, žiadne čakanie na certifikát. Vlastná doména zákazníka (ako `intranet.futbalsfz.sk`) zostáva možnosťou za cenu jedného zápisu vo Verceli.
- Tenant `TEST` je ponechaný ako terč na overovanie po zmenách; nemá ani jednu osobu, takže sa doň nedá prihlásiť.

### Fixed — otvorené (2026-08-28)

- **Neznámy hostiteľ dostane najprv `307` na `/prihlasenie` a až potom `404`.** Middleware beží pred kontrolou tenanta. Obsah neuniká a koniec je správne `404`, ale cudzia doména sa takto dozvie, že existuje cesta `/prihlasenie` — v rozpore s tým, čo D29 hovorí. Vedené v `TODO.md` (I1c); vyžaduje overenie tenanta priamo v middlewari, ktorý na edge do Atlasu nevidí.

### Changed (2026-08-28 — wildcard: DNS hotové, certifikát čaká na výzvu)

- **DNS je prestavené.** `*.contineo.app` už vedie na Vercel (`dig +short nahodne123.contineo.app CNAME` → `…vercel-dns-016.com.`).
- **Opravený môj predchádzajúci zápis.** Napísal som, že `TXT` overenie nebolo potrebné. Platilo to pre **overenie vlastníctva** domény, nie pre **certifikát**: wildcard sa vydáva cez DNS-01 výzvu a `_acme-challenge TXT` potrebuje vždy. Bežné domény certifikát dostanú automaticky, wildcard nie.
- **Postup dopísaný do `NASADENIE_app.md`** (`certs issue --challenge-only` → zapísať TXT → `certs issue`), aj s tým, ako sa chýbajúci certifikát prejaví: `curl` vráti `kod=000`, prehliadač hlási neplatný certifikát a v logoch Vercelu nie je nič — spojenie skončí skôr, než sa k aplikácii dostane.
- **Založený skúšobný tenant `TEST`** (`test.contineo.app`) na overenie celého reťazca hneď, ako certifikát bude.

### Docs (2026-08-28 — prečo nepreberáme vzor z inventaria)

- **Zapísaný rozbor otázky „na doméne zákazníka len prihlásenie a potom presmerovanie".** `inventario.estate` to tak má, ale kvôli zdieľanej cookie `COOKIE_DOMAIN=.inventario.estate` — pod cudzou doménou by prihlásená appka nefungovala. Contineo žiadnu `cookies` konfiguráciu nemá, relácia je host-only, a preto na `intranet.futbalsfz.sk` beží celá aplikácia.
- **Neušetrilo by to ani jeden zápis vo Verceli:** `majetok.futbalsfz.sk` je na projekte `inventario-app` registrovaná. Bez toho sa nevystaví certifikát a spojenie padne pri TLS, teda skôr než sa middleware spustí.
- Zapísané aj to, kedy by ten model zmysel mal: iba pri jednej relácii naprieč všetkými tenantmi, čo by pri onboardingu bolo skôr riziko (D32).

### Changed (2026-08-28 — wildcard `*.contineo.app` priradený projektu)

- **Vo Verceli je hotovo.** `*.contineo.app` je priradený projektu `contineo-app` a `verified: true`; overovací `TXT` nebol potrebný, lebo apex `contineo.app` je v účte a overený. Odteraz nová subdoména nepotrebuje vo Verceli nič.
- **Spresnenie k CLI:** tvar `vercel domains add <doména> <projekt>` naozaj neexistuje, ale jednoargumentový `vercel domains add '*.contineo.app'` spustený **v adresári projektu** doménu projektu priradí. Predchádzajúci zápis tvrdil, že cez CLI to nejde vôbec — nebola to pravda. `vercel domains inspect` pritom wildcard v sekcii „Projects" neukáže, vidno ho až cez API.
- **Zostáva jediný krok, a je mimo Vercelu:** na Websupporte má `contineo.app` zástupný `A * → 37.9.175.197`, ktorý wildcard prebíja. Treba ho nahradiť `CNAME * → 75b9ff58792d32ba.vercel-dns-016.com.` Apex a `www` sa nemenia.

### Docs (2026-08-28 — wildcard, a oprava nesprávneho príkazu)

- **Zapísaný postup pre `*.contineo.app`.** Cieľ: pri novom zákazníkovi nesiahať do Vercelu vôbec. Wildcard sa nastaví raz (doména v projekte + `CNAME *` a overovací `TXT` na Websupporte) a odvtedy stačí jediný príkaz `tenant_set.mjs`.
- **Opravený príkaz, ktorý som predtým zapísal nesprávne.** `vercel domains add <doména> <projekt>` **neexistuje** — CLI 54.1.0 berie `domains add` jediný argument a doménu pridá účtu, nie projektu. Priradenie k projektu sa cez CLI spraviť nedá, je to úkon v dashboarde. Overené pokusom, nie predpokladom.
- **Poznámka k bezpečnosti wildcardu:** doteraz museli sedieť dve nezávislé miesta (doména vo Verceli aj zápis v `tenants`). S wildcardom sa k aplikácii dostane každá `*.contineo.app` adresa a rozhoduje jediné miesto — `tenants`; ostatné dostane `404` (D29). Pre vlastné domény zákazníkov zostávajú miesta dve.

### Changed (2026-08-28 — adresy `*.vercel.app` zavreté dvakrát)

- **`*.vercel.app` sa zrušiť nedá** — Vercel ich prideľuje projektu aj každému jednotlivému nasadeniu. Dajú sa len zavrieť.
- **Prvá vrstva už bola nastavená:** `ssoProtection = all_except_custom_domains`, takže všetko okrem vlastných domén žiada prihlásenie do Vercelu.
- **Druhá vrstva pribudla:** `*.vercel.app` adresy sú odobrané z tenanta `LTK`. Aj keby ochranu niekto vypol, portál na nich odpovie `404` (D29) namiesto toho, aby ukázal obsah. Vypnutie ochrany je jedno kliknutie v cudzom rozhraní; zápis v `tenants` je náš a nezmení sa omylom.

### Changed (2026-08-28 — dodávateľské domény majú vlastného tenanta)

- **Na `app.contineo.app` visela značka SFZ.** Tenant `SFZ` mal medzi doménami aj `app.contineo.app`, `contineo-app.vercel.app` a `localhost`. Pri jedinom tenantovi to bolo neviditeľné, ale bola to nesprávna vlastnícka väzba: dodávateľská doména niesla logo zákazníka.
- **Vznikol tenant `LTK`** (značka „Contineo") pre `app.contineo.app`, `contineo-app.vercel.app`, `contineo-app-ltksolutions-projects.vercel.app` a `localhost`. `SFZ` si ponechal `intranet.futbalsfz.sk` a nový `sfz.localhost`.
- **Vedľajší efekt, ktorý stojí za zmienku: D29 je tým prvýkrát overená s dvomi tenantmi.** Doteraz existoval len jeden, takže „hostiteľ určuje organizáciu" bolo tvrdenie o kóde, nie pozorovanie. Overené naživo: `intranet.futbalsfz.sk` → SFZ s logom zväzu, `app.contineo.app` → Contineo.
- **Pre vývoj:** `npm run dev` beží na `localhost`, teda pod `LTK`. Rozhranie zväzu sa pozerá na `http://sfz.localhost:3000` — prehliadače smerujú celé `*.localhost` na `127.0.0.1`.
- V `LTK` zámerne nie je ani jedna osoba: kto sa tam prihlási, uvidí, že do tejto organizácie nepatrí (D32). Je to ukážková doména, nie druhý portál.

### Fixed (2026-08-28 — stránka 404 prezrádzala to, čo má zamlčať)

- **Neznámy hostiteľ dostával `404` s celým obalom.** Hlavička so značkou organizácie a nová pätička s názvom aplikácie, verziou a odkazom na repozitár mu povedali všetko naraz — na stránke, ktorá to má podľa D29 práve zamlčať. Bez tenanta sa odteraz nevykreslí ani hlavička, ani pätička; zostane holý text.
- **Aj názov v záložke prehliadača je informácia.** `metadata` sa zmenila na `generateMetadata`: neznámy hostiteľ dostane „Stránka sa nenašla", nie „Contineo — testovacie rozhranie".
- **Výpadok databázy sa od cudzej domény odlišuje.** `null` z `currentTenant()` znamená doménu, ktorá nepatrí nikomu; výpadok vyhodí výnimku a vtedy obal aj názov zostávajú — nejde o cudziu doménu, ale o našu vlastnú, ktorá sa práve nedá overiť.
- **Slovenská stránka 404.** Dovtedy tam bol Nextov predvolený anglický text „This page could not be found.", ktorý v slovenskom rozhraní vyzerá skôr ako porucha servera než ako preklep v adrese.
- **`npm run status` vypisuje aj tenantov** — doména → `companyCode`. Pri „prečo mi tá doména nejde" je to prvá vec, ktorú treba vidieť.
- **`NASADENIE_app.md`: doména tenanta žije na troch miestach** (DNS, projekt vo Verceli, kolekcia `tenants`) a prečo to nesmie byť „Redirect" — presmerovanie mení hlavičku `Host`, z ktorej sa určuje tenant.

### Added (2026-08-28 — pätička a menu len pre prihlásených)

- **Neprihlásený človek videl celé menu portálu.** Stránky za ním sú chránené middlewarom, takže obsah neunikol — ale zoznam sekcií mu o vnútri systému hovorí viac, než potrebuje vedieť, a na prihlasovacej stránke ho to mätie. Menu aj tlačidlo „Odhlásiť" sa odteraz ukazujú len prihlásenému.
- **Prihlásenie sa berie zo servera (`currentEmail()` v layoute), nie z `useSession()`.** Okrem správnosti to rieši blikanie: `useSession()` začína stavom „neviem" a odpoveď dorazí až po ďalšej požiadavke, takže menu by na okamih bliklo aj tam, kde byť nemá.
- **Pätička hovorí, že systém beží na Contineu** — odkaz na `contineo.app`, odkaz na repozitár a číslo verzie. Portál nesie značku organizácie, nie dodávateľa, a to je správne: nad záväzným potvrdením smernice nemá stáť cudzia značka. Povedať sa to ale niekde musí, inak človek s problémom nevie ani to, ako sa aplikácia volá.
- **Číslo verzie nie je ozdoba.** Pri hlásení „nefunguje mi to" je prvá otázka „čo presne ti beží". Zobrazuje sa `verzia 0.1.0 · <7 znakov commitu>`; obe hodnoty vpisuje `next.config.mjs` pri builde, lebo `package.json` sa na Verceli za behu prečítať nedá a `npm_package_version` tam nikdy nie je vyplnené. Jediná pravda o čísle zostáva `app/package.json`.
- **Odkazy von majú `rel="noreferrer"`** — bez neho by sa cieľová stránka dozvedela internú doménu zväzu, z ktorej sa na ňu kliklo.
- **Značky Continea a GitHubu sú v jednom module** (`ZnakContineo.tsx`). Kresba v SVG je presne to, čo sa pri kopírovaní rozíde: jedna kópia sa opraví, druhá zostane stará a nikto si to nevšimne.
- Overené na 375 px v oboch stavoch (prihlásený aj nie), bez vodorovného posúvania.

### Verified (2026-08-28 18:17 — prihlásenie cez `persons` naostro)

- **Najdlhšie otvorený červený bod Fázy 8 je zavretý.** Log: `[auth] pouzitie-odkazu: jan.letko@futbalsfz.sk — persons povolil`. Núdzová brzda sa nezúčastnila, takže cesta, ktorou pôjde vyše sto ľudí vrátane externistov bez M365, je odskúšaná v produkcii — nie odvodená z kódu.
- **Evidencia prihlásenia sa zapisuje.** `stav=active`, `lastLoginAt=2026-08-28T18:17:54.682Z` — v tej istej sekunde ako callback. `await recordSignIn(...)` sa tým overil naostro; dovtedy sa nezapisovalo nikdy, lebo brzda vracala `true` skôr, než sa k zápisu vôbec došlo. `invited → active` prebehlo tiež.
- **Odkaz z e-mailu vedie na úvodnú stranu** (callback `302` → `GET /`), kde sa na živých dátach zobrazil widget „Nevybavené žiadosti".

### Changed (2026-08-28 — núdzová brzda má vlastnú adresu)

- **`POVOLENE_EMAILY` prestavená z `jan.letko@futbalsfz.sk` na `intranet@futbalsfz.sk`.** Brzda sa vyhodnocuje prvá, takže adresa, ktorá je v nej, sa nikdy neprihlási cez `persons`. Kým tam bola bežná pracovná adresa správcu, cesta, ktorou pôjde stovka ľudí, zostávala neodskúšaná a vyzeralo to, že prihlásenie funguje. Brzda odteraz obsahuje osobitnú správcovskú adresu, ktorá sa na bežnú prácu nepoužíva; `jan.letko@futbalsfz.sk` sa testuje ako bežný používateľ.
- **Zapísané do `NASADENIE_app.md` ako pravidlo,** nie ako jednorazová zmena — aj s tým, že sa to overuje runtime logom a nie `vercel env pull`, ktorý pre túto premennú vracia prázdnu hodnotu, aj keď nastavená je.

### Fixed (2026-08-28 — po prihlásení človek skončil späť na formulári)

- **Odkaz z e-mailu vrátil prihláseného človeka na prihlasovaciu stránku.** `signIn("email", …)` sa volalo bez `callbackUrl`, takže si ho NextAuth vzal z aktuálnej adresy — a tou bola práve prihlasovacia stránka. Relácia vznikla správne (v hlavičke bolo „Odhlásiť"), ale obsah stránky ostal formulár, takže to vyzeralo, akoby prihlásenie nefungovalo.
- **Prihlásený človek sa z `/prihlasenie` presmeruje na úvodnú stranu.** Rieši to stránka sama, nie len `callbackUrl` v odkaze: rovnaká slepá ulica vznikne aj zo záložky alebo z histórie prehliadača. Kontrola je až za overením hostiteľa — neznáma doména nedostane ani presmerovanie (D29).

### Changed (2026-08-28 — `recordSignIn` sa čaká)

- **`void recordSignIn(...)` nahradené `await`.** Fire-and-forget zápis v serverless funkcii je nespoľahlivý: funkcia končí hneď po vrátení hodnoty a rozrobený dotaz do Atlasu sa môže zahodiť. Pôvodný dôvod pre `void` (zlyhanie zápisu nesmie zhodiť prihlásenie) drží aj s `await`, lebo `recordSignIn` si chyby prehĺta sám. Regresný test v `tests/signIn.test.ts` je overený obojsmerne.
- **Poctivá poznámka k dôkazu:** prázdne `lastLoginAt` v produkcii **nie je** dôkazom tejto chyby, ako som najprv napísal. Vysvetľuje ho núdzová brzda, ktorá vracia `true` skôr, než sa `recordSignIn` vôbec zavolá. Oprava je správna sama osebe, ale odôvodnenie bolo nesprávne.
- **I1c zostáva červené.** Medzitým som ho označil za overené na základe `vercel env pull`, ktorý vrátil prázdne `POVOLENE_EMAILY`. Runtime log hovorí opak — `— cez núdzovú brzdu` — a rozhoduje beh, nie výpis premennej. Cesta cez `persons` je stále neodskúšaná.

### Added (2026-08-28 — Fáza 9a: widget „Nevybavené žiadosti")

- **`app/src/lib/pending.ts` — register zdrojov.** Widget nevie nič o normách ani tiketoch; pýta sa zdrojov a skladá z nich jeden zoznam v jednom tvare (`PendingItem`). Keby sa pýtal každého modulu zvlášť, každý ďalší zdroj by znamenal ďalšiu vetvu v komponente, ktorý má len vypísať zoznam. V rozsahu A je zdroj jediný: **nepotvrdené normy nad existujúcim `trackProgress()`** — nie druhý výpočet toho istého, ktorý by sa raz rozišiel práve pri novej verzii (D27).
- **Widget je na úvodnej strane nad hľadaním.** Odkaz na prihlásenie príde e-mailom a prvá obrazovka po kliknutí je táto — hore patrí to, čo od človeka chceme, nie ukážka toho, čo systém vie. Hľadanie zostáva pod tým. Komu nepatrí ani jedna trasa, widget sa nezobrazí vôbec: prázdna karta by mu len zabrala prvú obrazovku.
- **Zablokovaný krok sa medzi úlohy nedostane.** Úloha, s ktorou človek nemôže pohnúť (dokument bez platného znenia), nie je úloha a v zozname by len visela. Zamlčať sa ale nesmie, inak widget tvrdí „nič nečaká" — preto o nich povie jednou vetou s odkazom na `/dokumenty`, kde je aj dôvod.
- **Tá istá norma v dvoch trasách sa ukáže raz.** Identitou položky je dvojica zdroj + `id`, nie krok trasy.
- **Výpadok jedného zdroja zoznam nezhodí.** Zdroje sa pýtajú súbežne a chyba ide do logu; prázdny widget kvôli výpadku helpdesku by človeku povedal „nič nečaká", čo je horšie než neúplný zoznam.
- **13 nových testov** (spolu 516). Testuje sa to, čo môže ukázať nepravdu: zdvojenie, zablokované, poradie, výpadok zdroja, prázdny stav.

### Changed (2026-08-28)

- **„Odkedy to čaká" a príznak „nové" sa odložili do rozsahu B.** Pri implementácii vyšlo najavo, že `lastLoginAt` treba porovnávať s tým, *kedy úloha pribudla* — a to v rozsahu A neexistuje. `effectiveFrom` je právna platnosť (norma z roku 2019 by nebola „nová" ani pri prvom stretnutí), `publishedAt` je nepovinné. Widget preto neukazuje ani jedno; oboje dodá `assignments.assignedAt` (D37). Zoradenie je zatiaľ podľa `effectiveFrom` zostupne a je označené ako dočasné priamo v kóde.

### Planned (2026-08-28 — Fáza 9: udalosti a upozornenia)

- **`docs/UDALOSTI_A_UPOZORNENIA_KONCEPCIA.md` — návrh čaká na schválenie, kód sa nezačal.** Zadanie: widget „Nevybavené žiadosti" na úvodnej strane a interný systém upozornení.
- **Pri rozbore vyšlo najavo, že to nie je len zobrazovacia úloha.** Rozposlanie úlohy je dnes tiché: nová verzia normy sa začne rátať ako nepotvrdená všetkým, koho sa trasa týka, bez rozhodnutia a bez stopy. Widget by tomu dal viditeľné miesto na úvodnej strane — teda by problém zväčšil, nie vyriešil.
- **Nové rozhodnutia D36–D40.** Kľúčové je **D37**: úloha sa naďalej odvodzuje (D27 platí), ale **pridelenie sa zaznamenáva** — rovnaký vzor ako `acknowledgements`. Rozsah B tým uzatvára aj **D30** („podstatná zmena" prestane byť definíciou a stane sa dôvodom, ktorý vyplní človek).
- **✅ D40 rozhodnuté (2026-08-28): možnosť (a).** Jednorazové systémové hlásenia („Import zlyhal 3. 9. o 4:00") sa odvodiť nedajú, a tak v rozsahu A nebudú vôbec — widget ukazuje výhradne úlohy. Kolekcia `notifications` vznikne až s prvým skutočným odosielateľom (kurácia alebo helpdesk). Dôsledok pre rozhranie: widget sa volá „Nevybavené žiadosti", nie „Upozornenia" — inak by človek čakal aj hlásenia, ktoré tam nebudú.
- **Rozsah A je tým odblokovaný** a nepotrebuje žiadne nové pole: `since` aj príznak „nové" sa dajú zložiť z toho, čo `documents.versions[]` a `persons.lastLoginAt` už nesú.

### Fixed (2026-08-28 — prihlásenie na vlastnej doméne)

- **Odkaz v e-maile viedol na `app.contineo.app` aj tomu, kto začal na `intranet.futbalsfz.sk`.** `NEXTAUTH_URL` je jedna hodnota na celé nasadenie. `rewriteLinkHost()` prepíše hostiteľa na doménu požiadavky — ale **len ak je to známy tenant**; inak by sa podvrhnutou hlavičkou `Host` dala do cudzej schránky poslať adresa útočníka s platným tokenom. Cudzia adresa v `callbackUrl` sa necháva tak: „opraviť" ju na našu doménu by ju zamaskovalo. Nový `redirect` callback dovolí návrat len na známu doménu, takže nevzniká otvorené presmerovanie.
- **E-mail aj hlavička nesú názov, logo a farbu organizácie.** Predmet je „Prihlásenie — {organizácia}" (sk/cs/en), nie „Prihlásenie do Contineo". Odznak „testovacie rozhranie" sa nad záväzným potvrdením už neukazuje.
- **Prihlásenie hovorí, prečo nevyšlo** — NextAuth `logger` + záznam v `signIn` callbacku rozlíši žiadosť o odkaz od jeho použitia a núdzovú brzdu od `persons`. Prvá vec, ktorú to ukázalo: overené prihlásenie prešlo **cez núdzovú brzdu**, takže cesta cez `persons` je v produkcii stále neodskúšaná (`TODO.md` I1c).
- **Loga tenantov musela dostať výnimku z brány prihlásenia.** Prihlasovacia stránka načítava logo samostatnou požiadavkou, ktorá ešte nie je prihlásená; bez výnimky ju middleware presmeroval a z hlavičky zostal holý text.

### Added (2026-08-28 — tenant podľa hostiteľa, D29)

- **`app/src/lib/tenants.ts` + kolekcia `tenants`.** Hostiteľ určuje `companyCode`, vzhľad a jazyky. **Neznámy hostiteľ je zakázaný, nie predvolený** (ADR-002, ADR-003 kap. 5.4): predvolený tenant by znamenal, že ktokoľvek, kto si nasmeruje vlastnú doménu na naše nasadenie, dostane rozhranie niekoho iného — a bude to vyzerať legitímne, lebo certifikát aj obsah sedia. Odpoveď je `404`, nie vysvetľujúca hláška.
- **Prečo samostatný modul a nie rozšírenie `tenantProfile.ts`:** ten odpovedá na otázku „ktorý model a kde počíta" (ADR-001), tento na otázku „ktorá organizácia". Rôzna životnosť, rôzny vlastník; v jednom zázname by si neznámy hostiteľ priniesol aj nastavenie poskytovateľov.
- **`onboardingContext()` v `session.ts`** vracia stav požiadavky ako **jednu hodnotu** (`unknown-host` / `not-signed-in` / `not-in-tenant` / `ready`), nie ako tri nezávislé kontroly. Keby si každá stránka skladala „tenant + osoba + patria k sebe" sama, jedna z nich raz niektorú časť vynechá — a chýbajúca kontrola nevyzerá ako chyba, vyzerá ako fungujúca stránka.
- **Kontrola je aj v `POST /api/acknowledgements`,** nielen na stránke. Zápis potvrdenia je jediné miesto, kde vzniká auditný záznam, a volanie API stránku obchádza — záznam nesmie vzniknúť pod hlavičkou organizácie, ku ktorej potvrdzujúci nepatrí.
- **`app/scripts/tenant_set.mjs`** zakladá a upravuje tenanta; doménu už priradenú inému tenantovi **odmietne, nie prepíše**. Tiché prevzatie domény sa zistí až vtedy, keď ľudia z jednej organizácie uvidia hlavičku druhej. Rovnaké pravidlo drží aj unikátny index `hostname_unique` — databáza to ustráži aj vtedy, keď to skript prehliadne.
- Stav testov: **19 súborov, 489 testov** (z toho 25 nových na `tenants`).
- **Vedomé obmedzenie:** kontrola beží v serverových komponentoch a route handleroch, **nie v middleware** — to beží na hrane, kde Mongo klient nie je. Staršie plochy (`/`, `/sada`, `/api/chat`) sú tak chránené prihlásením, ale nie tenantom.
- **Portál SFZ má adresu `intranet.futbalsfz.sk`** — `CNAME` na Websupporte, doména vo Verceli overená, v `tenants` priradená tenantovi `SFZ`. Pôvodne plánovaná `internal.futbalsfz.sk` **je obsadená** (`CNAME` na `sportnet.online`) a prepnutie by odstavilo bežiacu službu; v starších zápisoch je preto `internal` neplatný stav (`NASADENIE_app.md` kap. 0b).

### Fixed (2026-08-28 — nasadenie z Gitu)

- **Projekt `contineo-app` napojený na GitHub.** Push do `main` odteraz spúšťa produkčné nasadenie sám; root directory nastavené na `app`, produkčná vetva `main`. **Dovtedy napojený nebol a nikto si to nevšimol** — posledné nasadenie bolo staré 31 dní, hoci v repozitári medzitým pribudlo desať commitov. Kód bol hotový, testy prechádzali, živá aplikácia o ňom nevedela; `/dokumenty` na `app.contineo.app` neexistovalo, lebo build ho nepoznal. Ticho zlyhávajúce nasadenie je horšie ako hlučné, preto je stav napojenia zapísaný v `docs/NASADENIE_app.md`, nie len v nastaveniach Vercelu.
- Z toho istého repozitára sa teraz nasadzujú **dva** projekty — `contineo` (root `web`, marketingový web) a `contineo-app` (root `app`). Jeden push prestavia obe, aj keď sa menili len `docs/`. Ak by build minúty prekážali, *Ignored Build Step* `git diff --quiet HEAD^ HEAD -- .` to vyrieši.

### Added (2026-08-27 — skripty onboardingu)
- **`app/scripts/import_persons.mjs`** — import osôb z CSV. **Náhľad je predvolené správanie, zápis sa musí vypýtať** (`--zapis`): nahratie stovky ľudí naslepo je operácia, po ktorej sa hľadá, ako to vrátiť späť, a `persons` rollback nemá. Pri chybnom riadku nezapíše nič — zápis po častiach by nechal databázu v polovičnom stave. Hlavičky sa normalizujú (bez diakritiky, bez ohľadu na veľkosť), takže `Meno`, `meno` aj `MENO` sú to isté; prijíma slovenské aj anglické názvy stĺpcov.
- **`app/scripts/acknowledgement_report.mjs`** — výkaz potvrdení pre HR do CSV: kto potvrdil, kedy, ktorú verziu a v akom jazyku — a kto nie. Rozsah je **jeden `companyCode`, nie strom** (D32, D33). Výkaz ide na štandardný výstup, hlásenia na chybový, takže sa dá presmerovať do súboru.
- **`app/scripts/lib/csv.mjs`** — čítanie a písanie CSV bez knižnice: BOM z Excelu, bodkočiarka ako oddeľovač v slovenskom locale, úvodzovky okolo polí s oddeľovačom. 17 testov (`tests/csv.test.ts`) — keď sa hlavička netrafí, import ticho preskočí stĺpec a stovka ľudí príde o oddelenie alebo o jazyk.
- **`app/scripts/lib/ts-hook.mjs`** — dovolí skriptom importovať moduly zo `src/` priamo. Node 26 vie TypeScript spustiť (odstráni typy), ale nevie dohľadať bezpríponové relatívne importy; háčik ten rozdiel premostí. **Bez neho by skripty potrebovali vlastnú kópiu pravidla, ktorá verzia dokumentu platí** — a dve implementácie právneho pravidla sa raz rozídu bez toho, aby si to niekto všimol, lebo obe „fungujú".
- `src/lib/mongodb.ts`: typy z `mongodb` sa importujú cez `import type`. Node nevie, ktoré z pomenovaných importov sú typy, takže `Document` medzi hodnotami by skripty zhodil.
- Stav testov: **17 súborov, 454 testov**.


### Changed (2026-08-27 — identifikátory po anglicky)
- **Kód Fázy 8 premenovaný na anglické identifikátory.** Moduly `osoby.ts` → `persons.ts`, `dokumenty.ts` → `documents.ts`, `potvrdenia.ts` → `acknowledgements.ts`, `jazyky.ts` → `i18n.ts`; typy, funkcie, parametre aj lokálne premenné podľa toho. **Komentáre a popisy testov zostávajú po slovensky** — menia sa mená, nie reč vysvetlení.
- **Hodnoty vracané z API sú teraz strojové a anglické** (`"no-effective-version"`, `"already-acknowledged"`, `"invalid-email"`…). Sú to kľúče pre volajúceho, nie text pre človeka; ten sa priradí až v rozhraní podľa jazyka.
- Konvencia zapísaná do `docs/rag-architecture.md`. Staršie moduly (`hodnotenia.ts`, `cennik.ts`, `sada.ts`, `povoleneEmaily()`/`jePovoleny()`) sa neprepisujú naraz — premenujú sa, keď sa ich niekto aj tak dotkne.
- **Testy zamerané na funkcionalitu:** vypustené kontroly znenia českého a anglického prekladu formulky. Preklady prostredia sú samostatná vec a testovať ich reťazec po reťazci znamená udržiavať slovník dvakrát. Zostáva to, čo je funkcia — výber jazyka, fallback a invariant, že formulka v každom jazyku nesie názov, verziu aj dátum. (438 testov v 16 súboroch.)


### Changed (2026-08-27 — testy prešli na Vitest)
- **`npm test` beží cez Vitest** (`vitest run`), pribudlo `test:watch` a `test:coverage`. Vlastný beh testov (`tests/run.mjs` + bundlovanie esbuildom) sa už nepoužíva.
- **Dôvod nebol „Vitest je štandard", ale konkrétny strop:** funkcie volajúce `getCollection()` sa nedali otestovať vôbec — a boli medzi nimi tie najdôležitejšie: `personMaySignIn()` (brána medzi internými smernicami a internetom), `acknowledge()` (zápis právneho záznamu) a `zalozOsoby()` (hromadný import). Obísť sa to dalo len pridaním testovacieho švu do verejného rozhrania každého modulu; `vi.mock()` to rieši bez toho.
- **Suity sa neprepisovali.** Pôvodný tvar `t("popis", podmienka)` zostal a len registruje test do Vitestu cez `tests/helper.ts` — 2 200 riadkov ručne prepísaných tvrdení je 2 200 príležitostí na preklep, a v testoch sa preklep neprejaví zlyhaním, ale falošným pokojom. **Nové testy sa píšu idiomaticky** (`expect(skutočné).toBe(očakávané)`), aby bolo pri zlyhaní vidieť rozdiel hodnôt.
- **Nová suita `tests/onboardingDb.test.ts`** — 17 testov nad falošnou databázou: že `acknowledge()` si verziu určí na serveri a nedá sa podvrhnúť staršia; že duplicitný zápis skončí ako `uz-potvrdene` a nie ako chyba servera; že iná chyba sa za „už potvrdené" nezamaskuje; že znenie je v jazyku človeka a `documentLanguage` v jazyku smernice; a hlavne, že **chyba databázy v `personMaySignIn()` neotvorí prístup**.
- Stav: **16 súborov, 442 testov, 0,7 s** (predtým 15 súborov bundlovaných po jednom).


### Added (2026-08-27 — viacjazyčné prostredie, D35)
- **`app/src/lib/i18n.ts`** — jazyk prostredia (SK · CS · EN): zoznam podporovaných jazykov, znenie potvrdzovacej formulky a texty prihlasovacieho e-mailu per jazyk, deterministické formátovanie dátumu.
- **Rozhodnutie D35:** viacjazyčné je **len prostredie, nie obsah**. Dokument má základný jazyk, v ktorom je napísaný (`documents.language`); dokument v inom jazyku je **samostatný dokument, nie preklad**. Zoznam jazykov prostredia je preto oddelený od číselníka `language`, ktorý tagguje obsah.
- **`persons.language`** — jazyk prostredia osoby; prihlasovací e-mail sa posiela v ňom. Pri neznámej osobe alebo nedostupnej databáze platí slovenčina: zlý jazyk je nepríjemnosť, neodoslaný odkaz sú zavreté dvere. Opakovaný import bez stĺpca jazyka jazyk **neprepíše** — rovnaká pasca ako pri `status`.
- **`acknowledgements.language` + `documentLanguage`** — záznam ukladá aj to, v akom jazyku človek formulku videl, aj to, v akom jazyku je smernica. Bez toho sa pri audite nedá odpovedať, či český rozhodca potvrdzoval slovenský text.
- **Jazyk v `app/` sa berie z profilu osoby, bez prefixu v URL** (na rozdiel od marketingového webu). Dôvod je bezpečnostný — `middleware.ts` je definovaný ako „všetko okrem" a pridávať doň jazykový segment znamená hrabať sa v jedinom mieste, ktoré stojí medzi internými smernicami a internetom.
- Anglická formulka používa slovný mesiac (`1 September 2026`), aby v právnom texte nevznikla nejednoznačnosť medzi britským a americkým poradím čísel.
- Testy: 14 nových (formulka v troch jazykoch, formáty dátumu, normalizácia `sk-SK`/`cs_CZ`, fallback pri neznámom jazyku). 15 suít prechádza, `type-check` čistý.


### Fixed (2026-08-27 — ADR-001 stálo na neplatnom predpoklade)
- **ADR-001 dodatok 10:** `voyage-4-nano` **TEI nepodporuje** (otvorená issue #816 zo 6. 2. 2026, bez PR) — štítok `text-embeddings-inference` na karte modelu je v rozpore s issue v repozitári TEI. Otázka „ktorý server pre nano" bola 26. 7. **zatvorená práve s odvolaním sa na TEI**; je **znovu otvorená** ako O7-a. Príklad T3 profilu prepísaný z `kind: "tei"` na `kind: "infinity"` (vLLM/Infinity, OpenAI tvar) — v pôvodnom znení sa nedal postaviť. Poučenie: štítok na karte modelu nie je záväzok podpory.
- **Poistka proti tichému zhoršeniu hľadania** (`app/src/lib/providers/embedding/http.ts`): `HttpEmbeddingProvider.embed()` tvrdo zlyhá, kým nie je doplnené rozlíšenie dotaz/dokument a prompty modelu (O7 nález B). `voyage-4-nano` používa iné prompty pre dotaz a pre dokument; bez nich sa vektory posunú a meranie O1 na adaptér neplatí — **nespadne to, len horšie hľadá**. Nešlo o živú chybu (reťaz beží cez `atlas-auto`, `embed()` sa nikde nevolá), ale o pascu pre prvého, kto prepne tenanta na on-prem. Drôtový tvar volania zostal v `embedRaw()`, takže testy tvaru požiadavky a parsovania odpovede platia ďalej; 13 suít prechádza, `type-check` čistý.

### Decided (2026-08-27 — O7 sa odkladá za Fázu 8)
- **Fázy 1–5 z `docs/O7_plan_overenia.md` odložené.** Nie je to zmena názoru na O7 — zmenilo sa poradie: Fáza 8 (onboarding) **nevolá žiadny model**, takže spĺňa `eu-full` bez O7; **D34** zaraďuje on-prem na vetvu veľkých organizácií, ktorá nie je primárny produkt; **O12** rozhodlo zostať na Verceli, čím sa odložil celý smer odchodu zo zdieľanej infraštruktúry. Vrátiť sa, keď o on-prem požiada zákazník alebo tender.
- **Fáza 0 (prompty) zostáva ako práca na ~pol dňa** — poistka ju vynúti pred spustením fázy 1.

### Added (2026-08-27 — dopísané zo staršej práce)
- **`docs/O7_plan_overenia.md`** — plán overenia vlastného embeddingu a reranku (O7) z 2026-07-28, stav „návrh, čaká na schválenie". Vznikol v inej relácii a **nebol commitnutý**; obsahuje nálezy A–D (TEI neobslúži `voyage-4-nano`, chýbajúce prompty ako tichá chyba, O1 meraný na malých dátach, nano na MacBooku už bežalo), rozpočet pamäte na 16 GB, fázy 0–5, riziká R1–R5 a otvorené body O7-a…d.

### Changed (2026-08-27 — diagram architektúry: CMS, kurátor, hierarchia, portál)
- **Diagram prekreslený** (`web/public/contineo_diagram{,.cs,.en}.svg`, `docs/contineo_diagram.svg`, pregenerované `.png`): pribudol **CMS ako vrstva** obopínajúca vstupné kanály a worker, **kurátorská brána** („kanál smie len predvyplniť, publikuje človek" — D-CMS-6, D25), doplnené **kolekcie** v jadre (`documents (+ versions)`, `channels`, `channel_runs`, `navigation`, `categories`, `persons`, `acknowledgements`, `onboarding_tracks`), **hierarchia tenantov** (`companyCode.parent` — centrála → dcéry → prevádzky, s výslovnou poznámkou „hierarchia nedáva prístup") a **Portál (KB + onboarding)** medzi rozhraniami. Z jadra odstránená poznámka o Atlas EU / Community 8.2 — doslovne sa opakovala v päte.
- **Diagram sa už generuje** z jedného zdroja — `web/scripts/gen_diagram.py` (rozloženie + slovník SK/CS/EN). Predtým existovali štyri ručne udržiavané kópie a už sa rozišli: `docs/` verzia niesla `rerank-2.5`, webová `rerank-2`. Zjednotené na `rerank-2` (súlad s `rag-architecture.md` a `AKO_TO_BEZI.md`).
- **Opravené neexistujúce preklady** legendy spätných cyklov — položky `① qa_pair` a `② ticket` boli vo všetkých troch jazykových variantoch po slovensky.

### Decided (2026-08-27 — hierarchia tenantov a model dodávky)
- **D32:** **každý `companyCode` vidí len svoje záznamy a svoj obsah** — cudzie len vtedy, keď je menovite zdieľané cez `sharedWithCompanyCodes[]` (alebo je `accessLevel: public`). **`companyCode.parent` neudeľuje prístup** — hierarchia slúži na relevanciu a precedenciu noriem, nie na oprávnenie. Dôvod: chyba smerom „vidí viac" je tichá, chyba smerom „vidí menej" je hlučná.
  - *Opravené v ten istý deň:* prvé znenie tvrdilo, že `scope: global` sprístupní obsah celej skupine. To zamieňalo dve osi, pred ktorými `DATA_MODEL_konzistencia.md` výslovne varuje — `scope` hovorí, **na koho sa norma vzťahuje**; `accessLevel` + `companyCode`, **kto ju smie vidieť**. Poznámka o ortogonalite doplnená priamo do `DATA_MODEL_konzistencia.md`.
- **D33:** HR vidí potvrdenia **len svojho `companyCode`** — nie potomkov, nie nadradenú jednotku, nie sesterské. Ak má centrála vidieť potvrdenia dcéry, potrebuje explicitné oprávnenie, ktoré sa zaznamená.
- **D34:** primárne **SaaS na `contineo.app`** pre malé a stredné firmy; veľké organizácie dostanú **vlastné nasadenie tej istej platformy**, nie fork zdrojáku (fork = nedoručiteľné opravy a N nekompatibilných verzií).

### Added (2026-06-29 — blok Identita a prístup)
- **Nová sekcia „Identita a prístup"** na homepage (`web/components/Identity.js`, zaradená pred Bezpečnosť v `web/app/[lang]/page.js`, odkaz v `Nav.js`): SSO/jednotné prihlásenie (Entra ID, Google Workspace, OAuth/OIDC, vlastná DB), automatické zakladanie účtov z CRM/zdroja identity, multi-tenant prístup, bezpečnosť na úrovni dotazu (default-deny) + rad odznakov poskytovateľov identity. SK+EN (`dict.identity`).
- **Hlbší blok „Identita a riadenie prístupu" na `/technologia`** (`dict.tech.identity` SK+EN + render v `Tech.js`): tabuľka poskytovateľov (NextAuth → kanonická session), princípy (server-side, default-deny, filter pred LLM, auto-provisioning), dva režimy nasadenia. Vychádza z `docs/PRISTUPOVE_PRAVA.md`; sportnet.online uvedený len ako príklad.

### Changed (2026-06-29 — univerzálny pozicioning webu, Tier 4)
- **Web prepísaný na doménovo neutrálny jazyk** (`web/lib/dictionaries.js` SK+EN, `web/components/Tech.js`, `BotDemo.js`, `OverlayDemo.js`). Generická firma ako doména ukážok: číselník sekcií (`smernice`, `hr`, `ekonomicke`, `it_aplikacie`, `gdpr`), `companyCode` príklady `ACME`/`ACME-BA`, multi-tenant ako „centrála → regionálne → lokálne jednotky", FAQ demo na home office / dovolenku / reset hesla.
- **Futbal/SFZ presunutý do označeného Case study bloku** na `/technologia` (`tech.caseStudy` SK+EN + render v `Tech.js`) + úvodná poznámka `tech.exampleNote`, že príklady sú ilustračné a produkt je univerzálny.
- **sportnet.online** uvádzaný len ako *príklad* zdroja identity vo všeobecných formuláciách; detaily v Case study.
- Plán zmien: `docs/WEB_UNIVERZALNY_POZICIONING_PLAN.md`.

### Added (2026-06-29 — koncepcia CMS)
- **Návrhový dokument** `docs/CMS_KONCEPCIA.md` — CMS s tromi zodpovednosťami: (1) media manager pre RAG, (2) content engine pre verejný web (knowledge base / helpdesk), (3) správa vstupných kanálov. Rozlíšenie typov obsahu (`document` vs `web`) v jednej kolekcii `documents`; oddelenie `processingStatus` (workre) od `status` (publikácia); kanály ako spravované inštancie adaptérov (`channels`, `channel_runs`); roly v CMS; user flows; naviazanie na fázy.
- **Doménová univerzálnosť zdôraznená** — Contineo je univerzálna aplikácia; futbal/SFZ je len ukážka nasadenia do veľkej organizácie (zapracované do `CMS_KONCEPCIA.md`).

### Decided (2026-06-29 — rozhodnutia CMS D-CMS-1..6)
- **D-CMS-1:** web obsah žije v `documents` cez `contentType` (`document`|`web`), web-polia v `webPublish` — žiadna samostatná kolekcia.
- **D-CMS-2:** editor = Markdown + náhľad, s WYSIWYG vrstvou nad Markdownom (Markdown ostáva kanonické úložisko).
- **D-CMS-3:** helpdesk štartuje cez **web widget vložený do stránky**; e-mailový kanál je druhý krok na tej istej `tickets`/`channels` štruktúre. (E-mail je dnes hlavný kanál otázok, cieľom je presun na widget.)
- **D-CMS-4:** verejná KB = len kurátorské články + kanonický odkaz na normu (žiadne auto-generovanie z noriem).
- **D-CMS-5:** EN preklady = AI-návrh → kurátor potvrdí.
- **D-CMS-6:** žiadny auto-publish z kanála; predvyplnenie áno, finálny publish potvrdzuje človek.

### Added (2026-06-26 — centrálne číselníky + multi-zdrojová ingescia)
- **Centrálne číselníky (vzory/seed)** v `app/src/codelists/` — `sectionKey` (hierarchický), `companyCode`, `scope`, `accessLevel`, `language`, `category`, `sourceType`, `tags` + `README.md` a validačná `_schema.json`. Princíp: „closed vocabulary" pre povinné parametre — čo nie je v číselníku, sa do `document_chunks` nedostane.
- **Návrhový dokument** `docs/CISELNIKY_governance.md` — katalóg parametrov, úložisko (hybrid: kolekcia `codelists` + verzovaný seed), governance, validačná brána pri ingescii.
- **Návrhový dokument** `docs/INGESTION_zdroje_reconciliation.md` — source-adapter vrstva (PDF/MD, MCP, web link, API/DB), provenance model a reconciliation pri zmene číselníka (change-request + náhľad dopadu).

### Added (2026-06-26 — prístupové práva)
- **Návrh prístupových práv** `docs/PRISTUPOVE_PRAVA.md` (Fáza 5): ABAC + multitenant hierarchia (SFZ→regionálny→oblastný, `companyCode` = CompanyID). Verejný obsah nie je izolovaný; interný izolovaný per CompanyID s per-dokument zdieľaním (`sharedWithCompanyCodes`). Identita primárne zo **sportnet.online** (OAuth + MCP + CRM `api.sportnet.online/v1`); konverzná tabuľka `sportnet_role_map` (profil→skupina); re-sync login+webhook; CMS upload = ručný allowlist; enforcement vo filtri (default-deny, oba indexy); dva režimy nasadenia (anonymný widget vs. interný portál); relevancia rozpisov cez riadiaci zväz.
- **`sectionKey` uzamknutý na štruktúru Predpisov SFZ** (`app/src/codelists/sectionKey.json`): Stanovy · Poriadky · Štatúty a kódexy · Smernice · Rozpisy a manuály · Tlačivá/formuláre; `companyCode` vzor hierarchický (parent SFZ→regionálny→oblastný).
- **Marketingový web `/technologia`** (`web/lib/dictionaries.js` SK+EN) zladený s návrhom prístupu: identita zo **Sportnet.online** (OAuth + CRM, automatické zakladanie používateľov), prístup podľa príslušnosti k zväzu/klubu a skupín, SSO (sportnet.online/Entra/Google), multitenant hierarchia (verejné vidia všetci, interné per organizácia). Diagram (SVG + PNG) — identity ribbon `ISSF/Sportnet` → `Sportnet.online`.

### Added (2026-06-26 — backlog rozhodnutí)
- **`docs/OPEN_DECISIONS.md`** — 15 rozhodnutí (D1–D15) v 4 okruhoch (vyhľadávanie, doménová logika, identita, prevádzka/compliance) s prioritou, fázou a odporúčaním; navrhnuté poradie sprintov.

### Added (2026-06-26 — D5 a D10 rozpracované)
- **`docs/PRECEDENCIA_NORIEM.md`** (D5) — normatívna hierarchia SFZ (Stanovy>Poriadky>Smernice/Štatúty>Rozpis) + hierarchia zväzov; pravidlá R1–R4 (lex superior/specialis/posterior + hierarchia zväzov); aplikácia v RAG; zoznam na potvrdenie legislatívcom.
- **`docs/GDPR_DATA_PROTECTION.md`** (D10) — role (zväz=prevádzkovateľ, Contineo=sprostredkovateľ), kategórie dát, minimalizácia, návrh retenčných lehôt s odôvodnením, sub-procesori + EU rezidencia, práva dotknutých, audit, právne TODO (DPA/DPIA). *Nie právne poradenstvo — na posúdenie DPO/právnikom.*

### Decided (2026-06-26 — všetkých 15 rozhodnutí uzavretých)
- **Vyhľadávanie:** D1 chunking štruktúrne po hraniciach normy + breadcrumb (~300–800 tok.); D2 query→filtre LLM extrakcia + kontext používateľa; D3 citačná politika bez halucinácií; D4 ranking default 60/40, ladiť podľa eval setu.
- **Doménová logika:** D5 precedencia lex specialis v medziach SFZ (uviesť oba zdroje; potvrdiť s legislatívcom); D6 verzovanie `effectiveFrom/To`+`isActive`, default platná dnes.
- **Identita:** D7 sync login+webhook+cache; D8 onboarding — doménové číselníky zdieľané, zvyšok per tenant.
- **Prevádzka/compliance:** D9 zlatá sada + prah pred go-live; D10 minimalizovať PII + retencia + audit + DPA; D11 qa_pairs tagované + v reconciliation; D12 e-mail nikdy auto-odoslať; D13 crawl manuálne/on-demand; D14 widget s companyCode kontextom + rate-limit; D15 Ollama primárny + Claude fallback.

### Changed (2026-06-26)
- **Premenovanie `associationCode` → `companyCode`** (význam ostáva: pre koho obsah platí) a `scope` hodnota `association` → `company`. Aplikované **všade**: dokumenty (`CISELNIKY_governance.md`, `rag-architecture.md`, `DATA_MODEL_konzistencia.md`, projektový plán), verejná stránka `/technologia` (`web/components/Tech.js`, `web/lib/dictionaries.js` SK+EN) aj zdroj RAG (`app/src/lib/mongoSearch.ts`: `associationCodes`→`companyCodes`, `app/src/app/api/chat/README.md`). Systém ešte nie je nasadený — žiadna DB migrácia ani preindexovanie nie je potrebné. *Nahrádza skoršie pomenovanie `associationCode` v tomto Unreleased bloku.*
- **`sectionKey` je hierarchický** (parent → sekcia); **`sourceType` rozšírený** o `md`, `mcp`, `api`.
- **Diagram** (`contineo_diagram.svg` + pregenerované `contineo_diagram.png` v `web/public/` aj `docs/`) — popisok `associationCode` → `companyCode`.

### Decided (2026-06-26)
- Tagovanie pri ingescii = **per-dokument (LLM návrh → kurátor potvrdí)** pre každý zdroj.
- Sync pri zmene číselníka = **change-request + náhľad** (plný zoznam dotknutých dokumentov pred schválením); **rollback 1 level**; historické chunky sa **preznačkujú**.
- MCP import beží pod **servisným účtom**.

### Changed (Fáza 4 — zjednotenie dátového modelu na Model B)
- **Refaktor implementácie na kanonický Model B** (`app/src/`): kolekcie `rag_chunks`→`document_chunks`, `rag_documents`→`documents`; všetky polia v **camelCase** (`document_id`→`documentId`, `access_level`→`accessLevel`, `chunk_index`→`chunkIndex`, `source_url`→`sourceUrl`). `ChunkResult` rozšírený o doménové polia (`sectionKey`, `companyCode`, `scope`, `articleRef`, `heading`, `isActive`, `effectiveFrom/To`, `versionId`, `embeddingModel`).
- **Voliteľná doménová filtrácia** v `mongoSearch.ts` (`companyCodes`, `sectionKey`, `onlyActive`) — pripravená, aktivuje sa s identitou (ISSF); pri vynechaní sa správanie nemení.
- **Všetky identifikátory a enum hodnoty v angličtine** — `scope: global | company | region` (predtým `zvaz/oblast`), zladené v kóde aj na verejnej stránke `/technologia`.
- Atlas indexy (`chat/README.md`, `rag-architecture.md`) a doc schémy (`rag-architecture.md`, projektový plán) prepísané na nové názvy a polia. Index identifikátory (`rag_vector_index` atď.) ostávajú.

### Changed
- **Zjednodušený diagram architektúry** (`web/public/contineo_diagram.png`, `docs/contineo_diagram.png`) — z piatich vrstiev na tri + dva spätné cykly:
  vstupné kanály → worker (chunking + značkovanie) → MongoDB Atlas (jadro: embedding, hybrid search, rerank) → rozhrania;
  cykly: kurácia (kontrola kvality) a eskalácia na ticket. Pridaný editovateľný zdroj `contineo_diagram.svg`.
- **Zlúčenie „zdroje obsahu" + „integrácie"** do jednej vrstvy **„Vstupné kanály"** (pilier na stránke `/technologia`). ISSF/Sportnet je explicitne zdroj identity, nie obsahu; e-mail je obojsmerný kanál.
- **Premenovanie „Učiaci cyklus" → „Kontrola kvality a kurácia"** naprieč webom (pilier aj dátový tok na `/technologia`, krok „Podpora a kurácia" na úvodnej stránke). Dôvod: nejde o strojové učenie modelu, ale o ľudskú kuráciu obsahu — schválenie/oprava odpovede a jej uloženie ako `qa_pair`.
- `architectureCaption`: embedding, hybrid search a rerank sú popísané ako súčasť jadra MongoDB Atlas (Voyage Automated Embedding), nie ako samostatná vrstva.
- Zmeny aplikované v SK aj EN slovníku (`web/lib/dictionaries.js`).

### Decided
- **Kanonický dátový model = Model B** (z verejnej stránky `/technologia`): `document_chunks` · `qa_pairs` · `tickets` · `conversations` + doménové polia (`sectionKey`, `companyCode`, `scope`, `articleRef`) a verzovanie (`isActive`, `effectiveFrom/To`). Implementácia (Model A: `rag_chunks`/`access_level`) k nemu dorastie po fázach — `access_level` (viditeľnosť) a `scope`/`companyCode` (platnosť pre firmu/Zväz) bežia súbežne, sú ortogonálne.
- Zladené docs: `docs/DATA_MODEL_konzistencia.md` (rozhodnutie + mapovanie A→B + fázová migrácia), `docs/rag-architecture.md` a `docs/Contineo_RAG_Projektovy_plan.md` (poznámky o cieľovom modeli; migrácia zaradená do Fázy 4/4b/5). Živý kód `app/src/` a MongoDB sa NEmenia — len dokumentácia a plán.
