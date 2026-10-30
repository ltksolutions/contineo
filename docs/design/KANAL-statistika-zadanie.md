# Zadanie pre Claude Design — KANAL-statistika

> Podklad pre novú časť kanála **Štatistika** (`/channels/<key>/stats`),
> ďalšiu položku podmenu kanála za „Tickety | Nastavenie". Pripravené
> 30. 10. 2026 proti `main` (`c4b5f56`) na Jánovu požiadavku, návrh A.
> Vzniká v Claude ako artefakt typu *Design* s pripojeným artefaktom
> „Contineo — design system". Časť „Prompt pre Claude Design" sa vloží do
> toho artefaktu, zvyšok je kontext pre Jána.
>
> **Artefakt *Design*:** https://claude.ai/artifact/76i98tBN6FphD6xH6WiQTL
> (plochy 1440 správca, 834 riešiteľ bez ceny, 390 správca; odchýlky
> `.stat-tiles` a `.period-nav` sú v `<helmet>` hlavnej plochy).
>
> **Meradlo je design system Contineo** (`.design-sync/conventions.md`,
> `app/src/app/globals.css`, `app/src/components/`).

## Prečo

Ján 30. 10. 2026: pre každý kanál chce **štatistiku za deň, týždeň, mesiac
a rok**, **prehľad využitia AI a cenu** a pre **board** čísla o tom, ako
dobre Contineo v kanáli odpovedá — počet otázok a odpovedí, správne
a nesprávne odpovede a hodnotenia používateľov.

Dnes je to roztrúsené: hodnotenia sú vo fronte `/evaluation` (bez súhrnu
za kanál), tickety v zozname kanála (bez čísel), cena AI v Organizácii →
Umelá inteligencia → Prehľad (za celú organizáciu, nie za kanál).
Štatistika posudkov `/evaluation/stats` (#509) ukazuje posudky po mesiacoch
a podľa zdroja za celú organizáciu — štatistika kanála z nej berie čísla
jedného kanála a dopĺňa otázky, tickety a cenu. Analýza histórie schránky (`/channels/<key>/history`) ukazuje e-maily
spred Continea, nie prácu Continea.

## Čo je dnes

**Podmenu kanála** `ChannelPartTabs` (`SectionTabs`, `.tabs`): **Tickety**
(riešiteľ kanála) a **Nastavenie** (správca organizácie). Podmenu s jedinou
položkou sa nekreslí.

**Dáta, z ktorých sa štatistika skladá:**

| čo | odkiaľ | za akú dobu |
|---|---|---|
| otázky vo widgete a odpovede s prameňmi | `evaluations` (`origin.kind = widget`), osoba z widgetu | od spustenia widgetu |
| otázky bez odpovede („nenašlo sa") | `ai_usage` (prepis/triedenie otázky bez záznamu odpovede) | od spustenia widgetu |
| hodnotenie používateľa Sedí / Nesedí, poznámka | `evaluations.readerVerdict`, `readerNote` | od spustenia widgetu |
| posudok hodnotiteľa: správne / nesprávne / halucinácia / vyradené | `evaluations.correct`, `hallucination`, `dismissedAt` | od spustenia widgetu |
| tickety: prijaté, odoslaná odpoveď, uzavreté, čas do odpovede | `tickets` (`channelKey`, `messages[]`, `sentAnswer.at`) | celá história |
| volania AI, tokeny, suma v USD | `ai_usage` (`channelKey` od 30. 10., staršie cez osobu z widgetu) | 25 mesiacov |

Ilustračné čísla kanála ISSF Helpdesk: ~40 otázok za týždeň vo widgete,
~25 ticketov, ~15 hodnotení používateľov, ~10 posudkov, 4–8 $ za týždeň.

## Čo navrhnúť

Jedna obrazovka kanála, **jedno obdobie**:

1. **Výber obdobia** `.view-switch`: **Deň | Týždeň | Mesiac | Rok** —
   aktuálne kalendárne obdobie. Pod ním **šípky** na predchádzajúce
   a nasledujúce obdobie a názov obdobia („Týždeň 26. 10. – 1. 11. 2026").
   Všetko odkazy, stav v adrese (`?period=week&at=2026-10-26`).
2. **Súhrnné dlaždice** (nový prvok, Q1) — hlavné čísla pre board, každé
   so zmenou oproti predchádzajúcemu obdobiu:
   - **Otázky** (koľko prišlo),
   - **Zodpovedané** (% s odpoveďou z prameňov),
   - **Spokojnosť** (% „Sedí" z hodnotení používateľov, s počtom hodnotení),
   - **Presnosť** (% „správne" z posudkov hodnotiteľa, s počtom posudkov),
   - **Tickety** (prijaté / zodpovedané, medián času do odpovede),
   - **Cena** (suma v USD a cena na zodpovedanú otázku) — len správca.
3. **Graf** objemu v čase: stĺpce po hodinách (Deň), dňoch (Týždeň,
   Mesiac) alebo mesiacoch (Rok), zložené zo zodpovedaných a
   nezodpovedaných otázok. Existujúci `.chart-*` (ORG-ai-prehlad).
4. **Kvalita** — dve krátke rozdelenia vedľa seba:
   - hodnotenie používateľov: Sedí / Nesedí / bez hodnotenia,
   - posudok hodnotiteľa: Správne / Nesprávne / Halucinácia / Vyradené /
     čaká.
   Počty sú odkazy do `/evaluation` s filtrom (Q4).
5. **Tickety**: prijaté, odoslaná odpoveď, uzavreté, znovu otvorené,
   medián a 90. percentil času do odpovede.
6. **AI a cena** (len správca): matica účel × obdobie (Odpoveď, Prepis
   otázky, Triedenie otázky, Návrh odpovede na ticket, Ťažba FAQ) so sumou
   a tokenmi. Existujúci `.matrix-*`, pod 1024 px karty so `.spark`.
7. **Export Excel pre board** — tiché tlačidlo, to isté obdobie.
8. **Upozornenie** `.lnote`, keď obdobie siaha pred spustenie widgetu
   alebo pred 30. 10. (cena je dopočítaná cez osobu, nie zo záznamu).
9. **Prázdny stav** obdobia bez otázok aj ticketov.

## Otázky (odporúčaná je vždy prvá)

**Q1 — Súhrnné dlaždice.** Design system nemá prvok „číslo s popisom
a zmenou".
- **A (odporúčam):** nový prvok `.stat-tiles` > `.stat-tile` (popis,
  veľké číslo, `small` so zmenou ▲/▼ a farbou stavu), mriežka 2 stĺpce
  pod 640 px, 3 od 640 px, 6 od 1024 px. Board číta hlavné čísla na prvý
  pohľad; ten istý prvok neskôr využije aj Prehľad AI a Analýza histórie.
- B: čísla v riadku `.usage-summary` ako dnes v Spotrebe — bez nového
  prvku, ale zmena oproti minulému obdobiu sa do neho nezmestí čitateľne.

**Q2 — Obdobie.**
- **A (odporúčam):** kalendárne (tento týždeň od pondelka, tento mesiac)
  so šípkami dozadu. Board porovnáva mesiace a roky, nie „posledných 30
  dní".
- B: kĺzavé (posledných 24 h / 7 / 30 / 365 dní).

**Q3 — Kto vidí čo.**
- **A (odporúčam):** správca organizácie všetko; riešiteľ kanála všetko
  okrem ceny. Rovnako ako dnes Prehľad AI patrí len správcovi.
- B: len správca.

**Q4 — Proklik z čísel.**
- **A (odporúčam):** počty hodnotení sú odkazy do `/evaluation` (pohľad
  Posúdené/Vyradené), tickety do zoznamu ticketov kanála. Číslo bez
  prekliku sa na porade nedá vysvetliť.
- B: bez odkazov.

**Q5 — Export.**
- **A (odporúčam):** Excel s jedným hárkom na blok (súhrn, kvalita,
  tickety, AI) za zvolené obdobie a 12 predchádzajúcich období v
  stĺpcoch — tabuľka do prezentácie pre board.
- B: len súhrn zvoleného obdobia.

## Technicky (pre implementáciu, nie pre návrh)

- `lib/channelStats.ts`: agregácie nad `evaluations`, `tickets` a
  `ai_usage` s `companyCode` v podmienke (D32). Kanál pre staršie záznamy
  cez osoby z widgetu (`createdBy: "widget:<key>"`) — len pri výpočte,
  žiadny zápis (D27).
- `ai_usage.channelKey` od #510 (30. 10. 2026).
- Odkaz `channelHref(key, "stats")`, položka v `ChannelPartTabs`.
- Texty cez `lib/i18n.ts` v sk/cs/en.

## Prompt pre Claude Design

> Navrhni **novú časť kanála „Štatistika"** v intranete Contineo
> (`/channels/<key>/stats`). Bude to položka podmenu kanála za „Tickety |
> Nastavenie". Použi **výhradne design system Contineo** (pripojený
> artefakt „Contineo — design system"): jeho triedy, tokeny a komponenty.
> Čo v ňom chýba, pomenuj ako odchýlku s odporúčaním a pridaj ho čo
> najmenej, z existujúcich tokenov. Apple HIG / SwiftUI, mobile first
> (390, 834, 1440), svetlá aj tmavá téma, slovenské texty, farba
> organizácie podľa `tenantStyle`. Stránka musí fungovať bez JavaScriptu:
> stav je v adrese, ovládače sú odkazy.
>
> Kanál (napr. „ISSF Helpdesk") je miesto, kde sa ľudia pýtajú: widget na
> webe (Contineo odpovedá z predpisov s prameňmi) a e-mailová schránka
> (tickety, na ktoré riešiteľ odpovedá s návrhom od AI). Ľudia hodnotia
> odpoveď „Sedí / Nesedí"; hodnotiteľ posudzuje, či bola správna a či
> si niečo nevymyslela (halucinácia), alebo podnet vyradí ako nesúvisiaci.
> Každé volanie AI má cenu v USD.
>
> Štatistiku číta správca a **board** — chcú na prvý pohľad vidieť, koľko
> otázok prišlo, koľko Contineo zodpovedal, ako sú ľudia spokojní, ako
> presne odpovedá a čo to stojí. Ilustračné čísla za týždeň: 40 otázok,
> 34 zodpovedaných, 15 hodnotení (12 Sedí), 10 posudkov (8 správne,
> 1 nesprávne, 1 halucinácia), 25 ticketov s mediánom odpovede 3 h 20 min,
> 6,40 $.
>
> Navrhni:
> 1. **Výber obdobia** `.view-switch` (sivý): Deň | Týždeň | Mesiac | Rok,
>    pod ním šípky na predchádzajúce/ďalšie obdobie a jeho názov.
> 2. **Súhrnné dlaždice** (nový prvok, odchýlka): Otázky, Zodpovedané %,
>    Spokojnosť %, Presnosť %, Tickety, Cena — každá so zmenou oproti
>    predchádzajúcemu obdobiu (▲/▼). Pod 640 px 2 v riadku, od 1024 px 6.
>    Cenu vidí len správca.
> 3. **Graf** objemu otázok v čase (hodiny / dni / mesiace podľa obdobia),
>    stĺpce zodpovedané + nezodpovedané. Použi existujúci `.chart-*`.
> 4. **Kvalita**: dve rozdelenia — hodnotenia používateľov (Sedí /
>    Nesedí / bez hodnotenia) a posudky (Správne / Nesprávne /
>    Halucinácia / Vyradené / Čaká). Počty sú odkazy.
> 5. **Tickety**: prijaté, odpovedané, uzavreté, znovu otvorené, medián
>    a 90. percentil času do odpovede.
> 6. **AI a cena** (len správca): matica účel × čas so sumou a tokenmi
>    (existujúci `.matrix-*`, pod 1024 px karty so `.spark`).
> 7. Tiché „Export Excel", `.lnote` o dopočítaných údajoch, prázdny stav.
>
> Plné tlačidlo na obrazovke nie je. Odkaz „← Späť" sa nekreslí, návrat
> je cesta. Do poznámky k návrhu napíš otázky Q1–Q5 z podkladu, pri každej
> s odporúčaním, a zoznam odchýlok od design systému.
