<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-040 — Register zdrojov: zdroje obsahu ako vlastná sekcia organizácie, druh zo spoločnej schémy, adaptér ako vlastnosť

> **Stav:** prijaté · **Dátum:** 2026-10-25
> **Rozhodol:** Ján Letko (2026-10-25) — „definíciu sources, čiže ďalších
> zdrojov okrem lokálnej knižnice alebo do lokálnej knižnice, navrhujem
> definovať zvlášť — to nie je o AI, to je sólo register aj s vlastnosťami";
> k zaradeniu Legislatívy: „myslím si, že je to zdroj typu RSS/WEB zo schémy
> contineo.app/sk/technologia"; k návrhu: „Áno, napíš ADR-040 Register
> zdrojov podľa odporúčania (Legislatíva ako zdroj druhu web/RSS
> s adaptérom) a začni presunom Legislatívy do sekcie Zdroje."
> **Čísla rozhodnutí:** D263–D267; Dodatok 1: D268 (mení adresu z D265).
> **Nadväzuje na:** ADR-029 (konektory: pripojenie s viacerými použitiami —
> živý zdroj, import, nástroje; výber zdrojov na Opýtať sa), ADR-037
> (sledovaný zdroj s adaptérom, pôvod `source.type: "web"`), ADR-039
> (katalóg legislatívy, zdroj „Legislatíva" vo výbere zdrojov, D259),
> ADR-026 (umelá inteligencia ako nastavenie organizácie: kľúč, modely,
> spotreba), číselník `sourceType` (pdf, md, web, scan, mcp, api; od júna
> 2026), stránka `contineo.app/sk/technologia`, odsek „Zdroje obsahu (súbory
> aj integrácie)", `CLAUDE.md` (verejné cesty sa prekladajú, nepremenúvajú;
> časť, ktorú má cesta pomenovať, má vlastnú adresu).
> **Implementácia:** krok 1 (25. 10. 2026, #433) — `lib/sourcesRegister.ts`
> (spoločný tvar zdrojov, jediný vstup pre výber zdrojov), sekcia
> Organizácia → **Zdroje** (`/organisation/sources`) s registrom
> a Legislatívou (`/organisation/sources/law`), preklad `/organisation/ai/law`.
> Krok 2 (25. 10. 2026) — konektory ako podstránka Zdrojov
> (`/organisation/sources/connectors[/<id>]`), sekcia Konektory zanikla,
> preklad `/organisation/connectors[/…]` aj `?tab=connectors`; widget kanála
> číta register. Krok 3 (25. 10. 2026, časť) — schránka helpdesku ako riadok
> registra (ukazuje sa, nastavuje sa pri kanáli), stránka Technológia prepísaná
> podľa registra; **generický web a RSS bez adaptéra a kolekcia `sources`**
> zostávajú otvorené — prídu s prvým takým zdrojom (§ 5).

---

## 1. Kontext

**Zdroje sú roztrúsené.** Odkiaľ organizácia berie obsah, sa dnes nastavuje
na troch miestach: Knižnica je vždy; MCP konektory majú sekciu Organizácia
→ Konektory (ADR-029); Legislatíva zo Slov-Lexu skončila pod Organizácia →
Umelá inteligencia (ADR-039, fáza 1), lebo tam bol najbližší voľný priestor;
pripravované weby a RSS (ADR-037) nemajú kam patriť. Výber zdrojov na
Opýtať sa (`askSources.ts`), widget kanála (`widgetSources.ts`) a nástroj
`ask` MCP servera si zoznam skladajú každý zvlášť z tých istých dvoch
funkcií.

**Zdroj nie je vlastnosť umelej inteligencie.** Umelá inteligencia je
spôsob, ako sa z obsahu odpovedá (kľúč, modely, spotreba — ADR-026). Zdroj
je, odkiaľ obsah je, s vlastnými vlastnosťami: druh, čo zdroj vie, úroveň
prístupu, či sa používa predvolene, či ho rezidencia dovoľuje. Sú to dve
veci a každá má mať vlastné miesto.

**Schéma už existuje.** Stránka Technológia opisuje „Zdroje obsahu (súbory aj
integrácie)" ako jednu vrstvu, ktorou tečie obsah: nahratý súbor,
schránka helpdesku, MCP konektor (import do knižnice aj živý zdroj pri
otázke), Slov-Lex ako web so záväzným PDF, „ostatné weby a RSS
pripravujeme"; zdroj identity dáva identitu, nie obsah. Kód to má rovnako:
číselník `sourceType` a pôvod dokumentu `documents.source` (`mcp`, `web`).
Register nemá vymýšľať tretiu schému.

## 2. Rozhodnutia

### D263 — Zdroje sú vlastná sekcia organizácie, umelá inteligencia si nechá kľúč, modely a spotrebu

Organizácia dostáva sekciu **Zdroje** (`/organisation/sources`): register
všetkých zdrojov obsahu s rovnakými stĺpcami — názov, druh, čo zdroj vie,
úroveň prístupu, používať predvolene na Opýtať sa, stav (zapnutý,
nepripojený, blokovaný rezidenciou). Odtiaľ vedú odkazy na nastavenie
každého zdroja. Sekcia Umelá inteligencia si nechá len to, čo o odpovedaní
hovorí: kľúč, modely, spotrebu, prehľad.

### D264 — Druh zdroja je zo spoločnej schémy a určuje, čo zdroj vie

Druhy zdrojov sú tie, ktoré pozná stránka Technológia a číselník
`sourceType`: **súbor** (knižnica — nahratý PDF, DOCX, Markdown…),
**schránka helpdesku**, **MCP konektor**, **web/RSS**. Druh určuje, čo zdroj
vie: súbor len import do knižnice; konektor import, živý zdroj aj nástroje
agenta (ADR-029); web/RSS import aj živý zdroj, s adaptérom alebo bez neho.
Nový druh pribúda do schémy aj na stránku Technológia naraz — register
neukazuje druh, o ktorom web nehovorí, a naopak.

### D265 — Adaptér je vlastnosť zdroja druhu web, nie vlastný druh; Legislatíva je prvý taký zdroj

Legislatíva **nie je vlastný druh zdroja**. Je to zdroj druhu **web/RSS
s adaptérom `slov-lex`** (ADR-037 D242, ADR-039): adaptér vie prečítať
statický portál, históriu znení a záväzné PDF. Ďalšie adaptéry pribudnú
rovnako (český `zakonyprolidi.cz`, úradné vestníky s RSS). Vlastnosti zdroja
Slov-Lex sú odoberané predpisy, používať predvolene a odber do knižnice
(ADR-039 D260). V registri má Legislatíva jeden riadok ako každý iný zdroj;
jej nastavenie je podstránka Zdrojov (`/organisation/sources/law`).

### D266 — Register je spoločný tvar nad existujúcimi dátami a jediný vstup pre výber zdrojov

Register (`lib/sourcesRegister.ts`) **nie je nová kolekcia**. Je to spoločný
tvar zdroja (`RegisteredSource`: id, druh, adaptér, názov, zapnutý,
pripojený, dovolený rezidenciou, používať predvolene, úroveň prístupu, čo
vie, adresa nastavenia) zložený z dnešných dát: `connectors` (ADR-029),
`law_subscriptions` a `law_settings` (ADR-039), knižnica ako stálý prvý
riadok. Výber zdrojov na Opýtať sa, v plachte otázky a v nástroji `ask`
MCP servera **číta register**, nie tri rôzne funkcie — tá istá položka
registra je ten istý riadok vo výbere. Kanál helpdesku si z registra
vyberá, čo povolí (krok 2). Vlastná kolekcia `sources` vznikne až
s generickým webom alebo RSS, ktoré nemajú kam inam (krok 3).

### D267 — Kroky; adresy sa prekladajú

| Krok | Čo | Preklad adresy |
|---|---|---|
| **1** | sekcia Zdroje s registrom; Legislatíva ako podstránka Zdrojov; výber zdrojov z registra | `/organisation/ai/law` → `/organisation/sources/law` |
| **2** | konektory ako podstránka Zdrojov, sekcia Konektory zaniká; kanál helpdesku vyberá zdroje z registra; widget kanála číta register | `/organisation/connectors[/…]` → `/organisation/sources/connectors[/…]` |
| **3** | schránka helpdesku ako zdroj v registri (✅); stránka Technológia prepísaná podľa registra (✅); generický web a RSS ako zdroj druhu web bez adaptéra, kolekcia `sources` (otvorené — s prvým takým zdrojom) | — |

Každý krok je vlastný PR; bez nového ADR, pokiaľ sa nezmení rozhodnutie.
Staré adresy prekladá `lib/legacyRoutes.ts` (`CLAUDE.md`: verejné cesty sa
neprejmenúvajú).

## 3. Dôsledky

- `orgSections.ts` dostáva sekciu `sources` v skupine „Organizácia" medzi
  Umelú inteligenciu a Konektory; i18n `org.tabs.sources` a blok
  `org.sources` v sk/cs/en. Záložka Legislatíva z Umelej inteligencie
  odchádza.
- `askSources.ts` sa stáva tenkou vrstvou nad registrom; pravidlá, ktorý
  konektor smie byť živým zdrojom (zapnutý, pripojený, vie hľadať, úroveň
  prístupu, rezidencia), ostávajú v `liveSources.ts` a register ich volá.
- `docs/TODO.md` dostane kroky 2 a 3; stránka Technológia sa po kroku 3
  prepíše tak, aby hovorila o registri tými istými slovami.

## 4. Zamietnuté

- **Legislatíva ako vlastný druh zdroja** — Slov-Lex je web s adaptérom
  (ADR-037 D242); vlastný druh by znamenal druh pre každý adaptér.
- **Nová kolekcia `sources` hneď** — presun dát konektorov a odberov bez
  nového správania; register ako tvar nad dátami stačí, kým nepríde zdroj,
  ktorý nemá kam inam.
- **Zdroje ako záložka v Umelej inteligencii** — práve to, čo sa opravuje:
  zdroj nie je vlastnosť modelu.
- **Zdroj identity v registri** — poskytuje identitu, nie obsah (stránka
  Technológia); patrí do Prístupu, kde je.

## 5. Otvorené

- Krok 2: či sekcia Konektory zanikne úplne, alebo ostane ako odkaz do
  Zdrojov počas prechodu (odporúčanie: zanikne, preklad adresy stačí).
- Schránka helpdesku ako zdroj (krok 3): dnes je vlastnosť kanála
  (ADR-028); register ju má ukázať, nie preberať.
- Spoločný tvar „čo zdroj vie" pre web bez adaptéra (RSS, sitemap) — až
  s prvým takým zdrojom.

## Dodatok 1 — Druh je zoznam, zdroj je detail: Web / RSS a Slov-Lex (D268, 2026-10-25)

> **Rozhodol:** Ján Letko (2026-10-25) — „mám …/organisation/sources/law, ale
> podľa mňa law je len typ, druh zdroja Web / RSS … Slov-Lex je len slovenská
> legislatíva, príde aj česká a iné zdroje typu Web / RSS"; k návrhu:
> „súhlasím, môžeš to spraviť a aj ten dodatok ADR-040".

**Kontext.** Krok 1 dal Legislatíve adresu `/organisation/sources/law`
a záložku „Legislatíva" vedľa Konektorov. To robí z legislatívy druh
zdroja, hoci podľa D265 je druh **Web / RSS** a Slov-Lex je jeden zdroj
toho druhu. Český zdroj (`zakonyprolidi.cz`, ADR-039 fáza 3) alebo RSS
vestníka by nemali kam patriť, iba ako druhá „Legislatíva".

**D268 — Druh je zoznam, zdroj je detail, ako pri konektoroch.**

- Podmenu Zdrojov: **Register · Konektory · Web / RSS**. Záložka
  „Legislatíva" zaniká.
- `/organisation/sources/web` je zoznam zdrojov druhu Web / RSS
  z registra; `/organisation/sources/web/<id>` je detail zdroja. Dnes je
  jediný `slov-lex` — „Slov-Lex — legislatíva SR" s odoberanými
  predpismi, predvoľbou a ponukou (ADR-039 D259).
- **Id zdroja vo výbere zdrojov je id zdroja, nie druhu:** `slov-lex`
  namiesto `law`. Vo výbere na Opýtať sa sa volá „Legislatíva SR"; český
  zdroj bude samostatný riadok „Legislatíva ČR" a človek si zapne jeden,
  druhý alebo oba.
- **Staré tvary sa prekladajú** (`CLAUDE.md`): `/organisation/sources/law`
  a `/organisation/ai/law` → `/organisation/sources/web/slov-lex`
  (`legacyRoutes.ts`); `?src=law` → `?src=slov-lex` (`askScope.ts`).
- **Nemení sa:** katalóg legislatívy (`law_*`) je sklad pre všetky
  adaptéry legislatívy, nie pre Slov-Lex — jurisdikciu nesie identifikátor
  predpisu (`SK/ZZ/2015/440`), názvy kolekcií sú dáta. `sourceType: "law"`
  na úseku a štítok „Zákon" v citácii hovoria, čo čitateľ číta, nie
  odkiaľ to je. Správa katalógu ostáva `/admin/law`.

## Dodatok 2 — Názvoslovie: web, RSS a crawler (2026-10-26)

> **Rozhodol:** Ján Letko (2026-10-26) — „WEB je adresa, ktorú strážime
> a aktualizujeme z neho index alebo aj preberáme do knižnice; RSS je RSS
> feed, ktorý strážime a aktualizujeme z neho index alebo aj preberáme do
> knižnice; crawler považujem len za pomôcku, ktorá číta a parsuje/preberá
> obsah z WEB a RSS typu zdroja."

- **Web** = sledovaná adresa. **RSS** = sledovaný feed. Oba sú zdroje
  druhu Web / RSS (D264, D265) s dvoma použitiami: aktualizácia indexu
  pre odpovede a odber do knižnice (vždy ako koncept, ADR-037 D243).
- **Crawler** = to, čo D265 volá „adaptér": čítačka, ktorá obsah sledovanej
  adresy alebo feedu číta a parsuje. Nie je to druh zdroja ani jeho
  vlastnosť viditeľná pre správcu; každý web potrebuje crawler podľa
  svojej stavby. V kóde ostáva pole `adapter` (`slov-lex`) — názov poľa
  je dáta, nepremenúva sa (`CLAUDE.md`).
- **Stav k 26. 10. 2026:** sledovaný web funguje — Slov-Lex s crawlerom
  statického portálu (`slovLex.ts`, katalóg ADR-039). Crawler pre ďalšie
  weby vzniká s prvým takým zdrojom (§ 5); crawler pre RSS ešte nie je.
- Verejný web (`contineo.app/sk/technologia`) a obrázok architektúry
  používajú toto názvoslovie; „web bez adaptéra pripravujeme" sa už nepíše,
  lebo to znelo, že web ako zdroj chýba.

