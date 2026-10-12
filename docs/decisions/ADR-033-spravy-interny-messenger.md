# ADR-033 — Správy: formátované správy osobám a interný messenger

> **Stav:** prijaté · **Dátum:** 2026-10-12
> **Rozhodol:** Ján Letko (2026-10-12) — „Potrebujeme doplniť do Contineo
> možnosť posielať formátované správy osobám, nie notifikácie, ale správy,
> prílohy nie, maximálne ako link na iný obsah, správy zostávajú na
> platforme, človeku ide iba notifikácia o novej správe s predmetom správy.
> Naplánujme aj celý interný systém interného messengera, pre prípad
> možnosti odpovedí a podobne." Štyri doplňujúce otázky zodpovedal
> odporúčanými možnosťami (D204–D207).
> **Nadväzuje na:** D39, D40 a `lib/notifications.ts` (zvonček nesie
> udalosti, nie správy), ADR-005 (publikum pridelenia: osoba, oddelenie,
> skupina, trasa, všetci — kópia, nie odkaz), D27 (stav sa odvodzuje),
> D32 (`companyCode` v podmienke dotazu), ADR-012 a ADR-022 (retencia
> a text ochrany údajov), ADR-028 D178 (lehota ticketov ako vzor
> nastaviteľnej retencie), `lib/formatText.ts` (ľahký Markdown bez HTML, len
> vnútorné odkazy).
> **Implementácia:** fáza 1 — plánovaná, vetva `docs/adr-033-spravy` nesie
> len toto rozhodnutie.

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

### D204 — Správy sú modul `messages` s vláknami; oznam aj rozhovor sú to isté

Vzniká modul **Správy** (`/messages`). Základ je **vlákno** (`thread`):
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
vlákien je štítok **„Správy 3"** v navigácii — rovnako ako „Na potvrdenie
3". Zvonček ho neopakuje (dve miesta s tou istou pravdou sa raz rozídu —
`lib/notifications.ts`).

### D207 — E-mail ide raz na vlákno, do otvorenia, a nesie len predmet

Keď do vlákna príde správa a účastník má v ňom **nič neprečítané**, dostane
e-mail: predmet vlákna, kto píše, tlačidlo „Otvoriť správu". **Telo správy
platformu neopustí.** Ďalšie správy v tom istom vlákne e-mail **neposielajú**,
kým ho človek neotvorí — živý rozhovor by inak poslal desať e-mailov za
minútu. Značka „e-mail odoslaný" je na účastníkovi vlákna a nuluje sa
otvorením. Odpovedať e-mailom späť do Contineo sa **nedá** (zámerne —
správy zostávajú na platforme; a schránka Contineo nie je schránka
kanála, ADR-028).

### D208 — Formátovanie je ľahký Markdown cez `formatText.ts`; prílohy nahrádzajú karty obsahu

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
  lehota je nastaviteľná v organizácii (`messageMonths`, 1–120) ako lehota
  ticketov (D178). Osoba odstránená z organizácie z vlákien zmizne
  retenciou, nie hneď — druhý účastník rozhovoru oň nepríde skôr.
- **DPO** vie vydať vlákna osoby ako súčasť exportu pri žiadosti dotknutej
  osoby (ADR-012). Námietka sa správ netýka — nie sú spracúvané na základe
  oprávneného záujmu, ale na základe pracovnoprávneho vzťahu (interná
  komunikácia).
- **/privacy** dostane nový odsek „Správy" (účel, údaje, základ, lehota,
  príjemcovia) a posun `PRIVACY_NOTICE_VERSION`.

### D210 — Bez živého pripojenia; stránka funguje bez JavaScriptu

Správy sa čítajú a píšu obyčajnými formulármi; počet neprečítaných sa
obnoví pri každej navigácii. Žiadny websocket, žiadny polling v prvých
dvoch fázach. Contineo je intranet, kde človek otvorí stránku, prečíta,
odpovie a zavrie; messenger s indikátorom písania je iný produkt. Push
do telefónu (PWA) je až fáza 3 a vznikne, keď bude prvý skutočný dôvod —
rovnako ako vznikla kolekcia `notifications`.

## 3. Čo tým vzniká

**Kolekcie** (`companyCode` všade v podmienke, D32):

- `message_threads` — `subject`, `kind` (`"announcement" | "direct"`),
  `audience` (zmrazená kópia: druhy a názvy ako ADR-005 + počet),
  `participants[]` (`personId`, `email`, `name` ako kópia, `lastReadAt`,
  `emailedAt`, `mutedAt`), `createdBy`, `lastMessageAt`, `replyTo`
  (D205: `"sender" | "all"`), `parentThreadId` pri odpovedi na oznam.
- `messages` — `threadId`, `authorId`, `text` (Markdown), `cards[]`
  (`kind`, `id`, `title` ako kópia), `at`, `editedAt`.

**Obrazovky:** `/messages` (vlákna, neprečítané hore, archív),
`/messages/new` (publikum, predmet, text, náhľad), `/messages/[id]`
(vlákno, odpoveď). Štítok „Správy" v navigácii pre každého prihláseného.

**E-mail:** `messageEmail()` v `lib/ecomail.ts` — predmet, autor, tlačidlo,
bez tela. Jazyk podľa osoby, texty cez i18n (sk/cs/en).

**Retencia:** `purgeThreads` v `lib/retentionDb.ts`, `messageMonths`
v nastaveniach, riadok v `RetentionRun`.

## 4. Fázy

| Fáza | Obsah |
|---|---|
| **1 — Oznamy** | vlákno od role publiku a 1:1 od kohokoľvek; Markdown + karty obsahu; náhľad pred hromadným odoslaním; e-mail raz na vlákno; štítok neprečítaných; odpoveď na oznam súkromne; retencia; /privacy; audit |
| **2 — Rozhovory** | skupinové vlákno s odpoveďou všetkým (voľba pri založení); stlmenie vlákna; úprava vlastnej správy do 15 minút so značkou „upravené"; hľadanie v mojich vláknach; koncept |
| **3 — Doplnky** | odoslanie v naplánovanom čase; príznak „dôležité"; výber karty obsahu vyhľadávaním v knižnici; push (PWA); export vlákna pre DPO v jednom kroku |

## 5. Čo sa zámerne nerobí

- **Odpoveď e-mailom späť** — správy zostávajú na platforme (Ján).
- **Prílohy** — nahrádzajú ich karty obsahu s kontrolou prístupu (D208).
- **Zoznam mien, kto čítal** — to sú Potvrdenia (D206).
- **Správa, ktorú treba potvrdiť** — to je pridelenie s termínom (ADR-004,
  ADR-005); messenger nie je dôkazný záznam a nesmie sa ním stať.
- **Živé pripojenie a indikátor písania** (D210).
- **Externí adresáti** — ich cesta je ticket (ADR-028).

## 6. Dôsledky

- Vzniká štvrtý kanál smerom k človeku (zvonček, e-mail, ticket, správa).
  Hranica je v tom, kto píše: udalosť systému → zvonček; šablóna krokov →
  e-mail; človek zvonku → ticket; **človek zvnútra → správa**.
- Dve nové kolekcie s osobnými údajmi → záznam o spracovateľských
  činnostiach (O15/O16) dostáva riadok, /privacy odsek, retencia pravidlo.
- `formatText.ts` dostáva druhého producenta (človek). Jeho pravidlá
  (len vnútorné odkazy, žiadne HTML) sa tým nemenia — práve naopak, sú
  dôvodom, prečo sa nepoužije nič iné.
