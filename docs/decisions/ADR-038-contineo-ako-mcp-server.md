<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-038 — Contineo ako MCP server: OAuth vydáva Contineo, nástroje podľa rolí, fáza 1 len čítanie

> **Stav:** prijaté · **Dátum:** 2026-10-24
> **Rozhodol:** Ján Letko (2026-10-24) — „Poďme začať tvoriť aj MCP server
> pre Contineo, ktorého hlavnou úlohou je komunikovať s funkcionalitami
> Continea pomocou AI klienta/agenta, napríklad cez Claude Code alebo
> Cowork"; ku koncepcii: „Áno, všetky Q1–Q8 podľa odporúčania. Založ
> ADR-038, commitni koncepciu a začni fázu 1 (OAuth + čítacie nástroje)."
> **Čísla rozhodnutí:** D249–D256.
> **Koncepcia:** `docs/MCP_SERVER_KONCEPCIA.md` (čo to je, klienti, nástroje
> podľa rolí, bezpečnosť, umiestnenie v kóde). Toto ADR zapisuje
> rozhodnutia; odôvodnenia sú v koncepcii a tu sa neopakujú.
> **Nadväzuje na:** ADR-029 § 3 bod 4 (Contineo ako MCP server — rovnaká
> vrstva, otočená), D29 (hostiteľ určuje tenanta), D32 (`companyCode`
> v podmienke dotazu), D43–D45 (prihlásenie nie je povolenie vstupu;
> bránou je `persons`), D174 (výsledok nástroja je obsah, nie pokyn),
> D177 (každé volanie má stopu), ADR-026 (kľúč a spotreba AI organizácie),
> ADR-002 a `residency.ts` (dátová rezidencia), ADR-006 (schvaľovanie
> znenia je ľudský akt), ADR-036 D234 (platený beh len po rekapitulácii),
> D24 (dôkazné záznamy sa nemenia), D28 (potvrdenie doslovne v jazyku,
> v ktorom ho človek videl).
> **Implementácia:** dodatok 2026-10-25 — zdroje a Legislatíva (§ 3a); fáza 1 — `app/src/app/mcp/route.ts`,
> `app/src/app/.well-known/*`, `app/src/app/oauth/*`, `lib/mcpServer/`,
> `lib/oauthServer.ts`, nastavenie organizácie „Prístup pre AI asistentov",
> plachta účtu „Pripojené aplikácie".

---

## 1. Kontext

Contineo je dnes klientom cudzieho MCP servera (ADR-029, Sportnet). Opačný
smer — človek pracuje vo svojom AI klientovi (Claude Code, Cowork,
Claude.ai, vlastný agent) a ten za neho volá Contineo — bol v ADR-029
odložený ako „neskôr". Teraz je na rade.

Špecifikácia MCP (revízia 2026-07-28) určuje: server je OAuth 2.1
chránený zdroj s povinnými metadátami (RFC 9728), klient si token pýta
s PKCE a parametrom `resource` (RFC 8707), server odmietne token vydaný
pre iný zdroj; dynamická registrácia klienta (RFC 7591) je zastaraná
v prospech Client ID Metadata Documents, ale klienti ju ešte používajú.
Cowork a Claude.ai volajú z cloudu Anthropicu a pripoja sa len cez OAuth
na verejnú adresu; Claude Code volá z počítača človeka.

## 2. Rozhodnutia

### D249 — Token vydáva Contineo samo (Q1)

Contineo je zároveň **chránený zdroj aj autorizačný server**. Človek sa
prihlási existujúcou prihlasovacou stránkou (odkaz v e-maile, Microsoft,
Google), prejde bránou `persons` (D45) a na **obrazovke súhlasu** povolí
klientovi vymenované rozsahy. Entra ani Google autorizačným serverom
nie sú: rozbili by prihlásenie odkazom z e-mailu a per-tenant Entru
(D29, D44).

- Adresa servera je per tenant (`https://<doména>/mcp`); token vydaný
  na jednej doméne na inej neplatí (`resource` = adresa servera).
- Token nesie (tenant, osoba, klient, rozsahy). Prístupový token platí
  1 hodinu, obnovovací 30 dní a pri použití sa otáča. Ukladá sa **hash**
  tokenu, nikdy token.
- **Rozsahy nerozširujú role** — platí prienik: čo osoba smie (role,
  `accessLevel`) a čo klientovi povolila.
- **Súhlas je dôkazný záznam** (D24, D28): kto, kedy, ktorému klientovi,
  aké rozsahy, v akom jazyku videl text. Odvolanie je `revokedAt`.
- Podporuje sa dynamická registrácia klienta aj Client ID Metadata
  Document (D256). Núdzová brzda `ALLOWED_EMAILS` platí aj tu.

### D250 — Fázy: 1 čítanie, 2 koncepty a kontrola, 3 agendy a tokeny (Q2)

| Fáza | Čo | Riziko zápisu |
|---|---|---|
| **1** | OAuth, `whoami`, `search_library`, `get_document`, `list_documents`, `document_hierarchy`, `ask`, dokumenty ako zdroje (`contineo://documents/…`) | žiadne |
| **2** | koncepty dokumentov (`library.write`, vždy koncept, nikdy zverejnenie — ADR-006), kontrola súladu s `estimate_round` → `start_round` len s potvrdením (D234) | koncept, platený beh po potvrdení |
| **3** | helpdesk, HR, vzdelávanie, osobné tokeny (D255), zdroje konektorov v `ask` | podľa agendy |

Server **nikdy**: nezverejní znenie, nepotvrdí normu za človeka,
neodošle e-mail ani správu v Kuriérovi, nespustí platený beh bez
potvrdenia, nič nemaže, nevráti obsah inej organizácie ani interný obsah
tokenu s úrovňou `public`.

### D251 — MCP je zapínateľné nastavenie organizácie, rezidencia ho obmedzuje (Q3)

Organizácia → Prístup → „Prístup pre AI asistentov": **predvolene
vypnuté**. V režimoch `on-prem` a `air-gap` sa zapnúť nedá (obsah by
opustil perimeter do modelu, ktorý si vybral človek). V `eu-full` sa zapne
s poznámkou, že organizácia ručí za to, ktorý klient jej ľudia použijú.
`global` a `eu-data` bez obmedzenia. Kontrola rovnakou tabuľkou ako
`checkConnector()` a vynucuje sa pri každom volaní, nie len pri zapnutí.

### D252 — Interný obsah podľa `accessLevel` osoby, s pákou pre správcu (Q4)

Nástroje vracajú to, čo osoba vidí na webe (`public` + `internal` podľa
`accessLevelFor`). Organizácia má prepínač **„len verejný obsah cez
MCP"**; správca osôb vidí **pripojené aplikácie všetkých** a smie odpojiť
komukoľvek. Nie je to nová diera (človek si obsah skopíruje aj z webu),
je to pohodlnejšia cesta a správca má o nej vedieť.

### D253 — Zápis osôb cez MCP nie je (Q5)

Ani vo fáze 3. Import a zmeny osôb majú vlastné pravidlá (ADR-019) a dotyk
s GDPR; `people.read` dá nanajvýš meno, e-mail, oddelenie a role.

### D254 — Opisy nástrojov anglicky, texty pre človeka cez i18n (Q6)

Názvy a opisy nástrojov a schémy vstupov sú **anglické, jeden text** —
číta ich model, nie človek. Obrazovka súhlasu, plachta účtu a hlásenia
idú cez `lib/i18n.ts` v troch jazykoch ako všetko ostatné.

### D255 — Osobné tokeny až vo fáze 3 (Q7)

Dlhodobý token bez prehliadača (skripty, cron) sa vytvorí v plachte účtu,
zobrazí sa raz, v DB je hash, platnosť najviac rok, rozsahy ako pri
OAuth. Vo fázach 1 a 2 stačí OAuth — Claude Code aj Cowork ho vedia.

### D256 — Vlastný Client ID Metadata Document Continea (Q8)

Contineo zverejní vlastný identifikátor klienta (`https://contineo.app/
.well-known/…`) pre budúce použitie Continea ako klienta (ADR-029 fáza 3)
a prijíma ho aj ako server. Dynamická registrácia ostáva pre starších
klientov.

## 3. Dôsledky

- MCP server je **druhé rozhranie nad tou istou `lib/`**: každý nástroj
  volá existujúcu funkciu s `companyCode` z tokenu. Čo web nevie, najprv
  pribudne v `lib/` pre oba vstupy.
- Nové kolekcie: `oauth_clients`, `oauth_codes`, `oauth_tokens` (hash),
  `oauth_grants` (súhlasy, dôkazné), `mcp_calls` (stopa bez znenia otázky,
  ako `connector_calls`).
- Spotreba AI z `ask` sa účtuje organizácii ako z webu (ADR-026) s
  poznámkou o klientovi; strop otázok na osobu a hodinu ako widget (D14).
- `/mcp`, `/.well-known/*` a `/oauth/*` sú **verejné cesty** — po
  zverejnení sa nepremenúvajú (`CLAUDE.md`, prekladová tabuľka).
- Kód klienta (`lib/mcp/`) a servera (`lib/mcpServer/`) sa nemiešajú.

## 3a. Dodatok (2026-10-25) — zdroje a Legislatíva

Po ADR-039 a ADR-040 MCP server číta register zdrojov a katalóg
legislatívy: `list_sources`, výber `sources` v `search_library` a `ask`,
`list_law_acts`, `get_law_act` a zdroje `contineo://law/…`. Stále len
čítanie (D250 fáza 1), bez nového rozhodnutia: výber zdrojov je register
(ADR-040 D266), Legislatíva len odoberané predpisy a rezidencia ako D257.
Podrobne `docs/MCP_SERVER_KONCEPCIA.md` § 10.

## 4. Otvorené

- Fázy 2 a 3 (D250) — každá vlastným PR, bez nového ADR, pokiaľ sa
  nezmení rozhodnutie.
- Verejný MCP bez prihlásenia pre verejný obsah (ako widget kanála) —
  až po prihlásenom režime; bez tokenu nie je strop na osobu.
- Skill a `.mcp.json` pre Claude Code („Contineo plugin") — produkt
  nad serverom, po fáze 1.
