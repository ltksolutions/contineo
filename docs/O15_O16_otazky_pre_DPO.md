# O15 / O16 — otázky pre DPO a právnika

> **Čo to je:** zoznam rozhodnutí, ktoré Contineo potrebuje od DPO a právnika, aby sa dalo spustiť do ostrej prevádzky. Otázky sú formulované tak, aby sa dalo odpovedať „súhlasím" alebo prepísať návrh.
> **Čo to nie je:** právne stanovisko. Návrhy pri otázkach sú to, čo vyplýva z doterajšej dokumentácie produktu — sú to podklady, nie právny názor.
> **Pripravil:** IT (Ján Letko) · **Dátum:** 12. 9. 2026 · **Odpovede prosíme do:** ____________
> **Súvisiace:** `docs/GDPR_DATA_PROTECTION.md` · `docs/OPEN_DECISIONS.md` (D10, O15, O16) · ADR-003, ADR-005, ADR-006

---

## Odpovede DPO (prijaté 2026-09-23)

Odpovede prišli v revízii dokumentu (označené voľby a poznámky). Zapísané doslovne
podľa zmyslu, bez výkladu; kde odpoveď chýba, je to povedané.

| # | Odpoveď | Poznámka DPO | Čo s tým systém robí |
|---|---|---|---|
| A1 | súhlasím (nie súhlas dotknutej osoby) | kategorizovať: **plnenie zákonnej povinnosti** pre povinnosti zo zákona (napr. BOZP), **oprávnený záujem** pre interné smernice bez zákonnej opory | **D91** — právny základ pri znení, odkaz na predpis pri zákonnej povinnosti povinný |
| A2 | súhlasím (čas čítania oddelene) | — | bez zmeny |
| A3 | — | vykoná **DPO**, zodpovedá **štatutár (prezident)**, termín **pred spustením pilotu** | brána pred pilotom |
| A4 | potvrdzujem | — | pozor: pri oprávnenom záujme právo namietať (čl. 21) — návrh úpravy v `GDPR_DATA_PROTECTION.md` §6 na potvrdenie |
| A5 | ponechať | musí byť súčasťou balančného testu, lehotu viazať na B1 | bez zmeny |
| A6 | áno, s informovaním | — | bez zmeny; patrí do C1 |
| A7 | súhlasím | — | bez zmeny |
| B1 | od **skončenia pomeru** | **minimálne 3 roky** | čaká na presné číslo a strop (B10) |
| B2–B4 | rovnako ako B1 | — | čaká na B1 |
| B5–B7 | **bez odpovede** | — | otvorené |
| B8 | **mazať** | zásada minimalizácie uchovania | mazať celý riadok |
| B9 | súhlasím | — | držať podľa B1 aj po skončení platnosti predpisu |
| B10 | bez označenej voľby | zvážiť **maximálny strop**, ak dátum skončenia nepríde (odkaz na § 10, 12, 13 zákona o ochrane osobných údajov) | otvorené — strop treba určiť |
| C1–C4 | **bez odpovede** | — | otvorené; C1 a A3 sú brány pred pilotom |

## Odpovede DPO — druhé kolo (prijaté 2026-09-24)

Odpovede prišli v `O15_O16_otazky_pre_DPO_kolo2-2.docx` ako **červené podfarbenie**
pri zvolenej možnosti (zaškrtávacie okienka sa vo Worde nedali použiť; ďalšie
dotazníky preto pôjdu bez nich, viď poznámku na konci). Zapísané doslovne podľa
zmyslu, bez výkladu.

| # | Odpoveď | Poznámka DPO | Čo s tým systém robí |
|---|---|---|---|
| A8 | súhlasím — námietka sa posúdi jednotlivo podľa balančného testu, doklad sa do rozhodnutia nemaže | — | veta v `GDPR_DATA_PROTECTION.md` §6 potvrdená; námietka dostane evidenciu a obrazovku |
| A9 | súhlasím — základ podľa predpisu aj pri rozhodcoch, funkcionároch a externých; namiesto pomeru **skončenie vzťahu so zväzom** | — | lehota sa počíta od konca vzťahu, nie len pracovného pomeru |
| A10 | súhlasím — základ určuje **zodpovedná osoba**, DPO dostane **raz za štvrťrok** zoznam na kontrolu | — | D91 platí; treba výkaz pre DPO |
| A11 | **jeden spoločný** balančný test pre „záznam o oboznámení s internou smernicou" (vrátane IP a prehliadača) | termín testu nevyplnený | test nie je podmienkou zverejnenia predpisu |
| B1a | **3 roky** od skončenia pomeru | — | lehota pre `acknowledgements`, `assignments`, `document_opens` |
| B10a | súhlasím s oboma poistkami — lehota od **vyradenia**, ak dátum z HR nepríde, a **absolútny strop** | počet rokov **nevyplnený**; poznámka: „strop napríklad 5 rokov. Môže slúžiť aj na osvieženie pamäti pre zamestnancov." | ⚠️ 5 rokov je príklad, nie rozhodnutie — potvrdiť číslo |
| B10b | súhlasím — pri osobách bez pomeru od skončenia vzťahu (licencia, funkcia, spolupráca); dátum dodá útvar, ktorý vzťah eviduje | — | kým dátum nepríde, platí poistka z B10a |
| B5 | potvrdzujem **12 mesiacov** (čas čítania) | — | bez zmeny (TTL už beží) |
| B6 | **24 mesiacov** (audit prístupov) | — | TTL na `audit` treba zaviesť |
| B7 | potvrdzujem **90 dní** (log pripomienok) | — | bez zmeny (TTL už beží) |
| B4a | súhlasím — schválenie sa drží, **kým existuje aspoň jeden doklad** o oboznámení s tým znením | — | `approval_rounds` sa mažú s posledným potvrdením znenia |
| B11 | súhlasím — zodpovedná osoba má **rovnakú lehotu ako schválenie** | — | súčasť dokladu o znení |
| C1, C2 | **bez odpovede** (zodpovedný a termín nevyplnené) | — | otvorené; C1 je brána pred pilotom |
| C3 | **bez odpovede** | — | otvorené |
| C4 | **bez odpovede** | „Toto doriešiť s Miškou (resp. Lukáš)" | zmluvy (DPA, Sportnet, sub-procesori) — riešiť mimo DPO |

**Čo nevrátila:** kontrolu číselníka `Pravne_zaklady_navrh_ciselnika.docx` —
`codelists/legalBasis.json` sa preto stále nemá opraviť ani podľa neho vyberať.

**Zostáva otvorené:** počet rokov stropu (B10a), termín balančného testu (A11, A3),
C1–C4.

**Forma ďalších dotazníkov:** bez zaškrtávacích okienok. Pri každej otázke
**očíslované možnosti** a riadok „Odpoveď: ___", kam sa napíše číslo voľby alebo
vlastný text — funguje vo Worde, v PDF aj v e-maile.

---

**Na druhé kolo:** presný počet rokov v B1 a maximálny strop (B10), lehoty B5–B7, časť C,
úprava vety v §6 pre oprávnený záujem a osoby bez pracovného pomeru (rozhodcovia,
funkcionári, externí — `persons.personType`), pri ktorých „skončenie pracovného pomeru"
ani zákonná povinnosť zamestnávateľa nemusia platiť.

---

## 0. Kontext na desať riadkov

Contineo je vnútorný systém zväzu. Robí tri veci, pri ktorých vznikajú osobné údaje:

1. **Pridelí** človeku záväzný predpis — „toto si máš prečítať, do dátumu X, lebo Y".
2. **Zaznamená, že sa s ním oboznámil** — doslovné znenie formulky, ktorú potvrdil, spolu s odtlačkom mena, dokumentu a znenia v čase potvrdenia.
3. **Vedie okolo toho reťaz dôkazov** — kedy si znenie prvýkrát otvoril, koľko času nad ním strávil, komu a kedy sa pripomenulo, kto znenie schválil.

Role sú rozhodnuté (D10, 26. 6. 2026): **zväz = prevádzkovateľ, Contineo = sprostredkovateľ.** Osobitné kategórie údajov (čl. 9) sa zámerne nespracúvajú.

Nerozhodnuté zostáva dvoje: **na akom právnom základe** to stojí (O15) a **ako dlho sa to drží** (O16). Kým to nie je rozhodnuté, systém buď zbiera údaj, ktorý nevie zdôvodniť, alebo drží záznam, ktorý nevie zmazať.

---

## Časť A — Právny základ (O15)

### A1. Aký je právny základ pre záznam o oboznámení (`acknowledgements`)?

*Prečo sa pýtame:* od odpovede závisí, čo systém urobí pri prvej žiadosti o výmaz.

**Náš návrh:** plnenie povinnosti zamestnávateľa / oprávnený záujem prevádzkovateľa — **nie súhlas.** Odvolateľný súhlas a nezvratný doklad o oboznámení sú protirečenie: keby sa dal odvolať, doklad by prestal byť dokladom presne vtedy, keď je potrebný.

**Odpoveď:** ☐ súhlasím · ☐ iný základ: ______________________________

### A2. Platí ten istý základ pre celú reťaz, alebo pre každú časť iný?

Ide o `assignments` (pridelenie a jeho dôvod), `document_opens` (prvé otvorenie), `reading_times` (čas nad znením), `approval_rounds` (kto znenie schválil), `reminder_log` (komu sa v ktorý deň odoslalo).

*Prečo sa pýtame:* nie sú to rovnaké údaje. Potvrdenie je doklad o splnení povinnosti, čas čítania je meranie správania.

**Náš návrh:** rovnaký základ pre pridelenie, otvorenie, potvrdenie a schválenie — sú to časti jedného dokladu. **Čas čítania oddelene**, lebo je výslovne informatívny a dôkazom nie je.

**Odpoveď:** ☐ súhlasím · ☐ inak: ______________________________

### A3. Ak pôjde o oprávnený záujem — kto vypracuje balančný test a dokedy?

*Prečo sa pýtame:* bez písomného testu je oprávnený záujem tvrdenie, nie doklad.

**Náš návrh:** DPO, pred spustením pilotu. Presný zoznam toho, čo sa zbiera, je v prílohe na konci.

**Odpoveď:** zodpovedá ____________________ · termín ____________________

### A4. Potvrdzujete vetu, podľa ktorej sa systém zachová pri žiadosti o výmaz?

Veta je dnes v `GDPR_DATA_PROTECTION.md` §6 a znie:

> „Potvrdenie, pridelenie a otvorenie znenia sú záznamy o splnení povinnosti voči zamestnávateľovi, nie údaje spracúvané so súhlasom — na žiadosť sa nemažú, kým trvá dôvod, pre ktorý existujú."

*Prečo sa pýtame:* je to tvrdenie o práve, nie o technike, a systém sa podľa neho zachová pri prvej žiadosti o výmaz.

**Náš návrh:** potvrdiť v tomto znení. Čas čítania sa naopak na žiadosť **vymaže** — dokladom nie je.

**Odpoveď:** ☐ potvrdzujem · ☐ upraviť takto: ______________________________

### A5. Smie sa pri potvrdení ukladať IP adresa a údaj o prehliadači?

*Prečo sa pýtame:* dnes sa ukladajú (`ip`, `userAgent`) ako okolnosti potvrdenia. Sú to údaje navyše oproti samotnému dokladu.

**Náš návrh:** ponechať — zvyšujú dôkaznú hodnotu pri spore o to, či človek potvrdil. Ak to neobstojí, vieme ich prestať ukladať do týždňa; je to jeden zápis.

**Odpoveď:** ☐ ponechať · ☐ neukladať · ☐ ukladať kratšie: ____________

### A6. Smie personalista vidieť čas čítania pri jednotlivom človeku?

*Prečo sa pýtame:* rozhodnuté 6. 9. 2026, že áno, a tak to dnes funguje. Je to údaj o správaní konkrétnej osoby zobrazený inej osobe. Zoradiť ľudí podľa neho sa zámerne nedá — rebríček by z merania bez následku následok vyrobil.

**Náš návrh:** ponechať, ale výslovne to uviesť v informovaní zamestnancov (C1).

**Odpoveď:** ☐ áno, s informovaním · ☐ len súhrnne za skupinu · ☐ nezobrazovať

### A7. Je „otvoril a nepotvrdil" prípustný údaj o človeku?

*Prečo sa pýtame:* z otvorenia a chýbajúceho potvrdenia vzniká tvrdenie „vedel a neurobil". Je to silnejší údaj než ktorýkoľvek z nich samostatne.

**Náš návrh:** áno — je to presne ten údaj, kvôli ktorému sa pripomína. Ukazovať ho však len personalistovi a vedúcemu, nie kolegom.

**Odpoveď:** ☐ súhlasím · ☐ inak: ______________________________

---

## Časť B — Retencia (O16)

Pri každom riadku prosíme o **číslo aj o to, odkedy lehota plynie.**

### B1. `acknowledgements` — doklad o oboznámení

**Náš návrh:** ____ rokov od **skončenia pracovného pomeru**, nie od potvrdenia — aby sa doklad dal použiť aj pri spore, ktorý vznikne po odchode. Číslo prosíme doplniť.

**Odpoveď:** ______ rokov · plynie od: ☐ potvrdenia · ☐ skončenia pomeru · ☐ konca platnosti predpisu

### B2. `assignments` — pridelenie a jeho dôvod

**Náš návrh:** rovnako ako B1. Bez pridelenia sa nedá vysvetliť, prečo mal človek povinnosť — samotné potvrdenie by zostalo bez kontextu.

**Odpoveď:** ☐ rovnako ako B1 · ☐ inak: ____________

### B3. `document_opens` — prvé otvorenie znenia

**Náš návrh:** rovnako ako B1, je to súčasť tej istej reťaze.

**Odpoveď:** ☐ rovnako ako B1 · ☐ inak: ____________

### B4. `approval_rounds` — kto znenie schválil alebo zamietol

**Náš návrh:** rovnako ako B1. Schválenie je dôvod, prečo znenie vôbec smelo ísť ľuďom.

**Odpoveď:** ☐ rovnako ako B1 · ☐ inak: ____________

### B5. `reading_times` — čas nad znením

Rozhodnuté 6. 9. 2026: **12 mesiacov**, lehota je vynútená priamo v databáze (TTL).

**Odpoveď:** ☐ potvrdzujem · ☐ zmeniť na ____________

### B6. Audit prístupov — kto čo kedy videl

**Náš návrh:** 24 mesiacov. Je to návrh z D10, doteraz nepotvrdený.

**Odpoveď:** ☐ 24 mesiacov · ☐ ______ mesiacov

### B7. `reminder_log` — komu sa v ktorý deň pripomenulo

Dnes **90 dní** (TTL v databáze). Je to prevádzkový záznam proti dvojitému odoslaniu, nie dôkaz; dôkazom je záznam pri pridelení.

**Odpoveď:** ☐ potvrdzujem · ☐ zmeniť na ____________

### B8. Maže sa, alebo anonymizuje?

*Prečo sa pýtame:* anonymizovaný doklad o oboznámení už nie je doklad — ostane z neho štatistika.

**Náš návrh:** mazať celý riadok. Polovičné riešenie dáva to najhoršie z oboch: údaj o osobe už neposlúži ako dôkaz, ale stále existuje.

**Odpoveď:** ☐ mazať · ☐ anonymizovať · ☐ podľa kolekcie: ____________

### B9. Čo s dokladom, keď predpis prestane platiť?

*Prečo sa pýtame:* potvrdenie sa viaže na konkrétne znenie. Keď ho nahradí nové, starý doklad hovorí o niečom, čo už neplatí — ale práve on dokazuje stav v tom čase.

**Náš návrh:** držať podľa B1 bez ohľadu na to, či predpis ešte platí.

**Odpoveď:** ☐ súhlasím · ☐ inak: ______________________________

### B10. Kto dodá dátum, od ktorého lehota plynie?

*Prečo sa pýtame:* zdrojom identity je Sportnet. Ak lehota plynie od skončenia pracovného pomeru, systém ten dátum musí dostať — inak sa lehota nikdy nespustí a nezmaže sa nič.

**Náš návrh:** zväz (HR) odovzdá dátum skončenia; dovtedy sa nemaže nič.

**Odpoveď:** ☐ súhlasím · ☐ inak: ______________________________

---

### B-nové. Upozornenia v systéme (`notifications`) — pribudlo 2026-09-15

Od 15. 9. 2026 má systém **zvonček**: keď dobehne dlhá operácia (preindexovanie
dokumentu, prepis naskenovaného PDF, rozposlanie pripomienok, zverejnenie
znenia), vznikne o tom záznam pre konkrétnu osobu a ona ho môže označiť za
prečítaný.

**Čo sa presne ukladá:** `personId`, druh udalosti, ktorého dokumentu sa týkala
(identifikátor a názov), počet (úsekov alebo odoslaných správ), čas vzniku
a čas prečítania. **Nie je tam text správy** — veta sa skladá až pri zobrazení,
takže v databáze nie sú vety o človeku, len druh a parametre.

Je to **údaj o správaní**: hovorí, čo kto kedy videl. Nie je to dôkaz o plnení
povinnosti — tým zostávajú `acknowledgements`.

**Náš návrh:** 90 dní, rovnako ako `reminder_log`, ktoré je rovnakej povahy.
Jedno pravidlo pre obe prevádzkové kolekcie namiesto dvoch rôznych.

**Otázka na DPO:** je oprávnený záujem (prevádzka systému) správny právny základ,
alebo to patrí pod ten istý základ ako zvyšok onboardingu?

**Odpoveď k lehote:** ☐ 90 dní súhlasí · ☐ inak: ____________

**Odpoveď k základu:** ☐ oprávnený záujem · ☐ inak: ____________

---

### B-nové 2. Záznamy odpovedí (`evaluations`) — dopísané 2026-09-15

**Toto nie je nová funkcia, je to prehliadnutý údaj.** Kolekcia vznikla
s hodnotením kvality odpovedí (D9) a od začiatku ukladá **otázku človeka
a odpoveď systému doslovne — pri každej odpovedi**, nie len pri tej, ktorú
niekto posúdi. Spolu s nimi zdroje, citácie, model, časy, cenu a **e-mail
toho, kto sa pýtal**. Od 2026-09-15 pribudlo pole „nahlásená nepresnosť":
keď niekto pod odpoveďou napíše, čo na nej nesedelo, pripíše sa to k tomu
istému záznamu.

**Prečo sa to ukladá celé:** po zmene modelu alebo chunkovania sa tá istá
odpoveď už nedá zopakovať. Bez uloženého znenia by sa spätne nedalo posúdiť
nič — ani to, či sa systém odvtedy zlepšil, ani prečo konkrétna odpoveď bola
zlá.

**Čo z toho je osobný údaj:** otázka je voľný text, ktorý napísal človek,
takže môže obsahovať čokoľvek vrátane údaja o ňom samom alebo o inom.
Vyfiltrovať sa to vopred nedá bez toho, aby záznam stratil zmysel. Navyše je
pri ňom **e-mail**, takže záznam nie je anonymný ani pseudonymný.

**Ako je to dnes:** ukladá sa všetko a **nemaže sa nič** — lehota nie je
zavedená. Hovoríme to takto rovno, lebo to je práve tá otázka.

**Náš návrh:** 12 mesiacov. Dosť na ladenie kvality a na pohľad „čo sa nám
opakovane vyčíta", málo na to, aby sa z toho stal archív otázok zamestnancov.
Alternatíva, ktorú vieme spraviť: po kratšej lehote **odpojiť e-mail**
a nechať len otázku a odpoveď.

**Otázka na DPO:** je oprávnený záujem (zlepšovanie vlastnej služby) správny
právny základ — a stačí lehota, alebo má po nej nasledovať pseudonymizácia?

**Odpoveď k lehote:** ☐ 12 mesiacov súhlasí · ☐ inak: ____________

**Odpoveď k základu:** ☐ oprávnený záujem · ☐ inak: ____________

**Po lehote:** ☐ zmazať celé · ☐ odpojiť e-mail a otázku nechať · ☐ inak: ______

---

## Časť C — Čo k tomu patrí

### C1. Informovanie zamestnancov (čl. 13)

Kto text napíše a kedy sa zverejní? Musí obsahovať aspoň štyri veci: že sa **meria čas** nad znením; že ho **personalista vidí aj pri jednotlivcoch**; že sa zaznamenáva **prvé otvorenie**; a že **„otvoril a nepotvrdil"** je sledovaný stav.

**Náš návrh:** text píše DPO, IT dodá presný zoznam údajov (príloha). Zverejniť **pred** pilotom, nie po ňom.

**Odpoveď:** zodpovedá ____________________ · termín ____________________

### C2. Záznam o spracovateľských činnostiach (čl. 30)

Doplniť tieto činnosti do záznamu zväzu.

**Odpoveď:** zodpovedá ____________________ · termín ____________________

### C3. DPIA (posúdenie vplyvu)

Dokumentácia ju pri rozsahu 130k+ osôb odporúča pred produkciou.

**Náš návrh:** pre úzky pilot (jedno oddelenie, jednotky ľudí) nie je blokujúca; pred plošným nasadením áno.

**Odpoveď:** ☐ súhlasím · ☐ potrebná hneď · ☐ nie je potrebná, dôvod: ____________

### C4. Zmluvy

DPA medzi zväzom a Contineom a doložka pokrývajúca tok údajov Sportnet → Contineo. Sub-procesori: MongoDB Atlas (EÚ), Vercel (EÚ), Voyage AI (embedding), Anthropic (záložný model, zero-retention, bez trénovania).

**Odpoveď:** ☐ podpísané · ☐ v príprave, termín ____________

---

## Príloha — čo sa presne ukladá

| Kolekcia | Polia s osobným údajom |
|---|---|
| `acknowledgements` | personId, e-mail, meno, oddelenie (odtlačok v čase potvrdenia), dokument a znenie, **doslovná formulka a jej hash**, jazyk rozhrania aj dokumentu, čas potvrdenia, **IP adresa**, **user agent** |
| `assignments` | komu, kým, prečo, dokedy; kedy a koľkokrát sa pripomenulo |
| `document_opens` | personId, znenie, čas prvého otvorenia — **jeden riadok na dvojicu osoba × znenie**, nie záznam o každom zobrazení |
| `reading_times` | personId, znenie, počet sekúnd, prvé a posledné videnie |
| `approval_rounds` | kto predložil, menovaní schvaľovatelia (meno a adresa ako odtlačok), rozhodnutie, dôvod zamietnutia, kedy sa komu ozvalo |
| `reminder_log` | komu a v ktorý deň sa odoslala pripomienka |
| `notifications` | personId, druh udalosti, ktorého dokumentu sa týkala, počet, čas vzniku a čas prečítania — **nie text správy** |
| `evaluations` | `persons.id` toho, kto sa pýtal, a jeho organizácia (**nie e-mail** — od O17, 2026-09-16), **otázka a odpoveď systému doslovne pri každej odpovedi**, zdroje a citácie, model, časy a cena; nepovinne „sedí/nesedí" a popis chyby od čitateľa, posudok hodnotiteľa a jeho `persons.id` |
| `persons` | meno a priezvisko zvlášť, tituly, pracovná pozícia, oddelenie a jeho história, **mobilný telefón**, pracovisko, e-mail, stav — **od D87 viditeľné celej organizácii** v adresári |
| `person_photos` | fotografia osoby |
| `auth_users` | e-mail, meno, `emailVerified` — prihlasovacie konto pod `persons` |
| `auth_tokens` | e-mail + jednorazový token prihlasovacieho odkazu |
| audit prístupov | kto, čo a kedy videl |

Dve veci, ktoré sa zámerne **nezbierajú**: doskrolovanie na koniec dokumentu a záznam o každom jednotlivom zobrazení. A personalista, ktorý si znenie otvorí na kontrolu, sa nezapisuje — zapisuje sa len ten, kto povinnosť má.

---

## Čo sa stane po odpovediach

Do systému pribudne: lehota vynútená priamo v databáze pre každú kolekciu (dnes ju majú len `reading_times` a `reminder_log`), postup pre žiadosť o výmaz, ktorý rozlíši „zmaž konverzácie" od „doklad zostáva", a text informovania viditeľný v rozhraní.

Je to práca na hodiny. Blokuje ju rozhodnutie, nie implementácia.
