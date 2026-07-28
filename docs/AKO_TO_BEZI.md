# Ako beží jedna otázka

> Od kliknutia po odpoveď s citáciami. Ku každému kroku je uvedené, **kto ho
> vykonáva** — či naša aplikácia, databáza, alebo cudzí model — a **kde sa
> pritom spracúva text** (ADR-002).
>
> Stav k 2026-07-27, konfigurácia `DATA_RESIDENCY=eu-data`, tier T1.

---

## Prehľad

| # | Krok | Kto to robí | Model | Kde | Čas |
|---|---|---|---|---|---|
| 0 | Prihlásenie | `middleware.ts` | — | Vercel | — |
| 1 | Validácia vstupu | `route.ts` | — | Vercel | < 1 ms |
| 2 | Profil tenanta | `tenantProfile.ts` | — | Vercel | < 1 ms |
| 3 | Klasifikácia | `queryClassifier.ts` | **žiadny** | Vercel | ~1 ms |
| 4 | Prepis dotazu | `queryPreprocessor.ts` | **Haiku 4.5** | USA | ~1,5 s |
| 5 | Vyhľadanie | `mongoSearch.ts` → Atlas | **voyage-4** | Frankfurt + USA | ~0,6 s |
| 6 | Preradenie | `$rerank` v pipeline | **rerank-2** | USA | (v kroku 5) |
| 7 | Strážca vektorov | `embeddingGuard.ts` | — | Vercel | < 1 ms |
| 8 | Generovanie | `anthropic.ts` | **Sonnet 5** | USA | ~3 s po prvý token |
| 9 | Prenos k prehliadaču | SSE → `sseKlient.ts` | — | — | priebežne |
| 10 | Zobrazenie | `formatText.ts` | — | prehliadač | < 1 ms |
| 11 | Uloženie | `hodnotenia.ts` | — | Frankfurt | ~50 ms |

**Tri rôzne modely v jednej odpovedi.** Nie je to prepych: Haiku je desaťkrát
lacnejší než Sonnet a na prepis dotazu stačí; embedding a rerank sú
špecializované modely, ktoré text negenerujú, len merajú podobnosť.

---

## 0. Prihlásenie

`src/middleware.ts` beží **pred každou stránkou aj API volaním**. Chránené je
všetko okrem `/prihlasenie` a `/api/auth` — definované ako „všetko okrem", nie
výpočtom chránených, aby nová stránka bola chránená automaticky.

Bez platného tokenu vracia API `401` (nie presmerovanie — HTML stránku by
klient skúsil čítať ako dátový prúd).

Prihlásenie samo: odkaz v e-maile cez **Ecomail** (CZ, teda EÚ). Prechádza ním
len adresa a jednorazový token, nie obsah noriem.

## 1. Validácia vstupu

`src/app/api/chat/route.ts`. Dotaz musí mať 1–1000 znakov. Z tokenu sa určí
rola: prihlásený → `internal`, inak `public`. Rola sa premietne do filtra
vyhľadávania — verejný používateľ interné dokumenty nedostane ani omylom.

## 2. Profil tenanta

`src/lib/tenantProfile.ts` → `defaultProfile()`, `getProviders()`.

Profil hovorí, **ktoré tri adaptéry sa použijú** (embedding, rerank,
generovanie) a v akom režime rezidencie a izolácie. Pri načítaní sa overí:

- vektorový priestor sedí s modelom,
- lokalita každého adaptéra je prípustná pre `dataResidency` (ADR-002),
- izolácia sedí s `tier` (ADR-002, dodatok 10).

Nepovolená kombinácia **profil neprejde a aplikácia sa nespustí**. Radšej
tvrdé zlyhanie než ticho odoslať text tam, kam nemá.

## 3. Klasifikácia dotazu — bez modelu

`src/lib/queryClassifier.ts`, funkcia `classifyByHeuristic()`.

Rozhoduje, ktorý spôsob vyhľadávania sa použije. **Žiadny model sa nevolá** —
sú to regulárne výrazy a počet slov:

| Podmienka | Výsledok |
|---|---|
| Obsahuje `§`, `čl.`, `ods.`, kód normy, rok, URL | `fulltext` |
| Najviac 3 slová | `fulltext` |
| Aspoň 8 slov | `vector` |
| Medzi tým | `hybrid` |

Existuje aj varianta cez model (`classifyByLLM`), predvolene **vypnutá**:
pridala by sekundu latencie za rozhodnutie, ktoré heuristika zvládne za
milisekundu.

## 4. Prepis dotazu — Claude Haiku 4.5

`src/lib/queryPreprocessor.ts` → utility adaptér.

Model dostane dotaz a vráti JSON: prepísané znenie (opravené preklepy,
doplnený kontext), prípadné pod-otázky a kľúčové pojmy. Beží na **Haiku**,
nie na hlavnom modeli — desaťnásobne lacnejšie a na túto úlohu to stačí.

> **Otvorená otázka (E6).** Tento krok stojí ~1,5 s a beží **pred**
> vyhľadávaním, takže sa zaň platí priamo v čase po prvý token. Či prepis
> zlepší nájdené dosť na to, aby sa to oplatilo, ukáže až zlatá sada.
> Dá sa vypnúť: `PREPROCESSING_DEFAULT=false`.

## 5. Vyhľadanie — MongoDB Atlas

`src/lib/mongoSearch.ts`. Podľa kroku 3 sa použije jedna z troch ciest.

### `hybrid` — obe naraz (najčastejšie)

Agregácia `$rankFusion` spustí dva vyhľadávače súčasne a výsledky zlúči:

| Vetva | Čo robí | Váha |
|---|---|---|
| `$vectorSearch` | sémantická podobnosť | **0,6** |
| `$search` | presná zhoda slov (BM25, tolerancia na preklep) | 0,4 |

Vektor prevažuje, lebo otázky sú v prirodzenej slovenčine.

### Kde sa robí embedding otázky

**V databáze, nie u nás.** Pri `atlas-auto` má `$vectorSearch` v poli `path`
uvedené **textové** pole a Atlas si otázku prevedie na vektor sám modelom
**voyage-4**. Preto v našom kóde nikde nevoláme embedding API — a preto
Atlas potrebuje `ATLAS_VOYAGE_KEY`.

Dôsledok pre rezidenciu: **túto inferenciu MongoDB prevádzkuje v USA**
(doložené zoznamom subprocesorov: Google LLC, United States). Dáta v pokoji
sú vo Frankfurte, ale text otázky ide na embedding za oceán.

### Filtre

Do vyhľadávania vstupujú vždy:

- `accessLevel` podľa role — interný obsah sa verejnému nezobrazí,
- `isActive: true` — **archivované znenia noriem sa nevracajú**. Toto bola
  kedysi tichá chyba: vyhľadávanie vracalo aj zrušené znenia a nikto si to
  nevšimol.
- `chunkType != "preambula"` — preambuly inak zaberali prvé miesta, lebo sú
  podobné každej otázke.

## 6. Preradenie — voyage rerank-2

Stupeň `$rerank` **vnútri tej istej agregácie**. Zoberie 20 kandidátov
z kroku 5 a prehodnotí ich presnejším modelom, ktorý porovnáva otázku
s každým úryvkom priamo. Ponechá **5 najlepších**.

Že je to súčasť pipeline, má dva dôsledky: čas sa započíta do vyhľadávania
(preto samostatná fáza „rerank" ukazuje nulu) a inferencia beží **na
infraštruktúre MongoDB v USA**.

Pri `fulltext` sa rerank **zámerne nepoužíva** — tam ide o presné výrazy a
poradie podľa BM25 je to, čo chceme. Počet výsledkov je ale rovnaký (5), aby
sa módy dali porovnávať.

Pri on-prem nasadení sa tento stupeň vynechá a preradenie urobí vlastná
služba (TEI/Infinity) v aplikačnej vrstve.

## 7. Strážca vektorového priestoru

`src/lib/embeddingGuard.ts`. Overí, že nájdené úryvky boli vektorizované tým
istým modelom, aký je v profile. Vektory z rôznych modelov sa nedajú
porovnávať — pri nezhode by vyhľadávanie ticho vracalo nezmysly. Preto radšej
chyba 500.

## 8. Generovanie — Claude Sonnet 5 s Citations API

`src/lib/llmGenerator.ts` → `src/lib/providers/generation/anthropic.ts`.

Model dostane:

- **systémový prompt** — „odpovedáš VÝLUČNE z poskytnutého kontextu; ak
  odpoveď v ňom nie je, povedz to úprimne",
- **päť dokumentových blokov** — každý úryvok ako samostatný `document`
  s názvom normy, článkom a `citations: { enabled: true }`,
- **otázku**.

Že sú úryvky poslané ako **dokumenty, nie ako text v prompte**, je jadro
celej dôveryhodnosti. Model vďaka tomu nevracia len text, ale aj **doslovné
citácie s odkazom na konkrétny dokument** — a tie nevymýšľa, vyberá ich
z toho, čo dostal. Preto je pri odpovedi štítok „citácie overené modelom".

Odpoveď prichádza po častiach (streaming), takže sa text objavuje priebežne.
Zo streamu sa zbierajú aj:

- **stop_reason** — `max_tokens` znamená useknutú odpoveď a rozhranie to
  povie nahlas; bez toho by sa neúplná odpoveď tvárila ako hotová,
- **spotreba tokenov** — vstup a cache prídu na začiatku, výstup na konci.

## 9. Prenos k prehliadaču

Server posiela udalosti ako Server-Sent Events. `src/lib/sseKlient.ts` ich
číta a **drží buffer**: jedna udalosť sa môže rozdeliť medzi dve čítania a
naivné spracovanie by ju stratilo. Na localhoste sa to neprejaví, v produkcii
áno.

Klient meria **čas po prvý token** — server ho zmerať nevie, lebo nevie, kedy
to dorazilo k človeku.

## 10. Zobrazenie

`src/lib/formatText.ts`:

- rozloží markdown modelu na odseky, nadpisy a zoznamy — **bez knižnice a bez
  `dangerouslySetInnerHTML`**, lebo vstupom je výstup modelu nad cudzími
  dokumentmi,
- očistí citácie od navigačného breadcrumbu, ktorý do textu vkladá chunker,
- **zlúči citácie na to isté miesto** — model cituje ten istý úryvok pri
  každom tvrdení a pri dlhej odpovedi ich vznikne aj devätnásť.

## 11. Uloženie

`src/lib/hodnotenia.ts` zapíše záznam do kolekcie `evaluations` **hneď, ešte
pred hodnotením**: automatické metriky D9 (hit@5, latencia, únik interného
obsahu) sa dajú spočítať aj z odpovedí, ktoré nikto neposúdil.

Ukladá sa aj **cena aj tokeny**. Cena je historický fakt — čo to stálo v deň
otázky — a spätne sa nedopočíta, lebo cenníky sa menia. Tokeny sú nemenné a
dovolia prepočet podľa nových sadzieb. Preto ide do záznamu aj označenie
použitého cenníka.

---

## Čo z toho vyplýva pre rezidenciu

Pri dnešnej konfigurácii (`eu-data`) **text otázky opustí EÚ trikrát**:

| Krok | Kam | Prečo |
|---|---|---|
| Prepis dotazu | USA (Anthropic) | Haiku |
| Embedding otázky | USA (Google LLC pre MongoDB) | voyage-4 |
| Preradenie | USA (infraštruktúra MongoDB) | rerank-2 |
| Generovanie | USA (Anthropic) | Sonnet 5 |

Dáta v pokoji — dokumenty, indexy, zálohy, hodnotenia — sú vo **Frankfurte**.

To je pre režim `eu-data` v poriadku a právne kryté. Pre `eu-full` alebo
`on-prem` sa **všetky štyri kroky musia presunúť**: generovanie cez Bedrock
vo Frankfurte (adaptér hotový), embedding a rerank na vlastnú službu
s GPU — a to je otvorený bod **O7**.

Aplikácia beží na zdieľanej infraštruktúre Vercelu, takže z pohľadu izolácie
je to **T1**, nech je databáza kdekoľvek.
