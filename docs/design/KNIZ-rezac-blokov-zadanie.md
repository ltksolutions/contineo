# Zadanie pre Claude Design — KNIZ-rezac-blokov

> Podklad pre **vizuálny rezač blokov**: stránka Členenie na úseky
> (`/library/[id]/chunks`) ukáže dokument ako text s farebnými blokmi
> úsekov, návrh rezu od AI ako prekrytie, pole na vyjadrenie kurátora
> a ďalšie kolo návrhu. Pripravené 15. 10. 2026 proti `main` (`5d6b1f9`)
> na pokyn Jána („zjednodušiť celý návrh rezov dokumentu, prebehnúť ho
> bezpečne cez AI a ukázať návrh s poľom na vyjadrenie… Ukázať rez
> vizuálne… taký wysiwyg rezač blokov aj s návrhom"). Časť „Prompt pre
> Claude Design" sa skopíruje do projektu v Claude Design; zvyšok je
> kontext pre Jána.

## Prečo

Ján 15. 10. dvakrát nenašiel, ako sa pozrieť, v akých úsekoch išiel
manuál ISSF-08 do indexu (vstup je od #389 aj medzi tlačidlami znenia).
Keď stránku našiel, nedostal odpoveď na otázku „sedí to?": dnešné
Členenie je zoznam úsekov s číslami, tokenmi a 180 znakmi ukážky,
skúšobný rez je formulár so štyrmi poľami (slovo článku, slovo prílohy,
úsek od/do tokenov) a návrh AI je veta o stratégii. Je to nástroj pre
toho, kto rozumie analyzátoru; kurátor rozumie dokumentu. Manuál je
navyše iný druh dokumentu než norma (ADR-027, ADR-034): nemá články, má
časti a nadpisy, a profil „Článok, 300–900 tokenov" mu nesedí od začiatku.

## Čo je dnes (`/library/[id]/chunks`, `app/src/app/library/[id]/chunks/page.tsx`)

Stránka pre správcu obsahu (`libraryContext`), šírka 900, bez JavaScriptu:

1. **Súhrn** (`.chunks-summary`): profil členenia (`label · „Článok“ · cieľ
   300–900`), znenie, počet úsekov, % s článkom, tokeny min–priemer–max;
   upozornenie, keď sú úseky narezané starším spôsobom než dnešný profil
   (`outdated`) s odkazom na Preindexovať.
2. **Čo nesedí** (`.chunks-warnings`): `oneBlock` (celý text v jednom úseku),
   `fewArticles(percent)`, `oversized(count, limit)`, `fragments(count)`.
3. **Rozbor textu**: „N riadkov · „Článok“ 12× · „§“ 0× · „Bod“ 3× ·
   nadpisov 18" a veta, či profil sedí.
4. **Návrh AI** (`requestChunkingAdviceAction`, `lib/chunkingAdvice.ts`):
   model dostane **len štruktúru** (nadpisy, riadky vyzerajúce ako časť /
   článok / § / bod / príloha, začiatky odsekov po 60 znakov; rozhodnutie
   Jána 5. 10. 2026 — nie celý text), vráti stratégiu (články so slovom
   a cieľom tokenov, alebo nadpisy), istotu a zoznam problémov; „Skúsiť
   →" prenesie hodnoty do skúšobného rezu. Posledný návrh je uložený pri
   dokumente (model, kto, kedy).
5. **Skúsiť iný rez** (GET, hodnoty v adrese): štyri polia, „Ukázať rez",
   porovnanie teraz / skúška, zoznam úsekov po skúšobnom reze.
6. **Profil pre tento dokument**: použiť existujúci profil, alebo uložiť
   hodnoty skúšky ako nový pomenovaný profil (D79). Po zmene treba
   preindexovať (detail dokumentu → Ďalšie akcie).
7. **Úseky** (`ol.chunks-list`, `details.card.chunk-item`): číslo, článok
   alebo „bez článku", nadpis, tokeny, štítok „veľký", ukážka 180 znakov,
   po rozbalení celý text úseku.

**Model dát:** dokument nesie len kľúč pomenovaného profilu
(`chunkingProfileId`, D79); profil je `articleWord`, `annexWord`,
`minTokens`, `maxTokens` (a stratégia nadpisov pre dokumenty bez
článkov). Úseky vznikajú deterministicky z textu a profilu
(`lib/chunker.mjs`) pri indexovaní. **Hranice úsekov sa dnes nikde
neukladajú** — sú výsledkom profilu.

## Čo sa má zmeniť

### 1. Dokument ako text, rezy ako farebné bloky

Celý text platného znenia (Markdown vykreslený ako na `/library/[id]/text`)
na jednej obrazovke. Každý úsek je blok s vlastnou farbou podkladu
(striedanie 4–6 tónov z `--accent-soft` a susedných, nie dúha) a ľavým
pruhom; pri začiatku bloku číslo úseku, rozpoznaný článok / nadpis
a tokeny. Varovania sú **pri bloku** (štítok „veľký", „úlomok", „bez
nadpisu"), nie v tabuľke nad textom. Súhrn ostáva, ale ako jeden riadok
nad textom. Zoznam úsekov so zbalenými `details` zaniká — text je zoznam.

### 2. Návrh AI ako prekrytie

Tlačidlo **Navrhnúť rezy** (tiché; jedno plné na stránke je **Prijať**)
pošle modelu text a druh dokumentu a dostane hranice blokov so
zdôvodnením. Návrh sa ukáže **ako druhá vrstva v tom istom texte**:
hranice, ktoré sa zhodujú s dnešným rezom, sú tiché; nové hranice sú
zvýraznené (čiara s popisom „nová hranica: časť 4.2"), zrušené hranice
prečiarknuté. Prepínač pohľadu `.view-switch`: **Dnes · Návrh · Rozdiel**.
Model **navrhuje len hranice a stratégiu, text nikdy nemení** — to je
zásada z `chunkingAdvice.ts` a ostáva.

### 3. Pole na vyjadrenie a ďalšie kolo

Pod textom pole **Čo nesedí** („bloky 7 až 9 patria k sebe; časť 4 je
rozdelená uprostred tabuľky") a tiché **Navrhnúť znova**. Model dostane
predchádzajúci návrh a poznámku, vráti opravený návrh a vetu, čo zmenil.
Každé kolo ostáva v histórii pri dokumente (kto, kedy, poznámka,
výsledok) — dá sa vrátiť ku ktorémukoľvek.

### 4. Prijať

Plné **Prijať a preindexovať** uloží rez a preindexuje. Ak je návrh
vyjadriteľný profilom (slovo článku, tokeny, nadpisy), uloží sa ako
profil ako dnes (D79). Ak nie — model navrhol hranice, ktoré žiadny
profil nevyrobí —, treba **nový spôsob členenia „ručné hranice"** uložený
pri znení dokumentu (viď Rozhodnutia).

### 5. Ručný posun hranice (druhá fáza)

Ťahanie hranice myšou medzi blokmi, vloženie a zrušenie hranice kliknutím
na okraj bloku. Hranica leží **len medzi blokmi textu** (odsek, nadpis,
položka zoznamu, riadok tabuľky), nie uprostred odseku. Bez JavaScriptu
sa to nedá — preto je základ (body 1–4) formulármi a toto je vrstva navyše.

## Rozhodnutia v repozitári, ktoré návrh musí rešpektovať

- **ADR-027 / ADR-034:** spôsob členenia sa viaže na **druh dokumentu**;
  manuál a zmluva sa členia podľa nadpisov, norma podľa článkov. Návrh AI
  dostane druh a jeho spôsob členenia ako východisko.
- **D79:** dokument nesie pomenovaný profil; zmena profilu ticho neprereže
  iné dokumenty, ktoré ho používajú (nový profil, nie úprava existujúceho).
- **ADR-026:** model z nastavení AI organizácie (kľúč SFZ), spotreba sa
  eviduje bez obsahu.
- **Rozhodnutie Jána 5. 10. 2026:** AI dostáva **štruktúru, nie celý
  text** (`chunkingAdvice.ts`). Ján 15. 10. hovorí „prebehnúť bezpečne cez
  AI" — viď Q1.
- Preindexovanie ostáva v detaile dokumentu; stránka Členenie nič neukladá
  bez výslovného Prijať.
- Rozhranie: najviac jedno plné `.button`; `.view-switch` pre pohľad;
  stav v adrese (`?view=proposal`, `?round=3`); mobile first, 390 a 1440.

## Rozhodnuté (Ján, 15. 10. 2026)

- **Q1 A** — modelu ide **celý text znenia** cez kľúč organizácie
  (ADR-026); mení rozhodnutie z 5. 10. 2026 (len štruktúra) pre návrh
  rezov. `chunkingAdvice.ts` sa prepíše, nie obíde.
- **Q3 A** — rez, ktorý nie je profil, sa uloží ako spôsob členenia
  **„ručné hranice"** pri znení: index bloku v Markdowne, história kôl;
  nové znenie začína bez nich.

Q2, Q4 a Q5 ostávajú na návrh s odporúčaním A.

## Otázky (každá s odporúčaním, odporúčaná prvá)

**Q1 — čo ide modelu.**
- **A (odporúčam):** celý text znenia, lebo hranice blokov sa bez obsahu
  nedajú navrhnúť dobre (tabuľka uprostred časti, odsek, ktorý patrí
  k predošlému nadpisu). Ide cez kľúč organizácie (ADR-026), model nevidí
  nič iné (žiadne osoby, potvrdenia), rovnako ako pri kontrole súladu
  (ADR-032), ktorá už dnes posiela celé dokumenty. Mení rozhodnutie
  z 5. 10. — Ján potvrdí.
- B: ostať pri štruktúre (nadpisy + začiatky odsekov po 60 znakov);
  návrh bude hrubší a „Čo nesedí" bude musieť opisovať obsah slovami.

**Q2 — kedy sa návrh spúšťa.**
- **A (odporúčam):** automaticky pri nahratí nového dokumentu a nového
  znenia (jeden beh modelu na znenie), kurátor pri otvorení Členenia
  vidí hotový návrh; práve pri nahrávaní má dokument v hlave. Tlačidlo
  ostáva pre ďalšie kolá.
- B: len na tlačidlo.

**Q3 — kam sa uloží rez, ktorý nie je profil.**
- **A (odporúčam):** nový spôsob členenia **„ručné hranice"** pri znení:
  zoznam hraníc ako pozície blokov v Markdowne (index bloku, nie znakový
  offset — oprava preklepu v texte hranice nerozbije), s históriou kôl.
  Chunker ho berie prednostne pred profilom; nové znenie začína bez
  ručných hraníc (text sa zmenil) a návrh AI beží znova (Q2).
- B: len profily; návrh AI sa musí zmestiť do slova článku a tokenov.
  Jednoduchšie, ale manuál s nepravidelnými časťami to nevyrieši.

**Q4 — čím sa kreslí text s blokmi (viď aj „Tiptap" nižšie).**
- **A (odporúčam):** fáza 1 (body 1–4) serverovo: `FormattedText` po
  blokoch s obalom úseku a triedou farby; hranice sú medzi blokmi, preto
  stačí obaliť postupnosť blokov. Bez knižnice, bez JavaScriptu.
- B: Tiptap (ProseMirror) v režime len na čítanie s dekoráciami hneď od
  fázy 1.

**Q5 — kde sa Členenie otvára po nahratí.**
- **A (odporúčam):** po nahratí a prevode dokumentu je v karte postupu
  krok „Skontrolovať členenie" s odkazom (ako „Určiť právny základ"),
  kým kurátor návrh neprijme alebo neodloží; pri zverejnení sa nebráni.
- B: nič v karte, len tlačidlo Členenie pri znení (od #389).

## Tiptap

V inej session sa pre editor chatu rozhodlo pre **Tiptap** (ProseMirror).
Pre rezač je to dobrá voľba **na fázu 2** (ťahanie hraníc): dekorácie
ProseMirroru vedia zafarbiť rozsahy blokov bez zásahu do textu a hranica
ako vlastný uzol (node view) sa dá ťahať. Dve podmienky: (1) text je
Markdown, takže Tiptap potrebuje prevod Markdown ↔ ProseMirror a hranice
sa musia ukladať ako **index bloku**, nie pozícia v dokumente editora
(Q3 A to spĺňa); (2) Tiptap nech príde do `main` s editorom chatu a rezač
ho prevezme, nie naopak — dve zavedenia tej istej knižnice v dvoch PR
by sa rozišli vo verzii a nastavení. Fáza 1 Tiptap nepotrebuje (Q4 A).

## Údaje, ktoré v modeli neexistujú

- hranice úsekov pri znení (Q3), kolá návrhu s poznámkou kurátora;
- spôsob členenia „ručné hranice" vedľa „články" a „nadpisy";
- stav „členenie skontrolované" pri znení (Q5).

## Rámy

- 1440 svetlá: manuál ISSF-08 s dnešným rezom (bloky, štítky „veľký"
  a „bez nadpisu"), pohľad **Rozdiel** s návrhom AI (nová hranica,
  zrušená hranica, zdôvodnenie), pole „Čo nesedí" s poznámkou a históriou
  dvoch kôl, plné „Prijať a preindexovať".
- 390 tmavá: ten istý dokument, pohľad **Návrh**, pole „Čo nesedí";
  karta postupu s krokom „Skontrolovať členenie" (Q5 A).

## Prompt pre Claude Design

```
Navrhni KNIZ-rezac-blokov — stránku Členenie na úseky (/library/[id]/chunks)
ako vizuálny rezač: dokument ako text, úseky ako farebné bloky, návrh
rezu od AI ako prekrytie, pole na vyjadrenie kurátora a ďalšie kolo.
Je to DIFF proti existujúcej stránke; mená akcií a texty, ktoré ostávajú,
nemeň, nové pomenuj.

Dnes: súhrn (profil „Článok“ · cieľ 300–900 tokenov, znenie, počet
úsekov, % s článkom, tokeny min–priemer–max), Čo nesedí (celý text
v jednom úseku / málo článkov / N úsekov nad limit / krátke úlomky),
Rozbor textu, Návrh AI (stratégia, istota, problémy, „Skúsiť →"),
Skúsiť iný rez (4 polia: slovo článku, slovo prílohy, úsek od/do
tokenov; GET), Profil pre tento dokument (použiť existujúci / uložiť
nový), zoznam úsekov ako zbalené details s číslom, článkom, tokenmi
a ukážkou 180 znakov. Šírka 900, bez JavaScriptu.

Má byť:
1. Text platného znenia celý na obrazovke; každý úsek = blok s vlastným
   tónom podkladu (4–6 tónov z --accent-soft, nie dúha) a ľavým pruhom;
   pri začiatku bloku číslo, článok/nadpis, tokeny; varovania ako štítky
   pri bloku („veľký", „úlomok", „bez nadpisu"). Súhrn ako jeden riadok
   nad textom. Zoznam details zaniká.
2. Tiché „Navrhnúť rezy": návrh AI ako druhá vrstva v tom istom texte —
   zhodné hranice tiché, nové zvýraznené (čiara + „nová hranica: časť
   4.2" + zdôvodnenie), zrušené prečiarknuté. Prepínač pohľadu
   .view-switch: Dnes · Návrh · Rozdiel. Stav v adrese.
3. Pod textom pole „Čo nesedí" (textarea) a tiché „Navrhnúť znova";
   história kôl (kto, kedy, poznámka, čo model zmenil), návrat ku kolu.
4. Jedno plné tlačidlo: „Prijať a preindexovať" na konci (R2). Keď je
   návrh profil, uloží sa profil (D79); inak ručné hranice pri znení.
5. Fáza 2 (nakresli ako samostatný rám, označ „neskôr"): hranica sa dá
   ťahať myšou medzi blokmi, vložiť/zrušiť kliknutím na okraj bloku.
   Hranica len medzi blokmi (odsek, nadpis, položka, riadok tabuľky).
6. Karta postupu v detaile dokumentu: krok „Skontrolovať členenie"
   s odkazom po nahratí, kým sa návrh neprijme/neodloží (Q5 A).

Pravidlá: najviac jedno plné .button; .view-switch sivý pre pohľad;
stav v adrese; bez JavaScriptu okrem fázy 2; farby organizácie
(tenantStyle); terč 44 px; svetlá aj tmavá; zlomy 640 a 1024; 390
tmavá a 1440 svetlá; AI navrhuje len hranice a stratégiu, text nemení.

Rámy: 1440 svetlá — manuál ISSF-08 Dnes (bloky so štítkami), Rozdiel
(návrh AI s novou a zrušenou hranicou), Čo nesedí s históriou dvoch kôl
a Prijať; 390 tmavá — Návrh, Čo nesedí, karta postupu s krokom.

Výstup ako doteraz: KNIZ-rezac-blokov.html + .md so sekciami Čo sa mení,
Kde, Prečo, Rozhodnutia v repozitári, Rámy, Údaje, ktoré v modeli
neexistujú, Rozhodnuté (Q1 A: celý text modelu; Q3 A: ručné hranice pri
znení ako index bloku — rozhodol Ján 15. 10. 2026), Otázky (každá
s odporúčaním, odporúčaná prvá: Q2 automaticky pri nahratí, Q4 fáza 1
serverovo bez Tiptapu, Q5 krok v karte postupu) a Prompt pre Claude Code.
```
