# LEARNING-zadanie.md — zadanie pre Claude Design: modul Vzdelávanie (`/learning`)

> **Pre koho:** projekt Contineo v Claude Design (základný dizajn ZAKLAD).
> **Odkiaľ:** ADR-018 (`docs/decisions/ADR-018-modul-learning.md`),
> plán `docs/LEARNING_analyza_a_plan.md`. Stav: 2026-09-27.
> **Výstup:** rámy `LEARNING-*.html` + `.md` s rovnakým menom do
> `docs/design/`, jeden rám = jeden PR (postup ako pri onboardingu:
> „stiahni design" → Share → Project HTML → Project archive).

Text nižšie je napísaný tak, aby sa dal **skopírovať do Claude Design
ako jedno zadanie** (časť A) a potom po jednom ráme (časť B).

---

## A. Kontext a pravidlá (vložiť raz)

```
Navrhujeme nový modul Continea — Vzdelávanie (/learning). Je to LMS nad
tou istou platformou, ktorá už má knižnicu predpisov, onboarding
(potvrdzovanie noriem), osoby, oddelenia, skupiny a trasy.

Základ je ZAKLAD (tokeny, .card, .empty, .tag--*, .field, .button,
.notice--*, AppShell s hornou lištou / bočným panelom / spodnou lištou na
telefóne). Nič z toho sa nemení — nové obrazovky z toho čítajú. Nové
komponenty vznikajú len tam, kde ZAKLAD nič nemá (zoznam nižšie).

Pravidlá platné všade (ako v MASTER.md):
1. Mobile first, breakpointy len 640 a 1024. Každý rám navrhni najprv na
   360–390 px, potom desktop.
2. Nič nevyžaduje JavaScript, okrem výslovne uvedených výnimiek
   (prehrávač videa, priebežné ukladanie testu, odpočet).
3. Texty sú slovenské; všetko bude v i18n sk/cs/en — nepíš skratky, ktoré
   sa nedajú preložiť.
4. --accent ostáva, tenant farbu skladá tenantStyle(); tmavá téma povinná.
5. Stav sa v systéme odvodzuje z udalostí — obrazovky ukazujú odvodený
   stav (zamknuté / dostupné / rozpracované / hotové), nie „uložený
   progres".

Terminológia (SK — presne takto, v kóde anglicky):
- Kurz (course) — má tému z číselníka, smart:tagy, jazyk obsahu, verzie;
  koncept → zverejnený → archív. Zverejnená verzia sa nemení.
- Časť (part) — povinná / nepovinná; bloky obsahu; 0..n testov.
- Blok obsahu (block): text · obrázok · galéria · dokument z knižnice
  (odkaz na konkrétne znenie predpisu) · video interné · video externé.
  Video môže mať „povinné dopozeranie".
- Téma (topic) — číselník organizácie, jedna na kurz.
- smart:tag — „Kľúč: Hodnota", napr. „Bezpečnosť: Výťah",
  „Tréner: Euro B licencia", „Úroveň: 2". Na kurzoch, otázkach, testoch.
- Banka otázok (question bank) — otázky organizácie; každá má typ
  (jedna správna · viac správnych · pravda/nepravda · krátky text),
  váhu, vysvetlenie, aspoň jeden smart:tag.
- Test — recept: sekcie, každá = filter smart:tagov + počet otázok;
  zodpovedné osoby (1..n); hranica úspešnosti; limit času; počet pokusov;
  kedy ukázať správne odpovede. Otázky sa pri každom pokuse losujú,
  odpovede miešajú.
- Pokus (attempt) — jeden priebeh testu; skóre; prešiel/neprešiel.
- Zápis (enrollment) — osoba je zapísaná do konkrétnej verzie kurzu;
  vznikol pridelením (ako norma: všetci / oddelenie / skupina / trasa)
  alebo samozápisom (otvorený kurz).
- Certifikát — po dokončení kurzu; číslo, dátum, vydavateľ, PDF,
  verejné overenie.

Roly:
- bežná osoba (študent): Moje kurzy, kurz, časť, test, certifikát.
- learning-admin (lektor/metodik): Správa kurzov, Témy, smart:tagy,
  Banka otázok, Testy, zapísaní; výsledky len testov, za ktoré zodpovedá.
- zodpovedná osoba testu (menovite, bez roly): výsledky svojho testu.
- hr: prideľuje kurzy adresátom; výsledky NEVIDÍ.
Navigácia: položka „Vzdelávanie" pre všetkých (ak je modul zapnutý);
„Správa kurzov" a „Testy" pre learning-admin — na telefóne pod „Viac →
Správa".

Nové komponenty (nie sú v ZAKLADE):
- karta kurzu (názov, téma, smart:tagy, odhad času, stav zápisu, postup
  „3 z 5 povinných častí")
- zoznam častí kurzu so stavom a povinnosťou
- blok obsahu (každý typ) + galéria (mriežka, lightbox nie je nutný)
- blok „dokument z knižnice" — kartička znenia s odkazom na PDF (ako
  v /documents), nie kópia obsahu
- prehrávač videa (JavaScript): vlastné ovládanie, indikátor „povinné
  dopozeranie · pozreté 62 %", pri povinnom dopozeraní bez pretáčania
  dopredu; stav po dopozeraní; upozornenie pri externom videu, že
  dopozeranie sa neoveruje
- vstup smart:tagov (kľúč: hodnota, návrhy existujúcich kľúčov aj hodnôt,
  pilulky „Kľúč: Hodnota")
- editor sekcií testu: riadok = filter smart:tagov + počet + živý údaj
  „v banke vyhovuje 37 otázok" (červené, keď je menej než počet)
- otázka testu: jedna na obrazovku (telefón), typ „viac správnych
  odpovedí" má zaškrtávacie políčka a vetu nad otázkou „Táto otázka má
  viac správnych odpovedí"; „jedna správna" má prepínače; krátky text
  má pole; pravda/nepravda dve veľké tlačidlá
- výsledok pokusu: skóre, prešiel/neprešiel, hranica, počet zostávajúcich
  pokusov, kedy je ďalší možný, prehľad otázok s vysvetlením (ak je
  povolené)
- certifikát: karta + tlačidlo PDF + overovací odkaz s QR
```

## B. Rámy — po jednom (poradie = poradie PR)

Každý rám: **telefón 360–390 px** a **desktop**; stavy uvedené pri ráme;
prázdny stav `.empty` všade, kde zoznam môže byť prázdny.

### 1. `LEARNING` — `/learning` — Moje kurzy (študent)

```
Rám LEARNING: obrazovka /learning „Vzdelávanie" pre bežnú osobu.
Tri skupiny: Rozpracované (s postupom a „Pokračovať"), Na zápis (otvorené
kurzy — tlačidlo „Zapísať sa"; pridelené, ale ešte neotvorené — „Začať"),
Dokončené (s dátumom a odkazom na certifikát, ak je). Filter podľa témy a
smart:tagov ako odkazy (bez JS). Karta kurzu = nový komponent.
Stavy: bežný · prázdny (nič pridelené, nič otvorené) · len dokončené.
Na telefóne karty pod sebou, akcia na celú šírku.
```

### 2. `COURSE` — `/learning/[courseKey]` — Prehľad kurzu

```
Rám COURSE: hlavička kurzu (názov, téma, tagy, odhad času, verzia
a „zapísaný od"), popis, zoznam častí: číslo, názov, povinná/nepovinná
(.tag), stav (hotová ✓ · rozpracovaná · dostupná · zamknutá — zamknutá
len ak kurz má sekvenčné poradie), počet testov pri časti a ich stav.
„Pokračovať tu" vedie na prvú nehotovú povinnú časť. Po dokončení kurzu
horný .notice s odkazom na certifikát.
Stavy: nezačatý · rozpracovaný · dokončený · nová verzia kurzu existuje
(informácia, nič sa nevnucuje).
```

### 3. `PART` — `/learning/[courseKey]/[partKey]` — Časť

```
Rám PART: navigácia „← Kurz · Časť 3 z 7 · Ďalšia →", bloky obsahu pod
sebou: text (FormattedText), obrázok, galéria, dokument z knižnice
(kartička znenia s „Otvoriť PDF"), video interné (prehrávač s
„povinné dopozeranie · 62 %"), video externé (embed + poznámka).
Dole sticky pás: „Označiť ako prejdené" (vypnuté, kým je povinné video
nedopozerané — s vetou prečo) a zoznam testov časti: „Test: Bezpečnosť
vo výťahu — povinný — Spustiť" / „prešiel 85 %" / „neprešiel, ďalší
pokus o 30 min". Stav hotovej časti: pás ukazuje ✓ a dátum.
Stavy: nezačatá · video rozpozerané · pripravená na označenie · hotová ·
hotová, ale test nepovinný nespravený.
```

### 4. `MANAGE` — `/learning/manage` — Správa kurzov, Témy, smart:tagy

```
Rám MANAGE: záložky ?tab=courses | topics | tags (ako v /organisation).
Kurzy: tabuľka/karty — názov, téma, stav (koncept .tag--draft ·
zverejnený .tag--published · archív .tag--archived), verzia, zapísaní /
dokončili, akcie. Tlačidlo „Nový kurz" (KeyFromLabel: názov → kľúč).
Témy: číselník — zoznam, pridať, vyradiť (nie zmazať).
smart:tagy: prehľad použitých kľúčov a hodnôt s počtami (kurzy · otázky ·
testy), premenovanie labelu.
Stavy: prázdne (žiadny kurz), bežné.
```

### 5. `MANAGE-COURSE` — `/learning/manage/[courseKey]` — Časti a bloky, nastavenia, zapísaní

```
Rám MANAGE-COURSE: karta stavu verzie ako pri znení (Koncept → Zverejnené
→ Archív; „Nová verzia" pri zverejnenom). Záložky ?tab=parts | settings
| people.
parts: zoznam častí s poradím (TreeWithOrder-štýl), povinnosť, počet
blokov, testy; detail časti = zoznam blokov s poradím a formulár
„Pridať blok" (text · obrázok · galéria · dokument z knižnice · video)
— pri videu: nahrať MP4 do 25 MB alebo vložiť externý odkaz; prepínač
„povinné dopozeranie" (pri externom videu s upozornením). Priradenie
testu: výber z hotových testov (len stav ready), prepínač povinný.
settings: názov, podnázov, popis, téma (číselník), smart:tagy (vstup),
jazyk obsahu, odhad času, samozápis áno/nie, vydáva certifikát áno/nie,
právny základ (ako pri znení).
people: zapísaní — meno, oddelenie, stav (nezačal · rozpracovaný N/M ·
dokončil dátum), posledná aktivita; „Prideliť kurz" (adresáti: všetci /
oddelenie / skupina / trasa — ako pri norme); export CSV.
Stavy: koncept bez častí (validačné vety, čo chýba na zverejnenie) ·
koncept pripravený · zverejnený (polia len na čítanie) · archív.
```

### 6. `TESTS` — `/learning/tests` — Testy, Banka otázok, Výsledky

```
Rám TESTS: záložky ?tab=tests | questions | results.
tests: zoznam testov — názov, sekcie (počet), otázok spolu, hranica,
zodpovedné osoby (avatary/iniciály), stav (koncept · ready · nedostatok
otázok ⚠ · vyradený); „Nový test". Detail/editor testu: názov,
inštrukcie, zodpovedné osoby (ResponsiblePicker, 1..n), sekcie —
riadok = vstup smart:tagov + počet + „vyhovuje 37 otázok" (červené, keď
menej) + poradie; pravidlá: hranica %, limit času, max. pokusov, pauza
medzi pokusmi, kedy ukázať správne odpovede; smart:tagy testu; „Použité
v: kurz X časť 3, kurz Y časť 1".
questions: zoznam s filtrom smart:tagov (odkazy), typ, váha, stav;
formulár otázky: typ (4), text, obrázok, odpovede (pri „jedna správna"
prepínače, pri „viac správnych" políčka; pravda/nepravda pevné; krátky
text = očakávaná odpoveď + alternatívy), vysvetlenie, váha, obtiažnosť,
smart:tagy (aspoň jeden — validačná veta); vyradiť namiesto zmazať;
import CSV.
results: len testy, za ktoré je človek zodpovedný — tabuľka pokusov
(osoba, kurz/kontext, dátum, skóre, prešiel), filter podľa testu,
„Resetovať pokusy" s povinným dôvodom; export CSV. Poznámka na ráme:
HR túto záložku nemá.
Stavy: prázdna banka · test bez zodpovednej osoby (nedá sa ready) ·
sekcia bez dostatku otázok.
```

### 7. `TEST-ATTEMPT` — `/learning/[courseKey]/[partKey]/test/[testKey]` — Pokus

```
Rám TEST-ATTEMPT: úvod (názov, inštrukcie, počet otázok, hranica, limit,
pokus 1 z 3, „Spustiť test"); priebeh: horná lišta „Otázka 4 / 20 ·
zostáva 18:32", jedna otázka na obrazovku na telefóne (na desktope
môže byť zoznam s kotvami), typy otázok podľa komponentu (pri „viac
správnych" veta nad otázkou + políčka), navigácia Späť / Ďalej /
Prehľad odpovedí (nezodpovedané zvýraznené), „Odovzdať" s potvrdením.
JavaScript: priebežné ukladanie každých 30 s (nenápadný indikátor
„uložené"), odpočet. Bez JS: formulár so všetkými otázkami a jedným
odoslaním — rám to ukáže ako druhý variant.
Stavy: úvod · priebeh · čas vypršal · odovzdané.
```

### 8. `RESULT` — výsledok pokusu

```
Rám RESULT: veľké skóre (85 %), prešiel/neprešiel (.notice--ok /
--error), hranica, čas, zostávajúce pokusy a kedy je ďalší možný;
prehľad otázok: správne/nesprávne, tvoja odpoveď, správna odpoveď a
vysvetlenie — len ak to test povoľuje (inak veta „Správne odpovede sa
nezobrazujú"); tlačidlá „Späť na časť" / „Skúsiť znova" (vypnuté s
dôvodom pri pauze alebo vyčerpaných pokusoch).
```

### 9. `CERTIFICATE` — `/learning/[courseKey]/certificate` + `/verify/[registrationNumber]`

```
Rám CERTIFICATE: karta certifikátu (názov kurzu, meno, dátum, vydavateľ,
číslo), „Stiahnuť PDF", overovací odkaz + QR, stav „platný" / „odvolaný
(dôvod)". Verejná stránka /verify: bez prihlásenia, bez shellu (ako
/sign-in), ukáže číslo, kurz, dátum, vydavateľa, „platný" — bez mena
osoby, alebo 404 „Certifikát sa nenašiel" pri zlom odkaze. Návrh PDF
(A4 na šírku, jedna strana, logo tenanta, podpisové pole, QR) ako
samostatný rám.
```

---

## C. Čo Claude Design nemá riešiť

Platby a predaj kurzov · webináre · trasy z kurzov (úrovne ClubUpu) ·
prekódovanie videa · smart:tagy na dokumentoch · schvaľovanie kurzu
viacerými ľuďmi. Ak sa v ráme objaví, vyhodí sa.

## D. Kontrolný zoznam pred „stiahni design"

- [ ] každý rám má telefón aj desktop a všetky uvedené stavy
- [ ] prázdne stavy `.empty` s vetou, nie prázdna plocha
- [ ] pri viacerých správnych odpovediach je veta **nad** otázkou
- [ ] povinné dopozeranie: vidno percento, dôvod vypnutého tlačidla
- [ ] HR nikde nevidí skóre; výsledky len pri zodpovednej osobe
- [ ] texty bez skratiek, preložiteľné do cs/en
- [ ] `.md` k rámu obsahuje tabuľku „Čo je v repozitári UŽ HOTOVÉ"
      (AppShell, KeyFromLabel, ResponsiblePicker, TreeWithOrder,
      FormattedText, UploadFiles, Notice, Skeleton) — nerobiť znova
