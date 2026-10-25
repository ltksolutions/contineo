<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: EUPL-1.2
-->

# Contineo ako MCP server — koncepcia

> **Stav:** rozhodnuté 2026-10-24 — Q1–Q8 podľa odporúčania, zapísané v
> `docs/decisions/ADR-038-contineo-ako-mcp-server.md` (D249–D256) ·
> **Zadanie:** Ján 2026-10-24 („Poďme začať tvoriť aj MCP server pre
> Contineo"). Tento súbor zostáva ako koncepcia s odôvodneniami.
> **Nadväzuje na:** ADR-029 § 3 bod 4 („Contineo ako MCP server — rovnaká
> vrstva, otočená"), `docs/TODO.md` E2, D29 (hostiteľ určuje tenanta), D32
> (`companyCode` v podmienke dotazu), D43–D45 (prihlásenie nie je povolenie
> vstupu, bránou je `persons`), D174 (výsledok nástroja je obsah, nie pokyn),
> D177 (každé volanie má stopu), ADR-026 (kľúč a spotreba AI organizácie),
> ADR-002 / `residency.ts` (dátová rezidencia), ADR-006 (schvaľovanie
> znenia), ADR-036 (kolo kontroly len po rekapitulácii s cenou).

---

## 1. Čo to je a čo to nie je

**Je:** druhé rozhranie Continea popri webe. Človek pracuje vo svojom AI
klientovi (Claude Code, Cowork, Claude.ai, Claude Desktop, ChatGPT s
konektormi, vlastný agent nad Agent SDK) a ten za neho volá Contineo:
hľadá v knižnici, čerpá odpovede s citáciami, zakladá koncepty dokumentov,
číta stav kontrol súladu, zoznam ticketov… **To isté, čo vidí na webe,
s tými istými právami** — len bez obrazovky.

**Nie je:** nový zdroj práv ani nová logika. MCP server je tenký obal nad
funkciami, ktoré už existujú v `lib/` (`libraryList`, `loadDocumentFor`,
`chatStream`, `uploadDocument`, `listChecks`…). Keď nástroj potrebuje
niečo, čo web nevie, najprv to pribudne v `lib/` pre oba vstupy.

**Zrkadlo ADR-029.** Konektor (ADR-029) je Contineo ako *klient* cudzieho
MCP servera (Sportnet). Toto je *server*: tie isté pojmy (profil, rozsah,
stopa volania, rezidencia) otočené naopak. Kód klienta v `lib/mcp/` sa
nemieša so serverom — ten dostane `lib/mcpServer/`.

### 1.1 Kde sa Jánov popis spresňuje

Zadanie z 24. 10. sedí; tri veci treba povedať presnejšie, lebo z nich
vyplýva architektúra:

1. **„Získanie práv používateľa" — MCP práva nepozná.** Protokol vie len:
   kto je prihlásený (OAuth token) a aké nástroje server *ponúkne*. Role
   sú vec Continea: server po prihlásení zistí osobu v `persons`, jej
   `roles[]` a `accessLevel`, a podľa toho **zostaví zoznam nástrojov pre
   túto reláciu** (`tools/list`). Čo človek nesmie, v zozname nie je — a
   keby to zavolal podľa mena, server to odmietne tou istou kontrolou,
   akú má serverová akcia na webe. Dve brány, jedna logika.

2. **„Obojstranná komunikácia" — MCP je jednosmerné.** Klient volá, server
   odpovedá. Server **nevie klientovi nič poslať sám** (žiadne „príď sa
   pozrieť, pribudla kontrola"). Čo protokol vie: v rámci otvorenej
   relácie poslať oznámenie, že sa zoznam nástrojov zmenil, a požiadať
   klienta o doplnenie vstupu (*elicitation*) alebo o dokončenie textu
   jeho modelom (*sampling*). Upozornenia zostávajú na Kuriérovi a
   zvončeku; MCP ich môže *čítať* (`list_notifications`), nie posielať.

3. **„Analýza dokumentov, súladu…" — rozhodnúť, čí model pracuje.** Pri MCP
   sú dva modely: **model klienta** (Claude v Claude Code, platí si ho
   človek alebo jeho firma) a **model Continea** (kľúč organizácie,
   ADR-026, platí tenant). Nástroj `search_library` dá klientovi úseky
   a *jeho* model z nich urobí odpoveď — Contineo nič neplatí, ale ani
   neručí za znenie a necituje. Nástroj `ask` naopak spustí celý postup
   Continea (`chatStream`: klasifikácia, hybridné hľadanie, rerank,
   generovanie s citáciami, zápis do histórie) — platí tenant, odpoveď
   je tá istá ako na webe. **Obidva majú zmysel a oba budú**, len musí
   byť z názvu a opisu nástroja jasné, ktorý je ktorý (§ 4.1).

---

## 2. Kto je klient a čo z toho vyplýva

| Klient | Odkiaľ volá | Prihlásenie | Dôsledok |
|---|---|---|---|
| Claude Code (CLI, desktop) | z počítača človeka | OAuth 2.1 v klientovi, prípadne hlavička | funguje aj proti `localhost` pri vývoji |
| Cowork, Claude Desktop, Claude.ai (konektory) | **z cloudu Anthropicu** | len OAuth 2.1 (dynamická registrácia alebo zadaný client id) | server musí byť na verejnej adrese; `localhost` nejde |
| ChatGPT, iné agenty | z cloudu poskytovateľa | OAuth 2.1 | to isté |
| vlastný agent (Agent SDK, skript) | odkiaľkoľvek | OAuth alebo osobný token | hodí sa dlhodobý token bez prehliadača |

Z toho: **OAuth 2.1 je nutný** (bez neho sa Cowork a Claude.ai nepripoja),
**osobný token je pohodlný** (skripty, cron, Claude Code bez prehliadača)
a môže prísť neskôr. Streamable HTTP je jediný transport, ktorý má zmysel
(SSE transport je v útlme, stdio je lokálne).

**Adresa je per tenant, ako všetko v Contineu (D29):**
`https://intranet.futbalsfz.sk/mcp`, `https://test.contineo.app/mcp`.
Hostiteľ určí organizáciu ešte pred prihlásením — rovnako ako
prihlasovacia stránka. Token vydaný na jednej doméne na inej neplatí.

---

## 3. Prihlásenie (OAuth 2.1) — kde sa vydáva token

Špecifikácia MCP (revízia 2026-07-28) hovorí: server je *chránený zdroj*
(RFC 9728 — metadáta na `/.well-known/oauth-protected-resource`, povinné),
odkáže na *autorizačný server* (RFC 8414), klient si vypýta token
s PKCE a s parametrom `resource` (RFC 8707), server token overí a
**odmietne token vydaný pre iný zdroj**. Dynamická registrácia klienta
(RFC 7591) je označená za zastaranú v prospech *Client ID Metadata
Documents*, ale klienti ju ešte používajú — treba podporiť oboje.

Kto je autorizačný server, je **prvé rozhodnutie** (Q1):

| | A — Contineo sám | B — Entra / Google ako AS |
|---|---|---|
| Prihlásenie človeka | existujúca prihlasovacia stránka Continea (odkaz v e-maile, Microsoft, Google) + **obrazovka súhlasu** („Claude Code žiada prístup: čítať knižnicu, pýtať sa…") | priamo u poskytovateľa |
| Brána `persons` (D45) | tá istá, pri vydaní kódu | musela by sa robiť pri každom volaní znova z `oid`/`sub` |
| Per tenant | áno, prirodzene (D29) | každý tenant inú Entru, klient by musel vedieť, ktorú |
| Odvolanie prístupu | v plachte účtu: „Pripojené aplikácie", tlačidlo Odpojiť | len u poskytovateľa |
| Čo treba napísať | registrácia klienta, `authorize`, `token`, `revoke`, metadáta, úložisko kódov a tokenov — SDK má referenčnú implementáciu (`server/auth`) | mapovanie `aud`/`scope` cudzieho tokenu, bez súhlasu per aplikácia |
| Odkaz z e-mailu (bez Microsoftu) | funguje | nefunguje |

**Odporúčanie: A.** Contineo už *je* miestom, kde sa človek prihlasuje a kde
`persons` rozhoduje o vstupe (D43–D45); OAuth server nad tým je obrazovka
súhlasu plus štyri endpointy, ktoré SDK z väčšej časti dá. B by rozbilo
prihlásenie odkazom z e-mailu a per-tenant Entru.

Ďalšie body k A:

- **Token je viazaný na (tenant, osoba, klient, rozsahy).** Nesie
  `personId`, `companyCode`, `clientId`, `scope[]`, platnosť. Prístupový
  token krátky (1 h), obnovovací dlhší (30 dní, otáča sa pri použití).
  Ukladá sa **hash** tokenu, nie token (ako heslo).
- **Rozsahy (`scope`)** sú hrubé a čitateľné pre človeka na obrazovke
  súhlasu: `library.read`, `ask`, `library.write`, `compliance.read`,
  `compliance.run`, `helpdesk`, `people.read`, `learning`. **Rozsah
  nerozširuje role** — je to prienik: čo človek smie *a* čo klientovi
  povolil. Klient s `library.write` od človeka bez `content-admin` nič
  nezapíše.
- **Súhlas je dôkazný záznam** (D24): kto, kedy, ktorému klientovi, aké
  rozsahy, v akom jazyku videl text — ako potvrdenie normy (D28). Odvolanie
  je `revokedAt`, nie `deleteOne`.
- **Núdzová brzda `ALLOWED_EMAILS`** platí aj tu, ako pri každom prihlásení.
- **Jeden človek, viac klientov.** Plachta účtu dostane sekciu
  „Pripojené aplikácie": názov klienta, kedy pripojený, posledné použitie,
  rozsahy, Odpojiť. Správca osôb to vidí za celú organizáciu a smie
  odpojiť komukoľvek.

---

## 4. Čo server ponúka

### 4.1 Nástroje podľa role

Zoznam je **zostavený pre reláciu**: základ pre každého a bloky podľa
rolí osoby (`persons.roles`, ADR-022/ADR-028…). Názvy anglické, opisy pre
model slovenské/anglické podľa jazyka osoby (`persons.language`) — opis
nástroja je text pre model, nie pre človeka, preto pôjde cez i18n ako
každý iný text (odporúčanie: anglicky, lebo opis číta model a schémy sú
anglické; Q6).

**Každý prihlásený (`library.read`, `ask`):**

| Nástroj | Čo robí | Opiera sa o |
|---|---|---|
| `whoami` | osoba, organizácia, role, jazyk, rozsahy tokenu | `persons`, token |
| `search_library` | hybridné hľadanie úsekov s citáciou (dokument, znenie, článok), **bez modelu** | `mongoSearch` s filtrom `companyCode` + `accessLevel` |
| `get_document` | znenie platné k dňu (ADR-024) ako Markdown, metadáta, história znení | `loadDocumentFor`, `effectiveVersion` |
| `list_documents` | zoznam s filtrami ako Knižnica (druh, značky, stav, oddelenie) | `libraryList`, `libraryFacets` |
| `document_hierarchy` | nadradené / podradené dokumenty (ADR-034) | `hierarchyDocuments` |
| `ask` | **celá odpoveď Continea** s citáciami a hlavičkou „v čom sa hľadalo"; zapíše sa do histórie ako otázka z webu; voliteľne zdroje (knižnica, konektory) ako na `/ask` | `chatStream` zozbieraný do jednej odpovede |
| `my_acknowledgements` | čo mám potvrdiť, čo som potvrdil, termíny | `acknowledgements`, `assignments` |
| `list_notifications` | zvonček a Kuriér — len čítanie | `notifications`, `courier` |

**Správca obsahu (`content-admin`, rozsah `library.write`):**

| Nástroj | Čo robí | Pravidlo |
|---|---|---|
| `create_draft_document` | nový dokument **ako koncept** z Markdownu (+ PDF sa vysádza u nás, ADR-031) | nikdy nezverejňuje — zverejnenie je ľudský akt na webe (ADR-006) |
| `create_draft_version` | nové znenie existujúceho dokumentu ako koncept | to isté |
| `update_draft_text` | prepísať text konceptu | strážca zápisu ako v editore (`markupGuard`) |
| `set_draft_metadata` | druh, značky, oddelenie, právny základ, hierarchia | `saveDraftMeta`, `saveDocumentParents` |
| `list_drafts` | koncepty a ich stav v postupe znenia (ADR-014) | `libraryList` |
| `propose_chunking` | návrh rezov AI nad konceptom (ADR-035) — model Continea, platí tenant | `chunkProposal` |

**Kontrola súladu (`compliance`, rozsah `compliance.read` / `compliance.run`):**

| Nástroj | Čo robí | Pravidlo |
|---|---|---|
| `list_checks`, `check_rounds`, `round_findings` | čítanie kontrol, kôl a nálezov | `complianceChecks` |
| `estimate_round` | rekapitulácia s odhadom ceny — **to, čo vidí človek pred spustením** (D234) | vráti `confirmationToken` |
| `start_round` | spustí kolo len s platným `confirmationToken` z `estimate_round` | bez neho odmietne; D234 bez výnimky |
| `decide_finding` | prijať / upraviť / ponechať nález | ako na webe, zapíše kto |

**Helpdesk (`helpdesk`):** `list_tickets`, `get_ticket`, `draft_reply`
(návrh len z verejného obsahu, `ticketDraft` — D176 platí), `set_ticket_state`.
**Odoslanie e-mailu cez MCP nie je** (R2: odoslanie po náhľade je ľudský
krok).

**HR (`hr`):** `assignments_overview`, `acknowledgement_report`
(ten istý výkaz ako `npm run ack:report`), `assign_document`
(pridelenie s termínom, ADR-004).

**Vzdelávanie (`learning-admin`, rozsah `learning`):** `list_courses`,
`course_progress`, `create_course_draft`, `generate_questions` (model
Continea).

**Správca osôb (`people-admin`, rozsah `people.read`):** `find_person`
(bez osobných údajov nad meno, e-mail, oddelenie, role),
`person_memberships`. Zápis osôb cez MCP vo fáze 1 nie je — import má
vlastné pravidlá (ADR-019) a dotyk s GDPR; Q5.

**DPO (`dpo`):** zatiaľ nič. DPO funkcie sú zriedkavé a citlivé; keď bude
dôvod, pribudnú vlastným rozhodnutím.

**Správca platformy (`platform-admin`):** nič. Správa tenantov zostáva
na webe (D41: platforma číta počty, nie obsah).

### 4.2 Zdroje (*resources*) a šablóny (*prompts*)

MCP má okrem nástrojov aj **zdroje** (obsah s adresou, klient si ho
pripne do kontextu) a **šablóny výziev**. Oboje stojí málo a výrazne
zlepšuje prácu v Claude Code:

- `contineo://documents/{documentId}` — Markdown platného znenia, ako
  `get_document`, ale ako zdroj: človek v Claude Code napíše
  `@contineo:documents/sfz:stanovy` a má Stanovy v kontexte.
- `contineo://documents/{documentId}/versions/{versionId}` — konkrétne
  znenie (porovnávanie dvoch znení modelom klienta).
- `contineo://drafts/{documentId}` — text konceptu.
- šablóny: „Skontroluj tento koncept proti nadradeným dokumentom",
  „Zhrň zmeny medzi dvoma zneniami", „Navrhni odpoveď na ticket len
  z verejných dokumentov" — každá vopred načíta správne zdroje.

### 4.3 Čo server **nikdy** neurobí (fáza 1 aj neskôr)

- nezverejní znenie (ADR-006), nepotvrdí normu za človeka (D24, D28),
- neodošle e-mail ani správu v Kuriérovi,
- nespustí platený beh bez rekapitulácie a potvrdenia (D234),
- nezmaže nič (D24; archivácia je rozhodnutie na webe),
- nevráti interný obsah tokenu s úrovňou `public`, ani obsah inej
  organizácie — `companyCode` je v podmienke dotazu (D32), ako všade.

---

## 5. Bezpečnosť a prevádzka

**Výsledok nástroja je obsah, nie pokyn (D174 otočené).** Server
posiela text z knižnice cudziemu modelu; nemá ako ovplyvniť, čo si z neho
model vezme. Čo *môže*: nevkladať do odpovedí nič, čo vyzerá ako pokyn
(žiadny „SESSION CONTEXT" ako Sportnet), a označiť živé zdroje
(konektory) inak než knižnicu, ako na webe.

**Stopa každého volania (D177 otočené).** Kolekcia `mcp_calls`: osoba
(kópia mena, D158), klient, nástroj, trvanie, výsledok, veľkosť odpovede —
**bez znenia otázky**, ako výkaz spotreby AI. Otázky cez `ask` idú do
histórie otázok ako z webu (tam znenie je, lebo to tak je aj na webe).
Záznamy sa nemenia.

**Spotreba AI** z `ask`, `propose_chunking`, `start_round`,
`generate_questions` sa účtuje organizácii ako z webu (ADR-026), s
poznámkou „cez MCP: názov klienta". Strop otázok na osobu a hodinu ako
widget (D14) — agent v slučke vie minúť viac než človek.

**Dátová rezidencia (ADR-002).** Toto je najcitlivejšie: obsah knižnice
odchádza do modelu klienta, ktorý si Contineo nevybralo a nevie, kde
beží. Odporúčanie (Q3): MCP server je **zapínateľné nastavenie
organizácie** (Organizácia → Prístup → „Prístup pre AI asistentov"),
predvolene vypnuté; v režimoch `on-prem` a `air-gap` sa nedá zapnúť
(perimeter), v `eu-full` sa zapne len s poznámkou, že klient si vyberá
človek a organizácia za to ručí. `global` a `eu-data` bez obmedzenia.
Kontrola rovnakou tabuľkou ako `checkConnector()`.

**Interný obsah smerom von.** Token osoby s `accessLevel: internal` dá
interné smernice do Claude.ai konta, ktoré môže byť osobné. To nie je
nová diera — ten istý človek si ich môže skopírovať z webu — ale je to
*pohodlnejšia* cesta a správca má o nej vedieť: preto zoznam pripojených
aplikácií za organizáciu a prepínač „len verejný obsah cez MCP"
na organizácii (Q4).

**Vývoj a test.** Proti `localhost` ide Claude Code aj Claude Desktop
(lokálne). Cowork a Claude.ai potrebujú verejnú adresu — `test.contineo.app`
po nasadení vetvy, nie `localhost`.

---

## 6. Technika a umiestnenie v repozitári

- **Transport:** Streamable HTTP cez `@modelcontextprotocol/sdk`
  (`WebStandardStreamableHTTPServerTransport`, v 1.32 je) v route handleri
  Next: `app/src/app/mcp/route.ts` (`GET`, `POST`, `DELETE`). Bez stavu
  medzi požiadavkami (serverless) — relácia sa drží v tokene a hlavičke
  `Mcp-Session-Id`, nie v pamäti procesu.
- **OAuth:** `app/src/app/.well-known/oauth-protected-resource/route.ts`,
  `app/src/app/.well-known/oauth-authorization-server/route.ts`,
  `app/src/app/oauth/{register,authorize,token,revoke}/route.ts`, obrazovka
  súhlasu `app/src/app/oauth/consent/page.tsx` (design system: `.set-sec`,
  jedno plné tlačidlo „Povoliť", tiché „Zamietnuť"). Úložisko:
  kolekcie `oauth_clients`, `oauth_codes`, `oauth_tokens` (hash),
  `oauth_grants` (súhlasy, dôkazné).
- **Server:** `lib/mcpServer/` — `server.ts` (zostavenie `McpServer` pre
  reláciu), `tools/<area>.ts` (jeden súbor na oblasť: `library.ts`,
  `ask.ts`, `compliance.ts`…), `auth.ts` (overenie tokenu → `McpActor`),
  `calls.ts` (stopa). Každý nástroj: `scope` + `roles` + handler, ktorý
  volá existujúcu `lib/` funkciu s `companyCode` z tokenu.
- **Verejné cesty sú zmluva** (`CLAUDE.md`): `/mcp` a `/.well-known/*`
  sa po zverejnení nepremenúvajú — klienti ich majú uložené.
- **Testy:** vitest nad zostavením zoznamu nástrojov podľa rolí (každá
  rola dostane svoje a nič navyše), nad odmietnutím tokenu cudzieho
  tenanta, nad `start_round` bez potvrdenia. Integračne: `npx
  @modelcontextprotocol/inspector` proti `localhost:3000/mcp`.

---

## 7. Rozhodnutia na Jánovi (každé s odporúčaním)

| # | Otázka | Odporúčanie | Prečo |
|---|---|---|---|
| **Q1** | Kto vydáva token: Contineo (A) alebo Entra/Google (B)? | **A** | § 3: brána `persons`, per tenant, odkaz z e-mailu, odvolanie v plachte účtu |
| **Q2** | Poradie fáz | **1:** OAuth + `whoami`, `search_library`, `get_document`, `list_documents`, `ask`, zdroje dokumentov · **2:** koncepty (`library.write`) a kontrola súladu s potvrdením · **3:** helpdesk, HR, vzdelávanie, osobné tokeny | fáza 1 je čítanie — nulové riziko zápisu, a už s ňou je Contineo v Claude Code použiteľné |
| **Q3** | Rezidencia: kde sa smie MCP zapnúť | zapínateľné nastavenie organizácie, predvolene vypnuté; `on-prem`/`air-gap` nie; `eu-full` s poznámkou | obsah ide do modelu, ktorý si vybral človek; organizácia to má zapnúť vedome |
| **Q4** | Interný obsah cez MCP | povolený podľa `accessLevel` osoby, s prepínačom „len verejný obsah" na organizácii a zoznamom pripojených aplikácií pre správcu | nie je to nová diera, ale pohodlnejšia cesta; správca má mať páku |
| **Q5** | Zápis osôb cez MCP | **nie** (ani vo fáze 3) | ADR-019 a GDPR; import má vlastné pravidlá a obrazovku |
| **Q6** | Jazyk opisov nástrojov | **anglicky**, jeden text | opis číta model, schémy sú anglické; texty pre človeka (súhlas, plachta účtu) idú cez i18n v troch jazykoch ako všetko |
| **Q7** | Osobné tokeny (bez prehliadača) | áno, ale **až vo fáze 3**; vytvorenie v plachte účtu, zobrazí sa raz, hash v DB, platnosť najviac 1 rok | skripty a cron ich potrebujú; OAuth stačí pre Claude Code aj Cowork |
| **Q8** | Vlastný identifikátor klienta Contineo (Client ID Metadata Document) | áno, zverejniť `https://contineo.app/.well-known/...` pre náš budúci klient (ADR-029 fáza 3 použije to isté) | nová revízia špecifikácie to preferuje; dynamická registrácia ostáva pre starších klientov |

Po rozhodnutí: ADR-038 (D249+), vetva `mcp/server-phase-1`, jeden PR na fázu.

---

## 8. Čo navyše (nad zadanie)

- **Skill a `.mcp.json` pre Claude Code** v repozitári zákazníka
  (`contineo` plugin): pripojenie jedným príkazom plus skills
  „skontroluj koncept", „pripomienky k zneniu". To je produkt, nie kód
  servera — až po fáze 1.
- **Contineo ako klient aj server naraz** (ADR-029 fáza 3): agent v Claude
  Code sa opýta Continea, Contineo sa opýta Sportnetu. Rozsahy konektorov
  ako na `/ask` sú parametrom `ask`.
- **Verejný MCP bez prihlásenia** pre verejný obsah organizácie (Stanovy,
  poriadky) — ako widget kanála, ale pre agentov. Zmysluplné pre SFZ
  (futbalová verejnosť s vlastným asistentom), ale až po tom, čo bude
  fungovať prihlásený režim; bez tokenu nie je strop na osobu, len na IP.
- **Elicitation pri zápise:** pri `create_draft_document` bez druhu sa
  server opýta klienta (a ten človeka) priamo v protokole, namiesto chyby.
- **Export do Cowork:** `get_document` ako PDF (binárny zdroj) — Cowork
  vie pracovať so súborom.

---

## 9. Fáza 1 v kóde (2026-10-24) a ako sa pripojiť

**Čo je hotové** (vetva `claude/mcp-server-contineo-4dbcd8`):

| Časť | Kde |
|---|---|
| OAuth 2.1 server: klienti, žiadosti, kódy, tokeny (hash), súhlasy (dôkazné) | `lib/oauthServer.ts` |
| metadáta RFC 9728 a RFC 8414 | `app/.well-known/oauth-protected-resource[/mcp]`, `app/.well-known/oauth-authorization-server` |
| registrácia, povolenie, token, odvolanie | `app/oauth/{register,authorize,token,revoke}/route.ts` |
| obrazovka súhlasu (Povoliť plné, Zamietnuť tiché; znenie súhlasu sa ukladá doslovne, D28) | `app/oauth/consent/` |
| MCP server bez stavu (Streamable HTTP, JSON odpoveď) | `app/mcp/route.ts`, `lib/mcpServer/server.ts` |
| brána: organizácia z domény, zapnutie a rezidencia, token, aktívna osoba | `lib/mcpServer/auth.ts`, `lib/mcpServer/access.ts` |
| nástroje `whoami`, `search_library`, `list_documents`, `get_document`, `document_hierarchy`, `ask` | `lib/mcpServer/tools.ts`, `lib/mcpServer/ask.ts` |
| zdroje `contineo://documents/{documentId}[/versions/{versionId}]` | `lib/mcpServer/server.ts` |
| stopa volaní `mcp_calls` (bez znenia) | `lib/mcpServer/calls.ts` |
| nastavenie organizácie **Prístup → AI asistenti** (zapnutie, len verejný obsah, adresa, pripojené aplikácie všetkých) | `app/organisation/[section]/page.tsx`, `organisation/actions.ts` |
| plachta účtu → **Pripojené aplikácie** (vlastné súhlasy, Odvolať) | `app/account/apps/` |
| testy: PKCE, návratové adresy, rozsahy, `resource`, metadáta klienta, zoznam nástrojov podľa rolí, rezidencia, len verejný obsah | `tests/oauthServer.test.ts`, `tests/mcpServer.test.ts` |

**Čo fáza 1 zámerne nemá:** osobné tokeny (D255, fáza 3), `my_acknowledgements`
a `list_notifications` (pribudnú s fázou 2 alebo 3), zdroje konektorov
v `ask` idú len cez `includeLiveSources`.

**Ako sa pripojiť (po zapnutí v Organizácii → Prístup → AI asistenti):**

```bash
claude mcp add --transport http contineo https://intranet.futbalsfz.sk/mcp
```

Potom v Claude Code `/mcp` → Contineo → *Authenticate*: otvorí sa
prihlásenie Continea (ako na portáli), obrazovka súhlasu, a späť.
V Claude.ai / Cowork: Nastavenia → Konektory → *Add custom connector*
s tou istou adresou (bez client id — klient sa zaregistruje sám).
Lokálne proti `http://localhost:3000/mcp` ide Claude Code aj
`npx @modelcontextprotocol/inspector`; Cowork a Claude.ai potrebujú
verejnú adresu.

**Overenie naostro (otvorené):** celý tok s prihlásením sa dá vyskúšať
len s človekom pri prehliadači — zapnutie a vydanie tokenu sú zápisy do
databázy, ktoré asistent v tejto session nerobil. Overené bez zápisu:
vypnutý server odpovedá na metadáta aj `/mcp` kódom 404; `tsc`, `eslint`,
`vitest` (2 933 testov) a `next build` prešli.

---

## 10. Zdroje a Legislatíva cez MCP (2026-10-25)

Katalóg legislatívy (ADR-039) a register zdrojov (ADR-040) prišli do `main`
po fáze 1. MCP server ich odteraz pozná — stále len čítaním, teda v rámci
fázy 1 (D250). Ján 25. 10.: „Áno, doplň MCP o zdroje a Legislatívu podľa
návrhu."

| Nástroj / zdroj | Čo robí | Opiera sa o |
|---|---|---|
| `list_sources` | zdroje, ktoré osoba smie vybrať: knižnica, Legislatíva, konektory — id, druh, predvolene, opis pre model | register (`sourcesRegister` + `liveSourcesFor`, D266) |
| `search_library` + `sources` | hľadanie aj v Legislatíve (`lawSearch`) a v konektoroch (`liveSearch`), bez modelu; výsledok nesie `source` a adresu podľa pôvodu (portál, Slov-Lex, server konektora) | to isté ako Opýtať sa |
| `ask` + `sources` | odpoveď z vybraných zdrojov; `includeLiveSources` ostáva ako zastaraný alias „všetky" | `chatStream` s `only` |
| `list_law_acts` | odoberané predpisy organizácie, znenie účinné dnes, počet znení, dokument v knižnici (D260) | `lawSourceState`, `listActs`, `lawDocumentsFor` |
| `get_law_act` | text znenia účinného k dňu alebo konkrétnej časovej verzie, zoznam znení, odkazy na Slov-Lex | `versionsOf`, `catalogVersion` |
| `contineo://law/{rok}/{číslo}[/versions/{timepoint}]` | predpis ako zdroj na pripnutie | ten istý text ako `get_law_act` |

**Pravidlá:**

- Výber zdrojov je ten istý zoznam ako na Opýtať sa (D266): knižnica vždy,
  ďalej len zapnuté, pripojené, rezidenciou dovolené zdroje, ktoré vedia
  hľadať a nepresahujú úroveň osoby. „Len verejný obsah" (D252) schová
  interný konektor; Legislatíva je verejná.
- **Neznámy zdroj je chyba s vymenovaním dostupných**, nie ticho menej —
  model má vedieť, že zdroj organizácia nemá.
- Cez MCP sú len **odoberané** predpisy organizácie, nie celý katalóg
  platformy; neodoberaný predpis sa hlási ako neexistujúci. Rezidencia
  `on-prem` a `air-gap` katalóg nedovolí (D257) ani tu.
- Predpis, ktorý má organizácia zverejnený v knižnici, odpovedá pri
  hľadaní z knižnice (schválené znenie, D260) — `lawSearch` ho z katalógu
  druhýkrát nevracia.
- **`limit` v `search_library` je strop pre každý zdroj zvlášť** (knižnica,
  Slov-Lex, každý konektor), Ján 25. 10. Legislatíva vráti najviac 4 úseky;
  paragraf zákona býva dlhý, preto pri viacerých zdrojoch malý limit.
- Konektor v `search_library` volá cudzí server (stopa `connector_calls`,
  D177), nie jazykový model; zdroj, ktorý nestihol, sa vymenuje vo výsledku.
