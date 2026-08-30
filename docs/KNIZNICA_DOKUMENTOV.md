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
