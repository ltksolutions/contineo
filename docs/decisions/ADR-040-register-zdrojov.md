<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-040 — Register zdrojov: zdroje obsahu ako vlastná sekcia organizácie, druh zo spoločnej schémy, adaptér ako vlastnosť

> **Stav:** prijaté · **Dátum:** 2026-10-26
> **Rozhodol:** Ján Letko (2026-10-26) — „definíciu sources, čiže ďalších
> zdrojov okrem lokálnej knižnice alebo do lokálnej knižnice, navrhujem
> definovať zvlášť — to nie je o AI, to je sólo register aj s vlastnosťami";
> k zaradeniu Legislatívy: „myslím si, že je to zdroj typu RSS/WEB zo schémy
> contineo.app/sk/technologia"; k návrhu: „Áno, napíš ADR-040 Register
> zdrojov podľa odporúčania (Legislatíva ako zdroj druhu web/RSS
> s adaptérom) a začni presunom Legislatívy do sekcie Zdroje."
> **Čísla rozhodnutí:** D263–D267.
> **Nadväzuje na:** ADR-029 (konektory: pripojenie s viacerými použitiami —
> živý zdroj, import, nástroje; výber zdrojov na Opýtať sa), ADR-037
> (sledovaný zdroj s adaptérom, pôvod `source.type: "web"`), ADR-039
> (katalóg legislatívy, zdroj „Legislatíva" vo výbere zdrojov, D259),
> ADR-026 (umelá inteligencia ako nastavenie organizácie: kľúč, modely,
> spotreba), číselník `sourceType` (pdf, md, web, scan, mcp, api; od júna
> 2026), stránka `contineo.app/sk/technologia`, odsek „Zdroje obsahu (súbory
> aj integrácie)", `CLAUDE.md` (verejné cesty sa prekladajú, nepremenúvajú;
> časť, ktorú má cesta pomenovať, má vlastnú adresu).
> **Implementácia:** krok 1 (26. 10. 2026, #433) — `lib/sourcesRegister.ts`
> (spoločný tvar zdrojov, jediný vstup pre výber zdrojov), sekcia
> Organizácia → **Zdroje** (`/organisation/sources`) s registrom
> a Legislatívou (`/organisation/sources/law`), preklad `/organisation/ai/law`.
> Krok 2 (26. 10. 2026) — konektory ako podstránka Zdrojov
> (`/organisation/sources/connectors[/<id>]`), sekcia Konektory zanikla,
> preklad `/organisation/connectors[/…]` aj `?tab=connectors`; widget kanála
> číta register. Krok 3 v § 2, D267.

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
| **3** | schránka helpdesku ako zdroj v registri; generický web a RSS ako zdroj druhu web bez adaptéra, kolekcia `sources`; stránka Technológia prepísaná podľa registra | — |

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
