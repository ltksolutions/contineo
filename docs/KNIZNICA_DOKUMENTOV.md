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
