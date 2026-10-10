# ADR-032 — Kontrola FAQ proti dokumentom knižnice pomocou AI

> **Stav:** prijaté · **Dátum:** 2026-10-10
> **Rozhodol:** Ján Letko (2026-10-10) — „páči sa mi myšlienka aktualizácie
> alebo kontroly a úpravy FAQ z existujúcich vybratých dokumentov v knižnici
> pomocou AI… nespravíme túto funkcionalitu priamo do Contineo?"; k návrhu
> „áno, rozhodni".
> **Nadväzuje na:** ADR-028 D164 (FAQ ako druh dokumentu, záznam = úsek
> `qa` s `derivedFrom`), ADR-030 D185 (fronta kurátora, porovnanie
> s pôvodným návrhom a uloženie úpravy — doplnené 10. 10. 2026), D11
> (`expireCurationFor` — nové znenie zdroja archivuje odvodené odpovede),
> ADR-024 (odpoveď podľa znenia platného k dňu), ADR-026 (AI ako nastavenie
> organizácie, spotreba bez znenia), ADR-014 (postup znenia).
> **Doplnené 10. 10. 2026:** D196–D198 — všeobecná kontrola súladu
> dokumentu proti dokumentom (Ján: „tak isto ako FAQ by takáto funkcionalita
> kontroly bola vhodná aj pre Manuály ISSF, ale aj všeobecne dokument vs.
> dokumenty… každý rok príde Rozpis súťaží… kontrolovať rozpor voči stanovám,
> poriadkom a normám"); „áno, rozšír ADR-032 a začni fázou 1".
> **Implementácia:** fáza 1 (kontrola návrhov FAQ vo fronte kurátora,
> spoločný mechanizmus `lib/complianceCheck.ts`) — rozpracovaná.

---

## 1. Kontext

10. 10. 2026 Ján pripravil manuály ISSF (ISSF-00 až ISSF-09) a nahral ich do
knižnice. Asistent potom ručne prešiel 63 návrhov FAQ z ťažby histórie
helpdesku (ADR-030) proti manuálom a Registračnému a prestupovému poriadku.
Výsledok ukázal, čo taká kontrola prináša:

- **vecné chyby**, ktoré by kurátor ľahko prehliadol — napríklad opätovná
  registrácia hráča po zrušení „po šiestich mesiacoch" (čl. 11 ods. 5 platí
  pre osoby všeobecne; pre hráča je to **dva roky** v inom klube, čl. 15
  ods. 11), lehota materského klubu pri prestupe, zámena striedavého štartu
  s hosťovaním;
- **zastarané odpovede** z praxe helpdesku (plastové preukazy, kuriér,
  dobierka) — manuál ich výslovne ruší;
- **rozpory v samotných dokumentoch** (ISSF-01 časť 2.1 verzus časť 4 —
  prihlasovacie meno; ISSF-07 0,50 € mesačne verzus RaPP 1 € ročne);
- **miesta, kde zdroj tému nepokrýva** — tam treba rozhodnutie človeka, nie
  vymyslenú odpoveď.

Zároveň chýba to, čo by FAQ udržalo pravdivé v čase. Nové znenie zdrojového
dokumentu dnes záznam FAQ len **potichu vyradí** z vyhľadávania
(`expireCurationFor`, D11 — zastaraná overená odpoveď je horšia než žiadna).
Nikto sa však nedozvie, ktoré záznamy treba opraviť ani ako. Manuál ISSF-09
sa mení každý rok po Konferencii SFZ a RaPP pri každej novele.

## 2. Rozhodnutie

### D191 — Kontrola FAQ proti dokumentom je funkcia Contineo

Contineo vie skontrolovať záznamy FAQ (a návrhy z fronty kurátora) proti
dokumentom z knižnice pomocou modelu. Tri vstupy:

1. **Na požiadanie v editore FAQ** (`/library/[id]/faq`) — „Skontrolovať
   proti dokumentom": kurátor vyberie dokumenty z knižnice (napríklad
   manuály ISSF a RaPP) a záznamy (všetky alebo vybrané). Predvolené sú
   zdroje uvedené pri zázname.
2. **Na požiadanie vo fronte kurátora** (`/channels/[key]/proposals`) —
   to isté pre otvorené návrhy pred schválením; nahrádza ručnú revíziu
   z 10. 10. 2026.
3. **Automaticky pri novom znení zdrojového dokumentu** — keď
   `expireCurationFor` vyradí záznamy odvodené z dokumentu (`derivedFrom`),
   zaradia sa na kontrolu proti novému zneniu (D195).

### D192 — Výsledok je návrh na kontrolu, nie zmena

Model pre každý záznam vráti:

- **verdikt:** *súhlasí* / *rozchádza sa* / *zdroj tému nepokrýva* /
  *zdroje si protirečia*;
- **citáciu** pri každom tvrdení, ktoré mení: dokument, článok alebo časť
  a krátky úryvok;
- **navrhnuté znenie** otázky a odpovede (len pri *rozchádza sa*) a návrh
  zdrojov;
- **poznámku pre kurátora** — pri *nepokrýva* a *protirečia si* je to
  otázka na rozhodnutie (značka „[NA ROZHODNUTIE]" ako vo fronte).

Pri *súhlasí* sa nič nemení, len sa pri zázname zapíše, kedy a proti
ktorým zneniam bol skontrolovaný. Všetko ostatné ide do **fronty kurátora**
s porovnaním „pôvodné verzus navrhované" (ADR-030 D185). Model nikdy nemení
záznam ani znenie dokumentu sám.

**Pravidlo pre model:** odpovedať len z dodaných úsekov; čo v nich nie je,
je *nepokrýva*, nie doplnená odpoveď. Pri rozpore dvoch dokumentov
rozhoduje poradie, ktoré organizácia určí (pre SFZ: RaPP a normy pred
manuálmi, manuály pred stránkami futbalsfz.sk — zápis Jána v poznámkach
k manuálom ISSF); keď poradie nerozhodne, je to *protirečia si*.

### D193 — Jedna fronta kurátora pre návrhy z ťažby aj kontroly

Kontrola nevytvára novú obrazovku. Návrh z kontroly je záznam v
`faq_proposals` s druhom `review` a cieľom (`faqDocumentId`, `faqEntryId`):

- **schválenie** prepíše existujúci záznam v koncepte FAQ dokumentu
  (`saveFaqEntry` s `id`) a ďalej ide postup znenia (ADR-014) — nepridá nový;
- **zamietnutie** ponechá záznam, ako je, a zapíše, že kontrolu kurátor
  odmietol (aby ju ďalší beh nenavrhol znova proti tomu istému zneniu);
- návrh z kontroly **otvoreného návrhu** z ťažby neprichádza ako nový
  návrh — uloží sa ako úprava toho istého návrhu s `revision` (ako ručná
  revízia 10. 10. 2026).

Fronta dostane pohľad podľa druhu (*z ťažby* / *z kontroly*); fronta
kurátora teda už nie je viazaná len na kanál — návrhy z kontroly FAQ
dokumentu bez kanála sú v knižnici pri dokumente.

### D194 — Čo ide modelu

- **Len obsah knižnice**: text záznamu (otázka, varianty, odpoveď) a úseky
  vybraných dokumentov v **platnom znení** (pri automatickej kontrole
  v novom). Žiadne e-maily ani osobné údaje.
- Úseky sa vyberajú vyhľadávaním obmedzeným na zvolené dokumenty (rovnaký
  hybridný index ako asistent, `versionIds`) a k tomu **celé články**, na
  ktoré záznam odkazuje v `sources`.
- Prístupová úroveň: kontrola FAQ s úrovňou *verejné* smie použiť len
  verejné dokumenty; interný dokument by do verejnej odpovede nepatril.
- Model **odpovedí** podľa nastavenia organizácie (ADR-026), štruktúrovaný
  výstup; spotreba pod novým účelom `faq-review` bez znenia (D158).
- Kontrola po dávkach (záznamy jedného FAQ dokumentu po desiatkach) — beh
  cez cron ako ťažba (ADR-030), s identitou behu a zámkom kúska.

### D195 — Nové znenie zdroja spustí kontrolu, nie len vyradenie

Pri zverejnení nového znenia dokumentu sa popri `expireCurationFor` zaradia
záznamy FAQ odvodené z dokumentu na kontrolu proti novému zneniu. Záznam
zostáva vyradený z vyhľadávania (D11 platí), kým kurátor nerozhodne:

- *súhlasí* → kurátor jedným úkonom potvrdí a záznam sa znova zverejní
  s odkazom na nové znenie,
- *rozchádza sa* → návrh opraveného znenia vo fronte,
- *nepokrýva* → otázka na rozhodnutie (záznam zmazať, alebo ponechať
  s iným zdrojom).

V editore FAQ je pri vyradených záznamoch viditeľné „vyradené novým znením
dokumentu X — čaká na kontrolu".

### D196 — Všeobecná kontrola súladu: dokument proti dokumentom

Kontrola FAQ je jeden prípad všeobecnej **kontroly súladu**. Kontrolovať sa
dá aj znenie dokumentu — ideálne ešte v koncepte pred schválením (ADR-014):
rozpis súťaží zväzu na sezónu, manuál ISSF, nová smernica — proti
referenčným dokumentom z knižnice (stanovy, poriadky, normy).

- **Výstup pri dokumente** je zoznam nálezov, nie prepísaný dokument: miesto
  v kontrolovanom dokumente, citácia z normy (článok a úryvok), druh nálezu
  — *rozpor*, *chýba povinná náležitosť*, *nejasné* — a odporúčanie.
- **Zobrazenie:** v postupe znenia pri kroku schválenie. Schvaľovateľ vidí
  nálezy pred zverejnením a pri každom zapíše *opravené* alebo *vedome
  ponechané* s dôvodom.
- Pri FAQ ostáva navrhnuté znenie (D192) — záznam FAQ je krátky a jeho
  oprava je jasná; dokument opravuje autor.

Vedľajší produkt: dva ročníky toho istého dokumentu (rozpis súťaží
2026/2027 a 2027/2028 jedného zväzu) sa dajú porovnať tým istým
mechanizmom — „čo sa zmenilo oproti minulej sezóne" (sezóna 1. 7. – 30. 6.).

### D197 — Referenčné dokumenty podľa druhu dokumentu

V číselníku Druhy dokumentov sa pri druhu nastaví, proti čomu sa kontroluje
(napríklad „Rozpis súťaží" proti Stanovám, Súťažnému poriadku, RaPP
a Disciplinárnemu poriadku; „Manuál" proti RaPP). Kontrola sa potom spustí
**sama pri nahratí nového znenia** konceptu; na požiadanie si referenčné
dokumenty vyberie človek ručne.

### D198 — Poradie záväznosti noriem je nastavenie organizácie

Pri rozpore rozhoduje poradie záväznosti, ktoré si organizácia nastaví
(napríklad Stanovy > poriadky > ostatné normy > rozpisy a manuály >
stránky webu). Pri kontrole rozpisov proti stanovám je to jadro funkcie,
preto ide spolu s D196, nie až na koniec. Do nastavenia platí predvolené
poradie podľa druhu dokumentu: norma pred manuálom, manuál pred ostatným;
pri rovnakom druhu je to *protirečia si*.

### Spresnenie D194 z implementácie (10. 10. 2026)

Manuály ISSF sú v knižnici zatiaľ **koncept** (bez zverejneného znenia,
bez úsekov v indexe). Fáza 1 preto modelu nedáva úseky z vyhľadávania, ale
**celé texty vybraných dokumentov**: platné znenie, a ak dokument platné
znenie nemá, koncept s výslovným označením „koncept". Balík dokumentov je
v každom volaní rovnaký a ide do cache modelu (zlomok ceny pri ďalších
dávkach). Nad limitom veľkosti balíka kontrola odmietne štart a požiada
o menší výber; vyhľadávanie po úsekoch príde s veľkými dokumentmi
(fáza 2, rozpisy súťaží).

## 3. Postup

1. **Fáza 1 — kontrola návrhov FAQ vo fronte kurátora** (D191 bod 2, D192,
   D194) na spoločnom mechanizme kontroly súladu; výsledok pri návrhu ako
   „návrh z kontroly" s porovnaním a prevzatím jedným úkonom.
2. **Fáza 2 — záznamy FAQ v editore a nové znenie zdroja** (D191 bod 1,
   D193, D195).
3. **Fáza 3 — kontrola dokumentu pri schválení, referenčné dokumenty podľa
   druhu a poradie záväznosti** (D196–D198) — hotové pred letom 2027,
   keď prídu rozpisy súťaží na sezónu 2027/2028.

## 4. Dôsledky

- Ročná aktualizácia ISSF-09 a novely RaPP prestanú FAQ potichu
  vyraďovať — kurátor dostane zoznam, čo opraviť, s návrhom.
- Kurátor má jednu frontu a jedno porovnanie pre všetko, čo navrhuje model.
- Náklady: rádovo centy na záznam (Sonnet 5, desiatky tisíc tokenov na
  dávku); 50 záznamov FAQ okolo 1 USD. Spotreba je v prehľade AI.
- Model sa môže mýliť aj pri citácii — preto citácia pri každej zmene
  a kurátor pred zverejnením (rovnaká brána ako pri ťažbe).

## 5. Zvažované a zamietnuté

- **Excel na hromadnú opravu FAQ** (Ján 10. 10. 2026 zvažoval) — spätný
  import by obchádzal kontrolu záznamu, audit a súbeh s frontou; nahradila
  ho fronta s porovnaním (ADR-030 D185).
- **Model opraví záznam rovno** — rýchlejšie, ale verejné FAQ by sa menilo
  bez človeka; pri chybnej citácii by chyba odišla do widgetu ISSF.
  Zamietnuté.
- **Kontrola proti celej knižnici** — pomalšie, drahšie a s rizikom, že sa
  použije nesúvisiaci alebo interný dokument; zamietnuté v prospech
  vybraných dokumentov a zdrojov záznamu.
