<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-042 — Widget kanála ISSF Helpdesk namiesto formulára Pomoc v ISSF: najprv hľadanie, potom ticket s údajmi z ISSF, e-mail ako záloha

> **Stav:** prijaté · **Dátum:** 2026-10-27
> **Rozhodol:** Ján Letko (2026-10-27) — „dnes používatelia používajú na
> odoslanie emailu na helpdesk@futbalsfz.sk formulár Pomoc v ISSF, ktorý len
> prepošle správu s dodatočnými informáciami o osobe a klube do mailu, to
> chceme celé nahradiť týmto kanálom"; „cieľom je nechať osobu hľadať, potom
> ak na 2–3 pokus nedostane odpoveď, alebo jasne napíše, že chce poslať
> správu, umožniť osobe poslať správu cez kanál, ktorá rovno založí ticket";
> „všetky tieto pomocné informácie potrebuje človek pri tickete vidieť";
> „ak nič nefunguje, ukážeme používateľovi e-mailovú adresu
> helpdesk@futbalsfz.sk"; k návrhu: „Áno, beriem odporúčania D1–D6."
> **Čísla rozhodnutí:** D275–D280 (v návrhu D1–D6) · Dodatok 1: D281–D285
> (nastavenie widgetu z Continea, poloha, zrušenie stránky Pomoc).
> **Nadväzuje na:** ADR-028 (kanály, schránka cez adaptér, e-mail ako
> ticket, identita z ISSF tokenom, D163, D166, D169), `docs/WIDGET_ISSF.md`
> (skúška v ISSF 26. 10. 2026, vzor tokenu v Jave, #459), D24 (dôkazné
> záznamy sa nemenia), D12 (odpoveď odosiela vždy človek).
> **Implementácia:** šesť krokov (§ 3, doplnené Dodatkom 1); krok 1 je
> podmienka spustenia.

---

## 1. Kontext

Formulár **Pomoc** v ISSF (`/Pomoc`) má jediné pole „Popis problému".
ISSF z neho pošle na `helpdesk@futbalsfz.sk` e-mail „ISSF Pomoc": text
a pod ním blok **Odosielateľ** — `login`, `registracneCislo`, `meno`,
`priezvisko`, `email`, `mobil`, `telefon`, `klub`, `sys_klubId`, `roly`
(`{HRAC}`), `zvazy`, `sys_pouzivatelId`, `sys_osobaId`, `sys_date`,
`Prostredie`. Do Continea prichádza cez Microsoft Graph ako e-mailový
ticket; údaje z bloku sú len text v tele.

Widget kanála ISSF Helpdesk (ADR-028, krok 5) už vie odpovedať z manuálov
ISSF a predpisov, po dvoch palcoch dole ponúknuť správu helpdesku a založiť
ticket s identitou z tokenu. Skúška v ISSF (26. 10. 2026) ukázala, že sa
do stránky vloží bez prekážok.

Pri návrhu sa ukázali dve medzery:

- **Ticket z widgetu nemá e-mailové vlákno.** Odpoveď riešiteľa odchádza
  ako nová správa (`mailbox.send`, Graph `sendMail` nevracia identifikátor
  vlákna); keď na ňu človek odpovie, synchronizácia schránky založí
  **druhý ticket** bez údajov z ISSF.
- **Jeden e-mail, viac účtov ISSF.** V ukážke z 22. 10. 2026 patrí účet
  hráčovi, e-mail rodičovi a podpis tretej osobe. Osoba v Contineu je
  dvojica (organizácia, e-mail) — index `tenant_email_unique` — a nesie
  jediné registračné číslo; pri striedaní účtov z jednej adresy sa číslo
  a meno osoby prepisujú.

## 2. Rozhodnutia

### D275 — Kedy widget ponúkne správu helpdesku (v návrhu D1)

Správa helpdesku sa ponúkne **po dvoch neúspechoch** (palec dole alebo
asistent nevedel odpovedať — tak je to dnes), cez **stále viditeľný tichý
odkaz „Napísať helpdesku"** po prvej odpovedi a **hneď**, keď človek
napíše vetu typu „chcem napísať helpdesku / spojiť sa s človekom"
(zoznam fráz v sk, cs, en — nie rozpoznávanie zámeru modelom).

Formulár správy je predvyplnený poslednou otázkou a ukazuje, **kam príde
odpoveď** („Odpoveď príde na …" — e-mail z tokenu).

Prečo: predvídateľné, bez ceny za volanie modelu, a človek aj tak najprv
hľadá. Klasifikácia zámeru modelom by bola drahšia a menej spoľahlivá.

### D276 — Údaje z ISSF pri tickete: `phone_number` a `context` (v návrhu D2)

Token dostane dva nepovinné claimy:

- **`phone_number`** (štandardný claim OIDC) — z `mobil` alebo `telefon`;
- **`context`** — objekt názov → text, **najviac 10 položiek**, napr.
  `{"ID klubu": "…", "Zväzy": "…", "ID používateľa": "123456",
  "ID osoby": "654321"}`. Čísla ako text **bez oddeľovača tisícov**.

Widget k ticketu sám priloží **adresu stránky ISSF**, z ktorej človek písal.
Riešiteľ ich vidí pri tickete ako tabuľku „Údaje z ISSF"; sú to **kópie
v čase správy** (ako meno, roly a klub dnes), nie odkaz.

Mapovanie z dnešného e-mailu: `registracneCislo` (= `login`) → `sub`;
`meno`, `priezvisko` → `given_name`, `family_name`; `email` → `email`;
`klub` → `club`; `roly` → `roles`; ostatné `sys_*` a `zvazy` → `context`.
`sys_date` a `Prostredie` netreba — čas zapisuje Contineo, prostredie
rozlišuje `iss` (testovacie ISSF je iný povolený pôvod kanála).

Prečo: riešiteľ uvidí všetko, čo vidí dnes, a ISSF môže pridať údaj bez
zmeny v Contineu. Pevné claimy by znamenali zmenu pri každom novom údaji.

### D277 — Potvrdenie e-mailom založí vlákno ticketu z widgetu (v návrhu D3)

Po založení ticketu z widgetu Contineo pošle z adresy schránky kanála
**potvrdenie** („Prijali sme vašu správu", text správy, veta, že odpoveď
príde e-mailom a že sa na potvrdenie dá odpovedať) a **identifikátor jeho
vlákna uloží do ticketu**
(`threadRef`). Odpoveď riešiteľa potom ide **odpoveďou v tom vlákne**
a odpoveď človeka sa synchronizáciou schránky pripojí k **tomu istému**
ticketu.

Potvrdenie je automatická správa o prijatí, nie odpoveď na otázku —
D12 (odpoveď odosiela vždy človek) sa ho netýka. Ticket sa založí aj vtedy,
keď potvrdenie neodíde (výpadok schránky); vlákno vtedy vznikne prvou
odpoveďou riešiteľa — ticket si ho z odoslanej správy zapíše.

Lehota odpovede (v ISSF dnes „do 48 hodín v pracovných dňoch") sa do
potvrdenia **nepíše natvrdo** — je to záväzok konkrétneho helpdesku, nie
Continea. Pribudne s nastavením kanála, keď ho bude treba.

Technicky (krok 1, 27. 10. 2026): Graph `sendMail` vracia 202 bez tela,
preto sa posiela cez koncept (`POST /messages` → `/send`), ktorý nesie
`conversationId` a `internetMessageId`; hlavička
`Prefer: IdType="ImmutableId"` drží identifikátor platný aj po presune do
Odoslaných. Odpoveď riešiteľa na potvrdenie ide cez `createReply`
s výslovným adresátom — obyčajná `reply` na vlastnú správu by odpovedala
schránke samej. Keď človek odpovie e-mailom, ďalšia odpoveď ide na jeho
správu (`answerRoute` v `app/src/lib/tickets.ts`).

Prečo: bez vlákna sa rozhovor rozpadne na dva tickety a druhý stratí
údaje z ISSF. Potvrdenie je jediný moment, keď vlákno môže vzniknúť bez
čakania na riešiteľa — a človek zároveň vie, že správa došla.

### D278 — Formulár Pomoc sa vypne v deň spustenia widgetu (v návrhu D4)

Odkazy „Pomoc" v ISSF otvoria panel widgetu. Formulár sa vypne **v deň
spustenia**, nie po súbežnej prevádzke. *(Upravené Dodatkom 1, D285:
stránka `/Pomoc` celá zaniká — nekreslí sa ani text s tlačidlom.)*

Keď widget nenabehne alebo zlyhá, ukáže sa `helpdesk@futbalsfz.sk`
(náhradný blok `onerror` a kontakt pod chybou — už dnes); e-mail sa načíta
cez Graph ako doteraz.

Prečo: dve cesty naraz by rozdelili tickety a nedalo by sa vyhodnotiť,
či widget pomáha.

### D279 — Prílohy až v ďalšej fáze (v návrhu D5)

Widget prílohy (snímky obrazovky) zatiaľ neposiela. Dnešný formulár ich
nemá; kto ich potrebuje, pošle e-mail cez `mailto`.

### D280 — Osoba z widgetu je e-mailový kontakt, účet ISSF je údaj ticketu (v návrhu D6)

Osoba v Contineu založená z widgetu je **kontakt, ktorému sa odpovedá**
(e-mail). Účet ISSF — registračné číslo, meno a priezvisko držiteľa účtu,
roly, klub, `context` — je **údaj ticketu v čase správy** (kópia z tokenu,
ako dnes `asker.reference`). Ku kontaktu sa namiesto jedného registračného
čísla ukladá **zoznam** čísel, z ktorých písal; pri novom čísle sa pridá,
nič sa neprepisuje. Meno kontaktu sa z tokenu **neprepisuje** pri každej
otázke.

Pri tickete sa ukáže napr. „Účet ISSF: Peter Hráč (1234567) · odpoveď
na: …@gmail.com", aby riešiteľ videl, že píše niekto za hráča.

Zmena tvaru `externalRef.widget.<kanál>` z hodnoty na zoznam je **zmena
dát** — robí sa migráciou, nie refaktorom (`CLAUDE.md`).

Prečo: index `tenant_email_unique` dve osoby s jednou adresou nepripustí
a ani to netreba — odpoveď ide na adresu, nie na účet. Účet je údaj
o tom, za koho sa píše.

## 3. Implementácia

1. **Vlákno ticketu z widgetu (D277)** — potvrdenie e-mailom s
   identifikátorom vlákna, `threadRef` v tickete, odpoveď riešiteľa vo
   vlákne. **Podmienka spustenia.**
2. **Zoznam registračných čísel pri osobe (D280)** — migrácia
   `externalRef.widget.<kanál>`, párovanie bez prepisovania. Osoba sa
   hľadá podľa e-mailu (nie najprv podľa účtu); kód číta oba tvary
   (`widgetRefs()`), takže poradie nasadenie → `npm run migrate:widget-refs`
   je bezpečné.
3. **`phone_number`, `context`, adresa stránky (D276)** — overenie tokenu,
   tabuľka „Údaje z ISSF" pri tickete, vzor v Jave a `docs/WIDGET_ISSF.md`.
4. **Nastavenie widgetu z Continea (Dodatok 1, D281–D284)** — poloha
   na ôsmich miestach, veľkosť panela, texty, správanie ponuky helpdesku
   ako nastavenie kanála; cache skriptu 5 minút s ETag; náhľad. Pred
   krokom 5, aby krok 5 nenapísal napevno to, čo je nastavením.
5. **Ponuka správy vo widgete (D275)** — odkaz, frázy, predvyplnená správa,
   zobrazený e-mail — s hodnotami z nastavenia kanála (D283);
   `ContineoHelpdesk.open()` pre odkazy „Pomoc" v ISSF (D285).
   *Technicky (27. 10. 2026):* frázy sa porovnávajú ako časť vety bez
   diakritiky a veľkých písmen (`normalizePhrase`), skript dostane frázy
   všetkých jazykov rozhrania naraz; pri fráze sa asistent nepýta.
   Adresu odpovede číta skript z claimu `email` v tokene (údaj
   prihláseného človeka, nie tajomstvo). Odkaz „Napísať helpdesku“ je tiché
   tlačidlo pod poľom otázky; formulár správy má „Zrušiť“.
6. **Na strane ISSF (D278, D285)** — tajný kľúč kanála (vytvára Ján),
   vydávanie tokenu, `/api/contineo-token`, vloženie kódu, odkazy „Pomoc"
   na `ContineoHelpdesk.open()`, zrušenie formulára a stránky `/Pomoc`.

---

## Dodatok 1 — Nastavenie widgetu z Continea (2026-10-27)

> **Rozhodol:** Ján Letko (2026-10-27) — „potrebujem také riešenie, že si
> budeme vedieť do externého systému, napríklad ISSF, po zavedení meniť
> obsah widgetu v ISSF, správanie aj veľkosť"; „ja chcem formulár Pomoc
> úplne zrušiť a zaviesť len plávajúci widget, určenie polohy je super";
> „vľavo v strede, lebo vľavo dole bývajú tlačidlá exportu zostáv
> a schvaľovania žiadostí"; odkazy Pomoc „otvárať nimi widget, ale toto
> je špeciálne len pre ISSF, nie je to štandard, štandard je len …
> umiestnenie dookola obrazovky a nielen po rohoch, ale aj v strede strán".

### Kontext

Skript widgetu generuje Contineo pri každom stiahnutí
(`/api/widget/<kľúč>/script`) — texty, farba, zdroje a kontakt pri výpadku
sa preto menia v Contineu bez zásahu v ISSF už dnes. Napevno v skripte je
poloha (vpravo dole), veľkosť panela (400 × 600 px) a správanie (ponuka
helpdesku po dvoch neúspechoch). Skript sa cachuje hodinu.

V ISSF je hore cez celú šírku menu, vľavo dole tlačidlá exportu zostáv
a schvaľovania žiadostí, vpravo dole tabuľky so stĺpcom akcií.

### D281 — Zmluva s cudzím systémom je zmrazená

Cudzí systém dodá **raz**: `<script src>` s kľúčom kanála, `data-token`,
`data-token-url` a náhradný blok s kontaktom. Všetko ostatné — vzhľad,
poloha, veľkosť, texty a správanie — je **nastavenie kanála v Contineu**
a prejaví sa bez zmeny u cudzieho systému.

Prečo: každá ďalšia zmena by inak čakala na vývojárov cudzieho systému.

### D282 — Poloha tlačidla: osem miest okolo obrazovky, predvolene vpravo v strede

Tlačidlo widgetu sa dá umiestniť do **štyroch rohov a do stredu každej
strany** (vľavo hore, hore v strede, vpravo hore, vpravo v strede, vpravo
dole, dole v strede, vľavo dole, vľavo v strede). **Predvolené je vpravo
v strede** *(zmena 27. 10. 2026, pôvodne vľavo v strede — viď nižšie)*. Panel sa otvára vedľa tlačidla smerom dovnútra obrazovky; pod
640 px je panel celá obrazovka ako doteraz.

Je to **štandard** — nastavenie každého kanála typu widget, nie úprava
pre ISSF. Tvar tlačidla a panela sa nemení; poloha nie je nový prvok
dizajnu.

Prečo predvolene v strede strany: v ISSF je hore menu, vľavo dole
tlačidlá exportu zostáv a schvaľovania žiadostí a vpravo dole tabuľky
s akciami — stred strany nezakrýva nič, čo sa používa.

*Zmena predvolenej strany (Ján Letko, 27. 10. 2026):* po ukážke widgetu
v ISSF „ak bude button vpravo v strede obrazovky, tam dajme aj default".
Vpravo v strede je tlačidlo tam, kde ho ľudia z webov poznajú, a otvorený
panel neprekryje ľavé menu sekcie. Kanál, ktorý má polohu uloženú,
ostáva, ako je; zmena platí pre kanály bez uloženej polohy a pre nové.

### D283 — Veľkosť, texty a správanie ponuky helpdesku sú nastavenie kanála

V nastavení kanála (časť „Vzhľad a správanie widgetu"):

- **veľkosť panela** — tri predvoľby (malý, stredný, veľký), nie voľné
  pixely: voľné rozmery by sa na niektorej šírke rozbili;
- **text tlačidla a privítanie** v jazykoch kanála;
- **ponuka správy helpdesku** (D275) — po koľkých neúspechoch (1–3,
  predvolene 2), stále viditeľný odkaz „Napísať helpdesku" (predvolene
  zapnutý), frázy, pri ktorých sa ponúkne hneď (predvolené sk/cs/en).

D275 tým ostáva v platnosti ako **predvolené hodnoty** týchto nastavení.

### D284 — Zmena sa prejaví do 5 minút; náhľad; audit

Skript sa cachuje **5 minút** s `ETag` (prehliadač ho stiahne znova len
pri zmene), nie hodinu. V nastavení kanála je **náhľad widgetu** —
stránka so skriptom a dočasným tokenom prihláseného správcu, aby správca
zmenu videl skôr než ľudia v cudzom systéme. Uloženie platí hneď
a zapíše sa do **auditu** (kto, kedy, čo); návrat je ďalšie uloženie.
Koncepty a zverejňovanie nastavenia sa nerobia, kým to niekto nebude
potrebovať.

### D285 — Formulár a stránka Pomoc v ISSF zanikajú; odkazy „Pomoc" otvárajú widget

V ISSF ostane **len plávajúci widget**. Formulár Pomoc aj stránka `/Pomoc`
zanikajú (upravuje D278 — text s tlačidlom na `/Pomoc` sa nekreslí).

Odkazy „Pomoc" v ISSF ostanú a **otvoria panel widgetu**. Skript na to
ponúkne všeobecné `ContineoHelpdesk.open()`; keď skript nenabehol, odkaz
vedie na `mailto:helpdesk@futbalsfz.sk`. **Použitie je integrácia ISSF,
nie štandard ani nastavenie kanála** — opisuje sa v `docs/WIDGET_ISSF.md`.
Iný cudzí systém dostane len plávajúce tlačidlo podľa D282.
