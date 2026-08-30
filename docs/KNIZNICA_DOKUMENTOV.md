# Knižnica dokumentov (CMS, prvá etapa)

> **Stav:** nasadené 2026-08-30. Nadväzuje na `CMS_KONCEPCIA.md` časť A
> (media manager) a nahrádza v nej otázku „ako sa obsah dostane dnu".
> **Zámerne nerieši:** verejný web (KB/FAQ), kanály a reconciliation —
> zostávajú v `CMS_KONCEPCIA.md` častiach B a C.

## Prečo

Normy sa do systému dostávali **len príkazovým riadkom**: `.md` súbor plus
`.meta.json` vedľa neho, pripravené vývojárom. Znamenalo to, že zákazník si
novelu nevie nahrať sám a pri každej zmene predpisu čaká na nás. Pri jednom
zväze a deviatich normách to bolo zvládnuteľné; ako produkt to nie je použiteľné.

## D53 — knižnica, prevod a editor

### Vlastná rola `spravca-obsahu`

Kto normy prideľuje (`hr`), nie je nutne ten istý človek, ktorý ich píše
a nahráva — v zväze je to spravidla legislatívec proti personalistovi. Je to
ten istý dôvod, pre ktorý je `hr` oddelené od `people-admin` (D46): rola má
zodpovedať práci.

### Prevod beží u nás, model je druhý krok

| formát | čím |
|---|---|
| `.docx` | mammoth → turndown |
| `.pdf` | pdfjs (text podľa polohy na strane) |
| `.xlsx` | SheetJS → tabuľky v Markdowne |
| `.md`, `.txt`, `.csv` | bez prevodu |

Staré `.doc` a `.xls` sa odmietnu s návodom. Typ sa určuje **z obsahu
a prípony**, nie z toho, čo tvrdí prehliadač: `content-type` z formulára posiela
klient a pri `.docx` býva podľa systému čokoľvek.

**Model sa nevolá automaticky a nikdy nie ako ústup po zlyhaní.** Norma je
text, podľa ktorého ľudia konajú a ktorý potvrdzujú; model vie potichu
preštylizovať vetu alebo domyslieť chýbajúce slovo — a nikto si toho nemusí
všimnúť, lebo výsledok vyzerá lepšie než vstup. Volá sa **len kliknutím
človeka v editore**, v dvoch režimoch (prečistiť členenie / prepísať sken),
a jeho výstup sa **ukladá ako návrh vedľa konceptu**, nie doňho. Prijatie je
samostatný krok.

Skenované PDF bez textovej vrstvy sa **neprevádza ticho**: prevod povie, že
v súbore nie je text, a ponúkne prepis modelom. Text, ktorý vyzerá správne
a nie je, je pri norme horší než chýbajúci dokument.

### Editor: originál vedľa Markdownu

Prevod z PDF je odhad. Rozdiel medzi „vyzerá to dobre" a „je to naozaj to, čo
je v norme" sa dá zistiť len porovnaním — a človek, ktorý musí prepínať okná,
ho neurobí. Pod 900 px sa stĺpce poskladajú pod seba: rozdeliť telefón na dve
polovice znamená, že sa nečíta ani jedna.

### Nahratie nič nepublikuje

`processingStatus` (technický: nahraté → prevedené → zaindexované / zlyhalo)
je oddelený od `status` (kurátorský: draft / published). Medzi „mám súbor"
a „toto je znenie, ktoré platí" musí stáť človek, ktorý to prečítal. **Chunky
sa preto robia až pri publikovaní**, nie pri nahratí.

### Označenie znenia píše človek

Kým ho dopĺňal skript, bolo to `1.0` pri všetkých deviatich normách —
vymyslené číslo, ktoré sa objavuje doslovne v každom zázname o potvrdení
(D28) a nedá sa s ničím spojiť. Formulár preto pýta označenie, dátum platnosti
**a citáciu, odkiaľ ten dátum je**.

### Pôvodný súbor sa nemaže

Markdown je odvodenina a odvodenina sa dá spraviť znova len vtedy, keď
existuje originál. Otázka „čo bolo v tom PDF, ktoré nám poslali" je pri norme
celkom bežná. Súbory sú v **GridFS** v tej istej databáze: ďalšie úložisko by
znamenalo ďalší token, ďalšiu vec, ktorá vypadne, a ďalšie miesto, kde žijú
údaje zákazníka — dátová rezidencia je vyriešená raz, pri Atlase (ADR-002).

Neverejná cesta `/api/kniznica/subor/<id>` vyžaduje prihlásenie, rolu a zhodu
organizácie: identifikátor v GridFS sa dá uhádnuť (D32).

### Chunker sa presunul, nie prepísal

`chunker.mjs` je v `src/lib/` **bez jediného zásahu do kódu**; typy sú vedľa
v `chunker.d.ts` a skripty ho berú cez preberací bod. Prepis do TypeScriptu by
znamenal stovky mechanických zmien v algoritme, ktorý sa meniť nemá — a tichá
zmena členenia sa prejaví až tým, že model odcituje nesprávny článok.
Obrazovka aj `import.mjs` teda režú rovnako; dve kópie by sa rozišli presne
pri novele.

Rovnako sú spoločné číselníky (`ciselniky.ts`): to, čo prejde importom,
nesmie obrazovka odmietnuť ani naopak.

## Čo zostáva

- **Verejný web (KB/FAQ)** — samostatná fáza, `CMS_KONCEPCIA.md` časť B.
- **Kanály** (MCP, API, web linky) — časť C.
- **Náhľad Markdownu** v editore; zatiaľ je tam surový text.
- **Zmazanie dokumentu** z obrazovky — vedome nie je. Dokument, na ktorý sa
  viažu potvrdenia, sa mazať nemá; archivácia je iná operácia a treba ju
  navrhnúť zvlášť.


---

## Čo presne robí chunker

Je to jediné miesto, kde sa rozhoduje, **na aké kusy sa norma rozdelí** pre
vyhľadávanie. Vyhľadávanie totiž nepracuje s celým dokumentom — model dostane
niekoľko úsekov a odpovedá z nich. Ak sú úseky zle narezané, odpoveď je
nepresná alebo cituje nesprávny článok, a nikto to nespojí s tým, ako sa text
delil.

Robí štyri veci:

1. **Vyčistí opakujúci sa šum.** Hlavičky, päty a „Strana 17 z 49" sa
   v PDF opakujú na každej strane. Bez toho by sa dostali do úseku a skresľovali
   by vyhľadávanie — a raz sa aj stalo, že citácia začínala slovami „Strana 17
   z 49 (6) V majstrovskej súťaži…". Text bol pritom správny, čo je horší druh
   chyby než zjavný pád. Rieši aj neviditeľné znaky, ktoré PDF zanáša
   (`U+200B`, BOM) — riadok s jediným takým znakom vyzerá prázdny, ale
   `if (!riadok)` ho neodhalí, a raz sa vďaka tomu stal „názvom" článku.
2. **Rozpozná štruktúru.** Články, odseky, prílohy a preambulu (titulná strana,
   zoznam novelizácií, osnova). Preambula sa ukladá — sú v nej dátumy
   schválenia, ktoré treba pri posudzovaní platného znenia — ale vyhľadávanie
   ju preskakuje: sémanticky sa podobá na hocijakú otázku o danej doméne
   a vytláčala z výsledkov skutočné články.
3. **Reže po článkoch, nie po znakoch.** Článok je prirodzená sémantická
   jednotka; delenie po 2000 znakoch by rozseklo vetu uprostred definície.
   Cieľ je 300–800 tokenov (~1050–2800 znakov v slovenčine); dlhý článok sa
   rozdelí, krátke susedné sa spoja.
4. **Do každého úseku vloží breadcrumb** — z ktorého dokumentu a článku
   pochádza. Vďaka tomu vie model odcitovať „čl. 12 ods. 3 Súťažného poriadku"
   a nie „niekde v texte".

### Prečo nie je v TypeScripte

Krátka odpoveď: **nie je to potrebné a prepis by bol drahší než jeho prínos.**

Typy na hraniciach — čo do funkcie vchádza a čo vychádza — sú v
`chunker.d.ts`, takže volajúci kód je kontrolovaný. Chýba len kontrola *vnútri*
tých 439 riadkov, a to je kód, ktorý sa skladá z regulárnych výrazov nad
reťazcami; typový systém tam veľa neuchráni. Naopak, prepis znamená stovky
mechanických zmien v algoritme, ktorý je odladený na deviatich skutočných
predpisoch a ktorého chyby sú **tiché** — neprejavia sa pádom, ale tým, že
model raz odcituje nesprávny článok.

Jedno riziko tá dvojica má a treba ho vedieť: `.d.ts` sa môže rozísť
s implementáciou a nikto si to nevšimne. Kryje ho `tests/chunker.test.mjs`
(53 testov, volá skutočné funkcie so skutočnými reťazcami) — pokiaľ testy
bežia, typy sedia s tým, čo sa naozaj deje.

Ak sa chunker bude niekedy podstatne meniť, prepis dáva zmysel — ale
s porovnaním výstupu na všetkých deviatich normách pred a po, nie „naslepo".


---

## D57 — identita textu a identita členenia

`versionId` sa počítal **z výsledných chunkov**. Malo to dobrý dôvod: keď sa
opravil chunker, obsah súborov sa nezmenil, import všetko preskočil a
v databáze zostalo staré zlé členenie.

Lenže na `versionId` sa viažu **potvrdenia** a `trackProgress()` počíta
„hotovo" ako *je táto verzia potvrdená*. Vyladenie chunkera by teda stovke
ľudí ukázalo, že normu nemajú potvrdenú — ich staré potvrdenia by ukazovali
na verziu, ktorá už neplatí, a nikto by to nespojil so zmenou členenia.

Jedno číslo nieslo dve rôzne veci:

| | z čoho sa počíta | čo sa naň viaže |
|---|---|---|
| `versionId` | **len text znenia** | potvrdenia, pridelenia, trasy |
| `chunkingId` | verzia chunkera + profil + výsledné úseky | `document_chunks` |

**Označenie, dátum platnosti ani citácia do `versionId` nevstupujú.** Sú to
údaje *o* verzii, nie jej identita — preklep v označení sa musí dať opraviť
bez toho, aby sa rozbili potvrdenia.

Preindexovanie tak vymení úseky pri tom istom `versionId`, `versions[]` sa
nedotkne a potvrdenia zostávajú. A keďže `chunkingId` nesie aj profil a verziu
chunkera, stále platí to, čo pôvodné riešenie zabezpečovalo: po zmene členenia
je vidieť, že sa preindexovať treba.

### Oprava údajov znenia

Preklep v označení alebo v citácii: text je ten istý, to, čo ľudia potvrdili,
je aj po oprave pravda. Oprava sa zapíše (s povinným dôvodom), potvrdenia
zostávajú.

**Zmena dátumu platnosti je iná.** Potvrdzovacia formulka ho obsahuje doslovne
a záznam si ju uložil ako text. Ak bol dátum zlý, tí ľudia potvrdili tvrdenie,
ktoré nie je pravdivé; ticho im ho opraviť pod už podpísaným záznamom by
z auditu spravilo niečo, čo sa dá spätne meniť.

Preto pri zmene dátumu na znení, ktoré už niekto potvrdil, obrazovka **odmietne
uložiť bez rozhodnutia**: buď oprava zápisu (potvrdenia zostávajú), alebo
podstatná zmena (`requiresReacknowledgement`, D30). Systém to rozhodnúť nevie —
nepozná, či medzi tými dvoma dátumami niekto podľa normy konal. Obe možnosti
sa zapisujú do `versions[].opravy[]` aj do auditu.

## D58 — profil členenia per organizácia

Chunker sa bude ladiť často. Vlastný **kód** per zákazník by ale znamenal N
kópií jedného pravidla, ktoré sa rozídu — a chyba v jednej sa neprejaví pádom,
ale tým, že model odcituje nesprávny článok u jedného zákazníka o pol roka.

Preto: **jeden algoritmus, parametre navonok.** V `/organizacia`, záložka
Členenie: slovo, ktorým začína článok a príloha, prah na hlavičky a cieľová
veľkosť úseku.

**Konfiguruje sa slovom, nie regulárnym výrazom.** Vzor od zákazníka je jednak
vec, ktorú nikto neodladí, jednak spôsob, ako jedným zápisom zavesiť
spracovanie celého dokumentu. Slovo sa escapuje a vzor okolo neho zostáva náš.
Čísla sa držia v rozumnom rozsahu: úsek na 20 tokenov znamená tisíce úryvkov
bez významu, na 5000 zas jeden úsek na celý dokument — v oboch prípadoch
vyhľadávanie prestane fungovať a nikto to nespojí s číslom v nastavení.

**Predvolený profil reže presne tak, ako sa rezalo doteraz.** Overené
porovnaním výstupu na všetkých desiatich vzorových dokumentoch: 10 zhôd,
0 rozdielov. Pri predvolenom slove sa navyše berú pôvodné konštanty, nie
znovu zostavený vzor — pôvodná `PRÍLOHA` má `[ÍI]`, takže chytí aj zápis bez
dĺžňa, a zostavený vzor by o to potichu prišiel.

Uloženie profilu **nepreindexuje nič samo**. Preindexovanie všetkého naraz sa
nedá vziať späť jedným klikom; človek má najprv vidieť, čo nový profil spraví
s jedným dokumentom.

## D59 — kontrola konzistencie

`npm run kontrola` overí invarianty a **nič neopravuje** — oprava je vždy
rozhodnutie (preindexovať, dopublikovať, nechať tak), a skript, ktorý „to
spraví za teba", by pri prvej nečakanej odchýlke prepísal niečo, čo nikto
nechcel. Návratový kód 1 pri rozpore, takže sa dá zavesiť za preindexovanie.

Čo kontroluje:

1. aktívny úsek ukazuje na existujúce znenie,
2. dokument nemá naraz dve aktívne členenia (ten istý text dvakrát vo výsledkoch),
3. potvrdené znenie má uložený text (dôkaz bez textu je bezcenný),
4. publikované znenie má aktívne úseky (inak o norme vyhľadávanie nevie),
5. model vektorov sedí s nastavením (miešanie modelov nič nezhodí, len ticho zhorší výsledky),
6. cesta priečinkov sedí so zaradením.

Prvý beh hneď našiel skutočný nález: `sfz:test_onboarding` má publikované
znenie a ani jeden úsek — seedovací skript zapisuje dokument, nie chunky.
Pri testovacom dokumente to nevadí, ale je to presne ten druh stavu, ktorý by
sa inak nezistil.


---

## Doplnenie pôvodných súborov a hromadné preindexovanie

### `npm run subory:doplnit`

Deväť noriem SFZ prišlo do systému ako `.md` súbory z ručného prevodu; PDF
pritom máme v `data/vzorky/`. Skript ich pripojí ako pôvodný súbor, takže sa
v editore dá porovnávať text s originálom.

Dve veci robí zámerne inak, než by sa čakalo:

- **Text sa nedotýka.** Pripája súbor, neprevádza dokument. Markdown
  v databáze je odladený a nahradiť ho novým prevodom by bola zmena znenia,
  ktorú nikto nechcel.
- **Priradenie je vypísané ručne**, nie hádané z názvu súboru. Názov je
  náhodný artefakt (tá istá zásada ako pri metadátach) a uhádnuté priradenie
  by pripojilo cudzie PDF k norme — čo je horšie než žiadne.

V zázname o prevode je poctivo napísané, že text nevznikol prevodom toho PDF,
ale ručne pred zavedením knižnice — inak by sa o rok nedalo zistiť, prečo sa
text a nový prevod toho istého súboru líšia.

### Hromadné preindexovanie

V `/organizacia`, záložka Členenie, pod profilom. Ukazuje, **koľko dokumentov
by nový profil narezal inak** — a počíta to naozajstným narezaním každého
dokumentu, nie odhadom: to je jediný spôsob, ako povedať, či zmena parametra
na tomto konkrétnom obsahu vôbec niečo spraví.

**Spracuje najviac 25 dokumentov naraz.** Nie je to opatrnosť navyše: funkcia
má strop na čas behu a pád uprostred by nechal časť dokumentov narezanú po
starom — teda presne ten nekonzistentný stav, ktorému sa celé D57 vyhýba.
Opakované spustenie je lacné, lebo dokumenty, ktoré už sedia, sa preskočia.

Preindexovanie **nemení znenia ani potvrdenia** (D57).
