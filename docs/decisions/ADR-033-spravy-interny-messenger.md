# ADR-033 — Kuriér: formátované správy osobám a interný messenger

> **Stav:** prijaté · **Dátum:** 2026-10-12
> **Rozhodol:** Ján Letko (2026-10-12) — „Potrebujeme doplniť do Contineo
> možnosť posielať formátované správy osobám, nie notifikácie, ale správy,
> prílohy nie, maximálne ako link na iný obsah, správy zostávajú na
> platforme, človeku ide iba notifikácia o novej správe s predmetom správy.
> Naplánujme aj celý interný systém interného messengera, pre prípad
> možnosti odpovedí a podobne." Štyri doplňujúce otázky zodpovedal
> odporúčanými možnosťami (D204–D207). Po rozbore záťaže doplnil: „nebudeme
> pri každej správe posielať email, len notifikácia v systéme, email sa pošle
> raz za deň ráno ako zoznam neprečítaných správ… ideálne by bolo aby ak majú
> obaja diskutujúci otvorený messenger, volajme ho ‚courier‘ po slovensky
> ‚Kuriér‘, vedeli živo diskutovať v reálnom čase aj s reálnymi notifikáciami
> do zvončeka, alebo kuriéra" — D207 a D210 preto platia v tomto znení,
> D211–D213 sú doplnené. Ďalej: „notifikácie zo systému a samotného
> messengera oddeliť, messenger nech má vlastnú ikonu v hlavičke, napríklad
> obálku" — D214.
> **Nadväzuje na:** D39, D40 a `lib/notifications.ts` (zvonček nesie
> udalosti, nie správy), ADR-005 (publikum pridelenia: osoba, oddelenie,
> skupina, trasa, všetci — kópia, nie odkaz), D27 (stav sa odvodzuje),
> D32 (`companyCode` v podmienke dotazu), ADR-012 a ADR-022 (retencia
> a text ochrany údajov), ADR-028 D178 (lehota ticketov ako vzor
> nastaviteľnej retencie), `lib/formatText.ts` (ľahký Markdown bez HTML, len
> vnútorné odkazy).
> **Implementácia:** fáza 1 — plánovaná, vetva `docs/adr-033-spravy` nesie
> len toto rozhodnutie.
>
> **Názov modulu:** **Kuriér** (kľúč `courier`, cesta `/courier`, kolekcie
> `courier_threads`, `courier_messages`). V texte nižšie „správa" a „vlákno"
> sú pojmy Kuriéra.

---

## 1. Kontext

Contineo dnes vie človeku **dať vedieť**, ale nevie mu **napísať**.

- **Zvonček** (`notifications`) nesie udalosti: čo sa stalo, keď sa človek
  nepozeral. Ukladá druh a parametre, vetu skladá až pri čítaní. Nie je to
  miesto pre text, ktorý napísal človek človeku.
- **E-maily** (Ecomail) odchádzajú ako vedľajší účinok konkrétnych krokov:
  pridelenie, pripomienka, pozvánka, schválenie. Každý má pevnú šablónu.
  HR si vie vybrať publikum a vidí náhľad pred rozposlaním
  (`/hr/[id]/notify`), ale text je daný šablónou, nie HR.
- **Tickety** sú rozhovor s človekom **zvonku** cez schránku kanála. Dnu,
  medzi zamestnancami, žiadne vlákno neexistuje.

Chýba teda to najobyčajnejšie: HR alebo vedúci napíše oddeleniu
formátovaný oznam s odkazom na nový predpis; kolega sa na niečo opýta
kolegu; na oznam príde otázka a odpoveď. Dnes to ide cez e-mail mimo
platformy — bez väzby na dokumenty, bez prístupových práv, bez retencie.

Ján zároveň stanovil hranice: **žiadne prílohy** (odkaz na obsah v Contineo
nahrádza prílohu), **správy zostávajú na platforme** (von ide len upozornenie
s predmetom) a model má od začiatku rátať s **odpoveďami**, aby sa oznamy
a rozhovory nestavali dvakrát.

## 2. Rozhodnutie

### D204 — Kuriér je modul `courier` s vláknami; oznam aj rozhovor sú to isté

Vzniká modul **Kuriér** (`/courier`). Základ je **vlákno** (`thread`):
predmet, zmrazené publikum, zoznam správ. Jednorazový oznam 120 ľuďom
a rozhovor dvoch kolegov sú ten istý model; líšia sa len tým, komu ide
odpoveď (D205). Vďaka tomu fáza 2 (rozhovory) nepridáva kolekciu, len
oprávnenia.

**Kto smie písať komu** (Ján, 12. 10. 2026):

| Publikum | Kto smie |
|---|---|
| jedna osoba (1:1) | ktokoľvek prihlásený |
| oddelenie (aj s pododdeleniami), skupina, trasa, rola, celá organizácia | správca osôb, HR, správca obsahu |

Dôvod: 1:1 je rozhovor a nemá dôvod byť obmedzený; hromadná správa je
oznam v mene organizácie a bez obmedzenia by ktokoľvek písal všetkým.
Externé osoby z okna pomoci (widget, ADR-028) adresátmi **nie sú** — ich
cesta je ticket.

**Publikum sa zmrazí pri odoslaní** — ako pri pridelení (ADR-005): zoznam
príjemcov je kópia, nie dotaz. Kto príde do oddelenia o mesiac, starý oznam
nedostane; kto odíde, ostane mu v archíve. Pri hromadnej správe sa pred
odoslaním ukáže **náhľad**: komu presne (počet a zoznam) a s akým textom —
ten istý vzor ako `/hr/[id]/notify`, lebo odoslanú správu nemožno vziať
späť.

### D205 — Odpoveď na hromadnú správu ide súkromne odosielateľovi

Odpoveď na oznam **neotvára diskusiu pre 120 ľudí**. Vytvorí (alebo doplní)
1:1 vlákno medzi odpovedajúcim a odosielateľom, s odkazom na pôvodný oznam.
Pri 1:1 vlákne je odpoveď prirodzene v tom istom vlákne. Skupinové
rozhovory, kde odpoveď vidia všetci, sú fáza 2 a budú výslovná voľba
odosielateľa pri založení vlákna, nie predvolené správanie.

### D206 — Odosielateľ vidí o prečítaní len počet

Pri hromadnej správe vidí odosielateľ „Prečítalo 45 zo 120", **nie mená**.
Kto čo prečítal je údaj o správaní ľudí a Contineo už má miesto, kde sa
presne eviduje, kto sa s čím oboznámil: **Potvrdenia** (ADR-005). Správa,
pri ktorej záleží na tom, kto ju čítal, patrí tam. Pri 1:1 vlákne
„prečítané" vidno (dvaja účastníci — počet by bol to isté ako meno).

Prečítanie sa **neukladá per správa**: na účastníkovi vlákna je
`lastReadAt`; čo je neprečítané, sa odvodí (D27). Počet neprečítaných
vlákien je štítok **„Kuriér 3"** v navigácii — rovnako ako „Na potvrdenie
3" a štítok na **obálke v hlavičke** (D214). Zvonček správy nenesie vôbec
(D214) — ani počet, ani udalosť.

### D207 — E-mail je ranný súhrn neprečítaných, nie správa per vlákno

Pri každej správe sa **e-mail neposiela** (Ján, 12. 10. 2026). Doručenie
v systéme je zvonček, štítok a živé spojenie (D210). E-mail ide **raz
denne ráno** (cron `/api/cron/courier-digest`, 7:00): jeden e-mail tomu,
kto má aspoň jedno neprečítané vlákno — zoznam „odosielateľ · predmet ·
počet nových", tlačidlo „Otvoriť Kuriér". **Telo správy platformu
neopustí.** Kto nemá nič neprečítané, nedostane nič; súhrn sa dá v profile
osoby vypnúť. Odpovedať e-mailom späť sa **nedá** (správy zostávajú na
platforme; schránka Contineo nie je schránka kanála, ADR-028).

Dôsledok pre záťaž: namiesto fronty e-mailov pri hromadnom ozname (120
ľudí = 120 odoslaní naraz, dlhšie než limit požiadavky na Verceli) je jeden
cron s dávkou najviac 100 adresátov na beh a pokračovaním v ďalšom behu.

### D208 — Formátovanie je ľahký Markdown cez `formatText.ts`; prílohy nahrádzajú karty obsahu

> **Doplnené 16. 10. 2026 (D222):** v Kuriéri sú povolené aj odkazy von
> (`https://`) s doménou, ↗ a náhľadom uloženým pri odoslaní.

Správa sa píše v ľahkom Markdowne (tučné, nadpisy, odrážky, číslovanie,
odkazy) a vykresľuje **tou istou cestou ako odpoveď asistenta**
(`lib/formatText.ts` → `Answer`-ové bloky). Nič sa nikdy nestane HTML
a odkazy sú **len vnútorné cesty** — tam, kde dnes vzor chráni pred
výstupom modelu, chráni aj pred odkazom vedúcim „ako zväz" von. Kto bude
chcieť odkazovať von, rieši to samostatným druhom segmentu s viditeľným
označením (poznámka pri `LINK` v `formatText.ts`), nie rozšírením vzoru.

Prílohy **neexistujú**. Namiesto prílohy sa vloží **odkaz na obsah
v Contineo** — dokument, znenie, kurz, FAQ, ticket — a v správe sa ukáže
ako karta (názov, druh). Prístup ku karte sa kontroluje **pri čítaní**
(`companyCode` v dotaze, D32; `accessLevel`): kto k dokumentu prístup nemá,
vidí „nemáte prístup", nie názov ani obsah. Správa teda nikdy neobíde
prístupové práva dokumentu — to je dôvod, prečo prílohy nie sú.

### D209 — Súkromie: správy nečíta správca, AI ani ťažba; retencia nastaviteľná, DPO ich vie vydať

- **Správca nevidí cudzie vlákna.** Vlákno číta len jeho účastník.
  Neexistuje prehľad „všetky správy organizácie".
- **„Spýtať sa" správy neprehľadáva** a nič z nich sa neindexuje.
  Ťažba histórie (ADR-030) sa na správy nevzťahuje.
- **Audit** (D24) drží len: kto, kedy, komu (druh publika a počet), predmet.
  Text správy do auditu nejde.
- **Retencia:** vlákno sa maže **24 mesiacov od poslednej správy**;
  lehota je nastaviteľná v organizácii (`courierMonths`, 1–120) ako lehota
  ticketov (D178). Osoba odstránená z organizácie z vlákien zmizne
  retenciou, nie hneď — druhý účastník rozhovoru oň nepríde skôr.
- **DPO** vie vydať vlákna osoby ako súčasť exportu pri žiadosti dotknutej
  osoby (ADR-012). Námietka sa správ netýka — nie sú spracúvané na základe
  oprávneného záujmu, ale na základe pracovnoprávneho vzťahu (interná
  komunikácia).
- **/privacy** dostane nový odsek „Správy" (účel, údaje, základ, lehota,
  príjemcovia) a posun `PRIVACY_NOTICE_VERSION`.

### D210 — Živý rozhovor v Kuriérovi cez SSE; mimo Kuriéra sa stav obnovuje navigáciou

Keď má človek **otvorený Kuriér** (zoznam alebo vlákno), prehliadač drží
spojenie Server-Sent Events na `/api/courier/stream` — ten istý mechanizmus
a klient (`lib/sseClient.ts`), ktorým „Spýtať sa" streamuje odpoveď.
Server ním posiela nové správy vo vlákne a zmenu počtu neprečítaných
(štítok na obálke, D214). Spojenie beží do 55 s (`maxDuration = 60`), potom sa
prehliadač sám znova pripojí; pre človeka je to súvislé. Dvaja ľudia
s otvoreným vláknom tak diskutujú v reálnom čase.

**Mimo Kuriéra sa spojenie nedrží** (Ján, 12. 10. 2026): štítok na obálke
sa obnoví pri navigácii. Pri 100 ľuďoch to znamená rádovo desiatky
otvorených spojení, nie stovky; aj najmenší stupeň Atlasu to unesie.

**Indikátory pri 1:1** sú vo fáze 1: „píše…" (klient pošle
`POST /api/courier/typing`, server zapíše `typingAt` na účastníka, platí
5 s — nič sa nemaže) a „prečítané" (z `lastReadAt` druhého účastníka).
Pri hromadnom ozname ostáva len počet (D206).

**Bez JavaScriptu** stránka ďalej funguje: formuláre odosielajú, zoznam
sa načíta, len sa živo neprekresľuje. Push do telefónu (PWA) je fáza 3.

### D211 — Zdroj živých udalostí je change stream MongoDB; polling je záloha

Server sa o novej správe dozvie z **change streamu** Atlasu
(`courier_messages.watch()` s filtrom na vlákno, resp. na osobu) — zápis je
jedna operácia a čítanie jedna otvorená pozícia na spojenie, bez ďalšej
služby (Redis, Pusher). Keď `watch()` nie je dostupné (lokálny Mongo bez
repliky), SSE prejde na **polling každé 2 s** nad tým istým dotazom.
Obrazovky o rozdiele nevedia; prepína to jedna funkcia `threadEvents()`.

### D212 — Účastníci sú pole vo vlákne do 500; nad to samostatná kolekcia

`participants[]` vo vlákne (`personId`, `email`, `name` ako kópia,
`lastReadAt`, `emailedAt`, `typingAt`, `mutedAt`) je pri 120 ľuďoch pár KB
a index `{ companyCode, "participants.personId", lastMessageAt: -1 }` dá
zoznam vlákien osoby jedným dotazom. Oznam nad **500 príjemcov** uloží
účastníkov do `courier_participants` (jeden dokument na osobu a vlákno),
aby vlákno nerástlo k limitu 16 MB. Kód číta účastníkov **len cez
`participantsOf(thread)`**, takže hranica je vec uloženia, nie obrazoviek.
V SFZ sa druhý režim nespustí; existuje pre väčšieho zákazníka.

### D213 — Dve kolekcie, stránkovanie od začiatku, retencia cez `runRetention`

Vlákno a správy sú **dve kolekcie** (správy ako pole vo vlákne by rástli bez
stropu). Zoznam vlákien po 50, správy vo vlákne po 100 s odkazom na
staršie. Indexy sa zakladajú v kóde pri prvom zápise (ako `askHistory.ts`),
nie ručne v Atlase. Retencia beží v `runRetention` (cron `overdue`), **nie
TTL indexom** — TTL by mazal bez zápisu do `RetentionRun` a DPO potrebuje
vedieť, čo a kedy sa zmazalo. Hľadanie v správach (fáza 2) je Atlas Search
nad `text` s filtrom na účastníka; nie vektorové, nie do „Spýtať sa".

Rozmer: 100 osôb × 5 správ denne ≈ 130 000 správ ročne, ~100 MB za
dvojročnú retenciu. Pri desaťnásobku jednotky GB — stále bez zmeny
architektúry.

### D214 — Kuriér má v hlavičke vlastnú ikonu (obálka); do zvončeka správy nechodia

Zvonček je **„čo sa stalo"** (udalosti systému, `lib/notifications.ts`),
Kuriér je **„kto mi píše"** (človek). Miešať ich by znamenalo, že oznam od
HR stojí v jednom zozname s „preindexovanie dobehlo". Preto má Kuriér
v hlavičke **vlastnú ikonu — obálku** (`Icon name="mail"`, SF Symbols
`envelope` / `envelope.badge`) so štítkom počtu neprečítaných vlákien,
v rovnakom tvare ako zvonček (spoločná trieda `.head-icon`). Poradie
vpravo: **obálka, zvonček, téma, profil** — obálka bližšie k stredu, lebo
sa na ňu klikne častejšie. Na telefóne ostáva v hlavičke; do spodnej lišty
nejde (spodok patrí hlavnej lište aplikácie).

Obálka, nie bublina rozhovoru: sedí k názvu (kuriér nosí listy), Kuriér je
v prvom rade oznamy a rozhovor až druhá vrstva, a bublina by bola vizuálne
blízko ikone „Spýtať sa", ktorá v hlavičke už je. Živé spojenie (D210)
prekresľuje štítok na obálke; zvonček sa Kuriéra netýka.

### D222 — Odkazy von s náhľadom, len v Kuriéri (dodatok 16. 10. 2026)

Ján 16. 10. 2026: „povolil by som aj externé odkazy s náhľadom, ak majú OG
a podobne, zíde sa to." Štyri otázky zodpovedal odporúčanými možnosťami.
Mení D208 v jednom bode — odkaz von, ktorý D208 odkladal na „samostatný
druh segmentu s viditeľným označením":

1. **Len Kuriér.** Spoločný rozklad `formatText.ts` ostáva s vnútornými
   odkazmi; ide ním výstup jazykového modelu a ten nesmie vedieť vyrobiť
   odkaz von. Odkaz von je samostatný krok (`lib/courierLinks.ts`), ktorý
   zapína len zobrazenie správy (`FormattedText external`).
2. **Len `https://`**, bez mena a hesla v adrese. V texte sa ukladá ako
   `[text](https://…)` — ten istý ľahký Markdown, nič sa nestane HTML.
3. **Označenie:** doména a ↗ pri odkaze, otvára sa v novej karte
   (`noopener noreferrer nofollow ugc`). Bez potvrdenia pred odchodom.
4. **Náhľad pri odoslaní, uložený so správou** (`messages.previews[]`,
   najviac tri na správu): názov, popis, názov webu, doména z Open Graph,
   Twitter karty alebo `<title>`. Kópia, nie odkaz — náhľad sa spätne nemení
   a prežije zmazanú stránku. Zlyhanie = správa bez náhľadu, nikdy chyba.
5. **Obrázok** sa pri odoslaní zmenší (WebP, šírka 480 px, najviac 80 kB)
   a uloží k správe. Čitateľ cudzí server nevolá — ten sa nedozvie, kto
   a kedy správu čítal.
6. **Stráž pred vnútornou sieťou (SSRF)** v `lib/safeFetch.ts`: doména sa
   preloží raz a spojenie ide na overenú adresu; súkromné, lokálne,
   rezervované a multicast adresy (IPv4 aj IPv6) sú zakázané; najviac tri
   presmerovania, každé overené znova; limit 5 s, HTML najviac 512 kB,
   obrázok najviac 3 MB; žiadne cookies ani prihlásenie.

### D223 — Kurzíva, podčiarknuté, prečiarknuté a emotikony v Kuriéri (16. 10. 2026)

Ján 16. 10. 2026 k editoru: „chýbajú mi emotikony, naklonené písmo,
podčiarknuté, prečiarknuté písmo a ikona H a B nech je slovom". Rozširuje
D208 rovnako ako D222 — **len v Kuriéri** (`lib/courierInline.ts`,
`FormattedText external`); spoločný rozklad pre odpoveď asistenta a text
predpisov sa nemení.

- Zápis: kurzíva `_text_` (na hranici slova, `snake_case` ostane),
  prečiarknuté `~~text~~`, podčiarknuté `++text++` — Markdown pre
  podčiarknutie štandard nemá, `++` je zaužívané rozšírenie; nikdy HTML.
- Emotikony sú obyčajné znaky Unicode; editor ponúka krátky výber
  najčastejších bez knižnice.
- Tlačidlá formátovania nesú slovo (Tučné, Kurzíva, Podčiarknuté,
  Prečiarknuté, Nadpis), ktoré samo ukazuje formát; skratka je v popise.

## 3. Čo tým vzniká

**Kolekcie** (`companyCode` všade v podmienke, D32):

- `courier_threads` — `subject`, `kind` (`"announcement" | "direct"`),
  `audience` (zmrazená kópia: druhy a názvy ako ADR-005 + počet),
  `participants[]` (D212), `createdBy`, `lastMessageAt`, `replyTo`
  (D205: `"sender" | "all"`), `parentThreadId` pri odpovedi na oznam.
- `courier_messages` — `threadId`, `authorId`, `text` (Markdown), `cards[]`
  (`kind`, `id`, `title` ako kópia), `at`, `editedAt`.
- `courier_participants` — len nad 500 príjemcov (D212).

**Obrazovky:** `/courier` (vlákna, neprečítané hore, archív),
`/courier/new` (publikum, predmet, text, náhľad), `/courier/[id]`
(vlákno, odpoveď, živé spojenie). Štítok „Kuriér" v navigácii pre každého
prihláseného.

**API:** `/api/courier/stream` (SSE, D210–D211), `/api/courier/typing`.

**E-mail:** `courierDigestEmail()` v `lib/ecomail.ts` — zoznam
neprečítaných, tlačidlo, bez tela (D207); cron `/api/cron/courier-digest`.
Jazyk podľa osoby, texty cez i18n (sk/cs/en).

**Hlavička:** obálka so štítkom v `Header.tsx` (D214); `.bell` → `.head-icon`.

**Retencia:** `purgeThreads` v `lib/retentionDb.ts`, `courierMonths`
v nastaveniach, riadok v `RetentionRun`.

## 4. Fázy

| Fáza | Obsah |
|---|---|
| **1 — Oznamy a 1:1** | vlákno od role publiku a 1:1 od kohokoľvek; Markdown + karty obsahu; náhľad pred hromadným odoslaním; živé spojenie v Kuriérovi (SSE + change stream), „píše…" a „prečítané" pri 1:1; obálka v hlavičke; ranný súhrn e-mailom; štítok neprečítaných; odpoveď na oznam súkromne; retencia; /privacy; audit |
| **2 — Rozhovory** | skupinové vlákno s odpoveďou všetkým (voľba pri založení); stlmenie vlákna; úprava vlastnej správy do 15 minút so značkou „upravené"; hľadanie v mojich vláknach; koncept |
| **3 — Doplnky** | odoslanie v naplánovanom čase; príznak „dôležité"; výber karty obsahu vyhľadávaním v knižnici; push (PWA); export vlákna pre DPO v jednom kroku |

## 5. Čo sa zámerne nerobí

- **Odpoveď e-mailom späť** — správy zostávajú na platforme (Ján).
- **Prílohy** — nahrádzajú ich karty obsahu s kontrolou prístupu (D208).
- **Zoznam mien, kto čítal** — to sú Potvrdenia (D206).
- **Správa, ktorú treba potvrdiť** — to je pridelenie s termínom (ADR-004,
  ADR-005); messenger nie je dôkazný záznam a nesmie sa ním stať.
- **Živé spojenie mimo Kuriéra** — štítok na obálke inde žije navigáciou (D210).
- **Správy v zvončeku** — zvonček je systém, obálka je človek (D214).
- **E-mail pri každej správe** — len ranný súhrn (D207).
- **Externí adresáti** — ich cesta je ticket (ADR-028).

## 6. Dôsledky

- Vzniká štvrtý kanál smerom k človeku (zvonček, e-mail, ticket, Kuriér).
  Hranica je v tom, kto píše: udalosť systému → zvonček; šablóna krokov →
  e-mail; človek zvonku → ticket; **človek zvnútra → správa**.
- Dve nové kolekcie s osobnými údajmi → záznam o spracovateľských
  činnostiach (O15/O16) dostáva riadok, /privacy odsek, retencia pravidlo.
- `formatText.ts` dostáva druhého producenta (človek). Jeho pravidlá
  (len vnútorné odkazy, žiadne HTML) sa tým nemenia — práve naopak, sú
  dôvodom, prečo sa nepoužije nič iné.
