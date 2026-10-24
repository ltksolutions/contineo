# Zadanie pre Claude Design — ORG-ai-prehlad

> Podklad pre novú časť **Organizácia → Umelá inteligencia → Prehľad**
> (`/organisation/ai/overview`), ktorá bude tretia za „Nastavenie | Spotreba".
> Pripravené 24. 10. 2026 proti `main` na Jánovu požiadavku. Je to **prvý
> návrh po novom** (`docs/DESIGN.md`, „Prechod do Claude"): vzniká v Claude
> ako artefakt typu *Design* s pripojeným artefaktom „Contineo — design
> system". Časť „Prompt pre Claude Design" sa vloží do toho artefaktu,
> zvyšok je kontext pre Jána.
>
> **Meradlo je design system Contineo** (`.design-sync/conventions.md`,
> `app/src/app/globals.css`, `app/src/components/`).

## Prečo

Ján 24. 10. 2026: chce vidieť **spotrebu podľa ľudí a účelov po mesiacoch**
a ročný prehľad. Zaujíma ho hlavne **suma**, potom **modely** a **tokeny**.

Spotreba je dnes výpis jednotlivých volaní. Pri 594 volaniach za mesiac
odpoveď na otázky „kto minul najviac" alebo „rastie to" z výpisu nevyčíta.
Súčet za mesiac ukáže, ale nie porovnanie medzi mesiacmi.

## Čo je dnes

**Podmenu sekcie** `SectionTabs` (`.tabs`) má dve položky: **Nastavenie**
(`/organisation/ai`) a **Spotreba** (`/organisation/ai/usage`). Obe stránky
vykresľuje `app/src/app/organisation/[section]/page.tsx`.

**Spotreba** (D158, ADR-026) má zhora:

1. Filter `.card.usage-filter`: Od, Do (dátumy), Osoba, Účel (`<select>`)
   a tiché „Použiť". Formulár je GET, takže stav je v adrese
   (`?from=&to=&person=&purpose=`). Predvolené obdobie je aktuálny mesiac.
2. Súčty `.usage-summary`: Volaní, Vstup, Výstup, Cache, Suma (USD) a tiché
   „Export CSV" a „Export Excel" (`/api/ai-usage`, tie isté filtre).
3. Výpis `.usage-table` s najnovšími 500 volaniami. Pod 1024 px sú to karty,
   od 1024 px tabuľka so stĺpcami DÁTUM, OSOBA, NA ČO A PREČO, MODEL,
   TOKENY a SUMA.

**Dáta** (`lib/aiUsage.ts`, kolekcia `ai_usage`) — každé volanie modelu je
jeden záznam:

| pole | čo je |
|---|---|
| `at` | kedy |
| `personId`, `personName` | kto (kópia mena). Pri práci na pozadí je `personId` prázdne a meno je napr. „Kontrola súladu (na pozadí)". |
| `purpose` | jeden z 9 účelov: odpoveď, prepis otázky, triedenie otázky, prepis PDF, čistenie textu, analýza členenia, ťažba FAQ, posúdenie FAQ, kontrola súladu |
| `model`, `provider` | napr. Claude Sonnet, cez Anthropic, Bedrock alebo OpenAI |
| `tokens` | `input`, `output`, `cacheWrite`, `cacheRead` |
| `usd` | suma podľa cenníka |
| `keySource` | kľúč organizácie alebo prevádzkovateľa |
| `unknownModel`, `failed` | model nie je v cenníku (suma 0 neplatí), volanie zlyhalo |

Záznamy sa držia **25 mesiacov** (D159). Na porovnanie je teda vždy celý
minulý rok.

**Chyba na dnešnej obrazovke** (Jánov snímok 24. 10.): od 1024 px sa
v stĺpci OSOBA láme „Kontrola súladu (na pozadí)" po písmenách („Kontro la
súladu (na pozad í)"). Príčina je `overflow-wrap: anywhere` v úzkom stĺpci
`minmax(0, 1fr)`. Oprava sa urobí v tom istom PR (Q6).

## Čo navrhnúť

Jedna obrazovka, **jeden rok po mesiacoch**:

1. **Výber roka** — aktuálny rok a rok predtým, lebo staršie dáta nie sú.
   Je to odkaz, takže stav je v adrese (`?year=2026`).
2. **Prepínač pohľadu** `.view-switch`: **Osoby | Účely | Modely**. Je to
   iné zoskupenie tých istých čísel („ako to vidím"), nie iná stránka.
3. **Súčty za rok**: suma, priemer na mesiac, volania, tokeny (vstup,
   výstup, cache) a porovnanie s tým istým obdobím minulého roka, ak sú
   dáta (Q4).
4. **Graf**: 12 stĺpcov (mesiacov) so **sumou**. Stĺpec sa skladá z 5
   najväčších položiek pohľadu a „Ostatné". Vykreslí ho server ako
   SVG/CSS bez knižnice, takže funguje aj bez JavaScriptu. Prázdne budúce
   mesiace sa ukážu ako prázdne miesto, nie nula.
5. **Matica**: riadky sú osoby, účely alebo modely, stĺpce mesiace I–XII
   a **Spolu**. V bunke je suma, riadky sú zoradené podľa ročnej sumy
   zostupne a na konci je riadok Spolu.
   - **Od 1024 px** je to tabuľka (`Table`). Porovnávajú sa v nej stĺpce,
     takže podľa pravidla v `CLAUDE.md` je správna.
   - **Pod 1024 px** sú to karty: názov, ročná suma, podiel v %, malý
     graf 12 mesiacov a suma posledného mesiaca. 12 stĺpcov sa na telefón
     nezmestí.
   - Bunka je **odkaz do Spotreby** s vyplneným filtrom (mesiac, osoba
     alebo účel). Človek tak vidí jednotlivé volania za číslom.
6. **Modely a tokeny** pri riadku: aké modely použil a koľko tokenov
   (vstup / výstup / cache). Kde to bude (rozbalenie riadku, druhý riadok
   v bunke, alebo len pohľad Modely), rozhodne Q3.
7. **Upozornenia**:
   - Ak sú v období volania s `unknownModel`, suma je neúplná. Vtedy sa
     ukáže `.lnote` s počtom takých volaní.
   - Práca na pozadí (bez `personId`) je v pohľade Osoby vlastný riadok
     so štítkom „na pozadí", nie „Neznámy".
8. **Export Excel** matice — tiché tlačidlo, tie isté parametre (Q5).
9. **Prázdny stav**, keď rok nemá ani jedno volanie.

Účel a model v riadku nesú ľudský názov (`tu.purposes[p].label`,
`modelName()`), nie kľúč.

## Otázky (odporúčaná je vždy prvá)

- **Q1 — Názov časti.**
  **A „Prehľad"** (cs „Přehled", en „Overview"; adresa
  `/organisation/ai/overview`). B „Report". C „Výkaz".
  *Odporúčam A:* rozhranie je slovenské a „Report" je anglicizmus. „Výkaz"
  znie ako účtovný doklad, ktorým to nie je.
- **Q2 — Obdobie.**
  **A Rok po mesiacoch** s výberom roka. B Ľubovoľné obdobie od–do po
  mesiacoch.
  *Odporúčam A:* je to presne otázka „ako sa to vyvíja v roku" a stačí
  jeden ovládač. Ľubovoľné obdobie už rieši Spotreba, kam vedú bunky.
- **Q3 — Kde sú modely a tokeny.**
  **A Pohľad Modely v prepínači a v ostatných pohľadoch ročné tokeny
  ako stĺpec za Spolu.** B Rozbalenie riadku s rozpisom modelov.
  C Prepínač „Suma | Tokeny" nad maticou.
  *Odporúčam A:* suma ostáva hlavná a model je len ďalšie zoskupenie.
  Druhý prepínač nad prvým (C) by sa dal zameniť.
- **Q4 — Porovnanie s minulým rokom.**
  **A Áno, v súčtoch ako „+12 % oproti 2025"** (za rovnaké mesiace).
  B Nie.
  *Odporúčam A:* dáta sú (D159) a je to prvá otázka, ktorú si človek
  pri ročnom čísle položí.
- **Q5 — Export.**
  **A Excel matice ako tiché tlačidlo.** B Bez exportu, stačí Spotreba.
  *Odporúčam A:* ročný prehľad sa nosí na porady a dnešný export dáva
  len jednotlivé volania.
- **Q6 — Oprava stĺpca OSOBA v Spotrebe v tom istom PR.**
  **A Áno.** B Samostatne.
  *Odporúčam A:* je to jeden riadok CSS na tej istej obrazovke a návrh
  ju aj tak kreslí.

## Technicky (pre implementáciu, nie pre návrh)

- Nová stránka `app/src/app/organisation/[section]/overview/page.tsx`
  po vzore `usage/page.tsx`, tretia `TabLink` v podmenu a i18n kľúče
  v `aiUsage` (sk, cs, en).
- Agregácia `$group` podľa mesiaca (`$dateTrunc`) a kľúča pohľadu
  (`personId` / `purpose` / `model`). Mesiace sú v **UTC**, rovnako ako
  filter Spotreby, aby sa číslo v bunke zhodovalo so súčtom po kliknutí.
- Práva sú tie isté ako pri Spotrebe. `companyCode` patrí do `$match` (D32).
- Suma je v USD (`formatUsd`), cenník je v dolároch.

## Prompt pre Claude Design

> Navrhni **novú časť „Prehľad"** v sekcii Organizácia → Umelá inteligencia
> intranetu Contineo. Bude to tretia položka podmenu za „Nastavenie |
> Spotreba" (`/organisation/ai/overview`). Použi **výhradne design system
> Contineo** (pripojený artefakt „Contineo — design system"): jeho triedy,
> tokeny a komponenty. Čo v ňom chýba (napr. graf), pomenuj ako odchýlku
> s odporúčaním. Pridaj ho čo najmenej, z existujúcich tokenov. Apple HIG /
> SwiftUI, mobile first (390, 834, 1440), svetlá aj tmavá téma, slovenské
> texty, farba organizácie podľa `tenantStyle`. Stránka musí fungovať bez
> JavaScriptu: stav je v adrese, ovládače sú odkazy.
>
> Dnes je časť **Spotreba** výpis jednotlivých volaní modelu: filter
> Od/Do/Osoba/Účel, súčty (Volaní, Vstup, Výstup, Cache, Suma v USD),
> Export CSV/Excel a tabuľka DÁTUM, OSOBA, NA ČO A PREČO, MODEL, TOKENY,
> SUMA. Správca z nej nevyčíta, kto a na čo míňa najviac a ako sa to
> vyvíja v roku. **Hlavné je suma, potom modely a tokeny.**
>
> Každé volanie má: čas, osobu (alebo prácu na pozadí, napr. „Kontrola
> súladu (na pozadí)"), účel (9 druhov: Odpoveď, Prepis otázky, Triedenie
> otázky, Prepis PDF, Čistenie textu, Analýza členenia, Ťažba FAQ,
> Posúdenie FAQ, Kontrola súladu), model (napr. Claude Sonnet, Claude
> Haiku), tokeny (vstup, výstup, cache) a sumu v USD. Dáta sú za
> posledných 25 mesiacov. Ilustračné čísla: okolo 600 volaní a 60 $ za
> mesiac, 8–12 osôb, 3–4 modely.
>
> Navrhni:
> 1. **Výber roka** (aktuálny a minulý) ako odkaz.
> 2. **Prepínač pohľadu** `.view-switch`: Osoby | Účely | Modely (sivý,
>    nie farbou organizácie — tú má podmenu).
> 3. **Súčty za rok**: suma, priemer na mesiac, volania, tokeny a
>    „+12 % oproti 2025" za rovnaké mesiace.
> 4. **Graf** 12 mesiacov so sumou, stĺpce zložené z 5 najväčších
>    položiek pohľadu a „Ostatné". Vykresľuje ho server (SVG/CSS), takže
>    potrebuje legendu a textovú alternatívu. Budúce mesiace sú prázdne.
> 5. **Matica** položka × mesiac I–XII + Spolu + ročné tokeny, zoradená
>    podľa sumy, s riadkom Spolu. Od 1024 px je to tabuľka. Pod 1024 px
>    sú to karty: názov, ročná suma, podiel %, malý graf 12 mesiacov,
>    posledný mesiac. Bunka je odkaz do Spotreby s filtrom.
> 6. **Pohľad Modely**: modely so sumou a tokenmi (vstup / výstup / cache)
>    po mesiacoch.
> 7. Upozornenie `.lnote`, keď je suma neúplná (model mimo cenníka),
>    štítok „na pozadí" pri práci bez osoby, tiché „Export Excel" a
>    prázdny stav roka bez volaní.
> 8. Opravu stĺpca OSOBA v dnešnej Spotrebe od 1024 px: „Kontrola súladu
>    (na pozadí)" sa láme po písmenách.
>
> Plné tlačidlo na obrazovke nie je, všetky akcie sú tiché (filter a
> export nie sú hlavná akcia). Odkaz „← Späť" sa nekreslí, návrat je
> cesta.
>
> Do `.md` k návrhu napíš sekciu „Rozhodnuté" s otázkami Q1–Q6
> z podkladu, pri každej s odporúčaním (odporúčaná prvá), a zoznam
> odchýlok od design systému.
