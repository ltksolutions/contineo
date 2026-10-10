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
> **Implementácia:** fáza 1 (kontrola na požiadanie) — otvorené, `docs/TODO.md`.

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

## 3. Postup

1. **Fáza 1 — kontrola na požiadanie** (D191 bod 1 a 2, D192, D193, D194):
   výber dokumentov a záznamov, beh, výsledky vo fronte kurátora.
2. **Fáza 2 — automaticky pri novom znení** (D195).
3. **Fáza 3 — poradie dokumentov pri rozpore** ako nastavenie organizácie
   (dnes pevne v pokyne pre SFZ).

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
